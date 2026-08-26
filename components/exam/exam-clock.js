/**
 * Who is allowed to stop the exam clock: the engine, and nothing else.
 *
 * ExamHost used to gate the countdown on its own UI phase
 * (`paused={phase !== "exam"}`), which meant opening the submit-confirmation
 * panel froze the display. The engine does not care what panel is on screen —
 * lib/exam derives remaining time from the session's absolute `runningSince`
 * stamp, and a mock cannot be paused at all (MODES.mock.pausable === false).
 * So the wall clock kept draining behind a display stuck at 3:00, and "Back to
 * questions" jumped the learner straight to 0:00 and an auto-submit. Time the
 * learner believed they had, gone — on a three-hour Series 65 mock.
 *
 * The rule this module exists to hold: **the UI may render the clock, it may
 * not decide it.** A phase is a fact about the screen; running is a fact about
 * the session. Ask the session.
 *
 * It lives in its own module, rather than inside ExamHost.js, for the reason
 * components/settings/endpoints-ui.js and components/dashboard-scope.js do:
 * node has no JSX loader, so a decision worth asserting on has to sit
 * somewhere test/exam-ui.test.js can import.
 *
 * Per components/exam/adapter.js's contract, lib/exam is reached only through
 * the adapter — never imported here directly.
 */

import { STATUS } from "./adapter.js";

/**
 * Is the ENGINE draining this session's clock right now?
 *
 * True only while lib/exam's `advance` would actually bank time: the session is
 * ACTIVE and has a running stretch open. That makes every non-running state
 * fall out of the engine's own bookkeeping rather than a list kept in the UI —
 * paused (a pausable mode, explicitly paused), expired (the clock ran out),
 * submitted (results and review, which must never tick), and no session at all.
 *
 * Note what is deliberately NOT consulted: the phase. "confirm" is running,
 * because the session is; "results" is not, because the session was submitted.
 *
 * @param {Object|null|undefined} session a lib/exam session
 * @returns {boolean}
 */
export function clockRunning(session) {
  if (!session) return false;
  return session.status === STATUS.ACTIVE && Boolean(session.runningSince);
}
