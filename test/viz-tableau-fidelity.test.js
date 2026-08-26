// Track 4 fidelity pass: richer aggregations, grouped/stacked bars, diverging
// color, reference lines and sort-by-measure axis ordering. Additive tests
// only — see test/viz.test.js for the base engine contract this must not break.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { FieldType, FieldRole, makeField, inferFields, findField } from "../lib/viz/fields.js";

import {
  Aggregation,
  applyAggregation, availableAggregations, aggregateRows,
} from "../lib/viz/aggregate.js";

import { MarkType } from "../lib/viz/marks.js";

import {
  Shelf, createSpec, createEncoding, putOnShelf,
} from "../lib/viz/spec.js";

import { buildRenderPlan, DEFAULT_MARK_COLOR } from "../lib/viz/render-plan.js";

const dimField = (name) => makeField(name, FieldType.STRING, FieldRole.DIMENSION);
const measureField = (name) => makeField(name, FieldType.NUMBER, FieldRole.MEASURE);

// A tiny hand-checkable dataset — the numbers below are worked by hand in the
// assertions, so a wrong aggregation points straight at the maths.
const rows = [
  { region: "East", rep: "Ann", amount: 10 },
  { region: "East", rep: "Bob", amount: 20 },
  { region: "East", rep: "Cid", amount: 30 },
  { region: "East", rep: "Deb", amount: 40 },
  { region: "West", rep: "Ann", amount: 5 },
  { region: "West", rep: "Bob", amount: 15 },
];

const layout = { width: 400, height: 300, margin: { top: 20, right: 20, bottom: 40, left: 60 } };

// ===========================================================================
describe("aggregate: richer aggregations", () => {
  test("MEDIAN of an even count averages the two middle values", () => {
    assert.equal(applyAggregation(Aggregation.MEDIAN, [10, 20, 30, 40]), 25);
  });

  test("COUNTD counts distinct values, not rows", () => {
    assert.equal(applyAggregation(Aggregation.COUNTD, ["Ann", "Bob", "Ann", "Cid"]), 3);
  });

  test("MIN and MAX read straight off the numbers", () => {
    assert.equal(applyAggregation(Aggregation.MIN, [10, 20, 30, 40]), 10);
    assert.equal(applyAggregation(Aggregation.MAX, [10, 20, 30, 40]), 40);
  });

  test("PERCENTILE(0.5) matches MEDIAN", () => {
    const values = [10, 20, 30, 40];
    assert.equal(
      applyAggregation(Aggregation.PERCENTILE, values, { percentile: 0.5 }),
      applyAggregation(Aggregation.MEDIAN, values)
    );
  });

  test("PERCENTILE interpolates between ranks", () => {
    // Sorted [10,20,30,40], rank index for p=0.25 is 0.75*1=0.75 → between 10 and 20.
    const v = applyAggregation(Aggregation.PERCENTILE, [10, 20, 30, 40], { percentile: 0.25 });
    assert.equal(v, 17.5);
  });

  test("PERCENTILE defaults to the median when no percentile is given", () => {
    assert.equal(applyAggregation(Aggregation.PERCENTILE, [10, 20, 30, 40]), 25);
  });

  test("VARIANCE is the sample variance (N-1)", () => {
    // Mean 25, squared deviations 225+25+25+225=500, /(4-1) = 166.666...
    const v = applyAggregation(Aggregation.VARIANCE, [10, 20, 30, 40]);
    assert.ok(Math.abs(v - 500 / 3) < 1e-9);
  });

  test("STDEV is the square root of VARIANCE", () => {
    const values = [10, 20, 30, 40];
    const variance = applyAggregation(Aggregation.VARIANCE, values);
    const stdev = applyAggregation(Aggregation.STDEV, values);
    assert.ok(Math.abs(stdev - Math.sqrt(variance)) < 1e-9);
  });

  test("VARIANCE and STDEV are null with fewer than two values", () => {
    assert.equal(applyAggregation(Aggregation.VARIANCE, [10]), null);
    assert.equal(applyAggregation(Aggregation.STDEV, [10]), null);
    assert.equal(applyAggregation(Aggregation.VARIANCE, []), null);
  });

  test("ATTR returns the shared value when every row agrees", () => {
    assert.equal(applyAggregation(Aggregation.ATTR, ["East", "East", "East"]), "East");
  });

  test("ATTR returns the asterisk when values disagree", () => {
    assert.equal(applyAggregation(Aggregation.ATTR, ["East", "West"]), "*");
  });

  test("ATTR is null over no rows", () => {
    assert.equal(applyAggregation(Aggregation.ATTR, []), null);
  });

  test("availableAggregations lists the new aggregations for a number field", () => {
    const list = availableAggregations(FieldType.NUMBER);
    for (const agg of [Aggregation.PERCENTILE, Aggregation.VARIANCE, Aggregation.STDEV, Aggregation.ATTR]) {
      assert.ok(list.includes(agg), `expected ${agg} in ${list}`);
    }
  });

  test("availableAggregations offers ATTR for date fields", () => {
    assert.ok(availableAggregations(FieldType.DATE).includes(Aggregation.ATTR));
  });

  test("ATTR still applies to a string field even though it isn't in the default offered list", () => {
    // test/viz.test.js pins availableAggregations("string") to exactly
    // [COUNT, COUNTD] — ATTR remains a legal, callable aggregation for any
    // type, it's just not surfaced by default in the string pill menu.
    assert.equal(applyAggregation(Aggregation.ATTR, ["East", "East"]), "East");
  });

  test("aggregateRows threads a per-measure percentile through to PERCENTILE", () => {
    const out = aggregateRows(rows, {
      dimensions: ["region"],
      measures: [{ field: "amount", aggregation: Aggregation.PERCENTILE, percentile: 0.9 }],
    });
    const east = out.find((r) => r.region === "East");
    // East amounts [10,20,30,40]; p=0.9 → idx 0.9*3=2.7 → between 30 and 40.
    assert.ok(Math.abs(east["PERCENTILE(amount)"] - 37) < 1e-9);
  });
});

// ===========================================================================
describe("render-plan: grouped vs stacked bars", () => {
  const fields = inferFields(rows);
  const specWithColor = () => {
    let s = createSpec();
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(findField(fields, "region")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "amount")));
    s = putOnShelf(s, Shelf.COLOR, createEncoding(findField(fields, "rep")));
    return { ...s, mark: MarkType.BAR };
  };

  test("stacked (default): segments for one category share an x and stack along y", () => {
    const plan = buildRenderPlan(specWithColor(), rows, layout);
    assert.equal(plan.empty, false);
    const east = plan.marks.filter((m) => m.datum.region === "East");
    assert.equal(east.length, 4);
    // Every East segment sits at the same x (one band slot, not dodged).
    const xs = new Set(east.map((m) => Math.round(m.x * 1000)));
    assert.equal(xs.size, 1);
    // Segments stack end-to-end: consecutive stackStart/stackEnd chain with no gap.
    const bySegment = [...east].sort((a, b) => a.stackStart - b.stackStart);
    for (let i = 1; i < bySegment.length; i++) {
      assert.ok(Math.abs(bySegment[i].stackStart - bySegment[i - 1].stackEnd) < 1e-9);
    }
    assert.ok(Math.abs(bySegment[bySegment.length - 1].stackEnd - 100) < 1e-9); // 10+20+30+40
  });

  test("the stacked value axis extends to cover the full stack total, not one segment", () => {
    const plan = buildRenderPlan(specWithColor(), rows, layout);
    const yAxis = plan.axes.find((a) => a.orientation === "left");
    // East totals 100 — the axis domain must reach at least that far.
    assert.ok(yAxis.domain[1] >= 100);
  });

  test("grouped (dodged): segments for one category sit at DIFFERENT x positions", () => {
    const plan = buildRenderPlan(specWithColor(), rows, { ...layout, barMode: "grouped" });
    const east = plan.marks.filter((m) => m.datum.region === "East");
    assert.equal(east.length, 4);
    const xs = new Set(east.map((m) => Math.round(m.x * 1000)));
    assert.equal(xs.size, 4);
    // None of the dodged sub-bars overflow the category's own band.
    for (const m of east) {
      assert.ok(m.x >= plan.plot.x0 - 0.001);
      assert.ok(m.x + m.width <= plan.plot.x1 + 0.001);
    }
  });

  test("no color dimension: bars behave exactly as the base engine (one bar per row)", () => {
    let s = createSpec();
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(findField(fields, "region")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "amount")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, rows, layout);
    assert.equal(plan.marks.length, 2); // East, West
  });
});

// ===========================================================================
describe("render-plan: discrete vs continuous axis", () => {
  const fields = inferFields(rows);

  test("a dimension on an axis produces a band scale", () => {
    let s = createSpec();
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(findField(fields, "region")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "amount")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, rows, layout);
    const xAxis = plan.axes.find((a) => a.orientation === "bottom");
    assert.equal(xAxis.scaleType, "band");
    assert.equal(xAxis.discrete, true);
  });

  test("an aggregated measure on an axis produces a linear scale", () => {
    let s = createSpec();
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(findField(fields, "region")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "amount")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, rows, layout);
    const yAxis = plan.axes.find((a) => a.orientation === "left");
    assert.equal(yAxis.scaleType, "linear");
    assert.equal(yAxis.discrete, false);
  });
});

// ===========================================================================
describe("render-plan: diverging color for a signed measure", () => {
  const signed = [
    { region: "East", delta: -40 },
    { region: "West", delta: 60 },
    { region: "North", delta: 10 },
  ];
  const fields = inferFields(signed);

  test("a measure spanning negative and positive gets a diverging legend centred at 0", () => {
    let s = createSpec();
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(findField(fields, "region")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "delta")));
    s = putOnShelf(s, Shelf.COLOR, createEncoding(findField(fields, "delta")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, signed, layout);
    assert.equal(plan.legend.type, "diverging");
    assert.equal(plan.legend.midpoint, 0);
    // Domain is symmetric around zero (bound = max(|min|,|max|) = 60).
    assert.equal(plan.legend.domain[0], -60);
    assert.equal(plan.legend.domain[1], 60);
  });

  test("an all-positive measure on Color stays sequential, not diverging", () => {
    const positive = [
      { region: "East", amt: 10 },
      { region: "West", amt: 60 },
    ];
    const f = inferFields(positive);
    let s = createSpec();
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(findField(f, "region")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(f, "amt")));
    s = putOnShelf(s, Shelf.COLOR, createEncoding(findField(f, "amt")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, positive, layout);
    assert.equal(plan.legend.type, "sequential");
  });

  test("the midpoint (value 0) color sits at the diverging ramp's own middle stop", () => {
    let s = createSpec();
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(findField(fields, "region")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "delta")));
    s = putOnShelf(s, Shelf.COLOR, createEncoding(findField(fields, "delta")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, signed, layout);
    const midStop = plan.legend.stops.find((s2) => s2.t === 0.5);
    assert.equal(midStop.value, 0);
  });
});

// ===========================================================================
describe("render-plan: reference line", () => {
  const fields = inferFields(rows);

  test("an average reference line matches the mean and its pixel position matches the scale", () => {
    let s = createSpec();
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(findField(fields, "region")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "amount")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, rows, {
      ...layout,
      referenceLine: true,
    });
    // Two aggregated rows: East SUM=100, West SUM=20. Mean = 60.
    const ref = plan.referenceLines.find((r) => r.axis === "y");
    assert.ok(ref);
    assert.equal(ref.value, 60);
    const yAxis = plan.axes.find((a) => a.orientation === "left");
    const expectedPosition = yAxis.range[0] + ((60 - yAxis.domain[0]) / (yAxis.domain[1] - yAxis.domain[0])) * (yAxis.range[1] - yAxis.range[0]);
    assert.ok(Math.abs(ref.position - expectedPosition) < 1e-6);
  });

  test("no referenceLine option means no reference lines at all", () => {
    // referenceLines is opt-in and additive: when the caller never asks for it,
    // the key is absent entirely so the base plan shape (and its exact-key
    // test in viz.test.js) is untouched.
    let s = createSpec();
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(findField(fields, "region")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "amount")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, rows, layout);
    assert.deepEqual(plan.referenceLines ?? [], []);
  });

  test("a reference line pinned to one axis via {axis} does not appear on the other", () => {
    let s = createSpec();
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(findField(fields, "region")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "amount")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, rows, {
      ...layout,
      referenceLine: { type: "average", axis: "y" },
    });
    assert.equal(plan.referenceLines.length, 1);
    assert.equal(plan.referenceLines[0].axis, "y");
  });
});

// ===========================================================================
describe("render-plan: sort-by-measure ordering", () => {
  const fields = inferFields(rows);

  test("a dimension sorted by its aggregated measure orders the band axis to match", () => {
    let s = createSpec();
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(findField(fields, "region")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "amount")));
    s = { ...s, sort: { field: "SUM(amount)", direction: "desc" } };
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, rows, layout);
    // East SUM=100, West SUM=20 → East first, descending.
    const xAxis = plan.axes.find((a) => a.orientation === "bottom");
    assert.deepEqual(xAxis.domain, ["East", "West"]);
  });

  test("reversing sort direction reverses the axis order", () => {
    let s = createSpec();
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(findField(fields, "region")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "amount")));
    s = { ...s, sort: { field: "SUM(amount)", direction: "asc" } };
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, rows, layout);
    const xAxis = plan.axes.find((a) => a.orientation === "bottom");
    assert.deepEqual(xAxis.domain, ["West", "East"]);
  });
});

// ===========================================================================
describe("render-plan: NaN never reaches SVG geometry (new paths)", () => {
  const assertAllFinite = (value, path = "plan") => {
    if (typeof value === "number") {
      assert.ok(Number.isFinite(value), `${path} is not a finite number: ${value}`);
      return;
    }
    if (value === null || typeof value !== "object" || value instanceof Date) return;
    for (const [k, v] of Object.entries(value)) assertAllFinite(v, `${path}.${k}`);
  };

  const fields = inferFields(rows);

  test("stacked bars stay finite even with a blank measure cell", () => {
    const withBlank = [...rows, { region: "East", rep: "Zed", amount: "" }];
    let s = createSpec();
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(findField(fields, "region")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "amount")));
    s = putOnShelf(s, Shelf.COLOR, createEncoding(findField(fields, "rep")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, withBlank, layout);
    assertAllFinite(plan);
  });

  test("grouped bars stay finite even with a blank measure cell", () => {
    const withBlank = [...rows, { region: "West", rep: "Zed", amount: "" }];
    let s = createSpec();
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(findField(fields, "region")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "amount")));
    s = putOnShelf(s, Shelf.COLOR, createEncoding(findField(fields, "rep")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, withBlank, { ...layout, barMode: "grouped" });
    assertAllFinite(plan);
  });

  test("a reference line on an axis with no numeric data is simply absent, never NaN", () => {
    let s = createSpec();
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(findField(fields, "region")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "rep"))); // discrete, no numbers
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, rows, { ...layout, referenceLine: true });
    assertAllFinite(plan);
    assert.deepEqual(plan.referenceLines ?? [], []);
  });

  test("a diverging color scale stays finite with an empty data set", () => {
    let s = createSpec();
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(findField(fields, "region")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "amount")));
    s = putOnShelf(s, Shelf.COLOR, createEncoding(findField(fields, "amount")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, [], layout);
    assert.equal(plan.empty, true);
    assertAllFinite(plan);
  });

  test("PERCENTILE/VARIANCE/STDEV/ATTR never leak NaN into an aggregated row", () => {
    const out = aggregateRows(rows, {
      dimensions: ["region"],
      measures: [
        { field: "amount", aggregation: Aggregation.PERCENTILE, percentile: 0.9 },
        { field: "amount", aggregation: Aggregation.VARIANCE },
        { field: "amount", aggregation: Aggregation.STDEV },
        { field: "rep", aggregation: Aggregation.ATTR },
      ],
    });
    for (const row of out) {
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === "number") assert.ok(Number.isFinite(v), `${k} is not finite: ${v}`);
      }
    }
  });
});
