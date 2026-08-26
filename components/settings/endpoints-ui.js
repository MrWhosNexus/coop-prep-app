// components/settings/endpoints-ui.js
// Pure view-model helpers for the endpoints settings UI.
//
// WHY THIS FILE EXISTS: the panel/picker files carry JSX, which `node --test`
// cannot parse (node has no JSX loader). Every decision worth asserting on —
// validation, key-state display, provider seeding, test-result phrasing, model
// pricing — therefore lives here, in a JSX-free module the test runner can
// import directly. The components stay thin and render what these return.
//
// THE INVARIANT, RESTATED: nothing here ever reads an apiKey back. A key is
// accepted only as a write-only draft value on its way out to the main process.
// describeKeyState() takes an EndpointView (which has `hasKey`, never `apiKey`)
// precisely so a key CANNOT be rendered even by mistake.
//
// Pure logic + injectable ports: no DOM globals, no fs, no network reached from
// here. The two functions that cause an effect (turnEndpointOff,
// removeLegacyAIConfig) take the port they act on as an argument, exactly as
// lib/endpoints/registry.js takes its storage — so they stay importable, and
// assertable, under `node --test`.

// Relative, not the "@/" alias: that alias is a bundler/editor convenience
// (jsconfig.json paths) and node does not resolve it. This module must import
// cleanly under `node --test`, so it uses real paths.
import { validateEndpointInput } from "../../lib/endpoints/registry.js";
import {
  CUSTOM_PROVIDER_ID,
  getProvider,
  normalizeBaseUrl,
  providerIdForUrl,
} from "../../lib/endpoints/providers.js";

/**
 * @typedef {object} LocalRuntime
 * @property {string} id
 * @property {string} label
 * @property {number} port
 * @property {string} baseUrl - The OpenAI-compatible base URL this runtime serves.
 */

/**
 * Local model runtimes the scanner knows how to look for.
 *
 * These are the default ports each runtime ships with. They are scan targets and
 * quick-fill buttons — NOT presets in the provider sense: a hit here is only
 * real if something actually answers on the port, which is what the scan proves.
 *
 * @type {ReadonlyArray<LocalRuntime>}
 */
export const LOCAL_RUNTIMES = Object.freeze([
  { id: "ollama",         label: "Ollama",         port: 11434, baseUrl: "http://localhost:11434/v1" },
  { id: "lmstudio",       label: "LM Studio",      port: 1234,  baseUrl: "http://localhost:1234/v1" },
  { id: "llamacpp",       label: "llama.cpp",      port: 8080,  baseUrl: "http://localhost:8080/v1" },
  { id: "vllm",           label: "vLLM",           port: 8000,  baseUrl: "http://localhost:8000/v1" },
  { id: "textgen-webui",  label: "text-gen-webui", port: 5000,  baseUrl: "http://localhost:5000/v1" },
]);

/**
 * The ordered list of base URLs a local scan should probe.
 *
 * @returns {string[]}
 */
export function localScanTargets() {
  return LOCAL_RUNTIMES.map((r) => r.baseUrl);
}

/**
 * Which local runtime (if any) a base URL corresponds to.
 *
 * @param {string} url
 * @returns {LocalRuntime|null}
 */
export function localRuntimeForUrl(url) {
  const normalized = normalizeBaseUrl(url);
  if (!normalized) return null;
  return LOCAL_RUNTIMES.find((r) => normalizeBaseUrl(r.baseUrl) === normalized) ?? null;
}

/**
 * Is this base URL a loopback address? Used to decide whether a missing key is
 * worth warning about — a local runtime legitimately needs none.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isLocalUrl(url) {
  let parsed;
  try {
    parsed = new URL(normalizeBaseUrl(url));
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0";
}

/**
 * A human label for an endpoint whose name the user did not type.
 *
 * Prefers the provider's own name, then a known local runtime's name, then the
 * URL host, then the raw string.
 *
 * @param {string} url
 * @param {string|null} [providerLabel]
 * @returns {string}
 */
export function labelForUrl(url, providerLabel = null) {
  if (providerLabel) return providerLabel;
  const local = localRuntimeForUrl(url);
  if (local) return local.label;
  try {
    return new URL(normalizeBaseUrl(url)).host;
  } catch {
    return normalizeBaseUrl(url);
  }
}

/**
 * Validate a draft endpoint from the add form.
 *
 * The label is auto-derived when the user did not type one, so that a bare URL
 * is a complete, valid draft — the URL is the only thing we genuinely require.
 *
 * NOTE the returned draft carries apiKey. It is built at submit time and handed
 * straight to the IPC call; it is never stored in component state or returned to
 * a render path. See EndpointsPanel's submit handlers.
 *
 * @param {{ label?: string, baseUrl?: string, apiKey?: string }} input
 * @returns {{ ok: true, draft: { label: string, baseUrl: string, apiKey: string, providerId: string } }
 *   | { ok: false, field: string, message: string }}
 */
export function validateDraft(input) {
  const baseUrl = normalizeBaseUrl(input?.baseUrl ?? "");

  // Check the URL BEFORE deriving the label. The label is derived FROM the URL,
  // so a bad URL also yields an empty label — validating both at once would
  // report the label error first and point the user at a "Name" field this
  // panel does not even have. The URL is the only thing they typed; it must be
  // the thing the error names. The placeholder label isolates the URL check.
  const urlInvalid = validateEndpointInput({ label: "-", baseUrl });
  if (urlInvalid) return { ok: false, field: "baseUrl", message: urlInvalid.message };

  const providerId = providerIdForUrl(baseUrl);
  const provider = getProvider(providerId);
  const providerLabel =
    provider && provider.id !== CUSTOM_PROVIDER_ID ? provider.label : null;

  const typedLabel = typeof input?.label === "string" ? input.label.trim() : "";
  const label = typedLabel || labelForUrl(baseUrl, providerLabel);

  // Re-run against the real label so the UI can never accept an endpoint the
  // registry would reject (two validators = two answers to the same question).
  const invalid = validateEndpointInput({ label, baseUrl });
  if (invalid) return { ok: false, field: invalid.field, message: invalid.message };

  return {
    ok: true,
    draft: {
      label,
      baseUrl,
      apiKey: typeof input?.apiKey === "string" ? input.apiKey.trim() : "",
      providerId,
    },
  };
}

/** Display string for an endpoint whose key is set. Never the key itself. */
export const SAVED_KEY_MASK = "••••••••••• (saved)";

/**
 * How to render the key field for an existing endpoint.
 *
 * Takes an EndpointView — which structurally cannot carry a key — so the "show
 * the saved key" mistake is impossible to make from here. `hasKey` is the only
 * thing the renderer ever learns about a key.
 *
 * @param {{ hasKey?: boolean, baseUrl?: string }} view
 * @returns {{ hasKey: boolean, text: string, tone: "ok"|"warn"|"muted", actionable: boolean }}
 */
export function describeKeyState(view) {
  if (view?.hasKey) {
    return { hasKey: true, text: SAVED_KEY_MASK, tone: "ok", actionable: false };
  }
  // A keyless LOCAL endpoint is normal, not a problem worth nagging about.
  if (isLocalUrl(view?.baseUrl ?? "")) {
    return { hasKey: false, text: "No key needed (local)", tone: "muted", actionable: false };
  }
  return {
    hasKey: false,
    text: "No API key — this endpoint will fail with 401",
    tone: "warn",
    actionable: true,
  };
}

/* ─────────────────────────── model pricing ─────────────────────────── */

/**
 * @typedef {object} ModelPrice
 * @property {number} input        - USD per million input tokens.
 * @property {number} output       - USD per million output tokens.
 * @property {number} [introInput] - Promotional input price, while it lasts.
 * @property {number} [introOutput]
 * @property {string} [introUntil] - ISO date the promo runs THROUGH (inclusive).
 */

/**
 * Per-million-token pricing for the models this app expects to meet on an
 * Anthropic-shaped endpoint.
 *
 * This is a DISPLAY-ONLY annotation keyed off a live-discovered model id — it is
 * emphatically not a model list. Presets carry no model IDs (see providers.js);
 * discovery decides what exists, and this table only adds a price tag when it
 * happens to recognise one. An unknown model renders with no price rather than a
 * guessed one.
 *
 * Verified against the Anthropic model reference on 2026-07-15.
 *
 * @type {Readonly<Record<string, ModelPrice>>}
 */
export const MODEL_PRICING = Object.freeze({
  "claude-fable-5":  { input: 10, output: 50 },
  "claude-opus-4-8": { input: 5,  output: 25 },
  "claude-sonnet-5": {
    input: 3,
    output: 15,
    introInput: 2,
    introOutput: 10,
    introUntil: "2026-08-31",
  },
});

/** Format a USD-per-Mtok number the way a price tag reads. */
function usd(amount) {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

/**
 * The price to show for a model right now.
 *
 * The intro price is applied only while it is actually in effect — a promo that
 * has lapsed must not keep advertising a price the user will not be charged.
 * `now` is injectable so this is testable across the boundary date.
 *
 * @param {string} modelId
 * @param {Date} [now]
 * @returns {{ input: number, output: number, intro: boolean, introUntil?: string }|null}
 */
export function priceForModel(modelId, now = new Date()) {
  const price = MODEL_PRICING[String(modelId ?? "").trim()];
  if (!price) return null;

  if (price.introUntil && price.introInput != null) {
    // Compare against end-of-day UTC on the last promo day: a promo running
    // "through 2026-08-31" is still live at 23:59 on the 31st.
    const expiresAt = Date.parse(`${price.introUntil}T23:59:59.999Z`);
    if (Number.isFinite(expiresAt) && now.getTime() <= expiresAt) {
      return {
        input: price.introInput,
        output: price.introOutput,
        intro: true,
        introUntil: price.introUntil,
      };
    }
  }
  return { input: price.input, output: price.output, intro: false };
}

/**
 * A short price label for a model row, or "" when the model is unknown to us.
 *
 * Cost per Mtok next to a model is genuinely load-bearing in a BYO-key app: the
 * user is paying this, not us.
 *
 * @param {string} modelId
 * @param {Date} [now]
 * @returns {string}
 */
export function formatModelPrice(modelId, now = new Date()) {
  const price = priceForModel(modelId, now);
  if (!price) return "";
  const base = `${usd(price.input)} / ${usd(price.output)} per Mtok`;
  return price.intro ? `${base} · intro thru ${price.introUntil}` : base;
}

/* ─────────────────────── test / probe result copy ─────────────────────── */

/**
 * Turn a probe result into the sentence the user reads.
 *
 * THIS IS THE POINT OF THE TEST BUTTON: it reports what the endpoint actually
 * said. A 401 must read as "your key is wrong", never be flattened into a
 * generic "couldn't connect" — probe.js already refuses to mask it (404-only
 * fallthrough), and this must not undo that work at the last inch.
 *
 * @param {{ ok: true, models?: {id:string}[] } | { ok: false, error?: object }} result
 * @returns {{ tone: "ok"|"error", text: string, hint: string }}
 */
export function describeTestResult(result) {
  if (result?.ok) {
    const count = Array.isArray(result.models) ? result.models.length : 0;
    return {
      tone: "ok",
      text: count === 1 ? "Reachable — 1 model available." : `Reachable — ${count} models available.`,
      hint: "",
    };
  }

  const error = result?.error ?? {};
  const detail = typeof error.message === "string" && error.message.trim() ? ` ${error.message.trim()}` : "";

  switch (error.type) {
    case "AUTH_ERROR":
      return {
        tone: "error",
        // Say WHICH failure this is. The status distinguishes "key rejected"
        // (401) from "key valid but not entitled" (403) — different fixes.
        text: `${error.status === 403 ? "Key rejected (403 — not permitted)" : "Key rejected (401)"}.${detail}`,
        hint: error.hint ?? "Update this endpoint's API key below.",
      };
    case "NETWORK_ERROR":
      return {
        tone: "error",
        text: "Could not reach the endpoint.",
        hint: "Check the base URL, and that the server is running.",
      };
    case "INVALID_URL":
      return { tone: "error", text: error.message ?? "The base URL is not valid.", hint: "" };
    case "BAD_RESPONSE":
      return {
        tone: "error",
        text: "The endpoint answered, but not with a model list.",
        hint: "This URL may not be an OpenAI- or Anthropic-compatible base URL.",
      };
    case "API_ERROR":
      return {
        tone: "error",
        text: `Endpoint returned HTTP ${error.status ?? "?"}.${detail}`,
        hint: error.status === 404 ? "Check the base URL — no model list was found there." : "",
      };
    default:
      return { tone: "error", text: `The test failed.${detail}`, hint: "" };
  }
}

/* ───────────────────────── enable / disable ───────────────────────── */
//
// WHAT AN OFF SWITCH HAS TO BE. Turning an endpoint off is a spending control:
// the user is saying "stop calling this, stop billing me". So "off" has to be
// visible to the code that spends money — and that code (lib/ai/client.js's
// pickDefaultEndpointId, then the main process's call path) reads exactly one
// thing: the registry. `enabled` appears nowhere in lib/ or electron/ — there is
// no field for it and no IPC channel carrying it.
//
// So a list of disabled ids in localStorage CANNOT be the off switch. It was,
// and it was inert: the user switched an endpoint off, the key stayed live in
// the registry, the tools kept picking it, and the bill kept coming.
//
// The off switch is therefore the registry write in turnEndpointOff(): the key
// is deleted. No key, no billable call — that is an "off" the call path cannot
// ignore. The disabled-id list survives only as a UI ECHO: it remembers that the
// user meant to turn this off, so the panel can say "Off" instead of nagging
// "no API key — this will fail with 401". If that list is lost, nothing is
// unsafe; the key is still gone. Enforcement lives in the registry, memory lives
// in the list, and the list is never asked to be more than a memory.
//
// Storing the disabled ones (not the enabled ones) means a newly added endpoint
// is on by default with no migration and no write.

/**
 * @param {string[]|undefined} disabledIds
 * @param {string} id
 * @returns {boolean}
 */
export function isEndpointEnabled(disabledIds, id) {
  return !(Array.isArray(disabledIds) && disabledIds.includes(id));
}

/**
 * Toggle an endpoint's enabled state, returning the next disabled-id list.
 * Pure: never mutates the input.
 *
 * @param {string[]|undefined} disabledIds
 * @param {string} id
 * @returns {string[]}
 */
export function toggleEndpointEnabled(disabledIds, id) {
  const current = Array.isArray(disabledIds) ? disabledIds : [];
  return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
}

/**
 * Drop ids that no longer exist, so deleting an endpoint cannot leave a stale
 * id behind that would silently disable a future endpoint reusing that id.
 *
 * @param {string[]|undefined} disabledIds
 * @param {{id: string}[]} endpoints
 * @returns {string[]}
 */
export function pruneDisabledIds(disabledIds, endpoints) {
  const live = new Set((endpoints ?? []).map((e) => e.id));
  return (Array.isArray(disabledIds) ? disabledIds : []).filter((id) => live.has(id));
}

/**
 * Turn an endpoint off, for real, by removing its key from the registry.
 *
 * This is the whole off switch. `api.update(id, { apiKey: "" })` is a genuine
 * clear (see registry.update: `patch.apiKey !== undefined` writes ""), so after
 * this the key is gone from endpoints.json — not hidden, not flagged, gone. The
 * endpoint keeps its label and URL so turning it back on is "paste your key
 * again", which is the honest price of an off switch in an app whose whole
 * design is that the key has exactly one home.
 *
 * Deliberately takes no disabled-id list: the enforcement must not depend on a
 * UI preference surviving.
 *
 * @param {{ update: (id: string, patch: object) => Promise<object> }} api - the endpoints port
 * @param {{ id: string }} view - an EndpointView (never carries a key)
 * @returns {Promise<{ ok: true, endpoint?: object } | { ok: false, error: object }>}
 */
export async function turnEndpointOff(api, view) {
  if (!api || typeof api.update !== "function") {
    return {
      ok: false,
      error: { type: "NO_BRIDGE", message: "The app shell is not connected, so the key cannot be removed." },
    };
  }
  const result = await api.update(view?.id, { apiKey: "" });
  // Report a failed clear as a failure. Telling the user an endpoint is off
  // while its key is still on disk is the bug this function exists to end.
  if (result?.ok === false) return result;
  return { ok: true, endpoint: result?.endpoint };
}

/**
 * The state of one endpoint's off switch.
 *
 * `on` is DERIVED FROM THE REGISTRY (`hasKey`), never from the disabled-id list
 * — same rule as the provider picker deriving from the URL. One source of truth
 * means the switch cannot say "off" about an endpoint that still has a live key,
 * which is precisely how the old switch lied. The id list only chooses the
 * WORDING for an endpoint that is already keyless: "you turned this off" reads
 * differently from "this was never finished", and only the id list knows which.
 *
 * A local endpoint gets no switch at all: it needs no key, so removing one would
 * not turn anything off, and a switch that cannot enforce is the original bug.
 * Delete is its real off switch.
 *
 * @param {{ id?: string, label?: string, baseUrl?: string, hasKey?: boolean }} view
 * @param {string[]} [disabledIds]
 * @returns {{ kind: "switch"|"none", on: boolean, text: string, hint: string, ariaLabel: string }}
 */
export function describeOffSwitch(view, disabledIds) {
  const label = view?.label ?? "this endpoint";

  if (isLocalUrl(view?.baseUrl ?? "")) {
    return {
      kind: "none",
      on: true,
      text: "Always on (local — no key, nothing to bill)",
      hint: "Delete this endpoint to stop the app using it.",
      ariaLabel: `${label} is a local endpoint`,
    };
  }

  if (view?.hasKey) {
    return {
      kind: "switch",
      on: true,
      text: "On",
      hint: "Turning this off removes the stored key from the app.",
      ariaLabel: `Turn off ${label}`,
    };
  }

  const turnedOff = !isEndpointEnabled(disabledIds, view?.id);
  return {
    kind: "switch",
    on: false,
    text: turnedOff ? "Off — the stored key was removed" : "Off — no API key",
    hint: turnedOff
      ? "Add a key again to turn it back on."
      : "Add a key to turn this endpoint on.",
    ariaLabel: `Turn on ${label}`,
  };
}

/* ─────────────────── the legacy plaintext key (web build) ─────────────────── */

/**
 * The localStorage key lib/ai/config.js writes its legacy config under.
 *
 * Duplicated from that module (which keeps it private) rather than exported from
 * it, because this unit does not own lib/ai/config.js. It is pinned by
 * test/settings-ui.test.js against config.js's real behaviour — setAIConfig()
 * then removeLegacyAIConfig() then hasAIKey() — so a rename there fails a test
 * here rather than silently stranding the key this constant exists to remove.
 */
export const LEGACY_AI_CONFIG_KEY = "coop_ai_v1";

/**
 * Remove the legacy plaintext AI config — key and all — from a storage port.
 *
 * WHY THE WHOLE BLOB, not `setAIConfig({ apiKey: "" })`: "remove my key" should
 * leave nothing behind, and blanking one field leaves the record (and any future
 * reader of it) in place. Removing the item is the only thing that is actually
 * true to the button's label.
 *
 * @param {{ getItem: Function, removeItem: Function }} storage - typically window.localStorage
 * @returns {boolean} true when something was actually removed
 */
export function removeLegacyAIConfig(storage) {
  try {
    if (!storage || typeof storage.removeItem !== "function") return false;
    const had = storage.getItem(LEGACY_AI_CONFIG_KEY) != null;
    storage.removeItem(LEGACY_AI_CONFIG_KEY);
    return had;
  } catch {
    // A storage that throws (private mode, blocked cookies) cannot be holding a
    // key we put there. Say "nothing removed" rather than crashing Settings.
    return false;
  }
}

/**
 * Whether to offer the "remove stored key" control, and what it should say.
 *
 * THE GAP THIS CLOSES: the legacy key's only exit used to be the migration, and
 * the migration is gated on the Electron bridge. On the web build there is no
 * bridge, so a plaintext key sat in localStorage with no way out — the "Clear
 * key" button that used to remove it having been deleted. A key the user cannot
 * remove is not acceptable in a BYO-key app on any build, so this control shows
 * whenever a legacy key is present, bridge or no bridge. Under the bridge it is
 * normally never seen (the migration removes the key on mount); it appears only
 * when that migration failed — which is exactly when the user needs it.
 *
 * @param {{ hasBridge?: boolean, hasLegacyKey?: boolean }} state
 * @returns {{ show: boolean, title: string, body: string, action: string }}
 */
export function describeLegacyKeyControl({ hasBridge, hasLegacyKey } = {}) {
  if (!hasLegacyKey) {
    return { show: false, title: "", body: "", action: "" };
  }
  return {
    show: true,
    title: "An old API key is still stored in this browser",
    body: hasBridge
      ? "A key saved by an older version of this app is still in this browser's storage, and could not be moved into the endpoint registry. Removing it deletes it from this browser; add the key to an endpoint below to keep using AI."
      : "A key saved by an older version of this app is still in this browser's storage. This build has no desktop shell, so nothing here can use it — removing it deletes it from this browser for good.",
    action: "Remove stored key",
  };
}

/* ───────────────────────── picker state ───────────────────────── */

/**
 * The provider selector's state for a given URL field value.
 *
 * THE NICEST PART OF THE NEXUS DESIGN, PRESERVED: the URL is the single source
 * of truth. Picking a provider only SEEDS the URL; the moment the user edits
 * that URL away from the preset, this reports CUSTOM and the control degrades to
 * a free-form endpoint field. Nothing stays pinned to a preset whose URL is no
 * longer in the box, so the label can never lie about where requests will go.
 *
 * @param {string} url
 * @returns {{ providerId: string, label: string, glyph: string, isCustom: boolean }}
 */
export function pickerStateForUrl(url) {
  const providerId = providerIdForUrl(url);
  const provider = getProvider(providerId) ?? getProvider(CUSTOM_PROVIDER_ID);
  return {
    providerId,
    label: provider.label,
    glyph: provider.glyph,
    isCustom: providerId === CUSTOM_PROVIDER_ID,
  };
}

/**
 * The URL that selecting a provider should put in the field.
 *
 * Choosing "Custom URL" clears the field rather than seeding it — there is no
 * URL to seed, and leaving the previous preset's URL behind under a "Custom"
 * label would misrepresent what is configured.
 *
 * @param {string} providerId
 * @returns {string}
 */
export function seedUrlForProvider(providerId) {
  const provider = getProvider(providerId);
  if (!provider || provider.id === CUSTOM_PROVIDER_ID) return "";
  return provider.baseUrl;
}

export { CUSTOM_PROVIDER_ID };
