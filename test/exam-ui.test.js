import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSession, examOffering } from "../lib/exam/banks.js";
// lib/exam/ seeds every cert with an EMPTY bank and takes its content through
// registerBank(); data/registry.js is what attaches the real ones. Importing it
// for its side effect is exactly what Dashboard.js does, so the Series 65
// fixtures below are drawn from the same bank the app draws from. Without this
// the engine is intact and honest — it just has no questions, and every fixture
// here would be a real 0-question form.
import "../data/registry.js";
import {
  answerItem, toggleFlag, goTo, submitSession, pauseSession, remainingMs,
  tick as tickSession, MODES,
} from "../lib/exam/session.js";
import { clockRunning } from "../components/exam/exam-clock.js";
import { buildReview } from "../lib/exam/review.js";
import {
  attachExam, coachingAllowed, modeLabel, formIntegrity, scoreCaveats, isOfficialResult,
  formatClock, speakClock, timerLevel, crossedMilestone, milestoneMessage, WARN_AT_SEC,
  isAnswered, chosenIndex, navigatorEntries, answerSheetSummary, nextOutstanding,
  submitWarning, optionVerdict, filterReview, reviewCounts, ReviewFilter,
  formatPct, questionsToPass, blueprintRows, modeRows,
} from "../components/exam/adapter.js";

/* ══════════════════════════════════════════════════════════════════
   Fixtures come from the REAL engine, not from hand-written stubs.
   These helpers must keep working against lib/exam as it is actually
   shipped — that is the whole point of testing the seam.
   ══════════════════════════════════════════════════════════════════ */

/** A real Series 65 warmup session (10 blueprint-weighted questions). */
const warmup = (seed = 1) => buildSession({ certId: "series65", mode: "warmup", seed, now: 0 });

/** Answer item `i` of a session correctly / incorrectly. */
const answerCorrect = (s, i, now = 0) =>
  answerItem(s, s.form.items[i].id, s.form.items[i].correctIndex, { now });
const answerWrong = (s, i, now = 0) => {
  const item = s.form.items[i];
  const bad = item.options.findIndex((_, j) => j !== item.correctIndex);
  return answerItem(s, item.id, bad, { now });
};

/* ══════════════════════════════════════════════════════════════════
   The seam. attachExam must adapt the REAL engine, not a fantasy of it.
   ══════════════════════════════════════════════════════════════════ */
describe("attachExam: against the real lib/exam", () => {
  test("the real engine is available by default — no injection needed", () => {
    assert.equal(attachExam().available, true);
  });

  test("listExams hides skills tracks, which have no form to sit", () => {
    const list = attachExam().listExams();
    assert.ok(list.length > 0);
    assert.equal(list.some((e) => e.certId === "cfi"), false, "CFI is a skills credential");
    assert.equal(list.some((e) => e.certId === "series65"), true);
  });

  test("start returns a real session", () => {
    const r = attachExam().start({ certId: "series65", mode: "warmup", seed: 1, now: 0 });
    assert.equal(r.ok, true);
    assert.equal(r.value.form.items.length, 10);
  });

  test("an engine throw becomes a value carrying the engine's own prose", () => {
    const r = attachExam().start({ certId: "nope-not-a-cert" });
    assert.equal(r.ok, false);
    assert.match(r.error, /no exam registered/i);
    assert.equal(r.code, "UNKNOWN_CERT");
  });

  test("a mock refuses to pause, and says why in words a learner can read", () => {
    const ex = attachExam();
    const s = ex.start({ certId: "series65", mode: "mock", seed: 1, now: 0 });
    const paused = ex.pause(s.value, 1000);
    assert.equal(paused.ok, false);
    assert.match(paused.error, /no pause button/i, "the engine's message must reach the UI intact");
  });

  test("a pausable mode does pause", () => {
    const ex = attachExam();
    const s = ex.start({ certId: "series65", mode: "warmup", seed: 1, now: 0 });
    assert.equal(ex.pause(s.value, 1000).ok, true);
  });

  test("reads never throw into a render, even on garbage", () => {
    const ex = attachExam();
    assert.equal(ex.remaining(null, 0), null);
    assert.equal(ex.currentItem(null), null);
    assert.equal(ex.isExpired(null, 0), false);
    assert.equal(ex.score(null), null);
    assert.equal(ex.review(null), null);
  });

  test("a session round-trips through serialize/restore", () => {
    const ex = attachExam();
    const s = answerCorrect(warmup(), 0);
    const json = ex.serialize(s);
    const back = ex.restore(json);
    assert.equal(back.ok, true);
    assert.deepEqual(back.value.answers, s.answers);
  });

  test("a corrupt saved attempt is refused with a reason, not silently dropped", () => {
    const r = attachExam().restore("{not json");
    assert.equal(r.ok, false);
    assert.match(r.error, /not valid JSON/i);
  });

  test("scoring and review are the ENGINE's, not ours", () => {
    const ex = attachExam();
    let s = warmup();
    for (let i = 0; i < s.form.items.length; i += 1) s = answerCorrect(s, i);
    s = submitSession(s, { now: 1000 });
    assert.equal(ex.score(s).correct, 10);
    assert.equal(ex.review(s).items.length, 10);
  });

  test("a stub engine can still be injected", () => {
    const ex = attachExam({ buildSession: () => "S", listExams: () => [{ certId: "x", kind: "multiple-choice" }] });
    assert.equal(ex.available, true);
    assert.equal(ex.start({}).value, "S");
  });

  test("an engine missing the entry points reports unavailable", () => {
    assert.equal(attachExam({}).available, false);
  });
});

/* ══════════════════════════════════════════════════════════════════
   Coaching. The line the whole feature turns on.
   ══════════════════════════════════════════════════════════════════ */
describe("coachingAllowed: a mock never tells you as you go", () => {
  test("a full mock may NOT be coached", () => {
    assert.equal(coachingAllowed("mock"), false);
  });

  test("the learning modes may be", () => {
    assert.equal(coachingAllowed("warmup"), true);
    assert.equal(coachingAllowed("retry"), true);
    assert.equal(coachingAllowed("section"), true);
  });

  test("an unknown mode is not coachable — fail closed, never leak an answer", () => {
    assert.equal(coachingAllowed("nonsense"), false);
    assert.equal(coachingAllowed(undefined), false);
  });

  test("the rule tracks the engine's own mode table rather than a private list", () => {
    for (const id of Object.keys(MODES)) {
      assert.equal(coachingAllowed(id), id !== "mock", `mode ${id}`);
    }
  });

  test("a coached run is labelled as such, so it is never mistaken for a mock", () => {
    assert.match(modeLabel("warmup", true), /coached/i);
    assert.equal(modeLabel("mock", false), MODES.mock.label);
  });
});

/* ══════════════════════════════════════════════════════════════════
   The clock's presentation. (The clock itself is lib/exam's.)
   ══════════════════════════════════════════════════════════════════ */
describe("formatClock", () => {
  test("shows H:MM:SS past an hour", () => {
    assert.equal(formatClock(10_800_000), "3:00:00");
    assert.equal(formatClock(3_661_000), "1:01:01");
  });

  test("shows M:SS under an hour", () => {
    assert.equal(formatClock(300_000), "5:00");
    assert.equal(formatClock(59_000), "0:59");
  });

  test("rounds UP, so a clock with time left never reads 0:00", () => {
    assert.equal(formatClock(1), "0:01", "1ms left is still time left");
    assert.equal(formatClock(999), "0:01");
    assert.equal(formatClock(0), "0:00", "and no time left reads as none");
  });

  test("an untimed clock is honest about having no number", () => {
    assert.equal(formatClock(null), "--:--");
    assert.equal(formatClock(undefined), "--:--");
  });
});

describe("speakClock: a screen reader hears words, not a colon", () => {
  test("speaks hours and minutes", () => {
    assert.equal(speakClock(3_600_000), "1 hour remaining");
    assert.equal(speakClock(5_400_000), "1 hour 30 minutes remaining");
  });
  test("speaks seconds only in the last minute", () => {
    assert.equal(speakClock(30_000), "30 seconds remaining");
  });
  test("expiry is spoken, not implied by silence", () => {
    assert.equal(speakClock(0), "Time is up");
  });
  test("untimed says so", () => {
    assert.equal(speakClock(null), "Untimed");
  });
});

describe("timerLevel: real thresholds only, no manufactured panic", () => {
  test("an hour out is normal", () => {
    assert.equal(timerLevel(3_600_000), "normal");
  });
  test("nothing escalates before a real five minutes", () => {
    assert.equal(timerLevel(WARN_AT_SEC * 1000 + 1), "normal");
  });
  test("five minutes exactly is the warning", () => {
    assert.equal(timerLevel(WARN_AT_SEC * 1000), "warning");
  });
  test("the last minute is final", () => {
    assert.equal(timerLevel(60_000), "final");
    assert.equal(timerLevel(1), "final");
  });
  test("zero is expired", () => {
    assert.equal(timerLevel(0), "expired");
  });
  test("an untimed session has no level", () => {
    assert.equal(timerLevel(null), "none");
  });
});

describe("crossedMilestone: the live region speaks only at real thresholds", () => {
  test("an ordinary tick announces nothing", () => {
    assert.equal(crossedMilestone(600_000, 599_750), null);
  });

  test("crossing five minutes announces once", () => {
    assert.equal(crossedMilestone(300_001, 300_000), WARN_AT_SEC);
    assert.equal(milestoneMessage(WARN_AT_SEC), "Five minutes remaining.");
  });

  test("having already crossed, it does not announce again", () => {
    assert.equal(crossedMilestone(299_000, 298_000), null, "a second announcement would be spam");
  });

  test("a 250ms paint loop over a real 3-hour mock announces exactly 5 times", () => {
    // Simulates the ExamTimer repaint loop across the full Series 65 clock.
    const limit = 10_800_000;
    let prev = limit;
    const said = [];
    for (let t = 250; t <= limit; t += 250) {
      const cur = limit - t;
      const m = crossedMilestone(prev, cur);
      if (m !== null) said.push(m);
      prev = cur;
    }
    assert.deepEqual(said, [1800, 900, 300, 60, 0]);
    assert.ok(
      said.length < 43_200,
      "a live region bound to the digits would speak 43,200 times — that is the bug this prevents"
    );
  });

  test("hitting zero announces the auto-submit", () => {
    assert.equal(crossedMilestone(1, 0), 0);
    assert.match(milestoneMessage(0), /Time is up/);
  });

  test("an untimed clock never announces", () => {
    assert.equal(crossedMilestone(null, null), null);
    assert.equal(crossedMilestone(undefined, undefined), null);
  });
});

/* ══════════════════════════════════════════════════════════════════
   THE INDEX-0 TRAP.
   An answer is an option INDEX. Index 0 is a real answer and is falsy.
   ══════════════════════════════════════════════════════════════════ */
describe("answered-ness: option index 0 is an answer, not a blank", () => {
  test("picking the FIRST option counts as answered", () => {
    const s = warmup();
    const id = s.form.items[0].id;
    const answered = answerItem(s, id, 0, { now: 0 });
    assert.equal(answered.answers[id], 0);
    assert.equal(isAnswered(answered, id), true, "a truthiness check would call this blank");
    assert.equal(chosenIndex(answered, id), 0);
  });

  test("an untouched item is unanswered", () => {
    const s = warmup();
    assert.equal(isAnswered(s, s.form.items[0].id), false);
    assert.equal(chosenIndex(s, s.form.items[0].id), null);
  });

  test("the navigator counts a first-option answer", () => {
    const s = answerItem(warmup(), warmup().form.items[0].id, 0, { now: 0 });
    assert.equal(navigatorEntries(s)[0].answered, true);
    assert.equal(answerSheetSummary(s).answered, 1);
  });

  test("a whole form answered with option 0 is complete, not empty", () => {
    let s = warmup();
    for (const it of s.form.items) s = answerItem(s, it.id, 0, { now: 0 });
    const sum = answerSheetSummary(s);
    assert.equal(sum.answered, 10);
    assert.equal(sum.unanswered, 0);
    assert.equal(sum.complete, true);
  });

  test("submitWarning does not scold a fully-answered-with-option-0 sheet", () => {
    let s = warmup();
    for (const it of s.form.items) s = answerItem(s, it.id, 0, { now: 0 });
    assert.equal(submitWarning(s), "Every question is answered.");
  });

  test("nextOutstanding does not send you back to a first-option answer", () => {
    let s = warmup();
    for (const it of s.form.items) s = answerItem(s, it.id, 0, { now: 0 });
    assert.equal(nextOutstanding(s), null);
  });
});

/* ══════════════════════════════════════════════════════════════════
   The navigator + answer sheet.
   ══════════════════════════════════════════════════════════════════ */
describe("the navigator", () => {
  test("one entry per item, numbered from 1", () => {
    const e = navigatorEntries(warmup());
    assert.equal(e.length, 10);
    assert.equal(e[0].number, 1);
    assert.equal(e[9].number, 10);
  });

  test("answered / flagged / current are all distinguishable", () => {
    let s = warmup();
    s = answerCorrect(s, 1);
    s = toggleFlag(s, s.form.items[2].id, { now: 0 });
    s = goTo(s, 3, { now: 0 });
    const e = navigatorEntries(s);
    assert.equal(e[0].answered, false);
    assert.equal(e[1].answered, true);
    assert.equal(e[2].flagged, true);
    assert.equal(e[3].current, true);
    assert.equal(e[1].current, false);
  });

  test("an item can be answered AND flagged at once — that is what triage is", () => {
    let s = warmup();
    s = answerCorrect(s, 0);
    s = toggleFlag(s, s.form.items[0].id, { now: 0 });
    const e = navigatorEntries(s)[0];
    assert.equal(e.answered, true);
    assert.equal(e.flagged, true);
  });

  test("entries carry a section label for grouping", () => {
    assert.equal(typeof navigatorEntries(warmup())[0].section, "string");
  });

  test("an empty session yields no entries rather than throwing", () => {
    assert.deepEqual(navigatorEntries(null), []);
    assert.deepEqual(navigatorEntries({}), []);
  });
});

describe("answerSheetSummary", () => {
  test("counts a blank sheet", () => {
    const s = answerSheetSummary(warmup());
    assert.equal(s.total, 10);
    assert.equal(s.answered, 0);
    assert.equal(s.unanswered, 10);
    assert.equal(s.complete, false);
  });

  test("counts a partial sheet", () => {
    let s = warmup();
    s = answerCorrect(s, 0);
    s = answerCorrect(s, 1);
    s = toggleFlag(s, s.form.items[5].id, { now: 0 });
    const sum = answerSheetSummary(s);
    assert.equal(sum.answered, 2);
    assert.equal(sum.unanswered, 8);
    assert.equal(sum.flagged, 1);
    assert.equal(sum.fractionAnswered, 0.2);
  });

  test("an empty form is not 'complete'", () => {
    assert.equal(answerSheetSummary({ form: { items: [] } }).complete, false);
    assert.equal(answerSheetSummary({ form: { items: [] } }).fractionAnswered, 0);
  });
});

describe("nextOutstanding: triage", () => {
  test("finds the next unanswered item after the cursor", () => {
    let s = warmup();
    s = answerCorrect(s, 1);
    assert.equal(nextOutstanding(s), 2, "item 1 is answered, so the next gap is 2");
  });

  test("wraps to the top", () => {
    let s = warmup();
    for (let i = 0; i < 10; i += 1) s = answerCorrect(s, i);
    s = toggleFlag(s, s.form.items[0].id, { now: 0 });
    s = goTo(s, 5, { now: 0 });
    assert.equal(nextOutstanding(s), 0);
  });

  test("a flagged-but-answered item still counts as outstanding", () => {
    let s = warmup();
    for (let i = 0; i < 10; i += 1) s = answerCorrect(s, i);
    s = toggleFlag(s, s.form.items[3].id, { now: 0 });
    assert.equal(nextOutstanding(s), 3);
  });

  test("nothing outstanding returns null, not 0", () => {
    let s = warmup();
    for (let i = 0; i < 10; i += 1) s = answerCorrect(s, i);
    assert.equal(nextOutstanding(s), null);
  });
});

describe("submitWarning", () => {
  test("names the unanswered count and what happens to them", () => {
    const w = submitWarning(warmup());
    assert.match(w, /10 questions are unanswered/);
    assert.match(w, /scored as wrong/);
  });

  test("one unanswered reads as singular", () => {
    let s = warmup();
    for (let i = 0; i < 9; i += 1) s = answerCorrect(s, i);
    assert.match(submitWarning(s), /1 question is unanswered/);
  });

  test("counts flags too", () => {
    let s = warmup();
    for (let i = 0; i < 10; i += 1) s = answerCorrect(s, i);
    s = toggleFlag(s, s.form.items[0].id, { now: 0 });
    assert.match(submitWarning(s), /1 is still flagged/);
  });
});

/* ══════════════════════════════════════════════════════════════════
   Review presentation — over the ENGINE's review.
   ══════════════════════════════════════════════════════════════════ */
describe("optionVerdict", () => {
  test("names all four states from the engine's flags", () => {
    assert.equal(optionVerdict({ isCorrect: true, chosen: true }), "correct-chosen");
    assert.equal(optionVerdict({ isCorrect: true, chosen: false }), "correct-missed");
    assert.equal(optionVerdict({ isCorrect: false, chosen: true }), "wrong-chosen");
    assert.equal(optionVerdict({ isCorrect: false, chosen: false }), "wrong");
  });

  test("every option of a real reviewed item gets a verdict", () => {
    let s = answerWrong(warmup(), 0);
    s = submitSession(s, { now: 1000 });
    const item = buildReview(s).items[0];
    const verdicts = item.options.map(optionVerdict);
    assert.equal(verdicts.filter((v) => v === "correct-missed").length, 1);
    assert.equal(verdicts.filter((v) => v === "wrong-chosen").length, 1);
  });
});

describe("review filters over a real review", () => {
  const reviewed = () => {
    let s = warmup();
    s = answerCorrect(s, 0);
    s = answerWrong(s, 1);
    s = toggleFlag(s, s.form.items[2].id, { now: 0 });
    s = submitSession(s, { now: 1000 });
    return buildReview(s).items;
  };

  test("wrong-only is the list worth studying", () => {
    const w = filterReview(reviewed(), ReviewFilter.WRONG);
    assert.equal(w.length, 1);
    assert.equal(w[0].status, "incorrect");
  });

  test("skipped is separate from wrong — different problem, different fix", () => {
    const items = reviewed();
    assert.equal(filterReview(items, ReviewFilter.SKIPPED).length, 8);
    assert.equal(filterReview(items, ReviewFilter.WRONG).length, 1);
  });

  test("flagged and correct filter too", () => {
    const items = reviewed();
    assert.equal(filterReview(items, ReviewFilter.FLAGGED).length, 1);
    assert.equal(filterReview(items, ReviewFilter.CORRECT).length, 1);
  });

  test("all returns everything", () => {
    assert.equal(filterReview(reviewed(), ReviewFilter.ALL).length, 10);
  });

  test("the chips add up: every item lands in exactly one outcome", () => {
    const c = reviewCounts(reviewed());
    assert.deepEqual(c, { all: 10, wrong: 1, skipped: 8, flagged: 1, correct: 1 });
    assert.equal(c.wrong + c.skipped + c.correct, c.all);
  });

  test("filters survive an empty/absent list", () => {
    assert.deepEqual(filterReview(null, ReviewFilter.WRONG), []);
    assert.equal(reviewCounts(null).all, 0);
  });

  test("the engine really does carry an explanation for every option", () => {
    // This is the payload ExamReview renders. If it ever empties, the review
    // becomes a tally sheet and the feature loses its reason to exist.
    for (const item of reviewed()) {
      for (const o of item.options) {
        assert.ok(o.explanation.length > 0, `"${o.text}" has no explanation to teach from`);
      }
    }
  });
});

/* ══════════════════════════════════════════════════════════════════
   Honesty: a short form and an indicative score must reach the screen.
   ══════════════════════════════════════════════════════════════════ */
describe("formIntegrity", () => {
  test("a faithful form says so", () => {
    const s = warmup();
    const integ = formIntegrity(s.form);
    assert.equal(integ.ok, s.form.faithful && !(s.form.warnings ?? []).length);
  });

  test("a short form is not ok, and relays the ENGINE's own warnings verbatim", () => {
    const form = {
      items: [{ id: "a" }],
      faithful: false,
      shortfalls: [{ section: "laws", drawn: 1, quota: 39, short: 38 }],
      warnings: ["Laws: the bank holds only 1 of the 39 questions this section is worth."],
    };
    const integ = formIntegrity(form);
    assert.equal(integ.ok, false);
    assert.equal(integ.severity, "warning");
    assert.deepEqual(integ.notes, form.warnings, "do not paraphrase prose written for a learner");
  });

  test("a section missing entirely is an error, not a warning", () => {
    const integ = formIntegrity({
      items: [{ id: "a" }],
      faithful: false,
      shortfalls: [{ section: "laws", drawn: 0, quota: 39, short: 39 }],
      warnings: ["Laws has no questions at all."],
    });
    assert.equal(integ.severity, "error");
    assert.match(integ.headline, /whole section is missing/i);
  });

  test("an empty form is an error", () => {
    const integ = formIntegrity({ items: [], faithful: false, shortfalls: [], warnings: [] });
    assert.equal(integ.severity, "error");
    assert.match(integ.headline, /empty/i);
  });

  test("no form is not an error to render", () => {
    assert.equal(formIntegrity(null).ok, true);
  });
});

describe("score honesty relays the engine's judgment, never overrides it", () => {
  const finished = () => {
    let s = warmup();
    for (let i = 0; i < 10; i += 1) s = answerCorrect(s, i);
    return submitSession(s, { now: 1000 });
  };

  test("a 10-question warmup is NOT an official result, however well it went", () => {
    const score = attachExam().score(finished());
    assert.equal(score.correct, 10);
    assert.equal(isOfficialResult(score), false, "a warmup is not a mock");
    assert.equal(score.verdict, "indicative");
  });

  test("and the engine's caveats explain why, in the learner's language", () => {
    const caveats = scoreCaveats(attachExam().score(finished()));
    assert.ok(caveats.length > 0, "a non-official score must carry its reasons");
    assert.ok(caveats.every((c) => typeof c === "string" && c.length > 0));
  });

  test("no score, no caveats — and no crash", () => {
    assert.deepEqual(scoreCaveats(null), []);
    assert.equal(isOfficialResult(null), false);
  });
});

describe("formatPct: the engine speaks 0..100, not fractions", () => {
  test("a percent renders as itself", () => {
    assert.equal(formatPct(72), "72%");
    assert.equal(formatPct(56.25, 2), "56.25%");
  });
  test("null is a dash, never 0%", () => {
    assert.equal(formatPct(null), "—");
    assert.equal(formatPct(undefined), "—");
  });
  test("a real score's rawPct renders sanely", () => {
    let s = warmup();
    for (let i = 0; i < 10; i += 1) s = answerCorrect(s, i);
    const score = attachExam().score(submitSession(s, { now: 1000 }));
    assert.equal(formatPct(score.rawPct), "100%");
  });
});

describe("questionsToPass: actionable, in questions", () => {
  test("a near-miss is expressed in questions", () => {
    let s = warmup();
    for (let i = 0; i < 5; i += 1) s = answerCorrect(s, i);
    const score = attachExam().score(submitSession(s, { now: 1000 }));
    assert.equal(score.correct, 5);
    assert.equal(questionsToPass(score), score.passMark.count - 5);
  });

  test("a pass needs no more questions", () => {
    let s = warmup();
    for (let i = 0; i < 10; i += 1) s = answerCorrect(s, i);
    assert.equal(questionsToPass(attachExam().score(submitSession(s, { now: 1000 }))), 0);
  });

  test("no score is 0, not NaN", () => {
    assert.equal(questionsToPass(null), 0);
  });
});

/* ══════════════════════════════════════════════════════════════════
   The start screen's blueprint + mode tables.
   ══════════════════════════════════════════════════════════════════ */
describe("blueprintRows: what you are about to be tested on", () => {
  test("carries the real Series 65 sections with weights and quotas", () => {
    const rows = blueprintRows(examOffering("series65"));
    assert.equal(rows.length, 4);
    const sum = rows.reduce((a, r) => a + r.weight, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, "blueprint weights are fractions that sum to 1");
    for (const r of rows) {
      assert.equal(typeof r.label, "string");
      assert.equal(typeof r.quota, "number");
      assert.equal(typeof r.available, "number");
    }
  });

  test("a section the bank is short on reports it, so the UI can show it", () => {
    const rows = blueprintRows(examOffering("series65"));
    for (const r of rows) {
      assert.equal(r.short, Math.max(0, r.quota - r.available));
    }
  });

  test("no offering, no rows", () => {
    assert.deepEqual(blueprintRows(null), []);
  });
});

describe("modeRows: an unavailable mode is explained, not hidden", () => {
  test("every mode from the real offering gets a row", () => {
    const rows = modeRows(examOffering("series65"));
    assert.deepEqual(rows.map((r) => r.id).sort(), ["mock", "retry", "section", "warmup"]);
  });

  test("retry is unavailable up front, with a reason a learner can act on", () => {
    const retry = modeRows(examOffering("series65")).find((r) => r.id === "retry");
    assert.equal(retry.available, false);
    assert.match(retry.why, /Sit an exam first/i);
  });

  test("an available mode carries no excuse", () => {
    const warm = modeRows(examOffering("series65")).find((r) => r.id === "warmup");
    assert.equal(warm.available, true);
    assert.equal(warm.why, null);
  });

  test("no offering, no rows", () => {
    assert.deepEqual(modeRows(null), []);
  });
});

/* ══════════════════════════════════════════════════════════════════
   FINDING 1 — the clock froze on the submit-confirmation panel.

   ExamHost gated the countdown AND its persistence heartbeat on the UI
   phase (`paused={phase !== "exam"}`). Opening the confirm panel therefore
   stopped the display — but NOT the engine, which derives remaining time
   from an absolute `runningSince` stamp and cannot be paused on a mock. The
   learner watched a frozen 3:00, then hit "Back to questions" and was thrown
   straight to 0:00 and an auto-submit.

   The clock now runs wherever the ENGINE says the session is running, which
   is what `clockRunning` answers. Because the components are JSX and node has
   no JSX loader, the decision lives in components/exam/exam-clock.js — the
   same pure view-model pattern as components/settings/endpoints-ui.js and
   components/dashboard-scope.js — and the wiring is asserted against the
   real source.
   ══════════════════════════════════════════════════════════════════ */

const HOST_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "components", "exam", "ExamHost.js"),
  "utf-8"
);

/** A real 3-hour Series 65 mock, 130 items, started at t=0. */
const mock = (seed = 1) => buildSession({ certId: "series65", mode: "mock", seed, now: 0 });

describe("clockRunning: the engine decides, not the panel on screen", () => {
  test("a mid-attempt mock is running", () => {
    assert.equal(clockRunning(mock()), true);
  });

  test("opening the submit panel is not a pause — a mock has no pause button", () => {
    // The confirm panel is a UI phase. Nothing about the session changes when
    // it opens, so nothing about the clock may change either.
    const s = mock();
    assert.equal(clockRunning(s), true, "the very same session the confirm panel renders over");
    // And the engine proves it: three minutes of wall clock really are gone.
    const opened = 10_800_000 - 180_000; // panel opened with 3:00 left
    assert.equal(remainingMs(s, opened), 180_000);
    assert.equal(remainingMs(s, opened + 60_000), 120_000, "a minute on the panel costs a minute");
  });

  test("time up while the panel is open is time up — expiry must be reachable from confirm", () => {
    const s = mock();
    assert.equal(remainingMs(s, 10_800_000), 0);
    // ExamTimer fires onExpire on a zero read; ExamHost's onExpire handles
    // phase "confirm" as well as "exam". That branch is only ever reached if
    // the timer is still ticking on the panel.
    assert.equal(clockRunning(s), true);
    assert.match(HOST_SRC, /phase === "exam" \|\| phase === "confirm"/,
      "onExpire must still submit from the confirm panel");
  });

  test("a submitted session is not running — results and review never tick", () => {
    const done = submitSession(mock(), { now: 60_000 });
    assert.equal(done.status, "submitted");
    assert.equal(clockRunning(done), false);
  });

  test("an expired session is not running", () => {
    const out = tickSession(mock(), { now: 10_800_000 });
    assert.equal(out.status, "expired");
    assert.equal(clockRunning(out), false);
  });

  test("a genuinely paused session is not running", () => {
    // warmup is pausable; a mock is not, which is exactly why phase could
    // never be allowed to stand in for this.
    const paused = pauseSession(buildSession({ certId: "series65", mode: "warmup", seed: 1, now: 0 }), { now: 1000 });
    assert.equal(paused.status, "paused");
    assert.equal(clockRunning(paused), false);
  });

  test("no session, no clock", () => {
    assert.equal(clockRunning(null), false);
    assert.equal(clockRunning(undefined), false);
  });

  test("an active session with no running stretch is not running", () => {
    assert.equal(clockRunning({ ...mock(), runningSince: null }), false);
  });
});

describe("ExamHost wiring: the countdown is not gated on the UI phase", () => {
  test("the timer's paused prop reads the engine, not the phase", () => {
    assert.doesNotMatch(
      HOST_SRC,
      /paused=\{phase !== "exam"\}/,
      "this froze the clock on the confirm panel while the engine kept draining it"
    );
    assert.match(HOST_SRC, /<ExamTimer[\s\S]{0,200}paused=\{!running\}/);
  });

  test("the heartbeat is not gated on the phase either", () => {
    // Same freeze, second copy: with the heartbeat off, `sess` never changed,
    // so the timer's effect never re-read the engine.
    assert.doesNotMatch(
      HOST_SRC,
      /phase !== "exam"/,
      "no clock-bearing effect may key off the UI phase"
    );
  });

  test("running is derived from the engine's own view of the session", () => {
    assert.match(HOST_SRC, /clockRunning\(sess\)/);
    assert.match(HOST_SRC, /from "\.\/exam-clock\.js"/);
  });
});

describe("the announcer stays quiet across the confirm panel", () => {
  test("a paint loop that opens the panel mid-form still announces each milestone once", () => {
    // ExamTimer's repaint loop, re-derived from the engine every tick exactly
    // as the component does — with the confirm panel open from 40:00 to 20:00.
    // The panel must change nothing at all about what is said.
    const s = mock();
    const limit = 10_800_000;
    let prev = remainingMs(s, 0);
    const said = [];
    for (let t = 250; t <= limit; t += 250) {
      const onPanel = t >= limit - 2_400_000 && t <= limit - 1_200_000;
      assert.equal(clockRunning(s), true, "the panel never stops the clock");
      const cur = remainingMs(s, t); // read the same way whether onPanel or not
      const m = crossedMilestone(prev, cur);
      if (m !== null) said.push(m);
      prev = cur;
    }
    assert.deepEqual(said, [1800, 900, 300, 60, 0], "exactly five, each exactly once");
  });
});

/* ══════════════════════════════════════════════════════════════════
   CALL SITE: the anti-memorisation draw is actually supplied.

   lib/exam/blueprint.js has preferred unseen items via `exclude` since
   it landed, and covers the full bank in ~6 sittings when supplied —
   but the only UI entry point passed `seed: Date.now()` and nothing
   else, so repeat mocks drew with no memory and a learner met the
   whole bank, explanations included, then scored on recognition. A
   unit test of drawForm's exclude handling proved nothing about this;
   the suite below drives the REAL ExamHost through two sittings and
   asserts what exam.start was handed at the moment of the click.
   ══════════════════════════════════════════════════════════════════ */
describe("ExamHost supplies the exclude list (anti-memorisation call site)", () => {
  test("second sitting excludes the first sitting's items — in-mount and across a remount", async () => {
    const { render } = await import("./helpers/render.mjs");
    const React = await import("react");
    const { default: ExamHost } = await import("../components/exam/ExamHost.js");
    const adapter = await import("../components/exam/adapter.js");

    // Spy on the one seam ExamHost calls. Wrapping (not stubbing) keeps the
    // whole real engine in the loop — the sitting genuinely starts, submits
    // and scores, so this cannot pass while the UI flow is broken.
    const calls = [];
    const realStart = adapter.exam.start;
    adapter.exam.start = (opts) => { calls.push(opts); return realStart(opts); };

    const seenLists = [];
    // Mounted handles are unmounted in `finally`: a failing assertion must
    // not leave ExamTimer's 250ms interval alive, or the whole test run
    // hangs instead of reporting red (observed while mutation-testing this).
    let ui = null;
    let ui2 = null;
    try {
      /* Sitting 1: nothing seen yet. */
      ui = await render(React.createElement(ExamHost, {
        onItemsSeen: (ids) => seenLists.push(ids),
      }));
      await ui.click(ui.button(/^Start /));
      assert.equal(calls.length, 1, "Start must go through exam.start");
      assert.deepEqual(calls[0].exclude, [], "a first-ever sitting has nothing to exclude");
      assert.ok(seenLists.length >= 1 && seenLists.at(-1).length > 0,
        "the started form's item ids must be reported through onItemsSeen for the host to persist");
      const firstIds = seenLists.at(-1);

      /* Submit sitting 1 and start sitting 2 from the results screen —
         the retake flow a real learner takes, with no host wiring at all. */
      await ui.click(ui.button("Submit"));
      await ui.click(ui.button("Submit for scoring"));
      await ui.click(ui.button("New form"));
      await ui.click(ui.button(/^Start /));
      assert.equal(calls.length, 2);
      assert.ok(Array.isArray(calls[1].exclude) && calls[1].exclude.length > 0,
        "the second sitting must supply a NON-EMPTY exclude — this is the defect: drawing with no memory");
      assert.deepEqual([...calls[1].exclude].sort(), [...firstIds].sort(),
        "and it must be exactly the items the learner has already seen");
      await ui.unmount();
      ui = null;

      /* Sitting 3, fresh mount: the host hands back what it persisted. */
      ui2 = await render(React.createElement(ExamHost, {
        recentItemIds: seenLists.at(-1),
      }));
      await ui2.click(ui2.button(/^Start /));
      assert.equal(calls.length, 3);
      assert.ok(calls[2].exclude.length >= firstIds.length,
        "a remount seeded with the persisted list must exclude across app restarts too");
    } finally {
      adapter.exam.start = realStart;
      if (ui) await ui.unmount();
      if (ui2) await ui2.unmount();
    }
  });

  test("the exclude is wired in the component's own start call, not a test-only shim", () => {
    // Source anchor for the behavioural test above: the exclude must be the
    // rolling seen-items ref, inside the exam.start options.
    assert.match(HOST_SRC, /exam\.start\(\{[\s\S]*?exclude:\s*seenItemsRef\.current[\s\S]*?\}\)/,
      "ExamHost must pass its seen-items list as exam.start's exclude");
  });
});
