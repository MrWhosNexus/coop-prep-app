// electron/ipc/handlers.js
// Concrete IPC handlers. This file imports "electron" (app, dialog) and is
// therefore NOT imported by node --test — see test/electron-shell.test.js,
// which exercises the pure pieces (validators.js, window-state.js,
// resolve-path.js) instead.
//
// `createHandlers(deps)` is the seam: `deps.store`, `deps.endpoints`, and
// `deps.ai` are where lib/store/ and lib/endpoints/ (owned by other agents,
// and already present in this repo as of this writing) plug in. This file
// does NOT import them directly — see electron/README.md "Wiring lib/store
// and lib/endpoints" for the exact adapter code that turns those modules'
// real exports into the three shapes below. Until wired, the defaults here
// keep the app running (in-memory endpoints, a plain JSON-in-userData store,
// ai:call reporting itself as not wired) so nothing crashes on first boot.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { app, dialog } from "electron";
import * as V from "./validators.js";

const MAX_IMPORT_BYTES = 25 * 1024 * 1024; // 25MB guard for CSV imports

/**
 * Default store: same read()/write(text) shape as lib/store/backends.js's
 * createFileBackend (Promise<string|null> / Promise<void> over a whole
 * serialized document) — so `deps.store = createFileBackend(storeFilePath)`
 * is a literal drop-in replacement, no adapter needed.
 */
function makeDefaultStore() {
  const filePath = path.join(app.getPath("userData"), "store.json");
  return {
    async read() {
      try {
        return await fs.promises.readFile(filePath, "utf-8");
      } catch (err) {
        if (err && err.code === "ENOENT") return null;
        throw err;
      }
    },
    async write(text) {
      const dir = path.dirname(filePath);
      await fs.promises.mkdir(dir, { recursive: true });
      const tmpPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
      await fs.promises.writeFile(tmpPath, text, "utf-8");
      await fs.promises.rename(tmpPath, filePath);
    },
  };
}

/**
 * Default endpoints registry: in-memory only (nothing survives a restart —
 * that's the point: it makes it obvious this is a placeholder). Shaped after
 * lib/endpoints/registry.js's createRegistry() return value: list/get return
 * views (never the key), add/update return { ok, endpoint } | { ok, error },
 * and the delete method is named `remove` there — this file's handler maps
 * the endpoints:delete CHANNEL onto whichever the injected dep exposes (see
 * `callDelete` below) so either shape works.
 * test()/models() report "not wired" rather than silently returning [].
 */
function makeDefaultEndpoints() {
  const byId = new Map();
  const now = () => new Date().toISOString();

  return {
    list() {
      return [...byId.values()].map(V.toEndpointView);
    },
    add(fields) {
      const id = crypto.randomUUID();
      const ts = now();
      const record = { id, providerId: "custom", createdAt: ts, updatedAt: ts, ...fields };
      byId.set(id, record);
      return { ok: true, endpoint: V.toEndpointView(record) };
    },
    update(id, patch) {
      const existing = byId.get(id);
      if (!existing) return { ok: false, error: { type: "NOT_FOUND", message: "Endpoint not found." } };
      const updated = { ...existing, ...patch, updatedAt: now() };
      byId.set(id, updated);
      return { ok: true, endpoint: V.toEndpointView(updated) };
    },
    remove(id) {
      return { ok: byId.delete(id) };
    },
    async test(_id) {
      return { ok: false, error: { type: "NO_BACKEND", message: "endpoints:test is unavailable in this bridge-less fallback; the real endpoint backend runs in the Electron main process." } };
    },
    async models(_id) {
      return { ok: false, error: { type: "NO_BACKEND", message: "endpoints:models is unavailable in this bridge-less fallback; the real endpoint backend runs in the Electron main process." } };
    },
  };
}

/**
 * Default AI dep: reports every call as not-wired instead of making network
 * requests. The real implementation wraps lib/endpoints/call.js#callEndpoint
 * and must never let `apiKey` cross back to the renderer, including in error
 * messages (callEndpoint already scrubs provider error text via redactKey).
 */
function makeDefaultAi() {
  return {
    /**
     * Must call `onChunk(delta)` zero or more times, then resolve with
     * `{ text }` (the full assistant text) or reject. See `toStreamError` and
     * the ai:call handler for what each half of that contract is for.
     */
    async call(_request, _onChunk, _signal) {
      throw new Error("ai:call is unavailable in this bridge-less fallback; the real AI client runs in the Electron main process.");
    },
  };
}

/**
 * Default voice dep: reports unavailable rather than loading anything. The real
 * implementation (electron/voice/{tts,stt}-local.js, wired in
 * electron/main.js#buildIpcDeps) runs local Kokoro/Whisper in-process. This
 * stub keeps `node --test` and a bridge-less boot from crashing — the same
 * honest-degrade posture the renderer's lib/voice/engine.js already assumes.
 */
function makeDefaultVoice() {
  return {
    sampleRate: 24000,
    async transcribe() {
      return { ok: false, text: "", reason: "voice model unavailable" };
    },
    async speak() {
      throw new Error("voice model unavailable");
    },
  };
}

/**
 * Default hermes dep: unavailable in a bridge-less fallback. The real runtime
 * (electron/companion/hermes-runtime.js, wired in electron/main.js#buildIpcDeps)
 * spawns the local `hermes` CLI with a scrubbed env. This stub keeps
 * `node --test` and a bridge-less boot from crashing, and — since a bridge-less
 * process has no business spawning a shell — refuses to run.
 */
function makeDefaultHermes() {
  return {
    async run() {
      throw new Error("hermes unavailable in this bridge-less fallback");
    },
    async status() {
      return { state: "not-installed", command: "hermes", detail: "Hermes runtime not wired in this fallback." };
    },
  };
}

/**
 * Default hub dep: an empty, non-persisting Hub. Keeps the companion openable
 * under `node --test` without touching userData. The real store
 * (electron/companion/hub-store.js) is wired in buildIpcDeps.
 */
function makeDefaultHub() {
  return {
    async load() {
      return { ok: true, items: [] };
    },
    async save() {
      return { ok: true };
    },
  };
}

/** The only fields of a typed AI error that may cross to the renderer. */
const AI_ERROR_FIELDS = ["type", "status", "message", "hint"];

/**
 * Shape a rejected `ai.call` into the `ai:stream` error payload.
 *
 * lib/endpoints/call.js defines a TYPED error contract (AUTH_ERROR carrying an
 * actionable `hint` naming Settings, NETWORK_ERROR, BAD_RESPONSE, …) precisely
 * so the renderer can say "your key was rejected — open Settings" instead of one
 * generic failure. Stringifying it here is what made every renderer branch on
 * `error.type` dead code, so the object is forwarded when `deps.ai` provides one
 * on the rejection's `aiError` (electron/main.js#AiCallError does).
 *
 * Fields are PICKED, never spread: `aiError` comes from a dep this file does not
 * own, and ipcMain sends whatever it is given straight across the contextBridge.
 * An allow-list is what makes "no key material reaches the renderer" a property
 * of this file rather than a promise made by another one. Anything else — a bug,
 * a dep with no typed error — stays a plain string, as before.
 *
 * @param {any} err
 * @returns {object|string}
 */
function toStreamError(err) {
  const typed = err?.aiError;
  if (!typed || typeof typed !== "object") return String(err?.message ?? err);

  /** @type {Record<string, unknown>} */
  const error = {};
  for (const field of AI_ERROR_FIELDS) {
    if (typed[field] !== undefined) error[field] = typed[field];
  }
  if (typeof error.type !== "string" || !error.type) error.type = "API_ERROR";
  // A provider can answer 401 with an unparseable body, leaving `message` empty.
  if (typeof error.message !== "string" || !error.message) {
    error.message = typeof error.hint === "string" && error.hint ? error.hint : "The AI call failed.";
  }
  return error;
}

// validators.js's `fail(field, expected)` throws `${field} must be ${expected}`
// and ValidationError carries no `field` property, so the field name is
// recovered from the message. Coupled to that one format on purpose: the
// alternative is a renderer that cannot mark up the offending input at all.
const VALIDATION_FIELD_RE = /^(\S+) must be /;

/**
 * Marshal a ValidationError into the same { ok: false, error } shape
 * lib/endpoints/registry.js returns for the identical mistake, so a form can
 * render per-field errors off `error.field` on the web AND desktop paths.
 *
 * @param {import("./validators.js").ValidationError} err
 * @returns {{ ok: false, error: { type: string, field?: string, message: string } }}
 */
function toValidationFailure(err) {
  const field = VALIDATION_FIELD_RE.exec(err.message)?.[1];
  return { ok: false, error: { type: "VALIDATION_ERROR", ...(field ? { field } : {}), message: err.message } };
}

/**
 * Run an endpoints:add/update body under the registry's result contract.
 *
 * A rejected `invoke` reaches the renderer as a mangled message string with no
 * `error.field`, making the documented { ok: false, error } branch unreachable —
 * so bad INPUT resolves to that shape instead of throwing.
 *
 * An unexpected internal error is a bug, not something the user can correct, so
 * it still rejects — but with a scrubbed message. `args` on these two channels
 * carries `apiKey`, and ipcMain.handle sends a thrown error's message across the
 * contextBridge verbatim; an error built from those args (a stringified record,
 * a request URL with the key in the query) would hand the key to the renderer.
 * The real error stays in the main-process log, where it is safe and useful.
 *
 * @param {string} channel
 * @param {() => any} run
 */
async function underResultContract(channel, run) {
  try {
    return await run();
  } catch (err) {
    if (err instanceof V.ValidationError) return toValidationFailure(err);
    console.error(`[ipc] ${channel} failed:`, err);
    throw new Error(`${channel} failed. See the application log for details.`);
  }
}

/**
 * Build the full channel -> handler map for ipcMain.handle.
 * @param {object} [deps]
 * @param {{read: () => Promise<string|null>, write: (text: string) => Promise<void>}} [deps.store]
 * @param {{list, add, update, remove?, delete?, test, models}} [deps.endpoints]
 * @param {{call: (request, onChunk, signal) => Promise<{text?: string}|void>}} [deps.ai]
 * @param {{sampleRate?: number, transcribe: (audio) => Promise<{ok: boolean, text: string, reason?: string}>, speak: (text, {onChunk, signal}) => Promise<void>}} [deps.voice]
 * @param {{run: (prompt: string, {onChunk, signal}) => Promise<void>, status: () => Promise<{state: string, command: string}>}} [deps.hermes]
 * @param {{load: () => Promise<{ok: boolean, items: object[]}>, save: (items: object[]) => Promise<{ok: boolean, error?: string}>}} [deps.hub]
 */
/**
 * What the update channels answer with when no updater is wired in (running
 * from source, or a build that deliberately ships without one). Shaped exactly
 * like createUpdater()'s snapshot so the renderer needs no second code path.
 */
const DISABLED_UPDATE_STATE = Object.freeze({
  state: "disabled",
  mode: "disabled",
  version: null,
  releaseUrl: "",
  percent: 0,
  message: "Updates apply to installed builds.",
  currentVersion: "",
  canInstall: false,
});

export function createHandlers(deps = {}) {
  const store = deps.store ?? makeDefaultStore();
  const endpoints = deps.endpoints ?? makeDefaultEndpoints();
  const ai = deps.ai ?? makeDefaultAi();
  const voice = deps.voice ?? makeDefaultVoice();
  const hermes = deps.hermes ?? makeDefaultHermes();
  const hub = deps.hub ?? makeDefaultHub();
  // No default: an app with no updater wired in simply reports "disabled"
  // rather than inventing one. Never construct a live updater implicitly —
  // that is a subsystem that downloads and runs code.
  const updates = deps.updates ?? null;

  // lib/endpoints/registry.js names its removal method `remove`; the default
  // stub above also exposes `remove`. Support either name so a real registry
  // can be passed in unmodified.
  const callDelete = (id) => (endpoints.remove ? endpoints.remove(id) : endpoints.delete(id));

  /** requestId -> AbortController, so ai:cancel can stop an in-flight stream. */
  const inFlight = new Map();

  /**
   * requestId -> AbortController for voice:speak. Kept separate from `inFlight`
   * so a voice:cancel with no requestId (abort-all) never reaches into an
   * unrelated ai:call stream.
   */
  const voiceInFlight = new Map();

  /**
   * requestId -> AbortController for hermes:run. Kept separate from `inFlight`
   * and `voiceInFlight` for the same isolation reason: a hermes:cancel must
   * reach ONLY the spawned CLI child it names, never an unrelated ai:call or
   * voice stream. The scrubEnv on the child lives inside the runtime, not here.
   */
  const hermesInFlight = new Map();

  return {
    "app:getVersion": async () => app.getVersion(),

    "app:getPaths": async () => ({
      userData: app.getPath("userData"),
      documents: app.getPath("documents"),
      downloads: app.getPath("downloads"),
      temp: app.getPath("temp"),
    }),

    "store:read": async () => store.read(),

    "store:write": async (_evt, args) => {
      const text = V.validateStoreWrite(args);
      await store.write(text);
      return { ok: true };
    },

    // endpoints.list()/add()/update() already return views (or {ok,error}
    // shapes for the mutating calls) per lib/endpoints/registry.js's
    // contract — nothing further to reshape here.
    "endpoints:list": async () => endpoints.list(),

    // add/update go through underResultContract so a validation failure RESOLVES
    // to { ok: false, error } exactly as the registry's own does on the web path,
    // rather than rejecting the invoke. See that function for why internal errors
    // are treated differently.
    "endpoints:add": async (_evt, args) =>
      underResultContract("endpoints:add", () => endpoints.add(V.validateEndpointInput(args))),

    "endpoints:update": async (_evt, args) =>
      underResultContract("endpoints:update", () => {
        const { id, patch } = V.validateEndpointUpdate(args);
        return endpoints.update(id, patch);
      }),

    "endpoints:delete": async (_evt, args) => {
      const { id } = V.validateEndpointId(args);
      return callDelete(id);
    },

    "endpoints:test": async (_evt, args) => {
      const { id } = V.validateEndpointId(args);
      return endpoints.test(id);
    },

    "endpoints:models": async (_evt, args) => {
      const { id } = V.validateEndpointId(args);
      return endpoints.models(id);
    },

    "ai:call": async (evt, args) => {
      const { endpointId, model, requestId, messages, options } = V.validateAiCallInput(args);
      if (inFlight.has(requestId)) {
        throw new Error(`requestId ${requestId} is already in flight`);
      }
      const controller = new AbortController();
      inFlight.set(requestId, controller);
      const sender = evt.sender;
      const send = (payload) => {
        if (!sender.isDestroyed()) sender.send("ai:stream", { requestId, ...payload });
      };

      // Fire-and-forget: the promise below resolves as soon as the stream
      // finishes (or errors), but ai:call itself returns immediately with an
      // ack so the renderer can start listening on "ai:stream" right away.
      (async () => {
        try {
          const result = await ai.call(
            { endpointId, model, messages, options },
            (delta) => send({ type: "chunk", delta }),
            controller.signal
          );
          // `text` is the WHOLE answer, and it is not the same information as
          // the deltas: a provider is free to ignore `stream: true` and reply
          // with one JSON body, in which case onChunk fired zero times and the
          // renderer accumulated nothing. Sending only { type: "done" } there
          // resolved the call as a success with an empty string — the AI tools
          // then silently wrote that emptiness over the user's draft. A dep
          // that resolves with nothing keeps the old meaning (lib/ai/client.js
          // falls back to what it accumulated), so this stays additive.
          send({ type: "done", ...(typeof result?.text === "string" ? { text: result.text } : {}) });
        } catch (err) {
          if (controller.signal.aborted) {
            send({ type: "error", error: "cancelled" });
          } else {
            send({ type: "error", error: toStreamError(err) });
          }
        } finally {
          inFlight.delete(requestId);
        }
      })();

      return { requestId, started: true };
    },

    "ai:cancel": async (_evt, args) => {
      const { requestId } = V.validateAiCancel(args);
      const controller = inFlight.get(requestId);
      if (controller) controller.abort();
      return { ok: true };
    },

    // --- voice: local Kokoro TTS + Whisper STT, in-process, no key ----------
    //
    // transcribe is a plain invoke (small WAV in, text out). speak mirrors the
    // ai:call shape exactly: an immediate { requestId, started } ack, then audio
    // pushed over the "voice:speak-stream" channel as { requestId, type, audio? }.
    // Float32 chunks cross by structured clone — never hex-encoded.

    "voice:transcribe": async (_evt, args) => {
      const { audio } = V.validateVoiceTranscribe(args);
      // stt-local returns { ok, text } | { ok:false, reason } and never throws —
      // an unavailable model degrades honestly rather than crashing main.
      return voice.transcribe(audio);
    },

    "voice:speak": async (evt, args) => {
      const { text } = V.validateVoiceSpeak(args);
      // Unlike ai:call, main mints the requestId — the renderer only sends text.
      const requestId = crypto.randomUUID();
      const controller = new AbortController();
      voiceInFlight.set(requestId, controller);
      const sender = evt.sender;
      const send = (payload) => {
        if (!sender.isDestroyed()) sender.send("voice:speak-stream", { requestId, ...payload });
      };

      // Fire-and-forget, exactly like ai:call: return the ack immediately so the
      // renderer can subscribe to "voice:speak-stream" before the first chunk.
      (async () => {
        try {
          send({ type: "meta", sampleRate: voice.sampleRate ?? 24000 });
          await voice.speak(text, {
            onChunk: (audio) => send({ type: "chunk", audio }),
            signal: controller.signal,
          });
          if (!controller.signal.aborted) send({ type: "done" });
        } catch (err) {
          if (controller.signal.aborted) {
            send({ type: "error", error: "cancelled" });
          } else {
            // No key material is ever in the voice path, so a plain message is safe.
            send({ type: "error", error: String(err?.message ?? err) });
          }
        } finally {
          voiceInFlight.delete(requestId);
        }
      })();

      return { requestId, started: true };
    },

    "voice:cancel": async (_evt, args) => {
      const { requestId } = V.validateVoiceCancel(args);
      if (requestId) {
        const controller = voiceInFlight.get(requestId);
        if (controller) controller.abort();
      } else {
        // No id: barge-in / stop everything the widget has in flight.
        for (const controller of voiceInFlight.values()) controller.abort();
      }
      return { ok: true };
    },

    // --- hermes: the local `hermes -z <prompt>` CLI (PTT-ONLY) --------------
    //
    // *** SECURITY: this spawns a real shell / RCE surface. It is only ever
    // reached from the renderer's push-to-talk path (requiresPushToTalk('hermes')
    // === true) — an always-on / wake-word mic frame can NEVER reach here; the
    // gate is at capture in EndpointVoiceProvider.onMicFrame. The child inherits
    // a scrubbed env (see hermes-runtime.js#scrubEnv). No key material is in this
    // path, so a rejected run streams a plain String(err) — same as voice.
    //
    // Mirrors the ai:call / voice:speak shape: an immediate { requestId, started }
    // ack, then output pushed over "hermes:stream" as chunks then done|error.

    "hermes:run": async (evt, args) => {
      const { prompt, requestId } = V.validateHermesRun(args);
      if (hermesInFlight.has(requestId)) {
        throw new Error(`requestId ${requestId} is already in flight`);
      }
      const controller = new AbortController();
      hermesInFlight.set(requestId, controller);
      const sender = evt.sender;
      const send = (payload) => {
        if (!sender.isDestroyed()) sender.send("hermes:stream", { requestId, ...payload });
      };

      // Fire-and-forget, exactly like ai:call/voice:speak: return the ack
      // immediately so the renderer can subscribe to "hermes:stream" first.
      (async () => {
        try {
          await hermes.run(prompt, {
            onChunk: (delta) => send({ type: "chunk", delta }),
            signal: controller.signal,
          });
          if (controller.signal.aborted) {
            send({ type: "error", error: "cancelled" });
          } else {
            send({ type: "done" });
          }
        } catch (err) {
          if (controller.signal.aborted) {
            send({ type: "error", error: "cancelled" });
          } else {
            // No key material is ever in the hermes path, so a plain message is safe.
            send({ type: "error", error: String(err?.message ?? err) });
          }
        } finally {
          hermesInFlight.delete(requestId);
        }
      })();

      return { requestId, started: true };
    },

    "hermes:cancel": async (_evt, args) => {
      const { requestId } = V.validateHermesCancel(args);
      const controller = hermesInFlight.get(requestId);
      if (controller) controller.abort();
      return { ok: true };
    },

    "hermes:status": async () => hermes.status(),

    // --- hub: companion Hub persistence under userData ----------------------

    "hub:load": async () => hub.load(),

    "hub:save": async (_evt, args) => {
      const { items } = V.validateHubSave(args);
      return hub.save(items);
    },

    "dialog:openFile": async (evt, args) => {
      const { filters, multiple } = V.validateOpenDialogOptions(args);
      const win = evt.sender.getOwnerBrowserWindow?.() ?? undefined;
      const result = await dialog.showOpenDialog(win, {
        properties: multiple ? ["openFile", "multiSelections"] : ["openFile"],
        filters,
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true, files: [] };
      }
      const files = result.filePaths.map((filePath) => {
        const stat = fs.statSync(filePath);
        if (stat.size > MAX_IMPORT_BYTES) {
          return { filePath, error: `file exceeds ${MAX_IMPORT_BYTES} byte import limit` };
        }
        return { filePath, content: fs.readFileSync(filePath, "utf-8") };
      });
      return { canceled: false, files };
    },

    "dialog:saveFile": async (evt, args) => {
      const { content, defaultPath, filters } = V.validateSaveDialogOptions(args);
      const win = evt.sender.getOwnerBrowserWindow?.() ?? undefined;
      const result = await dialog.showSaveDialog(win, { defaultPath, filters });
      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }
      fs.writeFileSync(result.filePath, content, "utf-8");
      return { canceled: false, filePath: result.filePath };
    },

    // --- Updates ------------------------------------------------------------
    //
    // Every one of these is argument-free. The renderer decides WHEN, never
    // WHAT: no feed URL, version, or download target crosses the bridge, so
    // injected script in the renderer cannot aim the updater somewhere else.
    // With no updater wired in, each reports a "disabled" state rather than
    // throwing — the Settings panel renders the same either way.
    "updates:getState": async () => updates?.getState() ?? DISABLED_UPDATE_STATE,
    "updates:check": async () => (updates ? updates.check() : DISABLED_UPDATE_STATE),
    "updates:download": async () => (updates ? updates.download() : DISABLED_UPDATE_STATE),
    "updates:install": async () => updates?.install() ?? DISABLED_UPDATE_STATE,
    "updates:openReleasePage": async () => updates?.openReleasePage() ?? DISABLED_UPDATE_STATE,
  };
}
