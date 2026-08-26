// lib/guide/game-lessons.js
//
// The game-lesson registry: the parallel of lib/guide/spec.js's GuidedLesson,
// but for the drill games in lib/games/generators.js instead of the sheet/viz
// tools. A game lesson names a game kind, a curriculum module, and the config
// the existing generator for that game already accepts (generateRecallDrill,
// generateMatchGame, etc.) -- it does not reimplement any game logic.
//
// Content lives in ./game-lessons-content.js, authored separately so this
// file stays a stable scaffold. Static import (no top-level await) so the
// client bundle builds without a topLevelAwait webpack experiment.

import GAME_LESSONS_CONTENT from "./game-lessons-content.js";

/** Every game kind the registry accepts. */
export const GAME_KINDS = ["error-hunt", "formula-builder", "match", "rapid-fire", "recall-drill"];

const authoredContent = Array.isArray(GAME_LESSONS_CONTENT) ? GAME_LESSONS_CONTENT : [];

/**
 * One inline entry so the registry and its tests hold up before content
 * lands. Config mirrors what generateRecallDrill() already accepts.
 * @type {{id: string, game: string, moduleId: string, title: string, objective: string, config: object}}
 */
const EXAMPLE_ENTRY = {
  id: "recall-excel-functions",
  game: "recall-drill",
  moduleId: "excel",
  title: "Function recall drill",
  objective: "Name the Excel function for each prompt from memory.",
  config: { count: 8 },
};

/**
 * The full game-lesson registry: the inline example plus whatever
 * game-lessons-content.js supplies.
 * @type {Array<{id: string, game: string, moduleId: string, title: string, objective: string, config: object}>}
 */
export const GAME_LESSONS = [EXAMPLE_ENTRY, ...authoredContent];

/**
 * Look up a game lesson by id.
 * @param {string} id
 * @returns {object|undefined}
 */
export function getGameLesson(id) {
  return GAME_LESSONS.find((entry) => entry.id === id);
}
