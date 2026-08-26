// Guided lesson: DATEDIF — calculate days, months, or years between two dates.
//
// Scenario: loan applications with submission date and approval date. The lesson
// teaches DATEDIF to calculate processing time in days and years — how long did
// the lender take to review each application?
//
// DATEDIF(start_date, end_date, unit) calculates the difference between two dates.
// Units: "D" for days, "M" for months, "Y" for years, "YD" for days in the year, etc.
//
// The lesson scaffolds dates and teaches DATEDIF in two steps: first to count days
// between submission and approval, then to express the same span in years with
// decimal precision.

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
];

/** Expected days between submission and approval. */
export const DAYS_BETWEEN = [[32], [30], [60], [70], [70]];

/** Expected years (with decimal) between submission and approval. */
export const YEARS_BETWEEN = [
  [32 / 365.25],
  [30 / 365.25],
  [60 / 365.25],
  [70 / 365.25],
  [70 / 365.25],
];

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
const YEARS_COL = APPLICATIONS.map((_, i) => `=DATEDIF(A${i + 2}, B${i + 2}, "Y") + (MOD(B${i + 2} - A${i + 2}, 365.25) / 365.25)`);

function checkpoint(columns) {
  return {
    tool: "sheet",
    active: "Data",
    sheets: [{ name: "Data", cells: tableCells(columns) }],
  };
}

/**
 * Grader: check that a DATEDIF formula in each row calculates the difference
 * between two date columns with the right unit ("D" for days).
 */
function datedifFormula(col, expected, unit) {
  return (toolState) => {
    const sheet = resolveSheet(toolState, "Data");
    const diff = [];
    let ok = 0;

    for (let i = 0; i < expected.length; i++) {
      const ref = `${col}${i + 2}`;
      const cell = getCell(sheet, ref);
      const want = expected[i][0];

      if (!cell || cell.input === "" || cell.input == null) {
        diff.push({
          kind: "missing",
          path: ref,
          expected: want,
          actual: null,
          hint: `${ref} is empty — write a DATEDIF formula.`,
        });
        continue;
      }
      if (!cell.isFormula) {
        diff.push({
          kind: "method",
          path: ref,
          expected: `a DATEDIF formula`,
          actual: String(cell.input),
          hint: `${ref} holds a number instead of a formula. Use DATEDIF to calculate the date difference.`,
        });
        continue;
      }
      const input = String(cell.input).toUpperCase();
      if (!input.includes("DATEDIF(")) {
        diff.push({
          kind: "method",
          path: ref,
          expected: `a DATEDIF formula`,
          actual: String(cell.input),
          hint: `${ref} must use DATEDIF — that is the method this lesson teaches.`,
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
        ? `All ${expected.length} rows calculated with DATEDIF.`
        : `${expected.length - ok} of ${expected.length} rows are not calculated correctly.`,
      diff: diff.slice(0, 5),
    };
  };
}

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
        "A table with submitted and approved dates is loaded into columns A and B. In C2, use DATEDIF " +
        'to calculate the days between: =DATEDIF(A2, B2, "D"). The "D" means days; other units are "M" ' +
        "for months and \"Y\" for years.",
      hints: [
        "DATEDIF takes three arguments: start date, end date, and a unit string.",
        'Start date is A2 (submitted), end date is B2 (approved), unit is "D" for days.',
        'DATEDIF(A2, B2, "D") calculates the number of days the lender took.',
        "First row should show 32 days.",
      ],
      target: { kind: "sheet-cell", ref: "C2" },
      spotlightLabel: "Write DATEDIF in C2 for days between dates",
      checkpoint: checkpoint(),
      grader: {
        type: "cellFormula",
        ref: "C2",
        mustUse: ["DATEDIF"],
        expectedValue: 32,
      },
    },
    {
      id: "fill-days",
      title: "Fill all processing times in days",
      instruction:
        "Fill C2 down through C6 to show processing time in days for all applications. Expected: 32, 30, " +
        "60, 70, 70 days.",
      hints: [
        "Copy C2, then paste it to C3:C6.",
        "The cell references A2/B2 are relative, so they shift on fill-down.",
        "Each row calculates days from that application's submission to approval.",
      ],
      target: { kind: "sheet-cell", ref: "C2" },
      spotlightLabel: "Fill C2's formula down through C6",
      checkpoint: checkpoint({ C: [DAYS_COL[0]] }),
      grader: {
        type: "allOf",
        of: [
          {
            type: "predicate",
            fn: datedifFormula("C", DAYS_BETWEEN, "D"),
            label: "All rows calculated days with DATEDIF",
          },
        ],
      },
    },
    {
      id: "years-with-decimal",
      title: "Express processing time in years",
      instruction:
        "In D2, convert processing time to decimal years. Use DATEDIF to get full years, then add the " +
        'remaining days as a fraction: =DATEDIF(A2, B2, "Y") + (MOD(B2 - A2, 365.25) / 365.25). ' +
        "This shows 32 days as about 0.088 years.",
      hints: [
        'DATEDIF(A2, B2, "Y") calculates complete years between the dates.',
        "MOD(B2 - A2, 365.25) gives the leftover days after complete years.",
        "Divide by 365.25 to express those days as a decimal year.",
        "First row (32 days) = 0 complete years + 32 / 365.25 ≈ 0.0876 years.",
      ],
      target: { kind: "sheet-cell", ref: "D2" },
      spotlightLabel: "Write DATEDIF with decimal years in D2",
      checkpoint: checkpoint({ C: DAYS_COL }),
      grader: {
        type: "cellFormula",
        ref: "D2",
        mustUse: ["DATEDIF"],
        expectedValue: YEARS_BETWEEN[0][0],
      },
    },
    {
      id: "fill-years",
      title: "Fill processing times in years",
      instruction:
        "Fill D2 down through D6. Check D5 (70 days): it should show about 0.192 years — nearly a fifth " +
        "of a year to process the longest applications.",
      hints: [
        "Copy D2, then paste it to D3:D6.",
        "Cell references A2/B2 are relative, so they shift.",
        "D5 (70 days) shows 70 / 365.25 ≈ 0.1917 years.",
      ],
      target: { kind: "sheet-cell", ref: "D2" },
      spotlightLabel: "Fill D2's formula down through D6",
      checkpoint: checkpoint({ C: DAYS_COL, D: [YEARS_COL[0]] }),
      grader: {
        type: "allOf",
        of: [
          {
            type: "predicate",
            fn: datedifFormula("D", YEARS_BETWEEN, "Y"),
            label: "All rows calculated years with DATEDIF",
          },
        ],
      },
    },
  ],
});

export default lesson;
