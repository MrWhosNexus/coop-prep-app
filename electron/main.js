// electron/main.js
// Owns the BrowserWindow, app lifecycle, menu, and the security posture for
// the renderer. Loads the Next.js static export (`out/index.html`) via
// file:// in production, or the `next dev` server in development.
//
// Security posture (do not weaken without updating electron/README.md):
//   - contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true
//   - preload.js exposes a narrow, explicit API only (see that file)
//   - a strict CSP is attached to every response
//   - in-window navigation is limited to file:// and the dev server origin;
//     http(s) elsewhere is opened in the OS browser instead
//   - window.open() is denied in-window for the same reasons

import { app, BrowserWindow, Menu, session, shell } from "electron";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWindowState } from "./window-state.js";
import {
  DEV_SERVER_URL,
  resolveAppEntry,
  isAllowedNavigationTarget,
  isExternalHttpUrl,
} from "./resolve-path.js";
import { registerDefaultIpcHandlers } from "./ipc/index.js";
import { createFileBackend } from "../lib/store/backends.js";
import { createRegistry } from "../lib/endpoints/registry.js";
import { createFileStorage, ENDPOINTS_DIR_ENV } from "../lib/endpoints/store.js";
import { probeEndpoint, discoverModels } from "../lib/endpoints/probe.js";
import { callEndpoint } from "../lib/endpoints/call.js";
import { createLocalTts } from "./voice/tts-local.js";
import { createLocalStt } from "./voice/stt-local.js";
import { createHermesRuntime } from "./companion/hermes-runtime.js";
import { createHubStore } from "./companion/hub-store.js";
import {
  createUpdater,
  updateCapability,
  macBundleIsSigned,
  UPDATE_OWNER,
  UPDATE_REPO,
} from "./updates/updater.js";

/** Belt-and-braces prefix for the one URL main is ever asked to open externally. */
const UPDATE_OWNER_REPO = `${UPDATE_OWNER}/${UPDATE_REPO}`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/*
 * Pin the app name BEFORE anything reads app.getPath("userData").
 *
 * Electron only reads package.json for the app name when it is launched against
 * a DIRECTORY (`electron .`). Our own dev script launches a FILE
 * (`electron electron/main.js`), so app.getName() fell back to the literal
 * "Electron" and userData resolved to ~/.config/Electron — the shared directory
 * that EVERY unpackaged Electron app on the machine uses.
 *
 * That put this app's endpoints.json (with the user's API key) and store.json
 * (notes, progress) in a drawer shared with any other Electron project the user
 * happens to run in dev, while the PACKAGED build correctly used
 * ~/.config/coop-prep — so a key configured in dev silently never appeared in
 * the packaged app, and vice versa.
 *
 * setName here rather than only fixing the npm script: this holds however the
 * app is launched, including a bare `electron electron/main.js` by hand.
 * Must run before whenReady() — buildIpcDeps() resolves userData at that point.
 */
app.setName("coop-prep");

const isDev = process.env.ELECTRON_DEV === "1" || !app.isPackaged;

// Static export lives at <repo root>/out in dev, and next to the packaged
// app's resources in prod (see electron-builder.yml `extraResources`/`files`).
const appRoot = isDev ? path.join(__dirname, "..") : process.resourcesPath;

// --- CSP -------------------------------------------------------------------
//
// The renderer holds no API keys, but it can *ask main to use* them
// (endpoints:*, ai:call), so injected script running in it is the thing to
// prevent. The non-negotiable property below is that NO path ever admits a
// remote script origin: script-src names only 'self' and hash/keyword sources,
// so `<script src="https://evil.example.com/x.js">` can never execute.
//
// Why not a nonce (the textbook answer)? It needs a fresh value per response,
// injected at render time. This app is `output: 'export'` — the HTML is built
// once, ahead of time, with no server and no request to hang a nonce off. Next
// says so itself: "Next.js applies nonces during server-side rendering, based on
// the CSP header present in the request. Static pages are generated at build
// time, when no request or response headers exist—so no nonce can be injected."
// (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
// Baking one fixed nonce into a static file is security theatre — it is public,
// so any injected script can just wear it. Nonces are OUT.
//
// Why not 'unsafe-inline'? It is what Next's docs fall back to for the
// no-nonce case, but it re-opens exactly the hole a CSP is here to close: it
// admits ANY inline script, including one injected via rendered model output.
//
// So: hashes. `next build` emits unnonced inline scripts — the `coop_theme`
// bootstrap from app/layout.js, plus one `self.__next_f.push(...)` per RSC
// flight chunk — and `script-src 'self'` blocks every one of them, which is why
// React never hydrated. Their bodies are fixed once the export is built, so
// their hashes are too: exportScriptHashes() reads the built HTML at startup and
// pins each one. Hydration runs; anything not byte-identical to what we shipped
// does not. Note that hashing only the *known* bootstrap would not work — per
// the CSP spec, once script-src carries any hash, 'unsafe-inline' is ignored, so
// the flight chunks must be hashed too. It is all-or-nothing.
//
// Dev is the one place this relaxes: `next dev` generates its inline scripts
// per-request and React dev-builds need eval for error stacks, so there is
// nothing stable to hash. Dev-only, and never packaged — see buildCsp().

/** Matches an inline <script> (no src attribute) and captures its exact text. */
const INLINE_SCRIPT_RE = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;

/**
 * CSP hash source-expressions for every inline <script> in `html`.
 * Scripts with a `src` are left out on purpose — those are covered by 'self'.
 *
 * @param {string} html
 * @returns {string[]} e.g. ["'sha256-Ab1...='"]
 */
export function inlineScriptHashes(html) {
  return [...html.matchAll(INLINE_SCRIPT_RE)].map(
    ([, body]) => `'sha256-${crypto.createHash("sha256").update(body, "utf-8").digest("base64")}'`
  );
}

/**
 * Union of inline-script hashes across every .html file in the static export.
 * One policy is stamped on every response, so it must carry the hashes for all
 * pages, not just index.html. Returns [] (never throws) if the export is absent.
 *
 * @param {string} exportDir - the built `out/` directory
 * @returns {string[]} sorted, deduped
 */
export function exportScriptHashes(exportDir) {
  let entries;
  try {
    entries = fs.readdirSync(exportDir, { recursive: true, withFileTypes: true });
  } catch {
    return [];
  }
  const hashes = new Set();
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
    const html = fs.readFileSync(path.join(entry.parentPath, entry.name), "utf-8");
    for (const hash of inlineScriptHashes(html)) hashes.add(hash);
  }
  return [...hashes].sort();
}

/**
 * Build the policy. `script-src` is the only directive that differs between the
 * dev server and the packaged export; everything else is identical.
 *
 * @param {object} opts
 * @param {boolean} opts.isDev
 * @param {string[]} [opts.scriptHashes] - from exportScriptHashes(); packaged path only
 * @returns {string}
 */
export function buildCsp({ isDev: dev, scriptHashes = [] } = {}) {
  // 'unsafe-eval': React's dev build evals to rebuild server error stacks.
  // 'unsafe-inline': next dev's inline bootstrap is generated per request.
  // Both are dev-server-only and never reach a packaged build.
  const scriptSrc = dev ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] : ["'self'", ...scriptHashes];
  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/**
 * Is this response the app's own content? The CSP is scoped to it rather than
 * stamped onto every response the session sees: a policy on someone else's
 * response is not ours to set, and overwriting an upstream `Content-Security-
 * Policy` header would be actively wrong.
 *
 * @param {string} url - details.url from onHeadersReceived
 * @param {object} opts
 * @param {boolean} opts.isDev
 * @param {string} [opts.devServerUrl]
 * @returns {boolean}
 */
export function isAppOriginUrl(url, { isDev: dev, devServerUrl = DEV_SERVER_URL } = {}) {
  let target;
  try {
    target = new URL(url);
  } catch {
    return false;
  }
  // Packaged: our content is the file:// export, nothing else.
  if (!dev) return target.protocol === "file:";
  try {
    return target.origin === new URL(devServerUrl).origin;
  } catch {
    return false;
  }
}

function installCsp() {
  const entry = resolveAppEntry({ isDev, appRoot });
  // entry.target is <exportDir>/index.html in prod; keep the export dir in one place.
  const scriptHashes = entry.type === "file" ? exportScriptHashes(path.dirname(entry.target)) : [];
  if (!isDev && scriptHashes.length === 0) {
    console.warn(
      `[csp] no inline <script> found under ${path.dirname(entry.target)} — ` +
        "the export looks missing or empty; the window will not hydrate. Run `npm run electron:build`."
    );
  }
  const csp = buildCsp({ isDev, scriptHashes });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (!isAppOriginUrl(details.url, { isDev })) {
      callback({}); // not ours — pass the response through untouched
      return;
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
      },
    });
  });
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        {
          label: "Learn More",
          click: async () => {
            await shell.openExternal("https://github.com/MrWhosNexus/Coop-Prep");
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/** Deny in-window navigation/window-open to anything outside file://+dev-server; hand http(s) to the OS browser. */
function guardWindowNavigation(win) {
  win.webContents.on("will-navigate", (event, url) => {
    if (isAllowedNavigationTarget(url)) return;
    event.preventDefault();
    if (isExternalHttpUrl(url)) shell.openExternal(url);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalHttpUrl(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
}

async function createMainWindow() {
  const windowStateFile = path.join(app.getPath("userData"), "window-state.json");
  const windowState = createWindowState(windowStateFile);
  const { width, height, x, y, isMaximized } = windowState.state;

  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  windowState.track(win);
  guardWindowNavigation(win);

  win.once("ready-to-show", () => {
    if (isMaximized) win.maximize();
    win.show();
  });

  const entry = resolveAppEntry({ isDev, appRoot });
  if (entry.type === "url") {
    await win.loadURL(entry.target);
  } else {
    await win.loadFile(entry.target);
  }

  return win;
}

// --- IPC deps: the real lib/store + lib/endpoints wiring ---------------------
//
// endpoints:test / endpoints:models need the KEY-bearing record
// (registry.resolve), which registry.list()/add()/update() never expose — this
// wrapper is the only place that calls resolve(), and it never returns the
// result as-is: the key only ever flows INTO probe/discover/call, whose return
// shapes ({ ok, models, anthropic } / { ok, error }) don't carry it either.
function withProbing(registry) {
  return {
    ...registry,
    async test(id) {
      const endpoint = registry.resolve(id);
      if (!endpoint) return { ok: false, error: { type: "NOT_FOUND", message: "Endpoint not found." } };
      return probeEndpoint(endpoint);
    },
    async models(id) {
      const endpoint = registry.resolve(id);
      if (!endpoint) return { ok: false, error: { type: "NOT_FOUND", message: "Endpoint not found." } };
      return discoverModels(endpoint);
    },
  };
}

/**
 * An AI failure that carries lib/endpoints/call.js's TYPED error alongside the
 * message, so electron/ipc/handlers.js can forward `type`/`status`/`hint` to the
 * renderer instead of a bare string. The renderer's whole error UI branches on
 * `error.type` ("your key was rejected — open Settings" vs "the endpoint is
 * unreachable"); flattening the object here is what made every one of those
 * branches unreachable and rendered auth, network and no-key failures as one
 * generic "The AI call failed".
 *
 * `error` is safe to carry: callEndpoint's typed errors are key-free by
 * construction (provider text goes through redactKey, and no field holds the
 * key). handlers.js re-picks the fields it forwards regardless.
 */
class AiCallError extends Error {
  /** @param {{type?: string, message?: string, hint?: string, status?: number}} [error] */
  constructor(error) {
    super(error?.message || error?.hint || error?.type || "AI call failed");
    this.name = "AiCallError";
    /** @type {object} the typed error from lib/endpoints/call.js */
    this.aiError = { type: "API_ERROR", ...error };
  }
}

/**
 * The `deps.ai` port for createHandlers, over the key-bearing registry.
 *
 * `call` resolves with `{ text }` — the FULL assistant text — and not merely
 * whatever `onChunk` streamed. callEndpoint branches on the response's
 * content-type, not on the `stream: true` we asked for, because providers are
 * free to ignore it and answer with a whole JSON body (a normal Ollama/gateway
 * behaviour, and this is a BYO-endpoint app). On that path onChunk is called
 * ZERO times, so a caller that only accumulates deltas ends up with "" while
 * every signal says success — the tool then writes an empty result over the
 * user's draft. The text is authoritative for both paths: for SSE it is the
 * same accumulation the deltas produced.
 *
 * @param {object} registry - createRegistry()'s return value (resolve() bearing)
 * @returns {{ call: (request: object, onChunk: (delta: string) => void, signal: AbortSignal) => Promise<{text: string}> }}
 */
function makeAi(registry) {
  return {
    async call({ endpointId, model, messages, options }, onChunk, signal) {
      const endpoint = registry.resolve(endpointId);
      // callEndpoint takes no signal itself — inject one via the fetch it's given.
      const fetchWithSignal = (url, opts) => fetch(url, { ...opts, signal });
      const result = await callEndpoint(
        {
          endpoint,
          model,
          messages,
          stream: true,
          onDelta: onChunk,
          maxTokens: options?.maxTokens,
          effort: options?.effort,
        },
        fetchWithSignal
      );
      if (!result.ok) {
        // callEndpoint's typed errors are already key-free (redactKey).
        throw new AiCallError(result.error);
      }
      return { text: typeof result.text === "string" ? result.text : "" };
    },
  };
}

/**
 * Build the { store, endpoints, ai } deps for createHandlers from the real libs.
 *
 * Exported so tests can exercise THE SHIPPED WIRING. Asserting the 0600/0700/
 * atomic properties against lib/endpoints/store.js directly proves nothing about
 * the app unless this function is the thing that uses it.
 *
 * @returns {{ store: object, endpoints: object, ai: object }}
 */
export function buildIpcDeps() {
  // The store is given userData as its DIRECTORY rather than via createFileStorage's
  // `electronApp` option, which resolves to userData/coop-prep — a path this app has
  // never written. Taking it would strand every existing user's endpoints.json at
  // userData/endpoints.json: their keys would read as "nothing configured" and the
  // first write would land somewhere else entirely. The file stays exactly where it
  // has always been; only the code that reads and writes it gets hardened.
  // A real COOP_ENDPOINTS_DIR override still wins, as it does everywhere else.
  const endpointsStorage = createFileStorage({
    env: { [ENDPOINTS_DIR_ENV]: process.env[ENDPOINTS_DIR_ENV] || app.getPath("userData") },
  });
  const registry = createRegistry({ storage: endpointsStorage });

  // Local voice runs Kokoro/Whisper in-process — no key, no cloud. The heavy
  // ONNX runtime is dynamic-imported inside these engines, so constructing them
  // here is cheap: nothing native loads until the first speak()/transcribe().
  // Models cache under userData/{tts,stt}-models (COOP_TTS_CACHE_DIR /
  // COOP_STT_CACHE_DIR override); ~165 MB downloads on first use.
  const userDataDir = app.getPath("userData");
  const tts = createLocalTts({ userDataDir });
  const stt = createLocalStt({ userDataDir });
  const voice = {
    sampleRate: tts.sampleRate,
    transcribe: (audio) => stt.transcribe(audio),
    speak: (text, opts) => tts.speak(text, opts),
  };

  // The Hermes CLI runtime (PTT-only, spawns a real shell with a scrubbed env)
  // and the companion Hub store (userData-backed). Constructing them here is
  // cheap — neither spawns nor touches disk until first use. No companion turn
  // wiring: the endpoint-backed 'nexus' turn goes through the existing
  // makeAi(registry) via ai:call, unchanged.
  const hermes = createHermesRuntime();
  const hub = createHubStore({ userDataDir });

  return {
    store: createFileBackend(path.join(app.getPath("userData"), "store.json")),
    endpoints: withProbing(registry),
    ai: makeAi(registry),
    voice,
    hermes,
    hub,
  };
}

/**
 * Grant microphone access to the app's own renderer so wav16.js's
 * getUserMedia({ audio: true }) succeeds. Electron denies every permission by
 * default, so with no handler the mic capture silently fails; `sandbox: true`
 * does NOT block Web Audio / getUserMedia — this handler is the only gate. The
 * renderer is our own file:// export, and only "media" is allowed; every other
 * permission stays denied. CSP is unchanged (the audio path is same-origin).
 */
function installVoicePermissions() {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === "media");
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === "media");
}

/**
 * Build the update controller, or null when this install cannot use one.
 *
 * electron-updater is imported DYNAMICALLY and only for packaged builds. Two
 * reasons, both load-bearing: it is a main-process-only CommonJS package that
 * pulls a sizeable dependency tree, and importing it in an unpackaged app makes
 * it log and throw about a missing app-update.yml — noise on every `npm run
 * electron:dev`. A failure to load is never fatal: the app runs fine without an
 * updater, and every update channel already answers "disabled".
 *
 * @returns {Promise<object|null>}
 */
async function buildUpdater() {
  const capability = updateCapability({
    platform: process.platform,
    isPackaged: app.isPackaged,
    env: process.env,
    isMacSigned:
      process.platform === "darwin" && app.isPackaged
        ? macBundleIsSigned({ appPath: app.getAppPath(), exists: fs.existsSync })
        : false,
  });
  if (capability.mode === "disabled") return null;

  let autoUpdater;
  try {
    ({ autoUpdater } = await import("electron-updater"));
  } catch (e) {
    console.warn(`[updates] electron-updater unavailable, updates disabled: ${e?.message}`);
    return null;
  }

  return createUpdater({
    autoUpdater,
    currentVersion: app.getVersion(),
    capability,
    // Push every transition to whatever window exists. Downloads report
    // progress for minutes; polling from the renderer would either miss the
    // end or spin.
    onState: (state) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.webContents.send("updates:status", state);
      }
    },
    // The only URL this ever receives is one releasePageUrl() built from the
    // pinned owner/repo — never a field off the update feed.
    openExternal: (url) => {
      if (typeof url === "string" && url.startsWith(`https://github.com/${UPDATE_OWNER_REPO}/releases`)) {
        shell.openExternal(url);
      }
    },
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    installCsp();
    installVoicePermissions();
    buildMenu();
    registerDefaultIpcHandlers({ ...buildIpcDeps(), updates: await buildUpdater() });
    createMainWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
