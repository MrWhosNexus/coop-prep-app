/**
 * test/quiz-order.test.js
 *
 * Guards against the single worst defect this app can have: a quiz that is
 * answerable by position instead of knowledge.
 *
 * Authored option order across all 212 lesson-quiz questions carried a severe
 * positional tell — correct answer in slot A on 97.6% of SIE questions, in slot
 * B on 94.1% of CFI's, and never in slot D anywhere. A learner drilling against
 * that trains on the tell, feels ready, and then sits a real SIE where the
 * options are randomised.
 *
 * These tests assert (a) the shuffle is deterministic, so options never move
 * under a learner mid-session, and (b) the rendered distribution is close to
 * uniform, so this can never silently return as new content is authored.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { orderedOptions, hashSeed, answerPositionStats } from "../lib/quiz-order.js";
import { MODULES } from "../data/curriculum.js";
import { SIE_MODULES } from "../data/certs/sie.js";
import { SERIES65_MODULES } from "../data/certs/series65.js";
import { CFI_MODULES } from "../data/certs/cfi.js";
import { HEART_MODULES } from "../data/heart.js";
import { HUSTLE_MODULES } from "../data/hustle.js";

/** Every authored quiz question, tagged with the lesson id used as the shuffle scope. */
function allQuestions() {
  const out = [];
  for (const modules of [MODULES, SIE_MODULES, SERIES65_MODULES, CFI_MODULES, HEART_MODULES, HUSTLE_MODULES]) {
    for (const mod of modules || []) {
      for (const lesson of mod.lessons || []) {
        for (const q of lesson.quiz || []) out.push({ q, scope: lesson.id });
      }
    }
  }
  return out;
}

describe("quiz option ordering", () => {
  test("is deterministic — the same question renders identically every time", () => {
    const q = {
      q: "What does dragging a field to Values and setting it to Count give you?",
      a: "The number of records in each category",
      options: [
        { text: "The sum of that field" },
        { text: "The number of records in each category" },
        { text: "The average value" },
        { text: "A percentage breakdown" },
      ],
    };
    const a = orderedOptions(q, "excel-1").map((o) => o.text);
    const b = orderedOptions(q, "excel-1").map((o) => o.text);
    assert.deepEqual(a, b, "options must not move under the learner between renders");
  });

  test("actually permutes, and the same question in a different lesson diverges", () => {
    const q = {
      q: "Pick one",
      a: "b",
      options: [{ text: "a" }, { text: "b" }, { text: "c" }, { text: "d" }],
    };
    const seen = new Set();
    for (const scope of ["l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8"]) {
      seen.add(orderedOptions(q, scope).map((o) => o.text).join(""));
    }
    assert.ok(seen.size > 1, "scoping by lesson id must produce different orders");
  });

  test("preserves the option set exactly — nothing dropped, duplicated or mutated", () => {
    for (const { q, scope } of allQuestions()) {
      const before = (q.options || []).map((o) => o.text).slice().sort();
      const after = orderedOptions(q, scope).map((o) => o.text).slice().sort();
      assert.deepEqual(after, before, `option set changed for: ${q.q}`);
    }
  });

  test("every authored question still has exactly one correct answer present after shuffling", () => {
    for (const { q, scope } of allQuestions()) {
      const texts = orderedOptions(q, scope).map((o) => o.text);
      const hits = texts.filter((t) => t === q.a).length;
      assert.equal(hits, 1, `expected exactly one option matching q.a for: ${q.q}`);
    }
  });

  test("does not mutate the source question", () => {
    const q = { q: "x", a: "b", options: [{ text: "a" }, { text: "b" }, { text: "c" }] };
    const snapshot = q.options.map((o) => o.text);
    orderedOptions(q, "s");
    assert.deepEqual(q.options.map((o) => o.text), snapshot);
  });

  test("degenerate inputs do not throw", () => {
    assert.deepEqual(orderedOptions({ q: "x", options: [] }, "s"), []);
    assert.deepEqual(orderedOptions({ q: "x" }, "s"), []);
    assert.deepEqual(orderedOptions({ q: "x", options: [{ text: "only" }] }, "s").map((o) => o.text), ["only"]);
    assert.deepEqual(orderedOptions(null, "s"), []);
  });

  test("hashSeed is stable and spreads", () => {
    assert.equal(hashSeed("abc"), hashSeed("abc"));
    assert.notEqual(hashSeed("abc"), hashSeed("abd"));
  });
});

describe("authored content has no positional tell once rendered", () => {
  // The bug this file exists for. Authored order is severely biased; the
  // rendered order must not be. 45% is a deliberately loose ceiling — it is far
  // below the measured authored bias (up to 97.6%) but well above the noise a
  // fair shuffle produces on a few hundred questions, so this asserts the
  // defect is gone without becoming flaky.
  const CEILING = 0.45;

  test("authored order IS biased — proving this test can actually detect the defect", () => {
    const questions = allQuestions().map(({ q }) => q);
    const authored = answerPositionStats(questions);
    assert.ok(
      authored.max > 0.45,
      `expected authored order to show the known positional bias (got max ${(authored.max * 100).toFixed(1)}%). ` +
        `If this now fails, the content was rewritten and this guard's premise changed — re-derive the ceiling ` +
        `rather than deleting the test.`,
    );
  });

  test("rendered order is close to uniform across every authored question", () => {
    const tagged = allQuestions();
    const questions = tagged.map(({ q }) => q);
    const scopeOf = new Map(tagged.map(({ q, scope }) => [q, scope]));
    const rendered = answerPositionStats(questions, (q) => orderedOptions(q, scopeOf.get(q) || ""));

    assert.ok(rendered.total > 150, `expected the full authored corpus; only matched ${rendered.total}`);
    assert.ok(
      rendered.max <= CEILING,
      `rendered answers cluster in one position (${(rendered.max * 100).toFixed(1)}% > ${CEILING * 100}%): ` +
        rendered.fractions.map((f, i) => `${String.fromCharCode(65 + i)}=${(f * 100).toFixed(1)}%`).join(" ") +
        `\nA learner could pass by position instead of knowledge.`,
    );
  });

  test("no position is starved — every slot is the answer sometimes", () => {
    const tagged = allQuestions();
    const questions = tagged.map(({ q }) => q);
    const scopeOf = new Map(tagged.map(({ q, scope }) => [q, scope]));
    const rendered = answerPositionStats(questions, (q) => orderedOptions(q, scopeOf.get(q) || ""));

    // Authored order never once used D across 212 questions. Every slot a
    // 4-option question offers should now be correct sometimes.
    const fourOptionSlots = 4;
    for (let i = 0; i < fourOptionSlots; i++) {
      assert.ok(
        (rendered.counts[i] || 0) > 0,
        `position ${String.fromCharCode(65 + i)} is never the correct answer — ` +
          `that is exactly the tell this module exists to remove`,
      );
    }
  });
});
