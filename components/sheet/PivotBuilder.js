"use client";

// Pivot table builder over lib/sheet/pivot.js — the curriculum's highest-value
// teaching surface. Drag fields into Rows / Columns / Values / Filters (or use
// the accessible "add to" picker on each field), choose an aggregation, and
// choose "Show Values As". The engine returns showAs values as FRACTIONS
// (0.5625); formatPivotCell renders them as 56.3% — never scale twice.

import { useMemo, useState } from "react";
import { pivotFromGrid, pivotToGrid } from "../../lib/sheet/pivot.js";
import {
  AGG_OPTIONS, SHOW_AS_OPTIONS,
  buildPivotSpec, formatPivotCell, pivotColumnMeta, headerFields, distinctValues,
} from "./sheet-logic.js";

const DRAG_TYPE = "text/coop-field";
const ZONES = [
  { id: "rows", label: "Rows" },
  { id: "cols", label: "Columns" },
  { id: "values", label: "Values" },
  { id: "filters", label: "Filters" },
];

const EMPTY_STATE = { rows: [], cols: [], values: [], filters: {} };

/**
 * @param {object} props
 * @param {Array<Array<*>>} props.grid header-rowed 2D values (used range of the sheet)
 * @param {() => void} [props.onClose]
 */
export default function PivotBuilder({ grid, onClose }) {
  const [state, setState] = useState(EMPTY_STATE);
  const [dragOver, setDragOver] = useState(null);

  const fields = useMemo(() => headerFields(grid), [grid]);

  function addTo(zone, field) {
    setState((s) => {
      if (zone === "values") {
        return { ...s, values: [...s.values, { field, agg: "count", showAs: "" }] };
      }
      if (zone === "filters") {
        if (field in s.filters) return s;
        return { ...s, filters: { ...s.filters, [field]: [] } };
      }
      if (s[zone].includes(field)) return s;
      return { ...s, [zone]: [...s[zone], field] };
    });
  }

  function removeFrom(zone, indexOrField) {
    setState((s) => {
      if (zone === "values") return { ...s, values: s.values.filter((_, i) => i !== indexOrField) };
      if (zone === "filters") {
        const filters = { ...s.filters };
        delete filters[indexOrField];
        return { ...s, filters };
      }
      return { ...s, [zone]: s[zone].filter((f) => f !== indexOrField) };
    });
  }

  function updateValue(index, patch) {
    setState((s) => ({
      ...s,
      values: s.values.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }));
  }

  function toggleFilterValue(field, value) {
    setState((s) => {
      const current = s.filters[field] || [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...s, filters: { ...s.filters, [field]: next } };
    });
  }

  function loadLessonExample() {
    // Module 4 example: approval rates by race — Show Values As % of Row Total
    setState({
      rows: ["race"],
      cols: ["approved"],
      values: [{ field: "applicant_id", agg: "count", showAs: "percentOfRowTotal" }],
      filters: {},
    });
  }

  const spec = useMemo(() => buildPivotSpec(state), [state]);
  const { table, meta, error } = useMemo(() => {
    if (!spec || !grid || grid.length < 2) return { table: null, meta: null, error: null };
    try {
      const result = pivotFromGrid(grid, spec);
      return { table: pivotToGrid(result), meta: pivotColumnMeta(result), error: null };
    } catch (err) {
      return { table: null, meta: null, error: err.message };
    }
  }, [spec, grid]);

  const zoneHandlers = (zone) => ({
    onDragOver: (e) => {
      if (e.dataTransfer.types.includes(DRAG_TYPE)) {
        e.preventDefault();
        setDragOver(zone);
      }
    },
    onDragLeave: () => setDragOver((z) => (z === zone ? null : z)),
    onDrop: (e) => {
      e.preventDefault();
      setDragOver(null);
      const field = e.dataTransfer.getData(DRAG_TYPE);
      if (field) addTo(zone, field);
    },
  });

  const hasData = fields.length > 0 && grid.length > 1;

  return (
    <div className="pv-panel glass" aria-label="Pivot table builder">
      <div className="pv-title">
        Pivot Table
        <span className="spacer" />
        {hasData && fields.includes("race") && fields.includes("approved") && (
          <button className="sheet-btn" onClick={loadLessonExample}>
            Lesson example
          </button>
        )}
        {onClose && (
          <button className="sheet-btn" onClick={onClose} aria-label="Close pivot builder">
            Close
          </button>
        )}
      </div>

      {!hasData && (
        <p className="pv-note">
          The active sheet needs a data table with a header row — load the HMDA sample from the toolbar, then come back.
        </p>
      )}

      {hasData && (
        <>
          <div className="pv-note">
            Drag a field into a box below — or use the ＋ picker on each field. Then set the
            aggregation and “Show Values As” on the value chip.
          </div>

          <div className="pv-fieldlist" aria-label="Available fields">
            {fields.map((f) => (
              <span
                key={f}
                className="pv-field"
                draggable
                onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, f)}
              >
                {f}
                <select
                  value=""
                  aria-label={`Add ${f} to a pivot area`}
                  onChange={(e) => {
                    if (e.target.value) addTo(e.target.value, f);
                  }}
                >
                  <option value="">＋</option>
                  {ZONES.map((z) => (
                    <option key={z.id} value={z.id}>{z.label}</option>
                  ))}
                </select>
              </span>
            ))}
          </div>

          <div className="pv-zones">
            {/* Rows / Columns */}
            {["rows", "cols"].map((zone) => (
              <div
                key={zone}
                className={"pv-zone" + (dragOver === zone ? " dragover" : "")}
                {...zoneHandlers(zone)}
              >
                <div className="pv-zone-label">{zone === "rows" ? "Rows" : "Columns"}</div>
                {state[zone].map((f) => (
                  <div key={f} className="pv-chip">
                    {f}
                    <button className="remove" onClick={() => removeFrom(zone, f)} aria-label={`Remove ${f}`}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ))}

            {/* Values */}
            <div className={"pv-zone" + (dragOver === "values" ? " dragover" : "")} {...zoneHandlers("values")}>
              <div className="pv-zone-label">Values</div>
              {state.values.map((v, i) => (
                <div key={i} className="pv-chip">
                  {v.field}
                  <select
                    value={v.agg}
                    aria-label={`Aggregation for ${v.field}`}
                    onChange={(e) => updateValue(i, { agg: e.target.value })}
                  >
                    {AGG_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <select
                    value={v.showAs}
                    aria-label={`Show values as for ${v.field}`}
                    onChange={(e) => updateValue(i, { showAs: e.target.value })}
                  >
                    {SHOW_AS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <button className="remove" onClick={() => removeFrom("values", i)} aria-label={`Remove ${v.field} value`}>
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className={"pv-zone" + (dragOver === "filters" ? " dragover" : "")} {...zoneHandlers("filters")}>
              <div className="pv-zone-label">Filters</div>
              {Object.keys(state.filters).map((f) => (
                <div key={f} className="pv-chip" style={{ flexDirection: "column", alignItems: "stretch" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {f}
                    <button className="remove" onClick={() => removeFrom("filters", f)} aria-label={`Remove ${f} filter`}>
                      ✕
                    </button>
                  </div>
                  <div className="pv-filters">
                    {distinctValues(grid, f).map((val) => (
                      <label key={String(val)} className="pv-filter-option">
                        <input
                          type="checkbox"
                          checked={(state.filters[f] || []).includes(val)}
                          onChange={() => toggleFilterValue(f, val)}
                        />
                        {String(val)}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!spec && (
            <p className="pv-note">Add at least one field to <b>Values</b> to build the table.</p>
          )}
          {error && <p className="pv-note" style={{ color: "var(--red-2)" }}>{error}</p>}

          {table && meta && (
            <div className="pv-result">
              <table className="pv-table">
                <thead>
                  <tr>
                    {table[0].map((h, c) => (
                      <th key={c} scope="col">{String(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.slice(1).map((row, r) => {
                    const isTotal = String(row[0]).endsWith("Total");
                    return (
                      <tr key={r} className={isTotal ? "total" : undefined}>
                        {row.map((cell, c) => {
                          const m = meta[c];
                          return (
                            <td key={c} className={m && m.showAs ? "pct" : undefined}>
                              {formatPivotCell(cell, m ? m.showAs : null)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {table && spec && spec.values.some((v) => v.showAs) && (
            <p className="pv-note">
              Percentages are computed by the engine as fractions of the chosen total —
              exactly Excel’s “Show Values As”. Try switching between % of Row, Column, and Grand Total.
            </p>
          )}
        </>
      )}
    </div>
  );
}
