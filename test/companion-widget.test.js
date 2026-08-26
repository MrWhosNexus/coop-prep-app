// test/companion-widget.test.js
//
// CompanionWidget, driven under happy-dom with an injected fake provider and a
// fake window.coop bridge. The harness has no pointer events (see
// render.mjs's limits), so the PTT *hold* is tested at the provider level
// (companion-provider.test.js). Here we cover the UI wiring the click harness
// CAN reach: the honest degrade, opening the panel, the runtime picker gating,
// and — the security-relevant half — that switching runtime releases the PTT
// hold (setPushToTalk(false)).

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import CompanionWidget from "../components/voice/companion/CompanionWidget.js";
import { render } from "./helpers/render.mjs";

/** A fake provider capturing every seam call the widget makes. */
function makeFakeProvider() {
  const calls = { setRuntime: [], setPushToTalk: [], setMicMuted: [], setWakeWordEnabled: [], setEndpointTarget: [], connected: 0, disconnected: 0 };
  const provider = {
    calls,
    connect: async () => {
      calls.connected++;
    },
    disconnect: () => {
      calls.disconnected++;
    },
    sendText: () => {},
    setRuntime: (rt) => calls.setRuntime.push(rt),
    setPushToTalk: (d) => calls.setPushToTalk.push(d),
    setMicMuted: (m) => calls.setMicMuted.push(m),
    setWakeWordEnabled: (w) => calls.setWakeWordEnabled.push(w),
    setEndpointTarget: (t) => calls.setEndpointTarget.push(t),
  };
  return provider;
}

/** A window.coop stand-in with local voice present (so the widget is enabled). */
function makeBridge({ hermesState = "ready" } = {}) {
  return {
    voice: { transcribe: async () => ({ ok: true, text: "" }), speak: async () => ({ requestId: "s", started: true }), onSpeakStream: () => () => {}, cancel: async () => {} },
    hermes: { status: async () => ({ state: hermesState }), run: async () => ({}), onStream: () => () => {} },
    hub: { load: async () => ({ ok: true, items: [] }), save: async () => ({ ok: true }) },
    endpoints: { list: async () => [], models: async () => [] },
  };
}

describe("CompanionWidget: honest degrade", () => {
  test("with no voice bridge it shows the desktop-app pill and mounts no provider", async () => {
    let made = 0;
    const h = await render(
      <CompanionWidget
        context={{}}
        aiOn={true}
        bridge={{}}
        makeProvider={() => {
          made++;
          return makeFakeProvider();
        }}
      />,
    );
    await h.flush();
    assert.ok(h.find('[data-testid="nexus-voice-disabled"]'), "expected the disabled pill");
    assert.equal(made, 0, "no provider is built when voice is unavailable");
    await h.unmount();
  });
});

describe("CompanionWidget: opening + runtime picker", () => {
  test("clicking the pill opens the panel and connects a provider", async () => {
    const provider = makeFakeProvider();
    const h = await render(
      <CompanionWidget context={{}} aiOn={true} bridge={makeBridge()} makeProvider={() => provider} />,
    );
    await h.flush();
    assert.equal(provider.calls.connected, 1, "the provider connected on mount");

    await h.click(h.find('[aria-label="Open Nexus companion"]'));
    assert.ok(h.find('[data-testid="companion-panel"]'), "the panel opened");
    // The endpoint runtime button is always present.
    assert.ok(
      h.findAll("button").some((b) => b.textContent.trim() === "nexus"),
      "the nexus runtime button is shown",
    );

    await h.unmount();
  });

  test("the hermes button is hidden when the CLI is not installed", async () => {
    const provider = makeFakeProvider();
    const h = await render(
      <CompanionWidget
        context={{}}
        aiOn={true}
        bridge={makeBridge({ hermesState: "not-installed" })}
        makeProvider={() => provider}
      />,
    );
    await h.flush();
    await h.click(h.find('[aria-label="Open Nexus companion"]'));
    await h.flush();
    assert.equal(
      h.findAll("button").some((b) => b.textContent.trim() === "hermes"),
      false,
      "hermes must not be offered when it is not installed",
    );
    await h.unmount();
  });

  test("switching to hermes releases the PTT hold and shows the hold-to-talk control", async () => {
    const provider = makeFakeProvider();
    const h = await render(
      <CompanionWidget context={{}} aiOn={true} bridge={makeBridge()} makeProvider={() => provider} />,
    );
    await h.flush();
    await h.click(h.find('[aria-label="Open Nexus companion"]'));
    await h.flush(); // let hermes.status() resolve → the button renders

    const hermesBtn = h.findAll("button").find((b) => b.textContent.trim() === "hermes");
    assert.ok(hermesBtn, "the hermes runtime button should be shown when installed");
    await h.click(hermesBtn);

    assert.ok(provider.calls.setRuntime.includes("hermes"), "the provider was told to switch to hermes");
    assert.ok(
      provider.calls.setPushToTalk.includes(false),
      "switching runtime releases the PTT gate (setPushToTalk(false))",
    );
    assert.ok(h.find('[data-testid="companion-ptt"]'), "the hold-to-talk control appears for hermes");

    await h.unmount();
  });
});
