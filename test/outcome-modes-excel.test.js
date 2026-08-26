// Outcome modes for the excel/stats spreadsheet labs — the Phase 4b property
// checks. An audit found 37 of 60 spreadsheet-lesson instructions contained
// the finished formula (13 more were pure fill-down): the decision was
// pre-made and the learner supplied keystrokes. The outcome variants exist to
// re-pose every step as the business question with the mechanics withheld.
//
// This file asserts that property MECHANICALLY, across every converted
// lesson:
//   1. the declared "outcome" mode resolves for every step — no silent
//      fallback to the scaffolded variant (the exact bug class Phase 4a found
//      in session deserialization);
//   2. no outcome-mode instruction contains a formula or names an engine
//      function — the property the entire phase exists to create;
//   3. outcome hints likewise name no function, and stay 1-3 rungs;
//   4. step ids and checkpoints are IDENTICAL between modes;
//   5. anti-vacuity: the exact lesson set is present, so the suite cannot
//      pass over an empty or shrunken collection.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { lessonModes, resolveLessonMode } from "../lib/guide/spec.js";
import { FUNCTIONS } from "../lib/sheet/functions.js";

import { lesson as excelCleaning } from "../lib/guide/lessons/excel-cleaning.js";
import { lesson as excelCountifs } from "../lib/guide/lessons/excel-countifs.js";
import { lesson as excelDates } from "../lib/guide/lessons/excel-dates.js";
import { lesson as excelFormulasGuide } from "../lib/guide/lessons/excel-formulas-guide.js";
import { lesson as excelIfIfs } from "../lib/guide/lessons/excel-if-ifs.js";
import { lesson as excelIferror } from "../lib/guide/lessons/excel-iferror.js";
import { lesson as excelIndexMatch } from "../lib/guide/lessons/excel-index-match.js";
import { lesson as excelLookupReverse } from "../lib/guide/lessons/excel-lookup-reverse.js";
import { lesson as excelPivotRates } from "../lib/guide/lessons/excel-pivot-rates.js";
import { lesson as excelReferences } from "../lib/guide/lessons/excel-references.js";
import { lesson as excelStats } from "../lib/guide/lessons/excel-stats.js";
import { lesson as excelTextjoin } from "../lib/guide/lessons/excel-textjoin.js";
import { lesson as excelXlookup } from "../lib/guide/lessons/excel-xlookup.js";
import { lesson as statsRates } from "../lib/guide/lessons/stats-rates.js";
import { lesson as statsProbability } from "../lib/guide/lessons/stats-probability.js";

/** Every lesson this phase converted. Imported directly (not via the LESSONS
 *  registry) so this suite's scope can't drift with registry edits. */
const CONVERTED = [
  excelCleaning, excelCountifs, excelDates, excelFormulasGuide, excelIfIfs,
  excelIferror, excelIndexMatch, excelLookupReverse, excelPivotRates,
  excelReferences, excelStats, excelTextjoin, excelXlookup, statsRates,
  statsProbability,
];

/** The exact ids expected above — the anti-vacuity anchor. */
const CONVERTED_IDS = [
  "excel-cleaning", "excel-countifs", "excel-dates", "excel-formulas-guide",
  "excel-if-ifs", "excel-iferror", "excel-index-match", "excel-lookup-reverse",
  "excel-pivot-rates", "excel-references", "excel-stats", "excel-textjoin",
  "excel-xlookup", "stats-rates", "stats-probability",
];

// A formula: "=" then a function-shaped call. Derived, not hand-listed, so a
// new way of pasting a formula into an instruction still trips it.
const FORMULA_RE = /=\s*[A-Z][A-Z0-9.]*\s*\(/;

// Engine function names as standalone uppercase tokens. Escaped because the
// list contains dots (STDEV.S, PERCENTILE.INC). Uppercase-only on purpose:
// prose may say "the median" — it may not say "MEDIAN". The boundary excludes
// letters of BOTH cases: the engine exports single-letter functions (T, N),
// and a case-blind boundary would flag the T in "The". A period IS a boundary
// ("use AVERAGE." at a sentence end must still flag) — dotted names like
// STDEV.S match through their own escaped-dot regexes, not the boundary.
const FUNCTION_RES = Object.keys(FUNCTIONS).map((name) => ({
  name,
  re: new RegExp(`(^|[^A-Za-z0-9])${name.replace(/\./g, "\\.")}($|[^A-Za-z0-9])`),
}));

function namedFunctions(text) {
  return FUNCTION_RES.filter(({ re }) => re.test(text)).map(({ name }) => name);
}

describe("outcome modes: excel/stats labs", () => {
  test("anti-vacuity: the full converted set is present, with steps", () => {
    assert.deepEqual(CONVERTED.map((l) => l.id), CONVERTED_IDS);
    for (const lesson of CONVERTED) {
      assert.ok(lesson.steps.length > 0, `${lesson.id} has no steps`);
    }
    // The suite below iterates real overrides — make sure there ARE some.
    const overrides = CONVERTED.flatMap((l) => l.steps).filter((s) => s.modes?.outcome);
    assert.ok(overrides.length >= 40, `expected a converted corpus, found ${overrides.length} outcome overrides`);
  });

  for (const lesson of CONVERTED) {
    describe(lesson.id, () => {
      test("declares the outcome mode", () => {
        assert.ok(lesson.modes.includes("outcome"), `${lesson.id} does not declare "outcome"`);
        assert.ok(lessonModes(lesson).includes("outcome"));
      });

      const resolved = resolveLessonMode(lesson, "outcome");

      test("outcome resolves for every step — no silent fallback", () => {
        // The exact bug class from Phase 4a's session deserialization: a mode
        // that quietly reverts to the scaffolded variant. Resolution must (a)
        // mark the lesson as being in outcome mode, and (b) apply every
        // step's override verbatim.
        assert.equal(resolved.mode, "outcome");
        assert.equal(resolved.steps.length, lesson.steps.length);
        lesson.steps.forEach((step, i) => {
          const ov = step.modes?.outcome;
          assert.ok(ov, `${lesson.id}/${step.id} has no outcome override — it would silently serve the scaffolded step`);
          assert.ok(typeof ov.instruction === "string" && ov.instruction.trim() !== "",
            `${lesson.id}/${step.id} outcome override lacks an instruction`);
          assert.equal(resolved.steps[i].instruction, ov.instruction,
            `${lesson.id}/${step.id} did not resolve to its outcome instruction`);
          if (ov.hints) assert.deepEqual(resolved.steps[i].hints, ov.hints);
          if (ov.grader) assert.equal(resolved.steps[i].grader, ov.grader);
        });
      });

      test("no outcome instruction contains a formula or names a function", () => {
        // THE assertion this phase exists to create: the instruction is the
        // business question, never the keystrokes.
        for (const step of resolved.steps) {
          assert.ok(!FORMULA_RE.test(step.instruction),
            `${lesson.id}/${step.id} outcome instruction contains a formula: ${step.instruction}`);
          const named = namedFunctions(step.instruction);
          assert.deepEqual(named, [],
            `${lesson.id}/${step.id} outcome instruction names function(s) ${named.join(", ")}: ${step.instruction}`);
        }
      });

      test("outcome hints name no function and stay short", () => {
        for (const step of resolved.steps) {
          assert.ok(step.hints.length >= 1 && step.hints.length <= 3,
            `${lesson.id}/${step.id} outcome hints should be 1-3 rungs, got ${step.hints.length}`);
          for (const hint of step.hints) {
            assert.ok(!FORMULA_RE.test(hint),
              `${lesson.id}/${step.id} outcome hint contains a formula: ${hint}`);
            const named = namedFunctions(hint);
            assert.deepEqual(named, [],
              `${lesson.id}/${step.id} outcome hint names function(s) ${named.join(", ")}: ${hint}`);
          }
        }
      });

      test("step ids and checkpoints identical between modes", () => {
        // A mode is a re-posing, not a different lesson: sessions key state by
        // step id, and checkpoints must stay valid so a learner can switch
        // variants without losing their seed states.
        lesson.steps.forEach((step, i) => {
          assert.equal(resolved.steps[i].id, step.id,
            `${lesson.id} step ${i}: id changed across modes`);
          assert.equal(resolved.steps[i].checkpoint, step.checkpoint,
            `${lesson.id}/${step.id}: checkpoint changed across modes`);
        });
      });
    });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   Inherited method-locked graders.

   An outcome override with NO grader of its own silently inherits the BASE
   grader. When that base grader is method-locked (mustUse/mustNotUse/pattern),
   the outcome learner is graded against constraints the outcome instruction
   never stated — which is how excel-dates/years-with-decimal re-created the
   exact reject-a-correct-answer trap Phase 1 removed: the outcome text said
   "express the span as a fraction of an average-length year" while the
   inherited grader demanded (B2-A2)/365.25 literally and banned DATEDIF, so
   =C2/365.25 was marked wrong.

   The sweep below makes that class of regression impossible to reintroduce
   silently: every override that inherits a method-locked grader must appear
   in the allowlist, and each allowlist entry exists only because its outcome
   instruction names the exact cells the pattern demands (verified by hand
   2026-08-26), so the inherited constraint is satisfiable from the outcome
   text alone:
     - excel-references/relative-works: "J2 against J8", "no pinning" — the
       unpinned J2/J8 shape IS the step's outcome.
     - excel-references/copy-and-break: "copy K2 into K3" — the translated
       J3/J9 and its error emerge mechanically from the instructed copy.
     - excel-iferror/meet-div0: "compute its approval rate from those two
       cells" (K2, J2) — the pattern pins cells the instruction names.
   Adding a NEW inheriting override fails here until it either gets its own
   outcome grader or is justified and allowlisted in review.
   ══════════════════════════════════════════════════════════════════════════ */
describe("outcome overrides never inherit a method-locked base grader unvetted", () => {
  /** Does this grader (or any allOf/anyOf member) carry a method lock? */
  function methodLocked(g) {
    if (!g) return false;
    if ((g.mustUse?.length ?? 0) > 0 || (g.mustNotUse?.length ?? 0) > 0 || g.pattern) return true;
    if (Array.isArray(g.of)) return g.of.some(methodLocked);
    return false;
  }

  const ALLOWED = [
    "excel-iferror/meet-div0",
    "excel-references/copy-and-break",
    "excel-references/relative-works",
  ];

  test("the inheriting set is exactly the vetted allowlist", () => {
    const inheriting = [];
    for (const lesson of CONVERTED) {
      for (const step of lesson.steps) {
        const ov = step.modes?.outcome;
        if (!ov || ov.grader) continue; // no override, or it graded itself
        if (methodLocked(step.grader)) inheriting.push(`${lesson.id}/${step.id}`);
      }
    }
    assert.deepEqual(inheriting.sort(), ALLOWED,
      "an outcome override is inheriting a mustUse/mustNotUse/pattern base grader " +
      "its instruction may not support — give it an outcome grader of its own, " +
      "or verify the instruction names what the pattern demands and allowlist it");
  });

  test("anti-vacuity: methodLocked recognises locks, including nested ones", () => {
    // If this detector rotted, the sweep above would pass over anything.
    assert.equal(methodLocked({ type: "cellFormula", pattern: "A1" }), true);
    assert.equal(methodLocked({ type: "cellFormula", mustNotUse: ["DATEDIF"] }), true);
    assert.equal(methodLocked({ type: "allOf", of: [{ type: "cellValue" }, { type: "cellFormula", mustUse: ["IF"] }] }), true);
    assert.equal(methodLocked({ type: "rangeValues" }), false);
  });
});

/* The remediation itself: in outcome mode, years-with-decimal must credit
   every correct route to "the span as a fraction of a year", while still
   refusing the DATEDIF("Y")+MOD hybrid the lesson header documents. Graded
   through resolveLessonMode + the real grade() — the exact path the runner
   takes — so a regression to the inherited base grader goes red here. */
describe("excel-dates/years-with-decimal outcome grader accepts every correct route", () => {
  const resolved = resolveLessonMode(excelDates, "outcome");
  const stepIdx = excelDates.steps.findIndex((s) => s.id === "years-with-decimal");

  async function gradeD2(formulaOrValue) {
    const { grade } = await import("../lib/guide/graders.js");
    const { startingState } = await import("../lib/guide/checkpoints.js");
    const { setCell } = await import("../lib/sheet/model.js");
    const ts = startingState(excelDates, stepIdx, {}).toolState;
    setCell(ts.sheets.Data, "D2", formulaOrValue);
    return grade(ts, resolved.steps[stepIdx].grader);
  }

  test("the override carries its own grader — it no longer inherits the method-locked base", () => {
    assert.ok(excelDates.steps[stepIdx].modes.outcome.grader,
      "years-with-decimal outcome override lost its grader — it would fall back to the (B2-A2)/365.25 pattern");
    assert.notEqual(resolved.steps[stepIdx].grader, excelDates.steps[stepIdx].grader);
  });

  test("correct routes all pass: taught form, days-column division, DATEDIF-D division", async () => {
    // =C2/365.25 divides the days column built in the previous step — the
    // natural move, and the exact input the inherited grader marked wrong.
    for (const f of ["=(B2-A2)/365.25", "=C2/365.25", '=DATEDIF(A2,B2,"D")/365.25']) {
      const r = await gradeD2(f);
      assert.equal(r.pass, true, `${f} is correct under the outcome instruction: ${r.message}`);
    }
  });

  test("the double-counting hybrid still fails, even though its value agrees on this row", async () => {
    const r = await gradeD2('=DATEDIF(A2,B2,"Y") + (MOD(B2-A2,365.25)/365.25)');
    assert.equal(r.pass, false, "the hybrid must stay out of outcome mode too");
  });

  test("a typed constant and a wrong value both fail", async () => {
    assert.equal((await gradeD2(0.0876)).pass, false, "typed value is not a computed fraction");
    assert.equal((await gradeD2("=(B2-A2)/365")).pass, false, "365 is not the average year length");
  });
});
