"use client";

import { useCallback, useMemo, useState } from "react";
import GameHost from "./GameHost";
import { checkErrorHunt, generateErrorHunt, makeRng } from "@/lib/games/generators";
import { deserializeSheet, formatValue, getCell, setCells } from "@/lib/sheet/model";

const COLS = ["A", "B", "C", "D", "E", "F"];

/**
 * Find and fix the bug in a broken spreadsheet.
 *
 * The workbook is a real lib/sheet workbook computing the real four-fifths
 * test on the verified HMDA numbers, and it is broken with a real Excel
 * mistake (an unanchored MAX range, a flipped comparison, a swapped
 * numerator). Nothing is simulated:
 *
 *  - every value on screen is evaluated by the sheet engine as you type
 *  - the fix is graded by recomputing the workbook and comparing all twelve
 *    computed cells to the truth, so ANY formula that produces the right
 *    numbers passes — not just the one we had in mind
 *
 * That property is the whole point. Debugging a spreadsheet is a real skill
 * and it cannot be taught by a multiple-choice question about it.
 *
 * @param {object} props
 * @param {number} [props.seed]
 * @param {string} [props.kind] force a specific bug (see generators.BUG_KINDS)
 * @param {(summary: object) => void} [props.onComplete]
 * @param {Function} [props.onExit]
 */
export default function ErrorHunt({ seed, kind, onComplete, onExit, objective, guided, onAdvance }) {
  const [nonce, setNonce] = useState(0);
  const round = useMemo(
    () => generateErrorHunt({ rng: makeRng((seed ?? 1) + nonce * 6151), kind }),
    [seed, kind, nonce],
  );

  const [edits, setEdits] = useState({});
  const [editing, setEditing] = useState(null); // ref being edited
  const [draft, setDraft] = useState("");
  const [checked, setChecked] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [tries, setTries] = useState(0);
  const [done, setDone] = useState(false);

  // The live sheet: the broken workbook plus whatever the learner has typed,
  // recomputed by the real engine on every edit.
  const sheet = useMemo(() => {
    const s = deserializeSheet(round.sheet);
    setCells(s, edits);
    return s;
  }, [round, edits]);

  const rows = useMemo(() => {
    const n = new Set();
    for (const ref of round.verifyRefs) n.add(Number(ref.slice(1)));
    return [1, ...[...n].sort((a, b) => a - b)];
  }, [round]);

  const cellText = useCallback((ref) => {
    const c = getCell(sheet, ref);
    return c ? formatValue(c.value) : "";
  }, [sheet]);

  const cellInput = useCallback((ref) => {
    const c = getCell(sheet, ref);
    return c ? String(c.input ?? "") : "";
  }, [sheet]);

  function beginEdit(ref) {
    if (done) return;
    setEditing(ref);
    setDraft(cellInput(ref));
    setChecked(null);
  }

  function commitEdit() {
    if (!editing) return;
    setEdits((e) => ({ ...e, [editing]: draft }));
    setEditing(null);
    setDraft("");
  }

  function check() {
    const result = checkErrorHunt(round, edits);
    setChecked(result);
    setTries((t) => t + 1);
    if (result.solved) {
      setDone(true);
      // Fewer tries and no hint is a stronger result, but the concept either
      // got debugged or it didn't -- so this scores as one item, honestly.
      onComplete?.({
        correct: 1, total: 1, accuracy: 1,
        points: Math.max(40, 100 - tries * 15 - (showHint ? 20 : 0)),
        bestStreak: 1, finalStreak: 1, medianMs: null,
      });
    }
  }

  function replay() {
    setNonce((n) => n + 1);
    setEdits({}); setEditing(null); setDraft("");
    setChecked(null); setShowHint(false); setTries(0); setDone(false);
  }

  const summary = done
    ? { correct: 1, total: 1, accuracy: 1, points: Math.max(40, 100 - (tries - 1) * 15 - (showHint ? 20 : 0)), bestStreak: 1, finalStreak: 1, medianMs: null }
    : null;

  const wrongSet = new Set(checked && !checked.solved ? checked.wrong : []);

  return (
    <GameHost
      title="Error Hunt"
      subtitle="One formula is wrong. Find it, fix it."
      index={done ? 1 : 0}
      total={1}
      events={done ? [{ correct: true }] : []}
      summary={summary}
      review={done ? [{
        conceptId: round.bug.kind,
        prompt: round.title,
        answer: round.solution.input,
        explanation: round.bug.explanation,
        correct: true,
      }] : []}
      onReplay={replay}
      onExit={onExit}
      objective={objective}
      guided={guided}
      onAdvance={onAdvance}
    >
      <div className="g-panel">
        <div className="g-eyebrow">{round.title}</div>
        <p className="g-sub" style={{ marginBottom: 14 }}>{round.brief}</p>

        <div className="g-formula-bar">
          <b>fx</b>
          <span>{editing ? `${editing}` : "Click any cell to see and edit its formula"}</span>
        </div>

        <div className="g-sheet-wrap">
          <table className="g-sheet">
            <thead>
              <tr>
                <th aria-label="row numbers" />
                {COLS.map((c) => <th key={c} scope="col">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r}>
                  <th className="g-rowhead" scope="row">{r}</th>
                  {COLS.map((c) => {
                    const ref = `${c}${r}`;
                    const isHeader = r === 1;
                    const editable = round.editableRefs.includes(ref);
                    if (editing === ref) {
                      return (
                        <td key={ref} className="g-cell editing">
                          <input
                            className="g-cell-input"
                            value={draft}
                            autoFocus
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit();
                              if (e.key === "Escape") { setEditing(null); setDraft(""); }
                            }}
                            aria-label={`Formula for ${ref}`}
                          />
                        </td>
                      );
                    }
                    const cls = `g-cell ${isHeader ? "head" : ""} ${wrongSet.has(ref) ? "bad" : ""}`;
                    return (
                      <td key={ref}>
                        {editable && !done ? (
                          <button type="button" className={`${cls} g-cell-btn`} onClick={() => beginEdit(ref)}>
                            {cellText(ref) || " "}
                          </button>
                        ) : (
                          <span className={cls}>{cellText(ref) || " "}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="g-actions" style={{ justifyContent: "flex-start", marginTop: 14 }}>
          <button type="button" className="btn-primary" onClick={check} disabled={done}>Check the numbers</button>
          {!showHint && !done && (
            <button type="button" className="btn-ghost" onClick={() => setShowHint(true)}>Hint</button>
          )}
        </div>

        {showHint && !done && (
          <div className="g-feedback near">
            <div className="g-feedback-head">Hint</div>
            {round.bug.hint}
          </div>
        )}

        {checked && !checked.solved && (
          <div className="g-feedback bad">
            <div className="g-feedback-head">✗ {checked.wrong.length} cell{checked.wrong.length === 1 ? "" : "s"} still wrong</div>
            Highlighted in red: <span className="g-feedback-answer">{checked.wrong.join(", ")}</span>.
            {" "}A wrong formula poisons every cell downstream of it, so start at the leftmost red column.
          </div>
        )}

        {checked?.solved && (
          <div className="g-feedback ok">
            <div className="g-feedback-head">✓ Fixed — every cell now matches</div>
            {round.bug.explanation}
          </div>
        )}
      </div>
    </GameHost>
  );
}
