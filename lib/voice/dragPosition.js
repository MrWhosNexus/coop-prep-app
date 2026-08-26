// lib/voice/dragPosition.js
//
// Pure position math for the free-floating voice widget, split out of
// NexusVoiceWidget.js so it is testable without a real pointer or a laid-out
// DOM (happy-dom does not lay anything out — offsetWidth/Height are always
// 0 there, see test/helpers/render.mjs's "WHAT THIS CANNOT DO" note). Every
// function here takes plain numbers and returns plain numbers.
//
// The widget stores position as { right, bottom } (distance from the
// viewport's bottom-right corner), matching its existing
// `position: fixed; bottom: 20; right: 20` styling — dragging just adjusts
// those two numbers instead of switching to top/left.

export const DEFAULT_POSITION = { right: 20, bottom: 20 };
export const EDGE_MARGIN = 8;

/**
 * Given a pointer movement delta (in page pixels) since the drag started,
 * compute the new { right, bottom } from the position at drag-start.
 *
 * Dragging right/down should DECREASE right/bottom (move toward the near
 * edge stops mattering, the widget follows the pointer), so the deltas are
 * inverted relative to a normal top/left drag.
 *
 * @param {{ right: number, bottom: number }} start
 * @param {{ dx: number, dy: number }} delta
 * @returns {{ right: number, bottom: number }}
 */
export function applyDragDelta(start, { dx, dy }) {
  return {
    right: start.right - dx,
    bottom: start.bottom - dy,
  };
}

/**
 * Clamp a { right, bottom } position so the widget (sized widthPx x
 * heightPx) stays fully inside a viewport of viewportW x viewportH, with at
 * least EDGE_MARGIN of breathing room from every edge.
 *
 * @param {{ right: number, bottom: number }} pos
 * @param {{ widthPx: number, heightPx: number, viewportW: number, viewportH: number }} bounds
 * @returns {{ right: number, bottom: number }}
 */
export function clampToViewport(pos, { widthPx, heightPx, viewportW, viewportH }) {
  const maxRight = Math.max(EDGE_MARGIN, viewportW - widthPx - EDGE_MARGIN);
  const maxBottom = Math.max(EDGE_MARGIN, viewportH - heightPx - EDGE_MARGIN);
  return {
    right: Math.min(Math.max(pos.right, EDGE_MARGIN), maxRight),
    bottom: Math.min(Math.max(pos.bottom, EDGE_MARGIN), maxBottom),
  };
}

const STORAGE_KEY = "coop.nexusVoice.position";

/** Read the persisted position, or DEFAULT_POSITION if absent/invalid. */
export function loadPosition(storage) {
  try {
    const raw = storage?.getItem?.(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_POSITION };
    const parsed = JSON.parse(raw);
    if (typeof parsed?.right === "number" && typeof parsed?.bottom === "number") return parsed;
  } catch {
    // Corrupt/foreign localStorage value: fall through to the default.
  }
  return { ...DEFAULT_POSITION };
}

/** Persist a position. Never throws (a private-browsing quota error is not a crash). */
export function savePosition(storage, pos) {
  try {
    storage?.setItem?.(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // Storage unavailable or full: position just will not survive reload.
  }
}
