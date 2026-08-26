/**
 * test/srs-loop.test.js
 *
 * Finding 3: the SRS deck was written by everything and read by nothing.
 * ExamSimTool and the three grading games all fold reviews into progress.srs,
 * and ExamResults tells the learner "the M you missed come back tomorrow" —
 * but the games sampled uniformly from GAME_CONCEPTS and never consulted the
 * deck. planSession, the ONLY function that reads the deck, had no caller
 * outside test/. The missed items never resurfaced. Silently.
 *
 * Two compounding problems pinned here as well:
 *  (a) namespace — exam cards are keyed by bank item id ("sieb-cm-01") while
 *      game concepts are "quiz:<lessonId>:<i>" / "card:<slug>", so even a
 *      wired planner could not serve an exam miss without a concept for it;
 *  (b) scope — GAME_CONCEPTS was built from the CORE 21 lessons only, the
 *      exact bug already fixed for achievements, leaving the 84
 *      heart/hustle/licensing lessons feeding no practice at all.
 *
 * As with test/exam-srs-loop.test.js: these assert the WIRING. The SM-2
 * arithmetic is covered by test/games.test.js and is not re-tested here.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// data/registry.js registers the SIE bank at module load — same path the app
// takes (Dashboard imports it), so "sieb-cm-01" is resolvable here.
import "../data/registry.js";
import { ALL_MODULES } from "../data/registry.js";
import { MODULES, FLASHCARDS } from "../data/curriculum.js";
import { HEART_FLASHCARDS } from "../data/heart.js";
import { HUSTLE_FLASHCARDS } from "../data/hustle.js";
import { extractConcepts } from "../lib/games/generators.js";
import { reviewInDeck, GRADE, addDays, dayISO } from "../lib/games/srs.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dashboard = readFileSync(join(ROOT, "components/Dashboard.js"), "utf8");

/** Loaded dynamically so the source-text tests still run individually while
 *  the exports are missing (see persistence-wiring.test.js for the pattern). */
async function scopeModule() {
  return import("../components/dashboard-scope.js");
}

const NOW = Date.parse("2026-07-15T12:00:00.000Z");
const YESTERDAY = NOW - 86400000;

const poolIds = (session) =>
  new Set([...session.pools.recall, ...session.pools.match, ...session.pools.rapid].map((c) => c.id));

/** Deterministic rng so filler selection cannot flake a test. */
function seededRng(seed = 42) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe("scope: practice draws from every navigable track (Finding 3b)", () => {
  test("GAME_CONCEPTS is built from ALL_MODULES and the full flashcard DECK, not the core 21", () => {
    assert.match(
      dashboard,
      /extractConcepts\(\{\s*modules:\s*ALL_MODULES\s*,\s*flashcards:\s*DECK\s*\}\)/,
      "GAME_CONCEPTS must span core + heart + hustle + licensing — the same CORE-vs-NAV decision documented in dashboard-scope.js (practice describes the whole app, like overallProgress; it is not a readiness claim)",
    );
    assert.match(
      dashboard,
      /extractFormulas\(\{\s*modules:\s*ALL_MODULES\s*,\s*flashcards:\s*DECK\s*\}\)/,
      "Formula Builder gets the same scope",
    );
  });

  test("the wider scope is real: ALL_MODULES yields concepts core cannot", () => {
    const core = extractConcepts({ modules: MODULES, flashcards: FLASHCARDS });
    const all = extractConcepts({
      modules: ALL_MODULES,
      flashcards: [...FLASHCARDS, ...HEART_FLASHCARDS, ...HUSTLE_FLASHCARDS],
    });
    const coreIds = new Set(core.map((c) => c.id));
    const extra = all.filter((c) => !coreIds.has(c.id));
    assert.ok(extra.length > 0, "premise: the licensing/heart/hustle tracks add drillable concepts");
    assert.ok(
      extra.some((c) => c.kind === "quiz"),
      "non-core lesson quizzes must become practice concepts",
    );
  });
});

describe("the games read the deck (Finding 3)", () => {
  test("GamesTool builds its rounds from the deck, not from uniform sampling", () => {
    assert.match(
      dashboard,
      /buildPracticeSession\(\s*\{[\s\S]*?deck:\s*state\?\.srs/,
      "GamesTool must hand progress.srs to the session planner",
    );
    assert.doesNotMatch(
      dashboard,
      /<RecallDrill concepts=\{GAME_CONCEPTS\}/,
      "RecallDrill must receive the planned session pool, not the raw uniform pool",
    );
    assert.doesNotMatch(
      dashboard,
      /<MatchGame concepts=\{GAME_CONCEPTS\}/,
      "MatchGame must receive the planned session pool",
    );
    assert.doesNotMatch(
      dashboard,
      /<RapidFire concepts=\{GAME_CONCEPTS\}/,
      "RapidFire must receive the planned session pool",
    );
  });

  test("a game concept missed yesterday is served today", async () => {
    const { buildPracticeSession } = await scopeModule();
    const concepts = extractConcepts({
      modules: ALL_MODULES,
      flashcards: [...FLASHCARDS, ...HEART_FLASHCARDS, ...HUSTLE_FLASHCARDS],
    });
    const missed = concepts.find((c) => c.kind === "quiz");
    const deck = reviewInDeck({}, missed.id, GRADE.AGAIN, { now: YESTERDAY });
    assert.equal(deck[missed.id].due, dayISO(NOW), "premise: a lapse yesterday is due today");

    const session = buildPracticeSession({ concepts, deck, now: NOW, rng: seededRng() });
    assert.ok(
      poolIds(session).has(missed.id),
      `the due concept ${missed.id} must be in today's session — this is the entire point of the deck`,
    );
  });

  test("every due item is served, and rounds are still full for a new user", async () => {
    const { buildPracticeSession, PRACTICE_COUNTS } = await scopeModule();
    const concepts = extractConcepts({ modules: ALL_MODULES, flashcards: FLASHCARDS });

    // Six quiz concepts missed yesterday — all must resurface today.
    const dueIds = concepts.filter((c) => c.kind === "quiz").slice(0, 6).map((c) => c.id);
    let deck = {};
    for (const id of dueIds) deck = reviewInDeck(deck, id, GRADE.AGAIN, { now: YESTERDAY });

    const session = buildPracticeSession({ concepts, deck, now: NOW, rng: seededRng(7) });
    const served = poolIds(session);
    for (const id of dueIds) assert.ok(served.has(id), `due item ${id} must be served`);

    // Empty deck: the pools are still playable (filler keeps the games alive).
    const fresh = buildPracticeSession({ concepts, deck: {}, now: NOW, rng: seededRng(9) });
    assert.equal(fresh.pools.recall.length, PRACTICE_COUNTS.recall);
    assert.equal(fresh.pools.match.length, PRACTICE_COUNTS.match);
    assert.ok(fresh.pools.rapid.length >= PRACTICE_COUNTS.rapid, "rapid pool may carry extra card fodder but never runs short");
  });

  test("a card concept in the rapid pool always has distractor fodder", async () => {
    const { buildPracticeSession } = await scopeModule();
    const concepts = extractConcepts({ modules: ALL_MODULES, flashcards: FLASHCARDS });
    for (const seed of [1, 2, 3]) {
      const session = buildPracticeSession({ concepts, deck: {}, now: NOW, rng: seededRng(seed) });
      const cards = session.pools.rapid.filter((c) => c.kind === "card").length;
      assert.ok(
        cards === 0 || cards >= 4,
        "RapidFire draws a card's distractors from OTHER cards in its pool — a lone card there is unplayable",
      );
    }
  });
});

describe("namespace: exam misses become playable concepts (Finding 3a)", () => {
  test("bank items resolve to real concepts keyed by bank item id", async () => {
    const { examBankConcepts } = await scopeModule();
    const exam = examBankConcepts();
    const sie = exam.find((c) => c.id === "sieb-cm-01");
    assert.ok(sie, "the SIE bank must be part of the exam concept namespace");
    assert.equal(sie.kind, "quiz");
    assert.ok(sie.prompt.length > 0, "the concept must carry the question");
    assert.equal(sie.options.length, 4, "the concept must carry the authored options so RapidFire can serve it verbatim");
    assert.ok(sie.options.some((o) => o.text === sie.answer), "the answer must be among the options");
    assert.ok(exam.some((c) => c.id.startsWith("s65")), "the Series 65 bank joins the same namespace");
  });

  test("an exam question missed yesterday comes back in Practice Games — the kept promise", async () => {
    const { buildPracticeSession, examBankConcepts } = await scopeModule();
    const concepts = extractConcepts({ modules: ALL_MODULES, flashcards: FLASHCARDS });
    const examConcepts = examBankConcepts();

    // What ExamSimTool's onSrsReview does to a missed question: GRADE.AGAIN.
    const deck = reviewInDeck({}, "sieb-cm-01", GRADE.AGAIN, { now: YESTERDAY });

    const session = buildPracticeSession({ concepts, examConcepts, deck, now: NOW, rng: seededRng(3) });
    assert.ok(
      poolIds(session).has("sieb-cm-01"),
      "ExamResults says 'the ones you missed come back tomorrow' — the games must make that true",
    );
    assert.ok(
      session.pools.rapid.some((c) => c.id === "sieb-cm-01"),
      "a weak multiple-choice item belongs in Rapid Fire (recognition first — see suggestGame's ladder)",
    );
  });

  test("exam items are review-only: they never enter practice as new material", async () => {
    const { buildPracticeSession, examBankConcepts } = await scopeModule();
    const concepts = extractConcepts({ modules: ALL_MODULES, flashcards: FLASHCARDS });
    const examConcepts = examBankConcepts();
    const examIds = new Set(examConcepts.map((c) => c.id));

    const session = buildPracticeSession({ concepts, examConcepts, deck: {}, now: NOW, rng: seededRng(5) });
    for (const id of poolIds(session)) {
      assert.ok(!examIds.has(id), `exam item ${id} must not be introduced by the games — sitting the exam is how it enters the deck`);
    }
  });

  test("a not-yet-due exam item stays out of today's session", async () => {
    const { buildPracticeSession, examBankConcepts } = await scopeModule();
    const concepts = extractConcepts({ modules: ALL_MODULES, flashcards: FLASHCARDS });
    const examConcepts = examBankConcepts();

    // Answered correctly and unflagged: GOOD. First pass schedules it out a day+.
    let deck = reviewInDeck({}, "sieb-cm-02", GRADE.GOOD, { now: NOW });
    assert.ok(deck["sieb-cm-02"].due > dayISO(NOW), "premise: a pass is not due today");
    deck = reviewInDeck(deck, "sieb-cm-01", GRADE.AGAIN, { now: YESTERDAY });

    const session = buildPracticeSession({ concepts, examConcepts, deck, now: NOW, rng: seededRng(11) });
    const served = poolIds(session);
    assert.ok(served.has("sieb-cm-01"), "the due miss is served");
    assert.ok(!served.has("sieb-cm-02"), "the scheduled-out pass is not — that is what 'spaced' means");
  });
});

// Guard against addDays being tree-shaken from the import list above; it also
// documents the day math the fixtures rely on.
test("fixture sanity: yesterday's lapse is due exactly today", () => {
  assert.equal(addDays(dayISO(YESTERDAY), 1), dayISO(NOW));
});
