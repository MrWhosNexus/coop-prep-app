// Guided lesson: the governance dashboard's second panel — loan-amount
// bands. Curriculum tableau-2 asks for exactly this sheet: count of records
// by band (under $150k / $150k-$250k / over $250k), and the rate-by-band
// comparison that makes the two-panel dashboard tell one story.
//
// Ground truth (verified against public/data/hmda-sample.csv):
//   band counts: Under $150k 18, $150k-$250k 52, Over $250k 30
//   approval rate by band: Under 2/3, Mid 0.7307692..., Over 0.8666666...
//   — larger loans approve MORE, so "risky big loans" can't explain the
//   race gap either. Panel 1 (rate by race) + panel 2 (rate by band) is the
//   5-second dashboard: the gap is about WHO, not HOW MUCH.
//
// Grading doctrine:
//   - step 1 is a predicate over the banding field: name pinned (step 2
//     grades on it), band NAMES pinned (they become the chart's headers),
//     membership checked against the data itself, boundary mistakes
//     diagnosed with the real 18/52/30 split;
//   - steps 2-3 are allOf(vizSpec, vizData): shelf recipe AND true numbers.

import { createLesson } from "../spec.js";
import { applyCalculatedFields } from "../../viz/fields.js";

const HMDA = "hmda-sample.csv";

const BAND_CALC = {
  name: "loan_band",
  expression:
    'IF([loan_amount] < 150000, "Under $150k", IF([loan_amount] < 250000, "$150k-$250k", "Over $250k"))',
  // The field produces text labels — declare it, or the checkpoint would
  // materialize loan_band as a default numeric measure.
  type: "string",
  role: "dimension",
};
const APPROVED_CALC = { name: "is_approved", expression: 'IF([approved] = "APPROVED", 1, 0)' };

const COUNT_PILL = { field: "applicant_id", aggregation: "COUNT" };
const AVG_PILL = { field: "is_approved", aggregation: "AVG" };

export const BAND_NAMES = ["Under $150k", "$150k-$250k", "Over $250k"];

/** Verified applicant counts per band. */
export const BAND_COUNTS = [
  { loan_band: "Under $150k", "COUNT(applicant_id)": 18 },
  { loan_band: "$150k-$250k", "COUNT(applicant_id)": 52 },
  { loan_band: "Over $250k", "COUNT(applicant_id)": 30 },
];

/** Verified approval rate per band. */
export const BAND_RATES = [
  { loan_band: "Under $150k", "AVG(is_approved)": 12 / 18 },
  { loan_band: "$150k-$250k", "AVG(is_approved)": 38 / 52 },
  { loan_band: "Over $250k", "AVG(is_approved)": 26 / 30 },
];

/**
 * OUTCOME grader for the banding field: the name and the three band labels
 * are pinned (the next steps grade on them), but ANY expression that puts
 * all 100 loans in the right band passes. Expected membership is derived
 * from the rows themselves.
 */
function bandFieldCheck(toolState) {
  const calcs = toolState?.spec?.calculatedFields ?? [];
  const names = calcs.map((c) => c.name);
  const cf = calcs.find((c) => c.name === "loan_band");
  if (!cf) {
    const hint = names.length
      ? `Found calculated field(s) named ${names.join(", ")} — the lesson needs one named exactly loan_band.`
      : "Create a calculated field named exactly loan_band.";
    return {
      pass: false,
      message: hint,
      expected: "a calculated field named loan_band",
      actual: names.join(", ") || null,
      diff: [{ kind: "missing", path: "calculatedFields", expected: "loan_band", actual: names.join(", ") || null, hint }],
    };
  }

  let rows;
  try {
    rows = applyCalculatedFields(toolState.rows, [cf]);
  } catch (err) {
    const hint = `loan_band doesn't evaluate: ${err.message}`;
    return {
      pass: false,
      score: 0.25,
      message: hint,
      expected: BAND_CALC.expression,
      actual: cf.expression ?? null,
      diff: [{ kind: "wrong", path: "calculatedFields.loan_band", expected: BAND_CALC.expression, actual: cf.expression ?? null, hint }],
    };
  }

  const expectedBand = (v) => (v < 150000 ? BAND_NAMES[0] : v < 250000 ? BAND_NAMES[1] : BAND_NAMES[2]);
  let ok = 0;
  const wrongNames = new Set();
  for (const r of rows) {
    if (r.loan_band === expectedBand(r.loan_amount)) ok++;
    else if (!BAND_NAMES.includes(r.loan_band)) wrongNames.add(String(r.loan_band));
  }
  if (ok === rows.length) {
    return { pass: true, message: "loan_band sorts all 100 loans correctly: 18 under, 52 middle, 30 over." };
  }
  const hint = wrongNames.size
    ? `Your field produces band(s) named ${[...wrongNames].join(", ")} — the dashboard needs the exact labels ` +
      `"${BAND_NAMES.join('", "')}".`
    : `${rows.length - ok} of 100 loans land in the wrong band — check the boundary conditions ` +
      "(< 150000 first, then < 250000; the true split is 18 / 52 / 30).";
  return {
    pass: false,
    score: 0.5,
    message: hint,
    expected: "18 Under $150k, 52 $150k-$250k, 30 Over $250k",
    actual: cf.expression ?? null,
    diff: [{ kind: "wrong", path: "calculatedFields.loan_band", expected: BAND_CALC.expression, actual: cf.expression ?? null, hint }],
  };
}

function vizCheckpoint(extra = {}) {
  return { tool: "viz", data: { resource: HMDA }, ...extra };
}

export const lesson = createLesson({
  id: "tableau-dashboard",
  tool: "viz",
  moduleId: "tableau",
  mode: "guided",
  // Outcome variant: business questions, no formulas; graders read the
  // computed panel (vizData) rather than the shelf recipe.
  modes: ["outcome"],
  voice: true,
  title: "The dashboard's second panel: loan bands",
  description:
    "A governance dashboard answers \"does this model treat all groups fairly?\" in five seconds — " +
    "and it takes two panels: rate by race, and this one, the portfolio by loan band. You'll mint the " +
    "band field, count the portfolio into it, then flip the count to a rate and read the pair of " +
    "panels the way a reviewer would.",
  resources: [HMDA],
  steps: [
    {
      id: "band-field",
      title: "Mint the banding field",
      instruction:
        "Create a calculated field named exactly loan_band that sorts every loan into " +
        '"Under $150k", "$150k-$250k" or "Over $250k". Nested IFs do it: ' +
        'IF([loan_amount] < 150000, "Under $150k", IF([loan_amount] < 250000, "$150k-$250k", "Over $250k")). ' +
        "Condition order is the trap — test the smallest band first.",
      hints: [
        "Two cutoffs (150000, 250000) make three bands — that's two nested IFs.",
        "Test < 150000 FIRST. If you test < 250000 first, every small loan lands in the middle band.",
        "Use the exact band labels including the $ and k — they become the chart's headers.",
        'IF([loan_amount] < 150000, "Under $150k", IF([loan_amount] < 250000, "$150k-$250k", "Over $250k")) — 18/52/30.',
      ],
      checkpoint: vizCheckpoint(),
      grader: { type: "predicate", fn: bandFieldCheck, label: "The loan_band calculated field" },
      target: { kind: "region", anchor: "viz-fieldlist" },
      spotlightLabel: "Create the loan_band calculated field",
      modes: {
        outcome: {
          instruction:
            "Sort every loan into one of three buckets — below $150k, from $150k up to $250k, and " +
            'above — in a new field named exactly loan_band using the exact labels "Under $150k", ' +
            '"$150k-$250k" and "Over $250k"; the dashboard\'s headers come straight from them.',
          hints: [
            "Two cutoffs, 150000 and 250000, make the three bands.",
            "The true split is 18 / 52 / 30 — if your middle band swallows the small loans, check which cutoff you test first.",
          ],
          // No grader override: the base predicate is already an OUTCOME
          // grader — any expression banding all 100 loans correctly passes.
        },
      },
    },
    {
      id: "count-by-band",
      title: "Count the portfolio into the bands",
      instruction:
        "Build the panel: loan_band on Columns, COUNT of applicant_id on Rows, mark bar. Three bars: " +
        "18 / 52 / 30. Over half this portfolio lives in the middle band — that's the context the " +
        "race chart needs sitting next to it.",
      hints: [
        "loan_band is a dimension now — it slices, exactly like race did.",
        "The measure is the same one as ever: CNT(applicant_id).",
        "Columns: loan_band. Rows: CNT(applicant_id). Mark: bar.",
        "Bars: Under $150k 18, $150k-$250k 52, Over $250k 30.",
      ],
      checkpoint: vizCheckpoint({ calculatedFields: [BAND_CALC] }),
      grader: {
        type: "allOf",
        of: [
          { type: "vizSpec", expected: { columns: ["loan_band"], rows: [COUNT_PILL], mark: "bar" } },
          { type: "vizData", expected: BAND_COUNTS, keyFields: ["loan_band"] },
        ],
      },
      target: { kind: "region", anchor: "viz-columns" },
      spotlightLabel: "Drag loan_band onto the Columns shelf",
      modes: {
        outcome: {
          instruction:
            "How is the portfolio distributed across the three bands? Build the panel that shows " +
            "where the loans actually live.",
          hints: [
            "One value per band, counting applicants.",
            "Over half the file sits in the middle band: 18 / 52 / 30.",
          ],
          // Method half (vizSpec shelves + mark) dropped; the OUTCOME half
          // stays — the panel must compute the true band counts.
          grader: { type: "vizData", expected: BAND_COUNTS, keyFields: ["loan_band"] },
        },
      },
    },
    {
      id: "rate-by-band",
      title: "Flip it to a rate — and read both panels",
      instruction:
        "Swap the measure: replace the count on Rows with AVG(is_approved) (the 1/0 flag is already in " +
        "the data pane). Rates by band: 66.7%, 73.1%, 86.7% — BIGGER loans approve MORE, because loan " +
        "size tracks income here. So neither the ask (loan-to-income) nor the amount explains the race " +
        "gap. Two panels, one sentence: the gap is about who, not how much.",
      hints: [
        "Only the Rows pill changes — loan_band stays on Columns.",
        "AVG of a 1/0 flag is a rate — the same trick as the race chart.",
        "If your bars read 12, 38, 26 you're summing the flag; switch the pill to AVG.",
        "Rows: AVG(is_approved). Bars: 0.667, 0.731, 0.867 — rising with loan size.",
      ],
      checkpoint: vizCheckpoint({
        calculatedFields: [BAND_CALC, APPROVED_CALC],
        shelves: { columns: ["loan_band"], rows: [COUNT_PILL] },
        mark: "bar",
      }),
      grader: {
        type: "allOf",
        of: [
          { type: "vizSpec", expected: { columns: ["loan_band"], rows: [AVG_PILL] }, strict: true },
          { type: "vizData", expected: BAND_RATES, keyFields: ["loan_band"] },
        ],
      },
      target: { kind: "region", anchor: "viz-rows" },
      spotlightLabel: "Switch the Rows measure to average",
      modes: {
        outcome: {
          instruction:
            "Do bigger loans approve less often? Turn the panel into an approval rate per band and " +
            "read it next to the race panel — what one sentence do the two panels support?",
          hints: [
            "A rate, not a count, per band — if you see 12 / 38 / 26 you're still counting approvals.",
            "Rates RISE with size: 0.667, 0.731, 0.867 — so \"risky big loans\" can't explain the race gap.",
          ],
          // Method half (strict vizSpec) dropped; OUTCOME half stays.
          grader: { type: "vizData", expected: BAND_RATES, keyFields: ["loan_band"] },
        },
      },
    },
  ],
});

export default lesson;
