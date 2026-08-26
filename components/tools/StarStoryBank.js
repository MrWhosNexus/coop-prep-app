"use client";

// components/tools/StarStoryBank.js
// The STAR Story Bank — the keystone Hustle asset (lesson hustle-materials-3).
//
// One story, written once, reused everywhere: the Resume Builder pulls bullets
// from it and the Mock Interview pulls answers from it. No AI, no key, no
// network — this tool is complete offline by design.

import { useMemo, useState } from "react";
import {
  STORY_TAGS,
  STORY_TAG_LABELS,
  defaultStarStoryBankState,
  addStory,
  updateStory,
  removeStory,
  tagStory,
  untagStory,
  setActiveStory,
  logStoryUsage,
  scoreStory,
  bankStatus,
  storyToStarText,
  storyToBullet,
  exportStoriesText,
} from "@/lib/tools/starStories";
import "./hustle-tools.css";

function scoreClass(score) {
  if (score >= 80) return "h-score h-score-good";
  if (score >= 50) return "h-score h-score-mid";
  return "h-score h-score-bad";
}

const PART_HELP = {
  situation: "Where and when. Two sentences of context, no more.",
  task: "What you were actually responsible for delivering.",
  action: "What YOU did — the bulk of the story. Use 'I', not 'we'.",
  result: "What changed, with a number. A result without a number is an anecdote.",
};

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

export default function StarStoryBank({ state, dispatch }) {
  const bank = state?.tools?.starStoryBank ?? defaultStarStoryBankState;
  const stories = bank.stories ?? [];
  const [filter, setFilter] = useState("all");
  const [logging, setLogging] = useState("");

  const status = useMemo(() => bankStatus(state ?? {}), [state]);
  const active = stories.find((s) => s.id === bank.activeStoryId) ?? null;
  const activeScore = active ? scoreStory(active) : null;

  const shown = filter === "all" ? stories : stories.filter((s) => (s.tags ?? []).includes(filter));

  function handleAdd() {
    dispatch((s) => addStory(s, { name: "Untitled story" }));
  }

  function handleField(key, value) {
    if (!active) return;
    dispatch((s) => updateStory(s, active.id, { [key]: value }));
  }

  function handleToggleTag(tag) {
    if (!active) return;
    const on = (active.tags ?? []).includes(tag);
    dispatch((s) => (on ? untagStory(s, active.id, tag) : tagStory(s, active.id, tag)));
  }

  function handleLogUsage() {
    const q = logging.trim();
    if (!active || !q) return;
    dispatch((s) => logStoryUsage(s, active.id, q));
    setLogging("");
  }

  return (
    <div className="h-page h-page-wide">
      <div className="h-head">
        <h1 className="h-title">STAR Story Bank</h1>
        <p className="h-sub">
          Six to eight real experiences, written once in STAR format and tagged by the categories interviewers
          actually ask about. This is the keystone: your resume bullets and your mock-interview answers both come
          from here, so you write each story once instead of three times.
        </p>
      </div>

      {/* ── bank health ── */}
      <div className="h-stats">
        <div className="h-stat">
          <div className="h-stat-v">{status.storyCount}</div>
          <div className="h-stat-k">Stories</div>
        </div>
        <div className={`h-stat ${status.completeCount === status.storyCount && status.storyCount > 0 ? "h-stat-good" : ""}`}>
          <div className="h-stat-v">{status.completeCount}</div>
          <div className="h-stat-k">Complete</div>
        </div>
        <div className="h-stat">
          <div className="h-stat-v">{status.averageScore}</div>
          <div className="h-stat-k">Avg score</div>
        </div>
        <div className={`h-stat ${status.coverage.gaps.length > 0 ? "h-stat-bad" : "h-stat-good"}`}>
          <div className="h-stat-v">
            {status.coverage.covered}/{status.coverage.total}
          </div>
          <div className="h-stat-k">Categories</div>
        </div>
      </div>

      {status.messages.length > 0 && (
        <div className="glass h-card h-card-tight">
          {status.messages.map((m, i) => (
            <div key={i} className={`h-finding ${status.coverage.ready ? "h-finding-good" : "h-finding-info"}`}>
              <span className="h-finding-icon">{status.coverage.ready ? "✓" : "→"}</span>
              <span>{m}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 18, alignItems: "start" }}>
        {/* ── list ── */}
        <div className="glass h-card">
          <div className="h-row" style={{ marginBottom: 12 }}>
            <span className="section-label">Your stories</span>
            <div className="h-spacer" />
            <button className="btn-ghost" onClick={handleAdd}>
              + Add
            </button>
          </div>

          <div className="h-chips" style={{ marginBottom: 12 }}>
            <button
              className={`h-chip ${filter === "all" ? "h-chip-on" : ""}`}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            {STORY_TAGS.map((t) => (
              <button
                key={t}
                className={`h-chip ${filter === t ? "h-chip-on" : status.coverage.counts[t] === 0 && t !== "other" ? "h-chip-gap" : ""}`}
                onClick={() => setFilter(t)}
                title={status.coverage.counts[t] === 0 ? "No story in this category yet" : ""}
              >
                {STORY_TAG_LABELS[t]} {status.coverage.counts[t]}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <div className="h-empty">
              {stories.length === 0
                ? "No stories yet. Add your first — start with the analytical win you are proudest of."
                : "No story in this category yet."}
            </div>
          ) : (
            shown.map((s) => {
              const sc = scoreStory(s);
              return (
                <div
                  key={s.id}
                  className={`h-item ${s.id === bank.activeStoryId ? "h-item-active" : ""}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => dispatch((st) => setActiveStory(st, s.id))}
                >
                  <div className="h-item-head">
                    <span className="h-item-name">{s.name || "Untitled story"}</span>
                    <div className="h-spacer" />
                    <span className={scoreClass(sc.score)}>{sc.score}</span>
                  </div>
                  <div className="h-item-meta">
                    {(s.tags ?? []).length > 0
                      ? s.tags.map((t) => STORY_TAG_LABELS[t]).join(" · ")
                      : "Untagged"}
                    {(s.lastUsedFor ?? []).length > 0 && ` · used ${s.lastUsedFor.length}×`}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── editor ── */}
        <div>
          {!active ? (
            <div className="glass h-card">
              <div className="h-empty">Select a story to edit it, or add a new one.</div>
            </div>
          ) : (
            <>
              <div className="glass h-card">
                <div className="h-field">
                  <label className="h-label">Story name</label>
                  <input
                    className="h-input"
                    value={active.name}
                    onChange={(e) => handleField("name", e.target.value)}
                    placeholder="e.g. HMDA bias audit"
                  />
                </div>

                <div className="h-field">
                  <label className="h-label">Categories</label>
                  <div className="h-chips">
                    {STORY_TAGS.map((t) => (
                      <button
                        key={t}
                        className={`h-chip ${(active.tags ?? []).includes(t) ? "h-chip-on" : ""}`}
                        onClick={() => handleToggleTag(t)}
                      >
                        {STORY_TAG_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>

                {["situation", "task", "action", "result"].map((part) => (
                  <div className="h-field" key={part}>
                    <label className="h-label">
                      {part[0].toUpperCase() + part.slice(1)}{" "}
                      <span className="h-label-note">— {PART_HELP[part]}</span>
                    </label>
                    <textarea
                      className="h-textarea"
                      rows={part === "action" ? 4 : 3}
                      value={active[part]}
                      onChange={(e) => handleField(part, e.target.value)}
                    />
                  </div>
                ))}

                <div className="h-actions">
                  <button
                    className="btn-ghost"
                    onClick={() => navigator.clipboard?.writeText(storyToStarText(active))}
                  >
                    Copy STAR text
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => navigator.clipboard?.writeText(storyToBullet(active))}
                    disabled={!storyToBullet(active)}
                    title="The resume bullet this story produces"
                  >
                    Copy as resume bullet
                  </button>
                  <div className="h-spacer" />
                  <button
                    className="btn-ghost"
                    style={{ color: "var(--red-2)" }}
                    onClick={() => dispatch((s) => removeStory(s, active.id))}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* ── completeness ── */}
              <div className="glass h-card">
                <div className="h-row" style={{ marginBottom: 10 }}>
                  <span className="section-label">Completeness</span>
                  <div className="h-spacer" />
                  <span className={scoreClass(activeScore.score)}>{activeScore.score}/100</span>
                </div>
                <div className="h-meter">
                  <div
                    className={`h-meter-fill ${activeScore.score >= 80 ? "h-meter-fill-good" : activeScore.score < 50 ? "h-meter-fill-bad" : ""}`}
                    style={{ width: `${activeScore.score}%` }}
                  />
                </div>
                <div className="h-rubric" style={{ marginTop: 12 }}>
                  {["situation", "task", "action", "result"].map((p) => (
                    <div className="h-rubric-row" key={p}>
                      <span className={`h-rubric-mark ${activeScore.parts[p] ? "h-rubric-pass" : "h-rubric-fail"}`}>
                        {activeScore.parts[p] ? "✓" : "✕"}
                      </span>
                      <span className="h-rubric-label">{p[0].toUpperCase() + p.slice(1)}</span>
                      <span className="h-rubric-note">
                        {activeScore.parts[p] ? "Present." : "Missing or too thin."}
                      </span>
                    </div>
                  ))}
                  <div className="h-rubric-row">
                    <span className={`h-rubric-mark ${activeScore.hasNumbers ? "h-rubric-pass" : "h-rubric-fail"}`}>
                      {activeScore.hasNumbers ? "✓" : "✕"}
                    </span>
                    <span className="h-rubric-label">Quantified result</span>
                    <span className="h-rubric-note">
                      {activeScore.hasNumbers
                        ? "There is a number in the Result."
                        : "No number in the Result. Put one there — it is the difference between a claim and evidence."}
                    </span>
                  </div>
                  <div className="h-rubric-row">
                    <span className={`h-rubric-mark ${activeScore.firstPerson ? "h-rubric-pass" : "h-rubric-fail"}`}>
                      {activeScore.firstPerson ? "✓" : "✕"}
                    </span>
                    <span className="h-rubric-label">First-person Action</span>
                    <span className="h-rubric-note">
                      {activeScore.firstPerson
                        ? "You said what you did."
                        : 'The Action leans on "we". They are hiring one person — say what you did.'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── living document ── */}
              <div className="glass h-card">
                <span className="section-label">Interview log</span>
                <p className="h-sub" style={{ margin: "6px 0 12px" }}>
                  After every interview, log the exact question you used this story for. That is what keeps the bank a
                  living document instead of a thing you wrote once.
                </p>
                <div className="h-row">
                  <input
                    className="h-input"
                    style={{ flex: 1 }}
                    value={logging}
                    onChange={(e) => setLogging(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogUsage()}
                    placeholder="The exact question you were asked"
                  />
                  <button className="btn-ghost" onClick={handleLogUsage} disabled={!logging.trim()}>
                    Log
                  </button>
                </div>
                {(active.lastUsedFor ?? []).length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    {active.lastUsedFor.map((u, i) => (
                      <div key={i} className="h-item-meta" style={{ marginBottom: 4 }}>
                        <span style={{ fontFamily: "var(--font-mono)" }}>{u.date}</span> — {u.question}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {stories.length > 0 && (
        <div className="h-actions">
          <button className="btn-ghost" onClick={() => download(exportStoriesText(state ?? {}), "star-story-bank.txt")}>
            Export bank
          </button>
        </div>
      )}
    </div>
  );
}
