/**
 * test/settings-ui.test.js
 * Coverage for the settings key-control surface: components/Settings.js,
 * components/settings/EndpointsPanel.js and components/settings/endpoints-ui.js.
 *
 * WHAT THIS FILE IS FOR: in a bring-your-own-key app the user must be able to
 * (a) turn an endpoint off and have it actually be off, and (b) get their key
 * back out of the app on every build. Both are security controls, not niceties,
 * so both are asserted end-to-end against the REAL registry and the REAL call
 * path picker rather than against a mock of the thing under test.
 *
 * Uses Node built-in test runner: `node --test test/settings-ui.test.js`
 */

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  LEGACY_AI_CONFIG_KEY,
  describeLegacyKeyControl,
  describeOffSwitch,
  removeLegacyAIConfig,
  turnEndpointOff,
} from "../components/settings/endpoints-ui.js";
import { createRegistry } from "../lib/endpoints/registry.js";
import { pickDefaultEndpointId } from "../lib/ai/client.js";
import { hasAIKey, setAIConfig } from "../lib/ai/config.js";

/**
 * Read a repo source file as text — the only way to assert on JSX modules,
 * which node has no loader for. Comments are stripped: these tests assert on
 * what the code DOES, not on what it says about itself.
 */
function source(relPath) {
  return readFileSync(new URL(`../${relPath}`, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function installStorage() {
  const m = new Map();
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

/** A real registry over memory, plus the async port shape window.coop.endpoints has. */
function makeApi() {
  let rows = [];
  let n = 0;
  const registry = createRegistry({
    storage: { read: () => rows, write: (next) => { rows = next; } },
    now: () => "2026-07-15T00:00:00.000Z",
    uuid: () => `ep${++n}`,
  });
  const api = {
    list: async () => registry.list(),
    update: async (id, patch) => registry.update(id, patch),
    delete: async (id) => registry.remove(id),
  };
  return { registry, api };
}

/* ────────────────────────────────────────────────────────────────────────────
 * FINDING 8 — the off switch must be honoured by the code that spends money.
 *
 * The bug: "off" was written to a localStorage list that no AI call site reads,
 * so a user who turned an endpoint off kept being billed for it. Enabled state
 * has no registry field and no IPC channel (grep: `enabled` appears nowhere in
 * lib/ or electron/), so a UI preference list CANNOT be the enforcement. The
 * only "off" the call path honours is the registry itself: no key, no billable
 * call. These tests pin the enforcement to the registry.
 * ──────────────────────────────────────────────────────────────────────────── */

describe("turning an endpoint off", () => {
  test("clears the stored key, so the endpoint cannot authenticate or be billed", async () => {
    const { registry, api } = makeApi();
    registry.add({ label: "OpenAI", baseUrl: "https://api.openai.com/v1", apiKey: "sk-live-123" });

    const [before] = await api.list();
    assert.equal(before.hasKey, true);

    const result = await turnEndpointOff(api, before);
    assert.equal(result.ok, true);

    // The key is gone from the registry — the ONLY place a call could get one.
    assert.equal(registry.resolve(before.id).apiKey, "");
    const [after] = await api.list();
    assert.equal(after.hasKey, false);
  });

  test("takes the endpoint out of what the call path prefers", async () => {
    const { registry, api } = makeApi();
    registry.add({ label: "OpenAI", baseUrl: "https://api.openai.com/v1", apiKey: "sk-live-123" });
    registry.add({ label: "Anthropic", baseUrl: "https://api.anthropic.com/v1", apiKey: "sk-ant-9" });

    const [first, second] = await api.list();
    assert.equal(pickDefaultEndpointId(await api.list()), first.id);

    await turnEndpointOff(api, first);

    // The tools' default now lands on the endpoint that is still switched on.
    assert.equal(pickDefaultEndpointId(await api.list()), second.id);
  });

  test("does not depend on the disabled-id list being remembered", async () => {
    // The list is a UI echo. If it were lost, "off" must still be off — which
    // is only true because the enforcement is the registry write above.
    const { registry, api } = makeApi();
    registry.add({ label: "OpenAI", baseUrl: "https://api.openai.com/v1", apiKey: "sk-live-123" });
    const [view] = await api.list();

    await turnEndpointOff(api, view); // no disabledIds passed in, by design

    assert.equal(registry.resolve(view.id).apiKey, "");
  });

  test("reports a registry failure instead of pretending the key is gone", async () => {
    const api = { update: async () => ({ ok: false, error: { message: "nope" } }) };
    const result = await turnEndpointOff(api, { id: "x", hasKey: true, baseUrl: "https://a.co/v1" });
    assert.equal(result.ok, false);
  });
});

describe("describeOffSwitch", () => {
  const remote = { id: "a", label: "OpenAI", baseUrl: "https://api.openai.com/v1", hasKey: true };

  test("a keyed remote endpoint reads as on", () => {
    const state = describeOffSwitch(remote, []);
    assert.equal(state.kind, "switch");
    assert.equal(state.on, true);
  });

  test("an endpoint the user switched off reads as off", () => {
    const off = describeOffSwitch({ ...remote, hasKey: false }, ["a"]);
    assert.equal(off.on, false);
    assert.match(off.text, /off/i);
  });

  test("off state is derived from the registry, not from the id list alone", () => {
    // A stale disabled id must not claim a still-keyed endpoint is off: the key
    // is what a call uses, so the key is what the switch reports.
    const state = describeOffSwitch(remote, ["a"]);
    assert.equal(state.on, true);
  });

  test("a local endpoint gets no switch, because clearing a key would not turn it off", () => {
    const local = { id: "b", label: "Ollama", baseUrl: "http://localhost:11434/v1", hasKey: false };
    const state = describeOffSwitch(local, []);
    assert.equal(state.kind, "none");
    assert.match(state.text, /local/i);
  });
});

describe("the endpoints panel wires the switch to the registry", () => {
  test("the off control performs a registry write, not a localStorage write", () => {
    const src = source("components/settings/EndpointsPanel.js");
    assert.ok(
      /turnEndpointOff\(/.test(src),
      "the off switch must call turnEndpointOff — a UI preference list is not an off switch"
    );
  });

  test("a switched-off endpoint is not nagged about its missing key", () => {
    const src = source("components/settings/EndpointsPanel.js");
    assert.ok(
      /keyless[\s\S]{0,400}isEndpointEnabled\(/.test(src),
      "the 'will fail with 401' banner must skip endpoints the user deliberately turned off"
    );
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * FINDING 9 — a stored key must be removable on every path.
 *
 * The bug: "Clear key" was deleted, and the legacy-key migration meant to
 * subsume it is gated behind `if (!hasBridge) return`. In the web build a
 * pre-existing plaintext coop_ai_v1 key therefore sat in localStorage forever
 * with no UI to remove it. "Remove" means different things per build: with the
 * desktop shell the key lives in the main-process registry (switch it off /
 * delete it); on the web there is no registry, so deleting the legacy
 * localStorage blob IS the removal.
 * ──────────────────────────────────────────────────────────────────────────── */

describe("removing the legacy plaintext key", () => {
  beforeEach(() => {
    installStorage();
  });

  test("removeLegacyAIConfig takes the key out of storage for good", () => {
    setAIConfig({ apiKey: "sk-legacy-plaintext" });
    assert.equal(hasAIKey(), true);

    assert.equal(removeLegacyAIConfig(globalThis.localStorage), true);

    assert.equal(hasAIKey(), false);
    // The whole blob goes, not just the key field: nothing is left to read.
    assert.equal(globalThis.localStorage.getItem(LEGACY_AI_CONFIG_KEY), null);
  });

  test("reports false when there was nothing to remove", () => {
    assert.equal(removeLegacyAIConfig(globalThis.localStorage), false);
  });

  test("survives a storage that throws", () => {
    const hostile = {
      getItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    assert.equal(removeLegacyAIConfig(hostile), false);
    assert.equal(removeLegacyAIConfig(null), false);
  });
});

describe("describeLegacyKeyControl", () => {
  test("the web build, with no bridge, still offers a way to remove the key", () => {
    const control = describeLegacyKeyControl({ hasBridge: false, hasLegacyKey: true });
    assert.equal(control.show, true);
    assert.match(control.action, /remove/i);
  });

  test("a key still present under the bridge (migration failed) is still removable", () => {
    const control = describeLegacyKeyControl({ hasBridge: true, hasLegacyKey: true });
    assert.equal(control.show, true);
    assert.match(control.action, /remove/i);
  });

  test("no key, no control", () => {
    assert.equal(describeLegacyKeyControl({ hasBridge: false, hasLegacyKey: false }).show, false);
    assert.equal(describeLegacyKeyControl({ hasBridge: true, hasLegacyKey: false }).show, false);
    assert.equal(describeLegacyKeyControl({}).show, false);
  });

  test("says the truth about where the key is going", () => {
    const web = describeLegacyKeyControl({ hasBridge: false, hasLegacyKey: true });
    assert.match(web.body, /browser|this page|localStorage/i);
  });
});

describe("the settings view can always remove a stored key", () => {
  test("the removal path is not gated behind the desktop bridge", () => {
    const src = source("components/Settings.js");
    assert.ok(/removeLegacyAIConfig\(/.test(src), "Settings must offer a real removal action");
    assert.ok(/hasAIKey\(/.test(src), "Settings must detect a stranded legacy key");
    // The bridge-only early return may only guard the migration, never the
    // removal control — the web build has no bridge and still has the key.
    const guarded = src.slice(src.indexOf("if (!hasBridge) return"));
    const controlAt = src.indexOf("removeLegacyAIConfig(");
    assert.ok(
      controlAt !== -1 && !/if \(!hasBridge\) return;[^}]*removeLegacyAIConfig\(/.test(guarded),
      "the key-removal action must not sit behind `if (!hasBridge) return`"
    );
  });

  test("removal does not resurrect a key-writing path", () => {
    // Keeps test/ai.test.js's invariant true from this side too.
    const src = source("components/Settings.js");
    assert.ok(!/setAIConfig/.test(src), "Settings must not write the legacy key store");
  });
});
