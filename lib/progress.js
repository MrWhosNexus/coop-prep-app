"use client";

import { awardXp } from "./momentum.js";
import { defaultCoverLetterState } from "./tools/coverLetter.js";
import { FELLOWSHIP_END } from "../data/curriculum.js";

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
    xp: 0,
    streak: 0,
    lastDay: null,
    daily: { date: null, xp: 0, lessons: 0, minutes: 0 },
    achievements: {},   // id → ISO unlockedAt
    tools: { coverLetter: defaultCoverLetterState },
  };
}

export function markComplete(state, lessonId, baseXp = 50) {
  if (state.completed[lessonId]) return state;
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
  return {
    ...state,
    completed: { ...state.completed, [lessonId]: true },
    xp: state.xp + gain,
    streak,
    lastDay: today,
    daily,
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

export function daysUntilFellowship(target = FELLOWSHIP_END) {
  const now = new Date();
  return Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));
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
