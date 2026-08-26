import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createSpec, putOnShelf, createEncoding, addFilter, specMatches, Shelf } from "../lib/viz/spec.js";
import { Aggregation, categoricalFilter } from "../lib/viz/aggregate.js";
import { makeField, FieldType, FieldRole } from "../lib/viz/fields.js";
import { MarkType } from "../lib/viz/marks.js";
import {
  attachGuide, normalizeStep, normalizeHints, normalizeResult, normalizeDiffEntry,
  parseMiss, diffTitle, diffDetail, formatSide, summarize, shelfLabel, pillLabel,
  createHintState, revealNextHint, visibleHints, hasMoreHints, nextHintCost,
  stepScore, scoreBreakdown,
} from "../components/guide/adapter.js";

/** Mirrors the fixture helper in test/viz.test.js. */
const dimField = (name) => makeField(name, FieldType.STRING, FieldRole.DIMENSION);

/* ══════════════════════════════════════════════════════════════════
   parseMiss — the real specMatches() strings, round-tripped back
   into structure. These strings are produced by lib/viz/spec.js, so
   the cases below are built by CALLING it, not by hand-copying its
   wording. If it ever rephrases, these fail loudly.
   ══════════════════════════════════════════════════════════════════ */
describe("parseMiss: recovers structure from real specMatches output", () => {
  const built = () => {
    let s = createSpec();
    s = putOnShelf(s, Shelf.ROWS, createEncoding(dimField("race")));
    s = putOnShelf(s, Shelf.COLUMNS, createEncoding(dimField("applicant_id"), { aggregation: Aggregation.COUNT }));
    s = addFilter(s, categoricalFilter("approved", ["APPROVED"]));
    return { ...s, mark: MarkType.BAR };
  };

  test("a bare field on a shelf", () => {
    const { misses } = specMatches(createSpec(), { rows: ["race"] });
    const e = parseMiss(misses[0]);
    assert.equal(e.kind, "shelf");
    assert.equal(e.field, "race");
    assert.equal(e.shelf, "rows");
    assert.equal(e.aggregation, null);
  });

  test("an aggregated field keeps its aggregation", () => {
    const { misses } = specMatches(createSpec(), {
      columns: [{ field: "applicant_id", aggregation: Aggregation.COUNT }],
    });
    const e = parseMiss(misses[0]);
    assert.equal(e.kind, "shelf");
    assert.equal(e.field, "applicant_id");
    assert.equal(e.aggregation, "COUNT");
    assert.equal(e.shelf, "columns");
  });

  test("the wrong aggregation names the one the lesson wants", () => {
    const { misses } = specMatches(built(), {
      columns: [{ field: "applicant_id", aggregation: Aggregation.SUM }],
    });
    const e = parseMiss(misses[0]);
    assert.equal(e.aggregation, "SUM");
    assert.equal(e.field, "applicant_id");
  });

  test("a mark-type mismatch captures both sides", () => {
    const line = { ...built(), mark: MarkType.LINE };
    const { misses } = specMatches(line, { mark: MarkType.BAR });
    const e = parseMiss(misses[0]);
    assert.equal(e.kind, "mark");
    assert.equal(e.expected, "bar");
    assert.equal(e.actual, "line");
  });

  test("a missing filter", () => {
    const noFilter = { ...built(), filters: [] };
    const { misses } = specMatches(noFilter, { filters: [{ field: "approved" }] });
    const e = parseMiss(misses[0]);
    assert.equal(e.kind, "filter");
    assert.equal(e.field, "approved");
    assert.equal(e.shelf, "filters");
  });

  test("an unrecognized sentence survives as the grader's own words", () => {
    const e = parseMiss("Something the grader made up.");
    assert.equal(e.kind, "generic");
    assert.equal(e.detail, "Something the grader made up.");
  });

  test("tolerates junk without throwing", () => {
    for (const junk of [null, undefined, "", 42]) {
      assert.doesNotThrow(() => parseMiss(junk));
    }
  });
});

/* ══════════════════════════════════════════════════════════════════
   diff -> teaching prose
   ══════════════════════════════════════════════════════════════════ */
describe("diff formatting: teaches, never scolds", () => {
  test("names the field AND the shelf, humanized", () => {
    const e = parseMiss("Expected race on rows.");
    assert.equal(diffTitle(e), "race → Rows");
    assert.match(diffDetail(e), /Drop race on the Rows shelf/);
  });

  test("an aggregation mismatch says which aggregation and how the pill should read", () => {
    const e = parseMiss("Expected COUNT(applicant_id) on columns.");
    assert.equal(diffTitle(e), "COUNT(applicant_id) → Columns");
    const d = diffDetail(e);
    assert.match(d, /aggregation to COUNT/);
    assert.match(d, /COUNT\(applicant_id\)/);
  });

  test("a mark mismatch says what is on screen now", () => {
    const e = parseMiss("Expected the bar mark type, found line.");
    assert.match(diffDetail(e), /drawing line marks/);
    assert.match(diffDetail(e), /Switch the mark type to bar/);
  });

  test("a cell diff names the ref and both values", () => {
    const e = normalizeDiffEntry({ kind: "cell", ref: "B2", expected: 0.5625, actual: 0.86 });
    assert.equal(diffTitle(e), "Cell B2");
    assert.match(diffDetail(e), /B2 holds 0\.86/);
    assert.match(diffDetail(e), /should come out to 0\.5625/);
  });

  test("no diff message anywhere uses the word 'incorrect' or 'wrong'", () => {
    const entries = [
      parseMiss("Expected race on rows."),
      parseMiss("Expected COUNT(applicant_id) on columns."),
      parseMiss("Expected the bar mark type, found line."),
      parseMiss("Expected a filter on approved."),
      normalizeDiffEntry({ kind: "cell", ref: "B2", expected: 1, actual: 2 }),
    ];
    for (const e of entries) {
      const text = `${diffTitle(e)} ${diffDetail(e)}`.toLowerCase();
      assert.ok(!text.includes("incorrect"), `"${text}" says incorrect`);
      assert.ok(!text.includes("wrong"), `"${text}" says wrong`);
      assert.ok(!text.includes("failed"), `"${text}" says failed`);
    }
  });
});

describe("formatSide: empty and error values read as themselves", () => {
  test("empty-ish values", () => {
    assert.equal(formatSide(null), "(empty)");
    assert.equal(formatSide(undefined), "(empty)");
    assert.equal(formatSide(""), "(empty)");
  });
  test("zero is a value, not emptiness", () => {
    assert.equal(formatSide(0), "0");
  });
  test("false is a value, not emptiness", () => {
    assert.equal(formatSide(false), "FALSE");
  });
  test("a FormulaError shows its Excel name", () => {
    assert.equal(formatSide({ name: "#DIV/0!" }), "#DIV/0!");
  });
});

describe("labels", () => {
  test("shelf ids humanize, unknown ids pass through", () => {
    assert.equal(shelfLabel("rows"), "Rows");
    assert.equal(shelfLabel("filters"), "Filters");
    assert.equal(shelfLabel("weird"), "weird");
    assert.equal(shelfLabel(null), "");
  });
  test("pillLabel matches Tableau pill wording", () => {
    assert.equal(pillLabel("race"), "race");
    assert.equal(pillLabel("applicant_id", "COUNT"), "COUNT(applicant_id)");
  });
});

/* ══════════════════════════════════════════════════════════════════
   normalizeResult — both grader shapes collapse to one
   ══════════════════════════════════════════════════════════════════ */
describe("normalizeResult: one shape out, two shapes in", () => {
  test("specMatches shape: {matches, misses}", () => {
    const raw = specMatches(createSpec(), { rows: ["race"], mark: MarkType.BAR });
    const r = normalizeResult(raw);
    assert.equal(r.pass, false);
    assert.equal(r.diff.length, raw.misses.length);
    assert.equal(r.diff[0].field, "race");
  });

  test("a passing specMatches result carries no diff", () => {
    let s = createSpec();
    s = putOnShelf(s, Shelf.ROWS, createEncoding(dimField("race")));
    const r = normalizeResult(specMatches(s, { rows: ["race"] }));
    assert.equal(r.pass, true);
    assert.deepEqual(r.diff, []);
  });

  test("brief shape: {pass, diff:[...]} passes structure through", () => {
    const r = normalizeResult({
      pass: false,
      diff: [{ kind: "cell", ref: "C4", expected: 76, actual: 24 }],
    });
    assert.equal(r.pass, false);
    assert.equal(r.diff[0].ref, "C4");
    assert.match(r.diff[0].detail, /C4 holds 24/);
  });

  test("brief shape: bare expected/actual with no diff array still renders", () => {
    const r = normalizeResult({ pass: false, expected: 76, actual: 24 });
    assert.equal(r.diff.length, 1);
    assert.equal(r.diff[0].expected, 76);
  });

  test("a cell entry is inferred from a ref alone", () => {
    const r = normalizeResult({ pass: false, diff: [{ ref: "A1", expected: 1, actual: 2 }] });
    assert.equal(r.diff[0].kind, "cell");
  });

  test("a grader's own message wins over a generated one", () => {
    const r = normalizeResult({ pass: false, diff: [{ kind: "cell", ref: "B2", expected: 1, actual: 2, message: "Custom." }] });
    assert.equal(r.diff[0].detail, "Custom.");
  });

  test("a null result does not throw", () => {
    const r = normalizeResult(null);
    assert.equal(r.pass, false);
    assert.deepEqual(r.diff, []);
  });
});

describe("summarize: counts what is left", () => {
  test("passing", () => {
    assert.equal(summarize({ pass: true, diff: [], message: "" }), "Step cleared.");
  });
  test("one miss reads as one", () => {
    assert.equal(summarize(normalizeResult(specMatches(createSpec(), { rows: ["race"] }))), "One thing left.");
  });
  test("several misses are counted", () => {
    const r = normalizeResult(specMatches(createSpec(), { rows: ["race"], columns: ["x"] }));
    assert.equal(summarize(r), "2 things left.");
  });
});

/* ══════════════════════════════════════════════════════════════════
   Hint ladder state machine
   ══════════════════════════════════════════════════════════════════ */
describe("hint ladder: one rung at a time, and it costs", () => {
  const hints = normalizeHints(["Which field varies?", "It goes on Rows.", "Drop race on Rows."]);

  test("default costs escalate — the last rung gives the most away", () => {
    assert.deepEqual(hints.map((h) => h.cost), [10, 20, 40]);
  });

  test("explicit costs are respected", () => {
    const h = normalizeHints([{ text: "a", cost: 5 }, "b"]);
    assert.equal(h[0].cost, 5);
    assert.equal(h[1].cost, 20);
  });

  test("starts closed and free", () => {
    const s = createHintState();
    assert.equal(s.revealed, 0);
    assert.equal(s.spent, 0);
    assert.deepEqual(visibleHints(s, hints), []);
  });

  test("the price is knowable before it is paid", () => {
    assert.equal(nextHintCost(createHintState(), hints), 10);
  });

  test("revealing walks the ladder and spends", () => {
    let s = createHintState();
    s = revealNextHint(s, hints);
    assert.equal(s.revealed, 1);
    assert.equal(s.spent, 10);
    assert.equal(visibleHints(s, hints).length, 1);
    assert.equal(nextHintCost(s, hints), 20);

    s = revealNextHint(s, hints);
    assert.equal(s.spent, 30);
    s = revealNextHint(s, hints);
    assert.equal(s.spent, 70);
    assert.equal(visibleHints(s, hints).length, 3);
  });

  test("reveal is immutable", () => {
    const s = createHintState();
    const next = revealNextHint(s, hints);
    assert.notEqual(s, next);
    assert.equal(s.revealed, 0);
  });

  test("an exhausted ladder cannot be over-spent", () => {
    let s = createHintState();
    for (let i = 0; i < 10; i++) s = revealNextHint(s, hints);
    assert.equal(s.revealed, 3);
    assert.equal(s.spent, 70);
    assert.equal(hasMoreHints(s, hints), false);
    assert.equal(nextHintCost(s, hints), 0);
  });

  test("a step with no hints degrades quietly", () => {
    const s = createHintState();
    assert.equal(hasMoreHints(s, []), false);
    assert.equal(revealNextHint(s, []), s);
    assert.deepEqual(visibleHints(s, undefined), []);
  });
});

describe("scoring: hints and attempts both cost, but the floor holds", () => {
  test("a clean solve is 100", () => {
    assert.equal(stepScore(createHintState(), 0), 100);
  });
  test("hints come off the top", () => {
    assert.equal(stepScore({ revealed: 1, spent: 10 }, 0), 90);
  });
  test("each failed check costs 5", () => {
    assert.equal(stepScore(createHintState(), 3), 85);
  });
  test("hints and attempts compound", () => {
    assert.equal(stepScore({ revealed: 2, spent: 30 }, 2), 60);
  });
  test("the floor is 40 — working the whole ladder is still a solve", () => {
    assert.equal(stepScore({ revealed: 3, spent: 70 }, 20), 40);
  });
  test("scoring survives a missing hint state", () => {
    assert.equal(stepScore(undefined, 0), 100);
  });
  test("the breakdown explains the number", () => {
    const b = scoreBreakdown({ spent: 30 }, 2);
    assert.deepEqual(b[0], { label: "Solved", delta: 100 });
    assert.equal(b[1].delta, -30);
    assert.equal(b[2].delta, -10);
    assert.equal(b.reduce((a, x) => a + x.delta, 0), 60);
  });
  test("a clean solve's breakdown is a single line", () => {
    assert.deepEqual(scoreBreakdown(createHintState(), 0), [{ label: "Solved", delta: 100 }]);
  });
});

/* ══════════════════════════════════════════════════════════════════
   Step + module normalization
   ══════════════════════════════════════════════════════════════════ */
describe("normalizeStep", () => {
  test("fills ids and titles when a step omits them", () => {
    const s = normalizeStep({ instruction: "Do the thing." }, 2);
    assert.equal(s.id, "step-3");
    assert.equal(s.title, "Step 3");
    assert.equal(s.checkpoint, "step-3");
    assert.deepEqual(s.hints, []);
  });

  test("accepts the alternate field names lib/guide might use", () => {
    const s = normalizeStep({ id: "a", name: "Build it", prompt: "Go", dataset: "HMDA" }, 0);
    assert.equal(s.title, "Build it");
    assert.equal(s.instruction, "Go");
    assert.equal(s.context, "HMDA");
  });

  test("a null step is null, not a crash", () => {
    assert.equal(normalizeStep(null, 0), null);
  });
});

describe("attachGuide: the seam degrades honestly", () => {
  test("no module -> unavailable, and no throw on use", () => {
    const g = attachGuide(undefined);
    assert.equal(g.available, false);
    assert.equal(g.createRunner({}), null);
  });

  test("a module exposing createRunner is used", () => {
    const g = attachGuide({ createRunner: (lesson) => ({ lesson }) });
    assert.equal(g.available, true);
    assert.deepEqual(g.createRunner({ id: "x" }), { lesson: { id: "x" } });
  });

  test("alternate factory names are tolerated", () => {
    for (const key of ["createGuideRunner", "createRun", "default"]) {
      const g = attachGuide({ [key]: () => ({ ok: true }) });
      assert.equal(g.available, true, `${key} not picked up`);
    }
  });

  test("a module with no recognizable factory is unavailable, not fatal", () => {
    const g = attachGuide({ somethingElse: 1 });
    assert.equal(g.available, false);
    assert.equal(g.createRunner({}), null);
  });
});
