// Guided-tutorial metadata for the 12 Tableau/viz lessons: mode, voice,
// step.target (region anchors into the SHARED DOM CONTRACT), and
// spotlightLabel (STOP-SLOP short objective strings) — plus the ground-truth
// guard: every exported EXPECTED_* constant is RE-DERIVED from the real CSV.
//
// The guard exists because the original LESSONS list here covered only the
// older lessons; the four later additions (dual-axis, size, detail,
// shelves-guide) were never cross-checked, and tableau-size shipped with
// entirely fabricated counts (17/12/26/19 over a phantom 74-row slice of a
// 100-row file). Every lesson, present and future, must appear in ALL_LESSONS.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createLesson } from "../lib/guide/spec.js";
import { grade } from "../lib/guide/graders.js";
import { startingState } from "../lib/guide/checkpoints.js";

import { lesson as barsLesson, EXPECTED_RATES } from "../lib/guide/lessons/tableau-bars.js";
import { lesson as dimensionsLesson, EXPECTED_COUNTS } from "../lib/guide/lessons/tableau-dimensions.js";
import {
  lesson as pillsLesson,
  EXPECTED_AVG_LOAN as PILLS_AVG_LOAN,
  EXPECTED_MEDIAN_LOAN,
} from "../lib/guide/lessons/tableau-pills.js";
import { lesson as filtersLesson } from "../lib/guide/lessons/tableau-filters.js";
import { lesson as colorLesson } from "../lib/guide/lessons/tableau-color.js";
import { lesson as showmeLesson } from "../lib/guide/lessons/tableau-showme.js";
import { lesson as dashboardLesson } from "../lib/guide/lessons/tableau-dashboard.js";
import { lesson as calcLesson, EXPECTED_LTI } from "../lib/guide/lessons/tableau-calc.js";
import {
  lesson as dualAxisLesson,
  EXPECTED_AVG_INCOME,
  EXPECTED_AVG_LOAN as DUAL_AVG_LOAN,
} from "../lib/guide/lessons/tableau-dual-axis.js";
import {
  lesson as sizeLesson,
  GENDER_APPROVED_COUNTS,
  EXPECTED_AVG_LOAN as SIZE_AVG_LOAN,
} from "../lib/guide/lessons/tableau-size.js";
import {
  lesson as detailLesson,
  SCATTER_POINTS_BY_RACE,
  SCATTER_POINTS_BY_GENDER,
} from "../lib/guide/lessons/tableau-detail.js";
import { lesson as shelvesGuideLesson } from "../lib/guide/lessons/tableau-shelves-guide.js";

// Guided lessons: spotlight overlay + voice.
const GUIDED_LESSONS = [
  ["tableau-bars", barsLesson],
  ["tableau-dimensions", dimensionsLesson],
  ["tableau-pills", pillsLesson],
  ["tableau-filters", filtersLesson],
  ["tableau-color", colorLesson],
  ["tableau-showme", showmeLesson],
  ["tableau-dashboard", dashboardLesson],
  ["tableau-calc", calcLesson],
  ["tableau-dual-axis", dualAxisLesson],
  ["tableau-size", sizeLesson],
  ["tableau-detail", detailLesson],
];

// tableau-shelves-guide is deliberately instruction-mode, no voice.
const ALL_LESSONS = [...GUIDED_LESSONS, ["tableau-shelves-guide", shelvesGuideLesson]];

const ALLOWED_ANCHORS = [
  "viz-columns",
  "viz-rows",
  "viz-marks-color",
  "viz-marks-size",
  "viz-filters",
  "viz-showme",
  "viz-fieldlist",
];

describe("guided tableau lessons: registry completeness", () => {
  test("ALL_LESSONS covers every tableau lesson module on disk", async () => {
    // A lesson missing from this file escapes the ground-truth guard below —
    // exactly how the fabricated tableau-size numbers shipped. Enumerate the
    // registry rather than trusting this file's import list.
    const { LESSONS } = await import("../lib/guide/lessons/index.js");
    const tableauIds = LESSONS.filter((l) => l.moduleId === "tableau").map((l) => l.id).sort();
    assert.deepEqual(ALL_LESSONS.map(([name]) => name).sort(), tableauIds);
  });
});

describe("guided tableau lessons: mode + voice", () => {
  for (const [name, lesson] of GUIDED_LESSONS) {
    test(`${name} is guided with voice enabled`, () => {
      assert.equal(lesson.mode, "guided");
      assert.equal(lesson.voice, true);
    });
  }
  test("tableau-shelves-guide is instruction-mode without voice", () => {
    assert.equal(shelvesGuideLesson.mode, "instructions");
    assert.equal(shelvesGuideLesson.voice, false);
  });
});

describe("guided tableau lessons: step targets", () => {
  for (const [name, lesson] of ALL_LESSONS) {
    test(`${name}: every non-omitted step target is a valid region anchor`, () => {
      for (const step of lesson.steps) {
        if (step.target === undefined || step.target === null) continue;
        assert.equal(step.target.kind, "region", `${name}/${step.id}: target.kind`);
        assert.ok(
          ALLOWED_ANCHORS.includes(step.target.anchor),
          `${name}/${step.id}: anchor "${step.target.anchor}" not in allowed set`,
        );
      }
    });
  }
});

describe("guided tableau lessons: spotlight labels (STOP-SLOP)", () => {
  for (const [name, lesson] of GUIDED_LESSONS) {
    for (const step of lesson.steps) {
      test(`${name}/${step.id}: spotlightLabel is a clean short string`, () => {
        assert.ok(typeof step.spotlightLabel === "string" && step.spotlightLabel.trim() !== "", "non-empty");
        assert.ok(!step.spotlightLabel.includes("—"), "no em-dash");
        assert.ok(step.spotlightLabel.length <= 80, `too long: ${step.spotlightLabel}`);
      });
    }
  }
});

describe("guided tableau lessons: still validate through createLesson", () => {
  for (const [name, lesson] of ALL_LESSONS) {
    test(`${name} passes createLesson without throwing`, () => {
      assert.doesNotThrow(() => createLesson(lesson));
    });
  }
});

// -----------------------------------------------------------------------------
// Every grader must be RUNNABLE. This is the call-site check that catches an
// expected spec carrying keys the engine does not know: the vizSpec grader
// throws on unrecognized keys, so grading each step's own checkpoint state
// exercises every descriptor. (This is how {dual: true} would have been
// caught before shipping — the step silently auto-passed instead.)
// -----------------------------------------------------------------------------

const HMDA_PATH = fileURLToPath(new URL("../public/data/hmda-sample.csv", import.meta.url));
const HMDA_CSV = readFileSync(HMDA_PATH, "utf8");
const RESOURCES = { "hmda-sample.csv": HMDA_CSV };

describe("unrecognized expected-spec keys fail loudly (no more silent auto-pass)", () => {
  // Both spec-matching paths must throw: specMatches (the viz engine's hook)
  // and the vizSpec grader (what lessons actually run through). Silently
  // skipping unknown keys is how { dual: true } graded as an instant pass.
  test("specMatches throws on an unknown key", async () => {
    const { specMatches, createSpec } = await import("../lib/viz/spec.js");
    assert.throws(() => specMatches(createSpec(), { dual: true }), /unrecognized key/);
  });

  test("the vizSpec grader throws on an unknown key", () => {
    const { toolState } = startingState(barsLesson, 0, RESOURCES);
    assert.throws(
      () => grade(toolState, { type: "vizSpec", expected: { synchronized: true } }),
      /unrecognized key/,
    );
  });
});

describe("guided tableau lessons: every grader runs against real tool state", () => {
  for (const [name, lesson] of ALL_LESSONS) {
    test(`${name}: no step grader throws on its own checkpoint state`, () => {
      lesson.steps.forEach((step, i) => {
        const { toolState } = startingState(lesson, i, RESOURCES);
        // Pass or fail is the step's business; THROWING means the descriptor
        // itself is malformed (e.g. an unrecognized expected-spec key).
        assert.doesNotThrow(() => grade(toolState, step.grader), `${name}/${step.id}`);
      });
    });
  }
});

// -----------------------------------------------------------------------------
// Ground truth: re-derive every exported EXPECTED_* constant from the CSV.
// The lessons embed literal numbers; this recomputes each one independently
// (plain JS over the raw file — no viz-engine code, so an engine bug cannot
// vouch for itself) and demands an exact match.
// -----------------------------------------------------------------------------

/** Parse the HMDA extract (no quoted fields in this file). */
function parseCsv(text) {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const cols = head.split(",");
  return lines.map((line) => {
    const cells = line.split(",");
    const row = {};
    cols.forEach((c, i) => (row[c] = cells[i]));
    // Derived fields the lessons compute via calculated fields.
    row.is_approved = row.approved === "APPROVED" ? 1 : 0;
    row.loan_to_income = Number(row.loan_amount) / Number(row.income);
    return row;
  });
}

const ROWS = parseCsv(HMDA_CSV);

function aggregate(values, agg) {
  const nums = values.map(Number);
  switch (agg) {
    case "COUNT":
      return values.length;
    case "SUM":
      return nums.reduce((a, b) => a + b, 0);
    case "AVG":
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    case "MEDIAN": {
      const s = [...nums].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    }
    default:
      throw new Error(`aggregate: unsupported aggregation ${agg}`);
  }
}

/**
 * Recompute an expected-constant array from the raw CSV: group by its
 * non-aggregate keys, then evaluate each "AGG(field)" column per group.
 */
function deriveFromCsv(expected) {
  const keys = Object.keys(expected[0]).filter((k) => !k.includes("("));
  const aggCols = Object.keys(expected[0]).filter((k) => k.includes("("));
  const groups = new Map();
  for (const row of ROWS) {
    const gk = JSON.stringify(keys.map((k) => row[k]));
    if (!groups.has(gk)) groups.set(gk, []);
    groups.get(gk).push(row);
  }
  return [...groups.entries()]
    .map(([gk, rows]) => {
      const out = {};
      JSON.parse(gk).forEach((v, i) => (out[keys[i]] = v));
      for (const col of aggCols) {
        const m = /^([A-Z]+)\((.+)\)$/.exec(col);
        out[col] = aggregate(rows.map((r) => r[m[2]]), m[1]);
      }
      return out;
    })
    .sort((a, b) => keys.map((k) => a[k]).join("|").localeCompare(keys.map((k) => b[k]).join("|")));
}

function sortLikeDerived(expected) {
  const keys = Object.keys(expected[0]).filter((k) => !k.includes("("));
  return [...expected].sort((a, b) =>
    keys.map((k) => a[k]).join("|").localeCompare(keys.map((k) => b[k]).join("|")),
  );
}

const GROUND_TRUTH_CONSTANTS = [
  ["tableau-bars EXPECTED_RATES", EXPECTED_RATES],
  ["tableau-dimensions EXPECTED_COUNTS", EXPECTED_COUNTS],
  ["tableau-pills EXPECTED_AVG_LOAN", PILLS_AVG_LOAN],
  ["tableau-pills EXPECTED_MEDIAN_LOAN", EXPECTED_MEDIAN_LOAN],
  ["tableau-calc EXPECTED_LTI", EXPECTED_LTI],
  ["tableau-dual-axis EXPECTED_AVG_INCOME", EXPECTED_AVG_INCOME],
  ["tableau-dual-axis EXPECTED_AVG_LOAN", DUAL_AVG_LOAN],
  ["tableau-size GENDER_APPROVED_COUNTS", GENDER_APPROVED_COUNTS],
  ["tableau-size EXPECTED_AVG_LOAN", SIZE_AVG_LOAN],
  ["tableau-detail SCATTER_POINTS_BY_RACE", SCATTER_POINTS_BY_RACE],
  ["tableau-detail SCATTER_POINTS_BY_GENDER", SCATTER_POINTS_BY_GENDER],
];

describe("ground truth: every exported EXPECTED_* constant re-derives from the CSV", () => {
  test("the fixture is the full 100-row extract (not a slice)", () => {
    assert.equal(ROWS.length, 100);
  });

  for (const [label, expected] of GROUND_TRUTH_CONSTANTS) {
    test(`${label} matches the raw file exactly`, () => {
      const derived = deriveFromCsv(expected);
      const claimed = sortLikeDerived(expected);
      assert.equal(claimed.length, derived.length, `${label}: group count (missing or invented groups)`);
      for (let i = 0; i < derived.length; i++) {
        for (const [col, want] of Object.entries(derived[i])) {
          const got = claimed[i][col];
          if (typeof want === "number") {
            assert.ok(
              Math.abs(Number(got) - want) < 1e-9,
              `${label} [${JSON.stringify(derived[i])}] ${col}: lesson says ${got}, CSV says ${want}`,
            );
          } else {
            assert.equal(String(got), String(want), `${label} row ${i} ${col}`);
          }
        }
      }
    });
  }
});
