/**
 * test/ai-notes.test.js
 * Coverage for the AI note-taker / lesson-builder unit:
 *   lib/ai/notes.js, lib/ai/summarize.js, lib/ai/schemas.js,
 *   lib/ai/lesson-builder.js, lib/ai/game-designer.js, lib/ai/prompts-builder.js
 *
 * Uses Node's built-in test runner: `node --test test/ai-notes.test.js`.
 * The LLM is ALWAYS a fake — zero network, zero keys, zero Electron.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  allTags,
  createNote,
  deleteNote,
  listNotes,
  makeNoteId,
  normalizeTags,
  noteStats,
  searchNotes,
  updateNote,
} from "../lib/ai/notes.js";

import {
  detectGaps,
  extractConceptsOffline,
  notesToText,
  summarizeNotes,
} from "../lib/ai/summarize.js";

import {
  extractJson,
  estimateMinutes,
  finalizeGeneratedLesson,
  repairLesson,
  validateAgainst,
  validateGeneratedLesson,
  validateQuizBatch,
  validateQuizSemantics,
  validateSummary,
  GENERATED_LESSON_SCHEMA,
} from "../lib/ai/schemas.js";

import {
  acceptGeneratedLesson,
  buildLesson,
  buildLessonRequest,
  createGenerationCache,
  estimateCost,
  generateQuiz,
  hashString,
  listAcceptedLessons,
  pricingFor,
  removeGeneratedLesson,
  selectModelForTask,
  LESSON_BUILDER_TOOL_ID,
} from "../lib/ai/lesson-builder.js";

import {
  designGames,
  fillBlankItems,
  matchingConfig,
  quizRushConfig,
  toSrsCards,
  validateGameConfig,
  GAME_KINDS,
  MAX_MATCHING_PAIRS,
} from "../lib/ai/game-designer.js";

import { BUILDER_PROMPTS, BUILDER_PROMPT_VERSION } from "../lib/ai/prompts-builder.js";
import { fillPrompt } from "../lib/ai/fill-prompt.js";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures + fakes
// ─────────────────────────────────────────────────────────────────────────────

/** Fake LLM: replies from a fixed list (last one repeats); records every call. */
function fakeLlm(responses) {
  const calls = [];
  const fn = async (request) => {
    calls.push(request);
    const reply = responses[Math.min(calls.length - 1, responses.length - 1)];
    return typeof reply === "function" ? reply(request) : reply;
  };
  fn.calls = calls;
  return fn;
}

const VALID_LESSON = {
  title: "Reading an adverse-action notice",
  minutes: 6,
  body: [
    "An adverse-action notice must state the specific reasons a credit application was denied.",
    "Regulation B requires standardized reason codes — vague reasons do not satisfy the requirement.",
  ],
  challenge: "Draft a compliant adverse-action notice for a denied applicant using two Reg B reason codes.",
  exampleOutput: "A short notice naming two specific reasons, e.g. insufficient income and high debt-to-income ratio.",
  quiz: [
    {
      q: "What must an adverse-action notice contain?",
      a: "Specific reasons for the denial",
      explanation: "Reg B requires specific, standardized reason codes on every notice.",
      options: [
        { text: "The model's confidence score", explanation: "Scores are internal — notices need human-readable reasons." },
        { text: "Specific reasons for the denial", explanation: "Correct — Reg B requires specific reason codes." },
        { text: "A general apology", explanation: "Politeness is not a regulatory requirement; specific reasons are." },
        { text: "The applicant's credit report", explanation: "The full report is not part of the notice requirement." },
      ],
    },
  ],
  flashcards: [
    { term: "Adverse-action notice", def: "Required notice explaining why credit was denied." },
    { term: "Reg B reason codes", def: "Standardized denial reasons required by Regulation B." },
    { term: "ECOA", def: "Equal Credit Opportunity Act — the statute behind Regulation B." },
  ],
};

const MINI_MODULES = [
  {
    id: "fintech",
    title: "FinTech & Regulation",
    description: "The regulatory spine.",
    lessons: [
      { id: "fintech-1", title: "The regulatory stack", minutes: 8, quiz: [{}, {}], body: ["..."] },
      { id: "fintech-2", title: "Treasury framework", minutes: 7, quiz: [{}, {}], body: ["..."] },
    ],
  },
  {
    id: "stats",
    title: "Statistics",
    description: "The math.",
    lessons: [{ id: "stats-1", title: "Rates and gaps", minutes: 6, quiz: [{}], body: ["..."] }],
  },
];

function seedNotes() {
  let result = createNote({}, { lessonId: "fintech-1", body: "ECOA Regulation B bans proxy variables like ZIP code.", tags: ["Reg-B", "ecoa"] }, 1000, () => 0.1);
  const notes1 = result.notes;
  const a = result.note;
  result = createNote(notes1, { lessonId: "fintech-1", body: "Adverse-action notices need specific reason codes.", tags: ["reg-b"] }, 2000, () => 0.2);
  const notes2 = result.notes;
  const b = result.note;
  result = createNote(notes2, { body: "General reminder: practice the pitch." }, 3000, () => 0.3);
  return { notes: result.notes, a, b, c: result.note };
}

// ─────────────────────────────────────────────────────────────────────────────
// notes.js
// ─────────────────────────────────────────────────────────────────────────────

describe("notes model", () => {
  test("createNote adds a record with id, timestamps, and normalized tags", () => {
    const { notes, note } = createNote({}, { lessonId: "excel-1", body: "  Pivot tables rock.  ", tags: [" Pivot ", "pivot", "EXCEL"] }, 5000);
    assert.equal(note.body, "Pivot tables rock.");
    assert.equal(note.lessonId, "excel-1");
    assert.deepEqual(note.tags, ["pivot", "excel"]);
    assert.equal(note.createdAt, 5000);
    assert.equal(note.updatedAt, 5000);
    assert.equal(notes[note.id], note);
  });

  test("createNote throws on an empty body", () => {
    assert.throws(() => createNote({}, { body: "   " }), /body is required/);
  });

  test("createNote never mutates the input map", () => {
    const original = {};
    createNote(original, { body: "hello world" });
    assert.deepEqual(original, {});
  });

  test("makeNoteId avoids collisions within the map", () => {
    const now = 1234;
    const rand = () => 0.5;
    const first = makeNoteId({}, now, rand);
    // Same now + same rand would collide — a map containing `first` must force a retry loop.
    let flips = 0;
    const flippingRand = () => (flips++ === 0 ? 0.5 : 0.9);
    const second = makeNoteId({ [first]: {} }, now, flippingRand);
    assert.notEqual(second, first);
  });

  test("normalizeTags drops junk and dedupes", () => {
    assert.deepEqual(normalizeTags(["A", "a", 3, "", "  b  "]), ["a", "b"]);
    assert.deepEqual(normalizeTags("nope"), []);
  });

  test("updateNote patches body and bumps updatedAt, preserving createdAt", () => {
    const { notes, note } = createNote({}, { body: "v1" }, 1000);
    const next = updateNote(notes, note.id, { body: "v2" }, 2000);
    assert.equal(next[note.id].body, "v2");
    assert.equal(next[note.id].createdAt, 1000);
    assert.equal(next[note.id].updatedAt, 2000);
    assert.equal(notes[note.id].body, "v1"); // immutability
  });

  test("updateNote on an unknown id returns the same map", () => {
    const { notes } = createNote({}, { body: "hi" });
    assert.equal(updateNote(notes, "nope", { body: "x" }), notes);
  });

  test("deleteNote removes; unknown id is a no-op", () => {
    const { notes, note } = createNote({}, { body: "bye" });
    const next = deleteNote(notes, note.id);
    assert.equal(Object.keys(next).length, 0);
    assert.equal(deleteNote(next, "ghost"), next);
  });

  test("listNotes sorts newest-updated first and filters by lessonId", () => {
    const { notes, a, b } = seedNotes();
    const all = listNotes(notes);
    assert.equal(all.length, 3);
    assert.ok(all[0].updatedAt >= all[1].updatedAt && all[1].updatedAt >= all[2].updatedAt);
    const linked = listNotes(notes, { lessonId: "fintech-1" });
    assert.deepEqual(linked.map((n) => n.id).sort(), [a.id, b.id].sort());
    assert.equal(listNotes(notes, { lessonId: null }).length, 1);
  });

  test("listNotes filters by tag", () => {
    const { notes } = seedNotes();
    assert.equal(listNotes(notes, { tag: "reg-b" }).length, 2);
    assert.equal(listNotes(notes, { tag: "ecoa" }).length, 1);
  });

  test("searchNotes ranks body matches and matches tags", () => {
    const { notes, a } = seedNotes();
    const results = searchNotes(notes, "regulation zip");
    assert.ok(results.length >= 1);
    assert.equal(results[0].note.id, a.id);
    assert.equal(searchNotes(notes, "").length, 0);
    const byTag = searchNotes(notes, "ecoa");
    assert.ok(byTag.some((r) => r.note.id === a.id));
  });

  test("noteStats and allTags aggregate correctly", () => {
    const { notes } = seedNotes();
    const stats = noteStats(notes);
    assert.equal(stats.total, 3);
    assert.equal(stats.byLesson["fintech-1"], 2);
    assert.equal(stats.byLesson[""], 1);
    assert.deepEqual(allTags(notes), ["ecoa", "reg-b"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// summarize.js
// ─────────────────────────────────────────────────────────────────────────────

describe("summarize + gap detection", () => {
  test("detectGaps flags un-noted lessons sorted by curriculum weight", () => {
    const { notes } = seedNotes(); // notes cover fintech-1 only
    const gaps = detectGaps({ notes, modules: MINI_MODULES });
    const ids = gaps.lessonGaps.map((g) => g.lessonId);
    assert.deepEqual(ids, ["fintech-2", "stats-1"]); // fintech-2 weight 11 > stats-1 weight 8
    assert.ok(!ids.includes("fintech-1"));
    assert.deepEqual(gaps.notedLessonIds, ["fintech-1"]);
  });

  test("detectGaps reports flashcard terms never mentioned in notes", () => {
    const { notes } = seedNotes();
    const flashcards = [{ term: "ECOA" }, { term: "WINDOW_MAX" }];
    const gaps = detectGaps({ notes, modules: MINI_MODULES, flashcards });
    assert.deepEqual(gaps.missingTerms, ["WINDOW_MAX"]);
  });

  test("detectGaps accepts an array of notes too", () => {
    const gaps = detectGaps({ notes: [{ id: "x", lessonId: "stats-1", body: "sd" }], modules: MINI_MODULES });
    assert.ok(!gaps.lessonGaps.some((g) => g.lessonId === "stats-1"));
  });

  test("extractConceptsOffline finds curriculum terms in note text", () => {
    const { notes } = seedNotes();
    const found = extractConceptsOffline(notes, [{ term: "Proxy variable" }, { term: "AUC-ROC" }]);
    assert.deepEqual(found, ["Proxy variable"]);
  });

  test("summarizeNotes happy path parses fenced JSON", async () => {
    const { notes } = seedNotes();
    const llm = fakeLlm([
      { ok: true, text: '```json\n{ "summary": "Reg B notes.", "keyConcepts": ["Reg B"], "misconceptions": [] }\n```' },
    ]);
    const result = await summarizeNotes({ notes, llm, model: "claude-sonnet-5" });
    assert.equal(result.ok, true);
    assert.equal(result.summary.summary, "Reg B notes.");
    assert.deepEqual(result.summary.keyConcepts, ["Reg B"]);
    assert.equal(result.noteIds.length, 3);
    assert.equal(llm.calls.length, 1);
    assert.ok(llm.calls[0].user.includes("Adverse-action"));
  });

  test("summarizeNotes filters to one lesson and errors when empty", async () => {
    const { notes } = seedNotes();
    const llm = fakeLlm([{ ok: true, text: '{"summary":"s","keyConcepts":[]}' }]);
    const scoped = await summarizeNotes({ notes, lessonId: "fintech-1", llm, model: "m" });
    assert.equal(scoped.ok, true);
    assert.equal(scoped.noteIds.length, 2);

    const empty = await summarizeNotes({ notes: {}, llm, model: "m" });
    assert.equal(empty.ok, false);
    assert.equal(empty.error.type, "NO_NOTES");
  });

  test("summarizeNotes passes through the caller's typed error", async () => {
    const { notes } = seedNotes();
    const llm = fakeLlm([{ ok: false, error: { type: "AUTH_ERROR", status: 401 } }]);
    const result = await summarizeNotes({ notes, llm, model: "m" });
    assert.equal(result.ok, false);
    assert.equal(result.error.type, "AUTH_ERROR");
  });

  test("summarizeNotes rejects non-JSON output loudly", async () => {
    const { notes } = seedNotes();
    const llm = fakeLlm([{ ok: true, text: "Sorry, I can't help with that." }]);
    const result = await summarizeNotes({ notes, llm, model: "m" });
    assert.equal(result.ok, false);
    assert.equal(result.error.type, "INVALID_OUTPUT");
  });

  test("notesToText numbers notes and carries lesson + tags context", () => {
    const text = notesToText([{ id: "n1", lessonId: "excel-1", tags: ["pivot"], body: "Pivots." }]);
    assert.match(text, /1\. \(lesson: excel-1\) \[tags: pivot\] Pivots\./);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// schemas.js
// ─────────────────────────────────────────────────────────────────────────────

describe("schemas: extraction, repair, validation", () => {
  test("extractJson parses plain, fenced, and prose-wrapped JSON", () => {
    assert.equal(extractJson('{"a":1}').value.a, 1);
    assert.equal(extractJson('```json\n{"a":2}\n```').value.a, 2);
    const prose = extractJson('Here is your lesson:\n{"a":3, "b":{"c":"}"}}\nHope it helps!');
    assert.equal(prose.ok, true);
    assert.equal(prose.value.a, 3);
    assert.equal(prose.value.b.c, "}");
  });

  test("extractJson fails loudly on garbage", () => {
    assert.equal(extractJson("no json here").ok, false);
    assert.equal(extractJson("").ok, false);
    assert.equal(extractJson("{ broken").ok, false);
  });

  test("validateAgainst enforces types, required, and array bounds", () => {
    const errors = validateAgainst({ title: 7 }, GENERATED_LESSON_SCHEMA);
    assert.ok(errors.some((e) => e.includes("$.title")));
    assert.ok(errors.some((e) => e.includes("required")));
  });

  test("a fully valid lesson passes validateGeneratedLesson", () => {
    const result = validateGeneratedLesson(VALID_LESSON);
    assert.equal(result.ok, true);
    assert.equal(result.lesson.title, VALID_LESSON.title);
    assert.equal(result.lesson.quiz[0].options.length, 4);
  });

  test("repair: body string becomes array, missing minutes gets estimated", () => {
    const raw = { ...VALID_LESSON, body: "One single paragraph of prose.", minutes: undefined };
    delete raw.minutes;
    const result = validateGeneratedLesson(raw);
    assert.equal(result.ok, true);
    assert.deepEqual(result.lesson.body, ["One single paragraph of prose."]);
    assert.ok(Number.isInteger(result.lesson.minutes) && result.lesson.minutes >= 3);
  });

  test("repair: snake_case example_output is aliased", () => {
    const raw = { ...VALID_LESSON };
    raw.example_output = raw.exampleOutput;
    delete raw.exampleOutput;
    const result = validateGeneratedLesson(raw);
    assert.equal(result.ok, true);
    assert.equal(result.lesson.exampleOutput, VALID_LESSON.exampleOutput);
  });

  test("repair: case-drifted answer snaps to the exact option text", () => {
    const raw = structuredClone(VALID_LESSON);
    raw.quiz[0].a = "specific reasons for the denial"; // lowercase drift
    const result = validateGeneratedLesson(raw);
    assert.equal(result.ok, true);
    assert.equal(result.lesson.quiz[0].a, "Specific reasons for the denial");
  });

  test("reject: answer matching no option is a hard failure", () => {
    const raw = structuredClone(VALID_LESSON);
    raw.quiz[0].a = "Something the options never say";
    const result = validateGeneratedLesson(raw);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("does not match any option")));
  });

  test("reject: 3-option quiz fails; 5 options are trimmed keeping the answer", () => {
    const three = structuredClone(VALID_LESSON);
    three.quiz[0].options = three.quiz[0].options.slice(0, 3);
    assert.equal(validateGeneratedLesson(three).ok, false);

    const five = structuredClone(VALID_LESSON);
    five.quiz[0].options.push({ text: "A fifth thing", explanation: "Extra." });
    const result = validateGeneratedLesson(five);
    assert.equal(result.ok, true);
    assert.equal(result.lesson.quiz[0].options.length, 4);
    assert.ok(result.lesson.quiz[0].options.some((o) => o.text === result.lesson.quiz[0].a));
  });

  test("reject: missing title / empty body fail with named paths", () => {
    const result = validateGeneratedLesson({ quiz: [] });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("$.title")));
    assert.ok(result.errors.some((e) => e.includes("$.body")));
  });

  test("repairLesson never invents content for unfixable fields", () => {
    const lesson = repairLesson({ title: "T", body: [42, null] });
    assert.deepEqual(lesson.body, []);
    assert.equal(lesson.challenge, undefined);
  });

  test("estimateMinutes clamps to a sane range", () => {
    assert.equal(estimateMinutes([]), 3);
    assert.ok(estimateMinutes([new Array(5000).fill("word").join(" ")]) <= 15);
  });

  test("validateSummary coerces concept arrays and requires summary", () => {
    const good = validateSummary({ summary: "s", keyConcepts: ["a", 3, ""], misconceptions: null });
    assert.equal(good.ok, true);
    assert.deepEqual(good.summary.keyConcepts, ["a"]);
    assert.equal(validateSummary({ keyConcepts: [] }).ok, false);
  });

  test("validateQuizBatch accepts {quiz:[...]} and rejects empties", () => {
    const good = validateQuizBatch({ quiz: [structuredClone(VALID_LESSON.quiz[0])] });
    assert.equal(good.ok, true);
    assert.equal(good.quiz.length, 1);
    assert.equal(validateQuizBatch({ quiz: [] }).ok, false);
    assert.equal(validateQuizBatch({ nope: true }).ok, false);
  });

  test("finalizeGeneratedLesson stamps id, generated flag, and provenance", () => {
    const lesson = finalizeGeneratedLesson(structuredClone(VALID_LESSON), {
      noteIds: ["n1", "n2"],
      model: "claude-fable-5",
      moduleId: "fintech",
      promptVersion: BUILDER_PROMPT_VERSION,
      now: 1784073600000,
    });
    assert.match(lesson.id, /^gen-reading-an-adverse-action-notice-/);
    assert.equal(lesson.generated, true);
    assert.deepEqual(lesson.provenance.noteIds, ["n1", "n2"]);
    assert.equal(lesson.provenance.model, "claude-fable-5");
    assert.equal(lesson.provenance.moduleId, "fintech");
    assert.ok(lesson.provenance.createdAt.startsWith("2026-07-15"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// schemas.js — distractor integrity
//
// A "4-option" question whose options are not DISTINCT is a 2- or 3-option
// question wearing a 4-option costume. This is the layer between an LLM and
// content the learner studies as if a human authored it.
// ─────────────────────────────────────────────────────────────────────────────

/** A schema-shaped quiz item with `optionTexts` as its options, in order. */
function quizItem(a, optionTexts) {
  return {
    q: "Which function counts rows matching several criteria?",
    a,
    explanation: "COUNTIFS counts across multiple criteria ranges.",
    options: optionTexts.map((text) => ({ text, explanation: `Why "${text}" is or is not right.` })),
  };
}

/** VALID_LESSON with its quiz replaced by a single item. */
function lessonWithQuiz(item) {
  const lesson = structuredClone(VALID_LESSON);
  lesson.quiz = [item];
  return lesson;
}

describe("schemas: quiz distractor integrity", () => {
  test("reject: four options that are really two distinct choices", () => {
    const raw = lessonWithQuiz(quizItem("COUNTIFS", ["COUNTIFS", "SUMIF", "SUMIF", "SUMIF"]));
    const result = validateGeneratedLesson(raw);
    assert.equal(result.ok, false, "a 1-in-2 guess must never validate as a 4-option question");
    assert.ok(result.errors.some((e) => /duplicate/i.test(e)), result.errors.join(" | "));
  });

  test("reject: options that differ only by case or whitespace are duplicates", () => {
    const raw = lessonWithQuiz(quizItem("COUNTIFS", ["COUNTIFS", "SUMIF", "sumif ", "SUM  IF"]));
    const result = validateGeneratedLesson(raw);
    assert.equal(result.ok, false, "a learner cannot tell SUMIF from sumif");
    assert.ok(result.errors.some((e) => /duplicate/i.test(e)), result.errors.join(" | "));
  });

  test("reject: a duplicated correct option is not two correct answers, it is one", () => {
    const raw = lessonWithQuiz(quizItem("COUNTIFS", ["COUNTIFS", "COUNTIFS", "SUMIF", "VLOOKUP"]));
    const result = validateGeneratedLesson(raw);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /duplicate/i.test(e)), result.errors.join(" | "));
  });

  test("accept: four genuinely distinct options still pass", () => {
    const raw = lessonWithQuiz(quizItem("COUNTIFS", ["COUNTIFS", "SUMIF", "VLOOKUP", "XLOOKUP"]));
    assert.equal(validateGeneratedLesson(raw).ok, true);
  });

  test("validateQuizSemantics names the duplicated text", () => {
    const errors = validateQuizSemantics([quizItem("COUNTIFS", ["COUNTIFS", "SUMIF", "sumif", "SUMIF"])]);
    assert.equal(errors.length, 1, errors.join(" | "));
    assert.match(errors[0], /^\$\.quiz\[0\]/);
    assert.match(errors[0], /SUMIF/);
  });

  test("validateQuizBatch rejects duplicate options too", () => {
    const batch = validateQuizBatch({ quiz: [quizItem("COUNTIFS", ["COUNTIFS", "SUMIF", "SUMIF", "SUMIF"])] });
    assert.equal(batch.ok, false);
    assert.ok(batch.errors.some((e) => /duplicate/i.test(e)), batch.errors.join(" | "));
  });

  test("repair: surplus options dedupe down to four distinct choices", () => {
    const raw = lessonWithQuiz(
      quizItem("COUNTIFS", ["COUNTIFS", "SUMIF", "sumif", "VLOOKUP", "XLOOKUP"])
    );
    const result = validateGeneratedLesson(raw);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.deepEqual(
      result.lesson.quiz[0].options.map((o) => o.text),
      ["COUNTIFS", "SUMIF", "VLOOKUP", "XLOOKUP"]
    );
  });

  test("reject: surplus options that dedupe below four fail loudly", () => {
    const raw = lessonWithQuiz(quizItem("COUNTIFS", ["COUNTIFS", "SUMIF", "SUMIF", "sumif", "SUMIF "]));
    const result = validateGeneratedLesson(raw);
    assert.equal(result.ok, false, "repair must never invent a distractor to reach four");
    assert.ok(result.errors.some((e) => e.includes("$.quiz[0].options")), result.errors.join(" | "));
  });

  test("repair: trimming five options never hoists the answer to position 0", () => {
    const raw = lessonWithQuiz(quizItem("SUMIF", ["COUNTIFS", "SUMIF", "VLOOKUP", "XLOOKUP", "INDEX"]));
    const result = validateGeneratedLesson(raw);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    // Original order survives — an answer always sitting first is a free tell.
    assert.deepEqual(
      result.lesson.quiz[0].options.map((o) => o.text),
      ["COUNTIFS", "SUMIF", "VLOOKUP", "XLOOKUP"]
    );
  });

  test("reject: the answer can never be truncated away by the >4 repair", () => {
    const raw = lessonWithQuiz(quizItem("INDEX", ["COUNTIFS", "SUMIF", "VLOOKUP", "XLOOKUP", "INDEX"]));
    const result = validateGeneratedLesson(raw);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.ok(result.lesson.quiz[0].options.some((o) => o.text === "INDEX"));
    assert.equal(result.lesson.quiz[0].a, "INDEX");
  });

  test("repair: the answer snaps across whitespace drift, not just case drift", () => {
    const raw = lessonWithQuiz(quizItem("count  ifs", ["COUNT IFS", "SUMIF", "VLOOKUP", "XLOOKUP"]));
    const result = validateGeneratedLesson(raw);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(result.lesson.quiz[0].a, "COUNT IFS");
  });

  test("reject: a blank option is not a choice", () => {
    const raw = lessonWithQuiz(quizItem("COUNTIFS", ["COUNTIFS", "SUMIF", "   ", "XLOOKUP"]));
    assert.equal(validateGeneratedLesson(raw).ok, false);
  });

  test("a duplicate-distractor draft never reaches the review bar via buildLesson", async () => {
    const dup = JSON.stringify(lessonWithQuiz(quizItem("COUNTIFS", ["COUNTIFS", "SUMIF", "SUMIF", "SUMIF"])));
    const llm = fakeLlm([{ ok: true, text: dup }, { ok: true, text: dup }]);
    const result = await buildLesson({
      notes: [{ id: "n1", lessonId: "fintech-1", body: "COUNTIFS counts across criteria." }],
      module: MINI_MODULES[0],
      llm,
      model: "claude-fable-5",
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.type, "INVALID_OUTPUT");
    assert.ok(result.error.errors.some((e) => /duplicate/i.test(e)), result.error.errors.join(" | "));
    assert.equal(llm.calls.length, 2); // one repair retry, no loop
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// lesson-builder.js
// ─────────────────────────────────────────────────────────────────────────────

describe("lesson builder", () => {
  const NOTES = [
    { id: "n1", lessonId: "fintech-1", body: "Reg B requires specific adverse-action reason codes." },
    { id: "n2", lessonId: "fintech-1", body: "ECOA bans proxy variables like ZIP code." },
  ];
  const MODULE = MINI_MODULES[0];

  test("selectModelForTask picks the most capable model for lessons", () => {
    const models = ["claude-sonnet-5", "claude-opus-4-8", "claude-fable-5"];
    assert.equal(selectModelForTask("lesson", models), "claude-fable-5");
    assert.equal(selectModelForTask("lesson", ["claude-opus-4-8"]), "claude-opus-4-8");
  });

  test("selectModelForTask picks the cheap model for high-volume quiz work", () => {
    const models = ["claude-fable-5", "claude-sonnet-5"];
    assert.equal(selectModelForTask("quiz", models), "claude-sonnet-5");
    assert.equal(selectModelForTask("summarize", models), "claude-sonnet-5");
  });

  test("selectModelForTask falls back to the gateway's first model", () => {
    assert.equal(selectModelForTask("lesson", ["my-gateway-llm"]), "my-gateway-llm");
    assert.equal(selectModelForTask("lesson", []), null);
  });

  test("pricingFor honours sonnet's introductory window", () => {
    const during = pricingFor("claude-sonnet-5", new Date("2026-07-15"));
    assert.deepEqual(during, { input: 2, output: 10 });
    const after = pricingFor("claude-sonnet-5", new Date("2026-09-01"));
    assert.deepEqual(after, { input: 3, output: 15 });
    assert.deepEqual(pricingFor("claude-fable-5"), { input: 10, output: 50 });
    assert.equal(pricingFor("some-local-model"), null);
  });

  test("estimateCost surfaces dollars for known models, null for unknown", () => {
    const est = estimateCost({
      system: "s".repeat(400),
      user: "u".repeat(400),
      model: "claude-opus-4-8",
      expectedOutputTokens: 1000,
    });
    assert.ok(est.inputTokens >= 200);
    // ~200 in * $5/M + 1000 out * $25/M ≈ $0.026
    assert.ok(est.usd > 0.02 && est.usd < 0.04);
    assert.equal(estimateCost({ user: "x", model: "mystery" }).usd, null);
  });

  test("buildLessonRequest grounds the prompt in notes + module context", () => {
    const { system, user } = buildLessonRequest({
      notes: NOTES,
      module: MODULE,
      flashcards: [{ term: "Proxy variable" }],
    });
    assert.ok(system.includes("GROUNDING"));
    assert.ok(user.includes("FinTech & Regulation"));
    assert.ok(user.includes("Reg B requires specific adverse-action reason codes."));
    assert.ok(user.includes("The regulatory stack")); // existing lesson titles
    assert.ok(user.includes("Proxy variable")); // offline concept extraction
    assert.ok(!user.includes("{{")); // no unfilled slots
  });

  test("buildLesson happy path: validates, finalizes, and reports cost", async () => {
    const llm = fakeLlm([{ ok: true, text: "```json\n" + JSON.stringify(VALID_LESSON) + "\n```" }]);
    const result = await buildLesson({
      notes: NOTES,
      module: MODULE,
      llm,
      model: "claude-fable-5",
      now: 1752537600000,
    });
    assert.equal(result.ok, true);
    assert.equal(result.fromCache, false);
    assert.equal(result.lesson.generated, true);
    assert.deepEqual(result.lesson.provenance.noteIds, ["n1", "n2"]);
    assert.equal(result.lesson.provenance.model, "claude-fable-5");
    assert.equal(result.lesson.quiz[0].options.length, 4);
    assert.ok(result.estimate.usd > 0);
    assert.equal(llm.calls.length, 1);
    assert.equal(llm.calls[0].options.effort, "high");
    assert.ok(llm.calls[0].options.maxTokens >= 4000);
  });

  test("buildLesson requires notes, an llm, and a model", async () => {
    const llm = fakeLlm([{ ok: true, text: "{}" }]);
    const noNotes = await buildLesson({ notes: [], module: MODULE, llm, model: "m" });
    assert.equal(noNotes.error.type, "NO_NOTES");
    const noLlm = await buildLesson({ notes: NOTES, module: MODULE, model: "m" });
    assert.equal(noLlm.error.type, "NO_LLM");
    const noModel = await buildLesson({ notes: NOTES, module: MODULE, llm });
    assert.equal(noModel.error.type, "BAD_REQUEST");
  });

  test("buildLesson passes the caller's typed error through untouched", async () => {
    const llm = fakeLlm([{ ok: false, error: { type: "NETWORK_ERROR" } }]);
    const result = await buildLesson({ notes: NOTES, module: MODULE, llm, model: "m" });
    assert.equal(result.ok, false);
    assert.equal(result.error.type, "NETWORK_ERROR");
  });

  test("buildLesson retries once through the repair prompt, then succeeds", async () => {
    const llm = fakeLlm([
      { ok: true, text: "Sure! Here's a lesson but not as JSON." },
      { ok: true, text: JSON.stringify(VALID_LESSON) },
    ]);
    const result = await buildLesson({ notes: NOTES, module: MODULE, llm, model: "m" });
    assert.equal(result.ok, true);
    assert.equal(llm.calls.length, 2);
    assert.ok(llm.calls[1].system.includes("repair"));
    assert.ok(llm.calls[1].user.includes("Sure! Here's a lesson"));
  });

  test("buildLesson rejects loudly when repair also fails validation", async () => {
    const badLesson = JSON.stringify({ title: "T", body: [], quiz: [] });
    const llm = fakeLlm([
      { ok: true, text: badLesson },
      { ok: true, text: badLesson },
    ]);
    const result = await buildLesson({ notes: NOTES, module: MODULE, llm, model: "m" });
    assert.equal(result.ok, false);
    assert.equal(result.error.type, "INVALID_OUTPUT");
    assert.ok(Array.isArray(result.error.errors) && result.error.errors.length > 0);
    assert.equal(llm.calls.length, 2); // exactly one repair retry — never a loop
  });

  test("buildLesson serves identical requests from the cache (one bill, not two)", async () => {
    const llm = fakeLlm([{ ok: true, text: JSON.stringify(VALID_LESSON) }]);
    const cache = createGenerationCache();
    const first = await buildLesson({ notes: NOTES, module: MODULE, llm, model: "m", cache });
    const second = await buildLesson({ notes: NOTES, module: MODULE, llm, model: "m", cache });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(second.fromCache, true);
    assert.equal(second.lesson.id, first.lesson.id);
    assert.equal(llm.calls.length, 1);
    assert.equal(cache.size(), 1);
  });

  test("cache key changes when notes change", async () => {
    const llm = fakeLlm([{ ok: true, text: JSON.stringify(VALID_LESSON) }]);
    const cache = createGenerationCache();
    await buildLesson({ notes: NOTES, module: MODULE, llm, model: "m", cache });
    await buildLesson({ notes: [NOTES[0]], module: MODULE, llm, model: "m", cache });
    assert.equal(llm.calls.length, 2);
  });

  test("hashString is stable and distinguishes inputs", () => {
    assert.equal(hashString("abc"), hashString("abc"));
    assert.notEqual(hashString("abc"), hashString("abd"));
  });

  test("generateQuiz returns validated curriculum-shaped items", async () => {
    const llm = fakeLlm([
      { ok: true, text: JSON.stringify({ quiz: [structuredClone(VALID_LESSON.quiz[0])] }) },
    ]);
    const result = await generateQuiz({
      notes: NOTES,
      concept: "adverse-action notices",
      llm,
      model: "claude-sonnet-5",
    });
    assert.equal(result.ok, true);
    assert.equal(result.quiz.length, 1);
    assert.equal(result.quiz[0].options.length, 4);
    assert.equal(llm.calls[0].options.effort, "medium");
    assert.ok(llm.calls[0].user.includes("adverse-action notices"));
  });

  test("acceptGeneratedLesson stores under tools.lessonBuilder; remove reverts", () => {
    const lesson = finalizeGeneratedLesson(structuredClone(VALID_LESSON), { now: 1000 });
    const doc = { tools: {}, notes: {} };
    const next = acceptGeneratedLesson(doc, lesson);
    assert.equal(next.tools[LESSON_BUILDER_TOOL_ID][lesson.id], lesson);
    assert.deepEqual(doc.tools, {}); // immutability
    assert.equal(listAcceptedLessons(next).length, 1);
    const reverted = removeGeneratedLesson(next, lesson.id);
    assert.equal(listAcceptedLessons(reverted).length, 0);
    assert.equal(removeGeneratedLesson(reverted, "ghost"), reverted);
  });

  test("acceptGeneratedLesson refuses an unfinalized lesson", () => {
    assert.throws(() => acceptGeneratedLesson({}, structuredClone(VALID_LESSON)), /finalized/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// game-designer.js
// ─────────────────────────────────────────────────────────────────────────────

describe("game designer", () => {
  const LESSON = finalizeGeneratedLesson(structuredClone(VALID_LESSON), { now: 1000 });

  test("designGames yields matching first and respects maxGames", () => {
    const games = designGames({ lesson: { ...LESSON, quiz: [LESSON.quiz[0], LESSON.quiz[0]] } });
    assert.equal(games.length, 3);
    assert.equal(games[0].kind, GAME_KINDS.MATCHING);
    assert.equal(games[1].kind, GAME_KINDS.QUIZ_RUSH);
    assert.equal(games[2].kind, GAME_KINDS.SRS);
    for (const game of games) {
      assert.deepEqual(validateGameConfig(game), []);
      assert.equal(game.source.lessonId, LESSON.id);
      assert.equal(game.source.generated, true);
    }
  });

  test("designGames on a sparse lesson emits fewer games", () => {
    const sparse = { id: "x", title: "X", body: ["Text."], quiz: [VALID_LESSON.quiz[0]], flashcards: [] };
    const games = designGames({ lesson: sparse });
    assert.equal(games.length, 0); // 1 quiz < 2, no flashcards
    assert.deepEqual(designGames({ lesson: null }), []);
  });

  test("matchingConfig caps the board at MAX_MATCHING_PAIRS", () => {
    const many = new Array(20).fill(null).map((_, i) => ({ term: `t${i}`, def: `d${i}` }));
    assert.equal(matchingConfig(many).pairs.length, MAX_MATCHING_PAIRS);
    assert.deepEqual(matchingConfig(many).pairs[0], { left: "t0", right: "d0" });
  });

  test("quizRushConfig keeps per-option explanations so the game can teach", () => {
    const config = quizRushConfig(VALID_LESSON.quiz);
    assert.equal(config.secondsPerQuestion, 20);
    assert.equal(config.questions[0].answer, VALID_LESSON.quiz[0].a);
    assert.equal(config.questions[0].options.length, 4);
    assert.ok(config.questions[0].options[0].explanation.length > 0);
  });

  test("toSrsCards maps flashcards to front/back and drops junk", () => {
    assert.deepEqual(toSrsCards([{ term: "A", def: "B" }, { nope: 1 }]), [{ front: "A", back: "B" }]);
    assert.deepEqual(toSrsCards(null), []);
  });

  test("fillBlankItems blanks the term and includes the answer among choices", () => {
    const items = fillBlankItems(
      ["The four-fifths rule flags ratios under 0.80. A proxy variable correlates with a protected class."],
      ["four-fifths rule", "proxy variable", "ECOA"]
    );
    assert.equal(items.length, 2);
    assert.ok(items[0].prompt.includes("_____"));
    assert.ok(!items[0].prompt.toLowerCase().includes("four-fifths rule"));
    assert.ok(items[0].choices.includes("four-fifths rule"));
    assert.equal(items[0].answer, "four-fifths rule");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// prompts-builder.js
// ─────────────────────────────────────────────────────────────────────────────

describe("builder prompts", () => {
  test("every template is a plain non-empty string pair", () => {
    for (const [name, pair] of Object.entries(BUILDER_PROMPTS)) {
      assert.equal(typeof pair.system, "string", `${name}.system`);
      assert.equal(typeof pair.user, "string", `${name}.user`);
      assert.ok(pair.system.length > 40, `${name}.system too short`);
    }
    assert.ok(Number.isInteger(BUILDER_PROMPT_VERSION));
  });

  test("lesson template fills every slot with no leftovers", () => {
    const filled = fillPrompt(BUILDER_PROMPTS.lesson.user, {
      moduleTitle: "M",
      moduleDescription: "D",
      existingLessonTitles: "- a",
      curriculumContext: "- b",
      notes: "1. n",
      concepts: "c",
    });
    assert.ok(!filled.includes("{{"));
    assert.ok(!filled.includes("[not provided]"));
  });

  test("grounding and quiz-shape rules are stated in the lesson system prompt", () => {
    assert.ok(BUILDER_PROMPTS.lesson.system.includes("Never invent"));
    assert.ok(BUILDER_PROMPTS.lesson.system.includes("exactly 4 options"));
    assert.ok(BUILDER_PROMPTS.lesson.system.includes("byte-identical"));
  });
});
