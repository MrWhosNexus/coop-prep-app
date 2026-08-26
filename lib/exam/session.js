// lib/exam/session.js
// A sitting of an exam: timed, navigable, flaggable, resumable.
//
// Everything here is pure and JSON-serializable. Every mutator takes the
// current session plus `{ now }` and returns the next session -- the store
// can persist the returned object after any keystroke, and a crash at any
// moment costs at most the last action. A user 90 minutes into a 180-minute
// Series 65 mock loses nothing.
//
// THE CLOCK, and why a crash does not eat it
// ------------------------------------------
// Time is accrued, not read off a wall clock: `elapsedMs` is the time
// already banked, and `runningSince` is when the current running stretch
// began. Any action advances the clock from `runningSince` to `now` and
// re-banks it.
//
// If the app dies, no action runs, so no time is banked -- the clock stops
// where the last action left it. resumeSession() then measures the gap and
// records it as `integrity.downtimeMs` instead of charging it. This is
// deliberate: charging an 8-hour overnight crash against a 180-minute mock
// would destroy an attempt the learner did nothing wrong in. But the gap is
// never hidden either -- scoring.js reads `integrity` and says out loud that
// the attempt was interrupted, so a resumed mock is never quietly presented
// as a clean test-day simulation.

import { ExamError } from "./blueprint.js";

/** Bump when the persisted session shape changes incompatibly. */
export const SESSION_VERSION = 1;

/** Assessment kinds. CFI/FMVA is a skills credential and never becomes a multiple-choice session. */
export const EXAM_KINDS = { MULTIPLE_CHOICE: "multiple-choice", SKILLS: "skills" };

/**
 * The four ways a learner can sit a bank-backed exam.
 * `pausable: false` on the mock is the point of the mock -- test day has no
 * pause button, and a mock you can pause measures something else.
 * @type {Object<string, {id: string, label: string, description: string, pausable: boolean, timed: boolean, count?: number, fullLength?: boolean}>}
 */
export const MODES = {
  mock: {
    id: "mock",
    label: "Full timed mock",
    description: "Real length, real clock, no pausing — the closest thing to test day.",
    pausable: false,
    timed: true,
    fullLength: true,
  },
  section: {
    id: "section",
    label: "Section drill",
    description: "One blueprint section at a time, on a proportional clock. Pausable.",
    pausable: true,
    timed: true,
  },
  warmup: {
    id: "warmup",
    label: "Quick warmup",
    description: "Ten blueprint-weighted questions to knock the rust off.",
    pausable: true,
    timed: true,
    count: 10,
  },
  retry: {
    id: "retry",
    label: "Missed questions",
    description: "Only the questions you got wrong last time. Untimed — this one is for learning, not measuring.",
    pausable: true,
    timed: false,
  },
};

/** Session statuses. */
export const STATUS = {
  ACTIVE: "active",
  PAUSED: "paused",
  EXPIRED: "expired",
  SUBMITTED: "submitted",
};

/* ─── time helpers ─── */

function iso(now) {
  if (now === undefined || now === null) return new Date().toISOString();
  if (now instanceof Date) return now.toISOString();
  if (typeof now === "number") return new Date(now).toISOString();
  return new Date(String(now)).toISOString();
}

function ms(isoString) {
  return new Date(isoString).getTime();
}

/**
 * Bank the time that has passed since `runningSince` and expire the session
 * if the limit is gone. Pure. A no-op for a session that isn't running.
 */
function advance(session, now) {
  if (session.status !== STATUS.ACTIVE || !session.runningSince) return session;
  const at = iso(now);
  const delta = Math.max(0, ms(at) - ms(session.runningSince));
  let elapsedMs = session.elapsedMs + delta;
  let status = STATUS.ACTIVE;
  let runningSince = at;

  if (session.limitMs != null && elapsedMs >= session.limitMs) {
    elapsedMs = session.limitMs;
    status = STATUS.EXPIRED;
    runningSince = null;
  }
  return { ...session, elapsedMs, runningSince, status, lastActivityAt: at };
}

/**
 * Advance the clock without taking any other action. Call this on a timer
 * tick to surface an expiry the moment it happens.
 * @param {object} session
 * @param {{now?: Date|number|string}} [opts]
 * @returns {object} next session
 */
export function tick(session, opts = {}) {
  return advance(session, opts.now);
}

/**
 * Milliseconds left on the clock, or null for an untimed session. Never
 * negative. Does not mutate.
 * @param {object} session
 * @param {Date|number|string} [now]
 * @returns {number|null}
 */
export function remainingMs(session, now) {
  if (session.limitMs == null) return null;
  const s = advance(session, now);
  return Math.max(0, s.limitMs - s.elapsedMs);
}

/**
 * Milliseconds of the clock already used.
 * @param {object} session
 * @param {Date|number|string} [now]
 * @returns {number}
 */
export function elapsedMs(session, now) {
  return advance(session, now).elapsedMs;
}

/* ─── lifecycle ─── */

/**
 * Start a sitting.
 * @param {object} config
 * @param {import("./blueprint.js").ExamForm} config.form
 * @param {string} [config.mode] one of MODES
 * @param {number|null} [config.limitMs] null = untimed; defaults to the mode's timing
 * @param {number} [config.minutes] convenience alternative to limitMs
 * @param {string} [config.id]
 * @param {Date|number|string} [config.now]
 * @returns {object} session
 */
export function createSession(config = {}) {
  const { form } = config;
  if (!form || !Array.isArray(form.items)) throw new ExamError("createSession needs a form", "BAD_FORM");

  const mode = config.mode ?? "mock";
  const modeDef = MODES[mode];
  if (!modeDef) throw new ExamError(`unknown exam mode: ${mode}`, "UNKNOWN_MODE");

  let limitMs = null;
  if (config.limitMs !== undefined) limitMs = config.limitMs;
  else if (config.minutes != null) limitMs = Math.round(config.minutes * 60000);
  else if (modeDef.timed) limitMs = Math.round((form.blueprint?.minutes ?? 0) * 60000);
  if (limitMs != null && !(Number.isFinite(limitMs) && limitMs > 0)) limitMs = null;

  const startedAt = iso(config.now);
  return {
    version: SESSION_VERSION,
    kind: EXAM_KINDS.MULTIPLE_CHOICE,
    id: config.id ?? `${form.certId}-${mode}-${form.seed}-${ms(startedAt)}`,
    certId: form.certId,
    mode,
    seed: form.seed,
    form,
    answers: {},
    flags: {},
    cursor: 0,
    status: STATUS.ACTIVE,
    limitMs,
    elapsedMs: 0,
    runningSince: startedAt,
    startedAt,
    lastActivityAt: startedAt,
    submittedAt: null,
    timedOut: false,
    integrity: { resumes: 0, pauses: 0, downtimeMs: 0, answerChanges: 0 },
  };
}

/** True while the learner can still answer. */
export function isActive(session) {
  return session.status === STATUS.ACTIVE;
}

/** True once the clock has run out. */
export function isExpired(session, now) {
  if (session.status === STATUS.EXPIRED) return true;
  const r = remainingMs(session, now);
  return r !== null && r <= 0 && session.status === STATUS.ACTIVE;
}

/** True when this sitting can still be picked back up (after a crash, a reload, or a pause). */
export function isResumable(session) {
  return session.status === STATUS.ACTIVE || session.status === STATUS.PAUSED;
}

/** True when this mode allows a pause. A full mock does not. */
export function canPause(session) {
  return Boolean(MODES[session.mode]?.pausable);
}

function assertAnswerable(session, what) {
  if (session.status === STATUS.SUBMITTED) throw new ExamError(`cannot ${what}: this attempt was already submitted`, "SUBMITTED");
  if (session.status === STATUS.EXPIRED) throw new ExamError(`cannot ${what}: time has expired`, "EXPIRED");
  if (session.status === STATUS.PAUSED) throw new ExamError(`cannot ${what}: the attempt is paused`, "PAUSED");
}

function findIndex(session, itemId) {
  return session.form.items.findIndex((i) => i.id === itemId);
}

/* ─── answering ─── */

/**
 * Record (or change) an answer. Changing an answer is allowed and counted --
 * that count is review material, not a penalty.
 * @param {object} session
 * @param {string} itemId
 * @param {number} optionIndex
 * @param {{now?: Date|number|string}} [opts]
 * @returns {object} next session
 */
export function answerItem(session, itemId, optionIndex, opts = {}) {
  const s = advance(session, opts.now);
  assertAnswerable(s, "answer");
  const idx = findIndex(s, itemId);
  if (idx < 0) throw new ExamError(`no such item on this form: ${itemId}`, "UNKNOWN_ITEM");
  const item = s.form.items[idx];
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= item.options.length) {
    throw new ExamError(`option index out of range for ${itemId}: ${optionIndex}`, "BAD_OPTION");
  }
  const prev = s.answers[itemId];
  const changed = prev !== undefined && prev !== optionIndex;
  return {
    ...s,
    answers: { ...s.answers, [itemId]: optionIndex },
    integrity: { ...s.integrity, answerChanges: s.integrity.answerChanges + (changed ? 1 : 0) },
  };
}

/**
 * Un-answer an item (back to blank).
 * @param {object} session
 * @param {string} itemId
 * @param {{now?: Date|number|string}} [opts]
 * @returns {object} next session
 */
export function clearAnswer(session, itemId, opts = {}) {
  const s = advance(session, opts.now);
  assertAnswerable(s, "clear an answer");
  if (!(itemId in s.answers)) return s;
  const answers = { ...s.answers };
  delete answers[itemId];
  return { ...s, answers };
}

/**
 * Flag / unflag an item for review. Allowed while paused (it isn't answering).
 * @param {object} session
 * @param {string} itemId
 * @param {{now?: Date|number|string}} [opts]
 * @returns {object} next session
 */
export function toggleFlag(session, itemId, opts = {}) {
  const s = advance(session, opts.now);
  if (findIndex(s, itemId) < 0) throw new ExamError(`no such item on this form: ${itemId}`, "UNKNOWN_ITEM");
  const flags = { ...s.flags };
  if (flags[itemId]) delete flags[itemId];
  else flags[itemId] = true;
  return { ...s, flags };
}

/* ─── navigation ─── */

/**
 * Move the cursor. Clamped to the form -- navigating off the end is a UI
 * fact of life, not an error worth throwing over.
 * @param {object} session
 * @param {number} index
 * @param {{now?: Date|number|string}} [opts]
 * @returns {object} next session
 */
export function goTo(session, index, opts = {}) {
  const s = advance(session, opts.now);
  const max = Math.max(0, s.form.items.length - 1);
  const cursor = Math.min(max, Math.max(0, Math.round(Number(index) || 0)));
  return { ...s, cursor };
}

/** Next item (clamped). */
export function nextItem(session, opts = {}) {
  return goTo(session, session.cursor + 1, opts);
}

/** Previous item (clamped). */
export function prevItem(session, opts = {}) {
  return goTo(session, session.cursor - 1, opts);
}

/** Jump to an item by id. */
export function goToItem(session, itemId, opts = {}) {
  const idx = findIndex(session, itemId);
  if (idx < 0) throw new ExamError(`no such item on this form: ${itemId}`, "UNKNOWN_ITEM");
  return goTo(session, idx, opts);
}

/** The item under the cursor, or null on an empty form. */
export function currentItem(session) {
  return session.form.items[session.cursor] ?? null;
}

/* ─── pause / resume ─── */

/**
 * Pause the clock. Throws for a mode that forbids it (the full mock) --
 * offering a pause on a mock and then honouring it would make the mock lie
 * about what test day is like.
 * @param {object} session
 * @param {{now?: Date|number|string}} [opts]
 * @returns {object} next session
 */
export function pauseSession(session, opts = {}) {
  const s = advance(session, opts.now);
  assertAnswerable(s, "pause");
  if (!canPause(s)) {
    throw new ExamError(
      `a ${MODES[s.mode].label.toLowerCase()} cannot be paused — the real exam has no pause button. Submit, or let the clock run.`,
      "PAUSE_NOT_ALLOWED",
    );
  }
  return {
    ...s,
    status: STATUS.PAUSED,
    runningSince: null,
    integrity: { ...s.integrity, pauses: s.integrity.pauses + 1 },
  };
}

/**
 * Pick a sitting back up -- after an explicit pause, or after a crash /
 * app restart (deserializeSession then resumeSession).
 *
 * The gap since the last recorded activity is measured and banked into
 * `integrity.downtimeMs` rather than charged to the clock: a crash is not
 * the learner's mistake, but it IS a fact about the attempt, and scoring.js
 * says so in the caveats.
 *
 * @param {object} session
 * @param {{now?: Date|number|string, chargeDowntime?: boolean}} [opts]
 *        chargeDowntime: true makes wall-clock time during the gap count
 *        against the limit (a stricter self-imposed simulation).
 * @returns {object} next session
 */
export function resumeSession(session, opts = {}) {
  if (!isResumable(session)) {
    throw new ExamError(`cannot resume a ${session.status} attempt`, "NOT_RESUMABLE");
  }
  const at = iso(opts.now);
  const gapFrom = session.runningSince ?? session.lastActivityAt;
  const gap = Math.max(0, ms(at) - ms(gapFrom));

  const base = {
    ...session,
    status: STATUS.ACTIVE,
    runningSince: at,
    lastActivityAt: at,
    integrity: {
      ...session.integrity,
      resumes: session.integrity.resumes + 1,
      downtimeMs: session.integrity.downtimeMs + (opts.chargeDowntime ? 0 : gap),
    },
  };
  if (!opts.chargeDowntime) return base;

  // Strict mode: charge the gap, which may well have expired the attempt.
  return advance({ ...base, runningSince: gapFrom }, at);
}

/* ─── submit ─── */

/**
 * End the sitting. Works on an expired attempt too (that is exactly the
 * auto-submit path), and marks it `timedOut` so the review can say so.
 * @param {object} session
 * @param {{now?: Date|number|string}} [opts]
 * @returns {object} next session
 */
export function submitSession(session, opts = {}) {
  const s = advance(session, opts.now);
  if (s.status === STATUS.SUBMITTED) throw new ExamError("this attempt was already submitted", "SUBMITTED");
  const at = iso(opts.now);
  return {
    ...s,
    status: STATUS.SUBMITTED,
    runningSince: null,
    submittedAt: at,
    lastActivityAt: at,
    timedOut: s.status === STATUS.EXPIRED,
  };
}

/* ─── introspection ─── */

/** Ids of every item still blank. */
export function unansweredItemIds(session) {
  return session.form.items.filter((i) => session.answers[i.id] === undefined).map((i) => i.id);
}

/** Ids of every flagged item, in form order. */
export function flaggedItemIds(session) {
  return session.form.items.filter((i) => session.flags[i.id]).map((i) => i.id);
}

/**
 * Everything a "review before you submit" screen needs.
 * @param {object} session
 * @param {Date|number|string} [now]
 * @returns {{total: number, answered: number, unanswered: number, flagged: number, index: number, remainingMs: number|null, status: string}}
 */
export function sessionProgress(session, now) {
  const answered = Object.keys(session.answers).length;
  return {
    total: session.form.items.length,
    answered,
    unanswered: session.form.items.length - answered,
    flagged: Object.keys(session.flags).length,
    index: session.cursor,
    remainingMs: remainingMs(session, now),
    status: advance(session, now).status,
  };
}

/* ─── persistence ─── */

/**
 * Serialize for the store. The form (questions, options, answer key) travels
 * with the session, so a resumed attempt needs no bank lookup and cannot
 * drift if the bank is edited mid-attempt.
 * @param {object} session
 * @returns {string} JSON
 */
export function serializeSession(session) {
  return JSON.stringify(session);
}

/**
 * Restore a sitting. Accepts the JSON string or the already-parsed object
 * (the store hands back parsed JSON). Call resumeSession() afterwards to
 * restart the clock and record the interruption.
 * @param {string|object} input
 * @returns {object} session
 */
export function deserializeSession(input) {
  let doc;
  try {
    doc = typeof input === "string" ? JSON.parse(input) : input;
  } catch {
    throw new ExamError("saved attempt is not valid JSON", "BAD_SESSION");
  }
  if (!doc || typeof doc !== "object") throw new ExamError("saved attempt is empty", "BAD_SESSION");
  if (doc.version !== SESSION_VERSION) {
    throw new ExamError(`saved attempt is version ${doc.version}, this build reads version ${SESSION_VERSION}`, "BAD_VERSION");
  }
  if (!doc.form || !Array.isArray(doc.form.items) || !doc.form.blueprint) {
    throw new ExamError("saved attempt has no usable form", "BAD_SESSION");
  }
  if (!Object.values(STATUS).includes(doc.status)) {
    throw new ExamError(`saved attempt has an unknown status: ${doc.status}`, "BAD_SESSION");
  }
  return {
    ...doc,
    answers: { ...(doc.answers ?? {}) },
    flags: { ...(doc.flags ?? {}) },
    integrity: { resumes: 0, pauses: 0, downtimeMs: 0, answerChanges: 0, ...(doc.integrity ?? {}) },
  };
}
