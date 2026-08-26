// Guided lesson: size as an encoding — a fourth data channel, not decoration.
//
// Two different animals, one shelf:
//   a DIMENSION on Size → size slices, just like color or a shelf;
//     each member gets a distinct size, marks split by member;
//   a MEASURE on Size → a sequential ramp (small → large) — size encodes
//     magnitude, light-to-dark by loan amount.
//
// Ground truth (verified against public/data/hmda-sample.csv):
//   count × gender × approved: 6 cells (M/F × APPROVED/DENIED) visible,
//   all six carry nonzero counts; largest is (Male, APPROVED, 26).
//   When sized by AVG(loan_amount), White loans dominate the visual.
//

import { createLesson } from "../spec.js";

const HMDA = "hmda-sample.csv";

const COUNT_PILL = { field: "applicant_id", aggregation: "COUNT" };

/** Verified counts by gender and approved. */
export const GENDER_APPROVED_COUNTS = [
  { gender: "Female", approved: "APPROVED", "COUNT(applicant_id)": 17 },
  { gender: "Female", approved: "DENIED", "COUNT(applicant_id)": 12 },
  { gender: "Male", approved: "APPROVED", "COUNT(applicant_id)": 26 },
  { gender: "Male", approved: "DENIED", "COUNT(applicant_id)": 19 },
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

function countChart(extra = {}) {
  return {
    tool: "viz",
    data: { resource: HMDA },
    shelves: { columns: ["gender"], rows: ["approved"], ...extra },
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
    "marks split by member with distinct sizes; drop a measure there and marks shade small-to-large " +
    "by value. Same chart, one more encoding — no new axes spent.",
  resources: [HMDA],
  steps: [
    {
      id: "size-dimension",
      title: "Categorical size: slicing by gender",
      instruction:
        "The view shows applicant counts by gender and decision (Female/Male vs Approved/Denied). Drag " +
        "gender to the Size shelf. Each approved/denied cell splits by gender — two sizes per decision " +
        "group — because a dimension on Size slices the marks exactly like a dimension on Rows or " +
        "Columns would.",
      hints: [
        "Size sits on the Marks card — it's a shelf like any other.",
        "The field that distinguishes applicant groups is gender.",
        "One drag: gender onto Size. A two-entry legend appears (Male, Female).",
        "Size: gender. Each decision group (APPROVED and DENIED) now shows two bars by gender size.",
      ],
      checkpoint: countChart(),
      grader: {
        type: "vizSpec",
        expected: { columns: ["gender"], rows: ["approved"], size: ["gender"] },
      },
      target: { kind: "region", anchor: "viz-marks-size" },
      spotlightLabel: "Drag gender onto the Size shelf",
    },
    {
      id: "read-size-split",
      title: "Read the size split",
      instruction:
        "Look at what the size split reveals: more Female denials than Male denials (12 vs 19), but more " +
        "Male approvals than Female (26 vs 17). Size alone doesn't encode magnitude — it just slices — " +
        "so compare the bar segment sizes by eye. When you need to rank by size, a measure on the " +
        "Size shelf works better.",
      hints: [
        "Hover the segments to see counts: Female denials (12), Male denials (19), Female approvals (17), Male approvals (26).",
        "The sizes are visually distinct, but comparing two sizes by eye is harder than comparing heights on an axis.",
        "Male bars are generally wider because male applicants outnumber female applicants.",
        "Total: 17+12+26+19 = 74 applicants in this slice of the data.",
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
