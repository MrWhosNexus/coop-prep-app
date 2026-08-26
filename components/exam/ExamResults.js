"use client";

import { formatPct, questionsToPass, scoreCaveats, isOfficialResult } from "./adapter";
import "./exam.css";

/**
 * The score, the per-section breakdown against the pass mark, and pass/fail.
 *
 * Deliberately understated. A failed mock five weeks out is the most useful thing
 * that can happen to a candidate, and a screen that treats it as a defeat — huge
 * red number, sad copy — teaches avoidance of the exact tool that fixes it. So the
 * number is not red on a fail, the framing is "here is what to fix", and the
 * primary action is always Review, never Retake: retaking a mock you haven't
 * reviewed is just re-measuring the same ignorance.
 *
 * All the judgment here is lib/exam's, relayed rather than second-guessed. It
 * decides `verdict` ("pass" | "fail" | "indicative"), whether a result is
 * `official`, and writes the `caveats` that say why a number is worth less than
 * it looks. This component's whole job on that front is to make sure that honesty
 * is IMPOSSIBLE TO MISS rather than buried in an object nobody renders.
 *
 * The spaced-repetition line is rendered ONLY from `srsScheduled` — the count
 * ExamHost reports after the deck actually took the grades. It is never inferred
 * from the presence of misses, and lib/exam's recommendations no longer promise
 * it, because for most of this app's life the loop was unwired and this screen
 * told learners their misses would come back anyway. A promise the code does not
 * keep is worse than no promise: the learner cannot tell, so they stop studying
 * the very questions they got wrong. Say it only where it has happened.
 *
 * @param {Object} props
 * @param {Object} props.score a lib/exam ExamScore
 * @param {Object} [props.review] a lib/exam review (for its recommendations)
 * @param {number|null} [props.srsScheduled] questions graded into the spaced-repetition
 *   deck by this sitting; null/0 when nothing was scheduled — then claim nothing
 * @param {Function} props.onReview
 * @param {Function} [props.onRetryMissed]
 * @param {Function} [props.onRetake]
 * @param {Function} [props.onExit]
 */
export default function ExamResults({ score, review, srsScheduled = null, onReview, onRetryMissed, onRetake, onExit }) {
  if (!score) return null;

  const official = isOfficialResult(score);
  const caveats = scoreCaveats(score);
  const shortBy = questionsToPass(score);
  const weakest = (score.weakest ?? []).filter((s) => s.asked > 0);

  return (
    <div className="x-results">
      {/* An indicative score is qualified BEFORE the learner reads the number,
          not in a footnote underneath it. */}
      {!official && (
        <div className="x-notice warning" role="status">
          <span className="x-notice-icon" aria-hidden="true">⚠</span>
          <div>
            <div className="x-notice-title">
              This is an indicative score, not a mock result
            </div>
            {/* The engine's caveats are written for a learner. Do not paraphrase. */}
            {caveats.length > 0 ? (
              <ul>
                {caveats.map((c) => <li key={c}>{c}</li>)}
              </ul>
            ) : (
              "This form was not a full-length, blueprint-faithful mock."
            )}
          </div>
        </div>
      )}

      <section className="x-panel x-verdict glass-strong">
        <div>
          <div className={`x-score ${score.passed ? "pass" : "fail"}`}>
            {formatPct(score.rawPct)}
          </div>
          <div className="x-muted" style={{ marginTop: 4 }}>
            {score.correct} of {score.total} correct
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="x-verdict-label">{verdictLabel(score)}</div>
          <p className="x-verdict-sub">
            {score.passed
              ? `That clears this form's ${formatPct(score.passMark.pct)} pass mark (${score.passMark.count} of ${score.total}).`
              : shortBy > 0
                ? `The pass mark is ${formatPct(score.passMark.pct)} — ${score.passMark.count} of ${score.total}. You were ${shortBy} question${shortBy === 1 ? "" : "s"} short.`
                : `The pass mark is ${formatPct(score.passMark.pct)}.`}
          </p>
          {score.timedOut && (
            <p className="x-verdict-sub">
              The clock ran out with {score.unanswered} unanswered. On test day those
              are simply wrong — this is a pacing problem, not a knowledge one, and it
              is worth fixing separately.
            </p>
          )}
          <p className="x-verdict-sub" style={{ marginTop: 8 }}>
            The number above is the least useful thing on this screen. The review —
            what you picked, what was keyed, and why each wrong option is wrong — is
            where the marks come from next time.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn-primary" onClick={onReview}>
            Review every question
          </button>
          {onRetryMissed && score.correct < score.total && (
            <button type="button" className="btn-ghost" onClick={onRetryMissed}>
              Drill what I missed
            </button>
          )}
          {onRetake && <button type="button" className="btn-ghost" onClick={onRetake}>New form</button>}
          {onExit && <button type="button" className="btn-ghost" onClick={onExit}>Done</button>}
        </div>
      </section>

      {/* The engine's own "what to actually go do next", in priority order. */}
      {review?.recommendations?.length > 0 && (
        <section className="x-panel">
          <h2 className="x-h" style={{ fontSize: 16, marginBottom: 10 }}>What to do next</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {review.recommendations.map((r) => (
              <li key={r} className="x-sub" style={{ marginTop: 6 }}>{r}</li>
            ))}
          </ul>
          {/* Reported, not promised: this renders only because the deck already
              took the grades. The count is what was scheduled, and the misses
              are named because "tomorrow" is only true of them. */}
          {srsScheduled > 0 && (
            <p className="x-muted" style={{ marginTop: 12 }}>
              All {srsScheduled} question{srsScheduled === 1 ? "" : "s"} from this sitting went into your
              spaced-repetition deck.
              {score.correct < score.total
                ? ` The ${score.total - score.correct} you missed come back tomorrow; the rest are scheduled further out.`
                : " They are scheduled to come back before you would have forgotten them."}
            </p>
          )}
        </section>
      )}

      {weakest.length > 0 && (
        <section className="x-panel" aria-labelledby="x-sec-h">
          <h2 id="x-sec-h" className="x-h" style={{ fontSize: 16, marginBottom: 4 }}>
            By section
          </h2>
          <p className="x-muted" style={{ marginBottom: 16 }}>
            Weakest first. The line on each bar is the {formatPct(score.passMark.pct)} pass
            mark — sections don&apos;t have to clear it individually, but one far below it
            is where your next study hour belongs.
          </p>

          <div className="x-sections">
            {weakest.map((s) => (
              <div className="x-section-row" key={s.id}>
                <div>
                  <div className="x-section-label">{s.label}</div>
                  <div className="x-meter">
                    <div
                      className={`x-meter-fill ${s.belowPassMark ? "fail" : "pass"}`}
                      style={{ width: `${Math.max(0, Math.min(100, s.pct))}%` }}
                    />
                    <div
                      className="x-meter-mark"
                      style={{ left: `${score.passMark.pct}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="x-section-meta" style={{ marginTop: 4 }}>
                    {s.correct} of {s.asked} correct
                    {s.unanswered > 0 && ` · ${s.unanswered} left blank`}
                    {/* A section the bank could not fill is not a section you
                        failed — say so right where the number is. */}
                    {s.short && ` · the bank was short here, so this is a thin sample`}
                  </div>
                </div>
                <div
                  className="x-section-num"
                  aria-label={`${s.label}: ${s.correct} of ${s.asked}, ${formatPct(s.pct)}`}
                >
                  {formatPct(s.pct)}
                </div>
              </div>
            ))}
          </div>

          {/* Sections the form never asked about are named rather than shown as
              0% — you cannot fail a question you were never asked. */}
          {(score.bySection ?? []).some((s) => s.asked === 0) && (
            <p className="x-muted" style={{ marginTop: 14 }}>
              Not tested on this form:{" "}
              {score.bySection.filter((s) => s.asked === 0).map((s) => s.label).join(", ")}.
            </p>
          )}
        </section>
      )}

      {/* The scaled score, with its approximation stated plainly. lib/exam
          refuses to fabricate an equated score and says so; repeating that here
          is the difference between a number and a claim. */}
      {score.scaledIsApproximate && (
        <p className="x-muted">
          Approximate scaled score: {Math.round(score.scaled)}. {score.scaledNote}
        </p>
      )}
    </div>
  );
}

/**
 * The headline verdict. "Indicative" is its own state: a good score on a form
 * that wasn't a real mock is not a pass, and saying "Pass" there would be the
 * single most misleading thing this app could do.
 * @param {Object} score
 * @returns {string}
 */
function verdictLabel(score) {
  if (score.verdict === "pass") return "Pass";
  if (score.verdict === "fail") return "Not yet a pass";
  return score.passed ? "Above the pass mark — but indicative only" : "Below the pass mark";
}
