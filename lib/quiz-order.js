/**
 * lib/quiz-order.js
 *
 * Deterministic option ordering for authored quizzes.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Every quiz author in this repo — human and model alike — has an unconscious
 * habit of putting the correct answer in the same slot. Measured across the 212
 * authored lesson-quiz questions:
 *
 *     SIE          A 97.6%   B  2.4%   C  0.0%   D 0.0%
 *     CFI          A  0.0%   B 94.1%   C  5.9%   D 0.0%
 *     hustle       A 85.0%   B 15.0%   C  0.0%   D 0.0%
 *     series65     A 25.9%   B 72.2%   C  1.9%   D 0.0%
 *     curriculum   A  0.0%   B 59.5%   C 40.5%   D 0.0%
 *     heart        A 30.0%   B 50.0%   C 20.0%   D 0.0%
 *
 * Position D was never the correct answer. Not once, in 212 questions. On the
 * SIE module quizzes "always pick A" scores 41/42.
 *
 * That makes the app trainable: a learner reads the tell instead of the
 * material, feels ready, then sits a real SIE where options are randomised.
 * The failure is silent and the learner cannot detect it — which is precisely
 * what makes it worth fixing at the render layer rather than by hand-editing
 * 212 questions (and then re-introducing the same bias on every future one).
 *
 * The fix: permute options deterministically from the question's own identity.
 * Stable across sessions and reloads (a learner is never confused by options
 * that move under them, and a re-read of a lesson looks the same), but
 * uncorrelated with authoring order.
 *
 * lib/exam/ already does this for exam forms (blueprint.js seeds a per-item
 * shuffle). This module covers the lesson-quiz path, which did not.
 *
 * Answers are compared by option TEXT everywhere in this codebase
 * (`opt.text === q.a`, `answers[qi] === opt.text`), never by index, so
 * reordering is safe. Do not introduce index-keyed answers without revisiting
 * this.
 */

import { makeRng, shuffle } from "./games/generators.js";

/**
 * FNV-1a over a string -> a stable 32-bit seed. Same string, same seed, on
 * every machine and every run.
 * @param {string} str
 * @returns {number}
 */
export function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministically order a quiz question's options.
 *
 * Seeded from the question text plus a caller-supplied scope (typically the
 * lesson id), so the same question renders identically every time while two
 * questions sharing wording in different lessons still diverge.
 *
 * @param {{q?: string, options?: Array<{text: string, explanation?: string}>}} question
 * @param {string} [scope] stable discriminator, e.g. the lesson id
 * @returns {Array<{text: string, explanation?: string}>} new array; input untouched
 */
export function orderedOptions(question, scope = "") {
  const options = question?.options;
  if (!Array.isArray(options) || options.length < 2) return [...(options || [])];
  return shuffle(options, makeRng(hashSeed(`${scope}::${question.q ?? ""}`)));
}

/**
 * Positional distribution of correct answers across a set of questions, as
 * fractions. The test harness uses this to assert authored content has not
 * drifted back into a positional tell.
 *
 * @param {Array<{q?: string, a?: string, options?: Array<{text: string}>}>} questions
 * @param {(question: object) => Array<{text: string}>} [order] defaults to authored order
 * @returns {{counts: number[], total: number, fractions: number[], max: number}}
 */
export function answerPositionStats(questions, order = (question) => question.options || []) {
  const counts = [];
  let total = 0;
  for (const question of questions || []) {
    const options = order(question);
    const i = options.findIndex((o) => o && o.text === question.a);
    if (i < 0) continue;
    counts[i] = (counts[i] || 0) + 1;
    total += 1;
  }
  for (let i = 0; i < counts.length; i++) counts[i] = counts[i] || 0;
  const fractions = counts.map((c) => (total ? c / total : 0));
  return { counts, total, fractions, max: fractions.length ? Math.max(...fractions) : 0 };
}
