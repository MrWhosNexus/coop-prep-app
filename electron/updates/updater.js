// electron/updates/updater.js
// Owns "is there a newer build, and can this install take it?".
//
// An auto-updater is the one subsystem in this app that downloads code and then
// RUNS it, so the security posture here is deliberately narrower than
// electron-updater's defaults:
//
//   - The feed is PINNED IN THIS FILE to one GitHub owner/repo. It is never
//     read from config, from an env var, or from the update metadata itself.
//     A feed URL an attacker (or a well-meaning fork) can influence is the
//     whole attack: point the app at your server, ship any binary you like.
//   - autoDownload is OFF. Nothing is fetched until the user asks for it.
//   - autoInstallOnAppQuit is OFF. Nothing is swapped in behind the user's back.
//   - Every URL we ever hand to shell.openExternal is BUILT from the pinned
//     constants below plus a version string we validate as a semver — never
//     taken from the feed. `releaseNotes`/`releaseName` from the feed are
//     attacker-influenced text and are treated as untrusted display data.
//   - Integrity is electron-updater's: the *.yml metadata carries a sha512 per
//     artifact and the download is rejected on mismatch. That is only as strong
//     as HTTPS to github.com, which is also how the app itself was installed,
//     so it adds no new trust root.
//
// What actually works, per platform, is NOT uniform, and pretending otherwise
// is how you get a "Restart to update" button that silently does nothing:
//
//   Windows (NSIS)   full auto-update. Unsigned builds update fine; SmartScreen
//                    warns on the first install, not on updates.
//   Linux (AppImage) full auto-update, but ONLY when running as an AppImage —
//                    the process must have been launched from one (APPIMAGE is
//                    set). A .deb install gets its updates from apt's model,
//                    which we do not have, so it is check-only.
//   macOS            check-only unless the app is CODE SIGNED. Squirrel.Mac
//                    refuses to apply an update to an unsigned bundle, and it
//                    fails at INSTALL time, i.e. after a 200 MB download and a
//                    restart. Since this project ships unsigned builds (no
//                    Apple Developer ID), macOS is check-only by design and
//                    says so in the UI rather than discovering it at the end.
//
// "check-only" is not a failure state: it still tells the user a new version
// exists and opens the release page. It just does not swap the binary.

import path from "node:path";

/** The one place the update feed is defined. Changing this changes what code this app will run. */
export const UPDATE_OWNER = "MrWhosNexus";
export const UPDATE_REPO = "coop-prep-app";

/** Anchored, no dots-or-slashes — a version string is interpolated into a URL. */
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * The releases page, or one specific release's page.
 *
 * Built from the pinned constants and a validated version — deliberately not
 * from the feed's own `releaseNotesUrl`-style fields, which are remote input
 * heading for shell.openExternal (i.e. "open anything in the user's browser").
 *
 * @param {string} [version] - bare semver, no leading "v"
 * @returns {string}
 */
export function releasePageUrl(version) {
  const base = `https://github.com/${UPDATE_OWNER}/${UPDATE_REPO}/releases`;
  if (typeof version === "string" && SEMVER_RE.test(version)) {
    return `${base}/tag/v${version}`;
  }
  return `${base}/latest`;
}

/**
 * What this particular install is actually able to do about an update.
 *
 * Pure and fully injected so every branch is testable — the alternative is
 * discovering macOS's behaviour on a user's machine, after a download.
 *
 * @param {object} opts
 * @param {string} opts.platform - process.platform
 * @param {boolean} opts.isPackaged - app.isPackaged
 * @param {Record<string, string|undefined>} [opts.env] - process.env
 * @param {boolean} [opts.isMacSigned] - whether the .app bundle carries a signature
 * @returns {{ mode: "auto"|"manual"|"disabled", reason: string }}
 */
export function updateCapability({ platform, isPackaged, env = {}, isMacSigned = false }) {
  if (!isPackaged) {
    return {
      mode: "disabled",
      reason: "Updates apply to installed builds. You're running from source — use git pull.",
    };
  }
  if (platform === "win32") {
    return { mode: "auto", reason: "" };
  }
  if (platform === "darwin") {
    return isMacSigned
      ? { mode: "auto", reason: "" }
      : {
          mode: "manual",
          reason:
            "macOS only applies updates to code-signed apps, and these builds are unsigned. " +
            "Coop Prep will tell you when a new version is out and open the download page.",
        };
  }
  if (platform === "linux") {
    return env.APPIMAGE
      ? { mode: "auto", reason: "" }
      : {
          mode: "manual",
          reason:
            "In-place updates work in the AppImage build. This looks like a .deb install, " +
            "so Coop Prep will point you at the new download instead.",
        };
  }
  return { mode: "manual", reason: "This platform has no in-place updater." };
}

/**
 * Is the running .app code signed? Only meaningful on macOS.
 *
 * Squirrel.Mac's real check is a full signature validation; this is the cheap
 * precondition for it — an unsigned bundle has no _CodeSignature directory at
 * all. Getting this WRONG in the optimistic direction is the expensive error
 * (download, restart, silent no-op), so anything unreadable counts as unsigned.
 *
 * @param {object} opts
 * @param {string} opts.appPath - app.getAppPath()
 * @param {(p: string) => boolean} opts.exists
 * @returns {boolean}
 */
export function macBundleIsSigned({ appPath, exists }) {
  // app.getAppPath() is <bundle>/Contents/Resources/app(.asar); the signature
  // lives at <bundle>/Contents/_CodeSignature.
  const marker = path.join(appPath, "..", "..", "_CodeSignature", "CodeResources");
  try {
    return exists(path.normalize(marker));
  } catch {
    return false;
  }
}

/**
 * Strip an update payload down to what the renderer is allowed to see.
 *
 * `info` comes off the network. Release notes are author-controlled HTML in
 * electron-updater's own shape, so they do not cross into the renderer at all —
 * the renderer links to the release page instead, where GitHub renders them in
 * a sandbox that is GitHub's problem rather than ours.
 *
 * @param {{ version?: string }} info
 * @returns {{ version: string|null, releaseUrl: string }}
 */
export function sanitizeUpdateInfo(info) {
  const version = typeof info?.version === "string" && SEMVER_RE.test(info.version) ? info.version : null;
  return { version, releaseUrl: releasePageUrl(version ?? undefined) };
}

/**
 * Build the update controller.
 *
 * @param {object} deps
 * @param {object} deps.autoUpdater - electron-updater's autoUpdater (injected for tests)
 * @param {string} deps.currentVersion - app.getVersion()
 * @param {{ mode: string, reason: string }} deps.capability - from updateCapability()
 * @param {(state: object) => void} [deps.onState] - pushed to the renderer on every transition
 * @param {(url: string) => void} [deps.openExternal]
 * @returns {{ getState: () => object, check: () => Promise<object>, download: () => Promise<object>, install: () => object, openReleasePage: () => object }}
 */
export function createUpdater({ autoUpdater, currentVersion, capability, onState = () => {}, openExternal }) {
  /** @type {{state: string, version: string|null, releaseUrl: string, percent: number, message: string}} */
  let current = {
    state: capability.mode === "disabled" ? "disabled" : "idle",
    version: null,
    releaseUrl: releasePageUrl(),
    percent: 0,
    message: capability.reason,
  };

  const snapshot = () => ({
    ...current,
    currentVersion,
    mode: capability.mode,
    canInstall: capability.mode === "auto" && current.state === "ready",
  });

  function set(patch) {
    current = { ...current, ...patch };
    onState(snapshot());
    return snapshot();
  }

  if (capability.mode !== "disabled" && autoUpdater) {
    // Consent, not surprise: nothing downloads or swaps itself in on its own.
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    // Pinned feed. Set explicitly rather than relying on the `publish` block
    // baked into the build, so a repackaged/forked artifact cannot silently
    // inherit a different one.
    try {
      autoUpdater.setFeedURL({ provider: "github", owner: UPDATE_OWNER, repo: UPDATE_REPO });
    } catch {
      /* electron-updater throws when the app is not packaged; capability already covers that */
    }
    autoUpdater.on?.("download-progress", (p) => {
      set({ state: "downloading", percent: Math.max(0, Math.min(100, Math.round(p?.percent ?? 0))) });
    });
    autoUpdater.on?.("update-downloaded", () => {
      set({ state: "ready", percent: 100, message: "Downloaded. Restart to finish installing." });
    });
    autoUpdater.on?.("error", (err) => {
      set({ state: "error", message: err?.message || "The update check failed." });
    });
  }

  async function check() {
    if (capability.mode === "disabled") return snapshot();
    set({ state: "checking", message: "", percent: 0 });
    try {
      const result = await autoUpdater.checkForUpdates();
      const { version, releaseUrl } = sanitizeUpdateInfo(result?.updateInfo);
      if (!version || version === currentVersion) {
        return set({ state: "up-to-date", version: null, releaseUrl, message: "You're on the latest version." });
      }
      return set({
        state: "available",
        version,
        releaseUrl,
        message: capability.mode === "manual" ? capability.reason : "",
      });
    } catch (e) {
      return set({ state: "error", message: e instanceof Error ? e.message : "The update check failed." });
    }
  }

  async function download() {
    if (capability.mode !== "auto") {
      // Nothing to download in check-only mode — hand them the release page,
      // which is a URL we built, not one the feed supplied.
      openExternal?.(current.releaseUrl);
      return snapshot();
    }
    if (current.state !== "available") return snapshot();
    set({ state: "downloading", percent: 0 });
    try {
      await autoUpdater.downloadUpdate();
      return snapshot(); // "update-downloaded" drives the transition to "ready"
    } catch (e) {
      return set({ state: "error", message: e instanceof Error ? e.message : "The download failed." });
    }
  }

  function install() {
    if (capability.mode !== "auto" || current.state !== "ready") return snapshot();
    // isSilent=false, isForceRunAfter=true — the user asked for this and should
    // land back in the app, not at a closed window.
    autoUpdater.quitAndInstall(false, true);
    return snapshot();
  }

  function openReleasePage() {
    openExternal?.(current.releaseUrl);
    return snapshot();
  }

  return { getState: snapshot, check, download, install, openReleasePage };
}
