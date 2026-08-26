"use client";

// components/tools/MockInterview.js
// Mock Interview — lessons hustle-interview-1/2.
//
// OFFLINE-FIRST BY DESIGN. With no API key you still get: the full question
// bank (fixed set + Hustle curriculum), the deterministic STAR/specificity
// rubric, a model-answer note per question, and your STAR bank wired in to
// prefill answers. AI makes the feedback adaptive and specific — it is never
// the price of entry, and every failure degrades to the offline rubric with a
// message that names Settings.
//
// THE SECURITY INVARIANT: every AI call goes over the ai:call IPC channel,
// where the key lives only in the Electron main process. This component never
// sees an apiKey — endpoint views from window.coop.endpoints.list() are
// key-free by construction, and there is no env-var fallback path.
//
// The AI here used to be dead on arrival: this file hand-rolled its own ai:call
// adapter and sent `model: endpoint.model`, but there is NO `model` on a stored
// endpoint or an EndpointView (see electron/ipc/validators.js and registry.js's
// toView) — models are DISCOVERED per-call via endpoints:models. `model` went
// over the wire as undefined, validateAiCallInput rejected every call, and the
// user was silently dropped to the offline rubric forever. The adapter is gone;
// this now uses lib/ai/client.js and discovers the model, exactly like
// components/tools/CoverLetterTool.js.

import { useEffect, useMemo, useState } from "react";
import { callLLM, getBridge, pickDefaultEndpointId } from "@/lib/ai/client";
import { ensureLegacyAIConfigMigrated } from "@/lib/ai/config";
import { selectModelForTask } from "@/lib/ai/lesson-builder";
import {
  QUESTION_TYPES,
  defaultMockInterviewState,
  getQuestionBank,
  pickQuestion,
  startMockInterviewSession,
  recordMockInterviewAnswer,
  setMockInterviewFeedback,
  clearMockInterviewSession,
  gradeAnswer,
  sessionStats,
  suggestStoriesFor,
  prefillFromStory,
  storyReference,
} from "@/lib/tools/mockInterview";
import { STORY_TAG_LABELS } from "@/lib/tools/starStories";
import "./hustle-tools.css";

/* ─── the AI seam ─── */

/**
 * Bind lib/ai/client.js#callLLM to a discovered endpoint + model, in the shape
 * lib/tools/mockInterview.js#gradeAnswer injects:
 *   ({ system, user, options }) -> { ok: true, text } | { ok: false, error }
 *
 * Returns null whenever the AI is not reachable — no bridge, no endpoint, or no
 * DISCOVERED model. gradeAnswer() then runs its offline path, which is a
 * complete product on its own. Refusing to build an llm without a model is the
 * point: an undefined model is what silently broke this tool, and callLLM's own
 * guard would only turn it into a NO_ENDPOINT error further down.
 *
 * @param {{ bridge: object|null, endpointId: string, model: string }} args
 * @returns {((req: { system: string, user: string, options?: object }) => Promise<object>)|null}
 */
export function createInterviewLlm({ bridge, endpointId, model }) {
  if (!bridge?.ai || !endpointId || !model) return null;
  return ({ system, user, options }) => callLLM({ system, user, endpointId, model, options }, bridge);
}

/**
 * Why this answer was graded offline. Every branch is actionable and names
 * Settings where Settings is the fix — the user is never left believing the AI
 * ran when it did not.
 *
 * @param {{ bridge: object|null, endpointId: string, model: string }} args
 * @returns {string}
 */
export function offlineReason({ bridge, endpointId, model }) {
  if (!bridge?.ai) {
    return "Graded with the offline rubric — adaptive AI feedback needs the desktop app.";
  }
  if (!endpointId) {
    return "Graded with the offline rubric. Add an AI endpoint in Settings for adaptive, answer-specific feedback.";
  }
  if (!model) {
    return "Graded with the offline rubric — couldn't discover a model on your AI endpoint. Check it in Settings.";
  }
  return "Graded with the offline rubric.";
}

function scoreClass(score) {
  if (score >= 80) return "h-score h-score-good";
  if (score >= 50) return "h-score h-score-mid";
  return "h-score h-score-bad";
}

const TYPE_LABELS = { behavioral: "Behavioral", technical: "Technical", case: "Case" };

export default function MockInterview({ state, dispatch, onOpenSettings }) {
  const slice = state?.tools?.mockInterview ?? defaultMockInterviewState;
  const sessions = slice.sessions ?? [];

  const [typeFilter, setTypeFilter] = useState("all");
  const [custom, setCustom] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [endpointId, setEndpointId] = useState("");
  const [model, setModel] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [showModel, setShowModel] = useState(false);

  const bridge = getBridge();

  const bank = useMemo(
    () => getQuestionBank(typeFilter === "all" ? {} : { type: typeFilter }),
    [typeFilter]
  );
  const stats = useMemo(() => sessionStats(state ?? {}), [state]);
  const active = slice.activeQuestion;
  // The session being answered is always the newest one — derived, not tracked
  // in local state, so a reducer never has to reach back out to setState.
  const session = sessions.length > 0 ? sessions[sessions.length - 1] : null;
  const suggestions = useMemo(
    () => (active ? suggestStoriesFor(state ?? {}, active.question) : []),
    [state, active]
  );

  // A pre-Phase-2 user may still have a plaintext key in localStorage. Move it
  // into the main-process registry and scrub it HERE: lib/ai/config.js's
  // documented mitigation is one call at each AI surface, and this is one. The
  // Dashboard also calls it on mount, so this is defence in depth — the call is
  // idempotent and de-duplicated across surfaces.
  useEffect(() => {
    if (!bridge?.endpoints) return;
    ensureLegacyAIConfigMigrated(bridge.endpoints).then((res) => {
      // A migrated key means a brand-new endpoint — re-read the list.
      if (res?.migrated) setRefreshTick((t) => t + 1);
    });
  }, [bridge]);

  // Endpoint discovery — key-free views only. Absence is not an error here.
  useEffect(() => {
    let cancelled = false;
    if (!bridge?.endpoints) return undefined;
    bridge.endpoints
      .list()
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : res?.endpoints ?? [];
        setEndpointId((current) => current || pickDefaultEndpointId(list));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [bridge, refreshTick]);

  // Model discovery for the chosen endpoint. THE endpoint carries a base URL
  // only — the model is never stored on it, it is discovered here per-call.
  useEffect(() => {
    let cancelled = false;
    if (!bridge?.endpoints || !endpointId) return undefined;
    bridge.endpoints
      .models(endpointId)
      .then((result) => {
        if (cancelled) return;
        const ids = Array.isArray(result) ? result : Array.isArray(result?.models) ? result.models : [];
        const names = ids.map((m) => (typeof m === "string" ? m : m?.id)).filter(Boolean);
        setModel(selectModelForTask("summarize", names) ?? "");
      })
      .catch(() => {
        if (!cancelled) setModel("");
      });
    return () => {
      cancelled = true;
    };
  }, [bridge, endpointId]);

  const aiReady = Boolean(bridge?.ai && endpointId && model);

  function ask(question) {
    setNotice("");
    setAnswer("");
    setShowModel(false);
    dispatch((s) => startMockInterviewSession(s, question, question.source ?? "custom"));
  }

  function handleNext() {
    const q = pickQuestion(bank, { askedIds: stats.askedIds });
    if (q) ask(q);
  }

  function handleCustom() {
    const q = custom.trim();
    if (!q) return;
    ask({ question: q, type: "behavioral", source: "custom", looksFor: [], modelNote: "" });
    setCustom("");
  }

  /* Submit: grade offline ALWAYS, then enrich with AI if it's available. */
  async function handleSubmit() {
    if (!session || !answer.trim()) return;
    setBusy(true);
    setNotice("");
    try {
      dispatch((s) => recordMockInterviewAnswer(s, session.id, answer));

      const llm = createInterviewLlm({ bridge, endpointId, model });
      const result = await gradeAnswer({ question: active, answer }, llm ?? undefined);

      if (result.aiText) {
        dispatch((s) => setMockInterviewFeedback(s, session.id, result.aiText));
      }
      // Never a silent downgrade: if the AI did not run, say so and say why.
      if (result.notice) {
        setNotice(result.notice);
      } else if (!llm) {
        setNotice(offlineReason({ bridge, endpointId, model }));
      }
    } finally {
      setBusy(false);
    }
  }

  const graded = session?.offlineFeedback ?? null;

  return (
    <div className="h-page h-page-wide">
      <div className="h-head">
        <h1 className="h-title">Mock Interview</h1>
        <p className="h-sub">
          Real questions for wealth-management and CFA-track analyst roles, graded on STAR completeness, specificity,
          and whether you said &quot;I&quot; or hid behind &quot;we&quot;. Works fully offline — an AI endpoint makes
          the feedback adaptive, but the rubric below never needs one.
        </p>
      </div>

      <div className="h-stats">
        <div className="h-stat">
          <div className="h-stat-v">{stats.answered}</div>
          <div className="h-stat-k">Answered</div>
        </div>
        <div className={`h-stat ${stats.averageScore >= 80 ? "h-stat-good" : ""}`}>
          <div className="h-stat-v">{stats.averageScore}</div>
          <div className="h-stat-k">Avg score</div>
        </div>
        <div className="h-stat">
          <div className="h-stat-v">{stats.best}</div>
          <div className="h-stat-k">Best</div>
        </div>
        <div className="h-stat">
          <div className="h-stat-v">{bank.length}</div>
          <div className="h-stat-k">In the bank</div>
        </div>
      </div>

      {/* ── pick a question ── */}
      <div className="glass h-card">
        <div className="h-row" style={{ marginBottom: 12 }}>
          <span className="section-label">Question</span>
          <div className="h-spacer" />
          {!aiReady && (
            <span className="badge badge-muted" title="Everything below still works without one">
              Offline mode
            </span>
          )}
        </div>

        <div className="h-chips" style={{ marginBottom: 14 }}>
          <button className={`h-chip ${typeFilter === "all" ? "h-chip-on" : ""}`} onClick={() => setTypeFilter("all")}>
            All
          </button>
          {QUESTION_TYPES.map((t) => (
            <button key={t} className={`h-chip ${typeFilter === t ? "h-chip-on" : ""}`} onClick={() => setTypeFilter(t)}>
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="h-row h-row-top">
          <button className="btn-primary" onClick={handleNext}>
            {active ? "Next question" : "Start"}
          </button>
          <input
            className="h-input"
            style={{ flex: 1, minWidth: 220 }}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCustom()}
            placeholder="…or paste a question you were actually asked"
          />
          <button className="btn-ghost" onClick={handleCustom} disabled={!custom.trim()}>
            Ask this
          </button>
        </div>
      </div>

      {/* ── answer ── */}
      {active && session && (
        <div className="glass h-card">
          <div className="h-row" style={{ marginBottom: 10 }}>
            <span className="badge badge-primary">{TYPE_LABELS[active.type] ?? "Behavioral"}</span>
            {active.source === "curriculum" && <span className="badge badge-muted">From the curriculum</span>}
          </div>
          <p style={{ fontSize: 17, fontWeight: 600, color: "var(--text-1)", lineHeight: 1.5, marginBottom: 14 }}>
            {active.question}
          </p>

          {/* the STAR bank paying off */}
          {suggestions.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <label className="h-label">
                Your STAR bank has stories for this{" "}
                <span className="h-label-note">— prefill one rather than improvising</span>
              </label>
              <div className="h-chips">
                {suggestions.slice(0, 4).map(({ story, matchedTags }) => (
                  <button
                    key={story.id}
                    className="h-chip"
                    title={storyReference(story)}
                    onClick={() => setAnswer(prefillFromStory(story))}
                  >
                    + {story.name || "Untitled"}
                    {matchedTags.length > 0 && ` · ${matchedTags.map((t) => STORY_TAG_LABELS[t]).join(", ")}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <textarea
            className="h-textarea"
            rows={9}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer as you would say it out loud. Aim for about 90 seconds — roughly 150-200 words."
          />

          <div className="h-row" style={{ marginTop: 12 }}>
            <button className="btn-primary" onClick={handleSubmit} disabled={busy || !answer.trim()}>
              {busy ? "Grading…" : aiReady ? "Submit for feedback" : "Submit · offline rubric"}
            </button>
            {active.modelNote && (
              <button className="btn-ghost" onClick={() => setShowModel((v) => !v)}>
                {showModel ? "Hide" : "Show"} what a strong answer contains
              </button>
            )}
            <div className="h-spacer" />
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>
              {answer.trim() ? answer.trim().split(/\s+/).length : 0} words
            </span>
          </div>

          {showModel && active.modelNote && (
            <div className="h-finding h-finding-info" style={{ marginTop: 12 }}>
              <span className="h-finding-icon">→</span>
              <span>{active.modelNote}</span>
            </div>
          )}

          {notice && (
            <div className="h-notice">
              {notice}{" "}
              {onOpenSettings && /Settings/.test(notice) && (
                <button className="h-chip" style={{ marginLeft: 4 }} onClick={onOpenSettings}>
                  Open Settings
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── feedback ── */}
      {graded && (
        <div className="glass h-card">
          <div className="h-row" style={{ marginBottom: 12 }}>
            <span className="section-label">Feedback</span>
            {session.aiFeedback ? (
              <span className="badge badge-green">AI + rubric</span>
            ) : (
              <span className="badge badge-muted">Offline rubric</span>
            )}
            <div className="h-spacer" />
            <span className={scoreClass(graded.score)}>{graded.score}/100</span>
          </div>

          <div className="h-meter">
            <div
              className={`h-meter-fill ${graded.score >= 80 ? "h-meter-fill-good" : graded.score < 50 ? "h-meter-fill-bad" : ""}`}
              style={{ width: `${graded.score}%` }}
            />
          </div>

          <div className="h-rubric" style={{ marginTop: 14 }}>
            {graded.breakdown.map((r) => (
              <div className="h-rubric-row" key={r.key}>
                <span className={`h-rubric-mark ${r.pass ? "h-rubric-pass" : "h-rubric-fail"}`}>{r.pass ? "✓" : "✕"}</span>
                <span className="h-rubric-label">{r.label}</span>
                <span className="h-rubric-note">{r.note}</span>
              </div>
            ))}
          </div>

          <div className="h-finding h-finding-warn" style={{ marginTop: 16 }}>
            <span className="h-finding-icon">→</span>
            <span>
              <strong>Do this one thing:</strong> {graded.improvement}
            </span>
          </div>

          {session.aiFeedback && (
            <div style={{ marginTop: 16, borderTop: "1px solid var(--glass-border)", paddingTop: 16 }}>
              <span className="section-label">Coach</span>
              <pre className="h-output h-output-prose" style={{ marginTop: 8 }}>
                {session.aiFeedback}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ── history ── */}
      {sessions.length > 0 && (
        <div className="glass h-card">
          <span className="section-label">Practice history</span>
          <div style={{ marginTop: 12 }}>
            {[...sessions].reverse().map((s) => (
              <div className="h-item" key={s.id}>
                <div className="h-item-head">
                  <span className="h-item-name" style={{ fontWeight: 500, fontSize: 13.5 }}>
                    {s.question}
                  </span>
                  <div className="h-spacer" />
                  {typeof s.score === "number" ? (
                    <span className={scoreClass(s.score)}>{s.score}</span>
                  ) : (
                    <span className="badge badge-muted">Unanswered</span>
                  )}
                  <button
                    className="btn-ghost"
                    style={{ color: "var(--red-2)", padding: "3px 8px" }}
                    onClick={() => dispatch((st) => clearMockInterviewSession(st, s.id))}
                    aria-label="Remove session"
                  >
                    ✕
                  </button>
                </div>
                <div className="h-item-meta">
                  {TYPE_LABELS[s.questionType] ?? s.questionType} · {new Date(s.timestamp).toLocaleDateString()}
                  {s.aiFeedback && " · AI feedback"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
