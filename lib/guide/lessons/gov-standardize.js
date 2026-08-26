// Guided lesson: categorical standardization — the payoff lesson of the
// governance labs.
//
// The raw HMDA extract stores race as free text: "White", "white", "WHITE",
// and "Caucasian" are four different strings that mean one group, plus six
// rows where race is simply blank. Group the raw column and the table
// fractures into THIRTEEN race groups; every count, every rate, every
// fair-lending screen computed on it is wrong. The lesson makes the learner
// hit that wall, build a standardization mapping, apply it, and measure how
// far off the naive numbers were.
//
// The tie-back that matters: the analytics labs (excel-pivot,
// excel-countifs) teach the four-fifths approval-rate screen on the CLEAN
// sample. Run the same screen on unstandardized categories and the White
// group silently loses its 4 "Caucasian" records — the benchmark group's
// rate is computed on the wrong population, so the disparity RATIO every
// group is judged against shifts. An error in the benchmark is an error in
// every group's verdict at once. Standardization is not cosmetic cleanup; it
// is a precondition of the analysis being right.
//
// SQL honesty: in a warehouse this is a mapping/reference table joined in,
// or CASE WHEN ... END, enforced by a controlled vocabulary upstream. The
// nested IF here stands in for that mapping table, and the lesson says so.
//
// Every expected number is verified against public/data/hmda-raw.csv by
// test/gov-b-lessons.test.js, which re-derives them from the file. The
// affected ids are cross-checked against data/governance-manifest.json's
// categorical_variant list. NOTE: the raw file still contains 4 duplicate
// rows (see gov-duplicates); this lesson standardizes the file AS IS, so
// counts here are row counts over all 104 rows — the description says so
// rather than hiding it.

import { createLesson } from "../spec.js";
import { resolveSheet } from "../graders.js";
import { getCell, getValue } from "../../sheet/model.js";

const RAW = "hmda-raw.csv";

export const FIRST_ROW = 2;
export const LAST_ROW = 105;

/** Distinct race strings in the raw column, blank included. */
export const RAW_RACE_GROUPS = 13;
/** Distinct groups after standardization (6 real groups + Unknown). */
export const STD_RACE_GROUPS = 7;

// Ground truth, re-derived by the test from the CSV:
export const NAIVE_WHITE_COUNT = 47;  // COUNTIF "White": catches case variants, MISSES Caucasian
export const STD_WHITE_COUNT = 51;    // 42 White + 4 white + 1 WHITE + 4 Caucasian
export const STD_BLACK_N = 15;        // 12 Black + 2 black + 1 BLACK
export const STD_BLACK_APPROVED = 9;
export const STD_WHITE_APPROVED = 44;
export const STD_BLACK_RATE = STD_BLACK_APPROVED / STD_BLACK_N;      // 0.60
export const STD_WHITE_RATE = STD_WHITE_APPROVED / STD_WHITE_COUNT;  // ~0.8627

/**
 * The canonical mapping this lesson teaches. Exported so the test can apply
 * it independently to the CSV and confirm the lesson's constants.
 * Blank -> "Unknown" (never silently dropped: 6 rows have no race at all,
 * and a governance table must show them, not lose them).
 */
export function standardizeRace(v) {
  const s = v === undefined || v === null ? "" : String(v);
  if (s === "") return "Unknown";
  const l = s.toLowerCase();
  if (l === "caucasian" || l === "white") return "White";
  if (l === "black") return "Black";
  if (l === "asian") return "Asian";
  return s; // Hispanic, American Indian, Other arrive clean
}

/** approved arrives as APPROVED/Approved/Y and DENIED/N — same mapping idea. */
export function standardizeApproved(v) {
  const s = String(v ?? "");
  if (s === "Y") return "APPROVED";
  if (s === "N") return "DENIED";
  return s.toUpperCase();
}

// Solution formulas — also seed later checkpoints. The nested IF is the
// spreadsheet's version of a mapping table: one row per known variant,
// unknown values passed through UNCHANGED so a new variant shows up as its
// own group instead of being silently absorbed.
const raceStdFormula = (i) =>
  `=IF(C${i}="","Unknown",IF(LOWER(C${i})="caucasian","White",IF(LOWER(C${i})="white","White",` +
  `IF(LOWER(C${i})="black","Black",IF(LOWER(C${i})="asian","Asian",C${i})))))`;
const approvedStdFormula = (i) =>
  `=IF(H${i}="Y","APPROVED",IF(H${i}="N","DENIED",UPPER(H${i})))`;

function columnCells(col, header, makeFormula) {
  const cells = { [`${col}1`]: header };
  for (let i = FIRST_ROW; i <= LAST_ROW; i++) cells[`${col}${i}`] = makeFormula(i);
  return cells;
}

const I_CELLS = columnCells("I", "race_std", raceStdFormula);
const J_CELLS = columnCells("J", "approved_std", approvedStdFormula);

function checkpoint(cells = {}, pivot = null) {
  return {
    tool: "sheet",
    active: "Data",
    sheets: [{ name: "Data", load: [{ resource: RAW, origin: "A1" }], cells }],
    ...(pivot ? { pivot } : {}),
  };
}

const COUNT_VALUE = { field: "applicant_id", agg: "count" };
const EMPTY_PIVOT = { rows: [], cols: [], values: [], filters: {} };

/* A checkpoint is a COMPLETE resumable state of all prior work, not just the
   cells. Every step here that follows a pivot step must therefore carry that
   pivot forward — resuming at step 2 with no pivot silently discards the
   grouping the learner built in step 1, and test/guide-lessons.test.js fails
   the lesson for exactly that ("resuming at step 2 loses step 1's work"). The
   cells were carried and the pivot was not, which is easy to miss because the
   sheet still looks right. */
const RAW_GROUPED = { rows: ["race"], cols: [], values: [COUNT_VALUE], filters: {} };
const STD_GROUPED = { rows: ["race_std"], cols: [], values: [COUNT_VALUE], filters: {} };

/**
 * Per-row grader for a standardization column: every row must hold a FORMULA
 * whose value equals the canonical mapping of the source cell — recomputed
 * from the sheet at grade time, so the grader can never disagree with the
 * data. A typed-in column fails: the mapping IS the lesson, and a mapping
 * that exists only as 104 hand-typed strings cannot be re-applied to next
 * month's extract.
 */
function standardizedColumn(col, sourceCol, mapFn, what) {
  return (toolState) => {
    const sheet = resolveSheet(toolState, "Data");
    const diff = [];
    let ok = 0;
    for (let i = FIRST_ROW; i <= LAST_ROW; i++) {
      const ref = `${col}${i}`;
      const cell = getCell(sheet, ref);
      const want = mapFn(getValue(sheet, `${sourceCol}${i}`));
      if (!cell || cell.input === "" || cell.input == null) {
        diff.push({ kind: "missing", path: ref, expected: want, actual: null,
          hint: `${ref} is empty — fill ${col}${FIRST_ROW}'s mapping formula down through ${col}${LAST_ROW}.` });
        continue;
      }
      if (!cell.isFormula) {
        diff.push({ kind: "method", path: ref, expected: `a ${what} mapping formula`, actual: String(cell.input),
          hint: `${ref} holds a typed value. The mapping must be a formula so it can be re-applied to new data.` });
        continue;
      }
      const got = getValue(sheet, ref);
      if (got !== want) {
        diff.push({ kind: "wrong", path: ref, expected: want, actual: got ?? null,
          hint: `${ref} maps ${sourceCol}${i} to ${JSON.stringify(got ?? null)}; the standard is ${JSON.stringify(want)}.` });
        continue;
      }
      ok++;
    }
    const total = LAST_ROW - FIRST_ROW + 1;
    return {
      pass: diff.length === 0,
      score: ok / total,
      message: diff.length === 0
        ? `${col}${FIRST_ROW}:${col}${LAST_ROW} — all ${total} rows standardized.`
        : diff[0].hint,
      diff: diff.slice(0, 5),
    };
  };
}

/** The user's pivot must produce exactly `n` row groups — the wall itself. */
function pivotGroupCount(n, why) {
  return (toolState) => {
    const spec = toolState?.pivot?.spec;
    if (!spec || !spec.rows?.length || !spec.values?.length) {
      return { pass: false, message: "No pivot yet — put a field on Rows and a count on Values." };
    }
    // Count groups the same way the pivot engine does: distinct values of the
    // row field over the source grid, blanks bucketed as "(blank)".
    const sheet = resolveSheet(toolState, "Data");
    const field = spec.rows[0];
    const colByField = { race: "C", race_std: "I" };
    const col = colByField[field];
    if (!col) {
      return { pass: false, message: `Group by the race column for this step (got "${field}").` };
    }
    const seen = new Set();
    for (let i = FIRST_ROW; i <= LAST_ROW; i++) {
      const v = getValue(sheet, `${col}${i}`);
      seen.add(v === undefined || v === null || v === "" ? "(blank)" : v);
    }
    return {
      pass: seen.size === n,
      message: seen.size === n
        ? `${seen.size} groups — ${why}`
        : `Your grouping produces ${seen.size} groups; this step expects ${n}. ${why}`,
    };
  };
}

export const lesson = createLesson({
  id: "gov-standardize",
  tool: "sheet",
  moduleId: "aigovernance",
  mode: "guided",
  modes: ["outcome"],
  title: "Standardization: why the race column fractures into 13 groups",
  description:
    "Group the raw extract by race and you get thirteen groups, because \"White\", \"white\", \"WHITE\" " +
    "and \"Caucasian\" are four different strings meaning one thing — and six rows have no race at all. " +
    "This lesson builds the standardization mapping, applies it, and measures the damage the raw column " +
    "does to the exact fair-lending numbers the analytics labs taught. In a warehouse the mapping would " +
    "be a reference table or a CASE expression; the nested IF here is the same idea, small enough to " +
    "audit by eye. (The file also still carries 4 duplicate rows — see the duplicates lab — so all " +
    "counts here are row counts over the 104 rows as loaded.)",
  resources: [RAW],
  steps: [
    {
      id: "naive-pivot",
      title: "Hit the wall: group the raw race column",
      instruction:
        "How many applications are there in each race group? Build a pivot over A1:H105 that answers it " +
        "— race on Rows, a count of applicant_id on Values. Then actually READ the result: you asked for " +
        "race groups and got THIRTEEN, including three spellings of White, a separate \"Caucasian\", and " +
        "a (blank) bucket of 6 rows. Nothing about this table is presentable, and that is the point.",
      hints: [
        "A pivot needs one field on Rows and one on Values.",
        "race goes on Rows; count applicant_id on Values, exactly like the analytics labs.",
        "Rows: race. Values: applicant_id, aggregation Count.",
        "The table shows 13 rows: Black/black/BLACK, White/white/WHITE, Caucasian, Asian/asian, Hispanic, American Indian, Other, and (blank). Count them yourself before moving on.",
      ],
      target: { kind: "selector", selector: "[data-guide-target='sheet-grid']" },
      spotlightLabel: "Pivot the RAW race column and count the groups",
      checkpoint: checkpoint({}, { sourceRange: "A1:H105", spec: EMPTY_PIVOT }),
      grader: {
        type: "allOf",
        of: [
          { type: "pivotSpec", expected: { rows: ["race"], values: [COUNT_VALUE] } },
          {
            type: "predicate",
            label: "the raw grouping fractures into 13",
            fn: pivotGroupCount(RAW_RACE_GROUPS, "the raw column splits one population into thirteen labels."),
          },
        ],
      },
      modes: {
        outcome: {
          instruction:
            "Group the raw data by race and count applications per group. How many groups do you get, " +
            "and why is that number itself the finding?",
          hints: [
            "A pivot over A1:H105 with race on Rows gets you there.",
            "You should see 13 groups where a clean file would show 7 at most.",
          ],
          grader: {
            type: "allOf",
            of: [
              { type: "pivotResult", expected: { rows: ["race"], values: [COUNT_VALUE] } },
              {
                type: "predicate",
                label: "the raw grouping fractures into 13",
                fn: pivotGroupCount(RAW_RACE_GROUPS, "the raw column splits one population into thirteen labels."),
              },
            ],
          },
        },
      },
    },
    {
      id: "build-mapping",
      title: "Build the standardization mapping",
      instruction:
        "Make every race variant collapse to one standard label. Put race_std in I1, and in I2:I105 map " +
        "each row's race: any casing of white or caucasian becomes White, any casing of black becomes " +
        "Black, any casing of asian becomes Asian, a blank becomes Unknown, and anything else passes " +
        "through unchanged — an unmapped new variant must surface as its own group, never be silently " +
        "absorbed. Blanks are mapped, not dropped: 6 rows have no race, and the table must show them.",
      hints: [
        "This is a lookup from variant to standard — in a spreadsheet, a chain of IFs; in a warehouse, a reference table or CASE expression.",
        "Case-proof each test by lowering the input first: LOWER(C2)=\"caucasian\".",
        "Handle blank FIRST (C2=\"\"), then the known variants, then fall through to C2 itself.",
        "I2: =IF(C2=\"\",\"Unknown\",IF(LOWER(C2)=\"caucasian\",\"White\",IF(LOWER(C2)=\"white\",\"White\",IF(LOWER(C2)=\"black\",\"Black\",IF(LOWER(C2)=\"asian\",\"Asian\",C2))))) — fill down to I105.",
      ],
      target: { kind: "sheet-cell", ref: "I2" },
      spotlightLabel: "Map every race variant to its standard label",
      checkpoint: checkpoint({}, { sourceRange: "A1:H105", spec: RAW_GROUPED }),
      grader: {
        type: "predicate",
        label: "race_std mapping applied per row",
        fn: standardizedColumn("I", "C", standardizeRace, "race"),
      },
      modes: {
        outcome: {
          instruction:
            "Produce a race_std column in I (header in I1) where every one of the 104 rows carries a " +
            "single standard label per group — case variants unified, \"Caucasian\" folded into White, " +
            "blanks visible as Unknown, everything computed by formula so the mapping survives the next " +
            "extract.",
          hints: [
            "Decide the standard label for each variant first, then encode the decision as a formula.",
            "A blank race is data too — give it a label instead of losing it.",
          ],
        },
      },
    },
    {
      id: "regroup",
      title: "Re-group on the standardized column",
      instruction:
        "Same question as step 1 — how many applications per race group? — but now the pivot must be " +
        "trustworthy. Pivot A1:I105 with race_std on Rows and a count of applicant_id on Values. The " +
        "thirteen fragments collapse to 7 groups: the six real populations plus Unknown.",
      hints: [
        "Same pivot as before; only the grouping field changes.",
        "The source range has to reach column I so race_std is available.",
        "Rows: race_std. Values: Count of applicant_id.",
        "White reads 51 now — the 42 \"White\" rows plus white, WHITE, and the 4 Caucasian rows the raw grouping scattered.",
      ],
      target: { kind: "selector", selector: "[data-guide-target='sheet-grid']" },
      spotlightLabel: "Pivot race_std and watch 13 groups become 7",
      checkpoint: checkpoint(I_CELLS, { sourceRange: "A1:I105", spec: EMPTY_PIVOT }),
      grader: {
        type: "allOf",
        of: [
          { type: "pivotSpec", expected: { rows: ["race_std"], values: [COUNT_VALUE] } },
          {
            type: "predicate",
            label: "the standardized grouping is 7 groups",
            fn: pivotGroupCount(STD_RACE_GROUPS, "six real groups plus Unknown — a table you could hand to a regulator."),
          },
        ],
      },
      modes: {
        outcome: {
          instruction:
            "Produce the trustworthy version of step 1's table: one row per REAL race group (Unknown " +
            "included), with a count of applications in each.",
          hints: [
            "Group on your standardized column, not the raw one.",
            "Done right, the table has 7 rows and White counts 51.",
          ],
          grader: {
            type: "allOf",
            of: [
              { type: "pivotResult", expected: { rows: ["race_std"], values: [COUNT_VALUE] } },
              {
                type: "predicate",
                label: "the standardized grouping is 7 groups",
                fn: pivotGroupCount(STD_RACE_GROUPS, "six real groups plus Unknown."),
              },
            ],
          },
        },
      },
    },
    {
      id: "measure-damage",
      title: "Measure what the raw column got wrong",
      instruction:
        "Put a number on the damage. In L2, count White applications the naive way — a COUNTIF for " +
        "\"White\" against the RAW race column. In L3, count them against race_std. The naive count " +
        "finds 47 (COUNTIF ignores case, so white and WHITE sneak in) but silently drops the 4 " +
        "\"Caucasian\" rows; the standardized count finds all 51. Four records vanishing from the " +
        "BENCHMARK group is exactly the kind of error nothing downstream ever flags.",
      hints: [
        "Both cells are one COUNTIF; only the range differs.",
        "L2 counts over C2:C105, L3 over I2:I105, both with \"White\" as the criteria.",
        "L2: =COUNTIF($C$2:$C$105,\"White\") returns 47. Be honest about WHY it isn't 42: COUNTIF matches case-insensitively, so the miss is \"Caucasian\", not \"white\".",
        "L3: =COUNTIF($I$2:$I$105,\"White\") returns 51 — the count the fair-lending screen needed.",
      ],
      target: { kind: "sheet-cell", ref: "L2" },
      spotlightLabel: "Naive White count vs standardized White count",
      checkpoint: checkpoint(I_CELLS, { sourceRange: "A1:I105", spec: STD_GROUPED }),
      grader: {
        type: "allOf",
        of: [
          { type: "cellFormula", ref: "L2", mustUse: ["COUNTIF"], expectedValue: NAIVE_WHITE_COUNT },
          { type: "cellFormula", ref: "L3", mustUse: ["COUNTIF"], expectedValue: STD_WHITE_COUNT },
        ],
      },
      modes: {
        outcome: {
          instruction:
            "How many White applications does the raw race column report, and how many are there really? " +
            "Compute both numbers (L2 raw, L3 standardized) and account for the difference.",
          hints: [
            "Count \"White\" against the raw column and against your standardized column.",
            "The 4-record gap is the Caucasian rows — case variants alone don't explain it.",
          ],
          grader: {
            type: "allOf",
            of: [
              { type: "cellFormula", ref: "L2", expectedValue: NAIVE_WHITE_COUNT },
              { type: "cellFormula", ref: "L3", expectedValue: STD_WHITE_COUNT },
            ],
          },
        },
      },
    },
    {
      id: "fair-lending-payoff",
      title: "The fair-lending numbers, done right",
      instruction:
        "Now the analysis the analytics labs taught, on defensible inputs. The approved column has its " +
        "own variants (Y for APPROVED, N for DENIED, mixed casing) — standardize it into J (header " +
        "approved_std in J1, mapping in J2:J105). Then compute approval rates from the standardized " +
        "columns: Black in M2, White in M3. You should get 60.0% and 86.3% — a 26-point gap, and a " +
        "Black-to-White ratio near 0.70, well under the four-fifths line. One honesty caveat before you " +
        "quote it: Black is 15 rows here. That clears the n=10 floor the countifs lab set, but it is " +
        "still small — one flipped decision moves the rate by nearly 7 points, so report the n alongside " +
        "the rate.",
      hints: [
        "approved_std first: Y means APPROVED, N means DENIED, everything else just needs its case unified.",
        "J2: =IF(H2=\"Y\",\"APPROVED\",IF(H2=\"N\",\"DENIED\",UPPER(H2))) — fill down.",
        "A rate is approved-in-group over total-in-group: COUNTIFS over both std columns divided by COUNTIF over race_std.",
        "M2: =COUNTIFS($I$2:$I$105,\"Black\",$J$2:$J$105,\"APPROVED\")/COUNTIF($I$2:$I$105,\"Black\") gives 9/15 = 0.60. M3 the same for White gives 44/51.",
      ],
      target: { kind: "sheet-cell", ref: "M2" },
      spotlightLabel: "Standardize approved, then compute the two rates",
      checkpoint: checkpoint(
        {
          ...I_CELLS,
          L2: `=COUNTIF($C$2:$C$105,"White")`,
          L3: `=COUNTIF($I$2:$I$105,"White")`,
        },
        // Step 3's standardized grouping, still on screen. The learner built it
        // two steps ago and nothing since has replaced it.
        { sourceRange: "A1:I105", spec: STD_GROUPED },
      ),
      grader: {
        type: "allOf",
        of: [
          {
            type: "predicate",
            label: "approved_std mapping applied per row",
            fn: standardizedColumn("J", "H", standardizeApproved, "approval outcome"),
          },
          { type: "cellFormula", ref: "M2", mustUse: ["COUNTIFS"], expectedValue: STD_BLACK_RATE, tolerance: 1e-6 },
          { type: "cellFormula", ref: "M3", mustUse: ["COUNTIFS"], expectedValue: STD_WHITE_RATE, tolerance: 1e-6 },
        ],
      },
      modes: {
        outcome: {
          instruction:
            "What are the Black and White approval rates in this extract, computed on inputs you would " +
            "defend? Standardize whatever still needs standardizing, land the Black rate in M2 and the " +
            "White rate in M3, and state the group sizes you computed them over.",
          hints: [
            "The approved column has the same disease as race did — fix it the same way before counting.",
            "Right answers: 0.60 for Black (n=15 — small; say so when you quote it) and about 0.863 for White.",
          ],
          grader: {
            type: "allOf",
            of: [
              { type: "cellFormula", ref: "M2", expectedValue: STD_BLACK_RATE, tolerance: 1e-6 },
              { type: "cellFormula", ref: "M3", expectedValue: STD_WHITE_RATE, tolerance: 1e-6 },
            ],
          },
        },
      },
    },
  ],
});

export default lesson;
