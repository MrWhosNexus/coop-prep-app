// Regression test (audit finding, coop-prep): createStore.flush() issued the
// backend write without serializing, so two overlapping flushes — the debounced
// autosave firing while an app-quit / pagehide handler also flushes — produced
// two concurrent backend.write()s whose renames could land in either order. An
// OLDER document's write landing LAST persists stale data on disk, while the
// revision guard still clears `dirty`, so the user's newest edit is lost with no
// error. The fix chains every write through a per-store tail so write N+1 starts
// only after write N completes; order is preserved.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../lib/store/store.js";

// A backend whose write() completions are driven by the test, so the adversarial
// reorder is deterministic. Each write() stays pending until the test commits it;
// committing sets `stored` (models the rename landing).
function controllableBackend() {
  const pending = [];
  let stored = null;
  return {
    backend: {
      async read() {
        return stored;
      },
      write(text) {
        return new Promise((resolve) => {
          pending.push({
            text,
            done: false,
            commit() {
              stored = text; // the rename lands: last commit wins on disk
              this.done = true;
              resolve();
            },
          });
        });
      },
    },
    pending,
    getStored: () => stored,
  };
}

const tick = () => new Promise((r) => setImmediate(r));

describe("flush serialization", () => {
  test("overlapping flushes persist the NEWEST document, never a stale earlier write", async () => {
    const { backend, pending, getStored } = controllableBackend();
    const store = createStore({ backend, debounceMs: 10_000 }); // manual flushes only
    await store.load();

    // Two edits, each immediately flushed -> two overlapping flush() calls.
    store.set("progress", (p) => ({ ...p, xp: 1 })); // doc A
    const fA = store.flush();
    store.set("progress", (p) => ({ ...p, xp: 2 })); // doc B (newest)
    const fB = store.flush();

    // Adversary: whenever more than one write is in flight, complete the
    // most-recently issued one FIRST (the reorder that lands the older write
    // last). With serialization only one write is ever pending, so this still
    // drains A then B in order; without it, both are pending and B commits
    // before A, leaving stale A on disk.
    for (let i = 0; i < 12; i++) {
      await tick();
      const next = [...pending].reverse().find((w) => !w.done);
      if (next) next.commit();
    }
    await Promise.allSettled([fA, fB]);

    const persisted = JSON.parse(getStored());
    assert.equal(
      persisted.progress.xp,
      2,
      "the newest edit (xp=2) must be on disk, not a stale earlier write (xp=1)",
    );
    assert.equal(store.isDirty(), false, "dirty must be clear only when the newest write persisted");
  });
});
