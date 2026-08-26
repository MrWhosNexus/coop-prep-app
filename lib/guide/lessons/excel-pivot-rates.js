// Guided lesson: pivot % of Column Total — the curriculum's flagship task,
// exactly as excel-1 teaches it: "drag your group field, count the outcomes,
// then Show Values As → % of Column Total to get rates instantly."
//
// The layout is the transpose of the excel-pivot exemplar: here each RACE is a
// COLUMN, so each column sums to 100% and the APPROVED row reads as that
// group's approval rate. Which "Show Values As" you need depends on where the
// group field sits — that dependency is half the lesson.
//
// Ground truth (verified against public/data/hmda-sample.csv, as fractions —
// the pivot engine returns 0.5625, not 56.25):
//   APPROVED row: American Indian 2/3, Asian 0.8, Black 0.5625,
//   Hispanic 2/3, Other 2/3, White 0.86
//
// Grading doctrine:
//   - steps 1-2 grade the METHOD (pivotSpec) — building the pivot IS the
//     lesson — with values.field "*" because counting ANY field counts the
//     same 100 rows;
//   - step 2 also grades the OUTCOME (pivotResult) over the real data;
//   - step 3 grades pure OUTCOME (cellValue): reading the table correctly is
//     its own skill, and any route to the numbers is fine.

import { createLesson } from "../spec.js";

const HMDA = "hmda-sample.csv";
const SOURCE = "A1:G101";

const COUNT_ANY = { field: "*", agg: "count" };
const COUNT_VALUE = { field: "applicant_id", agg: "count" };
const RATE_VALUE = { field: "applicant_id", agg: "count", showAs: "percentOfColumnTotal" };

/** The finished pivot: outcomes down the side, one race per column, rates in the cells. */
const FINAL_SPEC = { rows: ["approved"], cols: ["race"], values: [RATE_VALUE] };

function checkpointWithPivot(spec, cells = {}) {
  return {
    tool: "sheet",
    active: "Data",
    sheets: [{ name: "Data", load: [{ resource: HMDA, origin: "A1" }], cells }],
    pivot: { sourceRange: SOURCE, spec },
  };
}

/** Labels seeded next to the data for the read-the-rates step. */
const READ_LABELS = {
  I2: "Black approval rate",
  I3: "White approval rate",
  I4: "gap (White - Black)",
};

export const lesson = createLesson({
  id: "excel-pivot-rates",
  tool: "sheet",
  moduleId: "excel",
  mode: "guided",
  // Outcome variant, following the excel-pivot exemplar: each step is the
  // business question with the click-path withheld, and the pivotSpec method
  // checks are dropped for pivotResult — any pivot that computes the right
  // table passes. The read-the-rates step is already outcome-graded, so only
  // its text changes (the scaffolded instruction printed the answers).
  modes: ["outcome"],
  voice: true,
  title: "% of Column Total: approval rates in one pivot setting",
  description:
    "The fastest route from raw lending data to approval rates: put the outcome on Rows, one race per " +
    "column, count the records, and let Show Values As → % of Column Total turn every count into a " +
    "rate. No formulas — and the 30-point White/Black gap appears in a single click.",
  resources: [HMDA],
  steps: [
    {
      id: "pivot-outcomes",
      title: "Outcomes down, races across",
      instruction:
        "Insert a pivot over A1:G101 with approved on Rows and race on Columns, counting the records " +
        "(drag any field to Values as a Count — applicant_id is the usual choice). You should see a " +
        "2 × 6 table of counts: the Black column reads 9 approved / 7 denied, White 43 / 7.",
      hints: [
        "Two grouping fields this time: the outcome AND the race. One goes down, one goes across.",
        "approved goes on Rows, race on Columns — each race gets its own column of counts.",
        "Values needs a Count. Drag applicant_id there; Count of any field counts the same 100 rows.",
        "Rows: approved. Columns: race. Values: Count of applicant_id. The White column shows 43 and 7.",
      ],
      target: { kind: "selector", selector: "[data-guide-target='sheet-grid']" },
      spotlightLabel: "Put approved in Rows and race in Columns",
      checkpoint: checkpointWithPivot({ rows: [], cols: [], values: [], filters: {} }),
      grader: {
        type: "pivotSpec",
        expected: { rows: ["approved"], cols: ["race"], values: [COUNT_ANY] },
      },
      modes: {
        outcome: {
          instruction:
            "How many applications were APPROVED and how many DENIED within each race group? Build a " +
            "table over A1:G101 with the outcomes down the side and one race per column, counts in the " +
            "cells.",
          hints: [
            "Two grouping directions at once: outcome one way, race the other.",
            "Done right, the Black column reads 9 approved / 7 denied and White reads 43 / 7.",
          ],
          grader: {
            type: "pivotResult",
            expected: { rows: ["approved"], cols: ["race"], values: [COUNT_VALUE] },
          },
        },
      },
    },
    {
      id: "show-as-column-total",
      title: "One click: counts become rates",
      instruction:
        "Right-click the value field → Show Values As → % of Column Total. Each race's column now sums " +
        "to 100%, so the APPROVED row IS the approval rate: Black 56.25%, White 86%. (With races on " +
        "Columns you want % of COLUMN Total — % of Row Total would divide by all approvals instead.)",
      hints: [
        "No formula needed — the pivot can re-express its own counts as percentages.",
        "The setting lives on the value field: Show Values As.",
        "Each race is a COLUMN here, so the total that matters is the column's — pick % of Column Total.",
        "Right-click Count of applicant_id → Show Values As → % of Column Total. Black/APPROVED reads 56.25%, White/APPROVED 86%.",
      ],
      target: { kind: "selector", selector: "[data-guide-target='sheet-grid']" },
      spotlightLabel: "Set Show Values As to % of Column Total",
      checkpoint: checkpointWithPivot({ rows: ["approved"], cols: ["race"], values: [COUNT_VALUE], filters: {} }),
      grader: {
        type: "allOf",
        of: [
          { type: "pivotSpec", expected: { rows: ["approved"], cols: ["race"], values: [{ ...RATE_VALUE, field: "*" }] } },
          { type: "pivotResult", expected: FINAL_SPEC },
        ],
      },
      modes: {
        outcome: {
          instruction:
            "Raw counts can't be compared across groups of different sizes. Re-express the table so " +
            "each race's column shows the SHARE of that group's applications in each outcome — every " +
            "column adding to 100% — and the approved row becomes the group's approval rate.",
          hints: [
            "No formulas needed: the table can re-express its own counts.",
            "Each group's total runs down its own column here — mind which total you divide by.",
          ],
          grader: { type: "pivotResult", expected: FINAL_SPEC },
        },
      },
    },
    {
      id: "read-the-rates",
      title: "Read the table like an analyst",
      instruction:
        "Now prove you can read it. Next to the labels in column I, enter the rates as decimals: " +
        "J2 = the Black approval rate, J3 = the White approval rate, and J4 = the gap between them " +
        "(White minus Black). Type the numbers or compute J4 with a formula — your call.",
      hints: [
        "The APPROVED row holds the rates. Percentages are decimals: 86% is 0.86.",
        "Black approves at 56.25% — as a decimal that's 0.5625. White is 0.86.",
        "The gap is a subtraction: 0.86 - 0.5625. =J3-J2 works too.",
        "J2: 0.5625. J3: 0.86. J4: 0.2975 — nearly 30 points of approval-rate gap in the same file.",
      ],
      target: { kind: "sheet-cell", ref: "J2" },
      spotlightLabel: "Type the Black approval rate into J2",
      checkpoint: checkpointWithPivot(FINAL_SPEC, READ_LABELS),
      grader: {
        type: "allOf",
        of: [
          { type: "cellValue", ref: "J2", expected: 0.5625 },
          { type: "cellValue", ref: "J3", expected: 0.86 },
          { type: "cellValue", ref: "J4", expected: 0.2975, tolerance: 1e-4 },
        ],
      },
      modes: {
        outcome: {
          // Grader unchanged — cellValue is already the outcome check; only
          // the text changes, because the scaffolded instruction printed the
          // three answers it was asking for.
          instruction:
            "Read your own table like an analyst: what is the Black approval rate, what is the White " +
            "approval rate, and how far apart are they? Record all three as decimals next to the labels " +
            "— J2, J3, and J4 (White minus Black).",
          hints: [
            "The approved row holds the rates; a percentage as a decimal is its value over 100.",
            "The gap is the difference between the two rates you just read.",
          ],
        },
      },
    },
  ],
});

export default lesson;
