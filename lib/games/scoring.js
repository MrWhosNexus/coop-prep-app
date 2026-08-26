// lib/games/scoring.js
// Judging answers, scoring rounds, and estimating mastery per concept.
//
// Three concerns live here, in dependency order:
//   1. matchAnswer()      -- is this typed answer right? (fuzzy, but safe)
//   2. scoreRound()       -- points/streaks for a completed round
//   3. estimateMastery()  -- how well is this concept actually known?
//
// Design stance on fuzzy matching: a drill that rejects a correct answer is
// worse than no drill, but a drill that accepts a wrong one is a lie. The
// resolution is that matching is never done against the correct answer
// alone -- it is done against the correct answer AND the known wrong
// answers (`reject`). Typo tolerance only applies when the input is
// unambiguously closer to the right answer than to any wrong one. That is
// what lets "XLOOKUP" tolerate a typo without ever swallowing "VLOOKUP",
// which is a single edit away.
//
// Pure + serializable. No DOM, no clock reads except via injected `now`.

import { retrievability } from "./srs.js";

/* ─── normalisation ─── */

const SMART = new Map([
  ["‘", "'"], ["’", "'"], ["“", '"'], ["”", '"'],
  ["–", "-"], ["—", "-"], ["−", "-"], ["→", " "],
  [" ", " "],
]);

const ARTICLES = new Set(["a", "an", "the"]);

/** Words that carry no discriminating meaning in a short answer. */
const STOPWORDS = new Set([
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "by", "as", "is",
  "are", "was", "were", "be", "and", "or", "its", "it", "that", "this",
  "with", "from", "into", "each",
]);

/**
 * Domain equivalence classes. Every member of a row is treated as the same
 * answer. These are real synonyms a fellow would reasonably type -- not a
 * loosening of the correctness bar.
 * @type {string[][]}
 */
export const SYNONYM_CLASSES = [
  ["four-fifths rule", "four fifths rule", "80% rule", "80 percent rule", "4/5 rule", "eighty percent rule", "adverse impact ratio", "four-fifths test", "80% test"],
  ["standard deviation", "std dev", "stdev", "std", "sd", "sigma"],
  ["disparate impact", "adverse impact", "discriminatory effect"],
  ["adverse-action notice", "adverse action notice", "adverse action letter", "denial notice"],
  ["model risk management", "mrm"],
  ["equal credit opportunity act", "ecoa", "regulation b", "reg b", "ecoa regulation b"],
  ["home mortgage disclosure act", "hmda"],
  ["fair housing act", "fha"],
  ["consumer financial protection bureau", "cfpb"],
  ["nist ai rmf", "nist ai risk management framework", "ai rmf"],
  ["sr 11-7", "sr11-7", "sr 11 7"],
  ["proxy variable", "proxy", "proxy feature"],
  ["pivot table", "pivottable", "pivot"],
  ["area under the roc curve", "auc-roc", "auc roc", "auc", "roc auc"],
  ["confusion matrix", "error matrix"],
  ["logistic regression", "logit", "logit model"],
  ["percent of column total", "% of column total", "percentage of column total"],
  ["percent of grand total", "% of grand total", "percentage of grand total"],
  ["percent of row total", "% of row total", "percentage of row total"],
];

/**
 * Domain confusable classes: sets of terms that must NEVER be accepted as
 * near misses for one another, no matter how close the spelling. String
 * similarity is exactly backwards for these -- the more similar the
 * spelling, the more important the distinction: "revocable trust" is one
 * near-identical word away from "irrevocable trust" and means the opposite.
 * These are precisely the discriminations the SIE, the Series 65 and a
 * governance interview test, and the reject list cannot carry this load
 * alone because it only ever holds the handful of peers drawn into the
 * current round.
 *
 * Members are matched post-normalisation and post-canonicalisation, so
 * synonym-folded forms (e.g. "adverse impact" -> "disparate impact") are
 * covered by their canonical member. Terms drawn from the data/certs banks.
 * @type {string[][]}
 */
export const CONFUSABLE_CLASSES = [
  ["revocable trust", "irrevocable trust"],
  ["revocable", "irrevocable"],
  // "government bond"/"treasury bond" are near-synonyms of each other, so
  // the class holds only the three genuinely distinct issuer types.
  ["municipal bond", "corporate bond", "treasury bond"],
  ["limited liability", "unlimited liability"],
  ["disparate impact", "disparate treatment"],
  ["secured", "unsecured"],
  ["secured debt", "unsecured debt"],
  ["secured creditors", "unsecured creditors"],
  ["discretionary", "non-discretionary"],
  ["discretionary account", "non-discretionary account"],
  ["bid", "ask"],
  ["bid price", "ask price"],
  // "systemic risk" is a THIRD distinct concept, not a typo of "systematic
  // risk" — edit distance 2 sits inside the typo budget for a 15-character
  // target, so without this entry matchAnswer credited it as fully correct.
  // The SIE tests exactly this discrimination.
  ["systematic risk", "systemic risk", "unsystematic risk"],
  ["systematic", "systemic", "unsystematic"],
  ["cumulative preferred", "non-cumulative preferred"],
  ["callable", "non-callable"],
  ["qualified", "non-qualified"],
  ["qualified plan", "non-qualified plan"],
  ["open-end fund", "closed-end fund"],
  ["solicited", "unsolicited"],
  ["primary market", "secondary market"],
];

const PHRASE_CANON = (() => {
  const m = new Map();
  for (const cls of SYNONYM_CLASSES) {
    const canon = cls[0];
    for (const variant of cls) m.set(normalizeAnswer(variant), normalizeAnswer(canon));
  }
  return m;
})();

/**
 * Normalise a typed answer for comparison: fold case and accents, unify
 * smart punctuation, expand "percent" to "%", drop leading articles and
 * trailing punctuation, and collapse whitespace. Digits, "%" and "." are
 * preserved -- they carry meaning in this domain.
 * @param {string} s
 * @returns {string}
 */
export function normalizeAnswer(s) {
  if (s === null || s === undefined) return "";
  let out = String(s);
  for (const [from, to] of SMART) out = out.split(from).join(to);
  out = out.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  out = out.toLowerCase();
  out = out.replace(/\bpercent(age)?\b/g, "%");
  out = out.replace(/\bversus\b/g, "vs");
  // Apostrophes close up ("don't" -> "dont"); they never separate words.
  out = out.replace(/['"]/g, "");
  // Keep word chars, digits, %, ., -, /, $, spaces. Everything else is noise.
  out = out.replace(/[^\w\s%.\-/$]/g, " ");
  out = out.replace(/\s+/g, " ").trim();
  const words = out.split(" ").filter(Boolean);
  while (words.length > 1 && ARTICLES.has(words[0])) words.shift();
  out = words.join(" ");
  out = out.replace(/[.\-/]+$/g, "").trim();
  return out;
}

/* Normalised+canonical member -> the OTHER members of its class(es). Built
   once; matchAnswer folds its targets through this to learn which inputs it
   must refuse regardless of spelling distance. */
const CONFUSABLE_OPPOSITES = (() => {
  const m = new Map();
  for (const cls of CONFUSABLE_CLASSES) {
    const canon = cls.map((t) => canonicalize(normalizeAnswer(t)));
    for (const a of canon) {
      if (!m.has(a)) m.set(a, new Set());
      for (const b of canon) if (b !== a) m.get(a).add(b);
    }
  }
  return m;
})();

/**
 * The confusable counterparts of a set of normalised+canonical targets:
 * every term that spells almost like one of them but must never be credited
 * for it.
 * @param {string[]} nTargets normalised+canonical
 * @returns {Set<string>}
 */
export function confusablesFor(nTargets) {
  const out = new Set();
  for (const t of nTargets) {
    const opp = CONFUSABLE_OPPOSITES.get(t);
    if (opp) for (const o of opp) if (!nTargets.includes(o)) out.add(o);

    /* Phrase-embedded members. Whole-string lookup alone let phrase-suffixed
       opposites straight through: with target "solicited order", the class
       ["solicited", "unsolicited"] never fired because "solicited order" is
       not itself a member — so "unsolicited order", a semantic OPPOSITE, fell
       to the generic edit-distance path and was graded "close". Here every
       class member found as a whole word (or whole sub-phrase) inside a
       target generates the target with that member swapped for each of its
       counterparts. Space-anchored on the already-normalised string, both
       directions: "unsolicited" must not fire on its substring "solicited",
       and vice versa. */
    for (const [member, opps] of CONFUSABLE_MEMBERS) {
      if (member === t) continue; // whole-string case handled above
      const re = new RegExp(`(^|\\s)${escapeRegExp(member)}(\\s|$)`);
      if (!re.test(t)) continue;
      for (const o of opps) {
        const swapped = t.replace(re, (m, pre, post) => `${pre}${o}${post}`);
        if (!nTargets.includes(swapped)) out.add(swapped);
      }
    }
  }
  return out;
}

/** CONFUSABLE_OPPOSITES flattened to [member, counterparts[]] pairs, for the
    phrase-embedded scan above. Built once, next to the map it mirrors. */
const CONFUSABLE_MEMBERS = (() => {
  const arr = [];
  for (const [member, opps] of CONFUSABLE_OPPOSITES) arr.push([member, [...opps]]);
  return arr;
})();

/** Members are data, not regex — "non-qualified" carries a hyphen today and
    a future member could carry worse, so escape before embedding. */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Fold a normalised answer through the synonym table.
 * @param {string} s already normalised
 * @returns {string}
 */
export function canonicalize(s) {
  return PHRASE_CANON.get(s) ?? s;
}

/**
 * Content words of an answer, synonyms folded, stopwords dropped.
 * @param {string} s
 * @returns {string[]}
 */
export function contentWords(s) {
  const canon = canonicalize(normalizeAnswer(s));
  return canon.split(" ").filter((w) => w && !STOPWORDS.has(w));
}

/* ─── numbers ─── */

/**
 * The numeric readings of an answer, or null when it isn't a number.
 * A percent-marked value reads both ways ("75%" -> 75 and 0.75) so that
 * "75", "75%" and "0.75" all agree, while a bare "80" deliberately does NOT
 * equal "0.80" -- that gap is reported as a scale slip instead (see
 * matchAnswer's `near`), because silently accepting it would teach the
 * wrong thing about ratios.
 * @param {string} s
 * @returns {number[]|null}
 */
export function numericForms(s) {
  const raw = normalizeAnswer(s).replace(/[$,\s]/g, "");
  const m = /^(-?(?:\d+\.?\d*|\.\d+))(%?)$/.exec(raw);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return m[2] === "%" ? [n, n / 100] : [n];
}

function nearlyEqual(a, b) {
  const eps = 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= eps;
}

function anyEqual(as, bs) {
  return as.some((a) => bs.some((b) => nearlyEqual(a, b)));
}

/* ─── edit distance ─── */

/**
 * Damerau-Levenshtein distance (optimal string alignment), which counts a
 * transposition as one edit -- the single most common real typing error.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * 1 - normalised edit distance. 1 is identical, 0 is nothing in common.
 * @param {string} a
 * @param {string} b
 * @returns {number} 0..1
 */
export function similarity(a, b) {
  const len = Math.max(a.length, b.length);
  if (len === 0) return 1;
  return 1 - editDistance(a, b) / len;
}

/**
 * How many edits we forgive on a string of this length. Short answers get
 * zero tolerance: "sd" and "se", or "0.7" and "0.8", are different answers,
 * not typos. Tolerance opens up at 6 characters and grows sublinearly.
 * @param {string} target normalised
 * @returns {number}
 */
export function typoBudget(target) {
  const n = target.length;
  if (n < 6) return 0;
  if (n < 12) return 1;
  if (n < 20) return 2;
  return 3;
}

/* ─── token-set comparison (multi-word answers) ─── */

function tokenSetScore(inputWords, targetWords) {
  if (!targetWords.length || !inputWords.length) return 0;
  const used = new Set();
  let hits = 0;
  for (const t of targetWords) {
    for (let i = 0; i < inputWords.length; i++) {
      if (used.has(i)) continue;
      const w = inputWords[i];
      if (w === t || editDistance(w, t) <= typoBudget(t)) {
        used.add(i);
        hits++;
        break;
      }
    }
  }
  const recall = hits / targetWords.length;
  const precision = hits / inputWords.length;
  if (recall + precision === 0) return 0;
  return (2 * recall * precision) / (recall + precision);
}

/* ─── the matcher ─── */

const ACCEPT_TOKEN_SCORE = 0.75;

/**
 * Raw closeness of an input to one target, on a single comparable scale.
 * Used only to rank the correct answer against the wrong ones.
 * @param {string} input normalised+canonical
 * @param {string} target normalised+canonical
 * @returns {{exact: boolean, distance: number, tokenScore: number, sim: number}}
 */
function compare(input, target) {
  const distance = editDistance(input, target);
  return {
    exact: input === target,
    distance,
    tokenScore: tokenSetScore(
      input.split(" ").filter((w) => w && !STOPWORDS.has(w)),
      target.split(" ").filter((w) => w && !STOPWORDS.has(w)),
    ),
    sim: similarity(input, target),
  };
}

/**
 * Judge a typed answer.
 *
 * `acceptable` is every string that counts as right (the answer plus any
 * generator-derived alternates, e.g. an acronym pulled out of parentheses).
 * `reject` is every string known to be WRONG for this prompt -- the quiz
 * distractors, or the other terms in a flashcard round. Passing `reject` is
 * what makes typo tolerance safe: an input is only ever accepted when it is
 * strictly closer to a correct answer than to every wrong one.
 *
 * `correct` and `near` answer two different questions. `correct` asks "may we
 * credit this?" -- the reject list can veto it. `near` asks "how far from the
 * answer is this?" -- and depends only on the correct answer, never on the
 * reject list, so a closer input is never graded below a farther one. The one
 * intended exception is typing a known-wrong answer VERBATIM (reason
 * "distractor"): that is a choice, not a slip, and it is never near.
 *
 * @param {string} input what the learner typed
 * @param {string|string[]} acceptable correct answer(s)
 * @param {{reject?: string[]}} [opts]
 * @returns {{correct: boolean, near: boolean, reason: string, matched: string|null, distance: number, similarity: number}}
 */
export function matchAnswer(input, acceptable, opts = {}) {
  const targets = (Array.isArray(acceptable) ? acceptable : [acceptable])
    .filter((t) => t !== null && t !== undefined && String(t).trim() !== "");
  const rejects = (opts.reject ?? []).filter(
    (t) => t !== null && t !== undefined && String(t).trim() !== "",
  );

  const miss = (reason, extra = {}) => ({
    correct: false, near: false, reason, matched: null, distance: Infinity, similarity: 0, ...extra,
  });

  const rawInput = normalizeAnswer(input);
  if (!rawInput) return miss("empty");
  if (!targets.length) return miss("no-target");

  const nInput = canonicalize(rawInput);
  const nTargets = targets.map((t) => canonicalize(normalizeAnswer(t)));
  const nRejects = rejects
    .map((t) => canonicalize(normalizeAnswer(t)))
    .filter((t) => t && !nTargets.includes(t));

  /* Numeric answers are judged numerically, never by spelling. */
  const inputNums = numericForms(rawInput);
  const targetNums = nTargets.map((t) => numericForms(t));
  if (inputNums && targetNums.some(Boolean)) {
    for (let i = 0; i < nTargets.length; i++) {
      const tn = targetNums[i];
      if (tn && anyEqual(inputNums, tn)) {
        return { correct: true, near: false, reason: "numeric", matched: targets[i], distance: 0, similarity: 1 };
      }
    }
    // A wrong number is wrong -- but a pure factor-of-100 slip is a units
    // error, not a knowledge gap, so surface it as `near` and let the UI ask
    // for a retry rather than marking the concept unknown.
    for (const tn of targetNums) {
      if (!tn) continue;
      const scaled = inputNums.some((a) => tn.some((b) => nearlyEqual(a / 100, b) || nearlyEqual(a * 100, b)));
      if (scaled) return { ...miss("scale"), near: true };
    }
    return miss("numeric-mismatch");
  }

  /* Exact (post-synonym) hit. */
  const exactIdx = nTargets.indexOf(nInput);
  if (exactIdx !== -1) {
    return { correct: true, near: false, reason: "exact", matched: targets[exactIdx], distance: 0, similarity: 1 };
  }

  /* Typing a known-wrong answer verbatim is always a miss, no matter how
     close it happens to sit to the right one. */
  if (nRejects.includes(nInput)) return miss("distractor");

  /* Typing the confusable OPPOSITE of the answer is a miss, and never a
     near one. The round's reject list cannot catch this -- it only holds
     the peers drawn into this round -- and similarity is anti-correlated
     with correctness for these pairs ("revocable trust" sits one word from
     "irrevocable trust"). Crediting or even near-crediting it teaches the
     exact discrimination the certs exist to test, backwards. */
  const nConfusables = confusablesFor(nTargets);
  if (nConfusables.has(nInput)) return miss("confusable");

  /* Best correct target and best wrong target, on the same scale. */
  let best = null;
  let bestIdx = -1;
  for (let i = 0; i < nTargets.length; i++) {
    const c = compare(nInput, nTargets[i]);
    if (!best || c.distance < best.distance || (c.distance === best.distance && c.tokenScore > best.tokenScore)) {
      best = c;
      bestIdx = i;
    }
  }
  let worst = null;
  for (const r of nRejects) {
    const c = compare(nInput, r);
    if (!worst || c.distance < worst.distance) worst = c;
  }

  /* A typo'd confusable is still a confusable: when a wrong-by-design
     counterpart explains the input at least as well as the right answer
     does, refuse it outright (near:false) rather than letting the
     similarity-to-target math below call it close. */
  let confDist = Infinity;
  for (const c of nConfusables) confDist = Math.min(confDist, editDistance(nInput, c));
  if (confDist <= best.distance) {
    return { correct: false, near: false, reason: "confusable", matched: null, distance: best.distance, similarity: best.sim };
  }

  const result = {
    correct: false,
    near: false,
    reason: "wrong",
    matched: null,
    distance: best.distance,
    similarity: best.sim,
  };

  const target = nTargets[bestIdx];
  const multiWord = target.includes(" ") || nInput.includes(" ");
  // Typos land in the middle of a word far more often than on its first
  // letter, while distinct domain terms very often differ exactly there
  // (XLOOKUP/VLOOKUP). Requiring the initial to survive is what keeps typo
  // tolerance safe even when the caller passes no reject list at all -- the
  // reject list is the primary guard, but it must not be the only one.
  const initialHeld = nInput[0] === target[0];
  const byTypo = initialHeld && best.distance <= typoBudget(target);
  const byTokens = multiWord && best.tokenScore >= ACCEPT_TOKEN_SCORE;

  // Nearness is a property of how close the input sits to the RIGHT answer,
  // and of nothing else. It is computed once, here, and used on every
  // non-accepting path below, which is what makes the matcher monotone: no
  // input can be graded more harshly than one that is further from the answer.
  const nearMiss = best.sim >= 0.6 || best.tokenScore >= 0.5;

  if (byTypo || byTokens) {
    // The guard: never accept an input that a wrong answer explains at
    // least as well as the right one. This is the whole reason typo
    // tolerance is safe here.
    //
    // Withholding CREDIT is the whole protection, and it is untouched: an
    // input equidistant between "COUNTIFS" and its "COUNTIF" distractor is
    // not evidence the learner meant COUNTIFS, so it is never correct. But
    // it is still a near miss -- one keystroke from the answer -- and
    // reporting near:false here made a one-edit typo grade AGAIN (resetting
    // the SRS interval) while a two-edit mangling of the same word, plainly
    // further from the answer, graded HARD and got a retry. Refusing credit
    // is protection; punishing closeness is just a bug.
    if (worst !== null && worst.distance <= best.distance) {
      return { ...result, reason: "ambiguous", near: nearMiss, distance: best.distance, similarity: best.sim };
    }
    return {
      correct: true,
      near: false,
      reason: byTypo ? "typo" : "tokens",
      matched: targets[bestIdx],
      distance: best.distance,
      similarity: best.sim,
    };
  }
  // Close, but not close enough to call: let the UI offer another try.
  if (nearMiss) return { ...result, near: true };
  return result;
}

/* ─── round scoring ─── */

/** Points a correct answer is worth before any bonus. */
export const BASE_POINTS = 100;
/** Ceiling on the streak multiplier. Streaks nudge; they do not dominate. */
export const MAX_STREAK_MULTIPLIER = 1.5;

/**
 * Score one answer event.
 *
 * Accuracy is the only thing that earns the base score. Speed adds at most
 * 25% and only within the time budget, so it can never outweigh being
 * right. Wrong answers score zero -- never negative: points are feedback,
 * not punishment.
 *
 * @param {{correct: boolean, ms?: number, streak?: number}} ev
 * @param {{budgetMs?: number}} [opts] the time by which the speed bonus decays to 0
 * @returns {number} points
 */
export function scoreEvent(ev, opts = {}) {
  if (!ev.correct) return 0;
  const budgetMs = opts.budgetMs ?? 15000;
  const ms = Math.max(0, ev.ms ?? budgetMs);
  const speed = budgetMs > 0 ? Math.max(0, 1 - ms / budgetMs) : 0;
  const streak = Math.max(0, ev.streak ?? 0);
  const mult = Math.min(MAX_STREAK_MULTIPLIER, 1 + 0.1 * Math.max(0, streak - 1));
  return Math.round(BASE_POINTS * (1 + 0.25 * speed) * mult);
}

/**
 * Current and best consecutive-correct runs over an event list.
 * @param {Array<{correct: boolean}>} events
 * @returns {{current: number, best: number}}
 */
export function streaks(events) {
  let current = 0;
  let best = 0;
  for (const e of events) {
    current = e.correct ? current + 1 : 0;
    if (current > best) best = current;
  }
  return { current, best };
}

/**
 * Score a completed round. Streak multipliers are applied in sequence, so
 * the returned points depend on answer order the same way the live UI does.
 * @param {Array<{correct: boolean, ms?: number, conceptId?: string}>} events
 * @param {{budgetMs?: number}} [opts]
 * @returns {{correct: number, total: number, accuracy: number, points: number, bestStreak: number, finalStreak: number, medianMs: number|null}}
 */
export function scoreRound(events, opts = {}) {
  const list = events ?? [];
  let run = 0;
  let points = 0;
  let correct = 0;
  for (const e of list) {
    run = e.correct ? run + 1 : 0;
    if (e.correct) correct++;
    points += scoreEvent({ ...e, streak: run }, opts);
  }
  const times = list.map((e) => e.ms).filter((m) => typeof m === "number").sort((a, b) => a - b);
  const medianMs = times.length ? times[Math.floor(times.length / 2)] : null;
  const s = streaks(list);
  return {
    correct,
    total: list.length,
    accuracy: list.length ? correct / list.length : 0,
    points,
    bestStreak: s.best,
    finalStreak: s.current,
    medianMs,
  };
}

/* ─── mastery ─── */

/** Ordered mastery bands. */
export const MASTERY_LEVELS = ["new", "learning", "familiar", "proficient", "mastered"];

/**
 * Recency-weighted mastery estimate for one concept.
 *
 * Each older observation is discounted by `decay`, so a concept you used to
 * miss and now get right reads as learned rather than being dragged down
 * forever. The estimate is shrunk toward `priorMean` by `priorStrength`
 * pseudo-observations -- default 0.25, the chance rate of a 4-option
 * multiple choice, so one lucky guess cannot read as knowledge. Pass
 * priorMean: 0 for free-recall evidence, where guessing gets you nothing.
 *
 * Note on the constants: recency decay caps the effective sample size at
 * 1/(1-decay) ~= 6.67, so the estimate asymptotes at
 * (6.67 + priorStrength*priorMean) / (6.67 + priorStrength) ~= 0.88 rather
 * than at 1. MASTERY thresholds below are set against that ceiling -- a
 * higher priorStrength would put "mastered" out of reach entirely, which is
 * a real failure mode: a band nobody can ever earn is a broken band.
 *
 * @param {Array<{correct: boolean}>} events oldest-first
 * @param {{decay?: number, priorStrength?: number, priorMean?: number}} [opts]
 * @returns {{value: number, confidence: number, observations: number, level: string}}
 */
export function estimateMastery(events, opts = {}) {
  const { decay = 0.85, priorStrength = 1, priorMean = 0.25 } = opts;
  const list = events ?? [];
  let wCorrect = 0;
  let wTotal = 0;
  // Weight by recency: the newest event weighs 1, each older one decay^k.
  for (let i = 0; i < list.length; i++) {
    const age = list.length - 1 - i;
    const w = Math.pow(decay, age);
    wTotal += w;
    if (list[i].correct) wCorrect += w;
  }
  const value = (wCorrect + priorStrength * priorMean) / (wTotal + priorStrength);
  const confidence = wTotal / (wTotal + 3);
  return {
    value,
    confidence,
    observations: list.length,
    level: masteryLevel(list.length === 0 ? 0 : value, list.length),
  };
}

/**
 * Band a mastery value. A concept with no evidence is always "new", and one
 * with a single observation never reads better than "learning" -- one right
 * answer is not mastery.
 *
 * Thresholds are calibrated against estimateMastery's ~0.88 ceiling (see
 * its note), so a sustained run of correct answers actually reaches
 * "mastered" instead of stalling one band short forever.
 * @param {number} value 0..1
 * @param {number} [observations]
 * @returns {string} one of MASTERY_LEVELS
 */
export function masteryLevel(value, observations = 0) {
  if (observations === 0) return "new";
  if (observations < 2) return value >= 0.5 ? "learning" : "new";
  if (value >= 0.85) return "mastered";
  if (value >= 0.7) return "proficient";
  if (value >= 0.5) return "familiar";
  return "learning";
}

/**
 * Mastery for a concept from its SRS card alone, blending how well it has
 * been graded with how likely it is to be recallable right now. A card
 * answered perfectly six months ago is not mastered today.
 * @param {object} card an srs.js card
 * @param {{now?: Date|number|string, priorMean?: number}} [opts]
 * @returns {{value: number, confidence: number, observations: number, level: string, retrievability: number}}
 */
export function masteryFromCard(card, opts = {}) {
  // Only a genuine pass (GOOD/EASY) is evidence of knowing. Grade 3 is
  // HARD, and every producer of 3 in this codebase means "shaky or wrong"
  // (near-miss typed answer, multi-try match, flagged guess). Mapping
  // g >= 3 to correct here meant typing the exact OPPOSITE of an answer
  // ("revocable" for irrevocable) accumulated as mastery evidence and
  // promoted the concept to "proficient".
  const recent = (card?.recent ?? []).map((r) => ({ correct: r.g >= 4 }));
  const base = estimateMastery(recent, { priorMean: opts.priorMean ?? 0.25 });
  const r = retrievability(card, opts.now);
  // Measured against the schedule, not against perfect recall: an interval
  // is *defined* as the point where retrievability decays to ~0.9, so a card
  // reviewed exactly when due is on target and must not be docked for it.
  // (Docking it compounds with estimateMastery's own ceiling and puts
  // "mastered" out of reach of a learner who does everything right.) Only
  // falling behind schedule pulls the estimate down, and only partway: this
  // is a model of forgetting, not evidence of it.
  const onSchedule = Math.min(1, r / 0.9);
  const value = base.value * (0.5 + 0.5 * onSchedule);
  return {
    ...base,
    value,
    level: masteryLevel(recent.length === 0 ? 0 : value, recent.length),
    retrievability: r,
  };
}

/**
 * Roll per-concept mastery up to a group (module, lesson, whole deck).
 * @param {Array<{value: number, level: string}>} masteries
 * @returns {{value: number, count: number, byLevel: Object<string, number>}}
 */
export function summarizeMastery(masteries) {
  const list = masteries ?? [];
  const byLevel = Object.fromEntries(MASTERY_LEVELS.map((l) => [l, 0]));
  let sum = 0;
  for (const m of list) {
    sum += m.value;
    if (byLevel[m.level] !== undefined) byLevel[m.level]++;
  }
  return { value: list.length ? sum / list.length : 0, count: list.length, byLevel };
}

/**
 * Turn a judged answer into an SRS grade. Deliberately conservative: a
 * typo-tolerated hit is still a real recall (GOOD), but only a clean, fast
 * exact answer earns EASY, and a `near` miss is HARD rather than AGAIN --
 * the learner knew it and slipped, so the interval should shrink, not reset.
 * @param {{correct: boolean, near?: boolean, reason?: string}} match a matchAnswer() result
 * @param {{ms?: number, fastMs?: number}} [opts]
 * @returns {number} an srs.js GRADE value
 */
export function gradeFromMatch(match, opts = {}) {
  const fastMs = opts.fastMs ?? 6000;
  if (!match.correct) return match.near ? 3 : 0;
  if (match.reason === "exact" || match.reason === "numeric") {
    return (opts.ms ?? Infinity) <= fastMs ? 5 : 4;
  }
  return 4;
}
