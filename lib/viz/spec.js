// The VizSpec: Tableau's shelf metaphor as plain, serializable data.
//
// A spec is what the drag-and-drop UI edits and what a lesson GRADES. So it is
// deliberately boring JSON — no functions, no class instances, no data inside it.
// "Put RACE on Rows and COUNT(applicant_id) on Columns" is a fact about this
// object, checkable with specMatches().

import { FieldRole, FieldType, defaultAggregation } from "./fields.js";
import { MarkType, bestMarkType, checkMark, validMarkTypes } from "./marks.js";

/** The shelves a field can be dropped on. */
export const Shelf = {
  ROWS: "rows",
  COLUMNS: "columns",
  COLOR: "color",
  SIZE: "size",
  LABEL: "label",
  DETAIL: "detail",
  TOOLTIP: "tooltip",
  FILTERS: "filters",
};

/** Shelves that accept many pills. */
export const MULTI_SHELVES = [Shelf.ROWS, Shelf.COLUMNS, Shelf.DETAIL, Shelf.TOOLTIP, Shelf.FILTERS];

/** Shelves that hold exactly one pill (dropping replaces). */
export const SINGLE_SHELVES = [Shelf.COLOR, Shelf.SIZE, Shelf.LABEL];

/** The mark-card shelves, as opposed to the axis shelves. */
export const MARK_CARD_SHELVES = [Shelf.COLOR, Shelf.SIZE, Shelf.LABEL, Shelf.DETAIL, Shelf.TOOLTIP];

/** Tableau's pill colours. Discrete pills are blue, continuous pills are green. */
export const PillColor = {
  DISCRETE: "blue",
  CONTINUOUS: "green",
};

/**
 * Decide whether a pill is discrete (band axis, blue) or continuous (linear
 * axis, green).
 *
 * The rule, and the whole lesson: a field is continuous when it is AGGREGATED.
 * A measure dropped on a shelf aggregates by default → continuous. A dimension
 * slices → discrete. Either can be overridden (`discrete`), because "SUM(x) as
 * a discrete pill" and "year as a continuous axis" are both real, useful moves.
 *
 * @param {Object} params { role, aggregation, discrete }
 * @returns {boolean}
 */
export function resolveDiscrete({ role, aggregation, discrete }) {
  if (typeof discrete === "boolean") return discrete;
  if (aggregation) return false;
  return role === FieldRole.DIMENSION;
}

/**
 * Build an encoding (a "pill") for a field on a shelf.
 * @param {Object} field a field descriptor from fields.js
 * @param {Object} [options] { aggregation, discrete, alias, sort }
 * @returns {Object} a resolved encoding
 */
export function createEncoding(field, options = {}) {
  if (!field?.name) throw new Error("createEncoding requires a field with a name");

  // A measure aggregates unless the caller explicitly says otherwise; passing
  // aggregation:null is how you get a disaggregated (row-level) measure pill.
  const aggregation =
    "aggregation" in options
      ? options.aggregation
      : field.role === FieldRole.MEASURE
        ? field.defaultAggregation || defaultAggregation(field.type, field.role)
        : null;

  const discrete = resolveDiscrete({ role: field.role, aggregation, discrete: options.discrete });

  return {
    field: field.name,
    type: field.type,
    role: field.role,
    aggregation: aggregation ?? null,
    discrete,
    pillColor: discrete ? PillColor.DISCRETE : PillColor.CONTINUOUS,
    alias: options.alias ?? null,
    sort: options.sort ?? null,
  };
}

/**
 * The caption shown on the pill and used as the aggregated column name.
 * @param {Object} encoding
 * @returns {string}
 */
export function encodingLabel(encoding) {
  if (!encoding) return "";
  if (encoding.alias) return encoding.alias;
  return encoding.aggregation ? `${encoding.aggregation}(${encoding.field})` : encoding.field;
}

/**
 * The column name this encoding reads from an aggregated row.
 * @param {Object} encoding
 * @returns {string}
 */
export function encodingColumn(encoding) {
  if (!encoding) return "";
  return encoding.aggregation ? `${encoding.aggregation}(${encoding.field})` : encoding.field;
}

/** @param {Object} encoding @returns {boolean} */
export function isDiscrete(encoding) {
  return encoding?.discrete === true;
}

/** @param {Object} encoding @returns {boolean} */
export function isContinuous(encoding) {
  return encoding?.discrete === false;
}

/**
 * A new, empty spec.
 * @param {Object} [init] any subset of the spec's own fields
 * @returns {Object} a VizSpec
 */
export function createSpec(init = {}) {
  return {
    title: init.title ?? "",
    mark: init.mark ?? null, // null → "Automatic", resolved by resolveMark()
    rows: init.rows ?? [],
    columns: init.columns ?? [],
    color: init.color ?? null,
    size: init.size ?? null,
    label: init.label ?? null,
    detail: init.detail ?? [],
    tooltip: init.tooltip ?? [],
    filters: init.filters ?? [],
    calculatedFields: init.calculatedFields ?? [],
    sort: init.sort ?? null,
  };
}

/**
 * Drop a pill on a shelf. Returns a NEW spec — specs are immutable so the UI can
 * keep an undo stack for free.
 * @param {Object} spec
 * @param {string} shelf a Shelf
 * @param {Object} encoding from createEncoding
 * @returns {Object} a new VizSpec
 */
export function putOnShelf(spec, shelf, encoding) {
  if (SINGLE_SHELVES.includes(shelf)) return { ...spec, [shelf]: encoding };
  if (MULTI_SHELVES.includes(shelf)) return { ...spec, [shelf]: [...(spec[shelf] ?? []), encoding] };
  throw new Error(`Unknown shelf: ${shelf}`);
}

/**
 * Remove a pill from a shelf.
 * @param {Object} spec
 * @param {string} shelf a Shelf
 * @param {string|number} [which] field name, or index for multi-shelves; omit to
 *   clear a single-pill shelf
 * @returns {Object} a new VizSpec
 */
export function removeFromShelf(spec, shelf, which) {
  if (SINGLE_SHELVES.includes(shelf)) return { ...spec, [shelf]: null };
  if (!MULTI_SHELVES.includes(shelf)) throw new Error(`Unknown shelf: ${shelf}`);

  const current = spec[shelf] ?? [];
  const next =
    typeof which === "number"
      ? current.filter((_, i) => i !== which)
      : current.filter((e) => (e.field ?? e.name) !== which);
  return { ...spec, [shelf]: next };
}

/**
 * Change a pill's aggregation, re-deriving discrete/continuous.
 * @param {Object} spec
 * @param {string} shelf
 * @param {string} fieldName
 * @param {string|null} aggregation
 * @returns {Object} a new VizSpec
 */
export function setAggregation(spec, shelf, fieldName, aggregation) {
  const remap = (e) => {
    if (e?.field !== fieldName) return e;
    const discrete = resolveDiscrete({ role: e.role, aggregation, discrete: undefined });
    return {
      ...e,
      aggregation: aggregation ?? null,
      discrete,
      pillColor: discrete ? PillColor.DISCRETE : PillColor.CONTINUOUS,
    };
  };
  if (SINGLE_SHELVES.includes(shelf)) return { ...spec, [shelf]: remap(spec[shelf]) };
  return { ...spec, [shelf]: (spec[shelf] ?? []).map(remap) };
}

/**
 * Explicitly toggle a pill between discrete (blue) and continuous (green).
 * @param {Object} spec
 * @param {string} shelf
 * @param {string} fieldName
 * @param {boolean} discrete
 * @returns {Object} a new VizSpec
 */
export function setDiscrete(spec, shelf, fieldName, discrete) {
  const remap = (e) =>
    e?.field === fieldName
      ? { ...e, discrete, pillColor: discrete ? PillColor.DISCRETE : PillColor.CONTINUOUS }
      : e;
  if (SINGLE_SHELVES.includes(shelf)) return { ...spec, [shelf]: remap(spec[shelf]) };
  return { ...spec, [shelf]: (spec[shelf] ?? []).map(remap) };
}

/**
 * Add a filter.
 * @param {Object} spec
 * @param {Object} filter from aggregate.js's filter builders
 * @returns {Object} a new VizSpec
 */
export function addFilter(spec, filter) {
  return { ...spec, filters: [...(spec.filters ?? []), filter] };
}

/**
 * Remove every filter on a field.
 * @param {Object} spec
 * @param {string} fieldName
 * @returns {Object} a new VizSpec
 */
export function removeFilter(spec, fieldName) {
  return { ...spec, filters: (spec.filters ?? []).filter((f) => f.field !== fieldName) };
}

/**
 * The mark actually used: the explicit choice, or Show Me's pick when the spec
 * is set to Automatic.
 * @param {Object} spec
 * @returns {string} a MarkType
 */
export function resolveMark(spec) {
  return spec.mark ?? bestMarkType(spec);
}

/**
 * Every pill on the spec, with the shelf it sits on.
 * @param {Object} spec
 * @returns {Array<{shelf:string, encoding:Object}>}
 */
export function allEncodings(spec) {
  const out = [];
  for (const shelf of MULTI_SHELVES) {
    if (shelf === Shelf.FILTERS) continue;
    for (const e of spec[shelf] ?? []) out.push({ shelf, encoding: e });
  }
  for (const shelf of SINGLE_SHELVES) {
    if (spec[shelf]) out.push({ shelf, encoding: spec[shelf] });
  }
  return out;
}

/**
 * The dimensions the aggregation must group by: every discrete pill anywhere,
 * plus any pill on Detail. This is exactly Tableau's level-of-detail rule.
 * @param {Object} spec
 * @returns {Array<string>} field names, de-duplicated
 */
export function specDimensions(spec) {
  const names = [];
  for (const { shelf, encoding } of allEncodings(spec)) {
    const include = shelf === Shelf.DETAIL || (isDiscrete(encoding) && !encoding.aggregation);
    if (include && !names.includes(encoding.field)) names.push(encoding.field);
  }
  return names;
}

/**
 * The aggregated measures the pipeline must compute.
 * @param {Object} spec
 * @returns {Array<{field:string, aggregation:string}>} de-duplicated
 */
export function specMeasures(spec) {
  const out = [];
  for (const { encoding } of allEncodings(spec)) {
    if (!encoding.aggregation) continue;
    if (out.some((m) => m.field === encoding.field && m.aggregation === encoding.aggregation)) continue;
    out.push({ field: encoding.field, aggregation: encoding.aggregation });
  }
  return out;
}

/**
 * Check a spec for problems. Errors block rendering; warnings are teaching
 * nudges ("this will draw, but it isn't what you meant").
 * @param {Object} spec
 * @param {Array<Object>} [fields] known fields; enables unknown-field errors
 * @returns {{valid:boolean, errors:Array<string>, warnings:Array<string>}}
 */
export function validateSpec(spec, fields) {
  const errors = [];
  const warnings = [];

  if (!spec || typeof spec !== "object") {
    return { valid: false, errors: ["Spec must be an object."], warnings: [] };
  }

  const encodings = allEncodings(spec);

  if (encodings.length === 0) {
    errors.push("Drop at least one field on Rows or Columns to build a view.");
  }

  if (fields) {
    const known = new Set([
      ...fields.map((f) => f.name),
      ...(spec.calculatedFields ?? []).map((f) => f.name),
    ]);
    for (const { shelf, encoding } of encodings) {
      if (!known.has(encoding.field)) errors.push(`Unknown field "${encoding.field}" on ${shelf}.`);
    }
    for (const f of spec.filters ?? []) {
      if (!known.has(f.field)) errors.push(`Filter references unknown field "${f.field}".`);
    }
  }

  for (const { shelf, encoding } of encodings) {
    if (encoding.aggregation && encoding.role === FieldRole.DIMENSION) {
      const countish = encoding.aggregation === "COUNT" || encoding.aggregation === "COUNTD";
      if (!countish && encoding.type !== FieldType.NUMBER && encoding.type !== FieldType.DATE) {
        errors.push(
          `Cannot ${encoding.aggregation} the dimension "${encoding.field}" — use COUNT or COUNTD instead.`
        );
      }
    }
    if (shelf === Shelf.SIZE && encoding.discrete) {
      warnings.push(`Size works best with a continuous measure; "${encoding.field}" is discrete.`);
    }
  }

  if (spec.mark) {
    const check = checkMark(spec, spec.mark);
    if (!check.valid) errors.push(check.reason);
  }

  const rowsHasMeasure = (spec.rows ?? []).some(isContinuous);
  const colsHasMeasure = (spec.columns ?? []).some(isContinuous);
  if (encodings.length > 0 && !rowsHasMeasure && !colsHasMeasure) {
    warnings.push("No measure on Rows or Columns — this will render as a text table.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Serialize to JSON. Drops derived/cached fields (pillColor, parsed ASTs) so the
 * output is stable and diffable — lessons store expected specs as fixtures.
 * @param {Object} spec
 * @param {Object} [options] { pretty }
 * @returns {string} JSON
 */
export function serializeSpec(spec, options = {}) {
  const stripEncoding = (e) =>
    e
      ? {
          field: e.field,
          type: e.type,
          role: e.role,
          aggregation: e.aggregation ?? null,
          discrete: e.discrete,
          ...(e.alias ? { alias: e.alias } : {}),
          ...(e.sort ? { sort: e.sort } : {}),
        }
      : null;

  const plain = {
    version: 1,
    title: spec.title ?? "",
    mark: spec.mark ?? null,
    rows: (spec.rows ?? []).map(stripEncoding),
    columns: (spec.columns ?? []).map(stripEncoding),
    color: stripEncoding(spec.color),
    size: stripEncoding(spec.size),
    label: stripEncoding(spec.label),
    detail: (spec.detail ?? []).map(stripEncoding),
    tooltip: (spec.tooltip ?? []).map(stripEncoding),
    filters: spec.filters ?? [],
    calculatedFields: (spec.calculatedFields ?? []).map((f) => ({
      name: f.name,
      type: f.type,
      role: f.role,
      expression: f.expression,
    })),
    sort: spec.sort ?? null,
  };
  return JSON.stringify(plain, null, options.pretty ? 2 : 0);
}

/**
 * Parse a serialized spec, re-deriving what serializeSpec dropped.
 * @param {string|Object} json
 * @returns {Object} a VizSpec
 * @throws {Error} on malformed JSON or an unsupported version
 */
export function deserializeSpec(json) {
  const raw = typeof json === "string" ? JSON.parse(json) : json;
  if (!raw || typeof raw !== "object") throw new Error("Invalid spec payload");
  if (raw.version !== undefined && raw.version !== 1) {
    throw new Error(`Unsupported spec version: ${raw.version}`);
  }

  const rehydrate = (e) =>
    e ? { ...e, aggregation: e.aggregation ?? null, pillColor: e.discrete ? PillColor.DISCRETE : PillColor.CONTINUOUS } : null;

  return createSpec({
    title: raw.title ?? "",
    mark: raw.mark ?? null,
    rows: (raw.rows ?? []).map(rehydrate),
    columns: (raw.columns ?? []).map(rehydrate),
    color: rehydrate(raw.color),
    size: rehydrate(raw.size),
    label: rehydrate(raw.label),
    detail: (raw.detail ?? []).map(rehydrate),
    tooltip: (raw.tooltip ?? []).map(rehydrate),
    filters: raw.filters ?? [],
    calculatedFields: raw.calculatedFields ?? [],
    sort: raw.sort ?? null,
  });
}

/**
 * Grade a spec against an expected shape — the hook every Tableau lesson hangs
 * off. Only the shelves named in `expected` are checked, so a lesson can assert
 * "RACE on Rows" without caring about the rest of the view.
 *
 * `expected` shelves take field names, or {field, aggregation, discrete} objects.
 *
 * @param {Object} spec
 * @param {Object} expected e.g. { rows:["race"], columns:[{field:"applicant_id", aggregation:"COUNT"}], mark:"bar" }
 * @returns {{matches:boolean, misses:Array<string>}}
 */
export function specMatches(spec, expected) {
  const misses = [];
  const norm = (x) => (typeof x === "string" ? { field: x } : x);

  const describe = (want) =>
    want.aggregation ? `${want.aggregation}(${want.field})` : want.field;

  for (const shelf of [...MULTI_SHELVES, ...SINGLE_SHELVES]) {
    if (!(shelf in expected)) continue;
    if (shelf === Shelf.FILTERS) continue;

    const want = expected[shelf];
    const actual = SINGLE_SHELVES.includes(shelf)
      ? spec[shelf] ? [spec[shelf]] : []
      : spec[shelf] ?? [];

    for (const w of (Array.isArray(want) ? want : [want]).filter(Boolean).map(norm)) {
      const hit = actual.find(
        (a) =>
          a.field === w.field &&
          (w.aggregation === undefined || (a.aggregation ?? null) === (w.aggregation ?? null)) &&
          (w.discrete === undefined || a.discrete === w.discrete)
      );
      if (!hit) misses.push(`Expected ${describe(w)} on ${shelf}.`);
    }
  }

  if (expected.mark && resolveMark(spec) !== expected.mark) {
    misses.push(`Expected the ${expected.mark} mark type, found ${resolveMark(spec)}.`);
  }

  if (expected.filters) {
    for (const w of expected.filters) {
      const hit = (spec.filters ?? []).find(
        (f) => f.field === w.field && (w.type === undefined || f.type === w.type)
      );
      if (!hit) misses.push(`Expected a filter on ${w.field}.`);
    }
  }

  return { matches: misses.length === 0, misses };
}

export { MarkType, validMarkTypes, bestMarkType };
