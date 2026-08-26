"use client";

// The Show Me panel: which mark types this view can actually be.
//
// Validity is NOT decided here — showMe() in lib/viz/marks.js owns those rules,
// and it also hands back the reason each disabled option is disabled. Surfacing
// that reason is the point: "Scatter needs a continuous measure on both Rows and
// Columns" teaches the model, where a greyed-out button with no explanation
// teaches nothing.

import { useState } from "react";
import { showMe } from "../../lib/viz/marks.js";

/** Tiny glyphs, drawn inline: no icon dependency for six shapes. */
function MarkIcon({ mark }) {
  const common = { width: 22, height: 16, "aria-hidden": "true", className: "viz-showme-icon" };
  const stroke = { stroke: "currentColor", strokeWidth: 1.6, fill: "none" };

  switch (mark) {
    case "bar":
      return (
        <svg {...common} viewBox="0 0 22 16">
          <rect x="2" y="7" width="4" height="9" fill="currentColor" />
          <rect x="9" y="3" width="4" height="13" fill="currentColor" />
          <rect x="16" y="10" width="4" height="6" fill="currentColor" />
        </svg>
      );
    case "line":
      return (
        <svg {...common} viewBox="0 0 22 16">
          <polyline points="2,13 8,6 14,9 20,2" {...stroke} />
        </svg>
      );
    case "area":
      return (
        <svg {...common} viewBox="0 0 22 16">
          <path d="M2,13 L8,6 L14,9 L20,2 L20,15 L2,15 Z" fill="currentColor" fillOpacity="0.45" />
          <polyline points="2,13 8,6 14,9 20,2" {...stroke} />
        </svg>
      );
    case "scatter":
      return (
        <svg {...common} viewBox="0 0 22 16">
          {[[4, 12], [9, 5], [13, 9], [18, 3], [7, 9]].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="1.8" fill="currentColor" />
          ))}
        </svg>
      );
    case "text":
      return (
        <svg {...common} viewBox="0 0 22 16">
          <rect x="2" y="2" width="18" height="12" {...stroke} />
          <line x1="2" y1="6" x2="20" y2="6" {...stroke} />
          <line x1="11" y1="6" x2="11" y2="14" {...stroke} />
        </svg>
      );
    case "map":
      return (
        <svg {...common} viewBox="0 0 22 16">
          <path d="M11 1c2.8 0 5 2.2 5 5 0 3.7-5 9-5 9S6 9.7 6 6c0-2.8 2.2-5 5-5z" {...stroke} />
          <circle cx="11" cy="6" r="1.7" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}

/**
 * The mark-type picker.
 *
 * @param {Object} props
 * @param {Object} props.spec the VizSpec
 * @param {Function} props.onPick (mark|null) — null means Automatic
 * @returns {JSX.Element}
 */
export default function ShowMe({ spec, onPick }) {
  const [why, setWhy] = useState("");
  const { recommended, options } = showMe(spec);

  // spec.mark === null is "Automatic": Show Me keeps choosing as the shelves change.
  const automatic = spec.mark == null;

  return (
    <div className="viz-panel glass" data-guide-target="viz-showme">
      <div className="viz-panel-title">Show Me</div>

      <button
        type="button"
        className={`viz-showme-btn ${automatic ? "is-active" : ""}`}
        style={{ width: "100%", flexDirection: "row", justifyContent: "center", marginBottom: 6 }}
        aria-pressed={automatic}
        onClick={() => onPick(null)}
        onMouseEnter={() => setWhy(`Automatic picks the best mark for your shelves — right now, ${recommended}.`)}
        onFocus={() => setWhy(`Automatic picks the best mark for your shelves — right now, ${recommended}.`)}
        onMouseLeave={() => setWhy("")}
        onBlur={() => setWhy("")}
      >
        Automatic
      </button>

      <div className="viz-showme-grid">
        {options.map((o) => {
          const active = spec.mark === o.mark;
          return (
            <button
              key={o.mark}
              type="button"
              className={`viz-showme-btn ${active ? "is-active" : ""} ${
                o.mark === recommended && automatic ? "is-recommended" : ""
              }`}
              disabled={!o.valid}
              aria-pressed={active}
              // A native title gives the reason to a pointer; the panel below
              // gives it to a keyboard.
              title={o.valid ? o.label : o.reason}
              onClick={() => onPick(o.mark)}
              onMouseEnter={() => setWhy(o.valid ? "" : o.reason)}
              onFocus={() => setWhy(o.valid ? "" : o.reason)}
              onMouseLeave={() => setWhy("")}
              onBlur={() => setWhy("")}
            >
              <MarkIcon mark={o.mark} />
              {o.label}
            </button>
          );
        })}
      </div>

      <p className="viz-showme-why" role="status">
        {why ||
          (automatic
            ? `Automatic → ${recommended}. Dashed means recommended.`
            : `Mark set to ${spec.mark}.`)}
      </p>
    </div>
  );
}
