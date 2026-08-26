"use client";

// components/settings/EndpointsPanel.js
// AI endpoint settings: a LOCAL section, an API section, and the added-endpoint
// list. Ported from Nexus's AddModelsPanel onto lib/endpoints/.
//
// ────────────────────────────────────────────────────────────────────────────
// THE INVARIANT THIS FILE IS BUILT AROUND
//
// The renderer never receives an apiKey. `api.list()` returns EndpointViews,
// which carry `hasKey: boolean` and structurally cannot carry the key itself.
// So:
//   - A key is WRITE-ONLY here. It is typed into a form field, read once inside
//     the submit handler, sent over IPC, and the field is cleared. It is never
//     put into a state atom that outlives the submit, never logged, never round
//     -tripped back from the main process.
//   - An existing endpoint's key renders as "••••••••••• (saved)" because that
//     is genuinely all this process knows about it.
//   - THERE IS NO ENV-VAR FALLBACK, and there must never be one. Nexus shipped a
//     real bug where one surface read process.env.MINIMAX_API_KEY while every
//     other surface used the registry: the env value silently shadowed a
//     perfectly good configured endpoint and produced 401s that were nearly
//     undebuggable, because the panel showed a valid key and the request used a
//     different one. Two key sources means the bad one wins silently. One
//     source: the registry. A keyless endpoint fails honestly with a message
//     that points back here.
// ────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import "./endpoints.css";
import ProviderPicker from "./ProviderPicker.js";
import ModelPicker from "./ModelPicker.js";
import {
  LOCAL_RUNTIMES,
  describeKeyState,
  describeOffSwitch,
  describeTestResult,
  isEndpointEnabled,
  isLocalUrl,
  pickerStateForUrl,
  seedUrlForProvider,
  turnEndpointOff,
  validateDraft,
} from "./endpoints-ui.js";

/** The default IPC-backed port. Every method returns key-free data. */
function defaultApi() {
  return typeof window !== "undefined" ? window.coop?.endpoints ?? null : null;
}

/**
 * @param {object} props
 * @param {object} [props.api]            - Endpoint port (see wiring notes). Injectable for tests/stories.
 * @param {string[]} [props.disabledIds]  - Ids the user switched off. A UI ECHO, not the off
 *   switch: the switch removes the key from the registry (see endpoints-ui.js
 *   #turnEndpointOff). This list only lets a card say "you turned this off"
 *   instead of nagging about a missing key. Losing it is cosmetic.
 * @param {(nextDisabledIds: string[]) => void} [props.onDisabledIdsChange]
 * @param {Date} [props.now]              - Injectable clock, for intro-price display.
 */
export default function EndpointsPanel({
  api: apiProp,
  disabledIds = [],
  onDisabledIdsChange,
  now,
}) {
  const api = apiProp ?? defaultApi();

  const [rows, setRows] = useState(null); // null = loading
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);

  // ── LOCAL section ──
  const [localOpen, setLocalOpen] = useState(true);
  const [localUrl, setLocalUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanHits, setScanHits] = useState(null);
  const [scanUnavailable, setScanUnavailable] = useState(false);

  // ── API section ──
  const [apiOpen, setApiOpen] = useState(true);
  const [apiUrl, setApiUrl] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  // ── draft key fields ──
  // These two are the ONLY places a key lives, and only until submit clears
  // them. Note there is no `apiKey` on `rows` to mirror them against — list()
  // cannot return one.
  const [localKey, setLocalKey] = useState("");
  const [apiKey, setApiKey] = useState("");

  // ── per-endpoint test/model state, keyed by endpoint id ──
  const [testState, setTestState] = useState({}); // id -> {tone, text, hint}
  const [modelState, setModelState] = useState({}); // id -> {loading, models, selected}
  const [rekeying, setRekeying] = useState({}); // id -> string (a fresh key being typed)

  const [message, setMessage] = useState(null); // {tone, text}

  const refresh = useCallback(async () => {
    if (!api) {
      setRows([]);
      setLoadError("Endpoint service unavailable — the app shell is not connected.");
      return;
    }
    try {
      const list = await api.list();
      setRows(Array.isArray(list) ? list : []);
      setLoadError("");
    } catch {
      setRows([]);
      setLoadError("Could not load endpoints.");
    }
  }, [api]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!api) {
        if (alive) {
          setRows([]);
          setLoadError("Endpoint service unavailable — the app shell is not connected.");
        }
        return;
      }
      try {
        const list = await api.list();
        if (alive) {
          setRows(Array.isArray(list) ? list : []);
          setLoadError("");
        }
      } catch {
        if (alive) {
          setRows([]);
          setLoadError("Could not load endpoints.");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [api]);

  const picker = useMemo(() => pickerStateForUrl(apiUrl), [apiUrl]);

  /* ───────────────────────── add ───────────────────────── */

  async function add(kind) {
    const isLocal = kind === "local";
    const url = isLocal ? localUrl : apiUrl;
    const key = isLocal ? localKey : apiKey;

    const validated = validateDraft({ baseUrl: url, apiKey: key });
    if (!validated.ok) {
      setMessage({ tone: "error", text: validated.message });
      return;
    }

    setBusy(true);
    try {
      // The key crosses the IPC boundary here and nowhere else. `validated.draft`
      // is a local const inside this handler — it is never set into state.
      const result = await api.add(validated.draft);
      if (result?.ok === false) {
        setMessage({ tone: "error", text: result.error?.message ?? "Could not add the endpoint." });
        return;
      }
      // Clear the key field the instant it has been handed off.
      if (isLocal) {
        setLocalUrl("");
        setLocalKey("");
      } else {
        setApiUrl("");
        setApiKey("");
      }
      setMessage({ tone: "ok", text: `Added ${validated.draft.label}.` });
      await refresh();
    } catch {
      setMessage({ tone: "error", text: "Could not add the endpoint." });
    } finally {
      setBusy(false);
    }
  }

  /* ───────────────────────── test ───────────────────────── */

  async function testExisting(endpoint) {
    setTestState((s) => ({ ...s, [endpoint.id]: { tone: "muted", text: "Testing…", hint: "" } }));
    setModelState((s) => ({ ...s, [endpoint.id]: { ...(s[endpoint.id] ?? {}), loading: true } }));
    try {
      const result = await api.test(endpoint.id);
      // describeTestResult surfaces the endpoint's REAL answer. A 401 says
      // "key rejected", never a laundered "couldn't connect" — the whole point
      // of the Test button is to send the user to the right field.
      setTestState((s) => ({ ...s, [endpoint.id]: describeTestResult(result) }));
      setModelState((s) => ({
        ...s,
        [endpoint.id]: {
          loading: false,
          models: result?.ok ? result.models ?? [] : [],
          selected: s[endpoint.id]?.selected ?? "",
        },
      }));
    } catch {
      setTestState((s) => ({
        ...s,
        [endpoint.id]: { tone: "error", text: "The test could not be run.", hint: "" },
      }));
      setModelState((s) => ({ ...s, [endpoint.id]: { ...(s[endpoint.id] ?? {}), loading: false } }));
    }
  }

  /* ───────────────────────── scan ───────────────────────── */

  async function scan() {
    if (typeof api?.scan !== "function") {
      // Degrade honestly rather than pretending: the quick-fill buttons below
      // still work, so the section keeps its value.
      setScanUnavailable(true);
      setMessage({
        tone: "error",
        text: "Port scanning is unavailable in this build — use a Quickstart button below.",
      });
      return;
    }
    setScanning(true);
    setScanHits(null);
    try {
      const result = await api.scan();
      const hits = result?.ok ? result.hits ?? [] : [];
      setScanHits(hits);
      setMessage({
        tone: hits.length ? "ok" : "muted",
        text: hits.length
          ? `Found ${hits.length} local server${hits.length === 1 ? "" : "s"}.`
          : "No local model servers answered on the usual ports.",
      });
    } catch {
      setScanHits([]);
      setMessage({ tone: "error", text: "The scan failed." });
    } finally {
      setScanning(false);
    }
  }

  /* ───────────────────────── mutate ───────────────────────── */

  async function remove(endpoint) {
    await api.delete(endpoint.id);
    // Drop the stale disabled-id so it cannot silently disable a future endpoint.
    if (onDisabledIdsChange && disabledIds.includes(endpoint.id)) {
      onDisabledIdsChange(disabledIds.filter((id) => id !== endpoint.id));
    }
    setMessage({ tone: "ok", text: `Removed ${endpoint.label}.` });
    await refresh();
  }

  /**
   * OFF means the key is removed from the registry — see endpoints-ui.js
   * #turnEndpointOff. The disabled-id list is updated only AFTER that write
   * succeeds, and only so the card can say "you turned this off"; it is never
   * what makes the endpoint off.
   */
  async function switchOff(endpoint) {
    setBusy(true);
    try {
      const result = await turnEndpointOff(api, endpoint);
      if (result?.ok === false) {
        setMessage({
          tone: "error",
          text: result.error?.message ?? `Could not turn off ${endpoint.label} — its key is still stored.`,
        });
        return;
      }
      if (onDisabledIdsChange && !disabledIds.includes(endpoint.id)) {
        onDisabledIdsChange([...disabledIds, endpoint.id]);
      }
      setMessage({
        tone: "ok",
        text: `${endpoint.label} is off — its stored key has been removed.`,
      });
      await refresh();
    } catch {
      setMessage({ tone: "error", text: `Could not turn off ${endpoint.label} — its key is still stored.` });
    } finally {
      setBusy(false);
    }
  }

  /** ON means a key, so this opens the key field rather than flipping a flag. */
  function switchOn(endpoint) {
    if (onDisabledIdsChange && disabledIds.includes(endpoint.id)) {
      onDisabledIdsChange(disabledIds.filter((id) => id !== endpoint.id));
    }
    setRekeying((s) => ({ ...s, [endpoint.id]: "" }));
    setMessage({ tone: "muted", text: `Add a key to turn ${endpoint.label} back on.` });
  }

  async function saveKey(endpoint) {
    const next = rekeying[endpoint.id] ?? "";
    setBusy(true);
    try {
      // Write-only: `next` goes out and the field is dropped. Nothing reads back.
      const result = await api.update(endpoint.id, { apiKey: next });
      if (result?.ok === false) {
        setMessage({ tone: "error", text: result.error?.message ?? "Could not save the key." });
        return;
      }
      setRekeying((s) => {
        const copy = { ...s };
        delete copy[endpoint.id];
        return copy;
      });
      setMessage({
        tone: "ok",
        text: next ? `Key saved for ${endpoint.label}.` : `Key cleared for ${endpoint.label}.`,
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  /* ───────────────────────── render ───────────────────────── */

  // An endpoint the user deliberately switched off is keyless ON PURPOSE — its
  // key was removed BY the off switch. Warning "this will fail with 401" about
  // it would nag the user for doing exactly what we asked them to do.
  const keyless = (rows ?? []).filter(
    (r) => !r.hasKey && !isLocalUrl(r.baseUrl) && isEndpointEnabled(disabledIds, r.id)
  );

  return (
    <div className="ep-panel">
      <header className="ep-panel-head">
        <h3>AI Endpoints</h3>
        <p className="ep-hint">
          Bring your own key. Keys are stored by the app shell and never sent anywhere except the
          endpoint you configure here.
        </p>
      </header>

      {/* A keyless remote endpoint is the failure this panel exists to prevent.
          Say it plainly and put the fix one click away, rather than letting the
          user discover it as a 401 in some other screen. */}
      {keyless.length > 0 && (
        <div className="ep-banner ep-banner-warn" role="status">
          <strong>
            {keyless.length === 1
              ? `${keyless[0].label} has no API key.`
              : `${keyless.length} endpoints have no API key.`}
          </strong>{" "}
          They will fail with 401 until you add one below. There is no environment-variable
          fallback — this panel is the only place keys come from.
        </div>
      )}

      {message && (
        <p className={`ep-message ep-message-${message.tone}`} role="status">
          {message.text}
        </p>
      )}

      {/* ─────────── LOCAL ─────────── */}
      <section className="ep-section">
        <button
          type="button"
          className="ep-section-head"
          aria-expanded={localOpen}
          onClick={() => setLocalOpen((v) => !v)}
        >
          <span className="ep-glyph" aria-hidden="true">⌂</span>
          <span className="ep-section-title">LOCAL</span>
          <span className={`ep-chevron${localOpen ? " open" : ""}`} aria-hidden="true">▾</span>
        </button>

        {localOpen && (
          <div className="ep-section-body">
            <p className="ep-hint">
              A model running on this machine. Usually needs no key.
            </p>

            <input
              className="ep-input"
              type="text"
              spellCheck={false}
              value={localUrl}
              placeholder="Paste endpoint URL, e.g. http://localhost:11434/v1"
              onChange={(e) => setLocalUrl(e.target.value)}
            />
            <input
              className="ep-input"
              type="password"
              autoComplete="off"
              value={localKey}
              placeholder="API key (optional — only for protected local endpoints)"
              onChange={(e) => setLocalKey(e.target.value)}
            />

            <div className="ep-actions">
              <button type="button" className="btn-primary" disabled={busy} onClick={() => add("local")}>
                Add
              </button>
            </div>

            <div className="ep-quickstart">
              <div className="ep-quickstart-head">
                <span className="section-label">Quickstart</span>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={scanning}
                  onClick={scan}
                >
                  {scanning ? "Scanning…" : "⌕ Scan for servers"}
                </button>
              </div>

              <div className="ep-runtimes">
                {LOCAL_RUNTIMES.map((runtime) => (
                  <button
                    type="button"
                    key={runtime.id}
                    className="btn-ghost ep-runtime"
                    onClick={() => setLocalUrl(runtime.baseUrl)}
                    title={runtime.baseUrl}
                  >
                    {runtime.label}
                    <span className="ep-port">:{runtime.port}</span>
                  </button>
                ))}
              </div>

              {scanUnavailable && (
                <p className="ep-hint">
                  Scanning needs the app shell. The buttons above fill the URL directly.
                </p>
              )}

              {scanHits?.map((hit) => (
                <div key={hit.url} className="ep-row ep-scan-hit">
                  <span className="ep-row-main">
                    <span className="ep-row-label">{hit.label}</span>
                    <span className="ep-hint ep-mono">
                      {hit.url}
                      {hit.models != null && ` · ${hit.models} models`}
                      {hit.latencyMs != null && ` · ${hit.latencyMs} ms`}
                    </span>
                  </span>
                  <button type="button" className="btn-ghost" onClick={() => setLocalUrl(hit.url)}>
                    Use
                  </button>
                </div>
              ))}

              {scanHits !== null && scanHits.length === 0 && !scanUnavailable && (
                <p className="ep-hint">No local model servers answered on the usual ports.</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ─────────── API ─────────── */}
      <section className="ep-section">
        <button
          type="button"
          className="ep-section-head"
          aria-expanded={apiOpen}
          onClick={() => setApiOpen((v) => !v)}
        >
          <span className="ep-glyph" aria-hidden="true">◍</span>
          <span className="ep-section-title">API</span>
          <span className={`ep-chevron${apiOpen ? " open" : ""}`} aria-hidden="true">▾</span>
        </button>

        {apiOpen && (
          <div className="ep-section-body">
            <div className="ep-url-row">
              <input
                className="ep-input"
                type="text"
                spellCheck={false}
                value={apiUrl}
                placeholder="Base URL, or pick a provider →"
                // No setProviderId here, deliberately. The provider shown is
                // DERIVED from this value (pickerStateForUrl), so editing the
                // URL away from a preset degrades the control to "Custom URL"
                // by itself. There is no second source of truth to keep in sync.
                onChange={(e) => setApiUrl(e.target.value)}
              />
              <ProviderPicker
                providerId={picker.providerId}
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                onPick={(id) => setApiUrl(seedUrlForProvider(id))}
              />
            </div>

            <input
              className="ep-input"
              type="password"
              autoComplete="off"
              value={apiKey}
              placeholder="API key"
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="ep-hint">
              {picker.isCustom
                ? "Any OpenAI- or Anthropic-compatible base URL works."
                : `Models will be discovered from ${picker.label} using your key.`}
            </p>

            <div className="ep-actions">
              <button type="button" className="btn-primary" disabled={busy} onClick={() => add("api")}>
                Add
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ─────────── Added endpoints ─────────── */}
      <section className="ep-section">
        <div className="ep-added-head">
          <span className="section-label">Added endpoints</span>
        </div>

        {loadError && <p className="ep-message ep-message-error">{loadError}</p>}
        {rows === null && <p className="ep-hint">Loading…</p>}
        {rows?.length === 0 && !loadError && <p className="ep-hint">None yet.</p>}

        {rows?.map((endpoint) => {
          const keyState = describeKeyState(endpoint);
          const off = describeOffSwitch(endpoint, disabledIds);
          // Keyless because the user switched it off, not because they never
          // finished setting it up. Only the id list can tell those apart.
          const turnedOff = !off.on && !isEndpointEnabled(disabledIds, endpoint.id);
          const test = testState[endpoint.id];
          const models = modelState[endpoint.id];
          const isRekeying = Object.hasOwn(rekeying, endpoint.id);

          return (
            <article key={endpoint.id} className={`ep-card${off.on ? "" : " off"}`}>
              <div className="ep-row">
                <span className="ep-row-main">
                  <span className="ep-row-label">{endpoint.label}</span>
                  <span className="ep-hint ep-mono">{endpoint.baseUrl}</span>
                </span>

                {/* A local endpoint gets no switch: it has no key to remove, so
                    a switch here could not enforce anything. Delete is its off. */}
                {off.kind === "switch" ? (
                  <button
                    type="button"
                    className={`ep-switch${off.on ? " on" : ""}`}
                    role="switch"
                    aria-checked={off.on}
                    aria-label={off.ariaLabel}
                    title={off.hint}
                    disabled={busy}
                    onClick={() => (off.on ? switchOff(endpoint) : switchOn(endpoint))}
                  />
                ) : (
                  <span className="ep-hint">{off.text}</span>
                )}
              </div>

              {/* The key is WRITE-ONLY. There is no value to show, so we show
                  its state instead — that is all list() can tell us. */}
              <div className="ep-row ep-key-row">
                <span className={`ep-key-state ep-tone-${turnedOff ? "muted" : keyState.tone}`}>
                  {turnedOff ? off.text : keyState.text}
                </span>
                {!isRekeying && (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setRekeying((s) => ({ ...s, [endpoint.id]: "" }))}
                  >
                    {keyState.hasKey ? "Replace key" : "Add key"}
                  </button>
                )}
              </div>

              {isRekeying && (
                <div className="ep-row ep-key-edit">
                  <input
                    className="ep-input"
                    type="password"
                    autoComplete="off"
                    autoFocus
                    value={rekeying[endpoint.id]}
                    placeholder={keyState.hasKey ? "New API key (replaces the saved one)" : "API key"}
                    onChange={(e) =>
                      setRekeying((s) => ({ ...s, [endpoint.id]: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy}
                    onClick={() => saveKey(endpoint)}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() =>
                      setRekeying((s) => {
                        const copy = { ...s };
                        delete copy[endpoint.id];
                        return copy;
                      })
                    }
                  >
                    Cancel
                  </button>
                </div>
              )}

              {test && (
                <p className={`ep-message ep-message-${test.tone === "ok" ? "ok" : test.tone === "error" ? "error" : "muted"}`}>
                  {test.text}
                  {test.hint && <span className="ep-hint"> {test.hint}</span>}
                </p>
              )}

              {(models?.models?.length > 0 || models?.loading) && (
                <ModelPicker
                  models={models?.models ?? []}
                  loading={!!models?.loading}
                  value={models?.selected ?? ""}
                  now={now}
                  onChange={(modelId) =>
                    setModelState((s) => ({
                      ...s,
                      [endpoint.id]: { ...(s[endpoint.id] ?? {}), selected: modelId },
                    }))
                  }
                />
              )}

              <div className="ep-actions">
                <button type="button" className="btn-ghost" onClick={() => testExisting(endpoint)}>
                  Test
                </button>
                <button type="button" className="btn-ghost ep-danger" onClick={() => remove(endpoint)}>
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
