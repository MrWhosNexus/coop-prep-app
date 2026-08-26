/**
 * test/endpoints.test.js
 * Coverage for lib/endpoints/{providers,registry,store,headers,probe,call}.js
 *
 * Uses Node built-in test runner: `node --test test/endpoints.test.js`
 */

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerHooks } from "node:module";

import {
  PROVIDERS,
  CUSTOM_PROVIDER_ID,
  getProvider,
  isAnthropicShaped,
  isFirstPartyAnthropic,
  normalizeBaseUrl,
  providerIdForUrl,
} from "../lib/endpoints/providers.js";

import { createRegistry, toView, validateEndpointInput } from "../lib/endpoints/registry.js";

import {
  ENDPOINTS_DIR_ENV,
  createFileStorage,
  createMemoryStorage,
  readEndpointsDocument,
  resolveStoreDir,
} from "../lib/endpoints/store.js";

import { buildAuthHeaders, isAnthropicOAuthToken, redactKey } from "../lib/endpoints/headers.js";

import {
  candidateChatUrls,
  candidateModelsUrls,
  candidateUrls,
  discoverModels,
  hasVersionSegment,
  parseModelList,
  probeEndpoint,
  tryCandidates,
} from "../lib/endpoints/probe.js";

import {
  ANTHROPIC_MODEL_RULES,
  buildAnthropicBody,
  buildOpenAIBody,
  callEndpoint,
  extractDelta,
  extractText,
} from "../lib/endpoints/call.js";

// ─────────────────────────────────────────────────────────────────────────────
// POSIX file modes are not enforceable on Windows.
//
// `fs.chmodSync` on win32 only toggles the read-only bit, and `fs.statSync`
// synthesises 0666 (files) / 0777 (directories) for anything writable. So
// lib/endpoints/store.js's 0600/0700 hardening is a documented best-effort
// no-op there (see the note on FILE_MODE in that file), and asserting the exact
// bits made 11 tests permanently red on the platform this repo is developed on.
// A permanently red suite is a suite nobody reads, which is a worse outcome
// than an honestly-skipped assertion.
//
// These assertions are NOT deleted: they are the only guard that the key store
// is not world-readable, and they still run — and must stay green — on POSIX,
// which is where the property is actually enforceable.
// ─────────────────────────────────────────────────────────────────────────────
const POSIX_MODES = process.platform !== "win32";
const posixOnly = POSIX_MODES
  ? {}
  : { skip: "POSIX file modes: chmod/stat do not carry mode bits on win32" };

/** Assert an exact `mode & 0o777`, but only where the OS can honour one. */
function assertMode(target, expected, message) {
  if (!POSIX_MODES) return;
  const mode = fs.statSync(target).mode & 0o777;
  assert.equal(mode, expected, message ?? `expected 0${expected.toString(8)}, got 0${mode.toString(8)}`);
}

// electron/main.js `import ... from "electron"` at module scope, and `electron`
// is not installed in a headless `node --test` run. registerHooks() (node:module,
// synchronous + in-process) swaps that ONE specifier for the stub below so
// buildIpcDeps() — the SHIPPED endpoints-store wiring — is exercisable with no
// GUI. Same technique as test/electron-shell.test.js; see the long note there.
//
// getPath() reads a mutable global so each test can point userData at its own
// tmpdir. app.whenReady() never settles, so main.js's bootstrap stays inert and
// importing it only yields its exports.
let userDataDir = "/tmp/coop-endpoints-unset";

globalThis.__coopTestUserData = () => userDataDir;

const ELECTRON_STUB = `
  export const app = {
    isPackaged: false,
    // main.js pins the app name before anything resolves userData — a file-path
    // launch otherwise puts the key store in the shared ~/.config/Electron.
    // The stub models the real API; without setName, importing main.js throws.
    setName() {},
    getName: () => "coop-prep",
    getVersion: () => "0.1.0",
    getPath: (name) => (name === "userData" ? globalThis.__coopTestUserData() : "/tmp/coop-endpoints-other/" + name),
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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const SECRET = "sk-ant-api03-SUPERSECRETKEYVALUE";

/** Build a registry over in-memory storage with deterministic id/time. */
function makeRegistry(initial = null) {
  let n = 0;
  return createRegistry({
    storage: createMemoryStorage(initial),
    now: () => "2026-07-15T00:00:00.000Z",
    uuid: () => `id-${++n}`,
  });
}

/** Minimal Response stand-in for injected fetch. */
function fakeResponse({ status = 200, json = null, text = "", headers = {}, body = null } = {}) {
  const lower = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => lower[String(k).toLowerCase()] ?? null },
    json: async () => {
      if (json === null) throw new Error("not json");
      return json;
    },
    text: async () => text,
    body,
  };
}

/** Build a ReadableStream of SSE frames. */
function sseBody(frames) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    getReader: () => ({
      read: async () =>
        i < frames.length ? { done: false, value: encoder.encode(frames[i++]) } : { done: true, value: undefined },
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// providers
// ─────────────────────────────────────────────────────────────────────────────

describe("providers", () => {
  test("no preset carries a model id — models are discovered, never hardcoded", () => {
    for (const p of PROVIDERS) {
      assert.equal("model" in p, false, `${p.id} must not carry a model id`);
      assert.equal("models" in p, false, `${p.id} must not carry a model list`);
    }
  });

  test("preset list contains the expected providers incl. anthropic", () => {
    const ids = PROVIDERS.map((p) => p.id);
    for (const expected of [
      "anthropic", "openai", "minimax", "openrouter", "ollama-cloud", "groq",
      "mistral", "together", "fireworks", "gemini", "xai", "zai", "zai-coding",
      CUSTOM_PROVIDER_ID,
    ]) {
      assert.ok(ids.includes(expected), `missing provider ${expected}`);
    }
  });

  test("getProvider returns a preset, or null for an unknown id", () => {
    assert.equal(getProvider("openai").baseUrl, "https://api.openai.com/v1");
    assert.equal(getProvider("nope"), null);
  });

  test("normalizeBaseUrl trims whitespace and trailing slashes", () => {
    assert.equal(normalizeBaseUrl("  https://api.openai.com/v1/  "), "https://api.openai.com/v1");
    assert.equal(normalizeBaseUrl(null), "");
  });

  test("providerIdForUrl maps a preset URL back to its id", () => {
    assert.equal(providerIdForUrl("https://api.groq.com/openai/v1"), "groq");
    assert.equal(providerIdForUrl("https://api.groq.com/openai/v1/"), "groq");
  });

  test("a custom URL degrades the selector back to Custom URL", () => {
    assert.equal(providerIdForUrl("https://my-proxy.internal/v1"), CUSTOM_PROVIDER_ID);
    assert.equal(providerIdForUrl(""), CUSTOM_PROVIDER_ID);
  });

  test("isAnthropicShaped: true for api.anthropic.com host", () => {
    assert.equal(isAnthropicShaped("https://api.anthropic.com"), true);
  });

  test("isAnthropicShaped: true for an /anthropic path (MiniMax)", () => {
    assert.equal(isAnthropicShaped("https://api.minimax.io/anthropic"), true);
    assert.equal(isAnthropicShaped("https://gw.example.com/anthropic/v1"), true);
  });

  test("isAnthropicShaped: false for OpenAI-shaped endpoints", () => {
    assert.equal(isAnthropicShaped("https://api.openai.com/v1"), false);
    assert.equal(isAnthropicShaped("https://api.z.ai/api/paas/v4"), false);
  });

  test("isAnthropicShaped: does not match a host merely containing 'anthropic'", () => {
    assert.equal(isAnthropicShaped("https://not-anthropic.example.com/v1"), false);
  });

  test("isFirstPartyAnthropic distinguishes Anthropic from a compatible gateway", () => {
    assert.equal(isFirstPartyAnthropic("https://api.anthropic.com"), true);
    assert.equal(isFirstPartyAnthropic("https://api.minimax.io/anthropic"), false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// registry — THE KEY-STRIPPING INVARIANT
// ─────────────────────────────────────────────────────────────────────────────

describe("registry: apiKey never crosses back out", () => {
  test("list() never returns apiKey — asserted on the SERIALIZED JSON", () => {
    const registry = makeRegistry();
    registry.add({ label: "A", baseUrl: "https://api.openai.com/v1", apiKey: SECRET });
    registry.add({ label: "B", baseUrl: "https://api.anthropic.com", apiKey: "sk-ant-second-key-value" });

    const serialized = JSON.stringify(registry.list());
    assert.ok(!serialized.includes(SECRET), "the key must not appear in serialized list()");
    assert.ok(!serialized.includes("sk-ant-second-key-value"), "no key may appear in serialized list()");
    assert.ok(!serialized.includes("apiKey"), "the apiKey field must not appear at all");
  });

  test("list() view has hasKey instead of apiKey", () => {
    const registry = makeRegistry();
    registry.add({ label: "A", baseUrl: "https://api.openai.com/v1", apiKey: SECRET });
    const [view] = registry.list();
    assert.equal("apiKey" in view, false);
    assert.equal(view.hasKey, true);
  });

  test("hasKey is false for a keyless endpoint (which is a legal state)", () => {
    const registry = makeRegistry();
    registry.add({ label: "Local", baseUrl: "http://localhost:11434/v1" });
    const [view] = registry.list();
    assert.equal(view.hasKey, false);
    assert.equal("apiKey" in view, false);
  });

  test("get() never returns apiKey", () => {
    const registry = makeRegistry();
    const { endpoint } = registry.add({ label: "A", baseUrl: "https://api.openai.com/v1", apiKey: SECRET });
    const got = registry.get(endpoint.id);
    assert.ok(!JSON.stringify(got).includes(SECRET));
    assert.equal("apiKey" in got, false);
  });

  test("add() returns a view, not the stored record", () => {
    const registry = makeRegistry();
    const result = registry.add({ label: "A", baseUrl: "https://api.openai.com/v1", apiKey: SECRET });
    assert.ok(!JSON.stringify(result).includes(SECRET));
    assert.equal("apiKey" in result.endpoint, false);
  });

  test("update() returns a view, not the stored record", () => {
    const registry = makeRegistry();
    const { endpoint } = registry.add({ label: "A", baseUrl: "https://api.openai.com/v1", apiKey: SECRET });
    const result = registry.update(endpoint.id, { label: "Renamed" });
    assert.ok(!JSON.stringify(result).includes(SECRET));
    assert.equal("apiKey" in result.endpoint, false);
    assert.equal(result.endpoint.label, "Renamed");
  });

  test("toView strips apiKey by destructuring even for unknown extra fields", () => {
    const view = toView({ id: "x", label: "L", providerId: "openai", baseUrl: "u", apiKey: SECRET, extra: 1 });
    assert.equal("apiKey" in view, false);
    assert.equal(view.extra, 1, "non-secret fields flow through automatically");
    assert.equal(view.hasKey, true);
  });

  test("resolve() IS the one key-bearing accessor (so call.js can authenticate)", () => {
    const registry = makeRegistry();
    const { endpoint } = registry.add({ label: "A", baseUrl: "https://api.openai.com/v1", apiKey: SECRET });
    assert.equal(registry.resolve(endpoint.id).apiKey, SECRET);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// registry — CRUD + validation
// ─────────────────────────────────────────────────────────────────────────────

describe("registry: CRUD", () => {
  test("add persists and list returns it", () => {
    const registry = makeRegistry();
    registry.add({ label: "OpenAI", baseUrl: "https://api.openai.com/v1", apiKey: SECRET });
    const list = registry.list();
    assert.equal(list.length, 1);
    assert.equal(list[0].label, "OpenAI");
    assert.equal(list[0].providerId, "openai");
  });

  test("add derives providerId from the URL", () => {
    const registry = makeRegistry();
    const { endpoint } = registry.add({ label: "X", baseUrl: "https://api.x.ai/v1" });
    assert.equal(endpoint.providerId, "xai");
  });

  test("add falls back to Custom URL when the URL matches no preset", () => {
    const registry = makeRegistry();
    const { endpoint } = registry.add({ label: "Proxy", baseUrl: "https://proxy.internal/v1" });
    assert.equal(endpoint.providerId, CUSTOM_PROVIDER_ID);
  });

  test("a providerId that contradicts the URL is ignored — the URL wins", () => {
    const registry = makeRegistry();
    const { endpoint } = registry.add({
      label: "Mislabelled",
      baseUrl: "https://proxy.internal/v1",
      providerId: "openai",
    });
    assert.equal(endpoint.providerId, CUSTOM_PROVIDER_ID);
  });

  test("editing the URL away from a preset degrades providerId to Custom URL", () => {
    const registry = makeRegistry();
    const { endpoint } = registry.add({ label: "A", baseUrl: "https://api.openai.com/v1" });
    assert.equal(endpoint.providerId, "openai");
    const updated = registry.update(endpoint.id, { baseUrl: "https://proxy.internal/v1" });
    assert.equal(updated.endpoint.providerId, CUSTOM_PROVIDER_ID);
  });

  test("update leaves omitted fields untouched, including the key", () => {
    const registry = makeRegistry();
    const { endpoint } = registry.add({ label: "A", baseUrl: "https://api.openai.com/v1", apiKey: SECRET });
    registry.update(endpoint.id, { label: "B" });
    assert.equal(registry.resolve(endpoint.id).apiKey, SECRET, "key survives an unrelated update");
  });

  test("update with apiKey:'' clears the key", () => {
    const registry = makeRegistry();
    const { endpoint } = registry.add({ label: "A", baseUrl: "https://api.openai.com/v1", apiKey: SECRET });
    registry.update(endpoint.id, { apiKey: "" });
    assert.equal(registry.resolve(endpoint.id).apiKey, "");
    assert.equal(registry.get(endpoint.id).hasKey, false);
  });

  test("update on a missing id -> NOT_FOUND", () => {
    const registry = makeRegistry();
    const result = registry.update("nope", { label: "X" });
    assert.equal(result.ok, false);
    assert.equal(result.error.type, "NOT_FOUND");
  });

  test("remove deletes the endpoint", () => {
    const registry = makeRegistry();
    const { endpoint } = registry.add({ label: "A", baseUrl: "https://api.openai.com/v1" });
    assert.equal(registry.remove(endpoint.id).ok, true);
    assert.equal(registry.list().length, 0);
    assert.equal(registry.remove(endpoint.id).ok, false);
  });

  test("validation: label is required", () => {
    const registry = makeRegistry();
    const result = registry.add({ label: "   ", baseUrl: "https://api.openai.com/v1" });
    assert.equal(result.ok, false);
    assert.equal(result.error.type, "VALIDATION_ERROR");
    assert.equal(result.error.field, "label");
  });

  test("validation: baseUrl must be an absolute http(s) URL", () => {
    assert.equal(validateEndpointInput({ label: "A", baseUrl: "not a url" }).field, "baseUrl");
    assert.equal(validateEndpointInput({ label: "A", baseUrl: "ftp://x.com" }).field, "baseUrl");
    assert.equal(validateEndpointInput({ label: "A", baseUrl: "" }).field, "baseUrl");
    assert.equal(validateEndpointInput({ label: "A", baseUrl: "https://api.openai.com/v1" }), null);
  });

  test("validation: a keyless endpoint is valid (Ollama needs no key)", () => {
    assert.equal(validateEndpointInput({ label: "Ollama", baseUrl: "http://localhost:11434/v1" }), null);
  });

  test("createRegistry rejects a bad storage port", () => {
    assert.throws(() => createRegistry({ storage: {} }), TypeError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// headers — auth + NO ENV PATH
// ─────────────────────────────────────────────────────────────────────────────

describe("headers", () => {
  test("OpenAI-shaped endpoint uses Authorization: Bearer", () => {
    const h = buildAuthHeaders({ baseUrl: "https://api.openai.com/v1", apiKey: "sk-openai" });
    assert.equal(h.Authorization, "Bearer sk-openai");
    assert.equal(h["anthropic-version"], undefined);
  });

  test("MiniMax's Anthropic path uses Bearer (verified) AND anthropic-version", () => {
    const h = buildAuthHeaders({ baseUrl: "https://api.minimax.io/anthropic", apiKey: "mm-key" });
    assert.equal(h.Authorization, "Bearer mm-key");
    assert.equal(h["x-api-key"], undefined, "MiniMax needs Bearer, not x-api-key");
    assert.equal(h["anthropic-version"], "2023-06-01");
  });

  test("first-party Anthropic + API key uses x-api-key, never both headers", () => {
    const h = buildAuthHeaders({ baseUrl: "https://api.anthropic.com", apiKey: SECRET });
    assert.equal(h["x-api-key"], SECRET);
    assert.equal(h.Authorization, undefined, "sending both x-api-key and Authorization is a 401 cause");
    assert.equal(h["anthropic-version"], "2023-06-01");
  });

  test("first-party Anthropic + OAuth token uses Bearer plus the oauth beta flag", () => {
    const h = buildAuthHeaders({ baseUrl: "https://api.anthropic.com", apiKey: "sk-ant-oat01-abc" });
    assert.equal(h.Authorization, "Bearer sk-ant-oat01-abc");
    assert.equal(h["x-api-key"], undefined);
    assert.equal(h["anthropic-beta"], "oauth-2025-04-20");
  });

  test("isAnthropicOAuthToken distinguishes oat tokens from api keys", () => {
    assert.equal(isAnthropicOAuthToken("sk-ant-oat01-x"), true);
    assert.equal(isAnthropicOAuthToken("sk-ant-api03-x"), false);
  });

  test("a keyless endpoint gets NO auth header — it fails honestly", () => {
    const h = buildAuthHeaders({ baseUrl: "https://api.openai.com/v1" });
    assert.equal(h.Authorization, undefined);
    assert.equal(h["x-api-key"], undefined);
    assert.equal(h["Content-Type"], "application/json");
  });

  test("a whitespace-only key is treated as no key", () => {
    const h = buildAuthHeaders({ baseUrl: "https://api.openai.com/v1", apiKey: "   " });
    assert.equal(h.Authorization, undefined);
  });

  test("NO ENV PATH: a plausible env var does NOT authenticate a keyless endpoint", () => {
    const vars = ["ANTHROPIC_API_KEY", "MINIMAX_API_KEY", "OPENAI_API_KEY"];
    const saved = vars.map((v) => [v, process.env[v]]);
    try {
      for (const v of vars) process.env[v] = "env-injected-key-should-be-ignored";

      const anthropic = buildAuthHeaders({ baseUrl: "https://api.anthropic.com" });
      const minimax = buildAuthHeaders({ baseUrl: "https://api.minimax.io/anthropic" });
      const openai = buildAuthHeaders({ baseUrl: "https://api.openai.com/v1" });

      for (const h of [anthropic, minimax, openai]) {
        assert.equal(h.Authorization, undefined, "env must never produce an auth header");
        assert.equal(h["x-api-key"], undefined, "env must never produce an auth header");
        assert.ok(
          !JSON.stringify(h).includes("env-injected-key-should-be-ignored"),
          "ambient env state must never reach the headers"
        );
      }
    } finally {
      for (const [v, old] of saved) {
        if (old === undefined) delete process.env[v];
        else process.env[v] = old;
      }
    }
  });

  test("redactKey scrubs the key out of provider error text", () => {
    assert.equal(redactKey(`bad key ${SECRET} rejected`, SECRET), "bad key [redacted] rejected");
  });

  test("redactKey ignores short/absent keys and non-strings", () => {
    assert.equal(redactKey("hello", ""), "hello");
    assert.equal(redactKey("hello", "abc"), "hello");
    assert.equal(redactKey(null, SECRET), "");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// store — 0600 + path resolution
// ─────────────────────────────────────────────────────────────────────────────

describe("store", () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "coop-endpoints-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("the store file is written 0600", posixOnly, () => {
    const storage = createFileStorage({ env: { [ENDPOINTS_DIR_ENV]: dir } });
    storage.write([{ id: "a", apiKey: SECRET }]);
    const mode = fs.statSync(storage.path).mode & 0o777;
    assert.equal(mode, 0o600, `expected 0600, got 0${mode.toString(8)}`);
  });

  test("the store directory is created 0700", posixOnly, () => {
    const nested = path.join(dir, "nested");
    const storage = createFileStorage({ env: { [ENDPOINTS_DIR_ENV]: nested } });
    storage.write([]);
    const mode = fs.statSync(nested).mode & 0o777;
    assert.equal(mode, 0o700, `expected 0700, got 0${mode.toString(8)}`);
  });

  test("rewriting an existing file keeps it 0600", posixOnly, () => {
    const storage = createFileStorage({ env: { [ENDPOINTS_DIR_ENV]: dir } });
    storage.write([{ id: "a" }]);
    fs.chmodSync(storage.path, 0o644); // simulate a loosened file
    storage.write([{ id: "b" }]);
    assert.equal(fs.statSync(storage.path).mode & 0o777, 0o600);
  });

  test("round-trips endpoints through disk", () => {
    const storage = createFileStorage({ env: { [ENDPOINTS_DIR_ENV]: dir } });
    storage.write([{ id: "a", label: "A", apiKey: SECRET }]);
    const read = storage.read();
    assert.equal(read.length, 1);
    assert.equal(read[0].apiKey, SECRET);
  });

  test("a missing file reads as null, not a throw", () => {
    const storage = createFileStorage({ env: { [ENDPOINTS_DIR_ENV]: path.join(dir, "absent") } });
    assert.equal(storage.read(), null);
  });

  test("a corrupt file reads as null, not a throw", () => {
    const storage = createFileStorage({ env: { [ENDPOINTS_DIR_ENV]: dir } });
    fs.writeFileSync(storage.path, "{not json", { mode: 0o600 });
    assert.equal(storage.read(), null);
  });

  test("a LEGACY bare-array file reads as the endpoint list, keys and all", () => {
    const storage = createFileStorage({ env: { [ENDPOINTS_DIR_ENV]: dir } });
    fs.writeFileSync(storage.path, JSON.stringify([{ id: "a", apiKey: SECRET }]), { mode: 0o600 });
    const read = storage.read();
    assert.equal(read.length, 1, "the format written by every previous build must not read as empty");
    assert.equal(read[0].apiKey, SECRET);
  });

  test("a legacy file is upgraded to the envelope on the next write, losing nothing", () => {
    const storage = createFileStorage({ env: { [ENDPOINTS_DIR_ENV]: dir } });
    fs.writeFileSync(storage.path, JSON.stringify([{ id: "a", apiKey: SECRET }]), { mode: 0o600 });
    storage.write(storage.read());
    assert.equal(JSON.parse(fs.readFileSync(storage.path, "utf8")).version, 1, "it must be upgraded in place");
    assert.equal(storage.read()[0].apiKey, SECRET, "and the key must survive the upgrade");
  });

  test("readEndpointsDocument accepts both shapes and rejects everything else", () => {
    assert.deepEqual(readEndpointsDocument('{"version":1,"endpoints":[{"id":"a"}]}'), [{ id: "a" }]);
    assert.deepEqual(readEndpointsDocument('[{"id":"a"}]'), [{ id: "a" }], "legacy bare array");
    assert.deepEqual(readEndpointsDocument("[]"), []);
    assert.equal(readEndpointsDocument("{not json"), null);
    assert.equal(readEndpointsDocument('{"version":1}'), null);
    assert.equal(readEndpointsDocument("42"), null);
    assert.equal(readEndpointsDocument('"a string"'), null);
    assert.equal(readEndpointsDocument("null"), null);
  });

  test("the env override wins and is a DIRECTORY, not a key", () => {
    assert.equal(resolveStoreDir({ env: { [ENDPOINTS_DIR_ENV]: "/tmp/xyz" } }), "/tmp/xyz");
  });

  test("an injected Electron app resolves under userData", () => {
    const resolved = resolveStoreDir({
      env: {},
      electronApp: { getPath: (n) => (n === "userData" ? "/home/u/.config/App" : "") },
    });
    assert.equal(resolved, path.join("/home/u/.config/App", "coop-prep"));
  });

  test("without Electron it resolves XDG_CONFIG_HOME — NOT a Windows path", () => {
    const resolved = resolveStoreDir({ env: { XDG_CONFIG_HOME: "/home/u/.config" } });
    assert.equal(resolved, path.join("/home/u/.config", "coop-prep"));
  });

  test("with neither, it falls back under the home directory", () => {
    const resolved = resolveStoreDir({ env: {} });
    assert.equal(resolved, path.join(os.homedir(), ".config", "coop-prep"));
    assert.ok(!resolved.includes("AppData"), "must not hardcode a Windows-shaped path");
  });

  test("registry over file storage keeps the key off the view but on disk", () => {
    const registry = createRegistry({ storage: createFileStorage({ env: { [ENDPOINTS_DIR_ENV]: dir } }) });
    registry.add({ label: "A", baseUrl: "https://api.openai.com/v1", apiKey: SECRET });
    assert.ok(!JSON.stringify(registry.list()).includes(SECRET));
    const onDisk = fs.readFileSync(path.join(dir, "endpoints.json"), "utf8");
    assert.ok(onDisk.includes(SECRET), "the key must persist on the 0600 file");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// THE SHIPPED KEY STORE
//
// The `store` describe above proves 0600/0700/atomic about createFileStorage.
// That is only worth anything if createFileStorage is what the app RUNS. It was
// not: electron/main.js's buildIpcDeps() hand-rolled its own storage port, so
// every assertion up there was green about code that never shipped, while the
// code that did ship would have failed all of them. These tests are pointed at
// buildIpcDeps() — the real wiring — and are the ones that speak for the app.
// ─────────────────────────────────────────────────────────────────────────────

describe("electron main: the SHIPPED endpoints store", () => {
  let savedEnvOverride;
  let endpointsFile;

  /** The registry the app actually runs, over userData in `dir`. */
  function shippedEndpoints() {
    return buildIpcDeps().endpoints;
  }

  beforeEach(() => {
    savedEnvOverride = process.env[ENDPOINTS_DIR_ENV];
    delete process.env[ENDPOINTS_DIR_ENV];
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "coop-shipped-"));
    endpointsFile = path.join(userDataDir, "endpoints.json");
  });

  afterEach(() => {
    fs.rmSync(userDataDir, { recursive: true, force: true });
    if (savedEnvOverride === undefined) delete process.env[ENDPOINTS_DIR_ENV];
    else process.env[ENDPOINTS_DIR_ENV] = savedEnvOverride;
  });

  test("the shipped store writes the key file 0600", posixOnly, () => {
    shippedEndpoints().add({ label: "A", baseUrl: "https://api.openai.com/v1", apiKey: SECRET });
    const mode = fs.statSync(endpointsFile).mode & 0o777;
    assert.equal(mode, 0o600, `expected 0600, got 0${mode.toString(8)}`);
  });

  test("a PRE-EXISTING 0644 endpoints.json is re-hardened to 0600 by the shipped write", posixOnly, () => {
    // writeFileSync's `mode` is only honoured when it CREATES the file. A file
    // left world-readable by another local process, a restored backup, or an
    // older build must not silently keep that mode once a key lands in it.
    fs.writeFileSync(endpointsFile, "[]", { mode: 0o644 });
    fs.chmodSync(endpointsFile, 0o644); // defeat umask — this is the hostile precondition

    shippedEndpoints().add({ label: "A", baseUrl: "https://api.openai.com/v1", apiKey: SECRET });

    const onDisk = fs.readFileSync(endpointsFile, "utf8");
    assert.ok(onDisk.includes(SECRET), "precondition: the key really did land in this file");
    const mode = fs.statSync(endpointsFile).mode & 0o777;
    assert.equal(mode, 0o600, `the key is world-readable at 0${mode.toString(8)}`);
  });

  test("the shipped store creates its directory 0700", posixOnly, () => {
    userDataDir = path.join(userDataDir, "userData"); // not yet created, as on first run
    endpointsFile = path.join(userDataDir, "endpoints.json");

    shippedEndpoints().add({ label: "A", baseUrl: "https://api.openai.com/v1", apiKey: SECRET });

    const mode = fs.statSync(userDataDir).mode & 0o777;
    assert.equal(mode, 0o700, `expected 0700, got 0${mode.toString(8)}`);
  });

  test("a 0755 parent directory still yields a 0600 key file", posixOnly, () => {
    fs.chmodSync(userDataDir, 0o755);
    shippedEndpoints().add({ label: "A", baseUrl: "https://api.openai.com/v1", apiKey: SECRET });
    assert.equal(fs.statSync(userDataDir).mode & 0o777, 0o755, "precondition: the parent really is traversable");
    assert.equal(fs.statSync(endpointsFile).mode & 0o777, 0o600, "the file mode is the last line of defence");
  });

  test("a crash mid-write cannot truncate the store or lose the keys already in it", () => {
    const endpoints = shippedEndpoints();
    endpoints.add({ label: "A", baseUrl: "https://api.openai.com/v1", apiKey: SECRET });
    const before = fs.readFileSync(endpointsFile, "utf8");

    // store.js and main.js both `import fs from "node:fs"`, which is one shared
    // module object — patching it here is patching the fs THEY call. Simulate a
    // process dying partway through the write: some bytes hit the disk, then the
    // world ends. An atomic write spends that on a temp file; a direct write
    // spends it on the only copy of every configured key.
    const realWriteFileSync = fs.writeFileSync;
    fs.writeFileSync = (file, data, opts) => {
      realWriteFileSync.call(fs, file, String(data).slice(0, 12), opts);
      throw new Error("ENOSPC: simulated crash mid-write");
    };
    try {
      assert.throws(
        () => endpoints.add({ label: "B", baseUrl: "https://api.anthropic.com", apiKey: "sk-ant-second-key" }),
        /simulated crash/
      );
    } finally {
      fs.writeFileSync = realWriteFileSync;
    }

    assert.equal(fs.readFileSync(endpointsFile, "utf8"), before, "the store must survive the crash byte-identical");
    const recovered = shippedEndpoints();
    assert.equal(recovered.list().length, 1, "a truncated store reads as null and reports zero endpoints");
    assert.equal(recovered.resolve(recovered.list()[0].id).apiKey, SECRET, "the key must still be there");
  });

  test("LEGACY bare-array endpoints.json: every key survives the upgrade", () => {
    // What every previous build wrote: a bare array, no {version,endpoints}
    // envelope. Swapping in the hardened store WITHOUT handling this reads null,
    // reports zero endpoints, and the first write overwrites the file —
    // irrecoverably destroying every key the user configured.
    const legacy = [
      { id: "legacy-1", label: "Anthropic", providerId: "anthropic", baseUrl: "https://api.anthropic.com", apiKey: SECRET },
      { id: "legacy-2", label: "OpenAI", providerId: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "sk-openai-legacy-key" },
    ];
    fs.writeFileSync(endpointsFile, JSON.stringify(legacy, null, 2), { mode: 0o600 });

    const endpoints = shippedEndpoints();
    const list = endpoints.list();
    assert.equal(list.length, 2, "a legacy store must not read as empty");
    assert.deepEqual(list.map((e) => e.label).sort(), ["Anthropic", "OpenAI"]);
    assert.equal(endpoints.resolve("legacy-1").apiKey, SECRET);
    assert.equal(endpoints.resolve("legacy-2").apiKey, "sk-openai-legacy-key");
  });

  test("LEGACY upgrade is durable: a write re-reads with both keys intact", () => {
    const legacy = [
      { id: "legacy-1", label: "Anthropic", providerId: "anthropic", baseUrl: "https://api.anthropic.com", apiKey: SECRET },
    ];
    fs.writeFileSync(endpointsFile, JSON.stringify(legacy), { mode: 0o600 });

    // Any mutation rewrites the whole file in the new format. The legacy key
    // must be carried across, not dropped on the floor.
    shippedEndpoints().add({ label: "New", baseUrl: "https://api.openai.com/v1", apiKey: "sk-brand-new-key" });

    const reopened = shippedEndpoints();
    assert.equal(reopened.list().length, 2, "the pre-existing endpoint must survive an unrelated add()");
    assert.equal(reopened.resolve("legacy-1").apiKey, SECRET, "the legacy key must survive the format upgrade");
    assertMode(endpointsFile, 0o600);
  });

  test("the shipped store leaves no temp file and no stray world-readable copy behind", () => {
    shippedEndpoints().add({ label: "A", baseUrl: "https://api.openai.com/v1", apiKey: SECRET });
    for (const name of fs.readdirSync(userDataDir)) {
      const body = fs.readFileSync(path.join(userDataDir, name), "utf8");
      if (!body.includes(SECRET)) continue;
      assertMode(path.join(userDataDir, name), 0o600, `${name} holds the key world-readable`);
    }
    assert.deepEqual(
      fs.readdirSync(userDataDir).filter((n) => n.includes(".tmp")),
      [],
      "no temp file may be left behind"
    );
  });

  test("the shipped registry still strips the key out of everything the renderer can see", () => {
    const endpoints = shippedEndpoints();
    endpoints.add({ label: "A", baseUrl: "https://api.openai.com/v1", apiKey: SECRET });
    const serialized = JSON.stringify(endpoints.list());
    assert.ok(!serialized.includes(SECRET), "the key must not survive into an IPC payload");
    assert.ok(!serialized.includes("apiKey"));
  });

  test("COOP_ENDPOINTS_DIR still redirects the shipped store (it is a directory, not a key)", () => {
    const override = fs.mkdtempSync(path.join(os.tmpdir(), "coop-shipped-override-"));
    process.env[ENDPOINTS_DIR_ENV] = override;
    try {
      shippedEndpoints().add({ label: "A", baseUrl: "https://api.openai.com/v1", apiKey: SECRET });
      assert.ok(fs.existsSync(path.join(override, "endpoints.json")), "the override directory must win");
      assert.equal(fs.existsSync(endpointsFile), false, "nothing may be written under userData");
    } finally {
      fs.rmSync(override, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// probe — /v1/v1 fix + 404-only fallthrough
// ─────────────────────────────────────────────────────────────────────────────

describe("probe: the /v1/v1 fix", () => {
  test("hasVersionSegment detects a trailing version", () => {
    assert.equal(hasVersionSegment("https://api.openai.com/v1"), true);
    assert.equal(hasVersionSegment("https://api.z.ai/api/paas/v4"), true);
    assert.equal(hasVersionSegment("https://generativelanguage.googleapis.com/v1beta/openai"), false);
    assert.equal(hasVersionSegment("https://api.anthropic.com"), false);
  });

  test("a versioned root is NOT given a second /v1 first — no /v1/v1", () => {
    const [first] = candidateModelsUrls("https://api.openai.com/v1");
    assert.equal(first, "https://api.openai.com/v1/models");
    assert.ok(!first.includes("/v1/v1"), "must never produce /v1/v1");
  });

  test("an unversioned root does get /v1 first", () => {
    const [first] = candidateChatUrls("https://api.anthropic.com");
    assert.equal(first, "https://api.anthropic.com/v1/chat/completions");
  });

  test("candidates cover both orderings as a fallback", () => {
    assert.deepEqual(candidateChatUrls("https://api.openai.com/v1"), [
      "https://api.openai.com/v1/chat/completions",
      "https://api.openai.com/v1/v1/chat/completions",
    ]);
  });

  test("an empty base URL yields no candidates", () => {
    assert.deepEqual(candidateChatUrls(""), []);
  });
});

describe("probe: 404-only fallthrough", () => {
  test("a 401 on the FIRST candidate surfaces as 401, not the second's 404", async () => {
    const tried = [];
    const result = await tryCandidates(["/a", "/b"], async (url) => {
      tried.push(url);
      return fakeResponse({ status: url === "/a" ? 401 : 404 });
    });
    assert.equal(result.ok, true);
    assert.equal(result.response.status, 401, "401 must not be masked by a later 404");
    assert.deepEqual(tried, ["/a"], "a non-404 must stop the walk immediately");
  });

  test("a 404 falls through to the next candidate", async () => {
    const tried = [];
    const result = await tryCandidates(["/a", "/b"], async (url) => {
      tried.push(url);
      return fakeResponse({ status: url === "/a" ? 404 : 200 });
    });
    assert.equal(result.response.status, 200);
    assert.deepEqual(tried, ["/a", "/b"]);
  });

  test("500 does not fall through", async () => {
    const tried = [];
    const result = await tryCandidates(["/a", "/b"], async (url) => {
      tried.push(url);
      return fakeResponse({ status: 500 });
    });
    assert.equal(result.response.status, 500);
    assert.deepEqual(tried, ["/a"]);
  });

  test("when every candidate 404s, 404 is the real answer", async () => {
    const result = await tryCandidates(["/a", "/b"], async () => fakeResponse({ status: 404 }));
    assert.equal(result.ok, true);
    assert.equal(result.response.status, 404);
  });

  test("a thrown fetch becomes NETWORK_ERROR carrying no raw error", async () => {
    const result = await tryCandidates(["/a"], async () => {
      throw new Error(`connect ECONNREFUSED with ${SECRET}`);
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.type, "NETWORK_ERROR");
    assert.ok(!JSON.stringify(result.error).includes(SECRET));
  });

  test("discoverModels surfaces a 401 as AUTH_ERROR, not a 404", async () => {
    const result = await discoverModels(
      { baseUrl: "https://api.openai.com/v1", apiKey: "bad" },
      async () => fakeResponse({ status: 401, json: { error: { message: "Invalid key" } } })
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.type, "AUTH_ERROR");
    assert.equal(result.error.status, 401);
    assert.equal(result.error.message, "Invalid key");
    assert.match(result.error.hint, /Settings/);
  });

  test("a 401 on a keyless endpoint hints to ADD a key", async () => {
    const result = await discoverModels(
      { baseUrl: "https://api.openai.com/v1" },
      async () => fakeResponse({ status: 401, json: { error: { message: "no auth" } } })
    );
    assert.match(result.error.hint, /no API key/i);
  });
});

describe("probe: model discovery", () => {
  test("parses an OpenAI /models payload", () => {
    assert.deepEqual(parseModelList({ data: [{ id: "gpt-4o" }, { id: "gpt-5" }] }), [
      { id: "gpt-4o" },
      { id: "gpt-5" },
    ]);
  });

  test("parses an Ollama /api/tags payload", () => {
    assert.deepEqual(parseModelList({ models: [{ name: "llama3" }] }), [{ id: "llama3" }]);
  });

  test("ignores malformed rows instead of throwing", () => {
    assert.deepEqual(parseModelList({ data: [{ id: "ok" }, {}, null, 5] }), [{ id: "ok" }]);
    assert.deepEqual(parseModelList(null), []);
  });

  test("discoverModels returns live models from the endpoint", async () => {
    const result = await discoverModels(
      { baseUrl: "https://api.openai.com/v1", apiKey: "k" },
      async () => fakeResponse({ status: 200, json: { data: [{ id: "gpt-4o" }] } })
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.models, [{ id: "gpt-4o" }]);
  });

  test("discoverModels falls through /models 404 to Ollama's /api/tags", async () => {
    const tried = [];
    const result = await discoverModels({ baseUrl: "http://localhost:11434" }, async (url) => {
      tried.push(url);
      if (url.endsWith("/api/tags")) return fakeResponse({ status: 200, json: { models: [{ name: "llama3" }] } });
      return fakeResponse({ status: 404 });
    });
    assert.deepEqual(result.models, [{ id: "llama3" }]);
    assert.ok(tried.some((u) => u.endsWith("/api/tags")));
  });

  test("discoverModels rejects an endpoint with no base URL", async () => {
    const result = await discoverModels({ baseUrl: "" }, async () => fakeResponse({}));
    assert.equal(result.error.type, "INVALID_URL");
  });

  test("a non-JSON 200 body is BAD_RESPONSE", async () => {
    const result = await discoverModels(
      { baseUrl: "https://api.openai.com/v1" },
      async () => fakeResponse({ status: 200, json: null })
    );
    assert.equal(result.error.type, "BAD_RESPONSE");
  });

  test("probeEndpoint reports the wire shape alongside the models", async () => {
    const result = await probeEndpoint(
      { baseUrl: "https://api.minimax.io/anthropic", apiKey: "k" },
      async () => fakeResponse({ status: 200, json: { data: [{ id: "MiniMax-M2" }] } })
    );
    assert.equal(result.ok, true);
    assert.equal(result.anthropic, true);
    assert.deepEqual(result.models, [{ id: "MiniMax-M2" }]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// call — body shapes
// ─────────────────────────────────────────────────────────────────────────────

describe("call: Anthropic body rules", () => {
  const base = { system: "sys", messages: [{ role: "user", content: "hi" }], maxTokens: 100 };

  test("claude-fable-5 OMITS thinking entirely (an explicit disabled is a 400)", () => {
    const body = buildAnthropicBody({ ...base, model: "claude-fable-5" });
    assert.equal("thinking" in body, false);
  });

  test("claude-opus-4-8 sends thinking:{type:'adaptive'}", () => {
    const body = buildAnthropicBody({ ...base, model: "claude-opus-4-8" });
    assert.deepEqual(body.thinking, { type: "adaptive" });
  });

  test("claude-sonnet-5 sends thinking:{type:'adaptive'}", () => {
    const body = buildAnthropicBody({ ...base, model: "claude-sonnet-5" });
    assert.deepEqual(body.thinking, { type: "adaptive" });
  });

  test("an unknown model omits thinking rather than risking a 400", () => {
    const body = buildAnthropicBody({ ...base, model: "some-gateway-model" });
    assert.equal("thinking" in body, false);
  });

  test("temperature / top_p / top_k / budget_tokens are NEVER sent (all are 400s)", () => {
    for (const model of Object.keys(ANTHROPIC_MODEL_RULES)) {
      const body = buildAnthropicBody({ ...base, model, effort: "high" });
      const serialized = JSON.stringify(body);
      for (const banned of ["temperature", "top_p", "top_k", "budget_tokens"]) {
        assert.ok(!serialized.includes(banned), `${banned} must never be sent (${model})`);
      }
    }
  });

  test("depth is controlled by output_config.effort", () => {
    const body = buildAnthropicBody({ ...base, model: "claude-opus-4-8", effort: "xhigh" });
    assert.deepEqual(body.output_config, { effort: "xhigh" });
  });

  test("an invalid effort is dropped rather than sent", () => {
    const body = buildAnthropicBody({ ...base, model: "claude-opus-4-8", effort: "turbo" });
    assert.equal("output_config" in body, false);
  });

  test("system is hoisted to a top-level field", () => {
    const body = buildAnthropicBody({ ...base, model: "claude-opus-4-8" });
    assert.equal(body.system, "sys");
    assert.deepEqual(body.messages, [{ role: "user", content: "hi" }]);
  });
});

describe("call: OpenAI body", () => {
  test("system becomes the first message", () => {
    const body = buildOpenAIBody({
      model: "gpt-4o",
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 100,
      stream: false,
    });
    assert.deepEqual(body.messages, [
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
    ]);
    assert.equal(body.max_tokens, 100);
    assert.equal(body.stream, false);
  });
});

describe("call: response parsing", () => {
  test("extractText reads the Anthropic content array", () => {
    assert.equal(extractText({ content: [{ type: "text", text: "Hello" }] }), "Hello");
  });

  test("extractText reads the OpenAI choices array", () => {
    assert.equal(extractText({ choices: [{ message: { content: "Hello" } }] }), "Hello");
  });

  test("extractText returns '' for an unrecognized body", () => {
    assert.equal(extractText({ weird: true }), "");
  });

  test("extractDelta reads both stream shapes", () => {
    assert.equal(extractDelta({ delta: { type: "text_delta", text: "a" } }), "a");
    assert.equal(extractDelta({ choices: [{ delta: { content: "b" } }] }), "b");
    assert.equal(extractDelta({ nothing: 1 }), "");
  });
});

describe("call: callEndpoint", () => {
  const openai = { baseUrl: "https://api.openai.com/v1", apiKey: SECRET };

  test("success returns { ok:true, text }", async () => {
    const result = await callEndpoint(
      { endpoint: openai, model: "gpt-4o", system: "s", user: "u" },
      async () => fakeResponse({ status: 200, json: { choices: [{ message: { content: "Dear Team," } }] } })
    );
    assert.equal(result.ok, true);
    assert.equal(result.text, "Dear Team,");
    assert.equal(result.model, "gpt-4o");
  });

  test("the key is sent as a header and never appears in the result", async () => {
    let seenHeaders;
    const result = await callEndpoint(
      { endpoint: openai, model: "gpt-4o", user: "u" },
      async (_url, init) => {
        seenHeaders = init.headers;
        return fakeResponse({ status: 200, json: { choices: [{ message: { content: "ok" } }] } });
      }
    );
    assert.equal(seenHeaders.Authorization, `Bearer ${SECRET}`);
    assert.ok(!JSON.stringify(result).includes(SECRET));
  });

  test("no endpoint -> NO_ENDPOINT naming Settings, and fetch is NOT called", async () => {
    let called = false;
    const result = await callEndpoint({ model: "gpt-4o", user: "u" }, async () => {
      called = true;
      return fakeResponse({});
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.type, "NO_ENDPOINT");
    assert.match(result.error.message, /Settings/);
    assert.equal(called, false);
  });

  test("no model -> BAD_REQUEST (models come from a probe, never a preset)", async () => {
    const result = await callEndpoint({ endpoint: openai, user: "u" }, async () => fakeResponse({}));
    assert.equal(result.error.type, "BAD_REQUEST");
  });

  test("a thrown fetch -> NETWORK_ERROR with no key in it", async () => {
    const result = await callEndpoint({ endpoint: openai, model: "gpt-4o", user: "u" }, async () => {
      throw new Error(`socket hang up ${SECRET}`);
    });
    assert.equal(result.error.type, "NETWORK_ERROR");
    assert.ok(!JSON.stringify(result).includes(SECRET));
  });

  test("401 -> AUTH_ERROR with an actionable hint naming Settings", async () => {
    const result = await callEndpoint(
      { endpoint: openai, model: "gpt-4o", user: "u" },
      async () => fakeResponse({ status: 401, json: { error: { message: "bad key" } } })
    );
    assert.equal(result.error.type, "AUTH_ERROR");
    assert.equal(result.error.status, 401);
    assert.equal(result.error.message, "bad key");
    assert.match(result.error.hint, /Settings → AI Endpoints/);
  });

  test("a provider echoing the key back has it redacted out of the error", async () => {
    const result = await callEndpoint(
      { endpoint: openai, model: "gpt-4o", user: "u" },
      async () => fakeResponse({ status: 401, json: { error: { message: `key ${SECRET} is invalid` } } })
    );
    assert.ok(!JSON.stringify(result).includes(SECRET), "the key must never survive into an error");
    assert.equal(result.error.message, "key [redacted] is invalid");
  });

  test("500 -> API_ERROR carrying the status", async () => {
    const result = await callEndpoint(
      { endpoint: openai, model: "gpt-4o", user: "u" },
      async () => fakeResponse({ status: 500, json: { error: { message: "boom" } } })
    );
    assert.equal(result.error.type, "API_ERROR");
    assert.equal(result.error.status, 500);
  });

  test("an Anthropic endpoint posts to /v1/messages", async () => {
    let seenUrl;
    await callEndpoint(
      { endpoint: { baseUrl: "https://api.anthropic.com", apiKey: SECRET }, model: "claude-opus-4-8", user: "u" },
      async (url) => {
        seenUrl = url;
        return fakeResponse({ status: 200, json: { content: [{ type: "text", text: "hi" }] } });
      }
    );
    assert.equal(seenUrl, "https://api.anthropic.com/v1/messages");
  });

  test("assistant prefill is rejected locally, before any fetch", async () => {
    let called = false;
    const result = await callEndpoint(
      {
        endpoint: { baseUrl: "https://api.anthropic.com", apiKey: SECRET },
        model: "claude-opus-4-8",
        messages: [
          { role: "user", content: "hi" },
          { role: "assistant", content: '{"x":' },
        ],
      },
      async () => {
        called = true;
        return fakeResponse({});
      }
    );
    assert.equal(result.error.type, "BAD_REQUEST");
    assert.match(result.error.message, /prefill/i);
    assert.equal(called, false, "a known 400 must not be spent on a round trip");
  });

  test("SSE streaming accumulates deltas and reports them", async () => {
    const deltas = [];
    const result = await callEndpoint(
      { endpoint: openai, model: "gpt-4o", user: "u", stream: true, onDelta: (d) => deltas.push(d) },
      async () =>
        fakeResponse({
          status: 200,
          headers: { "content-type": "text/event-stream" },
          body: sseBody([
            'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
            "data: [DONE]\n\n",
          ]),
        })
    );
    assert.equal(result.ok, true);
    assert.equal(result.text, "Hello");
    assert.deepEqual(deltas, ["Hel", "lo"]);
  });

  test("Anthropic SSE deltas are accumulated too", async () => {
    const result = await callEndpoint(
      {
        endpoint: { baseUrl: "https://api.anthropic.com", apiKey: SECRET },
        model: "claude-opus-4-8",
        user: "u",
        stream: true,
      },
      async () =>
        fakeResponse({
          status: 200,
          headers: { "content-type": "text/event-stream" },
          body: sseBody([
            'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n\n',
          ]),
        })
    );
    assert.equal(result.text, "Hi");
  });

  test("a provider that IGNORES stream:true and sends JSON is still handled", async () => {
    const result = await callEndpoint(
      { endpoint: openai, model: "gpt-4o", user: "u", stream: true },
      async () =>
        fakeResponse({
          status: 200,
          headers: { "content-type": "application/json" },
          json: { choices: [{ message: { content: "whole body" } }] },
        })
    );
    assert.equal(result.ok, true);
    assert.equal(result.text, "whole body", "branching on content-type, not on what we asked for");
  });

  test("the response is sanitized before it is returned", async () => {
    const result = await callEndpoint(
      { endpoint: openai, model: "gpt-4o", user: "u" },
      async () =>
        fakeResponse({ status: 200, json: { choices: [{ message: { content: "<script>alert(1)</script>safe" } }] } })
    );
    assert.equal(result.text, "safe");
  });

  test("a keyless endpoint still attempts the call (Ollama needs no key)", async () => {
    let called = false;
    const result = await callEndpoint(
      { endpoint: { baseUrl: "http://localhost:11434/v1" }, model: "llama3", user: "u" },
      async (_url, init) => {
        called = true;
        assert.equal(init.headers.Authorization, undefined);
        return fakeResponse({ status: 200, json: { choices: [{ message: { content: "local" } }] } });
      }
    );
    assert.equal(called, true, "keyless must probe unauthenticated, not be short-circuited");
    assert.equal(result.text, "local");
  });

  test("end-to-end: registry.resolve feeds call, and list stays key-free", async () => {
    const registry = makeRegistry();
    const { endpoint } = registry.add({ label: "A", baseUrl: "https://api.openai.com/v1", apiKey: SECRET });

    const result = await callEndpoint(
      { endpoint: registry.resolve(endpoint.id), model: "gpt-4o", user: "u" },
      async (_url, init) => {
        assert.equal(init.headers.Authorization, `Bearer ${SECRET}`);
        return fakeResponse({ status: 200, json: { choices: [{ message: { content: "ok" } }] } });
      }
    );

    assert.equal(result.text, "ok");
    assert.ok(!JSON.stringify(registry.list()).includes(SECRET));
    assert.ok(!JSON.stringify(result).includes(SECRET));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// call — the /v1/v1 fix on the CALL path, not just the probe
//
// The failure this section exists to make impossible: an endpoint that TESTS
// GREEN in Settings (probe applies hasVersionSegment) and then 404s on first
// real use (call did not). Whatever URL the probe blesses, the call must use.
// ─────────────────────────────────────────────────────────────────────────────

describe("call: URL building is the same single source of truth as the probe", () => {
  /** Both wire shapes × both URL forms. `suffix` is the path each shape calls. */
  const CASES = [
    { name: "OpenAI-shaped, bare root", baseUrl: "https://gw.example.com/openai", suffix: "chat/completions" },
    { name: "OpenAI-shaped, versioned root", baseUrl: "https://api.openai.com/v1", suffix: "chat/completions" },
    { name: "Anthropic-shaped, bare root", baseUrl: "https://api.anthropic.com", suffix: "messages" },
    { name: "Anthropic-shaped, versioned root", baseUrl: "https://api.anthropic.com/v1", suffix: "messages" },
    { name: "Anthropic gateway, versioned root", baseUrl: "https://gw.example.com/anthropic/v1", suffix: "messages" },
    { name: "Anthropic gateway, bare root", baseUrl: "https://api.minimax.io/anthropic", suffix: "messages" },
  ];

  for (const { name, baseUrl, suffix } of CASES) {
    test(`${name}: the call POSTs exactly where the probe says it should`, async () => {
      const tried = [];
      const result = await callEndpoint(
        { endpoint: { baseUrl, apiKey: SECRET }, model: "m", user: "u" },
        async (url) => {
          tried.push(url);
          return fakeResponse({ status: 200, json: { content: [{ type: "text", text: "ok" }] } });
        }
      );
      assert.equal(result.ok, true);
      assert.equal(tried[0], candidateUrls(baseUrl, suffix)[0], "call must agree with probe on the first URL");
      assert.ok(!tried[0].includes("/v1/v1"), `must never produce /v1/v1 — got ${tried[0]}`);
    });
  }

  test("a versioned Anthropic root does NOT get a second /v1 — the paste the docs invite", async () => {
    let seenUrl;
    await callEndpoint(
      { endpoint: { baseUrl: "https://api.anthropic.com/v1", apiKey: SECRET }, model: "claude-opus-4-8", user: "u" },
      async (url) => {
        seenUrl = url;
        return fakeResponse({ status: 200, json: { content: [{ type: "text", text: "hi" }] } });
      }
    );
    assert.equal(seenUrl, "https://api.anthropic.com/v1/messages");
  });

  test("the Anthropic call path keeps the 404-only fallthrough", async () => {
    const tried = [];
    const result = await callEndpoint(
      { endpoint: { baseUrl: "https://api.anthropic.com", apiKey: SECRET }, model: "claude-opus-4-8", user: "u" },
      async (url) => {
        tried.push(url);
        return url.endsWith("/v1/messages")
          ? fakeResponse({ status: 404, json: { error: { message: "not found" } } })
          : fakeResponse({ status: 200, json: { content: [{ type: "text", text: "hi" }] } });
      }
    );
    assert.deepEqual(tried, ["https://api.anthropic.com/v1/messages", "https://api.anthropic.com/messages"]);
    assert.equal(result.text, "hi");
  });

  test("the Anthropic call path does NOT fall through on a 401", async () => {
    const tried = [];
    const result = await callEndpoint(
      { endpoint: { baseUrl: "https://api.anthropic.com", apiKey: SECRET }, model: "claude-opus-4-8", user: "u" },
      async (url) => {
        tried.push(url);
        return fakeResponse({ status: 401, json: { error: { message: "bad key" } } });
      }
    );
    assert.deepEqual(tried, ["https://api.anthropic.com/v1/messages"], "a non-404 must stop the walk");
    assert.equal(result.error.type, "AUTH_ERROR");
  });

  test("green in Settings then 404 on use is impossible: probe and call agree on one fake server", async () => {
    // Serves ONLY the real Anthropic paths. Anything else is a 404, exactly as
    // api.anthropic.com would answer it.
    const server = async (url) => {
      if (url === "https://api.anthropic.com/v1/models") {
        return fakeResponse({ status: 200, json: { data: [{ id: "claude-opus-4-8" }] } });
      }
      if (url === "https://api.anthropic.com/v1/messages") {
        return fakeResponse({ status: 200, json: { content: [{ type: "text", text: "hi" }] } });
      }
      return fakeResponse({ status: 404, json: { error: { message: "not_found_error" } } });
    };

    for (const baseUrl of ["https://api.anthropic.com", "https://api.anthropic.com/v1"]) {
      const endpoint = { baseUrl, apiKey: SECRET };

      const probed = await probeEndpoint(endpoint, server);
      assert.equal(probed.ok, true, `${baseUrl} must test green`);
      assert.deepEqual(probed.models, [{ id: "claude-opus-4-8" }]);

      const called = await callEndpoint({ endpoint, model: "claude-opus-4-8", user: "u" }, server);
      assert.equal(called.ok, true, `${baseUrl} tested green, so it must also CALL green`);
      assert.equal(called.text, "hi");
    }
  });
});
