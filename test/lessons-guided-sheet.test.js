// Guided-tutorial metadata coverage for the 11 Excel/sheet lessons: every
// lesson must run in "guided" mode with voice enabled, every step needs a
// spotlightLabel that passes basic STOP-SLOP hygiene, and every step whose
// grader names a specific cell must have a matching sheet-cell target so the
// spotlight overlay can find it.

import { test } from "node:test";
import assert from "node:assert/strict";

import { createLesson } from "../lib/guide/spec.js";

import excelPivot from "../lib/guide/lessons/excel-pivot.js";
import excelXlookup from "../lib/guide/lessons/excel-xlookup.js";
import excelIndexMatch from "../lib/guide/lessons/excel-index-match.js";
import excelIferror from "../lib/guide/lessons/excel-iferror.js";
import excelCountifs from "../lib/guide/lessons/excel-countifs.js";
import excelIfIfs from "../lib/guide/lessons/excel-if-ifs.js";
import excelReferences from "../lib/guide/lessons/excel-references.js";
import excelStats from "../lib/guide/lessons/excel-stats.js";
import excelCleaning from "../lib/guide/lessons/excel-cleaning.js";
import excelLookupReverse from "../lib/guide/lessons/excel-lookup-reverse.js";
import excelPivotRates from "../lib/guide/lessons/excel-pivot-rates.js";

const SHEET_LESSONS = [
  excelPivot,
  excelXlookup,
  excelIndexMatch,
  excelIferror,
  excelCountifs,
  excelIfIfs,
  excelReferences,
  excelStats,
  excelCleaning,
  excelLookupReverse,
  excelPivotRates,
];

/**
 * Depth-first search for the first cellValue/cellFormula grader inside a
 * (possibly composite allOf/anyOf) grader tree — this is the cell the
 * lesson's target is authored against.
 * @param {object} grader a GraderDescriptor
 * @returns {object|null} the first cellValue/cellFormula descendant, or null
 */
function firstCellGrader(grader) {
  if (!grader || typeof grader !== "object") return null;
  if (grader.type === "cellValue" || grader.type === "cellFormula") return grader;
  if ((grader.type === "allOf" || grader.type === "anyOf") && Array.isArray(grader.of)) {
    for (const child of grader.of) {
      const found = firstCellGrader(child);
      if (found) return found;
    }
  }
  return null;
}

test("every excel/sheet lesson runs in guided mode with voice on", () => {
  for (const lesson of SHEET_LESSONS) {
    assert.equal(lesson.mode, "guided", `${lesson.id}: mode should be "guided"`);
    assert.equal(lesson.voice, true, `${lesson.id}: voice should be true`);
  }
});

test("every step's spotlightLabel is clean, non-empty, and reasonably short", () => {
  for (const lesson of SHEET_LESSONS) {
    for (const step of lesson.steps) {
      const label = step.spotlightLabel;
      assert.equal(typeof label, "string", `${lesson.id}/${step.id}: spotlightLabel must be a string`);
      assert.ok(label.trim().length > 0, `${lesson.id}/${step.id}: spotlightLabel must be non-empty`);
      assert.ok(label.length <= 80, `${lesson.id}/${step.id}: spotlightLabel too long (${label.length})`);
      assert.ok(!label.includes("—"), `${lesson.id}/${step.id}: spotlightLabel must not contain an em-dash`);
    }
  }
});

test("every cell-graded step points its spotlight at the cell the learner acts on", () => {
  // The spotlight target is a UI anchor, NOT the grader's verification cell.
  // A "load" or "fill down" step grades a downstream cell (e.g. the last row
  // A101/H101) but the learner acts at the start (A1/H2), so the target must
  // be a real cell the step actually directs the learner to — named in the
  // step's spotlightLabel or instruction — not blindly copied from the grader.
  const CELL_RE = /\b[A-Z]{1,3}[0-9]{1,4}\b/g;
  for (const lesson of SHEET_LESSONS) {
    for (const step of lesson.steps) {
      const cellGrader = firstCellGrader(step.grader);
      if (!cellGrader) continue; // rangeValues/pivotSpec/pivotResult/predicate-only steps: no single cell to anchor
      assert.ok(step.target, `${lesson.id}/${step.id}: expected a target for a cell-graded step`);
      assert.equal(step.target.kind, "sheet-cell", `${lesson.id}/${step.id}: target.kind should be sheet-cell`);
      assert.ok(
        /^[A-Z]{1,3}[0-9]{1,4}$/.test(step.target.ref),
        `${lesson.id}/${step.id}: target.ref "${step.target.ref}" is not a valid cell reference`,
      );
      // The targeted cell must be one the step tells the learner about, so the
      // spotlight never lands on a cell they were never directed to touch.
      const prose = `${step.spotlightLabel ?? ""} ${step.instruction ?? ""}`;
      const named = new Set(prose.match(CELL_RE) ?? []);
      assert.ok(
        named.has(step.target.ref),
        `${lesson.id}/${step.id}: target.ref "${step.target.ref}" is not named in the label/instruction (${[...named].join(", ") || "no cells named"})`,
      );
    }
  }
});

test("every step without a cell-specific grader still has some target (selector or omitted)", () => {
  for (const lesson of SHEET_LESSONS) {
    for (const step of lesson.steps) {
      const cellGrader = firstCellGrader(step.grader);
      if (cellGrader) continue;
      if (step.target === null || step.target === undefined) continue; // omission is valid
      assert.equal(step.target.kind, "selector", `${lesson.id}/${step.id}: non-cell step target should be a selector`);
      assert.ok(step.target.selector, `${lesson.id}/${step.id}: selector target needs a selector string`);
    }
  }
});

test("every excel/sheet lesson still validates through createLesson()", () => {
  for (const lesson of SHEET_LESSONS) {
    assert.doesNotThrow(() => createLesson(lesson), `${lesson.id} should re-validate cleanly`);
  }
});
