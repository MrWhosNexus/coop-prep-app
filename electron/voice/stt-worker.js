// electron/voice/stt-worker.js
//
// Forked CHILD PROCESS that runs Whisper transcription OFF the Electron main
// event loop. Ported from nexus/electron/main/companion-stt-worker.ts.
//
// @huggingface/transformers rides the same ONNX runtime as Kokoro TTS
// (tts-worker.js): the forward pass is a SYNCHRONOUS native call that blocks
// whatever thread/process it runs on for its full duration. Doing it inline
// in Electron main freezes the renderer's IPC round trips for that whole
// span — and a parallel wake-word feature calls transcribe() frequently, so
// that block would recur constantly rather than once per user-initiated
// utterance.
//
// This MUST be a separate PROCESS, not a worker_thread — see tts-worker.js
// for why (onnxruntime-node's async inference callback intermittently runs
// without a V8 HandleScope on a worker thread's isolate and SIGABRTs the
// whole app; a forked child process has its own isolate with a proper
// HandleScope). `fork` (not `utilityProcess`) keeps `electron` out of this
// file's module graph entirely, so it runs under plain `node --test`;
// ELECTRON_RUN_AS_NODE=1 (set by the parent, see stt-local.js) makes the
// forked Electron binary behave as plain Node.
//
// Protocol:
//   in  : { reqId, kind:'transcribe', samples: number[], cacheDir, modelId }
//   out : { reqId, ok:true, text }
//       | { reqId, ok:false, reason, detail? }
// `samples` travels the wire as a plain number[] (see tts-worker.js's audio
// field for why) and is reconstituted into a Float32Array here before
// Whisper sees it. Every failure — model load or transcription — replies
// with `ok:false` rather than letting the process crash or hang silently.

import { LOCAL_STT_DTYPE, LOCAL_STT_MODEL_ID } from "./stt-local.js";

/** Whisper's fixed 30 s receptive field. Longer audio must be chunked. */
const WHISPER_WINDOW_S = 30;

if (!process.send) {
  throw new Error("stt-worker.js must be run as a forked child process");
}

const post = (msg) => process.send?.(msg);

let pipelinePromise = null;
function getPipeline(cacheDir, modelId) {
  if (pipelinePromise) return pipelinePromise;
  const p = (async () => {
    const { pipeline, env: hfEnv } = await import("@huggingface/transformers");
    if (cacheDir) hfEnv.cacheDir = cacheDir;
    return pipeline("automatic-speech-recognition", modelId || LOCAL_STT_MODEL_ID, {
      dtype: LOCAL_STT_DTYPE,
      device: "cpu",
    });
  })();
  pipelinePromise = p;
  p.catch(() => {
    if (pipelinePromise === p) pipelinePromise = null;
  });
  return p;
}

// Serialize transcriptions: the pipeline is one instance and a native run
// blocks this process anyway, so overlapping requests would only queue
// behind each other on the model regardless.
let tail = Promise.resolve();

process.on("message", (msg) => {
  if (!msg || msg.kind !== "transcribe") return;
  const { reqId, samples, cacheDir, modelId } = msg;
  tail = tail
    .then(() => handleTranscribe(reqId, Float32Array.from(samples), cacheDir, modelId))
    .catch(() => {});
});

async function handleTranscribe(reqId, samples, cacheDir, modelId) {
  try {
    const stt = await getPipeline(cacheDir, modelId);
    const out = await stt(samples, {
      // Audio longer than Whisper's 30 s window is transcribed in
      // overlapping chunks and stitched; without these the tail is silently
      // dropped.
      chunk_length_s: WHISPER_WINDOW_S,
      stride_length_s: 5,
    });
    const first = Array.isArray(out) ? out[0] : out;
    const text = (first?.text ?? "").trim();
    post({ reqId, ok: true, text });
  } catch (e) {
    post({
      reqId,
      ok: false,
      reason: "voice model unavailable",
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}
