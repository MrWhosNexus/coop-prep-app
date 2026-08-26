// electron/window-state.js
// Pure(ish) window-bounds persistence. Deliberately does NOT import "electron" —
// callers pass a BrowserWindow-like object (anything with getBounds/isMaximized/on/
// isDestroyed) so this module is testable under plain `node --test` with a fake
// window and a real temp-file path. main.js is the only file that wires a real
// Electron BrowserWindow + app.getPath("userData") into this.

import fs from "node:fs";
import path from "node:path";

/** Fallback bounds used when there is no saved state or it fails to parse. */
export const DEFAULT_STATE = {
  width: 1280,
  height: 800,
  x: undefined,
  y: undefined,
  isMaximized: false,
};

/**
 * Coerce an arbitrary object into a valid window-state shape, falling back to
 * `defaults` field-by-field. Never throws.
 */
export function sanitizeState(state, defaults = DEFAULT_STATE) {
  if (!state || typeof state !== "object") return { ...defaults };
  const width = Number.isFinite(state.width) && state.width > 0
    ? Math.round(state.width)
    : defaults.width;
  const height = Number.isFinite(state.height) && state.height > 0
    ? Math.round(state.height)
    : defaults.height;
  const x = Number.isFinite(state.x) ? Math.round(state.x) : undefined;
  const y = Number.isFinite(state.y) ? Math.round(state.y) : undefined;
  const isMaximized = state.isMaximized === true;
  return { width, height, x, y, isMaximized };
}

/** Read + sanitize saved state from `filePath`. Returns `defaults` on any error. */
export function readState(filePath, defaults = DEFAULT_STATE) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return sanitizeState(JSON.parse(raw), defaults);
  } catch {
    return { ...defaults };
  }
}

/** Persist `state` to `filePath`, creating the parent directory if needed. */
export function writeState(filePath, state) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
}

/**
 * Build a window-state manager bound to a single file.
 *
 * @param {string} filePath - where to persist state (e.g. `<userData>/window-state.json`)
 * @param {object} [defaults] - fallback bounds
 * @returns {{ state: object, save: Function, track: Function }}
 *   `state` (getter) is the last-known sanitized bounds, for use as BrowserWindow ctor options.
 *   `save(win)` reads bounds off `win` now and persists them.
 *   `track(win, opts)` wires resize/move/close listeners on `win` that debounce-save.
 */
export function createWindowState(filePath, defaults = DEFAULT_STATE) {
  let state = readState(filePath, defaults);

  function save(win) {
    if (!win || (typeof win.isDestroyed === "function" && win.isDestroyed())) return;
    const bounds = typeof win.getBounds === "function" ? win.getBounds() : {};
    const isMaximized = typeof win.isMaximized === "function" ? win.isMaximized() : false;
    state = sanitizeState({ ...bounds, isMaximized }, defaults);
    writeState(filePath, state);
  }

  function track(win, { debounceMs = 250 } = {}) {
    let timer = null;
    const scheduleSave = () => {
      clearTimeout(timer);
      timer = setTimeout(() => save(win), debounceMs);
    };
    win.on("resize", scheduleSave);
    win.on("move", scheduleSave);
    win.on("close", () => {
      clearTimeout(timer);
      save(win);
    });
  }

  return {
    get state() {
      return { ...state };
    },
    save,
    track,
  };
}
