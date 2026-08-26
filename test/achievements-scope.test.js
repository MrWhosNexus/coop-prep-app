/**
 * test/achievements-scope.test.js
 *
 * Finding 10's residual: buildRewardAndFinal() evaluated achievements against
 * the 21-lesson core curriculum, so a learner could finish an entire SIE track
 * — six modules, dozens of lessons — and earn nothing. "Module Master" could
 * never fire on any of the 84 heart/hustle/licensing lessons the app had just
 * made navigable.
 *
 * The naive fix (pass ALL_MODULES) is a trap, and these tests pin both halves:
 * evaluateAchievements used to resolve the capstone POSITIONALLY, as
 * `modules[modules.length - 1]`. ALL_MODULES ends in a CFI module, so passing it
 * without naming the capstone would silently move "Fellowship Ready" onto a
 * financial-modeling drill — a worse bug than the one being fixed, and an
 * invisible one.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { evaluateAchievements } from "../lib/momentum.js";
import { buildRewardAndFinal } from "../lib/coop-lib.js";
import { MODULES } from "../data/curriculum.js";
import { ALL_MODULES } from "../data/registry.js";
import { SIE_MODULES } from "../data/certs/sie.js";

const CORE_CAPSTONE = MODULES[MODULES.length - 1];

/** A progress state with every lesson of `mod` completed. */
function stateWithModuleDone(mod, extra = {}) {
  const completed = {};
  for (const l of mod.lessons) completed[l.id] = true;
  return { xp: 0, completed, quizScores: {}, flashDone: {}, streak: 0, achievements: {}, ...extra };
}

describe("achievement scope", () => {
  test("the module sets really are different — the premise these tests rest on", () => {
    assert.ok(ALL_MODULES.length > MODULES.length, "ALL_MODULES should span every track");
    const coreIds = new Set(MODULES.map((m) => m.id));
    assert.ok(
      ALL_MODULES.some((m) => !coreIds.has(m.id)),
      "ALL_MODULES should contain modules outside the core curriculum",
    );
  });

  test("Module Master fires on a licensing module — the actual defect", () => {
    const sie = SIE_MODULES[0];
    const state = stateWithModuleDone(sie);

    // The old behaviour, pinned so this test provably detects the regression.
    assert.ok(
      !evaluateAchievements(state, MODULES).includes("module-master"),
      "premise: against core-only modules a completed SIE module earns nothing",
    );

    const earned = evaluateAchievements(state, ALL_MODULES, { capstoneId: CORE_CAPSTONE.id });
    assert.ok(
      earned.includes("module-master"),
      "completing an entire SIE module must earn Module Master",
    );
  });

  test("buildRewardAndFinal awards a licensing module end to end", () => {
    const sie = SIE_MODULES[0];
    const before = { xp: 0, completed: {}, quizScores: {}, flashDone: {}, streak: 0, achievements: {} };
    const after = stateWithModuleDone(sie, { xp: 50 });

    const { final, queued } = buildRewardAndFinal(before, after);

    assert.ok(final.achievements["module-master"], "Module Master must be recorded in the final state");
    assert.ok(
      queued.some((q) => q.type === "achievement" && q.achId === "module-master"),
      "the reward queue must surface the achievement to the learner",
    );
  });

  test("THE TRAP: Fellowship Ready keys off the core capstone, not whatever sorts last", () => {
    const lastOfAll = ALL_MODULES[ALL_MODULES.length - 1];

    // If this ever stops being true the trap has closed on its own; re-derive
    // rather than deleting the test.
    assert.notEqual(
      lastOfAll.id,
      CORE_CAPSTONE.id,
      "premise: ALL_MODULES does not end in the core capstone, so positional resolution is wrong",
    );

    const state = stateWithModuleDone(lastOfAll);

    // Positional resolution — the old code path — wrongly awards it.
    assert.ok(
      evaluateAchievements(state, ALL_MODULES).includes("capstone-complete"),
      "premise: resolving the capstone positionally awards Fellowship Ready for the last module of ALL_MODULES",
    );

    // Naming the capstone does not.
    assert.ok(
      !evaluateAchievements(state, ALL_MODULES, { capstoneId: CORE_CAPSTONE.id }).includes("capstone-complete"),
      `finishing ${lastOfAll.id} must NOT earn Fellowship Ready — only the core capstone does`,
    );
  });

  test("Fellowship Ready still fires on the real core capstone", () => {
    const state = stateWithModuleDone(CORE_CAPSTONE);
    const earned = evaluateAchievements(state, ALL_MODULES, { capstoneId: CORE_CAPSTONE.id });
    assert.ok(earned.includes("capstone-complete"), "completing the core capstone must earn Fellowship Ready");
  });

  test("buildRewardAndFinal does not hand Fellowship Ready to a CFI module", () => {
    const lastOfAll = ALL_MODULES[ALL_MODULES.length - 1];
    const before = { xp: 0, completed: {}, quizScores: {}, flashDone: {}, streak: 0, achievements: {} };
    const after = stateWithModuleDone(lastOfAll, { xp: 50 });

    const { final } = buildRewardAndFinal(before, after);
    assert.ok(!final.achievements["capstone-complete"], "Fellowship Ready must not fire on a non-capstone module");
  });

  test("omitting capstoneId preserves the legacy positional behaviour for core-only callers", () => {
    const state = stateWithModuleDone(CORE_CAPSTONE);
    assert.ok(
      evaluateAchievements(state, MODULES).includes("capstone-complete"),
      "existing core-only callers must keep working unchanged",
    );
  });

  test("an unknown capstoneId awards nothing rather than falling back to positional", () => {
    const state = stateWithModuleDone(ALL_MODULES[ALL_MODULES.length - 1]);
    const earned = evaluateAchievements(state, ALL_MODULES, { capstoneId: "no-such-module" });
    assert.ok(!earned.includes("capstone-complete"), "a typo'd capstone id must fail closed, not silently retarget");
  });
});
