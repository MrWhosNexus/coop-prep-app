// Mark types and Tableau's "Show Me" logic: given what is on the shelves, which
// mark types actually make sense, and which one should we pick by default?
//
// This module reads plain encoding objects ({ role, discrete, type, ... } — see
// spec.js) and never imports spec.js, so the module graph stays acyclic.

import { FieldRole, FieldType } from "./fields.js";

/** Mark types the render layer knows how to draw. */
export const MarkType = {
  BAR: "bar",
  LINE: "line",
  AREA: "area",
  SCATTER: "scatter",
  TEXT: "text",
  MAP: "map",
};

/** Human labels for the mark-type dropdown. */
export const MARK_LABELS = {
  [MarkType.BAR]: "Bar",
  [MarkType.LINE]: "Line",
  [MarkType.AREA]: "Area",
  [MarkType.SCATTER]: "Scatter",
  [MarkType.TEXT]: "Text Table",
  [MarkType.MAP]: "Map",
};

// Field names that carry a geographic role. Tableau auto-detects these; the HMDA
// extract's zip_code is the one that matters for our lessons.
const GEO_PATTERN = /^(zip|zipcode|zip_code|postal|postcode|state|country|county|city|region|latitude|longitude|lat|lon|lng|fips)$/i;

/**
 * True when a field name looks geographic.
 * @param {string} name
 * @returns {boolean}
 */
export function isGeographic(name) {
  return GEO_PATTERN.test(String(name ?? ""));
}

const isDiscreteEnc = (e) => e?.discrete === true;
const isContinuousEnc = (e) => e?.discrete === false;

/**
 * Summarise a shelf configuration into the handful of facts every Show Me rule
 * is written against.
 * @param {Object} spec a VizSpec
 * @returns {Object} shelf statistics
 */
export function classifyShelves(spec) {
  const rows = spec?.rows ?? [];
  const columns = spec?.columns ?? [];
  const all = [...rows, ...columns];

  // Mark-card pills shape the view without producing an axis. They matter for
  // geography especially: dropping zip_code on Detail is THE way to build a map.
  const markCard = [
    ...(spec?.detail ?? []),
    ...(spec?.tooltip ?? []),
    spec?.color,
    spec?.size,
    spec?.label,
  ].filter(Boolean);
  const everywhere = [...all, ...markCard];

  return {
    rows,
    columns,
    all,
    markCard,
    rowCount: rows.length,
    columnCount: columns.length,
    fieldCount: all.length,
    discreteCount: all.filter(isDiscreteEnc).length,
    continuousCount: all.filter(isContinuousEnc).length,
    measureCount: all.filter((e) => e.role === FieldRole.MEASURE).length,
    dimensionCount: all.filter((e) => e.role === FieldRole.DIMENSION).length,
    // An axis is "continuous" when it holds at least one continuous (green) pill.
    rowsContinuous: rows.some(isContinuousEnc),
    columnsContinuous: columns.some(isContinuousEnc),
    rowsDiscrete: rows.some(isDiscreteEnc),
    columnsDiscrete: columns.some(isDiscreteEnc),
    hasDate: all.some((e) => e.type === FieldType.DATE),
    dateOnAxis: all.some((e) => e.type === FieldType.DATE && e.role === FieldRole.DIMENSION),
    // Geography counts from any shelf, including Detail.
    hasGeo: everywhere.some((e) => isGeographic(e.field)),
    // The canonical bar/line shape: one axis discrete, the other continuous.
    crossed:
      (rows.some(isDiscreteEnc) && columns.some(isContinuousEnc)) ||
      (columns.some(isDiscreteEnc) && rows.some(isContinuousEnc)),
    // Scatter's shape: continuous measures on BOTH axes.
    dualContinuous: rows.some(isContinuousEnc) && columns.some(isContinuousEnc),
  };
}

// Each rule answers "is this mark drawable for this shelf config?" and, when it
// isn't, says why — the `reason` strings are shown to the learner.
const RULES = {
  [MarkType.BAR]: (s) =>
    s.crossed
      ? { valid: true }
      : { valid: false, reason: "Bar needs a dimension on one axis and a measure on the other." },

  [MarkType.LINE]: (s) =>
    s.crossed
      ? { valid: true }
      : { valid: false, reason: "Line needs an ordered field on one axis and a measure on the other." },

  [MarkType.AREA]: (s) =>
    s.crossed
      ? { valid: true }
      : { valid: false, reason: "Area needs an ordered field on one axis and a measure on the other." },

  [MarkType.SCATTER]: (s) =>
    s.dualContinuous
      ? { valid: true }
      : { valid: false, reason: "Scatter needs a continuous measure on both Rows and Columns." },

  [MarkType.TEXT]: (s) =>
    s.fieldCount > 0
      ? { valid: true }
      : { valid: false, reason: "Add at least one field to build a text table." },

  [MarkType.MAP]: (s) =>
    s.hasGeo
      ? { valid: true }
      : { valid: false, reason: "Map needs a geographic field (like zip_code) on a shelf." },
};

/**
 * Is `mark` drawable for this spec?
 * @param {Object} spec a VizSpec
 * @param {string} mark a MarkType
 * @returns {{valid:boolean, reason:(string|undefined)}}
 */
export function checkMark(spec, mark) {
  const rule = RULES[mark];
  if (!rule) return { valid: false, reason: `Unknown mark type "${mark}".` };
  return rule(classifyShelves(spec));
}

/**
 * @param {Object} spec a VizSpec
 * @param {string} mark a MarkType
 * @returns {boolean}
 */
export function isMarkValid(spec, mark) {
  return checkMark(spec, mark).valid;
}

/**
 * Every mark type that works for this spec, in menu order.
 * @param {Object} spec a VizSpec
 * @returns {Array<string>} MarkTypes
 */
export function validMarkTypes(spec) {
  const s = classifyShelves(spec);
  return Object.keys(RULES).filter((m) => RULES[m](s).valid);
}

/**
 * Tableau's "Show Me" default. Order matters — the first shape that fits wins.
 *
 * Reasoning, most specific first:
 *  - measures on both axes  → scatter (correlation)
 *  - a date dimension + a measure → line (change over time)
 *  - a discrete dimension + a measure → bar (comparison across categories)
 *  - anything else → text table
 *
 * Map is never the default: a geographic field is usually also a fine bar
 * category, and silently switching to a map surprises people.
 *
 * @param {Object} spec a VizSpec
 * @returns {string} a MarkType
 */
export function bestMarkType(spec) {
  const s = classifyShelves(spec);
  if (s.fieldCount === 0) return MarkType.TEXT;
  if (s.dualContinuous && s.measureCount >= 2) return MarkType.SCATTER;
  if (s.dateOnAxis && s.crossed) return MarkType.LINE;
  if (s.crossed) return MarkType.BAR;
  return MarkType.TEXT;
}

/**
 * The full Show Me panel state: what to default to, what is enabled, and why
 * each disabled option is disabled.
 * @param {Object} spec a VizSpec
 * @returns {{recommended:string, valid:Array<string>, options:Array<{mark:string,label:string,valid:boolean,reason:(string|undefined)}>}}
 */
export function showMe(spec) {
  const s = classifyShelves(spec);
  const options = Object.keys(RULES).map((mark) => {
    const r = RULES[mark](s);
    return { mark, label: MARK_LABELS[mark], valid: r.valid, reason: r.reason };
  });
  return {
    recommended: bestMarkType(spec),
    valid: options.filter((o) => o.valid).map((o) => o.mark),
    options,
  };
}

/**
 * Does this mark type connect its marks into a path (line/area) rather than
 * drawing them independently? The render layer needs to know.
 * @param {string} mark a MarkType
 * @returns {boolean}
 */
export function isPathMark(mark) {
  return mark === MarkType.LINE || mark === MarkType.AREA;
}
