// Regression test (audit finding, coop-prep): createHubStore.save() ran
// unserialized. CompanionWidget fires hub:save on every state change with no
// debounce, so rapid edits overlap. Two concurrent save()s could reorder their
// renames (republishing an OLDER Hub snapshot — a deleted card resurrects),
// collide on the Date.now() temp path, and interleave writes to the same
// deterministic per-id image file (corruption). The fix chains saves through an
// internal promise tail so writes are strictly ordered and never overlap.
//
// The mock on the shared node:fs promises object makes the ordering observable
// and deterministic: with serialization only ONE rename is ever in flight; the
// pre-fix code has both in flight at once.

import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHubStore } from "../electron/companion/hub-store.js";

const tick = () => new Promise((r) => setImmediate(r));
const textItem = (id) => ({
  id,
  at: "2026-01-01T00:00:00Z",
  artifact: { kind: "text", title: id, content: "x" },
});

test("save() serializes: the second save's rename waits for the first to finish", async () => {
  const renames = [];
  const releases = [];
  mock.method(fs, "mkdir", async () => {});
  mock.method(fs, "writeFile", async () => {});
  mock.method(fs, "rename", (_from, to) =>
    new Promise((resolve) => {
      renames.push(to);
      releases.push(resolve);
    })
  );
  try {
    const store = createHubStore({ userDataDir: path.join(os.tmpdir(), "hub-ser-" + Date.now()) });

    const sA = store.save([textItem("A")]);
    const sB = store.save([textItem("B")]);

    // Let both async bodies progress as far as they can.
    for (let i = 0; i < 6; i++) await tick();

    // Serialized: save B is queued behind A, so only A's rename has been issued.
    // Unserialized (the bug): both saves ran concurrently → both renames in flight.
    assert.equal(renames.length, 1, "only one save's rename may be in flight at a time");

    // Release A's rename; B may now proceed to its own.
    releases[0]();
    for (let i = 0; i < 6; i++) await tick();
    assert.equal(renames.length, 2, "the second save proceeds once the first completes");

    releases[1]();
    const [rA, rB] = await Promise.all([sA, sB]);
    assert.equal(rA.ok, true);
    assert.equal(rB.ok, true);
  } finally {
    mock.restoreAll();
  }
});
