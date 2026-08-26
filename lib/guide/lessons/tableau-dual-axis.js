// Guided lesson: dual-axis charts — comparing two measures on different
// scales without visual distortion from scaling artifacts.
//
// The core idea:
//   a single axis forces both measures to share a scale. If one ranges
//   60k–75k and the other 170k–230k, the smaller one flattens visually.
//   Two axes let each measure use its own scale, so patterns in both are
//   visible.
//
// Grading note: the viz engine has no "dual axis" toggle in its spec, so
// no step asserts one. An earlier version of this lesson graded
// { dual: true, synchronized: true } — keys the engine never had — and the
// grader silently skipped them, collapsing steps 2 and 3 into step 1.
// Every assertion below is a real shelf, mark, or data check.
//
// Ground truth (verified against public/data/hmda-sample.csv):
//   AVG(income) by race spans 64.8k (American Indian) to 74.6k (Hispanic);
//   AVG(loan_amount) spans 170.7k (Other) to 229.6k (Asian) — roughly
//   3x larger, which is exactly the shared-scale problem dual axes solve.

import { createLesson } from "../spec.js";

const HMDA = "hmda-sample.csv";

const AVG_INCOME = { field: "income", aggregation: "AVG" };
const AVG_LOAN = { field: "loan_amount", aggregation: "AVG" };

/** Verified average income per race. */
export const EXPECTED_AVG_INCOME = [
  { race: "American Indian", "AVG(income)": 194500 / 3 },
  { race: "Asian", "AVG(income)": 73650 },
  { race: "Black", "AVG(income)": 66562.5 },
  { race: "Hispanic", "AVG(income)": 1343500 / 18 },
  { race: "Other", "AVG(income)": 74000 },
  { race: "White", "AVG(income)": 71720 },
];

/** Verified average loan amount per race. */
export const EXPECTED_AVG_LOAN = [
  { race: "American Indian", "AVG(loan_amount)": 630500 / 3 },
  { race: "Asian", "AVG(loan_amount)": 229550 },
  { race: "Black", "AVG(loan_amount)": 197000 },
  { race: "Hispanic", "AVG(loan_amount)": 3768000 / 18 },
  { race: "Other", "AVG(loan_amount)": 512000 / 3 },
  { race: "White", "AVG(loan_amount)": 227550 },
];

function vizCheckpoint(extra = {}) {
  return { tool: "viz", data: { resource: HMDA }, ...extra };
}

export const lesson = createLesson({
  id: "tableau-dual-axis",
  tool: "viz",
  moduleId: "tableau",
  mode: "guided",
  voice: true,
  title: "Dual axes: comparing measures on different scales",
  description:
    "When you plot two measures that don't share a scale — like income and loan amounts — one dwarfs " +
    "the other visually. In Tableau, a dual-axis chart gives each its own axis so both patterns are " +
    "readable. Here you build the two-measure view, see the shared-scale problem it creates, and " +
    "verify both series carry the right numbers before you would split the axes.",
  resources: [HMDA],
  steps: [
    {
      id: "first-measure",
      title: "One measure, one scale",
      instruction:
        "Build race on Columns and AVG(income) on Rows, as bars. The bars span roughly 64.8 to 74.6 " +
        "thousand — an 11% spread that is easy to read when income owns the whole axis. Keep that " +
        "spread in mind: it is about to vanish.",
      hints: [
        "Columns: race. Rows: income, aggregated as AVG.",
        "Make sure the income pill reads AVG, not SUM — right-click the pill to change it.",
        "American Indian is lowest (64.8k), Hispanic highest (74.6k).",
        "Columns: race. Rows: AVG(income). Mark: bar.",
      ],
      checkpoint: vizCheckpoint(),
      grader: {
        type: "vizSpec",
        expected: { columns: ["race"], rows: [AVG_INCOME], mark: "bar" },
      },
      target: { kind: "region", anchor: "viz-columns" },
      spotlightLabel: "Build race by average income",
    },
    {
      id: "single-axis-problem",
      title: "The single-axis problem",
      instruction:
        "Now add AVG(loan_amount) to the same Rows shelf. Loan amounts run 170k to 230k — about three " +
        "times income — so on one shared scale the loan bars tower and income's 11% spread flattens " +
        "into near-identical stubs. This is the problem a dual axis exists to solve: in full Tableau " +
        "you would right-click the second pill and pick Dual Axis, giving each measure its own scale.",
      hints: [
        "Drag loan_amount to Rows, next to AVG(income). Aggregate it as AVG.",
        "Income bars read 64.8k–74.6k; loan bars read 170.7k–229.6k on the same view.",
        "The pattern in income is still there — it's just visually crushed by loan_amount's scale.",
        "Rows: AVG(income) and AVG(loan_amount). Columns: race. Mark: bar.",
      ],
      checkpoint: vizCheckpoint({
        shelves: { columns: ["race"], rows: [AVG_INCOME] },
        mark: "bar",
      }),
      grader: {
        type: "vizSpec",
        expected: { columns: ["race"], rows: [AVG_INCOME, AVG_LOAN], mark: "bar" },
      },
      target: { kind: "region", anchor: "viz-rows" },
      spotlightLabel: "Add average loan amount to Rows",
    },
    {
      id: "verify-both-series",
      title: "Verify both series before splitting the axes",
      instruction:
        "Before splitting axes, confirm both series are computed correctly — a dual axis on wrong " +
        "numbers is just two wrong charts. Check the marks: Asian leads loans (229.6k) but Hispanic " +
        "leads income (74.6k), and Black is lowest on both loans (197k) and near-lowest on income " +
        "(66.6k). The two measures do NOT rank the groups identically — which is exactly what a " +
        "synchronized dual axis would make readable at a glance.",
      hints: [
        "Both pills must be AVG. A SUM pill would make White dominate simply by headcount (50 of 100 rows).",
        "Hover the marks: income 64.8k–74.6k, loan 170.7k–229.6k.",
        "Compare Asian (highest loans, 229.6k) with Hispanic (highest income, 74.6k) — the rankings differ.",
        "Columns: race. Rows: AVG(income), AVG(loan_amount). Mark: bar. All twelve values match the data.",
      ],
      checkpoint: vizCheckpoint({
        shelves: { columns: ["race"], rows: [AVG_INCOME, AVG_LOAN] },
        mark: "bar",
      }),
      grader: {
        type: "allOf",
        of: [
          { type: "vizSpec", expected: { columns: ["race"], rows: [AVG_INCOME, AVG_LOAN], mark: "bar" } },
          { type: "vizData", expected: EXPECTED_AVG_INCOME, keyFields: ["race"], tolerance: 1 },
          { type: "vizData", expected: EXPECTED_AVG_LOAN, keyFields: ["race"], tolerance: 1 },
        ],
      },
      target: { kind: "region", anchor: "viz-rows" },
      spotlightLabel: "Confirm both measures compute correctly",
    },
  ],
});

export default lesson;
