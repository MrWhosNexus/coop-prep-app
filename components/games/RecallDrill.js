"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GameHost, { useItemTimer } from "./GameHost";
import { generateRecallDrill, makeRng } from "@/lib/games/generators";
import { gradeFromMatch, matchAnswer, scoreRound } from "@/lib/games/scoring";

/**
 * Active recall: read the prompt, type the answer from memory.
 *
 * This is the most effective format in the suite and the reason the rest
 * exist to feed it. No options are shown, because seeing the answer among
 * three wrong ones is recognition, and recognition is not what an interview
 * asks of you.
 *
 * Two details that matter:
 *  - A `near` result (a scale slip, or something very close) does not mark
 *    the item wrong. It offers one retry, because "you know this, mind the
 *    decimal" is a different problem than "you don't know this".
 *  - The answer is judged against this item's known WRONG answers as well
 *    as its right ones (see lib/games/scoring.js), so typo tolerance can
 *    never quietly accept a distractor.
 *
 * @param {object} props
 * @param {object[]} props.concepts from lib/games/generators extractConcepts()
 * @param {number} [props.count]
 * @param {number} [props.seed]
 * @param {(conceptId: string, grade: number, meta: object) => void} [props.onGrade]
 * @param {(summary: object) => void} [props.onComplete]
 * @param {Function} [props.onExit]
 */
export default function RecallDrill({ concepts, count = 8, seed, onGrade, onComplete, onExit, objective, guided, onAdvance }) {
  const [nonce, setNonce] = useState(0);
  const round = useMemo(
    () => generateRecallDrill(concepts, { count, rng: makeRng((seed ?? 1) + nonce * 7919) }),
    [concepts, count, seed, nonce],
  );

  const [i, setI] = useState(0);
  const [value, setValue] = useState("");
  const [judged, setJudged] = useState(null);
  const [retried, setRetried] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [events, setEvents] = useState([]);
  const [review, setReview] = useState([]);
  const [done, setDone] = useState(false);
  const inputRef = useRef(null);
  const { mark, elapsed } = useItemTimer();

  const item = round.items[i];

  useEffect(() => {
    mark();
    inputRef.current?.focus();
  }, [i, mark, nonce]);

  const commit = useCallback((match, ms) => {
    const grade = gradeFromMatch(match, { ms });
    const ev = { correct: match.correct, ms, conceptId: item.conceptId };
    const nextEvents = [...events, ev];
    setEvents(nextEvents);
    setReview((r) => [...r, {
      conceptId: item.conceptId,
      prompt: item.prompt,
      answer: item.answer,
      explanation: item.explanation,
      correct: match.correct,
    }]);
    onGrade?.(item.conceptId, grade, { ...ev, reason: match.reason });
    return nextEvents;
  }, [events, item, onGrade]);

  const advance = useCallback((nextEvents) => {
    if (i + 1 >= round.items.length) {
      const summary = scoreRound(nextEvents);
      setDone(true);
      onComplete?.(summary);
    } else {
      setI(i + 1);
    }
    setValue("");
    setJudged(null);
    setRetried(false);
    setShowHint(false);
  }, [i, round.items.length, onComplete]);

  function handleSubmit(e) {
    e?.preventDefault();
    if (!item || done) return;

    // Already judged -> this Enter means "next".
    if (judged && !(judged.near && !retried)) {
      advance(events);
      return;
    }

    const match = matchAnswer(value, item.acceptable, { reject: item.reject });

    // A near miss is a free retry, not a wrong answer. It is only scored
    // once the learner has had that second look.
    if (match.near && !match.correct && !retried) {
      setRetried(true);
      setJudged(match);
      return;
    }

    const ms = elapsed();
    const nextEvents = commit(match, ms);
    setJudged({ ...match, final: true });
    // A clean hit needs no dwell time; a miss does.
    if (match.correct) setTimeout(() => advance(nextEvents), 650);
  }

  function handleSkip() {
    const ms = elapsed();
    const match = { correct: false, near: false, reason: "skipped" };
    commit(match, ms);
    setJudged({ ...match, final: true });
  }

  function replay() {
    setNonce((n) => n + 1);
    setI(0); setValue(""); setJudged(null); setRetried(false);
    setShowHint(false); setEvents([]); setReview([]); setDone(false);
  }

  if (!round.items.length) {
    return (
      <div className="g-panel g-empty">
        Nothing to recall here yet — this set has no answers short enough to type from memory.
        Try Rapid Fire or Match instead.
      </div>
    );
  }

  const summary = done ? scoreRound(events) : null;
  const feedback = judged?.final
    ? judged.correct ? "ok" : "bad"
    : judged?.near ? "near" : null;

  return (
    <GameHost
      title="Recall Drill"
      subtitle="Type it from memory — no options, no hints unless you ask"
      index={i}
      total={round.items.length}
      events={events}
      summary={summary}
      review={review}
      onReplay={replay}
      onExit={onExit}
      objective={objective}
      guided={guided}
      onAdvance={onAdvance}
    >
      {item && (
        <form className="g-panel" onSubmit={handleSubmit}>
          <div className="g-eyebrow">{item.kind === "card" ? "Name the term" : "Answer from memory"}</div>
          <p className="g-prompt">{item.prompt}</p>

          <input
            ref={inputRef}
            className="g-recall-input"
            style={{ marginTop: 16 }}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Your answer…"
            disabled={Boolean(judged?.final)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            aria-label="Your answer"
          />

          {showHint && !judged?.final && <div className="g-hint" aria-label="Answer length hint">{item.hint}</div>}

          <div className="g-actions" style={{ justifyContent: "flex-start", marginTop: 14 }}>
            {!judged?.final && (
              <button type="submit" className="btn-primary" disabled={!value.trim()}>
                {judged?.near ? "Try again" : "Check"}
              </button>
            )}
            {judged?.final && (
              <button type="submit" className="btn-primary">
                {i + 1 >= round.items.length ? "See results" : "Next"}
              </button>
            )}
            {!judged?.final && !showHint && (
              <button type="button" className="btn-ghost" onClick={() => setShowHint(true)}>Hint</button>
            )}
            {!judged?.final && (
              <button type="button" className="btn-ghost" onClick={handleSkip}>Don&apos;t know</button>
            )}
          </div>

          {feedback === "near" && (
            <div className="g-feedback near">
              <div className="g-feedback-head">⚠︎ Almost</div>
              {judged.reason === "scale"
                ? "Right number, wrong scale — check whether this is a ratio (0.80) or a percentage (80%)."
                : "You're close. Have another go."}
            </div>
          )}
          {feedback === "ok" && (
            <div className="g-feedback ok">
              <div className="g-feedback-head">✓ Correct</div>
              {judged.reason === "typo" && <>Counted — <span className="g-feedback-answer">{item.answer}</span> is what you meant. </>}
              {judged.reason === "tokens" && <>Counted as <span className="g-feedback-answer">{item.answer}</span>. </>}
              {item.explanation}
            </div>
          )}
          {feedback === "bad" && (
            <div className="g-feedback bad">
              <div className="g-feedback-head">
                {judged.reason === "skipped" ? "Answer" : "✗ Not quite"}
              </div>
              <div style={{ marginBottom: 6 }}>
                <span className="g-feedback-answer">{item.answer}</span>
              </div>
              {item.explanation}
            </div>
          )}
        </form>
      )}
    </GameHost>
  );
}
