"use client";

// components/tools/NegotiationPrep.js
// Salary Negotiation Prep — lesson hustle-interview-3.
//
// Pure template fill, total-comp math, and BATNA prep. No AI, no key, no
// network. The tool refuses to invent a market anchor: the whole point of the
// lesson's script is that the ask is anchored to a real, citable number.

import { useMemo, useState } from "react";
import {
  defaultSalaryNegotiationState,
  setSalaryNegotiationField,
  setBatnaField,
  addOffer,
  updateOffer,
  removeOffer,
  parseMoney,
  formatMoney,
  totalComp,
  compareOffers,
  marketPosition,
  suggestTargetAsk,
  generateNegotiationScript,
  batnaPrep,
  negotiationReadiness,
} from "@/lib/tools/negotiation";
import "./hustle-tools.css";

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

const STRENGTH_CLASS = { strong: "badge badge-green", moderate: "badge badge-gold", weak: "badge badge-red" };

export default function NegotiationPrep({ state, dispatch }) {
  const raw = state?.tools?.salaryNegotiationPrep ?? defaultSalaryNegotiationState;
  const slice = {
    ...defaultSalaryNegotiationState,
    ...raw,
    fields: { ...defaultSalaryNegotiationState.fields, ...(raw.fields ?? {}) },
    batna: { ...defaultSalaryNegotiationState.batna, ...(raw.batna ?? {}) },
  };
  const fields = slice.fields;
  // Memoized: a bare `?? []` mints a new array every render, defeating the
  // compareOffers memo below.
  const offers = useMemo(() => slice.offers ?? [], [slice.offers]);

  const [tab, setTab] = useState("script");

  const position = useMemo(() => marketPosition(fields), [fields]);
  const suggested = useMemo(() => suggestTargetAsk(fields), [fields]);
  const script = useMemo(() => generateNegotiationScript(fields), [fields]);
  const batna = useMemo(() => batnaPrep(state ?? {}), [state]);
  const readiness = useMemo(() => negotiationReadiness(state ?? {}), [state]);
  const ranked = useMemo(() => compareOffers(offers), [offers]);

  function f(key, value) {
    dispatch((s) => setSalaryNegotiationField(s, key, value));
  }

  return (
    <div className="h-page h-page-wide">
      <div className="h-head">
        <h1 className="h-title">Salary Negotiation Prep</h1>
        <p className="h-sub">
          Most entry-level candidates never negotiate and lose the money by default. A polite, specific, one-time ask
          anchored to a real market number almost never costs the offer. This builds that ask — and does the total-comp
          math a base salary hides.
        </p>
      </div>

      <div className="h-chips" style={{ marginBottom: 18 }}>
        {[
          ["script", "The ask"],
          ["compare", "Compare offers"],
          ["batna", "If they say no"],
        ].map(([id, label]) => (
          <button key={id} className={`h-chip ${tab === id ? "h-chip-on" : ""}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {/* ── THE ASK ── */}
      {tab === "script" && (
        <>
          <div className="glass h-card">
            <span className="section-label">Readiness</span>
            <div className="h-rubric" style={{ marginTop: 10 }}>
              {readiness.checklist.map((c) => (
                <div className="h-rubric-row" key={c.key}>
                  <span className={`h-rubric-mark ${c.done ? "h-rubric-pass" : "h-rubric-fail"}`}>{c.done ? "✓" : "✕"}</span>
                  <span className="h-rubric-note">{c.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass h-card">
            <span className="section-label">The offer</span>
            <div className="h-grid-3" style={{ marginTop: 10 }}>
              <div>
                <label className="h-label">Role</label>
                <input className="h-input" value={fields.role} onChange={(e) => f("role", e.target.value)} placeholder="Wealth Management Analyst" />
              </div>
              <div>
                <label className="h-label">Company</label>
                <input className="h-input" value={fields.company} onChange={(e) => f("company", e.target.value)} placeholder="JP Morgan" />
              </div>
              <div>
                <label className="h-label">Offered base</label>
                <input className="h-input" value={fields.offerBase} onChange={(e) => f("offerBase", e.target.value)} placeholder="$70,000" />
              </div>
            </div>

            <div className="h-grid-3" style={{ marginTop: 14 }}>
              <div>
                <label className="h-label">Market range — low</label>
                <input className="h-input" value={fields.marketRangeLow} onChange={(e) => f("marketRangeLow", e.target.value)} placeholder="$65,000" />
              </div>
              <div>
                <label className="h-label">Market range — high</label>
                <input className="h-input" value={fields.marketRangeHigh} onChange={(e) => f("marketRangeHigh", e.target.value)} placeholder="$85,000" />
              </div>
              <div>
                <label className="h-label">
                  Source <span className="h-label-note">— name it; you may be asked</span>
                </label>
                <input className="h-input" value={fields.marketSource} onChange={(e) => f("marketSource", e.target.value)} placeholder="levels.fyi, Glassdoor, a COOP alum" />
              </div>
            </div>

            <div className="h-field" style={{ marginTop: 14, marginBottom: 0, maxWidth: 320 }}>
              <label className="h-label">
                Your target ask{" "}
                {suggested > 0 && !parseMoney(fields.targetAsk) && (
                  <span className="h-label-note">
                    — suggested{" "}
                    <button
                      className="h-chip"
                      style={{ padding: "1px 7px" }}
                      onClick={() => f("targetAsk", String(suggested))}
                    >
                      {formatMoney(suggested)}
                    </button>
                  </span>
                )}
              </label>
              <input className="h-input" value={fields.targetAsk} onChange={(e) => f("targetAsk", e.target.value)} placeholder="$78,000" />
            </div>
          </div>

          {position.valid && (
            <div className="glass h-card">
              <div className="h-row" style={{ marginBottom: 8 }}>
                <span className="section-label">Where the offer sits</span>
                <div className="h-spacer" />
                <span className="h-score">{Math.round(position.percentile * 100)}th percentile of your range</span>
              </div>
              <div className="h-meter">
                <div
                  className={`h-meter-fill ${position.percentile <= 0.35 ? "h-meter-fill-bad" : position.percentile >= 0.75 ? "h-meter-fill-good" : ""}`}
                  style={{ width: `${Math.max(2, position.percentile * 100)}%` }}
                />
              </div>
              <div className="h-row" style={{ justifyContent: "space-between", fontSize: 12, color: "var(--text-3)" }}>
                <span className="h-num">{formatMoney(position.low)}</span>
                <span className="h-num">{formatMoney(position.high)}</span>
              </div>
              <div className={`h-finding ${position.gapToHigh > 0 ? "h-finding-warn" : "h-finding-info"}`} style={{ marginTop: 12 }}>
                <span className="h-finding-icon">→</span>
                <span>
                  {position.verdict}
                  {position.gapToHigh > 0 && ` ${formatMoney(position.gapToHigh)} between the offer and the top of the range.`}
                </span>
              </div>
            </div>
          )}

          <div className="glass h-card">
            <div className="h-row" style={{ marginBottom: 12 }}>
              <span className="section-label">Your script</span>
              {!position.valid && <span className="badge badge-red">No market anchor yet</span>}
            </div>
            <pre className="h-output h-output-prose">{script}</pre>
            <div className="h-actions">
              <button className="btn-ghost" onClick={() => navigator.clipboard?.writeText(script)}>
                Copy
              </button>
              <button className="btn-ghost" onClick={() => download(script, "negotiation-script.txt")}>
                Download .txt
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── COMPARE ── */}
      {tab === "compare" && (
        <div className="glass h-card">
          <div className="h-row" style={{ marginBottom: 12 }}>
            <span className="section-label">Total comp</span>
            <div className="h-spacer" />
            <button className="btn-ghost" onClick={() => dispatch((s) => addOffer(s, { label: "New offer" }))}>
              + Add offer
            </button>
          </div>
          <p className="h-sub" style={{ marginBottom: 14 }}>
            A base salary is not an offer. Recurring comp is what repeats every year; the signing bonus does not — and
            conflating the two is how a candidate talks themselves into the worse job.
          </p>

          {offers.length === 0 ? (
            <div className="h-empty">No offers logged. Add one — even a single offer is worth costing out properly.</div>
          ) : (
            <>
              <div className="h-table-wrap">
                <table className="h-table">
                  <thead>
                    <tr>
                      <th>Offer</th>
                      <th>Base</th>
                      <th>Bonus</th>
                      <th>Signing</th>
                      <th>Equity/yr</th>
                      <th>401k %</th>
                      <th>Recurring</th>
                      <th>Year one</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((o) => {
                      const c = totalComp(o);
                      const rank = ranked.find((r) => r.offer.id === o.id);
                      return (
                        <tr key={o.id}>
                          <td>
                            <input
                              className="h-input h-input-sm"
                              value={o.label}
                              onChange={(e) => dispatch((s) => updateOffer(s, o.id, { label: e.target.value }))}
                              placeholder="JP Morgan"
                            />
                            {rank?.rank === 1 && offers.length > 1 && (
                              <span className="badge badge-green" style={{ marginTop: 4 }}>
                                Best total
                              </span>
                            )}
                          </td>
                          {["base", "bonus", "signing", "equityPerYear", "retirementMatchPct"].map((k) => (
                            <td key={k}>
                              <input
                                className="h-input h-input-sm h-num"
                                style={{ width: 92 }}
                                defaultValue={o[k] || ""}
                                onBlur={(e) => dispatch((s) => updateOffer(s, o.id, { [k]: e.target.value }))}
                                placeholder="0"
                              />
                            </td>
                          ))}
                          <td className="h-num" style={{ fontWeight: 700 }}>
                            {formatMoney(c.recurring)}
                          </td>
                          <td className="h-num">{formatMoney(c.yearOne)}</td>
                          <td>
                            <button
                              className="btn-ghost"
                              style={{ color: "var(--red-2)", padding: "4px 8px" }}
                              onClick={() => dispatch((s) => removeOffer(s, o.id))}
                              aria-label={`Remove ${o.label}`}
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

              {ranked.length > 1 && (
                <div className="h-finding h-finding-info" style={{ marginTop: 14 }}>
                  <span className="h-finding-icon">→</span>
                  <span>
                    {ranked[0].offer.label || "The top offer"} leads on recurring comp by{" "}
                    {formatMoney(Math.abs(ranked[1].deltaRecurring))} a year against{" "}
                    {ranked[1].offer.label || "the next one"}
                    {ranked[1].comp.base > ranked[0].comp.base
                      ? " — even though its base is lower. That is the whole reason to do this math."
                      : "."}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── BATNA ── */}
      {tab === "batna" && (
        <>
          <div className="glass h-card">
            <div className="h-row" style={{ marginBottom: 12 }}>
              <span className="section-label">Your position</span>
              <div className="h-spacer" />
              <span className={STRENGTH_CLASS[batna.strength]}>{batna.strength}</span>
            </div>
            <p className="h-sub" style={{ marginBottom: 14 }}>{batna.summary}</p>

            <div className="h-grid-3">
              <div>
                <label className="h-label">Competing offer, if any</label>
                <input
                  className="h-input"
                  value={slice.batna.competingOffer}
                  onChange={(e) => dispatch((s) => setBatnaField(s, "competingOffer", e.target.value))}
                  placeholder="$78,000"
                />
              </div>
              <div>
                <label className="h-label">Your walk-away number</label>
                <input
                  className="h-input"
                  value={slice.batna.walkAwayBase}
                  onChange={(e) => dispatch((s) => setBatnaField(s, "walkAwayBase", e.target.value))}
                  placeholder="$65,000"
                />
              </div>
              <div>
                <label className="h-label">Your current situation</label>
                <input
                  className="h-input"
                  value={slice.batna.currentSituation}
                  onChange={(e) => dispatch((s) => setBatnaField(s, "currentSituation", e.target.value))}
                  placeholder="Employed — I can afford to wait"
                />
              </div>
            </div>
          </div>

          {batna.leverage.length > 0 && (
            <div className="glass h-card">
              <span className="section-label">What you actually have</span>
              <div style={{ marginTop: 10 }}>
                {batna.leverage.map((l, i) => (
                  <div key={i} className="h-finding h-finding-good">
                    <span className="h-finding-icon">✓</span>
                    <span>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {batna.risks.length > 0 && (
            <div className="glass h-card">
              <span className="section-label">Decide this now, in the calm</span>
              <div style={{ marginTop: 10 }}>
                {batna.risks.map((r, i) => (
                  <div key={i} className="h-finding h-finding-warn">
                    <span className="h-finding-icon">!</span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
