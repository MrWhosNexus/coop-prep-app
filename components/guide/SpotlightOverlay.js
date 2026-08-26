"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./guide.css";
import "./animation.css";
import { planTransition } from "@/lib/guide/choreography";

/**
 * Full-viewport coach-mark overlay: dims everything except a cutout around
 * the step's target node, with a callout box naming the objective.
 *
 * Pure and testable by construction: geometry never comes from the DOM
 * directly in a way a test cannot see. Production reads real layout
 * (getBoundingClientRect via the default `measure`); tests inject a `measure`
 * (and, for sheet cells, a `resolveRect`) so the same component runs under
 * happy-dom, which lays nothing out.
 *
 * @param {Object} props
 * @param {{kind:string, selector?:string, anchor?:string, ref?:string, sheet?:string}|null} props.target
 * @param {string} props.label spotlightLabel or step title
 * @param {string} props.instruction step.instruction
 * @param {boolean} props.active lesson.mode === "guided"
 * @param {Function} [props.onDismiss] () => void — user closes the callout
 * @param {Object} [props.containerRef] ref to the workspace element to scope measuring within
 * @param {Function} [props.measure] (node) => {top,left,width,height} — injectable for tests
 * @param {Function} [props.resolveRect] (ref, sheet) => {top,left,width,height}|null — sheet-cell resolver
 * @param {boolean} [props.animate] when true, the ring glides between step targets on the GPU
 *   (transform/opacity only) and the callout slides in per step. Default off, so the plain
 *   geometry path (and its tests) is unchanged.
 */
export default function SpotlightOverlay({
  target,
  label,
  instruction,
  active,
  onDismiss,
  containerRef,
  measure,
  resolveRect,
  animate = false,
}) {
  const [rect, setRect] = useState(null);
  const frameRef = useRef(null);
  const prevRectRef = useRef(null);
  const lastKeyRef = useRef(null);
  const [settled, setSettled] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  const targetKey = target
    ? `${target.kind}:${target.selector || ""}:${target.anchor || ""}:${target.ref || ""}:${target.sheet || ""}`
    : null;

  useEffect(() => {
    if (!animate || typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [animate]);

  // Drive the step-to-step glide. A NEW target plays a move from the previous
  // ring position to this one; a same-target re-resolve (scroll/resize) just
  // keeps the ring glued (base top/left update instantly, transform stays
  // identity, so nothing animates and the ring never lags the scroll).
  useEffect(() => {
    if (!animate || !active || !rect) return undefined;
    if (targetKey === lastKeyRef.current) {
      prevRectRef.current = rect;
      return undefined;
    }
    lastKeyRef.current = targetKey;
    setSettled(false);
    if (reduceMotion || typeof requestAnimationFrame !== "function") {
      setSettled(true);
      prevRectRef.current = rect;
      return undefined;
    }
    const raf = requestAnimationFrame(() => {
      setSettled(true);
      prevRectRef.current = rect;
    });
    return () => cancelAnimationFrame(raf);
  }, [animate, active, rect, targetKey, reduceMotion]);

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
    if (!active || !target) {
      setRect(null);
      return undefined;
    }

    const resolve = () => {
      if (target.kind === "sheet-cell") {
        if (typeof resolveRect !== "function") {
          setRect(null);
          return;
        }
        const r = resolveRect(target.ref, target.sheet);
        setRect(r || null);
        return;
      }

      const selector =
        target.kind === "selector"
          ? target.selector
          : target.kind === "region"
          ? `[data-guide-target="${target.anchor}"]`
          : null;

      if (!selector || typeof document === "undefined") {
        setRect(null);
        return;
      }
      const node = document.querySelector(selector);
      if (!node) {
        setRect(null);
        return;
      }
      setRect(doMeasure(node) || null);
    };

    resolve();

    const scheduleResolve = () => {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(resolve);
      } else {
        resolve();
      }
    };

    let ro = null;
    if (typeof ResizeObserver !== "undefined" && target.kind !== "sheet-cell") {
      const scope =
        (containerRef && containerRef.current) ||
        (typeof document !== "undefined" ? document.body : null);
      if (scope) {
        ro = new ResizeObserver(scheduleResolve);
        ro.observe(scope);
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("resize", scheduleResolve);
      window.addEventListener("scroll", scheduleResolve, true);
    }

    return () => {
      if (ro) ro.disconnect();
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", scheduleResolve);
        window.removeEventListener("scroll", scheduleResolve, true);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, target && target.kind, target && target.selector, target && target.anchor, target && target.ref, target && target.sheet, resolveRect, containerRef, doMeasure]);

  if (!active || !target) return null;
  if (!rect) return null;

  const pad = 6;
  const hole = {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };

  // Calloutbox sits below the hole when there's room, otherwise above it.
  const calloutTop = hole.top + hole.height + 12;

  // Compositor-first glide: the ring is laid out at the hole (top/left/width/
  // height, never transitioned); the move from the previous ring plays as a
  // transform settling to identity. planTransition is pure, so this is safe
  // to compute at render.
  const plan = animate ? planTransition(prevRectRef.current, hole, { reduceMotion }) : null;
  const phase = plan ? (settled ? plan.to : plan.from) : null;
  const ringAnimStyle = plan
    ? {
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
    <div className="spotlight-root" data-testid="spotlight-overlay" ref={frameRef}>
      {/* 4-rectangle dim frame around the hole -- pointer-events stay OFF the
          hole itself so the user can click/type the real target underneath. */}
      <div
        className="spotlight-scrim spotlight-scrim-top"
        style={{ top: 0, left: 0, right: 0, height: Math.max(hole.top, 0) }}
      />
      <div
        className="spotlight-scrim spotlight-scrim-bottom"
        style={{ top: hole.top + hole.height, left: 0, right: 0, bottom: 0 }}
      />
      <div
        className="spotlight-scrim spotlight-scrim-left"
        style={{ top: hole.top, left: 0, width: Math.max(hole.left, 0), height: hole.height }}
      />
      <div
        className="spotlight-scrim spotlight-scrim-right"
        style={{ top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height }}
      />
      <div
        className={`spotlight-ring${animate ? " ga-ring" : ""}${animate && !settled ? " ga-ring-animating" : ""}`}
        data-testid="spotlight-ring"
        style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height, ...(ringAnimStyle || {}) }}
      />
      <div
        key={animate ? targetKey : undefined}
        className={`spotlight-callout glass-strong${animate ? " ga-callout ga-callout-enter" : ""}`}
        data-testid="spotlight-callout"
        style={{ top: calloutTop, left: hole.left }}
        role="dialog"
        aria-live="polite"
      >
        <div className="spotlight-callout-head">
          <h3 className="spotlight-callout-label">{label}</h3>
          {typeof onDismiss === "function" && (
            <button
              type="button"
              className="spotlight-dismiss"
              aria-label="Dismiss"
              onClick={onDismiss}
            >
              ×
            </button>
          )}
        </div>
        <p className="spotlight-callout-instruction">{instruction}</p>
      </div>
    </div>
  );
}
