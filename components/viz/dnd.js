// Drag-and-drop rules and shelf mutation for the viz builder.
//
// No JSX and no React on purpose: this is the decision layer (what may be
// dropped where, and what the spec becomes afterwards), so it must be importable
// by `node --test`, which cannot parse JSX. The components below it stay dumb.
//
// Imports are RELATIVE, not "@/..." — the alias is a bundler feature and the
// test runner resolves these paths itself.

import {
  Shelf,
  SINGLE_SHELVES,
  MULTI_SHELVES,
  createEncoding,
  encodingLabel,
  putOnShelf,
  setAggregation,
  setDiscrete,
} from "../../lib/viz/spec.js";
import {
  availableAggregations,
  categoricalFilter,
  rangeFilter,
  distinctValues,
} from "../../lib/viz/aggregate.js";
import { extent } from "../../lib/viz/scales.js";
import { FieldRole, coerceValue } from "../../lib/viz/fields.js";

/** Shelf captions, in the order the UI stacks them. */
export const SHELF_LABELS = {
  [Shelf.COLUMNS]: "Columns",
  [Shelf.ROWS]: "Rows",
  [Shelf.COLOR]: "Color",
  [Shelf.SIZE]: "Size",
  [Shelf.LABEL]: "Label",
  [Shelf.DETAIL]: "Detail",
  [Shelf.TOOLTIP]: "Tooltip",
  [Shelf.FILTERS]: "Filters",
};

/** The axis shelves, top to bottom. */
export const AXIS_SHELVES = [Shelf.COLUMNS, Shelf.ROWS];

/** The mark-card shelves, in Tableau's order. */
export const CARD_SHELVES = [Shelf.COLOR, Shelf.SIZE, Shelf.LABEL, Shelf.DETAIL, Shelf.TOOLTIP];

/** Every shelf a field may be dropped on. */
export const DROP_SHELVES = [...AXIS_SHELVES, ...CARD_SHELVES, Shelf.FILTERS];

/**
 * Where an existing pill may be MOVED. Filters is deliberately absent: that
 * shelf holds filter objects, not encodings, so splicing a pill into it would
 * quietly corrupt spec.filters. Filters are added from a field instead.
 */
export const PILL_SHELVES = [...AXIS_SHELVES, ...CARD_SHELVES];

/** The dataTransfer type carrying a drag payload. */
export const DRAG_MIME = "application/x-viz-pill";

/**
 * Does this shelf hold exactly one pill (so a drop replaces rather than appends)?
 * @param {string} shelf
 * @returns {boolean}
 */
export function isSingleShelf(shelf) {
  return SINGLE_SHELVES.includes(shelf);
}

/**
 * Is this a known drop target?
 * @param {string} shelf
 * @returns {boolean}
 */
export function isKnownShelf(shelf) {
  return SINGLE_SHELVES.includes(shelf) || MULTI_SHELVES.includes(shelf);
}

/**
 * A shelf's pills as an array, regardless of whether the shelf stores one pill
 * or many. Callers should never branch on shelf arity themselves.
 * @param {Object} spec
 * @param {string} shelf
 * @returns {Array<Object>}
 */
export function shelfPills(spec, shelf) {
  if (!spec || !isKnownShelf(shelf)) return [];
  if (isSingleShelf(shelf)) return spec[shelf] ? [spec[shelf]] : [];
  return spec[shelf] ?? [];
}

/**
 * Split a field list into Tableau's two bins. Dimensions slice (blue), measures
 * aggregate (green) — the metaphor the whole tool teaches.
 * @param {Array<Object>} fields
 * @returns {{dimensions:Array<Object>, measures:Array<Object>}}
 */
export function groupFields(fields) {
  const dimensions = [];
  const measures = [];
  for (const f of fields ?? []) {
    (f.role === FieldRole.MEASURE ? measures : dimensions).push(f);
  }
  return { dimensions, measures };
}

/**
 * The aggregations offered on a pill's menu. A discrete dimension can still be
 * counted, so "no aggregation" is always an option too.
 * @param {Object} encoding
 * @returns {Array<string|null>} null means "no aggregation" (row-level)
 */
export function aggregationChoices(encoding) {
  if (!encoding) return [];
  return [null, ...availableAggregations(encoding.type)];
}

/**
 * A stable identity for a pill, for React keys and drag payloads. Field name
 * alone is not unique — SUM(x) and AVG(x) can share a shelf.
 * @param {Object} encoding
 * @param {number} index
 * @returns {string}
 */
export function encodingKey(encoding, index) {
  return `${encoding?.field ?? "?"}:${encoding?.aggregation ?? "raw"}:${index}`;
}

/**
 * May `field` be dropped on `shelf`?
 *
 * Hard failures set allowed:false. A `warning` is advisory — the drop still
 * happens, because Tableau lets you build a questionable view and then shows you
 * why it is questionable.
 *
 * @param {Object} spec
 * @param {string} shelf
 * @param {Object} field a field descriptor
 * @returns {{allowed:boolean, reason:(string|null), warning:(string|null)}}
 */
export function canDrop(spec, shelf, field) {
  if (!field?.name) return { allowed: false, reason: "Nothing to drop.", warning: null };
  if (!isKnownShelf(shelf)) return { allowed: false, reason: `Unknown shelf: ${shelf}`, warning: null };

  // An exact duplicate (same field AND same aggregation) adds nothing to the
  // view. Note SUM(x) alongside AVG(x) IS allowed — that is a real move.
  const incoming = createEncoding(field);
  const dupe = shelfPills(spec, shelf).some(
    (p) => p.field === incoming.field && (p.aggregation ?? null) === (incoming.aggregation ?? null)
  );
  if (dupe) {
    return {
      allowed: false,
      reason: `${encodingLabel(incoming)} is already on ${SHELF_LABELS[shelf] ?? shelf}.`,
      warning: null,
    };
  }

  let warning = null;
  if (shelf === Shelf.SIZE && incoming.discrete) {
    warning = `Size works best with a continuous measure; ${field.name} is discrete.`;
  }
  return { allowed: true, reason: null, warning };
}

/**
 * Drop a field on a shelf, returning a NEW spec. Single-pill shelves replace;
 * multi-pill shelves append.
 * @param {Object} spec
 * @param {string} shelf
 * @param {Object} field a field descriptor
 * @param {Object} [options] passed to createEncoding ({ aggregation, discrete })
 * @returns {Object} a new VizSpec (unchanged when the drop is not allowed)
 */
export function dropField(spec, shelf, field, options = {}) {
  if (!canDrop(spec, shelf, field).allowed) return spec;
  return putOnShelf(spec, shelf, createEncoding(field, options));
}

/**
 * Remove the pill at `index` on `shelf`.
 * @param {Object} spec
 * @param {string} shelf
 * @param {number} index
 * @returns {Object} a new VizSpec
 */
export function removePill(spec, shelf, index) {
  if (!isKnownShelf(shelf)) return spec;
  if (isSingleShelf(shelf)) return { ...spec, [shelf]: null };
  const current = spec[shelf] ?? [];
  if (index < 0 || index >= current.length) return spec;
  return { ...spec, [shelf]: current.filter((_, i) => i !== index) };
}

/**
 * Move an item within a list. Pure array helper — the reorder maths lives here
 * so both the pointer and the keyboard path use exactly one implementation.
 * @param {Array<*>} list
 * @param {number} from
 * @param {number} to clamped into range
 * @returns {Array<*>} a new array
 */
export function reorderWithin(list, from, to) {
  const items = [...(list ?? [])];
  if (from < 0 || from >= items.length) return items;
  const target = Math.max(0, Math.min(items.length - 1, to));
  const [moved] = items.splice(from, 1);
  items.splice(target, 0, moved);
  return items;
}

/**
 * Move a pill between shelves, or reorder it within one.
 *
 * The subtle case is a same-shelf move: removing first shifts every later index
 * down by one, so a naive remove-then-insert drops the pill one slot short of
 * where the user aimed. reorderWithin() does it in a single splice pair and
 * sidesteps that entirely.
 *
 * @param {Object} spec
 * @param {{shelf:string, index:number}} from
 * @param {{shelf:string, index:number}} to `index` is ignored for single shelves
 * @returns {Object} a new VizSpec
 */
export function movePill(spec, from, to) {
  if (!isKnownShelf(from.shelf) || !isKnownShelf(to.shelf)) return spec;

  const pill = shelfPills(spec, from.shelf)[from.index];
  if (!pill) return spec;

  if (from.shelf === to.shelf) {
    if (isSingleShelf(from.shelf)) return spec; // one pill: nothing to reorder
    return { ...spec, [from.shelf]: reorderWithin(spec[from.shelf] ?? [], from.index, to.index) };
  }

  const without = removePill(spec, from.shelf, from.index);
  if (isSingleShelf(to.shelf)) return { ...without, [to.shelf]: pill };

  const target = [...(without[to.shelf] ?? [])];
  const at = to.index === undefined || to.index < 0 ? target.length : Math.min(to.index, target.length);
  target.splice(at, 0, pill);
  return { ...without, [to.shelf]: target };
}

/**
 * Change a pill's aggregation. Re-derives discrete/continuous, so the pill's
 * colour follows its meaning: aggregating makes it continuous (green).
 * @param {Object} spec
 * @param {string} shelf
 * @param {string} fieldName
 * @param {string|null} aggregation
 * @returns {Object} a new VizSpec
 */
export function changeAggregation(spec, shelf, fieldName, aggregation) {
  return setAggregation(spec, shelf, fieldName, aggregation);
}

/**
 * Force a pill discrete (blue) or continuous (green).
 * @param {Object} spec
 * @param {string} shelf
 * @param {string} fieldName
 * @param {boolean} discrete
 * @returns {Object} a new VizSpec
 */
export function changeDiscrete(spec, shelf, fieldName, discrete) {
  return setDiscrete(spec, shelf, fieldName, discrete);
}

/**
 * The filter a field gets when it first lands on the Filters shelf.
 *
 * Quantities get a range, categories get an include-list of every member —
 * starting from "everything is shown", so the first thing the learner does is
 * take data away, which is what a filter IS.
 *
 * @param {Object} field a field descriptor
 * @param {Array<Object>} rows the source rows
 * @returns {Object} a filter from lib/viz/aggregate.js's builders
 */
export function defaultFilterFor(field, rows) {
  const isQuantity = field.role === FieldRole.MEASURE || field.type === "date";
  if (isQuantity) {
    // The source rows are raw CSV text — the pipeline coerces them per field on
    // its way through buildRenderPlan, so anything reading values BEFORE that
    // must coerce too. extent() over "71500" (a string) is [null, null], which
    // would silently hand back a filter with no bounds at all.
    const [min, max] = extent((rows ?? []).map((r) => coerceValue(r[field.name], field.type)));
    return rangeFilter(field.name, min, max);
  }
  return categoricalFilter(field.name, distinctValues(rows ?? [], field.name));
}

/**
 * Replace the filter at `index`.
 * @param {Object} spec
 * @param {number} index
 * @param {Object} filter
 * @returns {Object} a new VizSpec
 */
export function setFilterAt(spec, index, filter) {
  const filters = spec.filters ?? [];
  if (index < 0 || index >= filters.length) return spec;
  return { ...spec, filters: filters.map((f, i) => (i === index ? filter : f)) };
}

/**
 * Remove the filter at `index`.
 * @param {Object} spec
 * @param {number} index
 * @returns {Object} a new VizSpec
 */
export function removeFilterAt(spec, index) {
  const filters = spec.filters ?? [];
  if (index < 0 || index >= filters.length) return spec;
  return { ...spec, filters: filters.filter((_, i) => i !== index) };
}

/**
 * Encode a drag payload. Dragging a field from the data pane has no origin
 * shelf; dragging a pill between shelves does.
 * @param {Object} payload { kind:"field"|"pill", field, shelf, index }
 * @returns {string} JSON
 */
export function serializeDrag(payload) {
  return JSON.stringify(payload);
}

/**
 * Decode a drag payload. Returns null rather than throwing: a drop can carry any
 * junk a browser or another app put on the clipboard, and that must not explode
 * the view.
 * @param {string} text
 * @returns {Object|null}
 */
export function parseDrag(text) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.kind !== "field" && parsed.kind !== "pill") return null;
    return parsed;
  } catch {
    return null;
  }
}

export { Shelf, encodingLabel };
