"use client";

// Virtualized spreadsheet grid. Renders only the visible row window (plus
// overscan) so it stays smooth at 5,000+ rows. All selection/nav math lives
// in sheet-logic.js; all cell values come from the lib/sheet engine.
//
// Selection, clipboard and fill overlays are single positioned divs (rings),
// not per-cell borders, so a selection change touches O(visible) DOM nodes.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { colToLetters } from "../../lib/sheet/cells.js";
import { getCell, getValue, formatValue } from "../../lib/sheet/model.js";
import { isError } from "../../lib/sheet/functions.js";
import {
  ROW_HEIGHT, HEADER_HEIGHT, ROW_HEADER_WIDTH, DEFAULT_COL_WIDTH,
  visibleWindow, selectionRange, isSingleCell, createSelection,
  moveFocus, advanceActive, colOffset, totalWidth, clampColWidth,
  fillRange, cellKey,
} from "./sheet-logic.js";

const NAV_KEYS = {
  ArrowDown: { dRow: 1, dCol: 0 },
  ArrowUp: { dRow: -1, dCol: 0 },
  ArrowRight: { dRow: 0, dCol: 1 },
  ArrowLeft: { dRow: 0, dCol: -1 },
};
const TYPE_COMMIT_NAV = { ArrowDown: "down", ArrowUp: "up", ArrowRight: "right", ArrowLeft: "left" };

/** Pixel width of a column. */
function widthOf(colWidths, col) {
  const w = colWidths ? colWidths[col] : undefined;
  return typeof w === "number" ? w : DEFAULT_COL_WIDTH;
}

/** Canvas-space rectangle of a cell range. */
function rangeRect(range, colWidths) {
  const left = ROW_HEADER_WIDTH + colOffset(range.left, colWidths);
  return {
    left,
    top: HEADER_HEIGHT + range.top * ROW_HEIGHT,
    width: ROW_HEADER_WIDTH + colOffset(range.right + 1, colWidths) - left,
    height: (range.bottom - range.top + 1) * ROW_HEIGHT,
  };
}

/* ── Memoized body: the only part that renders cells ──────────────────── */

const GridBody = memo(function GridBody({
  sheet, version, start, end, colCount, colWidths, selRange, active, gridId,
}) {
  void version; // memo dependency: cell values changed
  const rows = [];
  for (let r = start; r <= end; r++) {
    const cells = [];
    const rowSelected = r >= selRange.top && r <= selRange.bottom;
    cells.push(
      <div
        key="h"
        className={"sg-rowheader" + (rowSelected ? " insel" : "")}
        style={{ width: ROW_HEADER_WIDTH, height: ROW_HEIGHT }}
        data-hr={r}
        role="rowheader"
      >
        {r + 1}
      </div>
    );
    for (let c = 0; c < colCount; c++) {
      const v = getValue(sheet, { row: r, col: c });
      let cls = "sg-cell";
      if (typeof v === "number") cls += " num";
      else if (typeof v === "boolean") cls += " bool";
      else if (isError(v)) cls += " err";
      const inSel = rowSelected && c >= selRange.left && c <= selRange.right;
      const isActive = r === active.row && c === active.col;
      if (inSel && !isActive) cls += " sel";
      if (isActive) cls += " active";
      cells.push(
        <div
          key={c}
          id={`${gridId}-c-${r}-${c}`}
          className={cls}
          style={{ width: widthOf(colWidths, c), height: ROW_HEIGHT }}
          data-r={r}
          data-c={c}
          role="gridcell"
          aria-colindex={c + 2}
          aria-selected={inSel || isActive ? true : undefined}
        >
          {v === undefined ? "" : formatValue(v)}
        </div>
      );
    }
    rows.push(
      <div key={r} className="sg-row" role="row" aria-rowindex={r + 2}>
        {cells}
      </div>
    );
  }
  return (
    <div className="sg-body" style={{ top: HEADER_HEIGHT + start * ROW_HEIGHT }}>
      {rows}
    </div>
  );
});

const ColumnHeaders = memo(function ColumnHeaders({ colCount, colWidths, selRange }) {
  const headers = [
    <div key="corner" className="sg-corner" style={{ width: ROW_HEADER_WIDTH, height: HEADER_HEIGHT }} data-corner="1" title="Select all" />,
  ];
  for (let c = 0; c < colCount; c++) {
    const inSel = c >= selRange.left && c <= selRange.right;
    headers.push(
      <div
        key={c}
        className={"sg-colheader" + (inSel ? " insel" : "")}
        style={{ width: widthOf(colWidths, c), height: HEADER_HEIGHT }}
        data-hc={c}
        role="columnheader"
        aria-colindex={c + 2}
      >
        {colToLetters(c)}
        <div className="sg-resize-handle" data-resize={c} />
      </div>
    );
  }
  return <div className="sg-colheaders" role="row" aria-rowindex={1}>{headers}</div>;
});

/* ── In-cell editor ────────────────────────────────────────────────────── */

function CellEditor({ rect, value, startMode, onChange, onCommit, onCancel }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, []);
  return (
    <input
      ref={ref}
      className="sg-editor"
      style={{ left: rect.left, top: rect.top, width: Math.max(rect.width, 160), height: rect.height + 2 }}
      value={value}
      spellCheck={false}
      autoComplete="off"
      aria-label="Cell editor"
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(e.shiftKey ? "up" : "down");
        } else if (e.key === "Tab") {
          e.preventDefault();
          onCommit(e.shiftKey ? "left" : "right");
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        } else if (TYPE_COMMIT_NAV[e.key] && startMode === "type" && !value.startsWith("=")) {
          // typing-started edits commit on arrows, like Excel's Enter mode
          e.preventDefault();
          onCommit(TYPE_COMMIT_NAV[e.key]);
        }
      }}
    />
  );
}

/* ── Grid ──────────────────────────────────────────────────────────────── */

/**
 * The interactive grid.
 * @param {object} props see call site in SheetTool
 */
export default function Grid({
  sheet, version, rowCount, colCount,
  selection, onSelectionChange,
  editing, onEditingChange, onCommitEdit, onCancelEdit,
  colWidths, onColWidthChange,
  onClearRange, onCopy, onPaste, onUndo, onRedo, onFill, onEscape,
  highlightRanges = [],
  clipRange = null,
  gridId = "sg",
  registerFocus = null,
}) {
  const viewportRef = useRef(null);
  const scrollPos = useRef({ top: 0, left: 0 });
  const scrollRaf = useRef(0);
  const dragRef = useRef(null); // {mode: "select"|"fill"}
  const [viewportH, setViewportH] = useState(400);
  const [win, setWin] = useState({ start: 0, end: 40 });
  const [fillPreview, setFillPreview] = useState(null);
  const [resizing, setResizing] = useState(null); // {col, startX, startW}

  const selRange = useMemo(() => selectionRange(selection), [selection]);
  const active = selection.active;
  const maxRow = rowCount - 1;
  const maxCol = colCount - 1;

  const updateWindow = useCallback(() => {
    const next = visibleWindow(scrollPos.current.top, viewportH, ROW_HEIGHT, rowCount, 6);
    setWin((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
  }, [viewportH, rowCount]);

  useEffect(updateWindow, [updateWindow]);

  // viewport size tracking
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight));
    ro.observe(el);
    setViewportH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const handleScroll = useCallback((e) => {
    const el = e.currentTarget;
    scrollPos.current = { top: el.scrollTop, left: el.scrollLeft };
    if (scrollRaf.current) return;
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = 0;
      updateWindow();
    });
  }, [updateWindow]);

  // keep the active cell in view when navigating
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const top = HEADER_HEIGHT + active.row * ROW_HEIGHT;
    const bottom = top + ROW_HEIGHT;
    const left = ROW_HEADER_WIDTH + colOffset(active.col, colWidths);
    const right = left + widthOf(colWidths, active.col);
    if (top - HEADER_HEIGHT < el.scrollTop) el.scrollTop = top - HEADER_HEIGHT;
    else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
    if (left - ROW_HEADER_WIDTH < el.scrollLeft) el.scrollLeft = left - ROW_HEADER_WIDTH;
    else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth;
  }, [active.row, active.col, colWidths]);

  // column resize drag
  useEffect(() => {
    if (!resizing) return undefined;
    const move = (e) => onColWidthChange(resizing.col, clampColWidth(resizing.startW + e.clientX - resizing.startX));
    const up = () => setResizing(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [resizing, onColWidthChange]);

  // selection / fill drag end
  useEffect(() => {
    const up = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag && drag.mode === "fill") {
        setFillPreview((preview) => {
          if (preview) {
            onFill(drag.source, preview);
            onSelectionChange({
              anchor: { row: Math.min(drag.source.top, preview.top), col: Math.min(drag.source.left, preview.left) },
              focus: { row: Math.max(drag.source.bottom, preview.bottom), col: Math.max(drag.source.right, preview.right) },
              active: { row: drag.source.top, col: drag.source.left },
            });
          }
          return null;
        });
      }
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [onFill, onSelectionChange]);

  const cellFromEvent = (e) => {
    const el = e.target.closest("[data-r]");
    if (!el) return null;
    return { row: Number(el.dataset.r), col: Number(el.dataset.c) };
  };

  const focusGrid = useCallback(() => {
    if (viewportRef.current) viewportRef.current.focus();
  }, []);
  useEffect(() => {
    if (registerFocus) registerFocus(focusGrid);
  }, [registerFocus, focusGrid]);

  function handleMouseDown(e) {
    if (e.button !== 0) return;
    const resizeEl = e.target.closest("[data-resize]");
    if (resizeEl) {
      const col = Number(resizeEl.dataset.resize);
      setResizing({ col, startX: e.clientX, startW: widthOf(colWidths, col) });
      e.preventDefault();
      return;
    }
    if (e.target.closest(".sg-fill-handle")) {
      dragRef.current = { mode: "fill", source: selRange };
      e.preventDefault();
      return;
    }
    const corner = e.target.closest("[data-corner]");
    if (corner) {
      onSelectionChange({ anchor: { row: 0, col: 0 }, focus: { row: maxRow, col: maxCol }, active: { row: 0, col: 0 } });
      return;
    }
    const colHead = e.target.closest("[data-hc]");
    if (colHead) {
      const c = Number(colHead.dataset.hc);
      onSelectionChange({ anchor: { row: 0, col: c }, focus: { row: maxRow, col: c }, active: { row: 0, col: c } });
      return;
    }
    const rowHead = e.target.closest("[data-hr]");
    if (rowHead) {
      const r = Number(rowHead.dataset.hr);
      onSelectionChange({ anchor: { row: r, col: 0 }, focus: { row: r, col: maxCol }, active: { row: r, col: 0 } });
      return;
    }
    const cell = cellFromEvent(e);
    if (!cell) return;
    if (editing) {
      // "point mode": clicking a cell mid-formula inserts its reference
      if (editing.text.startsWith("=") && /[=+\-*/^&,(<>:]$/.test(editing.text)) {
        e.preventDefault();
        onEditingChange({ ...editing, text: editing.text + cellKey(cell.row, cell.col) });
        return;
      }
      onCommitEdit(editing.text, null);
    }
    if (e.shiftKey) {
      onSelectionChange({ anchor: { ...selection.anchor }, focus: cell, active: { ...selection.active } });
    } else {
      onSelectionChange(createSelection(cell.row, cell.col));
    }
    dragRef.current = { mode: "select" };
  }

  function handleMouseOver(e) {
    const drag = dragRef.current;
    if (!drag) return;
    const cell = cellFromEvent(e);
    if (!cell) return;
    if (drag.mode === "select") {
      onSelectionChange({ anchor: { ...selection.anchor }, focus: cell, active: { ...selection.active } });
    } else if (drag.mode === "fill") {
      setFillPreview(fillRange(drag.source, cell.row, cell.col));
    }
  }

  function handleDoubleClick(e) {
    const cell = cellFromEvent(e);
    if (!cell || editing) return;
    const rec = getCell(sheet, { row: cell.row, col: cell.col });
    const input = rec === null || rec.input === null || rec.input === undefined ? "" : String(rec.input);
    onEditingChange({ source: "cell", text: input, startMode: "edit" });
  }

  function handleKeyDown(e) {
    if (editing) return; // the editor input handles its own keys
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key;

    if (ctrl && !e.altKey) {
      const k = key.toLowerCase();
      if (k === "c") { e.preventDefault(); onCopy("copy"); return; }
      if (k === "x") { e.preventDefault(); onCopy("cut"); return; }
      if (k === "v") { e.preventDefault(); onPaste(); return; }
      if (k === "z") { e.preventDefault(); if (e.shiftKey) onRedo(); else onUndo(); return; }
      if (k === "y") { e.preventDefault(); onRedo(); return; }
      if (k === "a") {
        e.preventDefault();
        onSelectionChange({ anchor: { row: 0, col: 0 }, focus: { row: maxRow, col: maxCol }, active: { row: 0, col: 0 } });
        return;
      }
      if (key === "Home") {
        e.preventDefault();
        onSelectionChange(createSelection(0, 0));
        return;
      }
    }

    if (NAV_KEYS[key]) {
      e.preventDefault();
      const { dRow, dCol } = NAV_KEYS[key];
      onSelectionChange(moveFocus(selection, dRow, dCol, { extend: e.shiftKey, maxRow, maxCol }));
      return;
    }
    if (key === "Tab") {
      e.preventDefault();
      onSelectionChange(advanceActive(selection, e.shiftKey ? "left" : "right", maxRow, maxCol));
      return;
    }
    if (key === "Enter") {
      e.preventDefault();
      onSelectionChange(advanceActive(selection, e.shiftKey ? "up" : "down", maxRow, maxCol));
      return;
    }
    if (key === "Home") {
      e.preventDefault();
      onSelectionChange(createSelection(active.row, 0));
      return;
    }
    if (key === "PageDown" || key === "PageUp") {
      e.preventDefault();
      const page = Math.max(1, Math.floor(viewportH / ROW_HEIGHT) - 1);
      const d = key === "PageDown" ? page : -page;
      onSelectionChange(moveFocus(selection, d, 0, { extend: e.shiftKey, maxRow, maxCol }));
      return;
    }
    if (key === "Delete" || key === "Backspace") {
      e.preventDefault();
      onClearRange(selRange);
      return;
    }
    if (key === "F2") {
      e.preventDefault();
      const rec = getCell(sheet, active);
      const input = rec === null || rec.input === null || rec.input === undefined ? "" : String(rec.input);
      onEditingChange({ source: "cell", text: input, startMode: "edit" });
      return;
    }
    if (key === "Escape") {
      e.preventDefault();
      onEscape();
      return;
    }
    // type-to-edit: any printable character starts a fresh edit
    if (key.length === 1 && !ctrl && !e.altKey) {
      e.preventDefault();
      onEditingChange({ source: "cell", text: key, startMode: "type" });
    }
  }

  const totalW = ROW_HEADER_WIDTH + totalWidth(colCount, colWidths);
  const totalH = HEADER_HEIGHT + rowCount * ROW_HEIGHT;
  const selRect = rangeRect(selRange, colWidths);
  const activeRect = rangeRect({ top: active.row, left: active.col, bottom: active.row, right: active.col }, colWidths);
  const showFillHandle = !editing && !fillPreview;

  return (
    <div
      ref={viewportRef}
      className="sg-viewport"
      data-guide-target="sheet-grid"
      role="grid"
      aria-label={`Spreadsheet ${sheet.name}`}
      aria-rowcount={rowCount + 1}
      aria-colcount={colCount + 1}
      aria-multiselectable="true"
      aria-activedescendant={`${gridId}-c-${active.row}-${active.col}`}
      tabIndex={0}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onMouseOver={handleMouseOver}
      onDoubleClick={handleDoubleClick}
    >
      <div className="sg-canvas" style={{ width: totalW, height: totalH }}>
        <ColumnHeaders colCount={colCount} colWidths={colWidths} selRange={selRange} />
        <GridBody
          sheet={sheet}
          version={version}
          start={win.start}
          end={win.end}
          colCount={colCount}
          colWidths={colWidths}
          selRange={selRange}
          active={active}
          gridId={gridId}
        />

        {/* selection ring + fill handle */}
        <div className="sg-ring" style={isSingleCell(selection) ? activeRect : selRect} />
        {showFillHandle && (
          <div
            className="sg-fill-handle"
            style={{ left: selRect.left + selRect.width - 5, top: selRect.top + selRect.height - 5 }}
            title="Drag to fill"
          />
        )}

        {/* clipboard source (marching ants) */}
        {clipRange && <div className="sg-clipring" style={rangeRect(clipRange, colWidths)} />}

        {/* fill-drag preview */}
        {fillPreview && <div className="sg-fillring" style={rangeRect(fillPreview, colWidths)} />}

        {/* formula reference highlights */}
        {highlightRanges.map((h, i) =>
          h.range.top === null || h.range.top === undefined ? null : (
            <div
              key={i}
              className={`sg-hlring hl-${h.colorIndex % 5}`}
              style={rangeRect(h.range, colWidths)}
            />
          )
        )}

        {/* in-cell editor */}
        {editing && editing.source === "cell" && (
          <CellEditor
            rect={activeRect}
            value={editing.text}
            startMode={editing.startMode}
            onChange={(text) => onEditingChange({ ...editing, text })}
            onCommit={(nav) => {
              onCommitEdit(editing.text, nav);
              focusGrid();
            }}
            onCancel={() => {
              onCancelEdit();
              focusGrid();
            }}
          />
        )}
      </div>
    </div>
  );
}

export { rangeRect, widthOf };
