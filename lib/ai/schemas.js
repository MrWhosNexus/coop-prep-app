// lib/ai/schemas.js
// JSON schemas + STRICT validation for every AI-generated artifact.
//
// Model output is never trusted: it is extracted (extractJson), cheaply
// repaired (repairLesson — coercions only, never invented content), then
// validated hard (validateGeneratedLesson / validateSummary / ...). Anything
// that survives gets provenance stamped on it (finalizeGeneratedLesson) so
// generated content is auditable and revertable.
//
// The generated-lesson shape matches data/curriculum.js lessons EXACTLY —
// { id, title, minutes, body[], challenge, exampleOutput, quiz[] } — plus
// optional flashcards/games and the provenance block. No dependencies; the
// validator is a tiny subset of JSON Schema implemented locally.

// ─────────────────────────────────────────────────────────────────────────────
// Schemas (subset: type, required, properties, items, minItems, maxItems,
// minLength, enum)
// ─────────────────────────────────────────────────────────────────────────────

export const QUIZ_OPTION_SCHEMA = {
  type: "object",
  required: ["text", "explanation"],
  properties: {
    text: { type: "string", minLength: 1 },
    explanation: { type: "string", minLength: 1 },
  },
};

export const QUIZ_ITEM_SCHEMA = {
  type: "object",
  required: ["q", "a", "explanation", "options"],
  properties: {
    q: { type: "string", minLength: 1 },
    a: { type: "string", minLength: 1 },
    explanation: { type: "string", minLength: 1 },
    options: { type: "array", items: QUIZ_OPTION_SCHEMA, minItems: 4, maxItems: 4 },
  },
};

export const FLASHCARD_SCHEMA = {
  type: "object",
  required: ["term", "def"],
  properties: {
    term: { type: "string", minLength: 1 },
    def: { type: "string", minLength: 1 },
  },
};

export const GENERATED_LESSON_SCHEMA = {
  type: "object",
  required: ["title", "minutes", "body", "challenge", "exampleOutput", "quiz"],
  properties: {
    title: { type: "string", minLength: 3 },
    minutes: { type: "integer" },
    body: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1 },
    challenge: { type: "string", minLength: 1 },
    exampleOutput: { type: "string", minLength: 1 },
    quiz: { type: "array", items: QUIZ_ITEM_SCHEMA, minItems: 1 },
    flashcards: { type: "array", items: FLASHCARD_SCHEMA },
  },
};

export const SUMMARY_SCHEMA = {
  type: "object",
  required: ["summary"],
  properties: {
    summary: { type: "string", minLength: 1 },
    keyConcepts: { type: "array", items: { type: "string", minLength: 1 } },
    misconceptions: { type: "array", items: { type: "string", minLength: 1 } },
  },
};

export const GAME_CONFIG_SCHEMA = {
  type: "object",
  required: ["kind", "gameId", "title", "config"],
  properties: {
    kind: { type: "string", minLength: 1 },
    gameId: { type: "string", minLength: 1 },
    title: { type: "string", minLength: 1 },
    config: { type: "object" },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Mini validator
// ─────────────────────────────────────────────────────────────────────────────

function typeOf(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

/**
 * Validate `value` against a schema (the local subset). Returns error strings;
 * an empty array means valid.
 *
 * @param {unknown} value
 * @param {object} schema
 * @param {string} [path]
 * @returns {string[]}
 */
export function validateAgainst(value, schema, path = "$") {
  const errors = [];
  if (!schema || typeof schema !== "object") return errors;

  const actual = typeOf(value);
  if (schema.type === "integer") {
    if (actual !== "number" || !Number.isInteger(value)) {
      errors.push(`${path}: expected integer, got ${actual === "number" ? value : actual}`);
      return errors;
    }
  } else if (schema.type && actual !== schema.type) {
    errors.push(`${path}: expected ${schema.type}, got ${actual}`);
    return errors;
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: expected one of ${schema.enum.join(", ")}`);
  }

  if (schema.type === "string" && schema.minLength && value.trim().length < schema.minLength) {
    errors.push(`${path}: string shorter than ${schema.minLength}`);
  }

  if (schema.type === "array") {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${path}: expected at least ${schema.minItems} items, got ${value.length}`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${path}: expected at most ${schema.maxItems} items, got ${value.length}`);
    }
    if (schema.items) {
      value.forEach((item, i) => {
        errors.push(...validateAgainst(item, schema.items, `${path}[${i}]`));
      });
    }
  }

  if (schema.type === "object") {
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${path}.${key}: required`);
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (key in value) errors.push(...validateAgainst(value[key], sub, `${path}.${key}`));
    }
  }

  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON extraction — models wrap JSON in fences and prose no matter what the
// prompt says. Strip fences, then balanced-scan for the first {...} object.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pull the first JSON object out of model output.
 *
 * @param {string} text
 * @returns {{ ok: true, value: object } | { ok: false, error: string }}
 */
export function extractJson(text) {
  if (typeof text !== "string" || !text.trim()) {
    return { ok: false, error: "empty model output" };
  }
  let t = text.trim();

  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();

  try {
    const value = JSON.parse(t);
    if (value && typeof value === "object" && !Array.isArray(value)) return { ok: true, value };
  } catch {
    // fall through to the balanced scan
  }

  const start = t.indexOf("{");
  if (start === -1) return { ok: false, error: "no JSON object found in output" };

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return { ok: true, value: JSON.parse(t.slice(start, i + 1)) };
        } catch {
          return { ok: false, error: "output contained an unparseable JSON object" };
        }
      }
    }
  }
  return { ok: false, error: "output contained an unbalanced JSON object" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cheap repair — coercions only. Never invents content: anything that cannot
// be mechanically fixed is left for validation to reject loudly.
// ─────────────────────────────────────────────────────────────────────────────

const LESSON_KEY_ALIASES = {
  example_output: "exampleOutput",
  exampleoutput: "exampleOutput",
  questions: "quiz",
};

function cleanString(value) {
  return typeof value === "string" ? value.trim() : value;
}

/**
 * Normalise option text down to what a learner can actually tell apart.
 * "SUMIF", "sumif " and "SUM  IF" are one distractor, not three.
 *
 * @param {unknown} text
 * @returns {string} "" when `text` is not usable string content
 */
export function optionKey(text) {
  return typeof text === "string" ? text.trim().toLowerCase().replace(/\s+/g, " ") : "";
}

function repairQuizItem(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const item = {
    q: cleanString(raw.q ?? raw.question),
    a: cleanString(raw.a ?? raw.answer),
    explanation: cleanString(raw.explanation),
    options: Array.isArray(raw.options)
      ? raw.options
          .filter((o) => o && typeof o === "object")
          .map((o) => ({ text: cleanString(o.text), explanation: cleanString(o.explanation) }))
      : raw.options,
  };

  if (Array.isArray(item.options) && typeof item.a === "string") {
    // Case / whitespace answer drift: snap `a` to the matching option's exact text.
    if (!item.options.some((o) => o.text === item.a)) {
      const key = optionKey(item.a);
      const match = key && item.options.find((o) => optionKey(o.text) === key);
      if (match) item.a = match.text;
    }
    // Too many options: there is surplus to spend, so dropping normalised
    // duplicates here is a real repair — no content is invented, and every
    // survivor is a choice the learner can actually distinguish. Duplicates in
    // a 4-option item are NOT repaired: deleting one would leave 3 and
    // inventing a replacement is exactly what this layer must never do, so
    // validateQuizSemantics rejects those loudly instead.
    if (item.options.length > 4) {
      const seen = new Map();
      for (const option of item.options) {
        const key = optionKey(option.text);
        if (!key) continue; // blank/non-string: leave it for the schema to reject
        const kept = seen.get(key);
        // Prefer the occurrence that IS the answer, so snapping can't be undone.
        if (!kept || (kept.text !== item.a && option.text === item.a)) seen.set(key, option);
      }
      const unique = item.options.filter((o) => !optionKey(o.text) || seen.get(optionKey(o.text)) === o);

      if (unique.length > 4) {
        // Keep the correct option plus the first distractors — never reorder:
        // an answer that always lands first is a free tell.
        const correct = unique.filter((o) => o.text === item.a).slice(0, 1);
        const rest = unique.filter((o) => o.text !== item.a).slice(0, 4 - correct.length);
        const kept = new Set([...correct, ...rest]);
        item.options = unique.filter((o) => kept.has(o));
      } else {
        item.options = unique;
      }
    }
  }
  return item;
}

/**
 * Estimate reading minutes from body word count (used only when the model
 * omitted or mangled `minutes` — this is mechanical, not invented content).
 *
 * @param {string[]} body
 * @returns {number}
 */
export function estimateMinutes(body) {
  const words = (Array.isArray(body) ? body : [])
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.min(15, Math.max(3, Math.round(words / 140) + 3));
}

/**
 * Mechanically repair a raw generated-lesson object. Coercions only.
 *
 * @param {unknown} raw
 * @returns {object}
 */
export function repairLesson(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { };

  // Alias snake_case / drifted keys onto the canonical names.
  const src = {};
  for (const [key, value] of Object.entries(raw)) {
    src[LESSON_KEY_ALIASES[key] ?? key] = value;
  }

  const lesson = {};
  lesson.title = cleanString(src.title);

  let body = src.body;
  if (typeof body === "string") body = [body];
  if (Array.isArray(body)) {
    body = body.filter((p) => typeof p === "string" && p.trim()).map((p) => p.trim());
  }
  lesson.body = body;

  let minutes = src.minutes;
  if (typeof minutes === "string") minutes = Number(minutes);
  if (typeof minutes === "number" && Number.isFinite(minutes)) minutes = Math.round(minutes);
  if (!Number.isInteger(minutes) || minutes < 1) minutes = estimateMinutes(lesson.body);
  lesson.minutes = minutes;

  lesson.challenge = cleanString(src.challenge);
  lesson.exampleOutput = cleanString(src.exampleOutput);

  if (Array.isArray(src.quiz)) lesson.quiz = src.quiz.map(repairQuizItem);
  else lesson.quiz = src.quiz;

  if (Array.isArray(src.flashcards)) {
    lesson.flashcards = src.flashcards
      .filter((f) => f && typeof f === "object")
      .map((f) => ({ term: cleanString(f.term), def: cleanString(f.def) }))
      .filter((f) => typeof f.term === "string" && f.term && typeof f.def === "string" && f.def);
  }

  return lesson;
}

// ─────────────────────────────────────────────────────────────────────────────
// Semantic validation on top of the schema — a schema-valid quiz can still
// teach the wrong thing if `a` doesn't identify exactly one option.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate quiz semantics: `a` must equal exactly one option's text, and every
 * option must be a DISTINCT choice. A schema-valid item can still be a lie —
 * four options that are really two means a 1-in-2 guess presented to the
 * learner with the same authority as hand-authored content.
 *
 * @param {object[]} quiz
 * @returns {string[]} errors
 */
export function validateQuizSemantics(quiz) {
  const errors = [];
  (Array.isArray(quiz) ? quiz : []).forEach((item, i) => {
    if (!item || !Array.isArray(item.options)) return; // schema already flagged it
    const matches = item.options.filter((o) => o?.text === item.a).length;
    if (matches === 0) {
      errors.push(`$.quiz[${i}]: answer "a" does not match any option text`);
    } else if (matches > 1) {
      errors.push(`$.quiz[${i}]: answer "a" matches ${matches} options — must match exactly one`);
    }

    // Distinctness, compared the way a learner reads them (trim + case + runs
    // of whitespace). Blank/non-string text is left to the schema.
    const seen = new Map();
    const reported = new Set();
    for (const option of item.options) {
      const key = optionKey(option?.text);
      if (!key) continue;
      if (!seen.has(key)) {
        seen.set(key, option.text);
        continue;
      }
      if (reported.has(key)) continue;
      reported.add(key);
      errors.push(
        `$.quiz[${i}]: options contain duplicate text "${seen.get(key)}" — every option must be a distinct choice`
      );
    }
  });
  return errors;
}

/**
 * Repair + strictly validate a raw generated lesson.
 *
 * @param {unknown} raw - parsed model output
 * @returns {{ ok: true, lesson: object } | { ok: false, errors: string[] }}
 */
export function validateGeneratedLesson(raw) {
  const lesson = repairLesson(raw);
  const errors = [
    ...validateAgainst(lesson, GENERATED_LESSON_SCHEMA),
    ...validateQuizSemantics(lesson.quiz),
  ];
  if (errors.length) return { ok: false, errors };
  return { ok: true, lesson };
}

/**
 * Repair + validate a raw notes summary.
 *
 * @param {unknown} raw
 * @returns {{ ok: true, summary: object } | { ok: false, errors: string[] }}
 */
export function validateSummary(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["$: expected object"] };
  }
  const summary = {
    summary: cleanString(raw.summary),
    keyConcepts: Array.isArray(raw.keyConcepts)
      ? raw.keyConcepts.filter((c) => typeof c === "string" && c.trim()).map((c) => c.trim())
      : [],
    misconceptions: Array.isArray(raw.misconceptions)
      ? raw.misconceptions.filter((c) => typeof c === "string" && c.trim()).map((c) => c.trim())
      : [],
  };
  const errors = validateAgainst(summary, SUMMARY_SCHEMA);
  if (errors.length) return { ok: false, errors };
  return { ok: true, summary };
}

/**
 * Repair + validate an array of quiz items (from generateQuiz).
 *
 * @param {unknown} raw - parsed model output, expected { quiz: [...] }
 * @returns {{ ok: true, quiz: object[] } | { ok: false, errors: string[] }}
 */
export function validateQuizBatch(raw) {
  const list = Array.isArray(raw?.quiz) ? raw.quiz : Array.isArray(raw) ? raw : null;
  if (!list) return { ok: false, errors: ["$: expected { quiz: [...] }"] };
  const repaired = list.map(repairQuizItem);
  const errors = [];
  repaired.forEach((item, i) => {
    errors.push(...validateAgainst(item, QUIZ_ITEM_SCHEMA, `$.quiz[${i}]`));
  });
  errors.push(...validateQuizSemantics(repaired));
  if (errors.length) return { ok: false, errors };
  if (!repaired.length) return { ok: false, errors: ["$.quiz: empty"] };
  return { ok: true, quiz: repaired };
}

// ─────────────────────────────────────────────────────────────────────────────
// Provenance — every accepted artifact records where it came from, so
// generated content is auditable and revertable.
// ─────────────────────────────────────────────────────────────────────────────

function slugify(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "lesson";
}

/**
 * Stamp a validated lesson with an id and provenance. The result slots
 * directly into a data/curriculum.js module's `lessons` array.
 *
 * @param {object} lesson - a validated lesson (validateGeneratedLesson output)
 * @param {{ noteIds?: string[], model?: string, moduleId?: string, promptVersion?: number, now?: number }} meta
 * @returns {object}
 */
export function finalizeGeneratedLesson(lesson, meta = {}) {
  const now = meta.now ?? Date.now();
  return {
    id: `gen-${slugify(lesson.title)}-${now.toString(36)}`,
    ...lesson,
    generated: true,
    provenance: {
      noteIds: Array.isArray(meta.noteIds) ? [...meta.noteIds] : [],
      model: meta.model ?? null,
      moduleId: meta.moduleId ?? null,
      promptVersion: meta.promptVersion ?? null,
      createdAt: new Date(now).toISOString(),
    },
  };
}
