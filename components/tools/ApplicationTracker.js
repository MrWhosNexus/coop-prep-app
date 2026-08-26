"use client";

// components/tools/ApplicationTracker.js
// Application Tracker — pipeline discipline (lesson hustle-network-2).
//
// Default-sorted by next action date, per the lesson's explicit weekly-sort
// instruction: this is a to-do list, not a log. The funnel diagnosis is the
// point — it names where the pipeline is actually leaking. No AI, no network.

import { useMemo, useState } from "react";
import {
  APPLICATION_STATUSES,
  APPLICATION_SOURCES,
  STATUS_LABELS,
  defaultApplicationTrackerState,
  addApplication,
  updateApplication,
  removeApplication,
  setApplicationStatus,
  sortByNextAction,
  dueApplications,
  funnelStats,
  diagnosePipeline,
  exportApplicationsCsv,
  todayISO,
} from "@/lib/tools/applications";
import "./hustle-tools.css";

const FINDING_ICON = { critical: "!", warn: "!", info: "→", good: "✓" };

function pct(n) {
  return `${Math.round(n * 100)}%`;
}

function download(text, filename, type = "text/csv") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const EMPTY_DRAFT = { company: "", role: "", source: "cold", dateApplied: "" };

export default function ApplicationTracker({ state, dispatch }) {
  const slice = state?.tools?.applicationTracker ?? defaultApplicationTrackerState;
  // Memoized: a bare `?? []` mints a new array every render, which would make
  // every useMemo below recompute on every keystroke.
  const apps = useMemo(() => slice.applications ?? [], [slice.applications]);
  const today = todayISO();

  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [showAdd, setShowAdd] = useState(false);

  const stats = useMemo(() => funnelStats(apps), [apps]);
  const findings = useMemo(() => diagnosePipeline(apps, today), [apps, today]);
  const due = useMemo(() => dueApplications(apps, today), [apps, today]);
  const sorted = useMemo(() => sortByNextAction(apps), [apps]);

  function handleAdd() {
    if (!draft.company.trim()) return;
    dispatch((s) => addApplication(s, { ...draft, dateApplied: draft.dateApplied || today }));
    setDraft(EMPTY_DRAFT);
    setShowAdd(false);
  }

  return (
    <div className="h-page h-page-wide">
      <div className="h-head">
        <h1 className="h-title">Application Tracker</h1>
        <p className="h-sub">
          Seven columns, sorted by next action date. Sorted this way it is a to-do list; sorted any other way it is a
          passive log. The read on your funnel below is the part that actually changes what you do next.
        </p>
      </div>

      {/* ── funnel ── */}
      <div className="h-stats">
        <div className="h-stat">
          <div className="h-stat-v">{stats.total}</div>
          <div className="h-stat-k">Applied</div>
        </div>
        <div className="h-stat">
          <div className="h-stat-v">{stats.reached.screen}</div>
          <div className="h-stat-k">Screens · {pct(stats.rates.screenRate)}</div>
        </div>
        <div className="h-stat">
          <div className="h-stat-v">{stats.reached.interview}</div>
          <div className="h-stat-k">Interviews · {pct(stats.rates.interviewRate)}</div>
        </div>
        <div className={`h-stat ${stats.reached.offer > 0 ? "h-stat-good" : ""}`}>
          <div className="h-stat-v">{stats.reached.offer}</div>
          <div className="h-stat-k">Offers · {pct(stats.rates.offerRate)}</div>
        </div>
        <div className={`h-stat ${due.length > 0 ? "h-stat-bad" : ""}`}>
          <div className="h-stat-v">{due.length}</div>
          <div className="h-stat-k">Due now</div>
        </div>
      </div>

      {/* ── the diagnosis ── */}
      <div className="glass h-card h-card-tight">
        <span className="section-label">What your pipeline says</span>
        <div style={{ marginTop: 10 }}>
          {findings.map((f) => (
            <div key={f.code} className={`h-finding h-finding-${f.severity}`}>
              <span className="h-finding-icon">{FINDING_ICON[f.severity]}</span>
              <span>{f.message}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── add ── */}
      <div className="glass h-card">
        <div className="h-row">
          <span className="section-label">Pipeline</span>
          <div className="h-spacer" />
          <button className="btn-ghost" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? "Cancel" : "+ Add application"}
          </button>
          {apps.length > 0 && (
            <button className="btn-ghost" onClick={() => download(exportApplicationsCsv(apps), "applications.csv")}>
              Export CSV
            </button>
          )}
        </div>

        {showAdd && (
          <div className="h-grid-4" style={{ marginTop: 14, alignItems: "end" }}>
            <div>
              <label className="h-label">Company</label>
              <input
                className="h-input h-input-sm"
                value={draft.company}
                onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="JP Morgan"
              />
            </div>
            <div>
              <label className="h-label">Role</label>
              <input
                className="h-input h-input-sm"
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Wealth Management Analyst"
              />
            </div>
            <div>
              <label className="h-label">Source</label>
              <select
                className="h-select h-input-sm"
                value={draft.source}
                onChange={(e) => setDraft({ ...draft, source: e.target.value })}
              >
                {APPLICATION_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="h-label">Date applied</label>
              <div className="h-row" style={{ gap: 8, flexWrap: "nowrap" }}>
                <input
                  type="date"
                  className="h-input h-input-sm"
                  value={draft.dateApplied || today}
                  onChange={(e) => setDraft({ ...draft, dateApplied: e.target.value })}
                />
                <button className="btn-primary" onClick={handleAdd} disabled={!draft.company.trim()}>
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {apps.length === 0 ? (
          <div className="h-empty">
            Nothing tracked yet. Every application goes in here — the funnel only tells you the truth if it is complete.
          </div>
        ) : (
          <div className="h-table-wrap" style={{ marginTop: 14 }}>
            <table className="h-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Applied</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Next action</th>
                  <th>Next date</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => {
                  const overdue = a.nextActionDate && a.nextActionDate <= today && a.nextAction;
                  return (
                    <tr key={a.id} className={overdue ? "h-row-overdue" : ""}>
                      <td style={{ fontWeight: 600 }}>{a.company || "—"}</td>
                      <td>{a.role || "—"}</td>
                      <td className="h-num h-td-muted">{a.dateApplied}</td>
                      <td>
                        <select
                          className="h-select h-input-sm"
                          value={a.source}
                          onChange={(e) => dispatch((s) => updateApplication(s, a.id, { source: e.target.value }))}
                        >
                          {APPLICATION_SOURCES.map((x) => (
                            <option key={x} value={x}>
                              {x}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="h-select h-input-sm"
                          value={a.status}
                          onChange={(e) => dispatch((s) => setApplicationStatus(s, a.id, e.target.value))}
                        >
                          {APPLICATION_STATUSES.map((x) => (
                            <option key={x} value={x}>
                              {STATUS_LABELS[x]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className="h-input h-input-sm"
                          value={a.nextAction}
                          onChange={(e) => dispatch((s) => updateApplication(s, a.id, { nextAction: e.target.value }))}
                          placeholder="—"
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          className="h-input h-input-sm"
                          value={a.nextActionDate || ""}
                          onChange={(e) =>
                            dispatch((s) => updateApplication(s, a.id, { nextActionDate: e.target.value }))
                          }
                        />
                      </td>
                      <td>
                        <button
                          className="btn-ghost"
                          style={{ color: "var(--red-2)", padding: "4px 8px" }}
                          onClick={() => dispatch((s) => removeApplication(s, a.id))}
                          aria-label={`Remove ${a.company}`}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
