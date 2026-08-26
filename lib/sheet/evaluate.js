// AST evaluator + dependency extraction. The Sheet model (model.js) owns the
// dependency graph and recalc ordering; this module evaluates one formula
// against a cell-access context.
//
// Context shape:
//   {
//     getCell(row, col) -> value      (undefined = blank cell)
//     getRange(rangeNode) -> RangeValue  (must clamp full-column ranges)
//     now?: Date                      (injectable clock for TODAY)
//   }

import {
  FUNCTIONS, ERRORS, errorFromCode, isError, isRange, RangeValue,
  toNumber, toText, valueEquals, valueCompare,
} from "./functions.js";

/**
 * Evaluate a parsed formula AST against a cell-access context.
 * Errors flow back as FormulaError values, never as exceptions.
 * @param {object} ast node from parser.js
 * @param {{getCell: Function, getRange: Function, now?: Date}} ctx
 * @returns {*} number | string | boolean | undefined | FormulaError | RangeValue
 */
export function evaluateAst(ast, ctx) {
  switch (ast.type) {
    case "number":
      return ast.value;
    case "string":
      return ast.value;
    case "boolean":
      return ast.value;
    case "blank":
      return undefined;
    case "error":
      return errorFromCode(ast.code);
    case "ref":
      return ctx.getCell(ast.row, ast.col);
    case "range":
      return ctx.getRange(ast);
    case "unary": {
      const v = evaluateAst(ast.operand, ctx);
      if (isError(v)) return v;
      if (ast.op === "+") return v; // Excel: unary + is a no-op, even on text
      const n = toNumber(v);
      return isError(n) ? n : -n;
    }
    case "percent": {
      const v = evaluateAst(ast.operand, ctx);
      const n = toNumber(v);
      return isError(n) ? n : n / 100;
    }
    case "binary":
      return evalBinary(ast, ctx);
    case "call":
      return evalCall(ast, ctx);
    default:
      return ERRORS.VALUE;
  }
}

function evalBinary(ast, ctx) {
  const a = evaluateAst(ast.left, ctx);
  const b = evaluateAst(ast.right, ctx);
  if (isError(a)) return a;
  if (isError(b)) return b;
  const op = ast.op;

  if (op === "&") {
    const ta = toText(a);
    if (isError(ta)) return ta;
    const tb = toText(b);
    if (isError(tb)) return tb;
    return ta + tb;
  }

  if (op === "=" || op === "<>" || op === "<" || op === "<=" || op === ">" || op === ">=") {
    const sa = collapseScalar(a);
    const sb = collapseScalar(b);
    if (isError(sa)) return sa;
    if (isError(sb)) return sb;
    if (op === "=") return valueEquals(sa, sb);
    if (op === "<>") return !valueEquals(sa, sb);
    const c = valueCompare(sa, sb);
    if (op === "<") return c < 0;
    if (op === "<=") return c <= 0;
    if (op === ">") return c > 0;
    return c >= 0;
  }

  const na = toNumber(a);
  if (isError(na)) return na;
  const nb = toNumber(b);
  if (isError(nb)) return nb;
  switch (op) {
    case "+": return na + nb;
    case "-": return na - nb;
    case "*": return na * nb;
    case "/": return nb === 0 ? ERRORS.DIV0 : na / nb;
    case "^": {
      const r = Math.pow(na, nb);
      if (Number.isNaN(r)) return ERRORS.NUM;
      if (!Number.isFinite(r)) return na === 0 && nb < 0 ? ERRORS.DIV0 : ERRORS.NUM;
      return r;
    }
    default:
      return ERRORS.VALUE;
  }
}

function collapseScalar(v) {
  if (isRange(v)) {
    if (v.rows === 1 && v.cols === 1) return v.values[0][0];
    return ERRORS.VALUE;
  }
  return v;
}

function evalCall(ast, ctx) {
  const fn = FUNCTIONS[ast.name];
  if (!fn) return ERRORS.NAME;
  if (fn.lazy) {
    // A missing argument slot (e.g. `=IF()` parses to args: []) is distinct
    // from an explicit blank slot (`=IF(A1,,5)` -> {type:"blank"}, which
    // evaluateAst already turns into `undefined`). Calling evaluateAst on a
    // genuinely absent AST node throws, so surface it as #VALUE! instead --
    // every lazy function already has an isError() short-circuit on its
    // evalArg() results, so this propagates the same way a real formula
    // error would, without ever throwing.
    const evalArg = (argAst) => (argAst === undefined ? ERRORS.VALUE : evaluateAst(argAst, ctx));
    return fn.call(ast.args, evalArg, ctx);
  }
  const args = ast.args.map((a) => (a.type === "blank" ? undefined : evaluateAst(a, ctx)));
  return fn(args, ctx);
}

/**
 * Walk an AST and collect every cell and range it references.
 * @param {object} ast
 * @returns {{cells: Array<{row: number, col: number}>, ranges: Array<{top: number|null, left: number, bottom: number|null, right: number}>}}
 */
export function extractDependencies(ast) {
  const cells = [];
  const ranges = [];
  walk(ast, cells, ranges);
  return { cells, ranges };
}

function walk(node, cells, ranges) {
  if (!node || typeof node !== "object") return;
  switch (node.type) {
    case "ref":
      cells.push({ row: node.row, col: node.col });
      return;
    case "range":
      ranges.push({ top: node.top, left: node.left, bottom: node.bottom, right: node.right });
      return;
    case "unary":
    case "percent":
      walk(node.operand, cells, ranges);
      return;
    case "binary":
      walk(node.left, cells, ranges);
      walk(node.right, cells, ranges);
      return;
    case "call":
      for (const a of node.args) walk(a, cells, ranges);
      return;
    default:
  }
}

export { RangeValue };
