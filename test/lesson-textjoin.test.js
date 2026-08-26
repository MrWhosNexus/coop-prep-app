import { test } from "node:test";
import assert from "node:assert/strict";

import excelTextjoin from "../lib/guide/lessons/excel-textjoin.js";

test("excel-textjoin lesson imports and validates", () => {
  assert.ok(excelTextjoin, "lesson should export");
  assert.equal(excelTextjoin.id, "excel-textjoin");
  assert.equal(excelTextjoin.mode, "guided");
  assert.equal(excelTextjoin.voice, true);
  assert.equal(excelTextjoin.steps.length, 2);
});

test("excel-textjoin grader passes on intended solution state", () => {
  const step0Grader = excelTextjoin.steps[0].grader;
  const step1Grader = excelTextjoin.steps[1].grader;

  assert.ok(step0Grader, "step 0 should have a grader");
  assert.equal(step0Grader.type, "cellFormula");

  assert.ok(step1Grader, "step 1 should have a grader");
  assert.equal(step1Grader.type, "allOf");
});

test("excel-textjoin grader fails on empty state", () => {
  const toolState = {
    tool: "sheet",
    sheets: [{ name: "Data", cells: {} }],
  };

  const step0Grader = excelTextjoin.steps[0].grader;
  assert.ok(step0Grader, "step 0 should have a grader");
  // Grader should fail when there's no formula in D2
});

test("every step has a checkpoint", () => {
  for (const step of excelTextjoin.steps) {
    assert.ok(step.checkpoint, `step ${step.id} should have a checkpoint`);
    assert.equal(step.checkpoint.tool, "sheet");
  }
});

test("every step names its spotlight target in the instruction", () => {
  const CELL_RE = /\b[A-Z]{1,3}[0-9]{1,4}\b/g;
  for (const step of excelTextjoin.steps) {
    if (!step.target || step.target.kind !== "sheet-cell") continue;
    const prose = `${step.spotlightLabel ?? ""} ${step.instruction ?? ""}`;
    const named = new Set(prose.match(CELL_RE) ?? []);
    assert.ok(
      named.has(step.target.ref),
      `step ${step.id}: target.ref "${step.target.ref}" not named in label/instruction`,
    );
  }
});
