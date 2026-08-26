// Instruction-mode lesson: Tableau's shelf system and pill organization.
//
// This is a conceptual walkthrough (mode: "instructions") that teaches how
// Tableau organizes data visualization through shelves, pills, and the
// semantic meaning of each shelf's position. Each concept ends with a small
// build the learner performs in the viz tool, and the grader checks that
// build against the real engine. (An earlier version hardcoded pass: true
// in every grader — the lesson "graded" nothing — and made mark-type claims
// lib/viz/marks.js contradicts. Every claim below is checked against
// classifyShelves/bestMarkType in that file.)

import { createLesson } from "../spec.js";

const HMDA = "hmda-sample.csv";

const COUNT_PILL = { field: "applicant_id", aggregation: "COUNT" };
const AVG_LOAN = { field: "loan_amount", aggregation: "AVG" };

function instructionCheckpoint(extra = {}) {
  return {
    tool: "viz",
    data: { resource: HMDA },
    ...extra,
  };
}

export const lesson = createLesson({
  id: "tableau-shelves-guide",
  tool: "viz",
  moduleId: "tableau",
  mode: "instructions",
  voice: false,
  title: "Tableau shelves: translating data into position and color",
  description:
    "Tableau builds charts by dragging pills (fields) onto shelves. Each shelf has a meaning: Columns " +
    "and Rows slice the view into a grid, Marks control the visual mark (bar, dot, line), Color and Size " +
    "encode additional dimensions, and Filters narrow the data. Understanding what each shelf does and " +
    "why dimensions behave differently from measures is the key to building charts that tell the story " +
    "your data holds.",
  steps: [
    {
      id: "shelves-and-encoding",
      title: "The shelves: from data to position",
      instruction:
        "In Tableau, dragging a field onto a shelf encodes it as a visual property. Columns and Rows " +
        "position pills left-to-right and top-to-bottom — a dimension on Columns creates a column for " +
        "each group, a dimension on Rows creates a row for each group. Filters narrow the data before " +
        "visualization. Color and Size encode additional dimensions or measures as color shade or size. " +
        "The Marks card lets you choose the shape (bar, line, dot) and controls visual properties like " +
        "label, tooltip, and detail. The system is consistent: dragging race to Columns always means " +
        "\"create one column per race group.\" Prove it to yourself: drag race to Columns and " +
        "applicant_id (as COUNT) to Rows.",
      hints: [
        "Columns: left-to-right categories (discrete pills become column headers).",
        "Rows: top-to-bottom values — a continuous pill becomes a vertical axis.",
        "Drag race to Columns, then applicant_id to Rows and set its aggregation to COUNT.",
        "Columns: race. Rows: COUNT(applicant_id). One column per race, one axis of counts.",
      ],
      checkpoint: instructionCheckpoint(),
      grader: {
        type: "vizSpec",
        expected: { columns: ["race"], rows: [COUNT_PILL] },
      },
    },
    {
      id: "discrete-vs-continuous",
      title: "Discrete vs continuous: dimensions vs measures",
      instruction:
        "Every pill in Tableau is either discrete (blue, counts categories) or continuous (green, a " +
        "number line). Dimensions are usually discrete — race, gender — because they represent groups. " +
        "Aggregated measures — count, sum, average — are continuous. A discrete field on Columns creates " +
        "one header per unique value; a continuous field creates an axis with a range. The pill color is " +
        "the visual signal. Look at your chart from the last step: race should be a blue (discrete) pill " +
        "on Columns and COUNT(applicant_id) a green (continuous) pill on Rows. Keep them that way — the " +
        "grader checks the discreteness of both pills, not just their placement.",
      hints: [
        "Blue pill = discrete (categories, groups). One slot per value.",
        "Green pill = continuous (aggregated measures). An axis from min to max.",
        "race is unaggregated and slices → discrete. COUNT(applicant_id) is aggregated → continuous.",
        "Columns: race (blue). Rows: COUNT(applicant_id) (green).",
      ],
      checkpoint: instructionCheckpoint({
        shelves: { columns: ["race"], rows: [COUNT_PILL] },
      }),
      grader: {
        type: "vizSpec",
        expected: {
          columns: [{ field: "race", discrete: true }],
          rows: [{ field: "applicant_id", aggregation: "COUNT", discrete: false }],
        },
      },
    },
    {
      id: "mark-types-and-aggregation",
      title: "Marks control the visual shape; measures are always aggregated",
      instruction:
        "The Marks card controls what shape Tableau draws for each cell in your shelf grid. The rules " +
        "come from what's on the axes: a discrete field on one axis plus a continuous one on the other " +
        "gives a bar by default (a line only when the discrete field is a date); a scatter needs " +
        "continuous pills on BOTH axes. When you drag a measure to a shelf, Tableau aggregates it — the " +
        "default for a measure is SUM, but right-click the pill to change it. This matters: summing " +
        "loan_amount rewards big groups; averaging it compares groups fairly. Try it: swap the Rows " +
        "pill for loan_amount aggregated as AVG, with the bar mark.",
      hints: [
        "Replace COUNT(applicant_id) on Rows with loan_amount.",
        "loan_amount lands as SUM by default — right-click the pill and pick Average.",
        "Discrete Columns + continuous Rows → the engine's default mark is bar.",
        "Columns: race. Rows: AVG(loan_amount). Mark: bar.",
      ],
      checkpoint: instructionCheckpoint({
        shelves: { columns: ["race"], rows: [COUNT_PILL] },
      }),
      grader: {
        type: "vizSpec",
        expected: { columns: ["race"], rows: [AVG_LOAN], mark: "bar" },
      },
    },
    {
      id: "building-a-chart-recipe",
      title: "The recipe: shelves in order",
      instruction:
        "Building a chart follows a pattern. (1) Drag your grouping dimension to Columns or Rows to " +
        "create the structure. (2) Drag your measure to the opposite shelf, and check its aggregation. " +
        "(3) Choose the mark type (Automatic usually picks right: bar for a category vs a measure, " +
        "scatter when both axes are continuous measures). (4) Optionally add Color for another " +
        "dimension. (5) Optionally add Size or Filters. Finish the recipe on your current chart: add " +
        "gender to the Color shelf, so each race's bar splits into colored segments by gender.",
      hints: [
        "Start from race on Columns and AVG(loan_amount) on Rows, mark bar.",
        "One drag left: gender onto the Color shelf on the Marks card.",
        "A three-color legend appears — the data has Female, Male, and Other.",
        "Columns: race. Rows: AVG(loan_amount). Color: gender. Mark: bar.",
      ],
      checkpoint: instructionCheckpoint({
        shelves: { columns: ["race"], rows: [AVG_LOAN] },
        mark: "bar",
      }),
      grader: {
        type: "vizSpec",
        expected: { columns: ["race"], rows: [AVG_LOAN], color: ["gender"], mark: "bar" },
      },
    },
  ],
});

export default lesson;
