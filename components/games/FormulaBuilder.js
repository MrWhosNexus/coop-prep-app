"use client";

import { useCallback, useMemo, useState } from "react";
import GameHost, { useItemTimer } from "./GameHost";
import { checkFormulaBuilder, generateFormulaBuilder, makeRng, shuffle } from "@/lib/games/generators";
import { scoreRound } from "@/lib/games/scoring";

/**
 * Assemble an Excel formula from shuffled tokens.
 *
 * Targets the specific thing that breaks in a live Excel interview: you
 * know what XLOOKUP does, and then you can't remember the argument order.
 * Recognising the syntax in a lesson does not fix that; producing it does.
 *
 * Every formula here is mined out of the curriculum's own prose by
 * generators.extractFormulas() — nothing is authored per-lesson — and the
 * distractor tokens come from other real formulas, so the wrong options are
 * plausible Excel (VLOOKUP's `col_index` sitting next to XLOOKUP's
 * `return_array`) rather than obvious filler.
 *
 * @param {object} props
 * @param {object[]} props.formulas from lib/games/generators extractFormulas()
 * @param {number} [props.count] formulas per round
 * @param {number} [props.seed]
 * @param {(summary: object) => void} [props.onComplete]
 * @param {Function} [props.onExit]
 */
export default function FormulaBuilder({ formulas, count = 4, seed, onComplete, onExit, objective, guided, onAdvance }) {
  const [nonce, setNonce] = useState(0);

  // One round = several distinct formulas, drawn without replacement.
  const rounds = useMemo(() => {
    const rng = makeRng((seed ?? 1) + nonce * 7717);
    const order = shuffle([...formulas.keys()], rng).slice(0, count);
    return order.map((index) => generateFormulaBuilder(formulas, { index, rng })).filter(Boolean);
  }, [formulas, count, seed, nonce]);

  const [i, setI] = useState(0);
  const [placed, setPlaced] = useState([]);
  const [judged, setJudged] = useState(null);
  const [events, setEvents] = useState([]);
  const [review, setReview] = useState([]);
  const [done, setDone] = useState(false);
  const { elapsed } = useItemTimer();

  const round = rounds[i];

  const place = useCallback((id) => {
    if (judged) return;
    setPlaced((p) => (p.includes(id) ? p : [...p, id]));
  }, [judged]);

  function unplace(id) {
    if (judged) return;
    setPlaced((p) => p.filter((x) => x !== id));
  }

  function check() {
    if (!round || judged) return;
    const result = checkFormulaBuilder(round, placed);
    const ms = elapsed();
    setJudged(result);
    setEvents((e) => [...e, { correct: result.correct, ms }]);
    setReview((r) => [...r, {
      conceptId: round.target,
      prompt: round.prompt,
      answer: round.target,
      explanation: "",
      correct: result.correct,
    }]);
  }

  function next() {
    if (i + 1 >= rounds.length) {
      setDone(true);
      onComplete?.(scoreRound(events));
    } else {
      setI(i + 1);
    }
    setPlaced([]);
    setJudged(null);
  }

  function replay() {
    setNonce((n) => n + 1);
    setI(0); setPlaced([]); setJudged(null);
    setEvents([]); setReview([]); setDone(false);
  }

  if (!rounds.length) {
    return <div className="g-panel g-empty">No formulas found in this material.</div>;
  }

  const summary = done ? scoreRound(events) : null;
  const byId = new Map((round?.tokens ?? []).map((t) => [t.id, t.text]));
  const preview = placed.map((id) => byId.get(id)).join("").replace(/,/g, ", ");

  return (
    <GameHost
      title="Formula Builder"
      subtitle="Assemble the formula — argument order counts"
      index={i}
      total={rounds.length}
      events={events}
      summary={summary}
      review={review}
      onReplay={replay}
      onExit={onExit}
      objective={objective}
      guided={guided}
      onAdvance={onAdvance}
    >
      {round && (
        <div className="g-panel">
          <div className="g-eyebrow">{round.label}</div>
          <p className="g-prompt">{round.prompt}</p>

          <div className="g-slots" style={{ marginTop: 14 }} aria-label="Your formula" aria-live="polite">
            {placed.length === 0
              ? <span className="g-slots-empty">Tap tokens below to build the formula…</span>
              : placed.map((id) => (
                <button
                  type="button"
                  key={id}
                  className="g-token placed"
                  onClick={() => unplace(id)}
                  disabled={Boolean(judged)}
                  aria-label={`Remove ${byId.get(id)}`}
                >
                  {byId.get(id)}
                </button>
              ))}
          </div>

          <div className="g-tokens" aria-label="Available tokens">
            {round.tokens.map((t) => (
              <button
                type="button"
                key={t.id}
                className="g-token"
                onClick={() => place(t.id)}
                disabled={placed.includes(t.id) || Boolean(judged)}
              >
                {t.text}
              </button>
            ))}
          </div>

          <div className="g-actions" style={{ justifyContent: "flex-start", marginTop: 16 }}>
            {!judged && (
              <>
                <button type="button" className="btn-primary" onClick={check} disabled={!placed.length}>Check</button>
                <button type="button" className="btn-ghost" onClick={() => setPlaced([])} disabled={!placed.length}>Clear</button>
              </>
            )}
            {judged && (
              <button type="button" className="btn-primary" onClick={next} autoFocus>
                {i + 1 >= rounds.length ? "See results" : "Next formula"}
              </button>
            )}
          </div>

          {judged && (
            <div className={`g-feedback ${judged.correct ? "ok" : "bad"}`}>
              <div className="g-feedback-head">{judged.correct ? "✓ That's the syntax" : "✗ Not quite"}</div>
              {!judged.correct && (
                <div style={{ marginBottom: 6 }}>
                  You built <span className="g-feedback-answer">{judged.assembled || "(nothing)"}</span>
                </div>
              )}
              <div>
                {judged.correct ? "" : "The formula is "}
                <span className="g-feedback-answer">{round.target}</span>
              </div>
            </div>
          )}

          {!judged && preview && (
            <div className="g-formula-bar" style={{ marginTop: 12, marginBottom: 0 }}>
              <b>fx</b> {preview}
            </div>
          )}
        </div>
      )}
    </GameHost>
  );
}
