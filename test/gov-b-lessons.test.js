// The governance track B lessons (duplicates, standardize, reconcile) under
// test, three ways:
//   (a) every expected number is RE-DERIVED here from the actual CSV files
//       (via the same csv parser the sheet uses) and cross-checked against
//       data/governance-manifest.json — the lessons' exported constants must
//       agree with the corpus, not the other way round. A prior audit found
//       a lesson shipping six fabricated numbers; this block is the guard.
//   (b) each lesson is walked to a perfect score through the REAL runner —
//       createSession/submitStep over materialized checkpoints — in guided
//       AND outcome mode. This is the call-site test: it proves the
//       checkpoints materialize from the declared resource keys, the
//       solution formulas evaluate in the real engine, and the graders pass
//       them. A lesson that validates but cannot be driven end to end has
//       been written, not shipped.
//   (c) plausibly-WRONG solutions fail for the RIGHT reason: typed values
//       where formulas are demanded, untrimmed keys, naive text-vs-number
//       amount comparison.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { validateLesson, resolveLessonMode, lessonModes } from "../lib/guide/spec.js";
import { grade } from "../lib/guide/graders.js";
import { createSession, submitStep, isComplete, lessonScore } from "../lib/guide/runner.js";
import { startingState } from "../lib/guide/checkpoints.js";
import { setCell, setCells } from "../lib/sheet/model.js";
import { parseCsv, inferValue } from "../lib/sheet/csv.js";

import duplicates, * as DUP from "../lib/guide/lessons/gov-duplicates.js";
import standardize, * as STD from "../lib/guide/lessons/gov-standardize.js";
import reconcile, * as REC from "../lib/guide/lessons/gov-reconcile.js";

// --- Fixtures ----------------------------------------------------------------

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
const RAW_CSV = read("../public/data/hmda-raw.csv");
const SVC_CSV = read("../public/data/hmda-servicing.csv");
const MANIFEST = JSON.parse(read("../data/governance-manifest.json"));
const RESOURCES = { "hmda-raw.csv": RAW_CSV, "hmda-servicing.csv": SVC_CSV };

// Typed rows exactly as loadCsv would produce them (same parser, same
// inference), so this derivation and the sheet engine cannot disagree.
const rawRows = parseCsv(RAW_CSV).slice(1).map((r) => r.map(inferValue));
const svcRows = parseCsv(SVC_CSV).slice(1).map((r) => r.map(inferValue));

const LESSONS = [duplicates, standardize, reconcile];

// COUNTIF equality: case-insensitive, NO trim — mirrors valueEquals.
const ci = (v) => (typeof v === "string" ? v.toLowerCase() : v);
const trimmed = (v) => String(v ?? "").trim();
const normAmount = (v) => (typeof v === "number" ? v : Number(String(v).replace(/[$,]/g, "")));

// ==============================================================================
describe("gov-b: ground truth re-derived from the corpus", () => {
  test("raw extract shape matches the manifest", () => {
    assert.equal(rawRows.length, MANIFEST.raw.rows);
    assert.equal(svcRows.length, MANIFEST.servicing.rows);
    assert.equal(rawRows.length, DUP.RAW_ROWS);
    assert.equal(DUP.LAST_ROW - DUP.FIRST_ROW + 1, rawRows.length);
  });

  test("duplicates: dup rows, padded ids, fingerprints, unique count", () => {
    // COUNTIF-style occurrence counts over the raw (untrimmed) id column
    const counts = new Map();
    for (const r of rawRows) {
      const k = ci(r[0]);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const dupRows = rawRows.filter((r) => counts.get(ci(r[0])) > 1).length;
    assert.equal(dupRows, DUP.DUP_ROW_COUNT);

    // the duplicated ids are exactly the manifest's exact + near duplicates
    const dupIds = [...new Set(rawRows.filter((r) => counts.get(ci(r[0])) > 1).map((r) => trimmed(r[0])))].sort();
    assert.deepEqual(dupIds, [...MANIFEST.defects.exact_duplicate, ...MANIFEST.defects.near_duplicate].sort());

    // padded ids exist and COUNTIF misses them without TRIM
    const padded = rawRows.map((r) => r[0]).filter((v) => typeof v === "string" && v !== v.trim());
    assert.equal(padded.length, MANIFEST.defects.whitespace_padding.length);
    assert.equal(rawRows.filter((r) => ci(r[0]) === ci("A0007")).length, 0);
    assert.equal(rawRows.filter((r) => ci(trimmed(r[0])) === ci("A0007")).length, 1);

    // fingerprints: A0013's pair is byte-identical, A0031's is not
    const fp = (r) => [trimmed(r[0]), ...r.slice(1)].map((v) => String(v ?? "")).join("|");
    const fpCounts = new Map();
    for (const r of rawRows) fpCounts.set(fp(r), (fpCounts.get(fp(r)) ?? 0) + 1);
    const rowOf = (id) => rawRows.find((r) => trimmed(r[0]) === id);
    assert.equal(fpCounts.get(fp(rowOf("A0013"))), 2);
    assert.equal(fpCounts.get(fp(rowOf("A0031"))), 1);
    // the lesson's anchor rows point at the right ids (sheet row = index + 2)
    assert.equal(trimmed(rawRows[DUP.EXACT_DUP_ROW - 2][0]), "A0013");
    assert.equal(trimmed(rawRows[DUP.NEAR_DUP_ROW - 2][0]), "A0031");

    const unique = new Set(rawRows.map((r) => ci(trimmed(r[0])))).size;
    assert.equal(unique, DUP.UNIQUE_APPLICANTS);
  });

  test("standardize: group counts and approval rates", () => {
    const raceGroups = new Set(rawRows.map((r) => (r[2] === undefined ? "(blank)" : r[2])));
    assert.equal(raceGroups.size, STD.RAW_RACE_GROUPS);

    const stdGroups = new Set(rawRows.map((r) => STD.standardizeRace(r[2])));
    assert.equal(stdGroups.size, STD.STD_RACE_GROUPS);

    const naiveWhite = rawRows.filter((r) => ci(r[2]) === "white").length;
    assert.equal(naiveWhite, STD.NAIVE_WHITE_COUNT);
    const white = rawRows.filter((r) => STD.standardizeRace(r[2]) === "White");
    const black = rawRows.filter((r) => STD.standardizeRace(r[2]) === "Black");
    assert.equal(white.length, STD.STD_WHITE_COUNT);
    assert.equal(black.length, STD.STD_BLACK_N);
    // the naive-vs-std White gap is exactly the Caucasian rows
    assert.equal(
      STD.STD_WHITE_COUNT - STD.NAIVE_WHITE_COUNT,
      rawRows.filter((r) => ci(r[2]) === "caucasian").length
    );

    const approvedIn = (rows) => rows.filter((r) => STD.standardizeApproved(r[7]) === "APPROVED").length;
    assert.equal(approvedIn(black), STD.STD_BLACK_APPROVED);
    assert.equal(approvedIn(white), STD.STD_WHITE_APPROVED);
    assert.equal(STD.STD_BLACK_RATE, STD.STD_BLACK_APPROVED / STD.STD_BLACK_N);
    assert.equal(STD.STD_WHITE_RATE, STD.STD_WHITE_APPROVED / STD.STD_WHITE_COUNT);

    // affected race rows all carry a manifest defect tag (spot-check ids)
    const variants = rawRows.filter((r) => typeof r[2] === "string" && r[2] !== "" &&
      ["black", "white", "asian"].includes(r[2].toLowerCase()) && r[2] !== "Black" && r[2] !== "White" && r[2] !== "Asian");
    for (const r of variants) {
      assert.ok(
        MANIFEST.defects.categorical_variant.includes(trimmed(r[0])) ||
          MANIFEST.defects.near_duplicate.includes(trimmed(r[0])), // near-dup second copies carry the case variant

        `${r[0]} has race variant "${r[2]}" but is not in the manifest`);
    }
  });

  test("reconcile: both directions and both mismatch counts", () => {
    const svcIds = new Set(svcRows.map((r) => ci(r[0])));
    const naiveMissing = rawRows.filter((r) => !svcIds.has(ci(r[0]))).length;
    const cleanMissingRows = rawRows.filter((r) => !svcIds.has(ci(trimmed(r[0]))));
    assert.equal(naiveMissing, REC.NAIVE_MISSING_FROM_SVC);
    assert.equal(cleanMissingRows.length, REC.MISSING_FROM_SVC_ROWS);
    const cleanMissingIds = [...new Set(cleanMissingRows.map((r) => trimmed(r[0])))].sort();
    assert.equal(cleanMissingIds.length, REC.MISSING_FROM_SVC_IDS);
    assert.deepEqual(cleanMissingIds, [...MANIFEST.reconciliation.missing_from_servicing].sort());

    const rawIds = new Set(rawRows.map((r) => ci(trimmed(r[0]))));
    const missingFromRaw = svcRows.filter((r) => !rawIds.has(ci(r[0]))).map((r) => String(r[0])).sort();
    assert.equal(missingFromRaw.length, REC.MISSING_FROM_RAW);
    assert.deepEqual(missingFromRaw, [...MANIFEST.reconciliation.missing_from_raw].sort());

    const svcAmt = new Map(svcRows.map((r) => [ci(r[0]), r[2]]));
    let naive = 0, real = 0;
    const realIds = new Set();
    for (const r of rawRows) {
      const key = ci(trimmed(r[0]));
      if (!svcAmt.has(key)) continue;
      const a = r[5], b = svcAmt.get(key);
      if (!(typeof a === "number" && typeof b === "number" && a === b)) naive++;
      if (normAmount(a) !== normAmount(b)) { real++; realIds.add(trimmed(r[0])); }
    }
    assert.equal(naive, REC.NAIVE_AMOUNT_MISMATCHES);
    assert.equal(real, REC.REAL_AMOUNT_MISMATCHES);
    assert.deepEqual([...realIds].sort(), [...MANIFEST.reconciliation.amount_mismatch].sort());
    assert.equal(rawRows.length - REC.MISSING_FROM_SVC_ROWS - REC.REAL_AMOUNT_MISMATCHES, REC.CLEAN_MATCHES);
  });
});

// ==============================================================================
describe("gov-b: lesson definitions", () => {
  test("every lesson validates and declares the outcome mode", () => {
    for (const lesson of LESSONS) {
      const r = validateLesson(lesson);
      assert.deepEqual(r, { valid: true, errors: [] }, `${lesson.id}: ${r.errors.join("; ")}`);
      assert.deepEqual(lessonModes(lesson), ["guided", "outcome"], lesson.id);
    }
  });

  test("outcome mode keeps step ids and checkpoints, changes only allowed fields", () => {
    for (const lesson of LESSONS) {
      const out = resolveLessonMode(lesson, "outcome");
      assert.equal(out.steps.length, lesson.steps.length);
      out.steps.forEach((s, i) => {
        assert.equal(s.id, lesson.steps[i].id, `${lesson.id}: step ids must survive mode resolution`);
        assert.deepEqual(s.checkpoint, lesson.steps[i].checkpoint, `${lesson.id}/${s.id}: checkpoints must survive`);
      });
    }
  });

  test("outcome instructions pose the question without handing over the formula", () => {
    for (const lesson of LESSONS) {
      const out = resolveLessonMode(lesson, "outcome");
      for (const s of out.steps) {
        assert.ok(!/=\s*(COUNTIF|COUNTIFS|TRIM|XLOOKUP|SUBSTITUTE|VALUE|IF)\s*\(/i.test(s.instruction),
          `${lesson.id}/${s.id}: outcome instruction contains a finished formula`);
        assert.ok(s.hints.length >= 1 && s.hints.length <= 3,
          `${lesson.id}/${s.id}: outcome hints should be the short ladder (got ${s.hints.length})`);
      }
    }
  });

  test("lesson resources name files that exist in public/data", () => {
    for (const lesson of LESSONS) {
      for (const key of lesson.resources) {
        assert.ok(RESOURCES[key], `${lesson.id}: resource "${key}" has no file`);
      }
    }
  });
});

// ==============================================================================
// Correct-solution walkthroughs. For each step: materialize ITS checkpoint,
// apply the learner's work, submit through the real runner. The solution
// cells are taken from the NEXT step's checkpoint wherever one exists — that
// simultaneously proves the checkpoints really are complete completed-work
// states, which is what makes steps resumable.

/** All cells the checkpoint of step `i` seeds (beyond the CSV load). */
function checkpointCells(lesson, i) {
  return lesson.steps[i]?.checkpoint?.sheets?.[0]?.cells ?? {};
}

function applyCells(state, cells) {
  setCells(state.sheets.Data, cells);
}

/**
 * Build the sequence of correct tool states, one per step. For a non-pivot
 * step, the completed state IS the NEXT step's checkpoint — materializing it
 * both produces the solution and proves the checkpoints are the complete
 * completed-work states that make steps resumable. Pivot steps start from
 * their own checkpoint (the next one may reset the pivot panel) and set the
 * spec; the final step starts from its own checkpoint plus `extraFinal`.
 */
function solutionStates(lesson, extraFinal, pivotSpecs = {}) {
  const n = lesson.steps.length;
  return lesson.steps.map((step, i) => {
    if (pivotSpecs[step.id]) {
      const state = startingState(lesson, i, RESOURCES).toolState;
      state.pivot = { ...state.pivot, spec: pivotSpecs[step.id] };
      return state;
    }
    if (i < n - 1) return startingState(lesson, i + 1, RESOURCES).toolState;
    const state = startingState(lesson, i, RESOURCES).toolState;
    applyCells(state, extraFinal);
    return state;
  });
}

function walkToPerfect(lesson, states, mode) {
  let session = createSession(lesson, { mode });
  states.forEach((state, i) => {
    const out = submitStep(session, lesson, state);
    assert.equal(out.result.pass, true,
      `${lesson.id} (${mode}) step ${i + 1} (${lesson.steps[i].id}): ${out.result.message}`);
    session = out.session;
  });
  assert.equal(isComplete(session), true, `${lesson.id} (${mode}) did not complete`);
  assert.equal(lessonScore(session, lesson).score, 1, `${lesson.id} (${mode}) not a perfect score`);
}

const DUP_FINAL = { N7: `=COUNTA($A$2:$A$105)-COUNTIF($J$2:$J$105,">1")/2` };

const STD_J = Object.fromEntries([
  ["J1", "approved_std"],
  ...Array.from({ length: 104 }, (_, k) => {
    const i = k + 2;
    return [`J${i}`, `=IF(H${i}="Y","APPROVED",IF(H${i}="N","DENIED",UPPER(H${i})))`];
  }),
]);
const STD_FINAL = {
  ...STD_J,
  M2: `=COUNTIFS($I$2:$I$105,"Black",$J$2:$J$105,"APPROVED")/COUNTIF($I$2:$I$105,"Black")`,
  M3: `=COUNTIFS($I$2:$I$105,"White",$J$2:$J$105,"APPROVED")/COUNTIF($I$2:$I$105,"White")`,
};
const STD_PIVOTS = {
  "naive-pivot": { rows: ["race"], cols: [], values: [{ field: "applicant_id", agg: "count" }], filters: {} },
  regroup: { rows: ["race_std"], cols: [], values: [{ field: "applicant_id", agg: "count" }], filters: {} },
};

// the summary block the final step grades, in W8:X11
const REC_SUMMARY = {
  W8: "in raw only", X8: 4,
  W9: "in servicing only", X9: 3,
  W10: "amount mismatches", X10: 5,
  W11: "clean matches", X11: 94,
};

describe("gov-b: correct solutions walk to a perfect score (guided and outcome)", () => {
  test("gov-duplicates", () => {
    const states = solutionStates(duplicates, DUP_FINAL);
    walkToPerfect(duplicates, states, "guided");
    walkToPerfect(duplicates, states, "outcome");
  });

  test("gov-standardize", () => {
    const states = solutionStates(standardize, STD_FINAL, STD_PIVOTS);
    // the regroup step's own state needs its pivot; solutionStates set it.
    walkToPerfect(standardize, states, "guided");
    walkToPerfect(standardize, states, "outcome");
  });

  test("gov-reconcile", () => {
    const states = solutionStates(reconcile, REC_SUMMARY);
    walkToPerfect(reconcile, states, "guided");
    walkToPerfect(reconcile, states, "outcome");
  });

  test("standardized rates computed by the ENGINE equal the derived truth", () => {
    // belt and braces: the sheet's own COUNTIFS agrees with the plain-JS
    // derivation above, so the lesson's constants cannot sit between two
    // disagreeing computations.
    const state = startingState(standardize, 4, RESOURCES).toolState;
    applyCells(state, STD_FINAL);
    const sheet = state.sheets.Data;
    setCell(sheet, "Z1",`=COUNTIF($I$2:$I$105,"Black")`);
    setCell(sheet, "Z2", `=COUNTIF($I$2:$I$105,"White")`);
    const r = grade(state, {
      type: "allOf",
      of: [
        { type: "cellValue", ref: "Z1", expected: STD.STD_BLACK_N },
        { type: "cellValue", ref: "Z2", expected: STD.STD_WHITE_COUNT },
        { type: "cellValue", ref: "M2", expected: STD.STD_BLACK_RATE, tolerance: 1e-9 },
        { type: "cellValue", ref: "M3", expected: STD.STD_WHITE_RATE, tolerance: 1e-9 },
      ],
    });
    assert.equal(r.pass, true, r.message);
  });
});

// ==============================================================================
describe("gov-b: wrong solutions fail for the right reason", () => {
  test("duplicates: a hand-typed 8 in N2 fails the method gate", () => {
    const state = startingState(duplicates, 1, RESOURCES).toolState;
    applyCells(state, checkpointCells(duplicates, 2)); // correct J column...
    setCell(state.sheets.Data, "N2", 8); // ...but the total is typed
    const r = grade(state, duplicates.steps[1].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /formula/i);
  });

  test("duplicates: one typed value inside the fill-down is caught per row", () => {
    const state = startingState(duplicates, 1, RESOURCES).toolState;
    applyCells(state, checkpointCells(duplicates, 2));
    setCell(state.sheets.Data, "J50", 1); // right value, typed by hand
    const r = grade(state, duplicates.steps[1].grader);
    assert.equal(r.pass, false);
    // the failing grader names the exact cell so the feedback teaches
    assert.match(JSON.stringify(r), /J50/);
  });

  test("duplicates: a COUNTIF that counts the wrong thing is caught by value", () => {
    const state = startingState(duplicates, 1, RESOURCES).toolState;
    applyCells(state, checkpointCells(duplicates, 2));
    // right function, wrong criteria — the per-row VALUE check must catch it
    setCell(state.sheets.Data, "J50", `=COUNTIF($A$2:$A$105,"ZZZ")`);
    const r = grade(state, duplicates.steps[1].grader);
    assert.equal(r.pass, false);
    assert.match(JSON.stringify(r), /J50/);
  });

  test("duplicates: outcome mode still rejects a typed final count", () => {
    const out = resolveLessonMode(duplicates, "outcome");
    const state = startingState(duplicates, 4, RESOURCES).toolState;
    setCell(state.sheets.Data, "N7", 100);
    const r = grade(state, out.steps[4].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /formula/i);
  });

  test("standardize: a typed race_std column fails — the mapping must be re-applicable", () => {
    const state = startingState(standardize, 1, RESOURCES).toolState;
    const cells = { I1: "race_std" };
    for (let i = 2; i <= 105; i++) {
      cells[`I${i}`] = STD.standardizeRace(rawRows[i - 2][2]); // right VALUES, no formula
    }
    applyCells(state, cells);
    const r = grade(state, standardize.steps[1].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /formula/i);
  });

  test("standardize: a mapping that drops Caucasian is caught on the exact rows", () => {
    const state = startingState(standardize, 1, RESOURCES).toolState;
    const cells = { I1: "race_std" };
    for (let i = 2; i <= 105; i++) {
      // forgot the caucasian branch — everything else standard
      cells[`I${i}`] =
        `=IF(C${i}="","Unknown",IF(LOWER(C${i})="white","White",` +
        `IF(LOWER(C${i})="black","Black",IF(LOWER(C${i})="asian","Asian",C${i}))))`;
    }
    applyCells(state, cells);
    const r = grade(state, standardize.steps[1].grader);
    assert.equal(r.pass, false);
    assert.match(JSON.stringify(r.diff ?? r.message), /Caucasian|White/);
  });

  test("standardize: pivoting the raw race column on the regroup step fails", () => {
    const state = startingState(standardize, 2, RESOURCES).toolState;
    state.pivot = { ...state.pivot, spec: STD_PIVOTS["naive-pivot"] };
    const r = grade(state, standardize.steps[2].grader);
    assert.equal(r.pass, false);
  });

  test("reconcile: skipping TRIM reports the naive 10 and fails the clean count", () => {
    const state = startingState(reconcile, 1, RESOURCES).toolState;
    const cells = {};
    for (let i = 2; i <= 105; i++) {
      cells[`P${i}`] = `=A${i}`; // "cleaned" without TRIM
      cells[`Q${i}`] = `=COUNTIF($K$2:$K$100,A${i})`;
      cells[`R${i}`] = `=COUNTIF($K$2:$K$100,P${i})`;
    }
    cells.X2 = `=COUNTIF($Q$2:$Q$105,0)`;
    cells.X3 = `=COUNTIF($R$2:$R$105,0)`;
    applyCells(state, cells);
    const r = grade(state, reconcile.steps[1].grader);
    assert.equal(r.pass, false);
    // the failure is on the CLEAN side: untrimmed keys leave X3 at 10, not 5
    assert.match(JSON.stringify(r), /R\d|X3/);
  });

  test("reconcile: naive text-vs-number comparison in the normalized cell fails", () => {
    const state = startingState(reconcile, 4, RESOURCES).toolState; // everything done...
    // ...except the learner wired X6 to the NAIVE flags
    setCell(state.sheets.Data, "X6", `=SUM(T2:T105)`);
    const r = grade(state, reconcile.steps[3].grader);
    assert.equal(r.pass, false);
    assert.match(JSON.stringify(r), /X6/);
  });

  test("reconcile: a summary that reports rows instead of applicants fails", () => {
    const state = startingState(reconcile, 4, RESOURCES).toolState;
    applyCells(state, { ...REC_SUMMARY, X8: 5 }); // 5 rows, but 4 applicants
    const r = grade(state, reconcile.steps[4].grader);
    assert.equal(r.pass, false);
    assert.match(JSON.stringify(r), /X8/);
  });
});
