// lib/exam/scoring.js
// Turning a finished sitting into a number -- carefully.
//
// The engineering here is trivial (count the right ones). The judgment is
// not. Two rules govern this file:
//
//   1. A percentage only means "SIE 72%" if it came off a form that was
//      actually shaped like the SIE. Any other form is scored honestly and
//      labelled `verdict: "indicative"`, with the reason spelled out in
//      `caveats`. The learner must never walk away believing they cleared a
//      pass mark on a form that wasn't a real one.
//   2. `scaled` is an approximation and says so. FINRA and NASAA report an
//      IRT-equated scaled score that accounts for form difficulty; we have
//      no equating data and inventing one would be a fabricated number
//      dressed up as a real one. So the scale here is a plain linear map of
//      the raw percentage, flagged `scaledIsApproximate`.
//   3. An approximation may never cross the pass mark that the raw score did
//      not. See approximateScaled(): rounding a 71.54% fail to 72 -- the exact
//      Series 65 pass mark -- tells a learner they passed when they failed,
//      and `scaledIsApproximate: true` does not undo that. The number itself
//      would be the lie. Truncation, plus a clamp that keeps `scaled` on the
//      same side of the mark as `passed`, is the honest operation near a
//      boundary we cannot equate.

import { normalizeBlueprint } from "./blueprint.js";
import { MODES, STATUS } from "./session.js";

/**
 * @typedef {object} SectionScore
 * @property {string} id
 * @property {string} label
 * @property {number} quota questions this section was supposed to contribute
 * @property {number} asked questions it actually contributed
 * @property {number} correct
 * @property {number} incorrect
 * @property {number} unanswered
 * @property {number} pct 0..100, of the questions asked in this section
 * @property {number} weight blueprint weight, 0..1
 * @property {boolean} belowPassMark
 * @property {boolean} short the bank couldn't fill this section's quota
 */

/**
 * @typedef {object} ExamScore
 * @property {string} certId
 * @property {string} mode
 * @property {number} total questions on the form
 * @property {number} correct
 * @property {number} incorrect
 * @property {number} unanswered
 * @property {number} raw 0..1
 * @property {number} rawPct 0..100, two decimals
 * @property {number} scaled approximate 0..100 scale (see scaledIsApproximate)
 * @property {boolean} scaledIsApproximate always true -- we do not equate
 * @property {string} scaledNote
 * @property {{pct: number, count: number}} passMark the mark for THIS form's length
 * @property {boolean} passed correct >= passMark.count on this form
 * @property {boolean} official true only for a full-length, blueprint-faithful, uninterrupted mock
 * @property {"pass"|"fail"|"indicative"} verdict
 * @property {SectionScore[]} bySection
 * @property {SectionScore[]} weakest ascending by pct, worst first
 * @property {string[]} caveats every reason this number is worth less than it looks
 * @property {number} durationMs
 * @property {boolean} timedOut
 */

function round2(n) {
  return Math.round(n * 100) / 100;
}

function fmtMinutes(msValue) {
  return Math.round(msValue / 60000);
}

/**
 * The approximate scaled score: a linear map of the raw percentage that can
 * never contradict `passed`.
 *
 * We truncate rather than round. Rounding is the wrong operation next to a
 * boundary we cannot equate: it moves a score UP to 0.5 points, and the only
 * place that half-point matters is exactly where it must not -- across the
 * pass mark. On the Series 65 a failing 93/130 is 71.54%, which rounds to 72:
 * the pass mark itself, and the same number a passing 94/130 reports. The
 * learner reads 72 and stops studying.
 *
 * Truncation alone already fixes that direction (a fail is strictly below the
 * mark, so its floor is too), but the clamp is kept explicit rather than left
 * as an emergent property of the arithmetic: this invariant is the point of
 * the function, and it should not quietly break if a blueprint ever arrives
 * with a fractional pass percentage.
 *
 * @param {number} rawPct 0..100
 * @param {number} passPct the blueprint's pass mark
 * @param {boolean} passed whether the RAW score cleared the mark on this form
 * @returns {number} 0..100, on the same side of passPct as `passed`
 */
function approximateScaled(rawPct, passPct, passed) {
  const scaled = Math.floor(rawPct);
  // `passed` is the truth; `scaled` is an approximation of it. Where they
  // disagree, the approximation yields.
  if (passed) return Math.max(scaled, Math.ceil(passPct));
  return Math.max(0, Math.min(scaled, Math.ceil(passPct) - 1));
}

/**
 * Score a sitting. Works on an in-progress session too (unanswered items
 * simply count as wrong), so a UI can show a live "if you stopped now".
 * Pure.
 * @param {object} session
 * @returns {ExamScore}
 */
export function scoreSession(session) {
  const form = session.form;
  const bp = normalizeBlueprint(form.blueprint);
  const items = form.items;
  const total = items.length;

  const byId = new Map(bp.sections.map((s) => [s.id, {
    id: s.id,
    label: s.label,
    quota: form.quotas?.[s.id] ?? 0,
    asked: 0,
    correct: 0,
    incorrect: 0,
    unanswered: 0,
    pct: 0,
    weight: s.weight,
    belowPassMark: false,
    short: form.shortfalls?.some((sf) => sf.section === s.id) ?? false,
  }]));

  let correct = 0;
  let unanswered = 0;

  for (const item of items) {
    const chosen = session.answers[item.id];
    const row = byId.get(item.section);
    if (row) row.asked += 1;
    if (chosen === undefined) {
      unanswered += 1;
      if (row) row.unanswered += 1;
    } else if (chosen === item.correctIndex) {
      correct += 1;
      if (row) row.correct += 1;
    } else if (row) {
      row.incorrect += 1;
    }
  }

  const bySection = [...byId.values()].filter((s) => s.asked > 0 || s.quota > 0);
  for (const s of bySection) {
    s.pct = s.asked ? round2((s.correct / s.asked) * 100) : 0;
    s.belowPassMark = s.asked > 0 && s.pct < bp.passPct;
  }

  const raw = total ? correct / total : 0;
  const rawPct = round2(raw * 100);
  const passMark = { pct: bp.passPct, count: Math.ceil((bp.passPct / 100) * total) };
  const passed = total > 0 && correct >= passMark.count;

  const modeDef = MODES[session.mode] ?? null;
  const fullLength = total === bp.scoredQuestions;
  const clean = session.integrity?.downtimeMs === 0 && session.integrity?.pauses === 0;
  const official = Boolean(
    session.mode === "mock" && form.faithful && fullLength && clean && session.status === STATUS.SUBMITTED,
  );

  const caveats = [];
  if (!form.faithful) {
    for (const sf of form.shortfalls ?? []) {
      caveats.push(
        `${sf.label} was ${sf.short} question(s) short of its blueprint quota (${sf.drawn}/${sf.quota}) — ` +
        `the bank doesn't hold enough there yet. Your score under-samples that section.`,
      );
    }
    if (!(form.shortfalls ?? []).length) {
      caveats.push("This form was not drawn to the blueprint, so its percentage is not comparable to a real exam result.");
    }
  }
  if (session.mode !== "mock") {
    caveats.push(
      `This was a ${(modeDef?.label ?? session.mode).toLowerCase()}, not a full mock — ` +
      `${bp.name} pass/fail only means something on a full-length ${bp.scoredQuestions}-question form.`,
    );
  } else if (!fullLength) {
    caveats.push(`This mock was ${total} questions, not the real ${bp.scoredQuestions}. Treat the percentage as indicative.`);
  }
  if (session.integrity?.pauses) {
    caveats.push(`The attempt was paused ${session.integrity.pauses} time(s). The real exam has no pause.`);
  }
  if (session.integrity?.downtimeMs) {
    caveats.push(
      `The attempt was interrupted and resumed after about ${fmtMinutes(session.integrity.downtimeMs)} minute(s) ` +
      `that were not charged to the clock.`,
    );
  }
  if (session.timedOut) {
    caveats.push(`Time expired with ${unanswered} question(s) unanswered — on test day those are simply wrong.`);
  }
  if (session.status !== STATUS.SUBMITTED) {
    caveats.push("This attempt has not been submitted yet — this is a provisional score.");
  }

  const verdict = official ? (passed ? "pass" : "fail") : "indicative";

  return {
    certId: bp.id,
    mode: session.mode,
    total,
    correct,
    incorrect: total - correct - unanswered,
    unanswered,
    raw,
    rawPct,
    scaled: approximateScaled(rawPct, bp.passPct, passed),
    scaledIsApproximate: true,
    scaledNote:
      `${bp.name} reports an IRT-equated scaled score that adjusts for form difficulty. ` +
      `This app has no equating data, so this number is a straight linear map of your raw percentage, ` +
      `truncated rather than rounded so it can never land on the wrong side of the ${bp.passPct}% mark — ` +
      `close enough to steer study, not a prediction of your official score.`,
    passMark,
    passed,
    official,
    verdict,
    bySection,
    weakest: [...bySection].filter((s) => s.asked > 0).sort((a, b) => (a.pct === b.pct ? (a.id < b.id ? -1 : 1) : a.pct - b.pct)),
    caveats,
    durationMs: session.elapsedMs ?? 0,
    timedOut: Boolean(session.timedOut),
  };
}

/**
 * A one-line headline a UI can print without having to decide how much of
 * the truth to include.
 * @param {ExamScore} score
 * @returns {string}
 */
export function scoreHeadline(score) {
  const base = `${score.correct}/${score.total} (${score.rawPct}%)`;
  if (score.verdict === "indicative") return `${base} — indicative, not a pass/fail result`;
  return `${base} — ${score.passed ? "PASS" : "FAIL"} against a ${score.passMark.pct}% mark (${score.passMark.count}/${score.total} needed)`;
}
