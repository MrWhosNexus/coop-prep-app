"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import GameHost, { useCountdown } from "./GameHost";
import { checkMatch, generateMatchGame, makeRng } from "@/lib/games/generators";
import { scoreRound } from "@/lib/games/scoring";

/**
 * Term <-> definition matching against the clock.
 *
 * This is the easiest retrieval format in the suite, which is exactly its
 * job: it is where a brand-new concept starts (see generators.suggestGame).
 * Matching gives the learner a first, low-failure exposure so that Recall
 * Drill later has something to actually retrieve. Drilling only this would
 * build false confidence — the ladder is the point.
 *
 * @param {object} props
 * @param {object[]} props.concepts
 * @param {number} [props.pairs]
 * @param {number} [props.seconds] whole-board clock; null for untimed
 * @param {number} [props.seed]
 * @param {(conceptId: string, grade: number, meta: object) => void} [props.onGrade]
 * @param {(summary: object) => void} [props.onComplete]
 * @param {Function} [props.onExit]
 */
export default function MatchGame({
  concepts, pairs = 6, seconds = 90, seed, onGrade, onComplete, onExit,
  objective, guided, onAdvance,
}) {
  const [nonce, setNonce] = useState(0);
  const generated = useMemo(
    () => generateMatchGame(concepts, { pairs, rng: makeRng((seed ?? 1) + nonce * 31337) }),
    [concepts, pairs, seed, nonce],
  );

  const [sel, setSel] = useState(null);        // selected left conceptId
  const [solved, setSolved] = useState([]);    // conceptIds matched
  const [miss, setMiss] = useState(null);      // conceptId to shake
  const [events, setEvents] = useState([]);
  const [attempts, setAttempts] = useState({}); // conceptId -> wrong tries
  const [done, setDone] = useState(false);

  /*
   * The board the learner actually played, frozen the moment the round ends.
   *
   * `generated` is memoized on `concepts`, and the parent re-plans the practice
   * session from the SRS deck when a round completes (GamesTool's
   * onComplete={refreshSession}) — so `concepts` changes identity while the
   * RESULTS screen is still mounted. Without this freeze, the board and the
   * review below regenerate from the new pool: a learner who scored 6/6 sees a
   * results screen listing six pairs they never played, every one marked wrong,
   * and GameResults files them under "what you missed".
   *
   * Freezing here rather than asking the parent not to re-plan keeps the fix
   * local and makes the component correct for ANY parent: results describe what
   * happened, and no prop change can rewrite that history after the fact.
   * `replay()` clears `done`, so the next round picks up the fresh pool — which
   * is the whole point of re-planning.
   */
  const played = useRef(null);
  if (!done) played.current = generated;
  const round = done && played.current ? played.current : generated;

  const total = round.pairs.length;
  const finish = useCallback((evts) => {
    setDone(true);
    onComplete?.(scoreRound(evts));
  }, [onComplete]);

  const { left } = useCountdown(seconds, () => finish(events), {
    running: !done && total > 0,
    runId: nonce,
  });

  function pickLeft(conceptId) {
    if (solved.includes(conceptId) || done) return;
    setSel(sel === conceptId ? null : conceptId);
    setMiss(null);
  }

  function pickRight(conceptId) {
    if (!sel || solved.includes(conceptId) || done) return;
    const { correct, pair } = checkMatch(round, sel, conceptId);
    if (correct) {
      const nextEvents = [...events, { correct: true, conceptId: sel }];
      const nextSolved = [...solved, sel];
      setEvents(nextEvents);
      setSolved(nextSolved);
      // Getting it right first try is a real (if easy) retrieval; needing
      // several tries is closer to guessing, so it grades as a lapse.
      onGrade?.(sel, (attempts[sel] ?? 0) === 0 ? 4 : 3, { correct: true, pair, tries: (attempts[sel] ?? 0) + 1 });
      setSel(null);
      // Clearing the last pair ends the board. Done here rather than in an
      // effect watching solved.length: the board is finished by this click,
      // so this is where that belongs.
      if (nextSolved.length === total) finish(nextEvents);
    } else {
      setAttempts((a) => ({ ...a, [sel]: (a[sel] ?? 0) + 1 }));
      setEvents((e) => [...e, { correct: false, conceptId: sel }]);
      setMiss(conceptId);
      setTimeout(() => setMiss(null), 400);
    }
  }

  function replay() {
    setNonce((n) => n + 1);
    setSel(null); setSolved([]); setMiss(null);
    setEvents([]); setAttempts({}); setDone(false);
  }

  if (!total) {
    return <div className="g-panel g-empty">Not enough terms in this selection to build a board.</div>;
  }

  const summary = done ? scoreRound(events) : null;
  const review = round.pairs.map((p) => ({
    conceptId: p.conceptId,
    prompt: p.term,
    answer: p.def,
    explanation: "",
    correct: solved.includes(p.conceptId) && !(attempts[p.conceptId] > 0),
  }));

  return (
    <GameHost
      title="Match"
      subtitle="Pick a term, then its definition"
      index={solved.length}
      total={total}
      events={events}
      secondsLeft={left}
      summary={summary}
      review={review}
      onReplay={replay}
      onExit={onExit}
      objective={objective}
      guided={guided}
      onAdvance={onAdvance}
    >
      <div className="g-panel">
        <div className="g-match">
          <div className="g-match-col" role="group" aria-label="Terms">
            {round.left.map((t) => (
              <button
                type="button"
                key={t.conceptId}
                className={`g-tile ${sel === t.conceptId ? "sel" : ""} ${solved.includes(t.conceptId) ? "done" : ""}`}
                onClick={() => pickLeft(t.conceptId)}
                disabled={solved.includes(t.conceptId)}
                aria-pressed={sel === t.conceptId}
              >
                {t.text}
              </button>
            ))}
          </div>
          <div className="g-match-col" role="group" aria-label="Definitions">
            {round.right.map((t) => (
              <button
                type="button"
                key={t.conceptId}
                className={`g-tile ${solved.includes(t.conceptId) ? "done" : ""} ${miss === t.conceptId ? "miss" : ""}`}
                onClick={() => pickRight(t.conceptId)}
                disabled={solved.includes(t.conceptId) || !sel}
              >
                {t.text}
              </button>
            ))}
          </div>
        </div>
      </div>
    </GameHost>
  );
}
