import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { CURRENT_SCHEMA_VERSION, defaultDocument } from "../lib/store/schema.js";
import { migrateLegacyLocalStorage, migrateDocument } from "../lib/store/migrate.js";
import { createStore } from "../lib/store/store.js";
import { createMemoryBackend, createFileBackend, createIPCBackend } from "../lib/store/backends.js";
import { exportDocument, importDocument } from "../lib/store/export.js";

// POSIX file modes are not enforceable on Windows: chmod only toggles the
// read-only bit and stat synthesises 0666/0777. Mode assertions are skipped
// there rather than deleted — they still run, and must pass, on POSIX.
const posixOnly =
  process.platform === "win32"
    ? { skip: "POSIX file modes: chmod/stat do not carry mode bits on win32" }
    : {};

// ---------------------------------------------------------------------------
// schema
// ---------------------------------------------------------------------------

describe("schema", () => {
  test("defaultDocument is at CURRENT_SCHEMA_VERSION and has every slice", () => {
    const doc = defaultDocument();
    assert.equal(doc.schemaVersion, CURRENT_SCHEMA_VERSION);
    for (const slice of ["progress", "notes", "highlights", "bookmarks", "tools", "settings"]) {
      assert.ok(slice in doc, `missing slice: ${slice}`);
    }
  });

  test("defaultSettings never carries an apiKey", () => {
    const doc = defaultDocument();
    assert.equal(doc.settings.ai.apiKey, undefined);
    assert.ok(!("apiKey" in doc.settings.ai));
  });

  test("two calls to defaultDocument return independent objects (no shared mutable state)", () => {
    const a = defaultDocument();
    const b = defaultDocument();
    a.progress.xp = 999;
    a.bookmarks.foo = { lessonId: "foo", createdAt: null };
    assert.equal(b.progress.xp, 0);
    assert.deepEqual(b.bookmarks, {});
  });
});

// ---------------------------------------------------------------------------
// migration: raw v0 localStorage -> v1 document
// ---------------------------------------------------------------------------

describe("migrateLegacyLocalStorage", () => {
  test("empty/absent snapshot yields defaultDocument()", () => {
    const doc = migrateLegacyLocalStorage({});
    const { migrationLog, ...rest } = doc;
    assert.deepEqual(rest, defaultDocument());
  });

  test("realistic v0 payload migrates progress, notes, bookmarks, highlights, tools losslessly", () => {
    const legacyProgress = {
      completed: { "excel-1": true, "stats-2": true },
      quizScores: { "excel-1": { correct: 4, total: 5, lastAt: "2026-07-01T00:00:00.000Z" } },
      flashDone: { 0: true, 3: true },
      notes: { "excel-1": "Remember VLOOKUP vs INDEX/MATCH" },
      bookmarks: { "stats-2": true },
      highlights: { "excel-1": ["absolute references use $", "F4 toggles anchor"] },
      xp: 420,
      streak: 5,
      lastDay: "2026-07-14",
      daily: { date: "2026-07-14", xp: 90, lessons: 2, minutes: 30 },
      achievements: { "first-lesson": "2026-06-01T00:00:00.000Z" },
      tools: { coverLetter: { fields: { name: "Ada" }, aiResponse: null, lastSaved: null, tokenWarning: false } },
    };
    const legacyAI = { apiKey: "sk-super-secret", endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-4o", presetId: "openai" };
    const snapshot = {
      coop_prep_v1: JSON.stringify(legacyProgress),
      coop_ai_v1: JSON.stringify(legacyAI),
      coop_theme: "midnight",
    };

    const doc = migrateLegacyLocalStorage(snapshot);

    assert.equal(doc.schemaVersion, CURRENT_SCHEMA_VERSION);

    // progress core fields carried over verbatim
    assert.deepEqual(doc.progress.completed, legacyProgress.completed);
    assert.deepEqual(doc.progress.quizScores, legacyProgress.quizScores);
    assert.deepEqual(doc.progress.flashDone, legacyProgress.flashDone);
    assert.equal(doc.progress.xp, 420);
    assert.equal(doc.progress.streak, 5);
    assert.equal(doc.progress.lastDay, "2026-07-14");
    assert.deepEqual(doc.progress.daily, legacyProgress.daily);
    assert.deepEqual(doc.progress.achievements, legacyProgress.achievements);

    // notes promoted to their own slice, keyed by id, lesson-linked
    const noteValues = Object.values(doc.notes);
    assert.equal(noteValues.length, 1);
    assert.equal(noteValues[0].lessonId, "excel-1");
    assert.equal(noteValues[0].body, "Remember VLOOKUP vs INDEX/MATCH");
    assert.ok(noteValues[0].id);

    // bookmarks promoted, still keyed by lessonId
    assert.ok(doc.bookmarks["stats-2"]);
    assert.equal(doc.bookmarks["stats-2"].lessonId, "stats-2");

    // highlights promoted, one entry per snippet, colour added
    const highlightValues = Object.values(doc.highlights).filter((h) => h.lessonId === "excel-1");
    assert.equal(highlightValues.length, 2);
    assert.ok(highlightValues.some((h) => h.text === "absolute references use $"));
    assert.ok(highlightValues.every((h) => h.color));

    // tools: coverLetter blob preserved verbatim under a docId
    assert.deepEqual(doc.tools.coverLetter.default, legacyProgress.tools.coverLetter);

    // settings: AI config migrated MINUS the api key; theme migrated
    assert.equal(doc.settings.ai.endpoint, legacyAI.endpoint);
    assert.equal(doc.settings.ai.model, legacyAI.model);
    assert.equal(doc.settings.ai.presetId, legacyAI.presetId);
    assert.equal(doc.settings.ai.apiKey, undefined);
    assert.ok(!("apiKey" in doc.settings.ai), "apiKey must never be migrated into the store");
    assert.equal(doc.settings.theme, "midnight");
  });

  test("corrupt / non-JSON localStorage values fall back to defaults instead of throwing", () => {
    const doc = migrateLegacyLocalStorage({
      coop_prep_v1: "{not json",
      coop_ai_v1: "also not json",
      coop_theme: "",
    });
    assert.deepEqual(doc.progress, defaultDocument().progress);
    assert.equal(doc.settings.theme, "daylight");
  });

  test("running migrateDocument on an already-migrated doc is idempotent", () => {
    const once = migrateLegacyLocalStorage({ coop_prep_v1: JSON.stringify({ xp: 10 }) });
    const twice = migrateDocument(once);
    assert.deepEqual(once, twice);
  });
});

// ---------------------------------------------------------------------------
// migrateDocument: forward-only chain + unknown-future rejection
// ---------------------------------------------------------------------------

describe("migrateDocument", () => {
  test("a bare object with no schemaVersion is treated as v1 (not reset to defaults)", () => {
    const bare = { ...defaultDocument() };
    delete bare.schemaVersion;
    bare.progress.xp = 77;
    const migrated = migrateDocument(bare);
    assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.equal(migrated.progress.xp, 77);
  });

  test("throws loudly on an unknown future schema version instead of silently dropping data", () => {
    const future = { ...defaultDocument(), schemaVersion: CURRENT_SCHEMA_VERSION + 99 };
    assert.throws(() => migrateDocument(future), /newer than this build supports/);
  });

  test("null/undefined document yields a fresh default rather than throwing", () => {
    assert.deepEqual(migrateDocument(null), defaultDocument());
    assert.deepEqual(migrateDocument(undefined), defaultDocument());
  });

  test("a foreign JSON object is rejected, not stamped with schemaVersion and accepted", () => {
    assert.throws(
      () => migrateDocument({ name: "some-app", version: "1.0.0" }),
      /does not look like a coop-prep document/
    );
  });

  test("a truncated document backfills every missing slice from the defaults", () => {
    const migrated = migrateDocument({ schemaVersion: CURRENT_SCHEMA_VERSION });
    assert.deepEqual(migrated, defaultDocument());
  });

  test("a partially truncated document keeps its real data and backfills the rest", () => {
    const migrated = migrateDocument({ schemaVersion: CURRENT_SCHEMA_VERSION, progress: { xp: 60 } });
    assert.equal(migrated.progress.xp, 60);
    assert.deepEqual(migrated.notes, {});
    assert.deepEqual(migrated.settings, defaultDocument().settings);
  });

  test("an unknown extra slice is preserved, never silently dropped", () => {
    const doc = { ...defaultDocument(), futureSlice: { keep: "me" } };
    const migrated = migrateDocument(doc);
    assert.deepEqual(migrated.futureSlice, { keep: "me" });
  });

  test("a known slice of the wrong type is rejected rather than loaded", () => {
    assert.throws(
      () => migrateDocument({ schemaVersion: CURRENT_SCHEMA_VERSION, progress: "not an object" }),
      /progress/
    );
  });

  test("a non-object JSON payload (array/string) is rejected, not defaulted", () => {
    assert.throws(() => migrateDocument([1, 2, 3]), /does not look like a coop-prep document/);
    assert.throws(() => migrateDocument("nope"), /does not look like a coop-prep document/);
  });
});

// ---------------------------------------------------------------------------
// store: load/get/set/subscribe/flush over the memory backend
// ---------------------------------------------------------------------------

describe("createStore (memory backend)", () => {
  test("load() with nothing saved yields defaultDocument()", async () => {
    const store = createStore({ backend: createMemoryBackend(null) });
    const doc = await store.load();
    assert.deepEqual(doc, defaultDocument());
  });

  test("get() before load() throws", () => {
    const store = createStore({ backend: createMemoryBackend(null) });
    assert.throws(() => store.get("progress"), /not loaded/);
  });

  test("set() updates a slice immutably and marks the store dirty", async () => {
    const store = createStore({ backend: createMemoryBackend(null) });
    await store.load();
    const before = store.get("progress");
    store.set("progress", (p) => ({ ...p, xp: p.xp + 50 }));
    const after = store.get("progress");
    assert.equal(after.xp, 50);
    assert.notEqual(before, after, "slice must be replaced, not mutated in place");
    assert.ok(store.isDirty());
  });

  test("set() also accepts a plain value (not just an updater function)", async () => {
    const store = createStore({ backend: createMemoryBackend(null) });
    await store.load();
    store.set("settings", { theme: "midnight", ai: { endpoint: "x", model: "y", presetId: "z" } });
    assert.equal(store.get("settings").theme, "midnight");
  });

  test("flush() writes immediately regardless of the debounce timer, and clears dirty", async () => {
    const backend = createMemoryBackend(null);
    const store = createStore({ backend, debounceMs: 999999 }); // would never fire on its own within a test
    await store.load();
    store.set("progress", (p) => ({ ...p, xp: 10 }));
    assert.equal(backend._peek(), null, "nothing written yet -- still debouncing");
    await store.flush();
    assert.ok(backend._peek(), "flush() should have written synchronously");
    assert.equal(JSON.parse(backend._peek()).progress.xp, 10);
    assert.equal(store.isDirty(), false);
  });

  test("flush() with nothing dirty is a safe no-op", async () => {
    const backend = createMemoryBackend(null);
    const store = createStore({ backend });
    await store.load();
    await store.flush();
    assert.equal(backend._peek(), null);
  });

  test("debounced autosave fires on its own after debounceMs", async () => {
    const backend = createMemoryBackend(null);
    const store = createStore({ backend, debounceMs: 20 });
    await store.load();
    store.set("progress", (p) => ({ ...p, xp: 5 }));
    assert.equal(backend._peek(), null);
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.ok(backend._peek());
    assert.equal(JSON.parse(backend._peek()).progress.xp, 5);
  });

  test("round-trip: save via one store, load fresh via a second store over the same backend", async () => {
    const backend = createMemoryBackend(null);
    const storeA = createStore({ backend });
    await storeA.load();
    storeA.set("bookmarks", { "excel-1": { lessonId: "excel-1", createdAt: "2026-07-15T00:00:00.000Z" } });
    storeA.set("notes", { n1: { id: "n1", lessonId: "excel-1", body: "hi", createdAt: null, updatedAt: null } });
    await storeA.flush();

    const storeB = createStore({ backend });
    const doc = await storeB.load();
    assert.deepEqual(doc.bookmarks, { "excel-1": { lessonId: "excel-1", createdAt: "2026-07-15T00:00:00.000Z" } });
    assert.deepEqual(doc.notes.n1.body, "hi");
  });

  test("subscribe() fires on load() and on every set(); unsubscribe stops further calls", async () => {
    const store = createStore({ backend: createMemoryBackend(null) });
    let calls = 0;
    const unsubscribe = store.subscribe(() => { calls += 1; });
    await store.load();
    assert.equal(calls, 1);
    store.set("progress", (p) => ({ ...p, xp: 1 }));
    assert.equal(calls, 2);
    unsubscribe();
    store.set("progress", (p) => ({ ...p, xp: 2 }));
    assert.equal(calls, 2, "listener must not fire after unsubscribe");
  });

  test("a corrupt (non-JSON) backend payload is treated as no-save-yet, not a crash", async () => {
    const backend = createMemoryBackend("{not valid json");
    const store = createStore({ backend });
    const doc = await store.load();
    assert.deepEqual(doc, defaultDocument());
  });

  test("load() rejects an unknown future schema version instead of silently resetting", async () => {
    const future = JSON.stringify({ ...defaultDocument(), schemaVersion: CURRENT_SCHEMA_VERSION + 5 });
    const backend = createMemoryBackend(future);
    const store = createStore({ backend });
    await assert.rejects(() => store.load(), /newer than this build supports/);
  });

  test("setDocument() replaces the whole document and re-migrates it", async () => {
    const store = createStore({ backend: createMemoryBackend(null) });
    await store.load();
    const legacy = migrateLegacyLocalStorage({ coop_prep_v1: JSON.stringify({ xp: 33 }) });
    store.setDocument(legacy);
    assert.equal(store.get("progress").xp, 33);
  });
});

// ---------------------------------------------------------------------------
// store: the write side -- a backend whose write() can actually FAIL.
// createMemoryBackend/createFileBackend both always succeed, which is exactly
// why the "unsaved data survives a failed write" path had zero coverage.
// ---------------------------------------------------------------------------

/**
 * createFailingBackend({ initial?, failWrites?, delayMs? }) -> backend
 * Test-only backend modelling a real write failure (ENOSPC, a read-only
 * app-data dir, EPERM on rename, an IPC channel torn down at quit).
 * Flip `backend.failWrites` to simulate a transient failure that recovers.
 */
function createFailingBackend({ initial = null, failWrites = true, delayMs = 0 } = {}) {
  let value = initial;
  let writeCount = 0;
  const backend = {
    failWrites,
    async read() {
      return value;
    },
    async write(text) {
      writeCount += 1;
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (backend.failWrites) {
        throw new Error("ENOSPC: no space left on device, write");
      }
      value = text;
    },
    _peek: () => value,
    _writeCount: () => writeCount,
  };
  return backend;
}

describe("createStore (write failures)", () => {
  test("flush() rejects and KEEPS the data dirty when the backend write fails", async () => {
    const backend = createFailingBackend();
    const store = createStore({ backend, debounceMs: 999999 });
    await store.load();
    store.set("progress", (p) => ({ ...p, xp: 100 }));

    await assert.rejects(() => store.flush(), /ENOSPC/, "flush() must surface the write failure");
    assert.equal(store.isDirty(), true, "unsaved data must still be dirty after a failed write");
    assert.equal(backend._peek(), null, "nothing was persisted");
  });

  test("a failed autosave is reported (never silently swallowed) and leaves the store dirty", async () => {
    const backend = createFailingBackend();
    const errors = [];
    const store = createStore({ backend, debounceMs: 20, onError: (err) => errors.push(err) });
    await store.load();
    store.set("progress", (p) => ({ ...p, xp: 7 }));

    await new Promise((resolve) => setTimeout(resolve, 60));

    assert.equal(errors.length, 1, "the autosave failure must reach the app via onError");
    assert.match(errors[0].message, /ENOSPC/);
    assert.equal(store.isDirty(), true, "a failed autosave must not mark the store clean");
  });

  test("a retry after a transient failure still persists the data (nothing was lost)", async () => {
    const backend = createFailingBackend();
    const store = createStore({ backend, debounceMs: 999999, onError: () => {} });
    await store.load();
    store.set("progress", (p) => ({ ...p, xp: 250 }));

    await assert.rejects(() => store.flush(), /ENOSPC/);

    backend.failWrites = false; // disk freed up / dir writable again
    await store.flush();

    assert.equal(store.isDirty(), false);
    assert.equal(JSON.parse(backend._peek()).progress.xp, 250, "the retry must persist the SAME unsaved data");
  });

  test("quit-path flush() after a failed autosave still writes the data", async () => {
    const backend = createFailingBackend();
    const errors = [];
    const store = createStore({ backend, debounceMs: 20, onError: (err) => errors.push(err) });
    await store.load();
    store.set("progress", (p) => ({ ...p, xp: 42 }));

    await new Promise((resolve) => setTimeout(resolve, 60)); // autosave fires and fails
    assert.equal(errors.length, 1);

    backend.failWrites = false;
    await store.flush(); // the app-quit flush the API promises

    assert.equal(JSON.parse(backend._peek()).progress.xp, 42, "quit-time flush() must not be a no-op");
    assert.equal(store.isDirty(), false);
  });

  test("a set() during an in-flight write leaves the store dirty (the newer edit is not marked saved)", async () => {
    const backend = createFailingBackend({ failWrites: false, delayMs: 30 });
    const store = createStore({ backend, debounceMs: 999999 });
    await store.load();
    store.set("progress", (p) => ({ ...p, xp: 1 }));

    const writing = store.flush();
    store.set("progress", (p) => ({ ...p, xp: 2 })); // lands mid-write
    await writing;

    assert.equal(store.isDirty(), true, "xp:2 was never written, so the store is still dirty");
    assert.equal(JSON.parse(backend._peek()).progress.xp, 1);

    await store.flush();
    assert.equal(JSON.parse(backend._peek()).progress.xp, 2);
    assert.equal(store.isDirty(), false);
  });
});

// ---------------------------------------------------------------------------
// backends: file backend atomic-write behaviour
// ---------------------------------------------------------------------------

describe("createFileBackend", () => {
  // The document holds the user's notes, highlights, bookmarks and progress —
  // the Heart pillar's reflections, the Hustle tools' STAR stories and salary
  // negotiation prep. It is not a credential store, but it is a private journal,
  // and it shipped 0644 (world-readable): lib/endpoints/store.js learned the
  // 0600 lesson while this backend was still dead code, so nobody hardened it.
  // Found by running the real app and looking at the file it wrote.
  // POSIX-only: `chmod` on win32 toggles the read-only bit and nothing else,
  // and `stat` reports a synthesised 0666/0777, so this property is not
  // observable there. Skipped rather than deleted — it is the only guard on
  // this file's privacy and it must stay green on POSIX. See the long note in
  // test/endpoints.test.js and the FILE_MODE note in lib/endpoints/store.js.
  test("write() leaves the document 0600 in a 0700 directory", posixOnly, async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "coop-store-mode-"));
    const filePath = path.join(dir, "nested", "store.json");
    await createFileBackend(filePath).write('{"a":1}');

    assert.equal((await fs.stat(filePath)).mode & 0o777, 0o600, "the document must not be world-readable");
    assert.equal((await fs.stat(path.dirname(filePath))).mode & 0o777, 0o700, "nor reachable by listing its parent");
    await fs.rm(dir, { recursive: true, force: true });
  });

  // The trap that makes the mode option alone insufficient: mkdir's `mode` and
  // writeFile's `mode` are only honoured when they CREATE. Against a directory
  // that already exists with a looser mode, only an explicit chmod fixes it —
  // so the guard has to be tested against an ALREADY-WRONG fixture, not just a
  // fresh one. (Same lesson as lib/endpoints/store.js's post-write chmod.)
  // POSIX-only, for the same reason as the test above.
  test("write() tightens a directory that already exists too permissively", posixOnly, async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "coop-store-mode-"));
    const sub = path.join(dir, "loose");
    await fs.mkdir(sub, { mode: 0o755 });
    await fs.chmod(sub, 0o755); // mkdir's mode is umask-masked; force the wrong state
    assert.equal((await fs.stat(sub)).mode & 0o777, 0o755, "fixture must start wrong for this test to mean anything");

    await createFileBackend(path.join(sub, "store.json")).write('{"a":1}');

    assert.equal((await fs.stat(sub)).mode & 0o777, 0o700, "an existing loose directory must be tightened");
    assert.equal((await fs.stat(path.join(sub, "store.json"))).mode & 0o777, 0o600);
    await fs.rm(dir, { recursive: true, force: true });
  });

  test("read() on a file that doesn't exist yet returns null", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "coop-store-test-"));
    const backend = createFileBackend(path.join(dir, "nested", "store.json"));
    assert.equal(await backend.read(), null);
    await fs.rm(dir, { recursive: true, force: true });
  });

  test("write() then read() round-trips exact content, and leaves no leftover temp files", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "coop-store-test-"));
    const filePath = path.join(dir, "store.json");
    const backend = createFileBackend(filePath);
    const payload = JSON.stringify({ hello: "world", n: 1 });

    await backend.write(payload);
    const readBack = await backend.read();
    assert.equal(readBack, payload);

    const entries = await fs.readdir(dir);
    assert.deepEqual(entries, ["store.json"], "no .tmp file should survive a successful write");

    await fs.rm(dir, { recursive: true, force: true });
  });

  test("a second write fully replaces the first (atomic overwrite, not append)", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "coop-store-test-"));
    const backend = createFileBackend(path.join(dir, "store.json"));
    await backend.write(JSON.stringify({ v: 1 }));
    await backend.write(JSON.stringify({ v: 2 }));
    assert.equal(await backend.read(), JSON.stringify({ v: 2 }));
    await fs.rm(dir, { recursive: true, force: true });
  });

  test("createStore works end-to-end against the real file backend", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "coop-store-test-"));
    const filePath = path.join(dir, "doc.json");
    const store = createStore({ backend: createFileBackend(filePath) });
    await store.load();
    store.set("progress", (p) => ({ ...p, xp: 250, streak: 3 }));
    await store.flush();

    const raw = await fs.readFile(filePath, "utf8");
    assert.equal(JSON.parse(raw).progress.xp, 250);

    const store2 = createStore({ backend: createFileBackend(filePath) });
    const doc = await store2.load();
    assert.equal(doc.progress.streak, 3);

    await fs.rm(dir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// backends: ipc backend is a thin, injectable pass-through
// ---------------------------------------------------------------------------

describe("createIPCBackend", () => {
  test("delegates read/write to the injected functions", async () => {
    let stored = null;
    const backend = createIPCBackend({
      read: async () => stored,
      write: async (text) => { stored = text; },
    });
    assert.equal(await backend.read(), null);
    await backend.write("hello");
    assert.equal(await backend.read(), "hello");
  });

  test("throws immediately if read/write are not functions", () => {
    assert.throws(() => createIPCBackend({ read: null, write: null }));
  });
});

// ---------------------------------------------------------------------------
// export/import
// ---------------------------------------------------------------------------

describe("export/import", () => {
  test("exportDocument -> importDocument round-trips the document exactly", () => {
    const doc = defaultDocument();
    doc.progress.xp = 500;
    doc.bookmarks["excel-1"] = { lessonId: "excel-1", createdAt: "2026-07-15T00:00:00.000Z" };

    const json = exportDocument(doc);
    const imported = importDocument(json);
    assert.deepEqual(imported, doc);
  });

  test("importDocument also accepts a bare (unwrapped) document", () => {
    const doc = defaultDocument();
    doc.progress.xp = 12;
    const imported = importDocument(JSON.stringify(doc));
    assert.deepEqual(imported, doc);
  });

  test("importDocument rejects invalid JSON with a clear error", () => {
    assert.throws(() => importDocument("{not json"), /not valid JSON/);
  });

  test("importDocument rejects an unknown future schema version", () => {
    const future = JSON.stringify({ ...defaultDocument(), schemaVersion: CURRENT_SCHEMA_VERSION + 1 });
    assert.throws(() => importDocument(future), /newer than this build supports/);
  });

  test("importDocument rejects a foreign JSON file instead of accepting a slice-less document", () => {
    assert.throws(
      () => importDocument(JSON.stringify({ name: "some-app", version: "1.0.0" })),
      /does not look like a coop-prep document/
    );
  });

  test("importDocument backfills a hand-truncated document rather than returning it slice-less", () => {
    const imported = importDocument(JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, progress: { xp: 9 } }));
    assert.equal(imported.progress.xp, 9);
    assert.deepEqual(imported.bookmarks, {}, "a missing slice must be backfilled, never left undefined");
    assert.deepEqual(imported.tools, {});
  });

  test("a rejected import cannot clobber existing saved data", async () => {
    const backend = createMemoryBackend(null);
    const store = createStore({ backend, debounceMs: 999999 });
    await store.load();
    store.set("progress", (p) => ({ ...p, xp: 800 }));
    await store.flush();
    const savedBefore = backend._peek();

    assert.throws(
      () => store.setDocument(importDocument(JSON.stringify({ name: "some-app", version: "1.0.0" }))),
      /does not look like a coop-prep document/
    );

    assert.equal(store.get("progress").xp, 800, "the in-memory document must be untouched");
    await store.flush();
    assert.equal(backend._peek(), savedBefore, "a rejected import must never reach the backend");
  });
});
