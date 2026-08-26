"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import StepList from "./StepList";
import Feedback from "./Feedback";
import HintLadder from "./HintLadder";
import {
  normalizeStep, normalizeResult, createHintState, revealNextHint, stepScore,
} from "./adapter";

/**
 * The guided-lesson side panel: current step, instruction, progress, Check,
 * hints, and the feedback that does the teaching.
 *
 * Progression lives here; GRADING does not. The panel calls `onCheck(step)` and
 * normalizes whatever comes back through the adapter, so it is indifferent to
 * whether the grader is lib/viz's specMatches, a sheet-cell grader, or a
 * lib/guide runner. See wiringNeeded.
 *
 * @param {Object} props
 * @param {Object} props.lesson {id, title, steps:[...]}
 * @param {Function} props.onCheck (step) => rawResult | Promise<rawResult>
 * @param {boolean} [props.collapsed]
 * @param {Function} [props.onToggleCollapse]
 * @param {Function} [props.onComplete] ({lessonId, score, scores}) => void
 * @param {Function} [props.onStepChange] (step, index) => void
 * @param {boolean} [props.autoAdvance] guided mode: hide the manual Check
 *   button and let a parent watcher drive grading + progression. When false or
 *   absent, behavior is exactly the manual panel that predates this flag.
 * @param {number} [props.autoGradeSignal] a value the parent bumps whenever the
 *   tool state changes; each change silently re-checks the current step and, on
 *   a pass, clears it and advances.
 */
export default function GuidePanel({
  lesson,
  onCheck,
  collapsed = false,
  onToggleCollapse,
  onComplete,
  onStepChange,
  autoAdvance = false,
  autoGradeSignal = 0,
}) {
  const steps = useMemo(
    () => (lesson?.steps ?? []).map(normalizeStep).filter(Boolean),
    [lesson]
  );

  const [index, setIndex] = useState(0);
  const [maxReached, setMaxReached] = useState(0); // frontier — stepping back must not re-lock
  const [results, setResults] = useState({});     // checkpoint -> GuideResult
  const [completed, setCompleted] = useState({}); // checkpoint -> true
  const [hints, setHints] = useState({});         // checkpoint -> hint state
  const [attempts, setAttempts] = useState({});   // checkpoint -> failed checks
  const [scores, setScores] = useState({});       // checkpoint -> 0..100
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const headingRef = useRef(null);

  const step = steps[index] ?? null;
  const cp = step?.checkpoint;
  // normalizeStep falls `context` back to step.target, which is now a spotlight
  // OBJECT on every real lesson — render only a real string, never an object.
  const contextText = typeof step?.context === "string" ? step.context : null;
  const hintState = (cp && hints[cp]) || createHintState();
  const result = cp ? results[cp] : null;
  const isLast = index === steps.length - 1;
  const doneCount = steps.filter((s) => completed[s.checkpoint]).length;
  const lessonDone = steps.length > 0 && doneCount === steps.length;

  /* ── grading ─────────────────────────────────────────────────────────── */
  const check = useCallback(async () => {
    if (!step || checking || completed[step.checkpoint]) return;
    setChecking(true);
    setError("");
    try {
      const raw = await onCheck?.(step);
      const norm = normalizeResult(raw);
      setResults((r) => ({ ...r, [step.checkpoint]: norm }));

      if (norm.pass) {
        const failed = attempts[step.checkpoint] ?? 0;
        const hs = hints[step.checkpoint] ?? createHintState();
        setScores((s) => ({ ...s, [step.checkpoint]: stepScore(hs, failed) }));
        setCompleted((c) => ({ ...c, [step.checkpoint]: true }));
      } else {
        setAttempts((a) => ({ ...a, [step.checkpoint]: (a[step.checkpoint] ?? 0) + 1 }));
      }
    } catch (e) {
      // A grader that throws is our bug, not the learner's. Say so plainly and
      // never let it read as their mistake.
      setError(e?.message ? `The checker hit an error: ${e.message}` : "The checker hit an error.");
    } finally {
      setChecking(false);
    }
  }, [step, checking, completed, onCheck, attempts, hints]);

  /* ── auto-grade (guided mode) ─────────────────────────────────────────
     A silent pass-only check: it never records a failed attempt (intermediate
     edits are not mistakes) and never surfaces an error, so it is safe to run
     on every keystroke's worth of tool change. On a pass it clears the step
     exactly as a manual Check would. */
  const autoCheck = useCallback(async () => {
    if (!step || checking || completed[step.checkpoint]) return;
    try {
      const raw = await onCheck?.(step);
      const norm = normalizeResult(raw);
      if (!norm.pass) return;
      setResults((r) => ({ ...r, [step.checkpoint]: norm }));
      const failed = attempts[step.checkpoint] ?? 0;
      const hs = hints[step.checkpoint] ?? createHintState();
      setScores((s) => ({ ...s, [step.checkpoint]: stepScore(hs, failed) }));
      setCompleted((c) => ({ ...c, [step.checkpoint]: true }));
    } catch {
      // A grader throw in auto mode is not the learner's problem and must not
      // interrupt them; the manual Check path still reports it.
    }
  }, [step, checking, completed, onCheck, attempts, hints]);

  useEffect(() => {
    if (!autoAdvance) return;
    autoCheck();
  }, [autoAdvance, autoGradeSignal, autoCheck]);

  /* ── auto-advance: once a step clears in guided mode, move on after a beat
     so the pass feedback is seen. Once per checkpoint (a ref guard), so the
     final step fires onComplete exactly once. */
  const autoAdvancedRef = useRef(new Set());
  useEffect(() => {
    if (!autoAdvance || !step) return undefined;
    const cpId = step.checkpoint;
    if (!completed[cpId] || autoAdvancedRef.current.has(cpId)) return undefined;
    autoAdvancedRef.current.add(cpId);
    const t = setTimeout(() => nextRef.current(), 850);
    return () => clearTimeout(t);
  }, [autoAdvance, completed, step]);

  /* ── Ctrl/Cmd+Enter checks from anywhere, including inside the tool ───── */
  useEffect(() => {
    if (collapsed) return undefined;
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (autoAdvance) autoCheck(); else check();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [check, autoCheck, autoAdvance, collapsed]);

  /* ── advancing ───────────────────────────────────────────────────────── */
  const goTo = useCallback(
    (i) => {
      if (i < 0 || i >= steps.length) return;
      setIndex(i);
      setMaxReached((m) => Math.max(m, i));
      setError("");
      onStepChange?.(steps[i], i);
      // Move focus to the new step's heading so a keyboard user is not dumped
      // back at the top of the document.
      requestAnimationFrame(() => headingRef.current?.focus());
    },
    [steps, onStepChange]
  );

  const next = useCallback(() => {
    if (isLast) {
      const all = Object.values({ ...scores });
      const avg = all.length ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : 0;
      onComplete?.({ lessonId: lesson?.id, score: avg, scores });
    } else {
      goTo(index + 1);
    }
  }, [isLast, index, goTo, onComplete, lesson, scores]);

  // The auto-advance timer fires through a ref so its effect need not depend on
  // `next`'s identity (which changes with scores/index every render).
  const nextRef = useRef(next);
  useEffect(() => { nextRef.current = next; }, [next]);

  const reveal = useCallback(() => {
    if (!step) return;
    setHints((h) => ({
      ...h,
      [step.checkpoint]: revealNextHint(h[step.checkpoint] ?? createHintState(), step.hints),
    }));
  }, [step]);

  /* ── collapsed rail ──────────────────────────────────────────────────── */
  if (collapsed) {
    return (
      <aside className="guide-rail" aria-label="Guided lesson (collapsed)">
        <button
          type="button"
          className="guide-rail-btn"
          onClick={onToggleCollapse}
          aria-expanded="false"
          title="Show the guide"
        >
          <span className="guide-rail-chevron" aria-hidden="true">‹</span>
          <span className="guide-rail-text">Guide</span>
          <span className="guide-rail-count mono" aria-hidden="true">
            {doneCount}/{steps.length}
          </span>
          <span className="guide-sr-only">
            Show the guide. Step {index + 1} of {steps.length}.
          </span>
        </button>
      </aside>
    );
  }

  if (!step) {
    return (
      <aside className="guide-panel glass" aria-label="Guided lesson">
        <p className="guide-empty">No guided steps for this lesson yet.</p>
      </aside>
    );
  }

  const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;

  return (
    <aside className="guide-panel glass" aria-label="Guided lesson">
      {/* ── header ── */}
      <header className="guide-head">
        <div className="guide-head-top">
          <span className="section-label">Guided lesson</span>
          <button
            type="button"
            className="guide-collapse-btn"
            onClick={onToggleCollapse}
            aria-expanded="true"
            title="Hide the guide"
          >
            <span aria-hidden="true">›</span>
            <span className="guide-sr-only">Hide the guide</span>
          </button>
        </div>
        {lesson?.title && <h3 className="guide-lesson-title">{lesson.title}</h3>}
        <div className="guide-progress">
          <div className="progress-track">
            <div
              className="progress-fill guide-progress-fill"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={doneCount}
              aria-valuemin={0}
              aria-valuemax={steps.length}
              aria-label={`${doneCount} of ${steps.length} steps cleared`}
            />
          </div>
          <span className="guide-progress-text mono">
            {doneCount}/{steps.length}
          </span>
        </div>
      </header>

      <StepList
        steps={steps}
        currentIndex={index}
        maxReached={maxReached}
        completed={completed}
        onJump={goTo}
      />

      {/* ── current step ── */}
      <div className="guide-body">
        <div className="guide-step-head">
          <span className="badge badge-muted">
            Step {index + 1} of {steps.length}
          </span>
          {/* What you're working on — without it the instruction is unmoored. */}
          {contextText && (
            <span className="guide-context" title={`Working in: ${contextText}`}>
              <span className="guide-context-dot" aria-hidden="true" />
              {contextText}
            </span>
          )}
        </div>

        <h4 className="guide-step-heading" ref={headingRef} tabIndex={-1}>
          {step.title}
        </h4>
        <p className="guide-instruction">{step.instruction}</p>

        {error && (
          <p className="guide-error" role="alert">
            {error}
          </p>
        )}

        {!autoAdvance && (
          <div className="guide-actions">
            <button
              type="button"
              className="btn-primary guide-check-btn"
              onClick={check}
              disabled={checking || !!completed[cp]}
            >
              {completed[cp] ? "Cleared" : checking ? "Checking…" : "Check my work"}
              {!completed[cp] && !checking && (
                <kbd className="guide-kbd" aria-hidden="true">
                  ⌃⏎
                </kbd>
              )}
            </button>
          </div>
        )}
        {autoAdvance && !completed[cp] && (
          <p className="guide-auto-hint" aria-live="polite">
            Work in the tool. This checks itself and moves on when the step is right.
          </p>
        )}

        <Feedback
          result={result}
          checking={checking}
          hintState={hintState}
          attempts={attempts[cp] ?? 0}
          score={scores[cp]}
          isLastStep={isLast}
          onNext={completed[cp] ? next : undefined}
        />

        <HintLadder
          hints={step.hints}
          state={hintState}
          onReveal={reveal}
          disabled={!!completed[cp]}
        />
      </div>

      {lessonDone && (
        <footer className="guide-done-footer" aria-live="polite">
          All {steps.length} steps cleared.
        </footer>
      )}
    </aside>
  );
}
