/**
 * test/userdata-name.test.js
 *
 * Guards where the app's user data — including the API key store — actually lands.
 *
 * Electron reads package.json for the app name ONLY when launched against a
 * DIRECTORY (`electron .`). The dev script launches a FILE
 * (`electron electron/main.js`), so app.getName() fell back to the literal
 * "Electron" and userData resolved to ~/.config/Electron — the shared directory
 * every unpackaged Electron app on the machine uses. Verified live against the
 * running app: app.getPath("userData") returned "/home/merk/.config/Electron"
 * while the PACKAGED build used ~/.config/coop-prep.
 *
 * Consequences: the user's endpoints.json (with their key) and store.json (notes,
 * progress) sat in a drawer shared with any other Electron dev project, and a key
 * configured in dev silently never reached the packaged app.
 *
 * This cannot be caught by launching Electron in `node --test`, so it asserts the
 * two things that made it happen: main.js pins the name itself, and the dev
 * script does not rely on package.json being read.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const main = readFileSync(join(ROOT, "electron/main.js"), "utf8");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

describe("userData location", () => {
  test("main.js pins the app name before anything resolves userData", () => {
    assert.match(
      main,
      /app\.setName\(\s*["']coop-prep["']\s*\)/,
      "main.js must call app.setName('coop-prep') — without it, a file-path launch " +
        "resolves userData to ~/.config/Electron, a directory shared with every " +
        "other unpackaged Electron app, and the API key store goes there",
    );
  });

  test("setName runs before the first getPath('userData')", () => {
    // Order is the whole point: buildIpcDeps() resolves userData at whenReady,
    // and a setName after that would be silently too late.
    //
    // Search CODE, not prose. The docblock above setName necessarily quotes
    // `app.getPath("userData")` to explain itself, and a naive indexOf matched
    // that comment — reporting the call as preceding setName when it does not.
    // Same lesson as the key tripwires in test/integration.test.js: a guard that
    // reads comments is measuring the wrong text.
    const code = main
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join("\n");

    const nameAt = code.indexOf("app.setName(");
    const pathAt = code.indexOf('getPath("userData")');
    assert.ok(nameAt >= 0, "app.setName must be present in code, not only in a comment");
    if (pathAt >= 0) {
      assert.ok(nameAt < pathAt, "app.setName must precede the first getPath('userData')");
    }
  });

  test("the pinned name matches package.json, so dev and packaged agree", () => {
    const pinned = main.match(/app\.setName\(\s*["']([^"']+)["']\s*\)/)?.[1];
    assert.equal(
      pinned,
      pkg.name,
      "dev must resolve the same userData as the packaged build, or a key configured " +
        "in one is invisible to the other",
    );
  });

  test("the dev script does not depend on package.json being read for the name", () => {
    // `electron electron/main.js` is a FILE launch — package.json is never read,
    // which is exactly how this shipped. That spelling is fine ONLY because
    // setName now pins the name regardless; this test records the coupling so a
    // future edit removing setName fails loudly rather than silently relocating
    // the user's key.
    const dev = pkg.scripts?.["electron:dev"] ?? "";
    assert.match(dev, /electron/, "expected an electron:dev script");
    if (/electron\s+electron\/main\.js/.test(dev)) {
      assert.match(
        main,
        /app\.setName\(/,
        "electron:dev launches a FILE path, so package.json's name is never read — " +
          "main.js MUST pin the name itself",
      );
    }
  });
});
