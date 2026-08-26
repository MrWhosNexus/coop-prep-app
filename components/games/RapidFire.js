"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import GameHost, { useCountdown, useItemTimer } from "./GameHost";
import { generateRapidFire, makeRng } from "@/lib/games/generators";
import { scoreRound } from "@/lib/games/scoring";

const KEYS = ["A", "B", "C", "D"];

/**
 * Timed multiple choice built on the curriculum's existing per-option
 * explanations — the most valuable content in data/curriculum.js, since
 * every wrong option already says why it is wrong.
 *
 * The clock is per item, not per round, and running out only ends that
 * item: there is no cascading failure and no lost progress. Speed exists
 * here to push retrieval toward fluency (an answer you have to reconstruct
 * for 20 seconds isn't one you can use in an interview), not to punish.
 *
 * @param {object} props
 * @param {object[]} props.concepts
 * @param {number} [props.count]
 * @param {number} [props.seconds] per-item clock; null for untimed
 * @param {number} [props.seed]
 * @param {(conceptId: string, grade: number, meta: object) => void} [props.onGrade]
 * @param {(summary: object) => void} [props.onComplete]
 * @param {Function} [props.onExit]
 */
export default function RapidFire({
  concepts, count = 10, seconds = 20, seed, onGrade, onComplete, onExit,
  objective, guided, onAdvance,
}) {
  const [nonce, setNonce] = useState(0);
  const round = useMemo(
    () => generateRapidFire(concepts, { count, rng: makeRng((seed ?? 1) + nonce * 104729) }),
    [concepts, count, seed, nonce],
  );

  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [events, setEvents] = useState([]);
  const [review, setReview] = useState([]);
  const [done, setDone] = useState(false);
  const { mark, elapsed } = useItemTimer();

  const item = round.items[i];

  const answer = useCallback((option) => {
    if (picked || !item) return;
    const ms = elapsed();
    const correct = Boolean(option?.correct);
    setPicked(option ?? { text: null, correct: false, explanation: "", timeout: true });
    setEvents((e) => [...e, { correct, ms, conceptId: item.conceptId }]);
    setReview((r) => [...r, {
      conceptId: item.conceptId,
      prompt: item.prompt,
      answer: item.options.find((o) => o.correct)?.text ?? "",
      explanation: item.explanation,
      correct,
    }]);
    // A timeout is a genuine failure to retrieve (grade 0). A wrong pick with
    // the answer now explained is a lapse the SRS should relearn (grade 0);
    // a correct pick is a recognition hit, which is worth less than free
    // recall, so it never grades above GOOD.
    onGrade?.(item.conceptId, correct ? 4 : 0, { correct, ms, timeout: !option });
  }, [picked, item, elapsed, onGrade]);

  // The clock restarts per item: runId changes, so no reset effect is needed.
  const { left } = useCountdown(
    seconds,
    () => answer(null),
    { running: !picked && !done && Boolean(item), runId: `${nonce}:${i}` },
  );

  useEffect(() => { mark(); }, [i, nonce, mark]);

  function next() {
    if (i + 1 >= round.items.length) {
      const summary = scoreRound(events);
      setDone(true);
      onComplete?.(summary);
    } else {
      setI(i + 1);
    }
    setPicked(null);
  }

  function replay() {
    setNonce((n) => n + 1);
    setI(0); setPicked(null); setEvents([]); setReview([]); setDone(false);
  }

  if (!round.items.length) {
    return <div className="g-panel g-empty">No questions available for this selection yet.</div>;
  }

  const summary = done ? scoreRound(events) : null;

  return (
    <GameHost
      title="Rapid Fire"
      subtitle="Answer fast — then read why the others are wrong"
      index={i}
      total={round.items.length}
      events={events}
      secondsLeft={picked ? null : left}
      summary={summary}
      review={review}
      onReplay={replay}
      onExit={onExit}
      objective={objective}
      guided={guided}
      onAdvance={onAdvance}
    >
      {item && (
        <div className="g-panel">
          <div className="g-eyebrow">Question {i + 1}</div>
          <p className="g-prompt">{item.prompt}</p>

          <div className="g-options" role="group" aria-label="Answer options">
            {item.options.map((o, n) => {
              const isPicked = picked && picked.text === o.text;
              let cls = "g-option";
              if (picked) {
                if (o.correct) cls += " correct";
                else if (isPicked) cls += " wrong";
                else cls += " dim";
              }
              return (
                <button
                  type="button"
                  key={o.text}
                  className={cls}
                  onClick={() => answer(o)}
                  disabled={Boolean(picked)}
                >
                  <span className="g-option-key">{KEYS[n] ?? n + 1}</span>
                  <span>
                    {o.text}
                    {/* Every option's explanation is revealed, not just the one
                        that was picked: ruling out the other three is most of
                        the learning in a multiple-choice item. */}
                    {picked && o.explanation && <span className="g-option-why">{o.explanation}</span>}
                  </span>
                </button>
              );
            })}
          </div>

          {picked?.timeout && (
            <div className="g-feedback near">
              <div className="g-feedback-head">⏱ Time</div>
              No penalty beyond the miss — read the explanations and move on. It&apos;s queued to come back.
            </div>
          )}

          {picked && (
            <div className="g-actions" style={{ justifyContent: "flex-start", marginTop: 14 }}>
              <button type="button" className="btn-primary" onClick={next} autoFocus>
                {i + 1 >= round.items.length ? "See results" : "Next"}
              </button>
            </div>
          )}
        </div>
      )}
    </GameHost>
  );
}
