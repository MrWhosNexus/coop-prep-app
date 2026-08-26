// test/spotlight-ui.test.js
//
// SpotlightOverlay renders a fixed dim layer with a cutout around a resolved
// target node, plus a callout box naming the step. happy-dom (the harness in
// test/helpers/render.mjs) lays nothing out -- offsetWidth/getBoundingClientRect
// are always 0 -- so every test here injects geometry via the `measure` /
// `resolveRect` props rather than asserting real pixels. See guide.css and
// SpotlightOverlay.js for the "why": the component takes injectable geometry
// specifically so this file can exercise it under a layout-less DOM.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import SpotlightOverlay from "../components/guide/SpotlightOverlay.js";
import { render } from "./helpers/render.mjs";

const RECT = { top: 100, left: 50, width: 200, height: 40 };
const measureStub = () => RECT;

describe("SpotlightOverlay: hidden states", () => {
  test("renders null when inactive", async () => {
    const h = await render(
      <SpotlightOverlay
        target={{ kind: "selector", selector: "#anything" }}
        label="Pick a column"
        instruction="Drag Race onto Rows."
        active={false}
        measure={measureStub}
      />
    );
    assert.equal(h.container.innerHTML, "");
    await h.unmount();
  });

  test("renders null when there is no target", async () => {
    const h = await render(
      <SpotlightOverlay
        target={null}
        label="Pick a column"
        instruction="Drag Race onto Rows."
        active={true}
        measure={measureStub}
      />
    );
    assert.equal(h.container.innerHTML, "");
    await h.unmount();
  });

  test("renders null when active but the target selector matches nothing", async () => {
    const h = await render(
      <SpotlightOverlay
        target={{ kind: "selector", selector: "#nowhere-to-be-found" }}
        label="Pick a column"
        instruction="Drag Race onto Rows."
        active={true}
        measure={measureStub}
      />
    );
    assert.equal(h.find('[data-testid="spotlight-overlay"]'), null);
    await h.unmount();
  });
});

describe("SpotlightOverlay: active with a selector target", () => {
  test("renders the label and instruction text", async () => {
    await render(<div />); // ensures happy-dom is installed before we touch `document`
    document.body.insertAdjacentHTML("beforeend", '<div id="target-node"></div>');

    const h = await render(
      <SpotlightOverlay
        target={{ kind: "selector", selector: "#target-node" }}
        label="Put Race on Rows"
        instruction="Drag the Race field from the field list onto the Rows shelf."
        active={true}
        measure={measureStub}
      />
    );

    assert.ok(h.text().includes("Put Race on Rows"));
    assert.ok(h.text().includes("Drag the Race field from the field list onto the Rows shelf."));
    await h.unmount();
  });

  test("positions the cutout ring from the injected rect", async () => {
    await render(<div />);
    document.body.insertAdjacentHTML("beforeend", '<div id="target-node-2"></div>');

    const h = await render(
      <SpotlightOverlay
        target={{ kind: "selector", selector: "#target-node-2" }}
        label="Put Race on Rows"
        instruction="Drag it over."
        active={true}
        measure={measureStub}
      />
    );

    const ring = h.find('[data-testid="spotlight-ring"]');
    assert.ok(ring, "expected a spotlight ring node");
    // pad = 6, applied symmetrically around the injected rect.
    assert.equal(ring.style.top, `${RECT.top - 6}px`);
    assert.equal(ring.style.left, `${RECT.left - 6}px`);
    assert.equal(ring.style.width, `${RECT.width + 12}px`);
    assert.equal(ring.style.height, `${RECT.height + 12}px`);
    await h.unmount();
  });

  test("resolves a region target via its data-guide-target anchor", async () => {
    await render(<div />);
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div data-guide-target="columns-shelf"></div>'
    );

    const h = await render(
      <SpotlightOverlay
        target={{ kind: "region", anchor: "columns-shelf" }}
        label="Columns shelf"
        instruction="This is where column encodings live."
        active={true}
        measure={measureStub}
      />
    );

    assert.ok(h.text().includes("Columns shelf"));
    assert.ok(h.find('[data-testid="spotlight-ring"]'));
    await h.unmount();
  });
});

describe("SpotlightOverlay: sheet-cell targets", () => {
  test("hides when resolveRect returns null", async () => {
    const h = await render(
      <SpotlightOverlay
        target={{ kind: "sheet-cell", ref: "H2", sheet: "Applicants" }}
        label="Fill H2"
        instruction="Type the VLOOKUP formula in H2."
        active={true}
        resolveRect={() => null}
      />
    );
    assert.equal(h.find('[data-testid="spotlight-overlay"]'), null);
    await h.unmount();
  });

  test("hides when no resolveRect prop is provided at all", async () => {
    const h = await render(
      <SpotlightOverlay
        target={{ kind: "sheet-cell", ref: "H2", sheet: "Applicants" }}
        label="Fill H2"
        instruction="Type the VLOOKUP formula in H2."
        active={true}
      />
    );
    assert.equal(h.find('[data-testid="spotlight-overlay"]'), null);
    await h.unmount();
  });

  test("renders using the rect returned from resolveRect", async () => {
    const h = await render(
      <SpotlightOverlay
        target={{ kind: "sheet-cell", ref: "H2", sheet: "Applicants" }}
        label="Fill H2"
        instruction="Type the VLOOKUP formula in H2."
        active={true}
        resolveRect={(ref, sheet) => {
          assert.equal(ref, "H2");
          assert.equal(sheet, "Applicants");
          return RECT;
        }}
      />
    );
    assert.ok(h.text().includes("Fill H2"));
    const ring = h.find('[data-testid="spotlight-ring"]');
    assert.ok(ring);
    assert.equal(ring.style.top, `${RECT.top - 6}px`);
    await h.unmount();
  });
});

describe("SpotlightOverlay: dismiss", () => {
  test("clicking dismiss invokes onDismiss", async () => {
    await render(<div />);
    document.body.insertAdjacentHTML("beforeend", '<div id="target-node-3"></div>');
    let dismissed = false;

    const h = await render(
      <SpotlightOverlay
        target={{ kind: "selector", selector: "#target-node-3" }}
        label="Put Race on Rows"
        instruction="Drag it over."
        active={true}
        measure={measureStub}
        onDismiss={() => { dismissed = true; }}
      />
    );

    await h.click('[aria-label="Dismiss"]');
    assert.equal(dismissed, true);
    await h.unmount();
  });

  test("omits the dismiss control when onDismiss is not provided", async () => {
    await render(<div />);
    document.body.insertAdjacentHTML("beforeend", '<div id="target-node-4"></div>');

    const h = await render(
      <SpotlightOverlay
        target={{ kind: "selector", selector: "#target-node-4" }}
        label="Put Race on Rows"
        instruction="Drag it over."
        active={true}
        measure={measureStub}
      />
    );
    assert.equal(h.find('[aria-label="Dismiss"]'), null);
    await h.unmount();
  });
});
