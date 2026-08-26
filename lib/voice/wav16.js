// lib/voice/wav16.js
//
// The renderer's half of the STT contract: 16 kHz mono 16-bit PCM WAV.
//
// STT runs in the Electron main process, which has no Web Audio API and
// cannot decode a MediaRecorder blob without pulling in ffmpeg as a native
// dependency. The renderer already has Web Audio, so it encodes plain PCM
// instead. Ported from nexus/renderer/src/lib/wav16.ts (encodeWav16k +
// captureWav16k), adapted to plain JS and split into a pure encoder (unit-
// testable under happy-dom, which has no AudioContext) and a live-capture
// wrapper that needs the real browser APIs.
//
// electron/voice/stt-local.js's decodeWav16kMono() is the other half of this
// contract (OPUS-owned) and rejects anything that is not 16 kHz/mono/16-bit —
// keep the two in step.

export const CAPTURE_SAMPLE_RATE = 16000;

/**
 * True when this runtime can actually open a microphone. Guards every live
 * capture call so importing this module never throws in Node/SSR/happy-dom.
 */
export function micAvailable() {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof window !== "undefined" &&
    typeof window.AudioContext === "function"
  );
}

/**
 * Concatenated Float32 frames in [-1, 1] -> a 16 kHz mono 16-bit PCM WAV
 * ArrayBuffer. Pure function, no browser API — this is what the unit tests
 * exercise directly.
 *
 * @param {Float32Array[]} frames
 * @returns {ArrayBuffer}
 */
export function encodeWav16(frames) {
  const list = Array.isArray(frames) ? frames : [];
  const total = list.reduce((n, f) => n + f.length, 0);
  const buf = new ArrayBuffer(44 + total * 2);
  const view = new DataView(buf);
  const writeStr = (off, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + total * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, CAPTURE_SAMPLE_RATE, true);
  view.setUint32(28, CAPTURE_SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, total * 2, true);

  let off = 44;
  for (const f of list) {
    for (let i = 0; i < f.length; i++) {
      const s = Math.max(-1, Math.min(1, f[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return buf;
}

/**
 * Microphone capture at CAPTURE_SAMPLE_RATE, buffering mono frames until
 * stopped. Returns a controller whose stop() releases the mic/AudioContext
 * and resolves the captured audio as a WAV ArrayBuffer.
 *
 * Throws (as a rejected promise, this is an async function) when the runtime
 * has no microphone API — callers must check micAvailable() first or catch
 * this rejection; it never leaves a mic or AudioContext open on failure.
 *
 * @returns {Promise<{ stop: () => Promise<ArrayBuffer> }>}
 */
export async function captureWav16k() {
  if (!micAvailable()) throw new Error("microphone unavailable");

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new window.AudioContext({ sampleRate: CAPTURE_SAMPLE_RATE });
  const src = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const frames = [];
  node.onaudioprocess = (ev) => {
    // Copy: the event's buffer is reused by the audio thread on the next frame.
    frames.push(new Float32Array(ev.inputBuffer.getChannelData(0)));
  };
  src.connect(node);
  node.connect(ctx.destination); // required for onaudioprocess to fire

  let stopped = false;
  return {
    async stop() {
      if (!stopped) {
        stopped = true;
        node.onaudioprocess = null;
        node.disconnect();
        src.disconnect();
        stream.getTracks().forEach((t) => t.stop());
        await ctx.close().catch(() => undefined);
      }
      return encodeWav16(frames);
    },
  };
}
