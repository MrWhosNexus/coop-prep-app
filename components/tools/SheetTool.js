"use client";

// Spreadsheet Lab — the Excel-clone tool shell. Owns the engine sheets
// (lib/sheet), selection/editing state, undo/redo, clipboard, CSV import,
// sheet tabs, and the side panels (pivot builder, function reference).
//
// Engine sheets are mutable objects (that is lib/sheet's designed API); the
// `version` counter is the render signal. Every mutation flows through ops
// ({ref, before, after}) so undo/redo replays raw inputs exactly.
//
// react-hooks/immutability is disabled for this file on purpose: the sheet
// store is an external mutable model mutated ONLY in event handlers, with
// re-render driven by `version` — never by observed object identity.
/* eslint-disable react-hooks/immutability */

import { useEffect, useMemo, useRef, useState, useId } from "react";

import "../sheet/sheet.css";

import {
  createSheet, setCells, getCell, getRangeValues, copyCell, formatValue,
  loadCsv, usedRange, translateFormula,
} from "../../lib/sheet/model.js";
import { parseRef } from "../../lib/sheet/cells.js";
import { forEachCellInRange } from "../../lib/sheet/cells.js";
import { serializeCsv } from "../../lib/sheet/csv.js";
import {
  createSelection, selectionRange, advanceActive, selectionStats,
  createHistory, recordEdit, undoEdit, redoEdit,
  parseClipboardText, toTsv, fillMapping, pasteMapping, pasteTargetRange,
  extractFormulaRefs, cellKey,
} from "../sheet/sheet-logic.js";
import Grid from "../sheet/Grid.js";
import FormulaBar from "../sheet/FormulaBar.js";
import PivotBuilder from "../sheet/PivotBuilder.js";
import FunctionHelp from "../sheet/FunctionHelp.js";

const HMDA_URL = "data/hmda-sample.csv";
const STATS_CELL_LIMIT = 60000;

let sheetSeq = 0;
function newSheetEntry(name) {
  sheetSeq += 1;
  return { id: `s${sheetSeq}`, name, sheet: createSheet(name), history: createHistory() };
}
/** Wrap an EXISTING engine sheet (from a guided checkpoint) as a store entry. */
function entryForSheet(name, sheet) {
  sheetSeq += 1;
  return { id: `s${sheetSeq}`, name, sheet, history: createHistory() };
}

/**
 * Build the store. Standalone (no seed) => a single blank Sheet1. Seeded from a
 * guided checkpoint toolState ({tool:"sheet", active, sheets:{name:sheet}}) =>
 * one entry per named sheet, wrapping the SAME engine objects the checkpoint
 * built so the observed tool state and the grid share one mutable model.
 */
function buildStore(seed) {
  if (seed && seed.sheets && Object.keys(seed.sheets).length > 0) {
    const entries = new Map();
    let firstId = null;
    let activeId = null;
    for (const name of Object.keys(seed.sheets)) {
      const e = entryForSheet(name, seed.sheets[name]);
      entries.set(e.id, e);
      if (firstId === null) firstId = e.id;
      if (name === seed.active) activeId = e.id;
    }
    return { entries, initialActiveId: activeId ?? firstId };
  }
  const first = newSheetEntry("Sheet1");
  return { entries: new Map([[first.id, first]]), initialActiveId: first.id };
}

/**
 * The Spreadsheet Lab tool. Self-contained; every prop is optional, so it runs
 * standalone (view==="tool") exactly as before when called with none.
 *
 * @param {Object} [props]
 * @param {{tool:"sheet",active?:string,sheets:Object}} [props.seed] a guided
 *   checkpoint tool state to open in, instead of a blank Sheet1.
 * @param {(toolState:{tool:"sheet",active:string,sheets:Object})=>void} [props.onStateChange]
 *   fired on mount and after every commit with the live grader-shaped tool
 *   state (no pivot — the guided host tracks that alongside).
 * @param {{ref:string,sheet?:string}} [props.targetRef] a cell to ring with the
 *   existing highlight ring (guided spotlight target).
 */
export default function SheetTool({ seed, onStateChange, targetRef } = {}) {
  const gridId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  // The store object is created once and NEVER replaced — its entries are the
  // external mutable model (engine sheets + history), re-rendered via version.
  const [store] = useState(() => buildStore(seed));

  const [sheetIds, setSheetIds] = useState(() => [...store.entries.keys()]);
  const [activeId, setActiveId] = useState(() => store.initialActiveId);
  const [version, setVersion] = useState(0);
  const [selection, setSelection] = useState(() => createSelection());
  const [editing, setEditing] = useState(null); // {source:"cell"|"bar", text, startMode}
  const [colWidthsBySheet, setColWidthsBySheet] = useState({});
  const [clipRange, setClipRange] = useState(null);
  const [showPivot, setShowPivot] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [renamingTab, setRenamingTab] = useState(null); // {id, text}
  const [notice, setNotice] = useState("");
  const clipRef = useRef(null); // {mode, range, sheetId, data: [[input]]}
  const fileInputRef = useRef(null);
  const focusGridRef = useRef(null);
  const registerFocus = (fn) => { focusGridRef.current = fn; };

  const entry = store.entries.get(activeId);
  const sheet = entry.sheet;
  const bump = () => setVersion((v) => v + 1);
  const focusGrid = () => focusGridRef.current && focusGridRef.current();

  /* ── mutation core: ops-based edits with history ── */

  function commitOps(ops) {
    if (ops.length === 0) return;
    entry.history = recordEdit(entry.history, ops);
    if (clipRef.current && clipRef.current.mode === "cut") clearClip();
    bump();
  }

  /** Set cells from [ref, input] pairs, recording history. */
  function applyChange(pairs) {
    const cleaned = pairs.map(([ref, input]) => [ref, input === "" ? null : input]);
    const ops = cleaned.map(([ref, after]) => {
      const rec = getCell(sheet, ref);
      return { ref, before: rec === null ? null : rec.input, after };
    });
    setCells(sheet, cleaned);
    commitOps(ops);
  }

  function handleUndo() {
    const r = undoEdit(entry.history);
    if (!r) return;
    entry.history = r.history;
    setCells(sheet, r.ops.map((o) => [o.ref, o.before]));
    bump();
  }

  function handleRedo() {
    const r = redoEdit(entry.history);
    if (!r) return;
    entry.history = r.history;
    setCells(sheet, r.ops.map((o) => [o.ref, o.after]));
    bump();
  }

  /* ── grid dimensions & derived data ── */

  const rowCount = Math.max(200, sheet.maxRow + 51);
  const colCount = Math.max(26, sheet.maxCol + 7);
  const selRange = selectionRange(selection);
  const activeRefStr = cellKey(selection.active.row, selection.active.col);
  const activeRec = getCell(sheet, activeRefStr);
  const activeInput = activeRec === null || activeRec.input === null || activeRec.input === undefined
    ? ""
    : String(activeRec.input);

  // The guided target ring: a single cell on the active sheet, drawn with the
  // same ring machinery as formula-reference highlights (Grid's sg-hlring).
  const targetRing = useMemo(() => {
    if (!targetRef?.ref) return null;
    if (targetRef.sheet && targetRef.sheet !== entry.name) return null;
    const p = parseRef(targetRef.ref);
    if (!p) return null;
    return { range: { top: p.row, left: p.col, bottom: p.row, right: p.col }, colorIndex: 4 };
  }, [targetRef, entry.name]);

  const highlightRanges = useMemo(() => {
    const formula = !editing || !editing.text.startsWith("=")
      ? []
      : extractFormulaRefs(editing.text).map((r) => ({ range: r.range, colorIndex: r.colorIndex }));
    return targetRing ? [...formula, targetRing] : formula;
  }, [editing, targetRing]);

  // Publish the live tool state to a guided host: mount + every version bump
  // (edits, undo/redo, sheet switches all bump). Grader shape, no pivot.
  useEffect(() => {
    if (typeof onStateChange !== "function") return;
    const sheets = {};
    for (const id of sheetIds) {
      const e = store.entries.get(id);
      if (e) sheets[e.name] = e.sheet;
    }
    onStateChange({ tool: "sheet", active: store.entries.get(activeId)?.name ?? null, sheets });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, activeId, sheetIds, onStateChange]);

  const stats = useMemo(() => {
    const area = (selRange.bottom - selRange.top + 1) * (selRange.right - selRange.left + 1);
    if (area <= 1) return null;
    const bottom = area > STATS_CELL_LIMIT
      ? selRange.top + Math.floor(STATS_CELL_LIMIT / (selRange.right - selRange.left + 1)) - 1
      : selRange.bottom;
    return selectionStats(getRangeValues(sheet, { ...selRange, bottom }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selRange.top, selRange.left, selRange.bottom, selRange.right, version, sheet]);

  const pivotGrid = useMemo(() => {
    if (!showPivot) return null;
    const used = usedRange(sheet);
    return used ? getRangeValues(sheet, used) : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPivot, version, sheet]);

  /* ── editing ── */

  function commitEdit(text, nav) {
    applyChange([[activeRefStr, text]]);
    setEditing(null);
    if (nav) {
      setSelection((sel) => advanceActive(sel, nav, rowCount - 1, colCount - 1));
    }
  }

  function cancelEdit() {
    setEditing(null);
  }

  function handleClearRange(range) {
    const pairs = [];
    forEachCellInRange(range, (r, c) => {
      if (getCell(sheet, { row: r, col: c }) !== null) pairs.push([cellKey(r, c), null]);
    });
    applyChange(pairs);
  }

  /* ── clipboard ── */

  function clearClip() {
    clipRef.current = null;
    setClipRange(null);
  }

  function handleCopy(mode) {
    const range = selRange;
    const data = [];
    for (let r = range.top; r <= range.bottom; r++) {
      const row = [];
      for (let c = range.left; c <= range.right; c++) {
        const rec = getCell(sheet, { row: r, col: c });
        row.push(rec === null ? null : rec.input);
      }
      data.push(row);
    }
    clipRef.current = { mode, range, sheetId: activeId, data };
    setClipRange(range);
    // best-effort system clipboard interop (display values as TSV)
    try {
      const display = getRangeValues(sheet, range).map((row) => row.map(formatValue));
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(toTsv(display)).catch(() => {});
      }
    } catch {
      /* clipboard unavailable — internal copy still works */
    }
  }

  function handlePaste() {
    const clip = clipRef.current;
    if (clip) {
      const target = pasteTargetRange(clip.range, selection);
      const mapping = pasteMapping(clip.range, target);
      const ops = [];
      const sameSheet = clip.sheetId === activeId;
      for (const { from, to } of mapping) {
        const toRef = cellKey(to.row, to.col);
        const rec = getCell(sheet, toRef);
        const before = rec === null ? null : rec.input;
        if (sameSheet) {
          // THE lesson: pasting a copied formula translates relative refs
          copyCell(sheet, cellKey(from.row, from.col), toRef);
        } else {
          const input = clip.data[from.row - clip.range.top][from.col - clip.range.left];
          const translated = typeof input === "string" && input.startsWith("=")
            ? translateFormula(input, to.row - from.row, to.col - from.col)
            : input;
          setCells(sheet, [[toRef, translated]]);
        }
        const after = getCell(sheet, toRef);
        ops.push({ ref: toRef, before, after: after === null ? null : after.input });
      }
      if (clip.mode === "cut" && sameSheet) {
        forEachCellInRange(clip.range, (r, c) => {
          if (r >= target.top && r <= target.bottom && c >= target.left && c <= target.right) return;
          const ref = cellKey(r, c);
          const rec = getCell(sheet, ref);
          if (rec !== null) {
            ops.push({ ref, before: rec.input, after: null });
            setCells(sheet, [[ref, null]]);
          }
        });
        clearClip();
      }
      entry.history = recordEdit(entry.history, ops);
      bump();
      setSelection({
        anchor: { row: target.top, col: target.left },
        focus: { row: target.bottom, col: target.right },
        active: { row: target.top, col: target.left },
      });
      return;
    }
    // external clipboard text
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then((text) => {
        const grid = parseClipboardText(text);
        if (grid.length === 0) return;
        const pairs = [];
        for (let r = 0; r < grid.length; r++) {
          for (let c = 0; c < grid[r].length; c++) {
            pairs.push([cellKey(selection.active.row + r, selection.active.col + c), grid[r][c]]);
          }
        }
        applyChange(pairs);
      }).catch(() => {});
    }
  }

  function handleFill(source, target) {
    const ops = [];
    for (const { from, to } of fillMapping(source, target)) {
      const toRef = cellKey(to.row, to.col);
      const rec = getCell(sheet, toRef);
      const before = rec === null ? null : rec.input;
      copyCell(sheet, cellKey(from.row, from.col), toRef);
      const after = getCell(sheet, toRef);
      ops.push({ ref: toRef, before, after: after === null ? null : after.input });
    }
    entry.history = recordEdit(entry.history, ops);
    bump();
  }

  /* ── sheets & CSV ── */

  function addSheetEntry(sheetEntry) {
    store.entries.set(sheetEntry.id, sheetEntry);
    setSheetIds((ids) => [...ids, sheetEntry.id]);
    switchSheet(sheetEntry.id);
  }

  function switchSheet(id) {
    setActiveId(id);
    setSelection(createSelection());
    setEditing(null);
    clearClip();
    bump();
  }

  function addSheet() {
    addSheetEntry(newSheetEntry(`Sheet${store.entries.size + 1}`));
  }

  function deleteSheet(id) {
    if (store.entries.size <= 1) return;
    store.entries.delete(id);
    const remaining = sheetIds.filter((x) => x !== id);
    setSheetIds(remaining);
    if (id === activeId) switchSheet(remaining[0]);
  }

  function renameSheet(id, name) {
    const e = store.entries.get(id);
    const trimmed = name.trim();
    if (e && trimmed !== "") {
      e.name = trimmed;
      e.sheet.name = trimmed;
    }
    setRenamingTab(null);
    bump();
  }

  function importCsvText(text, name) {
    const sheetEntry = newSheetEntry(name);
    const { rows, cols } = loadCsv(sheetEntry.sheet, text);
    addSheetEntry(sheetEntry);
    setNotice(`Loaded ${rows} rows × ${cols} columns into “${name}”.`);
  }

  function loadHmdaSample() {
    fetch(HMDA_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => importCsvText(text, "HMDA"))
      .catch((err) => setNotice(`Could not load the HMDA sample (${err.message}).`));
  }

  function handleFileImport(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importCsvText(String(reader.result), file.name.replace(/\.csv$/i, ""));
    reader.readAsText(file);
  }

  function exportCsv() {
    const used = usedRange(sheet);
    if (!used) {
      setNotice("Nothing to export — the sheet is empty.");
      return;
    }
    const rows = getRangeValues(sheet, used).map((row) => row.map(formatValue));
    const blob = new Blob([serializeCsv(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entry.name}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ── function-help insertion ── */

  function insertFromHelp(text) {
    if (text.startsWith("=")) {
      setEditing({ source: "bar", text, startMode: "edit" });
    } else {
      setEditing((prev) => {
        const base = prev ? prev.text : "=";
        return { source: prev ? prev.source : "bar", text: base + text, startMode: "edit" };
      });
    }
  }

  /* ── render ── */

  const canUndo = entry.history.past.length > 0;
  const canRedo = entry.history.future.length > 0;

  return (
    <div className="sheet-tool">
      <div className="sheet-toolbar glass">
        <span className="sheet-toolbar-title">Spreadsheet Lab</span>
        <button className="sheet-btn" onClick={loadHmdaSample}>Load HMDA sample</button>
        <button className="sheet-btn" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
          Import CSV…
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={handleFileImport}
          aria-hidden="true"
          tabIndex={-1}
        />
        <button className="sheet-btn" onClick={exportCsv}>Export CSV</button>
        <span className="spacer" />
        <button className="sheet-btn" onClick={handleUndo} disabled={!canUndo} aria-label="Undo (Ctrl+Z)">
          ⤺ Undo
        </button>
        <button className="sheet-btn" onClick={handleRedo} disabled={!canRedo} aria-label="Redo (Ctrl+Y)">
          ⤻ Redo
        </button>
        <button
          className={"sheet-btn" + (showPivot ? " active" : "")}
          onClick={() => { setShowPivot((v) => !v); setShowHelp(false); }}
          aria-pressed={showPivot}
        >
          Pivot Table
        </button>
        <button
          className={"sheet-btn" + (showHelp ? " active" : "")}
          onClick={() => { setShowHelp((v) => !v); setShowPivot(false); }}
          aria-pressed={showHelp}
        >
          Functions
        </button>
      </div>

      <FormulaBar
        activeRef={activeRefStr}
        value={editing ? editing.text : activeInput}
        isEditing={editing !== null}
        onChange={(text) => setEditing((prev) => ({
          source: prev ? prev.source : "bar",
          startMode: prev ? prev.startMode : "edit",
          text,
        }))}
        onStartEdit={() => setEditing({ source: "bar", text: activeInput, startMode: "edit" })}
        onCommit={(nav) => { commitEdit(editing ? editing.text : activeInput, nav); focusGrid(); }}
        onCancel={() => { cancelEdit(); focusGrid(); }}
      />

      <div className="sheet-main">
        <div className="sheet-grid-pane">
          <Grid
            sheet={sheet}
            version={version}
            rowCount={rowCount}
            colCount={colCount}
            selection={selection}
            onSelectionChange={setSelection}
            editing={editing}
            onEditingChange={setEditing}
            onCommitEdit={commitEdit}
            onCancelEdit={cancelEdit}
            colWidths={colWidthsBySheet[activeId]}
            onColWidthChange={(col, w) =>
              setColWidthsBySheet((m) => ({ ...m, [activeId]: { ...m[activeId], [col]: w } }))
            }
            onClearRange={handleClearRange}
            onCopy={handleCopy}
            onPaste={handlePaste}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onFill={handleFill}
            onEscape={clearClip}
            highlightRanges={highlightRanges}
            clipRange={clipRange}
            gridId={gridId}
            registerFocus={registerFocus}
          />

          <div className="sheet-status glass">
            <span>
              <b>{activeRefStr}</b>
            </span>
            {stats && stats.count > 0 && (
              <>
                <span>Count: <b>{stats.count}</b></span>
                {stats.numericCount > 0 && (
                  <>
                    <span>Sum: <b>{formatValue(stats.sum)}</b></span>
                    <span>Average: <b>{formatValue(stats.average)}</b></span>
                  </>
                )}
              </>
            )}
            <span className="hint">{notice || "Ctrl+C / Ctrl+V translate references, just like Excel. Drag the fill handle to extend a pattern."}</span>
          </div>

          <div className="sheet-tabs glass" role="tablist" aria-label="Sheets">
            {sheetIds.map((id) => {
              const e = store.entries.get(id);
              if (!e) return null;
              const isActive = id === activeId;
              if (renamingTab && renamingTab.id === id) {
                return (
                  <input
                    key={id}
                    className="sheet-tab-rename"
                    value={renamingTab.text}
                    autoFocus
                    aria-label="Rename sheet"
                    onChange={(ev) => setRenamingTab({ id, text: ev.target.value })}
                    onBlur={() => renameSheet(id, renamingTab.text)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter") renameSheet(id, renamingTab.text);
                      if (ev.key === "Escape") setRenamingTab(null);
                    }}
                  />
                );
              }
              return (
                <button
                  key={id}
                  className={"sheet-tab" + (isActive ? " active" : "")}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => { if (!isActive) switchSheet(id); }}
                  onDoubleClick={() => setRenamingTab({ id, text: e.name })}
                >
                  {e.name}
                  {sheetIds.length > 1 && (
                    <span
                      className="close"
                      role="button"
                      aria-label={`Delete ${e.name}`}
                      onClick={(ev) => { ev.stopPropagation(); deleteSheet(id); }}
                    >
                      ✕
                    </span>
                  )}
                </button>
              );
            })}
            <button className="sheet-tab" onClick={addSheet} aria-label="Add sheet">＋</button>
          </div>
        </div>

        {showPivot && (
          <div className="sheet-side-pane">
            <PivotBuilder grid={pivotGrid || []} onClose={() => setShowPivot(false)} />
          </div>
        )}
        {showHelp && (
          <div className="sheet-side-pane">
            <FunctionHelp onInsert={insertFromHelp} onClose={() => setShowHelp(false)} />
          </div>
        )}
      </div>
    </div>
  );
}
