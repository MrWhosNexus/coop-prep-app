// The aggregation pipeline: filter → group by dimensions → aggregate measures →
// sort → top-N. Pure functions over plain row objects.
//
// This is the query engine behind the viz. Tableau builds a SQL GROUP BY from the
// pills on your shelves; this module is that step, in memory.

import { toNumber, isBlank, coerceValue } from "./fields.js";

/** Aggregation functions available on a measure pill. */
export const Aggregation = {
  SUM: "SUM",
  AVG: "AVG",
  COUNT: "COUNT",
  COUNTD: "COUNTD",
  MIN: "MIN",
  MAX: "MAX",
  MEDIAN: "MEDIAN",
  PERCENTILE: "PERCENTILE",
  VARIANCE: "VARIANCE",
  STDEV: "STDEV",
  ATTR: "ATTR",
};

/** Aggregations whose result is a number regardless of the input field type. */
const COUNTING = new Set([Aggregation.COUNT, Aggregation.COUNTD]);

/**
 * Aggregations that are legal for a field of the given type.
 * COUNT/COUNTD/MIN/MAX/ATTR work on anything; the arithmetic ones need numbers.
 * @param {string} type a FieldType
 * @returns {Array<string>}
 */
export function availableAggregations(type) {
  if (type === "number") {
    return [
      Aggregation.SUM, Aggregation.AVG, Aggregation.MEDIAN, Aggregation.PERCENTILE,
      Aggregation.VARIANCE, Aggregation.STDEV,
      Aggregation.MIN, Aggregation.MAX, Aggregation.COUNT, Aggregation.COUNTD, Aggregation.ATTR,
    ];
  }
  if (type === "date") {
    return [Aggregation.MIN, Aggregation.MAX, Aggregation.COUNT, Aggregation.COUNTD, Aggregation.ATTR];
  }
  // Exact shape pinned by test/viz.test.js's "availableAggregations narrows by
  // type" — anything but string keeps its historical two-item list; ATTR is
  // still legal and reachable for a string field, just not offered by default.
  return [Aggregation.COUNT, Aggregation.COUNTD];
}

/**
 * Apply one aggregation to a list of raw values.
 * Blanks are skipped (SQL semantics): AVG ignores nulls rather than treating
 * them as zero, and COUNT counts non-null values.
 * @param {string} aggregation an Aggregation
 * @param {Array<*>} values
 * @param {Object} [options] { percentile } — 0..1, only read by PERCENTILE (default 0.5)
 * @returns {number|*|null}
 */
export function applyAggregation(aggregation, values, options = {}) {
  const present = values.filter((v) => !isBlank(v));

  switch (aggregation) {
    case Aggregation.COUNT:
      return present.length;
    case Aggregation.COUNTD:
      return new Set(present.map((v) => (v instanceof Date ? v.getTime() : v))).size;
    case Aggregation.ATTR: {
      // Tableau's ATTR: the shared value when every row agrees, else "*" — the
      // "this dimension is mixed at this level of detail" signal.
      if (present.length === 0) return null;
      const key = (v) => (v instanceof Date ? v.toISOString() : String(v));
      const first = key(present[0]);
      return present.every((v) => key(v) === first) ? present[0] : "*";
    }
    default:
      break;
  }

  if (present.length === 0) return null;

  if (aggregation === Aggregation.MIN || aggregation === Aggregation.MAX) {
    const nums = present.map(toNumber);
    if (nums.every((n) => n !== null)) {
      return aggregation === Aggregation.MIN ? Math.min(...nums) : Math.max(...nums);
    }
    const sorted = [...present].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return aggregation === Aggregation.MIN ? sorted[0] : sorted[sorted.length - 1];
  }

  const nums = present.map(toNumber).filter((n) => n !== null);
  if (nums.length === 0) return null;

  switch (aggregation) {
    case Aggregation.SUM:
      return nums.reduce((a, b) => a + b, 0);
    case Aggregation.AVG:
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    case Aggregation.MEDIAN: {
      const s = [...nums].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
    }
    case Aggregation.PERCENTILE: {
      // Linear interpolation between closest ranks (the common "R-7"/Excel
      // method, and what Tableau's PERCENTILE table calc uses).
      const p = Math.max(0, Math.min(1, options.percentile ?? 0.5));
      const s = [...nums].sort((a, b) => a - b);
      if (s.length === 1) return s[0];
      const idx = p * (s.length - 1);
      const lo = Math.floor(idx);
      const hi = Math.ceil(idx);
      if (lo === hi) return s[lo];
      return s[lo] + (s[hi] - s[lo]) * (idx - lo);
    }
    case Aggregation.VARIANCE: {
      // Sample variance (N-1) — matches Tableau's VAR/default variance calc.
      // A single point has no spread to estimate, so SQL's VAR_SAMP convention
      // (NULL for n<2) applies rather than reporting a false zero.
      if (nums.length < 2) return null;
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      const ss = nums.reduce((a, b) => a + (b - mean) * (b - mean), 0);
      return ss / (nums.length - 1);
    }
    case Aggregation.STDEV: {
      const variance = applyAggregation(Aggregation.VARIANCE, values, options);
      return variance === null ? null : Math.sqrt(variance);
    }
    default:
      throw new Error(`Unknown aggregation: ${aggregation}`);
  }
}

/**
 * The column name an aggregated measure gets in the result — Tableau's pill
 * caption, e.g. SUM(loan_amount). Callers grade specs against these.
 * @param {string} aggregation
 * @param {string} fieldName
 * @returns {string}
 */
export function aggregatedName(aggregation, fieldName) {
  return `${aggregation}(${fieldName})`;
}

// --- Filters ---------------------------------------------------------------

/**
 * Filter kinds. Categorical and range test one row at a time. topN needs
 * aggregated values to rank on, so it is resolved separately — see applyTopN.
 */
export const FilterType = {
  CATEGORICAL: "categorical",
  RANGE: "range",
  TOP_N: "topN",
};

/**
 * Keep only listed members.
 * @param {string} field
 * @param {Array<*>} values
 * @returns {Object} filter
 */
export function categoricalFilter(field, values) {
  return { type: FilterType.CATEGORICAL, field, include: [...values] };
}

/**
 * Drop listed members.
 * @param {string} field
 * @param {Array<*>} values
 * @returns {Object} filter
 */
export function excludeFilter(field, values) {
  return { type: FilterType.CATEGORICAL, field, exclude: [...values] };
}

/**
 * Numeric/date range filter. Bounds are inclusive by default; null means open.
 * @param {string} field
 * @param {number|null} min
 * @param {number|null} max
 * @param {Object} [options] { includeMin, includeMax }
 * @returns {Object} filter
 */
export function rangeFilter(field, min, max, options = {}) {
  return {
    type: FilterType.RANGE,
    field,
    min: min ?? null,
    max: max ?? null,
    includeMin: options.includeMin !== false,
    includeMax: options.includeMax !== false,
  };
}

/**
 * Keep the N groups with the highest (or lowest) aggregated value.
 * @param {string} field the dimension being limited
 * @param {number} n
 * @param {Object} by { field, aggregation } — the measure that ranks groups
 * @param {Object} [options] { direction: "top"|"bottom" }
 * @returns {Object} filter
 */
export function topNFilter(field, n, by, options = {}) {
  return {
    type: FilterType.TOP_N,
    field,
    n,
    by: { field: by.field, aggregation: by.aggregation || Aggregation.SUM },
    direction: options.direction === "bottom" ? "bottom" : "top",
  };
}

function matchesCategorical(value, filter) {
  const key = value instanceof Date ? value.toISOString() : String(value);
  const norm = (v) => (v instanceof Date ? v.toISOString() : String(v));
  if (filter.include) return filter.include.some((v) => norm(v) === key);
  if (filter.exclude) return !filter.exclude.some((v) => norm(v) === key);
  return true;
}

function matchesRange(value, filter) {
  const n = value instanceof Date ? value.getTime() : toNumber(value);
  if (n === null || Number.isNaN(n)) return false;
  const min = filter.min instanceof Date ? filter.min.getTime() : filter.min;
  const max = filter.max instanceof Date ? filter.max.getTime() : filter.max;
  if (min !== null && (filter.includeMin ? n < min : n <= min)) return false;
  if (max !== null && (filter.includeMax ? n > max : n >= max)) return false;
  return true;
}

/**
 * Apply row-level filters (categorical + range). Top-N is NOT applied here — it
 * ranks on aggregated values, so `aggregateRows` resolves it separately.
 * @param {Array<Object>} rows
 * @param {Array<Object>} filters
 * @returns {Array<Object>}
 */
export function applyFilters(rows, filters) {
  if (!filters?.length) return rows;
  const rowLevel = filters.filter((f) => f.type !== FilterType.TOP_N);
  if (!rowLevel.length) return rows;

  return rows.filter((row) =>
    rowLevel.every((f) => {
      const value = row[f.field];
      if (f.type === FilterType.CATEGORICAL) return matchesCategorical(value, f);
      if (f.type === FilterType.RANGE) return matchesRange(value, f);
      return true;
    })
  );
}

// --- Grouping --------------------------------------------------------------

function groupKeyOf(row, dimensions) {
  return JSON.stringify(
    dimensions.map((d) => {
      const v = row[d];
      return v instanceof Date ? v.toISOString() : v === undefined ? null : v;
    })
  );
}

/**
 * Group rows by dimension values, preserving first-seen order.
 * @param {Array<Object>} rows
 * @param {Array<string>} dimensions field names
 * @returns {Array<{key:string, values:Object, rows:Array<Object>}>}
 */
export function groupBy(rows, dimensions) {
  if (!dimensions?.length) return [{ key: "__all__", values: {}, rows }];
  const groups = new Map();
  for (const row of rows) {
    const key = groupKeyOf(row, dimensions);
    let g = groups.get(key);
    if (!g) {
      g = { key, values: Object.fromEntries(dimensions.map((d) => [d, row[d] ?? null])), rows: [] };
      groups.set(key, g);
    }
    g.rows.push(row);
  }
  return [...groups.values()];
}

// The value a cell orders on. Dates order on their epoch time — String(Date)
// puts the weekday name first, so a lexical fallback would sort a week Fri, Mon,
// Sat, Sun, Thu, Tue, Wed. toNumber() is deliberately NOT taught about Dates:
// inferType() uses it to tell a number column from a date one, and MIN/MAX rely
// on toNumber(Date) === null to return a real Date rather than epoch millis.
function sortValue(v) {
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.getTime() : null;
  return typeof v === "number" ? v : toNumber(v);
}

// The identity of one member of a dimension. Mirrors groupBy's normalisation so
// a member key computed from a raw row matches one computed from a group.
function memberKey(value) {
  const v = value ?? null;
  return v instanceof Date ? v.toISOString() : String(v);
}

/**
 * The members of `filter.field` that survive a top-N filter.
 *
 * Ranking groups by filter.field ALONE is the whole point: "top 2 states" ranks
 * states, so it must aggregate each state across every other dimension on the
 * shelves first. Ranking the result rows instead answers "the 2 biggest bars",
 * which coincides only while there is exactly one dimension — with a second
 * dimension it silently drops whole members whose rows are individually small.
 * Re-grouping (rather than re-summing the aggregated column) also keeps AVG,
 * MEDIAN, MIN and MAX honest: those do not compose from per-group results.
 */
function topNMembers(rows, filter) {
  const ranked = groupBy(rows, [filter.field]).map((g) => ({
    key: memberKey(g.values[filter.field]),
    value: applyAggregation(filter.by.aggregation, g.rows.map((r) => r[filter.by.field])),
  }));
  ranked.sort((a, b) => {
    const av = sortValue(a.value) ?? -Infinity;
    const bv = sortValue(b.value) ?? -Infinity;
    return filter.direction === "bottom" ? av - bv : bv - av;
  });
  return new Set(ranked.slice(0, Math.max(0, filter.n)).map((r) => r.key));
}

/**
 * Drop the rows of every member that a top-N filter excludes. Runs on raw rows:
 * a member is kept or removed whole, so the remaining aggregation sees exactly
 * the data of the surviving members.
 */
function applyTopN(rows, filter) {
  const kept = topNMembers(rows, filter);
  return rows.filter((r) => kept.has(memberKey(r[filter.field])));
}

/**
 * The full pipeline. Filters (row-level, then top-N by member), groups by
 * `dimensions`, aggregates each measure, then sorts.
 *
 * Result rows carry the raw dimension values under their own names and each
 * aggregated measure under its pill caption (e.g. "AVG(income)"), plus a
 * non-enumerable-ish `__key` and `__count` for downstream joins/debugging.
 *
 * @param {Array<Object>} rows
 * @param {Object} config
 * @param {Array<string>} [config.dimensions] field names to group by
 * @param {Array<{field:string, aggregation:string}>} [config.measures]
 * @param {Array<Object>} [config.filters]
 * @param {{field:string, direction:("asc"|"desc")}} [config.sort]
 * @returns {Array<Object>} aggregated rows
 */
export function aggregateRows(rows, config = {}) {
  const dimensions = config.dimensions ?? [];
  const measures = config.measures ?? [];
  const filters = config.filters ?? [];

  let filtered = applyFilters(rows, filters);
  for (const f of filters) {
    if (f.type === FilterType.TOP_N) filtered = applyTopN(filtered, f);
  }
  const groups = groupBy(filtered, dimensions);

  const result = groups.map((g) => {
    const out = { ...g.values, __key: g.key, __count: g.rows.length };
    for (const m of measures) {
      out[aggregatedName(m.aggregation, m.field)] = applyAggregation(
        m.aggregation,
        g.rows.map((r) => r[m.field]),
        { percentile: m.percentile }
      );
    }
    return out;
  });

  return config.sort ? sortRows(result, config.sort) : result;
}

/**
 * Sort aggregated rows by a column (raw dimension name or a pill caption).
 * Numbers sort numerically, dates chronologically, everything else lexically.
 * @param {Array<Object>} rows
 * @param {{field:string, direction:("asc"|"desc")}} sort
 * @returns {Array<Object>}
 */
export function sortRows(rows, sort) {
  const dir = sort.direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = a[sort.field];
    const bv = b[sort.field];
    const an = sortValue(av);
    const bn = sortValue(bv);
    if (an !== null && bn !== null) return (an - bn) * dir;
    const as = String(av ?? "");
    const bs = String(bv ?? "");
    return (as < bs ? -1 : as > bs ? 1 : 0) * dir;
  });
}

/**
 * Distinct values of a field, in first-seen order — powers the filter UI's
 * member list and band-scale domains.
 * @param {Array<Object>} rows
 * @param {string} field
 * @param {string} [type] a FieldType to coerce through
 * @returns {Array<*>}
 */
export function distinctValues(rows, field, type) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const v = type ? coerceValue(row[field], type) : row[field];
    const k = v instanceof Date ? v.toISOString() : String(v);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}
