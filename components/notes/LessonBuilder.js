"use client";

// components/notes/LessonBuilder.js
// Human-in-the-loop review UI for AI-generated lesson sections.
//
// Flow: pick a module + the notes to build from -> see the estimated cost
// BEFORE spending anything -> generate -> review the full draft (body, quiz
// with per-option explanations, flashcards, game configs) -> Accept or
// Discard. NOTHING enters the curriculum without an explicit Accept; accepted
// lessons are stored under the `tools.lessonBuilder` slice with provenance,
// so they are auditable and revertable.
//
// THE SECURITY INVARIANT: this component never sees an API key. All AI calls
// go through window.coop.ai.call (the ai:call IPC channel); endpoint views
// from window.coop.endpoints.list() are key-free by construction.

import { useEffect, useMemo, useState } from "react";
import { listNotes } from "@/lib/ai/notes";
import {
  acceptGeneratedLesson,
  buildLesson,
  buildLessonRequest,
  estimateCost,
  removeGeneratedLesson,
  listAcceptedLessons,
  selectModelForTask,
} from "@/lib/ai/lesson-builder";
import { designGames } from "@/lib/ai/game-designer";
import { MODULES, FLASHCARDS } from "@/data/curriculum";
import "./notes.css";

/** The bridge is absent in plain-browser dev; every AI action guards on it. */
function getBridge() {
  return typeof window !== "undefined" && window.coop ? window.coop : null;
}

/**
 * Wrap the ai:call IPC channel as the injected-llm contract that
 * lib/ai/lesson-builder.js expects:
 *   ({ system, user, model, options }) -> { ok, text } | { ok, error }
 */
function createIpcLlm(endpointId) {
  return ({ system, user, model, options }) => {
    const coop = getBridge();
    if (!coop?.ai) {
      return Promise.resolve({
        ok: false,
        error: { type: "NO_BRIDGE", message: "AI generation needs the desktop app." },
      });
    }
    const requestId = `lb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const messages = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: user });

    return new Promise((resolve) => {
      let text = "";
      const unsubscribe = coop.ai.onStream((evt) => {
        if (evt?.requestId !== requestId) return;
        if (evt.type === "chunk") {
          text += evt.delta ?? "";
        } else if (evt.type === "done") {
          unsubscribe();
          resolve({ ok: true, text: typeof evt.text === "string" ? evt.text : text });
        } else if (evt.type === "error") {
          unsubscribe();
          resolve({ ok: false, error: evt.error ?? { type: "API_ERROR", message: "The AI call failed." } });
        }
      });
      coop.ai
        .call({ endpointId, model, requestId, messages, options })
        .catch((err) => {
          unsubscribe();
          resolve({ ok: false, error: { type: "IPC_ERROR", message: String(err?.message ?? err) } });
        });
    });
  };
}

function errorMessage(error) {
  if (!error) return "Something went wrong.";
  const base = error.message || error.type || "Something went wrong.";
  return error.hint ? `${base} ${error.hint}` : base;
}

export default function LessonBuilder({ state, dispatch, onOpenSettings }) {
  const bridge = getBridge();

  const [moduleId, setModuleId] = useState(MODULES[0]?.id ?? "");
  const [selectedNoteIds, setSelectedNoteIds] = useState({});
  const [endpoints, setEndpoints] = useState([]);
  const [endpointId, setEndpointId] = useState("");
  const [models, setModels] = useState([]);
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(null);

  const notes = useMemo(() => listNotes(state?.notes ?? {}), [state?.notes]);
  const accepted = useMemo(() => listAcceptedLessons(state ?? {}), [state]);
  const mod = MODULES.find((m) => m.id === moduleId) ?? MODULES[0];

  const chosenNotes = notes.filter((n) => selectedNoteIds[n.id]);

  // Endpoint discovery — key-free views only.
  useEffect(() => {
    let cancelled = false;
    if (!bridge?.endpoints) return undefined;
    bridge.endpoints
      .list()
      .then((list) => {
        if (cancelled || !Array.isArray(list)) return;
        setEndpoints(list);
        if (list.length && !endpointId) setEndpointId(list[0].id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge]);

  // Model discovery for the chosen endpoint.
  useEffect(() => {
    let cancelled = false;
    if (!bridge?.endpoints || !endpointId) return undefined;
    bridge.endpoints
      .models(endpointId)
      .then((result) => {
        if (cancelled) return;
        const ids = Array.isArray(result) ? result : Array.isArray(result?.models) ? result.models : [];
        const names = ids.map((m) => (typeof m === "string" ? m : m?.id)).filter(Boolean);
        setModels(names);
        setModel(selectModelForTask("lesson", names) ?? "");
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [bridge, endpointId]);

  // Cost preview BEFORE generation — the user sees what they're spending.
  const chosenKey = chosenNotes.map((n) => n.id).join(",");
  const estimate = useMemo(() => {
    if (!chosenNotes.length || !model) return null;
    const { system, user } = buildLessonRequest({ notes: chosenNotes, module: mod, flashcards: FLASHCARDS });
    return estimateCost({ system, user, model });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenKey, model, moduleId]);

  function toggleNote(id) {
    setSelectedNoteIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleGenerate() {
    if (!bridge?.ai) {
      setError("AI generation needs the desktop app with an endpoint configured.");
      return;
    }
    if (!endpointId) {
      if (onOpenSettings) onOpenSettings();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await buildLesson({
        notes: chosenNotes,
        module: mod,
        flashcards: FLASHCARDS,
        llm: createIpcLlm(endpointId),
        model,
      });
      if (result.ok) {
        setDraft(result.lesson);
      } else {
        setError(errorMessage(result.error));
        if (result.error?.type === "AUTH_ERROR" && onOpenSettings) onOpenSettings();
      }
    } finally {
      setBusy(false);
    }
  }

  function handleAccept() {
    if (!draft) return;
    dispatch((doc) => acceptGeneratedLesson(doc, draft));
    setDraft(null);
  }

  function handleRemoveAccepted(id) {
    dispatch((doc) => removeGeneratedLesson(doc, id));
  }

  function patchDraft(patch) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  const games = draft ? designGames({ lesson: draft }) : [];

  return (
    <div className="coopLb-panel">
      {/* ── setup ── */}
      <div className="coopLb-section">
        <label className="coopLb-label">1 · Build a lesson from your notes</label>
        <div className="coopLb-row">
          <select
            className="coopLb-input"
            aria-label="Target module"
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
          >
            {MODULES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.icon} {m.title}
              </option>
            ))}
          </select>
          {bridge ? (
            <>
              <select
                className="coopLb-input"
                aria-label="AI endpoint"
                value={endpointId}
                onChange={(e) => setEndpointId(e.target.value)}
              >
                {endpoints.length === 0 && <option value="">No endpoints — add one in Settings</option>}
                {endpoints.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.label ?? ep.baseUrl}
                  </option>
                ))}
              </select>
              <select
                className="coopLb-input"
                aria-label="Model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                {models.length === 0 && <option value="">No models discovered</option>}
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <span className="coopLb-cost">AI generation is available in the desktop app.</span>
          )}
        </div>

        <label className="coopLb-label">Notes to build from</label>
        {notes.length === 0 && (
          <div className="coopNotes-empty">No notes yet — capture some in the note taker first.</div>
        )}
        {notes.map((note) => (
          <label key={note.id} className="coopLb-noteCheck">
            <input
              type="checkbox"
              checked={!!selectedNoteIds[note.id]}
              onChange={() => toggleNote(note.id)}
            />
            <span>
              {note.body.length > 140 ? `${note.body.slice(0, 140)}…` : note.body}
            </span>
          </label>
        ))}

        {estimate && (
          <div className="coopLb-cost">
            Estimated cost: ~{estimate.inputTokens.toLocaleString()} tokens in, up to{" "}
            {estimate.outputTokens.toLocaleString()} out
            {estimate.usd != null ? ` — about $${estimate.usd.toFixed(3)} on ${estimate.model}` : ""}
          </div>
        )}
        {error && <div className="coopLb-error">{error}</div>}
        <div className="coopLb-row">
          <button
            type="button"
            className="coopLb-btn coopLb-btnPrimary"
            onClick={handleGenerate}
            disabled={busy || !chosenNotes.length || !bridge || !model}
          >
            {busy ? "Generating…" : "Generate draft lesson"}
          </button>
        </div>
      </div>

      {/* ── review ── */}
      {draft && (
        <div className="coopLb-section">
          <div className="coopLb-row">
            <label className="coopLb-label" style={{ marginBottom: 0 }}>
              2 · Review before it enters the curriculum
            </label>
            <span className="coopLb-badge">AI-generated</span>
          </div>

          <input
            className="coopLb-input coopLb-draftTitle"
            aria-label="Lesson title"
            value={draft.title}
            onChange={(e) => patchDraft({ title: e.target.value })}
          />

          {draft.body.map((para, i) => (
            <textarea
              key={i}
              className="coopLb-input coopNotes-textarea coopLb-para"
              aria-label={`Paragraph ${i + 1}`}
              value={para}
              onChange={(e) =>
                patchDraft({ body: draft.body.map((p, j) => (j === i ? e.target.value : p)) })
              }
            />
          ))}

          <label className="coopLb-label">Challenge</label>
          <textarea
            className="coopLb-input coopNotes-textarea"
            aria-label="Challenge"
            value={draft.challenge}
            onChange={(e) => patchDraft({ challenge: e.target.value })}
          />

          <label className="coopLb-label">Example output</label>
          <textarea
            className="coopLb-input coopNotes-textarea"
            aria-label="Example output"
            value={draft.exampleOutput}
            onChange={(e) => patchDraft({ exampleOutput: e.target.value })}
          />

          <label className="coopLb-label">Quiz ({draft.quiz.length})</label>
          {draft.quiz.map((item, i) => (
            <div key={i} className="coopLb-quizItem">
              <strong>{item.q}</strong>
              {item.options.map((opt, j) => (
                <div
                  key={j}
                  className={
                    opt.text === item.a ? "coopLb-option coopLb-optionCorrect" : "coopLb-option"
                  }
                >
                  {opt.text}
                  <span className="coopLb-optionWhy">{opt.explanation}</span>
                </div>
              ))}
              <button
                type="button"
                className="coopNotes-btn coopNotes-btnDanger"
                onClick={() =>
                  patchDraft({ quiz: draft.quiz.filter((_, j) => j !== i) })
                }
                disabled={draft.quiz.length <= 1}
              >
                Remove question
              </button>
            </div>
          ))}

          {Array.isArray(draft.flashcards) && draft.flashcards.length > 0 && (
            <>
              <label className="coopLb-label">Flashcards ({draft.flashcards.length})</label>
              {draft.flashcards.map((f, i) => (
                <div key={i} className="coopLb-para">
                  <strong>{f.term}</strong> — {f.def}
                </div>
              ))}
            </>
          )}

          {games.length > 0 && (
            <>
              <label className="coopLb-label">Games this lesson unlocks</label>
              {games.map((g) => (
                <div key={g.gameId} className="coopLb-gameCard">
                  <span>{g.title}</span>
                  <span className="coopNotes-tag">{g.kind}</span>
                </div>
              ))}
            </>
          )}

          <div className="coopLb-row">
            <button type="button" className="coopLb-btn coopLb-btnPrimary" onClick={handleAccept}>
              Accept into curriculum
            </button>
            <button type="button" className="coopLb-btn" onClick={() => setDraft(null)}>
              Discard
            </button>
          </div>
        </div>
      )}

      {/* ── accepted ── */}
      {accepted.length > 0 && (
        <div className="coopLb-section">
          <label className="coopLb-label">Accepted generated lessons</label>
          {accepted.map((lesson) => (
            <div key={lesson.id} className="coopLb-gameCard">
              <span>
                {lesson.title}{" "}
                <span className="coopNotes-tag">
                  {lesson.provenance?.model ?? "unknown model"}
                </span>
              </span>
              <button
                type="button"
                className="coopNotes-btn coopNotes-btnDanger"
                onClick={() => handleRemoveAccepted(lesson.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
