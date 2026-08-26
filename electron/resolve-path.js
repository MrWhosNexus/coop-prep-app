// electron/resolve-path.js
// Pure helpers for deciding what BrowserWindow should load and what navigation
// should be allowed. No Electron import — testable under plain `node --test`.

import path from "node:path";
import { pathToFileURL } from "node:url";

/** Overridable via env so `electron:dev` can point at whatever port `next dev` picked. */
export const DEV_SERVER_URL = process.env.ELECTRON_DEV_SERVER_URL || "http://localhost:3000";

/**
 * Decide what the main window should load.
 *
 * In dev, load the Next dev server (hot reload, no build step). In prod, load the
 * statically-exported `out/index.html` via file:// — this app ships as
 * `output: 'export'` so there is no Node server at runtime.
 *
 * @param {object} opts
 * @param {boolean} opts.isDev
 * @param {string} opts.appRoot - directory containing the `out/` export (repo root in dev, resourcesPath in prod)
 * @param {string} [opts.exportDirName]
 * @returns {{ type: "url"|"file", target: string, url?: string }}
 */
export function resolveAppEntry({ isDev, appRoot, exportDirName = "out" } = {}) {
  if (isDev) {
    return { type: "url", target: DEV_SERVER_URL };
  }
  const indexFile = path.join(appRoot, exportDirName, "index.html");
  return { type: "file", target: indexFile, url: pathToFileURL(indexFile).toString() };
}

/**
 * Should a navigation (will-navigate / setWindowOpenHandler target) be allowed
 * to load *inside* the app's own window? true only for file:// (our own export)
 * or same-origin as the configured dev server. Everything else (http/https to
 * other origins, and any other scheme) should be denied in-window and, for
 * http/https, handed to `shell.openExternal` instead.
 */
export function isAllowedNavigationTarget(urlString, devServerUrl = DEV_SERVER_URL) {
  let target;
  try {
    target = new URL(urlString);
  } catch {
    return false;
  }
  if (target.protocol === "file:") return true;
  try {
    return target.origin === new URL(devServerUrl).origin;
  } catch {
    return false;
  }
}

/** True for schemes shell.openExternal should be used for (external browser). */
export function isExternalHttpUrl(urlString) {
  try {
    const u = new URL(urlString);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
