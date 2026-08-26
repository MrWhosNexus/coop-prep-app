// Guided lesson: dual-axis charts — comparing two measures on different
// scales without visual distortion from scaling artifacts.
//
// The core idea:
//   a single axis forces both measures to share a scale. If one ranges
//   1–100 and the other 50,000–250,000, smaller values vanish visually.
//   Two axes let each measure use its own scale, so patterns in both are
//   visible.
//
// Ground truth (verified against public/data/hmda-sample.csv):
//   AVG(income) and AVG(loan_amount) by race (see tableau-detail.js for
//   verified points). On a single axis, loan_amount dominates (3×–4×
//   larger); on dual axes, income's variation (64k–74k) is as visible
//   as loan's (170k–229k).
//

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
    "the other visually. A dual-axis chart gives each its own axis, so both patterns are readable. " +
    "The recipe is simple: two pills on Rows, synchronize the axes, then read the alignment.",
  resources: [HMDA],
  steps: [
    {
      id: "single-axis-problem",
      title: "The single-axis problem",
      instruction:
        "Build race on Columns and AVG(income) on Rows. The bars reach about 60–74 thousand. Now add " +
        "AVG(loan_amount) to the same Rows shelf. Loan amounts are 150k–230k — three times bigger — so " +
        "they dwarf income. Both are bars, same axis, loan wins visually. This is the problem a dual " +
        "axis solves.",
      hints: [
        "Columns: race. Rows: AVG(income), then AVG(loan_amount) stacked on the same axis.",
        "Income bars read 64k–74k; loan bars read 170k–229k on the same scale.",
        "When you drag a second measure to a shelf that already has one, Tableau stacks or groups them on one axis.",
        "Mark: bar. The loan amounts tower over income — the pattern in income vanishes.",
      ],
      checkpoint: vizCheckpoint(),
      grader: {
        type: "vizSpec",
        expected: { columns: ["race"], rows: [AVG_INCOME, AVG_LOAN], mark: "bar" },
      },
      target: { kind: "region", anchor: "viz-columns" },
      spotlightLabel: "Build race × income and loan amount",
    },
    {
      id: "second-axis",
      title: "Create a second axis",
      instruction:
        "Right-click the AVG(loan_amount) pill on Rows → Dual Axis. A second Rows axis appears on the " +
        "right side of the chart, scaled for loan amounts. Now income and loan_amount are on different " +
        "axes — each can use its own scale. Both patterns are visible.",
      hints: [
        "Right-click the AVG(loan_amount) pill (it should be the second one on Rows).",
        "Pick Dual Axis. The chart grows a second Y-axis on the right.",
        "Income bars now climb the left axis (0–100k); loan bars climb the right axis (100k–250k).",
        "Rows: AVG(income) on left axis, AVG(loan_amount) on right axis (dual). Mark: bar.",
      ],
      checkpoint: vizCheckpoint({
        shelves: { columns: ["race"], rows: [AVG_INCOME, AVG_LOAN] },
        mark: "bar",
      }),
      grader: {
        type: "vizSpec",
        expected: { columns: ["race"], rows: [AVG_INCOME, AVG_LOAN], dual: true, mark: "bar" },
      },
      target: { kind: "region", anchor: "viz-rows" },
      spotlightLabel: "Right-click loan amount and select Dual Axis",
    },
    {
      id: "synchronize-axes",
      title: "Synchronize the axes to align the baselines",
      instruction:
        "The two axes are INDEPENDENT — if you adjust one's scale, the bars shift. Right-click either " +
        "axis title (on the left or right edge) and pick Synchronize Axis. Now both axes are anchored " +
        "to the same zero, and proportional increases in income and loan show as parallel movements — " +
        "you can see whether they move in sync or diverge.",
      hints: [
        "Synchronize locks both axes to the same baseline. Without it, the axes scale independently.",
        "Right-click either axis title (left or right). Pick Synchronize Axis.",
        "Now both scale from zero. If income and loan amounts grow in parallel, the bars climb together.",
        "Compare White (highest on both) and Black (lowest on both) — aligned by dual axes.",
      ],
      checkpoint: vizCheckpoint({
        shelves: { columns: ["race"], rows: [AVG_INCOME, AVG_LOAN] },
        mark: "bar",
        dual: true,
      }),
      grader: {
        type: "allOf",
        of: [
          { type: "vizSpec", expected: { columns: ["race"], rows: [AVG_INCOME, AVG_LOAN], dual: true, synchronized: true, mark: "bar" } },
          { type: "vizData", expected: EXPECTED_AVG_INCOME, keyFields: ["race"], tolerance: 1 },
          { type: "vizData", expected: EXPECTED_AVG_LOAN, keyFields: ["race"], tolerance: 1 },
        ],
      },
      target: { kind: "region", anchor: "viz-rows" },
      spotlightLabel: "Synchronize the dual axes to align baselines",
    },
  ],
});

export default lesson;
