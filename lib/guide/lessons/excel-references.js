// Guided lesson: absolute vs relative references — taught by BREAKING a
// formula on purpose.
//
// The whole lesson is copyCell: a reference is a relative OFFSET ("two cells
// left of me") unless pinned with $. The user writes =J2/J8, copies it one
// row down, and watches it become =J3/J9 — where J9 is empty, so #DIV/0!.
// Seeing the break makes the fix (=J2/$J$8) mean something.
//
// The table is small and self-contained (approved counts by race from the
// HMDA extract, total 76) — no CSV load, so the checkpoint is instant.
//
// Ground truth (verified against the engine):
//   approved counts 2, 8, 9, 12, 2, 43; total 76
//   shares: 0.02632, 0.10526, 0.11842, 0.15789, 0.02632, 0.56579
//   =J2/J8 copied to K3 becomes =J3/J9 → #DIV/0! (J9 is empty)
//
// Grading doctrine: cellFormula with pattern (METHOD) — the SHAPE of the
// reference is the lesson, so step 1 demands the unpinned form, step 2
// demands the translated broken form, and step 3 demands the $ pin in EVERY
// cell of the fill (K2:K7) — each paired with the value/range it must
// produce, so typed constants can't stand in for the fill.

import { createLesson } from "../spec.js";

/** Approved counts per race (alphabetical) over the HMDA extract; total 76. */
const APPROVED_COUNTS = [2, 8, 9, 12, 2, 43];
const TOTAL = 76;

export const SHARES = APPROVED_COUNTS.map((c) => [c / TOTAL]);

const RACES = ["American Indian", "Asian", "Black", "Hispanic", "Other", "White"];

function tableCells(extra = {}) {
  const cells = { I1: "race", J1: "approved", K1: "share of approvals", I8: "total", J8: TOTAL };
  RACES.forEach((race, i) => {
    cells[`I${i + 2}`] = race;
    cells[`J${i + 2}`] = APPROVED_COUNTS[i];
  });
  return { ...cells, ...extra };
}

function checkpoint(extra = {}) {
  return {
    tool: "sheet",
    active: "Shares",
    sheets: [{ name: "Shares", cells: tableCells(extra) }],
  };
}

export const lesson = createLesson({
  id: "excel-references",
  tool: "sheet",
  moduleId: "excel",
  mode: "guided",
  voice: true,
  title: "Absolute vs relative references: break it, then pin it",
  description:
    "Every Excel reference is secretly an OFFSET — \"the cell two to my left\" — and it moves when the " +
    "formula moves. You'll compute one share correctly, copy it down, watch the copy break, read WHY " +
    "from the translated formula, and fix it with the $ pin. After this, fill-down never surprises " +
    "you again.",
  steps: [
    {
      id: "relative-works",
      title: "One share, all-relative",
      instruction:
        "The table holds approved counts by race with the total (76) in J8. In K2, compute American " +
        "Indian's share of all approvals with plain relative references: =J2/J8. It shows about 0.026 " +
        "— correct. Relative references are fine until a formula MOVES.",
      hints: [
        "Share of approvals = this group's approvals ÷ total approvals.",
        "The group's count is J2; the total is J8.",
        "No $ anywhere yet — that's deliberate. The next step shows you why it matters.",
        "=J2/J8 — K2 shows 0.0263 (2 of 76 approvals).",
      ],
      target: { kind: "sheet-cell", ref: "K2" },
      spotlightLabel: "Divide J2 by J8 in K2",
      checkpoint: checkpoint(),
      grader: {
        type: "cellFormula",
        ref: "K2",
        pattern: "^=\\s*J2\\s*/\\s*J8\\s*$",
        expectedValue: 2 / 76,
      },
    },
    {
      id: "copy-and-break",
      title: "Copy it down — and watch it break",
      instruction:
        "Copy K2 and paste it into K3. K3 shows #DIV/0!. Click into K3 and read the formula: it became " +
        "=J3/J9. BOTH references slid down one row — J3 is right (Asian's count follows the row), but " +
        "the total slid to J9, which is empty. That slide is what \"relative\" means.",
      hints: [
        "Use copy/paste (not retyping) — the translation on paste IS the lesson.",
        "After pasting, compare K3's formula to K2's: every row number grew by one.",
        "J3 moving was what you wanted; J9 was not. Half the formula should follow the row, half should stay put.",
        "Copy K2 to K3 and leave it broken: K3 contains =J3/J9 and shows #DIV/0!.",
      ],
      target: { kind: "sheet-cell", ref: "K3" },
      spotlightLabel: "Copy K2 into K3 and watch it break",
      checkpoint: checkpoint({ K2: "=J2/J8" }),
      grader: {
        type: "cellFormula",
        ref: "K3",
        pattern: "J3\\s*/\\s*J9",
        expectedValue: "#DIV/0!",
      },
    },
    {
      id: "pin-and-fill",
      title: "Pin the total with $, fill the column",
      instruction:
        "Fix K2: keep the count relative but pin the total — =J2/$J$8. The $ freezes the row and " +
        "column, so copies can't move it. Now fill K2 down through K7: every share computes, and they " +
        "sum to 1. White holds 57% of all approvals in this file.",
      hints: [
        "$ before the column letter pins the column; $ before the row number pins the row. $J$8 pins both.",
        "J2 stays unpinned on purpose — each row should read its own count.",
        "=J2/$J$8, then copy K2 over K3:K7.",
        "K2:K7 shows 0.0263, 0.1053, 0.1184, 0.1579, 0.0263, 0.5658 — and no #DIV/0! anywhere.",
      ],
      target: { kind: "sheet-cell", ref: "K2" },
      spotlightLabel: "Pin J8 with dollar signs and fill K2 down",
      checkpoint: checkpoint({ K2: "=J2/J8", K3: "=J3/J9" }),
      grader: {
        type: "allOf",
        of: [
          { type: "rangeValues", range: "K2:K7", expected: SHARES },
          // METHOD on every row the fill covers: each cell must divide its
          // OWN row's count by the $-pinned total — typed constants in the
          // middle cells must not count as a pin-and-fill.
          ...SHARES.map(([share], i) => ({
            type: "cellFormula",
            ref: `K${i + 2}`,
            pattern: `J${i + 2}\\s*/\\s*\\$J\\$8`,
            expectedValue: share,
          })),
        ],
      },
    },
  ],
});

export default lesson;
