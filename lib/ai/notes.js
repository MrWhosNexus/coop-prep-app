// lib/ai/notes.js
// Pure note model for the AI note-taker. Operates on the `notes` slice from
// lib/store/schema.js: id -> { id, lessonId, body, tags, createdAt, updatedAt }.
// (schema.js documents { id, lessonId, body, createdAt, updatedAt }; this model
// adds an optional `tags: string[]` and treats records without it as tagless.)
//
// Every function is pure: takes the notes map, returns a NEW map, never mutates.
// Timestamps are epoch milliseconds and injectable so tests are deterministic.
// No DOM, no Electron, no network. Importable under `node --test`.

/**
 * Normalize a tag list: strings only, trimmed, lowercased, deduped, no empties.
 *
 * @param {unknown} tags
 * @returns {string[]}
 */
export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of tags) {
    if (typeof raw !== "string") continue;
    const tag = raw.trim().toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/**
 * Generate a note id that is unique within `notes`.
 *
 * @param {Record<string, object>} notes
 * @param {number} now - epoch ms
 * @param {() => number} rand - injectable Math.random
 * @returns {string}
 */
export function makeNoteId(notes, now, rand = Math.random) {
  for (;;) {
    const suffix = Math.floor(rand() * 36 ** 4)
      .toString(36)
      .padStart(4, "0");
    const id = `note-${now.toString(36)}-${suffix}`;
    if (!notes || !(id in notes)) return id;
  }
}

/**
 * Create a note. Throws on an empty body — the UI guards before calling.
 *
 * @param {Record<string, object>} notes - current notes slice
 * @param {{ lessonId?: string|null, body: string, tags?: string[] }} input
 * @param {number} [now] - epoch ms, injectable for tests
 * @param {() => number} [rand]
 * @returns {{ notes: Record<string, object>, note: object }} new slice + the created note
 */
export function createNote(notes, input, now = Date.now(), rand = Math.random) {
  const body = typeof input?.body === "string" ? input.body.trim() : "";
  if (!body) throw new Error("createNote: note body is required");
  const base = notes && typeof notes === "object" ? notes : {};
  const note = {
    id: makeNoteId(base, now, rand),
    lessonId: typeof input.lessonId === "string" && input.lessonId ? input.lessonId : null,
    body,
    tags: normalizeTags(input.tags),
    createdAt: now,
    updatedAt: now,
  };
  return { notes: { ...base, [note.id]: note }, note };
}

/**
 * Patch a note's body / lessonId / tags. Unknown ids return the map unchanged.
 *
 * @param {Record<string, object>} notes
 * @param {string} id
 * @param {{ body?: string, lessonId?: string|null, tags?: string[] }} patch
 * @param {number} [now]
 * @returns {Record<string, object>}
 */
export function updateNote(notes, id, patch, now = Date.now()) {
  const base = notes && typeof notes === "object" ? notes : {};
  const existing = base[id];
  if (!existing) return base;

  const next = { ...existing, updatedAt: now };
  if (typeof patch?.body === "string" && patch.body.trim()) next.body = patch.body.trim();
  if ("lessonId" in (patch ?? {})) {
    next.lessonId = typeof patch.lessonId === "string" && patch.lessonId ? patch.lessonId : null;
  }
  if ("tags" in (patch ?? {})) next.tags = normalizeTags(patch.tags);

  return { ...base, [id]: next };
}

/**
 * Delete a note. Unknown ids return the map unchanged.
 *
 * @param {Record<string, object>} notes
 * @param {string} id
 * @returns {Record<string, object>}
 */
export function deleteNote(notes, id) {
  const base = notes && typeof notes === "object" ? notes : {};
  if (!(id in base)) return base;
  const { [id]: _removed, ...rest } = base;
  return rest;
}

/**
 * List notes as an array, newest-updated first, optionally filtered.
 *
 * @param {Record<string, object>} notes
 * @param {{ lessonId?: string|null, tag?: string }} [filter]
 * @returns {object[]}
 */
export function listNotes(notes, filter = {}) {
  const base = notes && typeof notes === "object" ? notes : {};
  let arr = Object.values(base);
  if ("lessonId" in filter) {
    arr = arr.filter((n) => (n.lessonId ?? null) === (filter.lessonId ?? null));
  }
  if (typeof filter.tag === "string" && filter.tag) {
    const tag = filter.tag.trim().toLowerCase();
    arr = arr.filter((n) => Array.isArray(n.tags) && n.tags.includes(tag));
  }
  return arr.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

/**
 * Full-text search over note bodies and tags.
 * Scoring: +3 per exact tag match, +2 per body occurrence of each query token.
 *
 * @param {Record<string, object>} notes
 * @param {string} query
 * @returns {{ note: object, score: number }[]} sorted best-first; [] for empty query
 */
export function searchNotes(notes, query) {
  const tokens = (typeof query === "string" ? query : "")
    .toLowerCase()
    .split(/[^a-z0-9%$§.-]+/)
    .filter((t) => t.length > 1);
  if (!tokens.length) return [];

  const results = [];
  for (const note of Object.values(notes && typeof notes === "object" ? notes : {})) {
    const body = String(note.body ?? "").toLowerCase();
    const tags = Array.isArray(note.tags) ? note.tags : [];
    let score = 0;
    for (const token of tokens) {
      if (tags.includes(token)) score += 3;
      let idx = body.indexOf(token);
      while (idx !== -1) {
        score += 2;
        idx = body.indexOf(token, idx + token.length);
      }
    }
    if (score > 0) results.push({ note, score });
  }
  return results.sort(
    (a, b) => b.score - a.score || (b.note.updatedAt ?? 0) - (a.note.updatedAt ?? 0)
  );
}

/**
 * Per-lesson note counts plus the total. Notes without a lesson land under "".
 *
 * @param {Record<string, object>} notes
 * @returns {{ total: number, byLesson: Record<string, number> }}
 */
export function noteStats(notes) {
  const byLesson = {};
  let total = 0;
  for (const note of Object.values(notes && typeof notes === "object" ? notes : {})) {
    total += 1;
    const key = note.lessonId ?? "";
    byLesson[key] = (byLesson[key] ?? 0) + 1;
  }
  return { total, byLesson };
}

/**
 * Every tag in use, alphabetized.
 *
 * @param {Record<string, object>} notes
 * @returns {string[]}
 */
export function allTags(notes) {
  const set = new Set();
  for (const note of Object.values(notes && typeof notes === "object" ? notes : {})) {
    for (const tag of Array.isArray(note.tags) ? note.tags : []) set.add(tag);
  }
  return [...set].sort();
}
