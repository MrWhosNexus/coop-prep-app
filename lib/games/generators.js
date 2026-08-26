// lib/games/generators.js
// Build game rounds out of the curriculum that already exists.
//
// The design rule this file exists to enforce: no game may require content
// authored for that game. Every round below is derived from the shapes
// data/curriculum.js already has --
//
//   quiz item  { q, a, explanation, options: [{ text, explanation }] }
//   flashcard  { term, def }
//
// -- so adding a lesson lights up every game for free, and adding a game
// lights it up across every lesson. Nothing here writes to curriculum.js.
//
// Two shapes are mined rather than declared:
//   * extractFormulas() scrapes real Excel formulas out of lesson prose and
//     quiz answers, which is where they already live, and tokenizes them for
//     FormulaBuilder.
//   * buildFourFifthsWorkbook()/injectBug() construct a real sheet with the
//     verified HMDA numbers and break it with a real, classic Excel bug.
//     ErrorHunt then checks the learner's fix by actually evaluating it in
//     lib/sheet -- never by string-comparing against a stored answer.
//
// Pure. The only nondeterminism is the injected `rng`.

import {
  createSheet, setCells, setCell, getCell, getValue, serializeSheet, deserializeSheet,
} from "../sheet/model.js";
import { isError } from "../sheet/functions.js";
import { buildQueue, getCard, isNew } from "./srs.js";
import { masteryFromCard } from "./scoring.js";

/* ─── rng ─── */

/**
 * Deterministic PRNG (mulberry32). Seeded so a round can be replayed in a
 * test, and so a "same round again" button is possible.
 * @param {number} [seed]
 * @returns {() => number} rng producing [0, 1)
 */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates. Returns a new array; does not mutate the input.
 * @template T
 * @param {T[]} arr
 * @param {() => number} [rng]
 * @returns {T[]}
 */
export function shuffle(arr, rng = Math.random) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function sample(arr, n, rng) {
  return shuffle(arr, rng).slice(0, Math.max(0, n));
}

/** Stable, url-safe id fragment for a term. */
function slug(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ─── concepts ─── */

/**
 * Flatten the curriculum into concepts -- the atomic units the SRS
 * schedules and every game draws from. A concept id is stable across runs
 * and safe to persist:
 *   quiz items -> "quiz:<lessonId>:<index>"
 *   flashcards -> "card:<slug(term)>"
 *
 * @param {{modules?: object[], flashcards?: object[]}} sources
 * @returns {object[]} concepts
 */
export function extractConcepts(sources = {}) {
  const { modules = [], flashcards = [] } = sources;
  const out = [];

  for (const mod of modules) {
    for (const lesson of mod.lessons ?? []) {
      (lesson.quiz ?? []).forEach((item, i) => {
        const distractors = (item.options ?? []).filter((o) => o.text !== item.a);
        out.push({
          id: `quiz:${lesson.id}:${i}`,
          kind: "quiz",
          moduleId: mod.id,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          prompt: item.q,
          answer: item.a,
          explanation: item.explanation ?? "",
          options: item.options ?? [],
          distractors,
        });
      });
    }
  }

  flashcards.forEach((card, i) => {
    out.push({
      id: `card:${slug(card.term)}`,
      kind: "card",
      moduleId: null,
      lessonId: null,
      lessonTitle: null,
      index: i,
      // A flashcard is drilled def -> term: the term is short enough to
      // actually type, the definition is not.
      prompt: card.def,
      answer: card.term,
      explanation: card.def,
      term: card.term,
      def: card.def,
      options: [],
      distractors: [],
    });
  });

  return out;
}

/**
 * Filter concepts by module / lesson / explicit id list.
 * @param {object[]} concepts
 * @param {{moduleId?: string, lessonId?: string, ids?: string[], kind?: string}} [filter]
 * @returns {object[]}
 */
export function pickConcepts(concepts, filter = {}) {
  const ids = filter.ids ? new Set(filter.ids) : null;
  return concepts.filter((c) => {
    if (ids && !ids.has(c.id)) return false;
    if (filter.moduleId && c.moduleId !== filter.moduleId) return false;
    if (filter.lessonId && c.lessonId !== filter.lessonId) return false;
    if (filter.kind && c.kind !== filter.kind) return false;
    return true;
  });
}

/* ─── recall drill ─── */

/** Longest answer (in words / characters) we will ask someone to type. */
const RECALL_MAX_WORDS = 4;
const RECALL_MAX_CHARS = 34;

/**
 * Whether a concept's answer is short and crisp enough to be typed from
 * memory. Long prose answers are excluded on purpose: asking someone to
 * reproduce a sentence verbatim tests typing, not knowledge, and no fuzzy
 * matcher can judge it fairly. Those concepts are still drilled -- by
 * RapidFire and MatchGame, where recognition is the honest format.
 * @param {object} concept
 * @returns {boolean}
 */
export function isRecallable(concept) {
  const a = String(concept.answer ?? "").trim();
  if (!a) return false;
  if (a.length > RECALL_MAX_CHARS) return false;
  if (a.split(/\s+/).length > RECALL_MAX_WORDS) return false;
  return true;
}

/**
 * Every string that should count as correct for this concept, derived from
 * the answer's own structure:
 *   "Model Risk Management (MRM)" -> also "Model Risk Management", "MRM"
 *   "UDAP / UDAAP"                -> also "UDAP", "UDAAP"
 *   "Validation vs. monitoring"   -> left as-is (a contrast, not a choice)
 * @param {object} concept
 * @returns {string[]}
 */
export function acceptableAnswers(concept) {
  const answer = String(concept.answer ?? "").trim();
  const out = new Set([answer]);

  const paren = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(answer);
  if (paren) {
    out.add(paren[1].trim());
    out.add(paren[2].trim());
  }

  const base = paren ? paren[1].trim() : answer;
  if (base.includes("/") && !/\bvs\b/i.test(base) && !/^=/.test(base)) {
    for (const part of base.split("/")) {
      const p = part.trim();
      if (p) out.add(p);
    }
  }

  // Trailing qualifiers like "— Social pillar" are scoping, not the term.
  const dash = /^(.*?)\s+[—–-]\s+.+$/.exec(base);
  if (dash && dash[1].trim().length >= 3) out.add(dash[1].trim());

  return [...out].filter(Boolean);
}

/**
 * Strings that are known to be WRONG for this concept. This is what makes
 * fuzzy matching safe (see scoring.matchAnswer): a quiz concept hands over
 * its real distractors, and a flashcard concept borrows the other terms in
 * the pool, so "disparate treatment" can never be fuzzed into "disparate
 * impact".
 * @param {object} concept
 * @param {object[]} [pool] the other concepts in this round
 * @returns {string[]}
 */
export function rejectAnswers(concept, pool = []) {
  const out = new Set();
  for (const d of concept.distractors ?? []) out.add(d.text);
  if (concept.kind === "card") {
    for (const other of pool) {
      if (other.id === concept.id || other.kind !== "card") continue;
      out.add(other.answer);
    }
  }
  const own = new Set(acceptableAnswers(concept));
  return [...out].filter((t) => t && !own.has(t));
}

/**
 * Active recall: read the prompt, type the answer. The hardest and most
 * effective retrieval format, so it is the default for anything typeable.
 * @param {object[]} concepts
 * @param {{count?: number, rng?: () => number, pool?: object[]}} [opts]
 * @returns {{game: string, items: object[]}}
 */
export function generateRecallDrill(concepts, opts = {}) {
  const { count = 8, rng = Math.random } = opts;
  const eligible = concepts.filter(isRecallable);
  const pool = opts.pool ?? concepts;
  const chosen = sample(eligible, count, rng);
  return {
    game: "recall",
    items: chosen.map((c) => ({
      conceptId: c.id,
      kind: c.kind,
      prompt: c.prompt,
      answer: c.answer,
      acceptable: acceptableAnswers(c),
      reject: rejectAnswers(c, pool),
      // A letter-count skeleton: enough to unstick a tip-of-the-tongue
      // recall without giving the answer away.
      hint: String(c.answer).replace(/[A-Za-z0-9]/g, "•"),
      explanation: c.explanation,
      lessonId: c.lessonId,
    })),
  };
}

/* ─── match game ─── */

/**
 * Term <-> definition matching. Uses flashcards directly, and quiz items as
 * question/answer pairs, filtered to definitions short enough to render as
 * a tile.
 * @param {object[]} concepts
 * @param {{pairs?: number, rng?: () => number}} [opts]
 * @returns {{game: string, pairs: object[], left: object[], right: object[]}}
 */
export function generateMatchGame(concepts, opts = {}) {
  const { pairs = 6, rng = Math.random } = opts;
  const eligible = concepts.filter((c) => {
    const left = String(c.answer ?? "");
    const right = String(c.kind === "card" ? c.def : c.prompt ?? "");
    return left.length > 0 && left.length <= 48 && right.length > 0 && right.length <= 220;
  });
  const chosen = sample(eligible, pairs, rng);
  const built = chosen.map((c) => ({
    conceptId: c.id,
    kind: c.kind,
    term: c.answer,
    def: c.kind === "card" ? c.def : c.prompt,
    explanation: c.explanation,
  }));
  return {
    game: "match",
    pairs: built,
    left: shuffle(built.map((p) => ({ conceptId: p.conceptId, text: p.term })), rng),
    right: shuffle(built.map((p) => ({ conceptId: p.conceptId, text: p.def })), rng),
  };
}

/**
 * Check one match attempt.
 * @param {{pairs: object[]}} round
 * @param {string} leftConceptId
 * @param {string} rightConceptId
 * @returns {{correct: boolean, pair: object|null}}
 */
export function checkMatch(round, leftConceptId, rightConceptId) {
  const correct = leftConceptId === rightConceptId;
  const pair = round.pairs.find((p) => p.conceptId === leftConceptId) ?? null;
  return { correct, pair };
}

/* ─── rapid fire ─── */

/**
 * Timed multiple choice. Quiz concepts keep their hand-written per-option
 * explanations verbatim -- those are the most valuable thing in the
 * curriculum and every game that can surface them, does.
 *
 * Flashcards have no options, so distractors are drawn from other cards'
 * definitions and given an honest generated explanation naming the term
 * they actually belong to. That is a real teaching moment, not filler.
 *
 * @param {object[]} concepts
 * @param {{count?: number, rng?: () => number, pool?: object[]}} [opts]
 * @returns {{game: string, items: object[]}}
 */
export function generateRapidFire(concepts, opts = {}) {
  const { count = 10, rng = Math.random } = opts;
  const pool = opts.pool ?? concepts;
  const cards = pool.filter((c) => c.kind === "card");
  const chosen = sample(concepts, count, rng);

  const items = [];
  for (const c of chosen) {
    let options;
    if (c.kind === "quiz" && c.options.length) {
      options = c.options.map((o) => ({
        text: o.text,
        correct: o.text === c.answer,
        explanation: o.explanation ?? "",
      }));
    } else if (c.kind === "card") {
      const others = sample(cards.filter((o) => o.id !== c.id), 3, rng);
      if (others.length < 3) continue;
      options = [
        { text: c.def, correct: true, explanation: c.explanation ?? "" },
        ...others.map((o) => ({
          text: o.def,
          correct: false,
          explanation: `That's the definition of ${o.term}.`,
        })),
      ];
    } else {
      continue;
    }
    items.push({
      conceptId: c.id,
      // A card asks "which definition belongs to this term"; a quiz item
      // asks its own question.
      prompt: c.kind === "card" ? `Which definition matches "${c.term}"?` : c.prompt,
      options: shuffle(options, rng),
      explanation: c.explanation,
      lessonId: c.lessonId,
    });
  }
  return { game: "rapidFire", items };
}

/* ─── formula builder ─── */

const FORMULA_RE = /=[A-Z][A-Z0-9._]*\([^=]*?\)(?=[\s.,;'"]|$)/g;

/**
 * Split a formula into the tokens a learner assembles: function heads
 * ("=XLOOKUP("), argument atoms, commas and closing parens.
 * @param {string} formula
 * @returns {string[]}
 */
export function tokenizeFormula(formula) {
  const tokens = [];
  let buf = "";
  const flush = () => {
    const t = buf.trim();
    if (t) tokens.push(t);
    buf = "";
  };
  for (let i = 0; i < formula.length; i++) {
    const ch = formula[i];
    if (ch === "(") {
      buf += ch;
      flush();
    } else if (ch === ")" || ch === ",") {
      flush();
      tokens.push(ch);
    } else {
      buf += ch;
    }
  }
  flush();
  return tokens;
}

/** Whitespace-insensitive form used to compare a built formula to its target. */
function normalizeFormula(s) {
  return String(s).replace(/\s+/g, "").toUpperCase();
}

/**
 * Mine real Excel formulas out of the curriculum's own prose, quiz answers
 * and flashcard definitions -- the places they already live.
 * @param {{modules?: object[], flashcards?: object[]}} sources
 * @returns {object[]} {formula, tokens, label, context}
 */
export function extractFormulas(sources = {}) {
  const { modules = [], flashcards = [] } = sources;
  const found = new Map();

  const scan = (text, label, context) => {
    if (!text) return;
    const matches = String(text).match(FORMULA_RE);
    if (!matches) return;
    for (const raw of matches) {
      const formula = raw.trim().replace(/[.,;]+$/, "");
      // Balanced parens only -- the regex can clip a nested call short.
      let depth = 0;
      for (const ch of formula) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
      }
      if (depth !== 0) continue;
      const tokens = tokenizeFormula(formula);
      if (tokens.length < 4) continue;
      const key = normalizeFormula(formula);
      if (!found.has(key)) found.set(key, { formula, tokens, label, context });
    }
  };

  for (const mod of modules) {
    for (const lesson of mod.lessons ?? []) {
      for (const para of lesson.body ?? []) scan(para, lesson.title, { moduleId: mod.id, lessonId: lesson.id });
      for (const item of lesson.quiz ?? []) {
        scan(item.a, lesson.title, { moduleId: mod.id, lessonId: lesson.id });
        for (const o of item.options ?? []) scan(o.text, lesson.title, { moduleId: mod.id, lessonId: lesson.id });
      }
    }
  }
  for (const card of flashcards) scan(card.def, card.term, { term: card.term });

  return [...found.values()];
}

/**
 * Assemble-the-formula from shuffled tokens. Distractor tokens are pulled
 * from OTHER mined formulas, so the wrong choices are real Excel that a
 * learner must actually rule out (VLOOKUP next to XLOOKUP), not noise.
 * @param {object[]} formulas from extractFormulas()
 * @param {{rng?: () => number, index?: number, distractors?: number}} [opts]
 * @returns {object|null} null when there is nothing to build
 */
export function generateFormulaBuilder(formulas, opts = {}) {
  const { rng = Math.random, distractors = 2 } = opts;
  if (!formulas.length) return null;
  const pick = opts.index !== undefined ? formulas[opts.index] : sample(formulas, 1, rng)[0];
  if (!pick) return null;

  const solution = pick.tokens.map((text, i) => ({ id: `s${i}`, text }));
  const otherHeads = [];
  for (const f of formulas) {
    if (f.formula === pick.formula) continue;
    for (const t of f.tokens) {
      if (!pick.tokens.includes(t) && !otherHeads.includes(t)) otherHeads.push(t);
    }
  }
  const noise = sample(otherHeads, distractors, rng).map((text, i) => ({ id: `d${i}`, text }));

  return {
    game: "formulaBuilder",
    label: pick.label,
    context: pick.context,
    prompt: `Assemble the formula: ${pick.label}`,
    target: pick.formula,
    solution: solution.map((t) => t.id),
    tokens: shuffle([...solution, ...noise], rng),
  };
}

/**
 * Check an assembled formula. Compares the built string to the target
 * ignoring whitespace, so spacing choices never count against the learner.
 * @param {object} round
 * @param {string[]} tokenIds in the order the learner placed them
 * @returns {{correct: boolean, assembled: string}}
 */
export function checkFormulaBuilder(round, tokenIds) {
  const byId = new Map(round.tokens.map((t) => [t.id, t.text]));
  const parts = tokenIds.map((id) => byId.get(id) ?? "");
  const assembled = parts.join("").replace(/,/g, ", ");
  return {
    correct: normalizeFormula(assembled) === normalizeFormula(round.target),
    assembled,
  };
}

/* ─── error hunt ─── */

/**
 * The four race groups whose approval numbers are verified ground truth in
 * the HMDA sample (100 records; these four are the ones with confirmed
 * counts). Used to build a workbook whose right answers are real.
 * @type {Array<{group: string, total: number, approved: number}>}
 */
export const HMDA_GROUPS = [
  { group: "Black", total: 16, approved: 9 },
  { group: "White", total: 50, approved: 43 },
  { group: "Asian", total: 10, approved: 8 },
  { group: "Hispanic", total: 18, approved: 12 },
];

/**
 * Build a correct four-fifths calculator as a real lib/sheet workbook:
 * rate = approved/total, ratio = rate / max(rate), flag if ratio < 0.8.
 * This is the exact calculation lesson excel-3 teaches.
 * @param {Array<{group: string, total: number, approved: number}>} [groups]
 * @returns {object} sheet
 */
export function buildFourFifthsWorkbook(groups = HMDA_GROUPS) {
  const sheet = createSheet("FourFifths");
  const last = groups.length + 1;
  const entries = {
    A1: "Group", B1: "Total", C1: "Approved", D1: "Rate", E1: "Ratio", F1: "Flag",
  };
  groups.forEach((g, i) => {
    const r = i + 2;
    entries[`A${r}`] = g.group;
    entries[`B${r}`] = g.total;
    entries[`C${r}`] = g.approved;
    entries[`D${r}`] = `=C${r}/B${r}`;
    entries[`E${r}`] = `=D${r}/MAX($D$2:$D$${last})`;
    entries[`F${r}`] = `=IF(E${r}<0.8,"FLAG","OK")`;
  });
  setCells(sheet, entries);
  return sheet;
}

/**
 * The bugs ErrorHunt injects. Each is a mistake that actually happens in
 * real spreadsheets, and each one changes a computed value -- so it is
 * findable by reading the output, which is the skill being taught.
 * @type {Array<{kind: string, ref: string, input: string, hint: string, explanation: string}>}
 */
export const BUG_KINDS = [
  {
    kind: "missingAbsolute",
    ref: "E4",
    input: "=D4/MAX(D4:D5)",
    hint: "Two groups show a ratio of exactly 1.00. Only the top group should.",
    explanation:
      "The MAX range wasn't anchored with $, so dragging the formula down slid the window and each row compared itself to a shrinking set. Anchor it: MAX($D$2:$D$5).",
  },
  {
    kind: "invertedComparison",
    ref: "F2",
    input: '=IF(E2>0.8,"FLAG","OK")',
    hint: "Read the Flag column against the Ratio column. Do they agree?",
    explanation:
      "The comparison is backwards: it flags the groups that PASS. The four-fifths rule flags a ratio BELOW 0.80, so the test is E2<0.8.",
  },
  {
    kind: "invertedRatio",
    ref: "D2",
    input: "=B2/C2",
    hint: "One approval rate is above 100%. That's not possible.",
    explanation:
      "Numerator and denominator are swapped. An approval rate is approved ÷ total (C2/B2), not total ÷ approved.",
  },
  {
    kind: "wrongDivisor",
    ref: "E2",
    input: "=D2/MIN($D$2:$D$5)",
    hint: "Every ratio looks generous. What are they being compared to?",
    explanation:
      "The four-fifths ratio divides by the HIGHEST group's rate, not the lowest. Dividing by MIN makes every group look compliant.",
  },
  {
    kind: "wrongRowRef",
    ref: "D5",
    input: "=C5/B4",
    hint: "Check the last row's rate against its own Total and Approved cells.",
    explanation:
      "The formula reaches into the wrong row for its denominator (B4 instead of B5) — a classic off-by-one from editing a formula by hand instead of filling it down.",
  },
];

function valuesOf(sheet, refs) {
  const out = {};
  for (const ref of refs) {
    const v = getValue(sheet, ref);
    out[ref] = isError(v) ? String(v) : v;
  }
  return out;
}

/**
 * The cells a learner is asked to verify: every computed cell.
 * @param {number} rows number of group rows
 * @returns {string[]}
 */
function computedRefs(rows) {
  const refs = [];
  for (let i = 0; i < rows; i++) {
    const r = i + 2;
    refs.push(`D${r}`, `E${r}`, `F${r}`);
  }
  return refs;
}

/**
 * A broken spreadsheet to debug. The workbook is built correctly, evaluated
 * with lib/sheet to capture the true answers, and only then broken -- so
 * `expected` is genuinely computed, never transcribed, and any fix that
 * reproduces it passes, whether or not it is the fix we had in mind.
 * @param {{rng?: () => number, kind?: string, groups?: object[]}} [opts]
 * @returns {object} round
 */
export function generateErrorHunt(opts = {}) {
  const { rng = Math.random, groups = HMDA_GROUPS } = opts;
  const bug = opts.kind
    ? BUG_KINDS.find((b) => b.kind === opts.kind)
    : sample(BUG_KINDS, 1, rng)[0];
  if (!bug) throw new Error(`unknown bug kind: ${opts.kind}`);

  const good = buildFourFifthsWorkbook(groups);
  const refs = computedRefs(groups.length);
  const expected = valuesOf(good, refs);
  const correctInput = getCell(good, bug.ref).input;

  const broken = buildFourFifthsWorkbook(groups);
  setCell(broken, bug.ref, bug.input);

  return {
    game: "errorHunt",
    title: "Four-fifths calculator",
    brief:
      "This workbook computes the four-fifths disparate impact test. One formula is wrong. Find it, fix it, and the numbers will agree.",
    sheet: serializeSheet(broken),
    editableRefs: refs,
    verifyRefs: refs,
    expected,
    bug: { ref: bug.ref, kind: bug.kind, hint: bug.hint, explanation: bug.explanation },
    solution: { ref: bug.ref, input: correctInput },
  };
}

function sameValue(a, b) {
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  }
  return a === b;
}

/**
 * Check a fix by really evaluating it: the learner's edits are applied to
 * the broken workbook in lib/sheet, the whole thing recalculates, and every
 * computed cell is compared to the truth. There is no answer string to
 * match -- if your formula produces the right numbers, it is right.
 * @param {object} round from generateErrorHunt()
 * @param {Object<string, *>} edits ref -> input
 * @returns {{solved: boolean, values: object, wrong: string[], fixedTarget: boolean}}
 */
export function checkErrorHunt(round, edits = {}) {
  const sheet = deserializeSheet(round.sheet);
  setCells(sheet, edits);
  const values = valuesOf(sheet, round.verifyRefs);
  const wrong = round.verifyRefs.filter((ref) => !sameValue(values[ref], round.expected[ref]));
  return {
    solved: wrong.length === 0,
    values,
    wrong,
    fixedTarget: wrong.length === 0 || !wrong.includes(round.bug.ref),
  };
}

/* ─── session planning ─── */

/** Games ordered by retrieval difficulty: recognition first, production last. */
export const GAME_LADDER = ["match", "rapidFire", "recall"];

/**
 * Choose the right game for a concept given what the learner already knows.
 *
 * This is the expanding-retrieval ladder: recognition formats (match,
 * multiple choice) while a concept is new, free recall once it is holding.
 * Jumping straight to free recall on unseen material just produces failure,
 * and drilling recognition forever produces false confidence.
 *
 * @param {object} concept
 * @param {object} [card] the srs card, if any
 * @param {{now?: Date|number|string}} [opts]
 * @returns {string} a game id
 */
export function suggestGame(concept, card, opts = {}) {
  if (!card || isNew(card)) return concept.kind === "card" ? "match" : "rapidFire";
  const m = masteryFromCard(card, opts);
  if (m.value < 0.5) return concept.kind === "card" ? "match" : "rapidFire";
  if (!isRecallable(concept)) return "rapidFire";
  return "recall";
}

/**
 * Plan a study session: take the SRS queue, and route each due concept to
 * the format that matches its current strength.
 * @param {object[]} concepts
 * @param {Object<string, object>} deck
 * @param {{now?: Date|number|string, limit?: number, newPerSession?: number}} [opts]
 * @returns {{conceptIds: string[], plan: Array<{conceptId: string, game: string, isNew: boolean}>, byGame: Object<string, string[]>}}
 */
export function planSession(concepts, deck, opts = {}) {
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const ids = buildQueue(deck, [...byId.keys()], opts);
  const plan = ids.map((id) => {
    const concept = byId.get(id);
    const card = deck[id];
    return {
      conceptId: id,
      game: suggestGame(concept, card, opts),
      isNew: isNew(getCard(deck, id, opts)),
    };
  });
  const byGame = {};
  for (const p of plan) (byGame[p.game] ??= []).push(p.conceptId);
  return { conceptIds: ids, plan, byGame };
}
