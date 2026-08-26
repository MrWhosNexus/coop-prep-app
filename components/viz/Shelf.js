"use client";

// Shelves and pills: the surface where the Tableau model is manipulated.
//
// Every rule this file needs lives in ./dnd.js, which is plain JS and tested.
// This component only turns those rules into pointers, pixels and keystrokes.

import { useEffect, useRef, useState } from "react";
import {
  DRAG_MIME,
  PILL_SHELVES,
  SHELF_LABELS,
  aggregationChoices,
  encodingKey,
  encodingLabel,
  isSingleShelf,
  serializeDrag,
  shelfPills,
} from "./dnd.js";

/**
 * A popover menu anchored to a trigger button.
 *
 * This is the keyboard path for everything that is otherwise a drag. Drag-only
 * would put the entire tool out of reach of anyone not using a mouse, so every
 * pill and every field carries one of these.
 *
 * @param {Object} props { trigger, ariaLabel, align, className, children }
 *   `children` is a render prop receiving { close }.
 * @returns {JSX.Element}
 */
export function Menu({ trigger, ariaLabel, align = "left", className = "", children }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        // Return focus to the trigger, or the keyboard user is stranded.
        wrapRef.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className={`viz-menu-wrap ${className}`} ref={wrapRef}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className={trigger.className}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger.content}
      </button>
      {open && (
        <div className={`viz-menu ${align === "right" ? "is-right" : ""}`} role="menu">
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </span>
  );
}

/**
 * One pill on a shelf.
 *
 * The colour is not decoration: blue means discrete (a slice, band axis), green
 * means continuous (an aggregate, linear axis). The caption carries the
 * aggregation — SUM(income) — because that is what the pill actually means.
 *
 * @param {Object} props
 * @returns {JSX.Element}
 */
export function Pill({ encoding, shelf, index, count, onAggregation, onDiscrete, onRemove, onMove, onMoveTo }) {
  const [dragging, setDragging] = useState(false);
  const blue = encoding.discrete;
  const label = encodingLabel(encoding);
  const reorderable = !isSingleShelf(shelf) && count > 1;

  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = "move";
    const payload = serializeDrag({ kind: "pill", shelf, index });
    e.dataTransfer.setData(DRAG_MIME, payload);
    // text/plain keeps the drag legible to anything that only reads plain text.
    e.dataTransfer.setData("text/plain", label);
    setDragging(true);
  };

  return (
    <span
      className={`viz-pill ${blue ? "is-blue" : "is-green"} ${dragging ? "is-dragging" : ""}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => setDragging(false)}
      title={`${label} — ${blue ? "discrete (blue)" : "continuous (green)"}`}
    >
      <span className="viz-pill-text">{label}</span>
      <Menu
        ariaLabel={`Options for ${label} on ${SHELF_LABELS[shelf] ?? shelf}`}
        trigger={{ className: "viz-pill-caret", content: "▾" }}
      >
        {({ close }) => (
          <>
            <div className="viz-menu-label">Aggregation</div>
            {aggregationChoices(encoding).map((agg) => (
              <button
                key={agg ?? "none"}
                type="button"
                role="menuitemradio"
                aria-checked={(encoding.aggregation ?? null) === agg}
                className={`viz-menu-item ${(encoding.aggregation ?? null) === agg ? "is-active" : ""}`}
                onClick={() => {
                  onAggregation(agg);
                  close();
                }}
              >
                <span>{agg ? `${agg}(${encoding.field})` : "None (row level)"}</span>
                {(encoding.aggregation ?? null) === agg && <span className="viz-menu-check">✓</span>}
              </button>
            ))}

            <div className="viz-menu-sep" />
            <div className="viz-menu-label">Pill type</div>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={blue}
              className={`viz-menu-item ${blue ? "is-active" : ""}`}
              onClick={() => {
                onDiscrete(true);
                close();
              }}
            >
              <span>Discrete (blue)</span>
              {blue && <span className="viz-menu-check">✓</span>}
            </button>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={!blue}
              className={`viz-menu-item ${!blue ? "is-active" : ""}`}
              onClick={() => {
                onDiscrete(false);
                close();
              }}
            >
              <span>Continuous (green)</span>
              {!blue && <span className="viz-menu-check">✓</span>}
            </button>

            {reorderable && (
              <>
                <div className="viz-menu-sep" />
                <div className="viz-menu-label">Reorder</div>
                <button
                  type="button"
                  role="menuitem"
                  className="viz-menu-item"
                  disabled={index === 0}
                  onClick={() => {
                    onMove(index - 1);
                    close();
                  }}
                >
                  Move earlier
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="viz-menu-item"
                  disabled={index === count - 1}
                  onClick={() => {
                    onMove(index + 1);
                    close();
                  }}
                >
                  Move later
                </button>
              </>
            )}

            <div className="viz-menu-sep" />
            <div className="viz-menu-label">Move to</div>
            {PILL_SHELVES.filter((s) => s !== shelf).map((s) => (
              <button
                key={s}
                type="button"
                role="menuitem"
                className="viz-menu-item"
                onClick={() => {
                  onMoveTo(s);
                  close();
                }}
              >
                {SHELF_LABELS[s]}
              </button>
            ))}

            <div className="viz-menu-sep" />
            <button
              type="button"
              role="menuitem"
              className="viz-menu-item is-danger"
              onClick={() => {
                onRemove();
                close();
              }}
            >
              Remove
            </button>
          </>
        )}
      </Menu>
    </span>
  );
}

/**
 * A thin drop target between two pills, so a drag can aim at a position rather
 * than only ever appending. stopPropagation keeps the shelf's own append-drop
 * from also firing for the same gesture.
 */
function Slot({ active, index, onOver, onLeave, onDropAt }) {
  return (
    <span
      className={`viz-shelf-slot ${active ? "is-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        onOver();
      }}
      onDragLeave={onLeave}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDropAt(e, index);
      }}
    />
  );
}

/**
 * A shelf: a labelled drop zone holding pills.
 *
 * @param {Object} props
 * @param {Object} props.spec the VizSpec
 * @param {string} props.shelf a Shelf name
 * @param {string} [props.variant] "axis" (a row) or "card" (stacked, narrow)
 * @param {boolean} [props.showPills] render the shelf's contents as pills. False
 *   for Filters, whose contents are filter objects rather than encodings and are
 *   shown as their own cards instead.
 * @param {string} [props.hint] placeholder text when the shelf is empty
 * @param {Function} props.onDropPayload (payload, shelf, index)
 * @param {Function} props.onAggregation (shelf, field, aggregation)
 * @param {Function} props.onDiscrete (shelf, field, discrete)
 * @param {Function} props.onRemove (shelf, index)
 * @param {Function} props.onMove (from, to) — each { shelf, index }
 * @returns {JSX.Element}
 */
export default function ShelfDropZone({
  spec,
  shelf,
  variant = "axis",
  showPills = true,
  hint,
  onDropPayload,
  onAggregation,
  onDiscrete,
  onRemove,
  onMove,
}) {
  const [over, setOver] = useState(false);
  const [slot, setSlot] = useState(null);
  const pills = showPills ? shelfPills(spec, shelf) : [];

  const handleDrop = (e, index) => {
    e.preventDefault();
    setOver(false);
    setSlot(null);
    // Only our own MIME type carries a payload we can act on. The text/plain
    // copy that rides along is for OTHER apps to read — it is a bare field name,
    // so parsing it here would never succeed anyway.
    onDropPayload(e.dataTransfer.getData(DRAG_MIME), shelf, index);
  };

  // Stable anchors for the guided-tutorial spotlight (SHARED DOM CONTRACT).
  // Only the shelves the contract names get an anchor; Label/Detail/Tooltip do not.
  const GUIDE_TARGETS = {
    columns: "viz-columns",
    rows: "viz-rows",
    color: "viz-marks-color",
    size: "viz-marks-size",
    filters: "viz-filters",
  };

  return (
    <div
      className={`viz-shelf ${variant === "card" ? "viz-card-shelf" : ""}`}
      data-guide-target={GUIDE_TARGETS[shelf] ?? undefined}
    >
      <div className="viz-shelf-label" id={`viz-shelf-${shelf}`}>
        {SHELF_LABELS[shelf] ?? shelf}
      </div>
      <div
        className={`viz-shelf-drop ${over ? "is-over" : ""}`}
        role="group"
        aria-labelledby={`viz-shelf-${shelf}`}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setOver(true);
        }}
        onDragLeave={(e) => {
          // Ignore the leave events fired as the pointer crosses child nodes.
          if (!e.currentTarget.contains(e.relatedTarget)) setOver(false);
        }}
        onDrop={(e) => handleDrop(e, undefined)}
      >
        {pills.length === 0 && <span className="viz-shelf-hint">{hint ?? "Drop a field here"}</span>}

        {pills.map((encoding, i) => (
          <span key={encodingKey(encoding, i)} style={{ display: "inline-flex", alignItems: "center" }}>
            {!isSingleShelf(shelf) && (
              <Slot
                index={i}
                active={slot === i}
                onOver={() => setSlot(i)}
                onLeave={() => setSlot(null)}
                onDropAt={handleDrop}
              />
            )}
            <Pill
              encoding={encoding}
              shelf={shelf}
              index={i}
              count={pills.length}
              onAggregation={(agg) => onAggregation(shelf, encoding.field, agg)}
              onDiscrete={(d) => onDiscrete(shelf, encoding.field, d)}
              onRemove={() => onRemove(shelf, i)}
              onMove={(to) => onMove({ shelf, index: i }, { shelf, index: to })}
              onMoveTo={(target) => onMove({ shelf, index: i }, { shelf: target, index: undefined })}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
