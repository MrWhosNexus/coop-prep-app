#!/usr/bin/env node
// scripts/bank-dupe-sweep.mjs
//
// Reports candidate duplicate items across the WHOLE of both question banks, for a
// human to read. Run it after authoring any new bank content:
//
//   node scripts/bank-dupe-sweep.mjs
//
// WHY THIS IS A SCRIPT AND NOT A TEST.
//
// The test suite already sweeps for near-duplicates, but it gates on the two items
// having an IDENTICAL keyed answer (see test/cert-sie-bank.test.js). That gate is
// deliberate and correct: the banks deliberately run complementary CONTRAST pairs in
// parallel phrasing — premium vs discount, call vs put, T-notes vs T-bonds — which
// share most of their words while teaching opposite facts. Keying on answer equality
// makes those pairs immune by construction.
//
// The gate has a hole: a genuine duplicate whose keyed answers are PARAPHRASES of each
// other rather than identical strings. Three such duplicates were written by concurrent
// authoring batches and every one of them passed the full green suite:
//
//   sieb-pr-x118 / sieb-pr-x204   LGIP defined twice
//   s65-lw-x105  / s65-lw-x216    custody quarterly statements twice
//   s65b-law-64  / s65-lw-x107    contract-not-assignable-without-consent twice
//
// You cannot close that hole with a lexical threshold. Measured on the real banks:
//
//   pair                             key-sim   question-sim   verdict
//   premium vs discount bond          0.75        0.75        LEGITIMATE
//   s65b-law-64 vs s65-lw-x107        0.50        0.64        DUPLICATE
//
// The legitimate pair scores HIGHER on both axes than the real duplicate. The real
// signal is semantic, not lexical — a contrast pair's keys differ by an antonym
// ("higher"/"lower"), a duplicate's differ by a synonym. Any threshold that catches the
// duplicates fails the good pairs, and the only way to make it green again is to
// allowlist them by id — a hand-written coverage list, which is the exact antipattern
// that let these ship in the first place.
//
// So this reports; it does not assert. It is tuned to over-report: read every pair it
// prints and decide. A pair is a DUPLICATE if it teaches the same fact twice. It is a
// CONTRAST PAIR, and worth keeping, if the keyed facts differ.
//
// Exit code is always 0 — a candidate list is not a failure.

import { readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Question/answer text reduced to comparable tokens. Mirrors the suite's normQ. */
const normQ = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const STOPWORDS = new Set(
  "a an the of to in for is are which what best describes following that and or on as by with be it its most likely would".split(" "),
);
const tokens = (s) => new Set(normQ(s).split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w)));

function jaccard(a, b) {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

/** Report a pair when the QUESTIONS are this similar. Deliberately low — over-report, then read. */
const QUESTION_THRESHOLD = 0.45;

const { SIE_BANK } = await import(`${ROOT}/data/certs/sie-bank.js`);
const { SERIES65_BANK } = await import(`${ROOT}/data/certs/series65-bank.js`);

/** Which file each expansion item came from, so a reported pair is actionable. */
const origin = new Map();
const expansionDir = join(ROOT, "data/certs/expansion");
if (existsSync(expansionDir)) {
  for (const f of readdirSync(expansionDir).filter((f) => f.endsWith(".js") && f !== "index.js").sort()) {
    const mod = await import(`${expansionDir}/${f}`);
    for (const arr of Object.values(mod)) {
      if (!Array.isArray(arr)) continue;
      for (const item of arr) origin.set(item.id, `expansion/${f}`);
    }
  }
}

const items = [
  ...SIE_BANK.map((i) => ({ ...i, cert: "sie" })),
  ...SERIES65_BANK.map((i) => ({ ...i, cert: "series65" })),
].map((i) => ({
  id: i.id,
  cert: i.cert,
  section: String(i.section),
  q: i.q,
  a: i.a,
  file: origin.get(i.id) ?? "base bank",
  qt: tokens(i.q),
  kt: tokens(i.a),
}));

const pairs = [];
for (let i = 0; i < items.length; i++) {
  for (let j = i + 1; j < items.length; j++) {
    const A = items[i];
    const B = items[j];
    // Only same-cert, same-section pairs can be duplicates of each other.
    if (A.cert !== B.cert || A.section !== B.section) continue;
    const qs = jaccard(A.qt, B.qt);
    if (qs < QUESTION_THRESHOLD) continue;
    pairs.push({ A, B, qs, ks: jaccard(A.kt, B.kt), sameKey: normQ(A.a) === normQ(B.a) });
  }
}
pairs.sort((x, y) => y.qs - x.qs);

console.log(`swept ${items.length} items (SIE ${SIE_BANK.length} + Series 65 ${SERIES65_BANK.length})`);
console.log(`${pairs.length} candidate pair(s) at question-similarity >= ${QUESTION_THRESHOLD}\n`);
console.log("Read each pair. Same fact twice => duplicate, replace one (never delete: the item");
console.log("count is what buys the bank its slack). Different keyed fact => contrast pair, keep.\n");

for (const p of pairs) {
  const flag = p.sameKey ? "  <-- IDENTICAL KEY: the suite catches this one" : "";
  console.log(`[q=${p.qs.toFixed(2)} key=${p.ks.toFixed(2)}] ${p.A.cert}/${p.A.section}${flag}`);
  console.log(`  ${p.A.id}  (${p.A.file})`);
  console.log(`    Q: ${p.A.q}`);
  console.log(`    A: ${p.A.a}`);
  console.log(`  ${p.B.id}  (${p.B.file})`);
  console.log(`    Q: ${p.B.q}`);
  console.log(`    A: ${p.B.a}`);
  console.log();
}
