// lib/exam/blueprint.js
// Blueprint-weighted form sampling.
//
// A real SIE or Series 65 form is not a random draw from a question pool --
// it is a draw that matches the published section weights. This file is the
// only place that decides which items end up on a form, and it holds one
// rule above convenience:
//
//   A section that cannot fill its quota makes the form SHORTER. It never
//   makes another section BIGGER.
//
// Over-drawing a well-stocked section to hide a thin one would produce a
// form that looks full-length and scores like the real exam while testing a
// distribution the real exam does not use. That is a lie with a percentage
// attached to it. Instead every draw reports `faithful` and an explicit
// `shortfalls` list, and every downstream consumer (scoring.js, review.js)
// carries that honesty through to the verdict.
//
// Determinism: every draw is seeded. The same seed + the same bank always
// produces the same form, in the same order, with the same option ordering,
// which is what makes a practice form reproducible and this file testable.

import { makeRng, shuffle } from "../games/generators.js";

/** Error thrown for a misuse of the exam engine (unknown section, bad option index, ...). */
export class ExamError extends Error {
  /**
   * @param {string} message
   * @param {string} [code] machine-readable code, e.g. "UNKNOWN_SECTION"
   */
  constructor(message, code = "EXAM_ERROR") {
    super(message);
    this.name = "ExamError";
    this.code = code;
  }
}

/**
 * Hash any seed value to a uint32, so a seed can be a readable string
 * ("s65-mock-1") rather than a magic number. FNV-1a.
 * @param {string|number} seed
 * @returns {number} uint32
 */
export function hashSeed(seed) {
  const s = String(seed);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** An rng derived from a seed plus a namespace, so each stage of a draw is independent but reproducible. */
function rngFor(seed, ns) {
  return makeRng(hashSeed(`${seed}::${ns}`));
}

/* ─── blueprints ─── */

/**
 * @typedef {object} BlueprintSection
 * @property {string} id
 * @property {string} label
 * @property {number} weight fraction of the scored form (weights are normalised, not required to sum to 1)
 * @property {string[]} aliases other ids a bank item might legitimately use for this section
 */

/**
 * @typedef {object} ExamBlueprint
 * @property {string} id cert id, e.g. "series65"
 * @property {string} name
 * @property {number} scoredQuestions length of a real full-length form
 * @property {number} minutes real time limit
 * @property {number} passPct pass mark, as a percentage (72 = 72%)
 * @property {BlueprintSection[]} sections
 * @property {boolean} normalized
 */

/**
 * Coerce a cert's published blueprint into the canonical shape this engine
 * uses. Accepts `weight` (a fraction) or `weightPct`, `label` or `title`,
 * numeric or string section ids. Idempotent.
 * @param {object} input
 * @returns {ExamBlueprint}
 */
export function normalizeBlueprint(input) {
  if (!input || typeof input !== "object") throw new ExamError("blueprint is required", "BAD_BLUEPRINT");
  if (input.normalized) return /** @type {ExamBlueprint} */ (input);

  const sections = Array.isArray(input.sections) ? input.sections : null;
  if (!sections || sections.length === 0) throw new ExamError("blueprint has no sections", "BAD_BLUEPRINT");

  const out = sections.map((s) => {
    const weight = s.weight != null ? Number(s.weight) : Number(s.weightPct) / 100;
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new ExamError(`section ${s.id} has no usable weight`, "BAD_BLUEPRINT");
    }
    return {
      id: String(s.id),
      label: String(s.label ?? s.title ?? s.id),
      weight,
      aliases: (s.aliases ?? []).map(String),
    };
  });

  const ids = new Set();
  for (const s of out) {
    if (ids.has(s.id)) throw new ExamError(`duplicate section id: ${s.id}`, "BAD_BLUEPRINT");
    ids.add(s.id);
  }

  const passPct = Number(input.passPct ?? input.passingScore);
  const scoredQuestions = Math.round(Number(input.scoredQuestions));
  const minutes = Number(input.minutes ?? input.minutesAllotted);
  if (!Number.isFinite(scoredQuestions) || scoredQuestions <= 0) {
    throw new ExamError("blueprint needs a positive scoredQuestions", "BAD_BLUEPRINT");
  }
  if (!Number.isFinite(passPct) || passPct <= 0 || passPct > 100) {
    throw new ExamError("blueprint needs a passPct in (0, 100]", "BAD_BLUEPRINT");
  }

  return {
    id: String(input.id),
    name: String(input.name ?? input.id),
    scoredQuestions,
    minutes: Number.isFinite(minutes) ? minutes : 0,
    passPct,
    sections: out,
    normalized: true,
  };
}

/**
 * Look up a blueprint section by its id, its label, or any alias a bank
 * might tag its items with. Returns null when nothing matches -- an unknown
 * section is reported, never guessed at.
 * @param {ExamBlueprint} blueprint
 * @param {string|number} key
 * @returns {BlueprintSection|null}
 */
export function resolveSection(blueprint, key) {
  const bp = normalizeBlueprint(blueprint);
  if (key === undefined || key === null) return null;
  const want = String(key).trim().toLowerCase();
  for (const s of bp.sections) {
    if (s.id.toLowerCase() === want) return s;
    if (s.label.toLowerCase() === want) return s;
    if (s.aliases.some((a) => a.toLowerCase() === want)) return s;
  }
  return null;
}

/**
 * Split `total` questions across sections in blueprint proportion using the
 * largest-remainder method: floor every exact share, then hand the leftover
 * questions to the largest fractional parts, ties broken by blueprint order.
 * The result always sums to exactly `total`.
 *
 * This reproduces the published per-section counts exactly: SIE 75 ->
 * 12/33/23/7, Series 65 130 -> 20/32/39/39.
 *
 * @param {ExamBlueprint|object} blueprint
 * @param {number} total
 * @param {{only?: Array<string|number>}} [opts] restrict to these sections (a section drill)
 * @returns {Object<string, number>} section id -> question count
 */
export function allocate(blueprint, total, opts = {}) {
  const bp = normalizeBlueprint(blueprint);
  let sections = bp.sections;

  if (opts.only) {
    const wanted = [];
    for (const key of opts.only) {
      const hit = resolveSection(bp, key);
      if (!hit) throw new ExamError(`unknown section for ${bp.id}: ${key}`, "UNKNOWN_SECTION");
      if (!wanted.includes(hit)) wanted.push(hit);
    }
    sections = wanted;
  }

  const n = Math.max(0, Math.round(Number(total) || 0));
  const sum = sections.reduce((a, s) => a + s.weight, 0);
  const exact = sections.map((s) => (s.weight / sum) * n);
  const counts = exact.map((x) => Math.floor(x));

  let left = n - counts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => (b.frac === a.frac ? a.i - b.i : b.frac - a.frac));
  for (let k = 0; left > 0; k++, left--) counts[order[k % order.length].i] += 1;

  const out = {};
  sections.forEach((s, i) => { out[s.id] = counts[i]; });
  return out;
}

/* ─── bank items ─── */

/**
 * True when an item can actually be presented and graded: it needs an id, a
 * question, options, and an answer that is genuinely one of those options.
 * An item whose `a` matches no option is ungradeable and is dropped from
 * every draw rather than silently marked wrong forever.
 * @param {object} item
 * @returns {boolean}
 */
export function isGradeableItem(item) {
  if (!item || typeof item !== "object") return false;
  if (!item.id || !item.q) return false;
  if (!Array.isArray(item.options) || item.options.length < 2) return false;
  return item.options.some((o) => o && o.text === item.a);
}

/** The section tag of a bank item, tolerating the field names the cert banks use. */
function sectionKeyOf(item) {
  return item.section ?? item.sectionId ?? item.blueprintSection;
}

/**
 * Group a bank by blueprint section, reporting anything unusable.
 * @param {ExamBlueprint|object} blueprint
 * @param {object[]} bank
 * @returns {{pool: Map<string, object[]>, ungradeable: string[], unknownSection: string[]}}
 */
export function indexBank(blueprint, bank) {
  const bp = normalizeBlueprint(blueprint);
  const pool = new Map(bp.sections.map((s) => [s.id, []]));
  const ungradeable = [];
  const unknownSection = [];

  for (const item of Array.isArray(bank) ? bank : []) {
    if (!isGradeableItem(item)) {
      ungradeable.push(item && item.id ? String(item.id) : "<no id>");
      continue;
    }
    const section = resolveSection(bp, sectionKeyOf(item));
    if (!section) {
      unknownSection.push(String(item.id));
      continue;
    }
    pool.get(section.id).push(item);
  }

  // Stable input order in, stable order out -- the rng below is the only
  // source of randomness, so a bank reorder can't silently change a form.
  for (const list of pool.values()) list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { pool, ungradeable, unknownSection };
}

/**
 * How many gradeable items the bank actually holds per section.
 * @param {ExamBlueprint|object} blueprint
 * @param {object[]} bank
 * @returns {Object<string, number>}
 */
export function countBySection(blueprint, bank) {
  const { pool } = indexBank(blueprint, bank);
  const out = {};
  for (const [id, list] of pool) out[id] = list.length;
  return out;
}

/**
 * The longest form this bank can fill while staying exactly on blueprint.
 * Counts down from `cap` (default: a real full-length form) and returns the
 * first length whose every section quota is stocked. 0 means not even a
 * one-question faithful form is possible.
 * @param {ExamBlueprint|object} blueprint
 * @param {object[]} bank
 * @param {{cap?: number, only?: Array<string|number>}} [opts]
 * @returns {number}
 */
export function maxFaithfulLength(blueprint, bank, opts = {}) {
  const bp = normalizeBlueprint(blueprint);
  const have = countBySection(bp, bank);
  const cap = Math.max(0, Math.round(opts.cap ?? bp.scoredQuestions));
  for (let n = cap; n > 0; n--) {
    const quotas = allocate(bp, n, opts);
    if (Object.entries(quotas).every(([id, q]) => (have[id] ?? 0) >= q)) return n;
  }
  return 0;
}

/**
 * Freeze one bank item into a form item: options in a fixed (optionally
 * shuffled) order with the correct index resolved once, so nothing
 * downstream has to re-derive the answer key from the `a` string.
 */
function resolveItem(item, section, seed, shuffleOptions) {
  const options = shuffleOptions
    ? shuffle(item.options, rngFor(seed, `opt:${item.id}`))
    : [...item.options];
  return {
    id: String(item.id),
    section: section.id,
    sectionLabel: section.label,
    q: item.q,
    options: options.map((o) => ({ text: o.text, explanation: o.explanation ?? "" })),
    correctIndex: options.findIndex((o) => o.text === item.a),
    correctText: item.a,
    explanation: item.explanation ?? "",
  };
}

/**
 * @typedef {object} ExamForm
 * @property {string} certId
 * @property {string|number} seed
 * @property {number} requested how many questions were asked for
 * @property {number} length how many the bank could actually supply
 * @property {object[]} items resolved form items, in presentation order
 * @property {Object<string, number>} quotas the blueprint-faithful target per section
 * @property {Object<string, number>} bySection what was actually drawn per section
 * @property {Array<{section: string, label: string, quota: number, drawn: number, short: number}>} shortfalls
 * @property {boolean} faithful true only when every section quota was met exactly
 * @property {string[]} warnings human-readable, user-facing honesty
 * @property {ExamBlueprint} blueprint carried along so a session is self-contained after a reload
 */

/**
 * Draw a blueprint-faithful form.
 *
 * @param {object} opts
 * @param {ExamBlueprint|object} opts.blueprint
 * @param {object[]} opts.bank
 * @param {number} [opts.count] defaults to a real full-length form
 * @param {string|number} [opts.seed]
 * @param {Array<string|number>} [opts.sections] restrict to these sections (section drill)
 * @param {string[]} [opts.exclude] recently-seen item ids, avoided where the bank allows
 * @param {boolean} [opts.shuffleOptions]
 * @returns {ExamForm}
 */
export function drawForm(opts = {}) {
  const bp = normalizeBlueprint(opts.blueprint);
  const seed = opts.seed ?? 1;
  const count = Math.max(0, Math.round(opts.count ?? bp.scoredQuestions));
  const shuffleOptions = opts.shuffleOptions !== false;
  const only = opts.sections ?? null;

  const quotas = allocate(bp, count, only ? { only } : {});
  const { pool, ungradeable, unknownSection } = indexBank(bp, opts.bank);
  const exclude = new Set(opts.exclude ?? []);

  const warnings = [];
  const shortfalls = [];
  const drawn = [];

  for (const section of bp.sections) {
    const quota = quotas[section.id];
    if (!quota) continue;
    const available = pool.get(section.id) ?? [];
    const rng = rngFor(seed, `sec:${section.id}`);
    // Prefer items the learner hasn't just seen; fall back to seen ones only
    // when the bank is too thin to avoid them. Recency is a preference, a
    // short section is a defect -- so it never costs us a quota.
    const fresh = shuffle(available.filter((i) => !exclude.has(i.id)), rng);
    const seen = shuffle(available.filter((i) => exclude.has(i.id)), rng);
    const take = [...fresh, ...seen].slice(0, quota);

    if (take.length < quota) {
      shortfalls.push({
        section: section.id,
        label: section.label,
        quota,
        drawn: take.length,
        short: quota - take.length,
      });
    }
    for (const item of take) drawn.push({ item, section });
  }

  const ordered = shuffle(drawn, rngFor(seed, "order"));
  const items = ordered.map(({ item, section }) => resolveItem(item, section, seed, shuffleOptions));

  const bySection = {};
  for (const id of Object.keys(quotas)) bySection[id] = 0;
  for (const it of items) bySection[it.section] = (bySection[it.section] ?? 0) + 1;

  for (const s of shortfalls) {
    warnings.push(
      `${s.label}: the bank holds only ${s.drawn} of the ${s.quota} questions this section is worth. ` +
      `This form is ${s.short} question(s) short there rather than over-drawing another section.`,
    );
  }
  if (ungradeable.length) {
    warnings.push(`${ungradeable.length} bank item(s) were skipped as ungradeable (no option matches their answer): ${ungradeable.join(", ")}.`);
  }
  if (unknownSection.length) {
    warnings.push(`${unknownSection.length} bank item(s) were skipped: their section tag matches no ${bp.id} blueprint section: ${unknownSection.join(", ")}.`);
  }

  const faithful = shortfalls.length === 0 && items.length === count;
  if (!faithful && items.length > 0) {
    warnings.push(`This form is ${items.length} questions, not the ${count} requested — treat the score as indicative, not as a real ${bp.name} result.`);
  }

  return {
    certId: bp.id,
    seed,
    requested: count,
    length: items.length,
    items,
    quotas,
    bySection,
    shortfalls,
    faithful,
    warnings,
    blueprint: bp,
  };
}

/**
 * Wrap already-resolved items (e.g. the ones a learner missed last time)
 * into a form. Never claims to be blueprint-faithful, because it isn't --
 * it is deliberately biased toward the learner's weak spots.
 * @param {object[]} items resolved form items, as produced by drawForm
 * @param {ExamBlueprint|object} blueprint
 * @param {{seed?: string|number, note?: string}} [opts]
 * @returns {ExamForm}
 */
export function formFromItems(items, blueprint, opts = {}) {
  const bp = normalizeBlueprint(blueprint);
  const seed = opts.seed ?? 1;
  const list = shuffle(items ?? [], rngFor(seed, "order"));
  const bySection = {};
  for (const it of list) bySection[it.section] = (bySection[it.section] ?? 0) + 1;
  return {
    certId: bp.id,
    seed,
    requested: list.length,
    length: list.length,
    items: list,
    quotas: { ...bySection },
    bySection,
    shortfalls: [],
    faithful: false,
    warnings: [opts.note ?? "A targeted form, not a blueprint-weighted one — its score is not comparable to a mock."],
    blueprint: bp,
  };
}
