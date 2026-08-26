// Guided-tutorial metadata for the 8 Tableau/viz lessons: mode, voice,
// step.target (region anchors into the SHARED DOM CONTRACT), and
// spotlightLabel (STOP-SLOP short objective strings).

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { createLesson } from "../lib/guide/spec.js";

import { lesson as barsLesson } from "../lib/guide/lessons/tableau-bars.js";
import { lesson as dimensionsLesson } from "../lib/guide/lessons/tableau-dimensions.js";
import { lesson as pillsLesson } from "../lib/guide/lessons/tableau-pills.js";
import { lesson as filtersLesson } from "../lib/guide/lessons/tableau-filters.js";
import { lesson as colorLesson } from "../lib/guide/lessons/tableau-color.js";
import { lesson as showmeLesson } from "../lib/guide/lessons/tableau-showme.js";
import { lesson as dashboardLesson } from "../lib/guide/lessons/tableau-dashboard.js";
import { lesson as calcLesson } from "../lib/guide/lessons/tableau-calc.js";

const LESSONS = [
  ["tableau-bars", barsLesson],
  ["tableau-dimensions", dimensionsLesson],
  ["tableau-pills", pillsLesson],
  ["tableau-filters", filtersLesson],
  ["tableau-color", colorLesson],
  ["tableau-showme", showmeLesson],
  ["tableau-dashboard", dashboardLesson],
  ["tableau-calc", calcLesson],
];

const ALLOWED_ANCHORS = [
  "viz-columns",
  "viz-rows",
  "viz-marks-color",
  "viz-marks-size",
  "viz-filters",
  "viz-showme",
  "viz-fieldlist",
];

describe("guided tableau lessons: mode + voice", () => {
  for (const [name, lesson] of LESSONS) {
    test(`${name} is guided with voice enabled`, () => {
      assert.equal(lesson.mode, "guided");
      assert.equal(lesson.voice, true);
    });
  }
});

describe("guided tableau lessons: step targets", () => {
  for (const [name, lesson] of LESSONS) {
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
  for (const [name, lesson] of LESSONS) {
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
  for (const [name, lesson] of LESSONS) {
    test(`${name} passes createLesson without throwing`, () => {
      assert.doesNotThrow(() => createLesson(lesson));
    });
  }
});
