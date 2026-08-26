import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultState, toggleBookmark, addHighlight, removeHighlight } from "../lib/progress.js";
import { searchCurriculum } from "../lib/search.js";

/* ── bookmarks ── */
test("defaultState includes bookmarks + highlights", () => {
  const s = defaultState();
  assert.deepEqual(s.bookmarks, {});
  assert.deepEqual(s.highlights, {});
});

test("toggleBookmark adds then removes a lesson", () => {
  let s = defaultState();
  s = toggleBookmark(s, "excel-1");
  assert.equal(s.bookmarks["excel-1"], true);
  s = toggleBookmark(s, "excel-1");
  assert.equal(s.bookmarks["excel-1"], undefined);
});

test("toggleBookmark does not mutate the input state", () => {
  const s = defaultState();
  const next = toggleBookmark(s, "excel-1");
  assert.notEqual(s, next);
  assert.deepEqual(s.bookmarks, {});
});

/* ── highlights ── */
test("addHighlight appends a unique snippet per lesson", () => {
  let s = defaultState();
  s = addHighlight(s, "excel-1", "pivot table");
  assert.deepEqual(s.highlights["excel-1"], ["pivot table"]);
  // duplicate is ignored
  s = addHighlight(s, "excel-1", "pivot table");
  assert.deepEqual(s.highlights["excel-1"], ["pivot table"]);
  // a second distinct snippet appends
  s = addHighlight(s, "excel-1", "XLOOKUP");
  assert.deepEqual(s.highlights["excel-1"], ["pivot table", "XLOOKUP"]);
});

test("addHighlight ignores blank/whitespace selections", () => {
  let s = defaultState();
  s = addHighlight(s, "excel-1", "   ");
  s = addHighlight(s, "excel-1", "");
  assert.equal(s.highlights["excel-1"], undefined);
});

test("removeHighlight drops one snippet and cleans up empty lists", () => {
  let s = defaultState();
  s = addHighlight(s, "excel-1", "pivot table");
  s = addHighlight(s, "excel-1", "XLOOKUP");
  s = removeHighlight(s, "excel-1", "pivot table");
  assert.deepEqual(s.highlights["excel-1"], ["XLOOKUP"]);
  s = removeHighlight(s, "excel-1", "XLOOKUP");
  assert.equal(s.highlights["excel-1"], undefined);
});

/* ── search ── */
const MODULES = [
  {
    id: "excel", title: "Advanced Excel", color: "#1d6f42", description: "Pivot tables and XLOOKUP.",
    lessons: [
      { id: "excel-1", title: "Pivot tables from scratch", body: ["A pivot table summarizes raw data."], challenge: "Build a pivot.", quiz: [{ q: "What is a pivot?", a: "A summary", options: ["A summary", "A chart"] }] },
      { id: "excel-2", title: "XLOOKUP basics", body: ["XLOOKUP replaces VLOOKUP."], challenge: "Use XLOOKUP.", quiz: [] },
    ],
  },
  {
    id: "stats", title: "Statistics", color: "#1e40af", description: "Mean and variance.",
    lessons: [
      { id: "stats-1", title: "Descriptive statistics", body: ["The mean is the average."], challenge: "Compute a mean.", quiz: [] },
    ],
  },
];
const FLASHCARDS = [
  { term: "XLOOKUP", def: "Modern lookup function in Excel." },
  { term: "Variance", def: "Average squared deviation from the mean." },
];

test("searchCurriculum returns [] for blank or too-short queries", () => {
  assert.deepEqual(searchCurriculum(MODULES, FLASHCARDS, ""), []);
  assert.deepEqual(searchCurriculum(MODULES, FLASHCARDS, " "), []);
  assert.deepEqual(searchCurriculum(MODULES, FLASHCARDS, "a"), []);
});

test("searchCurriculum matches lesson title and body, case-insensitively", () => {
  const res = searchCurriculum(MODULES, FLASHCARDS, "pivot");
  const lesson = res.find((r) => r.type === "lesson" && r.lessonId === "excel-1");
  assert.ok(lesson, "should find the pivot tables lesson");
  assert.equal(lesson.moduleId, "excel");
  assert.equal(lesson.title, "Pivot tables from scratch");
  assert.match(lesson.snippet.toLowerCase(), /pivot/);
});

test("searchCurriculum matches flashcards by term and definition", () => {
  const res = searchCurriculum(MODULES, FLASHCARDS, "variance");
  const card = res.find((r) => r.type === "flashcard");
  assert.ok(card, "should find the Variance flashcard");
  assert.equal(card.term, "Variance");
  assert.equal(typeof card.index, "number");
});

test("searchCurriculum matches across fields (XLOOKUP in lesson + flashcard)", () => {
  const res = searchCurriculum(MODULES, FLASHCARDS, "xlookup");
  assert.ok(res.some((r) => r.type === "lesson" && r.lessonId === "excel-2"));
  assert.ok(res.some((r) => r.type === "flashcard" && r.term === "XLOOKUP"));
});

test("searchCurriculum returns [] when nothing matches", () => {
  assert.deepEqual(searchCurriculum(MODULES, FLASHCARDS, "zzzznomatch"), []);
});
