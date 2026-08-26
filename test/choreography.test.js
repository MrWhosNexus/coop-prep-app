// test/choreography.test.js
//
// choreography.js is pure data in, data out -- no DOM, no timers -- so it is
// tested directly with plain assertions. No render harness needed.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  planTransition,
  celebrationPlan,
  PHASES,
} from "../lib/guide/choreography.js";

const RECT_A = { top: 100, left: 100, width: 80, height: 30 };

describe("planTransition: base", () => {
  test("base always equals the destination rect, untouched", () => {
    const toRect = { top: 250, left: 300, width: 120, height: 40 };
    const plan = planTransition(RECT_A, toRect, {});
    assert.deepEqual(plan.base, toRect);
  });

  test("to is always identity", () => {
    const toRect = { top: 250, left: 300, width: 120, height: 40 };
    const plan = planTransition(RECT_A, toRect, {});
    assert.deepEqual(plan.to, {
      translateX: 0,
      translateY: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
    });
  });
});

describe("planTransition: delta math", () => {
  test("target to the right yields a negative starting translateX", () => {
    const toRect = { top: 100, left: 400, width: 80, height: 30 }; // right of RECT_A
    const plan = planTransition(RECT_A, toRect, {});
    assert.ok(
      plan.from.translateX < 0,
      "ring must start left of the destination when the target moved right"
    );
    assert.equal(plan.from.translateX, RECT_A.left - toRect.left);
  });

  test("target to the left yields a positive starting translateX", () => {
    const toRect = { top: 100, left: 10, width: 80, height: 30 }; // left of RECT_A
    const plan = planTransition(RECT_A, toRect, {});
    assert.ok(
      plan.from.translateX > 0,
      "ring must start right of the destination when the target moved left"
    );
  });

  test("target below yields a negative starting translateY", () => {
    const toRect = { top: 500, left: 100, width: 80, height: 30 }; // below RECT_A
    const plan = planTransition(RECT_A, toRect, {});
    assert.ok(
      plan.from.translateY < 0,
      "ring must start above the destination when the target moved down"
    );
    assert.equal(plan.from.translateY, RECT_A.top - toRect.top);
  });

  test("target above yields a positive starting translateY", () => {
    const toRect = { top: 10, left: 100, width: 80, height: 30 }; // above RECT_A
    const plan = planTransition(RECT_A, toRect, {});
    assert.ok(
      plan.from.translateY > 0,
      "ring must start below the destination when the target moved up"
    );
  });

  test("identical rects produce zero translate", () => {
    const plan = planTransition(RECT_A, { ...RECT_A }, {});
    assert.equal(plan.from.translateX, 0);
    assert.equal(plan.from.translateY, 0);
  });
});

describe("planTransition: scale ratios", () => {
  test("shrinking target yields scale > 1 (ring starts big, shrinks to identity)", () => {
    const toRect = { top: 100, left: 100, width: 40, height: 15 }; // half the size of RECT_A
    const plan = planTransition(RECT_A, toRect, {});
    assert.equal(plan.from.scaleX, RECT_A.width / toRect.width);
    assert.equal(plan.from.scaleY, RECT_A.height / toRect.height);
    assert.ok(plan.from.scaleX > 1);
    assert.ok(plan.from.scaleY > 1);
  });

  test("growing target yields scale < 1 (ring starts small, grows to identity)", () => {
    const toRect = { top: 100, left: 100, width: 160, height: 60 }; // double the size
    const plan = planTransition(RECT_A, toRect, {});
    assert.ok(plan.from.scaleX < 1);
    assert.ok(plan.from.scaleY < 1);
  });

  test("same-size target yields scale of exactly 1", () => {
    const toRect = { top: 200, left: 200, width: 80, height: 30 };
    const plan = planTransition(RECT_A, toRect, {});
    assert.equal(plan.from.scaleX, 1);
    assert.equal(plan.from.scaleY, 1);
  });

  test("zero-width destination does not divide by zero", () => {
    const toRect = { top: 100, left: 100, width: 0, height: 0 };
    const plan = planTransition(RECT_A, toRect, {});
    assert.equal(plan.from.scaleX, 1);
    assert.equal(plan.from.scaleY, 1);
  });
});

describe("planTransition: reduceMotion", () => {
  test("collapses from/to to the same identity transform", () => {
    const toRect = { top: 500, left: 500, width: 80, height: 30 };
    const plan = planTransition(RECT_A, toRect, { reduceMotion: true });
    assert.deepEqual(plan.from, plan.to);
  });

  test("durationMs is 0", () => {
    const toRect = { top: 500, left: 500, width: 80, height: 30 };
    const plan = planTransition(RECT_A, toRect, { reduceMotion: true });
    assert.equal(plan.durationMs, 0);
  });

  test("reduceMotion also collapses the null-fromRect path", () => {
    const toRect = { top: 500, left: 500, width: 80, height: 30 };
    const plan = planTransition(null, toRect, { reduceMotion: true });
    assert.deepEqual(plan.from, plan.to);
    assert.equal(plan.durationMs, 0);
  });
});

describe("planTransition: null fromRect (first target)", () => {
  test("fades and scales in with no translate", () => {
    const toRect = { top: 100, left: 100, width: 80, height: 30 };
    const plan = planTransition(null, toRect, {});
    assert.equal(plan.from.translateX, 0);
    assert.equal(plan.from.translateY, 0);
    assert.ok(plan.from.opacity < 1, "must start below full opacity");
    assert.ok(plan.from.scaleX < 1, "must start slightly smaller than identity");
    assert.ok(plan.from.scaleY < 1);
  });

  test("still resolves base to the destination rect", () => {
    const toRect = { top: 100, left: 100, width: 80, height: 30 };
    const plan = planTransition(null, toRect, {});
    assert.deepEqual(plan.base, toRect);
  });

  test("duration is positive and a plain number", () => {
    const toRect = { top: 100, left: 100, width: 80, height: 30 };
    const plan = planTransition(null, toRect, {});
    assert.equal(typeof plan.durationMs, "number");
    assert.ok(plan.durationMs > 0);
  });
});

describe("planTransition: shape", () => {
  test("always returns an easing string", () => {
    const toRect = { top: 100, left: 100, width: 80, height: 30 };
    assert.equal(typeof planTransition(RECT_A, toRect, {}).easing, "string");
    assert.equal(typeof planTransition(null, toRect, {}).easing, "string");
    assert.equal(
      typeof planTransition(RECT_A, toRect, { reduceMotion: true }).easing,
      "string"
    );
  });
});

describe("PHASES", () => {
  test("is the four semantic phase labels in order", () => {
    assert.deepEqual(PHASES, ["dim", "move", "settle", "pulse"]);
  });
});

describe("celebrationPlan", () => {
  test("returns a positive durationMs and a non-empty particles array", () => {
    const plan = celebrationPlan({ intensity: 1 });
    assert.equal(typeof plan.durationMs, "number");
    assert.ok(plan.durationMs > 0);
    assert.ok(Array.isArray(plan.particles));
    assert.ok(plan.particles.length > 0);
  });

  test("every particle has numeric dx, dy, rot, delay", () => {
    const plan = celebrationPlan({ intensity: 1.4 });
    for (const p of plan.particles) {
      assert.equal(typeof p.dx, "number");
      assert.equal(typeof p.dy, "number");
      assert.equal(typeof p.rot, "number");
      assert.equal(typeof p.delay, "number");
    }
  });

  test("higher intensity yields at least as many particles and no shorter duration", () => {
    const low = celebrationPlan({ intensity: 0 });
    const high = celebrationPlan({ intensity: 2 });
    assert.ok(high.particles.length >= low.particles.length);
    assert.ok(high.durationMs >= low.durationMs);
  });

  test("particle delays are staggered, not simultaneous", () => {
    const plan = celebrationPlan({ intensity: 1 });
    const delays = plan.particles.map((p) => p.delay);
    const unique = new Set(delays);
    assert.equal(unique.size, delays.length, "delays should not all collide");
  });

  test("defaults to a sane plan with no options passed", () => {
    const plan = celebrationPlan();
    assert.ok(plan.durationMs > 0);
    assert.ok(plan.particles.length > 0);
  });

  test("out-of-range intensity is clamped, not thrown", () => {
    assert.doesNotThrow(() => celebrationPlan({ intensity: -5 }));
    assert.doesNotThrow(() => celebrationPlan({ intensity: 999 }));
  });
});
