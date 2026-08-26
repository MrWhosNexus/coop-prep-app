// lib/store/schema.js
// The versioned document schema + per-slice defaults for the desktop data
// layer. Pure data/functions only -- no DOM, no Electron, no localStorage.
//
// The document replaces three legacy localStorage keys (see migrate.js for
// the full mapping): "coop_prep_v1" (lib/progress.js), "coop_ai_v1"
// (lib/ai/config.js), and "coop_theme" (components/Dashboard.js). Slices
// that used to live nested inside the single progress blob (notes,
// highlights, bookmarks, tool state) are promoted to top-level slices here
// so each can evolve its own shape independently.

import { DEFAULT_CONFIG } from "../ai/config.js";

/** Bump this -- and add an upgrade step in migrate.js -- on every shape change. */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * progress -- lesson completion, quiz scores, streak/XP, achievements.
 * Mirrors lib/progress.js's defaultState() / lib/momentum.js exactly,
 * minus notes/bookmarks/highlights/tools which are now their own slices.
 */
export function defaultProgress() {
  return {
    completed: {}, // lessonId -> true
    quizScores: {}, // lessonId -> { correct, total, lastAt }
    flashDone: {}, // flashcard index -> true
    xp: 0,
    streak: 0,
    lastDay: null, // ISO date string (yyyy-mm-dd) of the last completion
    daily: { date: null, xp: 0, lessons: 0, minutes: 0 },
    achievements: {}, // id -> ISO unlockedAt
  };
}

/**
 * notes -- per-lesson free-text notes, keyed by a stable id (not by
 * lessonId) so a lesson can eventually hold more than one note and an
 * AI note-taker (later phase) has something durable to reference.
 * id -> { id, lessonId, body, createdAt, updatedAt }
 */
export function defaultNotes() {
  return {};
}

/**
 * highlights -- saved text snippets anchored to a lesson, with colour.
 * id -> { id, lessonId, text, color, createdAt }
 */
export function defaultHighlights() {
  return {};
}

/**
 * bookmarks -- saved lessons/cards, keyed by lessonId (one per lesson,
 * matching the existing toggle-by-lessonId UX in components/Dashboard.js).
 * lessonId -> { lessonId, createdAt }
 */
export function defaultBookmarks() {
  return {};
}

/**
 * tools -- opaque per-tool saved work. Every other tool engine (sheet,
 * viz, cover letter, ...) is owned by a different agent; this slice just
 * stores whatever plain-JSON blob they hand us, keyed by tool id then by
 * document id, so a single tool can hold multiple saved works.
 * toolId -> { docId -> <opaque JSON> }
 */
export function defaultTools() {
  return {};
}

/**
 * settings -- theme + AI defaults (model/effort/endpoint), never key
 * material. API keys are intentionally excluded: another agent's
 * lib/endpoints/ keeps key material main-process-only.
 */
export function defaultSettings() {
  const { apiKey, ...aiDefaults } = DEFAULT_CONFIG;
  return {
    theme: "daylight",
    ai: { ...aiDefaults }, // { endpoint, model, presetId } -- no apiKey, ever
  };
}

/** Names of every top-level slice, in document order. */
export const SLICE_NAMES = ["progress", "notes", "highlights", "bookmarks", "tools", "settings"];

/** The full default document at CURRENT_SCHEMA_VERSION. */
export function defaultDocument() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    progress: defaultProgress(),
    notes: defaultNotes(),
    highlights: defaultHighlights(),
    bookmarks: defaultBookmarks(),
    tools: defaultTools(),
    settings: defaultSettings(),
  };
}
