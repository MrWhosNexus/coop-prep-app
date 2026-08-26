"use client";

import { visibleHints, hasMoreHints, nextHintCost } from "./adapter";

/**
 * Progressive hints. A ladder, not a dump.
 *
 * Two rules make this teach instead of leak:
 *   1. One rung at a time, cheapest first.
 *   2. The price is on the button BEFORE it is paid. A cost the learner only
 *      discovers afterwards is a punishment; a cost they accept up front is a
 *      decision, and deciding is the part that teaches.
 *
 * @param {Object} props
 * @param {Array<{text:string, cost:number}>} props.hints
 * @param {{revealed:number, spent:number}} props.state
 * @param {Function} props.onReveal
 * @param {boolean} [props.disabled] locked once the step has passed
 */
export default function HintLadder({ hints = [], state, onReveal, disabled = false }) {
  const shown = visibleHints(state, hints);
  const more = hasMoreHints(state, hints);
  const cost = nextHintCost(state, hints);

  if (!hints.length) return null;

  return (
    <section className="guide-hints" aria-labelledby="guide-hints-label">
      <div className="guide-hints-head">
        <h4 id="guide-hints-label" className="section-label">
          Hints
        </h4>
        <span className="guide-hints-count">
          {shown.length} of {hints.length}
          {state.spent > 0 && <span className="guide-spent"> · −{state.spent}</span>}
        </span>
      </div>

      {shown.length > 0 && (
        <ol className="guide-hint-list">
          {shown.map((h, i) => (
            <li key={i} className="guide-hint fadein">
              <span className="guide-hint-rung mono" aria-hidden="true">
                {i + 1}
              </span>
              <p className="guide-hint-text">{h.text}</p>
            </li>
          ))}
        </ol>
      )}

      {more && !disabled && (
        <button type="button" className="btn-ghost guide-hint-btn" onClick={onReveal}>
          {shown.length === 0 ? "Show a hint" : "Show the next hint"}
          <span className="guide-hint-cost">−{cost}</span>
        </button>
      )}

      {!more && shown.length > 0 && (
        <p className="guide-hints-done">That&apos;s every hint for this step.</p>
      )}
    </section>
  );
}
