// lib/endpoints/probe.js
// Endpoint reachability test + live model discovery.
//
// TWO RULES THIS FILE EXISTS TO ENFORCE:
//
// 1. THE /v1/v1 FIX. Preset URLs already carry their version segment
//    (https://api.openai.com/v1). Blindly appending "/v1" produces
//    /v1/v1/models, which 404s and looks like "the endpoint is down". So we
//    test for a trailing /v<digits> BEFORE deciding whether to add one.
//
// 2. 404-ONLY FALLTHROUGH. When trying candidate paths, only a 404 means "wrong
//    path, try the next one". Any other status — 401, 400, 429, 5xx — is the
//    real endpoint answering, and that answer is the truth the user needs.
//    Falling through on a 401 and then reporting the second path's 404 turns
//    "your key is wrong" into "your URL is wrong", which sends people to debug
//    the wrong field entirely.
//
// Fetch is injectable so all of this is testable with no network.

import { buildAuthHeaders, redactKey } from "./headers.js";
import { isAnthropicShaped, normalizeBaseUrl } from "./providers.js";

/**
 * Does this base URL already end in a version segment (/v1, /v4, /v1beta…)?
 *
 * @param {string} baseUrl
 * @returns {boolean}
 */
export function hasVersionSegment(baseUrl) {
  return /\/v\d+[a-z0-9]*$/i.test(normalizeBaseUrl(baseUrl));
}

/**
 * Build the ordered candidate URLs for a path, applying the /v1/v1 fix.
 *
 * A root that already carries a version segment is tried WITHOUT an extra /v1
 * first; a root that does not is tried WITH /v1 first. The other ordering is
 * kept as a fallback because gateways disagree, and a 404 on the first is a
 * cheap, unambiguous signal to try the second.
 *
 * @param {string} baseUrl
 * @param {string} suffix - e.g. "chat/completions"
 * @returns {string[]}
 */
export function candidateUrls(baseUrl, suffix) {
  const root = normalizeBaseUrl(baseUrl);
  if (!root) return [];
  const withV1 = `${root}/v1/${suffix}`;
  const bare = `${root}/${suffix}`;
  return hasVersionSegment(root) ? [bare, withV1] : [withV1, bare];
}

/** Candidate chat-completion URLs for an OpenAI-shaped endpoint. */
export function candidateChatUrls(baseUrl) {
  return candidateUrls(baseUrl, "chat/completions");
}

/** Candidate model-listing URLs for an OpenAI-shaped endpoint. */
export function candidateModelsUrls(baseUrl) {
  return candidateUrls(baseUrl, "models");
}

/**
 * Try candidates in order, falling through ONLY on 404.
 *
 * @param {string[]} urls
 * @param {(url: string) => Promise<Response>} attempt
 * @returns {Promise<{ ok: true, url: string, response: Response } | { ok: false, error: object }>}
 */
export async function tryCandidates(urls, attempt) {
  if (!urls.length) {
    return { ok: false, error: { type: "INVALID_URL", message: "No candidate URL could be built." } };
  }

  let lastNotFound = null;

  for (const url of urls) {
    let response;
    try {
      response = await attempt(url);
    } catch {
      // Network-level failure. Do not include the raw error: a stack trace
      // could in principle carry the request headers, and those carry the key.
      return { ok: false, error: { type: "NETWORK_ERROR", message: "Could not reach the endpoint." } };
    }

    if (response.status === 404) {
      lastNotFound = { url, response };
      continue; // wrong path — and ONLY this status means that
    }

    // Any other status is the real endpoint speaking. Surface it verbatim.
    return { ok: true, url, response };
  }

  // Every candidate 404'd, so 404 genuinely is the answer.
  return { ok: true, url: lastNotFound.url, response: lastNotFound.response };
}

/**
 * Read a short, safe error message out of a non-2xx response body.
 *
 * @param {Response} response
 * @param {string} [apiKey]
 * @returns {Promise<string>}
 */
async function readErrorMessage(response, apiKey) {
  try {
    const data = await response.json();
    const candidate = data?.error?.message ?? data?.error ?? data?.message;
    if (typeof candidate === "string") return redactKey(candidate, apiKey);
  } catch {
    // Non-JSON or unparseable body — no message is better than a wrong one.
  }
  return "";
}

/**
 * Turn a non-2xx response into a typed error.
 *
 * @param {Response} response
 * @param {StoredEndpointLike} endpoint
 * @returns {Promise<{ type: string, status: number, message: string, hint?: string }>}
 */
async function toHttpError(response, endpoint) {
  const message = await readErrorMessage(response, endpoint?.apiKey);
  if (response.status === 401 || response.status === 403) {
    const hasKey = typeof endpoint?.apiKey === "string" && endpoint.apiKey.trim().length > 0;
    return {
      type: "AUTH_ERROR",
      status: response.status,
      message,
      hint: hasKey
        ? "This endpoint's API key was rejected. Update it in Settings → AI Endpoints."
        : "This endpoint has no API key. Add one in Settings → AI Endpoints.",
    };
  }
  return { type: "API_ERROR", status: response.status, message };
}

/**
 * @typedef {{ baseUrl: string, apiKey?: string }} StoredEndpointLike
 */

/**
 * Normalize a provider's model-list payload into [{ id }].
 *
 * Handles OpenAI's { data: [{ id }] } and Ollama's { models: [{ name }] }.
 *
 * @param {any} data
 * @returns {{ id: string }[]}
 */
export function parseModelList(data) {
  const rows = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.models)
      ? data.models
      : [];
  return rows
    .map((row) => {
      if (typeof row === "string") return { id: row };
      const id = row?.id ?? row?.name ?? row?.model;
      return typeof id === "string" && id ? { id } : null;
    })
    .filter(Boolean);
}

/**
 * Discover the models an endpoint actually exposes.
 *
 * This is why presets carry no model IDs: the answer comes from the endpoint,
 * scoped to the user's own key.
 *
 * Tries the OpenAI-style /models path first, then Ollama's /api/tags. Anthropic
 * exposes /v1/models too, so the same path works there.
 *
 * @param {StoredEndpointLike} endpoint
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<{ ok: true, models: {id: string}[] } | { ok: false, error: object }>}
 */
export async function discoverModels(endpoint, fetchFn = fetch) {
  const headers = buildAuthHeaders(endpoint);
  const root = normalizeBaseUrl(endpoint?.baseUrl ?? "");
  if (!root) {
    return { ok: false, error: { type: "INVALID_URL", message: "Base URL is required." } };
  }

  const urls = [...candidateModelsUrls(root), `${root}/api/tags`];
  const attempted = await tryCandidates(urls, (url) => fetchFn(url, { method: "GET", headers }));
  if (!attempted.ok) return attempted;

  const { response } = attempted;
  if (!response.ok) {
    return { ok: false, error: await toHttpError(response, endpoint) };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { ok: false, error: { type: "BAD_RESPONSE", message: "Model list was not valid JSON." } };
  }

  return { ok: true, models: parseModelList(data) };
}

/**
 * Probe an endpoint: is it reachable, does the key work, and what can it run?
 *
 * @param {StoredEndpointLike} endpoint
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<{ ok: true, models: {id: string}[], anthropic: boolean } | { ok: false, error: object }>}
 */
export async function probeEndpoint(endpoint, fetchFn = fetch) {
  const result = await discoverModels(endpoint, fetchFn);
  if (!result.ok) return result;
  return {
    ok: true,
    models: result.models,
    anthropic: isAnthropicShaped(endpoint?.baseUrl ?? ""),
  };
}
