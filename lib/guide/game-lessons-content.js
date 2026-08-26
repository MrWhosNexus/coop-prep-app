// Game-lesson entries authored for Haiku-F (lesson content).
//
// These entries define game-lesson sessions: the game type, module,
// objective, and configuration parameters passed to the generators
// (generateRecallDrill, generateMatchGame, generateRapidFire, etc.).
//
// The registry (game-lessons.js, owned by Sonnet-C) imports this array
// and spreads it into the full GAME_LESSONS export.

export const GAME_LESSONS = [
  {
    id: "game-excel-formulas-recall",
    game: "recall-drill",
    moduleId: "excel",
    title: "Recall: Excel formula syntax",
    objective:
      "Type formulas from memory: SUM, COUNTIF, XLOOKUP — the core moves that appear in every Excel lesson.",
    config: {
      filter: { moduleId: "excel" },
      count: 8,
    },
  },

  {
    id: "game-tableau-concepts-rapid",
    game: "rapid-fire",
    moduleId: "tableau",
    title: "Rapid-fire: Tableau shelves and pills",
    objective:
      "Multiple choice: dimensions vs measures, discrete vs continuous, shelf meanings. Recognize Tableau concepts under time.",
    config: {
      filter: { moduleId: "tableau" },
      count: 10,
    },
  },

  {
    id: "game-stats-definitions-match",
    game: "match",
    moduleId: "stats",
    title: "Match: Statistics terminology",
    objective:
      "Match statistical terms to their definitions: rate, proportion, ratio, standard deviation, normal distribution.",
    config: {
      filter: { moduleId: "stats" },
      pairs: 6,
    },
  },

  {
    id: "game-excel-four-fifths-error-hunt",
    game: "error-hunt",
    moduleId: "excel",
    title: "Error hunt: Fix the four-fifths calculator",
    objective:
      "Debug a broken Excel workbook that computes the four-fifths disparate impact test. Find the formula error and fix it.",
    config: {
      // Error hunt uses a fixed workbook structure; no conceptual filter needed.
      // The generator picks a random bug kind unless specified.
      kind: undefined, // random bug
    },
  },
];

export default GAME_LESSONS;
