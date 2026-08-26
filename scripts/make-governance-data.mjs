#!/usr/bin/env node
// scripts/make-governance-data.mjs
//
// Builds the data-governance corpus from the clean analytics extract.
//
// WHY this exists: public/data/hmda-sample.csv is 100 rows, 7 columns, and
// perfectly clean. It is exactly right for the fair-lending analytics labs and
// it makes data-governance work impossible to teach — there is nothing to
// profile, no rule that can fail, nothing to reconcile, no duplicate to find.
// A completeness check against a file with no gaps in it teaches nothing.
//
// So this generates two files that look like what actually lands on a governance
// analyst's desk:
//
//   hmda-raw.csv        the "as-extracted" file, carrying the defect classes a
//                       real intake genuinely has
//   hmda-servicing.csv  a second system's extract of the same book, which does
//                       NOT agree with the first — the reconciliation exercise
//
// and a manifest recording precisely which row carries which defect. The
// manifest is the graders' answer key: a lab that asks "find every record with
// a missing income" can be graded exactly, and a lab author cannot quietly
// disagree with the data. Every defect below is injected DETERMINISTICALLY by
// row index — no randomness — so the corpus is reproducible and a test can
// re-derive it.
//
// Regenerate with: node scripts/make-governance-data.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "public", "data", "hmda-sample.csv");
const OUT_RAW = path.join(ROOT, "public", "data", "hmda-raw.csv");
const OUT_SERV = path.join(ROOT, "public", "data", "hmda-servicing.csv");
const OUT_MANIFEST = path.join(ROOT, "data", "governance-manifest.json");

const lines = fs.readFileSync(SRC, "utf8").trim().split("\n");
const header = lines[0].split(",");
const rows = lines.slice(1).map((l) => {
  const c = l.split(",");
  return Object.fromEntries(header.map((h, i) => [h.trim(), (c[i] ?? "").trim()]));
});

/** Defect ledger: which ids carry which class. This IS the answer key. */
const defects = {
  zip_leading_zero_lost: [],
  categorical_variant: [],
  missing_value: [],
  number_stored_as_text: [],
  exact_duplicate: [],
  near_duplicate: [],
  out_of_range: [],
  whitespace_padding: [],
  mixed_date_format: [],
};

// An application date the clean file never had. Governance work is mostly about
// time — cohorts, SLAs, aging — and a single canonical format teaches none of
// the parsing problems that make date columns notorious.
const DATE_FORMATS = [
  (d) => d.toISOString().slice(0, 10),                                  // 2024-03-15
  (d) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`, // 3/15/2024
  (d) => `${String(d.getUTCDate()).padStart(2, "0")}-${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()]}-${d.getUTCFullYear()}`,
];

const RACE_VARIANTS = { Black: ["black", "BLACK", "African American"], White: ["white", "Caucasian"], Hispanic: ["hispanic", "Latino"], Asian: ["asian"] };
const GENDER_VARIANTS = { Male: ["M", "male"], Female: ["F", "female"] };
const APPROVED_VARIANTS = { APPROVED: ["Approved", "Y"], DENIED: ["Denied", "N"] };

const out = [];
rows.forEach((r, i) => {
  const rec = { ...r };
  const id = rec.applicant_id;

  // A date, spread across three formats. Every third row uses a different one.
  const base = new Date(Date.UTC(2024, 0, 4 + (i % 300)));
  const fmt = i % 3;
  rec.application_date = DATE_FORMATS[fmt](base);
  if (fmt !== 0) defects.mixed_date_format.push(id);

  // 1. Leading zeros eaten. The single most common CSV/Excel governance defect:
  //    a zip opened in a spreadsheet and re-saved loses its leading zero and
  //    silently stops joining to anything keyed on the 5-character form.
  if (/^0/.test(rec.zip_code)) {
    rec.zip_code = String(Number(rec.zip_code));
    defects.zip_leading_zero_lost.push(id);
  }

  // 2. Categorical drift. The same real-world value spelled several ways —
  //    what makes a naive GROUP BY undercount every affected cohort.
  if (i % 7 === 3) {
    const v = RACE_VARIANTS[rec.race];
    if (v) { rec.race = v[i % v.length]; defects.categorical_variant.push(id); }
  }
  if (i % 11 === 5) {
    const v = GENDER_VARIANTS[rec.gender];
    if (v) { rec.gender = v[i % v.length]; defects.categorical_variant.push(id); }
  }
  if (i % 13 === 8) {
    const v = APPROVED_VARIANTS[rec.approved];
    if (v) { rec.approved = v[i % v.length]; defects.categorical_variant.push(id); }
  }

  // 3. Missing, in the four spellings that defeat a naive ISBLANK check.
  if (i % 9 === 4) { rec.income = ["", "N/A", "NULL", "-"][i % 4]; defects.missing_value.push(id); }
  if (i % 17 === 7) { rec.race = ""; defects.missing_value.push(id); }

  // 4. Numbers stored as text. SUM ignores them; COUNT counts them; the two
  //    disagree, and the column looks fine until a total comes out low.
  if (i % 6 === 2) { rec.loan_amount = Number(rec.loan_amount).toLocaleString("en-US"); defects.number_stored_as_text.push(id); }
  if (i % 8 === 5 && rec.income && !"N/A NULL -".includes(rec.income)) {
    rec.income = "$" + Number(rec.income).toLocaleString("en-US");
    defects.number_stored_as_text.push(id);
  }

  // 5. Whitespace padding — invisible on screen, fatal to an exact-match join.
  if (i % 19 === 6) { rec.applicant_id = ` ${rec.applicant_id} `; defects.whitespace_padding.push(id); }

  // 6. Values that violate a rule any intake should enforce.
  if (i === 41) { rec.loan_amount = "-45000"; defects.out_of_range.push(id); }
  if (i === 63) { rec.income = "0"; defects.out_of_range.push(id); }
  if (i === 77) { rec.zip_code = "9999"; defects.out_of_range.push(id); }

  out.push(rec);
});

// 7. Duplicates. Two kinds, because they need different techniques to find:
//    an exact repeat (a re-run intake) and a near-duplicate that differs only
//    in formatting (the same application entered twice by two people).
const exactDupes = [12, 55];
for (const i of exactDupes) { out.push({ ...out[i] }); defects.exact_duplicate.push(out[i].applicant_id.trim()); }
const nearDupes = [30, 71];
for (const i of nearDupes) {
  const d = { ...out[i] };
  d.race = String(d.race).toUpperCase();
  d.application_date = DATE_FORMATS[1](new Date(Date.UTC(2024, 0, 4 + (i % 300))));
  out.push(d);
  defects.near_duplicate.push(d.applicant_id.trim());
}

/**
 * CSV-quote a field that needs it.
 *
 * Load-bearing, and caught the hard way: the thousands separators injected as
 * the "number stored as text" defect are COMMAS, and written raw they split one
 * field into two — `192,500` turned an 8-column row into 9 and corrupted every
 * row carrying the defect. Quoting keeps the defect exactly as realistic (a
 * spreadsheet really does hand you "192,500" as text) while leaving the file
 * parseable, which is the whole point: the learner must be able to OPEN it to
 * discover what is wrong with it.
 */
const csvField = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const RAW_HEADER = ["applicant_id", "application_date", "race", "gender", "zip_code", "loan_amount", "income", "approved"];
fs.writeFileSync(OUT_RAW, [RAW_HEADER.join(","), ...out.map((r) => RAW_HEADER.map((h) => csvField(r[h])).join(","))].join("\n") + "\n");

// --- the reconciliation counterpart -----------------------------------------
//
// A servicing system's view of the same book. It disagrees in the three ways
// two systems always disagree: records one side has and the other does not, in
// both directions, and records both have where a value differs. Clean data on
// both sides — the exercise is the COMPARISON, not the cleaning.
const servicing = [];
const recon = { missing_from_servicing: [], missing_from_raw: [], amount_mismatch: [] };
rows.forEach((r, i) => {
  if (i % 23 === 9) { recon.missing_from_servicing.push(r.applicant_id); return; }
  const rec = { applicant_id: r.applicant_id, zip_code: r.zip_code, loan_amount: r.loan_amount, servicer: i % 2 ? "NORTHSTAR" : "MERIDIAN" };
  if (i % 29 === 11) { rec.loan_amount = String(Number(r.loan_amount) + 1000); recon.amount_mismatch.push(r.applicant_id); }
  servicing.push(rec);
});
for (let k = 0; k < 3; k++) {
  const id = `B90${k + 1}`;
  servicing.push({ applicant_id: id, zip_code: "60614", loan_amount: "150000", servicer: "MERIDIAN" });
  recon.missing_from_raw.push(id);
}
const SERV_HEADER = ["applicant_id", "zip_code", "loan_amount", "servicer"];
fs.writeFileSync(OUT_SERV, [SERV_HEADER.join(","), ...servicing.map((r) => SERV_HEADER.map((h) => csvField(r[h])).join(","))].join("\n") + "\n");

// Derive the reconciliation facts from the FILES AS WRITTEN, not from what the
// injections intended.
//
// Caught by test/governance-data.test.js: the out-of-range injection sets one
// record's loan_amount to -45000, and the servicing extract still carries that
// applicant's original amount — so it is a genuine amount mismatch that the
// intent-based ledger never recorded. Two defect injections interacted, and the
// manifest disagreed with its own data.
//
// Since the manifest is the graders' answer key, a manifest that records what
// was MEANT rather than what is THERE marks correct work wrong. Same rule the
// lesson constants now follow: re-derive from the artifact.
const num = (v) => Number(String(v).replace(/[$,\s]/g, ""));
const servById = new Map(servicing.map((r) => [String(r.applicant_id).trim(), r]));
recon.amount_mismatch = out
  .filter((r) => {
    const id = String(r.applicant_id).trim();
    return servById.has(id) && num(r.loan_amount) !== num(servById.get(id).loan_amount);
  })
  .map((r) => String(r.applicant_id).trim());

// --- bundled JS-string copies -----------------------------------------------
//
// The renderer cannot fetch() these. Chromium refuses fetch() on file:// URLs,
// which is exactly how the packaged Electron build loads the app, so every
// dataset a lesson names must ALSO exist as a bundled JS string — see
// data/hmda-csv.js, which does this for the clean extract.
//
// Emitted HERE rather than hand-written, because a hand-copied duplicate of a
// generated file drifts the moment the generator is re-run, and the drift is
// silent: the lab grades against one copy and the learner sees the other.
const bundle = (name, constName, text, note) =>
  `// data/${name}\n// GENERATED by scripts/make-governance-data.mjs — do not edit by hand.\n` +
  `// ${note}\n` +
  `// The renderer cannot fetch() this: Chromium refuses fetch() on file:// URLs,\n` +
  `// which is how the packaged Electron build loads the app.\n\n` +
  `export const ${constName} = ${JSON.stringify(text)};\n`;

fs.writeFileSync(
  path.join(ROOT, "data", "hmda-raw-csv.js"),
  bundle("hmda-raw-csv.js", "HMDA_RAW_CSV", fs.readFileSync(OUT_RAW, "utf8"),
    "The deliberately dirty intake extract the governance labs profile and clean.")
);
fs.writeFileSync(
  path.join(ROOT, "data", "hmda-servicing-csv.js"),
  bundle("hmda-servicing-csv.js", "HMDA_SERVICING_CSV", fs.readFileSync(OUT_SERV, "utf8"),
    "The second system's extract, for the reconciliation lab.")
);

const manifest = {
  generatedFrom: "public/data/hmda-sample.csv",
  generator: "scripts/make-governance-data.mjs",
  note: "Deterministic. Regenerate rather than hand-editing; graders assert against these ids.",
  raw: { file: "public/data/hmda-raw.csv", rows: out.length, columns: RAW_HEADER },
  servicing: { file: "public/data/hmda-servicing.csv", rows: servicing.length, columns: SERV_HEADER },
  defects: Object.fromEntries(Object.entries(defects).map(([k, v]) => [k, [...new Set(v)].sort()])),
  reconciliation: Object.fromEntries(Object.entries(recon).map(([k, v]) => [k, [...new Set(v)].sort()])),
};
fs.mkdirSync(path.dirname(OUT_MANIFEST), { recursive: true });
fs.writeFileSync(OUT_MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

console.log("data/hmda-raw-csv.js + data/hmda-servicing-csv.js bundled");
console.log(`hmda-raw.csv        ${out.length} rows`);
console.log(`hmda-servicing.csv  ${servicing.length} rows`);
for (const [k, v] of Object.entries(manifest.defects)) console.log(`  ${k.padEnd(26)} ${v.length}`);
for (const [k, v] of Object.entries(manifest.reconciliation)) console.log(`  ${k.padEnd(26)} ${v.length}`);
