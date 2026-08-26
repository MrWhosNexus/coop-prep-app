// The spreadsheet function library plus shared value semantics:
// error values, type coercion, range values, and criteria matching.
// Everything here is pure and DOM-free.
//
// Value domain flowing through the evaluator:
//   number | string | boolean | undefined (blank cell) | FormulaError | RangeValue

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** An Excel-style error value (#DIV/0!, #N/A, ...). Flows as data, not thrown. */
export class FormulaError {
  /** @param {string} code e.g. "#DIV/0!" */
  constructor(code) {
    this.code = code;
  }
  toString() {
    return this.code;
  }
}

/** Singleton error values matching real Excel error codes. */
export const ERRORS = {
  DIV0: new FormulaError("#DIV/0!"),
  NA: new FormulaError("#N/A"),
  VALUE: new FormulaError("#VALUE!"),
  REF: new FormulaError("#REF!"),
  NAME: new FormulaError("#NAME?"),
  NUM: new FormulaError("#NUM!"),
  NULL: new FormulaError("#NULL!"),
  CIRCULAR: new FormulaError("#CIRCULAR!"),
};

/** Look up the singleton error for a literal code like "#N/A". */
export function errorFromCode(code) {
  const found = Object.values(ERRORS).find((e) => e.code === code);
  return found || new FormulaError(code);
}

/** True if v is a FormulaError. */
export function isError(v) {
  return v instanceof FormulaError;
}

// ---------------------------------------------------------------------------
// Range values
// ---------------------------------------------------------------------------

/** A rectangular block of evaluated values (2D, row-major). */
export class RangeValue {
  /** @param {Array<Array<*>>} values 2D row-major array */
  constructor(values) {
    this.values = values;
  }
  get rows() { return this.values.length; }
  get cols() { return this.values[0] ? this.values[0].length : 0; }
  /** Flatten row-major into a 1D array. */
  flat() {
    const out = [];
    for (const row of this.values) for (const v of row) out.push(v);
    return out;
  }
  /** True if this is a single row or single column. */
  isVector() { return this.rows === 1 || this.cols === 1; }
  /** The values as a 1D vector (throws nothing; caller checks isVector). */
  vector() { return this.rows === 1 ? this.values[0].slice() : this.values.map((r) => r[0]); }
}

/** True if v is a RangeValue. */
export function isRange(v) {
  return v instanceof RangeValue;
}

// ---------------------------------------------------------------------------
// Coercion (Excel semantics)
// ---------------------------------------------------------------------------

/**
 * Coerce a scalar to a number the way Excel arithmetic does:
 * blank -> 0, TRUE/FALSE -> 1/0, numeric text -> number, other text -> #VALUE!.
 * Errors pass through; ranges are #VALUE! in scalar context.
 * @returns {number | FormulaError}
 */
export function toNumber(v) {
  if (isError(v)) return v;
  if (isRange(v)) {
    // implicit intersection is not modeled; single-cell ranges collapse
    if (v.rows === 1 && v.cols === 1) return toNumber(v.values[0][0]);
    return ERRORS.VALUE;
  }
  if (v === undefined || v === null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : ERRORS.NUM;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return ERRORS.VALUE;
    let mult = 1;
    let body = s;
    if (body.endsWith("%")) { mult = 0.01; body = body.slice(0, -1).trim(); }
    const n = Number(body.replace(/,/g, ""));
    return Number.isFinite(n) && body !== "" ? n * mult : ERRORS.VALUE;
  }
  return ERRORS.VALUE;
}

/**
 * Coerce a scalar to text the way & concatenation does:
 * blank -> "", TRUE -> "TRUE", numbers via String().
 * @returns {string | FormulaError}
 */
export function toText(v) {
  if (isError(v)) return v;
  if (isRange(v)) {
    if (v.rows === 1 && v.cols === 1) return toText(v.values[0][0]);
    return ERRORS.VALUE;
  }
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return String(v);
}

/**
 * Coerce a scalar to a boolean (for IF conditions): numbers are truthy when
 * nonzero, blank is FALSE, "TRUE"/"FALSE" text parses, other text -> #VALUE!.
 * @returns {boolean | FormulaError}
 */
export function toBool(v) {
  if (isError(v)) return v;
  if (isRange(v)) {
    if (v.rows === 1 && v.cols === 1) return toBool(v.values[0][0]);
    return ERRORS.VALUE;
  }
  if (v === undefined || v === null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toUpperCase();
    if (s === "TRUE") return true;
    if (s === "FALSE") return false;
    return ERRORS.VALUE;
  }
  return ERRORS.VALUE;
}

/**
 * Excel equality: case-insensitive for text; a blank cell equals 0, "" and
 * FALSE; numbers never equal their text form ("3" <> 3).
 */
export function valueEquals(a, b) {
  let x = a;
  let y = b;
  if (x === undefined || x === null) x = blankAs(y);
  if (y === undefined || y === null) y = blankAs(x);
  if (typeof x !== typeof y) return false;
  if (typeof x === "string") return x.toLowerCase() === y.toLowerCase();
  return x === y;
}

function blankAs(other) {
  if (typeof other === "string") return "";
  if (typeof other === "boolean") return false;
  return 0;
}

/**
 * Excel ordering for < >: within a type, natural order (text case-insensitive);
 * across types, number < text < boolean.
 * @returns {number} negative / 0 / positive
 */
export function valueCompare(a, b) {
  let x = a;
  let y = b;
  if (x === undefined || x === null) x = blankAs(y);
  if (y === undefined || y === null) y = blankAs(x);
  const rx = typeRank(x);
  const ry = typeRank(y);
  if (rx !== ry) return rx - ry;
  if (typeof x === "string") {
    const lx = x.toLowerCase();
    const ly = y.toLowerCase();
    return lx < ly ? -1 : lx > ly ? 1 : 0;
  }
  const nx = typeof x === "boolean" ? (x ? 1 : 0) : x;
  const ny = typeof y === "boolean" ? (y ? 1 : 0) : y;
  return nx - ny;
}

function typeRank(v) {
  if (typeof v === "number") return 0;
  if (typeof v === "string") return 1;
  return 2; // boolean
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Flatten mixed scalar/range args into one array of scalar values. */
export function flattenArgs(args) {
  const out = [];
  for (const a of args) {
    if (isRange(a)) out.push(...a.flat());
    else out.push(a);
  }
  return out;
}

/** First FormulaError among scalars and range members, or null. */
export function firstError(args) {
  for (const a of args) {
    if (isError(a)) return a;
    if (isRange(a)) {
      for (const v of a.flat()) if (isError(v)) return v;
    }
  }
  return null;
}

/**
 * Collect numbers for aggregation with Excel's rules: values inside ranges
 * only count when they are actual numbers (text/booleans/blanks skipped);
 * direct scalar arguments are coerced (and error if not numeric).
 * @returns {number[] | FormulaError}
 */
export function collectNumbers(args) {
  const err = firstError(args);
  if (err) return err;
  const nums = [];
  for (const a of args) {
    if (isRange(a)) {
      for (const v of a.flat()) {
        if (typeof v === "number") nums.push(v);
      }
    } else if (a !== undefined && a !== null) {
      const n = toNumber(a);
      if (isError(n)) return n;
      nums.push(n);
    }
  }
  return nums;
}

/** Convert a wildcard pattern (* and ?, ~ escapes) to a RegExp. */
function wildcardToRegExp(pattern) {
  let out = "^";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "~" && (pattern[i + 1] === "*" || pattern[i + 1] === "?" || pattern[i + 1] === "~")) {
      out += pattern[i + 1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      i++;
    } else if (ch === "*") {
      out += ".*";
    } else if (ch === "?") {
      out += ".";
    } else {
      out += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(out + "$", "i");
}

/** True if the string contains unescaped wildcards. */
function hasWildcard(s) {
  return /(^|[^~])[*?]/.test(s) || /^[*?]/.test(s);
}

/** Wildcard pattern -> unanchored case-insensitive RegExp (for FIND/SEARCH substring search). */
function wildcardToRegExpLoose(pattern) {
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "~" && (pattern[i + 1] === "*" || pattern[i + 1] === "?" || pattern[i + 1] === "~")) {
      out += pattern[i + 1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      i++;
    } else if (ch === "*") {
      out += ".*";
    } else if (ch === "?") {
      out += ".";
    } else {
      out += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(out, "i");
}

/**
 * Compile a COUNTIF/SUMIF-style criteria into a predicate over cell values.
 * Supports ">=5", "<>x", bare values (case-insensitive equality) and
 * * / ? wildcards.
 * @param {*} criteria
 * @returns {(v: *) => boolean}
 */
export function compileCriteria(criteria) {
  if (isRange(criteria)) {
    criteria = criteria.rows === 1 && criteria.cols === 1 ? criteria.values[0][0] : ERRORS.VALUE;
  }
  if (isError(criteria)) {
    return (v) => isError(v) && v.code === criteria.code;
  }
  if (typeof criteria === "string") {
    const m = /^(<=|>=|<>|=|<|>)([\s\S]*)$/.exec(criteria);
    if (m) {
      const op = m[1];
      const rhsText = m[2];
      const rhsNum = rhsText.trim() === "" ? NaN : Number(rhsText);
      const rhs = Number.isFinite(rhsNum) ? rhsNum : rhsText;
      return makeOpPredicate(op, rhs);
    }
    const asNum = criteria.trim() === "" ? NaN : Number(criteria);
    if (Number.isFinite(asNum)) return (v) => typeof v === "number" && v === asNum;
    if (hasWildcard(criteria)) {
      const re = wildcardToRegExp(criteria);
      return (v) => typeof v === "string" && re.test(v);
    }
    return (v) => valueEquals(v, criteria) && v !== undefined && v !== null;
  }
  if (typeof criteria === "number") {
    return (v) => typeof v === "number" && v === criteria;
  }
  if (typeof criteria === "boolean") {
    return (v) => typeof v === "boolean" && v === criteria;
  }
  if (criteria === undefined || criteria === null) {
    // Excel: blank criteria matches 0 or blank
    return (v) => v === 0 || v === undefined || v === null;
  }
  return () => false;
}

function makeOpPredicate(op, rhs) {
  if (op === "=") {
    if (typeof rhs === "string" && rhs === "") return (v) => v === undefined || v === null || v === "";
    if (typeof rhs === "string" && hasWildcard(rhs)) {
      const re = wildcardToRegExp(rhs);
      return (v) => typeof v === "string" && re.test(v);
    }
    return (v) => (typeof rhs === "number"
      ? typeof v === "number" && v === rhs
      : typeof v === "string" && v.toLowerCase() === String(rhs).toLowerCase());
  }
  if (op === "<>") {
    if (typeof rhs === "string" && rhs === "") return (v) => !(v === undefined || v === null || v === "");
    if (typeof rhs === "string" && hasWildcard(rhs)) {
      const re = wildcardToRegExp(rhs);
      return (v) => !(typeof v === "string" && re.test(v));
    }
    return (v) => (typeof rhs === "number"
      ? !(typeof v === "number" && v === rhs)
      : !(typeof v === "string" && v.toLowerCase() === String(rhs).toLowerCase()));
  }
  // ordered comparisons only match same-type values, like Excel
  return (v) => {
    if (typeof rhs === "number" && typeof v !== "number") return false;
    if (typeof rhs === "string" && typeof v !== "string") return false;
    const c = valueCompare(v, rhs);
    if (op === "<") return c < 0;
    if (op === "<=") return c <= 0;
    if (op === ">") return c > 0;
    return c >= 0; // ">="
  };
}

/** Extract a 1D vector from a range/scalar arg, or #VALUE! if 2D block. */
function asVector(arg) {
  if (isRange(arg)) {
    if (!arg.isVector()) return ERRORS.VALUE;
    return arg.vector();
  }
  return [arg];
}

/** Round half away from zero with float-noise correction (Excel ROUND). */
function excelRound(x, digits) {
  const p = Math.pow(10, digits);
  const scaled = Number((Math.abs(x) * p).toPrecision(15));
  return Math.sign(x) * (Math.round(scaled) / p);
}

// ---------------------------------------------------------------------------
// Dates (Excel serial numbers: 1 = 1900-01-01; we anchor at 1899-12-30 UTC)
// ---------------------------------------------------------------------------

const DAY_MS = 86400000;
const SERIAL_EPOCH = Date.UTC(1899, 11, 30);

/** Convert a JS Date (interpreted as local calendar date) to an Excel serial. */
export function dateToSerial(date) {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((utc - SERIAL_EPOCH) / DAY_MS);
}

/** Convert an Excel serial to a UTC Date at midnight. */
export function serialToDate(serial) {
  return new Date(SERIAL_EPOCH + Math.floor(serial) * DAY_MS);
}

/** Parse a value (serial number or date text) to a serial, else #VALUE!. */
export function parseDateValue(v) {
  if (isError(v)) return v;
  if (typeof v === "number") return v >= 0 ? Math.floor(v) : ERRORS.NUM;
  if (typeof v === "string") {
    const s = v.trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (m) {
      return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - SERIAL_EPOCH) / DAY_MS);
    }
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (m) {
      return Math.round((Date.UTC(+m[3], +m[1] - 1, +m[2]) - SERIAL_EPOCH) / DAY_MS);
    }
    return ERRORS.VALUE;
  }
  return ERRORS.VALUE;
}

// ---------------------------------------------------------------------------
// TEXT() number formatting (practical subset of Excel format codes)
// ---------------------------------------------------------------------------

/**
 * Format a number with a subset of Excel format codes: 0, #, ".", ",",
 * "%", literal prefix/suffix (e.g. "$"), and date codes yyyy/mm/dd/mmm.
 * @param {number} num
 * @param {string} fmt
 * @returns {string}
 */
export function formatNumber(num, fmt) {
  // date formats: consume codes left-to-right in a single pass, emitting into
  // a separate buffer so substituted text (month names) can never re-match
  if (/y{2,4}|m{3}|(^|[^#0])d{1,2}/i.test(fmt) && !/[#0]/.test(fmt)) {
    const d = serialToDate(num);
    const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthsLong = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const codes = [
      ["yyyy", () => String(d.getUTCFullYear())],
      ["yy", () => String(d.getUTCFullYear()).slice(-2)],
      ["mmmm", () => monthsLong[d.getUTCMonth()]],
      ["mmm", () => monthsShort[d.getUTCMonth()]],
      ["mm", () => String(d.getUTCMonth() + 1).padStart(2, "0")],
      ["m", () => String(d.getUTCMonth() + 1)],
      ["dd", () => String(d.getUTCDate()).padStart(2, "0")],
      ["d", () => String(d.getUTCDate())],
    ];
    let out = "";
    let i = 0;
    while (i < fmt.length) {
      const rest = fmt.slice(i).toLowerCase();
      const hit = codes.find(([code]) => rest.startsWith(code));
      if (hit) {
        out += hit[1]();
        i += hit[0].length;
      } else {
        out += fmt[i];
        i += 1;
      }
    }
    return out;
  }
  const isPercent = fmt.includes("%");
  let n = isPercent ? num * 100 : num;
  const core = fmt.replace(/%/g, "");
  const firstDigit = core.search(/[#0]/);
  if (firstDigit === -1) return fmt; // no digit placeholders: return format as-is
  const lastDigit = core.length - 1 - core.split("").reverse().join("").search(/[#0]/);
  const prefix = core.slice(0, firstDigit);
  const suffix = core.slice(lastDigit + 1);
  const body = core.slice(firstDigit, lastDigit + 1);
  const useGrouping = body.includes(",");
  const dot = body.indexOf(".");
  const decimals = dot === -1 ? 0 : body.slice(dot + 1).replace(/[^#0]/g, "").length;
  const rounded = excelRound(n, decimals);
  const neg = rounded < 0;
  let text = Math.abs(rounded).toFixed(decimals);
  if (useGrouping) {
    const parts = text.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    text = parts.join(".");
  }
  return (neg ? "-" : "") + prefix + text + suffix + (isPercent ? "%" : "");
}

// ---------------------------------------------------------------------------
// Lookup internals
// ---------------------------------------------------------------------------

/** Wildcards-aware exact match used by MATCH type 0 / VLOOKUP exact. */
function exactMatches(cell, lookup) {
  if (typeof lookup === "string" && hasWildcard(lookup)) {
    return typeof cell === "string" && wildcardToRegExp(lookup).test(cell);
  }
  return valueEquals(cell, lookup) && cell !== undefined && cell !== null;
}

function comparableSameType(a, b) {
  return typeRank(a) === typeRank(b);
}

/**
 * Core matcher shared by MATCH/XLOOKUP/VLOOKUP.
 * mode 0 exact, -1 exact-or-next-smaller, 1 exact-or-next-larger, 2 wildcard.
 * reverse scans last-to-first for exact/wildcard modes.
 * @returns {number} 0-based index, or -1 when not found
 */
function findIndex(vec, lookup, mode, reverse) {
  const n = vec.length;
  if (mode === 0 || mode === 2) {
    const test = mode === 2
      ? (v) => typeof v === "string" && typeof lookup === "string" && wildcardToRegExp(lookup).test(v)
      : (v) => exactMatches(v, lookup);
    if (reverse) {
      for (let i = n - 1; i >= 0; i--) if (test(vec[i])) return i;
    } else {
      for (let i = 0; i < n; i++) if (test(vec[i])) return i;
    }
    return -1;
  }
  // approximate: nearest value <= lookup (mode -1) or >= lookup (mode 1)
  let best = -1;
  for (let i = 0; i < n; i++) {
    const v = vec[i];
    if (v === undefined || v === null || isError(v) || !comparableSameType(v, lookup)) continue;
    if (valueEquals(v, lookup)) return i;
    const c = valueCompare(v, lookup);
    if (mode === -1 && c < 0) {
      if (best === -1 || valueCompare(v, vec[best]) > 0) best = i;
    } else if (mode === 1 && c > 0) {
      if (best === -1 || valueCompare(v, vec[best]) < 0) best = i;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// The function registry
// ---------------------------------------------------------------------------

/**
 * Registry of spreadsheet functions. Eager functions are plain
 * (args, ctx) => value. Lazy functions (IF, IFS, IFERROR) are objects
 * { lazy: true, call(argAsts, evalArg, ctx) } — the evaluator supplies
 * evalArg to evaluate an argument AST on demand.
 */
export const FUNCTIONS = {
  // ---- Aggregation ----
  SUM(args) {
    const nums = collectNumbers(args);
    if (isError(nums)) return nums;
    return nums.reduce((a, b) => a + b, 0);
  },
  AVERAGE(args) {
    const nums = collectNumbers(args);
    if (isError(nums)) return nums;
    if (nums.length === 0) return ERRORS.DIV0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  },
  COUNT(args) {
    let count = 0;
    for (const a of args) {
      if (isRange(a)) {
        for (const v of a.flat()) if (typeof v === "number") count++;
      } else if (typeof a === "number" || typeof a === "boolean") {
        count++;
      } else if (typeof a === "string" && !isError(toNumber(a))) {
        count++;
      }
    }
    return count;
  },
  COUNTA(args) {
    let count = 0;
    for (const v of flattenArgs(args)) {
      if (v !== undefined && v !== null) count++;
    }
    return count;
  },
  MIN(args) {
    const nums = collectNumbers(args);
    if (isError(nums)) return nums;
    return nums.length === 0 ? 0 : Math.min(...nums);
  },
  MAX(args) {
    const nums = collectNumbers(args);
    if (isError(nums)) return nums;
    return nums.length === 0 ? 0 : Math.max(...nums);
  },
  MEDIAN(args) {
    return FUNCTIONS.PERCENTILE([args.length === 1 ? args[0] : new RangeValue([flattenArgs(args)]), 0.5]);
  },
  COUNTIF(args) {
    if (!isRange(args[0])) return ERRORS.VALUE;
    const test = compileCriteria(args[1]);
    let count = 0;
    for (const v of args[0].flat()) if (test(v)) count++;
    return count;
  },
  COUNTIFS(args) {
    return countMatchingRows(args);
  },
  SUMIF(args) {
    const [range, criteria, sumRange] = args;
    if (!isRange(range)) return ERRORS.VALUE;
    const target = sumRange !== undefined ? sumRange : range;
    if (!isRange(target)) return ERRORS.VALUE;
    const test = compileCriteria(criteria);
    const src = range.flat();
    const dst = target.flat();
    let sum = 0;
    for (let i = 0; i < src.length; i++) {
      if (test(src[i])) {
        const v = dst[i];
        if (isError(v)) return v;
        if (typeof v === "number") sum += v;
      }
    }
    return sum;
  },
  SUMIFS(args) {
    const res = ifsAccumulate(args);
    if (isError(res)) return res;
    return res.sum;
  },
  AVERAGEIF(args) {
    const [range, criteria, avgRange] = args;
    if (!isRange(range)) return ERRORS.VALUE;
    const target = avgRange !== undefined ? avgRange : range;
    if (!isRange(target)) return ERRORS.VALUE;
    const test = compileCriteria(criteria);
    const src = range.flat();
    const dst = target.flat();
    let sum = 0;
    let n = 0;
    for (let i = 0; i < src.length; i++) {
      if (test(src[i])) {
        const v = dst[i];
        if (isError(v)) return v;
        if (typeof v === "number") { sum += v; n++; }
      }
    }
    return n === 0 ? ERRORS.DIV0 : sum / n;
  },
  AVERAGEIFS(args) {
    const res = ifsAccumulate(args);
    if (isError(res)) return res;
    return res.n === 0 ? ERRORS.DIV0 : res.sum / res.n;
  },

  // ---- Stats ----
  "STDEV.S"(args) {
    const v = sampleVariance(args);
    return isError(v) ? v : Math.sqrt(v);
  },
  "STDEV.P"(args) {
    const v = populationVariance(args);
    return isError(v) ? v : Math.sqrt(v);
  },
  "VAR.S"(args) {
    return sampleVariance(args);
  },
  "VAR.P"(args) {
    return populationVariance(args);
  },
  CORREL(args) {
    const [ra, rb] = args;
    if (!isRange(ra) || !isRange(rb)) return ERRORS.VALUE;
    const xs = ra.flat();
    const ys = rb.flat();
    if (xs.length !== ys.length) return ERRORS.NA;
    const px = [];
    const py = [];
    for (let i = 0; i < xs.length; i++) {
      if (isError(xs[i])) return xs[i];
      if (isError(ys[i])) return ys[i];
      if (typeof xs[i] === "number" && typeof ys[i] === "number") {
        px.push(xs[i]);
        py.push(ys[i]);
      }
    }
    const n = px.length;
    if (n < 2) return ERRORS.DIV0;
    const mx = px.reduce((a, b) => a + b, 0) / n;
    const my = py.reduce((a, b) => a + b, 0) / n;
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (let i = 0; i < n; i++) {
      sxy += (px[i] - mx) * (py[i] - my);
      sxx += (px[i] - mx) ** 2;
      syy += (py[i] - my) ** 2;
    }
    if (sxx === 0 || syy === 0) return ERRORS.DIV0;
    return sxy / Math.sqrt(sxx * syy);
  },
  PERCENTILE(args) {
    const [rangeArg, kArg] = args;
    const k = toNumber(kArg);
    if (isError(k)) return k;
    if (k < 0 || k > 1) return ERRORS.NUM;
    const nums = collectNumbers([rangeArg]);
    if (isError(nums)) return nums;
    if (nums.length === 0) return ERRORS.NUM;
    const sorted = nums.slice().sort((a, b) => a - b);
    const pos = k * (sorted.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
  },
  "PERCENTILE.INC"(args) {
    return FUNCTIONS.PERCENTILE(args);
  },
  QUARTILE(args) {
    const q = toNumber(args[1]);
    if (isError(q)) return q;
    if (!Number.isInteger(q) || q < 0 || q > 4) return ERRORS.NUM;
    return FUNCTIONS.PERCENTILE([args[0], q / 4]);
  },
  "QUARTILE.INC"(args) {
    return FUNCTIONS.QUARTILE(args);
  },

  // ---- Lookup ----
  XLOOKUP(args) {
    const [lookup, lookupArr, returnArr, ifNotFound, matchModeArg, searchModeArg] = args;
    if (isError(lookup)) return lookup;
    const vec = asVector(lookupArr);
    if (isError(vec)) return vec;
    if (!isRange(returnArr)) return ERRORS.VALUE;
    const matchMode = matchModeArg === undefined ? 0 : toNumber(matchModeArg);
    const searchMode = searchModeArg === undefined ? 1 : toNumber(searchModeArg);
    if (isError(matchMode)) return matchMode;
    if (isError(searchMode)) return searchMode;
    const idx = findIndex(vec, lookup, matchMode, searchMode === -1);
    if (idx === -1) {
      return ifNotFound !== undefined ? ifNotFound : ERRORS.NA;
    }
    // orient the return array along the lookup vector
    const lookupIsColumn = !isRange(lookupArr) || lookupArr.cols === 1;
    if (lookupIsColumn) {
      if (returnArr.rows !== vec.length) return ERRORS.VALUE;
      const row = returnArr.values[idx];
      return row.length === 1 ? row[0] : new RangeValue([row.slice()]);
    }
    if (returnArr.cols !== vec.length) return ERRORS.VALUE;
    const col = returnArr.values.map((r) => [r[idx]]);
    return col.length === 1 ? col[0][0] : new RangeValue(col);
  },
  VLOOKUP(args) {
    const [lookup, table, colArg, approxArg] = args;
    if (isError(lookup)) return lookup;
    if (!isRange(table)) return ERRORS.VALUE;
    const colIdx = toNumber(colArg);
    if (isError(colIdx)) return colIdx;
    if (colIdx < 1) return ERRORS.VALUE;
    if (colIdx > table.cols) return ERRORS.REF;
    const approx = approxArg === undefined ? true : toBool(approxArg);
    if (isError(approx)) return approx;
    const firstCol = table.values.map((r) => r[0]);
    const idx = findIndex(firstCol, lookup, approx ? -1 : 0, false);
    if (idx === -1) return ERRORS.NA;
    return table.values[idx][Math.trunc(colIdx) - 1];
  },
  HLOOKUP(args) {
    const [lookup, table, rowArg, approxArg] = args;
    if (isError(lookup)) return lookup;
    if (!isRange(table)) return ERRORS.VALUE;
    const rowIdx = toNumber(rowArg);
    if (isError(rowIdx)) return rowIdx;
    if (rowIdx < 1) return ERRORS.VALUE;
    if (rowIdx > table.rows) return ERRORS.REF;
    const approx = approxArg === undefined ? true : toBool(approxArg);
    if (isError(approx)) return approx;
    const firstRow = table.values[0];
    const idx = findIndex(firstRow, lookup, approx ? -1 : 0, false);
    if (idx === -1) return ERRORS.NA;
    return table.values[Math.trunc(rowIdx) - 1][idx];
  },
  INDEX(args) {
    const [range, rowArg, colArg] = args;
    if (!isRange(range)) return ERRORS.VALUE;
    const rowN = rowArg === undefined ? 1 : toNumber(rowArg);
    if (isError(rowN)) return rowN;
    // vector form: INDEX(vector, n)
    if (colArg === undefined && range.isVector()) {
      const vec = range.vector();
      const i = Math.trunc(rowN);
      if (i < 1 || i > vec.length) return ERRORS.REF;
      return vec[i - 1];
    }
    const colN = colArg === undefined ? 1 : toNumber(colArg);
    if (isError(colN)) return colN;
    const r = Math.trunc(rowN);
    const c = Math.trunc(colN);
    if (r < 0 || c < 0 || r > range.rows || c > range.cols) return ERRORS.REF;
    if (r === 0 && c === 0) return range;
    if (r === 0) return new RangeValue(range.values.map((row) => [row[c - 1]]));
    if (c === 0) return new RangeValue([range.values[r - 1].slice()]);
    return range.values[r - 1][c - 1];
  },
  MATCH(args) {
    const [lookup, arrArg, typeArg] = args;
    if (isError(lookup)) return lookup;
    const vec = asVector(arrArg);
    if (isError(vec)) return vec;
    const type = typeArg === undefined ? 1 : toNumber(typeArg);
    if (isError(type)) return type;
    // MATCH type 1: largest <= lookup; type -1: smallest >= lookup; 0: exact
    const mode = type > 0 ? -1 : type < 0 ? 1 : 0;
    const idx = findIndex(vec, lookup, mode, false);
    return idx === -1 ? ERRORS.NA : idx + 1;
  },

  // ---- Logic ----
  IF: {
    lazy: true,
    call(argAsts, evalArg) {
      const cond = toBool(collapse(evalArg(argAsts[0])));
      if (isError(cond)) return cond;
      if (cond) return argAsts.length > 1 ? evalArg(argAsts[1]) : true;
      return argAsts.length > 2 ? evalArg(argAsts[2]) : false;
    },
  },
  IFS: {
    lazy: true,
    call(argAsts, evalArg) {
      for (let i = 0; i + 1 < argAsts.length; i += 2) {
        const cond = toBool(collapse(evalArg(argAsts[i])));
        if (isError(cond)) return cond;
        if (cond) return evalArg(argAsts[i + 1]);
      }
      return ERRORS.NA;
    },
  },
  IFERROR: {
    lazy: true,
    call(argAsts, evalArg) {
      const v = evalArg(argAsts[0]);
      if (isError(v)) return argAsts.length > 1 ? evalArg(argAsts[1]) : "";
      return v;
    },
  },
  AND(args) {
    return logicalFold(args, (acc, b) => acc && b, true);
  },
  OR(args) {
    return logicalFold(args, (acc, b) => acc || b, false);
  },
  NOT(args) {
    const b = toBool(collapse(args[0]));
    return isError(b) ? b : !b;
  },
  ISBLANK(args) {
    const v = collapse(args[0]);
    return v === undefined || v === null;
  },
  ISNUMBER(args) {
    return typeof collapse(args[0]) === "number";
  },
  ISTEXT(args) {
    return typeof collapse(args[0]) === "string";
  },
  ISERROR(args) {
    return isError(collapse(args[0]));
  },

  // ---- Text ----
  CONCAT(args) {
    let out = "";
    for (const v of flattenArgs(args)) {
      const t = toText(v);
      if (isError(t)) return t;
      out += t;
    }
    return out;
  },
  CONCATENATE(args) {
    return FUNCTIONS.CONCAT(args);
  },
  LEFT(args) {
    const t = toText(collapse(args[0]));
    if (isError(t)) return t;
    const n = args[1] === undefined ? 1 : toNumber(args[1]);
    if (isError(n)) return n;
    if (n < 0) return ERRORS.VALUE;
    return t.slice(0, Math.trunc(n));
  },
  RIGHT(args) {
    const t = toText(collapse(args[0]));
    if (isError(t)) return t;
    const n = args[1] === undefined ? 1 : toNumber(args[1]);
    if (isError(n)) return n;
    if (n < 0) return ERRORS.VALUE;
    const k = Math.trunc(n);
    return k === 0 ? "" : t.slice(-k);
  },
  MID(args) {
    const t = toText(collapse(args[0]));
    if (isError(t)) return t;
    const start = toNumber(args[1]);
    const len = toNumber(args[2]);
    if (isError(start)) return start;
    if (isError(len)) return len;
    if (start < 1 || len < 0) return ERRORS.VALUE;
    return t.slice(Math.trunc(start) - 1, Math.trunc(start) - 1 + Math.trunc(len));
  },
  LEN(args) {
    const t = toText(collapse(args[0]));
    return isError(t) ? t : t.length;
  },
  TRIM(args) {
    const t = toText(collapse(args[0]));
    if (isError(t)) return t;
    // Excel TRIM also collapses interior runs of spaces
    return t.replace(/ +/g, " ").trim();
  },
  UPPER(args) {
    const t = toText(collapse(args[0]));
    return isError(t) ? t : t.toUpperCase();
  },
  LOWER(args) {
    const t = toText(collapse(args[0]));
    return isError(t) ? t : t.toLowerCase();
  },
  TEXT(args) {
    const n = toNumber(collapse(args[0]));
    if (isError(n)) return n;
    const fmt = toText(collapse(args[1]));
    if (isError(fmt)) return fmt;
    return formatNumber(n, fmt);
  },
  VALUE(args) {
    const v = collapse(args[0]);
    if (typeof v === "number") return v;
    const n = toNumber(v);
    return n;
  },
  SUBSTITUTE(args) {
    const t = toText(collapse(args[0]));
    if (isError(t)) return t;
    const oldText = toText(collapse(args[1]));
    if (isError(oldText)) return oldText;
    const newText = toText(collapse(args[2]));
    if (isError(newText)) return newText;
    if (oldText === "") return t;
    if (args[3] !== undefined) {
      const instance = toNumber(args[3]);
      if (isError(instance)) return instance;
      if (instance < 1) return ERRORS.VALUE;
      let idx = -1;
      for (let k = 0; k < Math.trunc(instance); k++) {
        idx = t.indexOf(oldText, idx + 1);
        if (idx === -1) return t;
      }
      return t.slice(0, idx) + newText + t.slice(idx + oldText.length);
    }
    return t.split(oldText).join(newText);
  },

  // ---- Math ----
  ROUND(args) {
    const n = toNumber(collapse(args[0]));
    const d = args[1] === undefined ? 0 : toNumber(args[1]);
    if (isError(n)) return n;
    if (isError(d)) return d;
    return excelRound(n, Math.trunc(d));
  },
  ROUNDUP(args) {
    const n = toNumber(collapse(args[0]));
    const d = args[1] === undefined ? 0 : toNumber(args[1]);
    if (isError(n)) return n;
    if (isError(d)) return d;
    const p = Math.pow(10, Math.trunc(d));
    const scaled = Number((Math.abs(n) * p).toPrecision(15));
    return Math.sign(n) * (Math.ceil(scaled) / p);
  },
  ROUNDDOWN(args) {
    const n = toNumber(collapse(args[0]));
    const d = args[1] === undefined ? 0 : toNumber(args[1]);
    if (isError(n)) return n;
    if (isError(d)) return d;
    const p = Math.pow(10, Math.trunc(d));
    const scaled = Number((Math.abs(n) * p).toPrecision(15));
    return Math.sign(n) * (Math.floor(scaled) / p);
  },
  ABS(args) {
    const n = toNumber(collapse(args[0]));
    return isError(n) ? n : Math.abs(n);
  },
  SQRT(args) {
    const n = toNumber(collapse(args[0]));
    if (isError(n)) return n;
    return n < 0 ? ERRORS.NUM : Math.sqrt(n);
  },
  POWER(args) {
    const base = toNumber(collapse(args[0]));
    const exp = toNumber(collapse(args[1]));
    if (isError(base)) return base;
    if (isError(exp)) return exp;
    const r = Math.pow(base, exp);
    if (Number.isNaN(r)) return ERRORS.NUM;
    if (!Number.isFinite(r)) return base === 0 && exp < 0 ? ERRORS.DIV0 : ERRORS.NUM;
    return r;
  },

  // ---- Dates ----
  TODAY(args, ctx) {
    const now = ctx && ctx.now ? ctx.now : new Date();
    return dateToSerial(now);
  },
  YEAR(args) {
    const s = parseDateValue(collapse(args[0]));
    return isError(s) ? s : serialToDate(s).getUTCFullYear();
  },
  MONTH(args) {
    const s = parseDateValue(collapse(args[0]));
    return isError(s) ? s : serialToDate(s).getUTCMonth() + 1;
  },
  DAY(args) {
    const s = parseDateValue(collapse(args[0]));
    return isError(s) ? s : serialToDate(s).getUTCDate();
  },
  DATE(args) {
    const y = toNumber(collapse(args[0]));
    const m = toNumber(collapse(args[1]));
    const d = toNumber(collapse(args[2]));
    if (isError(y)) return y;
    if (isError(m)) return m;
    if (isError(d)) return d;
    const utc = Date.UTC(Math.trunc(y), Math.trunc(m) - 1, Math.trunc(d));
    return Math.round((utc - SERIAL_EPOCH) / DAY_MS);
  },
  DATEDIF(args) {
    const start = parseDateValue(collapse(args[0]));
    const end = parseDateValue(collapse(args[1]));
    if (isError(start)) return start;
    if (isError(end)) return end;
    const unit = toText(collapse(args[2]));
    if (isError(unit)) return unit;
    if (end < start) return ERRORS.NUM;
    const a = serialToDate(start);
    const b = serialToDate(end);
    const u = unit.toUpperCase();
    if (u === "D") return end - start;
    if (u === "Y") return fullYears(a, b);
    if (u === "M") return fullMonths(a, b);
    if (u === "YM") return fullMonths(a, b) % 12;
    if (u === "MD") {
      // days ignoring months and years
      const anchor = Date.UTC(b.getUTCFullYear(), b.getUTCMonth() - (b.getUTCDate() < a.getUTCDate() ? 1 : 0), a.getUTCDate());
      return Math.round((Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) - anchor) / DAY_MS);
    }
    if (u === "YD") {
      const years = fullYears(a, b);
      const anchor = Date.UTC(a.getUTCFullYear() + years, a.getUTCMonth(), a.getUTCDate());
      return Math.round((Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) - anchor) / DAY_MS);
    }
    return ERRORS.NUM;
  },
  EOMONTH(args) {
    const s = parseDateValue(collapse(args[0]));
    if (isError(s)) return s;
    const months = toNumber(collapse(args[1]));
    if (isError(months)) return months;
    const d = serialToDate(s);
    const target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + Math.trunc(months) + 1, 0);
    return Math.round((target - SERIAL_EPOCH) / DAY_MS);
  },
  EDATE(args) {
    const s = parseDateValue(collapse(args[0]));
    if (isError(s)) return s;
    const months = toNumber(collapse(args[1]));
    if (isError(months)) return months;
    const d = serialToDate(s);
    const targetMonth = d.getUTCMonth() + Math.trunc(months);
    const lastDay = new Date(Date.UTC(d.getUTCFullYear(), targetMonth + 1, 0)).getUTCDate();
    const day = Math.min(d.getUTCDate(), lastDay);
    const target = Date.UTC(d.getUTCFullYear(), targetMonth, day);
    return Math.round((target - SERIAL_EPOCH) / DAY_MS);
  },
  WEEKDAY(args) {
    const s = parseDateValue(collapse(args[0]));
    if (isError(s)) return s;
    const type = args[1] === undefined ? 1 : toNumber(collapse(args[1]));
    if (isError(type)) return type;
    const dow = serialToDate(s).getUTCDay(); // 0=Sun..6=Sat
    if (type === 1) return dow + 1;
    if (type === 2) return dow === 0 ? 7 : dow;
    if (type === 3) return dow === 0 ? 6 : dow - 1;
    return ERRORS.NUM;
  },
  WEEKNUM(args) {
    const s = parseDateValue(collapse(args[0]));
    if (isError(s)) return s;
    const type = args[1] === undefined ? 1 : toNumber(collapse(args[1]));
    if (isError(type)) return type;
    const d = serialToDate(s);
    const jan1 = Date.UTC(d.getUTCFullYear(), 0, 1);
    const jan1Dow = new Date(jan1).getUTCDay();
    const daysSinceJan1 = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - jan1) / DAY_MS);
    if (type === 1) return Math.floor((daysSinceJan1 + jan1Dow) / 7) + 1;
    if (type === 2) {
      const jan1DowMon = (jan1Dow + 6) % 7;
      return Math.floor((daysSinceJan1 + jan1DowMon) / 7) + 1;
    }
    return ERRORS.NUM;
  },
  NETWORKDAYS(args) {
    const s0 = parseDateValue(collapse(args[0]));
    if (isError(s0)) return s0;
    const e0 = parseDateValue(collapse(args[1]));
    if (isError(e0)) return e0;
    let s = s0;
    let e = e0;
    let sign = 1;
    if (s > e) { [s, e] = [e, s]; sign = -1; }
    const holidays = new Set();
    if (args[2] !== undefined) {
      const vals = isRange(args[2]) ? args[2].flat() : [args[2]];
      for (const v of vals) {
        const hv = parseDateValue(v);
        if (!isError(hv)) holidays.add(hv);
      }
    }
    let count = 0;
    for (let day = s; day <= e; day++) {
      const dow = serialToDate(day).getUTCDay();
      if (dow !== 0 && dow !== 6 && !holidays.has(day)) count++;
    }
    return count * sign;
  },
  HOUR(args) {
    const n = toNumber(collapse(args[0]));
    if (isError(n)) return n;
    return timeParts(n).h;
  },
  MINUTE(args) {
    const n = toNumber(collapse(args[0]));
    if (isError(n)) return n;
    return timeParts(n).m;
  },
  SECOND(args) {
    const n = toNumber(collapse(args[0]));
    if (isError(n)) return n;
    return timeParts(n).s;
  },
  TIME(args) {
    const h = toNumber(collapse(args[0]));
    if (isError(h)) return h;
    const m = toNumber(collapse(args[1]));
    if (isError(m)) return m;
    const s = toNumber(collapse(args[2]));
    if (isError(s)) return s;
    let total = Math.trunc(h) * 3600 + Math.trunc(m) * 60 + Math.trunc(s);
    total = ((total % 86400) + 86400) % 86400;
    return total / 86400;
  },
  NOW(args, ctx) {
    const now = ctx && ctx.now ? ctx.now : new Date();
    const serial = dateToSerial(now);
    const frac = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
    return serial + frac;
  },

  // ---- Logic (additional) ----
  IFNA: {
    lazy: true,
    call(argAsts, evalArg) {
      const v = evalArg(argAsts[0]);
      if (isError(v) && v.code === "#N/A") return argAsts.length > 1 ? evalArg(argAsts[1]) : "";
      return v;
    },
  },
  SWITCH: {
    lazy: true,
    call(argAsts, evalArg) {
      if (argAsts.length < 2) return ERRORS.VALUE;
      const expr = collapse(evalArg(argAsts[0]));
      if (isError(expr)) return expr;
      let i = 1;
      for (; i + 1 < argAsts.length; i += 2) {
        const val = collapse(evalArg(argAsts[i]));
        if (isError(val)) return val;
        if (valueEquals(expr, val)) return evalArg(argAsts[i + 1]);
      }
      if (i < argAsts.length) return evalArg(argAsts[i]); // trailing default
      return ERRORS.NA;
    },
  },
  CHOOSE: {
    lazy: true,
    call(argAsts, evalArg) {
      if (argAsts.length < 2) return ERRORS.VALUE;
      const idxVal = toNumber(collapse(evalArg(argAsts[0])));
      if (isError(idxVal)) return idxVal;
      const idx = Math.trunc(idxVal);
      if (idx < 1 || idx > argAsts.length - 1) return ERRORS.VALUE;
      return evalArg(argAsts[idx]);
    },
  },
  ROW: {
    lazy: true,
    call(argAsts) {
      if (argAsts.length === 0) return ERRORS.VALUE; // current-cell position isn't threaded into ctx
      const node = argAsts[0];
      if (node.type === "ref") return node.row + 1;
      if (node.type === "range") return (node.top ?? 0) + 1;
      return ERRORS.VALUE;
    },
  },
  COLUMN: {
    lazy: true,
    call(argAsts) {
      if (argAsts.length === 0) return ERRORS.VALUE;
      const node = argAsts[0];
      if (node.type === "ref") return node.col + 1;
      if (node.type === "range") return (node.left ?? 0) + 1;
      return ERRORS.VALUE;
    },
  },
  ROWS(args) {
    const a = args[0];
    return isRange(a) ? a.rows : 1;
  },
  COLUMNS(args) {
    const a = args[0];
    return isRange(a) ? a.cols : 1;
  },
  NA() {
    return ERRORS.NA;
  },
  ISNA(args) {
    const v = collapse(args[0]);
    return isError(v) && v.code === "#N/A";
  },
  ISLOGICAL(args) {
    return typeof collapse(args[0]) === "boolean";
  },
  ISEVEN(args) {
    const n = toNumber(collapse(args[0]));
    return isError(n) ? n : Math.trunc(n) % 2 === 0;
  },
  ISODD(args) {
    const n = toNumber(collapse(args[0]));
    return isError(n) ? n : Math.abs(Math.trunc(n) % 2) === 1;
  },
  N(args) {
    const v = collapse(args[0]);
    if (isError(v)) return v;
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v ? 1 : 0;
    return 0;
  },
  T(args) {
    const v = collapse(args[0]);
    if (isError(v)) return v;
    return typeof v === "string" ? v : "";
  },

  // ---- Lookup (additional) ----
  LOOKUP(args) {
    const lookup = collapse(args[0]);
    if (isError(lookup)) return lookup;
    const arr1 = args[1];
    if (args.length >= 3) {
      const vec = asVector(arr1);
      if (isError(vec)) return vec;
      const resVec = asVector(args[2]);
      if (isError(resVec)) return resVec;
      const idx = findIndex(vec, lookup, -1, false);
      return idx === -1 ? ERRORS.NA : resVec[idx];
    }
    if (!isRange(arr1)) {
      const vec = asVector(arr1);
      if (isError(vec)) return vec;
      const idx = findIndex(vec, lookup, -1, false);
      return idx === -1 ? ERRORS.NA : vec[idx];
    }
    if (arr1.rows >= arr1.cols) {
      const vec = arr1.values.map((r) => r[0]);
      const idx = findIndex(vec, lookup, -1, false);
      if (idx === -1) return ERRORS.NA;
      return arr1.values[idx][arr1.cols - 1];
    }
    const vec = arr1.values[0];
    const idx = findIndex(vec, lookup, -1, false);
    if (idx === -1) return ERRORS.NA;
    return arr1.values[arr1.rows - 1][idx];
  },

  // ---- Aggregation (additional) ----
  COUNTBLANK(args) {
    const range = args[0];
    const vals = isRange(range) ? range.flat() : [range];
    let count = 0;
    for (const v of vals) {
      if (v === undefined || v === null || v === "") count++;
    }
    return count;
  },
  SUMPRODUCT(args) {
    if (args.length === 0) return ERRORS.VALUE;
    const err = firstError(args);
    if (err) return err;
    const arrays = args.map((a) => (isRange(a) ? a : new RangeValue([[a]])));
    const rows = arrays[0].rows;
    const cols = arrays[0].cols;
    for (const a of arrays) {
      if (a.rows !== rows || a.cols !== cols) return ERRORS.VALUE;
    }
    let sum = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let prod = 1;
        for (const a of arrays) {
          const v = a.values[r][c];
          const n = typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : 0;
          prod *= n;
        }
        sum += prod;
      }
    }
    return sum;
  },
  PRODUCT(args) {
    const nums = collectNumbers(args);
    if (isError(nums)) return nums;
    return nums.length === 0 ? 0 : nums.reduce((a, b) => a * b, 1);
  },
  SUMSQ(args) {
    const nums = collectNumbers(args);
    if (isError(nums)) return nums;
    return nums.reduce((a, b) => a + b * b, 0);
  },
  AVERAGEA(args) {
    const err = firstError(args);
    if (err) return err;
    let sum = 0;
    let n = 0;
    for (const a of args) {
      if (isRange(a)) {
        for (const v of a.flat()) {
          if (v === undefined || v === null) continue;
          if (typeof v === "number") { sum += v; n++; }
          else if (typeof v === "boolean") { sum += v ? 1 : 0; n++; }
          else { n++; } // text inside ranges counts as 0
        }
      } else if (a !== undefined && a !== null) {
        const num = typeof a === "string" ? 0 : toNumber(a);
        if (isError(num)) return num;
        sum += num;
        n++;
      }
    }
    return n === 0 ? ERRORS.DIV0 : sum / n;
  },
  LARGE(args) {
    const nums = collectNumbers([args[0]]);
    if (isError(nums)) return nums;
    const k = toNumber(collapse(args[1]));
    if (isError(k)) return k;
    const kk = Math.trunc(k);
    if (kk < 1 || kk > nums.length) return ERRORS.NUM;
    const sorted = nums.slice().sort((a, b) => b - a);
    return sorted[kk - 1];
  },
  SMALL(args) {
    const nums = collectNumbers([args[0]]);
    if (isError(nums)) return nums;
    const k = toNumber(collapse(args[1]));
    if (isError(k)) return k;
    const kk = Math.trunc(k);
    if (kk < 1 || kk > nums.length) return ERRORS.NUM;
    const sorted = nums.slice().sort((a, b) => a - b);
    return sorted[kk - 1];
  },
  RANK(args) {
    return rankOf(args);
  },
  "RANK.EQ"(args) {
    return rankOf(args);
  },
  MODE(args) {
    return modeOf(args);
  },
  "MODE.SNGL"(args) {
    return modeOf(args);
  },
  GEOMEAN(args) {
    const nums = collectNumbers(args);
    if (isError(nums)) return nums;
    if (nums.length === 0) return ERRORS.NUM;
    for (const v of nums) if (v <= 0) return ERRORS.NUM;
    const logSum = nums.reduce((a, b) => a + Math.log(b), 0);
    return Math.exp(logSum / nums.length);
  },
  HARMEAN(args) {
    const nums = collectNumbers(args);
    if (isError(nums)) return nums;
    if (nums.length === 0) return ERRORS.NUM;
    for (const v of nums) if (v <= 0) return ERRORS.NUM;
    const sumRecip = nums.reduce((a, b) => a + 1 / b, 0);
    return nums.length / sumRecip;
  },

  // ---- Math (additional) ----
  MOD(args) {
    const n = toNumber(collapse(args[0]));
    if (isError(n)) return n;
    const d = toNumber(collapse(args[1]));
    if (isError(d)) return d;
    if (d === 0) return ERRORS.DIV0;
    return n - d * Math.floor(n / d);
  },
  MROUND(args) {
    const n = toNumber(collapse(args[0]));
    if (isError(n)) return n;
    const m = toNumber(collapse(args[1]));
    if (isError(m)) return m;
    if (m === 0) return 0;
    if ((n < 0 && m > 0) || (n > 0 && m < 0)) return ERRORS.NUM;
    return Number((Math.round(n / m) * m).toPrecision(15));
  },
  CEILING(args) {
    const n = toNumber(collapse(args[0]));
    if (isError(n)) return n;
    const sig = args[1] === undefined ? 1 : toNumber(collapse(args[1]));
    if (isError(sig)) return sig;
    if (sig === 0 || n === 0) return 0;
    if ((n > 0 && sig < 0) || (n < 0 && sig > 0)) return ERRORS.NUM;
    return Number((Math.ceil(n / sig) * sig).toPrecision(15));
  },
  "CEILING.MATH"(args) {
    const n = toNumber(collapse(args[0]));
    if (isError(n)) return n;
    let sig = args[1] === undefined ? 1 : toNumber(collapse(args[1]));
    if (isError(sig)) return sig;
    sig = Math.abs(sig);
    const mode = args[2] === undefined ? 0 : toNumber(collapse(args[2]));
    if (isError(mode)) return mode;
    if (sig === 0) return 0;
    if (n < 0 && mode !== 0) return Number((Math.floor(n / sig) * sig).toPrecision(15));
    return Number((Math.ceil(n / sig) * sig).toPrecision(15));
  },
  FLOOR(args) {
    const n = toNumber(collapse(args[0]));
    if (isError(n)) return n;
    const sig = args[1] === undefined ? 1 : toNumber(collapse(args[1]));
    if (isError(sig)) return sig;
    if (sig === 0) return ERRORS.DIV0;
    if (n === 0) return 0;
    if ((n > 0 && sig < 0) || (n < 0 && sig > 0)) return ERRORS.NUM;
    return Number((Math.floor(n / sig) * sig).toPrecision(15));
  },
  "FLOOR.MATH"(args) {
    const n = toNumber(collapse(args[0]));
    if (isError(n)) return n;
    let sig = args[1] === undefined ? 1 : toNumber(collapse(args[1]));
    if (isError(sig)) return sig;
    sig = Math.abs(sig);
    const mode = args[2] === undefined ? 0 : toNumber(collapse(args[2]));
    if (isError(mode)) return mode;
    if (sig === 0) return 0;
    if (n < 0 && mode !== 0) return Number((Math.ceil(n / sig) * sig).toPrecision(15));
    return Number((Math.floor(n / sig) * sig).toPrecision(15));
  },
  INT(args) {
    const n = toNumber(collapse(args[0]));
    return isError(n) ? n : Math.floor(n);
  },
  TRUNC(args) {
    const n = toNumber(collapse(args[0]));
    if (isError(n)) return n;
    const d = args[1] === undefined ? 0 : toNumber(collapse(args[1]));
    if (isError(d)) return d;
    const p = Math.pow(10, Math.trunc(d));
    return Math.trunc(n * p) / p;
  },
  SIGN(args) {
    const n = toNumber(collapse(args[0]));
    return isError(n) ? n : Math.sign(n);
  },
  EXP(args) {
    const n = toNumber(collapse(args[0]));
    return isError(n) ? n : Math.exp(n);
  },
  LN(args) {
    const n = toNumber(collapse(args[0]));
    if (isError(n)) return n;
    return n <= 0 ? ERRORS.NUM : Math.log(n);
  },
  LOG(args) {
    const n = toNumber(collapse(args[0]));
    if (isError(n)) return n;
    const base = args[1] === undefined ? 10 : toNumber(collapse(args[1]));
    if (isError(base)) return base;
    if (n <= 0 || base <= 0 || base === 1) return ERRORS.NUM;
    return Math.log(n) / Math.log(base);
  },
  LOG10(args) {
    const n = toNumber(collapse(args[0]));
    if (isError(n)) return n;
    return n <= 0 ? ERRORS.NUM : Math.log10(n);
  },
  GCD(args) {
    const nums = collectNumbers(args);
    if (isError(nums)) return nums;
    if (nums.length === 0) return ERRORS.NUM;
    for (const v of nums) if (v < 0 || !Number.isInteger(v)) return ERRORS.NUM;
    return nums.reduce((a, b) => gcd2(a, b), 0);
  },
  LCM(args) {
    const nums = collectNumbers(args);
    if (isError(nums)) return nums;
    if (nums.length === 0) return ERRORS.NUM;
    for (const v of nums) if (v < 0 || !Number.isInteger(v)) return ERRORS.NUM;
    if (nums.some((v) => v === 0)) return 0;
    return nums.reduce((a, b) => Math.abs(a * b) / gcd2(a, b), 1);
  },
  FACT(args) {
    const n = toNumber(collapse(args[0]));
    if (isError(n)) return n;
    if (n < 0) return ERRORS.NUM;
    const k = Math.floor(n);
    let r = 1;
    for (let i = 2; i <= k; i++) r *= i;
    return r;
  },
  COMBIN(args) {
    const nRaw = toNumber(collapse(args[0]));
    if (isError(nRaw)) return nRaw;
    const kRaw = toNumber(collapse(args[1]));
    if (isError(kRaw)) return kRaw;
    const n = Math.trunc(nRaw);
    const k = Math.trunc(kRaw);
    if (n < 0 || k < 0 || k > n) return ERRORS.NUM;
    const kk = Math.min(k, n - k);
    let r = 1;
    for (let i = 0; i < kk; i++) r = (r * (n - i)) / (i + 1);
    return Math.round(r);
  },

  // ---- Text (additional) ----
  PROPER(args) {
    const t = toText(collapse(args[0]));
    if (isError(t)) return t;
    return t.toLowerCase().replace(/(^|[^A-Za-z])([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
  },
  TEXTJOIN(args) {
    const delimiter = toText(collapse(args[0]));
    if (isError(delimiter)) return delimiter;
    const ignoreEmpty = toBool(collapse(args[1]));
    if (isError(ignoreEmpty)) return ignoreEmpty;
    const parts = [];
    for (const v of flattenArgs(args.slice(2))) {
      const t = toText(v);
      if (isError(t)) return t;
      if (ignoreEmpty && t === "") continue;
      parts.push(t);
    }
    return parts.join(delimiter);
  },
  NUMBERVALUE(args) {
    const raw = toText(collapse(args[0]));
    if (isError(raw)) return raw;
    const decSep = args[1] === undefined ? "." : toText(collapse(args[1]));
    if (isError(decSep)) return decSep;
    const groupSep = args[2] === undefined ? "," : toText(collapse(args[2]));
    if (isError(groupSep)) return groupSep;
    let s = raw.trim();
    if (s === "") return ERRORS.VALUE;
    const isPercent = s.endsWith("%");
    if (isPercent) s = s.slice(0, -1).trim();
    s = s.split(groupSep).join("");
    if (decSep !== ".") s = s.split(decSep).join(".");
    const n = Number(s);
    if (!Number.isFinite(n)) return ERRORS.VALUE;
    return isPercent ? n / 100 : n;
  },
  REPT(args) {
    const t = toText(collapse(args[0]));
    if (isError(t)) return t;
    const n = toNumber(collapse(args[1]));
    if (isError(n)) return n;
    if (n < 0) return ERRORS.VALUE;
    return t.repeat(Math.trunc(n));
  },
  FIND(args) {
    const findText = toText(collapse(args[0]));
    if (isError(findText)) return findText;
    const within = toText(collapse(args[1]));
    if (isError(within)) return within;
    const startArg = args[2] === undefined ? 1 : toNumber(collapse(args[2]));
    if (isError(startArg)) return startArg;
    const start = Math.trunc(startArg);
    if (start < 1 || start > within.length + 1) return ERRORS.VALUE;
    const idx = within.indexOf(findText, start - 1);
    return idx === -1 ? ERRORS.VALUE : idx + 1;
  },
  SEARCH(args) {
    const findText = toText(collapse(args[0]));
    if (isError(findText)) return findText;
    const within = toText(collapse(args[1]));
    if (isError(within)) return within;
    const startArg = args[2] === undefined ? 1 : toNumber(collapse(args[2]));
    if (isError(startArg)) return startArg;
    const start = Math.trunc(startArg);
    if (start < 1 || start > within.length + 1) return ERRORS.VALUE;
    const startIdx = start - 1;
    const sub = within.slice(startIdx);
    let idx;
    if (hasWildcard(findText)) {
      const re = wildcardToRegExpLoose(findText);
      const m = re.exec(sub);
      idx = m ? m.index : -1;
    } else {
      idx = sub.toLowerCase().indexOf(findText.toLowerCase());
    }
    return idx === -1 ? ERRORS.VALUE : startIdx + idx + 1;
  },
  REPLACE(args) {
    const old = toText(collapse(args[0]));
    if (isError(old)) return old;
    const start = toNumber(collapse(args[1]));
    if (isError(start)) return start;
    const numChars = toNumber(collapse(args[2]));
    if (isError(numChars)) return numChars;
    const newText = toText(collapse(args[3]));
    if (isError(newText)) return newText;
    if (start < 1 || numChars < 0) return ERRORS.VALUE;
    const s = Math.trunc(start) - 1;
    const k = Math.trunc(numChars);
    return old.slice(0, s) + newText + old.slice(s + k);
  },
  EXACT(args) {
    const a = toText(collapse(args[0]));
    if (isError(a)) return a;
    const b = toText(collapse(args[1]));
    if (isError(b)) return b;
    return a === b;
  },
  CLEAN(args) {
    const t = toText(collapse(args[0]));
    if (isError(t)) return t;
    return t.replace(/[\x00-\x1F]/g, "");
  },
  CHAR(args) {
    const n = toNumber(collapse(args[0]));
    if (isError(n)) return n;
    const k = Math.trunc(n);
    if (k < 1 || k > 255) return ERRORS.VALUE;
    return String.fromCharCode(k);
  },
  CODE(args) {
    const t = toText(collapse(args[0]));
    if (isError(t)) return t;
    if (t.length === 0) return ERRORS.VALUE;
    return t.charCodeAt(0);
  },
  UNICHAR(args) {
    const n = toNumber(collapse(args[0]));
    if (isError(n)) return n;
    const k = Math.trunc(n);
    if (k <= 0) return ERRORS.VALUE;
    return String.fromCodePoint(k);
  },

  // ---- Finance ----
  PMT(args) {
    const rate = toNumber(collapse(args[0]));
    if (isError(rate)) return rate;
    const nper = toNumber(collapse(args[1]));
    if (isError(nper)) return nper;
    const pv = toNumber(collapse(args[2]));
    if (isError(pv)) return pv;
    const fv = args[3] === undefined ? 0 : toNumber(collapse(args[3]));
    if (isError(fv)) return fv;
    const type = args[4] === undefined ? 0 : toNumber(collapse(args[4]));
    if (isError(type)) return type;
    if (rate === 0) return -(pv + fv) / nper;
    const growth = Math.pow(1 + rate, nper);
    return (-(fv + pv * growth) * rate) / ((growth - 1) * (1 + rate * type));
  },
  FV(args) {
    const rate = toNumber(collapse(args[0]));
    if (isError(rate)) return rate;
    const nper = toNumber(collapse(args[1]));
    if (isError(nper)) return nper;
    const pmt = toNumber(collapse(args[2]));
    if (isError(pmt)) return pmt;
    const pv = args[3] === undefined ? 0 : toNumber(collapse(args[3]));
    if (isError(pv)) return pv;
    const type = args[4] === undefined ? 0 : toNumber(collapse(args[4]));
    if (isError(type)) return type;
    if (rate === 0) return -(pv + pmt * nper);
    const growth = Math.pow(1 + rate, nper);
    return -(pv * growth + (pmt * (1 + rate * type) * (growth - 1)) / rate);
  },
  PV(args) {
    const rate = toNumber(collapse(args[0]));
    if (isError(rate)) return rate;
    const nper = toNumber(collapse(args[1]));
    if (isError(nper)) return nper;
    const pmt = toNumber(collapse(args[2]));
    if (isError(pmt)) return pmt;
    const fv = args[3] === undefined ? 0 : toNumber(collapse(args[3]));
    if (isError(fv)) return fv;
    const type = args[4] === undefined ? 0 : toNumber(collapse(args[4]));
    if (isError(type)) return type;
    if (rate === 0) return -(fv + pmt * nper);
    const growth = Math.pow(1 + rate, nper);
    return -(fv + (pmt * (1 + rate * type) * (growth - 1)) / rate) / growth;
  },
  NPER(args) {
    const rate = toNumber(collapse(args[0]));
    if (isError(rate)) return rate;
    const pmt = toNumber(collapse(args[1]));
    if (isError(pmt)) return pmt;
    const pv = toNumber(collapse(args[2]));
    if (isError(pv)) return pv;
    const fv = args[3] === undefined ? 0 : toNumber(collapse(args[3]));
    if (isError(fv)) return fv;
    const type = args[4] === undefined ? 0 : toNumber(collapse(args[4]));
    if (isError(type)) return type;
    if (rate === 0) {
      if (pmt === 0) return ERRORS.DIV0;
      return -(pv + fv) / pmt;
    }
    const num = pmt * (1 + rate * type) - fv * rate;
    const den = pmt * (1 + rate * type) + pv * rate;
    if (den === 0) return ERRORS.NUM;
    const ratio = num / den;
    if (ratio <= 0) return ERRORS.NUM;
    const n = Math.log(ratio) / Math.log(1 + rate);
    return Number.isFinite(n) ? n : ERRORS.NUM;
  },
  RATE(args) {
    const nper = toNumber(collapse(args[0]));
    if (isError(nper)) return nper;
    const pmt = toNumber(collapse(args[1]));
    if (isError(pmt)) return pmt;
    const pv = toNumber(collapse(args[2]));
    if (isError(pv)) return pv;
    const fv = args[3] === undefined ? 0 : toNumber(collapse(args[3]));
    if (isError(fv)) return fv;
    const type = args[4] === undefined ? 0 : toNumber(collapse(args[4]));
    if (isError(type)) return type;
    const guess = args[5] === undefined ? 0.1 : toNumber(collapse(args[5]));
    if (isError(guess)) return guess;
    const f = (r) => {
      if (r === 0) return pv + pmt * nper + fv;
      const growth = Math.pow(1 + r, nper);
      return pv * growth + pmt * (1 + r * type) * ((growth - 1) / r) + fv;
    };
    let r = guess;
    for (let i = 0; i < 100; i++) {
      const y0 = f(r);
      const h = 1e-6;
      const y1 = f(r + h);
      const deriv = (y1 - y0) / h;
      if (deriv === 0 || !Number.isFinite(deriv)) return ERRORS.NUM;
      const next = r - y0 / deriv;
      if (!Number.isFinite(next)) return ERRORS.NUM;
      if (Math.abs(next - r) < 1e-10) return next;
      r = next;
    }
    return Math.abs(f(r)) < 1e-4 ? r : ERRORS.NUM;
  },
  NPV(args) {
    const rate = toNumber(collapse(args[0]));
    if (isError(rate)) return rate;
    const nums = collectNumbers(args.slice(1));
    if (isError(nums)) return nums;
    let sum = 0;
    for (let i = 0; i < nums.length; i++) sum += nums[i] / Math.pow(1 + rate, i + 1);
    return sum;
  },
  IRR(args) {
    const range = args[0];
    if (!isRange(range)) return ERRORS.VALUE;
    const values = range.flat().filter((v) => typeof v === "number");
    if (values.length < 2) return ERRORS.NUM;
    if (!values.some((v) => v > 0) || !values.some((v) => v < 0)) return ERRORS.NUM;
    const guessArg = args[1];
    const guess = guessArg === undefined ? 0.1 : toNumber(collapse(guessArg));
    if (isError(guess)) return guess;
    const npvAt = (r) => values.reduce((acc, v, i) => acc + v / Math.pow(1 + r, i), 0);
    const dnpvAt = (r) => values.reduce((acc, v, i) => (i === 0 ? acc : acc - (i * v) / Math.pow(1 + r, i + 1)), 0);
    let r = guess;
    for (let i = 0; i < 100; i++) {
      const y = npvAt(r);
      if (Math.abs(y) < 1e-7) return r;
      const d = dnpvAt(r);
      if (d === 0 || !Number.isFinite(d)) return ERRORS.NUM;
      const next = r - y / d;
      if (!Number.isFinite(next) || next <= -1) return ERRORS.NUM;
      r = next;
    }
    return Math.abs(npvAt(r)) < 1e-4 ? r : ERRORS.NUM;
  },
};

function fullYears(a, b) {
  let y = b.getUTCFullYear() - a.getUTCFullYear();
  const anniversaryNotReached =
    b.getUTCMonth() < a.getUTCMonth() ||
    (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate());
  if (anniversaryNotReached) y--;
  return y;
}

function fullMonths(a, b) {
  let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) m--;
  return m;
}

/** Collapse a 1x1 RangeValue to its scalar; leave everything else alone. */
function collapse(v) {
  if (isRange(v) && v.rows === 1 && v.cols === 1) return v.values[0][0];
  return v;
}

function logicalFold(args, combine, init) {
  let acc = init;
  let found = false;
  const err = firstError(args);
  if (err) return err;
  for (const a of args) {
    if (isRange(a)) {
      for (const v of a.flat()) {
        if (typeof v === "boolean" || typeof v === "number") {
          acc = combine(acc, v !== 0 && v !== false);
          found = true;
        }
        // text and blanks inside ranges are ignored, like Excel
      }
    } else if (a !== undefined && a !== null) {
      const b = toBool(a);
      if (isError(b)) return b;
      acc = combine(acc, b);
      found = true;
    }
  }
  return found ? acc : ERRORS.VALUE;
}

function sampleVariance(args) {
  const nums = collectNumbers(args);
  if (isError(nums)) return nums;
  const n = nums.length;
  if (n < 2) return ERRORS.DIV0;
  const mean = nums.reduce((a, b) => a + b, 0) / n;
  return nums.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1);
}

function populationVariance(args) {
  const nums = collectNumbers(args);
  if (isError(nums)) return nums;
  const n = nums.length;
  if (n < 1) return ERRORS.DIV0;
  const mean = nums.reduce((a, b) => a + b, 0) / n;
  return nums.reduce((a, x) => a + (x - mean) ** 2, 0) / n;
}

/**
 * Shared engine for SUMIFS/AVERAGEIFS: args are (target, cRange1, c1, ...).
 * @returns {{sum: number, n: number} | FormulaError}
 */
function ifsAccumulate(args) {
  const target = args[0];
  if (!isRange(target)) return ERRORS.VALUE;
  const pairs = criteriaPairs(args.slice(1), target.flat().length);
  if (isError(pairs)) return pairs;
  const dst = target.flat();
  let sum = 0;
  let n = 0;
  for (let i = 0; i < dst.length; i++) {
    if (pairs.every((p) => p.test(p.values[i]))) {
      const v = dst[i];
      if (isError(v)) return v;
      if (typeof v === "number") { sum += v; n++; }
    }
  }
  return { sum, n };
}

function countMatchingRows(args) {
  const pairs = criteriaPairs(args, null);
  if (isError(pairs)) return pairs;
  if (pairs.length === 0) return ERRORS.VALUE;
  const len = pairs[0].values.length;
  let count = 0;
  for (let i = 0; i < len; i++) {
    if (pairs.every((p) => p.test(p.values[i]))) count++;
  }
  return count;
}

function criteriaPairs(args, expectedLen) {
  const pairs = [];
  for (let i = 0; i < args.length; i += 2) {
    if (i + 1 >= args.length) return ERRORS.VALUE;
    const range = args[i];
    if (!isRange(range)) return ERRORS.VALUE;
    const values = range.flat();
    if (expectedLen !== null && values.length !== expectedLen) return ERRORS.VALUE;
    if (pairs.length > 0 && values.length !== pairs[0].values.length) return ERRORS.VALUE;
    pairs.push({ values, test: compileCriteria(args[i + 1]) });
  }
  return pairs;
}

/** Extract hour/minute/second from a (possibly fractional) date serial. */
function timeParts(n) {
  const frac = ((n % 1) + 1) % 1;
  const totalSeconds = Math.round(frac * 86400);
  const h = Math.floor(totalSeconds / 3600) % 24;
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return { h, m, s };
}

/** Euclid's algorithm on absolute integer values. */
function gcd2(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) { [x, y] = [y, x % y]; }
  return x;
}

/** Shared RANK/RANK.EQ: 1-based rank, ties get the same (best) rank. */
function rankOf(args) {
  const n = toNumber(collapse(args[0]));
  if (isError(n)) return n;
  const nums = collectNumbers([args[1]]);
  if (isError(nums)) return nums;
  const order = args[2] === undefined ? 0 : toNumber(collapse(args[2]));
  if (isError(order)) return order;
  const ascending = order !== 0;
  if (!nums.includes(n)) return ERRORS.NA;
  let rank = 1;
  for (const v of nums) {
    if (ascending ? v < n : v > n) rank++;
  }
  return rank;
}

/** Shared MODE/MODE.SNGL: most frequent value, first-encountered on ties. */
function modeOf(args) {
  const nums = collectNumbers(args);
  if (isError(nums)) return nums;
  const freq = new Map();
  for (const v of nums) freq.set(v, (freq.get(v) || 0) + 1);
  let maxFreq = 0;
  for (const v of nums) if (freq.get(v) > maxFreq) maxFreq = freq.get(v);
  if (maxFreq < 2) return ERRORS.NA;
  for (const v of nums) if (freq.get(v) === maxFreq) return v;
  return ERRORS.NA;
}
