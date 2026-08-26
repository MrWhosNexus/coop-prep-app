/**
 * test/ai.test.js
 * Coverage for lib/ai/config.js, lib/ai/fill-prompt.js,
 * lib/ai/sanitize.js, and lib/ai/client.js.
 *
 * Uses Node built-in test runner: `node --test test/ai.test.js`
 */

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  fillPrompt,
  estimateTokens,
  applyTokenGuard,
} from "../lib/ai/fill-prompt.js";

import { sanitizeResponse } from "../lib/ai/sanitize.js";

import {
  getAIConfig,
  setAIConfig,
  hasAIKey,
  ensureLegacyAIConfigMigrated,
  AI_PRESETS,
  DEFAULT_CONFIG,
} from "../lib/ai/config.js";

import { callLLM, pickDefaultEndpointId } from "../lib/ai/client.js";

/**
 * Read a repo source file as text — the only way to assert on JSX modules,
 * which node has no loader for.
 *
 * Comments are stripped: these tests assert on what the code DOES, and the
 * modules are allowed (encouraged) to describe the key leak they no longer have.
 */
function source(relPath) {
  return readFileSync(new URL(`../${relPath}`, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage helpers
// ─────────────────────────────────────────────────────────────────────────────

function installStorage() {
  const m = new Map();
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

function clearStorage() {
  // Replace with a fresh empty store so state never bleeds between tests.
  installStorage();
}

// ─────────────────────────────────────────────────────────────────────────────
// fillPrompt
// ─────────────────────────────────────────────────────────────────────────────

describe("fillPrompt", () => {
  test("all slots filled -> no {{ tokens remain", () => {
    const result = fillPrompt("Hello {{name}}, welcome to {{place}}!", {
      name: "Alice",
      place: "COOP",
    });
    assert.ok(!result.includes("{{"), "output should contain no {{ tokens");
    assert.ok(!result.includes("}}"), "output should contain no }} tokens");
    assert.equal(result, "Hello Alice, welcome to COOP!");
  });

  test("missing slot key -> '[not provided]', never 'undefined'", () => {
    const result = fillPrompt("Hello {{name}}, goal: {{goal}}", { name: "Bob" });
    assert.ok(
      result.includes("[not provided]"),
      "missing key should render as [not provided]"
    );
    assert.ok(
      !result.includes("undefined"),
      "undefined must never appear in output"
    );
  });

  test("empty-string slot -> '[not provided]'", () => {
    const result = fillPrompt("Value: {{val}}", { val: "" });
    assert.equal(result, "Value: [not provided]");
  });

  test("whitespace-only slot -> '[not provided]'", () => {
    const result = fillPrompt("Value: {{val}}", { val: "   " });
    assert.equal(result, "Value: [not provided]");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// estimateTokens
// ─────────────────────────────────────────────────────────────────────────────

describe("estimateTokens", () => {
  test("estimateTokens('abcd') === 1", () => {
    assert.equal(estimateTokens("abcd"), 1);
  });

  test("known longer string matches Math.ceil(len/4)", () => {
    const s = "Hello, world! This is a test string for token estimation.";
    assert.equal(estimateTokens(s), Math.ceil(s.length / 4));
  });

  test("empty string -> 0", () => {
    assert.equal(estimateTokens(""), 0);
  });

  test("exactly divisible by 4 -> no ceiling needed", () => {
    // 8 chars / 4 = 2 exactly
    assert.equal(estimateTokens("abcdefgh"), 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyTokenGuard
// ─────────────────────────────────────────────────────────────────────────────

describe("applyTokenGuard", () => {
  test("under budget -> truncated:false and prompt unchanged", () => {
    const short = "This is a short prompt.";
    const result = applyTokenGuard(short, 600);
    assert.equal(result.truncated, false);
    assert.equal(result.prompt, short);
  });

  test("over budget -> truncated:true, prompt contains '[truncated for length]'", () => {
    // ~5000 chars guarantees we're well over 600 tokens (600*4 = 2400 chars)
    const big = "x".repeat(5000);
    const result = applyTokenGuard(big, 600);
    assert.equal(result.truncated, true);
    assert.ok(
      result.prompt.includes("[truncated for length]"),
      "result.prompt must contain [truncated for length]"
    );
  });

  test("over budget -> estimateTokens(result.prompt) <= 600", () => {
    const big = "word ".repeat(1500); // ~7500 chars
    const result = applyTokenGuard(big, 600);
    assert.ok(
      estimateTokens(result.prompt) <= 600,
      `token count ${estimateTokens(result.prompt)} should be <= 600`
    );
  });

  test("at exactly budget boundary -> not truncated", () => {
    // 2400 chars = exactly 600 tokens
    const exact = "a".repeat(2400);
    const result = applyTokenGuard(exact, 600);
    assert.equal(result.truncated, false);
    assert.equal(result.prompt, exact);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// sanitizeResponse
// ─────────────────────────────────────────────────────────────────────────────

describe("sanitizeResponse", () => {
  test("script tag is removed, surrounding text is kept", () => {
    const result = sanitizeResponse("<script>alert(1)</script>hello");
    assert.ok(!result.includes("<script"), "no <script in output");
    assert.ok(result.includes("hello"), "non-script content preserved");
  });

  test("executable ```js fenced block -> '[code block removed]'", () => {
    const result = sanitizeResponse("x\n```js\nconsole.log(1)\n```\ny");
    assert.ok(
      result.includes("[code block removed]"),
      "js fence should become [code block removed]"
    );
    assert.ok(!result.includes("console.log"), "code body must be stripped");
  });

  test("```json fenced block -> kept intact (output still contains '```json')", () => {
    const input = 'Here:\n```json\n{"x":1}\n```\nDone.';
    const result = sanitizeResponse(input);
    assert.ok(
      result.includes("```json"),
      "json fence should be preserved"
    );
    assert.ok(result.includes('{"x":1}'), "json content should be preserved");
  });

  test("on-event attribute is removed from HTML element", () => {
    const result = sanitizeResponse('<a onclick="x()">link</a>');
    assert.ok(
      !result.includes("onclick"),
      "onclick attribute must be removed"
    );
    assert.ok(result.includes("link"), "element text content preserved");
  });

  test("control character (\\x01) is stripped", () => {
    const result = sanitizeResponse("a\x01b");
    assert.equal(result, "ab");
  });

  test("plain prose with newlines is preserved", () => {
    const prose = "First line.\nSecond line.\nThird line.";
    const result = sanitizeResponse(prose);
    assert.equal(result, prose);
  });

  test("null/undefined -> empty string", () => {
    assert.equal(sanitizeResponse(null), "");
    assert.equal(sanitizeResponse(undefined), "");
    assert.equal(sanitizeResponse(""), "");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// config (with injected globalThis.localStorage)
// ─────────────────────────────────────────────────────────────────────────────

describe("config", () => {
  beforeEach(() => clearStorage());

  test("empty storage -> getAIConfig() deep-matches DEFAULT_CONFIG", () => {
    const cfg = getAIConfig();
    assert.deepEqual(cfg, DEFAULT_CONFIG);
  });

  test("setAIConfig merges correctly: apiKey set, other keys remain default", () => {
    setAIConfig({ apiKey: "sk-test" });
    const cfg = getAIConfig();
    assert.equal(cfg.apiKey, "sk-test");
    assert.equal(cfg.endpoint, DEFAULT_CONFIG.endpoint);
    assert.equal(cfg.model, DEFAULT_CONFIG.model);
  });

  test("hasAIKey() false when storage is empty", () => {
    assert.equal(hasAIKey(), false);
  });

  test("hasAIKey() false when key is whitespace only", () => {
    setAIConfig({ apiKey: "   " });
    assert.equal(hasAIKey(), false);
  });

  test("hasAIKey() true after setting a real non-empty key", () => {
    setAIConfig({ apiKey: "sk-realkey" });
    assert.equal(hasAIKey(), true);
  });

  test("corrupt JSON in storage -> getAIConfig() falls back to DEFAULT_CONFIG without throwing", () => {
    globalThis.localStorage.setItem("coop_ai_v1", "{not json");
    let cfg;
    assert.doesNotThrow(() => {
      cfg = getAIConfig();
    });
    assert.deepEqual(cfg, DEFAULT_CONFIG);
  });

  test("AI_PRESETS ids are exactly ollama/openai/custom", () => {
    const ids = AI_PRESETS.map((p) => p.id);
    assert.deepEqual(ids, ["ollama", "openai", "custom"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ensureLegacyAIConfigMigrated — the migration must not depend on Settings
// being opened, and concurrent AI surfaces must not double-add the endpoint.
// ─────────────────────────────────────────────────────────────────────────────

describe("ensureLegacyAIConfigMigrated", () => {
  beforeEach(() => clearStorage());

  function recordingPort() {
    const added = [];
    return {
      added,
      add: async (draft) => {
        added.push(draft);
        return { ok: true, endpoint: { id: "ep-1", label: draft.label, baseUrl: draft.baseUrl, hasKey: true } };
      },
    };
  }

  test("migrates once and scrubs the localStorage key", async () => {
    setAIConfig({ apiKey: "sk-legacy", endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-4o" });
    const port = recordingPort();

    const res = await ensureLegacyAIConfigMigrated(port);
    assert.equal(res.migrated, true);
    assert.equal(port.added.length, 1);
    assert.equal(port.added[0].apiKey, "sk-legacy");
    assert.equal(hasAIKey(), false, "the renderer copy of the key is gone");
  });

  test("concurrent callers (two AI surfaces mounting at once) add the endpoint exactly once", async () => {
    setAIConfig({ apiKey: "sk-legacy", endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-4o" });
    const port = recordingPort();

    const [a, b] = await Promise.all([
      ensureLegacyAIConfigMigrated(port),
      ensureLegacyAIConfigMigrated(port),
    ]);
    assert.equal(port.added.length, 1, "the key must not be added twice");
    assert.equal(a.migrated || b.migrated, true);
  });

  test("no key -> no-op without touching the port", async () => {
    const port = recordingPort();
    const res = await ensureLegacyAIConfigMigrated(port);
    assert.equal(res.migrated, false);
    assert.equal(port.added.length, 0);
  });

  test("a failed migration keeps the key and stays retryable", async () => {
    setAIConfig({ apiKey: "sk-legacy", endpoint: "https://api.openai.com/v1/chat/completions" });
    let attempts = 0;
    const flaky = {
      add: async () => {
        attempts += 1;
        return attempts === 1 ? { ok: false, error: { type: "VALIDATION_ERROR" } } : { ok: true, endpoint: { id: "ep-1", hasKey: true } };
      },
    };

    const first = await ensureLegacyAIConfigMigrated(flaky);
    assert.equal(first.migrated, false);
    assert.equal(hasAIKey(), true, "a failed migration must NOT scrub the only copy of the key");

    const second = await ensureLegacyAIConfigMigrated(flaky);
    assert.equal(second.migrated, true, "the failure must not be memoized forever");
    assert.equal(hasAIKey(), false);
  });

  test("a rejecting port is swallowed, not thrown at the mounting component", async () => {
    setAIConfig({ apiKey: "sk-legacy", endpoint: "https://api.openai.com/v1/chat/completions" });
    const res = await ensureLegacyAIConfigMigrated({
      add: async () => {
        throw new Error("ipc blew up");
      },
    });
    assert.equal(res.migrated, false);
    assert.equal(hasAIKey(), true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// pickDefaultEndpointId — the tool's gate must agree with the Dashboard badge,
// which lights on `endpoints.some(e => e.hasKey)`.
// ─────────────────────────────────────────────────────────────────────────────

describe("pickDefaultEndpointId", () => {
  test("empty / non-array -> ''", () => {
    assert.equal(pickDefaultEndpointId([]), "");
    assert.equal(pickDefaultEndpointId(undefined), "");
    assert.equal(pickDefaultEndpointId(null), "");
  });

  test("prefers a keyed endpoint over an earlier keyless one", () => {
    const id = pickDefaultEndpointId([
      { id: "a", hasKey: false },
      { id: "b", hasKey: true },
    ]);
    assert.equal(id, "b");
  });

  test("falls back to the first endpoint when none is keyed (local runtimes need no key)", () => {
    assert.equal(pickDefaultEndpointId([{ id: "ollama" }, { id: "b" }]), "ollama");
  });

  test("INVARIANT: whenever the badge lights, the tool has an endpoint to call", () => {
    const lists = [
      [{ id: "a", hasKey: true }],
      [{ id: "a", hasKey: false }, { id: "b", hasKey: true }],
      [{ id: "a", hasKey: true }, { id: "b", hasKey: true }],
    ];
    for (const list of lists) {
      const badgeOn = list.some((e) => e.hasKey); // components/Dashboard.js#refreshAiOn
      assert.equal(badgeOn, true);
      assert.notEqual(
        pickDefaultEndpointId(list),
        "",
        "badge on but the tool has no endpoint == the Settings bounce loop"
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// callLLM — the renderer holds no key and makes no fetch; every call goes over
// the ai:call IPC bridge, exactly like components/notes/LessonBuilder.js.
// ─────────────────────────────────────────────────────────────────────────────

describe("callLLM (bridge path)", () => {
  beforeEach(() => clearStorage());

  /** A fake window.coop whose ai.call replays `script(request)` on the stream. */
  function makeBridge(script) {
    const listeners = new Set();
    const calls = [];
    const bridge = {
      ai: {
        call: async (req) => {
          calls.push(req);
          setTimeout(() => {
            for (const evt of script(req)) {
              for (const cb of [...listeners]) cb(evt);
            }
          }, 0);
          return { requestId: req.requestId, started: true };
        },
        onStream: (cb) => {
          listeners.add(cb);
          return () => listeners.delete(cb);
        },
      },
    };
    return { bridge, calls, listenerCount: () => listeners.size };
  }

  const okScript = (text) => (req) => [
    { requestId: req.requestId, type: "chunk", delta: text },
    { requestId: req.requestId, type: "done" },
  ];

  test("NO_BRIDGE: no window.coop -> { ok:false, error:{ type:'NO_BRIDGE' } } and no fetch", async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = () => {
      fetchCalled = true;
      throw new Error("the renderer must never fetch an LLM directly");
    };
    try {
      const result = await callLLM({ system: "sys", user: "hello", endpointId: "ep-1", model: "m" }, null);
      assert.equal(result.ok, false);
      assert.equal(result.error.type, "NO_BRIDGE");
      assert.equal(fetchCalled, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("NO_ENDPOINT: missing endpointId or model -> no IPC call at all", async () => {
    const { bridge, calls } = makeBridge(okScript("x"));

    const noEp = await callLLM({ system: "s", user: "u", endpointId: "", model: "m" }, bridge);
    assert.equal(noEp.ok, false);
    assert.equal(noEp.error.type, "NO_ENDPOINT");

    const noModel = await callLLM({ system: "s", user: "u", endpointId: "ep-1", model: "" }, bridge);
    assert.equal(noModel.ok, false);
    assert.equal(noModel.error.type, "NO_ENDPOINT");

    assert.equal(calls.length, 0, "ai:call must not be invoked without an endpoint and model");
  });

  test("Success: streamed chunks -> { ok:true, text } with no warning, and the listener is released", async () => {
    const { bridge, calls, listenerCount } = makeBridge((req) => [
      { requestId: req.requestId, type: "chunk", delta: "Dear " },
      { requestId: req.requestId, type: "chunk", delta: "Team," },
      { requestId: req.requestId, type: "done" },
    ]);

    const result = await callLLM({ system: "sys", user: "help me", endpointId: "ep-1", model: "m" }, bridge);
    assert.equal(result.ok, true);
    assert.equal(result.text, "Dear Team,");
    assert.equal(result.warning, undefined, "no warning expected on clean success");
    assert.equal(listenerCount(), 0, "the ai:stream listener must be unsubscribed");

    assert.equal(calls.length, 1);
    assert.equal(calls[0].endpointId, "ep-1");
    assert.equal(calls[0].model, "m");
    assert.ok(calls[0].requestId, "a requestId is required by electron/ipc/validators.js");
    assert.deepEqual(calls[0].messages, [
      { role: "system", content: "sys" },
      { role: "user", content: "help me" },
    ]);
  });

  test("KEY ISOLATION: a legacy localStorage key is never read, never sent, never fetched", async () => {
    setAIConfig({
      apiKey: "sk-leaky-secret",
      endpoint: "https://api.test/v1/chat/completions",
      model: "m",
    });

    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = () => {
      fetchCalled = true;
      throw new Error("the renderer must never fetch an LLM directly");
    };
    try {
      const { bridge, calls } = makeBridge(okScript("ok"));
      const result = await callLLM({ system: "sys", user: "hi", endpointId: "ep-1", model: "m" }, bridge);

      assert.equal(result.ok, true);
      assert.equal(fetchCalled, false, "no renderer-side fetch may happen");
      const wire = JSON.stringify(calls[0]);
      assert.ok(!wire.includes("sk-leaky-secret"), "the key must not cross the IPC boundary");
      assert.ok(!/authorization/i.test(wire), "the renderer must not build an Authorization header");
      assert.ok(!JSON.stringify(result).includes("sk-leaky-secret"), "the key must not be in the result");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("API_ERROR: an error event -> { ok:false, error:{ type:'API_ERROR', message } }", async () => {
    const { bridge } = makeBridge((req) => [
      { requestId: req.requestId, type: "error", error: "Provider said 401" },
    ]);

    const result = await callLLM({ system: "s", user: "u", endpointId: "ep-1", model: "m" }, bridge);
    assert.equal(result.ok, false);
    assert.equal(result.error.type, "API_ERROR");
    assert.equal(result.error.message, "Provider said 401");
  });

  test("a structured error event is passed through unchanged", async () => {
    const { bridge } = makeBridge((req) => [
      { requestId: req.requestId, type: "error", error: { type: "AUTH_ERROR", message: "no key", hint: "Add one in Settings." } },
    ]);

    const result = await callLLM({ system: "s", user: "u", endpointId: "ep-1", model: "m" }, bridge);
    assert.equal(result.ok, false);
    assert.equal(result.error.type, "AUTH_ERROR");
    assert.equal(result.error.hint, "Add one in Settings.");
  });

  test("IPC_ERROR: ai.call rejects -> { ok:false, error:{ type:'IPC_ERROR' } } and the listener is released", async () => {
    const listeners = new Set();
    const bridge = {
      ai: {
        call: async () => {
          throw new Error("channel closed");
        },
        onStream: (cb) => {
          listeners.add(cb);
          return () => listeners.delete(cb);
        },
      },
    };

    const result = await callLLM({ system: "s", user: "u", endpointId: "ep-1", model: "m" }, bridge);
    assert.equal(result.ok, false);
    assert.equal(result.error.type, "IPC_ERROR");
    assert.equal(result.error.message, "channel closed");
    assert.equal(listeners.size, 0, "the ai:stream listener must be unsubscribed");
  });

  test("events for another in-flight requestId are ignored", async () => {
    const { bridge } = makeBridge((req) => [
      { requestId: "someone-else", type: "chunk", delta: "NOT MINE" },
      { requestId: "someone-else", type: "done" },
      { requestId: req.requestId, type: "chunk", delta: "mine" },
      { requestId: req.requestId, type: "done" },
    ]);

    const result = await callLLM({ system: "s", user: "u", endpointId: "ep-1", model: "m" }, bridge);
    assert.equal(result.ok, true);
    assert.equal(result.text, "mine");
  });

  test("the streamed text is sanitized before it reaches the UI", async () => {
    const { bridge } = makeBridge(okScript("<script>alert(1)</script>Dear Team,"));
    const result = await callLLM({ system: "s", user: "u", endpointId: "ep-1", model: "m" }, bridge);
    assert.equal(result.ok, true);
    assert.ok(!result.text.includes("<script"), "no <script in output");
    assert.ok(result.text.includes("Dear Team,"), "prose preserved");
  });

  test("TOKEN_LIMIT: very long user input -> warning, and the TRUNCATED prompt is what's sent", async () => {
    const { bridge, calls } = makeBridge(okScript("Response text."));
    const longUser = "word ".repeat(1500); // ~7500 chars, > 600 tokens

    const result = await callLLM({ system: "sys", user: longUser, endpointId: "ep-1", model: "m" }, bridge);
    assert.equal(result.ok, true);
    assert.equal(typeof result.text, "string");
    assert.ok(result.warning, "warning should be present");
    assert.equal(result.warning.type, "TOKEN_LIMIT");

    const sent = calls[0].messages.find((m) => m.role === "user").content;
    assert.ok(sent.includes("[truncated for length]"), "the guarded prompt is the one sent over IPC");
    assert.ok(sent.length < longUser.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// THE REPRO, end to end: a pre-Phase-2 user with coop_ai_v1={apiKey:'sk-…'}
// launches the desktop app and opens the Cover Letter Builder, never visiting
// Settings. This replays CoverLetterTool's mount effects against the real
// config + client modules and a fake main process.
// ─────────────────────────────────────────────────────────────────────────────

describe("REPRO: the legacy-key user who never opens Settings", () => {
  beforeEach(() => clearStorage());

  /** A fake main process: it holds the keys, and hands out key-free views. */
  function fakeMain() {
    const stored = [];
    const wire = [];
    return {
      stored,
      wire,
      endpoints: {
        add: async (draft) => {
          stored.push({ id: `ep-${stored.length + 1}`, ...draft });
          const { apiKey, ...view } = stored[stored.length - 1];
          return { ok: true, endpoint: { ...view, hasKey: !!apiKey } };
        },
        list: async () => stored.map(({ apiKey, ...view }) => ({ ...view, hasKey: !!apiKey })),
        models: async () => ["gpt-4o"],
      },
      ai: {
        call: async (req) => {
          wire.push(req);
          // Only the MAIN process may attach the key — prove it still can.
          const endpoint = stored.find((e) => e.id === req.endpointId);
          const authenticated = !!endpoint?.apiKey;
          setTimeout(() => {
            for (const cb of listeners) {
              cb({ requestId: req.requestId, type: "chunk", delta: authenticated ? "Dear Hiring Team," : "" });
              cb({ requestId: req.requestId, type: "done" });
            }
          }, 0);
          return { requestId: req.requestId, started: true };
        },
        onStream: (cb) => {
          listeners.add(cb);
          return () => listeners.delete(cb);
        },
      },
    };
  }
  const listeners = new Set();

  test("the key moves to the registry, leaves the renderer, and Enhance still works", async () => {
    // The pre-Phase-2 user, exactly as the finding describes them.
    setAIConfig({
      apiKey: "sk-legacy-live",
      endpoint: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4o",
    });
    const bridge = fakeMain();

    // ── CoverLetterTool mount effect #1: migrate, without Settings involved.
    const migration = await ensureLegacyAIConfigMigrated(bridge.endpoints);
    assert.equal(migration.migrated, true);

    // FINDING 1: no plaintext key is left anywhere in the renderer.
    assert.equal(hasAIKey(), false);
    assert.equal(getAIConfig().apiKey, "");
    assert.equal(globalThis.localStorage.getItem("coop_ai_v1").includes("sk-legacy-live"), false);
    // It is behind the port, in the main process, and the views never carry it.
    assert.equal(bridge.stored[0].apiKey, "sk-legacy-live");
    const views = await bridge.endpoints.list();
    assert.ok(!JSON.stringify(views).includes("sk-legacy-live"), "EndpointViews are key-free");

    // ── mount effect #2: endpoint discovery.
    const endpointId = pickDefaultEndpointId(views);

    // FINDING 9: the Dashboard badge's rule and the tool's gate now agree.
    const badgeOn = views.some((e) => e.hasKey);
    assert.equal(badgeOn, true, "the badge lights");
    assert.notEqual(endpointId, "", "and the tool has an endpoint — no bounce to Settings");

    // FINDING 3: the tool the migration migrated away from is NOT orphaned.
    const result = await callLLM(
      { system: "sys", user: "enhance my letter", endpointId, model: "gpt-4o" },
      bridge
    );
    assert.equal(result.ok, true);
    assert.equal(result.text, "Dear Hiring Team,", "the main process authenticated with the migrated key");
    assert.ok(!JSON.stringify(bridge.wire).includes("sk-legacy-live"), "the key never crossed IPC");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// THE SECURITY INVARIANT, asserted against the renderer sources themselves.
// node has no JSX loader, so the components are read as text.
// ─────────────────────────────────────────────────────────────────────────────

describe("no plaintext API key is reachable from renderer code", () => {
  test("lib/ai/client.js neither reads the stored key nor fetches", () => {
    const src = source("lib/ai/client.js");
    assert.ok(!/Authorization/i.test(src), "client.js must not build an Authorization header");
    assert.ok(!/Bearer/.test(src), "client.js must not build a Bearer token");
    assert.ok(!/getAIConfig|hasAIKey/.test(src), "client.js must not read the legacy key store");
    assert.ok(!/\bfetch\b/.test(src), "client.js must not fetch — the main process owns the network call");
  });

  test("components/tools/CoverLetterTool.js goes through the bridge, not the key store", () => {
    const src = source("components/tools/CoverLetterTool.js");
    assert.ok(!/hasAIKey|getAIConfig|setAIConfig/.test(src), "the tool must not touch the legacy key store");
    assert.ok(!/Authorization|Bearer/i.test(src), "the tool must not build an auth header");
    assert.ok(/window\.coop|getBridge\(\)/.test(src), "the tool must reach AI through the window.coop bridge");
    assert.ok(/ensureLegacyAIConfigMigrated/.test(src), "an AI surface must migrate a legacy key even if Settings is never opened");
  });

  test("components/Settings.js offers no form that writes a plaintext key into this renderer", () => {
    const src = source("components/Settings.js");
    assert.ok(!/setAIConfig/.test(src), "Settings must not persist a key into localStorage");
    assert.ok(!/type=\{showKey \? "text" : "password"\}/.test(src), "the legacy key field must be gone");
  });

  test("the cover letter tool still assembles a draft offline, with no key and no bridge", () => {
    const src = source("components/tools/CoverLetterTool.js");
    assert.ok(
      /aiResponse \|\| assembleCoverLetter\(fields\)/.test(src),
      "the offline assembler must remain the unconditional fallback output"
    );
  });
});
