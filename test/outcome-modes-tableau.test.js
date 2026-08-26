// Outcome modes for the Tableau labs: the mechanical property this phase
// exists to create is that the UNSCAFFOLDED variant never hands the learner
// the answer. Every assertion here is derived, not curated:
//
//   - every lesson below declares "outcome", and every step RESOLVES to a
//     real override — no silent fallback to the scaffolded text (exactly the
//     bug class Phase 4a's session deserialization had);
//   - no outcome instruction or hint contains a formula or names a function,
//     where "function" is read off the ENGINES' own tables (the viz
//     Aggregation names and the sheet FUNCTIONS registry), so the list can
//     never drift out of date by hand;
//   - step ids and checkpoints are IDENTICAL across modes, so a learner can
//     switch variants without losing seed state;
//   - an anti-vacuity guard pins the lesson and step counts, so the suite
//     cannot green-wash an empty set.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { validateLesson, resolveLessonMode, lessonModes } from "../lib/guide/spec.js";
import { Aggregation } from "../lib/viz/aggregate.js";
import { FUNCTIONS as SHEET_FUNCTIONS } from "../lib/sheet/functions.js";

import { lesson as bars } from "../lib/guide/lessons/tableau-bars.js";
import { lesson as calc } from "../lib/guide/lessons/tableau-calc.js";
import { lesson as color } from "../lib/guide/lessons/tableau-color.js";
import { lesson as dashboard } from "../lib/guide/lessons/tableau-dashboard.js";
import { lesson as detail } from "../lib/guide/lessons/tableau-detail.js";
import { lesson as dimensions } from "../lib/guide/lessons/tableau-dimensions.js";
import { lesson as dualAxis } from "../lib/guide/lessons/tableau-dual-axis.js";
import { lesson as filters } from "../lib/guide/lessons/tableau-filters.js";
import { lesson as shelvesGuide } from "../lib/guide/lessons/tableau-shelves-guide.js";
import { lesson as showme } from "../lib/guide/lessons/tableau-showme.js";
import { lesson as pills } from "../lib/guide/lessons/tableau-pills.js";
import { lesson as size } from "../lib/guide/lessons/tableau-size.js";

const LESSONS = [
  bars, calc, color, dashboard, detail, dimensions,
  dualAxis, filters, pills, shelvesGuide, showme, size,
];

// ---------------------------------------------------------------------------
// The banned-vocabulary set, derived from the engines themselves.
// ---------------------------------------------------------------------------

// Any `=FN(` -style formula fragment, regardless of whether FN is known.
const FORMULA_RE = /=\s*[A-Z][A-Z0-9.]*\s*\(/;

// Function names the platform's engines actually export. The viz calculated-
// field language is a subset of the sheet registry's vocabulary plus the
// aggregations, so the union of the two exported tables covers every name a
// lesson could leak.
const FUNCTION_NAMES = [
  ...new Set([...Object.values(Aggregation), ...Object.keys(SHEET_FUNCTIONS)]),
];

// A leaked function is the NAME followed by an open paren (`COUNTIF(...)`),
// or the name standing alone in ALL CAPS (talking about "the AVG") — plain
// English words like "count" or "if" in lowercase are fine. Single-letter
// registry names (the sheet's T and N) are only meaningful when CALLED:
// bare "T" is an ordinary letter inside prose, so the standalone check
// applies from two characters up.
function leakedFunctions(text) {
  const leaks = [];
  for (const name of FUNCTION_NAMES) {
    const called = new RegExp(`\\b${name}\\s*\\(`);
    const named = new RegExp(`(^|[^A-Z0-9_])${name}($|[^A-Z0-9_(])`);
    if (called.test(text) || (name.length >= 2 && named.test(text))) leaks.push(name);
  }
  return leaks;
}

// ---------------------------------------------------------------------------
// Anti-vacuity: the suite must be looking at the real, full set.
// ---------------------------------------------------------------------------

describe("outcome modes: anti-vacuity", () => {
  test("all 12 tableau lessons are under test and each declares outcome", () => {
    assert.equal(LESSONS.length, 12);
    for (const lesson of LESSONS) {
      assert.ok(lesson.id.startsWith("tableau-"), `${lesson.id} is a tableau lesson`);
      assert.ok(
        lessonModes(lesson).includes("outcome"),
        `${lesson.id} must declare the outcome mode`
      );
    }
  });

  test("the set is not trivially small: at least 3 steps per lesson, 39 total", () => {
    let total = 0;
    for (const lesson of LESSONS) {
      assert.ok(lesson.steps.length >= 3, `${lesson.id} has ${lesson.steps.length} steps`);
      total += lesson.steps.length;
    }
    assert.ok(total >= 39, `expected at least 39 steps across the labs, found ${total}`);
  });

  test("the derived function list is real (sanity on the ban list itself)", () => {
    // If either engine table stopped exporting, leakedFunctions() would match
    // nothing and the core assertion below would pass vacuously.
    for (const name of ["AVG", "COUNT", "MEDIAN", "COUNTIF", "IF"]) {
      assert.ok(FUNCTION_NAMES.includes(name), `${name} must be in the derived ban list`);
    }
    assert.deepEqual(leakedFunctions('Use =COUNTIF($B$2, I2) here'), ["COUNTIF"]);
    assert.deepEqual(leakedFunctions("switch the pill to AVG"), ["AVG"]);
    assert.deepEqual(leakedFunctions("count how many applicants were approved, if any"), []);
  });
});

// ---------------------------------------------------------------------------
// Per lesson: resolution, purity, identity.
// ---------------------------------------------------------------------------

for (const lesson of LESSONS) {
  describe(`outcome mode: ${lesson.id}`, () => {
    const resolved = resolveLessonMode(lesson, "outcome");

    test("the lesson still validates", () => {
      const { valid, errors } = validateLesson(lesson);
      assert.deepEqual(errors, []);
      assert.ok(valid);
    });

    test("every step resolves to a real override — no silent fallback", () => {
      assert.equal(resolved.mode, "outcome");
      assert.equal(resolved.steps.length, lesson.steps.length);
      for (let i = 0; i < lesson.steps.length; i++) {
        const base = lesson.steps[i];
        const out = resolved.steps[i];
        // The override must exist AND actually change the posed task. A step
        // whose modes.outcome went missing would serve the scaffolded text
        // unchanged — the exact silent-reversion bug Phase 4a hit.
        assert.ok(base.modes?.outcome, `${lesson.id}/${base.id} has no outcome override`);
        assert.notEqual(
          out.instruction,
          base.instruction,
          `${lesson.id}/${base.id} serves the scaffolded instruction in outcome mode`
        );
        assert.ok(
          typeof out.instruction === "string" && out.instruction.length > 0,
          `${lesson.id}/${base.id} outcome instruction must be non-empty`
        );
      }
    });

    test("no outcome instruction contains a formula or names a function", () => {
      // THE core assertion: the outcome variant must withhold the mechanics.
      for (const step of resolved.steps) {
        assert.ok(
          !FORMULA_RE.test(step.instruction),
          `${lesson.id}/${step.id} outcome instruction contains a formula: ${step.instruction}`
        );
        const leaks = leakedFunctions(step.instruction);
        assert.deepEqual(
          leaks,
          [],
          `${lesson.id}/${step.id} outcome instruction names function(s) ${leaks.join(", ")}: ${step.instruction}`
        );
      }
    });

    test("outcome hints are 2-3 rungs and name no function", () => {
      for (const step of resolved.steps) {
        assert.ok(Array.isArray(step.hints), `${lesson.id}/${step.id} has hints`);
        assert.ok(
          step.hints.length >= 2 && step.hints.length <= 3,
          `${lesson.id}/${step.id} outcome hints must be 2-3 rungs, found ${step.hints.length}`
        );
        for (const hint of step.hints) {
          assert.ok(
            !FORMULA_RE.test(hint),
            `${lesson.id}/${step.id} outcome hint contains a formula: ${hint}`
          );
          const leaks = leakedFunctions(hint);
          assert.deepEqual(
            leaks,
            [],
            `${lesson.id}/${step.id} outcome hint names function(s) ${leaks.join(", ")}: ${hint}`
          );
        }
      }
    });

    test("step ids and checkpoints are identical between modes", () => {
      for (let i = 0; i < lesson.steps.length; i++) {
        assert.equal(resolved.steps[i].id, lesson.steps[i].id);
        assert.deepEqual(
          resolved.steps[i].checkpoint,
          lesson.steps[i].checkpoint,
          `${lesson.id}/${lesson.steps[i].id} checkpoint must not change across modes`
        );
      }
    });
  });
}
