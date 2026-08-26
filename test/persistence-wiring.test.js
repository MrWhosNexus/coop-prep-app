/**
 * test/persistence-wiring.test.js
 *
 * Finding 4: the ENTIRE lib/store persistence layer — schema, migrate, atomic
 * writes, debounced autosave, export/import — had no renderer caller. Dashboard
 * saved through lib.saveProgress -> localStorage.setItem inside a `catch {}`,
 * so in the packaged desktop app every XP, streak, note, highlight, bookmark,
 * SRS card and in-flight 3-hour mock lived ONLY in Chromium's per-profile
 * leveldb for the file:// origin. userData/store.json was never written, and a
 * profile reset wiped everything silently.
 *
 * Like test/exam-srs-loop.test.js, these tests assert the WIRING, not the
 * store's arithmetic (test/store.test.js owns that). The store passing its own
 * 31 unit tests is exactly how this gap survived five review passes.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { defaultState } from "../lib/progress.js";
import { CURRENT_SCHEMA_VERSION } from "../lib/store/schema.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dashboard = readFileSync(join(ROOT, "components/Dashboard.js"), "utf8");
const scope = readFileSync(join(ROOT, "components/dashboard-scope.js"), "utf8");

/** The new exports under test, loaded dynamically so that the source-text
 *  assertions below still RUN (and fail individually) while the exports are
 *  missing, instead of the whole file dying on a static import. */
async function scopeModule() {
  return import("../components/dashboard-scope.js");
}

/** A bridge with the exact contract electron/preload.js exposes at
 *  window.coop.store: read() -> Promise<string|null>, write(text). */
function memoryBridge(initial = null) {
  let value = initial;
  return {
    read: async () => value,
    write: async (text) => { value = text; },
    peek: () => value,
  };
}

/** A realistic legacy runtime blob — everything Dashboard actually stores. */
function richLegacyProgress() {
  return {
    ...defaultState(),
    completed: { "excel-basics": true, "sie-1-1": true },
    quizScores: { "excel-basics": { correct: 3, total: 3, lastAt: "2026-07-01T10:00:00.000Z" } },
    flashDone: { 0: true, 7: true },
    notes: { "excel-basics": "XLOOKUP replaces VLOOKUP" },
    bookmarks: { "sie-1-1": true },
    highlights: { "excel-basics": ["absolute reference", "fill handle"] },
    xp: 1240,
    streak: 6,
    lastDay: "2026-07-14",
    daily: { date: "2026-07-14", xp: 90, lessons: 1, minutes: 25 },
    achievements: { "first-lesson": "2026-06-20T09:00:00.000Z" },
    tools: {
      coverLetter: { fields: { company: "Deloitte" } },
      exam: { session: { id: "sit-1", certId: "sie", answers: { "sieb-cm-01": 2 } } },
      guided: { "xlookup-basics": { score: 0.9, completedAt: "2026-07-10T00:00:00.000Z" } },
    },
    srs: {
      "sieb-cm-01": {
        id: "sieb-cm-01", reps: 0, lapses: 1, ease: 2.18, intervalDays: 1,
        due: "2026-07-15", lastGrade: 0, lastReviewedAt: "2026-07-14T20:00:00.000Z",
        recent: [{ g: 0, at: "2026-07-14T20:00:00.000Z" }],
      },
    },
    aiNotes: { "n-1": { id: "n-1", body: "Fed funds vs discount rate", tags: ["econ"] } },
  };
}

function legacySnapshot(progressBlob) {
  return {
    coop_prep_v1: JSON.stringify(progressBlob),
    coop_ai_v1: JSON.stringify({ apiKey: "sk-should-never-survive", endpoint: "https://api.anthropic.com", model: "m", presetId: "anthropic" }),
    coop_theme: "midnight",
  };
}

describe("the store finally has a renderer caller (wiring)", () => {
  test("dashboard-scope builds the renderer store from lib/store", () => {
    assert.match(
      scope,
      /import\s*\{[^}]*createStore[^}]*\}\s*from\s*["']\.\.\/lib\/store\/store\.js["']/,
      "dashboard-scope.js must import createStore — before this fix NOTHING outside lib/store and its tests referenced it",
    );
    assert.match(
      scope,
      /createIPCBackend/,
      "dashboard-scope.js must build the renderer backend with createIPCBackend, the backend shipped for exactly this",
    );
    assert.match(
      scope,
      /migrateLegacyLocalStorage/,
      "the already-written legacy localStorage migration must actually run on first desktop launch",
    );
  });

  test("Dashboard opens the store over the preload bridge", () => {
    assert.match(
      dashboard,
      /import\s*\{[^}]*openProgressStore[^}]*\}\s*from\s*["']@\/components\/dashboard-scope["']/,
      "Dashboard must import the store bootstrap from dashboard-scope",
    );
    assert.match(
      dashboard,
      /openProgressStore\(\s*\{[\s\S]*?bridge:\s*window\.coop\?\.store/,
      "Dashboard must hand window.coop?.store to openProgressStore — the bridge preload.js has been exposing all along",
    );
  });

  test("every Dashboard write goes through one choke point that also feeds the store", () => {
    assert.match(dashboard, /function persistProgress\(/, "Dashboard must define persistProgress");
    // lib.saveProgress keeps the web (no-bridge) path alive, but it may be
    // called from persistProgress ONLY — the four scattered call sites are the
    // defect (localStorage-only persistence with the store never written).
    const direct = dashboard.match(/lib\.saveProgress\(/g) ?? [];
    assert.equal(
      direct.length,
      1,
      `lib.saveProgress must have exactly one call site (inside persistProgress); found ${direct.length}`,
    );
    assert.match(
      dashboard,
      /encodeProgressDocument\(/,
      "persistProgress must encode the runtime blob into the store document",
    );
  });

  test("the store is flushed when the app is backgrounded or closed", () => {
    assert.match(
      dashboard,
      /addEventListener\(\s*["']pagehide["']/,
      "Dashboard must flush the store on pagehide — the debounced autosave alone loses the last ~1s of work on quit",
    );
    assert.match(dashboard, /\.flush\(\)/, "the quit path must call store.flush()");
  });
});

describe("first desktop launch migrates the legacy localStorage data", () => {
  test("nothing saved yet: the legacy blob (including srs + aiNotes) lands in the store file", async () => {
    const { openProgressStore } = await scopeModule();
    const bridge = memoryBridge(null);
    const legacy = richLegacyProgress();

    const opened = await openProgressStore({ bridge, snapshot: legacySnapshot(legacy) });
    assert.ok(opened, "a working bridge must open a store");
    assert.equal(opened.migrated, true, "an empty backend + legacy keys is the migration case");

    // The runtime blob handed back to Dashboard keeps today's progress...
    assert.equal(opened.progress.xp, 1240);
    assert.equal(opened.progress.streak, 6);
    assert.deepEqual(opened.progress.completed, legacy.completed);
    assert.equal(opened.progress.notes["excel-basics"], "XLOOKUP replaces VLOOKUP");
    assert.deepEqual(opened.progress.highlights["excel-basics"], ["absolute reference", "fill handle"]);
    assert.deepEqual(opened.progress.bookmarks, { "sie-1-1": true });
    assert.deepEqual(opened.progress.tools.exam, legacy.tools.exam, "an in-flight mock exam session must survive migration");

    // ...including the two runtime keys that postdate migrate.js's mapping:
    assert.deepEqual(opened.progress.srs, legacy.srs, "the SRS deck must survive the move into the store");
    assert.deepEqual(opened.progress.aiNotes, legacy.aiNotes, "AI note records must survive the move into the store");

    // And the document was actually WRITTEN through the bridge (userData/store.json).
    const raw = bridge.peek();
    assert.ok(raw, "migration must flush the migrated document to the backend immediately");
    const doc = JSON.parse(raw);
    assert.equal(doc.schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.equal(doc.progress.xp, 1240);
    assert.ok(doc.progress.srs["sieb-cm-01"], "the deck lives in the progress slice (srs.js: 'drops straight into the store's progress slice')");
    assert.equal(doc.settings.theme, "midnight", "coop_theme migrates into settings");
    assert.ok(!JSON.stringify(doc).includes("sk-should-never-survive"), "the legacy apiKey must NEVER enter the store document");
  });

  test("second launch loads the saved document instead of re-migrating", async () => {
    const { openProgressStore } = await scopeModule();
    const bridge = memoryBridge(null);
    const legacy = richLegacyProgress();
    await openProgressStore({ bridge, snapshot: legacySnapshot(legacy) });

    // Fresh localStorage would now be empty/stale — the store must win.
    const second = await openProgressStore({ bridge, snapshot: {} });
    assert.equal(second.migrated, false);
    assert.equal(second.progress.xp, 1240);
    assert.deepEqual(second.progress.srs, legacy.srs);
    assert.equal(second.progress.notes["excel-basics"], "XLOOKUP replaces VLOOKUP");
  });

  test("no bridge (plain web build) opens nothing and breaks nothing", async () => {
    const { openProgressStore } = await scopeModule();
    assert.equal(await openProgressStore({ bridge: undefined }), null);
    assert.equal(await openProgressStore({}), null);
  });

  test("a future-schema document rejects loudly instead of silently resetting", async () => {
    const { openProgressStore } = await scopeModule();
    const bridge = memoryBridge(JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION + 99, progress: {}, settings: {} }));
    await assert.rejects(
      () => openProgressStore({ bridge, snapshot: {} }),
      /newer than this build/,
      "Dashboard catches this and falls back to localStorage without overwriting the file",
    );
    assert.match(bridge.peek(), /schemaVersion/, "the unreadable document must be left untouched");
  });
});

describe("runtime blob <-> store document round trip", () => {
  test("decode(encode(runtime)) preserves every slice Dashboard depends on", async () => {
    const { encodeProgressDocument, decodeProgressDocument } = await scopeModule();
    const runtime = richLegacyProgress();
    const doc = encodeProgressDocument(runtime);
    const back = decodeProgressDocument(doc);
    assert.deepEqual(back, runtime, "a full encode/decode cycle must be lossless");
  });

  test("the encoded document satisfies the store's own schema contract", async () => {
    const { encodeProgressDocument } = await scopeModule();
    const { migrateDocument } = await import("../lib/store/migrate.js");
    const doc = encodeProgressDocument(richLegacyProgress());
    // migrateDocument throws on anything it would refuse to load; the encoder
    // must produce documents the store will accept forever after.
    const migrated = migrateDocument(doc);
    assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.deepEqual(migrated.progress.srs, richLegacyProgress().srs);
  });

  test("a dispatched change reaches the backend through setDocument + flush", async () => {
    const { openProgressStore, encodeProgressDocument } = await scopeModule();
    const bridge = memoryBridge(null);
    const opened = await openProgressStore({ bridge, snapshot: legacySnapshot(richLegacyProgress()) });

    // What Dashboard's persistProgress does on every dispatch:
    const next = { ...opened.progress, xp: 9999, notes: { ...opened.progress.notes, "sie-1-1": "prospectus = 1933 act" } };
    opened.store.setDocument(encodeProgressDocument(next, opened.store.get()));
    await opened.store.flush();

    const doc = JSON.parse(bridge.peek());
    assert.equal(doc.progress.xp, 9999, "the change must land in the backend, not just in memory");
    const noteBodies = Object.values(doc.notes).map((n) => n.body);
    assert.ok(noteBodies.includes("prospectus = 1933 act"), "new notes must be encoded into the notes slice");
    assert.equal(opened.store.isDirty(), false, "flush must settle the document");
  });
});
