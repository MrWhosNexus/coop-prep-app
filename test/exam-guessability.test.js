// test/exam-guessability.test.js
//
// A mock exam is only worth sitting if the score means something. These tests
// assert that no CONTENT-FREE strategy passes — that is, that a candidate who
// cannot read finance cannot pass by reading the item formatting instead.
//
// This is not hypothetical. Measured before the 2026-08 rewrite, picking the
// longest option scored 75.9% on the SIE bank and 80.2% on Series 65, against
// pass marks of 70% and 72%. Guessing by length passed both exams. The cause was
// an authoring habit rather than a bug: correct options were written as complete
// justified statements ("A bond ladder, designed to balance interest rate risk
// against reinvestment risk") while distractors stayed terse ("A sinking fund").
// Real exams are written to item-writing standards where option length carries
// no signal, so the tell scores 25% on test day — and the app was reporting a
// confident pass to someone who had learned a formatting artefact.
//
// The habit will come back. Every future authored item is written by the same
// kind of author (human or model) with the same instinct to justify the right
// answer and leave the wrong ones bare. So the property is pinned here rather
// than trusted to discipline.
//
// Measured through drawForm(), NOT the raw bank, because the raw bank is not
// what a learner sees. `always-A` scores 98.9% in raw bank order and 24.4% as
// presented — lib/quiz-order.js and blueprint.js's option shuffle handle
// position bias at the render layer. Testing the bank directly would report a
// catastrophic tell that does not exist, which is its own kind of false alarm.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { drawForm } from "../lib/exam/blueprint.js";
import { sieBlueprint, series65Blueprint } from "../lib/exam/banks.js";
import { SIE_BANK } from "../data/certs/sie-bank.js";
import { SERIES65_BANK } from "../data/certs/series65-bank.js";

const CHANCE = 25;

/**
 * Score a content-free strategy across several drawn forms.
 * Multiple seeds because one form is a sample, and the property is about the
 * bank, not about one draw.
 */
function strategyScore(blueprint, bank, pick, seeds = 12) {
  let hit = 0, n = 0;
  for (let s = 1; s <= seeds; s++) {
    for (const item of drawForm({ blueprint, bank, seed: `guess-probe-${s}` }).items) {
      if (pick(item.options.map((o) => o.text)) === item.correctIndex) hit++;
      n++;
    }
  }
  return { pct: (100 * hit) / n, n };
}

const longest = (t) => { let b = 0; for (let k = 1; k < t.length; k++) if (t[k].length > t[b].length) b = k; return b; };
const shortest = (t) => { let b = 0; for (let k = 1; k < t.length; k++) if (t[k].length < t[b].length) b = k; return b; };
const alwaysFirst = () => 0;

const EXAMS = [
  { name: "SIE", blueprint: sieBlueprint, bank: SIE_BANK, pass: 70 },
  { name: "Series 65", blueprint: series65Blueprint, bank: SERIES65_BANK, pass: 72 },
];

describe("no content-free strategy passes a mock exam", () => {
  for (const exam of EXAMS) {
    test(`${exam.name}: picking the longest option does not reach the pass mark`, () => {
      const { pct, n } = strategyScore(exam.blueprint(), exam.bank, longest);
      assert.ok(
        pct < exam.pass,
        `picking the longest option scores ${pct.toFixed(1)}% across ${n} questions, ` +
          `which passes the ${exam.pass}% mark. The length tell is back: correct answers are ` +
          `being authored as justified statements while distractors stay terse. Move the ` +
          `justification into the option's explanation.`,
      );
    });

    test(`${exam.name}: position is not a tell once options are shuffled`, () => {
      const { pct } = strategyScore(exam.blueprint(), exam.bank, alwaysFirst);
      assert.ok(
        Math.abs(pct - CHANCE) < 8,
        `always picking the first option scores ${pct.toFixed(1)}%, expected near ${CHANCE}%. ` +
          `The option shuffle in drawForm/quiz-order has stopped working.`,
      );
    });

    test(`${exam.name}: picking the shortest option is not a tell either`, () => {
      // The mirror failure of over-correcting: if shortening correct answers went
      // too far, "shortest" becomes the new giveaway. Both directions must stay
      // uninformative, which is why this is asserted rather than assumed.
      const { pct } = strategyScore(exam.blueprint(), exam.bank, shortest);
      assert.ok(
        pct < exam.pass,
        `picking the SHORTEST option scores ${pct.toFixed(1)}% — the rewrite over-corrected ` +
          `and inverted the tell rather than removing it.`,
      );
    });
  }

  test("the probe is not vacuous: a strategy that reads the answer key scores 100%", () => {
    // Guards against the whole file passing because drawForm returned nothing,
    // or because correctIndex stopped lining up with options.
    const bp = sieBlueprint();
    let hit = 0, n = 0;
    for (const item of drawForm({ blueprint: bp, bank: SIE_BANK, seed: "vacuity" }).items) {
      if (item.options[item.correctIndex].text === item.correctText) hit++;
      n++;
    }
    // Not a guessed constant: a faithful SIE form off this bank draws 42, because
    // drawForm honours maxFaithfulLength rather than padding out to the real
    // exam's 75. Asserting ">50" here failed against perfectly good banks — the
    // threshold was my assumption about form length, not a measurement of it.
    // Kept low and explained, so it catches "drew nothing" without re-encoding a
    // number that legitimately moves as the bank grows.
    assert.ok(n >= 30, `expected a real form, drew ${n} questions`);
    assert.equal(hit, n, "correctIndex must point at the option whose text is the correct answer");
  });
});
