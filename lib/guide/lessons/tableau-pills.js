// Guided lesson: what a pill really is — the same field re-aggregated
// (SUM → AVG → MEDIAN) and re-typed (continuous → discrete), with the chart
// changing meaning each time while the data never moves.
//
// Ground truth (verified against public/data/hmda-sample.csv):
//   AVG(loan_amount):    American Indian 210166.67, Asian 229550,
//     Black 197000, Hispanic 209333.33, Other 170666.67, White 227550
//   MEDIAN(loan_amount): American Indian 204000, Asian 224500, Black 201000,
//     Hispanic 213000, Other 200000, White 213000
//   (White AVG 227550 > MEDIAN 213000 — the $401k loan drags the mean.)
//
// Grading doctrine: vizSpec (METHOD) drives every step — the aggregation and
// the discrete flag ON THE PILL are the lesson — and the two aggregation
// steps add vizData (OUTCOME) so the axis must carry the true values.

import { createLesson } from "../spec.js";

const HMDA = "hmda-sample.csv";

/** Verified AVG(loan_amount) per race. */
export const EXPECTED_AVG_LOAN = [
  { race: "American Indian", "AVG(loan_amount)": 630500 / 3 },
  { race: "Asian", "AVG(loan_amount)": 229550 },
  { race: "Black", "AVG(loan_amount)": 197000 },
  { race: "Hispanic", "AVG(loan_amount)": 3768000 / 18 },
  { race: "Other", "AVG(loan_amount)": 512000 / 3 },
  { race: "White", "AVG(loan_amount)": 227550 },
];

/** Verified MEDIAN(loan_amount) per race. */
export const EXPECTED_MEDIAN_LOAN = [
  { race: "American Indian", "MEDIAN(loan_amount)": 204000 },
  { race: "Asian", "MEDIAN(loan_amount)": 224500 },
  { race: "Black", "MEDIAN(loan_amount)": 201000 },
  { race: "Hispanic", "MEDIAN(loan_amount)": 213000 },
  { race: "Other", "MEDIAN(loan_amount)": 200000 },
  { race: "White", "MEDIAN(loan_amount)": 213000 },
];

function vizCheckpoint(rowsPill) {
  return {
    tool: "viz",
    data: { resource: HMDA },
    shelves: { columns: ["race"], rows: [rowsPill] },
    mark: "bar",
  };
}

export const lesson = createLesson({
  id: "tableau-pills",
  tool: "viz",
  moduleId: "tableau",
  mode: "guided",
  // Outcome variant: same step ids and checkpoints; the two aggregation
  // steps grade only the computed values (vizData), the discrete step keeps
  // its method grader — no outcome grader can see headers-vs-axis.
  modes: ["outcome"],
  voice: true,
  title: "One pill, four charts: aggregation and discrete vs continuous",
  description:
    "The view starts as SUM(loan_amount) by race — and it's misleading: White's bar towers because " +
    "there are 50 White applicants, not because their loans are bigger. You'll fix the story by " +
    "changing ONLY the pill: SUM to AVG, AVG to MEDIAN, then continuous to discrete to see what an " +
    "axis actually is.",
  resources: [HMDA],
  steps: [
    {
      id: "sum-to-avg",
      title: "SUM lies here — switch to AVG",
      instruction:
        "The view shows SUM(loan_amount) by race: White reads $11.4M, five times everyone else — " +
        "because SUM scales with group SIZE. Right-click the pill on Rows → Measure → Average. Now " +
        "the bars are typical loans, and the groups nearly level out.",
      hints: [
        "The bars currently answer \"how much money total?\" The question is \"how big is a typical loan?\"",
        "The aggregation lives on the pill, not the field: right-click it → Measure.",
        "Pick Average. The pill caption changes from SUM(loan_amount) to AVG(loan_amount).",
        "Rows: AVG(loan_amount). Asian leads at ~$229.6k, Other trails at ~$170.7k — a 1.3× spread, not 20×.",
      ],
      checkpoint: vizCheckpoint({ field: "loan_amount", aggregation: "SUM" }),
      grader: {
        type: "allOf",
        of: [
          { type: "vizSpec", expected: { columns: ["race"], rows: [{ field: "loan_amount", aggregation: "AVG" }] } },
          { type: "vizData", expected: EXPECTED_AVG_LOAN, keyFields: ["race"] },
        ],
      },
      target: { kind: "region", anchor: "viz-rows" },
      spotlightLabel: "Switch the Rows pill to average",
      modes: {
        outcome: {
          instruction:
            "The chart currently answers \"how much money in total?\" — and White towers simply " +
            "because there are 50 White applicants. Make it answer \"how big is a typical loan in " +
            "each group?\" instead.",
          hints: [
            "You need a comparable per-group figure, not a total that scales with group size.",
            "Asian should lead near $229.6k and Other trail near $170.7k — a 1.3x spread, not 20x.",
          ],
          // Method half (vizSpec pill recipe) dropped; the OUTCOME half stays.
          grader: { type: "vizData", expected: EXPECTED_AVG_LOAN, keyFields: ["race"] },
        },
      },
    },
    {
      id: "avg-to-median",
      title: "AVG to MEDIAN: outlier insurance",
      instruction:
        "One $401k loan sits in the White group, pulling its average up. Change the aggregation again, " +
        "to Median. White drops from $227.6k to $213k — dead even with Hispanic. When a chart drives a " +
        "decision, check whether mean and median tell the same story.",
      hints: [
        "Same move as before: right-click the pill → Measure → Median.",
        "The median is the middle loan — one giant loan can't move it.",
        "Compare White before and after: 227550 vs 213000. That difference IS the outlier.",
        "Rows: MEDIAN(loan_amount). White and Hispanic tie at 213000; Asian still leads at 224500.",
      ],
      checkpoint: vizCheckpoint({ field: "loan_amount", aggregation: "AVG" }),
      grader: {
        type: "allOf",
        of: [
          { type: "vizSpec", expected: { columns: ["race"], rows: [{ field: "loan_amount", aggregation: "MEDIAN" }] } },
          { type: "vizData", expected: EXPECTED_MEDIAN_LOAN, keyFields: ["race"] },
        ],
      },
      target: { kind: "region", anchor: "viz-rows" },
      spotlightLabel: "Switch the Rows pill to median",
      modes: {
        outcome: {
          instruction:
            "One $401k loan sits in the White group and drags its figure up. Re-express the chart so " +
            "no single outlier can move any group's value.",
          hints: [
            "The value one giant loan cannot move is the group's middle loan.",
            "White should fall to 213000 — dead even with Hispanic.",
          ],
          // Method half dropped; the OUTCOME half (the true medians) stays.
          grader: { type: "vizData", expected: EXPECTED_MEDIAN_LOAN, keyFields: ["race"] },
        },
      },
    },
    {
      id: "continuous-to-discrete",
      title: "Green to blue: where the axis goes",
      instruction:
        "Right-click the MEDIAN(loan_amount) pill and switch it from Continuous to Discrete. The pill " +
        "turns blue, the AXIS disappears, and the medians become text HEADERS. Same numbers, no " +
        "geometry. Continuous = an axis with positions; discrete = labels in slots. That's the whole " +
        "green/blue distinction — it's about the axis, not about being numeric.",
      hints: [
        "Discrete vs continuous is a property of the PILL — any pill, even an aggregated measure.",
        "Right-click MEDIAN(loan_amount) → Discrete.",
        "Watch the axis: it vanishes, because discrete pills produce headers, not positions.",
        "Rows: MEDIAN(loan_amount) as a BLUE pill. The view degrades to labeled numbers — which is why measures usually stay green.",
      ],
      checkpoint: vizCheckpoint({ field: "loan_amount", aggregation: "MEDIAN" }),
      grader: {
        type: "vizSpec",
        expected: { columns: ["race"], rows: [{ field: "loan_amount", aggregation: "MEDIAN", discrete: true }] },
      },
      target: { kind: "region", anchor: "viz-rows" },
      spotlightLabel: "Switch the Rows pill to discrete",
      modes: {
        outcome: {
          instruction:
            "Strip the geometry: make the same six values appear as labeled text in slots, with no " +
            "axis at all. What did the axis turn out to be?",
          hints: [
            "Same numbers — the change is in the pill's TYPE, not what it computes.",
            "Watch the axis disappear; positions become headers.",
          ],
          // NO outcome grader exists for headers-vs-axis: vizData sees the
          // same numbers either way, so the base vizSpec method grader (the
          // discrete flag on the pill) is kept.
        },
      },
    },
  ],
});

export default lesson;
