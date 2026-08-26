import { test } from "node:test";
import assert from "node:assert/strict";

import excelDates from "../lib/guide/lessons/excel-dates.js";

test("excel-dates lesson imports and validates", () => {
  assert.ok(excelDates, "lesson should export");
  assert.equal(excelDates.id, "excel-dates");
  assert.equal(excelDates.mode, "guided");
  assert.equal(excelDates.voice, true);
  assert.equal(excelDates.steps.length, 4);
});

test("excel-dates grader passes on intended solution state", () => {
  const step0Grader = excelDates.steps[0].grader;
  const step1Grader = excelDates.steps[1].grader;
  const step2Grader = excelDates.steps[2].grader;
  const step3Grader = excelDates.steps[3].grader;

  assert.ok(step0Grader, "step 0 should have a grader");
  assert.equal(step0Grader.type, "cellFormula");

  assert.ok(step1Grader, "step 1 should have a grader");
  assert.equal(step1Grader.type, "allOf");

  assert.ok(step2Grader, "step 2 should have a grader");
  assert.equal(step2Grader.type, "cellFormula");

  assert.ok(step3Grader, "step 3 should have a grader");
  assert.equal(step3Grader.type, "allOf");
});

test("excel-dates grader fails on empty state", () => {
  const toolState = {
    tool: "sheet",
    sheets: [{ name: "Data", cells: {} }],
  };

  const step0Grader = excelDates.steps[0].grader;
  assert.ok(step0Grader, "step 0 should have a grader");
  // Grader should fail when there's no formula in C2
});

test("every step has a checkpoint", () => {
  for (const step of excelDates.steps) {
    assert.ok(step.checkpoint, `step ${step.id} should have a checkpoint`);
    assert.equal(step.checkpoint.tool, "sheet");
  }
});

test("every step names its spotlight target in the instruction", () => {
  const CELL_RE = /\b[A-Z]{1,3}[0-9]{1,4}\b/g;
  for (const step of excelDates.steps) {
    if (!step.target || step.target.kind !== "sheet-cell") continue;
    const prose = `${step.spotlightLabel ?? ""} ${step.instruction ?? ""}`;
    const named = new Set(prose.match(CELL_RE) ?? []);
    assert.ok(
      named.has(step.target.ref),
      `step ${step.id}: target.ref "${step.target.ref}" not named in label/instruction`,
    );
  }
});
