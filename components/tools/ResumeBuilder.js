"use client";

// components/tools/ResumeBuilder.js
// Resume Builder — ATS reality is the point (lesson hustle-materials-1).
//
// Offline-first: the assembler, the bullet analysis, and the keyword checklist
// all run with no key and no network. The AI button rewrites a single bullet
// and is pure enhancement — it goes through the ai:call IPC channel via
// lib/ai/client.js, so this component never sees an apiKey.
//
// The AI here used to be dead on arrival: this file hand-rolled its own ai:call
// adapter and sent `model: endpoint.model`, but there is NO `model` on a stored
// endpoint or an EndpointView (see electron/ipc/validators.js and registry.js's
// toView) — models are DISCOVERED per-call via endpoints:models. `model` went
// over the wire as undefined and validateAiCallInput rejected every call, which
// is how the raw string "Error invoking remote method 'ai:call': … model must
// be a non-empty string" ended up in the UI. The adapter is gone; this now uses
// lib/ai/client.js and discovers the model, like components/tools/CoverLetterTool.js.

import { useEffect, useMemo, useState } from "react";
import {
  defaultResumeBuilderState,
  setResumeBuilderField,
  setResumeContactField,
  setResumeSkills,
  addResumeSection,
  updateResumeSection,
  removeResumeSection,
  addResumeBullet,
  updateResumeBullet,
  removeResumeBullet,
  addBulletFromStory,
  analyzeBullet,
  suggestBulletRewrite,
  assembleResume,
  auditResume,
  atsRules,
  buildBulletPromptSlots,
  RESUME_BULLET_PROMPT,
  SECTION_KINDS,
} from "@/lib/tools/resume";
import { defaultStarStoryBankState, storyToBullet } from "@/lib/tools/starStories";
import { fillPrompt } from "@/lib/ai/fill-prompt";
import { callLLM, getBridge, pickDefaultEndpointId } from "@/lib/ai/client";
import { ensureLegacyAIConfigMigrated } from "@/lib/ai/config";
import { selectModelForTask } from "@/lib/ai/lesson-builder";
import "./hustle-tools.css";

/* ─── the AI seam ───
   THE SECURITY INVARIANT: the renderer never sees an apiKey. Every call goes
   over the ai:call IPC channel, where the key lives only in the Electron main
   process. There is no env-var path and no ambient fallback — with no bridge
   and no endpoint we degrade to the offline scaffold and say so. */

/**
 * Turn a callLLM error into something the user can act on. The raw message is
 * deliberately NOT trusted as UI copy: electron/ipc/handlers.js sends a stream
 * error as `String(err?.message ?? err)`, so an unmapped failure reads
 * "Error invoking remote method 'ai:call': …" — an implementation detail the
 * user can do nothing with. Every branch here names the fix instead.
 *
 * @param {{ type?: string, message?: string, hint?: string }} error
 * @returns {{ message: string, needsSettings: boolean }}
 */
export function describeRewriteFailure(error) {
  const type = error?.type;
  switch (type) {
    case "NO_BRIDGE":
      return { message: "AI rewriting needs the desktop app — the offline scaffold below still works.", needsSettings: false };
    case "NO_ENDPOINT":
    case "NO_KEY":
      return { message: "No AI endpoint configured — the offline scaffold below still works.", needsSettings: true };
    case "AUTH_ERROR":
      return { message: "The endpoint rejected its API key — your bullet is unchanged.", needsSettings: true };
    case "NETWORK_ERROR":
      return { message: "Couldn't reach the AI endpoint — your bullet is unchanged.", needsSettings: false };
    case "BAD_REQUEST":
      return { message: `${error?.message || "The request was rejected."} Your bullet is unchanged.`, needsSettings: false };
    default:
      return { message: error?.hint || "The AI call failed — your bullet is unchanged.", needsSettings: false };
  }
}

/**
 * Rewrite one bullet through lib/ai/client.js#callLLM. Returns
 * { ok: true, text } or { ok: false, message, needsSettings } — never a key,
 * never a throw, never a raw IPC string.
 *
 * A missing model is treated as "nothing to call" rather than being sent: the
 * endpoint carries a base URL only, and the model must have been DISCOVERED via
 * endpoints:models first.
 *
 * @param {{ bridge: object|null, endpointId: string, model: string, slots: object }} args
 * @returns {Promise<{ ok: true, text: string } | { ok: false, message: string, needsSettings: boolean }>}
 */
export async function rewriteBulletWithAi({ bridge, endpointId, model, slots }) {
  if (!bridge?.ai) return { ok: false, ...describeRewriteFailure({ type: "NO_BRIDGE" }) };
  if (!endpointId) return { ok: false, ...describeRewriteFailure({ type: "NO_ENDPOINT" }) };
  if (!model) {
    return {
      ok: false,
      message: "Couldn't discover a model on your AI endpoint — check it in Settings. The offline scaffold below still works.",
      needsSettings: true,
    };
  }

  const result = await callLLM(
    {
      system: RESUME_BULLET_PROMPT.system,
      user: fillPrompt(RESUME_BULLET_PROMPT.user, slots),
      endpointId,
      model,
    },
    bridge
  );
  if (result.ok) return { ok: true, text: result.text };
  return { ok: false, ...describeRewriteFailure(result.error) };
}

function scoreClass(score) {
  if (score >= 70) return "h-score h-score-good";
  if (score >= 40) return "h-score h-score-mid";
  return "h-score h-score-bad";
}

function download(text, filename) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const KIND_LABELS = { experience: "Experience", education: "Education", project: "Project" };

export default function ResumeBuilder({ state, dispatch, onOpenSettings }) {
  const slice = { ...defaultResumeBuilderState, ...(state?.tools?.resumeBuilder ?? {}) };
  const contact = { ...defaultResumeBuilderState.contact, ...(slice.contact ?? {}) };
  const stories = (state?.tools?.starStoryBank ?? defaultStarStoryBankState).stories ?? [];

  const [draft, setDraft] = useState("");
  const [draftSection, setDraftSection] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState("");
  const [endpointId, setEndpointId] = useState("");
  const [model, setModel] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  const audit = useMemo(() => auditResume(state ?? {}), [state]);
  const output = useMemo(() => assembleResume(state ?? {}), [state]);
  const bridge = getBridge();
  const hasBridge = Boolean(bridge?.ai);

  // A pre-Phase-2 user may still have a plaintext key in localStorage. Move it
  // into the main-process registry and scrub it HERE: lib/ai/config.js's
  // documented mitigation is one call at each AI surface, and this is one. The
  // Dashboard also calls it on mount, so this is defence in depth — the call is
  // idempotent and de-duplicated across surfaces.
  useEffect(() => {
    if (!bridge?.endpoints) return;
    ensureLegacyAIConfigMigrated(bridge.endpoints).then((res) => {
      if (res?.migrated) setRefreshTick((t) => t + 1);
    });
  }, [bridge]);

  // Endpoint discovery — key-free views only.
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

  // Model discovery for the chosen endpoint. The endpoint carries a base URL
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

  function handleAddBullet() {
    const raw = draft.trim();
    if (!raw) return;
    dispatch((s) => addResumeBullet(s, raw, draftSection || null));
    setDraft("");
  }

  /* AI rewrite of ONE bullet. Optional: the offline scaffold below is always
     available, so a user with no endpoint is never blocked. */
  async function handleAiRewrite(bullet) {
    setNotice("");
    if (!hasBridge) {
      setNotice("AI rewriting needs the desktop app — the offline scaffold below still works.");
      return;
    }
    setBusyId(bullet.id);
    try {
      const slots = buildBulletPromptSlots(state ?? {}, bullet.raw);
      const result = await rewriteBulletWithAi({ bridge, endpointId, model, slots });
      if (result.ok && result.text.trim()) {
        dispatch((s) => updateResumeBullet(s, bullet.id, { raw: result.text.trim() }));
      } else {
        setNotice(result.message || "The AI call failed — your bullet is unchanged.");
        if (result.needsSettings && onOpenSettings) setNotice((m) => `${m} Open Settings to add an endpoint.`);
      }
    } finally {
      setBusyId(null);
    }
  }

  function applyOfflineRewrite(bullet) {
    dispatch((s) => updateResumeBullet(s, bullet.id, { raw: suggestBulletRewrite(bullet.raw) }));
  }

  const coverage = audit.coverage;
  // The AI is reachable only with a bridge, an endpoint, AND a discovered model
  // — the model is not optional, and pretending otherwise is what broke this.
  const aiReachable = hasBridge && Boolean(endpointId) && Boolean(model);

  return (
    <div className="h-page h-page-wide">
      <div className="h-head">
        <h1 className="h-title">Resume Builder</h1>
        <p className="h-sub">
          An Applicant Tracking System reads your resume before a human does. This builds a deliberately plain,
          parseable document and checks every bullet against the formula: action verb + what you did + quantified
          result.
        </p>
      </div>

      <div className="h-stats">
        <div className="h-stat">
          <div className="h-stat-v">{audit.bullets.length}</div>
          <div className="h-stat-k">Bullets</div>
        </div>
        <div className={`h-stat ${audit.weakCount > 0 ? "h-stat-bad" : audit.bullets.length ? "h-stat-good" : ""}`}>
          <div className="h-stat-v">{audit.weakCount}</div>
          <div className="h-stat-k">Weak verbs</div>
        </div>
        <div className={`h-stat ${audit.unquantifiedCount > 0 ? "h-stat-bad" : audit.bullets.length ? "h-stat-good" : ""}`}>
          <div className="h-stat-v">{audit.unquantifiedCount}</div>
          <div className="h-stat-k">No number</div>
        </div>
        <div className="h-stat">
          <div className="h-stat-v">
            {coverage.matched.length}/{coverage.total}
          </div>
          <div className="h-stat-k">Keywords</div>
        </div>
      </div>

      {audit.issues.length > 0 && (
        <div className="glass h-card h-card-tight">
          {audit.issues.map((m, i) => (
            <div key={i} className={`h-finding ${/clears the formula/.test(m) ? "h-finding-good" : "h-finding-warn"}`}>
              <span className="h-finding-icon">{/clears the formula/.test(m) ? "✓" : "!"}</span>
              <span>{m}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── target + job description ── */}
      <div className="glass h-card">
        <span className="section-label">Target</span>
        <div className="h-grid-2" style={{ marginTop: 10, marginBottom: 14 }}>
          <div>
            <label className="h-label">Target role</label>
            <input
              className="h-input"
              value={slice.targetRole}
              onChange={(e) => dispatch((s) => setResumeBuilderField(s, "targetRole", e.target.value))}
              placeholder="Wealth Management Analyst"
            />
          </div>
          <div>
            <label className="h-label">Target company</label>
            <input
              className="h-input"
              value={slice.targetCompany}
              onChange={(e) => dispatch((s) => setResumeBuilderField(s, "targetCompany", e.target.value))}
              placeholder="JP Morgan"
            />
          </div>
        </div>

        <div className="h-field">
          <label className="h-label">
            Paste the job description{" "}
            <span className="h-label-note">— exact phrases are lifted from it; an ATS matches strings, not synonyms</span>
          </label>
          <textarea
            className="h-textarea"
            rows={5}
            value={slice.pastedJobDescription}
            onChange={(e) => dispatch((s) => setResumeBuilderField(s, "pastedJobDescription", e.target.value))}
            placeholder="Paste the posting here — the keyword checklist below fills in automatically."
          />
        </div>

        {slice.keywords.length > 0 && (
          <div>
            <label className="h-label">Keyword checklist</label>
            <div className="h-chips">
              {slice.keywords.map((k) => {
                const phrase = typeof k === "string" ? k : k.phrase;
                const on = coverage.matched.includes(phrase);
                return (
                  <span
                    key={phrase}
                    className={`h-chip h-chip-static ${on ? "h-chip-on" : "h-chip-gap"}`}
                    title={on ? "Present in your resume" : "Not on your resume yet"}
                  >
                    {on ? "✓" : "✕"} {phrase}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── contact ── */}
      <div className="glass h-card">
        <span className="section-label">Header</span>
        <div className="h-grid-3" style={{ marginTop: 10 }}>
          {[
            ["name", "Full name", "Jane Smith"],
            ["email", "Email", "jane@example.com"],
            ["phone", "Phone", "(555) 010-0100"],
            ["location", "Location", "Queens, NY"],
            ["linkedin", "LinkedIn", "linkedin.com/in/janesmith"],
          ].map(([key, label, ph]) => (
            <div key={key}>
              <label className="h-label">{label}</label>
              <input
                className="h-input"
                value={contact[key]}
                onChange={(e) => dispatch((s) => setResumeContactField(s, key, e.target.value))}
                placeholder={ph}
              />
            </div>
          ))}
        </div>
        <div className="h-field" style={{ marginTop: 14 }}>
          <label className="h-label">
            Summary <span className="h-label-note">— two lines, target role first</span>
          </label>
          <textarea
            className="h-textarea"
            rows={2}
            value={slice.summary}
            onChange={(e) => dispatch((s) => setResumeBuilderField(s, "summary", e.target.value))}
          />
        </div>
        <div className="h-field" style={{ marginBottom: 0 }}>
          <label className="h-label">
            Skills <span className="h-label-note">— comma separated; put the posting&apos;s exact terms here</span>
          </label>
          <input
            className="h-input"
            value={slice.skills.join(", ")}
            onChange={(e) => dispatch((s) => setResumeSkills(s, e.target.value))}
            placeholder="Excel, Financial Modeling, XLOOKUP, Tableau"
          />
        </div>
      </div>

      {/* ── sections ── */}
      <div className="glass h-card">
        <div className="h-row" style={{ marginBottom: 12 }}>
          <span className="section-label">Sections</span>
          <div className="h-spacer" />
          {SECTION_KINDS.map((kind) => (
            <button key={kind} className="btn-ghost" onClick={() => dispatch((s) => addResumeSection(s, { kind }))}>
              + {KIND_LABELS[kind]}
            </button>
          ))}
        </div>

        {slice.sections.length === 0 ? (
          <div className="h-empty">No sections yet. Add your education and your most recent experience.</div>
        ) : (
          slice.sections.map((sec) => (
            <div className="h-item" key={sec.id}>
              <div className="h-row" style={{ marginBottom: 10 }}>
                <span className="badge badge-muted">{KIND_LABELS[sec.kind]}</span>
                <div className="h-spacer" />
                <button
                  className="btn-ghost"
                  style={{ color: "var(--red-2)" }}
                  onClick={() => dispatch((s) => removeResumeSection(s, sec.id))}
                >
                  Remove
                </button>
              </div>
              <div className="h-grid-3">
                {[
                  ["title", "Title", "Analyst Intern"],
                  ["org", "Organization", "Credit Union"],
                  ["location", "Location", "Queens, NY"],
                  ["startDate", "Start", "Jun 2025"],
                  ["endDate", "End", "Aug 2025"],
                ].map(([key, label, ph]) => (
                  <div key={key}>
                    <label className="h-label">{label}</label>
                    <input
                      className="h-input h-input-sm"
                      value={sec[key]}
                      onChange={(e) => dispatch((s) => updateResumeSection(s, sec.id, { [key]: e.target.value }))}
                      placeholder={ph}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── bullets ── */}
      <div className="glass h-card">
        <span className="section-label">Bullets</span>

        <div className="h-row h-row-top" style={{ marginTop: 12, marginBottom: 14 }}>
          <textarea
            className="h-textarea"
            style={{ flex: 1 }}
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Analyzed a 100-record loan dataset to compute approval-rate disparities across 6 demographic groups, flagging a 0.60 four-fifths ratio"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 160 }}>
            <select className="h-select" value={draftSection} onChange={(e) => setDraftSection(e.target.value)}>
              <option value="">No section</option>
              {slice.sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.title || KIND_LABELS[sec.kind]}
                </option>
              ))}
            </select>
            <button className="btn-primary" onClick={handleAddBullet} disabled={!draft.trim()}>
              Add bullet
            </button>
          </div>
        </div>

        {/* the STAR bank seam */}
        {stories.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <label className="h-label">
              From your STAR bank <span className="h-label-note">— written once, reused here</span>
            </label>
            <div className="h-chips">
              {stories
                .filter((st) => storyToBullet(st))
                .map((st) => (
                  <button
                    key={st.id}
                    className="h-chip"
                    title={storyToBullet(st)}
                    onClick={() => dispatch((s) => addBulletFromStory(s, st, draftSection || null))}
                  >
                    + {st.name || "Untitled story"}
                  </button>
                ))}
            </div>
          </div>
        )}

        {notice && <div className="h-notice">{notice}</div>}

        {slice.bullets.length === 0 ? (
          <div className="h-empty">
            No bullets yet. Start with your strongest experience — open on an action verb, end on a number.
          </div>
        ) : (
          slice.bullets.map((b) => {
            const r = analyzeBullet(b.raw, slice.keywords);
            const sec = slice.sections.find((x) => x.id === b.sectionId);
            const rewrite = suggestBulletRewrite(b.raw);
            return (
              <div className="h-bullet" key={b.id}>
                <div className="h-row" style={{ marginBottom: 8 }}>
                  <span className="section-label">{sec ? sec.title || KIND_LABELS[sec.kind] : "No section"}</span>
                  <div className="h-spacer" />
                  {r.matchedKeywords.map((k) => (
                    <span key={k} className="badge badge-green">
                      {k}
                    </span>
                  ))}
                  <span className={scoreClass(r.score)}>{r.score}/100</span>
                </div>

                <textarea
                  className="h-textarea"
                  rows={2}
                  value={b.raw}
                  onChange={(e) => dispatch((s) => updateResumeBullet(s, b.id, { raw: e.target.value }))}
                />

                {r.issues.length > 0 && (
                  <ul className="h-bullet-issues">
                    {r.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                )}

                <div className="h-row" style={{ marginTop: 10 }}>
                  {rewrite && rewrite !== b.raw && (
                    <button className="btn-ghost" onClick={() => applyOfflineRewrite(b)} title={rewrite}>
                      Apply scaffold
                    </button>
                  )}
                  <button className="btn-ghost" onClick={() => handleAiRewrite(b)} disabled={busyId === b.id}>
                    {busyId === b.id
                      ? "Rewriting…"
                      : !hasBridge
                      ? "AI rewrite · desktop app only"
                      : aiReachable
                      ? "AI rewrite"
                      : "AI rewrite · needs an endpoint"}
                  </button>
                  <div className="h-spacer" />
                  <button
                    className="btn-ghost"
                    style={{ color: "var(--red-2)" }}
                    onClick={() => dispatch((s) => removeResumeBullet(s, b.id))}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── output ── */}
      <div className="glass h-card">
        <div className="h-row" style={{ marginBottom: 8 }}>
          <span className="section-label">ATS-safe output</span>
          <span className="badge badge-muted">plain text</span>
        </div>
        <p className="h-sub" style={{ marginBottom: 12 }}>
          {atsRules().join(" ")}
        </p>
        <pre className="h-output">{output}</pre>
        <div className="h-actions">
          <button className="btn-ghost" onClick={() => navigator.clipboard?.writeText(output)}>
            Copy
          </button>
          <button className="btn-ghost" onClick={() => download(output, "resume.txt")}>
            Download .txt
          </button>
        </div>
      </div>
    </div>
  );
}
