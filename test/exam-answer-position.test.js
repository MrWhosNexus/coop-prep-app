/**
 * test/exam-answer-position.test.js
 *
 * Guards the ONE thing standing between the learner and a worthless exam: the
 * exam engine's per-item option shuffle.
 *
 * The banks are keyed almost entirely to slot A as AUTHORED. Measured on the real
 * registered banks: SIE 98.9% slot A across 450 items (and D is NEVER the correct
 * answer, not once); Series 65 92.1% across 780. That is not sloppiness, it is what
 * LLM-authored multiple choice does, and this repo already learned it once on the
 * lesson-quiz side (lib/quiz-order.js, test/quiz-order.test.js). The expansion made
 * it worse rather than better — the authoring prompt asked for the correct option
 * first with a "Correct — ..." explanation, so the authors complied, 410 times, and
 * the new items are 99.8% slot A against the older material's 92%.
 *
 * That is harmless ONLY because drawForm() reshuffles every item's options against a
 * seeded rng. Take the shuffle away and "always answer A" scores ~100% on a
 * full-length mock. A learner would not notice; they would just see a number that
 * flatters them, which is the specific harm this app exists to avoid.
 *
 * WHAT WAS ALREADY GUARDED, AND WHAT WAS NOT.
 *
 * test/exam.test.js has one existence check — `some(i => i.correctIndex !== 0)`,
 * "the shuffle actually moves something". That catches shuffleOptions flipping to
 * false, which is the loudest failure. It does NOT catch a shuffle that is biased or
 * degenerate: rotate every item from slot A to slot B and it passes, while "always
 * answer B" scores 100%.
 *
 * Meanwhile the real distributional machinery — a uniformity ceiling, a starved-slot
 * check, and a canary proving the guard can detect bias — existed only for the
 * LESSON layer (test/quiz-order.test.js). The exam engine is where the 99.8%-slot-A
 * bank is actually consumed and had none of it. This file closes that asymmetry,
 * against the REAL registered banks, through the REAL draw path.
 *
 * It reuses answerPositionStats() from lib/quiz-order.js rather than restating the
 * tally: a guard that reimplements the thing it guards can agree with itself while
 * both are wrong.
 */

import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { answerPositionStats } from "../lib/quiz-order.js";
import { drawForm } from "../lib/exam/blueprint.js";

const CERTS = ["sie", "series65"];
/** Enough forms that a real positional tell cannot hide in sampling noise. */
const SEEDS = 12;

let buildSession, getExam;

before(async () => {
  // data/registry.js registers the real banks (and translates SIE's section slugs).
  // Import it first, exactly as the app does — counting a raw bank instead reads zero
  // for any slug the blueprint has no alias for.
  await import("../data/registry.js");
  ({ buildSession, getExam } = await import("../lib/exam/banks.js"));
});

/** Every drawn item across SEEDS full-length mocks, shaped for answerPositionStats. */
function drawnItems(certId) {
  const items = [];
  for (let s = 0; s < SEEDS; s++) {
    const session = buildSession({ certId, mode: "mock", seed: `pos-${certId}-${s}`, now: 0 });
    for (const item of session.form.items) {
      // answerPositionStats keys on `a`; a drawn form item calls it `correctText`.
      items.push({ a: item.correctText, options: item.options });
    }
  }
  return items;
}

describe("exam engine: where the correct answer lands", () => {
  for (const certId of CERTS) {
    test(`${certId}: the authored bank IS positionally biased — the canary`, () => {
      // Without this, every assertion below could pass because the bank was already
      // uniform, and the shuffle could be a no-op that nobody notices. This proves
      // the defect is real and that the guards downstream have something to catch.
      // Mirrors test/quiz-order.test.js's authored-order canary.
      const bank = getExam(certId).bank;
      const authored = answerPositionStats(bank);
      assert.ok(
        authored.max > 0.8,
        `${certId}: expected the AUTHORED bank to be heavily slot-biased (that is the ` +
          `premise of this file); got max ${(authored.max * 100).toFixed(1)}%. If the bank has ` +
          `genuinely been re-authored to be uniform, this file's shuffle guards are no longer ` +
          `load-bearing and should be reconsidered, not deleted.`,
      );
    });

    test(`${certId}: a drawn form spreads the answer across all four positions`, () => {
      const stats = answerPositionStats(drawnItems(certId));
      assert.equal(stats.counts.length, 4, `${certId}: expected 4 option positions`);
      assert.ok(stats.total > 500, `${certId}: too few drawn items (${stats.total}) to judge distribution`);

      // Measured on the real banks: ~24-26% per slot. 0.40 leaves generous room for
      // seeded variance while still failing hard on a real tell (an unshuffled draw
      // reads ~1.00, a rotate-everything shuffle reads ~1.00 in some other slot).
      assert.ok(
        stats.max <= 0.4,
        `${certId}: the correct answer lands in one position ${(stats.max * 100).toFixed(1)}% of ` +
          `the time across ${stats.total} drawn questions — a learner who always picks that ` +
          `position scores like one who studied. Per-slot: ` +
          stats.fractions.map((f, i) => `${"ABCD"[i]}=${(f * 100).toFixed(1)}%`).join(" "),
      );

      // A shuffle can be non-uniform without pinning one slot: starving a position is
      // the same tell read from the other end ("it is never D").
      for (let i = 0; i < 4; i++) {
        assert.ok(
          stats.fractions[i] >= 0.15,
          `${certId}: position ${"ABCD"[i]} is correct only ${(stats.fractions[i] * 100).toFixed(1)}% ` +
            `of the time — a learner can safely never pick it. Per-slot: ` +
            stats.fractions.map((f, j) => `${"ABCD"[j]}=${(f * 100).toFixed(1)}%`).join(" "),
        );
      }
    });

    test(`${certId}: turning the shuffle OFF reproduces the authored bias — the guard bites`, () => {
      // The proof that the assertions above are not vacuous. This is the exact state
      // the app would be in if shuffleOptions were defaulted to false, or passed false
      // through the buildSession -> drawForm forwarding (lib/exam/banks.js), which no
      // other test exercises.
      const exam = getExam(certId);
      const form = drawForm({
        blueprint: exam.blueprint,
        bank: exam.bank,
        length: exam.blueprint.scoredQuestions,
        seed: `unshuffled-${certId}`,
        shuffleOptions: false,
      });
      const stats = answerPositionStats(form.items.map((i) => ({ a: i.correctText, options: i.options })));
      // Threshold 0.8, not 0.9: a form SAMPLES the bank, so it inherits the bias with
      // sampling variance rather than exactly. Measured — the registered banks are
      // 98.9% (SIE) and 92.1% (Series 65) slot A, and an unshuffled 130-question
      // Series 65 draw came back at 89.2%. A first pass asserted >0.9 and this test
      // failed honestly on that draw, which is the only reason the number here is
      // measured rather than assumed.
      assert.ok(
        stats.max > 0.8,
        `${certId}: expected an UNSHUFFLED draw to inherit the bank's slot-A bias (measured: SIE ` +
          `98.9%, Series 65 92.1% authored), got max ${(stats.max * 100).toFixed(1)}%. If this ever ` +
          `drops, the shuffled assertions above may be passing for a reason other than the shuffle, ` +
          `and this whole file is measuring nothing.`,
      );
    });
  }

  test("the two certs are shuffled independently, not on one shared ordering", () => {
    // Same item, different seeds, must not always land the same way — otherwise the
    // "shuffle" is a fixed permutation and the tell is merely relocated, not removed.
    const exam = getExam("sie");
    const orderings = new Set();
    for (let s = 0; s < 8; s++) {
      const form = drawForm({
        blueprint: exam.blueprint,
        bank: exam.bank,
        length: exam.blueprint.scoredQuestions,
        seed: `spread-${s}`,
      });
      const first = form.items[0];
      orderings.add(`${first.id}:${first.correctIndex}`);
    }
    assert.ok(
      orderings.size > 1,
      "across 8 seeds the drawn form never varied which position the answer took — the option " +
        "order is a fixed permutation, so the positional tell is relocated rather than removed",
    );
  });
});
