"use client";

// The data pane. Tableau's whole mental model starts here: the source's columns,
// split into DIMENSIONS (blue — things you slice by) and MEASURES (green —
// things you aggregate). Getting a field onto a shelf is the core gesture, so it
// is available two ways: drag it, or open its menu and pick a shelf.

import { useMemo, useState } from "react";
import { DRAG_MIME, DROP_SHELVES, SHELF_LABELS, groupFields, serializeDrag } from "./dnd.js";
import { Menu } from "./Shelf.js";

/** The glyph that tells you what a field IS at a glance. */
function fieldIcon(field) {
  if (field.calculated) return "fx";
  if (field.type === "number") return "#";
  if (field.type === "date") return "▤";
  if (field.type === "boolean") return "T|F";
  return "Abc";
}

function FieldRow({ field, onAdd }) {
  const isMeasure = field.role === "measure";

  return (
    <div
      className={`viz-field ${isMeasure ? "is-measure" : "is-dimension"}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData(DRAG_MIME, serializeDrag({ kind: "field", field: field.name }));
        e.dataTransfer.setData("text/plain", field.name);
      }}
    >
      <span className="viz-field-icon" aria-hidden="true">
        {fieldIcon(field)}
      </span>
      <span className="viz-field-name" title={field.calculated ? `${field.name} = ${field.expression}` : field.name}>
        {field.name}
      </span>
      <Menu
        align="right"
        ariaLabel={`Add ${field.name} to a shelf`}
        trigger={{ className: "viz-pill-caret", content: "＋" }}
      >
        {({ close }) => (
          <>
            <div className="viz-menu-label">Add {field.name} to</div>
            {DROP_SHELVES.map((shelf) => (
              <button
                key={shelf}
                type="button"
                role="menuitem"
                className="viz-menu-item"
                onClick={() => {
                  onAdd(shelf);
                  close();
                }}
              >
                {SHELF_LABELS[shelf]}
              </button>
            ))}
          </>
        )}
      </Menu>
    </div>
  );
}

/**
 * The data pane: searchable dimensions and measures.
 *
 * @param {Object} props
 * @param {Array<Object>} props.fields field descriptors
 * @param {Function} props.onAddField (fieldName, shelf) — the keyboard path
 * @returns {JSX.Element}
 */
export default function FieldList({ fields, onAddField }) {
  const [query, setQuery] = useState("");

  const { dimensions, measures } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = q ? (fields ?? []).filter((f) => f.name.toLowerCase().includes(q)) : fields ?? [];
    return groupFields(matching);
  }, [fields, query]);

  const section = (label, list, hint) => (
    <div className="viz-field-group">
      <div className="viz-field-group-label">
        <span>{label}</span>
        <span style={{ opacity: 0.7, fontWeight: 600 }}>{list.length}</span>
      </div>
      {list.length === 0 ? (
        <p className="viz-empty-note">{hint}</p>
      ) : (
        <div className="viz-field-list">
          {list.map((f) => (
            <FieldRow key={f.name} field={f} onAdd={(shelf) => onAddField(f.name, shelf)} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="viz-panel glass" data-guide-target="viz-fieldlist">
      <div className="viz-panel-title">Data</div>
      <input
        className="viz-search"
        type="search"
        value={query}
        placeholder="Search fields…"
        aria-label="Search fields"
        onChange={(e) => setQuery(e.target.value)}
      />
      {section("Dimensions", dimensions, query ? "No matching dimensions." : "None.")}
      {section("Measures", measures, query ? "No matching measures." : "None.")}
      <p className="viz-empty-note" style={{ marginTop: 10, lineHeight: 1.45 }}>
        Blue slices the data. Green aggregates it.
      </p>
    </div>
  );
}
