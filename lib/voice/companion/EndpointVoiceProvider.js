// lib/voice/companion/EndpointVoiceProvider.js
//
// The companion voice pipeline, ported from
// nexus/renderer/src/panels/companion/voice/MiniMaxVoiceProvider.ts and
// re-plumbed onto coop-prep's IPC seams. The class structure, VAD constants,
// onMicFrame, checkWakeWord, submitUtterance, setRuntime/setPushToTalk/
// setMicMuted/setWakeWordEnabled, startMouthMeter and stopSpeaking are carried
// VERBATIM. Only the four I/O seams changed:
//
//   1. connect(): no session handshake — openMic() + report connected.
//   2. transcribe: window.coop.voice.transcribe(encodeWav16(frames)) (local
//      Whisper) instead of a POST — { ok, text } shape is identical.
//   3. turn: the 'nexus' runtime is a single callLLM() over the endpoint
//      registry (ai:call, keys stay in main); 'hermes' streams the local CLI
//      over window.coop.hermes. No tool loop — onToolCall stays a no-op.
//   4. speak(): window.coop.voice.speak(text) + onSpeakStream (Float32 chunks),
//      scheduled through the SAME AnalyserNode so lip-sync stays real.
//
// *** SECURITY INVARIANT — the load-bearing gate ***
// onMicFrame's FIRST action after the mute check is the push-to-talk gate:
//   if (requiresPushToTalk(this.runtime)) { if (!this.ptt) return; push; return }
// so ALL VAD + barge-in + wake-word code below it is UNREACHABLE for 'hermes'.
// An always-on / wake mic frame can NEVER reach hermes.run → the Hermes CLI
// (real shell / RCE surface). setRuntime clears ptt + drops buffered audio +
// disarms wake on EVERY switch. See VoiceProvider.js's docblock.

import { MOUTH_REST, newEntry } from "./types.js";
import { requiresPushToTalk } from "./VoiceProvider.js";
import { encodeWav16 } from "../wav16.js";
import { matchesWakePhrase, WakeCheckLimiter } from "../wakeWord.js";
import { playWakeChirp } from "../chirp.js";
import { callLLM } from "@/lib/ai/client";

// VAD tuning (16 kHz mono float frames).
const VAD_START_RMS = 0.02;
const VAD_KEEP_RMS = 0.012;
const VAD_HANG_MS = 850;
const VAD_MIN_UTTERANCE_MS = 350;
const BARGE_IN_MS = 260;

const DEFAULT_SPEAK_SAMPLE_RATE = 24000;

export class EndpointVoiceProvider {
  /**
   * @param {{ bridge?: object, llm?: typeof callLLM }} [deps] bridge is
   *   window.coop (injectable for tests); llm defaults to callLLM.
   */
  constructor({ bridge, llm } = {}) {
    this.bridge = bridge ?? (typeof window !== "undefined" ? window.coop : undefined);
    this.llm = llm ?? callLLM;

    /** @type {import('./VoiceProvider.js').VoiceCallbacks | null} */
    this.cb = null;
    this.disposed = false;

    // Endpoint target (ref-updated via setEndpointTarget, not a reconnect).
    this.endpointId = "";
    this.model = "";
    this.system = "";
    this.hasEndpoint = false;

    // Mic side
    this.micStream = null;
    this.micCtx = null;
    this.micNode = null;
    /** @type {Float32Array[]} */
    this.utterance = [];
    this.speechActive = false;
    this.speechMs = 0;
    this.silenceMs = 0;
    this.bargeMs = 0;
    this.sttNoticeShown = false;
    this.micMuted = false;
    /** @type {import('./VoiceProvider.js').VoiceRuntime} */
    this.runtime = "nexus";
    this.ptt = false;

    // Wake word ("Hey Nexus" / "Yo Nexus"), DEFAULT FALSE.
    this.wakeWordEnabled = false;
    this.wakeArmed = false;
    this.wakeLimiter = new WakeCheckLimiter();

    // Speaker side
    this.outCtx = null;
    this.analyser = null;
    this.outGain = null;
    this.playHead = 0;
    this.liveSources = new Set();
    this.speakUnsub = null;
    this.activeSpeakId = null;
    this.speakSampleRate = DEFAULT_SPEAK_SAMPLE_RATE;
    this.mouthRaf = 0;
    this.speaking = false;
    this.busy = false;
  }

  /** @param {import('./VoiceProvider.js').VoiceCallbacks} callbacks */
  async connect(callbacks) {
    this.cb = callbacks;
    this.disposed = false;
    callbacks.onConnectionState("connecting");
    await this.openMic();
    if (this.disposed) return;
    callbacks.onConnectionState("connected");
    callbacks.onMood("idle");
    if (!this.hasEndpoint) {
      // STT and TTS are local and need no key, so the session connects and you
      // can still talk to Hermes. Only the endpoint 'nexus' voice needs a
      // configured endpoint. Warn, don't block.
      callbacks.onTranscript(
        newEntry(
          "system",
          "No AI endpoint configured — the built-in voice can't answer yet. " +
            "Add one in Settings, or switch the runtime to Hermes, which needs no key.",
        ),
      );
    }
  }

  disconnect() {
    this.disposed = true;
    this.stopSpeaking();
    this.micNode?.disconnect();
    this.micNode = null;
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
    void this.micCtx?.close().catch(() => undefined);
    this.micCtx = null;
    void this.outCtx?.close().catch(() => undefined);
    this.outCtx = null;
    this.analyser = null;
    this.outGain = null;
    this.cb?.onMouthShape(MOUTH_REST);
    this.cb?.onMood("idle");
    this.cb?.onConnectionState("idle");
    this.cb = null;
  }

  /** @param {string} text */
  sendText(text) {
    const trimmed = text.trim();
    if (!trimmed || !this.cb) return;
    if (this.speaking) this.stopSpeaking(); // typed interrupt
    void this.runUserTurn(trimmed);
  }

  /**
   * Update the endpoint target without tearing down the session. The widget
   * calls this from its endpoint/model discovery + system-prompt effects.
   *
   * @param {{ endpointId?: string, model?: string, system?: string, hasEndpoint?: boolean }} target
   */
  setEndpointTarget({ endpointId, model, system, hasEndpoint } = {}) {
    if (endpointId !== undefined) this.endpointId = endpointId;
    if (model !== undefined) this.model = model;
    if (system !== undefined) this.system = system;
    if (hasEndpoint !== undefined) this.hasEndpoint = hasEndpoint;
  }

  // --- mic capture + VAD ----------------------------------------------------

  async openMic() {
    if (!this.cb) return;
    if (
      typeof navigator === "undefined" ||
      typeof navigator.mediaDevices?.getUserMedia !== "function" ||
      typeof window === "undefined" ||
      typeof window.AudioContext !== "function"
    ) {
      // No mic API (web/dev, or the test env): typed input still works.
      this.cb.onTranscript(
        newEntry("system", "microphone unavailable here — type to talk; replies are spoken."),
      );
      return;
    }
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (this.disposed || !this.cb) {
        this.micStream.getTracks().forEach((t) => t.stop());
        return;
      }
      // A mute set before the stream existed must survive: apply it to the
      // fresh track rather than come back live.
      if (this.micMuted) this.micStream.getAudioTracks().forEach((t) => (t.enabled = false));
    } catch {
      this.cb?.onTranscript(
        newEntry("system", "microphone unavailable (permission denied) — typed input only."),
      );
      return;
    }
    this.micCtx = new window.AudioContext({ sampleRate: 16000 });
    const src = this.micCtx.createMediaStreamSource(this.micStream);
    this.micNode = this.micCtx.createScriptProcessor(4096, 1, 1);
    src.connect(this.micNode);
    this.micNode.connect(this.micCtx.destination); // required for onaudioprocess
    this.micNode.onaudioprocess = (ev) => this.onMicFrame(ev.inputBuffer.getChannelData(0));
    this.cb?.onTranscript(newEntry("system", "mic live — transcribing locally."));
  }

  /**
   * Mute the mic without dropping the session. Disabling the track is the real
   * mute; the early return in onMicFrame is what makes it honest immediately —
   * a half-captured utterance is discarded rather than flushed later.
   *
   * @param {boolean} muted
   */
  setMicMuted(muted) {
    this.micMuted = muted;
    this.micStream?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
    if (muted) {
      // Drop anything mid-utterance; muting is not "finish this thought".
      this.utterance = [];
      this.speechActive = false;
      this.speechMs = 0;
      this.silenceMs = 0;
      this.bargeMs = 0;
      // A muted mic hears nothing, so an armed wake word must not silently fire
      // off whatever utterance shows up once it's unmuted.
      this.wakeArmed = false;
      if (!this.busy) this.cb?.onMood("idle");
    }
  }

  /** @param {Float32Array} frame */
  onMicFrame(frame) {
    if (!this.cb || this.disposed || this.micMuted) return;

    // The push-to-talk gate, at CAPTURE.
    //
    // Not at submit: buffering ambient audio and filtering it later is one bug
    // away from the thing this prevents. While the control is up, the frame is
    // dropped here and never exists. While it is held, VAD is bypassed entirely
    // — the hold is the endpoint, and release submits.
    if (requiresPushToTalk(this.runtime)) {
      if (!this.ptt) return;
      this.utterance.push(frame.slice());
      return;
    }
    const frameMs = (frame.length / 16000) * 1000;
    let sum = 0;
    for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
    const rms = Math.sqrt(sum / frame.length);

    // Barge-in: sustained speech over the playback interrupts the reply.
    if (this.speaking) {
      this.bargeMs = rms > VAD_START_RMS * 1.6 ? this.bargeMs + frameMs : 0;
      if (this.bargeMs >= BARGE_IN_MS) {
        this.bargeMs = 0;
        this.stopSpeaking();
        this.cb.onMood("listening");
      }
      return;
    }

    if (!this.speechActive) {
      if (rms > VAD_START_RMS) {
        this.speechActive = true;
        this.speechMs = frameMs;
        this.silenceMs = 0;
        this.utterance = [frame.slice()];
        if (!this.busy) this.cb.onMood("listening");
      }
      return;
    }

    this.utterance.push(frame.slice());
    if (rms > VAD_KEEP_RMS) {
      this.speechMs += frameMs;
      this.silenceMs = 0;
    } else {
      this.silenceMs += frameMs;
    }
    if (this.silenceMs >= VAD_HANG_MS) {
      const utterance = this.utterance;
      const voicedMs = this.speechMs;
      this.speechActive = false;
      this.speechMs = 0;
      this.silenceMs = 0;
      this.utterance = [];
      if (!this.busy) this.cb.onMood("idle");
      if (voicedMs >= VAD_MIN_UTTERANCE_MS) {
        // Wake word: only ever reachable here, i.e. only for a runtime that
        // does NOT require push-to-talk (the PTT branch above returns before
        // any of this code runs) — see the class-level SECURITY note.
        if (this.wakeWordEnabled && !this.wakeArmed) {
          void this.checkWakeWord(utterance);
        } else {
          // Consume the arm: exactly one command turn per wake-word hit.
          this.wakeArmed = false;
          void this.submitUtterance(utterance);
        }
      }
    }
  }

  /**
   * Rate-limited, on-device wake-word probe. Fails closed and quiet: no match,
   * no local STT, or a transport error all just leave the mic listening for the
   * wake word — never an error surfaced to the user. The audio here reaches
   * ONLY the local Whisper transcribe() call, never the LLM or Hermes.
   *
   * @param {Float32Array[]} frames
   */
  async checkWakeWord(frames) {
    if (!this.cb || this.disposed || this.busy || this.speaking) return;
    if (!this.wakeLimiter.tryAcquire(Date.now())) return;
    try {
      const data = await this.bridge?.voice?.transcribe(encodeWav16(frames));
      if (!data?.ok || !data.text) return;
      if (!matchesWakePhrase(data.text)) return;
      if (this.disposed || !this.wakeWordEnabled) return;
      this.wakeArmed = true;
      const outCtx = this.ensureOutput();
      if (outCtx.state === "suspended") await outCtx.resume().catch(() => undefined);
      playWakeChirp(outCtx);
      this.cb?.onMood("listening");
    } catch {
      /* transient — stays awaiting the wake word, nothing surfaced */
    }
  }

  /** @param {Float32Array[]} frames */
  async submitUtterance(frames) {
    if (!this.cb || this.busy) return;
    try {
      const data = await this.bridge?.voice?.transcribe(encodeWav16(frames));
      if (data?.ok && data.text) {
        void this.runUserTurn(data.text);
        return;
      }
      if (!this.sttNoticeShown) {
        this.sttNoticeShown = true;
        this.cb.onTranscript(
          newEntry("system", data?.reason ?? "speech-to-text unavailable — typed input only."),
        );
      }
    } catch {
      /* transient — VAD keeps listening */
    }
  }

  // --- runtime switching + the talk gate ------------------------------------

  /** @param {import('./VoiceProvider.js').VoiceRuntime} runtime */
  setRuntime(runtime) {
    this.runtime = runtime;
    // Switching runtimes drops any half-captured audio and un-holds the gate.
    // Carrying a stale `ptt = true` into hermes would leave it wide open, which
    // is the one state this whole mechanism exists to prevent.
    this.ptt = false;
    this.utterance = [];
    this.speechActive = false;
    this.speechMs = 0;
    this.silenceMs = 0;
    // A wake-word arm is "the next utterance is a command FOR THIS RUNTIME"; it
    // must not survive a runtime switch made while armed.
    this.wakeArmed = false;
  }

  /**
   * Enable/disable the on-device wake word. DEFAULT FALSE. Disabling drops any
   * pending arm.
   * @param {boolean} enabled
   */
  setWakeWordEnabled(enabled) {
    this.wakeWordEnabled = enabled;
    if (!enabled) this.wakeArmed = false;
  }

  /**
   * The talk control, held and released. Only meaningful for a push-to-talk
   * runtime; releasing submits whatever was captured while held. No VAD here on
   * purpose: for hermes the hold IS the endpoint detector.
   * @param {boolean} down
   */
  setPushToTalk(down) {
    if (!requiresPushToTalk(this.runtime)) return;
    if (down === this.ptt) return;
    this.ptt = down;
    if (down) {
      this.utterance = [];
      if (!this.busy) this.cb?.onMood("listening");
      return;
    }
    const captured = this.utterance;
    this.utterance = [];
    if (!this.busy) this.cb?.onMood("idle");
    // A tap is not an utterance — 4096 frames at 16k is 256ms each.
    const ms = (captured.length * 4096 * 1000) / 16000;
    if (ms >= VAD_MIN_UTTERANCE_MS) void this.submitUtterance(captured);
  }

  // --- reasoning turn -------------------------------------------------------

  /**
   * One spoken turn. 'nexus' runs a single endpoint call (ai:call, no tool
   * loop); 'hermes' streams the local CLI. The reply is spoken through the same
   * local TTS path either way.
   *
   * @param {string} text
   */
  async runUserTurn(text) {
    if (!this.cb || this.busy) return;
    this.busy = true;
    const cb = this.cb;
    cb.onTranscript(newEntry("user", text));
    cb.onMood("thinking");

    if (this.runtime === "hermes") {
      try {
        const reply = await this.runHermes(text);
        if (!reply) {
          cb.onTranscript(newEntry("system", "hermes returned nothing."));
          cb.onMood("idle");
        } else {
          cb.onTranscript(newEntry("hermes", reply));
          await this.speak(reply);
        }
      } catch (e) {
        cb.onTranscript(
          newEntry("system", `hermes unreachable — ${e instanceof Error ? e.message : "failed"}`),
        );
        cb.onMood("error");
      } finally {
        this.busy = false;
        if (!this.speaking && !this.disposed) this.cb?.onMood("idle");
      }
      return;
    }

    // Endpoint runtime ('nexus'). Single-turn text-only: ai:call's string-
    // content contract forecloses the Anthropic tool loop / block history, so
    // there is no rolling assistant history smuggled through here.
    try {
      const result = await this.llm(
        { system: this.system, user: text, endpointId: this.endpointId, model: this.model, options: {} },
        this.bridge,
      );
      if (result?.ok) {
        cb.onTranscript(newEntry("nexus", result.text));
        await this.speak(result.text);
      } else {
        cb.onMood("error");
        cb.onTranscript(
          newEntry("system", result?.error?.message ?? "the model returned no reply"),
        );
      }
    } catch (e) {
      cb.onMood("error");
      cb.onTranscript(newEntry("system", e instanceof Error ? e.message : "turn failed"));
    } finally {
      this.busy = false;
      if (!this.speaking && !this.disposed) this.cb?.onMood("idle");
    }
  }

  /**
   * Stream one Hermes turn over window.coop.hermes. Reached ONLY from
   * runUserTurn, which is reached (for hermes) ONLY via the PTT branch of
   * onMicFrame or a typed send — never from the wake/VAD path.
   *
   * @param {string} text
   * @returns {Promise<string>}
   */
  runHermes(text) {
    const hermes = this.bridge?.hermes;
    if (!hermes || typeof hermes.run !== "function") {
      return Promise.reject(new Error("Hermes needs the desktop app."));
    }
    const requestId = `hermes-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve, reject) => {
      let out = "";
      let settled = false;
      let unsub = () => {};
      const finish = (fn, arg) => {
        if (settled) return;
        settled = true;
        unsub();
        fn(arg);
      };
      unsub =
        typeof hermes.onStream === "function"
          ? hermes.onStream((evt) => {
              if (!evt || evt.requestId !== requestId) return;
              if (evt.type === "chunk") out += evt.delta ?? "";
              else if (evt.type === "done") finish(resolve, out.trim());
              else if (evt.type === "error")
                finish(reject, new Error(String(evt.error ?? "hermes error")));
            })
          : () => {};
      Promise.resolve(hermes.run(text, requestId)).catch((e) =>
        finish(reject, e instanceof Error ? e : new Error(String(e))),
      );
    });
  }

  // --- spoken output + real lip-sync ----------------------------------------

  ensureOutput() {
    if (this.outCtx && this.outCtx.state !== "closed") return this.outCtx;
    const rate = this.speakSampleRate ?? DEFAULT_SPEAK_SAMPLE_RATE;
    this.outCtx = new window.AudioContext({ sampleRate: rate });
    this.outGain = this.outCtx.createGain();
    this.analyser = this.outCtx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.outGain.connect(this.outCtx.destination);
    this.outGain.connect(this.analyser);
    return this.outCtx;
  }

  /** @param {string} text */
  async speak(text) {
    if (!this.cb || this.disposed) return;
    if (typeof window === "undefined" || typeof window.AudioContext !== "function") {
      // No Web Audio (test/web): fire the request so the reply is still spoken
      // where a bridge exists, but skip scheduling/lip-sync.
      await Promise.resolve(this.bridge?.voice?.speak?.(text)).catch(() => undefined);
      return;
    }
    const cb = this.cb;
    const ctx = this.ensureOutput();
    if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
    this.speaking = true;
    this.playHead = ctx.currentTime + 0.08;
    cb.onMood("speaking");
    this.startMouthMeter();
    try {
      await this.streamSpeech(text, ctx);
      // Let scheduled audio drain before dropping the speaking state.
      const remaining = Math.max(0, this.playHead - ctx.currentTime);
      await new Promise((r) => setTimeout(r, remaining * 1000 + 60));
    } catch {
      /* aborted (interrupt) or transport error — fall through to cleanup */
    } finally {
      this.stopSpeaking();
    }
  }

  /**
   * Drive window.coop.voice.speak + onSpeakStream: capture the meta sampleRate,
   * schedule each Float32 chunk, resolve on done (reject on error).
   *
   * @param {string} text
   * @param {AudioContext} ctx
   * @returns {Promise<void>}
   */
  streamSpeech(text, ctx) {
    const voice = this.bridge?.voice;
    if (!voice || typeof voice.speak !== "function" || typeof voice.onSpeakStream !== "function") {
      return Promise.reject(new Error("Voice needs the desktop app."));
    }
    return new Promise((resolve, reject) => {
      let requestId = null;
      let settled = false;
      const finish = (fn, arg) => {
        if (settled) return;
        settled = true;
        this.speakUnsub?.();
        this.speakUnsub = null;
        fn(arg);
      };
      this.speakUnsub = voice.onSpeakStream((evt) => {
        if (!evt) return;
        // Until the ack lands we don't know our requestId; accept events (only
        // one speak is ever in flight), then filter once known.
        if (requestId && evt.requestId !== requestId) return;
        if (evt.type === "meta") {
          this.speakSampleRate = evt.sampleRate ?? this.speakSampleRate;
        } else if (evt.type === "chunk") {
          this.scheduleFloat32(evt.audio, ctx);
        } else if (evt.type === "done") {
          finish(resolve, undefined);
        } else if (evt.type === "error") {
          finish(reject, new Error(String(evt.error ?? "the voice stream failed")));
        }
      });
      Promise.resolve(voice.speak(text))
        .then((ack) => {
          requestId = ack?.requestId ?? null;
          this.activeSpeakId = requestId;
        })
        .catch((e) => finish(reject, e instanceof Error ? e : new Error(String(e))));
    });
  }

  /**
   * Schedule one streamed Float32 PCM chunk back-to-back on the analyser path.
   * The buffer is built at the meta-reported sampleRate (default 24000), NOT
   * the mic's 16000 — getting that wrong garbles audio and lip-sync.
   *
   * @param {Float32Array|number[]} chunk
   * @param {AudioContext} ctx
   */
  scheduleFloat32(chunk, ctx) {
    if (!this.speaking || !this.outGain) return;
    const len = chunk?.length ?? 0;
    if (!len) return;
    const rate = this.speakSampleRate || DEFAULT_SPEAK_SAMPLE_RATE;
    const buffer = ctx.createBuffer(1, len, rate);
    buffer.getChannelData(0).set(chunk);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.outGain);
    const at = Math.max(this.playHead, ctx.currentTime);
    src.start(at);
    this.playHead = at + buffer.duration;
    this.liveSources.add(src);
    src.onended = () => this.liveSources.delete(src);
  }

  /** Real lip-sync: output-analyser RMS + band split → MouthShape frames. */
  startMouthMeter() {
    if (!this.cb || !this.analyser) return;
    const cb = this.cb;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cb.onMouthShape({ open: 0.4, width: 0.35, round: 0.1, teeth: 0.3 });
      return;
    }
    const analyser = this.analyser;
    const time = new Float32Array(analyser.fftSize);
    const freq = new Uint8Array(analyser.frequencyBinCount);
    let smooth = { ...MOUTH_REST };
    const tick = () => {
      if (!this.speaking) return;
      analyser.getFloatTimeDomainData(time);
      analyser.getByteFrequencyData(freq);
      let sum = 0;
      for (let i = 0; i < time.length; i++) sum += time[i] * time[i];
      const rms = Math.sqrt(sum / time.length);
      const third = freq.length / 3;
      let low = 0;
      let mid = 0;
      let high = 0;
      for (let i = 0; i < freq.length; i++) {
        if (i < third) low += freq[i];
        else if (i < third * 2) mid += freq[i];
        else high += freq[i];
      }
      low /= third * 255;
      mid /= third * 255;
      high /= third * 255;
      const target = {
        open: Math.min(1, rms * 7),
        width: 0.22 + Math.min(0.5, mid * 1.2),
        round: Math.min(1, low * 1.1),
        teeth: Math.min(1, high * 1.6),
      };
      const a = 0.45; // smoothing
      smooth = {
        open: smooth.open + (target.open - smooth.open) * a,
        width: smooth.width + (target.width - smooth.width) * a,
        round: smooth.round + (target.round - smooth.round) * a,
        teeth: smooth.teeth + (target.teeth - smooth.teeth) * a,
      };
      cb.onMouthShape(smooth);
      this.mouthRaf = requestAnimationFrame(tick);
    };
    this.mouthRaf = requestAnimationFrame(tick);
  }

  stopSpeaking() {
    if (this.mouthRaf) cancelAnimationFrame(this.mouthRaf);
    this.mouthRaf = 0;
    this.speakUnsub?.();
    this.speakUnsub = null;
    // Cancel the in-flight synthesis so a barge-in/interrupt actually silences
    // main's stream, not just the local playback.
    if (this.activeSpeakId != null && typeof this.bridge?.voice?.cancel === "function") {
      Promise.resolve(this.bridge.voice.cancel(this.activeSpeakId)).catch(() => undefined);
    }
    this.activeSpeakId = null;
    for (const src of this.liveSources) {
      try {
        src.stop();
      } catch {
        /* not started yet */
      }
    }
    this.liveSources.clear();
    const wasSpeaking = this.speaking;
    this.speaking = false;
    this.cb?.onMouthShape(MOUTH_REST);
    if (wasSpeaking && !this.disposed && !this.busy) this.cb?.onMood("idle");
  }
}
