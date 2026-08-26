// lib/tools/negotiation.js
// Salary Negotiation Prep — lesson hustle-interview-3.
//
// Three jobs: total-comp math (a base number is not an offer), offer
// comparison (which is actually bigger), and BATNA prep (what you do if they
// say no). The script is a pure template fill — same pattern as
// assembleCoverLetter. No AI required, ever.
//
// Pure ES-module reducers over the FULL progress state, immutable. No DOM, no
// network — importable under `node --test`.

// ---------------------------------------------------------------------------
// Default slice
// ---------------------------------------------------------------------------

export const defaultSalaryNegotiationState = {
  fields: {
    role: "",
    company: "",
    offerBase: "",
    marketRangeLow: "",
    marketRangeHigh: "",
    marketSource: "",
    targetAsk: "",
  },
  offers: [], // [{ id, label, base, bonus, signing, equityPerYear, retirementMatchPct, otherAnnual, notes }]
  batna: { walkAwayBase: "", competingOffer: "", currentSituation: "", leverage: [] },
  generatedScript: null,
  lastSaved: null,
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getSlice(state) {
  const raw = state && state.tools && state.tools.salaryNegotiationPrep;
  if (!raw) return defaultSalaryNegotiationState;
  return {
    ...defaultSalaryNegotiationState,
    ...raw,
    fields: { ...defaultSalaryNegotiationState.fields, ...(raw.fields || {}) },
    batna: { ...defaultSalaryNegotiationState.batna, ...(raw.batna || {}) },
  };
}

function withSlice(state, slice) {
  return {
    ...state,
    tools: {
      ...(state && state.tools),
      salaryNegotiationPrep: { ...slice, lastSaved: Date.now() },
    },
  };
}

let idCounter = 0;
function makeId() {
  idCounter += 1;
  return `offer-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/**
 * parseMoney(value) -> a finite number, or 0.
 * Accepts "$72,000", "72k", "72,000.50", 72000. Garbage becomes 0 rather than
 * NaN, so downstream arithmetic never produces "$NaN" on a user's screen.
 *
 * @param {string|number} value
 * @returns {number}
 */
export function parseMoney(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value == null ? "" : value).trim().toLowerCase();
  if (!raw) return 0;
  const cleaned = raw.replace(/[$,\s]/g, "");
  const m = cleaned.match(/^(-?\d+(?:\.\d+)?)([km])?$/);
  if (!m) {
    const loose = parseFloat(cleaned);
    return Number.isFinite(loose) ? loose : 0;
  }
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return 0;
  if (m[2] === "k") return n * 1000;
  if (m[2] === "m") return n * 1000000;
  return n;
}

/**
 * formatMoney(n) -> "$72,000". Rounds to whole dollars.
 * @param {number} n
 * @returns {string}
 */
export function formatMoney(n) {
  const v = Number.isFinite(n) ? Math.round(n) : 0;
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString("en-US")}`;
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/**
 * createOffer(patch) -> a normalized offer.
 * @param {object} [patch]
 * @returns {{id: string, label: string, base: number, bonus: number, signing: number, equityPerYear: number, retirementMatchPct: number, otherAnnual: number, notes: string}}
 */
export function createOffer(patch = {}) {
  return {
    id: patch.id || makeId(),
    label: String(patch.label || ""),
    base: parseMoney(patch.base),
    bonus: parseMoney(patch.bonus),
    signing: parseMoney(patch.signing),
    equityPerYear: parseMoney(patch.equityPerYear),
    retirementMatchPct: parseMoney(patch.retirementMatchPct),
    otherAnnual: parseMoney(patch.otherAnnual),
    notes: String(patch.notes || ""),
  };
}

/**
 * totalComp(offer) -> the numbers that actually matter.
 *
 * `recurring` is what repeats every year. `yearOne` adds the signing bonus,
 * which does NOT repeat — conflating the two is how a candidate talks
 * themselves into a worse job.
 *
 * @param {object} offer
 * @returns {{base: number, bonus: number, signing: number, equityPerYear: number, retirementMatch: number, otherAnnual: number, recurring: number, yearOne: number}}
 */
export function totalComp(offer) {
  const o = createOffer(offer || {});
  const retirementMatch = o.base * (o.retirementMatchPct / 100);
  const recurring = o.base + o.bonus + o.equityPerYear + retirementMatch + o.otherAnnual;
  return {
    base: o.base,
    bonus: o.bonus,
    signing: o.signing,
    equityPerYear: o.equityPerYear,
    retirementMatch,
    otherAnnual: o.otherAnnual,
    recurring,
    yearOne: recurring + o.signing,
  };
}

/**
 * compareOffers(offers) -> ranked by recurring total comp, richest first,
 * each with its delta against the best.
 *
 * @param {object[]} offers
 * @returns {Array<{offer: object, comp: object, rank: number, deltaRecurring: number, deltaYearOne: number}>}
 */
export function compareOffers(offers) {
  const list = (Array.isArray(offers) ? offers : []).map((o) => ({ offer: o, comp: totalComp(o) }));
  list.sort((a, b) => b.comp.recurring - a.comp.recurring || b.comp.yearOne - a.comp.yearOne);
  const best = list[0];
  return list.map((entry, i) => ({
    ...entry,
    rank: i + 1,
    deltaRecurring: best ? entry.comp.recurring - best.comp.recurring : 0,
    deltaYearOne: best ? entry.comp.yearOne - best.comp.yearOne : 0,
  }));
}

/**
 * marketPosition(fields) -> where the offer sits inside the stated market range.
 *
 * `percentile` is 0 at the low end and 1 at the high end, clamped. `valid` is
 * false when the range is missing or inverted — an invented anchor is worse
 * than no anchor, and the script refuses to cite one.
 *
 * @param {object} fields
 * @returns {{valid: boolean, base: number, low: number, high: number, percentile: number, gapToHigh: number, gapToMid: number, verdict: string}}
 */
export function marketPosition(fields) {
  const f = fields || {};
  const base = parseMoney(f.offerBase);
  const low = parseMoney(f.marketRangeLow);
  const high = parseMoney(f.marketRangeHigh);
  const valid = base > 0 && low > 0 && high > 0 && high >= low;

  if (!valid) {
    return { valid: false, base, low, high, percentile: 0, gapToHigh: 0, gapToMid: 0, verdict: "" };
  }

  const span = high - low;
  const raw = span === 0 ? 1 : (base - low) / span;
  const percentile = Math.max(0, Math.min(1, raw));
  const mid = (low + high) / 2;

  let verdict;
  if (base < low) verdict = "Below the market range you found. That is the strongest, most factual ask you can make.";
  else if (percentile <= 0.35) verdict = "Bottom of the range. There is documented room above you.";
  else if (percentile <= 0.65) verdict = "Mid-range. A specific, polite ask toward the top is reasonable.";
  else if (base > high) verdict = "Above the range you found. Ask on signing bonus or start date rather than base.";
  else verdict = "Top of the range. Base is likely tight — signing bonus is the softer lever.";

  return {
    valid: true,
    base,
    low,
    high,
    percentile,
    gapToHigh: high - base,
    gapToMid: mid - base,
    verdict,
  };
}

/**
 * suggestTargetAsk(fields) -> a defensible number to ask for, or 0.
 *
 * Never invents a range: with no market data there is no suggestion, because
 * the lesson's whole point is that the ask is anchored to a real data point.
 *
 * @param {object} fields
 * @returns {number}
 */
export function suggestTargetAsk(fields) {
  const pos = marketPosition(fields);
  if (!pos.valid) return 0;
  if (pos.base >= pos.high) return 0; // base is maxed; the lever is elsewhere
  const midpoint = (pos.low + pos.high) / 2;
  const target = Math.max(midpoint, pos.base * 1.07);
  return Math.round(Math.min(target, pos.high) / 500) * 500;
}

// ---------------------------------------------------------------------------
// Reducers
// ---------------------------------------------------------------------------

/**
 * setSalaryNegotiationField(state, key, value) -> newState.
 * @param {object} state
 * @param {string} key
 * @param {string} value
 * @returns {object}
 */
export function setSalaryNegotiationField(state, key, value) {
  const slice = getSlice(state);
  return withSlice(state, { ...slice, fields: { ...slice.fields, [key]: value } });
}

/**
 * setBatnaField(state, key, value) -> newState.
 * @param {object} state
 * @param {string} key
 * @param {*} value
 * @returns {object}
 */
export function setBatnaField(state, key, value) {
  const slice = getSlice(state);
  return withSlice(state, { ...slice, batna: { ...slice.batna, [key]: value } });
}

/**
 * addOffer(state, offer) -> newState.
 * @param {object} state
 * @param {object} offer
 * @returns {object}
 */
export function addOffer(state, offer) {
  const slice = getSlice(state);
  return withSlice(state, { ...slice, offers: [...slice.offers, createOffer(offer)] });
}

/**
 * updateOffer(state, offerId, patch) -> newState. Money fields are re-parsed.
 * @param {object} state
 * @param {string} offerId
 * @param {object} patch
 * @returns {object}
 */
export function updateOffer(state, offerId, patch) {
  const slice = getSlice(state);
  return withSlice(state, {
    ...slice,
    offers: slice.offers.map((o) => (o.id === offerId ? createOffer({ ...o, ...patch, id: o.id }) : o)),
  });
}

/**
 * removeOffer(state, offerId) -> newState.
 * @param {object} state
 * @param {string} offerId
 * @returns {object}
 */
export function removeOffer(state, offerId) {
  const slice = getSlice(state);
  return withSlice(state, { ...slice, offers: slice.offers.filter((o) => o.id !== offerId) });
}

/**
 * setNegotiationScript(state, text) -> newState.
 * @param {object} state
 * @param {string} text
 * @returns {object}
 */
export function setNegotiationScript(state, text) {
  const slice = getSlice(state);
  return withSlice(state, { ...slice, generatedScript: text });
}

/**
 * clearSalaryNegotiationScript(state) -> newState. lastSaved is untouched.
 * @param {object} state
 * @returns {object}
 */
export function clearSalaryNegotiationScript(state) {
  const slice = getSlice(state);
  return {
    ...state,
    tools: {
      ...(state && state.tools),
      salaryNegotiationPrep: { ...slice, generatedScript: null },
    },
  };
}

// ---------------------------------------------------------------------------
// The script — pure template fill, no AI.
// ---------------------------------------------------------------------------

/**
 * generateNegotiationScript(fields) -> the filled-in ask from lesson
 * hustle-interview-3.
 *
 * Partial-field hardening, same contract as assembleCoverLetter: no
 * "undefined", no dangling fragments, and — critically — no invented market
 * anchor. With no real data point the script says out loud that the user must
 * go find one first, because a made-up anchor is how a candidate gets caught.
 *
 * @param {object} fields
 * @returns {string}
 */
export function generateNegotiationScript(fields) {
  const f = fields || {};
  const role = String(f.role || "").trim() || "the role";
  const company = String(f.company || "").trim() || "the firm";
  const source = String(f.marketSource || "").trim();
  const pos = marketPosition(f);
  const askNum = parseMoney(f.targetAsk) || suggestTargetAsk(f);
  const ask = askNum > 0 ? formatMoney(askNum) : "[your target number]";

  const lines = [];

  lines.push(
    `Thank you so much for the offer — I'm genuinely excited about ${role} at ${company}, and I want to be clear up front that I intend to accept.`
  );

  if (pos.valid) {
    const anchor = source
      ? `Looking at ${source}, the range I'm seeing for this role is ${formatMoney(pos.low)} to ${formatMoney(pos.high)}.`
      : `The range I'm seeing for this role is ${formatMoney(pos.low)} to ${formatMoney(pos.high)}, and I'm happy to share where that comes from.`;
    lines.push(anchor);
    lines.push(
      `The offer at ${formatMoney(pos.base)} sits ${pos.base < pos.low ? "below" : "toward the " + (pos.percentile <= 0.5 ? "lower" : "upper") + " end of"} that range.`
    );
    lines.push(
      `Is there any flexibility on the base — something closer to ${ask}? And if base is fixed, I'd welcome a conversation about a signing bonus instead.`
    );
  } else {
    lines.push(
      `Before I make this ask real, I need one thing I don't have yet: a specific market range for this role from a named source (levels.fyi, Glassdoor, the BLS, a COOP alum). The ask below only works anchored to a real number.`
    );
    lines.push(
      `Is there any flexibility on the base — something closer to ${ask}? And if base is fixed, I'd welcome a conversation about a signing bonus instead.`
    );
  }

  lines.push(
    `Whatever you're able to do, I'm looking forward to getting started and to what I can contribute in the first ninety days.`
  );

  const header = pos.valid
    ? "NEGOTIATION SCRIPT"
    : "NEGOTIATION SCRIPT (incomplete — no market anchor yet)";

  return [header, "", ...lines].join("\n\n");
}

/**
 * batnaPrep(state) -> the "what if they say no" half of the preparation.
 *
 * Named honestly: with no competing offer and nothing to fall back on, the
 * BATNA is weak, and the tool says so rather than flattering the user. Weak
 * BATNA does not mean don't ask — the lesson's point is that a polite ask
 * almost never costs the offer.
 *
 * @param {object} state
 * @returns {{walkAwayBase: number, competingOffer: number, hasCompeting: boolean, strength: "strong"|"moderate"|"weak", leverage: string[], risks: string[], summary: string}}
 */
export function batnaPrep(state) {
  const slice = getSlice(state);
  const b = slice.batna;
  const walkAwayBase = parseMoney(b.walkAwayBase);
  const competingOffer = parseMoney(b.competingOffer);
  const hasCompeting = competingOffer > 0;
  const offerBase = parseMoney(slice.fields.offerBase);
  const pos = marketPosition(slice.fields);

  const leverage = [];
  const risks = [];

  if (hasCompeting) {
    leverage.push(
      competingOffer > offerBase
        ? `A competing offer at ${formatMoney(competingOffer)} — ${formatMoney(competingOffer - offerBase)} above this one. That is a fact, not a bluff.`
        : `A competing offer at ${formatMoney(competingOffer)}. It is real optionality even though it pays less.`
    );
  }
  if (pos.valid && pos.base < pos.low) {
    leverage.push(`The offer is below the market range you documented — the most factual ask available.`);
  } else if (pos.valid && pos.gapToHigh > 0) {
    leverage.push(`${formatMoney(pos.gapToHigh)} of documented room between the offer and the top of your range.`);
  }
  if (Array.isArray(b.leverage)) {
    for (const item of b.leverage) if (String(item || "").trim()) leverage.push(String(item).trim());
  }
  if (String(b.currentSituation || "").trim()) {
    leverage.push(`Current situation: ${String(b.currentSituation).trim()}`);
  }

  if (!hasCompeting) {
    risks.push("No competing offer — you have no walk-away alternative, so ask once, politely, and accept a no gracefully.");
  }
  if (!pos.valid) {
    risks.push("No market anchor yet. Find a named source before you make the ask.");
  }
  if (walkAwayBase > 0 && offerBase > 0 && offerBase < walkAwayBase) {
    risks.push(
      `The offer (${formatMoney(offerBase)}) is below your stated walk-away number (${formatMoney(walkAwayBase)}). Decide now, in the calm, what you actually do if they hold firm.`
    );
  }

  let strength;
  if (hasCompeting && competingOffer > offerBase) strength = "strong";
  else if (hasCompeting || (pos.valid && pos.gapToHigh > 0)) strength = "moderate";
  else strength = "weak";

  const summary =
    strength === "strong"
      ? "Strong position: you have a real alternative that pays more. Name it plainly, without threatening."
      : strength === "moderate"
      ? "Moderate position: you have documented room or a fallback. Anchor to the data, not to a threat."
      : "Weak position: no alternative and no anchor. Ask anyway — a polite, specific, one-time ask almost never costs an offer. Most entry-level candidates never ask, and lose by default.";

  return { walkAwayBase, competingOffer, hasCompeting, strength, leverage, risks, summary };
}

/**
 * negotiationReadiness(state) -> what still has to be true before the call.
 * @param {object} state
 * @returns {{ready: boolean, checklist: Array<{key: string, label: string, done: boolean}>}}
 */
export function negotiationReadiness(state) {
  const slice = getSlice(state);
  const f = slice.fields;
  const pos = marketPosition(f);
  const checklist = [
    { key: "offer", label: "You have a written offer in hand", done: parseMoney(f.offerBase) > 0 },
    { key: "range", label: "A real market range, low and high", done: pos.valid },
    { key: "source", label: "A named source for that range", done: Boolean(String(f.marketSource || "").trim()) },
    { key: "ask", label: "A specific target number", done: parseMoney(f.targetAsk) > 0 || suggestTargetAsk(f) > 0 },
    { key: "batna", label: "You've decided what you do if they say no", done: batnaPrep(state).strength !== "weak" || Boolean(String(slice.batna.currentSituation || "").trim()) },
  ];
  return { ready: checklist.every((c) => c.done), checklist };
}
