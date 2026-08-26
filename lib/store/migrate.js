// lib/store/migrate.js
// Migration runner: raw legacy localStorage -> v1 document, plus a
// forward-only schemaVersion upgrade chain for the document itself.
// Pure logic -- no DOM, no Electron, no localStorage access. Callers
// (a browser bootstrap, or a test) hand in plain strings/objects.

import {
  CURRENT_SCHEMA_VERSION,
  SLICE_NAMES,
  defaultDocument,
  defaultProgress,
  defaultSettings,
} from "./schema.js";

function safeParseJSON(raw, fallback) {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * migrateLegacyLocalStorage(snapshot) -> v1 document
 *
 * One-time import of the pre-store localStorage keys. `snapshot` holds the
 * RAW string values exactly as `localStorage.getItem(key)` would return
 * them (or null/undefined if never set), so this is testable with plain
 * strings and mirrors what a browser-side bootstrap passes in.
 *
 * Known legacy keys migrated here (see lib/progress.js, lib/ai/config.js,
 * components/Dashboard.js for the originals):
 *
 *   - "coop_prep_v1" (lib/progress.js KEY) -- the whole progress blob:
 *       completed, quizScores, flashDone, notes, bookmarks, highlights,
 *       xp, streak, lastDay, daily, achievements, tools.coverLetter
 *   - "coop_ai_v1" (lib/ai/config.js KEY) -- apiKey, endpoint, model,
 *       presetId. apiKey is intentionally DROPPED: key material never
 *       enters this store (see lib/endpoints/, owned by another agent).
 *   - "coop_theme" (components/Dashboard.js, app/layout.js) -- a plain
 *       theme string, e.g. "daylight".
 *
 * Forward-only, idempotent: an all-null/empty snapshot returns
 * defaultDocument(); running migrateDocument() again on the result is a
 * no-op because it is already at CURRENT_SCHEMA_VERSION.
 */
export function migrateLegacyLocalStorage(snapshot = {}) {
  const legacyProgress = safeParseJSON(snapshot["coop_prep_v1"], null);
  const legacyAI = safeParseJSON(snapshot["coop_ai_v1"], null);
  const legacyTheme = typeof snapshot["coop_theme"] === "string" && snapshot["coop_theme"]
    ? snapshot["coop_theme"]
    : null;

  const doc = defaultDocument();
  const log = [];

  if (legacyProgress && typeof legacyProgress === "object") {
    const base = defaultProgress();
    doc.progress = {
      ...base,
      completed: legacyProgress.completed || {},
      quizScores: legacyProgress.quizScores || {},
      flashDone: legacyProgress.flashDone || {},
      xp: typeof legacyProgress.xp === "number" ? legacyProgress.xp : base.xp,
      streak: typeof legacyProgress.streak === "number" ? legacyProgress.streak : base.streak,
      lastDay: legacyProgress.lastDay ?? base.lastDay,
      daily: legacyProgress.daily || base.daily,
      achievements: legacyProgress.achievements || {},
    };
    log.push("progress: migrated from coop_prep_v1");

    // notes: lessonId -> string  =>  id -> { id, lessonId, body, createdAt, updatedAt }
    const notesIn = legacyProgress.notes || {};
    let noteCount = 0;
    for (const [lessonId, body] of Object.entries(notesIn)) {
      if (!body) continue;
      const id = `legacy:note:${lessonId}`;
      doc.notes[id] = { id, lessonId, body, createdAt: null, updatedAt: null };
      noteCount += 1;
    }
    if (noteCount) log.push(`notes: migrated ${noteCount} note(s)`);

    // bookmarks: lessonId -> true  =>  lessonId -> { lessonId, createdAt }
    const bookmarksIn = legacyProgress.bookmarks || {};
    let bookmarkCount = 0;
    for (const [lessonId, on] of Object.entries(bookmarksIn)) {
      if (!on) continue;
      doc.bookmarks[lessonId] = { lessonId, createdAt: null };
      bookmarkCount += 1;
    }
    if (bookmarkCount) log.push(`bookmarks: migrated ${bookmarkCount} bookmark(s)`);

    // highlights: lessonId -> string[]  =>  id -> { id, lessonId, text, color, createdAt }
    const highlightsIn = legacyProgress.highlights || {};
    let highlightCount = 0;
    for (const [lessonId, snippets] of Object.entries(highlightsIn)) {
      (snippets || []).forEach((text, i) => {
        const id = `legacy:highlight:${lessonId}:${i}`;
        doc.highlights[id] = { id, lessonId, text, color: "yellow", createdAt: null };
        highlightCount += 1;
      });
    }
    if (highlightCount) log.push(`highlights: migrated ${highlightCount} highlight(s)`);

    // tools: previously nested at progress.tools.<toolId>, one opaque blob
    // per tool with no concept of multiple documents -- lands as docId "default".
    const toolsIn = legacyProgress.tools || {};
    const toolIds = Object.keys(toolsIn);
    for (const toolId of toolIds) {
      doc.tools[toolId] = { default: toolsIn[toolId] };
    }
    if (toolIds.length) log.push(`tools: migrated state for ${toolIds.join(", ")}`);
  } else {
    log.push("progress: no coop_prep_v1 payload found, using defaults");
  }

  const settings = defaultSettings();
  if (legacyAI && typeof legacyAI === "object") {
    const { apiKey, ...rest } = legacyAI;
    settings.ai = { ...settings.ai, ...rest };
    log.push("settings.ai: migrated from coop_ai_v1 (apiKey intentionally dropped)");
  }
  if (legacyTheme) {
    settings.theme = legacyTheme;
    log.push(`settings.theme: migrated from coop_theme ("${legacyTheme}")`);
  }
  doc.settings = settings;

  doc.migrationLog = log;
  return doc;
}

// ---------------------------------------------------------------------------
// Forward-only schemaVersion upgrade chain, for the *document itself* once
// it already lives in the new store (as opposed to the one-shot legacy
// import above). Add an entry keyed by the version being upgraded FROM
// whenever CURRENT_SCHEMA_VERSION is bumped.
// ---------------------------------------------------------------------------

const UPGRADES = {
  // Example for the next bump:
  // 1: (doc) => ({ ...doc, schemaVersion: 2, /* ... */ }),
};

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Is this plausibly one of OUR documents? Either it carries a numeric
 * schemaVersion (everything this store writes does), or -- for a
 * hand-edited file whose schemaVersion was dropped -- it still has at
 * least two recognisable slices. Anything else is some other app's JSON,
 * and accepting it would silently overwrite the user's real data.
 */
function looksLikeOurDocument(doc) {
  if (typeof doc.schemaVersion === "number") return true;
  const known = SLICE_NAMES.filter((name) => isPlainObject(doc[name]));
  return known.length >= 2;
}

/** A recognised slice that is present must be an object; a string/number/array is corrupt, not ours. */
function assertSliceShapes(doc) {
  for (const name of SLICE_NAMES) {
    const slice = doc[name];
    if (slice === undefined || slice === null) continue; // absent -> backfilled below
    if (!isPlainObject(slice)) {
      throw new Error(
        `coop-prep store: document slice "${name}" is a ${Array.isArray(slice) ? "array" : typeof slice}, ` +
          `expected an object. Refusing to load this file -- it is corrupt or not a coop-prep document.`
      );
    }
  }
}

/** Fill in slices a truncated/hand-edited document is missing, so get(slice) is never undefined. */
function backfillSlices(doc) {
  const defaults = defaultDocument();
  const out = { ...doc };
  for (const name of SLICE_NAMES) {
    if (!isPlainObject(out[name])) out[name] = defaults[name];
  }
  return out;
}

/**
 * migrateDocument(doc) -> document at CURRENT_SCHEMA_VERSION
 *
 * Forward-only and idempotent: a document already at CURRENT_SCHEMA_VERSION
 * keeps all of its data (including any unrecognised extra keys, which are
 * preserved rather than dropped). A missing schemaVersion is treated as 1
 * (the first versioned shape this store ever wrote). A version newer than
 * this build knows about is a hard, loud failure -- never silently dropped
 * or reset.
 *
 * Also validates structure: a JSON file that is not plausibly one of ours
 * is REJECTED rather than accepted-and-stamped, because the caller
 * (importDocument -> setDocument) would otherwise autosave that garbage
 * over the user's real saved data. Missing slices on a genuine but
 * truncated document are backfilled from the defaults.
 *
 * Throws on: a foreign/unrecognisable payload, a corrupt slice, or a
 * future schemaVersion. Returns defaultDocument() only for null/undefined
 * ("nothing saved yet").
 */
export function migrateDocument(doc) {
  if (doc === null || doc === undefined) return defaultDocument();
  if (!isPlainObject(doc) || !looksLikeOurDocument(doc)) {
    throw new Error(
      `coop-prep store: this does not look like a coop-prep document (no schemaVersion and no ` +
        `recognisable slices -- expected some of: ${SLICE_NAMES.join(", ")}). Refusing to load it, ` +
        `because importing it would overwrite your saved data.`
    );
  }
  assertSliceShapes(doc);

  let version = typeof doc.schemaVersion === "number" ? doc.schemaVersion : 1;
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `coop-prep store: document schema version ${version} is newer than this build ` +
        `supports (max ${CURRENT_SCHEMA_VERSION}). Refusing to load -- upgrade the app ` +
        `instead of risking silent data loss.`
    );
  }

  let working = { ...doc, schemaVersion: version };
  while (working.schemaVersion < CURRENT_SCHEMA_VERSION) {
    const step = UPGRADES[working.schemaVersion];
    if (!step) {
      throw new Error(`coop-prep store: no migration path defined from schema version ${working.schemaVersion}`);
    }
    working = step(working);
  }
  return backfillSlices(working);
}

export { CURRENT_SCHEMA_VERSION };
