// lib/endpoints/store.js
// On-disk JSON store for endpoints. This file holds API keys, so the file mode
// is 0o600 (owner read/write only) and the containing directory is 0o700.
//
// PATH RESOLUTION. Resolution order is:
//   1. process.env.COOP_ENDPOINTS_DIR  — documented override, used by tests.
//   2. An injected Electron `app` object — app.getPath("userData").
//   3. XDG_CONFIG_HOME/coop-prep, else ~/.config/coop-prep.
//
// (1) is a DIRECTORY PATH, not a credential. It is configuration that says
// where to look; it never carries a key, and reading it is not the ambient-env
// key path that lib/endpoints/headers.js refuses to implement.
//
// (2) is INJECTED rather than imported. This repo is Next.js and has no
// electron dependency, so a bare `import("electron")` would throw at runtime
// and adding electron just to resolve a path is not a trade worth making.
// A host that does run under Electron passes { electronApp: app }.
//
// (3) is a real XDG resolver. Do not "port" a Windows-shaped resolver here —
// hardcoding %APPDATA% breaks on this Linux dev box and every Linux user.
//
// Node-only module (imports node:fs / node:path / node:os). Do not import it
// from renderer/React code — import the registry with an injected storage port
// instead. It is importable under `node --test`.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Env var naming the directory the endpoints file lives in. */
export const ENDPOINTS_DIR_ENV = "COOP_ENDPOINTS_DIR";

/** Basename of the store file. */
export const ENDPOINTS_FILENAME = "endpoints.json";

/**
 * Mode for the store file: owner read/write only.
 *
 * PLATFORM CAVEAT — this is BEST-EFFORT ON WINDOWS, not enforced. `fs.chmod`
 * on win32 maps onto exactly one bit (FILE_ATTRIBUTE_READONLY); the group and
 * other bits have no representation, and `fs.stat` synthesises 0666 for any
 * writable file (0777 for a directory). So on win32 the calls below succeed and
 * change nothing about who can read the file — the endpoints.json holding
 * plaintext API keys is readable by anything running as any user with access to
 * the profile directory. Real confinement there needs an owner-only ACL
 * (`icacls` / `SetNamedSecurityInfo`), which this module does not attempt.
 *
 * On POSIX the mode IS enforced, and test/endpoints.test.js asserts it there.
 * Those assertions are skipped on win32 precisely because the OS cannot honour
 * them — see the POSIX_MODES note in that file.
 */
export const FILE_MODE = 0o600;

/** Mode for the store directory: owner rwx only. Same win32 caveat as FILE_MODE. */
export const DIR_MODE = 0o700;

/**
 * Resolve the directory that holds the endpoints file.
 *
 * @param {object} [options]
 * @param {Record<string, string|undefined>} [options.env] - defaults to process.env
 * @param {{ getPath: (name: string) => string }|null} [options.electronApp]
 * @returns {string} absolute directory path
 */
export function resolveStoreDir({ env = process.env, electronApp = null } = {}) {
  const override = env?.[ENDPOINTS_DIR_ENV];
  if (typeof override === "string" && override.trim()) {
    return path.resolve(override.trim());
  }

  if (electronApp && typeof electronApp.getPath === "function") {
    return path.join(electronApp.getPath("userData"), "coop-prep");
  }

  const xdg = env?.XDG_CONFIG_HOME;
  if (typeof xdg === "string" && xdg.trim()) {
    return path.join(path.resolve(xdg.trim()), "coop-prep");
  }

  return path.join(os.homedir(), ".config", "coop-prep");
}

/**
 * Resolve the absolute path of the endpoints file.
 *
 * @param {Parameters<typeof resolveStoreDir>[0]} [options]
 * @returns {string}
 */
export function resolveStorePath(options) {
  return path.join(resolveStoreDir(options), ENDPOINTS_FILENAME);
}

/**
 * Parse the endpoints document out of raw file text, accepting both on-disk
 * shapes this app has ever written.
 *
 * THE LEGACY BARE ARRAY IS NOT OPTIONAL TO SUPPORT. Every build before the one
 * that introduced this module shipped a hand-rolled store in electron/main.js
 * that wrote a BARE ARRAY — no envelope. Reading only `parsed.endpoints` would
 * see null for those users, report zero endpoints, and then the first write
 * would overwrite the file in the new format, irrecoverably destroying every
 * API key they had configured. The keys are plaintext secrets the user pasted
 * in by hand and cannot get back; silently eating them is far worse than the
 * looser parse. A bare array is therefore read as the endpoint list itself, and
 * the next write transparently upgrades the file to the envelope.
 *
 * Anything else — a number, a string, an object with no `endpoints` array —
 * reads as null (i.e. "nothing configured"), same as a corrupt file.
 *
 * @param {string} raw - file contents
 * @returns {object[]|null} the endpoint list, or null if there isn't one
 */
export function readEndpointsDocument(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null; // corrupt
  }
  if (Array.isArray(parsed)) return parsed; // legacy: bare array
  return Array.isArray(parsed?.endpoints) ? parsed.endpoints : null;
}

/**
 * Create a storage port backed by a single JSON file.
 *
 * Satisfies the port shape the registry expects:
 *   { read(): StoredEndpoint[]|null, write(endpoints: StoredEndpoint[]): void }
 *
 * read() never throws: a missing or corrupt file reads as null so a damaged
 * store degrades to "no endpoints configured" rather than crashing the app.
 * write() is whole-file and atomic-ish (write temp at 0o600, then rename), so
 * a crash mid-write cannot leave a half-parsed file — or a world-readable one.
 *
 * read() accepts TWO on-disk shapes: the current {version:1,endpoints:[...]}
 * envelope, and a LEGACY bare array — see readEndpointsDocument().
 *
 * @param {Parameters<typeof resolveStoreDir>[0]} [options]
 * @returns {{ read: () => object[]|null, write: (endpoints: object[]) => void, path: string }}
 */
export function createFileStorage(options) {
  const filePath = resolveStorePath(options);
  const dir = path.dirname(filePath);

  return {
    path: filePath,

    read() {
      let raw;
      try {
        raw = fs.readFileSync(filePath, "utf8");
      } catch {
        return null; // missing / unreadable
      }
      return readEndpointsDocument(raw);
    },

    write(endpoints) {
      fs.mkdirSync(dir, { recursive: true, mode: DIR_MODE });
      const payload = JSON.stringify({ version: 1, endpoints }, null, 2);
      const tmp = `${filePath}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, payload, { mode: FILE_MODE });
      // writeFileSync's mode is only applied when it CREATES the file, so an
      // existing temp path could keep a looser mode. Force it before publish.
      fs.chmodSync(tmp, FILE_MODE);
      fs.renameSync(tmp, filePath);
    },
  };
}

/**
 * In-memory storage port. Used by tests and by any caller that wants the
 * registry without touching disk.
 *
 * @param {object[]} [initial]
 * @returns {{ read: () => object[]|null, write: (endpoints: object[]) => void }}
 */
export function createMemoryStorage(initial = null) {
  let state = initial ? JSON.parse(JSON.stringify(initial)) : null;
  return {
    read: () => (state ? JSON.parse(JSON.stringify(state)) : null),
    write: (endpoints) => {
      state = JSON.parse(JSON.stringify(endpoints));
    },
  };
}
