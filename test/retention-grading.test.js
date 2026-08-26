// test/retention-grading.test.js
// Pins the fix for three compounding retention defects that shipped green:
//
//   1. Grade 3 (HARD) was above PASS_GRADE, but every caller passes 3 to
//      mean "shaky or wrong" -- so a card at reps=1 graded 3 earned a 6-day
//      interval, four consecutive "unsure" grades reached 23 days and
//      counted as mature, and `lapses` sat at 0 across the entire deck.
//      Being wrong scheduled the card FURTHER out.
//   2. matchAnswer's similarity >= 0.6 near-miss band accepted semantic
//      OPPOSITES ("revocable trust" for irrevocable), and masteryFromCard
//      mapped g >= 3 to correct -- typing the exact opposite promoted a
//      concept to "proficient".
//   3. MatchGame only called onGrade in its correct branch, so a miss never
//      reached the deck -- and match is the front-door game for every NEW
//      flashcard concept (generators.suggestGame).
//
// Each section asserts the CALL SITE, not just the unit: this codebase has
// repeatedly shipped code that was written, tested, and never invoked.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { useState } from "react";

import {
  GRADE, PASS_GRADE, newCard, reviewCard, defaultDeck, reviewInDeck,
} from "../lib/games/srs.js";
import {
  matchAnswer, gradeFromMatch, masteryFromCard, confusablesFor,
  CONFUSABLE_CLASSES, canonicalize, normalizeAnswer,
} from "../lib/games/scoring.js";
import { FLASHCARDS } from "../data/curriculum.js";
import { extractConcepts } from "../lib/games/generators.js";
import MatchGame from "../components/games/MatchGame.js";
import { render } from "./helpers/render.mjs";

const NOW = "2026-07-15T12:00:00.000Z";

/* ══════════════════════════════ 1. HARD is a demotion, not a pass ══ */

describe("srs: grade 3 (HARD) demotes instead of promoting", () => {
  test("PASS_GRADE sits above HARD -- 3 can never be a pass again", () => {
    // The root of the whole defect was PASS_GRADE = 3 = GRADE.HARD.
    assert.ok(GRADE.HARD < PASS_GRADE, "HARD must be below the pass bar");
  });

  test("the measured regression: reps=1 graded 3 must NOT reach a 6-day interval", () => {
    let card = reviewCard(newCard("c", { now: NOW }), GRADE.GOOD, { now: NOW });
    assert.equal(card.reps, 1);
    const after = reviewCard(card, 3, { now: card.due });
    assert.ok(after.intervalDays < 6,
      `an "unsure" grade advanced the card to ${after.intervalDays} days -- the old pass path`);
    assert.equal(after.lapses, 1, "the shakiness must be recorded in lapses");
    assert.equal(after.reps, card.reps, "HARD must not advance reps toward maturity");
    assert.ok(after.ease < card.ease, "ease still drops via the SM-2 delta");
  });

  test("four consecutive HARD grades never mature a card and all register as lapses", () => {
    // Verbatim the shipped consequence: four "I was unsure" grades reached a
    // 23-day interval, counted as mature (>= 21 days), with lapses: 0.
    let card = newCard("c", { now: NOW });
    for (let i = 0; i < 4; i++) card = reviewCard(card, 3, { now: card.due });
    assert.ok(card.intervalDays < 21,
      `four unsure grades reached ${card.intervalDays} days -- a "mature" card built on doubt`);
    assert.equal(card.lapses, 4, "every HARD is a recorded lapse");
    assert.equal(card.reps, 0, "no repetition credit accrued");
  });

  test("HARD on a learned card shrinks-or-holds the schedule rather than resetting it", () => {
    // The reason HARD is not simply AGAIN: a near miss on a learned card
    // should not wipe the interval back to 1 day.
    let card = newCard("c", { now: NOW });
    card = reviewCard(card, GRADE.GOOD, { now: NOW });
    card = reviewCard(card, GRADE.GOOD, { now: card.due });
    assert.equal(card.intervalDays, 6);
    const after = reviewCard(card, GRADE.HARD, { now: card.due });
    assert.ok(after.intervalDays > 1, "not a full reset");
    assert.ok(after.intervalDays <= Math.ceil(card.intervalDays * 1.2),
      "and no ease-driven growth either");
  });

  test("CALL SITE: gradeFromMatch's near-miss 3 flows through reviewInDeck as a lapse", () => {
    // The wiring scoring.js -> srs.js that made "wrong but close" a pass.
    // Two edits past the typo budget: close enough to be near, not correct.
    const m = matchAnswer("COUNTIFSES", "COUNTIFS", { reject: ["COUNTIF"] });
    assert.equal(m.correct, false);
    assert.equal(m.near, true);
    const g = gradeFromMatch(m);
    assert.equal(g, GRADE.HARD, "a near miss grades HARD");
    const deck = reviewInDeck(defaultDeck(), "c", g, { now: NOW });
    assert.equal(deck.c.lapses, 1, "a near-miss grade must register as a lapse in the deck");
    assert.ok(deck.c.intervalDays < 6, "and must not earn a pass interval");
  });
});

/* ══════════════════ 2. opposites are wrong, and never build mastery ══ */

describe("scoring: semantic opposites are refused regardless of spelling", () => {
  // The four verified shipped passes, each a discrimination the SIE / Series
  // 65 / a governance interview is built on.
  const SHIPPED_PASSES = [
    ["revocable trust", "irrevocable trust"],
    ["municipal bond", "corporate bond"],
    ["unlimited liability", "limited liability"],
    ["disparate treatment", "disparate impact"],
  ];

  for (const [input, answer] of SHIPPED_PASSES) {
    test(`"${input}" is never near-credited for "${answer}"`, () => {
      // Empty reject list on purpose: the round's 7 drawn peers are the only
      // thing the old code checked, and the opposite is usually not among them.
      const r = matchAnswer(input, answer, { reject: [] });
      assert.equal(r.correct, false, "the opposite must not be correct");
      assert.equal(r.near, false, "and must not be a near miss -- similarity is backwards here");
      assert.equal(r.reason, "confusable");
      assert.equal(gradeFromMatch(r), GRADE.AGAIN, "it grades AGAIN, a real lapse");
    });
  }

  test("a typo'd opposite is still the opposite", () => {
    const r = matchAnswer("revocble trust", "irrevocable trust", { reject: [] });
    assert.equal(r.correct, false);
    assert.equal(r.near, false);
    assert.equal(r.reason, "confusable");
  });

  test("a typo of the CORRECT answer is still tolerated", () => {
    // The guard must not overreach: closeness to the right member of the
    // pair remains a typo, not a confusable.
    const r = matchAnswer("irrevocabl trust", "irrevocable trust", { reject: [] });
    assert.equal(r.correct, true);
    assert.equal(r.reason, "typo");
  });

  test("synonym folding cannot smuggle an opposite through", () => {
    // "adverse impact" canonicalizes to "disparate impact" (SYNONYM_CLASSES),
    // which is the confusable opposite of "disparate treatment".
    const r = matchAnswer("adverse impact", "disparate treatment", { reject: [] });
    assert.equal(r.correct, false);
    assert.equal(r.near, false);
  });

  test("every confusable class member refuses every other member of its class", () => {
    for (const cls of CONFUSABLE_CLASSES) {
      for (const answer of cls) {
        for (const input of cls) {
          if (input === answer) continue;
          if (canonicalize(normalizeAnswer(input)) === canonicalize(normalizeAnswer(answer))) continue;
          const r = matchAnswer(input, answer, { reject: [] });
          assert.equal(r.correct, false, `"${input}" credited for "${answer}"`);
          assert.equal(r.near, false, `"${input}" near-credited for "${answer}"`);
        }
      }
    }
  });

  test("the seeded table covers the exam-critical pairs", () => {
    const conf = (t) => confusablesFor([canonicalize(normalizeAnswer(t))]);
    assert.ok(conf("irrevocable trust").has("revocable trust"));
    assert.ok(conf("corporate bond").has("municipal bond"));
    assert.ok(conf("limited liability").has("unlimited liability"));
    assert.ok(conf("disparate impact").has("disparate treatment"));
    assert.ok(conf("secured debt").has("unsecured debt"));
    assert.ok(conf("bid").has("ask"));
    assert.ok(conf("discretionary account").has("non-discretionary account"));
  });
});

describe("scoring: mastery only accrues from genuine passes", () => {
  test("a run of HARD (3) grades never reads as proficient", () => {
    // The shipped promotion path: near-missing an answer four times mapped
    // to correct evidence (g >= 3) and banded "proficient".
    let card = newCard("c", { now: NOW });
    for (let i = 0; i < 6; i++) card = reviewCard(card, 3, { now: card.due });
    const m = masteryFromCard(card, { now: card.lastReviewedAt });
    assert.ok(m.value < 0.7, `six near-wrong answers produced mastery ${m.value}`);
    assert.ok(!["proficient", "mastered"].includes(m.level),
      `six near-wrong answers banded "${m.level}"`);
  });

  test("genuine GOOD grades still reach proficiency (the bar moved, not the ceiling)", () => {
    let card = newCard("c", { now: NOW });
    for (let i = 0; i < 6; i++) card = reviewCard(card, GRADE.GOOD, { now: card.due });
    const m = masteryFromCard(card, { now: card.lastReviewedAt });
    assert.ok(["proficient", "mastered"].includes(m.level),
      `six real recalls banded "${m.level}" -- the fix overshot`);
  });

  test("CALL SITE: typing the opposite, graded and decked, cannot promote the concept", () => {
    // End to end across the three layers: matcher -> grade -> deck -> mastery.
    let deck = defaultDeck();
    for (let i = 0; i < 6; i++) {
      const r = matchAnswer("revocable trust", "irrevocable trust", { reject: [] });
      deck = reviewInDeck(deck, "trusts", gradeFromMatch(r), { now: deck.trusts?.due ?? NOW });
    }
    const m = masteryFromCard(deck.trusts, { now: deck.trusts.lastReviewedAt });
    assert.ok(!["proficient", "mastered"].includes(m.level),
      `six opposite answers banded "${m.level}"`);
    assert.ok(deck.trusts.lapses >= 6, "every one of them is a recorded lapse");
  });
});

/* ══════════════════════════ 3. MatchGame reports its misses ══ */

const CONCEPTS = extractConcepts({ flashcards: FLASHCARDS });
const POOL = CONCEPTS.slice(0, 4);

const tile = (ui, group, text) =>
  ui.findAll(`[aria-label="${group}"] button`)
    .find((b) => String(b.textContent ?? "").replace(/\s+/g, " ").trim() === text);

/** Render with guaranteed unmount -- the board runs a 90s countdown. */
async function mount(t, element) {
  const ui = await render(element);
  t.after(() => ui.unmount());
  return ui;
}

describe("MatchGame: a miss reaches the deck", () => {
  test("CALL SITE: the wrong-pick branch grades the selected term AGAIN, once", async (t) => {
    const grades = [];
    const ui = await mount(t, (
      <MatchGame
        concepts={POOL}
        pairs={POOL.length}
        seed={7}
        onGrade={(id, grade, meta) => grades.push({ id, grade, meta })}
      />
    ));

    const [missed, ...rest] = POOL;

    // Miss `missed` twice against two different wrong definitions. Before
    // the fix this recorded NOTHING: the else branch never called onGrade,
    // so a learner could flail (or time out) and the SRS card stayed blank.
    await ui.click(tile(ui, "Terms", missed.answer));
    await ui.click(tile(ui, "Definitions", rest[0].def));
    await ui.click(tile(ui, "Definitions", rest[1].def));

    const misses = grades.filter((g) => g.id === missed.id && g.grade === GRADE.AGAIN);
    assert.equal(misses.length, 1,
      `the first wrong pick must grade AGAIN exactly once (got ${misses.length}) -- ` +
      "repeat flailing on one term is one failed retrieval, not many");
    assert.equal(misses[0].meta.correct, false);

    // Solving it afterwards still files the multi-try solve as HARD.
    await ui.click(tile(ui, "Definitions", missed.def));
    const solved = grades.filter((g) => g.id === missed.id);
    assert.deepEqual(solved.map((g) => g.grade), [GRADE.AGAIN, GRADE.HARD],
      "the deck sees both the failure and the eventual shaky solve");

    // And a clean first-try pair is untouched by the fix: exactly one GOOD.
    await ui.click(tile(ui, "Terms", rest[0].answer));
    await ui.click(tile(ui, "Definitions", rest[0].def));
    assert.deepEqual(grades.filter((g) => g.id === rest[0].id).map((g) => g.grade), [GRADE.GOOD]);
  });
});

describe("a miss moves the interval in the right DIRECTION", () => {
  // The assertion whose absence let a broken fix ship green.
  //
  // The first pass at this branch used `intervalDays * 1.2`. Lapses
  // incremented, ease dropped, every existing test passed -- and a missed card
  // still walked further out on every miss (17 -> 20 -> 24 -> 29 days), which
  // is the exact defect the branch was added to remove, merely slowed down.
  // The suite could not see it because nothing asserted which WAY the interval
  // moved; it only asserted the bookkeeping around it.
  //
  // Caught by a runtime probe. This test is that probe, made permanent.
  const NOW = new Date("2026-08-26T00:00:00Z");
  const dueInDays = (card) => Math.round((new Date(card.due) - NOW) / 86400000);

  const grown = () => {
    let c = newCard("direction-probe", { now: NOW });
    for (let i = 0; i < 3; i++) c = reviewCard(c, GRADE.EASY, { now: NOW });
    return c;
  };

  test("a HARD grade shortens the interval, never lengthens it", () => {
    const before = grown();
    const after = reviewCard(before, GRADE.HARD, { now: NOW });
    assert.ok(
      after.intervalDays < before.intervalDays,
      `a miss must bring the card back SOONER: ${before.intervalDays}d -> ${after.intervalDays}d`,
    );
  });

  test("repeated misses keep shrinking, and never walk the card outward", () => {
    let c = grown();
    let prev = c.intervalDays;
    for (let i = 0; i < 4; i++) {
      c = reviewCard(c, GRADE.HARD, { now: NOW });
      assert.ok(
        c.intervalDays <= prev,
        `miss ${i + 1} lengthened the interval: ${prev}d -> ${c.intervalDays}d`,
      );
      prev = c.intervalDays;
    }
    assert.ok(dueInDays(c) <= 3, `four consecutive misses should leave the card due soon, got ${dueInDays(c)}d`);
    assert.equal(c.lapses, 4, "every miss is recorded as a lapse");
  });

  test("the interval never falls below one day", () => {
    let c = newCard("floor-probe", { now: NOW });
    for (let i = 0; i < 12; i++) c = reviewCard(c, GRADE.HARD, { now: NOW });
    assert.ok(c.intervalDays >= 1, `floor breached: ${c.intervalDays}`);
  });

  test("recovery works: a pass after misses grows the interval again", () => {
    // A card must not be permanently condemned by a bad streak.
    let c = grown();
    for (let i = 0; i < 3; i++) c = reviewCard(c, GRADE.HARD, { now: NOW });
    const bottom = c.intervalDays;
    c = reviewCard(c, GRADE.EASY, { now: NOW });
    assert.ok(c.intervalDays > bottom, `recovery should lengthen: ${bottom}d -> ${c.intervalDays}d`);
  });
});
