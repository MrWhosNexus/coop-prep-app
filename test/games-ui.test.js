// test/games-ui.test.js
// The first tests in this suite that render a real React component.
//
// They exist because of one shipped bug. MatchGame's board comes from a
// useMemo keyed on `concepts`. GamesTool passes onComplete={refreshSession},
// which re-plans the practice session from the SRS deck the moment a round
// ends -- so `concepts` changes identity while the RESULTS screen is still
// mounted. Without the `played` ref freeze in MatchGame, that memo
// regenerates under the results screen: a learner who just scored 6/6 sees
// six pairs they never played, every one marked wrong, filed by GameResults
// under "Worth a second look".
//
// 1915 tests were green while that shipped, because none of them rendered
// anything. scoreRound was right. generateMatchGame was right. checkMatch was
// right. The bug lived entirely in the wiring between them, which is the one
// place a pure-unit suite cannot look.
//
// These tests drive the REAL MatchGame through the REAL generators with REAL
// curriculum concepts. Reverting the `played` ref in MatchGame.js must make
// the first test fail -- if it does not, this file is certifying the defect
// rather than pinning it.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { useState } from "react";
import { FLASHCARDS } from "../data/curriculum.js";
import { extractConcepts } from "../lib/games/generators.js";
import MatchGame from "../components/games/MatchGame.js";
import { render } from "./helpers/render.mjs";

/* ══════════════════════════════════════════════════════════════════
   Fixtures come from the REAL curriculum, not hand-written stubs --
   the same rule the rest of this suite follows. Two disjoint pools of
   six, so "did the results screen switch pools?" is answerable by
   looking for pool B's text on screen.
   ══════════════════════════════════════════════════════════════════ */

const CONCEPTS = extractConcepts({ flashcards: FLASHCARDS });

/** The pool the learner PLAYS. */
const POOL_A = CONCEPTS.slice(0, 6);
/** The pool the parent re-plans TO at completion. Shares no text with A. */
const POOL_B = CONCEPTS.slice(6, 12);

// Guard the fixtures themselves: a silent overlap would make the key
// assertion below vacuous, and slicing a reordered curriculum could cause it.
const textOf = (pool) => pool.flatMap((c) => [c.answer, c.def]);
assert.equal(POOL_A.length, 6, "pool A must have 6 concepts");
assert.equal(POOL_B.length, 6, "pool B must have 6 concepts");
assert.ok(
  !textOf(POOL_B).some((t) => textOf(POOL_A).includes(t)),
  "fixture pools must be disjoint or the 'wrong pool on screen' assertion proves nothing",
);

const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/**
 * Exactly what GamesTool does: hold the pool in state, hand it to MatchGame,
 * and re-plan it on completion (`onComplete={refreshSession}`). This is the
 * parent shape that triggered the bug, not an exaggeration of it.
 */
function ReplanningParent({ onSwap }) {
  const [pool, setPool] = useState(POOL_A);
  return (
    <MatchGame
      concepts={pool}
      pairs={pool.length}
      seed={7}
      onComplete={() => { onSwap?.(); setPool(POOL_B); }}
    />
  );
}

/** Tiles, scoped to their column so a term can never be mistaken for a def. */
const tile = (ui, group, text) =>
  ui.findAll(`[aria-label="${group}"] button`).find((b) => norm(b.textContent) === text);

/**
 * Render and guarantee unmount, even when an assertion throws.
 *
 * Not hygiene theatre: MatchGame's board runs a 90s countdown, and a leaked
 * interval keeps node's event loop alive until it expires. Without this a
 * failing test takes 90 seconds to report.
 */
async function mount(t, element) {
  const ui = await render(element);
  t.after(() => ui.unmount());
  return ui;
}

/**
 * Play one pair: click the term, then its correct definition. Correctness is
 * checkMatch's rule (left conceptId === right conceptId), so matching a
 * concept's own `answer` to its own `def` is a correct move by construction.
 */
async function playPair(ui, concept) {
  const term = tile(ui, "Terms", concept.answer);
  assert.ok(term, `term tile "${concept.answer}" should be on the board`);
  await ui.click(term);

  const def = tile(ui, "Definitions", concept.def);
  assert.ok(def, `definition tile for "${concept.answer}" should be on the board`);
  await ui.click(def);
}

describe("MatchGame results survive the parent re-planning the session", () => {
  test("a perfect round reports 6/6 and never shows the re-planned pool", async (t) => {
    let swaps = 0;
    const ui = await mount(t, <ReplanningParent onSwap={() => { swaps++; }} />);

    // Sanity: we are actually playing pool A.
    assert.equal(ui.findAll('[aria-label="Terms"] button').length, 6);
    for (const c of POOL_A) {
      assert.match(ui.text(), new RegExp(escapeRe(c.answer)), `${c.answer} should be on the board`);
    }

    for (const c of POOL_A) await playPair(ui, c);

    // The round ended, and the parent swapped the pool underneath us.
    assert.equal(swaps, 1, "onComplete should fire exactly once");
    const screen = ui.text();
    assert.match(screen, /Round complete/, "should be on the results screen");

    // The score is what the learner actually did.
    assert.match(screen, /6\/6/, "should read 6/6 correct");
    assert.match(screen, /100%/, "a perfect round is 100%");

    // THE REGRESSION. A perfect round has nothing to review; if the board
    // regenerated from POOL_B, all six of its pairs read as unsolved and
    // GameResults lists them as misses.
    assert.doesNotMatch(
      screen, /Worth a second look/,
      "a perfect round must not offer a review section -- the board regenerated from the new pool",
    );
    for (const c of POOL_B) {
      assert.doesNotMatch(
        screen, new RegExp(escapeRe(c.answer)),
        `results must not mention "${c.answer}" -- it is from the re-planned pool and was never played`,
      );
    }
    assert.match(screen, /Clean round/, "a 6/6 round should be reported as clean");

  });

  test("a missed pair is reviewed with the pair that was PLAYED", async (t) => {
    // The mirror of the above: with a real miss the review is non-empty, so
    // this pins that its CONTENT is pool A's -- not merely that it is absent.
    const ui = await mount(t, <ReplanningParent />);

    const [missed, ...rest] = POOL_A;

    // Miss `missed` once: select its term, click a DIFFERENT concept's def.
    await ui.click(tile(ui, "Terms", missed.answer));
    await ui.click(tile(ui, "Definitions", rest[0].def));

    // A wrong pick leaves the term selected (pickRight only clears `sel` on a
    // correct match), so clicking its real definition now completes the pair.
    // Re-clicking the term first would DESELECT it and the next click would
    // land on a disabled tile -- which is how the board actually behaves.
    await ui.click(tile(ui, "Definitions", missed.def));

    // Then finish the rest of the board cleanly.
    for (const c of rest) await playPair(ui, c);

    const screen = ui.text();
    assert.match(screen, /Round complete/);
    // 6 correct events + 1 wrong = 7 graded attempts.
    assert.match(screen, /6\/7/, "the wrong attempt counts against the round");

    assert.match(screen, /Worth a second look/, "a missed pair should be reviewed");
    assert.match(
      screen, new RegExp(escapeRe(missed.answer)),
      "the review must name the pair that was actually missed",
    );
    for (const c of POOL_B) {
      assert.doesNotMatch(
        screen, new RegExp(escapeRe(c.answer)),
        `review must not mention "${c.answer}" from the re-planned pool`,
      );
    }

  });

  test("replaying after completion picks up the re-planned pool", async (t) => {
    // The freeze must not go too far the other way: re-planning exists so the
    // NEXT round reflects the updated deck. `replay()` clears `done`, which
    // releases the freeze.
    const ui = await mount(t, <ReplanningParent />);
    for (const c of POOL_A) await playPair(ui, c);

    await ui.click(ui.button("New round"));

    const screen = ui.text();
    assert.doesNotMatch(screen, /Round complete/, "should be back on a board");
    for (const c of POOL_B) {
      assert.match(
        screen, new RegExp(escapeRe(c.answer)),
        `the new round should be built from the re-planned pool, so "${c.answer}" should appear`,
      );
    }

  });
});

/** Escape a curriculum string for use in a RegExp. */
function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
