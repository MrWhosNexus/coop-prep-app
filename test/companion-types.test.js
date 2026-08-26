// test/companion-types.test.js
//
// The pure Hub helpers ported verbatim from Nexus's types.ts. The load-bearing
// piece is addHubItem's imageLoading-collapse: a finished image must replace a
// trailing generating placeholder IN PLACE (keeping its id) so the user's
// selection survives and no dead spinner sits beside the result.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { addHubItem, newHubItem, newEntry, MOUTH_REST, COMPANION_MOODS } from "../lib/voice/companion/types.js";

describe("addHubItem", () => {
  test("appends an ordinary artifact", () => {
    const a = newHubItem({ kind: "text", title: "A", content: "a" });
    const next = addHubItem([a], { kind: "code", title: "B", content: "b" });
    assert.equal(next.length, 2);
    assert.equal(next[1].artifact.title, "B");
  });

  test("a finished image collapses a trailing imageLoading placeholder in place, keeping its id", () => {
    const loading = newHubItem({ kind: "imageLoading", title: "Generating image", content: "a cat" });
    const before = [loading];
    const after = addHubItem(before, { kind: "image", title: "Cat", content: "data:image/png;base64,AAAA" });
    assert.equal(after.length, 1, "the placeholder was replaced, not appended beside");
    assert.equal(after[0].id, loading.id, "the id is preserved so selection survives");
    assert.equal(after[0].artifact.kind, "image");
  });

  test("an image with no trailing placeholder just appends", () => {
    const other = newHubItem({ kind: "text", title: "note", content: "x" });
    const after = addHubItem([other], { kind: "image", title: "Cat", content: "data:image/png;base64,AAAA" });
    assert.equal(after.length, 2);
  });

  test("purity — the input array is not mutated", () => {
    const items = [newHubItem({ kind: "text", title: "A", content: "a" })];
    const snapshot = [...items];
    addHubItem(items, { kind: "text", title: "B", content: "b" });
    assert.deepEqual(items, snapshot);
  });
});

describe("newEntry / constants", () => {
  test("newEntry stamps a role, text, id and timestamp", () => {
    const e = newEntry("hermes", "hello");
    assert.equal(e.role, "hermes");
    assert.equal(e.text, "hello");
    assert.ok(e.id && e.at);
  });

  test("MOUTH_REST and COMPANION_MOODS are the expected shapes", () => {
    assert.deepEqual(MOUTH_REST, { open: 0, width: 0.18, round: 0, teeth: 0 });
    assert.ok(COMPANION_MOODS.includes("speaking"));
  });
});
