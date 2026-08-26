"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { describeUpdateControl, shouldAutoCheck } from "@/components/settings/updates-ui";

/**
 * Updates panel.
 *
 * Thin on purpose — every decision about what to show lives in updates-ui.js,
 * and every decision about what is SAFE to do lives in the main process
 * (electron/updates/updater.js). This component chooses when to ask, nothing
 * more: it cannot name a version, a URL, or a download target, because the
 * bridge methods take no arguments at all.
 *
 * Without the desktop shell (the web build, or a browser tab) there is no
 * updater and the panel renders a short explanation rather than dead controls.
 */
export default function UpdatesPanel() {
  const bridge = typeof window === "undefined" ? null : window.coop?.updates || null;
  const [snapshot, setSnapshot] = useState(null);
  const lastCheckedAt = useRef(null);

  const run = useCallback(
    async (fn) => {
      if (!bridge) return;
      try {
        const next = await fn();
        if (next) setSnapshot(next);
      } catch {
        // The main process turns its own failures into an "error" snapshot; a
        // throw here means the bridge itself is gone, and there is nothing the
        // panel can usefully say about that beyond leaving the last state up.
      }
    },
    [bridge]
  );

  useEffect(() => {
    if (!bridge) return undefined;
    let alive = true;

    // Subscribe BEFORE the first check: download progress and "update-downloaded"
    // arrive as pushes, and a check that resolves first would otherwise race the
    // subscription and drop the early frames.
    const unsubscribe = bridge.onStatus?.((state) => {
      if (alive) setSnapshot(state);
    });

    bridge.getState()
      .then((state) => {
        if (!alive) return;
        setSnapshot(state);
        if (state?.mode !== "disabled" && shouldAutoCheck(lastCheckedAt.current, Date.now())) {
          lastCheckedAt.current = Date.now();
          run(() => bridge.check());
        }
      })
      .catch(() => {});

    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [bridge, run]);

  if (!bridge) {
    return (
      <section className="glass" style={panelStyle}>
        <div style={titleStyle}>Updates</div>
        <div style={bodyStyle}>
          Updates are handled by the desktop app. In the browser build you always
          have whatever version was served to you.
        </div>
      </section>
    );
  }

  const view = describeUpdateControl(snapshot);
  const onAction = () => {
    if (view.actionKind === "check") {
      lastCheckedAt.current = Date.now();
      run(() => bridge.check());
    } else if (view.actionKind === "download") run(() => bridge.download());
    else if (view.actionKind === "install") run(() => bridge.install());
    else if (view.actionKind === "open") run(() => bridge.openReleasePage());
  };

  const toneColor =
    view.tone === "good" ? "var(--green-2)" : view.tone === "bad" ? "var(--red-2, var(--text-1))" : "var(--text-1)";

  return (
    <section className="glass" style={panelStyle}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div style={titleStyle}>Updates</div>
        {snapshot?.currentVersion ? (
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>You have v{snapshot.currentVersion}</div>
        ) : null}
      </div>

      <div style={{ ...bodyStyle, color: toneColor, fontWeight: 600, marginTop: 10 }}>{view.headline}</div>
      {view.body ? <div style={{ ...bodyStyle, marginTop: 4 }}>{view.body}</div> : null}

      {view.showProgress && (
        <div
          role="progressbar"
          aria-valuenow={view.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Update download progress"
          style={{
            height: 6,
            borderRadius: 999,
            background: "var(--surface-3, rgba(255,255,255,0.08))",
            overflow: "hidden",
            marginTop: 12,
          }}
        >
          <div style={{ width: `${view.percent}%`, height: "100%", background: "var(--green-2)" }} />
        </div>
      )}

      {view.action && (
        <button
          className="btn-ghost"
          type="button"
          style={{ marginTop: 14 }}
          disabled={view.busy || !view.actionKind}
          onClick={onAction}
        >
          {view.action}
        </button>
      )}
    </section>
  );
}

const panelStyle = { padding: "16px 18px", marginTop: 20, borderRadius: "var(--r-md)" };
const titleStyle = { fontSize: 14, fontWeight: 700, color: "var(--text-1)" };
const bodyStyle = { fontSize: 13, color: "var(--text-3)", lineHeight: 1.6 };
