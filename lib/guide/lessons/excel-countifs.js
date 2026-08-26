// Guided lesson: COUNTIF/COUNTIFS/SUMIFS — building the four-fifths
// calculator from curriculum lesson excel-3, the calculation interviewers ask
// candidates to walk through live.
//
// The build: one row per race group, columns for total (COUNTIF), approved
// (COUNTIFS), rate (division), and ratio vs the best-performing group
// (division by a pinned MAX). SUMIFS closes the lesson with dollars.
//
// Ground truth (verified against public/data/hmda-sample.csv):
//   totals    3, 10, 16, 18, 3, 50   (American Indian, Asian, Black,
//   approved  2,  8,  9, 12, 2, 43    Hispanic, Other, White — alphabetical)
//   rates     2/3, .8, .5625, 2/3, 2/3, .86     best rate = White .86
//   ratios    .7752, .9302, .6541, .7752, .7752, 1  → four groups sit under
//     0.80, but American Indian and Other have only THREE applicants each —
//     far too few to report; the verdict step suppresses them (see VERDICTS)
//   SUMIFS approved dollars: Black 1,910,000 / White 9,799,000
//
// Grading doctrine:
//   - counting steps grade METHOD + OUTCOME together (cellFormula with
//     expectedValue, plus rangeValues over the filled column) — COUNTIF(S) is
//     the lesson, and hand-typed counts must fail;
//   - the rate step grades METHOD + OUTCOME too: the instruction hands the
//     learner =K2/J2 and the fill-down, so the cell must actually divide the
//     row's own K by its J — six hand-typed constants must fail;
//   - the ratio step requires MAX over the pinned rate column, because
//     "divide by the highest group's rate" is the four-fifths method itself;
//   - the rate step's per-row check is a predicate (rateFilled), not
//     filledWithFormula: a plain division has no function name for mustUse
//     to catch, which is exactly how L3:L6 once went ungraded (see below).

import { createLesson } from "../spec.js";
import { resolveSheet } from "../graders.js";
import { getCell, getValue } from "../../sheet/model.js";

const HMDA = "hmda-sample.csv";

export const RACES = ["American Indian", "Asian", "Black", "Hispanic", "Other", "White"];

/** Verified column values, one inner array per table row (rows 2-7). */
export const TOTALS = [[3], [10], [16], [18], [3], [50]];
export const APPROVED = [[2], [8], [9], [12], [2], [43]];
export const RATES = TOTALS.map(([t], i) => [APPROVED[i][0] / t]);
const BEST_RATE = 0.86;
export const RATIOS = RATES.map(([r]) => [r / BEST_RATE]);

/**
 * Verdicts with a sample-size floor. A ratio computed over three applicants
 * is noise: flipping ONE decision moves it by a third. Groups under
 * MIN_GROUP_N applicants get "insufficient n" instead of a FAIL/PASS —
 * "four of six groups fail" is not a defensible sentence when two of the
 * four have n=3, and an interviewer will ask exactly that.
 */
export const MIN_GROUP_N = 10;
export const VERDICTS = RATIOS.map(([r], i) =>
  [TOTALS[i][0] < MIN_GROUP_N ? "insufficient n" : r < 0.8 ? "FAIL" : "PASS"]);

function tableCells(columns = {}) {
  const cells = { I1: "race", J1: "total", K1: "approved", L1: "rate", M1: "ratio", N1: "approved $", O1: "verdict" };
  RACES.forEach((race, i) => {
    cells[`I${i + 2}`] = race;
  });
  for (const [col, formulas] of Object.entries(columns)) {
    formulas.forEach((f, i) => {
      cells[`${col}${i + 2}`] = f;
    });
  }
  return cells;
}

const COUNTIF_COL = RACES.map((_, i) => `=COUNTIF($B$2:$B$101, I${i + 2})`);
const COUNTIFS_COL = RACES.map((_, i) => `=COUNTIFS($B$2:$B$101, I${i + 2}, $G$2:$G$101, "APPROVED")`);
const RATE_COL = RACES.map((_, i) => `=K${i + 2}/J${i + 2}`);
const RATIO_COL = RACES.map((_, i) => `=L${i + 2}/MAX($L$2:$L$7)`);
const VERDICT_COL = RACES.map((_, i) => `=IF(J${i + 2}<10, "insufficient n", IF(M${i + 2}<0.8, "FAIL", "PASS"))`);

function checkpoint(columns) {
  return {
    tool: "sheet",
    active: "Data",
    sheets: [{ name: "Data", load: [{ resource: HMDA, origin: "A1" }], cells: tableCells(columns) }],
  };
}

/**
 * Build a per-row grader for one filled column.
 *
 * WHY: the doctrine above says "hand-typed counts must fail", but pinning the
 * method with a single `cellFormula` on the column's FIRST cell did not deliver
 * it — `rangeValues` accepts whatever is in rows 3-7, typed or computed. So one
 * real COUNTIF in J2 plus five typed numbers passed a step whose entire point is
 * filling down, and the runner recorded it as mastered. Every row the step
 * claims to fill is now checked for method AND outcome, the same way
 * excel-index-match's fill step is.
 *
 * @param {string} col column letter, e.g. "J"
 * @param {string[]} mustUse function names the row's formula must use (any one of)
 * @param {Array<[number]>} expected verified values, one inner array per row
 * @param {string} what human name of the method, for the failure message
 * @returns {(toolState: object) => object} a predicate grader fn
 */
function filledWithFormula(col, mustUse, expected, what) {
  return (toolState) => {
    const sheet = resolveSheet(toolState, "Data");
    const diff = [];
    let ok = 0;

    for (let i = 0; i < expected.length; i++) {
      const ref = `${col}${i + 2}`;
      const cell = getCell(sheet, ref);
      const want = expected[i][0];

      if (!cell || cell.input === "" || cell.input == null) {
        diff.push({ kind: "missing", path: ref, expected: want, actual: null,
          hint: `${ref} is empty — fill ${col}2's formula down through ${col}${expected.length + 1}.` });
        continue;
      }
      if (!cell.isFormula) {
        diff.push({ kind: "method", path: ref, expected: `a ${what} formula`, actual: String(cell.input),
          hint: `${ref} holds a typed value. Every row must compute its own ${what} — that is the fill-down this step teaches.` });
        continue;
      }
      const input = String(cell.input).toUpperCase();
      if (!mustUse.some((fn) => input.includes(`${fn}(`))) {
        diff.push({ kind: "method", path: ref, expected: `a ${what} formula`, actual: String(cell.input),
          hint: `${ref} must use ${mustUse.join(" or ")} — that is the method this lesson teaches.` });
        continue;
      }
      const got = getValue(sheet, ref);
      if (typeof got !== "number" || Math.abs(got - want) > 1e-9) {
        diff.push({ kind: "value", path: ref, expected: want, actual: got,
          hint: `${ref} computes ${got}, but ${RACES[i]} should be ${want}.` });
        continue;
      }
      ok += 1;
    }

    return {
      pass: ok === expected.length,
      message: ok === expected.length
        ? `All ${expected.length} rows computed with ${mustUse.join("/")}.`
        : `${expected.length - ok} of ${expected.length} rows are not computed with ${mustUse.join("/")}.`,
      diff: diff.slice(0, 5),
    };
  };
}


/**
 * Per-row METHOD + OUTCOME check for the rate column. The doctrine says "six
 * hand-typed constants must fail", but filledWithFormula can't enforce it —
 * =K2/J2 contains no function name for mustUse to find. So for years the rate
 * step pinned only L2 and L7 with cellFormula and let rangeValues accept
 * typed constants in L3:L6: a live hole in the exact shape the anchor-cell
 * fix above was built to close. Each row must be a formula dividing its OWN
 * K by its OWN J.
 * @param {object} toolState the sheet workbook being graded
 * @returns {object} a partial GradeResult
 */
function rateFilled(toolState) {
  const sheet = resolveSheet(toolState, "Data");
  const diff = [];
  let ok = 0;

  for (let i = 0; i < RATES.length; i++) {
    const r = i + 2;
    const ref = `L${r}`;
    const cell = getCell(sheet, ref);
    const want = RATES[i][0];

    if (!cell || cell.input === "" || cell.input == null) {
      diff.push({ kind: "missing", path: ref, expected: want, actual: null,
        hint: `${ref} is empty — fill L2's division down through L7.` });
      continue;
    }
    if (!cell.isFormula) {
      diff.push({ kind: "method", path: ref, expected: "a K/J division formula", actual: String(cell.input),
        hint: `${ref} holds a typed value. Every row must divide its own approved count by its own total.` });
      continue;
    }
    const rowDivision = new RegExp(`\\$?K\\$?${r}\\s*/\\s*\\$?J\\$?${r}`);
    if (!rowDivision.test(String(cell.input))) {
      diff.push({ kind: "method", path: ref, expected: `=K${r}/J${r}`, actual: String(cell.input),
        hint: `${ref} must divide K${r} by J${r} — the row's own approvals over its own total.` });
      continue;
    }
    const got = getValue(sheet, ref);
    if (typeof got !== "number" || Math.abs(got - want) > 1e-9) {
      diff.push({ kind: "value", path: ref, expected: want, actual: got,
        hint: `${ref} computes ${got}, but ${RACES[i]} should be ${want}.` });
      continue;
    }
    ok += 1;
  }

  return {
    pass: ok === RATES.length,
    message: ok === RATES.length
      ? "All 6 rates computed from the row's own K and J."
      : `${RATES.length - ok} of ${RATES.length} rate rows are not computed from their own K and J.`,
    diff: diff.slice(0, 5),
  };
}

/**
 * Per-row METHOD + OUTCOME check for the verdict column: every row must be an
 * IF reading its own J (sample size) and produce the verified verdict.
 * String-valued, so filledWithFormula's numeric compare doesn't apply.
 * @param {object} toolState the sheet workbook being graded
 * @returns {object} a partial GradeResult
 */
function verdictFilled(toolState) {
  const sheet = resolveSheet(toolState, "Data");
  const diff = [];
  let ok = 0;

  for (let i = 0; i < VERDICTS.length; i++) {
    const r = i + 2;
    const ref = `O${r}`;
    const cell = getCell(sheet, ref);
    const want = VERDICTS[i][0];

    if (!cell || cell.input === "" || cell.input == null) {
      diff.push({ kind: "missing", path: ref, expected: want, actual: null,
        hint: `${ref} is empty — fill O2's IF down through O7.` });
      continue;
    }
    const input = String(cell.input);
    if (!cell.isFormula || !input.toUpperCase().includes("IF(")) {
      diff.push({ kind: "method", path: ref, expected: "an IF formula over the row's own J and M", actual: input,
        hint: `${ref} must compute its verdict with IF — a typed word can't defend a sample-size rule.` });
      continue;
    }
    if (!new RegExp(`\\$?J\\$?${r}`).test(input)) {
      diff.push({ kind: "method", path: ref, expected: `an IF that checks J${r}`, actual: input,
        hint: `${ref} must check the row's own group size J${r} before judging the ratio.` });
      continue;
    }
    const got = getValue(sheet, ref);
    if (typeof got !== "string" || got.trim() !== want) {
      diff.push({ kind: "value", path: ref, expected: want, actual: got,
        hint: `${ref} shows ${JSON.stringify(got ?? null)}, but ${RACES[i]} (n=${TOTALS[i][0]}) should read "${want}".` });
      continue;
    }
    ok += 1;
  }

  return {
    pass: ok === VERDICTS.length,
    message: ok === VERDICTS.length
      ? "All 6 verdicts computed with the sample-size floor."
      : `${VERDICTS.length - ok} of ${VERDICTS.length} verdict rows aren't right yet.`,
    diff: diff.slice(0, 5),
  };
}

export const lesson = createLesson({
  id: "excel-countifs",
  tool: "sheet",
  moduleId: "excel",
  mode: "guided",
  // Outcome variant: each column of the four-fifths table posed as the
  // business question it answers. The per-row METHOD predicates are dropped
  // on purpose — in outcome mode a learner who reaches the verified numbers
  // by a different route (a pivot they then reference, different counting
  // functions, a different formula shape) has answered the question — and
  // rangeValues over the whole column is the outcome check.
  modes: ["outcome"],
  voice: true,
  title: "COUNTIFS and the four-fifths calculator",
  description:
    "The disparate-impact test interviewers ask you to build live: COUNTIF for group sizes, COUNTIFS " +
    "for approvals, a division for the rate, and a ratio against the best-performing group. Under the " +
    "80% line means legal exposure — four of six groups land there in this file, but two of the four " +
    "have only three applicants, so the build ends with a verdict column that says so.",
  resources: [HMDA],
  steps: [
    {
      id: "count-totals",
      title: "COUNTIF: how big is each group?",
      instruction:
        "A summary table is scaffolded in I1:N1 with the six race groups in I2:I7. In J2, count how " +
        "many applicants belong to the group named in I2: =COUNTIF($B$2:$B$101, I2). Fill it down " +
        "J2:J7 — you should get 3, 10, 16, 18, 3, 50.",
      hints: [
        "One condition → COUNTIF. It takes the range to scan and the criteria to match.",
        "Scan the race column $B$2:$B$101; the criteria is the group label sitting in I2.",
        "Pin the scan range with $ but leave I2 relative, so the fill-down walks the group list.",
        "=COUNTIF($B$2:$B$101, I2), filled to J7. Black (J4) shows 16, White (J7) shows 50.",
      ],
      target: { kind: "sheet-cell", ref: "J2" },
      spotlightLabel: "Write a COUNTIF for J2's race group",
      checkpoint: checkpoint(),
      grader: {
        type: "allOf",
        of: [
          {
            type: "anyOf",
            of: [
              { type: "cellFormula", ref: "J2", mustUse: ["COUNTIF"], expectedValue: 3 },
              { type: "cellFormula", ref: "J2", mustUse: ["COUNTIFS"], expectedValue: 3 },
            ],
          },
          { type: "rangeValues", range: "J2:J7", expected: TOTALS },
          { type: "predicate", fn: filledWithFormula("J", ["COUNTIF", "COUNTIFS"], TOTALS, "COUNTIF"),
            label: "Every group's total counted with COUNTIF, not typed" },
        ],
      },
      modes: {
        outcome: {
          instruction:
            "How many applicants does each race group have? The group labels sit in I2:I7 — put each " +
            "group's applicant count beside it in J2:J7, drawn from the race column of the data.",
          hints: [
            "Each row of the summary table needs the number of data rows whose race matches its label.",
            "The race column is B2:B101; the answers range from 3 to 50.",
          ],
          grader: { type: "rangeValues", range: "J2:J7", expected: TOTALS },
        },
      },
    },
    {
      id: "count-approved",
      title: "COUNTIFS: two conditions at once",
      instruction:
        "Approvals need TWO conditions — the right race AND the APPROVED decision — so COUNTIF won't " +
        'do. In K2, write =COUNTIFS($B$2:$B$101, I2, $G$2:$G$101, "APPROVED") and fill down K2:K7. ' +
        "Expected: 2, 8, 9, 12, 2, 43.",
      hints: [
        "The S in COUNTIFS means it takes range/criteria PAIRS — as many as you need.",
        "Pair 1: race column vs I2. Pair 2: decision column $G$2:$G$101 vs the text \"APPROVED\".",
        "Criteria text needs quotes: \"APPROVED\". Both scan ranges get $; I2 stays relative.",
        '=COUNTIFS($B$2:$B$101, I2, $G$2:$G$101, "APPROVED") filled to K7 — Black 9, White 43.',
      ],
      target: { kind: "sheet-cell", ref: "K2" },
      spotlightLabel: "Write a COUNTIFS formula in K2",
      checkpoint: checkpoint({ J: COUNTIF_COL }),
      grader: {
        type: "allOf",
        of: [
          { type: "cellFormula", ref: "K2", mustUse: ["COUNTIFS"], expectedValue: 2 },
          { type: "rangeValues", range: "K2:K7", expected: APPROVED },
          { type: "predicate", fn: filledWithFormula("K", ["COUNTIFS"], APPROVED, "COUNTIFS"),
            label: "Every group's approved count computed with COUNTIFS, not typed" },
        ],
      },
      modes: {
        outcome: {
          instruction:
            "Of those applicants, how many in each race group were actually approved? Fill K2:K7 with " +
            "each group's approved count — a row now has to satisfy two conditions at once to be counted.",
          hints: [
            "A row counts only when its race matches the group AND its decision reads APPROVED.",
            "Decisions live in G2:G101; the Black group should come out at 9, White at 43.",
          ],
          grader: { type: "rangeValues", range: "K2:K7", expected: APPROVED },
        },
      },
    },
    {
      id: "compute-rates",
      title: "Rate = approved ÷ total",
      instruction:
        "In L2, divide approvals by group size (=K2/J2) and fill down L2:L7. Black lands at 0.5625, " +
        "White at 0.86 — the same numbers the pivot lesson found, now built by hand.",
      hints: [
        "An approval rate is just a proportion: approved ÷ total.",
        "K2 over J2 — both relative, so the fill-down stays inside each row.",
        "=K2/J2, filled to L7.",
        "L4 (Black) shows 0.5625 and L7 (White) shows 0.86.",
      ],
      target: { kind: "sheet-cell", ref: "L2" },
      spotlightLabel: "Divide K2 by J2 in L2 for the rate",
      checkpoint: checkpoint({ J: COUNTIF_COL, K: COUNTIFS_COL }),
      grader: {
        type: "allOf",
        of: [
          { type: "cellFormula", ref: "L2", pattern: "\\$?K\\$?2\\s*/\\s*\\$?J\\$?2", expectedValue: RATES[0][0] },
          { type: "rangeValues", range: "L2:L7", expected: RATES },
          { type: "predicate", fn: rateFilled,
            label: "Every group's rate divides its own K by its own J, not typed" },
        ],
      },
      modes: {
        outcome: {
          instruction:
            "What fraction of each group's applicants got approved? Put every group's approval rate in " +
            "L2:L7, as a decimal between 0 and 1.",
          hints: [
            "A rate is a proportion: the group's approvals over the group's size.",
            "Black should land at 0.5625 and White at 0.86 — the same numbers the pivot lesson surfaced.",
          ],
          grader: { type: "rangeValues", range: "L2:L7", expected: RATES },
        },
      },
    },
    {
      id: "four-fifths-ratio",
      title: "The four-fifths ratio",
      instruction:
        "The legal test divides each group's rate by the HIGHEST group's rate. In M2, write " +
        "=L2/MAX($L$2:$L$7) and fill down M2:M7. White comes out at exactly 1.00; Black at 0.65 — " +
        "well under the 0.80 threshold.",
      hints: [
        "The denominator is the best rate in the column — let MAX find it instead of hardcoding 0.86.",
        "MAX's range must be pinned ($L$2:$L$7) or the fill-down will slide it off the table.",
        "=L2/MAX($L$2:$L$7) — L2 relative, the MAX range absolute.",
        "Filled to M7: American Indian 0.775, Asian 0.930, Black 0.654, Hispanic 0.775, Other 0.775, White 1.",
      ],
      target: { kind: "sheet-cell", ref: "M2" },
      spotlightLabel: "Divide L2 by MAX of the rate column in M2",
      checkpoint: checkpoint({ J: COUNTIF_COL, K: COUNTIFS_COL, L: RATE_COL }),
      grader: {
        type: "allOf",
        of: [
          { type: "cellFormula", ref: "M2", mustUse: ["MAX"], pattern: "\\$L\\$2:\\$L\\$7" },
          { type: "rangeValues", range: "M2:M7", expected: RATIOS },
          { type: "predicate", fn: filledWithFormula("M", ["MAX"], RATIOS, "MAX over the pinned rate column"),
            label: "Every group's ratio computed against MAX($L$2:$L$7), not typed" },
        ],
      },
      modes: {
        outcome: {
          instruction:
            "The four-fifths test compares every group to the BEST-performing group: how does each " +
            "group's rate stack up against the highest rate in the table? Fill M2:M7 with that " +
            "comparison, where the top group reads exactly 1.",
          hints: [
            "Each entry is the group's own rate relative to the best rate in column L.",
            "White is this file's best performer, so its own entry comes out at exactly 1.00.",
          ],
          grader: { type: "rangeValues", range: "M2:M7", expected: RATIOS },
        },
      },
    },
    {
      id: "verdict-with-n",
      title: "Verdicts that survive a sample-size question",
      instruction:
        "Before you write \"FAIL\" anywhere, look at column J: American Indian and Other have THREE " +
        "applicants each. One flipped decision moves a 3-person ratio by a third — too noisy to report. " +
        'In O2, write =IF(J2<10, "insufficient n", IF(M2<0.8, "FAIL", "PASS")) and fill down O2:O7. ' +
        "Black and Hispanic fail on defensible numbers; the two tiny groups get \"insufficient n\".",
      hints: [
        "The outer IF checks group size FIRST — a verdict needs enough applicants behind it.",
        "J holds the group totals; anything under 10 is suppressed before the ratio is even judged.",
        "The inner IF is the four-fifths test itself: M under 0.8 fails.",
        '=IF(J2<10, "insufficient n", IF(M2<0.8, "FAIL", "PASS")) filled to O7 — FAIL only on Black and Hispanic.',
      ],
      target: { kind: "sheet-cell", ref: "O2" },
      spotlightLabel: "Write the sample-size-aware verdict in O2",
      checkpoint: checkpoint({ J: COUNTIF_COL, K: COUNTIFS_COL, L: RATE_COL, M: RATIO_COL }),
      grader: {
        type: "allOf",
        of: [
          { type: "cellFormula", ref: "O2", mustUse: ["IF"], pattern: "\\$?J\\$?2", expectedValue: "insufficient n" },
          { type: "rangeValues", range: "O2:O7", expected: VERDICTS },
          { type: "predicate", fn: verdictFilled,
            label: "Every verdict computed with the n-floor IF, not typed" },
        ],
      },
      modes: {
        outcome: {
          instruction:
            "Which groups actually fail the four-fifths test — defensibly? The rule: a group under the " +
            "0.8 line fails, but a group with fewer than 10 applicants is too small to judge and gets " +
            "\"insufficient n\" instead of a verdict. Fill O2:O7 so every group reads FAIL, PASS, or " +
            "insufficient n under that rule.",
          hints: [
            "Check the group's size in column J before judging its ratio in column M.",
            "Two groups have only three applicants each — one flipped decision would move their ratio by a third.",
          ],
          grader: { type: "rangeValues", range: "O2:O7", expected: VERDICTS },
        },
      },
    },
    {
      id: "sumifs-dollars",
      title: "SUMIFS: from counts to dollars",
      instruction:
        "Counts tell you WHO was approved; SUMIFS tells you how much MONEY moved. In N4 (the Black " +
        'row), sum the approved loan dollars: =SUMIFS($E$2:$E$101, $B$2:$B$101, I4, $G$2:$G$101, "APPROVED"). ' +
        "In N7 do the same for White. Expected: 1,910,000 vs 9,799,000.",
      hints: [
        "SUMIFS = COUNTIFS with a sum range in FRONT: what to add, then the same condition pairs.",
        "Sum the loan_amount column $E$2:$E$101 under the race and APPROVED conditions.",
        "Reuse the row's own label (I4, I7) as the race criteria, like the counting steps did.",
        '=SUMIFS($E$2:$E$101, $B$2:$B$101, I4, $G$2:$G$101, "APPROVED") → 1910000; the I7 version → 9799000.',
      ],
      target: { kind: "sheet-cell", ref: "N4" },
      spotlightLabel: "Write a SUMIFS formula in N4 for Black",
      checkpoint: checkpoint({ J: COUNTIF_COL, K: COUNTIFS_COL, L: RATE_COL, M: RATIO_COL, O: VERDICT_COL }),
      grader: {
        type: "allOf",
        of: [
          { type: "cellFormula", ref: "N4", mustUse: ["SUMIFS"], expectedValue: 1910000 },
          { type: "cellFormula", ref: "N7", mustUse: ["SUMIFS"], expectedValue: 9799000 },
        ],
      },
      modes: {
        outcome: {
          instruction:
            "Counts tell you WHO was approved — the money tells another story. How many dollars of " +
            "approved loans went to Black applicants, and how many to White? Put the totals in N4 and " +
            "N7, computed from the data.",
          hints: [
            "Add up loan amounts (column E), but only rows matching the race AND an APPROVED decision.",
            "The gap is stark: under $2M against nearly $10M.",
          ],
          // cellFormula with only expectedValue = "computed, not typed",
          // without demanding any particular function — the outcome shape.
          grader: {
            type: "allOf",
            of: [
              { type: "cellFormula", ref: "N4", expectedValue: 1910000 },
              { type: "cellFormula", ref: "N7", expectedValue: 9799000 },
            ],
          },
        },
      },
    },
  ],
});

export default lesson;
