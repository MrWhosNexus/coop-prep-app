// lib/ai/summarize.js
// AI note summarization, key-concept extraction, and gap detection.
//
// The LLM is INJECTED: `llm` is an async function
//   ({ system, user, model, options }) => { ok: true, text } | { ok: false, error }
// matching lib/endpoints/call.js's result contract. Production wires it to
// the ai:call IPC channel (renderer) — this module never touches the network,
// never sees an API key, and runs under `node --test` with a fake.
//
// Gap detection is deliberately PURE (no LLM): "you have no notes on the
// thing the curriculum weights most" is a deterministic comparison, and a
// deterministic answer costs the user zero tokens.

import { fillPrompt } from "./fill-prompt.js";
import { BUILDER_PROMPTS } from "./prompts-builder.js";
import { extractJson, validateSummary } from "./schemas.js";

/** Accept either the notes slice map or an already-built array of notes. */
function toNoteArray(notes) {
  if (Array.isArray(notes)) return notes.filter((n) => n && typeof n === "object");
  if (notes && typeof notes === "object") return Object.values(notes);
  return [];
}

/**
 * Render notes into numbered plain text for a prompt slot.
 *
 * @param {object[]} notesArr
 * @returns {string}
 */
export function notesToText(notesArr) {
  return notesArr
    .map((n, i) => {
      const where = n.lessonId ? ` (lesson: ${n.lessonId})` : "";
      const tags = Array.isArray(n.tags) && n.tags.length ? ` [tags: ${n.tags.join(", ")}]` : "";
      return `${i + 1}.${where}${tags} ${n.body ?? ""}`;
    })
    .join("\n");
}

/**
 * Offline key-concept extraction: which known curriculum terms appear in the
 * notes. Free, deterministic, and a grounding aid for generation prompts.
 *
 * @param {Record<string, object>|object[]} notes
 * @param {{ term: string }[]} flashcards - e.g. data/curriculum.js FLASHCARDS
 * @returns {string[]} terms found in the notes, in flashcard order
 */
export function extractConceptsOffline(notes, flashcards = []) {
  const text = toNoteArray(notes)
    .map((n) => String(n.body ?? ""))
    .join("\n")
    .toLowerCase();
  if (!text) return [];
  return flashcards
    .filter((f) => typeof f?.term === "string" && text.includes(f.term.toLowerCase()))
    .map((f) => f.term);
}

/**
 * Pure gap detection: compare note coverage against what the curriculum
 * weights most. Weight = lesson minutes + 2 x quiz length, so long, heavily
 * quizzed lessons surface first.
 *
 * @param {object} args
 * @param {Record<string, object>|object[]} args.notes
 * @param {object[]} args.modules - data/curriculum.js MODULES (or a subset)
 * @param {{ term: string }[]} [args.flashcards] - to flag never-mentioned terms
 * @returns {{
 *   lessonGaps: { lessonId: string, moduleId: string, title: string, weight: number }[],
 *   missingTerms: string[],
 *   notedLessonIds: string[],
 * }}
 */
export function detectGaps({ notes, modules, flashcards = [] }) {
  const notesArr = toNoteArray(notes);

  const counts = {};
  for (const note of notesArr) {
    if (note.lessonId) counts[note.lessonId] = (counts[note.lessonId] ?? 0) + 1;
  }

  const lessonGaps = [];
  for (const mod of Array.isArray(modules) ? modules : []) {
    for (const lesson of Array.isArray(mod.lessons) ? mod.lessons : []) {
      if (counts[lesson.id]) continue;
      const weight = (lesson.minutes ?? 5) + 2 * (Array.isArray(lesson.quiz) ? lesson.quiz.length : 0);
      lessonGaps.push({ lessonId: lesson.id, moduleId: mod.id, title: lesson.title, weight });
    }
  }
  lessonGaps.sort((a, b) => b.weight - a.weight);

  const allText = notesArr.map((n) => String(n.body ?? "")).join("\n").toLowerCase();
  const missingTerms = flashcards
    .filter((f) => typeof f?.term === "string" && !allText.includes(f.term.toLowerCase()))
    .map((f) => f.term);

  return { lessonGaps, missingTerms, notedLessonIds: Object.keys(counts) };
}

/**
 * Summarize notes with the injected LLM: 3-5 sentence summary, key concepts,
 * and any misconceptions the model spots (quoted, never silently corrected).
 *
 * @param {object} args
 * @param {Record<string, object>|object[]} args.notes
 * @param {string|null} [args.lessonId] - restrict to one lesson's notes
 * @param {Function} args.llm - injected caller (see module header)
 * @param {string} args.model
 * @param {string} [args.effort]
 * @param {number} [args.maxTokens]
 * @returns {Promise<{ ok: true, summary: object, noteIds: string[] } | { ok: false, error: object }>}
 */
export async function summarizeNotes({ notes, lessonId, llm, model, effort = "medium", maxTokens = 1200 }) {
  let notesArr = toNoteArray(notes);
  if (lessonId) notesArr = notesArr.filter((n) => n.lessonId === lessonId);
  if (!notesArr.length) {
    return { ok: false, error: { type: "NO_NOTES", message: "There are no notes to summarize." } };
  }
  if (typeof llm !== "function") {
    return { ok: false, error: { type: "NO_LLM", message: "No AI caller was provided." } };
  }

  const user = fillPrompt(BUILDER_PROMPTS.summarize.user, { notes: notesToText(notesArr) });
  const result = await llm({
    system: BUILDER_PROMPTS.summarize.system,
    user,
    model,
    options: { maxTokens, effort },
  });
  if (!result?.ok) {
    return { ok: false, error: result?.error ?? { type: "BAD_RESPONSE", message: "The AI call failed." } };
  }

  const extracted = extractJson(result.text);
  if (!extracted.ok) {
    return { ok: false, error: { type: "INVALID_OUTPUT", message: extracted.error } };
  }
  const validated = validateSummary(extracted.value);
  if (!validated.ok) {
    return { ok: false, error: { type: "INVALID_OUTPUT", message: validated.errors.join("; ") } };
  }

  return { ok: true, summary: validated.summary, noteIds: notesArr.map((n) => n.id).filter(Boolean) };
}
