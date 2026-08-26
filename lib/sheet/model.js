// The Sheet model: create/get/set cells, dependency graph, incremental
// topological recalc, circular-reference detection, JSON (de)serialization.
//
// A sheet is a mutable plain object; the exported functions operate on it.
// Recalc is incremental: setting a cell recomputes only that cell and its
// transitive dependents (dirty set), evaluated in topological order.

import {
  parseRef, parseRange, cellKey, rangeContains, MAX_ROWS,
} from "./cells.js";
import { parseFormula, translateFormula } from "./parser.js";
import { evaluateAst, extractDependencies } from "./evaluate.js";
import { ERRORS, isError, isRange, RangeValue, FormulaError, errorFromCode } from "./functions.js";
import { parseCsv, inferValue } from "./csv.js";

/**
 * Create an empty sheet.
 * @param {string} [name]
 * @returns {object} sheet
 */
export function createSheet(name = "Sheet1") {
  return {
    name,
    cells: new Map(),        // key "A1" -> record
    dependents: new Map(),   // key -> Set of formula-cell keys that reference it directly
    rangeDeps: new Map(),    // formula-cell key -> array of range objects it references
    maxRow: -1,              // used bounds (for clamping full-column ranges)
    maxCol: -1,
    now: null,               // injectable Date for TODAY() in tests
  };
}

// record shape:
// { input, value, isFormula, ast, precedents: {cells: string[], ranges: object[]} }

/**
 * Resolve a ref argument that may be an "A1" string or a {row, col} object.
 * @returns {{row: number, col: number}}
 */
function resolveRef(ref) {
  if (typeof ref === "string") {
    const parsed = parseRef(ref);
    if (!parsed) throw new Error(`Invalid cell reference: ${ref}`);
    return parsed;
  }
  return ref;
}

/**
 * Set a cell from user input and incrementally recalc dependents.
 * Input semantics match Excel entry:
 *   - strings starting with "=" are formulas
 *   - numeric strings become numbers, "TRUE"/"FALSE" become booleans
 *   - a leading apostrophe forces text ("'0042" -> "0042")
 *   - numbers/booleans pass through; null/undefined/"" clears the cell
 * @param {object} sheet
 * @param {string|{row:number,col:number}} ref
 * @param {*} input
 */
export function setCell(sheet, ref, input) {
  const { row, col } = resolveRef(ref);
  const key = cellKey(row, col);
  writeCell(sheet, key, row, col, input);
  recalc(sheet, [key]);
}

/**
 * Batch-set many cells, then recalc once. Much faster than repeated setCell
 * for bulk loads (e.g. CSV import).
 * @param {object} sheet
 * @param {Object<string, *>|Array<[string, *]>} entries map/pairs of A1 -> input
 */
export function setCells(sheet, entries) {
  const pairs = Array.isArray(entries) ? entries : Object.entries(entries);
  const seeds = [];
  for (const [ref, input] of pairs) {
    const { row, col } = resolveRef(ref);
    const key = cellKey(row, col);
    writeCell(sheet, key, row, col, input);
    seeds.push(key);
  }
  recalc(sheet, seeds);
}

/**
 * Clear a cell entirely.
 */
export function clearCell(sheet, ref) {
  setCell(sheet, ref, null);
}

/**
 * Get the full cell record: { input, value, isFormula } (or null if empty).
 */
export function getCell(sheet, ref) {
  const { row, col } = resolveRef(ref);
  const rec = sheet.cells.get(cellKey(row, col));
  if (!rec) return null;
  return { input: rec.input, value: rec.value, isFormula: rec.isFormula };
}

/**
 * Get a cell's computed value (undefined for blank cells; FormulaError for
 * error results).
 */
export function getValue(sheet, ref) {
  const { row, col } = resolveRef(ref);
  const rec = sheet.cells.get(cellKey(row, col));
  return rec ? rec.value : undefined;
}

/**
 * Get computed values of a range as a 2D row-major array.
 * @param {object} sheet
 * @param {string} rangeStr e.g. "A1:C10"
 * @returns {Array<Array<*>>}
 */
export function getRangeValues(sheet, rangeStr) {
  const range = parseRangeArg(rangeStr);
  const clamped = clampRange(sheet, range);
  const out = [];
  for (let r = clamped.top; r <= clamped.bottom; r++) {
    const row = [];
    for (let c = clamped.left; c <= clamped.right; c++) {
      const rec = sheet.cells.get(cellKey(r, c));
      row.push(rec ? rec.value : undefined);
    }
    out.push(row);
  }
  return out;
}

function parseRangeArg(rangeStr) {
  // cells.parseRange handles "A1", "A1:C10", and full-column "B:B"
  const parsed = typeof rangeStr === "string" ? parseRange(rangeStr) : rangeStr;
  if (!parsed) throw new Error(`Invalid range: ${rangeStr}`);
  return parsed;
}

/**
 * Copy a cell to another location, translating relative references the way
 * Excel does on copy/paste. Literals copy verbatim.
 * @param {object} sheet
 * @param {string} fromRef A1
 * @param {string} toRef A1
 */
export function copyCell(sheet, fromRef, toRef) {
  const from = resolveRef(fromRef);
  const to = resolveRef(toRef);
  const rec = sheet.cells.get(cellKey(from.row, from.col));
  if (!rec) {
    setCell(sheet, toRef, null);
    return;
  }
  if (rec.isFormula) {
    setCell(sheet, toRef, translateFormula(rec.input, to.row - from.row, to.col - from.col));
  } else {
    setCell(sheet, toRef, rec.input);
  }
}

/**
 * Render a computed value the way a cell would display it.
 * @returns {string}
 */
export function formatValue(v) {
  if (v === undefined || v === null) return "";
  if (isError(v)) return v.code;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v);
    // trim float noise like Excel's general format
    return String(Number(v.toPrecision(11)));
  }
  return String(v);
}

/**
 * Serialize a sheet to a plain-JSON object: only inputs are stored; values
 * are recomputed on load.
 * @returns {{name: string, cells: Object<string, {input: *}>}}
 */
export function serializeSheet(sheet) {
  const cells = {};
  for (const [key, rec] of sheet.cells) {
    cells[key] = { input: rec.input };
  }
  return { name: sheet.name, cells };
}

/**
 * Rebuild a sheet from serializeSheet() output (full recalc).
 * @returns {object} sheet
 */
export function deserializeSheet(data) {
  const sheet = createSheet(data.name || "Sheet1");
  const entries = Object.entries(data.cells || {}).map(([key, cell]) => [key, cell.input]);
  setCells(sheet, entries);
  return sheet;
}

/**
 * Load CSV text into the sheet starting at origin (default A1), inferring
 * numbers/booleans but keeping leading-zero codes (zip codes) as text.
 * @param {object} sheet
 * @param {string} csvText
 * @param {{origin?: string, inferTypes?: boolean}} [opts]
 * @returns {{rows: number, cols: number, range: string}} extent loaded
 */
export function loadCsv(sheet, csvText, opts = {}) {
  const origin = resolveRef(opts.origin || "A1");
  const infer = opts.inferTypes !== false;
  const grid = parseCsv(csvText);
  const entries = [];
  let maxCols = 0;
  for (let r = 0; r < grid.length; r++) {
    maxCols = Math.max(maxCols, grid[r].length);
    for (let c = 0; c < grid[r].length; c++) {
      const raw = grid[r][c];
      const value = infer ? inferValue(raw) : raw;
      entries.push([{ row: origin.row + r, col: origin.col + c }, value]);
    }
  }
  setCells(sheet, entries);
  const last = cellKey(origin.row + grid.length - 1, origin.col + maxCols - 1);
  return {
    rows: grid.length,
    cols: maxCols,
    range: cellKey(origin.row, origin.col) + ":" + last,
  };
}

/**
 * The sheet's used range as an A1 string ("A1:G101"), or null when empty.
 */
export function usedRange(sheet) {
  if (sheet.maxRow < 0) return null;
  return "A1:" + cellKey(sheet.maxRow, sheet.maxCol);
}

// ---------------------------------------------------------------------------
// Internals: write, dependency graph, recalc
// ---------------------------------------------------------------------------

function writeCell(sheet, key, row, col, input) {
  const old = sheet.cells.get(key);
  if (old && old.isFormula) unregisterPrecedents(sheet, key, old);

  if (input === null || input === undefined || input === "") {
    sheet.cells.delete(key);
    return;
  }

  sheet.maxRow = Math.max(sheet.maxRow, row);
  sheet.maxCol = Math.max(sheet.maxCol, col);

  if (typeof input === "string" && input.startsWith("=")) {
    let ast = null;
    let parseFail = null;
    try {
      ast = parseFormula(input);
    } catch {
      parseFail = ERRORS.VALUE; // malformed formula (Excel would refuse entry)
    }
    const rec = {
      input, isFormula: true, ast,
      value: parseFail, // placeholder until recalc; stays if unparseable
      parseFail,
      precedents: { cells: [], ranges: [] },
    };
    if (ast) {
      const deps = extractDependencies(ast);
      rec.precedents.cells = deps.cells.map((c) => cellKey(c.row, c.col));
      rec.precedents.ranges = deps.ranges;
      registerPrecedents(sheet, key, rec);
    }
    sheet.cells.set(key, rec);
    return;
  }

  sheet.cells.set(key, {
    input,
    isFormula: false,
    ast: null,
    value: literalValue(input),
    precedents: null,
  });
}

function literalValue(input) {
  if (typeof input !== "string") return input; // numbers, booleans, Dates pass through
  if (input.startsWith("'")) return input.slice(1);
  const trimmed = input.trim();
  if (trimmed !== "" && !/^0\d/.test(trimmed)) {
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
  }
  const upper = trimmed.toUpperCase();
  if (upper === "TRUE") return true;
  if (upper === "FALSE") return false;
  if (/^#(DIV\/0!|N\/A|NAME\?|NULL!|NUM!|REF!|VALUE!|CIRCULAR!)$/.test(upper)) {
    return errorFromCode(upper);
  }
  return input;
}

function registerPrecedents(sheet, key, rec) {
  for (const pKey of rec.precedents.cells) {
    let set = sheet.dependents.get(pKey);
    if (!set) {
      set = new Set();
      sheet.dependents.set(pKey, set);
    }
    set.add(key);
  }
  if (rec.precedents.ranges.length > 0) {
    sheet.rangeDeps.set(key, rec.precedents.ranges);
  }
}

function unregisterPrecedents(sheet, key, rec) {
  if (!rec.precedents) return;
  for (const pKey of rec.precedents.cells) {
    const set = sheet.dependents.get(pKey);
    if (set) {
      set.delete(key);
      if (set.size === 0) sheet.dependents.delete(pKey);
    }
  }
  sheet.rangeDeps.delete(key);
}

/** Direct dependents of a cell: exact-ref dependents plus range dependents. */
function directDependents(sheet, key) {
  const out = new Set(sheet.dependents.get(key) || []);
  if (sheet.rangeDeps.size > 0) {
    const parsed = parseRef(key);
    for (const [depKey, ranges] of sheet.rangeDeps) {
      if (out.has(depKey)) continue;
      for (const range of ranges) {
        if (rangeContains(range, parsed.row, parsed.col)) {
          out.add(depKey);
          break;
        }
      }
    }
  }
  return out;
}

function clampRange(sheet, range) {
  const top = range.top === null || range.top === undefined ? 0 : range.top;
  const bottom = range.bottom === null || range.bottom === undefined
    ? Math.max(sheet.maxRow, 0)
    : Math.min(range.bottom, MAX_ROWS - 1);
  return { top, left: range.left, bottom, right: range.right };
}

function makeContext(sheet) {
  return {
    getCell(row, col) {
      const rec = sheet.cells.get(cellKey(row, col));
      return rec ? rec.value : undefined;
    },
    getRange(range) {
      const c = clampRange(sheet, range);
      const values = [];
      for (let r = c.top; r <= c.bottom; r++) {
        const rowVals = [];
        for (let col = c.left; col <= c.right; col++) {
          const rec = sheet.cells.get(cellKey(r, col));
          rowVals.push(rec ? rec.value : undefined);
        }
        values.push(rowVals);
      }
      return new RangeValue(values);
    },
    now: sheet.now || undefined,
  };
}

/**
 * Incremental recalc: collect the dirty closure (seeds + transitive
 * dependents), topologically order the dirty FORMULA cells (Kahn), evaluate
 * in order; anything left stalled is part of (or downstream of) a cycle and
 * gets #CIRCULAR!, then relaxation passes let IFERROR-style downstream cells
 * settle.
 */
function recalc(sheet, seedKeys) {
  // 1. dirty closure over dependents
  const dirty = new Set();
  const queue = [...seedKeys];
  while (queue.length > 0) {
    const key = queue.pop();
    if (dirty.has(key)) continue;
    dirty.add(key);
    for (const dep of directDependents(sheet, key)) {
      if (!dirty.has(dep)) queue.push(dep);
    }
  }

  // 2. the cells that actually need re-evaluation are dirty formula cells
  const dirtyFormulas = [];
  for (const key of dirty) {
    const rec = sheet.cells.get(key);
    if (rec && rec.isFormula && rec.ast) dirtyFormulas.push(key);
  }
  if (dirtyFormulas.length === 0) return;
  const dirtyFormulaSet = new Set(dirtyFormulas);

  // 3. Kahn's algorithm over precedent edges restricted to the dirty set
  const indegree = new Map();
  const edges = new Map(); // precedentKey -> [dependentKeys] within dirty set
  for (const key of dirtyFormulas) {
    const rec = sheet.cells.get(key);
    const preds = new Set();
    for (const pKey of rec.precedents.cells) {
      if (dirtyFormulaSet.has(pKey) && pKey !== key) preds.add(pKey);
    }
    for (const range of rec.precedents.ranges) {
      for (const otherKey of dirtyFormulas) {
        if (otherKey === key || preds.has(otherKey)) continue;
        const pos = parseRef(otherKey);
        if (rangeContains(range, pos.row, pos.col)) preds.add(otherKey);
      }
    }
    // self-reference (=A1 in A1) is an immediate cycle
    const selfRef = rec.precedents.cells.includes(key) ||
      rec.precedents.ranges.some((rg) => {
        const pos = parseRef(key);
        return rangeContains(rg, pos.row, pos.col);
      });
    indegree.set(key, preds.size + (selfRef ? 1 : 0));
    for (const p of preds) {
      if (!edges.has(p)) edges.set(p, []);
      edges.get(p).push(key);
    }
  }

  const ctx = makeContext(sheet);
  const ready = dirtyFormulas.filter((k) => indegree.get(k) === 0);
  const done = new Set();
  while (ready.length > 0) {
    const key = ready.pop();
    const rec = sheet.cells.get(key);
    rec.value = evaluateAst(rec.ast, ctx);
    done.add(key);
    for (const dep of edges.get(key) || []) {
      indegree.set(dep, indegree.get(dep) - 1);
      if (indegree.get(dep) === 0) ready.push(dep);
    }
  }

  // 4. stalled cells are on or downstream of a cycle
  const stalled = dirtyFormulas.filter((k) => !done.has(k));
  if (stalled.length > 0) {
    for (const key of stalled) {
      sheet.cells.get(key).value = ERRORS.CIRCULAR;
    }
    // relaxation: lets cells downstream of the cycle (e.g. IFERROR guards)
    // settle against the #CIRCULAR! values; true cycle members stay circular.
    // Each productive pass settles at least one cell, so a fixpoint is
    // reached within stalled.length passes (worst case O(n) per pass).
    for (let pass = 0; pass < stalled.length; pass++) {
      let changed = false;
      for (const key of stalled) {
        const rec = sheet.cells.get(key);
        const next = evaluateAst(rec.ast, ctx);
        if (!sameValue(next, rec.value)) {
          rec.value = next;
          changed = true;
        }
      }
      if (!changed) break;
    }
    // any stalled cell that still (transitively) feeds itself gets #CIRCULAR!
    for (const key of stalled) {
      if (feedsItself(sheet, key, new Set())) {
        sheet.cells.get(key).value = ERRORS.CIRCULAR;
      }
    }
  }
}

function sameValue(a, b) {
  if (isError(a) && isError(b)) return a.code === b.code;
  if (isRange(a) || isRange(b)) return false;
  return a === b;
}

/** DFS: does this formula cell participate in a reference cycle? */
function feedsItself(sheet, startKey, visiting, currentKey = startKey) {
  if (visiting.has(currentKey)) return currentKey === startKey;
  visiting.add(currentKey);
  const rec = sheet.cells.get(currentKey);
  if (!rec || !rec.isFormula || !rec.precedents) return false;
  const preds = new Set(rec.precedents.cells);
  for (const range of rec.precedents.ranges) {
    // only formula cells can extend a cycle
    for (const [key2, rec2] of sheet.cells) {
      if (rec2.isFormula) {
        const pos = parseRef(key2);
        if (rangeContains(range, pos.row, pos.col)) preds.add(key2);
      }
    }
  }
  for (const p of preds) {
    if (p === startKey) return true;
    if (!visiting.has(p) && feedsItself(sheet, startKey, visiting, p)) return true;
  }
  return false;
}

export { translateFormula, FormulaError, isError };
