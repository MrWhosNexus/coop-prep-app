// lib/tools/network.js
// Network Tracker — informational interviews and the follow-up cadence taught
// in lessons hustle-network-1/3: the 4-sentence ask, the 24-hour thank-you,
// and the 6-8 week genuine-update rhythm.
//
// The outreach template is static text and useful with no AI whatsoever.
//
// Pure ES-module reducers over the FULL progress state, immutable. No DOM, no
// network — importable under `node --test`.

// ---------------------------------------------------------------------------
// Enums + defaults
// ---------------------------------------------------------------------------

/** @type {readonly string[]} */
export const REPLY_STATUSES = Object.freeze([
  "notSent",
  "sent",
  "replied",
  "scheduled",
  "completed",
  "noReply",
]);

/** @type {Readonly<Record<string, string>>} */
export const REPLY_STATUS_LABELS = Object.freeze({
  notSent: "Not sent",
  sent: "Sent",
  replied: "Replied",
  scheduled: "Scheduled",
  completed: "Completed",
  noReply: "No reply",
});

/** @type {readonly string[]} */
export const CONTACT_SOURCES = Object.freeze(["alumni", "linkedin", "event", "referral", "coop", "other"]);

/** The lesson's 24-hour thank-you rule, in hours. */
export const THANK_YOU_HOURS = 24;

/**
 * The middle of the lesson's 6-8 week relationship-maintenance window, in days.
 * 7 weeks — the cadence a completed conversation gets by default.
 */
export const FOLLOW_UP_DAYS = 49;

/** A sent-but-silent outreach gets one nudge after this many days. */
export const NUDGE_DAYS = 7;

export const defaultNetworkTrackerState = {
  contacts: [],
  lastSaved: null,
};

// ---------------------------------------------------------------------------
// Date helpers — ISO yyyy-mm-dd parsed as UTC.
// ---------------------------------------------------------------------------

/**
 * todayISO(now?) -> "yyyy-mm-dd".
 * @param {Date|number} [now]
 * @returns {string}
 */
export function todayISO(now = new Date()) {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * addDaysISO(iso, days) -> shifted ISO date, or "" when unparseable.
 * @param {string} iso
 * @param {number} days
 * @returns {string}
 */
export function addDaysISO(iso, days) {
  const ms = Date.parse(`${String(iso || "").slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(ms)) return "";
  return new Date(ms + days * 86400000).toISOString().slice(0, 10);
}

/**
 * daysBetweenISO(a, b) -> whole days from a to b, or null if unparseable.
 * @param {string} a
 * @param {string} b
 * @returns {number|null}
 */
export function daysBetweenISO(a, b) {
  const x = Date.parse(`${String(a || "").slice(0, 10)}T00:00:00Z`);
  const y = Date.parse(`${String(b || "").slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  return Math.round((y - x) / 86400000);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getSlice(state) {
  return state && state.tools && state.tools.networkTracker
    ? state.tools.networkTracker
    : defaultNetworkTrackerState;
}

function withSlice(state, slice) {
  return {
    ...state,
    tools: {
      ...(state && state.tools),
      networkTracker: { ...slice, lastSaved: Date.now() },
    },
  };
}

let idCounter = 0;
function makeId() {
  idCounter += 1;
  return `net-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

// ---------------------------------------------------------------------------
// Cadence
// ---------------------------------------------------------------------------

/**
 * computeNextFollowUpDate(replyStatus, referenceDate) -> ISO date or "".
 *
 * The rule from the lessons, made mechanical:
 *   completed  -> reference + 49 days (the middle of the 6-8 week window)
 *   sent       -> reference + 7 days (one nudge, then let it go)
 *   replied    -> next day (momentum: send times within the hour, act now)
 *   scheduled  -> the conversation itself is the next action
 *   notSent    -> send it
 *   noReply    -> "" (closed; re-approach needs a real update, not a cadence)
 *
 * @param {string} replyStatus
 * @param {string} referenceDate ISO date the status was reached
 * @returns {string}
 */
export function computeNextFollowUpDate(replyStatus, referenceDate) {
  const ref = String(referenceDate || "").slice(0, 10);
  if (!ref) return "";
  switch (replyStatus) {
    case "completed":
      return addDaysISO(ref, FOLLOW_UP_DAYS);
    case "sent":
      return addDaysISO(ref, NUDGE_DAYS);
    case "replied":
      return addDaysISO(ref, 1);
    case "scheduled":
      return ref;
    case "notSent":
      return ref;
    case "noReply":
    default:
      return "";
  }
}

/**
 * nextActionFor(replyStatus) -> the concrete next step for that status.
 * @param {string} replyStatus
 * @returns {string}
 */
export function nextActionFor(replyStatus) {
  switch (replyStatus) {
    case "notSent":
      return "Send the 4-sentence ask";
    case "sent":
      return "One nudge if still silent, then let it rest";
    case "replied":
      return "Send 2-3 concrete time options today";
    case "scheduled":
      return "Prep 4-5 specific questions — not 'any advice?'";
    case "completed":
      return "Genuine update (6-8 week cadence)";
    case "noReply":
      return "";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/**
 * createContact(patch) -> a normalized contact.
 * nextFollowUpDate is computed from the cadence unless explicitly supplied.
 *
 * @param {object} [patch]
 * @returns {{id: string, name: string, firm: string, role: string, source: string, outreachDate: string, replyStatus: string, lastContactDate: string, nextFollowUpDate: string, thankYouSent: boolean, notes: string}}
 */
export function createContact(patch = {}) {
  const replyStatus = REPLY_STATUSES.includes(patch.replyStatus) ? patch.replyStatus : "notSent";
  const outreachDate = String(patch.outreachDate || todayISO());
  const lastContactDate = String(patch.lastContactDate || (replyStatus === "notSent" ? "" : outreachDate));
  const reference = lastContactDate || outreachDate;
  return {
    id: patch.id || makeId(),
    name: String(patch.name || ""),
    firm: String(patch.firm || ""),
    role: String(patch.role || ""),
    source: CONTACT_SOURCES.includes(patch.source) ? patch.source : "other",
    outreachDate,
    replyStatus,
    lastContactDate,
    nextFollowUpDate:
      patch.nextFollowUpDate != null
        ? String(patch.nextFollowUpDate)
        : computeNextFollowUpDate(replyStatus, reference),
    thankYouSent: Boolean(patch.thankYouSent),
    notes: String(patch.notes || ""),
  };
}

// ---------------------------------------------------------------------------
// Reducers
// ---------------------------------------------------------------------------

/**
 * addContact(state, contact) -> newState.
 * @param {object} state
 * @param {object} contact
 * @returns {object}
 */
export function addContact(state, contact) {
  const slice = getSlice(state);
  return withSlice(state, { ...slice, contacts: [...slice.contacts, createContact(contact)] });
}

/**
 * updateContact(state, contactId, patch) -> newState. `id` is fixed.
 * @param {object} state
 * @param {string} contactId
 * @param {object} patch
 * @returns {object}
 */
export function updateContact(state, contactId, patch) {
  const slice = getSlice(state);
  return withSlice(state, {
    ...slice,
    contacts: slice.contacts.map((c) => (c.id === contactId ? { ...c, ...patch, id: c.id } : c)),
  });
}

/**
 * removeContact(state, contactId) -> newState.
 * @param {object} state
 * @param {string} contactId
 * @returns {object}
 */
export function removeContact(state, contactId) {
  const slice = getSlice(state);
  return withSlice(state, { ...slice, contacts: slice.contacts.filter((c) => c.id !== contactId) });
}

/**
 * setContactStatus(state, contactId, replyStatus, date?) -> newState.
 *
 * Reaching `completed` recomputes nextFollowUpDate to lastContactDate + 49
 * days automatically — the whole point of the cadence rule is that the user
 * does not have to remember it.
 *
 * @param {object} state
 * @param {string} contactId
 * @param {string} replyStatus
 * @param {string} [date] ISO date of the change; defaults to today
 * @returns {object}
 */
export function setContactStatus(state, contactId, replyStatus, date) {
  if (!REPLY_STATUSES.includes(replyStatus)) return state;
  const slice = getSlice(state);
  const when = date || todayISO();
  return withSlice(state, {
    ...slice,
    contacts: slice.contacts.map((c) => {
      if (c.id !== contactId) return c;
      const lastContactDate = replyStatus === "notSent" ? c.lastContactDate : when;
      return {
        ...c,
        replyStatus,
        lastContactDate,
        nextFollowUpDate: computeNextFollowUpDate(replyStatus, lastContactDate || c.outreachDate),
      };
    }),
  });
}

/**
 * markContactFollowedUp(state, contactId, date?) -> newState.
 * Logs a touch today and schedules the next one 7 weeks out.
 *
 * @param {object} state
 * @param {string} contactId
 * @param {string} [date] ISO date
 * @returns {object}
 */
export function markContactFollowedUp(state, contactId, date) {
  const slice = getSlice(state);
  const when = date || todayISO();
  return withSlice(state, {
    ...slice,
    contacts: slice.contacts.map((c) =>
      c.id === contactId
        ? {
            ...c,
            lastContactDate: when,
            replyStatus: c.replyStatus === "notSent" ? "sent" : c.replyStatus,
            nextFollowUpDate: computeNextFollowUpDate(
              c.replyStatus === "notSent" ? "sent" : c.replyStatus,
              when
            ),
          }
        : c
    ),
  });
}

/**
 * markThankYouSent(state, contactId) -> newState. Clears the 24-hour debt.
 * @param {object} state
 * @param {string} contactId
 * @returns {object}
 */
export function markThankYouSent(state, contactId) {
  const slice = getSlice(state);
  return withSlice(state, {
    ...slice,
    contacts: slice.contacts.map((c) => (c.id === contactId ? { ...c, thankYouSent: true } : c)),
  });
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

/**
 * listContacts(state) -> the contacts array (never undefined).
 * @param {object} state
 * @returns {object[]}
 */
export function listContacts(state) {
  return getSlice(state).contacts;
}

/**
 * sortByFollowUp(contacts) -> ascending by nextFollowUpDate, undated last.
 * @param {object[]} contacts
 * @returns {object[]} a new array
 */
export function sortByFollowUp(contacts) {
  return [...(contacts || [])].sort((a, b) => {
    const x = String(a.nextFollowUpDate || "");
    const y = String(b.nextFollowUpDate || "");
    if (!x && !y) return String(a.name).localeCompare(String(b.name));
    if (!x) return 1;
    if (!y) return -1;
    return x.localeCompare(y) || String(a.name).localeCompare(String(b.name));
  });
}

/**
 * dueContacts(contacts, today?) -> follow-ups that are due or overdue.
 * @param {object[]} contacts
 * @param {string} [today] ISO date
 * @returns {Array<object & {overdueDays: number}>}
 */
export function dueContacts(contacts, today = todayISO()) {
  return sortByFollowUp(contacts)
    .filter((c) => c.nextFollowUpDate && c.nextFollowUpDate <= today)
    .map((c) => ({ ...c, overdueDays: daysBetweenISO(c.nextFollowUpDate, today) ?? 0 }));
}

/**
 * thankYousOwed(contacts, today?) -> completed conversations with no thank-you
 * logged. The 24-hour rule expressed as a debt the tool tracks for you.
 *
 * @param {object[]} contacts
 * @param {string} [today] ISO date
 * @returns {Array<object & {hoursElapsed: number, overdue: boolean}>}
 */
export function thankYousOwed(contacts, today = todayISO()) {
  return (contacts || [])
    .filter((c) => c.replyStatus === "completed" && !c.thankYouSent && c.lastContactDate)
    .map((c) => {
      const days = daysBetweenISO(c.lastContactDate, today) ?? 0;
      return { ...c, hoursElapsed: days * 24, overdue: days * 24 > THANK_YOU_HOURS };
    })
    .sort((a, b) => b.hoursElapsed - a.hoursElapsed);
}

/**
 * networkStats(contacts) -> the shape of the network, plus the reply rate.
 * @param {object[]} contacts
 * @returns {{total: number, byStatus: Record<string, number>, sent: number, replied: number, conversations: number, replyRate: number, firms: number}}
 */
export function networkStats(contacts) {
  const list = Array.isArray(contacts) ? contacts : [];
  const byStatus = {};
  for (const s of REPLY_STATUSES) byStatus[s] = 0;
  for (const c of list) if (byStatus[c.replyStatus] != null) byStatus[c.replyStatus] += 1;

  const sent = list.filter((c) => c.replyStatus !== "notSent").length;
  const replied = list.filter((c) => ["replied", "scheduled", "completed"].includes(c.replyStatus)).length;
  const conversations = byStatus.completed;
  const firms = new Set(list.map((c) => String(c.firm || "").toLowerCase()).filter(Boolean)).size;

  return {
    total: list.length,
    byStatus,
    sent,
    replied,
    conversations,
    replyRate: sent > 0 ? replied / sent : 0,
    firms,
  };
}

/**
 * diagnoseNetwork(contacts, today?) -> plain-language findings, worst first.
 * @param {object[]} contacts
 * @param {string} [today] ISO date
 * @returns {Array<{code: string, severity: "critical"|"warn"|"info"|"good", message: string}>}
 */
export function diagnoseNetwork(contacts, today = todayISO()) {
  const list = Array.isArray(contacts) ? contacts : [];
  const stats = networkStats(list);
  const out = [];

  if (stats.total === 0) {
    return [{ code: "empty", severity: "info", message: "No contacts yet. One informational interview a week compounds faster than any application volume." }];
  }

  const owed = thankYousOwed(list, today).filter((c) => c.overdue);
  if (owed.length > 0) {
    out.push({
      code: "thankYouOverdue",
      severity: "critical",
      message: `${owed.length} thank-you ${owed.length === 1 ? "note is" : "notes are"} past the 24-hour window. Send it anyway — reference one real detail from the conversation.`,
    });
  }

  const due = dueContacts(list, today);
  if (due.length > 0) {
    out.push({
      code: "followUpDue",
      severity: "warn",
      message: `${due.length} ${due.length === 1 ? "contact is" : "contacts are"} due for a touch. Lead with what you did with their advice, then ask.`,
    });
  }

  if (stats.sent >= 6 && stats.replyRate === 0) {
    out.push({
      code: "noReplies",
      severity: "critical",
      message: `${stats.sent} messages sent, 0 replies — the message is the problem, not the market. Narrow the ask to their specific path and day-to-day; drop any hint of a job ask.`,
    });
  }

  const notSent = stats.byStatus.notSent;
  if (notSent >= 3) {
    out.push({
      code: "drafted",
      severity: "warn",
      message: `${notSent} contacts logged but never messaged. A list of names is not a network.`,
    });
  }

  if (out.length === 0) {
    out.push({
      code: "healthy",
      severity: "good",
      message: `${stats.conversations} ${stats.conversations === 1 ? "conversation" : "conversations"} across ${stats.firms} ${stats.firms === 1 ? "firm" : "firms"}, ${Math.round(stats.replyRate * 100)}% reply rate. Keep the 6-8 week cadence warm.`,
    });
  }

  const rank = { critical: 0, warn: 1, info: 2, good: 3 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

// ---------------------------------------------------------------------------
// Static templates — lesson hustle-network-1. Useful with zero AI.
// ---------------------------------------------------------------------------

/**
 * outreachTemplate(contact, opts) -> the 4-sentence informational-interview ask.
 *
 * Sentence 1: credible intro. 2: a narrow ask about THEIR path, never "advice"
 * and never a job. 3: low-friction logistics. 4: genuine thanks regardless.
 *
 * @param {object} contact
 * @param {{yourName?: string, yourContext?: string, hook?: string}} [opts]
 * @returns {string}
 */
export function outreachTemplate(contact, opts = {}) {
  const c = contact || {};
  const them = String(c.name || "").trim().split(/\s+/)[0] || "there";
  const firm = String(c.firm || "").trim() || "your firm";
  const role = String(c.role || "").trim() || "your role";
  const you = String(opts.yourName || "").trim() || "[Your Name]";
  const context =
    String(opts.yourContext || "").trim() ||
    "a COOP Careers Financial Services Track fellow building toward an analyst role";
  const hook = String(opts.hook || "").trim() || `your path into ${role} at ${firm}`;

  return [
    `Hi ${them},`,
    "",
    `I'm ${you}, ${context}, and I came across your profile while researching ${firm}.`,
    `I'd love to hear about ${hook} — specifically how you got there and what your day-to-day actually looks like.`,
    `Would you have 15 minutes in the next couple of weeks? I'm flexible and happy to work around your schedule.`,
    `Either way, thank you for the work you're doing — I've learned a lot just reading about it.`,
    "",
    `Best,`,
    you,
  ].join("\n");
}

/**
 * thankYouTemplate(contact, detail, opts) -> the 24-hour thank-you.
 * `detail` is the one real thing from the conversation — without it, the note
 * is generic and the template says so rather than inventing something.
 *
 * @param {object} contact
 * @param {string} detail
 * @param {{yourName?: string}} [opts]
 * @returns {string}
 */
export function thankYouTemplate(contact, detail, opts = {}) {
  const c = contact || {};
  const them = String(c.name || "").trim().split(/\s+/)[0] || "there";
  const you = String(opts.yourName || "").trim() || "[Your Name]";
  const real = String(detail || "").trim() || "[one specific thing they actually said — not a generic compliment]";

  return [
    `Hi ${them},`,
    "",
    `Thank you for the time today — I know 15 minutes is real time out of your week.`,
    `What stuck with me most: ${real}. I'm acting on it this week.`,
    `I'll keep you posted on how it goes, and I hope our paths cross again.`,
    "",
    `Best,`,
    you,
  ].join("\n");
}

/**
 * updateTemplate(contact, update, opts) -> the 6-8 week genuine update.
 * Implements update-then-ask sequencing: what you did with their advice comes
 * BEFORE any new ask.
 *
 * @param {object} contact
 * @param {{didWithAdvice?: string, ask?: string}} update
 * @param {{yourName?: string}} [opts]
 * @returns {string}
 */
export function updateTemplate(contact, update = {}, opts = {}) {
  const c = contact || {};
  const them = String(c.name || "").trim().split(/\s+/)[0] || "there";
  const you = String(opts.yourName || "").trim() || "[Your Name]";
  const did =
    String(update.didWithAdvice || "").trim() ||
    "[what you actually did with their advice — a concrete result, not 'still looking']";
  const ask = String(update.ask || "").trim();

  const lines = [
    `Hi ${them},`,
    "",
    `It's been a few weeks — I wanted to send a quick update rather than only reaching out when I need something.`,
    `After our conversation, ${did}.`,
  ];
  if (ask) lines.push(`One small thing, if you have the bandwidth: ${ask}. No pressure either way.`);
  lines.push(`Thanks again for pointing me in the right direction.`, "", `Best,`, you);
  return lines.join("\n");
}
