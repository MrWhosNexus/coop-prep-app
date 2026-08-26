import { test } from "node:test";
import assert from "node:assert/strict";
import { SIE_BLUEPRINT, SIE_MODULES } from "../data/certs/sie.js";
import { SIE_BANK } from "../data/certs/sie-bank.js";
import { SIE_SECTION_IDS } from "../data/registry.js";
import { sieBlueprint } from "../lib/exam/banks.js";
import { countBySection, maxFaithfulLength, allocate, resolveSection } from "../lib/exam/blueprint.js";

// SIE_BANK tags items with a semantic section key (mirroring the pattern SERIES65_BANK already
// uses), rather than the raw numeric SIE_BLUEPRINT id. data/registry.js owns the slug -> blueprint
// id map and applies it at registerBank() time; we import that same map rather than restating it,
// so a divergence between this test and the real wiring is impossible by construction.
const SECTION_TO_BLUEPRINT_ID = SIE_SECTION_IDS;
const KNOWN_SECTIONS = Object.keys(SECTION_TO_BLUEPRINT_ID);

/** The bank as the exam engine actually sees it: slugs resolved to blueprint ids, exactly as data/registry.js does. */
const REGISTERED_BANK = SIE_BANK.map((item) => ({
  ...item,
  section: SECTION_TO_BLUEPRINT_ID[item.section] ?? item.section,
}));

const norm = (s) => String(s).trim().toLowerCase();
/** Question text reduced to comparable form: punctuation and spacing are not meaning. */
const normQ = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Validates a single quiz-item shape shared by both lesson quizzes and bank items. */
function assertQuizItemShape(item, where) {
  assert.equal(typeof item.q, "string", `${where}: q must be a string`);
  assert.ok(item.q.length > 0, `${where}: q must not be empty`);
  assert.equal(typeof item.a, "string", `${where}: a must be a string`);
  assert.equal(typeof item.explanation, "string", `${where}: explanation must be a string`);
  assert.ok(item.explanation.length > 0, `${where}: explanation must not be empty`);
  assert.ok(Array.isArray(item.options), `${where}: options must be an array`);
  assert.ok(item.options.length >= 2, `${where}: options must have at least 2 choices`);

  for (const opt of item.options) {
    assert.equal(typeof opt.text, "string", `${where}: option.text must be a string`);
    assert.ok(opt.text.length > 0, `${where}: option.text must not be empty`);
    assert.equal(typeof opt.explanation, "string", `${where}: option.explanation must be a string`);
    assert.ok(opt.explanation.length > 0, `${where}: option.explanation must not be empty`);
  }

  // options must be unique text values
  const texts = item.options.map((o) => o.text);
  assert.equal(new Set(texts).size, texts.length, `${where}: option texts must be unique`);

  // `a` must match exactly one option's text (the correct answer)
  const matches = texts.filter((t) => t === item.a);
  assert.equal(matches.length, 1, `${where}: 'a' (${JSON.stringify(item.a)}) must match exactly one option.text`);
}

test("SIE_BLUEPRINT still describes the four scored sections at their real exam weights", () => {
  assert.equal(SIE_BLUEPRINT.length, 4);
  const totalWeight = SIE_BLUEPRINT.reduce((sum, s) => sum + s.weight, 0);
  assert.ok(Math.abs(totalWeight - 1) < 0.01, `blueprint weights should sum to ~1, got ${totalWeight}`);

  const byId = Object.fromEntries(SIE_BLUEPRINT.map((s) => [s.id, s]));
  assert.ok(byId[1].weight > 0.1 && byId[1].weight < 0.2, "section 1 weight should be ~16%");
  assert.ok(byId[2].weight > 0.4, "section 2 (products/risks) should be the largest, ~44%");
  assert.ok(byId[3].weight > 0.25 && byId[3].weight < 0.35, "section 3 weight should be ~31%");
  assert.ok(byId[4].weight < 0.15, "section 4 weight should be the smallest, ~9%");
});

test("every SIE_MODULES blueprintSection is a known SIE_BLUEPRINT id", () => {
  const blueprintIds = new Set(SIE_BLUEPRINT.map((s) => s.id));
  assert.ok(Array.isArray(SIE_MODULES));
  assert.ok(SIE_MODULES.length > 0);
  for (const mod of SIE_MODULES) {
    assert.ok(blueprintIds.has(mod.blueprintSection), `${mod.id}: unknown blueprintSection ${mod.blueprintSection}`);
  }
});

test("SIE_BANK has a substantial number of questions, each with a valid quiz-item shape", () => {
  assert.ok(Array.isArray(SIE_BANK));
  assert.ok(SIE_BANK.length >= 290, `expected a substantial bank; got ${SIE_BANK.length}`);

  const ids = new Set();
  for (const item of SIE_BANK) {
    assert.equal(typeof item.id, "string", `bank item missing string id: ${JSON.stringify(item.q)}`);
    assert.ok(!ids.has(item.id), `duplicate bank id ${item.id}`);
    ids.add(item.id);

    assert.ok(KNOWN_SECTIONS.includes(item.section), `${item.id}: unknown section ${item.section}`);
    assertQuizItemShape(item, item.id);
  }
});

// ── The defect that shipped once already ──
// An item whose keyed answer is not among its options is unanswerable: every choice
// marks wrong, and the learner is taught that their correct reasoning was incorrect.
// assertQuizItemShape covers this, but it is restated standalone and unconditionally
// over the whole bank because it is the single highest-cost defect this file can catch.
test("every item in the merged bank has exactly ONE correct answer, present verbatim among its options", () => {
  for (const item of SIE_BANK) {
    const exact = item.options.filter((o) => o.text === item.a);
    assert.equal(
      exact.length,
      1,
      `${item.id}: keyed answer must appear verbatim exactly once among its options — ` +
      `found ${exact.length}. This item is unanswerable. Keyed: ${JSON.stringify(item.a)}; ` +
      `options: ${JSON.stringify(item.options.map((o) => o.text))}`,
    );
  }
});

test("every option in the merged bank carries a non-empty explanation", () => {
  for (const item of SIE_BANK) {
    for (const opt of item.options) {
      assert.ok(
        typeof opt.explanation === "string" && opt.explanation.trim().length > 0,
        `${item.id}: option ${JSON.stringify(opt.text)} has no explanation — a distractor without a reason teaches nothing`,
      );
    }
  }
});

test("no item repeats an option text within itself (normalised on trim + case)", () => {
  for (const item of SIE_BANK) {
    const texts = item.options.map((o) => norm(o.text));
    assert.equal(
      new Set(texts).size,
      texts.length,
      `${item.id}: duplicate option text — two identical choices cannot both be gradeable`,
    );
  }
});

test("every SIE_BANK item's section resolves to a real SIE_BLUEPRINT section id", () => {
  const blueprintIds = new Set(SIE_BLUEPRINT.map((s) => s.id));
  for (const item of SIE_BANK) {
    const resolved = SECTION_TO_BLUEPRINT_ID[item.section];
    assert.ok(blueprintIds.has(resolved), `${item.id}: section ${item.section} does not resolve to a known blueprint id`);
  }
});

// The check above proves the slug maps to a SIE_BLUEPRINT id. This one proves the
// resolved id survives the engine's own lookup — an item the blueprint cannot resolve
// is silently dropped from every form rather than failing loudly, so it would otherwise
// vanish from the bank without any test noticing.
test("every item's section resolves through the real blueprint's own resolveSection()", () => {
  const bp = sieBlueprint();
  for (const item of REGISTERED_BANK) {
    const section = resolveSection(bp, item.section);
    assert.ok(section, `${item.id}: section ${JSON.stringify(item.section)} does not resolve against sieBlueprint() — it would be dropped from every drawn form`);
  }
  // And nothing is lost in aggregate: every item lands in some section's pool.
  const have = countBySection(bp, REGISTERED_BANK);
  const pooled = Object.values(have).reduce((a, b) => a + b, 0);
  assert.equal(pooled, SIE_BANK.length, "every bank item should land in exactly one blueprint section pool");
});

test("SIE_BANK section distribution roughly matches blueprint weight", () => {
  const counts = { "capital-markets": 0, "products-risks": 0, "trading-accounts": 0, regulatory: 0 };
  for (const item of SIE_BANK) counts[item.section] += 1;

  const total = SIE_BANK.length;
  // Loose bounds around the blueprint's 16/44/31/9 split — a real bank need not be exact,
  // but no section should be wildly over- or under-represented relative to its weight.
  assert.ok(counts["capital-markets"] / total >= 0.08, "capital-markets section underrepresented");
  assert.ok(counts["products-risks"] / total >= 0.30, "products-risks section underrepresented");
  assert.ok(counts["trading-accounts"] / total >= 0.18, "trading-accounts section underrepresented");
  assert.ok(counts.regulatory / total >= 0.04, "regulatory section underrepresented");

  // Products-risks alone is the plurality of the real exam (~44%) and should be the largest
  // single section in the bank too.
  assert.ok(
    counts["products-risks"] >= counts["capital-markets"] &&
      counts["products-risks"] >= counts["trading-accounts"] &&
      counts["products-risks"] >= counts.regulatory,
    "products-risks should be the largest section in the bank, matching its ~44% blueprint weight"
  );

  // Regulatory (~9%, the smallest section) should not be over-represented relative to the others.
  assert.ok(counts.regulatory <= counts["capital-markets"], "regulatory should not outweigh capital-markets");
  assert.ok(counts.regulatory <= counts["trading-accounts"], "regulatory should not outweigh trading-accounts");
});

test("every bank question text is unique (no accidental duplicates)", () => {
  const questions = SIE_BANK.map((item) => item.q);
  assert.equal(new Set(questions).size, questions.length, "duplicate question text found in bank");
});

test("no two bank items share a question that differs only in punctuation or casing", () => {
  const seen = new Map();
  for (const item of SIE_BANK) {
    const key = normQ(item.q);
    assert.ok(
      !seen.has(key),
      `${item.id} duplicates ${seen.get(key)}'s question once punctuation and casing are normalised: ${JSON.stringify(item.q)}`,
    );
    seen.set(key, item.id);
  }
});

// This check used to fire on an identical option set ALONE. That passed only by luck — SIE
// happens to contain no taxonomy pair — and it was a landmine for the next author: where the
// subject IS a small closed taxonomy, offering that taxonomy's members as the four options is
// the correct design, and the same four options SHOULD recur. Series 65 has such a pair today
// (s65b-cli-81/82: PV/FV x annuity/single-sum, keyed differently), so the old rule was not a
// universal truth and would have rejected good work the moment someone wrote the SIE equivalent.
//
// The invariant that IS true, and what this always meant to catch: same option set AND same
// keyed answer is the same question twice — no added coverage, and it skews a drawn form toward
// one point. A differing key means the two items teach different facts, which is a contrast
// pair. That is the same rule the near-duplicate sweep below applies to question wording; it is
// applied here to option sets because an author can reword a question past the sweep's
// similarity threshold while leaving the options and the key untouched.
test("no two bank items share an identical option set AND the same keyed answer (the same question twice)", () => {
  const seen = new Map();
  for (const item of SIE_BANK) {
    const optionSet = item.options
      .map((o) => norm(o.text))
      .sort()
      .join("|");
    const sig = `${optionSet}=>${norm(item.a)}`;
    assert.ok(
      !seen.has(sig),
      `${item.id} duplicates ${seen.get(sig)}: same four options, same keyed answer (${JSON.stringify(item.a)}) — replace one, do not delete it`,
    );
    seen.set(sig, item.id);
  }
});

// ── Near-duplicate sweep across the WHOLE bank, new items vs existing included ──
//
// Question-text similarity ALONE is the wrong signal here, and testing on it would be
// worse than testing nothing. The bank deliberately runs complementary pairs in parallel
// phrasing — "A bond trading at a premium..." / "...at a discount...", call vs put,
// cumulative vs non-cumulative preferred, T-notes vs T-bonds. Those share most of their
// words while teaching opposite facts, and they are exactly the contrast a learner needs.
// A pure-similarity threshold either fires on all of them or is set so high it catches
// nothing.
//
// The real duplicate signature is a question that is BOTH worded like another AND keyed
// to the same answer — the same fact asked twice, which inflates the bank's apparent depth
// while adding no coverage and skewing a drawn form toward one point. The complementary
// pairs are immune by construction: their keys differ. Measured headroom is wide — the
// most similar same-key pair in the merged bank scores 0.087 (sieb-rf-02 "U5 filing
// deadline" vs sieb-rf-11 "exam retake wait", both keyed "30 days" but testing unrelated
// facts), against a 0.60 threshold and a true paraphrase scoring near 1.0.
const STOPWORDS = new Set(
  "a an the of to in for is are which what best describes following that and or on as by with be it its".split(" "),
);
const contentTokens = (s) => new Set(normQ(s).split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w)));
function jaccard(a, b) {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

test("no near-duplicate items across the whole bank (same section, same keyed answer, near-identical wording)", () => {
  const items = SIE_BANK.map((i) => ({ id: i.id, q: i.q, section: i.section, key: norm(i.a), tokens: contentTokens(i.q) }));
  const offenders = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const A = items[i];
      const B = items[j];
      if (A.section !== B.section) continue;
      if (A.key !== B.key) continue; // different fact taught — a complementary pair, not a duplicate
      const score = jaccard(A.tokens, B.tokens);
      if (score >= 0.6) {
        offenders.push(`${A.id} ~ ${B.id} (${score.toFixed(2)}, both keyed ${JSON.stringify(A.key)}): ${A.q} || ${B.q}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `near-duplicate items found — delete one of each pair:\n${offenders.join("\n")}`);
});

// ── Stale-fact sweep ──
//
// Asserted on the KEYED answer, never on option text. A retired rule is a *good*
// distractor — it is what a stale source says, so a learner who has absorbed one picks it
// and gets corrected. The defect is a retired rule being marked CORRECT.

/** Historical framing: "shortened from T+2 to T+1", "the prior T+2 cycle". Naming a dead rule to contrast it is teaching, not asserting it. */
const HISTORICAL = /\b(prior|previous|former|formerly|old|older|until|before|shortened|moved|changed|used to|no longer|legacy|era|was)\b/i;

test("no item anywhere in the merged bank keys T+2 as the current settlement cycle", () => {
  const offenders = SIE_BANK.filter((i) => /\bT\s*\+\s*2\b/i.test(i.a) && !HISTORICAL.test(i.a))
    .map((i) => `${i.id}: ${JSON.stringify(i.a)}`);
  assert.deepEqual(
    offenders,
    [],
    `settlement has been T+1 since May 2024 — these keyed answers assert T+2 as current:\n${offenders.join("\n")}`,
  );
});

test("no item's own explanation teaches T+2 as the current settlement cycle", () => {
  const offenders = [];
  for (const item of SIE_BANK) {
    // The item explanation and the CORRECT option's explanation are what a learner is told
    // is true. A wrong option's explanation saying "T+2 is not the rule" is correct teaching.
    const teaching = [item.explanation, item.options.find((o) => o.text === item.a)?.explanation ?? ""];
    for (const text of teaching) {
      if (/\bT\s*\+\s*2\b/i.test(text) && !HISTORICAL.test(text)) offenders.push(`${item.id}: ${JSON.stringify(text)}`);
    }
  }
  assert.deepEqual(offenders, [], `these explanations present T+2 as current:\n${offenders.join("\n")}`);
});

test("the bank does key T+1 settlement somewhere (the sweep above is not passing by absence)", () => {
  const t1 = SIE_BANK.filter((i) => /\bT\s*\+\s*1\b/i.test(i.a));
  assert.ok(t1.length > 0, "expected at least one item keyed to the current T+1 settlement cycle");
});

test("no item anywhere in the merged bank keys the retired pre-2023 'second anniversary' CE rule", () => {
  const offenders = SIE_BANK.filter((i) => /second anniversary/i.test(i.a)).map((i) => `${i.id}: ${JSON.stringify(i.a)}`);
  assert.deepEqual(
    offenders,
    [],
    `FINRA Rule 1240 dropped the 'second anniversary' schedule effective 1/1/2023 — these keyed answers assert it:\n${offenders.join("\n")}`,
  );
});

test("sieb-rf-08 tests the CURRENT (post-1/1/2023) FINRA Rule 1240 Regulatory Element schedule, not the retired 'second anniversary' rule", () => {
  const item = SIE_BANK.find((i) => i.id === "sieb-rf-08");
  assert.ok(item, "expected bank item sieb-rf-08 to exist");

  assert.ok(
    !/second anniversary/i.test(item.a),
    `keyed answer is the retired pre-2023 rule: ${JSON.stringify(item.a)}`
  );
  assert.ok(/annually/i.test(item.a) && /december 31/i.test(item.a), "keyed answer should state the current annual, by Dec 31, rule");

  const matches = item.options.filter((o) => o.text === item.a);
  assert.equal(matches.length, 1, "keyed answer must match exactly one option (the item must be answerable-correctly)");

  assert.ok(
    !/second anniversary/i.test(item.explanation),
    "top-level explanation still reinforces the retired 'second anniversary' schedule"
  );
});

// ── The payoff ──
//
// Section counts are what actually gate a mock. A form is 12/33/23/7 across sections 1-4,
// so N distinct full forms needs N x quota in EVERY section — the thinnest section binds,
// and a bank can look big in total while supporting one sitting. Measured against the real
// sieBlueprint() and the real allocate()/countBySection(), not a restated mapping: if the
// engine's split ever changes, this test follows it rather than asserting a stale target.
//
// The 4x here is the PROMISE, and it deliberately does not track the bank's actual size,
// which is 6x in every section (data/certs/expansion/index.js). Do not tighten it to 6.
// The bank previously sat at exactly the floor this test asserts, which meant retracting a
// single wrong item for accuracy broke the build — corrections could only ever be careful
// swaps, never deletions. Twelve items did turn out to be factually wrong. The surplus above
// the floor is what makes fixing them cheap; matching the floor to the size destroys it.
test("the merged bank supports 4 distinct full 75-question forms — every section holds >= 4x its per-form quota", () => {
  const bp = sieBlueprint();
  const quotas = allocate(bp, bp.scoredQuestions);
  const have = countBySection(bp, REGISTERED_BANK);

  const shortfalls = [];
  for (const section of bp.sections) {
    const need = quotas[section.id] * 4;
    const got = have[section.id] ?? 0;
    if (got < need) shortfalls.push(`${section.label} (id ${section.id}): has ${got}, needs ${need} for 4 forms (short ${need - got})`);
  }
  assert.deepEqual(shortfalls, [], `bank cannot fill 4 distinct full forms:\n${shortfalls.join("\n")}`);

  // Same claim via the ratio the engine's own reuseInventory() reports to the learner.
  const formsSupported = Math.min(...bp.sections.filter((s) => quotas[s.id] > 0).map((s) => (have[s.id] ?? 0) / quotas[s.id]));
  assert.ok(Math.floor(formsSupported) >= 4, `expected >= 4 distinct full forms, got ${Math.floor(formsSupported)} (${formsSupported.toFixed(2)})`);
});

test("the merged bank can fill a blueprint-faithful form at the real 75-question length", () => {
  const bp = sieBlueprint();
  assert.equal(
    maxFaithfulLength(bp, REGISTERED_BANK),
    bp.scoredQuestions,
    "the bank should support a full-length, on-blueprint mock rather than a short indicative one",
  );
});
