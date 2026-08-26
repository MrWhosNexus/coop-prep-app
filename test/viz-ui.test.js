// Tests for the viz builder's pure layers: the drag/drop + shelf-mutation rules
// and the SVG geometry helpers. The React components on top of these are dumb by
// design, so this is where the logic that can actually be wrong lives.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  SHELF_LABELS, AXIS_SHELVES, CARD_SHELVES, DROP_SHELVES, DRAG_MIME,
  isSingleShelf, isKnownShelf, shelfPills, groupFields, aggregationChoices,
  encodingKey, canDrop, dropField, removePill, reorderWithin, movePill,
  changeAggregation, changeDiscrete, serializeDrag, parseDrag,
  defaultFilterFor, setFilterAt, removeFilterAt,
} from "../components/viz/dnd.js";

import {
  isFiniteNumber, allFinite, round, rectGeom, pointGeom, finitePoints,
  linePath, areaPath, drawableMarks, gridlines, tickGeom, tooltipRows,
  clampTooltip, markAnchor,
} from "../components/viz/geometry.js";

import { createSpec, createEncoding, putOnShelf, Shelf, PillColor } from "../lib/viz/spec.js";
import { buildRenderPlan } from "../lib/viz/render-plan.js";
import { parseCsv, inferFields, createCalculatedField, FieldRole } from "../lib/viz/fields.js";
import { showMe } from "../lib/viz/marks.js";
import { rangeFilter } from "../lib/viz/aggregate.js";

const CSV_PATH = fileURLToPath(new URL("../public/data/hmda-sample.csv", import.meta.url));
const HMDA_ROWS = parseCsv(readFileSync(CSV_PATH, "utf8"));
const HMDA_FIELDS = inferFields(HMDA_ROWS);

const field = (name) => HMDA_FIELDS.find((f) => f.name === name);
const RACE = field("race");
const INCOME = field("income");
const LOAN = field("loan_amount");

/** The calculated field the tool ships so approval rate is expressible at all. */
const approvalRate = () =>
  createCalculatedField("approval_rate", 'IF([approved] = "APPROVED", 1, 0)', { aggregation: "AVG" });

describe("shelf identity", () => {
  test("single shelves replace, multi shelves append", () => {
    assert.equal(isSingleShelf(Shelf.COLOR), true);
    assert.equal(isSingleShelf(Shelf.SIZE), true);
    assert.equal(isSingleShelf(Shelf.LABEL), true);
    assert.equal(isSingleShelf(Shelf.ROWS), false);
    assert.equal(isSingleShelf(Shelf.COLUMNS), false);
  });

  test("known shelves are exactly the drop targets", () => {
    for (const s of DROP_SHELVES) assert.equal(isKnownShelf(s), true, s);
    assert.equal(isKnownShelf("nonsense"), false);
    assert.equal(isKnownShelf(undefined), false);
  });

  test("every drop target has a caption", () => {
    for (const s of DROP_SHELVES) assert.equal(typeof SHELF_LABELS[s], "string");
    assert.deepEqual(AXIS_SHELVES, [Shelf.COLUMNS, Shelf.ROWS]);
    assert.equal(CARD_SHELVES.includes(Shelf.COLOR), true);
  });

  test("shelfPills normalises arity", () => {
    let spec = createSpec();
    assert.deepEqual(shelfPills(spec, Shelf.COLOR), []);
    assert.deepEqual(shelfPills(spec, Shelf.ROWS), []);
    spec = dropField(spec, Shelf.COLOR, RACE);
    assert.equal(shelfPills(spec, Shelf.COLOR).length, 1);
    assert.equal(shelfPills(spec, "bogus").length, 0);
  });
});

describe("field list grouping", () => {
  test("splits the HMDA extract into dimensions and measures", () => {
    const { dimensions, measures } = groupFields(HMDA_FIELDS);
    const names = (list) => list.map((f) => f.name);
    // applicant_id and zip_code are identifiers, not things to sum.
    assert.deepEqual(names(dimensions), ["applicant_id", "race", "gender", "zip_code", "approved"]);
    assert.deepEqual(names(measures), ["loan_amount", "income"]);
  });

  test("tolerates an empty field list", () => {
    assert.deepEqual(groupFields([]), { dimensions: [], measures: [] });
    assert.deepEqual(groupFields(undefined), { dimensions: [], measures: [] });
  });
});

describe("pill colour follows meaning", () => {
  test("a dimension is discrete and blue, a measure is aggregated and green", () => {
    const dim = createEncoding(RACE);
    assert.equal(dim.discrete, true);
    assert.equal(dim.pillColor, PillColor.DISCRETE);
    assert.equal(dim.aggregation, null);

    const measure = createEncoding(INCOME);
    assert.equal(measure.discrete, false);
    assert.equal(measure.pillColor, PillColor.CONTINUOUS);
    assert.equal(measure.aggregation, "SUM");
  });

  test("a disaggregated measure stays green — green tracks continuity, not aggregation", () => {
    let spec = putOnShelf(createSpec(), Shelf.ROWS, createEncoding(INCOME));
    assert.equal(spec.rows[0].pillColor, PillColor.CONTINUOUS);
    // Dropping the aggregation gives a row-level measure. It is still a
    // continuous quantity, so it stays green and keeps its linear axis.
    spec = changeAggregation(spec, Shelf.ROWS, "income", null);
    assert.equal(spec.rows[0].aggregation, null);
    assert.equal(spec.rows[0].pillColor, PillColor.CONTINUOUS);
    // Only an explicit override turns it blue.
    spec = changeDiscrete(spec, Shelf.ROWS, "income", true);
    assert.equal(spec.rows[0].pillColor, PillColor.DISCRETE);
  });

  test("aggregating a dimension turns that pill green", () => {
    // COUNT(race) is a number per group, so the pill becomes continuous.
    let spec = dropField(createSpec(), Shelf.ROWS, RACE);
    assert.equal(spec.rows[0].pillColor, PillColor.DISCRETE);
    spec = changeAggregation(spec, Shelf.ROWS, "race", "COUNT");
    assert.equal(spec.rows[0].pillColor, PillColor.CONTINUOUS);
    assert.equal(spec.rows[0].discrete, false);
  });

  test("a pill can be forced continuous against its default", () => {
    let spec = dropField(createSpec(), Shelf.COLUMNS, RACE);
    spec = changeDiscrete(spec, Shelf.COLUMNS, "race", false);
    assert.equal(spec.columns[0].discrete, false);
    assert.equal(spec.columns[0].pillColor, PillColor.CONTINUOUS);
  });

  test("aggregation menu offers no-aggregation plus the type's functions", () => {
    const choices = aggregationChoices(createEncoding(INCOME));
    assert.equal(choices[0], null);
    assert.equal(choices.includes("SUM"), true);
    assert.equal(choices.includes("AVG"), true);
    // A string field cannot be summed — only counted.
    const strChoices = aggregationChoices(createEncoding(RACE));
    assert.deepEqual(strChoices, [null, "COUNT", "COUNTD"]);
    assert.deepEqual(aggregationChoices(null), []);
  });

  test("encodingKey separates two aggregations of one field", () => {
    const a = encodingKey(createEncoding(INCOME, { aggregation: "SUM" }), 0);
    const b = encodingKey(createEncoding(INCOME, { aggregation: "AVG" }), 1);
    assert.notEqual(a, b);
  });
});

describe("drop rules", () => {
  test("a field may be dropped on any real shelf", () => {
    const spec = createSpec();
    for (const shelf of DROP_SHELVES) {
      assert.equal(canDrop(spec, shelf, RACE).allowed, true, shelf);
    }
  });

  test("rejects an unknown shelf and a missing field", () => {
    const spec = createSpec();
    assert.equal(canDrop(spec, "trash", RACE).allowed, false);
    assert.equal(canDrop(spec, Shelf.ROWS, null).allowed, false);
    assert.equal(canDrop(spec, Shelf.ROWS, {}).allowed, false);
  });

  test("rejects an exact duplicate but allows a second aggregation of the same field", () => {
    let spec = dropField(createSpec(), Shelf.ROWS, INCOME); // SUM(income)
    const dupe = canDrop(spec, Shelf.ROWS, INCOME);
    assert.equal(dupe.allowed, false);
    assert.match(dupe.reason, /already on Rows/);

    // The duplicate drop is a genuine no-op, not a silent append.
    assert.equal(dropField(spec, Shelf.ROWS, INCOME).rows.length, 1);

    // AVG(income) beside SUM(income) is a legitimate view.
    spec = putOnShelf(spec, Shelf.ROWS, createEncoding(INCOME, { aggregation: "AVG" }));
    assert.equal(spec.rows.length, 2);
    // ...and the same field on a DIFFERENT shelf is always fine.
    assert.equal(canDrop(spec, Shelf.COLUMNS, INCOME).allowed, true);
  });

  test("warns, but still allows, a discrete pill on Size", () => {
    const check = canDrop(createSpec(), Shelf.SIZE, RACE);
    assert.equal(check.allowed, true);
    assert.match(check.warning, /continuous measure/);
    assert.equal(canDrop(createSpec(), Shelf.SIZE, INCOME).warning, null);
  });

  test("dropping on a single shelf replaces; on a multi shelf appends", () => {
    let spec = dropField(createSpec(), Shelf.COLOR, RACE);
    spec = dropField(spec, Shelf.COLOR, field("gender"));
    assert.equal(spec.color.field, "gender");
    assert.equal(shelfPills(spec, Shelf.COLOR).length, 1);

    let multi = dropField(createSpec(), Shelf.ROWS, RACE);
    multi = dropField(multi, Shelf.ROWS, field("gender"));
    assert.deepEqual(multi.rows.map((p) => p.field), ["race", "gender"]);
  });

  test("dropField leaves the original spec untouched", () => {
    const spec = createSpec();
    const next = dropField(spec, Shelf.ROWS, RACE);
    assert.equal(spec.rows.length, 0);
    assert.equal(next.rows.length, 1);
    assert.notEqual(spec, next);
  });
});

describe("removing and reordering", () => {
  test("removePill clears a single shelf and splices a multi shelf", () => {
    let spec = dropField(createSpec(), Shelf.COLOR, RACE);
    spec = removePill(spec, Shelf.COLOR, 0);
    assert.equal(spec.color, null);

    let rows = dropField(createSpec(), Shelf.ROWS, RACE);
    rows = dropField(rows, Shelf.ROWS, INCOME);
    rows = removePill(rows, Shelf.ROWS, 0);
    assert.deepEqual(rows.rows.map((p) => p.field), ["income"]);
  });

  test("removePill ignores an out-of-range index", () => {
    const spec = dropField(createSpec(), Shelf.ROWS, RACE);
    assert.equal(removePill(spec, Shelf.ROWS, 5).rows.length, 1);
    assert.equal(removePill(spec, Shelf.ROWS, -1).rows.length, 1);
  });

  test("reorderWithin moves an item and clamps the target", () => {
    assert.deepEqual(reorderWithin(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
    assert.deepEqual(reorderWithin(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
    assert.deepEqual(reorderWithin(["a", "b", "c"], 0, 99), ["b", "c", "a"]);
    assert.deepEqual(reorderWithin(["a", "b", "c"], 9, 0), ["a", "b", "c"]);
    // Must not mutate the input.
    const src = ["a", "b"];
    reorderWithin(src, 0, 1);
    assert.deepEqual(src, ["a", "b"]);
  });

  test("movePill reorders within a shelf", () => {
    let spec = dropField(createSpec(), Shelf.ROWS, RACE);
    spec = dropField(spec, Shelf.ROWS, field("gender"));
    spec = dropField(spec, Shelf.ROWS, INCOME);
    const moved = movePill(spec, { shelf: Shelf.ROWS, index: 0 }, { shelf: Shelf.ROWS, index: 2 });
    assert.deepEqual(moved.rows.map((p) => p.field), ["gender", "income", "race"]);
  });

  test("movePill across shelves keeps the pill's aggregation", () => {
    let spec = putOnShelf(createSpec(), Shelf.ROWS, createEncoding(INCOME, { aggregation: "AVG" }));
    spec = movePill(spec, { shelf: Shelf.ROWS, index: 0 }, { shelf: Shelf.COLUMNS, index: 0 });
    assert.equal(spec.rows.length, 0);
    assert.equal(spec.columns[0].field, "income");
    assert.equal(spec.columns[0].aggregation, "AVG");
  });

  test("movePill onto a single shelf replaces its occupant", () => {
    let spec = dropField(createSpec(), Shelf.COLOR, RACE);
    spec = dropField(spec, Shelf.ROWS, INCOME);
    spec = movePill(spec, { shelf: Shelf.ROWS, index: 0 }, { shelf: Shelf.COLOR, index: 0 });
    assert.equal(spec.color.field, "income");
    assert.equal(spec.rows.length, 0);
  });

  test("movePill is a no-op for a missing pill or unknown shelf", () => {
    const spec = dropField(createSpec(), Shelf.ROWS, RACE);
    assert.equal(movePill(spec, { shelf: Shelf.ROWS, index: 7 }, { shelf: Shelf.COLUMNS, index: 0 }), spec);
    assert.equal(movePill(spec, { shelf: "junk", index: 0 }, { shelf: Shelf.COLUMNS, index: 0 }), spec);
  });

  test("appends when the drop index is past the end", () => {
    let spec = dropField(createSpec(), Shelf.COLUMNS, RACE);
    spec = dropField(spec, Shelf.ROWS, INCOME);
    spec = movePill(spec, { shelf: Shelf.ROWS, index: 0 }, { shelf: Shelf.COLUMNS, index: 99 });
    assert.deepEqual(spec.columns.map((p) => p.field), ["race", "income"]);
  });
});

describe("filters", () => {
  test("a dimension gets an include-list of every member — nothing hidden yet", () => {
    const filter = defaultFilterFor(RACE, HMDA_ROWS);
    assert.equal(filter.type, "categorical");
    assert.equal(filter.field, "race");
    assert.equal(filter.include.length, 6);
    assert.equal(filter.include.includes("Black"), true);
    assert.equal(filter.exclude, undefined);
  });

  test("a measure gets a range spanning its real extent", () => {
    // The source rows are raw CSV strings until the pipeline coerces them, and
    // extent() over strings is [null, null] — so a bound of null here means the
    // filter silently lost its range. Pin the real numbers.
    const filter = defaultFilterFor(INCOME, HMDA_ROWS);
    assert.equal(filter.type, "range");
    assert.equal(filter.field, "income");
    assert.equal(filter.min, 22000);
    assert.equal(filter.max, 126000);

    const loan = defaultFilterFor(LOAN, HMDA_ROWS);
    assert.equal(loan.min, 54000);
    assert.equal(loan.max, 401000);
  });

  test("zip_code is a numeric DIMENSION, so it filters as a list, not a range", () => {
    // Filtering an identifier by range is never what anyone means.
    assert.equal(defaultFilterFor(field("zip_code"), HMDA_ROWS).type, "categorical");
  });

  test("a default filter changes nothing until the learner narrows it", () => {
    const spec = { ...dropField(createSpec(), Shelf.COLUMNS, RACE), filters: [defaultFilterFor(RACE, HMDA_ROWS)] };
    const plan = buildRenderPlan(spec, HMDA_ROWS, { width: 640, height: 400 });
    assert.equal(plan.data.length, 6);
  });

  test("narrowing the include-list actually drops marks", () => {
    let spec = dropField(createSpec(), Shelf.COLUMNS, RACE);
    spec = dropField(spec, Shelf.ROWS, approvalRate());
    spec = { ...spec, calculatedFields: [approvalRate()], filters: [defaultFilterFor(RACE, HMDA_ROWS)] };
    spec = setFilterAt(spec, 0, { type: "categorical", field: "race", include: ["Black", "White"] });

    const plan = buildRenderPlan(spec, HMDA_ROWS, { width: 640, height: 400 });
    assert.deepEqual(plan.data.map((r) => r.race).sort(), ["Black", "White"]);
    // The surviving numbers must be unchanged — a filter removes rows, it does
    // not re-weight the groups that remain.
    assert.equal(round(plan.marks.find((m) => m.datum.race === "White").value, 4), 0.86);
  });

  test("setFilterAt and removeFilterAt only touch the named index", () => {
    const spec = { ...createSpec(), filters: [defaultFilterFor(RACE, HMDA_ROWS), defaultFilterFor(INCOME, HMDA_ROWS)] };
    const swapped = setFilterAt(spec, 1, rangeFilter("income", 1000, 2000));
    assert.equal(swapped.filters[0].field, "race");
    assert.equal(swapped.filters[1].min, 1000);
    assert.equal(spec.filters[1].min !== 1000, true, "the original spec was mutated");

    const dropped = removeFilterAt(spec, 0);
    assert.deepEqual(dropped.filters.map((f) => f.field), ["income"]);
    // Out-of-range edits are no-ops rather than corruptions.
    assert.equal(setFilterAt(spec, 9, rangeFilter("income", 1, 2)), spec);
    assert.equal(removeFilterAt(spec, -1), spec);
  });
});

describe("drag payloads", () => {
  test("round-trips a field and a pill", () => {
    assert.equal(typeof DRAG_MIME, "string");
    const f = { kind: "field", field: "race" };
    assert.deepEqual(parseDrag(serializeDrag(f)), f);
    const p = { kind: "pill", shelf: "rows", index: 1 };
    assert.deepEqual(parseDrag(serializeDrag(p)), p);
  });

  test("returns null for junk rather than throwing", () => {
    // A drop can carry anything the OS clipboard had in it.
    assert.equal(parseDrag("not json"), null);
    assert.equal(parseDrag(""), null);
    assert.equal(parseDrag("null"), null);
    assert.equal(parseDrag('"a string"'), null);
    assert.equal(parseDrag('{"kind":"evil"}'), null);
    assert.equal(parseDrag("[1,2]"), null);
  });
});

describe("NaN never reaches an SVG attribute", () => {
  test("isFiniteNumber rejects everything that is not a real number", () => {
    assert.equal(isFiniteNumber(0), true);
    assert.equal(isFiniteNumber(-2.5), true);
    assert.equal(isFiniteNumber(NaN), false);
    assert.equal(isFiniteNumber(Infinity), false);
    assert.equal(isFiniteNumber(-Infinity), false);
    assert.equal(isFiniteNumber(null), false);
    assert.equal(isFiniteNumber(undefined), false);
    assert.equal(isFiniteNumber("5"), false); // a numeric string still poisons a path
    assert.equal(allFinite(1, 2, 3), true);
    assert.equal(allFinite(1, NaN), false);
    assert.equal(allFinite(), true);
  });

  test("rectGeom rejects NaN and normalises a negative extent", () => {
    assert.equal(rectGeom({ x: NaN, y: 0, width: 5, height: 5 }), null);
    assert.equal(rectGeom({ x: 0, y: 0, width: undefined, height: 5 }), null);
    assert.equal(rectGeom(null), null);
    assert.deepEqual(rectGeom({ x: 10, y: 20, width: 4, height: 6 }), { x: 10, y: 20, width: 4, height: 6 });
    // A negative height must become a positive one with a shifted origin, since
    // SVG silently drops height="-6".
    assert.deepEqual(rectGeom({ x: 10, y: 20, width: 4, height: -6 }), { x: 10, y: 14, width: 4, height: 6 });
    assert.deepEqual(rectGeom({ x: 10, y: 20, width: -4, height: 6 }), { x: 6, y: 20, width: 4, height: 6 });
  });

  test("pointGeom defaults a missing radius and rejects NaN centres", () => {
    assert.equal(pointGeom({ x: 1, y: NaN }), null);
    assert.deepEqual(pointGeom({ x: 1, y: 2 }), { x: 1, y: 2, radius: 4 });
    assert.deepEqual(pointGeom({ x: 1, y: 2, radius: 9 }), { x: 1, y: 2, radius: 9 });
    assert.equal(pointGeom({ x: 1, y: 2, radius: -3 }).radius, 0);
  });

  test("round trims sub-pixel noise", () => {
    assert.equal(round(1.23456), 1.23);
    assert.equal(round(1.005, 1), 1);
    assert.equal(round(10), 10);
  });

  test("path builders skip bad points and never emit NaN", () => {
    const pts = [{ x: 0, y: 0 }, { x: NaN, y: 5 }, { x: 10, y: 10 }];
    assert.equal(finitePoints(pts).length, 2);

    const d = linePath(pts);
    assert.equal(d, "M0,0 L10,10");
    assert.equal(d.includes("NaN"), false);

    // Nothing drawable → an empty `d`, which is inert rather than broken.
    assert.equal(linePath([]), "");
    assert.equal(linePath([{ x: NaN, y: NaN }]), "");
    assert.equal(linePath(undefined), "");
  });

  test("areaPath closes against the baseline and refuses a NaN one", () => {
    const pts = [{ x: 0, y: 10 }, { x: 10, y: 20 }];
    assert.equal(areaPath(pts, 100), "M0,10 L10,20 L10,100 L0,100 Z");
    // A NaN baseline would poison the whole shape, so refuse it outright.
    assert.equal(areaPath(pts, NaN), "");
    assert.equal(areaPath(pts, undefined), "");
    assert.equal(areaPath([], 100), "");
  });

  test("drawableMarks filters every mark kind by its own geometry", () => {
    const marks = [
      { type: "rect", x: 0, y: 0, width: 5, height: 5 },
      { type: "rect", x: NaN, y: 0, width: 5, height: 5 },
      { type: "circle", x: 1, y: 1 },
      { type: "circle", x: 1, y: NaN },
      { type: "text", x: 2, y: 2 },
      { type: "line", points: [{ x: 0, y: 0 }] },
      { type: "line", points: [] },
      { type: "area", points: [{ x: 0, y: 0 }], baseline: 10 },
      { type: "area", points: [{ x: 0, y: 0 }], baseline: NaN },
      { type: "unknown", x: 0, y: 0 },
      null,
    ];
    assert.equal(drawableMarks(marks).length, 5);
    assert.deepEqual(drawableMarks([]), []);
    assert.deepEqual(drawableMarks(undefined), []);
  });
});

describe("axis furniture", () => {
  const plot = { x0: 60, y0: 350, x1: 600, y1: 20, width: 540, height: 330 };

  test("gridlines span the plot at each continuous tick", () => {
    const axis = {
      orientation: "left",
      discrete: false,
      line: { x1: 60, y1: 20, x2: 60, y2: 350 },
      ticks: [{ position: 100 }, { position: 200 }, { position: NaN }],
    };
    const lines = gridlines(axis, plot);
    assert.equal(lines.length, 2); // the NaN tick is dropped
    assert.deepEqual(lines[0], { key: "g0", x1: 60, y1: 100, x2: 600, y2: 100 });
  });

  test("a band axis gets no gridlines", () => {
    const axis = { orientation: "bottom", discrete: true, ticks: [{ position: 100 }], line: {} };
    assert.deepEqual(gridlines(axis, plot), []);
    assert.deepEqual(gridlines(null, plot), []);
  });

  test("tickGeom places bottom labels under, left labels beside", () => {
    const bottom = { orientation: "bottom", line: { x1: 60, y1: 350, x2: 600, y2: 350 } };
    const g = tickGeom(bottom, { position: 120 });
    assert.equal(g.anchor, "middle");
    assert.equal(g.textY, 368);

    const left = { orientation: "left", line: { x1: 60, y1: 20, x2: 60, y2: 350 } };
    const lg = tickGeom(left, { position: 120 });
    assert.equal(lg.anchor, "end");
    assert.equal(lg.textX, 52);

    assert.equal(tickGeom(bottom, { position: NaN }), null);
    assert.equal(tickGeom(null, { position: 1 }), null);
  });
});

describe("tooltips", () => {
  test("lists every pill on the view with this mark's value", () => {
    let spec = createSpec();
    spec = dropField(spec, Shelf.COLUMNS, RACE);
    spec = dropField(spec, Shelf.ROWS, LOAN);
    const rows = tooltipRows(spec, { race: "Black", "SUM(loan_amount)": 1500000 });
    assert.deepEqual(rows, [
      { label: "race", value: "Black" },
      { label: "SUM(loan_amount)", value: "1.5M" },
    ]);
  });

  test("skips columns the datum does not carry and de-dupes", () => {
    let spec = dropField(createSpec(), Shelf.COLUMNS, RACE);
    spec = dropField(spec, Shelf.COLOR, RACE); // same column, two shelves
    const rows = tooltipRows(spec, { race: "White" });
    assert.equal(rows.length, 1);
    assert.deepEqual(tooltipRows(spec, null), []);
    assert.deepEqual(tooltipRows(spec, { unrelated: 1 }), []);
  });

  test("clampTooltip keeps the card inside the box", () => {
    assert.deepEqual(clampTooltip({ x: 590, y: 10, width: 120, height: 40, boxWidth: 640, boxHeight: 400 }), { x: 516, y: 10 });
    assert.deepEqual(clampTooltip({ x: -20, y: -20, width: 120, height: 40, boxWidth: 640, boxHeight: 400 }), { x: 4, y: 4 });
    assert.deepEqual(clampTooltip({ x: NaN, y: 0, width: 1, height: 1, boxWidth: 10, boxHeight: 10 }), { x: 0, y: 0 });
  });

  test("markAnchor takes the top-centre of a bar and the centre of a point", () => {
    assert.deepEqual(markAnchor({ type: "rect", x: 10, y: 20, width: 40, height: 100 }), { x: 30, y: 20 });
    assert.deepEqual(markAnchor({ type: "circle", x: 5, y: 6 }), { x: 5, y: 6 });
    assert.equal(markAnchor({ type: "rect", x: NaN, y: 0, width: 1, height: 1 }), null);
    assert.equal(markAnchor(null), null);
  });
});

describe("the canonical teaching viz: approval rate by race", () => {
  // Two drags in the UI: race → Columns, approval_rate → Rows. This test asserts
  // that path produces the real HMDA numbers, end to end, through the same
  // helpers the components call.
  const buildSpec = () => {
    let spec = createSpec({ calculatedFields: [approvalRate()], mark: "bar" });
    spec = dropField(spec, Shelf.COLUMNS, RACE);
    spec = dropField(spec, Shelf.ROWS, approvalRate());
    return spec;
  };

  test("the calculated field lands as a green AVG pill", () => {
    const calc = approvalRate();
    assert.equal(calc.role, FieldRole.MEASURE);
    const spec = buildSpec();
    // AVG, not SUM: summing 0/1 flags gives a count, not a rate.
    assert.equal(spec.rows[0].aggregation, "AVG");
    assert.equal(spec.rows[0].pillColor, PillColor.CONTINUOUS);
    assert.equal(spec.columns[0].pillColor, PillColor.DISCRETE);
  });

  test("renders bars matching the verified HMDA approval rates", () => {
    const plan = buildRenderPlan(buildSpec(), HMDA_ROWS, { width: 640, height: 400 });
    assert.equal(plan.empty, false);
    assert.equal(plan.mark, "bar");

    const rateOf = (race) => plan.marks.find((m) => m.datum.race === race).value;
    // Ground truth: Black 9/16, White 43/50, Asian 8/10, Hispanic 12/18.
    assert.equal(round(rateOf("Black"), 4), 0.5625);
    assert.equal(round(rateOf("White"), 4), 0.86);
    assert.equal(round(rateOf("Asian"), 4), 0.8);
    assert.equal(round(rateOf("Hispanic"), 4), 0.6667);
  });

  test("every bar survives the NaN guard and sits inside the plot box", () => {
    const plan = buildRenderPlan(buildSpec(), HMDA_ROWS, { width: 640, height: 400 });
    const drawable = drawableMarks(plan.marks);
    assert.equal(drawable.length, plan.marks.length, "a mark was dropped as non-finite");
    assert.ok(drawable.length > 0);

    for (const m of drawable) {
      const g = rectGeom(m);
      assert.ok(g.width > 0 && g.height > 0);
      assert.ok(g.x >= plan.plot.x0 - 1, "bar starts left of the plot");
      assert.ok(g.x + g.width <= plan.plot.x1 + 1, "bar runs past the plot");
      assert.ok(g.y >= plan.plot.y1 - 1 && g.y + g.height <= plan.plot.y0 + 1, "bar escapes vertically");
    }
  });

  test("the axes carry percent ticks and the race band", () => {
    const plan = buildRenderPlan(buildSpec(), HMDA_ROWS, { width: 640, height: 400 });
    const bottom = plan.axes.find((a) => a.orientation === "bottom");
    const left = plan.axes.find((a) => a.orientation === "left");

    assert.equal(bottom.discrete, true);
    assert.equal(bottom.ticks.some((t) => t.label === "Black"), true);
    // "rate" in the field name makes the engine format the axis as percentages.
    assert.equal(left.ticks.some((t) => t.label === "100%"), true);
    for (const axis of plan.axes) {
      for (const t of axis.ticks) assert.equal(isFiniteNumber(t.position), true, `${t.label} unpositioned`);
    }
  });

  test("Show Me offers bar and blocks scatter for this shelf shape", () => {
    const sm = showMe(buildSpec());
    assert.equal(sm.recommended, "bar");
    assert.equal(sm.valid.includes("bar"), true);
    assert.equal(sm.valid.includes("scatter"), false);
    // A disabled option must explain itself — that reason is the lesson.
    const scatter = sm.options.find((o) => o.mark === "scatter");
    assert.equal(scatter.valid, false);
    assert.match(scatter.reason, /continuous measure on both/);
  });

  test("colouring by race adds a categorical legend", () => {
    let spec = buildSpec();
    spec = dropField(spec, Shelf.COLOR, RACE);
    const plan = buildRenderPlan(spec, HMDA_ROWS, { width: 640, height: 400 });
    assert.equal(plan.legends.length, 1);
    assert.equal(plan.legends[0].type, "categorical");
    assert.equal(plan.legends[0].entries.length, 6);
    for (const e of plan.legends[0].entries) assert.match(e.color, /^#[0-9a-f]{6}$/i);
  });
});

describe("the empty view", () => {
  test("an empty plan is still uniform and renderable", () => {
    const plan = buildRenderPlan(createSpec(), HMDA_ROWS, { width: 640, height: 400 });
    assert.equal(plan.empty, true);
    // The UI reads these unconditionally, so they must exist on every plan.
    assert.deepEqual(plan.marks, []);
    assert.deepEqual(plan.axes, []);
    assert.deepEqual(plan.legends, []);
    assert.deepEqual(plan.labels, []);
    assert.equal(plan.legend, null);
    assert.ok(plan.plot && isFiniteNumber(plan.plot.x0));
    assert.deepEqual(drawableMarks(plan.marks), []);
  });

  test("a spec over zero rows is empty, not broken", () => {
    const spec = dropField(createSpec(), Shelf.COLUMNS, RACE);
    const plan = buildRenderPlan(spec, [], { width: 640, height: 400 });
    assert.equal(plan.empty, true);
    assert.deepEqual(drawableMarks(plan.marks), []);
  });
});
