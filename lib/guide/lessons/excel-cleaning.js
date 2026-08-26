// Guided lesson: data cleaning — TRIM, UPPER, SUBSTITUTE, VALUE.
//
// The scenario every analyst hits in week one: an export where the category
// text has stray spaces and inconsistent case, and the dollar amounts are
// TEXT like "$171,000" that no SUM will add up. The pipeline is the lesson:
//   text:    TRIM → UPPER            ("  black " → "BLACK")
//   numbers: SUBSTITUTE ×2 → VALUE   ("$171,000" → 171000, a real number)
//
// Self-contained checkpoint (no CSV): a two-row messy import block.
//
// Grading doctrine: cellFormula (METHOD) with expectedValue on every step —
// the functions are the lesson, so pasting the clean text by hand fails. The
// UPPER step compares case-SENSITIVELY (the default comparison would accept
// "black" for "BLACK" and grade the step before the user did it), and the
// VALUE step expects the NUMBER 171000, which a text result can't match.

import { createLesson } from "../spec.js";

/** The messy import block. */
const MESSY = {
  I1: "raw_race",
  J1: "raw_amount",
  K1: "clean_race",
  L1: "amount_text",
  M1: "amount",
  I2: "  black ",
  J2: "$171,000",
};

const TRIMMED = "=TRIM(I2)";
const UPPERED = "=UPPER(TRIM(I2))";
const STRIPPED = '=SUBSTITUTE(SUBSTITUTE(J2, "$", ""), ",", "")';

function checkpoint(extra = {}) {
  return {
    tool: "sheet",
    active: "Import",
    sheets: [{ name: "Import", cells: { ...MESSY, ...extra } }],
  };
}

export const lesson = createLesson({
  id: "excel-cleaning",
  tool: "sheet",
  moduleId: "excel",
  mode: "guided",
  voice: true,
  title: "Data cleaning: TRIM, UPPER, SUBSTITUTE, VALUE",
  description:
    "A raw export never pivots cleanly: \"  black \" and \"Black\" land in different buckets, and " +
    "\"$171,000\" is text no formula can add. Four functions fix all of it — and chaining them is the " +
    "skill: each function's output is the next one's input.",
  steps: [
    {
      id: "trim-spaces",
      title: "TRIM: kill the stray spaces",
      instruction:
        "I2 holds a race label with spaces on both ends: \"  black \". In K2, clean the whitespace " +
        "with =TRIM(I2). Spaces are invisible in a cell but real to a pivot — \"  black \" and " +
        "\"black\" would count as two different groups.",
      hints: [
        "TRIM takes one argument and removes leading and trailing spaces.",
        "Point it at the messy cell: I2.",
        "The result LOOKS the same in the grid — the difference is at the ends of the string.",
        "=TRIM(I2) — K2 now holds exactly \"black\", no padding.",
      ],
      target: { kind: "sheet-cell", ref: "K2" },
      spotlightLabel: "Trim I2's spaces into K2",
      checkpoint: checkpoint(),
      grader: { type: "cellFormula", ref: "K2", mustUse: ["TRIM"], expectedValue: "black" },
    },
    {
      id: "upper-case",
      title: "UPPER: one case for everyone",
      instruction:
        "Different rows of a real export mix \"black\", \"Black\" and \"BLACK\". Standardize by " +
        "wrapping your TRIM in UPPER: =UPPER(TRIM(I2)) in K2. Nesting order doesn't matter here, but " +
        "the habit does — clean in one cell, not five.",
      hints: [
        "UPPER converts text to all capitals; it takes one argument.",
        "Don't start over — wrap the formula you already have.",
        "UPPER(TRIM(...)) and TRIM(UPPER(...)) both work; pick one and be consistent.",
        "=UPPER(TRIM(I2)) — K2 reads BLACK.",
      ],
      target: { kind: "sheet-cell", ref: "K2" },
      spotlightLabel: "Wrap K2's TRIM in UPPER",
      checkpoint: checkpoint({ K2: TRIMMED }),
      grader: {
        type: "cellFormula",
        ref: "K2",
        mustUse: ["UPPER", "TRIM"],
        expectedValue: "BLACK",
        caseSensitive: true,
      },
    },
    {
      id: "substitute-symbols",
      title: "SUBSTITUTE: strip the $ and the comma",
      instruction:
        "J2 holds \"$171,000\" — text, not a number. In L2, strip both symbols by nesting two " +
        'SUBSTITUTEs: =SUBSTITUTE(SUBSTITUTE(J2, "$", ""), ",", ""). The result is "171000" — still ' +
        "text, but ready to convert.",
      hints: [
        "SUBSTITUTE(text, old, new) replaces every occurrence of old. Replace with \"\" to delete.",
        "One SUBSTITUTE removes one symbol — you need one for \"$\" and one for \",\".",
        "Nest them: the inner call's output is the outer call's input.",
        '=SUBSTITUTE(SUBSTITUTE(J2, "$", ""), ",", "") — L2 shows 171000 (as text).',
      ],
      target: { kind: "sheet-cell", ref: "L2" },
      spotlightLabel: "Strip the dollar sign and comma in L2",
      checkpoint: checkpoint({ K2: UPPERED }),
      grader: { type: "cellFormula", ref: "L2", mustUse: ["SUBSTITUTE"], expectedValue: "171000" },
    },
    {
      id: "value-convert",
      title: "VALUE: make it a real number",
      instruction:
        "\"171000\" still won't SUM — it's text wearing a number costume. In M2, convert it: " +
        "=VALUE(L2). Now it's the NUMBER 171000, and every arithmetic function on the sheet can " +
        "use it.",
      hints: [
        "VALUE parses a text string into a number; it fails (#VALUE!) if symbols are still inside.",
        "Point it at your cleaned text in L2 — not at the raw J2.",
        "If you get #VALUE!, the $ or comma survived — check L2 first.",
        "=VALUE(L2) — M2 holds the number 171000. =M2*2 would give 342000; =J2*2 never could.",
      ],
      target: { kind: "sheet-cell", ref: "M2" },
      spotlightLabel: "Convert L2's cleaned text to a number in M2",
      checkpoint: checkpoint({ K2: UPPERED, L2: STRIPPED }),
      grader: { type: "cellFormula", ref: "M2", mustUse: ["VALUE"], expectedValue: 171000 },
    },
  ],
});

export default lesson;
