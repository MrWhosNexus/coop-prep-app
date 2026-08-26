import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  FieldType, FieldRole,
  inferType, inferRole, inferFields, makeField, defaultAggregation,
  isDimension, isMeasure, findField, coerceValue, coerceRows,
  toNumber, toDate, isBlank, parseCsv,
  parseExpression, evaluateExpression, createCalculatedField,
  applyCalculatedFields, validateExpression,
} from "../lib/viz/fields.js";

import {
  Aggregation, FilterType,
  applyAggregation, availableAggregations, aggregatedName,
  applyFilters, categoricalFilter, excludeFilter, rangeFilter, topNFilter,
  groupBy, aggregateRows, sortRows, distinctValues,
} from "../lib/viz/aggregate.js";

import {
  MarkType, MARK_LABELS,
  classifyShelves, checkMark, isMarkValid, validMarkTypes, bestMarkType, showMe,
  isGeographic, isPathMark,
} from "../lib/viz/marks.js";

import {
  ScaleType,
  extent, niceStep, niceDomain, generateTicks,
  linearScale, bandScale, timeScale, formatTick, scaleForEncoding,
} from "../lib/viz/scales.js";

import {
  Shelf, PillColor,
  createSpec, createEncoding, resolveDiscrete, encodingLabel, encodingColumn,
  isDiscrete, isContinuous,
  putOnShelf, removeFromShelf, setAggregation, setDiscrete,
  addFilter, removeFilter, resolveMark, allEncodings,
  specDimensions, specMeasures, validateSpec,
  serializeSpec, deserializeSpec, specMatches,
} from "../lib/viz/spec.js";

import {
  buildRenderPlan, interpolateColor, formatValue,
  DEFAULT_MARK_COLOR, CATEGORICAL_PALETTE,
} from "../lib/viz/render-plan.js";

// --- Fixtures --------------------------------------------------------------

const HMDA_PATH = fileURLToPath(new URL("../public/data/hmda-sample.csv", import.meta.url));
const hmdaRows = parseCsv(readFileSync(HMDA_PATH, "utf8"));

// A tiny hand-checkable dataset, so aggregation failures point at the maths
// rather than at 100 rows of real data.
const sales = [
  { region: "East", rep: "Ann", amount: 100, day: "2026-01-01" },
  { region: "East", rep: "Bob", amount: 200, day: "2026-01-02" },
  { region: "West", rep: "Cid", amount: 300, day: "2026-01-01" },
  { region: "West", rep: "Ann", amount: 400, day: "2026-01-02" },
  { region: "North", rep: "Bob", amount: 50, day: "2026-01-01" },
];

// Two dimensions and a measure, for the cases where "top N rows" and "top N
// members of a dimension" are different answers. CA=1200, TX=600, NY=16.
const grants = [
  { state: "CA", purpose: "Home", amt: 500 },
  { state: "CA", purpose: "Refi", amt: 400 },
  { state: "CA", purpose: "Improve", amt: 300 },
  { state: "TX", purpose: "Home", amt: 250 },
  { state: "TX", purpose: "Refi", amt: 200 },
  { state: "TX", purpose: "Improve", amt: 150 },
  { state: "NY", purpose: "Home", amt: 10 },
  { state: "NY", purpose: "Refi", amt: 5 },
  { state: "NY", purpose: "Improve", amt: 1 },
];

const dimField = (name) => makeField(name, FieldType.STRING, FieldRole.DIMENSION);
const measureField = (name) => makeField(name, FieldType.NUMBER, FieldRole.MEASURE);

// ===========================================================================
describe("fields: type inference", () => {
  test("infers number, string, date and boolean", () => {
    assert.equal(inferType(["1", "2", "3.5"]), FieldType.NUMBER);
    assert.equal(inferType(["Black", "White"]), FieldType.STRING);
    assert.equal(inferType(["2026-01-01", "2026-08-12"]), FieldType.DATE);
    assert.equal(inferType(["true", "false", "yes"]), FieldType.BOOLEAN);
  });

  test("a single non-numeric value demotes a column to string", () => {
    // Real data arrives with an "N/A" in it; we must not silently drop the row.
    assert.equal(inferType(["1", "2", "N/A"]), FieldType.STRING);
  });

  test("blanks are ignored, and an all-blank column is a string", () => {
    assert.equal(inferType(["1", "", null, "2"]), FieldType.NUMBER);
    assert.equal(inferType(["", null, undefined]), FieldType.STRING);
  });

  test("does not mistake arbitrary strings for dates", () => {
    // `new Date("Other")` is NaN, but `new Date("Male")` is too — the danger is
    // engines that parse loose formats. Only ISO-ish shapes should pass.
    assert.equal(inferType(["Other", "Male"]), FieldType.STRING);
    assert.equal(inferType(["A0001", "A0002"]), FieldType.STRING);
  });

  test("toNumber tolerates currency and separators, rejects junk", () => {
    assert.equal(toNumber("$1,250"), 1250);
    assert.equal(toNumber("45%"), 45);
    assert.equal(toNumber(" 3.5 "), 3.5);
    assert.equal(toNumber("abc"), null);
    assert.equal(toNumber(""), null);
    assert.equal(toNumber(null), null);
  });

  test("toDate parses ISO and US slash dates only", () => {
    assert.equal(toDate("2026-08-12").getUTCFullYear(), 2026);
    assert.equal(toDate("8/12/2026").getUTCMonth(), 7);
    assert.equal(toDate("not a date"), null);
  });

  test("toDate reads padded and unpadded slash dates as the same calendar day", () => {
    // A CSV writes 1/5/2024 and 01/05/2024 for one day. Both must land on one
    // instant, or a date dimension buckets that day twice.
    assert.equal(toDate("1/5/2024").getTime(), toDate("01/05/2024").getTime());
    assert.equal(toDate("1/5/2024").getTime(), toDate("2024-01-05").getTime());
    assert.equal(toDate("1/5/2024").getUTCDate(), 5);
    assert.equal(toDate("1/5/2024").getUTCMonth(), 0);
    // Date.UTC would happily roll these over into a real date; a calendar that
    // rolls is a typo, not a date.
    assert.equal(toDate("13/45/2024"), null);
    assert.equal(toDate("2024-02-31"), null);
  });

  test("a bare calendar date anchors to UTC midnight regardless of host TZ", () => {
    // Run in a child process so a non-UTC zone is proven, not simulated, and so
    // the rest of the suite keeps the TZ it was launched with.
    const fieldsUrl = pathToFileURL(fileURLToPath(new URL("../lib/viz/fields.js", import.meta.url))).href;
    const src = `import { toDate } from ${JSON.stringify(fieldsUrl)};
      console.log(JSON.stringify({
        unpadded: toDate("1/5/2024").toISOString(),
        padded: toDate("01/05/2024").toISOString(),
        iso: toDate("2024-01-05").toISOString(),
      }));`;
    const out = execFileSync(process.execPath, ["--input-type=module", "-e", src], {
      env: { ...process.env, TZ: "America/Los_Angeles" },
      encoding: "utf8",
    });
    const got = JSON.parse(out);
    assert.equal(got.unpadded, "2024-01-05T00:00:00.000Z");
    assert.equal(got.padded, "2024-01-05T00:00:00.000Z");
    assert.equal(got.iso, "2024-01-05T00:00:00.000Z");
  });

  test("isBlank", () => {
    assert.equal(isBlank(""), true);
    assert.equal(isBlank("   "), true);
    assert.equal(isBlank(null), true);
    assert.equal(isBlank(0), false);
  });
});

describe("fields: the dimension/measure split", () => {
  test("numbers are measures, everything else is a dimension", () => {
    assert.equal(inferRole("income", FieldType.NUMBER), FieldRole.MEASURE);
    assert.equal(inferRole("race", FieldType.STRING), FieldRole.DIMENSION);
    assert.equal(inferRole("opened", FieldType.DATE), FieldRole.DIMENSION);
  });

  test("identifier-ish numeric columns stay dimensions", () => {
    // Summing a ZIP code is the single most common beginner mistake.
    assert.equal(inferRole("zip_code", FieldType.NUMBER), FieldRole.DIMENSION);
    assert.equal(inferRole("applicant_id", FieldType.NUMBER), FieldRole.DIMENSION);
    assert.equal(inferRole("year", FieldType.NUMBER), FieldRole.DIMENSION);
    assert.equal(inferRole("census_tract", FieldType.NUMBER), FieldRole.DIMENSION);
    // ...but a real quantity is still a measure.
    assert.equal(inferRole("loan_amount", FieldType.NUMBER), FieldRole.MEASURE);
  });

  test("default aggregation: measures SUM, dimensions COUNT", () => {
    assert.equal(defaultAggregation(FieldType.NUMBER, FieldRole.MEASURE), Aggregation.SUM);
    assert.equal(defaultAggregation(FieldType.STRING, FieldRole.DIMENSION), Aggregation.COUNT);
  });

  test("isDimension / isMeasure / findField", () => {
    const fields = inferFields(sales);
    assert.equal(isDimension(findField(fields, "region")), true);
    assert.equal(isMeasure(findField(fields, "amount")), true);
    assert.equal(findField(fields, "nope"), undefined);
  });
});

describe("fields: inferFields over the real HMDA extract", () => {
  test("parses 100 rows with the expected header", () => {
    assert.equal(hmdaRows.length, 100);
    assert.deepEqual(Object.keys(hmdaRows[0]), [
      "applicant_id", "race", "gender", "zip_code", "loan_amount", "income", "approved",
    ]);
    assert.equal(hmdaRows[0].applicant_id, "A0001");
  });

  test("classifies every HMDA column the way a Tableau user would expect", () => {
    const fields = inferFields(hmdaRows);
    const byName = Object.fromEntries(fields.map((f) => [f.name, f]));

    assert.equal(byName.applicant_id.type, FieldType.STRING);
    assert.equal(byName.applicant_id.role, FieldRole.DIMENSION);
    assert.equal(byName.race.role, FieldRole.DIMENSION);
    assert.equal(byName.gender.role, FieldRole.DIMENSION);
    assert.equal(byName.approved.role, FieldRole.DIMENSION);

    // zip_code parses as a number but must NOT become a measure.
    assert.equal(byName.zip_code.type, FieldType.NUMBER);
    assert.equal(byName.zip_code.role, FieldRole.DIMENSION);

    assert.equal(byName.loan_amount.role, FieldRole.MEASURE);
    assert.equal(byName.income.role, FieldRole.MEASURE);
    assert.equal(byName.loan_amount.defaultAggregation, Aggregation.SUM);
  });

  test("coerceRows turns cell strings into typed values", () => {
    const fields = inferFields(hmdaRows);
    const typed = coerceRows(hmdaRows, fields);
    assert.equal(typed[0].loan_amount, 171000);
    assert.equal(typeof typed[0].loan_amount, "number");
    assert.equal(typed[0].race, "Black");
  });

  test("coerceValue by type", () => {
    assert.equal(coerceValue("42", FieldType.NUMBER), 42);
    assert.equal(coerceValue("yes", FieldType.BOOLEAN), true);
    assert.equal(coerceValue("no", FieldType.BOOLEAN), false);
    assert.equal(coerceValue("", FieldType.NUMBER), null);
    assert.equal(coerceValue("x", FieldType.STRING), "x");
  });
});

describe("fields: parseCsv", () => {
  test("handles quoted fields, embedded commas and escaped quotes", () => {
    const rows = parseCsv('a,b\n"x,1","he said ""hi"""\nplain,2\n');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].a, "x,1");
    assert.equal(rows[0].b, 'he said "hi"');
    assert.equal(rows[1].a, "plain");
  });

  test("handles CRLF and a trailing newline without emitting a blank row", () => {
    const rows = parseCsv("a,b\r\n1,2\r\n");
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], { a: "1", b: "2" });
  });

  test("empty input yields no rows", () => {
    assert.deepEqual(parseCsv(""), []);
  });
});

// ===========================================================================
describe("aggregate: aggregation functions", () => {
  const nums = [1, 2, 3, 4, 10];

  test("SUM / AVG / MIN / MAX", () => {
    assert.equal(applyAggregation(Aggregation.SUM, nums), 20);
    assert.equal(applyAggregation(Aggregation.AVG, nums), 4);
    assert.equal(applyAggregation(Aggregation.MIN, nums), 1);
    assert.equal(applyAggregation(Aggregation.MAX, nums), 10);
  });

  test("MEDIAN for odd and even counts", () => {
    assert.equal(applyAggregation(Aggregation.MEDIAN, [1, 2, 3]), 2);
    assert.equal(applyAggregation(Aggregation.MEDIAN, [1, 2, 3, 4]), 2.5);
    assert.equal(applyAggregation(Aggregation.MEDIAN, [3, 1, 2]), 2); // unsorted input
  });

  test("COUNT counts non-blank values; COUNTD counts distinct", () => {
    assert.equal(applyAggregation(Aggregation.COUNT, ["a", "b", "a"]), 3);
    assert.equal(applyAggregation(Aggregation.COUNTD, ["a", "b", "a"]), 2);
    assert.equal(applyAggregation(Aggregation.COUNT, ["a", null, "", "b"]), 2);
  });

  test("nulls are skipped, not treated as zero", () => {
    // AVG of [10, null, 20] is 15, not 10 — SQL semantics.
    assert.equal(applyAggregation(Aggregation.AVG, [10, null, 20]), 15);
    assert.equal(applyAggregation(Aggregation.SUM, [10, null, 20]), 30);
  });

  test("aggregating an empty set is null, but COUNT is 0", () => {
    assert.equal(applyAggregation(Aggregation.SUM, []), null);
    assert.equal(applyAggregation(Aggregation.AVG, []), null);
    assert.equal(applyAggregation(Aggregation.COUNT, []), 0);
    assert.equal(applyAggregation(Aggregation.COUNTD, []), 0);
  });

  test("availableAggregations narrows by type", () => {
    assert.ok(availableAggregations("number").includes(Aggregation.SUM));
    assert.ok(!availableAggregations("string").includes(Aggregation.SUM));
    assert.deepEqual(availableAggregations("string"), [Aggregation.COUNT, Aggregation.COUNTD]);
    assert.ok(availableAggregations("date").includes(Aggregation.MIN));
  });

  test("aggregatedName produces the Tableau pill caption", () => {
    assert.equal(aggregatedName(Aggregation.SUM, "loan_amount"), "SUM(loan_amount)");
  });
});

describe("aggregate: grouping", () => {
  test("groupBy splits on dimension values in first-seen order", () => {
    const groups = groupBy(sales, ["region"]);
    assert.deepEqual(groups.map((g) => g.values.region), ["East", "West", "North"]);
    assert.equal(groups[0].rows.length, 2);
  });

  test("no dimensions means one grand-total group", () => {
    const groups = groupBy(sales, []);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].rows.length, 5);
  });

  test("multiple dimensions group on the combination", () => {
    const groups = groupBy(sales, ["region", "rep"]);
    assert.equal(groups.length, 5); // every region/rep pair is unique here
  });

  test("aggregateRows: SUM by region", () => {
    const out = aggregateRows(sales, {
      dimensions: ["region"],
      measures: [{ field: "amount", aggregation: Aggregation.SUM }],
    });
    assert.equal(out.length, 3);
    assert.deepEqual(
      out.map((r) => [r.region, r["SUM(amount)"]]),
      [["East", 300], ["West", 700], ["North", 50]]
    );
    assert.equal(out[0].__count, 2);
  });

  test("aggregateRows: several measures at once", () => {
    const out = aggregateRows(sales, {
      dimensions: ["region"],
      measures: [
        { field: "amount", aggregation: Aggregation.AVG },
        { field: "rep", aggregation: Aggregation.COUNTD },
      ],
    });
    assert.equal(out[0]["AVG(amount)"], 150);
    assert.equal(out[0]["COUNTD(rep)"], 2);
  });

  test("aggregateRows with no dimensions is the grand total", () => {
    const out = aggregateRows(sales, {
      dimensions: [],
      measures: [{ field: "amount", aggregation: Aggregation.SUM }],
    });
    assert.equal(out.length, 1);
    assert.equal(out[0]["SUM(amount)"], 1050);
  });
});

describe("aggregate: filters", () => {
  test("categorical include keeps only listed members", () => {
    const out = applyFilters(sales, [categoricalFilter("region", ["East", "West"])]);
    assert.equal(out.length, 4);
    assert.ok(out.every((r) => r.region !== "North"));
  });

  test("categorical exclude drops listed members", () => {
    const out = applyFilters(sales, [excludeFilter("region", ["North"])]);
    assert.equal(out.length, 4);
  });

  test("range filter is inclusive by default and can be made exclusive", () => {
    assert.equal(applyFilters(sales, [rangeFilter("amount", 100, 300)]).length, 3);
    assert.equal(
      applyFilters(sales, [rangeFilter("amount", 100, 300, { includeMin: false })]).length,
      2
    );
  });

  test("range filter with an open bound", () => {
    assert.equal(applyFilters(sales, [rangeFilter("amount", 200, null)]).length, 3);
    assert.equal(applyFilters(sales, [rangeFilter("amount", null, 100)]).length, 2);
  });

  test("filters combine with AND", () => {
    const out = applyFilters(sales, [
      categoricalFilter("region", ["East", "West"]),
      rangeFilter("amount", 200, null),
    ]);
    assert.deepEqual(out.map((r) => r.amount), [200, 300, 400]);
  });

  test("top-N ranks on the AGGREGATED value, after grouping", () => {
    // West=700, East=300, North=50 → top 2 keeps West and East.
    const out = aggregateRows(sales, {
      dimensions: ["region"],
      measures: [{ field: "amount", aggregation: Aggregation.SUM }],
      filters: [topNFilter("region", 2, { field: "amount", aggregation: Aggregation.SUM })],
    });
    assert.deepEqual(out.map((r) => r.region).sort(), ["East", "West"]);
  });

  test("top-N ranks a date measure chronologically", () => {
    // "the 2 regions with the most recent activity". MAX(day) is a Date, and a
    // Date must rank on its epoch time. Rank every Date as an untyped tie and
    // the sort is stable, so the FIRST two groups win regardless of their dates.
    const rows = [
      { region: "East", day: "2026-01-01" },
      { region: "West", day: "2026-01-02" },
      { region: "North", day: "2026-01-09" },
    ];
    const typed = coerceRows(rows, inferFields(rows));
    const out = aggregateRows(typed, {
      dimensions: ["region"],
      measures: [{ field: "day", aggregation: Aggregation.MAX }],
      filters: [topNFilter("region", 2, { field: "day", aggregation: Aggregation.MAX })],
    });
    assert.deepEqual(out.map((r) => r.region), ["West", "North"]);
  });

  test("bottom-N inverts the ranking", () => {
    const out = aggregateRows(sales, {
      dimensions: ["region"],
      measures: [{ field: "amount", aggregation: Aggregation.SUM }],
      filters: [
        topNFilter("region", 1, { field: "amount", aggregation: Aggregation.SUM }, { direction: "bottom" }),
      ],
    });
    assert.deepEqual(out.map((r) => r.region), ["North"]);
  });

  test("top-N preserves the original row order, not the ranked order", () => {
    const out = aggregateRows(sales, {
      dimensions: ["region"],
      measures: [{ field: "amount", aggregation: Aggregation.SUM }],
      filters: [topNFilter("region", 2, { field: "amount", aggregation: Aggregation.SUM })],
    });
    assert.deepEqual(out.map((r) => r.region), ["East", "West"]);
  });

  test("top-N limits the MEMBERS of the field it names, not the result rows", () => {
    // Two dimensions on the shelves. CA=1200, TX=600, NY=16 → top-2 STATES keeps
    // CA and TX whole: 2 states x 3 purposes = 6 rows. Rank result rows instead
    // and the two biggest rows are both CA's, so TX vanishes entirely.
    const out = aggregateRows(grants, {
      dimensions: ["state", "purpose"],
      measures: [{ field: "amt", aggregation: Aggregation.SUM }],
      filters: [topNFilter("state", 2, { field: "amt", aggregation: Aggregation.SUM })],
    });
    assert.deepEqual([...new Set(out.map((r) => r.state))].sort(), ["CA", "TX"]);
    assert.equal(out.length, 6);
    assert.deepEqual(
      out.map((r) => `${r.state}/${r.purpose}=${r["SUM(amt)"]}`),
      ["CA/Home=500", "CA/Refi=400", "CA/Improve=300", "TX/Home=250", "TX/Refi=200", "TX/Improve=150"]
    );
  });

  test("top-N ranks members on the whole member, not on their best single row", () => {
    // NY has the single largest row (900), but CA and TX out-total it. A member
    // ranking must aggregate across the member's other dimension first.
    const rows = [
      { state: "CA", purpose: "Home", amt: 500 },
      { state: "CA", purpose: "Refi", amt: 500 },
      { state: "TX", purpose: "Home", amt: 490 },
      { state: "TX", purpose: "Refi", amt: 490 },
      { state: "NY", purpose: "Home", amt: 900 },
    ];
    const out = aggregateRows(rows, {
      dimensions: ["state", "purpose"],
      measures: [{ field: "amt", aggregation: Aggregation.SUM }],
      filters: [topNFilter("state", 2, { field: "amt", aggregation: Aggregation.SUM })],
    });
    assert.deepEqual([...new Set(out.map((r) => r.state))], ["CA", "TX"]);
  });

  test("bottom-N with two dimensions keeps the whole losing member", () => {
    const out = aggregateRows(grants, {
      dimensions: ["state", "purpose"],
      measures: [{ field: "amt", aggregation: Aggregation.SUM }],
      filters: [
        topNFilter("state", 1, { field: "amt", aggregation: Aggregation.SUM }, { direction: "bottom" }),
      ],
    });
    assert.deepEqual([...new Set(out.map((r) => r.state))], ["NY"]);
    assert.equal(out.length, 3);
  });

  test("filter builders record their type", () => {
    assert.equal(categoricalFilter("a", []).type, FilterType.CATEGORICAL);
    assert.equal(rangeFilter("a", 0, 1).type, FilterType.RANGE);
    assert.equal(topNFilter("a", 1, { field: "b" }).type, FilterType.TOP_N);
    assert.equal(topNFilter("a", 1, { field: "b" }).by.aggregation, Aggregation.SUM);
  });
});

describe("aggregate: sorting and distinct", () => {
  test("sortRows numerically, both directions", () => {
    const rows = [{ v: 10 }, { v: 2 }, { v: 33 }];
    assert.deepEqual(sortRows(rows, { field: "v", direction: "asc" }).map((r) => r.v), [2, 10, 33]);
    assert.deepEqual(sortRows(rows, { field: "v", direction: "desc" }).map((r) => r.v), [33, 10, 2]);
  });

  test("sortRows orders dates chronologically, both directions", () => {
    // A Date is neither a number nor a string, so a lexical fallback would order
    // these by the weekday prefix of String(Date) — Fri, Mon, Sat, Sun, Thu...
    const day = (n) => new Date(`2026-01-0${n}T00:00:00.000Z`);
    const rows = [{ d: day(3) }, { d: day(1) }, { d: day(2) }];
    assert.deepEqual(
      sortRows(rows, { field: "d", direction: "asc" }).map((r) => r.d.getUTCDate()),
      [1, 2, 3]
    );
    assert.deepEqual(
      sortRows(rows, { field: "d", direction: "desc" }).map((r) => r.d.getUTCDate()),
      [3, 2, 1]
    );
  });

  test("sortRows: a full week of dates sorts by date, not by weekday name", () => {
    const rows = [5, 6, 7, 8, 9, 10, 11].map((n) => ({
      d: new Date(`2026-01-${String(n).padStart(2, "0")}T00:00:00.000Z`),
    }));
    const shuffled = [rows[5], rows[1], rows[6], rows[0], rows[4], rows[2], rows[3]];
    assert.deepEqual(
      sortRows(shuffled, { field: "d", direction: "asc" }).map((r) => r.d.getUTCDate()),
      [5, 6, 7, 8, 9, 10, 11]
    );
  });

  test("sortRows lexically for strings", () => {
    const rows = [{ v: "b" }, { v: "a" }, { v: "c" }];
    assert.deepEqual(sortRows(rows, { field: "v", direction: "asc" }).map((r) => r.v), ["a", "b", "c"]);
  });

  test("sortRows does not mutate its input", () => {
    const rows = [{ v: 2 }, { v: 1 }];
    sortRows(rows, { field: "v" });
    assert.deepEqual(rows.map((r) => r.v), [2, 1]);
  });

  test("aggregateRows applies sort to the aggregated column", () => {
    const out = aggregateRows(sales, {
      dimensions: ["region"],
      measures: [{ field: "amount", aggregation: Aggregation.SUM }],
      sort: { field: "SUM(amount)", direction: "desc" },
    });
    assert.deepEqual(out.map((r) => r.region), ["West", "East", "North"]);
  });

  test("distinctValues in first-seen order", () => {
    assert.deepEqual(distinctValues(sales, "region"), ["East", "West", "North"]);
  });
});

// ===========================================================================
describe("fields: calculated fields (safe expression evaluator)", () => {
  const evalIn = (src, row = {}) => evaluateExpression(parseExpression(src), row);

  test("arithmetic and precedence", () => {
    assert.equal(evalIn("1 + 2 * 3"), 7);
    assert.equal(evalIn("(1 + 2) * 3"), 9);
    assert.equal(evalIn("10 / 4"), 2.5);
    assert.equal(evalIn("10 % 3"), 1);
    assert.equal(evalIn("-5 + 2"), -3);
  });

  test("division by zero yields null rather than Infinity", () => {
    assert.equal(evalIn("1 / 0"), null);
  });

  test("field references, bracketed and bare", () => {
    assert.equal(evalIn("[loan_amount] / [income]", { loan_amount: 200, income: 50 }), 4);
    assert.equal(evalIn("income * 2", { income: 21 }), 42);
  });

  test("a missing field is null, not a crash", () => {
    assert.equal(evalIn("[nope]", {}), null);
  });

  test("comparisons and = as equality", () => {
    assert.equal(evalIn('[approved] = "APPROVED"', { approved: "APPROVED" }), true);
    assert.equal(evalIn('[approved] = "APPROVED"', { approved: "DENIED" }), false);
    assert.equal(evalIn("[x] <> 1", { x: 2 }), true);
    assert.equal(evalIn("[x] >= 5", { x: 5 }), true);
    assert.equal(evalIn("[x] < 5", { x: 6 }), false);
  });

  test("AND / OR / NOT", () => {
    assert.equal(evalIn("[a] > 1 AND [b] > 1", { a: 2, b: 2 }), true);
    assert.equal(evalIn("[a] > 1 AND [b] > 1", { a: 2, b: 0 }), false);
    assert.equal(evalIn("[a] > 1 OR [b] > 1", { a: 0, b: 2 }), true);
    assert.equal(evalIn("NOT [a] > 1", { a: 0 }), true);
  });

  test("IF and the function library", () => {
    assert.equal(evalIn('IF([x] > 5, "big", "small")', { x: 10 }), "big");
    assert.equal(evalIn('IF([x] > 5, "big", "small")', { x: 1 }), "small");
    assert.equal(evalIn("ABS(-3)"), 3);
    assert.equal(evalIn("ROUND(3.14159, 2)"), 3.14);
    assert.equal(evalIn("ROUND(3.7)"), 4);
    assert.equal(evalIn("MIN(3, 1, 2)"), 1);
    assert.equal(evalIn("MAX(3, 1, 2)"), 3);
    assert.equal(evalIn('UPPER("abc")'), "ABC");
    assert.equal(evalIn('LEN("abcd")'), 4);
    assert.equal(evalIn('CONTAINS("hello world", "world")'), true);
    assert.equal(evalIn("ISNULL([nope])", {}), true);
    assert.equal(evalIn("FLOOR(2.9)"), 2);
    assert.equal(evalIn("CEILING(2.1)"), 3);
  });

  test("string concatenation with +", () => {
    assert.equal(evalIn('"a" + "b"'), "ab");
    assert.equal(evalIn('[race] + " applicant"', { race: "Black" }), "Black applicant");
  });

  test("literals TRUE / FALSE / NULL", () => {
    assert.equal(evalIn("TRUE"), true);
    assert.equal(evalIn("IF(FALSE, 1, 2)"), 2);
    assert.equal(evalIn("ISNULL(NULL)"), true);
  });

  test("REJECTS code injection — the evaluator is not eval", () => {
    // Anything that reaches for the host environment must fail to parse.
    for (const src of [
      "process.exit(1)",
      "constructor.constructor('return 1')()",
      "require('fs')",
      "[x].toString()",
      "1; process.exit(1)",
      "({}).constructor",
    ]) {
      assert.throws(() => parseExpression(src), (err) => err instanceof SyntaxError, `should reject: ${src}`);
    }
  });

  test("a bare identifier is a FIELD, never a JavaScript global", () => {
    // `globalThis` parses fine — as a reference to a column named "globalThis",
    // which does not exist, so it is null. It must never be the real global.
    for (const src of ["globalThis", "process", "window", "document", "this.constructor"]) {
      const result = evaluateExpression(parseExpression(src), {});
      assert.equal(result, null, `${src} must resolve to a null field, got ${typeof result}`);
    }
    // And when such a column DOES exist, it is just data.
    assert.equal(evalIn("globalThis", { globalThis: 42 }), 42);
  });

  test("field lookup reads OWN properties only — no prototype leak", () => {
    // A plain row[name] would hand back Object/Function via the prototype chain.
    for (const src of ["constructor", "toString", "__proto__", "valueOf", "hasOwnProperty"]) {
      const result = evaluateExpression(parseExpression(`[${src}]`), {});
      assert.equal(result, null, `[${src}] leaked a ${typeof result}`);
    }
    // An own property of that name is still readable — it is legitimate data.
    assert.equal(evalIn("[constructor]", { constructor: "Acme Corp" }), "Acme Corp");
  });

  test("an unknown function is a syntax error, not a silent null", () => {
    assert.throws(() => parseExpression("HACK(1)"), SyntaxError);
  });

  test("malformed formulas throw SyntaxError", () => {
    assert.throws(() => parseExpression("1 +"), SyntaxError);
    assert.throws(() => parseExpression("(1 + 2"), SyntaxError);
    assert.throws(() => parseExpression("[unclosed"), SyntaxError);
    assert.throws(() => parseExpression('"unterminated'), SyntaxError);
    assert.throws(() => parseExpression("1 @ 2"), SyntaxError);
  });

  test("createCalculatedField parses eagerly and defaults to a measure", () => {
    const f = createCalculatedField("ratio", "[loan_amount] / [income]");
    assert.equal(f.calculated, true);
    assert.equal(f.role, FieldRole.MEASURE);
    assert.equal(f.type, FieldType.NUMBER);
    assert.equal(f.defaultAggregation, Aggregation.SUM);
    assert.throws(() => createCalculatedField("bad", "1 +"), SyntaxError);
  });

  test("applyCalculatedFields materialises onto rows without mutating input", () => {
    const rows = [{ a: 1 }, { a: 2 }];
    const out = applyCalculatedFields(rows, [createCalculatedField("double", "[a] * 2")]);
    assert.deepEqual(out.map((r) => r.double), [2, 4]);
    assert.equal(rows[0].double, undefined);
  });

  test("a later calculated field can reference an earlier one", () => {
    const out = applyCalculatedFields(
      [{ a: 2 }],
      [createCalculatedField("b", "[a] * 10"), createCalculatedField("c", "[b] + 1")]
    );
    assert.equal(out[0].c, 21);
  });

  test("validateExpression reports references and unknown fields", () => {
    const ok = validateExpression("[a] + [b]");
    assert.equal(ok.valid, true);
    assert.deepEqual(ok.references, ["a", "b"]);

    const bad = validateExpression("1 +");
    assert.equal(bad.valid, false);
    assert.ok(bad.error);

    const unknown = validateExpression("[nope] + 1", [makeField("a", FieldType.NUMBER)]);
    assert.equal(unknown.valid, false);
    assert.match(unknown.error, /Unknown field/);
  });
});

// ===========================================================================
describe("scales: ticks and domains", () => {
  test("extent ignores non-numbers", () => {
    assert.deepEqual(extent([3, 1, 2]), [1, 3]);
    assert.deepEqual(extent([3, null, "x", 1]), [1, 3]);
    assert.deepEqual(extent([]), [null, null]);
  });

  test("niceStep picks 1/2/5/10 times a power of ten", () => {
    assert.equal(niceStep(100, 5), 20);
    assert.equal(niceStep(10, 5), 2);
    assert.equal(niceStep(1, 5), 0.2);
    assert.equal(niceStep(50, 5), 10);
  });

  test("niceDomain rounds outward to whole steps", () => {
    assert.deepEqual(niceDomain(0, 95, 5), [0, 100]);
    assert.deepEqual(niceDomain(3, 97, 5), [0, 100]);
  });

  test("niceDomain pads a flat domain so the mark stays drawable", () => {
    assert.deepEqual(niceDomain(0, 0), [0, 1]);
    const [lo, hi] = niceDomain(5, 5);
    assert.ok(lo < 5 && hi > 5);
  });

  test("generateTicks are evenly spaced and within bounds", () => {
    assert.deepEqual(generateTicks(0, 100, 5), [0, 20, 40, 60, 80, 100]);
    assert.deepEqual(generateTicks(0, 10, 5), [0, 2, 4, 6, 8, 10]);
  });

  test("generateTicks avoids floating-point noise", () => {
    // The naive loop produces 0.30000000000000004 here.
    assert.deepEqual(generateTicks(0, 1, 5), [0, 0.2, 0.4, 0.6, 0.8, 1]);
    for (const t of generateTicks(0, 0.9, 5)) {
      assert.equal(String(t).length <= 4, true, `noisy tick: ${t}`);
    }
  });

  test("generateTicks on a degenerate domain", () => {
    assert.deepEqual(generateTicks(5, 5), [5]);
  });
});

describe("scales: linear", () => {
  const s = linearScale({ domain: [0, 100], range: [0, 200] });

  test("maps domain to range linearly", () => {
    assert.equal(s.scale(0), 0);
    assert.equal(s.scale(50), 100);
    assert.equal(s.scale(100), 200);
  });

  test("invert round-trips", () => {
    assert.equal(s.invert(100), 50);
  });

  test("is a linear scale with ticks", () => {
    assert.equal(s.type, ScaleType.LINEAR);
    assert.deepEqual(s.ticks, [0, 20, 40, 60, 80, 100]);
  });

  test("zero:true extends the domain to include the origin", () => {
    const z = linearScale({ domain: [20, 80], range: [0, 100], zero: true });
    assert.equal(z.domain[0], 0);
  });

  test("nice:false keeps the raw domain", () => {
    const raw = linearScale({ domain: [3, 97], range: [0, 100], nice: false });
    assert.deepEqual(raw.domain, [3, 97]);
  });

  test("handles an inverted range (the y axis)", () => {
    const y = linearScale({ domain: [0, 100], range: [400, 0] });
    assert.equal(y.scale(0), 400); // zero at the bottom of the screen
    assert.equal(y.scale(100), 0); // max at the top
  });

  test("zeroPosition is where bars start", () => {
    const y = linearScale({ domain: [0, 100], range: [400, 0] });
    assert.equal(y.zeroPosition, 400);
  });

  test("a non-numeric value scales to null", () => {
    assert.equal(s.scale("abc"), null);
    assert.equal(s.scale(null), null);
  });
});

describe("scales: band", () => {
  const b = bandScale({ domain: ["A", "B", "C"], range: [0, 300], padding: 0 });

  test("gives every member an equal slot", () => {
    assert.equal(b.type, ScaleType.BAND);
    assert.equal(b.bandwidth, 100);
    assert.equal(b.scale("A"), 0);
    assert.equal(b.scale("B"), 100);
    assert.equal(b.scale("C"), 200);
  });

  test("center is the middle of the band", () => {
    assert.equal(b.center("A"), 50);
  });

  test("padding shrinks the band and centres it in its slot", () => {
    const p = bandScale({ domain: ["A", "B"], range: [0, 200], padding: 0.2 });
    assert.equal(p.step, 100);
    assert.equal(p.bandwidth, 80);
    assert.equal(p.scale("A"), 10); // centred: (100-80)/2
  });

  test("an unknown member scales to null", () => {
    assert.equal(b.scale("ZZ"), null);
    assert.equal(b.center("ZZ"), null);
  });

  test("handles an inverted range, centring bands correctly", () => {
    const y = bandScale({ domain: ["A", "B"], range: [400, 0], padding: 0 });
    assert.equal(y.bandwidth, 200);
    // A occupies the bottom half: centre at 300.
    assert.equal(y.center("A"), 300);
    assert.equal(y.center("B"), 100);
  });

  test("an empty domain does not divide by zero", () => {
    const e = bandScale({ domain: [], range: [0, 100] });
    assert.ok(Number.isFinite(e.bandwidth));
  });
});

describe("scales: time", () => {
  const t = timeScale({
    domain: [new Date("2026-01-01"), new Date("2026-01-31")],
    range: [0, 300],
  });

  test("maps dates into pixel space", () => {
    assert.equal(t.type, ScaleType.TIME);
    assert.equal(t.scale(new Date("2026-01-01")), 0);
    assert.equal(t.scale(new Date("2026-01-31")), 300);
    assert.equal(Math.round(t.scale(new Date("2026-01-16"))), 150);
  });

  test("ticks are Dates inside the domain", () => {
    assert.ok(t.ticks.length > 0);
    assert.ok(t.ticks.every((d) => d instanceof Date));
    assert.ok(t.ticks.every((d) => d >= t.domain[0] && d <= t.domain[1]));
  });

  test("invert returns a Date", () => {
    assert.ok(t.invert(0) instanceof Date);
  });
});

describe("scales: formatTick", () => {
  test("abbreviates large numbers", () => {
    assert.equal(formatTick(1500), "1.5K");
    assert.equal(formatTick(2500000), "2.5M");
    assert.equal(formatTick(1e9), "1B");
    assert.equal(formatTick(42), "42");
  });

  test("percent and currency", () => {
    assert.equal(formatTick(0.86, { type: "percent" }), "86%");
    assert.equal(formatTick(1500, { type: "currency" }), "$1.5K");
  });

  test("dates and junk", () => {
    assert.equal(formatTick(new Date("2026-08-12")), "2026-08-12");
    assert.equal(formatTick(NaN), "");
  });
});

describe("scales: discrete vs continuous decides the axis type", () => {
  test("a discrete pill produces a BAND scale", () => {
    const enc = createEncoding(dimField("race"));
    const s = scaleForEncoding(enc, { values: ["A", "B"], domain: ["A", "B"] }, [0, 100]);
    assert.equal(s.type, ScaleType.BAND);
  });

  test("a continuous pill produces a LINEAR scale", () => {
    const enc = createEncoding(measureField("income"));
    const s = scaleForEncoding(enc, { values: [1, 2, 3] }, [0, 100]);
    assert.equal(s.type, ScaleType.LINEAR);
  });

  test("a continuous DATE pill produces a TIME scale", () => {
    const enc = createEncoding(makeField("day", FieldType.DATE), { discrete: false });
    const s = scaleForEncoding(enc, { values: [new Date("2026-01-01"), new Date("2026-02-01")] }, [0, 100]);
    assert.equal(s.type, ScaleType.TIME);
  });

  test("a DATE pill left discrete still produces a BAND scale", () => {
    const enc = createEncoding(makeField("day", FieldType.DATE));
    const s = scaleForEncoding(enc, { values: [], domain: ["2026-01-01"] }, [0, 100]);
    assert.equal(s.type, ScaleType.BAND);
  });
});

// ===========================================================================
describe("spec: encodings, pills and the discrete/continuous rule", () => {
  test("a dimension is discrete and blue", () => {
    const e = createEncoding(dimField("race"));
    assert.equal(e.discrete, true);
    assert.equal(e.pillColor, PillColor.DISCRETE);
    assert.equal(e.aggregation, null);
    assert.equal(isDiscrete(e), true);
    assert.equal(isContinuous(e), false);
  });

  test("a measure aggregates by default, making it continuous and green", () => {
    const e = createEncoding(measureField("loan_amount"));
    assert.equal(e.aggregation, Aggregation.SUM);
    assert.equal(e.discrete, false);
    assert.equal(e.pillColor, PillColor.CONTINUOUS);
  });

  test("resolveDiscrete: aggregation implies continuous; explicit wins", () => {
    assert.equal(resolveDiscrete({ role: FieldRole.MEASURE, aggregation: "SUM" }), false);
    assert.equal(resolveDiscrete({ role: FieldRole.DIMENSION, aggregation: null }), true);
    // The override: SUM(x) as a blue pill, or year as a green axis.
    assert.equal(resolveDiscrete({ role: FieldRole.MEASURE, aggregation: "SUM", discrete: true }), true);
    assert.equal(resolveDiscrete({ role: FieldRole.DIMENSION, aggregation: null, discrete: false }), false);
  });

  test("a dimension can be aggregated with COUNT, becoming continuous", () => {
    const e = createEncoding(dimField("applicant_id"), { aggregation: Aggregation.COUNT });
    assert.equal(e.discrete, false);
    assert.equal(encodingLabel(e), "COUNT(applicant_id)");
  });

  test("a measure can be disaggregated with aggregation:null", () => {
    const e = createEncoding(measureField("income"), { aggregation: null });
    assert.equal(e.aggregation, null);
    assert.equal(e.discrete, false); // still a measure → continuous axis
  });

  test("encodingLabel and encodingColumn", () => {
    assert.equal(encodingLabel(createEncoding(dimField("race"))), "race");
    assert.equal(encodingColumn(createEncoding(measureField("income"))), "SUM(income)");
    assert.equal(encodingLabel(createEncoding(dimField("race"), { alias: "Race Group" })), "Race Group");
    // The alias is cosmetic — the data column is unchanged.
    assert.equal(encodingColumn(createEncoding(dimField("race"), { alias: "Race Group" })), "race");
  });

  test("createEncoding rejects a field with no name", () => {
    assert.throws(() => createEncoding({}), /requires a field/);
  });
});

describe("spec: shelves", () => {
  test("putOnShelf appends to multi-shelves and replaces on single-shelves", () => {
    let spec = createSpec();
    spec = putOnShelf(spec, Shelf.ROWS, createEncoding(dimField("a")));
    spec = putOnShelf(spec, Shelf.ROWS, createEncoding(dimField("b")));
    assert.deepEqual(spec.rows.map((e) => e.field), ["a", "b"]);

    spec = putOnShelf(spec, Shelf.COLOR, createEncoding(dimField("c")));
    spec = putOnShelf(spec, Shelf.COLOR, createEncoding(dimField("d")));
    assert.equal(spec.color.field, "d");
  });

  test("specs are immutable — the UI gets undo for free", () => {
    const spec = createSpec();
    const next = putOnShelf(spec, Shelf.ROWS, createEncoding(dimField("a")));
    assert.equal(spec.rows.length, 0);
    assert.equal(next.rows.length, 1);
  });

  test("removeFromShelf by field name and by index", () => {
    let spec = createSpec();
    spec = putOnShelf(spec, Shelf.ROWS, createEncoding(dimField("a")));
    spec = putOnShelf(spec, Shelf.ROWS, createEncoding(dimField("b")));
    assert.deepEqual(removeFromShelf(spec, Shelf.ROWS, "a").rows.map((e) => e.field), ["b"]);
    assert.deepEqual(removeFromShelf(spec, Shelf.ROWS, 1).rows.map((e) => e.field), ["a"]);

    spec = putOnShelf(spec, Shelf.COLOR, createEncoding(dimField("c")));
    assert.equal(removeFromShelf(spec, Shelf.COLOR).color, null);
  });

  test("an unknown shelf throws", () => {
    assert.throws(() => putOnShelf(createSpec(), "nope", createEncoding(dimField("a"))), /Unknown shelf/);
  });

  test("setAggregation re-derives discrete/continuous and the pill colour", () => {
    let spec = putOnShelf(createSpec(), Shelf.ROWS, createEncoding(dimField("applicant_id")));
    assert.equal(spec.rows[0].discrete, true);

    spec = setAggregation(spec, Shelf.ROWS, "applicant_id", Aggregation.COUNT);
    assert.equal(spec.rows[0].aggregation, Aggregation.COUNT);
    assert.equal(spec.rows[0].discrete, false);
    assert.equal(spec.rows[0].pillColor, PillColor.CONTINUOUS);
  });

  test("setDiscrete forces a pill blue or green", () => {
    let spec = putOnShelf(createSpec(), Shelf.COLUMNS, createEncoding(measureField("income")));
    assert.equal(spec.columns[0].discrete, false);
    spec = setDiscrete(spec, Shelf.COLUMNS, "income", true);
    assert.equal(spec.columns[0].discrete, true);
    assert.equal(spec.columns[0].pillColor, PillColor.DISCRETE);
  });

  test("addFilter / removeFilter", () => {
    let spec = addFilter(createSpec(), categoricalFilter("race", ["Black"]));
    assert.equal(spec.filters.length, 1);
    spec = removeFilter(spec, "race");
    assert.equal(spec.filters.length, 0);
  });

  test("allEncodings collects pills from every shelf but Filters", () => {
    let spec = createSpec();
    spec = putOnShelf(spec, Shelf.ROWS, createEncoding(measureField("income")));
    spec = putOnShelf(spec, Shelf.COLUMNS, createEncoding(dimField("race")));
    spec = putOnShelf(spec, Shelf.COLOR, createEncoding(dimField("gender")));
    spec = addFilter(spec, categoricalFilter("approved", ["APPROVED"]));
    assert.deepEqual(allEncodings(spec).map((x) => x.encoding.field).sort(), ["gender", "income", "race"]);
  });
});

describe("spec: deriving the query", () => {
  test("specDimensions collects discrete pills; specMeasures collects aggregated ones", () => {
    let spec = createSpec();
    spec = putOnShelf(spec, Shelf.COLUMNS, createEncoding(dimField("race")));
    spec = putOnShelf(spec, Shelf.ROWS, createEncoding(measureField("loan_amount")));
    spec = putOnShelf(spec, Shelf.COLOR, createEncoding(dimField("gender")));

    assert.deepEqual(specDimensions(spec), ["race", "gender"]);
    assert.deepEqual(specMeasures(spec), [{ field: "loan_amount", aggregation: Aggregation.SUM }]);
  });

  test("a pill on Detail adds a dimension without drawing an axis", () => {
    let spec = putOnShelf(createSpec(), Shelf.ROWS, createEncoding(measureField("income")));
    spec = putOnShelf(spec, Shelf.DETAIL, createEncoding(dimField("zip_code")));
    assert.deepEqual(specDimensions(spec), ["zip_code"]);
  });

  test("dimensions and measures are de-duplicated", () => {
    let spec = createSpec();
    spec = putOnShelf(spec, Shelf.COLUMNS, createEncoding(dimField("race")));
    spec = putOnShelf(spec, Shelf.COLOR, createEncoding(dimField("race")));
    spec = putOnShelf(spec, Shelf.ROWS, createEncoding(measureField("income")));
    spec = putOnShelf(spec, Shelf.SIZE, createEncoding(measureField("income")));
    assert.deepEqual(specDimensions(spec), ["race"]);
    assert.equal(specMeasures(spec).length, 1);
  });

  test("the same field at two aggregations is two measures", () => {
    let spec = putOnShelf(createSpec(), Shelf.ROWS, createEncoding(measureField("income")));
    spec = putOnShelf(spec, Shelf.COLUMNS, createEncoding(measureField("income"), { aggregation: Aggregation.AVG }));
    assert.equal(specMeasures(spec).length, 2);
  });
});

describe("marks: Show Me validity rules", () => {
  const barSpec = () => {
    let s = createSpec();
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(dimField("race")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(measureField("loan_amount")));
    return s;
  };
  const scatterSpec = () => {
    let s = createSpec();
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(measureField("income")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(measureField("loan_amount")));
    return s;
  };

  test("classifyShelves summarises the configuration", () => {
    const c = classifyShelves(barSpec());
    assert.equal(c.discreteCount, 1);
    assert.equal(c.continuousCount, 1);
    assert.equal(c.crossed, true);
    assert.equal(c.dualContinuous, false);
  });

  test("bar needs a dimension crossed with a measure", () => {
    assert.equal(isMarkValid(barSpec(), MarkType.BAR), true);
    // Two measures is not a bar shape.
    assert.equal(isMarkValid(scatterSpec(), MarkType.BAR), false);
    assert.match(checkMark(scatterSpec(), MarkType.BAR).reason, /dimension on one axis/);
  });

  test("scatter needs a continuous measure on BOTH axes", () => {
    assert.equal(isMarkValid(scatterSpec(), MarkType.SCATTER), true);
    assert.equal(isMarkValid(barSpec(), MarkType.SCATTER), false);
    assert.match(checkMark(barSpec(), MarkType.SCATTER).reason, /both Rows and Columns/);
  });

  test("map needs a geographic field", () => {
    assert.equal(isMarkValid(barSpec(), MarkType.MAP), false);
    let geo = putOnShelf(createSpec(), Shelf.DETAIL, createEncoding(dimField("zip_code")));
    assert.equal(isMarkValid(geo, MarkType.MAP), true);
  });

  test("isGeographic recognises the usual suspects", () => {
    assert.equal(isGeographic("zip_code"), true);
    assert.equal(isGeographic("state"), true);
    assert.equal(isGeographic("latitude"), true);
    assert.equal(isGeographic("loan_amount"), false);
  });

  test("text is valid whenever anything is on a shelf; nothing is valid when empty", () => {
    assert.equal(isMarkValid(createSpec(), MarkType.TEXT), false);
    assert.deepEqual(validMarkTypes(createSpec()), []);
    assert.equal(isMarkValid(barSpec(), MarkType.TEXT), true);
  });

  test("validMarkTypes lists exactly what fits", () => {
    const valid = validMarkTypes(barSpec());
    assert.deepEqual(valid.sort(), [MarkType.AREA, MarkType.BAR, MarkType.LINE, MarkType.TEXT].sort());
    assert.ok(!valid.includes(MarkType.SCATTER));
  });

  test("an unknown mark type is invalid, not a crash", () => {
    assert.equal(isMarkValid(barSpec(), "pie"), false);
  });

  test("isPathMark", () => {
    assert.equal(isPathMark(MarkType.LINE), true);
    assert.equal(isPathMark(MarkType.AREA), true);
    assert.equal(isPathMark(MarkType.BAR), false);
  });
});

describe("marks: Show Me defaults", () => {
  test("dimension + measure defaults to bar", () => {
    let s = putOnShelf(createSpec(), Shelf.COLUMNS, createEncoding(dimField("race")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(measureField("loan_amount")));
    assert.equal(bestMarkType(s), MarkType.BAR);
  });

  test("a date dimension + measure defaults to line", () => {
    let s = putOnShelf(createSpec(), Shelf.COLUMNS, createEncoding(makeField("day", FieldType.DATE)));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(measureField("amount")));
    assert.equal(bestMarkType(s), MarkType.LINE);
  });

  test("two measures default to scatter", () => {
    let s = putOnShelf(createSpec(), Shelf.COLUMNS, createEncoding(measureField("income")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(measureField("loan_amount")));
    assert.equal(bestMarkType(s), MarkType.SCATTER);
  });

  test("dimensions only default to a text table", () => {
    const s = putOnShelf(createSpec(), Shelf.ROWS, createEncoding(dimField("race")));
    assert.equal(bestMarkType(s), MarkType.TEXT);
  });

  test("an empty spec defaults to a text table", () => {
    assert.equal(bestMarkType(createSpec()), MarkType.TEXT);
  });

  test("a geographic field does not hijack the default", () => {
    let s = putOnShelf(createSpec(), Shelf.COLUMNS, createEncoding(dimField("zip_code")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(measureField("loan_amount")));
    assert.equal(bestMarkType(s), MarkType.BAR);
  });

  test("showMe returns the panel state with reasons for disabled options", () => {
    let s = putOnShelf(createSpec(), Shelf.COLUMNS, createEncoding(dimField("race")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(measureField("loan_amount")));
    const panel = showMe(s);
    assert.equal(panel.recommended, MarkType.BAR);
    assert.ok(panel.valid.includes(MarkType.BAR));

    const scatter = panel.options.find((o) => o.mark === MarkType.SCATTER);
    assert.equal(scatter.valid, false);
    assert.ok(scatter.reason.length > 0);
    assert.equal(scatter.label, MARK_LABELS[MarkType.SCATTER]);
  });

  test("resolveMark falls back to Show Me when the spec says Automatic", () => {
    let s = putOnShelf(createSpec(), Shelf.COLUMNS, createEncoding(dimField("race")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(measureField("loan_amount")));
    assert.equal(s.mark, null);
    assert.equal(resolveMark(s), MarkType.BAR);
    assert.equal(resolveMark({ ...s, mark: MarkType.LINE }), MarkType.LINE);
  });
});

// ===========================================================================
describe("spec: validation", () => {
  const fields = inferFields(hmdaRows);

  test("an empty spec is invalid", () => {
    const r = validateSpec(createSpec());
    assert.equal(r.valid, false);
    assert.match(r.errors[0], /at least one field/);
  });

  test("a valid bar spec passes clean", () => {
    let s = putOnShelf(createSpec(), Shelf.COLUMNS, createEncoding(findField(fields, "race")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "loan_amount")));
    s = { ...s, mark: MarkType.BAR };
    const r = validateSpec(s, fields);
    assert.deepEqual(r.errors, []);
    assert.equal(r.valid, true);
  });

  test("an unknown field is an error", () => {
    const s = putOnShelf(createSpec(), Shelf.ROWS, createEncoding(dimField("nonexistent")));
    const r = validateSpec(s, fields);
    assert.equal(r.valid, false);
    assert.match(r.errors[0], /Unknown field "nonexistent"/);
  });

  test("you cannot SUM a string dimension", () => {
    const s = putOnShelf(createSpec(), Shelf.ROWS, createEncoding(dimField("race"), { aggregation: Aggregation.SUM }));
    const r = validateSpec(s, fields);
    assert.equal(r.valid, false);
    assert.match(r.errors[0], /Cannot SUM the dimension "race"/);
  });

  test("but COUNT on a dimension is fine", () => {
    let s = putOnShelf(createSpec(), Shelf.COLUMNS, createEncoding(findField(fields, "race")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "applicant_id"), { aggregation: Aggregation.COUNT }));
    assert.equal(validateSpec(s, fields).valid, true);
  });

  test("an impossible mark type is an error", () => {
    let s = putOnShelf(createSpec(), Shelf.COLUMNS, createEncoding(findField(fields, "race")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "loan_amount")));
    const r = validateSpec({ ...s, mark: MarkType.SCATTER }, fields);
    assert.equal(r.valid, false);
    assert.match(r.errors[0], /Scatter needs/);
  });

  test("a filter on an unknown field is an error", () => {
    let s = putOnShelf(createSpec(), Shelf.ROWS, createEncoding(findField(fields, "loan_amount")));
    s = addFilter(s, categoricalFilter("bogus", ["x"]));
    assert.match(validateSpec(s, fields).errors[0], /unknown field "bogus"/);
  });

  test("no measure on an axis is a warning, not an error", () => {
    const s = putOnShelf(createSpec(), Shelf.ROWS, createEncoding(findField(fields, "race")));
    const r = validateSpec(s, fields);
    assert.equal(r.valid, true);
    assert.match(r.warnings[0], /text table/);
  });

  test("a non-object spec is rejected", () => {
    assert.equal(validateSpec(null).valid, false);
  });

  test("calculated fields count as known fields", () => {
    const calc = createCalculatedField("is_approved", 'IF([approved] = "APPROVED", 1, 0)');
    let s = createSpec({ calculatedFields: [calc] });
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(findField(fields, "race")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(calc, { aggregation: Aggregation.AVG }));
    assert.equal(validateSpec(s, fields).valid, true);
  });
});

describe("spec: serialization", () => {
  const build = () => {
    let s = createSpec({ title: "Approval rate by race" });
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(dimField("race")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(measureField("loan_amount"), { aggregation: Aggregation.AVG }));
    s = putOnShelf(s, Shelf.COLOR, createEncoding(dimField("gender")));
    s = addFilter(s, categoricalFilter("approved", ["APPROVED"]));
    return { ...s, mark: MarkType.BAR };
  };

  test("serializes to plain JSON", () => {
    const json = serializeSpec(build());
    const parsed = JSON.parse(json);
    assert.equal(parsed.version, 1);
    assert.equal(parsed.title, "Approval rate by race");
    assert.equal(parsed.mark, "bar");
    assert.equal(parsed.columns[0].field, "race");
    assert.equal(parsed.rows[0].aggregation, "AVG");
    assert.equal(parsed.color.field, "gender");
    assert.equal(parsed.filters[0].include[0], "APPROVED");
  });

  test("drops derived fields so fixtures stay stable and diffable", () => {
    const parsed = JSON.parse(serializeSpec(build()));
    assert.equal(parsed.columns[0].pillColor, undefined);
  });

  test("round-trips through deserializeSpec", () => {
    const original = build();
    const back = deserializeSpec(serializeSpec(original));
    assert.equal(back.title, original.title);
    assert.equal(back.mark, original.mark);
    assert.deepEqual(back.columns.map((e) => e.field), ["race"]);
    assert.equal(back.rows[0].aggregation, Aggregation.AVG);
    assert.equal(back.filters.length, 1);
  });

  test("deserialize re-derives the pill colour that serialize dropped", () => {
    const back = deserializeSpec(serializeSpec(build()));
    assert.equal(back.columns[0].pillColor, PillColor.DISCRETE);
    assert.equal(back.rows[0].pillColor, PillColor.CONTINUOUS);
  });

  test("serialize → deserialize → serialize is stable", () => {
    const once = serializeSpec(build());
    assert.equal(serializeSpec(deserializeSpec(once)), once);
  });

  test("calculated fields survive the round trip and stay usable", () => {
    const calc = createCalculatedField("ratio", "[loan_amount] / [income]");
    const spec = createSpec({ calculatedFields: [calc] });
    const back = deserializeSpec(serializeSpec(spec));
    assert.equal(back.calculatedFields[0].expression, "[loan_amount] / [income]");
    // The AST is not serialized, so applyCalculatedFields must re-parse it.
    const rows = applyCalculatedFields([{ loan_amount: 10, income: 5 }], back.calculatedFields);
    assert.equal(rows[0].ratio, 2);
  });

  test("accepts an already-parsed object and rejects bad payloads", () => {
    assert.equal(deserializeSpec(JSON.parse(serializeSpec(build()))).mark, MarkType.BAR);
    assert.throws(() => deserializeSpec("{not json"), SyntaxError);
    assert.throws(() => deserializeSpec(null), /Invalid spec payload/);
    assert.throws(() => deserializeSpec({ version: 99 }), /Unsupported spec version/);
  });

  test("pretty printing is available for lesson fixtures", () => {
    assert.ok(serializeSpec(build(), { pretty: true }).includes("\n"));
  });
});

describe("spec: specMatches — the lesson-grading hook", () => {
  const build = () => {
    let s = createSpec();
    s = putOnShelf(s, Shelf.ROWS, createEncoding(dimField("race")));
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(dimField("applicant_id"), { aggregation: Aggregation.COUNT }));
    s = addFilter(s, categoricalFilter("approved", ["APPROVED"]));
    return { ...s, mark: MarkType.BAR };
  };

  test('grades "RACE on Rows, COUNT(ID) on Columns, filter to APPROVED"', () => {
    const r = specMatches(build(), {
      rows: ["race"],
      columns: [{ field: "applicant_id", aggregation: Aggregation.COUNT }],
      filters: [{ field: "approved" }],
      mark: MarkType.BAR,
    });
    assert.equal(r.matches, true);
    assert.deepEqual(r.misses, []);
  });

  test("reports what is missing, in teachable language", () => {
    const r = specMatches(createSpec(), { rows: ["race"], mark: MarkType.BAR });
    assert.equal(r.matches, false);
    assert.match(r.misses[0], /Expected race on rows/);
  });

  test("catches a field on the WRONG shelf", () => {
    const swapped = specMatches(build(), { columns: ["race"] });
    assert.equal(swapped.matches, false);
  });

  test("catches the wrong aggregation", () => {
    const r = specMatches(build(), { columns: [{ field: "applicant_id", aggregation: Aggregation.SUM }] });
    assert.equal(r.matches, false);
    assert.match(r.misses[0], /SUM\(applicant_id\)/);
  });

  test("only checks the shelves the lesson names", () => {
    // No assertion about Columns → extra pills there are fine.
    assert.equal(specMatches(build(), { rows: ["race"] }).matches, true);
  });

  test("can assert on discrete-vs-continuous", () => {
    assert.equal(specMatches(build(), { rows: [{ field: "race", discrete: true }] }).matches, true);
    assert.equal(specMatches(build(), { rows: [{ field: "race", discrete: false }] }).matches, false);
  });

  test("matches an Automatic spec against the mark Show Me picks", () => {
    const auto = { ...build(), mark: null };
    assert.equal(specMatches(auto, { mark: MarkType.BAR }).matches, true);
  });

  test("reports a missing filter", () => {
    const noFilter = { ...build(), filters: [] };
    const r = specMatches(noFilter, { filters: [{ field: "approved" }] });
    assert.equal(r.matches, false);
    assert.match(r.misses[0], /filter on approved/);
  });
});

// ===========================================================================
describe("render-plan: geometry", () => {
  const fields = inferFields(sales);
  const barSpec = () => {
    let s = createSpec();
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(findField(fields, "region")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "amount")));
    return { ...s, mark: MarkType.BAR };
  };
  const layout = { width: 400, height: 300, margin: { top: 20, right: 20, bottom: 40, left: 60 } };

  test("emits geometry only — no SVG, no DOM", () => {
    const plan = buildRenderPlan(barSpec(), sales, layout);
    const json = JSON.stringify(plan);
    assert.ok(!json.includes("<svg"));
    assert.ok(!json.includes("<rect"));
    assert.ok(!json.includes("</"));
    // Everything must survive a JSON round trip: the seam is plain data.
    assert.doesNotThrow(() => JSON.parse(json));
  });

  test("computes the plot box from the margins", () => {
    const plan = buildRenderPlan(barSpec(), sales, layout);
    assert.deepEqual(plan.plot, { x0: 60, y0: 260, x1: 380, y1: 20, width: 320, height: 240 });
  });

  test("one rect per aggregated group, inside the plot box", () => {
    const plan = buildRenderPlan(barSpec(), sales, layout);
    assert.equal(plan.marks.length, 3);
    assert.equal(plan.data.length, 3);
    for (const m of plan.marks) {
      assert.equal(m.type, "rect");
      assert.ok(m.x >= plan.plot.x0 - 0.001, `x ${m.x} left of plot`);
      assert.ok(m.x + m.width <= plan.plot.x1 + 0.001, `x ${m.x} right of plot`);
      assert.ok(m.y >= plan.plot.y1 - 0.001, `y ${m.y} above plot`);
      assert.ok(m.y + m.height <= plan.plot.y0 + 0.001, `y ${m.y} below plot`);
      assert.ok(m.width > 0 && m.height > 0);
    }
  });

  test("bar heights are proportional to their values", () => {
    // East=300, West=700, North=50 → West's bar is exactly 700/300 of East's.
    const plan = buildRenderPlan(barSpec(), sales, layout);
    const h = Object.fromEntries(plan.marks.map((m) => [m.datum.region, m.height]));
    assert.ok(Math.abs(h.West / h.East - 700 / 300) < 1e-9);
    assert.ok(Math.abs(h.East / h.North - 300 / 50) < 1e-9);
  });

  test("bars grow from the zero line, and the axis includes zero", () => {
    const plan = buildRenderPlan(barSpec(), sales, layout);
    const yAxis = plan.axes.find((a) => a.orientation === "left");
    assert.equal(yAxis.domain[0], 0);
    // Every bar's base sits on the zero pixel.
    for (const m of plan.marks) assert.ok(Math.abs(m.y + m.height - plan.plot.y0) < 1e-9);
  });

  test("negative values render below the zero line", () => {
    const rows = [{ k: "a", v: 10 }, { k: "b", v: -10 }];
    let s = putOnShelf(createSpec(), Shelf.COLUMNS, createEncoding(dimField("k")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(measureField("v")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, rows, layout);
    const [a, b] = plan.marks;
    const zero = plan.axes.find((x) => x.orientation === "left").ticks.find((t) => t.value === 0).position;
    assert.ok(a.y + a.height <= zero + 1e-9, "positive bar ends at zero");
    assert.ok(b.y >= zero - 1e-9, "negative bar starts at zero and grows down");
  });

  test("axes: discrete → band, continuous → linear", () => {
    const plan = buildRenderPlan(barSpec(), sales, layout);
    const x = plan.axes.find((a) => a.orientation === "bottom");
    const y = plan.axes.find((a) => a.orientation === "left");
    assert.equal(x.scaleType, "band");
    assert.equal(x.discrete, true);
    assert.deepEqual(x.ticks.map((t) => t.value), ["East", "West", "North"]);
    assert.equal(y.scaleType, "linear");
    assert.equal(y.discrete, false);
    assert.equal(y.title, "SUM(amount)");
  });

  test("a horizontal bar chart when the measure is on Columns", () => {
    let s = putOnShelf(createSpec(), Shelf.ROWS, createEncoding(findField(fields, "region")));
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(findField(fields, "amount")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, sales, layout);
    assert.equal(plan.marks.length, 3);
    // Bars start at the left axis and vary in width, not height.
    for (const m of plan.marks) assert.ok(Math.abs(m.x - plan.plot.x0) < 1e-9);
    const widths = plan.marks.map((m) => m.width);
    assert.ok(new Set(widths).size > 1);
    assert.equal(new Set(plan.marks.map((m) => m.height)).size, 1);
    // Every bar sits inside the plot box.
    for (const m of plan.marks) {
      assert.ok(m.y >= plan.plot.y1 - 0.001 && m.y + m.height <= plan.plot.y0 + 0.001);
    }
  });

  test("color: a discrete pill assigns palette colours and builds a legend", () => {
    let s = putOnShelf(createSpec(), Shelf.COLUMNS, createEncoding(findField(fields, "region")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "amount")));
    s = putOnShelf(s, Shelf.COLOR, createEncoding(findField(fields, "region")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, sales, layout);

    assert.equal(plan.legend.type, "categorical");
    assert.equal(plan.legend.entries.length, 3);
    assert.equal(plan.legend.entries[0].color, CATEGORICAL_PALETTE[0]);
    assert.equal(new Set(plan.marks.map((m) => m.fill)).size, 3);
  });

  test("color: a continuous pill builds a sequential ramp legend", () => {
    let s = putOnShelf(createSpec(), Shelf.COLUMNS, createEncoding(findField(fields, "region")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "amount")));
    s = putOnShelf(s, Shelf.COLOR, createEncoding(findField(fields, "amount")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, sales, layout);
    assert.equal(plan.legend.type, "sequential");
    assert.deepEqual(plan.legend.domain, [50, 700]);
    assert.equal(plan.legend.stops.length, 5);
  });

  test("no Color pill means one default fill and no legend", () => {
    const plan = buildRenderPlan(barSpec(), sales, layout);
    assert.equal(plan.legend, null);
    assert.ok(plan.marks.every((m) => m.fill === DEFAULT_MARK_COLOR));
  });

  test("scatter emits circles, sized by the Size shelf", () => {
    let s = putOnShelf(createSpec(), Shelf.COLUMNS, createEncoding(findField(fields, "amount")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "amount"), { aggregation: Aggregation.AVG }));
    s = putOnShelf(s, Shelf.DETAIL, createEncoding(findField(fields, "rep")));
    s = putOnShelf(s, Shelf.SIZE, createEncoding(findField(fields, "amount")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.SCATTER }, sales, layout);
    assert.equal(plan.marks.length, 3); // one per rep
    assert.ok(plan.marks.every((m) => m.type === "circle" && m.radius > 0));
    assert.ok(new Set(plan.marks.map((m) => m.radius)).size > 1);
  });

  test("line emits a single path of points, in order", () => {
    let s = putOnShelf(createSpec(), Shelf.COLUMNS, createEncoding(makeField("day", FieldType.DATE)));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "amount")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.LINE }, sales, layout);
    assert.equal(plan.marks.length, 1);
    assert.equal(plan.marks[0].type, "line");
    assert.equal(plan.marks[0].points.length, 2); // two distinct days
    assert.ok(plan.marks[0].points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  });

  test("a Color pill splits a line into one series per member", () => {
    // Without this split every point chains into one zig-zag — the classic bug.
    let s = putOnShelf(createSpec(), Shelf.COLUMNS, createEncoding(makeField("day", FieldType.DATE)));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "amount")));
    s = putOnShelf(s, Shelf.COLOR, createEncoding(findField(fields, "region")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.LINE }, sales, layout);
    assert.equal(plan.marks.length, 3);
    assert.deepEqual(plan.marks.map((m) => m.series).sort(), ["East", "North", "West"]);
  });

  test("area carries a baseline to close its shape against", () => {
    let s = putOnShelf(createSpec(), Shelf.COLUMNS, createEncoding(makeField("day", FieldType.DATE)));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "amount")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.AREA }, sales, layout);
    assert.equal(plan.marks[0].type, "area");
    assert.equal(plan.marks[0].baseline, plan.plot.y0);
  });

  // NaN geometry is worse than a crash: the plan still reports empty:false and
  // draws a perfectly good axis, so the picture is silently blank. NaN also does
  // not survive JSON.stringify (it becomes null), breaking the plain-data seam.
  const assertAllFinite = (value, path = "plan") => {
    if (typeof value === "number") {
      assert.ok(Number.isFinite(value), `${path} is not a finite number: ${value}`);
      return;
    }
    if (value === null || typeof value !== "object" || value instanceof Date) return;
    for (const [k, v] of Object.entries(value)) assertAllFinite(v, `${path}.${k}`);
  };

  test("bar over a time axis emits finite geometry, never NaN", () => {
    // Rows = a dimension, Columns = MAX(a date) → a continuous TIME axis. One
    // click apart from the bar chart above, and validateSpec() calls it valid.
    let s = putOnShelf(createSpec(), Shelf.ROWS, createEncoding(findField(fields, "region")));
    s = putOnShelf(
      s, Shelf.COLUMNS,
      createEncoding(makeField("day", FieldType.DATE), { aggregation: Aggregation.MAX })
    );
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, coerceRows(sales, fields), layout);

    assert.equal(plan.empty, false);
    assert.equal(plan.axes.find((a) => a.orientation === "bottom").scaleType, "time");
    assert.equal(plan.marks.length, 3);
    assertAllFinite(plan);
    for (const m of plan.marks) {
      assert.ok(m.width >= 0 && m.height > 0);
      assert.ok(m.x >= plan.plot.x0 - 0.001 && m.x + m.width <= plan.plot.x1 + 0.001);
    }
  });

  test("area over a time axis carries a finite baseline", () => {
    // The area's baseline comes off the Rows scale, so the time axis goes there.
    let s = putOnShelf(createSpec(), Shelf.COLUMNS, createEncoding(findField(fields, "region")));
    s = putOnShelf(
      s, Shelf.ROWS,
      createEncoding(makeField("day", FieldType.DATE), { aggregation: Aggregation.MAX })
    );
    const plan = buildRenderPlan({ ...s, mark: MarkType.AREA }, coerceRows(sales, fields), layout);

    assert.equal(plan.empty, false);
    assert.equal(plan.marks.length, 1);
    // A time scale has no zero to grow from; the start of its range is the floor.
    assert.equal(plan.marks[0].baseline, plan.plot.y0);
    assertAllFinite(plan);
  });

  test("a bar with a discrete pill on both shelves still has a finite baseline", () => {
    // No continuous pill at all means no zero line anywhere — the bars must fall
    // back to the start of the axis rather than measuring from undefined.
    let s = putOnShelf(createSpec(), Shelf.COLUMNS, createEncoding(findField(fields, "region")));
    s = putOnShelf(s, Shelf.ROWS, createEncoding(findField(fields, "rep")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, sales, layout);

    assert.equal(plan.empty, false);
    assertAllFinite(plan);
  });

  test("no plan survives a JSON round trip with a NaN turned into null", () => {
    let s = putOnShelf(createSpec(), Shelf.ROWS, createEncoding(findField(fields, "region")));
    s = putOnShelf(
      s, Shelf.COLUMNS,
      createEncoding(makeField("day", FieldType.DATE), { aggregation: Aggregation.MAX })
    );
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, coerceRows(sales, fields), layout);
    const round = JSON.parse(JSON.stringify(plan));
    for (const m of round.marks) {
      assert.ok(Number.isFinite(m.x) && Number.isFinite(m.width), `lossy round trip: ${JSON.stringify(m)}`);
    }
  });

  test("a text table emits positioned text marks", () => {
    let s = putOnShelf(createSpec(), Shelf.ROWS, createEncoding(findField(fields, "region")));
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(findField(fields, "amount")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.TEXT }, sales, layout);
    assert.equal(plan.marks.length, 3);
    assert.ok(plan.marks.every((m) => m.type === "text" && typeof m.text === "string"));
  });

  test("the Label shelf produces positioned labels", () => {
    let s = barSpec();
    s = putOnShelf(s, Shelf.LABEL, createEncoding(findField(fields, "amount")));
    const plan = buildRenderPlan(s, sales, layout);
    assert.equal(plan.labels.length, 3);
    assert.ok(plan.labels.every((l) => Number.isFinite(l.x) && Number.isFinite(l.y)));
    assert.ok(plan.labels.some((l) => l.text === "700"));
  });

  test("an empty spec or empty data yields an empty plan, not a crash", () => {
    assert.equal(buildRenderPlan(createSpec(), sales, layout).empty, true);
    assert.equal(buildRenderPlan(barSpec(), [], layout).empty, true);
    assert.deepEqual(buildRenderPlan(createSpec(), sales, layout).marks, []);
  });

  test("a filter that removes every row yields an empty plan", () => {
    const s = addFilter(barSpec(), categoricalFilter("region", ["Atlantis"]));
    assert.equal(buildRenderPlan(s, sales, layout).empty, true);
  });

  test("every plan has the same documented shape, empty or not", () => {
    // empty:true is still renderable, so a UI panel that maps over an advertised
    // array must not have to ask whether the key exists on this code path.
    const PLAN_KEYS = [
      "mark", "width", "height", "margin", "plot",
      "marks", "axes", "legend", "legends", "labels", "data", "empty",
    ].sort();
    const cases = [
      ["a fresh spec — the app's initial state", buildRenderPlan(createSpec(), sales, layout), true],
      ["no rows at all", buildRenderPlan(barSpec(), [], layout), true],
      [
        "filtered down to nothing",
        buildRenderPlan(addFilter(barSpec(), categoricalFilter("region", ["Atlantis"])), sales, layout),
        true,
      ],
      ["a populated bar chart", buildRenderPlan(barSpec(), sales, layout), false],
    ];

    for (const [name, plan, expectedEmpty] of cases) {
      assert.equal(plan.empty, expectedEmpty, name);
      assert.deepEqual(Object.keys(plan).sort(), PLAN_KEYS, name);
      for (const key of ["marks", "axes", "labels", "data", "legends"]) {
        assert.ok(Array.isArray(plan[key]), `${name}: plan.${key} must be an array`);
      }
      assert.doesNotThrow(() => plan.legends.map((l) => l.title), `${name}: legends.map`);
    }
  });

  test("legends lists every legend the plan built", () => {
    let s = barSpec();
    s = putOnShelf(s, Shelf.COLOR, createEncoding(findField(fields, "region")));
    s = putOnShelf(s, Shelf.SIZE, createEncoding(findField(fields, "amount")));
    const plan = buildRenderPlan(s, sales, layout);
    assert.deepEqual(plan.legends.map((l) => l.type), ["categorical", "size"]);
    assert.equal(plan.legend, plan.legends[0]);
  });

  test("a lone measure on Columns still draws one bar", () => {
    const s = putOnShelf(createSpec(), Shelf.COLUMNS, createEncoding(findField(fields, "amount")));
    const plan = buildRenderPlan({ ...s, mark: MarkType.BAR }, sales, layout);
    assert.equal(plan.marks.length, 1);
    assert.equal(plan.marks[0].value, 1050); // the grand total
    assert.ok(plan.marks[0].width > 0);
  });

  test("filters are applied before aggregation", () => {
    const s = addFilter(barSpec(), excludeFilter("region", ["North"]));
    const plan = buildRenderPlan(s, sales, layout);
    assert.equal(plan.marks.length, 2);
    assert.ok(!plan.data.some((r) => r.region === "North"));
  });

  test("respects the spec's sort", () => {
    const plan = buildRenderPlan(
      { ...barSpec(), sort: { field: "SUM(amount)", direction: "desc" } },
      sales,
      layout
    );
    assert.deepEqual(plan.data.map((r) => r.region), ["West", "East", "North"]);
  });

  test("interpolateColor blends hex endpoints", () => {
    assert.equal(interpolateColor("#000000", "#ffffff", 0), "#000000");
    assert.equal(interpolateColor("#000000", "#ffffff", 1), "#ffffff");
    assert.equal(interpolateColor("#000000", "#ffffff", 0.5), "#808080");
    assert.equal(interpolateColor("#000000", "#ffffff", 5), "#ffffff"); // clamped
  });

  test("formatValue", () => {
    assert.equal(formatValue(1500), "1.5K");
    assert.equal(formatValue(null), "");
    assert.equal(formatValue("x"), "x");
  });
});

// ===========================================================================
// The canonical teaching viz, end to end over the real HMDA extract.
// Numbers below are ground truth, computed independently from the CSV.
describe("END TO END: approval rate by race over the real HMDA data", () => {
  // Independently verified against public/data/hmda-sample.csv:
  //   White 43/50 = 0.86     Asian    8/10 = 0.80
  //   Hispanic 12/18 = 0.667 Black    9/16 = 0.5625
  //   American Indian 2/3    Other    2/3
  const EXPECTED_RATES = {
    White: 43 / 50,
    Asian: 8 / 10,
    Hispanic: 12 / 18,
    Black: 9 / 16,
    "American Indian": 2 / 3,
    Other: 2 / 3,
  };
  const EXPECTED_COUNTS = { White: 50, Black: 16, Hispanic: 18, Asian: 10, "American Indian": 3, Other: 3 };

  // The lesson's answer: a calculated field turns APPROVED/DENIED into 1/0, and
  // its AVG is the approval rate. This is exactly how Tableau teaches it.
  const isApproved = createCalculatedField("is_approved", 'IF([approved] = "APPROVED", 1, 0)');

  const buildApprovalSpec = () => {
    let spec = createSpec({ title: "Approval rate by race", calculatedFields: [isApproved] });
    spec = putOnShelf(spec, Shelf.COLUMNS, createEncoding(makeField("race", FieldType.STRING)));
    spec = putOnShelf(spec, Shelf.ROWS, createEncoding(isApproved, { aggregation: Aggregation.AVG }));
    return spec;
  };

  test("the calculated field flags approvals correctly", () => {
    const rows = applyCalculatedFields(hmdaRows, [isApproved]);
    assert.equal(rows.filter((r) => r.is_approved === 1).length, 76);
    assert.equal(rows.filter((r) => r.is_approved === 0).length, 24);
    assert.equal(rows[0].approved, "APPROVED");
    assert.equal(rows[0].is_approved, 1);
  });

  test("aggregation reproduces the true approval rate for every race group", () => {
    const rows = applyCalculatedFields(hmdaRows, [isApproved]);
    const out = aggregateRows(rows, {
      dimensions: ["race"],
      measures: [
        { field: "is_approved", aggregation: Aggregation.AVG },
        { field: "applicant_id", aggregation: Aggregation.COUNT },
      ],
    });

    assert.equal(out.length, 6);
    for (const row of out) {
      assert.ok(EXPECTED_RATES[row.race] !== undefined, `unexpected race group: ${row.race}`);
      assert.ok(
        Math.abs(row["AVG(is_approved)"] - EXPECTED_RATES[row.race]) < 1e-12,
        `${row.race}: got ${row["AVG(is_approved)"]}, want ${EXPECTED_RATES[row.race]}`
      );
      assert.equal(row["COUNT(applicant_id)"], EXPECTED_COUNTS[row.race]);
    }
  });

  test("the disparity the lesson exists to surface: White 86% vs Black 56.25%", () => {
    const rows = applyCalculatedFields(hmdaRows, [isApproved]);
    const out = aggregateRows(rows, {
      dimensions: ["race"],
      measures: [{ field: "is_approved", aggregation: Aggregation.AVG }],
    });
    const rate = Object.fromEntries(out.map((r) => [r.race, r["AVG(is_approved)"]]));
    assert.equal(rate.White, 0.86);
    assert.equal(rate.Black, 0.5625);
    assert.ok(rate.White - rate.Black > 0.29);
  });

  test("Show Me picks a bar chart for this spec", () => {
    const spec = buildApprovalSpec();
    assert.equal(bestMarkType(spec), MarkType.BAR);
    assert.equal(resolveMark(spec), MarkType.BAR);
    assert.equal(validateSpec(spec, inferFields(applyCalculatedFields(hmdaRows, [isApproved]))).valid, true);
  });

  test("the render plan draws one correctly-proportioned bar per race group", () => {
    const spec = { ...buildApprovalSpec(), mark: MarkType.BAR };
    const plan = buildRenderPlan(spec, hmdaRows, {
      width: 600,
      height: 400,
      margin: { top: 20, right: 20, bottom: 60, left: 60 },
    });

    assert.equal(plan.empty, false);
    assert.equal(plan.mark, MarkType.BAR);
    assert.equal(plan.marks.length, 6);

    // Each bar's value is that group's true approval rate.
    const byRace = Object.fromEntries(plan.marks.map((m) => [m.datum.race, m]));
    for (const [race, rate] of Object.entries(EXPECTED_RATES)) {
      assert.ok(Math.abs(byRace[race].value - rate) < 1e-12, `${race} bar value`);
    }

    // White's bar is taller than Black's, in the exact ratio of their rates.
    assert.ok(byRace.White.height > byRace.Black.height);
    assert.ok(Math.abs(byRace.White.height / byRace.Black.height - 0.86 / 0.5625) < 1e-9);

    // Geometry is sane: inside the plot, sitting on the zero line.
    for (const m of plan.marks) {
      assert.equal(m.type, "rect");
      assert.ok(m.width > 0 && m.height > 0);
      assert.ok(m.x >= plan.plot.x0 - 0.001 && m.x + m.width <= plan.plot.x1 + 0.001);
      assert.ok(Math.abs(m.y + m.height - plan.plot.y0) < 1e-9);
    }
  });

  test("the axes teach the discrete/continuous split", () => {
    const spec = { ...buildApprovalSpec(), mark: MarkType.BAR };
    const plan = buildRenderPlan(spec, hmdaRows, { width: 600, height: 400 });

    const x = plan.axes.find((a) => a.orientation === "bottom");
    assert.equal(x.field, "race");
    assert.equal(x.scaleType, "band"); // blue pill → band axis
    assert.equal(x.discrete, true);
    assert.equal(x.ticks.length, 6);
    assert.ok(x.ticks.map((t) => t.value).includes("Black"));

    const y = plan.axes.find((a) => a.orientation === "left");
    assert.equal(y.scaleType, "linear"); // green pill → linear axis
    assert.equal(y.discrete, false);
    assert.equal(y.title, "AVG(is_approved)");
    assert.equal(y.domain[0], 0); // a rate axis must start at zero
    assert.ok(y.ticks.length > 1);
  });

  test("filtering to APPROVED changes the question from rate to volume", () => {
    let spec = createSpec();
    spec = putOnShelf(spec, Shelf.COLUMNS, createEncoding(makeField("race", FieldType.STRING)));
    spec = putOnShelf(spec, Shelf.ROWS, createEncoding(makeField("applicant_id", FieldType.STRING), { aggregation: Aggregation.COUNT }));
    spec = addFilter(spec, categoricalFilter("approved", ["APPROVED"]));

    const plan = buildRenderPlan({ ...spec, mark: MarkType.BAR }, hmdaRows, { width: 600, height: 400 });
    const counts = Object.fromEntries(plan.data.map((r) => [r.race, r["COUNT(applicant_id)"]]));
    // Approved counts, not totals: White 43 of 50, Black 9 of 16.
    assert.equal(counts.White, 43);
    assert.equal(counts.Black, 9);
    assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), 76);
  });

  test("top-3 by volume keeps White, Hispanic and Black", () => {
    let spec = createSpec();
    spec = putOnShelf(spec, Shelf.COLUMNS, createEncoding(makeField("race", FieldType.STRING)));
    spec = putOnShelf(spec, Shelf.ROWS, createEncoding(makeField("applicant_id", FieldType.STRING), { aggregation: Aggregation.COUNT }));
    spec = addFilter(spec, topNFilter("race", 3, { field: "applicant_id", aggregation: Aggregation.COUNT }));

    const plan = buildRenderPlan({ ...spec, mark: MarkType.BAR }, hmdaRows, { width: 600, height: 400 });
    assert.deepEqual(plan.data.map((r) => r.race).sort(), ["Black", "Hispanic", "White"]);
    assert.equal(plan.marks.length, 3);
  });

  test("SUM(loan_amount) over the whole extract matches the raw total", () => {
    const spec = putOnShelf(createSpec(), Shelf.COLUMNS, createEncoding(makeField("loan_amount", FieldType.NUMBER)));
    const plan = buildRenderPlan({ ...spec, mark: MarkType.BAR }, hmdaRows, { width: 600, height: 400 });
    assert.equal(plan.data[0]["SUM(loan_amount)"], 21735500);
  });

  test("AVG and MEDIAN loan amount by race, straight off the real CSV", () => {
    const fields = inferFields(hmdaRows);
    const typed = coerceRows(hmdaRows, fields);
    const all = aggregateRows(typed, {
      dimensions: [],
      measures: [
        { field: "loan_amount", aggregation: Aggregation.AVG },
        { field: "loan_amount", aggregation: Aggregation.MEDIAN },
        { field: "loan_amount", aggregation: Aggregation.MIN },
        { field: "loan_amount", aggregation: Aggregation.MAX },
        { field: "zip_code", aggregation: Aggregation.COUNTD },
      ],
    });
    assert.equal(all[0]["AVG(loan_amount)"], 217355);
    assert.equal(all[0]["MEDIAN(loan_amount)"], 208500);
    assert.equal(all[0]["MIN(loan_amount)"], 54000);
    assert.equal(all[0]["MAX(loan_amount)"], 401000);
    assert.equal(all[0]["COUNTD(zip_code)"], 22);
  });

  test("the whole spec survives a JSON round trip and rebuilds an identical plan", () => {
    // This is what a lesson does: store the expected spec, reload it, re-render.
    const spec = { ...buildApprovalSpec(), mark: MarkType.BAR };
    const layout = { width: 600, height: 400 };
    const before = buildRenderPlan(spec, hmdaRows, layout);
    const after = buildRenderPlan(deserializeSpec(serializeSpec(spec)), hmdaRows, layout);
    assert.deepEqual(
      after.marks.map((m) => [m.datum.race, m.x, m.y, m.width, m.height]),
      before.marks.map((m) => [m.datum.race, m.x, m.y, m.width, m.height])
    );
  });

  test("specMatches grades the canonical lesson answer", () => {
    const spec = { ...buildApprovalSpec(), mark: MarkType.BAR };
    const graded = specMatches(spec, {
      columns: ["race"],
      rows: [{ field: "is_approved", aggregation: Aggregation.AVG }],
      mark: MarkType.BAR,
    });
    assert.equal(graded.matches, true);

    // A learner who forgot to aggregate gets a specific, teachable miss.
    let wrong = createSpec({ calculatedFields: [isApproved] });
    wrong = putOnShelf(wrong, Shelf.COLUMNS, createEncoding(makeField("race", FieldType.STRING)));
    wrong = putOnShelf(wrong, Shelf.ROWS, createEncoding(isApproved, { aggregation: null }));
    const r = specMatches(wrong, { rows: [{ field: "is_approved", aggregation: Aggregation.AVG }] });
    assert.equal(r.matches, false);
    assert.match(r.misses[0], /AVG\(is_approved\)/);
  });
});
