// Guided lesson: reconciliation — two systems, one book of business.
//
// The origination extract (hmda-raw.csv, 104 rows) and the servicing
// system's view (hmda-servicing.csv, 99 rows) describe the same loans and
// disagree. A reconciliation finds, in BOTH directions, records one system
// has and the other doesn't, plus records both have where the loan amount
// differs — and it must not cry wolf while doing it.
//
// Two traps are load-bearing and taught explicitly:
//   1. KEYS: five raw ids carry whitespace padding, so a naive exact match
//      reports 10 raw rows "missing from servicing" when the true number is
//      5 rows — and those 5 rows are only 4 APPLICANTS, because the raw file
//      still duplicates A0056 (see gov-duplicates).
//   2. AMOUNTS: the raw file stores some amounts as TEXT ("192,500",
//      "$61,000"). Text "192,500" and number 192500 are the SAME amount, so
//      a naive comparison reports 20 mismatches where only 5 are real.
//      Normalize first, then compare — a reconciliation that reports 15
//      phantom breaks gets ignored, which is worse than no reconciliation.
//
// SQL honesty: in a warehouse this is a FULL OUTER JOIN on the cleaned key
// with difference predicates. The XLOOKUP + COUNTIF build below stands in
// for it; the concept — join on normalized keys, compare normalized values,
// report both directions — is the interview answer, and it doesn't require
// pretending the spreadsheet is a warehouse.
//
// Every expected number is verified against BOTH csv files by
// test/gov-b-lessons.test.js, which re-derives them; the id lists are
// cross-checked against data/governance-manifest.json's reconciliation
// block. The manifest records 5 amount mismatches, not 4: an out-of-range
// injection (A0042, -45000) also created a genuine mismatch, and the
// manifest records reality — so does this lesson.

import { createLesson } from "../spec.js";
import { resolveSheet } from "../graders.js";
import { getCell, getValue } from "../../sheet/model.js";

const RAW = "hmda-raw.csv";
const SERVICING = "hmda-servicing.csv";

// Layout: raw extract in A1:H105 (104 rows), servicing in K1:N100 (99 rows).
export const RAW_FIRST = 2;
export const RAW_LAST = 105;
export const SVC_FIRST = 2;
export const SVC_LAST = 100;

// Ground truth, re-derived by the test from the two files:
export const NAIVE_MISSING_FROM_SVC = 10; // padded keys inflate 5 real rows to 10
export const MISSING_FROM_SVC_ROWS = 5;   // raw rows with no servicing match
export const MISSING_FROM_SVC_IDS = 4;    // ...but A0056 is duplicated: 4 applicants
export const MISSING_FROM_RAW = 3;        // B901, B902, B903
export const NAIVE_AMOUNT_MISMATCHES = 20; // text-vs-number phantoms included
export const REAL_AMOUNT_MISMATCHES = 5;   // A0012, A0041, A0042, A0070, A0099
export const CLEAN_MATCHES = 94;           // 104 - 5 unmatched - 5 mismatched

const SVC_ID_RANGE = `$K$${SVC_FIRST}:$K$${SVC_LAST}`;
const SVC_AMT_RANGE = `$M$${SVC_FIRST}:$M$${SVC_LAST}`;
const CLEAN_ID_RANGE = `$P$${RAW_FIRST}:$P$${RAW_LAST}`;

// Solution formulas, also used to seed later checkpoints.
const cleanIdFormula = (i) => `=TRIM(A${i})`;
const naiveMatchFormula = (i) => `=COUNTIF(${SVC_ID_RANGE},A${i})`;
const cleanMatchFormula = (i) => `=COUNTIF(${SVC_ID_RANGE},P${i})`;
const svcSideMatchFormula = (i) => `=COUNTIF(${CLEAN_ID_RANGE},K${i})`;
const svcAmountFormula = (i) => `=IFERROR(XLOOKUP(P${i},${SVC_ID_RANGE},${SVC_AMT_RANGE}),"")`;
// The naive flag compares the RAW amount cell to the looked-up number — text
// "192,500" is never equal to number 192500, which is the trap.
const naiveDiffFormula = (i) => `=IF(S${i}="","",IF(F${i}=S${i},0,1))`;
// The honest flag normalizes first: strip $ and thousands commas, coerce to a
// number, THEN compare. VALUE(SUBSTITUTE(...)) is the spreadsheet spelling of
// "CAST after cleaning" — the same normalize-before-compare rule a warehouse
// reconciliation applies.
const realDiffFormula = (i) =>
  `=IF(S${i}="","",IF(VALUE(SUBSTITUTE(SUBSTITUTE(F${i},"$",""),",",""))=S${i},0,1))`;

function columnCells(col, header, makeFormula, first, last) {
  const cells = header === null ? {} : { [`${col}1`]: header };
  for (let i = first; i <= last; i++) cells[`${col}${i}`] = makeFormula(i);
  return cells;
}

const P_CELLS = columnCells("P", "id_clean", cleanIdFormula, RAW_FIRST, RAW_LAST);
const Q_CELLS = columnCells("Q", "naive_matches", naiveMatchFormula, RAW_FIRST, RAW_LAST);
const R_CELLS = columnCells("R", "clean_matches", cleanMatchFormula, RAW_FIRST, RAW_LAST);
const O_CELLS = columnCells("O", "raw_matches", svcSideMatchFormula, SVC_FIRST, SVC_LAST);
const S_CELLS = columnCells("S", "svc_amount", svcAmountFormula, RAW_FIRST, RAW_LAST);
const T_CELLS = columnCells("T", "naive_diff", naiveDiffFormula, RAW_FIRST, RAW_LAST);
const U_CELLS = columnCells("U", "real_diff", realDiffFormula, RAW_FIRST, RAW_LAST);

const RESULT_CELLS = {
  W2: "raw rows without a servicing match (naive)",
  X2: `=COUNTIF($Q$${RAW_FIRST}:$Q$${RAW_LAST},0)`,
  W3: "raw rows without a servicing match (clean keys)",
  X3: `=COUNTIF($R$${RAW_FIRST}:$R$${RAW_LAST},0)`,
  W4: "servicing rows without a raw match",
  X4: `=COUNTIF($O$${SVC_FIRST}:$O$${SVC_LAST},0)`,
  W5: "amount mismatches (naive compare)",
  X5: `=SUM(T${RAW_FIRST}:T${RAW_LAST})`,
  W6: "amount mismatches (normalized)",
  X6: `=SUM(U${RAW_FIRST}:U${RAW_LAST})`,
};

function checkpoint(cells = {}) {
  return {
    tool: "sheet",
    active: "Data",
    sheets: [{
      name: "Data",
      load: [
        { resource: RAW, origin: "A1" },
        { resource: SERVICING, origin: "K1" },
      ],
      cells,
    }],
  };
}

/**
 * Per-row grader for a filled helper column, same doctrine as the other
 * governance labs: every row must be a FORMULA whose value matches the
 * expectation recomputed from the sheet at grade time. One real formula plus
 * a hundred typed values is the documented failure this shape exists to stop.
 */
function filledColumn(col, first, last, mustMention, expectedFor, what) {
  return (toolState) => {
    const sheet = resolveSheet(toolState, "Data");
    const diff = [];
    let ok = 0;
    for (let i = first; i <= last; i++) {
      const ref = `${col}${i}`;
      const cell = getCell(sheet, ref);
      const want = expectedFor(sheet, i);
      if (!cell || cell.input === "" || cell.input == null) {
        diff.push({ kind: "missing", path: ref, expected: want, actual: null,
          hint: `${ref} is empty — fill ${col}${first}'s formula down through ${col}${last}.` });
        continue;
      }
      if (!cell.isFormula) {
        diff.push({ kind: "method", path: ref, expected: `a ${what} formula`, actual: String(cell.input),
          hint: `${ref} holds a typed value. Every row must compute its own ${what}.` });
        continue;
      }
      const input = String(cell.input).toUpperCase();
      if (mustMention.length && !mustMention.some((fn) => input.includes(fn))) {
        diff.push({ kind: "method", path: ref, expected: `uses ${mustMention.join(" or ")}`, actual: String(cell.input),
          hint: `${ref} must use ${mustMention.join(" or ")} — right now it doesn't.` });
        continue;
      }
      const got = getValue(sheet, ref);
      const same = typeof want === "number" && typeof got === "number"
        ? Math.abs(got - want) < 1e-9
        : (got ?? "") === (want ?? "");
      if (!same) {
        diff.push({ kind: "wrong", path: ref, expected: want, actual: got ?? null,
          hint: `${ref} computes ${JSON.stringify(got ?? null)}; the data says ${JSON.stringify(want)}.` });
        continue;
      }
      ok++;
    }
    const total = last - first + 1;
    return {
      pass: diff.length === 0,
      score: ok / total,
      message: diff.length === 0
        ? `${col}${first}:${col}${last} — all ${total} rows computed correctly.`
        : diff[0].hint,
      diff: diff.slice(0, 5),
    };
  };
}

// COUNTIF semantics (case-insensitive, no trim) for grade-time expectations.
const ciKey = (v) => (typeof v === "string" ? v.toLowerCase() : v);

function countInRange(sheet, col, first, last, key) {
  let n = 0;
  for (let i = first; i <= last; i++) {
    if (ciKey(getValue(sheet, `${col}${i}`)) === ciKey(key)) n++;
  }
  return n;
}

const expectNaiveMatch = (sheet, i) => countInRange(sheet, "K", SVC_FIRST, SVC_LAST, getValue(sheet, `A${i}`));
const expectCleanMatch = (sheet, i) =>
  countInRange(sheet, "K", SVC_FIRST, SVC_LAST, String(getValue(sheet, `A${i}`) ?? "").trim());
const expectSvcSideMatch = (sheet, i) => {
  const key = ciKey(getValue(sheet, `K${i}`));
  let n = 0;
  for (let r = RAW_FIRST; r <= RAW_LAST; r++) {
    if (ciKey(String(getValue(sheet, `A${r}`) ?? "").trim()) === key) n++;
  }
  return n;
};

export const lesson = createLesson({
  id: "gov-reconcile",
  tool: "sheet",
  moduleId: "aigovernance",
  mode: "guided",
  modes: ["outcome"],
  title: "Reconciliation: when two systems disagree about the same loans",
  description:
    "Origination says 104 rows; servicing says 99. A reconciliation finds what each system is missing " +
    "and where the amounts disagree — without crying wolf. Two traps carry the lesson: padded keys that " +
    "make real records look missing, and amounts stored as text (\"192,500\") that make equal numbers " +
    "look different. In a warehouse this is a FULL OUTER JOIN on cleaned keys; here XLOOKUP and COUNTIF " +
    "stand in for it, and the discipline is identical: normalize, then compare, then report both " +
    "directions.",
  resources: [RAW, SERVICING],
  steps: [
    {
      // REMEDIATION (2026-08-26): the old text asked the learner to "Load CSV
      // twice ... origin K1". No such control exists — the toolbar's only
      // importer always creates a NEW sheet at A1 with no origin option, so a
      // two-extracts-in-one-sheet layout has NO UI path at all and this step
      // was impossible to clear from its empty-sheet checkpoint. The
      // checkpoint now seeds both extracts (the governance skill being taught
      // is reconciliation, not file loading) and the step is orientation over
      // the side-by-side layout.
      id: "load-both",
      title: "Two systems, one sheet",
      instruction:
        "Both systems are already loaded side by side: origination (hmda-raw.csv) in A:H (rows " +
        "2-105) and servicing (hmda-servicing.csv) in K:N (rows 2-100). Note the row counts " +
        "disagree before you compute anything — 104 vs 99 — and the whole lesson is explaining that gap.",
      hints: [
        "Servicing has 4 columns (applicant_id, zip_code, loan_amount, servicer), so it occupies K:N.",
        "H1 reads \"approved\" and N1 reads \"servicer\".",
        "The last servicing row is K100 = \"B903\" — an id the raw file has never heard of. Remember it.",
      ],
      target: { kind: "sheet-cell", ref: "K1" },
      spotlightLabel: "Raw in A:H, servicing in K:N",
      checkpoint: checkpoint(),
      grader: {
        type: "allOf",
        of: [
          {
            type: "rangeValues",
            range: "K1:N1",
            expected: [["applicant_id", "zip_code", "loan_amount", "servicer"]],
          },
          { type: "cellValue", ref: "A105", expected: "A0072" },
          { type: "cellValue", ref: "K100", expected: "B903" },
        ],
      },
      modes: {
        outcome: {
          instruction:
            "Both systems are on screen in one sheet: origination starting at A1, servicing at K1. " +
            "Establish what each side holds before comparing them.",
          hints: [
            "Origination occupies A:H; servicing occupies K:N.",
            "H1 reads \"approved\" and N1 reads \"servicer\".",
          ],
        },
      },
    },
    {
      id: "missing-from-servicing",
      title: "What servicing doesn't know about",
      instruction:
        "Which originated loans is servicing missing? First the naive way: in Q2:Q105 (header Q1), count " +
        "each raw id's appearances in the servicing id column, and total the zero-match rows in X2 (label " +
        "in W2). It says 10 — but half of those are phantoms: five raw ids are padded with spaces, so " +
        "exact matching can't see their servicing records. Build id_clean in P (TRIM, header P1), " +
        "recount in R2:R105 against the CLEAN ids, and total in X3. The real answer is 5 rows — and " +
        "because the raw file duplicates A0056, that is 4 distinct applicants. Both numbers matter: 5 is " +
        "what you fix in the file, 4 is what you report to the business.",
      hints: [
        "A raw row is \"missing from servicing\" when its id appears 0 times in K2:K100.",
        "Q2: =COUNTIF($K$2:$K$100,A2), filled down; X2: =COUNTIF($Q$2:$Q$105,0).",
        "The naive 10 shrinks once keys are cleaned: P2: =TRIM(A2), R2: =COUNTIF($K$2:$K$100,P2), both filled down.",
        "X3: =COUNTIF($R$2:$R$105,0) returns 5. Look at WHICH rows: A0010, A0033, A0079, and A0056 twice — so 4 applicants.",
      ],
      target: { kind: "sheet-cell", ref: "Q2" },
      spotlightLabel: "Count servicing matches per raw row — naive, then clean",
      checkpoint: checkpoint({}),
      grader: {
        type: "allOf",
        of: [
          {
            type: "predicate",
            label: "naive match counts per raw row",
            fn: filledColumn("Q", RAW_FIRST, RAW_LAST, ["COUNTIF"], expectNaiveMatch, "COUNTIF match count"),
          },
          { type: "cellFormula", ref: "X2", mustUse: ["COUNTIF"], expectedValue: NAIVE_MISSING_FROM_SVC },
          {
            type: "predicate",
            label: "clean match counts per raw row",
            fn: filledColumn("R", RAW_FIRST, RAW_LAST, ["COUNTIF"], expectCleanMatch, "cleaned-key match count"),
          },
          { type: "cellFormula", ref: "X3", mustUse: ["COUNTIF"], expectedValue: MISSING_FROM_SVC_ROWS },
        ],
      },
      modes: {
        outcome: {
          instruction:
            "How many originated rows have no record in servicing? Show the number a naive id match " +
            "reports in X2, the number you actually stand behind in X3, and be ready to explain both the " +
            "gap between them and why X3's rows are fewer applicants than rows.",
          hints: [
            "If the naive count looks too high, inspect the ids it claims are missing — some carry invisible padding.",
            "Right answers: 10 naive, 5 real rows (4 applicants — one of them is duplicated in raw).",
          ],
          grader: {
            type: "allOf",
            of: [
              { type: "cellFormula", ref: "X2", expectedValue: NAIVE_MISSING_FROM_SVC },
              { type: "cellFormula", ref: "X3", expectedValue: MISSING_FROM_SVC_ROWS },
            ],
          },
        },
      },
    },
    {
      id: "missing-from-raw",
      title: "The other direction",
      instruction:
        "A reconciliation that only checks one direction is half a reconciliation. Which servicing " +
        "records does the RAW extract not know about? In O2:O100 (header O1), count each servicing id's " +
        "appearances among the CLEANED raw ids, and total the zero-match rows in X4 (label in W4). Three " +
        "servicing loans — B901, B902, B903 — have no origination record at all: exactly the kind of " +
        "finding that only appears when you flip the join around.",
      hints: [
        "Same COUNTIF pattern, aimed the other way: servicing ids against P2:P105.",
        "Count against the CLEANED raw ids — otherwise the padded rows fail this direction too.",
        "O2: =COUNTIF($P$2:$P$105,K2), filled down through O100.",
        "X4: =COUNTIF($O$2:$O$100,0) returns 3 — the three B9xx loans servicing carries and origination has never seen.",
      ],
      target: { kind: "sheet-cell", ref: "O2" },
      spotlightLabel: "Count raw matches per servicing row",
      checkpoint: checkpoint({
        ...P_CELLS, ...Q_CELLS, ...R_CELLS,
        W2: RESULT_CELLS.W2, X2: RESULT_CELLS.X2,
        W3: RESULT_CELLS.W3, X3: RESULT_CELLS.X3,
      }),
      grader: {
        type: "allOf",
        of: [
          {
            type: "predicate",
            label: "raw match counts per servicing row",
            fn: filledColumn("O", SVC_FIRST, SVC_LAST, ["COUNTIF"], expectSvcSideMatch, "COUNTIF match count"),
          },
          { type: "cellFormula", ref: "X4", mustUse: ["COUNTIF"], expectedValue: MISSING_FROM_RAW },
        ],
      },
      modes: {
        outcome: {
          instruction:
            "How many servicing records have no counterpart in the raw extract? Land the count in X4 and " +
            "name the ids.",
          hints: [
            "Flip the match: servicing ids counted against the cleaned raw ids.",
            "The answer is 3, and all three ids start with B9.",
          ],
          grader: { type: "cellFormula", ref: "X4", expectedValue: MISSING_FROM_RAW },
        },
      },
    },
    {
      id: "amount-compare",
      title: "Same loan, different amount — or is it?",
      instruction:
        "For loans BOTH systems have, do the amounts agree? Pull each matched row's servicing amount " +
        "into S2:S105 (header S1; unmatched rows blank), then flag disagreements the naive way in " +
        "T2:T105: 1 when the raw amount cell differs from the servicing amount, 0 when equal, blank when " +
        "unmatched. Total the flags in X5. It screams 20 mismatches — but open one up: raw F3 holds the " +
        "TEXT \"192,500\" and servicing holds the NUMBER 192500. Same amount, different storage. " +
        "Normalize before comparing in U2:U105 — strip the $ and commas, coerce to a number, THEN " +
        "compare — and total in X6. Five real breaks. A reconciliation that reports 15 phantom breaks " +
        "trains everyone to ignore it, which is worse than not running one.",
      hints: [
        "S2: =IFERROR(XLOOKUP(P2,$K$2:$K$100,$M$2:$M$100),\"\") — the cleaned key finds the match; IFERROR blanks the 5 unmatched rows.",
        "T2: =IF(S2=\"\",\"\",IF(F2=S2,0,1)). Fill down and X5: =SUM(T2:T105) — 20, mostly phantoms.",
        "The fix is normalize-then-compare: SUBSTITUTE strips \"$\" and \",\", VALUE turns the remaining text into a number.",
        "U2: =IF(S2=\"\",\"\",IF(VALUE(SUBSTITUTE(SUBSTITUTE(F2,\"$\",\"\"),\",\",\"\"))=S2,0,1)); X6: =SUM(U2:U105) returns 5: A0012, A0041, A0042, A0070, A0099.",
      ],
      target: { kind: "sheet-cell", ref: "S2" },
      spotlightLabel: "Look up amounts, compare naively, then normalize",
      checkpoint: checkpoint({
        ...P_CELLS, ...Q_CELLS, ...R_CELLS, ...O_CELLS,
        W2: RESULT_CELLS.W2, X2: RESULT_CELLS.X2,
        W3: RESULT_CELLS.W3, X3: RESULT_CELLS.X3,
        W4: RESULT_CELLS.W4, X4: RESULT_CELLS.X4,
      }),
      grader: {
        type: "allOf",
        of: [
          { type: "cellFormula", ref: "X5", pattern: "SUM|COUNT", expectedValue: NAIVE_AMOUNT_MISMATCHES },
          { type: "cellFormula", ref: "X6", pattern: "SUM|COUNT", expectedValue: REAL_AMOUNT_MISMATCHES },
        ],
      },
      modes: {
        outcome: {
          instruction:
            "Of the loans both systems carry, how many amounts REALLY disagree? Show what a naive " +
            "comparison claims in X5 and the number that survives normalization in X6 — and be able to " +
            "say, for one phantom, exactly why the two values were never different.",
          hints: [
            "Look up each matched loan's servicing amount, then compare — once as stored, once after normalizing the raw side.",
            "\"192,500\" and 192500 are the same dollar amount stored two ways; only 5 differences are real.",
          ],
          grader: {
            type: "allOf",
            of: [
              { type: "cellFormula", ref: "X5", expectedValue: NAIVE_AMOUNT_MISMATCHES },
              { type: "cellFormula", ref: "X6", expectedValue: REAL_AMOUNT_MISMATCHES },
            ],
          },
        },
      },
    },
    {
      id: "summary",
      title: "The summary an analyst could send",
      instruction:
        "Write the reconciliation summary — the four numbers someone acts on, as a block in W8:X11: " +
        "\"in raw only\" 4 (distinct applicants; your 5 rows include the A0056 duplicate), \"in servicing " +
        "only\" 3, \"amount mismatches\" 5, \"clean matches\" 94 (104 raw rows, minus 5 with no match, " +
        "minus 5 with a real break). Labels in W, numbers in X. This block plus one sentence — \"of 104 " +
        "raw rows, 94 reconcile clean; 12 records need follow-up\" — is the deliverable; the columns " +
        "behind it are the evidence.",
      hints: [
        "Four rows: in raw only / in servicing only / amount mismatches / clean matches.",
        "Report DISTINCT applicants for the raw-only line: 5 rows minus the duplicated A0056 is 4.",
        "Clean matches: 104 rows, minus the 5 unmatched, minus the 5 real amount breaks.",
        "W8:X11 — [\"in raw only\", 4], [\"in servicing only\", 3], [\"amount mismatches\", 5], [\"clean matches\", 94].",
      ],
      target: { kind: "sheet-cell", ref: "W8" },
      spotlightLabel: "Four labels, four defensible numbers",
      checkpoint: checkpoint({
        ...P_CELLS, ...Q_CELLS, ...R_CELLS, ...O_CELLS, ...S_CELLS, ...T_CELLS, ...U_CELLS,
        ...RESULT_CELLS,
      }),
      // A summary block is a REPORT — the outcome is the four numbers being
      // right, and rangeValues accepts typed or computed values alike. The
      // evidence trail was method-graded in the previous steps.
      grader: {
        type: "rangeValues",
        range: "W8:X11",
        expected: [
          ["in raw only", MISSING_FROM_SVC_IDS],
          ["in servicing only", MISSING_FROM_RAW],
          ["amount mismatches", REAL_AMOUNT_MISMATCHES],
          ["clean matches", CLEAN_MATCHES],
        ],
      },
      modes: {
        outcome: {
          instruction:
            "Produce the reconciliation summary you would send: in W8:X11, four labeled numbers — " +
            "records only in raw (as distinct applicants), records only in servicing, real amount " +
            "mismatches, and rows that reconcile clean.",
          hints: [
            "Labels in W8:W11: in raw only / in servicing only / amount mismatches / clean matches.",
            "The raw-only line reports applicants, not rows — the duplicate doesn't get counted twice.",
          ],
        },
      },
    },
  ],
});

export default lesson;
