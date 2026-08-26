// The guided-lesson LIBRARY under test. Every lesson is exercised against
//   (a) the correct solution, walked step by step through the real runner to
//       a perfect score, and
//   (b) plausibly-WRONG solutions, asserting the grader returns the RIGHT
//       teaching feedback for each mistake — not merely that it fails.
// All expected numbers are the verified HMDA ground truth; the lessons embed
// values computed with the engine itself.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { validateLesson } from "../lib/guide/spec.js";
import { grade } from "../lib/guide/graders.js";
import { createSession, submitStep, isComplete, lessonScore } from "../lib/guide/runner.js";
import { startingState } from "../lib/guide/checkpoints.js";

import {
  LESSONS, LESSONS_BY_ID, CURRICULUM_MAP,
  getLesson, lessonsForCurriculumLesson, lessonsForModule,
} from "../lib/guide/lessons/index.js";
import { MODULES } from "../data/curriculum.js";

import { setCell, setCells, copyCell, getValue } from "../lib/sheet/model.js";
import { parseRange, cellKey } from "../lib/sheet/cells.js";
import { REGIONS } from "../lib/guide/lessons/excel-xlookup.js";
import { Shelf, putOnShelf, removeFromShelf, setAggregation, setDiscrete, createEncoding } from "../lib/viz/spec.js";
import { makeField, FieldType, createCalculatedField } from "../lib/viz/fields.js";
import { categoricalFilter, rangeFilter, topNFilter } from "../lib/viz/aggregate.js";

// --- Fixtures ----------------------------------------------------------------

const HMDA_PATH = fileURLToPath(new URL("../public/data/hmda-sample.csv", import.meta.url));
const HMDA_CSV = readFileSync(HMDA_PATH, "utf8");
const RESOURCES = { "hmda-sample.csv": HMDA_CSV };

/** The materialized tool state for entering step `i` of a lesson. */
function stateFor(lesson, i) {
  return startingState(lesson, i, RESOURCES).toolState;
}

/** Submit `toolState` for the session's current step and assert it passes. */
function passStep(session, lesson, toolState) {
  const out = submitStep(session, lesson, toolState);
  assert.equal(out.result.pass, true, `${lesson.id} step ${session.stepIndex + 1}: ${out.result.message}`);
  return out.session;
}

const dim = (name) => createEncoding(makeField(name, FieldType.STRING));
const measure = (name, aggregation) => createEncoding(makeField(name, FieldType.NUMBER), { aggregation });
const countPill = () => createEncoding(makeField("applicant_id", FieldType.STRING), { aggregation: "COUNT" });

// ==============================================================================
describe("lessons/index: the registry", () => {
  const curriculumLessonIds = new Set(MODULES.flatMap((m) => m.lessons.map((l) => l.id)));

  test("every lesson validates against the GuidedLesson format", () => {
    for (const lesson of LESSONS) {
      const r = validateLesson(lesson);
      assert.deepEqual(r, { valid: true, errors: [] }, `${lesson.id}: ${r.errors.join("; ")}`);
    }
  });

  test("lesson ids are unique and LESSONS_BY_ID agrees", () => {
    const ids = LESSONS.map((l) => l.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(Object.keys(LESSONS_BY_ID).sort(), [...ids].sort());
  });

  test("CURRICULUM_MAP keys are REAL curriculum lesson ids", () => {
    for (const key of Object.keys(CURRICULUM_MAP)) {
      assert.ok(curriculumLessonIds.has(key), `"${key}" is not a curriculum lesson id`);
    }
  });

  test("CURRICULUM_MAP values are real guided lessons, and every lesson is mapped", () => {
    const mapped = new Set(Object.values(CURRICULUM_MAP).flat());
    for (const id of mapped) assert.ok(LESSONS_BY_ID[id], `mapped lesson "${id}" does not exist`);
    for (const lesson of LESSONS) assert.ok(mapped.has(lesson.id), `lesson "${lesson.id}" is not attached to any curriculum lesson`);
  });

  test("lookup helpers", () => {
    assert.equal(getLesson("excel-countifs").id, "excel-countifs");
    assert.equal(getLesson("nope"), null);
    assert.deepEqual(lessonsForCurriculumLesson("tableau-3").map((l) => l.id), ["tableau-calc", "tableau-dual-axis"]);
    assert.deepEqual(lessonsForCurriculumLesson("unknown"), []);
    assert.equal(lessonsForModule("excel").length, 13);
    assert.equal(lessonsForModule("stats").length, 3);
    assert.equal(lessonsForModule("tableau").length, 12);
  });

  test("every stats curriculum lesson has a guided counterpart, reachable via the resolver", () => {
    assert.deepEqual(lessonsForCurriculumLesson("stats-1").map((l) => l.id), ["stats-rates"]);
    assert.deepEqual(lessonsForCurriculumLesson("stats-2").map((l) => l.id), ["excel-stats"]);
    assert.deepEqual(lessonsForCurriculumLesson("stats-3").map((l) => l.id), ["stats-probability"]);
  });

  test("every step of every lesson is a clean entry point (own checkpoint that materializes)", () => {
    for (const lesson of LESSONS) {
      lesson.steps.forEach((step, i) => {
        assert.ok(step.checkpoint, `${lesson.id} step ${step.id} has no checkpoint`);
        const { resumedFrom, toolState } = startingState(lesson, i, RESOURCES);
        assert.equal(resumedFrom, i, `${lesson.id} step ${step.id} resumes from an earlier step`);
        assert.ok(toolState.tool === "sheet" ? toolState.sheets : toolState.spec);
      });
    }
  });
});

// ==============================================================================
describe("checkpoint invariant: resumedFrom=N means steps 0..N-1 need not be redone", () => {
  // Resuming at step N materializes step N's checkpoint; every earlier step's
  // grader must still pass on it — a checkpoint must never silently destroy a
  // learner's recorded work. This is the invariant whose absence let a
  // checkpoint drop a learner's fill-down.
  //
  // The one legitimate exception is SUPERSESSION: a later step (up to and
  // including the resumed one) grades the same surface, i.e. the lesson
  // deliberately rewrites that work in place — excel-iferror wraps L2's raw
  // rate with IFERROR, each tableau-filters exercise replaces the previous
  // filter. Supersession is derived from the graders themselves, so every
  // lesson in the registry is covered — including one added tomorrow.

  /** The set of tool-state surfaces a grader descriptor asserts on. */
  function graderSurfaces(g, out = new Set()) {
    switch (g.type) {
      case "cellValue":
      case "cellFormula":
        out.add(`cell:${g.sheet ?? ""}!${g.ref.toUpperCase()}`);
        break;
      case "rangeValues": {
        const r = parseRange(g.range);
        for (let row = r.top; row <= r.bottom; row++) {
          for (let col = r.left; col <= r.right; col++) out.add(`cell:${g.sheet ?? ""}!${cellKey(row, col)}`);
        }
        break;
      }
      case "pivotSpec":
      case "pivotResult":
        out.add("pivot");
        break;
      case "vizSpec":
        for (const key of Object.keys(g.expected)) out.add(`viz:${key}`);
        break;
      case "vizData":
        out.add("viz:data");
        break;
      case "allOf":
      case "anyOf":
        g.of.forEach((child) => graderSurfaces(child, out));
        break;
      default:
        // predicate: opaque — it neither supersedes nor is ever superseded,
        // so predicate-graded work stays enforced in every later checkpoint.
        break;
    }
    return out;
  }

  const overlaps = (a, b) => [...a].some((s) => b.has(s));

  for (const lesson of LESSONS) {
    test(`${lesson.id}: every step's checkpoint passes every earlier non-superseded step's grader`, () => {
      const surfaces = lesson.steps.map((s) => graderSurfaces(s.grader));
      lesson.steps.forEach((step, i) => {
        const ts = stateFor(lesson, i);
        for (let j = 0; j < i; j++) {
          const superseded = surfaces.slice(j + 1, i + 1).some((later) => overlaps(surfaces[j], later));
          if (superseded) continue;
          const r = grade(ts, lesson.steps[j].grader);
          assert.equal(
            r.pass, true,
            `${lesson.id}: resuming at step ${i + 1} ("${step.id}") loses step ${j + 1} ("${lesson.steps[j].id}")'s work: ${r.message}`
          );
        }
      });
    });
  }
});

// ==============================================================================
describe("excel-pivot-rates: % of Column Total", () => {
  const lesson = LESSONS_BY_ID["excel-pivot-rates"];
  const COUNT = { field: "applicant_id", agg: "count" };
  const RATE = { ...COUNT, showAs: "percentOfColumnTotal" };

  test("correct path: build, show-as, read — perfect score", () => {
    let session = createSession(lesson);

    const s1 = stateFor(lesson, 0);
    s1.pivot.spec = { rows: ["approved"], cols: ["race"], values: [COUNT], filters: {} };
    session = passStep(session, lesson, s1);

    const s2 = stateFor(lesson, 1);
    s2.pivot.spec = { rows: ["approved"], cols: ["race"], values: [RATE], filters: {} };
    session = passStep(session, lesson, s2);

    const s3 = stateFor(lesson, 2);
    setCells(s3.sheets.Data, { J2: 0.5625, J3: 0.86, J4: "=J3-J2" });
    session = passStep(session, lesson, s3);

    assert.equal(isComplete(session), true);
    assert.equal(lessonScore(session, lesson).score, 1);
  });

  test("wrong: transposed layout is called out as misplaced", () => {
    const ts = stateFor(lesson, 0);
    ts.pivot.spec = { rows: ["race"], cols: ["approved"], values: [COUNT], filters: {} };
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.ok(r.diff.some((d) => d.kind === "misplaced"), r.message);
  });

  test("wrong: % of Row Total names the setting to change", () => {
    const ts = stateFor(lesson, 1);
    ts.pivot.spec = { rows: ["approved"], cols: ["race"], values: [{ ...COUNT, showAs: "percentOfRowTotal" }], filters: {} };
    const r = grade(ts, lesson.steps[1].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /% of Column Total/);
  });

  test("wrong: reading 56.25 instead of 0.5625 shows both numbers", () => {
    const ts = stateFor(lesson, 2);
    setCells(ts.sheets.Data, { J2: 56.25, J3: 86, J4: 29.75 });
    const r = grade(ts, lesson.steps[2].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /shows 56\.25; expected 0\.5625/);
  });
});

// ==============================================================================
describe("excel-lookup-reverse: XLOOKUP right-to-left", () => {
  const lesson = LESSONS_BY_ID["excel-lookup-reverse"];

  test("correct path: max, reverse lookup, nested, swapped return", () => {
    let session = createSession(lesson);

    const s1 = stateFor(lesson, 0);
    setCell(s1.sheets.Data, "J2", "=MAX(E2:E101)");
    session = passStep(session, lesson, s1);

    const s2 = stateFor(lesson, 1);
    setCell(s2.sheets.Data, "J3", "=XLOOKUP(J2, E2:E101, A2:A101)");
    session = passStep(session, lesson, s2);

    const s3 = stateFor(lesson, 2);
    setCell(s3.sheets.Data, "J4", "=XLOOKUP(MAX(F2:F101), F2:F101, A2:A101)");
    session = passStep(session, lesson, s3);

    const s4 = stateFor(lesson, 3);
    setCell(s4.sheets.Data, "J5", "=XLOOKUP(MAX(F2:F101), F2:F101, G2:G101)");
    session = passStep(session, lesson, s4);

    assert.equal(isComplete(session), true);
    assert.equal(lessonScore(session, lesson).score, 1);
  });

  test("wrong: hand-typing A0016 is a method failure even though the value is right", () => {
    const ts = stateFor(lesson, 1);
    setCell(ts.sheets.Data, "J3", "A0016");
    const r = grade(ts, lesson.steps[1].grader);
    assert.equal(r.pass, false);
    assert.equal(r.diff[0].kind, "method");
    assert.match(r.message, /typed in by hand/);
  });

  test("wrong: reaching for VLOOKUP is redirected to XLOOKUP", () => {
    const ts = stateFor(lesson, 1);
    setCell(ts.sheets.Data, "J3", "=VLOOKUP(J2, E2:E101, 1, FALSE)");
    const r = grade(ts, lesson.steps[1].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /must use XLOOKUP/);
  });

  test("wrong: looking up the wrong column returns the wrong applicant, named in the diff", () => {
    const ts = stateFor(lesson, 2);
    setCell(ts.sheets.Data, "J4", "=XLOOKUP(MAX(E2:E101), E2:E101, A2:A101)"); // max LOAN, not income
    const r = grade(ts, lesson.steps[2].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /"A0016"; expected "A0076"/);
  });
});

// ==============================================================================
describe("excel-index-match: the classic lookup", () => {
  const lesson = LESSONS_BY_ID["excel-index-match"];
  const INDEX_MATCH = "=INDEX($K$2:$K$23, MATCH(D2, $J$2:$J$23, 0))";

  test("correct path: MATCH, INDEX-wrap, fill-down", () => {
    let session = createSession(lesson);

    const s1 = stateFor(lesson, 0);
    setCell(s1.sheets.Applicants, "H2", "=MATCH(D2, $J$2:$J$23, 0)");
    session = passStep(session, lesson, s1);

    const s2 = stateFor(lesson, 1);
    setCell(s2.sheets.Applicants, "H2", INDEX_MATCH);
    session = passStep(session, lesson, s2);

    const s3 = stateFor(lesson, 2);
    for (let r = 3; r <= 101; r++) copyCell(s3.sheets.Applicants, "H2", `H${r}`);
    session = passStep(session, lesson, s3);

    assert.equal(isComplete(session), true);
    assert.equal(lessonScore(session, lesson).score, 1);
  });

  test("wrong: solving step 1 with XLOOKUP is rejected — this lesson is the classic way", () => {
    const ts = stateFor(lesson, 0);
    setCell(ts.sheets.Applicants, "H2", "=XLOOKUP(D2, $J$2:$J$23, $K$2:$K$23)");
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.ok(r.diff.some((d) => /without XLOOKUP/.test(d.hint)), r.message);
  });

  test("wrong: INDEX over the ZIP column returns a ZIP, and the diff shows it", () => {
    const ts = stateFor(lesson, 1);
    setCell(ts.sheets.Applicants, "H2", "=INDEX($J$2:$J$23, MATCH(D2, $J$2:$J$23, 0))");
    const r = grade(ts, lesson.steps[1].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /returns 48217; expected "Midwest"/);
  });

  test("wrong: unpinned fill-down breaks and the error is surfaced", () => {
    const ts = stateFor(lesson, 2);
    setCell(ts.sheets.Applicants, "H2", "=INDEX(K2:K23, MATCH(D2, J2:J23, 0))");
    for (let r = 3; r <= 101; r++) copyCell(ts.sheets.Applicants, "H2", `H${r}`);
    const r = grade(ts, lesson.steps[2].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /#N\/A|check its references/);
  });

  test("wrong: two one-off formulas in only H3 and H101 must not count as a fill-down", () => {
    const ts = stateFor(lesson, 2);
    // Correct values in exactly the two cells the step names, 97 rows blank,
    // nothing pinned — the fill (and the $-pinning it teaches) never happened.
    setCells(ts.sheets.Applicants, {
      H3: "=INDEX(K2:K23, MATCH(D3, J2:J23, 0))",
      H101: "=INDEX(K2:K23, MATCH(D101, J2:J23, 0))",
    });
    const r = grade(ts, lesson.steps[2].grader);
    assert.equal(r.pass, false, "97 blank rows must not pass the fill-down step");
    assert.ok(r.diff.some((d) => d.kind === "missing"), r.message);
    assert.match(r.message, /of 100 rows/);
  });

  test("wrong: 100 hand-typed regions fail on METHOD even with every value right", () => {
    const ts = stateFor(lesson, 2);
    const table = new Map(REGIONS);
    for (let r = 3; r <= 101; r++) {
      const zip = getValue(ts.sheets.Applicants, `D${r}`);
      setCell(ts.sheets.Applicants, `H${r}`, table.get(String(zip)));
    }
    const r = grade(ts, lesson.steps[2].grader);
    assert.equal(r.pass, false, "typed regions must not pass an INDEX/MATCH fill-down");
    assert.ok(r.diff.some((d) => d.kind === "method"), r.message);
  });
});

// ==============================================================================
describe("excel-countifs: the four-fifths calculator", () => {
  const lesson = LESSONS_BY_ID["excel-countifs"];

  function fillColumn(sheet, col, formula) {
    for (let r = 2; r <= 7; r++) setCell(sheet, `${col}${r}`, formula(r));
  }

  test("correct path: COUNTIF, COUNTIFS, rates, ratios, SUMIFS", () => {
    let session = createSession(lesson);

    const s1 = stateFor(lesson, 0);
    fillColumn(s1.sheets.Data, "J", (r) => `=COUNTIF($B$2:$B$101, I${r})`);
    session = passStep(session, lesson, s1);

    const s2 = stateFor(lesson, 1);
    fillColumn(s2.sheets.Data, "K", (r) => `=COUNTIFS($B$2:$B$101, I${r}, $G$2:$G$101, "APPROVED")`);
    session = passStep(session, lesson, s2);

    const s3 = stateFor(lesson, 2);
    fillColumn(s3.sheets.Data, "L", (r) => `=K${r}/J${r}`);
    session = passStep(session, lesson, s3);

    const s4 = stateFor(lesson, 3);
    fillColumn(s4.sheets.Data, "M", (r) => `=L${r}/MAX($L$2:$L$7)`);
    session = passStep(session, lesson, s4);

    const s5 = stateFor(lesson, 4);
    setCells(s5.sheets.Data, {
      N4: '=SUMIFS($E$2:$E$101, $B$2:$B$101, I4, $G$2:$G$101, "APPROVED")',
      N7: '=SUMIFS($E$2:$E$101, $B$2:$B$101, I7, $G$2:$G$101, "APPROVED")',
    });
    session = passStep(session, lesson, s5);

    assert.equal(isComplete(session), true);
    assert.equal(lessonScore(session, lesson).score, 1);
  });

  test("wrong: hand-typed counts fail on METHOD even with perfect numbers", () => {
    const ts = stateFor(lesson, 0);
    [3, 10, 16, 18, 3, 50].forEach((n, i) => setCell(ts.sheets.Data, `J${i + 2}`, n));
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.ok(r.diff.some((d) => d.kind === "method"), r.message);
  });

  test("wrong: single-condition COUNTIF on the approved step is pointed at COUNTIFS", () => {
    const ts = stateFor(lesson, 1);
    for (let r = 2; r <= 7; r++) setCell(ts.sheets.Data, `K${r}`, '=COUNTIF($G$2:$G$101, "APPROVED")');
    const r = grade(ts, lesson.steps[1].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /COUNTIFS/);
    // the outcome half fails too: 76 everywhere, not the per-group counts
    assert.ok(r.diff.some((d) => /shows 76/.test(d.hint)));
  });

  test("wrong: typing the six rates as constants into L2:L7 is a method failure", () => {
    const ts = stateFor(lesson, 2);
    // the two values the instruction discloses, plus the other four — no formula anywhere
    [2 / 3, 0.8, 0.5625, 2 / 3, 2 / 3, 0.86].forEach((v, i) => setCell(ts.sheets.Data, `L${i + 2}`, v));
    const r = grade(ts, lesson.steps[2].grader);
    assert.equal(r.pass, false, "six typed constants must not pass the rate step");
    assert.ok(r.diff.some((d) => d.kind === "method"), r.message);
    assert.match(r.message, /typed in by hand|not a formula/);
  });

  // THE ANCHOR-CELL HOLE. Every counting step pinned its method with a single
  // cellFormula on the column's FIRST cell and checked the rest with
  // rangeValues, which accepts whatever is there. So one real COUNTIF in J2 plus
  // five hand-typed numbers passed a step whose whole point is filling down —
  // and the runner recorded it as mastered. The lesson's own doctrine comment
  // claimed "hand-typed counts must fail"; it was aspiration, not enforcement.
  // Each column is now checked per row for method AND outcome.
  for (const [label, i, col, anchor, values] of [
    ["count-totals", 0, "J", "=COUNTIF($B$2:$B$101, I2)", [3, 10, 16, 18, 3, 50]],
    ["count-approved", 1, "K", '=COUNTIFS($B$2:$B$101, I2, $G$2:$G$101, "APPROVED")', [2, 8, 9, 12, 2, 43]],
    // ratios = each group's rate / the best rate (White, .86)
    ["four-fifths-ratio", 3, "M", "=L2/MAX($L$2:$L$7)", [2 / 3, 0.8, 0.5625, 2 / 3, 2 / 3, 0.86].map((r) => r / 0.86)],
  ]) {
    test(`wrong: ${label} — a real formula in ${col}2 plus typed constants below is a method failure`, () => {
      const ts = stateFor(lesson, i);
      setCell(ts.sheets.Data, `${col}2`, anchor);
      for (let k = 1; k < values.length; k++) setCell(ts.sheets.Data, `${col}${k + 2}`, values[k]);

      const r = grade(ts, lesson.steps[i].grader);
      assert.equal(r.pass, false, `typing ${col}3:${col}7 must not pass a fill-down step`);
      assert.ok(
        r.diff.some((d) => d.kind === "method" && d.path === `${col}3`),
        `the diff must name the first typed cell as a METHOD failure, not merely say "wrong": ${r.message}`,
      );
    });
  }

  test(`right: ${"count-totals"} still passes when every row is genuinely filled down`, () => {
    // The half that matters more than any of the above: the intended solution
    // must still pass. A grader that rejects a correct answer is worse than the
    // hole it closed.
    const ts = stateFor(lesson, 0);
    for (let r = 2; r <= 7; r++) setCell(ts.sheets.Data, `J${r}`, `=COUNTIF($B$2:$B$101, I${r})`);
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, true, r.message);
  });

  test("wrong: inverting the rate division (=J2/K2) fails even before the fill", () => {
    const ts = stateFor(lesson, 2);
    for (let r = 2; r <= 7; r++) setCell(ts.sheets.Data, `L${r}`, `=J${r}/K${r}`);
    const r = grade(ts, lesson.steps[2].grader);
    assert.equal(r.pass, false);
    // the formula shape is wrong AND the outcome column disagrees
    assert.ok(r.diff.some((d) => d.kind === "method" || d.kind === "wrong"), r.message);
  });

  test("wrong: hardcoding /0.86 in the ratio is rejected — MAX is the method", () => {
    const ts = stateFor(lesson, 3);
    for (let r = 2; r <= 7; r++) setCell(ts.sheets.Data, `M${r}`, `=L${r}/0.86`);
    const r = grade(ts, lesson.steps[3].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /must use MAX/);
  });
});

// ==============================================================================
describe("excel-if-ifs: flags and bands", () => {
  const lesson = LESSONS_BY_ID["excel-if-ifs"];
  const IFS_BAND = '=IFS(E2 < 150000, "Under $150k", E2 < 250000, "$150k-$250k", TRUE, "Over $250k")';

  test("correct path: IF flag, fill, IFS band, band the file", () => {
    let session = createSession(lesson);

    const s1 = stateFor(lesson, 0);
    setCell(s1.sheets.Data, "N2", '=IF(M2 < 0.8, "FAIL", "PASS")');
    session = passStep(session, lesson, s1);

    const s2 = stateFor(lesson, 1);
    for (let r = 3; r <= 7; r++) copyCell(s2.sheets.Data, "N2", `N${r}`);
    session = passStep(session, lesson, s2);

    const s3 = stateFor(lesson, 2);
    setCell(s3.sheets.Data, "O2", IFS_BAND);
    session = passStep(session, lesson, s3);

    const s4 = stateFor(lesson, 3);
    for (let r = 3; r <= 101; r++) copyCell(s4.sheets.Data, "O2", `O${r}`);
    session = passStep(session, lesson, s4);

    assert.equal(isComplete(session), true);
    assert.equal(lessonScore(session, lesson).score, 1);
  });

  test("wrong: typing FAIL by hand is a method failure", () => {
    const ts = stateFor(lesson, 0);
    setCell(ts.sheets.Data, "N2", "FAIL");
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.equal(r.diff[0].kind, "method");
  });

  test("wrong: swapped PASS/FAIL shows both verdicts", () => {
    const ts = stateFor(lesson, 0);
    setCell(ts.sheets.Data, "N2", '=IF(M2 < 0.8, "PASS", "FAIL")');
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /"PASS"; expected "FAIL"/);
  });

  test("wrong: typed constants in N3:N6 with an IF only in N7 must not pass the fill", () => {
    const ts = stateFor(lesson, 1);
    // The verdicts a failed attempt discloses, typed by hand; only the last
    // row actually computes anything.
    setCells(ts.sheets.Data, {
      N3: "PASS", N4: "FAIL", N5: "FAIL", N6: "FAIL",
      N7: '=IF(M7 < 0.8, "FAIL", "PASS")',
    });
    const r = grade(ts, lesson.steps[1].grader);
    assert.equal(r.pass, false, "typed verdicts must not count as filling the IF down");
    assert.ok(r.diff.some((d) => d.kind === "method"), r.message);
  });

  test("wrong: hand-typed bands in O6/O12 plus one IFS in O101 must not band the file", () => {
    const ts = stateFor(lesson, 3);
    // Exactly the three cells the old grader looked at — 97 loans never banded.
    setCells(ts.sheets.Data, {
      O6: "Under $150k",
      O12: "Over $250k",
      O101: '=IFS(E101 < 150000, "Under $150k", E101 < 250000, "$150k-$250k", TRUE, "Over $250k")',
    });
    const r = grade(ts, lesson.steps[3].grader);
    assert.equal(r.pass, false, "97 unbanded rows must not count as banding all 100 loans");
    assert.ok(r.diff.some((d) => d.kind === "missing" || d.kind === "method"), r.message);
  });

  test("wrong: IFS conditions out of order pass on row 2 but are caught by the O6 spot-check", () => {
    const reversed = '=IFS(E2 < 250000, "$150k-$250k", E2 < 150000, "Under $150k", TRUE, "Over $250k")';
    // step 3 can't tell: E2 = 171,000 lands mid-band either way
    const s3 = stateFor(lesson, 2);
    setCell(s3.sheets.Data, "O2", reversed);
    assert.equal(grade(s3, lesson.steps[2].grader).pass, true);
    // step 4 catches it: the $69,500 loan in row 6 gets mis-banded
    const s4 = stateFor(lesson, 3);
    setCell(s4.sheets.Data, "O2", reversed);
    for (let r = 3; r <= 101; r++) copyCell(s4.sheets.Data, "O2", `O${r}`);
    const r = grade(s4, lesson.steps[3].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /O6.*expected "Under \$150k"/);
  });
});

// ==============================================================================
describe("excel-iferror: errors met, then handled", () => {
  const lesson = LESSONS_BY_ID["excel-iferror"];

  test("correct path: meet #DIV/0!, wrap it, meet #N/A, wrap it", () => {
    let session = createSession(lesson);

    const s1 = stateFor(lesson, 0);
    setCell(s1.sheets.Data, "L2", "=K2/J2");
    session = passStep(session, lesson, s1);

    const s2 = stateFor(lesson, 1);
    setCell(s2.sheets.Data, "L2", '=IFERROR(K2/J2, "n/a")');
    session = passStep(session, lesson, s2);

    const s3 = stateFor(lesson, 2);
    setCell(s3.sheets.Data, "N2", "=MATCH(99999, $D$2:$D$101, 0)");
    session = passStep(session, lesson, s3);

    const s4 = stateFor(lesson, 3);
    setCell(s4.sheets.Data, "N2", '=IFERROR(MATCH(99999, $D$2:$D$101, 0), "not found")');
    session = passStep(session, lesson, s4);

    assert.equal(isComplete(session), true);
    assert.equal(lessonScore(session, lesson).score, 1);
  });

  test("wrong: wrapping before meeting the error fails step 1 — the error is required", () => {
    const ts = stateFor(lesson, 0);
    setCell(ts.sheets.Data, "L2", '=IFERROR(K2/J2, "n/a")');
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /expected "#DIV\/0!"/);
  });

  test("wrong: IF(J2=0, ...) instead of IFERROR is redirected to the function being taught", () => {
    const ts = stateFor(lesson, 1);
    setCell(ts.sheets.Data, "L2", '=IF(J2=0, "n/a", K2/J2)');
    const r = grade(ts, lesson.steps[1].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /must use IFERROR/);
  });

  test("wrong: wrapping a junk expression instead of the K2/J2 rate must not pass the wrap step", () => {
    const ts = stateFor(lesson, 1);
    setCell(ts.sheets.Data, "L2", '=IFERROR(1/0, "n/a")');
    const r = grade(ts, lesson.steps[1].grader);
    assert.equal(r.pass, false, "IFERROR must wrap the rate the step teaches, not an arbitrary error");
    assert.ok(r.diff.some((d) => d.kind === "method"), r.message);
  });

  test("wrong: a junk MATCH that errors for the wrong reason must not pass the #N/A steps", () => {
    const s3 = stateFor(lesson, 2);
    setCell(s3.sheets.Data, "N2", "=MATCH(1, J1:J1, 0)");
    const r3 = grade(s3, lesson.steps[2].grader);
    assert.equal(r3.pass, false, "step 3 must demand the 99999 lookup over the ZIP column");
    const s4 = stateFor(lesson, 3);
    setCell(s4.sheets.Data, "N2", '=IFERROR(MATCH(1, J1:J1, 0), "not found")');
    const r4 = grade(s4, lesson.steps[3].grader);
    assert.equal(r4.pass, false, "step 4 must wrap the actual ZIP lookup");
  });
});

// ==============================================================================
describe("excel-references: break it, then pin it", () => {
  const lesson = LESSONS_BY_ID["excel-references"];

  test("correct path: relative, copy-and-break, pin-and-fill", () => {
    let session = createSession(lesson);

    const s1 = stateFor(lesson, 0);
    setCell(s1.sheets.Shares, "K2", "=J2/J8");
    session = passStep(session, lesson, s1);

    const s2 = stateFor(lesson, 1);
    copyCell(s2.sheets.Shares, "K2", "K3");
    session = passStep(session, lesson, s2);

    const s3 = stateFor(lesson, 2);
    setCell(s3.sheets.Shares, "K2", "=J2/$J$8");
    for (let r = 3; r <= 7; r++) copyCell(s3.sheets.Shares, "K2", `K${r}`);
    session = passStep(session, lesson, s3);

    assert.equal(isComplete(session), true);
    assert.equal(lessonScore(session, lesson).score, 1);
  });

  test("wrong: pinning in step 1 is rejected — the lesson needs the relative form first", () => {
    const ts = stateFor(lesson, 0);
    setCell(ts.sheets.Shares, "K2", "=J2/$J$8");
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /doesn't have the expected shape/);
  });

  test("wrong: retyping into K3 instead of copying misses the translated formula", () => {
    const ts = stateFor(lesson, 1);
    setCell(ts.sheets.Shares, "K3", "=J2/J8"); // typed fresh: refs did NOT translate
    const r = grade(ts, lesson.steps[1].grader);
    assert.equal(r.pass, false);
  });

  test("wrong: typed constants in the middle cells with pinned formulas only at the ends must not pass", () => {
    const ts = stateFor(lesson, 2);
    setCells(ts.sheets.Shares, {
      K2: "=J2/$J$8",
      K3: 8 / 76, K4: 9 / 76, K5: 12 / 76, K6: 2 / 76,
      K7: "=J7/$J$8",
    });
    const r = grade(ts, lesson.steps[2].grader);
    assert.equal(r.pass, false, "typed middle cells must not count as a pin-and-fill");
    assert.ok(r.diff.some((d) => d.kind === "method"), r.message);
  });

  test("wrong: pinning BOTH refs freezes every share at 0.026 and the diff names the cells", () => {
    const ts = stateFor(lesson, 2);
    setCell(ts.sheets.Shares, "K2", "=$J$2/$J$8");
    for (let r = 3; r <= 7; r++) copyCell(ts.sheets.Shares, "K2", `K${r}`);
    const r = grade(ts, lesson.steps[2].grader);
    assert.equal(r.pass, false);
    assert.ok(r.diff.some((d) => d.path === "K3"), r.message);
  });
});

// ==============================================================================
describe("excel-cleaning: TRIM, UPPER, SUBSTITUTE, VALUE", () => {
  const lesson = LESSONS_BY_ID["excel-cleaning"];

  test("correct path: the full cleaning pipeline", () => {
    let session = createSession(lesson);

    const s1 = stateFor(lesson, 0);
    setCell(s1.sheets.Import, "K2", "=TRIM(I2)");
    session = passStep(session, lesson, s1);

    const s2 = stateFor(lesson, 1);
    setCell(s2.sheets.Import, "K2", "=UPPER(TRIM(I2))");
    session = passStep(session, lesson, s2);

    const s3 = stateFor(lesson, 2);
    setCell(s3.sheets.Import, "L2", '=SUBSTITUTE(SUBSTITUTE(J2, "$", ""), ",", "")');
    session = passStep(session, lesson, s3);

    const s4 = stateFor(lesson, 3);
    setCell(s4.sheets.Import, "M2", "=VALUE(L2)");
    session = passStep(session, lesson, s4);

    assert.equal(isComplete(session), true);
    assert.equal(lessonScore(session, lesson).score, 1);
  });

  test("wrong: pasting the clean text by hand is a method failure", () => {
    const ts = stateFor(lesson, 1);
    setCell(ts.sheets.Import, "K2", "BLACK");
    const r = grade(ts, lesson.steps[1].grader);
    assert.equal(r.pass, false);
    assert.equal(r.diff[0].kind, "method");
  });

  test("wrong: UPPER without TRIM leaves padded text — caught by mustUse, not luck", () => {
    const ts = stateFor(lesson, 1);
    setCell(ts.sheets.Import, "K2", "=UPPER(I2)");
    const r = grade(ts, lesson.steps[1].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /must use TRIM/);
  });

  test("wrong: forgetting the comma SUBSTITUTE shows the leftover text", () => {
    const ts = stateFor(lesson, 2);
    setCell(ts.sheets.Import, "L2", '=SUBSTITUTE(J2, "$", "")');
    const r = grade(ts, lesson.steps[2].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /"171,000"; expected "171000"/);
  });
});

// ==============================================================================
describe("excel-stats: the stats block", () => {
  const lesson = LESSONS_BY_ID["excel-stats"];

  test("correct path: mean/median, stdev, group means, correlation", () => {
    let session = createSession(lesson);

    const s1 = stateFor(lesson, 0);
    setCells(s1.sheets.Data, { J2: "=AVERAGE(F2:F101)", J3: "=MEDIAN(F2:F101)" });
    session = passStep(session, lesson, s1);

    const s2 = stateFor(lesson, 1);
    setCell(s2.sheets.Data, "J4", "=STDEV.S(F2:F101)");
    session = passStep(session, lesson, s2);

    const s3 = stateFor(lesson, 2);
    setCells(s3.sheets.Data, {
      J5: '=AVERAGEIF($B$2:$B$101, "Black", $F$2:$F$101)',
      J6: '=AVERAGEIF($B$2:$B$101, "White", $F$2:$F$101)',
    });
    session = passStep(session, lesson, s3);

    const s4 = stateFor(lesson, 3);
    setCell(s4.sheets.Data, "J7", "=CORREL(E2:E101, F2:F101)");
    session = passStep(session, lesson, s4);

    assert.equal(isComplete(session), true);
    assert.equal(lessonScore(session, lesson).score, 1);
  });

  test("wrong: STDEV.P instead of STDEV.S is a method failure", () => {
    const ts = stateFor(lesson, 1);
    setCell(ts.sheets.Data, "J4", "=STDEV.P(F2:F101)");
    const r = grade(ts, lesson.steps[1].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /must use STDEV\.S/);
  });

  test("wrong: averaging the wrong column shows both numbers", () => {
    const ts = stateFor(lesson, 0);
    setCells(ts.sheets.Data, { J2: "=AVERAGE(E2:E101)", J3: "=MEDIAN(F2:F101)" });
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /returns 217355; expected 71475/);
  });
});

// ==============================================================================
describe("stats-rates: the approval gap, measured both ways", () => {
  const lesson = LESSONS_BY_ID["stats-rates"];
  const OVERALL = '=COUNTIF($G$2:$G$101, "APPROVED")/COUNTA($G$2:$G$101)';
  const BLACK_RATE = '=COUNTIFS($B$2:$B$101, "Black", $G$2:$G$101, "APPROVED")/COUNTIF($B$2:$B$101, "Black")';
  const WHITE_RATE = '=COUNTIFS($B$2:$B$101, "White", $G$2:$G$101, "APPROVED")/COUNTIF($B$2:$B$101, "White")';

  test("correct path: overall rate, group rates, absolute gap, ratio + verdict", () => {
    let session = createSession(lesson);

    const s1 = stateFor(lesson, 0);
    setCell(s1.sheets.Data, "J2", OVERALL);
    session = passStep(session, lesson, s1);

    const s2 = stateFor(lesson, 1);
    setCells(s2.sheets.Data, { J3: BLACK_RATE, J4: WHITE_RATE });
    session = passStep(session, lesson, s2);

    const s3 = stateFor(lesson, 2);
    setCell(s3.sheets.Data, "J5", "=J4-J3");
    session = passStep(session, lesson, s3);

    const s4 = stateFor(lesson, 3);
    setCells(s4.sheets.Data, { J6: "=J3/J4", J7: '=IF(J6 < 0.8, "FAIL", "PASS")' });
    session = passStep(session, lesson, s4);

    assert.equal(isComplete(session), true);
    assert.equal(lessonScore(session, lesson).score, 1);
  });

  test("wrong: typing 0.76 into J2 is a method failure even though the value is right", () => {
    const ts = stateFor(lesson, 0);
    setCell(ts.sheets.Data, "J2", 0.76);
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.ok(r.diff.some((d) => d.kind === "method"), r.message);
    assert.match(r.message, /typed in by hand/);
  });

  test("wrong: hardcoding /100 as the denominator is rejected — COUNTA is the method", () => {
    const ts = stateFor(lesson, 0);
    setCell(ts.sheets.Data, "J2", '=COUNTIF($G$2:$G$101, "APPROVED")/100');
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false, "a hardcoded denominator must not pass the proportion step");
    assert.match(r.message, /must use COUNTA/);
  });

  test("wrong: counting DENIED instead of APPROVED shows both rates", () => {
    const ts = stateFor(lesson, 0);
    setCell(ts.sheets.Data, "J2", '=COUNTIF($G$2:$G$101, "DENIED")/COUNTA($G$2:$G$101)');
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.ok(r.diff.some((d) => /0\.24.*expected 0\.76|returns 0\.24; expected 0\.76/.test(d.hint)), r.message);
  });

  test("wrong: swapping the two group rates shows both numbers", () => {
    const ts = stateFor(lesson, 1);
    setCells(ts.sheets.Data, { J3: WHITE_RATE, J4: BLACK_RATE });
    const r = grade(ts, lesson.steps[1].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /returns 0\.86; expected 0\.5625/);
  });

  test("wrong: hardcoded group counts in the rate are a method failure", () => {
    const ts = stateFor(lesson, 1);
    setCells(ts.sheets.Data, {
      J3: '=COUNTIFS($B$2:$B$101, "Black", $G$2:$G$101, "APPROVED")/16',
      J4: WHITE_RATE,
    });
    const r = grade(ts, lesson.steps[1].grader);
    assert.equal(r.pass, false, "dividing by a typed 16 must not count as computing the group size");
    assert.ok(r.diff.some((d) => d.kind === "method"), r.message);
  });

  test("wrong: inverting the gap subtraction fails with the negative number in the diff", () => {
    const ts = stateFor(lesson, 2);
    setCell(ts.sheets.Data, "J5", "=J3-J4");
    const r = grade(ts, lesson.steps[2].grader);
    assert.equal(r.pass, false);
    assert.ok(r.diff.some((d) => /-0\.2975/.test(d.hint)), r.message);
  });

  test("wrong: inverting the four-fifths ratio (White ÷ Black) fails with both numbers named", () => {
    const ts = stateFor(lesson, 3);
    setCells(ts.sheets.Data, { J6: "=J4/J3", J7: '=IF(J6 < 0.8, "FAIL", "PASS")' });
    const r = grade(ts, lesson.steps[3].grader);
    assert.equal(r.pass, false);
    assert.ok(r.diff.some((d) => /1\.528888889.*expected 0\.654069767|returns 1\.528888889/.test(d.hint)), r.message);
  });

  test("wrong: typing the FAIL verdict by hand is a method failure", () => {
    const ts = stateFor(lesson, 3);
    setCells(ts.sheets.Data, { J6: "=J3/J4", J7: "FAIL" });
    const r = grade(ts, lesson.steps[3].grader);
    assert.equal(r.pass, false, "the verdict must be computed with IF, not typed");
    assert.ok(r.diff.some((d) => d.kind === "method"), r.message);
    assert.match(r.message, /typed in by hand/);
  });
});

// ==============================================================================
describe("stats-probability: probability as a 0/1 flag", () => {
  const lesson = LESSONS_BY_ID["stats-probability"];
  const FLAG = '=IF(G2="APPROVED", 1, 0)';

  test("correct path: flag the file, overall P, income conditionals, group conditionals", () => {
    let session = createSession(lesson);

    const s1 = stateFor(lesson, 0);
    setCell(s1.sheets.Data, "H2", FLAG);
    for (let r = 3; r <= 101; r++) copyCell(s1.sheets.Data, "H2", `H${r}`);
    session = passStep(session, lesson, s1);

    const s2 = stateFor(lesson, 1);
    setCell(s2.sheets.Data, "J2", "=AVERAGE(H2:H101)");
    session = passStep(session, lesson, s2);

    const s3 = stateFor(lesson, 2);
    setCells(s3.sheets.Data, {
      J3: '=AVERAGEIFS($H$2:$H$101, $F$2:$F$101, ">=90000")',
      J4: '=AVERAGEIFS($H$2:$H$101, $F$2:$F$101, "<90000")',
    });
    session = passStep(session, lesson, s3);

    const s4 = stateFor(lesson, 3);
    setCells(s4.sheets.Data, {
      J5: '=AVERAGEIF($B$2:$B$101, "Hispanic", $H$2:$H$101)',
      J6: '=AVERAGEIF($B$2:$B$101, "Asian", $H$2:$H$101)',
    });
    session = passStep(session, lesson, s4);

    assert.equal(isComplete(session), true);
    assert.equal(lessonScore(session, lesson).score, 1);
  });

  test("wrong: 100 hand-typed 0/1 flags fail on METHOD even with every value right", () => {
    const ts = stateFor(lesson, 0);
    for (let r = 2; r <= 101; r++) {
      const approved = getValue(ts.sheets.Data, `G${r}`) === "APPROVED";
      setCell(ts.sheets.Data, `H${r}`, approved ? 1 : 0);
    }
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false, "typed flags must not pass an IF fill-down");
    assert.ok(r.diff.some((d) => d.kind === "method"), r.message);
  });

  test("wrong: one IF in H2 with 99 blank rows must not count as flagging the file", () => {
    const ts = stateFor(lesson, 0);
    setCell(ts.sheets.Data, "H2", FLAG);
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false, "99 blank rows must not pass the flag step");
    assert.ok(r.diff.some((d) => d.kind === "missing"), r.message);
    assert.match(r.message, /of 100 rows/);
  });

  test("wrong: swapping the 1 and the 0 flips every flag, and the diff names the first cell", () => {
    const ts = stateFor(lesson, 0);
    setCell(ts.sheets.Data, "H2", '=IF(G2="APPROVED", 0, 1)');
    for (let r = 3; r <= 101; r++) copyCell(ts.sheets.Data, "H2", `H${r}`);
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.ok(r.diff.some((d) => d.path === "H2"), r.message);
  });

  test("wrong: computing P(approved) by counting instead of averaging the flag is redirected to AVERAGE", () => {
    const ts = stateFor(lesson, 1);
    setCell(ts.sheets.Data, "J2", '=COUNTIF($G$2:$G$101, "APPROVED")/100');
    const r = grade(ts, lesson.steps[1].grader);
    assert.equal(r.pass, false, "the step teaches probability as the MEAN of the flag");
    assert.match(r.message, /must use AVERAGE/);
  });

  test("wrong: flipping the income criteria shows both probabilities", () => {
    const ts = stateFor(lesson, 2);
    setCells(ts.sheets.Data, {
      J3: '=AVERAGEIFS($H$2:$H$101, $F$2:$F$101, "<90000")',
      J4: '=AVERAGEIFS($H$2:$H$101, $F$2:$F$101, ">=90000")',
    });
    const r = grade(ts, lesson.steps[2].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /returns 0\.75; expected 0\.8125/);
  });

  test("wrong: averaging income instead of the flag returns dollars, not a probability", () => {
    const ts = stateFor(lesson, 3);
    setCells(ts.sheets.Data, {
      J5: '=AVERAGEIF($B$2:$B$101, "Hispanic", $F$2:$F$101)',
      J6: '=AVERAGEIF($B$2:$B$101, "Asian", $H$2:$H$101)',
    });
    const r = grade(ts, lesson.steps[3].grader);
    assert.equal(r.pass, false);
    assert.ok(r.diff.some((d) => /74638\.88889.*expected 0\.6666666667|returns 74638\.88889/.test(d.hint)), r.message);
  });
});

// ==============================================================================
describe("tableau-dimensions: dims, measures, orientation", () => {
  const lesson = LESSONS_BY_ID["tableau-dimensions"];

  test("correct path: slice, aggregate, read, swap", () => {
    let session = createSession(lesson);

    const s1 = stateFor(lesson, 0);
    s1.spec = putOnShelf(s1.spec, Shelf.ROWS, dim("race"));
    session = passStep(session, lesson, s1);

    const s2 = stateFor(lesson, 1);
    s2.spec = putOnShelf(s2.spec, Shelf.COLUMNS, countPill());
    session = passStep(session, lesson, s2);

    const s3 = stateFor(lesson, 2); // Automatic resolves to bar
    session = passStep(session, lesson, s3);

    const s4 = stateFor(lesson, 3);
    s4.spec = removeFromShelf(removeFromShelf(s4.spec, Shelf.ROWS, "race"), Shelf.COLUMNS, "applicant_id");
    s4.spec = putOnShelf(putOnShelf(s4.spec, Shelf.COLUMNS, dim("race")), Shelf.ROWS, countPill());
    session = passStep(session, lesson, s4);

    assert.equal(isComplete(session), true);
    assert.equal(lessonScore(session, lesson).score, 1);
  });

  test("wrong: race on Columns in step 1 is a misplaced pill", () => {
    const ts = stateFor(lesson, 0);
    ts.spec = putOnShelf(ts.spec, Shelf.COLUMNS, dim("race"));
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.equal(r.diff[0].kind, "misplaced");
    assert.match(r.message, /on Columns; the task asked for it on Rows/);
  });

  test("wrong: SUM(loan_amount) instead of the count asks for the right pill", () => {
    const ts = stateFor(lesson, 1);
    ts.spec = putOnShelf(ts.spec, Shelf.COLUMNS, measure("loan_amount", "SUM"));
    const r = grade(ts, lesson.steps[1].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /Drag applicant_id to Columns/);
  });

  test("wrong: copying race to Columns while leaving it on Rows is flagged as extra (strict)", () => {
    const ts = stateFor(lesson, 3);
    ts.spec = removeFromShelf(ts.spec, Shelf.COLUMNS, "applicant_id");
    ts.spec = putOnShelf(putOnShelf(ts.spec, Shelf.COLUMNS, dim("race")), Shelf.ROWS, countPill());
    // race is now on BOTH Rows and Columns
    const r = grade(ts, lesson.steps[3].grader);
    assert.equal(r.pass, false);
    assert.ok(r.diff.some((d) => d.kind === "extra" && /race/.test(d.hint)), r.message);
  });
});

// ==============================================================================
describe("tableau-pills: aggregation and discrete vs continuous", () => {
  const lesson = LESSONS_BY_ID["tableau-pills"];

  test("correct path: SUM→AVG, AVG→MEDIAN, continuous→discrete", () => {
    let session = createSession(lesson);

    const s1 = stateFor(lesson, 0);
    s1.spec = setAggregation(s1.spec, Shelf.ROWS, "loan_amount", "AVG");
    session = passStep(session, lesson, s1);

    const s2 = stateFor(lesson, 1);
    s2.spec = setAggregation(s2.spec, Shelf.ROWS, "loan_amount", "MEDIAN");
    session = passStep(session, lesson, s2);

    const s3 = stateFor(lesson, 2);
    s3.spec = setDiscrete(s3.spec, Shelf.ROWS, "loan_amount", true);
    session = passStep(session, lesson, s3);

    assert.equal(isComplete(session), true);
    assert.equal(lessonScore(session, lesson).score, 1);
  });

  test("wrong: COUNT instead of AVG names both aggregations", () => {
    const ts = stateFor(lesson, 0);
    ts.spec = setAggregation(ts.spec, Shelf.ROWS, "loan_amount", "COUNT");
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /aggregated with COUNT.*asks for AVG/);
  });

  test("wrong: leaving the pill continuous on the discrete step says blue, not green", () => {
    const ts = stateFor(lesson, 2); // MEDIAN pill, still continuous
    const r = grade(ts, lesson.steps[2].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /discrete \(a blue pill\)/);
  });
});

// ==============================================================================
describe("tableau-filters: categorical, range, top-N", () => {
  const lesson = LESSONS_BY_ID["tableau-filters"];

  test("correct path: keep four, slice the band, top 3", () => {
    let session = createSession(lesson);

    const s1 = stateFor(lesson, 0);
    s1.spec = { ...s1.spec, filters: [categoricalFilter("race", ["Asian", "Black", "Hispanic", "White"])] };
    session = passStep(session, lesson, s1);

    const s2 = stateFor(lesson, 1);
    s2.spec = { ...s2.spec, filters: [rangeFilter("loan_amount", 150000, 250000)] };
    session = passStep(session, lesson, s2);

    const s3 = stateFor(lesson, 2);
    s3.spec = { ...s3.spec, filters: [topNFilter("race", 3, { field: "applicant_id", aggregation: "COUNT" })] };
    session = passStep(session, lesson, s3);

    assert.equal(isComplete(session), true);
    assert.equal(lessonScore(session, lesson).score, 1);
  });

  test("wrong: keeping five groups leaves an extra mark, named", () => {
    const ts = stateFor(lesson, 0);
    ts.spec = { ...ts.spec, filters: [categoricalFilter("race", ["Asian", "Black", "Hispanic", "White", "Other"])] };
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.ok(r.diff.some((d) => /race = Other/.test(d.hint)), r.message);
  });

  test("wrong: filtering gender instead of race asks for the race filter", () => {
    const ts = stateFor(lesson, 0);
    ts.spec = { ...ts.spec, filters: [categoricalFilter("gender", ["Male", "Female"])] };
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /Add a filter on race/);
  });

  test("wrong: top 5 instead of top 3 leaves extra groups", () => {
    const ts = stateFor(lesson, 2);
    ts.spec = { ...ts.spec, filters: [topNFilter("race", 5, { field: "applicant_id", aggregation: "COUNT" })] };
    const r = grade(ts, lesson.steps[2].grader);
    assert.equal(r.pass, false);
    assert.ok(r.diff.some((d) => d.kind === "extra"), r.message);
  });
});

// ==============================================================================
describe("tableau-color: hue slices, ramps rank", () => {
  const lesson = LESSONS_BY_ID["tableau-color"];

  test("correct path: split, read, ramp", () => {
    let session = createSession(lesson);

    const s1 = stateFor(lesson, 0);
    s1.spec = putOnShelf(s1.spec, Shelf.COLOR, dim("approved"));
    session = passStep(session, lesson, s1);

    const s2 = stateFor(lesson, 1); // the checkpoint already carries the split view
    session = passStep(session, lesson, s2);

    const s3 = stateFor(lesson, 2);
    s3.spec = removeFromShelf(s3.spec, Shelf.COLOR);
    s3.spec = putOnShelf(s3.spec, Shelf.COLOR, measure("is_approved", "AVG"));
    session = passStep(session, lesson, s3);

    assert.equal(isComplete(session), true);
    assert.equal(lessonScore(session, lesson).score, 1);
  });

  test("wrong: approved dropped on Rows instead of Color is misplaced", () => {
    const ts = stateFor(lesson, 0);
    ts.spec = putOnShelf(ts.spec, Shelf.ROWS, dim("approved"));
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /on Rows; the task asked for it on Color/);
  });

  test("wrong: a discrete flag on Color yields a categorical palette, diagnosed by the legend check", () => {
    const ts = stateFor(lesson, 2);
    ts.spec = removeFromShelf(ts.spec, Shelf.COLOR);
    // dropped as a blue (discrete) pill — 0/1 swatches instead of a ramp
    ts.spec = putOnShelf(ts.spec, Shelf.COLOR, createEncoding(makeField("is_approved", FieldType.NUMBER), { aggregation: null, discrete: true }));
    const legendCheck = lesson.steps[2].grader.of.find((g) => g.type === "predicate");
    const r = grade(ts, legendCheck);
    assert.equal(r.pass, false);
    assert.match(r.message, /categorical palette, not a light-to-dark ramp/);
  });
});

// ==============================================================================
describe("tableau-showme: greyed-out marks explained", () => {
  const lesson = LESSONS_BY_ID["tableau-showme"];

  test("correct path: unlock bar, build the scatter, choose bar over line", () => {
    let session = createSession(lesson);

    const s1 = stateFor(lesson, 0);
    s1.spec = putOnShelf(s1.spec, Shelf.ROWS, countPill());
    s1.spec = { ...s1.spec, mark: "bar" };
    session = passStep(session, lesson, s1);

    const s2 = stateFor(lesson, 1);
    s2.spec = putOnShelf(s2.spec, Shelf.COLUMNS, measure("income", "AVG"));
    s2.spec = putOnShelf(s2.spec, Shelf.ROWS, measure("loan_amount", "AVG"));
    s2.spec = putOnShelf(s2.spec, Shelf.DETAIL, dim("race"));
    s2.spec = { ...s2.spec, mark: "scatter" };
    session = passStep(session, lesson, s2);

    const s3 = stateFor(lesson, 2);
    s3.spec = { ...s3.spec, mark: "bar" };
    session = passStep(session, lesson, s3);

    assert.equal(isComplete(session), true);
    assert.equal(lessonScore(session, lesson).score, 1);
  });

  test("wrong: forcing the bar mark without a measure still fails — with the missing pill named", () => {
    const ts = stateFor(lesson, 0);
    ts.spec = { ...ts.spec, mark: "bar" };
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /Drag applicant_id to Rows/);
    // the Show Me predicate agrees with the panel: bar is still invalid
    assert.ok(r.diff.some((d) => /greys bar out/.test(d.hint)), r.message);
  });

  test("wrong: unaggregated pills can't make a scatter — the aggregation is demanded", () => {
    const ts = stateFor(lesson, 1);
    ts.spec = putOnShelf(ts.spec, Shelf.COLUMNS, createEncoding(makeField("income", FieldType.NUMBER), { aggregation: null }));
    ts.spec = putOnShelf(ts.spec, Shelf.ROWS, createEncoding(makeField("loan_amount", FieldType.NUMBER), { aggregation: null }));
    ts.spec = putOnShelf(ts.spec, Shelf.DETAIL, dim("race"));
    ts.spec = { ...ts.spec, mark: "scatter" };
    const r = grade(ts, lesson.steps[1].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /aggregated as AVG/);
  });

  test("wrong: leaving the line mark on step 3 names both marks", () => {
    const ts = stateFor(lesson, 2); // checkpoint arrives with mark: line
    const r = grade(ts, lesson.steps[2].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /uses the line mark.*asks for bar/);
  });
});

// ==============================================================================
describe("tableau-calc: the loan-to-income ratio", () => {
  const lesson = LESSONS_BY_ID["tableau-calc"];
  const EXPR = "[loan_amount] / [income]";

  test("correct path: mint, shelve, read", () => {
    let session = createSession(lesson);

    const s1 = stateFor(lesson, 0);
    s1.spec = { ...s1.spec, calculatedFields: [createCalculatedField("loan_to_income", EXPR)] };
    session = passStep(session, lesson, s1);

    const s2 = stateFor(lesson, 1);
    s2.spec = putOnShelf(s2.spec, Shelf.COLUMNS, dim("race"));
    s2.spec = putOnShelf(s2.spec, Shelf.ROWS, measure("loan_to_income", "AVG"));
    session = passStep(session, lesson, s2);

    const s3 = stateFor(lesson, 2); // Automatic resolves to bar
    session = passStep(session, lesson, s3);

    assert.equal(isComplete(session), true);
    assert.equal(lessonScore(session, lesson).score, 1);
  });

  test("wrong: the inverted ratio is diagnosed by name", () => {
    const ts = stateFor(lesson, 0);
    ts.spec = { ...ts.spec, calculatedFields: [createCalculatedField("loan_to_income", "[income] / [loan_amount]")] };
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /divided income by loan_amount/);
  });

  test("wrong: a misnamed field is pinned to the exact name", () => {
    const ts = stateFor(lesson, 0);
    ts.spec = { ...ts.spec, calculatedFields: [createCalculatedField("lti", EXPR)] };
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /named lti/);
    assert.match(r.message, /exactly loan_to_income/);
  });

  test("wrong: SUM(loan_to_income) on the final step fails the outcome with the caption named", () => {
    const ts = stateFor(lesson, 2);
    ts.spec = setAggregation(ts.spec, Shelf.ROWS, "loan_to_income", "SUM");
    const r = grade(ts, lesson.steps[2].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /asks for AVG/);
  });
});

// ==============================================================================
describe("tableau-dashboard: loan bands", () => {
  const lesson = LESSONS_BY_ID["tableau-dashboard"];
  const BAND_EXPR =
    'IF([loan_amount] < 150000, "Under $150k", IF([loan_amount] < 250000, "$150k-$250k", "Over $250k"))';

  test("correct path: mint the band, count it, rate it", () => {
    let session = createSession(lesson);

    const s1 = stateFor(lesson, 0);
    s1.spec = { ...s1.spec, calculatedFields: [createCalculatedField("loan_band", BAND_EXPR)] };
    session = passStep(session, lesson, s1);

    const s2 = stateFor(lesson, 1);
    s2.spec = putOnShelf(s2.spec, Shelf.COLUMNS, dim("loan_band"));
    s2.spec = putOnShelf(s2.spec, Shelf.ROWS, countPill());
    s2.spec = { ...s2.spec, mark: "bar" };
    session = passStep(session, lesson, s2);

    const s3 = stateFor(lesson, 2);
    s3.spec = removeFromShelf(s3.spec, Shelf.ROWS, "applicant_id");
    s3.spec = putOnShelf(s3.spec, Shelf.ROWS, measure("is_approved", "AVG"));
    session = passStep(session, lesson, s3);

    assert.equal(isComplete(session), true);
    assert.equal(lessonScore(session, lesson).score, 1);
  });

  test("wrong: home-made band labels are pinned to the exact names", () => {
    const ts = stateFor(lesson, 0);
    const expr = 'IF([loan_amount] < 150000, "small", IF([loan_amount] < 250000, "medium", "large"))';
    ts.spec = { ...ts.spec, calculatedFields: [createCalculatedField("loan_band", expr)] };
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /exact labels/);
    assert.match(r.message, /small/);
  });

  test("wrong: conditions in the wrong order mis-band the 18 small loans", () => {
    const ts = stateFor(lesson, 0);
    const expr = 'IF([loan_amount] < 250000, "$150k-$250k", IF([loan_amount] < 150000, "Under $150k", "Over $250k"))';
    ts.spec = { ...ts.spec, calculatedFields: [createCalculatedField("loan_band", expr)] };
    const r = grade(ts, lesson.steps[0].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /18 of 100 loans land in the wrong band/);
  });

  test("wrong: summing the flag on the rate step is redirected to AVG", () => {
    const ts = stateFor(lesson, 2);
    ts.spec = removeFromShelf(ts.spec, Shelf.ROWS, "applicant_id");
    ts.spec = putOnShelf(ts.spec, Shelf.ROWS, measure("is_approved", "SUM"));
    const r = grade(ts, lesson.steps[2].grader);
    assert.equal(r.pass, false);
    assert.match(r.message, /asks for AVG/);
  });
});
