// Guided lesson: data PROFILING — the first thing a Data Governance
// Associate does with any extract nobody vouches for: find out what is
// actually in it before trusting a single number computed from it.
//
// The corpus is the deliberately dirty HMDA extract
// (public/data/hmda-raw.csv, answer key in data/governance-manifest.json).
// This lesson only OBSERVES the mess; gov-quality-rules turns the
// observations into re-runnable rules and gov-completeness measures the
// gaps. Keeping the three separate mirrors how the job splits: profile,
// then legislate, then measure.
//
// Every expected number below was DERIVED by loading the real CSV through
// lib/sheet and evaluating the same formulas the steps ask for (a prior
// audit caught a lesson shipping six fabricated numbers, so no constant
// here is allowed to exist without a derivation):
//   COUNTA(A2:A105)                    = 104   records
//   A105                               = "A0072" (the file ends on a
//                                        near-duplicate, not A0104 — the
//                                        first hint the ids can't be trusted)
//   distinct non-blank race spellings  = 12    (American Indian, Asian,
//        asian, Black, black, BLACK, Caucasian, Hispanic, Other, White,
//        white, WHITE) — plus a "(blank)" pivot row for the 6 empty cells
//   COUNTA(F2:F105) - COUNT(F2:F105)   = 17    loan_amount cells stored as
//                                        text ("192,500", "$61,000")
// Honesty note carried into the step text: this is Excel standing in for a
// profiling tool. In an interview the learner should say "I profiled row
// counts, distinct values and type mismatches" — the concept — not imply
// they ran warehouse profiling jobs. SQL is deliberately out of scope here.

import { createLesson } from "../spec.js";

const RAW = "hmda-raw.csv";
// 104 data rows under the header: A1:H105.
const DATA_LAST_ROW = 105;

const HEADERS = [[
  "applicant_id", "application_date", "race", "gender",
  "zip_code", "loan_amount", "income", "approved",
]];

/** Derived: distinct non-blank spellings in the race column. */
export const DISTINCT_RACE_SPELLINGS = 12;
/** Derived: loan_amount cells that are text, so SUM silently skips them. */
export const LOAN_TEXT_CELLS = 17;
/** Derived: COUNTA over applicant_id — the record count. */
export const RECORD_COUNT = 104;

const COUNT_VALUE = { field: "applicant_id", agg: "count" };

const loadedData = { name: "Data", load: [{ resource: RAW, origin: "A1" }] };

/** Profile-area cells accumulated so far, so each checkpoint is complete. */
function profileCells(extra = {}) {
  return { J1: "profile", ...extra };
}

function checkpoint(cells, pivotSpec) {
  return {
    tool: "sheet",
    active: "Data",
    sheets: [{ ...loadedData, cells }],
    ...(pivotSpec
      ? { pivot: { sourceRange: `A1:H${DATA_LAST_ROW}`, spec: pivotSpec } }
      : {}),
  };
}

export const lesson = createLesson({
  id: "gov-profiling",
  tool: "sheet",
  moduleId: "aigovernance",
  mode: "guided",
  modes: ["outcome"],
  voice: true,
  title: "Profiling: what is actually in this file?",
  description:
    "A raw HMDA extract lands on your desk with no documentation and no owner. Before anyone " +
    "computes an approval rate from it, a governance analyst profiles it: how many records, what " +
    "each column actually contains, and which columns are lying about their type. This spreadsheet " +
    "stands in for a profiling tool — the questions are the same ones you would ask of a warehouse " +
    "table, and being able to name them is what the interview tests.",
  resources: [RAW],
  steps: [
    {
      // REMEDIATION (2026-08-26): this step used to say "the sheet toolbar has
      // a Load CSV button". No such control exists — the toolbar offers only
      // "Load HMDA sample" (hardcoded to the CLEAN file) and "Import CSV…" (a
      // local-file picker), so the step-0 empty-sheet checkpoint plus a grader
      // demanding the raw headers made this step UNCLEARABLE. The checkpoint
      // now pre-loads the extract (loading a CSV is not a governance skill —
      // the lesson value starts at profiling) and the step is orientation:
      // look at what arrived before trusting it.
      id: "load-data",
      title: "Meet the raw extract",
      instruction:
        "The raw extract (hmda-raw.csv) is already loaded, starting at A1. Before computing " +
        "anything from it, look at what actually arrived: 8 columns, and data down to row 105. " +
        "Check cell A105 — does the last applicant id look like the end of a clean sequence?",
      hints: [
        "The headers sit in row 1: applicant_id through approved.",
        "104 data rows means the last one sits in row 105.",
        "A105 reads \"A0072\" — an id from the MIDDLE of the sequence, your first sign this file contains duplicated records.",
      ],
      target: { kind: "sheet-cell", ref: "A105" },
      spotlightLabel: "Inspect the loaded extract — check A105",
      checkpoint: checkpoint({}),
      grader: {
        type: "allOf",
        of: [
          { type: "rangeValues", range: "A1:H1", expected: HEADERS },
          // The last row is a near-duplicate of A0072, NOT A0104. Pinning it
          // proves the whole file loaded AND plants the duplicate question.
          { type: "cellValue", ref: "A105", expected: "A0072" },
        ],
      },
      modes: {
        outcome: {
          instruction:
            "The raw extract is already on screen. Establish what you are dealing with: column " +
            "count, row count, and whether the last applicant id closes a clean sequence.",
          hints: [
            "Headers are in row 1; the data runs to row 105.",
            "Check A105 against the id sequence the file claims to follow.",
          ],
        },
      },
    },
    {
      id: "record-count",
      title: "Count the records",
      instruction:
        "First profile fact: how many records did we receive? Put the answer in J2 — computed " +
        "from the data, not read off the row numbers, because tomorrow's extract will be a " +
        "different length and this profile should re-run against it unchanged.",
      hints: [
        "You need a formula that counts how many rows carry a record.",
        "Count the entries in a column that is never empty — applicant_id in column A.",
        "COUNTA counts non-empty cells; ROWS counts cells in a range. Either works on A2:A105.",
        "J2: =COUNTA(A2:A105) — it returns 104.",
      ],
      target: { kind: "sheet-cell", ref: "J2" },
      spotlightLabel: "Compute the record count in J2",
      checkpoint: checkpoint(profileCells()),
      grader: {
        // METHOD + OUTCOME: a typed 104 defeats the point (the profile must
        // re-run on the next extract), so the cell must be a counting formula.
        type: "cellFormula",
        ref: "J2",
        pattern: "COUNTA|COUNT|ROWS",
        expectedValue: RECORD_COUNT,
      },
      modes: {
        outcome: {
          instruction: "How many records are in this extract? Put the number in J2.",
          hints: [
            "Every record has an applicant_id — count those.",
            "The data occupies rows 2 through 105.",
          ],
          grader: { type: "cellValue", ref: "J2", expected: RECORD_COUNT },
        },
      },
    },
    {
      id: "distinct-race",
      title: "Profile the race column",
      instruction:
        "The fair-lending analysis groups by race, so: how many different values does the race " +
        "column ACTUALLY contain? Build a pivot over A1:H105 that shows every distinct race value " +
        "with its record count. There are not six.",
      hints: [
        "A pivot with race on Rows lists every distinct value the column holds — one row each.",
        "Add a count so you can see how many records carry each spelling.",
        "Rows: race. Values: applicant_id, aggregation Count.",
        "You get 13 rows: 12 spellings (Black/black/BLACK, White/white/WHITE/Caucasian, Asian/asian, and more) plus a (blank) row for 6 empty cells. Any grouping run on this column as-is splits one group across four rows.",
      ],
      target: { kind: "selector", selector: "[data-guide-target='sheet-grid']" },
      spotlightLabel: "Pivot race to list every distinct value",
      checkpoint: checkpoint(
        profileCells({ J2: "=COUNTA(A2:A105)" }),
        { rows: [], cols: [], values: [], filters: {} },
      ),
      // OUTCOME grader: any pivot that produces the distinct-value table
      // passes — counting race instead of applicant_id counts the same rows.
      grader: {
        type: "pivotResult",
        expected: { rows: ["race"], values: [COUNT_VALUE] },
      },
      modes: {
        outcome: {
          instruction:
            "List every distinct value the race column contains, with how many records carry each one.",
          hints: [
            "You need one output row per distinct race value.",
            "A pivot over A1:H105 with race grouping the rows gets you there.",
          ],
        },
      },
    },
    {
      id: "distinct-count",
      title: "Record what the pivot revealed",
      instruction:
        "Read your pivot and record the finding: how many distinct NON-blank spellings does race " +
        "contain? Type the number in J3. One caution before you conclude anything from those " +
        "groups: several of the variant spellings cover only 1 to 4 records each — far too few " +
        "rows to compute a rate from. The variants are a standardization problem, not groups to " +
        "analyze.",
      hints: [
        "Count the rows of your pivot, leaving out the (blank) row.",
        "Black, black and BLACK are three different values to a grouping — count each spelling.",
        "12 spellings, plus the (blank) row you excluded. Type 12 in J3.",
      ],
      target: { kind: "sheet-cell", ref: "J3" },
      spotlightLabel: "Type the distinct spelling count in J3",
      checkpoint: checkpoint(
        profileCells({ J2: "=COUNTA(A2:A105)" }),
        { rows: ["race"], cols: [], values: [COUNT_VALUE], filters: {} },
      ),
      // A typed constant is CORRECT here: the learner is transcribing a
      // finding read off the pivot, not computing something re-runnable.
      grader: { type: "cellValue", ref: "J3", expected: DISTINCT_RACE_SPELLINGS },
      modes: {
        outcome: {
          instruction:
            "How many distinct non-blank spellings does the race column hold? Record the number in J3.",
          hints: [
            "Your distinct-value table already shows them — count its non-blank rows.",
          ],
        },
      },
    },
    {
      id: "text-in-numbers",
      title: "Find the numbers that are not numbers",
      instruction:
        "loan_amount looks numeric, but try summing it and some records silently vanish from the " +
        "total. In J4, compute how many loan_amount cells are stored as TEXT — values like " +
        "\"192,500\" and \"$61,000\" that a SUM skips without any error. A profile that misses " +
        "this ships an understated portfolio total.",
      hints: [
        "Two counting functions disagree about this column — the gap between them is your answer.",
        "COUNT counts only numbers; COUNTA counts everything non-empty.",
        "Subtract the numeric count from the non-empty count over F2:F105.",
        "J4: =COUNTA(F2:F105)-COUNT(F2:F105) — 17 cells are text. The same trick on application_date shows COUNT = 0: every date in this file is text too.",
      ],
      target: { kind: "sheet-cell", ref: "J4" },
      spotlightLabel: "Count text-typed loan_amount cells in J4",
      checkpoint: checkpoint(
        profileCells({ J2: "=COUNTA(A2:A105)", J3: DISTINCT_RACE_SPELLINGS }),
        { rows: ["race"], cols: [], values: [COUNT_VALUE], filters: {} },
      ),
      grader: {
        // METHOD + OUTCOME: the COUNT-vs-COUNTA gap IS the profiling
        // technique this step exists to teach, so the formula must count.
        type: "cellFormula",
        ref: "J4",
        pattern: "COUNT",
        expectedValue: LOAN_TEXT_CELLS,
      },
      modes: {
        outcome: {
          instruction:
            "How many loan_amount values would a SUM over the column silently ignore? Put the count in J4.",
          hints: [
            "A SUM ignores exactly the cells that are not typed as numbers.",
            "Compare how many cells are non-empty with how many are numeric.",
          ],
          grader: { type: "cellValue", ref: "J4", expected: LOAN_TEXT_CELLS },
        },
      },
    },
  ],
});

export default lesson;
