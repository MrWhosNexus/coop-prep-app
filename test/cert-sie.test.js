import { test } from "node:test";
import assert from "node:assert/strict";
import { SIE_BLUEPRINT, SIE_MODULES } from "../data/certs/sie.js";
import { SIE_BANK } from "../data/certs/sie-bank.js";

const KNOWN_SECTIONS = ["capital-markets", "products-risks", "trading-accounts", "regulatory"];

/** Validates a single quiz-item shape shared by both lesson quizzes and bank items. */
function assertQuizItemShape(item, where) {
  assert.equal(typeof item.q, "string", `${where}: q must be a string`);
  assert.ok(item.q.length > 0, `${where}: q must not be empty`);
  assert.equal(typeof item.a, "string", `${where}: a must be a string`);
  assert.equal(typeof item.explanation, "string", `${where}: explanation must be a string`);
  assert.ok(item.explanation.length > 0, `${where}: explanation must not be empty`);
  assert.ok(Array.isArray(item.options), `${where}: options must be an array`);
  assert.ok(item.options.length >= 2, `${where}: options must have at least 2 choices`);

  for (const opt of item.options) {
    assert.equal(typeof opt.text, "string", `${where}: option.text must be a string`);
    assert.ok(opt.text.length > 0, `${where}: option.text must not be empty`);
    assert.equal(typeof opt.explanation, "string", `${where}: option.explanation must be a string`);
    assert.ok(opt.explanation.length > 0, `${where}: option.explanation must not be empty`);
  }

  // options must be unique text values
  const texts = item.options.map((o) => o.text);
  assert.equal(new Set(texts).size, texts.length, `${where}: option texts must be unique`);

  // `a` must match exactly one option's text (the correct answer)
  const matches = texts.filter((t) => t === item.a);
  assert.equal(matches.length, 1, `${where}: 'a' (${JSON.stringify(item.a)}) must match exactly one option.text`);
}

test("SIE_BLUEPRINT describes the four scored sections and sums to the full exam", () => {
  assert.ok(Array.isArray(SIE_BLUEPRINT));
  assert.equal(SIE_BLUEPRINT.length, 4);

  const totalWeight = SIE_BLUEPRINT.reduce((sum, s) => sum + s.weight, 0);
  assert.ok(Math.abs(totalWeight - 1) < 1e-9, `blueprint weights should sum to 1, got ${totalWeight}`);

  const totalQuestions = SIE_BLUEPRINT.reduce((sum, s) => sum + s.approxQuestions, 0);
  assert.equal(totalQuestions, 75, "blueprint approxQuestions should sum to the 75 scored SIE questions");

  const ids = SIE_BLUEPRINT.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "blueprint section ids must be unique");

  // Section 2 (Products and Their Risks) must dominate, per the real exam blueprint.
  const section2 = SIE_BLUEPRINT.find((s) => s.id === 2);
  assert.ok(section2, "blueprint must include section 2");
  assert.ok(section2.weight > 0.4, "section 2 (Products and Their Risks) should be roughly 44% of the exam");
});

test("SIE_MODULES has at least 4 modules, each matching data/curriculum.js's MODULES shape", () => {
  assert.ok(Array.isArray(SIE_MODULES));
  assert.ok(SIE_MODULES.length >= 4, "expected at least 4 modules");

  for (const mod of SIE_MODULES) {
    assert.equal(typeof mod.id, "string");
    assert.equal(typeof mod.title, "string");
    assert.equal(typeof mod.icon, "string");
    assert.equal(typeof mod.color, "string");
    assert.equal(typeof mod.light, "string");
    assert.equal(typeof mod.description, "string");
    assert.equal(typeof mod.coopModule, "string");
    assert.ok(Array.isArray(mod.lessons));
    assert.ok(mod.lessons.length >= 1, `${mod.id}: must have at least 1 lesson`);
  }
});

test("every lesson matches data/curriculum.js's lesson shape", () => {
  for (const mod of SIE_MODULES) {
    for (const lesson of mod.lessons) {
      const where = `${mod.id}/${lesson.id}`;
      assert.equal(typeof lesson.id, "string", where);
      assert.equal(typeof lesson.title, "string", where);
      assert.equal(typeof lesson.minutes, "number", where);
      assert.ok(lesson.minutes > 0, where);
      assert.ok(Array.isArray(lesson.body), where);
      assert.ok(lesson.body.length > 0, where);
      for (const p of lesson.body) assert.equal(typeof p, "string", where);
      assert.equal(typeof lesson.challenge, "string", where);
      assert.equal(typeof lesson.exampleOutput, "string", where);
      assert.ok(Array.isArray(lesson.quiz), where);
      assert.ok(lesson.quiz.length >= 1, `${where}: expects at least 1 quiz item`);
      for (const item of lesson.quiz) assertQuizItemShape(item, `${where} quiz`);
    }
  }
});

test("all module ids and lesson ids are unique across the track", () => {
  const moduleIds = SIE_MODULES.map((m) => m.id);
  assert.equal(new Set(moduleIds).size, moduleIds.length, "duplicate module id");

  const lessonIds = SIE_MODULES.flatMap((m) => m.lessons.map((l) => l.id));
  assert.equal(new Set(lessonIds).size, lessonIds.length, "duplicate lesson id");
});

test("every module declares a blueprintSection matching a real SIE_BLUEPRINT entry", () => {
  const sectionIds = new Set(SIE_BLUEPRINT.map((s) => s.id));
  for (const mod of SIE_MODULES) {
    assert.ok(sectionIds.has(mod.blueprintSection), `${mod.id}: unknown blueprintSection ${mod.blueprintSection}`);
  }

  // Section 2 (Products and Their Risks, ~44% of the exam) should back at least
  // three of this track's modules, since it alone is nearly half the exam.
  const section2Modules = SIE_MODULES.filter((m) => m.blueprintSection === 2);
  assert.ok(section2Modules.length >= 3, "expected at least 3 modules mapped to blueprint section 2");
});

test("SIE_BANK has a substantial number of questions, each with a valid quiz-item shape", () => {
  assert.ok(Array.isArray(SIE_BANK));
  assert.ok(SIE_BANK.length >= 120, `expected a substantial bank; got ${SIE_BANK.length}`);

  const ids = new Set();
  for (const item of SIE_BANK) {
    assert.equal(typeof item.id, "string");
    assert.ok(!ids.has(item.id), `duplicate bank id ${item.id}`);
    ids.add(item.id);

    assert.ok(KNOWN_SECTIONS.includes(item.section), `${item.id}: unknown section ${item.section}`);
    assertQuizItemShape(item, item.id);
  }
});

test("SIE_BANK section distribution roughly matches blueprint weight", () => {
  const counts = { "capital-markets": 0, "products-risks": 0, "trading-accounts": 0, regulatory: 0 };
  for (const item of SIE_BANK) counts[item.section] += 1;

  const total = SIE_BANK.length;
  // Loose bounds around the blueprint's 16/44/31/9 split — a real bank need not be
  // exact, but no section should be wildly over- or under-represented relative to its weight.
  assert.ok(counts["capital-markets"] / total >= 0.08, "capital-markets section underrepresented");
  assert.ok(counts["products-risks"] / total >= 0.30, "products-risks section underrepresented");
  assert.ok(counts["trading-accounts"] / total >= 0.20, "trading-accounts section underrepresented");
  assert.ok(counts.regulatory / total >= 0.04, "regulatory section underrepresented");

  // Products-risks alone is ~44% of the exam — it should be the single largest section.
  const maxCount = Math.max(...Object.values(counts));
  assert.equal(counts["products-risks"], maxCount, "products-risks should be the largest section in the bank");
});

test("every bank question text is unique (no accidental duplicates)", () => {
  const questions = SIE_BANK.map((item) => item.q);
  assert.equal(new Set(questions).size, questions.length, "duplicate question text found in bank");
});

test("sie-regulatory-3 lesson teaches the CURRENT (post-1/1/2023) FINRA Rule 1240 Regulatory Element schedule, not the retired 'second anniversary' rule", () => {
  const mod = SIE_MODULES.find((m) => m.id === "sie-regulatory");
  assert.ok(mod, "expected the sie-regulatory module to exist");
  const lesson = mod.lessons.find((l) => l.id === "sie-regulatory-3");
  assert.ok(lesson, "expected lesson sie-regulatory-3 to exist");

  const bodyText = lesson.body.join(" ");
  assert.ok(
    !/second registration anniversary/i.test(bodyText),
    "lesson body still teaches the retired pre-2023 'second anniversary' Regulatory Element schedule"
  );
  assert.ok(
    /annually/i.test(bodyText) && /december 31/i.test(bodyText),
    "lesson body should state the current rule: Regulatory Element completed annually, by December 31, per registration category"
  );

  assert.ok(
    !/second registration anniversary/i.test(lesson.challenge + lesson.exampleOutput),
    "challenge/exampleOutput still repeat the retired 'second anniversary' schedule"
  );

  const quizItem = lesson.quiz.find((q) => /Regulatory Element/i.test(q.q));
  assert.ok(quizItem, "expected a quiz item about the Regulatory Element schedule");
  assert.ok(
    !/second registration anniversary/i.test(quizItem.a),
    `quiz keyed answer is the retired pre-2023 rule: ${JSON.stringify(quizItem.a)}`
  );
  assert.ok(/annually/i.test(quizItem.a), "quiz keyed answer should reflect the current annual (by Dec 31) rule");

  // the correct option's own explanation shouldn't reinforce the stale fact either
  const correctOption = quizItem.options.find((o) => o.text === quizItem.a);
  assert.ok(correctOption, "keyed answer must match an option");
  assert.ok(
    !/second registration anniversary/i.test(correctOption.explanation),
    "correct option's explanation still reinforces the retired schedule"
  );
});
