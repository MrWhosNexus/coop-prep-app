// Guided lesson: IFERROR and error handling — errors are signals first,
// nuisances second.
//
// Scenario: a new group ("Pacific Islander") has zero applicants in the
// extract, so its approval rate is 0/0 → #DIV/0!. And a ZIP that isn't in
// the file makes MATCH return #N/A. The lesson makes the user MEET each
// error and understand what it says before wrapping it away with IFERROR —
// and warns that blanket-wrapping hides real bugs (#NAME? typos included).
//
// Ground truth (verified against the engine):
//   =K2/J2 with J2 = 0            → #DIV/0!
//   =MATCH(99999, $D$2:$D$101, 0) → #N/A  (no such ZIP in the extract)
//
// Grading doctrine: cellFormula throughout. Steps 1 and 3 REQUIRE the error
// (expectedValue "#DIV/0!" / "#N/A") — producing the error on purpose is the
// point; steps 2 and 4 require IFERROR in the formula AND the fallback value
// AND (via pattern) the exact expression being wrapped — wrapping some other
// junk that happens to error is not handling THIS error.

import { createLesson } from "../spec.js";

const HMDA = "hmda-sample.csv";

/** The zero-applicant group scaffold next to the data. */
const SCAFFOLD = {
  I1: "group",
  J1: "total",
  K1: "approved",
  L1: "rate",
  N1: "zip 99999 at row",
  I2: "Pacific Islander",
  J2: 0,
  K2: 0,
};

const RAW_RATE = "=K2/J2";
const SAFE_RATE = '=IFERROR(K2/J2, "n/a")';
const RAW_MATCH = "=MATCH(99999, $D$2:$D$101, 0)";

// The specific lookup steps 3 and 4 are about: ZIP 99999 scanned against the
// ZIP column, exact match. $-pins optional so an unpinned-but-correct range
// still passes; a junk MATCH that merely errors does not.
const ZIP_MATCH_PATTERN = "MATCH\\(\\s*99999\\s*,\\s*\\$?D\\$?2\\s*:\\s*\\$?D\\$?101\\s*,\\s*0\\s*\\)";

function checkpoint(extra = {}) {
  return {
    tool: "sheet",
    active: "Data",
    sheets: [{ name: "Data", load: [{ resource: HMDA, origin: "A1" }], cells: { ...SCAFFOLD, ...extra } }],
  };
}

export const lesson = createLesson({
  id: "excel-iferror",
  tool: "sheet",
  moduleId: "excel",
  mode: "guided",
  // Outcome variant: "trigger the honest error, then make the report
  // presentable" posed without naming the wrapper. Graders keep the cell
  // patterns (they pin WHICH computation must be wrapped — cells, not
  // functions) but drop every named-function requirement, so a conditional
  // guard or any other route to a clean cell that still computes from the
  // right inputs is a pass.
  modes: ["outcome"],
  voice: true,
  title: "IFERROR: handle errors without hiding them",
  description:
    "A group with zero applicants breaks your rate formula; a ZIP the file doesn't contain breaks your " +
    "lookup. Excel's errors are honest about both — #DIV/0! and #N/A each mean something specific. " +
    "You'll trigger each one deliberately, read it, and only then wrap it with IFERROR so the " +
    "spreadsheet stays presentable.",
  resources: [HMDA],
  steps: [
    {
      id: "meet-div0",
      title: "Meet #DIV/0!",
      instruction:
        "Row 2 of the side table holds a group with 0 applicants (J2) and 0 approvals (K2). In L2, " +
        "compute its approval rate anyway: =K2/J2. It shows #DIV/0! — and that's CORRECT: with no " +
        "applicants, an approval rate does not exist. The error is the honest answer.",
      hints: [
        "Write the same rate formula the four-fifths table uses: approved ÷ total.",
        "K2 divided by J2 — yes, it will error. That's the point of this step.",
        "#DIV/0! means the denominator is zero. It's information, not a malfunction.",
        "=K2/J2 — L2 shows #DIV/0! because J2 is 0.",
      ],
      target: { kind: "sheet-cell", ref: "L2" },
      spotlightLabel: "Divide K2 by J2 in L2 to trigger the error",
      checkpoint: checkpoint(),
      grader: { type: "cellFormula", ref: "L2", pattern: "K2\\s*/\\s*J2", expectedValue: "#DIV/0!" },
      modes: {
        outcome: {
          instruction:
            "A brand-new group has zero applicants so far (J2) and zero approvals (K2). In L2, compute " +
            "its approval rate from those two cells anyway — and read what the sheet tells you about a " +
            "rate over nobody.",
          hints: [
            "A rate is the group's approvals over its size — even when both are zero.",
            "The result LOOKS broken. It isn't: it is the honest answer to an unanswerable division.",
          ],
          // Base grader kept: its pattern pins the K2/J2 division (cells, not
          // functions), and #DIV/0! IS the outcome this step asks for.
        },
      },
    },
    {
      id: "wrap-div0",
      title: "Wrap it: IFERROR",
      instruction:
        "A report full of #DIV/0! looks broken even when it isn't. Rewrite L2 as " +
        '=IFERROR(K2/J2, "n/a") — IFERROR returns your formula\'s result normally and the fallback ' +
        "only when the formula errors. L2 should now read n/a.",
      hints: [
        "IFERROR takes two arguments: the formula to try, and what to show if it errors.",
        "The first argument is your existing K2/J2 — wrap, don't rewrite.",
        "The fallback is text, so quote it: \"n/a\".",
        '=IFERROR(K2/J2, "n/a") — L2 reads n/a; a real rate would still come through untouched.',
      ],
      target: { kind: "sheet-cell", ref: "L2" },
      spotlightLabel: "Wrap L2's formula in IFERROR",
      checkpoint: checkpoint({ L2: RAW_RATE }),
      // The pattern pins WHAT gets wrapped: the K2/J2 rate the instruction
      // names, not any junk expression that happens to error (step 1 uses the
      // same pattern for the same reason).
      grader: { type: "cellFormula", ref: "L2", mustUse: ["IFERROR"], pattern: "K2\\s*/\\s*J2", expectedValue: "n/a" },
      modes: {
        outcome: {
          instruction:
            "This table goes in front of a board, and an error code looks like a broken spreadsheet. " +
            "Rework L2 so the empty group reads n/a instead — while still computing from K2 and J2, so " +
            "a real rate would come through untouched the day applicants arrive.",
          hints: [
            "The division stays; only what the reader SEES when it can't be answered changes.",
            "The fallback is text, so it needs quotes.",
          ],
          // Outcome grader: same cell pattern (must still compute K2/J2) and
          // the presentable value — but no required wrapper function, so a
          // zero-guard conditional is an equally correct route.
          grader: { type: "cellFormula", ref: "L2", pattern: "K2\\s*/\\s*J2", expectedValue: "n/a" },
        },
      },
    },
    {
      id: "meet-na",
      title: "Meet #N/A",
      instruction:
        "Different error, different meaning. In N2, ask MATCH where ZIP 99999 sits in the file: " +
        "=MATCH(99999, $D$2:$D$101, 0). It returns #N/A — \"no match found\" — which is exactly true: " +
        "no applicant has that ZIP.",
      hints: [
        "MATCH with exact-match mode 0 errors when the value isn't in the range — by design.",
        "Scan the ZIP column: $D$2:$D$101.",
        "#N/A is a LOOKUP error: not division, not a typo — the value simply isn't there.",
        "=MATCH(99999, $D$2:$D$101, 0) — N2 shows #N/A.",
      ],
      target: { kind: "sheet-cell", ref: "N2" },
      spotlightLabel: "Write a MATCH for ZIP 99999 in N2",
      checkpoint: checkpoint({ L2: SAFE_RATE }),
      grader: { type: "cellFormula", ref: "N2", mustUse: ["MATCH"], pattern: ZIP_MATCH_PATTERN, expectedValue: "#N/A" },
      modes: {
        outcome: {
          instruction:
            "Different failure, different message. In N2, ask the sheet to locate ZIP 99999 in the " +
            "file's ZIP column (D2:D101) — a ZIP no applicant has — and read what a search that finds " +
            "nothing reports.",
          hints: [
            "Scan the ZIP column for 99999 with an exact search.",
            "The message you get means \"no such value here\" — a different fact than a broken division.",
          ],
          // Outcome grader: the search target 99999 stays pinned (any junk
          // that merely errors must not pass), but no particular lookup
          // function is required — any exact search that reports the miss is
          // the outcome.
          grader: { type: "cellFormula", ref: "N2", pattern: "99999", expectedValue: "#N/A" },
        },
      },
    },
    {
      id: "wrap-na",
      title: "Wrap the lookup — but know what you're hiding",
      instruction:
        'Wrap N2: =IFERROR(MATCH(99999, $D$2:$D$101, 0), "not found"). One caution before you make ' +
        "this a habit: IFERROR catches EVERY error, including a misspelled function name (#NAME?). " +
        "Wrap formulas where an error is expected — not everything on the sheet.",
      hints: [
        "Same wrap as the rate: IFERROR(your MATCH, fallback).",
        "The fallback text is \"not found\".",
        "If you ever see \"not found\" where data definitely exists, unwrap and look at the real error.",
        '=IFERROR(MATCH(99999, $D$2:$D$101, 0), "not found") — N2 reads not found.',
      ],
      target: { kind: "sheet-cell", ref: "N2" },
      spotlightLabel: "Wrap N2's MATCH in IFERROR",
      checkpoint: checkpoint({ L2: SAFE_RATE, N2: RAW_MATCH }),
      grader: {
        type: "cellFormula",
        ref: "N2",
        mustUse: ["IFERROR", "MATCH"],
        pattern: ZIP_MATCH_PATTERN,
        expectedValue: "not found",
      },
      modes: {
        outcome: {
          instruction:
            "Make N2's search presentable too: a reader should see \"not found\" for a ZIP the file " +
            "doesn't contain, not an error code. One caution before this becomes a habit: a blanket " +
            "error-hider also swallows genuine mistakes like a misspelled name — reserve it for cells " +
            "where a miss is expected.",
          hints: [
            "Same move as the rate cell: the search stays, the failure presentation changes.",
            "If \"not found\" ever appears where data definitely exists, unhide and read the real error.",
          ],
          // Outcome grader: 99999 pinned, value "not found", no named wrapper.
          grader: { type: "cellFormula", ref: "N2", pattern: "99999", expectedValue: "not found" },
        },
      },
    },
  ],
});

export default lesson;
