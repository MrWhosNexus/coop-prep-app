"use client";

// components/voice/companion/CompanionWidget.js
//
// The Nexus companion — a free-floating, draggable corner companion that
// replaces NexusVoiceWidget. Ported from
// nexus/renderer/src/panels/companion/CompanionPanel.tsx and re-plumbed onto
// coop-prep's IPC seams (window.coop.voice for local STT/TTS, the endpoint
// registry via ai:call for the 'nexus' turn, and window.coop.hermes for the
// PTT-only 'hermes' runtime).
//
// SECURITY (the UI half of the invariant — see EndpointVoiceProvider.js for the
// capture-side gate): the runtime picker offers 'nexus' (always-on VAD) and
// 'hermes' (PUSH-TO-TALK ONLY). Switching runtimes and releasing the hold both
// call setPushToTalk(false); the hold button uses setPointerCapture so
// releasing off-button still closes the gate. Wake word is OFF by default and
// its audio reaches ONLY window.coop.voice.transcribe (local Whisper).
//
// DEGRADE HONESTLY: when window.coop.voice is absent (plain browser, or a build
// with no voice models), the widget shows a "voice runs in the desktop app"
// pill instead of crashing — matching NexusVoiceWidget's posture.

import { useEffect, useMemo, useRef, useState } from "react";
import { getBridge, pickDefaultEndpointId } from "@/lib/ai/client";
import { selectModelForTask } from "@/lib/ai/lesson-builder";
import { NexusFace } from "./NexusFace";
import { CompanionArtifactPanel } from "./ArtifactPanel";
import { addHubItem, MOUTH_REST } from "@/lib/voice/companion/types.js";
import { EndpointVoiceProvider } from "@/lib/voice/companion/EndpointVoiceProvider.js";
import { NoopVoiceProvider } from "@/lib/voice/companion/VoiceProvider.js";
import {
  applyDragDelta,
  clampToViewport,
  loadPosition,
  savePosition,
} from "@/lib/voice/dragPosition.js";
import "./companion.css";
import "../voice.css";

const TRANSCRIPT_CAP = 80;
const WAKE_WORD_STORAGE_KEY = "coop.nexusVoice.wakeWordEnabled";

function readWakeWordSetting() {
  try {
    return (
      typeof window !== "undefined" &&
      window.localStorage?.getItem(WAKE_WORD_STORAGE_KEY) === "true"
    );
  } catch {
    return false;
  }
}

function writeWakeWordSetting(value) {
  try {
    window.localStorage?.setItem(WAKE_WORD_STORAGE_KEY, String(value));
  } catch {
    // Storage unavailable: the setting just will not survive reload.
  }
}

/**
 * Name what the user is doing right now, for the system prompt. Ported from
 * NexusVoiceWidget (career-prep persona).
 * @param {object} context
 * @returns {string}
 */
function describeContext(context) {
  const c = context ?? {};
  const parts = [];
  if (c.activeToolId) parts.push(`the ${c.activeToolId} tool`);
  if (c.activeLessonId) parts.push(`lesson ${c.activeLessonId}`);
  if (c.activeGuidedId) parts.push(`guided walkthrough ${c.activeGuidedId}`);
  if (c.currentStep !== undefined && c.currentStep !== null && c.currentStep !== "") {
    parts.push(`step ${c.currentStep}`);
  }
  if (c.activeModuleId) parts.push(`module ${c.activeModuleId}`);
  if (parts.length === 0 && c.view) parts.push(`the ${c.view} view`);
  return parts.length > 0 ? parts.join(", ") : "the dashboard home screen";
}

/**
 * The context-aware system prompt.
 * @param {object} context
 * @returns {string}
 */
export function buildSystemPrompt(context) {
  const where = describeContext(context);
  return (
    "You are Nexus, a voice assistant inside a career-prep app called Coop-Prep. " +
    `The user is currently at ${where}. ` +
    "Answer questions about that work, or about anything else the user brings up. " +
    "Keep replies short and speakable, two or three sentences at most."
  );
}

function MicIcon({ active }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" fill={active ? "var(--red-2, #e5484d)" : "currentColor"} />
      <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M12 18v3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/**
 * @param {{
 *   context?: object,
 *   aiOn?: boolean,
 *   voiceEnabled?: boolean,
 *   bridge?: object,
 *   makeProvider?: (deps: { bridge?: object }) => object,
 * }} props
 */
export default function CompanionWidget({
  context = {},
  aiOn = false,
  voiceEnabled = true,
  bridge = getBridge(),
  makeProvider,
}) {
  const [mood, setMood] = useState("idle");
  const [mouthShape, setMouthShape] = useState(MOUTH_REST);
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const hubLoaded = useRef(false);
  const [connection, setConnection] = useState("idle");
  const [providerKind, setProviderKind] = useState("endpoint");
  const [transcript, setTranscript] = useState([]);
  const [draft, setDraft] = useState("");
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);
  const [runtime, setRuntimeState] = useState("nexus");
  const runtimeRef = useRef("nexus");
  const wakeWordEnabledRef = useRef(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(() => readWakeWordSetting());
  const [talking, setTalking] = useState(false);
  const [hermesAvailable, setHermesAvailable] = useState(false);
  const providerRef = useRef(null);
  const transcriptRef = useRef(null);
  const [endpointId, setEndpointId] = useState("");
  const [model, setModel] = useState("");
  // The latest endpoint target, so a provider rebuilt by a swap re-applies it.
  const endpointTargetRef = useRef({ endpointId: "", model: "", system: "", hasEndpoint: false });
  const [open, setOpen] = useState(false);

  // Local STT/TTS availability decides the whole widget: with no voice bridge
  // (plain browser / no models) the companion degrades to an honest pill.
  const voiceAvailable = Boolean(
    bridge?.voice &&
      typeof bridge.voice.transcribe === "function" &&
      typeof bridge.voice.speak === "function",
  );
  const disabled = !voiceAvailable;

  // The single event surface the provider drives; the face/Hub never know which
  // backend is talking.
  const callbacks = useMemo(
    () => ({
      onConnectionState: setConnection,
      onMood: setMood,
      onMouthShape: setMouthShape,
      onTranscript: (entry) => setTranscript((prev) => [...prev.slice(-(TRANSCRIPT_CAP - 1)), entry]),
      onArtifact: (a) => setItems((prev) => addHubItem(prev, a)),
      // The ported companion has NO tool loop — onToolCall is a no-op seam.
      onToolCall: async () => ({ ok: true }),
    }),
    [],
  );

  // Hub persistence: load once at mount, then mirror every change back. The
  // hubLoaded guard stops the initial hydration from round-tripping out as an
  // empty save.
  useEffect(() => {
    let cancelled = false;
    const hub = bridge?.hub;
    if (!hub || typeof hub.load !== "function") {
      hubLoaded.current = true;
      return undefined;
    }
    Promise.resolve(hub.load())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok && Array.isArray(data.items)) setItems(data.items);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) hubLoaded.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  useEffect(() => {
    if (!hubLoaded.current) return;
    const hub = bridge?.hub;
    if (!hub || typeof hub.save !== "function") return;
    Promise.resolve(hub.save(items)).catch(() => undefined);
  }, [items, bridge]);

  // Is the local Hermes CLI installed? Gates the 'hermes' runtime button.
  useEffect(() => {
    let cancelled = false;
    const hermes = bridge?.hermes;
    if (!hermes || typeof hermes.status !== "function") return undefined;
    Promise.resolve(hermes.status())
      .then((s) => {
        if (!cancelled) setHermesAvailable(s?.state !== "not-installed");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  // Endpoint + model discovery, exactly like NexusVoiceWidget.
  useEffect(() => {
    let cancelled = false;
    if (!bridge?.endpoints) return undefined;
    bridge.endpoints
      .list()
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : (res?.endpoints ?? []);
        setEndpointId((current) => current || pickDefaultEndpointId(list));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  useEffect(() => {
    let cancelled = false;
    if (!bridge?.endpoints || !endpointId) return undefined;
    bridge.endpoints
      .models(endpointId)
      .then((result) => {
        if (cancelled) return;
        const ids = Array.isArray(result) ? result : Array.isArray(result?.models) ? result.models : [];
        const names = ids.map((m) => (typeof m === "string" ? m : m?.id)).filter(Boolean);
        setModel(selectModelForTask("summarize", names) ?? names[0] ?? "");
      })
      .catch(() => {
        if (!cancelled) setModel("");
      });
    return () => {
      cancelled = true;
    };
  }, [bridge, endpointId]);

  // Feed the endpoint target (+ context-aware system prompt) to the live
  // provider; keep a ref so a provider rebuilt by a swap re-applies it.
  useEffect(() => {
    const target = {
      endpointId,
      model,
      system: buildSystemPrompt(context),
      hasEndpoint: Boolean(aiOn),
    };
    endpointTargetRef.current = target;
    providerRef.current?.setEndpointTarget(target);
  }, [endpointId, model, context, aiOn]);

  // Provider lifecycle. Rebuilt on a demo swap; re-applies mute/runtime/wake/
  // endpoint-target across the swap so a lapsed flag can't strand the mic on or
  // the target empty. Only runs when voice is actually available and enabled.
  useEffect(() => {
    if (disabled || !voiceEnabled) return undefined;
    const factory = makeProvider ?? ((deps) => new EndpointVoiceProvider(deps));
    const provider = providerKind === "demo" ? new NoopVoiceProvider() : factory({ bridge });
    providerRef.current = provider;
    provider.setMicMuted?.(micMutedRef.current);
    provider.setRuntime?.(runtimeRef.current);
    provider.setWakeWordEnabled?.(wakeWordEnabledRef.current);
    provider.setEndpointTarget?.(endpointTargetRef.current);
    void provider.connect?.(callbacks);
    return () => {
      provider.disconnect?.();
      providerRef.current = null;
    };
  }, [callbacks, providerKind, disabled, voiceEnabled, bridge, makeProvider]);

  // Keep the transcript pinned to the latest entry.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript]);

  /* ─────────────────── free-floating position (reused dragPosition) ─────────────────── */

  const containerRef = useRef(null);
  const [pos, setPos] = useState(() =>
    loadPosition(typeof window !== "undefined" ? window.localStorage : undefined),
  );
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);

  function handleDragPointerDown(e) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPos: pos, moved: false, lastPos: pos };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function handleDragPointerMove(e) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;
    if (!drag.moved) return;
    const el = containerRef.current;
    const widthPx = el?.offsetWidth || (open ? 320 : 120);
    const heightPx = el?.offsetHeight || (open ? 420 : 44);
    const viewportW = typeof window !== "undefined" ? window.innerWidth : 1920;
    const viewportH = typeof window !== "undefined" ? window.innerHeight : 1080;
    const next = clampToViewport(applyDragDelta(drag.startPos, { dx, dy }), {
      widthPx,
      heightPx,
      viewportW,
      viewportH,
    });
    drag.lastPos = next;
    setPos(next);
  }

  function handleDragPointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.moved) {
      suppressClickRef.current = true;
      savePosition(typeof window !== "undefined" ? window.localStorage : undefined, drag.lastPos);
    }
  }

  function consumeDragSuppression() {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  }

  /* ─────────────────── controls ─────────────────── */

  const submitDraft = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    providerRef.current?.sendText?.(text);
  };

  function switchRuntime(rt) {
    setRuntimeState(rt);
    runtimeRef.current = rt;
    // Releasing here too: switching away mid-hold must not leave the gate stuck
    // open behind a button that is no longer rendered.
    setTalking(false);
    providerRef.current?.setPushToTalk?.(false);
    providerRef.current?.setRuntime?.(rt);
  }

  function toggleMic() {
    const next = !micMuted;
    setMicMuted(next);
    micMutedRef.current = next;
    providerRef.current?.setMicMuted?.(next);
  }

  function toggleWakeWord() {
    setWakeWordEnabled((prev) => {
      const next = !prev;
      writeWakeWordSetting(next);
      wakeWordEnabledRef.current = next;
      providerRef.current?.setWakeWordEnabled?.(next);
      return next;
    });
  }

  function handlePillOpen() {
    if (consumeDragSuppression()) return;
    setOpen(true);
  }

  function handleClose() {
    if (consumeDragSuppression()) return;
    setOpen(false);
  }

  if (!voiceEnabled) return null;

  const positionStyle = { position: "fixed", bottom: pos.bottom, right: pos.right, zIndex: 80 };

  if (disabled) {
    return (
      <div className="nexus-voice" style={positionStyle} ref={containerRef}>
        <div className="nexus-voice-pill glass-strong nexus-voice-disabled" data-testid="nexus-voice-disabled">
          <MicIcon active={false} />
          <span>Voice runs locally in the desktop app. Open Coop Prep as the desktop app to talk.</span>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="nexus-voice" style={positionStyle} ref={containerRef}>
        <button
          type="button"
          className="nexus-voice-pill glass-strong nexus-voice-mic nexus-voice-drag-handle"
          aria-label="Open Nexus companion"
          data-testid="nexus-voice-drag-handle"
          onClick={handlePillOpen}
          onPointerDown={handleDragPointerDown}
          onPointerMove={handleDragPointerMove}
          onPointerUp={handleDragPointerUp}
        >
          <MicIcon active={false} />
          <span>Nexus</span>
        </button>
      </div>
    );
  }

  return (
    <div className="nexus-voice" style={positionStyle} ref={containerRef}>
      <div className="nexus-voice-panel glass-strong cmp-companion-panel" data-testid="companion-panel">
        <div
          className="nexus-voice-panel-head nexus-voice-drag-handle"
          data-testid="nexus-voice-drag-handle"
          onPointerDown={handleDragPointerDown}
          onPointerMove={handleDragPointerMove}
          onPointerUp={handleDragPointerUp}
        >
          <span className="nexus-voice-title">Nexus Companion</span>
          <button type="button" className="nexus-voice-close" aria-label="Close" onClick={handleClose}>
            &times;
          </button>
        </div>

        <div className="cmp-root">
          <section className="cmp-stage" aria-label="Nexus companion face">
            <NexusFace mood={mood} mouthShape={mouthShape} />
            <div className="cmp-readout">
              <span className="cmp-eyebrow">Nexus</span>
              <span className="cmp-readout-mood">{mood}</span>
              <span className="cmp-readout-conn">voice {connection}</span>
            </div>

            <div className="cmp-controls" role="group" aria-label="Voice runtime">
              {["nexus", "hermes"].map((rt) => {
                if (rt === "hermes" && !hermesAvailable) return null;
                return (
                  <button
                    key={rt}
                    className={runtime === rt ? "cmp-btn cmp-btn-on" : "cmp-btn"}
                    aria-pressed={runtime === rt}
                    onClick={() => switchRuntime(rt)}
                    title={
                      rt === "nexus"
                        ? "The companion: answers over your configured AI endpoint"
                        : "Hermes — your local agent. Push-to-talk only: it has a real shell, so it never hears the room."
                    }
                  >
                    {rt}
                  </button>
                );
              })}
              {runtime === "hermes" && (
                <button
                  className={talking ? "cmp-btn cmp-btn-talking" : "cmp-btn cmp-btn-ptt"}
                  data-testid="companion-ptt"
                  // pointer* not click: this is a HOLD. setPointerCapture so a
                  // release off the button still closes the gate.
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    setTalking(true);
                    providerRef.current?.setPushToTalk?.(true);
                  }}
                  onPointerUp={() => {
                    setTalking(false);
                    providerRef.current?.setPushToTalk?.(false);
                  }}
                  onPointerCancel={() => {
                    setTalking(false);
                    providerRef.current?.setPushToTalk?.(false);
                  }}
                  title="Hold to speak to Hermes — nothing is captured unless you are holding this"
                >
                  {talking ? "● recording" : "hold to talk"}
                </button>
              )}
              <span className="cmp-sep" aria-hidden />
              <button
                className={micMuted ? "cmp-btn cmp-btn-muted" : "cmp-btn"}
                onClick={toggleMic}
                aria-pressed={micMuted}
                title={
                  micMuted
                    ? "Mic is off — Nexus cannot hear you. Typing still works."
                    : "Mute the mic. Nexus keeps talking; it just stops listening."
                }
              >
                {micMuted ? "mic off" : "mic on"}
              </button>
            </div>

            <div className="cmp-transcript" ref={transcriptRef} aria-label="Conversation transcript">
              {transcript.length === 0 ? (
                <p className="cmp-note">
                  Type below — Nexus answers out loud. On the desktop app your mic is captured with
                  local voice detection, transcribed on-device. Switch to Hermes (push-to-talk) to
                  reach your local agent.
                </p>
              ) : (
                transcript.map((entry) => (
                  <div key={entry.id} className={`cmp-line cmp-line-${entry.role}`}>
                    <span className="cmp-line-role">{entry.role}</span>
                    <span className="cmp-line-text">{entry.text}</span>
                  </div>
                ))
              )}
            </div>

            <form
              className="cmp-input-row"
              onSubmit={(ev) => {
                ev.preventDefault();
                submitDraft();
              }}
            >
              <input
                className="cmp-input"
                value={draft}
                onChange={(ev) => setDraft(ev.target.value)}
                placeholder="say something to Nexus…"
                aria-label="Message Nexus"
                disabled={connection === "error"}
              />
              <button className="cmp-btn" type="submit" disabled={connection === "error"}>
                send
              </button>
            </form>

            <label className="cmp-controls nexus-voice-wake-toggle" style={{ gap: 6 }}>
              <input type="checkbox" checked={wakeWordEnabled} onChange={toggleWakeWord} />
              <span className="cmp-note" style={{ margin: 0 }}>
                Wake word: Hey/Yo Nexus
              </span>
            </label>
          </section>

          <CompanionArtifactPanel
            items={items}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRemove={(id) => {
              setItems((prev) => prev.filter((i) => i.id !== id));
              setSelectedId((prev) => (prev === id ? null : prev));
            }}
            onClearAll={() => {
              setItems([]);
              setSelectedId(null);
            }}
          />
        </div>
      </div>
    </div>
  );
}
