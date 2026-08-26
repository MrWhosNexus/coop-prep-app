"use client";

// components/tools/NetworkTracker.js
// Network Tracker — informational interviews and the follow-up cadence from
// lessons hustle-network-1/3: the 4-sentence ask, the 24-hour thank-you, the
// 6-8 week genuine update.
//
// The templates are static text and fully useful with no AI, no key, no
// network. Nothing in this component talks to a model.

import { useMemo, useState } from "react";
import {
  REPLY_STATUSES,
  REPLY_STATUS_LABELS,
  CONTACT_SOURCES,
  defaultNetworkTrackerState,
  addContact,
  updateContact,
  removeContact,
  setContactStatus,
  markContactFollowedUp,
  markThankYouSent,
  nextActionFor,
  sortByFollowUp,
  dueContacts,
  thankYousOwed,
  networkStats,
  diagnoseNetwork,
  outreachTemplate,
  thankYouTemplate,
  updateTemplate,
  todayISO,
} from "@/lib/tools/network";
import "./hustle-tools.css";

const FINDING_ICON = { critical: "!", warn: "!", info: "→", good: "✓" };
const EMPTY_DRAFT = { name: "", firm: "", role: "", source: "linkedin" };

const TEMPLATE_KINDS = [
  { id: "outreach", label: "The 4-sentence ask" },
  { id: "thankYou", label: "24-hour thank-you" },
  { id: "update", label: "6-8 week update" },
];

export default function NetworkTracker({ state, dispatch }) {
  const slice = state?.tools?.networkTracker ?? defaultNetworkTrackerState;
  // Memoized: a bare `?? []` mints a new array every render, which would make
  // every useMemo below recompute on every keystroke.
  const contacts = useMemo(() => slice.contacts ?? [], [slice.contacts]);
  const today = todayISO();

  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [showAdd, setShowAdd] = useState(false);
  const [composeId, setComposeId] = useState(null);
  const [kind, setKind] = useState("outreach");
  const [yourName, setYourName] = useState("");
  const [detail, setDetail] = useState("");
  const [ask, setAsk] = useState("");

  const stats = useMemo(() => networkStats(contacts), [contacts]);
  const findings = useMemo(() => diagnoseNetwork(contacts, today), [contacts, today]);
  const due = useMemo(() => dueContacts(contacts, today), [contacts, today]);
  const owed = useMemo(() => thankYousOwed(contacts, today), [contacts, today]);
  const sorted = useMemo(() => sortByFollowUp(contacts), [contacts]);

  const composing = contacts.find((c) => c.id === composeId) ?? null;

  const message = useMemo(() => {
    if (!composing) return "";
    if (kind === "thankYou") return thankYouTemplate(composing, detail, { yourName });
    if (kind === "update") return updateTemplate(composing, { didWithAdvice: detail, ask }, { yourName });
    return outreachTemplate(composing, { yourName });
  }, [composing, kind, detail, ask, yourName]);

  function handleAdd() {
    if (!draft.name.trim()) return;
    dispatch((s) => addContact(s, { ...draft, outreachDate: today }));
    setDraft(EMPTY_DRAFT);
    setShowAdd(false);
  }

  return (
    <div className="h-page h-page-wide">
      <div className="h-head">
        <h1 className="h-title">Network Tracker</h1>
        <p className="h-sub">
          Referrals convert at a multiple of cold applications. This tracks who you asked, who replied, and — the part
          everyone drops — when the next genuine touch is due. The cadence is computed for you: 24 hours for a
          thank-you, seven weeks for an update.
        </p>
      </div>

      <div className="h-stats">
        <div className="h-stat">
          <div className="h-stat-v">{stats.total}</div>
          <div className="h-stat-k">Contacts</div>
        </div>
        <div className="h-stat">
          <div className="h-stat-v">{stats.sent}</div>
          <div className="h-stat-k">Reached out</div>
        </div>
        <div className="h-stat">
          <div className="h-stat-v">{Math.round(stats.replyRate * 100)}%</div>
          <div className="h-stat-k">Reply rate</div>
        </div>
        <div className={`h-stat ${stats.conversations > 0 ? "h-stat-good" : ""}`}>
          <div className="h-stat-v">{stats.conversations}</div>
          <div className="h-stat-k">Conversations</div>
        </div>
        <div className={`h-stat ${owed.length + due.length > 0 ? "h-stat-bad" : ""}`}>
          <div className="h-stat-v">{owed.length + due.length}</div>
          <div className="h-stat-k">Owed now</div>
        </div>
      </div>

      <div className="glass h-card h-card-tight">
        <span className="section-label">Where your network stands</span>
        <div style={{ marginTop: 10 }}>
          {findings.map((f) => (
            <div key={f.code} className={`h-finding h-finding-${f.severity}`}>
              <span className="h-finding-icon">{FINDING_ICON[f.severity]}</span>
              <span>{f.message}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── contacts ── */}
      <div className="glass h-card">
        <div className="h-row">
          <span className="section-label">Contacts</span>
          <div className="h-spacer" />
          <button className="btn-ghost" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? "Cancel" : "+ Add contact"}
          </button>
        </div>

        {showAdd && (
          <div className="h-grid-4" style={{ marginTop: 14, alignItems: "end" }}>
            <div>
              <label className="h-label">Name</label>
              <input
                className="h-input h-input-sm"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Dana Lee"
              />
            </div>
            <div>
              <label className="h-label">Firm</label>
              <input
                className="h-input h-input-sm"
                value={draft.firm}
                onChange={(e) => setDraft({ ...draft, firm: e.target.value })}
                placeholder="JP Morgan"
              />
            </div>
            <div>
              <label className="h-label">Their role</label>
              <input
                className="h-input h-input-sm"
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                placeholder="Wealth Advisor"
              />
            </div>
            <div>
              <label className="h-label">Source</label>
              <div className="h-row" style={{ gap: 8, flexWrap: "nowrap" }}>
                <select
                  className="h-select h-input-sm"
                  value={draft.source}
                  onChange={(e) => setDraft({ ...draft, source: e.target.value })}
                >
                  {CONTACT_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button className="btn-primary" onClick={handleAdd} disabled={!draft.name.trim()}>
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {contacts.length === 0 ? (
          <div className="h-empty">
            No contacts yet. One informational interview a week compounds faster than any amount of application volume.
          </div>
        ) : (
          <div className="h-table-wrap" style={{ marginTop: 14 }}>
            <table className="h-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Firm</th>
                  <th>Status</th>
                  <th>Next action</th>
                  <th>Due</th>
                  <th>Thank-you</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => {
                  const isDue = c.nextFollowUpDate && c.nextFollowUpDate <= today;
                  const owes = c.replyStatus === "completed" && !c.thankYouSent;
                  return (
                    <tr key={c.id} className={isDue || owes ? "h-row-overdue" : ""}>
                      <td style={{ fontWeight: 600 }}>{c.name || "—"}</td>
                      <td>
                        {c.firm || "—"}
                        {c.role && <div className="h-item-meta">{c.role}</div>}
                      </td>
                      <td>
                        <select
                          className="h-select h-input-sm"
                          value={c.replyStatus}
                          onChange={(e) => dispatch((s) => setContactStatus(s, c.id, e.target.value))}
                        >
                          {REPLY_STATUSES.map((x) => (
                            <option key={x} value={x}>
                              {REPLY_STATUS_LABELS[x]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="h-td-muted">{nextActionFor(c.replyStatus) || "—"}</td>
                      <td className="h-num h-td-muted">{c.nextFollowUpDate || "—"}</td>
                      <td>
                        {c.replyStatus !== "completed" ? (
                          <span className="h-td-muted">—</span>
                        ) : c.thankYouSent ? (
                          <span className="badge badge-green">Sent</span>
                        ) : (
                          <button className="btn-ghost" style={{ padding: "4px 8px" }} onClick={() => dispatch((s) => markThankYouSent(s, c.id))}>
                            Mark sent
                          </button>
                        )}
                      </td>
                      <td>
                        <div className="h-row" style={{ gap: 6, flexWrap: "nowrap" }}>
                          <button
                            className="btn-ghost"
                            style={{ padding: "4px 8px" }}
                            onClick={() => {
                              setComposeId(c.id);
                              setKind(c.replyStatus === "completed" ? "thankYou" : "outreach");
                            }}
                          >
                            Write
                          </button>
                          <button
                            className="btn-ghost"
                            style={{ padding: "4px 8px" }}
                            onClick={() => dispatch((s) => markContactFollowedUp(s, c.id))}
                            title="Log a touch today and reschedule the next one"
                          >
                            Touch
                          </button>
                          <button
                            className="btn-ghost"
                            style={{ color: "var(--red-2)", padding: "4px 8px" }}
                            onClick={() => dispatch((s) => removeContact(s, c.id))}
                            aria-label={`Remove ${c.name}`}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── composer ── */}
      {composing && (
        <div className="glass h-card">
          <div className="h-row" style={{ marginBottom: 12 }}>
            <span className="section-label">Writing to {composing.name || "your contact"}</span>
            <div className="h-spacer" />
            <button className="btn-ghost" onClick={() => setComposeId(null)}>
              Close
            </button>
          </div>

          <div className="h-chips" style={{ marginBottom: 14 }}>
            {TEMPLATE_KINDS.map((k) => (
              <button key={k.id} className={`h-chip ${kind === k.id ? "h-chip-on" : ""}`} onClick={() => setKind(k.id)}>
                {k.label}
              </button>
            ))}
          </div>

          <div className="h-grid-2" style={{ marginBottom: 14 }}>
            <div>
              <label className="h-label">Your name</label>
              <input className="h-input" value={yourName} onChange={(e) => setYourName(e.target.value)} placeholder="Jane Smith" />
            </div>
            {kind !== "outreach" && (
              <div>
                <label className="h-label">
                  {kind === "thankYou" ? "One real detail they said" : "What you did with their advice"}
                </label>
                <input
                  className="h-input"
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder={
                    kind === "thankYou"
                      ? "your point about starting in ops"
                      : "I passed the SIE and started the Series 65"
                  }
                />
              </div>
            )}
            {kind === "update" && (
              <div>
                <label className="h-label">
                  Your ask <span className="h-label-note">— optional; the update comes first either way</span>
                </label>
                <input className="h-input" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="a referral to the analyst program" />
              </div>
            )}
          </div>

          <pre className="h-output h-output-prose">{message}</pre>
          <div className="h-actions">
            <button className="btn-ghost" onClick={() => navigator.clipboard?.writeText(message)}>
              Copy
            </button>
            {composing.replyStatus === "notSent" && kind === "outreach" && (
              <button className="btn-primary" onClick={() => dispatch((s) => setContactStatus(s, composing.id, "sent"))}>
                Mark as sent
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
