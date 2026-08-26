// electron/voice/stt-local.js
//
// Local speech-to-text for the Nexus voice widget — no API key, no cloud.
// Ported from nexus/electron/main/companion-stt-local.ts to plain-JS ESM.
// Engine: Whisper via @huggingface/transformers (ONNX Runtime, CPU).
//
// Two halves live here:
//   1. PURE helpers — decodeWav16kMono / encodeWav16kMono / floatToPcm16 /
//      pcm16ToFloat. No native deps, no Electron, no child_process. This is
//      the exact contract test/voice-wav.test.js depends on: importing this
//      module for just these helpers must NEVER fork a worker or touch
//      @huggingface/transformers — those only load inside stt-worker.js,
//      lazily, on the first real transcribe() call.
//   2. createLocalStt() — decodes the WAV here (cheap, pure), then forks
//      stt-worker.js and hands it the raw samples for the actual Whisper
//      pipeline call. Honest degrade: worker load/transcription failure
//      resolves transcribe() to { ok: false, reason } rather than crashing
//      the main process or hanging.
//
// TRANSCRIPTION RUNS IN A FORKED CHILD PROCESS (stt-worker.js), not here.
// @huggingface/transformers' forward pass is a SYNCHRONOUS native call that
// blocks whatever thread/process it runs on for its full duration — inline
// in Electron main that froze the IPC loop for that whole span on every
// transcribe(), and a parallel wake-word listener calls this frequently, so
// the block would have recurred constantly rather than once per user
// utterance. See tts-local.js / stt-worker.js for why this must be a forked
// process rather than a worker_thread.
//
// Audio contract: 16 kHz mono 16-bit PCM WAV, which is exactly what the
// renderer's wav16.js produces. Node has no Web Audio API, so the renderer
// does the capture/encode and hands us plain PCM — no ffmpeg in this path.

import path from "node:path";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveWorkerBundle } from "./worker-path.js";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * whisper-base.en over -tiny.en: tiny's word error rate makes short commands
 * come back visibly wrong. base is ~145 MB at q8 and runs on CPU. English-only
 * because the .en checkpoints beat multilingual at the same size; COOP_STT_MODEL
 * overrides (e.g. onnx-community/whisper-base for other languages).
 */
export const LOCAL_STT_MODEL_ID = "onnx-community/whisper-base.en";
export const LOCAL_STT_DTYPE = "q8";
export const LOCAL_STT_SAMPLE_RATE = 16000;
// Whisper's fixed 30 s receptive field (chunk_length_s/stride_length_s) is
// applied in stt-worker.js, where the pipeline actually runs.

/** Model id actually loaded — COOP_STT_MODEL wins when set. */
export function resolveSttModelId() {
  const override = process.env.COOP_STT_MODEL;
  return override && override.length > 0 ? override : LOCAL_STT_MODEL_ID;
}

/**
 * Where Whisper model files live. Explicit env override, else userData/stt-models
 * (never inside node_modules/asar, so packaged builds and `rm -rf node_modules`
 * both keep the cache). Separate from TTS so clearing one does not evict the other.
 *
 * @param {string} [userDataDir] app.getPath("userData"), passed by main.js
 * @returns {string|undefined} undefined when neither override nor userData is known
 */
export function defaultSttCacheDir(userDataDir) {
  const override = process.env.COOP_STT_CACHE_DIR;
  if (override && override.length > 0) return override;
  if (userDataDir && userDataDir.length > 0) return path.join(userDataDir, "stt-models");
  return undefined;
}

export class WavFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = "WavFormatError";
  }
}

/* ── pure PCM helpers ──────────────────────────────────────────────────── */

/**
 * Float32 [-1, 1] → little-endian signed PCM16 Buffer. Clamps before scaling:
 * an overshoot past ±1.0 otherwise wraps to full-scale static.
 * @param {Float32Array} samples
 * @returns {Buffer}
 */
export function floatToPcm16(samples) {
  const buf = Buffer.allocUnsafe(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    let s = samples[i];
    if (s > 1) s = 1;
    else if (s < -1) s = -1;
    buf.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  return buf;
}

/**
 * Little-endian signed PCM16 → Float32 [-1, 1]. Asymmetric scale: int16 spans
 * -32768..32767, so dividing by 32768 maps the full negative range to exactly
 * -1 without clipping.
 * @param {Buffer} buf
 * @returns {Float32Array}
 */
export function pcm16ToFloat(buf) {
  const count = Math.floor(buf.length / 2);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = buf.readInt16LE(i * 2) / 32768;
  return out;
}

/**
 * Decode a 16 kHz mono 16-bit PCM WAV into the Float32 samples Whisper wants.
 *
 * Scope is deliberately narrow — the exact and only shape encodeWav16kMono (and
 * the renderer's wav16.js) produces. Chunk sizes are read from the RIFF headers
 * rather than assumed: a WAV may carry LIST/fact chunks before `data`, so a
 * fixed offset-44 seek would read metadata as samples. Anything not matching the
 * 16 kHz/mono/16-bit contract throws WavFormatError the caller surfaces honestly.
 *
 * @param {Buffer} buf
 * @returns {Float32Array}
 */
export function decodeWav16kMono(buf) {
  if (buf.length < 12) throw new WavFormatError("audio too short to be a WAV file");
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new WavFormatError("expected a RIFF/WAVE file");
  }

  let format = null;
  let channels = 0;
  let sampleRate = 0;
  let bits = 0;
  let data = null;

  // Walk the chunk list: 4-byte id, 4-byte LE size, then payload padded to even.
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    const body = off + 8;
    if (body + size > buf.length) break; // truncated chunk — use what we have
    if (id === "fmt " && size >= 16) {
      format = buf.readUInt16LE(body);
      channels = buf.readUInt16LE(body + 2);
      sampleRate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
    } else if (id === "data") {
      data = buf.subarray(body, body + size);
    }
    off = body + size + (size % 2); // pad byte
  }

  if (format === null) throw new WavFormatError("WAV has no fmt chunk");
  if (data === null) throw new WavFormatError("WAV has no data chunk");
  if (format !== 1 || bits !== 16) {
    throw new WavFormatError(`expected 16-bit PCM WAV, got format ${format}/${bits}-bit`);
  }
  if (channels !== 1) throw new WavFormatError(`expected mono audio, got ${channels} channels`);
  if (sampleRate !== LOCAL_STT_SAMPLE_RATE) {
    throw new WavFormatError(`expected ${LOCAL_STT_SAMPLE_RATE} Hz audio, got ${sampleRate} Hz`);
  }

  return pcm16ToFloat(Buffer.from(data));
}

/**
 * Float32 samples → a 16 kHz mono 16-bit PCM WAV Buffer. The inverse of
 * decodeWav16kMono; used by tests to round-trip and available to any main-side
 * caller that needs the on-disk shape.
 * @param {Float32Array} samples
 * @returns {Buffer}
 */
export function encodeWav16kMono(samples) {
  const pcm = floatToPcm16(samples);
  const header = Buffer.alloc(44);
  const byteRate = LOCAL_STT_SAMPLE_RATE * 2; // mono, 2 bytes/sample
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(LOCAL_STT_SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/* ── forked Whisper worker ─────────────────────────────────────────────── */

/** Absolute path of stt-worker.js — overridable so tests can point elsewhere. */
function sttWorkerFile() {
  const override = process.env.COOP_STT_WORKER_PATH;
  if (override && override.length > 0) return override;
  return resolveWorkerBundle(here, "stt-worker.js");
}

/**
 * Build a local Whisper STT engine bound to a cache dir. Nothing loads — no
 * child process, no native runtime — until the first transcribe() call.
 *
 * @param {{ userDataDir?: string, model?: string }} [opts]
 */
export function createLocalStt({ userDataDir, model } = {}) {
  const cacheDir = defaultSttCacheDir(userDataDir);
  const modelId = model || resolveSttModelId();

  let worker = null;
  let nextReqId = 1;

  /**
   * Lazy singleton worker, forked as a plain-Node child (ELECTRON_RUN_AS_NODE)
   * so importing 'electron' is never required here. One worker, reused
   * across every transcribe(): the model load happens once, in the child,
   * never on main and never per call — including the wake-word listener's
   * frequent calls.
   */
  function getWorker() {
    if (worker) return worker;
    const file = sttWorkerFile();
    const w = fork(file, [], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    });
    w.on("error", () => {
      if (worker === w) worker = null;
    });
    w.on("exit", () => {
      if (worker === w) worker = null;
    });
    // Do not let a live child hold the process open at shutdown; Electron's
    // app lifecycle (and shutdown(), for tests) own its teardown.
    w.unref();
    worker = w;
    return w;
  }

  /**
   * Transcribe a WAV upload. Decodes strictly HERE (cheap, pure, no worker
   * needed for a bad upload), then hands the samples to the forked worker
   * for the actual Whisper pipeline call. Returns { ok, text } | { ok:false,
   * reason }. Never throws — every failure degrades honestly.
   *
   * @param {ArrayBuffer|Buffer|ArrayBufferView} audio
   * @returns {Promise<{ ok: boolean, text: string, reason?: string }>}
   */
  async function transcribe(audio) {
    const buf = Buffer.isBuffer(audio)
      ? audio
      : ArrayBuffer.isView(audio)
        ? Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength)
        : Buffer.from(audio);

    let samples;
    try {
      samples = decodeWav16kMono(buf);
    } catch (e) {
      return {
        ok: false,
        text: "",
        reason:
          e instanceof WavFormatError
            ? `${e.message} — the recorder must send 16 kHz mono 16-bit PCM WAV.`
            : "could not decode the uploaded audio",
      };
    }

    return new Promise((resolve) => {
      let w;
      try {
        w = getWorker();
      } catch (e) {
        resolve({
          ok: false,
          text: "",
          reason: "voice model unavailable",
          detail: e instanceof Error ? e.message : String(e),
        });
        return;
      }

      const reqId = nextReqId++;
      let settled = false;

      const cleanup = () => {
        w.off("message", onMessage);
        w.off("error", onWorkerDown);
        w.off("exit", onWorkerDown);
      };
      const finish = (result) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };

      const onWorkerDown = (e) => {
        finish({
          ok: false,
          text: "",
          reason: "voice model unavailable",
          detail: e instanceof Error ? e.message : "local STT worker exited unexpectedly",
        });
      };

      const onMessage = (msg) => {
        if (!msg || msg.reqId !== reqId) return;
        // Silence is a real outcome, not an error — msg.ok:true with empty
        // text is returned as-is and the caller decides whether to surface it.
        finish(msg.ok ? { ok: true, text: msg.text } : { ok: false, text: "", reason: msg.reason, detail: msg.detail });
      };

      w.on("message", onMessage);
      w.on("error", onWorkerDown);
      w.on("exit", onWorkerDown);
      w.send({ reqId, kind: "transcribe", samples: Array.from(samples), cacheDir, modelId });
    });
  }

  /** Terminate the singleton worker. Tests call this so `node --test` can
   *  exit; the app never needs it (process teardown reclaims the child). */
  async function shutdown() {
    const w = worker;
    worker = null;
    if (!w) return;
    // See tts-local.js's shutdown() for why: getWorker() unref()s the child,
    // and an unref'd handle's "exit" event does not keep the event loop
    // alive on its own — ref() it back while we deliberately wait for it.
    w.ref();
    await new Promise((resolveExit) => {
      w.once("exit", () => resolveExit());
      w.kill();
    });
  }

  return { transcribe, sampleRate: LOCAL_STT_SAMPLE_RATE, shutdown };
}
