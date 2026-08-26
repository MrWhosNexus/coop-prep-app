// Guided lesson: XLOOKUP right-to-left — the move VLOOKUP cannot make.
//
// The questions are real analyst questions over the HMDA extract: "who holds
// the largest loan?" and "who earns the most — and did they get approved?"
// Answering them means looking up a value in column E or F and returning
// column A or G. VLOOKUP only returns columns to the RIGHT of its lookup
// column; XLOOKUP's independent lookup/return arrays go either direction.
//
// Ground truth (verified against public/data/hmda-sample.csv):
//   MAX loan   = 401,000 → applicant A0016 (unique maximum)
//   MAX income = 126,000 → applicant A0076, decision APPROVED (unique maximum)
//
// Grading doctrine: every step grades the METHOD (cellFormula) because the
// lookup direction IS the lesson — a hand-typed "A0016" or a VLOOKUP-shaped
// workaround must fail — and each also checks the computed value.

import { createLesson } from "../spec.js";

const HMDA = "hmda-sample.csv";

/** Labels seeded next to the data; answers land in column J. */
const LABELS = {
  I1: "question",
  J1: "answer",
  I2: "largest loan amount",
  I3: "who holds it",
  I4: "top earner",
  I5: "their decision",
};

function checkpoint(cells = {}) {
  return {
    tool: "sheet",
    active: "Data",
    sheets: [{ name: "Data", load: [{ resource: HMDA, origin: "A1" }], cells: { ...LABELS, ...cells } }],
  };
}

const MAX_LOAN = "=MAX(E2:E101)";
const WHO_HOLDS_IT = "=XLOOKUP(J2, E2:E101, A2:A101)";
const TOP_EARNER = "=XLOOKUP(MAX(F2:F101), F2:F101, A2:A101)";

export const lesson = createLesson({
  id: "excel-lookup-reverse",
  tool: "sheet",
  moduleId: "excel",
  mode: "guided",
  // Outcome variant: the compliance questions posed cold — "who holds the
  // largest loan?", "did the top earner get approved?" — with the lookup
  // machinery withheld. Graders drop mustUse/mustNotUse: any computed route
  // to the verified answers is a pass (cellFormula with only expectedValue
  // still rejects a hand-typed applicant id).
  modes: ["outcome"],
  voice: true,
  title: "XLOOKUP right-to-left: who holds the largest loan?",
  description:
    "Compliance flagged the biggest loan in the file and wants a name. The amount lives in column E, " +
    "the applicant ID in column A — to the LEFT of it. VLOOKUP can't return a column left of its " +
    "lookup column; XLOOKUP doesn't care about direction. That freedom is this lesson.",
  resources: [HMDA],
  steps: [
    {
      id: "find-the-max",
      title: "Find the largest loan",
      instruction:
        "In J2, use MAX to find the largest loan amount in E2:E101. It should come out to 401000.",
      hints: [
        "One function, one range — no lookup needed yet.",
        "The loan amounts live in E2:E101.",
        "=MAX(range) returns the largest number in the range.",
        "=MAX(E2:E101) — J2 shows 401000.",
      ],
      target: { kind: "sheet-cell", ref: "J2" },
      spotlightLabel: "Find the largest loan with MAX in J2",
      checkpoint: checkpoint(),
      grader: { type: "cellFormula", ref: "J2", mustUse: ["MAX"], expectedValue: 401000 },
      modes: {
        outcome: {
          instruction:
            "Compliance flagged the single biggest loan in the file. In J2, compute how large it is — " +
            "the loan amounts live in E2:E101.",
          hints: [
            "One question, one column: the largest amount anywhere in E2:E101.",
            "It's just over $400k.",
          ],
          grader: { type: "cellFormula", ref: "J2", expectedValue: 401000 },
        },
      },
    },
    {
      id: "reverse-lookup",
      title: "Look LEFT: amount → applicant",
      instruction:
        "In J3, write an XLOOKUP that finds the amount in J2 within E2:E101 and returns the matching " +
        "applicant_id from A2:A101. Notice the direction: the return column (A) sits LEFT of the lookup " +
        "column (E) — this is exactly the lookup VLOOKUP cannot do.",
      hints: [
        "Same three XLOOKUP arguments as always: what to find, where to look, what to return.",
        "Look for J2 inside E2:E101; return from A2:A101. The arrays are independent — direction is irrelevant.",
        "VLOOKUP would need the ID to the right of the amount. Don't rearrange the data — use XLOOKUP.",
        "=XLOOKUP(J2, E2:E101, A2:A101) — the $401k loan belongs to A0016.",
      ],
      target: { kind: "sheet-cell", ref: "J3" },
      spotlightLabel: "Look up the applicant for J2's loan in J3",
      checkpoint: checkpoint({ J2: MAX_LOAN }),
      grader: {
        type: "cellFormula",
        ref: "J3",
        mustUse: ["XLOOKUP"],
        mustNotUse: ["VLOOKUP"],
        expectedValue: "A0016",
      },
      modes: {
        outcome: {
          instruction:
            "Now the question compliance actually asked: WHO holds that loan? In J3, compute the " +
            "applicant's ID from the amount in J2. Note the shape of the problem: the amount is in " +
            "column E, but the ID sits in column A — to its left.",
          hints: [
            "You're going from a value in one column to the matching row's entry in another.",
            "Not every lookup tool can return a column left of where it searched — pick one that can.",
          ],
          grader: { type: "cellFormula", ref: "J3", expectedValue: "A0016" },
        },
      },
    },
    {
      id: "nest-the-max",
      title: "Nest it: top earner in one formula",
      instruction:
        "Who earns the most? In J4, answer it in ONE formula: nest MAX(F2:F101) inside an XLOOKUP as " +
        "the lookup value, searching F2:F101 and returning the applicant_id from A2:A101.",
      hints: [
        "You did this in two cells for the loan; now fold the MAX straight into the lookup.",
        "The first XLOOKUP argument can be any expression — including MAX(F2:F101).",
        "Search the income column F2:F101, return from A2:A101 — left again.",
        "=XLOOKUP(MAX(F2:F101), F2:F101, A2:A101) — the top earner is A0076.",
      ],
      target: { kind: "sheet-cell", ref: "J4" },
      spotlightLabel: "Nest MAX inside XLOOKUP in J4",
      checkpoint: checkpoint({ J2: MAX_LOAN, J3: WHO_HOLDS_IT }),
      grader: {
        type: "cellFormula",
        ref: "J4",
        mustUse: ["XLOOKUP", "MAX"],
        mustNotUse: ["VLOOKUP"],
        expectedValue: "A0076",
      },
      modes: {
        outcome: {
          instruction:
            "Who earns the most in this file? In J4, answer it in ONE cell — no helper cell holding " +
            "the top income first. Incomes are in F2:F101, IDs in A2:A101.",
          hints: [
            "It's the same shape as the last answer, but the intermediate number never gets its own cell.",
            "An input to a lookup can itself be something you compute.",
          ],
          grader: { type: "cellFormula", ref: "J4", expectedValue: "A0076" },
        },
      },
    },
    {
      id: "swap-the-return",
      title: "Same lookup, different answer",
      instruction:
        "Did the top earner get approved? In J5, reuse the J4 formula but swap the return array to the " +
        "decision column G2:G101. Only the third argument changes — that's the point of keeping lookup " +
        "and return arrays separate.",
      hints: [
        "The lookup half stays identical: MAX(F2:F101) within F2:F101.",
        "Only the return array changes — decisions live in G2:G101.",
        "Copy J4's formula and edit A2:A101 into G2:G101.",
        "=XLOOKUP(MAX(F2:F101), F2:F101, G2:G101) — A0076 was APPROVED.",
      ],
      target: { kind: "sheet-cell", ref: "J5" },
      spotlightLabel: "Swap J4's return array to column G in J5",
      checkpoint: checkpoint({ J2: MAX_LOAN, J3: WHO_HOLDS_IT, J4: TOP_EARNER }),
      grader: {
        type: "cellFormula",
        ref: "J5",
        mustUse: ["XLOOKUP", "MAX"],
        expectedValue: "APPROVED",
      },
      modes: {
        outcome: {
          instruction:
            "One more for the memo: did the top earner get approved? In J5, compute their decision — " +
            "the decisions live in G2:G101.",
          hints: [
            "Same person as J4; only WHICH column you bring back changes.",
            "The answer is one of the two decision words the file uses.",
          ],
          grader: { type: "cellFormula", ref: "J5", expectedValue: "APPROVED" },
        },
      },
    },
  ],
});

export default lesson;
