// test/intro-tour-ui.test.js
//
// IntroTour walks TOUR_STEPS with a spotlight-style highlight. happy-dom
// (the harness in test/helpers/render.mjs) lays nothing out, so every test
// here injects geometry via the `measure` prop rather than asserting real
// pixels -- the same pattern test/spotlight-ui.test.js uses for
// SpotlightOverlay.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import IntroTour from "../components/guide/IntroTour.js";
import { TOUR_STEPS } from "../lib/guide/tour.js";
import { render } from "./helpers/render.mjs";

const RECT = { top: 20, left: 30, width: 120, height: 50 };
const measureStub = () => RECT;

describe("IntroTour: inactive", () => {
  test("renders null when inactive", async () => {
    const h = await render(<IntroTour active={false} onFinish={() => {}} measure={measureStub} />);
    assert.equal(h.container.innerHTML, "");
    await h.unmount();
  });
});

describe("IntroTour: walking the steps", () => {
  test("shows step 1 when active", async () => {
    const h = await render(<IntroTour active={true} onFinish={() => {}} measure={measureStub} />);
    assert.ok(h.text().includes(TOUR_STEPS[0].title));
    assert.ok(h.text().includes(TOUR_STEPS[0].body));
    assert.ok(h.text().includes(`1/${TOUR_STEPS.length}`));
    await h.unmount();
  });

  test("Next advances to step 2", async () => {
    const h = await render(<IntroTour active={true} onFinish={() => {}} measure={measureStub} />);
    await h.click(h.button("Next"));
    assert.ok(h.text().includes(TOUR_STEPS[1].title));
    assert.ok(h.text().includes(`2/${TOUR_STEPS.length}`));
    await h.unmount();
  });

  test("Back returns to the previous step", async () => {
    const h = await render(<IntroTour active={true} onFinish={() => {}} measure={measureStub} />);
    await h.click(h.button("Next"));
    await h.click(h.button("Back"));
    assert.ok(h.text().includes(TOUR_STEPS[0].title));
    await h.unmount();
  });

  test("Back is disabled on the first step", async () => {
    const h = await render(<IntroTour active={true} onFinish={() => {}} measure={measureStub} />);
    assert.equal(h.button("Back").disabled, true);
    await h.unmount();
  });

  test("renders the ring at the injected rect for a step with a live anchor", async () => {
    await render(<div />); // ensures happy-dom is installed before we touch `document`
    document.body.insertAdjacentHTML("beforeend", '<div data-guide-target="sheet-grid"></div>');

    const h = await render(<IntroTour active={true} onFinish={() => {}} measure={measureStub} />);
    await h.click(h.button("Next")); // step 2 anchors on "sheet-grid"

    const ring = h.find('[data-testid="intro-tour-ring"]');
    assert.ok(ring, "expected a ring for an anchored step");
    assert.equal(ring.style.top, `${RECT.top}px`);
    assert.equal(ring.style.left, `${RECT.left}px`);
    assert.equal(ring.style.width, `${RECT.width}px`);
    assert.equal(ring.style.height, `${RECT.height}px`);
    await h.unmount();
  });

  test("omits the ring for an anchorless step", async () => {
    const h = await render(<IntroTour active={true} onFinish={() => {}} measure={measureStub} />);
    // step 1 ("welcome") has no anchor
    assert.equal(h.find('[data-testid="intro-tour-ring"]'), null);
    await h.unmount();
  });
});

describe("IntroTour: finishing", () => {
  test("calls onFinish exactly once after Done on the last step", async () => {
    let calls = 0;
    const h = await render(
      <IntroTour active={true} onFinish={() => { calls += 1; }} measure={measureStub} />
    );
    for (let i = 0; i < TOUR_STEPS.length - 1; i++) {
      await h.click(h.button("Next"));
    }
    assert.equal(calls, 0);
    assert.ok(h.text().includes(TOUR_STEPS[TOUR_STEPS.length - 1].title));

    await h.click(h.button("Done"));
    assert.equal(calls, 1);
    await h.unmount();
  });

  test("Skip calls onFinish immediately, from the first step", async () => {
    let calls = 0;
    const h = await render(
      <IntroTour active={true} onFinish={() => { calls += 1; }} measure={measureStub} />
    );
    await h.click(h.button("Skip"));
    assert.equal(calls, 1);
    await h.unmount();
  });
});
