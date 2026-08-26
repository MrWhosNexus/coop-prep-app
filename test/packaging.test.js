/**
 * test/packaging.test.js
 *
 * Guards the one defect that cannot be caught by running the app in dev:
 * electron/main.js runs in the MAIN process, so Next never bundles its
 * imports. Anything it pulls from lib/ must be listed in electron-builder.yml's
 * `files:` or the packaged asar omits it and the app dies on launch with
 * ERR_MODULE_NOT_FOUND — while `npm run electron:dev` stays perfectly green,
 * because dev loads straight off the filesystem.
 *
 * This test walks main.js's real transitive import graph and asserts the
 * packaging config still covers it.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Repo-relative paths are compared against forward-slash globs from the YAML,
 * so every path this file produces must be POSIX-shaped. `path.join`/`normalize`
 * emit backslashes on win32, which silently made `isCovered` return false for
 * everything — see docs/AUDIT_REPORT_2026-07-20.md #5.
 */
const toPosix = (p) => p.replace(/\\/g, "/");

/** Walk relative `from "..."` imports from an entry file, returning repo-relative paths. */
function transitiveImports(entry) {
  const seen = new Set();
  const stack = [toPosix(entry)];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    const abs = join(ROOT, file);
    if (!existsSync(abs)) continue;
    seen.add(file);
    const src = readFileSync(abs, "utf8");
    for (const m of src.matchAll(/from\s+"([^"]+)"/g)) {
      const spec = m[1];
      if (!spec.startsWith(".")) continue;
      stack.push(toPosix(normalize(join(dirname(file), spec))));
    }
  }
  return seen;
}

/**
 * Pull the `files:` list out of electron-builder.yml without a YAML dependency.
 *
 * The EOL alternation is load-bearing: `.` does not match `\r` in JavaScript,
 * so the original `\n`-only pattern never matched a CRLF checkout and this
 * whole tripwire was inoperative on Windows. `.gitattributes` now pins LF, but
 * the pattern stays EOL-tolerant so a stray CRLF cannot re-disarm the guard.
 */
function packagedGlobs() {
  const yml = readFileSync(join(ROOT, "electron-builder.yml"), "utf8");
  const block = yml.match(/^files:[^\S\n]*\r?\n((?:[^\S\n]+-[^\S\n]+.*\r?\n)+)/m);
  assert.ok(block, "electron-builder.yml must declare a files: list");
  return block[1]
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim().replace(/^"|"$/g, ""))
    .filter((g) => !g.startsWith("!"));
}

/** Does any glob cover this repo-relative file? Only the shapes we actually use. */
function isCovered(file, globs) {
  return globs.some((g) => {
    if (g === file) return true;
    const star = g.indexOf("*");
    if (star === -1) return false;
    return file.startsWith(g.slice(0, star));
  });
}

describe("electron packaging", () => {
  test("every lib/ module main.js imports is shipped inside the asar", () => {
    const needed = [...transitiveImports("electron/main.js")]
      .filter((f) => f.startsWith("lib/"))
      .sort();

    // If this trips, main.js stopped importing from lib/ entirely — likely a
    // refactor. Re-point the test rather than deleting it.
    assert.ok(
      needed.length > 0,
      "expected main.js to import from lib/; the import walker may be broken",
    );

    const globs = packagedGlobs();
    const missing = needed.filter((f) => !isCovered(f, globs));

    assert.deepEqual(
      missing,
      [],
      `electron-builder.yml's files: list does not ship these main-process imports, ` +
        `so the packaged app would crash on launch with ERR_MODULE_NOT_FOUND:\n` +
        missing.map((f) => `  - ${f}`).join("\n") +
        `\n\nAdd the covering glob(s) to files: in electron-builder.yml.`,
    );
  });

  test("packaged globs do not reference paths that no longer exist", () => {
    const stale = packagedGlobs()
      .filter((g) => g.includes("*"))
      .map((g) => g.slice(0, g.indexOf("*")).replace(/\/$/, ""))
      .filter((base) => base && !existsSync(join(ROOT, base)));

    assert.deepEqual(stale, [], `electron-builder.yml ships paths that do not exist: ${stale.join(", ")}`);
  });

  test("no artifact filename contains a space", () => {
    // GitHub REWRITES spaces in uploaded release-asset names, and inconsistently:
    // the same release produced "Coop-Prep-0.2.0-arm64.dmg" and
    // "Coop.Prep-0.2.0-arm64.zip.blockmap". So a spaced artifactName is three
    // different strings — what the build wrote, what the release page serves,
    // and what the SHA512SUMS line names.
    //
    // The cost is specific and bad: `shasum -a 512 -c SHA512SUMS-macos-latest.txt`
    // fails with "No such file or directory" against a download that is perfectly
    // intact. For unsigned builds the checksum is the whole integrity story, and a
    // verification step that fails on a GOOD file reads as tampering. That is
    // worse than publishing no checksums at all.
    //
    // Hence: artifactName never interpolates ${productName} (which keeps its space
    // for the window title and the Applications folder).
    const yaml = readFileSync(join(ROOT, "electron-builder.yml"), "utf8");
    const names = [...yaml.matchAll(/^\s*artifactName:\s*(.+?)\s*$/gm)].map((m) => m[1]);

    assert.ok(names.length > 0, "found artifactName entries to check");
    for (const name of names) {
      assert.ok(!name.includes(" "), `artifactName "${name}" contains a space`);
      assert.ok(
        !name.includes("productName"),
        `artifactName "${name}" interpolates productName, which has a space in it`,
      );
    }
  });

  test("every asset electron-builder.yml references is TRACKED BY GIT, not just present on disk", () => {
    // The regression this exists for, verbatim: `win.icon: build/icon.ico`
    // pointed at a file that was never committed. Whoever added it had it on
    // their own disk, so every one of their builds worked; a clean clone could
    // not build the Windows target at all, because electron-builder treats a
    // missing icon path as a hard error before it starts.
    //
    // existsSync() cannot see this — the file IS on disk for the person who
    // just made it. Only git knows whether anyone else will get it, and
    // `build/` is exactly the trap: it is gitignored boilerplate from
    // create-next-app that also happens to be electron-builder's buildResources
    // directory, so an icon dropped there is invisible by default.
    const yaml = readFileSync(join(ROOT, "electron-builder.yml"), "utf8");
    const referenced = [...yaml.matchAll(/^\s*(?:icon|buildResources):\s*(\S+)\s*$/gm)]
      .map((m) => m[1].replace(/^["']|["']$/g, ""))
      .filter((v) => /\.(png|ico|icns|svg)$/i.test(v));

    // A guard that silently matches nothing is decoration.
    assert.ok(referenced.length > 0, "found at least one icon reference to check");

    const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" })
      .split("\0")
      .filter(Boolean);

    const untracked = referenced.filter((rel) => !tracked.includes(rel));
    assert.deepEqual(
      untracked,
      [],
      `electron-builder.yml references ${untracked.join(", ")}, which git does not track — ` +
        "a clean clone cannot build. Check .gitignore: re-including a file needs the PARENT " +
        "directory's contents excluded (`/build/*`), not the directory itself (`/build`).",
    );
  });
});
