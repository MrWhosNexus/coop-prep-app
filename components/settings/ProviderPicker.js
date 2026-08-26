"use client";

// components/settings/ProviderPicker.js
// The provider dropdown: a custom menu, deliberately not a <select>.
//
// WHY NOT <select>: the rows carry a glyph, a label and a secondary URL line,
// and the control must be able to render a state ("Custom URL") that is derived
// from the URL field rather than chosen from the list. A native <select> can do
// none of that, and faking it with an <option> whose text changes underneath the
// user is worse than owning the menu.
//
// THE DESIGN RULE THIS CONTROL EXISTS TO EXPRESS: the URL field is the source of
// truth. This picker only SEEDS it. `value` is computed from the URL by the
// parent (pickerStateForUrl), never stored here — so typing a custom URL makes
// the control say "Custom URL" on its own, with no reset logic anywhere.

import { useEffect, useRef } from "react";
import { PROVIDERS, CUSTOM_PROVIDER_ID } from "@/lib/endpoints/providers.js";

/**
 * @param {object} props
 * @param {string} props.providerId - Derived from the URL by the parent. Not owned here.
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {(providerId: string) => void} props.onPick - Receives a provider id to seed from.
 * @param {string} [props.id]
 */
export default function ProviderPicker({ providerId, open, onOpenChange, onPick, id }) {
  const rootRef = useRef(null);

  // Click-outside-to-close. Registered ONLY while the menu is open: a listener
  // that lives for the component's whole lifetime runs on every pointerdown in
  // the app to answer a question that only matters while a menu is showing.
  // Closing over `open` here also means no stale-state check inside the handler.
  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) onOpenChange(false);
    }
    function onKeyDown(event) {
      // Esc closes: a menu you can open with the keyboard must be closable with it.
      if (event.key === "Escape") onOpenChange(false);
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  const active = PROVIDERS.find((p) => p.id === providerId) ?? null;
  const label = active?.label ?? "Custom URL";
  const glyph = active?.glyph ?? "··";

  return (
    <div className="ep-picker" ref={rootRef}>
      <button
        type="button"
        id={id}
        className="ep-picker-toggle"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <span className="ep-glyph" aria-hidden="true">{glyph}</span>
        <span className="ep-picker-label">{label}</span>
        <span className={`ep-chevron${open ? " open" : ""}`} aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="ep-picker-menu glass" role="listbox" aria-label="Provider">
          {PROVIDERS.map((provider) => {
            const isCustom = provider.id === CUSTOM_PROVIDER_ID;
            return (
              <button
                type="button"
                key={provider.id}
                role="option"
                aria-selected={provider.id === providerId}
                className={`ep-picker-item${provider.id === providerId ? " on" : ""}`}
                onClick={() => {
                  onPick(provider.id);
                  onOpenChange(false);
                }}
              >
                <span className="ep-glyph" aria-hidden="true">{provider.glyph}</span>
                <span className="ep-picker-item-text">
                  <span className="ep-picker-item-label">{provider.label}</span>
                  {/* The URL is shown because it is the thing being chosen —
                      the provider name is just a shorthand for it. */}
                  <span className="ep-picker-item-url">
                    {isCustom ? "Type your own base URL" : provider.baseUrl}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
