// Guided lesson: color as an encoding — a third data channel, not paint.
//
// Two different animals, one shelf:
//   a DIMENSION on Color → a categorical palette (one hue per member) and
//     one mark PER member per slot — color slices, just like a shelf;
//   a MEASURE on Color → a sequential ramp (light → dark) — color encodes
//     magnitude.
//
// Ground truth (verified against public/data/hmda-sample.csv):
//   race × approved counts: American Indian 2/1, Asian 8/2, Black 9/7,
//   Hispanic 12/6, Other 2/1, White 43/7  (12 marks — every group has both)
//   AVG(is_approved) ramp domain: 0.5625 (Black) → 0.86 (White)
//
// Grading doctrine: vizSpec for the drop (METHOD — the shelf is the lesson),
// vizData for the split counts (OUTCOME), and a predicate over the REAL
// render plan's legends for the ramp — the legend the user would read is the
// thing being graded.

import { createLesson } from "../spec.js";
import { buildRenderPlan } from "../../viz/render-plan.js";

const HMDA = "hmda-sample.csv";

const CALC = { name: "is_approved", expression: 'IF([approved] = "APPROVED", 1, 0)' };
const COUNT_PILL = { field: "applicant_id", aggregation: "COUNT" };

/** Verified race × approved counts — one entry per colored mark segment. */
export const SPLIT_COUNTS = [
  { race: "American Indian", approved: "APPROVED", "COUNT(applicant_id)": 2 },
  { race: "American Indian", approved: "DENIED", "COUNT(applicant_id)": 1 },
  { race: "Asian", approved: "APPROVED", "COUNT(applicant_id)": 8 },
  { race: "Asian", approved: "DENIED", "COUNT(applicant_id)": 2 },
  { race: "Black", approved: "APPROVED", "COUNT(applicant_id)": 9 },
  { race: "Black", approved: "DENIED", "COUNT(applicant_id)": 7 },
  { race: "Hispanic", approved: "APPROVED", "COUNT(applicant_id)": 12 },
  { race: "Hispanic", approved: "DENIED", "COUNT(applicant_id)": 6 },
  { race: "Other", approved: "APPROVED", "COUNT(applicant_id)": 2 },
  { race: "Other", approved: "DENIED", "COUNT(applicant_id)": 1 },
  { race: "White", approved: "APPROVED", "COUNT(applicant_id)": 43 },
  { race: "White", approved: "DENIED", "COUNT(applicant_id)": 7 },
];

/**
 * OUTCOME grader for the ramp step: the render plan must carry a CONTINUOUS
 * (sequential) color legend for AVG(is_approved) — a categorical palette
 * means the pill landed unaggregated or discrete.
 */
function sequentialLegendCheck(toolState) {
  if (!toolState?.spec || !toolState?.rows) {
    return { pass: false, message: "No view yet — the check needs a spec and data.", diff: [] };
  }
  let plan;
  try {
    plan = buildRenderPlan(toolState.spec, toolState.rows);
  } catch (err) {
    return { pass: false, message: `The view can't be built yet: ${err.message}`, diff: [] };
  }
  const legend = (plan.legends ?? []).find((l) => l.field === "is_approved");
  if (!legend) {
    const hint = "There's no color legend for is_approved — drop AVG(is_approved) on the Color shelf.";
    return {
      pass: false,
      message: hint,
      expected: "a sequential color legend for AVG(is_approved)",
      actual: (plan.legends ?? []).map((l) => `${l.type} legend for ${l.field}`).join(", ") || null,
      diff: [{ kind: "missing", path: "color", expected: "AVG(is_approved)", actual: null, hint }],
    };
  }
  if (legend.type !== "sequential") {
    const hint =
      "The is_approved legend is a categorical palette, not a light-to-dark ramp — the pill on Color " +
      "must be AGGREGATED (AVG) and continuous to encode magnitude.";
    return {
      pass: false,
      score: 0.5,
      message: hint,
      expected: "sequential",
      actual: legend.type,
      diff: [{ kind: "wrong", path: "color.is_approved", expected: "sequential", actual: legend.type, hint }],
    };
  }
  return {
    pass: true,
    message: "The color ramp runs from the lowest approval rate (0.5625) to the highest (0.86) — exactly right.",
  };
}

/**
 * OUTCOME grader for the split step's outcome variant: the render plan must
 * carry a CATEGORICAL color legend for `approved` — the legend the learner
 * reads is the evidence the split happened via color, not via a new axis.
 */
function categoricalApprovedLegendCheck(toolState) {
  if (!toolState?.spec || !toolState?.rows) {
    return { pass: false, message: "No view yet — the check needs a spec and data.", diff: [] };
  }
  let plan;
  try {
    plan = buildRenderPlan(toolState.spec, toolState.rows);
  } catch (err) {
    return { pass: false, message: `The view can't be built yet: ${err.message}`, diff: [] };
  }
  const legend = (plan.legends ?? []).find((l) => l.field === "approved" && l.type === "categorical");
  if (!legend) {
    const hint =
      "There's no two-entry color legend for the decision — the split has to ride on color, not on a new axis.";
    return {
      pass: false,
      message: hint,
      expected: "a categorical color legend for approved",
      actual: (plan.legends ?? []).map((l) => `${l.type} legend for ${l.field}`).join(", ") || null,
      diff: [{ kind: "missing", path: "color", expected: "approved", actual: null, hint }],
    };
  }
  return { pass: true, message: "APPROVED and DENIED show as a two-entry color legend — the split costs no axis." };
}

function countChart(extra = {}) {
  return {
    tool: "viz",
    data: { resource: HMDA },
    calculatedFields: [CALC],
    shelves: { columns: ["race"], rows: [COUNT_PILL], ...extra },
    mark: "bar",
  };
}

export const lesson = createLesson({
  id: "tableau-color",
  tool: "viz",
  moduleId: "tableau",
  mode: "guided",
  // Outcome variant: same step ids and checkpoints; the questions state what
  // must be TRUE of the finished view and the graders read the RESULT (the
  // computed marks and the legends the learner sees), not the shelves.
  modes: ["outcome"],
  voice: true,
  title: "Color as an encoding: slice with hue, rank with a ramp",
  description:
    "Color is a shelf, and whatever lands on it becomes data. Drop the decision field on Color and " +
    "every count bar splits into approved/denied segments; drop a measure there instead and the bars " +
    "shade light-to-dark by approval rate. Same chart, two extra channels — no new axes spent.",
  resources: [HMDA],
  steps: [
    {
      id: "dimension-on-color",
      title: "Split the bars: approved on Color",
      instruction:
        "The counts-by-race bars are up. Drag approved to the Color shelf. Each bar splits into two " +
        "colored segments — APPROVED and DENIED — because a dimension on Color slices the marks " +
        "exactly like a dimension on Rows or Columns would, just without using an axis.",
      hints: [
        "Color sits on the Marks card — it's a shelf like any other.",
        "The field that distinguishes outcomes is approved.",
        "One drag: approved onto Color. A two-entry legend appears.",
        "Color: approved. Each race bar now stacks an APPROVED segment and a DENIED segment.",
      ],
      checkpoint: countChart(),
      grader: { type: "vizSpec", expected: { color: ["approved"] } },
      target: { kind: "region", anchor: "viz-marks-color" },
      spotlightLabel: "Drag approved onto the Color shelf",
      modes: {
        outcome: {
          instruction:
            "Within each race group's bar, how many applications were approved and how many denied? " +
            "Show the split inside the existing bars — without spending another axis on it.",
          hints: [
            "Both outcomes should be visible inside each bar, with a two-entry legend naming them.",
            "Black should split 9 approved / 7 denied; White 43 / 7.",
          ],
          // Method grader (vizSpec: approved on Color) swapped for OUTCOME:
          // the 12 split counts must be computed AND the decision must show as
          // a categorical color legend — the no-new-axis constraint, read from
          // the rendered plan instead of the shelf.
          grader: {
            type: "allOf",
            of: [
              { type: "predicate", fn: categoricalApprovedLegendCheck, label: "The decision color legend" },
              { type: "vizData", expected: SPLIT_COUNTS, keyFields: ["race", "approved"] },
            ],
          },
        },
      },
    },
    {
      id: "read-the-split",
      title: "Read the segments",
      instruction:
        "Look at what the split reveals: White's denied segment is 7 of 50 — a sliver. Black's is 7 of " +
        "16 — almost half the bar. Same denial COUNT, wildly different meaning. This is why rates, not " +
        "counts, are the fair-lending standard.",
      hints: [
        "Hover the segments (or check the legend): every race has both an APPROVED and a DENIED piece.",
        "Compare Black and White's DENIED segments — both are 7 people.",
        "7 denials out of 16 applicants vs 7 out of 50: the proportion is the story.",
        "The 12 segments: 2/1, 8/2, 9/7, 12/6, 2/1, 43/7 (approved/denied, alphabetical by race).",
      ],
      checkpoint: countChart({ color: "approved" }),
      grader: {
        type: "vizData",
        expected: SPLIT_COUNTS,
        keyFields: ["race", "approved"],
      },
      spotlightLabel: "Compare the denied segments by race",
      modes: {
        outcome: {
          instruction:
            "Two race groups were denied exactly the same number of times, yet their stories differ " +
            "completely. Find them in your chart — and say why this view argues for rates over counts.",
          hints: [
            "Black and White were each denied 7 times.",
            "7 of 16 is not 7 of 50 — the proportion is the story.",
          ],
          // No grader override: the base vizData grader is already OUTCOME.
        },
      },
    },
    {
      id: "measure-on-color",
      title: "A measure on Color: the ramp",
      instruction:
        "Now replace the split with a ranking. Remove approved from Color and drop is_approved there " +
        "instead, aggregated as AVG. The legend becomes a light-to-dark RAMP: the darker the bar, the " +
        "higher the group's approval rate. Magnitude, not membership.",
      hints: [
        "Remove the approved pill from Color first — Color holds one pill.",
        "The measure is your is_approved flag; make sure it lands as AVG, not SUM.",
        "A continuous (green) pill on Color produces a gradient legend; a discrete one produces swatches.",
        "Color: AVG(is_approved). The ramp runs 0.5625 → 0.86 — Black lightest, White darkest.",
      ],
      checkpoint: countChart({ color: "approved" }),
      grader: {
        type: "allOf",
        of: [
          { type: "vizSpec", expected: { color: [{ field: "is_approved", aggregation: "AVG" }] }, strict: true },
          { type: "predicate", fn: sequentialLegendCheck, label: "The sequential color legend" },
        ],
      },
      target: { kind: "region", anchor: "viz-marks-color" },
      spotlightLabel: "Put average is_approved on Color",
      modes: {
        outcome: {
          instruction:
            "Re-color the bars so shade RANKS the groups by approval rate — darkest for the highest " +
            "rate — instead of splitting them by outcome.",
          hints: [
            "The legend should become a light-to-dark ramp, not a set of swatches.",
            "The ramp should run 0.5625 to 0.86 — Black lightest, White darkest.",
          ],
          // The strict vizSpec pill check is dropped; the sequential-legend
          // predicate alone remains — it grades the RENDERED legend, which is
          // exactly the outcome the question asks for.
          grader: { type: "predicate", fn: sequentialLegendCheck, label: "The sequential color legend" },
        },
      },
    },
  ],
});

export default lesson;
