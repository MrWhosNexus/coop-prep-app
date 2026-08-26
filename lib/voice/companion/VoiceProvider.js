// lib/voice/companion/VoiceProvider.js
//
// The seam the companion's voice backend plugs into (ported from
// nexus/renderer/src/panels/companion/voice/VoiceProvider.ts). The face, mood
// machine, lip-sync pipe, and Hub only ever see VoiceCallbacks; swapping the
// endpoint runtime for another backend is a provider change, never a UI change.
//
// *** SECURITY INVARIANT (carried VERBATIM from Nexus) ***
// requiresPushToTalk(runtime) returns true ONLY for 'hermes'. That is the whole
// reason the two-runtime picker exists: `hermes -z` is a local agent with a
// real shell and no approval gate, and this mic can be always-on behind VAD.
// Routing an always-on mic to Hermes would mean anything audible in the room
// reaches a shell. Push-to-talk restores intent: while 'hermes' is selected,
// NOTHING is captured unless the user is physically holding the talk control —
// the gate is in EndpointVoiceProvider.onMicFrame, at capture, not at submit.

/**
 * Which brain answers a spoken turn.
 *
 *   nexus  — the endpoint runtime: routed through coop-prep's existing ai:call
 *            path (the user adds a MiniMax/any endpoint in Settings). Text in,
 *            text out — no tool loop.
 *   hermes — the local `hermes` CLI agent. PUSH-TO-TALK ONLY (see above).
 *
 * @typedef {'nexus'|'hermes'} VoiceRuntime
 */

/** String constants for the runtimes, so callers don't hardcode literals. */
export const VoiceRuntime = Object.freeze({ nexus: "nexus", hermes: "hermes" });

/**
 * Runtimes that refuse ambient audio. VERBATIM from Nexus: `=== 'hermes'` ONLY.
 * A reviewer WILL check this — the always-on/wake mic path is structurally
 * unreachable for any runtime this returns true for.
 *
 * @param {VoiceRuntime} runtime
 * @returns {boolean}
 */
export function requiresPushToTalk(runtime) {
  return runtime === "hermes";
}

/**
 * VoiceCallbacks — the event surface the face/mood/Hub subscribe to.
 * @typedef {Object} VoiceCallbacks
 * @property {(state: 'idle'|'connecting'|'connected'|'error') => void} onConnectionState
 * @property {(mood: import('../companion/types.js').CompanionMood) => void} onMood
 * @property {(shape: import('../companion/types.js').MouthShape) => void} onMouthShape
 * @property {(entry: import('../companion/types.js').TranscriptEntry) => void} onTranscript
 * @property {(artifact: import('../companion/types.js').NexusArtifact) => void} onArtifact
 * @property {(name: string, args: Record<string, unknown>) => Promise<import('../companion/types.js').ToolResult>} onToolCall
 */

/**
 * No-op provider (demo): accepts the callbacks, reports idle, moves no audio.
 * Exists so the widget is already written against the provider seam.
 */
export class NoopVoiceProvider {
  constructor() {
    /** @type {VoiceCallbacks | null} */
    this.callbacks = null;
  }

  /** @param {VoiceCallbacks} callbacks */
  async connect(callbacks) {
    this.callbacks = callbacks;
    callbacks.onConnectionState("idle");
  }

  disconnect() {
    this.callbacks?.onConnectionState("idle");
    this.callbacks = null;
  }

  sendText(_text) {}
  setRuntime(_runtime) {}
  setPushToTalk(_down) {}
  setMicMuted(_muted) {}
  setWakeWordEnabled(_enabled) {}
  setEndpointTarget(_target) {}
}
