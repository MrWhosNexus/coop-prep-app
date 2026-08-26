// Guided lesson: duplicate detection in the raw HMDA governance extract.
//
// Exact duplicates and near-duplicates need different techniques, and the
// whitespace-padded ids break BOTH unless the keys are cleaned first. The
// lesson walks the real failure sequence a Data Governance Associate hits:
//   1. COUNTIF over applicant_id finds 8 rows sharing an id (4 pairs);
//   2. COUNTIF for a padded id (" A0007 ") returns ZERO for a record that is
//      right there — exact matching fails on formatting, so TRIM first;
//   3. a full-row fingerprint separates the byte-identical pairs (A0013,
//      A0056) from the near-duplicates (A0031, A0072) whose second copy
//      differs only in date format and letter case;
//   4. a defensible unique-applicant count: 104 rows, 100 applicants.
//
// SQL honesty: in a warehouse this is GROUP BY id HAVING COUNT(*) > 1 plus a
// fuzzy-match pass. The spreadsheet stands in for those; the CONCEPTS —
// key-based duplicate detection, key normalization before matching, and
// exact-vs-fuzzy comparison — transfer verbatim, and the lesson text says so
// rather than implying warehouse experience.
//
// Every expected number below is verified against public/data/hmda-raw.csv
// by test/gov-b-lessons.test.js, which re-derives them from the file — the
// manifest ids (exact_duplicate, near_duplicate, whitespace_padding in
// data/governance-manifest.json) are the authoritative cross-check.
//
// Grading doctrine:
//   - helper columns are graded per row for METHOD AND OUTCOME (predicate),
//     because one real formula plus 103 typed values is exactly the failure
//     excel-countifs documents — see filledWithFormula's WHY comment there;
//   - per-row EXPECTED values are recomputed from column A at grade time,
//     never embedded as constants, so the grader cannot drift from the data;
//   - the result cells combine cellFormula method checks with expectedValue,
//     so a hand-typed "8" fails.

import { createLesson } from "../spec.js";
import { resolveSheet } from "../graders.js";
import { getCell, getValue } from "../../sheet/model.js";

const RAW = "hmda-raw.csv";

/** Raw extract extent: 8 columns, header row 1, data rows 2-105 (104 rows). */
export const FIRST_ROW = 2;
export const LAST_ROW = 105;
export const RAW_ROWS = LAST_ROW - FIRST_ROW + 1; // 104

// Ground truth, re-derived by the test from the CSV itself:
export const DUP_ROW_COUNT = 8;        // rows whose applicant_id appears twice
export const UNIQUE_APPLICANTS = 100;  // 104 rows minus 4 second copies
// First occurrence rows of the two kinds of repeated id. A0013's pair is
// byte-identical; A0031's second copy (row 104) has the same facts saved as
// "2/3/2024" and "WHITE" — same applicant, different keystrokes.
export const EXACT_DUP_ROW = 14;  // A0013 (twin at row 102)
export const NEAR_DUP_ROW = 32;   // A0031 (twin at row 104)

const ID_RANGE = `$A$${FIRST_ROW}:$A$${LAST_ROW}`;

/** The solution formulas — also used to build later steps' checkpoints. */
const dupCountFormula = (i) => `=COUNTIF(${ID_RANGE},A${i})`;
const cleanIdFormula = (i) => `=TRIM(A${i})`;
// Fingerprint keys on the CLEANED id (column K), so padding alone cannot
// make two copies of the same record look different.
const fingerprintFormula = (i) =>
  `=K${i}&"|"&B${i}&"|"&C${i}&"|"&D${i}&"|"&E${i}&"|"&F${i}&"|"&G${i}&"|"&H${i}`;

function columnCells(col, header, makeFormula) {
  const cells = { [`${col}1`]: header };
  for (let i = FIRST_ROW; i <= LAST_ROW; i++) cells[`${col}${i}`] = makeFormula(i);
  return cells;
}

/** Completed work entering each step, accumulated column by column. */
const J_CELLS = columnCells("J", "dup_count", dupCountFormula);
const K_CELLS = columnCells("K", "id_clean", cleanIdFormula);
const L_CELLS = columnCells("L", "fingerprint", fingerprintFormula);

function checkpoint(cells = {}) {
  return {
    tool: "sheet",
    active: "Data",
    sheets: [{ name: "Data", load: [{ resource: RAW, origin: "A1" }], cells }],
  };
}

// COUNTIF equality is case-insensitive and does NOT trim — the same semantics
// the sheet engine's valueEquals implements. The per-row expected values
// below replicate it so the grader judges against what COUNTIF truly returns.
function countifKey(v) {
  return typeof v === "string" ? v.toLowerCase() : v;
}

/**
 * Per-row grader for a filled helper column: every data row must hold a
 * FORMULA (using one of `mustUse`) whose value equals `expectedFor(rowValues)`
 * — recomputed from the sheet at grade time. Same shape and same rationale as
 * excel-countifs' filledWithFormula: rangeValues alone accepts typed values,
 * which defeats the entire point of a fill-down step.
 * @param {string} col helper column letter
 * @param {string[]} mustUse accepted function names (any one)
 * @param {(sheet: object, row: number) => *} expectedFor
 * @param {string} what human name for failure messages
 */
function filledColumn(col, mustUse, expectedFor, what) {
  return (toolState) => {
    const sheet = resolveSheet(toolState, "Data");
    const diff = [];
    let ok = 0;
    for (let i = FIRST_ROW; i <= LAST_ROW; i++) {
      const ref = `${col}${i}`;
      const cell = getCell(sheet, ref);
      const want = expectedFor(sheet, i);
      if (!cell || cell.input === "" || cell.input == null) {
        diff.push({ kind: "missing", path: ref, expected: want, actual: null,
          hint: `${ref} is empty — fill ${col}${FIRST_ROW}'s formula down through ${col}${LAST_ROW}.` });
        continue;
      }
      if (!cell.isFormula) {
        diff.push({ kind: "method", path: ref, expected: `a ${what} formula`, actual: String(cell.input),
          hint: `${ref} holds a typed value. Every row must compute its own ${what}.` });
        continue;
      }
      const input = String(cell.input).toUpperCase();
      if (!mustUse.some((fn) => input.includes(fn))) {
        diff.push({ kind: "method", path: ref, expected: `uses ${mustUse.join(" or ")}`, actual: String(cell.input),
          hint: `${ref} must use ${mustUse.join(" or ")} — right now it doesn't.` });
        continue;
      }
      const got = getValue(sheet, ref);
      const same = typeof want === "string" && typeof got === "string"
        ? want === got
        : got === want;
      if (!same) {
        diff.push({ kind: "wrong", path: ref, expected: want, actual: got ?? null,
          hint: `${ref} computes ${JSON.stringify(got ?? null)}; the data says it should be ${JSON.stringify(want)}.` });
        continue;
      }
      ok++;
    }
    const total = LAST_ROW - FIRST_ROW + 1;
    return {
      pass: diff.length === 0,
      score: ok / total,
      message: diff.length === 0
        ? `${col}${FIRST_ROW}:${col}${LAST_ROW} — all ${total} rows computed correctly.`
        : diff[0].hint,
      diff: diff.slice(0, 5),
    };
  };
}

/** dup_count: how many id-column values equal this row's id, COUNTIF-style. */
function expectedDupCount(sheet, row) {
  const key = countifKey(getValue(sheet, `A${row}`));
  let n = 0;
  for (let i = FIRST_ROW; i <= LAST_ROW; i++) {
    if (countifKey(getValue(sheet, `A${i}`)) === key) n++;
  }
  return n;
}

function expectedCleanId(sheet, row) {
  return String(getValue(sheet, `A${row}`) ?? "").trim();
}

export const lesson = createLesson({
  id: "gov-duplicates",
  tool: "sheet",
  moduleId: "aigovernance",
  mode: "guided",
  modes: ["outcome"],
  title: "Duplicate detection: exact copies, near copies, and dirty keys",
  description:
    "The raw HMDA extract claims 104 applications. A governance analyst's first duplicate question is " +
    "\"how many APPLICANTS is that?\" — and the answer here is 100, but only after catching ids that " +
    "repeat, ids padded with spaces that exact matching misses, and one pair of rows that are the same " +
    "record saved with different formatting. In a warehouse this is GROUP BY ... HAVING COUNT(*) > 1; " +
    "the spreadsheet stands in for it, and the reasoning transfers unchanged.",
  resources: [RAW],
  steps: [
    {
      id: "load-raw",
      title: "Load the raw extract",
      instruction:
        "Load /data/hmda-raw.csv into the sheet with A1 as the origin. You should end up with 8 columns " +
        "(applicant_id through approved) and 104 data rows in rows 2-105 — four MORE rows than the 100 " +
        "applicants the file is supposed to describe. Finding those four is this lesson.",
      hints: [
        "The sheet toolbar has a Load CSV button — the dataset lives at /data/hmda-raw.csv.",
        "Keep the default origin A1 so the headers land in row 1.",
        "After loading, H1 reads \"approved\" and the last data row is 105.",
        "Click Load CSV, pick hmda-raw.csv, confirm origin A1. A2 reads \"A0001\" and A105 reads \"A0072\" — an id you will meet again.",
      ],
      target: { kind: "sheet-cell", ref: "A1" },
      spotlightLabel: "Load hmda-raw.csv starting at A1",
      checkpoint: checkpoint(),
      grader: {
        type: "allOf",
        of: [
          {
            type: "rangeValues",
            range: "A1:H1",
            expected: [["applicant_id", "application_date", "race", "gender", "zip_code", "loan_amount", "income", "approved"]],
          },
          { type: "cellValue", ref: "A105", expected: "A0072" },
        ],
      },
      modes: {
        outcome: {
          instruction:
            "Get the raw extract (/data/hmda-raw.csv) into the sheet — all 104 rows, headers in row 1.",
          hints: [
            "The dataset lives at /data/hmda-raw.csv.",
            "Load with A1 as the origin; the last data row is 105.",
          ],
        },
      },
    },
    {
      id: "dup-count",
      title: "Find the repeated ids",
      instruction:
        "How many rows share an applicant_id with another row? Put dup_count in J1, then give every data " +
        "row (J2:J105) a count of how many times its own id appears in the id column. Total the rows " +
        "where that count is above 1 in N2 — the answer is 8: four ids, each appearing twice.",
      hints: [
        "Each row needs to ask: how often does MY id appear in A2:A105?",
        "COUNTIF with a fixed range and the row's own id as the criteria does it — then fill down.",
        "J2: =COUNTIF($A$2:$A$105,A2). Rows in a duplicate pair read 2; singletons read 1.",
        "N2 counts the >1 rows over the helper column: =COUNTIF($J$2:$J$105,\">1\") — it returns 8.",
      ],
      target: { kind: "sheet-cell", ref: "J2" },
      spotlightLabel: "Count each id's occurrences, then total the repeats",
      checkpoint: checkpoint({}),
      grader: {
        type: "allOf",
        of: [
          {
            type: "predicate",
            label: "dup_count column computed per row",
            fn: filledColumn("J", ["COUNTIF"], expectedDupCount, "COUNTIF occurrence count"),
          },
          {
            type: "cellFormula",
            ref: "N2",
            mustUse: ["COUNTIF"],
            expectedValue: DUP_ROW_COUNT,
          },
        ],
      },
      modes: {
        outcome: {
          instruction:
            "How many of the 104 rows share their applicant_id with another row? Build whatever helper " +
            "you need, and land the count in N2.",
          hints: [
            "Give each row a count of how often its id appears, then total the rows where that count exceeds 1.",
            "Four ids each appear twice, so the right answer counts 8 rows.",
          ],
          // Outcome mode drops the per-row COUNTIF method check on purpose:
          // any formula that computes 8 from the sheet passes. cellFormula
          // still rejects a hand-typed constant — "another route" means
          // another computation, not typing the answer.
          grader: { type: "cellFormula", ref: "N2", expectedValue: DUP_ROW_COUNT },
        },
      },
    },
    {
      id: "padded-ids",
      title: "The id that exact matching can't find",
      instruction:
        "Applicant A0007 is in this file — go look at row 8. Yet a count of \"A0007\" over the id column " +
        "returns ZERO, because the id was saved as \" A0007 \" with padding spaces, and exact matching " +
        "treats that as a different value. Show the failure in N3, then fix it: build id_clean in K " +
        "(K1 header, K2:K105 cleaned ids) and recount against it in N4, which should find the record.",
      hints: [
        "N3 first: =COUNTIF($A$2:$A$105,\"A0007\") — watch it return 0 for a record you can see.",
        "The invisible characters are leading/trailing spaces. One text function removes exactly those.",
        "K2: =TRIM(A2), filled down. Five ids in this file carry padding — a join keyed on any of them silently drops the record.",
        "N4: =COUNTIF($K$2:$K$105,\"A0007\") — against the cleaned column it returns 1.",
      ],
      target: { kind: "sheet-cell", ref: "K2" },
      spotlightLabel: "Prove the padded id is invisible, then TRIM it back",
      checkpoint: checkpoint({ ...J_CELLS, N2: `=COUNTIF($J$2:$J$105,">1")` }),
      grader: {
        type: "allOf",
        of: [
          { type: "cellFormula", ref: "N3", mustUse: ["COUNTIF"], expectedValue: 0 },
          {
            type: "predicate",
            label: "id_clean column trimmed per row",
            fn: filledColumn("K", ["TRIM"], expectedCleanId, "TRIM"),
          },
          { type: "cellFormula", ref: "N4", mustUse: ["COUNTIF"], expectedValue: 1 },
        ],
      },
      modes: {
        outcome: {
          instruction:
            "A count of \"A0007\" over the raw id column returns 0, yet the applicant is in the file. " +
            "Demonstrate the failing count in N3, produce a cleaned id column in K2:K105 (header in K1), " +
            "and put a count that finds the record in N4.",
          hints: [
            "Compare A8 to what you typed — the difference is invisible characters around the id.",
            "Clean every id, then count against the cleaned column instead of the raw one.",
          ],
          grader: {
            type: "allOf",
            of: [
              { type: "cellFormula", ref: "N3", expectedValue: 0 },
              { type: "cellFormula", ref: "N4", expectedValue: 1 },
            ],
          },
        },
      },
    },
    {
      id: "near-duplicates",
      title: "Exact copies vs near copies",
      instruction:
        "Four ids repeat, but are their rows actually identical? Build a full-row fingerprint in L " +
        "(L1 header, L2:L105: the cleaned id and every other field joined into one string), then count " +
        "each suspect's fingerprint: in N5, how many rows share A0013's fingerprint (row 14)? In N6, how " +
        "many share A0031's (row 32)? A0013 comes back 2 — a true exact duplicate. A0031 comes back 1: " +
        "its second copy saved the SAME facts as \"2/3/2024\" and \"WHITE\", so byte comparison calls " +
        "them different records. That is a near-duplicate, and no exact test will ever catch it.",
      hints: [
        "Concatenate the row into one comparable string: cleaned id, then B through H, with a separator.",
        "L2: =K2&\"|\"&B2&\"|\"&C2&\"|\"&D2&\"|\"&E2&\"|\"&F2&\"|\"&G2&\"|\"&H2, filled down.",
        "N5: =COUNTIF($L$2:$L$105,L14). N6: =COUNTIF($L$2:$L$105,L32).",
        "N5 returns 2 (row 102 is byte-identical to row 14). N6 returns 1 — scroll to row 104 and compare it to row 32 by eye: same applicant, different keystrokes.",
      ],
      target: { kind: "sheet-cell", ref: "L2" },
      spotlightLabel: "Fingerprint every row, then count the suspects",
      checkpoint: checkpoint({
        ...J_CELLS, ...K_CELLS,
        N2: `=COUNTIF($J$2:$J$105,">1")`,
        N3: `=COUNTIF($A$2:$A$105,"A0007")`,
        N4: `=COUNTIF($K$2:$K$105,"A0007")`,
      }),
      grader: {
        type: "allOf",
        of: [
          { type: "cellFormula", ref: "N5", mustUse: ["COUNTIF"], expectedValue: 2 },
          { type: "cellFormula", ref: "N6", mustUse: ["COUNTIF"], expectedValue: 1 },
        ],
      },
      modes: {
        outcome: {
          instruction:
            "Of the ids that repeat, some pairs are byte-identical rows and some only LOOK different. " +
            "Using a whole-row comparison of your own design, put the number of rows matching row 14's " +
            "full content in N5 and the number matching row 32's in N6, and be ready to explain why the " +
            "two answers differ.",
          hints: [
            "Join each row's fields into one string so whole rows can be counted like values.",
            "Row 32's twin is row 104 — same facts, different date format and letter case.",
          ],
          grader: {
            type: "allOf",
            of: [
              { type: "cellFormula", ref: "N5", expectedValue: 2 },
              { type: "cellFormula", ref: "N6", expectedValue: 1 },
            ],
          },
        },
      },
    },
    {
      id: "defensible-count",
      title: "The number you would stake a decision on",
      instruction:
        "Close it out: in N7, compute the number of DISTINCT applicants in this extract — a formula over " +
        "your evidence columns, not a typed number. 104 rows carry 4 second copies (2 exact, 2 near), " +
        "so the defensible answer is 100. That sentence — \"104 rows, 100 applicants, 4 duplicate pairs " +
        "of which 2 only match after normalizing format\" — is the deliverable a governance analyst " +
        "hands over, and every number in it is now backed by a cell on this sheet.",
      hints: [
        "Start from the total number of rows and remove the extra copies.",
        "Each duplicated id contributed 2 rows to your >1 count, but only 1 extra applicant.",
        "Total rows minus half the duplicate rows: 104 - 8/2.",
        "N7: =COUNTA($A$2:$A$105)-COUNTIF($J$2:$J$105,\">1\")/2 — it returns 100.",
      ],
      target: { kind: "sheet-cell", ref: "N7" },
      spotlightLabel: "Compute the distinct-applicant count in N7",
      checkpoint: checkpoint({
        ...J_CELLS, ...K_CELLS, ...L_CELLS,
        N2: `=COUNTIF($J$2:$J$105,">1")`,
        N3: `=COUNTIF($A$2:$A$105,"A0007")`,
        N4: `=COUNTIF($K$2:$K$105,"A0007")`,
        N5: `=COUNTIF($L$2:$L$105,L${EXACT_DUP_ROW})`,
        N6: `=COUNTIF($L$2:$L$105,L${NEAR_DUP_ROW})`,
      }),
      // pattern "COUNT" admits COUNTA- and COUNTIF-based routes alike; the
      // value check pins the answer, and cellFormula's formula gate rejects a
      // typed 100.
      grader: {
        type: "cellFormula",
        ref: "N7",
        pattern: "COUNT",
        expectedValue: UNIQUE_APPLICANTS,
      },
      modes: {
        outcome: {
          instruction:
            "How many distinct applicants does this 104-row extract actually describe? Compute it in N7 " +
            "from the sheet, not from memory.",
          hints: [
            "Every duplicated id added one extra row.",
            "Your dup_count column already knows how many rows are extras.",
          ],
          grader: { type: "cellFormula", ref: "N7", expectedValue: UNIQUE_APPLICANTS },
        },
      },
    },
  ],
});

export default lesson;
