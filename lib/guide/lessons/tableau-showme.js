// Guided lesson: Show Me — why marks grey out, and why "valid" is not the
// same as "right".
//
// Three ideas, one per step:
//   1. a greyed-out mark is a MISSING INGREDIENT: bar needs a measure, so
//      with only race on Columns the fix is adding one, not clicking harder;
//   2. scatter has a stricter recipe — a continuous measure on BOTH axes —
//      and the slicing dimension moves to Detail;
//   3. Show Me's recommendation is about SEMANTICS: line is perfectly VALID
//      for categories, and perfectly wrong (it draws a trend through an
//      alphabetical accident).
//
// Ground truth (verified against the engine + hmda-sample.csv):
//   race on Columns alone → only the text mark is valid
//   AVG(income) × AVG(loan_amount) by race (on Detail):
//     American Indian (64833.33, 210166.67), Asian (73650, 229550),
//     Black (66562.5, 197000), Hispanic (74638.89, 209333.33),
//     Other (74000, 170666.67), White (71720, 227550)
//
// Grading doctrine: vizSpec (METHOD) throughout — shelf recipes ARE the
// lesson — plus predicates over the real marks.js rules so the grade agrees
// with the Show Me panel the user is looking at, and vizData on the scatter
// so the six points must sit at the true coordinates.

import { createLesson } from "../spec.js";
import { isMarkValid, checkMark } from "../../viz/marks.js";

const HMDA = "hmda-sample.csv";

const COUNT_PILL = { field: "applicant_id", aggregation: "COUNT" };
const AVG_INCOME = { field: "income", aggregation: "AVG" };
const AVG_LOAN = { field: "loan_amount", aggregation: "AVG" };

/** Verified average income × average loan per race — the six scatter points. */
export const SCATTER_POINTS = [
  { race: "American Indian", "AVG(income)": 194500 / 3, "AVG(loan_amount)": 630500 / 3 },
  { race: "Asian", "AVG(income)": 73650, "AVG(loan_amount)": 229550 },
  { race: "Black", "AVG(income)": 66562.5, "AVG(loan_amount)": 197000 },
  { race: "Hispanic", "AVG(income)": 1343500 / 18, "AVG(loan_amount)": 3768000 / 18 },
  { race: "Other", "AVG(income)": 74000, "AVG(loan_amount)": 512000 / 3 },
  { race: "White", "AVG(income)": 71720, "AVG(loan_amount)": 227550 },
];

// Outcome-mode fixture: the verified counts by race (same ground truth as
// tableau-dimensions).
const RACE_COUNTS = [
  { race: "American Indian", "COUNT(applicant_id)": 3 },
  { race: "Asian", "COUNT(applicant_id)": 10 },
  { race: "Black", "COUNT(applicant_id)": 16 },
  { race: "Hispanic", "COUNT(applicant_id)": 18 },
  { race: "Other", "COUNT(applicant_id)": 3 },
  { race: "White", "COUNT(applicant_id)": 50 },
];

/** Predicate: the bar mark must be VALID for the user's shelves. */
function barIsUnlocked(toolState) {
  const spec = toolState?.spec;
  if (!spec) return { pass: false, message: "No view yet — drop a field on a shelf to start.", diff: [] };
  if (isMarkValid(spec, "bar")) {
    return { pass: true, message: "Bar is un-greyed in Show Me — the shelves now contain everything a bar needs." };
  }
  const { reason } = checkMark(spec, "bar");
  const hint = `Show Me still greys bar out: ${reason}`;
  return {
    pass: false,
    message: hint,
    expected: "a shelf configuration where bar is valid",
    actual: reason,
    diff: [{ kind: "missing", path: "shelves", expected: "a measure on an axis", actual: null, hint }],
  };
}

function vizCheckpoint(extra = {}) {
  return { tool: "viz", data: { resource: HMDA }, ...extra };
}

export const lesson = createLesson({
  id: "tableau-showme",
  tool: "viz",
  moduleId: "tableau",
  mode: "guided",
  // Outcome variant: same ids and checkpoints; the questions state what the
  // finished view must show, graded from the rendered mark and computed data.
  modes: ["outcome"],
  voice: true,
  title: "Show Me: what greyed-out marks are telling you",
  description:
    "Show Me isn't a menu of chart types — it's a live checklist of what your shelves can support. " +
    "You'll read a greyed-out bar as \"missing measure\" and fix the shelves, build the one chart with " +
    "a stricter recipe (scatter), and finish with the judgment call Show Me can't make for you.",
  resources: [HMDA],
  steps: [
    {
      id: "unlock-bar",
      title: "Why is bar greyed out?",
      instruction:
        "The view has race on Columns and nothing else — and in Show Me, bar is greyed out: \"Bar " +
        "needs a dimension on one axis and a measure on the other.\" Don't fight the mark; supply the " +
        "ingredient. Put COUNT of applicant_id on Rows, then set the mark to bar.",
      hints: [
        "A greyed option is a recipe with a missing ingredient — read its tooltip for which one.",
        "You have the dimension (race). What's missing is a measure on the other axis.",
        "Drag applicant_id to Rows and make it a Count. Bar un-greys the moment the pill lands.",
        "Columns: race. Rows: CNT(applicant_id). Mark: bar. Six bars — 3, 10, 16, 18, 3, 50.",
      ],
      checkpoint: vizCheckpoint({ shelves: { columns: ["race"] } }),
      grader: {
        type: "allOf",
        of: [
          { type: "vizSpec", expected: { columns: ["race"], rows: [COUNT_PILL], mark: "bar" } },
          { type: "predicate", fn: barIsUnlocked, label: "Bar validity in Show Me" },
        ],
      },
      target: { kind: "region", anchor: "viz-showme" },
      spotlightLabel: "Add a count measure to unlock bar",
      modes: {
        outcome: {
          instruction:
            "Show Me greys bar out on this one-shelf view. Supply what's missing so a bar chart of " +
            "applicants per race becomes possible — then draw it.",
          hints: [
            "A greyed mark is a recipe with a missing ingredient — here, something to measure.",
            "Six bars: 3, 10, 16, 18, 3, 50.",
          ],
          // Shelf recipe dropped; the grade is the rendered mark (bar, and
          // VALID per the engine's own Show Me rules) plus the true counts.
          grader: {
            type: "allOf",
            of: [
              { type: "vizSpec", expected: { mark: "bar" } },
              { type: "predicate", fn: barIsUnlocked, label: "Bar validity in Show Me" },
              { type: "vizData", expected: RACE_COUNTS, keyFields: ["race"] },
            ],
          },
        },
      },
    },
    {
      id: "build-scatter",
      title: "Scatter's stricter recipe",
      instruction:
        "Scatter demands MORE: a continuous measure on BOTH axes. Build income vs loan size by group: " +
        "AVG(income) on Columns, AVG(loan_amount) on Rows — and put race on DETAIL, so the view keeps " +
        "one point per race without spending an axis on it. Set the mark to scatter.",
      hints: [
        "Both axes need green (continuous, aggregated) pills — that's scatter's whole requirement.",
        "AVG(income) on Columns, AVG(loan_amount) on Rows. With no dimension you'd get ONE point.",
        "Detail slices the marks without creating headers — that's where race goes on a scatter.",
        "Columns: AVG(income). Rows: AVG(loan_amount). Detail: race. Mark: scatter. Six points, Black lowest-left.",
      ],
      checkpoint: vizCheckpoint(),
      grader: {
        type: "allOf",
        of: [
          {
            type: "vizSpec",
            expected: { columns: [AVG_INCOME], rows: [AVG_LOAN], detail: ["race"], mark: "scatter" },
          },
          { type: "vizData", expected: SCATTER_POINTS, keyFields: ["race"] },
        ],
      },
      target: { kind: "region", anchor: "viz-showme" },
      spotlightLabel: "Build the scatter chart recipe",
      modes: {
        outcome: {
          instruction:
            "Where does each race group sit on income versus loan size? Put the six groups on a " +
            "plane — typical income across, typical loan up — one point per group, without giving " +
            "the grouping an axis.",
          hints: [
            "A scatter needs a value on BOTH axes; the grouping rides along without one.",
            "Black sits lowest-left (66.6k, 197k).",
          ],
          // Shelf recipe dropped; the rendered mark plus the six true
          // coordinates are the grade.
          grader: {
            type: "allOf",
            of: [
              { type: "vizSpec", expected: { mark: "scatter" } },
              { type: "vizData", expected: SCATTER_POINTS, keyFields: ["race"] },
            ],
          },
        },
      },
    },
    {
      id: "valid-is-not-right",
      title: "Valid is not the same as right",
      instruction:
        "Last idea, and it's the important one. This view — counts by race drawn as a LINE — is " +
        "perfectly valid to Show Me, and it's a lie: a line implies order and trend, but race is " +
        "alphabetical. The \"trend\" is an accident of the alphabet. Switch the mark back to bar, " +
        "which claims nothing between categories.",
      hints: [
        "Show Me checks whether a mark CAN draw, not whether it should. Line only needs one axis of each kind — same as bar.",
        "Ask what the mark implies: a line's slope says \"change between these\" — meaningless between Black and Hispanic.",
        "Lines are for ordered axes: dates, thresholds, score bands. Categories get bars.",
        "Mark: bar. Same six numbers, no imaginary trend.",
      ],
      checkpoint: vizCheckpoint({
        shelves: { columns: ["race"], rows: [COUNT_PILL] },
        mark: "line",
      }),
      grader: { type: "vizSpec", expected: { columns: ["race"], rows: [COUNT_PILL], mark: "bar" } },
      target: { kind: "region", anchor: "viz-showme" },
      spotlightLabel: "Switch the mark from line to bar",
      modes: {
        outcome: {
          instruction:
            "This line chart is valid — and dishonest: the trend it draws between race groups is an " +
            "accident of the alphabet. Re-draw the view so it claims nothing between categories.",
          hints: [
            "Ask what the mark IMPLIES, not whether it renders.",
            "Same six numbers; no imaginary slope.",
          ],
          // The grade is the rendered mark plus the unchanged counts —
          // both outcome reads.
          grader: {
            type: "allOf",
            of: [
              { type: "vizSpec", expected: { mark: "bar" } },
              { type: "vizData", expected: RACE_COUNTS, keyFields: ["race"] },
            ],
          },
        },
      },
    },
  ],
});

export default lesson;
