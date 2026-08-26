// lib/ai/config.js
// AI provider configuration — no side effects on import, no hardcoded secrets.
//
// NOTHING IN THE APP CALLS AN LLM FROM HERE ANY MORE. Since lib/ai/client.js
// moved onto the ai:call bridge, this module's `apiKey` field has exactly one
// remaining purpose: being the SOURCE of migrateLegacyAIConfig(), which lifts a
// pre-Phase-2 user's plaintext key out of localStorage into the main-process
// registry and scrubs it. No UI writes a key here (the legacy Settings form is
// gone), and no caller reads one to authenticate with. Do not add one back:
// two key sources means the bad one wins silently.

const KEY = "coop_ai_v1";

export const AI_PRESETS = [
  {
    id: "ollama",
    label: "Ollama (local)",
    endpoint: "http://localhost:11434/v1/chat/completions",
    model: "llama3",
    note: "Recommended: fully local, no CORS",
  },
  {
    id: "openai",
    label: "OpenAI",
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o",
    note: "",
  },
  {
    id: "custom",
    label: "Custom endpoint",
    endpoint: "",
    model: "",
    note: "",
  },
];

export const DEFAULT_CONFIG = {
  apiKey: "",
  endpoint: AI_PRESETS[0].endpoint,
  model: AI_PRESETS[0].model,
  presetId: AI_PRESETS[0].id,
};

/** Resolve the available storage object, or null when running in Node without a shim. */
function getStorage() {
  if (typeof window !== "undefined") {
    return window.localStorage;
  }
  // Test environments may inject globalThis.localStorage without setting window.
  if (typeof globalThis !== "undefined" && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return null;
}

/**
 * Read the stored AI config and merge it over DEFAULT_CONFIG.
 * Never throws — returns DEFAULT_CONFIG on any error or missing storage.
 */
export function getAIConfig() {
  const storage = getStorage();
  if (!storage) return { ...DEFAULT_CONFIG };
  try {
    const raw = storage.getItem(KEY);
    return raw
      ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
      : { ...DEFAULT_CONFIG };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Merge a partial config object into the current config and persist it.
 * No-op when storage is unavailable.
 */
export function setAIConfig(obj) {
  const storage = getStorage();
  if (!storage) return;
  try {
    const current = getAIConfig();
    storage.setItem(KEY, JSON.stringify({ ...current, ...obj }));
  } catch {}
}

/**
 * Returns true iff a non-empty legacy API key is still sitting in localStorage,
 * i.e. iff there is something for ensureLegacyAIConfigMigrated() to move.
 */
export function hasAIKey() {
  const { apiKey } = getAIConfig();
  return typeof apiKey === "string" && apiKey.trim().length > 0;
}

/**
 * One-time migration of this module's legacy single-endpoint localStorage
 * config onto the lib/endpoints registry (reached through the injected
 * endpoints port — under Electron that is window.coop.endpoints, whose add()
 * hands the key to the MAIN process and returns a key-free view).
 *
 * On success the localStorage copy of the key is scrubbed, so the renderer no
 * longer holds it anywhere; subsequent calls are no-ops ({ migrated: false })
 * because there is no key left to migrate. The endpoint/model fields are kept
 * (harmless, and the legacy web path still needs them).
 *
 * @param {{ add: (draft: {label: string, baseUrl: string, apiKey: string}) => Promise<{ok: boolean, endpoint?: object, error?: object}> }} [endpointsApi]
 * @returns {Promise<{migrated: boolean, endpoint?: object, error?: object}>}
 */
export async function migrateLegacyAIConfig(endpointsApi) {
  if (!endpointsApi || typeof endpointsApi.add !== "function") {
    return { migrated: false };
  }
  const config = getAIConfig();
  const apiKey = typeof config.apiKey === "string" ? config.apiKey.trim() : "";
  if (!apiKey) return { migrated: false };

  // The legacy config stored the full chat-completions URL; registry
  // endpoints are base URLs.
  const baseUrl = (config.endpoint || "").replace(/\/chat\/completions\/?$/, "");
  if (!baseUrl) return { migrated: false };

  let result;
  try {
    result = await endpointsApi.add({
      label: "Migrated from AI Settings",
      baseUrl,
      apiKey,
    });
  } catch {
    return { migrated: false };
  }
  if (!result || result.ok !== true) {
    return { migrated: false, error: result?.error };
  }

  // The key now lives ONLY behind the endpoints port — scrub the local copy.
  setAIConfig({ apiKey: "" });
  return { migrated: true, endpoint: result.endpoint };
}

/** In-flight migration, shared by whichever AI surfaces mount concurrently. */
let migrationInFlight = null;

/**
 * The migration entry point every AI surface calls on mount.
 *
 * WHERE THIS BELONGS: scrubbing a plaintext key out of the renderer must not
 * depend on the user happening to open Settings — that was the bug (a user who
 * only ever opened the Cover Letter Builder kept a live key in the page and in
 * the Chromium localStorage leveldb on disk). So the call sites are the AI
 * surfaces themselves, and this wrapper makes that safe to do from several at
 * once: it is idempotent, it de-duplicates concurrent callers (two mounts must
 * not add the endpoint twice), it never rejects, and a FAILED migration stays
 * retryable rather than being memoized. Once the key is gone, it is a cheap
 * no-op forever.
 *
 * NOTE for whoever owns components/Dashboard.js: the last gap is a user who
 * opens neither Settings nor an AI tool. One `ensureLegacyAIConfigMigrated(
 * window.coop?.endpoints)` in the Dashboard's mount effect closes it for good.
 *
 * @param {{ add: Function }} [endpointsApi] - typically window.coop.endpoints
 * @returns {Promise<{migrated: boolean, endpoint?: object, error?: object}>}
 */
export function ensureLegacyAIConfigMigrated(endpointsApi) {
  if (migrationInFlight) return migrationInFlight;
  if (!hasAIKey()) return Promise.resolve({ migrated: false });

  migrationInFlight = migrateLegacyAIConfig(endpointsApi)
    .catch(() => ({ migrated: false }))
    .finally(() => {
      migrationInFlight = null;
    });
  return migrationInFlight;
}
