// Guided lesson: data QUALITY RULES — turning "this looks wrong" into a rule
// that can be applied to every row and re-run against tomorrow's extract.
// The teaching point of the whole lesson: an eyeball scales to one file once;
// a rule scales to every file forever.
//
// Runs over the dirty HMDA extract (public/data/hmda-raw.csv; answer key in
// data/governance-manifest.json). gov-profiling found the smells; this lesson
// legislates them.
//
// Every expected number was DERIVED by loading the real CSV through lib/sheet
// and evaluating the same formulas the steps ask for (no invented constants —
// a prior audit found fabricated ones, so each is pinned to its derivation):
//   zip rule    SUM of IF(LEN(TRIM(E))=5,0,1) over rows 2-105       = 13
//               (11 leading-zero losses + out-of-range 4-digit zips;
//                the CSV loader keeps them numeric, so LEN sees 4 digits)
//   income rule ROWS - COUNTIF(G,">0")                              = 22
//               (10 text-typed incomes + 11 missing in four spellings +
//                1 zero income; COUNTIF ">0" matches only real numbers)
//   approved    ROWS - COUNTIF("APPROVED") - COUNTIF("DENIED")      = 4
//   (case-blind: 3 "Y" + 1 "N"; COUNTIF matches case-insensitively,
//    so "Approved" slips through)
//   approved    SUM of EXACT()-based flags                          = 8
//   (exact:     the 4 above plus 4 "Approved" — the 4-vs-8 gap is the
//               step's lesson: a rule is only as strict as its comparator)
//
// SQL honesty: in a warehouse these rules would be CHECK constraints or dbt
// tests. The formulas here teach the rule-writing concept; the learner should
// say "I wrote column-level validation rules" — not imply they ran dbt.

import { createLesson } from "../spec.js";
import { resolveSheet } from "../graders.js";
import { getCell, getValue } from "../../sheet/model.js";

const RAW = "hmda-raw.csv";
const FIRST_ROW = 2;
const LAST_ROW = 105;
const N_ROWS = LAST_ROW - FIRST_ROW + 1; // 104

/** Derived violation counts (see header for each derivation). */
export const ZIP_RULE_VIOLATIONS = 13;
export const INCOME_RULE_VIOLATIONS = 22;
export const APPROVED_CASEBLIND_VIOLATIONS = 4;
export const APPROVED_EXACT_VIOLATIONS = 8;

// Rule ledger down column M, counts in N. Flag columns J (zip) and K
// (approved, strict) sit next to the data so a flagged row is easy to see.
const LEDGER = {
  M1: "rule",
  N1: "violations",
  M2: "zip_code is exactly 5 characters",
  M3: "income is a positive number",
  M4: "approved is APPROVED or DENIED",
  M5: "approved is APPROVED or DENIED (exact case)",
};

/** Fill a per-row flag-formula column, J2:J105 style. */
function flagColumn(col, template) {
  const cells = {};
  for (let r = FIRST_ROW; r <= LAST_ROW; r++) {
    cells[`${col}${r}`] = template.replaceAll("{r}", String(r));
  }
  return cells;
}

function checkpoint(cells = {}) {
  return {
    tool: "sheet",
    active: "Data",
    sheets: [{
      name: "Data",
      load: [{ resource: RAW, origin: "A1" }],
      cells: { ...LEDGER, ...cells },
    }],
  };
}

/**
 * Predicate factory for a flag column plus its violation total.
 *
 * WHY a predicate and not cellFormula + cellValue: the rule lives in 104 row
 * cells, and grading only the first one already failed this project once —
 * one real formula plus typed constants passed a fill-down step (see
 * excel-countifs.js filledWithFormula, whose doctrine this follows). Every
 * row is checked against a flag RE-DERIVED from that row's own data cell, so
 * a stale or hand-typed flag fails even when the total happens to be right.
 *
 * @param {string} col flag column letter
 * @param {string} totalRef the SUM cell, e.g. "N2"
 * @param {number} totalWant derived violation count
 * @param {(dataValue: *) => 0|1} expectedFlag JS mirror of the rule
 * @param {string} dataCol the data column the rule reads, e.g. "E"
 * @param {string[]|null} mustUse function names the row formula must contain
 *   (any one); null = outcome mode, method unchecked
 * @param {string} what rule name for messages
 */
function flagColumnGrader(col, totalRef, totalWant, expectedFlag, dataCol, mustUse, what) {
  return (toolState) => {
    const sheet = resolveSheet(toolState, "Data");
    const diff = [];
    let ok = 0;

    for (let r = FIRST_ROW; r <= LAST_ROW; r++) {
      const ref = `${col}${r}`;
      const cell = getCell(sheet, ref);
      const want = expectedFlag(getValue(sheet, `${dataCol}${r}`));

      if (!cell || cell.input === "" || cell.input == null) {
        diff.push({ kind: "missing", path: ref, expected: want, actual: null,
          hint: `${ref} is empty — the ${what} rule must flag EVERY row, so fill ${col}${FIRST_ROW} down through ${col}${LAST_ROW}.` });
        continue;
      }
      if (mustUse) {
        if (!cell.isFormula) {
          diff.push({ kind: "method", path: ref, expected: `a ${what} rule formula`, actual: String(cell.input),
            hint: `${ref} holds a typed value. A rule is a FORMULA the next extract can re-run — an eyeballed 0/1 is not a rule.` });
          continue;
        }
        const input = String(cell.input).toUpperCase();
        if (!mustUse.some((fn) => input.includes(`${fn}(`))) {
          diff.push({ kind: "method", path: ref, expected: `uses ${mustUse.join(" or ")}`, actual: String(cell.input),
            hint: `${ref} must apply the rule with ${mustUse.join(" or ")} — that comparator is the point of this step.` });
          continue;
        }
      }
      const got = getValue(sheet, ref);
      if (got !== want) {
        diff.push({ kind: "wrong", path: ref, expected: want, actual: got,
          hint: `${ref} flags ${JSON.stringify(got)}, but row ${r}'s ${dataCol}${r} should flag ${want} under "${what}".` });
        continue;
      }
      ok += 1;
    }

    const total = getValue(sheet, totalRef);
    const totalOk = typeof total === "number" && Math.abs(total - totalWant) < 1e-9;
    if (!totalOk) {
      diff.push({ kind: total == null ? "missing" : "wrong", path: totalRef, expected: totalWant, actual: total ?? null,
        hint: `${totalRef} should total the flag column — the rule finds ${totalWant} violating rows.` });
    }

    const pass = ok === N_ROWS && totalOk;
    return {
      pass,
      message: pass
        ? `The ${what} rule flags all ${N_ROWS} rows and counts ${totalWant} violations.`
        : `${N_ROWS - ok} of ${N_ROWS} rows are not correctly flagged by the ${what} rule.`,
      diff: diff.slice(0, 5),
    };
  };
}

// JS mirrors of the rules, applied to the value lib/sheet holds for the data
// cell. Zips that lost their leading zero load as NUMBERS (2138), which is
// exactly why the rule stringifies before measuring length — same as
// LEN(TRIM(...)) does inside the engine.
const zipFlag = (v) => (String(v ?? "").trim().length === 5 ? 0 : 1);
const approvedExactFlag = (v) => (v === "APPROVED" || v === "DENIED" ? 0 : 1);

const ZIP_FLAGS = flagColumn("J", "=IF(LEN(TRIM(E{r}))=5,0,1)");
const APPROVED_FLAGS = flagColumn("K", '=IF(OR(EXACT(H{r},"APPROVED"),EXACT(H{r},"DENIED")),0,1)');

export const lesson = createLesson({
  id: "gov-quality-rules",
  tool: "sheet",
  moduleId: "aigovernance",
  mode: "guided",
  modes: ["outcome"],
  voice: true,
  title: "Quality rules: from eyeball to something you can re-run",
  description:
    "Profiling told you this extract is dirty. Now write the finding down as RULES: column-level " +
    "checks that flag every violating row and count the damage, so next month's extract gets the " +
    "same scrutiny with zero extra effort. In a warehouse these would be schema constraints or " +
    "dbt tests; here you build the same logic as formulas, which is the part interviews ask you " +
    "to reason through.",
  resources: [RAW],
  steps: [
    {
      id: "zip-rule",
      title: "Rule 1: a zip code has exactly 5 characters",
      instruction:
        "Column E should hold 5-character zip codes, but profiling showed some load as 4-digit " +
        "numbers (a leading zero lost somewhere upstream). Build the rule in column J: J2 flags " +
        "row 2 with 1 if its zip breaks the rule and 0 if it passes, filled down through J105. " +
        "Then total the damage in N2. A flagged ROW list is the deliverable — the fix needs to " +
        "know which records to repair, not just how many.",
      hints: [
        "The rule is about the LENGTH of the value, and stray spaces should not count.",
        "LEN measures length; TRIM strips padding first. Compare the result to 5 inside an IF.",
        "J2: =IF(LEN(TRIM(E2))=5,0,1), then fill down to J105. N2 sums the column.",
        "J2: =IF(LEN(TRIM(E2))=5,0,1) filled to J105; N2: =SUM(J2:J105) — 13 rows violate: the 11 zips that lost a leading zero plus out-of-range 4-digit codes.",
      ],
      target: { kind: "sheet-cell", ref: "J2" },
      spotlightLabel: "Build the zip rule in J2 and fill down",
      checkpoint: checkpoint(),
      grader: {
        type: "predicate",
        label: "zip-length rule over every row",
        fn: flagColumnGrader("J", "N2", ZIP_RULE_VIOLATIONS, zipFlag, "E", ["LEN"], "zip-length"),
      },
      modes: {
        outcome: {
          instruction:
            "Which rows break the rule \"zip_code is exactly 5 characters\"? Flag each row 0/1 in " +
            "column J (J2:J105) and put the violation total in N2.",
          hints: [
            "Watch out: zips that lost a leading zero are stored as numbers — measure their length as text.",
            "0 for a passing row, 1 for a violation, then total the flags.",
          ],
          // Outcome mode: any route to correct per-row flags passes, but the
          // flags must still be RIGHT row by row — the rule applied to every
          // row IS the outcome, not just its total.
          grader: {
            type: "predicate",
            label: "zip-length rule outcomes",
            fn: flagColumnGrader("J", "N2", ZIP_RULE_VIOLATIONS, zipFlag, "E", null, "zip-length"),
          },
        },
      },
    },
    {
      id: "income-rule",
      title: "Rule 2: income is a positive number",
      instruction:
        "An income that is text, missing, zero or negative cannot support an affordability " +
        "decision. In N3, count how many rows violate \"income is a positive number\" — this one " +
        "needs no flag column, because a single counting formula can apply the whole rule.",
      hints: [
        "Count the rows that PASS the rule, then subtract from the row count.",
        "COUNTIF with a \">0\" criterion matches only real numbers greater than zero — text and blanks fail it automatically.",
        "Subtract the passing count from ROWS(G2:G105).",
        "N3: =ROWS(G2:G105)-COUNTIF(G2:G105,\">0\") — 22 violations: 10 text-typed incomes, 11 missing in four different spellings, and 1 zero.",
      ],
      target: { kind: "sheet-cell", ref: "N3" },
      spotlightLabel: "Count income-rule violations in N3",
      checkpoint: checkpoint({ ...ZIP_FLAGS, N2: "=SUM(J2:J105)" }),
      grader: {
        // METHOD + OUTCOME: must be a counting formula over the data (typed
        // 22 cannot re-run against the next extract), any COUNT* route passes.
        type: "cellFormula",
        ref: "N3",
        pattern: "COUNT",
        expectedValue: INCOME_RULE_VIOLATIONS,
      },
      modes: {
        outcome: {
          instruction:
            "How many rows violate the rule \"income is a positive number\"? Put the count in N3.",
          hints: [
            "Text, blanks, the four missing-value spellings, and zero all violate it.",
            "It is easier to count the rows that PASS and subtract.",
          ],
          grader: { type: "cellValue", ref: "N3", expected: INCOME_RULE_VIOLATIONS },
        },
      },
    },
    {
      id: "approved-rule-caseblind",
      title: "Rule 3: approved comes from a known set",
      instruction:
        "approved should only ever say APPROVED or DENIED. In N4, count the rows whose value is " +
        "NEITHER, using COUNTIF. Keep the number in mind — the next step shows why it is smaller " +
        "than the truth.",
      hints: [
        "Count the APPROVED rows and the DENIED rows; whatever is left over violates the rule.",
        "Two COUNTIFs subtracted from the row count.",
        "N4: =ROWS(H2:H105)-COUNTIF(H2:H105,\"APPROVED\")-COUNTIF(H2:H105,\"DENIED\")",
        "The formula returns 4 (three \"Y\", one \"N\"). But profiling showed \"Approved\" in this column too — COUNTIF just matched it silently, because COUNTIF compares case-insensitively.",
      ],
      target: { kind: "sheet-cell", ref: "N4" },
      spotlightLabel: "Count out-of-set approved values in N4",
      checkpoint: checkpoint({
        ...ZIP_FLAGS,
        N2: "=SUM(J2:J105)",
        N3: "=ROWS(G2:G105)-COUNTIF(G2:G105,\">0\")",
      }),
      grader: {
        // The COUNTIF method is REQUIRED here: this step exists to make the
        // learner run the case-blind comparator so the next step can catch it
        // undercounting.
        type: "cellFormula",
        ref: "N4",
        mustUse: ["COUNTIF"],
        expectedValue: APPROVED_CASEBLIND_VIOLATIONS,
      },
      modes: {
        outcome: {
          instruction:
            "Using COUNTIF, how many approved values fall outside {APPROVED, DENIED}? Put the count in N4.",
          hints: [
            "Count each allowed value, subtract both from the row count.",
          ],
          // Outcome mode still pins COUNTIF: the comparator IS the finding
          // this step sets up, so the method survives into the variant.
          grader: {
            type: "cellFormula",
            ref: "N4",
            mustUse: ["COUNTIF"],
            expectedValue: APPROVED_CASEBLIND_VIOLATIONS,
          },
        },
      },
    },
    {
      id: "approved-rule-exact",
      title: "Rule 3, strict: the comparator is part of the rule",
      instruction:
        "The data standard says the canonical values are APPROVED and DENIED — exact casing. " +
        "Rebuild the rule strictly: flag each row in column K (K2:K105) using a CASE-SENSITIVE " +
        "comparison, and total the violations in N5. If N5 differs from N4, your first rule was " +
        "quietly waving nonconforming values through.",
      hints: [
        "COUNTIF cannot do this — it treats \"Approved\" and \"APPROVED\" as equal. You need a comparison that respects case.",
        "EXACT(a,b) is TRUE only when two texts match character for character, case included.",
        "Per row: the value must be EXACT to \"APPROVED\" or EXACT to \"DENIED\"; flag 1 when neither holds.",
        "K2: =IF(OR(EXACT(H2,\"APPROVED\"),EXACT(H2,\"DENIED\")),0,1) filled to K105; N5: =SUM(K2:K105) — 8 violations, double what COUNTIF reported, because four rows say \"Approved\".",
      ],
      target: { kind: "sheet-cell", ref: "K2" },
      spotlightLabel: "Flag rows strictly in K2 and fill down",
      checkpoint: checkpoint({
        ...ZIP_FLAGS,
        N2: "=SUM(J2:J105)",
        N3: "=ROWS(G2:G105)-COUNTIF(G2:G105,\">0\")",
        N4: "=ROWS(H2:H105)-COUNTIF(H2:H105,\"APPROVED\")-COUNTIF(H2:H105,\"DENIED\")",
      }),
      grader: {
        type: "predicate",
        label: "exact-case approved rule over every row",
        fn: flagColumnGrader("K", "N5", APPROVED_EXACT_VIOLATIONS, approvedExactFlag, "H", ["EXACT"], "exact-case approved"),
      },
      modes: {
        outcome: {
          instruction:
            "Under the strict standard (canonical casing, APPROVED or DENIED and nothing else), " +
            "flag each violating row 0/1 in K2:K105 and total the violations in N5. Why does the " +
            "total disagree with N4?",
          hints: [
            "Your comparison must treat \"Approved\" and \"APPROVED\" as different values.",
            "Done right, the strict count is exactly double the case-blind one.",
          ],
          grader: {
            type: "predicate",
            label: "exact-case approved rule outcomes",
            fn: flagColumnGrader("K", "N5", APPROVED_EXACT_VIOLATIONS, approvedExactFlag, "H", null, "exact-case approved"),
          },
        },
      },
    },
  ],
});

export default lesson;
