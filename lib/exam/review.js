// lib/exam/review.js
// The part of an exam that actually teaches.
//
// The score is nearly worthless next to a good review. A percentage tells a
// learner they have a problem; only the review tells them WHAT the problem
// is -- which distractor they fell for, why it was tempting, and what the
// right reasoning was. So this file's output is per-OPTION, not per-item:
// the bank authors wrote an explanation for every wrong answer, and the
// wrong answer the learner actually picked is the single most valuable
// sentence on the page.
//
// It also closes the loop: missed items feed into lib/games/srs.js so the
// questions you got wrong come back on a spaced schedule instead of being
// read once and forgotten.
//
// THE LOOP IS ONLY CLOSED IF A HOST CLOSES IT. toSrsGrades/applyReviewToDeck
// are pure and own no store, so scheduling happens only where a deck lives:
// components/exam/ExamHost.js hands a submitted review to its `onSrsReview`
// prop, and the host holding the deck (components/Dashboard.js, whose deck is
// the progress document's `srs` slice) folds it in with applyReviewToDeck.
// If you add another mount point for ExamHost, wire that prop too — an
// unwired host is not a broken deck, it is a silently unkept promise, which is
// worse. Nothing here may tell a learner their misses are scheduled; only the
// component that actually scheduled them can say so.

import { reviewInDeck, GRADE } from "../games/srs.js";
import { scoreSession } from "./scoring.js";

/**
 * @typedef {object} ReviewOption
 * @property {number} index
 * @property {string} text
 * @property {string} explanation why this option is right/wrong
 * @property {boolean} isCorrect
 * @property {boolean} chosen the learner picked this one
 */

/**
 * @typedef {object} ReviewItem
 * @property {number} index position on the form
 * @property {string} id
 * @property {string} section
 * @property {string} sectionLabel
 * @property {string} q
 * @property {ReviewOption[]} options
 * @property {number} correctIndex
 * @property {number|null} chosenIndex
 * @property {"correct"|"incorrect"|"unanswered"} status
 * @property {string} explanation the item-level explanation
 * @property {string} whyWrong the explanation for the distractor actually chosen ("" when correct/blank)
 * @property {boolean} flagged
 */

/**
 * Build the full post-exam review.
 * @param {object} session a submitted (or in-progress) session
 * @returns {{score: import("./scoring.js").ExamScore, items: ReviewItem[], missed: ReviewItem[], flagged: ReviewItem[], sections: import("./scoring.js").SectionScore[], weakest: import("./scoring.js").SectionScore[], recommendations: string[], certId: string, mode: string, sessionId: string}}
 */
export function buildReview(session) {
  const score = scoreSession(session);

  const items = session.form.items.map((item, index) => {
    const raw = session.answers[item.id];
    const chosenIndex = raw === undefined ? null : raw;
    const status = chosenIndex === null ? "unanswered" : chosenIndex === item.correctIndex ? "correct" : "incorrect";
    return {
      index,
      id: item.id,
      section: item.section,
      sectionLabel: item.sectionLabel,
      q: item.q,
      options: item.options.map((o, i) => ({
        index: i,
        text: o.text,
        explanation: o.explanation ?? "",
        isCorrect: i === item.correctIndex,
        chosen: i === chosenIndex,
      })),
      correctIndex: item.correctIndex,
      chosenIndex,
      status,
      explanation: item.explanation ?? "",
      whyWrong: status === "incorrect" ? (item.options[chosenIndex]?.explanation ?? "") : "",
      flagged: Boolean(session.flags[item.id]),
    };
  });

  const missed = items.filter((i) => i.status !== "correct");

  return {
    certId: score.certId,
    mode: score.mode,
    sessionId: session.id,
    score,
    items,
    missed,
    flagged: items.filter((i) => i.flagged),
    sections: score.bySection,
    weakest: score.weakest,
    recommendations: recommendations(score, items),
  };
}

/**
 * What to actually go do next, in priority order. Honest about the size of
 * the gap rather than encouraging: a learner 20 points off the mark is not
 * served by "nearly there".
 * @param {import("./scoring.js").ExamScore} score
 * @param {ReviewItem[]} items
 * @returns {string[]}
 */
function recommendations(score, items) {
  const out = [];

  if (score.total === 0) return ["This form had no questions — there's nothing to review yet."];

  const gap = score.passMark.count - score.correct;
  if (score.verdict === "indicative") {
    out.push(
      `This wasn't a full-length blueprint form, so treat ${score.rawPct}% as a signal about your weak sections, ` +
      `not as a pass/fail. Sit a full timed mock when the bank can fill one.`,
    );
  } else if (gap > 0) {
    out.push(`You were ${gap} question(s) short of the ${score.passMark.pct}% mark. That's the gap to close before test day.`);
  } else {
    out.push(`You cleared the ${score.passMark.pct}% mark by ${-gap} question(s) — repeat it on a fresh seed before you trust it.`);
  }

  for (const s of score.weakest.slice(0, 2)) {
    if (!s.belowPassMark) continue;
    out.push(
      `${s.label} is your weakest section at ${s.pct}% and is worth ${Math.round(s.weight * 100)}% of the exam — ` +
      `it costs the most to leave broken.`,
    );
  }

  const missedCount = items.filter((i) => i.status !== "correct").length;
  if (missedCount) {
    // Only what this function's own caller can deliver. Whether these items
    // reach an SRS deck depends on the host wiring applyReviewToDeck (see this
    // file's header), which buildReview cannot see and must not promise on
    // behalf of — the UI states that where it knows it happened.
    out.push(
      `Run the ${missedCount} missed question(s) back as a retry drill — re-reading an explanation is not the ` +
      `same as answering the question again.`,
    );
  }

  const blanks = items.filter((i) => i.status === "unanswered").length;
  if (blanks) {
    out.push(`${blanks} question(s) were left blank. There is no penalty for guessing — a blank is a wasted 25% chance.`);
  }

  const flaggedRight = items.filter((i) => i.flagged && i.status === "correct").length;
  if (flaggedRight >= 3) {
    out.push(`You flagged ${flaggedRight} question(s) you actually got right — you know more than you're giving yourself credit for.`);
  }

  return out;
}

/**
 * The ids of every item missed (wrong or blank), in form order.
 * @param {object} reviewOrSession a review from buildReview, or a session
 * @returns {string[]}
 */
export function missedItemIds(reviewOrSession) {
  const review = reviewOrSession.score ? reviewOrSession : buildReview(reviewOrSession);
  return review.missed.map((i) => i.id);
}

/**
 * The resolved form items a learner missed, ready to be re-formed into a
 * retry sitting (see banks.js buildRetrySession).
 * @param {object} session
 * @returns {object[]}
 */
export function missedFormItems(session) {
  const missed = new Set(missedItemIds(session));
  return session.form.items.filter((i) => missed.has(i.id));
}

/**
 * Map an exam result onto SM-2 grades for lib/games/srs.js.
 *
 * The mapping treats confidence as evidence, not just correctness:
 *   wrong / blank        -> AGAIN (it lapses and comes back tomorrow)
 *   right but flagged    -> HARD  (you weren't sure; a guess that landed
 *                                  shouldn't earn a six-day interval)
 *   right, unflagged     -> GOOD
 * EASY is never awarded automatically -- nothing about a four-option
 * multiple-choice item proves a learner found it easy rather than lucky.
 *
 * @param {object} reviewOrSession
 * @returns {Array<{id: string, grade: number}>}
 */
export function toSrsGrades(reviewOrSession) {
  const review = reviewOrSession.score ? reviewOrSession : buildReview(reviewOrSession);
  return review.items.map((i) => ({
    id: i.id,
    grade: i.status !== "correct" ? GRADE.AGAIN : i.flagged ? GRADE.HARD : GRADE.GOOD,
  }));
}

/**
 * Fold an exam result into an SRS deck. Pure -- returns a new deck.
 * Card ids are bank item ids (e.g. "s65b-eco-01"), which are already unique
 * across the cert banks.
 * @param {Object<string, object>} deck a lib/games/srs.js deck
 * @param {object} reviewOrSession
 * @param {{now?: Date|number|string, maxIntervalDays?: number}} [opts]
 * @returns {Object<string, object>} the next deck
 */
export function applyReviewToDeck(deck, reviewOrSession, opts = {}) {
  let next = deck ?? {};
  for (const { id, grade } of toSrsGrades(reviewOrSession)) {
    next = reviewInDeck(next, id, grade, opts);
  }
  return next;
}
