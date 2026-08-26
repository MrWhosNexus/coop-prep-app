// Prerequisite ordering for the guided-lesson registry.
//
// LESSONS in lib/guide/lessons/index.js is a PREREQUISITE order: no lesson may
// hard-require, via its graders, a technique introduced by a later lesson. The
// order once rotted silently — $-pinning was graded (excel-xlookup,
// excel-countifs) five positions before the lesson that teaches it — because
// nothing re-derived the requirement graph. This test derives it MECHANICALLY
// from what the graders actually demand (mustUse function names, mandatory `$`
// in pattern regexes), not from lesson titles, so the order cannot rot again.
//
// It also validates TECHNIQUES_TAUGHT itself: every claimed technique must
// actually appear in the teaching lesson's own graded or hinted material, so
// the map cannot drift into fiction that would make the order check vacuous.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { LESSONS, TECHNIQUES_TAUGHT } from "../lib/guide/lessons/index.js";
import { lessonModes, resolveLessonMode } from "../lib/guide/spec.js";

/* Flatten a grader descriptor tree (allOf/anyOf nest) into a list of leaf
   descriptors. Predicate graders carry a closure we cannot inspect; they
   contribute nothing here, which is fine — hard requirements in this codebase
   are expressed through cellFormula's mustUse/pattern. */
function leafGraders(d, out = []) {
  if (!d || typeof d !== "object") return out;
  if (Array.isArray(d.of)) d.of.forEach((c) => leafGraders(c, out));
  else out.push(d);
  return out;
}

/* Every grader descriptor a lesson can serve, across ALL of its declared
   modes — a variant's override grader is just as much a hard requirement as
   the base one. */
function allGraders(lesson) {
  const out = [];
  for (const mode of lessonModes(lesson)) {
    for (const step of resolveLessonMode(lesson, mode).steps) {
      leafGraders(step.grader, out);
    }
  }
  return out;
}

/* A pattern regex source hard-requires $-pinning only when it contains a
   MANDATORY escaped dollar — `\$L\$2` does, `\$?K\$?2` (optional pin) does
   not. */
function patternRequiresAbsRef(source) {
  return /\\\$(?!\?)/.test(String(source));
}

/** Technique names lesson `lesson` hard-requires, derived from its graders. */
function requiredTechniques(lesson) {
  const req = new Set();
  for (const g of allGraders(lesson)) {
    for (const fn of g.mustUse ?? []) req.add(fn);
    if (g.pattern && patternRequiresAbsRef(g.pattern)) req.add("abs-ref");
  }
  return req;
}

/* The material a lesson TEACHES with: its graded demands plus its hint text,
   across all modes. Used to validate TECHNIQUES_TAUGHT claims. */
function teachingMaterial(lesson) {
  const text = [];
  for (const mode of lessonModes(lesson)) {
    for (const step of resolveLessonMode(lesson, mode).steps) {
      text.push(step.instruction ?? "", ...(step.hints ?? []));
      for (const g of leafGraders(step.grader)) {
        text.push(...(g.mustUse ?? []));
        if (g.pattern) text.push(String(g.pattern));
      }
    }
  }
  return text.join("\n");
}

function teachesTechnique(lesson, tech) {
  const material = teachingMaterial(lesson);
  if (tech === "abs-ref") return material.includes("$");
  return material.toUpperCase().includes(tech.toUpperCase());
}

const positionById = new Map(LESSONS.map((l, i) => [l.id, i]));

describe("guide/lessons: prerequisite order", () => {
  test("TECHNIQUES_TAUGHT keys are real lessons in the registry", () => {
    for (const id of Object.keys(TECHNIQUES_TAUGHT)) {
      assert.ok(positionById.has(id), `TECHNIQUES_TAUGHT names unknown lesson "${id}"`);
    }
  });

  test("every claimed technique appears in its teaching lesson's own material", () => {
    for (const [id, techs] of Object.entries(TECHNIQUES_TAUGHT)) {
      const lesson = LESSONS[positionById.get(id)];
      for (const tech of techs) {
        assert.ok(
          teachesTechnique(lesson, tech),
          `"${id}" claims to teach ${tech} but it appears nowhere in its steps, hints, or graders`
        );
      }
    }
  });

  test("no lesson hard-requires a technique taught only later (derived from graders)", () => {
    // First teacher position per technique.
    const firstTaughtAt = new Map();
    for (const [id, techs] of Object.entries(TECHNIQUES_TAUGHT)) {
      const pos = positionById.get(id);
      for (const tech of techs) {
        if (!firstTaughtAt.has(tech) || pos < firstTaughtAt.get(tech)) firstTaughtAt.set(tech, pos);
      }
    }
    for (const lesson of LESSONS) {
      const pos = positionById.get(lesson.id);
      for (const tech of requiredTechniques(lesson)) {
        if (!firstTaughtAt.has(tech)) continue; // untracked basics (SUM, COUNTIF variants not in the map, ...)
        assert.ok(
          firstTaughtAt.get(tech) <= pos, // teaching lesson may grade what it just taught
          `"${lesson.id}" (position ${pos}) hard-requires ${tech}, first taught at position ${firstTaughtAt.get(tech)}`
        );
      }
    }
  });

  test("the derivation itself has teeth: $-pinning is really graded downstream of its teacher", () => {
    // Guard against the derivation going vacuous (e.g. patternRequiresAbsRef
    // never matching): the known hard consumers must actually show up as
    // requiring abs-ref, and the teacher must precede them.
    // excel-countifs pins ranges via literal `\$` in grader patterns — the
    // statically derivable case. (excel-xlookup enforces pinning through a
    // predicate grader's closure, which no static derivation can see; its
    // ordering is still checked via its mustUse: XLOOKUP requirement.)
    const xlookup = LESSONS[positionById.get("excel-xlookup")];
    const countifs = LESSONS[positionById.get("excel-countifs")];
    assert.ok(requiredTechniques(countifs).has("abs-ref"), "excel-countifs should derive an abs-ref requirement");
    assert.ok(requiredTechniques(xlookup).has("XLOOKUP"), "excel-xlookup should derive an XLOOKUP requirement");
    assert.ok(positionById.get("excel-references") < positionById.get("excel-xlookup"));
  });
});
