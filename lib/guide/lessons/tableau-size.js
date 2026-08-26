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

const HMDA = "hmda-sample.csv";

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
    },
  ],
});

export default lesson;
