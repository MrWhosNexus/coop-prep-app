// Guided lesson: rates, proportions, and the approval gap — curriculum lesson
// stats-1's challenge ("compute the absolute gap AND the ratio, then apply the
// 80% test") done live in the sheet. Distinct ground from excel-countifs (the
// six-group four-fifths calculator): this lesson builds the two-group story —
// overall rate as a proportion, the Black/White endpoints, and the SAME gap
// measured both ways, closing with the computed verdict.
//
// Ground truth (computed with the engine over public/data/hmda-sample.csv):
//   overall rate  = 0.76      (76 APPROVED of 100)
//   Black rate    = 0.5625    (9/16)      White rate = 0.86  (43/50)
//   absolute gap  = 0.2975    (29.75 percentage points)
//   ratio         = 0.6540697674418605   → verdict "FAIL" (under 0.80)
//
// Grading doctrine: cellFormula (METHOD + OUTCOME in one descriptor)
// throughout — the proportion arithmetic is the lesson, so every denominator
// must be COUNTED, never typed: COUNTA for the file, COUNTIF for the groups,
// and the gap/ratio must divide or subtract the rate CELLS, not constants.

import { createLesson } from "../spec.js";

const HMDA = "hmda-sample.csv";

/** Verified rates over the extract (race in B, decision in G). */
export const RATES = {
  overall: 0.76,
  black: 0.5625,
  white: 0.86,
  gap: 0.2975,
  ratio: 0.6540697674418605,
};

const LABELS = {
  I2: "overall approval rate",
  I3: "Black approval rate",
  I4: "White approval rate",
  I5: "absolute gap (White - Black)",
  I6: "four-fifths ratio (Black / White)",
  I7: "four-fifths verdict",
};

function checkpoint(extra = {}) {
  return {
    tool: "sheet",
    active: "Data",
    sheets: [{ name: "Data", load: [{ resource: HMDA, origin: "A1" }], cells: { ...LABELS, ...extra } }],
  };
}

const OVERALL = '=COUNTIF($G$2:$G$101, "APPROVED")/COUNTA($G$2:$G$101)';
const GROUP_RATES = {
  J3: '=COUNTIFS($B$2:$B$101, "Black", $G$2:$G$101, "APPROVED")/COUNTIF($B$2:$B$101, "Black")',
  J4: '=COUNTIFS($B$2:$B$101, "White", $G$2:$G$101, "APPROVED")/COUNTIF($B$2:$B$101, "White")',
};
const GAP = "=J4-J3";

/** A group-rate descriptor: COUNTIFS approvals ÷ a COUNTED group size. */
function groupRate(ref, expectedValue) {
  return {
    type: "anyOf",
    of: [
      { type: "cellFormula", ref, mustUse: ["COUNTIFS", "COUNTIF"], expectedValue },
      // all-COUNTIFS is fine too — but the denominator must still be a count
      { type: "cellFormula", ref, mustUse: ["COUNTIFS"], pattern: "\\)\\s*/\\s*COUNTIFS\\s*\\(", expectedValue },
    ],
  };
}

export const lesson = createLesson({
  id: "stats-rates",
  tool: "sheet",
  moduleId: "stats",
  title: "The approval gap: one number, measured both ways",
  description:
    "An approval rate is a proportion — approved ÷ total, both COUNTED from the data. You'll compute " +
    "the file's overall rate, the Black and White rates at the ends of the spread, and then measure " +
    "the gap twice: the absolute difference that tells the human story, and the four-fifths ratio " +
    "that decides the legal one.",
  resources: [HMDA],
  steps: [
    {
      id: "overall-rate",
      title: "A rate is a proportion",
      instruction:
        "Decisions live in G2:G101. In J2, compute the overall approval rate as a proportion: " +
        '=COUNTIF($G$2:$G$101, "APPROVED")/COUNTA($G$2:$G$101). You should get 0.76 — 76 of the 100 ' +
        "applicants. Count BOTH halves; a typed denominator silently breaks the day the data grows.",
      hints: [
        "A proportion is part ÷ whole: approvals over all decisions.",
        'The part: COUNTIF over G2:G101 with the criteria "APPROVED" (quotes included).',
        "The whole: COUNTA over the same column — it counts every non-empty decision, so never hardcode 100.",
        '=COUNTIF($G$2:$G$101, "APPROVED")/COUNTA($G$2:$G$101) — J2 shows 0.76.',
      ],
      checkpoint: checkpoint(),
      grader: {
        type: "anyOf",
        of: [
          { type: "cellFormula", ref: "J2", mustUse: ["COUNTIF", "COUNTA"], expectedValue: RATES.overall },
          { type: "cellFormula", ref: "J2", mustUse: ["COUNTIFS", "COUNTA"], expectedValue: RATES.overall },
        ],
      },
    },
    {
      id: "group-rates",
      title: "The rates at the two ends",
      instruction:
        "Now condition the proportion on race (column B). In J3, the Black approval rate: " +
        '=COUNTIFS($B$2:$B$101, "Black", $G$2:$G$101, "APPROVED")/COUNTIF($B$2:$B$101, "Black"). ' +
        "In J4, the White twin. Expected: 0.5625 (9 of 16) vs 0.86 (43 of 50) — the widest spread in " +
        "the file, and both denominators are counted, not typed.",
      hints: [
        "Each rate is still part ÷ whole — the whole is now just that group's applicants.",
        "Numerator: COUNTIFS with two pairs (race matches, decision APPROVED). Denominator: COUNTIF on race alone.",
        "Divide the two counts in one cell; don't type 16 or 50 — COUNTIF them.",
        '=COUNTIFS($B$2:$B$101, "Black", $G$2:$G$101, "APPROVED")/COUNTIF($B$2:$B$101, "Black") in J3; the "White" twin in J4.',
      ],
      checkpoint: checkpoint({ J2: OVERALL }),
      grader: {
        type: "allOf",
        of: [groupRate("J3", RATES.black), groupRate("J4", RATES.white)],
      },
    },
    {
      id: "absolute-gap",
      title: "Measure 1: the absolute gap",
      instruction:
        "In J5, subtract the rates: =J4-J3. That's 0.2975 — a 29.75-percentage-point gap, the plain-" +
        "English number for a stakeholder. Reference the rate CELLS so the gap updates when the rates do.",
      hints: [
        "Absolute gap = higher rate minus lower rate.",
        "The two rates are already computed — subtract the cells, not retyped constants.",
        "White (J4) minus Black (J3).",
        "=J4-J3 — J5 shows 0.2975, read as 29.75 percentage points.",
      ],
      checkpoint: checkpoint({ J2: OVERALL, ...GROUP_RATES }),
      grader: {
        type: "cellFormula",
        ref: "J5",
        pattern: "\\$?J\\$?4\\s*-\\s*\\$?J\\$?3",
        expectedValue: RATES.gap,
      },
    },
    {
      id: "four-fifths",
      title: "Measure 2: the ratio, and the verdict",
      instruction:
        "The legal test divides the lower rate by the higher: in J6, =J3/J4 → about 0.654. In J7, " +
        'turn it into the verdict the regulator reads: =IF(J6 < 0.8, "FAIL", "PASS"). At 0.654, Black ' +
        "applicants are approved at 65% of the White rate — well under four-fifths. Same data as the " +
        "gap, very different sentence.",
      hints: [
        "The ratio divides by the HIGHER rate — Black ÷ White here, since White is this file's top rate.",
        "=J3/J4 in J6. It lands near 0.654 — compare that to the 0.80 line.",
        "The verdict is a computed IF against 0.8, referencing J6 — not a word you type.",
        '=J3/J4 in J6, =IF(J6 < 0.8, "FAIL", "PASS") in J7 — the verdict reads FAIL.',
      ],
      checkpoint: checkpoint({ J2: OVERALL, ...GROUP_RATES, J5: GAP }),
      grader: {
        type: "allOf",
        of: [
          {
            type: "cellFormula",
            ref: "J6",
            pattern: "\\$?J\\$?3\\s*/\\s*\\$?J\\$?4",
            expectedValue: RATES.ratio,
            tolerance: 1e-6,
          },
          {
            type: "cellFormula",
            ref: "J7",
            mustUse: ["IF"],
            pattern: "(?=[\\s\\S]*J6)(?=[\\s\\S]*0\\.8)",
            expectedValue: "FAIL",
          },
        ],
      },
    },
  ],
});

export default lesson;
