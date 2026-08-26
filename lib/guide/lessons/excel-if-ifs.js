// Guided lesson: IF and IFS — turning numbers into decisions.
//
// Two real jobs from the curriculum: flag which groups fail the four-fifths
// test (IF, one condition), and band loan amounts for the governance
// dashboard (IFS, a condition ladder — the bands tableau-2 asks for).
//
// Ground truth (verified against public/data/hmda-sample.csv):
//   ratios (I2:I7 alphabetical): .7752, .9302, .6541, .7752, .7752, 1
//   flags: FAIL, PASS, FAIL, FAIL, FAIL, PASS
//   bands: E2 = 171,000 → "$150k-$250k"; row 6 (69,500) → "Under $150k";
//          row 12 (306,000) → "Over $250k"
//
// Grading doctrine: cellFormula (METHOD) everywhere — IF/IFS in the cell is
// the lesson, so typing "FAIL" by hand fails — plus rangeValues/cellValue for
// the filled columns (OUTCOME) so a formula that computes the wrong thing
// can't pass either. Fill steps grade EVERY row they claim to cover: the
// verdict column checks all six IF formulas, and the band step runs a
// predicate over all 100 rows (method + outcome, derived from column E).

import { createLesson } from "../spec.js";
import { resolveSheet } from "../graders.js";
import { getCell, getRangeValues, isError } from "../../sheet/model.js";
import { RACES, TOTALS, APPROVED, RATES, RATIOS } from "./excel-countifs.js";

const HMDA = "hmda-sample.csv";

export const FLAGS = RATIOS.map(([r]) => [r < 0.8 ? "FAIL" : "PASS"]);

const IF_FLAG = '=IF(M2 < 0.8, "FAIL", "PASS")';
const IFS_BAND = '=IFS(E2 < 150000, "Under $150k", E2 < 250000, "$150k-$250k", TRUE, "Over $250k")';

/**
 * The whole verdict column as a learner leaves it after the fill-down step:
 * N2's IF copied down N3:N7 with its relative M reference translated. Later
 * checkpoints must carry ALL of it — resumedFrom=N promises that steps
 * 0..N-1 need not be redone, so dropping N3:N7 would silently destroy the
 * learner's fill-down.
 */
const FLAG_COLUMN = Object.fromEntries(
  RATIOS.map((_, i) => [`N${i + 2}`, `=IF(M${i + 2} < 0.8, "FAIL", "PASS")`])
);

/** The band a loan amount belongs in — the ladder the IFS must reproduce. */
function bandOf(loan) {
  if (loan < 150000) return "Under $150k";
  if (loan < 250000) return "$150k-$250k";
  return "Over $250k";
}

/**
 * METHOD + OUTCOME grader for the band-the-file step, over EVERY row it
 * claims to cover (spec.js doctrine): each cell in O2:O101 must be an IFS
 * formula whose value is the band the sheet's own loan column (E) demands —
 * hand-typed bands in the spot-check cells, or 97 blank rows around one real
 * IFS, fail with feedback naming the first offending cells.
 * @param {object} toolState the sheet workbook being graded
 * @returns {object} a partial GradeResult
 */
function bandFillCheck(toolState) {
  const sheet = resolveSheet(toolState);
  const loans = getRangeValues(sheet, "E2:E101");

  let ok = 0;
  const diff = [];
  const report = (entry) => {
    if (diff.length < 5) diff.push(entry);
  };

  for (let i = 0; i < 100; i++) {
    const ref = `O${i + 2}`;
    const loan = loans[i][0];
    const expected = bandOf(loan);

    const cell = getCell(sheet, ref);
    if (!cell) {
      report({ kind: "missing", path: ref, expected, actual: null, hint: `${ref} is empty — fill O2's IFS down through O101.` });
      continue;
    }
    const input = String(cell.input);
    if (!cell.isFormula) {
      report({ kind: "method", path: ref, expected: "an IFS formula", actual: input, hint: `${ref} holds a typed band — every row must compute its band with IFS.` });
      continue;
    }
    if (!/(^|[^A-Z0-9_.])IFS\s*\(/i.test(input)) {
      report({ kind: "method", path: ref, expected: "an IFS formula", actual: input, hint: `${ref} must use IFS — the condition ladder is the method here.` });
      continue;
    }
    const value = cell.value;
    if (typeof value === "string" && value.trim() === expected) {
      ok++;
      continue;
    }
    const shown = isError(value) ? value.code : JSON.stringify(value ?? null);
    report({
      kind: "wrong",
      path: ref,
      expected,
      actual: value,
      hint: `${ref} shows ${shown}; expected "${expected}" — E${i + 2} is a $${Number(loan).toLocaleString("en-US")} loan.`,
    });
  }

  const pass = ok === 100;
  return {
    pass,
    score: ok / 100,
    message: pass
      ? "All 100 loans are banded with IFS."
      : `${100 - ok} of 100 loans in column O aren't banded right yet — ${diff[0].hint}`,
    diff,
    expected: "O2:O101 banded with IFS from the loan amounts in E",
    actual: `${ok}/100 rows correct`,
  };
}

/** The finished four-fifths table, seeded as plain values. */
function tableCells(extra = {}) {
  const cells = { I1: "race", J1: "total", K1: "approved", L1: "rate", M1: "ratio", N1: "flag", O1: "band" };
  RACES.forEach((race, i) => {
    const r = i + 2;
    cells[`I${r}`] = race;
    cells[`J${r}`] = TOTALS[i][0];
    cells[`K${r}`] = APPROVED[i][0];
    cells[`L${r}`] = RATES[i][0];
    cells[`M${r}`] = RATIOS[i][0];
  });
  return { ...cells, ...extra };
}

function checkpoint(extra = {}) {
  return {
    tool: "sheet",
    active: "Data",
    sheets: [{ name: "Data", load: [{ resource: HMDA, origin: "A1" }], cells: tableCells(extra) }],
  };
}

export const lesson = createLesson({
  id: "excel-if-ifs",
  tool: "sheet",
  moduleId: "excel",
  mode: "guided",
  voice: true,
  title: "IF and IFS: flag the failures, band the loans",
  description:
    "The four-fifths table computes ratios; a reviewer needs a verdict. IF turns each ratio into " +
    "PASS/FAIL against the 0.80 line. Then IFS — IF's ladder-of-conditions cousin — sorts every loan " +
    "into the dollar bands the governance dashboard uses. Numbers in, decisions out.",
  resources: [HMDA],
  steps: [
    {
      id: "flag-if",
      title: "IF: one ratio, one verdict",
      instruction:
        "The finished four-fifths table sits in I1:M7 (ratios in column M). In N2, write an IF that " +
        'shows "FAIL" when the ratio in M2 is under 0.8 and "PASS" otherwise. American Indian sits at ' +
        "0.775, so N2 should read FAIL.",
      hints: [
        "IF takes three arguments: a test, the value when true, the value when false.",
        "The test is M2 < 0.8 — the four-fifths threshold.",
        "Both outcomes are text, so quote them: \"FAIL\" and \"PASS\".",
        '=IF(M2 < 0.8, "FAIL", "PASS") — 0.775 is under the line, so N2 reads FAIL.',
      ],
      target: { kind: "sheet-cell", ref: "N2" },
      spotlightLabel: "Write an IF formula in N2 for the ratio",
      checkpoint: checkpoint(),
      grader: { type: "cellFormula", ref: "N2", mustUse: ["IF"], expectedValue: "FAIL" },
    },
    {
      id: "fill-flags",
      title: "Fill the verdict column",
      instruction:
        "Fill N2 down through N7. M2 shifts to M3, M4, … so each row judges its own ratio. Only Asian " +
        "and White should PASS — four of the six groups sit under the four-fifths line in this file, " +
        "though American Indian and Other have only three applicants each, so a careful analyst would " +
        "report those two as insufficient sample rather than as failures (the COUNTIFS lesson's " +
        "verdict column does exactly that).",
      hints: [
        "Copy N2 over N3:N7 — the relative M2 walks down the ratio column with you.",
        "If every row shows the same verdict, you probably pinned M2 with $ — it must stay relative here.",
        "Each cell must still be an IF formula, not a typed word.",
        "N2:N7 reads FAIL, PASS, FAIL, FAIL, FAIL, PASS.",
      ],
      target: { kind: "sheet-cell", ref: "N2" },
      spotlightLabel: "Fill N2's IF formula down through N7",
      checkpoint: checkpoint({ N2: IF_FLAG }),
      grader: {
        type: "allOf",
        of: [
          { type: "rangeValues", range: "N2:N7", expected: FLAGS },
          // METHOD on every row the step claims to cover: each cell must be an
          // IF judging its OWN row's ratio — typed verdicts around one real IF
          // must not count as filling the column.
          ...FLAGS.map(([flag], i) => ({
            type: "cellFormula",
            ref: `N${i + 2}`,
            mustUse: ["IF"],
            pattern: `M${i + 2}`,
            expectedValue: flag,
          })),
        ],
      },
    },
    {
      id: "ifs-bands",
      title: "IFS: a ladder of conditions",
      instruction:
        "Nested IFs get unreadable past two levels; IFS is the ladder version: condition, result, " +
        "condition, result, … first true wins. In O2, band the first applicant's loan (E2): " +
        '=IFS(E2 < 150000, "Under $150k", E2 < 250000, "$150k-$250k", TRUE, "Over $250k"). ' +
        "E2 is 171,000, so O2 reads $150k-$250k.",
      hints: [
        "IFS pairs up conditions and results left to right and stops at the FIRST true condition.",
        "Order matters: check < 150000 before < 250000, or every small loan lands in the middle band.",
        "The final pair uses TRUE as a catch-all — it fires only when nothing above matched.",
        '=IFS(E2 < 150000, "Under $150k", E2 < 250000, "$150k-$250k", TRUE, "Over $250k") → $150k-$250k.',
      ],
      target: { kind: "sheet-cell", ref: "O2" },
      spotlightLabel: "Write an IFS formula in O2 for the band",
      checkpoint: checkpoint({ ...FLAG_COLUMN }),
      grader: { type: "cellFormula", ref: "O2", mustUse: ["IFS"], expectedValue: "$150k-$250k" },
    },
    {
      id: "band-the-file",
      title: "Band all 100 loans",
      instruction:
        "Fill O2 down through O101 so every applicant gets a band. Spot-check the extremes: O6 " +
        "(a $69,500 loan) should read Under $150k, and O12 (a $306,000 loan) should read Over $250k.",
      hints: [
        "Copy O2 over O3:O101 — E2 stays relative and walks the loan column.",
        "If O6 shows $150k-$250k, your conditions are out of order — the < 150000 rung must come first.",
        "Every cell in O should still contain IFS after the fill.",
        "O6: Under $150k. O12: Over $250k. O101 (a $146,000 loan): Under $150k.",
      ],
      target: { kind: "sheet-cell", ref: "O2" },
      spotlightLabel: "Fill O2's IFS formula down through O101",
      checkpoint: checkpoint({ ...FLAG_COLUMN, O2: IFS_BAND }),
      grader: {
        type: "allOf",
        of: [
          { type: "cellValue", ref: "O6", expected: "Under $150k" },
          { type: "cellValue", ref: "O12", expected: "Over $250k" },
          { type: "predicate", fn: bandFillCheck, label: "All 100 loans banded with IFS" },
        ],
      },
    },
  ],
});

export default lesson;
