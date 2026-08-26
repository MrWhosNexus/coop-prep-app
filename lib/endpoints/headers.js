// lib/endpoints/headers.js
// Builds the outbound auth headers for one endpoint.
//
// This module reads endpoint.apiKey. It is the ONLY place besides
// lib/endpoints/call.js that touches the key, and it returns the key only
// inside a headers object destined for fetch() — never in a log, an error, or
// any value that reaches the renderer.
//
// THERE IS NO process.env PATH HERE, DELIBERATELY. A keyless endpoint builds
// keyless headers and fails honestly against the server rather than being
// silently authenticated by ambient environment state. Two key sources (env +
// registry) means the invalid one can silently shadow the good one, which
// produces 401s that are almost impossible to debug. One source: the registry.
//
// Pure module: no DOM, no fs, no network. Importable under `node --test`.

import {
  ANTHROPIC_VERSION,
  isAnthropicShaped,
  isFirstPartyAnthropic,
} from "./providers.js";

/** Beta flag required when authenticating to Anthropic with an OAuth token. */
export const ANTHROPIC_OAUTH_BETA = "oauth-2025-04-20";

/**
 * Does this key look like an Anthropic OAuth access token rather than a
 * long-lived API key? OAuth tokens are minted by `ant auth login` and carry an
 * `sk-ant-oat` prefix; they authenticate via `Authorization: Bearer`, whereas
 * an `sk-ant-api` key authenticates via `x-api-key`.
 *
 * @param {string} apiKey
 * @returns {boolean}
 */
export function isAnthropicOAuthToken(apiKey) {
  return typeof apiKey === "string" && /^sk-ant-oat/i.test(apiKey.trim());
}

/**
 * Build request headers for an endpoint.
 *
 * Auth scheme selection:
 *   - First-party api.anthropic.com + API key  -> `x-api-key`
 *   - First-party api.anthropic.com + OAuth    -> `Authorization: Bearer` + beta flag
 *   - Everything else (incl. MiniMax's Anthropic-shaped path) -> `Authorization: Bearer`
 *
 * Exactly one auth header is ever sent. Sending both `x-api-key` and
 * `Authorization` to Anthropic is itself a documented cause of 401 — the two
 * are alternatives, not belt-and-braces.
 *
 * `anthropic-version` is added whenever the URL is Anthropic-SHAPED (which
 * includes MiniMax), because that is a property of the wire format, not of the
 * host.
 *
 * A blank / whitespace-only key produces no auth header at all. That is the
 * honest-failure path: the request goes out unauthenticated and the server
 * answers with its own 401, which the user can act on.
 *
 * @param {{ baseUrl: string, apiKey?: string }} endpoint
 * @returns {Record<string, string>} headers safe to hand to fetch()
 */
export function buildAuthHeaders(endpoint) {
  const baseUrl = endpoint?.baseUrl ?? "";
  const apiKey = typeof endpoint?.apiKey === "string" ? endpoint.apiKey.trim() : "";

  /** @type {Record<string, string>} */
  const headers = { "Content-Type": "application/json" };

  if (isAnthropicShaped(baseUrl)) {
    headers["anthropic-version"] = ANTHROPIC_VERSION;
  }

  // No key -> no auth header. Probe unauthenticated and fail honestly.
  if (!apiKey) return headers;

  if (isFirstPartyAnthropic(baseUrl) && !isAnthropicOAuthToken(apiKey)) {
    headers["x-api-key"] = apiKey;
    return headers;
  }

  headers["Authorization"] = `Bearer ${apiKey}`;
  if (isFirstPartyAnthropic(baseUrl) && isAnthropicOAuthToken(apiKey)) {
    headers["anthropic-beta"] = ANTHROPIC_OAUTH_BETA;
  }
  return headers;
}

/**
 * Remove any occurrence of the endpoint's key from a string before it is
 * surfaced to a caller.
 *
 * Defence in depth: no known provider echoes the key back in an error body,
 * but error text is the one attacker-influenced string we propagate outward,
 * so it gets scrubbed before it can reach a log or a UI.
 *
 * @param {string} text
 * @param {string} [apiKey]
 * @returns {string}
 */
export function redactKey(text, apiKey) {
  if (typeof text !== "string" || !text) return "";
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (key.length < 8) return text; // too short to match meaningfully
  return text.split(key).join("[redacted]");
}
