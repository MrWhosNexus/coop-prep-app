// lib/ai/lesson-builder.js
// The centerpiece: student notes -> a generated curriculum section that
// matches data/curriculum.js's existing lesson shape exactly (body prose,
// challenge, exampleOutput, quiz with per-option explanations, flashcards),
// so generated content flows through every existing view.
//
// Contracts:
//   - The LLM is INJECTED. `llm` is an async
//       ({ system, user, model, options }) => { ok: true, text } | { ok: false, error }
//     matching lib/endpoints/call.js. In the renderer it wraps the ai:call
//     IPC channel; in tests it is a fake. This module never fetches and never
//     sees an API key.
//   - Nothing here auto-injects into the curriculum. buildLesson returns a
//     DRAFT; components/notes/LessonBuilder.js reviews it, and only an
//     explicit accept stores it (acceptGeneratedLesson, under the store's
//     `tools` slice).
//   - Token cost is the user's money: per-task model preferences pick the
//     cheapest model that suffices, estimateCost surfaces a dollar figure
//     BEFORE generation, and identical requests are served from a cache.

import { estimateTokens, fillPrompt } from "./fill-prompt.js";
import { BUILDER_PROMPTS, BUILDER_PROMPT_VERSION } from "./prompts-builder.js";
import {
  extractJson,
  finalizeGeneratedLesson,
  validateGeneratedLesson,
  validateQuizBatch,
} from "./schemas.js";
import { extractConceptsOffline, notesToText } from "./summarize.js";

// ─────────────────────────────────────────────────────────────────────────────
// Model selection + pricing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * $/million tokens. claude-sonnet-5 has introductory pricing through
 * 2026-08-31 (encoded below and applied by pricingFor's `now`).
 */
export const MODEL_PRICING = Object.freeze({
  "claude-fable-5": { input: 10, output: 50 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15, intro: { input: 2, output: 10, through: "2026-08-31" } },
});

/**
 * Cheapest-model-that-suffices, per task. Lesson generation is the one place
 * top capability pays for itself (a wrong lesson is a liability); quizzes,
 * flashcards, summaries, and JSON repair are high-volume and go to Sonnet.
 */
export const TASK_MODEL_PREFERENCES = Object.freeze({
  lesson: ["claude-fable-5", "claude-opus-4-8", "claude-sonnet-5"],
  quiz: ["claude-sonnet-5", "claude-opus-4-8", "claude-fable-5"],
  flashcards: ["claude-sonnet-5", "claude-opus-4-8", "claude-fable-5"],
  summarize: ["claude-sonnet-5", "claude-opus-4-8", "claude-fable-5"],
  repair: ["claude-sonnet-5", "claude-opus-4-8", "claude-fable-5"],
});

/**
 * Pick a model for a task from the endpoint's discovered model list.
 * Unknown lists (a BYO gateway's own naming) fall back to the first model —
 * the endpoint owner's default — rather than failing.
 *
 * @param {string} task - key of TASK_MODEL_PREFERENCES
 * @param {string[]} availableModels - from endpoints:models discovery
 * @returns {string|null}
 */
export function selectModelForTask(task, availableModels) {
  const prefs = TASK_MODEL_PREFERENCES[task] ?? TASK_MODEL_PREFERENCES.lesson;
  const list = Array.isArray(availableModels) ? availableModels : [];
  for (const model of prefs) {
    if (list.includes(model)) return model;
  }
  return list[0] ?? null;
}

/**
 * Current $/Mtok for a model, honouring claude-sonnet-5's introductory window.
 *
 * @param {string} model
 * @param {Date} [now]
 * @returns {{ input: number, output: number } | null} null when unknown
 */
export function pricingFor(model, now = new Date()) {
  const entry = MODEL_PRICING[model];
  if (!entry) return null;
  if (entry.intro && now.getTime() <= new Date(`${entry.intro.through}T23:59:59Z`).getTime()) {
    return { input: entry.intro.input, output: entry.intro.output };
  }
  return { input: entry.input, output: entry.output };
}

/**
 * Estimate a generation's dollar cost BEFORE running it, so the UI can show
 * the user what they are about to spend.
 *
 * @param {object} args
 * @param {string} [args.system]
 * @param {string} [args.user]
 * @param {string} args.model
 * @param {number} [args.expectedOutputTokens]
 * @param {Date} [args.now]
 * @returns {{ inputTokens: number, outputTokens: number, usd: number|null, model: string }}
 */
export function estimateCost({ system = "", user = "", model, expectedOutputTokens = 3000, now }) {
  const inputTokens = estimateTokens(`${system}\n${user}`);
  const pricing = pricingFor(model, now);
  const usd = pricing
    ? (inputTokens * pricing.input + expectedOutputTokens * pricing.output) / 1e6
    : null;
  return { inputTokens, outputTokens: expectedOutputTokens, usd, model };
}

// ─────────────────────────────────────────────────────────────────────────────
// Generation cache — identical notes + model + prompt version never bill twice.
// ─────────────────────────────────────────────────────────────────────────────

/** @returns {{ get(k: string): any, set(k: string, v: any): void, has(k: string): boolean, size(): number }} */
export function createGenerationCache() {
  const map = new Map();
  return {
    get: (k) => map.get(k),
    set: (k, v) => {
      map.set(k, v);
    },
    has: (k) => map.has(k),
    size: () => map.size,
  };
}

/**
 * Stable string hash (djb2, base36) for cache keys.
 *
 * @param {string} text
 * @returns {string}
 */
export function hashString(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

function cacheKey(kind, model, parts) {
  return `${kind}:${model}:v${BUILDER_PROMPT_VERSION}:${hashString(JSON.stringify(parts))}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Request assembly (exported so tests can inspect grounding without an LLM)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the {system, user} pair for a lesson generation.
 *
 * @param {object} args
 * @param {object[]} args.notes - note records (id, body, lessonId, tags)
 * @param {{ id?: string, title?: string, description?: string, lessons?: object[] }} args.module
 * @param {{ term: string }[]} [args.flashcards] - curriculum terms for grounding
 * @returns {{ system: string, user: string }}
 */
export function buildLessonRequest({ notes, module: mod, flashcards = [] }) {
  const existing = (mod?.lessons ?? []).map((l) => `- ${l.title}`).join("\n") || "(none yet)";
  const contextLines = (mod?.lessons ?? [])
    .slice(0, 3)
    .map((l) => `- "${l.title}": ${(l.body?.[0] ?? "").slice(0, 220)}`)
    .join("\n");
  const concepts = extractConceptsOffline(notes, flashcards).join(", ");

  const user = fillPrompt(BUILDER_PROMPTS.lesson.user, {
    moduleTitle: mod?.title ?? "General",
    moduleDescription: mod?.description ?? "",
    existingLessonTitles: existing,
    curriculumContext: contextLines,
    notes: notesToText(notes),
    concepts,
  });
  return { system: BUILDER_PROMPTS.lesson.system, user };
}

// ─────────────────────────────────────────────────────────────────────────────
// Core generate → extract → validate → (one repair retry) pipeline
// ─────────────────────────────────────────────────────────────────────────────

async function generateAndValidate({ llm, model, system, user, options, validate }) {
  const first = await llm({ system, user, model, options });
  if (!first?.ok) {
    return { ok: false, error: first?.error ?? { type: "BAD_RESPONSE", message: "The AI call failed." } };
  }

  let extracted = extractJson(first.text);
  let validated = extracted.ok ? validate(extracted.value) : null;
  if (extracted.ok && validated.ok) return { ok: true, value: validated, calls: 1 };

  // One cheap repair pass: hand the model its own output plus the exact errors.
  const errors = extracted.ok ? validated.errors.join("\n") : extracted.error;
  const repairUser = fillPrompt(BUILDER_PROMPTS.repair.user, {
    raw: String(first.text).slice(0, 8000),
    errors,
  });
  const second = await llm({
    system: BUILDER_PROMPTS.repair.system,
    user: repairUser,
    model,
    options,
  });
  if (!second?.ok) {
    return { ok: false, error: second?.error ?? { type: "BAD_RESPONSE", message: "The repair call failed." } };
  }

  extracted = extractJson(second.text);
  if (!extracted.ok) {
    return { ok: false, error: { type: "INVALID_OUTPUT", message: extracted.error } };
  }
  validated = validate(extracted.value);
  if (!validated.ok) {
    return {
      ok: false,
      error: { type: "INVALID_OUTPUT", message: validated.errors.join("; "), errors: validated.errors },
    };
  }
  return { ok: true, value: validated, calls: 2 };
}

/**
 * Generate a full lesson section from the user's notes. Returns a DRAFT —
 * nothing enters the curriculum until the user accepts it in the review UI.
 *
 * @param {object} args
 * @param {object[]} args.notes - the SELECTED note records grounding this lesson
 * @param {object} args.module - the target curriculum module (id/title/description/lessons)
 * @param {{ term: string }[]} [args.flashcards] - curriculum flashcards for grounding
 * @param {Function} args.llm - injected caller (see module header)
 * @param {string} args.model
 * @param {string} [args.effort] - depth control; lessons default "high"
 * @param {number} [args.maxTokens]
 * @param {{ get: Function, set: Function, has: Function }} [args.cache]
 * @param {number} [args.now] - epoch ms, injectable for tests
 * @returns {Promise<{ ok: true, lesson: object, fromCache: boolean, estimate: object }
 *                  | { ok: false, error: object }>}
 */
export async function buildLesson(args) {
  const {
    notes,
    module: mod,
    flashcards = [],
    llm,
    model,
    effort = "high",
    maxTokens = 4000,
    cache = null,
    now = Date.now(),
  } = args ?? {};

  const notesArr = (Array.isArray(notes) ? notes : []).filter(
    (n) => n && typeof n.body === "string" && n.body.trim()
  );
  if (!notesArr.length) {
    return { ok: false, error: { type: "NO_NOTES", message: "Select at least one note to build from." } };
  }
  if (typeof llm !== "function") {
    return { ok: false, error: { type: "NO_LLM", message: "No AI caller was provided." } };
  }
  if (!model) {
    return { ok: false, error: { type: "BAD_REQUEST", message: "No model selected." } };
  }

  const { system, user } = buildLessonRequest({ notes: notesArr, module: mod, flashcards });
  const estimate = estimateCost({ system, user, model, expectedOutputTokens: 3000 });

  const key = cacheKey("lesson", model, {
    moduleId: mod?.id ?? null,
    bodies: notesArr.map((n) => n.body),
  });
  if (cache?.has(key)) {
    return { ok: true, lesson: cache.get(key), fromCache: true, estimate };
  }

  const result = await generateAndValidate({
    llm,
    model,
    system,
    user,
    options: { maxTokens, effort },
    validate: validateGeneratedLesson,
  });
  if (!result.ok) return result;

  const lesson = finalizeGeneratedLesson(result.value.lesson, {
    noteIds: notesArr.map((n) => n.id).filter(Boolean),
    model,
    moduleId: mod?.id ?? null,
    promptVersion: BUILDER_PROMPT_VERSION,
    now,
  });
  cache?.set(key, lesson);
  return { ok: true, lesson, fromCache: false, estimate };
}

/**
 * Generate standalone quiz questions on one concept (high-volume task —
 * pair with selectModelForTask("quiz", ...) for the cheap model).
 *
 * @param {object} args
 * @param {object[]} args.notes
 * @param {string} args.concept
 * @param {number} [args.count]
 * @param {Function} args.llm
 * @param {string} args.model
 * @param {string} [args.effort]
 * @param {number} [args.maxTokens]
 * @param {{ get: Function, set: Function, has: Function }} [args.cache]
 * @returns {Promise<{ ok: true, quiz: object[], fromCache: boolean } | { ok: false, error: object }>}
 */
export async function generateQuiz(args) {
  const {
    notes,
    concept,
    count = 2,
    llm,
    model,
    effort = "medium",
    maxTokens = 1600,
    cache = null,
  } = args ?? {};

  const notesArr = (Array.isArray(notes) ? notes : []).filter(
    (n) => n && typeof n.body === "string" && n.body.trim()
  );
  if (!notesArr.length) {
    return { ok: false, error: { type: "NO_NOTES", message: "Select at least one note to build from." } };
  }
  if (typeof llm !== "function" || !model) {
    return { ok: false, error: { type: "BAD_REQUEST", message: "An AI caller and model are required." } };
  }

  const user = fillPrompt(BUILDER_PROMPTS.quiz.user, {
    count: String(count),
    concept,
    notes: notesToText(notesArr),
  });

  const key = cacheKey("quiz", model, { concept, count, bodies: notesArr.map((n) => n.body) });
  if (cache?.has(key)) return { ok: true, quiz: cache.get(key), fromCache: true };

  const result = await generateAndValidate({
    llm,
    model,
    system: BUILDER_PROMPTS.quiz.system,
    user,
    options: { maxTokens, effort },
    validate: validateQuizBatch,
  });
  if (!result.ok) return result;

  cache?.set(key, result.value.quiz);
  return { ok: true, quiz: result.value.quiz, fromCache: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Accepted-lesson storage — lives under the store's opaque `tools` slice
// (lib/store/schema.js reserves tools[toolId][docId] for exactly this), so
// no schema bump is needed and generated lessons persist like any tool doc.
// ─────────────────────────────────────────────────────────────────────────────

export const LESSON_BUILDER_TOOL_ID = "lessonBuilder";

/**
 * Store an accepted generated lesson in a store document. Pure: returns a new doc.
 *
 * @param {object} doc - the whole store document ({ tools, ... })
 * @param {object} lesson - a finalized generated lesson
 * @returns {object}
 */
export function acceptGeneratedLesson(doc, lesson) {
  if (!lesson?.id) throw new Error("acceptGeneratedLesson: lesson must be finalized (have an id)");
  const tools = doc?.tools ?? {};
  const bucket = tools[LESSON_BUILDER_TOOL_ID] ?? {};
  return {
    ...doc,
    tools: { ...tools, [LESSON_BUILDER_TOOL_ID]: { ...bucket, [lesson.id]: lesson } },
  };
}

/**
 * Remove an accepted generated lesson (the "revertable" half of provenance).
 *
 * @param {object} doc
 * @param {string} lessonId
 * @returns {object}
 */
export function removeGeneratedLesson(doc, lessonId) {
  const bucket = doc?.tools?.[LESSON_BUILDER_TOOL_ID];
  if (!bucket || !(lessonId in bucket)) return doc;
  const { [lessonId]: _removed, ...rest } = bucket;
  return { ...doc, tools: { ...doc.tools, [LESSON_BUILDER_TOOL_ID]: rest } };
}

/**
 * All accepted generated lessons, newest first.
 *
 * @param {object} doc
 * @returns {object[]}
 */
export function listAcceptedLessons(doc) {
  const bucket = doc?.tools?.[LESSON_BUILDER_TOOL_ID] ?? {};
  return Object.values(bucket).sort((a, b) =>
    String(b?.provenance?.createdAt ?? "").localeCompare(String(a?.provenance?.createdAt ?? ""))
  );
}
