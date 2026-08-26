// Guided lesson: filters — categorical, range, and top-N — on the approval
// chart and the count chart.
//
// Three different filter kinds, three different questions:
//   categorical  "only these groups"     (keep the four biggest races)
//   range        "only these values"     (loans $150k-$250k)
//   top-N        "only the biggest N"    (top 3 races by applicant count —
//                                         computed AFTER aggregation)
//
// Ground truth (verified against public/data/hmda-sample.csv):
//   rates, four kept groups: Asian .8, Black .5625, Hispanic 2/3, White .86
//   counts in $150k-$250k: American Indian 1, Asian 7, Black 12, Hispanic 7,
//     Other 2, White 23  (52 loans total)
//   top 3 by count: White 50, Hispanic 18, Black 16
//
// Grading doctrine: each step is allOf(vizSpec, vizData) — the filter must
// EXIST on the right field with the right kind (METHOD) and the surviving
// marks must be exactly right (OUTCOME; vizData's default allowExtra: false
// is what catches a filter that exists but keeps the wrong members).

import { createLesson } from "../spec.js";

const HMDA = "hmda-sample.csv";

const CALC = { name: "is_approved", expression: 'IF([approved] = "APPROVED", 1, 0)' };
const AVG_PILL = { field: "is_approved", aggregation: "AVG" };
const COUNT_PILL = { field: "applicant_id", aggregation: "COUNT" };

/** Verified rates for the four biggest groups. */
export const KEPT_RATES = [
  { race: "Asian", "AVG(is_approved)": 8 / 10 },
  { race: "Black", "AVG(is_approved)": 9 / 16 },
  { race: "Hispanic", "AVG(is_approved)": 12 / 18 },
  { race: "White", "AVG(is_approved)": 43 / 50 },
];

/** Verified counts per race among $150k-$250k loans. */
export const MIDBAND_COUNTS = [
  { race: "American Indian", "COUNT(applicant_id)": 1 },
  { race: "Asian", "COUNT(applicant_id)": 7 },
  { race: "Black", "COUNT(applicant_id)": 12 },
  { race: "Hispanic", "COUNT(applicant_id)": 7 },
  { race: "Other", "COUNT(applicant_id)": 2 },
  { race: "White", "COUNT(applicant_id)": 23 },
];

/** Verified top 3 races by applicant count. */
export const TOP3_COUNTS = [
  { race: "White", "COUNT(applicant_id)": 50 },
  { race: "Hispanic", "COUNT(applicant_id)": 18 },
  { race: "Black", "COUNT(applicant_id)": 16 },
];

function rateChart(extra = {}) {
  return {
    tool: "viz",
    data: { resource: HMDA },
    calculatedFields: [CALC],
    shelves: { columns: ["race"], rows: [AVG_PILL] },
    mark: "bar",
    ...extra,
  };
}

function countChart(extra = {}) {
  return {
    tool: "viz",
    data: { resource: HMDA },
    shelves: { columns: ["race"], rows: [COUNT_PILL] },
    mark: "bar",
    ...extra,
  };
}

export const lesson = createLesson({
  id: "tableau-filters",
  tool: "viz",
  moduleId: "tableau",
  mode: "guided",
  voice: true,
  title: "Filters: categorical, range, and top-N",
  description:
    "A governance dashboard never shows everything — it shows the defensible subset. You'll cut the " +
    "approval chart down to the statistically meaningful groups, slice the portfolio to one loan band, " +
    "and let a top-N filter rank groups by size. Three filter kinds; the third one works differently " +
    "than it looks.",
  resources: [HMDA],
  steps: [
    {
      id: "categorical-filter",
      title: "Categorical: keep the big four",
      instruction:
        "The approval-rate chart is on screen, but two bars (American Indian, Other) summarize only 3 " +
        "people each — too noisy to present. Drag race to the Filters shelf and keep only Asian, " +
        "Black, Hispanic and White. Four bars remain, and every one is worth defending.",
      hints: [
        "A categorical filter lists a field's members with checkboxes: keep what's checked.",
        "Filter on race — the field whose members you're pruning.",
        "Keep Asian, Black, Hispanic, White; uncheck American Indian and Other.",
        "Filters: race keeping the four biggest groups. Bars: 0.8, 0.5625, 0.667, 0.86.",
      ],
      checkpoint: rateChart(),
      grader: {
        type: "allOf",
        of: [
          { type: "vizSpec", expected: { filters: [{ field: "race", type: "categorical" }] } },
          { type: "vizData", expected: KEPT_RATES, keyFields: ["race"] },
        ],
      },
      target: { kind: "region", anchor: "viz-filters" },
      spotlightLabel: "Filter race to the four biggest groups",
    },
    {
      id: "range-filter",
      title: "Range: one loan band only",
      instruction:
        "New view: applicant counts by race. Slice it to the portfolio's middle band by adding a " +
        "range filter on loan_amount from 150000 to 250000 (inclusive). 52 of the 100 loans survive — " +
        "White 23, Black 12, and American Indian drops to a single applicant.",
      hints: [
        "loan_amount is continuous, so its filter is a min/max range, not checkboxes.",
        "Set min 150000 and max 250000; leave both ends inclusive.",
        "The bars shrink but every group survives — this band spans most of the file.",
        "Filters: loan_amount 150000-250000. Counts: 1, 7, 12, 7, 2, 23.",
      ],
      checkpoint: countChart(),
      grader: {
        type: "allOf",
        of: [
          { type: "vizSpec", expected: { filters: [{ field: "loan_amount", type: "range" }] } },
          { type: "vizData", expected: MIDBAND_COUNTS, keyFields: ["race"] },
        ],
      },
      target: { kind: "region", anchor: "viz-filters" },
      spotlightLabel: "Filter loan amount to 150k-250k",
    },
    {
      id: "top-n-filter",
      title: "Top-N: the three biggest groups",
      instruction:
        "Back to the full counts. Add a Top-N filter on race: top 3 by count of applicant_id. Only " +
        "White (50), Hispanic (18) and Black (16) remain. Note what just happened under the hood: " +
        "top-N can't run until the counts EXIST, so it filters AFTER aggregation — the opposite of the " +
        "other two kinds.",
      hints: [
        "It's still a filter on race — but ranked by a measure instead of picked by hand.",
        "Top 3, ranked by COUNT of applicant_id.",
        "Row-level filters drop rows before counting; top-N ranks the finished counts and keeps 3.",
        "Filters: race, top 3 by CNT(applicant_id). Bars: White 50, Hispanic 18, Black 16.",
      ],
      checkpoint: countChart(),
      grader: {
        type: "allOf",
        of: [
          { type: "vizSpec", expected: { filters: [{ field: "race", type: "topN" }] } },
          { type: "vizData", expected: TOP3_COUNTS, keyFields: ["race"] },
        ],
      },
      target: { kind: "region", anchor: "viz-filters" },
      spotlightLabel: "Filter race to the top 3 by count",
    },
  ],
});

export default lesson;
