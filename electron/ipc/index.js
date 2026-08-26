// electron/ipc/index.js
// IPC handler registration. This is the single place ipcMain.handle gets
// called from, so the full set of exposed channels is visible in one file.
// Other subsystems (lib/store/, lib/endpoints/) plug in by passing their
// implementation into createHandlers({ store, endpoints, ai }) — see
// electron/ipc/handlers.js and electron/README.md.

import { ipcMain } from "electron";
import { createHandlers } from "./handlers.js";

/**
 * Register one or more channel->handler maps onto ipcMain.handle.
 * Accepts multiple maps so a later integration phase can do:
 *   registerIpcHandlers(ipcMain, createHandlers(deps), someOtherSubsystemsHandlers);
 * Throws at startup (not at call time) if two maps collide on a channel name —
 * a silent overwrite here would be a silent security regression.
 */
export function registerIpcHandlers(ipcMainImpl, ...handlerMaps) {
  const seen = new Set();
  for (const map of handlerMaps) {
    for (const [channel, fn] of Object.entries(map)) {
      if (seen.has(channel)) {
        throw new Error(`IPC channel "${channel}" registered more than once`);
      }
      seen.add(channel);
      ipcMainImpl.handle(channel, fn);
    }
  }
  return [...seen];
}

/** Convenience: build the default handler set and register it on the real ipcMain. */
export function registerDefaultIpcHandlers(deps) {
  return registerIpcHandlers(ipcMain, createHandlers(deps));
}

/** The full allowlist of channels the preload script is permitted to invoke. */
export const CHANNELS = Object.freeze([
  "app:getVersion",
  "app:getPaths",
  "store:read",
  "store:write",
  "endpoints:list",
  "endpoints:add",
  "endpoints:update",
  "endpoints:delete",
  "endpoints:test",
  "endpoints:models",
  "ai:call",
  "ai:cancel",
  "voice:transcribe",
  "voice:speak",
  "voice:cancel",
  // Push channel — main sends unsolicited events on it (like "ai:stream"), so
  // the renderer never invokes it. Listed here for a complete channel surface;
  // it is guarded in preload.js#ALLOWED_STREAM_CHANNELS, not ipcMain.handle.
  "voice:speak-stream",
  // Hermes CLI runtime (PTT-only in the renderer). run/cancel/status are
  // invoked; "hermes:stream" is a push channel (main sends unsolicited chunk/
  // done/error events on it, like "voice:speak-stream") — guarded in
  // preload.js#ALLOWED_STREAM_CHANNELS, never ipcMain.handle'd.
  "hermes:run",
  "hermes:cancel",
  "hermes:status",
  "hermes:stream",
  // Companion Hub persistence under userData.
  "hub:load",
  "hub:save",
  "dialog:openFile",
  "dialog:saveFile",
  // Updater. check/download/install/openReleasePage/getState are invoked;
  // "updates:status" is a push channel (main sends unsolicited state
  // transitions on it, like "ai:stream") — guarded in
  // preload.js#ALLOWED_STREAM_CHANNELS, never ipcMain.handle'd.
  "updates:getState",
  "updates:check",
  "updates:download",
  "updates:install",
  "updates:openReleasePage",
  "updates:status",
]);
