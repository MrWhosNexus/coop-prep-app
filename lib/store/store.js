// lib/store/store.js
// The store: load/save/get/set/subscribe over a single versioned document,
// with a debounced autosave and an explicit flush() for app-quit. Talks
// only to the tiny backend port from lib/store/backends.js, so it is fully
// testable under node --test with the memory backend and zero Electron.

import { defaultDocument } from "./schema.js";
import { migrateDocument } from "./migrate.js";

const DEFAULT_DEBOUNCE_MS = 800;

/**
 * createStore({ backend, debounceMs?, onError? }) -> store
 *
 * backend: { read(): Promise<string|null>, write(text): Promise<void> }
 *   (see lib/store/backends.js for memory/file/ipc implementations)
 * debounceMs: how long to wait after the last set() before autosaving
 *   (default 800ms). flush() bypasses this and writes immediately.
 * onError: (err) => void, called when a DEBOUNCED AUTOSAVE fails -- the one
 *   write path with no caller to reject to. The app should surface this to
 *   the user (the data is still unsaved, and still dirty, so the next
 *   set()/flush() retries it). Defaults to console.error; a write failure is
 *   never swallowed silently. An explicit flush() rejects instead, so the
 *   quit path can await it and react.
 */
export function createStore({ backend, debounceMs = DEFAULT_DEBOUNCE_MS, onError } = {}) {
  if (!backend || typeof backend.read !== "function" || typeof backend.write !== "function") {
    throw new Error("createStore requires a backend with read()/write() methods");
  }

  let doc = null;
  let loaded = false;
  let dirty = false;
  let timer = null;
  // Bumped on every change. flush() captures it before awaiting the write, so
  // an edit landing mid-write cannot be marked saved by that write finishing.
  let revision = 0;
  // Serializes backend writes. Two overlapping flush() calls (the debounced
  // autosave firing while an app-quit / pagehide handler also flushes) would
  // otherwise issue two concurrent backend.write()s whose renames can land in
  // either order — an older document's write landing LAST persists stale data,
  // while the revision guard still clears `dirty`, so the newest edit is lost
  // with no error. Chaining every write through this tail forces write N+1 to
  // start only after write N's rename completes, so order is preserved.
  let writeChain = Promise.resolve();
  const listeners = new Set();

  function reportError(err) {
    if (typeof onError === "function") {
      try {
        onError(err);
      } catch {
        // an onError handler throwing must never break the store
      }
      return;
    }
    console.error(
      "coop-prep store: autosave failed -- your changes are still unsaved and will be retried on the next save or flush()",
      err
    );
  }

  function notify() {
    for (const fn of listeners) {
      try {
        fn(doc);
      } catch {
        // a listener throwing must never break the store
      }
    }
  }

  function ensureLoaded() {
    if (!loaded) {
      throw new Error("Store not loaded yet -- call and await load() first");
    }
  }

  /**
   * load() -> document
   * Reads from the backend, migrates if necessary (throws loudly on an
   * unknown future schema version -- see migrate.js), and falls back to
   * defaultDocument() when the backend has nothing saved yet.
   */
  async function load() {
    const raw = await backend.read();
    let parsed = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null; // corrupt payload -- treat as "nothing saved" rather than crash
      }
    }
    doc = parsed ? migrateDocument(parsed) : defaultDocument();
    loaded = true;
    notify();
    return doc;
  }

  /**
   * get(sliceName?) -> the whole document, or one slice of it.
   * Always the live in-memory document -- never re-reads the backend.
   */
  function get(sliceName) {
    ensureLoaded();
    return sliceName === undefined ? doc : doc[sliceName];
  }

  function scheduleSave() {
    dirty = true;
    revision += 1;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      flush().catch(reportError);
    }, debounceMs);
    // Never let a pending autosave keep the process (e.g. a CLI test run) alive.
    if (timer && typeof timer.unref === "function") timer.unref();
  }

  /**
   * set(sliceName, updater) -> new slice value
   * updater is either a new value for the slice or `(current) => next`.
   * Immutable at the document root; schedules a debounced autosave.
   */
  function set(sliceName, updater) {
    ensureLoaded();
    const current = doc[sliceName];
    const next = typeof updater === "function" ? updater(current) : updater;
    doc = { ...doc, [sliceName]: next };
    scheduleSave();
    notify();
    return next;
  }

  /**
   * setDocument(nextDoc) -> document
   * Replaces the whole document at once (e.g. after export/import).
   * Always migrated, so a stale import can never bypass version checks.
   */
  function setDocument(nextDoc) {
    doc = migrateDocument(nextDoc);
    loaded = true;
    scheduleSave();
    notify();
    return doc;
  }

  /**
   * flush() -> Promise<void>
   * Writes the current document to the backend immediately, cancelling
   * any pending debounced save. Call this on app-quit so nothing is lost.
   * No-op if there is nothing dirty to write.
   *
   * Rejects if the backend write fails (ENOSPC, a read-only app-data dir, an
   * IPC channel torn down mid-quit, ...). The document stays dirty in that
   * case, so the data is still in memory and the next set()/flush() retries
   * it -- a failed write must never look like a successful one.
   */
  async function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!dirty || !doc) return;
    const writingRevision = revision;
    const payload = JSON.stringify(doc);
    // Serialize behind any in-flight write so concurrent flushes cannot reorder
    // at the backend. Only ever clear `dirty` AFTER the write resolves, and only
    // if no newer edit arrived while this was the latest write — if it rejects,
    // the rejection propagates and the document stays dirty for the next attempt.
    const run = writeChain
      .then(() => backend.write(payload))
      .then(() => {
        if (revision === writingRevision) dirty = false;
      });
    // The chain must keep flowing even if this write rejects (so a later flush
    // still runs), but this caller still sees the rejection.
    writeChain = run.then(undefined, () => {});
    return run;
  }

  /**
   * subscribe(fn) -> unsubscribe
   * fn(document) is called after load(), and after every set()/setDocument().
   */
  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return {
    load,
    get,
    set,
    setDocument,
    subscribe,
    flush,
    isLoaded: () => loaded,
    isDirty: () => dirty,
  };
}
