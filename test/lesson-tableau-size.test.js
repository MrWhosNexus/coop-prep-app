// Tests for tableau-size lesson: size encoding as a data channel.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { lesson } from "../lib/guide/lessons/tableau-size.js";
import { validateLesson } from "../lib/guide/spec.js";

describe("lesson: tableau-size", () => {
  test("lesson structure is valid", () => {
    assert.equal(lesson.id, "tableau-size");
    assert.equal(lesson.tool, "viz");
    assert.equal(lesson.moduleId, "tableau");
    assert.equal(lesson.mode, "guided");
    assert.equal(lesson.voice, true);
    assert.equal(lesson.steps.length, 3);
    assert.ok(lesson.title && lesson.description);
  });

  test("lesson passes createLesson validation", () => {
    const validation = validateLesson(lesson);
    assert.deepEqual(validation, { valid: true, errors: [] }, `Validation errors: ${validation.errors.join("; ")}`);
  });

  test("step 0 has a checkpoint", () => {
    assert.ok(lesson.steps[0].checkpoint, "Step 0 must have a checkpoint");
  });

  test("every step has a grader", () => {
    for (const step of lesson.steps) {
      assert.ok(step.grader, `Step ${step.id} missing grader`);
    }
  });

  test("all steps have non-empty instruction", () => {
    for (const step of lesson.steps) {
      assert.ok(step.instruction && step.instruction.trim(), `Step ${step.id} has empty instruction`);
    }
  });

  test("all steps have 0-4 hints", () => {
    for (const step of lesson.steps) {
      const count = (step.hints ?? []).length;
      assert.ok(count <= 4, `Step ${step.id}: too many hints (${count})`);
    }
  });

  test("all step targets use valid anchors", () => {
    const validAnchors = [
      "viz-columns",
      "viz-rows",
      "viz-marks-color",
      "viz-marks-size",
      "viz-filters",
      "viz-showme",
      "viz-fieldlist",
    ];
    for (const step of lesson.steps) {
      if (step.target?.kind === "region") {
        assert.ok(
          validAnchors.includes(step.target.anchor),
          `Step ${step.id}: invalid anchor "${step.target.anchor}"`,
        );
      }
    }
  });

  test("all spotlight labels are short and clean", () => {
    for (const step of lesson.steps) {
      if (step.spotlightLabel) {
        assert.ok(
          step.spotlightLabel.length <= 80,
          `Step ${step.id}: spotlight label too long (${step.spotlightLabel.length} chars)`,
        );
        assert.ok(
          !step.spotlightLabel.includes("—"),
          `Step ${step.id}: spotlight label contains em-dash`,
        );
      }
    }
  });
});
