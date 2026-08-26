/**
 * The single seam between the guided-lesson UI and lib/guide/.
 *
 * Nothing else under components/guide/ may import lib/guide/ directly. If the
 * real lib/guide API differs from what is assumed here, THIS FILE is the only
 * one that changes.
 *
 * The file has two halves, and they have different stability contracts:
 *
 *   1. SEAM      — adapts whatever lib/guide/ exports into the normalized
 *                  shapes below. Expect the integration agent to edit this.
 *   2. PURE      — normalized-shape helpers (diff -> teaching prose, the hint
 *                  state machine). These are covered by test/guide-ui.test.js
 *                  and should survive any lib/guide API change untouched.
 *
 * This module is deliberately free of React and JSX: `node --test` cannot parse
 * JSX, so the tested logic has to live somewhere it can be imported directly.
 *
 * ── Normalized shapes ───────────────────────────────────────────────────────
 *
 * GuideStep   {id, title, instruction, context, checkpoint, hints:[Hint],
 *              target, spotlightLabel}
 * Hint        {text, cost}
 * GuideResult {pass, message, diff:[DiffEntry], raw}
 * DiffEntry   {kind, title, detail, field, aggregation, shelf, ref,
 *              expected, actual}
 *   kind: "shelf" | "mark" | "filter" | "cell" | "value" | "generic"
 */

/* ══════════════════════════════════════════════════════════════════════════
   1. SEAM — lib/guide/ adaptation
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Wrap a lib/guide module into the facade the UI consumes.
 *
 * Injected rather than imported so that (a) the UI builds before lib/guide
 * lands, and (b) tests can drive it with a stub. The integration agent should
 * import the real module and pass it in — see wiringNeeded.
 *
 * @param {Object} [guideModule] the lib/guide runner module, if present
 * @returns {{createRunner:Function, available:boolean}}
 */
export function attachGuide(guideModule) {
  if (!guideModule) {
    return { available: false, createRunner: () => null };
  }

  // The REAL lib/guide/runner.js (as shipped) exposes pure session functions —
  // createSession/submitStep/requestHint/... over immutable plain-JSON
  // sessions — rather than a stateful runner factory. Wrap them into the
  // runner facade the UI wiring expects.
  if (
    typeof guideModule.createSession === "function" &&
    typeof guideModule.submitStep === "function"
  ) {
    return {
      available: true,
      // opts pass through to createSession — {mode} selects a declared
      // lesson-mode variant (spec.js LESSON_MODES); omitted = base mode.
      createRunner: (lesson, opts) => createSessionRunner(guideModule, lesson, opts),
    };
  }

  // Fallback: a module that already exposes a runner factory.
  const factory =
    guideModule.createRunner ??
    guideModule.createGuideRunner ??
    guideModule.createRun ??
    guideModule.default;
  return {
    available: typeof factory === "function",
    createRunner: (lesson, opts) => (typeof factory === "function" ? factory(lesson, opts) : null),
  };
}

/**
 * Stateful facade over lib/guide/runner.js's pure session functions.
 * Holds the current (immutable) session and swaps it on every action, so the
 * UI gets one object with methods instead of threading session state itself.
 *
 * @param {Object} g the lib/guide/runner.js module
 * @param {Object} lesson a GuidedLesson (lib/guide/spec.js createLesson output)
 */
function createSessionRunner(g, lesson, opts) {
  let session = g.createSession(lesson, opts);
  return {
    lesson,
    /** The current plain-JSON session (persist with serialize()). */
    getSession: () => session,
    currentStep: () => g.currentStep(session, lesson),
    /** Grade the live tool state against the current step. Returns the raw GradeResult (feed to normalizeResult). */
    submit(toolState) {
      const { session: next, result } = g.submitStep(session, lesson, toolState);
      session = next;
      return result;
    },
    /** Escalate one hint rung. Returns {rung, label, text} or null when exhausted. */
    hint() {
      if (typeof g.requestHint !== "function") return null;
      const { session: next, hint } = g.requestHint(session, lesson);
      session = next;
      return hint;
    },
    skip() {
      if (typeof g.skipStep === "function") session = g.skipStep(session, lesson);
      return session;
    },
    /** Jump to a step. Returns the {checkpoint, stepIndex} to re-seed the tool from (or null). */
    goTo(i) {
      if (typeof g.goToStep !== "function") return null;
      const { session: next, checkpoint } = g.goToStep(session, lesson, i);
      session = next;
      return checkpoint;
    },
    isComplete: () => (typeof g.isComplete === "function" ? g.isComplete(session) : false),
    score: () => (typeof g.lessonScore === "function" ? g.lessonScore(session, lesson) : null),
    serialize: () => (typeof g.serializeSession === "function" ? g.serializeSession(session) : session),
    restore(json) {
      if (typeof g.deserializeSession === "function") session = g.deserializeSession(json, lesson);
      return session;
    },
  };
}

/**
 * Normalize a lib/guide step into a GuideStep.
 * @param {Object} step
 * @param {number} index
 * @returns {Object} GuideStep
 */
export function normalizeStep(step, index = 0) {
  if (!step) return null;
  return {
    id: step.id ?? `step-${index + 1}`,
    title: step.title ?? step.name ?? `Step ${index + 1}`,
    instruction: step.instruction ?? step.prompt ?? step.text ?? "",
    // What the learner is working on: dataset, sheet, or worksheet name.
    // Only ever a string. step.target is now a spotlight descriptor OBJECT
    // ({kind,...}) on real lessons, so it must not fall through into context
    // (React refuses to render an object child and the panel would crash).
    context:
      typeof step.context === "string"
        ? step.context
        : typeof step.dataset === "string"
          ? step.dataset
          : typeof step.target === "string"
            ? step.target
            : null,
    // The panel uses this as a map KEY. lib/guide's real steps carry a
    // CheckpointSpec OBJECT here (the tool state entering the step), which
    // must not be stringified into a key — fall back to the step id.
    checkpoint:
      typeof step.checkpoint === "string"
        ? step.checkpoint
        : (step.id ?? `step-${index + 1}`),
    hints: normalizeHints(step.hints),
    // Where the spotlight overlay should point, and what its callout
    // heading reads. Both optional in lib/guide; createLesson() already
    // defaults spotlightLabel to the step title, but normalize again here
    // so raw (non-createLesson) step objects behave the same way.
    target: step.target ?? null,
    spotlightLabel: step.spotlightLabel ?? step.title ?? step.name ?? `Step ${index + 1}`,
  };
}

/**
 * Normalize a hint ladder. Accepts bare strings or {text, cost} objects.
 * Costs escalate when unspecified: the later the hint, the more it gives away.
 * @param {Array} hints
 * @returns {Array<{text:string, cost:number}>}
 */
export function normalizeHints(hints) {
  const DEFAULT_COSTS = [10, 20, 40];
  return (hints ?? []).map((h, i) => {
    const text = typeof h === "string" ? h : (h?.text ?? h?.hint ?? "");
    const cost = typeof h === "object" && h !== null && typeof h.cost === "number"
      ? h.cost
      : (DEFAULT_COSTS[i] ?? DEFAULT_COSTS[DEFAULT_COSTS.length - 1]);
    return { text, cost };
  });
}

/**
 * Normalize a grader result into a GuideResult.
 *
 * Handles both known shapes:
 *   - lib/viz/spec.js specMatches(): {matches, misses:[string]}
 *   - the Phase 2 brief's grader:    {pass, actual, expected, message, diff}
 *
 * @param {Object} result raw grader output
 * @returns {Object} GuideResult
 */
export function normalizeResult(result) {
  if (!result) return { pass: false, message: "No result.", diff: [], raw: result };

  const pass = result.pass ?? result.matches ?? false;

  // Prefer a structured diff when the grader supplies one.
  let diff = [];
  if (Array.isArray(result.diff) && result.diff.length) {
    diff = result.diff.map(normalizeDiffEntry);
  } else if (Array.isArray(result.misses) && result.misses.length) {
    diff = result.misses.map(parseMiss);
  } else if (!pass && (result.expected !== undefined || result.actual !== undefined)) {
    diff = [normalizeDiffEntry({ expected: result.expected, actual: result.actual })];
  }

  return {
    pass,
    message: result.message ?? (pass ? "" : ""),
    diff,
    raw: result,
  };
}

/**
 * Normalize one structured diff entry, inferring kind and writing the teaching
 * prose if the grader did not.
 * @param {Object} e
 * @returns {Object} DiffEntry
 */
export function normalizeDiffEntry(e) {
  const src = isGuideGraderEntry(e) ? fromGuideGraderEntry(e) : e;
  const entry = {
    kind: src.kind ?? inferKind(src),
    field: src.field ?? null,
    aggregation: src.aggregation ?? null,
    shelf: src.shelf ?? null,
    ref: src.ref ?? src.cell ?? null,
    expected: src.expected ?? null,
    actual: src.actual ?? null,
    title: src.title ?? null,
    detail: src.detail ?? src.message ?? src.hint ?? null,
  };
  if (!entry.title) entry.title = diffTitle(entry);
  if (!entry.detail) entry.detail = diffDetail(entry);
  return entry;
}

/** The DiffEntry kinds this adapter renders natively. */
const ADAPTER_KINDS = new Set(["shelf", "mark", "filter", "cell", "value", "generic"]);

/** Headline vocabulary for lib/guide's grader diff kinds. */
const GUIDE_KIND_TITLES = {
  missing: "Something is missing",
  extra: "Something extra crept in",
  wrong: "Not quite right",
  misplaced: "Right thing, wrong place",
  method: "Right answer, wrong method",
};

/** Cell address (optionally sheet-qualified): B2, $H$2, Applicants!H2. */
const CELL_PATH_RE = /^(?:[^!]+!)?\$?[A-Z]{1,3}\$?[0-9]+$/;

function isGuideGraderEntry(e) {
  return (
    e &&
    typeof e.kind === "string" &&
    !ADAPTER_KINDS.has(e.kind) &&
    (typeof e.path === "string" || typeof e.hint === "string")
  );
}

/**
 * Translate a lib/guide/graders.js diff entry —
 * {kind: missing|extra|wrong|misplaced|method, path, expected, actual, hint} —
 * into this adapter's vocabulary. The grader's `hint` is a ready-made teaching
 * sentence, so it becomes the detail verbatim; cell-shaped paths render as
 * cell compares.
 */
function fromGuideGraderEntry(e) {
  const path = typeof e.path === "string" ? e.path : "";
  const isRef = CELL_PATH_RE.test(path);
  return {
    kind: isRef ? "cell" : "generic",
    ref: isRef ? path : null,
    title: isRef ? null : (GUIDE_KIND_TITLES[e.kind] ?? null),
    detail: e.hint ?? null,
    expected: e.expected,
    actual: e.actual,
  };
}

function inferKind(e) {
  if (e.ref || e.cell) return "cell";
  if (e.shelf === "filters") return "filter";
  if (e.shelf) return "shelf";
  if (e.mark || e.kind === "mark") return "mark";
  return "generic";
}

/* ══════════════════════════════════════════════════════════════════════════
   2. PURE — normalized-shape helpers. Tested. Stable across API changes.
   ══════════════════════════════════════════════════════════════════════════ */

/** Human labels for viz shelves. */
export const SHELF_LABELS = {
  rows: "Rows",
  columns: "Columns",
  color: "Color",
  size: "Size",
  label: "Label",
  detail: "Detail",
  tooltip: "Tooltip",
  filters: "Filters",
};

/**
 * Human label for a shelf id, falling back to the raw id.
 * @param {string} shelf
 * @returns {string}
 */
export function shelfLabel(shelf) {
  if (!shelf) return "";
  return SHELF_LABELS[shelf] ?? shelf;
}

/**
 * Render a field + aggregation the way a pill reads: COUNT(applicant_id).
 * @param {string} field
 * @param {string} [aggregation]
 * @returns {string}
 */
export function pillLabel(field, aggregation) {
  if (!field) return "";
  return aggregation ? `${aggregation}(${field})` : field;
}

/**
 * Parse one specMatches() miss string into a structured DiffEntry.
 *
 * specMatches emits exactly three sentence forms:
 *   "Expected race on rows."
 *   "Expected COUNT(applicant_id) on columns."
 *   "Expected the bar mark type, found line."
 *   "Expected a filter on approved."
 *
 * Recovering the structure is what lets Feedback name the field and the shelf
 * instead of printing a sentence at the learner.
 *
 * @param {string} miss
 * @returns {Object} DiffEntry
 */
export function parseMiss(miss) {
  const s = String(miss ?? "").trim();

  // "Expected the bar mark type, found line."
  const mark = s.match(/^Expected the ([^.\s]+) mark type, found ([^.\s]+)\.?$/);
  if (mark) {
    return normalizeDiffEntry({
      kind: "mark",
      expected: mark[1],
      actual: mark[2] === "null" ? null : mark[2],
    });
  }

  // "Expected a filter on approved."
  const filter = s.match(/^Expected a filter on (.+?)\.?$/);
  if (filter) {
    return normalizeDiffEntry({ kind: "filter", field: filter[1], shelf: "filters" });
  }

  // "Expected COUNT(applicant_id) on columns." / "Expected race on rows."
  const shelf = s.match(/^Expected (?:(\w+)\()?([^()]+?)\)? on (\w+)\.?$/);
  if (shelf) {
    return normalizeDiffEntry({
      kind: "shelf",
      aggregation: shelf[1] ?? null,
      field: shelf[2],
      shelf: shelf[3],
    });
  }

  // Unrecognized — keep the grader's own words rather than inventing worse ones.
  return normalizeDiffEntry({ kind: "generic", detail: s });
}

/**
 * The headline for a diff entry: what is off, in the learner's vocabulary.
 * Never the word "incorrect".
 * @param {Object} entry DiffEntry
 * @returns {string}
 */
export function diffTitle(entry) {
  switch (entry.kind) {
    case "shelf":
      return `${pillLabel(entry.field, entry.aggregation)} → ${shelfLabel(entry.shelf)}`;
    case "filter":
      return `Filter on ${entry.field}`;
    case "mark":
      return `Mark type → ${entry.expected}`;
    case "cell":
      return `Cell ${entry.ref}`;
    case "value":
      return entry.field ? `Value of ${entry.field}` : "Value";
    default:
      return "Not there yet";
  }
}

/**
 * The teaching sentence under the headline. This is the component's whole
 * reason to exist: say what is missing, where it goes, and what is there now.
 * @param {Object} entry DiffEntry
 * @returns {string}
 */
export function diffDetail(entry) {
  const pill = pillLabel(entry.field, entry.aggregation);
  switch (entry.kind) {
    case "shelf":
      return entry.aggregation
        ? `Drop ${entry.field} on the ${shelfLabel(entry.shelf)} shelf and set its aggregation to ${entry.aggregation}. The pill should read ${pill}.`
        : `Drop ${entry.field} on the ${shelfLabel(entry.shelf)} shelf.`;
    case "filter":
      return `Add ${entry.field} to the Filters shelf and choose which values to keep.`;
    case "mark":
      return entry.actual
        ? `The view is drawing ${entry.actual} marks. Switch the mark type to ${entry.expected}.`
        : `Set the mark type to ${entry.expected}.`;
    case "cell":
      return `${entry.ref} holds ${formatSide(entry.actual)}. It should come out to ${formatSide(entry.expected)}.`;
    case "value":
      return `Found ${formatSide(entry.actual)}, expected ${formatSide(entry.expected)}.`;
    default:
      return entry.detail ?? "";
  }
}

/**
 * Render one side of a diff for display. Empty cells and errors have to read as
 * themselves, not as "undefined".
 * @param {*} v
 * @returns {string}
 */
export function formatSide(v) {
  if (v === null || v === undefined || v === "") return "(empty)";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  // FormulaError instances stringify to #DIV/0! etc.
  if (typeof v === "object" && typeof v.name === "string" && v.name.startsWith("#")) return v.name;
  return String(v);
}

/**
 * One-line summary of a result, for the panel header and screen readers.
 * @param {Object} result GuideResult
 * @returns {string}
 */
export function summarize(result) {
  if (!result) return "";
  if (result.pass) return result.message || "Step cleared.";
  const n = result.diff.length;
  if (n === 0) return result.message || "Not there yet.";
  return n === 1 ? "One thing left." : `${n} things left.`;
}

/* ── Hint ladder state machine ─────────────────────────────────────────────
   Hints are a ladder, not a dump: one rung at a time, each rung costs score.
   State is immutable — the repo's reducers all return new objects.
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Initial hint state for a step.
 * @returns {{revealed:number, spent:number}}
 */
export function createHintState() {
  return { revealed: 0, spent: 0 };
}

/**
 * Reveal the next rung. No-op (same object) once the ladder is exhausted, so a
 * hammered button cannot run the score negative.
 * @param {{revealed:number, spent:number}} state
 * @param {Array<{text:string, cost:number}>} hints
 * @returns {{revealed:number, spent:number}}
 */
export function revealNextHint(state, hints) {
  const ladder = hints ?? [];
  if (state.revealed >= ladder.length) return state;
  const cost = ladder[state.revealed]?.cost ?? 0;
  return { revealed: state.revealed + 1, spent: state.spent + cost };
}

/**
 * The hints currently on screen.
 * @param {{revealed:number}} state
 * @param {Array} hints
 * @returns {Array<{text:string, cost:number}>}
 */
export function visibleHints(state, hints) {
  return (hints ?? []).slice(0, state.revealed);
}

/**
 * Is there another rung?
 * @param {{revealed:number}} state
 * @param {Array} hints
 * @returns {boolean}
 */
export function hasMoreHints(state, hints) {
  return state.revealed < (hints ?? []).length;
}

/**
 * What the next reveal will cost — shown on the button, so the price is known
 * BEFORE it is paid.
 * @param {{revealed:number}} state
 * @param {Array} hints
 * @returns {number} 0 when the ladder is exhausted
 */
export function nextHintCost(state, hints) {
  const ladder = hints ?? [];
  if (state.revealed >= ladder.length) return 0;
  return ladder[state.revealed]?.cost ?? 0;
}

/**
 * Score a completed step out of 100.
 *
 * Hints cost their listed price; each failed check costs 5. A step never scores
 * below 40 — a learner who worked the ladder all the way down still solved it,
 * and a floor of zero teaches them to stop asking for help.
 *
 * @param {{spent:number}} hintState
 * @param {number} [attempts] failed checks before the pass
 * @returns {number} 40..100
 */
export function stepScore(hintState, attempts = 0) {
  const raw = 100 - (hintState?.spent ?? 0) - Math.max(0, attempts) * 5;
  return Math.max(40, Math.min(100, raw));
}

/**
 * How the score got to where it did — shown on completion so the number is
 * never a mystery.
 * @param {{spent:number}} hintState
 * @param {number} [attempts]
 * @returns {Array<{label:string, delta:number}>}
 */
export function scoreBreakdown(hintState, attempts = 0) {
  const out = [{ label: "Solved", delta: 100 }];
  if (hintState?.spent) out.push({ label: "Hints", delta: -hintState.spent });
  if (attempts > 0) out.push({ label: `${attempts} check${attempts === 1 ? "" : "s"} before it landed`, delta: -attempts * 5 });
  return out;
}
