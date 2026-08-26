// The guided-lesson registry: every authored lesson, plus the mapping from
// CURRICULUM lesson ids (data/curriculum.js) to the guided lessons that
// drive them. The Dashboard looks a curriculum lesson up here to offer its
// hands-on counterpart(s); everything else (runner, checkpoints, grading)
// takes the lesson object itself.
//
// Adding a lesson: import it, add it to LESSONS, and list its id under the
// curriculum lesson(s) it teaches in CURRICULUM_MAP. createLesson() already
// validated it at import time.

import excelPivot from "./excel-pivot.js";
import excelPivotRates from "./excel-pivot-rates.js";
import excelCleaning from "./excel-cleaning.js";
import excelXlookup from "./excel-xlookup.js";
import excelLookupReverse from "./excel-lookup-reverse.js";
import excelIndexMatch from "./excel-index-match.js";
import excelIferror from "./excel-iferror.js";
import excelCountifs from "./excel-countifs.js";
import excelIfIfs from "./excel-if-ifs.js";
import excelReferences from "./excel-references.js";
import excelStats from "./excel-stats.js";
import statsRates from "./stats-rates.js";
import statsProbability from "./stats-probability.js";
import tableauDimensions from "./tableau-dimensions.js";
import tableauPills from "./tableau-pills.js";
import tableauBars from "./tableau-bars.js";
import tableauFilters from "./tableau-filters.js";
import tableauColor from "./tableau-color.js";
import tableauShowme from "./tableau-showme.js";
import tableauDashboard from "./tableau-dashboard.js";
import tableauCalc from "./tableau-calc.js";
// finalization 2026-07-17: new lessons
// (excel-sumproduct was cut: its boolean-array SUMPRODUCT relies on range=scalar
//  array comparison the sheet engine does not support — evaluate.js collapses a
//  range to a scalar, so the taught formula returns #VALUE!.)
import excelTextjoin from "./excel-textjoin.js";
import excelDates from "./excel-dates.js";
import excelFormulasGuide from "./excel-formulas-guide.js";
import tableauSize from "./tableau-size.js";
import tableauDetail from "./tableau-detail.js";
import tableauDualAxis from "./tableau-dual-axis.js";
import tableauShelvesGuide from "./tableau-shelves-guide.js";

/** Every guided lesson, in teaching order within each module.
 *
 * The order is a PREREQUISITE order, not a topical one: no lesson may hard-
 * require (via its graders) a technique introduced by a later lesson.
 * test/guide-lesson-order.test.js derives the requirement graph from the
 * lesson graders themselves and fails on any violation — the previous order
 * shipped $-pinning as a graded requirement (excel-xlookup, excel-countifs)
 * five positions before the lesson that teaches it (excel-references), and
 * put formula anatomy (excel-formulas-guide) dead last. */
export const LESSONS = [
  // excel module — foundations first: formula anatomy, then reference
  // pinning (graded in xlookup and countifs), then the lessons that use them.
  excelFormulasGuide,
  excelPivot,
  excelPivotRates,
  excelCleaning,
  excelReferences,
  excelXlookup,
  excelLookupReverse,
  excelIndexMatch,
  excelIferror,
  excelIfIfs,
  excelCountifs,
  excelTextjoin,
  excelDates,
  // stats module
  statsRates,
  excelStats,
  statsProbability,
  // tableau module
  tableauDimensions,
  tableauPills,
  tableauBars,
  tableauFilters,
  tableauColor,
  tableauShowme,
  tableauDashboard,
  tableauCalc,
  tableauSize,
  tableauDetail,
  tableauDualAxis,
  tableauShelvesGuide,
];

/**
 * Which techniques each lesson INTRODUCES (teaches from scratch), keyed by
 * lesson id. Function names as they appear in grader mustUse lists, plus
 * "abs-ref" for $-pinned references.
 *
 * This is the "taught here" side of the prerequisite graph; the "required"
 * side is derived mechanically from each lesson's graders and hints by
 * test/guide-lesson-order.test.js, which also validates THIS map against the
 * lessons (every claimed technique must actually appear in the teaching
 * lesson's own graded/hinted material, and every graded requirement must have
 * a teacher at an earlier-or-equal position) — so neither the map nor the
 * LESSONS order above can rot without a red test.
 */
export const TECHNIQUES_TAUGHT = {
  "excel-formulas-guide": ["abs-ref"],
  "excel-cleaning": ["TRIM", "UPPER", "SUBSTITUTE", "VALUE"],
  "excel-references": ["abs-ref"],
  "excel-xlookup": ["XLOOKUP"],
  "excel-lookup-reverse": ["MAX"],
  "excel-index-match": ["INDEX", "MATCH"],
  "excel-iferror": ["IFERROR"],
  "excel-if-ifs": ["IF", "IFS"],
  "excel-countifs": ["COUNTIF", "COUNTIFS", "SUMIFS"],
  "excel-textjoin": ["TEXTJOIN"],
  "excel-dates": ["DATEDIF"],
  "stats-rates": ["COUNTA"],
  "excel-stats": ["AVERAGE", "MEDIAN", "STDEV.S", "AVERAGEIF", "AVERAGEIFS", "CORREL"],
};

/** Guided-lesson id → lesson. */
export const LESSONS_BY_ID = Object.fromEntries(LESSONS.map((l) => [l.id, l]));

/**
 * Curriculum lesson id (data/curriculum.js) → guided lesson ids, in the
 * order they should be offered. Every key is a REAL curriculum lesson id;
 * the tests assert it.
 */
export const CURRICULUM_MAP = {
  // excel-1 "Pivot tables from scratch" — leads with formula anatomy: it is
  // the foundations lesson and must precede everything that grades formulas.
  "excel-1": ["excel-formulas-guide", "excel-pivot", "excel-pivot-rates", "excel-cleaning", "excel-textjoin", "excel-dates"],
  // excel-2 "XLOOKUP and INDEX/MATCH" — references first: xlookup's fill-down
  // step needs $-pinned lookup arrays, so pinning cannot arrive after it.
  "excel-2": ["excel-references", "excel-xlookup", "excel-lookup-reverse", "excel-index-match", "excel-iferror"],
  // excel-3 "Computing the four-fifths rule in Excel" — if-ifs first: the
  // countifs capstone's flag step grades an IF.
  "excel-3": ["excel-if-ifs", "excel-countifs"],
  // stats-1 "Rates, proportions, and the approval gap"
  "stats-1": ["stats-rates"],
  // stats-2 "Mean, standard deviation, and what 'normal' looks like"
  "stats-2": ["excel-stats"],
  // stats-3 "Probability basics for risk scoring"
  "stats-3": ["stats-probability"],
  // tableau-1 "Dimensions vs. measures — the core mental model"
  "tableau-1": ["tableau-dimensions", "tableau-pills", "tableau-bars", "tableau-size", "tableau-shelves-guide"],
  // tableau-2 "Building the governance dashboard"
  "tableau-2": ["tableau-filters", "tableau-color", "tableau-showme", "tableau-dashboard", "tableau-detail"],
  // tableau-3 "Calculated fields and approval rate formulas"
  "tableau-3": ["tableau-calc", "tableau-dual-axis"],
};

/**
 * Look up a guided lesson by its own id.
 * @param {string} id a guided-lesson id (e.g. "excel-pivot")
 * @returns {object|null} the lesson, or null
 */
export function getLesson(id) {
  return LESSONS_BY_ID[id] ?? null;
}

/**
 * The guided lessons attached to a curriculum lesson.
 * @param {string} curriculumLessonId a lesson id from data/curriculum.js (e.g. "excel-1")
 * @returns {Array<object>} guided lessons, possibly empty
 */
export function lessonsForCurriculumLesson(curriculumLessonId) {
  return (CURRICULUM_MAP[curriculumLessonId] ?? []).map((id) => LESSONS_BY_ID[id]).filter(Boolean);
}

/**
 * All guided lessons belonging to a curriculum module.
 * @param {string} moduleId e.g. "excel", "tableau", "stats"
 * @returns {Array<object>}
 */
export function lessonsForModule(moduleId) {
  return LESSONS.filter((l) => l.moduleId === moduleId);
}
