"use client";

import { useMemo, useRef, useState } from "react";
import { filterReview, reviewCounts, ReviewFilter, optionVerdict } from "./adapter";
import "./exam.css";

/**
 * Item-by-item review: what you answered, what was keyed, and — the whole point —
 * the per-option explanation of WHY each distractor is wrong.
 *
 * ── Why this component gets the effort ─────────────────────────────────────
 *
 * A score tells a candidate they got 68%. It does not tell them they picked "the
 * SEC" over "the MSRB" because they'd conflated rule-WRITING with rule-ENFORCEMENT
 * — which is the actual defect, is one sentence to fix, and will otherwise cost
 * them the same mark again in four other guises. The banks in data/certs/ carry an
 * explanation for EVERY option, right and wrong, and lib/exam/review.js is built
 * per-OPTION precisely so that corpus survives to the UI. All of that effort dies
 * here if this component renders only the key and the pick.
 *
 * Three deliberate decisions:
 *
 *   1. EVERY option's explanation renders — not just the chosen one and the key.
 *      The distractor you didn't fall for this time is the one that gets you in
 *      October.
 *   2. Explanations are body copy — not tooltips, not accordions, not
 *      hover-to-reveal. Anything a learner must click to see is a thing they will
 *      not read.
 *   3. It opens on WRONG, not ALL. Nobody needs to scroll their correct answers.
 *      (Correct is one click away — confirming you were right for the right reason
 *      has real value, it just isn't the default need.)
 *
 * @param {Object} props
 * @param {Object} props.review a lib/exam review from buildReview(session)
 * @param {Function} [props.onBack]
 */
export default function ExamReview({ review, onBack }) {
  // Memoized so the `?? []` fallback doesn't mint a new array each render and
  // invalidate every downstream memo.
  const items = useMemo(() => review?.items ?? [], [review]);
  const counts = useMemo(() => reviewCounts(items), [items]);

  // Open on the wrong answers — unless there are none, in which case a filter
  // showing an empty list is a strange way to congratulate someone.
  const [filter, setFilter] = useState(() =>
    counts.wrong > 0 ? ReviewFilter.WRONG : counts.skipped > 0 ? ReviewFilter.SKIPPED : ReviewFilter.ALL
  );
  const listRef = useRef(null);

  const shown = useMemo(() => filterReview(items, filter), [items, filter]);

  const chips = [
    { id: ReviewFilter.WRONG, label: "Got wrong", n: counts.wrong },
    { id: ReviewFilter.SKIPPED, label: "Skipped", n: counts.skipped },
    { id: ReviewFilter.FLAGGED, label: "Flagged", n: counts.flagged },
    { id: ReviewFilter.CORRECT, label: "Correct", n: counts.correct },
    { id: ReviewFilter.ALL, label: "All", n: counts.all },
  ];

  return (
    <div className="x-review">
      <section className="x-panel">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 className="x-h" style={{ fontSize: 17 }}>Review</h2>
            <p className="x-muted" style={{ marginTop: 3 }}>
              This is where the marks are. Read the wrong ones — including why the
              options you didn&apos;t pick are wrong.
            </p>
          </div>
          {onBack && (
            <button type="button" className="btn-ghost" onClick={onBack}>
              ← Back to results
            </button>
          )}
        </div>

        <div className="x-filters" style={{ marginTop: 16 }} role="group" aria-label="Filter review">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              className="x-chip"
              aria-pressed={filter === c.id}
              onClick={() => {
                setFilter(c.id);
                listRef.current?.focus();
              }}
            >
              {c.label} <span className="x-chip-n">{c.n}</span>
            </button>
          ))}
        </div>
      </section>

      {/* The filtered count is announced, so a screen-reader user knows the list
          changed under them. */}
      <div className="x-sr" role="status" aria-live="polite">
        Showing {shown.length} question{shown.length === 1 ? "" : "s"}.
      </div>

      <div
        ref={listRef}
        tabIndex={-1}
        style={{ display: "flex", flexDirection: "column", gap: 14, outline: "none" }}
      >
        {shown.length === 0 ? (
          <div className="x-panel x-empty">
            {filter === ReviewFilter.WRONG
              ? "Nothing wrong on this form. Worth checking the others to confirm you got them right for the right reason."
              : "Nothing here."}
          </div>
        ) : (
          shown.map((r) => <ReviewItem key={r.id} r={r} />)
        )}
      </div>
    </div>
  );
}

/**
 * One reviewed question.
 * @param {Object} props
 * @param {Object} props.r a lib/exam ReviewItem
 */
function ReviewItem({ r }) {
  return (
    <article className="x-panel x-rev-item" aria-labelledby={`x-rev-${r.id}`}>
      <div className="x-rev-head">
        <span className="x-eyebrow">Question {r.index + 1}</span>
        <OutcomeBadge status={r.status} />
        {r.sectionLabel && <span className="badge badge-muted">{r.sectionLabel}</span>}
        {r.flagged && <span className="badge badge-gold">You flagged this</span>}
      </div>

      <h3 className="x-rev-stem" id={`x-rev-${r.id}`}>{r.q}</h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {r.options.map((o) => {
          const verdict = optionVerdict(o);
          return (
            <div className={`x-rev-opt ${verdict}`} key={o.index}>
              <span className="x-notice-icon" aria-hidden="true">
                {o.isCorrect ? "✓" : o.chosen ? "✕" : "·"}
              </span>
              <div className="x-rev-opt-body">
                <div className="x-rev-opt-text">{o.text}</div>

                {/* The verdict in words as well as colour — the review is
                    unusable for a colourblind learner otherwise. */}
                <div className="x-rev-opt-tags">
                  {o.isCorrect && <span className="badge badge-green">Correct answer</span>}
                  {o.chosen && !o.isCorrect && <span className="badge badge-red">You chose this</span>}
                  {o.chosen && o.isCorrect && <span className="badge badge-green">You chose this</span>}
                </div>

                {/* The payload. Always visible, for EVERY option. */}
                {o.explanation && <div className="x-why">{o.explanation}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {r.explanation && (
        <div className="x-rev-note">
          <div className="x-rev-note-k">The principle</div>
          {r.explanation}
        </div>
      )}
    </article>
  );
}

/**
 * The outcome badge. "Skipped" is its own state, never folded into "wrong":
 * running out of time is a pacing problem and not knowing is a content problem,
 * and they call for completely different fixes.
 * @param {Object} props
 * @param {string} props.status "correct" | "incorrect" | "unanswered"
 */
function OutcomeBadge({ status }) {
  if (status === "correct") return <span className="badge badge-green">Correct</span>;
  if (status === "unanswered") return <span className="badge badge-muted">Skipped — no answer</span>;
  return <span className="badge badge-red">Wrong</span>;
}
