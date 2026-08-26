/**
 * test/endpoints-ui.test.js
 * Coverage for components/settings/endpoints-ui.js — the pure view-model layer
 * behind the endpoints settings panel.
 *
 * The JSX components are not imported here: node has no JSX loader. That is why
 * every decision worth asserting on lives in endpoints-ui.js.
 *
 * Uses Node built-in test runner: `node --test test/endpoints-ui.test.js`
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  CUSTOM_PROVIDER_ID,
  LOCAL_RUNTIMES,
  MODEL_PRICING,
  SAVED_KEY_MASK,
  describeKeyState,
  describeTestResult,
  formatModelPrice,
  isEndpointEnabled,
  isLocalUrl,
  labelForUrl,
  localRuntimeForUrl,
  localScanTargets,
  pickerStateForUrl,
  priceForModel,
  pruneDisabledIds,
  seedUrlForProvider,
  toggleEndpointEnabled,
  validateDraft,
} from "../components/settings/endpoints-ui.js";

import { PROVIDERS } from "../lib/endpoints/providers.js";

/* ───────────────────────── validateDraft ───────────────────────── */

describe("validateDraft", () => {
  test("accepts a bare URL and derives the label from the provider preset", () => {
    const result = validateDraft({ baseUrl: "https://api.openai.com/v1" });
    assert.equal(result.ok, true);
    assert.equal(result.draft.label, "OpenAI");
    assert.equal(result.draft.providerId, "openai");
  });

  test("a typed label wins over the derived one", () => {
    const result = validateDraft({ baseUrl: "https://api.openai.com/v1", label: "Work key" });
    assert.equal(result.ok, true);
    assert.equal(result.draft.label, "Work key");
  });

  test("derives a label from the host for an unrecognised URL", () => {
    const result = validateDraft({ baseUrl: "https://llm.example.com/v1" });
    assert.equal(result.ok, true);
    assert.equal(result.draft.label, "llm.example.com");
    assert.equal(result.draft.providerId, CUSTOM_PROVIDER_ID);
  });

  test("derives a label from a known local runtime", () => {
    const result = validateDraft({ baseUrl: "http://localhost:11434/v1" });
    assert.equal(result.ok, true);
    assert.equal(result.draft.label, "Ollama");
  });

  test("rejects an empty URL", () => {
    const result = validateDraft({ baseUrl: "" });
    assert.equal(result.ok, false);
    assert.equal(result.field, "baseUrl");
  });

  test("rejects a non-absolute URL", () => {
    const result = validateDraft({ baseUrl: "localhost:11434" });
    assert.equal(result.ok, false);
    assert.equal(result.field, "baseUrl");
  });

  test("rejects a non-http protocol", () => {
    const result = validateDraft({ baseUrl: "ftp://example.com" });
    assert.equal(result.ok, false);
    assert.match(result.message, /http/i);
  });

  // An absent key is VALID: local runtimes need none, and a keyless remote
  // endpoint must be allowed to exist so it can fail honestly with a real 401.
  test("a missing key is valid — keyless endpoints must be allowed to exist", () => {
    const result = validateDraft({ baseUrl: "https://api.openai.com/v1" });
    assert.equal(result.ok, true);
    assert.equal(result.draft.apiKey, "");
  });

  test("trims the key and the URL", () => {
    const result = validateDraft({ baseUrl: "  https://api.openai.com/v1/  ", apiKey: "  sk-abc  " });
    assert.equal(result.ok, true);
    assert.equal(result.draft.baseUrl, "https://api.openai.com/v1");
    assert.equal(result.draft.apiKey, "sk-abc");
  });

  test("honours the registry's own validator (one source of truth for validity)", () => {
    // A URL the registry rejects must never be accepted by the UI.
    assert.equal(validateDraft({ baseUrl: "not a url" }).ok, false);
  });
});

/* ───────────────────────── key state (THE INVARIANT) ───────────────────────── */

describe("describeKeyState", () => {
  test("an endpoint with a key renders a mask, never a value", () => {
    const state = describeKeyState({ hasKey: true, baseUrl: "https://api.openai.com/v1" });
    assert.equal(state.hasKey, true);
    assert.equal(state.text, SAVED_KEY_MASK);
    assert.match(state.text, /saved/);
  });

  test("a keyless REMOTE endpoint is called out as actionable", () => {
    const state = describeKeyState({ hasKey: false, baseUrl: "https://api.openai.com/v1" });
    assert.equal(state.tone, "warn");
    assert.equal(state.actionable, true);
    assert.match(state.text, /401/);
  });

  test("a keyless LOCAL endpoint is normal, not a warning", () => {
    const state = describeKeyState({ hasKey: false, baseUrl: "http://localhost:11434/v1" });
    assert.equal(state.tone, "muted");
    assert.equal(state.actionable, false);
  });

  // The structural guarantee: describeKeyState takes an EndpointView, which has
  // no apiKey field. Even handed a (malformed) object carrying one, it cannot
  // leak it — nothing reads that property.
  test("cannot surface a key even if one is wrongly present on the input", () => {
    const leaky = { hasKey: true, baseUrl: "https://api.openai.com/v1", apiKey: "sk-SECRET-VALUE" };
    const state = describeKeyState(leaky);
    assert.equal(JSON.stringify(state).includes("sk-SECRET-VALUE"), false);
    assert.equal(state.text, SAVED_KEY_MASK);
  });
});

/* ───────────────────────── picker state ───────────────────────── */

describe("pickerStateForUrl", () => {
  test("a preset URL selects that provider", () => {
    const state = pickerStateForUrl("https://api.anthropic.com");
    assert.equal(state.providerId, "anthropic");
    assert.equal(state.label, "Anthropic");
    assert.equal(state.isCustom, false);
  });

  // The nicest part of the Nexus design: the URL is the only source of truth,
  // so editing it away from a preset degrades the control on its own.
  test("editing the URL away from a preset degrades to Custom URL", () => {
    const state = pickerStateForUrl("https://api.anthropic.com/nope");
    assert.equal(state.providerId, CUSTOM_PROVIDER_ID);
    assert.equal(state.label, "Custom URL");
    assert.equal(state.isCustom, true);
  });

  test("an empty URL is Custom, not a silently pinned preset", () => {
    assert.equal(pickerStateForUrl("").isCustom, true);
  });

  test("a trailing slash still matches its preset", () => {
    assert.equal(pickerStateForUrl("https://api.openai.com/v1/").providerId, "openai");
  });
});

describe("seedUrlForProvider", () => {
  test("picking a provider seeds its base URL", () => {
    assert.equal(seedUrlForProvider("openai"), "https://api.openai.com/v1");
  });

  test("picking Custom URL clears the field rather than leaving a stale preset URL", () => {
    assert.equal(seedUrlForProvider(CUSTOM_PROVIDER_ID), "");
  });

  test("an unknown provider id seeds nothing", () => {
    assert.equal(seedUrlForProvider("nope"), "");
  });

  // Round-trip: every preset's seeded URL must select that same preset back.
  // If this breaks, the picker would show a label that disagrees with the URL.
  test("every preset round-trips seed -> pickerState", () => {
    for (const provider of PROVIDERS) {
      if (provider.id === CUSTOM_PROVIDER_ID) continue;
      const seeded = seedUrlForProvider(provider.id);
      assert.equal(pickerStateForUrl(seeded).providerId, provider.id, `round-trip failed for ${provider.id}`);
    }
  });

  // Guards the design rule at the data level, not just in prose.
  test("no provider preset carries a model id", () => {
    for (const provider of PROVIDERS) {
      assert.equal("model" in provider, false, `${provider.id} must not carry a model`);
      assert.equal("modelId" in provider, false, `${provider.id} must not carry a modelId`);
      assert.equal("models" in provider, false, `${provider.id} must not carry a model list`);
    }
  });
});

/* ───────────────────────── local runtimes ───────────────────────── */

describe("local runtimes", () => {
  test("scan targets cover the documented runtimes", () => {
    const targets = localScanTargets();
    assert.equal(targets.length, LOCAL_RUNTIMES.length);
    assert.ok(targets.includes("http://localhost:11434/v1")); // Ollama
    assert.ok(targets.includes("http://localhost:1234/v1")); // LM Studio
    assert.ok(targets.includes("http://localhost:8080/v1")); // llama.cpp
    assert.ok(targets.includes("http://localhost:8000/v1")); // vLLM
    assert.ok(targets.includes("http://localhost:5000/v1")); // text-gen-webui
  });

  test("every runtime has a distinct port", () => {
    const ports = LOCAL_RUNTIMES.map((r) => r.port);
    assert.equal(new Set(ports).size, ports.length);
  });

  test("localRuntimeForUrl identifies a runtime by URL", () => {
    assert.equal(localRuntimeForUrl("http://localhost:1234/v1").label, "LM Studio");
    assert.equal(localRuntimeForUrl("https://api.openai.com/v1"), null);
  });

  test("isLocalUrl recognises loopback hosts", () => {
    assert.equal(isLocalUrl("http://localhost:11434/v1"), true);
    assert.equal(isLocalUrl("http://127.0.0.1:8080/v1"), true);
    assert.equal(isLocalUrl("https://api.openai.com/v1"), false);
    assert.equal(isLocalUrl("garbage"), false);
  });

  test("labelForUrl prefers a provider label, then a runtime, then the host", () => {
    assert.equal(labelForUrl("https://whatever.example", "Anthropic"), "Anthropic");
    assert.equal(labelForUrl("http://localhost:8000/v1"), "vLLM");
    assert.equal(labelForUrl("https://llm.example.com/v1"), "llm.example.com");
  });
});

/* ───────────────────────── pricing ───────────────────────── */

describe("model pricing", () => {
  // Verified against the Anthropic model reference on 2026-07-15.
  test("prices the three current Anthropic models", () => {
    const at = new Date("2026-07-15T12:00:00Z");
    assert.deepEqual(priceForModel("claude-fable-5", at), { input: 10, output: 50, intro: false });
    assert.deepEqual(priceForModel("claude-opus-4-8", at), { input: 5, output: 25, intro: false });
  });

  test("claude-sonnet-5 shows the intro price while it is live", () => {
    const during = new Date("2026-07-15T12:00:00Z");
    const price = priceForModel("claude-sonnet-5", during);
    assert.equal(price.intro, true);
    assert.equal(price.input, 2);
    assert.equal(price.output, 10);
  });

  test("the intro price is still live on its final day", () => {
    const lastDay = new Date("2026-08-31T23:00:00Z");
    assert.equal(priceForModel("claude-sonnet-5", lastDay).intro, true);
  });

  // A lapsed promo must not keep advertising a price the user will not be charged.
  test("claude-sonnet-5 reverts to list price once the intro lapses", () => {
    const after = new Date("2026-09-01T00:00:01Z");
    const price = priceForModel("claude-sonnet-5", after);
    assert.equal(price.intro, false);
    assert.equal(price.input, 3);
    assert.equal(price.output, 15);
  });

  test("an unknown model has no price rather than a guessed one", () => {
    assert.equal(priceForModel("llama3:70b"), null);
    assert.equal(formatModelPrice("llama3:70b"), "");
    assert.equal(formatModelPrice(""), "");
    assert.equal(formatModelPrice(undefined), "");
  });

  test("formatModelPrice reads as a price tag", () => {
    const at = new Date("2026-07-15T12:00:00Z");
    assert.equal(formatModelPrice("claude-opus-4-8", at), "$5 / $25 per Mtok");
    assert.match(formatModelPrice("claude-sonnet-5", at), /^\$2 \/ \$10 per Mtok · intro thru 2026-08-31$/);
  });

  test("pricing is display-only annotation, keyed by discovered id", () => {
    // The table must never be treated as a model list: it exists to annotate a
    // model that discovery already returned.
    assert.deepEqual(Object.keys(MODEL_PRICING).sort(), [
      "claude-fable-5",
      "claude-opus-4-8",
      "claude-sonnet-5",
    ]);
  });
});

/* ───────────────────────── test-result copy ───────────────────────── */

describe("describeTestResult", () => {
  test("a successful probe reports the model count", () => {
    const result = describeTestResult({ ok: true, models: [{ id: "a" }, { id: "b" }] });
    assert.equal(result.tone, "ok");
    assert.match(result.text, /2 models/);
  });

  test("singular phrasing for one model", () => {
    assert.match(describeTestResult({ ok: true, models: [{ id: "a" }] }).text, /1 model available/);
  });

  // THE POINT OF THE TEST BUTTON: a 401 must reach the user as "bad key".
  // Flattening it into a connection error sends them to debug the wrong field.
  test("a 401 surfaces as a rejected key, never as a connection problem", () => {
    const result = describeTestResult({
      ok: false,
      error: { type: "AUTH_ERROR", status: 401, message: "invalid x-api-key", hint: "Update the key." },
    });
    assert.equal(result.tone, "error");
    assert.match(result.text, /401/);
    assert.match(result.text, /rejected/i);
    assert.doesNotMatch(result.text, /could not reach/i);
    assert.equal(result.hint, "Update the key.");
  });

  test("a 403 is distinguished from a 401 — different fix", () => {
    const result = describeTestResult({
      ok: false,
      error: { type: "AUTH_ERROR", status: 403, message: "" },
    });
    assert.match(result.text, /403/);
    assert.match(result.text, /not permitted/i);
  });

  test("a keyless 401 keeps probe.js's actionable hint pointing at this panel", () => {
    const result = describeTestResult({
      ok: false,
      error: {
        type: "AUTH_ERROR",
        status: 401,
        message: "",
        hint: "This endpoint has no API key. Add one in Settings → AI Endpoints.",
      },
    });
    assert.match(result.hint, /no API key/);
  });

  test("a network failure reads as a reachability problem", () => {
    const result = describeTestResult({ ok: false, error: { type: "NETWORK_ERROR" } });
    assert.match(result.text, /could not reach/i);
    assert.match(result.hint, /base URL/i);
  });

  test("a 404 points at the URL, not the key", () => {
    const result = describeTestResult({ ok: false, error: { type: "API_ERROR", status: 404 } });
    assert.match(result.text, /404/);
    assert.match(result.hint, /base URL/i);
  });

  test("an unrecognised error still produces a sentence", () => {
    const result = describeTestResult({ ok: false, error: { type: "WAT", message: "odd" } });
    assert.equal(result.tone, "error");
    assert.match(result.text, /failed/i);
  });

  test("a malformed result does not throw", () => {
    assert.equal(describeTestResult(undefined).tone, "error");
    assert.equal(describeTestResult({ ok: false }).tone, "error");
  });
});

/* ───────────────────────── enable / disable ───────────────────────── */

describe("enable/disable", () => {
  test("an endpoint with no record is enabled by default", () => {
    assert.equal(isEndpointEnabled(undefined, "a"), true);
    assert.equal(isEndpointEnabled([], "a"), true);
  });

  test("a disabled id reads as disabled", () => {
    assert.equal(isEndpointEnabled(["a"], "a"), false);
    assert.equal(isEndpointEnabled(["a"], "b"), true);
  });

  test("toggle round-trips", () => {
    const off = toggleEndpointEnabled([], "a");
    assert.deepEqual(off, ["a"]);
    assert.deepEqual(toggleEndpointEnabled(off, "a"), []);
  });

  test("toggle never mutates its input", () => {
    const input = ["a"];
    const next = toggleEndpointEnabled(input, "b");
    assert.deepEqual(input, ["a"]);
    assert.deepEqual(next, ["a", "b"]);
  });

  // A stale id left behind by a delete could silently disable a future endpoint
  // that happens to reuse the id.
  test("pruneDisabledIds drops ids with no live endpoint", () => {
    assert.deepEqual(pruneDisabledIds(["a", "gone"], [{ id: "a" }, { id: "b" }]), ["a"]);
    assert.deepEqual(pruneDisabledIds(undefined, []), []);
  });
});
