import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  ROW_HEIGHT, DEFAULT_COL_WIDTH, MIN_COL_WIDTH, MAX_COL_WIDTH,
  createSelection, selectionRange, isSingleCell, clampCell,
  moveFocus, advanceWithin, advanceActive,
  visibleWindow,
  colOffset, totalWidth, colAtX, clampColWidth,
  parseClipboardText, toTsv,
  fillRange, fillMapping, pasteMapping, pasteTargetRange,
  extractFormulaRefs, formulaSegments, functionPrefix, functionContext,
  createHistory, recordEdit, undoEdit, redoEdit,
  selectionStats,
  buildPivotSpec, formatPivotCell, pivotColumnMeta, headerFields, distinctValues,
} from "../components/sheet/sheet-logic.js";
import { pivotTable, pivotToGrid } from "../lib/sheet/pivot.js";

// ---------------------------------------------------------------------------
describe("sheet-ui: selection model", () => {
  test("createSelection starts as a single active cell", () => {
    const sel = createSelection(3, 2);
    assert.deepEqual(sel.anchor, { row: 3, col: 2 });
    assert.deepEqual(sel.focus, { row: 3, col: 2 });
    assert.deepEqual(sel.active, { row: 3, col: 2 });
    assert.ok(isSingleCell(sel));
  });

  test("selectionRange normalizes corners", () => {
    const sel = { anchor: { row: 5, col: 4 }, focus: { row: 1, col: 8 }, active: { row: 5, col: 4 } };
    assert.deepEqual(selectionRange(sel), { top: 1, left: 4, bottom: 5, right: 8 });
    assert.ok(!isSingleCell(sel));
  });

  test("clampCell keeps cells in bounds", () => {
    assert.deepEqual(clampCell(-3, 5, 99, 25), { row: 0, col: 5 });
    assert.deepEqual(clampCell(200, -1, 99, 25), { row: 99, col: 0 });
  });

  test("moveFocus collapses to a single cell from the active cell", () => {
    const sel = { anchor: { row: 0, col: 0 }, focus: { row: 4, col: 4 }, active: { row: 2, col: 2 } };
    const next = moveFocus(sel, 1, 0, { maxRow: 99, maxCol: 25 });
    assert.deepEqual(next.anchor, { row: 3, col: 2 });
    assert.ok(isSingleCell(next));
  });

  test("moveFocus with extend keeps the anchor and moves the focus", () => {
    let sel = createSelection(2, 2);
    sel = moveFocus(sel, 1, 0, { extend: true, maxRow: 99, maxCol: 25 });
    sel = moveFocus(sel, 0, 2, { extend: true, maxRow: 99, maxCol: 25 });
    assert.deepEqual(sel.anchor, { row: 2, col: 2 });
    assert.deepEqual(sel.focus, { row: 3, col: 4 });
    assert.deepEqual(sel.active, { row: 2, col: 2 });
  });

  test("moveFocus clamps at the grid edges", () => {
    const sel = createSelection(0, 0);
    const next = moveFocus(sel, -1, -1, { maxRow: 99, maxCol: 25 });
    assert.deepEqual(next.active, { row: 0, col: 0 });
  });

  test("advanceWithin wraps down through columns", () => {
    const range = { top: 1, left: 1, bottom: 2, right: 2 };
    assert.deepEqual(advanceWithin(range, { row: 1, col: 1 }, "down"), { row: 2, col: 1 });
    assert.deepEqual(advanceWithin(range, { row: 2, col: 1 }, "down"), { row: 1, col: 2 });
    assert.deepEqual(advanceWithin(range, { row: 2, col: 2 }, "down"), { row: 1, col: 1 });
  });

  test("advanceWithin wraps right through rows and reverses", () => {
    const range = { top: 0, left: 0, bottom: 1, right: 1 };
    assert.deepEqual(advanceWithin(range, { row: 0, col: 1 }, "right"), { row: 1, col: 0 });
    assert.deepEqual(advanceWithin(range, { row: 0, col: 0 }, "left"), { row: 1, col: 1 });
    assert.deepEqual(advanceWithin(range, { row: 0, col: 0 }, "up"), { row: 1, col: 1 });
  });

  test("advanceActive on a single cell simply moves", () => {
    const next = advanceActive(createSelection(5, 5), "down", 99, 25);
    assert.deepEqual(next.active, { row: 6, col: 5 });
    assert.ok(isSingleCell(next));
  });

  test("advanceActive inside a range preserves the selection", () => {
    const sel = { anchor: { row: 0, col: 0 }, focus: { row: 2, col: 1 }, active: { row: 2, col: 0 } };
    const next = advanceActive(sel, "down", 99, 25);
    assert.deepEqual(next.anchor, { row: 0, col: 0 });
    assert.deepEqual(next.focus, { row: 2, col: 1 });
    assert.deepEqual(next.active, { row: 0, col: 1 });
  });
});

// ---------------------------------------------------------------------------
describe("sheet-ui: virtualization windowing", () => {
  test("window at the top has no negative start", () => {
    const w = visibleWindow(0, 260, ROW_HEIGHT, 5000, 4);
    assert.equal(w.start, 0);
    assert.equal(w.end, 13); // 10 visible + 4 overscan below
  });

  test("window mid-scroll includes overscan both sides", () => {
    const w = visibleWindow(100 * ROW_HEIGHT, 10 * ROW_HEIGHT, ROW_HEIGHT, 5000, 4);
    assert.equal(w.start, 96);
    assert.equal(w.end, 113);
  });

  test("window clamps at the bottom of the sheet", () => {
    const w = visibleWindow(4995 * ROW_HEIGHT, 20 * ROW_HEIGHT, ROW_HEIGHT, 5000, 4);
    assert.equal(w.end, 4999);
  });

  test("fractional scroll positions round outward", () => {
    const w = visibleWindow(13, 100, 26, 5000, 0);
    assert.equal(w.start, 0);       // row 0 still partially visible
    assert.equal(w.end, Math.ceil((13 + 100) / 26) - 1);
  });

  test("empty sheet yields an empty window", () => {
    const w = visibleWindow(0, 500, ROW_HEIGHT, 0);
    assert.ok(w.end < w.start);
  });
});

// ---------------------------------------------------------------------------
describe("sheet-ui: grid geometry", () => {
  const widths = { 1: 150, 3: 60 };

  test("colOffset sums default and custom widths", () => {
    assert.equal(colOffset(0, widths), 0);
    assert.equal(colOffset(1, widths), DEFAULT_COL_WIDTH);
    assert.equal(colOffset(2, widths), DEFAULT_COL_WIDTH + 150);
    assert.equal(colOffset(4, widths), DEFAULT_COL_WIDTH * 2 + 150 + 60);
  });

  test("totalWidth matches offset of colCount", () => {
    assert.equal(totalWidth(4, widths), colOffset(4, widths));
    assert.equal(totalWidth(3, undefined), DEFAULT_COL_WIDTH * 3);
  });

  test("colAtX finds the column under a pointer", () => {
    assert.equal(colAtX(0, 10, widths), 0);
    assert.equal(colAtX(DEFAULT_COL_WIDTH - 1, 10, widths), 0);
    assert.equal(colAtX(DEFAULT_COL_WIDTH, 10, widths), 1);
    assert.equal(colAtX(DEFAULT_COL_WIDTH + 149, 10, widths), 1);
    assert.equal(colAtX(DEFAULT_COL_WIDTH + 150, 10, widths), 2);
    assert.equal(colAtX(-5, 10, widths), 0);
    assert.equal(colAtX(1e9, 10, widths), 9); // clamps to last column
  });

  test("clampColWidth enforces min/max", () => {
    assert.equal(clampColWidth(2), MIN_COL_WIDTH);
    assert.equal(clampColWidth(10000), MAX_COL_WIDTH);
    assert.equal(clampColWidth(120.6), 121);
  });
});

// ---------------------------------------------------------------------------
describe("sheet-ui: clipboard", () => {
  test("parseClipboardText splits rows and tabs", () => {
    assert.deepEqual(parseClipboardText("a\tb\nc\td"), [["a", "b"], ["c", "d"]]);
  });

  test("parseClipboardText handles CRLF and a trailing newline", () => {
    assert.deepEqual(parseClipboardText("a\tb\r\nc\td\r\n"), [["a", "b"], ["c", "d"]]);
    assert.deepEqual(parseClipboardText("x\n"), [["x"]]);
  });

  test("parseClipboardText keeps empty cells", () => {
    assert.deepEqual(parseClipboardText("a\t\tb"), [["a", "", "b"]]);
    assert.deepEqual(parseClipboardText(""), []);
  });

  test("toTsv serializes values with blanks for null/undefined", () => {
    assert.equal(toTsv([["a", 1], [null, undefined]]), "a\t1\n\t");
  });

  test("tsv round-trips through parse", () => {
    const rows = [["name", "n"], ["alice", "42"]];
    assert.deepEqual(parseClipboardText(toTsv(rows)), rows);
  });
});

// ---------------------------------------------------------------------------
describe("sheet-ui: fill handle", () => {
  const src = { top: 2, left: 2, bottom: 3, right: 3 };

  test("fillRange extends downward", () => {
    assert.deepEqual(fillRange(src, 7, 2), { top: 4, bottom: 7, left: 2, right: 3 });
  });

  test("fillRange extends upward and leftward", () => {
    assert.deepEqual(fillRange(src, 0, 3), { top: 0, bottom: 1, left: 2, right: 3 });
    assert.deepEqual(fillRange(src, 2, 0), { top: 2, bottom: 3, left: 0, right: 1 });
  });

  test("fillRange picks the dominant direction", () => {
    // 4 below vs 1 right -> vertical wins
    assert.deepEqual(fillRange(src, 7, 4), { top: 4, bottom: 7, left: 2, right: 3 });
    // 1 below vs 4 right -> horizontal wins
    assert.deepEqual(fillRange(src, 4, 7), { top: 2, bottom: 3, left: 4, right: 7 });
  });

  test("fillRange returns null inside the source", () => {
    assert.equal(fillRange(src, 2, 3), null);
  });

  test("fillMapping tiles the source pattern downward", () => {
    const source = { top: 0, left: 0, bottom: 1, right: 0 }; // 2-row pattern
    const target = { top: 2, left: 0, bottom: 5, right: 0 };
    const map = fillMapping(source, target);
    assert.deepEqual(map.map((m) => m.from.row), [0, 1, 0, 1]);
    assert.deepEqual(map.map((m) => m.to.row), [2, 3, 4, 5]);
  });

  test("fillMapping keeps phase alignment when filling upward", () => {
    const source = { top: 4, left: 0, bottom: 5, right: 0 };
    const target = { top: 1, left: 0, bottom: 3, right: 0 };
    const map = fillMapping(source, target);
    // rows 1,2,3 map to source rows 5,4,5 (pattern anchored at source.top)
    assert.deepEqual(map.map((m) => m.from.row), [5, 4, 5]);
  });

  test("pasteMapping phases from the target's top-left", () => {
    const source = { top: 4, left: 0, bottom: 5, right: 0 };
    const target = { top: 1, left: 0, bottom: 3, right: 0 };
    const map = pasteMapping(source, target);
    assert.deepEqual(map.map((m) => m.from.row), [4, 5, 4]);
  });

  test("pasteTargetRange expands a single cell to the block size", () => {
    const source = { top: 0, left: 0, bottom: 2, right: 1 };
    const sel = createSelection(10, 4);
    assert.deepEqual(pasteTargetRange(source, sel), { top: 10, left: 4, bottom: 12, right: 5 });
  });

  test("pasteTargetRange keeps a multi-cell selection for tiling", () => {
    const source = { top: 0, left: 0, bottom: 0, right: 0 };
    const sel = { anchor: { row: 5, col: 0 }, focus: { row: 8, col: 1 }, active: { row: 5, col: 0 } };
    assert.deepEqual(pasteTargetRange(source, sel), { top: 5, left: 0, bottom: 8, right: 1 });
  });
});

// ---------------------------------------------------------------------------
describe("sheet-ui: formula reference extraction", () => {
  test("finds refs and ranges with positions", () => {
    const refs = extractFormulaRefs("=SUM(A1:B2)+C3");
    assert.equal(refs.length, 2);
    assert.equal(refs[0].text, "A1:B2");
    assert.equal(refs[0].start, 5);
    assert.equal(refs[0].end, 10);
    assert.equal(refs[1].text, "C3");
    assert.deepEqual(refs[1].range, { top: 2, left: 2, bottom: 2, right: 2 });
  });

  test("absolute markers and column ranges parse", () => {
    const refs = extractFormulaRefs("=SUMIF($B$2:B101,\"Black\",E:E)");
    assert.deepEqual(refs.map((r) => r.text), ["$B$2:B101", "E:E"]);
  });

  test("same reference gets the same color; distinct refs differ", () => {
    const refs = extractFormulaRefs("=A1+B2+A1");
    assert.equal(refs[0].colorIndex, refs[2].colorIndex);
    assert.notEqual(refs[0].colorIndex, refs[1].colorIndex);
  });

  test("references inside string literals are ignored", () => {
    const refs = extractFormulaRefs("=COUNTIF(A1:A10,\"B2\")");
    assert.deepEqual(refs.map((r) => r.text), ["A1:A10"]);
  });

  test("function names that look like refs are not matched", () => {
    assert.deepEqual(extractFormulaRefs("=LOG10(5)"), []);
  });

  test("non-formula input yields no refs", () => {
    assert.deepEqual(extractFormulaRefs("hello A1"), []);
    assert.deepEqual(extractFormulaRefs(42), []);
  });

  test("formulaSegments reconstruct the exact input", () => {
    const input = "=XLOOKUP(A2,B2:B101,E2:E101)&\" done\"";
    const segs = formulaSegments(input);
    assert.equal(segs.map((s) => s.text).join(""), input);
    assert.equal(segs.filter((s) => s.colorIndex !== null).length, 3);
  });
});

// ---------------------------------------------------------------------------
describe("sheet-ui: function autocomplete helpers", () => {
  test("functionPrefix finds the partial name at the caret", () => {
    assert.deepEqual(functionPrefix("=SU"), { prefix: "SU", start: 1 });
    assert.deepEqual(functionPrefix("=1+cou"), { prefix: "cou", start: 3 });
  });

  test("functionPrefix is null outside formulas and inside strings", () => {
    assert.equal(functionPrefix("SU"), null);
    assert.equal(functionPrefix("=\"SU"), null);
    assert.equal(functionPrefix("=SUM("), null);
  });

  test("functionContext reports the innermost call and arg index", () => {
    assert.deepEqual(functionContext("=SUM(A1,"), { name: "SUM", argIndex: 1 });
    assert.deepEqual(functionContext("=IF(SUM(A1:A2)>3,"), { name: "IF", argIndex: 1 });
    assert.deepEqual(functionContext("=IF(SUM(A1,"), { name: "SUM", argIndex: 1 });
  });

  test("functionContext ignores commas inside strings and closed calls", () => {
    assert.deepEqual(functionContext("=COUNTIF(A1:A10,\"a,b\""), { name: "COUNTIF", argIndex: 1 });
    assert.equal(functionContext("=SUM(A1)"), null);
  });
});

// ---------------------------------------------------------------------------
describe("sheet-ui: undo/redo history", () => {
  const op = (ref, before, after) => [{ ref, before, after }];

  test("record then undo returns the edit and moves it to redo", () => {
    let h = createHistory();
    h = recordEdit(h, op("A1", null, "5"));
    const u = undoEdit(h);
    assert.deepEqual(u.ops, op("A1", null, "5"));
    assert.equal(u.history.past.length, 0);
    assert.equal(u.history.future.length, 1);
    const r = redoEdit(u.history);
    assert.deepEqual(r.ops, op("A1", null, "5"));
    assert.equal(r.history.past.length, 1);
    assert.equal(r.history.future.length, 0);
  });

  test("a new edit clears the redo stack", () => {
    let h = createHistory();
    h = recordEdit(h, op("A1", null, "1"));
    h = undoEdit(h).history;
    h = recordEdit(h, op("B1", null, "2"));
    assert.equal(h.future.length, 0);
    assert.equal(h.past.length, 1);
  });

  test("history is trimmed to its limit", () => {
    let h = createHistory(3);
    for (let i = 0; i < 5; i++) h = recordEdit(h, op("A" + (i + 1), null, String(i)));
    assert.equal(h.past.length, 3);
    assert.equal(h.past[0][0].ref, "A3");
  });

  test("undo/redo on empty stacks return null; empty edits are no-ops", () => {
    const h = createHistory();
    assert.equal(undoEdit(h), null);
    assert.equal(redoEdit(h), null);
    assert.equal(recordEdit(h, []), h);
  });
});

// ---------------------------------------------------------------------------
describe("sheet-ui: selection stats", () => {
  test("counts filled cells and averages numbers only", () => {
    const stats = selectionStats([[1, 2, "x"], ["", null, 3]]);
    assert.equal(stats.count, 4);
    assert.equal(stats.numericCount, 3);
    assert.equal(stats.sum, 6);
    assert.equal(stats.average, 2);
  });

  test("no numbers -> null average", () => {
    const stats = selectionStats([["a", ""]]);
    assert.equal(stats.count, 1);
    assert.equal(stats.average, null);
  });
});

// ---------------------------------------------------------------------------
describe("sheet-ui: pivot builder helpers", () => {
  const records = [
    { race: "Black", approved: "APPROVED", loan: 100 },
    { race: "Black", approved: "DENIED", loan: 200 },
    { race: "White", approved: "APPROVED", loan: 300 },
    { race: "White", approved: "APPROVED", loan: 400 },
  ];

  test("buildPivotSpec normalizes builder state", () => {
    const spec = buildPivotSpec({
      rows: ["race"],
      cols: ["approved"],
      values: [{ field: "loan", agg: "count", showAs: "" }, { field: "" }],
      filters: { gender: [], race: ["Black"] },
    });
    assert.deepEqual(spec.rows, ["race"]);
    assert.deepEqual(spec.cols, ["approved"]);
    assert.deepEqual(spec.values, [{ field: "loan", agg: "count" }]);
    assert.deepEqual(spec.filters, { race: ["Black"] });
  });

  test("buildPivotSpec returns null without value fields", () => {
    assert.equal(buildPivotSpec({ rows: ["race"], values: [] }), null);
  });

  test("formatPivotCell renders engine FRACTIONS as percentages", () => {
    assert.equal(formatPivotCell(0.5625, "percentOfRowTotal"), "56.3%");
    assert.equal(formatPivotCell(1, "percentOfColumnTotal"), "100.0%");
    assert.equal(formatPivotCell(0.86, "percentOfColumnTotal"), "86.0%");
  });

  test("formatPivotCell leaves plain values alone", () => {
    assert.equal(formatPivotCell(76, null), "76");
    assert.equal(formatPivotCell(2.3456, ""), "2.35");
    assert.equal(formatPivotCell("", "percentOfRowTotal"), "");
    assert.equal(formatPivotCell(null, null), "");
  });

  test("pivotColumnMeta aligns with the pivotToGrid header", () => {
    const spec = buildPivotSpec({
      rows: ["race"],
      cols: ["approved"],
      values: [{ field: "loan", agg: "count", showAs: "percentOfRowTotal" }],
    });
    const result = pivotTable(records, spec);
    const grid = pivotToGrid(result);
    const meta = pivotColumnMeta(result);
    assert.equal(meta.length, grid[0].length);
    assert.equal(meta[0], null); // race label column
    assert.equal(meta[1].showAs, "percentOfRowTotal");
    // Black row: 1 approved of 2 -> 50%
    const blackRow = grid.find((r) => r[0] === "Black");
    assert.equal(formatPivotCell(blackRow[1], meta[1].showAs), "50.0%");
  });

  test("headerFields and distinctValues read a data grid", () => {
    const grid = [
      ["race", "loan", ""],
      ["White", 300, "x"],
      ["Black", 100, "y"],
      ["White", 200, ""],
    ];
    assert.deepEqual(headerFields(grid), ["race", "loan"]);
    assert.deepEqual(distinctValues(grid, "race"), ["Black", "White"]);
    assert.deepEqual(distinctValues(grid, "loan"), [100, 200, 300]);
    assert.deepEqual(distinctValues(grid, "missing"), []);
  });
});
