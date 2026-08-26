// Guided lesson: calculated fields — a new column computed from existing
// ones, live in the data pane. The field here is the underwriter's favorite:
// loan-to-income ratio, [loan_amount] / [income].
//
// Ground truth (verified against public/data/hmda-sample.csv):
//   AVG(loan_to_income) by race: American Indian 2.9976, Asian 3.1444,
//     Black 2.9333, Hispanic 2.8075, Other 2.3453, White 3.1481
//   AVG by decision: APPROVED 3.0595, DENIED 2.9093 — denied applicants did
//   NOT ask for disproportionately larger loans; the ask doesn't explain
//   the approval gap.
//
// Grading doctrine:
//   - step 1 is a predicate that grades the calculated field by OUTCOME —
//     any expression computing loan/income for all 100 rows passes — while
//     pinning the NAME (later steps reference it), and it diagnoses the
//     classic inverted division ([income]/[loan_amount]) by name;
//   - step 2 grades the METHOD (vizSpec): the pill and its AVG;
//   - step 3 adds the OUTCOME (vizData): the bars must carry the true ratios.

import { createLesson } from "../spec.js";
import { applyCalculatedFields } from "../../viz/fields.js";

const HMDA = "hmda-sample.csv";

const CALC = { name: "loan_to_income", expression: "[loan_amount] / [income]" };
const AVG_LTI = { field: "loan_to_income", aggregation: "AVG" };

/** Verified AVG(loan_to_income) per race. */
export const EXPECTED_LTI = [
  { race: "American Indian", "AVG(loan_to_income)": 2.9975606404177833 },
  { race: "Asian", "AVG(loan_to_income)": 3.144403122090766 },
  { race: "Black", "AVG(loan_to_income)": 2.933277437951626 },
  { race: "Hispanic", "AVG(loan_to_income)": 2.8075268759567784 },
  { race: "Other", "AVG(loan_to_income)": 2.3453246873050433 },
  { race: "White", "AVG(loan_to_income)": 3.148088925790043 },
];

/**
 * OUTCOME grader for the calculated field: exact name, and every row's value
 * must equal loan_amount / income (derived from the data itself — no copy of
 * the file lives in the lesson). Diagnoses the inverted ratio by name.
 */
function ltiFieldCheck(toolState) {
  const calcs = toolState?.spec?.calculatedFields ?? [];
  const names = calcs.map((c) => c.name);
  const cf = calcs.find((c) => c.name === "loan_to_income");
  if (!cf) {
    const hint = names.length
      ? `Found calculated field(s) named ${names.join(", ")} — the lesson needs one named exactly loan_to_income.`
      : "Create a calculated field named exactly loan_to_income.";
    return {
      pass: false,
      message: hint,
      expected: "a calculated field named loan_to_income",
      actual: names.join(", ") || null,
      diff: [{ kind: "missing", path: "calculatedFields", expected: "loan_to_income", actual: names.join(", ") || null, hint }],
    };
  }

  let rows;
  try {
    rows = applyCalculatedFields(toolState.rows, [cf]);
  } catch (err) {
    const hint = `loan_to_income doesn't evaluate: ${err.message}`;
    return {
      pass: false,
      score: 0.25,
      message: hint,
      expected: CALC.expression,
      actual: cf.expression ?? null,
      diff: [{ kind: "wrong", path: "calculatedFields.loan_to_income", expected: CALC.expression, actual: cf.expression ?? null, hint }],
    };
  }

  const tol = 1e-9;
  let ok = 0;
  let inverted = 0;
  for (const r of rows) {
    const expected = r.loan_amount / r.income;
    const v = r.loan_to_income;
    if (typeof v === "number" && Math.abs(v - expected) <= tol * Math.max(1, expected)) ok++;
    else if (typeof v === "number" && Math.abs(v - r.income / r.loan_amount) <= tol) inverted++;
  }
  if (ok === rows.length) {
    return { pass: true, message: "loan_to_income computes loan ÷ income on all 100 rows — exactly right." };
  }
  const hint =
    inverted > rows.length / 2
      ? "Your ratios are all under 1 — you divided income by loan_amount. The convention is loan ÷ income: how many years of income the loan represents."
      : `loan_to_income is right on ${ok} of ${rows.length} rows. It should be [loan_amount] / [income] on every row.`;
  return {
    pass: false,
    score: 0.5,
    message: hint,
    expected: "[loan_amount] / [income] on all rows",
    actual: cf.expression ?? null,
    diff: [{ kind: "wrong", path: "calculatedFields.loan_to_income", expected: CALC.expression, actual: cf.expression ?? null, hint }],
  };
}

function vizCheckpoint(extra = {}) {
  return { tool: "viz", data: { resource: HMDA }, ...extra };
}

export const lesson = createLesson({
  id: "tableau-calc",
  tool: "viz",
  moduleId: "tableau",
  mode: "guided",
  // Outcome variant: business questions, no formulas, vizData graders where
  // an outcome grader exists. Same step ids and checkpoints as guided.
  modes: ["outcome"],
  voice: true,
  title: "Calculated fields: the loan-to-income ratio",
  description:
    "The data has loan amounts and incomes but not the number an underwriter actually reads: how many " +
    "times their income is this applicant borrowing? A calculated field mints that column once, and " +
    "every shelf can use it forever after. Then the chart it builds quietly demolishes one explanation " +
    "for the approval gap.",
  resources: [HMDA],
  steps: [
    {
      id: "create-ratio",
      title: "Mint the field",
      instruction:
        "Create a calculated field named exactly loan_to_income with the formula " +
        "[loan_amount] / [income]. A value of 3 means the applicant is borrowing three years of " +
        "income. Watch the direction of the division — ratio conventions matter.",
      hints: [
        "Analysis → Create Calculated Field. Reference columns in [brackets].",
        "Loan divided by income — the bigger number on top, typically giving values around 2-4 here.",
        "If your values come out around 0.3, you inverted it: that's income ÷ loan.",
        "Name: loan_to_income. Formula: [loan_amount] / [income].",
      ],
      checkpoint: vizCheckpoint(),
      grader: { type: "predicate", fn: ltiFieldCheck, label: "The loan_to_income calculated field" },
      target: { kind: "region", anchor: "viz-fieldlist" },
      spotlightLabel: "Create the loan_to_income calculated field",
      modes: {
        outcome: {
          instruction:
            "How many years of income is each applicant asking to borrow? Mint a field named exactly " +
            "loan_to_income that answers it per applicant — values land around 2-4 in this file.",
          hints: [
            "A value of 3 means the loan is three times the applicant's annual income.",
            "If your values hover near 0.3, the ratio is upside down.",
          ],
          // No grader override: the base predicate is already an OUTCOME
          // grader — any expression computing the ratio on all rows passes.
        },
      },
    },
    {
      id: "ratio-by-race",
      title: "Average ask by group",
      instruction:
        "Build the comparison: race on Columns, loan_to_income on Rows aggregated as AVG (it lands as " +
        "SUM by default — change it). The bars should hover between 2.3 and 3.2.",
      hints: [
        "Same recipe as every bar chart: dimension on Columns, measure on Rows.",
        "The new field behaves exactly like a native measure — drag it from the data pane.",
        "Right-click the pill → Measure → Average. SUM would just mirror group sizes again.",
        "Columns: race. Rows: AVG(loan_to_income). White sits at ~3.15, Other at ~2.35.",
      ],
      checkpoint: vizCheckpoint({ calculatedFields: [CALC] }),
      grader: {
        type: "vizSpec",
        expected: { columns: ["race"], rows: [AVG_LTI] },
      },
      target: { kind: "region", anchor: "viz-columns" },
      spotlightLabel: "Build race by average loan to income",
      modes: {
        outcome: {
          instruction:
            "Does any race group ask for disproportionately larger loans relative to income? Show a " +
            "typical ask per group so the six can be compared fairly.",
          hints: [
            "One value per race group on a comparable scale — a per-group total would just mirror group size.",
            "White should land near 3.15 and Other near 2.35.",
          ],
          // Method grader (vizSpec shelf recipe) swapped for OUTCOME: the true
          // six ratios must appear, by any route.
          grader: { type: "vizData", expected: EXPECTED_LTI, keyFields: ["race"], tolerance: 1e-6 },
        },
      },
    },
    {
      id: "bar-and-read",
      title: "Bars up — and read the finding",
      instruction:
        "Set the mark to bar and read it against what you know: Black applicants ask for LESS relative " +
        "to income (2.93) than White applicants (3.15), yet approve at 56% vs 86%. The size of the ask " +
        "does not explain the approval gap — write that sentence down; it's the analyst's job in one " +
        "line.",
      hints: [
        "Discrete on Columns + continuous on Rows: Automatic resolves to bar by itself.",
        "Compare the Black and White bars — they're nearly level.",
        "Now recall the rate chart: 30 points apart. Similar asks, different outcomes.",
        "Mark: bar. Values: 3.00, 3.14, 2.93, 2.81, 2.35, 3.15 (alphabetical).",
      ],
      checkpoint: vizCheckpoint({
        calculatedFields: [CALC],
        shelves: { columns: ["race"], rows: [AVG_LTI] },
      }),
      grader: {
        type: "allOf",
        of: [
          { type: "vizSpec", expected: { mark: "bar", columns: ["race"], rows: [AVG_LTI] } },
          { type: "vizData", expected: EXPECTED_LTI, keyFields: ["race"], tolerance: 1e-6 },
        ],
      },
      target: { kind: "region", anchor: "viz-showme" },
      spotlightLabel: "Set the mark to bar and compare bars",
      modes: {
        outcome: {
          instruction:
            "Make the comparison readable as bars, then answer the governance question: does the size " +
            "of the ask explain the approval gap?",
          hints: [
            "Compare the Black and White bars — nearly level (2.93 vs 3.15).",
            "Recall the rate chart: 30 points apart. Similar asks, different outcomes.",
          ],
          // Shelf recipe dropped; the mark check reads resolveMark() — the
          // rendered result — and vizData pins the numbers.
          grader: {
            type: "allOf",
            of: [
              { type: "vizSpec", expected: { mark: "bar" } },
              { type: "vizData", expected: EXPECTED_LTI, keyFields: ["race"], tolerance: 1e-6 },
            ],
          },
        },
      },
    },
  ],
});

export default lesson;
