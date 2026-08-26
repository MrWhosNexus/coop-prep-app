"use client";

import { useEffect, useState } from "react";
import EndpointsPanel from "@/components/settings/EndpointsPanel";
import UpdatesPanel from "@/components/settings/UpdatesPanel";
import {
  describeLegacyKeyControl,
  removeLegacyAIConfig,
} from "@/components/settings/endpoints-ui";
import { ensureLegacyAIConfigMigrated, hasAIKey } from "@/lib/ai/config";

/**
 * Settings view.
 *
 * The only surface is the AI endpoint registry (components/settings/
 * EndpointsPanel), which talks to the Electron main process over
 * window.coop.endpoints — API keys live there and NEVER reach this renderer
 * (the panel only ever sees key-free EndpointViews).
 *
 * There is deliberately NO second, browser-local key form any more. It fed
 * lib/ai/client.js's old renderer-side fetch, which is gone; leaving the form
 * would mean a user could type a plaintext key into a page that has nothing to
 * do with it, and would give the app two key sources — the failure mode the
 * EndpointsPanel header warns about at length. Without the desktop shell there
 * is no AI, and the tools say so instead of pretending.
 *
 * Any legacy localStorage key is migrated INTO the main-process registry and
 * scrubbed on mount — but this view is no longer the only place that happens
 * (see lib/ai/config.js#ensureLegacyAIConfigMigrated), because a user who never
 * opens Settings must not keep a live key in the renderer.
 *
 * THE MIGRATION IS NOT AN EXIT. It needs the Electron bridge (there is no
 * registry to migrate INTO without one) and it can fail. Either way the user is
 * left holding a plaintext key with no way to remove it — the "Clear key" button
 * that used to do that is gone. So this view also renders an unconditional
 * removal control whenever a legacy key is present, on every build: getting your
 * key back out is not a feature of the desktop app, it is a property of the app.
 */

const DISABLED_KEY = "coop_endpoints_disabled_v1";

function loadDisabledIds() {
  try {
    const raw = localStorage.getItem(DISABLED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDisabledIds(ids) {
  try {
    localStorage.setItem(DISABLED_KEY, JSON.stringify(ids));
  } catch {}
}

export default function Settings({ onClose, onSaved }) {
  // Settings only ever mounts client-side (behind Dashboard's loading gate),
  // so client-only reads happen in lazy initializers, not effects.
  const [disabledIds, setDisabledIds] = useState(() =>
    typeof window === "undefined" ? [] : loadDisabledIds()
  );
  const [migrationNote, setMigrationNote] = useState("");
  const [hasBridge] = useState(
    () => typeof window !== "undefined" && !!window.coop?.endpoints
  );
  const [hasLegacyKey, setHasLegacyKey] = useState(() =>
    typeof window === "undefined" ? false : hasAIKey()
  );

  useEffect(() => {
    if (!hasBridge) return;
    ensureLegacyAIConfigMigrated(window.coop.endpoints)
      .then((res) => {
        if (res?.migrated) {
          setMigrationNote(
            "Your saved API key was moved into the endpoint registry below and removed from browser storage."
          );
          onSaved?.();
        }
      })
      .catch(() => {})
      // Re-read rather than assume: a migration that failed leaves the key in
      // place, and that is exactly when the removal control has to appear.
      .finally(() => setHasLegacyKey(hasAIKey()));
    // onSaved is stable for the life of the view; run-once on mount is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBridge]);

  const legacyControl = describeLegacyKeyControl({ hasBridge, hasLegacyKey });

  function handleDisabledIdsChange(ids) {
    setDisabledIds(ids);
    saveDisabledIds(ids);
  }

  function handleRemoveLegacyKey() {
    removeLegacyAIConfig(window.localStorage);
    setHasLegacyKey(hasAIKey());
    setMigrationNote("");
    onSaved?.();
  }

  return (
    <div style={{ padding: "32px 40px", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.01em" }}>
          Settings
        </div>
        <button className="btn-ghost" type="button" onClick={onClose}>Close</button>
      </div>

      {migrationNote && (
        <div
          style={{
            fontSize: 13, color: "var(--green-2)", lineHeight: 1.6, marginBottom: 16,
            padding: "12px 14px", borderRadius: "var(--r-md)",
            border: "1px solid var(--green-ring)", background: "var(--green-dim)",
          }}
        >
          {migrationNote}
        </div>
      )}

      {/* NOT gated on hasBridge — the web build is the case that needs it. */}
      {legacyControl.show && (
        <div
          className="glass"
          style={{
            padding: "14px 16px", marginBottom: 16, borderRadius: "var(--r-md)",
            border: "1px solid var(--red-ring)", background: "var(--red-dim)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 6 }}>
            {legacyControl.title}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.6, marginBottom: 10 }}>
            {legacyControl.body}
          </div>
          <button className="btn-ghost" type="button" onClick={handleRemoveLegacyKey}>
            {legacyControl.action}
          </button>
        </div>
      )}

      <EndpointsPanel
        disabledIds={disabledIds}
        onDisabledIdsChange={handleDisabledIdsChange}
      />

      {/* Not gated on hasBridge: the panel explains the web build's situation
          itself, and a silently absent Updates section is how a cohort ends up
          stranded on the version with the bug. */}
      <UpdatesPanel />

      {!hasBridge && (
        <div
          className="glass"
          style={{ padding: 24, marginTop: 20, fontSize: 13, color: "var(--text-3)", lineHeight: 1.6 }}
        >
          You are running the web build without the desktop app shell. AI
          endpoints are stored by the desktop app, which keeps your API key out
          of this page entirely — so AI features are unavailable here. Every
          tool still works offline; the Cover Letter Builder assembles a full
          draft without any AI.
        </div>
      )}
    </div>
  );
}
