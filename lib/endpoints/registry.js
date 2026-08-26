// lib/endpoints/registry.js
// CRUD over the endpoint list, and the security boundary between the two
// endpoint shapes.
//
//   StoredEndpoint — has apiKey. Lives on disk and in this module only.
//   EndpointView   — has hasKey (a boolean), NEVER apiKey. Safe to send to the
//                    renderer, log, serialize, or render.
//
// THE INVARIANT: list() and get() return EndpointView. The key never crosses
// back out. `toView` strips it by destructuring rather than by delete/omit, so
// adding a new field to StoredEndpoint cannot accidentally leak the key
// through a hand-maintained copy list. Enforced by test/endpoints.test.js,
// which asserts on the SERIALIZED JSON, not just the object shape — a getter
// or prototype leak would pass a shape check and fail this one.
//
// The one key-bearing accessor is resolve(), named and documented so that a
// call site handing its result to a renderer is obviously wrong.
//
// Pure logic + an injectable storage port: no DOM, no fs, no network here.
// Importable under `node --test`.

import { CUSTOM_PROVIDER_ID, getProvider, normalizeBaseUrl, providerIdForUrl } from "./providers.js";

/**
 * @typedef {object} StoredEndpoint
 * @property {string} id
 * @property {string} label
 * @property {string} providerId
 * @property {string} baseUrl
 * @property {string} apiKey     - SECRET. Never leaves this module.
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {object} EndpointView
 * @property {string} id
 * @property {string} label
 * @property {string} providerId
 * @property {string} baseUrl
 * @property {boolean} hasKey    - whether a key is set; never the key itself
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Strip the secret from a StoredEndpoint.
 *
 * Destructure-and-rest, NOT delete: the key is excluded by construction, and
 * every other field flows through automatically.
 *
 * @param {StoredEndpoint} stored
 * @returns {EndpointView}
 */
export function toView(stored) {
  const { apiKey, ...view } = stored;
  return { ...view, hasKey: typeof apiKey === "string" && apiKey.trim().length > 0 };
}

/**
 * Validate a base URL: must be a parseable absolute http(s) URL.
 *
 * @param {string} baseUrl
 * @returns {string|null} an error message, or null when valid
 */
function validateBaseUrl(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return "Base URL is required.";
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    return "Base URL must be a valid absolute URL (e.g. https://api.openai.com/v1).";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Base URL must use http or https.";
  }
  return null;
}

/**
 * Validate the user-supplied fields of an endpoint.
 *
 * Note that an absent apiKey is VALID. Local runtimes (Ollama) need no key, and
 * a keyless remote endpoint is allowed to exist so it can probe unauthenticated
 * and surface the provider's own 401 — see lib/endpoints/headers.js.
 *
 * @param {{ label?: string, baseUrl?: string }} input
 * @returns {{ field: string, message: string }|null}
 */
export function validateEndpointInput(input) {
  const label = typeof input?.label === "string" ? input.label.trim() : "";
  if (!label) return { field: "label", message: "Name is required." };

  const urlError = validateBaseUrl(input?.baseUrl ?? "");
  if (urlError) return { field: "baseUrl", message: urlError };

  return null;
}

/** Default id generator. Falls back to a random string where crypto is absent. */
function defaultUuid() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `ep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Create an endpoint registry over an injectable storage port.
 *
 * @param {object} options
 * @param {{ read: () => object[]|null, write: (endpoints: object[]) => void }} options.storage
 * @param {() => string} [options.now]  - ISO timestamp source; injectable for tests
 * @param {() => string} [options.uuid] - id source; injectable for tests
 * @returns {object} the registry
 */
export function createRegistry({ storage, now = () => new Date().toISOString(), uuid = defaultUuid }) {
  if (!storage || typeof storage.read !== "function" || typeof storage.write !== "function") {
    throw new TypeError("createRegistry requires a storage port with read() and write().");
  }

  /** @returns {StoredEndpoint[]} */
  function readAll() {
    const raw = storage.read();
    if (!Array.isArray(raw)) return [];
    return raw.filter((e) => e && typeof e.id === "string");
  }

  /** @param {StoredEndpoint[]} endpoints */
  function writeAll(endpoints) {
    storage.write(endpoints);
  }

  return {
    /**
     * All endpoints, WITHOUT their keys.
     *
     * @returns {EndpointView[]}
     */
    list() {
      return readAll().map(toView);
    },

    /**
     * One endpoint, WITHOUT its key.
     *
     * @param {string} id
     * @returns {EndpointView|null}
     */
    get(id) {
      const found = readAll().find((e) => e.id === id);
      return found ? toView(found) : null;
    },

    /**
     * Resolve an endpoint WITH its key, for the sole purpose of making a
     * request.
     *
     * DO NOT return this value to a renderer, log it, or serialize it into any
     * response. lib/endpoints/call.js and lib/endpoints/probe.js are the only
     * intended callers.
     *
     * @param {string} id
     * @returns {StoredEndpoint|null}
     */
    resolve(id) {
      return readAll().find((e) => e.id === id) ?? null;
    },

    /**
     * Add an endpoint.
     *
     * @param {{ label: string, baseUrl: string, apiKey?: string, providerId?: string }} input
     * @returns {{ ok: true, endpoint: EndpointView } | { ok: false, error: object }}
     */
    add(input) {
      const invalid = validateEndpointInput(input);
      if (invalid) {
        return { ok: false, error: { type: "VALIDATION_ERROR", ...invalid } };
      }

      const baseUrl = normalizeBaseUrl(input.baseUrl);
      // The URL is the source of truth for providerId. An explicitly passed
      // providerId is honoured only if it still matches the URL — otherwise the
      // control degrades to "Custom URL" exactly as the selector does.
      const derived = providerIdForUrl(baseUrl);
      const providerId =
        input.providerId && getProvider(input.providerId) && derived === input.providerId
          ? input.providerId
          : derived;

      const timestamp = now();
      /** @type {StoredEndpoint} */
      const stored = {
        id: uuid(),
        label: input.label.trim(),
        providerId,
        baseUrl,
        apiKey: typeof input.apiKey === "string" ? input.apiKey.trim() : "",
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      writeAll([...readAll(), stored]);
      return { ok: true, endpoint: toView(stored) };
    },

    /**
     * Update an endpoint. Omitted fields are left as-is; passing apiKey: "" is
     * a real instruction to clear the key.
     *
     * @param {string} id
     * @param {{ label?: string, baseUrl?: string, apiKey?: string }} patch
     * @returns {{ ok: true, endpoint: EndpointView } | { ok: false, error: object }}
     */
    update(id, patch) {
      const all = readAll();
      const index = all.findIndex((e) => e.id === id);
      if (index === -1) {
        return { ok: false, error: { type: "NOT_FOUND", message: "Endpoint not found." } };
      }

      const current = all[index];
      const merged = {
        label: patch?.label !== undefined ? patch.label : current.label,
        baseUrl: patch?.baseUrl !== undefined ? patch.baseUrl : current.baseUrl,
      };

      const invalid = validateEndpointInput(merged);
      if (invalid) {
        return { ok: false, error: { type: "VALIDATION_ERROR", ...invalid } };
      }

      const baseUrl = normalizeBaseUrl(merged.baseUrl);
      /** @type {StoredEndpoint} */
      const next = {
        ...current,
        label: merged.label.trim(),
        baseUrl,
        providerId: providerIdForUrl(baseUrl),
        apiKey: patch?.apiKey !== undefined ? String(patch.apiKey).trim() : current.apiKey,
        updatedAt: now(),
      };

      const all2 = [...all];
      all2[index] = next;
      writeAll(all2);
      return { ok: true, endpoint: toView(next) };
    },

    /**
     * Remove an endpoint.
     *
     * @param {string} id
     * @returns {{ ok: boolean }}
     */
    remove(id) {
      const all = readAll();
      const next = all.filter((e) => e.id !== id);
      if (next.length === all.length) return { ok: false };
      writeAll(next);
      return { ok: true };
    },
  };
}

export { CUSTOM_PROVIDER_ID };
