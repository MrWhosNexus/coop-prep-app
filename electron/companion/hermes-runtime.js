// electron/companion/hermes-runtime.js
//
// The Hermes runtime: spawns the local `hermes` CLI (`hermes -z <prompt>`) and
// streams its stdout back to the caller. Ported from nexus/src/hermes-bridge.ts
// (runHermes / killProcessTree / hermesRuntimeStatus) + companion-api.ts's
// scrubEnv, translated to plain-JS ESM. No Electron import — the runtime is
// constructed in electron/main.js#buildIpcDeps and injected into the IPC
// handlers, so this module stays testable under plain `node --test`.
//
// *** SECURITY — this is a real shell / RCE surface. ***
// The Hermes CLI runs a persistent shell with tool processes under it. Two
// invariants live here and MUST NOT be weakened:
//   1. PTT-ONLY. This runtime is only ever reached from the push-to-talk path
//      in the renderer's voice provider (requiresPushToTalk('hermes') === true).
//      An always-on / wake-word mic frame can NEVER reach run() — the gate is at
//      capture in EndpointVoiceProvider.onMicFrame, before any VAD/wake code.
//   2. scrubEnv. The child inherits a scrubbed env only: nothing key-shaped
//      (*_KEY / *_TOKEN / *_SECRET, MINIMAX_API_KEY, NEXUS_TOKEN, x-nexus-token)
//      is passed down, so a prompt-injected command cannot echo a secret back
//      over stdout and exfiltrate it. coop-prep's own key lives in
//      endpoints.json, not env — this is defense in depth regardless.
// Do NOT add a terminal/shell tool or any companion tool that spawns.

import { spawn as nodeSpawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Build a scrubbed environment for the Hermes child. The child must NEVER
 * inherit anything key-shaped. Strip MINIMAX_API_KEY / NEXUS_TOKEN explicitly,
 * then anything whose name ends in KEY/TOKEN/SECRET (case-insensitive) plus the
 * loopback x-nexus-token vars. Benign vars (PATH, HOME, SystemRoot, …) are
 * kept so the CLI can actually find its interpreter and config. Returns a
 * shallow copy — the caller's env object is never mutated.
 *
 * Ported verbatim from nexus companion-api.ts#scrubEnv.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {NodeJS.ProcessEnv}
 */
export function scrubEnv(env = process.env) {
  const out = { ...env };
  delete out.MINIMAX_API_KEY;
  delete out.NEXUS_TOKEN;
  for (const k of Object.keys(out)) {
    if (/KEY$|TOKEN$|SECRET$/i.test(k) || /^x[-_]nexus[-_]token$/i.test(k)) delete out[k];
  }
  return out;
}

/**
 * Resolve the hermes executable.
 *   1. COOP_HERMES_BIN / NEXUS_HERMES_BIN env override, if set.
 *   2. A venv-local hermes binary, when it actually exists on disk.
 *   3. A bare `hermes`, which spawn resolves through PATH. A pip/pipx/git
 *      install exposes the CLI there (e.g. ~/.local/bin/hermes), so this is the
 *      case that makes a normal install work with no env var.
 *
 * No Flatpak hostCommand indirection — coop-prep is not a Flatpak app.
 *
 * @returns {string}
 */
export function resolveHermesBin() {
  const override = process.env.COOP_HERMES_BIN || process.env.NEXUS_HERMES_BIN;
  if (override && override.length > 0) return override;

  const win = process.platform === "win32";
  const exe = win ? "hermes.exe" : "hermes";
  // A venv adjacent to an override root, if the user placed one. Kept for parity
  // with Nexus; on this host resolution falls through to the bare PATH name.
  const root = process.env.COOP_HERMES_ROOT || process.env.NEXUS_HERMES_ROOT;
  if (root) {
    const venvBin = path.join(root, "hermes-agent", "venv", win ? "Scripts" : "bin", exe);
    if (existsSync(venvBin)) return venvBin;
  }
  return exe;
}

/** The fixed argv for a one-shot Hermes dispatch: `-z <prompt>` (no session
 *  continuity). Exported so a test can assert the exact args without a spawn. */
export function buildHermesArgs(prompt) {
  return ["-z", prompt];
}

const KILL_ESCALATION_MS = 2000;

/**
 * Kill a spawned process AND everything it started.
 *
 * `child.kill()` signals one pid; Hermes runs a persistent shell with tool
 * processes under it, so that would orphan the descendants. POSIX: the child is
 * spawned `detached` (group leader), so a negative pid signals the whole group —
 * SIGTERM first (tools clean up), SIGKILL after a grace period. Windows:
 * `taskkill /T /F` walks the tree. Every failure is swallowed: ESRCH means the
 * group is already gone, which is the outcome we wanted, and this runs from an
 * abort handler where throwing would replace "cancelled" with a crash.
 *
 * Ported verbatim from nexus hermes-bridge.ts#killProcessTree.
 *
 * @param {{ pid?: number, kill: (sig?: string) => boolean }} child
 */
export function killProcessTree(child) {
  const pid = child.pid;
  if (pid === undefined) return;
  if (process.platform === "win32") {
    try {
      // Fire-and-forget reaper; its own failure (already-dead tree) is not actionable.
      nodeSpawn("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true }).on("error", () => {});
    } catch {
      child.kill();
    }
    return;
  }
  try {
    // Negative pid = the process GROUP. This is the whole fix.
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      /* already dead */
    }
  }
  const hard = setTimeout(() => {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      /* the group went away, which is the point */
    }
  }, KILL_ESCALATION_MS);
  hard.unref?.();
}

/**
 * Create a Hermes runtime.
 *
 * @param {object} [opts]
 * @param {typeof nodeSpawn} [opts.spawn] - injectable for tests (never a live spawn there).
 * @returns {{ run: (prompt: string, io: { onChunk: (delta: string) => void, signal?: AbortSignal }) => Promise<void>, status: () => Promise<{ state: string, command: string, detail?: string }> }}
 */
/**
 * Is the Hermes CLI actually present? Existence is the honest readiness signal.
 * The agent CLI does NOT cleanly exit on `--version` (it has no off switch), so
 * a spawn-and-wait probe hangs for 5s and false-reports "setup-required" for a
 * Hermes that answers fine via `hermes -z` — and it leaves a stray agent process
 * running on every check. An absolute/relative command is checked directly; a
 * bare name is looked up across PATH. run() surfaces any real runtime failure.
 * @param {string} command
 * @returns {boolean}
 */
export function hermesExists(command) {
  if (command.includes(path.sep)) return existsSync(command);
  const dirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  const exts = process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];
  for (const dir of dirs) {
    for (const ext of exts) {
      if (existsSync(path.join(dir, command + ext))) return true;
    }
  }
  return false;
}

export function createHermesRuntime({ spawn = nodeSpawn, exists = hermesExists } = {}) {
  /**
   * Spawn Hermes and stream stdout via onChunk. Resolves when output has fully
   * drained ('close'); on abort, kills the whole process tree and resolves early
   * on 'exit' (a surviving grandchild can hold stdout open indefinitely, so we
   * do NOT wait for 'close' there). Rejects only if the CLI cannot spawn.
   *
   * @param {string} prompt
   * @param {{ onChunk: (delta: string) => void, signal?: AbortSignal }} io
   * @returns {Promise<void>}
   */
  function run(prompt, { onChunk, signal } = {}) {
    const bin = resolveHermesBin();
    const args = buildHermesArgs(prompt);
    return new Promise((resolve, reject) => {
      let child;
      try {
        child = spawn(bin, args, {
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
          // POSIX only: makes the child a group leader so killProcessTree can
          // signal its descendants. On Windows `detached` opens a console
          // window and taskkill /T walks the tree without it.
          detached: process.platform !== "win32",
          // *** The security invariant: no secrets in the child env. ***
          env: scrubEnv(),
        });
      } catch (err) {
        reject(err);
        return;
      }

      let settled = false;
      const finish = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      const onAbort = () => {
        killProcessTree(child);
        // Stop waiting on stdio: a surviving grandchild holds it open, and
        // 'close' waits for every writer. 'exit' is this process only.
        child.once("exit", finish);
      };
      if (signal) {
        if (signal.aborted) {
          // Already cancelled before we started streaming — tear down at once.
          onAbort();
          return;
        }
        signal.addEventListener("abort", onAbort);
      }
      const cleanup = () => {
        if (signal) signal.removeEventListener("abort", onAbort);
      };

      child.stdout?.on("data", (buf) => {
        try {
          onChunk?.(buf.toString("utf8"));
        } catch {
          /* a broken consumer must not crash the runtime */
        }
      });
      // Drain stderr so a chatty child never fills the ~64KB pipe buffer and
      // deadlocks with no reader on the other end.
      child.stderr?.on("data", () => {});
      child.on("error", (err) => {
        cleanup();
        if (!settled) {
          settled = true;
          reject(err);
        }
      });
      child.on("close", () => {
        cleanup();
        finish();
      });
    });
  }

  /**
   * Non-mutating readiness probe: `hermes --version` with a 5s timeout. A
   * missing executable ('not-installed') is distinct from an installed CLI that
   * exits unsuccessfully ('setup-required'), so the picker can annotate the
   * hermes button honestly. Ported from nexus#hermesRuntimeStatus.
   *
   * @returns {Promise<{ state: 'ready'|'setup-required'|'not-installed', command: string, detail?: string }>}
   */
  function status() {
    const command = resolveHermesBin();
    // Existence, not a `--version` spawn (see hermesExists): never starts the
    // agent just to check availability, and never hangs.
    return Promise.resolve(
      exists(command)
        ? { state: "ready", command }
        : { state: "not-installed", command, detail: "The Hermes executable was not found on PATH." }
    );
  }

  return { run, status };
}
