"use client";

import { diffTitle, diffDetail, formatSide, shelfLabel, scoreBreakdown } from "./adapter";

/**
 * Renders a grader result as teaching feedback.
 *
 * The design rule this component exists to enforce: a check that does not pass
 * is a POSITION, not a verdict. It says which field, which shelf, which cell,
 * and what is there instead. There is no red X and no "incorrect" — the learner
 * already knows it didn't pass; what they need is the next move.
 *
 * @param {Object} props
 * @param {Object|null} props.result normalized GuideResult from the adapter
 * @param {boolean} [props.checking] a check is in flight
 * @param {Object} [props.hintState] {revealed, spent} — feeds the score readout
 * @param {number} [props.attempts] failed checks on this step
 * @param {number} [props.score] final score, shown on pass
 * @param {boolean} [props.isLastStep]
 * @param {Function} [props.onNext] advance; omit to hide the advance button
 */
export default function Feedback({
  result,
  checking = false,
  hintState,
  attempts = 0,
  score,
  isLastStep = false,
  onNext,
}) {
  if (checking) {
    return (
      <div className="guide-feedback guide-feedback-checking" role="status" aria-live="polite">
        <span className="guide-spinner-sm" aria-hidden="true" />
        <span>Checking your work…</span>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="guide-feedback guide-feedback-idle" aria-live="polite">
        <p className="guide-idle-text">
          Build it in the tool, then check. Checking is free — it never costs you score.
        </p>
      </div>
    );
  }

  if (result.pass) {
    return <PassPanel result={result} hintState={hintState} attempts={attempts} score={score} isLastStep={isLastStep} onNext={onNext} />;
  }

  return (
    <div className="guide-feedback guide-feedback-diff" aria-live="polite">
      <header className="guide-diff-head">
        <h4 className="guide-diff-heading">
          {result.diff.length === 1 ? "One thing left" : `${result.diff.length} things left`}
        </h4>
        {attempts > 1 && <span className="guide-attempt-count">check {attempts}</span>}
      </header>

      {result.message && <p className="guide-diff-message">{result.message}</p>}

      <ul className="guide-diff-list">
        {result.diff.map((entry, i) => (
          <DiffRow key={`${entry.kind}-${entry.field ?? entry.ref ?? i}`} entry={entry} />
        ))}
      </ul>
    </div>
  );
}

/**
 * One line of the diff. Structure earns its keep here: because the adapter
 * recovered {field, shelf, ref}, we can render the field as a PILL that looks
 * like the thing the learner drags, and point it at a named shelf.
 * @param {{entry:Object}} props
 */
function DiffRow({ entry }) {
  return (
    <li className={`guide-diff-row guide-diff-${entry.kind}`}>
      <span className="guide-diff-marker" aria-hidden="true" />
      <div className="guide-diff-body">
        <div className="guide-diff-title">{renderTitle(entry)}</div>
        <p className="guide-diff-detail">{diffDetail(entry)}</p>
        {entry.kind === "cell" && <CellCompare entry={entry} />}
      </div>
    </li>
  );
}

/**
 * The headline, rendered as structure rather than a sentence where we can.
 * Falls back to the adapter's prose for kinds we have no visual grammar for.
 * @param {{entry:Object}} entry
 */
function renderTitle(entry) {
  if (entry.kind === "shelf") {
    return (
      <>
        <span className="guide-pill">{entry.aggregation ? `${entry.aggregation}(${entry.field})` : entry.field}</span>
        <span className="guide-arrow" aria-hidden="true">→</span>
        <span className="guide-shelf-name">{shelfLabel(entry.shelf)}</span>
      </>
    );
  }
  if (entry.kind === "filter") {
    return (
      <>
        <span className="guide-pill">{entry.field}</span>
        <span className="guide-arrow" aria-hidden="true">→</span>
        <span className="guide-shelf-name">Filters</span>
      </>
    );
  }
  if (entry.kind === "mark") {
    return (
      <>
        <span className="guide-shelf-name">Mark type</span>
        <span className="guide-arrow" aria-hidden="true">→</span>
        <span className="guide-pill">{entry.expected}</span>
      </>
    );
  }
  return <span className="guide-shelf-name">{diffTitle(entry)}</span>;
}

/**
 * Side-by-side for cell graders. Seeing 0.86 next to 0.5625 teaches more than
 * any sentence about it — the learner spots "that's the White rate, not Black"
 * themselves.
 * @param {{entry:Object}} props
 */
function CellCompare({ entry }) {
  return (
    <div className="guide-cell-compare">
      <div className="guide-cell-side">
        <span className="guide-cell-label">{entry.ref} now</span>
        <span className="guide-cell-value guide-cell-actual mono">{formatSide(entry.actual)}</span>
      </div>
      <div className="guide-cell-side">
        <span className="guide-cell-label">should be</span>
        <span className="guide-cell-value guide-cell-expected mono">{formatSide(entry.expected)}</span>
      </div>
    </div>
  );
}

/**
 * Completion. The brief: celebrate, but do not be saccharine.
 *
 * So: no confetti, no "Amazing!!". State plainly that it landed, show the score
 * with its arithmetic visible so the number is never a mystery, and put the
 * focus on the next step. Earned, then out of the way.
 */
function PassPanel({ result, hintState, attempts, score, isLastStep, onNext }) {
  const breakdown = scoreBreakdown(hintState ?? { spent: 0 }, attempts);
  const showBreakdown = typeof score === "number" && breakdown.length > 1;

  return (
    <div className="guide-feedback guide-feedback-pass scalein" aria-live="polite">
      <header className="guide-pass-head">
        <span className="guide-pass-check" aria-hidden="true">
          <svg viewBox="0 0 20 20" width="14" height="14">
            <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h4 className="guide-pass-heading">{result.message || "That's the one."}</h4>
        {typeof score === "number" && <span className="guide-score mono">{score}</span>}
      </header>

      {showBreakdown && (
        <ul className="guide-score-breakdown">
          {breakdown.map((b) => (
            <li key={b.label}>
              <span>{b.label}</span>
              <span className={`mono ${b.delta < 0 ? "guide-delta-neg" : ""}`}>
                {b.delta > 0 ? b.delta : `−${Math.abs(b.delta)}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {onNext && (
        <button type="button" className="btn-primary guide-next-btn" onClick={onNext} autoFocus>
          {isLastStep ? "Finish lesson" : "Next step"}
        </button>
      )}
    </div>
  );
}
