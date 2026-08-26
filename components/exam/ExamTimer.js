"use client";

import { useEffect, useRef, useState } from "react";
import {
  exam, bankedRemaining, formatClock, speakClock, timerLevel,
  crossedMilestone, milestoneMessage, WARN_AT_SEC,
} from "./adapter";
import "./exam.css";

/**
 * The exam countdown.
 *
 * Three properties this component is built around, in priority order:
 *
 * 1. HONEST. Nothing escalates before a real five minutes remain (see
 *    timerLevel). No manufactured urgency, no red at the twenty-minute mark to
 *    "keep you moving". A clock that cries wolf is one the learner stops
 *    believing, and believing the clock is exactly the skill a timed mock builds.
 *
 * 2. DRIFT-FREE. This component does not own the clock and cannot corrupt it.
 *    lib/exam derives remaining time from the session's absolute `runningSince`
 *    stamp on every read, so a remount, a slow frame, a throttled background tab
 *    or a props change cannot move it. The `left` state here is a rendering
 *    cache, re-read from the engine every tick — never decremented.
 *
 * 3. QUIET. The clock repaints 4x/second for up to three hours. If the digits sat
 *    in an aria-live region a screen reader would read them aloud ~43,000 times
 *    per form. So the digits are aria-hidden and a separate polite live region
 *    carries ONE sentence at each real milestone (30m / 15m / 5m / 1m / time-up).
 *    test/exam-ui.test.js pins this at exactly 5 announcements over a 3h form.
 *
 * Repainting is owned here rather than by the host: a 250ms tick in ExamHost
 * would re-render the whole exam — stem, options, navigator — four times a
 * second for three hours.
 *
 * @param {Object} props
 * @param {Object} props.session a lib/exam session
 * @param {Function} [props.onExpire] fired ONCE when the clock reaches zero
 * @param {boolean} [props.paused] the ENGINE has stopped this session's clock
 *   (paused, expired, submitted) — see exam-clock.js's clockRunning. It is not
 *   a UI switch: passing true while lib/exam is still draining `runningSince`
 *   freezes the digits over a clock that keeps running, which is a lie the
 *   learner only discovers when it jumps to 0:00. Note the effect still reads
 *   once when paused, so a session that expired while stopped still fires
 *   onExpire rather than sitting on a stale reading.
 * @param {number} [props.intervalMs]
 */
export default function ExamTimer({ session, onExpire, paused = false, intervalMs = 250 }) {
  // Seeded from the session's BANKED elapsed time — a pure read, so the first
  // paint is correct without calling Date.now() during render.
  const [left, setLeft] = useState(() => bankedRemaining(session));
  const prevRef = useRef(bankedRemaining(session));
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);

  const untimed = session?.limitMs === null || session?.limitMs === undefined;

  useEffect(() => {
    if (untimed) return undefined;

    const read = () => {
      const now = Date.now();
      // Always re-derived from the engine. Never `left - interval`.
      const ms = exam.remaining(session, now);

      const milestone = crossedMilestone(prevRef.current, ms);
      if (milestone !== null) setAnnouncement(milestoneMessage(milestone));
      prevRef.current = ms;
      setLeft(ms);

      if (ms !== null && ms <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current?.();
      }
    };

    // A session restored from the store may already be past its deadline; read
    // once immediately rather than waiting a tick to notice.
    read();
    if (paused) return undefined;

    const id = setInterval(read, intervalMs);
    return () => clearInterval(id);
  }, [session, paused, intervalMs, untimed]);

  const level = timerLevel(left);

  return (
    <div className={`x-timer ${level}`}>
      {/* aria-hidden: these digits change 4x/second. The live region below is
          the accessible surface, not this. */}
      <div className="x-timer-v" aria-hidden="true">
        {untimed ? "Untimed" : formatClock(left)}
      </div>
      <div className="x-timer-k" aria-hidden="true">
        {untimed ? "no clock" : level === "expired" ? "time up" : "remaining"}
      </div>

      {/* The real 5-minute warning, on screen as well as spoken. */}
      {level === "warning" && (
        <div className="x-timer-note" aria-hidden="true">
          {Math.ceil(left / 60000)} min left
        </div>
      )}

      {/* One sentence, only at real milestones. `polite` never interrupts a
          learner mid-question. */}
      <div className="x-sr" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* An on-demand reading for anyone who wants the time NOW rather than at
          the next milestone. Not live — read only when queried. */}
      <div className="x-sr" id="x-timer-readout">
        {untimed ? "This session is untimed." : speakClock(left)}
      </div>
    </div>
  );
}

export { WARN_AT_SEC };
