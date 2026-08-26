// lib/voice/wakeWord.js
//
// Wake-word detection — "Hey Nexus" / "Yo Nexus" (ON-DEVICE ONLY, no cloud).
//
// Design note (why this is text-matching over a transcript, not a keyword
// spotting model): adding a real acoustic keyword-spotter (Porcupine,
// openWakeWord, etc.) is a new native/model dependency this app has steered
// away from. Instead this reuses the EXISTING local Whisper transcription
// path (lib/voice/engine.js#transcribe -> window.coop.voice.transcribe ->
// electron/voice/stt-local.js, in-process on this machine, no key, no
// cloud). lib/voice/wakeLoop.js hands each completed VAD utterance to that
// same transcribe() call while idle/collapsed instead of starting a
// conversational turn; the transcript is matched here.
//
// Honesty check: this only "hears" a wake word when the local Whisper
// process is actually up and fast enough to keep pace with idle chatter. If
// transcription fails or errors, the wake check fails closed (caught,
// ignored, stays awaiting wake) — see the call site in
// components/voice/NexusVoiceWidget.js. That dependency is NOT verified live
// in this change; it needs a real mic to confirm end-to-end.
//
// Ported from nexus/renderer/src/panels/companion/voice/wakeWord.ts, types
// stripped.

export const WAKE_PHRASES = ["hey nexus", "yo nexus"];

/** Minimum gap between wake-check STT calls, so mumbling/background noise at
 *  the end of every VAD-segmented "utterance" can't hammer the transcriber. */
export const WAKE_CHECK_MIN_INTERVAL_MS = 1200;

/** Max edit distance tolerated between a candidate 2-word window and a wake
 *  phrase — forgives one dropped/substituted letter from STT mishears
 *  ("hey nexis", "hay nexus") without accepting unrelated speech. */
const MAX_EDIT_DISTANCE = 1;

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeTranscript(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(
        row[j - 1] + 1, // insertion
        prev[j] + 1, // deletion
        prev[j - 1] + cost // substitution
      );
    }
    prev = row;
  }
  return prev[b.length];
}

/**
 * True if the normalized transcript contains (or nearly contains, tolerating
 * a single-character mishear) one of the wake phrases as a two-word window.
 *
 * @param {string} rawText
 * @returns {boolean}
 */
export function matchesWakePhrase(rawText) {
  const text = normalizeTranscript(rawText);
  if (!text) return false;

  for (const phrase of WAKE_PHRASES) {
    if (text.includes(phrase)) return true;
  }

  const words = text.split(" ");
  for (let i = 0; i < words.length - 1; i++) {
    const window = `${words[i]} ${words[i + 1]}`;
    for (const phrase of WAKE_PHRASES) {
      if (levenshtein(window, phrase) <= MAX_EDIT_DISTANCE) return true;
    }
  }
  return false;
}

/** Simple fixed-window rate limiter — no timers, caller passes the clock. */
export class WakeCheckLimiter {
  constructor(minIntervalMs = WAKE_CHECK_MIN_INTERVAL_MS) {
    this.minIntervalMs = minIntervalMs;
    this.lastAcquiredAt = -Infinity;
  }

  /** Returns true (and records the acquisition) iff enough time has passed
   *  since the last successful acquisition. */
  tryAcquire(nowMs) {
    if (nowMs - this.lastAcquiredAt < this.minIntervalMs) return false;
    this.lastAcquiredAt = nowMs;
    return true;
  }
}
