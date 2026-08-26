import { test } from "node:test";
import assert from "node:assert/strict";
import { SERIES65_MODULES, SERIES65_META } from "../data/certs/series65.js";
import { SERIES65_BANK } from "../data/certs/series65-bank.js";

const KNOWN_SECTIONS = ["economic", "vehicles", "client", "laws"];

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

test("SERIES65_META describes the correct blueprint totals", () => {
  assert.equal(SERIES65_META.scoredQuestions, 130);
  assert.equal(SERIES65_META.minutesAllotted, 180);
  assert.equal(SERIES65_META.passingCount, 94);
  assert.equal(SERIES65_META.sections.length, 4);
  const totalWeight = SERIES65_META.sections.reduce((sum, s) => sum + s.weightPct, 0);
  assert.equal(totalWeight, 100);
  for (const s of SERIES65_META.sections) {
    assert.ok(KNOWN_SECTIONS.includes(s.id), `unknown section id ${s.id}`);
  }
});

test("SERIES65_MODULES has at least 5 modules, each matching data/curriculum.js's MODULES shape", () => {
  assert.ok(Array.isArray(SERIES65_MODULES));
  assert.ok(SERIES65_MODULES.length >= 5, "expected at least 5 modules");

  for (const mod of SERIES65_MODULES) {
    assert.equal(typeof mod.id, "string");
    assert.equal(typeof mod.title, "string");
    assert.equal(typeof mod.icon, "string");
    assert.equal(typeof mod.color, "string");
    assert.equal(typeof mod.light, "string");
    assert.equal(typeof mod.description, "string");
    assert.equal(typeof mod.coopModule, "string");
    assert.ok(Array.isArray(mod.lessons));
    assert.ok(mod.lessons.length >= 1, `${mod.id}: must have at least 1 lesson`);
  }
});

test("every lesson matches data/curriculum.js's lesson shape", () => {
  for (const mod of SERIES65_MODULES) {
    for (const lesson of mod.lessons) {
      const where = `${mod.id}/${lesson.id}`;
      assert.equal(typeof lesson.id, "string", where);
      assert.equal(typeof lesson.title, "string", where);
      assert.equal(typeof lesson.minutes, "number", where);
      assert.ok(lesson.minutes > 0, where);
      assert.ok(Array.isArray(lesson.body), where);
      assert.ok(lesson.body.length > 0, where);
      for (const p of lesson.body) assert.equal(typeof p, "string", where);
      assert.equal(typeof lesson.challenge, "string", where);
      assert.equal(typeof lesson.exampleOutput, "string", where);
      assert.ok(Array.isArray(lesson.quiz), where);
      assert.ok(lesson.quiz.length >= 1, `${where}: expects at least 1 quiz item`);
      for (const item of lesson.quiz) assertQuizItemShape(item, `${where} quiz`);
    }
  }
});

test("all module ids and lesson ids are unique across the track", () => {
  const moduleIds = SERIES65_MODULES.map((m) => m.id);
  assert.equal(new Set(moduleIds).size, moduleIds.length, "duplicate module id");

  const lessonIds = SERIES65_MODULES.flatMap((m) => m.lessons.map((l) => l.id));
  assert.equal(new Set(lessonIds).size, lessonIds.length, "duplicate lesson id");
});

test("every module declares a known examSection matching SERIES65_META", () => {
  const sectionIds = new Set(SERIES65_META.sections.map((s) => s.id));
  for (const mod of SERIES65_MODULES) {
    assert.ok(sectionIds.has(mod.examSection), `${mod.id}: unknown examSection ${mod.examSection}`);
  }
});

test("SERIES65_BANK has a substantial number of questions, each with a valid quiz-item shape", () => {
  assert.ok(Array.isArray(SERIES65_BANK));
  // The exam is 130 scored questions; a bank of ~300 means two mock exams drawn from it see
  // largely non-overlapping items (130 * 2 = 260 < 300), rather than recycling the same ~150 twice.
  assert.ok(SERIES65_BANK.length >= 280, `expected a bank sized for two independent 130-question mocks; got ${SERIES65_BANK.length}`);

  const ids = new Set();
  for (const item of SERIES65_BANK) {
    assert.equal(typeof item.id, "string");
    assert.ok(!ids.has(item.id), `duplicate bank id ${item.id}`);
    ids.add(item.id);

    assert.ok(KNOWN_SECTIONS.includes(item.section), `${item.id}: unknown section ${item.section}`);
    assertQuizItemShape(item, item.id);
  }
});

test("SERIES65_BANK section distribution closely matches blueprint weight", () => {
  const counts = { economic: 0, vehicles: 0, client: 0, laws: 0 };
  for (const item of SERIES65_BANK) counts[item.section] += 1;

  const total = SERIES65_BANK.length;
  // The bank is sized to hit blueprint weight closely (economic ~15%, vehicles ~25%,
  // client ~30%, laws ~30%) rather than just "roughly" — tight bounds around each target.
  assert.ok(Math.abs(counts.economic / total - 0.15) <= 0.03, `economic off blueprint weight: ${counts.economic}/${total}`);
  assert.ok(Math.abs(counts.vehicles / total - 0.25) <= 0.03, `vehicles off blueprint weight: ${counts.vehicles}/${total}`);
  assert.ok(Math.abs(counts.client / total - 0.30) <= 0.03, `client off blueprint weight: ${counts.client}/${total}`);
  assert.ok(Math.abs(counts.laws / total - 0.30) <= 0.03, `laws off blueprint weight: ${counts.laws}/${total}`);

  // Sections 3 + 4 (client + laws) should combine for the majority, per the 60%-combined blueprint.
  assert.ok((counts.client + counts.laws) / total > 0.5, "client+laws should be the majority of the bank");
});

test("every bank question text is unique (no accidental duplicates)", () => {
  const questions = SERIES65_BANK.map((item) => item.q);
  assert.equal(new Set(questions).size, questions.length, "duplicate question text found in bank");
});

test("no near-duplicate questions in the bank (expanding must add real coverage, not reworded repeats)", () => {
  // Normalize by lowercasing, stripping punctuation/numbers-as-tokens noise, and collapsing
  // whitespace, then compare word-overlap (Jaccard similarity) across every pair of questions.
  // A pair that differs from another only by swapped numbers or a synonym or two — testing the
  // exact same fact — would score very high here; distinct-but-related items (e.g. "peak" vs.
  // "trough", "T-bill" vs. "T-note" maturities) score meaningfully lower. The threshold below sits
  // above every legitimate complementary pair actually present in the bank (highest observed ~0.75)
  // and would have caught a real near-duplicate this expansion introduced and then fixed (~0.86).
  const SIMILARITY_THRESHOLD = 0.8;

  function normalize(text) {
    return text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  }
  function wordSet(text) {
    return new Set(normalize(text).split(" ").filter((w) => w.length > 2));
  }
  function jaccard(a, b) {
    let intersection = 0;
    for (const w of a) if (b.has(w)) intersection += 1;
    const union = new Set([...a, ...b]).size;
    return union === 0 ? 0 : intersection / union;
  }

  const items = SERIES65_BANK.map((item) => ({ id: item.id, words: wordSet(item.q) }));
  const nearDuplicates = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const similarity = jaccard(items[i].words, items[j].words);
      if (similarity >= SIMILARITY_THRESHOLD) {
        nearDuplicates.push(`${items[i].id} ~ ${items[j].id} (${similarity.toFixed(2)})`);
      }
    }
  }

  assert.equal(
    nearDuplicates.length,
    0,
    `found near-duplicate question(s), which defeats the point of expanding the bank: ${nearDuplicates.join(", ")}`,
  );
});

test("every bank item's four options are internally consistent (unique, correct answer present exactly once)", () => {
  for (const item of SERIES65_BANK) {
    assert.equal(item.options.length, 4, `${item.id}: expected exactly 4 options`);
    const texts = item.options.map((o) => o.text);
    assert.equal(new Set(texts).size, 4, `${item.id}: option texts must all be unique`);
    assert.equal(
      texts.filter((t) => t === item.a).length,
      1,
      `${item.id}: correct answer must appear exactly once among its own options`,
    );
  }
});

// ── Option-set duplication ──
//
// An identical option set is NOT by itself a defect, and a check that says otherwise is a
// trap for the next author. Where the subject matter IS a small closed taxonomy, offering
// that taxonomy's four members as the four options is the correct question design — the
// item is asking the learner to place a scenario within it, so the options SHOULD be the
// same four every time. s65b-cli-81 and s65b-cli-82 are exactly that: both offer
// PV/FV x annuity/single-sum, one keyed "Present value of an annuity" (lump sum needed
// today to fund equal future withdrawals), the other "Future value of an annuity" (fixed
// contributions each year toward a goal). That pair is coverage, not repetition, and it is
// the most valuable kind — the four concepts are confusable precisely because they share a
// taxonomy, so contrasting them side by side is the whole point.
//
// The real invariant is the one below: the same option set AND the same keyed answer is
// the same question twice — no added coverage, and it skews a drawn form toward one point.
// A differing key means the pair teaches different facts, which is the contrast pair above.
// This is the same rule the near-duplicate sweep applies to question wording; it is applied
// here to option sets because an author can reword a question past the similarity threshold
// while leaving the options and the key untouched.
test("no two bank items share an identical option set AND the same keyed answer (the same question twice)", () => {
  const seen = new Map();
  for (const item of SERIES65_BANK) {
    const optionSet = item.options
      .map((o) => String(o.text).trim().toLowerCase())
      .sort()
      .join("|");
    const sig = `${optionSet}=>${String(item.a).trim().toLowerCase()}`;
    assert.ok(
      !seen.has(sig),
      `${item.id} duplicates ${seen.get(sig)}: same four options, same keyed answer (${JSON.stringify(item.a)}) — replace one, do not delete it`,
    );
    seen.set(sig, item.id);
  }
});

/**
 * The bank's DEPTH is a content claim, so it is asserted here rather than in
 * test/exam.test.js — that file tests the engine, and an engine test that reads
 * the real bank is really asserting how much content someone happened to write.
 * (One did, and it broke the moment this bank grew 300 -> 520.)
 *
 * Measured through the path the app actually takes: lib/exam/ seeds every cert
 * with an EMPTY bank, and data/registry.js is what registers the real one. This
 * bank's section slugs are already the blueprint's own section ids, so unlike
 * SIE it needs no translation on the way in — but it does need REGISTERING, and
 * without that import below the engine honestly reports a bank of zero.
 * Counting the RAW bank instead would also silently read zero for any slug the
 * blueprint has no alias for — a false alarm I walked into once already.
 */
test("the bank supports four distinct full-length mocks, measured the way the app draws them", async () => {
  await import("../data/registry.js"); // registers the bank into the engine
  const { getExam } = await import("../lib/exam/banks.js");
  const { countBySection, allocate, maxFaithfulLength } = await import("../lib/exam/blueprint.js");

  const exam = getExam("series65");
  const bank = exam.bank ?? exam.items;
  const blueprint = exam.blueprint;

  assert.equal(
    maxFaithfulLength(blueprint, bank),
    blueprint.scoredQuestions,
    "the bank must fill a full-length on-blueprint form, not a short indicative one",
  );

  const counts = countBySection(blueprint, bank);
  const quota = allocate(blueprint, blueprint.scoredQuestions);

  for (const [section, held] of Object.entries(counts)) {
    const perForm = quota[section];
    assert.ok(
      held >= perForm * 4,
      `section "${section}" holds ${held} against a ${perForm}-question quota — ` +
        `${(held / perForm).toFixed(2)} distinct forms. Below 4, a fourth mock recycles, and a ` +
        `remembered answer scores like a known one.`,
    );
  }

  // The floor asserted here is 4x — the PROMISE (four distinct full-length mocks) — and
  // it deliberately does NOT track the bank's actual size, which is now 6x in every
  // section (data/certs/expansion/index.js).
  //
  // That gap is the point. This note used to read "every section sits at EXACTLY 4x
  // quota — there is zero slack", because the bank had been built right down to the
  // floor the test asserted. Retracting one wrong item for accuracy dropped the cert to
  // three forms, so a correction could only ever be a careful swap, never a deletion —
  // the bank was simultaneously at its promised depth and unmaintainable. Twelve items
  // did turn out to be factually wrong, which is exactly when you want deletion to be
  // cheap.
  //
  // So: do not "tighten" this to >= 6 to match the current size. That would recreate the
  // same trap one bank-size higher. The floor is what we owe the learner; the surplus
  // above it is what lets us fix things.
  const forms = Math.min(...Object.entries(counts).map(([s, n]) => n / quota[s]));
  assert.ok(forms >= 4, `bank supports ${forms.toFixed(2)} distinct forms; want >= 4`);
});
