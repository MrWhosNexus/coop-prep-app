// test/games-guided-ui.test.js
// GameHost's guided layer: data-guide-target anchors for the spotlight
// overlay (a different track), an optional objective banner, and auto-advance
// on a correct answer. All three are additive props with safe defaults, so
// this file also pins that plain existing usage (no guided props at all)
// keeps rendering exactly as before.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import GameHost from "../components/games/GameHost.js";
import { render } from "./helpers/render.mjs";

/** No em-dash anywhere in a string this file authored. */
function assertNoEmDash(s, label) {
  assert.ok(!/—/.test(s), `${label} must not contain an em-dash: ${JSON.stringify(s)}`);
}

async function mount(t, element) {
  const ui = await render(element);
  t.after(() => ui.unmount());
  return ui;
}

const ANCHORS = ["game-prompt", "game-choices", "game-submit", "game-score"];

describe("GameHost guided layer", () => {
  test("the four data-guide-target anchors are present on the chrome", async (t) => {
    const ui = await mount(t, (
      <GameHost title="Recall Drill" index={0} total={3} events={[]}>
        <div>body</div>
      </GameHost>
    ));
    for (const anchor of ANCHORS) {
      assert.ok(
        ui.find(`[data-guide-target="${anchor}"]`),
        `expected a node with data-guide-target="${anchor}"`,
      );
    }
  });

  test("plain existing usage (no guided props) renders unchanged", async (t) => {
    const ui = await mount(t, (
      <GameHost title="Match" index={1} total={4} events={[{ correct: true }]}>
        <div>the game's own content</div>
      </GameHost>
    ));
    assert.match(ui.text(), /Match/);
    assert.match(ui.text(), /the game's own content/);
    // No objective was passed, so no banner.
    assert.equal(ui.find(".g-objective"), null, "no objective prop means no banner");
  });

  test("the objective banner shows when `objective` is set", async (t) => {
    const objective = "Match each term to its definition before the clock runs out";
    assertNoEmDash(objective, "objective fixture");
    const ui = await mount(t, (
      <GameHost title="Match" index={0} total={4} events={[]} objective={objective}>
        <div>body</div>
      </GameHost>
    ));
    const banner = ui.find(".g-objective");
    assert.ok(banner, "objective banner should render when objective is set");
    assert.match(ui.text(), new RegExp(objective));
  });

  test("the objective banner is absent when `objective` is not set", async (t) => {
    const ui = await mount(t, (
      <GameHost title="Match" index={0} total={4} events={[]}>
        <div>body</div>
      </GameHost>
    ));
    assert.equal(ui.find(".g-objective"), null);
  });

  test("guided mode auto-advances on a new correct event, without a manual button", async (t) => {
    let advanced = null;
    const ui = await mount(t, (
      <GameHost
        title="Rapid Fire"
        index={0}
        total={5}
        events={[]}
        guided
        onAdvance={(e) => { advanced = e; }}
      >
        <div>body</div>
      </GameHost>
    ));

    assert.equal(advanced, null, "no event yet, nothing should have advanced");

    await ui.rerender(
      <GameHost
        title="Rapid Fire"
        index={0}
        total={5}
        events={[{ correct: true, ms: 900 }]}
        guided
        onAdvance={(e) => { advanced = e; }}
      >
        <div>body</div>
      </GameHost>,
    );
    await ui.flush();

    assert.ok(advanced, "a new correct event in guided mode should call onAdvance");
    assert.equal(advanced.correct, true);
  });

  test("guided mode does NOT advance on a new wrong event", async (t) => {
    let calls = 0;
    const ui = await mount(t, (
      <GameHost title="Rapid Fire" index={0} total={5} events={[]} guided onAdvance={() => { calls++; }}>
        <div>body</div>
      </GameHost>
    ));

    await ui.rerender(
      <GameHost title="Rapid Fire" index={0} total={5} events={[{ correct: false }]} guided onAdvance={() => { calls++; }}>
        <div>body</div>
      </GameHost>,
    );
    await ui.flush();

    assert.equal(calls, 0, "a wrong event must not trigger auto-advance");
  });

  test("non-guided mode never calls onAdvance, even on a correct event", async (t) => {
    let calls = 0;
    const ui = await mount(t, (
      <GameHost title="Rapid Fire" index={0} total={5} events={[]} onAdvance={() => { calls++; }}>
        <div>body</div>
      </GameHost>
    ));

    await ui.rerender(
      <GameHost title="Rapid Fire" index={0} total={5} events={[{ correct: true }]} onAdvance={() => { calls++; }}>
        <div>body</div>
      </GameHost>,
    );
    await ui.flush();

    assert.equal(calls, 0, "onAdvance is guided-mode-only, absent `guided` it must never fire");
  });

  test("guided mode with no onAdvance does not throw", async (t) => {
    const ui = await mount(t, (
      <GameHost title="Rapid Fire" index={0} total={5} events={[]} guided>
        <div>body</div>
      </GameHost>
    ));
    await ui.rerender(
      <GameHost title="Rapid Fire" index={0} total={5} events={[{ correct: true }]} guided>
        <div>body</div>
      </GameHost>,
    );
    await ui.flush();
    assert.ok(true, "should not throw when onAdvance is absent");
  });
});
