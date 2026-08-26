// components/settings/updates-ui.js
//
// The Updates panel's whole decision table, as pure functions.
//
// It lives apart from the component for the same reason endpoints-ui.js does:
// the interesting part is not the markup, it is which of nine states crossed
// with three platform capabilities produces which button — and that is exactly
// the part a rendering test proves badly and a plain function proves well.
//
// The rule the whole table exists to enforce: NEVER show a button that does
// nothing. On an unsigned macOS build "Restart to install" is a lie, so that
// build is never offered one; it gets "Open download page" instead. A button
// that no-ops is worse than an explanation.

/** Human-readable label for the platform's update capability. */
export function describeMode(mode) {
  switch (mode) {
    case "auto":
      return "Coop Prep can install updates itself.";
    case "manual":
      return "Coop Prep will tell you about updates, and you install them.";
    default:
      return "Running from source — update with git pull.";
  }
}

/**
 * The panel's entire visible state for one updater snapshot.
 *
 * @param {object} snapshot - from window.coop.updates.* (see electron/updates/updater.js)
 * @returns {{
 *   headline: string,
 *   body: string,
 *   action: string|null,
 *   actionKind: "check"|"download"|"install"|"open"|null,
 *   busy: boolean,
 *   showProgress: boolean,
 *   percent: number,
 *   tone: "neutral"|"good"|"bad"
 * }}
 */
export function describeUpdateControl(snapshot) {
  const s = snapshot ?? {};
  const version = typeof s.version === "string" ? s.version : null;
  const percent = Number.isFinite(s.percent) ? s.percent : 0;
  const auto = s.mode === "auto";

  const base = {
    headline: "",
    body: "",
    action: null,
    actionKind: null,
    busy: false,
    showProgress: false,
    percent,
    tone: "neutral",
  };

  switch (s.state) {
    case "disabled":
      return {
        ...base,
        headline: "Updates are off in this build",
        body: s.message || describeMode("disabled"),
      };

    case "checking":
      return { ...base, headline: "Checking for updates…", busy: true, action: "Checking…", actionKind: null };

    case "up-to-date":
      return {
        ...base,
        headline: "You're on the latest version",
        body: describeMode(s.mode),
        action: "Check again",
        actionKind: "check",
        tone: "good",
      };

    case "available":
      return {
        ...base,
        headline: version ? `Version ${version} is available` : "An update is available",
        // In check-only mode the reason (unsigned macOS, .deb install) is the
        // most useful thing on screen — it explains why there is a link and
        // not a one-click install.
        body: auto ? "Release notes are on the download page." : s.message || describeMode(s.mode),
        action: auto ? "Download update" : "Open download page",
        actionKind: auto ? "download" : "open",
        tone: "good",
      };

    case "downloading":
      return {
        ...base,
        headline: version ? `Downloading ${version}…` : "Downloading update…",
        body: "You can keep working. Nothing changes until you restart.",
        busy: true,
        showProgress: true,
        action: "Downloading…",
        actionKind: null,
      };

    case "ready":
      // Guarded on `auto` for the same reason "available" is. A check-only
      // build should never reach this state, but if it ever did — a capability
      // misread, a future platform — the failure must be a link, not a restart
      // that throws the user out of the app and installs nothing.
      return {
        ...base,
        headline: version ? `Version ${version} is ready` : "Update ready",
        body: auto ? "It installs when you restart the app." : s.message || describeMode(s.mode),
        action: auto ? "Restart and install" : "Open download page",
        actionKind: auto ? "install" : "open",
        percent: 100,
        tone: "good",
      };

    case "error":
      return {
        ...base,
        headline: "Couldn't check for updates",
        // The message is an Error.message from the main process — our own text
        // or Node's, never HTML off the feed (see sanitizeUpdateInfo).
        body: s.message || "Something went wrong reaching GitHub.",
        action: "Try again",
        actionKind: "check",
        tone: "bad",
      };

    case "idle":
    default:
      return {
        ...base,
        headline: "Check for updates",
        body: describeMode(s.mode),
        action: "Check now",
        actionKind: "check",
      };
  }
}

/**
 * Should the app check on its own when the panel opens?
 *
 * Yes, but at most once an hour: a cohort shares fixes through releases, so an
 * app that never looks is an app where everyone stays on the version with the
 * bug. Rate-limited because opening Settings five times should not mean five
 * requests, and because a check is a network call the user did not explicitly
 * ask for.
 *
 * @param {number|null} lastCheckedAt - epoch ms, or null if never
 * @param {number} now - epoch ms
 * @returns {boolean}
 */
export function shouldAutoCheck(lastCheckedAt, now) {
  if (!Number.isFinite(lastCheckedAt)) return true;
  // A clock that jumped backwards would otherwise suppress checks indefinitely.
  if (lastCheckedAt > now) return true;
  return now - lastCheckedAt >= 60 * 60 * 1000;
}
