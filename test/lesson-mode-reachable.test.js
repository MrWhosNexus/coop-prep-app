// Reachability tests for the two "authored, tested, and never invoked"
// defects the adversarial review confirmed (2026-08-26):
//
//   A. Outcome mode: 34 lessons declared modes:["outcome"] and 129 steps
//      carried outcome overrides, but the only runner call site
//      (Dashboard.js GUIDE.createRunner(lesson)) never passed a mode, so no
//      learner could ever see any of it. The fix is a pre-session mode
//      chooser inside GuidedLessonView.
//   B. Three governance labs told the learner to click a "Load CSV" toolbar
//      button that does not exist (SheetTool offers only "Load HMDA sample"
//      and "Import CSV…", which always creates a NEW sheet at A1). The fix
//      pre-loads the data in the step-0 checkpoints and rewrites the text.
//
// These tests deliberately drive the REAL component / real lesson registry,
// not stubs: this project has shipped "built but unreachable" repeatedly,
// and a unit test of the chooser or of the lesson data alone would have
// passed against the broken code. Every assertion here is about what a
// learner actually reaches.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
import { render } from "./helpers/render.mjs";
import { createElement as h } from "react";
import { createLesson, lessonModes, resolveLessonMode } from "../lib/guide/spec.js";
import { GuidedLessonView } from "../components/Dashboard.js";
import { LESSONS, LESSONS_BY_ID } from "../lib/guide/lessons/index.js";
import { GUIDE_RESOURCES } from "../data/guide-resources.js";
import { materializeCheckpoint } from "../lib/guide/checkpoints.js";
import { getValue } from "../lib/sheet/model.js";
import { lesson as govProfiling } from "../lib/guide/lessons/gov-profiling.js";
import { lesson as govDuplicates } from "../lib/guide/lessons/gov-duplicates.js";
import { lesson as govReconcile } from "../lib/guide/lessons/gov-reconcile.js";

/* ══════════════════════════════════════════════════════════════════════════
   DEFECT A — outcome mode is reachable through the real UI
   ══════════════════════════════════════════════════════════════════════════ */

// The real registry lesson the test drives. gov-profiling is one of the 34
// multi-mode lessons; if it ever stops declaring "outcome" this test should
// fail loudly rather than silently testing nothing.
const MULTI_MODE_ID = "gov-profiling";

test("the registry still has a multi-mode lesson for these tests to drive", () => {
  const lesson = LESSONS_BY_ID[MULTI_MODE_ID];
  assert.ok(lesson, `${MULTI_MODE_ID} exists in LESSONS_BY_ID`);
  assert.deepEqual(lessonModes(lesson).includes("outcome"), true, "declares the outcome mode");
});

test("multi-mode lesson: GuidedLessonView parks on the mode chooser, in plain language", async () => {
  const ui = await render(
    h(GuidedLessonView, { guidedId: MULTI_MODE_ID, onExit() {}, onRecordComplete() {} })
  );
  await ui.flush();

  assert.ok(ui.find('[data-testid="mode-chooser"]'), "the pre-session mode chooser is shown");
  // The labels must describe the difference, not the jargon: no learner knows
  // what "outcome" means, so the raw mode names must not be the labels.
  const text = ui.text();
  assert.match(text, /Walk me through it/, "guided option in plain language");
  assert.match(text, /Just give me the problem/, "outcome option in plain language");
  // No session yet: the workspace must not have mounted before the choice,
  // because the runner is constructed once and switching later would orphan it.
  assert.equal(ui.find('[data-guide-target="sheet-grid"]'), null, "no workspace before the choice");
  await ui.unmount();
});

test("REACHABILITY: choosing the outcome option serves the OUTCOME step text, not the scaffolded text", async () => {
  const base = LESSONS_BY_ID[MULTI_MODE_ID];
  // Derive both variants' texts from the lesson itself so this test tracks
  // future rewording instead of pinning prose.
  const outcome = resolveLessonMode(base, "outcome");
  // Step 0 auto-passes (its checkpoint satisfies its grader by design), so the
  // learner may already be on step 1 by the time we read the panel. Accept
  // either step's OUTCOME instruction — and reject BOTH steps' guided ones.
  const outcomeTexts = [outcome.steps[0].instruction, outcome.steps[1].instruction];
  const guidedTexts = [base.steps[0].instruction, base.steps[1].instruction];
  for (let i = 0; i < 2; i++) {
    assert.notEqual(outcomeTexts[i], guidedTexts[i], `step ${i} actually differs across modes`);
  }

  const ui = await render(
    h(GuidedLessonView, { guidedId: MULTI_MODE_ID, onExit() {}, onRecordComplete() {} })
  );
  await ui.flush();
  await ui.click('[data-testid="mode-choice-outcome"]');
  await ui.flush();

  const text = ui.text();
  assert.ok(ui.find('[data-guide-target="sheet-grid"]'), "the real workspace mounted after the choice");
  assert.ok(
    outcomeTexts.some((t) => text.includes(t)),
    "the served step instruction is the OUTCOME variant"
  );
  for (const t of guidedTexts) {
    assert.ok(!text.includes(t), "the scaffolded (guided) instruction is NOT served");
  }
  await ui.unmount();
});

test("choosing the guided option serves the scaffolded text (the chooser did not break the default)", async () => {
  const base = LESSONS_BY_ID[MULTI_MODE_ID];
  const guidedTexts = [base.steps[0].instruction, base.steps[1].instruction];
  const ui = await render(
    h(GuidedLessonView, { guidedId: MULTI_MODE_ID, onExit() {}, onRecordComplete() {} })
  );
  await ui.flush();
  await ui.click('[data-testid="mode-choice-guided"]');
  await ui.flush();
  const text = ui.text();
  assert.ok(guidedTexts.some((t) => text.includes(t)), "guided instruction is served");
  await ui.unmount();
});

test("REACHABILITY: the runner GRADES in the chosen mode, not just the text", async () => {
  // Text alone can lie: a bug that resolves the displayed lesson but builds
  // the runner without {mode} shows outcome prose while grading the guided
  // rubric. This lesson's step is built so the seeded state passes ONLY the
  // outcome grader — completion is therefore proof the session itself is in
  // outcome mode.
  const lesson = createLesson({
    id: "mode-test-grading",
    tool: "sheet",
    title: "Grading-mode probe",
    mode: "guided",
    modes: ["outcome"],
    voice: false,
    steps: [
      {
        id: "probe",
        title: "Probe step",
        instruction: "Guided says: put 1 into B2.",
        target: { kind: "selector", selector: "[data-guide-target='sheet-grid']" },
        spotlightLabel: "Probe",
        checkpoint: { tool: "sheet", active: "Work", sheets: [{ name: "Work", cells: { B2: 42 } }] },
        grader: { type: "cellValue", ref: "B2", expected: 1, sheet: "Work" },
        modes: {
          outcome: {
            instruction: "Outcome says: land 42 in B2.",
            grader: { type: "cellValue", ref: "B2", expected: 42, sheet: "Work" },
          },
        },
      },
    ],
  });
  const ui = await render(
    h(GuidedLessonView, { guidedId: lesson.id, lesson, onExit() {}, onRecordComplete() {} })
  );
  await ui.flush();
  await ui.click('[data-testid="mode-choice-outcome"]');
  await ui.flush();
  // The seed satisfies the outcome grader, so the step auto-clears iff the
  // runner is actually grading the outcome variant. Under the guided grader
  // (B2 must be 1) the step stays parked and neither string appears.
  assert.match(ui.text(), /shows 42 — correct/, "the OUTCOME grader judged the work");
  assert.match(ui.text(), /All 1 steps cleared/, "the step auto-cleared under the outcome rubric");
  await ui.unmount();
});

test("single-mode lesson: no dead chooser — the workspace mounts immediately", async () => {
  const lesson = createLesson({
    id: "mode-test-single",
    tool: "sheet",
    title: "Single-mode lesson",
    mode: "guided",
    voice: false,
    steps: [
      {
        id: "only",
        title: "Only step",
        instruction: "Put 7 into B2.",
        target: { kind: "selector", selector: "[data-guide-target='sheet-grid']" },
        spotlightLabel: "Type 7 into B2",
        checkpoint: { tool: "sheet", active: "Work", sheets: [{ name: "Work" }] },
        grader: { type: "cellValue", ref: "B2", expected: 7, sheet: "Work" },
      },
    ],
  });
  const ui = await render(
    h(GuidedLessonView, { guidedId: lesson.id, lesson, onExit() {}, onRecordComplete() {} })
  );
  await ui.flush();
  assert.equal(ui.find('[data-testid="mode-chooser"]'), null, "no chooser for a single-mode lesson");
  assert.ok(ui.find('[data-guide-target="sheet-grid"]'), "workspace mounts straight away");
  await ui.unmount();
});

/* ══════════════════════════════════════════════════════════════════════════
   DEFECT B — no lab references the phantom "Load CSV" control, and the data
   the steps depend on is genuinely there
   ══════════════════════════════════════════════════════════════════════════ */

const GOV_LABS = [govProfiling, govDuplicates, govReconcile];

/** Every learner-visible string of a lesson, across every declared mode. */
function allServedTexts(lesson) {
  const out = [];
  for (const mode of lessonModes(lesson)) {
    const served = resolveLessonMode(lesson, mode);
    for (const step of served.steps) {
      out.push({ where: `${lesson.id}/${step.id} [${mode}] instruction`, text: step.instruction ?? "" });
      (step.hints ?? []).forEach((hint, i) => {
        const t = typeof hint === "string" ? hint : hint?.text ?? "";
        out.push({ where: `${lesson.id}/${step.id} [${mode}] hint ${i}`, text: t });
      });
      out.push({ where: `${lesson.id}/${step.id} [${mode}] spotlight`, text: step.spotlightLabel ?? "" });
    }
  }
  return out;
}

test("no governance-lab text references the nonexistent Load CSV control, in any mode", () => {
  // The toolbar's real controls are "Load HMDA sample" and "Import CSV…".
  // "Load CSV" was the phantom; forbid it (and near-variants) mechanically so
  // a future lesson edit cannot quietly reintroduce it.
  const phantom = /load\s+csv|load\s*\/data\/|csv\s+button/i;
  for (const lesson of GOV_LABS) {
    for (const { where, text } of allServedTexts(lesson)) {
      assert.ok(!phantom.test(text), `${where} references a control that does not exist: "${text}"`);
    }
  }
});

test("the three labs' step-0 checkpoints materialize with the raw extract actually loaded", () => {
  for (const lesson of GOV_LABS) {
    const state = materializeCheckpoint(lesson.steps[0].checkpoint, GUIDE_RESOURCES);
    const sheet = state.sheets[state.active];
    assert.equal(getValue(sheet, "A1"), "applicant_id", `${lesson.id}: raw headers at A1`);
    assert.equal(getValue(sheet, "A105"), "A0072", `${lesson.id}: all 104 raw rows present`);
  }
  // gov-reconcile's whole premise is both extracts in ONE sheet — a layout
  // with no UI path (the importer always creates a new sheet at A1), so the
  // checkpoint is the only way it can exist. Pin it.
  const rec = materializeCheckpoint(govReconcile.steps[0].checkpoint, GUIDE_RESOURCES);
  const sheet = rec.sheets[rec.active];
  assert.equal(getValue(sheet, "K1"), "applicant_id", "servicing headers at K1, same sheet");
  assert.equal(getValue(sheet, "K100"), "B903", "all 99 servicing rows present");
});

describe("no lesson names a UI control that does not exist", () => {
  // Widened from the three governance labs to EVERY lesson, after the same
  // defect turned up in excel-pivot.js: its instruction said "a Load CSV
  // button" while the toolbar's button is labelled "Load HMDA sample". A
  // learner who reads the instruction literally hunts for a control that is
  // not there and concludes the app is broken.
  //
  // Derived from the toolbar SOURCE rather than a hand-kept list, so renaming
  // a button turns this red instead of silently invalidating every lesson that
  // mentions it.

  const sheetTool = readFileSync(join(ROOT, "components/tools/SheetTool.js"), "utf8");

  /** The button labels the sheet toolbar actually renders. */
  const toolbarLabels = () =>
    [...sheetTool.matchAll(/className="sheet-btn"[^>]*>([^<]+)</g)].map((m) => m[1].trim());

  /** Every learner-visible string in a lesson, across all of its modes. */
  function visibleText(lesson) {
    const out = [];
    for (const mode of [lesson.mode ?? "guided", ...(lesson.modes ?? [])]) {
      let resolved;
      try {
        resolved = resolveLessonMode(lesson, mode);
      } catch {
        continue;
      }
      for (const step of resolved.steps ?? []) {
        out.push(step.instruction ?? "", step.spotlightLabel ?? "", ...(step.hints ?? []));
      }
    }
    return out.filter(Boolean);
  }

  test("the toolbar exposes the controls the lessons rely on", () => {
    const labels = toolbarLabels();
    assert.ok(labels.length >= 2, `parsed ${labels.length} toolbar buttons — this test's parse is stale`);
    assert.ok(
      labels.some((l) => /load/i.test(l)),
      `no load control found among: ${labels.join(", ")}`,
    );
  });

  test("no lesson tells the learner to press a 'Load CSV' button", () => {
    // The specific phantom. The toolbar has "Load HMDA sample" and
    // "Import CSV…"; it has never had a "Load CSV" button, and it has no
    // origin control at all (`grep -c origin SheetTool.js` is 0), which is why
    // the reconciliation lab's two-extracts-at-A1-and-K1 layout has to be
    // pre-loaded in its checkpoint rather than imported by hand.
    const PHANTOM = /\bload\s+csv\b|\bload\s*\/data\/|csv\s+button/i;
    const offenders = [];
    for (const lesson of LESSONS) {
      for (const text of visibleText(lesson)) {
        if (PHANTOM.test(text)) offenders.push(`${lesson.id}: "${text.slice(0, 80)}"`);
      }
    }
    assert.deepEqual(offenders, [], "these lessons name a control the sheet toolbar does not have");
  });

  test("the sweep has teeth: it reads a non-empty corpus", () => {
    const total = LESSONS.reduce((n, l) => n + visibleText(l).length, 0);
    assert.ok(LESSONS.length >= 30, `only ${LESSONS.length} lessons in the registry`);
    assert.ok(total >= 400, `only ${total} learner-visible strings swept`);
  });
});
