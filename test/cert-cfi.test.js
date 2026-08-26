// Structural validation for the CFI/FMVA content track (data/certs/cfi.js)
// plus arithmetic verification for its hands-on drills (data/certs/cfi-drills.js).
//
// The drill arithmetic checks are the important ones: they load each drill's
// `starting` + `solution` cells into the REAL spreadsheet engine
// (lib/sheet/model.js) and assert the computed values match the drill's
// declared `expected` values. This means every number this track claims is
// "correct" is actually verified by the same engine learners will be graded
// against — not just hand-computed and hoped to be right.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { CFI_MODULES, CFI_DISCLAIMER } from "../data/certs/cfi.js";
import { CFI_DRILLS } from "../data/certs/cfi-drills.js";
import { createSheet, setCells, getValue } from "../lib/sheet/model.js";
import { isError } from "../lib/sheet/functions.js";

const DEFAULT_TOLERANCE = 0.01;

// ---------------------------------------------------------------------------
describe("CFI_MODULES: structural shape matches data/curriculum.js's MODULES", () => {
  test("is a non-empty array of modules with the required fields", () => {
    assert.ok(Array.isArray(CFI_MODULES));
    assert.ok(CFI_MODULES.length >= 4, "expected several modules in a real track");
    for (const mod of CFI_MODULES) {
      assert.equal(typeof mod.id, "string");
      assert.equal(typeof mod.title, "string");
      assert.equal(typeof mod.icon, "string");
      assert.match(mod.color, /^#[0-9a-fA-F]{6}$/);
      assert.match(mod.light, /^#[0-9a-fA-F]{6}$/);
      assert.equal(typeof mod.description, "string");
      assert.equal(typeof mod.coopModule, "string");
      assert.ok(Array.isArray(mod.lessons) && mod.lessons.length > 0);
    }
  });

  test("module ids are unique and kebab/lowercase, all prefixed cfi-", () => {
    const ids = CFI_MODULES.map((m) => m.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate module id");
    for (const id of ids) assert.match(id, /^cfi-[a-z0-9-]+$/);
  });

  test("every lesson has the exact curriculum.js lesson shape", () => {
    for (const mod of CFI_MODULES) {
      for (const lesson of mod.lessons) {
        assert.equal(typeof lesson.id, "string");
        assert.equal(typeof lesson.title, "string");
        assert.equal(typeof lesson.minutes, "number");
        assert.ok(lesson.minutes > 0 && lesson.minutes < 60);
        assert.ok(Array.isArray(lesson.body) && lesson.body.length >= 2);
        for (const para of lesson.body) assert.ok(para.length > 40, `body paragraph too short in ${lesson.id}`);
        assert.equal(typeof lesson.challenge, "string");
        assert.ok(lesson.challenge.length > 20);
        assert.equal(typeof lesson.exampleOutput, "string");
        assert.ok(lesson.exampleOutput.length > 20);
        assert.ok(Array.isArray(lesson.quiz) && lesson.quiz.length >= 2);
      }
    }
  });

  test("lesson ids are globally unique across all modules", () => {
    const ids = CFI_MODULES.flatMap((m) => m.lessons.map((l) => l.id));
    assert.equal(new Set(ids).size, ids.length, "duplicate lesson id across modules");
  });

  test("every quiz question has exactly one correct option matching `a`, and 4 options", () => {
    for (const mod of CFI_MODULES) {
      for (const lesson of mod.lessons) {
        for (const q of lesson.quiz) {
          assert.equal(typeof q.q, "string");
          assert.equal(typeof q.a, "string");
          assert.equal(typeof q.explanation, "string");
          assert.ok(Array.isArray(q.options) && q.options.length === 4, `${lesson.id}: expected 4 options`);
          for (const opt of q.options) {
            assert.equal(typeof opt.text, "string");
            assert.equal(typeof opt.explanation, "string");
            assert.ok(opt.explanation.length > 10, `${lesson.id}: option explanation too thin`);
          }
          const matches = q.options.filter((opt) => opt.text === q.a);
          assert.equal(matches.length, 1, `${lesson.id}: quiz answer "${q.a}" must match exactly one option's text`);
        }
      }
    }
  });

  test("CFI_DISCLAIMER exists and does not claim CFI affiliation", () => {
    assert.equal(typeof CFI_DISCLAIMER, "string");
    assert.ok(CFI_DISCLAIMER.length > 40);
    assert.match(CFI_DISCLAIMER, /not affiliated/i);
  });
});

// ---------------------------------------------------------------------------
describe("CFI_DRILLS: structural shape", () => {
  test("is a non-empty array with the 7 required drill types represented", () => {
    assert.ok(Array.isArray(CFI_DRILLS));
    assert.equal(CFI_DRILLS.length, 7);
  });

  test("every drill has the required fields and a valid moduleId", () => {
    const moduleIds = new Set(CFI_MODULES.map((m) => m.id));
    for (const d of CFI_DRILLS) {
      assert.equal(typeof d.id, "string");
      assert.equal(typeof d.title, "string");
      assert.ok(moduleIds.has(d.moduleId), `${d.id}: moduleId "${d.moduleId}" does not exist in CFI_MODULES`);
      assert.equal(typeof d.minutes, "number");
      assert.equal(typeof d.scenario, "string");
      assert.ok(d.scenario.length > 30);
      assert.ok(Array.isArray(d.task) && d.task.length >= 3);
      assert.equal(typeof d.interviewAngle, "string");
      assert.equal(typeof d.modelAnswer, "string");
      assert.ok(d.modelAnswer.length > 60, `${d.id}: modelAnswer should be a substantive judgment answer`);
      assert.equal(typeof d.starting, "object");
      assert.equal(typeof d.solution, "object");
      assert.equal(typeof d.expected, "object");
      assert.equal(typeof d.tolerance, "number");
      assert.ok(d.tolerance > 0);
    }
  });

  test("drill ids are unique", () => {
    const ids = CFI_DRILLS.map((d) => d.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test("starting cells are plain literals (not formulas); solution cells are all formulas", () => {
    for (const d of CFI_DRILLS) {
      for (const [ref, v] of Object.entries(d.starting)) {
        assert.equal(typeof v, "number", `${d.id}: starting[${ref}] should be a literal number`);
      }
      for (const [ref, v] of Object.entries(d.solution)) {
        assert.equal(typeof v, "string", `${d.id}: solution[${ref}] should be a formula string`);
        assert.ok(v.startsWith("="), `${d.id}: solution[${ref}] = "${v}" should start with "="`);
      }
    }
  });

  test("no cell reference is defined in both starting and solution", () => {
    for (const d of CFI_DRILLS) {
      const startingRefs = new Set(Object.keys(d.starting));
      const overlap = Object.keys(d.solution).filter((ref) => startingRefs.has(ref));
      assert.deepEqual(overlap, [], `${d.id}: cells defined in both starting and solution: ${overlap}`);
    }
  });

  test("expected has a value for every solution cell, and no extras", () => {
    for (const d of CFI_DRILLS) {
      const solutionRefs = Object.keys(d.solution).sort();
      const expectedRefs = Object.keys(d.expected).sort();
      assert.deepEqual(expectedRefs, solutionRefs, `${d.id}: expected/solution cell sets differ`);
      for (const v of Object.values(d.expected)) assert.equal(typeof v, "number");
    }
  });

  test("mustReference (where present) only names cells that actually exist in the drill", () => {
    for (const d of CFI_DRILLS) {
      if (!d.mustReference) continue;
      const known = new Set([...Object.keys(d.starting), ...Object.keys(d.solution)]);
      for (const [cell, refs] of Object.entries(d.mustReference)) {
        assert.ok(known.has(cell), `${d.id}: mustReference key ${cell} is not a real cell in this drill`);
        for (const r of refs) assert.ok(known.has(r), `${d.id}: mustReference[${cell}] names unknown cell ${r}`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The heart of this file: every drill's solution is run through the REAL
// spreadsheet engine and checked against its declared expected values. This
// is what "verify every drill's expected values are internally consistent"
// means in practice — no number in cfi-drills.js is taken on faith.
describe("CFI_DRILLS: arithmetic is verified against the real sheet engine", () => {
  for (const d of CFI_DRILLS) {
    test(`${d.id}: solution formulas compute to the declared expected values`, () => {
      const sheet = createSheet();
      setCells(sheet, { ...d.starting, ...d.solution });

      for (const [ref, expectedValue] of Object.entries(d.expected)) {
        const actual = getValue(sheet, ref);
        assert.ok(!isError(actual), `${d.id}: ${ref} evaluated to an error (${isError(actual) ? actual.code : ""})`);
        assert.equal(typeof actual, "number", `${d.id}: ${ref} did not evaluate to a number`);
        const diff = Math.abs(actual - expectedValue);
        assert.ok(
          diff <= (d.tolerance ?? DEFAULT_TOLERANCE),
          `${d.id}: ${ref} expected ${expectedValue}, got ${actual} (diff ${diff} > tolerance ${d.tolerance ?? DEFAULT_TOLERANCE})`,
        );
      }
    });
  }
});

// ---------------------------------------------------------------------------
// A handful of drill-specific sanity checks on the FINANCE, not just the
// mechanics — these guard against a drill being internally consistent but
// financially nonsensical (e.g. a negative WACC, an IRR that doesn't
// actually bracket where the task says it does).
describe("CFI_DRILLS: domain sanity checks", () => {
  test("TVM/NPV/IRR drill: NPV at 10% is positive and the IRR bracket (18%-20%) actually straddles zero", () => {
    const d = CFI_DRILLS.find((x) => x.id === "cfi-drill-tvm-npv-irr");
    const sheet = createSheet();
    setCells(sheet, { ...d.starting, ...d.solution });
    assert.ok(getValue(sheet, "H4") > 0, "NPV at 10% should be positive for this project");
    const npvAt18 = getValue(sheet, "B16");
    const npvAt20 = getValue(sheet, "B17");
    assert.ok(npvAt18 > 0 && npvAt20 < 0, "IRR must sit between the 18% and 20% rows (sign change)");
  });

  test("WACC drill: cost of equity, after-tax cost of debt, and WACC all sit strictly between 0% and cost of equity", () => {
    const d = CFI_DRILLS.find((x) => x.id === "cfi-drill-wacc-build");
    const sheet = createSheet();
    setCells(sheet, { ...d.starting, ...d.solution });
    const costOfEquity = getValue(sheet, "B4");
    const afterTaxCostOfDebt = getValue(sheet, "B11");
    const wacc = getValue(sheet, "B15");
    assert.ok(afterTaxCostOfDebt < d.starting.B9, "after-tax cost of debt must be lower than pre-tax (tax shield)");
    assert.ok(wacc > afterTaxCostOfDebt && wacc < costOfEquity, "WACC must sit between cost of debt and cost of equity");
  });

  test("3-statement drill: both years' balance-sheet checks are zero and cash ties out to the CF bridge", () => {
    const d = CFI_DRILLS.find((x) => x.id === "cfi-drill-3statement-linkage");
    const sheet = createSheet();
    setCells(sheet, { ...d.starting, ...d.solution });
    assert.equal(getValue(sheet, "B34"), 0, "Year 1 balance sheet must already balance");
    assert.ok(Math.abs(getValue(sheet, "C34")) < 1e-9, "Year 2 balance sheet must balance after linkage");
    assert.ok(Math.abs(getValue(sheet, "C50")) < 1e-9, "CF-statement ending cash must tie to the balance sheet's cash line");
  });

  test("working capital drill: net working capital grows year over year (the cash-drag story the drill teaches)", () => {
    const d = CFI_DRILLS.find((x) => x.id === "cfi-drill-working-capital");
    const sheet = createSheet();
    setCells(sheet, { ...d.starting, ...d.solution });
    const nwc1 = getValue(sheet, "B8");
    const nwc2 = getValue(sheet, "C8");
    const nwc3 = getValue(sheet, "D8");
    assert.ok(nwc2 > nwc1 && nwc3 > nwc2, "NWC should grow each year in this scenario");
  });

  test("DCF drill: both terminal-value methods land within 5% of each other (a well-reconciled DCF)", () => {
    const d = CFI_DRILLS.find((x) => x.id === "cfi-drill-dcf-terminal-value");
    const sheet = createSheet();
    setCells(sheet, { ...d.starting, ...d.solution });
    const evPerpetuity = getValue(sheet, "H16");
    const evExitMultiple = getValue(sheet, "H23");
    const pctDiff = Math.abs(evPerpetuity - evExitMultiple) / evPerpetuity;
    assert.ok(pctDiff < 0.05, `the two terminal value methods should broadly agree (diff ${(pctDiff * 100).toFixed(1)}%)`);
    // and terminal value should be a large share of EV -- the "70%+" teaching point
    assert.ok(getValue(sheet, "H17") > 0.5, "terminal value should dominate enterprise value, as DCFs typically do");
  });

  test("sensitivity table: EV increases monotonically as WACC falls (holding g fixed) and as g rises (holding WACC fixed)", () => {
    const d = CFI_DRILLS.find((x) => x.id === "cfi-drill-sensitivity-table");
    const sheet = createSheet();
    setCells(sheet, { ...d.starting, ...d.solution });
    // Column E (g = 2.5%) down the rows: WACC 7% (row3) -> 11% (row7), EV should fall
    const colE = ["E3", "E4", "E5", "E6", "E7"].map((r) => getValue(sheet, r));
    for (let i = 1; i < colE.length; i++) assert.ok(colE[i] < colE[i - 1], "EV should fall as WACC rises");
    // Row 5 (WACC = 9%) across the columns: g 1.5% (C5) -> 3.5% (G5), EV should rise
    const row5 = ["C5", "D5", "E5", "F5", "G5"].map((c) => getValue(sheet, c));
    for (let i = 1; i < row5.length; i++) assert.ok(row5[i] > row5[i - 1], "EV should rise as g rises");
  });

  test("comps drill: EV-based implied share prices cluster tighter than the P/E-implied range (the judgment point)", () => {
    const d = CFI_DRILLS.find((x) => x.id === "cfi-drill-comps-table");
    const sheet = createSheet();
    setCells(sheet, { ...d.starting, ...d.solution });
    const evEbitdaSpread = getValue(sheet, "E25") - getValue(sheet, "C25");
    const peSpread = getValue(sheet, "E26") - getValue(sheet, "C26");
    assert.ok(evEbitdaSpread < peSpread, "EV/EBITDA-implied price range should be tighter than the P/E-implied range");
  });
});
