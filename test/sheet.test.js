import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  colToLetters, lettersToCol, parseRef, refToA1, cellKey,
  parseRange, rangeToA1, rangeContains, translateRef, MAX_ROWS, MAX_COLS,
} from "../lib/sheet/cells.js";
import { parseFormula, translateFormula, ParseError } from "../lib/sheet/parser.js";
import {
  FormulaError, ERRORS, isError, toNumber, toText,
  valueEquals, valueCompare, dateToSerial, formatNumber, RangeValue, FUNCTIONS,
} from "../lib/sheet/functions.js";
import { evaluateAst, extractDependencies } from "../lib/sheet/evaluate.js";
import {
  createSheet, setCell, setCells, clearCell, getCell, getValue,
  getRangeValues, copyCell, formatValue, serializeSheet, deserializeSheet,
  loadCsv, usedRange,
} from "../lib/sheet/model.js";
import { parseCsv, serializeCsv, inferValue } from "../lib/sheet/csv.js";
import { pivotTable, pivotFromGrid, pivotToGrid, gridToRecords } from "../lib/sheet/pivot.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HMDA_CSV = readFileSync(join(__dirname, "../public/data/hmda-sample.csv"), "utf8");

/** Convenience: build a sheet, set cells, return computed value of a ref. */
function evalIn(cells, ref) {
  const sheet = createSheet();
  setCells(sheet, cells);
  return getValue(sheet, ref);
}

/** Evaluate a single formula against given literal cells. */
function calc(formula, cells = {}) {
  return evalIn({ ...cells, Z99: formula }, "Z99");
}

function errCode(v) {
  assert.ok(isError(v), `expected a FormulaError, got ${JSON.stringify(v)}`);
  return v.code;
}

// ---------------------------------------------------------------------------
describe("cells: addressing", () => {
  test("column letters round-trip", () => {
    assert.equal(colToLetters(0), "A");
    assert.equal(colToLetters(25), "Z");
    assert.equal(colToLetters(26), "AA");
    assert.equal(colToLetters(27), "AB");
    assert.equal(colToLetters(701), "ZZ");
    assert.equal(colToLetters(702), "AAA");
    assert.equal(lettersToCol("A"), 0);
    assert.equal(lettersToCol("z"), 25);
    assert.equal(lettersToCol("AA"), 26);
    assert.equal(lettersToCol("XFD"), MAX_COLS - 1);
  });

  test("parseRef handles absolute markers and case", () => {
    assert.deepEqual(parseRef("B7"), { row: 6, col: 1, absRow: false, absCol: false });
    assert.deepEqual(parseRef("$A$1"), { row: 0, col: 0, absRow: true, absCol: true });
    assert.deepEqual(parseRef("c$3"), { row: 2, col: 2, absRow: true, absCol: false });
    assert.equal(parseRef("1A"), null);
    assert.equal(parseRef("A0"), null);
    assert.equal(parseRef(""), null);
  });

  test("refToA1 and cellKey", () => {
    assert.equal(refToA1({ row: 6, col: 1, absRow: true, absCol: false }), "B$7");
    assert.equal(cellKey(0, 0), "A1");
    assert.equal(cellKey(100, 6), "G101");
  });

  test("parseRange: normal, degenerate, reversed, full-column", () => {
    assert.deepEqual(parseRange("A1:C10"), { top: 0, left: 0, bottom: 9, right: 2 });
    assert.deepEqual(parseRange("B2"), { top: 1, left: 1, bottom: 1, right: 1 });
    assert.deepEqual(parseRange("C10:A1"), { top: 0, left: 0, bottom: 9, right: 2 });
    assert.deepEqual(parseRange("B:B"), { top: null, left: 1, bottom: null, right: 1 });
    assert.equal(parseRange("nope"), null);
  });

  test("rangeToA1 round-trips", () => {
    assert.equal(rangeToA1(parseRange("A1:C10")), "A1:C10");
    assert.equal(rangeToA1(parseRange("B2")), "B2");
    assert.equal(rangeToA1(parseRange("B:D")), "B:D");
  });

  test("rangeContains, including full columns", () => {
    const r = parseRange("B2:D4");
    assert.ok(rangeContains(r, 1, 1));
    assert.ok(rangeContains(r, 3, 3));
    assert.ok(!rangeContains(r, 0, 1));
    assert.ok(!rangeContains(r, 2, 4));
    const col = parseRange("B:B");
    assert.ok(rangeContains(col, 999999, 1));
    assert.ok(!rangeContains(col, 0, 0));
  });

  test("translateRef respects $ anchors and sheet bounds", () => {
    const rel = parseRef("B2");
    assert.deepEqual(translateRef(rel, 2, 3), { row: 3, col: 4, absRow: false, absCol: false });
    const abs = parseRef("$B$2");
    assert.deepEqual(translateRef(abs, 2, 3), { row: 1, col: 1, absRow: true, absCol: true });
    assert.equal(translateRef(parseRef("A1"), -1, 0), null);
    assert.equal(translateRef(parseRef("A1"), MAX_ROWS, 0), null);
  });
});

// ---------------------------------------------------------------------------
describe("parser", () => {
  test("operator precedence: * over +, comparisons last", () => {
    assert.equal(calc("=2+3*4"), 14);
    assert.equal(calc("=(2+3)*4"), 20);
    assert.equal(calc("=1+2=3"), true);
    assert.equal(calc("=1&2"), "12");
    assert.equal(calc("=1+1&2+2"), "24"); // & binds looser than +
  });

  test("Excel quirk: unary minus binds tighter than ^", () => {
    assert.equal(calc("=-2^2"), 4);
    assert.equal(calc("=0-2^2"), -4);
    assert.equal(calc("=2^-1"), 0.5);
  });

  test("^ is left-associative", () => {
    assert.equal(calc("=2^3^2"), 64);
  });

  test("postfix percent", () => {
    assert.equal(calc("=50%"), 0.5);
    assert.equal(calc("=200%%"), 0.02);
    assert.equal(calc("=A1%", { A1: 200 }), 2);
  });

  test("string literals with escaped quotes", () => {
    assert.equal(calc("=\"say \"\"hi\"\"\""), "say \"hi\"");
  });

  test("comparison operators", () => {
    assert.equal(calc("=2<>3"), true);
    assert.equal(calc("=2>=2"), true);
    assert.equal(calc("=2<=1"), false);
  });

  test("parse errors throw ParseError", () => {
    assert.throws(() => parseFormula("=1+"), ParseError);
    assert.throws(() => parseFormula("=SUM(1,2"), ParseError);
    assert.throws(() => parseFormula("=\"unterminated"), ParseError);
  });

  test("bare unknown name evaluates to #NAME?", () => {
    assert.equal(errCode(calc("=notathing")), "#NAME?");
  });

  test("extractDependencies finds refs and ranges", () => {
    const deps = extractDependencies(parseFormula("=A1+SUM(B2:C3)*IF(D4>0,E5,1)"));
    assert.deepEqual(deps.cells.map((c) => cellKey(c.row, c.col)).sort(), ["A1", "D4", "E5"]);
    assert.equal(deps.ranges.length, 1);
    assert.deepEqual(deps.ranges[0], { top: 1, left: 1, bottom: 2, right: 2 });
  });

  test("translateFormula shifts relative refs, pins absolute parts", () => {
    assert.equal(translateFormula("=A1+$B$1*C$2", 3, 1), "=B4+$B$1*D$2");
    assert.equal(translateFormula("=SUM(A1:A10)", 0, 2), "=SUM(C1:C10)");
    assert.equal(translateFormula("=SUM($A$1:$A$10)", 5, 5), "=SUM($A$1:$A$10)");
  });

  test("translateFormula leaves strings alone and marks off-sheet refs #REF!", () => {
    assert.equal(translateFormula("=A1&\" A1 stays \"", 1, 0), "=A2&\" A1 stays \"");
    assert.equal(translateFormula("=A1", -1, 0), "=#REF!");
    assert.equal(translateFormula("=SUM(B:B)", 5, 2), "=SUM(D:D)");
    assert.equal(translateFormula("=SUM($B:$B)", 0, 3), "=SUM($B:$B)");
  });
});

// ---------------------------------------------------------------------------
describe("coercion and comparison semantics", () => {
  test("blank cell: 0 in arithmetic, \"\" in concat", () => {
    assert.equal(calc("=B9+5"), 5);
    assert.equal(calc("=\"x\"&B9"), "x");
  });

  test("numeric text coerces in arithmetic; junk text is #VALUE!", () => {
    assert.equal(calc("=\"3\"+4"), 7);
    assert.equal(errCode(calc("=\"a\"+1")), "#VALUE!");
  });

  test("booleans coerce to 1/0 in arithmetic", () => {
    assert.equal(calc("=TRUE+TRUE"), 2);
  });

  test("text equality is case-insensitive; number never equals its text", () => {
    assert.equal(calc("=\"apple\"=\"APPLE\""), true);
    assert.equal(calc("=\"3\"=3"), false);
  });

  test("cross-type ordering: number < text < boolean", () => {
    assert.equal(calc("=\"5\">10"), true);
    assert.equal(calc("=TRUE>\"zzz\""), true);
  });

  test("blank cell equals 0 and empty string", () => {
    assert.equal(calc("=B9=0"), true);
    assert.equal(calc("=B9=\"\""), true);
  });

  test("valueCompare / valueEquals directly", () => {
    assert.ok(valueCompare(2, 10) < 0);
    assert.ok(valueCompare("b", "A") > 0);
    assert.ok(valueEquals(undefined, ""));
    assert.ok(!valueEquals("3", 3));
  });

  test("toNumber / toText edge cases", () => {
    assert.equal(toNumber("50%"), 0.5);
    assert.equal(toNumber("1,250"), 1250);
    assert.equal(errCode(toNumber("")), "#VALUE!");
    assert.equal(toText(true), "TRUE");
    assert.equal(toText(undefined), "");
  });
});

// ---------------------------------------------------------------------------
describe("error propagation", () => {
  test("#DIV/0! from division and through aggregates", () => {
    assert.equal(errCode(calc("=1/0")), "#DIV/0!");
    assert.equal(errCode(calc("=SUM(A1:A2)", { A1: "=1/0", A2: 5 })), "#DIV/0!");
  });

  test("#NAME? for unknown functions", () => {
    assert.equal(errCode(calc("=FOO(1)")), "#NAME?");
  });

  test("#REF! survives translation into a copied formula", () => {
    const sheet = createSheet();
    setCells(sheet, { B2: "=A1", A1: 7 });
    copyCell(sheet, "B2", "B1"); // =A0 is off-sheet
    assert.equal(errCode(getValue(sheet, "B1")), "#REF!");
  });

  test("errors propagate through arithmetic left-to-right", () => {
    assert.equal(errCode(calc("=1/0+FOO()")), "#DIV/0!");
  });

  test("error literals can be typed and referenced", () => {
    assert.equal(errCode(calc("=A1", { A1: "#N/A" })), "#N/A");
  });

  test("IF only evaluates the taken branch", () => {
    assert.equal(calc("=IF(TRUE, 1, 1/0)"), 1);
    assert.equal(errCode(calc("=IF(FALSE, 1, 1/0)")), "#DIV/0!");
  });

  test("IFERROR catches, including #CIRCULAR!", () => {
    assert.equal(calc("=IFERROR(1/0, \"safe\")"), "safe");
    assert.equal(calc("=IFERROR(7, \"unused\")"), 7);
    const sheet = createSheet();
    setCells(sheet, { A1: "=A2", A2: "=A1", B1: "=IFERROR(A1, \"caught\")" });
    assert.equal(getValue(sheet, "B1"), "caught");
  });
});

// ---------------------------------------------------------------------------
describe("circular references", () => {
  test("direct self-reference", () => {
    assert.equal(errCode(evalIn({ A1: "=A1+1" }, "A1")), "#CIRCULAR!");
  });

  test("two-cell cycle marks both", () => {
    const sheet = createSheet();
    setCells(sheet, { A1: "=A2", A2: "=A1" });
    assert.equal(errCode(getValue(sheet, "A1")), "#CIRCULAR!");
    assert.equal(errCode(getValue(sheet, "A2")), "#CIRCULAR!");
  });

  test("cycle through a range", () => {
    const sheet = createSheet();
    setCell(sheet, "A1", "=SUM(A1:A3)");
    assert.equal(errCode(getValue(sheet, "A1")), "#CIRCULAR!");
  });

  test("breaking the cycle recovers", () => {
    const sheet = createSheet();
    setCells(sheet, { A1: "=A2", A2: "=A1" });
    setCell(sheet, "A2", 10);
    assert.equal(getValue(sheet, "A1"), 10);
    assert.equal(getValue(sheet, "A2"), 10);
  });

  test("downstream of a cycle propagates the error", () => {
    const sheet = createSheet();
    setCells(sheet, { A1: "=A2", A2: "=A1", B1: "=A1*2" });
    assert.equal(errCode(getValue(sheet, "B1")), "#CIRCULAR!");
  });

  test("cells 3+ hops downstream of an IFERROR guard settle out of the cycle", () => {
    const sheet = createSheet();
    setCells(sheet, {
      B1: 1000, B2: "=B3*0.1", B3: "=B2+B1",
      C1: "=IFERROR(B2, 0)", C2: "=C1*12", C3: "=C2+B1", C4: "=ROUND(C3, 2)",
    });
    assert.equal(errCode(getValue(sheet, "B2")), "#CIRCULAR!");
    assert.equal(errCode(getValue(sheet, "B3")), "#CIRCULAR!");
    assert.equal(getValue(sheet, "C1"), 0);
    assert.equal(getValue(sheet, "C2"), 0);
    assert.equal(getValue(sheet, "C3"), 1000);
    assert.equal(getValue(sheet, "C4"), 1000);
  });

  test("a long IFERROR-guarded chain downstream of a cycle settles end to end", () => {
    const sheet = createSheet();
    const entries = { A1: "=A2", A2: "=A1", B1: "=IFERROR(A1, 1)" };
    for (let i = 2; i <= 8; i++) entries[`B${i}`] = `=B${i - 1}+1`;
    setCells(sheet, entries);
    assert.equal(errCode(getValue(sheet, "A1")), "#CIRCULAR!");
    for (let i = 1; i <= 8; i++) {
      assert.equal(getValue(sheet, `B${i}`), i, `B${i} should settle to ${i}`);
    }
  });
});

// ---------------------------------------------------------------------------
describe("incremental recalc", () => {
  test("editing a precedent updates the whole dependent chain", () => {
    const sheet = createSheet();
    setCells(sheet, { A1: 10, A2: 20, A3: "=SUM(A1:A2)", A4: "=A3*2", A5: "=A4&\"!\"" });
    assert.equal(getValue(sheet, "A3"), 30);
    assert.equal(getValue(sheet, "A4"), 60);
    assert.equal(getValue(sheet, "A5"), "60!");
    setCell(sheet, "A1", 5);
    assert.equal(getValue(sheet, "A3"), 25);
    assert.equal(getValue(sheet, "A4"), 50);
    assert.equal(getValue(sheet, "A5"), "50!");
  });

  test("range dependents update when a member cell changes", () => {
    const sheet = createSheet();
    setCells(sheet, { B1: 1, B2: 2, B3: 3, C1: "=SUM(B1:B3)" });
    assert.equal(getValue(sheet, "C1"), 6);
    setCell(sheet, "B2", 100);
    assert.equal(getValue(sheet, "C1"), 104);
  });

  test("full-column ranges see newly added rows", () => {
    const sheet = createSheet();
    setCells(sheet, { E1: 5, E2: 6, G1: "=SUM(E:E)" });
    assert.equal(getValue(sheet, "G1"), 11);
    setCell(sheet, "E3", 9);
    assert.equal(getValue(sheet, "G1"), 20);
  });

  test("clearing a cell recalcs dependents", () => {
    const sheet = createSheet();
    setCells(sheet, { A1: 4, B1: "=A1*10" });
    clearCell(sheet, "A1");
    assert.equal(getValue(sheet, "B1"), 0); // blank = 0 in arithmetic
  });

  test("a 2000-cell dependency chain recalcs without blowing up", () => {
    const sheet = createSheet();
    const entries = { A1: 1 };
    for (let i = 2; i <= 2000; i++) entries[`A${i}`] = `=A${i - 1}+1`;
    setCells(sheet, entries);
    assert.equal(getValue(sheet, "A2000"), 2000);
    setCell(sheet, "A1", 101);
    assert.equal(getValue(sheet, "A2000"), 2100);
  });
});

// ---------------------------------------------------------------------------
describe("reference translation on copy (lesson topic)", () => {
  test("copy down shifts rows; $ pins", () => {
    const sheet = createSheet();
    setCells(sheet, {
      A1: 1, A2: 2, A3: 3,
      B1: 10,
      C1: "=A1*$B$1",
    });
    copyCell(sheet, "C1", "C2");
    copyCell(sheet, "C1", "C3");
    assert.equal(getCell(sheet, "C2").input, "=A2*$B$1");
    assert.equal(getValue(sheet, "C2"), 20);
    assert.equal(getValue(sheet, "C3"), 30);
  });

  test("copy across shifts columns", () => {
    const sheet = createSheet();
    setCells(sheet, { A1: 2, B1: 3, A2: "=A1^2" });
    copyCell(sheet, "A2", "B2");
    assert.equal(getCell(sheet, "B2").input, "=B1^2");
    assert.equal(getValue(sheet, "B2"), 9);
  });

  test("copying a literal copies it verbatim", () => {
    const sheet = createSheet();
    setCell(sheet, "A1", "hello");
    copyCell(sheet, "A1", "D4");
    assert.equal(getValue(sheet, "D4"), "hello");
  });

  test("copying a range formula past the top edge collapses the range to #REF!", () => {
    const sheet = createSheet();
    setCells(sheet, { B2: 5, B3: 7, C3: "=SUM(B2:B3)" });
    copyCell(sheet, "C3", "C1"); // range would become B0:B1
    assert.equal(getCell(sheet, "C1").input, "=SUM(#REF!)");
    assert.equal(errCode(getValue(sheet, "C1")), "#REF!");
  });

  test("copying a range formula past the left edge collapses the range to #REF!", () => {
    const sheet = createSheet();
    setCells(sheet, { B1: 2, C1: 4, D2: "=AVERAGE(B1:C1)" });
    copyCell(sheet, "D2", "B2"); // range would start two columns left of A
    assert.equal(getCell(sheet, "B2").input, "=AVERAGE(#REF!)");
    assert.equal(errCode(getValue(sheet, "B2")), "#REF!");
  });

  test("VLOOKUP table range off-sheet collapses to #REF! but other refs shift", () => {
    const sheet = createSheet();
    setCells(sheet, {
      A2: "x1", B2: "x1", C2: 91,
      D2: "=VLOOKUP(A2, B2:C4, 2, FALSE)",
    });
    copyCell(sheet, "D2", "D1"); // table would become B1:C3... lookup ref A1 stays on-sheet
    assert.equal(getCell(sheet, "D1").input, "=VLOOKUP(A1, B1:C3, 2, FALSE)");
    copyCell(sheet, "D2", "C1"); // shifted up AND left: table hits the top edge
    assert.equal(getCell(sheet, "C1").input, "=VLOOKUP(#REF!, A1:B3, 2, FALSE)");
  });

  test("translateFormula collapses ranges off every edge to a parseable #REF!", () => {
    assert.equal(translateFormula("=SUM(B2:B3)", -2, 0), "=SUM(#REF!)");
    assert.equal(translateFormula("=SUM(B2:C2)", 0, -2), "=SUM(#REF!)");
    assert.equal(translateFormula("=SUM(A1:A2)", MAX_ROWS - 1, 0), "=SUM(#REF!)");
    assert.equal(translateFormula("=SUM(A1:B1)", 0, MAX_COLS - 1), "=SUM(#REF!)");
    assert.equal(translateFormula("=SUM(B:B)", 0, -2), "=SUM(#REF!)");
    // absolute anchors keep an otherwise-doomed range alive
    assert.equal(translateFormula("=SUM($B$2:$B$3)", -5, 0), "=SUM($B$2:$B$3)");
  });
});

// ---------------------------------------------------------------------------
describe("functions: aggregation", () => {
  const nums = { A1: 10, A2: 20, A3: 30, A4: "text", A5: true };

  test("SUM ignores text/booleans in ranges but coerces scalar args", () => {
    assert.equal(calc("=SUM(A1:A5)", nums), 60);
    assert.equal(calc("=SUM(1, \"2\", TRUE)"), 4);
  });

  test("AVERAGE / MIN / MAX / MEDIAN", () => {
    assert.equal(calc("=AVERAGE(A1:A3)", nums), 20);
    assert.equal(calc("=MIN(A1:A3)", nums), 10);
    assert.equal(calc("=MAX(A1:A3)", nums), 30);
    assert.equal(calc("=MEDIAN(1,2,3,4)"), 2.5);
    assert.equal(calc("=MEDIAN(1,2,99)"), 2);
    assert.equal(errCode(calc("=AVERAGE(B1:B2)")), "#DIV/0!");
  });

  test("COUNT vs COUNTA", () => {
    assert.equal(calc("=COUNT(A1:A5)", nums), 3);
    assert.equal(calc("=COUNTA(A1:A5)", nums), 5);
    assert.equal(calc("=COUNTA(A1:A9)", nums), 5); // blanks don't count
  });

  test("COUNTIF: values, comparisons, wildcards", () => {
    const cells = { A1: "apple", A2: "apricot", A3: "banana", A4: 5, A5: 15 };
    assert.equal(calc("=COUNTIF(A1:A3, \"apple\")", cells), 1);
    assert.equal(calc("=COUNTIF(A1:A3, \"ap*\")", cells), 2);
    assert.equal(calc("=COUNTIF(A1:A3, \"?anana\")", cells), 1);
    assert.equal(calc("=COUNTIF(A4:A5, \">10\")", cells), 1);
    assert.equal(calc("=COUNTIF(A1:A5, \"<>apple\")", cells), 4);
  });

  test("SUMIF with separate sum range; SUMIFS multiple criteria", () => {
    const cells = {
      A1: "east", A2: "west", A3: "east",
      B1: 100, B2: 200, B3: 50,
      C1: "big", C2: "big", C3: "small",
    };
    assert.equal(calc("=SUMIF(A1:A3, \"east\", B1:B3)", cells), 150);
    assert.equal(calc("=SUMIF(B1:B3, \">75\")", cells), 300);
    assert.equal(calc("=SUMIFS(B1:B3, A1:A3, \"east\", C1:C3, \"big\")", cells), 100);
    assert.equal(calc("=COUNTIFS(A1:A3, \"east\", C1:C3, \"small\")", cells), 1);
    assert.equal(calc("=AVERAGEIFS(B1:B3, A1:A3, \"east\")", cells), 75);
  });

  test("AVERAGEIF with no matches is #DIV/0!", () => {
    assert.equal(errCode(calc("=AVERAGEIF(A1:A2, \"zzz\", B1:B2)", { A1: "x", A2: "y", B1: 1, B2: 2 })), "#DIV/0!");
  });
});

// ---------------------------------------------------------------------------
describe("functions: stats", () => {
  const data = { A1: 2, A2: 4, A3: 4, A4: 4, A5: 5, A6: 5, A7: 7, A8: 9 };

  test("STDEV.P and STDEV.S", () => {
    assert.equal(calc("=STDEV.P(A1:A8)", data), 2);
    const s = calc("=STDEV.S(A1:A8)", data);
    assert.ok(Math.abs(s - Math.sqrt(32 / 7)) < 1e-12);
    assert.equal(errCode(calc("=STDEV.S(A1:A1)", data)), "#DIV/0!");
  });

  test("VAR.S", () => {
    assert.ok(Math.abs(calc("=VAR.S(A1:A8)", data) - 32 / 7) < 1e-12);
  });

  test("CORREL: perfectly linear data gives 1, inverse gives -1", () => {
    const cells = { A1: 1, A2: 2, A3: 3, B1: 2, B2: 4, B3: 6, C1: 3, C2: 2, C3: 1 };
    assert.ok(Math.abs(calc("=CORREL(A1:A3, B1:B3)", cells) - 1) < 1e-12);
    assert.ok(Math.abs(calc("=CORREL(A1:A3, C1:C3)", cells) + 1) < 1e-12);
    assert.equal(errCode(calc("=CORREL(A1:A3, B1:B2)", cells)), "#N/A");
  });

  test("PERCENTILE and QUARTILE (inclusive, interpolated)", () => {
    const cells = { A1: 1, A2: 2, A3: 3, A4: 4 };
    assert.equal(calc("=PERCENTILE(A1:A4, 0.5)", cells), 2.5);
    assert.equal(calc("=PERCENTILE(A1:A4, 0)", cells), 1);
    assert.equal(calc("=PERCENTILE(A1:A4, 1)", cells), 4);
    assert.equal(calc("=QUARTILE(A1:A4, 1)", cells), 1.75);
    assert.equal(calc("=QUARTILE(A1:A4, 2)", cells), 2.5);
    assert.equal(errCode(calc("=PERCENTILE(A1:A4, 1.5)", cells)), "#NUM!");
    assert.equal(errCode(calc("=QUARTILE(A1:A4, 5)", cells)), "#NUM!");
  });
});

// ---------------------------------------------------------------------------
describe("functions: lookup", () => {
  const table = {
    A1: "id", B1: "name", C1: "score",
    A2: "x1", B2: "Ana", C2: 91,
    A3: "x2", B3: "Bo", C3: 74,
    A4: "x3", B4: "Cy", C4: 88,
  };

  test("VLOOKUP exact and approximate", () => {
    assert.equal(calc("=VLOOKUP(\"x2\", A2:C4, 2, FALSE)", table), "Bo");
    assert.equal(errCode(calc("=VLOOKUP(\"nope\", A2:C4, 2, FALSE)", table)), "#N/A");
    assert.equal(errCode(calc("=VLOOKUP(\"x2\", A2:C4, 9, FALSE)", table)), "#REF!");
    // approximate: largest first-column value <= lookup
    const bands = { A1: 0, A2: 60, A3: 80, B1: "F", B2: "C", B3: "A" };
    assert.equal(calc("=VLOOKUP(75, A1:B3, 2)", bands), "C");
    assert.equal(calc("=VLOOKUP(95, A1:B3, 2, TRUE)", bands), "A");
  });

  test("HLOOKUP", () => {
    const cells = { A1: "q1", B1: "q2", A2: 10, B2: 20 };
    assert.equal(calc("=HLOOKUP(\"q2\", A1:B2, 2, FALSE)", cells), 20);
  });

  test("XLOOKUP exact, if_not_found, right-to-left", () => {
    assert.equal(calc("=XLOOKUP(\"x3\", A2:A4, C2:C4)", table), 88);
    assert.equal(calc("=XLOOKUP(\"zz\", A2:A4, C2:C4, \"missing\")", table), "missing");
    assert.equal(errCode(calc("=XLOOKUP(\"zz\", A2:A4, C2:C4)", table)), "#N/A");
    // right-to-left: search scores, return ids
    assert.equal(calc("=XLOOKUP(74, C2:C4, A2:A4)", table), "x2");
  });

  test("XLOOKUP match modes and reverse search", () => {
    const cells = { A1: 10, A2: 20, A3: 30, B1: "a", B2: "b", B3: "c" };
    assert.equal(calc("=XLOOKUP(25, A1:A3, B1:B3, , -1)", cells), "b"); // next smaller
    assert.equal(calc("=XLOOKUP(25, A1:A3, B1:B3, , 1)", cells), "c");  // next larger
    assert.equal(calc("=XLOOKUP(\"b*\", B1:B3, A1:A3, , 2)", cells), 20); // wildcard
    const dup = { A1: "k", A2: "k", B1: 1, B2: 2 };
    assert.equal(calc("=XLOOKUP(\"k\", A1:A2, B1:B2, , 0, -1)", dup), 2); // last match
  });

  test("INDEX + MATCH, the classic combo", () => {
    assert.equal(calc("=INDEX(C2:C4, MATCH(\"x1\", A2:A4, 0))", table), 91);
    assert.equal(calc("=INDEX(A2:C4, 2, 2)", table), "Bo");
    assert.equal(errCode(calc("=INDEX(A2:C4, 9, 1)", table)), "#REF!");
    assert.equal(errCode(calc("=MATCH(\"zz\", A2:A4, 0)", table)), "#N/A");
    // MATCH type 1: largest <= lookup
    const cells = { A1: 10, A2: 20, A3: 30 };
    assert.equal(calc("=MATCH(25, A1:A3, 1)", cells), 2);
  });
});

// ---------------------------------------------------------------------------
describe("functions: logic", () => {
  test("IF / IFS", () => {
    assert.equal(calc("=IF(2>1, \"yes\", \"no\")"), "yes");
    assert.equal(calc("=IFS(FALSE, 1, TRUE, 2)"), 2);
    assert.equal(errCode(calc("=IFS(FALSE, 1, FALSE, 2)")), "#N/A");
  });

  test("zero-arg and partial-arg lazy function calls never throw", () => {
    // Every lazy function (IF, IFS, IFERROR) must surface a FormulaError
    // instead of throwing when called with too few arguments -- typing
    // "=IF(" and hitting enter is an ordinary thing a learner does.
    assert.equal(errCode(calc("=IF()")), "#VALUE!");
    assert.equal(calc("=IF(A1)"), false); // missing 2nd/3rd arg: blank condition -> FALSE
    assert.equal(calc("=IF(TRUE)"), true);

    // IFERROR's first arg is missing -> that's #VALUE!, which IFERROR itself
    // catches; with no 2nd arg to fall back to, its documented default is "".
    assert.equal(calc("=IFERROR()"), "");
    assert.equal(calc("=IFERROR(A1)"), undefined); // A1 is blank, not an error -> passes through

    assert.equal(errCode(calc("=IFS()")), "#N/A");
    assert.equal(errCode(calc("=IFS(A1)")), "#N/A");

    // Eager functions already tolerate a call with no arguments.
    assert.equal(calc("=SUM()"), 0);
  });

  test("AND / OR / NOT with ranges", () => {
    assert.equal(calc("=AND(TRUE, 1, 5>2)"), true);
    assert.equal(calc("=AND(TRUE, 0)"), false);
    assert.equal(calc("=OR(FALSE, 0, 1)"), true);
    assert.equal(calc("=NOT(FALSE)"), true);
    assert.equal(calc("=AND(A1:A3)", { A1: true, A2: 1, A3: true }), true);
  });

  test("ISBLANK / ISNUMBER / ISTEXT", () => {
    assert.equal(calc("=ISBLANK(B9)"), true);
    assert.equal(calc("=ISBLANK(A1)", { A1: 0 }), false);
    assert.equal(calc("=ISNUMBER(A1)", { A1: 3.5 }), true);
    assert.equal(calc("=ISNUMBER(A1)", { A1: "3.5x" }), false);
    assert.equal(calc("=ISTEXT(A1)", { A1: "hi" }), true);
    assert.equal(calc("=ISTEXT(A1)", { A1: 7 }), false);
  });
});

// ---------------------------------------------------------------------------
describe("functions: text", () => {
  test("CONCAT flattens ranges; CONCATENATE is an alias", () => {
    const cells = { A1: "a", A2: "b", A3: "c" };
    assert.equal(calc("=CONCAT(A1:A3, \"-\", 1)", cells), "abc-1");
    assert.equal(calc("=CONCATENATE(\"x\", \"y\")"), "xy");
  });

  test("LEFT / RIGHT / MID / LEN", () => {
    assert.equal(calc("=LEFT(\"finance\", 3)"), "fin");
    assert.equal(calc("=LEFT(\"finance\")"), "f");
    assert.equal(calc("=RIGHT(\"finance\", 4)"), "ance");
    assert.equal(calc("=MID(\"finance\", 4, 3)"), "anc");
    assert.equal(calc("=LEN(\"hello\")"), 5);
    assert.equal(errCode(calc("=MID(\"x\", 0, 1)")), "#VALUE!");
  });

  test("TRIM collapses interior spaces like Excel", () => {
    assert.equal(calc("=TRIM(\"  a   b  \")"), "a b");
  });

  test("UPPER / LOWER / SUBSTITUTE", () => {
    assert.equal(calc("=UPPER(\"abc\")"), "ABC");
    assert.equal(calc("=LOWER(\"ABC\")"), "abc");
    assert.equal(calc("=SUBSTITUTE(\"a-b-c\", \"-\", \"+\")"), "a+b+c");
    assert.equal(calc("=SUBSTITUTE(\"a-b-c\", \"-\", \"+\", 2)"), "a-b+c");
    assert.equal(calc("=SUBSTITUTE(\"a-b\", \"z\", \"+\")"), "a-b");
  });

  test("TEXT number formats", () => {
    assert.equal(calc("=TEXT(0.5625, \"0.0%\")"), "56.3%");
    assert.equal(calc("=TEXT(1234567.891, \"#,##0.00\")"), "1,234,567.89");
    assert.equal(calc("=TEXT(1234567.891, \"$#,##0.00\")"), "$1,234,567.89");
    assert.equal(calc("=TEXT(3.14159, \"0.00\")"), "3.14");
    assert.equal(calc("=TEXT(0.86, \"0%\")"), "86%");
  });

  test("TEXT date formats: every month renders intact for mmm and mmmm", () => {
    const short = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const long = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    for (let m = 1; m <= 12; m++) {
      assert.equal(calc(`=TEXT(DATE(2026,${m},15), "mmm")`), short[m - 1]);
      assert.equal(calc(`=TEXT(DATE(2026,${m},15), "mmmm")`), long[m - 1]);
    }
  });

  test("TEXT mixed date formats: substituted names never re-match later codes", () => {
    assert.equal(calc("=TEXT(DATE(2026,3,15), \"dd-mmm-yyyy\")"), "15-Mar-2026");
    assert.equal(calc("=TEXT(DATE(2026,12,25), \"mmm\")"), "Dec");
    assert.equal(calc("=TEXT(DATE(2026,5,1), \"mmm yyyy\")"), "May 2026");
    assert.equal(calc("=TEXT(DATE(2026,12,25), \"mmmm d, yyyy\")"), "December 25, 2026");
    assert.equal(calc("=TEXT(DATE(2026,7,4), \"yyyy-mm-dd\")"), "2026-07-04");
    assert.equal(calc("=TEXT(DATE(2026,7,4), \"m/d/yy\")"), "7/4/26");
  });

  test("VALUE", () => {
    assert.equal(calc("=VALUE(\"42.5\")"), 42.5);
    assert.equal(calc("=VALUE(\"85%\")"), 0.85);
    assert.equal(errCode(calc("=VALUE(\"abc\")")), "#VALUE!");
  });
});

// ---------------------------------------------------------------------------
describe("functions: math", () => {
  test("ROUND rounds half away from zero (Excel), including float traps", () => {
    assert.equal(calc("=ROUND(2.5, 0)"), 3);
    assert.equal(calc("=ROUND(-2.5, 0)"), -3);
    assert.equal(calc("=ROUND(2.675, 2)"), 2.68);
    assert.equal(calc("=ROUND(1234.5678, -2)"), 1200);
  });

  test("ROUNDUP / ROUNDDOWN move away from / toward zero", () => {
    assert.equal(calc("=ROUNDUP(2.01, 0)"), 3);
    assert.equal(calc("=ROUNDUP(-2.01, 0)"), -3);
    assert.equal(calc("=ROUNDDOWN(2.99, 0)"), 2);
    assert.equal(calc("=ROUNDDOWN(-2.99, 0)"), -2);
    assert.equal(calc("=ROUNDDOWN(0.599, 2)"), 0.59);
  });

  test("ABS / SQRT / POWER", () => {
    assert.equal(calc("=ABS(-4)"), 4);
    assert.equal(calc("=SQRT(16)"), 4);
    assert.equal(errCode(calc("=SQRT(-1)")), "#NUM!");
    assert.equal(calc("=POWER(2, 10)"), 1024);
    assert.equal(errCode(calc("=POWER(0, -1)")), "#DIV/0!");
  });
});

// ---------------------------------------------------------------------------
describe("functions: dates", () => {
  test("TODAY uses the sheet's injectable clock", () => {
    const sheet = createSheet();
    sheet.now = new Date(2026, 6, 15); // 2026-07-15
    setCells(sheet, { A1: "=TODAY()", A2: "=YEAR(TODAY())", A3: "=MONTH(TODAY())", A4: "=DAY(TODAY())" });
    assert.equal(getValue(sheet, "A1"), dateToSerial(new Date(2026, 6, 15)));
    assert.equal(getValue(sheet, "A2"), 2026);
    assert.equal(getValue(sheet, "A3"), 7);
    assert.equal(getValue(sheet, "A4"), 15);
  });

  test("YEAR/MONTH/DAY parse ISO and US date text", () => {
    assert.equal(calc("=YEAR(\"1999-12-31\")"), 1999);
    assert.equal(calc("=MONTH(\"7/15/2026\")"), 7);
    assert.equal(calc("=DAY(\"2026-07-04\")"), 4);
  });

  test("DATEDIF units", () => {
    assert.equal(calc("=DATEDIF(\"2000-03-15\", \"2026-07-15\", \"Y\")"), 26);
    assert.equal(calc("=DATEDIF(\"2000-03-15\", \"2026-07-15\", \"YM\")"), 4);
    assert.equal(calc("=DATEDIF(\"2000-03-15\", \"2026-07-15\", \"M\")"), 316);
    assert.equal(calc("=DATEDIF(\"2026-07-01\", \"2026-07-15\", \"D\")"), 14);
    assert.equal(calc("=DATEDIF(\"2026-01-10\", \"2026-03-05\", \"MD\")"), 23);
    assert.equal(errCode(calc("=DATEDIF(\"2026-07-15\", \"2000-01-01\", \"D\")")), "#NUM!");
  });
});

// ---------------------------------------------------------------------------
describe("model: input parsing, serialization, display", () => {
  test("input typing: numbers, booleans, forced text", () => {
    const sheet = createSheet();
    setCells(sheet, { A1: "42", A2: "TRUE", A3: "'0042", A4: "hello", A5: 3.5 });
    assert.equal(getValue(sheet, "A1"), 42);
    assert.equal(getValue(sheet, "A2"), true);
    assert.equal(getValue(sheet, "A3"), "0042");
    assert.equal(getValue(sheet, "A4"), "hello");
    assert.equal(getValue(sheet, "A5"), 3.5);
  });

  test("formatValue renders like a cell", () => {
    assert.equal(formatValue(undefined), "");
    assert.equal(formatValue(ERRORS.DIV0), "#DIV/0!");
    assert.equal(formatValue(true), "TRUE");
    assert.equal(formatValue(0.1 + 0.2), "0.3");
    assert.equal(formatValue("txt"), "txt");
  });

  test("malformed formulas evaluate to #VALUE!", () => {
    assert.equal(errCode(evalIn({ A1: "=1+" }, "A1")), "#VALUE!");
  });

  test("serialize/deserialize round-trips values and formulas", () => {
    const sheet = createSheet("Budget");
    setCells(sheet, { A1: 10, A2: "=A1*2", A3: "'007", A4: "=IF(A2>15, \"big\", \"small\")" });
    const json = JSON.parse(JSON.stringify(serializeSheet(sheet)));
    const restored = deserializeSheet(json);
    assert.equal(restored.name, "Budget");
    assert.equal(getValue(restored, "A2"), 20);
    assert.equal(getValue(restored, "A3"), "007");
    assert.equal(getValue(restored, "A4"), "big");
    assert.equal(getCell(restored, "A2").input, "=A1*2");
  });

  test("getRangeValues and usedRange", () => {
    const sheet = createSheet();
    setCells(sheet, { A1: 1, B2: "=A1+1" });
    assert.deepEqual(getRangeValues(sheet, "A1:B2"), [[1, undefined], [undefined, 2]]);
    assert.equal(usedRange(sheet), "A1:B2");
  });
});

// ---------------------------------------------------------------------------
describe("csv", () => {
  test("parses quoted fields, embedded commas/quotes/newlines, CRLF", () => {
    const text = "a,\"b,c\",\"say \"\"hi\"\"\"\r\n\"multi\nline\",2,";
    assert.deepEqual(parseCsv(text), [
      ["a", "b,c", "say \"hi\""],
      ["multi\nline", "2", ""],
    ]);
  });

  test("serialize round-trips", () => {
    const rows = [["a", "b,c", "say \"hi\""], ["x", "1", ""]];
    assert.deepEqual(parseCsv(serializeCsv(rows)), rows);
  });

  test("inferValue: numbers, booleans, leading-zero codes stay text", () => {
    assert.equal(inferValue("42"), 42);
    assert.equal(inferValue("-3.5"), -3.5);
    assert.equal(inferValue("TRUE"), true);
    assert.equal(inferValue("02138"), "02138"); // the zip-code gotcha
    assert.equal(inferValue("abc"), "abc");
    assert.equal(inferValue(""), undefined);
  });

  test("loads the real HMDA file with types intact", () => {
    const sheet = createSheet();
    const extent = loadCsv(sheet, HMDA_CSV);
    assert.equal(extent.rows, 101);
    assert.equal(extent.cols, 7);
    assert.equal(extent.range, "A1:G101");
    assert.equal(getValue(sheet, "A1"), "applicant_id");
    assert.equal(typeof getValue(sheet, "E2"), "number");   // loan_amount
    assert.equal(getValue(sheet, "D5"), "02138");           // Cambridge zip kept as text
  });
});

// ---------------------------------------------------------------------------
describe("pivot engine", () => {
  const records = [
    { region: "East", product: "A", units: 10, rep: "kim" },
    { region: "East", product: "B", units: 20, rep: "kim" },
    { region: "West", product: "A", units: 5, rep: "lee" },
    { region: "West", product: "A", units: 15, rep: "kim" },
    { region: "West", product: "B", units: 10, rep: "lee" },
  ];

  test("rows + cols + sum", () => {
    const r = pivotTable(records, {
      rows: ["region"], cols: ["product"],
      values: [{ field: "units", agg: "sum" }],
    });
    assert.deepEqual(r.rowKeys, [["East"], ["West"]]);
    assert.deepEqual(r.colKeys, [["A"], ["B"]]);
    assert.equal(r.cells[0][0][0], 10); // East/A
    assert.equal(r.cells[1][0][0], 20); // West/A = 5+15
    assert.deepEqual(r.rowTotals.map((t) => t[0]), [30, 30]);
    assert.deepEqual(r.colTotals.map((t) => t[0]), [30, 30]);
    assert.equal(r.grandTotals[0], 60);
  });

  test("aggs: count, average, min, max, countUnique", () => {
    const r = pivotTable(records, {
      rows: ["region"],
      values: [
        { field: "units", agg: "count" },
        { field: "units", agg: "average" },
        { field: "units", agg: "min" },
        { field: "units", agg: "max" },
        { field: "rep", agg: "countUnique" },
      ],
    });
    const west = r.cells[1][0];
    assert.deepEqual(west, [3, 10, 5, 15, 2]);
    assert.equal(r.grandTotals[1], 12); // average over all 5
    assert.equal(r.grandTotals[4], 2);  // kim + lee
  });

  test("filters restrict the source rows", () => {
    const r = pivotTable(records, {
      rows: ["region"],
      values: [{ field: "units", agg: "sum" }],
      filters: { rep: "kim" },
    });
    assert.equal(r.grandTotals[0], 45);
    const multi = pivotTable(records, {
      rows: ["region"],
      values: [{ field: "units", agg: "sum" }],
      filters: { product: ["A", "B"], rep: "lee" },
    });
    assert.equal(multi.grandTotals[0], 15);
  });

  test("empty intersections are null, not 0", () => {
    const sparse = [
      { g: "x", k: "p", v: 1 },
      { g: "y", k: "q", v: 2 },
    ];
    const r = pivotTable(sparse, {
      rows: ["g"], cols: ["k"],
      values: [{ field: "v", agg: "sum" }],
    });
    assert.equal(r.cells[0][1][0], null); // x/q never occurs
  });

  test("% of Column Total / Row Total / Grand Total", () => {
    const spec = (showAs) => ({
      rows: ["region"], cols: ["product"],
      values: [{ field: "units", agg: "sum", showAs }],
    });
    const col = pivotTable(records, spec("percentOfColumnTotal"));
    assert.equal(col.cells[0][0][0], 10 / 30);  // East A / A total
    assert.equal(col.colTotals[0][0], 1);
    const row = pivotTable(records, spec("percentOfRowTotal"));
    assert.equal(row.cells[0][1][0], 20 / 30);  // East B / East total
    assert.equal(row.rowTotals[0][0], 1);
    const grand = pivotTable(records, spec("percentOfGrandTotal"));
    assert.equal(grand.cells[1][0][0], 20 / 60);
    assert.equal(grand.grandTotals[0], 1);
  });

  test("subtotals for multi-level rows appear in the grid", () => {
    const r = pivotTable(records, {
      rows: ["region", "product"],
      values: [{ field: "units", agg: "sum" }],
    });
    const grid = pivotToGrid(r);
    const eastTotal = grid.find((row) => row[0] === "East Total");
    const westTotal = grid.find((row) => row[0] === "West Total");
    assert.ok(eastTotal, "East subtotal row exists");
    assert.equal(eastTotal[eastTotal.length - 1], 30);
    assert.equal(westTotal[westTotal.length - 1], 30);
    assert.equal(grid[grid.length - 1][0], "Grand Total");
    assert.equal(grid[grid.length - 1][grid[0].length - 1], 60);
  });

  test("gridToRecords maps header row and skips blank rows", () => {
    const recs = gridToRecords([
      ["a", "b"],
      [1, "x"],
      [undefined, undefined],
      [2, "y"],
    ]);
    assert.deepEqual(recs, [{ a: 1, b: "x" }, { a: 2, b: "y" }]);
  });
});

// ---------------------------------------------------------------------------
describe("end to end: the HMDA curriculum analysis", () => {
  // The COOP Advanced Excel capstone: load real lending data, pivot
  // rows=race / cols=approved with count, then show as percentages to
  // surface approval-rate disparities.

  function loadHmdaGrid() {
    const sheet = createSheet();
    const extent = loadCsv(sheet, HMDA_CSV);
    return { sheet, grid: getRangeValues(sheet, extent.range) };
  }

  test("formulas over the data agree with independent JS computation", () => {
    const { sheet } = loadHmdaGrid();
    setCells(sheet, {
      I1: "=COUNTIF(G2:G101, \"APPROVED\")",
      I2: "=COUNTIFS(B2:B101, \"Black\", G2:G101, \"APPROVED\")",
      I3: "=COUNTIF(B:B, \"White\")",
      I4: "=AVERAGEIF(G2:G101, \"APPROVED\", F2:F101)",
      I5: "=I2/COUNTIF(B2:B101, \"Black\")",
    });
    // independent computation straight from the CSV text
    const rows = parseCsv(HMDA_CSV).slice(1);
    const approved = rows.filter((r) => r[6] === "APPROVED");
    const black = rows.filter((r) => r[1] === "Black");
    const blackApproved = black.filter((r) => r[6] === "APPROVED");
    const avgIncomeApproved = approved.reduce((a, r) => a + Number(r[5]), 0) / approved.length;

    assert.equal(getValue(sheet, "I1"), approved.length);
    assert.equal(getValue(sheet, "I1"), 76); // concrete: 76 of 100 approved
    assert.equal(getValue(sheet, "I2"), blackApproved.length);
    assert.equal(getValue(sheet, "I2"), 9);
    assert.equal(getValue(sheet, "I3"), rows.filter((r) => r[1] === "White").length);
    assert.ok(Math.abs(getValue(sheet, "I4") - avgIncomeApproved) < 1e-9);
    assert.equal(getValue(sheet, "I5"), 9 / 16); // Black approval rate 56.25%
  });

  test("pivot: rows=race, cols=approved, count of applicant_id", () => {
    const { grid } = loadHmdaGrid();
    const r = pivotFromGrid(grid, {
      rows: ["race"],
      cols: ["approved"],
      values: [{ field: "applicant_id", agg: "count" }],
    });
    assert.deepEqual(r.rowKeys.map((k) => k[0]),
      ["American Indian", "Asian", "Black", "Hispanic", "Other", "White"]);
    assert.deepEqual(r.colKeys.map((k) => k[0]), ["APPROVED", "DENIED"]);
    const byRace = Object.fromEntries(r.rowKeys.map((k, i) => [k[0], r.cells[i].map((c) => c[0])]));
    assert.deepEqual(byRace.Black, [9, 7]);
    assert.deepEqual(byRace.White, [43, 7]);
    assert.deepEqual(byRace.Asian, [8, 2]);
    assert.deepEqual(byRace.Hispanic, [12, 6]);
    assert.deepEqual(r.colTotals.map((t) => t[0]), [76, 24]);
    assert.equal(r.grandTotals[0], 100);
  });

  test("% of Column Total: each race's share of approvals and denials", () => {
    const { grid } = loadHmdaGrid();
    const r = pivotFromGrid(grid, {
      rows: ["race"],
      cols: ["approved"],
      values: [{ field: "applicant_id", agg: "count", showAs: "percentOfColumnTotal" }],
    });
    const idx = Object.fromEntries(r.rowKeys.map((k, i) => [k[0], i]));
    assert.equal(r.cells[idx.White][0][0], 43 / 76);  // 56.6% of all approvals
    assert.equal(r.cells[idx.Black][0][0], 9 / 76);   // 11.8% of all approvals
    assert.equal(r.cells[idx.Black][1][0], 7 / 24);   // 29.2% of all denials
    assert.equal(r.colTotals[0][0], 1);
    assert.equal(r.grandTotals[0], 1);
  });

  test("% of Row Total: the approval rate per race (the teaching payoff)", () => {
    const { grid } = loadHmdaGrid();
    const r = pivotFromGrid(grid, {
      rows: ["race"],
      cols: ["approved"],
      values: [{ field: "applicant_id", agg: "count", showAs: "percentOfRowTotal" }],
    });
    const idx = Object.fromEntries(r.rowKeys.map((k, i) => [k[0], i]));
    assert.equal(r.cells[idx.Black][0][0], 0.5625);   // Black approval rate 56.25%
    assert.equal(r.cells[idx.White][0][0], 0.86);     // White approval rate 86%
    assert.equal(r.cells[idx.Asian][0][0], 0.8);
    assert.ok(Math.abs(r.cells[idx.Hispanic][0][0] - 12 / 18) < 1e-12);
    // grand total row carries the overall approval rate
    assert.equal(r.colTotals[0][0], 0.76);
  });

  test("pivot with average loan amount by race and gender, filtered", () => {
    const { grid } = loadHmdaGrid();
    const recs = gridToRecords(grid);
    const r = pivotTable(recs, {
      rows: ["race"],
      values: [{ field: "loan_amount", agg: "average" }],
      filters: { gender: "Female", approved: "APPROVED" },
    });
    // verify against independent computation
    const check = recs.filter((x) => x.gender === "Female" && x.approved === "APPROVED");
    const expected = check.reduce((a, x) => a + x.loan_amount, 0) / check.length;
    assert.ok(check.length > 0);
    assert.ok(Math.abs(r.grandTotals[0] - expected) < 1e-9);
  });

  test("pivotToGrid renders the full report grid", () => {
    const { grid } = loadHmdaGrid();
    const r = pivotFromGrid(grid, {
      rows: ["race"],
      cols: ["approved"],
      values: [{ field: "applicant_id", agg: "count" }],
    });
    const out = pivotToGrid(r);
    assert.equal(out.length, 8); // header + 6 races + grand total
    assert.equal(out[0][0], "race");
    assert.deepEqual(out[out.length - 1], ["Grand Total", 76, 24, 100]);
  });
});

// ---------------------------------------------------------------------------
describe("scale: ~5,000-row sheet stays responsive", () => {
  test("SUM over 5,000 rows plus a single-cell edit recalcs correctly and fast", () => {
    const sheet = createSheet();
    const entries = {};
    for (let i = 1; i <= 5000; i++) entries[`A${i}`] = i;
    entries.C1 = "=SUM(A1:A5000)";
    entries.C2 = "=AVERAGE(A:A)";
    entries.C3 = "=COUNTIF(A1:A5000, \">2500\")";
    setCells(sheet, entries);
    assert.equal(getValue(sheet, "C1"), (5000 * 5001) / 2);
    assert.equal(getValue(sheet, "C2"), 5001 / 2);
    assert.equal(getValue(sheet, "C3"), 2500);

    const start = performance.now();
    setCell(sheet, "A1", 1001);
    const elapsed = performance.now() - start;
    assert.equal(getValue(sheet, "C1"), (5000 * 5001) / 2 + 1000);
    assert.ok(elapsed < 500, `single-cell edit took ${elapsed.toFixed(1)}ms`);
  });
});

// ---------------------------------------------------------------------------
describe("direct evaluator API (for UI/grading layers)", () => {
  test("evaluateAst works against a custom context", () => {
    const ast = parseFormula("=A1+SUM(B1:B2)");
    const data = { "0,0": 1, "0,1": 2, "1,1": 3 };
    const ctx = {
      getCell: (row, col) => data[`${row},${col}`],
      getRange: (range) => {
        const values = [];
        for (let r = range.top; r <= range.bottom; r++) {
          const rowVals = [];
          for (let c = range.left; c <= range.right; c++) rowVals.push(data[`${r},${c}`]);
          values.push(rowVals);
        }
        return new RangeValue(values);
      },
    };
    assert.equal(evaluateAst(ast, ctx), 6);
  });

  test("FUNCTIONS registry is directly callable", () => {
    assert.equal(FUNCTIONS.SUM([new RangeValue([[1, 2], [3, 4]])]), 10);
    assert.equal(errCode(FUNCTIONS.SUM([ERRORS.NA])), "#N/A");
  });

  test("formatNumber standalone", () => {
    assert.equal(formatNumber(0.125, "0.0%"), "12.5%");
    assert.equal(formatNumber(1234.5, "#,##0"), "1,235");
  });

  test("FormulaError instances stringify to their code", () => {
    assert.equal(String(new FormulaError("#N/A")), "#N/A");
    assert.ok(isError(ERRORS.CIRCULAR));
  });
});
