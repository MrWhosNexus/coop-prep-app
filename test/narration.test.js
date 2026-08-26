// narrationText is a pure text-builder off a GuidedStep; speakStep is the
// bridge-calling wrapper around it. Both must degrade silently: no bridge,
// no throw, no speech.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { narrationText, speakStep } from "../lib/guide/narration.js";

describe("narrationText", () => {
  test("builds a non-empty line from spotlightLabel", () => {
    const text = narrationText({ spotlightLabel: "Write the lookup in H2", instruction: "..." });
    assert.ok(text.length > 0);
    assert.match(text, /H2/);
  });

  test("falls back to instruction when spotlightLabel is missing", () => {
    const text = narrationText({ instruction: "Sum column B into C10." });
    assert.equal(text, "Sum column B into C10.");
  });

  test("falls back to title, then a generic line, never empty", () => {
    assert.equal(narrationText({ title: "Pivot basics" }), "Pivot basics");
    assert.ok(narrationText({}).length > 0);
    assert.ok(narrationText(null).length > 0);
    assert.ok(narrationText(undefined).length > 0);
  });

  test("never contains an em-dash, even if the source text does", () => {
    const text = narrationText({ spotlightLabel: "Trim I2 — then paste into K2" });
    assert.ok(text.length > 0);
    assert.doesNotMatch(text, /—/);
  });
});

describe("speakStep", () => {
  test("calls bridge.speak with the narration text when enabled", async () => {
    const calls = [];
    const bridge = { speak: (text) => calls.push(text) };
    await speakStep({ spotlightLabel: "Write the lookup" }, { bridge, enabled: true });
    assert.deepEqual(calls, ["Write the lookup"]);
  });

  test("does nothing when disabled", async () => {
    const calls = [];
    const bridge = { speak: (text) => calls.push(text) };
    await speakStep({ spotlightLabel: "Write the lookup" }, { bridge, enabled: false });
    assert.deepEqual(calls, []);
  });

  test("does nothing, and never throws, when bridge is absent", async () => {
    await assert.doesNotReject(() => speakStep({ spotlightLabel: "x" }, { enabled: true }));
    await assert.doesNotReject(() => speakStep({ spotlightLabel: "x" }, {}));
    await assert.doesNotReject(() => speakStep({ spotlightLabel: "x" }));
  });

  test("does nothing, and never throws, when bridge.speak is not a function", async () => {
    await assert.doesNotReject(() =>
      speakStep({ spotlightLabel: "x" }, { bridge: { speak: "nope" }, enabled: true })
    );
  });

  test("does not throw when bridge.speak itself throws or rejects", async () => {
    const throwing = { speak: () => { throw new Error("boom"); } };
    const rejecting = { speak: () => Promise.reject(new Error("boom")) };
    await assert.doesNotReject(() => speakStep({ spotlightLabel: "x" }, { bridge: throwing, enabled: true }));
    await assert.doesNotReject(() => speakStep({ spotlightLabel: "x" }, { bridge: rejecting, enabled: true }));
  });
});
