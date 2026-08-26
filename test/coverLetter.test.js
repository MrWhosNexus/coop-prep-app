import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultCoverLetterState,
  setCoverLetterField,
  setCoverLetterAIResponse,
  clearCoverLetterAIResponse,
  assembleCoverLetter,
} from "../lib/tools/coverLetter.js";

// Helper: returns a fresh progress-state-shaped object wrapping the default cover-letter slice.
const base = () => ({ tools: { coverLetter: structuredClone(defaultCoverLetterState) } });

/* ── defaultCoverLetterState ── */
test("defaultCoverLetterState has all 7 expected field keys", () => {
  const { fields } = defaultCoverLetterState;
  const keys = ["name", "role", "company", "connection", "skill1", "skill2", "cta"];
  for (const k of keys) {
    assert.ok(Object.prototype.hasOwnProperty.call(fields, k), `missing field: ${k}`);
  }
  assert.equal(Object.keys(fields).length, 7);
});

test("defaultCoverLetterState cta defaults to 'request interview'", () => {
  assert.equal(defaultCoverLetterState.fields.cta, "request interview");
});

test("defaultCoverLetterState aiResponse is null and tokenWarning is false", () => {
  assert.equal(defaultCoverLetterState.aiResponse, null);
  assert.equal(defaultCoverLetterState.tokenWarning, false);
});

/* ── setCoverLetterField ── */
test("setCoverLetterField updates the named field in the returned state", () => {
  const s = base();
  const next = setCoverLetterField(s, "name", "Jane");
  assert.equal(next.tools.coverLetter.fields.name, "Jane");
});

test("setCoverLetterField does not mutate the input state", () => {
  const s = base();
  const next = setCoverLetterField(s, "name", "Jane");
  assert.notEqual(next, s);
  assert.equal(s.tools.coverLetter.fields.name, "");
});

test("setCoverLetterField leaves other fields untouched", () => {
  const s = base();
  const next = setCoverLetterField(s, "role", "Analyst");
  assert.equal(next.tools.coverLetter.fields.name, "");
  assert.equal(next.tools.coverLetter.fields.company, "");
  assert.equal(next.tools.coverLetter.fields.cta, "request interview");
});

/* ── setCoverLetterAIResponse ── */
test("setCoverLetterAIResponse sets aiResponse to the given text", () => {
  const s = base();
  const next = setCoverLetterAIResponse(s, "Dear Hiring Team...");
  assert.equal(next.tools.coverLetter.aiResponse, "Dear Hiring Team...");
});

test("setCoverLetterAIResponse sets tokenWarning to true when passed true", () => {
  const s = base();
  const next = setCoverLetterAIResponse(s, "text", true);
  assert.equal(next.tools.coverLetter.tokenWarning, true);
});

test("setCoverLetterAIResponse tokenWarning defaults to false", () => {
  const s = base();
  const next = setCoverLetterAIResponse(s, "text");
  assert.equal(next.tools.coverLetter.tokenWarning, false);
});

test("setCoverLetterAIResponse sets lastSaved to a number", () => {
  const s = base();
  const next = setCoverLetterAIResponse(s, "text");
  assert.equal(typeof next.tools.coverLetter.lastSaved, "number");
});

test("setCoverLetterAIResponse does not mutate the input state", () => {
  const s = base();
  const next = setCoverLetterAIResponse(s, "text");
  assert.notEqual(next, s);
  assert.equal(s.tools.coverLetter.aiResponse, null);
});

/* ── clearCoverLetterAIResponse ── */
test("clearCoverLetterAIResponse sets aiResponse to null and tokenWarning to false", () => {
  const s = base();
  const withAI = setCoverLetterAIResponse(s, "some text", true);
  const cleared = clearCoverLetterAIResponse(withAI);
  assert.equal(cleared.tools.coverLetter.aiResponse, null);
  assert.equal(cleared.tools.coverLetter.tokenWarning, false);
});

test("clearCoverLetterAIResponse leaves lastSaved unchanged", () => {
  const s = base();
  const withAI = setCoverLetterAIResponse(s, "some text");
  const knownLastSaved = withAI.tools.coverLetter.lastSaved;
  const cleared = clearCoverLetterAIResponse(withAI);
  assert.equal(cleared.tools.coverLetter.lastSaved, knownLastSaved);
});

test("clearCoverLetterAIResponse does not mutate the input state", () => {
  const s = base();
  const withAI = setCoverLetterAIResponse(s, "some text", true);
  const cleared = clearCoverLetterAIResponse(withAI);
  assert.notEqual(cleared, withAI);
  assert.equal(withAI.tools.coverLetter.aiResponse, "some text");
});

/* ── loadProgress migration pattern ── */
test("migration: old save lacking 'tools' gets default coverLetter state merged in", () => {
  const old = { xp: 10, completed: {} };
  const migrated = { ...{ tools: { coverLetter: defaultCoverLetterState } }, ...old };
  assert.deepEqual(migrated.tools.coverLetter, defaultCoverLetterState);
  assert.equal(migrated.xp, 10);
});

/* ── assembleCoverLetter ── */
// CASE A: all fields populated
test("assembleCoverLetter (all fields) returns non-empty string with name and company", () => {
  const fields = {
    name: "Jane",
    role: "Financial Analyst",
    company: "Bloomberg",
    connection: "I interned at a credit union",
    skill1: "Excel dashboards",
    skill2: "Tableau visualizations",
    cta: "request interview",
  };
  const result = assembleCoverLetter(fields);
  assert.equal(typeof result, "string");
  assert.ok(result.length > 100, "result should be longer than 100 chars");
  assert.ok(!result.includes("{{"), "result should not contain '{{'");
  assert.ok(!result.includes("}}"), "result should not contain '}}'");
  assert.ok(!result.includes("undefined"), "result should not contain 'undefined'");
  assert.ok(result.includes("Jane"), "result should include the name");
  assert.ok(result.includes("Bloomberg"), "result should include the company");
});

// CASE B: skill2 blank
test("assembleCoverLetter (skill2 blank) has no 'undefined' and no dangling fragment", () => {
  const fields = {
    name: "Jane",
    role: "Financial Analyst",
    company: "Bloomberg",
    connection: "I interned at a credit union",
    skill1: "Excel dashboards",
    skill2: "",
    cta: "request interview",
  };
  const result = assembleCoverLetter(fields);
  assert.ok(!result.includes("undefined"), "result should not contain 'undefined'");
  assert.ok(result.includes("Excel dashboards"), "result should include skill1 content");
  assert.doesNotMatch(result, /(in|of|as well as)\s*[.,]/, "no dangling fragment");
});

// CASE C: both skills blank
test("assembleCoverLetter (both skills blank) returns string with no 'undefined' or dangling fragment", () => {
  const fields = {
    name: "Jane",
    role: "Financial Analyst",
    company: "Bloomberg",
    connection: "I interned at a credit union",
    skill1: "",
    skill2: "",
    cta: "request interview",
  };
  const result = assembleCoverLetter(fields);
  assert.equal(typeof result, "string");
  assert.ok(result.length > 50, "result should be longer than 50 chars");
  assert.ok(!result.includes("undefined"), "result should not contain 'undefined'");
  assert.doesNotMatch(result, /(in|of|as well as)\s*[.,]/, "no dangling fragment");
});
