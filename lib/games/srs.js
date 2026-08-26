// lib/games/srs.js
// Spaced repetition scheduling for study concepts.
//
// Algorithm: SM-2 (Wozniak/Gorka) with three deliberate, documented
// deviations -- see reviewCard() for the rationale of each:
//   1. ease is clamped to [MIN_EASE, MAX_EASE] (stock SM-2 only floors it)
//   2. intervals are capped at maxIntervalDays, defaulting to a horizon
//      short enough that nothing schedules past a fellowship start date
//   3. cards keep a bounded `recent` grade log so mastery estimation
//      (lib/games/scoring.js) has evidence without a second store
//
// Everything here is pure and JSON-serializable: a deck is a plain
// object map of conceptId -> card, so it drops straight into the store's
// progress slice with no adapters.

/** Lowest allowed ease factor. Below this a card thrashes. */
export const MIN_EASE = 1.3;
/** Highest allowed ease factor (deviation from stock SM-2, which is unbounded). */
export const MAX_EASE = 3.0;
/** Ease factor a brand-new card starts at. */
export const DEFAULT_EASE = 2.5;
/** Grades below this count as a lapse and reset the repetition count. */
export const PASS_GRADE = 3;
/** How many recent grades a card retains for mastery estimation. */
export const HISTORY_LIMIT = 12;

/**
 * The four grades a reviewer can give. Numeric values are SM-2 quality
 * scores, so the classic formula applies unchanged.
 * @type {{AGAIN: number, HARD: number, GOOD: number, EASY: number}}
 */
export const GRADE = { AGAIN: 0, HARD: 3, GOOD: 4, EASY: 5 };

const GRADE_ALIASES = { again: 0, hard: 3, good: 4, easy: 5 };

/**
 * Coerce a grade to an SM-2 quality score in [0, 5].
 * Accepts a number or a name ("again" | "hard" | "good" | "easy").
 * @param {number|string} grade
 * @returns {number}
 */
export function normalizeGrade(grade) {
  if (typeof grade === "string") {
    const hit = GRADE_ALIASES[grade.trim().toLowerCase()];
    if (hit === undefined) throw new Error(`unknown grade: ${grade}`);
    return hit;
  }
  if (typeof grade !== "number" || !Number.isFinite(grade)) {
    throw new Error(`unknown grade: ${grade}`);
  }
  return Math.max(0, Math.min(5, Math.round(grade)));
}

/* ─── date helpers (day-granular, ISO, timezone-stable) ─── */

/**
 * Coerce an injectable clock value to a Date.
 * @param {Date|number|string} [now]
 * @returns {Date}
 */
export function toDate(now) {
  if (now === undefined || now === null) return new Date();
  if (now instanceof Date) return now;
  return new Date(now);
}

/**
 * The UTC calendar day of a clock value, as "yyyy-mm-dd".
 * @param {Date|number|string} [now]
 * @returns {string}
 */
export function dayISO(now) {
  return toDate(now).toISOString().slice(0, 10);
}

/**
 * Shift an ISO day string by whole days.
 * @param {string} iso "yyyy-mm-dd"
 * @param {number} days
 * @returns {string}
 */
export function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}

/**
 * Whole days from `a` to `b` (negative when b precedes a).
 * @param {string} a "yyyy-mm-dd"
 * @param {string} b "yyyy-mm-dd"
 * @returns {number}
 */
export function daysBetween(a, b) {
  const ms = new Date(`${b}T00:00:00.000Z`) - new Date(`${a}T00:00:00.000Z`);
  return Math.round(ms / 86400000);
}

/* ─── cards ─── */

/**
 * A fresh, never-reviewed card for a concept.
 * @param {string} id concept id
 * @param {{now?: Date|number|string}} [opts]
 * @returns {object} card
 */
export function newCard(id, opts = {}) {
  return {
    id,
    reps: 0,
    lapses: 0,
    ease: DEFAULT_EASE,
    intervalDays: 0,
    due: dayISO(opts.now),
    lastGrade: null,
    lastReviewedAt: null,
    recent: [],
  };
}

/**
 * True when the card has never been graded.
 * @param {object} card
 * @returns {boolean}
 */
export function isNew(card) {
  return !card || card.reps === 0 && card.lastReviewedAt === null;
}

/**
 * True when the card is scheduled on or before `now`'s calendar day.
 * New cards are always due.
 * @param {object} card
 * @param {Date|number|string} [now]
 * @returns {boolean}
 */
export function isDue(card, now) {
  if (!card) return true;
  return card.due <= dayISO(now);
}

/**
 * Days a card is past its due date (0 when not yet due).
 * @param {object} card
 * @param {Date|number|string} [now]
 * @returns {number}
 */
export function overdueDays(card, now) {
  if (!card || !card.due) return 0;
  return Math.max(0, daysBetween(card.due, dayISO(now)));
}

/**
 * Estimated probability of recalling this card right now, from the
 * exponential forgetting curve R = 0.9 ^ (elapsed / stability), taking the
 * last scheduled interval as the stability estimate (the interval is, by
 * construction, the horizon at which SM-2 expects ~90% recall).
 * Unreviewed cards return 0.
 * @param {object} card
 * @param {Date|number|string} [now]
 * @returns {number} 0..1
 */
export function retrievability(card, now) {
  if (!card || !card.lastReviewedAt || card.intervalDays <= 0) return 0;
  const elapsed = Math.max(0, daysBetween(dayISO(card.lastReviewedAt), dayISO(now)));
  const r = Math.pow(0.9, elapsed / card.intervalDays);
  return Math.max(0, Math.min(1, r));
}

/**
 * Grade a review. Pure -- returns a new card, never mutates the input.
 *
 * SM-2 core: ease moves by (0.1 - (5-q)*(0.08 + (5-q)*0.02)); a pass
 * advances the interval 1 -> 6 -> prev*ease; a lapse resets reps to 0 and
 * reschedules for tomorrow (the card is not thrown away, only relearned).
 *
 * @param {object} card
 * @param {number|string} grade 0..5, or "again"|"hard"|"good"|"easy"
 * @param {{now?: Date|number|string, maxIntervalDays?: number}} [opts]
 * @returns {object} the next card state
 */
export function reviewCard(card, grade, opts = {}) {
  const q = normalizeGrade(grade);
  const maxIntervalDays = opts.maxIntervalDays ?? 180;
  const at = toDate(opts.now);
  const today = dayISO(at);

  const delta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  const ease = Math.max(MIN_EASE, Math.min(MAX_EASE, card.ease + delta));

  let reps;
  let lapses = card.lapses;
  let intervalDays;

  if (q < PASS_GRADE) {
    // Lapse: relearn from the start, but keep the (now lower) ease.
    reps = 0;
    lapses += 1;
    intervalDays = 1;
  } else {
    reps = card.reps + 1;
    if (reps === 1) intervalDays = 1;
    else if (reps === 2) intervalDays = 6;
    else intervalDays = Math.round(card.intervalDays * ease);
    intervalDays = Math.max(1, intervalDays);
  }

  intervalDays = Math.min(intervalDays, Math.max(1, Math.round(maxIntervalDays)));

  const recent = [...card.recent, { g: q, at: at.toISOString() }].slice(-HISTORY_LIMIT);

  return {
    ...card,
    reps,
    lapses,
    ease,
    intervalDays,
    due: addDays(today, intervalDays),
    lastGrade: q,
    lastReviewedAt: at.toISOString(),
    recent,
  };
}

/**
 * Cap intervals so nothing schedules past a hard deadline (e.g. the
 * fellowship start). Returns the largest sensible maxIntervalDays, floored
 * at 1 so a past deadline still produces a usable schedule.
 * @param {Date|number|string} deadline
 * @param {Date|number|string} [now]
 * @returns {number} days
 */
export function horizonTo(deadline, now) {
  return Math.max(1, daysBetween(dayISO(now), dayISO(deadline)));
}

/* ─── decks ─── */

/**
 * An empty deck. A deck is a plain map of conceptId -> card, so it is
 * already store-ready JSON.
 * @returns {Object<string, object>}
 */
export function defaultDeck() {
  return {};
}

/**
 * Read a card, materialising a new one if the concept is unseen. Does not
 * write to the deck.
 * @param {Object<string, object>} deck
 * @param {string} id
 * @param {{now?: Date|number|string}} [opts]
 * @returns {object} card
 */
export function getCard(deck, id, opts = {}) {
  return deck[id] ?? newCard(id, opts);
}

/**
 * Grade a concept inside a deck. Pure -- returns a new deck.
 * @param {Object<string, object>} deck
 * @param {string} id
 * @param {number|string} grade
 * @param {{now?: Date|number|string, maxIntervalDays?: number}} [opts]
 * @returns {Object<string, object>} the next deck
 */
export function reviewInDeck(deck, id, grade, opts = {}) {
  const card = getCard(deck, id, opts);
  return { ...deck, [id]: reviewCard(card, grade, opts) };
}

/**
 * Drop cards whose concepts no longer exist (curriculum edits shouldn't
 * leave orphans in the store).
 * @param {Object<string, object>} deck
 * @param {string[]} conceptIds
 * @returns {Object<string, object>}
 */
export function pruneDeck(deck, conceptIds) {
  const keep = new Set(conceptIds);
  const next = {};
  for (const [id, card] of Object.entries(deck)) if (keep.has(id)) next[id] = card;
  return next;
}

/**
 * Concept ids due on or before `now`, most overdue first. Ties break on id
 * so the order is stable and testable.
 * @param {Object<string, object>} deck
 * @param {{now?: Date|number|string}} [opts]
 * @returns {string[]}
 */
export function dueCardIds(deck, opts = {}) {
  const today = dayISO(opts.now);
  return Object.values(deck)
    .filter((c) => c.due <= today)
    .sort((a, b) => (a.due === b.due ? (a.id < b.id ? -1 : 1) : a.due < b.due ? -1 : 1))
    .map((c) => c.id);
}

/**
 * Build a review queue: everything due (most overdue first), then unseen
 * concepts up to `newPerSession`. Reviews always come before new material --
 * clearing the backlog is what protects retention; adding new cards on top
 * of a backlog is how decks die.
 * @param {Object<string, object>} deck
 * @param {string[]} conceptIds all concepts currently in the curriculum
 * @param {{now?: Date|number|string, limit?: number, newPerSession?: number}} [opts]
 * @returns {string[]} ordered concept ids
 */
export function buildQueue(deck, conceptIds, opts = {}) {
  const { limit = 20, newPerSession = 5 } = opts;
  const known = new Set(conceptIds);
  const due = dueCardIds(deck, opts).filter((id) => known.has(id));
  const fresh = conceptIds.filter((id) => !deck[id]).slice(0, Math.max(0, newPerSession));
  return [...due, ...fresh].slice(0, Math.max(0, limit));
}

/**
 * Counts for a deck dashboard. "learning" = seen but not yet past the
 * first week; "mature" = interval of 21 days or more (the usual cutoff).
 * @param {Object<string, object>} deck
 * @param {string[]} [conceptIds] when given, counts unseen concepts as new
 * @param {{now?: Date|number|string}} [opts]
 * @returns {{total: number, seen: number, new: number, due: number, learning: number, mature: number}}
 */
export function deckStats(deck, conceptIds = null, opts = {}) {
  const cards = Object.values(deck);
  const total = conceptIds ? conceptIds.length : cards.length;
  const seen = cards.length;
  return {
    total,
    seen,
    new: Math.max(0, total - seen),
    due: dueCardIds(deck, opts).length,
    learning: cards.filter((c) => c.intervalDays > 0 && c.intervalDays < 21).length,
    mature: cards.filter((c) => c.intervalDays >= 21).length,
  };
}
