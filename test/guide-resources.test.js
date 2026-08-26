// test/guide-resources.test.js
//
// A guided lesson names its datasets by resource key. The HOST supplies them:
// components/Dashboard.js builds GUIDE_RESOURCES, mapping each key to a CSV
// bundled as a JS string (fetch() is unavailable on file:// URLs, which is how
// the packaged Electron build loads the app).
//
// Nothing connected those two sides. A lesson could declare
// `resources: ["hmda-raw.csv"]`, pass every one of its own tests, be registered
// in the LESSONS array, appear in the UI — and throw the moment a learner
// opened it, because the host map had no such key. That is exactly what
// happened when the six governance labs landed: 45 + 22 lesson tests green, and
// all six dead on arrival.
//
// This is the project's recurring defect, in a new place: a unit that works and
// nothing that proves anything supplies it. Same shape as the dead
// capacitorBridge, the routes absent from FOCUS_COMPONENTS, and the Swift
// plugins that compiled but were never registered. The fix is the same one:
// assert the CALL SITE, not the unit.
//
// The map now lives in data/guide-resources.js and is imported by the host and
// by every test that needs it, so this file imports it too. An earlier version
// parsed the literal out of Dashboard.js with a regex; that broke the moment the
// map was extracted into its own module — a test coupled to where code LIVES
// rather than to what it DOES.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GUIDE_RESOURCES } from "../data/guide-resources.js";

import { LESSONS } from "../lib/guide/lessons/index.js";
import { materializeCheckpoint } from "../lib/guide/checkpoints.js";

/* Any well-formed CSV: this test asks whether the KEY is supplied, not whether
   the contents are right. test/governance-data.test.js owns the contents. */
const SAMPLE_CSV = "a,b,c\n1,2,3\n4,5,6\n";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dashboard = fs.readFileSync(path.join(ROOT, "components/Dashboard.js"), "utf8");

/** The keys the shipped map supplies. */
const hostSuppliedKeys = () => new Set(Object.keys(GUIDE_RESOURCES));

/** Every resource key every registered lesson declares. */
function lessonRequiredKeys() {
  const keys = new Map();
  for (const lesson of LESSONS) {
    for (const r of lesson.resources ?? []) {
      const key = typeof r === "string" ? r : r?.key ?? r?.name;
      if (!key) continue;
      if (!keys.has(key)) keys.set(key, []);
      keys.get(key).push(lesson.id);
    }
  }
  return keys;
}

describe("every lesson's datasets are actually supplied by the host", () => {
  test("every registered lesson can actually materialize with what the host supplies", () => {
    // Behavioural, not declarative. An earlier version of this test compared
    // declared `resources` keys against GUIDE_RESOURCES keys and failed on
    // excel-textjoin and excel-dates — both of which declare a CSV they never
    // load, so both materialize perfectly well with no resources at all. That
    // is untidy, not broken, and failing the build over it would have been a
    // false alarm.
    //
    // What actually matters is whether materializeCheckpoint THROWS. It does,
    // by design, when a checkpoint loads a key the host did not supply — which
    // is the real "registered but unopenable" condition. So drive it.
    const supplied = Object.fromEntries([...hostSuppliedKeys()].map((k) => [k, SAMPLE_CSV]));
    const broken = [];
    for (const lesson of LESSONS) {
      for (const step of lesson.steps ?? []) {
        try {
          materializeCheckpoint(step.checkpoint, supplied);
        } catch (e) {
          if (/missing resource/i.test(String(e.message))) {
            broken.push(`${lesson.id}/${step.id}: ${String(e.message).replace(/\s+/g, " ").slice(0, 90)}`);
          }
        }
      }
    }
    assert.deepEqual(broken, [], "these lessons are registered and unopenable — the host supplies no CSV for a key their checkpoints load");
  });

  test("every supplied resource is real, non-empty CSV text", () => {
    // A key present but mapped to undefined or "" passes the check above and
    // still breaks the lesson at load time.
    for (const [key, text] of Object.entries(GUIDE_RESOURCES)) {
      assert.equal(typeof text, "string", `${key} maps to ${typeof text}, not CSV text`);
      assert.ok(text.length > 200, `${key} is ${text.length} chars — looks empty or truncated`);
      assert.ok(text.includes("\n") && text.includes(","), `${key} does not look like CSV`);
    }
  });

  test("the host actually uses the shipped map rather than a private copy", () => {
    // The failure this whole file exists to prevent is a second, staler copy of
    // the resource map. Assert the host imports the shared one and does not
    // declare its own.
    assert.match(dashboard, /import \{ GUIDE_RESOURCES \} from "@\/data\/guide-resources"/,
      "Dashboard.js must import the shared resource map");
    assert.ok(!/const GUIDE_RESOURCES\s*=/.test(dashboard),
      "Dashboard.js declares its own GUIDE_RESOURCES again — that is the duplicate this module removed");
  });

  test("the check has teeth: it is looking at a non-empty set on both sides", () => {
    const supplied = hostSuppliedKeys();
    const required = lessonRequiredKeys();
    assert.ok(supplied.size >= 3, `GUIDE_RESOURCES supplies ${supplied.size} keys, expected at least 3`);
    assert.ok(required.size >= 3, `lessons declare ${required.size} distinct resource keys, expected at least 3`);
    assert.ok(
      [...required.keys()].some((k) => k.includes("raw")),
      "expected the governance labs' dirty extract among the required keys — if this fails, the labs are not registered",
    );
  });
});
