// electron/voice/tts-local.js
//
// Local text-to-speech for the Nexus voice widget — no API key, no cloud.
// Ported from nexus/electron/main/companion-tts-local.ts to plain-JS ESM.
//
// Engine: Kokoro-82M via kokoro-js (ONNX Runtime, CPU EP; onnxruntime-node
// ships prebuilt N-API binaries, so no electron-rebuild step). Kokoro
// natively emits 24 kHz mono Float32 — the rate the renderer's playback.js
// pins — so there is no resampling anywhere in this path.
//
// dtype q8: the quantized int8 graph is ~92 MB (vs ~326 MB fp32), loads
// faster, and is kokoro-js's recommended CPU config. Model files download
// from the HF Hub on FIRST use only, cached under a user-writable dir (never
// node_modules/asar).
//
// SYNTHESIS RUNS IN A FORKED CHILD PROCESS (tts-worker.js), not here.
// onnxruntime-node's inference is a SYNCHRONOUS native call — the forward
// pass blocks whatever thread/process it runs on for its full duration
// (multiple seconds per utterance), which used to freeze Electron main's IPC
// loop for that whole span on every speak(). Forking it off keeps the app
// responsive while Kokoro runs, and matters more now that a parallel
// wake-word listener calls the STT sibling of this module frequently. See
// nexus/electron/main/companion-tts-local.ts's getTtsWorker for the fuller
// story of why this must be a `fork`ed process rather than a worker_thread
// (onnxruntime-node's async callback can fire without a V8 HandleScope on a
// worker thread's isolate and SIGABRTs the whole app).
//
// The public API here (`createLocalTts` → `{ sampleRate, speak(text, opts) }`)
// is UNCHANGED — main.js and ipc/handlers.js need no changes. speak() forks
// the worker lazily on first call, sends a `speak` request, and proxies each
// `chunk` message back through `onChunk` as a Float32Array (chunks travel
// the worker IPC as plain number[] — see tts-worker.js for why — and are
// reconstituted here before the caller ever sees them).

import path from "node:path";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveWorkerBundle } from "./worker-path.js";

export const LOCAL_TTS_MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
export const LOCAL_TTS_DTYPE = "q8";
export const LOCAL_TTS_SAMPLE_RATE = 24000;
export const LOCAL_TTS_DEFAULT_VOICE = "af_heart";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Where Kokoro model files live. Explicit env override, else userData/tts-models.
 * @param {string} [userDataDir] app.getPath("userData"), passed by main.js
 * @returns {string|undefined}
 */
export function defaultTtsCacheDir(userDataDir) {
  const override = process.env.COOP_TTS_CACHE_DIR;
  if (override && override.length > 0) return override;
  if (userDataDir && userDataDir.length > 0) return path.join(userDataDir, "tts-models");
  return undefined;
}

/** Absolute path of tts-worker.js — overridable so tests can point elsewhere. */
function ttsWorkerFile() {
  const override = process.env.COOP_TTS_WORKER_PATH;
  if (override && override.length > 0) return override;
  return resolveWorkerBundle(here, "tts-worker.js");
}

/**
 * Build a local Kokoro TTS engine bound to a cache dir. Nothing loads — no
 * child process, no native runtime — until the first speak() call.
 *
 * @param {{ userDataDir?: string, voice?: string }} [opts]
 */
export function createLocalTts({ userDataDir, voice } = {}) {
  const cacheDir = defaultTtsCacheDir(userDataDir);

  let worker = null;
  let nextReqId = 1;

  /**
   * Lazy singleton worker, forked as a plain-Node child (ELECTRON_RUN_AS_NODE)
   * so importing 'electron' is never required and the same code path runs
   * under `node --test`. One worker, reused across every speak(): the model
   * load happens once, in the child, never on main and never per call.
   */
  function getWorker() {
    if (worker) return worker;
    const file = ttsWorkerFile();
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
   * Synthesize `text`, invoking onChunk(Float32Array) per sentence as each
   * ONNX run finishes in the worker — real streaming, so the renderer plays
   * sentence one while later sentences synthesize. Resolves when the
   * utterance completes, stops early when `signal` aborts, and rejects on
   * model-load failure, a sampling-rate contract violation, or the worker
   * dying mid-utterance.
   *
   * @param {string} text
   * @param {{ onChunk?: (audio: Float32Array) => void, signal?: AbortSignal }} [opts]
   * @returns {Promise<void>}
   */
  function speak(text, { onChunk, signal } = {}) {
    return new Promise((resolve, reject) => {
      let w;
      try {
        w = getWorker();
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
        return;
      }

      const reqId = nextReqId++;
      let settled = false;

      const cleanup = () => {
        w.off("message", onMessage);
        w.off("error", onWorkerDown);
        w.off("exit", onWorkerDown);
        signal?.removeEventListener("abort", onAbort);
      };
      const finish = (fn) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn();
      };

      const onAbort = () => {
        if (!settled) w.send({ reqId, kind: "abort" });
      };
      signal?.addEventListener("abort", onAbort);

      const onWorkerDown = (e) => {
        finish(() =>
          reject(e instanceof Error ? e : new Error("local TTS worker exited unexpectedly")),
        );
      };

      const onMessage = (msg) => {
        if (!msg || msg.reqId !== reqId) return;
        switch (msg.type) {
          case "ready":
            break;
          case "chunk":
            if (signal?.aborted) break;
            if (msg.sampleRate !== LOCAL_TTS_SAMPLE_RATE) {
              // Contract violation — fail loudly rather than emit wrong-pitch audio.
              finish(() =>
                reject(
                  new Error(
                    `local TTS produced ${msg.sampleRate} Hz audio (expected ${LOCAL_TTS_SAMPLE_RATE})`,
                  ),
                ),
              );
              break;
            }
            if (Array.isArray(msg.audio) && msg.audio.length > 0) {
              onChunk?.(Float32Array.from(msg.audio));
            }
            break;
          case "done":
            finish(resolve);
            break;
          case "init-error":
            finish(() => reject(new Error(msg.detail)));
            break;
          case "error":
            finish(() => reject(new Error(msg.message)));
            break;
        }
      };

      w.on("message", onMessage);
      w.on("error", onWorkerDown);
      w.on("exit", onWorkerDown);
      w.send({ reqId, kind: "speak", text, cacheDir, voice });
    });
  }

  /** Terminate the singleton worker. Tests call this so `node --test` can
   *  exit; the app never needs it (process teardown reclaims the child). */
  async function shutdown() {
    const w = worker;
    worker = null;
    if (!w) return;
    // getWorker() unref()s the child so a live worker never holds the app
    // process open. That also means an unref'd handle's "exit" event does
    // not keep node's event loop alive — awaiting it here would otherwise
    // let the loop see nothing left to do and exit anyway (test callers hit
    // this as an "unsettled top-level await" warning). ref() it back while
    // we deliberately wait for the exit we just asked for.
    w.ref();
    await new Promise((resolveExit) => {
      w.once("exit", () => resolveExit());
      w.kill();
    });
  }

  return { speak, sampleRate: LOCAL_TTS_SAMPLE_RATE, shutdown };
}
