// Guided lesson: size as an encoding — a fourth data channel, not decoration.
//
// Two different animals, one shelf:
//   a DIMENSION on Size → size slices, just like color or a shelf;
//     each member gets a distinct size, marks split by member;
//   a MEASURE on Size → a sequential ramp (small → large) — size encodes
//     magnitude, sized by loan amount.
//
// Ground truth (recomputed from public/data/hmda-sample.csv — an earlier
// version of this lesson shipped invented counts, 17/12/26/19 over a
// phantom 74-row slice, and even reversed its own conclusion. The file has
// 100 rows and THREE gender values):
//   count × gender × approved: Female 37 approved / 9 denied,
//   Male 38 approved / 14 denied, Other 1 approved / 1 denied.
//   Approval rates: Female 80.4%, Male 73.1% — a small gap favoring women,
//   in contrast to the large race gap (Black 56.25% vs White 86%) the other
//   labs teach.
//   When sized by AVG(loan_amount), Asian (229.6k) and White (227.6k) lead.

import { createLesson } from "../spec.js";
import { buildRenderPlan } from "../../viz/render-plan.js";

const HMDA = "hmda-sample.csv";

/**
 * OUTCOME predicate factory for the variant mode: the rendered plan must
 * carry a SIZE legend for `field` — the legend the learner sees is the
 * evidence the channel rides on size, not on a new axis or on color.
 */
function sizeLegendCheck(field) {
  return function check(toolState) {
    if (!toolState?.spec || !toolState?.rows) {
      return { pass: false, message: "No view yet — the check needs a spec and data.", diff: [] };
    }
    let plan;
    try {
      plan = buildRenderPlan(toolState.spec, toolState.rows);
    } catch (err) {
      return { pass: false, message: `The view can't be built yet: ${err.message}`, diff: [] };
    }
    const legend = (plan.legends ?? []).find((l) => l.type === "size" && l.field === field);
    if (!legend) {
      const hint = `There's no size legend for ${field} — the channel has to ride on mark size, not on an axis or on color.`;
      return {
        pass: false,
        message: hint,
        expected: `a size legend for ${field}`,
        actual: (plan.legends ?? []).map((l) => `${l.type} legend for ${l.field}`).join(", ") || null,
        diff: [{ kind: "missing", path: "size", expected: field, actual: null, hint }],
      };
    }
    return { pass: true, message: `${field} drives the mark sizes — the extra channel costs no axis.` };
  };
}

const genderSizeLegend = sizeLegendCheck("gender");
const loanSizeLegend = sizeLegendCheck("loan_amount");

const COUNT_PILL = { field: "applicant_id", aggregation: "COUNT" };

/** Verified counts by gender and approved (all 100 rows, 3 gender values). */
export const GENDER_APPROVED_COUNTS = [
  { gender: "Female", approved: "APPROVED", "COUNT(applicant_id)": 37 },
  { gender: "Female", approved: "DENIED", "COUNT(applicant_id)": 9 },
  { gender: "Male", approved: "APPROVED", "COUNT(applicant_id)": 38 },
  { gender: "Male", approved: "DENIED", "COUNT(applicant_id)": 14 },
  { gender: "Other", approved: "APPROVED", "COUNT(applicant_id)": 1 },
  { gender: "Other", approved: "DENIED", "COUNT(applicant_id)": 1 },
];

/** Verified average loan amount by race. */
export const EXPECTED_AVG_LOAN = [
  { race: "American Indian", "AVG(loan_amount)": 630500 / 3 },
  { race: "Asian", "AVG(loan_amount)": 229550 },
  { race: "Black", "AVG(loan_amount)": 197000 },
  { race: "Hispanic", "AVG(loan_amount)": 3768000 / 18 },
  { race: "Other", "AVG(loan_amount)": 512000 / 3 },
  { race: "White", "AVG(loan_amount)": 227550 },
];

// The COUNT pill on Rows is what makes the view actually compute
// COUNT(applicant_id) — without it the earlier version of this lesson was
// unpassable: grading reported "the view doesn't compute COUNT(applicant_id)".
function countChart(extra = {}) {
  return {
    tool: "viz",
    data: { resource: HMDA },
    shelves: { columns: ["gender"], rows: ["approved", COUNT_PILL], ...extra },
    mark: "bar",
  };
}

function raceChart(extra = {}) {
  return {
    tool: "viz",
    data: { resource: HMDA },
    shelves: { columns: ["race"], rows: [COUNT_PILL], ...extra },
    mark: "bar",
  };
}

export const lesson = createLesson({
  id: "tableau-size",
  tool: "viz",
  moduleId: "tableau",
  mode: "guided",
  // Outcome variant: same ids and checkpoints; graders read the rendered
  // size legends and the computed marks instead of the shelf recipe.
  modes: ["outcome"],
  voice: true,
  title: "Size as an encoding: magnitude and membership via mark width",
  description:
    "Like color, size is a shelf that holds a field and becomes data. Drop a dimension on Size and " +
    "marks split by member with distinct sizes; drop a measure there and marks scale small-to-large " +
    "by value. Same chart, one more encoding — no new axes spent.",
  resources: [HMDA],
  steps: [
    {
      id: "size-dimension",
      title: "Categorical size: slicing by gender",
      instruction:
        "The view shows applicant counts by gender and decision. Drag gender to the Size shelf. Each " +
        "approved/denied cell splits by gender — one size per gender value — because a dimension on " +
        "Size slices the marks exactly like a dimension on Rows or Columns would.",
      hints: [
        "Size sits on the Marks card — it's a shelf like any other.",
        "The field that distinguishes applicant groups is gender.",
        "One drag: gender onto Size. A three-entry legend appears (Female, Male, Other).",
        "Size: gender. Each decision group (APPROVED and DENIED) now splits by gender size.",
      ],
      checkpoint: countChart(),
      grader: {
        type: "vizSpec",
        expected: { columns: ["gender"], rows: ["approved", COUNT_PILL], size: ["gender"] },
      },
      target: { kind: "region", anchor: "viz-marks-size" },
      spotlightLabel: "Drag gender onto the Size shelf",
      modes: {
        outcome: {
          instruction:
            "Add a third channel to the counts view: make the marks distinguish the genders by their " +
            "SIZE — without a new axis and without touching color.",
          hints: [
            "A three-entry legend should appear (Female, Male, Other).",
            "The axes stay gender and count; size carries the split.",
          ],
          // Method grader (vizSpec: gender on Size) swapped for OUTCOME: the
          // rendered size legend for gender is the evidence.
          grader: { type: "predicate", fn: genderSizeLegend, label: "The gender size legend" },
        },
      },
    },
    {
      id: "read-size-split",
      title: "Read the size split",
      instruction:
        "Read what the split actually says: 37 Female approvals vs 9 denials (an 80.4% approval rate) " +
        "against 38 Male approvals vs 14 denials (73.1%). The gender gap is SMALL and runs in favor of " +
        "women — the opposite of what you might assume, and a sharp contrast to the race gap " +
        "(Black 56.25% vs White 86%) from the earlier labs. Note the third gender value, Other, with " +
        "just 2 applicants — too few to conclude anything from its 50% rate.",
      hints: [
        "Hover the marks for counts: Female 37/9, Male 38/14, Other 1/1.",
        "Rates, not raw counts: Male denials (14) exceed Female (9) even though the male total is only slightly larger.",
        "Female 37/46 = 80.4% approved; Male 38/52 = 73.1%. Small gap, women ahead.",
        "Total: 37+9+38+14+1+1 = 100 applicants — the whole file, no hidden slice.",
      ],
      checkpoint: countChart({ size: "gender" }),
      grader: {
        type: "vizData",
        expected: GENDER_APPROVED_COUNTS,
        keyFields: ["gender", "approved"],
      },
      spotlightLabel: "Compare the size-split segments",
      modes: {
        outcome: {
          instruction:
            "Is there a gender gap in approvals, and how does it compare to the race gap the earlier " +
            "labs found? Read it from your marks — and mind the group of 2.",
          hints: [
            "Female 37/9 (80.4% approved), Male 38/14 (73.1%).",
            "Other holds 2 applicants — its 50% rate concludes nothing.",
          ],
          // No grader override: the base vizData grader is already OUTCOME.
        },
      },
    },
    {
      id: "measure-on-size",
      title: "A measure on Size: rank by loan amount",
      instruction:
        "Now replace the split with a ranking. Remove gender from Size and drop loan_amount there " +
        "instead, aggregated as AVG. The legend becomes a size ramp: the wider the bar, the higher " +
        "the group's average loan amount. Magnitude, not membership.",
      hints: [
        "Remove the gender pill from Size first — Size holds one pill.",
        "The measure is loan_amount; make sure it lands as AVG (not SUM).",
        "A continuous (green) pill on Size produces a size ramp in the legend.",
        "Size: AVG(loan_amount). Asian and White lead the ramp; Other trails at ~$170.7k.",
      ],
      checkpoint: raceChart(),
      grader: {
        type: "allOf",
        of: [
          { type: "vizSpec", expected: { columns: ["race"], rows: [COUNT_PILL], size: [{ field: "loan_amount", aggregation: "AVG" }] } },
          { type: "vizData", expected: EXPECTED_AVG_LOAN, keyFields: ["race"], tolerance: 1 },
        ],
      },
      target: { kind: "region", anchor: "viz-marks-size" },
      spotlightLabel: "Put average loan amount on Size",
      modes: {
        outcome: {
          instruction:
            "Swap membership for magnitude: make each race's bar width rank the groups by their " +
            "typical loan amount — widest for the biggest typical loan.",
          hints: [
            "The legend becomes a small-to-large ramp, not member entries.",
            "Asian and White lead; Other trails near $170.7k.",
          ],
          // Method grader swapped for OUTCOME: the rendered size legend for
          // loan_amount plus the true per-race figures are the grade.
          grader: {
            type: "allOf",
            of: [
              { type: "predicate", fn: loanSizeLegend, label: "The loan size legend" },
              { type: "vizData", expected: EXPECTED_AVG_LOAN, keyFields: ["race"], tolerance: 1 },
            ],
          },
        },
      },
    },
  ],
});

export default lesson;
