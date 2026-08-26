// lib/guide/narration.js
//
// Turns a GuidedStep into a short spoken line and, when voice is on, hands it
// to whatever bridge the caller supplies. This module never touches
// window.coop itself -- the caller (Dashboard, IntroTour, etc.) resolves the
// real bridge the same way lib/voice/engine.js does and passes it in, so this
// file stays pure and testable under happy-dom.
//
// bridge shape: anything with a `speak(text)` method. That covers both the
// raw window.coop.voice IPC bridge and a createVoiceEngine() instance --
// speakStep only ever calls bridge.speak, so either works.

const EM_DASH = /\s*[—]\s*/g;
const FALLBACK_TEXT = "Here is the next step.";

function cleanLine(text) {
  return text.replace(EM_DASH, ", ").replace(/\s+/g, " ").trim();
}

/**
 * Build a short spoken string for a step. Prefers the spotlight label (it is
 * already written to be said aloud); falls back to the instruction, then the
 * title, then a generic line so callers always get something sayable.
 *
 * @param {{ spotlightLabel?: string, instruction?: string, title?: string }} [step]
 * @returns {string}
 */
export function narrationText(step) {
  if (!step || typeof step !== "object") return FALLBACK_TEXT;

  const label = typeof step.spotlightLabel === "string" ? cleanLine(step.spotlightLabel) : "";
  const instruction = typeof step.instruction === "string" ? cleanLine(step.instruction) : "";
  const title = typeof step.title === "string" ? cleanLine(step.title) : "";

  const line = label || instruction || title || FALLBACK_TEXT;
  return line;
}

/**
 * Speak a step's narration through the caller's voice bridge. Degrades
 * silently: skipped when narration is disabled, when no bridge is supplied,
 * or when the bridge has no working `speak` method. Never throws -- a
 * missing or misbehaving bridge is a fact, not a crash.
 *
 * @param {object} step
 * @param {{ bridge?: { speak?: (text: string) => unknown }, enabled?: boolean }} [opts]
 * @returns {Promise<void>}
 */
export async function speakStep(step, { bridge, enabled = false } = {}) {
  if (!enabled) return;
  if (!bridge || typeof bridge.speak !== "function") return;

  try {
    await bridge.speak(narrationText(step));
  } catch {
    // Voice failing is not this caller's problem; the widget surfaces its
    // own errors. Narration just goes quiet.
  }
}
