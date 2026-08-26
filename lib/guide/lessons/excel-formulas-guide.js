// Instruction-mode lesson: Excel formula syntax and building blocks.
//
// This is a conceptual walkthrough (mode: "instructions") that teaches the
// structure of Excel formulas without a live spreadsheet: how functions are
// called, how arguments nest, and why reference types matter.
//
// Each step still has a valid checkpoint, grader, and assessment, but no
// spotlight target — the lesson content is framed text and conceptual
// checks, not interactive tool-driven steps.

import { createLesson } from "../spec.js";

function instructionCheckpoint(extra = {}) {
  return {
    tool: "sheet",
    active: "Concepts",
    sheets: [{ name: "Concepts", cells: extra }],
  };
}

export const lesson = createLesson({
  id: "excel-formulas-guide",
  tool: "sheet",
  moduleId: "excel",
  mode: "instructions",
  // Outcome variant: the same concepts posed as questions to answer from
  // memory instead of prose that answers them. The worked examples (and the
  // function names they contain) are withheld — a returning learner should be
  // able to reconstruct the anatomy, nesting, and reference rules unaided.
  // Graders stay the base pass-through predicates: this is an instructions-
  // mode lesson with no tool state to judge in either mode.
  modes: ["outcome"],
  voice: false,
  title: "Excel formulas: syntax, structure, and how functions fit together",
  description:
    "Formulas in Excel are expressions that begin with = and call functions by name. You'll learn how " +
    "functions nest inside each other, how arguments separate by commas, and why the type of reference " +
    "you choose (A1, $A$1, A$1, $A1) changes how a formula behaves when copied. These concepts are the " +
    "foundation of every lesson and every spreadsheet you'll build.",
  steps: [
    {
      id: "formula-anatomy",
      title: "The anatomy of a formula",
      instruction:
        "Every formula starts with =. Then comes a function name in capitals, followed by parentheses. Inside " +
        "the parentheses, you list the arguments — the inputs the function needs — separated by commas. " +
        "Example: =SUM(A1:A10) sums the range A1 through A10. =COUNTIF(B2:B100, \"YES\") counts cells in " +
        "B2:B100 that contain the text \"YES\". Notice the text is in quotes; numbers and ranges are not. " +
        "Forgetting quotes around text is a common mistake, and it breaks the formula.",
      hints: [
        "Formulas always start with =. Without it, Excel treats your entry as text or a number.",
        "Function names are always uppercase in documentation, though Excel accepts lowercase.",
        "Arguments go inside parentheses and separate by commas. No spaces needed, but they're okay.",
        "Text arguments must be wrapped in quotes. Cell references and ranges do not.",
      ],
      checkpoint: instructionCheckpoint({ A1: "Formula", B1: "Purpose", A2: "=SUM(A:A)", B2: "Total of column A" }),
      grader: {
        type: "predicate",
        fn: (toolState) => {
          return {
            pass: true,
            message: "You understand formula structure: = sign, function name, parentheses, comma-separated arguments, quoted text.",
          };
        },
      },
      modes: {
        outcome: {
          instruction:
            "From memory: what marks a cell entry as a calculation rather than plain text? Walk through " +
            "the pieces every calculation entry is built from — how the operation is named, where its " +
            "inputs go, how the inputs are separated, and which kinds of input need quotes around them " +
            "and which never do.",
          hints: [
            "There are four pieces: a leading marker, a name, an enclosure for inputs, and a separator between them.",
            "Think about what distinguishes a piece of text from a cell reference among the inputs.",
          ],
        },
      },
    },
    {
      id: "nested-functions",
      title: "Nesting functions: solving complex problems in one formula",
      instruction:
        "You can call a function inside another function's arguments. Example: =UPPER(TRIM(A1)) takes A1, " +
        "trims whitespace from both ends, then converts to uppercase. The innermost function (TRIM) runs " +
        "first, and its result feeds into UPPER. This nesting lets you solve multi-step problems in a " +
        "single cell. Another example: =IF(COUNTIF(C2:C20, \"Red\") > 5, \"Too many reds\", \"OK\") counts " +
        "the reds and makes a decision based on the count. Nesting gets deep fast — deeply nested formulas " +
        "are harder to debug. Prefer clarity: if a formula gets too tangled, split it across two cells.",
      hints: [
        "Inner functions run first. Their result becomes the argument to the outer function.",
        "Parentheses must balance. Count opening ( and closing ) — they should match.",
        "Deeply nested formulas are clever but hard to read. A helper column can make the logic clearer.",
        "Example nesting: =LEN(SUBSTITUTE(A1, \" \", \"\")) counts non-space characters by removing spaces and measuring length.",
      ],
      checkpoint: instructionCheckpoint({ A1: "Text", B1: "Formula", A2: "  hello  ", B2: "=UPPER(TRIM(A2))" }),
      grader: {
        type: "predicate",
        fn: (toolState) => {
          return {
            pass: true,
            message: "Nesting lets you chain operations: inner functions run first, then pass their results outward.",
          };
        },
      },
      modes: {
        outcome: {
          instruction:
            "A single cell can clean a messy label AND standardize its capitalization in one entry. How? " +
            "Explain the mechanism that lets one operation feed another, which of the two runs first, " +
            "and when you would deliberately split such a chain across two cells instead.",
          hints: [
            "One operation's output can sit exactly where another expects an input.",
            "Evaluation works from the inside out — and readability is the reason to stop chaining.",
          ],
        },
      },
    },
    {
      id: "reference-types",
      title: "Reference types: relative, absolute, and mixed",
      instruction:
        "When a formula refers to a cell, you can use A1 (relative), $A$1 (absolute), $A1 (mixed), or A$1 " +
        "(mixed). Relative references (A1) change when you copy the formula: =A2+B2 copied one row down becomes " +
        "=A3+B3. Absolute references ($A$1) do NOT change — =SUM($A$1:$C$1) stays the same no matter where " +
        "you copy it. Mixed references lock one dimension: $A1 locks the column but lets the row slide, and " +
        "A$1 locks the row but lets the column slide. You choose based on what should move and what should stay " +
        "put. If you are computing a per-group rate as (approvals for this group) ÷ (total approvals), the " +
        "numerator should be relative (each row reads its own group) and the denominator should be absolute " +
        "(all rows divide by the same total).",
      hints: [
        "Relative: A1, B2 — changes when copied.",
        "Absolute: $A$1, $B$2 — locked in place, never changes.",
        "Mixed: $A1 (column locked, row free), A$1 (row locked, column free).",
        "Test your choice: mentally copy the formula to a new cell and ask: which parts should stay put?",
      ],
      checkpoint: instructionCheckpoint({
        A1: "Total",
        A2: "100",
        B1: "Part",
        B2: "25",
        C1: "Rate",
        C2: "=B2/$A$2",
      }),
      grader: {
        type: "predicate",
        fn: (toolState) => {
          return {
            pass: true,
            message:
              "You understand reference types: relatives change on copy, absolute stay locked, mixed lock one " +
              "dimension. Choose based on the logic: what should stay put?",
          };
        },
      },
      modes: {
        outcome: {
          instruction:
            "You are computing a per-group rate — each row's own count divided by one shared total — " +
            "and you want to write the formula once and copy it down the whole column. Which of the two " +
            "references must change as the formula moves, which must not, and what notation controls " +
            "each of those behaviors (including locking just one of row or column)?",
          hints: [
            "By default a reference is an offset from the formula's own cell — it travels with a copy.",
            "A dollar sign pins whichever dimension it sits in front of.",
          ],
        },
      },
    },
    {
      id: "function-categories",
      title: "The function families you will use",
      instruction:
        "Excel's functions fall into a few groups you will use repeatedly. Aggregation (SUM, AVERAGE, COUNT) " +
        "rolls many numbers into one. Counting (COUNTIF, COUNTIFS, COUNTA) tallies records matching criteria " +
        "— the foundation of reporting. Lookup (XLOOKUP, INDEX/MATCH) pulls data from one table into another. " +
        "Text (UPPER, LOWER, TRIM, LEN, SUBSTITUTE) cleans and measures text. Conditional (IF, SWITCH) makes " +
        "a formula branch based on a test. You won't memorize all of Excel's functions — nobody does. You'll " +
        "memorize these families and reach for them by their job. When you need to \"count the red ones,\" you " +
        "think COUNTIF. When you need to \"look up a ZIP's region,\" you think XLOOKUP. Knowing which family " +
        "to reach for is 80% of the skill.",
      hints: [
        "Aggregation: SUM, AVERAGE, COUNT, MIN, MAX — combine many numbers into one.",
        "Counting: COUNTIF, COUNTIFS, COUNTA, SUMIF — filter and tally.",
        "Lookup: XLOOKUP, INDEX/MATCH, VLOOKUP — join two tables.",
        "Text: TRIM, UPPER, LOWER, LEN, SUBSTITUTE, LEFT, RIGHT — clean and measure.",
      ],
      checkpoint: instructionCheckpoint({ A1: "Function", B1: "Job", A2: "SUM", B2: "Add numbers up" }),
      grader: {
        type: "predicate",
        fn: (toolState) => {
          return {
            pass: true,
            message:
              "You know the function families: aggregation, counting, lookup, text, conditional. Each family " +
              "solves a type of problem. Knowing the family is enough to reach for the right tool.",
          };
        },
      },
      modes: {
        outcome: {
          instruction:
            "Nobody memorizes every function — analysts memorize FAMILIES and reach by job. Name the " +
            "five families you would reach for, and which family answers each of these: \"total this " +
            "column\", \"tally the rows matching a condition\", \"pull a matching value from another " +
            "table\", \"clean up this label\", and \"branch on a test\".",
          hints: [
            "Rolling many numbers into one, filtered tallies, joining tables, reshaping text, branching.",
            "The five jobs in the question map one-to-one onto the five families.",
          ],
        },
      },
    },
  ],
});

export default lesson;
