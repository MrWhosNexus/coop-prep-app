// lib/tools/starStories.js
// The STAR Story Bank — the keystone Hustle asset (lesson hustle-materials-3).
//
// One well-written story is written ONCE and reused everywhere: it feeds
// resume bullets (lib/tools/resume.js), the mock interview (lib/tools/
// mockInterview.js), and behavioral prep. Nothing here retypes a story.
//
// Pure ES-module reducers over the FULL progress state, immutable, matching
// lib/tools/coverLetter.js's conventions. No AI dependency, no DOM, no
// network — importable under `node --test`.

// ---------------------------------------------------------------------------
// Enums + defaults
// ---------------------------------------------------------------------------

/**
 * The fixed behavioral-category enum from lesson hustle-materials-3. Keeping
 * tags constrained is what makes retrieval-by-category meaningful.
 * @type {readonly string[]}
 */
export const STORY_TAGS = Object.freeze([
  "conflict",
  "failure",
  "leadership",
  "pressure",
  "analyticalWin",
  "other",
]);

/** Human labels for STORY_TAGS. @type {Readonly<Record<string, string>>} */
export const STORY_TAG_LABELS = Object.freeze({
  conflict: "Conflict",
  failure: "Failure",
  leadership: "Leadership",
  pressure: "Pressure",
  analyticalWin: "Analytical win",
  other: "Other",
});

/** The lesson's target: 6-8 stories covering every category. */
export const TARGET_STORY_COUNT = 6;

export const defaultStarStoryBankState = {
  stories: [],
  activeStoryId: null,
  lastSaved: null,
};

/** The four STAR parts, in order. @type {readonly string[]} */
export const STAR_PARTS = Object.freeze(["situation", "task", "action", "result"]);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getSlice(state) {
  return state && state.tools && state.tools.starStoryBank
    ? state.tools.starStoryBank
    : defaultStarStoryBankState;
}

function withSlice(state, slice) {
  return {
    ...state,
    tools: {
      ...(state && state.tools),
      starStoryBank: { ...slice, lastSaved: Date.now() },
    },
  };
}

let idCounter = 0;
/**
 * makeStoryId() -> a unique, serializable id.
 * @param {string} [prefix]
 * @returns {string}
 */
export function makeStoryId(prefix = "story") {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = [];
  for (const t of tags) {
    if (STORY_TAGS.includes(t) && !seen.includes(t)) seen.push(t);
  }
  return seen;
}

// ---------------------------------------------------------------------------
// Text analysis — shared with mockInterview.js and resume.js so that
// "does this have a number in it" means the same thing everywhere.
// ---------------------------------------------------------------------------

/** Matches 12, 12.5, 1,200, 40%, $3.2M, 4/5, 3x. */
const NUMBER_RE = /(\$\s?\d|\b\d+(?:[.,]\d+)*\s?(?:%|x\b|k\b|m\b|bn\b|hrs?\b|hours?\b|days?\b|weeks?\b|months?\b)?)/gi;

/**
 * extractNumbers(text) -> the quantified tokens found in the text.
 * @param {string} text
 * @returns {string[]}
 */
export function extractNumbers(text) {
  const src = String(text || "");
  const found = src.match(NUMBER_RE);
  return found ? found.map((s) => s.trim()) : [];
}

/**
 * analyzeStarText(text) -> shared specificity signals.
 *
 * `iRatio` is first-person-singular share of first-person pronouns; a story
 * that says "we" throughout does not tell an interviewer what YOU did.
 *
 * @param {string} text
 * @returns {{words: number, numbers: string[], hasNumbers: boolean, iCount: number, weCount: number, iRatio: number, firstPerson: boolean}}
 */
export function analyzeStarText(text) {
  const src = String(text || "");
  const words = src.trim() ? src.trim().split(/\s+/).length : 0;
  const numbers = extractNumbers(src);
  const iCount = (src.match(/\b(I|I'm|I've|I'd|I'll|my|mine)\b/g) || []).length;
  const weCount = (src.match(/\b(we|we're|we've|we'd|we'll|our|ours|us)\b/gi) || []).length;
  const total = iCount + weCount;
  const iRatio = total === 0 ? 0 : iCount / total;
  return {
    words,
    numbers,
    hasNumbers: numbers.length > 0,
    iCount,
    weCount,
    iRatio,
    firstPerson: total === 0 ? false : iRatio >= 0.5,
  };
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/**
 * createStory(patch) -> a fully-normalized story object.
 * Every field is present and serializable; unknown tags are dropped.
 *
 * @param {object} [patch]
 * @returns {{id: string, name: string, situation: string, task: string, action: string, result: string, tags: string[], lastUsedFor: Array<{question: string, date: string}>, createdAt: number, updatedAt: number}}
 */
export function createStory(patch = {}) {
  const now = Date.now();
  return {
    id: patch.id || makeStoryId(),
    name: String(patch.name || ""),
    situation: String(patch.situation || ""),
    task: String(patch.task || ""),
    action: String(patch.action || ""),
    result: String(patch.result || ""),
    tags: normalizeTags(patch.tags),
    lastUsedFor: Array.isArray(patch.lastUsedFor) ? [...patch.lastUsedFor] : [],
    createdAt: typeof patch.createdAt === "number" ? patch.createdAt : now,
    updatedAt: typeof patch.updatedAt === "number" ? patch.updatedAt : now,
  };
}

// ---------------------------------------------------------------------------
// Reducers
// ---------------------------------------------------------------------------

/**
 * addStory(state, story) -> newState. Normalizes and appends; sets it active.
 * @param {object} state
 * @param {object} story
 * @returns {object}
 */
export function addStory(state, story) {
  const slice = getSlice(state);
  const next = createStory(story);
  return withSlice(state, {
    ...slice,
    stories: [...slice.stories, next],
    activeStoryId: next.id,
  });
}

/**
 * updateStory(state, storyId, patch) -> newState. Ignores unknown ids.
 * `tags` in the patch is re-normalized; `id` cannot be changed.
 * @param {object} state
 * @param {string} storyId
 * @param {object} patch
 * @returns {object}
 */
export function updateStory(state, storyId, patch) {
  const slice = getSlice(state);
  return withSlice(state, {
    ...slice,
    stories: slice.stories.map((s) => {
      if (s.id !== storyId) return s;
      const merged = { ...s, ...patch, id: s.id, updatedAt: Date.now() };
      if (patch && "tags" in patch) merged.tags = normalizeTags(patch.tags);
      return merged;
    }),
  });
}

/**
 * removeStory(state, storyId) -> newState. Clears activeStoryId if it pointed here.
 * @param {object} state
 * @param {string} storyId
 * @returns {object}
 */
export function removeStory(state, storyId) {
  const slice = getSlice(state);
  return withSlice(state, {
    ...slice,
    stories: slice.stories.filter((s) => s.id !== storyId),
    activeStoryId: slice.activeStoryId === storyId ? null : slice.activeStoryId,
  });
}

/**
 * setActiveStory(state, storyId) -> newState.
 * @param {object} state
 * @param {string|null} storyId
 * @returns {object}
 */
export function setActiveStory(state, storyId) {
  const slice = getSlice(state);
  return withSlice(state, { ...slice, activeStoryId: storyId });
}

/**
 * tagStory(state, storyId, tag) -> newState. No-op for tags outside STORY_TAGS
 * or already present (idempotent).
 * @param {object} state
 * @param {string} storyId
 * @param {string} tag
 * @returns {object}
 */
export function tagStory(state, storyId, tag) {
  if (!STORY_TAGS.includes(tag)) return state;
  const slice = getSlice(state);
  return withSlice(state, {
    ...slice,
    stories: slice.stories.map((s) =>
      s.id === storyId && !s.tags.includes(tag)
        ? { ...s, tags: [...s.tags, tag], updatedAt: Date.now() }
        : s
    ),
  });
}

/**
 * untagStory(state, storyId, tag) -> newState.
 * @param {object} state
 * @param {string} storyId
 * @param {string} tag
 * @returns {object}
 */
export function untagStory(state, storyId, tag) {
  const slice = getSlice(state);
  return withSlice(state, {
    ...slice,
    stories: slice.stories.map((s) =>
      s.id === storyId ? { ...s, tags: s.tags.filter((t) => t !== tag), updatedAt: Date.now() } : s
    ),
  });
}

/**
 * logStoryUsage(state, storyId, questionText, date?) -> newState.
 * Appends { question, date } to lastUsedFor — the lesson's "maintain it like a
 * living document" instruction: after every interview, log the exact question.
 *
 * @param {object} state
 * @param {string} storyId
 * @param {string} questionText
 * @param {string} [date] ISO date; defaults to today
 * @returns {object}
 */
export function logStoryUsage(state, storyId, questionText, date) {
  const slice = getSlice(state);
  const stamp = date || new Date().toISOString().slice(0, 10);
  return withSlice(state, {
    ...slice,
    stories: slice.stories.map((s) =>
      s.id === storyId
        ? { ...s, lastUsedFor: [...s.lastUsedFor, { question: String(questionText || ""), date: stamp }] }
        : s
    ),
  });
}

// ---------------------------------------------------------------------------
// Scoring + completeness
// ---------------------------------------------------------------------------

/** A STAR part shorter than this reads as a placeholder, not an answer. */
const MIN_PART_CHARS = 15;

/**
 * scoreStory(story) -> completeness report.
 *
 * 100 points: 15 per present STAR part (60), 20 for a quantified Result,
 * 10 for first-person Action ("I", not a diffuse "we"), 10 for >=1 tag.
 * `missing` names what to fix, in priority order.
 *
 * @param {object} story
 * @returns {{score: number, parts: Record<string, boolean>, missing: string[], hasNumbers: boolean, firstPerson: boolean, complete: boolean}}
 */
export function scoreStory(story) {
  const s = story || {};
  const parts = {};
  let score = 0;
  const missing = [];

  for (const part of STAR_PARTS) {
    const ok = String(s[part] || "").trim().length >= MIN_PART_CHARS;
    parts[part] = ok;
    if (ok) score += 15;
    else missing.push(part);
  }

  const result = analyzeStarText(s.result);
  const action = analyzeStarText(s.action);

  if (result.hasNumbers) score += 20;
  else missing.push("quantifiedResult");

  if (action.firstPerson) score += 10;
  else missing.push("firstPersonAction");

  const tags = normalizeTags(s.tags);
  if (tags.length > 0) score += 10;
  else missing.push("tag");

  return {
    score,
    parts,
    missing,
    hasNumbers: result.hasNumbers,
    firstPerson: action.firstPerson,
    complete: missing.length === 0,
  };
}

/**
 * listStories(state) -> the stories array (never undefined).
 * @param {object} state
 * @returns {object[]}
 */
export function listStories(state) {
  return getSlice(state).stories;
}

/**
 * storiesByTag(state, tag) -> stories carrying that tag.
 * @param {object} state
 * @param {string} tag
 * @returns {object[]}
 */
export function storiesByTag(state, tag) {
  return listStories(state).filter((s) => Array.isArray(s.tags) && s.tags.includes(tag));
}

/**
 * tagCoverage(stories) -> per-category counts plus the categories with zero
 * stories. An interviewer WILL ask about failure; a bank with no failure story
 * is a known hole, and this is what names it.
 *
 * @param {object[]} stories
 * @returns {{counts: Record<string, number>, gaps: string[], covered: number, total: number, ready: boolean}}
 */
export function tagCoverage(stories) {
  const list = Array.isArray(stories) ? stories : [];
  const counts = {};
  for (const tag of STORY_TAGS) counts[tag] = 0;
  for (const s of list) {
    for (const t of normalizeTags(s && s.tags)) counts[t] += 1;
  }
  // "other" is a catch-all, not a category an interviewer asks for.
  const graded = STORY_TAGS.filter((t) => t !== "other");
  const gaps = graded.filter((t) => counts[t] === 0);
  const covered = graded.length - gaps.length;
  return {
    counts,
    gaps,
    covered,
    total: graded.length,
    ready: gaps.length === 0 && list.length >= TARGET_STORY_COUNT,
  };
}

/**
 * bankStatus(state) -> a plain-language read on the bank as a whole.
 * @param {object} state
 * @returns {{storyCount: number, completeCount: number, averageScore: number, coverage: object, messages: string[]}}
 */
export function bankStatus(state) {
  const stories = listStories(state);
  const scores = stories.map((s) => scoreStory(s));
  const completeCount = scores.filter((r) => r.complete).length;
  const averageScore = scores.length
    ? Math.round(scores.reduce((a, r) => a + r.score, 0) / scores.length)
    : 0;
  const coverage = tagCoverage(stories);
  const messages = [];

  if (stories.length === 0) {
    messages.push("No stories yet. The lesson's target is 6-8 real experiences, written once and reused.");
  } else if (stories.length < TARGET_STORY_COUNT) {
    messages.push(
      `${stories.length} ${stories.length === 1 ? "story" : "stories"} logged — the target is ${TARGET_STORY_COUNT}-8.`
    );
  }
  if (coverage.gaps.length > 0) {
    const names = coverage.gaps.map((t) => STORY_TAG_LABELS[t]).join(", ");
    messages.push(`No story tagged: ${names}. Interviewers ask for these by name.`);
  }
  const unquantified = stories.filter((s) => !scoreStory(s).hasNumbers);
  if (unquantified.length > 0) {
    messages.push(
      `${unquantified.length} ${unquantified.length === 1 ? "story has" : "stories have"} no number in the Result. A result without a number is an anecdote.`
    );
  }
  if (stories.length > 0 && messages.length === 0) {
    messages.push("Bank is interview-ready. Log the exact question after each round to keep it living.");
  }

  return { storyCount: stories.length, completeCount, averageScore, coverage, messages };
}

// ---------------------------------------------------------------------------
// Retrieval — the reuse surface. Mock interview and behavioral prep both
// come through here rather than making the user pick from memory.
// ---------------------------------------------------------------------------

/** Keyword -> category hints, matched against a question's text. */
const QUESTION_TAG_HINTS = Object.freeze({
  conflict: ["conflict", "disagree", "difficult person", "tension", "pushback", "argument", "coworker"],
  failure: ["fail", "failure", "mistake", "went wrong", "setback", "didn't work", "regret"],
  leadership: ["lead", "leader", "leadership", "influence", "without authority", "motivate", "team"],
  pressure: ["pressure", "deadline", "stress", "tight", "urgent", "juggle", "competing priorities"],
  analyticalWin: ["analy", "data", "model", "excel", "number", "quantif", "insight", "measur"],
});

/**
 * tagsForQuestion(questionText) -> the categories a question is asking for.
 * @param {string} questionText
 * @returns {string[]}
 */
export function tagsForQuestion(questionText) {
  const text = String(questionText || "").toLowerCase();
  if (!text) return [];
  return Object.keys(QUESTION_TAG_HINTS).filter((tag) =>
    QUESTION_TAG_HINTS[tag].some((hint) => text.includes(hint))
  );
}

/**
 * findStoriesForQuestion(stories, questionText) -> stories ranked by fit.
 *
 * Ranking: matching tag (+10 each), completeness score (/10), and a small
 * penalty for a story already used on this exact question so the bank
 * rotates rather than repeating.
 *
 * @param {object[]} stories
 * @param {string} questionText
 * @returns {Array<{story: object, fit: number, matchedTags: string[]}>}
 */
export function findStoriesForQuestion(stories, questionText) {
  const list = Array.isArray(stories) ? stories : [];
  const wanted = tagsForQuestion(questionText);
  const q = String(questionText || "").trim();

  return list
    .map((story) => {
      const tags = normalizeTags(story && story.tags);
      const matchedTags = wanted.filter((t) => tags.includes(t));
      let fit = matchedTags.length * 10;
      fit += scoreStory(story).score / 10;
      const usedHere = (story.lastUsedFor || []).some((u) => u && u.question === q);
      if (usedHere) fit -= 5;
      return { story, fit, matchedTags };
    })
    .sort((a, b) => b.fit - a.fit || String(a.story.name).localeCompare(String(b.story.name)));
}

// ---------------------------------------------------------------------------
// Rendering — one story, three destinations.
// ---------------------------------------------------------------------------

/**
 * storyToStarText(story) -> the labelled STAR paragraph (spoken/behavioral prep).
 * @param {object} story
 * @returns {string}
 */
export function storyToStarText(story) {
  const s = story || {};
  const lines = [];
  if (s.name) lines.push(String(s.name));
  for (const part of STAR_PARTS) {
    const body = String(s[part] || "").trim();
    if (body) lines.push(`${part[0].toUpperCase()}${part.slice(1)}: ${body}`);
  }
  return lines.join("\n");
}

/**
 * storyToBullet(story) -> a resume-bullet draft in the Hustle formula
 * (action verb + what you did + quantified result), derived from the story's
 * Action and Result. This is the seam that stops a user retyping the same
 * experience into the resume by hand.
 *
 * Returns "" for a story with no action text.
 *
 * @param {object} story
 * @returns {string}
 */
export function storyToBullet(story) {
  const s = story || {};
  const action = String(s.action || "").trim();
  if (!action) return "";

  // Take the first sentence of the Action — a bullet is one clause, not a
  // paragraph — and strip a leading first-person pronoun so it opens on a verb.
  let stem = action.split(/(?<=[.!?])\s+/)[0].trim();
  stem = stem.replace(/^(I|We)\s+/i, "");
  stem = stem.replace(/[.\s]+$/, "");
  if (!stem) return "";
  stem = stem[0].toUpperCase() + stem.slice(1);

  const result = String(s.result || "").trim();
  if (!result) return stem;

  // Prefer the sentence of the Result that actually carries a number.
  const sentences = result.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  const quantified = sentences.find((x) => extractNumbers(x).length > 0) || sentences[0] || "";
  let tail = quantified.replace(/^(I|We)\s+/i, "").replace(/[.\s]+$/, "");
  if (!tail) return stem;
  tail = tail[0].toLowerCase() + tail.slice(1);
  return `${stem}, ${tail}`;
}

/**
 * exportStories(state) -> a plain-JSON, portable snapshot of the bank.
 * @param {object} state
 * @returns {{version: number, exportedAt: string, stories: object[]}}
 */
export function exportStories(state) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    stories: listStories(state).map((s) => ({ ...s, tags: [...s.tags], lastUsedFor: [...s.lastUsedFor] })),
  };
}

/**
 * exportStoriesText(state) -> the whole bank as readable text (print/review).
 * @param {object} state
 * @returns {string}
 */
export function exportStoriesText(state) {
  const stories = listStories(state);
  if (stories.length === 0) return "STAR STORY BANK\n\n(No stories yet.)";
  const blocks = stories.map((s) => {
    const tags = s.tags.length ? ` [${s.tags.map((t) => STORY_TAG_LABELS[t]).join(", ")}]` : "";
    return `${storyToStarText({ ...s, name: `${s.name || "Untitled"}${tags}` })}`;
  });
  return ["STAR STORY BANK", "", blocks.join("\n\n")].join("\n");
}
