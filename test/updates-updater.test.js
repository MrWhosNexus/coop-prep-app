// test/updates-updater.test.js
//
// The updater is the only subsystem here that downloads code and then runs it,
// so these tests are mostly about what it REFUSES to do:
//
//   - never build an external URL out of feed-supplied data
//   - never claim macOS can self-update when the bundle is unsigned
//   - never download or install without being asked
//
// The platform matrix is tested through updateCapability() rather than by
// mocking electron-updater's behaviour on each OS, because the honest question
// is "did we correctly decide what this install can do", and getting that wrong
// optimistically costs the user a 200 MB download and a restart that no-ops.

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  createUpdater,
  macBundleIsSigned,
  releasePageUrl,
  sanitizeUpdateInfo,
  updateCapability,
  UPDATE_OWNER,
  UPDATE_REPO,
} from "../electron/updates/updater.js";

describe("updateCapability", () => {
  test("an unpackaged build never updates itself", () => {
    for (const platform of ["win32", "darwin", "linux"]) {
      const cap = updateCapability({ platform, isPackaged: false });
      assert.equal(cap.mode, "disabled", `${platform} running from source`);
    }
  });

  test("Windows gets in-place updates", () => {
    assert.equal(updateCapability({ platform: "win32", isPackaged: true }).mode, "auto");
  });

  test("an UNSIGNED macOS build is check-only, not auto", () => {
    // The expensive mistake: Squirrel.Mac fails at INSTALL time on an unsigned
    // bundle, i.e. after the download and the restart. Deciding up front is the
    // entire point of this branch.
    const cap = updateCapability({ platform: "darwin", isPackaged: true, isMacSigned: false });
    assert.equal(cap.mode, "manual");
    assert.match(cap.reason, /unsigned/i);
  });

  test("a SIGNED macOS build gets in-place updates", () => {
    assert.equal(updateCapability({ platform: "darwin", isPackaged: true, isMacSigned: true }).mode, "auto");
  });

  test("Linux auto-updates only when launched as an AppImage", () => {
    const appimage = updateCapability({ platform: "linux", isPackaged: true, env: { APPIMAGE: "/tmp/Coop.AppImage" } });
    assert.equal(appimage.mode, "auto");
    // A .deb install has no APPIMAGE in its environment; electron-updater
    // cannot rewrite a dpkg-managed install, so promising it would be a lie.
    const deb = updateCapability({ platform: "linux", isPackaged: true, env: {} });
    assert.equal(deb.mode, "manual");
  });

  test("an unknown platform degrades to check-only rather than assuming auto", () => {
    assert.equal(updateCapability({ platform: "aix", isPackaged: true }).mode, "manual");
  });
});

describe("releasePageUrl", () => {
  test("points at the pinned repo", () => {
    assert.equal(releasePageUrl(), `https://github.com/${UPDATE_OWNER}/${UPDATE_REPO}/releases/latest`);
    assert.equal(releasePageUrl("1.2.3"), `https://github.com/${UPDATE_OWNER}/${UPDATE_REPO}/releases/tag/v1.2.3`);
  });

  test("a non-semver version cannot escape the pinned host", () => {
    // The threat: `version` reaches shell.openExternal. If a feed could put
    // "../../evil" or a whole URL in it, the app opens an attacker's page —
    // or worse a non-http scheme — from a trusted click.
    const hostile = [
      "../../../evil",
      "1.0.0/../../../../evil",
      "https://evil.example.com",
      "javascript:alert(1)",
      "1.0.0?x=y",
      "",
      null,
      undefined,
      { toString: () => "1.0.0" },
    ];
    for (const version of hostile) {
      const url = releasePageUrl(version);
      assert.equal(
        url,
        `https://github.com/${UPDATE_OWNER}/${UPDATE_REPO}/releases/latest`,
        `rejected input fell back to the safe URL: ${String(version)}`
      );
    }
  });
});

describe("sanitizeUpdateInfo", () => {
  test("keeps only a valid version and drops everything else off the feed", () => {
    const out = sanitizeUpdateInfo({
      version: "2.0.0",
      releaseNotes: "<img src=x onerror=alert(1)>",
      releaseName: "pwn",
      files: [{ url: "https://evil.example.com/app.exe" }],
      path: "https://evil.example.com/app.exe",
    });
    assert.deepEqual(Object.keys(out).sort(), ["releaseUrl", "version"]);
    assert.equal(out.version, "2.0.0");
    assert.ok(out.releaseUrl.startsWith(`https://github.com/${UPDATE_OWNER}/${UPDATE_REPO}/`));
  });

  test("release notes never cross into the renderer", () => {
    // Author-controlled HTML rendered in the app would be an XSS sink that the
    // CSP's script-src cannot fully cover (inline event handlers, etc.). The
    // renderer links to GitHub instead.
    const out = sanitizeUpdateInfo({ version: "2.0.0", releaseNotes: "<script>x</script>" });
    assert.equal("releaseNotes" in out, false);
  });
});

describe("macBundleIsSigned", () => {
  test("true only when the _CodeSignature marker is present", () => {
    const appPath = "/Applications/Coop Prep.app/Contents/Resources/app.asar";
    const seen = [];
    const signed = macBundleIsSigned({
      appPath,
      exists: (p) => {
        seen.push(p);
        return true;
      },
    });
    assert.equal(signed, true);
    assert.equal(seen[0], "/Applications/Coop Prep.app/Contents/_CodeSignature/CodeResources");
  });

  test("an unreadable bundle counts as unsigned", () => {
    // Fail closed: the optimistic error costs a download and a dead restart.
    const signed = macBundleIsSigned({
      appPath: "/Applications/Coop Prep.app/Contents/Resources/app.asar",
      exists: () => {
        throw new Error("EPERM");
      },
    });
    assert.equal(signed, false);
  });
});

/** A stand-in for electron-updater's autoUpdater with the same surface we touch. */
function fakeAutoUpdater({ updateInfo = { version: "9.9.9" }, checkThrows = null } = {}) {
  const listeners = new Map();
  return {
    autoDownload: true, // deliberately the WRONG default, so we can assert it is flipped
    autoInstallOnAppQuit: true,
    feedUrl: null,
    downloadCalls: 0,
    quitAndInstallCalls: [],
    setFeedURL(cfg) {
      this.feedUrl = cfg;
    },
    on(event, fn) {
      listeners.set(event, fn);
    },
    emit(event, payload) {
      listeners.get(event)?.(payload);
    },
    async checkForUpdates() {
      if (checkThrows) throw checkThrows;
      return { updateInfo };
    },
    async downloadUpdate() {
      this.downloadCalls++;
    },
    quitAndInstall(...args) {
      this.quitAndInstallCalls.push(args);
    },
  };
}

const AUTO = { mode: "auto", reason: "" };
const MANUAL = { mode: "manual", reason: "macOS builds are unsigned." };

describe("createUpdater", () => {
  test("turns off silent download and silent install, and pins the feed", () => {
    const au = fakeAutoUpdater();
    createUpdater({ autoUpdater: au, currentVersion: "1.0.0", capability: AUTO });
    assert.equal(au.autoDownload, false, "nothing downloads unasked");
    assert.equal(au.autoInstallOnAppQuit, false, "nothing installs unasked");
    assert.deepEqual(au.feedUrl, { provider: "github", owner: UPDATE_OWNER, repo: UPDATE_REPO });
  });

  test("reports an available update without downloading it", async () => {
    const au = fakeAutoUpdater({ updateInfo: { version: "2.0.0" } });
    const u = createUpdater({ autoUpdater: au, currentVersion: "1.0.0", capability: AUTO });
    const state = await u.check();
    assert.equal(state.state, "available");
    assert.equal(state.version, "2.0.0");
    assert.equal(au.downloadCalls, 0, "check() must not download");
  });

  test("the same version is 'up-to-date', not 'available'", async () => {
    const au = fakeAutoUpdater({ updateInfo: { version: "1.0.0" } });
    const u = createUpdater({ autoUpdater: au, currentVersion: "1.0.0", capability: AUTO });
    assert.equal((await u.check()).state, "up-to-date");
  });

  test("a failed check surfaces as an error state rather than throwing", async () => {
    const au = fakeAutoUpdater({ checkThrows: new Error("getaddrinfo ENOTFOUND") });
    const u = createUpdater({ autoUpdater: au, currentVersion: "1.0.0", capability: AUTO });
    const state = await u.check();
    assert.equal(state.state, "error");
    assert.match(state.message, /ENOTFOUND/);
  });

  test("install() is refused until a download has actually completed", async () => {
    const au = fakeAutoUpdater({ updateInfo: { version: "2.0.0" } });
    const u = createUpdater({ autoUpdater: au, currentVersion: "1.0.0", capability: AUTO });
    u.install();
    assert.equal(au.quitAndInstallCalls.length, 0, "idle");
    await u.check();
    u.install();
    assert.equal(au.quitAndInstallCalls.length, 0, "available but not downloaded");
    await u.download();
    au.emit("update-downloaded");
    u.install();
    assert.equal(au.quitAndInstallCalls.length, 1, "ready");
  });

  test("check-only installs open the release page instead of downloading", async () => {
    const au = fakeAutoUpdater({ updateInfo: { version: "2.0.0" } });
    const opened = [];
    const u = createUpdater({
      autoUpdater: au,
      currentVersion: "1.0.0",
      capability: MANUAL,
      openExternal: (url) => opened.push(url),
    });
    await u.check();
    await u.download();
    assert.equal(au.downloadCalls, 0, "check-only must never invoke the downloader");
    assert.deepEqual(opened, [`https://github.com/${UPDATE_OWNER}/${UPDATE_REPO}/releases/tag/v2.0.0`]);
  });

  test("check-only never reports canInstall, even once 'ready' is faked", async () => {
    const au = fakeAutoUpdater({ updateInfo: { version: "2.0.0" } });
    const u = createUpdater({ autoUpdater: au, currentVersion: "1.0.0", capability: MANUAL });
    await u.check();
    au.emit("update-downloaded");
    assert.equal(u.getState().canInstall, false);
    u.install();
    assert.equal(au.quitAndInstallCalls.length, 0);
  });

  test("a disabled capability touches electron-updater not at all", async () => {
    const au = fakeAutoUpdater();
    const u = createUpdater({
      autoUpdater: au,
      currentVersion: "1.0.0",
      capability: { mode: "disabled", reason: "running from source" },
    });
    assert.equal(au.feedUrl, null, "no feed configured");
    assert.equal(au.autoDownload, true, "untouched — we never got as far as configuring it");
    assert.equal((await u.check()).state, "disabled");
    await u.download();
    assert.equal(au.downloadCalls, 0);
  });

  test("download progress is clamped to 0..100 and pushed to the subscriber", async () => {
    const au = fakeAutoUpdater({ updateInfo: { version: "2.0.0" } });
    const seen = [];
    const u = createUpdater({
      autoUpdater: au,
      currentVersion: "1.0.0",
      capability: AUTO,
      onState: (s) => seen.push(s),
    });
    await u.check();
    au.emit("download-progress", { percent: 42.7 });
    assert.equal(u.getState().percent, 43);
    // A provider that reports nonsense must not produce a nonsense progress bar.
    au.emit("download-progress", { percent: -5 });
    assert.equal(u.getState().percent, 0);
    au.emit("download-progress", { percent: 1e6 });
    assert.equal(u.getState().percent, 100);
    assert.ok(seen.length >= 4, "every transition was pushed");
  });

  test("the state snapshot carries no feed-supplied fields", async () => {
    const au = fakeAutoUpdater({
      updateInfo: { version: "2.0.0", releaseNotes: "<script>x</script>", path: "https://evil.example/x.exe" },
    });
    const u = createUpdater({ autoUpdater: au, currentVersion: "1.0.0", capability: AUTO });
    const state = await u.check();
    const serialized = JSON.stringify(state);
    assert.ok(!serialized.includes("evil.example"), "no feed URL reached the renderer");
    assert.ok(!serialized.includes("<script>"), "no feed HTML reached the renderer");
    assert.deepEqual(
      Object.keys(state).sort(),
      ["canInstall", "currentVersion", "message", "mode", "percent", "releaseUrl", "state", "version"]
    );
  });
});
