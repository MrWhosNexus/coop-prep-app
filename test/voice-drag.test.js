// test/voice-drag.test.js
//
// Pure position math for the free-floating widget (lib/voice/dragPosition.js).
// happy-dom lays nothing out (see test/helpers/render.mjs's "WHAT THIS
// CANNOT DO" note -- no real pointer geometry to assert on), so dragging
// itself is exercised here as plain arithmetic instead of a simulated
// pointer sequence: given a start position and a pointer delta, does the
// widget end up where a user would expect, clamped to the viewport?

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_POSITION,
  EDGE_MARGIN,
  applyDragDelta,
  clampToViewport,
  loadPosition,
  savePosition,
} from "../lib/voice/dragPosition.js";

describe("applyDragDelta", () => {
  test("dragging right/down decreases right/bottom (widget follows the pointer)", () => {
    const start = { right: 20, bottom: 20 };
    assert.deepEqual(applyDragDelta(start, { dx: 10, dy: 5 }), { right: 10, bottom: 15 });
  });

  test("dragging left/up increases right/bottom", () => {
    const start = { right: 20, bottom: 20 };
    assert.deepEqual(applyDragDelta(start, { dx: -30, dy: -10 }), { right: 50, bottom: 30 });
  });

  test("a zero delta is a no-op", () => {
    const start = { right: 40, bottom: 12 };
    assert.deepEqual(applyDragDelta(start, { dx: 0, dy: 0 }), start);
  });
});

describe("clampToViewport", () => {
  const bounds = { widthPx: 300, heightPx: 200, viewportW: 1000, viewportH: 800 };

  test("passes through a position that is already inside bounds", () => {
    assert.deepEqual(clampToViewport({ right: 100, bottom: 100 }, bounds), { right: 100, bottom: 100 });
  });

  test("clamps a negative right/bottom up to EDGE_MARGIN", () => {
    assert.deepEqual(clampToViewport({ right: -50, bottom: -50 }, bounds), {
      right: EDGE_MARGIN,
      bottom: EDGE_MARGIN,
    });
  });

  test("clamps an oversized right/bottom so the widget stays fully on screen", () => {
    const result = clampToViewport({ right: 5000, bottom: 5000 }, bounds);
    // right must never push the widget's left edge off the viewport's left edge.
    assert.ok(result.right <= bounds.viewportW - bounds.widthPx - EDGE_MARGIN + 1);
    assert.ok(result.bottom <= bounds.viewportH - bounds.heightPx - EDGE_MARGIN + 1);
  });

  test("never returns a negative coordinate even for a widget bigger than the viewport", () => {
    const tiny = { widthPx: 2000, heightPx: 2000, viewportW: 500, viewportH: 400 };
    const result = clampToViewport({ right: 10, bottom: 10 }, tiny);
    assert.ok(result.right >= 0);
    assert.ok(result.bottom >= 0);
  });
});

describe("loadPosition / savePosition", () => {
  function fakeStorage() {
    const store = new Map();
    return {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    };
  }

  test("returns DEFAULT_POSITION when nothing is stored", () => {
    assert.deepEqual(loadPosition(fakeStorage()), DEFAULT_POSITION);
  });

  test("round-trips a saved position", () => {
    const storage = fakeStorage();
    savePosition(storage, { right: 77, bottom: 33 });
    assert.deepEqual(loadPosition(storage), { right: 77, bottom: 33 });
  });

  test("falls back to the default on corrupt storage content", () => {
    const storage = fakeStorage();
    storage.setItem("coop.nexusVoice.position", "not json{{{");
    assert.deepEqual(loadPosition(storage), DEFAULT_POSITION);
  });

  test("never throws when storage is absent", () => {
    assert.doesNotThrow(() => loadPosition(undefined));
    assert.doesNotThrow(() => savePosition(undefined, { right: 1, bottom: 1 }));
  });
});
