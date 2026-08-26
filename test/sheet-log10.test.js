// Regression test: a function name that also matches the cell-reference
// pattern (letters followed by digits, e.g. LOG10) must still be callable
// as a function when immediately followed by "(", while the bare name with
// no parens must keep parsing as a cell reference exactly as before.
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { parseFormula } from "../lib/sheet/parser.js";
import { evaluateAst } from "../lib/sheet/evaluate.js";

const emptyCtx = {
  getCell: () => undefined,
  getRange: () => { throw new Error("not needed for this test"); },
};

describe("function names that collide with cell-reference shape", () => {
  test("LOG10(100) parses as a call and evaluates to 2", () => {
    const ast = parseFormula("=LOG10(100)");
    assert.equal(ast.type, "call");
    assert.equal(ast.name, "LOG10");
    assert.equal(evaluateAst(ast, emptyCtx), 2);
  });

  test("bare LOG10 with no parens still parses as a cell reference", () => {
    const ast = parseFormula("=LOG10");
    assert.equal(ast.type, "ref");
    assert.equal(ast.row, 9); // 0-indexed row 10
  });

  test("any ref-shaped word followed by ( is a call, not just LOG10", () => {
    // AB99 has the exact shape of a cell reference (letters then digits) but
    // is not a real function; it must still parse as a call node (and then
    // fail at evaluation with #NAME?, same as any other unknown function).
    const ast = parseFormula("=AB99(1)");
    assert.equal(ast.type, "call");
    assert.equal(ast.name, "AB99");
    const result = evaluateAst(ast, emptyCtx);
    assert.equal(result && result.code, "#NAME?");
  });
});
