# The Electron shell

Wraps the existing Next.js app (unchanged) as a desktop app on Linux and
Windows, without turning it into a client/server app. Next builds a static
export (`output: 'export'` → `out/`); Electron's main process loads that
export into a locked-down `BrowserWindow` and owns everything that needs
Node — filesystem, the AI endpoint registry, API keys.

```
electron/
  main.js          BrowserWindow, app lifecycle, menu, CSP, navigation guards
  preload.js       contextBridge: the ONLY thing the renderer can call into main with
  window-state.js  remembers window size/position (pure, no Electron import)
  resolve-path.js  dev-server-vs-file:// URL resolution (pure, no Electron import)
  ipc/
    index.js       registers the handler map on ipcMain
    handlers.js     the concrete handlers (imports electron)
    validators.js   pure argument validation + view-shaping (no Electron import)
```

`window-state.js`, `resolve-path.js`, and `ipc/validators.js` have zero
`import "electron"` at module scope on purpose — they're exercised directly
under plain `node --test` (see `test/electron-shell.test.js`).

`main.js` and `ipc/handlers.js` do import `electron`. `test/electron-shell.test.js`
still reaches their pure logic — CSP header construction, the IPC handler
contract — by swapping that one specifier for a stub via `registerHooks()`
(`node:module`, in-process, no CLI flag). The stub's `app.whenReady()` never
settles, so main.js's bootstrap stays inert and importing it only yields its
exports. That covers the *logic*; it does not boot Chromium, so it can never
tell you whether a policy is actually applied or a page actually hydrates —
there is no substitute for launching the app (see "Verifying" below).

## Required package.json / next.config.mjs changes

Not applied here — those files belong to another part of this integration.
Paste exactly this.

**package.json** — add a top-level `"main"` field (electron-builder and
`electron .` both need it) and three scripts:

```json
{
  "main": "electron/main.js",
  "scripts": {
    "electron:dev": "concurrently -k -n NEXT,ELECTRON -c blue,magenta \"next dev\" \"wait-on http://localhost:3000 && electron electron/main.js\"",
    "electron:build": "next build",
    "dist": "npm run electron:build && electron-builder"
  }
}
```

(Merge `scripts` into the existing block — don't replace `dev`/`build`/`start`/`lint`/`test`/`build:mobile`.)

devDependencies to add: `electron`, `electron-builder`, `concurrently`, `wait-on`.
Pin to whatever's current at integration time; nothing here depends on a
specific minor version.

**next.config.mjs** — replace the placeholder with:

```js
// @ts-check
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

/** @type {(phase: string) => import('next').NextConfig} */
export default function nextConfig(phase) {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    output: "export",
    images: { unoptimized: true },
    trailingSlash: true,
    // Next always emits root-absolute "/_next/..." asset URLs. That 404s the
    // instant `out/index.html` is opened via file:// (there's no server to
    // root "/" at the export folder), or via a plain double-click. Setting a
    // *relative* assetPrefix makes those into "./_next/...", which resolves
    // against the HTML file's own location instead. This is a known
    // community workaround for exactly this Electron/file:// case, not an
    // officially documented flag -- if a Next upgrade ever breaks it, check
    // node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/assetPrefix.md
    // for what changed, and fall back to serving `out/` over a local
    // 127.0.0.1 HTTP server from main.js instead of file:// if it does.
    assetPrefix: isDev ? undefined : "./",
  };
}
```

This is THE known trap in "static export + file://". Verify it by opening
devtools in the packaged app (or `electron:build` + manually loading
`out/index.html` in a plain browser tab) and checking the console for 404s on
`_next/static/...` — a blank white window with correct HTML but no styling or
interactivity is the signature of this trap still being unfixed.

## electron-builder.yml

Owned by this subsystem (already written, no action needed). Targets Linux
(AppImage + deb) and Windows (nsis). It copies `out/` in as `extraResources`
rather than bundling it into the asar, so `main.js`'s prod path
(`process.resourcesPath/out/index.html`) matches its dev path
(`<repo root>/out/index.html`) in shape — only the root differs. Requires
`npm run electron:build` (i.e. `next build`) to have already produced `./out`
before `electron-builder` runs — `dist` does that for you.

## Running it

- `npm run electron:dev` — hot-reloading dev loop: `next dev` on :3000,
  Electron waits for it (`wait-on`) then loads `http://localhost:3000` (see
  `resolveAppEntry` in `resolve-path.js`; dev mode is detected via
  `!app.isPackaged`, so no env var juggling is needed).
- `npm run electron:build` — produces `./out` only, no packaging.
- `npm run dist` — full build: `next build` then `electron-builder` (needs
  the package.json/next.config.mjs changes above applied first).

None of this can be exercised in this sandboxed/headless environment (no
display, `electron` isn't installed here) — it's written and reasoned through
against the pure test suite and Electron's documented APIs, but a real launch
on the target machine is the only way to confirm the file:// asset-path fix
and the CSP header actually take effect end-to-end. Do that before shipping.

## Security model

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`,
  `webSecurity: true` on the one `BrowserWindow` main.js creates. Don't add a
  second window without the same options.
- `preload.js` is the *only* bridge. It exposes a hand-written object
  (`window.coop`) with one method per IPC channel — never `ipcRenderer`
  itself, never `require`, never a "pass anything through" escape hatch. If a
  new feature needs a new capability, it needs a new named method here, not a
  generic one.
- Every handler in `ipc/handlers.js` validates its arguments through
  `ipc/validators.js` before touching fs, the endpoint registry, or the
  network. The renderer is untrusted even though it's our own code — a
  compromised or bugged renderer should not be able to smuggle a path
  traversal, an oversized payload, or a malformed message array into main.
- API keys never reach the renderer. `endpoints:list`/`add`/`update` only
  ever return `hasKey: boolean`, never `apiKey`. See "Wiring lib/store and
  lib/endpoints" below — this is enforced by `lib/endpoints/registry.js`'s
  own `toView`, and defended a second time by
  `ipc/validators.js#toEndpointView` in case a handler is ever wired to
  something that forgets to strip it.
- Navigation is locked down in `main.js`: `will-navigate` only allows file://
  (our own export) or the configured dev-server origin; everything else is
  cancelled, and http(s) targets are hijacked to `shell.openExternal` instead
  (so an in-app link still opens somewhere, just not inside the app's own
  window). `setWindowOpenHandler` denies all `window.open()` calls the same
  way. Both are backed by pure, tested functions in `resolve-path.js`
  (`isAllowedNavigationTarget`, `isExternalHttpUrl`).
- A CSP is attached via `session.defaultSession.webRequest.onHeadersReceived`
  (see `buildCsp`/`installCsp` in `main.js`), scoped to the app's own
  responses (`isAppOriginUrl`: file:// when packaged, the dev-server origin in
  dev). It is deliberately not stamped onto every response the session sees —
  overwriting a third party's own `Content-Security-Policy` header is not ours
  to do.

  **`script-src` is hash-based, not `'unsafe-inline'`, and that is load-bearing.**
  The invariant: no path admits a remote script origin, so an injected
  `<script src="https://evil.example.com/x.js">` can never run. The renderer
  holds no keys, but it *can ask main to use them* (`endpoints:*`, `ai:call`),
  so script execution in the renderer is the thing to prevent.

  `next build` emits unnonced inline scripts (the `coop_theme` bootstrap in
  `app/layout.js`, plus one `self.__next_f.push(...)` per RSC flight chunk). A
  bare `script-src 'self'` blocks all of them and React never hydrates — the
  window paints static markup and is completely inert. A nonce is the textbook
  fix but is unavailable here: nonces must be fresh per response and injected at
  render time, and `output: 'export'` has no server and no request
  (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`
  says so outright; a nonce baked into a static file is public, so injected
  script can just wear it). So `installCsp()` reads the built HTML at startup and
  pins a `'sha256-...'` per inline script. Note it is all-or-nothing: per the CSP
  spec, once `script-src` carries any hash, `'unsafe-inline'` is ignored — you
  cannot hash just the known bootstrap and leave the flight chunks inline.

  Consequences to know about:
  - **The export must exist before the window loads.** Hashes come from `out/`;
    if it is missing, `installCsp()` logs a `[csp]` warning and the window will
    not hydrate. Run `npm run electron:build` first.
  - **Rebuild ⇒ new hashes.** They're computed at startup from the shipped
    files, so this is automatic. Never hand-copy a hash into source.
  - Dev (`localhost:3000`) relaxes to `'unsafe-inline' 'unsafe-eval'`: `next dev`
    generates inline scripts per request and React's dev build evals to rebuild
    error stacks, so there is nothing stable to hash. Dev-only — a packaged
    build never takes that branch, and the test suite asserts it.

  **Verify the header actually applies to file:// loads on the Electron version
  you land on** — webRequest's coverage of the file: protocol has varied across
  Electron/Chromium network-service versions, and `'self'` matching for a
  file:-origin document is its own quirk. If devtools shows no CSP in the
  Security panel, the fallback is a postbuild step injecting
  `<meta http-equiv="Content-Security-Policy" content="...">` into each exported
  HTML file — reuse `buildCsp()` + `exportScriptHashes()` from `main.js` so the
  hashes stay correct rather than hand-writing the policy.
- Single-instance lock (`requestSingleInstanceLock`) so a second launch
  focuses the existing window instead of spawning a second process with its
  own IPC handlers.

## How to add a new IPC handler

1. Add the channel name to `CHANNELS` in `electron/ipc/index.js` (this is the
   allowlist reference — keep it in sync with what `preload.js` exposes).
2. Write a validator in `electron/ipc/validators.js`: a pure function that
   throws `ValidationError` on anything malformed and returns a clean,
   narrowly-typed value. Add a test for it in `test/electron-shell.test.js`.
3. Add the handler to the map returned by `createHandlers()` in
   `electron/ipc/handlers.js`. Call the validator first; only then touch
   fs/network/registry state.
4. Add a matching method to the object passed to `contextBridge.exposeInMainWorld`
   in `preload.js`. Never expose the raw channel name to `ipcRenderer.invoke`
   from application code — always go through the `window.coop.*` method.
5. If the handler needs to push unsolicited events to the renderer (like
   `ai:call`'s streaming chunks), add the channel name to
   `ALLOWED_STREAM_CHANNELS` in `preload.js` and use `evt.sender.send(...)` in
   the handler, `ipcRenderer.on(...)` via `subscribe()` in preload.

## The IPC contract

Everything below is `ipcRenderer.invoke`/`ipcMain.handle` (request/response)
except `ai:stream`, which is main pushing events at the renderer over
`webContents.send`.

| Channel | Renderer calls (via `window.coop`) | Returns |
|---|---|---|
| `app:getVersion` | `app.getVersion()` | `string` |
| `app:getPaths` | `app.getPaths()` | `{ userData, documents, downloads, temp }` |
| `store:read` | `store.read()` | `string \| null` — the whole serialized document |
| `store:write` | `store.write(text)` | `{ ok: true }` |
| `endpoints:list` | `endpoints.list()` | `EndpointView[]` |
| `endpoints:add` | `endpoints.add({ label, baseUrl, apiKey? })` | `{ ok: true, endpoint: EndpointView } \| { ok: false, error }` |
| `endpoints:update` | `endpoints.update(id, patch)` | same shape as add |
| `endpoints:delete` | `endpoints.delete(id)` | `{ ok: boolean }` |
| `endpoints:test` | `endpoints.test(id)` | `{ ok: true, models, anthropic } \| { ok: false, error }` |
| `endpoints:models` | `endpoints.models(id)` | `{ ok: true, models } \| { ok: false, error }` |
| `ai:call` | `ai.call({ endpointId, model, requestId, messages, options? })` | `{ requestId, started: true }` (immediately; real result streams over `ai:stream`) |
| `ai:cancel` | `ai.cancel(requestId)` | `{ ok: true }` |
| `dialog:openFile` | `dialog.openFile({ filters?, multiple? })` | `{ canceled, files: [{ filePath, content } \| { filePath, error }] }` |
| `dialog:saveFile` | `dialog.saveFile({ content, defaultPath?, filters? })` | `{ canceled, filePath? }` |

`EndpointView = { id, label, providerId, baseUrl, hasKey, createdAt, updatedAt }`
— never `apiKey`. Field names match `lib/endpoints/registry.js`'s `toView`
exactly on purpose (see below).

### Errors on `endpoints:add` / `endpoints:update`

Bad **input** RESOLVES to `{ ok: false, error: { type: "VALIDATION_ERROR", field, message } }`
— the same shape `lib/endpoints/registry.js` returns for the same mistake on the
web path. It never rejects. That's the point: one branch works on both paths.

```js
const res = await window.coop.endpoints.add({ label: "", baseUrl: "https://api.openai.com/v1" });
if (!res.ok) showFieldError(res.error.field, res.error.message);
```

An **unexpected internal error** is different — it's a bug, not something the
user can correct, so it genuinely rejects the invoke. Two reasons it isn't
folded into `{ ok: false }`: a UI would render it as a field error the user
can't fix, and `{ ok: false }` would come to mean "either your input is wrong or
main is broken", which no caller can act on.

Those rejections carry a **scrubbed** message (`"<channel> failed. See the
application log for details."`). `args` on these two channels carries `apiKey`,
and `ipcMain.handle` sends a thrown error's message across the contextBridge
verbatim — an error built from those args (a stringified record, a request URL
with the key in the query) would hand the key straight to the renderer. The real
error goes to the main-process log. Keep it that way if you add a channel that
takes a key.

Push channel `ai:stream`, subscribed via `window.coop.ai.onStream(cb)`:
`cb({ requestId, type: "chunk", delta }) | cb({ requestId, type: "done" }) | cb({ requestId, type: "error", error })`.

Renderer-side streaming usage:

```js
const requestId = crypto.randomUUID();
const unsubscribe = window.coop.ai.onStream(({ requestId: rid, type, delta, error }) => {
  if (rid !== requestId) return; // another call may be in flight
  if (type === "chunk") appendToken(delta);
  if (type === "done" || type === "error") unsubscribe();
});
await window.coop.ai.call({ endpointId, model, requestId, messages });
// ...and to abort early:
// await window.coop.ai.cancel(requestId);
```

## Wiring `lib/store/` and `lib/endpoints/`

Both already exist in this repo (`lib/store/`, `lib/endpoints/`) as of this
writing, built by other agents in parallel with this subsystem. Per the
ground rules for this task this code does not import them directly — but the
channel contract above was shaped to match their actual exports field-for-
field, so wiring them in main.js is meant to be a small adapter, not a
rewrite. `createHandlers(deps)` in `ipc/handlers.js` is the seam; today
`registerDefaultIpcHandlers()` in `main.js` calls it with no `deps`, so it
falls back to in-memory/no-op defaults (the app runs, but endpoints don't
survive a restart and `ai:call` reports "not wired"). To wire the real thing,
change that one call site in `main.js`:

```js
// electron/main.js additions
import fs from "node:fs";
import { createFileBackend } from "../lib/store/backends.js";
import { createRegistry } from "../lib/endpoints/registry.js";
import { probeEndpoint, discoverModels } from "../lib/endpoints/probe.js";
import { callEndpoint } from "../lib/endpoints/call.js";

/** endpoints:test / endpoints:models need the KEY-bearing record (registry.resolve),
 *  which registry.list()/add()/update() never expose -- this wrapper is the
 *  only place that calls resolve(), and it never returns the result as-is. */
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

function makeAi(registry) {
  return {
    async call({ endpointId, model, messages, options }, onChunk, signal) {
      const endpoint = registry.resolve(endpointId);
      // callEndpoint takes no signal itself -- inject one via the fetch it's given.
      const fetchWithSignal = (url, opts) => fetch(url, { ...opts, signal });
      const result = await callEndpoint(
        { endpoint, model, messages, stream: true, onDelta: onChunk, maxTokens: options?.maxTokens, effort: options?.effort },
        fetchWithSignal
      );
      if (!result.ok) throw new Error(result.error?.message ?? result.error?.type ?? "AI call failed");
    },
  };
}

// inside app.whenReady(), before/instead of the current registerDefaultIpcHandlers() call:
const endpointsFile = path.join(app.getPath("userData"), "endpoints.json");
const endpointsStorage = {
  read: () => {
    try {
      return JSON.parse(fs.readFileSync(endpointsFile, "utf-8"));
    } catch {
      return null;
    }
  },
  write: (arr) => fs.writeFileSync(endpointsFile, JSON.stringify(arr, null, 2), "utf-8"),
};
const registry = createRegistry({ storage: endpointsStorage });

registerDefaultIpcHandlers({
  store: createFileBackend(path.join(app.getPath("userData"), "store.json")),
  endpoints: withProbing(registry),
  ai: makeAi(registry),
});
```

Notes on why the seam is shaped this way:

- `lib/store/backends.js#createFileBackend` already implements exactly the
  `{ read(): Promise<string|null>, write(text): Promise<void> }` shape
  `store:read`/`store:write` expect — literal drop-in, no adapter function
  needed (unlike endpoints/ai above).
- `lib/endpoints/registry.js#createRegistry` returns `list()`/`add()`/`update()`
  already shaped as `EndpointView` / `{ ok, endpoint }` / `{ ok, error }` —
  `ipc/handlers.js` forwards those return values as-is. Its removal method is
  named `remove`, not `delete`; `ipc/handlers.js#callDelete` already checks
  for `remove` first, so passing the real registry in needs no change there.
- `registry.resolve(id)` is the one accessor that returns the API key. It
  must never be called anywhere the result flows back to `ipcMain.handle`'s
  return value un-transformed — `withProbing`/`makeAi` above only ever pass
  it into `probeEndpoint`/`discoverModels`/`callEndpoint`, whose own return
  shapes (`{ ok, models, anthropic }` / `{ ok, error }`) don't carry it either.
- On the renderer side, `lib/store/backends.js#createIPCBackend` expects
  `{ read, write }` functions — pass `window.coop.store.read` and
  `window.coop.store.write` straight in:
  `createStore({ backend: createIPCBackend({ read: window.coop.store.read, write: window.coop.store.write }) })`.
- Settings that belong in the store's `settings` slice (theme, default AI
  model/effort/endpoint id) go through `store:read`/`store:write` like any
  other document slice. The API key itself never goes through the store —
  it's endpoint-scoped and lives only behind `endpoints:add`/`update`,
  main-process-side, per `lib/store/schema.js#defaultSettings`'s own comment
  ("API keys are intentionally excluded").

## CSV import / export (`dialog:*`)

`dialog:openFile` reads the selected file(s) as UTF-8 text in main (capped at
25MB per file — `MAX_IMPORT_BYTES` in `handlers.js`) and returns the content
directly, because the sandboxed renderer has no fs access of its own. Wire
the sheet tool's "Import CSV" action to
`window.coop.dialog.openFile({ filters: [{ name: "CSV", extensions: ["csv"] }] })`
and read `.files[0].content`. `dialog:saveFile` is the export counterpart —
pass the CSV/text to write as `content`; capped at 50MB
(`MAX_SAVE_CONTENT_BYTES` in `validators.js`).
