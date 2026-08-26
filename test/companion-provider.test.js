// test/companion-provider.test.js
//
// The companion voice pipeline (lib/voice/companion/EndpointVoiceProvider.js),
// driven headless — no AudioContext, no mic. onMicFrame, the PTT-at-capture
// gate, setRuntime/setPushToTalk, the transcribe→turn→speak flow, and the
// hermes streaming path are all reachable without Web Audio because the
// provider degrades cleanly where it is absent (speak() fires the bridge
// request; the mic simply never opens).
//
// THE LOAD-BEARING TEST is "SECURITY: an always-on/wake mic frame never reaches
// Hermes without push-to-talk" — it asserts the gate ordering in onMicFrame:
// for the 'hermes' runtime, no VAD/wake code runs and nothing is captured
// unless push-to-talk is held, so an ambient/wake frame can never reach
// window.coop.hermes.run → the Hermes CLI (real shell / RCE surface).

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { EndpointVoiceProvider } from "../lib/voice/companion/EndpointVoiceProvider.js";
import { requiresPushToTalk } from "../lib/voice/companion/VoiceProvider.js";

/** A 4096-sample (256 ms @16k) frame at a constant amplitude. */
function frame(amp) {
  const f = new Float32Array(4096);
  f.fill(amp);
  return f;
}
const LOUD = () => frame(0.3); // rms 0.3 > VAD_START_RMS (0.02)
const SILENT = () => frame(0); // rms 0 < VAD_KEEP_RMS

/** Let queued microtasks/timers drain (transcribe + turn are async). */
async function flush(n = 6) {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
}

/** A window.coop stand-in that records every seam call. */
function makeBridge({ transcript = "hello", hermesReply = "hi from hermes" } = {}) {
  const calls = { transcribe: [], speak: [], hermesRun: [], voiceCancel: [] };
  let hermesStreamCb = null;
  return {
    calls,
    voice: {
      async transcribe(wav) {
        calls.transcribe.push(wav);
        return { ok: true, text: transcript };
      },
      async speak(text) {
        calls.speak.push(text);
        return { requestId: "s1", started: true };
      },
      onSpeakStream() {
        return () => {};
      },
      async cancel(id) {
        calls.voiceCancel.push(id);
      },
    },
    hermes: {
      async run(prompt, requestId) {
        calls.hermesRun.push({ prompt, requestId });
        // Stream a reply asynchronously, exactly like the real IPC channel.
        queueMicrotask(() => {
          hermesStreamCb?.({ requestId, type: "chunk", delta: hermesReply });
          hermesStreamCb?.({ requestId, type: "done" });
        });
        return { requestId, started: true };
      },
      onStream(cb) {
        hermesStreamCb = cb;
        return () => {
          hermesStreamCb = null;
        };
      },
      async status() {
        return { state: "ready" };
      },
    },
  };
}

function makeCallbacks() {
  const transcript = [];
  return {
    transcript,
    cb: {
      onConnectionState() {},
      onMood() {},
      onMouthShape() {},
      onTranscript: (entry) => transcript.push(entry),
      onArtifact() {},
      onToolCall: async () => ({ ok: true }),
    },
  };
}

/** Drive one complete VAD utterance (loud → silence past the hang window). */
function speakVadUtterance(provider) {
  provider.onMicFrame(LOUD());
  provider.onMicFrame(LOUD());
  // 4 silent frames = 1024 ms > VAD_HANG_MS (850).
  provider.onMicFrame(SILENT());
  provider.onMicFrame(SILENT());
  provider.onMicFrame(SILENT());
  provider.onMicFrame(SILENT());
}

describe("requiresPushToTalk is 'hermes'-only (verbatim invariant)", () => {
  test("only the hermes runtime requires push-to-talk", () => {
    assert.equal(requiresPushToTalk("hermes"), true);
    assert.equal(requiresPushToTalk("nexus"), false);
    assert.equal(requiresPushToTalk("anything-else"), false);
  });
});

describe("the PTT-at-capture gate", () => {
  test("SECURITY: an always-on/wake mic frame never reaches Hermes without push-to-talk", async () => {
    const bridge = makeBridge({ transcript: "delete everything" });
    const provider = new EndpointVoiceProvider({ bridge, llm: async () => ({ ok: true, text: "x" }) });
    const { cb } = makeCallbacks();
    await provider.connect(cb);

    // Hermes selected, and wake word ON — the most dangerous configuration.
    provider.setRuntime("hermes");
    provider.setWakeWordEnabled(true);

    // Pour ambient/loud audio at it WITHOUT holding the talk control.
    for (let i = 0; i < 12; i++) speakVadUtterance(provider);
    await flush();

    // The gate returned before any VAD/wake code: nothing captured, the local
    // transcriber (which the wake-check would use) was never called, and the
    // Hermes CLI was never spawned.
    assert.equal(provider.utterance.length, 0, "no frame may be buffered for hermes without PTT");
    assert.equal(bridge.calls.transcribe.length, 0, "wake/VAD transcribe is unreachable for hermes");
    assert.equal(bridge.calls.hermesRun.length, 0, "hermes.run must be unreachable without PTT");

    // Now HOLD the control, speak, and release — the only path that reaches it.
    provider.setPushToTalk(true);
    provider.onMicFrame(LOUD());
    provider.onMicFrame(LOUD()); // 2 × 256 ms = 512 ms > VAD_MIN_UTTERANCE_MS
    provider.setPushToTalk(false);
    await flush();

    assert.equal(bridge.calls.transcribe.length, 1, "release submits the held audio to local STT");
    assert.equal(bridge.calls.hermesRun.length, 1, "and only then does hermes.run run");
    assert.equal(bridge.calls.hermesRun[0].prompt, "delete everything");
  });

  test("the wake-check is structurally unreachable for hermes (no transcribe from ambient audio)", async () => {
    const bridge = makeBridge({ transcript: "hey nexus" });
    const provider = new EndpointVoiceProvider({ bridge });
    const { cb } = makeCallbacks();
    await provider.connect(cb);
    provider.setRuntime("hermes");
    provider.setWakeWordEnabled(true);

    for (let i = 0; i < 8; i++) speakVadUtterance(provider);
    await flush();

    assert.equal(bridge.calls.transcribe.length, 0);
    assert.equal(provider.wakeArmed, false, "a hermes ambient frame can never arm the wake word");
  });

  test("setRuntime clears a stale push-to-talk hold + buffered audio on every switch", () => {
    const bridge = makeBridge();
    const provider = new EndpointVoiceProvider({ bridge });
    provider.connect(makeCallbacks().cb); // sets cb synchronously (openMic no-ops here)
    provider.setRuntime("hermes");
    provider.setPushToTalk(true);
    provider.onMicFrame(LOUD());
    assert.equal(provider.ptt, true);
    assert.ok(provider.utterance.length > 0);

    // Any switch (even away and the gate would carry ptt=true into hermes).
    provider.setRuntime("nexus");
    assert.equal(provider.ptt, false, "ptt must not survive a runtime switch");
    assert.equal(provider.utterance.length, 0, "buffered audio is dropped on a switch");
    assert.equal(provider.wakeArmed, false);
  });

  test("setPushToTalk is a no-op for a non-PTT runtime", () => {
    const provider = new EndpointVoiceProvider({ bridge: makeBridge() });
    provider.setRuntime("nexus");
    provider.setPushToTalk(true);
    assert.equal(provider.ptt, false, "the endpoint runtime can never latch the PTT hold on");
  });

  test("setMicMuted drops the in-flight utterance and disarms the wake word", () => {
    const provider = new EndpointVoiceProvider({ bridge: makeBridge() });
    provider.connect(makeCallbacks().cb);
    provider.setWakeWordEnabled(true);
    provider.wakeArmed = true;
    provider.onMicFrame(LOUD()); // starts a VAD utterance
    assert.ok(provider.utterance.length > 0);
    provider.setMicMuted(true);
    assert.equal(provider.utterance.length, 0);
    assert.equal(provider.wakeArmed, false);
  });
});

describe("transcribe → turn → speak", () => {
  test("a VAD utterance on the endpoint runtime calls the LLM once and speaks the reply", async () => {
    const bridge = makeBridge({ transcript: "how do I answer this" });
    const llmCalls = [];
    const llm = async (req) => {
      llmCalls.push(req);
      return { ok: true, text: "keep it short and specific" };
    };
    const provider = new EndpointVoiceProvider({ bridge, llm });
    await provider.connect(makeCallbacks().cb);
    provider.setEndpointTarget({ endpointId: "ep1", model: "m1", system: "SYS", hasEndpoint: true });

    speakVadUtterance(provider);
    await flush();

    assert.equal(bridge.calls.transcribe.length, 1, "the utterance was transcribed locally");
    assert.equal(llmCalls.length, 1, "exactly one endpoint turn (no tool loop)");
    assert.deepEqual(
      { system: llmCalls[0].system, user: llmCalls[0].user, endpointId: llmCalls[0].endpointId, model: llmCalls[0].model },
      { system: "SYS", user: "how do I answer this", endpointId: "ep1", model: "m1" },
    );
    assert.deepEqual(bridge.calls.speak, ["keep it short and specific"]);
  });

  test("an LLM error surfaces as a system transcript line, not a spoken reply", async () => {
    const bridge = makeBridge();
    const llm = async () => ({ ok: false, error: { message: "endpoint down" } });
    const provider = new EndpointVoiceProvider({ bridge, llm });
    const { transcript, cb } = makeCallbacks();
    await provider.connect(cb);
    provider.setEndpointTarget({ endpointId: "ep1", model: "m1", hasEndpoint: true });

    provider.sendText("hi");
    await flush();

    assert.equal(bridge.calls.speak.length, 0, "nothing is spoken on an error");
    assert.ok(
      transcript.some((e) => e.role === "system" && /endpoint down/.test(e.text)),
      "the error is shown as a system line",
    );
  });

  test("the hermes runtime streams the CLI reply and speaks it", async () => {
    const bridge = makeBridge({ hermesReply: "listed your files" });
    const provider = new EndpointVoiceProvider({ bridge });
    const { transcript, cb } = makeCallbacks();
    await provider.connect(cb);
    provider.setRuntime("hermes");

    // Typed send is an act of intent, exactly like the PTT hold — it reaches
    // hermes without the mic ever being always-on.
    provider.sendText("list my files");
    await flush();

    assert.equal(bridge.calls.hermesRun.length, 1);
    assert.equal(bridge.calls.hermesRun[0].prompt, "list my files");
    assert.deepEqual(bridge.calls.speak, ["listed your files"]);
    assert.ok(transcript.some((e) => e.role === "hermes" && /listed your files/.test(e.text)));
  });
});
