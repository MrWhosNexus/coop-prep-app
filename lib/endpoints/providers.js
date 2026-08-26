// lib/endpoints/providers.js
// Provider presets for the BYO-key endpoint registry.
//
// DESIGN RULE (load-bearing): a preset carries ONLY a base URL. It never
// carries a model ID. Models are discovered live by probing the endpoint
// (see lib/endpoints/probe.js). Hardcoding a model list here would rot the
// moment a provider ships a new model, and would lie about what the user's
// key can actually reach.
//
// Picking a provider only SEEDS the URL field. Typing a custom URL degrades
// the control back to CUSTOM_PROVIDER_ID ("Custom URL") — see providerIdForUrl.
//
// Pure module: no DOM, no fs, no network. Importable under `node --test`.

/** Provider id used whenever a URL matches no preset. */
export const CUSTOM_PROVIDER_ID = "custom";

/**
 * @typedef {object} Provider
 * @property {string} id       - Stable identifier persisted on the endpoint.
 * @property {string} label    - Human-readable name for the selector.
 * @property {string} baseUrl  - Seed value only. Never a model ID.
 * @property {string} glyph    - Short display glyph for the selector row.
 */

/** @type {ReadonlyArray<Provider>} */
export const PROVIDERS = Object.freeze([
  { id: "anthropic",    label: "Anthropic",         baseUrl: "https://api.anthropic.com",                              glyph: "AN" },
  { id: "openai",       label: "OpenAI",            baseUrl: "https://api.openai.com/v1",                              glyph: "OA" },
  { id: "minimax",      label: "MiniMax",           baseUrl: "https://api.minimax.io/anthropic",                       glyph: "MM" },
  { id: "openrouter",   label: "OpenRouter",        baseUrl: "https://openrouter.ai/api/v1",                           glyph: "OR" },
  { id: "ollama-cloud", label: "Ollama Cloud",      baseUrl: "https://ollama.com/v1",                                  glyph: "OL" },
  { id: "groq",         label: "Groq",              baseUrl: "https://api.groq.com/openai/v1",                         glyph: "GQ" },
  { id: "mistral",      label: "Mistral",           baseUrl: "https://api.mistral.ai/v1",                              glyph: "MS" },
  { id: "together",     label: "Together",          baseUrl: "https://api.together.xyz/v1",                            glyph: "TG" },
  { id: "fireworks",    label: "Fireworks",         baseUrl: "https://api.fireworks.ai/inference/v1",                  glyph: "FW" },
  { id: "gemini",       label: "Gemini",            baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", glyph: "GM" },
  { id: "xai",          label: "xAI",               baseUrl: "https://api.x.ai/v1",                                    glyph: "XA" },
  { id: "zai",          label: "Z.ai",              baseUrl: "https://api.z.ai/api/paas/v4",                           glyph: "ZA" },
  { id: "zai-coding",   label: "Z.ai (coding)",     baseUrl: "https://api.z.ai/api/coding/paas/v4",                    glyph: "ZC" },
  { id: CUSTOM_PROVIDER_ID, label: "Custom URL",    baseUrl: "",                                                       glyph: "··" },
]);

/** Host that is the real first-party Anthropic API. */
export const ANTHROPIC_HOST = "api.anthropic.com";

/** Wire version header value required by the Anthropic Messages API. */
export const ANTHROPIC_VERSION = "2023-06-01";

/**
 * Look up a provider preset by id.
 *
 * @param {string} id
 * @returns {Provider|null}
 */
export function getProvider(id) {
  return PROVIDERS.find((p) => p.id === id) ?? null;
}

/**
 * Normalize a base URL for comparison: trim whitespace and drop trailing "/".
 *
 * @param {string} url
 * @returns {string}
 */
export function normalizeBaseUrl(url) {
  if (typeof url !== "string") return "";
  return url.trim().replace(/\/+$/, "");
}

/**
 * Parse a URL, returning null instead of throwing on malformed input.
 *
 * @param {string} url
 * @returns {URL|null}
 */
function safeUrl(url) {
  try {
    return new URL(normalizeBaseUrl(url));
  } catch {
    return null;
  }
}

/**
 * Which provider a base URL corresponds to.
 *
 * This is what makes the control degrade gracefully: the moment the user edits
 * the URL away from a preset value, this returns CUSTOM_PROVIDER_ID and the
 * selector falls back to "Custom URL". Nothing is silently pinned to a preset
 * whose URL is no longer in the field.
 *
 * @param {string} url
 * @returns {string} a provider id, or CUSTOM_PROVIDER_ID
 */
export function providerIdForUrl(url) {
  const normalized = normalizeBaseUrl(url);
  if (!normalized) return CUSTOM_PROVIDER_ID;
  const hit = PROVIDERS.find(
    (p) => p.id !== CUSTOM_PROVIDER_ID && normalizeBaseUrl(p.baseUrl) === normalized
  );
  return hit ? hit.id : CUSTOM_PROVIDER_ID;
}

/**
 * Does this base URL speak the Anthropic Messages wire format?
 *
 * True when EITHER the path contains an "/anthropic" segment (MiniMax's
 * Anthropic-compatible endpoint is https://api.minimax.io/anthropic) OR the
 * host is api.anthropic.com itself. Anything else is treated as OpenAI-shaped.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isAnthropicShaped(url) {
  const parsed = safeUrl(url);
  if (parsed) {
    if (parsed.hostname.toLowerCase() === ANTHROPIC_HOST) return true;
    return /\/anthropic(\/|$)/i.test(parsed.pathname);
  }
  // Unparseable input (e.g. a relative URL in a test): fall back to the path shape.
  return /\/anthropic(\/|$)/i.test(normalizeBaseUrl(url));
}

/**
 * Is this base URL the real first-party Anthropic API (not merely an
 * Anthropic-compatible gateway such as MiniMax)?
 *
 * The distinction matters for auth: api.anthropic.com authenticates an API key
 * via `x-api-key`, whereas the compatible gateways use `Authorization: Bearer`.
 * See lib/endpoints/headers.js.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isFirstPartyAnthropic(url) {
  const parsed = safeUrl(url);
  return parsed?.hostname.toLowerCase() === ANTHROPIC_HOST;
}
