// Barrel module for the COOP Prep app.
// Re-exports the untouched data + pure logic, and adds the reward/action
// orchestration that ProgressContext used to own — as pure helpers, so the
// view layer stays thin and the original behaviour is preserved exactly.

export { MODULES, FLASHCARDS, FELLOWSHIP_START, FELLOWSHIP_END, FELLOWSHIP_TARGET_LABEL, INTERVIEW_QUESTIONS } from "../data/curriculum.js";
export {
  loadProgress, saveProgress, markComplete, saveQuizScore,
  daysUntilFellowship, readinessScore, todayISO, defaultState,
  toggleBookmark, addHighlight, removeHighlight,
} from "./progress.js";
export { searchCurriculum } from "./search.js";
export {
  levelFromXp, streakMultiplier, awardXp, dailyProgress,
  evaluateAchievements, formatDuration, ACHIEVEMENTS,
  XP_PER_LEVEL, DAILY_GOAL_XP,
} from "./momentum.js";

import { markComplete, saveQuizScore, todayISO } from "./progress.js";
import { levelFromXp, awardXp, evaluateAchievements } from "./momentum.js";
import { MODULES } from "../data/curriculum.js";
import { ALL_MODULES } from "../data/registry.js";

/* The fellowship capstone, named explicitly rather than resolved positionally.
   evaluateAchievements used to take the LAST module of whatever set it was
   handed; once achievements count every track (below), that set ends in a CFI
   module and "Fellowship Ready" would fire on a modeling drill. The capstone is
   and remains the core curriculum's final module. */
const CAPSTONE_MODULE_ID = MODULES[MODULES.length - 1]?.id;

let _rid = 0;

// Pure: builds reward queue + achievement-merged final state from before→after.
export function buildRewardAndFinal(before, after) {
  const beforeLevel = levelFromXp(before.xp).level;
  const afterLevel = levelFromXp(after.xp).level;
  const xpGained = after.xp - before.xp;
  const leveledUp = afterLevel > beforeLevel;

  const earnedBefore = new Set(Object.keys(before.achievements ?? {}));
  /* Every navigable module, not just the core 21 lessons: finishing an entire
     SIE track and earning nothing was Finding 10's most demoralising symptom.
     "Fellowship Ready" still keys off the core capstone by id — see above. */
  const earnedNow = evaluateAchievements(after, ALL_MODULES, { capstoneId: CAPSTONE_MODULE_ID });
  const newAchievements = earnedNow.filter((id) => !earnedBefore.has(id));

  const now = new Date().toISOString();
  const mergedAchievements = { ...(after.achievements ?? {}) };
  for (const id of earnedNow) if (!mergedAchievements[id]) mergedAchievements[id] = now;
  const final = { ...after, achievements: mergedAchievements };

  const queued = [];
  if (xpGained > 0) queued.push({ id: ++_rid, type: "xp", amount: xpGained });
  if (leveledUp) queued.push({ id: ++_rid, type: "level", level: afterLevel });
  for (const id of newAchievements) queued.push({ id: ++_rid, type: "achievement", achId: id });

  return { final, queued, reward: { xpGained, leveledUp, newAchievements } };
}

const NO_REWARD = { xpGained: 0, leveledUp: false, newAchievements: [] };

// High-level actions: take current progress, return { final, queued, reward }.
// `final` is null when nothing changed.
export function doCompleteLesson(before, id) {
  const after = markComplete(before, id, 50);
  if (after === before) return { final: null, queued: [], reward: NO_REWARD };
  return buildRewardAndFinal(before, after);
}

export function doRecordQuiz(before, id, correct, total) {
  let after = saveQuizScore(before, id, correct, total);
  if (correct === total) {
    const today = todayISO();
    const bonus = awardXp(25, before.streak);
    const daily = after.daily?.date === today
      ? { ...after.daily, xp: after.daily.xp + bonus }
      : { date: today, xp: bonus, lessons: 0, minutes: after.daily?.minutes ?? 0 };
    after = { ...after, xp: after.xp + bonus, daily };
  }
  return buildRewardAndFinal(before, after);
}

export function doMasterCard(before, idx) {
  if (before.flashDone?.[idx]) return { final: null, queued: [], reward: NO_REWARD };
  const after = { ...before, flashDone: { ...before.flashDone, [idx]: true } };
  return buildRewardAndFinal(before, after);
}

export function doAddFocusMinutes(before, min) {
  const today = todayISO();
  const daily = before.daily?.date === today
    ? { ...before.daily, minutes: before.daily.minutes + min }
    : { date: today, xp: 0, lessons: 0, minutes: min };
  return { final: { ...before, daily }, queued: [], reward: NO_REWARD };
}

export { setCoverLetterField, setCoverLetterAIResponse, clearCoverLetterAIResponse, assembleCoverLetter, defaultCoverLetterState } from "./tools/coverLetter.js";
export { hasAIKey, getAIConfig, setAIConfig, AI_PRESETS } from "./ai/config.js";
export { fillPrompt, estimateTokens, applyTokenGuard } from "./ai/fill-prompt.js";
export { sanitizeResponse } from "./ai/sanitize.js";
export { PROMPTS } from "./ai/prompts.js";
export { PILLARS } from "../data/pillars.js";
export { REGISTRY, getByPillar } from "../data/registry.js";
