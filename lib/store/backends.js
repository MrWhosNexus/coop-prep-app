// lib/store/backends.js
// Injectable storage ports for lib/store/store.js. Each backend implements
// the same tiny async contract:
//   read(): Promise<string|null>   -- whole document as a JSON string, or
//                                      null if nothing has been saved yet
//   write(text: string): Promise<void>
//
// store.js only ever talks to this contract, so it runs unmodified under
// node --test (memory backend), inside the Electron main process (file
// backend), or inside a renderer (ipc backend). Node builtins are imported
// lazily inside the functions that need them, not at module scope, so this
// file itself has zero Electron/Node-fs imports at load time.
//
// The document is not a credential store — keys live in lib/endpoints/ and never
// come near this — but it holds the user's notes, highlights and progress, so the
// file backend writes 0o600 in a 0o700 dir, the same posture as
// lib/endpoints/store.js. See createFileBackend.

/**
 * Owner read/write only. The document is a private journal, not shared state.
 *
 * Best-effort on Windows only: chmod there toggles the read-only attribute and
 * nothing else, and stat reports a synthesised 0666/0777. See the FILE_MODE
 * note in lib/endpoints/store.js for the full caveat.
 */
export const FILE_MODE = 0o600;
/** Owner-only directory, so the file cannot be reached by listing the parent. */
export const DIR_MODE = 0o700;

// Monotonic suffix for temp-file names. `Date.now()` alone collides when two
// writes land in the same millisecond (same pid), so two concurrent writers can
// target the same temp path — one clobbering the other's bytes, or a rename
// failing ENOENT because the sibling already moved it. store.js now serializes
// writes so this should not happen, but a unique counter makes the file backend
// safe even if a caller writes concurrently.
let tmpSeq = 0;

/**
 * createMemoryBackend(initial?) -> backend
 * In-memory backend: what the store uses under node --test, and a safe
 * fallback anywhere a real backend hasn't been wired up yet.
 */
export function createMemoryBackend(initial = null) {
  let value = initial;
  return {
    async read() {
      return value;
    },
    async write(text) {
      value = text;
    },
    /** Test-only escape hatch to inspect the raw stored string synchronously. */
    _peek() {
      return value;
    },
  };
}

/**
 * createFileBackend(filePath) -> backend
 * For the Electron MAIN process. Atomic write: serialize to a temp file
 * in the same directory, then rename over the target -- a crash mid-write
 * can never leave a half-written document on disk, because rename() is
 * atomic on the same filesystem.
 */
export function createFileBackend(filePath) {
  return {
    async read() {
      const fs = await import("node:fs/promises");
      try {
        return await fs.readFile(filePath, "utf8");
      } catch (err) {
        if (err && err.code === "ENOENT") return null;
        throw err;
      }
    },
    async write(text) {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const dir = path.dirname(filePath);

      // 0o700 dir / 0o600 file, matching lib/endpoints/store.js.
      //
      // This document is not a credential store — keys never come near it — but
      // it holds the user's notes, highlights, bookmarks and progress. The Heart
      // pillar's reflections and the Hustle tools' STAR stories and salary
      // negotiation prep all live here. Default 0644 makes them world-readable
      // on a shared box, which is not a reasonable default for a private journal.
      //
      // Two traps this navigates, both learned the hard way in this repo:
      //   - `mkdir`'s `mode` is only applied when it CREATES the directory. An
      //     existing 0755 dir keeps its mode, so chmod explicitly.
      //   - `writeFile`'s `mode` is only honoured when it CREATES the file. The
      //     temp name is fresh each write so it does create — but chmod before
      //     the rename anyway, so the mode holds even if a temp file is reused.
      await fs.mkdir(dir, { recursive: true, mode: DIR_MODE });
      await fs.chmod(dir, DIR_MODE).catch(() => {});

      const tmpPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${tmpSeq++}.tmp`);
      await fs.writeFile(tmpPath, text, { encoding: "utf8", mode: FILE_MODE });
      await fs.chmod(tmpPath, FILE_MODE).catch(() => {});
      // rename carries the temp file's mode across, so the live file is never
      // briefly world-readable the way a write-in-place would be.
      await fs.rename(tmpPath, filePath);
    },
  };
}

/**
 * createIPCBackend({ read, write }) -> backend
 * For the Electron RENDERER process. `read`/`write` are whatever the
 * preload script exposes on `window` (e.g. window.coopStore.read /
 * window.coopStore.write), themselves thin wrappers around
 * ipcRenderer.invoke(...) talking to a createFileBackend in the main
 * process. This module never touches `require("electron")` directly, so
 * it stays importable under node --test.
 */
export function createIPCBackend({ read, write }) {
  if (typeof read !== "function" || typeof write !== "function") {
    throw new Error("createIPCBackend requires { read, write } functions (e.g. from a preload bridge)");
  }
  return {
    async read() {
      return await read();
    },
    async write(text) {
      await write(text);
    },
  };
}
