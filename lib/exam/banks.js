// lib/exam/banks.js
// The registry: a cert id -> { blueprint, bank, config }.
//
// This is the seam the question banks plug into, and the only file in
// lib/exam/ that knows data/ exists. Two things it is careful about:
//
// A MISSING BANK IS A FACT, NOT A CRASH.
// EVERY multiple-choice cert is SEEDED with an empty bank here and attached
// from outside via registerBank(). Both banks do exist — data/certs/sie-bank.js
// and data/certs/series65-bank.js — and data/registry.js registers them at
// module load; components/Dashboard.js imports that module, so they are in
// place before any exam UI can render. (Deliberately no item counts here: they
// have already gone 146 -> 300 -> 450, and a comment that has to be edited
// whenever content is authored is a comment that will silently go stale. Ask
// examOffering() if you want the real number.) The indirection is deliberate and is
// NOT a claim that either file is missing: it keeps lib/exam/ from importing
// data/certs/*, so a bank that is absent, thin, or still being written degrades
// honestly instead of breaking the engine at import time. With no bank
// attached, examOffering("sie") honestly reports 0 questions and
// canOfferFullForm: false, and the UI can say "no SIE questions yet" instead of
// exploding or, worse, serving a 3-question form labelled "SIE mock".
// resetExams() reverts to that empty seeded state — tests that want a real bank
// must re-register it.
//
// The rule is about BANK CONTENT, not about data/ as a directory. Blueprints
// and metadata — SIE_BLUEPRINT/SIE_MODULES (section weights, titles, and the
// blueprintSection tags the aliases derive from) and SERIES65_META (name,
// length, clock, passing score, section weights) — are imported directly and
// stay that way: they DEFINE the exam rather than stock it, an exam with no
// blueprint has nothing to degrade to, and there is no seam to attach them
// through. CFI_DRILLS is content, but it is not a question bank: FMVA is
// registered as kind "skills", and registerBank() refuses a skills credential
// by design, so drills have no registration seam either.
//
// CFI IS NOT A MULTIPLE-CHOICE EXAM.
// FMVA is a skills credential. Its assessment is the modelling drills in
// data/certs/cfi-drills.js, graded by lib/guide/ against the real
// spreadsheet engine. Forcing it into the multiple-choice mould would
// misrepresent the credential, so it is registered as kind "skills",
// drawForm() refuses it, and skillsAssessment() is its entry point instead.

import { SIE_BLUEPRINT, SIE_MODULES } from "../../data/certs/sie.js";
import { SERIES65_META } from "../../data/certs/series65.js";
import { CFI_DRILLS } from "../../data/certs/cfi-drills.js";

import {
  ExamError, normalizeBlueprint, allocate, countBySection, maxFaithfulLength,
  drawForm, formFromItems, resolveSection,
} from "./blueprint.js";
import { MODES, EXAM_KINDS, createSession } from "./session.js";
import { missedFormItems } from "./review.js";

/* ─── blueprints ─── */

/**
 * The SIE blueprint, assembled from the published section weights in
 * data/certs/sie.js. The aliases are derived from SIE_MODULES' own
 * blueprintSection tags rather than guessed at, so a bank that tags items
 * with a module id ("sie-muni-risk") resolves to the right section (2)
 * without the bank author having to know this file exists.
 * @returns {import("./blueprint.js").ExamBlueprint}
 */
export function sieBlueprint() {
  return normalizeBlueprint({
    id: "sie",
    name: "SIE",
    scoredQuestions: 75,
    minutes: 105,
    passPct: 70,
    sections: SIE_BLUEPRINT.map((s) => {
      const modules = SIE_MODULES.filter((m) => m.blueprintSection === s.id);
      const aliases = [];
      for (const m of modules) {
        aliases.push(m.id);
        aliases.push(m.id.replace(/^sie-/, ""));
      }
      return { id: String(s.id), label: s.title, weight: s.weight, aliases };
    }),
  });
}

/**
 * The Series 65 blueprint, straight off SERIES65_META.
 * @returns {import("./blueprint.js").ExamBlueprint}
 */
export function series65Blueprint() {
  return normalizeBlueprint({
    id: "series65",
    name: SERIES65_META.name,
    scoredQuestions: SERIES65_META.scoredQuestions,
    minutes: SERIES65_META.minutesAllotted,
    passPct: SERIES65_META.passingScore,
    sections: SERIES65_META.sections.map((s) => ({
      id: s.id,
      label: s.label,
      weight: s.weightPct / 100,
      aliases: [],
    })),
  });
}

/* ─── the registry ─── */

/** @type {Map<string, object>} */
const REGISTRY = new Map();

function defineExam(def) {
  REGISTRY.set(def.certId, def);
  return def;
}

function seed() {
  REGISTRY.clear();

  defineExam({
    certId: "sie",
    name: "SIE",
    fullName: "Securities Industry Essentials",
    kind: EXAM_KINDS.MULTIPLE_CHOICE,
    blueprint: sieBlueprint(),
    // Empty until the integrator calls registerBank("sie", SIE_BANK) —
    // data/registry.js does. Everything below degrades honestly until then.
    bank: [],
    config: { unscoredPretest: 0 },
  });

  defineExam({
    certId: "series65",
    name: SERIES65_META.name,
    fullName: SERIES65_META.fullName,
    kind: EXAM_KINDS.MULTIPLE_CHOICE,
    blueprint: series65Blueprint(),
    // Same seam as SIE: empty until registerBank("series65", SERIES65_BANK).
    bank: [],
    config: { unscoredPretest: SERIES65_META.unscoredPretest, passingCount: SERIES65_META.passingCount },
  });

  defineExam({
    certId: "cfi",
    name: "CFI / FMVA",
    fullName: "Financial Modeling & Valuation Analyst",
    kind: EXAM_KINDS.SKILLS,
    blueprint: null,
    bank: [],
    drills: CFI_DRILLS,
    config: {
      gradedBy: "lib/guide",
      note:
        "FMVA is a skills credential, not a proctored multiple-choice exam. There is no form to draw and no " +
        "pass percentage to simulate — you are assessed on whether the model you build is right.",
    },
  });
}

seed();

/** Restore the registry to its built-in state. Mainly for tests. */
export function resetExams() {
  seed();
}

/** Every registered cert id. */
export function listExams() {
  return [...REGISTRY.values()].map((e) => ({
    certId: e.certId,
    name: e.name,
    fullName: e.fullName,
    kind: e.kind,
  }));
}

/**
 * Resolve a cert id to its definition.
 * @param {string} certId
 * @returns {{certId: string, name: string, fullName: string, kind: string, blueprint: import("./blueprint.js").ExamBlueprint|null, bank: object[], drills?: object[], config: object}}
 */
export function getExam(certId) {
  const def = REGISTRY.get(String(certId));
  if (!def) throw new ExamError(`no exam registered for cert: ${certId}`, "UNKNOWN_CERT");
  return def;
}

/** True when a cert id is registered. */
export function hasExam(certId) {
  return REGISTRY.has(String(certId));
}

/**
 * Attach (or replace) a question bank. This is how data/certs/sie-bank.js
 * plugs in once it exists, without lib/exam/ importing a file that might not.
 * Returns the resulting offering so the caller can see immediately what the
 * bank can actually support.
 * @param {string} certId
 * @param {object[]} items
 * @returns {ReturnType<typeof examOffering>}
 */
export function registerBank(certId, items) {
  const def = getExam(certId);
  if (def.kind !== EXAM_KINDS.MULTIPLE_CHOICE) {
    throw new ExamError(`${certId} is a ${def.kind} credential — it has no question bank`, "NOT_MULTIPLE_CHOICE");
  }
  if (!Array.isArray(items)) throw new ExamError(`bank for ${certId} must be an array`, "BAD_BANK");
  defineExam({ ...def, bank: items });
  return examOffering(certId);
}

function assertMultipleChoice(def) {
  if (def.kind !== EXAM_KINDS.MULTIPLE_CHOICE) {
    throw new ExamError(
      `${def.certId} is a skills credential, not a multiple-choice exam — use skillsAssessment("${def.certId}") instead. ${def.config?.note ?? ""}`.trim(),
      "NOT_MULTIPLE_CHOICE",
    );
  }
}

/* ─── what can this cert actually offer right now? ─── */

/**
 * @typedef {object} ExamReuse
 * @property {number} formsSupported exact full forms the bank can fill without
 *   repeating an item — the binding section's available/quota ratio (fractional)
 * @property {number} distinctFullForms floor(formsSupported): full forms drawable
 *   with no question seen twice
 * @property {string[]} bindingSections the section ids that cap it
 * @property {string} note learner-facing; "" when there is nothing to warn about
 */

/**
 * How many blueprint-faithful full forms this bank can fill before it must
 * start repeating questions.
 *
 * A form is only as deep as its thinnest section: the SIE bank's 146 items look
 * like plenty against a 75-question form, but section 3 holds 44 against a
 * 23-question quota, so the bank runs out of unseen trading questions after
 * 1.91 forms. The second mock recycles; the third is almost entirely questions
 * the learner has already answered — and a score on remembered questions
 * measures memory, not knowledge. That is exactly the false confidence this
 * engine exists to prevent, so it is reported rather than left to be discovered.
 *
 * We report and let the learner decide. We do NOT cap or refuse: a third mock
 * is a legitimate thing to want. They just have to know what it is worth.
 *
 * This is deliberately kept OUT of `notes`, which is about whether a form can
 * be drawn to the blueprint at all. Exhaustion is an orthogonal fact — a bank
 * can be perfectly faithful and still be out of unseen questions — and the two
 * warnings answer different questions.
 *
 * @param {import("./blueprint.js").ExamBlueprint} bp
 * @param {Array<{id: string, label: string, quota: number, available: number}>} sections
 * @returns {ExamReuse}
 */
function reuseInventory(bp, sections) {
  const constrained = sections.filter((s) => s.quota > 0);
  if (!constrained.length) {
    return { formsSupported: 0, distinctFullForms: 0, bindingSections: [], note: "" };
  }

  const ratio = (s) => s.available / s.quota;
  const formsSupported = Math.min(...constrained.map(ratio));
  const distinctFullForms = Math.floor(formsSupported);
  // Float division: compare within a tolerance rather than by equality.
  const binding = constrained.filter((s) => Math.abs(ratio(s) - formsSupported) < 1e-9);

  // Silent at 0 (the bank cannot fill one full form — `notes` already says so,
  // and saying it twice in different words reads as two different problems)
  // and at 2+ (two clean sittings is enough to be worth trusting).
  let note = "";
  if (distinctFullForms === 1) {
    const worst = binding[0];
    note =
      `This bank can fill one ${bp.scoredQuestions}-question form without repeating a question, but not two: ` +
      `${binding.map((s) => s.label).join(" and ")} ` +
      `${binding.length > 1 ? "hold" : "holds"} ${worst.available} question(s) against a ${worst.quota}-question quota. ` +
      `A second full form will reuse questions you have already answered, and a third is almost entirely recycled. ` +
      `You can still sit them — just score them knowing that a remembered answer is not a known one.`;
  }

  return { formsSupported, distinctFullForms, bindingSections: binding.map((s) => s.id), note };
}

/**
 * An honest inventory: what this cert can serve given the bank it currently
 * has. A UI should drive its mode buttons off `modes[].available` rather
 * than assuming a full mock is always possible.
 *
 * @param {string} certId
 * @returns {object}
 */
export function examOffering(certId) {
  const def = getExam(certId);

  if (def.kind === EXAM_KINDS.SKILLS) {
    return {
      certId: def.certId,
      name: def.name,
      kind: def.kind,
      available: (def.drills ?? []).length,
      drills: (def.drills ?? []).length,
      sections: [],
      canOfferFullForm: false,
      maxFaithfulLength: 0,
      modes: [],
      // A skills credential has no form, so there is nothing to exhaust.
      reuse: null,
      notes: [def.config?.note ?? ""],
    };
  }

  const bp = def.blueprint;
  const have = countBySection(bp, def.bank);
  const quotas = allocate(bp, bp.scoredQuestions);
  const best = maxFaithfulLength(bp, def.bank);
  const available = Object.values(have).reduce((a, b) => a + b, 0);

  const sections = bp.sections.map((s) => ({
    id: s.id,
    label: s.label,
    weight: s.weight,
    quota: quotas[s.id],
    available: have[s.id] ?? 0,
    short: Math.max(0, quotas[s.id] - (have[s.id] ?? 0)),
  }));

  const notes = [];
  if (available === 0) {
    notes.push(`No ${def.name} questions are loaded yet, so no ${def.name} exam can be offered. Nothing here is broken — the bank is simply empty.`);
  } else if (best < bp.scoredQuestions) {
    notes.push(
      `The bank can fill a blueprint-faithful form of at most ${best} questions, not the real ${bp.scoredQuestions}. ` +
      `A full-length mock would have to under-sample ${sections.filter((s) => s.short).map((s) => s.label).join(", ")}, ` +
      `so it is offered short and labelled indicative rather than mis-weighted and labelled real.`,
    );
  }
  for (const s of sections.filter((x) => x.available === 0 && available > 0)) {
    notes.push(`${s.label} has no questions in the bank at all, and it is ${Math.round(s.weight * 100)}% of the real exam.`);
  }

  const modes = Object.values(MODES).map((m) => {
    const count = m.id === "warmup" ? m.count : m.fullLength ? bp.scoredQuestions : null;
    let modeAvailable = available > 0;
    if (m.id === "mock") modeAvailable = best > 0;
    if (m.id === "warmup") modeAvailable = maxFaithfulLength(bp, def.bank, { cap: m.count }) === m.count;
    if (m.id === "retry") modeAvailable = false; // needs a previous attempt, not a bank
    return {
      id: m.id,
      label: m.label,
      description: m.description,
      available: modeAvailable,
      count,
      faithful: m.id === "mock" ? best === bp.scoredQuestions : undefined,
    };
  });

  return {
    certId: def.certId,
    name: def.name,
    kind: def.kind,
    available,
    sections,
    canOfferFullForm: best === bp.scoredQuestions,
    maxFaithfulLength: best,
    reuse: reuseInventory(bp, sections),
    scoredQuestions: bp.scoredQuestions,
    minutes: bp.minutes,
    passPct: bp.passPct,
    modes,
    notes,
  };
}

/* ─── building sittings ─── */

/** Minutes to allow for a form of `count` questions, at the real exam's pace. */
function paceMinutes(bp, count) {
  if (!bp.minutes || !bp.scoredQuestions) return 0;
  return Math.max(1, Math.round((bp.minutes / bp.scoredQuestions) * count));
}

/**
 * Draw a form and start a sitting in one call. The normal entry point.
 *
 * Modes:
 *   mock    — full length, real clock, no pause
 *   section — one section, proportional clock (pass `sectionId`)
 *   warmup  — 10 blueprint-weighted questions
 *   retry   — see buildRetrySession(); needs a previous attempt
 *
 * @param {object} opts
 * @param {string} opts.certId
 * @param {string} [opts.mode]
 * @param {string|number} [opts.sectionId] required for mode "section"
 * @param {number} [opts.count] override the mode's length
 * @param {string|number} [opts.seed] same seed + same bank = same form
 * @param {string[]} [opts.exclude] recently-seen item ids to avoid where possible
 * @param {Date|number|string} [opts.now]
 * @param {boolean} [opts.shuffleOptions]
 * @returns {object} session
 */
export function buildSession(opts = {}) {
  const def = getExam(opts.certId);
  assertMultipleChoice(def);

  const mode = opts.mode ?? "mock";
  const modeDef = MODES[mode];
  if (!modeDef) throw new ExamError(`unknown exam mode: ${mode}`, "UNKNOWN_MODE");
  if (mode === "retry") {
    throw new ExamError("a retry form is built from a previous attempt — call buildRetrySession(session)", "NEEDS_ATTEMPT");
  }

  const bp = def.blueprint;
  let sections = null;
  let count = opts.count;

  if (mode === "section") {
    if (opts.sectionId === undefined || opts.sectionId === null) {
      throw new ExamError("mode \"section\" needs a sectionId", "NEEDS_SECTION");
    }
    const section = resolveSection(bp, opts.sectionId);
    if (!section) throw new ExamError(`unknown section for ${def.certId}: ${opts.sectionId}`, "UNKNOWN_SECTION");
    sections = [section.id];
    // Default a section drill to that section's real share of a full form.
    count = count ?? allocate(bp, bp.scoredQuestions)[section.id];
  } else if (mode === "warmup") {
    count = count ?? modeDef.count;
  } else {
    count = count ?? bp.scoredQuestions;
  }

  const form = drawForm({
    blueprint: bp,
    bank: def.bank,
    count,
    seed: opts.seed ?? 1,
    sections,
    exclude: opts.exclude ?? [],
    shuffleOptions: opts.shuffleOptions,
  });

  // The clock follows the form we could actually draw, not the one we
  // wanted: 105 minutes for a 12-question SIE form would be a fake.
  const minutes = modeDef.timed
    ? (mode === "mock" && form.faithful && form.length === bp.scoredQuestions ? bp.minutes : paceMinutes(bp, form.length))
    : null;

  return createSession({
    form,
    mode,
    minutes: minutes ?? undefined,
    limitMs: modeDef.timed ? undefined : null,
    now: opts.now,
  });
}

/**
 * Build a retry sitting from the questions a previous attempt missed.
 * Untimed by design -- this one is for learning, and a clock on a
 * re-read of your own mistakes only adds noise.
 * @param {object} session a previous (usually submitted) session
 * @param {{seed?: string|number, now?: Date|number|string}} [opts]
 * @returns {object} session
 */
export function buildRetrySession(session, opts = {}) {
  const items = missedFormItems(session);
  if (items.length === 0) {
    throw new ExamError("nothing to retry — every question on that form was answered correctly", "NOTHING_MISSED");
  }
  const form = formFromItems(items, session.form.blueprint, {
    seed: opts.seed ?? `retry:${session.id}`,
    note: "Only the questions you missed — deliberately your weak spots, so its percentage is not comparable to a mock.",
  });
  return createSession({ form, mode: "retry", limitMs: null, now: opts.now });
}

/**
 * The CFI/FMVA assessment: modelling drills, not a form.
 * Returns descriptors only -- grading is lib/guide/'s job against the real
 * spreadsheet engine, and duplicating any of it here would create a second
 * source of truth for whether a model is right.
 * @param {string} [certId]
 * @returns {{certId: string, kind: string, gradedBy: string, note: string, totalMinutes: number, drills: Array<{id: string, title: string, moduleId: string, minutes: number, scenario: string}>}}
 */
export function skillsAssessment(certId = "cfi") {
  const def = getExam(certId);
  if (def.kind !== EXAM_KINDS.SKILLS) {
    throw new ExamError(`${certId} is a multiple-choice exam — use buildSession() instead`, "NOT_SKILLS");
  }
  const drills = def.drills ?? [];
  return {
    certId: def.certId,
    kind: def.kind,
    gradedBy: def.config.gradedBy,
    note: def.config.note,
    totalMinutes: drills.reduce((a, d) => a + (d.minutes ?? 0), 0),
    drills: drills.map((d) => ({
      id: d.id,
      title: d.title,
      moduleId: d.moduleId,
      minutes: d.minutes,
      scenario: d.scenario,
    })),
  };
}
