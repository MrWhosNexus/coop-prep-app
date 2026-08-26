// lib/voice/chirp.js
//
// Wake-word confirmation chirp — synthesized via WebAudio, no audio asset.
// Two short rising tones (a cheerful "I heard you" affect), well under the
// length of a real utterance so it never gets mistaken for VAD speech.
//
// NOT unit-testable without a real AudioContext (happy-dom has none) — the
// constants below are exported so tests can assert on the shape without a
// live context; actual playback needs a real run to confirm it is audible
// and does not clash with mic echo/AEC.
//
// Ported from nexus/renderer/src/panels/companion/voice/chirp.ts, types
// stripped.

export const CHIRP_TONE_1_HZ = 880;
export const CHIRP_TONE_2_HZ = 1320;
export const CHIRP_TONE_DURATION_MS = 90;
export const CHIRP_GAP_MS = 40;
export const CHIRP_PEAK_GAIN = 0.18;

/**
 * Play the confirmation chirp on the given AudioContext's destination.
 * @param {AudioContext} ctx
 */
export function playWakeChirp(ctx) {
  const now = ctx.currentTime;
  const toneSec = CHIRP_TONE_DURATION_MS / 1000;
  const gapSec = CHIRP_GAP_MS / 1000;

  const playTone = (freq, startAt) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, startAt);
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(CHIRP_PEAK_GAIN, startAt + toneSec * 0.25);
    gain.gain.linearRampToValueAtTime(0, startAt + toneSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + toneSec + 0.01);
  };

  playTone(CHIRP_TONE_1_HZ, now);
  playTone(CHIRP_TONE_2_HZ, now + toneSec + gapSec);
}
