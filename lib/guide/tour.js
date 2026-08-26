// lib/guide/tour.js
//
// Pure data + a pure reducer for the first-run tour. No DOM access anywhere
// in this file -- IntroTour.js resolves each step's anchor to a real node
// and rect; this module only describes which anchor a step points at and
// how the walk through the steps advances.

/**
 * @typedef {Object} TourStep
 * @property {string} id
 * @property {string} [region] a data-guide-target anchor name (mutually
 *   exclusive with `selector`)
 * @property {string} [selector] a CSS selector (mutually exclusive with
 *   `region`)
 * @property {string} title
 * @property {string} body
 */

/** @type {TourStep[]} */
export const TOUR_STEPS = [
  {
    id: "welcome",
    title: "Welcome to Coop Prep",
    body: "A minute-long look at the tools, the practice games, and the voice assistant before you dive into a lesson.",
  },
  {
    id: "sheet-tool",
    region: "sheet-grid",
    title: "The spreadsheet",
    body: "Build formulas and read data here. Guided lessons walk you through it cell by cell.",
  },
  {
    id: "viz-tool",
    region: "viz-fieldlist",
    title: "The chart builder",
    body: "Drag a field from this list onto a shelf to start a chart.",
  },
  {
    id: "games",
    region: "game-prompt",
    title: "Practice games",
    body: "Timed drills turn a lesson into a game: error hunts, formula builders, matching, and more.",
  },
  {
    id: "voice",
    selector: ".nexus-voice",
    title: "Ask out loud",
    body: "The voice assistant answers questions about whatever you're working on, hands-free.",
  },
  {
    id: "wrap-up",
    title: "You're set",
    body: "Pick a module from the sidebar and start a guided lesson whenever you're ready.",
  },
];

/**
 * Normalize a step's anchor into the shape SpotlightOverlay/choreography
 * consumers expect. Returns null for a step with no anchor at all (an intro
 * or closing card, shown centered with no highlight).
 *
 * @param {TourStep} step
 * @returns {{kind:"region", anchor:string}|{kind:"selector", selector:string}|null}
 */
export function tourStepTarget(step) {
  if (!step) return null;
  if (step.region) return { kind: "region", anchor: step.region };
  if (step.selector) return { kind: "selector", selector: step.selector };
  return null;
}

/** @returns {{index:number, done:boolean}} */
export function initialTourState() {
  return { index: 0, done: false };
}

/**
 * Pure reducer driving the walk through TOUR_STEPS.
 *
 * - NEXT: advances one step; at the last step it marks the tour done instead
 *   of running past the end of the array.
 * - BACK: steps back one, floored at 0; a no-op once the tour is done (Back
 *   does not resurrect a finished tour).
 * - SKIP / FINISH: marks done immediately, from any index.
 * - RESET: back to the initial state (used when the tour reactivates).
 *
 * @param {{index:number, done:boolean}} state
 * @param {{type:string}} action
 * @returns {{index:number, done:boolean}}
 */
export function tourReducer(state, action) {
  switch (action?.type) {
    case "NEXT": {
      if (state.done) return state;
      const atEnd = state.index >= TOUR_STEPS.length - 1;
      return atEnd ? { index: state.index, done: true } : { index: state.index + 1, done: false };
    }
    case "BACK": {
      if (state.done) return state;
      const prevIndex = Math.max(0, state.index - 1);
      return prevIndex === state.index ? state : { index: prevIndex, done: false };
    }
    case "SKIP":
    case "FINISH":
      return state.done ? state : { index: state.index, done: true };
    case "RESET":
      return initialTourState();
    default:
      return state;
  }
}

/**
 * Convenience wrapper: advance one step. Equivalent to
 * `tourReducer(state, {type: "NEXT"})`.
 *
 * @param {{index:number, done:boolean}} state
 * @returns {{index:number, done:boolean}}
 */
export function nextTourStep(state) {
  return tourReducer(state, { type: "NEXT" });
}
