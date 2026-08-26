import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultState, markComplete, todayISO } from "../lib/progress.js";

test("defaultState includes daily + achievements", () => {
  const s = defaultState();
  assert.deepEqual(s.daily, { date: null, xp: 0, lessons: 0, minutes: 0 });
  assert.deepEqual(s.achievements, {});
});

test("markComplete adds multiplier-aware XP and updates daily", () => {
  const today = todayISO();
  let s = defaultState();
  s = markComplete(s, "l1", 50);          // streak becomes 1 → multiplier 1.0
  assert.equal(s.completed.l1, true);
  assert.equal(s.xp, 50);
  assert.equal(s.daily.date, today);
  assert.equal(s.daily.xp, 50);
  assert.equal(s.daily.lessons, 1);
});

test("markComplete is idempotent for an already-complete lesson", () => {
  let s = defaultState();
  s = markComplete(s, "l1", 50);
  const xpAfterFirst = s.xp;
  s = markComplete(s, "l1", 50);
  assert.equal(s.xp, xpAfterFirst);
});
