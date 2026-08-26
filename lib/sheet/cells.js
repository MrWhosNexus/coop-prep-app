// Cell addressing: A1 <-> {row, col}, ranges, absolute refs, bounds.
// Rows and cols are 0-indexed internally; A1 notation is 1-indexed as in Excel.
// Pure functions, no DOM, no state.

export const MAX_ROWS = 1048576; // Excel's real limit
export const MAX_COLS = 16384;   // column "XFD"

const REF_RE = /^(\$?)([A-Za-z]{1,3})(\$?)([0-9]+)$/;
const COL_RE = /^(\$?)([A-Za-z]{1,3})$/;

/**
 * Convert a 0-indexed column number to letters (0 -> "A", 27 -> "AB").
 * @param {number} col
 * @returns {string}
 */
export function colToLetters(col) {
  let n = col;
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/**
 * Convert column letters to a 0-indexed column number ("A" -> 0, "AB" -> 27).
 * @param {string} letters
 * @returns {number}
 */
export function lettersToCol(letters) {
  let n = 0;
  const up = letters.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    n = n * 26 + (up.charCodeAt(i) - 64);
  }
  return n - 1;
}

/**
 * Parse an A1-style cell reference (with optional $ markers).
 * @param {string} text e.g. "B7", "$A$1", "c3"
 * @returns {{row: number, col: number, absRow: boolean, absCol: boolean} | null}
 */
export function parseRef(text) {
  const m = REF_RE.exec(String(text).trim());
  if (!m) return null;
  const col = lettersToCol(m[2]);
  const row = parseInt(m[4], 10) - 1;
  if (row < 0 || row >= MAX_ROWS || col >= MAX_COLS) return null;
  return { row, col, absCol: m[1] === "$", absRow: m[3] === "$" };
}

/**
 * Parse a column-only reference like "B" or "$C" (used in ranges like B:B).
 * @param {string} text
 * @returns {{col: number, absCol: boolean} | null}
 */
export function parseColRef(text) {
  const m = COL_RE.exec(String(text).trim());
  if (!m) return null;
  const col = lettersToCol(m[2]);
  if (col >= MAX_COLS) return null;
  return { col, absCol: m[1] === "$" };
}

/**
 * Render a {row, col} (0-indexed) as an A1 string, honouring abs flags.
 * @param {{row: number, col: number, absRow?: boolean, absCol?: boolean}} ref
 * @returns {string}
 */
export function refToA1(ref) {
  return (
    (ref.absCol ? "$" : "") + colToLetters(ref.col) +
    (ref.absRow ? "$" : "") + (ref.row + 1)
  );
}

/**
 * Canonical cell key for maps: plain uppercase A1 with no $ markers.
 * @param {number} row 0-indexed
 * @param {number} col 0-indexed
 * @returns {string}
 */
export function cellKey(row, col) {
  return colToLetters(col) + (row + 1);
}

/**
 * Parse a range string. Accepts "A1:C10", a single cell "B2" (degenerate
 * range), and full-column ranges "B:D". Bounds are normalized so
 * top <= bottom and left <= right. Full-column ranges have top/bottom null.
 * @param {string} text
 * @returns {{top: number|null, left: number, bottom: number|null, right: number} | null}
 */
export function parseRange(text) {
  const s = String(text).trim();
  const colonAt = s.indexOf(":");
  if (colonAt === -1) {
    const ref = parseRef(s);
    if (!ref) return null;
    return { top: ref.row, left: ref.col, bottom: ref.row, right: ref.col };
  }
  const a = s.slice(0, colonAt);
  const b = s.slice(colonAt + 1);
  const refA = parseRef(a);
  const refB = parseRef(b);
  if (refA && refB) return makeRange(refA.row, refA.col, refB.row, refB.col);
  const colA = parseColRef(a);
  const colB = parseColRef(b);
  if (colA && colB) {
    return {
      top: null,
      left: Math.min(colA.col, colB.col),
      bottom: null,
      right: Math.max(colA.col, colB.col),
    };
  }
  return null;
}

/**
 * Build a normalized range from two corner cells (0-indexed).
 * @returns {{top: number, left: number, bottom: number, right: number}}
 */
export function makeRange(row1, col1, row2, col2) {
  return {
    top: Math.min(row1, row2),
    left: Math.min(col1, col2),
    bottom: Math.max(row1, row2),
    right: Math.max(col1, col2),
  };
}

/**
 * Render a range object back to A1 notation ("A1:C10", "B:D", or "A1").
 * @param {{top: number|null, left: number, bottom: number|null, right: number}} range
 * @returns {string}
 */
export function rangeToA1(range) {
  if (range.top === null || range.top === undefined) {
    return colToLetters(range.left) + ":" + colToLetters(range.right);
  }
  const a = cellKey(range.top, range.left);
  const b = cellKey(range.bottom, range.right);
  return a === b ? a : a + ":" + b;
}

/**
 * True if the (row, col) cell lies inside the range. Full-column ranges
 * match any row of their columns.
 */
export function rangeContains(range, row, col) {
  if (col < range.left || col > range.right) return false;
  if (range.top === null || range.top === undefined) return true;
  return row >= range.top && row <= range.bottom;
}

/**
 * Number of rows/cols in a bounded range.
 * @returns {{rows: number, cols: number}}
 */
export function rangeSize(range) {
  return {
    rows: range.bottom - range.top + 1,
    cols: range.right - range.left + 1,
  };
}

/**
 * Call fn(row, col) for every cell of a bounded range, row-major.
 */
export function forEachCellInRange(range, fn) {
  for (let r = range.top; r <= range.bottom; r++) {
    for (let c = range.left; c <= range.right; c++) {
      fn(r, c);
    }
  }
}

/**
 * Shift a single parsed ref by (dRow, dCol), respecting $-absolute flags.
 * Returns null when the shifted ref falls off the sheet (Excel shows #REF!).
 * @param {{row: number, col: number, absRow: boolean, absCol: boolean}} ref
 * @returns {{row: number, col: number, absRow: boolean, absCol: boolean} | null}
 */
export function translateRef(ref, dRow, dCol) {
  const row = ref.absRow ? ref.row : ref.row + dRow;
  const col = ref.absCol ? ref.col : ref.col + dCol;
  if (row < 0 || row >= MAX_ROWS || col < 0 || col >= MAX_COLS) return null;
  return { row, col, absRow: ref.absRow, absCol: ref.absCol };
}

/**
 * True if the ref lies within the sheet bounds.
 */
export function inBounds(row, col) {
  return row >= 0 && row < MAX_ROWS && col >= 0 && col < MAX_COLS;
}
