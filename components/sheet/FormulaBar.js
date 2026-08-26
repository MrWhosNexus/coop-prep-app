"use client";

// Formula bar: name box + input with live reference highlighting, function
// autocomplete, and a signature hint for the call under the caret.
//
// The highlighting works with a classic underlay: the <input> renders
// transparent text (visible caret), and a perfectly aligned <div> behind it
// renders the same text with references wrapped in colored spans. The same
// colors mark the referenced ranges in the grid (SheetTool wires that).

import { useEffect, useMemo, useRef, useState } from "react";
import {
  formulaSegments, functionPrefix, functionContext,
} from "./sheet-logic.js";
import { searchFunctions, getFunctionHelp } from "./FunctionHelp.js";

const MAX_SUGGESTIONS = 8;

/**
 * @param {object} props
 * @param {string} props.activeRef A1 name of the active cell
 * @param {string} props.value current text (cell input, or in-flight edit)
 * @param {boolean} props.isEditing whether an edit is in progress anywhere
 * @param {(text: string) => void} props.onChange
 * @param {() => void} props.onStartEdit user focused/typed in the bar
 * @param {(nav: string|null) => void} props.onCommit
 * @param {() => void} props.onCancel
 */
export default function FormulaBar({
  activeRef, value, isEditing, onChange, onStartEdit, onCommit, onCancel,
}) {
  const inputRef = useRef(null);
  const underlayRef = useRef(null);
  const [caret, setCaret] = useState(0);
  const [suggestIndex, setSuggestIndex] = useState(0);

  const text = value === null || value === undefined ? "" : String(value);
  const segments = useMemo(() => formulaSegments(text), [text]);

  const prefix = isEditing ? functionPrefix(text, caret) : null;
  const suggestions = useMemo(
    () => (prefix && prefix.prefix.length >= 1 ? searchFunctions(prefix.prefix, MAX_SUGGESTIONS) : []),
    [prefix]
  );
  const context = isEditing && suggestions.length === 0 ? functionContext(text, caret) : null;
  const contextHelp = context ? getFunctionHelp(context.name) : null;

  // clamp instead of resetting in an effect: the list shrinks as you type
  const highlighted = suggestions.length > 0 ? Math.min(suggestIndex, suggestions.length - 1) : 0;

  // keep the underlay aligned with a horizontally scrolled input
  const syncScroll = () => {
    if (underlayRef.current && inputRef.current) {
      underlayRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  };
  useEffect(syncScroll, [text]);

  const trackCaret = () => {
    if (inputRef.current) setCaret(inputRef.current.selectionStart || 0);
  };

  function acceptSuggestion(fn) {
    const p = functionPrefix(text, caret);
    if (!p) return;
    const inserted = fn.name + "(";
    const next = text.slice(0, p.start) + inserted + text.slice(caret);
    onChange(next);
    const pos = p.start + inserted.length;
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(pos, pos);
        setCaret(pos);
      }
    });
  }

  function handleKeyDown(e) {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggestIndex((highlighted + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestIndex((highlighted - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        acceptSuggestion(suggestions[highlighted]);
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      onCommit(e.shiftKey ? "up" : "down");
    } else if (e.key === "Tab") {
      e.preventDefault();
      onCommit(e.shiftKey ? "left" : "right");
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <div className="fx-bar glass">
      <div className="fx-name mono" aria-label="Active cell" title="Active cell">
        {activeRef}
      </div>
      <div className="fx-fx" aria-hidden="true">fx</div>
      <div className="fx-wrap">
        <div ref={underlayRef} className="fx-underlay" aria-hidden="true">
          {segments.map((seg, i) =>
            seg.colorIndex === null ? (
              <span key={i}>{seg.text}</span>
            ) : (
              <span key={i} className={`fx-seg hl-${seg.colorIndex}`}>{seg.text}</span>
            )
          )}
        </div>
        <input
          ref={inputRef}
          className="fx-input"
          value={text}
          spellCheck={false}
          autoComplete="off"
          aria-label={`Formula for cell ${activeRef}`}
          onChange={(e) => {
            if (!isEditing) onStartEdit();
            onChange(e.target.value);
            setCaret(e.target.selectionStart || 0);
            setSuggestIndex(0);
            syncScroll();
          }}
          onFocus={() => {
            if (!isEditing) onStartEdit();
            trackCaret();
          }}
          onKeyDown={handleKeyDown}
          onKeyUp={trackCaret}
          onClick={trackCaret}
          onScroll={syncScroll}
        />
      </div>

      {isEditing && suggestions.length > 0 && (
        <div className="fx-suggest glass-strong" role="listbox" aria-label="Function suggestions">
          {suggestions.map((f, i) => (
            <button
              key={f.name}
              className={"fx-suggest-item" + (i === highlighted ? " hilite" : "")}
              role="option"
              aria-selected={i === highlighted}
              onMouseDown={(e) => {
                e.preventDefault(); // keep input focus
                acceptSuggestion(f);
              }}
            >
              <span className="name">{f.name}</span>
              <span className="sig">{f.signature}</span>
            </button>
          ))}
        </div>
      )}

      {isEditing && contextHelp && (
        <div className="fx-hint glass-strong" aria-live="polite">
          {renderSignatureHint(contextHelp.signature, context.argIndex)}
        </div>
      )}
    </div>
  );
}

/** Bold the argument the caret is sitting in: SUM(number1, [number2], ...) */
function renderSignatureHint(signature, argIndex) {
  const open = signature.indexOf("(");
  const close = signature.lastIndexOf(")");
  if (open === -1 || close === -1) return signature;
  const name = signature.slice(0, open);
  const args = signature.slice(open + 1, close).split(",");
  return (
    <>
      {name}(
      {args.map((a, i) => (
        <span key={i} className={i === Math.min(argIndex, args.length - 1) ? "arg-active" : undefined}>
          {a}
          {i < args.length - 1 ? "," : ""}
        </span>
      ))}
      )
    </>
  );
}
