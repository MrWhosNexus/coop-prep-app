// Integration tests for the guided-tutorial wiring Opus owns in Dashboard.js:
// the real SheetTool/VizTool driving guided lessons, the spotlight overlay,
// auto-advance, instructions mode, the Nexus voice mount, and the games
// guided contract.
//
// Harness limits (test/helpers/render.mjs): no layout. A sheet-cell spotlight
// target resolves through geometry and so returns null here by design; a
// SELECTOR/region target resolves through querySelector and renders with a
// zero rect, so those are what we assert the callout against.

import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "./helpers/render.mjs";
import { createElement as h, act } from "react";
import { createLesson } from "../lib/guide/spec.js";
import { GuidedLessonView, gameObjective } from "../components/Dashboard.js";
import GameHost from "../components/games/GameHost.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A guided sheet lesson that does NOT auto-pass (empty cell), so it parks on
 *  step 0. Its step points the spotlight at the grid via a selector. */
function pendingSheetLesson(mode = "guided") {
  return createLesson({
    id: `opus-pending-${mode}`,
    tool: "sheet",
    title: "Opus pending sheet lesson",
    mode,
    voice: false,
    steps: [
      {
        id: "enter",
        title: "Enter the total",
        instruction: "Put 42 into B2.",
        target: { kind: "selector", selector: "[data-guide-target='sheet-grid']" },
        spotlightLabel: "Type 42 into cell B2",
        checkpoint: { tool: "sheet", active: "Work", sheets: [{ name: "Work" }] },
        grader: { type: "cellValue", ref: "B2", expected: 42, sheet: "Work" },
      },
    ],
  });
}

/** A one-step guided sheet lesson whose checkpoint ALREADY satisfies the
 *  grader, so mounting it drives the whole auto-advance path to completion
 *  through the onStateChange/grade seam (no geometry). */
function solvedSheetLesson() {
  return createLesson({
    id: "opus-solved",
    tool: "sheet",
    title: "Opus solved sheet lesson",
    mode: "guided",
    voice: false,
    steps: [
      {
        id: "already",
        title: "Already right",
        instruction: "B2 already holds 42.",
        target: { kind: "selector", selector: "[data-guide-target='sheet-grid']" },
        spotlightLabel: "B2 holds 42",
        checkpoint: { tool: "sheet", active: "Work", sheets: [{ name: "Work", cells: { B2: 42 } }] },
        grader: { type: "cellValue", ref: "B2", expected: 42, sheet: "Work" },
      },
    ],
  });
}

test("guided sheet lesson drives the REAL grid, shows its spotlight label, hides the Check button", async () => {
  const lesson = pendingSheetLesson("guided");
  const ui = await render(
    h(GuidedLessonView, { guidedId: lesson.id, lesson, onExit() {}, onRecordComplete() {} })
  );
  await ui.flush();

  // The real virtualized grid mounted with the shared DOM anchor.
  assert.ok(ui.find('[data-guide-target="sheet-grid"]'), "sheet-grid anchor is present");
  assert.ok(ui.find('[role="grid"]'), "the real Grid rendered (role=grid)");

  // The spotlight callout points at the grid and names the step objective.
  const callout = ui.find('[data-testid="spotlight-callout"]');
  assert.ok(callout, "spotlight callout is mounted for a selector target");
  assert.match(ui.text(), /Type 42 into cell B2/, "callout shows the spotlightLabel");

  // Guided mode drives grading itself: no manual Check button.
  const buttons = ui.findAll("button").map((b) => b.textContent);
  assert.ok(!buttons.some((t) => /Check my work/.test(t)), "no manual Check button in guided mode");

  await ui.unmount();
});

test("editing a cell to the target value auto-advances and completes the lesson", async () => {
  const lesson = solvedSheetLesson();
  let recorded = null;
  const ui = await render(
    h(GuidedLessonView, {
      guidedId: lesson.id,
      lesson,
      onExit() {},
      onRecordComplete(id, score) { recorded = { id, score }; },
    })
  );
  // Auto-check passes on mount; auto-advance fires next() after its ~850ms beat.
  await ui.flush();
  await act(async () => { await sleep(1200); });

  assert.ok(recorded, "onRecordComplete fired via the auto-advance path");
  assert.equal(recorded.id, "opus-solved");
  assert.ok(recorded.score > 0, "a real score came back from the runner");

  await ui.unmount();
});

test("instructions-mode lesson keeps the manual Check button and mounts NO spotlight", async () => {
  const lesson = pendingSheetLesson("instructions");
  const ui = await render(
    h(GuidedLessonView, { guidedId: lesson.id, lesson, onExit() {}, onRecordComplete() {} })
  );
  await ui.flush();

  const buttons = ui.findAll("button").map((b) => b.textContent);
  assert.ok(buttons.some((t) => /Check my work/.test(t)), "manual Check button present in instructions mode");
  assert.equal(ui.find('[data-testid="spotlight-overlay"]'), null, "no spotlight overlay in instructions mode");
  // The real grid still mounts in either mode.
  assert.ok(ui.find('[data-guide-target="sheet-grid"]'), "real grid still mounts");

  await ui.unmount();
});

test("the Nexus voice widget mounts in the Dashboard and reads the AI-off context", async () => {
  const { default: Dashboard } = await import("../components/Dashboard.js");
  const ui = await render(h(Dashboard));
  // Dashboard loads progress asynchronously; settle before asserting.
  for (let i = 0; i < 6; i++) await ui.flush();

  assert.ok(ui.find(".nexus-voice"), "NexusVoiceWidget is mounted across views");
  // aiOn is false with no endpoint bridge, so the widget shows its honest
  // degraded state rather than a live mic.
  assert.ok(ui.find('[data-testid="nexus-voice-disabled"]'), "widget reflects the AI-off context");

  await ui.unmount();
});

test("games guided mode: the objective banner and auto-advance contract hold", async () => {
  const objective = gameObjective("recall");
  assert.match(objective, /round/i, "recall objective names the round");
  assert.ok(!objective.includes("—"), "objective is em-dash free (STOP-SLOP)");

  let advanced = null;
  const ui = await render(
    h(GameHost, {
      title: "Recall Drill",
      index: 0,
      total: 3,
      events: [],
      objective,
      guided: true,
      onAdvance(ev) { advanced = ev; },
      children: h("div", null, "prompt"),
    })
  );
  assert.match(ui.text(), new RegExp(objective.slice(0, 12)), "objective banner renders in guided mode");

  // A new correct event auto-advances the round with no manual button.
  await ui.rerender(
    h(GameHost, {
      title: "Recall Drill",
      index: 1,
      total: 3,
      events: [{ correct: true, ms: 120 }],
      objective,
      guided: true,
      onAdvance(ev) { advanced = ev; },
      children: h("div", null, "prompt"),
    })
  );
  assert.ok(advanced && advanced.correct === true, "onAdvance fired for the correct answer");

  await ui.unmount();
});
