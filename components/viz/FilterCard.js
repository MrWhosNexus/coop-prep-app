"use client";

// Filter editors. The filter OBJECTS come from lib/viz/aggregate.js's builders
// and are read by the same pipeline that grades a lesson — this file only edits
// them, and never invents its own filter shape.

import { useMemo } from "react";
import {
  FilterType,
  categoricalFilter,
  excludeFilter,
  rangeFilter,
  topNFilter,
  distinctValues,
} from "../../lib/viz/aggregate.js";
import { FieldRole } from "../../lib/viz/fields.js";

/** Include-list vs exclude-list, decided by which key the filter carries. */
function isExclude(filter) {
  return Array.isArray(filter.exclude);
}

function CategoricalEditor({ filter, rows, onChange }) {
  const members = useMemo(() => distinctValues(rows ?? [], filter.field), [rows, filter.field]);
  const exclude = isExclude(filter);
  const selected = new Set((exclude ? filter.exclude : filter.include ?? []).map(String));

  const toggle = (member) => {
    const key = String(member);
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    const values = members.filter((m) => next.has(String(m)));
    onChange(exclude ? excludeFilter(filter.field, values) : categoricalFilter(filter.field, values));
  };

  const setAll = (all) => {
    const values = all ? members : [];
    onChange(exclude ? excludeFilter(filter.field, all ? [] : members) : categoricalFilter(filter.field, values));
  };

  return (
    <>
      <div className="viz-filter-tabs" role="group" aria-label="Filter mode">
        <button
          type="button"
          className={`viz-filter-tab ${!exclude ? "is-active" : ""}`}
          aria-pressed={!exclude}
          onClick={() => onChange(categoricalFilter(filter.field, members.filter((m) => selected.has(String(m)))))}
        >
          Include
        </button>
        <button
          type="button"
          className={`viz-filter-tab ${exclude ? "is-active" : ""}`}
          aria-pressed={exclude}
          onClick={() => onChange(excludeFilter(filter.field, members.filter((m) => selected.has(String(m)))))}
        >
          Exclude
        </button>
      </div>

      <div className="viz-filter-values">
        {members.map((m) => (
          <label className="viz-check" key={String(m)}>
            <input type="checkbox" checked={selected.has(String(m))} onChange={() => toggle(m)} />
            <span>{String(m)}</span>
          </label>
        ))}
      </div>

      <div className="viz-filter-actions">
        <button type="button" className="viz-linkbtn" onClick={() => setAll(true)}>
          All
        </button>
        <button type="button" className="viz-linkbtn" onClick={() => setAll(false)}>
          None
        </button>
      </div>
    </>
  );
}

function RangeEditor({ filter, onChange }) {
  // An empty box means "open at this end" — null, not 0. Number("") is 0, which
  // would silently filter out every negative value.
  const parse = (raw) => (raw === "" ? null : Number(raw));

  return (
    <div className="viz-filter-row">
      <input
        className="viz-num"
        type="number"
        aria-label={`Minimum ${filter.field}`}
        value={filter.min ?? ""}
        placeholder="min"
        onChange={(e) => onChange(rangeFilter(filter.field, parse(e.target.value), filter.max))}
      />
      <span style={{ color: "var(--text-3)", fontSize: 11 }}>to</span>
      <input
        className="viz-num"
        type="number"
        aria-label={`Maximum ${filter.field}`}
        value={filter.max ?? ""}
        placeholder="max"
        onChange={(e) => onChange(rangeFilter(filter.field, filter.min, parse(e.target.value)))}
      />
    </div>
  );
}

function TopNEditor({ filter, measures, onChange }) {
  const by = filter.by ?? { field: measures[0]?.name, aggregation: "SUM" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="viz-filter-row">
        <select
          className="viz-select"
          aria-label="Top or bottom"
          value={filter.direction}
          onChange={(e) => onChange(topNFilter(filter.field, filter.n, by, { direction: e.target.value }))}
        >
          <option value="top">Top</option>
          <option value="bottom">Bottom</option>
        </select>
        <input
          className="viz-num"
          type="number"
          min="1"
          aria-label="How many"
          value={filter.n}
          onChange={(e) =>
            onChange(topNFilter(filter.field, Math.max(1, Number(e.target.value) || 1), by, { direction: filter.direction }))
          }
        />
      </div>
      <label className="viz-empty-note" style={{ padding: 0 }}>
        by
        <select
          className="viz-select"
          aria-label="Ranked by"
          value={`${by.aggregation}|${by.field}`}
          onChange={(e) => {
            const [aggregation, field] = e.target.value.split("|");
            onChange(topNFilter(filter.field, filter.n, { field, aggregation }, { direction: filter.direction }));
          }}
        >
          {measures.flatMap((m) =>
            ["SUM", "AVG", "COUNT"].map((agg) => (
              <option key={`${agg}|${m.name}`} value={`${agg}|${m.name}`}>
                {agg}({m.name})
              </option>
            ))
          )}
        </select>
      </label>
    </div>
  );
}

/**
 * One filter card.
 *
 * @param {Object} props
 * @param {Object} props.filter a filter object
 * @param {Object} props.field the field descriptor it targets
 * @param {Array<Object>} props.rows the source rows (for member lists)
 * @param {Array<Object>} props.fields all fields (top-N needs the measures)
 * @param {Function} props.onChange (filter)
 * @param {Function} props.onRemove ()
 * @returns {JSX.Element}
 */
export default function FilterCard({ filter, field, rows, fields, onChange, onRemove }) {
  const measures = (fields ?? []).filter((f) => f.role === FieldRole.MEASURE);
  const isCategorical = filter.type === FilterType.CATEGORICAL;
  const isRange = filter.type === FilterType.RANGE;
  const isTopN = filter.type === FilterType.TOP_N;

  // Top-N ranks GROUPS by an aggregate, so it needs a measure to rank by and a
  // dimension to limit. Offering it without a measure would be a dead end.
  const canTopN = measures.length > 0 && field?.role !== FieldRole.MEASURE;

  const switchTo = (type) => {
    if (type === FilterType.CATEGORICAL) {
      onChange(categoricalFilter(filter.field, distinctValues(rows ?? [], filter.field)));
    } else if (type === FilterType.RANGE) {
      onChange(rangeFilter(filter.field, null, null));
    } else {
      onChange(topNFilter(filter.field, 5, { field: measures[0].name, aggregation: "SUM" }));
    }
  };

  return (
    <div className="viz-filter-card">
      <div className="viz-filter-head">
        <span className="viz-filter-field" title={filter.field}>
          {filter.field}
        </span>
        <button type="button" className="viz-x" aria-label={`Remove the filter on ${filter.field}`} onClick={onRemove}>
          ✕
        </button>
      </div>

      <div className="viz-filter-tabs" role="group" aria-label={`Filter type for ${filter.field}`}>
        <button
          type="button"
          className={`viz-filter-tab ${isCategorical ? "is-active" : ""}`}
          aria-pressed={isCategorical}
          onClick={() => switchTo(FilterType.CATEGORICAL)}
        >
          List
        </button>
        <button
          type="button"
          className={`viz-filter-tab ${isRange ? "is-active" : ""}`}
          aria-pressed={isRange}
          onClick={() => switchTo(FilterType.RANGE)}
        >
          Range
        </button>
        {canTopN && (
          <button
            type="button"
            className={`viz-filter-tab ${isTopN ? "is-active" : ""}`}
            aria-pressed={isTopN}
            onClick={() => switchTo(FilterType.TOP_N)}
          >
            Top N
          </button>
        )}
      </div>

      {isCategorical && <CategoricalEditor filter={filter} rows={rows} onChange={onChange} />}
      {isRange && <RangeEditor filter={filter} onChange={onChange} />}
      {isTopN && <TopNEditor filter={filter} measures={measures} onChange={onChange} />}
    </div>
  );
}
