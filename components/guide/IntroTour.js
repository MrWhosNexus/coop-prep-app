"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import "./animation.css";
import { planTransition } from "@/lib/guide/choreography";
import { TOUR_STEPS, initialTourState, tourReducer, tourStepTarget } from "@/lib/guide/tour";

/**
 * First-run animated tour: walks TOUR_STEPS with a spotlight-style highlight
 * that moves between anchors via choreography.planTransition. The ring is
 * laid out at its destination rect (`base`, set once, never animated); the
 * move from the previous anchor plays as a transform settling to identity,
 * exactly the compositor-first contract animation.css's `.ga-ring` expects.
 *
 * A step with no anchor (the opening/closing cards) shows the card alone,
 * no ring.
 *
 * @param {Object} props
 * @param {boolean} props.active
 * @param {Function} props.onFinish () => void, called once on the last Next/Done or on Skip
 * @param {Function} [props.measure] (node) => {top,left,width,height}|null,
 *   injectable so tests can run under happy-dom, which lays nothing out.
 */
export default function IntroTour({ active, onFinish, measure }) {
  const [state, dispatch] = useReducer(tourReducer, undefined, initialTourState);
  const [plan, setPlan] = useState(null);
  const [currentRect, setCurrentRect] = useState(null);
  const [settled, setSettled] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const prevRectRef = useRef(null);
  const prevActiveRef = useRef(active);
  const finishedRef = useRef(false);

  const step = TOUR_STEPS[state.index] ?? null;

  const defaultMeasure = useMemo(
    () => (node) => {
      if (!node || typeof node.getBoundingClientRect !== "function") return null;
      const r = node.getBoundingClientRect();
      return { top: r.top, left: r.left, width: r.width, height: r.height };
    },
    []
  );
  const doMeasure = measure || defaultMeasure;

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // Reactivating a finished/mid-way tour starts it over from step 0.
  useEffect(() => {
    if (active && !prevActiveRef.current) {
      dispatch({ type: "RESET" });
      finishedRef.current = false;
      prevRectRef.current = null;
    }
    prevActiveRef.current = active;
  }, [active]);

  // Resolve the current step's anchor, hand the move from the previous rect
  // off to choreography, then flip to the identity transform one frame
  // later so the browser animates the settle instead of snapping to it.
  useEffect(() => {
    if (!active || !step) {
      setPlan(null);
      setCurrentRect(null);
      return undefined;
    }

    const target = tourStepTarget(step);
    let nextRect = null;
    if (target && typeof document !== "undefined") {
      const selector =
        target.kind === "selector"
          ? target.selector
          : target.kind === "region"
          ? `[data-guide-target="${target.anchor}"]`
          : null;
      const node = selector ? document.querySelector(selector) : null;
      nextRect = node ? doMeasure(node) : null;
    }

    setCurrentRect(nextRect);

    if (!nextRect) {
      setPlan(null);
      return undefined;
    }

    const nextPlan = planTransition(prevRectRef.current, nextRect, { reduceMotion });
    prevRectRef.current = nextRect;
    setPlan(nextPlan);
    setSettled(false);

    if (reduceMotion || typeof requestAnimationFrame !== "function") {
      setSettled(true);
      return undefined;
    }
    const raf = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, state.index, reduceMotion]);

  useEffect(() => {
    if (active && state.done && !finishedRef.current) {
      finishedRef.current = true;
      onFinish?.();
    }
  }, [active, state.done, onFinish]);

  if (!active || !step) return null;

  const isLast = state.index === TOUR_STEPS.length - 1;
  const phase = settled ? plan?.to : plan?.from;

  const ringStyle = plan
    ? {
        top: plan.base.top,
        left: plan.base.left,
        width: plan.base.width,
        height: plan.base.height,
        "--ga-tx": `${phase.translateX}px`,
        "--ga-ty": `${phase.translateY}px`,
        "--ga-sx": phase.scaleX,
        "--ga-sy": phase.scaleY,
        "--ga-op": phase.opacity,
        "--ga-duration": `${plan.durationMs}ms`,
        "--ga-easing": plan.easing,
      }
    : null;

  return (
    <div className="intro-tour-root" data-testid="intro-tour">
      {plan && currentRect && (
        <div
          className={`ga-ring intro-tour-ring${!settled ? " ga-ring-animating" : ""}`}
          data-testid="intro-tour-ring"
          style={ringStyle}
        />
      )}
      <div
        key={step.id}
        className="ga-callout ga-callout-enter intro-tour-card glass-strong"
        role="dialog"
        aria-live="polite"
        aria-label={step.title}
      >
        <div className="intro-tour-card-head">
          <span className="badge badge-muted mono">
            {state.index + 1}/{TOUR_STEPS.length}
          </span>
          <button type="button" className="intro-tour-skip" onClick={() => dispatch({ type: "SKIP" })}>
            Skip
          </button>
        </div>
        <h3 className="intro-tour-title">{step.title}</h3>
        <p className="intro-tour-body">{step.body}</p>
        <div className="intro-tour-actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => dispatch({ type: "BACK" })}
            disabled={state.index === 0}
          >
            Back
          </button>
          <button type="button" className="btn-primary" onClick={() => dispatch({ type: "NEXT" })}>
            {isLast ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
