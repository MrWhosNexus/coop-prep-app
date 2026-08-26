// Fidelity tests for the LibreOffice-Calc-matching functions added to the
// spreadsheet engine (lib/sheet/functions.js). Mirrors test/sheet.test.js's
// approach: build a tiny sheet, evaluate a formula, assert on the result.
// This file owns no engine code -- it only exercises the public formula
// surface via evaluate.js + model.js, exactly like the existing suite.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { isError, FUNCTIONS } from "../lib/sheet/functions.js";
import { createSheet, setCells, getValue } from "../lib/sheet/model.js";

/** Evaluate a single formula against given literal cells (mirrors sheet.test.js). */
function calc(formula, cells = {}) {
  const sheet = createSheet();
  setCells(sheet, { ...cells, Z99: formula });
  return getValue(sheet, "Z99");
}

function errCode(v) {
  assert.ok(isError(v), `expected a FormulaError, got ${JSON.stringify(v)}`);
  return v.code;
}

function close(actual, expected, eps = 1e-6) {
  assert.ok(Math.abs(actual - expected) < eps, `expected ${actual} to be close to ${expected}`);
}

// ---------------------------------------------------------------------------
describe("logic: SWITCH / CHOOSE / IFNA", () => {
  test("SWITCH matches by value, falls to default, else #N/A", () => {
    assert.equal(calc('=SWITCH(2,1,"one",2,"two",3,"three")'), "two");
    assert.equal(calc('=SWITCH(9,1,"one",2,"two","other")'), "other");
    assert.equal(errCode(calc('=SWITCH(9,1,"one",2,"two")')), "#N/A");
  });

  test("SWITCH only evaluates the matched branch", () => {
    assert.equal(calc("=SWITCH(1,1,42,2,1/0)"), 42);
    assert.equal(errCode(calc("=SWITCH(2,1,42,2,1/0)")), "#DIV/0!");
  });

  test("CHOOSE picks the nth value, 1-based, lazily", () => {
    assert.equal(calc('=CHOOSE(2,"a","b","c")'), "b");
    assert.equal(calc("=CHOOSE(1,7,1/0)"), 7);
    assert.equal(errCode(calc("=CHOOSE(0,1,2)")), "#VALUE!");
    assert.equal(errCode(calc("=CHOOSE(3,1,2)")), "#VALUE!");
  });

  test("IFNA only catches #N/A, passes other errors through", () => {
    assert.equal(calc('=IFNA(NA(),"missing")'), "missing");
    assert.equal(errCode(calc('=IFNA(1/0,"missing")')), "#DIV/0!");
    assert.equal(calc("=IFNA(5,-1)"), 5);
  });
});

// ---------------------------------------------------------------------------
describe("lookup: LOOKUP / ROW / COLUMN / ROWS / COLUMNS", () => {
  test("LOOKUP vector form: approximate match against ascending vector", () => {
    const cells = { A1: 1, A2: 3, A3: 5, B1: "low", B2: "mid", B3: "high" };
    assert.equal(calc("=LOOKUP(4,A1:A3,B1:B3)", cells), "mid");
    assert.equal(calc("=LOOKUP(5,A1:A3,B1:B3)", cells), "high");
    assert.equal(errCode(calc("=LOOKUP(0,A1:A3,B1:B3)", cells)), "#N/A");
  });

  test("LOOKUP array form: tall array searches first column, returns last column", () => {
    const cells = { A1: 1, B1: "x", A2: 2, B2: "y", A3: 3, B3: "z" };
    assert.equal(calc("=LOOKUP(2,A1:B3)", cells), "y");
  });

  test("ROW/COLUMN read a reference's position, ROWS/COLUMNS read a range's shape", () => {
    assert.equal(calc("=ROW(C5)"), 5);
    assert.equal(calc("=COLUMN(C5)"), 3);
    assert.equal(calc("=ROWS(A1:A10)"), 10);
    assert.equal(calc("=COLUMNS(A1:D1)"), 4);
    assert.equal(calc("=ROWS(5)"), 1);
  });
});

// ---------------------------------------------------------------------------
describe("info functions: NA / ISNA / ISLOGICAL / ISEVEN / ISODD / N / T", () => {
  test("NA/ISNA", () => {
    assert.equal(errCode(calc("=NA()")), "#N/A");
    assert.equal(calc("=ISNA(NA())"), true);
    assert.equal(calc("=ISNA(1/0)"), false);
    assert.equal(calc("=ISNA(5)"), false);
  });

  test("ISLOGICAL / ISEVEN / ISODD", () => {
    assert.equal(calc("=ISLOGICAL(TRUE)"), true);
    assert.equal(calc("=ISLOGICAL(1)"), false);
    assert.equal(calc("=ISEVEN(4)"), true);
    assert.equal(calc("=ISEVEN(3)"), false);
    assert.equal(calc("=ISODD(3)"), true);
    assert.equal(calc("=ISEVEN(-4)"), true);
  });

  test("N coerces, T passes through only text", () => {
    assert.equal(calc("=N(TRUE)"), 1);
    assert.equal(calc('=N("hi")'), 0);
    assert.equal(calc("=N(5)"), 5);
    assert.equal(calc('=T("hi")'), "hi");
    assert.equal(calc("=T(5)"), "");
  });
});

// ---------------------------------------------------------------------------
describe("aggregation: SUMPRODUCT / COUNTBLANK / PRODUCT / SUMSQ / AVERAGEA", () => {
  test("SUMPRODUCT multiplies elementwise across equal-shaped arrays", () => {
    const cells = { A1: 1, A2: 2, A3: 3, B1: 4, B2: 5, B3: 6 };
    assert.equal(calc("=SUMPRODUCT(A1:A3,B1:B3)", cells), 1 * 4 + 2 * 5 + 3 * 6);
  });

  test("SUMPRODUCT mismatched shapes -> #VALUE!", () => {
    const cells = { A1: 1, A2: 2, B1: 4 };
    assert.equal(errCode(calc("=SUMPRODUCT(A1:A2,B1:B1)", cells)), "#VALUE!");
  });

  test("COUNTBLANK counts empty and empty-string cells", () => {
    const cells = { A1: 1, A2: undefined, A3: "", A4: "x" };
    assert.equal(calc("=COUNTBLANK(A1:A4)", cells), 2);
  });

  test("PRODUCT ignores text/blank in ranges; empty selection is 0", () => {
    const cells = { A1: 2, A2: "text", A3: 3, A4: undefined };
    assert.equal(calc("=PRODUCT(A1:A4)", cells), 6);
    assert.equal(calc("=PRODUCT(A4)", cells), 0); // A4 is a blank cell
  });

  test("SUMSQ sums squares", () => {
    assert.equal(calc("=SUMSQ(3,4)"), 25);
  });

  test("AVERAGEA counts text as 0 and TRUE as 1 (unlike AVERAGE)", () => {
    const cells = { A1: 10, A2: "text", A3: true };
    assert.equal(calc("=AVERAGEA(A1:A3)", cells), (10 + 0 + 1) / 3);
    assert.equal(calc("=AVERAGE(A1:A3)", cells), 10); // sanity: existing AVERAGE unaffected
  });
});

// ---------------------------------------------------------------------------
describe("aggregation: LARGE / SMALL / RANK / MODE / GEOMEAN / HARMEAN", () => {
  const nums = { A1: 5, A2: 1, A3: 9, A4: 3 };

  test("LARGE/SMALL by k", () => {
    assert.equal(calc("=LARGE(A1:A4,1)", nums), 9);
    assert.equal(calc("=LARGE(A1:A4,2)", nums), 5);
    assert.equal(calc("=SMALL(A1:A4,1)", nums), 1);
    assert.equal(errCode(calc("=LARGE(A1:A4,5)", nums)), "#NUM!");
  });

  test("RANK/RANK.EQ: default descending, ties share the top rank", () => {
    const cells = { A1: 10, A2: 20, A3: 20, A4: 5 };
    assert.equal(calc("=RANK(20,A1:A4)", cells), 1);
    assert.equal(calc("=RANK(10,A1:A4)", cells), 3);
    assert.equal(calc("=RANK.EQ(5,A1:A4)", cells), 4);
    assert.equal(calc("=RANK(5,A1:A4,1)", cells), 1); // ascending order
    assert.equal(errCode(calc("=RANK(99,A1:A4)", cells)), "#N/A");
  });

  test("MODE/MODE.SNGL: most frequent value; no repeats -> #N/A", () => {
    const cells = { A1: 1, A2: 2, A3: 2, A4: 3 };
    assert.equal(calc("=MODE(A1:A4)", cells), 2);
    assert.equal(calc("=MODE.SNGL(A1:A4)", cells), 2);
    assert.equal(errCode(calc("=MODE(1,2,3)")), "#N/A");
  });

  test("GEOMEAN/HARMEAN", () => {
    close(calc("=GEOMEAN(4,9)"), 6);
    close(calc("=HARMEAN(1,4)"), 2 / (1 + 0.25));
    assert.equal(errCode(calc("=GEOMEAN(4,-9)")), "#NUM!");
  });
});

// ---------------------------------------------------------------------------
describe("math: MOD / MROUND / CEILING / FLOOR / rounding / logs / combinatorics", () => {
  test("MOD sign follows the divisor (Calc semantics), not the dividend", () => {
    assert.equal(calc("=MOD(7,3)"), 1);
    assert.equal(calc("=MOD(-7,3)"), 2);
    assert.equal(calc("=MOD(7,-3)"), -2);
    assert.equal(errCode(calc("=MOD(7,0)")), "#DIV/0!");
  });

  test("MROUND rounds to nearest multiple, errors on mismatched sign", () => {
    assert.equal(calc("=MROUND(10,3)"), 9);
    assert.equal(calc("=MROUND(-10,-3)"), -9);
    assert.equal(errCode(calc("=MROUND(10,-3)")), "#NUM!");
  });

  test("CEILING/FLOOR (legacy) require matching sign, round away/toward zero", () => {
    assert.equal(calc("=CEILING(4.1,1)"), 5);
    assert.equal(calc("=CEILING(-4.5,-2)"), -6);
    assert.equal(errCode(calc("=CEILING(4,-2)")), "#NUM!");
    assert.equal(calc("=FLOOR(4.9,1)"), 4);
    assert.equal(calc("=FLOOR(-4.5,-2)"), -4);
    assert.equal(errCode(calc("=FLOOR(4,0)")), "#DIV/0!");
  });

  test("CEILING.MATH/FLOOR.MATH: mode flag controls negative rounding direction", () => {
    assert.equal(calc("=CEILING.MATH(-4.5)"), -4); // default: toward zero
    assert.equal(calc("=CEILING.MATH(-4.5,1,1)"), -5); // mode!=0: away from zero
    assert.equal(calc("=FLOOR.MATH(-4.5)"), -5); // default: away from zero
    assert.equal(calc("=FLOOR.MATH(-4.5,1,1)"), -4); // mode!=0: toward zero
  });

  test("INT/TRUNC/SIGN", () => {
    assert.equal(calc("=INT(-4.3)"), -5); // floor toward -infinity
    assert.equal(calc("=TRUNC(-4.7)"), -4); // toward zero
    assert.equal(calc("=TRUNC(3.14159,2)"), 3.14);
    assert.equal(calc("=SIGN(-9)"), -1);
    assert.equal(calc("=SIGN(0)"), 0);
  });

  test("EXP/LN/LOG/LOG10", () => {
    close(calc("=LN(EXP(1))"), 1);
    // "LOG10" also parses as a valid cell ref (col "LOG", row 10) in this
    // engine's tokenizer, so it can never appear bare in a formula string --
    // exercise the registry function directly instead, per that constraint.
    assert.equal(FUNCTIONS.LOG10([1000]), 3);
    assert.equal(calc("=LOG(8,2)"), 3);
    assert.equal(errCode(calc("=LN(0)")), "#NUM!");
  });

  test("GCD/LCM", () => {
    assert.equal(calc("=GCD(12,18)"), 6);
    assert.equal(calc("=LCM(4,6)"), 12);
    assert.equal(calc("=LCM(0,5)"), 0);
    assert.equal(errCode(calc("=GCD(-1,2)")), "#NUM!");
  });

  test("FACT/COMBIN/PRODUCT", () => {
    assert.equal(calc("=FACT(5)"), 120);
    assert.equal(calc("=FACT(0)"), 1);
    assert.equal(calc("=COMBIN(5,2)"), 10);
    assert.equal(errCode(calc("=COMBIN(2,5)")), "#NUM!");
  });
});

// ---------------------------------------------------------------------------
describe("text: PROPER / TEXTJOIN / NUMBERVALUE / REPT / FIND / SEARCH / REPLACE / EXACT", () => {
  test("PROPER capitalizes each word", () => {
    assert.equal(calc('=PROPER("the QUICK brown-fox")'), "The Quick Brown-Fox");
  });

  test("TEXTJOIN: delimiter + ignore-empty flag", () => {
    const cells = { A1: "a", A2: "", A3: "c" };
    assert.equal(calc('=TEXTJOIN("-",TRUE,A1:A3)', cells), "a-c");
    assert.equal(calc('=TEXTJOIN("-",FALSE,A1:A3)', cells), "a--c");
  });

  test("NUMBERVALUE parses with custom separators", () => {
    assert.equal(calc('=NUMBERVALUE("1.234,56","," ,".")'), 1234.56);
    assert.equal(calc('=NUMBERVALUE("50%")'), 0.5);
  });

  test("REPT repeats text n times", () => {
    assert.equal(calc('=REPT("ab",3)'), "ababab");
    assert.equal(calc('=REPT("x",0)'), "");
  });

  test("FIND is case-sensitive, SEARCH is case-insensitive and wildcard-aware", () => {
    // "Hello World" contains an uppercase "W" but no lowercase "w".
    assert.equal(errCode(calc('=FIND("w","Hello World")')), "#VALUE!");
    assert.equal(calc('=FIND("W","Hello World")'), 7);
    assert.equal(calc('=FIND("o","Hello World")'), 5);
    assert.equal(calc('=SEARCH("w","Hello World")'), 7);
    assert.equal(calc('=SEARCH("l*d","Hello World")'), 3); // first "l" through the trailing "d"
  });

  test("REPLACE swaps a substring by position", () => {
    assert.equal(calc('=REPLACE("Hello World",7,5,"Excel")'), "Hello Excel");
  });

  test("EXACT is case-sensitive equality (unlike =)", () => {
    assert.equal(calc('=EXACT("Abc","abc")'), false);
    assert.equal(calc('=EXACT("Abc","Abc")'), true);
    assert.equal(calc('="Abc"="abc"'), true); // sanity: = stays case-insensitive
  });

  test("CLEAN/CHAR/CODE/UNICHAR", () => {
    assert.equal(calc('=CLEAN("a' + "\t" + 'b")'), "ab");
    assert.equal(calc("=CHAR(65)"), "A");
    assert.equal(calc('=CODE("A")'), 65);
    assert.equal(calc("=UNICHAR(65)"), "A");
  });
});

// ---------------------------------------------------------------------------
describe("dates: EOMONTH / EDATE / WEEKDAY / WEEKNUM / NETWORKDAYS / time parts", () => {
  test("EOMONTH returns the last day of the offset month", () => {
    assert.equal(calc('=TEXT(EOMONTH(DATE(2024,1,15),1),"yyyy-mm-dd")'), "2024-02-29"); // leap year
    assert.equal(calc('=TEXT(EOMONTH(DATE(2024,1,15),0),"yyyy-mm-dd")'), "2024-01-31");
  });

  test("EDATE clamps to the last valid day instead of rolling over", () => {
    assert.equal(calc('=TEXT(EDATE(DATE(2024,1,31),1),"yyyy-mm-dd")'), "2024-02-29");
  });

  test("WEEKDAY: type 1 (Sun=1) vs type 2 (Mon=1)", () => {
    // 2024-01-01 is a Monday
    assert.equal(calc("=WEEKDAY(DATE(2024,1,1),1)"), 2);
    assert.equal(calc("=WEEKDAY(DATE(2024,1,1),2)"), 1);
  });

  test("WEEKNUM: week containing Jan 1 is week 1", () => {
    assert.equal(calc("=WEEKNUM(DATE(2024,1,1),1)"), 1);
  });

  test("NETWORKDAYS excludes weekends and holidays", () => {
    const cells = { H1: "=DATE(2024,1,3)" };
    // 2024-01-01 (Mon) .. 2024-01-05 (Fri): 5 weekdays, minus one holiday
    assert.equal(calc("=NETWORKDAYS(DATE(2024,1,1),DATE(2024,1,5))"), 5);
    assert.equal(calc("=NETWORKDAYS(DATE(2024,1,1),DATE(2024,1,5),H1)", cells), 4);
  });

  test("HOUR/MINUTE/SECOND read the fractional part of a serial", () => {
    assert.equal(calc("=HOUR(0.5)"), 12);
    assert.equal(calc("=MINUTE(TIME(3,45,30))"), 45);
    assert.equal(calc("=SECOND(TIME(3,45,30))"), 30);
  });

  test("TIME wraps at 24 hours", () => {
    close(calc("=TIME(25,0,0)"), 1 / 24);
  });
});

// ---------------------------------------------------------------------------
describe("finance: PMT / FV / PV / NPER / RATE / NPV / IRR", () => {
  test("PMT: sign convention is cash outflow negative", () => {
    // $10,000 loan, 5%/yr paid monthly (~0.4167%/mo), 12 months
    const pmt = calc("=PMT(0.05/12,12,10000)");
    assert.ok(pmt < 0);
    close(pmt, -856.07, 0.5);
  });

  test("FV/PV round-trip: PV of a series' FV should recover the principal", () => {
    const fv = calc("=FV(0.06,10,0,-1000)");
    close(fv, 1790.85, 0.5);
    const pv = calc("=PV(0.06,10,0,1790.85)");
    close(pv, -1000, 0.5);
  });

  test("NPER solves for the number of periods", () => {
    close(calc("=NPER(0.06,0,-1000,1790.85)"), 10, 0.01);
  });

  test("RATE converges on a known cashflow", () => {
    close(calc("=RATE(10,0,-1000,1790.85)"), 0.06, 1e-4);
  });

  test("NPV discounts starting at period 1 (unlike a raw sum)", () => {
    const cells = { A1: -1000, A2: 500, A3: 500, A4: 500 };
    const npv = calc("=NPV(0.1,A2:A4)+A1", cells);
    close(npv, -1000 + 500 / 1.1 + 500 / 1.1 ** 2 + 500 / 1.1 ** 3, 1e-6);
  });

  test("IRR converges on a known cashflow", () => {
    const cells = { A1: -1000, A2: 500, A3: 500, A4: 500 };
    const irr = calc("=IRR(A1:A4)", cells);
    // verify: NPV at that rate should be ~0
    const npvCheck = -1000 + 500 / (1 + irr) + 500 / (1 + irr) ** 2 + 500 / (1 + irr) ** 3;
    close(npvCheck, 0, 1e-4);
  });

  test("IRR requires both a positive and a negative cash flow", () => {
    const cells = { A1: 100, A2: 200 };
    assert.equal(errCode(calc("=IRR(A1:A2)", cells)), "#NUM!");
  });
});
