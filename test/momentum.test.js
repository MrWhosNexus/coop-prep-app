import { test } from "node:test";
import assert from "node:assert/strict";
import {
  XP_PER_LEVEL, DAILY_GOAL_XP,
  levelFromXp, streakMultiplier, awardXp,
  dailyProgress, evaluateAchievements, ACHIEVEMENTS, formatDuration,
} from "../lib/momentum.js";

test("levelFromXp: 0 XP is level 1 Novice", () => {
  const r = levelFromXp(0);
  assert.equal(r.level, 1);
  assert.equal(r.tierName, "Novice");
  assert.equal(r.xpInLevel, 0);
  assert.equal(r.xpForNext, XP_PER_LEVEL);
  assert.equal(r.pct, 0);
});

test("levelFromXp: crossing a level boundary", () => {
  const r = levelFromXp(260); // 250 per level → level 2, 10 into it
  assert.equal(r.level, 2);
  assert.equal(r.xpInLevel, 10);
  assert.equal(r.pct, Math.round((10 / 250) * 100));
});

test("levelFromXp: tier names by band", () => {
  assert.equal(levelFromXp(0).tierName, "Novice");        // L1
  assert.equal(levelFromXp(250 * 2).tierName, "Analyst");  // L3
  assert.equal(levelFromXp(250 * 4).tierName, "Associate");// L5
  assert.equal(levelFromXp(250 * 6).tierName, "Strategist");// L7
  assert.equal(levelFromXp(250 * 8).tierName, "Governance Lead"); // L9
});

test("streakMultiplier: scales then caps at 2.0", () => {
  assert.equal(streakMultiplier(0), 1.0);
  assert.equal(streakMultiplier(1), 1.0);
  assert.equal(streakMultiplier(3), 1.2);
  assert.equal(streakMultiplier(7), 1.6);
  assert.equal(streakMultiplier(20), 2.0); // capped
});

test("awardXp: applies multiplier and rounds", () => {
  assert.equal(awardXp(50, 0), 50);
  assert.equal(awardXp(50, 3), 60);  // 50 * 1.2
  assert.equal(awardXp(50, 20), 100); // capped 2.0
});

test("dailyProgress: same day accumulates", () => {
  const state = { daily: { date: "2026-06-16", xp: 60, lessons: 1, minutes: 0 } };
  const r = dailyProgress(state, "2026-06-16");
  assert.equal(r.earned, 60);
  assert.equal(r.goal, DAILY_GOAL_XP);
  assert.equal(r.pct, 60);
  assert.equal(r.met, false);
});

test("dailyProgress: rollover resets to 0", () => {
  const state = { daily: { date: "2026-06-15", xp: 999, lessons: 9, minutes: 0 } };
  const r = dailyProgress(state, "2026-06-16");
  assert.equal(r.earned, 0);
  assert.equal(r.met, false);
});

test("dailyProgress: met when >= goal", () => {
  const state = { daily: { date: "2026-06-16", xp: 120, lessons: 2, minutes: 0 } };
  assert.equal(dailyProgress(state, "2026-06-16").met, true);
});

test("evaluateAchievements: first-lesson + perfect-quiz", () => {
  const modules = [{ id: "m1", lessons: [{ id: "l1" }, { id: "l2" }] }];
  const state = {
    completed: { l1: true },
    quizScores: { l1: { correct: 3, total: 3 } },
    flashDone: {},
    streak: 0,
  };
  const earned = evaluateAchievements(state, modules);
  assert.ok(earned.includes("first-lesson"));
  assert.ok(earned.includes("perfect-quiz"));
  assert.ok(!earned.includes("module-master"));
});

test("evaluateAchievements: module-master + capstone + streak + cards", () => {
  const modules = [
    { id: "m1", lessons: [{ id: "l1" }] },
    { id: "m7", lessons: [{ id: "c1" }] }, // capstone is last module
  ];
  const state = {
    completed: { l1: true, c1: true },
    quizScores: {},
    flashDone: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i, true])),
    streak: 7,
  };
  const earned = evaluateAchievements(state, modules);
  assert.ok(earned.includes("module-master"));
  assert.ok(earned.includes("capstone-complete"));
  assert.ok(earned.includes("streak-7"));
  assert.ok(earned.includes("cards-20"));
});

test("ACHIEVEMENTS has metadata for every evaluated id", () => {
  const ids = ["first-lesson","module-master","perfect-quiz","streak-7","cards-20","capstone-complete"];
  for (const id of ids) assert.ok(ACHIEVEMENTS.find(a => a.id === id), `missing ${id}`);
});

test("formatDuration formats m:ss", () => {
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(65), "1:05");
  assert.equal(formatDuration(600), "10:00");
});
