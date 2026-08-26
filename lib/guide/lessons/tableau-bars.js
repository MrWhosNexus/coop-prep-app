// EXEMPLAR guided lesson: approval rate by race as a bar chart — the
// canonical teaching viz, built the way Tableau teaches it: a calculated
// field turns APPROVED/DENIED into 1/0, and its AVG is the approval rate.
//
// Ground truth (verified against public/data/hmda-sample.csv):
//   White 43/50 = 0.86      Asian    8/10 = 0.80
//   Hispanic 12/18 = 0.667  Black    9/16 = 0.5625
//   American Indian 2/3     Other    2/3
//
// Grading doctrine on display here:
//   - step 1 is a predicate that grades the calculated field by OUTCOME (any
//     expression that flags exactly the 76 approvals passes) while pinning
//     the field NAME, which later steps depend on — and it diagnoses the
//     classic TRUE/FALSE-instead-of-1/0 mistake by name;
//   - steps 2-3 grade the METHOD (vizSpec): which pill, which shelf, which
//     aggregation IS the Tableau lesson;
//   - step 4 adds the OUTCOME (vizData): the bars must encode the true rates.

import { createLesson } from "../spec.js";
import { applyCalculatedFields } from "../../viz/fields.js";

const HMDA = "hmda-sample.csv";

const CALC = { name: "is_approved", expression: 'IF([approved] = "APPROVED", 1, 0)' };

/** The verified approval rate per race group over the real extract. */
export const EXPECTED_RATES = [
  { race: "American Indian", "AVG(is_approved)": 2 / 3 },
  { race: "Asian", "AVG(is_approved)": 8 / 10 },
  { race: "Black", "AVG(is_approved)": 9 / 16 },
  { race: "Hispanic", "AVG(is_approved)": 12 / 18 },
  { race: "Other", "AVG(is_approved)": 2 / 3 },
  { race: "White", "AVG(is_approved)": 43 / 50 },
];

/**
 * OUTCOME grader for the calculated field: the name must be exactly
 * is_approved (later steps reference it), but ANY expression that marks the
 * 76 approvals as 1 and the 24 denials as 0 passes.
 */
function calcFieldCheck(toolState) {
  const calcs = toolState?.spec?.calculatedFields ?? [];
  const names = calcs.map((c) => c.name);
  const cf = calcs.find((c) => c.name === "is_approved");
  if (!cf) {
    const hint = names.length
      ? `Found calculated field(s) named ${names.join(", ")} — the lesson needs one named exactly is_approved.`
      : "Create a calculated field named exactly is_approved.";
    return {
      pass: false,
      score: 0,
      message: hint,
      expected: "a calculated field named is_approved",
      actual: names.join(", ") || null,
      diff: [{ kind: "missing", path: "calculatedFields", expected: "is_approved", actual: names.join(", ") || null, hint }],
    };
  }

  let rows;
  try {
    rows = applyCalculatedFields(toolState.rows, [cf]);
  } catch (err) {
    const hint = `is_approved doesn't evaluate: ${err.message}`;
    return {
      pass: false,
      score: 0.25,
      message: hint,
      expected: CALC.expression,
      actual: cf.expression ?? null,
      diff: [{ kind: "wrong", path: "calculatedFields.is_approved", expected: CALC.expression, actual: cf.expression ?? null, hint }],
    };
  }

  const ones = rows.filter((r) => r.is_approved === 1).length;
  const zeros = rows.filter((r) => r.is_approved === 0).length;
  if (ones === 76 && zeros === 24) {
    return { pass: true, message: "is_approved flags 76 approvals and 24 denials — exactly right." };
  }
  const booleans = rows.filter((r) => typeof r.is_approved === "boolean").length;
  const hint =
    booleans > 0
      ? "Your field returns TRUE/FALSE — AVG can't average booleans. Wrap the test in IF(..., 1, 0)."
      : `Your field marks ${ones} of 100 rows as 1; the data has exactly 76 approvals. Compare [approved] to the exact text "APPROVED".`;
  return {
    pass: false,
    score: 0.5,
    message: hint,
    expected: "76 rows = 1, 24 rows = 0",
    actual: `${ones} rows = 1, ${zeros} rows = 0${booleans ? ` (${booleans} rows are TRUE/FALSE)` : ""}`,
    diff: [{ kind: "wrong", path: "calculatedFields.is_approved", expected: "76 rows = 1, 24 rows = 0", actual: `${ones} rows = 1, ${zeros} rows = 0`, hint }],
  };
}

function vizCheckpoint(extra = {}) {
  return { tool: "viz", data: { resource: HMDA }, ...extra };
}

const AVG_PILL = { field: "is_approved", aggregation: "AVG" };

export const lesson = createLesson({
  id: "tableau-bars",
  tool: "viz",
  moduleId: "tableau",
  mode: "guided",
  voice: true,
  title: "Approval rate by race: your first real bar chart",
  description:
    "Build the chart this whole curriculum points at: one bar per race group, bar height = approval " +
    "rate, over the real HMDA extract. On the way you learn Tableau's core moves — a calculated field, " +
    "the dimension/measure split, and why AVG of a 1/0 flag is a rate.",
  resources: [HMDA],
  steps: [
    {
      id: "calc-field",
      title: "Create the is_approved flag",
      instruction:
        "The data says APPROVED or DENIED, but a chart needs a number. Create a calculated field named " +
        "exactly is_approved that is 1 when [approved] is \"APPROVED\" and 0 otherwise: " +
        'IF([approved] = "APPROVED", 1, 0). The average of a 1/0 flag IS the approval rate.',
      hints: [
        "Analysis → Create Calculated Field. The formula language has IF(condition, then, else).",
        "Compare the approved column to the exact text \"APPROVED\": [approved] = \"APPROVED\".",
        "Return the NUMBERS 1 and 0, not TRUE/FALSE — you're going to average this field.",
        'Name: is_approved. Formula: IF([approved] = "APPROVED", 1, 0).',
      ],
      checkpoint: vizCheckpoint(),
      grader: { type: "predicate", fn: calcFieldCheck, label: "The is_approved calculated field" },
      target: { kind: "region", anchor: "viz-fieldlist" },
      spotlightLabel: "Create the is_approved calculated field",
    },
    {
      id: "race-columns",
      title: "Put race on Columns",
      instruction:
        "Drag race to the Columns shelf. It's a dimension — a blue, discrete pill — so it slices the " +
        "view into one slot per race group.",
      hints: [
        "Dimensions slice, measures aggregate. race is a dimension.",
        "For vertical bars, the category goes across the page — that's the Columns shelf.",
        "Drag race from the data pane onto Columns. The pill should be blue (discrete).",
        "Columns: race. Nothing else yet.",
      ],
      checkpoint: vizCheckpoint({ calculatedFields: [CALC] }),
      grader: { type: "vizSpec", expected: { columns: ["race"] } },
      target: { kind: "region", anchor: "viz-columns" },
      spotlightLabel: "Drag race onto the Columns shelf",
    },
    {
      id: "avg-rows",
      title: "Put AVG(is_approved) on Rows",
      instruction:
        "Drag is_approved to the Rows shelf, then change its aggregation from SUM to AVG (right-click " +
        "the pill → Measure → Average). SUM would count approvals; AVG divides by the group size — " +
        "that's the approval rate.",
      hints: [
        "Measures land on shelves already aggregated — but the DEFAULT aggregation is SUM.",
        "SUM(is_approved) for White is 43 (approvals); you want 43/50 = 0.86 (the rate).",
        "Right-click the is_approved pill on Rows → Measure → Average.",
        "Rows: AVG(is_approved), a green continuous pill. Columns: race.",
      ],
      checkpoint: vizCheckpoint({ calculatedFields: [CALC], shelves: { columns: ["race"] } }),
      grader: { type: "vizSpec", expected: { columns: ["race"], rows: [AVG_PILL] } },
      target: { kind: "region", anchor: "viz-rows" },
      spotlightLabel: "Drag is_approved to Rows and average it",
    },
    {
      id: "bar-chart",
      title: "Make it a bar chart and read it",
      instruction:
        "Set the mark type to bar (the Marks card, or Show Me — Automatic already picks bar for this " +
        "shelf arrangement). Six bars appear. Read the story the chart tells: White approves at 86%, " +
        "Black at 56.25% — a 30-point gap in the same dataset.",
      hints: [
        "Show Me highlights the chart types your shelves support — bar is the natural fit here.",
        "Discrete pill on Columns + continuous pill on Rows = a classic column (bar) chart.",
        "Pick bar on the Marks card; Automatic also resolves to bar for this arrangement.",
        "Mark: bar. Columns: race. Rows: AVG(is_approved). The Black bar sits at 0.5625, White at 0.86.",
      ],
      checkpoint: vizCheckpoint({
        calculatedFields: [CALC],
        shelves: { columns: ["race"], rows: [AVG_PILL] },
      }),
      grader: {
        type: "allOf",
        of: [
          { type: "vizSpec", expected: { mark: "bar", columns: ["race"], rows: [AVG_PILL] } },
          { type: "vizData", expected: EXPECTED_RATES, keyFields: ["race"] },
        ],
      },
      target: { kind: "region", anchor: "viz-showme" },
      spotlightLabel: "Set the mark type to bar",
    },
  ],
});

export default lesson;
