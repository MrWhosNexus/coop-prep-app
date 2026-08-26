// VizSpec + data → a render plan: positioned marks, axes and a legend, as plain
// numbers.
//
// THE SEAM: this module emits geometry ONLY. No SVG strings, no DOM, no React,
// no colours-as-CSS beyond flat hex strings. A UI layer maps `plan.marks` to
// <rect>/<circle>/<path> however it likes, and can be swapped without touching
// the model the lessons grade.

import { applyCalculatedFields, coerceRows, inferFields } from "./fields.js";
import { aggregateRows, distinctValues } from "./aggregate.js";
import { MarkType, isPathMark } from "./marks.js";
import { bandScale, extent, formatTick, scaleForEncoding } from "./scales.js";
import {
  encodingColumn,
  encodingLabel,
  isContinuous,
  resolveMark,
  specDimensions,
  specMeasures,
} from "./spec.js";

/** Default plot box. Callers override per viewport. */
export const DEFAULT_LAYOUT = {
  width: 640,
  height: 400,
  margin: { top: 24, right: 24, bottom: 48, left: 64 },
};

// A categorical palette with adequate contrast on both light and dark
// backgrounds. Named as data, not CSS — the UI may remap these.
export const CATEGORICAL_PALETTE = [
  "#4e79a7", "#f28e2c", "#e15759", "#76b7b2", "#59a14f",
  "#edc949", "#af7aa1", "#ff9da7", "#9c755f", "#bab0ab",
];

/** Sequential ramp endpoints for a continuous colour encoding. */
export const SEQUENTIAL_RANGE = ["#deebf7", "#08519c"];

/**
 * Diverging ramp endpoints + midpoint for a continuous colour encoding whose
 * values straddle zero (a signed measure — profit/loss, a rate above or below
 * par). Tableau reaches for red/blue diverging in exactly this case.
 */
export const DIVERGING_RANGE = ["#b2182b", "#f7f7f7", "#2166ac"];

/** The fill used when nothing is on Color. */
export const DEFAULT_MARK_COLOR = "#4e79a7";

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Linear interpolation between two hex colours.
 * @param {string} from hex
 * @param {string} to hex
 * @param {number} t 0..1
 * @returns {string} hex
 */
export function interpolateColor(from, to, t) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const clamped = Math.max(0, Math.min(1, t));
  return rgbToHex(a.map((v, i) => v + (b[i] - v) * clamped));
}

/**
 * Build the colour assignment for a spec's Color shelf.
 * Discrete → palette lookup; continuous → sequential ramp.
 * @param {Object} colorEncoding
 * @param {Array<Object>} rows aggregated rows
 * @returns {{mode:string, colorOf:Function, legend:(Object|null)}}
 */
function buildColor(colorEncoding, rows) {
  if (!colorEncoding) {
    return { mode: "none", colorOf: () => DEFAULT_MARK_COLOR, legend: null };
  }

  const column = encodingColumn(colorEncoding);

  if (colorEncoding.discrete) {
    const members = distinctValues(rows, column);
    const lookup = new Map(
      members.map((m, i) => [String(m), CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]])
    );
    return {
      mode: "categorical",
      colorOf: (row) => lookup.get(String(row[column])) ?? DEFAULT_MARK_COLOR,
      legend: {
        type: "categorical",
        title: encodingLabel(colorEncoding),
        field: colorEncoding.field,
        entries: members.map((m) => ({ value: m, label: String(m), color: lookup.get(String(m)) })),
      },
    };
  }

  const [min, max] = extent(rows.map((r) => r[column]));

  // A measure that straddles zero (loss/profit, above/below par) reads better
  // diverging around a neutral midpoint than smeared across one sequential
  // ramp — Tableau's own default color rule for a signed measure on Color.
  const diverging = min !== null && max !== null && min < 0 && max > 0;

  if (diverging) {
    const bound = Math.max(Math.abs(min), Math.abs(max)) || 1;
    const colorOf = (row) => {
      const v = row[column];
      if (typeof v !== "number") return DEFAULT_MARK_COLOR;
      const t = (v + bound) / (2 * bound); // 0 at -bound, 0.5 at 0, 1 at +bound
      return t < 0.5
        ? interpolateColor(DIVERGING_RANGE[0], DIVERGING_RANGE[1], t / 0.5)
        : interpolateColor(DIVERGING_RANGE[1], DIVERGING_RANGE[2], (t - 0.5) / 0.5);
    };
    return {
      mode: "diverging",
      colorOf,
      legend: {
        type: "diverging",
        title: encodingLabel(colorEncoding),
        field: colorEncoding.field,
        domain: [-bound, bound],
        midpoint: 0,
        range: [...DIVERGING_RANGE],
        stops: [0, 0.25, 0.5, 0.75, 1].map((t) => ({
          t,
          color:
            t < 0.5
              ? interpolateColor(DIVERGING_RANGE[0], DIVERGING_RANGE[1], t / 0.5)
              : interpolateColor(DIVERGING_RANGE[1], DIVERGING_RANGE[2], (t - 0.5) / 0.5),
          value: -bound + 2 * bound * t,
        })),
      },
    };
  }

  const span = (max ?? 1) - (min ?? 0) || 1;
  const colorOf = (row) => {
    const v = row[column];
    if (typeof v !== "number") return DEFAULT_MARK_COLOR;
    return interpolateColor(SEQUENTIAL_RANGE[0], SEQUENTIAL_RANGE[1], (v - min) / span);
  };
  return {
    mode: "sequential",
    colorOf,
    legend: {
      type: "sequential",
      title: encodingLabel(colorEncoding),
      field: colorEncoding.field,
      domain: [min, max],
      range: [...SEQUENTIAL_RANGE],
      stops: [0, 0.25, 0.5, 0.75, 1].map((t) => ({
        t,
        color: interpolateColor(SEQUENTIAL_RANGE[0], SEQUENTIAL_RANGE[1], t),
        value: (min ?? 0) + span * t,
      })),
    },
  };
}

const SIZE_RANGE = [4, 24];

function buildSize(sizeEncoding, rows) {
  if (!sizeEncoding) return { sizeOf: () => null, legend: null };
  const column = encodingColumn(sizeEncoding);
  const [min, max] = extent(rows.map((r) => r[column]));
  const span = (max ?? 1) - (min ?? 0) || 1;
  return {
    sizeOf: (row) => {
      const v = row[column];
      if (typeof v !== "number") return SIZE_RANGE[0];
      return SIZE_RANGE[0] + ((v - min) / span) * (SIZE_RANGE[1] - SIZE_RANGE[0]);
    },
    legend: {
      type: "size",
      title: encodingLabel(sizeEncoding),
      field: sizeEncoding.field,
      domain: [min, max],
      range: [...SIZE_RANGE],
    },
  };
}

/**
 * The values an axis scale must cover for a set of encodings on one shelf.
 * Continuous pills contribute numbers; discrete pills contribute members.
 */
function axisData(encodings, rows) {
  if (!encodings.length) return { values: [], domain: [""] };
  const primary = encodings[encodings.length - 1];
  const column = encodingColumn(primary);
  if (primary.discrete) {
    return { values: rows.map((r) => r[column]), domain: distinctValues(rows, column) };
  }
  return { values: rows.map((r) => r[column]) };
}

/**
 * The [min, max] a stacked-bar value axis must cover: the running total of
 * positive segments and of negative segments, per axis category, at their
 * largest. A plain per-row extent (what `axisData` gives a non-stacked mark)
 * only covers ONE segment — a stacked total routinely runs past it, clipping
 * the tallest bars off the top of the plot.
 * @param {Array<Object>} data aggregated rows
 * @param {string} axisColumn the category column (the axis dimension)
 * @param {string} valueColumn the measure column being stacked
 * @returns {[number, number]}
 */
function stackExtent(data, axisColumn, valueColumn) {
  const totals = new Map();
  for (const row of data) {
    const key = String(row[axisColumn]);
    const raw = row[valueColumn];
    const n = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
    const t = totals.get(key) ?? { pos: 0, neg: 0 };
    if (n >= 0) t.pos += n;
    else t.neg += n;
    totals.set(key, t);
  }
  let max = 0;
  let min = 0;
  for (const t of totals.values()) {
    if (t.pos > max) max = t.pos;
    if (t.neg < min) min = t.neg;
  }
  return [min, max];
}

/**
 * Reference lines — a fixed line drawn across the plot at a computed value,
 * e.g. Tableau's "Average line". Read from `options.referenceLine`:
 *   - `true` → an average line on every continuous axis present.
 *   - `{ type: "average", axis: "x"|"y" }` → pin it to one axis.
 * Never invents geometry for an axis with no continuous pill or no numeric data.
 * @param {Object} spec
 * @param {Array<Object>} data aggregated rows
 * @param {Object} ctx { xScale, yScale, xEnc, yEnc, plot }
 * @param {Object} options buildRenderPlan's own options
 * @returns {Array<Object>}
 */
function buildReferenceLines(spec, data, ctx, options) {
  const config = options.referenceLine;
  if (!config) return [];
  const { xScale, yScale, xEnc, yEnc, plot } = ctx;
  const type = config === true ? "average" : config.type || "average";
  const wantAxis = config === true ? null : config.axis ?? null;
  const lines = [];

  const addFor = (enc, scale, orientation) => {
    if (!enc || enc.discrete) return;
    if (wantAxis && wantAxis !== orientation) return;
    const column = encodingColumn(enc);
    const values = data
      .map((r) => r[column])
      .filter((v) => typeof v === "number" && Number.isFinite(v));
    if (!values.length) return;
    const value = type === "average" ? values.reduce((a, b) => a + b, 0) / values.length : null;
    if (value === null || !Number.isFinite(value)) return;
    const position = scale.scale(value);
    if (position === null || !Number.isFinite(position)) return;
    lines.push({
      type: "reference",
      kind: type,
      field: enc.field,
      axis: orientation, // "x" | "y"
      value,
      position,
      line:
        orientation === "y"
          ? { x1: plot.x0, y1: position, x2: plot.x1, y2: position }
          : { x1: position, y1: plot.y0, x2: position, y2: plot.y1 },
    });
  };

  addFor(yEnc, yScale, "y");
  addFor(xEnc, xScale, "x");
  return lines;
}

function buildAxis(encodings, scale, orientation, plot) {
  if (!encodings.length) return null;
  const primary = encodings[encodings.length - 1];
  const isNumeric = !primary.discrete;
  const isPercent = /rate|pct|percent|share/i.test(primary.field);

  const ticks = scale.ticks.map((t) => {
    const position = scale.type === "band" ? scale.center(t) : scale.scale(t);
    return {
      value: t instanceof Date ? t.toISOString() : t,
      label: isNumeric
        ? formatTick(t, { type: isPercent ? "percent" : "number" })
        : String(t),
      position,
    };
  });

  return {
    orientation, // "bottom" (x) | "left" (y)
    field: primary.field,
    title: encodings.map(encodingLabel).join(" / "),
    scaleType: scale.type,
    discrete: primary.discrete,
    domain: scale.domain,
    range: scale.range,
    ticks,
    // The line the axis is drawn along, so the UI does not recompute the box.
    line:
      orientation === "bottom"
        ? { x1: plot.x0, y1: plot.y0, x2: plot.x1, y2: plot.y0 }
        : { x1: plot.x0, y1: plot.y1, x2: plot.x0, y2: plot.y0 },
  };
}

/**
 * Read the value an encoding contributes for one row. An empty shelf resolves to
 * the band scale's single "" member, so "just SUM(x) on Columns" still draws one
 * full-width bar instead of silently rendering nothing.
 */
function valueFor(encoding, row) {
  return encoding ? row[encodingColumn(encoding)] : "";
}

/**
 * The centre of a mark along one axis. Always positioning from the CENTRE keeps
 * the geometry correct on the y axis, whose range runs backwards (pixel 0 is the
 * top of the screen), where a band's "start" edge is its visual bottom.
 */
function centerPos(scale, encoding, row) {
  const v = valueFor(encoding, row);
  return scale.type === "band" ? scale.center(v) : scale.scale(v);
}

/**
 * The pixel a bar or area measures from. Continuous scales publish their own
 * `zeroPosition`; anything else (a band scale, or a future scale that forgets)
 * falls back to the start of the axis. Never returns undefined: `undefined` in
 * this slot yields NaN geometry, which renders as nothing while the plan still
 * claims empty:false.
 */
function baselineFor(scale) {
  return Number.isFinite(scale.zeroPosition) ? scale.zeroPosition : scale.range[0];
}

/**
 * Rectangles for bar marks. Bars grow from the zero line — never from the bottom
 * of the plot — so negative values render below the axis correctly.
 *
 * When a discrete dimension sits on Color, each axis category holds one row per
 * colour member instead of one — the simple version above would draw those rows
 * on top of each other. `ctx.barMode` picks how they share the slot: "stacked"
 * (Tableau's default: segments end-to-end from zero) or "grouped" (dodged,
 * side-by-side sub-bars).
 */
function barMarks(rows, ctx) {
  const { xScale, yScale, xEnc, yEnc, color, colorEncoding, barMode } = ctx;
  // Vertical (column) bars need the continuous pill on Rows. With nothing on
  // Rows there is no length to encode vertically, so fall back to horizontal.
  const vertical = isContinuous(yEnc);
  const colorCol = colorEncoding?.discrete ? encodingColumn(colorEncoding) : null;

  if (!colorCol) return simpleBarMarks(rows, { xScale, yScale, xEnc, yEnc, color, vertical });
  return multiSeriesBarMarks(rows, { xScale, yScale, xEnc, yEnc, color, vertical, colorCol, barMode });
}

function simpleBarMarks(rows, { xScale, yScale, xEnc, yEnc, color, vertical }) {
  const out = [];
  for (const row of rows) {
    const fill = color.colorOf(row);

    if (vertical) {
      // Discrete x (band), continuous y: classic column chart.
      const cx = centerPos(xScale, xEnc, row);
      const width = xScale.type === "band" ? xScale.bandwidth : 8;
      const value = valueFor(yEnc, row);
      const y = yScale.scale(value);
      const zero = baselineFor(yScale);
      if (cx === null || y === null) continue;
      out.push({
        type: "rect",
        key: row.__key,
        x: cx - width / 2,
        y: Math.min(y, zero),
        width,
        height: Math.abs(zero - y),
        fill,
        value,
        datum: row,
      });
    } else {
      // Continuous x, discrete y: horizontal bar chart.
      const cy = centerPos(yScale, yEnc, row);
      const height = yScale.type === "band" ? yScale.bandwidth : 8;
      const value = valueFor(xEnc, row);
      const x = xScale.scale(value);
      const zero = baselineFor(xScale);
      if (cy === null || x === null) continue;
      out.push({
        type: "rect",
        key: row.__key,
        x: Math.min(x, zero),
        y: cy - height / 2,
        width: Math.abs(x - zero),
        height,
        fill,
        value,
        datum: row,
      });
    }
  }
  return out;
}

/**
 * Bars for a bar-with-color-dimension view: one axis category holds one row per
 * colour member. Groups those rows by axis category, then lays each group out
 * either stacked (cumulative, from the zero baseline) or grouped (dodged into
 * equal sub-slots of the category's band).
 */
function multiSeriesBarMarks(rows, { xScale, yScale, xEnc, yEnc, color, vertical, colorCol, barMode }) {
  const axisEnc = vertical ? xEnc : yEnc;
  const axisScale = vertical ? xScale : yScale;
  const valueEnc = vertical ? yEnc : xEnc;
  const valueScale = vertical ? yScale : xScale;
  const mode = barMode === "grouped" ? "grouped" : "stacked";

  // First-seen colour member order — stable across categories, so a stacked
  // bar's segments land in the same order (and thus the same colour band)
  // whichever category you look at.
  const members = [];
  const seenMembers = new Set();
  for (const row of rows) {
    const k = String(row[colorCol]);
    if (!seenMembers.has(k)) {
      seenMembers.add(k);
      members.push(k);
    }
  }

  const groups = new Map();
  const groupOrder = [];
  for (const row of rows) {
    const key = String(valueFor(axisEnc, row));
    if (!groups.has(key)) {
      groups.set(key, []);
      groupOrder.push(key);
    }
    groups.get(key).push(row);
  }

  const out = [];
  for (const key of groupOrder) {
    const groupRows = groups.get(key);
    const ordered = members
      .map((m) => groupRows.find((r) => String(r[colorCol]) === m))
      .filter(Boolean);
    if (ordered.length === 0) continue;

    const cAxis = centerPos(axisScale, axisEnc, ordered[0]);
    if (cAxis === null) continue;
    const bandWidth = axisScale.type === "band" ? axisScale.bandwidth : 8;

    if (mode === "grouped") {
      const subWidth = bandWidth / ordered.length;
      ordered.forEach((row, i) => {
        const value = valueFor(valueEnc, row);
        const v = valueScale.scale(value);
        const zero = baselineFor(valueScale);
        if (v === null || !Number.isFinite(v) || !Number.isFinite(zero)) return;
        const start = cAxis - bandWidth / 2 + i * subWidth;
        const fill = color.colorOf(row);
        if (vertical) {
          out.push({
            type: "rect", key: row.__key, x: start, y: Math.min(v, zero),
            width: subWidth, height: Math.abs(zero - v), fill, value, datum: row,
          });
        } else {
          out.push({
            type: "rect", key: row.__key, x: Math.min(v, zero), y: start,
            width: Math.abs(v - zero), height: subWidth, fill, value, datum: row,
          });
        }
      });
    } else {
      // Stacked: each member's segment runs from the running total to the
      // running total plus its own value, so segments sit end-to-end.
      let cumulative = 0;
      for (const row of ordered) {
        const raw = valueFor(valueEnc, row);
        const n = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
        const startVal = cumulative;
        const endVal = cumulative + n;
        cumulative = endVal;
        const startPx = valueScale.scale(startVal);
        const endPx = valueScale.scale(endVal);
        if (startPx === null || endPx === null || !Number.isFinite(startPx) || !Number.isFinite(endPx)) continue;
        const fill = color.colorOf(row);
        if (vertical) {
          out.push({
            type: "rect", key: row.__key, x: cAxis - bandWidth / 2, y: Math.min(startPx, endPx),
            width: bandWidth, height: Math.abs(endPx - startPx), fill, value: raw, datum: row,
            stackStart: startVal, stackEnd: endVal,
          });
        } else {
          out.push({
            type: "rect", key: row.__key, x: Math.min(startPx, endPx), y: cAxis - bandWidth / 2,
            width: Math.abs(endPx - startPx), height: bandWidth, fill, value: raw, datum: row,
            stackStart: startVal, stackEnd: endVal,
          });
        }
      }
    }
  }
  return out;
}

function pointMarks(rows, ctx, shape) {
  const { xScale, yScale, xEnc, yEnc, color, size } = ctx;
  const out = [];
  for (const row of rows) {
    const x = centerPos(xScale, xEnc, row);
    const y = centerPos(yScale, yEnc, row);
    if (x === null || y === null) continue;
    out.push({
      type: shape,
      key: row.__key,
      x,
      y,
      radius: size.sizeOf(row) ?? 5,
      fill: color.colorOf(row),
      value: valueFor(yEnc, row),
      datum: row,
    });
  }
  return out;
}

function pathMarks(rows, ctx, mark) {
  const { xScale, yScale, xEnc, yEnc, color } = ctx;

  // Color on a path mark splits it into one series per member — otherwise every
  // point chains into a single zig-zag, which is the classic beginner bug.
  const series = new Map();
  const colorCol = ctx.colorEncoding ? encodingColumn(ctx.colorEncoding) : null;
  for (const row of rows) {
    const key = colorCol ? String(row[colorCol]) : "__single__";
    if (!series.has(key)) series.set(key, []);
    series.get(key).push(row);
  }

  const out = [];
  for (const [key, seriesRows] of series) {
    const points = seriesRows
      .map((row) => ({
        x: centerPos(xScale, xEnc, row),
        y: centerPos(yScale, yEnc, row),
        value: valueFor(yEnc, row),
        datum: row,
      }))
      .filter((p) => p.x !== null && p.y !== null);
    if (points.length === 0) continue;

    out.push({
      type: mark === MarkType.AREA ? "area" : "line",
      key,
      series: colorCol ? key : null,
      points,
      stroke: color.colorOf(seriesRows[0]),
      fill: mark === MarkType.AREA ? color.colorOf(seriesRows[0]) : "none",
      // Areas need the baseline to close their shape against.
      baseline: mark === MarkType.AREA ? baselineFor(yScale) : null,
    });
  }
  return out;
}

function textMarks(rows, ctx) {
  const { xScale, yScale, xEnc, yEnc, color } = ctx;
  const out = [];
  for (const row of rows) {
    const x = centerPos(xScale, xEnc, row);
    const y = centerPos(yScale, yEnc, row);
    if (x === null || y === null) continue;
    // A text table shows the Label pill when there is one, else the measure that
    // is on an axis, else the row's own dimension value.
    const labelEnc = ctx.labelEncoding ?? (isContinuous(yEnc) ? yEnc : isContinuous(xEnc) ? xEnc : yEnc);
    const value = valueFor(labelEnc, row);
    out.push({
      type: "text",
      key: row.__key,
      x,
      y,
      text: formatValue(value),
      fill: color.colorOf(row),
      value,
      datum: row,
    });
  }
  return out;
}

function formatValue(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return formatTick(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

/**
 * Build the full render plan.
 *
 * Runs the whole pipeline: calculated fields → coerce → filter/aggregate →
 * scales → geometry.
 *
 * @param {Object} spec a VizSpec
 * @param {Array<Object>} rawRows the data source rows
 * @param {Object} [options] { width, height, margin, fields }
 * Every key below is present on EVERY plan, including an empty one — empty:true
 * is still renderable, so the shape must not depend on the code path taken.
 *
 * @returns {Object} plan:
 *   {
 *     mark, width, height, margin:{top,right,bottom,left},
 *     plot:{x0,y0,x1,y1,width,height},
 *     marks:Array<Object>, axes:Array<Object>,
 *     legend:Object|null, legends:Array<Object>,
 *     labels:Array<Object>, data:Array<Object>, empty:boolean
 *   }
 */
export function buildRenderPlan(spec, rawRows, options = {}) {
  const width = options.width ?? DEFAULT_LAYOUT.width;
  const height = options.height ?? DEFAULT_LAYOUT.height;
  const margin = { ...DEFAULT_LAYOUT.margin, ...(options.margin ?? {}) };

  const plot = {
    x0: margin.left,
    y0: height - margin.bottom,
    x1: width - margin.right,
    y1: margin.top,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  // 1. Materialise calculated fields, then coerce cells to their inferred types.
  const withCalcs = applyCalculatedFields(rawRows, spec.calculatedFields ?? []);
  const fields = options.fields ?? inferFields(withCalcs);
  const typed = coerceRows(withCalcs, fields);

  // 2. Filter + group + aggregate.
  const data = aggregateRows(typed, {
    dimensions: specDimensions(spec),
    measures: specMeasures(spec),
    filters: spec.filters ?? [],
    sort: spec.sort ?? undefined,
  });

  const mark = resolveMark(spec);
  const xEnc = (spec.columns ?? [])[spec.columns?.length - 1] ?? null;
  const yEnc = (spec.rows ?? [])[spec.rows?.length - 1] ?? null;

  const base = {
    mark,
    width,
    height,
    margin,
    plot,
    marks: [],
    axes: [],
    legend: null,
    legends: [],
    labels: [],
    data,
    empty: data.length === 0 || (!xEnc && !yEnc),
  };
  if (base.empty) return base;

  // A discrete dimension on Color, with a bar mark, means each axis category
  // holds one row per colour member. Default to Tableau's own default —
  // stacked — but let a caller ask for grouped (dodged) bars instead.
  const barMode = options.barMode === "grouped" ? "grouped" : "stacked";
  const colorCol = spec.color?.discrete ? encodingColumn(spec.color) : null;
  const stacking = mark === MarkType.BAR && colorCol && barMode === "stacked";
  const vertical = isContinuous(yEnc);

  let xAxisData = axisData(spec.columns, data);
  let yAxisData = axisData(spec.rows, data);
  if (stacking && vertical && xEnc && yEnc) {
    const [min, max] = stackExtent(data, encodingColumn(xEnc), encodingColumn(yEnc));
    yAxisData = { ...yAxisData, values: [min, max] };
  } else if (stacking && !vertical && xEnc && yEnc) {
    const [min, max] = stackExtent(data, encodingColumn(yEnc), encodingColumn(xEnc));
    xAxisData = { ...xAxisData, values: [min, max] };
  }

  // 3. Scales. This is where discrete-vs-continuous becomes band-vs-linear.
  const xScale = xEnc
    ? scaleForEncoding(xEnc, xAxisData, [plot.x0, plot.x1], {
        zero: mark === MarkType.BAR,
      })
    : bandScale({ domain: [""], range: [plot.x0, plot.x1] });
  // y is inverted: pixel 0 is the TOP of the screen, but data grows upward.
  const yScale = yEnc
    ? scaleForEncoding(yEnc, yAxisData, [plot.y0, plot.y1], {
        zero: mark === MarkType.BAR,
      })
    : bandScale({ domain: [""], range: [plot.y0, plot.y1] });

  const color = buildColor(spec.color, data);
  const size = buildSize(spec.size, data);

  const ctx = {
    xScale,
    yScale,
    xEnc,
    yEnc,
    color,
    size,
    plot,
    colorEncoding: spec.color,
    labelEncoding: spec.label,
    barMode,
  };

  let marks;
  switch (mark) {
    case MarkType.BAR:
      marks = barMarks(data, ctx);
      break;
    case MarkType.LINE:
    case MarkType.AREA:
      marks = pathMarks(data, ctx, mark);
      break;
    case MarkType.SCATTER:
      marks = pointMarks(data, ctx, "circle");
      break;
    case MarkType.MAP:
      marks = pointMarks(data, ctx, "circle");
      break;
    case MarkType.TEXT:
    default:
      marks = textMarks(data, ctx);
      break;
  }

  // 4. Labels from the Label shelf — positioned, but only for non-path marks
  // (a line's labels would need per-point placement the UI is better at).
  const labels =
    spec.label && !isPathMark(mark)
      ? marks
          .filter((m) => m.datum)
          .map((m) => ({
            x: m.type === "rect" ? m.x + m.width / 2 : m.x,
            y: m.type === "rect" ? m.y - 4 : m.y - 8,
            text: formatValue(m.datum[encodingColumn(spec.label)]),
            key: m.key,
          }))
      : [];

  const axes = [
    buildAxis(spec.columns ?? [], xScale, "bottom", plot),
    buildAxis(spec.rows ?? [], yScale, "left", plot),
  ].filter(Boolean);

  // referenceLines is opt-in (options.referenceLine) and additive: the key is
  // present only when the caller asked for it and the data could produce one,
  // so the documented plan shape for every other caller — and every existing
  // exact-shape assertion — is untouched.
  const referenceLines = buildReferenceLines(spec, data, ctx, options);

  return {
    ...base,
    marks,
    axes,
    legend: color.legend ?? size.legend,
    legends: [color.legend, size.legend].filter(Boolean),
    labels,
    ...(referenceLines.length ? { referenceLines } : {}),
  };
}

export { formatValue };
