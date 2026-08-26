// test/tour.test.js
//
// Pure module, no DOM: TOUR_STEPS content plus the tourReducer state
// machine (advance, back, finish boundary). IntroTour.js's DOM behavior is
// covered separately in test/intro-tour-ui.test.js.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  TOUR_STEPS,
  initialTourState,
  tourReducer,
  nextTourStep,
  tourStepTarget,
} from "../lib/guide/tour.js";

describe("TOUR_STEPS", () => {
  test("covers the tools, games, and voice widget with unique, non-empty steps", () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    assert.ok(ids.length >= 4, "expected at least 4 steps");
    assert.equal(new Set(ids).size, ids.length, "step ids must be unique");
    for (const step of TOUR_STEPS) {
      assert.equal(typeof step.title, "string");
      assert.equal(typeof step.body, "string");
      assert.ok(step.title.length > 0);
      assert.ok(step.body.length > 0);
    }
  });

  test("at least one step anchors into the sheet tool, the viz tool, games, and voice", () => {
    const regions = TOUR_STEPS.filter((s) => s.region).map((s) => s.region);
    const selectors = TOUR_STEPS.filter((s) => s.selector).map((s) => s.selector);
    assert.ok(regions.some((r) => /sheet/.test(r)));
    assert.ok(regions.some((r) => /viz/.test(r)));
    assert.ok(regions.some((r) => /game/.test(r)));
    assert.ok(selectors.some((s) => /voice/.test(s)));
  });
});

describe("tourStepTarget", () => {
  test("normalizes a region step", () => {
    const step = TOUR_STEPS.find((s) => s.region);
    assert.deepEqual(tourStepTarget(step), { kind: "region", anchor: step.region });
  });

  test("normalizes a selector step", () => {
    const step = TOUR_STEPS.find((s) => s.selector);
    assert.deepEqual(tourStepTarget(step), { kind: "selector", selector: step.selector });
  });

  test("returns null for a step with no anchor", () => {
    const step = TOUR_STEPS.find((s) => !s.region && !s.selector);
    assert.ok(step, "expected an anchorless step to exist (opening/closing card)");
    assert.equal(tourStepTarget(step), null);
  });

  test("returns null for a null step", () => {
    assert.equal(tourStepTarget(null), null);
  });
});

describe("tourReducer: advance", () => {
  test("NEXT moves forward one step", () => {
    const s1 = tourReducer(initialTourState(), { type: "NEXT" });
    assert.equal(s1.index, 1);
    assert.equal(s1.done, false);
  });

  test("NEXT at the last step marks done instead of running past the array", () => {
    let state = initialTourState();
    for (let i = 0; i < TOUR_STEPS.length - 1; i++) state = tourReducer(state, { type: "NEXT" });
    assert.equal(state.index, TOUR_STEPS.length - 1);
    assert.equal(state.done, false);

    const finished = tourReducer(state, { type: "NEXT" });
    assert.equal(finished.index, TOUR_STEPS.length - 1);
    assert.equal(finished.done, true);
  });

  test("NEXT is a no-op once the tour is done", () => {
    const done = { index: 2, done: true };
    assert.deepEqual(tourReducer(done, { type: "NEXT" }), done);
  });

  test("nextTourStep matches dispatching NEXT", () => {
    const s0 = initialTourState();
    assert.deepEqual(nextTourStep(s0), tourReducer(s0, { type: "NEXT" }));
  });
});

describe("tourReducer: back", () => {
  test("BACK returns to the previous step", () => {
    const s1 = tourReducer(initialTourState(), { type: "NEXT" });
    assert.deepEqual(tourReducer(s1, { type: "BACK" }), initialTourState());
  });

  test("BACK at step 0 stays at 0", () => {
    const back = tourReducer(initialTourState(), { type: "BACK" });
    assert.equal(back.index, 0);
    assert.equal(back.done, false);
  });

  test("BACK does not resurrect a finished tour", () => {
    const done = { index: TOUR_STEPS.length - 1, done: true };
    assert.deepEqual(tourReducer(done, { type: "BACK" }), done);
  });
});

describe("tourReducer: finish boundary", () => {
  test("SKIP marks done from any index without moving it", () => {
    const mid = { index: 2, done: false };
    const skipped = tourReducer(mid, { type: "SKIP" });
    assert.equal(skipped.done, true);
    assert.equal(skipped.index, 2);
  });

  test("FINISH marks done", () => {
    const finished = tourReducer(initialTourState(), { type: "FINISH" });
    assert.equal(finished.done, true);
  });

  test("SKIP/FINISH on an already-done state changes nothing", () => {
    const done = { index: 1, done: true };
    assert.deepEqual(tourReducer(done, { type: "SKIP" }), done);
    assert.deepEqual(tourReducer(done, { type: "FINISH" }), done);
  });

  test("RESET returns to the initial state from anywhere", () => {
    const done = { index: TOUR_STEPS.length - 1, done: true };
    assert.deepEqual(tourReducer(done, { type: "RESET" }), initialTourState());
  });

  test("an unknown action is a no-op", () => {
    const s0 = initialTourState();
    assert.deepEqual(tourReducer(s0, { type: "NOPE" }), s0);
  });
});
