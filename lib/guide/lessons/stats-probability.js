// Guided lesson: probability basics — curriculum lesson stats-3's core ideas
// ("a probability is a number between 0 and 1"; "P(approved | group) is where
// disparate impact lives") made concrete in the sheet: encode the decision as
// a 0/1 flag, and every probability becomes an average of that flag.
//
// Ground truth (computed with the engine over public/data/hmda-sample.csv):
//   P(approved)                 = AVERAGE(flag)              = 0.76
//   P(approved | income ≥ 90k)  = AVERAGEIFS, 16 applicants  = 0.8125
//   P(approved | income < 90k)  = AVERAGEIFS, 84 applicants  = 0.75
//   P(approved | Hispanic)      = AVERAGEIF,  12/18          = 0.6666666666666666
//   P(approved | Asian)         = AVERAGEIF,   8/10          = 0.8
//
// The teaching arc is the numbers themselves: conditioning on a legitimate
// feature (income) moves the probability a little (0.75 → 0.8125);
// conditioning on race moves it far more — that asymmetry IS the bias signal.
//
// Grading doctrine: the flag fill-down grades METHOD + OUTCOME on every row
// with a predicate (the excel-index-match pattern) — the expected flag is
// derived from the sheet's own G column, so typed 0/1 constants, a lone IF in
// H2, or a swapped IF(...) all fail with the offending cells named. The
// probability cells are cellFormula: AVERAGE/AVERAGEIF(S) over the flag is
// the method, and each must also compute the verified number.

import { createLesson } from "../spec.js";
import { resolveSheet } from "../graders.js";
import { getCell, getValue, isError } from "../../sheet/model.js";

const HMDA = "hmda-sample.csv";

/** Verified probabilities over the extract (race in B, income in F, decision in G, flag in H). */
export const PROBABILITIES = {
  approved: 0.76,
  highIncome: 0.8125,
  lowIncome: 0.75,
  hispanic: 0.6666666666666666,
  asian: 0.8,
};

const LABELS = {
  H1: "is_approved",
  I2: "P(approved)",
  I3: "P(approved | income >= 90k)",
  I4: "P(approved | income < 90k)",
  I5: "P(approved | Hispanic)",
  I6: "P(approved | Asian)",
};

/** The completed 0/1 flag column, H2:H101, as seeded by later checkpoints. */
function flagCells() {
  const cells = {};
  for (let r = 2; r <= 101; r++) cells[`H${r}`] = `=IF(G${r}="APPROVED", 1, 0)`;
  return cells;
}

function checkpoint(extra = {}) {
  return {
    tool: "sheet",
    active: "Data",
    sheets: [{ name: "Data", load: [{ resource: HMDA, origin: "A1" }], cells: { ...LABELS, ...extra } }],
  };
}

const FLAGS = flagCells();
const OVERALL = "=AVERAGE(H2:H101)";
const INCOME_CONDITIONALS = {
  J3: '=AVERAGEIFS($H$2:$H$101, $F$2:$F$101, ">=90000")',
  J4: '=AVERAGEIFS($H$2:$H$101, $F$2:$F$101, "<90000")',
};

const uses = (input, name) => new RegExp(`(^|[^A-Z0-9_.])${name}\\s*\\(`, "i").test(input);

/**
 * METHOD + OUTCOME grader for the flag fill-down, over EVERY row it claims to
 * cover (spec.js doctrine): each cell in H2:H101 must be an IF formula whose
 * value matches the 0/1 flag the row's own G decision demands — so typed
 * constants, blank rows, or a swapped IF all fail with the first offending
 * cells named.
 * @param {object} toolState the sheet workbook being graded
 * @returns {object} a partial GradeResult
 */
function flagFillCheck(toolState) {
  const sheet = resolveSheet(toolState, "Data");

  let ok = 0;
  const diff = [];
  const report = (entry) => {
    if (diff.length < 5) diff.push(entry);
  };

  for (let i = 0; i < 100; i++) {
    const ref = `H${i + 2}`;
    const decision = getValue(sheet, `G${i + 2}`);
    const expected = decision === "APPROVED" ? 1 : 0;
    const cell = getCell(sheet, ref);

    if (!cell || cell.input === "" || cell.input == null) {
      report({ kind: "missing", path: ref, expected, actual: null, hint: `${ref} is empty — fill H2's formula down through H101.` });
      continue;
    }
    const input = String(cell.input);
    if (!cell.isFormula) {
      report({ kind: "method", path: ref, expected: "an IF formula", actual: input, hint: `${ref} holds a typed value — every row must compute its flag with IF, so the column updates when a decision does.` });
      continue;
    }
    if (!uses(input, "IF")) {
      report({ kind: "method", path: ref, expected: "an IF formula", actual: input, hint: `${ref} must use IF — that's the encoding this step teaches.` });
      continue;
    }
    const value = cell.value;
    if (value === expected) {
      ok++;
      continue;
    }
    const shown = isError(value) ? value.code : JSON.stringify(value ?? null);
    report({ kind: "wrong", path: ref, expected, actual: value, hint: `${ref}'s row is ${decision}, so the flag should be ${expected} — the cell shows ${shown}.` });
  }

  const pass = ok === 100;
  return {
    pass,
    score: ok / 100,
    message: pass
      ? "All 100 decisions encoded as 0/1 flags with IF."
      : `${100 - ok} of 100 rows in column H aren't right yet — ${diff[0].hint}`,
    diff,
    expected: "H2:H101 flagged 1/0 with IF from each row's decision",
    actual: `${ok}/100 rows correct`,
  };
}

export const lesson = createLesson({
  id: "stats-probability",
  tool: "sheet",
  moduleId: "stats",
  title: "Probability in the sheet: the mean of a 0/1 flag",
  description:
    "A probability is a number between 0 and 1 — and the fastest way to compute one from data is to " +
    "encode the outcome as a 0/1 flag and take its mean. You'll flag all 100 decisions, read off " +
    "P(approved), then condition it: first on income, where the probability barely moves, then on " +
    "race, where it moves a lot. That asymmetry is what a bias test is looking for.",
  resources: [HMDA],
  steps: [
    {
      id: "flag-column",
      title: "Encode the outcome as 0/1",
      instruction:
        'Column H is headed is_approved. In H2, encode the decision: =IF(G2="APPROVED", 1, 0), then ' +
        "fill it down through H101. Approved rows show 1, denied rows 0 — from here on, every " +
        "probability in this lesson is just an average of this column.",
      hints: [
        "Probability math wants numbers, not words — turn APPROVED/DENIED into 1/0 first.",
        'IF takes three arguments: the test (G2="APPROVED"), the value when true (1), when false (0).',
        "G2 stays relative so the fill-down walks the decision column row by row.",
        '=IF(G2="APPROVED", 1, 0) in H2, filled to H101 — H2 shows 1, H3 shows 0.',
      ],
      checkpoint: checkpoint(),
      grader: {
        type: "allOf",
        of: [
          { type: "cellFormula", ref: "H2", mustUse: ["IF"], expectedValue: 1 },
          { type: "predicate", fn: flagFillCheck, label: "Column H flagged 0/1 with IF for all 100 rows" },
        ],
      },
    },
    {
      id: "overall-probability",
      title: "P(approved) is the flag's mean",
      instruction:
        "In J2, average the flags: =AVERAGE(H2:H101). You get 0.76 — the mean of a 0/1 column IS the " +
        "probability of a 1, because summing the flags counts the approvals and AVERAGE divides by " +
        "everyone. One function, and the proportion falls out.",
      hints: [
        "76 ones and 24 zeros sum to 76; divide by 100 rows and you have the probability.",
        "That sum-then-divide is exactly what AVERAGE does — point it at the flag column.",
        "The range is H2:H101 — don't include the header.",
        "=AVERAGE(H2:H101) — J2 shows 0.76.",
      ],
      checkpoint: checkpoint(FLAGS),
      grader: {
        type: "cellFormula",
        ref: "J2",
        mustUse: ["AVERAGE"],
        expectedValue: PROBABILITIES.approved,
      },
    },
    {
      id: "income-conditionals",
      title: "Conditioning on income moves it a little",
      instruction:
        "A conditional probability averages the flag over a SLICE. In J3, the high earners: " +
        '=AVERAGEIFS($H$2:$H$101, $F$2:$F$101, ">=90000") → 0.8125 (16 applicants). In J4, the ' +
        'criteria "<90000" → 0.75. Knowing income shifts the estimate about six points — features ' +
        "are supposed to move it; that's what a model does with every input.",
      hints: [
        "AVERAGEIFS averages the FIRST range, filtered by criteria pairs after it.",
        "Average the flag column H, with income column F tested against the threshold.",
        'The criteria is quoted text with the operator inside: ">=90000", then "<90000" for J4.',
        '=AVERAGEIFS($H$2:$H$101, $F$2:$F$101, ">=90000") in J3 (0.8125); the "<90000" twin in J4 (0.75).',
      ],
      checkpoint: checkpoint({ ...FLAGS, J2: OVERALL }),
      grader: {
        type: "allOf",
        of: [
          {
            type: "anyOf",
            of: [
              { type: "cellFormula", ref: "J3", mustUse: ["AVERAGEIFS"], expectedValue: PROBABILITIES.highIncome },
              { type: "cellFormula", ref: "J3", mustUse: ["AVERAGEIF"], expectedValue: PROBABILITIES.highIncome },
            ],
          },
          {
            type: "anyOf",
            of: [
              { type: "cellFormula", ref: "J4", mustUse: ["AVERAGEIFS"], expectedValue: PROBABILITIES.lowIncome },
              { type: "cellFormula", ref: "J4", mustUse: ["AVERAGEIF"], expectedValue: PROBABILITIES.lowIncome },
            ],
          },
        ],
      },
    },
    {
      id: "group-conditionals",
      title: "Conditioning on race moves it a lot",
      instruction:
        'Same move, different condition. In J5: =AVERAGEIF($B$2:$B$101, "Hispanic", $H$2:$H$101) → ' +
        'about 0.667. In J6, the "Asian" twin → 0.8. Income shifted the probability six points; race ' +
        "shifts it thirteen — and the Black/White endpoints from the rates lesson sit thirty apart. " +
        "When a demographic moves P(approved) more than a legitimate feature does, that's the " +
        "disparate-impact signature, even if no model ever saw race.",
      hints: [
        "Three-argument AVERAGEIF: the range to test, the criteria, the range to average.",
        "Test the race column B against the quoted group name; average the FLAG column H, not income.",
        "P(approved | Hispanic) = 12 approvals over 18 applicants — the flag mean does that division for you.",
        '=AVERAGEIF($B$2:$B$101, "Hispanic", $H$2:$H$101) in J5 (0.6667); the "Asian" twin in J6 (0.8).',
      ],
      checkpoint: checkpoint({ ...FLAGS, J2: OVERALL, ...INCOME_CONDITIONALS }),
      grader: {
        type: "allOf",
        of: [
          {
            type: "anyOf",
            of: [
              { type: "cellFormula", ref: "J5", mustUse: ["AVERAGEIF"], expectedValue: PROBABILITIES.hispanic, tolerance: 1e-6 },
              { type: "cellFormula", ref: "J5", mustUse: ["AVERAGEIFS"], expectedValue: PROBABILITIES.hispanic, tolerance: 1e-6 },
            ],
          },
          {
            type: "anyOf",
            of: [
              { type: "cellFormula", ref: "J6", mustUse: ["AVERAGEIF"], expectedValue: PROBABILITIES.asian },
              { type: "cellFormula", ref: "J6", mustUse: ["AVERAGEIFS"], expectedValue: PROBABILITIES.asian },
            ],
          },
        ],
      },
    },
  ],
});

export default lesson;
