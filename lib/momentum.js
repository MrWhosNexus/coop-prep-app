// Pure gamification math. No DOM, no localStorage, no React.
// Callers pass today's ISO date so functions stay deterministic/testable.

export const XP_PER_LEVEL = 250;
export const DAILY_GOAL_XP = 100;

const TIER_BANDS = [
  { minLevel: 1, name: "Novice" },
  { minLevel: 3, name: "Analyst" },
  { minLevel: 5, name: "Associate" },
  { minLevel: 7, name: "Strategist" },
  { minLevel: 9, name: "Governance Lead" },
];

export function levelFromXp(xp) {
  const safe = Math.max(0, xp | 0);
  const level = Math.floor(safe / XP_PER_LEVEL) + 1;
  const xpInLevel = safe % XP_PER_LEVEL;
  const tierName = TIER_BANDS.reduce(
    (acc, b) => (level >= b.minLevel ? b.name : acc),
    TIER_BANDS[0].name
  );
  return {
    level,
    tierName,
    xpInLevel,
    xpForNext: XP_PER_LEVEL,
    pct: Math.round((xpInLevel / XP_PER_LEVEL) * 100),
  };
}

export function streakMultiplier(streakDays) {
  // day 0/1 → 1.0, +0.1 per consecutive day, capped 2.0
  const stepped = streakDays <= 1 ? 1.0 : 1.0 + 0.1 * (streakDays - 1);
  return Math.min(2.0, Math.round(stepped * 10) / 10);
}

export function awardXp(baseXp, streakDays) {
  return Math.round(baseXp * streakMultiplier(streakDays));
}

export function dailyProgress(state, todayISO) {
  const d = state?.daily;
  const earned = d && d.date === todayISO ? d.xp : 0;
  const pct = Math.min(100, Math.round((earned / DAILY_GOAL_XP) * 100));
  return { earned, goal: DAILY_GOAL_XP, pct, met: earned >= DAILY_GOAL_XP };
}

export const ACHIEVEMENTS = [
  { id: "first-lesson",      label: "First Steps",      desc: "Complete your first lesson" },
  { id: "module-master",     label: "Module Master",    desc: "Finish an entire module" },
  { id: "perfect-quiz",      label: "Perfect Score",    desc: "Ace a quiz with no mistakes" },
  { id: "streak-7",          label: "On Fire",          desc: "Reach a 7-day streak" },
  { id: "cards-20",          label: "Deck Cleared",     desc: "Master 20 flashcards" },
  { id: "capstone-complete", label: "Fellowship Ready", desc: "Complete the Capstone module" },
];

/**
 * @param {object} state - progress state
 * @param {Array<{id: string, lessons: Array<{id: string}>}>} modules - the module
 *   set to evaluate against. Pass every module the user can navigate, so
 *   "Module Master" can fire on any track.
 * @param {object} [opts]
 * @param {string} [opts.capstoneId] - which module is the fellowship capstone.
 *   **Pass this whenever `modules` is anything but the core curriculum.** The
 *   capstone used to be resolved positionally (`modules[modules.length - 1]`),
 *   which silently retargets the achievement onto whatever happens to sort last
 *   — with the full 31-module set that is a CFI module, so "Fellowship Ready"
 *   would fire on finishing a modeling drill. Omitting it keeps the legacy
 *   positional behaviour for existing core-only callers.
 * @returns {string[]} earned achievement ids
 */
export function evaluateAchievements(state, modules, opts = {}) {
  const completed = state?.completed ?? {};
  const quizzes = state?.quizScores ?? {};
  const flash = state?.flashDone ?? {};
  const earned = [];

  if (Object.values(completed).some(Boolean)) earned.push("first-lesson");

  const moduleDone = (m) => m.lessons.length > 0 && m.lessons.every((l) => completed[l.id]);
  if (modules.some(moduleDone)) earned.push("module-master");

  if (Object.values(quizzes).some((q) => q && q.total > 0 && q.correct >= q.total))
    earned.push("perfect-quiz");

  if ((state?.streak ?? 0) >= 7) earned.push("streak-7");

  if (Object.values(flash).filter(Boolean).length >= 20) earned.push("cards-20");

  const capstone = opts.capstoneId
    ? modules.find((m) => m.id === opts.capstoneId)
    : modules[modules.length - 1];
  if (capstone && moduleDone(capstone)) earned.push("capstone-complete");

  return earned;
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
