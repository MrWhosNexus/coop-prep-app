// lib/tools/resume.js
// Resume Builder — ATS reality is the point (lesson hustle-materials-1).
//
// The output is deliberately plain: one column, ASCII hyphens, uppercase
// section headers, no tabs, no tables, no glyphs a parser can choke on. A
// beautiful resume that parses badly is dropped before a human sees it.
//
// Bullet analysis implements the lesson's formula literally:
//   action verb + what you did + quantified result.
//
// Pure ES-module reducers over the FULL progress state, immutable, matching
// lib/tools/coverLetter.js. No DOM, no network — importable under `node --test`.

import { analyzeStarText, extractNumbers, storyToBullet } from "./starStories.js";

// ---------------------------------------------------------------------------
// Default slice
// ---------------------------------------------------------------------------

export const defaultResumeBuilderState = {
  targetRole: "",
  targetCompany: "",
  pastedJobDescription: "",
  keywords: [], // [{ phrase, count }]
  contact: { name: "", email: "", phone: "", location: "", linkedin: "" },
  summary: "",
  skills: [], // string[]
  sections: [], // [{ id, kind, title, org, location, startDate, endDate }]
  bullets: [], // [{ id, sectionId, raw, actionVerb, quantifiedResult, matchedKeywords }]
  aiResponse: null,
  lastSaved: null,
  tokenWarning: false,
};

/** Section kinds that assembleResume knows how to render, in resume order. */
export const SECTION_KINDS = Object.freeze(["experience", "education", "project"]);

/** Standard ATS-friendly section order (lesson hustle-materials-1). */
export const SECTION_ORDER = Object.freeze(["summary", "education", "experience", "project", "skills"]);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getSlice(state) {
  const raw = state && state.tools && state.tools.resumeBuilder;
  if (!raw) return defaultResumeBuilderState;
  // An old save predating a field merges cleanly rather than crashing.
  return {
    ...defaultResumeBuilderState,
    ...raw,
    contact: { ...defaultResumeBuilderState.contact, ...(raw.contact || {}) },
  };
}

function withSlice(state, slice) {
  return {
    ...state,
    tools: {
      ...(state && state.tools),
      resumeBuilder: { ...slice, lastSaved: Date.now() },
    },
  };
}

let idCounter = 0;
function makeId(prefix) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

// ---------------------------------------------------------------------------
// Bullet analysis
// ---------------------------------------------------------------------------

/**
 * Verbs that describe a duty rather than an accomplishment. The lesson's own
 * example of a bad bullet — "Responsible for financial analysis" — is a duty:
 * it says what you were assigned, not what you did or what changed.
 * @type {readonly string[]}
 */
export const WEAK_VERB_PHRASES = Object.freeze([
  "responsible for",
  "duties included",
  "tasked with",
  "in charge of",
  "worked on",
  "helped with",
  "helped to",
  "assisted with",
  "involved in",
  "participated in",
  "familiar with",
  "exposure to",
  "worked with",
  "handled",
  "dealt with",
]);

/**
 * Strong, finance-credible action verbs. Not exhaustive — a verb absent here
 * is not condemned; it just isn't vouched for.
 * @type {readonly string[]}
 */
export const STRONG_ACTION_VERBS = Object.freeze([
  "analyzed", "audited", "automated", "built", "calculated", "compiled", "conducted",
  "consolidated", "constructed", "created", "cut", "delivered", "designed", "developed",
  "drove", "eliminated", "engineered", "established", "evaluated", "executed", "expanded",
  "flagged", "forecasted", "generated", "grew", "identified", "implemented", "improved",
  "increased", "initiated", "launched", "led", "managed", "modeled", "negotiated",
  "optimized", "presented", "produced", "quantified", "reconciled", "reduced", "reported",
  "researched", "restructured", "saved", "scaled", "secured", "streamlined", "surfaced",
  "tracked", "trained", "validated",
]);

/** Words that signal an outcome rather than an activity. */
const OUTCOME_HINTS = Object.freeze([
  "increas", "decreas", "reduc", "sav", "grew", "grow", "improv", "cut", "rais",
  "generat", "deliver", "result", "flagg", "identif", "won", "secur", "faster",
  "under budget", "ahead of schedule", "per week", "per month", "hours", "revenue",
]);

function firstWord(text) {
  const m = String(text || "").trim().match(/^([A-Za-z']+)/);
  return m ? m[1].toLowerCase() : "";
}

/**
 * analyzeBullet(raw, keywords?) -> a per-bullet verdict against the formula.
 *
 * @param {string} raw
 * @param {Array<{phrase: string}|string>} [keywords] phrases from the posting
 * @returns {{
 *   raw: string,
 *   actionVerb: string,
 *   hasActionVerb: boolean,
 *   weakVerb: string|null,
 *   quantifiedResult: string|null,
 *   hasQuantifiedResult: boolean,
 *   hasOutcome: boolean,
 *   matchedKeywords: string[],
 *   words: number,
 *   score: number,
 *   issues: string[]
 * }}
 */
export function analyzeBullet(raw, keywords = []) {
  const text = String(raw || "").trim();
  const lower = text.toLowerCase();
  const issues = [];

  const weakVerb = WEAK_VERB_PHRASES.find((p) => lower.startsWith(p) || lower.includes(` ${p}`)) || null;
  const first = firstWord(text);
  const hasActionVerb = Boolean(first) && !weakVerb && (STRONG_ACTION_VERBS.includes(first) || /(ed|d)$/.test(first));
  const actionVerb = hasActionVerb ? first : "";

  const numbers = extractNumbers(text);
  const quantifiedResult = numbers.length > 0 ? numbers[numbers.length - 1] : null;
  const hasOutcome = OUTCOME_HINTS.some((h) => lower.includes(h));

  const matchedKeywords = matchKeywords(text, keywords);

  let score = 0;
  if (hasActionVerb) score += 30;
  else if (weakVerb) issues.push(`Opens with "${weakVerb}" — that describes a duty, not an accomplishment.`);
  else if (!first) issues.push("Bullet is empty.");
  else issues.push(`"${first}" is not a clear past-tense action verb — open on what you did.`);

  if (numbers.length > 0) score += 40;
  else issues.push("No number anywhere — the formula ends in a quantified result.");

  if (hasOutcome) score += 20;
  else issues.push("No outcome — say what changed because you did it, not just what you touched.");

  if (matchedKeywords.length > 0) score += 10;

  const words = text ? text.split(/\s+/).length : 0;
  if (words > 32) issues.push(`${words} words — trim to roughly one line; a recruiter scans, they don't read.`);

  return {
    raw: text,
    actionVerb,
    hasActionVerb,
    weakVerb,
    quantifiedResult,
    hasQuantifiedResult: numbers.length > 0,
    hasOutcome,
    matchedKeywords,
    words,
    score,
    issues,
  };
}

/**
 * suggestBulletRewrite(raw) -> an offline scaffold for a weak bullet.
 * This is the no-key path: it never invents a number, it shows the user
 * exactly where their own number has to go.
 *
 * @param {string} raw
 * @returns {string}
 */
export function suggestBulletRewrite(raw) {
  const report = analyzeBullet(raw);
  if (!report.raw) return "";
  let stem = report.raw;
  if (report.weakVerb) {
    const re = new RegExp(`^${report.weakVerb}\\s*`, "i");
    stem = stem.replace(re, "").trim();
    if (stem) stem = stem[0].toUpperCase() + stem.slice(1);
  }
  stem = stem.replace(/[.\s]+$/, "");
  const verb = report.hasActionVerb ? "" : "[Action verb, e.g. Analyzed/Built/Reduced] ";
  const tail = report.hasQuantifiedResult ? "" : ", [quantified result — a number and what changed]";
  return `${verb}${stem}${tail}`;
}

// ---------------------------------------------------------------------------
// Keyword extraction — pure, no AI. Lifts EXACT phrases from the posting,
// not synonyms, because the ATS matches strings (lesson hustle-materials-1).
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "for", "of", "to", "in", "on", "at", "by", "with",
  "from", "as", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "will", "would", "can", "could", "should", "may", "might", "must", "shall", "this",
  "that", "these", "those", "it", "its", "you", "your", "our", "we", "they", "their",
  "all", "any", "not", "no", "if", "than", "then", "so", "such", "up", "out", "about",
  "into", "over", "more", "most", "other", "some", "who", "whom", "which", "what", "when",
  "where", "how", "why", "also", "including", "include", "includes", "etc", "per", "via",
  "years", "year", "experience", "ability", "strong", "excellent", "work", "working",
  "role", "team", "teams", "candidate", "candidates", "job", "position", "company",
  "must", "plus", "preferred", "required", "requirements", "responsibilities", "skills",
]);

/**
 * Multi-word phrases worth surfacing verbatim when the posting contains them.
 * Exact strings, because that is what an ATS matches on.
 * @type {readonly string[]}
 */
export const KNOWN_PHRASES = Object.freeze([
  "financial modeling", "financial analysis", "financial statements", "financial services",
  "client relationship management", "relationship management", "wealth management",
  "asset management", "portfolio management", "portfolio analysis", "risk management",
  "data analysis", "data visualization", "business intelligence", "market research",
  "due diligence", "variance analysis", "forecasting", "budgeting", "valuation",
  "pivot tables", "pivot table", "xlookup", "vlookup", "index match", "power query",
  "microsoft excel", "excel", "tableau", "power bi", "sql", "python", "bloomberg",
  "series 7", "series 63", "series 65", "series 66", "sie", "cfa", "cfp",
  "regulatory compliance", "compliance", "kyc", "aml", "fixed income", "equities",
  "capital markets", "investment banking", "private wealth", "client service",
  "stakeholder management", "cross-functional", "attention to detail", "presentation skills",
]);

/**
 * extractKeywordsFromJobDescription(text, limit?) -> ranked exact phrases.
 *
 * Pure tokenizer + phrase matcher — no AI. Known multi-word phrases outrank
 * bare tokens, and repetition in the posting is treated as emphasis.
 *
 * @param {string} text
 * @param {number} [limit] default 12 (the lesson asks for 8-10)
 * @returns {Array<{phrase: string, count: number}>}
 */
export function extractKeywordsFromJobDescription(text, limit = 12) {
  const src = String(text || "");
  if (!src.trim()) return [];
  const lower = src.toLowerCase();
  const out = [];
  const claimed = [];

  for (const phrase of KNOWN_PHRASES) {
    const re = new RegExp(`(?<![a-z0-9])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "g");
    const hits = lower.match(re);
    if (!hits) continue;
    // Skip a phrase already fully contained in a longer one we took.
    if (claimed.some((c) => c.includes(phrase))) continue;
    claimed.push(phrase);
    out.push({ phrase, count: hits.length, weight: hits.length * 10 + phrase.split(" ").length });
  }

  const tokenCounts = new Map();
  for (const token of lower.match(/[a-z][a-z0-9+#.-]{2,}/g) || []) {
    const clean = token.replace(/[.]+$/, "");
    if (clean.length < 3 || STOP_WORDS.has(clean)) continue;
    if (claimed.some((c) => c.split(" ").includes(clean))) continue;
    tokenCounts.set(clean, (tokenCounts.get(clean) || 0) + 1);
  }
  for (const [phrase, count] of tokenCounts) {
    if (count < 2) continue; // a word said once is not an emphasis
    out.push({ phrase, count, weight: count });
  }

  return out
    .sort((a, b) => b.weight - a.weight || a.phrase.localeCompare(b.phrase))
    .slice(0, limit)
    .map(({ phrase, count }) => ({ phrase, count }));
}

/**
 * matchKeywords(text, keywords) -> the keyword phrases that appear in the text.
 * @param {string} text
 * @param {Array<{phrase: string}|string>} keywords
 * @returns {string[]}
 */
export function matchKeywords(text, keywords) {
  const lower = String(text || "").toLowerCase();
  if (!lower || !Array.isArray(keywords)) return [];
  return keywords
    .map((k) => (typeof k === "string" ? k : k && k.phrase))
    .filter((p) => typeof p === "string" && p && lower.includes(p.toLowerCase()));
}

/**
 * keywordCoverage(state) -> which of the posting's phrases the resume actually
 * contains, and which are missing. The live checklist from the lesson.
 *
 * @param {object} state
 * @returns {{matched: string[], missing: string[], total: number, ratio: number}}
 */
export function keywordCoverage(state) {
  const slice = getSlice(state);
  const haystack = [
    slice.summary,
    slice.skills.join(" "),
    ...slice.sections.map((s) => `${s.title || ""} ${s.org || ""}`),
    ...slice.bullets.map((b) => b.raw || ""),
  ]
    .join("\n")
    .toLowerCase();

  const phrases = slice.keywords.map((k) => (typeof k === "string" ? k : k.phrase)).filter(Boolean);
  const matched = phrases.filter((p) => haystack.includes(String(p).toLowerCase()));
  const missing = phrases.filter((p) => !matched.includes(p));
  return {
    matched,
    missing,
    total: phrases.length,
    ratio: phrases.length ? matched.length / phrases.length : 0,
  };
}

// ---------------------------------------------------------------------------
// Reducers
// ---------------------------------------------------------------------------

/**
 * setResumeBuilderField(state, key, value) -> newState.
 * Setting `pastedJobDescription` re-derives `keywords` and re-matches every
 * bullet, so the checklist is always live.
 *
 * @param {object} state
 * @param {string} key
 * @param {*} value
 * @returns {object}
 */
export function setResumeBuilderField(state, key, value) {
  const slice = getSlice(state);
  const next = { ...slice, [key]: value };
  if (key === "pastedJobDescription") {
    next.keywords = extractKeywordsFromJobDescription(value);
    next.bullets = slice.bullets.map((b) => ({ ...b, matchedKeywords: matchKeywords(b.raw, next.keywords) }));
  }
  return withSlice(state, next);
}

/**
 * setResumeContactField(state, key, value) -> newState.
 * @param {object} state
 * @param {string} key
 * @param {string} value
 * @returns {object}
 */
export function setResumeContactField(state, key, value) {
  const slice = getSlice(state);
  return withSlice(state, { ...slice, contact: { ...slice.contact, [key]: value } });
}

/**
 * setResumeSkills(state, skills) -> newState.
 * @param {object} state
 * @param {string[]} skills
 * @returns {object}
 */
export function setResumeSkills(state, skills) {
  const slice = getSlice(state);
  const list = Array.isArray(skills)
    ? skills.map((s) => String(s).trim()).filter(Boolean)
    : String(skills || "").split(",").map((s) => s.trim()).filter(Boolean);
  return withSlice(state, { ...slice, skills: list });
}

/**
 * addResumeSection(state, section) -> newState.
 * @param {object} state
 * @param {object} section
 * @returns {object}
 */
export function addResumeSection(state, section = {}) {
  const slice = getSlice(state);
  const next = {
    id: section.id || makeId("sec"),
    kind: SECTION_KINDS.includes(section.kind) ? section.kind : "experience",
    title: String(section.title || ""),
    org: String(section.org || ""),
    location: String(section.location || ""),
    startDate: String(section.startDate || ""),
    endDate: String(section.endDate || ""),
  };
  return withSlice(state, { ...slice, sections: [...slice.sections, next] });
}

/**
 * updateResumeSection(state, sectionId, patch) -> newState.
 * @param {object} state
 * @param {string} sectionId
 * @param {object} patch
 * @returns {object}
 */
export function updateResumeSection(state, sectionId, patch) {
  const slice = getSlice(state);
  return withSlice(state, {
    ...slice,
    sections: slice.sections.map((s) => (s.id === sectionId ? { ...s, ...patch, id: s.id } : s)),
  });
}

/**
 * removeResumeSection(state, sectionId) -> newState. Bullets under it go too.
 * @param {object} state
 * @param {string} sectionId
 * @returns {object}
 */
export function removeResumeSection(state, sectionId) {
  const slice = getSlice(state);
  return withSlice(state, {
    ...slice,
    sections: slice.sections.filter((s) => s.id !== sectionId),
    bullets: slice.bullets.filter((b) => b.sectionId !== sectionId),
  });
}

/**
 * addResumeBullet(state, rawText, sectionId?) -> newState.
 * The stored bullet carries its analysis so the UI never re-derives it.
 *
 * @param {object} state
 * @param {string} rawText
 * @param {string} [sectionId]
 * @returns {object}
 */
export function addResumeBullet(state, rawText, sectionId = null) {
  const slice = getSlice(state);
  const report = analyzeBullet(rawText, slice.keywords);
  const bullet = {
    id: makeId("bul"),
    sectionId,
    raw: String(rawText || ""),
    actionVerb: report.actionVerb,
    quantifiedResult: report.quantifiedResult,
    matchedKeywords: report.matchedKeywords,
  };
  return withSlice(state, { ...slice, bullets: [...slice.bullets, bullet] });
}

/**
 * updateResumeBullet(state, bulletId, patch) -> newState.
 * Re-runs the analysis whenever `raw` changes.
 *
 * @param {object} state
 * @param {string} bulletId
 * @param {object} patch
 * @returns {object}
 */
export function updateResumeBullet(state, bulletId, patch) {
  const slice = getSlice(state);
  return withSlice(state, {
    ...slice,
    bullets: slice.bullets.map((b) => {
      if (b.id !== bulletId) return b;
      const merged = { ...b, ...patch, id: b.id };
      if (patch && "raw" in patch) {
        const report = analyzeBullet(merged.raw, slice.keywords);
        merged.actionVerb = report.actionVerb;
        merged.quantifiedResult = report.quantifiedResult;
        merged.matchedKeywords = report.matchedKeywords;
      }
      return merged;
    }),
  });
}

/**
 * removeResumeBullet(state, bulletId) -> newState.
 * @param {object} state
 * @param {string} bulletId
 * @returns {object}
 */
export function removeResumeBullet(state, bulletId) {
  const slice = getSlice(state);
  return withSlice(state, { ...slice, bullets: slice.bullets.filter((b) => b.id !== bulletId) });
}

/**
 * addBulletFromStory(state, story, sectionId?) -> newState.
 * The STAR-bank reuse seam: a story already written for interviews becomes a
 * resume bullet without being retyped.
 *
 * @param {object} state
 * @param {object} story a STAR story from lib/tools/starStories.js
 * @param {string} [sectionId]
 * @returns {object}
 */
export function addBulletFromStory(state, story, sectionId = null) {
  const raw = storyToBullet(story);
  if (!raw) return state;
  return addResumeBullet(state, raw, sectionId);
}

/**
 * setResumeBuilderAIResponse(state, text, hasWarning = false) -> newState.
 * @param {object} state
 * @param {string} text
 * @param {boolean} [hasWarning]
 * @returns {object}
 */
export function setResumeBuilderAIResponse(state, text, hasWarning = false) {
  const slice = getSlice(state);
  return withSlice(state, { ...slice, aiResponse: text, tokenWarning: hasWarning });
}

/**
 * clearResumeBuilderAIResponse(state) -> newState.
 * @param {object} state
 * @returns {object}
 */
export function clearResumeBuilderAIResponse(state) {
  const slice = getSlice(state);
  return {
    ...state,
    tools: {
      ...(state && state.tools),
      resumeBuilder: { ...slice, aiResponse: null, tokenWarning: false },
    },
  };
}

// ---------------------------------------------------------------------------
// Assembly + audit
// ---------------------------------------------------------------------------

const ATS_RULES = Object.freeze([
  "Single column, no tables, no text boxes, no graphics.",
  "Standard section headers (SUMMARY / EDUCATION / EXPERIENCE / SKILLS).",
  "Plain hyphen bullets — not glyphs a parser may drop.",
  "Reverse-chronological, one page for entry-level.",
]);

/**
 * atsRules() -> the ATS constraints this assembler honours.
 * @returns {readonly string[]}
 */
export function atsRules() {
  return ATS_RULES;
}

/** Strip anything a parser may mangle: smart quotes, glyph bullets, tabs. */
function atsSafe(text) {
  return String(text || "")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[•●▪·‣⁃]/g, "-")
    .replace(/\t/g, " ")
    .replace(/[^\x20-\x7E\n]/g, "")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function sectionHeadingFor(kind) {
  if (kind === "education") return "EDUCATION";
  if (kind === "project") return "PROJECTS";
  return "EXPERIENCE";
}

function dateRange(section) {
  const a = atsSafe(section.startDate);
  const b = atsSafe(section.endDate);
  if (a && b) return `${a} - ${b}`;
  return a || b || "";
}

/**
 * assembleResume(sliceOrState) -> ATS-safe plain text.
 *
 * Accepts either the resumeBuilder slice or the full progress state. Partial
 * data is handled the way assembleCoverLetter handles it: no "undefined", no
 * dangling fragments, no empty headers.
 *
 * @param {object} input
 * @returns {string}
 */
export function assembleResume(input) {
  const slice = input && input.tools ? getSlice(input) : { ...defaultResumeBuilderState, ...(input || {}) };
  const contact = { ...defaultResumeBuilderState.contact, ...(slice.contact || {}) };
  const out = [];

  // --- header ---
  const name = atsSafe(contact.name) || "[YOUR NAME]";
  out.push(name.toUpperCase());
  const line = [contact.email, contact.phone, contact.location, contact.linkedin]
    .map((x) => atsSafe(x))
    .filter(Boolean)
    .join(" | ");
  if (line) out.push(line);

  // --- summary ---
  const summary = atsSafe(slice.summary);
  if (summary) {
    out.push("", "SUMMARY", summary);
  }

  // --- dated sections, grouped by kind in standard order ---
  const bullets = Array.isArray(slice.bullets) ? slice.bullets : [];
  for (const kind of ["education", "experience", "project"]) {
    const sections = (slice.sections || []).filter((s) => s.kind === kind);
    if (sections.length === 0) continue;
    out.push("", sectionHeadingFor(kind));
    for (const section of sections) {
      const title = atsSafe(section.title);
      const org = atsSafe(section.org);
      const head = [title, org].filter(Boolean).join(" - ");
      const meta = [atsSafe(section.location), dateRange(section)].filter(Boolean).join(" | ");
      if (head) out.push(head);
      if (meta) out.push(meta);
      for (const b of bullets.filter((x) => x.sectionId === section.id)) {
        const raw = atsSafe(b.raw);
        if (raw) out.push(`- ${raw}`);
      }
    }
  }

  // --- bullets with no section still belong on the page ---
  const orphans = bullets.filter((b) => !b.sectionId || !(slice.sections || []).some((s) => s.id === b.sectionId));
  if (orphans.length > 0) {
    const hasExperience = out.includes("EXPERIENCE");
    if (!hasExperience) out.push("", "EXPERIENCE");
    for (const b of orphans) {
      const raw = atsSafe(b.raw);
      if (raw) out.push(`- ${raw}`);
    }
  }

  // --- skills ---
  const skills = (slice.skills || []).map((s) => atsSafe(s)).filter(Boolean);
  if (skills.length > 0) {
    out.push("", "SKILLS", skills.join(", "));
  }

  return out.join("\n");
}

/**
 * auditResume(state) -> the whole-document verdict: per-bullet reports, the
 * keyword checklist, and plain-language problems worth fixing first.
 *
 * @param {object} state
 * @returns {{bullets: Array<object>, coverage: object, weakCount: number, unquantifiedCount: number, averageScore: number, issues: string[]}}
 */
export function auditResume(state) {
  const slice = getSlice(state);
  const reports = slice.bullets.map((b) => ({ id: b.id, ...analyzeBullet(b.raw, slice.keywords) }));
  const coverage = keywordCoverage(state);
  const weakCount = reports.filter((r) => r.weakVerb || !r.hasActionVerb).length;
  const unquantifiedCount = reports.filter((r) => !r.hasQuantifiedResult).length;
  const averageScore = reports.length
    ? Math.round(reports.reduce((a, r) => a + r.score, 0) / reports.length)
    : 0;

  const issues = [];
  if (reports.length === 0) {
    issues.push("No bullets yet. Start with your strongest experience — action verb, what you did, a number.");
  }
  if (weakCount > 0) {
    issues.push(
      `${weakCount} of ${reports.length} bullets open on a duty, not an action. "Responsible for" tells a recruiter nothing.`
    );
  }
  if (unquantifiedCount > 0) {
    issues.push(
      `${unquantifiedCount} of ${reports.length} bullets have no number. The formula ends in a quantified result.`
    );
  }
  if (!slice.pastedJobDescription.trim()) {
    issues.push("No job description pasted — paste one to get the exact keyword checklist an ATS matches on.");
  } else if (coverage.missing.length > 0) {
    issues.push(
      `Missing ${coverage.missing.length} of ${coverage.total} posting keywords: ${coverage.missing.slice(0, 5).join(", ")}.`
    );
  }
  if (reports.length > 0 && issues.length === 0) {
    issues.push("Every bullet clears the formula and the posting's keywords are covered.");
  }

  return { bullets: reports, coverage, weakCount, unquantifiedCount, averageScore, issues };
}

// ---------------------------------------------------------------------------
// Optional AI enhancement — prompt only. The call is made by the caller
// through the injected llm (ai:call over IPC). This module never fetches.
// ---------------------------------------------------------------------------

/** @type {{system: string, user: string}} */
export const RESUME_BULLET_PROMPT = Object.freeze({
  system:
    "You rewrite resume bullets for early-career financial-services candidates. " +
    "Rules, without exception: (1) Never invent facts, numbers, employers, or outcomes — " +
    "if the candidate gave no number, write the bracketed placeholder [quantified result] " +
    "rather than inventing one. (2) Open on a strong past-tense action verb. " +
    "(3) Follow the formula: action verb + what you did + quantified result. " +
    "(4) Weave in the listed keywords ONLY where they are truthful in context; never keyword-stuff. " +
    "(5) One bullet, one line, at most 30 words. (6) Plain text only — no markdown, no bullet glyph. " +
    "Output only the rewritten bullet.",
  user:
    "Rewrite this resume bullet.\n\n" +
    "Target role: {{targetRole}}\n" +
    "Target company: {{targetCompany}}\n" +
    "Keywords from the posting (use only where truthful): {{keywords}}\n" +
    "Current bullet: {{raw}}\n" +
    "Known weaknesses to fix: {{issues}}\n",
});

/**
 * buildBulletPromptSlots(state, rawText) -> slots for fillPrompt().
 * @param {object} state
 * @param {string} rawText
 * @returns {{targetRole: string, targetCompany: string, keywords: string, raw: string, issues: string}}
 */
export function buildBulletPromptSlots(state, rawText) {
  const slice = getSlice(state);
  const report = analyzeBullet(rawText, slice.keywords);
  return {
    targetRole: slice.targetRole,
    targetCompany: slice.targetCompany,
    keywords: slice.keywords.map((k) => (typeof k === "string" ? k : k.phrase)).join(", "),
    raw: String(rawText || ""),
    issues: report.issues.join(" "),
  };
}

/**
 * summarizeVoice(state) -> a one-line read used by the UI header.
 * Exposed so the component stays presentational.
 * @param {object} state
 * @returns {string}
 */
export function summarizeVoice(state) {
  const { averageScore, bullets } = auditResume(state);
  if (bullets.length === 0) return "No bullets yet.";
  const analysis = analyzeStarText(bullets.map((b) => b.raw).join(" "));
  const weSkew = analysis.weCount > analysis.iCount ? " Leans on \"we\" — an interviewer cannot grade a team." : "";
  return `${bullets.length} bullets, average ${averageScore}/100.${weSkew}`;
}
