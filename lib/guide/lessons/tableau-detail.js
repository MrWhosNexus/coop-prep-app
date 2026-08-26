// Guided lesson: the Detail shelf — a dimension that slices without axes,
// used to preserve row-level detail or to add a dimension without layout
// cost.
//
// Two key ideas:
//   - Detail slices exactly like Rows or Columns, but without headers or axes;
//   - grouping dimensions are DEDUPED by field name: the same field on Rows
//     and again on Detail adds no granularity — the engine groups by the
//     field once, so the mark count does not change. Detail earns its keep
//     when it carries a field no axis has.
//
// Ground truth (recomputed from public/data/hmda-sample.csv — an earlier
// version carried invented per-gender averages with wrong divisors):
//   AVG(loan_amount) × AVG(income) by race: 6 points (one per race) when race
//     is on Detail; 6 scatter points at (income, loan_amount) coordinates.
//   Race on Detail plus gender on Color: one mark per race × gender combo
//     PRESENT IN THE DATA — 14 of them, not 6 × 3 = 18, because aggregation
//     only emits groups that actually occur (e.g. no American Indian/Other row).
//

import { createLesson } from "../spec.js";
import { buildRenderPlan } from "../../viz/render-plan.js";

const HMDA = "hmda-sample.csv";

const AVG_INCOME = { field: "income", aggregation: "AVG" };
const AVG_LOAN = { field: "loan_amount", aggregation: "AVG" };

/** Verified average income × loan by race. */
export const SCATTER_POINTS_BY_RACE = [
  { race: "American Indian", "AVG(income)": 194500 / 3, "AVG(loan_amount)": 630500 / 3 },
  { race: "Asian", "AVG(income)": 73650, "AVG(loan_amount)": 229550 },
  { race: "Black", "AVG(income)": 66562.5, "AVG(loan_amount)": 197000 },
  { race: "Hispanic", "AVG(income)": 1343500 / 18, "AVG(loan_amount)": 3768000 / 18 },
  { race: "Other", "AVG(income)": 74000, "AVG(loan_amount)": 512000 / 3 },
  { race: "White", "AVG(income)": 71720, "AVG(loan_amount)": 227550 },
];

/** Verified income × loan per gender (all 100 rows; three gender values). */
export const SCATTER_POINTS_BY_GENDER = [
  { gender: "Female", "AVG(income)": 3344500 / 46, "AVG(loan_amount)": 9957500 / 46 },
  { gender: "Male", "AVG(income)": 3640000 / 52, "AVG(loan_amount)": 11264000 / 52 },
  { gender: "Other", "AVG(income)": 81500, "AVG(loan_amount)": 257000 },
];

/**
 * Predicate: verify that Detail holds the field (not another shelf).
 * The Detail shelf should have race on it, visible in legends, one mark per race.
 */
function detailFieldCheck(toolState) {
  const spec = toolState?.spec;
  if (!spec) {
    return { pass: false, message: "No view yet — the check needs a spec.", diff: [] };
  }
  const detail = spec.detail ?? [];
  const hasRace = detail.some((d) => (typeof d === "string" ? d === "race" : d.field === "race"));
  if (!hasRace) {
    const hint = `race is not on Detail. Found: ${detail.map((d) => (typeof d === "string" ? d : d.field)).join(", ") || "nothing"}.`;
    return {
      pass: false,
      message: hint,
      expected: "race on the Detail shelf",
      actual: detail.length ? detail.map((d) => (typeof d === "string" ? d : d.field)).join(", ") : null,
      diff: [{ kind: "missing", path: "detail", expected: "race", actual: null, hint }],
    };
  }
  return {
    pass: true,
    message: "race is on Detail — the view produces one mark per race without spending an axis.",
  };
}

function vizCheckpoint(extra = {}) {
  return { tool: "viz", data: { resource: HMDA }, ...extra };
}

export const lesson = createLesson({
  id: "tableau-detail",
  tool: "viz",
  moduleId: "tableau",
  mode: "guided",
  voice: true,
  title: "The Detail shelf: slicing without axes",
  description:
    "Detail is a shelf you reach for when you need to slice marks without creating headers or axes — " +
    "when you want one mark per member, but the layout cost of a new axis is too high. You'll build a " +
    "scatter plot where Detail adds a third dimension without taking up space.",
  resources: [HMDA],
  steps: [
    {
      id: "base-scatter",
      title: "Start: income vs loan, no slicing",
      instruction:
        "Build a basic scatter: AVG(income) on Columns, AVG(loan_amount) on Rows. This gives ONE point " +
        "at the population mean. You'll add a slicing dimension on Detail — not on an axis — so the view " +
        "stays a scatter but explodes into six marks, one per race group.",
      hints: [
        "Both pills must be green (continuous, aggregated) for a valid scatter.",
        "AVG(income) on Columns, AVG(loan_amount) on Rows.",
        "With no slicing dimension, the view collapses to one global average point.",
        "Mark: scatter (or Automatic resolves to scatter). One point on the chart.",
      ],
      checkpoint: vizCheckpoint(),
      grader: {
        type: "vizSpec",
        expected: { columns: [AVG_INCOME], rows: [AVG_LOAN], mark: "scatter" },
      },
      target: { kind: "region", anchor: "viz-columns" },
      spotlightLabel: "Build income vs loan amount scatter",
    },
    {
      id: "detail-slicing",
      title: "Add race on Detail: six points, no axes",
      instruction:
        "Drag race to the Detail shelf. The point explosion into six — one per race — but no new axis " +
        "appears. Detail slices exactly like Rows or Columns, but without layout overhead: you pay zero " +
        "space cost for a third dimension. Read the scatter: American Indian has the lowest income " +
        "(64.8k), Other the lowest average loan (170.7k), and Asian tops the loans (229.6k).",
      hints: [
        "Detail is the shelf on the Marks card, below Color and Size.",
        "One drag: race onto Detail. Six points appear on the same axes.",
        "Compare Black (66.6k income, 197k loan) with Asian (73.7k, 229.6k) — higher income, higher loan.",
        "Detail: race. Six scatter points: one American Indian, one Asian, one Black, one Hispanic, one Other, one White.",
      ],
      checkpoint: vizCheckpoint({ shelves: { columns: [AVG_INCOME], rows: [AVG_LOAN] }, mark: "scatter" }),
      grader: {
        type: "allOf",
        of: [
          { type: "predicate", fn: detailFieldCheck, label: "race on the Detail shelf" },
          { type: "vizData", expected: SCATTER_POINTS_BY_RACE, keyFields: ["race"], tolerance: 1 },
        ],
      },
      target: { kind: "region", anchor: "viz-fieldlist" },
      spotlightLabel: "Drag race onto the Detail shelf",
    },
    {
      id: "detail-plus-color",
      title: "Add color to the six points",
      instruction:
        "Now add gender to the Color shelf. The six race points SPLIT by gender — 14 marks, one per race " +
        "and gender combination that actually occurs in the data. Not 6 × 3 = 18: the view only draws " +
        "groups the data contains, and some combinations (like American Indian/Other) have no rows. " +
        "Watch the legend: it shows only the three gender colors; race stays implicit in the points.",
      hints: [
        "Detail and Color multiply granularity, but only combos present in the data get a mark: 14 here.",
        "Drag gender to the Color shelf. A three-color legend appears (Female, Male, Other).",
        "The six locations stay the same (income vs loan by race); the colors split each by gender.",
        "Detail: race. Color: gender. The legend shows only gender; race is implicit in the points.",
      ],
      checkpoint: vizCheckpoint({
        shelves: { columns: [AVG_INCOME], rows: [AVG_LOAN], detail: ["race"] },
        mark: "scatter",
      }),
      grader: {
        type: "vizSpec",
        expected: {
          columns: [AVG_INCOME],
          rows: [AVG_LOAN],
          detail: ["race"],
          color: ["gender"],
          mark: "scatter",
        },
      },
      target: { kind: "region", anchor: "viz-marks-color" },
      spotlightLabel: "Add gender to the Color shelf",
    },
  ],
});

export default lesson;
