// Resumable checkpoints: seed a tool into a known state so step 4 works
// without redoing steps 1-3.
//
// A CheckpointSpec is the COMPLETE tool state entering its step — not an
// incremental patch — so any step that carries one is a clean entry point.
// Checkpoints are plain data; they reference datasets by RESOURCE KEY and the
// host passes the actual text in a `resources` map, so this module stays pure
// (no fs, no fetch) and runs identically in the renderer and under node.
//
// CheckpointSpec, sheet tool:
//   { tool: "sheet",
//     active?: "Applicants",              active tab; defaults to the first
//     sheets: [                           one entry per tab
//       { name: "Applicants",
//         load?: [{ resource: "hmda-sample.csv", origin?: "A1" }],
//         cells?: { "H1": "region", "H2": "=XLOOKUP(...)" } }   applied AFTER load
//     ],
//     pivot?: { sourceRange: "A1:G101",
//               spec: { rows: [], cols: [], values: [], filters: {} } } }
//
// CheckpointSpec, viz tool:
//   { tool: "viz",
//     data: { resource: "hmda-sample.csv" } | { rows: [...] },
//     calculatedFields?: [{ name, expression, type?, role? }],
//     shelves?: { columns: ["race"],                  field name, or
//                 rows: [{ field, aggregation?, discrete?, type? }],
//                 color: {...} | null, ... },         single-pill shelves take one entry
//     mark?: "bar",
//     filters?: [ filter objects from lib/viz/aggregate.js builders ],
//     title?: "" }

import { createSheet, setCells, loadCsv } from "../sheet/model.js";
import { parseCsv, inferFields, makeField, createCalculatedField, FieldType } from "../viz/fields.js";
import { createSpec, createEncoding, putOnShelf } from "../viz/spec.js";

/**
 * Find the checkpoint that seeds `stepIndex`: the step's own, or the nearest
 * earlier one. When the found index is smaller than the requested one, the
 * user must redo the steps in between — the UI should say so.
 * @param {object} lesson a GuidedLesson
 * @param {number} stepIndex
 * @returns {{checkpoint: object, stepIndex: number}|null}
 */
export function checkpointForStep(lesson, stepIndex) {
  for (let i = Math.min(stepIndex, lesson.steps.length - 1); i >= 0; i--) {
    if (lesson.steps[i].checkpoint) {
      return { checkpoint: lesson.steps[i].checkpoint, stepIndex: i };
    }
  }
  return null;
}

function getResource(resources, key) {
  const text = resources?.[key];
  if (typeof text !== "string") {
    throw new Error(`materializeCheckpoint: missing resource "${key}" — pass its text in the resources map`);
  }
  return text;
}

function materializeSheet(cp, resources) {
  const sheets = {};
  for (const def of cp.sheets ?? []) {
    const sheet = createSheet(def.name);
    for (const load of def.load ?? []) {
      loadCsv(sheet, getResource(resources, load.resource), { origin: load.origin ?? "A1" });
    }
    if (def.cells && Object.keys(def.cells).length > 0) setCells(sheet, def.cells);
    sheets[def.name] = sheet;
  }
  const names = Object.keys(sheets);
  return {
    tool: "sheet",
    active: cp.active ?? names[0] ?? null,
    sheets,
    pivot: cp.pivot ? JSON.parse(JSON.stringify(cp.pivot)) : null,
  };
}

function materializeViz(cp, resources) {
  const rows = cp.data?.rows
    ? JSON.parse(JSON.stringify(cp.data.rows))
    : parseCsv(getResource(resources, cp.data?.resource));

  const calcs = (cp.calculatedFields ?? []).map((f) =>
    createCalculatedField(f.name, f.expression, { type: f.type, role: f.role })
  );
  const inferred = inferFields(rows);
  const fieldFor = (entry) =>
    calcs.find((c) => c.name === entry.field) ??
    inferred.find((f) => f.name === entry.field) ??
    makeField(entry.field, entry.type ?? FieldType.STRING);

  let spec = createSpec({ title: cp.title ?? "", mark: cp.mark ?? null, calculatedFields: calcs });
  for (const [shelf, raw] of Object.entries(cp.shelves ?? {})) {
    const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const item of entries) {
      const entry = typeof item === "string" ? { field: item } : item;
      const options = {};
      if ("aggregation" in entry) options.aggregation = entry.aggregation;
      if ("discrete" in entry) options.discrete = entry.discrete;
      spec = putOnShelf(spec, shelf, createEncoding(fieldFor(entry), options));
    }
  }
  if (cp.filters?.length) {
    spec = { ...spec, filters: [...spec.filters, ...JSON.parse(JSON.stringify(cp.filters))] };
  }
  return { tool: "viz", spec, rows };
}

/**
 * Build a live tool state from a CheckpointSpec.
 * @param {object} checkpoint a CheckpointSpec (see module header)
 * @param {Object<string, string>} [resources] resource key -> file text
 * @returns {object} a tool state matching the graders.js contracts
 */
export function materializeCheckpoint(checkpoint, resources = {}) {
  if (!checkpoint || typeof checkpoint !== "object") {
    throw new Error("materializeCheckpoint: checkpoint is required");
  }
  if (checkpoint.tool === "sheet") return materializeSheet(checkpoint, resources);
  if (checkpoint.tool === "viz") return materializeViz(checkpoint, resources);
  throw new Error(`materializeCheckpoint: unknown tool "${checkpoint.tool}"`);
}

/**
 * The materialized tool state for entering `stepIndex` — the step's own
 * checkpoint or the nearest earlier one.
 * @param {object} lesson
 * @param {number} stepIndex
 * @param {Object<string, string>} [resources]
 * @returns {{toolState: object, resumedFrom: number}} resumedFrom < stepIndex
 *   means intervening steps must be redone
 */
export function startingState(lesson, stepIndex, resources = {}) {
  const found = checkpointForStep(lesson, stepIndex);
  if (!found) {
    throw new Error(`startingState: lesson "${lesson.id}" has no checkpoint at or before step ${stepIndex}`);
  }
  return {
    toolState: materializeCheckpoint(found.checkpoint, resources),
    resumedFrom: found.stepIndex,
  };
}
