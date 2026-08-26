"use client";

import { useCallback, useEffect, useRef } from "react";
import { coachingAllowed } from "./adapter";
import "./exam.css";

/**
 * One item: the stem, the options, flag-for-review, and the moves between items.
 *
 * ── Two rules this component exists to enforce ──────────────────────────────
 *
 * NO FEEDBACK DURING A MOCK. `coaching` is false unless the caller asks for it
 * AND the mode permits it — and coachingAllowed() refuses on `mock`, always. When
 * coaching is off, `item.correctIndex` is never consulted and never reaches the
 * DOM, so there is nothing to peek at in devtools either. Feedback-as-you-answer
 * is a different product (the coached warmup) and conflating the two is how a
 * candidate arrives on test day having never once sat with not-knowing.
 *
 * KEYBOARD-FIRST. On the real thing your hands never leave the keyboard, and a
 * mock you have to mouse through builds the wrong muscle memory. Number keys pick
 * options, arrows move within the group, F flags, Enter advances.
 *
 * The options are a real ARIA radiogroup with roving tabindex: one tab stop for
 * the whole group, arrows move within it. That is what a screen-reader user
 * expects of a single-answer question, and it is why arrows move BETWEEN OPTIONS
 * here rather than between items (PageUp/PageDown do that).
 *
 * @param {Object} props
 * @param {Object} props.item a lib/exam form item {id, q, options:[{text,explanation}], correctIndex, explanation}
 * @param {number} props.index
 * @param {number} props.total
 * @param {number|null} props.answer chosen option INDEX (0 is a real answer)
 * @param {boolean} props.flagged
 * @param {string} props.mode a lib/exam MODES id
 * @param {boolean} [props.coaching] reveal correctness as you answer
 * @param {Function} props.onAnswer (optionIndex) => void
 * @param {Function} props.onToggleFlag
 * @param {Function} props.onNext
 * @param {Function} props.onPrev
 * @param {Function} [props.onSubmit]
 */
export default function ExamRunner({
  item,
  index,
  total,
  answer,
  flagged,
  mode,
  coaching = false,
  onAnswer,
  onToggleFlag,
  onNext,
  onPrev,
  onSubmit,
}) {
  const stemRef = useRef(null);

  // Belt and braces: the MODE is the authority, not the caller's prop. A future
  // caller passing coaching on a mock by mistake must not leak the answer key.
  const coach = coaching && coachingAllowed(mode);
  const answered = answer !== null && answer !== undefined;
  const showFeedback = coach && answered;

  /* ── focus management ───────────────────────────────────────────────────
     Moving to a new question moves focus to its heading. Without this a
     screen-reader user pressing Next hears nothing (focus sits on a button that
     just re-rendered) and a keyboard user's focus ring is stranded on the
     previous item's option. tabIndex={-1} lets the heading take programmatic
     focus without joining the tab order. */
  useEffect(() => {
    stemRef.current?.focus();
  }, [item?.id]);

  const pick = useCallback((i) => onAnswer?.(i), [onAnswer]);

  /* ── keyboard ──────────────────────────────────────────────────────────
     Bound to the section, not the window: a global listener would eat the "5"
     a learner types into a note field elsewhere, or fight the review screen. */
  const onKeyDown = useCallback(
    (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const opts = item?.options ?? [];

      // Number keys pick an option — the digit shown ON the option itself, so
      // the shortcut teaches itself.
      if (/^[1-9]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (opts[i]) {
          e.preventDefault();
          pick(i);
        }
        return;
      }

      switch (e.key) {
        // Arrows move WITHIN the radiogroup, per the ARIA radio pattern.
        case "ArrowDown":
        case "ArrowRight": {
          e.preventDefault();
          if (!opts.length) break;
          pick(answered ? (answer + 1) % opts.length : 0);
          break;
        }
        case "ArrowUp":
        case "ArrowLeft": {
          e.preventDefault();
          if (!opts.length) break;
          pick(answered ? (answer - 1 + opts.length) % opts.length : opts.length - 1);
          break;
        }
        case "f":
        case "F":
          e.preventDefault();
          onToggleFlag?.();
          break;
        case "Enter":
          e.preventDefault();
          if (index === total - 1) onSubmit?.();
          else onNext?.();
          break;
        case "PageDown":
          e.preventDefault();
          onNext?.();
          break;
        case "PageUp":
          e.preventDefault();
          onPrev?.();
          break;
        default:
          break;
      }
    },
    [item, answer, answered, index, total, pick, onToggleFlag, onNext, onPrev, onSubmit]
  );

  if (!item) return null;

  return (
    <section className="x-panel" onKeyDown={onKeyDown} aria-labelledby="x-stem">
      <div className="x-qnum">
        <span className="x-eyebrow">
          Question {index + 1} of {total}
        </span>
        {item.sectionLabel && <span className="badge badge-muted">{item.sectionLabel}</span>}
        {flagged && <span className="badge badge-gold">Flagged</span>}
        {coach && <span className="badge badge-primary">Coached — not a mock</span>}
      </div>

      <h2 className="x-stem" id="x-stem" ref={stemRef} tabIndex={-1}>
        {item.q}
      </h2>

      <div className="x-options" role="radiogroup" aria-labelledby="x-stem">
        {item.options.map((o, i) => {
          const checked = i === answer;
          // Coached modes only. When coach is false these are always "", so the
          // answer key leaves no trace in the markup.
          const feedbackCls = showFeedback
            ? i === item.correctIndex
              ? "right"
              : checked
                ? "wrong"
                : ""
            : "";

          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={checked}
              // Roving tabindex: the group is ONE tab stop. Focus lands on the
              // chosen option, or the first when nothing is chosen yet.
              tabIndex={checked || (!answered && i === 0) ? 0 : -1}
              className={`x-option ${feedbackCls}`}
              onClick={() => pick(i)}
            >
              <span className="x-key" aria-hidden="true">{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span>{o.text}</span>
                {/* A coached run teaches the moment you answer: every option
                    explains itself, not just the one you picked. */}
                {showFeedback && o.explanation && (
                  <span className="x-opt-why" style={{ display: "block" }}>
                    {o.explanation}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {showFeedback && item.explanation && (
        <div className="x-rev-note" style={{ marginTop: 14 }}>
          <div className="x-rev-note-k">Why</div>
          {item.explanation}
        </div>
      )}

      <div className="x-actions">
        <button type="button" className="btn-ghost" onClick={onPrev} disabled={index === 0}>
          ← Previous
        </button>
        <button type="button" className="x-flag" aria-pressed={flagged} onClick={onToggleFlag}>
          {flagged ? "★ Flagged" : "☆ Flag for review"}
        </button>

        <span className="x-actions-spacer" />

        {index === total - 1 ? (
          <button type="button" className="btn-primary" onClick={onSubmit}>
            Review &amp; submit
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={onNext}>
            Next →
          </button>
        )}
      </div>

      <div className="x-keys" style={{ marginTop: 14 }} aria-hidden="true">
        <span><kbd>1</kbd>–<kbd>{item.options.length}</kbd> answer</span>
        <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
        <span><kbd>F</kbd> flag</span>
        <span><kbd>Enter</kbd> next</span>
      </div>

      {/* Read when focus lands on the heading. Not a live region, so it cannot
          interrupt. */}
      <p className="x-sr">
        Question {index + 1} of {total}.
        {flagged ? " Flagged for review." : ""}
        {` Press 1 to ${item.options.length} to answer, F to flag.`}
      </p>
    </section>
  );
}
