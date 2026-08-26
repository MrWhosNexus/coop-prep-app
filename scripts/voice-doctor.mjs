#!/usr/bin/env node
// scripts/voice-doctor.mjs
//
// "Is local voice actually going to work on this machine?" — answered by
// running it, not by inspecting a manifest.
//
// The voice stack is the one part of this app that is NOT self-contained at
// install time: `npm install` brings down the ONNX runtimes, but the model
// WEIGHTS (~165 MB) are fetched from Hugging Face on FIRST USE and cached under
// the app's userData dir. That is a bad thing to discover mid-study-session on
// hotel wifi, and a worse thing to discover as "the mic button does nothing".
//
// So this script does three separable jobs:
//
//   --status     (default) where the caches are, what is already in them
//   --fetch      warm both caches now, printing progress, so first use is instant
//   --roundtrip  the real proof: synthesize a known sentence with Kokoro, feed
//                the audio back through Whisper, and check the words survive
//
// --roundtrip implies --fetch. `npm run voice:check` runs status + roundtrip.
//
// Why a round-trip rather than two independent "did it load" checks: a model
// that loads and then emits silence, or one that transcribes to "" every time,
// passes every load check there is. Only closing the loop distinguishes "the
// engine started" from "the engine works". It also exercises the exact seam the
// app uses — the forked plain-Node workers — rather than importing the
// libraries directly, which is a different code path with different packaging
// behaviour.
//
// This runs under plain `node`, never Electron, on purpose: it must be usable
// before the app has ever been launched, and it is the same path the packaged
// workers take (they are forked with ELECTRON_RUN_AS_NODE=1).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import {
  createLocalTts,
  defaultTtsCacheDir,
  LOCAL_TTS_MODEL_ID,
  LOCAL_TTS_SAMPLE_RATE,
} from "../electron/voice/tts-local.js";
import {
  createLocalStt,
  defaultSttCacheDir,
  encodeWav16kMono,
  resolveSttModelId,
  LOCAL_STT_SAMPLE_RATE,
} from "../electron/voice/stt-local.js";

// The sentence is deliberately plain, multi-word and free of the certification
// jargon the app is full of: this checks the ENGINES, and a domain word Whisper
// mishears would make a working stack look broken.
const PROBE_TEXT = "The quick brown fox jumps over the lazy dog.";

/**
 * Electron's app.getPath("userData") for THIS app, computed without Electron.
 *
 * The script must agree with the running app about where the caches live or it
 * warms a directory the app will never read — the single way this tool could
 * be actively misleading. These are Electron's own documented locations for
 * `app.setName("coop-prep")` (see electron/main.js, which pins that name).
 *
 * @returns {string}
 */
function electronUserData() {
  const name = "coop-prep";
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), name);
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", name);
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), name);
}

/** Bytes under `dir`, recursively. 0 when it does not exist. */
function dirSize(dir) {
  let total = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { recursive: true, withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    try {
      total += fs.statSync(path.join(entry.parentPath, entry.name)).size;
    } catch {
      /* raced with a concurrent fetch; a slightly low total is fine here */
    }
  }
  return total;
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Linear resample. Kokoro emits 24 kHz and Whisper demands 16 kHz, and the
 * mismatch is silent: hand 24 kHz frames to a 16 kHz model and it hears a
 * chipmunk reading 1.5x too fast, then returns confident nonsense. Quality is
 * irrelevant here — this is a liveness probe, not an audio pipeline.
 *
 * @param {Float32Array} input
 * @param {number} fromRate
 * @param {number} toRate
 * @returns {Float32Array}
 */
export function resample(input, fromRate, toRate) {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const src = i * ratio;
    const lo = Math.floor(src);
    const hi = Math.min(lo + 1, input.length - 1);
    const frac = src - lo;
    out[i] = input[lo] * (1 - frac) + input[hi] * frac;
  }
  return out;
}

/** Words, lowercased, punctuation stripped — for comparing what was said to what was heard. */
export function words(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Fraction of `spoken`'s words that appear in `heard`.
 *
 * Deliberately a recall score against a bag of words, not an exact match: ASR
 * legitimately differs on casing, punctuation and the odd article, and a probe
 * that demands a perfect string would fail on a stack that works fine. The
 * threshold below is set where "it transcribed the sentence" and "it returned
 * plausible garbage" cannot be confused.
 *
 * @param {string} spoken
 * @param {string} heard
 * @returns {number} 0..1
 */
export function recall(spoken, heard) {
  const want = words(spoken);
  if (want.length === 0) return 1;
  const got = new Set(words(heard));
  return want.filter((w) => got.has(w)).length / want.length;
}

const PASS_THRESHOLD = 0.7;

function reportStatus({ ttsCache, sttCache }) {
  const rows = [
    ["Kokoro TTS (speech out)", LOCAL_TTS_MODEL_ID, ttsCache],
    ["Whisper STT (speech in)", resolveSttModelId(), sttCache],
  ];
  console.log("\nLocal voice models\n");
  for (const [label, modelId, dir] of rows) {
    const size = dirSize(dir);
    const state = size === 0 ? "not downloaded yet" : `cached, ${mb(size)}`;
    console.log(`  ${label}`);
    console.log(`    model  ${modelId}`);
    console.log(`    cache  ${dir}`);
    console.log(`    state  ${state}\n`);
  }
  console.log("  Both run entirely on this machine. Nothing you say and nothing");
  console.log("  the app speaks is sent anywhere — the only network access is the");
  console.log("  one-time weight download from Hugging Face.\n");
}

async function roundtrip({ ttsCache, sttCache }) {
  const cold = dirSize(ttsCache) === 0 || dirSize(sttCache) === 0;
  if (cold) {
    console.log("First run downloads ~165 MB of model weights. This happens once.\n");
  }

  const tts = createLocalTts({ userDataDir: null, voice: undefined });
  const stt = createLocalStt({ userDataDir: null });

  try {
    process.stdout.write(`Speaking:  "${PROBE_TEXT}"\n`);
    const chunks = [];
    const startedTts = Date.now();
    await tts.speak(PROBE_TEXT, { onChunk: (audio) => chunks.push(audio) });
    const ttsMs = Date.now() - startedTts;

    const total = chunks.reduce((n, c) => n + c.length, 0);
    if (total === 0) {
      console.error("\nFAIL  the TTS engine produced no audio at all.");
      return 1;
    }
    const merged = new Float32Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    const seconds = merged.length / LOCAL_TTS_SAMPLE_RATE;
    // A model that loads but emits digital silence returns a full-length buffer
    // of zeros, which every length check passes. Peak amplitude catches it.
    const peak = merged.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    console.log(`           ${seconds.toFixed(2)}s of audio, peak ${peak.toFixed(3)}, in ${ttsMs}ms`);
    if (peak < 0.01) {
      console.error("\nFAIL  the TTS engine produced silence (peak amplitude ~0).");
      return 1;
    }

    const wav = encodeWav16kMono(resample(merged, LOCAL_TTS_SAMPLE_RATE, LOCAL_STT_SAMPLE_RATE));
    const startedStt = Date.now();
    const result = await stt.transcribe(wav);
    const sttMs = Date.now() - startedStt;

    if (!result.ok) {
      console.error(`\nFAIL  transcription failed: ${result.reason}${result.detail ? ` — ${result.detail}` : ""}`);
      return 1;
    }
    console.log(`Heard:     "${result.text.trim()}"  (in ${sttMs}ms)`);

    const score = recall(PROBE_TEXT, result.text);
    console.log(`Match:     ${(score * 100).toFixed(0)}% of the spoken words came back\n`);
    if (score < PASS_THRESHOLD) {
      console.error(`FAIL  below the ${PASS_THRESHOLD * 100}% threshold — the loop runs but is not usable.`);
      return 1;
    }
    console.log("PASS  local voice works on this machine, offline, end to end.\n");
    return 0;
  } catch (e) {
    console.error(`\nFAIL  ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  } finally {
    // Both engines fork a long-lived child that outlives this function.
    await Promise.allSettled([tts.shutdown(), stt.shutdown()]);
  }
}

async function fetchOnly({ ttsCache, sttCache }) {
  console.log("Warming both model caches. First run downloads ~165 MB.\n");
  const tts = createLocalTts({ userDataDir: null });
  const stt = createLocalStt({ userDataDir: null });
  try {
    // Downloading IS loading for these engines — there is no separate fetch
    // API, so the smallest possible real request warms the cache.
    await tts.speak("ok", { onChunk: () => {} });
    console.log(`  Kokoro TTS  ready  (${mb(dirSize(ttsCache))})`);
    const silence = encodeWav16kMono(new Float32Array(LOCAL_STT_SAMPLE_RATE / 2));
    await stt.transcribe(silence);
    console.log(`  Whisper STT ready  (${mb(dirSize(sttCache))})\n`);
    return 0;
  } catch (e) {
    console.error(`\nFAIL  ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  } finally {
    await Promise.allSettled([tts.shutdown(), stt.shutdown()]);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const wantFetch = argv.includes("--fetch");
  const wantRoundtrip = argv.includes("--roundtrip");

  // createLocalTts/createLocalStt take a userDataDir and derive the cache from
  // it, but COOP_TTS_CACHE_DIR / COOP_STT_CACHE_DIR override that entirely.
  // Ask the same resolvers the app uses rather than rebuilding the rule here.
  const userData = electronUserData();
  const ttsCache = defaultTtsCacheDir(userData);
  const sttCache = defaultSttCacheDir(userData);
  // The engines are constructed with `userDataDir: null` below; make the
  // resolved dirs authoritative for both this script and them.
  process.env.COOP_TTS_CACHE_DIR ||= ttsCache;
  process.env.COOP_STT_CACHE_DIR ||= sttCache;

  reportStatus({ ttsCache, sttCache });

  if (wantRoundtrip) return roundtrip({ ttsCache, sttCache });
  if (wantFetch) return fetchOnly({ ttsCache, sttCache });

  console.log("  --fetch      download both models now");
  console.log("  --roundtrip  download, then prove the loop works end to end\n");
  return 0;
}

process.exitCode = await main();
