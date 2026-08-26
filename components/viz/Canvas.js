"use client";

// The SVG renderer for a RenderPlan.
//
// The engine already decided WHERE everything goes; this file only decides what
// element to emit. It computes no scales and no domains — if a number is not on
// the plan, the fix belongs in lib/viz, not here. Every coordinate goes through
// ./geometry.js first, because a NaN in an SVG attribute renders nothing at all,
// silently, and that is a miserable afternoon.

import { useState } from "react";
import {
  areaPath,
  clampTooltip,
  drawableMarks,
  finitePoints,
  isFiniteNumber,
  linePath,
  markAnchor,
  pointGeom,
  rectGeom,
  round,
  tickGeom,
  tooltipRows,
  gridlines,
} from "./geometry.js";

/** Rotate long band labels rather than let them collide. */
const ROTATE_OVER = 9;

function Axis({ axis }) {
  const rotate = axis.discrete && axis.ticks.some((t) => String(t.label).length > ROTATE_OVER);

  return (
    <g>
      <line className="viz-axis-line" x1={axis.line.x1} y1={axis.line.y1} x2={axis.line.x2} y2={axis.line.y2} />
      {axis.ticks.map((tick, i) => {
        const g = tickGeom(axis, tick);
        if (!g) return null; // an unpositioned tick draws nothing rather than NaN
        return (
          <g key={`${tick.label}-${i}`}>
            {axis.orientation === "bottom" ? (
              <line className="viz-tick-line" x1={g.x} y1={g.y} x2={g.x} y2={g.y + 5} />
            ) : (
              <line className="viz-tick-line" x1={g.x} y1={g.y} x2={g.x - 5} y2={g.y} />
            )}
            <text
              className="viz-tick-text"
              x={g.textX}
              y={g.textY}
              textAnchor={rotate ? "end" : g.anchor}
              transform={rotate ? `rotate(-35 ${g.textX} ${g.textY})` : undefined}
            >
              {tick.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function AxisTitle({ axis, plot, height }) {
  if (axis.orientation === "bottom") {
    return (
      <text className="viz-axis-title" x={round((plot.x0 + plot.x1) / 2)} y={height - 6} textAnchor="middle">
        {axis.title}
      </text>
    );
  }
  const cy = round((plot.y0 + plot.y1) / 2);
  return (
    <text className="viz-axis-title" x={12} y={cy} textAnchor="middle" transform={`rotate(-90 12 ${cy})`}>
      {axis.title}
    </text>
  );
}

function Mark({ mark, spec, onHover, onLeave }) {
  const label = (rows) => rows.map((r) => `${r.label}: ${r.value}`).join(", ");

  // Shared interaction wiring. Marks are focusable so the chart is readable with
  // a keyboard, not just a mouse.
  //
  // `extra` is merged in here rather than set by the caller: these props are
  // SPREAD onto the element, so a className of the caller's own would be
  // silently overwritten by this one.
  const handlers = (datum, anchor, extra = "") => ({
    className: `viz-mark ${extra}`.trim(),
    tabIndex: 0,
    role: "img",
    "aria-label": label(tooltipRows(spec, datum)),
    onMouseMove: (e) => onHover(datum, e),
    onMouseLeave: onLeave,
    onFocus: () => onHover(datum, null, anchor),
    onBlur: onLeave,
  });

  if (mark.type === "rect") {
    const g = rectGeom(mark);
    if (!g) return null;
    return <rect {...g} fill={mark.fill} rx={1} {...handlers(mark.datum, markAnchor(mark))} />;
  }

  if (mark.type === "circle") {
    const g = pointGeom(mark);
    if (!g) return null;
    return (
      <circle
        cx={g.x}
        cy={g.y}
        r={g.radius}
        fill={mark.fill}
        fillOpacity={0.78}
        stroke={mark.fill}
        {...handlers(mark.datum, markAnchor(mark))}
      />
    );
  }

  if (mark.type === "text") {
    const g = pointGeom(mark);
    if (!g) return null;
    return (
      <text x={g.x} y={g.y} fill={mark.fill} {...handlers(mark.datum, markAnchor(mark), "viz-text-mark")}>
        {mark.text}
      </text>
    );
  }

  if (mark.type === "line" || mark.type === "area") {
    const pts = finitePoints(mark.points);
    const d = mark.type === "area" ? areaPath(mark.points, mark.baseline) : linePath(mark.points);
    if (!d) return null;
    return (
      <g>
        <path
          d={d}
          fill={mark.type === "area" ? mark.fill : "none"}
          fillOpacity={mark.type === "area" ? 0.3 : undefined}
          stroke={mark.stroke}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="viz-mark"
          pointerEvents="none"
        />
        {/* Points along the path double as hover/focus targets — a 2px stroke is
            far too thin to hit reliably. */}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={round(p.x)}
            cy={round(p.y)}
            r={3.5}
            fill={mark.stroke}
            {...handlers(p.datum, { x: round(p.x), y: round(p.y) })}
          />
        ))}
      </g>
    );
  }

  return null;
}

function Legend({ legend }) {
  if (legend.type === "categorical") {
    return (
      <div>
        <div className="viz-legend-title">{legend.title}</div>
        <div className="viz-legend-items">
          {legend.entries.map((e) => (
            <span className="viz-legend-item" key={String(e.value)}>
              <span className="viz-swatch" style={{ background: e.color }} />
              {e.label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (legend.type === "sequential") {
    const stops = legend.stops.map((s) => `${s.color} ${round(s.t * 100)}%`).join(", ");
    return (
      <div>
        <div className="viz-legend-title">{legend.title}</div>
        <div className="viz-legend-ramp" style={{ background: `linear-gradient(90deg, ${stops})` }} />
        <div className="viz-legend-scale">
          <span>{formatDomain(legend.domain[0])}</span>
          <span>{formatDomain(legend.domain[1])}</span>
        </div>
      </div>
    );
  }

  if (legend.type === "size") {
    const [minR, maxR] = legend.range;
    return (
      <div>
        <div className="viz-legend-title">{legend.title}</div>
        <div className="viz-legend-size">
          {[minR, (minR + maxR) / 2, maxR].map((r, i) => (
            <span className="viz-legend-item" key={i}>
              <span className="viz-legend-size-dot" style={{ width: r, height: r }} />
            </span>
          ))}
          <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>
            {formatDomain(legend.domain[0])} – {formatDomain(legend.domain[1])}
          </span>
        </div>
      </div>
    );
  }

  return null;
}

function formatDomain(v) {
  return isFiniteNumber(v) ? String(round(v, 2)) : "—";
}

/**
 * Render a RenderPlan as SVG.
 *
 * @param {Object} props
 * @param {Object} props.plan from buildRenderPlan()
 * @param {Object} props.spec the VizSpec (for tooltip captions)
 * @param {string} [props.emptyHint] what to say before anything is on a shelf
 * @returns {JSX.Element}
 */
export default function Canvas({ plan, spec, emptyHint }) {
  const [tip, setTip] = useState(null);

  // empty:true is the INITIAL state, not an error. The plan is uniform, so this
  // is the only branch the whole renderer needs.
  if (plan.empty) {
    return (
      <div className="viz-canvas-wrap">
        <div className="viz-canvas-empty">
          <strong>Your view is empty</strong>
          <span>{emptyHint ?? "Drag a dimension to Columns and a measure to Rows to build a chart."}</span>
        </div>
      </div>
    );
  }

  const marks = drawableMarks(plan.marks);

  const showTip = (datum, e, anchor) => {
    if (!datum) return;
    const rows = tooltipRows(spec, datum);
    if (rows.length === 0) return;

    // The tooltip is an HTML overlay, so it needs the wrapper's pixel space. The
    // SVG scales to its container via viewBox, so a mark's PLAN coordinates are
    // not screen coordinates. The pointer's client position is; for keyboard
    // focus, where there is no pointer, the anchor is scaled across as a
    // percentage instead.
    if (e) {
      const box = e.currentTarget.ownerSVGElement.getBoundingClientRect();
      // Cheap text metrics: the tooltip never wraps, so the longest row governs.
      const width = Math.max(...rows.map((r) => (r.label.length + String(r.value).length) * 6.2 + 26));
      const height = rows.length * 18 + 14;
      const pos = clampTooltip({
        x: e.clientX - box.left + 14,
        y: e.clientY - box.top + 14,
        width,
        height,
        boxWidth: box.width,
        boxHeight: box.height,
      });
      setTip({ rows, x: pos.x, y: pos.y, relative: false });
      return;
    }
    if (anchor) {
      setTip({ rows, x: (anchor.x / plan.width) * 100, y: (anchor.y / plan.height) * 100, relative: true });
    }
  };

  return (
    <div className="viz-canvas-wrap">
      <svg
        className="viz-canvas"
        viewBox={`0 0 ${plan.width} ${plan.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={spec.title || "Data visualization"}
      >
        {plan.axes.map((axis) =>
          gridlines(axis, plan.plot).map((g) => (
            <line key={`${axis.orientation}-${g.key}`} className="viz-grid-line" x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} />
          ))
        )}

        {plan.axes.map((axis) => (
          <Axis key={axis.orientation} axis={axis} />
        ))}

        {marks.map((mark, i) => (
          <Mark
            key={mark.key ?? i}
            mark={mark}
            spec={spec}
            onHover={showTip}
            onLeave={() => setTip(null)}
          />
        ))}

        {plan.labels.map((l, i) =>
          isFiniteNumber(l.x) && isFiniteNumber(l.y) ? (
            <text className="viz-mark-label" key={l.key ?? i} x={round(l.x)} y={round(l.y)}>
              {l.text}
            </text>
          ) : null
        )}

        {plan.axes.map((axis) => (
          <AxisTitle key={`t-${axis.orientation}`} axis={axis} plot={plan.plot} height={plan.height} />
        ))}
      </svg>

      {tip && (
        // A focus-driven tooltip is positioned in percentages so it tracks the
        // scaled SVG; a pointer-driven one already has real, clamped pixels.
        <div
          className="viz-tooltip"
          style={
            tip.relative
              ? { left: `${tip.x}%`, top: `${tip.y}%`, transform: "translate(-50%, -115%)" }
              : { left: tip.x, top: tip.y }
          }
        >
          {tip.rows.map((r) => (
            <div className="viz-tooltip-row" key={r.label}>
              <span className="viz-tooltip-label">{r.label}</span>
              <span className="viz-tooltip-value">{r.value}</span>
            </div>
          ))}
        </div>
      )}

      {plan.legends.length > 0 && (
        <div className="viz-legends">
          {plan.legends.map((l) => (
            <Legend key={`${l.type}-${l.field}`} legend={l} />
          ))}
        </div>
      )}
    </div>
  );
}
