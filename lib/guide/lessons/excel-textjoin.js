// Guided lesson: TEXTJOIN — concatenate text with a delimiter, skipping blanks.
//
// Scenario: applicant data with first name, last name, and optional middle
// initial. The lesson builds a "full name" column by joining first + middle +
// last with spaces — but some applicants have no middle initial, so TEXTJOIN's
// blank-skip feature keeps the output clean.
//
// TEXTJOIN(delimiter, skip_empty, text1, [text2, ...]) does three things:
//   1. Joins multiple text values with a delimiter (e.g. space)
//   2. Optionally skips empty/blank cells (second argument: TRUE = skip)
//   3. Returns a single text result
//
// The lesson scaffolds first/middle/last name columns and teaches TEXTJOIN
// in two steps: first without skip_empty (to see how blanks look), then with
// it (to see the clean result).

import { createLesson } from "../spec.js";
import { resolveSheet } from "../graders.js";
import { getCell, getValue } from "../../sheet/model.js";

const SAMPLE = "textjoin-sample.csv";

/** Sample applicant names with some missing middle initials. */
export const APPLICANTS = [
  ["Alice", "M", "Anderson"],
  ["Bob", "", "Brown"],
  ["Carol", "R", "Chen"],
  ["David", "", "Davis"],
  ["Eve", "J", "Evans"],
];

/** Textjoin WITH skip_empty (the intended result). */
export const FULL_NAMES_SKIP = [
  ["Alice M Anderson"],
  ["Bob Brown"],
  ["Carol R Chen"],
  ["David Davis"],
  ["Eve J Evans"],
];

function tableCells(columns = {}) {
  const cells = {
    A1: "first",
    B1: "middle",
    C1: "last",
    D1: "full name",
  };
  APPLICANTS.forEach((row, i) => {
    cells[`A${i + 2}`] = row[0];
    cells[`B${i + 2}`] = row[1];
    cells[`C${i + 2}`] = row[2];
  });
  for (const [col, formulas] of Object.entries(columns)) {
    formulas.forEach((f, i) => {
      cells[`${col}${i + 2}`] = f;
    });
  }
  return cells;
}

const TEXTJOIN_SKIP_COL = APPLICANTS.map((_, i) => `=TEXTJOIN(" ", TRUE, A${i + 2}, B${i + 2}, C${i + 2})`);

function checkpoint(columns) {
  return {
    tool: "sheet",
    active: "Data",
    sheets: [{ name: "Data", cells: tableCells(columns) }],
  };
}

/**
 * Grader: check that a TEXTJOIN formula in each row uses the skip_empty
 * parameter correctly (TRUE) and joins the three name parts with a space.
 */
function textjoinFormula(col, expected, skipEmpty) {
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
          hint: `${ref} is empty — write a TEXTJOIN formula.`,
        });
        continue;
      }
      if (!cell.isFormula) {
        diff.push({
          kind: "method",
          path: ref,
          expected: `a TEXTJOIN formula`,
          actual: String(cell.input),
          hint: `${ref} holds text instead of a formula. Use TEXTJOIN to join the name parts.`,
        });
        continue;
      }
      const input = String(cell.input).toUpperCase();
      if (!input.includes("TEXTJOIN(")) {
        diff.push({
          kind: "method",
          path: ref,
          expected: `a TEXTJOIN formula`,
          actual: String(cell.input),
          hint: `${ref} must use TEXTJOIN — that is the method this lesson teaches.`,
        });
        continue;
      }
      const got = getValue(sheet, ref);
      if (typeof got !== "string" || got !== want) {
        diff.push({
          kind: "value",
          path: ref,
          expected: want,
          actual: got,
          hint: `${ref} shows "${got}", but should be "${want}".`,
        });
        continue;
      }
      ok += 1;
    }

    const skipMsg = skipEmpty ? "with skip_empty = TRUE" : "without skip_empty";
    return {
      pass: ok === expected.length,
      message: ok === expected.length
        ? `All ${expected.length} names joined ${skipMsg}.`
        : `${expected.length - ok} of ${expected.length} names are not joined correctly.`,
      diff: diff.slice(0, 5),
    };
  };
}

export const lesson = createLesson({
  id: "excel-textjoin",
  tool: "sheet",
  moduleId: "excel",
  mode: "guided",
  // Outcome variant: "build clean display names" with the joining function
  // withheld. Graders drop mustUse — the outcome is names computed from the
  // parts with single spaces and nothing extra when a part is missing, and
  // any construction that produces exactly that (including a conditional
  // concatenation) is a pass. caseSensitive because "alice m anderson" is
  // not a display name.
  modes: ["outcome"],
  voice: true,
  title: "TEXTJOIN: concatenate with delimiters and skip blanks",
  description:
    "TEXTJOIN combines text from multiple cells with a delimiter (like a space or comma) and can skip " +
    "empty cells. Build a full-name column from first, middle, and last names — when an applicant has no " +
    "middle initial, the result is clean (no extra spaces).",
  resources: [SAMPLE],
  steps: [
    {
      id: "textjoin-basic",
      title: "Join three names with a space",
      instruction:
        "A table with first, middle, and last names is loaded into columns A:C. Some applicants have no " +
        "middle initial (column B is blank). In D2, use TEXTJOIN to join all three columns with a space " +
        'delimiter: =TEXTJOIN(" ", TRUE, A2, B2, C2). The TRUE tells TEXTJOIN to skip empty cells.',
      hints: [
        'First argument is the delimiter " " (a space); second is skip_empty (TRUE = skip blanks).',
        "Then list text cells to join: A2, B2, C2. TRUE skips B2 if empty.",
        'So "Bob" + "" + "Brown" becomes "Bob Brown" with no extra spaces.',
        '=TEXTJOIN(" ", TRUE, A2, B2, C2) — D2 should show "Alice M Anderson".',
      ],
      target: { kind: "sheet-cell", ref: "D2" },
      spotlightLabel: "Write TEXTJOIN in D2 to join names with space",
      checkpoint: checkpoint(),
      grader: {
        type: "cellFormula",
        ref: "D2",
        mustUse: ["TEXTJOIN"],
        expectedValue: "Alice M Anderson",
      },
      modes: {
        outcome: {
          instruction:
            "Columns A:C hold first names, optional middle initials, and last names. In D2, build the " +
            "first applicant's full display name — the parts separated by single spaces, computed from " +
            "the three cells rather than retyped.",
          hints: [
            "The name has up to three parts with exactly one space between neighbors.",
            "Keep in mind some LATER rows have no middle initial — build D2 so it will survive them.",
          ],
          grader: { type: "cellFormula", ref: "D2", expectedValue: "Alice M Anderson", caseSensitive: true },
        },
      },
    },
    {
      id: "fill-names",
      title: "Fill all full names",
      instruction:
        "Fill D2 down through D6 to build full names for all applicants. Check D3 (Bob) — with no middle " +
        "initial, it should show just 'Bob Brown', not 'Bob  Brown' with extra spaces.",
      hints: [
        "Copy D2, then paste it to D3:D6.",
        "The cell references A2/B2/C2 are relative, so they shift to A3/B3/C3, etc.",
        "D3 (Bob Brown) has no middle initial, so TEXTJOIN skips the empty B3.",
        "D4 (Carol R Chen) shows all three parts.",
      ],
      target: { kind: "sheet-cell", ref: "D2" },
      spotlightLabel: "Fill D2's formula down through D6",
      checkpoint: checkpoint({ D: [TEXTJOIN_SKIP_COL[0]] }),
      grader: {
        type: "allOf",
        of: [
          {
            type: "predicate",
            fn: textjoinFormula("D", FULL_NAMES_SKIP, true),
            label: "All full names joined with TEXTJOIN, skip_empty = TRUE",
          },
        ],
      },
      modes: {
        outcome: {
          // Pure fill-down folded into the previous question: "now every
          // applicant" — the blank-middle rows are where a naive join shows
          // its double space.
          instruction:
            "Now every applicant needs one: fill the display names down D2:D6, computed per row. The " +
            "second applicant has no middle initial — his name must read with ONE space, no doubled " +
            "gap where the initial would be.",
          hints: [
            "Each row builds from its own three cells.",
            "\"Bob Brown\", not \"Bob  Brown\" — the missing part should leave no trace.",
          ],
          // Outcome grader: per-row computed + exact (case-sensitive) names.
          // The base predicate demands the join function by name, which the
          // mode withholds.
          grader: {
            type: "allOf",
            of: FULL_NAMES_SKIP.map(([name], i) => ({
              type: "cellFormula",
              ref: `D${i + 2}`,
              expectedValue: name,
              caseSensitive: true,
            })),
          },
        },
      },
    },
  ],
});

export default lesson;
