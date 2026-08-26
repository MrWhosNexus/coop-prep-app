// Instruction-mode lesson: Tableau's shelf system and pill organization.
//
// This is a conceptual walkthrough (mode: "instructions") that teaches how
// Tableau organizes data visualization through shelves, pills, and the
// semantic meaning of each shelf's position.
//
// Each step still has a valid checkpoint and grader, but no spotlight
// target — the lesson is framed text and conceptual understanding checks,
// not interactive tool-driven steps.

import { createLesson } from "../spec.js";

function instructionCheckpoint(extra = {}) {
  return {
    tool: "viz",
    data: { resource: "hmda-sample.csv" },
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
        "label, tooltip, and detail. Every pill has a purpose and every shelf has semantic meaning. " +
        "The system is consistent: dragging race to Columns always means \"create one column per race group.\" " +
        "Understanding this consistency lets you predict what a chart will show before you finish building it.",
      hints: [
        "Columns: left-to-right categories (discrete pills become column headers).",
        "Rows: top-to-bottom categories (discrete pills become row headers).",
        "Color: shade each mark by dimension or measure (encodes another variable).",
        "Size: size each mark by measure (larger = higher value).",
      ],
      checkpoint: instructionCheckpoint(),
      grader: {
        type: "predicate",
        fn: (toolState) => {
          return {
            pass: true,
            message:
              "You understand shelf semantics: Columns/Rows position, Color/Size encode, Filters narrow, " +
              "Marks control the visual mark type.",
          };
        },
      },
    },
    {
      id: "discrete-vs-continuous",
      title: "Discrete vs continuous: dimensions vs measures",
      instruction:
        "Every field in Tableau is either discrete (blue, counts categories) or continuous (green, measures " +
        "on a number line). Dimensions are usually discrete — race, gender, date bucketed by month — because " +
        "they represent groups. Measures are usually continuous — count, sum, average — because they are " +
        "numbers along a scale. When you drag a discrete field to Columns, it creates one column header per " +
        "unique value (one column per race). When you drag a continuous field to Columns, it creates an axis " +
        "with a range. On Rows, a continuous field becomes a vertical axis. The color of the pill (blue vs " +
        "green) is the visual signal: blue pills are discrete, green pills are continuous. Changing a field " +
        "from discrete to continuous (right-click the pill → Convert to Continuous) changes the chart's logic " +
        "entirely — groups become ranges, and the visualization shifts from categorical to quantitative.",
      hints: [
        "Blue pill = discrete (categories, groups, bucketed dates). One slot per value.",
        "Green pill = continuous (measures, counts, ranges). An axis from min to max.",
        "Same field can be both: drag the same field to Columns twice, right-click one to convert.",
        "Columns + continuous row = a line chart or scatter plot. Columns + discrete row = a grouped bar chart.",
      ],
      checkpoint: instructionCheckpoint(),
      grader: {
        type: "predicate",
        fn: (toolState) => {
          return {
            pass: true,
            message:
              "Dimensions are discrete (categories), measures are continuous (scales). Blue vs green signals " +
              "which type is on the shelf right now.",
          };
        },
      },
    },
    {
      id: "mark-types-and-aggregation",
      title: "Marks control the visual shape; measures are always aggregated",
      instruction:
        "The Marks card controls what shape Tableau draws for each cell in your shelf grid. Bar, line, dot " +
        "(circle), shape, map — each makes a different kind of chart. When you drag a measure to a shelf, " +
        "Tableau automatically aggregates it (SUM, AVG, COUNT) — the default is usually SUM, but you can " +
        "right-click and change it to AVERAGE or another aggregation. This matters: summing approvals counts " +
        "the approvals; averaging a 1/0 flag gives the approval rate. Marks + aggregation = the whole grammar " +
        "of Tableau. Position (Columns/Rows) creates the grid, aggregation fills each cell, marks draw the " +
        "result, and color/size add another layer. The same data in different arrangements tells different " +
        "stories: race on Columns with approved on Rows is a set of bars, one per race, all in one row. " +
        "Swap them (approved on Columns, race on Rows) and you get bars side by side, grouped by race.",
      hints: [
        "Marks card lists all available mark types for your current shelf arrangement.",
        "Automatic often picks the right shape — bar for grouped categorical, line for time series.",
        "Right-click a measure pill → Measure → Average/Sum/Count to change aggregation.",
        "SUM adds numbers; AVG divides by count; COUNT tallies non-empty cells.",
      ],
      checkpoint: instructionCheckpoint(),
      grader: {
        type: "predicate",
        fn: (toolState) => {
          return {
            pass: true,
            message:
              "Marks control shape. Measures are auto-aggregated (SUM is default). Right-click to change the " +
              "aggregation — this is how AVERAGE of a 1/0 flag becomes an approval rate.",
          };
        },
      },
    },
    {
      id: "building-a-chart-recipe",
      title: "The recipe: shelves in order",
      instruction:
        "Building a chart in Tableau follows a pattern. (1) Drag your grouping dimension (race, region, date) " +
        "to Columns or Rows to create the structure. (2) Drag your measure (count, amount, average) to Rows " +
        "or Columns — typically the opposite shelf from your dimension, so dimensions slice and measures aggregate " +
        "vertically or horizontally. (3) Choose the mark type from the Marks card (usually Automatic does this " +
        "for you). (4) Optionally add Color to a second dimension or measure — it encodes a third variable into " +
        "shade. (5) Optionally add Size to a measure — it encodes a fourth variable into mark size. (6) Optionally " +
        "add Filters to narrow the data. This recipe is consistent: apply it the same way every time, and you can " +
        "build any chart Tableau supports. When a chart doesn't look right, check the shelves: is the dimension " +
        "on the right shelf? Is the measure aggregating the way you expect? Are the pills the right color (blue/green)?",
      hints: [
        "Start with one dimension on Columns. That becomes your x-axis (categories).",
        "Add a measure to Rows. That becomes your y-axis (values).",
        "Pick a mark type from the Marks card (usually automatic is fine).",
        "Add Color or Size for a second dimension if you need one.",
      ],
      checkpoint: instructionCheckpoint(),
      grader: {
        type: "predicate",
        fn: (toolState) => {
          return {
            pass: true,
            message:
              "Chart building is a recipe: (1) dimension to structure, (2) measure to aggregate, (3) mark type, " +
              "(4) optional color/size for a second variable, (5) optional filters. Same steps, every time.",
          };
        },
      },
    },
  ],
});

export default lesson;
