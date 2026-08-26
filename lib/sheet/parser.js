// Formula tokenizer + recursive-descent parser -> AST.
// Implements Excel operator precedence (low to high):
//   comparison (= <> < <= > >=)  <  &  <  + -  <  * /  <  ^  <  unary -  <  postfix %
// Note the Excel quirk: unary minus binds TIGHTER than ^, so -2^2 = 4.
//
// AST node shapes:
//   { type: "number", value }        { type: "string", value }
//   { type: "boolean", value }       { type: "error", code }
//   { type: "ref", row, col, absRow, absCol }
//   { type: "range", top, left, bottom, right }   (top/bottom null = full column)
//   { type: "binary", op, left, right }
//   { type: "unary", op, operand }   { type: "percent", operand }
//   { type: "call", name, args }

import {
  parseRef, parseColRef, refToA1, colToLetters, translateRef, MAX_COLS,
} from "./cells.js";

const ERROR_LITERALS = [
  "#DIV/0!", "#N/A", "#NAME?", "#NULL!", "#NUM!", "#REF!", "#VALUE!", "#CIRCULAR!",
];

/** Thrown when a formula cannot be tokenized/parsed. */
export class ParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "ParseError";
  }
}

/**
 * Tokenize formula source (WITHOUT the leading "="). Each token records its
 * raw source slice so formulas can be reconstructed for ref translation.
 * Token types: number, string, word, ref, colref, error, op, open, close,
 * comma, colon.
 * @param {string} src
 * @returns {Array<{type: string, value: *, raw: string, pos: number}>}
 */
export function tokenize(src) {
  const tokens = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") { i++; continue; }
    const pos = i;
    // string literal, "" escapes a quote
    if (ch === "\"") {
      let out = "";
      i++;
      for (;;) {
        if (i >= n) throw new ParseError("Unterminated string literal");
        if (src[i] === "\"") {
          if (src[i + 1] === "\"") { out += "\""; i += 2; continue; }
          i++;
          break;
        }
        out += src[i++];
      }
      tokens.push({ type: "string", value: out, raw: src.slice(pos, i), pos });
      continue;
    }
    // number
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(src[i + 1] || ""))) {
      let j = i;
      while (j < n && /[0-9]/.test(src[j])) j++;
      if (src[j] === ".") { j++; while (j < n && /[0-9]/.test(src[j])) j++; }
      if (src[j] === "e" || src[j] === "E") {
        let k = j + 1;
        if (src[k] === "+" || src[k] === "-") k++;
        if (/[0-9]/.test(src[k] || "")) {
          k++;
          while (k < n && /[0-9]/.test(src[k])) k++;
          j = k;
        }
      }
      const raw = src.slice(i, j);
      tokens.push({ type: "number", value: parseFloat(raw), raw, pos });
      i = j;
      continue;
    }
    // error literal
    if (ch === "#") {
      const rest = src.slice(i).toUpperCase();
      const lit = ERROR_LITERALS.find((e) => rest.startsWith(e));
      if (!lit) throw new ParseError(`Unknown error literal at "${src.slice(i, i + 10)}"`);
      tokens.push({ type: "error", value: lit, raw: src.slice(i, i + lit.length), pos });
      i += lit.length;
      continue;
    }
    // word: refs, function names (may contain dots, e.g. STDEV.S), TRUE/FALSE
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_.$]/.test(src[j])) j++;
      const raw = src.slice(i, j);
      tokens.push({ type: "word", value: raw, raw, pos });
      i = j;
      continue;
    }
    // operators & punctuation
    const two = src.slice(i, i + 2);
    if (two === "<=" || two === ">=" || two === "<>") {
      tokens.push({ type: "op", value: two, raw: two, pos });
      i += 2;
      continue;
    }
    if ("+-*/^&%=<>".includes(ch)) {
      tokens.push({ type: "op", value: ch, raw: ch, pos });
      i++;
      continue;
    }
    if (ch === "(") { tokens.push({ type: "open", value: ch, raw: ch, pos }); i++; continue; }
    if (ch === ")") { tokens.push({ type: "close", value: ch, raw: ch, pos }); i++; continue; }
    if (ch === ",") { tokens.push({ type: "comma", value: ch, raw: ch, pos }); i++; continue; }
    if (ch === ":") { tokens.push({ type: "colon", value: ch, raw: ch, pos }); i++; continue; }
    throw new ParseError(`Unexpected character "${ch}" in formula`);
  }
  // classify words: cell refs, column refs (only next to a colon), else keep as word
  for (let t = 0; t < tokens.length; t++) {
    const tok = tokens[t];
    if (tok.type !== "word") continue;
    // A cell reference is never immediately followed by "(": that shape is
    // always a function call (e.g. LOG10(100)), even though "LOG10" alone
    // parses as a valid A1 reference (column LOG, row 10).
    const followedByOpen = tokens[t + 1] && tokens[t + 1].type === "open";
    const ref = followedByOpen ? null : parseRef(tok.value);
    if (ref) {
      tokens[t] = { type: "ref", value: ref, raw: tok.raw, pos: tok.pos };
      continue;
    }
    const colRef = parseColRef(tok.value);
    if (colRef) {
      const prevColon = tokens[t - 1] && tokens[t - 1].type === "colon";
      const nextColon = tokens[t + 1] && tokens[t + 1].type === "colon";
      if (prevColon || nextColon) {
        tokens[t] = { type: "colref", value: colRef, raw: tok.raw, pos: tok.pos };
      }
    }
  }
  return tokens;
}

/**
 * Parse a formula string into an AST. Accepts input with or without the
 * leading "=". Throws ParseError on malformed input.
 * @param {string} src
 * @returns {object} AST root node
 */
export function parseFormula(src) {
  let s = String(src);
  if (s.startsWith("=")) s = s.slice(1);
  const tokens = tokenize(s);
  if (tokens.length === 0) throw new ParseError("Empty formula");
  const state = { tokens, i: 0 };
  const ast = parseComparison(state);
  if (state.i < tokens.length) {
    throw new ParseError(`Unexpected token "${tokens[state.i].raw}"`);
  }
  return ast;
}

function peek(st) { return st.tokens[st.i]; }
function next(st) { return st.tokens[st.i++]; }

function isOp(tok, ...ops) {
  return tok && tok.type === "op" && ops.includes(tok.value);
}

function parseComparison(st) {
  let left = parseConcat(st);
  while (isOp(peek(st), "=", "<>", "<", "<=", ">", ">=")) {
    const op = next(st).value;
    const right = parseConcat(st);
    left = { type: "binary", op, left, right };
  }
  return left;
}

function parseConcat(st) {
  let left = parseAdditive(st);
  while (isOp(peek(st), "&")) {
    next(st);
    const right = parseAdditive(st);
    left = { type: "binary", op: "&", left, right };
  }
  return left;
}

function parseAdditive(st) {
  let left = parseMultiplicative(st);
  while (isOp(peek(st), "+", "-")) {
    const op = next(st).value;
    const right = parseMultiplicative(st);
    left = { type: "binary", op, left, right };
  }
  return left;
}

function parseMultiplicative(st) {
  let left = parseExponent(st);
  while (isOp(peek(st), "*", "/")) {
    const op = next(st).value;
    const right = parseExponent(st);
    left = { type: "binary", op, left, right };
  }
  return left;
}

function parseExponent(st) {
  let left = parseUnary(st);
  while (isOp(peek(st), "^")) {
    next(st);
    const right = parseUnary(st);
    left = { type: "binary", op: "^", left, right };
  }
  return left;
}

function parseUnary(st) {
  if (isOp(peek(st), "-")) {
    next(st);
    return { type: "unary", op: "-", operand: parseUnary(st) };
  }
  if (isOp(peek(st), "+")) {
    next(st);
    return { type: "unary", op: "+", operand: parseUnary(st) };
  }
  return parsePostfix(st);
}

function parsePostfix(st) {
  let node = parsePrimary(st);
  while (isOp(peek(st), "%")) {
    next(st);
    node = { type: "percent", operand: node };
  }
  return node;
}

function parsePrimary(st) {
  const tok = peek(st);
  if (!tok) throw new ParseError("Unexpected end of formula");

  if (tok.type === "number") { next(st); return { type: "number", value: tok.value }; }
  if (tok.type === "string") { next(st); return { type: "string", value: tok.value }; }
  if (tok.type === "error") { next(st); return { type: "error", code: tok.value }; }

  if (tok.type === "open") {
    next(st);
    const inner = parseComparison(st);
    const close = next(st);
    if (!close || close.type !== "close") throw new ParseError("Missing closing parenthesis");
    return inner;
  }

  if (tok.type === "ref") {
    next(st);
    // range: A1:B5
    if (peek(st) && peek(st).type === "colon") {
      next(st);
      const end = next(st);
      if (!end || end.type !== "ref") throw new ParseError("Malformed range");
      const a = tok.value;
      const b = end.value;
      return {
        type: "range",
        top: Math.min(a.row, b.row),
        left: Math.min(a.col, b.col),
        bottom: Math.max(a.row, b.row),
        right: Math.max(a.col, b.col),
      };
    }
    return { type: "ref", ...tok.value };
  }

  if (tok.type === "colref") {
    next(st);
    const colon = next(st);
    const end = next(st);
    if (!colon || colon.type !== "colon" || !end || end.type !== "colref") {
      throw new ParseError("Malformed column range");
    }
    return {
      type: "range",
      top: null,
      left: Math.min(tok.value.col, end.value.col),
      bottom: null,
      right: Math.max(tok.value.col, end.value.col),
    };
  }

  if (tok.type === "word") {
    const upper = tok.value.toUpperCase();
    if (upper === "TRUE" || upper === "FALSE") {
      next(st);
      return { type: "boolean", value: upper === "TRUE" };
    }
    // function call
    if (st.tokens[st.i + 1] && st.tokens[st.i + 1].type === "open") {
      next(st); // name
      next(st); // (
      const args = [];
      if (peek(st) && peek(st).type === "close") {
        next(st);
        return { type: "call", name: upper, args };
      }
      for (;;) {
        // empty argument slot, e.g. IF(A1>0,,5) or a trailing IF(A1,1,)
        if (peek(st) && (peek(st).type === "comma" || peek(st).type === "close")) {
          args.push({ type: "blank" });
        } else {
          args.push(parseComparison(st));
        }
        const sep = next(st);
        if (!sep) throw new ParseError("Missing closing parenthesis in call");
        if (sep.type === "close") break;
        if (sep.type !== "comma") throw new ParseError(`Unexpected token "${sep.raw}" in argument list`);
      }
      return { type: "call", name: upper, args };
    }
    // bare unknown name -> #NAME? at evaluation time
    next(st);
    return { type: "error", code: "#NAME?" };
  }

  throw new ParseError(`Unexpected token "${tok.raw}"`);
}

/** Translate one ref/colref token by (dRow, dCol); null when off-sheet. */
function translateEndpoint(tok, dRow, dCol) {
  if (tok.type === "ref") {
    const moved = translateRef(tok.value, dRow, dCol);
    return moved ? refToA1(moved) : null;
  }
  const col = tok.value.absCol ? tok.value.col : tok.value.col + dCol;
  if (col < 0 || col >= MAX_COLS) return null;
  return (tok.value.absCol ? "$" : "") + colToLetters(col);
}

/**
 * Translate a formula string for copy/paste to a cell (dRow, dCol) away.
 * Relative refs shift; $-absolute parts stay put; refs that fall off the
 * sheet become the literal #REF! error, exactly like Excel. When either
 * endpoint of a range falls off the sheet the ENTIRE range collapses to
 * #REF! (Excel behavior), keeping the result parseable.
 * Accepts input with or without the leading "="; the leading "=" is
 * preserved if present.
 * @param {string} src
 * @param {number} dRow
 * @param {number} dCol
 * @returns {string}
 */
export function translateFormula(src, dRow, dCol) {
  let s = String(src);
  let prefix = "";
  if (s.startsWith("=")) { prefix = "="; s = s.slice(1); }
  const tokens = tokenize(s);
  const isEndpoint = (t) => t && (t.type === "ref" || t.type === "colref");
  let out = "";
  let last = 0;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    out += s.slice(last, tok.pos);
    if (isEndpoint(tok) && tokens[i + 1] && tokens[i + 1].type === "colon" && isEndpoint(tokens[i + 2])) {
      // range: translate both endpoints; collapse the whole token if either
      // falls off the sheet so the result stays a legal formula
      const end = tokens[i + 2];
      const a = translateEndpoint(tok, dRow, dCol);
      const b = translateEndpoint(end, dRow, dCol);
      out += (a === null || b === null) ? "#REF!" : a + ":" + b;
      last = end.pos + end.raw.length;
      i += 2;
      continue;
    }
    if (tok.type === "ref" || tok.type === "colref") {
      const moved = translateEndpoint(tok, dRow, dCol);
      out += moved === null ? "#REF!" : moved;
    } else {
      out += tok.raw;
    }
    last = tok.pos + tok.raw.length;
  }
  out += s.slice(last);
  return prefix + out;
}
