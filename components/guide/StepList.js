"use client";

/**
 * Step overview: where you are, what you've cleared, what's ahead.
 *
 * Jumping is allowed backwards (revisit anything you've reached) but not
 * forwards past the frontier — the steps build on each other, and a lesson that
 * lets you skip to the end is a lesson that teaches nothing. Locked steps stay
 * visible so the shape of the work is legible from the start.
 *
 * Reachability is measured against `maxReached`, not `currentIndex`: stepping
 * back to re-read step 1 must not re-lock the step you were just on.
 *
 * @param {Object} props
 * @param {Array<Object>} props.steps normalized GuideSteps
 * @param {number} props.currentIndex
 * @param {number} [props.maxReached] furthest step reached; defaults to current
 * @param {Object<string, boolean>} props.completed keyed by step.checkpoint
 * @param {Function} props.onJump (index) => void
 */
export default function StepList({ steps = [], currentIndex = 0, maxReached, completed = {}, onJump }) {
  const frontier = Math.max(maxReached ?? currentIndex, currentIndex);
  return (
    <nav className="guide-steplist" aria-label="Lesson steps">
      <ol>
        {steps.map((step, i) => {
          const done = !!completed[step.checkpoint];
          const current = i === currentIndex;
          // Reachable: anything cleared, or anything up to the frontier.
          const reachable = done || i <= frontier;
          const state = current ? "current" : done ? "done" : reachable ? "open" : "locked";

          return (
            <li key={step.id}>
              <button
                type="button"
                className={`guide-step-item guide-step-${state}`}
                onClick={() => reachable && onJump?.(i)}
                disabled={!reachable}
                aria-current={current ? "step" : undefined}
                title={reachable ? step.title : "Clear the steps before this one first"}
              >
                <span className={`guide-step-tick guide-tick-${state}`} aria-hidden="true">
                  {done ? (
                    <svg viewBox="0 0 20 20" width="11" height="11">
                      <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span className="guide-step-num mono">{i + 1}</span>
                  )}
                </span>
                <span className="guide-step-title">{step.title}</span>
                <span className="guide-sr-only">
                  {done ? " — cleared" : current ? " — current step" : " — not yet reached"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
