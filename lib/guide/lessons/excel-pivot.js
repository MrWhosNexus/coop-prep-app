// EXEMPLAR guided lesson: the COOP Advanced Excel capstone, end to end.
// Load the real HMDA extract, build a pivot (rows = race, cols = approved,
// count of applicant_id), then Show Values As % of Row Total to surface the
// approval-rate disparity the curriculum exists to teach:
// Black 56.25% approved vs White 86%.
//
// Grading doctrine on display here:
//   - steps 2-4 grade the METHOD (pivotSpec) because building the pivot IS
//     the lesson;
//   - step 4 ALSO grades the OUTCOME (pivotResult) against the real data, so
//     a correct-looking spec that computes the wrong table cannot pass.

import { createLesson } from "../spec.js";

const HMDA = "hmda-sample.csv";
const SOURCE = "A1:G101";

const HEADERS = [["applicant_id", "race", "gender", "zip_code", "loan_amount", "income", "approved"]];

const loadedData = { name: "Data", load: [{ resource: HMDA, origin: "A1" }] };

/** A complete sheet-tool checkpoint with the CSV loaded and a pivot panel. */
function checkpointWithPivot(spec) {
  return {
    tool: "sheet",
    active: "Data",
    sheets: [loadedData],
    pivot: { sourceRange: SOURCE, spec },
  };
}

const COUNT_VALUE = { field: "applicant_id", agg: "count" };
const RATE_VALUE = { field: "applicant_id", agg: "count", showAs: "percentOfRowTotal" };

const FINAL_SPEC = { rows: ["race"], cols: ["approved"], values: [RATE_VALUE] };

export const lesson = createLesson({
  id: "excel-pivot",
  tool: "sheet",
  moduleId: "excel",
  mode: "guided",
  voice: true,
  title: "Pivot tables from scratch: approval rates in real lending data",
  description:
    "The first thing you'll do with any dataset at COOP is pivot it. Here you build the exact pivot " +
    "an analyst would use on real HMDA mortgage data — and watch it surface a 30-point approval-rate " +
    "gap between White and Black applicants.",
  resources: [HMDA],
  steps: [
    {
      id: "load-data",
      title: "Load the HMDA extract",
      instruction:
        "Load /data/hmda-sample.csv into the sheet with A1 as the origin. You should end up with " +
        "7 columns (applicant_id through approved) and 100 applicants in rows 2-101.",
      hints: [
        "The sheet toolbar has a Load CSV button — the dataset lives at /data/hmda-sample.csv.",
        "Keep the default origin A1 so the headers land in row 1.",
        "After loading, row 1 holds the 7 headers and rows 2-101 hold applicants A0001 through A0100.",
        "Click Load CSV, pick hmda-sample.csv, confirm origin A1. Cell G1 should read \"approved\" and A101 should read \"A0100\".",
      ],
      target: { kind: "sheet-cell", ref: "A1" },
      spotlightLabel: "Load hmda-sample.csv starting at A1",
      checkpoint: { tool: "sheet", active: "Data", sheets: [{ name: "Data" }] },
      grader: {
        type: "allOf",
        of: [
          { type: "rangeValues", range: "A1:G1", expected: HEADERS },
          { type: "cellValue", ref: "A101", expected: "A0100" },
        ],
      },
    },
    {
      id: "pivot-count",
      title: "Count applicants by race",
      instruction:
        "Insert a pivot table over A1:G101. Drag race to Rows, then drag applicant_id to Values — " +
        "it should aggregate as a Count. You should see 6 race groups with their applicant counts " +
        "(White 50, Hispanic 18, Black 16, ...).",
      hints: [
        "A pivot needs at least one field in Rows and one in Values.",
        "The group you're comparing across goes on Rows — that's race.",
        "applicant_id is text, so Count is the right aggregation: it counts rows, one per applicant.",
        "Rows: race. Values: applicant_id, aggregation Count. Nothing on Columns yet.",
      ],
      target: { kind: "selector", selector: "[data-guide-target='sheet-grid']" },
      spotlightLabel: "Put race in Rows and count applicant_id in Values",
      checkpoint: checkpointWithPivot({ rows: [], cols: [], values: [], filters: {} }),
      grader: {
        type: "pivotSpec",
        expected: { rows: ["race"], values: [COUNT_VALUE] },
      },
    },
    {
      id: "pivot-columns",
      title: "Split the counts by outcome",
      instruction:
        "One number per race hides the story. Drag approved to Columns so every race splits into an " +
        "APPROVED count and a DENIED count — Black should show 9 approved / 7 denied, White 43 / 7.",
      hints: [
        "You need a second grouping — this time across the page, not down it.",
        "The outcome field is `approved`; it belongs on Columns.",
        "Rows: race. Columns: approved. Values: Count of applicant_id.",
        "Drag approved to the Columns area. The table becomes race × APPROVED/DENIED with counts in the cells.",
      ],
      target: { kind: "selector", selector: "[data-guide-target='sheet-grid']" },
      spotlightLabel: "Drag approved into the Columns shelf",
      checkpoint: checkpointWithPivot({ rows: ["race"], cols: [], values: [COUNT_VALUE], filters: {} }),
      grader: {
        type: "pivotSpec",
        expected: { rows: ["race"], cols: ["approved"], values: [COUNT_VALUE] },
      },
    },
    {
      id: "show-as-rate",
      title: "Turn counts into approval rates",
      instruction:
        "Raw counts can't be compared across groups of different sizes — 9 approvals out of 16 is a very " +
        "different story from 43 out of 50. Right-click the value field → Show Values As → % of Row Total. " +
        "Each race's APPROVED cell becomes its approval rate: Black 56.25%, White 86%.",
      hints: [
        "You don't need a formula — pivot tables can re-express their own values.",
        "The setting is on the value field: Show Values As.",
        "With approved on Columns, each row's cells should sum to 100% — that's % of Row Total.",
        "Right-click Count of applicant_id → Show Values As → % of Row Total. The Black/APPROVED cell reads 56.25%, White/APPROVED 86%.",
      ],
      target: { kind: "selector", selector: "[data-guide-target='sheet-grid']" },
      spotlightLabel: "Set Show Values As to % of Row Total",
      checkpoint: checkpointWithPivot({ rows: ["race"], cols: ["approved"], values: [COUNT_VALUE], filters: {} }),
      grader: {
        type: "allOf",
        of: [
          { type: "pivotSpec", expected: FINAL_SPEC },
          { type: "pivotResult", expected: FINAL_SPEC },
        ],
      },
    },
  ],
});

export default lesson;
