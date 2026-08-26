"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExamRunner from "./ExamRunner";
import ExamTimer from "./ExamTimer";
import ItemNavigator from "./ItemNavigator";
import ExamResults from "./ExamResults";
import ExamReview from "./ExamReview";
import {
  exam, coachingAllowed, modeLabel, formIntegrity, blueprintRows, modeRows,
  answerSheetSummary, submitWarning, formatPct, chosenIndex,
} from "./adapter";
import { clockRunning } from "./exam-clock.js";
import "./exam.css";

/** How often an in-flight sitting is checkpointed to the store. */
const HEARTBEAT_MS = 15_000;

/** How many recently-seen item ids are kept for the anti-memorisation draw.
    A bound, not a policy: lib/exam/blueprint.js treats `exclude` as a
    preference and falls back to seen items rather than shorting a quota, so
    an over-full list costs only recency granularity, never a short form.
    500 comfortably spans several full mocks of the largest bank (SIE, ~450)
    while keeping the persisted progress slice small. */
const RECENT_ITEM_CAP = 500;

/**
 * The exam simulator shell: start screen, the exam itself, submit, results, review.
 *
 * Everything it knows about lib/exam arrives through ./adapter — see wiringNeeded.
 * Persistence is injected (`savedSession` / `onPersist` / `onClear`) rather than
 * reaching into lib/store here, so this component stays testable and the
 * integrator owns the slice key.
 *
 * The exam→SRS loop closes through `onSrsReview`. A submitted sitting hands its
 * review up; the host that owns the deck folds it in with lib/exam/review.js's
 * applyReviewToDeck. It is injected for the same reason persistence is — this
 * component does not own a store — but it is not optional decoration: without
 * it, missed questions never come back, so the results screen is told not to
 * claim they will (see `srsScheduled` below). Promise nothing the wiring does
 * not deliver.
 *
 * The anti-memorisation draw closes here too. lib/exam/blueprint.js has
 * preferred unseen items via `exclude` since it landed — and no caller ever
 * supplied one, so every sitting drew with no memory and a learner met the
 * whole bank, explanations included, in a handful of mocks, then scored on
 * recognition. ExamHost now remembers the item ids of every form it starts
 * (component state, so back-to-back sittings in one mount are covered with no
 * host wiring at all) and reports the rolling list through `onItemsSeen` so
 * the integrator can persist it beside the session and hand it back as
 * `recentItemIds` — the same injected-persistence pattern as savedSession.
 *
 * @param {Object} props
 * @param {Object|string} [props.savedSession] a serialized session to offer to resume
 * @param {string[]} [props.recentItemIds] item ids seen in recent sittings, persisted
 *   by the host; passed to the engine as the draw's `exclude` list
 * @param {Function} [props.onItemsSeen] (ids: string[]) => void — the updated rolling
 *   recently-seen list, emitted whenever a sitting begins. Persist it and feed it
 *   back as `recentItemIds`, or repeat mocks recycle the same questions.
 * @param {Function} [props.onPersist] (sessionJson, session) => void
 * @param {Function} [props.onClear] () => void
 * @param {Function} [props.onSrsReview] (review, session) => void — grade a submitted
 *   sitting into the spaced-repetition deck. Omit and no SRS claim is made.
 * @param {Function} [props.onExit] () => void
 */
export default function ExamHost({
  savedSession = null, recentItemIds = null, onItemsSeen,
  onPersist, onClear, onSrsReview, onExit,
}) {
  const [phase, setPhase] = useState("start"); // start | exam | confirm | results | review
  const [sess, setSess] = useState(null);
  const [certId, setCertId] = useState(null);
  const [mode, setMode] = useState("mock");
  const [sectionId, setSectionId] = useState(null);
  const [coaching, setCoaching] = useState(false);
  const [error, setError] = useState("");
  // How many questions this sitting actually graded into the SRS deck. null
  // when nothing was scheduled — a claim we have not earned the right to make.
  const [srsScheduled, setSrsScheduled] = useState(null);

  const persistRef = useRef(onPersist);
  useEffect(() => { persistRef.current = onPersist; }, [onPersist]);

  /* Recently-seen item ids, newest first. A ref, not state: nothing renders
     it, and the one reader (start) wants the freshest value at click time.
     Seeded once from the host's persisted list; a host that passes nothing
     still gets in-mount memory, which is what makes the retake flow (results
     → start → start again) exclude on its own. */
  const seenItemsRef = useRef(
    Array.isArray(recentItemIds) ? recentItemIds.filter((id) => typeof id === "string").slice(0, RECENT_ITEM_CAP) : []
  );
  const itemsSeenRef = useRef(onItemsSeen);
  useEffect(() => { itemsSeenRef.current = onItemsSeen; }, [onItemsSeen]);

  /* Record a started form's items as seen. Newest to the FRONT so the cap
     evicts the stalest ids — eviction order is what turns the cap into a
     rolling window rather than a permanent first-500 blacklist. Reported to
     the host on every update; without a listener the ref alone still covers
     the current mount. */
  const rememberSeen = useCallback((sessionValue) => {
    const ids = (sessionValue?.form?.items ?? []).map((i) => i.id).filter((id) => typeof id === "string");
    if (!ids.length) return;
    const fresh = new Set(ids);
    const merged = [...ids, ...seenItemsRef.current.filter((id) => !fresh.has(id))].slice(0, RECENT_ITEM_CAP);
    seenItemsRef.current = merged;
    itemsSeenRef.current?.(merged);
  }, []);

  const certs = useMemo(() => exam.listExams(), []);
  const activeCertId = certId ?? certs[0]?.certId ?? null;
  const offering = useMemo(
    () => (activeCertId ? exam.offering(activeCertId) : null),
    [activeCertId]
  );

  /* ── persistence ───────────────────────────────────────────────────────
     Every transition is written through. A three-hour mock lost to a crashed
     renderer is unforgivable, so a sitting is never held only in component
     state. lib/exam's session is plain JSON and carries its own form, so a
     restored attempt needs no bank lookup and cannot drift if the bank is
     edited mid-attempt. */
  const commit = useCallback((next) => {
    setSess(next);
    const json = exam.serialize(next);
    if (json) persistRef.current?.(json, next);
    return next;
  }, []);

  /* Restore whatever the store handed us. Derived, not stored in state: a copy
     in state would need an effect to sync it, and an effect that setStates on
     every render is a cascading-render bug waiting to happen. Not resumed
     automatically either — a learner returning to a three-hour mock should
     choose to re-enter it. */
  const resumeState = useMemo(() => {
    if (!savedSession) return null;
    const r = exam.restore(savedSession);
    if (!r.ok) return { error: r.error };
    if (!exam.isResumable(r.value)) return null;
    return { session: r.value };
  }, [savedSession]);

  /* ── the clock ─────────────────────────────────────────────────────────
     Whether the clock is running is a fact about the SESSION, never about the
     phase this component happens to be rendering. The two are not the same:
     the confirm panel is a screen, not a pause button, and a mock has no pause
     button at all (lib/exam refuses — MODES.mock.pausable === false), so the
     wall clock keeps draining behind whatever is on top. Gating on the phase
     froze the display at 3:00 and then dumped the learner at 0:00 the moment
     they went back. Every effect below asks the engine instead, via
     `clockRunning`; that also covers the phases that genuinely do not tick —
     results and review render a SUBMITTED session, which is not running. */
  const timed = sess?.limitMs !== null && sess?.limitMs !== undefined;
  const running = clockRunning(sess);

  /* Checkpoint the clock on a heartbeat. lib/exam banks elapsed time when the
     session advances; without a periodic tick a crash mid-question would lose
     the time since the last action — and on resume the learner would be handed
     back minutes they had already spent. */
  useEffect(() => {
    if (!running || !timed) return undefined;
    const id = setInterval(() => {
      setSess((s) => {
        if (!s) return s;
        const next = exam.tick(s, Date.now());
        const json = exam.serialize(next);
        if (json) persistRef.current?.(json, next);
        return next;
      });
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
    // `sess` is intentionally absent: the tick reads it through setSess's
    // functional updater, so it always sees the latest without re-arming the
    // interval on every keystroke. `running` is a boolean for the same reason —
    // it changes when the engine's answer changes, not on every edit. When a
    // tick is what expires the session, `running` goes false and this unarms
    // itself.
  }, [running, timed]);

  /* Bank the clock when the window goes away — the ordinary cases (tab hidden,
     app quit) that the heartbeat would otherwise round off. A mock cannot be
     paused, so this ticks rather than pauses: closing the app is not a pause
     button, and lib/exam is right to refuse to pretend otherwise.

     Armed off `running`, not the phase: quitting the app with the confirm panel
     open must bank the same time quitting mid-question does. */
  useEffect(() => {
    if (!running) return undefined;
    const bank = () => {
      setSess((s) => {
        if (!s) return s;
        const next = exam.canPause(s)
          ? (exam.pause(s, Date.now()).value ?? exam.tick(s, Date.now()))
          : exam.tick(s, Date.now());
        const json = exam.serialize(next);
        if (json) persistRef.current?.(json, next);
        return next;
      });
    };
    window.addEventListener("pagehide", bank);
    window.addEventListener("beforeunload", bank);
    return () => {
      window.removeEventListener("pagehide", bank);
      window.removeEventListener("beforeunload", bank);
    };
  }, [running]);

  /* ── starting ─────────────────────────────────────────────────────────── */
  const start = useCallback(() => {
    setError("");
    // `section` is the one mode that needs more than a mode id — the engine
    // refuses without a sectionId (NEEDS_SECTION), so the picker below supplies
    // one and defaults to the first section rather than letting the learner hit
    // an error they cannot act on.
    const r = exam.start({
      certId: activeCertId,
      mode,
      sectionId: mode === "section" ? (sectionId ?? offering?.sections?.[0]?.id) : undefined,
      now: Date.now(),
      seed: Date.now(),
      // The anti-memorisation half of the draw. blueprint.js prefers items
      // NOT on this list and has since it landed — but preference over an
      // empty list is no preference, and this call site passed nothing, so
      // repeat mocks recycled the bank freely. A preference, still: a thin
      // section falls back to seen items rather than shorting its quota.
      exclude: seenItemsRef.current,
    });
    if (!r.ok) {
      // The engine's refusal is written for a learner — show it, don't replace it.
      setError(r.error);
      return;
    }
    if (!r.value.form.items.length) {
      setError("That bank produced no questions at all. There is nothing to sit.");
      return;
    }
    // Seen the moment the form exists, not at submit: an abandoned sitting
    // still showed the learner its questions.
    rememberSeen(r.value);
    setPhase("exam");
    commit(r.value);
  }, [activeCertId, mode, sectionId, offering, commit, rememberSeen]);

  const resume = useCallback(() => {
    if (!resumeState?.session) return;
    const r = exam.resume(resumeState.session, Date.now());
    if (!r.ok) {
      setError(r.error);
      return;
    }
    // A resumed form was recorded when it was started, but this may be a
    // fresh mount whose host persisted the session and not the seen list —
    // re-recording is a dedupe no-op when both survived.
    rememberSeen(r.value);
    setPhase("exam");
    commit(r.value);
  }, [resumeState, commit, rememberSeen]);

  const retryMissed = useCallback(() => {
    const r = exam.startRetry(sess, { now: Date.now() });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setCoaching(true); // a retry drill is for learning, so coach by default
    setPhase("exam");
    commit(r.value);
  }, [sess, commit]);

  /* ── in the exam ──────────────────────────────────────────────────────── */
  const item = useMemo(() => exam.currentItem(sess), [sess]);

  // Engine calls that can refuse (answering an expired attempt, say). A refusal
  // is surfaced rather than silently dropping the learner's input.
  const apply = useCallback((result) => {
    if (result?.ok) {
      setError("");
      commit(result.value);
    } else if (result?.error) {
      setError(result.error);
    }
  }, [commit]);

  const answer = useCallback(
    (optionIndex) => item && apply(exam.answer(sess, item.id, optionIndex, Date.now())),
    [sess, item, apply]
  );
  const flag = useCallback(
    () => item && apply(exam.flag(sess, item.id, Date.now())),
    [sess, item, apply]
  );
  const jump = useCallback((i) => commit(exam.goTo(sess, i, Date.now())), [sess, commit]);
  const next = useCallback(() => commit(exam.next(sess, Date.now())), [sess, commit]);
  const prev = useCallback(() => commit(exam.prev(sess, Date.now())), [sess, commit]);

  const finish = useCallback(() => {
    const r = exam.submit(sess, Date.now());
    if (!r.ok) {
      setError(r.error);
      return;
    }
    commit(r.value);

    /* Close the exam→SRS loop, at the one moment the result is final. Every
       item is graded, not just the misses: lib/exam/review.js maps a miss to
       AGAIN (back tomorrow), a flagged-but-right answer to HARD (a guess that
       landed is not knowledge), and a confident right answer to GOOD. Only
       what actually happened is recorded — `srsScheduled` stays null when no
       host is listening, and ExamResults then makes no promise about it. */
    const graded = exam.review(r.value);
    if (onSrsReview && graded?.items?.length) {
      onSrsReview(graded, r.value);
      setSrsScheduled(graded.items.length);
    } else {
      setSrsScheduled(null);
    }

    setPhase("results");
    onClear?.();
  }, [sess, commit, onClear, onSrsReview]);

  /* The clock running out submits. That is what the real engine does, and a mock
     that quietly lets you work past the buzzer is not a mock. `confirm` counts:
     the buzzer does not wait for you to close a panel, and the timer now keeps
     ticking there, so this branch actually fires. */
  const onExpire = useCallback(() => {
    if (phase === "exam" || phase === "confirm") finish();
  }, [phase, finish]);

  const score = useMemo(
    () => (phase === "results" || phase === "review" ? exam.score(sess) : null),
    [phase, sess]
  );
  const review = useMemo(
    () => (phase === "results" || phase === "review" ? exam.review(sess) : null),
    [phase, sess]
  );

  /* ── render ───────────────────────────────────────────────────────────── */

  if (!exam.available) {
    return (
      <div className="x-host">
        <section className="x-panel">
          <div className="x-notice error" role="alert">
            <span className="x-notice-icon" aria-hidden="true">⚠</span>
            <div>
              <div className="x-notice-title">The exam engine isn&apos;t available</div>
              No exam can be started. This screen will not assemble a form on its own,
              because a form built without the engine would not be weighted to the
              blueprint — and a mis-weighted mock that looks real is worse than no mock.
            </div>
          </div>
          {onExit && (
            <button type="button" className="btn-ghost" style={{ marginTop: 16 }} onClick={onExit}>
              ← Back
            </button>
          )}
        </section>
      </div>
    );
  }

  if (phase === "start") {
    return (
      <StartScreen
        certs={certs}
        certId={activeCertId}
        setCertId={setCertId}
        offering={offering}
        mode={mode}
        setMode={setMode}
        sectionId={sectionId}
        setSectionId={setSectionId}
        coaching={coaching}
        setCoaching={setCoaching}
        onStart={start}
        error={error}
        resumeState={resumeState}
        onResume={resume}
      />
    );
  }

  if (phase === "results" && score) {
    return (
      <div className="x-host">
        <ExamResults
          score={score}
          review={review}
          srsScheduled={srsScheduled}
          onReview={() => setPhase("review")}
          onRetryMissed={retryMissed}
          onRetake={() => { setPhase("start"); setSess(null); }}
          onExit={onExit}
        />
      </div>
    );
  }

  if (phase === "review") {
    return (
      <div className="x-host">
        <ExamReview review={review} onBack={() => setPhase("results")} />
        <ItemNavigator session={sess} review={review} showOutcome onJump={() => {}} />
      </div>
    );
  }

  const summary = answerSheetSummary(sess);
  const integrity = formIntegrity(sess?.form);
  const coach = coaching && coachingAllowed(sess?.mode);

  return (
    <div className="x-host">
      <header className="x-bar">
        <div>
          <div className="x-bar-title">
            {offering?.name ?? sess?.certId} — {modeLabel(sess?.mode, coach)}
          </div>
          <div className="x-bar-sub">
            {summary.answered} of {summary.total} answered
            {summary.flagged > 0 && ` · ${summary.flagged} flagged`}
          </div>
        </div>
        <span className="x-bar-spacer" />
        {!integrity.ok && (
          <span className="badge badge-gold" title={integrity.notes.join(" ")}>
            Not true-to-blueprint
          </span>
        )}
        {/* Paused iff the ENGINE has stopped the clock. The confirm panel below
            is a screen, not a pause — see exam-clock.js. */}
        <ExamTimer session={sess} onExpire={onExpire} paused={!running} />
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setPhase(phase === "confirm" ? "exam" : "confirm")}
        >
          {phase === "confirm" ? "Back to questions" : "Submit"}
        </button>
      </header>

      {error && (
        <div className="x-notice warning" role="alert">
          <span className="x-notice-icon" aria-hidden="true">⚠</span>
          <div>{error}</div>
        </div>
      )}

      {phase === "confirm" ? (
        <ConfirmSubmit
          session={sess}
          onCancel={() => setPhase("exam")}
          onConfirm={finish}
          onJump={(i) => { jump(i); setPhase("exam"); }}
        />
      ) : (
        <div className="x-runner">
          <ExamRunner
            item={item}
            index={sess.cursor}
            total={sess.form.items.length}
            answer={item ? chosenIndex(sess, item.id) : null}
            flagged={Boolean(item && sess.flags[item.id])}
            mode={sess.mode}
            coaching={coach}
            onAnswer={answer}
            onToggleFlag={flag}
            onNext={next}
            onPrev={prev}
            onSubmit={() => setPhase("confirm")}
          />
          <ItemNavigator session={sess} onJump={jump} />
        </div>
      )}
    </div>
  );
}

/**
 * Pick a cert, pick a mode, see the blueprint, then commit.
 *
 * The blueprint sits ABOVE the start button on purpose: a candidate should know
 * that 44% of the SIE is products-and-risks BEFORE they sit 75 questions, not
 * discover it in the results.
 */
function StartScreen({
  certs, certId, setCertId, offering, mode, setMode, sectionId, setSectionId,
  coaching, setCoaching, onStart, error, resumeState, onResume,
}) {
  const rows = useMemo(() => blueprintRows(offering), [offering]);
  const modes = useMemo(() => modeRows(offering), [offering]);
  /* Two different honesty problems, one notice: `notes` says whether a form can
     be drawn to the blueprint at all; `reuse.note` says whether the bank still
     has questions this learner has not already answered. A bank can be
     perfectly faithful and out of unseen questions, so the second cannot be
     inferred from the first — and a recycled mock that reads as a real one is
     the false confidence this whole screen exists to prevent. */
  const bankNotes = useMemo(
    () => [...(offering?.notes ?? []), offering?.reuse?.note].filter(Boolean),
    [offering]
  );
  const canCoach = coachingAllowed(mode);
  const selected = modes.find((m) => m.id === mode);

  return (
    <div className="x-host x-start">
      {/* An unfinished sitting is the first thing on screen, above the controls
          that would throw it away. */}
      {resumeState?.session && (
        <section className="x-panel">
          <div className="x-notice info" role="status">
            <span className="x-notice-icon" aria-hidden="true">⏸</span>
            <div style={{ flex: 1 }}>
              <div className="x-notice-title">You have an exam in progress</div>
              {answerSheetSummary(resumeState.session).answered} of{" "}
              {resumeState.session.form.items.length} answered.{" "}
              {MODE_RESUME_NOTE(resumeState.session)}
            </div>
          </div>
          <button type="button" className="btn-primary" style={{ marginTop: 14 }} onClick={onResume}>
            Resume exam
          </button>
        </section>
      )}

      {resumeState?.error && (
        <div className="x-notice warning" role="status">
          <span className="x-notice-icon" aria-hidden="true">⚠</span>
          <div>
            <div className="x-notice-title">A saved attempt could not be reopened</div>
            {resumeState.error}
          </div>
        </div>
      )}

      <section className="x-panel">
        <h1 className="x-h">Exam simulator</h1>
        <p className="x-sub" style={{ marginTop: 6 }}>
          Timed, navigable, and scored against the real pass mark — then reviewed
          question by question.
        </p>

        <h2 className="x-eyebrow" style={{ marginTop: 22, marginBottom: 9 }}>Exam</h2>
        <div className="x-cert-grid">
          {certs.map((c) => (
            <button
              key={c.certId}
              type="button"
              className="x-cert"
              aria-pressed={certId === c.certId}
              onClick={() => setCertId(c.certId)}
            >
              <span className="x-cert-name">{c.name}</span>
              <span className="x-cert-meta">{c.fullName}</span>
            </button>
          ))}
        </div>

        {/* The engine's honest notes about what this bank can actually serve. */}
        {bankNotes.length > 0 && (
          <div className="x-notice warning" style={{ marginTop: 16 }} role="status">
            <span className="x-notice-icon" aria-hidden="true">⚠</span>
            <div>
              <div className="x-notice-title">What this bank can actually offer</div>
              <ul>
                {bankNotes.map((n) => <li key={n}>{n}</li>)}
              </ul>
            </div>
          </div>
        )}

        <h2 className="x-eyebrow" style={{ marginTop: 22, marginBottom: 9 }}>Mode</h2>
        <div className="x-modes">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              className="x-mode"
              aria-pressed={mode === m.id}
              disabled={!m.available}
              onClick={() => setMode(m.id)}
              style={m.available ? undefined : { opacity: 0.5, cursor: "not-allowed" }}
            >
              <span className="x-mode-name">
                {m.label}
                {m.count ? <span className="badge badge-muted">{m.count} Qs</span> : null}
                {m.id === "mock" && m.faithful === false && (
                  <span className="badge badge-gold">short</span>
                )}
              </span>
              <span className="x-mode-desc">{m.description}</span>
              {/* An unavailable mode is explained, not silently missing. */}
              {m.why && <span className="x-muted" style={{ marginTop: 4 }}>{m.why}</span>}
            </button>
          ))}
        </div>

        {/* A section drill needs to know WHICH section. Shown only for the mode
            that needs it, defaulted to the first, so the mode can never dead-end
            on the engine's NEEDS_SECTION refusal. */}
        {mode === "section" && rows.length > 0 && (
          <label style={{ display: "block", marginTop: 16 }}>
            <span className="x-eyebrow" style={{ display: "block", marginBottom: 6 }}>
              Which section
            </span>
            <select
              className="btn-ghost"
              value={sectionId ?? rows[0].id}
              onChange={(e) => setSectionId(e.target.value)}
              style={{ minWidth: 260 }}
            >
              {rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} — {r.quota} Qs on a full form
                  {r.short > 0 ? ` (bank is ${r.short} short)` : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Coaching is offered only where it is allowed, and never on a mock —
            so the control simply is not there to be misread. */}
        {canCoach ? (
          <label
            style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 16, cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={coaching}
              onChange={(e) => setCoaching(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>Explain each answer as I go</span>
              <span className="x-muted" style={{ display: "block", marginTop: 2 }}>
                Good for learning the material. It also makes this run easier than test
                day, so treat the score as practice, not a prediction.
              </span>
            </span>
          </label>
        ) : (
          <p className="x-muted" style={{ marginTop: 16 }}>
            A full mock gives no feedback until you submit — sitting with not-knowing
            is the part you are practising.
          </p>
        )}

        {rows.length > 0 && <BlueprintTable rows={rows} offering={offering} />}

        {error && (
          <div className="x-notice error" role="alert" style={{ marginTop: 18 }}>
            <span className="x-notice-icon" aria-hidden="true">⚠</span>
            <div>{error}</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-primary"
            onClick={onStart}
            disabled={!selected?.available}
          >
            Start {selected?.label?.toLowerCase() ?? "exam"}
          </button>
        </div>
        {MODES_TIMED(selected) && (
          <p className="x-muted" style={{ marginTop: 10 }}>
            The clock starts when you press the button.
            {selected?.id === "mock" && " A mock cannot be paused — that is the point of it."}
          </p>
        )}
      </section>
    </div>
  );
}

/** Whether the selected mode runs a clock at all. */
function MODES_TIMED(m) {
  return Boolean(m) && m.id !== "retry";
}

/**
 * What resuming will do — to the clock AND to the result.
 *
 * The interruption is not a footnote. lib/exam/scoring.js will only call a
 * result `official` if the sitting was uninterrupted (integrity.downtimeMs === 0
 * and no pauses), and resumeSession banks the gap as downtime — so resuming an
 * interrupted mock permanently voids its pass/fail. It still scores, still
 * breaks down by section, still drives the review; it just can never come back
 * as anything but indicative.
 *
 * That consequence belongs HERE, on the button, not in the caveats of a result
 * three hours from now. A learner who needs a pass/fail they can trust would
 * rather spend the three hours on a fresh form — but only if they are told
 * while the choice is still theirs.
 *
 * Said only where it is true: `official` is reachable by a mock alone, so a
 * warmup or section drill is not warned about losing a status it never had.
 */
function MODE_RESUME_NOTE(session) {
  if (session.limitMs === null) return "This one is untimed, so nothing was lost while you were away.";
  if (session.status === "paused") return "Your clock is paused and picks up where it was.";
  if (session.mode !== "mock") {
    return "Time spent away wasn't charged to your clock, and the interruption is noted on your result.";
  }
  return (
    "Time spent away wasn't charged to your clock — but because this mock was interrupted, it can no " +
    "longer count as an official pass or fail. You will get a full score, section breakdown and review, " +
    "marked indicative. If you need a result you can trust, start a fresh form instead of resuming this one."
  );
}

/**
 * What you are about to be tested on, before you commit to sitting it.
 *
 * Weights come from lib/exam's blueprint as FRACTIONS (0..1) and are printed via
 * formatPct after ×100 — while scores arrive already as 0..100. Two conventions
 * in one feature is how 44% becomes 4400%, so the conversion is explicit here.
 */
function BlueprintTable({ rows, offering }) {
  return (
    <div style={{ marginTop: 22, overflowX: "auto" }}>
      <table className="x-bp">
        <caption>
          What this exam tests, how much each section is worth, and what the bank
          currently holds for it.
        </caption>
        <thead>
          <tr>
            <th scope="col">Section</th>
            <th scope="col" style={{ width: 150 }}>Share of exam</th>
            <th scope="col" className="x-num" style={{ textAlign: "right" }}>Weight</th>
            <th scope="col" className="x-num" style={{ textAlign: "right" }}>On a full form</th>
            <th scope="col" className="x-num" style={{ textAlign: "right" }}>In the bank</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.label}</td>
              <td>
                <div className="x-bp-track">
                  <div className="x-bp-bar" style={{ width: `${Math.round(r.weight * 100)}%` }} />
                </div>
              </td>
              <td className="x-num">{formatPct(r.weight * 100)}</td>
              <td className="x-num">{r.quota}</td>
              {/* A section the bank is short on is called out right here, where
                  the learner is deciding whether to trust the form. */}
              <td className="x-num" style={r.short > 0 ? { color: "var(--gold-2)" } : undefined}>
                {r.available}{r.short > 0 ? ` (${r.short} short)` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {offering?.maxFaithfulLength > 0 && !offering.canOfferFullForm && (
        <p className="x-muted" style={{ marginTop: 8 }}>
          The longest blueprint-faithful form this bank can fill is{" "}
          {offering.maxFaithfulLength} questions, against a real{" "}
          {offering.scoredQuestions}.
        </p>
      )}
    </div>
  );
}

/**
 * The last screen before submit. Says plainly what is unfinished and lets the
 * learner go straight back to it — a dialog that only asks "Are you sure?" is not
 * information.
 */
function ConfirmSubmit({ session, onCancel, onConfirm, onJump }) {
  const summary = answerSheetSummary(session);

  return (
    <section className="x-panel">
      <h2 className="x-h" style={{ fontSize: 18 }}>Submit your exam?</h2>
      <p className="x-sub" style={{ marginTop: 8 }}>{submitWarning(session)}</p>

      <div className="x-counts" style={{ marginTop: 18 }}>
        <div className="x-count">
          <span className="x-count-v">{summary.answered}</span>
          <span className="x-count-k">answered</span>
        </div>
        <div className="x-count">
          <span className="x-count-v">{summary.unanswered}</span>
          <span className="x-count-k">unanswered</span>
        </div>
        <div className="x-count">
          <span className="x-count-v">{summary.flagged}</span>
          <span className="x-count-k">flagged</span>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <ItemNavigator session={session} onJump={onJump} />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          ← Keep working
        </button>
        <button type="button" className="btn-primary" onClick={onConfirm}>
          Submit for scoring
        </button>
      </div>
    </section>
  );
}
