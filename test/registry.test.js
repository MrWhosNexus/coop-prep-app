import { test } from "node:test";
import assert from "node:assert/strict";
import { PILLARS } from "../data/pillars.js";
import { REGISTRY, getByPillar, ALL_MODULES, findModule } from "../data/registry.js";
import { MODULES } from "../data/curriculum.js";
import { HEART_MODULES } from "../data/heart.js";
import { HUSTLE_MODULES } from "../data/hustle.js";
import { SIE_MODULES } from "../data/certs/sie.js";
import { SERIES65_MODULES } from "../data/certs/series65.js";
import { CFI_MODULES } from "../data/certs/cfi.js";

test("PILLARS are head, heart, hustle, licensing with Lucide (non-emoji) icons", () => {
  assert.deepEqual(PILLARS.map((p) => p.id), ["head", "heart", "hustle", "licensing"]);
  for (const p of PILLARS) assert.match(p.icon, /^[a-z]+$/); // lucide name, not emoji
});

test("every curriculum module is in REGISTRY under head, in order, before the tools", () => {
  const head = getByPillar("head").filter((x) => x.kind === "module");
  assert.equal(head.length, MODULES.length);
  assert.deepEqual(head.map((x) => x.id), MODULES.map((m) => m.id));
  assert.ok(head.every((x) => x.pillarId === "head"));
});

test("head pillar tools follow the modules and include the phase-2 tools", () => {
  const head = getByPillar("head");
  const kinds = head.map((x) => x.kind);
  // numeric sort by order: all modules first, then all tools
  assert.equal(kinds.lastIndexOf("module") < kinds.indexOf("tool"), true);
  const toolIds = head.filter((x) => x.kind === "tool").map((x) => x.id);
  for (const id of ["sheet", "viz", "games", "notes", "lessonBuilder"]) {
    assert.ok(toolIds.includes(id), `head tools include ${id}`);
  }
});

test("hustle pillar contains its modules then the cover letter tool and the job-search suite", () => {
  const hustle = getByPillar("hustle");
  const mods = hustle.filter((x) => x.kind === "module");
  assert.deepEqual(mods.map((x) => x.id), HUSTLE_MODULES.map((m) => m.id));
  const tools = hustle.filter((x) => x.kind === "tool");
  // Phase 3 added the six hustle tools after the cover letter (orders 101+).
  assert.deepEqual(tools.map((x) => x.id), [
    "coverLetter",
    "resumeBuilder", "starStoryBank", "applicationTracker",
    "mockInterview", "networkTracker", "salaryNegotiationPrep",
  ]);
});

test("heart pillar carries the heart modules", () => {
  const heart = getByPillar("heart");
  assert.deepEqual(heart.map((x) => x.id), HEART_MODULES.map((m) => m.id));
  assert.ok(heart.every((x) => x.kind === "module"));
});

test("licensing pillar carries SIE, then Series 65, then CFI modules in order", () => {
  const lic = getByPillar("licensing");
  const mods = lic.filter((x) => x.kind === "module");
  const expected = [...SIE_MODULES, ...SERIES65_MODULES, ...CFI_MODULES].map((m) => m.id);
  assert.deepEqual(mods.map((x) => x.id), expected);
  // Phase 3: the exam simulator + CFI drill surfaces follow the modules.
  assert.deepEqual(lic.filter((x) => x.kind === "tool").map((x) => x.id), ["examSim", "cfiDrills"]);
});

test("getByPillar sorts numerically by order (not lexicographically)", () => {
  for (const p of PILLARS) {
    const orders = getByPillar(p.id).map((x) => x.order);
    const sorted = [...orders].sort((a, b) => a - b);
    assert.deepEqual(orders, sorted);
  }
});

test("getByPillar returns [] for an unknown pillar id", () => {
  assert.deepEqual(getByPillar("nope"), []);
});

test("every REGISTRY entry has a pillarId that exists in PILLARS", () => {
  const ids = new Set(PILLARS.map((p) => p.id));
  assert.ok(REGISTRY.every((x) => ids.has(x.pillarId)));
});

test("every module REGISTRY entry resolves through findModule/ALL_MODULES", () => {
  const moduleEntries = REGISTRY.filter((x) => x.kind === "module");
  for (const entry of moduleEntries) {
    const mod = findModule(entry.id);
    assert.ok(mod, `module ${entry.id} resolves`);
    assert.equal(mod.title, entry.label);
    assert.ok(Array.isArray(mod.lessons) && mod.lessons.length > 0);
  }
  // no id collisions across tracks
  const ids = ALL_MODULES.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("no REGISTRY id appears twice", () => {
  const ids = REGISTRY.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
});
