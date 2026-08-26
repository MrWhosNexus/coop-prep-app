// The guided-lesson session runner: current step, attempts, hint escalation,
// step completion, lesson completion, scoring.
//
// A session is PLAIN JSON and references its lesson by id only, so lib/store
// can persist it untouched and a saved session survives lesson-content
// updates (deserializeSession reconciles by step id). Every function here is
// pure: it returns a NEW session and never mutates its input — the UI gets an
// undo/redo stack for free and tests stay deterministic.
//
// Session shape:
// {
//   version:   1
//   lessonId:  "excel-pivot"
//   stepIndex: number            index into lesson.steps; === steps.length
//                                when the lesson is complete
//   status:    "active" | "complete"
//   steps: [{
//     stepId:     "load-data"
//     status:     "pending" | "passed" | "skipped"
//     attempts:   number         submissions so far
//     hintsUsed:  number         deepest hint rung revealed (0..4); feeds
//                                scoring and, later, the AI tutor
//     bestScore:  number         best grade score seen (partial credit)
//     score:      number         final credit at pass time (grade × penalty)
//     lastResult: null | {pass, score, message, diff}   latest grade, JSON-safe
//   }]
// }
//
// Scoring model (documented so 20 lessons grade consistently):
//   hint penalty multiplier by deepest rung used:
//     0 hints → 1.0, nudge → 0.9, specific → 0.75, near-answer → 0.55,
//     show-me → 0.3
//   attempt penalty multiplier: first submission free, then −0.1 per failed
//     submission, floored at 0.3 (the same floor as show-me).
//   passed step   → gradeScore × hint penalty × attempt penalty
//   skipped step  → 0
//   unfinished    → bestScore × 0.5 × hint penalty × attempt penalty
//   lesson score  → mean over steps

import { grade } from "./graders.js";
import { checkpointForStep } from "./checkpoints.js";
import { HINT_RUNGS, resolveLessonMode, lessonModes } from "./spec.js";

/** Score multipliers indexed by the deepest hint rung used (0 = no hints). */
export const HINT_PENALTIES = [1, 0.9, 0.75, 0.55, 0.3];

/* Retry pricing. Before this existed, hints cost 10% but resubmission cost
   nothing, so guess-and-check strictly dominated asking for help — the audit
   caught learners spamming submissions precisely because it was the only free
   move. The curve is pinned to the hint ladder on purpose:
   one failed submission costs exactly one nudge (0.9), so a blind retry is
   NEVER cheaper than the mildest hint, and the floor equals show-me's 0.3 so
   grinding can't score below the learner who just asked to be shown. */
export const ATTEMPT_PENALTY_STEP = 0.1;
export const ATTEMPT_PENALTY_FLOOR = HINT_PENALTIES[HINT_PENALTIES.length - 1];

/**
 * The score multiplier for a step submitted `attempts` times (the passing
 * submission itself is free; only FAILED submissions are priced).
 * @param {number} attempts total submissions, including the passing one
 * @returns {number}
 */
export function attemptPenalty(attempts) {
  const failed = Math.max(0, (attempts ?? 0) - 1);
  return Math.max(ATTEMPT_PENALTY_FLOOR, 1 - ATTEMPT_PENALTY_STEP * failed);
}

/**
 * The score multiplier for a step whose user reached `hintsUsed` rungs.
 * @param {number} hintsUsed
 * @returns {number}
 */
export function hintPenalty(hintsUsed) {
  return HINT_PENALTIES[Math.min(hintsUsed ?? 0, HINT_PENALTIES.length - 1)];
}

function freshStepState(stepDef) {
  return {
    stepId: stepDef.id,
    status: "pending",
    attempts: 0,
    hintsUsed: 0,
    bestScore: 0,
    score: 0,
    lastResult: null,
  };
}

/* Resolve the lesson the session is actually running. A session created in an
   alternate mode (e.g. "outcome") must keep grading against that mode's step
   variants forever — resolving at every entry point (rather than once, at
   createSession) is what lets sessions stay plain JSON: they persist only the
   mode STRING and re-derive the variant steps from the lesson module. */
function effectiveLesson(session, lesson) {
  return resolveLessonMode(lesson, session?.mode);
}

/**
 * Start a new session for a lesson.
 * @param {object} lesson a GuidedLesson from createLesson()
 * @param {object} [opts]
 * @param {string} [opts.mode] which declared mode to run the lesson in
 *   (defaults to the lesson's own base mode). Must be one of
 *   lessonModes(lesson) — an undeclared mode throws here rather than
 *   silently serving the scaffolded variant.
 * @returns {object} a plain-JSON session
 */
export function createSession(lesson, opts = {}) {
  const mode = opts.mode ?? lesson.mode;
  if (!lessonModes(lesson).includes(mode)) {
    throw new RangeError(`createSession: lesson "${lesson.id}" does not declare mode "${mode}"`);
  }
  const resolved = resolveLessonMode(lesson, mode);
  return {
    version: 1,
    lessonId: lesson.id,
    mode,
    stepIndex: 0,
    status: "active",
    steps: resolved.steps.map(freshStepState),
  };
}

/**
 * The lesson step the session currently points at (null when complete).
 * @param {object} session
 * @param {object} lesson
 * @returns {object|null} the GuidedStep definition
 */
export function currentStep(session, lesson) {
  return effectiveLesson(session, lesson).steps[session.stepIndex] ?? null;
}

/** @param {object} session @returns {boolean} */
export function isComplete(session) {
  return session.status === "complete";
}

function withStep(session, index, stepState) {
  return { ...session, steps: session.steps.map((s, i) => (i === index ? stepState : s)) };
}

function advance(session, lesson) {
  const next = session.stepIndex + 1;
  if (next >= lesson.steps.length) {
    return { ...session, stepIndex: lesson.steps.length, status: "complete" };
  }
  return { ...session, stepIndex: next };
}

/**
 * Grade the current step against the live tool state. On a pass the step is
 * marked passed (credit = grade score × hint penalty) and the session
 * advances; on a fail the attempt and its result are recorded.
 * @param {object} session
 * @param {object} lesson
 * @param {object} toolState see graders.js tool-state contracts
 * @returns {{session: object, result: object|null}} result is the GradeResult
 *   (null when the session was already complete)
 */
export function submitStep(session, lesson, toolState) {
  if (isComplete(session)) return { session, result: null };
  lesson = effectiveLesson(session, lesson);
  const i = session.stepIndex;
  const stepDef = lesson.steps[i];
  const result = grade(toolState, stepDef.grader);

  const stepState = { ...session.steps[i] };
  stepState.attempts += 1;
  stepState.bestScore = Math.max(stepState.bestScore, result.score);
  stepState.lastResult = {
    pass: result.pass,
    score: result.score,
    message: result.message,
    diff: result.diff,
  };
  if (result.pass) {
    stepState.status = "passed";
    // Both penalties apply: hints price the help taken, attempts price the
    // failed submissions that preceded this pass (the pass itself is free).
    stepState.score =
      result.score * hintPenalty(stepState.hintsUsed) * attemptPenalty(stepState.attempts);
  }

  let next = withStep(session, i, stepState);
  if (result.pass) next = advance(next, lesson);
  return { session: next, result };
}

/**
 * Reveal the next hint rung for the current step (nudge → specific →
 * near-answer → show-me). Records the deepest rung reached.
 * @param {object} session
 * @param {object} lesson
 * @returns {{session: object, hint: {rung: number, label: string, text: string}|null}}
 *   hint is null when the ladder is exhausted (or the session is complete)
 */
export function requestHint(session, lesson) {
  if (isComplete(session)) return { session, hint: null };
  lesson = effectiveLesson(session, lesson);
  const i = session.stepIndex;
  const stepDef = lesson.steps[i];
  const rung = session.steps[i].hintsUsed;
  if (rung >= stepDef.hints.length) return { session, hint: null };
  const hint = {
    rung,
    label: HINT_RUNGS[rung] ?? `hint-${rung + 1}`,
    text: stepDef.hints[rung],
  };
  const next = withStep(session, i, { ...session.steps[i], hintsUsed: rung + 1 });
  return { session: next, hint };
}

/**
 * Give up on the current step: it scores 0 and the session moves on.
 * @param {object} session
 * @param {object} lesson
 * @returns {object} the new session
 */
export function skipStep(session, lesson) {
  if (isComplete(session)) return session;
  lesson = effectiveLesson(session, lesson);
  const i = session.stepIndex;
  const next = withStep(session, i, { ...session.steps[i], status: "skipped", score: 0 });
  return advance(next, lesson);
}

/**
 * Jump to a step (forward to preview, or back to redo). Returns the
 * checkpoint that seeds the tool for that step — materialize it with
 * checkpoints.js. `resumedFrom` < stepIndex means the nearest checkpoint is
 * earlier and the user must redo the steps in between.
 * @param {object} session
 * @param {object} lesson
 * @param {number} stepIndex
 * @returns {{session: object, checkpoint: {checkpoint: object, stepIndex: number}|null}}
 */
export function goToStep(session, lesson, stepIndex) {
  lesson = effectiveLesson(session, lesson);
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= lesson.steps.length) {
    throw new RangeError(`goToStep: step ${stepIndex} is out of range`);
  }
  const next = { ...session, stepIndex, status: "active" };
  return { session: next, checkpoint: checkpointForStep(lesson, stepIndex) };
}

/**
 * Score the whole session (see the scoring model in the module header).
 * @param {object} session
 * @param {object} lesson
 * @returns {{score: number, steps: Array<{stepId: string, status: string, credit: number, attempts: number, hintsUsed: number}>}}
 */
export function lessonScore(session, lesson) {
  const steps = session.steps.map((s) => {
    let credit;
    if (s.status === "passed") credit = s.score;
    else if (s.status === "skipped") credit = 0;
    else credit = s.bestScore * 0.5 * hintPenalty(s.hintsUsed) * attemptPenalty(s.attempts + 1);
    return {
      stepId: s.stepId,
      status: s.status,
      credit,
      attempts: s.attempts,
      hintsUsed: s.hintsUsed,
    };
  });
  const score = steps.length ? steps.reduce((a, s) => a + s.credit, 0) / steps.length : 0;
  return { score, steps };
}

/**
 * Deep-copy a session to plain JSON (it already is plain; this guarantees it).
 * @param {object} session
 * @returns {object}
 */
export function serializeSession(session) {
  return JSON.parse(JSON.stringify(session));
}

/**
 * Restore a session from persisted JSON, reconciling against the (possibly
 * updated) lesson: saved step states are matched by stepId, new steps start
 * pending, removed steps are dropped, and indices/status are re-clamped.
 * @param {string|object} json
 * @param {object} lesson the lesson the session belongs to
 * @returns {object} a live session
 */
export function deserializeSession(json, lesson) {
  const data = typeof json === "string" ? JSON.parse(json) : json;
  if (!data || typeof data !== "object") throw new Error("deserializeSession: invalid payload");
  if (data.version !== 1) throw new Error(`deserializeSession: unsupported version ${data.version}`);
  if (data.lessonId !== lesson.id) {
    throw new Error(`deserializeSession: session is for "${data.lessonId}", not "${lesson.id}"`);
  }
  /* Restore the session's mode, not the lesson's default. Dropping this field
     once caused an "outcome" session to silently resume as "guided" after an
     app restart — handing the learner the very formula the mode withholds. A
     saved mode the lesson no longer declares (lesson update) falls back to the
     lesson's base mode rather than throwing away the whole session. */
  const mode = lessonModes(lesson).includes(data.mode) ? data.mode : lesson.mode;
  const resolved = resolveLessonMode(lesson, mode);
  const saved = new Map((data.steps ?? []).map((s) => [s.stepId, s]));
  const steps = resolved.steps.map((def) => {
    const s = saved.get(def.id);
    return s ? { ...freshStepState(def), ...JSON.parse(JSON.stringify(s)) } : freshStepState(def);
  });
  const allDone = steps.every((s) => s.status === "passed" || s.status === "skipped");
  const stepIndex = allDone
    ? lesson.steps.length
    : Math.max(0, Math.min(Number(data.stepIndex) || 0, lesson.steps.length - 1));
  return {
    version: 1,
    lessonId: lesson.id,
    mode,
    stepIndex,
    status: allDone ? "complete" : "active",
    steps,
  };
}
