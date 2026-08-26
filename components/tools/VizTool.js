"use client";

// The Tableau-clone tool: a data pane, shelves, a canvas and Show Me.
//
// This file is the wiring, not the brain. Every rule it applies is imported:
// drop legality and shelf mutation from components/viz/dnd.js, mark validity
// from lib/viz/marks.js, geometry from lib/viz/render-plan.js. The one thing it
// genuinely owns is the data source and the spec state.

import { useCallback, useEffect, useMemo, useState } from "react";
import Canvas from "@/components/viz/Canvas";
import FieldList from "@/components/viz/FieldList";
import FilterCard from "@/components/viz/FilterCard";
import ShelfDropZone from "@/components/viz/Shelf";
import ShowMe from "@/components/viz/ShowMe";
import {
  AXIS_SHELVES,
  CARD_SHELVES,
  Shelf,
  canDrop,
  defaultFilterFor,
  dropField,
  movePill,
  parseDrag,
  removeFilterAt,
  removePill,
  setFilterAt,
  shelfPills,
  changeAggregation,
  changeDiscrete,
} from "@/components/viz/dnd";
import { buildRenderPlan } from "@/lib/viz/render-plan";
import { createSpec, resolveMark, validateSpec } from "@/lib/viz/spec";
import { createCalculatedField, inferFields, parseCsv } from "@/lib/viz/fields";
import { MARK_LABELS } from "@/lib/viz/marks";
import "@/components/viz/viz.css";

/** The plot box the plan is built for. The SVG scales to its container. */
const PLAN_SIZE = { width: 720, height: 430 };

/**
 * Calculated fields the tool ships with a source, keyed by a column that proves
 * the source is that dataset.
 *
 * approval_rate exists because the lesson ("is approval even across race?")
 * cannot be asked otherwise: `approved` is the text APPROVED/DENIED, and no
 * aggregation of text is a rate. Flagging it 1/0 and AVG-ing that gives the
 * fraction — and AVG is pinned as the default, since SUM of 0/1 flags is a
 * count of approvals, not a rate, and that mistake looks plausible on a chart.
 */
function datasetCalculatedFields(fields) {
  const has = (name) => fields.some((f) => f.name === name);
  const out = [];
  if (has("approved")) {
    out.push(
      createCalculatedField("approval_rate", 'IF([approved] = "APPROVED", 1, 0)', { aggregation: "AVG" })
    );
  }
  return out;
}

/**
 * The drag-and-drop viz builder.
 *
 * @param {Object} props
 * @param {string} [props.csvText] CSV text to use directly. When given, nothing
 *   is fetched — this is the escape hatch for the packaged Electron build, where
 *   the app is served over file:// and Chromium refuses to fetch() file:// URLs.
 *   Hand the CSV in over IPC (or as a bundled string) and this all still works.
 * @param {string} [props.dataUrl] a CSV to fetch (defaults to the HMDA extract)
 * @param {Object} [props.spec] a CONTROLLED spec: when given together with
 *   onSpecChange, the parent owns the spec (guided lessons lift it so the
 *   grader can read live work). Omitted => the tool owns its own spec, exactly
 *   as before.
 * @param {(spec:Object)=>void} [props.onSpecChange] receives every spec change
 *   when controlled.
 * @returns {JSX.Element}
 */
export default function VizTool({ csvText, dataUrl = "/data/hmda-sample.csv", spec: controlledSpec, onSpecChange }) {
  const [rows, setRows] = useState([]);
  const [fields, setFields] = useState([]);
  const [internalSpec, setInternalSpec] = useState(() => createSpec());
  // Controlled only when BOTH the spec and a change handler are supplied, so a
  // caller that passes neither keeps the standalone behavior untouched.
  const isControlled = controlledSpec !== undefined && typeof onSpecChange === "function";
  const spec = isControlled ? controlledSpec : internalSpec;
  const setSpec = useCallback((updater) => {
    if (isControlled) {
      onSpecChange(typeof updater === "function" ? updater(controlledSpec) : updater);
    } else {
      setInternalSpec(updater);
    }
  }, [isControlled, onSpecChange, controlledSpec]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [showTable, setShowTable] = useState(false);
  const [notice, setNotice] = useState("");

  // ── Load the source ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setStatus("loading");
        let text = csvText;
        if (text === undefined) {
          const res = await fetch(dataUrl);
          if (!res.ok) throw new Error(`Could not load ${dataUrl} (${res.status})`);
          text = await res.text();
        }
        const parsed = parseCsv(text);
        if (cancelled) return;

        const base = inferFields(parsed);
        const calcs = datasetCalculatedFields(base);
        setRows(parsed);
        setFields([...base, ...calcs]);
        // The calculated fields must ride on the spec: buildRenderPlan
        // materialises them from there, not from the field list. When the spec
        // is controlled the parent already seeded it (a guided checkpoint), so
        // do not clobber that here.
        if (!isControlled) setSpec(createSpec({ calculatedFields: calcs }));
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dataUrl, csvText]);

  const fieldByName = useCallback((name) => fields.find((f) => f.name === name), [fields]);

  // ── Mutations ───────────────────────────────────────────────────
  // The legality check reads `spec` directly rather than from inside a setSpec
  // updater: an updater must be pure (React may run it twice), and setNotice in
  // there is a side effect.
  const addFieldToShelf = useCallback(
    (fieldName, shelf) => {
      const field = fieldByName(fieldName);
      if (!field) return;

      // The Filters shelf holds filter objects, not pills.
      if (shelf === Shelf.FILTERS) {
        if ((spec.filters ?? []).some((f) => f.field === fieldName)) {
          setNotice(`${fieldName} is already filtered.`);
          return;
        }
        setNotice("");
        setSpec((s) => ({ ...s, filters: [...(s.filters ?? []), defaultFilterFor(field, rows)] }));
        return;
      }

      const check = canDrop(spec, shelf, field);
      if (!check.allowed) {
        setNotice(check.reason);
        return;
      }
      setNotice(check.warning ?? "");
      setSpec((s) => dropField(s, shelf, field));
    },
    [fieldByName, rows, spec]
  );

  const handleDropPayload = useCallback(
    (raw, shelf, index) => {
      const payload = parseDrag(raw);
      // A drop can carry anything at all — a file, text from another app. If we
      // cannot read it as one of ours, do nothing rather than guess.
      if (!payload) return;

      if (payload.kind === "field") {
        addFieldToShelf(payload.field, shelf);
        return;
      }

      if (payload.kind === "pill") {
        setSpec((current) => {
          if (shelf === Shelf.FILTERS) {
            // Dragging a pill onto Filters filters its FIELD. The pill itself
            // stays where it was — the view still shows what it showed.
            const source = shelfPills(current, payload.shelf)[payload.index];
            const field = source && fieldByName(source.field);
            if (!field || (current.filters ?? []).some((f) => f.field === field.name)) return current;
            return { ...current, filters: [...(current.filters ?? []), defaultFilterFor(field, rows)] };
          }
          return movePill(current, { shelf: payload.shelf, index: payload.index }, { shelf, index });
        });
      }
    },
    [addFieldToShelf, fieldByName, rows]
  );

  const onAggregation = useCallback((shelf, field, agg) => {
    setSpec((s) => changeAggregation(s, shelf, field, agg));
  }, []);
  const onDiscrete = useCallback((shelf, field, discrete) => {
    setSpec((s) => changeDiscrete(s, shelf, field, discrete));
  }, []);
  const onRemove = useCallback((shelf, index) => {
    setSpec((s) => removePill(s, shelf, index));
  }, []);
  const onMove = useCallback((from, to) => {
    setSpec((s) => movePill(s, from, to));
  }, []);

  // ── Derived view ────────────────────────────────────────────────
  const plan = useMemo(
    () => buildRenderPlan(spec, rows, PLAN_SIZE),
    [spec, rows]
  );
  const validation = useMemo(() => validateSpec(spec, fields), [spec, fields]);

  const shelfProps = {
    spec,
    onDropPayload: handleDropPayload,
    onAggregation,
    onDiscrete,
    onRemove,
    onMove,
  };

  if (status === "loading") {
    return (
      <div className="glass" style={{ padding: 40, display: "grid", placeItems: "center", minHeight: 260 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="glass" style={{ padding: 24 }}>
        <div className="viz-note is-error">Could not load the data source. {error}</div>
      </div>
    );
  }

  const dataColumns = plan.data.length
    ? Object.keys(plan.data[0]).filter((k) => k !== "__key" && k !== "__count")
    : [];

  return (
    <div className="viz-tool fadein">
      <FieldList fields={fields} onAddField={addFieldToShelf} />

      <div className="viz-main">
        <div className="viz-panel glass">
          <div className="viz-toolbar">
            <span className="viz-title">{spec.title || "Sheet 1"}</span>
            <div className="viz-toolbar-actions">
              <button type="button" className="btn-ghost" onClick={() => setShowTable((v) => !v)}>
                {showTable ? "Hide data" : "View data"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setSpec(createSpec({ calculatedFields: spec.calculatedFields }));
                  setNotice("");
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {AXIS_SHELVES.map((shelf) => (
            <ShelfDropZone
              key={shelf}
              shelf={shelf}
              hint={shelf === Shelf.COLUMNS ? "Drop a dimension here" : "Drop a measure here"}
              {...shelfProps}
            />
          ))}
        </div>

        <div className="viz-body">
          <div className="viz-panel glass">
            <div className="viz-panel-title">Marks</div>
            <div
              className="badge badge-muted"
              style={{ marginBottom: 8 }}
              title={spec.mark ? "Chosen in Show Me" : "Chosen automatically from your shelves"}
            >
              {MARK_LABELS[resolveMark(spec)]}
              {spec.mark == null ? " (auto)" : ""}
            </div>
            {CARD_SHELVES.map((shelf) => (
              <ShelfDropZone key={shelf} shelf={shelf} variant="card" hint="—" {...shelfProps} />
            ))}
          </div>

          <div className="viz-panel glass">
            <Canvas plan={plan} spec={spec} />

            {(notice || validation.warnings.length > 0 || validation.errors.length > 0) && (
              <div className="viz-warnings">
                {notice && <div className="viz-note is-warn">{notice}</div>}
                {validation.errors
                  .filter(() => !plan.empty)
                  .map((e) => (
                    <div className="viz-note is-error" key={e}>
                      {e}
                    </div>
                  ))}
                {validation.warnings.map((w) => (
                  <div className="viz-note is-warn" key={w}>
                    {w}
                  </div>
                ))}
              </div>
            )}

            {showTable && (
              <div className="viz-table-wrap">
                <table className="viz-table">
                  <caption className="viz-sr">The aggregated rows behind the current view</caption>
                  <thead>
                    <tr>
                      {dataColumns.map((c) => (
                        <th key={c} scope="col">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {plan.data.map((row) => (
                      <tr key={row.__key}>
                        {dataColumns.map((c) => (
                          <td key={c}>{String(row[c] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="viz-rail">
        <div className="viz-panel glass">
          <div className="viz-panel-title">Filters</div>
          <ShelfDropZone
            shelf={Shelf.FILTERS}
            variant="card"
            showPills={false}
            hint="Drop a field to filter"
            {...shelfProps}
          />
          {(spec.filters ?? []).map((filter, i) => (
            <FilterCard
              key={filter.field}
              filter={filter}
              field={fieldByName(filter.field)}
              fields={fields}
              rows={rows}
              onChange={(next) => setSpec((s) => setFilterAt(s, i, next))}
              onRemove={() => setSpec((s) => removeFilterAt(s, i))}
            />
          ))}
        </div>

        <ShowMe spec={spec} onPick={(mark) => setSpec((s) => ({ ...s, mark }))} />
      </div>
    </div>
  );
}
