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

/* ── fellowship phase model ──
   These pin `now` explicitly. The countdown originally read the real clock,
   which is why nobody noticed it freezing at 0 the day the start date passed. */
import { fellowshipPhase, daysIntoFellowship, daysUntilFellowship } from "../lib/progress.js";
import { FELLOWSHIP_START, FELLOWSHIP_END } from "../data/curriculum.js";
import { readFileSync } from "node:fs";

test("fellowshipPhase: before the start", () => {
  assert.equal(fellowshipPhase(new Date("2026-07-01T12:00:00Z")), "before");
  assert.equal(daysIntoFellowship(new Date("2026-07-01T12:00:00Z")), 0);
  assert.equal(daysUntilFellowship(FELLOWSHIP_START, new Date("2026-08-11T00:00:00Z")), 1);
});

test("fellowshipPhase: the exact start day is 'during', Day 1", () => {
  assert.equal(fellowshipPhase(new Date("2026-08-12T00:00:00Z")), "during");
  assert.equal(fellowshipPhase(new Date("2026-08-12T23:59:00Z")), "during");
  assert.equal(daysIntoFellowship(new Date("2026-08-12T09:00:00Z")), 1);
});

test("fellowshipPhase: well into the program, and past its end", () => {
  assert.equal(fellowshipPhase(new Date("2026-08-26T12:00:00Z")), "during");
  assert.equal(daysIntoFellowship(new Date("2026-08-26T12:00:00Z")), 15);
  // FELLOWSHIP_END is a real date in data/curriculum.js, so "after" is a real phase.
  assert.equal(fellowshipPhase(new Date(FELLOWSHIP_END.getTime())), "during");
  assert.equal(fellowshipPhase(new Date("2027-01-01T00:00:00Z")), "after");
  // The countdown floors at 0 rather than going negative...
  assert.equal(daysUntilFellowship(FELLOWSHIP_END, new Date("2027-01-01T00:00:00Z")), 0);
  // ...which is exactly why UI must branch on phase, not on the count alone.
});

test("the Dashboard actually consumes the phase model (call-site assertion)", () => {
  // This codebase has shipped functions that were written, tested, and never
  // invoked. Assert the sidebar/greeting really read the phase functions.
  const src = readFileSync(new URL("../components/Dashboard.js", import.meta.url), "utf8");
  assert.match(src, /lib\.fellowshipPhase\(\)/);
  assert.match(src, /lib\.daysIntoFellowship\(\)/);
  assert.match(src, /phase === "during"/);
  assert.match(src, /Day \$\{dayOf\}/);
});
