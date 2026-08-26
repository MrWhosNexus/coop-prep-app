// Guided lesson: DATEDIF — calculate days, months, or years between two dates.
//
// Scenario: loan applications with submission date and approval date. The lesson
// teaches DATEDIF to calculate processing time in days and years — how long did
// the lender take to review each application?
//
// DATEDIF(start_date, end_date, unit) calculates the difference between two dates.
// Units: "D" for days, "M" for months, "Y" for years, "YD" for days in the year, etc.
//
// The lesson scaffolds dates and works in two steps: first count days between
// submission and approval (DATEDIF's "D" unit, or the equivalent =B2-A2 —
// DATEDIF is legacy syntax, undocumented in real Excel, so plain subtraction
// is accepted too), then express the same span in decimal years as days/365.25.
//
// WHY the years formula is plain division: an earlier version taught
// =DATEDIF(A2,B2,"Y") + (MOD(B2-A2,365.25)/365.25), which double-counts —
// it adds CALENDAR whole years to a remainder computed against 365.25, two
// incompatible year definitions. Driving this project's own engine across a
// spread of start dates showed 17% of spans wrong by a FULL year (an exact
// 12-month span reported 1.999 years). It survived because every seeded span
// was 30-70 days, below where the two definitions diverge — hence the final
// 730-day row below, which exists so a grader regression there goes red.

import { createLesson } from "../spec.js";
import { resolveSheet } from "../graders.js";
import { getCell, getValue } from "../../sheet/model.js";

const DATES_SAMPLE = "dates-sample.csv";

/**
 * Sample applications with submission and approval dates.
 * Dates are serial numbers (Excel's internal date format).
 * Example: serial 45000 ≈ 2023-02-08, serial 45030 ≈ 2023-03-10 (32 days later)
 */
export const APPLICATIONS = [
  [45000, 45032], // 32 days
  [45010, 45040], // 30 days
  [45020, 45080], // 60 days
  [45030, 45100], // 70 days
  [45040, 45110], // 70 days
  // A span LONGER than one year — and one where the broken DATEDIF("Y")+MOD
  // hybrid this lesson once taught actually diverges from days/365.25 (by a
  // FULL year: 2.9986 vs 1.9986, verified against this engine — two calendar
  // anniversaries pass, but MOD only strips one 365.25). Every 30-70 day
  // span makes both formulas agree, which is how the bug shipped.
  [45450, 46180], // 730 days ≈ 2.00 years
];

/** Expected days between submission and approval. */
export const DAYS_BETWEEN = [[32], [30], [60], [70], [70], [730]];

/** Expected years (with decimal): days / 365.25, nothing else. */
export const YEARS_BETWEEN = DAYS_BETWEEN.map(([d]) => [d / 365.25]);

function tableCells(columns = {}) {
  const cells = {
    A1: "submitted",
    B1: "approved",
    C1: "days to approve",
    D1: "years to approve",
  };
  APPLICATIONS.forEach((row, i) => {
    cells[`A${i + 2}`] = row[0];
    cells[`B${i + 2}`] = row[1];
  });
  for (const [col, formulas] of Object.entries(columns)) {
    formulas.forEach((f, i) => {
      cells[`${col}${i + 2}`] = f;
    });
  }
  return cells;
}

const DAYS_COL = APPLICATIONS.map((_, i) => `=DATEDIF(A${i + 2}, B${i + 2}, "D")`);
const YEARS_COL = APPLICATIONS.map((_, i) => `=(B${i + 2}-A${i + 2})/365.25`);

function checkpoint(columns) {
  return {
    tool: "sheet",
    active: "Data",
    sheets: [{ name: "Data", cells: tableCells(columns) }],
  };
}

/**
 * Per-row METHOD + OUTCOME grader for a filled column.
 *
 * WHY a shared row-checker with a pluggable method test: the days column
 * accepts DATEDIF *or* plain subtraction (=B2-A2 is what a working analyst
 * writes; DATEDIF's "D" unit is strictly worse legacy syntax), while the
 * years column must divide by 365.25 — a single mustUse list can't say
 * either of those.
 *
 * @param {string} col column letter
 * @param {Array<[number]>} expected verified values, one inner array per row
 * @param {(input: string, row: number) => boolean} methodOk raw input test
 * @param {string} what human name of the method, for failure messages
 * @returns {(toolState: object) => object} a predicate grader fn
 */
function filledColumn(col, expected, methodOk, what) {
  return (toolState) => {
    const sheet = resolveSheet(toolState, "Data");
    const diff = [];
    let ok = 0;

    for (let i = 0; i < expected.length; i++) {
      const ref = `${col}${i + 2}`;
      const row = i + 2;
      const cell = getCell(sheet, ref);
      const want = expected[i][0];

      if (!cell || cell.input === "" || cell.input == null) {
        diff.push({
          kind: "missing",
          path: ref,
          expected: want,
          actual: null,
          hint: `${ref} is empty — fill ${col}2's formula down through ${col}${expected.length + 1}.`,
        });
        continue;
      }
      if (!cell.isFormula) {
        diff.push({
          kind: "method",
          path: ref,
          expected: what,
          actual: String(cell.input),
          hint: `${ref} holds a typed value instead of a formula. Every row must compute its own span.`,
        });
        continue;
      }
      const input = String(cell.input).toUpperCase();
      if (!methodOk(input, row)) {
        diff.push({
          kind: "method",
          path: ref,
          expected: what,
          actual: String(cell.input),
          hint: `${ref} must use ${what}.`,
        });
        continue;
      }
      const got = getValue(sheet, ref);
      if (typeof got !== "number" || Math.abs(got - want) > 1e-6) {
        diff.push({
          kind: "value",
          path: ref,
          expected: want,
          actual: got,
          hint: `${ref} shows ${got}, but should be approximately ${want}.`,
        });
        continue;
      }
      ok += 1;
    }

    return {
      pass: ok === expected.length,
      message: ok === expected.length
        ? `All ${expected.length} rows calculated correctly.`
        : `${expected.length - ok} of ${expected.length} rows are not calculated correctly.`,
      diff: diff.slice(0, 5),
    };
  };
}

/** Row formula counts days: DATEDIF, or a subtraction of the row's own dates. */
const daysMethod = (input, row) =>
  input.includes("DATEDIF(") ||
  new RegExp(`\\$?B\\$?${row}\\s*-\\s*\\$?A\\$?${row}`).test(input);

/**
 * Row formula converts to years by dividing the span by 365.25. Requiring the
 * divisor (not just a right answer) keeps the broken DATEDIF("Y")+MOD hybrid
 * out even on rows where it happens to agree.
 */
const yearsMethod = (input, row) =>
  input.includes("365.25") &&
  !input.includes('"Y"') &&
  new RegExp(`\\$?B\\$?${row}\\s*-\\s*\\$?A\\$?${row}`).test(input);

export const lesson = createLesson({
  id: "excel-dates",
  tool: "sheet",
  moduleId: "excel",
  mode: "guided",
  voice: true,
  title: "DATEDIF: calculate time between dates",
  description:
    "DATEDIF calculates the difference between two dates in days, months, or years. Measure how long " +
    "the lender took to approve each application — from submission to approval — in both days and " +
    "decimal years.",
  resources: [DATES_SAMPLE],
  steps: [
    {
      id: "days-between",
      title: "Count days between submission and approval",
      instruction:
        "A table with submitted and approved dates is loaded into columns A and B. In C2, calculate the " +
        'days between them: =DATEDIF(A2, B2, "D"), or simply =B2-A2 — dates are day numbers, so plain ' +
        "subtraction gives the same answer. DATEDIF is legacy syntax (undocumented in real Excel); " +
        "know it because you'll see it in old workbooks, but =B2-A2 is equivalent for days.",
      hints: [
        "Dates are serial day numbers, so approved minus submitted is already a day count.",
        'DATEDIF takes start date, end date, and a unit string: "D" for days.',
        '=DATEDIF(A2, B2, "D") and =B2-A2 both work — either is accepted.',
        "First row should show 32 days.",
      ],
      target: { kind: "sheet-cell", ref: "C2" },
      spotlightLabel: "Write DATEDIF in C2 for days between dates",
      checkpoint: checkpoint(),
      grader: {
        // Either method passes. mustUse DATEDIF alone failed learners who
        // wrote the (better) =B2-A2 with the right value — punishing the
        // answer a competent analyst gives.
        type: "anyOf",
        of: [
          { type: "cellFormula", ref: "C2", mustUse: ["DATEDIF"], expectedValue: 32 },
          { type: "cellFormula", ref: "C2", pattern: "\\$?B\\$?2\\s*-\\s*\\$?A\\$?2", expectedValue: 32 },
        ],
      },
    },
    {
      id: "fill-days",
      title: "Fill all processing times in days",
      instruction:
        "Fill C2 down through C7 to show processing time in days for all applications. Expected: 32, 30, " +
        "60, 70, 70, 730 days — the last application sat for two full years.",
      hints: [
        "Copy C2, then paste it to C3:C7.",
        "The cell references A2/B2 are relative, so they shift on fill-down.",
        "Each row calculates days from that application's submission to approval.",
      ],
      target: { kind: "sheet-cell", ref: "C2" },
      spotlightLabel: "Fill C2's formula down through C7",
      checkpoint: checkpoint({ C: [DAYS_COL[0]] }),
      grader: {
        type: "allOf",
        of: [
          {
            type: "predicate",
            fn: filledColumn("C", DAYS_BETWEEN, daysMethod, "DATEDIF or a date subtraction"),
            label: "All rows calculated days by formula, not typed",
          },
        ],
      },
    },
    {
      id: "years-with-decimal",
      title: "Express processing time in years",
      instruction:
        "In D2, convert processing time to decimal years: =(B2-A2)/365.25 — the day count divided by " +
        "the average length of a year. This shows 32 days as about 0.088 years. (Resist mixing " +
        'DATEDIF\'s "Y" unit into this: adding calendar whole years to a 365.25-based remainder ' +
        "double-counts and can be off by a full year.)",
      hints: [
        "B2-A2 is the span in days; a year averages 365.25 days.",
        "Divide the span by 365.25 to express it as a decimal year.",
        "=(B2-A2)/365.25 — one subtraction, one division.",
        "First row (32 days) = 32 / 365.25 ≈ 0.0876 years.",
      ],
      target: { kind: "sheet-cell", ref: "D2" },
      spotlightLabel: "Write the decimal-years division in D2",
      checkpoint: checkpoint({ C: DAYS_COL }),
      grader: {
        type: "cellFormula",
        ref: "D2",
        pattern: "\\(\\s*\\$?B\\$?2\\s*-\\s*\\$?A\\$?2\\s*\\)\\s*/\\s*365\\.25",
        mustNotUse: ["DATEDIF"],
        expectedValue: YEARS_BETWEEN[0][0],
      },
    },
    {
      id: "fill-years",
      title: "Fill processing times in years",
      instruction:
        "Fill D2 down through D7. Check D7 (730 days): it should show about 2.00 years — the one " +
        "application that took years, not weeks, to process.",
      hints: [
        "Copy D2, then paste it to D3:D7.",
        "Cell references A2/B2 are relative, so they shift.",
        "D7 (730 days) shows 730 / 365.25 ≈ 1.9986 years.",
      ],
      target: { kind: "sheet-cell", ref: "D2" },
      spotlightLabel: "Fill D2's formula down through D7",
      checkpoint: checkpoint({ C: DAYS_COL, D: [YEARS_COL[0]] }),
      grader: {
        type: "allOf",
        of: [
          {
            type: "predicate",
            fn: filledColumn("D", YEARS_BETWEEN, yearsMethod, "the span divided by 365.25"),
            label: "All rows calculated years as days/365.25, not typed",
          },
        ],
      },
    },
  ],
});

export default lesson;
