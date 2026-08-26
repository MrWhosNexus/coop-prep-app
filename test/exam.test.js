import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ExamError, hashSeed, normalizeBlueprint, resolveSection, allocate,
  isGradeableItem, indexBank, countBySection, maxFaithfulLength, drawForm,
  formFromItems,
} from "../lib/exam/blueprint.js";

import {
  SESSION_VERSION, EXAM_KINDS, MODES, STATUS, createSession, tick, remainingMs,
  elapsedMs, isActive, isExpired, isResumable, canPause, answerItem, clearAnswer,
  toggleFlag, goTo, nextItem, prevItem, goToItem, currentItem, pauseSession,
  resumeSession, submitSession, unansweredItemIds, flaggedItemIds,
  sessionProgress, serializeSession, deserializeSession,
} from "../lib/exam/session.js";

import { scoreSession, scoreHeadline } from "../lib/exam/scoring.js";

import {
  buildReview, missedItemIds, missedFormItems, toSrsGrades, applyReviewToDeck,
} from "../lib/exam/review.js";

import {
  sieBlueprint, series65Blueprint, resetExams, listExams, getExam, hasExam,
  registerBank, examOffering, buildSession, buildRetrySession, skillsAssessment,
} from "../lib/exam/banks.js";

import { SIE_BLUEPRINT } from "../data/certs/sie.js";
import { SERIES65_META } from "../data/certs/series65.js";
import { SERIES65_BANK } from "../data/certs/series65-bank.js";
import { GRADE, defaultDeck } from "../lib/games/srs.js";

/* ─── fixtures ─── */

/**
 * Reset the registry to its built-in state and put the real Series 65 bank
 * back — because the built-in state does not have one.
 *
 * lib/exam/banks.js seeds EVERY multiple-choice cert with an empty bank and
 * takes its content through registerBank(); data/registry.js is what attaches
 * the real banks in the app. So resetExams() reverts Series 65 to empty exactly
 * as it has always reverted SIE, and a test that resets and then wants real
 * Series 65 questions has to re-register them. That is the seam working as
 * designed, not a regression to assert around.
 *
 * These are ENGINE tests, so they re-register from SERIES65_BANK directly
 * rather than importing data/registry.js: the app-level registry is a separate
 * thing under test (test/integration.test.js owns that), and importing it here
 * would quietly couple every assertion below to it.
 *
 * Tests that are ABOUT the empty seed, or that bring their own fixture bank,
 * call resetExams() directly — those are the cases this helper would spoil.
 */
function resetExamsWithSeries65Bank() {
  resetExams();
  registerBank("series65", SERIES65_BANK);
}

const T0 = "2026-07-15T09:00:00.000Z";
const at = (minutes) => new Date(Date.parse(T0) + minutes * 60000).toISOString();

/** A tiny two-section blueprint, so the hard paths are readable. */
const TOY = normalizeBlueprint({
  id: "toy",
  name: "Toy",
  scoredQuestions: 10,
  minutes: 20,
  passPct: 70,
  sections: [
    { id: "alpha", label: "Alpha", weight: 0.6, aliases: ["a"] },
    { id: "beta", label: "Beta", weightPct: 40 },
  ],
});

/** n gradeable items in `section`, ids "<section>-1".."<section>-n". */
function makeItems(section, n, prefix = section) {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-${i + 1}`,
    section,
    q: `${section} question ${i + 1}?`,
    a: "right",
    explanation: `because ${section} ${i + 1}`,
    options: [
      { text: "right", explanation: "correct — this one is right" },
      { text: "wrong-1", explanation: "no, this is the trap" },
      { text: "wrong-2", explanation: "no, this confuses two ideas" },
      { text: "wrong-3", explanation: "no, wrong scope" },
    ],
  }));
}

const FULL_TOY_BANK = [...makeItems("alpha", 40), ...makeItems("beta", 40)];

/** Answer every item on a session, `correctRatio` of them correctly. */
function answerAll(session, correctRatio = 1, now = T0) {
  let s = session;
  session.form.items.forEach((item, i) => {
    const wantCorrect = i < Math.round(session.form.items.length * correctRatio);
    const idx = wantCorrect ? item.correctIndex : (item.correctIndex + 1) % item.options.length;
    s = answerItem(s, item.id, idx, { now });
  });
  return s;
}

/* ─── blueprint ─── */

describe("exam/blueprint: normalize + resolve", () => {
  test("normalizeBlueprint accepts weight or weightPct and is idempotent", () => {
    assert.equal(TOY.sections[0].weight, 0.6);
    assert.equal(TOY.sections[1].weight, 0.4);
    assert.equal(normalizeBlueprint(TOY), TOY);
  });

  test("rejects a blueprint that cannot produce a form", () => {
    assert.throws(() => normalizeBlueprint(null), ExamError);
    assert.throws(() => normalizeBlueprint({ id: "x", sections: [] }), ExamError);
    assert.throws(
      () => normalizeBlueprint({ id: "x", scoredQuestions: 10, passPct: 70, sections: [{ id: "a", weight: 0 }] }),
      /no usable weight/,
    );
    assert.throws(
      () => normalizeBlueprint({ id: "x", scoredQuestions: 0, passPct: 70, sections: [{ id: "a", weight: 1 }] }),
      /positive scoredQuestions/,
    );
    assert.throws(
      () => normalizeBlueprint({ id: "x", scoredQuestions: 10, passPct: 0, sections: [{ id: "a", weight: 1 }] }),
      /passPct/,
    );
    assert.throws(
      () => normalizeBlueprint({
        id: "x", scoredQuestions: 10, passPct: 70,
        sections: [{ id: "a", weight: 1 }, { id: "a", weight: 1 }],
      }),
      /duplicate section/,
    );
  });

  test("resolveSection matches id, label, or alias, and refuses to guess", () => {
    assert.equal(resolveSection(TOY, "alpha").id, "alpha");
    assert.equal(resolveSection(TOY, "Alpha").id, "alpha");
    assert.equal(resolveSection(TOY, "a").id, "alpha");
    assert.equal(resolveSection(TOY, "gamma"), null);
    assert.equal(resolveSection(TOY, undefined), null);
  });

  test("hashSeed is stable and accepts strings", () => {
    assert.equal(hashSeed("abc"), hashSeed("abc"));
    assert.notEqual(hashSeed("abc"), hashSeed("abd"));
    assert.ok(Number.isInteger(hashSeed(7)));
  });
});

describe("exam/blueprint: allocate reproduces the published section counts", () => {
  test("SIE 75 questions -> 12/33/23/7, matching SIE_BLUEPRINT.approxQuestions", () => {
    const quotas = allocate(sieBlueprint(), 75);
    assert.deepEqual(quotas, { 1: 12, 2: 33, 3: 23, 4: 7 });
    for (const s of SIE_BLUEPRINT) assert.equal(quotas[String(s.id)], s.approxQuestions);
  });

  test("Series 65 130 questions -> 20/32/39/39, matching SERIES65_META", () => {
    const quotas = allocate(series65Blueprint(), 130);
    assert.deepEqual(quotas, { economic: 20, vehicles: 32, client: 39, laws: 39 });
    for (const s of SERIES65_META.sections) assert.equal(quotas[s.id], s.approxQuestions);
  });

  test("always sums to exactly the requested total, at every length", () => {
    for (const n of [0, 1, 3, 7, 10, 13, 75, 130, 131]) {
      const sum = Object.values(allocate(series65Blueprint(), n)).reduce((a, b) => a + b, 0);
      assert.equal(sum, n, `allocate(${n}) must sum to ${n}`);
    }
  });

  test("only: a section drill allocates the whole count to that section", () => {
    assert.deepEqual(allocate(TOY, 8, { only: ["beta"] }), { beta: 8 });
    assert.deepEqual(allocate(TOY, 10, { only: ["a"] }), { alpha: 10 });
    assert.throws(() => allocate(TOY, 8, { only: ["nope"] }), /unknown section/);
  });
});

describe("exam/blueprint: bank hygiene", () => {
  test("isGradeableItem rejects an item whose answer is not one of its options", () => {
    const good = makeItems("alpha", 1)[0];
    assert.equal(isGradeableItem(good), true);
    assert.equal(isGradeableItem({ ...good, a: "not-an-option" }), false);
    assert.equal(isGradeableItem({ ...good, options: [{ text: "right" }] }), false);
    assert.equal(isGradeableItem({ ...good, id: undefined }), false);
    assert.equal(isGradeableItem(null), false);
  });

  test("indexBank quarantines ungradeable and unknown-section items instead of serving them", () => {
    const bank = [
      ...makeItems("alpha", 2),
      { ...makeItems("alpha", 1)[0], id: "broken", a: "not-an-option" },
      { ...makeItems("alpha", 1)[0], id: "lost", section: "gamma" },
    ];
    const { pool, ungradeable, unknownSection } = indexBank(TOY, bank);
    assert.equal(pool.get("alpha").length, 2);
    assert.deepEqual(ungradeable, ["broken"]);
    assert.deepEqual(unknownSection, ["lost"]);
  });

  test("countBySection / maxFaithfulLength report what a thin bank can really do", () => {
    const thin = [...makeItems("alpha", 6), ...makeItems("beta", 2)];
    assert.deepEqual(countBySection(TOY, thin), { alpha: 6, beta: 2 });
    // 60/40: a 6-question form needs 4 alpha + 2 beta, which this bank has.
    // A 7th question would need a 3rd beta, which it doesn't.
    assert.equal(maxFaithfulLength(TOY, thin), 6);
    assert.deepEqual(allocate(TOY, 6), { alpha: 4, beta: 2 });
    assert.deepEqual(allocate(TOY, 7), { alpha: 4, beta: 3 });
    assert.equal(maxFaithfulLength(TOY, []), 0);
    assert.equal(maxFaithfulLength(TOY, FULL_TOY_BANK), 10);
  });
});

describe("exam/blueprint: drawForm", () => {
  test("a full bank yields a blueprint-faithful form", () => {
    const form = drawForm({ blueprint: TOY, bank: FULL_TOY_BANK, seed: "s1" });
    assert.equal(form.faithful, true);
    assert.equal(form.length, 10);
    assert.deepEqual(form.quotas, { alpha: 6, beta: 4 });
    assert.deepEqual(form.bySection, { alpha: 6, beta: 4 });
    assert.deepEqual(form.shortfalls, []);
    assert.deepEqual(form.warnings, []);
    assert.equal(form.certId, "toy");
  });

  test("the seed genuinely makes a form reproducible — same ids, same order, same options", () => {
    const a = drawForm({ blueprint: TOY, bank: FULL_TOY_BANK, seed: "same" });
    const b = drawForm({ blueprint: TOY, bank: FULL_TOY_BANK, seed: "same" });
    assert.deepEqual(a.items, b.items);

    const c = drawForm({ blueprint: TOY, bank: FULL_TOY_BANK, seed: "different" });
    assert.notDeepEqual(a.items.map((i) => i.id), c.items.map((i) => i.id));
  });

  test("a reordered bank does not change a seeded form (the rng is the only randomness)", () => {
    const a = drawForm({ blueprint: TOY, bank: FULL_TOY_BANK, seed: 42 });
    const b = drawForm({ blueprint: TOY, bank: [...FULL_TOY_BANK].reverse(), seed: 42 });
    assert.deepEqual(a.items, b.items);
  });

  test("options are shuffled but correctIndex always points at the real answer", () => {
    const form = drawForm({ blueprint: TOY, bank: FULL_TOY_BANK, seed: "opts" });
    for (const item of form.items) {
      assert.equal(item.options[item.correctIndex].text, item.correctText);
      assert.equal(item.options.length, 4);
    }
    const unshuffled = drawForm({ blueprint: TOY, bank: FULL_TOY_BANK, seed: "opts", shuffleOptions: false });
    for (const item of unshuffled.items) assert.equal(item.correctIndex, 0);
    // The shuffle actually moves something.
    assert.ok(form.items.some((i) => i.correctIndex !== 0));
  });

  test("HARD PATH — a short bank yields a SHORT form, never an over-drawn one", () => {
    const thin = [...makeItems("alpha", 20), ...makeItems("beta", 1)];
    const form = drawForm({ blueprint: TOY, bank: thin, seed: 1 });

    assert.equal(form.faithful, false);
    assert.equal(form.requested, 10);
    assert.equal(form.length, 7, "6 alpha + the 1 beta that exists");
    // The cardinal rule: alpha did NOT grow to cover for beta.
    assert.equal(form.bySection.alpha, 6);
    assert.equal(form.bySection.beta, 1);
    assert.deepEqual(form.shortfalls, [{ section: "beta", label: "Beta", quota: 4, drawn: 1, short: 3 }]);
    assert.match(form.warnings[0], /Beta: the bank holds only 1 of the 4/);
    assert.ok(form.warnings.some((w) => /treat the score as indicative/.test(w)));
  });

  test("HARD PATH — a bank missing a section entirely still produces a usable form and says so", () => {
    const noBeta = makeItems("alpha", 20);
    const form = drawForm({ blueprint: TOY, bank: noBeta, seed: 1 });

    assert.equal(form.faithful, false);
    assert.equal(form.length, 6);
    assert.equal(form.bySection.beta, 0);
    assert.equal(form.shortfalls[0].short, 4);
    assert.ok(form.items.every((i) => i.section === "alpha"));
  });

  test("HARD PATH — an empty bank is a fact, not a crash", () => {
    const form = drawForm({ blueprint: TOY, bank: [], seed: 1 });
    assert.equal(form.length, 0);
    assert.equal(form.faithful, false);
    assert.deepEqual(form.items, []);
    assert.equal(form.shortfalls.length, 2);
    // No "treat as indicative" line for a form with nothing in it to treat.
    assert.ok(!form.warnings.some((w) => /indicative/.test(w)));
  });

  test("exclude avoids recently-seen items, but never at the cost of a quota", () => {
    const bank = [...makeItems("alpha", 8), ...makeItems("beta", 8)];
    const seen = bank.filter((i) => i.section === "alpha").slice(0, 4).map((i) => i.id);
    const form = drawForm({ blueprint: TOY, bank, seed: "ex", exclude: seen });
    const drawnAlpha = form.items.filter((i) => i.section === "alpha").map((i) => i.id);
    assert.equal(drawnAlpha.length, 6, "quota still met");
    // 4 fresh alpha exist, so exactly 2 seen ones had to be reused — the fresh ones first.
    assert.equal(drawnAlpha.filter((id) => seen.includes(id)).length, 2);

    // When enough fresh items exist, none of the excluded ones appear at all.
    const roomy = drawForm({ blueprint: TOY, bank: FULL_TOY_BANK, seed: "ex2", exclude: makeItems("alpha", 10).map((i) => i.id) });
    const reused = roomy.items.filter((i) => makeItems("alpha", 10).some((x) => x.id === i.id));
    assert.equal(reused.length, 0);
  });

  test("a section drill draws only from that section", () => {
    const form = drawForm({ blueprint: TOY, bank: FULL_TOY_BANK, seed: 1, count: 5, sections: ["beta"] });
    assert.equal(form.length, 5);
    assert.ok(form.items.every((i) => i.section === "beta"));
    assert.equal(form.faithful, true);
  });

  test("formFromItems never claims to be blueprint-faithful", () => {
    const src = drawForm({ blueprint: TOY, bank: FULL_TOY_BANK, seed: 1 });
    const form = formFromItems(src.items.slice(0, 3), TOY, { seed: "r" });
    assert.equal(form.faithful, false);
    assert.equal(form.length, 3);
    assert.match(form.warnings[0], /not comparable/);
  });
});

/* ─── session ─── */

describe("exam/session: answering, flagging, navigating", () => {
  const form = () => drawForm({ blueprint: TOY, bank: FULL_TOY_BANK, seed: "sess" });

  test("createSession is serializable, self-contained, and starts the clock", () => {
    const s = createSession({ form: form(), mode: "mock", now: T0 });
    assert.equal(s.version, SESSION_VERSION);
    assert.equal(s.kind, EXAM_KINDS.MULTIPLE_CHOICE);
    assert.equal(s.status, STATUS.ACTIVE);
    assert.equal(s.limitMs, 20 * 60000, "falls back to the blueprint's real time limit");
    assert.equal(s.elapsedMs, 0);
    assert.equal(s.certId, "toy");
    assert.ok(s.form.blueprint, "the blueprint travels with the session");
    assert.deepEqual(JSON.parse(JSON.stringify(s)), s, "plain JSON, no class instances");
  });

  test("createSession rejects a missing form or an unknown mode", () => {
    assert.throws(() => createSession({}), /needs a form/);
    assert.throws(() => createSession({ form: form(), mode: "nope" }), /unknown exam mode/);
  });

  test("answering, changing an answer, and clearing it", () => {
    let s = createSession({ form: form(), mode: "mock", now: T0 });
    const id = s.form.items[0].id;

    s = answerItem(s, id, 2, { now: T0 });
    assert.equal(s.answers[id], 2);
    assert.equal(s.integrity.answerChanges, 0);

    s = answerItem(s, id, 2, { now: T0 });
    assert.equal(s.integrity.answerChanges, 0, "re-picking the same option is not a change");

    s = answerItem(s, id, 1, { now: T0 });
    assert.equal(s.answers[id], 1);
    assert.equal(s.integrity.answerChanges, 1);

    s = clearAnswer(s, id, { now: T0 });
    assert.equal(id in s.answers, false);
    assert.equal(clearAnswer(s, id, { now: T0 }).answers[id], undefined, "clearing a blank is a no-op");
  });

  test("answering rejects a bad item or a bad option index", () => {
    const s = createSession({ form: form(), mode: "mock", now: T0 });
    assert.throws(() => answerItem(s, "nope", 0, { now: T0 }), /no such item/);
    assert.throws(() => answerItem(s, s.form.items[0].id, 9, { now: T0 }), /out of range/);
    assert.throws(() => answerItem(s, s.form.items[0].id, -1, { now: T0 }), /out of range/);
    assert.throws(() => answerItem(s, s.form.items[0].id, 1.5, { now: T0 }), /out of range/);
  });

  test("flag toggles, and survives a pause (flagging is not answering)", () => {
    let s = createSession({ form: form(), mode: "section", now: T0 });
    const id = s.form.items[0].id;
    s = toggleFlag(s, id, { now: T0 });
    assert.deepEqual(flaggedItemIds(s), [id]);
    s = pauseSession(s, { now: T0 });
    s = toggleFlag(s, s.form.items[1].id, { now: T0 });
    assert.equal(flaggedItemIds(s).length, 2);
    s = toggleFlag(s, id, { now: T0 });
    assert.equal(flaggedItemIds(s).length, 1);
    assert.throws(() => toggleFlag(s, "nope", { now: T0 }), /no such item/);
  });

  test("navigation clamps rather than throwing", () => {
    let s = createSession({ form: form(), mode: "mock", now: T0 });
    assert.equal(currentItem(s).id, s.form.items[0].id);
    s = prevItem(s, { now: T0 });
    assert.equal(s.cursor, 0);
    s = goTo(s, 999, { now: T0 });
    assert.equal(s.cursor, 9);
    s = nextItem(s, { now: T0 });
    assert.equal(s.cursor, 9);
    s = goToItem(s, s.form.items[3].id, { now: T0 });
    assert.equal(s.cursor, 3);
    assert.throws(() => goToItem(s, "nope", { now: T0 }), /no such item/);
  });

  test("sessionProgress powers a review-before-submit screen", () => {
    let s = createSession({ form: form(), mode: "mock", now: T0 });
    s = answerItem(s, s.form.items[0].id, 0, { now: T0 });
    s = toggleFlag(s, s.form.items[1].id, { now: T0 });
    const p = sessionProgress(s, at(5));
    assert.deepEqual(
      { total: p.total, answered: p.answered, unanswered: p.unanswered, flagged: p.flagged },
      { total: 10, answered: 1, unanswered: 9, flagged: 1 },
    );
    assert.equal(p.remainingMs, 15 * 60000);
    assert.equal(unansweredItemIds(s).length, 9);
  });
});

describe("exam/session: the clock", () => {
  const form = () => drawForm({ blueprint: TOY, bank: FULL_TOY_BANK, seed: "clock" });

  test("time is banked on each action, not read off a wall clock", () => {
    let s = createSession({ form: form(), mode: "mock", now: T0 });
    s = answerItem(s, s.form.items[0].id, 0, { now: at(5) });
    assert.equal(s.elapsedMs, 5 * 60000);
    s = answerItem(s, s.form.items[1].id, 0, { now: at(9) });
    assert.equal(s.elapsedMs, 9 * 60000);
    assert.equal(remainingMs(s, at(9)), 11 * 60000);
    assert.equal(elapsedMs(s, at(12)), 12 * 60000, "elapsedMs() is a read, not a write");
    assert.equal(s.elapsedMs, 9 * 60000, "…and it did not mutate the session");
  });

  test("an untimed session has no limit and never expires", () => {
    const s = createSession({ form: form(), mode: "retry", limitMs: null, now: T0 });
    assert.equal(s.limitMs, null);
    assert.equal(remainingMs(s, at(10_000)), null);
    assert.equal(isExpired(s, at(10_000)), false);
    assert.equal(sessionProgress(s, at(10_000)).status, STATUS.ACTIVE);
  });

  test("HARD PATH — an expired timer locks answering and auto-submits as timedOut", () => {
    let s = createSession({ form: form(), mode: "mock", now: T0 });
    s = answerItem(s, s.form.items[0].id, s.form.items[0].correctIndex, { now: at(5) });

    assert.equal(isExpired(s, at(21)), true);
    s = tick(s, { now: at(21) });
    assert.equal(s.status, STATUS.EXPIRED);
    assert.equal(s.elapsedMs, 20 * 60000, "the clock stops at the limit, it does not overrun");
    assert.equal(remainingMs(s, at(60)), 0);
    assert.equal(isActive(s), false);

    assert.throws(() => answerItem(s, s.form.items[1].id, 0, { now: at(22) }), /time has expired/);
    assert.throws(() => clearAnswer(s, s.form.items[0].id, { now: at(22) }), /time has expired/);
    assert.throws(() => pauseSession(s, { now: at(22) }), /time has expired/);

    s = submitSession(s, { now: at(22) });
    assert.equal(s.status, STATUS.SUBMITTED);
    assert.equal(s.timedOut, true);

    const score = scoreSession(s);
    assert.equal(score.correct, 1);
    assert.equal(score.unanswered, 9);
    assert.ok(score.caveats.some((c) => /Time expired with 9 question\(s\) unanswered/.test(c)));
  });

  test("a submitted attempt is closed for business", () => {
    let s = createSession({ form: form(), mode: "mock", now: T0 });
    s = submitSession(s, { now: at(1) });
    assert.equal(s.timedOut, false);
    assert.equal(s.runningSince, null);
    assert.equal(elapsedMs(s, at(99)), 60000, "the clock stops on submit");
    assert.throws(() => answerItem(s, s.form.items[0].id, 0, { now: at(2) }), /already submitted/);
    assert.throws(() => submitSession(s, { now: at(2) }), /already submitted/);
    assert.throws(() => resumeSession(s, { now: at(2) }), /cannot resume a submitted/);
    assert.equal(isResumable(s), false);
  });
});

describe("exam/session: pause rules", () => {
  const form = () => drawForm({ blueprint: TOY, bank: FULL_TOY_BANK, seed: "pause" });

  test("a full mock cannot be paused — test day has no pause button", () => {
    const s = createSession({ form: form(), mode: "mock", now: T0 });
    assert.equal(canPause(s), false);
    assert.throws(() => pauseSession(s, { now: at(1) }), /cannot be paused/);
    assert.throws(() => pauseSession(s, { now: at(1) }), (e) => e.code === "PAUSE_NOT_ALLOWED");
  });

  test("a section drill can pause, and the clock stops while paused", () => {
    let s = createSession({ form: form(), mode: "section", minutes: 20, now: T0 });
    assert.equal(canPause(s), true);
    s = pauseSession(s, { now: at(4) });
    assert.equal(s.status, STATUS.PAUSED);
    assert.equal(s.elapsedMs, 4 * 60000);
    assert.equal(s.integrity.pauses, 1);
    assert.equal(remainingMs(s, at(90)), 16 * 60000, "90 minutes of pause cost nothing");
    assert.throws(() => answerItem(s, s.form.items[0].id, 0, { now: at(90) }), /paused/);

    s = resumeSession(s, { now: at(90) });
    assert.equal(s.status, STATUS.ACTIVE);
    assert.equal(s.integrity.resumes, 1);
    s = answerItem(s, s.form.items[0].id, 0, { now: at(92) });
    assert.equal(s.elapsedMs, 6 * 60000, "only the 2 running minutes were added");
    assert.ok(scoreSession(submitSession(s, { now: at(92) })).caveats.some((c) => /paused 1 time/.test(c)));
  });
});

describe("exam/session: persistence and crash resume", () => {
  test("serialize -> deserialize round-trips exactly", () => {
    let s = createSession({ form: drawForm({ blueprint: TOY, bank: FULL_TOY_BANK, seed: "p" }), mode: "mock", now: T0 });
    s = answerItem(s, s.form.items[0].id, 1, { now: at(2) });
    s = toggleFlag(s, s.form.items[1].id, { now: at(3) });
    const back = deserializeSession(serializeSession(s));
    assert.deepEqual(back, s);
    assert.deepEqual(deserializeSession(JSON.parse(serializeSession(s))), s, "accepts a parsed object too");
  });

  test("deserialize refuses anything it cannot honestly restore", () => {
    const s = createSession({ form: drawForm({ blueprint: TOY, bank: FULL_TOY_BANK, seed: "p" }), mode: "mock", now: T0 });
    assert.throws(() => deserializeSession("{nope"), /not valid JSON/);
    assert.throws(() => deserializeSession(null), /empty/);
    assert.throws(() => deserializeSession({ ...s, version: 99 }), /version 99/);
    assert.throws(() => deserializeSession({ ...s, form: { items: [] } }), /no usable form/);
    assert.throws(() => deserializeSession({ ...s, status: "vibing" }), /unknown status/);
  });

  test("HARD PATH — 90 minutes into a 180-minute mock, the app dies: nothing is lost", () => {
    const bp = series65Blueprint();
    const form = drawForm({ blueprint: bp, bank: SERIES65_BANK, seed: "crash" });
    assert.equal(form.faithful, true);

    let s = createSession({ form, mode: "mock", now: T0 });
    assert.equal(s.limitMs, 180 * 60000);

    // 90 minutes of real work: 60 answered, a few flagged.
    for (let i = 0; i < 60; i++) {
      s = answerItem(s, s.form.items[i].id, s.form.items[i].correctIndex, { now: at(i * 1.5) });
    }
    s = toggleFlag(s, s.form.items[7].id, { now: at(90) });
    s = tick(s, { now: at(90) });
    assert.equal(s.elapsedMs, 90 * 60000);

    // The store's last flush is all that survives the crash.
    const saved = serializeSession(s);

    // …and the app comes back up eleven hours later.
    const restored = deserializeSession(saved);
    assert.equal(Object.keys(restored.answers).length, 60, "every answer survived");
    assert.deepEqual(restored.form.items, form.items, "the form itself survived — no bank lookup needed");

    const resumed = resumeSession(restored, { now: at(90 + 660) });
    assert.equal(resumed.status, STATUS.ACTIVE);
    assert.equal(resumed.elapsedMs, 90 * 60000, "the crash did not eat the clock");
    assert.equal(remainingMs(resumed, at(90 + 660)), 90 * 60000, "90 minutes still on the clock");
    assert.equal(resumed.integrity.resumes, 1);
    assert.equal(resumed.integrity.downtimeMs, 660 * 60000, "…but the gap is recorded, not hidden");

    // Work continues exactly where it left off.
    let s2 = answerItem(resumed, resumed.form.items[60].id, 0, { now: at(90 + 660 + 2) });
    assert.equal(s2.elapsedMs, 92 * 60000);
    assert.equal(Object.keys(s2.answers).length, 61);

    // And the interruption reaches the learner in the score, rather than
    // being quietly forgiven.
    const score = scoreSession(submitSession(s2, { now: at(90 + 660 + 2) }));
    assert.equal(score.official, false, "an interrupted attempt is not a clean test-day simulation");
    assert.ok(score.caveats.some((c) => /interrupted and resumed after about 660 minute/.test(c)));
  });

  test("resume with chargeDowntime: true honours the wall clock instead, and can expire the attempt", () => {
    let s = createSession({ form: drawForm({ blueprint: TOY, bank: FULL_TOY_BANK, seed: "strict" }), mode: "mock", now: T0 });
    s = answerItem(s, s.form.items[0].id, 0, { now: at(5) });
    const revived = resumeSession(deserializeSession(serializeSession(s)), { now: at(500), chargeDowntime: true });
    assert.equal(revived.status, STATUS.EXPIRED);
    assert.equal(revived.elapsedMs, 20 * 60000);
    assert.equal(revived.integrity.downtimeMs, 0);
  });
});

/* ─── scoring ─── */

describe("exam/scoring", () => {
  const s65 = () => drawForm({ blueprint: series65Blueprint(), bank: SERIES65_BANK, seed: "score" });

  test("a clean full-length mock is the only thing that scores as official pass/fail", () => {
    let s = createSession({ form: s65(), mode: "mock", now: T0 });
    s = answerAll(s, 1, T0);
    s = submitSession(s, { now: at(120) });

    const score = scoreSession(s);
    assert.equal(score.total, 130);
    assert.equal(score.correct, 130);
    assert.equal(score.rawPct, 100);
    assert.equal(score.official, true);
    assert.equal(score.verdict, "pass");
    assert.equal(score.passed, true);
    assert.deepEqual(score.passMark, { pct: 72, count: 94 }, "94/130 — the real Series 65 mark");
    assert.deepEqual(score.caveats, []);
    assert.equal(score.durationMs, 120 * 60000);
    assert.match(scoreHeadline(score), /PASS against a 72% mark \(94\/130 needed\)/);
  });

  test("the pass mark is computed for the form's real length", () => {
    const sie = createSession({ form: drawForm({ blueprint: sieBlueprint(), bank: [], seed: 1 }), mode: "mock", now: T0 });
    assert.equal(scoreSession(sie).passMark.count, 0, "an empty form has nothing to pass");

    let toy = createSession({ form: drawForm({ blueprint: TOY, bank: FULL_TOY_BANK, seed: "pm" }), mode: "mock", now: T0 });
    toy = submitSession(answerAll(toy, 0.7, T0), { now: at(5) });
    const score = scoreSession(toy);
    assert.deepEqual(score.passMark, { pct: 70, count: 7 });
    assert.equal(score.correct, 7);
    assert.equal(score.passed, true, "exactly on the mark is a pass");
  });

  test("scoring is honest that it does not equate a scaled score", () => {
    let s = createSession({ form: s65(), mode: "mock", now: T0 });
    s = submitSession(answerAll(s, 0.5, T0), { now: at(60) });
    const score = scoreSession(s);
    assert.equal(score.correct, 65);
    assert.equal(score.rawPct, 50);
    assert.equal(score.scaled, 50);
    assert.equal(score.scaledIsApproximate, true);
    assert.match(score.scaledNote, /IRT-equated|no equating data/);
    assert.equal(score.verdict, "fail");
  });

  test("per-section breakdown tracks quota, weight, and who is below the mark", () => {
    let s = createSession({ form: s65(), mode: "mock", now: T0 });
    // Get every "laws" item wrong, everything else right.
    s.form.items.forEach((item) => {
      const wrong = item.section === "laws";
      s = answerItem(s, item.id, wrong ? (item.correctIndex + 1) % item.options.length : item.correctIndex, { now: T0 });
    });
    s = submitSession(s, { now: at(60) });

    const score = scoreSession(s);
    const laws = score.bySection.find((x) => x.id === "laws");
    assert.deepEqual(
      { asked: laws.asked, quota: laws.quota, correct: laws.correct, incorrect: laws.incorrect, pct: laws.pct },
      { asked: 39, quota: 39, correct: 0, incorrect: 39, pct: 0 },
    );
    assert.equal(laws.belowPassMark, true);
    assert.equal(laws.weight, 0.3);
    assert.equal(score.weakest[0].id, "laws", "weakest section first");
    assert.ok(score.bySection.filter((x) => x.id !== "laws").every((x) => x.pct === 100));
    assert.equal(score.correct, 91);
    assert.equal(score.passed, false, "91/130 is below the 94 needed");
  });

  test("HARD PATH — a short form is scored, but never as a pass/fail", () => {
    const thin = [...makeItems("alpha", 20), ...makeItems("beta", 1)];
    let s = createSession({ form: drawForm({ blueprint: TOY, bank: thin, seed: 1 }), mode: "mock", now: T0 });
    s = submitSession(answerAll(s, 1, T0), { now: at(5) });

    const score = scoreSession(s);
    assert.equal(score.total, 7);
    assert.equal(score.rawPct, 100);
    assert.equal(score.passed, true, "it is still true that they got them all right…");
    assert.equal(score.official, false, "…but this was not a real form");
    assert.equal(score.verdict, "indicative");
    assert.ok(score.caveats.some((c) => /Beta was 3 question\(s\) short of its blueprint quota \(1\/4\)/.test(c)));
    assert.match(scoreHeadline(score), /indicative, not a pass\/fail result/);
  });

  test("a section drill or warmup is never presented as a pass/fail either", () => {
    let s = createSession({ form: drawForm({ blueprint: TOY, bank: FULL_TOY_BANK, seed: 1, count: 4, sections: ["beta"] }), mode: "section", minutes: 8, now: T0 });
    s = submitSession(answerAll(s, 1, T0), { now: at(2) });
    const score = scoreSession(s);
    assert.equal(score.official, false);
    assert.equal(score.verdict, "indicative");
    assert.ok(score.caveats.some((c) => /section drill, not a full mock/.test(c)));
  });

  test("an in-progress session scores provisionally, with unanswered counting as wrong", () => {
    let s = createSession({ form: drawForm({ blueprint: TOY, bank: FULL_TOY_BANK, seed: "wip" }), mode: "mock", now: T0 });
    s = answerItem(s, s.form.items[0].id, s.form.items[0].correctIndex, { now: at(1) });
    const score = scoreSession(s);
    assert.deepEqual({ correct: score.correct, unanswered: score.unanswered, incorrect: score.incorrect }, { correct: 1, unanswered: 9, incorrect: 0 });
    assert.equal(score.rawPct, 10);
    assert.equal(score.official, false);
    assert.ok(score.caveats.some((c) => /has not been submitted yet/.test(c)));
  });
});

/* ─── review ─── */

describe("exam/review", () => {
  function sat({ correctRatio = 0.5, flag = [] } = {}) {
    let s = createSession({ form: drawForm({ blueprint: TOY, bank: FULL_TOY_BANK, seed: "rev" }), mode: "mock", now: T0 });
    s = answerAll(s, correctRatio, T0);
    for (const i of flag) s = toggleFlag(s, s.form.items[i].id, { now: T0 });
    return submitSession(s, { now: at(10) });
  }

  test("every item comes back with the user's answer, the right answer, and the per-option explanations", () => {
    const review = buildReview(sat({ correctRatio: 0.5 }));
    assert.equal(review.items.length, 10);
    assert.equal(review.certId, "toy");

    const right = review.items.find((i) => i.status === "correct");
    assert.equal(right.options[right.chosenIndex].chosen, true);
    assert.equal(right.options[right.chosenIndex].isCorrect, true);
    assert.equal(right.whyWrong, "");
    assert.ok(right.explanation.length > 0);
    assert.ok(review.items.every((i) => i.options.every((o) => typeof o.explanation === "string")));
    assert.ok(review.items.every((i) => i.sectionLabel));

    // The single most valuable sentence: why the distractor they actually
    // picked was wrong.
    const wrong = review.items.find((i) => i.status === "incorrect");
    assert.equal(wrong.options[wrong.chosenIndex].isCorrect, false);
    assert.equal(wrong.whyWrong, wrong.options[wrong.chosenIndex].explanation);
    assert.match(wrong.whyWrong, /^no, /);
    assert.equal(review.missed.length, 5);
    assert.deepEqual(missedItemIds(review), review.missed.map((i) => i.id));
  });

  test("an unanswered item is missed, and has no whyWrong to show", () => {
    let s = createSession({ form: drawForm({ blueprint: TOY, bank: FULL_TOY_BANK, seed: "blank" }), mode: "mock", now: T0 });
    s = submitSession(answerItem(s, s.form.items[0].id, s.form.items[0].correctIndex, { now: T0 }), { now: at(1) });
    const review = buildReview(s);
    const blank = review.items[1];
    assert.equal(blank.status, "unanswered");
    assert.equal(blank.chosenIndex, null);
    assert.equal(blank.whyWrong, "");
    assert.equal(review.missed.length, 9);
    assert.ok(review.recommendations.some((r) => /9 question\(s\) were left blank/.test(r)));
  });

  test("weakest-section analysis names the section and what it costs", () => {
    const bp = series65Blueprint();
    let s = createSession({ form: drawForm({ blueprint: bp, bank: SERIES65_BANK, seed: "weak" }), mode: "mock", now: T0 });
    s.form.items.forEach((item) => {
      const wrong = item.section === "client";
      s = answerItem(s, item.id, wrong ? (item.correctIndex + 1) % item.options.length : item.correctIndex, { now: T0 });
    });
    s = submitSession(s, { now: at(100) });

    const review = buildReview(s);
    assert.equal(review.weakest[0].id, "client");
    assert.equal(review.weakest[0].pct, 0);
    assert.equal(review.sections.length, 4);
    assert.ok(review.recommendations.some((r) => /Client Investment Recommendations.*is your weakest section at 0%.*30% of the exam/.test(r)));
    // 130 - 39 wrong = 91 correct, against a 94 mark: 3 short.
    assert.equal(review.score.correct, 91);
    assert.ok(review.recommendations.some((r) => /3 question\(s\) short of the 72% mark/.test(r)));
  });

  test("recommendations stay honest about an indicative result and an empty form", () => {
    const thin = drawForm({ blueprint: TOY, bank: [...makeItems("alpha", 20), ...makeItems("beta", 1)], seed: 1 });
    let s = submitSession(answerAll(createSession({ form: thin, mode: "mock", now: T0 }), 1, T0), { now: at(2) });
    assert.ok(buildReview(s).recommendations.some((r) => /wasn't a full-length blueprint form/.test(r)));

    const empty = submitSession(createSession({ form: drawForm({ blueprint: TOY, bank: [], seed: 1 }), mode: "mock", now: T0 }), { now: at(1) });
    assert.deepEqual(buildReview(empty).recommendations, ["This form had no questions — there's nothing to review yet."]);
  });

  test("a clean pass is told to repeat it on a fresh seed before trusting it", () => {
    let s = createSession({ form: drawForm({ blueprint: series65Blueprint(), bank: SERIES65_BANK, seed: "pass" }), mode: "mock", now: T0 });
    s = submitSession(answerAll(s, 1, T0), { now: at(100) });
    assert.ok(buildReview(s).recommendations.some((r) => /cleared the 72% mark by 36 question\(s\)/.test(r)));
  });

  test("missed items feed lib/games/srs.js: wrong -> AGAIN, unsure-but-right -> HARD, right -> GOOD", () => {
    const session = sat({ correctRatio: 0.5, flag: [0, 9] });
    const review = buildReview(session);
    const grades = new Map(toSrsGrades(review).map((g) => [g.id, g.grade]));

    for (const item of review.items) {
      const expected = item.status !== "correct" ? GRADE.AGAIN : item.flagged ? GRADE.HARD : GRADE.GOOD;
      assert.equal(grades.get(item.id), expected);
    }
    assert.ok([...grades.values()].every((g) => g !== GRADE.EASY), "EASY is never awarded automatically");
    assert.deepEqual(toSrsGrades(session), toSrsGrades(review), "accepts a session or a review");
  });

  test("applyReviewToDeck schedules missed items for tomorrow and correct ones further out", () => {
    const review = buildReview(sat({ correctRatio: 0.5 }));
    const deck = applyReviewToDeck(defaultDeck(), review, { now: T0 });

    assert.equal(Object.keys(deck).length, 10);
    const missedCard = deck[review.missed[0].id];
    assert.equal(missedCard.due, "2026-07-16", "a missed question comes back tomorrow");
    assert.equal(missedCard.lapses, 1);

    const rightCard = deck[review.items.find((i) => i.status === "correct").id];
    assert.equal(rightCard.reps, 1);
    assert.equal(rightCard.lastGrade, GRADE.GOOD);

    // Pure: the input deck is untouched, and a second sitting builds on the first.
    const again = applyReviewToDeck(deck, review, { now: at(60 * 24) });
    assert.equal(deck[review.missed[0].id].reps, 0);
    assert.equal(again[review.items.find((i) => i.status === "correct").id].reps, 2);
  });

  test("missedFormItems returns real form items, ready to re-form", () => {
    const session = sat({ correctRatio: 0.5 });
    const items = missedFormItems(session);
    assert.equal(items.length, 5);
    assert.ok(items.every((i) => typeof i.correctIndex === "number" && Array.isArray(i.options)));
    assert.deepEqual(items.map((i) => i.id).sort(), missedItemIds(session).sort());
  });
});

/* ─── banks: the registry ─── */

describe("exam/banks: the registry", () => {
  test("the three certs are registered, and CFI is not a multiple-choice exam", () => {
    resetExams();
    const ids = listExams().map((e) => e.certId).sort();
    assert.deepEqual(ids, ["cfi", "series65", "sie"]);
    assert.equal(getExam("cfi").kind, EXAM_KINDS.SKILLS);
    assert.equal(getExam("sie").kind, EXAM_KINDS.MULTIPLE_CHOICE);
    assert.equal(hasExam("series65"), true);
    assert.equal(hasExam("series7"), false);
    assert.throws(() => getExam("series7"), /no exam registered/);
  });

  test("the SIE blueprint is read from data/certs/sie.js, not invented", () => {
    const bp = sieBlueprint();
    assert.equal(bp.scoredQuestions, 75);
    assert.equal(bp.minutes, 105);
    assert.equal(bp.passPct, 70);
    assert.deepEqual(bp.sections.map((s) => s.weight), SIE_BLUEPRINT.map((s) => s.weight));
    assert.deepEqual(bp.sections.map((s) => s.label), SIE_BLUEPRINT.map((s) => s.title));
    // Aliases come from SIE_MODULES' own blueprintSection tags, so a bank
    // tagged by module id still lands in the right section.
    assert.equal(resolveSection(bp, "sie-muni-risk").id, "2");
    assert.equal(resolveSection(bp, "packaged-options").id, "2");
    assert.equal(resolveSection(bp, "regulatory").id, "4");
  });

  test("the Series 65 blueprint is read from SERIES65_META", () => {
    const bp = series65Blueprint();
    assert.equal(bp.scoredQuestions, SERIES65_META.scoredQuestions);
    assert.equal(bp.minutes, SERIES65_META.minutesAllotted);
    assert.equal(bp.passPct, SERIES65_META.passingScore);
    assert.equal(allocate(bp, 130).client, 39);
    assert.equal(Math.ceil((bp.passPct / 100) * 130), SERIES65_META.passingCount, "94/130");
  });

  test("Series 65's real bank can fill a real full-length form", () => {
    resetExamsWithSeries65Bank();
    const offering = examOffering("series65");
    // Derived from the bank rather than hardcoded: it is still being
    // written, and this test asserts the engine reads it correctly, not
    // how many questions its author has got to.
    const counts = {};
    for (const item of SERIES65_BANK) counts[item.section] = (counts[item.section] ?? 0) + 1;

    assert.equal(offering.available, SERIES65_BANK.length, "every bank item is gradeable and lands in a known section");
    assert.equal(offering.canOfferFullForm, true);
    assert.equal(offering.maxFaithfulLength, 130);
    assert.deepEqual(offering.notes, []);
    assert.deepEqual(
      offering.sections.map((s) => ({ id: s.id, quota: s.quota, available: s.available, short: s.short })),
      [
        { id: "economic", quota: 20, available: counts.economic, short: 0 },
        { id: "vehicles", quota: 32, available: counts.vehicles, short: 0 },
        { id: "client", quota: 39, available: counts.client, short: 0 },
        { id: "laws", quota: 39, available: counts.laws, short: 0 },
      ],
    );
    assert.equal(offering.modes.find((m) => m.id === "mock").available, true);
    assert.equal(offering.modes.find((m) => m.id === "mock").faithful, true);
    assert.equal(offering.modes.find((m) => m.id === "retry").available, false, "retry needs an attempt, not a bank");
  });

  test("HARD PATH — SIE has no bank in this build: reported honestly, never crashing", () => {
    resetExams();
    const offering = examOffering("sie");
    assert.equal(offering.available, 0);
    assert.equal(offering.canOfferFullForm, false);
    assert.equal(offering.maxFaithfulLength, 0);
    assert.equal(offering.scoredQuestions, 75);
    assert.match(offering.notes[0], /No SIE questions are loaded yet.*Nothing here is broken — the bank is simply empty/);
    assert.ok(offering.modes.every((m) => m.available === false), "no mode is offered on an empty bank");
    assert.ok(offering.sections.every((s) => s.available === 0 && s.short === s.quota));

    // And building one anyway yields an empty, honest form rather than a throw.
    const s = buildSession({ certId: "sie", mode: "mock", seed: 1, now: T0 });
    assert.equal(s.form.length, 0);
    assert.equal(s.form.faithful, false);
    assert.equal(scoreSession(s).verdict, "indicative");
  });

  test("registerBank is the seam data/certs/sie-bank.js plugs into", () => {
    resetExams();
    // Shaped exactly like SERIES65_BANK, tagged the way a SIE bank would be.
    const bank = [
      ...makeItems(1, 20, "sie-1"), ...makeItems(2, 40, "sie-2"),
      ...makeItems(3, 30, "sie-3"), ...makeItems(4, 10, "sie-4"),
    ];
    const offering = registerBank("sie", bank);
    assert.equal(offering.available, 100);
    assert.equal(offering.canOfferFullForm, true);
    assert.equal(offering.maxFaithfulLength, 75);
    assert.deepEqual(offering.notes, []);

    const s = buildSession({ certId: "sie", mode: "mock", seed: "sie-1", now: T0 });
    assert.equal(s.form.length, 75);
    assert.equal(s.form.faithful, true);
    assert.deepEqual(s.form.bySection, { 1: 12, 2: 33, 3: 23, 4: 7 }, "the real SIE distribution");
    assert.equal(s.limitMs, 105 * 60000);
    resetExams();
    assert.equal(examOffering("sie").available, 0, "resetExams puts the empty bank back");
  });

  test("HARD PATH — a bank too thin for a full form gets a short one, clearly labelled", () => {
    resetExams();
    registerBank("sie", [...makeItems(1, 20, "sie-1"), ...makeItems(2, 40, "sie-2"), ...makeItems(3, 30, "sie-3")]);
    const offering = examOffering("sie");
    assert.equal(offering.canOfferFullForm, false);
    // 6 is the longest form whose blueprint rounding legitimately asks for
    // zero regulatory questions (9% of 6 rounds to 0). Past that, the
    // missing section starts costing real questions.
    assert.equal(offering.maxFaithfulLength, 6);
    assert.ok(offering.notes.some((n) => /Overview of Regulatory Framework has no questions in the bank at all, and it is 9% of the real exam/.test(n)));
    // A mock can still be offered — it just can't be offered as a real one.
    assert.equal(offering.modes.find((m) => m.id === "mock").available, true);
    assert.equal(offering.modes.find((m) => m.id === "mock").faithful, false);
    assert.equal(offering.modes.find((m) => m.id === "warmup").available, false, "even 10 questions can't be drawn to weight without section 4");

    const s = buildSession({ certId: "sie", mode: "mock", seed: 1, now: T0 });
    assert.equal(s.form.length, 68, "75 minus the 7 regulatory questions that do not exist");
    assert.equal(s.form.bySection[2], 33, "section 2 did NOT grow to cover for section 4");
    assert.equal(s.limitMs, 95 * 60000, "the clock follows the form we could draw, not the one we wanted");
    assert.equal(scoreSession(s).verdict, "indicative");
    resetExams();
  });

  test("registerBank validates its input and refuses a skills credential", () => {
    resetExams();
    assert.throws(() => registerBank("sie", "not an array"), /must be an array/);
    assert.throws(() => registerBank("cfi", []), /has no question bank/);
    assert.throws(() => registerBank("nope", []), /no exam registered/);
  });
});

describe("exam/banks: buildSession modes", () => {
  test("mock — full length, real clock, no pause", () => {
    resetExamsWithSeries65Bank();
    const s = buildSession({ certId: "series65", mode: "mock", seed: "m1", now: T0 });
    assert.equal(s.mode, "mock");
    assert.equal(s.form.length, 130);
    assert.equal(s.form.faithful, true);
    assert.equal(s.limitMs, 180 * 60000, "the real 180 minutes");
    assert.equal(canPause(s), false);
    assert.equal(MODES.mock.pausable, false);
  });

  test("the seed makes a whole sitting reproducible", () => {
    resetExamsWithSeries65Bank();
    const a = buildSession({ certId: "series65", mode: "mock", seed: "repro", now: T0 });
    const b = buildSession({ certId: "series65", mode: "mock", seed: "repro", now: T0 });
    assert.deepEqual(a.form.items, b.form.items);
    assert.notDeepEqual(
      a.form.items.map((i) => i.id),
      buildSession({ certId: "series65", mode: "mock", seed: "other", now: T0 }).form.items.map((i) => i.id),
    );
  });

  test("warmup — 10 blueprint-weighted questions on a proportional clock", () => {
    resetExamsWithSeries65Bank();
    const s = buildSession({ certId: "series65", mode: "warmup", seed: "w", now: T0 });
    assert.equal(s.form.length, 10);
    assert.deepEqual(s.form.bySection, { economic: 2, vehicles: 2, client: 3, laws: 3 });
    assert.equal(s.form.faithful, true);
    assert.equal(s.limitMs, 14 * 60000, "180/130 per question, rounded");
    assert.equal(canPause(s), true);
  });

  test("section — one section, its real share of a form, on a proportional clock", () => {
    resetExamsWithSeries65Bank();
    const s = buildSession({ certId: "series65", mode: "section", sectionId: "laws", seed: "d", now: T0 });
    assert.equal(s.form.length, 39, "laws' real share of a 130-question form");
    assert.ok(s.form.items.every((i) => i.section === "laws"));
    assert.equal(s.limitMs, 54 * 60000);
    assert.equal(canPause(s), true);

    const short = buildSession({ certId: "series65", mode: "section", sectionId: "economic", count: 5, seed: "d", now: T0 });
    assert.equal(short.form.length, 5);

    assert.throws(() => buildSession({ certId: "series65", mode: "section", seed: 1 }), /needs a sectionId/);
    assert.throws(() => buildSession({ certId: "series65", mode: "section", sectionId: "nope", seed: 1 }), /unknown section/);
  });

  test("exclude threads recently-seen items through to the draw", () => {
    resetExamsWithSeries65Bank();
    const first = buildSession({ certId: "series65", mode: "warmup", seed: "e1", now: T0 });
    const seen = first.form.items.map((i) => i.id);
    const second = buildSession({ certId: "series65", mode: "warmup", seed: "e1", exclude: seen, now: T0 });
    assert.equal(second.form.items.filter((i) => seen.includes(i.id)).length, 0, "same seed, but nothing repeats");
    assert.equal(second.form.length, 10);
  });

  test("retry — built from a previous attempt, untimed, never comparable to a mock", () => {
    resetExamsWithSeries65Bank();
    let s = buildSession({ certId: "series65", mode: "warmup", seed: "r", now: T0 });
    s = submitSession(answerAll(s, 0.5, T0), { now: at(5) });

    assert.throws(() => buildSession({ certId: "series65", mode: "retry", seed: 1 }), /built from a previous attempt/);

    const retry = buildRetrySession(s, { now: at(10) });
    assert.equal(retry.mode, "retry");
    assert.equal(retry.limitMs, null, "untimed — this one is for learning");
    assert.equal(retry.form.faithful, false);
    assert.equal(retry.form.length, 5);
    assert.deepEqual(retry.form.items.map((i) => i.id).sort(), missedItemIds(s).sort());
    assert.equal(canPause(retry), true);
    assert.equal(scoreSession(retry).verdict, "indicative");

    // Ace the retry, and there is nothing left to retry.
    const done = submitSession(answerAll(retry, 1, at(10)), { now: at(12) });
    assert.throws(() => buildRetrySession(done), /nothing to retry/);
  });

  test("buildSession rejects unknown certs and modes", () => {
    resetExams();
    assert.throws(() => buildSession({ certId: "series7" }), /no exam registered/);
    assert.throws(() => buildSession({ certId: "series65", mode: "vibes" }), /unknown exam mode/);
  });
});

describe("exam/banks: CFI is a skills credential, not a form", () => {
  test("it refuses to be drawn as a multiple-choice exam", () => {
    resetExams();
    assert.throws(() => buildSession({ certId: "cfi", mode: "mock" }), /skills credential/);
    assert.throws(() => buildSession({ certId: "cfi", mode: "mock" }), (e) => e.code === "NOT_MULTIPLE_CHOICE");
  });

  test("skillsAssessment describes the drills and defers grading to lib/guide", () => {
    resetExams();
    const a = skillsAssessment("cfi");
    assert.equal(a.kind, EXAM_KINDS.SKILLS);
    assert.equal(a.gradedBy, "lib/guide");
    assert.equal(a.drills.length, 7);
    assert.ok(a.totalMinutes > 0);
    assert.ok(a.drills.every((d) => d.id && d.title && d.moduleId && d.scenario));
    assert.match(a.note, /not a proctored multiple-choice exam/);
    assert.equal(skillsAssessment().certId, "cfi", "defaults to cfi");
    assert.throws(() => skillsAssessment("series65"), /multiple-choice exam/);
  });

  test("its offering reports drills, not questions", () => {
    resetExams();
    const o = examOffering("cfi");
    assert.equal(o.kind, EXAM_KINDS.SKILLS);
    assert.equal(o.drills, 7);
    assert.equal(o.canOfferFullForm, false);
    assert.deepEqual(o.modes, [], "no multiple-choice mode applies");
  });
});

/* ─── end to end ─── */

describe("exam: a full Series 65 sitting, end to end", () => {
  test("draw -> answer -> crash -> resume -> submit -> review -> srs", () => {
    resetExamsWithSeries65Bank();
    let s = buildSession({ certId: "series65", mode: "mock", seed: "e2e", now: T0 });
    assert.equal(s.form.length, 130);

    // Answer 100, getting 80 right; flag two.
    s.form.items.slice(0, 100).forEach((item, i) => {
      const idx = i < 80 ? item.correctIndex : (item.correctIndex + 1) % item.options.length;
      s = answerItem(s, item.id, idx, { now: at(i) });
    });
    s = toggleFlag(s, s.form.items[3].id, { now: at(100) });

    // Crash and come back.
    s = resumeSession(deserializeSession(serializeSession(s)), { now: at(200) });
    assert.equal(Object.keys(s.answers).length, 100);

    // Finish the last 30 correctly and run out of time on nothing.
    s.form.items.slice(100).forEach((item) => { s = answerItem(s, item.id, item.correctIndex, { now: at(200) }); });
    s = submitSession(s, { now: at(210) });

    const review = buildReview(s);
    assert.equal(review.score.correct, 110);
    assert.equal(review.score.total, 130);
    assert.equal(review.score.passed, true, "110 >= 94");
    assert.equal(review.score.official, false, "…but it was interrupted, so it is not a clean simulation");
    assert.equal(review.missed.length, 20);
    assert.ok(review.missed.every((i) => i.whyWrong.length > 0), "every miss explains the distractor that was picked");
    assert.equal(review.score.bySection.reduce((a, x) => a + x.asked, 0), 130);

    const deck = applyReviewToDeck(defaultDeck(), review, { now: T0 });
    assert.equal(Object.keys(deck).length, 130);
    // 20 misses (AGAIN) plus the flagged-but-correct item (HARD): a guess
    // that happened to land is not a demonstrated recall, and it must show
    // up in `lapses` -- the old pass-at-3 mapping left lapses at 0 across
    // the whole deck, hiding every chronically shaky concept.
    assert.equal(Object.values(deck).filter((c) => c.lapses === 1).length, 21, "20 misses plus the flagged guess lapse and come back");
    assert.equal(Object.values(deck).filter((c) => c.lastGrade === GRADE.HARD).length, 1, "the flagged-but-correct item is the HARD one");

    const retry = buildRetrySession(s, { now: at(220) });
    assert.equal(retry.form.length, 20);
    assert.deepEqual(retry.form.items.map((i) => i.id).sort(), review.missed.map((i) => i.id).sort());
  });
});

/* ─── exam honesty: the promises the engine makes to a learner ───
   Every test below guards a place where a number or a sentence could
   read as more than it is. */

const __dirname_ = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (...p) => fs.readFileSync(path.join(__dirname_, "..", ...p), "utf-8");

/**
 * A full-length, blueprint-faithful Series 65 mock with exactly `correct` right.
 *
 * Attaches the bank itself rather than inheriting whatever the last describe
 * block left in the registry: the bank is no longer built in, so a fixture that
 * assumes one is a fixture whose meaning depends on test ORDER. The assertions
 * below are the sharpest in this file — 93/130 is a fail — and they must not be
 * hostage to that.
 */
function s65MockWith(correct, seed = "boundary") {
  resetExamsWithSeries65Bank();
  let s = buildSession({ certId: "series65", mode: "mock", seed, now: T0 });
  assert.equal(s.form.length, 130, "fixture must be a real full-length form");
  assert.equal(s.form.faithful, true, "fixture must be blueprint-faithful");
  s.form.items.forEach((item, i) => {
    const idx = i < correct ? item.correctIndex : (item.correctIndex + 1) % item.options.length;
    s = answerItem(s, item.id, idx, { now: T0 });
  });
  return submitSession(s, { now: at(100) });
}

describe("exam/scoring: an approximate score may never render as a pass it did not earn", () => {
  test("HARD PATH — 93/130 on the Series 65 is a FAIL and must not report a scaled 72", () => {
    const score = scoreSession(s65MockWith(93));
    assert.equal(score.correct, 93);
    assert.equal(score.passMark.count, 94, "94/130 is the real mark");
    assert.equal(score.passed, false, "93 < 94 is a fail");
    assert.equal(score.verdict, "fail");

    // The raw is 71.54%. Rounding it lands on 72 — numerically identical to the
    // pass mark. A learner reads 72, believes they passed, and stops studying.
    // `scaledIsApproximate` does not save this: the number itself is the lie.
    assert.ok(
      score.scaled < score.passMark.pct,
      `a FAILING ${score.rawPct}% reported scaled=${score.scaled}, at or above the ${score.passMark.pct}% pass mark`,
    );
  });

  test("the passing neighbour still reads as a pass — no over-correction", () => {
    const score = scoreSession(s65MockWith(94));
    assert.equal(score.passed, true);
    assert.ok(
      score.scaled >= score.passMark.pct,
      `a PASSING ${score.rawPct}% reported scaled=${score.scaled}, below the ${score.passMark.pct}% pass mark`,
    );
  });

  test("scaled never contradicts passed, at any raw score on the form", () => {
    for (let correct = 88; correct <= 100; correct += 1) {
      const score = scoreSession(s65MockWith(correct, `sweep-${correct}`));
      assert.equal(
        score.scaled >= score.passMark.pct,
        score.passed,
        `${correct}/130 (${score.rawPct}%): scaled=${score.scaled} reads as ` +
        `${score.scaled >= score.passMark.pct ? "a pass" : "a fail"} but passed=${score.passed}`,
      );
    }
  });

  test("the approximation is still declared, and still not equated", () => {
    const score = scoreSession(s65MockWith(93));
    assert.equal(score.scaledIsApproximate, true);
    assert.match(score.scaledNote, /IRT-equated|no equating data/);
  });
});

describe("exam/banks: the offering admits when a bank is out of unseen questions", () => {
  /** The real SIE bank's shape: 146 items against 12/33/23/7 quotas. */
  const sieShapedBank = () => [
    ...makeItems(1, 24, "sie-1"), ...makeItems(2, 64, "sie-2"),
    ...makeItems(3, 44, "sie-3"), ...makeItems(4, 14, "sie-4"),
  ];

  test("HARD PATH — a 146-item SIE bank supports ONE clean form, and says so", () => {
    resetExams();
    const offering = registerBank("sie", sieShapedBank());
    assert.equal(offering.available, 146);
    assert.equal(offering.canOfferFullForm, true, "it can fill one full form");

    // …but only one. Section 3 holds 44 items against a 23-question quota:
    // 1.91 forms. A second mock recycles; a third is ~100% recycled. Without
    // this, a memory-inflated score reads as a faithful one.
    assert.ok(offering.reuse, "the offering reports reuse/exhaustion");
    assert.equal(offering.reuse.distinctFullForms, 1);
    assert.ok(
      Math.abs(offering.reuse.formsSupported - 44 / 23) < 0.001,
      `formsSupported should be the binding section's 44/23, got ${offering.reuse.formsSupported}`,
    );
    assert.deepEqual(offering.reuse.bindingSections, ["3"]);
    assert.match(offering.reuse.note, /seen|reuse|recycl|repeat/i);
    resetExams();
  });

  test("a bank deep enough for two clean forms does not cry wolf", () => {
    // Owns its fixture. This used to call examOffering("series65") against the
    // REAL bank and assert distinctFullForms === 2, so it was really asserting
    // how many questions the content authors happened to have written — and it
    // broke the moment that bank grew 300 -> 520. An ENGINE test must not be
    // hostage to content depth; the real bank's depth is a CONTENT claim and now
    // lives in test/cert-series65.test.js.
    //
    // Sized to exactly 2 clean forms so it pins the boundary from above: the
    // sibling test above proves 1.91 forms DOES warn, this proves 2.00 does not.
    resetExams();
    const offering = registerBank("series65", [
      ...makeItems("economic", 40, "s65-eco"), //  40 / 20 = 2.0
      ...makeItems("vehicles", 64, "s65-veh"), //  64 / 32 = 2.0
      ...makeItems("client", 78, "s65-cli"), //    78 / 39 = 2.0
      ...makeItems("laws", 78, "s65-law"), //      78 / 39 = 2.0
    ]);
    assert.equal(offering.canOfferFullForm, true);
    assert.equal(offering.reuse.distinctFullForms, 2, "260 items / 130-question form = exactly 2");
    assert.equal(offering.reuse.note, "", "a deep bank gets no warning");
    assert.deepEqual(offering.notes, [], "reuse never leaks into the faithfulness notes");
    resetExams();
  });

  test("a bank that cannot fill even one form is left to the faithfulness notes", () => {
    resetExams();
    registerBank("sie", [...makeItems(1, 20, "sie-1"), ...makeItems(2, 40, "sie-2")]);
    const offering = examOffering("sie");
    assert.equal(offering.reuse.distinctFullForms, 0);
    assert.equal(offering.reuse.note, "", "no double-messaging: `notes` already says it can't fill a form");
    assert.ok(offering.notes.length > 0);
    resetExams();
  });

  test("an empty bank and a skills credential both report reuse without crashing", () => {
    resetExams();
    const sie = examOffering("sie");
    assert.equal(sie.available, 0);
    assert.equal(sie.reuse.distinctFullForms, 0);
    assert.equal(sie.reuse.note, "");
    assert.equal(examOffering("cfi").reuse, null, "a skills track has no form to exhaust");
  });
});

describe("exam/banks: the header comment tells the truth about the bank seam", () => {
  test("HARD PATH — the header may not claim data/certs/sie-bank.js does not exist", () => {
    assert.ok(
      fs.existsSync(path.join(__dirname_, "..", "data", "certs", "sie-bank.js")),
      "data/certs/sie-bank.js exists — any comment saying otherwise is false",
    );
    const src = readSrc("lib", "exam", "banks.js");
    const header = src.slice(0, src.indexOf("import "));
    assert.doesNotMatch(
      header,
      /sie-bank\.js does not exist|does not exist in this build/,
      "the header states as architectural fact something that is false",
    );
    // …and it must still describe the seam, which is the point of the comment.
    assert.match(header, /registerBank/);
    assert.match(header, /data\/registry\.js/, "the header must name where the bank is actually registered");
  });

  test("data/registry.js really is the registrar the header describes", () => {
    const reg = readSrc("data", "registry.js");
    assert.match(reg, /registerBank\(/);
    assert.match(reg, /SIE_BANK/);
    assert.match(reg, /registerBank\(\s*['"]series65['"]/, "Series 65 goes through the same registrar, not a built-in bank");
  });

  /**
   * HARD PATH — the invariant the whole seam exists for, guarded at the source.
   *
   * Everything else here checks that the seam WORKS: the banks arrive, the
   * offerings count right, an unregistered engine degrades honestly. None of
   * that fails if someone re-adds `import { SERIES65_BANK } from
   * "../../data/certs/series65-bank.js"` and seeds `bank: SERIES65_BANK`
   * again — the app behaves identically, every behavioural assertion in this
   * repo stays green, and the engine quietly goes back to crashing at import
   * time on a bank that is missing or half-written. That regression was
   * measured, not imagined: re-adding the import leaves the suite at 1954/1954.
   *
   * So this reads the imports themselves. A bank is CONTENT and comes through
   * registerBank(); blueprints and metadata (sie.js, series65.js) and the CFI
   * drills DEFINE their exam and are imported directly by design.
   */
  test("HARD PATH — lib/exam/ imports no bank CONTENT from data/certs/", () => {
    const src = readSrc("lib", "exam", "banks.js");
    const imports = src.match(/^import\s[\s\S]*?from\s+["'][^"']+["'];/gm) ?? [];
    const bankImports = imports.filter((line) => /-bank\.js["']/.test(line));
    assert.deepEqual(
      bankImports,
      [],
      "lib/exam/banks.js must take bank content through registerBank(), never import it:\n" +
        `${bankImports.join("\n")}`,
    );
    // The banks that DO exist must therefore be seeded empty here.
    assert.match(src, /bank:\s*\[\]/, "each multiple-choice cert is seeded with an empty bank");
    assert.doesNotMatch(src, /bank:\s*[A-Z_]+_BANK/, "no cert may be seeded from an imported bank");
  });
});

describe("exam UI: the honesty the components must carry", () => {
  test("HARD PATH — the exam→SRS loop is wired, not just available", () => {
    const host = readSrc("components", "exam", "ExamHost.js");
    assert.match(host, /onSrsReview/, "ExamHost must offer the seam that feeds the SRS deck");
    // It must actually be CALLED on submit, not merely accepted as a prop.
    const finish = host.slice(host.indexOf("const finish"), host.indexOf("const onExpire"));
    assert.match(finish, /onSrsReview/, "a submitted sitting must feed the deck");
  });

  test("HARD PATH — ExamResults promises spaced repetition only when it happened", () => {
    const results = readSrc("components", "exam", "ExamResults.js");
    assert.match(results, /srsScheduled/, "the SRS claim must be conditional on the loop being wired");
    const srsClaim = /spaced[- ]repetition|spaced repetition/i;
    assert.ok(srsClaim.test(results), "when it IS wired, say so");
    // The engine must not promise it unconditionally from the recommendations,
    // where no component can qualify it.
    const review = readSrc("lib", "exam", "review.js");
    const recs = review.slice(review.indexOf("function recommendations"));
    assert.doesNotMatch(
      recs,
      /let spaced repetition bring them round again/,
      "a recommendation cannot promise scheduling the engine does not perform",
    );
  });

  test("HARD PATH — the resume screen says the interruption VOIDS the official result", () => {
    const host = readSrc("components", "exam", "ExamHost.js");
    const note = host.slice(host.indexOf("function MODE_RESUME_NOTE"));

    // Resuming banks downtime, and scoring.js only calls a result `official`
    // when downtimeMs === 0. A learner discovering that after three hours has
    // been told too late, so the consequence goes on the resume button itself.
    const mockBranch = note.slice(note.indexOf('!== "mock"'));
    assert.match(
      mockBranch,
      /official pass or fail/i,
      "an interrupted mock can never be official again — say so before it is re-entered, not after",
    );
    assert.match(mockBranch, /fresh form/i, "and name the alternative that still yields a real result");

    // The old catch-all: every interrupted sitting, mock included, was fobbed
    // off with this. "Noted on your result" is not what voiding a pass/fail is.
    assert.doesNotMatch(
      note,
      /wasn't charged to your clock, but the interruption is noted on your result/,
      '"noted on your result" understates voiding the official pass/fail',
    );
  });
});
