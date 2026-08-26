// lib/guide/choreography.js
//
// Pure spotlight choreography state machine. No DOM access anywhere in this
// file -- every function takes rects/flags in and returns plain data out, so
// it runs identically under happy-dom, a real browser, or a test runner with
// no layout at all.
//
// Compositor-first contract: the destination rect (`base`) is applied as
// real layout ONCE (top/left/width/height, set and left alone). The visual
// motion from wherever the ring used to be is expressed as a transform
// (`from`) that the renderer animates to identity (`to`) -- translate and
// scale only, so the browser composites the whole move on the GPU instead
// of re-laying-out every frame.

const EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

// Duration when there is no previous rect: a gentle fade/scale-in for the
// very first spotlighted target.
const ENTER_DURATION_MS = 380;

// Duration for a move between two known rects.
const MOVE_DURATION_MS = 320;

const IDENTITY = Object.freeze({
  translateX: 0,
  translateY: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

/**
 * @param {{top:number,left:number,width:number,height:number}|null} fromRect
 * @param {{top:number,left:number,width:number,height:number}} toRect
 * @param {{reduceMotion?:boolean}} [opts]
 * @returns {{
 *   base:{top:number,left:number,width:number,height:number},
 *   from:{translateX:number,translateY:number,scaleX:number,scaleY:number,opacity:number},
 *   to:{translateX:number,translateY:number,scaleX:number,scaleY:number,opacity:number},
 *   durationMs:number,
 *   easing:string
 * }}
 */
export function planTransition(fromRect, toRect, opts = {}) {
  const reduceMotion = !!opts.reduceMotion;

  const base = {
    top: toRect.top,
    left: toRect.left,
    width: toRect.width,
    height: toRect.height,
  };

  const to = { ...IDENTITY };

  if (reduceMotion) {
    return {
      base,
      from: { ...to },
      to,
      durationMs: 0,
      easing: EASING,
    };
  }

  if (!fromRect) {
    return {
      base,
      from: {
        translateX: 0,
        translateY: 0,
        scaleX: 0.92,
        scaleY: 0.92,
        opacity: 0,
      },
      to,
      durationMs: ENTER_DURATION_MS,
      easing: EASING,
    };
  }

  // Ring is laid out at `base` (the destination). To make it *look* like it
  // starts at `fromRect`, offset it by the delta from destination back to
  // origin, then transition that offset to zero (identity == resting at
  // destination). A target that moved right/down means the origin sits
  // left/above the destination, so this delta -- and the starting
  // translate -- comes out negative; the ring then travels toward zero,
  // i.e. right/down, to settle on the real target.
  const translateX = fromRect.left - toRect.left;
  const translateY = fromRect.top - toRect.top;
  const scaleX = toRect.width > 0 ? fromRect.width / toRect.width : 1;
  const scaleY = toRect.height > 0 ? fromRect.height / toRect.height : 1;

  return {
    base,
    from: {
      translateX,
      translateY,
      scaleX,
      scaleY,
      opacity: 1,
    },
    to,
    durationMs: MOVE_DURATION_MS,
    easing: EASING,
  };
}

// Semantic phase labels the renderer maps to CSS classes: dim the backdrop,
// move the ring, settle into place, then a single confirming pulse.
export const PHASES = ["dim", "move", "settle", "pulse"];

const MIN_PARTICLES = 6;
const MAX_PARTICLES = 18;
const MIN_RADIUS = 40;
const MAX_RADIUS = 80;
const MIN_CELEBRATION_MS = 700;
const MAX_CELEBRATION_MS = 1000;
const PARTICLE_STAGGER_MS = 12;

/**
 * @param {{intensity?:number}} [opts] intensity in [0,2]; clamped.
 * @returns {{durationMs:number, particles:Array<{dx:number,dy:number,rot:number,delay:number}>}}
 */
export function celebrationPlan(opts = {}) {
  const raw = typeof opts.intensity === "number" ? opts.intensity : 1;
  const intensity = Math.max(0, Math.min(raw, 2));
  const t = intensity / 2; // normalized 0..1 for interpolation

  const count = Math.round(MIN_PARTICLES + t * (MAX_PARTICLES - MIN_PARTICLES));
  const radius = MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
  const durationMs = Math.round(
    MIN_CELEBRATION_MS + t * (MAX_CELEBRATION_MS - MIN_CELEBRATION_MS)
  );

  const particles = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const dx = Math.cos(angle) * radius;
    const dy = Math.sin(angle) * radius;
    const rot = (i % 2 === 0 ? 1 : -1) * (90 + i * 10);
    const delay = i * PARTICLE_STAGGER_MS;
    particles.push({ dx, dy, rot, delay });
  }

  return { durationMs, particles };
}
