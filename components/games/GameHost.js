"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { scoreRound } from "@/lib/games/scoring";
import "./games.css";

/**
 * Countdown timer for timed games. `seconds = null` disables the clock
 * entirely -- every game here works untimed, because a clock is a retention
 * tool, not a requirement.
 *
 * The clock restarts whenever `seconds` or `runId` changes, so callers
 * advance an item by changing runId rather than by firing a reset effect.
 * Remaining time is computed from a real deadline rather than by counting
 * interval ticks, so a throttled background tab cannot gift the learner
 * extra seconds.
 *
 * @param {number|null} seconds total time, or null for untimed
 * @param {() => void} [onExpire] fired once when the clock hits 0
 * @param {{running?: boolean, runId?: string|number}} [opts]
 * @returns {{left: number|null, expired: boolean}}
 */
export function useCountdown(seconds, onExpire, opts = {}) {
  const { running = true, runId = 0 } = opts;
  const cb = useRef(onExpire);
  useEffect(() => { cb.current = onExpire; }, [onExpire]);

  const key = `${seconds}|${runId}`;
  const [prevKey, setPrevKey] = useState(key);
  const [left, setLeft] = useState(seconds);
  const [expired, setExpired] = useState(false);

  // Reset during render when the run changes -- React's documented
  // "adjusting state when a prop changes" pattern. Doing this in an effect
  // instead would render one frame of the previous item's clock.
  if (prevKey !== key) {
    setPrevKey(key);
    setLeft(seconds);
    setExpired(false);
  }

  useEffect(() => {
    if (seconds === null || !running || expired) return undefined;
    const deadline = Date.now() + seconds * 1000;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        setExpired(true);
        cb.current?.();
      }
    }, 250);
    return () => clearInterval(id);
  }, [seconds, running, expired, key]);

  return { left, expired };
}

/**
 * Track per-item elapsed time. Games call mark() when an item is shown and
 * elapsed() when it is answered, so scoring gets a real latency -- which is
 * evidence of retrieval strength, not just a number for the leaderboard.
 * @returns {{mark: () => void, elapsed: () => number}}
 */
export function useItemTimer() {
  // Not seeded with Date.now(): reading the clock during render is impure
  // and would make the first item's latency depend on render timing.
  const t = useRef(null);
  const mark = useCallback(() => { t.current = Date.now(); }, []);
  const elapsed = useCallback(() => (t.current === null ? 0 : Date.now() - t.current), []);
  return { mark, elapsed };
}

function fmtTime(s) {
  if (s === null || s === undefined) return "--";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : String(r);
}

/**
 * A single stat readout in the top bar.
 * @param {{label: string, value: string|number, className?: string}} props
 */
function Stat({ label, value, className = "" }) {
  return (
    <div className={`g-stat ${className}`}>
      <span className="g-stat-v">{value}</span>
      <span className="g-stat-k">{label}</span>
    </div>
  );
}

/**
 * The end-of-round screen.
 *
 * Deliberately not a trophy case: it leads with what you got wrong and what
 * the right answer was, because the post-round review is where the learning
 * that the round set up actually lands. Score is present but secondary.
 *
 * @param {{summary: object, review?: object[], onReplay?: Function, onExit?: Function}} props
 */
export function GameResults({ summary, review = [], onReplay, onExit }) {
  const pct = summary.total ? Math.round(summary.accuracy * 100) : 0;
  const missed = review.filter((r) => !r.correct);
  const note = missed.length === 0 && summary.total > 0
    ? "Clean round. These concepts are scheduled further out now — you'll see them again right before you'd forget them."
    : missed.length
      ? `${missed.length} to revisit. They're queued for tomorrow, which is exactly when a repeat does the most good.`
      : "";

  return (
    <div className="g-panel g-results scalein">
      <div className="g-eyebrow">Round complete</div>
      <div className="g-results-score">{pct}%</div>
      <div className="g-results-grid">
        <Stat label="Correct" value={`${summary.correct}/${summary.total}`} />
        <Stat label="Points" value={summary.points} />
        <Stat label="Best streak" value={summary.bestStreak} />
        {summary.medianMs !== null && summary.medianMs !== undefined && (
          <Stat label="Median" value={`${(summary.medianMs / 1000).toFixed(1)}s`} />
        )}
      </div>
      {note && <p className="g-results-note">{note}</p>}
      <div className="g-actions">
        {onReplay && <button type="button" className="btn-primary" onClick={onReplay}>New round</button>}
        {onExit && <button type="button" className="btn-ghost" onClick={onExit}>Done</button>}
      </div>

      {missed.length > 0 && (
        <div className="g-review">
          <div className="g-eyebrow" style={{ marginTop: 8 }}>Worth a second look</div>
          {missed.map((r, i) => (
            <div className="g-review-item" key={r.conceptId ?? i}>
              <div className="g-review-q">{r.prompt}</div>
              <div className="g-review-a">
                <strong>{r.answer}</strong>
                {r.explanation ? ` — ${r.explanation}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The shell every game renders inside: title, progress, live score, an
 * optional clock, and the results screen. Games own their content; the host
 * owns the chrome and the summary, so all five stay consistent and none of
 * them re-implement scoring.
 *
 * Guided layer (all optional, opt-in): `objective` prints a short banner
 * above the body. `guided` + `onAdvance` turn on auto-advance -- the host
 * already receives every answered item through `events` (each game reports
 * its own outcomes there for scoring), so it watches for a new event and,
 * when guided, fires `onAdvance` itself the moment that event is correct.
 * No game file has to call anything new: the signal already existed, this
 * just listens to it. `data-guide-target` anchors let the spotlight overlay
 * (a different track) point at this chrome from a lesson step.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {number} props.index 0-based position in the round
 * @param {number} props.total items in the round
 * @param {Array<{correct: boolean, ms?: number}>} [props.events] answered so far
 * @param {number|null} [props.secondsLeft] null hides the clock
 * @param {object|null} [props.summary] when set, the results screen replaces the body
 * @param {object[]} [props.review] per-item review rows for the results screen
 * @param {Function} [props.onReplay]
 * @param {Function} [props.onExit]
 * @param {string} [props.objective] short step objective shown above the body
 * @param {boolean} [props.guided] when true, a new correct event auto-advances
 * @param {Function} [props.onAdvance] fired with the triggering event on auto-advance
 * @param {import("react").ReactNode} props.children
 */
export default function GameHost({
  title,
  subtitle,
  index,
  total,
  events = [],
  secondsLeft = null,
  summary = null,
  review = [],
  onReplay,
  onExit,
  objective = null,
  guided = false,
  onAdvance,
  children,
}) {
  const live = useMemo(() => scoreRound(events), [events]);
  const pct = total > 0 ? ((summary ? total : index) / total) * 100 : 0;

  const seenCount = useRef(events.length);
  const [justAdvanced, setJustAdvanced] = useState(false);
  useEffect(() => {
    const grew = events.length > seenCount.current;
    seenCount.current = events.length;
    if (!grew || !guided) return;
    const last = events[events.length - 1];
    if (!last?.correct) return;
    setJustAdvanced(true);
    const id = setTimeout(() => setJustAdvanced(false), 700);
    onAdvance?.(last);
    return () => clearTimeout(id);
  }, [events, guided, onAdvance]);

  if (summary) {
    return (
      <div className="g-host fadein">
        <GameResults summary={summary} review={review} onReplay={onReplay} onExit={onExit} />
      </div>
    );
  }

  return (
    <div className="g-host">
      <div className="g-bar">
        <div data-guide-target="game-prompt">
          <div className="g-bar-title">{title}</div>
          {subtitle && <div className="g-bar-sub">{subtitle}</div>}
        </div>
        <div className="g-bar-spacer" />
        <Stat label="Item" value={`${Math.min(index + 1, total)}/${total}`} />
        <div data-guide-target="game-score">
          <Stat label="Score" value={live.points} />
        </div>
        {live.finalStreak > 1 && <Stat label="Streak" value={`${live.finalStreak}×`} />}
        {secondsLeft !== null && (
          <Stat
            label="Time"
            value={fmtTime(secondsLeft)}
            className={`g-timer ${secondsLeft <= 5 ? "low" : ""}`}
          />
        )}
        <div
          className={`g-guide-advance ${justAdvanced ? "hit" : ""}`}
          data-guide-target="game-submit"
          aria-hidden="true"
        />
        {onExit && (
          <button type="button" className="btn-ghost" onClick={onExit} aria-label="Exit game">Exit</button>
        )}
      </div>

      <div className="g-progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className="g-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      {objective && (
        <div className="g-objective scalein">
          <span className="g-objective-eyebrow">Step</span>
          <span className="g-objective-text">{objective}</span>
        </div>
      )}

      <div className="g-body" data-guide-target="game-choices">
        {children}
      </div>
    </div>
  );
}
