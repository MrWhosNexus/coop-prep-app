// Guided lesson: COMPLETENESS — missingness is not one thing, and the gaps
// that matter are the ones that block the decision the data exists to serve.
//
// Runs over the dirty HMDA extract (public/data/hmda-raw.csv; answer key in
// data/governance-manifest.json). Missing values in this file arrive in FOUR
// spellings — a truly empty cell, "N/A", "NULL" and "-" — and only the first
// is invisible to COUNTA/ISBLANK. A completeness number computed from blanks
// alone overstates the health of the income column by nearly threefold.
//
// Every expected number was DERIVED by loading the real CSV through lib/sheet
// and evaluating the same formulas the steps ask for (no invented constants):
//   income true blanks   ROWS - COUNTA(G2:G105)                       = 3
//   income all spellings blanks + "N/A"(3) + "NULL"(3) + "-"(2)       = 11
//   race missing         blanks 6 + zero token spellings              = 6
//   application_date missing                                          = 0
//   completeness         race 98/104, income 93/104, date 104/104
//   rows blocked for fair lending = rows with missing race            = 6
//
// Engine honesty note: like real Excel with its own quirks, COUNTIF(range,"")
// does not count truly empty cells here — the reliable blank counter is
// ROWS(...) minus COUNTA(...), which is what the hints teach.
//
// SQL honesty: in a warehouse this is `count(*) filter (where col is null or
// col in ('N/A','NULL','-'))` per column. The concept — enumerate the
// spellings of missing, then measure per column — is what transfers.

import { createLesson } from "../spec.js";

const RAW = "hmda-raw.csv";
const N_ROWS = 104; // data rows 2-105

/** Derived counts (see header). */
export const INCOME_TRUE_BLANKS = 3;
export const INCOME_MISSING_ALL = 11;
export const RACE_MISSING = 6;
export const DATE_MISSING = 0;
/** Derived completeness fractions, exact rationals over 104 rows. */
export const RACE_COMPLETENESS = (N_ROWS - RACE_MISSING) / N_ROWS;
export const INCOME_COMPLETENESS = (N_ROWS - INCOME_MISSING_ALL) / N_ROWS;
export const DATE_COMPLETENESS = 1;
/** Rows that cannot enter a by-race approval analysis at all. */
export const FAIR_LENDING_BLOCKED_ROWS = RACE_MISSING;

// Completeness ledger: J column names, K missing counts, L completeness.
// N2 is scratch for the first (deliberately wrong) blank-only count.
const LEDGER = {
  J1: "column",
  K1: "missing",
  L1: "complete",
  J2: "race",
  J3: "income",
  J4: "application_date",
};

function checkpoint(cells = {}) {
  return {
    tool: "sheet",
    active: "Data",
    sheets: [{
      name: "Data",
      load: [{ resource: RAW, origin: "A1" }],
      cells: { ...LEDGER, ...cells },
    }],
  };
}

// Formulas seeded into later checkpoints as the "work so far".
const BLANKS_F = "=ROWS(G2:G105)-COUNTA(G2:G105)";
const INCOME_MISS_F =
  '=ROWS(G2:G105)-COUNTA(G2:G105)+COUNTIF(G2:G105,"N/A")+COUNTIF(G2:G105,"NULL")+COUNTIF(G2:G105,"-")';
const RACE_MISS_F =
  '=ROWS(C2:C105)-COUNTA(C2:C105)+COUNTIF(C2:C105,"N/A")+COUNTIF(C2:C105,"NULL")+COUNTIF(C2:C105,"-")';
const DATE_MISS_F =
  '=ROWS(B2:B105)-COUNTA(B2:B105)+COUNTIF(B2:B105,"N/A")+COUNTIF(B2:B105,"NULL")+COUNTIF(B2:B105,"-")';

export const lesson = createLesson({
  id: "gov-completeness",
  tool: "sheet",
  moduleId: "aigovernance",
  mode: "guided",
  modes: ["outcome"],
  voice: true,
  title: "Completeness: four spellings of missing",
  description:
    "How much of this extract is actually there? The naive answer counts empty cells and stops. " +
    "This file also writes missing as \"N/A\", \"NULL\" and \"-\" — three values that look like " +
    "data to every blank-detector. You will find all four spellings, compute an honest " +
    "completeness figure per column, and then answer the question governance actually cares " +
    "about: which gaps block the fair-lending analysis, and which are merely untidy.",
  resources: [RAW],
  steps: [
    {
      id: "blanks-only",
      title: "Count what a blank-detector can see",
      instruction:
        "Start with the naive measure: in N2, count how many income cells (G2:G105) are TRULY " +
        "empty — the kind of missing that ISBLANK or COUNTA can detect. Keep this number: the " +
        "next step shows how badly it undercounts.",
      hints: [
        "COUNTA tells you how many cells are non-empty; you know the row count.",
        "Subtracting the non-empty count from the row count leaves the blanks.",
        "ROWS(G2:G105) is a re-runnable way to write the row count.",
        "N2: =ROWS(G2:G105)-COUNTA(G2:G105) — just 3 blanks. The column looks 97% complete. It is not.",
      ],
      target: { kind: "sheet-cell", ref: "N2" },
      spotlightLabel: "Count truly empty income cells in N2",
      checkpoint: checkpoint(),
      grader: {
        // METHOD + OUTCOME: this measure must re-run on the next extract, so
        // a typed 3 fails; any counting route over the column passes.
        type: "cellFormula",
        ref: "N2",
        pattern: "COUNTA|COUNTBLANK",
        expectedValue: INCOME_TRUE_BLANKS,
      },
      modes: {
        outcome: {
          instruction:
            "How many income cells are genuinely empty — the kind a blank-detector can see? Put the count in N2.",
          hints: [
            "Compare the number of non-empty income cells with the number of rows.",
          ],
          grader: { type: "cellValue", ref: "N2", expected: INCOME_TRUE_BLANKS },
        },
      },
    },
    {
      id: "all-spellings",
      title: "Count every spelling of missing",
      instruction:
        "Scroll column G: some cells say \"N/A\", some \"NULL\", some just \"-\". Every one is a " +
        "missing income wearing a costume, and every one defeated your blank count. In K3, count " +
        "income values that are missing in ANY of the four spellings.",
      hints: [
        "Your blank count is one term — add a count for each text spelling of missing.",
        "COUNTIF can count how many cells equal a specific text like \"N/A\".",
        "Blanks + COUNTIF for \"N/A\" + COUNTIF for \"NULL\" + COUNTIF for \"-\".",
        "K3: =ROWS(G2:G105)-COUNTA(G2:G105)+COUNTIF(G2:G105,\"N/A\")+COUNTIF(G2:G105,\"NULL\")+COUNTIF(G2:G105,\"-\") — 11 missing, nearly four times what blanks alone showed.",
      ],
      target: { kind: "sheet-cell", ref: "K3" },
      spotlightLabel: "Count all four spellings of missing in K3",
      checkpoint: checkpoint({ N2: BLANKS_F }),
      grader: {
        type: "cellFormula",
        ref: "K3",
        pattern: "COUNTIF",
        expectedValue: INCOME_MISSING_ALL,
      },
      modes: {
        outcome: {
          instruction:
            "Counting every spelling this file uses for a missing value, how many income values are missing? Put the total in K3.",
          hints: [
            "Empty is only one of the four ways this file writes \"missing\".",
            "Scan column G for the text values that stand in for nothing.",
          ],
          grader: { type: "cellValue", ref: "K3", expected: INCOME_MISSING_ALL },
        },
      },
    },
    {
      id: "other-columns",
      title: "Measure race and application_date the same way",
      instruction:
        "Apply the same complete measure to the other two ledger rows: K2 counts missing race " +
        "values (C2:C105), K4 missing application_date values (B2:B105). Check all four spellings " +
        "in both — knowing a column uses only one of them is a FINDING, not an assumption you get " +
        "to make in advance.",
      hints: [
        "Reuse the K3 shape — swap the column range.",
        "Race turns out to be missing only as true blanks; the count still must have looked for the other three spellings to know that.",
        "K2 over C2:C105, K4 over B2:B105.",
        "K2 returns 6 and K4 returns 0 — application_date is dirty (three formats) but COMPLETE, a distinction the last step turns on.",
      ],
      target: { kind: "sheet-cell", ref: "K2" },
      spotlightLabel: "Fill K2 and K4 with missing counts",
      checkpoint: checkpoint({ N2: BLANKS_F, K3: INCOME_MISS_F }),
      grader: {
        type: "allOf",
        of: [
          { type: "cellFormula", ref: "K2", pattern: "COUNTA|COUNTIF", expectedValue: RACE_MISSING },
          { type: "cellFormula", ref: "K4", pattern: "COUNTA|COUNTIF", expectedValue: DATE_MISSING },
        ],
      },
      modes: {
        outcome: {
          instruction:
            "How many race values are missing (K2), and how many application_date values (K4)? Count every spelling of missing in both.",
          hints: [
            "Same measure as income, pointed at columns C and B.",
          ],
          grader: {
            type: "allOf",
            of: [
              { type: "cellValue", ref: "K2", expected: RACE_MISSING },
              { type: "cellValue", ref: "K4", expected: DATE_MISSING },
            ],
          },
        },
      },
    },
    {
      id: "completeness-pct",
      title: "Turn counts into a completeness figure",
      instruction:
        "Raw missing counts do not travel well in a report — 11 missing means nothing without " +
        "the denominator. In L2, L3 and L4, express each column's completeness as a fraction of " +
        "all rows (a value between 0 and 1), computed from the K counts so the figure updates if " +
        "the counts ever change.",
      hints: [
        "Completeness is the share of rows that are PRESENT: rows minus missing, over rows.",
        "The missing counts are already in K2, K3 and K4 — build on them.",
        "L2: =(ROWS(C2:C105)-K2)/ROWS(C2:C105), and the same shape for L3 and L4.",
        "Race 98/104 = 0.9423, income 93/104 = 0.8942, application_date 104/104 = 1. The blank-only view would have called income 0.97 — that 8-point gap is what the four spellings were hiding.",
      ],
      target: { kind: "sheet-cell", ref: "L2" },
      spotlightLabel: "Compute completeness fractions in L2:L4",
      checkpoint: checkpoint({ N2: BLANKS_F, K2: RACE_MISS_F, K3: INCOME_MISS_F, K4: DATE_MISS_F }),
      grader: {
        type: "allOf",
        of: [
          // L2 must be computed (the derived-not-typed doctrine), and its
          // exact rational value proves the right numerator/denominator; L3
          // and L4 are then value-checked — the method was proven once.
          { type: "cellFormula", ref: "L2", pattern: "K2", expectedValue: RACE_COMPLETENESS, tolerance: 1e-9 },
          { type: "cellValue", ref: "L3", expected: INCOME_COMPLETENESS, tolerance: 1e-9 },
          { type: "cellValue", ref: "L4", expected: DATE_COMPLETENESS, tolerance: 1e-9 },
        ],
      },
      modes: {
        outcome: {
          instruction:
            "What share of each column is actually present? Fill L2:L4 with a 0-to-1 completeness figure per ledger row.",
          hints: [
            "Present rows over all rows — your K column already holds the missing counts.",
          ],
          grader: {
            type: "allOf",
            of: [
              { type: "cellValue", ref: "L2", expected: RACE_COMPLETENESS, tolerance: 1e-9 },
              { type: "cellValue", ref: "L3", expected: INCOME_COMPLETENESS, tolerance: 1e-9 },
              { type: "cellValue", ref: "L4", expected: DATE_COMPLETENESS, tolerance: 1e-9 },
            ],
          },
        },
      },
    },
    {
      id: "blocking-gaps",
      title: "Which gaps block the analysis?",
      instruction:
        "The point of this extract is a fair-lending analysis: approval rates BY RACE. A record " +
        "with no race can never enter that grouping — no cleaning step can conjure the value — " +
        "while a record with a messy-but-present date joins it fine. In N4, put the number of " +
        "rows the analysis loses outright. (Honesty check for your writeup: that is about 6% of " +
        "the file, and if those records skew toward any one group, every rate you publish is " +
        "biased. \"Small\" missingness is only ignorable when it is random.)",
      hints: [
        "Which single column, when missing, makes a row unusable for approval-rate-by-race?",
        "You already counted that column's gaps in the ledger.",
        "N4 is the missing-race count: 6 rows.",
      ],
      target: { kind: "sheet-cell", ref: "N4" },
      spotlightLabel: "Count the blocked rows in N4",
      checkpoint: checkpoint({
        N2: BLANKS_F,
        K2: RACE_MISS_F,
        K3: INCOME_MISS_F,
        K4: DATE_MISS_F,
        L2: "=(ROWS(C2:C105)-K2)/ROWS(C2:C105)",
        L3: "=(ROWS(G2:G105)-K3)/ROWS(G2:G105)",
        L4: "=(ROWS(B2:B105)-K4)/ROWS(B2:B105)",
      }),
      // OUTCOME only: the step tests the REASONING (which gap blocks), and
      // the number can legitimately be typed or referenced from K2.
      grader: { type: "cellValue", ref: "N4", expected: FAIR_LENDING_BLOCKED_ROWS },
      modes: {
        outcome: {
          instruction:
            "How many rows can never enter the approval-rate-by-race analysis, no matter how much cleaning is done? Put the number in N4.",
          hints: [
            "A gap only blocks the analysis when the analysis cannot run without that field.",
            "Messy dates reformat; a missing group label does not regrow.",
          ],
        },
      },
    },
  ],
});

export default lesson;
