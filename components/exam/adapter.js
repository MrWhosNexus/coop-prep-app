/**
 * The single seam between the exam UI and lib/exam/.
 *
 * Nothing else under components/exam/ may import lib/exam/ directly. If the real
 * lib/exam API changes, THIS FILE is the only one that changes.
 *
 * The file has two halves with different stability contracts:
 *
 *   1. SEAM — adapts lib/exam's session-centric API into the shapes the
 *             components consume. Expect the integration agent to edit this half.
 *   2. PURE — UI-side helpers lib/exam has no opinion on (clock formatting, the
 *             live-region milestone logic, the navigator model, review filters).
 *             Covered by test/exam-ui.test.js.
 *
 * This module is deliberately free of React and JSX: `node --test` cannot parse
 * JSX, so the tested logic has to live somewhere it can be imported directly.
 * This mirrors components/guide/adapter.js, which solved the same problem.
 *
 * ── What lib/exam already owns, and this file therefore does NOT ─────────────
 *
 * lib/exam is the foundation, not a detail to be worked around. It already owns,
 * and does better than a UI layer could:
 *
 *   · form assembly + blueprint weighting  (blueprint.js drawForm/allocate)
 *   · shortfall reporting                  (form.shortfalls / warnings / faithful)
 *   · the clock                            (session.js remainingMs/advance/tick)
 *   · scoring, pass marks, caveats         (scoring.js scoreSession)
 *   · the per-option review                (review.js buildReview)
 *
 * So this adapter assembles no forms, computes no scores, and keeps no clock of
 * its own. It translates, and it stays out of the way.
 *
 * ── The two shape facts that bite ───────────────────────────────────────────
 *
 * 1. An answer is an OPTION INDEX (a number), not an option id. Index 0 is a
 *    valid answer AND is falsy, so every "is this answered?" test in this file
 *    is `=== undefined`, never a truthiness check. A truthy test silently reads
 *    "the learner picked the first option" as "the learner skipped it".
 * 2. lib/exam is session-centric: one immutable session carries the form, the
 *    answers, the flags, the cursor and the clock. There is no separate
 *    form+attempt pair.
 */

// Relative, with extensions, NOT the "@/..." alias: this module is imported by
// test/exam-ui.test.js under `node --test`, which resolves neither jsconfig
// paths nor extensionless specifiers. Next resolves these fine.
import * as banks from "../../lib/exam/banks.js";
import * as session from "../../lib/exam/session.js";
import * as scoring from "../../lib/exam/scoring.js";
import * as reviewLib from "../../lib/exam/review.js";

/* ══════════════════════════════════════════════════════════════════════════
   1. SEAM — lib/exam/ adaptation
   ══════════════════════════════════════════════════════════════════════════ */

/** The real engine, as one object. Injectable so tests can drive a stub. */
const REAL = { ...banks, ...session, ...scoring, ...reviewLib };

/**
 * The default facade over the real engine. Components use this; `attachExam` is
 * for tests and for the integrator, should the engine ever move.
 */
export const exam = attachExam();

/**
 * Remaining time WITHOUT reading the clock — pure, from the session's banked
 * elapsed time alone.
 *
 * ExamTimer paints this on its first frame. Calling Date.now() during render is
 * impure (React can re-render at any moment, and the lint rule that catches this
 * is right), so the first paint uses the last banked figure and the 250ms tick
 * corrects it a quarter-second later. For a paused or freshly-restored session
 * this is already the exact answer.
 *
 * @param {Object} sess
 * @returns {number|null} null when untimed
 */
export function bankedRemaining(sess) {
  if (!sess || sess.limitMs === null || sess.limitMs === undefined) return null;
  return Math.max(0, sess.limitMs - (sess.elapsedMs ?? 0));
}

/** Re-exported so components never import lib/exam for a constant. */
export const MODES = session.MODES;
export const STATUS = session.STATUS;
export const EXAM_KINDS = session.EXAM_KINDS;

/**
 * Wrap lib/exam into the facade the UI consumes.
 *
 * Defaults to the real modules — lib/exam has landed, so there is no reason to
 * make the app inject it. The parameter exists for tests and for the integrator,
 * should the engine ever move.
 *
 * Every call that can throw an ExamError is funnelled through `attempt()` below,
 * which converts a throw into a value. The engine throws deliberately and with
 * good messages (a mock cannot be paused; the bank is empty; the saved attempt is
 * the wrong version) and those messages are written to be READ BY A LEARNER — so
 * they are surfaced, not swallowed.
 *
 * @param {Object} [engine] override for tests
 * @returns {Object} facade
 */
export function attachExam(engine) {
  const e = engine ?? REAL;
  const available = typeof e.buildSession === "function" && typeof e.listExams === "function";

  return {
    available,

    /** Multiple-choice certs only — a skills track has no form to sit. */
    listExams: () =>
      safe(() => (e.listExams?.() ?? []).filter((x) => x.kind !== EXAM_KINDS.SKILLS), []),

    /**
     * What this cert can actually serve right now: sections, per-mode
     * availability, and the engine's own honest notes about a thin bank.
     */
    offering: (certId) => safe(() => e.examOffering(certId), null),

    /** Start a sitting. Returns {ok, session} or {ok:false, error}. */
    start: (opts) => attempt(() => e.buildSession(opts)),

    /** A retry form built from a previous attempt's misses. */
    startRetry: (prev, opts) => attempt(() => e.buildRetrySession(prev, opts)),

    /* ── session transitions. All pure and immutable in lib/exam. ── */
    tick: (s, now) => safe(() => e.tick(s, { now }), s),
    answer: (s, itemId, optionIndex, now) =>
      attempt(() => e.answerItem(s, itemId, optionIndex, { now })),
    clear: (s, itemId, now) => attempt(() => e.clearAnswer(s, itemId, { now })),
    flag: (s, itemId, now) => attempt(() => e.toggleFlag(s, itemId, { now })),
    goTo: (s, i, now) => safe(() => e.goTo(s, i, { now }), s),
    next: (s, now) => safe(() => e.nextItem(s, { now }), s),
    prev: (s, now) => safe(() => e.prevItem(s, { now }), s),
    pause: (s, now) => attempt(() => e.pauseSession(s, { now })),
    resume: (s, now) => attempt(() => e.resumeSession(s, { now })),
    submit: (s, now) => attempt(() => e.submitSession(s, { now })),

    /* ── reads ── */
    currentItem: (s) => safe(() => e.currentItem(s), null),
    remaining: (s, now) => safe(() => e.remainingMs(s, now), null),
    progress: (s, now) => safe(() => e.sessionProgress(s, now), null),
    isExpired: (s, now) => safe(() => e.isExpired(s, now), false),
    isResumable: (s) => safe(() => e.isResumable(s), false),
    canPause: (s) => safe(() => e.canPause(s), false),

    /* ── scoring + review: lib/exam's, never ours ── */
    score: (s) => safe(() => e.scoreSession(s), null),
    review: (s) => safe(() => e.buildReview(s), null),

    /* ── persistence ── */
    serialize: (s) => safe(() => e.serializeSession(s), null),
    restore: (json) => attempt(() => e.deserializeSession(json)),
  };
}

/**
 * Run an engine call that may throw an ExamError, as a value.
 *
 * The engine's error MESSAGES are user-facing prose by design ("a full timed mock
 * cannot be paused — the real exam has no pause button"). Turning them into a
 * result keeps that prose intact all the way to the screen instead of trading it
 * for a generic "something went wrong".
 *
 * @param {Function} fn
 * @returns {{ok:boolean, value?:*, error?:string, code?:string}}
 */
function attempt(fn) {
  try {
    return { ok: true, value: fn() };
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err), code: err?.code ?? null };
  }
}

/**
 * Run a read that should never break the render. Reads are called during paint;
 * a throw there white-screens the exam a learner is three hours into.
 * @param {Function} fn
 * @param {*} fallback
 */
function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/* ── mode presentation ─────────────────────────────────────────────────── */

/**
 * May this mode coach — reveal whether an answer is right, as it is given?
 *
 * NEVER on a mock. The whole value of a mock is sitting with not-knowing for
 * three hours; a mock that tells you as you go measures something else entirely
 * and, worse, feels easier than test day. lib/exam draws the same line with
 * `MODES.mock.pausable === false`, for the same reason.
 *
 * The engine has no opinion on feedback (it is a pure UI concern), so the rule
 * lives here — but it is derived from the engine's own mode table rather than a
 * second hardcoded list that could drift out of step.
 *
 * @param {string} mode
 * @returns {boolean}
 */
export function coachingAllowed(mode) {
  return mode !== "mock" && Boolean(MODES[mode]);
}

/**
 * The label for a coached mode. A learner must never mistake a coached run for a
 * mock result, so the mode's name says so on screen.
 * @param {string} mode
 * @param {boolean} coaching
 * @returns {string}
 */
export function modeLabel(mode, coaching) {
  const base = MODES[mode]?.label ?? mode;
  return coaching ? `${base} — coached` : base;
}

/* ── integrity ─────────────────────────────────────────────────────────────
   lib/exam is already scrupulous here: a form that could not be filled carries
   `shortfalls` and human-readable `warnings`, and a score off such a form comes
   back `verdict: "indicative"` with `caveats`. This half just makes sure that
   honesty reaches the screen instead of dying in an object nobody renders.
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Everything the UI must say out loud about a form's integrity.
 *
 * @param {Object} form a lib/exam ExamForm (session.form)
 * @returns {{ok:boolean, severity:"ok"|"warning"|"error", headline:string, notes:string[]}}
 */
export function formIntegrity(form) {
  if (!form) return { ok: true, severity: "ok", headline: "", notes: [] };

  const notes = [...(form.warnings ?? [])];
  const empty = (form.items?.length ?? 0) === 0;
  const missingWhole = (form.shortfalls ?? []).some((s) => s.drawn === 0);

  if (form.faithful && !notes.length) {
    return { ok: true, severity: "ok", headline: "Built to blueprint", notes: [] };
  }

  return {
    ok: false,
    severity: empty || missingWhole ? "error" : "warning",
    headline: empty
      ? "This form is empty"
      : missingWhole
        ? "A whole section is missing from this form"
        : "This form is not true-to-blueprint",
    // The engine's warnings are already written for a learner. Do not paraphrase.
    notes,
  };
}

/**
 * The caveats attached to a score, as the engine wrote them.
 * @param {Object} score an ExamScore
 * @returns {string[]}
 */
export function scoreCaveats(score) {
  return score?.caveats ?? [];
}

/**
 * Is this score a real mock result, or merely indicative?
 * lib/exam decides (`official` / `verdict`); we only relay it.
 * @param {Object} score
 * @returns {boolean}
 */
export function isOfficialResult(score) {
  return Boolean(score?.official);
}

/* ══════════════════════════════════════════════════════════════════════════
   2. PURE — UI-side helpers. Tested. lib/exam has no opinion on these.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── The clock ─────────────────────────────────────────────────────────────
   The clock itself belongs to lib/exam (session.remainingMs derives it from an
   absolute stamp, so it cannot drift and a throttled tab cannot gift time).
   What lives here is only the PRESENTATION of it: how it reads, when it
   escalates, and when it is allowed to speak.
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Format a duration for display: H:MM:SS over an hour, M:SS under it.
 * Rounds UP so a clock reading 0:01 still has time on it — reading "0:00" with
 * time left, or "0:01" with none, are both lies.
 * @param {number|null} ms
 * @returns {string}
 */
export function formatClock(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "--:--";
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Spoken form of a duration. "4 minutes remaining" reads; "04:00" does not.
 * @param {number|null} ms
 * @returns {string}
 */
export function speakClock(ms) {
  if (ms === null || ms === undefined) return "Untimed";
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts = [];
  if (h) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
  if (m) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  if (!h && s) parts.push(`${s} second${s === 1 ? "" : "s"}`);
  if (!parts.length) return "Time is up";
  return `${parts.join(" ")} remaining`;
}

/** The real 5-minute warning, plus the quieter ones on the way down. */
export const WARN_AT_SEC = 5 * 60;
const MILESTONES_SEC = [30 * 60, 15 * 60, WARN_AT_SEC, 60];

/**
 * The clock's urgency level.
 *
 * No fake urgency: `warning` starts at a real five minutes and `final` at a real
 * one minute. Nothing turns red because pressure was thought motivating — an exam
 * clock that cries wolf is one the learner learns to ignore, which is the
 * opposite of what a timed mock is for.
 *
 * @param {number|null} ms
 * @returns {"none"|"normal"|"warning"|"final"|"expired"}
 */
export function timerLevel(ms) {
  if (ms === null || ms === undefined) return "none";
  if (ms <= 0) return "expired";
  if (ms <= 60 * 1000) return "final";
  if (ms <= WARN_AT_SEC * 1000) return "warning";
  return "normal";
}

/**
 * Which milestone (if any) was crossed between two readings.
 *
 * This is what keeps the live region habitable: the timer paints 4x/second but
 * announces only on a real threshold, so a screen reader says "5 minutes
 * remaining" once instead of reading the clock aloud ~43,000 times over a
 * three-hour form.
 *
 * @param {number|null} prevMs
 * @param {number|null} nowMs
 * @returns {number|null} the milestone in SECONDS, or null
 */
export function crossedMilestone(prevMs, nowMs) {
  if (prevMs === null || nowMs === null || prevMs === undefined || nowMs === undefined) return null;
  for (const sec of MILESTONES_SEC) {
    const t = sec * 1000;
    if (prevMs > t && nowMs <= t) return sec;
  }
  if (prevMs > 0 && nowMs <= 0) return 0;
  return null;
}

/**
 * The announcement for a crossed milestone.
 * @param {number} sec
 * @returns {string}
 */
export function milestoneMessage(sec) {
  if (sec === 0) return "Time is up. Your exam has been submitted.";
  if (sec === 60) return "One minute remaining.";
  if (sec === WARN_AT_SEC) return "Five minutes remaining.";
  return `${Math.round(sec / 60)} minutes remaining.`;
}

/* ── The answer sheet + navigator ─────────────────────────────────────────
   NOTE the `=== undefined` tests. An answer is an option INDEX and index 0 is
   falsy: `if (session.answers[id])` would report every item answered with the
   first option as blank. That bug would be invisible in casual testing and
   catastrophic in a mock.
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Has this item been answered? Index-0-safe.
 * @param {Object} sess a lib/exam session
 * @param {string} itemId
 * @returns {boolean}
 */
export function isAnswered(sess, itemId) {
  return sess?.answers?.[itemId] !== undefined;
}

/**
 * The chosen option index, or null.
 * @param {Object} sess
 * @param {string} itemId
 * @returns {number|null}
 */
export function chosenIndex(sess, itemId) {
  const v = sess?.answers?.[itemId];
  return v === undefined ? null : v;
}

/**
 * The navigator's model: one entry per item, in form order.
 *
 * Practising without a navigator trains the wrong habit — every real testing
 * engine has one, and the skill of leaving a hard question, banking the easy
 * marks behind it and coming back is worth as much on exam day as any fact.
 *
 * @param {Object} sess
 * @returns {Array<{id, index, number, section, answered, flagged, current}>}
 */
export function navigatorEntries(sess) {
  return (sess?.form?.items ?? []).map((item, i) => ({
    id: item.id,
    index: i,
    number: i + 1,
    section: item.sectionLabel ?? item.section ?? null,
    answered: isAnswered(sess, item.id),
    flagged: Boolean(sess?.flags?.[item.id]),
    current: sess?.cursor === i,
  }));
}

/**
 * The counts under the navigator.
 * @param {Object} sess
 * @returns {{total, answered, unanswered, flagged, complete, fractionAnswered}}
 */
export function answerSheetSummary(sess) {
  const items = sess?.form?.items ?? [];
  const total = items.length;
  let answered = 0;
  let flagged = 0;
  for (const it of items) {
    if (isAnswered(sess, it.id)) answered += 1;
    if (sess?.flags?.[it.id]) flagged += 1;
  }
  return {
    total,
    answered,
    unanswered: total - answered,
    flagged,
    complete: total > 0 && answered === total,
    fractionAnswered: total ? answered / total : 0,
  };
}

/**
 * The next item worth returning to: the first flagged-or-unanswered item after
 * the cursor, wrapping. Null when nothing is outstanding.
 * @param {Object} sess
 * @returns {number|null}
 */
export function nextOutstanding(sess) {
  const entries = navigatorEntries(sess);
  const n = entries.length;
  if (!n) return null;
  for (let k = 1; k <= n; k += 1) {
    const e = entries[((sess.cursor ?? 0) + k) % n];
    if (!e.answered || e.flagged) return e.index;
  }
  return null;
}

/**
 * The line shown before submit. States plainly what is unfinished — a tool that
 * lets you submit twelve blanks without saying so is not on your side.
 * @param {Object} sess
 * @returns {string}
 */
export function submitWarning(sess) {
  const { unanswered, flagged } = answerSheetSummary(sess);
  const bits = [];
  if (unanswered > 0) bits.push(`${unanswered} question${unanswered === 1 ? " is" : "s are"} unanswered`);
  if (flagged > 0) bits.push(`${flagged} ${flagged === 1 ? "is" : "are"} still flagged for review`);
  if (!bits.length) return "Every question is answered.";
  return `${bits.join(" and ")}. Unanswered questions are scored as wrong, exactly as on the real exam.`;
}

/* ── Review presentation ───────────────────────────────────────────────────
   lib/exam/review.js builds the review (per-option, with each explanation). It
   does not filter or count it for a UI, so that much lives here.
   ────────────────────────────────────────────────────────────────────────── */

/**
 * What to call one option in review. lib/exam gives `isCorrect` and `chosen`;
 * the UI needs one token to key a style and a label off.
 * @param {Object} o a lib/exam ReviewOption
 * @returns {"correct-chosen"|"correct-missed"|"wrong-chosen"|"wrong"}
 */
export function optionVerdict(o) {
  if (o.isCorrect && o.chosen) return "correct-chosen";
  if (o.isCorrect) return "correct-missed";
  if (o.chosen) return "wrong-chosen";
  return "wrong";
}

/** Review filters. WRONG is the default: it is where the learning is. */
export const ReviewFilter = {
  ALL: "all",
  WRONG: "wrong",
  SKIPPED: "skipped",
  FLAGGED: "flagged",
  CORRECT: "correct",
};

/**
 * Filter a lib/exam review's items.
 * Statuses are the engine's: "correct" | "incorrect" | "unanswered".
 * @param {Array} items
 * @param {string} filter
 * @returns {Array}
 */
export function filterReview(items, filter) {
  const list = items ?? [];
  switch (filter) {
    case ReviewFilter.WRONG:
      return list.filter((r) => r.status === "incorrect");
    case ReviewFilter.SKIPPED:
      return list.filter((r) => r.status === "unanswered");
    case ReviewFilter.FLAGGED:
      return list.filter((r) => r.flagged);
    case ReviewFilter.CORRECT:
      return list.filter((r) => r.status === "correct");
    default:
      return list;
  }
}

/**
 * Counts for the review filter chips.
 * @param {Array} items
 * @returns {{all, wrong, skipped, flagged, correct}}
 */
export function reviewCounts(items) {
  const list = items ?? [];
  return {
    all: list.length,
    wrong: list.filter((r) => r.status === "incorrect").length,
    skipped: list.filter((r) => r.status === "unanswered").length,
    flagged: list.filter((r) => r.flagged).length,
    correct: list.filter((r) => r.status === "correct").length,
  };
}

/**
 * A percent, from lib/exam's 0..100 pct values.
 * The engine reports percentages as 0..100 (score.rawPct, section.pct) — NOT as
 * fractions like lib/sheet's pivot showAs values. Mixing the two conventions is
 * how 72% becomes 7200%, so every percent the UI prints goes through here.
 * @param {number|null} pct 0..100
 * @param {number} [dp]
 * @returns {string}
 */
export function formatPct(pct, dp = 0) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return "—";
  return `${pct.toFixed(dp)}%`;
}

/**
 * How far off the pass mark a result is, in questions. "You were 4 questions
 * short" is actionable; "68.3%" is not.
 * @param {Object} score an ExamScore
 * @returns {number}
 */
export function questionsToPass(score) {
  if (!score?.total) return 0;
  return Math.max(0, (score.passMark?.count ?? 0) - score.correct);
}

/**
 * The blueprint table for the start screen: what you are about to be tested on,
 * with what the bank can actually supply against it.
 *
 * Built from lib/exam's `examOffering(certId)`, which already reports per-section
 * quota / available / short.
 *
 * @param {Object} offering
 * @returns {Array<{id, label, weight, quota, available, short}>}
 */
export function blueprintRows(offering) {
  return (offering?.sections ?? []).map((s) => ({
    id: s.id,
    label: s.label,
    weight: s.weight, // 0..1 fraction, per lib/exam's blueprint
    quota: s.quota,
    available: s.available,
    short: s.short,
  }));
}

/**
 * The modes a cert can actually offer, with the unavailable ones explained
 * rather than silently dropped. A greyed button with a reason teaches; a missing
 * button just confuses.
 * @param {Object} offering
 * @returns {Array<{id, label, description, available, count, why}>}
 */
export function modeRows(offering) {
  return (offering?.modes ?? []).map((m) => ({
    ...m,
    why: m.available
      ? null
      : m.id === "retry"
        ? "Sit an exam first — a retry form is built from the questions you missed."
        : "The bank doesn't hold enough questions for this yet.",
  }));
}
