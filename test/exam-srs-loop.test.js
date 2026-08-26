/**
 * test/exam-srs-loop.test.js
 *
 * The exam→SRS loop was a promise the code did not keep: `applyReviewToDeck` and
 * `toSrsGrades` were fully implemented, fully unit-tested, and imported by
 * NOTHING outside test/. Missed questions from a 3-hour mock went nowhere, while
 * ExamResults stood ready to tell the learner they had been scheduled.
 *
 * lib/exam/review.js says it plainly: "THE LOOP IS ONLY CLOSED IF A HOST CLOSES
 * IT." The pure function passing its unit tests proves nothing about that — which
 * is exactly why the gap survived a green suite.
 *
 * So these tests assert the WIRING, not the arithmetic. The unit behaviour of
 * applyReviewToDeck is already covered in test/exam.test.js and is not re-tested
 * here.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { applyReviewToDeck, toSrsGrades } from "../lib/exam/review.js";
import { defaultDeck, isDue } from "../lib/games/srs.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dashboard = readFileSync(join(ROOT, "components/Dashboard.js"), "utf8");

describe("the exam→SRS loop is closed by a host", () => {
  test("Dashboard imports the deck writer from lib/exam/review", () => {
    assert.match(
      dashboard,
      /import\s*\{[^}]*applyReviewToDeck[^}]*\}\s*from\s*["']@\/lib\/exam\/review["']/,
      "Dashboard must import applyReviewToDeck — without a host importing it the loop is open",
    );
  });

  test("ExamSimTool passes onSrsReview to ExamHost", () => {
    // ExamHost makes NO spaced-repetition claim unless onSrsReview is supplied
    // (that is deliberate — omit it and the UI promises nothing). So this prop
    // being present is the whole difference between a working feature and a lie.
    const tool = dashboard.slice(dashboard.indexOf("function ExamSimTool"));
    const body = tool.slice(0, tool.indexOf("\n}\n"));
    assert.match(body, /onSrsReview/, "ExamSimTool must define an onSrsReview handler");
    assert.match(
      body,
      /<ExamHost[\s\S]*?onSrsReview=\{[\s\S]*?\/>/,
      "ExamSimTool must PASS onSrsReview to ExamHost — defining it is not wiring it",
    );
    assert.match(body, /applyReviewToDeck/, "the handler must fold the review into the deck");
  });

  test("the handler writes the deck to progress.srs — the same slice the games use", () => {
    const tool = dashboard.slice(dashboard.indexOf("function ExamSimTool"));
    const body = tool.slice(0, tool.indexOf("\n}\n"));
    assert.match(
      body,
      /srs:\s*applyReviewToDeck\(\s*prev\.srs/,
      "exam reviews must land in progress.srs, or they schedule into a deck nothing reads",
    );
  });

  test("the handler caps intervals at the fellowship horizon, as the games do", () => {
    const tool = dashboard.slice(dashboard.indexOf("function ExamSimTool"));
    const body = tool.slice(0, tool.indexOf("\n}\n"));
    assert.match(
      body,
      /maxIntervalDays:\s*horizonTo\(\s*lib\.FELLOWSHIP_END/,
      "a card scheduled past program end is a card the learner never sees before the exam",
    );
  });
});

describe("a folded review actually schedules cards", () => {
  // Guards the contract the wiring depends on: if applyReviewToDeck ever stopped
  // returning a populated deck, the wiring above would be inert and still pass.
  // A built review, per lib/exam/review.js#toSrsGrades: a truthy `score` marks
  // this as a review rather than a session, and each item carries a `status`
  // string ("correct" | anything else) plus a `flagged` flag. Missed -> AGAIN,
  // right-but-flagged -> HARD, right -> GOOD. EASY is never awarded
  // automatically, which is the right call: nothing about a four-option
  // multiple-choice item proves the learner found it easy rather than lucky.
  const review = {
    score: { raw: 1, total: 3 },
    items: [
      { id: "sieb-cm-01", status: "incorrect", flagged: false },
      { id: "sieb-cm-02", status: "correct", flagged: false },
      { id: "sieb-pr-07", status: "incorrect", flagged: true },
    ],
  };

  test("toSrsGrades reports one grade per answered item", () => {
    const grades = toSrsGrades(review);
    assert.equal(grades.length, 3, "the count ExamSimTool returns to ExamHost drives the SRS claim");
  });

  test("missed questions land in the deck and are due", () => {
    const now = Date.UTC(2026, 6, 15);
    const deck = applyReviewToDeck(defaultDeck(), review, { now, maxIntervalDays: 28 });

    assert.ok(deck["sieb-cm-01"], "a missed question must enter the deck");
    assert.ok(deck["sieb-pr-07"], "a missed question must enter the deck");
    assert.ok(
      isDue(deck["sieb-cm-01"], Date.UTC(2026, 6, 16)),
      "a missed question must come back around, or the loop schedules nothing worth having",
    );
  });

  test("folding a review never schedules past the cap", () => {
    const now = Date.UTC(2026, 6, 15);
    const deck = applyReviewToDeck(defaultDeck(), review, { now, maxIntervalDays: 3 });
    for (const [id, card] of Object.entries(deck)) {
      assert.ok(
        isDue(card, Date.UTC(2026, 6, 15 + 3)),
        `${id} scheduled beyond the 3-day cap — the fellowship horizon must bind`,
      );
    }
  });
});
