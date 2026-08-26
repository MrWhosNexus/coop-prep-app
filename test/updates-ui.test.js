// test/updates-ui.test.js
//
// Two halves:
//
//   1. The decision table (updates-ui.js) — nine states crossed with three
//      capabilities. The invariant worth pinning is that a build which CANNOT
//      install an update is never offered a button that would try.
//
//   2. The call site. This project has been bitten four times by a written,
//      tested, never-invoked seam (see the KNOWN_UNBUILT pattern elsewhere in
//      this suite), so the panel existing is not evidence that anything renders
//      it, and the preload exposing `updates` is not evidence that the main
//      process answers. Both are asserted here against the real files.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describeUpdateControl, describeMode, shouldAutoCheck } from "../components/settings/updates-ui.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(repoRoot, rel), "utf8");

// electron/ipc/index.js cannot be imported here: it pulls in handlers.js, which
// imports "electron", which does not exist under plain `node --test`. Read the
// allowlist out of the source instead — this is checking that a literal is
// present in the shipped file, which is exactly what the text gives us.
const CHANNELS = [...read("electron/ipc/index.js").matchAll(/^\s*"([a-z]+:[A-Za-z-]+)",$/gm)].map((m) => m[1]);

const AUTO = (state, extra = {}) => ({ state, mode: "auto", currentVersion: "1.0.0", percent: 0, ...extra });
const MANUAL = (state, extra = {}) => ({ state, mode: "manual", currentVersion: "1.0.0", percent: 0, ...extra });

describe("describeUpdateControl", () => {
  test("an auto-capable build is offered a download, then an install", () => {
    const available = describeUpdateControl(AUTO("available", { version: "2.0.0" }));
    assert.equal(available.actionKind, "download");
    assert.match(available.headline, /2\.0\.0/);

    const ready = describeUpdateControl(AUTO("ready", { version: "2.0.0" }));
    assert.equal(ready.actionKind, "install");
    assert.equal(ready.percent, 100);
  });

  test("a check-only build is NEVER offered download or install", () => {
    // The core invariant. On unsigned macOS "Restart and install" would run
    // Squirrel.Mac against a bundle it will refuse — a button that lies.
    for (const state of ["available", "ready", "downloading", "up-to-date", "idle", "error"]) {
      const view = describeUpdateControl(MANUAL(state, { version: "2.0.0" }));
      assert.notEqual(view.actionKind, "install", `${state} offered install`);
      assert.notEqual(view.actionKind, "download", `${state} offered download`);
    }
  });

  test("a check-only build with an update available links to the download page", () => {
    const view = describeUpdateControl(MANUAL("available", { version: "2.0.0", message: "macOS builds are unsigned." }));
    assert.equal(view.actionKind, "open");
    assert.match(view.body, /unsigned/);
  });

  test("in-flight states disable the button rather than offering a no-op", () => {
    for (const state of ["checking", "downloading"]) {
      const view = describeUpdateControl(AUTO(state));
      assert.equal(view.busy, true, state);
      assert.equal(view.actionKind, null, `${state} must not be clickable`);
    }
  });

  test("downloading shows a progress bar carrying the reported percent", () => {
    const view = describeUpdateControl(AUTO("downloading", { version: "2.0.0", percent: 37 }));
    assert.equal(view.showProgress, true);
    assert.equal(view.percent, 37);
  });

  test("no other state shows a progress bar", () => {
    for (const state of ["idle", "checking", "available", "ready", "up-to-date", "error", "disabled"]) {
      assert.equal(describeUpdateControl(AUTO(state, { percent: 50 })).showProgress, false, state);
    }
  });

  test("a disabled build gets an explanation and no action at all", () => {
    const view = describeUpdateControl({ state: "disabled", mode: "disabled", message: "Running from source." });
    assert.equal(view.action, null);
    assert.equal(view.actionKind, null);
  });

  test("an error is recoverable, not terminal", () => {
    const view = describeUpdateControl(AUTO("error", { message: "getaddrinfo ENOTFOUND github.com" }));
    assert.equal(view.actionKind, "check");
    assert.equal(view.tone, "bad");
    assert.match(view.body, /ENOTFOUND/);
  });

  test("a missing or unknown snapshot degrades to a plain check button", () => {
    for (const snapshot of [null, undefined, {}, { state: "who-knows" }]) {
      const view = describeUpdateControl(snapshot);
      assert.equal(view.actionKind, "check");
      assert.equal(view.busy, false);
    }
  });

  test("every state produces a headline — no blank panel", () => {
    for (const state of ["idle", "checking", "available", "downloading", "ready", "up-to-date", "error", "disabled"]) {
      for (const mode of ["auto", "manual", "disabled"]) {
        const view = describeUpdateControl({ state, mode, percent: 0 });
        assert.ok(view.headline.length > 0, `${mode}/${state}`);
      }
    }
  });

  test("describeMode never returns an empty string", () => {
    for (const mode of ["auto", "manual", "disabled", "nonsense", undefined]) {
      assert.ok(describeMode(mode).length > 0, String(mode));
    }
  });
});

describe("shouldAutoCheck", () => {
  const HOUR = 60 * 60 * 1000;
  test("checks when it never has", () => {
    assert.equal(shouldAutoCheck(null, 1_000_000), true);
  });
  test("does not re-check within the hour", () => {
    assert.equal(shouldAutoCheck(1_000_000, 1_000_000 + HOUR - 1), false);
  });
  test("checks again after an hour", () => {
    assert.equal(shouldAutoCheck(1_000_000, 1_000_000 + HOUR), true);
  });
  test("a backwards clock jump does not suppress checks forever", () => {
    // Without this branch, one bad timestamp in the future means the app never
    // checks again for as long as it is installed.
    assert.equal(shouldAutoCheck(2_000_000, 1_000_000), true);
  });
});

describe("the updates seam is actually wired", () => {
  test("Settings renders UpdatesPanel", () => {
    // Written-but-uninvoked is this codebase's recurring defect; assert the
    // CALL SITE, not the component's own correctness.
    const settings = read("components/Settings.js");
    assert.match(settings, /import UpdatesPanel from "@\/components\/settings\/UpdatesPanel"/);
    assert.match(settings, /<UpdatesPanel\s*\/>/);
  });

  test("every method the panel calls exists on the preload bridge", () => {
    const preload = read("electron/preload.js");
    const panel = read("components/settings/UpdatesPanel.js");
    for (const method of ["getState", "check", "download", "install", "openReleasePage", "onStatus"]) {
      assert.match(preload, new RegExp(`\\b${method}:`), `preload exposes updates.${method}`);
      assert.ok(panel.includes(`bridge.${method}`), `the panel actually calls ${method}`);
    }
  });

  test("every invoked update channel is registered by the main process", () => {
    const handlers = read("electron/ipc/handlers.js");
    for (const channel of ["getState", "check", "download", "install", "openReleasePage"]) {
      const full = `updates:${channel}`;
      assert.ok(CHANNELS.includes(full), `${full} is in the channel allowlist`);
      assert.ok(handlers.includes(`"${full}"`), `${full} has a handler`);
    }
  });

  test("the push channel is a push channel, not a handler", () => {
    // "updates:status" is sent unsolicited by main. Registering it with
    // ipcMain.handle would be meaningless, and omitting it from the preload
    // allowlist would make subscribe() throw at runtime.
    const preload = read("electron/preload.js");
    const handlers = read("electron/ipc/handlers.js");
    assert.ok(CHANNELS.includes("updates:status"));
    assert.match(preload, /ALLOWED_STREAM_CHANNELS = new Set\(\[[^\]]*"updates:status"/);
    assert.ok(!handlers.includes('"updates:status":'), "must not be ipcMain.handle'd");
  });

  test("main.js constructs the updater and passes it into the handlers", () => {
    const main = read("electron/main.js");
    assert.match(main, /buildUpdater\(\)/);
    assert.match(main, /updates: await buildUpdater\(\)/);
  });

  test("the renderer cannot name a download target", () => {
    // Every bridge method is argument-free by design: the renderer chooses
    // WHEN, never WHAT. A method that grew a parameter would be the moment
    // injected script could aim the updater somewhere else.
    const preload = read("electron/preload.js");
    const block = preload.slice(preload.indexOf("updates: {"), preload.indexOf("updates: {") + 500);
    for (const method of ["getState", "check", "download", "install", "openReleasePage"]) {
      assert.match(
        block,
        new RegExp(`${method}: \\(\\) =>`),
        `updates.${method} must take no arguments`
      );
    }
  });
});
