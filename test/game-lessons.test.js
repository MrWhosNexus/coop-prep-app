// The game-lesson registry: every entry has the required fields and a valid
// game kind, and getGameLesson round-trips against GAME_LESSONS. This module
// loads fine even though game-lessons-content.js may not exist yet -- that is
// the defensive-import contract under test here too.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { GAME_LESSONS, GAME_KINDS, getGameLesson } from "../lib/guide/game-lessons.js";

describe("GAME_LESSONS registry", () => {
  test("is a non-empty array", () => {
    assert.ok(Array.isArray(GAME_LESSONS));
    assert.ok(GAME_LESSONS.length > 0);
  });

  test("every entry has the required fields and a valid game kind", () => {
    for (const entry of GAME_LESSONS) {
      assert.equal(typeof entry.id, "string");
      assert.ok(entry.id.length > 0);
      assert.ok(GAME_KINDS.includes(entry.game), `unknown game kind: ${entry.game}`);
      assert.equal(typeof entry.moduleId, "string");
      assert.ok(entry.moduleId.length > 0);
      assert.equal(typeof entry.title, "string");
      assert.ok(entry.title.length > 0);
      assert.equal(typeof entry.objective, "string");
      assert.ok(entry.objective.length > 0);
      assert.equal(typeof entry.config, "object");
      assert.ok(entry.config !== null);
    }
  });

  test("ids are unique", () => {
    const ids = GAME_LESSONS.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe("getGameLesson", () => {
  test("round-trips every entry in the registry", () => {
    for (const entry of GAME_LESSONS) {
      assert.deepEqual(getGameLesson(entry.id), entry);
    }
  });

  test("returns undefined for an unknown id", () => {
    assert.equal(getGameLesson("does-not-exist"), undefined);
  });
});
