// electron/preload.js
//
// NOTE on module format: the project's package.json sets "type": "module", but
// this file deliberately uses CommonJS (require/module.exports) instead of
// import/export. With `sandbox: true` (which we set on every BrowserWindow),
// Electron loads the preload script through its own sandboxed-renderer loader,
// not through Node's package.json-driven ESM/CJS resolution — that loader
// understands require() regardless of "type": "module" in the nearest
// package.json. Renaming this to .mjs or adding "import" here would break under
// sandbox: true on the Electron versions this was written against. If you ever
// flip sandbox to false, re-check this before switching syntax.
//
// This is the ONLY bridge between the untrusted renderer and the main process.
// It exposes a narrow, hand-written allowlist — never ipcRenderer itself, never
// require(), never process. Every method here corresponds 1:1 to a channel
// documented in electron/README.md and validated in electron/ipc/validators.js.

const { contextBridge, ipcRenderer } = require("electron");

/** Channels the main process is allowed to push unsolicited events on. */
const ALLOWED_STREAM_CHANNELS = new Set(["ai:stream", "voice:speak-stream", "hermes:stream", "updates:status"]);

function invoke(channel, ...args) {
  return ipcRenderer.invoke(channel, ...args);
}

/**
 * Subscribe to a push channel (currently only "ai:stream"). Returns an
 * unsubscribe function. `callback` receives only the payload, never the raw
 * IpcRendererEvent (which carries a sender reference we don't want to leak).
 */
function subscribe(channel, callback) {
  if (!ALLOWED_STREAM_CHANNELS.has(channel)) {
    throw new Error(`preload: "${channel}" is not an allowed stream channel`);
  }
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("coop", {
  app: {
    getVersion: () => invoke("app:getVersion"),
    getPaths: () => invoke("app:getPaths"),
  },

  // Whole-document read/write (a serialized JSON string, or null), matching
  // lib/store/backends.js's backend port exactly — the renderer can do
  // `createIPCBackend({ read: window.coop.store.read, write: window.coop.store.write })`
  // with zero adaptation.
  store: {
    read: () => invoke("store:read"),
    write: (text) => invoke("store:write", text),
  },

  // Views only — never carries apiKey. See electron/ipc/validators.js#toEndpointView.
  endpoints: {
    list: () => invoke("endpoints:list"),
    add: (input) => invoke("endpoints:add", input),
    update: (id, patch) => invoke("endpoints:update", { id, patch }),
    delete: (id) => invoke("endpoints:delete", { id }),
    test: (id) => invoke("endpoints:test", { id }),
    models: (id) => invoke("endpoints:models", { id }),
  },

  ai: {
    /** Kicks off a streamed call; resolves with { requestId, started }. Listen with onStream. */
    call: (request) => invoke("ai:call", request),
    cancel: (requestId) => invoke("ai:cancel", { requestId }),
    /** callback receives { requestId, type: "chunk"|"done"|"error", delta?, error? } */
    onStream: (callback) => subscribe("ai:stream", callback),
  },

  // Local Kokoro TTS + Whisper STT, in-process in main — no key, no cloud.
  // Mirrors the ai bridge: speak() acks with { requestId, started } and streams
  // audio over "voice:speak-stream". transcribe takes a WAV ArrayBuffer, which
  // ipcRenderer.invoke structured-clones straight through.
  voice: {
    /** WAV ArrayBuffer in → { ok, text } out. */
    transcribe: (arrayBuffer) => invoke("voice:transcribe", arrayBuffer),
    /** Kicks off streamed synthesis; resolves with { requestId, started }. Listen with onSpeakStream. */
    speak: (text) => invoke("voice:speak", { text }),
    /** Abort one utterance, or all in-flight speech when requestId is omitted. */
    cancel: (requestId) => invoke("voice:cancel", { requestId }),
    /** callback receives { requestId, type: "meta"|"chunk"|"done"|"error", audio?, error? } */
    onSpeakStream: (callback) => subscribe("voice:speak-stream", callback),
  },

  // The local `hermes` CLI runtime. SECURITY: the renderer must gate this
  // behind push-to-talk only (requiresPushToTalk('hermes') === true) — it
  // spawns a real shell in main. run() acks with { requestId, started } and
  // streams output over "hermes:stream". No key, no endpoint.
  hermes: {
    /** Kicks off a streamed run; resolves with { requestId, started }. Listen with onStream. */
    run: (prompt, requestId) => invoke("hermes:run", { prompt, requestId }),
    cancel: (requestId) => invoke("hermes:cancel", { requestId }),
    /** callback receives { requestId, type: "chunk"|"done"|"error", delta?, error? } */
    onStream: (callback) => subscribe("hermes:stream", callback),
    /** → { state: "ready"|"setup-required"|"not-installed", command } */
    status: () => invoke("hermes:status"),
  },

  // Companion Hub persistence (userData-backed). load returns { ok, items },
  // save takes { items } and returns { ok } | { ok:false, error }.
  hub: {
    load: () => invoke("hub:load"),
    save: (items) => invoke("hub:save", { items }),
  },

  dialog: {
    openFile: (opts) => invoke("dialog:openFile", opts),
    saveFile: (opts) => invoke("dialog:saveFile", opts),
  },

  // Updates. Every method is argument-free on purpose: the renderer chooses
  // WHEN to check, download or install, never WHAT to fetch. The feed is pinned
  // in electron/updates/updater.js and no part of it crosses this bridge, so a
  // compromised renderer cannot redirect the updater at another source.
  updates: {
    getState: () => invoke("updates:getState"),
    check: () => invoke("updates:check"),
    download: () => invoke("updates:download"),
    install: () => invoke("updates:install"),
    openReleasePage: () => invoke("updates:openReleasePage"),
    onStatus: (callback) => subscribe("updates:status", callback),
  },
});
