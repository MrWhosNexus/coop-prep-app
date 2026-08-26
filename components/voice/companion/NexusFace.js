"use client";

// components/voice/companion/NexusFace.js
//
// The companion face, ported from
// nexus/renderer/src/panels/companion/NexusFace.tsx (types stripped). Pure
// presentational: mood is a CSS class, lip-sync arrives as CSS custom
// properties. All animation is CSS and pauses under prefers-reduced-motion
// (companion.css).

/**
 * @param {{ mood: import('@/lib/voice/companion/types.js').CompanionMood, mouthShape: import('@/lib/voice/companion/types.js').MouthShape }} props
 */
export function NexusFace({ mood, mouthShape }) {
  return (
    <div
      className={`cmp-face cmp-face-${mood}`}
      style={{
        "--mouth-open": mouthShape.open.toFixed(3),
        "--mouth-width": mouthShape.width.toFixed(3),
        "--mouth-round": mouthShape.round.toFixed(3),
        "--mouth-teeth": mouthShape.teeth.toFixed(3),
      }}
      role="img"
      aria-label={`Nexus mood: ${mood}`}
    >
      <div className="cmp-eye-row" aria-hidden>
        <div className="cmp-eye">
          <span />
        </div>
        <div className="cmp-eye">
          <span />
        </div>
      </div>
      <div className="cmp-mouth-wrap" aria-hidden>
        <div className="cmp-mouth">
          <div className="cmp-mouth-teeth" />
          <div className="cmp-mouth-line" />
        </div>
      </div>
    </div>
  );
}
