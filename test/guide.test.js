import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  HINT_RUNGS, MAX_HINTS, GRADER_TYPES, TOOL_KINDS,
  validateLesson, createLesson,
} from "../lib/guide/spec.js";
import { grade, GRADERS, resolveSheet, toPlain } from "../lib/guide/graders.js";
import {
  createSession, currentStep, submitStep, requestHint, skipStep, goToStep,
  isComplete, lessonScore, hintPenalty, HINT_PENALTIES,
  attemptPenalty, ATTEMPT_PENALTY_FLOOR,
  serializeSession, deserializeSession,
} from "../lib/guide/runner.js";
import { checkpointForStep, materializeCheckpoint, startingState } from "../lib/guide/checkpoints.js";

import { lesson as pivotLesson } from "../lib/guide/lessons/excel-pivot.js";
import { lesson as xlookupLesson, REGIONS } from "../lib/guide/lessons/excel-xlookup.js";
import { lesson as barsLesson, EXPECTED_RATES } from "../lib/guide/lessons/tableau-bars.js";

import { createSheet, setCell, setCells, copyCell, loadCsv, getValue } from "../lib/sheet/model.js";
import { Shelf, putOnShelf, createEncoding } from "../lib/viz/spec.js";
import { makeField, FieldType, createCalculatedField } from "../lib/viz/fields.js";
import { GUIDE_RESOURCES } from "../data/guide-resources.js";

// --- Fixtures ----------------------------------------------------------------

const HMDA_PATH = fileURLToPath(new URL("../public/data/hmda-sample.csv", import.meta.url));
const HMDA_CSV = readFileSync(HMDA_PATH, "utf8");
/* The SHIPPED resource map (data/guide-resources.js), not a local copy.
   Four test files each kept their own one-entry copy, so registering the
   governance labs broke nine tests across three files with the same
   "missing resource" error. Importing the real map means a new dataset is
   one edit, and a test can never hold an older view of what the app ships. */
const RESOURCES = GUIDE_RESOURCES;

/** The materialized tool state for entering step `i` of a lesson. */
function stateFor(lesson, i) {
  return startingState(lesson, i, RESOURCES).toolState;
}

const COUNT_VALUE = { field: "applicant_id", agg: "count" };
const RATE_VALUE = { field: "applicant_id", agg: "count", showAs: "percentOfRowTotal" };
const PIVOT_FINAL = { rows: ["race"], cols: ["approved"], values: [RATE_VALUE] };

function pivotState(spec) {
  return { pivot: { sourceRange: "A1:G101", spec } };
}

// ==============================================================================
describe("guide/spec: the GuidedLesson format", () => {
  const validStep = {
    instruction: "do it",
    checkpoint: { tool: "sheet", sheets: [{ name: "S" }] },
    grader: { type: "cellValue", ref: "A1", expected: 1 },
  };

  test("a minimal valid lesson validates", () => {
    const r = validateLesson({ id: "x", title: "X", tool: "sheet", steps: [validStep] });
    assert.deepEqual(r, { valid: true, errors: [] });
  });

  test("rejects missing id, bad tool, empty steps", () => {
    const r = validateLesson({ title: "X", tool: "excel", steps: [] });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("lesson.id")));
    assert.ok(r.errors.some((e) => e.includes("lesson.tool")));
    assert.ok(r.errors.some((e) => e.includes("steps")));
  });

  test("rejects a step without instruction and an unknown grader type", () => {
    const r = validateLesson({
      id: "x", title: "X", tool: "sheet",
      steps: [{ checkpoint: validStep.checkpoint, grader: { type: "magic" } }],
    });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("instruction")));
    assert.ok(r.errors.some((e) => e.includes('unknown grader type "magic"')));
  });

  test("rejects duplicate step ids and more than 4 hints", () => {
    const r = validateLesson({
      id: "x", title: "X", tool: "sheet",
      steps: [
        { ...validStep, id: "a" },
        { ...validStep, id: "a", hints: ["1", "2", "3", "4", "5"] },
      ],
    });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('duplicate step id "a"')));
    assert.ok(r.errors.some((e) => e.includes(`at most ${MAX_HINTS} hints`)));
  });

  test("the first step must carry a checkpoint", () => {
    const r = validateLesson({
      id: "x", title: "X", tool: "sheet",
      steps: [{ instruction: "do", grader: validStep.grader }],
    });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("steps[0]")));
  });

  test("grader parameter validation reaches into allOf children", () => {
    const r = validateLesson({
      id: "x", title: "X", tool: "sheet",
      steps: [{ ...validStep, grader: { type: "allOf", of: [{ type: "cellValue" }] } }],
    });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes("of[0]") && e.includes("ref")));
  });

  test("createLesson normalizes ids/hints and throws on invalid input", () => {
    const lesson = createLesson({ id: "x", title: "X", tool: "sheet", steps: [validStep] });
    assert.equal(lesson.steps[0].id, "step-1");
    assert.deepEqual(lesson.steps[0].hints, []);
    assert.throws(() => createLesson({ id: "x", title: "X", tool: "nope", steps: [validStep] }), /Invalid guided lesson/);
  });

  test("GRADER_TYPES and the GRADERS registry agree", () => {
    assert.deepEqual([...GRADER_TYPES].sort(), Object.keys(GRADERS).sort());
    assert.equal(HINT_RUNGS.length, MAX_HINTS);
    assert.deepEqual(TOOL_KINDS, ["sheet", "viz"]);
  });

  test("all three exemplar lessons validate against the format", () => {
    for (const lesson of [pivotLesson, xlookupLesson, barsLesson]) {
      assert.deepEqual(validateLesson(lesson), { valid: true, errors: [] }, lesson.id);
      assert.ok(lesson.steps[0].checkpoint, `${lesson.id} step 0 checkpoint`);
    }
  });
});

// ==============================================================================
describe("graders: cellValue", () => {
  function sheetState() {
    const sheet = createSheet();
    setCells(sheet, { A1: 10, A2: "=A1/0", A3: "'  Midwest ", B1: "=A1*2" });
    return sheet;
  }

  test("numeric match with tolerance", () => {
    const r = grade(sheetState(), { type: "cellValue", ref: "B1", expected: 20 + 1e-12 });
    assert.equal(r.pass, true);
    assert.equal(r.score, 1);
  });

  test("numeric mismatch produces a wrong diff with both values", () => {
    const r = grade(sheetState(), { type: "cellValue", ref: "B1", expected: 42 });
    assert.equal(r.pass, false);
    assert.equal(r.diff[0].kind, "wrong");
    assert.equal(r.diff[0].path, "B1");
    assert.equal(r.diff[0].actual, 20);
    assert.equal(r.diff[0].expected, 42);
    assert.match(r.message, /B1 shows 20; expected 42/);
  });

  test("strings compare trimmed and case-insensitively by default", () => {
    assert.equal(grade(sheetState(), { type: "cellValue", ref: "A3", expected: "midwest" }).pass, true);
    assert.equal(
      grade(sheetState(), { type: "cellValue", ref: "A3", expected: "midwest", caseSensitive: true }).pass,
      false
    );
  });

  test("an expected Excel error code must actually be that error", () => {
    assert.equal(grade(sheetState(), { type: "cellValue", ref: "A2", expected: "#DIV/0!" }).pass, true);
    const r = grade(sheetState(), { type: "cellValue", ref: "A2", expected: 5 });
    assert.equal(r.pass, false);
    assert.match(r.message, /#DIV\/0!/);
    assert.match(r.message, /division by zero/);
  });

  test("a blank cell is a 'missing' diff, and results are JSON-safe", () => {
    const r = grade(sheetState(), { type: "cellValue", ref: "Z9", expected: 1 });
    assert.equal(r.diff[0].kind, "missing");
    const err = grade(sheetState(), { type: "cellValue", ref: "A2", expected: 5 });
    assert.deepEqual(JSON.parse(JSON.stringify(err)), err); // FormulaError became its code
    assert.equal(err.actual, "#DIV/0!");
  });
});

// ==============================================================================
describe("graders: cellFormula (method grading)", () => {
  test("the hardcode-42 case: right value typed by hand is a method failure", () => {
    const sheet = createSheet();
    setCell(sheet, "C1", 42);
    const r = grade(sheet, { type: "cellFormula", ref: "C1", mustUse: ["SUM"], expectedValue: 42 });
    assert.equal(r.pass, false);
    assert.equal(r.diff[0].kind, "method");
    assert.match(r.message, /typed in by hand/);
  });

  test("a plain value without the right answer just asks for a formula", () => {
    const sheet = createSheet();
    setCell(sheet, "C1", "hello");
    const r = grade(sheet, { type: "cellFormula", ref: "C1", mustUse: ["SUM"] });
    assert.match(r.message, /start with =/);
  });

  // THE HOLE mustUse alone leaves: it proves a function NAME is present, never
  // that the function touched the data. =AVERAGE(0.76) satisfied
  // mustUse:["AVERAGE"] + expectedValue:0.76 on a step whose whole point was
  // averaging a column of flags — the learner hardcodes the answer INSIDE the
  // call and "masters" the step. Verified against the real engine on
  // stats-probability; the pre-existing excel-stats had the same shape.
  // The sentinel holes checked too few CELLS; this one checked too little of
  // the FORMULA.
  test("a method-graded formula must actually read the sheet", () => {
    const sheet = createSheet();
    setCells(sheet, { A1: 1, A2: 2 });

    setCell(sheet, "C1", "=AVERAGE(1.5)");
    const literal = grade(sheet, { type: "cellFormula", ref: "C1", mustUse: ["AVERAGE"], expectedValue: 1.5 });
    assert.equal(literal.pass, false, "hardcoding the answer inside AVERAGE() must not pass a method-graded step");
    assert.equal(literal.diff[0].kind, "method");
    assert.match(literal.diff[0].hint, /never reads the sheet/);

    setCell(sheet, "C1", "=AVERAGE(A1:A2)");
    assert.equal(
      grade(sheet, { type: "cellFormula", ref: "C1", mustUse: ["AVERAGE"], expectedValue: 1.5 }).pass,
      true,
      "the intended solution must still pass — a grader that rejects a correct answer is worse than the hole",
    );
  });

  test("allowLiteral opts a step out, for the rare constant-only computation", () => {
    const sheet = createSheet();
    setCell(sheet, "C1", "=ROUND(2/3, 2)");
    assert.equal(
      grade(sheet, { type: "cellFormula", ref: "C1", mustUse: ["ROUND"], expectedValue: 0.67, allowLiteral: true }).pass,
      true,
    );
  });

  test("the data-reference gate does not disturb partial credit", () => {
    // It is a GATE, not a scored dimension. Adding it to the checks list moved
    // value-right/method-wrong from 1/2 to 2/3 and broke the contract below.
    const sheet = createSheet();
    setCells(sheet, { A1: 1, A2: 2, C1: "=SUM(A1:A2)" });
    const r = grade(sheet, { type: "cellFormula", ref: "C1", mustUse: ["XLOOKUP"], expectedValue: 3 });
    assert.equal(r.score, 0.5, "value right, method wrong is still 1 of 2");
  });

  test("mustUse / mustNotUse / expectedValue give partial credit", () => {
    const sheet = createSheet();
    setCells(sheet, { A1: 1, A2: 2, C1: "=SUM(A1:A2)" });
    assert.equal(grade(sheet, { type: "cellFormula", ref: "C1", mustUse: ["SUM"], expectedValue: 3 }).pass, true);

    const wrongFn = grade(sheet, { type: "cellFormula", ref: "C1", mustUse: ["XLOOKUP"], expectedValue: 3 });
    assert.equal(wrongFn.pass, false);
    assert.equal(wrongFn.score, 0.5); // value right, method wrong
    assert.match(wrongFn.diff[0].hint, /must use XLOOKUP/);

    const banned = grade(sheet, { type: "cellFormula", ref: "C1", mustNotUse: ["SUM"] });
    assert.equal(banned.pass, false);
    assert.match(banned.diff[0].hint, /without SUM/);
  });

  test("an empty cell is 'missing', not 'method'", () => {
    const r = grade(createSheet(), { type: "cellFormula", ref: "C1", mustUse: ["SUM"] });
    assert.equal(r.diff[0].kind, "missing");
  });

  test("function detection does not false-positive on substrings", () => {
    const sheet = createSheet();
    setCells(sheet, { A1: 1, C1: "=XLOOKUP(A1, A1:A1, A1:A1)" });
    assert.equal(grade(sheet, { type: "cellFormula", ref: "C1", mustUse: ["LOOKUP"] }).pass, false);
    assert.equal(grade(sheet, { type: "cellFormula", ref: "C1", mustUse: ["XLOOKUP"] }).pass, true);
  });
});

// ==============================================================================
describe("graders: rangeValues", () => {
  function sheetState() {
    const sheet = createSheet();
    setCells(sheet, { B2: "a", C2: "b", B3: 1, C3: 2 });
    return sheet;
  }

  test("a matching region passes", () => {
    const r = grade(sheetState(), { type: "rangeValues", range: "B2:C3", expected: [["a", "b"], [1, 2]] });
    assert.equal(r.pass, true);
  });

  test("mismatches carry real A1 addresses and partial credit", () => {
    const r = grade(sheetState(), { type: "rangeValues", range: "B2:C3", expected: [["a", "b"], [1, 99]] });
    assert.equal(r.pass, false);
    assert.equal(r.score, 0.75);
    assert.equal(r.diff.length, 1);
    assert.equal(r.diff[0].path, "C3");
    assert.match(r.message, /1 of 4 cells/);
  });

  test("maxDiffs caps the diff list but not the score", () => {
    const sheet = createSheet();
    setCells(sheet, { A1: 0, A2: 0, A3: 0, A4: 0 });
    const r = grade(sheet, { type: "rangeValues", range: "A1:A4", expected: [[1], [1], [1], [1]], maxDiffs: 2 });
    assert.equal(r.diff.length, 2);
    assert.equal(r.score, 0);
  });
});

// ==============================================================================
describe("graders: predicate, allOf, anyOf", () => {
  const pass = { type: "predicate", fn: () => true, label: "Always" };
  const fail = { type: "predicate", fn: () => false, label: "Never" };

  test("boolean predicates are normalized into full results", () => {
    assert.equal(grade({}, pass).pass, true);
    const r = grade({}, fail);
    assert.equal(r.pass, false);
    assert.match(r.message, /Never failed/);
    assert.equal(r.diff.length, 1);
  });

  test("object predicates pass through score/diff/message", () => {
    const r = grade({}, {
      type: "predicate",
      fn: () => ({ pass: false, score: 0.4, message: "almost", diff: [{ kind: "wrong", path: "x", hint: "h" }] }),
    });
    assert.equal(r.score, 0.4);
    assert.equal(r.message, "almost");
    assert.equal(r.diff[0].path, "x");
  });

  test("allOf means every check, with the mean score and merged diff", () => {
    const r = grade({}, { type: "allOf", of: [pass, fail] });
    assert.equal(r.pass, false);
    assert.equal(r.score, 0.5);
    assert.equal(r.diff.length, 1);
    assert.match(r.message, /Never failed/);
  });

  test("anyOf passes when one route passes", () => {
    assert.equal(grade({}, { type: "anyOf", of: [fail, pass] }).pass, true);
    assert.equal(grade({}, { type: "anyOf", of: [fail, fail] }).pass, false);
  });

  test("unknown grader types throw (author error, not user error)", () => {
    assert.throws(() => grade({}, { type: "nope" }), /unknown grader type/);
  });
});

// ==============================================================================
describe("graders: pivotSpec equivalence (the documented rules)", () => {
  test("an exactly matching spec passes", () => {
    const r = grade(pivotState(PIVOT_FINAL), { type: "pivotSpec", expected: PIVOT_FINAL });
    assert.equal(r.pass, true);
  });

  test("values are ORDER-INSENSITIVE", () => {
    const expected = { rows: ["race"], values: [COUNT_VALUE, { field: "loan_amount", agg: "average" }] };
    const user = pivotState({ rows: ["race"], values: [{ field: "loan_amount", agg: "average" }, COUNT_VALUE] });
    assert.equal(grade(user, { type: "pivotSpec", expected }).pass, true);
  });

  test("labels are cosmetic and agg defaults to count", () => {
    const user = pivotState({ rows: ["race"], values: [{ field: "applicant_id", label: "How many" }] });
    assert.equal(grade(user, { type: "pivotSpec", expected: { rows: ["race"], values: [COUNT_VALUE] } }).pass, true);
  });

  test("rows/cols swap is diagnosed as misplaced, in words", () => {
    const user = pivotState({ rows: ["approved"], cols: ["race"], values: [COUNT_VALUE] });
    const r = grade(user, { type: "pivotSpec", expected: { rows: ["race"], cols: ["approved"], values: [COUNT_VALUE] } });
    assert.equal(r.pass, false);
    const misplaced = r.diff.filter((d) => d.kind === "misplaced");
    assert.equal(misplaced.length, 2);
    assert.match(misplaced[0].hint, /You put race on Columns; the task asked for it on Rows\./);
  });

  test("row NESTING ORDER matters", () => {
    const user = pivotState({ rows: ["gender", "race"], values: [COUNT_VALUE] });
    const r = grade(user, { type: "pivotSpec", expected: { rows: ["race", "gender"], values: [COUNT_VALUE] } });
    assert.equal(r.pass, false);
    const order = r.diff.find((d) => d.path === "rows.order");
    assert.ok(order);
    assert.match(order.hint, /race then gender/);
  });

  test("a missing showAs teaches the Show Values As move", () => {
    const user = pivotState({ rows: ["race"], cols: ["approved"], values: [COUNT_VALUE] });
    const r = grade(user, { type: "pivotSpec", expected: PIVOT_FINAL });
    assert.equal(r.pass, false);
    assert.ok(r.score > 0.5); // rows and cols are right — partial credit
    assert.match(r.message, /Show Values As.*% of Row Total/);
  });

  test("a wrong aggregation names both aggs; extras are flagged", () => {
    const user = pivotState({ rows: ["race"], values: [{ field: "applicant_id", agg: "sum" }, { field: "income", agg: "max" }] });
    const r = grade(user, { type: "pivotSpec", expected: { rows: ["race"], values: [COUNT_VALUE] } });
    assert.equal(r.pass, false);
    assert.ok(r.diff.some((d) => d.path === "values.applicant_id.agg" && /sum/.test(d.hint) && /count/.test(d.hint)));
    assert.ok(r.diff.some((d) => d.kind === "extra" && /Max of income/.test(d.hint)));
  });

  test('a "*" value field accepts any field with the right agg', () => {
    const user = pivotState({ rows: ["race"], values: [{ field: "race", agg: "count" }] });
    const r = grade(user, { type: "pivotSpec", expected: { rows: ["race"], values: [{ field: "*", agg: "count" }] } });
    assert.equal(r.pass, true);
  });

  test("filters match case-insensitively as value sets; extra filters are flagged", () => {
    const expected = { rows: ["race"], values: [COUNT_VALUE], filters: { gender: ["Female"] } };
    const okState = pivotState({ rows: ["race"], values: [COUNT_VALUE], filters: { gender: "female" } });
    assert.equal(grade(okState, { type: "pivotSpec", expected }).pass, true);

    const extraState = pivotState({ rows: ["race"], values: [COUNT_VALUE], filters: { gender: "Female", approved: "APPROVED" } });
    const r = grade(extraState, { type: "pivotSpec", expected });
    assert.equal(r.pass, false);
    assert.ok(r.diff.some((d) => d.kind === "extra" && d.path === "filters.approved"));
  });

  test("no pivot at all says so plainly", () => {
    const r = grade({ pivot: null }, { type: "pivotSpec", expected: PIVOT_FINAL });
    assert.match(r.message, /No pivot table yet/);
  });
});

// ==============================================================================
describe("graders: pivotResult grades the OUTPUT over the real HMDA data", () => {
  function hmdaPivotState(spec) {
    const ts = stateFor(pivotLesson, 1); // loaded sheet + empty pivot panel
    ts.pivot.spec = spec;
    return ts;
  }

  test("a different route to the same table passes (count of race, not applicant_id)", () => {
    const ts = hmdaPivotState({ rows: ["race"], cols: ["approved"], values: [{ field: "race", agg: "count", showAs: "percentOfRowTotal" }] });
    const r = grade(ts, { type: "pivotResult", expected: PIVOT_FINAL });
    assert.equal(r.pass, true, r.message);
  });

  test("a transposed table is called out as transposed", () => {
    const ts = hmdaPivotState({ rows: ["approved"], cols: ["race"], values: [RATE_VALUE] });
    const r = grade(ts, { type: "pivotResult", expected: PIVOT_FINAL });
    assert.equal(r.pass, false);
    assert.equal(r.score, 0.5);
    assert.match(r.message, /transposed/);
  });

  test("raw counts instead of rates: cell diffs carry the count-vs-rate heuristic", () => {
    const ts = hmdaPivotState({ rows: ["race"], cols: ["approved"], values: [COUNT_VALUE] });
    const r = grade(ts, { type: "pivotResult", expected: PIVOT_FINAL });
    assert.equal(r.pass, false);
    assert.ok(r.diff.some((d) => /raw count.*Show Values As/.test(d.hint)));
  });

  test("grouping by the wrong field loses the expected rows", () => {
    const ts = hmdaPivotState({ rows: ["gender"], cols: ["approved"], values: [RATE_VALUE] });
    const r = grade(ts, { type: "pivotResult", expected: PIVOT_FINAL });
    assert.equal(r.pass, false);
    assert.ok(r.diff.some((d) => d.kind === "missing" && /"Black" row/.test(d.hint)));
  });

  test("the correct pivot reproduces the verified disparity numbers", () => {
    const ts = hmdaPivotState(PIVOT_FINAL);
    const r = grade(ts, { type: "pivotResult", expected: PIVOT_FINAL });
    assert.equal(r.pass, true);
    // and the source numbers really are the curriculum's ground truth
    const check = grade(ts, {
      type: "pivotResult",
      expected: { rows: ["race"], cols: ["approved"], values: [COUNT_VALUE] },
    });
    assert.equal(check.pass, false); // counts ≠ rates: the grader can tell
  });
});

// ==============================================================================
describe("graders: vizSpec and vizData", () => {
  const CALC = { name: "is_approved", expression: 'IF([approved] = "APPROVED", 1, 0)' };
  const AVG_PILL = { field: "is_approved", aggregation: "AVG" };

  function vizState(extra) {
    return materializeCheckpoint({ tool: "viz", data: { resource: "hmda-sample.csv" }, calculatedFields: [CALC], ...extra }, RESOURCES);
  }

  test("the canonical answer passes both method and outcome", () => {
    const ts = vizState({ shelves: { columns: ["race"], rows: [AVG_PILL] } });
    assert.equal(grade(ts, { type: "vizSpec", expected: { mark: "bar", columns: ["race"], rows: [AVG_PILL] } }).pass, true);
    assert.equal(grade(ts, { type: "vizData", expected: EXPECTED_RATES, keyFields: ["race"] }).pass, true);
  });

  test("the assignment's example: a pill on the wrong shelf reads as a sentence", () => {
    const ts = vizState({ shelves: { rows: ["race"] } });
    const r = grade(ts, { type: "vizSpec", expected: { columns: ["race"] } });
    assert.equal(r.pass, false);
    assert.equal(r.diff[0].kind, "misplaced");
    assert.equal(r.diff[0].hint, "You put race on Rows; the task asked for it on Columns.");
  });

  test("wrong aggregation names both and says how to fix it", () => {
    const ts = vizState({ shelves: { columns: ["race"], rows: [{ field: "is_approved", aggregation: "COUNT" }] } });
    const r = grade(ts, { type: "vizSpec", expected: { columns: ["race"], rows: [AVG_PILL] } });
    assert.equal(r.pass, false);
    assert.ok(r.score > 0.5); // the pills are on the right shelves
    assert.equal(r.diff[0].path, "rows.is_approved.aggregation");
    assert.match(r.diff[0].hint, /aggregated with COUNT.*asks for AVG/);
  });

  test("a missing pill asks for the drag; mark mismatch names both marks", () => {
    const ts = vizState({ shelves: { columns: ["race"], rows: [AVG_PILL] }, mark: "text" });
    const missing = grade(ts, { type: "vizSpec", expected: { color: ["gender"] } });
    assert.match(missing.diff[0].hint, /Drag gender to Color\./);

    const mark = grade(ts, { type: "vizSpec", expected: { mark: "bar" } });
    assert.match(mark.diff[0].hint, /uses the text mark.*asks for bar/);
  });

  test("Automatic mark that resolves to bar satisfies mark: 'bar'", () => {
    const ts = vizState({ shelves: { columns: ["race"], rows: [AVG_PILL] } }); // no explicit mark
    assert.equal(grade(ts, { type: "vizSpec", expected: { mark: "bar" } }).pass, true);
  });

  test("vizData grades the outcome: SUM instead of AVG fails with the computed caption named", () => {
    const ts = vizState({ shelves: { columns: ["race"], rows: [{ field: "is_approved", aggregation: "SUM" }] } });
    const r = grade(ts, { type: "vizData", expected: EXPECTED_RATES, keyFields: ["race"] });
    assert.equal(r.pass, false);
    assert.match(r.diff[0].hint, /the view computes SUM\(is_approved\), not AVG\(is_approved\)/);
  });

  test("vizData notices filtered-out groups", () => {
    const ts = vizState({
      shelves: { columns: ["race"], rows: [AVG_PILL] },
      filters: [{ type: "categorical", field: "race", include: ["White"] }],
    });
    const r = grade(ts, { type: "vizData", expected: EXPECTED_RATES, keyFields: ["race"] });
    assert.equal(r.pass, false);
    assert.match(r.message, /No mark for race = American Indian/);
  });

  test("no view yet fails gently", () => {
    const r = grade({}, { type: "vizSpec", expected: { columns: ["race"] } });
    assert.match(r.message, /No view yet/);
  });
});

// ==============================================================================
describe("exemplar: excel-pivot, graded against right and wrong solutions", () => {
  test("the correct path walks all four steps to a perfect score", () => {
    let session = createSession(pivotLesson);

    // Step 1: the user loads the CSV into the empty sheet.
    const s1 = stateFor(pivotLesson, 0);
    loadCsv(s1.sheets.Data, HMDA_CSV);
    let out = submitStep(session, pivotLesson, s1);
    assert.equal(out.result.pass, true, out.result.message);
    session = out.session;

    // Step 2: race on Rows, Count of applicant_id on Values.
    const s2 = stateFor(pivotLesson, 1);
    s2.pivot.spec = { rows: ["race"], cols: [], values: [COUNT_VALUE], filters: {} };
    out = submitStep(session, pivotLesson, s2);
    assert.equal(out.result.pass, true, out.result.message);
    session = out.session;

    // Step 3: approved on Columns.
    const s3 = stateFor(pivotLesson, 2);
    s3.pivot.spec = { rows: ["race"], cols: ["approved"], values: [COUNT_VALUE], filters: {} };
    out = submitStep(session, pivotLesson, s3);
    assert.equal(out.result.pass, true, out.result.message);
    session = out.session;

    // Step 4: Show Values As % of Row Total.
    const s4 = stateFor(pivotLesson, 3);
    s4.pivot.spec = { rows: ["race"], cols: ["approved"], values: [RATE_VALUE], filters: {} };
    out = submitStep(session, pivotLesson, s4);
    assert.equal(out.result.pass, true, out.result.message);
    session = out.session;

    assert.equal(isComplete(session), true);
    assert.equal(lessonScore(session, pivotLesson).score, 1);
  });

  test("wrong: pivoting on gender is told to bring race to Rows", () => {
    const ts = stateFor(pivotLesson, 1);
    ts.pivot.spec = { rows: ["gender"], cols: [], values: [COUNT_VALUE], filters: {} };
    const r = grade(ts, pivotLesson.steps[1].grader);
    assert.equal(r.pass, false);
    assert.equal(r.message, "Drag race to Rows.");
    assert.ok(r.diff.some((d) => d.kind === "extra" && /gender/.test(d.hint)));
  });

  test("wrong: Sum of loan_amount instead of a count", () => {
    const ts = stateFor(pivotLesson, 1);
    ts.pivot.spec = { rows: ["race"], cols: [], values: [{ field: "loan_amount", agg: "sum" }], filters: {} };
    const r = grade(ts, pivotLesson.steps[1].grader);
    assert.equal(r.pass, false);
    assert.ok(r.score > 0); // race on Rows still earns credit
    assert.match(r.message, /Count of applicant_id/);
  });

  test("wrong: forgetting Show Values As on the final step fails BOTH method and outcome", () => {
    const ts = stateFor(pivotLesson, 3);
    ts.pivot.spec = { rows: ["race"], cols: ["approved"], values: [COUNT_VALUE], filters: {} };
    const r = grade(ts, pivotLesson.steps[3].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /Show Values As/);
    // the outcome half also failed: cell diffs exist alongside the spec diff
    assert.ok(r.diff.some((d) => d.path.includes("×")));
  });

  test("wrong: a transposed final table is diagnosed by the outcome grader", () => {
    const ts = stateFor(pivotLesson, 3);
    ts.pivot.spec = { rows: ["approved"], cols: ["race"], values: [RATE_VALUE], filters: {} };
    const r = grade(ts, pivotLesson.steps[3].grader);
    assert.equal(r.pass, false);
    assert.ok(r.diff.some((d) => /transposed/.test(d.hint)));
  });
});

// ==============================================================================
describe("exemplar: excel-xlookup, graded against right and wrong solutions", () => {
  const PINNED = "=XLOOKUP(D2, $J$2:$J$23, $K$2:$K$23)";

  function fillDown(sheet, formula) {
    setCell(sheet, "H2", formula);
    for (let r = 3; r <= 101; r++) copyCell(sheet, "H2", `H${r}`);
  }

  test("the checkpoint preserves leading-zero ZIP codes as text on both tables", () => {
    const ts = stateFor(xlookupLesson, 1);
    const app = resolveSheet(ts, "Applicants");
    assert.equal(getValue(app, "D5"), "02138"); // A0004 lives in Cambridge
    assert.equal(getValue(app, "J2"), "02138"); // linked Regions table agrees
    assert.equal(typeof getValue(app, "D2"), "number"); // 48217 is numeric both sides
    assert.equal(typeof getValue(app, "J8"), "number");
  });

  test("step 1: completing the Regions tab", () => {
    const ts = stateFor(xlookupLesson, 0);
    assert.equal(grade(ts, xlookupLesson.steps[0].grader).pass, false); // B4 starts blank
    setCell(ts.sheets.Regions, "B4", "Northeast");
    assert.equal(grade(ts, xlookupLesson.steps[0].grader).pass, true);
  });

  test("step 2: the pinned XLOOKUP passes; Detroit is in the Midwest", () => {
    const ts = stateFor(xlookupLesson, 1);
    setCell(ts.sheets.Applicants, "H2", PINNED);
    const r = grade(ts, xlookupLesson.steps[1].grader);
    assert.equal(r.pass, true, r.message);
  });

  test("step 2 wrong: hand-typing the region is a METHOD failure even though the value is right", () => {
    const ts = stateFor(xlookupLesson, 1);
    setCell(ts.sheets.Applicants, "H2", "Midwest");
    const r = grade(ts, xlookupLesson.steps[1].grader);
    assert.equal(r.pass, false);
    assert.equal(r.diff[0].kind, "method");
    assert.match(r.message, /typed in by hand/);
  });

  test("step 2 wrong: VLOOKUP gets the right value but not the lesson", () => {
    const ts = stateFor(xlookupLesson, 1);
    setCell(ts.sheets.Applicants, "H2", "=VLOOKUP(D2, $J$2:$K$23, 2, FALSE)");
    const r = grade(ts, xlookupLesson.steps[1].grader);
    assert.equal(r.pass, false);
    assert.ok(r.score > 0); // the value check still passes
    assert.match(r.message, /must use XLOOKUP/);
    assert.ok(r.diff.some((d) => /VLOOKUP/.test(d.hint)));
  });

  test("step 3: a pinned fill-down satisfies the outcome predicate for all 100 rows", () => {
    const ts = stateFor(xlookupLesson, 2);
    fillDown(ts.sheets.Applicants, PINNED);
    const r = grade(ts, xlookupLesson.steps[2].grader);
    assert.equal(r.pass, true, r.message);
  });

  test("step 3 wrong: unpinned ranges break part-way down and the feedback says to pin with $", () => {
    const ts = stateFor(xlookupLesson, 2);
    fillDown(ts.sheets.Applicants, "=XLOOKUP(D2, J2:J23, K2:K23)");
    const r = grade(ts, xlookupLesson.steps[2].grader);
    assert.equal(r.pass, false);
    assert.ok(r.score > 0 && r.score < 1); // some rows still resolve
    assert.match(r.message, /pin them with \$/);
    assert.ok(r.diff.some((d) => d.path.startsWith("H")));
  });

  test("step 4: if_not_found turns #N/A into Unknown; omitting it is caught", () => {
    const ts = stateFor(xlookupLesson, 3);
    setCell(ts.sheets.Applicants, "H102", '=XLOOKUP(D102, $J$2:$J$23, $K$2:$K$23, "Unknown")');
    assert.equal(grade(ts, xlookupLesson.steps[3].grader).pass, true);

    const bare = stateFor(xlookupLesson, 3);
    setCell(bare.sheets.Applicants, "H102", "=XLOOKUP(D102, $J$2:$J$23, $K$2:$K$23)");
    const r = grade(bare, xlookupLesson.steps[3].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /#N\/A/);
  });

  test("the Regions fixture covers exactly the 22 ZIP codes in the extract", () => {
    const zips = new Set(HMDA_CSV.trim().split("\n").slice(1).map((line) => line.split(",")[3]));
    assert.equal(REGIONS.length, 22);
    assert.deepEqual([...zips].sort(), REGIONS.map(([z]) => z).sort());
  });
});

// ==============================================================================
describe("exemplar: tableau-bars, graded against right and wrong solutions", () => {
  const EXPR = 'IF([approved] = "APPROVED", 1, 0)';

  test("the correct path walks all four steps to a perfect score", () => {
    let session = createSession(barsLesson);

    const s1 = stateFor(barsLesson, 0);
    s1.spec = { ...s1.spec, calculatedFields: [createCalculatedField("is_approved", EXPR)] };
    let out = submitStep(session, barsLesson, s1);
    assert.equal(out.result.pass, true, out.result.message);
    session = out.session;

    const s2 = stateFor(barsLesson, 1);
    s2.spec = putOnShelf(s2.spec, Shelf.COLUMNS, createEncoding(makeField("race", FieldType.STRING)));
    out = submitStep(session, barsLesson, s2);
    assert.equal(out.result.pass, true, out.result.message);
    session = out.session;

    const s3 = stateFor(barsLesson, 2);
    s3.spec = putOnShelf(s3.spec, Shelf.ROWS, createEncoding(makeField("is_approved", FieldType.NUMBER), { aggregation: "AVG" }));
    out = submitStep(session, barsLesson, s3);
    assert.equal(out.result.pass, true, out.result.message);
    session = out.session;

    const s4 = stateFor(barsLesson, 3); // Automatic mark resolves to bar
    out = submitStep(session, barsLesson, s4);
    assert.equal(out.result.pass, true, out.result.message);
    session = out.session;

    assert.equal(isComplete(session), true);
    assert.equal(lessonScore(session, barsLesson).score, 1);
  });

  test("wrong: a TRUE/FALSE calculated field is diagnosed by name", () => {
    const ts = stateFor(barsLesson, 0);
    ts.spec = { ...ts.spec, calculatedFields: [createCalculatedField("is_approved", '[approved] = "APPROVED"')] };
    const r = grade(ts, barsLesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /TRUE\/FALSE/);
    assert.match(r.message, /IF\(\.\.\., 1, 0\)/);
  });

  test("wrong: a misnamed calculated field is pinned to the exact name", () => {
    const ts = stateFor(barsLesson, 0);
    ts.spec = { ...ts.spec, calculatedFields: [createCalculatedField("approved_flag", EXPR)] };
    const r = grade(ts, barsLesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /approved_flag/);
    assert.match(r.message, /is_approved/);
  });

  test("wrong: a wrong comparison text gets the 76-approvals fact", () => {
    const ts = stateFor(barsLesson, 0);
    ts.spec = { ...ts.spec, calculatedFields: [createCalculatedField("is_approved", 'IF([approved] = "Approved!", 1, 0)')] };
    const r = grade(ts, barsLesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /76 approvals/);
  });

  test("wrong: COUNT instead of AVG on step 3", () => {
    const ts = stateFor(barsLesson, 2);
    ts.spec = putOnShelf(ts.spec, Shelf.ROWS, createEncoding(makeField("is_approved", FieldType.NUMBER), { aggregation: "COUNT" }));
    const r = grade(ts, barsLesson.steps[2].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /asks for AVG/);
  });

  test("wrong: swapping the orientation on step 2 is a misplaced pill", () => {
    const ts = stateFor(barsLesson, 1);
    ts.spec = putOnShelf(ts.spec, Shelf.ROWS, createEncoding(makeField("race", FieldType.STRING)));
    const r = grade(ts, barsLesson.steps[1].grader);
    assert.equal(r.pass, false);
    assert.equal(r.diff[0].kind, "misplaced");
  });

  test("EXPECTED_RATES is the verified ground truth (Black 56.25%, White 86%)", () => {
    const byRace = Object.fromEntries(EXPECTED_RATES.map((r) => [r.race, r["AVG(is_approved)"]]));
    assert.equal(byRace.Black, 0.5625);
    assert.equal(byRace.White, 0.86);
    assert.equal(byRace.Asian, 0.8);
  });
});

// ==============================================================================
describe("runner: hints, attempts, scoring, persistence", () => {
  test("the hint ladder escalates nudge → specific → near-answer → show-me, then exhausts", () => {
    let session = createSession(pivotLesson);
    const labels = [];
    for (let i = 0; i < 5; i++) {
      const { session: next, hint } = requestHint(session, pivotLesson);
      session = next;
      if (hint) labels.push(hint.label);
    }
    assert.deepEqual(labels, HINT_RUNGS);
    assert.equal(session.steps[0].hintsUsed, 4);
    const { hint } = requestHint(session, pivotLesson);
    assert.equal(hint, null); // exhausted, not repeated
  });

  test("hints cost score by the documented penalties", () => {
    assert.deepEqual(HINT_PENALTIES, [1, 0.9, 0.75, 0.55, 0.3]);
    assert.equal(hintPenalty(0), 1);
    assert.equal(hintPenalty(2), 0.75);
    assert.equal(hintPenalty(99), 0.3);

    let session = createSession(xlookupLesson);
    session = requestHint(session, xlookupLesson).session;
    session = requestHint(session, xlookupLesson).session;

    const ts = stateFor(xlookupLesson, 0);
    setCell(ts.sheets.Regions, "B4", "Northeast");
    session = submitStep(session, xlookupLesson, ts).session;

    assert.equal(session.steps[0].status, "passed");
    assert.equal(session.steps[0].score, 0.75);
    assert.equal(lessonScore(session, xlookupLesson).steps[0].credit, 0.75);
  });

  test("failed attempts record attempts, bestScore and a serializable lastResult", () => {
    let session = createSession(pivotLesson);
    session = goToStep(session, pivotLesson, 1).session;

    const ts = stateFor(pivotLesson, 1);
    ts.pivot.spec = { rows: ["gender"], cols: [], values: [COUNT_VALUE], filters: {} };
    session = submitStep(session, pivotLesson, ts).session;
    assert.equal(session.steps[1].attempts, 1);
    assert.ok(session.steps[1].bestScore > 0 && session.steps[1].bestScore < 1);
    assert.equal(session.steps[1].lastResult.pass, false);
    assert.deepEqual(JSON.parse(JSON.stringify(session)), session);

    ts.pivot.spec = { rows: ["race"], cols: [], values: [COUNT_VALUE], filters: {} };
    session = submitStep(session, pivotLesson, ts).session;
    assert.equal(session.steps[1].attempts, 2);
    assert.equal(session.steps[1].status, "passed");
    assert.equal(session.stepIndex, 2);
  });

  test("retry pricing: a blind retry is never cheaper than the mildest hint", () => {
    // The exploit this closes: hints cost 10% but resubmission was free, so
    // guess-and-check strictly dominated asking for help.
    assert.equal(attemptPenalty(1), 1); // the passing submission itself is free
    assert.equal(attemptPenalty(2), 0.9); // one failed retry costs exactly a nudge
    for (let a = 2; a <= 12; a++) {
      assert.ok(attemptPenalty(a) <= HINT_PENALTIES[1], `${a} attempts must cost at least a nudge`);
    }
    assert.equal(attemptPenalty(50), ATTEMPT_PENALTY_FLOOR); // floored at show-me's 0.3
    assert.equal(ATTEMPT_PENALTY_FLOOR, HINT_PENALTIES[HINT_PENALTIES.length - 1]);
  });

  test("retry pricing: submitStep applies the attempt penalty to the passing score (call site)", () => {
    let session = createSession(xlookupLesson);
    const wrong = stateFor(xlookupLesson, 0);
    setCell(wrong.sheets.Regions, "B4", "definitely not a region");
    session = submitStep(session, xlookupLesson, wrong).session; // 1 failed attempt
    const right = stateFor(xlookupLesson, 0);
    setCell(right.sheets.Regions, "B4", "Northeast");
    session = submitStep(session, xlookupLesson, right).session;
    assert.equal(session.steps[0].status, "passed");
    // grade 1.0 x hintPenalty(0)=1 x attemptPenalty(2)=0.9 — the retry was priced.
    assert.equal(session.steps[0].score, 0.9);
  });

  test("skipStep gives up for zero credit and moves on", () => {
    let session = createSession(pivotLesson);
    session = skipStep(session, pivotLesson);
    assert.equal(session.steps[0].status, "skipped");
    assert.equal(session.stepIndex, 1);
    assert.equal(lessonScore(session, pivotLesson).steps[0].credit, 0);
  });

  test("unfinished steps earn half of their best partial credit", () => {
    let session = createSession(pivotLesson);
    session = goToStep(session, pivotLesson, 1).session;
    const ts = stateFor(pivotLesson, 1);
    ts.pivot.spec = { rows: ["race"], cols: [], values: [{ field: "applicant_id", agg: "sum" }], filters: {} };
    session = submitStep(session, pivotLesson, ts).session;
    const best = session.steps[1].bestScore;
    assert.ok(best > 0);
    // Retry pricing (deliberate change): the one FAILED submission above is no
    // longer free — it costs an attemptPenalty of 0.9, the price of a nudge.
    // Half-credit for the unfinished step then multiplies by that penalty:
    // best * 0.5 * 0.9. Verified by hand against the scoring model in
    // lib/guide/runner.js; this is a test update for changed behaviour, not a
    // loosened assertion.
    assert.equal(lessonScore(session, pivotLesson).steps[1].credit, best * 0.5 * 0.9);
  });

  test("sessions survive a JSON round trip mid-lesson and resume to completion", () => {
    let session = createSession(xlookupLesson);
    const ts = stateFor(xlookupLesson, 0);
    setCell(ts.sheets.Regions, "B4", "Northeast");
    session = submitStep(session, xlookupLesson, ts).session;
    assert.equal(session.stepIndex, 1);

    const restored = deserializeSession(JSON.stringify(serializeSession(session)), xlookupLesson);
    assert.deepEqual(restored, session);

    // resume: the checkpoint for step 2 exists on the step itself
    const cp = checkpointForStep(xlookupLesson, restored.stepIndex);
    assert.equal(cp.stepIndex, 1);
    const ts2 = materializeCheckpoint(cp.checkpoint, RESOURCES);
    setCell(ts2.sheets.Applicants, "H2", "=XLOOKUP(D2, $J$2:$J$23, $K$2:$K$23)");
    const out = submitStep(restored, xlookupLesson, ts2);
    assert.equal(out.result.pass, true);
    assert.equal(out.session.stepIndex, 2);
  });

  test("a NON-DEFAULT mode survives the JSON round trip", () => {
    // Regression pin: deserializeSession once rebuilt the session without its
    // "mode" field, so an outcome-mode session resumed as the scaffolded
    // default after a restart. Round-tripping the DEFAULT mode would pass even
    // with that bug (the fallback masks it), so this must use a non-default
    // mode on a lesson that declares one.
    const session = createSession(pivotLesson, { mode: "outcome" });
    assert.notEqual(pivotLesson.mode, "outcome"); // guard: it really is non-default
    const restored = deserializeSession(JSON.stringify(serializeSession(session)), pivotLesson);
    assert.equal(restored.mode, "outcome");
    assert.deepEqual(restored, session);
    // a saved mode the lesson no longer declares falls back to the base mode
    const stale = serializeSession(session);
    stale.mode = "no-such-mode";
    assert.equal(deserializeSession(stale, pivotLesson).mode, pivotLesson.mode);
  });

  test("deserializeSession rejects the wrong lesson and reconciles changed steps by id", () => {
    const session = createSession(pivotLesson);
    assert.throws(() => deserializeSession(serializeSession(session), xlookupLesson), /is for "excel-pivot"/);

    // simulate a lesson update: a saved session missing one step's state
    const saved = serializeSession(session);
    saved.steps = saved.steps.filter((s) => s.stepId !== "pivot-columns");
    const restored = deserializeSession(saved, pivotLesson);
    assert.equal(restored.steps.length, pivotLesson.steps.length);
    assert.equal(restored.steps.find((s) => s.stepId === "pivot-columns").status, "pending");
  });

  test("a complete session ignores further submissions", () => {
    const tiny = createLesson({
      id: "tiny", title: "T", tool: "sheet",
      steps: [{
        instruction: "x",
        checkpoint: { tool: "sheet", sheets: [{ name: "S", cells: { A1: 1 } }] },
        grader: { type: "predicate", fn: () => true },
      }],
    });
    let session = createSession(tiny);
    session = submitStep(session, tiny, {}).session;
    assert.equal(isComplete(session), true);
    const out = submitStep(session, tiny, {});
    assert.equal(out.result, null);
    assert.equal(out.session, session);
  });

  test("goToStep bounds-checks and reports the checkpoint to seed from", () => {
    const session = createSession(pivotLesson);
    assert.throws(() => goToStep(session, pivotLesson, 9), RangeError);
    const { session: moved, checkpoint } = goToStep(session, pivotLesson, 3);
    assert.equal(moved.stepIndex, 3);
    assert.equal(checkpoint.stepIndex, 3); // every excel-pivot step is a clean entry point
    assert.equal(currentStep(moved, pivotLesson).id, "show-as-rate");
  });
});

// ==============================================================================
describe("checkpoints: materialization and resume", () => {
  test("missing resources fail loudly with the resource name", () => {
    assert.throws(
      () => materializeCheckpoint(pivotLesson.steps[1].checkpoint, {}),
      /missing resource "hmda-sample\.csv"/
    );
    assert.throws(() => materializeCheckpoint({ tool: "cad" }, {}), /unknown tool/);
  });

  test("sheet checkpoints build a workbook with the declared active tab", () => {
    const ts = stateFor(xlookupLesson, 0);
    assert.equal(ts.tool, "sheet");
    assert.equal(ts.active, "Regions");
    assert.deepEqual(Object.keys(ts.sheets).sort(), ["Applicants", "Regions"]);
    assert.equal(getValue(ts.sheets.Regions, "A1"), "zip_code");
    assert.equal(getValue(ts.sheets.Regions, "B4"), undefined); // the step-1 gap
  });

  test("the pivot panel is deep-cloned: sessions cannot mutate the lesson definition", () => {
    const ts = stateFor(pivotLesson, 1);
    ts.pivot.spec.rows.push("race");
    assert.deepEqual(pivotLesson.steps[1].checkpoint.pivot.spec.rows, []);
  });

  test("viz checkpoints rebuild pills with the right aggregation and discreteness", () => {
    const ts = stateFor(barsLesson, 3);
    assert.equal(ts.tool, "viz");
    assert.equal(ts.rows.length, 100);
    assert.equal(ts.spec.columns[0].field, "race");
    assert.equal(ts.spec.columns[0].discrete, true);
    assert.equal(ts.spec.rows[0].aggregation, "AVG");
    assert.equal(ts.spec.rows[0].discrete, false);
    assert.equal(ts.spec.calculatedFields[0].name, "is_approved");
  });

  test("checkpointForStep walks back to the nearest earlier checkpoint", () => {
    const gapped = createLesson({
      id: "gapped", title: "G", tool: "sheet",
      steps: [
        {
          instruction: "a",
          checkpoint: { tool: "sheet", sheets: [{ name: "S", cells: { A1: 1 } }] },
          grader: { type: "cellValue", ref: "A1", expected: 1 },
        },
        { instruction: "b", grader: { type: "cellValue", ref: "A2", expected: 2 } },
      ],
    });
    const found = checkpointForStep(gapped, 1);
    assert.equal(found.stepIndex, 0);
    const { toolState, resumedFrom } = startingState(gapped, 1, {});
    assert.equal(resumedFrom, 0);
    assert.equal(getValue(toolState.sheets.S, "A1"), 1);
    assert.equal(checkpointForStep({ id: "none", steps: [{}] }, 0), null);
  });

  test("toPlain flattens engine values for persistence", () => {
    const sheet = createSheet();
    setCell(sheet, "A1", "=1/0");
    assert.equal(toPlain(getValue(sheet, "A1")), "#DIV/0!");
    assert.equal(toPlain(new Date("2026-08-12T00:00:00Z")), "2026-08-12T00:00:00.000Z");
    assert.equal(toPlain(NaN), null);
    assert.deepEqual(toPlain([1, undefined]), [1, null]);
  });
});
