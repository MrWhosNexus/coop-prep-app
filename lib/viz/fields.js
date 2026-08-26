// Field model for the viz engine: type inference, the dimension/measure split,
// and calculated fields. Pure — no DOM, no React, safe under `node --test`.
//
// Tableau's core mental model lives here: every column of a data source becomes a
// FIELD, and every field is either a DIMENSION (it slices data into groups) or a
// MEASURE (it aggregates into a number). Getting that split right is most of what
// the Tableau module is teaching.

/** Value types we can infer from raw cell strings. */
export const FieldType = {
  STRING: "string",
  NUMBER: "number",
  DATE: "date",
  BOOLEAN: "boolean",
};

/** Tableau's two field roles. Dimensions slice; measures aggregate. */
export const FieldRole = {
  DIMENSION: "dimension",
  MEASURE: "measure",
};

// Numeric-looking columns that are really labels, not quantities. Summing a ZIP
// code or averaging an applicant ID is meaningless — Tableau special-cases these
// via geographic/identifier detection, so we do too.
const IDENTIFIER_PATTERN = /(^|_)(id|ids|code|zip|zipcode|postal|fips|year|key|number|no|num|tract|census)$/i;

const TRUE_VALUES = new Set(["true", "yes", "y", "t"]);
const FALSE_VALUES = new Set(["false", "no", "n", "f"]);

// ISO-ish dates only. We deliberately do NOT hand arbitrary strings to `new Date`
// — that would make "Other" or "A0001" parse as a date on some engines.
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?/;
const ISO_DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const SLASH_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/**
 * True when `value` should be treated as absent (null/undefined/""/whitespace).
 * @param {*} value
 * @returns {boolean}
 */
export function isBlank(value) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

/**
 * Parse a cell into a number, or null when it isn't numeric.
 * Tolerates thousands separators, currency symbols and percent signs.
 * @param {*} value
 * @returns {number|null}
 */
export function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (isBlank(value) || typeof value !== "string") return null;
  const cleaned = value.trim().replace(/[$,\s]/g, "").replace(/%$/, "");
  if (cleaned === "" || cleaned === "-" || cleaned === "+") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// One calendar date → the instant we file it under. A bare date names a day, not
// a moment: it carries no zone, so there is no honest local instant to pick and
// any choice of one makes the value depend on who is looking. We anchor every
// date-only value to UTC midnight — the interpretation `new Date("2024-01-05")`
// already gives ISO dates, now applied to slash dates too. Building it by hand
// rather than by string is what makes that unconditional: `new Date("2024-1-5")`
// is not ISO, so engines fall back to LOCAL midnight, which is how "1/5/2024"
// and "01/05/2024" — one day, two spellings — used to land on two instants and
// bucket one day twice for anyone west of UTC.
function utcMidnight(year, month, day) {
  const d = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC maps years 0-99 into the 1900s; undo that so a four-digit year is
  // the year asked for.
  if (year >= 0 && year <= 99) d.setUTCFullYear(year);
  if (Number.isNaN(d.getTime())) return null;
  // Date.UTC silently rolls 2024-02-31 forward into March. A date that rolls is
  // a typo, and inferType relies on a typo failing to parse to keep the column
  // a string rather than quietly inventing days.
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d;
}

/**
 * Parse a cell into a Date, or null when it isn't a recognisable date.
 * Date-only values (ISO or US slash) are anchored to UTC midnight; a value that
 * also carries a clock time keeps that time as written.
 * @param {*} value
 * @returns {Date|null}
 */
export function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (isBlank(value) || typeof value !== "string") return null;
  const s = value.trim();

  const slash = SLASH_DATE_PATTERN.exec(s);
  if (slash) return utcMidnight(Number(slash[3]), Number(slash[1]), Number(slash[2]));

  const iso = ISO_DATE_ONLY_PATTERN.exec(s);
  if (iso) return utcMidnight(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  if (!DATE_PATTERN.test(s)) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Infer the value type of a column from its non-blank values.
 * Every non-blank value must agree, otherwise the column falls back to STRING —
 * one stray "N/A" in a numeric column is exactly how real data arrives.
 * @param {Array<*>} values
 * @returns {string} a FieldType
 */
export function inferType(values) {
  const present = values.filter((v) => !isBlank(v));
  if (present.length === 0) return FieldType.STRING;

  if (present.every((v) => toNumber(v) !== null)) return FieldType.NUMBER;
  if (present.every((v) => toDate(v) !== null)) return FieldType.DATE;
  if (
    present.every((v) => {
      const s = String(v).trim().toLowerCase();
      return TRUE_VALUES.has(s) || FALSE_VALUES.has(s);
    })
  ) {
    return FieldType.BOOLEAN;
  }
  return FieldType.STRING;
}

/**
 * Decide whether a field is a dimension or a measure.
 * Numbers aggregate (measure) unless the name marks them as an identifier.
 * @param {string} name
 * @param {string} type a FieldType
 * @returns {string} a FieldRole
 */
export function inferRole(name, type) {
  if (type !== FieldType.NUMBER) return FieldRole.DIMENSION;
  return IDENTIFIER_PATTERN.test(String(name)) ? FieldRole.DIMENSION : FieldRole.MEASURE;
}

/**
 * The aggregation Tableau reaches for by default when a field lands on a shelf.
 * Measures SUM; dimensions used as measures COUNT.
 * @param {string} type a FieldType
 * @param {string} role a FieldRole
 * @returns {string} an Aggregation name
 */
export function defaultAggregation(type, role) {
  if (role === FieldRole.MEASURE) return "SUM";
  return "COUNT";
}

/**
 * Build a field descriptor.
 * @param {string} name
 * @param {string} type a FieldType
 * @param {string} [role] a FieldRole; inferred from name+type when omitted
 * @returns {{name:string,type:string,role:string,defaultAggregation:string,calculated:boolean,expression:(string|null)}}
 */
export function makeField(name, type, role) {
  const resolvedRole = role || inferRole(name, type);
  return {
    name,
    type,
    role: resolvedRole,
    defaultAggregation: defaultAggregation(type, resolvedRole),
    calculated: false,
    expression: null,
  };
}

/**
 * Infer the full field list for a row set — the "data pane" of the viz builder.
 * @param {Array<Object>} rows
 * @returns {Array<Object>} field descriptors, in column order
 */
export function inferFields(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const names = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        names.push(key);
      }
    }
  }
  return names.map((name) => makeField(name, inferType(rows.map((r) => r[name]))));
}

/** @param {Object} field @returns {boolean} */
export function isDimension(field) {
  return field?.role === FieldRole.DIMENSION;
}

/** @param {Object} field @returns {boolean} */
export function isMeasure(field) {
  return field?.role === FieldRole.MEASURE;
}

/**
 * Find a field by name.
 * @param {Array<Object>} fields
 * @param {string} name
 * @returns {Object|undefined}
 */
export function findField(fields, name) {
  return fields.find((f) => f.name === name);
}

/**
 * Coerce a raw cell to its field type, for consistent grouping/aggregating.
 * @param {*} value
 * @param {string} type a FieldType
 * @returns {*}
 */
export function coerceValue(value, type) {
  if (isBlank(value)) return null;
  if (type === FieldType.NUMBER) return toNumber(value);
  if (type === FieldType.DATE) return toDate(value);
  if (type === FieldType.BOOLEAN) return TRUE_VALUES.has(String(value).trim().toLowerCase());
  return String(value);
}

/**
 * Coerce every cell of every row according to `fields`. Cheap enough for the
 * teaching datasets, and it keeps aggregation from re-parsing strings per pass.
 * @param {Array<Object>} rows
 * @param {Array<Object>} fields
 * @returns {Array<Object>}
 */
export function coerceRows(rows, fields) {
  return rows.map((row) => {
    const out = {};
    for (const f of fields) out[f.name] = coerceValue(row[f.name], f.type);
    return out;
  });
}

/**
 * Minimal RFC4180-ish CSV reader, so lessons can load the real HMDA extract with
 * no dependency. Handles quoted fields, escaped quotes and CRLF.
 * @param {string} text
 * @returns {Array<Object>} rows keyed by header name
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  let started = false;

  const endCell = () => {
    row.push(started && quoted ? cell : cell.trim());
    cell = "";
    quoted = false;
    started = false;
  };
  const endRow = () => {
    endCell();
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && !started) {
      quoted = true;
      started = true;
    } else if (ch === ",") {
      endCell();
    } else if (ch === "\n") {
      endRow();
    } else if (ch !== "\r") {
      cell += ch;
      started = true;
    }
  }
  if (cell !== "" || row.length > 0) endRow();

  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((cells) =>
    Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]))
  );
}

// ---------------------------------------------------------------------------
// Calculated fields
//
// A small, closed expression language. We hand-roll a tokenizer + recursive
// descent parser rather than touching `eval`/`new Function`: user-authored
// formulas are untrusted input, and an AST we walk ourselves can only ever do
// what the FUNCTIONS table below allows.
// ---------------------------------------------------------------------------

const KEYWORD_OPERATORS = { AND: "&&", OR: "||", NOT: "!" };

/**
 * Functions callable from a calculated field. Each receives already-evaluated
 * arguments. Adding to this table is the ONLY way to widen the language.
 */
const FUNCTIONS = {
  IF: (cond, a, b) => (truthy(cond) ? a : b === undefined ? null : b),
  IFNULL: (a, b) => (a === null || a === undefined ? b : a),
  ABS: (n) => Math.abs(num(n)),
  ROUND: (n, digits) => {
    const p = Math.pow(10, digits === undefined ? 0 : Math.trunc(num(digits)));
    return Math.round(num(n) * p) / p;
  },
  FLOOR: (n) => Math.floor(num(n)),
  CEILING: (n) => Math.ceil(num(n)),
  MIN: (...args) => Math.min(...args.map(num)),
  MAX: (...args) => Math.max(...args.map(num)),
  SQRT: (n) => Math.sqrt(num(n)),
  UPPER: (s) => String(s ?? "").toUpperCase(),
  LOWER: (s) => String(s ?? "").toLowerCase(),
  TRIM: (s) => String(s ?? "").trim(),
  LEN: (s) => String(s ?? "").length,
  CONTAINS: (s, sub) => String(s ?? "").includes(String(sub ?? "")),
  STARTSWITH: (s, sub) => String(s ?? "").startsWith(String(sub ?? "")),
  ENDSWITH: (s, sub) => String(s ?? "").endsWith(String(sub ?? "")),
  ISNULL: (v) => v === null || v === undefined,
  NUMBER: (v) => toNumber(v),
  STR: (v) => String(v ?? ""),
};

function num(v) {
  const n = typeof v === "number" ? v : toNumber(v);
  if (n === null) return NaN;
  return n;
}

function truthy(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v !== "" && !FALSE_VALUES.has(v.toLowerCase());
  return Boolean(v);
}

/** Tokenizer. Emits {type, value} tokens; throws on unknown characters. */
function tokenize(src) {
  const tokens = [];
  let i = 0;
  const isDigit = (c) => c >= "0" && c <= "9";
  const isIdentStart = (c) => /[A-Za-z_]/.test(c);
  const isIdent = (c) => /[A-Za-z0-9_.]/.test(c);

  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    // [Bracketed Field Name] — the Tableau way to reference a column.
    if (c === "[") {
      const end = src.indexOf("]", i + 1);
      if (end === -1) throw new SyntaxError("Unclosed [ in expression");
      tokens.push({ type: "field", value: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if (c === '"' || c === "'") {
      let s = "";
      i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === "\\" && i + 1 < src.length) {
          s += src[i + 1];
          i += 2;
        } else {
          s += src[i++];
        }
      }
      if (i >= src.length) throw new SyntaxError("Unterminated string in expression");
      i++;
      tokens.push({ type: "string", value: s });
      continue;
    }
    if (isDigit(c) || (c === "." && isDigit(src[i + 1]))) {
      let s = "";
      while (i < src.length && (isDigit(src[i]) || src[i] === ".")) s += src[i++];
      tokens.push({ type: "number", value: Number(s) });
      continue;
    }
    if (isIdentStart(c)) {
      let s = "";
      while (i < src.length && isIdent(src[i])) s += src[i++];
      const upper = s.toUpperCase();
      if (KEYWORD_OPERATORS[upper]) tokens.push({ type: "op", value: KEYWORD_OPERATORS[upper] });
      else if (upper === "TRUE") tokens.push({ type: "boolean", value: true });
      else if (upper === "FALSE") tokens.push({ type: "boolean", value: false });
      else if (upper === "NULL") tokens.push({ type: "null", value: null });
      else tokens.push({ type: "ident", value: s });
      continue;
    }
    const two = src.slice(i, i + 2);
    if (["<=", ">=", "==", "!=", "<>"].includes(two)) {
      tokens.push({ type: "op", value: two === "<>" ? "!=" : two });
      i += 2;
      continue;
    }
    if ("+-*/%<>=(),".includes(c)) {
      tokens.push({ type: c === "(" || c === ")" || c === "," ? c : "op", value: c });
      i++;
      continue;
    }
    throw new SyntaxError(`Unexpected character "${c}" in expression`);
  }
  tokens.push({ type: "eof", value: null });
  return tokens;
}

/**
 * Parse a calculated-field formula into an AST.
 * Supported: [Field] refs, numbers, strings, TRUE/FALSE/NULL, + - * / %,
 * comparisons (= == != <> < > <= >=), AND/OR/NOT, parens, and the FUNCTIONS table.
 * @param {string} src
 * @returns {Object} AST node
 * @throws {SyntaxError} on malformed input
 */
export function parseExpression(src) {
  const tokens = tokenize(String(src ?? ""));
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const eat = (type, value) => {
    const t = peek();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new SyntaxError(`Expected ${value ?? type} but found ${String(t.value ?? t.type)}`);
    }
    return next();
  };
  const atOp = (...ops) => peek().type === "op" && ops.includes(peek().value);

  const parseOr = () => {
    let left = parseAnd();
    while (atOp("||")) {
      next();
      left = { kind: "logical", op: "||", left, right: parseAnd() };
    }
    return left;
  };
  const parseAnd = () => {
    let left = parseComparison();
    while (atOp("&&")) {
      next();
      left = { kind: "logical", op: "&&", left, right: parseComparison() };
    }
    return left;
  };
  const parseComparison = () => {
    let left = parseAdditive();
    while (atOp("=", "==", "!=", "<", ">", "<=", ">=")) {
      const op = next().value;
      left = { kind: "binary", op: op === "=" ? "==" : op, left, right: parseAdditive() };
    }
    return left;
  };
  const parseAdditive = () => {
    let left = parseMultiplicative();
    while (atOp("+", "-")) {
      const op = next().value;
      left = { kind: "binary", op, left, right: parseMultiplicative() };
    }
    return left;
  };
  const parseMultiplicative = () => {
    let left = parseUnary();
    while (atOp("*", "/", "%")) {
      const op = next().value;
      left = { kind: "binary", op, left, right: parseUnary() };
    }
    return left;
  };
  const parseUnary = () => {
    if (atOp("-")) {
      next();
      return { kind: "unary", op: "-", operand: parseUnary() };
    }
    if (atOp("!")) {
      next();
      return { kind: "unary", op: "!", operand: parseUnary() };
    }
    if (atOp("+")) {
      next();
      return parseUnary();
    }
    return parsePrimary();
  };
  const parsePrimary = () => {
    const t = peek();
    if (t.type === "number" || t.type === "string" || t.type === "boolean" || t.type === "null") {
      next();
      return { kind: "literal", value: t.value };
    }
    if (t.type === "field") {
      next();
      return { kind: "field", name: t.value };
    }
    if (t.type === "ident") {
      next();
      if (peek().type === "(") {
        const name = t.value.toUpperCase();
        if (!Object.hasOwn(FUNCTIONS, name)) throw new SyntaxError(`Unknown function "${t.value}"`);
        next();
        const args = [];
        if (peek().type !== ")") {
          args.push(parseOr());
          while (peek().type === ",") {
            next();
            args.push(parseOr());
          }
        }
        eat(")");
        return { kind: "call", name, args };
      }
      // A bare identifier is a field reference — [Brackets] are optional for
      // simple column names like `income`.
      return { kind: "field", name: t.value };
    }
    if (t.type === "(") {
      next();
      const inner = parseOr();
      eat(")");
      return inner;
    }
    throw new SyntaxError(`Unexpected ${String(t.value ?? t.type)} in expression`);
  };

  const ast = parseOr();
  if (peek().type !== "eof") throw new SyntaxError(`Unexpected trailing "${String(peek().value)}"`);
  return ast;
}

/**
 * Evaluate a parsed expression against one row.
 * @param {Object} ast from parseExpression
 * @param {Object} row
 * @returns {*}
 */
export function evaluateExpression(ast, row) {
  switch (ast.kind) {
    case "literal":
      return ast.value;
    case "field": {
      // OWN properties only. A plain `row[name]` would walk the prototype chain,
      // so a field named "constructor" or "toString" would hand the formula a
      // live host function instead of null. Data rows expose data, nothing else.
      if (!row || !Object.hasOwn(row, ast.name)) return null;
      const v = row[ast.name];
      return v === undefined ? null : v;
    }
    case "unary": {
      const v = evaluateExpression(ast.operand, row);
      return ast.op === "-" ? -num(v) : !truthy(v);
    }
    case "logical": {
      const l = evaluateExpression(ast.left, row);
      if (ast.op === "&&") return truthy(l) ? truthy(evaluateExpression(ast.right, row)) : false;
      return truthy(l) ? true : truthy(evaluateExpression(ast.right, row));
    }
    case "binary": {
      const l = evaluateExpression(ast.left, row);
      const r = evaluateExpression(ast.right, row);
      switch (ast.op) {
        // `+` concatenates when either side is a non-numeric string, matching
        // how Tableau's + behaves across string and number types.
        case "+": {
          const ln = typeof l === "number" ? l : toNumber(l);
          const rn = typeof r === "number" ? r : toNumber(r);
          if (ln === null || rn === null) return String(l ?? "") + String(r ?? "");
          return ln + rn;
        }
        case "-": return num(l) - num(r);
        case "*": return num(l) * num(r);
        case "/": {
          const d = num(r);
          return d === 0 ? null : num(l) / d;
        }
        case "%": {
          const d = num(r);
          return d === 0 ? null : num(l) % d;
        }
        case "==": return looseEquals(l, r);
        case "!=": return !looseEquals(l, r);
        case "<": return compare(l, r) < 0;
        case ">": return compare(l, r) > 0;
        case "<=": return compare(l, r) <= 0;
        case ">=": return compare(l, r) >= 0;
        default:
          throw new Error(`Unsupported operator ${ast.op}`);
      }
    }
    case "call": {
      const fn = FUNCTIONS[ast.name];
      if (!fn) throw new Error(`Unknown function ${ast.name}`);
      return fn(...ast.args.map((a) => evaluateExpression(a, row)));
    }
    default:
      throw new Error(`Unsupported node ${ast.kind}`);
  }
}

function looseEquals(a, b) {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a === "number" || typeof b === "number") {
    const an = num(a);
    const bn = num(b);
    if (!Number.isNaN(an) && !Number.isNaN(bn)) return an === bn;
  }
  return String(a) === String(b);
}

function compare(a, b) {
  const an = typeof a === "number" ? a : toNumber(a);
  const bn = typeof b === "number" ? b : toNumber(b);
  if (an !== null && bn !== null && !Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
  const as = String(a ?? "");
  const bs = String(b ?? "");
  return as < bs ? -1 : as > bs ? 1 : 0;
}

/**
 * Define a calculated field. Parses eagerly so authoring errors surface now, at
 * the point the user typed the formula, rather than mid-render.
 * @param {string} name
 * @param {string} expression
 * @param {Object} [options] { type, role } to override inference
 * @returns {Object} a field descriptor with { calculated:true, expression, ast }
 * @throws {SyntaxError} when the formula does not parse
 */
export function createCalculatedField(name, expression, options = {}) {
  const ast = parseExpression(expression);
  const type = options.type || FieldType.NUMBER;
  const role = options.role || inferRole(name, type);
  return {
    name,
    type,
    role,
    defaultAggregation: options.aggregation || defaultAggregation(type, role),
    calculated: true,
    expression,
    ast,
  };
}

/**
 * Materialise calculated fields onto each row. Returns new rows; inputs untouched.
 * Calculated fields are evaluated in order, so a later one may reference an
 * earlier one.
 * @param {Array<Object>} rows
 * @param {Array<Object>} calculatedFields from createCalculatedField
 * @returns {Array<Object>}
 */
export function applyCalculatedFields(rows, calculatedFields) {
  if (!calculatedFields?.length) return rows;
  const prepared = calculatedFields.map((f) => ({
    field: f,
    ast: f.ast || parseExpression(f.expression),
  }));
  return rows.map((row) => {
    const out = { ...row };
    for (const { field, ast } of prepared) out[field.name] = evaluateExpression(ast, out);
    return out;
  });
}

/**
 * Validate a formula without throwing — for live editor feedback.
 * @param {string} expression
 * @param {Array<Object>} [fields] known fields; when given, unknown refs are errors
 * @returns {{valid:boolean, error:(string|null), references:Array<string>}}
 */
export function validateExpression(expression, fields) {
  try {
    const ast = parseExpression(expression);
    const references = [];
    (function walk(node) {
      if (!node || typeof node !== "object") return;
      if (node.kind === "field" && !references.includes(node.name)) references.push(node.name);
      for (const key of ["left", "right", "operand"]) if (node[key]) walk(node[key]);
      if (node.args) node.args.forEach(walk);
    })(ast);

    if (fields) {
      const known = new Set(fields.map((f) => f.name));
      const missing = references.filter((r) => !known.has(r));
      if (missing.length) {
        return { valid: false, error: `Unknown field: ${missing.join(", ")}`, references };
      }
    }
    return { valid: true, error: null, references };
  } catch (err) {
    return { valid: false, error: err.message, references: [] };
  }
}
