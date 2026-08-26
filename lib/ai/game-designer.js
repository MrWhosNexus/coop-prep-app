// lib/ai/game-designer.js
// Picks + configures learning games for a (generated or authored) lesson.
//
// Deliberately PURE and heuristic — no LLM call. The lesson's flashcards and
// quiz already carry everything a game needs, so designing games from them is
// deterministic, testable, and costs the user zero tokens.
//
// SEAM: lib/games/ is being built by another agent in parallel. This module
// emits provider-neutral game config envelopes:
//   { kind, gameId, title, source: { lessonId, generated }, config }
// The integration agent maps each `kind` onto lib/games/generators.js
// (matching / quiz-rush / fill-blank generators) and feeds `toSrsCards`
// output into lib/games/srs.js decks. Until that seam is wired, the configs
// are still valid data the review UI can preview.

import { GAME_CONFIG_SCHEMA, validateAgainst } from "./schemas.js";

/** Game kinds this designer can emit. Keys are stable API; values are ids. */
export const GAME_KINDS = Object.freeze({
  MATCHING: "matching",
  QUIZ_RUSH: "quiz-rush",
  SRS: "srs",
  FILL_BLANK: "fill-blank",
});

/** Most pairs a matching board stays playable with. */
export const MAX_MATCHING_PAIRS = 8;

/**
 * Convert flashcards to spaced-repetition cards (the lib/games/srs.js seam).
 *
 * @param {{ term: string, def: string }[]} flashcards
 * @returns {{ front: string, back: string }[]}
 */
export function toSrsCards(flashcards) {
  return (Array.isArray(flashcards) ? flashcards : [])
    .filter((f) => f && typeof f.term === "string" && typeof f.def === "string")
    .map((f) => ({ front: f.term, back: f.def }));
}

/**
 * A term/definition matching game from flashcards.
 *
 * @param {{ term: string, def: string }[]} flashcards
 * @returns {{ pairs: { left: string, right: string }[] }}
 */
export function matchingConfig(flashcards) {
  return {
    pairs: (Array.isArray(flashcards) ? flashcards : [])
      .slice(0, MAX_MATCHING_PAIRS)
      .map((f) => ({ left: f.term, right: f.def })),
  };
}

/**
 * A timed quiz round from curriculum-shaped quiz items. Per-option
 * explanations ride along so the game can teach on a wrong answer.
 *
 * @param {object[]} quiz - curriculum-shaped quiz items
 * @param {{ secondsPerQuestion?: number }} [opts]
 * @returns {{ secondsPerQuestion: number, questions: object[] }}
 */
export function quizRushConfig(quiz, opts = {}) {
  return {
    secondsPerQuestion: opts.secondsPerQuestion ?? 20,
    questions: (Array.isArray(quiz) ? quiz : []).map((item) => ({
      q: item.q,
      answer: item.a,
      explanation: item.explanation,
      options: (item.options ?? []).map((o) => ({ text: o.text, explanation: o.explanation })),
    })),
  };
}

const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

/**
 * Fill-in-the-blank items: for each flashcard term that appears in the lesson
 * body, blank the first sentence containing it. Choices are the answer plus
 * other terms (deterministic order — the game UI shuffles at play time).
 *
 * @param {string[]} bodyParagraphs
 * @param {string[]} terms
 * @returns {{ prompt: string, answer: string, choices: string[] }[]}
 */
export function fillBlankItems(bodyParagraphs, terms) {
  const sentences = (Array.isArray(bodyParagraphs) ? bodyParagraphs : [])
    .flatMap((p) => String(p).split(SENTENCE_SPLIT))
    .filter(Boolean);
  const list = (Array.isArray(terms) ? terms : []).filter((t) => typeof t === "string" && t.trim());

  const items = [];
  for (const term of list) {
    const lower = term.toLowerCase();
    const sentence = sentences.find((s) => s.toLowerCase().includes(lower));
    if (!sentence) continue;
    const idx = sentence.toLowerCase().indexOf(lower);
    const prompt =
      sentence.slice(0, idx) + "_____" + sentence.slice(idx + term.length);
    const distractors = list.filter((t) => t !== term).slice(0, 3);
    items.push({ prompt, answer: term, choices: [term, ...distractors].sort() });
  }
  return items;
}

/**
 * Design games for a lesson. Heuristics:
 *   - >= 3 flashcards           -> matching board
 *   - >= 2 quiz questions       -> timed quiz-rush round
 *   - >= 1 flashcard            -> SRS deck (lib/games/srs.js seam)
 *   - >= 2 term-in-body matches -> fill-in-the-blank
 * Priority order above; capped at maxGames.
 *
 * @param {object} args
 * @param {object} args.lesson - a curriculum-shaped lesson (authored or generated)
 * @param {number} [args.maxGames]
 * @returns {object[]} game config envelopes (see module header)
 */
export function designGames({ lesson, maxGames = 3 }) {
  if (!lesson || typeof lesson !== "object") return [];
  const flashcards = Array.isArray(lesson.flashcards) ? lesson.flashcards : [];
  const quiz = Array.isArray(lesson.quiz) ? lesson.quiz : [];
  const lessonId = lesson.id ?? "lesson";
  const title = lesson.title ?? "Lesson";
  const source = { lessonId, generated: !!lesson.generated };

  const games = [];

  if (flashcards.length >= 3) {
    games.push({
      kind: GAME_KINDS.MATCHING,
      gameId: `${GAME_KINDS.MATCHING}-${lessonId}`,
      title: `Match the terms: ${title}`,
      source,
      config: matchingConfig(flashcards),
    });
  }

  if (quiz.length >= 2) {
    games.push({
      kind: GAME_KINDS.QUIZ_RUSH,
      gameId: `${GAME_KINDS.QUIZ_RUSH}-${lessonId}`,
      title: `Speed round: ${title}`,
      source,
      config: quizRushConfig(quiz),
    });
  }

  if (flashcards.length >= 1) {
    games.push({
      kind: GAME_KINDS.SRS,
      gameId: `${GAME_KINDS.SRS}-${lessonId}`,
      title: `Review deck: ${title}`,
      source,
      config: { cards: toSrsCards(flashcards) },
    });
  }

  const blanks = fillBlankItems(lesson.body, flashcards.map((f) => f.term));
  if (blanks.length >= 2) {
    games.push({
      kind: GAME_KINDS.FILL_BLANK,
      gameId: `${GAME_KINDS.FILL_BLANK}-${lessonId}`,
      title: `Fill the blank: ${title}`,
      source,
      config: { items: blanks },
    });
  }

  return games.slice(0, maxGames);
}

/**
 * Validate one game config envelope (used by the review UI and tests).
 *
 * @param {object} game
 * @returns {string[]} errors; empty when valid
 */
export function validateGameConfig(game) {
  return validateAgainst(game, GAME_CONFIG_SCHEMA);
}
