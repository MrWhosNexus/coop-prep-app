// test/governance-data.test.js
//
// The governance corpus (hmda-raw.csv + hmda-servicing.csv) is generated, and
// data/governance-manifest.json records exactly which record carries which
// defect. That manifest is the ANSWER KEY the governance labs grade against, so
// a drift between the files and the manifest does not produce a test failure by
// itself — it produces labs that mark correct work wrong, which is the worst
// outcome this project has (see the four-fifths and DATEDIF findings).
//
// So: re-derive every claim from the files rather than restating it.
//
// It also pins the structural property that already broke once. The
// "number stored as text" defect injects thousands separators, which are commas,
// and written unquoted they split one field into two — an 8-column row became 9
// and every affected record was corrupted. The corruption was invisible to a
// naive check because parseCsv returns row OBJECTS, so measuring `row.length`
// yields undefined for every row and reports a single consistent "width".

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseCsv } from "../lib/viz/fields.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const manifest = JSON.parse(read("data/governance-manifest.json"));

const raw = parseCsv(read(manifest.raw.file));
const servicing = parseCsv(read(manifest.servicing.file));
const idOf = (r) => String(r.applicant_id).trim();

describe("governance corpus structure", () => {
  /**
   * Count the fields on one CSV line, respecting quotes.
   *
   * Not parseCsv: it keys rows by HEADER, so a line with nine fields against an
   * eight-column header still yields eight keys and the extra value is silently
   * dropped. That makes an object-shaped check blind to precisely the corruption
   * this file exists to catch — verified by unquoting one comma and watching the
   * column test stay green while the data was wrong.
   */
  const fieldCount = (line) => {
    let n = 1, quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { quoted = !quoted; continue; }
      if (ch === "," && !quoted) n++;
    }
    return n;
  };

  test("every LINE has the declared number of fields", () => {
    for (const spec of [manifest.raw, manifest.servicing]) {
      const lines = read(spec.file).trim().split("\n");
      lines.forEach((line, i) => {
        assert.equal(
          fieldCount(line),
          spec.columns.length,
          `${spec.file} line ${i + 1} has ${fieldCount(line)} fields, expected ${spec.columns.length} — an unquoted comma split a value`,
        );
      });
    }
  });

  test("every row carries exactly the declared columns", () => {
    for (const [rows, spec, label] of [[raw, manifest.raw, "raw"], [servicing, manifest.servicing, "servicing"]]) {
      assert.equal(rows.length, spec.rows, `${label} row count`);
      for (const row of rows) {
        const keys = Object.keys(row);
        assert.deepEqual(
          keys.sort(),
          [...spec.columns].sort(),
          `${label} row ${idOf(row)} has ${keys.length} columns, expected ${spec.columns.length} — an unquoted comma splits a field`,
        );
      }
    }
  });

  test("values containing commas survive as ONE field", () => {
    // The regression that motivated quoting. If this breaks, the corpus is
    // silently corrupt and every count derived from it is wrong.
    const withCommas = raw.filter((r) => /,/.test(r.loan_amount) || /,/.test(r.income));
    assert.ok(withCommas.length > 0, "the number-stored-as-text defect is present at all");
    for (const r of withCommas) {
      assert.match(
        `${r.loan_amount}|${r.income}`,
        /^\$?[\d,]*\|?\$?[\d,]*$/,
        `${idOf(r)}: a comma-bearing value leaked into the wrong column`,
      );
    }
  });
});

describe("the manifest is true of the files", () => {
  test("every id it names exists in the corpus", () => {
    const known = new Set(raw.map(idOf));
    for (const [defect, ids] of Object.entries(manifest.defects)) {
      const absent = ids.filter((id) => !known.has(id));
      assert.deepEqual(absent, [], `${defect} names ids that are not in hmda-raw.csv`);
    }
  });

  test("missing values are really missing, in all four spellings", () => {
    // A lab asks the learner to find these. If the manifest and the file
    // disagree, correct work gets marked wrong.
    const BLANKS = new Set(["", "N/A", "NULL", "-"]);
    const found = raw.filter((r) => BLANKS.has(String(r.income).trim()) || BLANKS.has(String(r.race).trim())).map(idOf);
    assert.deepEqual(
      [...new Set(found)].sort(),
      manifest.defects.missing_value,
      "the rows with blank income/race are exactly the ones the manifest lists",
    );
  });

  test("zip codes that lost a leading zero are shorter than five characters", () => {
    const short = raw.filter((r) => String(r.zip_code).trim().length < 5 && String(r.zip_code).trim() !== "9999").map(idOf);
    assert.deepEqual([...new Set(short)].sort(), manifest.defects.zip_leading_zero_lost);
  });

  test("duplicates are actually duplicated", () => {
    const counts = new Map();
    for (const r of raw) counts.set(idOf(r), (counts.get(idOf(r)) ?? 0) + 1);
    const repeated = [...counts].filter(([, n]) => n > 1).map(([id]) => id).sort();
    const declared = [...new Set([...manifest.defects.exact_duplicate, ...manifest.defects.near_duplicate])].sort();
    assert.deepEqual(repeated, declared, "every declared duplicate appears more than once, and nothing else does");
  });

  test("out-of-range values violate a rule a real intake would enforce", () => {
    for (const id of manifest.defects.out_of_range) {
      const r = raw.find((x) => idOf(x) === id);
      assert.ok(r, `${id} exists`);
      const loan = Number(String(r.loan_amount).replace(/[$,]/g, ""));
      const income = Number(String(r.income).replace(/[$,]/g, ""));
      const zip = String(r.zip_code).trim();
      assert.ok(
        loan < 0 || income === 0 || zip.length !== 5,
        `${id} is declared out-of-range but every value looks valid`,
      );
    }
  });
});

describe("reconciliation between the two extracts", () => {
  test("the declared mismatches are the real ones", () => {
    const rawIds = new Set(raw.map(idOf));
    const servIds = new Set(servicing.map(idOf));

    const missingFromServicing = [...rawIds].filter((id) => !servIds.has(id)).sort();
    const missingFromRaw = [...servIds].filter((id) => !rawIds.has(id)).sort();
    assert.deepEqual(missingFromServicing, manifest.reconciliation.missing_from_servicing);
    assert.deepEqual(missingFromRaw, manifest.reconciliation.missing_from_raw);

    // An amount disagreement is only meaningful once the text-formatted numbers
    // are normalised — otherwise "192,500" vs "192500" reads as a mismatch when
    // the two systems actually agree. That distinction is itself the lesson.
    const num = (v) => Number(String(v).replace(/[$,\s]/g, ""));
    const servBy = new Map(servicing.map((r) => [idOf(r), r]));
    const mismatched = raw
      .filter((r) => servBy.has(idOf(r)) && num(r.loan_amount) !== num(servBy.get(idOf(r)).loan_amount))
      .map(idOf);
    assert.deepEqual([...new Set(mismatched)].sort(), manifest.reconciliation.amount_mismatch);
  });
});
