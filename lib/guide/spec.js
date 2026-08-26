// The GuidedLesson format — the contract between lesson CONTENT and the
// harness that runs it. A guided lesson drives a real tool (the sheet engine,
// the viz engine) and grades the user's actual work, step by step.
//
// ---------------------------------------------------------------------------
// FORMAT (this is the spec that lesson authors write against)
// ---------------------------------------------------------------------------
//
// GuidedLesson = {
//   id:          "excel-pivot"            unique slug, stable forever (sessions
//                                         persist it)
//   tool:        "sheet" | "viz"          which tool the lesson drives
//   title:       "Pivot tables ..."       shown in the UI
//   moduleId?:   "excel"                  curriculum module this belongs to
//   description?: "..."                   one-paragraph framing
//   resources?:  ["hmda-sample.csv"]      data files the host must supply (by
//                                         key) to materializeCheckpoint()
//   steps:       [GuidedStep, ...]        ordered; the user walks them in order
// }
//
// GuidedStep = {
//   id:          "first-xlookup"          unique within the lesson; defaults to
//                                         "step-N" when omitted
//   title?:      "Write the lookup"
//   instruction: "In H2, write an XLOOKUP that ..."   what the user must DO
//   hints?:      [nudge, specific, near-answer, show-me]
//                up to 4 strings, mildest first. The runner reveals them one
//                rung at a time and records the deepest rung reached — that
//                feeds scoring and, later, the AI tutor.
//   target?:     where the spotlight overlay points for this step, one of:
//                  { kind: "sheet-cell", ref: "H2", sheet?: "Applicants" }
//                  { kind: "selector", selector: "[data-guide-target='x']" }
//                  { kind: "region", anchor: "columns-shelf" }
//                Optional. Malformed shapes are rejected by validateLesson.
//   spotlightLabel?: "Write the lookup"   short objective shown in the
//                                         spotlight callout. Defaults to
//                                         step.title when omitted.
//   checkpoint?: CheckpointSpec           the COMPLETE tool state entering this
//                                         step, so the step is startable
//                                         without doing earlier steps. See
//                                         checkpoints.js. Step 0 must have one.
//   grader:      GraderDescriptor         how the step is judged. See
//                                         graders.js for every type and its
//                                         parameters.
// }
//
// GuidedLesson also accepts, both OPTIONAL:
//   mode?:  "guided" | "instructions"   default "guided". "guided" drives the
//           spotlight overlay + auto-advance; "instructions" is the manual
//           panel behavior that predates this field.
//   voice?: boolean                     default false. When true (and the
//           lesson is in guided mode), the Nexus Voice widget offers a
//           per-lesson "enable voice" toggle.
//
// ---------------------------------------------------------------------------
// METHOD vs OUTCOME — which grader to reach for
// ---------------------------------------------------------------------------
// Grade the OUTCOME when any route to the answer is fine:
//   cellValue, rangeValues, pivotResult, vizData
// Grade the METHOD when the method IS the lesson (an XLOOKUP lesson must see
// an XLOOKUP, not a hand-typed 42):
//   cellFormula, pivotSpec, vizSpec
// Combine both with allOf when a step needs "the right answer, reached the
// right way". predicate is the escape hatch for anything else — a pure
// function over tool state that returns a GradeResult.
//
// Lessons are JS modules, not JSON: a predicate grader holds a real function,
// so a lesson definition itself is not JSON-serializable. SESSIONS (runner.js)
// are always plain JSON — they reference lessons by id only.

/** Hint-ladder rung names, mildest first. */
export const HINT_RUNGS = ["nudge", "specific", "near-answer", "show-me"];

/** A step's hint ladder can have at most this many rungs. */
export const MAX_HINTS = HINT_RUNGS.length;

/** Every grader type graders.js knows how to run. */
export const GRADER_TYPES = [
  "cellValue",
  "cellFormula",
  "rangeValues",
  "pivotSpec",
  "pivotResult",
  "vizSpec",
  "vizData",
  "predicate",
  "allOf",
  "anyOf",
];

/** The tools a lesson can drive. */
export const TOOL_KINDS = ["sheet", "viz"];

/** The shapes a GuidedStep.target can take. */
export const TARGET_KINDS = ["sheet-cell", "selector", "region"];

/** The modes a GuidedLesson can run in. */
export const LESSON_MODES = ["guided", "instructions"];

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim() !== "";
}

function validateTarget(target, path, errors) {
  if (target === undefined || target === null) return;
  if (!target || typeof target !== "object") {
    errors.push(`${path}: target must be an object`);
    return;
  }
  if (!TARGET_KINDS.includes(target.kind)) {
    errors.push(`${path}: target.kind must be one of: ${TARGET_KINDS.join(", ")}`);
    return;
  }
  switch (target.kind) {
    case "sheet-cell":
      if (!isNonEmptyString(target.ref)) errors.push(`${path}: sheet-cell target needs a "ref" (e.g. "H2")`);
      if (target.sheet !== undefined && !isNonEmptyString(target.sheet)) {
        errors.push(`${path}: sheet-cell target.sheet must be a non-empty string when present`);
      }
      break;
    case "selector":
      if (!isNonEmptyString(target.selector)) errors.push(`${path}: selector target needs a "selector"`);
      break;
    case "region":
      if (!isNonEmptyString(target.anchor)) errors.push(`${path}: region target needs an "anchor"`);
      break;
    default:
      break;
  }
}

function validateGrader(g, path, errors) {
  if (!g || typeof g !== "object") {
    errors.push(`${path}: grader must be an object`);
    return;
  }
  if (!GRADER_TYPES.includes(g.type)) {
    errors.push(`${path}: unknown grader type "${g.type}"`);
    return;
  }
  switch (g.type) {
    case "cellValue":
      if (!isNonEmptyString(g.ref)) errors.push(`${path}: cellValue needs a "ref" (e.g. "B2")`);
      if (!("expected" in g)) errors.push(`${path}: cellValue needs "expected"`);
      break;
    case "cellFormula":
      if (!isNonEmptyString(g.ref)) errors.push(`${path}: cellFormula needs a "ref"`);
      if (!g.mustUse?.length && !g.mustNotUse?.length && !g.pattern && !("expectedValue" in g)) {
        errors.push(`${path}: cellFormula needs at least one of mustUse/mustNotUse/pattern/expectedValue`);
      }
      break;
    case "rangeValues":
      if (!isNonEmptyString(g.range)) errors.push(`${path}: rangeValues needs a "range" (e.g. "A1:C3")`);
      if (!Array.isArray(g.expected) || !g.expected.every(Array.isArray)) {
        errors.push(`${path}: rangeValues "expected" must be a 2D array`);
      }
      break;
    case "pivotSpec":
      if (!g.expected || typeof g.expected !== "object") errors.push(`${path}: pivotSpec needs an "expected" spec`);
      break;
    case "pivotResult":
      if (!Array.isArray(g.expected?.values) || g.expected.values.length === 0) {
        errors.push(`${path}: pivotResult "expected" must be a pivot spec with at least one value`);
      }
      break;
    case "vizSpec":
      if (!g.expected || typeof g.expected !== "object") errors.push(`${path}: vizSpec needs an "expected" shape`);
      break;
    case "vizData":
      if (!Array.isArray(g.expected) || g.expected.length === 0) {
        errors.push(`${path}: vizData "expected" must be a non-empty array of row objects`);
      }
      break;
    case "predicate":
      if (typeof g.fn !== "function") errors.push(`${path}: predicate needs an "fn" function`);
      break;
    case "allOf":
    case "anyOf":
      if (!Array.isArray(g.of) || g.of.length === 0) {
        errors.push(`${path}: ${g.type} needs a non-empty "of" array`);
      } else {
        g.of.forEach((child, i) => validateGrader(child, `${path}.of[${i}]`, errors));
      }
      break;
    default:
      break;
  }
}

/**
 * Validate a lesson definition against the GuidedLesson format.
 * @param {object} def
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateLesson(def) {
  const errors = [];
  if (!def || typeof def !== "object") {
    return { valid: false, errors: ["lesson must be an object"] };
  }
  if (!isNonEmptyString(def.id)) errors.push("lesson.id must be a non-empty string");
  if (!isNonEmptyString(def.title)) errors.push("lesson.title must be a non-empty string");
  if (!TOOL_KINDS.includes(def.tool)) errors.push(`lesson.tool must be one of: ${TOOL_KINDS.join(", ")}`);
  if (def.resources !== undefined && (!Array.isArray(def.resources) || !def.resources.every(isNonEmptyString))) {
    errors.push("lesson.resources must be an array of resource keys");
  }
  if (def.mode !== undefined && !LESSON_MODES.includes(def.mode)) {
    errors.push(`lesson.mode must be one of: ${LESSON_MODES.join(", ")}`);
  }
  if (def.voice !== undefined && typeof def.voice !== "boolean") {
    errors.push("lesson.voice must be a boolean");
  }
  if (!Array.isArray(def.steps) || def.steps.length === 0) {
    errors.push("lesson.steps must be a non-empty array");
    return { valid: errors.length === 0, errors };
  }

  const ids = new Set();
  def.steps.forEach((step, i) => {
    const path = `steps[${i}]`;
    if (!step || typeof step !== "object") {
      errors.push(`${path}: step must be an object`);
      return;
    }
    if (step.id !== undefined) {
      if (!isNonEmptyString(step.id)) errors.push(`${path}: step.id must be a non-empty string`);
      else if (ids.has(step.id)) errors.push(`${path}: duplicate step id "${step.id}"`);
      else ids.add(step.id);
    }
    if (!isNonEmptyString(step.instruction)) errors.push(`${path}: step.instruction is required`);
    if (step.hints !== undefined) {
      if (!Array.isArray(step.hints) || !step.hints.every(isNonEmptyString)) {
        errors.push(`${path}: step.hints must be an array of strings`);
      } else if (step.hints.length > MAX_HINTS) {
        errors.push(`${path}: at most ${MAX_HINTS} hints (${HINT_RUNGS.join(" → ")})`);
      }
    }
    if (step.checkpoint !== undefined && step.checkpoint !== null) {
      if (typeof step.checkpoint !== "object" || !TOOL_KINDS.includes(step.checkpoint.tool)) {
        errors.push(`${path}: step.checkpoint.tool must be one of: ${TOOL_KINDS.join(", ")}`);
      }
    }
    if (i === 0 && !step.checkpoint) {
      errors.push("steps[0] must have a checkpoint — a lesson has to be startable");
    }
    if (step.spotlightLabel !== undefined && !isNonEmptyString(step.spotlightLabel)) {
      errors.push(`${path}: step.spotlightLabel must be a non-empty string when present`);
    }
    validateTarget(step.target, `${path}.target`, errors);
    validateGrader(step.grader, `${path}.grader`, errors);
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Normalize and validate a lesson definition. Throws on an invalid one, so
 * authoring mistakes surface at import time, not mid-lesson.
 * @param {object} def a GuidedLesson definition (see module header)
 * @returns {object} the normalized lesson
 */
export function createLesson(def) {
  const { valid, errors } = validateLesson(def);
  if (!valid) {
    throw new Error(`Invalid guided lesson${def?.id ? ` "${def.id}"` : ""}:\n  - ${errors.join("\n  - ")}`);
  }
  return {
    ...def,
    description: def.description ?? "",
    resources: def.resources ?? [],
    mode: def.mode ?? "guided",
    voice: def.voice ?? false,
    steps: def.steps.map((step, i) => ({
      ...step,
      id: step.id ?? `step-${i + 1}`,
      title: step.title ?? "",
      hints: step.hints ?? [],
      checkpoint: step.checkpoint ?? null,
      target: step.target ?? null,
      spotlightLabel: step.spotlightLabel ?? step.title ?? "",
    })),
  };
}
