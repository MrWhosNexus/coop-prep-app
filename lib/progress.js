"use client";

import { awardXp } from "./momentum.js";
import { defaultCoverLetterState } from "./tools/coverLetter.js";
import { FELLOWSHIP_START, FELLOWSHIP_END } from "../data/curriculum.js";

const KEY = "coop_prep_v1";

export function loadProgress() {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaultState(), ...JSON.parse(raw) } : defaultState();
  } catch {
    return defaultState();
  }
}

export function saveProgress(state) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function defaultState() {
  return {
    completed: {},   // lessonId → true
    quizScores: {},  // lessonId → { correct, total, lastAt }
    flashDone: {},   // flashcard index → true
    notes: {},       // lessonId → string
    bookmarks: {},   // lessonId → true
    highlights: {},  // lessonId → string[] (saved text snippets)
    labs: {},        // guided lab id → { score, completedAt } — the XP/streak
                     // ledger for guided labs. Separate from tools.guided (the
                     // UI's best-score record, which MAY be re-recorded) so
                     // that re-finishing a lab can never re-mint XP.
    xp: 0,
    streak: 0,
    lastDay: null,
    daily: { date: null, xp: 0, lessons: 0, minutes: 0 },
    achievements: {},   // id → ISO unlockedAt
    tools: { coverLetter: defaultCoverLetterState },
  };
}

/* The single place activity credits the streak, the day counter, and XP.
   Extracted from markComplete so guided labs can credit activity through the
   IDENTICAL math — the streak bug this fixes was precisely that only reading
   completions ran this code, so a week of lab work counted as a week of
   inactivity and reset the streak. */
function creditActivity(state, baseXp) {
  const today = todayISO();
  const isNewDay = state.lastDay !== today;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streak = isNewDay
    ? (state.lastDay === yesterday ? state.streak + 1 : 1)
    : state.streak;
  const gain = awardXp(baseXp, streak);
  const daily = state.daily?.date === today
    ? { ...state.daily, xp: state.daily.xp + gain, lessons: state.daily.lessons + 1 }
    : { date: today, xp: gain, lessons: 1, minutes: state.daily?.minutes ?? 0 };
  return { ...state, xp: state.xp + gain, streak, lastDay: today, daily };
}

export function markComplete(state, lessonId, baseXp = 50) {
  if (state.completed[lessonId]) return state;
  return {
    ...creditActivity(state, baseXp),
    completed: { ...state.completed, [lessonId]: true },
  };
}

/* Guided labs award up to double a reading's XP because they are the app's
   hardest work: a graded, multi-step build in a real tool vs. an 8-minute
   read-and-click. XP scales with the lab score so hint/retry penalties carry
   through, but never below the floor — finishing every step of a lab is real
   activity even on a rough run, and must at minimum keep the streak honest. */
export const LAB_BASE_XP = 100;
export const LAB_MIN_XP = 20;

/**
 * Credit a finished guided lab: streak/day activity plus score-scaled XP.
 * Idempotent per lab id, mirroring markComplete's completed[] guard — the
 * first completion mints XP, every later run of the same lab returns the
 * state UNCHANGED (same object), so replaying a lab can never farm XP.
 * @param {object} state progress state
 * @param {string} guidedId guided lab id (e.g. "excel-pivot")
 * @param {number} score final lesson score in [0, 1] (lessonScore().score)
 * @returns {object} new state, or the SAME state when already credited
 */
export function markLabComplete(state, guidedId, score) {
  if (!guidedId || state.labs?.[guidedId]) return state;
  const safe = Math.min(1, Math.max(0, Number(score) || 0));
  const baseXp = Math.max(LAB_MIN_XP, Math.round(LAB_BASE_XP * safe));
  return {
    ...creditActivity(state, baseXp),
    labs: { ...(state.labs ?? {}), [guidedId]: { score: safe, completedAt: new Date().toISOString() } },
  };
}

export function toggleBookmark(state, lessonId) {
  const bookmarks = { ...state.bookmarks };
  if (bookmarks[lessonId]) delete bookmarks[lessonId];
  else bookmarks[lessonId] = true;
  return { ...state, bookmarks };
}

export function addHighlight(state, lessonId, text) {
  const snippet = (text || "").trim();
  if (!snippet) return state;
  const existing = state.highlights[lessonId] || [];
  if (existing.includes(snippet)) return state;
  return {
    ...state,
    highlights: { ...state.highlights, [lessonId]: [...existing, snippet] },
  };
}

export function removeHighlight(state, lessonId, text) {
  const existing = state.highlights[lessonId] || [];
  const next = existing.filter((s) => s !== text);
  const highlights = { ...state.highlights };
  if (next.length) highlights[lessonId] = next;
  else delete highlights[lessonId];
  return { ...state, highlights };
}

export function saveQuizScore(state, lessonId, correct, total) {
  return {
    ...state,
    quizScores: {
      ...state.quizScores,
      [lessonId]: { correct, total, lastAt: new Date().toISOString() },
    },
  };
}

/* ── fellowship phase model ──
   The app originally only counted DOWN to a date, so the day that date passed
   every "days left" surface froze at 0 and the SRS horizon collapsed to a
   1-day cap (see lib/games/srs.js). The phase model makes the three states
   explicit so call sites branch on a named phase instead of re-deriving it
   from a countdown that goes silent once it hits zero. Phases are
   day-granular (a phase flips at midnight, not at the start's clock time),
   matching how the SRS schedules. */

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Which state the program is in relative to `now`:
 *   "before" — counting down to FELLOWSHIP_START
 *   "during" — the fellowship is running (start day inclusive, end day inclusive)
 *   "after"  — past FELLOWSHIP_END (the real program end, Dec 2 — see
 *              data/curriculum.js; not an invented date)
 * `now` is injectable so tests never depend on the real clock — the frozen
 * countdown shipped precisely because nothing pinned time.
 */
export function fellowshipPhase(now = new Date()) {
  const day = new Date(now).toISOString().slice(0, 10);
  if (day < FELLOWSHIP_START.toISOString().slice(0, 10)) return "before";
  if (day <= FELLOWSHIP_END.toISOString().slice(0, 10)) return "during";
  return "after";
}

/**
 * 1-indexed day of the program ("Day 1" is the start date itself), for the
 * during-phase UI. 0 before the start; keeps counting past the end so an
 * "after" surface can still say how far in it is.
 */
export function daysIntoFellowship(now = new Date()) {
  const day = new Date(new Date(now).toISOString().slice(0, 10));
  const diff = Math.round((day - FELLOWSHIP_START) / DAY_MS);
  return diff < 0 ? 0 : diff + 1;
}

/* Still the countdown for the before/during cases (target defaults to program
   end); floors at 0 rather than going negative because every caller renders
   it as "N days to X". `now` is injectable for the same time-pinning reason
   as fellowshipPhase. */
export function daysUntilFellowship(target = FELLOWSHIP_END, now = new Date()) {
  return Math.max(0, Math.ceil((target - new Date(now)) / DAY_MS));
}

export function readinessScore(progress, modules) {
  const allLessons = modules.flatMap((m) => m.lessons);
  const total = allLessons.length;
  const done = allLessons.filter((l) => progress.completed[l.id]).length;
  const quizzed = allLessons.filter(
    (l) => progress.quizScores[l.id]?.correct >= (progress.quizScores[l.id]?.total ?? 1)
  ).length;
  // 60% weight on lesson completion, 40% on quiz passes
  return Math.round(((done / total) * 0.6 + (quizzed / total) * 0.4) * 100);
}
