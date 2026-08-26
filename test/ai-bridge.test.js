/**
 * test/ai-bridge.test.js
 * The AI bridge, end to end, with ZERO network:
 *
 *   lib/ai/client.js#callLLM  ->  (fake window.coop)  ->  electron/ipc/handlers.js
 *     -> electron/main.js#buildIpcDeps().ai  ->  lib/endpoints/call.js  ->  (fake fetch)
 *
 * Every other AI test in this repo stubs one of those hops, which is exactly how
 * two information losses hid behind a green suite:
 *   - on SUCCESS, a provider that answers `stream: true` with a whole JSON body
 *     (common Ollama/gateway behaviour) produced ok:true with an EMPTY text,
 *     because only streamed deltas ever reached the renderer;
 *   - on FAILURE, lib/endpoints/call.js's typed error was flattened to a bare
 *     message string, making every renderer branch on error.type/error.hint dead.
 *
 * So this file drives the SHIPPED wiring and asserts on what the renderer's
 * Promise actually resolves to. The only fake below the bridge is `fetch`.
 *
 * Run: `node --test test/ai-bridge.test.js`
 */

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerHooks } from "node:module";

import { callLLM } from "../lib/ai/client.js";

// electron/main.js and electron/ipc/handlers.js `import ... from "electron"` at
// module scope, and `electron` is not installed in a headless `node --test` run.
// Same registerHooks() stub technique as test/endpoints.test.js and
// test/electron-shell.test.js — see the long note in the latter.
let userDataDir = "/tmp/coop-ai-bridge-unset";

globalThis.__coopAiBridgeUserData = () => userDataDir;

const ELECTRON_STUB = `
  export const app = {
    isPackaged: false,
    // main.js pins the app name before anything resolves userData — a file-path
    // launch otherwise puts the key store in the shared ~/.config/Electron.
    // The stub models the real API; without setName, importing main.js throws.
    setName() {},
    getName: () => "coop-prep",
    getVersion: () => "0.1.0",
    getPath: (name) => (name === "userData" ? globalThis.__coopAiBridgeUserData() : "/tmp/coop-ai-bridge-other/" + name),
    requestSingleInstanceLock: () => true,
    whenReady: () => new Promise(() => {}),
    on() {},
    quit() {},
  };
  export const dialog = {};
  export const ipcMain = { handle() {} };
  export const shell = {};
  export const session = { defaultSession: { webRequest: { onHeadersReceived() {} } } };
  export const Menu = { setApplicationMenu() {}, buildFromTemplate: (t) => t };
  export class BrowserWindow {
    static getAllWindows() {
      return [];
    }
  }
`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "electron") return { url: "stub:electron", shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "stub:electron") return { format: "module", source: ELECTRON_STUB, shortCircuit: true };
    return nextLoad(url, context);
  },
});

const { buildIpcDeps } = await import("../electron/main.js");
const { createHandlers } = await import("../electron/ipc/handlers.js");

// ─────────────────────────────────────────────────────────────────────────────
// Fake provider responses (no network, no undici)
// ─────────────────────────────────────────────────────────────────────────────

const SECRET = "sk-ant-api03-SUPERSECRETKEYVALUE";

/** A whole-JSON-body response — what a provider that ignores `stream: true` sends. */
function jsonResponse(data, { status = 200, contentType = "application/json" } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name.toLowerCase() === "content-type" ? contentType : null) },
    async json() {
      return data;
    },
    async text() {
      return JSON.stringify(data);
    },
  };
}

/** A real SSE response: `frames` are raw wire chunks, blank-line separated. */
function sseResponse(frames) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => (name.toLowerCase() === "content-type" ? "text/event-stream" : null) },
    body: {
      getReader: () => ({
        async read() {
          if (i >= frames.length) return { done: true, value: undefined };
          return { done: false, value: encoder.encode(frames[i++]) };
        },
      }),
    },
  };
}

/** One OpenAI-shaped SSE delta frame. */
const sseDelta = (content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

// ─────────────────────────────────────────────────────────────────────────────
// The bridge harness: a fake window.coop over the REAL handlers + REAL deps
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wire callLLM to createHandlers(buildIpcDeps()) through a fake contextBridge.
 *
 * @param {(url: string, opts: object) => Promise<object>} fetchFn
 * @returns {{ bridge: object, endpointId: string, streamEvents: object[] }}
 */
function makeBridge(fetchFn) {
  globalThis.fetch = fetchFn;

  const deps = buildIpcDeps();
  const added = deps.endpoints.add({ label: "Local", baseUrl: "http://localhost:11434/v1", apiKey: SECRET });
  assert.equal(added.ok, true, "the test endpoint must be addable");

  const handlers = createHandlers(deps);

  const listeners = new Set();
  const streamEvents = [];
  const evt = {
    sender: {
      isDestroyed: () => false,
      send: (channel, payload) => {
        assert.equal(channel, "ai:stream");
        streamEvents.push(payload);
        for (const cb of [...listeners]) cb(payload);
      },
    },
  };

  const bridge = {
    ai: {
      call: (request) => handlers["ai:call"](evt, request),
      onStream: (cb) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
    },
  };

  return { bridge, endpointId: added.endpoint.id, streamEvents };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("the AI bridge, renderer <-> main, end to end", () => {
  let realFetch;

  beforeEach(() => {
    realFetch = globalThis.fetch;
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "coop-ai-bridge-"));
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  test("a provider that ignores stream:true and answers with JSON still yields its text", async () => {
    const { bridge, endpointId, streamEvents } = makeBridge(async () =>
      jsonResponse({ choices: [{ message: { content: "hello world" } }] })
    );

    const result = await callLLM(
      { system: "sys", user: "rewrite this bullet", endpointId, model: "llama3" },
      bridge
    );

    assert.equal(result.ok, true, "a 200 JSON body is a success");
    assert.equal(
      result.text,
      "hello world",
      "the non-streamed body's text must reach the renderer — an empty string here is the silent failure that overwrites the user's draft"
    );
    assert.deepEqual(
      streamEvents.filter((e) => e.type === "error"),
      [],
      "no error event for a successful call"
    );
  });

  test("an SSE provider still streams deltas AND resolves the full text", async () => {
    const seen = [];
    const { bridge, endpointId, streamEvents } = makeBridge(async () =>
      sseResponse([sseDelta("Hel"), sseDelta("lo "), sseDelta("there"), "data: [DONE]\n\n"])
    );

    const result = await callLLM(
      { system: "sys", user: "say hi", endpointId, model: "llama3" },
      {
        ai: {
          call: bridge.ai.call,
          onStream: (cb) =>
            bridge.ai.onStream((e) => {
              if (e.type === "chunk") seen.push(e.delta);
              cb(e);
            }),
        },
      }
    );

    assert.equal(result.ok, true);
    assert.deepEqual(seen, ["Hel", "lo ", "there"], "streaming must keep working: deltas arrive as chunks");
    assert.equal(result.text, "Hello there");
    assert.equal(
      streamEvents.filter((e) => e.type === "done").length,
      1,
      "exactly one done event closes the stream"
    );
  });

  test("a 401 arrives at the renderer TYPED, with its hint, and carries no key", async () => {
    const { bridge, endpointId } = makeBridge(async () =>
      jsonResponse({ error: { message: `invalid key ${SECRET}` } }, { status: 401 })
    );

    const result = await callLLM({ system: "", user: "hi", endpointId, model: "llama3" }, bridge);

    assert.equal(result.ok, false);
    assert.equal(
      result.error.type,
      "AUTH_ERROR",
      "the typed error must survive the IPC hop — every renderer branch on error.type depends on it"
    );
    assert.equal(result.error.status, 401);
    assert.match(result.error.hint ?? "", /Settings/, "the actionable hint must survive too");
    assert.ok(
      !JSON.stringify(result).includes(SECRET),
      "NO key material may cross to the renderer, not even inside an error"
    );
  });

  test("an unreachable endpoint arrives typed as NETWORK_ERROR, not as a generic failure", async () => {
    const { bridge, endpointId } = makeBridge(async () => {
      throw new TypeError("fetch failed");
    });

    const result = await callLLM({ system: "", user: "hi", endpointId, model: "llama3" }, bridge);

    assert.equal(result.ok, false);
    assert.equal(result.error.type, "NETWORK_ERROR");
  });
});
