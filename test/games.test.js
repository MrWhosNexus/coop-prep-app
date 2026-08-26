import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  GRADE, MIN_EASE, MAX_EASE, DEFAULT_EASE, normalizeGrade,
  dayISO, addDays, daysBetween, newCard, isNew, isDue, overdueDays,
  retrievability, reviewCard, horizonTo, ROLLING_WINDOW_DAYS, defaultDeck, getCard, reviewInDeck,
  pruneDeck, dueCardIds, buildQueue, deckStats,
} from "../lib/games/srs.js";

import {
  normalizeAnswer, canonicalize, numericForms, editDistance, similarity,
  typoBudget, matchAnswer, scoreEvent, scoreRound, streaks, estimateMastery,
  masteryLevel, masteryFromCard, summarizeMastery, gradeFromMatch,
  BASE_POINTS, MAX_STREAK_MULTIPLIER,
} from "../lib/games/scoring.js";

import {
  makeRng, shuffle, extractConcepts, pickConcepts, isRecallable,
  acceptableAnswers, rejectAnswers, generateRecallDrill, generateMatchGame,
  checkMatch, generateRapidFire, tokenizeFormula, extractFormulas,
  generateFormulaBuilder, checkFormulaBuilder, buildFourFifthsWorkbook,
  generateErrorHunt, checkErrorHunt, suggestGame, planSession,
  BUG_KINDS, HMDA_GROUPS,
} from "../lib/games/generators.js";

import { MODULES, FLASHCARDS } from "../data/curriculum.js";
import { getValue } from "../lib/sheet/model.js";

const NOW = "2026-07-15T12:00:00.000Z";
const CONCEPTS = extractConcepts({ modules: MODULES, flashcards: FLASHCARDS });
const FORMULAS = extractFormulas({ modules: MODULES, flashcards: FLASHCARDS });

/* ══════════════════════════════════════════════════════════════ srs ══ */

describe("srs: dates", () => {
  test("dayISO truncates to a UTC day", () => {
    assert.equal(dayISO(NOW), "2026-07-15");
  });

  test("addDays crosses month and year boundaries", () => {
    assert.equal(addDays("2026-07-15", 1), "2026-07-16");
    assert.equal(addDays("2026-07-31", 1), "2026-08-01");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2026-08-01", -1), "2026-07-31");
  });

  test("daysBetween is signed", () => {
    assert.equal(daysBetween("2026-07-15", "2026-07-20"), 5);
    assert.equal(daysBetween("2026-07-20", "2026-07-15"), -5);
    assert.equal(daysBetween("2026-07-15", "2026-07-15"), 0);
  });

  test("horizonTo counts days to the fellowship start", () => {
    assert.equal(horizonTo("2026-08-12", NOW), 28);
    // A deadline in the past must NOT collapse to 1 (the old floor turned the
    // scheduler into "everything due daily"); it falls back to the rolling window.
    assert.equal(horizonTo("2026-07-01", NOW), ROLLING_WINDOW_DAYS);
    assert.ok(ROLLING_WINDOW_DAYS > 1);
    // The day-of boundary: 0 days remaining counts as "passed".
    assert.equal(horizonTo("2026-07-15", NOW), ROLLING_WINDOW_DAYS);
    assert.equal(horizonTo("2026-07-16", NOW), 1);
  });
});

describe("srs: grades", () => {
  test("named grades map to SM-2 quality scores", () => {
    assert.equal(normalizeGrade("again"), 0);
    assert.equal(normalizeGrade("hard"), 3);
    assert.equal(normalizeGrade("good"), 4);
    assert.equal(normalizeGrade("easy"), 5);
    assert.equal(normalizeGrade("GOOD"), 4);
  });

  test("numeric grades clamp to 0..5", () => {
    assert.equal(normalizeGrade(9), 5);
    assert.equal(normalizeGrade(-3), 0);
    assert.equal(normalizeGrade(3), 3);
  });

  test("nonsense grades throw rather than silently scoring 0", () => {
    assert.throws(() => normalizeGrade("brilliant"));
    assert.throws(() => normalizeGrade(NaN));
    assert.throws(() => normalizeGrade(undefined));
  });
});

describe("srs: scheduling", () => {
  test("a new card is new, due, and unreviewed", () => {
    const c = newCard("x", { now: NOW });
    assert.equal(c.reps, 0);
    assert.equal(c.ease, DEFAULT_EASE);
    assert.equal(c.due, "2026-07-15");
    assert.equal(isNew(c), true);
    assert.equal(isDue(c, NOW), true);
    assert.equal(retrievability(c, NOW), 0);
  });

  test("SM-2 interval ladder is 1 -> 6 -> interval*ease", () => {
    let c = newCard("x", { now: NOW });
    c = reviewCard(c, GRADE.GOOD, { now: NOW });
    assert.equal(c.intervalDays, 1);
    assert.equal(c.due, "2026-07-16");

    c = reviewCard(c, GRADE.GOOD, { now: "2026-07-16" });
    assert.equal(c.intervalDays, 6);
    assert.equal(c.due, "2026-07-22");

    const easeAfter = c.ease;
    c = reviewCard(c, GRADE.GOOD, { now: "2026-07-22" });
    // third rep multiplies the previous interval by the updated ease
    assert.equal(c.intervalDays, Math.round(6 * c.ease));
    assert.ok(c.ease >= easeAfter - 1e-9);
  });

  test("reviewCard is pure", () => {
    const c = newCard("x", { now: NOW });
    const next = reviewCard(c, GRADE.GOOD, { now: NOW });
    assert.notEqual(c, next);
    assert.equal(c.reps, 0);
    assert.equal(c.recent.length, 0);
    assert.equal(next.reps, 1);
  });

  test("EASY raises ease, HARD lowers it, AGAIN lowers it most", () => {
    const c = newCard("x", { now: NOW });
    const easy = reviewCard(c, GRADE.EASY, { now: NOW });
    const good = reviewCard(c, GRADE.GOOD, { now: NOW });
    const hard = reviewCard(c, GRADE.HARD, { now: NOW });
    const again = reviewCard(c, GRADE.AGAIN, { now: NOW });
    assert.ok(easy.ease > good.ease);
    assert.ok(good.ease > hard.ease);
    assert.ok(hard.ease > again.ease);
  });

  test("ease is clamped to [MIN_EASE, MAX_EASE]", () => {
    let c = newCard("x", { now: NOW });
    for (let i = 0; i < 30; i++) c = reviewCard(c, GRADE.AGAIN, { now: NOW });
    assert.equal(c.ease, MIN_EASE);

    let d = newCard("y", { now: NOW });
    for (let i = 0; i < 30; i++) d = reviewCard(d, GRADE.EASY, { now: `2026-07-${String(15 + (i % 10)).padStart(2, "0")}` });
    assert.ok(d.ease <= MAX_EASE);
  });

  test("a lapse resets reps and reschedules for tomorrow, keeping the card", () => {
    let c = newCard("x", { now: NOW });
    c = reviewCard(c, GRADE.GOOD, { now: NOW });
    c = reviewCard(c, GRADE.GOOD, { now: "2026-07-16" });
    c = reviewCard(c, GRADE.GOOD, { now: "2026-07-22" });
    assert.ok(c.intervalDays > 6);

    const lapsed = reviewCard(c, GRADE.AGAIN, { now: "2026-08-01" });
    assert.equal(lapsed.reps, 0);
    assert.equal(lapsed.lapses, 1);
    assert.equal(lapsed.intervalDays, 1);
    assert.equal(lapsed.due, "2026-08-02");
    assert.ok(lapsed.ease < c.ease);
  });

  test("intervals never exceed maxIntervalDays", () => {
    let c = newCard("x", { now: NOW });
    let day = new Date(NOW);
    for (let i = 0; i < 12; i++) {
      c = reviewCard(c, GRADE.EASY, { now: day.toISOString(), maxIntervalDays: 30 });
      assert.ok(c.intervalDays <= 30, `interval ${c.intervalDays} exceeded cap`);
      day = new Date(`${c.due}T12:00:00.000Z`);
    }
  });

  test("a horizon keeps every review before the fellowship starts", () => {
    // The horizon must be recomputed from the CURRENT day at each review --
    // it is the distance left to the deadline, not a fixed cap.
    const START = "2026-08-12";
    let c = newCard("x", { now: NOW });
    let day = NOW;
    let reviews = 0;
    while (dayISO(day) < START) {
      c = reviewCard(c, GRADE.EASY, { now: day, maxIntervalDays: horizonTo(START, day) });
      assert.ok(c.due <= START, `scheduled past the deadline: ${c.due}`);
      day = `${c.due}T12:00:00.000Z`;
      reviews++;
      assert.ok(reviews < 50, "the schedule failed to advance");
    }
    // Every card gets seen at least once more before the fellowship starts.
    assert.ok(reviews >= 3);
    assert.equal(c.due, START);
  });

  test("past the deadline the horizon stops constraining, and spacing survives", () => {
    // A horizon is a deadline, not a cliff: once the fellowship has started
    // the schedule keeps running under the rolling window. The regression
    // this guards: the old floor of 1 capped EVERY interval at 1 day, so
    // repeated passes never spaced out and the whole deck was due daily.
    let c = newCard("x", { now: "2026-09-01" });
    let day = "2026-09-01T12:00:00.000Z";
    for (let i = 0; i < 6; i++) {
      c = reviewCard(c, GRADE.EASY, {
        now: day,
        maxIntervalDays: horizonTo("2026-08-12", day),
      });
      assert.ok(c.intervalDays <= ROLLING_WINDOW_DAYS, `interval ${c.intervalDays} exceeded the rolling window`);
      day = `${c.due}T12:00:00.000Z`;
    }
    assert.ok(c.intervalDays > 1, "spacing must grow past 1 day after the deadline");
  });

  test("card history is bounded", () => {
    let c = newCard("x", { now: NOW });
    for (let i = 0; i < 40; i++) c = reviewCard(c, GRADE.GOOD, { now: NOW });
    assert.ok(c.recent.length <= 12);
  });

  test("a card is serializable round-trip", () => {
    let c = newCard("x", { now: NOW });
    c = reviewCard(c, GRADE.GOOD, { now: NOW });
    assert.deepEqual(JSON.parse(JSON.stringify(c)), c);
  });

  test("overdueDays and isDue track the calendar", () => {
    let c = newCard("x", { now: NOW });
    c = reviewCard(c, GRADE.GOOD, { now: NOW }); // due 07-16
    assert.equal(isDue(c, NOW), false);
    assert.equal(overdueDays(c, NOW), 0);
    assert.equal(isDue(c, "2026-07-16"), true);
    assert.equal(overdueDays(c, "2026-07-20"), 4);
  });

  test("retrievability decays to ~0.9 at exactly one interval", () => {
    let c = newCard("x", { now: NOW });
    c = reviewCard(c, GRADE.GOOD, { now: NOW });
    c = reviewCard(c, GRADE.GOOD, { now: "2026-07-16" }); // interval 6, due 07-22
    assert.equal(retrievability(c, "2026-07-16"), 1);
    // The curve is defined so that one full interval later, recall is ~90%.
    assert.ok(Math.abs(retrievability(c, "2026-07-22") - 0.9) < 1e-9);
    // Two intervals later it is 0.9^2, and it keeps decaying without ever
    // going negative.
    assert.ok(Math.abs(retrievability(c, "2026-07-28") - 0.81) < 1e-9);
    assert.ok(retrievability(c, "2026-09-01") < 0.5);
    assert.ok(retrievability(c, "2027-09-01") >= 0);
  });
});

describe("srs: decks", () => {
  test("getCard materialises unseen concepts without writing", () => {
    const deck = defaultDeck();
    const c = getCard(deck, "new-one", { now: NOW });
    assert.equal(c.id, "new-one");
    assert.deepEqual(deck, {});
  });

  test("reviewInDeck is pure and records the card", () => {
    const deck = defaultDeck();
    const next = reviewInDeck(deck, "a", GRADE.GOOD, { now: NOW });
    assert.deepEqual(deck, {});
    assert.equal(next.a.reps, 1);
  });

  test("dueCardIds returns the most overdue first", () => {
    let deck = defaultDeck();
    deck = reviewInDeck(deck, "soon", GRADE.GOOD, { now: NOW });        // due 07-16
    deck = reviewInDeck(deck, "later", GRADE.GOOD, { now: NOW });
    deck = reviewInDeck(deck, "later", GRADE.GOOD, { now: "2026-07-16" }); // due 07-22
    assert.deepEqual(dueCardIds(deck, { now: "2026-07-30" }), ["soon", "later"]);
    assert.deepEqual(dueCardIds(deck, { now: "2026-07-16" }), ["soon"]);
    assert.deepEqual(dueCardIds(deck, { now: NOW }), []);
  });

  test("buildQueue puts due reviews before new material", () => {
    let deck = defaultDeck();
    deck = reviewInDeck(deck, "seen", GRADE.GOOD, { now: NOW });
    const q = buildQueue(deck, ["fresh1", "seen", "fresh2"], { now: "2026-07-16", newPerSession: 2 });
    assert.equal(q[0], "seen");
    assert.deepEqual(q.slice(1).sort(), ["fresh1", "fresh2"]);
  });

  test("buildQueue caps new cards and total size", () => {
    const ids = Array.from({ length: 50 }, (_, i) => `c${i}`);
    assert.equal(buildQueue({}, ids, { now: NOW, newPerSession: 3 }).length, 3);
    assert.equal(buildQueue({}, ids, { now: NOW, newPerSession: 30, limit: 10 }).length, 10);
  });

  test("buildQueue ignores cards whose concept no longer exists", () => {
    let deck = defaultDeck();
    deck = reviewInDeck(deck, "ghost", GRADE.GOOD, { now: NOW });
    assert.deepEqual(buildQueue(deck, ["real"], { now: "2026-08-01", newPerSession: 1 }), ["real"]);
  });

  test("pruneDeck drops orphans", () => {
    let deck = defaultDeck();
    deck = reviewInDeck(deck, "keep", GRADE.GOOD, { now: NOW });
    deck = reviewInDeck(deck, "drop", GRADE.GOOD, { now: NOW });
    assert.deepEqual(Object.keys(pruneDeck(deck, ["keep"])), ["keep"]);
  });

  test("deckStats counts new / due / learning / mature", () => {
    let deck = defaultDeck();
    deck = reviewInDeck(deck, "a", GRADE.GOOD, { now: NOW });
    const s = deckStats(deck, ["a", "b", "c"], { now: "2026-07-16" });
    assert.equal(s.total, 3);
    assert.equal(s.seen, 1);
    assert.equal(s.new, 2);
    assert.equal(s.due, 1);
    assert.equal(s.learning, 1);
    assert.equal(s.mature, 0);
  });
});

/* ══════════════════════════════════════════════════ fuzzy matching ══ */

describe("scoring: normalisation", () => {
  test("folds case, whitespace, accents and smart punctuation", () => {
    assert.equal(normalizeAnswer("  XLOOKUP  "), "xlookup");
    assert.equal(normalizeAnswer("Four–fifths   rule"), "four-fifths rule");
    assert.equal(normalizeAnswer("naïve"), "naive");
    assert.equal(normalizeAnswer("don’t"), "dont");
  });

  test("drops leading articles but never the whole answer", () => {
    assert.equal(normalizeAnswer("the pivot table"), "pivot table");
    assert.equal(normalizeAnswer("a proxy variable"), "proxy variable");
    assert.equal(normalizeAnswer("the"), "the");
  });

  test("normalises percent wording to a sign", () => {
    assert.equal(normalizeAnswer("75 percent"), "75 %");
    assert.equal(normalizeAnswer("75%"), "75%");
  });

  test("handles null/undefined without throwing", () => {
    assert.equal(normalizeAnswer(null), "");
    assert.equal(normalizeAnswer(undefined), "");
  });

  test("canonicalize folds synonym classes together", () => {
    assert.equal(canonicalize(normalizeAnswer("80% rule")), canonicalize(normalizeAnswer("four-fifths rule")));
    assert.equal(canonicalize(normalizeAnswer("SD")), canonicalize(normalizeAnswer("standard deviation")));
    assert.notEqual(canonicalize(normalizeAnswer("disparate impact")), canonicalize(normalizeAnswer("disparate treatment")));
  });
});

describe("scoring: edit distance", () => {
  test("counts substitutions, insertions and deletions", () => {
    assert.equal(editDistance("abc", "abc"), 0);
    assert.equal(editDistance("abc", "abd"), 1);
    assert.equal(editDistance("abc", "ab"), 1);
    assert.equal(editDistance("", "abc"), 3);
  });

  test("a transposition is one edit, not two", () => {
    assert.equal(editDistance("teh", "the"), 1);
    // Plain Levenshtein would score this 2; Damerau counts the swap once.
    assert.equal(editDistance("xlookup", "xolokup"), 1);
  });

  test("similarity is 1 for identical and 0 for disjoint", () => {
    assert.equal(similarity("abc", "abc"), 1);
    assert.equal(similarity("", ""), 1);
    assert.ok(similarity("abc", "xyz") < 0.01);
  });

  test("typoBudget gives short answers no slack", () => {
    assert.equal(typoBudget("sd"), 0);
    assert.equal(typoBudget("0.80"), 0);
    assert.equal(typoBudget("xlookup"), 1);
    assert.ok(typoBudget("standard deviation") >= 2);
  });
});

describe("scoring: numericForms", () => {
  test("plain numbers read one way", () => {
    assert.deepEqual(numericForms("0.80"), [0.8]);
    assert.deepEqual(numericForms("80"), [80]);
    assert.deepEqual(numericForms(".8"), [0.8]);
  });

  test("percent values read both ways", () => {
    assert.deepEqual(numericForms("75%"), [75, 0.75]);
  });

  test("non-numbers return null", () => {
    assert.equal(numericForms("XLOOKUP"), null);
    assert.equal(numericForms("0.8 ratio"), null);
    assert.equal(numericForms(""), null);
  });

  test("strips currency and separators", () => {
    assert.deepEqual(numericForms("$1,500"), [1500]);
  });
});

describe("scoring: matchAnswer accepts what it should", () => {
  const cases = [
    ["exact", "XLOOKUP", "XLOOKUP"],
    ["case-insensitive", "xlookup", "XLOOKUP"],
    ["surrounding whitespace", "  XLOOKUP  ", "XLOOKUP"],
    ["a single typo", "xlookp", "XLOOKUP"],
    ["a transposition", "XLOKOUP", "XLOOKUP"],
    ["multiple typos in a long answer", "standrd deviaton", "Standard deviation"],
    ["a domain synonym", "adverse impact", "Disparate impact"],
    ["the 80% rule synonym", "80% rule", "Four-fifths rule"],
    ["the 4/5 synonym", "4/5 rule", "Four-fifths rule"],
    ["an abbreviation synonym", "std dev", "Standard deviation"],
    ["punctuation drift", "four fifths rule", "Four-fifths rule"],
    ["a trailing period", "XLOOKUP.", "XLOOKUP"],
  ];
  for (const [name, input, answer] of cases) {
    test(`accepts ${name}`, () => {
      const r = matchAnswer(input, answer, { reject: [] });
      assert.equal(r.correct, true, `rejected ${JSON.stringify(input)} for ${JSON.stringify(answer)} (${r.reason})`);
    });
  }

  test("accepts an acronym pulled out of the term's own parentheses", () => {
    const acc = acceptableAnswers({ answer: "Model Risk Management (MRM)" });
    assert.equal(matchAnswer("MRM", acc).correct, true);
    assert.equal(matchAnswer("model risk management", acc).correct, true);
    assert.equal(matchAnswer("Model Risk Management (MRM)", acc).correct, true);
  });

  test("accepts either side of a slashed term", () => {
    const acc = acceptableAnswers({ answer: "UDAP / UDAAP" });
    assert.equal(matchAnswer("UDAP", acc).correct, true);
    assert.equal(matchAnswer("udaap", acc).correct, true);
  });

  test("numbers match on value, not spelling", () => {
    assert.equal(matchAnswer("0.8", "0.80").correct, true);
    assert.equal(matchAnswer(".80", "0.80").correct, true);
    assert.equal(matchAnswer("0.800", "0.80").correct, true);
    assert.equal(matchAnswer("75", "75%").correct, true);
    assert.equal(matchAnswer("0.75", "75%").correct, true);
    assert.equal(matchAnswer("75 percent", "75%").correct, true);
  });
});

describe("scoring: matchAnswer rejects what it must", () => {
  test("THE critical case: a distractor one edit from the answer", () => {
    // "VLOOKUP" is a real distractor for "XLOOKUP" in excel-2 and sits a
    // single edit away. Typo tolerance must never swallow it.
    const r = matchAnswer("VLOOKUP", "XLOOKUP", { reject: ["VLOOKUP", "Both", "Neither"] });
    assert.equal(r.correct, false);
    assert.equal(r.reason, "distractor");
  });

  test("COUNTIF is not a typo of COUNTIFS", () => {
    const r = matchAnswer("COUNTIF", "COUNTIFS", { reject: ["COUNTIF", "SUMIF", "FILTER"] });
    assert.equal(r.correct, false);
  });

  test("a typo of a WRONG answer stays wrong", () => {
    const r = matchAnswer("vlookp", "XLOOKUP", { reject: ["VLOOKUP"] });
    assert.equal(r.correct, false);
  });

  test("distinct concepts that share a word do not collapse", () => {
    const r = matchAnswer("Disparate treatment", "Disparate impact", { reject: ["Disparate treatment"] });
    assert.equal(r.correct, false);
  });

  test("terms differing at the first letter are safe even with no reject list", () => {
    // The reject list is the primary guard, but it must not be the only one:
    // a caller that forgets it still must not have VLOOKUP accepted as
    // XLOOKUP, one edit away.
    assert.equal(matchAnswer("VLOOKUP", "XLOOKUP").correct, false);
    assert.equal(matchAnswer("Disparate treatment", "Disparate impact").correct, false);
    assert.equal(matchAnswer("precision", "recall").correct, false);
    assert.equal(matchAnswer("SUMIF", "SUMIFS", { reject: ["SUMIF"] }).correct, false);
  });

  test("a first-letter guard does not cost us real typos", () => {
    assert.equal(matchAnswer("xlookp", "XLOOKUP", { reject: ["VLOOKUP"] }).correct, true);
    assert.equal(matchAnswer("standrd deviaton", "Standard deviation").correct, true);
    assert.equal(matchAnswer("dispirate impact", "Disparate impact").correct, true);
  });

  test("KNOWN LIMIT: a same-initial one-edit distractor needs the reject list", () => {
    // "COUNTIF" is one edit from "COUNTIFS" and shares its initial, so
    // spelling alone cannot separate them -- only knowing that COUNTIF is a
    // real wrong answer can. generators.rejectAnswers() always supplies it
    // from the quiz's own options, and this test pins that dependency so it
    // cannot be quietly dropped.
    assert.equal(matchAnswer("COUNTIF", "COUNTIFS", { reject: ["COUNTIF"] }).correct, false);
    const concept = CONCEPTS.find((c) => c.answer === "COUNTIFS");
    assert.ok(rejectAnswers(concept).includes("COUNTIF"),
      "the curriculum's own distractor must reach the matcher");
    assert.equal(
      matchAnswer("COUNTIF", acceptableAnswers(concept), { reject: rejectAnswers(concept) }).correct,
      false,
    );
  });

  test("wrong numbers are wrong", () => {
    assert.equal(matchAnswer("0.72", "0.80", { reject: ["0.72", "0.90"] }).correct, false);
    assert.equal(matchAnswer("1.25", "0.80").correct, false);
    assert.equal(matchAnswer("0.9", "0.80").correct, false);
    assert.equal(matchAnswer("60", "75%").correct, false);
  });

  test("empty, blank and garbage input is never correct", () => {
    assert.equal(matchAnswer("", "XLOOKUP").correct, false);
    assert.equal(matchAnswer("   ", "XLOOKUP").correct, false);
    assert.equal(matchAnswer("asdfgh", "XLOOKUP").correct, false);
    assert.equal(matchAnswer(null, "XLOOKUP").correct, false);
  });

  test("a scale slip is not accepted, but is flagged as near", () => {
    // "80" for a ratio of "0.80" is a units error, not knowledge -- the UI
    // offers a retry instead of marking the concept unknown.
    const r = matchAnswer("80", "0.80");
    assert.equal(r.correct, false);
    assert.equal(r.near, true);
    assert.equal(r.reason, "scale");
  });

  test("a missing target is a miss, not a crash", () => {
    assert.equal(matchAnswer("anything", []).correct, false);
    assert.equal(matchAnswer("anything", "").correct, false);
  });
});

describe("scoring: matchAnswer is monotone in closeness", () => {
  // The authored item this was found on: quiz:excel-3:0 asks for COUNTIFS and
  // offers COUNTIF as a distractor, one edit away on the other side of a typo.
  const ANSWER = "COUNTIFS";
  const REJECT = ["COUNTIF", "SUMIF", "FILTER"];
  const m = (input) => matchAnswer(input, ANSWER, { reject: REJECT });

  test("exact: correct, not near, and the fastest path to EASY", () => {
    const r = m("COUNTIFS");
    assert.equal(r.correct, true);
    assert.equal(r.near, false);
    assert.equal(r.reason, "exact");
    assert.equal(r.distance, 0);
    assert.equal(gradeFromMatch(r, { ms: 1000 }), GRADE.EASY);
  });

  test("near-miss ONE edit from the answer is never graded AGAIN", () => {
    // "COUNTIS" is one deletion from COUNTIFS. It also sits one edit from the
    // COUNTIF distractor, so it cannot be CREDITED -- but a learner who is one
    // keystroke from the right answer plainly knows it, and resetting their
    // SRS interval to zero for a typo is the harm this guards.
    const r = m("COUNTIS");
    assert.equal(r.correct, false, "still not credited -- the ambiguity guard holds");
    assert.equal(r.reason, "ambiguous");
    assert.equal(r.distance, 1);
    assert.ok(r.similarity > 0.85);
    assert.equal(r.near, true, "a one-edit slip is the definition of a near miss");
    assert.equal(gradeFromMatch(r), GRADE.HARD, "the interval shrinks; it does not reset");
  });

  test("far-miss TWO edits away is near, and never graded better than the one-edit slip", () => {
    const r = m("COUNTZZS");
    assert.equal(r.correct, false);
    assert.equal(r.distance, 2);
    assert.equal(r.near, true);
    assert.equal(gradeFromMatch(r), GRADE.HARD);
  });

  test("THE INVARIANT: closeness never grades worse than distance", () => {
    // Every rung is strictly further from COUNTIFS than the one above it, so
    // `near` may only go from true to false down the ladder, and the grade may
    // only fall. The ambiguity guard is allowed to withhold CREDIT at any rung;
    // it is not allowed to make a closer answer score LOWER than a farther one.
    const ladder = ["COUNTIFS", "COUNTIS", "COUNTZZS", "COUNTZZZZ", "asdfgh"];
    const graded = ladder.map((input) => {
      const r = m(input);
      return { input, near: r.near, correct: r.correct, distance: r.distance, grade: gradeFromMatch(r) };
    });
    for (let i = 1; i < graded.length; i++) {
      const closer = graded[i - 1];
      const farther = graded[i];
      assert.ok(
        farther.grade <= closer.grade,
        `"${farther.input}" (further from the answer) out-graded "${closer.input}": ` +
        `${farther.grade} > ${closer.grade}`,
      );
      assert.ok(
        !(farther.near && !closer.near && !closer.correct),
        `"${farther.input}" was offered a retry while the closer "${closer.input}" was not`,
      );
    }
    // (no `ms` is passed, so even the exact answer grades GOOD rather than EASY)
    assert.deepEqual(graded.map((g) => g.grade), [GRADE.GOOD, GRADE.HARD, GRADE.HARD, GRADE.AGAIN, GRADE.AGAIN]);
  });

  test("the ambiguity guard still refuses to credit an ambiguous input", () => {
    // The protection this branch exists for: an input equidistant between the
    // answer and a known-wrong answer is NOT evidence the learner meant the
    // answer, so it is never marked correct and never carries a `matched`.
    const r = m("COUNTIS");
    assert.equal(r.correct, false);
    assert.equal(r.matched, null);
    // ...and with no COUNTIF distractor in play, the same input IS a typo hit.
    const unambiguous = matchAnswer("COUNTIS", ANSWER, { reject: ["SUMIF", "FILTER"] });
    assert.equal(unambiguous.correct, true);
    assert.equal(unambiguous.reason, "typo");
  });

  test("typing the distractor verbatim is wrong, not near -- deliberately", () => {
    // The one intended discontinuity: "COUNTIF" is not a slip toward COUNTIFS,
    // it is a wrong answer the learner chose. It resets, and it must keep doing so.
    const r = m("COUNTIF");
    assert.equal(r.correct, false);
    assert.equal(r.reason, "distractor");
    assert.equal(r.near, false);
    assert.equal(gradeFromMatch(r), GRADE.AGAIN);
  });

  test("far miss and empty input stay AGAIN", () => {
    for (const input of ["asdfgh", "", "   ", null]) {
      const r = m(input);
      assert.equal(r.correct, false, `${JSON.stringify(input)} is not correct`);
      assert.equal(r.near, false, `${JSON.stringify(input)} is not a near miss`);
      assert.equal(gradeFromMatch(r), GRADE.AGAIN);
    }
    assert.equal(m("").reason, "empty");
  });

  test("the SRS consequence: a one-edit typo does not wipe out a learned interval", () => {
    // What the learner actually loses. Grading the typo AGAIN lapses the card
    // back to a 1-day interval; grading it HARD keeps the schedule.
    let card = newCard("quiz:excel-3:0", { now: NOW });
    card = reviewCard(card, GRADE.GOOD, { now: NOW });
    card = reviewCard(card, GRADE.GOOD, { now: card.due });
    assert.equal(card.intervalDays, 6, "a learned card");
    const after = reviewCard(card, gradeFromMatch(m("COUNTIS")), { now: card.due });
    assert.ok(after.intervalDays > 1, `a one-character typo reset the interval to ${after.intervalDays} day(s)`);
    // ...but HARD is no longer a pass. The near miss keeps the schedule
    // alive (interval creeps rather than resetting), while the shakiness is
    // recorded: it counts as a lapse, and reps does not advance -- a card
    // must never mature on near misses alone, which is exactly what the old
    // pass-at-3 mapping allowed (four "unsure" grades reached 23 days with
    // lapses stuck at 0).
    assert.equal(after.lapses, 1, "the near miss is recorded as a lapse");
    assert.equal(after.reps, card.reps, "HARD does not advance reps toward maturity");
  });
});

describe("scoring: matchAnswer against the real curriculum", () => {
  const drill = generateRecallDrill(CONCEPTS, { count: 999, rng: makeRng(11) });

  test("the drill covers a meaningful slice of the curriculum", () => {
    assert.ok(drill.items.length >= 30, `only ${drill.items.length} recallable items`);
  });

  test("every recallable concept accepts its own answer", () => {
    for (const item of drill.items) {
      const r = matchAnswer(item.answer, item.acceptable, { reject: item.reject });
      assert.equal(r.correct, true,
        `self-reject: ${JSON.stringify(item.answer)} (${r.reason})`);
    }
  });

  test("every recallable concept accepts its own answer lower-cased", () => {
    for (const item of drill.items) {
      const r = matchAnswer(String(item.answer).toLowerCase(), item.acceptable, { reject: item.reject });
      assert.equal(r.correct, true, `self-reject on case: ${JSON.stringify(item.answer)}`);
    }
  });

  test("no concept accepts any of its own known-wrong answers", () => {
    for (const item of drill.items) {
      for (const wrong of item.reject) {
        const r = matchAnswer(wrong, item.acceptable, { reject: item.reject });
        assert.equal(r.correct, false,
          `${JSON.stringify(item.answer)} accepted wrong answer ${JSON.stringify(wrong)}`);
      }
    }
  });

  test("no concept accepts another concept's answer", () => {
    const items = drill.items.slice(0, 25);
    for (const item of items) {
      for (const other of items) {
        if (other.conceptId === item.conceptId) continue;
        // Skip genuine synonyms across concepts (canonically the same answer).
        if (canonicalize(normalizeAnswer(other.answer)) === canonicalize(normalizeAnswer(item.answer))) continue;
        const r = matchAnswer(other.answer, item.acceptable, { reject: item.reject });
        assert.equal(r.correct, false,
          `${JSON.stringify(item.answer)} accepted ${JSON.stringify(other.answer)}`);
      }
    }
  });
});

/* ═════════════════════════════════════════════ scoring & mastery ══ */

describe("scoring: points", () => {
  test("a wrong answer scores zero, never negative", () => {
    assert.equal(scoreEvent({ correct: false, ms: 100 }), 0);
    assert.equal(scoreEvent({ correct: false, ms: 999999 }), 0);
  });

  test("a correct answer is worth at least the base score", () => {
    assert.ok(scoreEvent({ correct: true, ms: 15000 }) >= BASE_POINTS);
  });

  test("speed adds a bonus but never outweighs correctness", () => {
    const fast = scoreEvent({ correct: true, ms: 0 });
    const slow = scoreEvent({ correct: true, ms: 15000 });
    assert.ok(fast > slow);
    assert.ok(fast <= BASE_POINTS * 1.25 + 1);
  });

  test("time past the budget does not go negative", () => {
    assert.equal(scoreEvent({ correct: true, ms: 10_000_000 }), BASE_POINTS);
  });

  test("the streak multiplier is capped", () => {
    const huge = scoreEvent({ correct: true, ms: 15000, streak: 100 });
    assert.equal(huge, Math.round(BASE_POINTS * MAX_STREAK_MULTIPLIER));
  });

  test("streaks tracks current and best runs", () => {
    const evs = [{ correct: true }, { correct: true }, { correct: false }, { correct: true }];
    assert.deepEqual(streaks(evs), { current: 1, best: 2 });
    assert.deepEqual(streaks([]), { current: 0, best: 0 });
    assert.deepEqual(streaks([{ correct: false }]), { current: 0, best: 0 });
  });

  test("scoreRound summarises a round", () => {
    const r = scoreRound([
      { correct: true, ms: 1000 },
      { correct: false, ms: 5000 },
      { correct: true, ms: 3000 },
    ]);
    assert.equal(r.correct, 2);
    assert.equal(r.total, 3);
    assert.ok(Math.abs(r.accuracy - 2 / 3) < 1e-9);
    assert.equal(r.bestStreak, 1);
    assert.equal(r.medianMs, 3000);
    assert.ok(r.points > 0);
  });

  test("an empty round is zeroed, not NaN", () => {
    const r = scoreRound([]);
    assert.equal(r.total, 0);
    assert.equal(r.accuracy, 0);
    assert.equal(r.points, 0);
    assert.equal(r.medianMs, null);
  });
});

describe("scoring: mastery", () => {
  test("no evidence reads as new, not as zero knowledge", () => {
    const m = estimateMastery([]);
    assert.equal(m.level, "new");
    assert.equal(m.observations, 0);
    assert.equal(m.confidence, 0);
  });

  test("one lucky guess is not mastery", () => {
    const m = estimateMastery([{ correct: true }]);
    assert.notEqual(m.level, "mastered");
    assert.ok(m.value < 0.9);
  });

  test("sustained correctness converges toward mastery", () => {
    const m = estimateMastery(Array.from({ length: 10 }, () => ({ correct: true })));
    assert.ok(m.value > 0.85);
    assert.equal(m.level, "mastered");
    assert.ok(m.confidence > 0.5);
  });

  test("sustained failure reads as learning, never below zero", () => {
    const m = estimateMastery(Array.from({ length: 10 }, () => ({ correct: false })));
    assert.ok(m.value >= 0);
    assert.ok(m.value < 0.2);
    assert.equal(m.level, "learning");
  });

  test("recency wins: recent success beats old failure", () => {
    const improving = estimateMastery([
      { correct: false }, { correct: false }, { correct: false },
      { correct: true }, { correct: true }, { correct: true },
    ]);
    const declining = estimateMastery([
      { correct: true }, { correct: true }, { correct: true },
      { correct: false }, { correct: false }, { correct: false },
    ]);
    assert.ok(improving.value > declining.value,
      "a concept you now get right must read stronger than one you now get wrong");
  });

  test("the prior is anchored at the guess rate for multiple choice", () => {
    // With no evidence the estimate sits at the prior, so a 4-option guess
    // can never masquerade as knowledge.
    const m = estimateMastery([], { priorMean: 0.25 });
    assert.ok(Math.abs(m.value - 0.25) < 1e-9);
    const recall = estimateMastery([], { priorMean: 0 });
    assert.equal(recall.value, 0);
  });

  test("masteryLevel bands are ordered and honest about thin evidence", () => {
    assert.equal(masteryLevel(0.99, 0), "new");
    assert.equal(masteryLevel(0.99, 1), "learning");
    assert.equal(masteryLevel(0.95, 5), "mastered");
    assert.equal(masteryLevel(0.8, 5), "proficient");
    assert.equal(masteryLevel(0.6, 5), "familiar");
    assert.equal(masteryLevel(0.2, 5), "learning");
  });

  test("mastery is reachable by a learner who reviews on schedule", () => {
    // Regression: measured at the DUE date (retrievability 0.9 by design),
    // not at the review instant. A card seen exactly when scheduled must not
    // be penalised for it -- if it is, that penalty compounds with
    // estimateMastery's ceiling and no one can ever reach "mastered".
    let card = newCard("x", { now: NOW });
    let day = NOW;
    for (let i = 0; i < 8; i++) {
      card = reviewCard(card, GRADE.GOOD, { now: day });
      day = card.due;
    }
    const m = masteryFromCard(card, { now: day });
    assert.equal(m.level, "mastered", `a perfect on-schedule learner stalled at ${m.level} (${m.value.toFixed(3)})`);
  });

  test("falling behind schedule still pulls mastery down", () => {
    let card = newCard("x", { now: NOW });
    let day = NOW;
    for (let i = 0; i < 4; i++) {
      card = reviewCard(card, GRADE.GOOD, { now: day });
      day = card.due;
    }
    const onTime = masteryFromCard(card, { now: day });
    const overdue = masteryFromCard(card, { now: addDays(day, 400) });
    assert.ok(overdue.value < onTime.value * 0.8,
      "a long-overdue card must read materially weaker than an on-schedule one");
  });

  test("masteryFromCard decays with forgetting", () => {
    let c = newCard("x", { now: NOW });
    c = reviewCard(c, GRADE.GOOD, { now: NOW });
    c = reviewCard(c, GRADE.GOOD, { now: "2026-07-16" });
    const fresh = masteryFromCard(c, { now: "2026-07-16" });
    const stale = masteryFromCard(c, { now: "2026-12-01" });
    assert.ok(stale.value < fresh.value,
      "a card not seen for months must not read as strongly as one just reviewed");
    assert.ok(stale.value >= 0);
  });

  test("an unseen card has no mastery", () => {
    const m = masteryFromCard(newCard("x", { now: NOW }), { now: NOW });
    assert.equal(m.level, "new");
  });

  test("summarizeMastery rolls up a group", () => {
    const s = summarizeMastery([
      { value: 1, level: "mastered" },
      { value: 0, level: "learning" },
    ]);
    assert.equal(s.value, 0.5);
    assert.equal(s.count, 2);
    assert.equal(s.byLevel.mastered, 1);
    assert.equal(summarizeMastery([]).value, 0);
  });

  test("gradeFromMatch maps judgements to SM-2 grades conservatively", () => {
    assert.equal(gradeFromMatch({ correct: true, reason: "exact" }, { ms: 1000 }), GRADE.EASY);
    assert.equal(gradeFromMatch({ correct: true, reason: "exact" }, { ms: 30000 }), GRADE.GOOD);
    // A typo-tolerated hit is a real recall, but never "easy".
    assert.equal(gradeFromMatch({ correct: true, reason: "typo" }, { ms: 100 }), GRADE.GOOD);
    // A near miss shrinks the interval rather than resetting it.
    assert.equal(gradeFromMatch({ correct: false, near: true, reason: "scale" }), GRADE.HARD);
    assert.equal(gradeFromMatch({ correct: false, near: false, reason: "wrong" }), GRADE.AGAIN);
  });
});

/* ════════════════════════════════════════════════════ generators ══ */

describe("generators: rng", () => {
  test("the same seed replays the same sequence", () => {
    const a = makeRng(42);
    const b = makeRng(42);
    assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  });

  test("different seeds diverge", () => {
    assert.notEqual(makeRng(1)(), makeRng(2)());
  });

  test("rng stays in [0, 1)", () => {
    const r = makeRng(9);
    for (let i = 0; i < 500; i++) {
      const v = r();
      assert.ok(v >= 0 && v < 1);
    }
  });

  test("shuffle permutes without mutating or losing elements", () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(src, makeRng(3));
    assert.deepEqual(src, [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual([...out].sort((a, b) => a - b), src);
  });
});

describe("generators: concepts from the real curriculum", () => {
  test("extracts every quiz item and flashcard", () => {
    const quizCount = MODULES.flatMap((m) => m.lessons).reduce((n, l) => n + (l.quiz?.length ?? 0), 0);
    assert.equal(CONCEPTS.filter((c) => c.kind === "quiz").length, quizCount);
    assert.equal(CONCEPTS.filter((c) => c.kind === "card").length, FLASHCARDS.length);
  });

  test("concept ids are unique and stable", () => {
    const ids = CONCEPTS.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
    const again = extractConcepts({ modules: MODULES, flashcards: FLASHCARDS });
    assert.deepEqual(again.map((c) => c.id), ids);
  });

  test("every quiz concept keeps its options and per-option explanations", () => {
    for (const c of CONCEPTS.filter((x) => x.kind === "quiz")) {
      assert.equal(c.options.length, 4, `${c.id} lost its options`);
      for (const o of c.options) {
        assert.ok(o.explanation && o.explanation.length > 0, `${c.id} option lost its explanation`);
      }
    }
  });

  test("every quiz concept has exactly one correct option and three distractors", () => {
    for (const c of CONCEPTS.filter((x) => x.kind === "quiz")) {
      assert.equal(c.options.filter((o) => o.text === c.answer).length, 1, `${c.id}`);
      assert.equal(c.distractors.length, 3, `${c.id}`);
    }
  });

  test("flashcards are drilled definition -> term", () => {
    const card = CONCEPTS.find((c) => c.kind === "card");
    assert.equal(card.prompt, card.def);
    assert.equal(card.answer, card.term);
  });

  test("handles empty sources without throwing", () => {
    assert.deepEqual(extractConcepts({}), []);
    assert.deepEqual(extractConcepts({ modules: [], flashcards: [] }), []);
    assert.deepEqual(extractConcepts({ modules: [{ id: "m", lessons: [{ id: "l" }] }] }), []);
  });

  test("pickConcepts filters by module, lesson, kind and id", () => {
    assert.ok(pickConcepts(CONCEPTS, { moduleId: "excel" }).every((c) => c.moduleId === "excel"));
    assert.ok(pickConcepts(CONCEPTS, { lessonId: "excel-1" }).every((c) => c.lessonId === "excel-1"));
    assert.ok(pickConcepts(CONCEPTS, { kind: "card" }).every((c) => c.kind === "card"));
    assert.deepEqual(pickConcepts(CONCEPTS, { ids: ["quiz:excel-1:0"] }).map((c) => c.id), ["quiz:excel-1:0"]);
    assert.equal(pickConcepts(CONCEPTS, { moduleId: "nope" }).length, 0);
  });
});

describe("generators: recall drill", () => {
  test("only asks for answers short enough to actually type", () => {
    const long = { answer: "Analysis that answers a real business question with defensible numbers" };
    assert.equal(isRecallable(long), false);
    assert.equal(isRecallable({ answer: "COUNTIFS" }), true);
    assert.equal(isRecallable({ answer: "" }), false);
    assert.equal(isRecallable({}), false);
  });

  test("the excluded long answers still exist for other games", () => {
    const excluded = CONCEPTS.filter((c) => !isRecallable(c));
    assert.ok(excluded.length > 0);
    // ...and every one of them can still be asked as multiple choice or matched.
    const rf = generateRapidFire(excluded, { count: 999, rng: makeRng(2) });
    assert.ok(rf.items.length > 0);
  });

  test("acceptableAnswers derives alternates from the answer's own shape", () => {
    assert.deepEqual(acceptableAnswers({ answer: "XLOOKUP" }), ["XLOOKUP"]);
    const mrm = acceptableAnswers({ answer: "Model Risk Management (MRM)" });
    assert.ok(mrm.includes("MRM") && mrm.includes("Model Risk Management"));
    const udap = acceptableAnswers({ answer: "UDAP / UDAAP" });
    assert.ok(udap.includes("UDAP") && udap.includes("UDAAP"));
  });

  test("a 'vs' term is not split into its two sides", () => {
    // "Validation vs. monitoring" means the contrast; neither half alone is
    // the answer.
    const acc = acceptableAnswers({ answer: "Validation vs. monitoring" });
    assert.equal(acc.includes("Validation"), false);
    assert.equal(acc.includes("monitoring"), false);
  });

  test("a formula answer is not split on its slashes", () => {
    const acc = acceptableAnswers({ answer: "=A1/B1" });
    assert.deepEqual(acc, ["=A1/B1"]);
  });

  test("rejectAnswers hands quiz distractors to the matcher", () => {
    const c = CONCEPTS.find((x) => x.id === "quiz:excel-2:1"); // XLOOKUP vs VLOOKUP
    const rej = rejectAnswers(c);
    assert.ok(rej.includes("VLOOKUP"), "the distractor that makes fuzzy matching dangerous must be passed through");
    assert.equal(rej.includes("XLOOKUP"), false);
  });

  test("rejectAnswers borrows sibling terms for flashcards", () => {
    const cards = CONCEPTS.filter((c) => c.kind === "card");
    const impact = cards.find((c) => c.term === "Disparate impact");
    const rej = rejectAnswers(impact, cards);
    assert.ok(rej.includes("Disparate treatment"));
    assert.equal(rej.includes("Disparate impact"), false);
  });

  test("a round is deterministic for a seed and has no repeats", () => {
    const a = generateRecallDrill(CONCEPTS, { count: 8, rng: makeRng(5) });
    const b = generateRecallDrill(CONCEPTS, { count: 8, rng: makeRng(5) });
    assert.deepEqual(a.items.map((i) => i.conceptId), b.items.map((i) => i.conceptId));
    assert.equal(new Set(a.items.map((i) => i.conceptId)).size, a.items.length);
  });

  test("items carry a hint that masks the answer but reveals its shape", () => {
    const round = generateRecallDrill(CONCEPTS, { count: 5, rng: makeRng(6) });
    for (const item of round.items) {
      assert.equal(item.hint.length, String(item.answer).length);
      assert.equal(/[A-Za-z0-9]/.test(item.hint), false, "the hint leaks the answer");
    }
  });

  test("asking for more than exists yields what exists, not padding", () => {
    const round = generateRecallDrill(CONCEPTS, { count: 10_000, rng: makeRng(1) });
    assert.equal(round.items.length, CONCEPTS.filter(isRecallable).length);
  });

  test("an empty concept list yields an empty round", () => {
    assert.deepEqual(generateRecallDrill([], { rng: makeRng(1) }).items, []);
  });
});

describe("generators: match game", () => {
  test("pairs are consistent and the columns are shuffled independently", () => {
    const r = generateMatchGame(CONCEPTS, { pairs: 6, rng: makeRng(4) });
    assert.equal(r.pairs.length, 6);
    assert.equal(r.left.length, 6);
    assert.equal(r.right.length, 6);
    assert.deepEqual(
      [...r.left.map((l) => l.conceptId)].sort(),
      [...r.right.map((x) => x.conceptId)].sort(),
    );
  });

  test("checkMatch only accepts the true pairing", () => {
    const r = generateMatchGame(CONCEPTS, { pairs: 4, rng: makeRng(4) });
    const [a, b] = r.pairs;
    assert.equal(checkMatch(r, a.conceptId, a.conceptId).correct, true);
    assert.equal(checkMatch(r, a.conceptId, b.conceptId).correct, false);
    assert.equal(checkMatch(r, a.conceptId, a.conceptId).pair.term, a.term);
  });

  test("tiles stay short enough to render", () => {
    const r = generateMatchGame(CONCEPTS, { pairs: 8, rng: makeRng(8) });
    for (const p of r.pairs) {
      assert.ok(p.term.length <= 48);
      assert.ok(p.def.length <= 220);
    }
  });
});

describe("generators: rapid fire", () => {
  test("quiz items keep their authored options and explanations verbatim", () => {
    const quiz = CONCEPTS.filter((c) => c.kind === "quiz");
    const r = generateRapidFire(quiz, { count: 999, rng: makeRng(2) });
    assert.equal(r.items.length, quiz.length);
    for (const item of r.items) {
      const src = quiz.find((c) => c.id === item.conceptId);
      assert.equal(item.options.length, 4);
      assert.equal(item.options.filter((o) => o.correct).length, 1, `${item.conceptId} must have exactly one right answer`);
      for (const o of item.options) {
        const orig = src.options.find((x) => x.text === o.text);
        assert.ok(orig, "an option was invented");
        assert.equal(o.explanation, orig.explanation, "an authored explanation was lost");
      }
    }
  });

  test("flashcards get generated distractors that name their real owner", () => {
    const cards = CONCEPTS.filter((c) => c.kind === "card");
    const r = generateRapidFire(cards, { count: 5, rng: makeRng(3), pool: cards });
    assert.ok(r.items.length > 0);
    for (const item of r.items) {
      assert.equal(item.options.length, 4);
      assert.equal(item.options.filter((o) => o.correct).length, 1);
      for (const o of item.options.filter((x) => !x.correct)) {
        assert.match(o.explanation, /^That's the definition of /);
      }
      // No duplicate options -- a card must never appear twice on one item.
      assert.equal(new Set(item.options.map((o) => o.text)).size, 4);
    }
  });

  test("options are shuffled, not always in authored order", () => {
    const quiz = CONCEPTS.filter((c) => c.kind === "quiz");
    const r = generateRapidFire(quiz, { count: 999, rng: makeRng(17) });
    const firstIsCorrect = r.items.filter((i) => i.options[0].correct).length;
    assert.ok(firstIsCorrect < r.items.length, "the answer is always first");
    assert.ok(firstIsCorrect > 0, "the answer is never first");
  });

  test("a card pool too small for distractors yields no card items rather than bad ones", () => {
    const cards = CONCEPTS.filter((c) => c.kind === "card").slice(0, 2);
    const r = generateRapidFire(cards, { count: 2, rng: makeRng(1), pool: cards });
    assert.equal(r.items.length, 0);
  });
});

describe("generators: formula builder", () => {
  test("tokenizes a formula into function heads, args, commas and parens", () => {
    assert.deepEqual(
      tokenizeFormula("=XLOOKUP(lookup_value, lookup_array, return_array)"),
      ["=XLOOKUP(", "lookup_value", ",", "lookup_array", ",", "return_array", ")"],
    );
  });

  test("tokenizes a nested formula", () => {
    assert.deepEqual(
      tokenizeFormula("=INDEX(range, MATCH(val, col, 0))"),
      ["=INDEX(", "range", ",", "MATCH(", "val", ",", "col", ",", "0", ")", ")"],
    );
  });

  test("mines real formulas out of the curriculum's own prose", () => {
    assert.ok(FORMULAS.length >= 4, `only mined ${FORMULAS.length} formulas`);
    const found = FORMULAS.map((f) => f.formula);
    assert.ok(found.some((f) => f.startsWith("=XLOOKUP(")));
    assert.ok(found.some((f) => f.startsWith("=INDEX(")));
    assert.ok(found.some((f) => f.startsWith("=COUNTIFS(")));
  });

  test("every mined formula has balanced parens and survives tokenizing", () => {
    for (const f of FORMULAS) {
      let depth = 0;
      for (const ch of f.formula) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        assert.ok(depth >= 0, `${f.formula} closes a paren it never opened`);
      }
      assert.equal(depth, 0, `${f.formula} has unbalanced parens`);
      assert.equal(f.tokens.join("").replace(/\s/g, ""), f.formula.replace(/\s/g, ""));
    }
  });

  test("mined formulas are de-duplicated", () => {
    const keys = FORMULAS.map((f) => f.formula.replace(/\s/g, "").toUpperCase());
    assert.equal(new Set(keys).size, keys.length);
  });

  test("the solution assembles back into the target", () => {
    for (let i = 0; i < FORMULAS.length; i++) {
      const round = generateFormulaBuilder(FORMULAS, { index: i, rng: makeRng(i + 1) });
      assert.equal(checkFormulaBuilder(round, round.solution).correct, true, `${round.target} cannot be solved`);
    }
  });

  test("whitespace never counts against the learner", () => {
    const round = generateFormulaBuilder(FORMULAS, { index: 0, rng: makeRng(1) });
    assert.equal(checkFormulaBuilder(round, round.solution).correct, true);
  });

  test("a wrong order is wrong", () => {
    const round = generateFormulaBuilder(FORMULAS, { index: 0, rng: makeRng(1) });
    const scrambled = [...round.solution].reverse();
    assert.equal(checkFormulaBuilder(round, scrambled).correct, false);
    assert.equal(checkFormulaBuilder(round, []).correct, false);
  });

  test("distractor tokens are real Excel from other formulas, not noise", () => {
    const round = generateFormulaBuilder(FORMULAS, { index: 0, rng: makeRng(2), distractors: 2 });
    const noise = round.tokens.filter((t) => t.id.startsWith("d"));
    assert.ok(noise.length > 0);
    const everyRealToken = new Set(FORMULAS.flatMap((f) => f.tokens));
    for (const t of noise) assert.ok(everyRealToken.has(t.text), `${t.text} is not a real token`);
  });

  test("every solution token is on the board", () => {
    const round = generateFormulaBuilder(FORMULAS, { index: 1, rng: makeRng(3) });
    const ids = new Set(round.tokens.map((t) => t.id));
    for (const id of round.solution) assert.ok(ids.has(id));
  });

  test("no formulas yields null rather than a broken round", () => {
    assert.equal(generateFormulaBuilder([], { rng: makeRng(1) }), null);
  });
});

describe("generators: error hunt (real sheet evaluation)", () => {
  test("the correct workbook computes the verified HMDA ground truth", () => {
    const s = buildFourFifthsWorkbook();
    // Black 9/16 = 56.25%, White 43/50 = 86%, Asian 8/10 = 80%, Hispanic 12/18
    assert.equal(getValue(s, "D2"), 0.5625);
    assert.equal(getValue(s, "D3"), 0.86);
    assert.equal(getValue(s, "D4"), 0.8);
    assert.ok(Math.abs(getValue(s, "D5") - 12 / 18) < 1e-12);
    // ratios are against the highest rate (White, 86%)
    assert.equal(getValue(s, "E3"), 1);
    assert.ok(Math.abs(getValue(s, "E2") - 0.5625 / 0.86) < 1e-12);
    // and the four-fifths flags land on Black and Hispanic
    assert.equal(getValue(s, "F2"), "FLAG");
    assert.equal(getValue(s, "F3"), "OK");
    assert.equal(getValue(s, "F4"), "OK");
    assert.equal(getValue(s, "F5"), "FLAG");
  });

  test("the workbook matches the group totals the curriculum teaches", () => {
    assert.equal(HMDA_GROUPS.reduce((n, g) => n + g.approved, 0), 72);
    assert.equal(HMDA_GROUPS.reduce((n, g) => n + g.total, 0), 94);
  });

  for (const bug of BUG_KINDS) {
    test(`the ${bug.kind} bug is real: it actually breaks a computed value`, () => {
      const round = generateErrorHunt({ kind: bug.kind });
      const asShipped = checkErrorHunt(round, {});
      assert.equal(asShipped.solved, false, `${bug.kind} changes nothing, so there is no bug to find`);
      assert.ok(asShipped.wrong.length > 0);
    });

    test(`the ${bug.kind} bug is fixable by its canonical fix`, () => {
      const round = generateErrorHunt({ kind: bug.kind });
      const fixed = checkErrorHunt(round, { [round.solution.ref]: round.solution.input });
      assert.equal(fixed.solved, true, `${bug.kind}: the canonical fix leaves ${JSON.stringify(fixed.wrong)} wrong`);
    });
  }

  test("the bug lives in the cell the round says it does", () => {
    for (const bug of BUG_KINDS) {
      const round = generateErrorHunt({ kind: bug.kind });
      assert.equal(round.bug.ref, bug.ref);
      // Reverting only that one cell fixes the whole workbook.
      assert.equal(checkErrorHunt(round, { [bug.ref]: round.solution.input }).solved, true);
    }
  });

  test("ANY formula producing the right numbers passes, not just ours", () => {
    const round = generateErrorHunt({ kind: "wrongDivisor" });
    // A different-but-correct way to write the same thing.
    assert.equal(checkErrorHunt(round, { E2: "=D2/MAX($D$2:$D$5)" }).solved, true);
    assert.equal(checkErrorHunt(round, { E2: "=(C2/B2)/MAX($D$2:$D$5)" }).solved, true);
  });

  test("a wrong fix does not pass", () => {
    const round = generateErrorHunt({ kind: "wrongDivisor" });
    assert.equal(checkErrorHunt(round, { E2: "=D2/MIN($D$2:$D$5)" }).solved, false);
    assert.equal(checkErrorHunt(round, { E2: "=D2" }).solved, false);
    // Hardcoding the expected number is not a fix of the formula, but it does
    // produce the right value -- so it passes, exactly like it would in Excel.
    // What must NOT pass is a value that is merely close.
    assert.equal(checkErrorHunt(round, { E2: 0.65 }).solved, false);
  });

  test("an unfixed round reports which cells are wrong", () => {
    const round = generateErrorHunt({ kind: "invertedComparison" });
    const r = checkErrorHunt(round, {});
    assert.deepEqual(r.wrong, ["F2"]);
    assert.equal(r.values.F2, "OK");
    assert.equal(round.expected.F2, "FLAG");
  });

  test("expected values are computed from the correct workbook", () => {
    const round = generateErrorHunt({ kind: "invertedRatio" });
    // expected is the truth, captured before the bug was injected -- the
    // shipped sheet's own D2 is the broken =B2/C2.
    assert.equal(round.expected.D2, 0.5625);
    assert.equal(checkErrorHunt(round, {}).values.D2, 16 / 9);
  });

  test("a formula error is captured as its Excel code, not as a crash", () => {
    // D2 is =C2/B2 in this round, so zeroing the denominator really does
    // divide by zero in the engine.
    const round = generateErrorHunt({ kind: "invertedComparison" });
    const broke = checkErrorHunt(round, { B2: 0 });
    assert.equal(broke.solved, false);
    assert.equal(typeof broke.values.D2, "string");
    assert.match(broke.values.D2, /#DIV\/0!/);
    // ...and the error propagates to the cells downstream of it.
    assert.match(broke.values.E2, /#DIV\/0!/);
  });

  test("the round ships broken and serializable", () => {
    const round = generateErrorHunt({ rng: makeRng(1) });
    assert.deepEqual(JSON.parse(JSON.stringify(round.sheet)), round.sheet);
    assert.equal(checkErrorHunt(round, {}).solved, false);
  });

  test("an unknown bug kind throws rather than shipping an unbroken round", () => {
    assert.throws(() => generateErrorHunt({ kind: "notARealBug" }));
  });

  test("the same seed produces the same bug", () => {
    const a = generateErrorHunt({ rng: makeRng(12) });
    const b = generateErrorHunt({ rng: makeRng(12) });
    assert.equal(a.bug.kind, b.bug.kind);
  });
});

/* ══════════════════════════════════════════════ session planning ══ */

describe("generators: session planning", () => {
  test("new concepts start on recognition, not free recall", () => {
    const quiz = CONCEPTS.find((c) => c.kind === "quiz");
    const card = CONCEPTS.find((c) => c.kind === "card");
    assert.equal(suggestGame(quiz, undefined, { now: NOW }), "rapidFire");
    assert.equal(suggestGame(card, newCard(card.id, { now: NOW }), { now: NOW }), "match");
  });

  test("a well-known, typeable concept graduates to free recall", () => {
    const c = CONCEPTS.find((x) => x.kind === "card" && isRecallable(x));
    let card = newCard(c.id, { now: NOW });
    for (let i = 0; i < 6; i++) card = reviewCard(card, GRADE.EASY, { now: NOW });
    assert.equal(suggestGame(c, card, { now: NOW }), "recall");
  });

  test("a concept too long to type never graduates to recall", () => {
    const c = CONCEPTS.find((x) => !isRecallable(x));
    let card = newCard(c.id, { now: NOW });
    for (let i = 0; i < 6; i++) card = reviewCard(card, GRADE.EASY, { now: NOW });
    assert.equal(suggestGame(c, card, { now: NOW }), "rapidFire");
  });

  test("a struggling concept drops back to recognition", () => {
    const c = CONCEPTS.find((x) => x.kind === "card" && isRecallable(x));
    let card = newCard(c.id, { now: NOW });
    for (let i = 0; i < 5; i++) card = reviewCard(card, GRADE.AGAIN, { now: NOW });
    assert.equal(suggestGame(c, card, { now: NOW }), "match");
  });

  test("planSession routes the SRS queue into games", () => {
    const deck = {};
    const plan = planSession(CONCEPTS, deck, { now: NOW, newPerSession: 6, limit: 6 });
    assert.equal(plan.conceptIds.length, 6);
    assert.equal(plan.plan.length, 6);
    assert.ok(plan.plan.every((p) => p.isNew));
    assert.ok(Object.keys(plan.byGame).length > 0);
    for (const [game, ids] of Object.entries(plan.byGame)) {
      assert.ok(["match", "rapidFire", "recall"].includes(game));
      assert.ok(ids.length > 0);
    }
  });

  test("planSession puts due reviews ahead of new material", () => {
    const target = CONCEPTS[3].id;
    let deck = defaultDeck();
    deck = reviewInDeck(deck, target, GRADE.GOOD, { now: NOW }); // due 07-16
    const plan = planSession(CONCEPTS, deck, { now: "2026-07-20", newPerSession: 3, limit: 4 });
    assert.equal(plan.conceptIds[0], target);
    assert.equal(plan.plan[0].isNew, false);
  });

  test("an empty curriculum plans an empty session", () => {
    const plan = planSession([], {}, { now: NOW });
    assert.deepEqual(plan.conceptIds, []);
    assert.deepEqual(plan.byGame, {});
  });
});
