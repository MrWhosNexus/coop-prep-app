// lib/tools/applications.js
// Application Tracker — pipeline discipline (lesson hustle-network-2).
//
// The lesson's point: this is a to-do list, not a log. It is sorted by next
// action date, it tells you what is due, and its funnel stats are supposed to
// say something TRUE about where you are losing — "12 applications, 0 first
// rounds" is a resume problem, not an interviewing problem.
//
// Pure ES-module reducers over the FULL progress state, immutable. No DOM, no
// network, no AI — importable under `node --test`.

// ---------------------------------------------------------------------------
// Enums + defaults
// ---------------------------------------------------------------------------

/** @type {readonly string[]} */
export const APPLICATION_STATUSES = Object.freeze([
  "applied",
  "screen",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
]);

/** @type {readonly string[]} */
export const APPLICATION_SOURCES = Object.freeze(["referral", "cold", "recruiter", "other"]);

/** Human labels. @type {Readonly<Record<string, string>>} */
export const STATUS_LABELS = Object.freeze({
  applied: "Applied",
  screen: "Screen",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
});

/** Statuses that are still live in the pipeline. @type {readonly string[]} */
export const ACTIVE_STATUSES = Object.freeze(["applied", "screen", "interview", "offer"]);

/** The lesson's 7 columns, in order. @type {readonly string[]} */
export const TRACKER_COLUMNS = Object.freeze([
  "company",
  "role",
  "dateApplied",
  "source",
  "status",
  "nextAction",
  "nextActionDate",
]);

/** Default follow-up cadence per status, in days from the status change. */
export const STATUS_CADENCE_DAYS = Object.freeze({
  applied: 7,
  screen: 3,
  interview: 1,
  offer: 2,
  rejected: 0,
  withdrawn: 0,
});

/** The default next action per status — so the tracker stays a to-do list. */
export const STATUS_NEXT_ACTION = Object.freeze({
  applied: "Follow up / find a referral into the team",
  screen: "Prep answers and confirm logistics",
  interview: "Send the 24-hour thank-you",
  offer: "Prep the negotiation script before responding",
  rejected: "",
  withdrawn: "",
});

export const defaultApplicationTrackerState = {
  applications: [],
  lastSaved: null,
};

// ---------------------------------------------------------------------------
// Date helpers — ISO yyyy-mm-dd, parsed as UTC so a timezone never shifts a day.
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
 * addDaysISO(iso, days) -> "yyyy-mm-dd" shifted by `days`. "" for bad input.
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
 * daysBetweenISO(a, b) -> whole days from a to b (negative if b is earlier).
 * @param {string} a
 * @param {string} b
 * @returns {number|null} null when either date is unparseable
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
  return state && state.tools && state.tools.applicationTracker
    ? state.tools.applicationTracker
    : defaultApplicationTrackerState;
}

function withSlice(state, slice) {
  return {
    ...state,
    tools: {
      ...(state && state.tools),
      applicationTracker: { ...slice, lastSaved: Date.now() },
    },
  };
}

let idCounter = 0;
function makeId() {
  idCounter += 1;
  return `app-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/**
 * createApplication(patch) -> a normalized application row.
 * Unknown status/source values fall back to the enum defaults rather than
 * poisoning the funnel stats.
 *
 * @param {object} [patch]
 * @returns {{id: string, company: string, role: string, dateApplied: string, source: string, status: string, nextAction: string, nextActionDate: string, notes: string, history: Array<{status: string, date: string}>}}
 */
export function createApplication(patch = {}) {
  const status = APPLICATION_STATUSES.includes(patch.status) ? patch.status : "applied";
  const dateApplied = String(patch.dateApplied || todayISO());
  return {
    id: patch.id || makeId(),
    company: String(patch.company || ""),
    role: String(patch.role || ""),
    dateApplied,
    source: APPLICATION_SOURCES.includes(patch.source) ? patch.source : "other",
    status,
    nextAction: patch.nextAction != null ? String(patch.nextAction) : STATUS_NEXT_ACTION[status],
    nextActionDate:
      patch.nextActionDate != null
        ? String(patch.nextActionDate)
        : addDaysISO(dateApplied, STATUS_CADENCE_DAYS[status]),
    notes: String(patch.notes || ""),
    history: Array.isArray(patch.history) ? [...patch.history] : [{ status, date: dateApplied }],
  };
}

// ---------------------------------------------------------------------------
// Reducers
// ---------------------------------------------------------------------------

/**
 * addApplication(state, application) -> newState.
 * @param {object} state
 * @param {object} application
 * @returns {object}
 */
export function addApplication(state, application) {
  const slice = getSlice(state);
  return withSlice(state, { ...slice, applications: [...slice.applications, createApplication(application)] });
}

/**
 * updateApplication(state, applicationId, patch) -> newState. `id` is fixed.
 * @param {object} state
 * @param {string} applicationId
 * @param {object} patch
 * @returns {object}
 */
export function updateApplication(state, applicationId, patch) {
  const slice = getSlice(state);
  return withSlice(state, {
    ...slice,
    applications: slice.applications.map((a) => (a.id === applicationId ? { ...a, ...patch, id: a.id } : a)),
  });
}

/**
 * removeApplication(state, applicationId) -> newState.
 * @param {object} state
 * @param {string} applicationId
 * @returns {object}
 */
export function removeApplication(state, applicationId) {
  const slice = getSlice(state);
  return withSlice(state, { ...slice, applications: slice.applications.filter((a) => a.id !== applicationId) });
}

/**
 * setApplicationStatus(state, applicationId, status, date?) -> newState.
 *
 * Advancing a stage rewrites nextAction/nextActionDate from the cadence table
 * and appends to `history`, so the row never silently becomes a dead log line.
 * An unknown status is a no-op.
 *
 * @param {object} state
 * @param {string} applicationId
 * @param {string} status
 * @param {string} [date] ISO date of the change; defaults to today
 * @returns {object}
 */
export function setApplicationStatus(state, applicationId, status, date) {
  if (!APPLICATION_STATUSES.includes(status)) return state;
  const slice = getSlice(state);
  const when = date || todayISO();
  return withSlice(state, {
    ...slice,
    applications: slice.applications.map((a) => {
      if (a.id !== applicationId) return a;
      const closed = status === "rejected" || status === "withdrawn";
      return {
        ...a,
        status,
        nextAction: STATUS_NEXT_ACTION[status],
        nextActionDate: closed ? "" : addDaysISO(when, STATUS_CADENCE_DAYS[status]),
        history: [...(a.history || []), { status, date: when }],
      };
    }),
  });
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

/**
 * listApplications(state) -> the applications array (never undefined).
 * @param {object} state
 * @returns {object[]}
 */
export function listApplications(state) {
  return getSlice(state).applications;
}

/**
 * sortByNextAction(applications) -> ascending by nextActionDate.
 * The lesson's explicit weekly-sort instruction. Rows with no next action date
 * (closed, or never scheduled) sink to the bottom rather than sorting as epoch.
 *
 * @param {object[]} applications
 * @returns {object[]} a new array
 */
export function sortByNextAction(applications) {
  return [...(applications || [])].sort((a, b) => {
    const x = String(a.nextActionDate || "");
    const y = String(b.nextActionDate || "");
    if (!x && !y) return String(a.company).localeCompare(String(b.company));
    if (!x) return 1;
    if (!y) return -1;
    return x.localeCompare(y) || String(a.company).localeCompare(String(b.company));
  });
}

/**
 * dueApplications(applications, today?) -> rows whose next action is due or
 * overdue. This is the weekly to-do list.
 *
 * @param {object[]} applications
 * @param {string} [today] ISO date
 * @returns {Array<object & {overdueDays: number}>}
 */
export function dueApplications(applications, today = todayISO()) {
  return sortByNextAction(applications)
    .filter((a) => a.nextActionDate && a.nextActionDate <= today && ACTIVE_STATUSES.includes(a.status))
    .map((a) => ({ ...a, overdueDays: daysBetweenISO(a.nextActionDate, today) ?? 0 }));
}

/**
 * funnelStats(applications) -> stage counts and the conversion rates between
 * them. `reached` counts every application that ever hit a stage (via history),
 * not just those sitting there now — otherwise a rejection after an interview
 * would erase the fact that the interview happened.
 *
 * @param {object[]} applications
 * @returns {{total: number, byStatus: Record<string, number>, reached: {applied: number, screen: number, interview: number, offer: number}, rates: {screenRate: number, interviewRate: number, offerRate: number}, active: number, closed: number, bySource: Record<string, number>}}
 */
export function funnelStats(applications) {
  const list = Array.isArray(applications) ? applications : [];
  const byStatus = {};
  for (const s of APPLICATION_STATUSES) byStatus[s] = 0;
  const bySource = {};
  for (const s of APPLICATION_SOURCES) bySource[s] = 0;

  const reached = { applied: 0, screen: 0, interview: 0, offer: 0 };

  for (const a of list) {
    if (byStatus[a.status] != null) byStatus[a.status] += 1;
    if (bySource[a.source] != null) bySource[a.source] += 1;

    const seen = new Set([a.status, ...(a.history || []).map((h) => h && h.status)]);
    reached.applied += 1;
    if (seen.has("screen") || seen.has("interview") || seen.has("offer")) reached.screen += 1;
    if (seen.has("interview") || seen.has("offer")) reached.interview += 1;
    if (seen.has("offer")) reached.offer += 1;
  }

  const rate = (num, den) => (den > 0 ? num / den : 0);
  return {
    total: list.length,
    byStatus,
    bySource,
    reached,
    rates: {
      screenRate: rate(reached.screen, reached.applied),
      interviewRate: rate(reached.interview, reached.applied),
      offerRate: rate(reached.offer, reached.applied),
    },
    active: list.filter((a) => ACTIVE_STATUSES.includes(a.status)).length,
    closed: list.filter((a) => !ACTIVE_STATUSES.includes(a.status)).length,
  };
}

/** Below this many applications, a zero conversion rate is noise, not signal. */
const SIGNAL_THRESHOLD = 8;

/**
 * diagnosePipeline(applications, today?) -> plain-language findings, most
 * severe first. This is the whole point of the tracker: naming WHERE the
 * pipeline leaks rather than showing the user a number they must interpret.
 *
 * @param {object[]} applications
 * @param {string} [today] ISO date
 * @returns {Array<{code: string, severity: "critical"|"warn"|"info"|"good", message: string}>}
 */
export function diagnosePipeline(applications, today = todayISO()) {
  const list = Array.isArray(applications) ? applications : [];
  const stats = funnelStats(list);
  const out = [];

  if (stats.total === 0) {
    return [{ code: "empty", severity: "info", message: "No applications logged yet. The tracker only works if every application goes in it." }];
  }

  // The headline diagnosis: volume with no conversion at a specific stage.
  if (stats.total >= SIGNAL_THRESHOLD && stats.reached.screen === 0) {
    out.push({
      code: "resumeBottleneck",
      severity: "critical",
      message: `${stats.total} applications, 0 first-round screens — the resume is the bottleneck, not your interviewing. Fix the bullets and the keyword match before sending more.`,
    });
  } else if (stats.reached.screen >= 4 && stats.reached.interview === 0) {
    out.push({
      code: "screenBottleneck",
      severity: "critical",
      message: `${stats.reached.screen} screens, 0 full interviews — the resume is working. The problem is the phone screen: your story is not landing in the first 10 minutes.`,
    });
  } else if (stats.reached.interview >= 3 && stats.reached.offer === 0) {
    out.push({
      code: "interviewBottleneck",
      severity: "critical",
      message: `${stats.reached.interview} interviews, 0 offers — you are getting in the room and losing it there. Run mock interviews against your STAR bank.`,
    });
  }

  if (stats.total < SIGNAL_THRESHOLD) {
    out.push({
      code: "lowVolume",
      severity: "info",
      message: `${stats.total} applications is too few to read anything into your rates. Sustained, filtered volume beats one frantic burst — keep going.`,
    });
  }

  const overdue = dueApplications(list, today);
  if (overdue.length > 0) {
    out.push({
      code: "overdue",
      severity: "warn",
      message: `${overdue.length} ${overdue.length === 1 ? "row is" : "rows are"} past their next action date. Sort by next action date weekly — that is what makes this a to-do list and not a log.`,
    });
  }

  const noNext = list.filter((a) => ACTIVE_STATUSES.includes(a.status) && !a.nextActionDate);
  if (noNext.length > 0) {
    out.push({
      code: "noNextAction",
      severity: "warn",
      message: `${noNext.length} active ${noNext.length === 1 ? "application has" : "applications have"} no next action date. An application with no next step is a wish.`,
    });
  }

  const referrals = stats.bySource.referral || 0;
  if (stats.total >= SIGNAL_THRESHOLD && referrals === 0) {
    out.push({
      code: "noReferrals",
      severity: "warn",
      message: "Every application so far is cold. Referrals convert at a multiple of cold applies — work the Network Tracker alongside this one.",
    });
  }

  if (out.length === 0 || out.every((x) => x.severity === "info")) {
    out.push({
      code: "healthy",
      severity: "good",
      message: `${stats.total} applications, ${stats.reached.screen} screens, ${stats.reached.interview} interviews. The pipeline is converting — keep the weekly cadence.`,
    });
  }

  const rank = { critical: 0, warn: 1, info: 2, good: 3 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/**
 * exportApplicationsCsv(applications) -> the lesson's 7 columns as CSV.
 * @param {object[]} applications
 * @returns {string}
 */
export function exportApplicationsCsv(applications) {
  const esc = (v) => {
    const s = String(v == null ? "" : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["Company", "Role", "Date applied", "Source", "Status", "Next action", "Next action date"];
  const rows = sortByNextAction(applications).map((a) => TRACKER_COLUMNS.map((c) => esc(a[c])).join(","));
  return [header.join(","), ...rows].join("\n");
}
