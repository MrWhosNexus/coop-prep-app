// Pivot table engine. Pure functions over arrays of records.
//
// Spec shape:
//   {
//     rows:    ["race", ...]            row group fields, in nesting order
//     cols:    ["approved", ...]        column group fields (optional)
//     values:  [{ field, agg, showAs?, label? }, ...]
//         agg: "count" | "sum" | "average" | "min" | "max" | "countUnique"
//         showAs: "percentOfColumnTotal" | "percentOfRowTotal" | "percentOfGrandTotal"
//     filters: { field: value | [values], ... }  (optional)
//   }
//
// Result shape (from pivotTable):
//   {
//     spec, rowFields, colFields,
//     rowKeys: [[v, ...], ...]          sorted tuples, one per output row
//     colKeys: [[v, ...], ...]          sorted tuples, one per output column group
//     cells:      cells[r][c][v]        aggregated (and showAs-transformed) value or null
//     rowTotals:  rowTotals[r][v]
//     colTotals:  colTotals[c][v]
//     grandTotals: grandTotals[v]
//     subtotals:  Map "prefix" -> { cells: [c][v], rowTotal: [v] } for
//                 every strict prefix of a row tuple (multi-level rows only)
//   }
//
// showAs percentages are returned as fractions (0.85 = 85%), matching how a
// UI would then format them. Aggregations under showAs are computed from the
// UNTRANSFORMED base values, exactly like Excel's "Show Values As".

import { valueCompare } from "./functions.js";

const KEY_SEP = "\u001f";
const BUCKET_SEP = "\u001e";

/**
 * Convert a 2D grid whose first row is headers into an array of records.
 * Blank rows (all cells empty) are skipped.
 * @param {Array<Array<*>>} grid
 * @returns {Array<Object<string, *>>}
 */
export function gridToRecords(grid) {
  if (!grid || grid.length < 1) return [];
  const headers = grid[0].map((h) => String(h === undefined || h === null ? "" : h));
  const out = [];
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row || row.every((v) => v === undefined || v === null || v === "")) continue;
    const rec = {};
    for (let c = 0; c < headers.length; c++) {
      rec[headers[c]] = row[c];
    }
    out.push(rec);
  }
  return out;
}

/**
 * Build a pivot table over records.
 * @param {Array<Object<string, *>>} records
 * @param {object} spec see module header
 * @returns {object} result, see module header
 */
export function pivotTable(records, spec) {
  const rowFields = spec.rows || [];
  const colFields = spec.cols || [];
  const values = (spec.values || []).map((v) => ({
    field: v.field,
    agg: v.agg || "count",
    showAs: v.showAs || null,
    label: v.label || defaultLabel(v),
  }));
  if (values.length === 0) {
    throw new Error("pivotTable: spec.values must contain at least one value definition");
  }

  const filtered = applyFilters(records, spec.filters);

  // bucket records by (rowKey, colKey)
  const rowKeyMap = new Map(); // encoded -> tuple
  const colKeyMap = new Map();
  const buckets = new Map();   // encodedRow + SEP2 + encodedCol -> records[]
  for (const rec of filtered) {
    const rowTuple = rowFields.map((f) => normKey(rec[f]));
    const colTuple = colFields.map((f) => normKey(rec[f]));
    const rk = rowTuple.join(KEY_SEP);
    const ck = colTuple.join(KEY_SEP);
    if (!rowKeyMap.has(rk)) rowKeyMap.set(rk, rowTuple);
    if (!colKeyMap.has(ck)) colKeyMap.set(ck, colTuple);
    const bk = rk + BUCKET_SEP + ck;
    let list = buckets.get(bk);
    if (!list) {
      list = [];
      buckets.set(bk, list);
    }
    list.push(rec);
  }

  const rowKeys = [...rowKeyMap.values()].sort(tupleCompare);
  const colKeys = [...colKeyMap.values()].sort(tupleCompare);

  // base (untransformed) aggregates
  const base = rowKeys.map((rt) =>
    colKeys.map((ct) => {
      const list = buckets.get(rt.join(KEY_SEP) + BUCKET_SEP + ct.join(KEY_SEP));
      return values.map((v) => (list ? aggregate(list, v) : null));
    })
  );

  // totals aggregate over the raw record lists (correct for average/countUnique)
  const rowLists = rowKeys.map((rt) => collectLists(buckets, rt.join(KEY_SEP), null, colKeys));
  const colLists = colKeys.map((ct) => collectLists(buckets, null, ct.join(KEY_SEP), rowKeys));
  const allList = filtered;

  const baseRowTotals = rowLists.map((list) => values.map((v) => aggregate(list, v)));
  const baseColTotals = colLists.map((list) => values.map((v) => aggregate(list, v)));
  const baseGrandTotals = values.map((v) => aggregate(allList, v));

  // subtotals for multi-level row fields: one per strict prefix
  const subtotals = new Map();
  if (rowFields.length > 1) {
    const byPrefix = new Map(); // encodedPrefix -> Map(encodedCol -> records[])
    for (const rt of rowKeys) {
      for (let depth = 1; depth < rowFields.length; depth++) {
        const prefix = rt.slice(0, depth).join(KEY_SEP);
        if (!byPrefix.has(prefix)) byPrefix.set(prefix, prefix);
      }
    }
    for (const prefix of byPrefix.keys()) {
      const depth = prefix.split(KEY_SEP).length;
      const memberRows = rowKeys.filter((rt) => rt.slice(0, depth).join(KEY_SEP) === prefix);
      const cellsForPrefix = colKeys.map((ct) => {
        const list = [];
        for (const rt of memberRows) {
          const l = buckets.get(rt.join(KEY_SEP) + BUCKET_SEP + ct.join(KEY_SEP));
          if (l) list.push(...l);
        }
        return values.map((v) => (list.length ? aggregate(list, v) : null));
      });
      const totalList = [];
      for (const rt of memberRows) {
        for (const ct of colKeys) {
          const l = buckets.get(rt.join(KEY_SEP) + BUCKET_SEP + ct.join(KEY_SEP));
          if (l) totalList.push(...l);
        }
      }
      subtotals.set(prefix, {
        key: prefix.split(KEY_SEP),
        cells: cellsForPrefix,
        rowTotal: values.map((v) => aggregate(totalList, v)),
      });
    }
  }

  // apply "Show Values As" transforms
  const cells = base.map((row, r) =>
    row.map((cell, c) =>
      cell.map((val, vi) => transform(values[vi].showAs, val, {
        rowTotal: baseRowTotals[r][vi],
        colTotal: baseColTotals[c][vi],
        grand: baseGrandTotals[vi],
      }))
    )
  );
  const rowTotals = baseRowTotals.map((tot) =>
    tot.map((val, vi) => transformRowTotal(values[vi].showAs, val, baseGrandTotals[vi]))
  );
  const colTotals = baseColTotals.map((tot) =>
    tot.map((val, vi) => transformColTotal(values[vi].showAs, val, baseGrandTotals[vi]))
  );
  const grandTotals = baseGrandTotals.map((val, vi) =>
    values[vi].showAs ? (val === null ? null : 1) : val
  );
  for (const sub of subtotals.values()) {
    sub.cells = sub.cells.map((cell, c) =>
      cell.map((val, vi) => transform(values[vi].showAs, val, {
        rowTotal: sub.rowTotal[vi],
        colTotal: baseColTotals[c][vi],
        grand: baseGrandTotals[vi],
      }))
    );
    sub.rowTotal = sub.rowTotal.map((val, vi) =>
      transformRowTotal(values[vi].showAs, val, baseGrandTotals[vi])
    );
  }

  return {
    spec: { ...spec, values },
    rowFields, colFields,
    rowKeys, colKeys,
    cells, rowTotals, colTotals, grandTotals,
    subtotals,
  };
}

/**
 * Convenience: pivot straight from a header-rowed grid (e.g. getRangeValues
 * output or parsed CSV).
 */
export function pivotFromGrid(grid, spec) {
  return pivotTable(gridToRecords(grid), spec);
}

/**
 * Render a pivot result to a 2D display grid: header rows, one row per
 * rowKey, optional subtotal rows ("X Total") for multi-level row specs, and
 * a Grand Total row/column. Cell values are numbers (fractions when showAs
 * is set) or "" for empty intersections.
 * @param {object} result from pivotTable
 * @param {{subtotals?: boolean}} [opts]
 * @returns {Array<Array<*>>}
 */
export function pivotToGrid(result, opts = {}) {
  const wantSubtotals = opts.subtotals !== false && result.rowFields.length > 1;
  const nVals = result.spec.values.length;
  const hasCols = result.colFields.length > 0;
  const colGroups = hasCols ? result.colKeys : [[]];

  const grid = [];

  // header
  const header = [...result.rowFields];
  for (const ck of colGroups) {
    for (const v of result.spec.values) {
      const groupLabel = hasCols ? ck.join(" / ") : "";
      header.push(groupLabel ? `${groupLabel} ${v.label}` : v.label);
    }
  }
  for (const v of result.spec.values) {
    header.push(nVals > 1 || hasCols ? `Total ${v.label}` : "Total");
  }
  grid.push(header);

  // body with optional subtotal rows
  let prevPrefix = null;
  for (let r = 0; r < result.rowKeys.length; r++) {
    const rt = result.rowKeys[r];
    if (wantSubtotals && prevPrefix !== null && rt[0] !== prevPrefix) {
      grid.push(subtotalRow(result, prevPrefix, nVals));
    }
    prevPrefix = rt[0];
    const row = [...rt];
    while (row.length < result.rowFields.length) row.push("");
    for (let c = 0; c < colGroups.length; c++) {
      for (let vi = 0; vi < nVals; vi++) {
        const val = hasCols ? result.cells[r][c][vi] : result.cells[r][0] ? result.cells[r][0][vi] : null;
        row.push(val === null || val === undefined ? "" : val);
      }
    }
    for (let vi = 0; vi < nVals; vi++) {
      const val = result.rowTotals[r][vi];
      row.push(val === null || val === undefined ? "" : val);
    }
    grid.push(row);
  }
  if (wantSubtotals && prevPrefix !== null) {
    grid.push(subtotalRow(result, prevPrefix, nVals));
  }

  // grand total row
  const totalRow = ["Grand Total"];
  while (totalRow.length < result.rowFields.length) totalRow.push("");
  for (let c = 0; c < colGroups.length; c++) {
    for (let vi = 0; vi < nVals; vi++) {
      const val = result.colTotals[c] ? result.colTotals[c][vi] : null;
      totalRow.push(val === null || val === undefined ? "" : val);
    }
  }
  for (let vi = 0; vi < nVals; vi++) {
    const val = result.grandTotals[vi];
    totalRow.push(val === null || val === undefined ? "" : val);
  }
  grid.push(totalRow);

  return grid;
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

function defaultLabel(v) {
  const aggNames = {
    count: "Count", sum: "Sum", average: "Average",
    min: "Min", max: "Max", countUnique: "Count Unique",
  };
  return `${aggNames[v.agg || "count"] || v.agg} of ${v.field}`;
}

function normKey(v) {
  if (v === undefined || v === null) return "(blank)";
  return v;
}

function tupleCompare(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const c = valueCompare(a[i], b[i]);
    if (c !== 0) return c;
  }
  return a.length - b.length;
}

function applyFilters(records, filters) {
  if (!filters) return records.slice();
  const entries = Object.entries(filters);
  if (entries.length === 0) return records.slice();
  return records.filter((rec) =>
    entries.every(([field, allowed]) => {
      const vals = Array.isArray(allowed) ? allowed : [allowed];
      return vals.some((v) => looseEquals(rec[field], v));
    })
  );
}

function looseEquals(a, b) {
  if (typeof a === "string" && typeof b === "string") {
    return a.toLowerCase() === b.toLowerCase();
  }
  return a === b;
}

function collectLists(buckets, rowPrefix, colPrefix, otherKeys) {
  const list = [];
  if (rowPrefix !== null) {
    for (const ct of otherKeys.length ? otherKeys : [[]]) {
      const l = buckets.get(rowPrefix + BUCKET_SEP + ct.join(KEY_SEP));
      if (l) list.push(...l);
    }
  } else {
    for (const rt of otherKeys.length ? otherKeys : [[]]) {
      const l = buckets.get(rt.join(KEY_SEP) + BUCKET_SEP + colPrefix);
      if (l) list.push(...l);
    }
  }
  return list;
}

function aggregate(records, valueSpec) {
  const { field, agg } = valueSpec;
  if (agg === "count") {
    let n = 0;
    for (const rec of records) {
      const v = rec[field];
      if (v !== undefined && v !== null && v !== "") n++;
    }
    return n;
  }
  if (agg === "countUnique") {
    const seen = new Set();
    for (const rec of records) {
      const v = rec[field];
      if (v !== undefined && v !== null && v !== "") {
        seen.add(typeof v === "string" ? "s:" + v.toLowerCase() : typeof v + ":" + String(v));
      }
    }
    return seen.size;
  }
  const nums = [];
  for (const rec of records) {
    const v = rec[field];
    if (typeof v === "number" && Number.isFinite(v)) nums.push(v);
  }
  if (nums.length === 0) return null;
  if (agg === "sum") return nums.reduce((a, b) => a + b, 0);
  if (agg === "average") return nums.reduce((a, b) => a + b, 0) / nums.length;
  if (agg === "min") return Math.min(...nums);
  if (agg === "max") return Math.max(...nums);
  throw new Error(`pivotTable: unknown aggregation "${agg}"`);
}

function transform(showAs, val, { rowTotal, colTotal, grand }) {
  if (!showAs) return val;
  if (val === null || val === undefined) return null;
  if (showAs === "percentOfColumnTotal") {
    return colTotal ? val / colTotal : null;
  }
  if (showAs === "percentOfRowTotal") {
    return rowTotal ? val / rowTotal : null;
  }
  if (showAs === "percentOfGrandTotal") {
    return grand ? val / grand : null;
  }
  throw new Error(`pivotTable: unknown showAs "${showAs}"`);
}

function transformRowTotal(showAs, val, grand) {
  if (!showAs) return val;
  if (val === null || val === undefined) return null;
  if (showAs === "percentOfRowTotal") return 1;
  return grand ? val / grand : null; // % of column/grand: row total vs grand
}

function transformColTotal(showAs, val, grand) {
  if (!showAs) return val;
  if (val === null || val === undefined) return null;
  if (showAs === "percentOfColumnTotal") return 1;
  return grand ? val / grand : null;
}

function subtotalRow(result, firstKey, nVals) {
  const sub = result.subtotals.get(String(firstKey));
  const row = [`${firstKey} Total`];
  while (row.length < result.rowFields.length) row.push("");
  const colGroups = result.colFields.length > 0 ? result.colKeys : [[]];
  for (let c = 0; c < colGroups.length; c++) {
    for (let vi = 0; vi < nVals; vi++) {
      const val = sub && sub.cells[c] ? sub.cells[c][vi] : null;
      row.push(val === null || val === undefined ? "" : val);
    }
  }
  for (let vi = 0; vi < nVals; vi++) {
    const val = sub ? sub.rowTotal[vi] : null;
    row.push(val === null || val === undefined ? "" : val);
  }
  return row;
}
