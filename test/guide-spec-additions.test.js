// Tutorial-system additions to the GuidedLesson format: step.target,
// step.spotlightLabel, lesson.mode, lesson.voice. Every field is optional
// with a safe default, so the 21 shipped lessons must validate and normalize
// exactly as they did before this file existed.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  TARGET_KINDS, LESSON_MODES,
  validateLesson, createLesson,
} from "../lib/guide/spec.js";
import { normalizeStep } from "../components/guide/adapter.js";
import { LESSONS } from "../lib/guide/lessons/index.js";

const BASE_STEP = {
  instruction: "do it",
  checkpoint: { tool: "sheet", sheets: [{ name: "S" }] },
  grader: { type: "cellValue", ref: "A1", expected: 1 },
};

function lessonWith(overrides = {}, stepOverrides = {}) {
  return {
    id: "x",
    title: "X",
    tool: "sheet",
    ...overrides,
    steps: [{ ...BASE_STEP, ...stepOverrides }],
  };
}

// ==============================================================================
describe("guide/spec: backward compatibility (no new fields)", () => {
  test("a lesson with none of the new fields validates", () => {
    const r = validateLesson(lessonWith());
    assert.deepEqual(r, { valid: true, errors: [] });
  });

  test("createLesson defaults mode, voice, target, spotlightLabel", () => {
    const lesson = createLesson(lessonWith());
    assert.equal(lesson.mode, "guided");
    assert.equal(lesson.voice, false);
    assert.equal(lesson.steps[0].target, null);
    assert.equal(lesson.steps[0].spotlightLabel, "");
  });

  test("spotlightLabel defaults to step.title when title is set", () => {
    const lesson = createLesson(lessonWith({}, { title: "Write the lookup" }));
    assert.equal(lesson.steps[0].spotlightLabel, "Write the lookup");
    assert.equal(lesson.steps[0].title, "Write the lookup");
  });
});

// ==============================================================================
describe("guide/spec: step.target", () => {
  test("TARGET_KINDS lists the three shapes", () => {
    assert.deepEqual(TARGET_KINDS, ["sheet-cell", "selector", "region"]);
  });

  test("a valid sheet-cell target passes", () => {
    const r = validateLesson(lessonWith({}, { target: { kind: "sheet-cell", ref: "H2", sheet: "Applicants" } }));
    assert.deepEqual(r, { valid: true, errors: [] });
  });

  test("a valid sheet-cell target without sheet passes", () => {
    const r = validateLesson(lessonWith({}, { target: { kind: "sheet-cell", ref: "H2" } }));
    assert.deepEqual(r, { valid: true, errors: [] });
  });

  test("a valid selector target passes", () => {
    const r = validateLesson(lessonWith({}, { target: { kind: "selector", selector: "[data-guide-target='viz-columns']" } }));
    assert.deepEqual(r, { valid: true, errors: [] });
  });

  test("a valid region target passes", () => {
    const r = validateLesson(lessonWith({}, { target: { kind: "region", anchor: "columns-shelf" } }));
    assert.deepEqual(r, { valid: true, errors: [] });
  });

  test("rejects a bad kind", () => {
    const r = validateLesson(lessonWith({}, { target: { kind: "bogus" } }));
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("target.kind must be one of")));
  });

  test("rejects a sheet-cell target missing ref", () => {
    const r = validateLesson(lessonWith({}, { target: { kind: "sheet-cell" } }));
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('needs a "ref"')));
  });

  test("rejects a selector target missing selector", () => {
    const r = validateLesson(lessonWith({}, { target: { kind: "selector" } }));
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('needs a "selector"')));
  });

  test("rejects a region target missing anchor", () => {
    const r = validateLesson(lessonWith({}, { target: { kind: "region" } }));
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('needs an "anchor"')));
  });

  test("rejects a non-object target", () => {
    const r = validateLesson(lessonWith({}, { target: "H2" }));
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("target must be an object")));
  });

  test("createLesson carries a valid target through unchanged", () => {
    const target = { kind: "sheet-cell", ref: "H2" };
    const lesson = createLesson(lessonWith({}, { target }));
    assert.deepEqual(lesson.steps[0].target, target);
  });
});

// ==============================================================================
describe("guide/spec: step.spotlightLabel", () => {
  test("rejects an empty spotlightLabel", () => {
    const r = validateLesson(lessonWith({}, { spotlightLabel: "" }));
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("spotlightLabel must be a non-empty string")));
  });

  test("accepts a non-empty spotlightLabel and carries it through createLesson", () => {
    const lesson = createLesson(lessonWith({}, { spotlightLabel: "Find the rate" }));
    assert.equal(lesson.steps[0].spotlightLabel, "Find the rate");
  });
});

// ==============================================================================
describe("guide/spec: lesson.mode", () => {
  test("LESSON_MODES lists guided, instructions, and outcome", () => {
    // "outcome" joined the roster when the unscaffolded variant landed
    // (lib/guide/spec.js). The old two-mode expectation described the world
    // before that assignment; this is a deliberate test update, not a loosening.
    assert.deepEqual(LESSON_MODES, ["guided", "instructions", "outcome"]);
  });

  test("accepts mode: instructions", () => {
    const r = validateLesson(lessonWith({ mode: "instructions" }));
    assert.deepEqual(r, { valid: true, errors: [] });
  });

  test("rejects an unknown mode", () => {
    const r = validateLesson(lessonWith({ mode: "auto-pilot" }));
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("lesson.mode must be one of")));
  });

  test("createLesson preserves an explicit mode", () => {
    const lesson = createLesson(lessonWith({ mode: "instructions" }));
    assert.equal(lesson.mode, "instructions");
  });
});

// ==============================================================================
describe("guide/spec: lesson.voice", () => {
  test("accepts voice: true", () => {
    const r = validateLesson(lessonWith({ voice: true }));
    assert.deepEqual(r, { valid: true, errors: [] });
  });

  test("rejects a non-boolean voice", () => {
    const r = validateLesson(lessonWith({ voice: "yes" }));
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("lesson.voice must be a boolean")));
  });

  test("createLesson preserves an explicit voice", () => {
    const lesson = createLesson(lessonWith({ voice: true }));
    assert.equal(lesson.voice, true);
  });
});

// ==============================================================================
describe("components/guide/adapter: normalizeStep surfaces target + spotlightLabel", () => {
  test("carries target through and defaults spotlightLabel to title", () => {
    const target = { kind: "region", anchor: "columns-shelf" };
    const step = normalizeStep({ id: "s1", title: "Drop a field", instruction: "do it", target }, 0);
    assert.deepEqual(step.target, target);
    assert.equal(step.spotlightLabel, "Drop a field");
  });

  test("uses an explicit spotlightLabel over the title", () => {
    const step = normalizeStep({ id: "s1", title: "Drop a field", instruction: "do it", spotlightLabel: "Place the pill" }, 0);
    assert.equal(step.spotlightLabel, "Place the pill");
  });

  test("defaults target to null and spotlightLabel to the generated title when both are absent", () => {
    const step = normalizeStep({ instruction: "do it" }, 2);
    assert.equal(step.target, null);
    assert.equal(step.spotlightLabel, "Step 3");
  });
});

// ==============================================================================
describe("guide/spec + guide/lessons: all shipped lessons still validate", () => {
  test("every lesson in the registry is a createLesson() result with defaults applied", () => {
    assert.ok(LESSONS.length > 0, "expected at least one lesson");
    for (const lesson of LESSONS) {
      const r = validateLesson(lesson);
      assert.deepEqual(r, { valid: true, errors: [] }, `lesson "${lesson.id}" should validate`);
      assert.ok(LESSON_MODES.includes(lesson.mode), `lesson "${lesson.id}" should have a valid mode`);
      assert.equal(typeof lesson.voice, "boolean", `lesson "${lesson.id}".voice should be a boolean`);
      for (const step of lesson.steps) {
        assert.equal(typeof step.spotlightLabel, "string", `lesson "${lesson.id}" step "${step.id}" spotlightLabel should be a string`);
        if (step.target !== null) {
          assert.ok(TARGET_KINDS.includes(step.target.kind), `lesson "${lesson.id}" step "${step.id}" target.kind should be valid`);
        }
      }
      // Re-running createLesson on an already-normalized lesson must be
      // idempotent — this is what would break if a new field's default
      // clobbered an already-set value.
      const again = createLesson(lesson);
      assert.deepEqual(again, lesson, `re-normalizing lesson "${lesson.id}" should be a no-op`);
    }
  });
});
