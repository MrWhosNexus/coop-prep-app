// electron/voice/tts-worker.js
//
// Forked CHILD PROCESS that runs Kokoro TTS synthesis OFF the Electron main
// event loop. Ported from nexus/electron/main/companion-tts-worker.ts.
//
// onnxruntime-node's inference is a SYNCHRONOUS native call — the forward
// pass blocks whatever thread/process it runs on for its full duration
// (multiple seconds per utterance is normal on CPU). Run inline in Electron
// main, that block starves the IPC/renderer event loop for the same span —
// exactly the "no UI/IPC lag" requirement this change exists to satisfy, and
// worse now that a wake-word listener is transcribing frequently in parallel.
//
// This MUST be a separate PROCESS, not a worker_thread: onnxruntime-node's
// async inference callback intermittently fires without a V8 HandleScope on a
// worker thread's isolate, which SIGABRTs the whole app (documented at length
// in nexus/electron/main/companion-tts-local.ts — reproduced live there). A
// forked child process gets its own V8 isolate with a proper HandleScope, so
// the same native call is safe there. `fork` (not Electron's `utilityProcess`)
// so this file runs under plain `node --test` too, with no `electron` import
// anywhere in its module graph; ELECTRON_RUN_AS_NODE=1 (set by the parent,
// see tts-local.js) makes the forked Electron binary behave as plain Node.
//
// Protocol (mirrors stt-worker.js's shape):
//   in  : { reqId, kind:'speak', text } | { reqId, kind:'abort' }
//   out : { reqId, type:'ready' }
//       | { reqId, type:'chunk', audio: number[], sampleRate }
//       | { reqId, type:'done' }
//       | { reqId, type:'init-error', detail }
//       | { reqId, type:'error', message }
// `audio` travels the wire as a plain number[] — node's default (non-
// "advanced") IPC serialization is JSON, which mangles a Float32Array into an
// indexed object rather than an array. tts-local.js reconstitutes it with
// Float32Array.from() before handing it to the caller's onChunk, so the
// public API (Float32Array chunks) is unchanged.
//
// Load failure and mid-stream failure are reported over the same channel as
// distinct message kinds — this process never throws past its own message
// handler and never crashes silently; every failure reaches the parent.

import {
  LOCAL_TTS_MODEL_ID,
  LOCAL_TTS_DTYPE,
  LOCAL_TTS_SAMPLE_RATE,
  LOCAL_TTS_DEFAULT_VOICE,
} from "./tts-local.js";

if (!process.send) {
  throw new Error("tts-worker.js must be run as a forked child process");
}

const post = (msg) => process.send?.(msg);

/** reqIds whose caller aborted (barge-in): checked between sentences. */
const aborted = new Set();

let modulePromise = null;
function loadKokoroModule() {
  modulePromise ??= import("kokoro-js");
  return modulePromise;
}

let enginePromise = null;
function getEngine(cacheDir) {
  if (enginePromise) return enginePromise;
  const p = (async () => {
    const [{ KokoroTTS }, { env: hfEnv }] = await Promise.all([
      loadKokoroModule(),
      import("@huggingface/transformers"),
    ]);
    if (cacheDir) hfEnv.cacheDir = cacheDir;
    return KokoroTTS.from_pretrained(LOCAL_TTS_MODEL_ID, {
      dtype: LOCAL_TTS_DTYPE,
      device: "cpu",
    });
  })();
  enginePromise = p;
  p.catch(() => {
    if (enginePromise === p) enginePromise = null;
  });
  return p;
}

function resolveVoice(tts, requestedVoice) {
  const requested = requestedVoice || process.env.COOP_TTS_VOICE;
  if (requested && requested.length > 0 && Object.hasOwn(tts.voices, requested)) {
    return requested;
  }
  return LOCAL_TTS_DEFAULT_VOICE;
}

// Serialize utterances: the engine is one instance and a native run blocks
// this process anyway, so overlapping speaks would only interleave badly.
let tail = Promise.resolve();

process.on("message", (msg) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.kind === "abort") {
    aborted.add(msg.reqId);
    return;
  }
  if (msg.kind === "speak") {
    const { reqId, text, cacheDir, voice } = msg;
    tail = tail.then(() => handleSpeak(reqId, text, cacheDir, voice)).catch(() => {});
  }
});

async function handleSpeak(reqId, text, cacheDir, voice) {
  let tts;
  try {
    tts = await getEngine(cacheDir);
  } catch (e) {
    post({ reqId, type: "init-error", detail: e instanceof Error ? e.message : String(e) });
    return;
  }

  post({ reqId, type: "ready" });
  try {
    // Push the whole utterance through an explicitly CLOSED
    // TextSplitterStream. NEVER tts.stream(text) with a bare string:
    // kokoro-js 1.2.1 builds an internal splitter for string input but never
    // close()s it, so the final sentence stays buffered and the async
    // iterator awaits a promise nobody resolves — the stream hangs with no
    // audio and no done.
    const { TextSplitterStream } = await loadKokoroModule();
    const splitter = new TextSplitterStream();
    splitter.push(text);
    splitter.close();

    for await (const chunk of tts.stream(splitter, { voice: resolveVoice(tts, voice) })) {
      if (aborted.has(reqId)) break;
      const sr = chunk.audio.sampling_rate;
      if (sr !== LOCAL_TTS_SAMPLE_RATE) {
        // Contract violation — fail loudly rather than emit wrong-pitch audio.
        throw new Error(`local TTS produced ${sr} Hz audio (expected ${LOCAL_TTS_SAMPLE_RATE})`);
      }
      const samples = chunk.audio.audio;
      if (samples.length > 0) {
        post({ reqId, type: "chunk", audio: Array.from(samples), sampleRate: sr });
      }
    }
    post({ reqId, type: "done" });
  } catch (e) {
    post({ reqId, type: "error", message: e instanceof Error ? e.message : "local tts failed" });
  } finally {
    aborted.delete(reqId);
  }
}
