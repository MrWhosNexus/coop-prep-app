// Guided lesson: dimensions vs measures — Tableau's core mental model,
// taught with the first bar chart: count of applicants by race group.
//
// The model, in one line each:
//   a DIMENSION slices (blue pill → headers): race makes six slots;
//   a MEASURE aggregates (green pill → an axis): COUNT collapses each slot
//   to one number;
//   the SHELF sets the orientation: swap the pills, the bars turn over.
//
// Ground truth (verified against public/data/hmda-sample.csv):
//   American Indian 3, Asian 10, Black 16, Hispanic 18, Other 3, White 50
//
// Grading doctrine: steps 1-2 and 4 grade the METHOD (vizSpec) — which pill
// on which shelf IS the mental model; step 3 adds the OUTCOME (vizData) so
// the bars must carry the true counts.

import { createLesson } from "../spec.js";

const HMDA = "hmda-sample.csv";

const COUNT_PILL = { field: "applicant_id", aggregation: "COUNT" };

/** Verified applicant counts per race group. */
export const EXPECTED_COUNTS = [
  { race: "American Indian", "COUNT(applicant_id)": 3 },
  { race: "Asian", "COUNT(applicant_id)": 10 },
  { race: "Black", "COUNT(applicant_id)": 16 },
  { race: "Hispanic", "COUNT(applicant_id)": 18 },
  { race: "Other", "COUNT(applicant_id)": 3 },
  { race: "White", "COUNT(applicant_id)": 50 },
];

// Outcome-mode fixture: the six race groups with no measure — grades that one
// mark per group exists, wherever the slicing came from.
const RACE_GROUPS = EXPECTED_COUNTS.map(({ race }) => ({ race }));

function vizCheckpoint(extra = {}) {
  return { tool: "viz", data: { resource: HMDA }, ...extra };
}

export const lesson = createLesson({
  id: "tableau-dimensions",
  tool: "viz",
  moduleId: "tableau",
  mode: "guided",
  // Outcome variant: same step ids and checkpoints; questions instead of
  // moves, vizData graders wherever the outcome is observable in the marks.
  modes: ["outcome"],
  voice: true,
  title: "Dimensions vs measures: your first bar chart",
  description:
    "Everything in Tableau is a dimension (categorical — it slices the view) or a measure (numeric — " +
    "it aggregates into an axis). Build one bar chart from the HMDA extract and you'll have used both, " +
    "plus the third idea people miss: the SHELF a pill lands on decides the chart's orientation.",
  resources: [HMDA],
  steps: [
    {
      id: "dimension-slices",
      title: "Drop a dimension: race on Rows",
      instruction:
        "Start from a blank view and drag race to the Rows shelf. It arrives as a BLUE pill — " +
        "discrete — and the view grows six row HEADERS, one per race group. No axis, no numbers: a " +
        "dimension only slices.",
      hints: [
        "race is text with a handful of repeated values — that's what makes it a dimension.",
        "The Rows shelf runs its headers down the page.",
        "Blue pill = discrete = headers. Remember the color; it's Tableau's biggest hint.",
        "Rows: race. Six headers appear (American Indian through White), and nothing else.",
      ],
      checkpoint: vizCheckpoint(),
      grader: { type: "vizSpec", expected: { rows: [{ field: "race", discrete: true }] } },
      target: { kind: "region", anchor: "viz-rows" },
      spotlightLabel: "Drag race onto the Rows shelf",
      modes: {
        outcome: {
          instruction:
            "Make the view enumerate the race groups — one slot per group, named, with no numbers yet.",
          hints: [
            "The field that carries the six groups is race.",
            "Six entries, American Indian through White, and nothing else.",
          ],
          // Method grader (vizSpec: discrete pill on Rows) swapped for
          // OUTCOME: one mark per race group must exist, whichever shelf
          // produced the slicing.
          grader: { type: "vizData", expected: RACE_GROUPS, keyFields: ["race"] },
        },
      },
    },
    {
      id: "measure-aggregates",
      title: "Drop a measure: COUNT of applicants on Columns",
      instruction:
        "Now drag applicant_id to the Columns shelf and set its aggregation to COUNT (right-click the " +
        "pill → Measure → Count). It turns GREEN — continuous — and an axis appears across the page. " +
        "Each race's slot collapses to one number: how many applicants it holds.",
      hints: [
        "A measure never arrives raw — it lands pre-aggregated. You choose HOW it aggregates.",
        "applicant_id is an ID, so counting is the only aggregation that makes sense: one row per applicant.",
        "Right-click the pill on Columns → Measure → Count. Green pill, continuous axis.",
        "Rows: race. Columns: CNT(applicant_id). Horizontal bars — White stretches to 50.",
      ],
      checkpoint: vizCheckpoint({ shelves: { rows: ["race"] } }),
      grader: {
        type: "vizSpec",
        expected: { rows: ["race"], columns: [COUNT_PILL] },
      },
      target: { kind: "region", anchor: "viz-columns" },
      spotlightLabel: "Count applicants on the Columns shelf",
      modes: {
        outcome: {
          instruction:
            "How many applicants does each group hold? Collapse each slot to that one number.",
          hints: [
            "One number per group — White should reach 50.",
            "3, 10, 16, 18, 3, 50, in alphabetical order.",
          ],
          // Method grader (vizSpec pill recipe) swapped for OUTCOME.
          grader: { type: "vizData", expected: EXPECTED_COUNTS, keyFields: ["race"] },
        },
      },
    },
    {
      id: "read-the-bars",
      title: "Make it a bar and read it",
      instruction:
        "Set the mark to bar (Automatic already resolves to bar for this shelf arrangement). Read the " +
        "chart: White 50 — half the file — Hispanic 18, Black 16, Asian 10, and two groups of 3. " +
        "Group sizes matter later: a rate over 3 people is far noisier than one over 50.",
      hints: [
        "Discrete pill on one axis + continuous pill on the other = the classic bar shape.",
        "The Marks card (or Show Me) sets the mark type; Automatic picks bar here on its own.",
        "Check the longest and shortest bars against the data pane's idea of the file.",
        "Mark: bar. The bars read 3, 10, 16, 18, 3, 50 — alphabetical down the headers.",
      ],
      checkpoint: vizCheckpoint({ shelves: { rows: ["race"], columns: [COUNT_PILL] } }),
      grader: {
        type: "allOf",
        of: [
          { type: "vizSpec", expected: { mark: "bar" } },
          { type: "vizData", expected: EXPECTED_COUNTS, keyFields: ["race"] },
        ],
      },
      target: { kind: "region", anchor: "viz-showme" },
      spotlightLabel: "Set the mark to bar",
      modes: {
        outcome: {
          instruction:
            "Show the counts as bars and read them: which groups are big enough to support a rate, " +
            "and which are too small to conclude anything from?",
          hints: [
            "Bars: groups on one axis, counts on the other.",
            "A rate over 3 people is noise; a rate over 50 is evidence.",
          ],
          // Same shape as the base grader (mark + data) — both halves already
          // read the RESULT: resolveMark() and the computed counts.
          grader: {
            type: "allOf",
            of: [
              { type: "vizSpec", expected: { mark: "bar" } },
              { type: "vizData", expected: EXPECTED_COUNTS, keyFields: ["race"] },
            ],
          },
        },
      },
    },
    {
      id: "swap-orientation",
      title: "Swap the shelves: the bars stand up",
      instruction:
        "Move race to Columns and CNT(applicant_id) to Rows — the same two pills, shelves exchanged. " +
        "The bars turn vertical. Nothing about the DATA changed; the shelf a pill sits on is purely " +
        "about layout. This is why 'which shelf?' is always worth a second thought.",
      hints: [
        "Drag the pills between shelves — don't rebuild them from the data pane.",
        "Categories across the page + values up the page = vertical (column) bars.",
        "Both pills move: race to Columns, the count to Rows.",
        "Columns: race. Rows: CNT(applicant_id). Same six numbers, standing up.",
      ],
      checkpoint: vizCheckpoint({ shelves: { rows: ["race"], columns: [COUNT_PILL] }, mark: "bar" }),
      grader: {
        type: "vizSpec",
        strict: true,
        expected: { columns: ["race"], rows: [COUNT_PILL] },
      },
      target: { kind: "region", anchor: "viz-columns" },
      spotlightLabel: "Swap race and the count between shelves",
      modes: {
        outcome: {
          instruction:
            "Turn the chart over: same two pills, same six numbers, bars standing up instead of " +
            "lying down. What changed about the data? (Nothing — that's the point.)",
          hints: [
            "Nothing about the data changes — only where each pill sits.",
            "Categories across the page, values up the page.",
          ],
          // NO outcome grader exists for orientation: vizData sees identical
          // numbers either way round, so the strict vizSpec method grader is
          // kept — the shelf assignment IS the observable outcome here.
        },
      },
    },
  ],
});

export default lesson;
