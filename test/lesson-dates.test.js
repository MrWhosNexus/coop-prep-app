import { test } from "node:test";
import assert from "node:assert/strict";

import excelDates, { APPLICATIONS, YEARS_BETWEEN } from "../lib/guide/lessons/excel-dates.js";
import { grade } from "../lib/guide/graders.js";
import { startingState } from "../lib/guide/checkpoints.js";
import { setCell } from "../lib/sheet/model.js";

/** Materialized tool state for entering step `i` (no external resources needed). */
function stateFor(i) {
  return startingState(excelDates, i, {}).toolState;
}

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
  // anyOf: DATEDIF or plain =B2-A2 — the lesson accepts both day methods
  assert.equal(step0Grader.type, "anyOf");

  assert.ok(step1Grader, "step 1 should have a grader");
  assert.equal(step1Grader.type, "allOf");

  assert.ok(step2Grader, "step 2 should have a grader");
  assert.equal(step2Grader.type, "cellFormula");

  assert.ok(step3Grader, "step 3 should have a grader");
  assert.equal(step3Grader.type, "allOf");
});

test("days step accepts DATEDIF and plain subtraction alike", () => {
  for (const formula of ['=DATEDIF(A2, B2, "D")', "=B2-A2"]) {
    const ts = stateFor(0);
    setCell(ts.sheets.Data, "C2", formula);
    const r = grade(ts, excelDates.steps[0].grader);
    assert.equal(r.pass, true, `${formula}: ${r.message}`);
  }
});

test("days step rejects a typed constant even with the right value", () => {
  const ts = stateFor(0);
  setCell(ts.sheets.Data, "C2", 32);
  const r = grade(ts, excelDates.steps[0].grader);
  assert.equal(r.pass, false);
});

test("years fill passes with =(B-A)/365.25 in every row", () => {
  const ts = stateFor(3);
  for (let r = 2; r <= APPLICATIONS.length + 1; r++) {
    setCell(ts.sheets.Data, `D${r}`, `=(B${r}-A${r})/365.25`);
  }
  const r = grade(ts, excelDates.steps[3].grader);
  assert.equal(r.pass, true, r.message);
});

test('the old DATEDIF("Y")+MOD hybrid is rejected — it is wrong by a full year on long spans', () => {
  // The formula this lesson USED TO TEACH. On the 440-day row DATEDIF("Y")
  // counts 1 calendar year while MOD(440, 365.25)/365.25 re-counts most of
  // the same span — the value comes out near 1.2 only by luck of these
  // dates; across start dates 17% of >1yr spans were off by a FULL year.
  // The grader must reject it on METHOD (no 365.25-division of the raw
  // span), and the >1yr sample row exists so that even a value-only grader
  // regression would surface where the hybrid actually diverges.
  const ts = stateFor(3);
  for (let r = 2; r <= APPLICATIONS.length + 1; r++) {
    setCell(ts.sheets.Data, `D${r}`, `=DATEDIF(A${r}, B${r}, "Y") + (MOD(B${r} - A${r}, 365.25) / 365.25)`);
  }
  const r = grade(ts, excelDates.steps[3].grader);
  assert.equal(r.pass, false, "the double-counting hybrid must not pass the years fill");
});

test("the sample data includes a span longer than one year", () => {
  // Guard for the guard: with only 30-70 day spans, correct and broken year
  // formulas agree everywhere and the grader can't tell them apart.
  assert.ok(
    APPLICATIONS.some(([a, b]) => b - a > 365.25),
    "APPLICATIONS must keep at least one >1yr span",
  );
  assert.ok(YEARS_BETWEEN.some(([y]) => y > 1));
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
