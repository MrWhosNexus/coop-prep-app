"use client";

import { useEffect, useRef, useState } from "react";
import "./animation.css";
import { celebrationPlan } from "@/lib/guide/choreography";

/**
 * A checkmark-and-particle burst shown when a guided step clears.
 *
 * celebrationPlan (pure, no DOM) decides particle count, spread, and
 * duration from `intensity`; this component only paints that plan. Every
 * animated property here is transform or opacity, so the burst composites
 * on the GPU instead of costing a layout pass per frame. Renders null
 * whenever `show` is false.
 *
 * @param {Object} props
 * @param {boolean} props.show
 * @param {number} [props.intensity] 0..2, forwarded to celebrationPlan
 * @param {Function} [props.onDone] () => void, fired durationMs after `show` flips true
 */
export default function StepCelebration({ show, intensity = 1, onDone }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [entered, setEntered] = useState(false);
  const timerRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const plan = show ? celebrationPlan({ intensity }) : null;

  useEffect(() => {
    setEntered(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (!show || !plan) return undefined;

    // Reduced motion collapses the whole burst to instant: no transition, no
    // particles (animation.css hides .ga-particle under the media query),
    // and onDone fires right away instead of after the full plan duration.
    const durationMs = reduceMotion ? 0 : plan.durationMs;

    if (reduceMotion || typeof requestAnimationFrame !== "function") {
      setEntered(true);
    } else {
      rafRef.current = requestAnimationFrame(() => setEntered(true));
    }

    timerRef.current = setTimeout(() => { onDone?.(); }, durationMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, intensity, reduceMotion]);

  if (!show || !plan) return null;

  return (
    <div
      className="step-celebration"
      data-testid="step-celebration"
      aria-hidden="true"
      style={{ position: "fixed", top: "50%", left: "50%", pointerEvents: "none", zIndex: 90 }}
    >
      <div
        className="step-celebration-check"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          opacity: entered || reduceMotion ? 1 : 0,
          transform: `translate(-50%, -50%) scale(${entered || reduceMotion ? 1 : 0.5})`,
          transitionProperty: reduceMotion ? "none" : "transform, opacity",
          transitionDuration: reduceMotion ? "0ms" : "260ms",
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        ✓
      </div>
      {!reduceMotion &&
        plan.particles.map((p, i) => (
          <span
            key={i}
            className={entered ? "ga-particle ga-particle-burst" : "ga-particle"}
            style={{
              top: 0,
              left: 0,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--rot": `${p.rot}deg`,
              "--ga-duration": `${plan.durationMs}ms`,
              animationDelay: `${p.delay}ms`,
            }}
          />
        ))}
    </div>
  );
}
