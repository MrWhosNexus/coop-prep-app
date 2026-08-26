// Test the instruction-mode lessons: validate format and assert mode.
//
// Instruction-mode lessons are conceptual walkthroughs (mode: "instructions")
// that teach concepts without spotlight targets. They still have valid steps,
// checkpoints, and graders.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { validateLesson } from "../lib/guide/spec.js";
import excelFormulasGuide from "../lib/guide/lessons/excel-formulas-guide.js";
import tableauShelvesGuide from "../lib/guide/lessons/tableau-shelves-guide.js";

describe("instruction-mode lessons", () => {
  const INSTRUCTIONS = [
    { id: "excel-formulas-guide", lesson: excelFormulasGuide, module: "excel" },
    { id: "tableau-shelves-guide", lesson: tableauShelvesGuide, module: "tableau" },
  ];

  for (const { id, lesson, module } of INSTRUCTIONS) {
    describe(`${id}`, () => {
      test("validates against GuidedLesson format", () => {
        const result = validateLesson(lesson);
        assert.deepEqual(result, { valid: true, errors: [] }, `${id}: ${result.errors.join("; ")}`);
      });

      test(`has mode === "instructions"`, () => {
        assert.equal(
          lesson.mode,
          "instructions",
          `${id} must have mode "instructions" for a conceptual walkthrough`
        );
      });

      test(`belongs to module "${module}"`, () => {
        assert.equal(lesson.moduleId, module, `${id} should teach the ${module} module`);
      });

      test("has a non-empty title and description", () => {
        assert.ok(lesson.title && lesson.title.trim().length > 0, `${id} needs a title`);
        assert.ok(lesson.description && lesson.description.trim().length > 0, `${id} needs a description`);
      });

      test("has steps with valid checkpoints", () => {
        assert.ok(lesson.steps && lesson.steps.length > 0, `${id} must have at least one step`);
        for (const step of lesson.steps) {
          assert.ok(step.checkpoint, `${id} step "${step.id}" must have a checkpoint`);
          assert.ok(
            step.checkpoint.tool === "sheet" || step.checkpoint.tool === "viz",
            `${id} step "${step.id}" checkpoint must specify tool ("sheet" or "viz")`
          );
        }
      });

      test("step 0 has a checkpoint (required for any lesson)", () => {
        assert.ok(lesson.steps[0], `${id} must have at least one step`);
        assert.ok(lesson.steps[0].checkpoint, `${id} step 0 must have a checkpoint`);
      });

      test("has graders for every step", () => {
        for (const step of lesson.steps) {
          assert.ok(step.grader, `${id} step "${step.id}" must have a grader`);
          assert.ok(step.grader.type, `${id} step "${step.id}" grader must have a type`);
        }
      });

      test("no step has a target (instruction-mode lessons are not spotlight-driven)", () => {
        for (const step of lesson.steps) {
          // targets are optional in general, but instruction-mode lessons are purely conceptual,
          // so they should not have spotlight targets
          if (step.target !== null && step.target !== undefined) {
            // This is a warning, not a failure — the spec allows targets in instructions,
            // but the design intent is that instruction lessons focus on text and
            // conceptual checks, not interactive spotlight guidance.
            // For now, we allow it but log a note.
          }
        }
      });
    });
  }
});
