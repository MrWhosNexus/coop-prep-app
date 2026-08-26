// test/companion-validators.test.js
//
// Pure unit tests for the companion IPC validators (no Electron). The renderer
// is untrusted, so hermes:run / hermes:cancel / hub:save each reject malformed
// input at the boundary — hermes:run especially, since its prompt reaches
// `hermes -z <prompt>` (a real shell). These complement the handler-level
// integration tests in electron-shell.test.js by pinning the pure shapes.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  validateHermesRun,
  validateHermesCancel,
  validateHubSave,
  ValidationError,
} from "../electron/ipc/validators.js";

describe("validateHermesRun", () => {
  test("accepts a non-empty prompt + requestId", () => {
    assert.deepEqual(validateHermesRun({ prompt: "hi", requestId: "r1" }), {
      prompt: "hi",
      requestId: "r1",
    });
  });

  test("rejects an empty or missing prompt (nothing empty reaches the shell)", () => {
    assert.throws(() => validateHermesRun({ prompt: "", requestId: "r" }), ValidationError);
    assert.throws(() => validateHermesRun({ requestId: "r" }), ValidationError);
  });

  test("rejects an over-long prompt", () => {
    assert.throws(
      () => validateHermesRun({ prompt: "x".repeat(8001), requestId: "r" }),
      ValidationError,
    );
  });

  test("requires a requestId", () => {
    assert.throws(() => validateHermesRun({ prompt: "hi" }), ValidationError);
  });
});

describe("validateHermesCancel", () => {
  test("requires a requestId (there is no abort-all)", () => {
    assert.deepEqual(validateHermesCancel({ requestId: "r1" }), { requestId: "r1" });
    assert.throws(() => validateHermesCancel({}), ValidationError);
  });
});

describe("validateHubSave", () => {
  test("accepts a well-formed item array", () => {
    const items = [
      { id: "1", at: "10:00", artifact: { kind: "text", title: "T", content: "c" } },
    ];
    assert.deepEqual(validateHubSave({ items }), { items });
  });

  test("carries an optional boolean fullscreen through", () => {
    const items = [
      { id: "1", at: "10:00", artifact: { kind: "text", title: "T", content: "c", fullscreen: true } },
    ];
    assert.equal(validateHubSave({ items }).items[0].artifact.fullscreen, true);
  });

  test("rejects a malformed item (non-string id)", () => {
    assert.throws(() => validateHubSave({ items: [{ id: 1 }] }), ValidationError);
  });

  test("rejects a non-array items field", () => {
    assert.throws(() => validateHubSave({ items: "nope" }), ValidationError);
  });

  test("rejects an artifact missing its content string", () => {
    const items = [{ id: "1", at: "10:00", artifact: { kind: "text", title: "T" } }];
    assert.throws(() => validateHubSave({ items }), ValidationError);
  });
});
