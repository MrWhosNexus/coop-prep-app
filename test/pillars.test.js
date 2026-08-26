import { test } from "node:test";
import assert from "node:assert/strict";
import { HEART_MODULES, HEART_FLASHCARDS, HEART_INTERVIEW_QUESTIONS } from "../data/heart.js";
import { HUSTLE_MODULES, HUSTLE_FLASHCARDS, HUSTLE_INTERVIEW_QUESTIONS } from "../data/hustle.js";
import { HUSTLE_TOOLS, getHustleTool } from "../data/hustle-tools.js";

// ---------------------------------------------------------------------------
// Shared structural validator — every module set must match
// data/curriculum.js's MODULES shape exactly.
// ---------------------------------------------------------------------------

function assertModuleShape(MODULES, label) {
  assert.ok(Array.isArray(MODULES), `${label} must be an array`);
  assert.ok(MODULES.length > 0, `${label} must be non-empty`);

  const moduleIds = new Set();
  const lessonIds = new Set();

  for (const mod of MODULES) {
    for (const key of ["id", "title", "icon", "color", "light", "description", "coopModule"]) {
      assert.equal(typeof mod[key], "string", `${label} module ${mod.id ?? "?"} missing string field '${key}'`);
      assert.ok(mod[key].length > 0, `${label} module ${mod.id ?? "?"} field '${key}' must not be empty`);
    }
    assert.match(mod.color, /^#[0-9a-fA-F]{6}$/, `${label} module ${mod.id} color must be a hex string`);
    assert.match(mod.light, /^#[0-9a-fA-F]{6}$/, `${label} module ${mod.id} light must be a hex string`);

    assert.ok(!moduleIds.has(mod.id), `${label} module id '${mod.id}' must be unique`);
    moduleIds.add(mod.id);

    assert.ok(Array.isArray(mod.lessons), `${label} module ${mod.id} lessons must be an array`);
    assert.ok(mod.lessons.length > 0, `${label} module ${mod.id} must have at least 1 lesson`);

    for (const lesson of mod.lessons) {
      assert.ok(!lessonIds.has(lesson.id), `${label} lesson id '${lesson.id}' must be unique`);
      lessonIds.add(lesson.id);

      assert.equal(typeof lesson.id, "string");
      assert.equal(typeof lesson.title, "string");
      assert.ok(lesson.title.length > 0, `lesson ${lesson.id} title must not be empty`);
      assert.equal(typeof lesson.minutes, "number", `lesson ${lesson.id} minutes must be a number`);
      assert.ok(lesson.minutes > 0, `lesson ${lesson.id} minutes must be positive`);
      assert.equal(typeof lesson.challenge, "string");
      assert.ok(lesson.challenge.length > 20, `lesson ${lesson.id} challenge must be substantive, not a stub`);
      assert.equal(typeof lesson.exampleOutput, "string");
      assert.ok(lesson.exampleOutput.length > 20, `lesson ${lesson.id} exampleOutput must be substantive`);

      assert.ok(Array.isArray(lesson.body), `lesson ${lesson.id} body must be an array`);
      assert.ok(lesson.body.length >= 2, `lesson ${lesson.id} body must have at least 2 paragraphs`);
      for (const para of lesson.body) {
        assert.equal(typeof para, "string");
        assert.ok(para.length > 30, `lesson ${lesson.id} body paragraph must be substantive, not a stub`);
      }

      assert.ok(Array.isArray(lesson.quiz), `lesson ${lesson.id} quiz must be an array`);
      assert.ok(lesson.quiz.length >= 1, `lesson ${lesson.id} must have at least 1 quiz question`);

      for (const q of lesson.quiz) {
        assert.equal(typeof q.q, "string");
        assert.equal(typeof q.a, "string");
        assert.equal(typeof q.explanation, "string", `quiz item in ${lesson.id} must have a top-level explanation`);
        assert.ok(q.explanation.length > 10, `quiz item in ${lesson.id} explanation must be substantive`);
        assert.ok(Array.isArray(q.options), `quiz item in ${lesson.id} options must be an array`);
        assert.ok(q.options.length >= 3, `quiz item in ${lesson.id} must have at least 3 options`);

        let correctCount = 0;
        for (const opt of q.options) {
          assert.equal(typeof opt.text, "string");
          assert.equal(typeof opt.explanation, "string", `option in ${lesson.id} must carry an explanation (right or wrong)`);
          assert.ok(opt.explanation.length > 5, `option explanation in ${lesson.id} must be substantive`);
          if (opt.text === q.a) correctCount++;
        }
        assert.equal(correctCount, 1, `quiz item in ${lesson.id} must have exactly one option matching its answer 'a'`);
      }
    }
  }
}

function assertFlashcardShape(cards, label) {
  assert.ok(Array.isArray(cards), `${label} must be an array`);
  assert.ok(cards.length > 0, `${label} must be non-empty`);
  for (const c of cards) {
    assert.equal(typeof c.term, "string");
    assert.ok(c.term.length > 0, `${label} flashcard term must not be empty`);
    assert.equal(typeof c.def, "string");
    assert.ok(c.def.length > 10, `${label} flashcard def must be substantive`);
  }
}

function assertInterviewQuestionShape(qs, moduleIds, label) {
  assert.ok(Array.isArray(qs), `${label} must be an array`);
  assert.ok(qs.length > 0, `${label} must be non-empty`);
  for (const q of qs) {
    assert.ok(moduleIds.has(q.moduleId), `${label} interview question moduleId '${q.moduleId}' must reference a real module`);
    assert.equal(typeof q.question, "string");
    assert.ok(["technical", "behavioral", "case"].includes(q.type), `${label} interview question type must be technical|behavioral|case`);
    assert.equal(typeof q.sampleAnswer, "string");
    assert.ok(q.sampleAnswer.length > 40, `${label} interview question sampleAnswer must be substantive`);
  }
}

/* ── Heart ── */
test("HEART_MODULES matches curriculum.js's MODULES shape", () => {
  assertModuleShape(HEART_MODULES, "HEART_MODULES");
});

test("HEART_MODULES covers all 3 modules with meaningful lesson depth", () => {
  assert.equal(HEART_MODULES.length, 3);
  const totalLessons = HEART_MODULES.reduce((n, m) => n + m.lessons.length, 0);
  assert.ok(totalLessons >= 9, "Heart should have real depth, matching Head's scale");
});

test("HEART_FLASHCARDS is well-formed", () => {
  assertFlashcardShape(HEART_FLASHCARDS, "HEART_FLASHCARDS");
});

test("HEART_INTERVIEW_QUESTIONS references real Heart module ids", () => {
  const ids = new Set(HEART_MODULES.map((m) => m.id));
  assertInterviewQuestionShape(HEART_INTERVIEW_QUESTIONS, ids, "HEART_INTERVIEW_QUESTIONS");
});

/* ── Hustle curriculum ── */
test("HUSTLE_MODULES matches curriculum.js's MODULES shape", () => {
  assertModuleShape(HUSTLE_MODULES, "HUSTLE_MODULES");
});

test("HUSTLE_MODULES covers all 3 modules with meaningful lesson depth", () => {
  assert.equal(HUSTLE_MODULES.length, 3);
  const totalLessons = HUSTLE_MODULES.reduce((n, m) => n + m.lessons.length, 0);
  assert.ok(totalLessons >= 9, "Hustle should have real depth, matching Head's scale");
});

test("HUSTLE_FLASHCARDS is well-formed", () => {
  assertFlashcardShape(HUSTLE_FLASHCARDS, "HUSTLE_FLASHCARDS");
});

test("HUSTLE_INTERVIEW_QUESTIONS references real Hustle module ids", () => {
  const ids = new Set(HUSTLE_MODULES.map((m) => m.id));
  assertInterviewQuestionShape(HUSTLE_INTERVIEW_QUESTIONS, ids, "HUSTLE_INTERVIEW_QUESTIONS");
});

/* ── no id collisions between pillars (all module ids feed one registry) ── */
test("Heart and Hustle module/lesson ids never collide with each other", () => {
  const heartModIds = HEART_MODULES.map((m) => m.id);
  const hustleModIds = HUSTLE_MODULES.map((m) => m.id);
  const heartLessonIds = HEART_MODULES.flatMap((m) => m.lessons.map((l) => l.id));
  const hustleLessonIds = HUSTLE_MODULES.flatMap((m) => m.lessons.map((l) => l.id));

  const allIds = [...heartModIds, ...hustleModIds, ...heartLessonIds, ...hustleLessonIds];
  assert.equal(new Set(allIds).size, allIds.length, "no duplicate ids across Heart and Hustle modules/lessons");
});

test("Heart and Hustle module ids are namespaced (heart- / hustle- prefix)", () => {
  for (const m of HEART_MODULES) assert.match(m.id, /^heart-/);
  for (const m of HUSTLE_MODULES) assert.match(m.id, /^hustle-/);
});

/* ── Hustle tool specs ── */
test("HUSTLE_TOOLS defines the 6 required tools beyond the cover letter", () => {
  const ids = HUSTLE_TOOLS.map((t) => t.id).sort();
  assert.deepEqual(ids, [
    "applicationTracker",
    "mockInterview",
    "networkTracker",
    "resumeBuilder",
    "salaryNegotiationPrep",
    "starStoryBank",
  ].sort());
});

test("every HUSTLE_TOOLS entry has the required spec fields", () => {
  for (const tool of HUSTLE_TOOLS) {
    assert.equal(typeof tool.id, "string");
    assert.equal(typeof tool.label, "string");
    assert.equal(tool.pillarId, "hustle");
    assert.equal(typeof tool.purpose, "string");
    assert.ok(tool.purpose.length > 30, `tool ${tool.id} purpose must be substantive`);
    assert.equal(typeof tool.defaultState, "object");
    assert.notEqual(tool.defaultState, null);
    assert.equal(typeof tool.storeNeeds, "string");
    assert.ok(tool.storeNeeds.length > 10, `tool ${tool.id} storeNeeds must be substantive`);
    assert.ok(Array.isArray(tool.suggestedReducers), `tool ${tool.id} suggestedReducers must be an array`);
    assert.ok(tool.suggestedReducers.length > 0, `tool ${tool.id} must suggest at least one reducer`);
    assert.equal(typeof tool.aiIntegration, "string");
  }
});

test("no HUSTLE_TOOLS defaultState smuggles an apiKey-shaped field", () => {
  for (const tool of HUSTLE_TOOLS) {
    const json = JSON.stringify(tool.defaultState).toLowerCase();
    assert.ok(!json.includes("apikey"), `tool ${tool.id} defaultState must never carry an apiKey field`);
  }
});

test("getHustleTool looks up by id and returns undefined for unknown ids", () => {
  assert.equal(getHustleTool("resumeBuilder").label, "Resume Builder");
  assert.equal(getHustleTool("mockInterview").pillarId, "hustle");
  assert.equal(getHustleTool("nope"), undefined);
});

test("mockInterview is the only tool requiring AI integration", () => {
  const requiresAI = HUSTLE_TOOLS.filter((t) => /^required/i.test(t.aiIntegration.trim()));
  assert.deepEqual(requiresAI.map((t) => t.id), ["mockInterview"]);
});
