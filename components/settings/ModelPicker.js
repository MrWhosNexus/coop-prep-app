"use client";

// components/settings/ModelPicker.js
// Model selection for one endpoint.
//
// EVERY MODEL IN THIS LIST CAME FROM THE ENDPOINT ITSELF. Provider presets carry
// only a base URL (see lib/endpoints/providers.js) — there is no hardcoded model
// list anywhere in this unit, and this component cannot render a model that the
// user's own key did not just report as reachable. That is the whole reason
// discovery exists: a baked-in list rots the day a provider ships a model, and
// lies about what a given key can actually reach.
//
// Prices are annotations looked up BY the discovered id (formatModelPrice), not
// a source of models. An unrecognised model renders with no price rather than a
// guessed one.

import { useEffect, useRef, useState } from "react";
import { formatModelPrice } from "./endpoints-ui.js";

/**
 * @param {object} props
 * @param {{id: string}[]} props.models    - Live-discovered. Empty until a probe runs.
 * @param {string} props.value             - Selected model id ("" = none).
 * @param {(modelId: string) => void} props.onChange
 * @param {boolean} [props.loading]
 * @param {string} [props.emptyHint]       - Shown when discovery has returned nothing.
 * @param {Date} [props.now]               - Injectable clock, for intro-price display.
 */
export default function ModelPicker({
  models,
  value,
  onChange,
  loading = false,
  emptyHint = "Run Test to discover the models this endpoint offers.",
  now,
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const rootRef = useRef(null);

  // Same click-outside discipline as ProviderPicker: listener only while open.
  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const list = Array.isArray(models) ? models : [];
  const needle = filter.trim().toLowerCase();
  const shown = needle ? list.filter((m) => m.id.toLowerCase().includes(needle)) : list;

  const selectedPrice = value ? formatModelPrice(value, now) : "";

  return (
    <div className="ep-picker ep-model-picker" ref={rootRef}>
      <button
        type="button"
        className="ep-picker-toggle"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={loading || list.length === 0}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ep-picker-label">
          {loading ? "Discovering models…" : value || "Select a model"}
        </span>
        {selectedPrice && <span className="ep-price">{selectedPrice}</span>}
        <span className={`ep-chevron${open ? " open" : ""}`} aria-hidden="true">▾</span>
      </button>

      {!loading && list.length === 0 && <p className="ep-hint">{emptyHint}</p>}

      {open && (
        <div className="ep-picker-menu glass" role="listbox" aria-label="Model">
          {list.length > 8 && (
            <input
              className="ep-input ep-model-filter"
              type="text"
              autoFocus
              spellCheck={false}
              placeholder="Filter models…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          )}

          {shown.map((model) => {
            const price = formatModelPrice(model.id, now);
            return (
              <button
                type="button"
                key={model.id}
                role="option"
                aria-selected={model.id === value}
                className={`ep-picker-item${model.id === value ? " on" : ""}`}
                onClick={() => {
                  onChange(model.id);
                  setOpen(false);
                  setFilter("");
                }}
              >
                <span className="ep-picker-item-text">
                  <span className="ep-picker-item-label ep-mono">{model.id}</span>
                  {/* Cost per Mtok is worth the pixels here: in a BYO-key app
                      the user pays this directly, so it belongs at the point of
                      choosing, not buried in provider docs. */}
                  {price && <span className="ep-picker-item-url">{price}</span>}
                </span>
              </button>
            );
          })}

          {shown.length === 0 && (
            <p className="ep-hint ep-hint-inset">No model matches “{filter}”.</p>
          )}
        </div>
      )}
    </div>
  );
}
