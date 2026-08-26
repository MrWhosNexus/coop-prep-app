// RenderPlan geometry → SVG-ready primitives.
//
// The engine (lib/viz/render-plan.js) owns the scales and hands us pure numbers.
// This module does the LAST mile only: path strings, and the guard rail below.
// It never recomputes a scale — if a number is missing here, the fix belongs in
// the engine, not in a second implementation of the maths.
//
// No JSX, so `node --test` can import it. Relative imports for the same reason.

import { formatValue } from "../../lib/viz/render-plan.js";
import { encodingColumn, encodingLabel, allEncodings } from "../../lib/viz/spec.js";

/**
 * Is this a real, finite number?
 *
 * THE guard of this module. NaN or undefined in an SVG attribute renders
 * *nothing* — silently, with no console error and no visual clue — so every
 * number is checked before it reaches an attribute rather than after someone
 * spends an afternoon wondering why the chart is blank.
 *
 * @param {*} v
 * @returns {boolean}
 */
export function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * All of these finite?
 * @param {...*} values
 * @returns {boolean}
 */
export function allFinite(...values) {
  return values.every(isFiniteNumber);
}

/**
 * Round for SVG output. Sub-pixel precision is noise in the DOM and makes
 * snapshots churn.
 * @param {number} n
 * @param {number} [places]
 * @returns {number}
 */
export function round(n, places = 2) {
  const p = Math.pow(10, places);
  return Math.round(n * p) / p;
}

/**
 * Validate a rect mark's geometry.
 * @param {Object} mark
 * @returns {{x:number,y:number,width:number,height:number}|null} null when unusable
 */
export function rectGeom(mark) {
  if (!mark || !allFinite(mark.x, mark.y, mark.width, mark.height)) return null;
  // A negative width/height is invalid SVG and drops the rect. Normalise instead:
  // the plan already anchors bars at the zero line, so this is belt and braces.
  const x = mark.width < 0 ? mark.x + mark.width : mark.x;
  const y = mark.height < 0 ? mark.y + mark.height : mark.y;
  return {
    x: round(x),
    y: round(y),
    width: round(Math.abs(mark.width)),
    height: round(Math.abs(mark.height)),
  };
}

/**
 * Validate a point mark's geometry.
 * @param {Object} mark
 * @returns {{x:number,y:number,radius:number}|null}
 */
export function pointGeom(mark) {
  if (!mark || !allFinite(mark.x, mark.y)) return null;
  const radius = isFiniteNumber(mark.radius) ? Math.max(0, mark.radius) : 4;
  return { x: round(mark.x), y: round(mark.y), radius: round(radius) };
}

/**
 * The finite points of a path mark, in order.
 * @param {Array<Object>} points
 * @returns {Array<Object>}
 */
export function finitePoints(points) {
  return (points ?? []).filter((p) => allFinite(p?.x, p?.y));
}

/**
 * An open polyline through the points — the `d` for a line mark.
 * @param {Array<{x:number,y:number}>} points
 * @returns {string} "" when nothing is drawable (an empty `d` is inert and safe)
 */
export function linePath(points) {
  const pts = finitePoints(points);
  if (pts.length === 0) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${round(p.x)},${round(p.y)}`).join(" ");
}

/**
 * A closed area between the points and a baseline — the `d` for an area mark.
 * @param {Array<{x:number,y:number}>} points
 * @param {number} baseline pixel y of the zero line
 * @returns {string} "" when nothing is drawable
 */
export function areaPath(points, baseline) {
  const pts = finitePoints(points);
  if (pts.length === 0 || !isFiniteNumber(baseline)) return "";
  const top = pts.map((p, i) => `${i === 0 ? "M" : "L"}${round(p.x)},${round(p.y)}`).join(" ");
  const first = pts[0];
  const last = pts[pts.length - 1];
  return `${top} L${round(last.x)},${round(baseline)} L${round(first.x)},${round(baseline)} Z`;
}

/**
 * Drop marks whose geometry would render nothing. Returns only marks the SVG
 * layer can safely emit.
 * @param {Array<Object>} marks
 * @returns {Array<Object>}
 */
export function drawableMarks(marks) {
  return (marks ?? []).filter((m) => {
    if (!m) return false;
    if (m.type === "rect") return rectGeom(m) !== null;
    if (m.type === "circle" || m.type === "square" || m.type === "text") return pointGeom(m) !== null;
    if (m.type === "line") return finitePoints(m.points).length > 0;
    if (m.type === "area") return finitePoints(m.points).length > 0 && isFiniteNumber(m.baseline);
    return false;
  });
}

/**
 * Gridlines for an axis, spanning the plot box at each tick.
 *
 * Positions come straight from the plan's ticks — we only extend each one across
 * the opposite dimension. No scale is re-derived here.
 *
 * @param {Object} axis a plan axis
 * @param {Object} plot the plan's plot box
 * @returns {Array<{key:string, x1:number, y1:number, x2:number, y2:number}>}
 */
export function gridlines(axis, plot) {
  if (!axis || !plot) return [];
  // A band axis's gridlines would sit through the middle of each bar, which is
  // noise rather than information. Tableau draws them for continuous axes only.
  if (axis.discrete) return [];

  return (axis.ticks ?? [])
    .filter((t) => isFiniteNumber(t.position))
    .map((t, i) =>
      axis.orientation === "bottom"
        ? { key: `g${i}`, x1: round(t.position), y1: round(plot.y1), x2: round(t.position), y2: round(plot.y0) }
        : { key: `g${i}`, x1: round(plot.x0), y1: round(t.position), x2: round(plot.x1), y2: round(t.position) }
    );
}

/**
 * Where an axis's tick mark and its label sit.
 * @param {Object} axis a plan axis
 * @param {Object} tick a plan tick
 * @returns {Object|null} { x, y, textX, textY, anchor } — null when unpositioned
 */
export function tickGeom(axis, tick) {
  if (!axis || !isFiniteNumber(tick?.position)) return null;
  const line = axis.line;
  if (axis.orientation === "bottom") {
    const y = round(line.y1);
    return { x: round(tick.position), y, textX: round(tick.position), textY: y + 18, anchor: "middle" };
  }
  const x = round(line.x1);
  return { x, y: round(tick.position), textX: x - 8, textY: round(tick.position) + 4, anchor: "end" };
}

/**
 * The rows of a mark's tooltip: every pill on the view, with this mark's value
 * for it. Reads the aggregated datum the plan attached to the mark.
 *
 * Dimensions are listed before measures, so a tooltip always reads "which slice,
 * then how much" ("race: Black" above "AVG(approval_rate): 56.25%"). Shelf order
 * would otherwise leak into the reading order and flip that around.
 *
 * @param {Object} spec
 * @param {Object} datum an aggregated row from plan.data
 * @returns {Array<{label:string, value:string}>}
 */
export function tooltipRows(spec, datum) {
  if (!datum) return [];
  const dimensions = [];
  const measures = [];
  const seen = new Set();
  for (const { encoding } of allEncodings(spec)) {
    const column = encodingColumn(encoding);
    if (seen.has(column)) continue;
    seen.add(column);
    if (!Object.hasOwn(datum, column)) continue;
    const row = { label: encodingLabel(encoding), value: formatValue(datum[column]) };
    (encoding.discrete ? dimensions : measures).push(row);
  }
  return [...dimensions, ...measures];
}

/**
 * Keep a tooltip inside the SVG box.
 * @param {Object} params { x, y, width, height, boxWidth, boxHeight }
 * @returns {{x:number, y:number}}
 */
export function clampTooltip({ x, y, width, height, boxWidth, boxHeight }) {
  if (!allFinite(x, y, width, height, boxWidth, boxHeight)) return { x: 0, y: 0 };
  return {
    x: Math.max(4, Math.min(x, boxWidth - width - 4)),
    y: Math.max(4, Math.min(y, boxHeight - height - 4)),
  };
}

/**
 * The anchor point for a mark's tooltip — the top-centre of a bar, or the point
 * itself for everything else.
 * @param {Object} mark
 * @returns {{x:number, y:number}|null}
 */
export function markAnchor(mark) {
  if (!mark) return null;
  if (mark.type === "rect") {
    const g = rectGeom(mark);
    return g ? { x: g.x + g.width / 2, y: g.y } : null;
  }
  const p = pointGeom(mark);
  return p ? { x: p.x, y: p.y } : null;
}

export { formatValue };
