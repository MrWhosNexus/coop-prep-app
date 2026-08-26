// Pure UI logic for the spreadsheet components: selection math, keyboard
// navigation, virtualization windowing, grid geometry, clipboard TSV
// parsing, fill-handle math, formula-reference extraction for highlighting,
// undo/redo history, and pivot-builder helpers.
//
// NO React, NO DOM, NO JSX — everything here is unit-testable under
// `node --test` (see test/sheet-ui.test.js). Components import from here.

import {
  makeRange, parseRange, rangeToA1, cellKey,
} from "../../lib/sheet/cells.js";

// ── Layout constants ────────────────────────────────────────────────────────

export const ROW_HEIGHT = 26;
export const HEADER_HEIGHT = 28;
export const ROW_HEADER_WIDTH = 48;
export const DEFAULT_COL_WIDTH = 96;
export const MIN_COL_WIDTH = 40;
export const MAX_COL_WIDTH = 480;
export const REF_COLOR_COUNT = 5;

// ── Selection model ─────────────────────────────────────────────────────────
// A selection is { anchor, focus, active }, each {row, col} (0-indexed).
// anchor..focus span the selected rectangle; active is the cell that receives
// typing (Excel's white cell inside a colored selection).

/**
 * A fresh single-cell selection.
 * @param {number} row
 * @param {number} col
 * @returns {{anchor: object, focus: object, active: object}}
 */
export function createSelection(row = 0, col = 0) {
  const cell = { row, col };
  return { anchor: { ...cell }, focus: { ...cell }, active: { ...cell } };
}

/**
 * The normalized rectangle covered by a selection.
 * @returns {{top: number, left: number, bottom: number, right: number}}
 */
export function selectionRange(sel) {
  return makeRange(sel.anchor.row, sel.anchor.col, sel.focus.row, sel.focus.col);
}

/** True when the selection covers exactly one cell. */
export function isSingleCell(sel) {
  return sel.anchor.row === sel.focus.row && sel.anchor.col === sel.focus.col;
}

/** Clamp a cell position into the grid bounds. */
export function clampCell(row, col, maxRow, maxCol) {
  return {
    row: Math.min(Math.max(row, 0), maxRow),
    col: Math.min(Math.max(col, 0), maxCol),
  };
}

/**
 * Arrow-key navigation. Plain movement collapses to a single cell starting
 * from the ACTIVE cell; extend (shift) moves the focus corner and keeps the
 * anchor, like Excel.
 * @param {object} sel selection
 * @param {number} dRow
 * @param {number} dCol
 * @param {{extend?: boolean, maxRow: number, maxCol: number}} opts
 * @returns {object} new selection
 */
export function moveFocus(sel, dRow, dCol, opts) {
  const { extend = false, maxRow, maxCol } = opts;
  if (extend) {
    const t = clampCell(sel.focus.row + dRow, sel.focus.col + dCol, maxRow, maxCol);
    return { anchor: { ...sel.anchor }, focus: t, active: { ...sel.active } };
  }
  const t = clampCell(sel.active.row + dRow, sel.active.col + dCol, maxRow, maxCol);
  return createSelection(t.row, t.col);
}

const DIRS = {
  down: { dRow: 1, dCol: 0 },
  up: { dRow: -1, dCol: 0 },
  right: { dRow: 0, dCol: 1 },
  left: { dRow: 0, dCol: -1 },
};

/**
 * Move the active cell one step inside a multi-cell range, wrapping the way
 * Excel wraps Enter/Tab within a selection.
 * @param {{top,left,bottom,right}} range
 * @param {{row, col}} active
 * @param {"down"|"up"|"right"|"left"} dir
 * @returns {{row, col}}
 */
export function advanceWithin(range, active, dir) {
  let { row, col } = active;
  if (dir === "down") {
    row++;
    if (row > range.bottom) { row = range.top; col = col + 1 > range.right ? range.left : col + 1; }
  } else if (dir === "up") {
    row--;
    if (row < range.top) { row = range.bottom; col = col - 1 < range.left ? range.right : col - 1; }
  } else if (dir === "right") {
    col++;
    if (col > range.right) { col = range.left; row = row + 1 > range.bottom ? range.top : row + 1; }
  } else if (dir === "left") {
    col--;
    if (col < range.left) { col = range.right; row = row - 1 < range.top ? range.bottom : row - 1; }
  }
  return { row, col };
}

/**
 * Enter/Tab navigation: within a multi-cell selection the active cell walks
 * the range (selection preserved); on a single cell it simply moves.
 * @param {object} sel
 * @param {"down"|"up"|"right"|"left"} dir
 * @param {number} maxRow
 * @param {number} maxCol
 * @returns {object} new selection
 */
export function advanceActive(sel, dir, maxRow, maxCol) {
  if (isSingleCell(sel)) {
    const d = DIRS[dir];
    return moveFocus(sel, d.dRow, d.dCol, { maxRow, maxCol });
  }
  const active = advanceWithin(selectionRange(sel), sel.active, dir);
  return { anchor: { ...sel.anchor }, focus: { ...sel.focus }, active };
}

// ── Virtualization windowing ────────────────────────────────────────────────

/**
 * Which rows to render for the current scroll position.
 * @param {number} scrollTop px
 * @param {number} viewportHeight px
 * @param {number} rowHeight px
 * @param {number} totalRows
 * @param {number} [overscan] extra rows above/below
 * @returns {{start: number, end: number}} inclusive row indices (end < start when empty)
 */
export function visibleWindow(scrollTop, viewportHeight, rowHeight, totalRows, overscan = 4) {
  if (totalRows <= 0) return { start: 0, end: -1 };
  const first = Math.floor(scrollTop / rowHeight);
  const last = Math.ceil((scrollTop + viewportHeight) / rowHeight) - 1;
  return {
    start: Math.max(0, first - overscan),
    end: Math.min(totalRows - 1, Math.max(last + overscan, 0)),
  };
}

// ── Grid geometry (variable column widths) ──────────────────────────────────

function widthOf(widths, col) {
  const w = widths ? widths[col] : undefined;
  return typeof w === "number" ? w : DEFAULT_COL_WIDTH;
}

/** X offset (px) of a column's left edge, excluding the row-header gutter. */
export function colOffset(col, widths) {
  let x = 0;
  for (let c = 0; c < col; c++) x += widthOf(widths, c);
  return x;
}

/** Total width (px) of colCount columns. */
export function totalWidth(colCount, widths) {
  return colOffset(colCount, widths);
}

/** Column index at a horizontal offset (px, gutter excluded), clamped. */
export function colAtX(x, colCount, widths) {
  if (x < 0) return 0;
  let acc = 0;
  for (let c = 0; c < colCount; c++) {
    acc += widthOf(widths, c);
    if (x < acc) return c;
  }
  return colCount - 1;
}

/** Clamp a dragged column width into sane bounds. */
export function clampColWidth(w) {
  return Math.min(Math.max(Math.round(w), MIN_COL_WIDTH), MAX_COL_WIDTH);
}

// ── Clipboard ───────────────────────────────────────────────────────────────

/**
 * Parse pasted plain text into a 2D array of strings. Handles \r\n, a
 * trailing newline (ignored, like Excel), and tab-separated cells.
 * @param {string} text
 * @returns {Array<Array<string>>}
 */
export function parseClipboardText(text) {
  if (text === null || text === undefined || text === "") return [];
  const normalized = String(text).replace(/\r\n?/g, "\n");
  const body = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
  return body.split("\n").map((line) => line.split("\t"));
}

/**
 * Serialize a 2D array of display values to TSV for the system clipboard.
 * @param {Array<Array<*>>} rows
 * @returns {string}
 */
export function toTsv(rows) {
  return rows
    .map((row) => row.map((v) => (v === null || v === undefined ? "" : String(v))).join("\t"))
    .join("\n");
}

// ── Fill handle ─────────────────────────────────────────────────────────────

/**
 * Given the selection being dragged by its fill handle and the cell under
 * the pointer, compute the target range to fill. Excel extends in ONE
 * dominant direction. Returns null when the pointer is inside the source.
 * @param {{top,left,bottom,right}} source
 * @param {number} row pointer cell row
 * @param {number} col pointer cell col
 * @returns {{top,left,bottom,right}|null}
 */
export function fillRange(source, row, col) {
  const below = row - source.bottom;
  const above = source.top - row;
  const rightOf = col - source.right;
  const leftOf = source.left - col;
  const v = Math.max(below, above);
  const h = Math.max(rightOf, leftOf);
  if (v <= 0 && h <= 0) return null;
  if (v >= h) {
    return below >= above
      ? { top: source.bottom + 1, bottom: row, left: source.left, right: source.right }
      : { top: row, bottom: source.top - 1, left: source.left, right: source.right };
  }
  return rightOf >= leftOf
    ? { top: source.top, bottom: source.bottom, left: source.right + 1, right: col }
    : { top: source.top, bottom: source.bottom, left: col, right: source.left - 1 };
}

function mod(n, m) {
  return ((n % m) + m) % m;
}

/**
 * Map every target cell to the source cell it copies from, keeping the
 * pattern phase-aligned to the SOURCE (drag-to-fill semantics).
 * @returns {Array<{from: {row, col}, to: {row, col}}>}
 */
export function fillMapping(source, target) {
  const rows = source.bottom - source.top + 1;
  const cols = source.right - source.left + 1;
  const out = [];
  for (let r = target.top; r <= target.bottom; r++) {
    for (let c = target.left; c <= target.right; c++) {
      out.push({
        from: { row: source.top + mod(r - source.top, rows), col: source.left + mod(c - source.left, cols) },
        to: { row: r, col: c },
      });
    }
  }
  return out;
}

/**
 * Map target cells to source cells with the pattern phase starting at the
 * TARGET's top-left (paste/tile semantics).
 * @returns {Array<{from: {row, col}, to: {row, col}}>}
 */
export function pasteMapping(source, target) {
  const rows = source.bottom - source.top + 1;
  const cols = source.right - source.left + 1;
  const out = [];
  for (let r = target.top; r <= target.bottom; r++) {
    for (let c = target.left; c <= target.right; c++) {
      out.push({
        from: { row: source.top + mod(r - target.top, rows), col: source.left + mod(c - target.left, cols) },
        to: { row: r, col: c },
      });
    }
  }
  return out;
}

/**
 * The range a paste will cover: a single-cell selection receives the full
 * copied block at the active cell; a larger selection is tiled as-is.
 */
export function pasteTargetRange(source, sel) {
  if (isSingleCell(sel)) {
    return {
      top: sel.active.row,
      left: sel.active.col,
      bottom: sel.active.row + (source.bottom - source.top),
      right: sel.active.col + (source.right - source.left),
    };
  }
  return selectionRange(sel);
}

// ── Formula reference extraction (for live highlighting) ───────────────────

function stringMask(input) {
  const mask = new Array(input.length).fill(false);
  let inStr = false;
  for (let i = 0; i < input.length; i++) {
    if (input[i] === "\"") {
      if (inStr && input[i + 1] === "\"") {
        mask[i] = true;
        mask[i + 1] = true;
        i++;
        continue;
      }
      mask[i] = true;
      inStr = !inStr;
      continue;
    }
    mask[i] = inStr;
  }
  return mask;
}

const REF_CANDIDATE_RE =
  /\$?[A-Za-z]{1,3}\$?[0-9]+(?::\$?[A-Za-z]{1,3}\$?[0-9]+)?|\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}/g;
const BEFORE_BAD = /[A-Za-z0-9_$.!]/;
const AFTER_BAD = /[A-Za-z0-9_(]/;

/**
 * Extract every cell/range reference from a formula string, with positions
 * and a stable color index per distinct reference (same ref -> same color).
 * Returns [] for non-formula input. References inside string literals and
 * function names that merely look like refs (e.g. LOG10(...)) are skipped.
 * @param {string} input the raw cell input, e.g. `=SUM(A1:B2)+C3`
 * @returns {Array<{text: string, start: number, end: number, range: object, colorIndex: number}>}
 */
export function extractFormulaRefs(input) {
  if (typeof input !== "string" || !input.startsWith("=")) return [];
  const mask = stringMask(input);
  const colorByKey = new Map();
  const out = [];
  REF_CANDIDATE_RE.lastIndex = 0;
  let m;
  while ((m = REF_CANDIDATE_RE.exec(input)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (mask[start]) continue;
    const before = input[start - 1];
    if (before !== undefined && BEFORE_BAD.test(before)) continue;
    const after = input[end];
    if (after !== undefined && AFTER_BAD.test(after)) continue;
    const range = parseRange(m[0]);
    if (!range) continue;
    const key = rangeToA1(range);
    if (!colorByKey.has(key)) colorByKey.set(key, colorByKey.size % REF_COLOR_COUNT);
    out.push({ text: m[0], start, end, range, colorIndex: colorByKey.get(key) });
  }
  return out;
}

/**
 * Split a formula string into render segments for the formula-bar underlay:
 * [{text, colorIndex}] where colorIndex is null for non-reference text.
 * Segments always concatenate back to the exact input.
 */
export function formulaSegments(input) {
  const refs = extractFormulaRefs(input);
  const segs = [];
  let pos = 0;
  for (const ref of refs) {
    if (ref.start > pos) segs.push({ text: input.slice(pos, ref.start), colorIndex: null });
    segs.push({ text: ref.text, colorIndex: ref.colorIndex });
    pos = ref.end;
  }
  if (pos < input.length) segs.push({ text: input.slice(pos), colorIndex: null });
  return segs;
}

/**
 * The partial identifier immediately before the caret in a formula, used to
 * drive function-name autocomplete. Null when not applicable (not a formula,
 * caret inside a string literal, or no identifier at the caret).
 * @param {string} text
 * @param {number} [caret] defaults to end of text
 * @returns {{prefix: string, start: number}|null}
 */
export function functionPrefix(text, caret = text.length) {
  if (typeof text !== "string" || !text.startsWith("=")) return null;
  const upto = text.slice(0, caret);
  let quotes = 0;
  for (const ch of upto) if (ch === "\"") quotes++;
  if (quotes % 2 === 1) return null;
  const m = /([A-Za-z][A-Za-z0-9.]*)$/.exec(upto);
  if (!m) return null;
  const before = upto[upto.length - m[1].length - 1];
  if (before === "$") return null;
  return { prefix: m[1], start: caret - m[1].length };
}

/**
 * The innermost named function call surrounding the caret, plus which
 * argument the caret sits in — drives the signature hint while typing.
 * @param {string} text
 * @param {number} [caret]
 * @returns {{name: string, argIndex: number}|null}
 */
export function functionContext(text, caret = text.length) {
  if (typeof text !== "string" || !text.startsWith("=")) return null;
  const upto = text.slice(0, caret);
  const stack = [];
  let inStr = false;
  for (let i = 1; i < upto.length; i++) {
    const ch = upto[i];
    if (ch === "\"") {
      if (inStr && upto[i + 1] === "\"") { i++; continue; }
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === "(") {
      const head = upto.slice(1, i);
      const nm = /([A-Za-z][A-Za-z0-9._]*)\s*$/.exec(head);
      stack.push({ name: nm ? nm[1].toUpperCase() : null, argIndex: 0 });
    } else if (ch === ")") {
      stack.pop();
    } else if (ch === ",") {
      if (stack.length > 0) stack[stack.length - 1].argIndex++;
    }
  }
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].name) return { name: stack[i].name, argIndex: stack[i].argIndex };
  }
  return null;
}

// ── Undo / redo history ─────────────────────────────────────────────────────
// An edit is an array of ops: [{ref, before, after}] where before/after are
// raw cell INPUTS (null = empty). Undo re-applies `before`, redo `after`.

/**
 * @param {number} [limit] max retained edits
 * @returns {{past: Array, future: Array, limit: number}}
 */
export function createHistory(limit = 200) {
  return { past: [], future: [], limit };
}

/**
 * Record a committed edit. Clears the redo stack, trims to the limit.
 * @returns {object} new history
 */
export function recordEdit(history, ops) {
  if (!ops || ops.length === 0) return history;
  const past = [...history.past, ops];
  if (past.length > history.limit) past.splice(0, past.length - history.limit);
  return { past, future: [], limit: history.limit };
}

/**
 * Pop the most recent edit for undoing.
 * @returns {{history: object, ops: Array}|null}
 */
export function undoEdit(history) {
  if (history.past.length === 0) return null;
  const ops = history.past[history.past.length - 1];
  return {
    history: { past: history.past.slice(0, -1), future: [ops, ...history.future], limit: history.limit },
    ops,
  };
}

/**
 * Pop the most recently undone edit for redoing.
 * @returns {{history: object, ops: Array}|null}
 */
export function redoEdit(history) {
  if (history.future.length === 0) return null;
  const ops = history.future[0];
  return {
    history: { past: [...history.past, ops], future: history.future.slice(1), limit: history.limit },
    ops,
  };
}

// ── Selection statistics (status bar, like Excel's) ────────────────────────

/**
 * Count / Sum / Average over a 2D array of computed values. Errors and text
 * count as filled cells but not numbers.
 * @param {Array<Array<*>>} values
 * @returns {{count: number, numericCount: number, sum: number, average: number|null}}
 */
export function selectionStats(values) {
  let count = 0;
  let numericCount = 0;
  let sum = 0;
  for (const row of values) {
    for (const v of row) {
      if (v === undefined || v === null || v === "") continue;
      count++;
      if (typeof v === "number" && Number.isFinite(v)) {
        numericCount++;
        sum += v;
      }
    }
  }
  return { count, numericCount, sum, average: numericCount > 0 ? sum / numericCount : null };
}

// ── Pivot builder helpers ───────────────────────────────────────────────────

export const AGG_OPTIONS = [
  { value: "count", label: "Count" },
  { value: "sum", label: "Sum" },
  { value: "average", label: "Average" },
  { value: "min", label: "Min" },
  { value: "max", label: "Max" },
  { value: "countUnique", label: "Count Unique" },
];

export const SHOW_AS_OPTIONS = [
  { value: "", label: "No Calculation" },
  { value: "percentOfColumnTotal", label: "% of Column Total" },
  { value: "percentOfRowTotal", label: "% of Row Total" },
  { value: "percentOfGrandTotal", label: "% of Grand Total" },
];

/**
 * Turn builder state into a lib/sheet/pivot.js spec, or null when the state
 * cannot produce a pivot yet (no value fields).
 * @param {{rows?: string[], cols?: string[], values?: Array, filters?: object}} state
 * @returns {object|null}
 */
export function buildPivotSpec(state) {
  const values = (state.values || [])
    .filter((v) => v && v.field)
    .map((v) => {
      const out = { field: v.field, agg: v.agg || "count" };
      if (v.showAs) out.showAs = v.showAs;
      if (v.label) out.label = v.label;
      return out;
    });
  if (values.length === 0) return null;
  const spec = { rows: [...(state.rows || [])], cols: [...(state.cols || [])], values };
  const filters = {};
  for (const [field, allowed] of Object.entries(state.filters || {})) {
    if (Array.isArray(allowed) ? allowed.length > 0 : allowed !== null && allowed !== undefined && allowed !== "") {
      filters[field] = allowed;
    }
  }
  if (Object.keys(filters).length > 0) spec.filters = filters;
  return spec;
}

/**
 * Format one pivot cell for display. showAs results come back from the
 * engine as FRACTIONS (0.5625) and render as "56.3%" — never double-scale.
 * @param {*} v
 * @param {string|null|undefined} showAs the value-spec's showAs (falsy = plain)
 * @returns {string}
 */
export function formatPivotCell(v, showAs) {
  if (v === "" || v === null || v === undefined) return "";
  if (typeof v !== "number") return String(v);
  if (showAs) return (v * 100).toFixed(1) + "%";
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 100) / 100);
}

/**
 * For a pivotTable() result, describe every column of the pivotToGrid()
 * output: null for row-label columns, otherwise the value spec ({field, agg,
 * showAs, label}) that column shows. Lets the renderer format % columns.
 * @param {object} result from pivotTable
 * @returns {Array<object|null>}
 */
export function pivotColumnMeta(result) {
  const meta = result.rowFields.map(() => null);
  const groups = result.colFields.length > 0 ? result.colKeys : [[]];
  const nVals = result.spec.values.length;
  for (let g = 0; g < groups.length; g++) {
    for (let vi = 0; vi < nVals; vi++) meta.push(result.spec.values[vi]);
  }
  for (let vi = 0; vi < nVals; vi++) meta.push(result.spec.values[vi]);
  return meta;
}

/** Header fields of a data grid (first row), skipping blanks. */
export function headerFields(grid) {
  if (!grid || grid.length === 0) return [];
  return grid[0]
    .map((h) => (h === null || h === undefined ? "" : String(h)))
    .filter((h) => h !== "");
}

/**
 * Distinct values of one field in a header-rowed grid, sorted (numbers
 * first ascending, then strings alphabetically). Used for filter pickers.
 * @param {Array<Array<*>>} grid
 * @param {string} field
 * @returns {Array<*>}
 */
export function distinctValues(grid, field) {
  if (!grid || grid.length < 2) return [];
  const idx = grid[0].findIndex((h) => String(h) === field);
  if (idx === -1) return [];
  const seen = new Map();
  for (let r = 1; r < grid.length; r++) {
    const v = grid[r][idx];
    if (v === undefined || v === null || v === "") continue;
    const key = typeof v + ":" + String(v);
    if (!seen.has(key)) seen.set(key, v);
  }
  return [...seen.values()].sort((a, b) => {
    const an = typeof a === "number";
    const bn = typeof b === "number";
    if (an && bn) return a - b;
    if (an) return -1;
    if (bn) return 1;
    return String(a).localeCompare(String(b));
  });
}

/** Convenience re-export so components can build A1 refs without a second import. */
export { cellKey };
