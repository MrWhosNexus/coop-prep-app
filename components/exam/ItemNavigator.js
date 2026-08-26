"use client";

import { useMemo } from "react";
import { navigatorEntries, answerSheetSummary, nextOutstanding } from "./adapter";
import "./exam.css";

/**
 * The grid of every item: answered, unanswered, flagged — and a jump to any one.
 *
 * This is not a convenience. Every real testing engine (Prometric, Pearson VUE)
 * ships one, and the skill it supports — skip what you're stuck on, flag it, bank
 * the twelve easy marks behind it, come back — is worth as much on exam day as
 * any single fact in the curriculum. Practising on a linear next/next/next form
 * trains the opposite habit: sink twenty minutes into question 4 and never reach
 * question 60.
 *
 * Marked up as a real list of buttons rather than div soup, so a screen-reader
 * user gets "Question 12 of 75, answered, flagged for review" and can jump too.
 *
 * @param {Object} props
 * @param {Object} props.session a lib/exam session
 * @param {Function} props.onJump (index) => void
 * @param {Object} [props.review] a lib/exam review — colours cells right/wrong
 * @param {boolean} [props.showOutcome] reveal correctness. REVIEW ONLY, never live.
 */
export default function ItemNavigator({ session, onJump, review, showOutcome = false }) {
  const entries = useMemo(() => navigatorEntries(session), [session]);
  const summary = useMemo(() => answerSheetSummary(session), [session]);
  const outstanding = useMemo(
    () => (showOutcome ? null : nextOutstanding(session)),
    [session, showOutcome]
  );

  // Item id -> "correct" | "incorrect" | "unanswered", from the engine's review.
  const byId = useMemo(() => {
    const m = new Map();
    for (const r of review?.items ?? []) m.set(r.id, r.status);
    return m;
  }, [review]);

  if (!entries.length) return null;

  return (
    <nav className="x-panel x-nav" aria-labelledby="x-nav-h">
      <div>
        <h2 id="x-nav-h" className="x-eyebrow" style={{ marginBottom: 8 }}>
          {showOutcome ? "All questions" : "Your answer sheet"}
        </h2>

        <div className="x-counts">
          <div className="x-count">
            <span className="x-count-v">{summary.answered}</span>
            <span className="x-count-k">answered</span>
          </div>
          <div className="x-count">
            <span className="x-count-v">{summary.unanswered}</span>
            <span className="x-count-k">left</span>
          </div>
          {summary.flagged > 0 && (
            <div className="x-count">
              <span className="x-count-v">{summary.flagged}</span>
              <span className="x-count-k">flagged</span>
            </div>
          )}
        </div>
      </div>

      <ol className="x-nav-grid" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {entries.map((e) => {
          const status = showOutcome ? byId.get(e.id) : null;
          const cls = [
            "x-nav-cell",
            e.answered && !showOutcome ? "answered" : "",
            e.flagged ? "flagged" : "",
            e.current ? "current" : "",
            status === "correct" ? "correct" : "",
            status === "incorrect" || status === "unanswered" ? "incorrect" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li key={e.id}>
              <button
                type="button"
                className={cls}
                onClick={() => onJump?.(e.index)}
                aria-current={e.current ? "true" : undefined}
                aria-label={describeCell(e, entries.length, status)}
              >
                <span aria-hidden="true">{e.number}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="x-legend" aria-hidden="true">
        {showOutcome ? (
          <>
            <span className="x-legend-item">
              <span className="x-swatch" style={{ background: "var(--green-dim)", borderColor: "var(--green-ring)" }} />
              correct
            </span>
            <span className="x-legend-item">
              <span className="x-swatch" style={{ background: "var(--red-dim)", borderColor: "var(--red-ring)" }} />
              missed
            </span>
          </>
        ) : (
          <>
            <span className="x-legend-item"><span className="x-swatch answered" />answered</span>
            <span className="x-legend-item"><span className="x-swatch unanswered" />not yet</span>
            <span className="x-legend-item"><span className="x-swatch flagged" />flagged</span>
          </>
        )}
      </div>

      {/* Triage in one click. Hidden once nothing is outstanding rather than
          disabled — a dead button is noise. */}
      {outstanding !== null && (
        <button type="button" className="btn-ghost" onClick={() => onJump?.(outstanding)}>
          Next unanswered or flagged →
        </button>
      )}
    </nav>
  );
}

/**
 * The accessible name for one cell. A screen-reader user must get everything the
 * colours convey — position, answered-ness, flag — from the label alone.
 * @param {Object} e navigator entry
 * @param {number} total
 * @param {string|null} status review status, when revealed
 * @returns {string}
 */
function describeCell(e, total, status) {
  const bits = [`Question ${e.number} of ${total}`];
  if (status) {
    bits.push(status === "unanswered" ? "not answered" : status);
  } else {
    bits.push(e.answered ? "answered" : "not answered");
  }
  if (e.flagged) bits.push("flagged for review");
  if (e.current) bits.push("current question");
  return bits.join(", ");
}
