// components/dashboard-scope.js
// The single place that decides WHICH module set each Dashboard number counts.
//
// WHY THIS FILE EXISTS: Dashboard.js carries JSX, which `node --test` cannot
// parse (node has no JSX loader). Same reasoning as
// components/settings/endpoints-ui.js — the decisions worth asserting on live
// in a JSX-free module the test runner can import directly.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE SCOPE DECISION (read this before changing any caller)
//
// The app has two module sets and they are NOT interchangeable:
//
//   CORE_MODULES  — data/curriculum.js, 7 modules / 21 lessons. The COOP
//                   Financial Services Fellowship curriculum. Ends in the
//                   `capstone` module, by construction.
//   NAV_MODULES   — data/registry.js ALL_MODULES, 31 modules / 105 lessons:
//                   core + heart + hustle + the SIE / Series 65 / CFI licensing
//                   tracks, plus any accepted AI-generated lessons merged in.
//
// Phase 2 made all 105 navigable but left every progress computation reading
// core, so 84 lessons counted toward nothing (Finding 10). The fix is NOT
// "swap the constant everywhere" — the two sets answer different questions:
//
//   "How much of this app have I done?"        -> NAV_MODULES.  overallProgress()
//     The sidebar bar and the "Lessons done" stat claim to describe the whole
//     app. If a completed SIE track does not move them, they are lying.
//
//   "Am I ready for the fellowship?"           -> CORE_MODULES. readinessScore()
//     Deliberately core-only, and it stays that way. Finishing the Series 65
//     track is a fine thing to do; it is not evidence of fellowship readiness,
//     and letting 84 optional lessons dilute the ring would make a fully
//     prepared candidate read as ~20% ready. Callers must pass CORE_MODULES by
//     that name so the scoping is visible at the call site.
//
//   "What should I do next?"                   -> BOTH.        nextLesson()
//     Core first (the fellowship has a date on it), then everything else — so
//     finishing core stops claiming the app is complete while 84 lessons wait.
//
//   "How is the core curriculum going?"        -> CORE_MODULES. coreModuleSummary()
//     Home's Modules grid renders the core track; its header counts the core
//     track. The sidebar already navigates every other track by pillar.
//
// NOT FIXED HERE (out of this unit's scope, lib/ is owned elsewhere):
// lib/coop-lib.js's buildRewardAndFinal() hardcodes `evaluateAchievements(after,
// MODULES)` against core. "Module Master" therefore still cannot fire on a
// licensing module. Note this is genuinely NOT a constant swap either:
// lib/momentum.js resolves the capstone as `modules[modules.length - 1]`, and
// ALL_MODULES ends in `cfi-sensitivity`, so passing it would silently retarget
// the "Fellowship Ready" achievement onto a CFI module. Fixing it needs an
// explicit capstone id, in a file this unit does not own.
// ─────────────────────────────────────────────────────────────────────────────
//
// Pure module: no DOM, no fs, no network. Importable under `node --test`.
// (The persistence section below talks to storage only through an injected
// bridge — the module itself still touches nothing.)

import { createStore } from "../lib/store/store.js";
import { createIPCBackend } from "../lib/store/backends.js";
import { migrateLegacyLocalStorage } from "../lib/store/migrate.js";
import { defaultDocument } from "../lib/store/schema.js";
import { defaultState } from "../lib/progress.js";
import { planSession, isRecallable } from "../lib/games/generators.js";
import { dueCardIds } from "../lib/games/srs.js";
import { listExams, getExam } from "../lib/exam/banks.js";

/**
 * @typedef {object} Lesson
 * @property {string} id
 */

/**
 * @typedef {object} Module
 * @property {string} id
 * @property {ReadonlyArray<Lesson>} lessons
 */

/**
 * @typedef {object} ProgressDoc
 * @property {Object<string, boolean>} completed
 */

/** @type {(modules: ReadonlyArray<Module>) => ReadonlyArray<Lesson>} */
const lessonsOf = (modules) => (modules ?? []).flatMap((m) => m?.lessons ?? []);

/** A module counts as finished only if it HAS lessons and all of them are done. */
const isModuleComplete = (mod, completed) =>
  (mod?.lessons?.length ?? 0) > 0 && mod.lessons.every((l) => completed[l.id]);

/**
 * Overall completion across every lesson the user can actually navigate to.
 *
 * Pass NAV_MODULES. Passing core here is the Finding 10 defect: it pinned the
 * sidebar bar to 0/21 no matter how much of the other 84 lessons a user did.
 *
 * @param {ProgressDoc} progress
 * @param {ReadonlyArray<Module>} navModules - Every navigable module.
 * @returns {{ done: number, total: number, pct: number }} pct is 0 when total is 0.
 */
export function overallProgress(progress, navModules) {
  const completed = progress?.completed ?? {};
  const lessons = lessonsOf(navModules);
  const total = lessons.length;
  const done = lessons.filter((l) => completed[l.id]).length;
  return { done, total, pct: total === 0 ? 0 : (done / total) * 100 };
}

/**
 * The Home "Continue" suggestion: the first incomplete lesson, core curriculum
 * first, then anything else navigable.
 *
 * The core-first preference is the point. The fellowship has a deadline; the
 * licensing tracks do not. But once core is done we suggest the remaining 84
 * rather than returning null and letting Home announce that the app is finished.
 *
 * @param {ProgressDoc} progress
 * @param {ReadonlyArray<Module>} coreModules - CORE_MODULES, preferred.
 * @param {ReadonlyArray<Module>} navModules - Every navigable module, the fallback.
 * @returns {{ mod: Module, l: Lesson }|null} null only when all 105 are done.
 */
export function nextLesson(progress, coreModules, navModules) {
  const completed = progress?.completed ?? {};
  const seen = new Set();
  // Core first, then the rest; the Set keeps core's modules from being
  // re-scanned when navModules contains them (it does).
  for (const mod of [...(coreModules ?? []), ...(navModules ?? [])]) {
    if (!mod || seen.has(mod)) continue;
    seen.add(mod);
    for (const l of mod.lessons ?? []) {
      if (!completed[l.id]) return { mod, l };
    }
  }
  return null;
}

/**
 * Home's Modules-grid header. Core curriculum only, deliberately — it summarises
 * the grid rendered directly beneath it, which is the core track.
 *
 * @param {ProgressDoc} progress
 * @param {ReadonlyArray<Module>} coreModules - CORE_MODULES.
 * @returns {{ complete: number, total: number }}
 */
export function coreModuleSummary(progress, coreModules) {
  const completed = progress?.completed ?? {};
  const mods = coreModules ?? [];
  return {
    complete: mods.filter((m) => isModuleComplete(m, completed)).length,
    total: mods.length,
  };
}

/* ═════════════════════════════════════════════════════════════════════════
   PERSISTENCE WIRING (Finding 4)

   lib/store/ shipped complete — schema, migrations, atomic file writes,
   debounced autosave, export/import — and had NO renderer caller. Dashboard
   saved through lib/progress.js's localStorage.setItem inside a catch {},
   so in the packaged Electron app everything a learner did lived only in
   Chromium's per-profile leveldb for the file:// origin: userData/store.json
   was never written, and a profile reset wiped it all silently.

   This section is the missing caller. It stays here (not in Dashboard.js)
   for the same reason the scope decision does: Dashboard carries JSX and
   node --test cannot import it, and persistence is exactly the kind of
   decision that must be assertable by execution, not by eye.

   SHAPE DECISION — the runtime blob vs. the store document:
   Dashboard's in-memory `progress` keeps the legacy flat shape (notes as
   lessonId -> string, bookmarks as lessonId -> true, ...). The store
   document (lib/store/schema.js) promotes those to richer top-level slices.
   Rewriting the 80KB Dashboard around the document shape would be the
   opposite of surgical, so this file owns a lossless encode/decode pair:
     - progress slice  = the runtime blob minus notes/bookmarks/highlights/
                         tools/aiNotes. The SRS deck rides inside it — that is
                         the documented contract in lib/games/srs.js ("drops
                         straight into the store's progress slice").
     - notes/bookmarks/highlights/tools = re-encoded into the schema shapes
                         (same mapping migrate.js established), timestamps
                         preserved from the previous document when a record
                         round-trips unchanged.
     - aiNotes         = an extra top-level slice. migrateDocument()
                         explicitly preserves unrecognised keys; the AI note
                         records postdate schema v1 and must not be lost.
   ═════════════════════════════════════════════════════════════════════════ */

const isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Encode the Dashboard runtime progress blob into a lib/store document.
 * Lossless with decodeProgressDocument (see test/persistence-wiring.test.js).
 *
 * @param {object} runtime the legacy-shaped blob Dashboard holds in state
 * @param {object|null} [prevDoc] the store's current document, when one exists
 *   — settings, timestamps, migrationLog and unknown extra keys carry over.
 * @returns {object} a document migrateDocument() accepts
 */
export function encodeProgressDocument(runtime, prevDoc = null) {
  const prev = isPlainObject(prevDoc) ? prevDoc : defaultDocument();
  const {
    notes = {},
    bookmarks = {},
    highlights = {},
    tools = {},
    aiNotes = {},
    ...progressSlice
  } = runtime ?? {};

  // notes: lessonId -> string  =>  id -> { id, lessonId, body, ... }
  const noteRecords = {};
  const prevNotes = new Map(
    Object.values(prev.notes ?? {}).filter(isPlainObject).map((r) => [r.lessonId, r]),
  );
  for (const [lessonId, body] of Object.entries(notes)) {
    if (!body) continue;
    const old = prevNotes.get(lessonId);
    const id = old?.id ?? `note:${lessonId}`;
    noteRecords[id] = {
      id,
      lessonId,
      body,
      createdAt: old?.createdAt ?? null,
      updatedAt: old?.body === body ? old?.updatedAt ?? null : null,
    };
  }

  // bookmarks: lessonId -> true  =>  lessonId -> { lessonId, createdAt }
  const bookmarkRecords = {};
  for (const [lessonId, on] of Object.entries(bookmarks)) {
    if (!on) continue;
    bookmarkRecords[lessonId] = { lessonId, createdAt: prev.bookmarks?.[lessonId]?.createdAt ?? null };
  }

  // highlights: lessonId -> string[]  =>  id -> { id, lessonId, text, color, createdAt }
  const highlightRecords = {};
  const prevHighlights = Object.values(prev.highlights ?? {}).filter(isPlainObject);
  for (const [lessonId, snippets] of Object.entries(highlights)) {
    (snippets ?? []).forEach((text, i) => {
      const old = prevHighlights.find((r) => r.lessonId === lessonId && r.text === text);
      const id = `hl:${lessonId}:${i}`;
      highlightRecords[id] = { id, lessonId, text, color: old?.color ?? "yellow", createdAt: old?.createdAt ?? null };
    });
  }

  // tools: toolId -> blob  =>  toolId -> { ...otherDocIds, default: blob }
  const toolRecords = {};
  for (const [toolId, blob] of Object.entries(tools)) {
    const old = isPlainObject(prev.tools?.[toolId]) ? prev.tools[toolId] : {};
    toolRecords[toolId] = { ...old, default: blob };
  }

  return {
    ...prev, // settings, migrationLog, unknown extras
    schemaVersion: typeof prev.schemaVersion === "number" ? prev.schemaVersion : defaultDocument().schemaVersion,
    progress: progressSlice,
    notes: noteRecords,
    highlights: highlightRecords,
    bookmarks: bookmarkRecords,
    tools: toolRecords,
    aiNotes: isPlainObject(aiNotes) ? aiNotes : {},
  };
}

/**
 * Decode a lib/store document back into the runtime blob Dashboard holds in
 * state. Inverse of encodeProgressDocument.
 * @param {object} doc
 * @returns {object} legacy-shaped progress blob, defaults backfilled
 */
export function decodeProgressDocument(doc) {
  const d = isPlainObject(doc) ? doc : {};
  const base = defaultState();
  const progress = isPlainObject(d.progress) ? d.progress : {};

  const notes = {};
  for (const rec of Object.values(d.notes ?? {})) {
    if (isPlainObject(rec) && rec.lessonId && typeof rec.body === "string" && rec.body) {
      notes[rec.lessonId] = rec.body;
    }
  }

  const bookmarks = {};
  for (const lessonId of Object.keys(d.bookmarks ?? {})) bookmarks[lessonId] = true;

  const highlights = {};
  for (const rec of Object.values(d.highlights ?? {})) {
    if (!isPlainObject(rec) || !rec.lessonId || typeof rec.text !== "string") continue;
    (highlights[rec.lessonId] ??= []).push(rec.text);
  }

  const tools = {};
  for (const [toolId, entry] of Object.entries(d.tools ?? {})) {
    tools[toolId] = isPlainObject(entry) && "default" in entry ? entry.default : entry;
  }

  return {
    ...base,
    ...progress,
    notes,
    bookmarks,
    highlights,
    tools: { ...base.tools, ...tools },
    aiNotes: isPlainObject(d.aiNotes) ? d.aiNotes : {},
  };
}

/** Legacy runtime keys migrate.js already maps into document slices. */
const LEGACY_KEYS_MIGRATED = new Set([
  "completed", "quizScores", "flashDone", "notes", "bookmarks",
  "highlights", "xp", "streak", "lastDay", "daily", "achievements", "tools",
]);

/**
 * migrateLegacyLocalStorage() predates two runtime keys and would silently
 * drop them: the SRS deck (`srs`, which belongs in the progress slice per
 * lib/games/srs.js) and the AI note records (`aiNotes`, an extra slice).
 * Carry them — and any future unhandled runtime key — across the migration.
 */
function carryPostMigrationKeys(doc, snapshot) {
  let legacy = null;
  try {
    legacy = JSON.parse(snapshot?.["coop_prep_v1"]);
  } catch {
    legacy = null;
  }
  if (!isPlainObject(legacy)) return doc;
  const progress = { ...doc.progress };
  let aiNotes;
  for (const [key, value] of Object.entries(legacy)) {
    if (LEGACY_KEYS_MIGRATED.has(key)) continue;
    if (key === "aiNotes") {
      aiNotes = value;
      continue;
    }
    progress[key] = value; // the srs deck, and anything newer than this list
  }
  const next = { ...doc, progress };
  if (isPlainObject(aiNotes)) next.aiNotes = aiNotes;
  return next;
}

/**
 * Open the desktop store over the preload bridge (window.coop.store), running
 * the one-time legacy localStorage import when the store file does not exist
 * yet. Returns null when there is no bridge (the plain web build), so the
 * caller can keep the localStorage path. Rejects — deliberately, loudly — when
 * the saved document cannot be loaded (corrupt slice, future schemaVersion):
 * the caller must fall back WITHOUT writing over the file.
 *
 * @param {{
 *   bridge?: { read: () => Promise<string|null>, write: (text: string) => Promise<void> },
 *   snapshot?: Object<string, string|null>, raw legacy localStorage values
 *     (coop_prep_v1 / coop_ai_v1 / coop_theme), exactly as getItem returns them
 *   debounceMs?: number,
 *   onError?: (err: Error) => void, forwarded to createStore (autosave failures)
 * }} [opts]
 * @returns {Promise<{store: object, progress: object, migrated: boolean}|null>}
 */
export async function openProgressStore({ bridge, snapshot = {}, debounceMs, onError } = {}) {
  if (!bridge || typeof bridge.read !== "function" || typeof bridge.write !== "function") return null;
  const backend = createIPCBackend({ read: bridge.read, write: bridge.write });
  const store = createStore({
    backend,
    ...(debounceMs !== undefined ? { debounceMs } : {}),
    ...(onError ? { onError } : {}),
  });

  const raw = await backend.read();
  if (raw === null || raw === undefined || raw === "") {
    // First desktop launch: import the legacy localStorage keys so nobody
    // loses the progress they made before the store existed, then flush
    // immediately — a migration that only lives in memory has not happened.
    const doc = carryPostMigrationKeys(migrateLegacyLocalStorage(snapshot), snapshot);
    store.setDocument(doc);
    await store.flush();
    return { store, progress: decodeProgressDocument(store.get()), migrated: true };
  }

  const doc = await store.load(); // throws on corrupt/future documents — see JSDoc
  return { store, progress: decodeProgressDocument(doc), migrated: false };
}

/* ═════════════════════════════════════════════════════════════════════════
   PRACTICE SESSION PLANNING (Finding 3)

   The SRS deck (progress.srs) was written by the games' onGrade and by
   ExamSimTool's onSrsReview — and read by nothing. planSession, the only
   reader, had no caller outside test/. So the "missed questions come back
   tomorrow" promise ExamResults makes was never kept: the games sampled
   uniformly from a core-only pool forever.

   This section closes the read side. GamesTool calls buildPracticeSession
   with the live deck at game launch and serves the returned per-game pools.

   NAMESPACE DECISION (Finding 3a): exam cards are keyed by bank item id
   ("sieb-cm-01"), game concepts by "quiz:<lessonId>:<i>" / "card:<slug>".
   They coexist in ONE deck (the ids never collide — lib/exam/review.js
   already relies on that) and in one session: examBankConcepts() lifts every
   registered multiple-choice bank item into the same concept shape
   extractConcepts produces, so a due exam miss is served verbatim — question,
   authored options and per-option explanations intact. Exam concepts are
   REVIEW-ONLY: they are served when their card is due, but never introduced
   as new material by the games. Sitting the exam is how they enter the deck.

   SCOPE DECISION (Finding 3b): the concept pool follows the NAV answer above
   — practice describes the whole app, like overallProgress(), not fellowship
   readiness. Dashboard builds GAME_CONCEPTS/GAME_FORMULAS from ALL_MODULES
   plus the full flashcard DECK (core + heart + hustle), so the 84 non-core
   lessons finally feed practice. (Accepted AI-generated lessons stay out of
   the module-level pool: they are per-user state, and the pool is built once
   at module load, deliberately — extractFormulas regex-scans every lesson.)
   ═════════════════════════════════════════════════════════════════════════ */

/** Per-game round sizes; each matches the game component's default. */
export const PRACTICE_COUNTS = { recall: 8, match: 6, rapid: 10 };

/** How many unseen curriculum concepts a session may introduce (SRS pacing). */
const NEW_PER_SESSION = 5;

/** RapidFire draws a card item's distractors from OTHER cards in the pool it
 *  is handed (3 needed per item) — any card in the rapid pool needs peers. */
const MIN_RAPID_CARDS = 4;

/** Mirrors generateMatchGame's tile-eligibility filter (lib/games/generators.js). */
function matchEligible(c) {
  const left = String(c.answer ?? "");
  const right = String(c.kind === "card" ? c.def : c.prompt ?? "");
  return left.length > 0 && left.length <= 48 && right.length > 0 && right.length <= 220;
}

/** Quiz items carry their own authored options; cards need pool-mates. */
function rapidEligible(c) {
  return c.kind === "quiz" ? (c.options?.length ?? 0) > 0 : c.kind === "card";
}

/** Fisher–Yates with an injectable rng, non-mutating. */
function shuffleWith(rng, arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Lift every registered multiple-choice exam bank item into the concept shape
 * the games consume (see extractConcepts in lib/games/generators.js). Ids are
 * the bank item ids — the exact keys ExamSimTool's onSrsReview writes into the
 * deck — which is what lets an exam miss be served by a game at all.
 *
 * Call at runtime, after data/registry.js has registered the question banks
 * (any import of the registry does; Dashboard's does). lib/exam/ seeds both SIE
 * and Series 65 empty, so called before that this honestly returns nothing.
 * @returns {object[]} concepts
 */
export function examBankConcepts() {
  const out = [];
  for (const { certId, name, kind } of listExams()) {
    if (kind !== "multiple-choice") continue;
    const { bank } = getExam(certId);
    for (const item of bank ?? []) {
      const options = item.options ?? [];
      out.push({
        id: item.id,
        kind: "quiz",
        moduleId: null,
        lessonId: null,
        lessonTitle: `${name} question bank`,
        prompt: item.q,
        answer: item.a,
        explanation: item.explanation ?? "",
        options,
        distractors: options.filter((o) => o.text !== item.a),
      });
    }
  }
  return out;
}

/**
 * Plan today's practice: everything due from the deck first (exam misses
 * included), routed to the game that matches its strength (planSession's
 * expanding-retrieval ladder), then a paced handful of unseen curriculum
 * concepts, then random filler so every round is still full for a new user.
 *
 * The pools are sized to the games' round lengths ON PURPOSE: the game
 * components sample uniformly from whatever pool they receive, so priority
 * can only be expressed by handing them a pool that IS the session. GamesTool
 * passes count/pairs = pool length, so every due item is guaranteed a seat.
 *
 * @param {{
 *   concepts: object[], the curriculum pool (Dashboard's GAME_CONCEPTS)
 *   examConcepts?: object[], from examBankConcepts() — review-only
 *   deck?: Object<string, object>, progress.srs
 *   now?: Date|number|string,
 *   counts?: {recall: number, match: number, rapid: number},
 *   rng?: () => number, injectable for tests
 * }} opts
 * @returns {{pools: {recall: object[], match: object[], rapid: object[]}, queuedIds: string[], dueCount: number}}
 */
export function buildPracticeSession({
  concepts,
  examConcepts = [],
  deck = {},
  now = Date.now(),
  counts = PRACTICE_COUNTS,
  rng = Math.random,
} = {}) {
  const curriculum = concepts ?? [];
  const examIds = new Set(examConcepts.map((c) => c.id));
  const byId = new Map([...curriculum, ...examConcepts].map((c) => [c.id, c]));

  // Curriculum first in the combined list: buildQueue introduces "new"
  // concepts in list order, so unseen curriculum always outranks exam items —
  // and the review-only filter below makes the exclusion absolute.
  const { plan } = planSession([...curriculum, ...examConcepts], deck, {
    now,
    limit: counts.recall + counts.match + counts.rapid,
    newPerSession: NEW_PER_SESSION,
  });
  const queue = plan.filter((p) => !(p.isNew && examIds.has(p.conceptId)));

  const pools = { recall: [], match: [], rapid: [] };
  const used = new Set();
  const put = (game, concept) => {
    if (!concept || used.has(concept.id)) return;
    pools[game].push(concept);
    used.add(concept.id);
  };

  // 1. Seat the queue — due items (most overdue first) and paced new ones —
  //    in the game planSession routed each to. A pool that fills caps; the
  //    unseated stay due and lead tomorrow's queue, which is the correct SRS
  //    backlog behaviour (and a fresh session is planned per game launch).
  const GAME_POOL = { recall: "recall", match: "match", rapidFire: "rapid" };
  for (const p of queue) {
    const game = GAME_POOL[p.game] ?? "rapid";
    if (pools[game].length < counts[game]) put(game, byId.get(p.conceptId));
  }

  // 2. Fill each pool to its round size with eligible curriculum filler, in
  //    random order — the new-user experience stays a full, varied round.
  const filler = shuffleWith(rng, curriculum.filter((c) => !used.has(c.id)));
  const fill = (game, eligible) => {
    for (const c of filler) {
      if (pools[game].length >= counts[game]) break;
      if (used.has(c.id) || !eligible(c)) continue;
      put(game, c);
    }
  };
  fill("recall", isRecallable);
  fill("match", matchEligible);
  fill("rapid", rapidEligible);

  // 3. Card fodder: a card concept in the rapid pool needs >= 3 card peers
  //    there for its distractors, or generateRapidFire silently drops it.
  if (pools.rapid.some((c) => c.kind === "card")) {
    let cards = pools.rapid.filter((c) => c.kind === "card").length;
    for (const c of filler) {
      if (cards >= MIN_RAPID_CARDS) break;
      if (c.kind !== "card" || used.has(c.id)) continue;
      put("rapid", c);
      cards += 1;
    }
  }

  return {
    pools,
    queuedIds: queue.map((p) => p.conceptId),
    dueCount: dueCardIds(deck, { now }).filter((id) => byId.has(id)).length,
  };
}
