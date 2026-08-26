import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  STORY_TAGS,
  defaultStarStoryBankState,
  addStory,
  updateStory,
  removeStory,
  tagStory,
  untagStory,
  logStoryUsage,
  setActiveStory,
  createStory,
  scoreStory,
  storiesByTag,
  tagCoverage,
  bankStatus,
  tagsForQuestion,
  findStoriesForQuestion,
  storyToBullet,
  storyToStarText,
  analyzeStarText,
  extractNumbers,
  exportStories,
  exportStoriesText,
} from "../lib/tools/starStories.js";

import {
  defaultResumeBuilderState,
  setResumeBuilderField,
  setResumeContactField,
  setResumeSkills,
  addResumeSection,
  updateResumeSection,
  removeResumeSection,
  addResumeBullet,
  updateResumeBullet,
  removeResumeBullet,
  addBulletFromStory,
  setResumeBuilderAIResponse,
  clearResumeBuilderAIResponse,
  analyzeBullet,
  suggestBulletRewrite,
  extractKeywordsFromJobDescription,
  matchKeywords,
  keywordCoverage,
  assembleResume,
  auditResume,
  buildBulletPromptSlots,
} from "../lib/tools/resume.js";

import {
  APPLICATION_STATUSES,
  APPLICATION_SOURCES,
  defaultApplicationTrackerState,
  addApplication,
  updateApplication,
  removeApplication,
  setApplicationStatus,
  createApplication,
  sortByNextAction,
  dueApplications,
  funnelStats,
  diagnosePipeline,
  exportApplicationsCsv,
  addDaysISO,
  daysBetweenISO,
} from "../lib/tools/applications.js";

import {
  REPLY_STATUSES,
  FOLLOW_UP_DAYS,
  defaultNetworkTrackerState,
  addContact,
  updateContact,
  removeContact,
  setContactStatus,
  markContactFollowedUp,
  markThankYouSent,
  createContact,
  computeNextFollowUpDate,
  dueContacts,
  thankYousOwed,
  networkStats,
  diagnoseNetwork,
  outreachTemplate,
  thankYouTemplate,
  updateTemplate,
} from "../lib/tools/network.js";

import {
  defaultSalaryNegotiationState,
  setSalaryNegotiationField,
  setBatnaField,
  addOffer,
  updateOffer,
  removeOffer,
  clearSalaryNegotiationScript,
  parseMoney,
  formatMoney,
  totalComp,
  compareOffers,
  marketPosition,
  suggestTargetAsk,
  generateNegotiationScript,
  batnaPrep,
  negotiationReadiness,
} from "../lib/tools/negotiation.js";

import {
  defaultMockInterviewState,
  FIXED_QUESTIONS,
  RUBRIC,
  getQuestionBank,
  pickQuestion,
  startMockInterviewSession,
  recordMockInterviewAnswer,
  setMockInterviewFeedback,
  clearMockInterviewSession,
  setActiveQuestion,
  detectStarParts,
  gradeAnswerOffline,
  gradeAnswer,
  sessionStats,
  buildFeedbackSlots,
  describeAiError,
  suggestStoriesFor,
  prefillFromStory,
  MOCK_INTERVIEW_PROMPT,
} from "../lib/tools/mockInterview.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const emptyState = () => ({ tools: {} });

const GOOD_STORY = {
  name: "HMDA bias audit",
  situation: "During the COOP Financial Services Track I was handed a 100-record HMDA loan dataset with no documentation.",
  task: "I needed to determine whether approval rates differed across demographic groups and present it to the cohort.",
  action: "I built a pivot table breaking approvals out by race, then computed a four-fifths ratio for each group and validated the totals against the raw counts.",
  result: "I found Black applicants approved at 56.25% against 86% for White applicants, a 0.65 ratio that fails the four-fifths rule, and the finding became the cohort's reference example.",
  tags: ["analyticalWin"],
};

const WEAK_STORY = {
  name: "Group project",
  situation: "We had a group project.",
  task: "We had to finish it.",
  action: "We worked together and got it done.",
  result: "It went well.",
  tags: [],
};

/* =========================================================================
   STAR Story Bank — the keystone
   ========================================================================= */

test("defaultStarStoryBankState matches the spec shape", () => {
  assert.deepEqual(defaultStarStoryBankState, { stories: [], activeStoryId: null, lastSaved: null });
});

test("STORY_TAGS is the fixed lesson enum", () => {
  assert.deepEqual([...STORY_TAGS], ["conflict", "failure", "leadership", "pressure", "analyticalWin", "other"]);
});

test("createStory normalizes every field and drops unknown tags", () => {
  const s = createStory({ name: "X", tags: ["conflict", "nonsense", "conflict"] });
  assert.deepEqual(s.tags, ["conflict"]);
  assert.equal(s.situation, "");
  assert.ok(Array.isArray(s.lastUsedFor));
  assert.equal(typeof s.id, "string");
});

test("addStory appends, normalizes, and sets the story active", () => {
  const next = addStory(emptyState(), GOOD_STORY);
  assert.equal(next.tools.starStoryBank.stories.length, 1);
  assert.equal(next.tools.starStoryBank.activeStoryId, next.tools.starStoryBank.stories[0].id);
});

test("addStory does not mutate the input state", () => {
  const s = emptyState();
  addStory(s, GOOD_STORY);
  assert.deepEqual(s.tools, {});
});

test("addStory works on a state with no tools namespace at all (migration)", () => {
  const next = addStory({ xp: 10 }, GOOD_STORY);
  assert.equal(next.tools.starStoryBank.stories.length, 1);
  assert.equal(next.xp, 10);
});

test("updateStory patches by id and cannot change the id", () => {
  const s1 = addStory(emptyState(), GOOD_STORY);
  const id = s1.tools.starStoryBank.stories[0].id;
  const s2 = updateStory(s1, id, { name: "Renamed", id: "hacked" });
  assert.equal(s2.tools.starStoryBank.stories[0].name, "Renamed");
  assert.equal(s2.tools.starStoryBank.stories[0].id, id);
});

test("updateStory re-normalizes tags in the patch", () => {
  const s1 = addStory(emptyState(), GOOD_STORY);
  const id = s1.tools.starStoryBank.stories[0].id;
  const s2 = updateStory(s1, id, { tags: ["failure", "bogus"] });
  assert.deepEqual(s2.tools.starStoryBank.stories[0].tags, ["failure"]);
});

test("updateStory ignores an unknown id", () => {
  const s1 = addStory(emptyState(), GOOD_STORY);
  const s2 = updateStory(s1, "nope", { name: "X" });
  assert.equal(s2.tools.starStoryBank.stories[0].name, GOOD_STORY.name);
});

test("removeStory drops the story and clears activeStoryId when it pointed there", () => {
  const s1 = addStory(emptyState(), GOOD_STORY);
  const id = s1.tools.starStoryBank.stories[0].id;
  const s2 = removeStory(s1, id);
  assert.equal(s2.tools.starStoryBank.stories.length, 0);
  assert.equal(s2.tools.starStoryBank.activeStoryId, null);
});

test("setActiveStory sets the pointer", () => {
  const s1 = addStory(emptyState(), GOOD_STORY);
  const s2 = setActiveStory(s1, null);
  assert.equal(s2.tools.starStoryBank.activeStoryId, null);
});

test("tagStory adds a valid tag and is idempotent", () => {
  const s1 = addStory(emptyState(), { ...GOOD_STORY, tags: [] });
  const id = s1.tools.starStoryBank.stories[0].id;
  const s2 = tagStory(s1, id, "pressure");
  const s3 = tagStory(s2, id, "pressure");
  assert.deepEqual(s3.tools.starStoryBank.stories[0].tags, ["pressure"]);
});

test("tagStory rejects a tag outside the enum, returning state unchanged", () => {
  const s1 = addStory(emptyState(), { ...GOOD_STORY, tags: [] });
  const id = s1.tools.starStoryBank.stories[0].id;
  const s2 = tagStory(s1, id, "vibes");
  assert.equal(s2, s1);
});

test("untagStory removes the tag", () => {
  const s1 = addStory(emptyState(), { ...GOOD_STORY, tags: ["conflict", "failure"] });
  const id = s1.tools.starStoryBank.stories[0].id;
  const s2 = untagStory(s1, id, "conflict");
  assert.deepEqual(s2.tools.starStoryBank.stories[0].tags, ["failure"]);
});

test("logStoryUsage appends { question, date } — the living-document rule", () => {
  const s1 = addStory(emptyState(), GOOD_STORY);
  const id = s1.tools.starStoryBank.stories[0].id;
  const s2 = logStoryUsage(s1, id, "Tell me about a failure.", "2026-08-01");
  assert.deepEqual(s2.tools.starStoryBank.stories[0].lastUsedFor, [
    { question: "Tell me about a failure.", date: "2026-08-01" },
  ]);
});

test("logStoryUsage accumulates across interviews", () => {
  let s = addStory(emptyState(), GOOD_STORY);
  const id = s.tools.starStoryBank.stories[0].id;
  s = logStoryUsage(s, id, "Q1", "2026-08-01");
  s = logStoryUsage(s, id, "Q2", "2026-08-05");
  assert.equal(s.tools.starStoryBank.stories[0].lastUsedFor.length, 2);
});

/* ── text analysis ── */

test("extractNumbers finds percentages, currency, and plain counts", () => {
  assert.ok(extractNumbers("approved at 56.25%").length > 0);
  assert.ok(extractNumbers("saved $3.2M").length > 0);
  assert.ok(extractNumbers("across 6 groups").length > 0);
  assert.deepEqual(extractNumbers("no numbers here at all"), []);
});

test("analyzeStarText computes the I/we ratio", () => {
  const mine = analyzeStarText("I built it and I shipped it");
  assert.equal(mine.firstPerson, true);
  const ours = analyzeStarText("We built it and we shipped it and our team won");
  assert.equal(ours.firstPerson, false);
  assert.ok(ours.weCount > ours.iCount);
});

test("analyzeStarText on empty text is zeroed, not NaN", () => {
  const a = analyzeStarText("");
  assert.equal(a.words, 0);
  assert.equal(a.iRatio, 0);
  assert.equal(a.firstPerson, false);
});

/* ── scoring ── */

test("scoreStory gives a complete quantified first-person story full marks", () => {
  const r = scoreStory(createStory(GOOD_STORY));
  assert.equal(r.score, 100);
  assert.equal(r.complete, true);
  assert.deepEqual(r.missing, []);
});

test("scoreStory names what is missing on a weak story", () => {
  const r = scoreStory(createStory(WEAK_STORY));
  assert.ok(r.score < 60);
  assert.equal(r.complete, false);
  assert.ok(r.missing.includes("quantifiedResult"));
  assert.ok(r.missing.includes("firstPersonAction"));
  assert.ok(r.missing.includes("tag"));
});

test("scoreStory flags a result with no number", () => {
  const r = scoreStory(createStory({ ...GOOD_STORY, result: "It went really well and everyone was pleased with it." }));
  assert.equal(r.hasNumbers, false);
  assert.ok(r.missing.includes("quantifiedResult"));
});

test("scoreStory on an empty story does not throw and scores 0", () => {
  const r = scoreStory({});
  assert.equal(r.score, 0);
  assert.equal(r.complete, false);
});

test("scoreStory tolerates undefined", () => {
  assert.equal(scoreStory(undefined).score, 0);
});

/* ── retrieval ── */

test("storiesByTag filters", () => {
  let s = addStory(emptyState(), GOOD_STORY);
  s = addStory(s, { ...WEAK_STORY, tags: ["failure"] });
  assert.equal(storiesByTag(s, "failure").length, 1);
  assert.equal(storiesByTag(s, "analyticalWin").length, 1);
  assert.equal(storiesByTag(s, "conflict").length, 0);
});

test("tagCoverage names the categories with no story, ignoring 'other'", () => {
  const cov = tagCoverage([createStory({ tags: ["conflict"] }), createStory({ tags: ["other"] })]);
  assert.equal(cov.counts.conflict, 1);
  assert.deepEqual(cov.gaps, ["failure", "leadership", "pressure", "analyticalWin"]);
  assert.equal(cov.covered, 1);
  assert.equal(cov.ready, false);
});

test("tagCoverage is ready only with full coverage and 6+ stories", () => {
  const stories = ["conflict", "failure", "leadership", "pressure", "analyticalWin", "other"].map((t) =>
    createStory({ tags: [t] })
  );
  const cov = tagCoverage(stories);
  assert.deepEqual(cov.gaps, []);
  assert.equal(cov.ready, true);
});

test("tagCoverage handles a non-array", () => {
  assert.equal(tagCoverage(undefined).covered, 0);
});

test("bankStatus reports emptiness in plain language", () => {
  const st = bankStatus(emptyState());
  assert.equal(st.storyCount, 0);
  assert.match(st.messages.join(" "), /6-8/);
});

test("bankStatus flags unquantified results", () => {
  const s = addStory(emptyState(), { ...GOOD_STORY, result: "It was a big success for everyone." });
  const st = bankStatus(s);
  assert.match(st.messages.join(" "), /no number in the Result/i);
});

test("tagsForQuestion maps question text to categories", () => {
  assert.deepEqual(tagsForQuestion("Tell me about a time you failed."), ["failure"]);
  assert.ok(tagsForQuestion("Tell me about a conflict with a coworker").includes("conflict"));
  assert.ok(tagsForQuestion("Walk me through an analysis you're proud of").includes("analyticalWin"));
  assert.deepEqual(tagsForQuestion(""), []);
});

test("findStoriesForQuestion ranks a tag-matching story above a non-matching one", () => {
  const stories = [createStory({ ...WEAK_STORY, name: "B", tags: ["leadership"] }), createStory({ ...GOOD_STORY, name: "A" })];
  const ranked = findStoriesForQuestion(stories, "Walk me through an analysis you are proud of");
  assert.equal(ranked[0].story.name, "A");
  assert.deepEqual(ranked[0].matchedTags, ["analyticalWin"]);
});

test("findStoriesForQuestion penalizes a story already used on that exact question", () => {
  const fresh = createStory({ ...GOOD_STORY, name: "Fresh" });
  const used = createStory({
    ...GOOD_STORY,
    name: "Used",
    lastUsedFor: [{ question: "Walk me through an analysis", date: "2026-01-01" }],
  });
  const ranked = findStoriesForQuestion([used, fresh], "Walk me through an analysis");
  assert.equal(ranked[0].story.name, "Fresh");
});

test("findStoriesForQuestion tolerates an empty bank", () => {
  assert.deepEqual(findStoriesForQuestion([], "anything"), []);
});

/* ── rendering / reuse ── */

test("storyToBullet builds a resume bullet from Action + quantified Result", () => {
  const bullet = storyToBullet(createStory(GOOD_STORY));
  assert.ok(bullet.length > 0);
  assert.ok(!/^I\s/.test(bullet), "must not open on a pronoun");
  assert.ok(/56\.25%|0\.65/.test(bullet), "must carry the number from the Result");
});

test("storyToBullet returns '' for a story with no action", () => {
  assert.equal(storyToBullet(createStory({ name: "X" })), "");
  assert.equal(storyToBullet(undefined), "");
});

test("storyToBullet with no result still returns the action stem", () => {
  const bullet = storyToBullet(createStory({ action: "I built a pivot table from the raw export." }));
  assert.equal(bullet, "Built a pivot table from the raw export");
});

test("storyToStarText labels each part and omits blanks", () => {
  const text = storyToStarText(createStory({ name: "N", situation: "S here", result: "R here" }));
  assert.match(text, /Situation: S here/);
  assert.match(text, /Result: R here/);
  assert.ok(!text.includes("Task:"));
});

test("exportStories returns portable JSON", () => {
  const s = addStory(emptyState(), GOOD_STORY);
  const out = exportStories(s);
  assert.equal(out.stories.length, 1);
  assert.doesNotThrow(() => JSON.stringify(out));
});

test("exportStoriesText handles an empty bank", () => {
  assert.match(exportStoriesText(emptyState()), /No stories yet/);
});

/* =========================================================================
   Resume Builder
   ========================================================================= */

test("defaultResumeBuilderState carries every spec key", () => {
  for (const k of ["targetRole", "targetCompany", "pastedJobDescription", "keywords", "bullets", "aiResponse", "lastSaved", "tokenWarning"]) {
    assert.ok(k in defaultResumeBuilderState, `missing ${k}`);
  }
});

/* ── bullet analysis ── */

test("analyzeBullet flags the lesson's own bad bullet", () => {
  const r = analyzeBullet("Responsible for financial analysis and reporting.");
  assert.equal(r.weakVerb, "responsible for");
  assert.equal(r.hasActionVerb, false);
  assert.equal(r.hasQuantifiedResult, false);
  assert.ok(r.score < 40);
  assert.match(r.issues.join(" "), /duty/i);
});

test("analyzeBullet scores the lesson's own good bullet highly", () => {
  const r = analyzeBullet(
    "Analyzed a 100-record loan dataset to compute approval-rate disparities across 6 demographic groups, flagging a 0.60 four-fifths ratio"
  );
  assert.equal(r.hasActionVerb, true);
  assert.equal(r.actionVerb, "analyzed");
  assert.equal(r.hasQuantifiedResult, true);
  assert.ok(r.score >= 70);
});

test("analyzeBullet catches a strong verb with no number", () => {
  const r = analyzeBullet("Built a three-statement model for a local startup");
  assert.equal(r.hasActionVerb, true);
  assert.equal(r.hasQuantifiedResult, false);
  assert.match(r.issues.join(" "), /No number/i);
});

test("analyzeBullet catches 'helped with' mid-sentence", () => {
  const r = analyzeBullet("Analyst who helped with reporting");
  assert.ok(r.weakVerb);
});

test("analyzeBullet flags an over-long bullet", () => {
  const long = "Analyzed " + "data ".repeat(40) + "for 5 clients";
  const r = analyzeBullet(long);
  assert.match(r.issues.join(" "), /trim/i);
});

test("analyzeBullet on empty text does not throw", () => {
  const r = analyzeBullet("");
  assert.equal(r.score, 0);
  assert.equal(r.words, 0);
});

test("analyzeBullet credits a matched keyword", () => {
  const withKw = analyzeBullet("Built financial modeling workbooks for 12 accounts", [{ phrase: "financial modeling" }]);
  assert.deepEqual(withKw.matchedKeywords, ["financial modeling"]);
});

test("suggestBulletRewrite strips the weak verb and marks the missing number", () => {
  const out = suggestBulletRewrite("Responsible for financial analysis");
  assert.ok(!/responsible for/i.test(out));
  assert.match(out, /\[quantified result/);
});

test("suggestBulletRewrite leaves a strong quantified bullet essentially alone", () => {
  const raw = "Analyzed 100 records and flagged a 0.60 ratio";
  assert.equal(suggestBulletRewrite(raw), raw);
});

test("suggestBulletRewrite on empty returns empty", () => {
  assert.equal(suggestBulletRewrite(""), "");
});

/* ── keywords ── */

const JD = `
  JP Morgan Wealth Management is seeking an Analyst. The Analyst will support
  financial modeling and financial analysis for client portfolios. Requirements:
  advanced Excel (pivot tables, XLOOKUP), experience with data analysis, and
  strong client relationship management skills. Tableau a plus. The analyst will
  prepare reports on portfolio management and support due diligence.
`;

test("extractKeywordsFromJobDescription lifts exact multi-word phrases", () => {
  const kws = extractKeywordsFromJobDescription(JD).map((k) => k.phrase);
  assert.ok(kws.includes("financial modeling"));
  assert.ok(kws.includes("client relationship management"));
  assert.ok(kws.includes("xlookup"));
});

test("extractKeywordsFromJobDescription counts repetition as emphasis", () => {
  const kws = extractKeywordsFromJobDescription(JD);
  const analyst = kws.find((k) => k.phrase === "analyst");
  assert.ok(analyst, "a word repeated 4 times should surface");
  assert.ok(analyst.count >= 3);
});

test("extractKeywordsFromJobDescription drops stop words and single mentions", () => {
  const kws = extractKeywordsFromJobDescription(JD).map((k) => k.phrase);
  assert.ok(!kws.includes("the"));
  assert.ok(!kws.includes("and"));
});

test("extractKeywordsFromJobDescription respects the limit and empty input", () => {
  assert.ok(extractKeywordsFromJobDescription(JD, 3).length <= 3);
  assert.deepEqual(extractKeywordsFromJobDescription(""), []);
  assert.deepEqual(extractKeywordsFromJobDescription(null), []);
});

test("extractKeywordsFromJobDescription does not emit a phrase contained in a longer claimed one", () => {
  const kws = extractKeywordsFromJobDescription("client relationship management is key to relationship management here").map(
    (k) => k.phrase
  );
  assert.ok(kws.includes("client relationship management"));
  assert.ok(!kws.includes("relationship management"));
});

test("matchKeywords is case-insensitive and tolerates bad input", () => {
  assert.deepEqual(matchKeywords("Built FINANCIAL MODELING tools", ["financial modeling"]), ["financial modeling"]);
  assert.deepEqual(matchKeywords("", ["x"]), []);
  assert.deepEqual(matchKeywords("text", null), []);
});

test("setResumeBuilderField on pastedJobDescription re-derives keywords live", () => {
  const s = setResumeBuilderField(emptyState(), "pastedJobDescription", JD);
  assert.ok(s.tools.resumeBuilder.keywords.length > 0);
});

test("setResumeBuilderField on the JD re-matches existing bullets", () => {
  let s = addResumeBullet(emptyState(), "Built financial modeling workbooks for 12 accounts");
  assert.deepEqual(s.tools.resumeBuilder.bullets[0].matchedKeywords, []);
  s = setResumeBuilderField(s, "pastedJobDescription", JD);
  assert.ok(s.tools.resumeBuilder.bullets[0].matchedKeywords.includes("financial modeling"));
});

test("keywordCoverage reports matched vs missing against the whole resume", () => {
  let s = setResumeBuilderField(emptyState(), "pastedJobDescription", JD);
  s = addResumeBullet(s, "Built financial modeling workbooks for 12 accounts");
  const cov = keywordCoverage(s);
  assert.ok(cov.matched.includes("financial modeling"));
  assert.ok(cov.missing.length > 0);
  assert.ok(cov.ratio > 0 && cov.ratio < 1);
});

test("keywordCoverage with no keywords is a zeroed, non-NaN ratio", () => {
  const cov = keywordCoverage(emptyState());
  assert.equal(cov.total, 0);
  assert.equal(cov.ratio, 0);
});

/* ── reducers ── */

test("addResumeBullet stores the derived analysis on the bullet", () => {
  const s = addResumeBullet(emptyState(), "Analyzed 100 records, flagging a 0.60 ratio");
  const b = s.tools.resumeBuilder.bullets[0];
  assert.equal(b.actionVerb, "analyzed");
  assert.ok(b.quantifiedResult);
});

test("updateResumeBullet re-runs the analysis when raw changes", () => {
  const s1 = addResumeBullet(emptyState(), "Responsible for reporting");
  const id = s1.tools.resumeBuilder.bullets[0].id;
  assert.equal(s1.tools.resumeBuilder.bullets[0].actionVerb, "");
  const s2 = updateResumeBullet(s1, id, { raw: "Automated reporting, saving 4 hrs per week" });
  assert.equal(s2.tools.resumeBuilder.bullets[0].actionVerb, "automated");
  assert.ok(s2.tools.resumeBuilder.bullets[0].quantifiedResult);
});

test("removeResumeBullet drops only the named bullet", () => {
  let s = addResumeBullet(emptyState(), "One 1");
  s = addResumeBullet(s, "Two 2");
  const id = s.tools.resumeBuilder.bullets[0].id;
  s = removeResumeBullet(s, id);
  assert.equal(s.tools.resumeBuilder.bullets.length, 1);
  assert.equal(s.tools.resumeBuilder.bullets[0].raw, "Two 2");
});

test("removeResumeSection also removes that section's bullets", () => {
  let s = addResumeSection(emptyState(), { title: "Analyst", org: "Firm" });
  const secId = s.tools.resumeBuilder.sections[0].id;
  s = addResumeBullet(s, "Analyzed 5 things", secId);
  s = addResumeBullet(s, "Orphan bullet 1", null);
  s = removeResumeSection(s, secId);
  assert.equal(s.tools.resumeBuilder.sections.length, 0);
  assert.equal(s.tools.resumeBuilder.bullets.length, 1);
});

test("updateResumeSection patches and preserves the id", () => {
  let s = addResumeSection(emptyState(), { title: "A" });
  const id = s.tools.resumeBuilder.sections[0].id;
  s = updateResumeSection(s, id, { title: "B", id: "hacked" });
  assert.equal(s.tools.resumeBuilder.sections[0].title, "B");
  assert.equal(s.tools.resumeBuilder.sections[0].id, id);
});

test("addResumeSection falls back to a known kind", () => {
  const s = addResumeSection(emptyState(), { kind: "nonsense" });
  assert.equal(s.tools.resumeBuilder.sections[0].kind, "experience");
});

test("setResumeSkills accepts an array or a comma string", () => {
  assert.deepEqual(setResumeSkills(emptyState(), ["Excel", " Tableau "]).tools.resumeBuilder.skills, ["Excel", "Tableau"]);
  assert.deepEqual(setResumeSkills(emptyState(), "Excel, Tableau, ,SQL").tools.resumeBuilder.skills, ["Excel", "Tableau", "SQL"]);
});

test("setResumeContactField sets one contact field immutably", () => {
  const s = setResumeContactField(emptyState(), "email", "a@b.com");
  assert.equal(s.tools.resumeBuilder.contact.email, "a@b.com");
  assert.equal(s.tools.resumeBuilder.contact.name, "");
});

test("resume AI response reducers mirror the coverLetter contract", () => {
  const s1 = setResumeBuilderAIResponse(emptyState(), "text", true);
  assert.equal(s1.tools.resumeBuilder.aiResponse, "text");
  assert.equal(s1.tools.resumeBuilder.tokenWarning, true);
  const s2 = clearResumeBuilderAIResponse(s1);
  assert.equal(s2.tools.resumeBuilder.aiResponse, null);
  assert.equal(s2.tools.resumeBuilder.tokenWarning, false);
  assert.equal(s2.tools.resumeBuilder.lastSaved, s1.tools.resumeBuilder.lastSaved);
});

test("a resumeBuilder save predating the contact field merges cleanly", () => {
  const old = { tools: { resumeBuilder: { targetRole: "Analyst", bullets: [] } } };
  const s = setResumeBuilderField(old, "targetCompany", "JPM");
  assert.equal(s.tools.resumeBuilder.targetRole, "Analyst");
  assert.deepEqual(s.tools.resumeBuilder.contact, defaultResumeBuilderState.contact);
});

/* ── the STAR -> resume seam ── */

test("addBulletFromStory turns a STAR story into a resume bullet without retyping", () => {
  const s = addBulletFromStory(emptyState(), createStory(GOOD_STORY));
  const b = s.tools.resumeBuilder.bullets[0];
  assert.ok(b.raw.length > 0);
  assert.ok(b.quantifiedResult, "the story's number carries into the bullet");
});

test("addBulletFromStory is a no-op for a story with no action", () => {
  const s = emptyState();
  assert.equal(addBulletFromStory(s, createStory({ name: "X" })), s);
});

/* ── assembly ── */

function fullResumeState() {
  let s = setResumeContactField(emptyState(), "name", "Jane Smith");
  s = setResumeContactField(s, "email", "jane@example.com");
  s = setResumeContactField(s, "phone", "555-0100");
  s = setResumeBuilderField(s, "summary", "Aspiring financial analyst with Excel and Tableau experience.");
  s = addResumeSection(s, { kind: "education", title: "BA Economics", org: "City College", startDate: "2022", endDate: "2026" });
  s = addResumeSection(s, { kind: "experience", title: "Analyst Intern", org: "Credit Union", location: "Queens, NY", startDate: "Jun 2025", endDate: "Aug 2025" });
  const expId = s.tools.resumeBuilder.sections[1].id;
  s = addResumeBullet(s, "Analyzed 100 loan records and flagged a 0.60 four-fifths ratio", expId);
  s = setResumeSkills(s, ["Excel", "Tableau", "XLOOKUP"]);
  return s;
}

test("assembleResume produces parseable ATS-safe plain text", () => {
  const out = assembleResume(fullResumeState());
  assert.match(out, /^JANE SMITH/);
  assert.match(out, /\nEXPERIENCE\n/);
  assert.match(out, /\nEDUCATION\n/);
  assert.match(out, /\nSKILLS\n/);
  assert.match(out, /^- Analyzed 100 loan records/m);
});

test("assembleResume orders EDUCATION before EXPERIENCE", () => {
  const out = assembleResume(fullResumeState());
  assert.ok(out.indexOf("EDUCATION") < out.indexOf("EXPERIENCE"));
});

test("assembleResume emits no undefined and no ATS-hostile characters", () => {
  const out = assembleResume(fullResumeState());
  assert.ok(!out.includes("undefined"));
  assert.ok(!out.includes("\t"), "no tabs — they break column parsing");
  assert.ok(!/[•●▪]/.test(out), "no glyph bullets");
  assert.ok(!/[“”‘’—–]/.test(out), "no smart punctuation");
});

test("assembleResume normalizes smart quotes and em dashes to ASCII", () => {
  let s = addResumeBullet(emptyState(), "Built the “flagship” model — saved 4 hrs");
  const out = assembleResume(s);
  assert.match(out, /"flagship"/);
  assert.match(out, /- saved 4 hrs/);
});

test("assembleResume on a totally empty state is still a valid document", () => {
  const out = assembleResume(emptyState());
  assert.match(out, /\[YOUR NAME\]/);
  assert.ok(!out.includes("undefined"));
});

test("assembleResume accepts a bare slice as well as the full state", () => {
  const out = assembleResume({ contact: { name: "Bo" }, skills: ["Excel"] });
  assert.match(out, /^BO/);
  assert.match(out, /SKILLS/);
});

test("assembleResume gives sectionless bullets a home rather than dropping them", () => {
  const s = addResumeBullet(emptyState(), "Analyzed 100 records");
  const out = assembleResume(s);
  assert.match(out, /EXPERIENCE/);
  assert.match(out, /- Analyzed 100 records/);
});

test("assembleResume omits a section header when there is nothing under it", () => {
  const out = assembleResume(setResumeContactField(emptyState(), "name", "Jane"));
  assert.ok(!out.includes("SKILLS"));
  assert.ok(!out.includes("SUMMARY"));
});

/* ── audit ── */

test("auditResume tells the user the resume is the problem, specifically", () => {
  let s = addResumeBullet(emptyState(), "Responsible for financial analysis");
  s = addResumeBullet(s, "Responsible for reporting");
  const a = auditResume(s);
  assert.equal(a.weakCount, 2);
  assert.equal(a.unquantifiedCount, 2);
  assert.match(a.issues.join(" "), /open on a duty/i);
  assert.match(a.issues.join(" "), /no number/i);
});

test("auditResume nags about a missing job description", () => {
  const a = auditResume(addResumeBullet(emptyState(), "Analyzed 5 things, cutting 2 hrs"));
  assert.match(a.issues.join(" "), /No job description pasted/i);
});

test("auditResume congratulates a clean resume", () => {
  let s = setResumeBuilderField(emptyState(), "pastedJobDescription", "financial modeling");
  s = addResumeBullet(s, "Built financial modeling workbooks, cutting close time by 4 hrs per month");
  const a = auditResume(s);
  assert.equal(a.weakCount, 0);
  assert.equal(a.unquantifiedCount, 0);
  assert.match(a.issues.join(" "), /clears the formula/i);
});

test("auditResume on an empty resume asks for a first bullet", () => {
  assert.match(auditResume(emptyState()).issues.join(" "), /No bullets yet/i);
});

test("buildBulletPromptSlots never leaks a key and carries the issues", () => {
  let s = setResumeBuilderField(emptyState(), "targetRole", "Analyst");
  s = setResumeBuilderField(s, "pastedJobDescription", JD);
  const slots = buildBulletPromptSlots(s, "Responsible for reporting");
  assert.equal(slots.targetRole, "Analyst");
  assert.ok(slots.keywords.length > 0);
  assert.match(slots.issues, /duty/i);
  assert.ok(!("apiKey" in slots));
});

/* =========================================================================
   Application Tracker
   ========================================================================= */

test("enums match the spec exactly", () => {
  assert.deepEqual([...APPLICATION_STATUSES], ["applied", "screen", "interview", "offer", "rejected", "withdrawn"]);
  assert.deepEqual([...APPLICATION_SOURCES], ["referral", "cold", "recruiter", "other"]);
});

test("defaultApplicationTrackerState matches the spec shape", () => {
  assert.deepEqual(defaultApplicationTrackerState, { applications: [], lastSaved: null });
});

test("addDaysISO / daysBetweenISO are UTC-stable and reject garbage", () => {
  assert.equal(addDaysISO("2026-08-12", 7), "2026-08-19");
  assert.equal(addDaysISO("2026-12-28", 7), "2027-01-04");
  assert.equal(addDaysISO("2026-02-28", 1), "2026-03-01");
  assert.equal(addDaysISO("nonsense", 1), "");
  assert.equal(daysBetweenISO("2026-08-12", "2026-08-19"), 7);
  assert.equal(daysBetweenISO("2026-08-19", "2026-08-12"), -7);
  assert.equal(daysBetweenISO("x", "2026-08-12"), null);
});

test("createApplication defaults status, source, and the next action date", () => {
  const a = createApplication({ company: "JPM", dateApplied: "2026-08-12" });
  assert.equal(a.status, "applied");
  assert.equal(a.source, "other");
  assert.equal(a.nextActionDate, "2026-08-19");
  assert.ok(a.nextAction.length > 0, "an application always has a next step");
});

test("createApplication coerces an unknown status/source into the enum", () => {
  const a = createApplication({ status: "ghosted", source: "vibes" });
  assert.equal(a.status, "applied");
  assert.equal(a.source, "other");
});

test("addApplication appends immutably", () => {
  const s = emptyState();
  const next = addApplication(s, { company: "JPM", role: "Analyst" });
  assert.equal(next.tools.applicationTracker.applications.length, 1);
  assert.deepEqual(s.tools, {});
});

test("updateApplication patches by id and fixes the id", () => {
  const s1 = addApplication(emptyState(), { company: "A" });
  const id = s1.tools.applicationTracker.applications[0].id;
  const s2 = updateApplication(s1, id, { company: "B", id: "hacked" });
  assert.equal(s2.tools.applicationTracker.applications[0].company, "B");
  assert.equal(s2.tools.applicationTracker.applications[0].id, id);
});

test("removeApplication drops the row", () => {
  const s1 = addApplication(emptyState(), { company: "A" });
  const id = s1.tools.applicationTracker.applications[0].id;
  assert.equal(removeApplication(s1, id).tools.applicationTracker.applications.length, 0);
});

test("setApplicationStatus advances the stage, reschedules, and logs history", () => {
  const s1 = addApplication(emptyState(), { company: "JPM", dateApplied: "2026-08-12" });
  const id = s1.tools.applicationTracker.applications[0].id;
  const s2 = setApplicationStatus(s1, id, "screen", "2026-08-20");
  const a = s2.tools.applicationTracker.applications[0];
  assert.equal(a.status, "screen");
  assert.equal(a.nextActionDate, "2026-08-23");
  assert.deepEqual(a.history[a.history.length - 1], { status: "screen", date: "2026-08-20" });
});

test("setApplicationStatus to rejected clears the next action date", () => {
  const s1 = addApplication(emptyState(), { company: "JPM", dateApplied: "2026-08-12" });
  const id = s1.tools.applicationTracker.applications[0].id;
  const a = setApplicationStatus(s1, id, "rejected", "2026-08-25").tools.applicationTracker.applications[0];
  assert.equal(a.nextActionDate, "");
  assert.equal(a.nextAction, "");
});

test("setApplicationStatus with an unknown status is a no-op", () => {
  const s1 = addApplication(emptyState(), { company: "A" });
  const id = s1.tools.applicationTracker.applications[0].id;
  assert.equal(setApplicationStatus(s1, id, "ghosted"), s1);
});

test("sortByNextAction sorts ascending and sinks undated rows", () => {
  const rows = [
    createApplication({ company: "C", nextActionDate: "" }),
    createApplication({ company: "B", nextActionDate: "2026-09-01" }),
    createApplication({ company: "A", nextActionDate: "2026-08-15" }),
  ];
  assert.deepEqual(sortByNextAction(rows).map((r) => r.company), ["A", "B", "C"]);
});

test("sortByNextAction does not mutate its input", () => {
  const rows = [createApplication({ company: "B", nextActionDate: "2026-09-01" }), createApplication({ company: "A", nextActionDate: "2026-08-01" })];
  sortByNextAction(rows);
  assert.equal(rows[0].company, "B");
});

test("dueApplications returns only live rows at or past their date", () => {
  const rows = [
    createApplication({ company: "Due", nextActionDate: "2026-08-10", status: "applied" }),
    createApplication({ company: "Future", nextActionDate: "2026-09-10", status: "applied" }),
    createApplication({ company: "Dead", nextActionDate: "2026-08-01", status: "rejected" }),
  ];
  const due = dueApplications(rows, "2026-08-15");
  assert.deepEqual(due.map((d) => d.company), ["Due"]);
  assert.equal(due[0].overdueDays, 5);
});

test("funnelStats counts stages reached, not just current status", () => {
  const rows = [
    createApplication({ status: "rejected", history: [{ status: "applied" }, { status: "screen" }, { status: "interview" }, { status: "rejected" }] }),
    createApplication({ status: "applied", history: [{ status: "applied" }] }),
  ];
  const f = funnelStats(rows);
  assert.equal(f.total, 2);
  assert.equal(f.reached.interview, 1, "a rejection after an interview must not erase the interview");
  assert.equal(f.reached.screen, 1);
  assert.equal(f.byStatus.rejected, 1);
  assert.equal(f.active, 1);
  assert.equal(f.closed, 1);
});

test("funnelStats rates are 0, not NaN, on an empty pipeline", () => {
  const f = funnelStats([]);
  assert.equal(f.rates.screenRate, 0);
  assert.equal(f.total, 0);
});

test("diagnosePipeline names the resume as the bottleneck on volume with no screens", () => {
  const rows = Array.from({ length: 12 }, (_, i) => createApplication({ company: `C${i}`, status: "applied" }));
  const d = diagnosePipeline(rows, "2026-08-12");
  assert.equal(d[0].code, "resumeBottleneck");
  assert.equal(d[0].severity, "critical");
  assert.match(d[0].message, /12 applications, 0 first-round screens/);
  assert.match(d[0].message, /resume is the bottleneck/);
});

test("diagnosePipeline blames the screen when the resume is clearly working", () => {
  const rows = Array.from({ length: 5 }, () =>
    createApplication({ status: "rejected", history: [{ status: "applied" }, { status: "screen" }, { status: "rejected" }] })
  );
  const d = diagnosePipeline(rows, "2026-08-12");
  assert.equal(d[0].code, "screenBottleneck");
  assert.match(d[0].message, /resume is working/);
});

test("diagnosePipeline blames the interview when offers never come", () => {
  const rows = Array.from({ length: 4 }, () =>
    createApplication({ status: "rejected", history: [{ status: "applied" }, { status: "screen" }, { status: "interview" }, { status: "rejected" }] })
  );
  const d = diagnosePipeline(rows, "2026-08-12");
  assert.equal(d[0].code, "interviewBottleneck");
  assert.match(d[0].message, /losing it there/);
});

test("diagnosePipeline refuses to read signal into low volume", () => {
  const rows = [createApplication({ status: "applied" })];
  const codes = diagnosePipeline(rows, "2026-08-12").map((x) => x.code);
  assert.ok(codes.includes("lowVolume"));
  assert.ok(!codes.includes("resumeBottleneck"), "1 application proves nothing about the resume");
});

test("diagnosePipeline on an empty tracker says so", () => {
  assert.equal(diagnosePipeline([], "2026-08-12")[0].code, "empty");
});

test("diagnosePipeline flags overdue rows and the all-cold pipeline", () => {
  const rows = Array.from({ length: 10 }, (_, i) =>
    createApplication({
      company: `C${i}`,
      source: "cold",
      status: "screen",
      nextActionDate: "2026-08-01",
      history: [{ status: "applied" }, { status: "screen" }],
    })
  );
  const codes = diagnosePipeline(rows, "2026-08-12").map((x) => x.code);
  assert.ok(codes.includes("overdue"));
  assert.ok(codes.includes("noReferrals"));
});

test("diagnosePipeline sorts critical findings first", () => {
  const rows = Array.from({ length: 12 }, () => createApplication({ status: "applied", nextActionDate: "2026-08-01" }));
  const d = diagnosePipeline(rows, "2026-08-12");
  assert.equal(d[0].severity, "critical");
});

test("exportApplicationsCsv emits the lesson's 7 columns and escapes commas", () => {
  const rows = [createApplication({ company: "Smith, Jones & Co", role: "Analyst", dateApplied: "2026-08-12" })];
  const csv = exportApplicationsCsv(rows);
  const [header, row] = csv.split("\n");
  assert.equal(header.split(",").length, 7);
  assert.match(row, /"Smith, Jones & Co"/);
});

/* =========================================================================
   Network Tracker
   ========================================================================= */

test("REPLY_STATUSES matches the spec enum", () => {
  assert.deepEqual([...REPLY_STATUSES], ["notSent", "sent", "replied", "scheduled", "completed", "noReply"]);
});

test("defaultNetworkTrackerState matches the spec shape", () => {
  assert.deepEqual(defaultNetworkTrackerState, { contacts: [], lastSaved: null });
});

test("computeNextFollowUpDate applies the 6-8 week rule at ~49 days on completed", () => {
  assert.equal(FOLLOW_UP_DAYS, 49);
  assert.equal(computeNextFollowUpDate("completed", "2026-08-12"), "2026-09-30");
});

test("computeNextFollowUpDate gives a sent-but-silent outreach one nudge", () => {
  assert.equal(computeNextFollowUpDate("sent", "2026-08-12"), "2026-08-19");
});

test("computeNextFollowUpDate closes out noReply and rejects garbage dates", () => {
  assert.equal(computeNextFollowUpDate("noReply", "2026-08-12"), "");
  assert.equal(computeNextFollowUpDate("completed", ""), "");
  assert.equal(computeNextFollowUpDate("completed", "nonsense"), "");
});

test("createContact computes the follow-up date from the cadence", () => {
  const c = createContact({ name: "A", replyStatus: "completed", lastContactDate: "2026-08-12" });
  assert.equal(c.nextFollowUpDate, "2026-09-30");
});

test("createContact coerces an unknown reply status", () => {
  assert.equal(createContact({ replyStatus: "maybe" }).replyStatus, "notSent");
});

test("addContact / updateContact / removeContact behave immutably", () => {
  const s0 = emptyState();
  const s1 = addContact(s0, { name: "Dana", firm: "JPM" });
  assert.deepEqual(s0.tools, {});
  const id = s1.tools.networkTracker.contacts[0].id;
  const s2 = updateContact(s1, id, { firm: "GS", id: "hacked" });
  assert.equal(s2.tools.networkTracker.contacts[0].firm, "GS");
  assert.equal(s2.tools.networkTracker.contacts[0].id, id);
  assert.equal(removeContact(s2, id).tools.networkTracker.contacts.length, 0);
});

test("setContactStatus to completed auto-schedules the 7-week touch", () => {
  const s1 = addContact(emptyState(), { name: "Dana", outreachDate: "2026-08-01" });
  const id = s1.tools.networkTracker.contacts[0].id;
  const c = setContactStatus(s1, id, "completed", "2026-08-12").tools.networkTracker.contacts[0];
  assert.equal(c.lastContactDate, "2026-08-12");
  assert.equal(c.nextFollowUpDate, "2026-09-30");
});

test("setContactStatus with an unknown status is a no-op", () => {
  const s1 = addContact(emptyState(), { name: "Dana" });
  const id = s1.tools.networkTracker.contacts[0].id;
  assert.equal(setContactStatus(s1, id, "vibes"), s1);
});

test("markContactFollowedUp logs the touch and reschedules", () => {
  const s1 = addContact(emptyState(), { name: "Dana", replyStatus: "completed", lastContactDate: "2026-06-01" });
  const id = s1.tools.networkTracker.contacts[0].id;
  const c = markContactFollowedUp(s1, id, "2026-08-12").tools.networkTracker.contacts[0];
  assert.equal(c.lastContactDate, "2026-08-12");
  assert.equal(c.nextFollowUpDate, "2026-09-30");
});

test("markContactFollowedUp promotes notSent to sent", () => {
  const s1 = addContact(emptyState(), { name: "Dana", replyStatus: "notSent" });
  const id = s1.tools.networkTracker.contacts[0].id;
  const c = markContactFollowedUp(s1, id, "2026-08-12").tools.networkTracker.contacts[0];
  assert.equal(c.replyStatus, "sent");
  assert.equal(c.nextFollowUpDate, "2026-08-19");
});

test("dueContacts surfaces overdue follow-ups with a day count", () => {
  const contacts = [
    createContact({ name: "Due", replyStatus: "completed", lastContactDate: "2026-06-01" }),
    createContact({ name: "Later", replyStatus: "completed", lastContactDate: "2026-08-10" }),
  ];
  const due = dueContacts(contacts, "2026-08-12");
  assert.deepEqual(due.map((c) => c.name), ["Due"]);
  assert.ok(due[0].overdueDays > 0);
});

test("thankYousOwed enforces the 24-hour rule", () => {
  const contacts = [
    createContact({ name: "Owed", replyStatus: "completed", lastContactDate: "2026-08-01", thankYouSent: false }),
    createContact({ name: "Sent", replyStatus: "completed", lastContactDate: "2026-08-01", thankYouSent: true }),
    createContact({ name: "Today", replyStatus: "completed", lastContactDate: "2026-08-12", thankYouSent: false }),
  ];
  const owed = thankYousOwed(contacts, "2026-08-12");
  assert.deepEqual(owed.map((c) => c.name), ["Owed", "Today"]);
  assert.equal(owed[0].overdue, true);
  assert.equal(owed[1].overdue, false, "same-day is still inside the 24-hour window");
});

test("markThankYouSent clears the debt", () => {
  const s1 = addContact(emptyState(), { name: "A", replyStatus: "completed", lastContactDate: "2026-08-01" });
  const id = s1.tools.networkTracker.contacts[0].id;
  const s2 = markThankYouSent(s1, id);
  assert.equal(thankYousOwed(s2.tools.networkTracker.contacts, "2026-08-12").length, 0);
});

test("networkStats computes the reply rate without dividing by zero", () => {
  assert.equal(networkStats([]).replyRate, 0);
  const contacts = [
    createContact({ firm: "JPM", replyStatus: "sent" }),
    createContact({ firm: "JPM", replyStatus: "completed" }),
    createContact({ firm: "GS", replyStatus: "notSent" }),
  ];
  const st = networkStats(contacts);
  assert.equal(st.sent, 2);
  assert.equal(st.replied, 1);
  assert.equal(st.replyRate, 0.5);
  assert.equal(st.firms, 2);
});

test("diagnoseNetwork blames the message when nobody replies", () => {
  const contacts = Array.from({ length: 8 }, (_, i) => createContact({ name: `C${i}`, replyStatus: "sent", outreachDate: "2026-08-01" }));
  const d = diagnoseNetwork(contacts, "2026-08-12");
  const codes = d.map((x) => x.code);
  assert.ok(codes.includes("noReplies"));
  assert.match(d.find((x) => x.code === "noReplies").message, /message is the problem/);
});

test("diagnoseNetwork flags an overdue thank-you as critical", () => {
  const contacts = [createContact({ name: "A", replyStatus: "completed", lastContactDate: "2026-08-01" })];
  const d = diagnoseNetwork(contacts, "2026-08-12");
  assert.equal(d[0].code, "thankYouOverdue");
  assert.equal(d[0].severity, "critical");
});

test("diagnoseNetwork calls out a list of names that is not a network", () => {
  const contacts = Array.from({ length: 4 }, () => createContact({ replyStatus: "notSent" }));
  const codes = diagnoseNetwork(contacts, "2026-08-12").map((x) => x.code);
  assert.ok(codes.includes("drafted"));
});

test("diagnoseNetwork on an empty tracker says so", () => {
  assert.equal(diagnoseNetwork([], "2026-08-12")[0].code, "empty");
});

/* ── templates: useful with zero AI ── */

test("outreachTemplate is the 4-sentence ask, with no dangling placeholders", () => {
  const out = outreachTemplate({ name: "Dana Lee", firm: "JP Morgan", role: "Wealth Advisor" }, { yourName: "Jane" });
  assert.match(out, /Hi Dana,/);
  assert.match(out, /JP Morgan/);
  assert.match(out, /15 minutes/);
  assert.ok(!out.includes("undefined"));
  assert.ok(!out.includes("{{"));
});

test("outreachTemplate degrades gracefully with an empty contact", () => {
  const out = outreachTemplate({}, {});
  assert.ok(!out.includes("undefined"));
  assert.match(out, /\[Your Name\]/);
});

test("thankYouTemplate demands a real detail rather than inventing one", () => {
  const out = thankYouTemplate({ name: "Dana" }, "");
  assert.match(out, /\[one specific thing they actually said/);
  assert.ok(!out.includes("undefined"));
});

test("thankYouTemplate uses the supplied detail", () => {
  const out = thankYouTemplate({ name: "Dana" }, "your point about starting in ops", { yourName: "Jane" });
  assert.match(out, /your point about starting in ops/);
});

test("updateTemplate sequences update before ask", () => {
  const out = updateTemplate({ name: "Dana" }, { didWithAdvice: "I passed the SIE", ask: "a referral" });
  assert.ok(out.indexOf("I passed the SIE") < out.indexOf("a referral"), "update must precede the ask");
});

test("updateTemplate omits the ask sentence entirely when there is no ask", () => {
  const out = updateTemplate({ name: "Dana" }, { didWithAdvice: "I passed the SIE" });
  assert.ok(!out.includes("if you have the bandwidth"));
  assert.ok(!out.includes("undefined"));
});

/* =========================================================================
   Salary Negotiation Prep
   ========================================================================= */

test("defaultSalaryNegotiationState carries the spec fields", () => {
  for (const k of ["role", "company", "offerBase", "marketRangeLow", "marketRangeHigh", "marketSource", "targetAsk"]) {
    assert.ok(k in defaultSalaryNegotiationState.fields, `missing ${k}`);
  }
  assert.equal(defaultSalaryNegotiationState.generatedScript, null);
});

test("parseMoney handles the formats a user actually types", () => {
  assert.equal(parseMoney("$72,000"), 72000);
  assert.equal(parseMoney("72k"), 72000);
  assert.equal(parseMoney("72000"), 72000);
  assert.equal(parseMoney(72000), 72000);
  assert.equal(parseMoney("1.5m"), 1500000);
});

test("parseMoney returns 0 rather than NaN for garbage", () => {
  assert.equal(parseMoney("banana"), 0);
  assert.equal(parseMoney(""), 0);
  assert.equal(parseMoney(null), 0);
  assert.equal(parseMoney(undefined), 0);
  assert.equal(parseMoney(NaN), 0);
});

test("formatMoney renders dollars, never NaN", () => {
  assert.equal(formatMoney(72000), "$72,000");
  assert.equal(formatMoney(NaN), "$0");
  assert.equal(formatMoney(-500), "-$500");
});

test("totalComp separates recurring comp from the one-off signing bonus", () => {
  const c = totalComp({ base: 70000, bonus: 7000, signing: 5000, retirementMatchPct: 5 });
  assert.equal(c.retirementMatch, 3500);
  assert.equal(c.recurring, 80500);
  assert.equal(c.yearOne, 85500);
});

test("totalComp on an empty offer is all zeros", () => {
  const c = totalComp({});
  assert.equal(c.recurring, 0);
  assert.equal(c.yearOne, 0);
});

test("compareOffers ranks by recurring comp, not by base", () => {
  const offers = [
    { id: "a", label: "Big base", base: 80000, signing: 0 },
    { id: "b", label: "Better total", base: 75000, bonus: 12000, retirementMatchPct: 6 },
  ];
  const ranked = compareOffers(offers);
  assert.equal(ranked[0].offer.label, "Better total");
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[0].deltaRecurring, 0);
  assert.ok(ranked[1].deltaRecurring < 0);
});

test("compareOffers on an empty list is empty, not a crash", () => {
  assert.deepEqual(compareOffers([]), []);
  assert.deepEqual(compareOffers(undefined), []);
});

test("addOffer / updateOffer / removeOffer parse money and stay immutable", () => {
  const s0 = emptyState();
  const s1 = addOffer(s0, { label: "JPM", base: "$72,000" });
  assert.deepEqual(s0.tools, {});
  assert.equal(s1.tools.salaryNegotiationPrep.offers[0].base, 72000);
  const id = s1.tools.salaryNegotiationPrep.offers[0].id;
  const s2 = updateOffer(s1, id, { base: "75k" });
  assert.equal(s2.tools.salaryNegotiationPrep.offers[0].base, 75000);
  assert.equal(s2.tools.salaryNegotiationPrep.offers[0].id, id);
  assert.equal(removeOffer(s2, id).tools.salaryNegotiationPrep.offers.length, 0);
});

test("marketPosition places the offer inside the range", () => {
  const p = marketPosition({ offerBase: "70000", marketRangeLow: "65000", marketRangeHigh: "85000" });
  assert.equal(p.valid, true);
  assert.equal(p.percentile, 0.25);
  assert.equal(p.gapToHigh, 15000);
  assert.match(p.verdict, /Bottom of the range/);
});

test("marketPosition is invalid — not fabricated — with no range", () => {
  const p = marketPosition({ offerBase: "70000" });
  assert.equal(p.valid, false);
  assert.equal(p.verdict, "");
});

test("marketPosition rejects an inverted range", () => {
  assert.equal(marketPosition({ offerBase: "70000", marketRangeLow: "90000", marketRangeHigh: "60000" }).valid, false);
});

test("marketPosition clamps an offer below or above the range", () => {
  assert.equal(marketPosition({ offerBase: "50000", marketRangeLow: "65000", marketRangeHigh: "85000" }).percentile, 0);
  assert.equal(marketPosition({ offerBase: "99000", marketRangeLow: "65000", marketRangeHigh: "85000" }).percentile, 1);
});

test("marketPosition survives a zero-width range", () => {
  const p = marketPosition({ offerBase: "70000", marketRangeLow: "70000", marketRangeHigh: "70000" });
  assert.equal(p.valid, true);
  assert.ok(Number.isFinite(p.percentile));
});

test("suggestTargetAsk refuses to suggest without a real market anchor", () => {
  assert.equal(suggestTargetAsk({ offerBase: "70000" }), 0);
  assert.equal(suggestTargetAsk({}), 0);
});

test("suggestTargetAsk lands inside the range, above the offer", () => {
  const ask = suggestTargetAsk({ offerBase: "70000", marketRangeLow: "65000", marketRangeHigh: "85000" });
  assert.ok(ask > 70000 && ask <= 85000);
});

test("generateNegotiationScript fills the template with no placeholders left", () => {
  const script = generateNegotiationScript({
    role: "Wealth Management Analyst",
    company: "JP Morgan",
    offerBase: "70000",
    marketRangeLow: "65000",
    marketRangeHigh: "85000",
    marketSource: "levels.fyi",
    targetAsk: "78000",
  });
  assert.ok(!script.includes("undefined"));
  assert.ok(!script.includes("{{"));
  assert.match(script, /JP Morgan/);
  assert.match(script, /levels\.fyi/);
  assert.match(script, /\$78,000/);
  assert.match(script, /\$65,000 to \$85,000/);
});

test("generateNegotiationScript never invents a market anchor it does not have", () => {
  const script = generateNegotiationScript({ role: "Analyst", company: "JPM", offerBase: "70000" });
  assert.match(script, /incomplete — no market anchor yet/);
  assert.match(script, /levels\.fyi, Glassdoor/);
  assert.ok(!script.includes("undefined"));
});

test("generateNegotiationScript on totally empty fields is still clean prose", () => {
  const script = generateNegotiationScript({});
  assert.ok(!script.includes("undefined"));
  assert.ok(!script.includes("NaN"));
  assert.match(script, /the role/);
});

test("clearSalaryNegotiationScript nulls the script and keeps lastSaved", () => {
  let s = setSalaryNegotiationField(emptyState(), "role", "Analyst");
  s = { ...s, tools: { ...s.tools, salaryNegotiationPrep: { ...s.tools.salaryNegotiationPrep, generatedScript: "text" } } };
  const saved = s.tools.salaryNegotiationPrep.lastSaved;
  const cleared = clearSalaryNegotiationScript(s);
  assert.equal(cleared.tools.salaryNegotiationPrep.generatedScript, null);
  assert.equal(cleared.tools.salaryNegotiationPrep.lastSaved, saved);
});

test("batnaPrep is honest about a weak position rather than flattering", () => {
  const b = batnaPrep(setSalaryNegotiationField(emptyState(), "offerBase", "70000"));
  assert.equal(b.strength, "weak");
  assert.equal(b.hasCompeting, false);
  assert.match(b.summary, /Ask anyway/);
  assert.match(b.risks.join(" "), /No competing offer/);
});

test("batnaPrep recognizes a strong position from a real competing offer", () => {
  let s = setSalaryNegotiationField(emptyState(), "offerBase", "70000");
  s = setBatnaField(s, "competingOffer", "78000");
  const b = batnaPrep(s);
  assert.equal(b.strength, "strong");
  assert.match(b.leverage.join(" "), /\$8,000 above this one/);
});

test("batnaPrep counts documented room as moderate leverage", () => {
  let s = setSalaryNegotiationField(emptyState(), "offerBase", "70000");
  s = setSalaryNegotiationField(s, "marketRangeLow", "65000");
  s = setSalaryNegotiationField(s, "marketRangeHigh", "85000");
  const b = batnaPrep(s);
  assert.equal(b.strength, "moderate");
  assert.match(b.leverage.join(" "), /\$15,000 of documented room/);
});

test("batnaPrep warns when the offer is under the stated walk-away number", () => {
  let s = setSalaryNegotiationField(emptyState(), "offerBase", "60000");
  s = setBatnaField(s, "walkAwayBase", "70000");
  assert.match(batnaPrep(s).risks.join(" "), /below your stated walk-away/);
});

test("negotiationReadiness lists what is still missing", () => {
  const r = negotiationReadiness(emptyState());
  assert.equal(r.ready, false);
  assert.ok(r.checklist.every((c) => !c.done));
});

test("negotiationReadiness goes ready once every input is real", () => {
  let s = setSalaryNegotiationField(emptyState(), "offerBase", "70000");
  s = setSalaryNegotiationField(s, "marketRangeLow", "65000");
  s = setSalaryNegotiationField(s, "marketRangeHigh", "85000");
  s = setSalaryNegotiationField(s, "marketSource", "levels.fyi");
  s = setSalaryNegotiationField(s, "targetAsk", "78000");
  s = setBatnaField(s, "currentSituation", "Employed, can wait");
  assert.equal(negotiationReadiness(s).ready, true);
});

/* =========================================================================
   Mock Interview — offline-first, AI-optional
   ========================================================================= */

test("defaultMockInterviewState matches the spec shape", () => {
  assert.deepEqual(defaultMockInterviewState, { sessions: [], activeQuestion: null, lastSaved: null });
});

test("the offline question bank is substantial and well-formed", () => {
  const bank = getQuestionBank();
  assert.ok(bank.length >= 15, "a no-key user needs a real bank");
  for (const q of bank) {
    assert.ok(q.id && q.question, "every question has an id and text");
    assert.ok(["behavioral", "technical", "case"].includes(q.type));
  }
});

test("the fixed bank targets wealth management / CFA-track work", () => {
  const text = FIXED_QUESTIONS.map((q) => q.question + q.modelNote).join(" ");
  assert.match(text, /wealth management/i);
  assert.match(text, /pivot table/i);
  assert.match(text, /duration/i);
});

test("the fixed bank covers every behavioral category the STAR bank tags", () => {
  const tags = new Set(FIXED_QUESTIONS.flatMap((q) => q.tags));
  for (const t of ["conflict", "failure", "leadership", "pressure", "analyticalWin"]) {
    assert.ok(tags.has(t), `no fixed question for ${t}`);
  }
});

test("getQuestionBank includes the Hustle curriculum questions", () => {
  assert.ok(getQuestionBank().some((q) => q.source === "curriculum"));
});

test("getQuestionBank filters by type", () => {
  const tech = getQuestionBank({ type: "technical" });
  assert.ok(tech.length > 0);
  assert.ok(tech.every((q) => q.type === "technical"));
});

test("pickQuestion avoids questions already asked", () => {
  const bank = [{ id: "a" }, { id: "b" }];
  const picked = pickQuestion(bank, { askedIds: ["a"], random: () => 0 });
  assert.equal(picked.id, "b");
});

test("pickQuestion recycles once the bank is exhausted rather than returning null", () => {
  const bank = [{ id: "a" }];
  assert.equal(pickQuestion(bank, { askedIds: ["a"], random: () => 0 }).id, "a");
});

test("pickQuestion on an empty bank returns null", () => {
  assert.equal(pickQuestion([], {}), null);
});

test("pickQuestion never indexes past the end when random returns ~1", () => {
  const bank = [{ id: "a" }, { id: "b" }];
  assert.ok(pickQuestion(bank, { random: () => 0.999999 }));
});

/* ── the rubric ── */

test("RUBRIC weights sum to 100", () => {
  assert.equal(RUBRIC.reduce((a, r) => a + r.weight, 0), 100);
});

const STRONG_ANSWER =
  "When I was in the COOP Financial Services Track, I was handed a 100-record HMDA loan dataset with no documentation. " +
  "My task was to determine whether approval rates differed across demographic groups and present it to the cohort. " +
  "So I built a pivot table breaking approvals out by race, then I computed a four-fifths ratio for each group, and I validated " +
  "the totals against the raw counts to make sure I had not double-counted. " +
  "As a result, I found Black applicants were approved at 56.25% against 86% for White applicants — a 0.65 ratio that fails " +
  "the four-fifths rule. That finding became the reference example the cohort used.";

test("gradeAnswerOffline scores a complete quantified first-person answer highly", () => {
  const g = gradeAnswerOffline(FIXED_QUESTIONS[5], STRONG_ANSWER);
  assert.ok(g.score >= 90, `expected >=90, got ${g.score}`);
  assert.equal(g.source, "offline");
  assert.match(g.improvement, /strong answer/i);
});

test("gradeAnswerOffline catches the missing Result and says exactly that", () => {
  const noResult =
    "When I was at my internship I was given a messy dataset. My task was to clean it up. " +
    "So I built a pivot table and I reconciled the totals by hand over about 3 days of work, checking every column carefully.";
  const g = gradeAnswerOffline({ question: "Tell me about an analysis", type: "behavioral" }, noResult);
  assert.equal(g.breakdown.find((b) => b.key === "result").pass, false);
  assert.match(g.improvement, /Add the Result/);
});

test("gradeAnswerOffline gives exactly ONE improvement, always", () => {
  for (const answer of ["", "Too short.", STRONG_ANSWER, "We did a thing and it went well for the team overall in the end."]) {
    const g = gradeAnswerOffline({ question: "Q", type: "behavioral" }, answer);
    assert.equal(typeof g.improvement, "string");
    assert.ok(g.improvement.length > 0);
  }
});

test("gradeAnswerOffline flags the diffuse 'we'", () => {
  const weAnswer =
    "When we were working on the project last year, we needed to finish it fast. So we split up the work and we " +
    "reviewed each other's parts, and our team ended up delivering 2 days early which our manager appreciated a lot.";
  const g = gradeAnswerOffline({ question: "Q", type: "behavioral" }, weAnswer);
  assert.equal(g.breakdown.find((b) => b.key === "ownership").pass, false);
  assert.match(g.breakdown.find((b) => b.key === "ownership").note, /cannot hire your team/);
});

test("gradeAnswerOffline flags an answer with no numbers", () => {
  const vague =
    "When I was at my internship I was handed a messy dataset. My task was to clean it. So I built a pivot table " +
    "and reconciled it. As a result, things improved significantly and everyone was much happier with the reporting.";
  const g = gradeAnswerOffline({ question: "Q", type: "behavioral" }, vague);
  assert.equal(g.breakdown.find((b) => b.key === "specificity").pass, false);
  assert.match(g.improvement, /number/i);
});

test("gradeAnswerOffline caps a too-short answer and says so", () => {
  const g = gradeAnswerOffline({ question: "Q", type: "behavioral" }, "I did a thing and it went fine.");
  assert.ok(g.score <= 35);
  assert.match(g.improvement, /too thin|90 seconds/i);
});

test("gradeAnswerOffline on an empty answer scores 0 and does not crash", () => {
  const g = gradeAnswerOffline({ question: "Q", type: "behavioral" }, "");
  assert.equal(g.wordCount, 0);
  assert.ok(g.score <= 35);
  assert.match(g.improvement, /Write an actual answer/);
});

test("gradeAnswerOffline penalizes a rambling answer", () => {
  const rambling = STRONG_ANSWER + " and also " + "I kept going on about it ".repeat(40);
  const g = gradeAnswerOffline(FIXED_QUESTIONS[5], rambling);
  assert.match(g.improvement, /monologue/);
  assert.ok(g.score < 100);
});

test("gradeAnswerOffline does not demand STAR structure of a technical question", () => {
  const technical =
    "XLOOKUP can look to the left, it does not break when someone inserts a column because there is no hardcoded " +
    "index number, it defaults to an exact match instead of an approximate one, and it has a built-in if-not-found " +
    "argument so I do not need to wrap it in IFERROR. It matters the moment 2 people are editing the same workbook.";
  const g = gradeAnswerOffline(FIXED_QUESTIONS.find((q) => q.id === "mi-tech-xlookup"), technical);
  assert.ok(g.score >= 70, `technical answers should not be punished for having no "Situation": got ${g.score}`);
});

test("gradeAnswerOffline accepts a raw question string", () => {
  assert.ok(gradeAnswerOffline("Tell me about yourself", STRONG_ANSWER).score > 0);
});

test("gradeAnswerOffline never returns a negative score", () => {
  const g = gradeAnswerOffline({ question: "Q", type: "behavioral" }, "we ".repeat(400));
  assert.ok(g.score >= 0);
});

test("detectStarParts finds cued parts", () => {
  const parts = detectStarParts(STRONG_ANSWER);
  assert.equal(parts.situation, true);
  assert.equal(parts.task, true);
  assert.equal(parts.action, true);
  assert.equal(parts.result, true);
});

test("detectStarParts on empty text finds nothing", () => {
  assert.deepEqual(detectStarParts(""), { situation: false, task: false, action: false, result: false });
});

/* ── session reducers ── */

test("startMockInterviewSession opens a session and sets the active question", () => {
  const s = startMockInterviewSession(emptyState(), FIXED_QUESTIONS[0], "fixed");
  const session = s.tools.mockInterview.sessions[0];
  assert.equal(session.question, FIXED_QUESTIONS[0].question);
  assert.equal(session.questionSource, "fixed");
  assert.equal(session.aiFeedback, null);
  assert.equal(s.tools.mockInterview.activeQuestion.id, FIXED_QUESTIONS[0].id);
});

test("startMockInterviewSession accepts a custom typed-in question", () => {
  const s = startMockInterviewSession(emptyState(), "My own question?", "custom");
  assert.equal(s.tools.mockInterview.sessions[0].questionSource, "custom");
  assert.equal(s.tools.mockInterview.sessions[0].questionType, "behavioral");
});

test("recordMockInterviewAnswer grades offline immediately — no key, no network", () => {
  const s1 = startMockInterviewSession(emptyState(), FIXED_QUESTIONS[5], "fixed");
  const id = s1.tools.mockInterview.sessions[0].id;
  const s2 = recordMockInterviewAnswer(s1, id, STRONG_ANSWER);
  const session = s2.tools.mockInterview.sessions[0];
  assert.equal(session.userAnswer, STRONG_ANSWER);
  assert.ok(session.offlineFeedback, "the offline rubric is always there");
  assert.ok(session.score > 0);
  assert.equal(session.aiFeedback, null, "AI is additive, not required");
});

test("setMockInterviewFeedback attaches AI text without touching the offline grade", () => {
  const s1 = startMockInterviewSession(emptyState(), FIXED_QUESTIONS[0], "fixed");
  const id = s1.tools.mockInterview.sessions[0].id;
  const s2 = recordMockInterviewAnswer(s1, id, STRONG_ANSWER);
  const s3 = setMockInterviewFeedback(s2, id, "AI says: good.");
  assert.equal(s3.tools.mockInterview.sessions[0].aiFeedback, "AI says: good.");
  assert.ok(s3.tools.mockInterview.sessions[0].offlineFeedback);
});

test("clearMockInterviewSession removes only that session", () => {
  let s = startMockInterviewSession(emptyState(), FIXED_QUESTIONS[0], "fixed");
  s = startMockInterviewSession(s, FIXED_QUESTIONS[1], "fixed");
  const id = s.tools.mockInterview.sessions[0].id;
  s = clearMockInterviewSession(s, id);
  assert.equal(s.tools.mockInterview.sessions.length, 1);
});

test("setActiveQuestion sets and clears", () => {
  const s = setActiveQuestion(emptyState(), null);
  assert.equal(s.tools.mockInterview.activeQuestion, null);
});

test("sessionStats averages only answered sessions and lists asked ids", () => {
  let s = startMockInterviewSession(emptyState(), FIXED_QUESTIONS[5], "fixed");
  const id = s.tools.mockInterview.sessions[0].id;
  s = recordMockInterviewAnswer(s, id, STRONG_ANSWER);
  s = startMockInterviewSession(s, FIXED_QUESTIONS[1], "fixed");
  const st = sessionStats(s);
  assert.equal(st.count, 2);
  assert.equal(st.answered, 1);
  assert.ok(st.averageScore > 0);
  assert.ok(st.askedIds.includes(FIXED_QUESTIONS[5].id));
});

test("sessionStats on an empty history is zeroed, not NaN", () => {
  const st = sessionStats(emptyState());
  assert.equal(st.averageScore, 0);
  assert.equal(st.best, 0);
});

/* ── the AI seam: injected fake, zero network ── */

test("gradeAnswer with NO llm returns the offline rubric — never a dead end", async () => {
  const r = await gradeAnswer({ question: FIXED_QUESTIONS[5], answer: STRONG_ANSWER });
  assert.equal(r.ok, true);
  assert.equal(r.source, "offline");
  assert.equal(r.aiText, null);
  assert.ok(r.feedback.score > 0);
});

test("gradeAnswer with a working llm enriches the offline rubric", async () => {
  const fake = async () => ({ ok: true, text: "Solid STAR. One improvement: slow down." });
  const r = await gradeAnswer({ question: FIXED_QUESTIONS[5], answer: STRONG_ANSWER }, fake);
  assert.equal(r.source, "ai");
  assert.equal(r.aiText, "Solid STAR. One improvement: slow down.");
  assert.ok(r.feedback.score > 0, "the deterministic rubric survives the AI path");
  assert.equal(r.notice, "");
});

test("gradeAnswer passes system+user and never an apiKey to the llm", async () => {
  let seen = null;
  const fake = async (req) => {
    seen = req;
    return { ok: true, text: "ok" };
  };
  await gradeAnswer({ question: FIXED_QUESTIONS[0], answer: STRONG_ANSWER, model: "m" }, fake);
  assert.ok(seen.system.includes("STAR"));
  assert.ok(seen.user.includes(STRONG_ANSWER));
  assert.equal(seen.model, "m");
  assert.ok(!("apiKey" in seen), "THE SECURITY INVARIANT: no key in the renderer-side request");
  assert.ok(!JSON.stringify(seen).toLowerCase().includes("apikey"));
});

test("gradeAnswer degrades to offline with an actionable notice when no endpoint is configured", async () => {
  const fake = async () => ({ ok: false, error: { type: "NO_ENDPOINT" } });
  const r = await gradeAnswer({ question: FIXED_QUESTIONS[0], answer: STRONG_ANSWER }, fake);
  assert.equal(r.source, "offline");
  assert.ok(r.feedback.score > 0, "the user still gets a full rubric");
  assert.match(r.notice, /Settings/, "the message must point somewhere actionable");
});

test("gradeAnswer degrades on AUTH_ERROR and names Settings", async () => {
  const fake = async () => ({ ok: false, error: { type: "AUTH_ERROR", status: 401 } });
  const r = await gradeAnswer({ question: FIXED_QUESTIONS[0], answer: STRONG_ANSWER }, fake);
  assert.equal(r.source, "offline");
  assert.match(r.notice, /Settings/);
});

test("gradeAnswer degrades on a network failure", async () => {
  const fake = async () => ({ ok: false, error: { type: "NETWORK_ERROR" } });
  const r = await gradeAnswer({ question: FIXED_QUESTIONS[0], answer: STRONG_ANSWER }, fake);
  assert.equal(r.source, "offline");
  assert.match(r.notice, /Couldn't reach/);
});

test("gradeAnswer survives an llm that throws", async () => {
  const fake = async () => {
    throw new Error("boom");
  };
  const r = await gradeAnswer({ question: FIXED_QUESTIONS[0], answer: STRONG_ANSWER }, fake);
  assert.equal(r.ok, true);
  assert.equal(r.source, "offline");
  assert.ok(r.notice.length > 0);
});

test("gradeAnswer treats an ok-but-empty AI response as a degradation", async () => {
  const fake = async () => ({ ok: true, text: "   " });
  const r = await gradeAnswer({ question: FIXED_QUESTIONS[0], answer: STRONG_ANSWER }, fake);
  assert.equal(r.source, "offline");
});

test("gradeAnswer survives a malformed llm result", async () => {
  for (const bad of [undefined, null, {}, { ok: true }]) {
    const r = await gradeAnswer({ question: FIXED_QUESTIONS[0], answer: STRONG_ANSWER }, async () => bad);
    assert.equal(r.ok, true);
    assert.equal(r.source, "offline");
  }
});

test("buildFeedbackSlots hands the model measured facts, not guesses", () => {
  const slots = buildFeedbackSlots(FIXED_QUESTIONS[5], STRONG_ANSWER);
  assert.ok(Number(slots.wordCount) > 0);
  assert.match(slots.numbers, /56\.25%/);
  assert.equal(slots.question, FIXED_QUESTIONS[5].question);
});

test("MOCK_INTERVIEW_PROMPT demands exactly one improvement and forbids invention", () => {
  assert.match(MOCK_INTERVIEW_PROMPT.system, /[Ee]xactly ONE concrete improvement/);
  assert.match(MOCK_INTERVIEW_PROMPT.system, /never invent details/i);
});

test("describeAiError always points at an action, for every error type", () => {
  for (const type of ["NO_ENDPOINT", "NO_KEY", "NO_BRIDGE", "AUTH_ERROR", "NETWORK_ERROR", "API_ERROR", "BAD_REQUEST", "WEIRD"]) {
    const msg = describeAiError({ type });
    assert.ok(msg.length > 0);
    assert.match(msg, /offline/i, `${type} must tell the user they still have the offline path`);
  }
});

/* ── the keystone paying off ── */

test("suggestStoriesFor pulls the right STAR story into the mock interview", () => {
  let s = addStory(emptyState(), GOOD_STORY);
  s = addStory(s, { ...WEAK_STORY, name: "Team thing", tags: ["leadership"] });
  const suggestions = suggestStoriesFor(s, "Walk me through an analysis you're proud of.");
  assert.ok(suggestions.length > 0);
  assert.equal(suggestions[0].story.name, "HMDA bias audit");
});

test("suggestStoriesFor on an empty bank returns nothing rather than throwing", () => {
  assert.deepEqual(suggestStoriesFor(emptyState(), "Tell me about a failure"), []);
});

test("prefillFromStory turns a story into a first-draft answer — written once, reused", () => {
  const draft = prefillFromStory(createStory(GOOD_STORY));
  assert.ok(draft.includes("HMDA"));
  assert.ok(draft.includes("56.25%"));
  const g = gradeAnswerOffline(FIXED_QUESTIONS[5], draft);
  assert.ok(g.score >= 70, `a well-written story should already grade well as an answer: got ${g.score}`);
});

test("prefillFromStory on an empty story returns ''", () => {
  assert.equal(prefillFromStory(createStory({})), "");
  assert.equal(prefillFromStory(undefined), "");
});

/* =========================================================================
   Cross-cutting: persistence + the security invariant
   ========================================================================= */

test("every tool slice round-trips through JSON — the store holds plain data", () => {
  let s = emptyState();
  s = addStory(s, GOOD_STORY);
  s = addResumeBullet(s, "Analyzed 100 records, flagging a 0.60 ratio");
  s = addApplication(s, { company: "JPM", role: "Analyst" });
  s = addContact(s, { name: "Dana", firm: "JPM" });
  s = addOffer(s, { label: "JPM", base: "72k" });
  s = startMockInterviewSession(s, FIXED_QUESTIONS[0], "fixed");

  const round = JSON.parse(JSON.stringify(s));
  assert.deepEqual(round, s, "no Dates, no Maps, no functions — everything is serializable");
});

test("every tool namespaces under state.tools.<id> and touches nothing else", () => {
  let s = { progress: { xp: 5 }, tools: {} };
  s = addStory(s, GOOD_STORY);
  s = addApplication(s, { company: "A" });
  s = addContact(s, { name: "B" });
  s = addOffer(s, { label: "C" });
  s = addResumeBullet(s, "Analyzed 5 things");
  s = startMockInterviewSession(s, FIXED_QUESTIONS[0], "fixed");

  assert.deepEqual(s.progress, { xp: 5 }, "no tool may reach outside its slice");
  assert.deepEqual(Object.keys(s.tools).sort(), [
    "applicationTracker",
    "mockInterview",
    "networkTracker",
    "resumeBuilder",
    "salaryNegotiationPrep",
    "starStoryBank",
  ]);
});

test("tools coexist: writing one slice never clobbers a sibling", () => {
  let s = addStory(emptyState(), GOOD_STORY);
  s = addApplication(s, { company: "JPM" });
  s = addStory(s, { ...WEAK_STORY, tags: ["failure"] });
  assert.equal(s.tools.starStoryBank.stories.length, 2);
  assert.equal(s.tools.applicationTracker.applications.length, 1);
});

test("an old save with an unrelated tools slice is preserved, not dropped", () => {
  const old = { tools: { coverLetter: { fields: { name: "Jane" } } } };
  const s = addStory(old, GOOD_STORY);
  assert.equal(s.tools.coverLetter.fields.name, "Jane");
  assert.equal(s.tools.starStoryBank.stories.length, 1);
});

const TOOLS_DIR = fileURLToPath(new URL("../lib/tools/", import.meta.url));

/**
 * Repo-relative paths of every tool module this guard scans, ENUMERATED FROM
 * DISK rather than hand-listed.
 *
 * This used to be a literal array of six paths. lib/tools/coverLetter.js was
 * not one of them, so the guard below — which is otherwise correct and which
 * fires on every spelling it is shown — simply could not see the file. A leak
 * planted there (localStorage key read + process.env read + console.log of the
 * key + a Bearer/x-api-key fetch) left the whole suite green. A hand-written
 * coverage list rots the moment a file is added, and rots SILENTLY. Reading the
 * directory is what makes the next tool module guarded on the day it lands.
 * @type {string[]}
 */
const TOOL_MODULE_FILES = fs
  .readdirSync(TOOLS_DIR, { recursive: true })
  .map((n) => String(n).split(path.sep).join("/"))
  .filter((n) => n.endsWith(".js"))
  .map((n) => `lib/tools/${n}`)
  .sort();

test("THE GUARD'S OWN COVERAGE: every module in lib/tools is actually scanned", () => {
  // A guard with no test of its own coverage is how the blind spot above
  // survived. This enumerates by a DIFFERENT mechanism than TOOL_MODULE_FILES
  // does (glob vs readdir) so it cannot go tautological with the thing it
  // checks, and so deleting the enumeration in favour of a list fails here.
  const onDisk = fs
    .globSync("**/*.js", { cwd: TOOLS_DIR })
    .map((n) => `lib/tools/${n.split(path.sep).join("/")}`)
    .sort();
  assert.ok(onDisk.length > 0, "lib/tools/ is non-empty — the enumeration resolves");
  assert.deepEqual(TOOL_MODULE_FILES, onDisk, "no tool module may go unscanned");
  // The file the hand-written list omitted, pinned by name: it is the proof
  // that this guard's coverage is now derived rather than remembered.
  assert.ok(
    TOOL_MODULE_FILES.includes("lib/tools/coverLetter.js"),
    "coverLetter.js — the module the old hand-written list omitted — is scanned",
  );
});

test("no tool module reads an ambient environment key path", async () => {
  // The security invariant, asserted structurally: the only AI seam in this
  // unit is the INJECTED llm. Nothing here may reach for process.env.
  const { readFile } = await import("node:fs/promises");
  const files = TOOL_MODULE_FILES;
  // Strip comments AND string literals first. A comment saying "never sees an
  // apiKey", or prose reading "past the 24-hour window.", is the invariant
  // being documented — not violated. Only executable code counts here.
  const toCode = (src) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/`(?:[^`\\]|\\.)*`/g, '""')
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, '""');

  for (const f of files) {
    const code = toCode(await readFile(new URL(`../${f}`, import.meta.url), "utf8"));
    assert.ok(!/process\.env/.test(code), `${f} must never read process.env`);
    assert.ok(!/\bfetch\s*\(/.test(code), `${f} must never fetch — the llm is injected`);
    assert.ok(!/apiKey/.test(code), `${f} must never touch an apiKey in code`);
    assert.ok(!/localStorage|\bwindow\b|\bdocument\b/.test(code), `${f} must stay pure — no DOM`);
  }
});
