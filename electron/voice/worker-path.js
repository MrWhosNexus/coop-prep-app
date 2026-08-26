// electron/voice/worker-path.js
//
// Resolve the absolute path of a voice worker script (tts-worker.js /
// stt-worker.js) from a module whose __dirname is electron/voice/ in both dev
// and packaged layouts. Ported from nexus/electron/main/worker-path.ts.
//
// Nexus's version deals with electron-vite's dist-electron/chunks/ code
// splitting — coop-prep has no such build step: electron/ is packaged into
// app.asar AS-IS (see electron-builder.yml's `files:` block), so the worker
// is always a direct sibling of tts-local.js/stt-local.js. There is no "one
// directory up" case to try here.
//
// The one real wrinkle carries over unchanged: the worker runs as a FORKED
// child process (ELECTRON_RUN_AS_NODE=1), which is plain Node with NO asar
// support — it cannot load a script from inside app.asar. So the worker (and
// its whole runtime JS closure — see electron-builder.yml's asarUnpack block)
// is asarUnpack'd, and this function must hand the child the REAL
// app.asar.unpacked/electron/voice/ path, not the app.asar/electron/voice/
// virtual path __dirname reports once packaged. Dev has no asar at all, so
// the plain sibling path is tried too (and wins there, since the unpacked
// candidate never exists).

import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * @param {string} bundleDir - __dirname of the calling module (tts-local.js / stt-local.js)
 * @param {string} filename - "tts-worker.js" | "stt-worker.js"
 * @returns {string}
 */
export function resolveWorkerBundle(bundleDir, filename) {
  const unpackedDir = bundleDir.replace(/app\.asar([/\\])/, "app.asar.unpacked$1");
  const candidates = [
    join(unpackedDir, filename), // packaged: unpacked sibling
    join(bundleDir, filename), // dev: plain sibling, no asar involved
  ];
  return candidates.find((p) => existsSync(p)) ?? candidates[candidates.length - 1];
}
