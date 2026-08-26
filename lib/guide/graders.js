// The grader library. Graders are PURE functions over tool state:
//   (toolState, descriptor) -> GradeResult
// No DOM, no React, no IO — they run identically in the renderer and under
// `node --test`.
//
// ---------------------------------------------------------------------------
// GradeResult — designed so feedback can TEACH, not just judge
// ---------------------------------------------------------------------------
// {
//   pass:     boolean
//   score:    0..1        partial credit (1 when pass)
//   message:  string      ONE teaching sentence, ready for the UI. On failure
//                         it is the most useful diff hint, so a minimal UI can
//                         show message alone and still teach.
//   expected: plain JSON  snapshot of what was wanted
//   actual:   plain JSON  snapshot of what was found
//   diff:     [DiffEntry] every structured difference, most useful first
// }
//
// DiffEntry = {
//   kind:     "missing"   the user hasn't done this part yet
//           | "extra"     the user did something the task didn't ask for
//           | "wrong"     right place, wrong content (value, agg, showAs, ...)
//           | "misplaced" right content, wrong place (shelf/rows-vs-cols)
//           | "method"    the answer may be right but the METHOD isn't (typed
//                         a value where a formula was required, skipped XLOOKUP)
//   path:     string      where — a cell ("H2"), a shelf ("rows"), a pivot
//                         address ("Black × APPROVED"), a spec path
//                         ("values.applicant_id.showAs")
//   expected: plain JSON
//   actual:   plain JSON
//   hint:     string      a UI-ready teaching sentence for THIS difference,
//                         e.g. "You put COUNT of applicant_id on Rows; the
//                         task asked for it on Columns."
// }
//
// Every value in a GradeResult is JSON-safe (FormulaError -> its code string,
// Date -> ISO string), so runner sessions persist through lib/store untouched.
//
// ---------------------------------------------------------------------------
// Tool-state contracts (what the UI hands to grade())
// ---------------------------------------------------------------------------
// sheet tool — either a bare sheet from lib/sheet/model.js, or a workbook:
//   { tool: "sheet",
//     active: "Applicants",                  name of the active tab
//     sheets: { Applicants: <sheet>, ... },  one lib/sheet sheet per tab
//     pivot: null | {                        the pivot-builder panel, if open
//       sourceRange: "A1:G101",
//       spec: { rows, cols, values, filters }   a lib/sheet/pivot.js spec
//     } }
// Sheet-grader descriptors take an optional `sheet` name; it defaults to the
// active tab (or the bare sheet itself).
//
// viz tool:
//   { tool: "viz", spec: <VizSpec from lib/viz/spec.js>, rows: [raw rows] }
//
// ---------------------------------------------------------------------------
// Descriptor reference (also see spec.js for METHOD-vs-OUTCOME doctrine)
// ---------------------------------------------------------------------------
// { type: "cellValue", ref, sheet?, expected, tolerance?, caseSensitive? }
//   OUTCOME. getValue(ref) equals expected. Numbers compare with tolerance
//   (default 1e-9, scaled by magnitude); strings trim and compare
//   case-insensitively unless caseSensitive; expected may be an Excel error
//   code string ("#N/A") to REQUIRE that error.
//
// { type: "cellFormula", ref, sheet?, mustUse?, mustNotUse?, pattern?,
//   expectedValue?, tolerance? }
//   METHOD. The cell must CONTAIN A FORMULA; mustUse/mustNotUse are function
//   names ("XLOOKUP"), pattern is a case-insensitive regex source matched
//   against the raw input, expectedValue additionally checks the computed
//   value (so one descriptor covers "used XLOOKUP AND got the right answer").
//
// { type: "rangeValues", range, sheet?, expected, tolerance?, caseSensitive?,
//   maxDiffs? }
//   OUTCOME. A 2D region matches `expected` cell-for-cell. Diff entries carry
//   real A1 addresses; at most maxDiffs (default 5) are reported.
//
// { type: "pivotSpec", expected: {rows?, cols?, values?, filters?}, sheet? }
//   METHOD. The user's pivot spec (toolState.pivot.spec) is EQUIVALENT to
//   expected. Equivalence, documented and deliberate:
//     - rows and cols are ORDER-SENSITIVE (nesting order changes the table);
//     - values are ORDER-INSENSITIVE (side-by-side value columns can appear
//       in any order in Excel) and match on (field, agg, showAs); labels are
//       cosmetic and ignored; agg defaults to "count"; a value's field may be
//       "*" to accept any field (count of anything counts the same rows);
//     - filters match as field -> value-set, case-insensitively;
//     - anything extra on rows/cols/values/filters is flagged, because it
//       changes the table the user would hand in.
//
// { type: "pivotResult", expected: <pivot spec>, sheet?, source?, tolerance? }
//   OUTCOME. Computes the user's pivot AND the expected spec over the same
//   source range, then compares the resulting TABLES (row keys, column keys,
//   cell values). Any user spec that produces the same numbers passes —
//   counting `race` instead of `applicant_id` is fine here. Detects a
//   transposed table and says so.
//
// { type: "vizSpec", expected: {rows?, columns?, color?, size?, label?,
//   detail?, tooltip?, mark?, filters?}, strict? }
//   METHOD. Shelf entries are field names or {field, aggregation?, discrete?}.
//   Only the shelves named in `expected` are checked (so "race on Columns"
//   can be asserted without caring about Color); aggregation compares only
//   when specified, `aggregation: null` REQUIRES an unaggregated pill.
//   strict additionally flags extra pills on the checked shelves.
//   `mark` compares against resolveMark(), so "Automatic" that resolves to a
//   bar counts as a bar.
//
// { type: "vizData", expected: [rowObjects], keyFields?, tolerance?,
//   allowExtra? }
//   OUTCOME. Builds the render plan and compares its aggregated data rows to
//   `expected`. keyFields (default: expected columns without "(") identify a
//   group; other columns are measures, matched by pill caption like
//   "AVG(is_approved)". If the exact caption is absent but the user's row has
//   exactly ONE aggregated column, that column is compared instead — the
//   outcome matters, not the label. Extra groups fail unless allowExtra.
//
// { type: "predicate", fn, label? }
//   ESCAPE HATCH. fn(toolState) returns a boolean or a partial GradeResult
//   ({pass, score?, message?, diff?, actual?, expected?}); it is normalized
//   into a full result. Use it when no declarative grader fits.
//
// { type: "allOf", of: [descriptors] }   every child must pass; score is the
//                                        mean of child scores (partial credit)
// { type: "anyOf", of: [descriptors] }   any child passing passes; score is
//                                        the best child's score

import { getCell, getValue, getRangeValues, isError } from "../sheet/model.js";
import { parseRange, cellKey } from "../sheet/cells.js";
import { pivotFromGrid } from "../sheet/pivot.js";
import { allEncodings, resolveMark } from "../viz/spec.js";
import { buildRenderPlan } from "../viz/render-plan.js";

/** Default numeric tolerance, scaled by the expected value's magnitude. */
export const FLOAT_TOLERANCE = 1e-9;

const ERROR_CODE_RE = /^#(DIV\/0!|N\/A|NAME\?|NULL!|NUM!|REF!|VALUE!|CIRCULAR!)$/;

const ERROR_NOTES = {
  "#N/A": "a lookup found no match",
  "#DIV/0!": "a division by zero",
  "#REF!": "a reference to cells that don't exist",
  "#VALUE!": "an argument of the wrong type",
  "#NAME?": "an unknown function or name",
  "#NUM!": "an invalid number",
  "#CIRCULAR!": "a formula that refers back to itself",
};

const SHOWAS_LABELS = {
  percentOfColumnTotal: "% of Column Total",
  percentOfRowTotal: "% of Row Total",
  percentOfGrandTotal: "% of Grand Total",
};

const SHELF_LABELS = {
  rows: "Rows",
  columns: "Columns",
  color: "Color",
  size: "Size",
  label: "Label",
  detail: "Detail",
  tooltip: "Tooltip",
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the sheet a grader should look at: a bare sheet passes through; a
 * workbook resolves `sheetName` (default: the active tab, then the first tab).
 * Exported for lesson predicates.
 * @param {object} toolState
 * @param {string} [sheetName]
 * @returns {object} a lib/sheet sheet
 */
export function resolveSheet(toolState, sheetName) {
  if (!toolState) throw new Error("resolveSheet: toolState is required");
  if (toolState.cells instanceof Map) return toolState;
  const sheets = toolState.sheets;
  if (!sheets) throw new Error("resolveSheet: toolState is neither a sheet nor a workbook");
  const name = sheetName ?? toolState.active ?? Object.keys(sheets)[0];
  const sheet = sheets[name];
  if (!sheet) throw new Error(`resolveSheet: workbook has no sheet named "${name}"`);
  return sheet;
}

/**
 * Convert any grader-visible value into plain JSON: FormulaError -> its code,
 * Date -> ISO string, RangeValue -> its 2D values, NaN/Infinity -> null.
 * @param {*} v
 * @returns {*} JSON-safe value
 */
export function toPlain(v) {
  if (v === undefined || v === null) return null;
  if (isError(v)) return v.code;
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(toPlain);
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "function") return null;
  if (typeof v === "object") {
    if (Array.isArray(v.values) && typeof v.rows === "number") return toPlain(v.values); // RangeValue
    const out = {};
    for (const [key, val] of Object.entries(v)) {
      if (typeof val === "function") continue;
      out[key] = toPlain(val);
    }
    return out;
  }
  return v;
}

function isBlankCell(v) {
  return v === undefined || v === null || v === "";
}

function valuesMatch(actual, expected, opts = {}) {
  if (typeof expected === "string" && ERROR_CODE_RE.test(expected)) {
    const code = isError(actual) ? actual.code : typeof actual === "string" ? actual : null;
    return code === expected;
  }
  if (isError(actual)) return false;
  if (typeof expected === "number") {
    if (typeof actual !== "number") return false;
    const tol = opts.tolerance ?? FLOAT_TOLERANCE;
    return Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected));
  }
  if (typeof expected === "string") {
    if (typeof actual !== "string") return false;
    const a = actual.trim();
    const e = expected.trim();
    return opts.caseSensitive ? a === e : a.toLowerCase() === e.toLowerCase();
  }
  if (isBlankCell(expected)) return isBlankCell(actual);
  return actual === expected;
}

function fmt(v) {
  if (isBlankCell(v)) return "(blank)";
  if (isError(v)) return v.code;
  if (typeof v === "number") return String(Number(v.toPrecision(10)));
  if (typeof v === "string") return `"${v}"`;
  return String(v);
}

function diffEntry({ kind = "wrong", path = "", expected = null, actual = null, hint = "" }) {
  return { kind, path, expected: toPlain(expected), actual: toPlain(actual), hint };
}

/** A checks accumulator: score = passed / total, diff = failures' entries. */
function makeChecks() {
  const checks = [];
  return {
    add(pass, entry) {
      checks.push({ pass, entry: pass ? null : entry });
    },
    result(extra = {}) {
      const total = checks.length || 1;
      const passed = checks.filter((c) => c.pass).length;
      const diff = checks.filter((c) => !c.pass && c.entry).map((c) => diffEntry(c.entry));
      return {
        pass: passed === checks.length && checks.length > 0,
        score: passed / total,
        diff,
        ...extra,
      };
    },
  };
}

function failNow({ message, kind = "missing", path = "", expected = null, actual = null, score = 0 }) {
  return {
    pass: false,
    score,
    message,
    expected,
    actual,
    diff: [diffEntry({ kind, path, expected, actual, hint: message })],
  };
}

function finalize(res) {
  const pass = res.pass === true;
  let score = typeof res.score === "number" && Number.isFinite(res.score) ? res.score : pass ? 1 : 0;
  score = Math.max(0, Math.min(1, score));
  if (pass) score = 1;
  const diff = (res.diff ?? []).map((d) => diffEntry(d));
  const message = res.message ?? (pass ? "Correct." : diff[0]?.hint || "Not quite — try again.");
  return {
    pass,
    score,
    message,
    expected: toPlain(res.expected ?? null),
    actual: toPlain(res.actual ?? null),
    diff,
  };
}

// ---------------------------------------------------------------------------
// Sheet graders
// ---------------------------------------------------------------------------

function gradeCellValue(toolState, d) {
  const sheet = resolveSheet(toolState, d.sheet);
  const actual = getValue(sheet, d.ref);
  const where = d.sheet ? `${d.sheet}!${d.ref}` : d.ref;
  if (valuesMatch(actual, d.expected, d)) {
    return { pass: true, actual, expected: d.expected, message: `${where} shows ${fmt(actual)} — correct.`, diff: [] };
  }
  let hint;
  if (isBlankCell(actual)) {
    hint = `${where} is empty — it should show ${fmt(d.expected)}.`;
  } else if (isError(actual)) {
    const note = ERROR_NOTES[actual.code] ? ` (${ERROR_NOTES[actual.code]})` : "";
    hint = `${where} shows the Excel error ${actual.code}${note} — expected ${fmt(d.expected)}.`;
  } else {
    hint = `${where} shows ${fmt(actual)}; expected ${fmt(d.expected)}.`;
  }
  return {
    pass: false,
    score: 0,
    actual,
    expected: d.expected,
    message: hint,
    diff: [diffEntry({ kind: isBlankCell(actual) ? "missing" : "wrong", path: where, expected: d.expected, actual, hint })],
  };
}

function functionUsed(input, name) {
  return new RegExp(`(^|[^A-Z0-9_.])${name}\\s*\\(`, "i").test(input);
}

/**
 * Does the formula reference the sheet at all — any cell or range?
 *
 * `mustUse` checks a function NAME appears; it cannot tell whether that function
 * touched the data. So `=AVERAGE(0.76)` satisfied `mustUse: ["AVERAGE"]` with
 * `expectedValue: 0.76` — the learner hardcodes the answer INSIDE the call and
 * the step teaching "average the flag column" passes. Verified against the real
 * engine on stats-probability, and the pre-existing excel-stats has the same
 * shape (`mustUse: ["AVERAGE"], expectedValue: 71475` -> `=AVERAGE(71475)`).
 *
 * This is the sentinel hole one level deeper: those graders checked too few
 * CELLS, this one checks too little of the FORMULA.
 *
 * The rule: a formula whose method is being graded, that references no cells at
 * all, is hardcoding by definition — there is nothing for the named function to
 * have been applied to. Guarding at this level closes it for every lesson at
 * once rather than asking 19 lesson authors to remember a `pattern`.
 *
 * Deliberately permissive about SHAPE (A1, $A$1, A1:B9, Sheet!A1, whole columns)
 * — it asks "did you touch the data", not "did you touch the RIGHT data". Pin
 * the exact range with `pattern` where that matters.
 *
 * @param {string} input raw formula text
 * @returns {boolean}
 */
function referencesSheet(input) {
  // Strip string literals first: ="B2" is prose about a cell, not a reference.
  const code = String(input).replace(/"(?:[^"\\]|\\.)*"/g, '""');
  return /(^|[^A-Z0-9_$])\$?[A-Z]{1,3}\$?\d{1,7}(\s*:\s*\$?[A-Z]{1,3}\$?\d{1,7})?/i.test(code) ||
    /(^|[^A-Z0-9_$])\$?[A-Z]{1,3}\s*:\s*\$?[A-Z]{1,3}(\D|$)/i.test(code);
}

function gradeCellFormula(toolState, d) {
  const sheet = resolveSheet(toolState, d.sheet);
  const cell = getCell(sheet, d.ref);
  const where = d.sheet ? `${d.sheet}!${d.ref}` : d.ref;

  if (!cell) {
    return failNow({ message: `${where} is empty — enter a formula there.`, kind: "missing", path: where });
  }
  const input = String(cell.input);
  if (!cell.isFormula) {
    const rightAnswer = d.expectedValue !== undefined && valuesMatch(cell.value, d.expectedValue, d);
    const hint = rightAnswer
      ? `${where} has the right value, but it's typed in by hand — the lesson needs a formula that computes it.`
      : `${where} contains a plain value, not a formula — start with =.`;
    return failNow({ message: hint, kind: "method", path: where, expected: "a formula", actual: input });
  }

  // Grading the METHOD means the formula must act on the data. `mustUse` alone
  // only proves the NAME is present, so =AVERAGE(0.76) passed a step about
  // averaging a column. Opt out with `allowLiteral: true` for the rare step that
  // legitimately computes from constants alone.
  //
  // A GATE, not a scored check — the same shape as the isFormula guard above.
  // "Did you read the data" is a precondition of having used a method at all,
  // not an independent dimension to earn partial credit on: adding it to
  // `checks` silently moved the value-right/method-wrong score from 1/2 to 2/3
  // and broke guide.test.js's partial-credit contract. The test was right.
  if ((d.mustUse?.length || d.pattern) && !d.allowLiteral && !referencesSheet(input)) {
    return failNow({
      message: `${where} computes its answer from constants — it never reads the sheet.`,
      kind: "method",
      path: where,
      expected: "a formula that reads the data",
      actual: input,
      hint: `${where} computes its answer from constants — it never reads the sheet. Point the formula at the cells it should be summarising.`,
    });
  }

  const checks = makeChecks();
  for (const name of d.mustUse ?? []) {
    checks.add(functionUsed(input, name), {
      kind: "method",
      path: where,
      expected: `uses ${name}()`,
      actual: input,
      hint: `The formula in ${where} must use ${name} — right now it doesn't.`,
    });
  }
  for (const name of d.mustNotUse ?? []) {
    checks.add(!functionUsed(input, name), {
      kind: "method",
      path: where,
      expected: `does not use ${name}()`,
      actual: input,
      hint: `${where} uses ${name}; this lesson asks you to solve it without ${name}.`,
    });
  }
  if (d.pattern) {
    checks.add(new RegExp(d.pattern, "i").test(input), {
      kind: "method",
      path: where,
      expected: `matches /${d.pattern}/i`,
      actual: input,
      hint: `The formula in ${where} doesn't have the expected shape yet.`,
    });
  }
  if (d.expectedValue !== undefined) {
    const ok = valuesMatch(cell.value, d.expectedValue, d);
    const hint = isError(cell.value)
      ? `${where}'s formula returns ${cell.value.code}${ERROR_NOTES[cell.value.code] ? ` (${ERROR_NOTES[cell.value.code]})` : ""} — check its references.`
      : `${where}'s formula returns ${fmt(cell.value)}; expected ${fmt(d.expectedValue)}.`;
    checks.add(ok, { kind: "wrong", path: where, expected: d.expectedValue, actual: cell.value, hint });
  }
  // A bare {requireFormula} descriptor still asserts "it is a formula".
  if ((d.mustUse ?? []).length === 0 && (d.mustNotUse ?? []).length === 0 && !d.pattern && d.expectedValue === undefined) {
    checks.add(true, null);
  }

  const res = checks.result({ actual: input, expected: describeFormulaExpectation(d) });
  res.message = res.pass ? `${where} looks right.` : res.diff[0]?.hint ?? "Not quite — try again.";
  return res;
}

function describeFormulaExpectation(d) {
  const parts = [];
  if (d.mustUse?.length) parts.push(`uses ${d.mustUse.join(", ")}`);
  if (d.mustNotUse?.length) parts.push(`avoids ${d.mustNotUse.join(", ")}`);
  if (d.pattern) parts.push(`matches /${d.pattern}/i`);
  if (d.expectedValue !== undefined) parts.push(`computes ${fmt(d.expectedValue)}`);
  return `a formula that ${parts.join(" and ") || "exists"}`;
}

function gradeRangeValues(toolState, d) {
  const sheet = resolveSheet(toolState, d.sheet);
  const range = parseRange(d.range);
  if (!range || range.top === null) throw new Error(`rangeValues: invalid range "${d.range}"`);
  const actual = getRangeValues(sheet, d.range);
  const maxDiffs = d.maxDiffs ?? 5;

  let total = 0;
  let ok = 0;
  const diff = [];
  for (let r = 0; r < d.expected.length; r++) {
    for (let c = 0; c < d.expected[r].length; c++) {
      total++;
      const e = d.expected[r][c];
      const a = actual[r]?.[c];
      if (valuesMatch(a, e, d)) {
        ok++;
      } else if (diff.length < maxDiffs) {
        const addr = cellKey(range.top + r, range.left + c);
        diff.push(diffEntry({
          kind: isBlankCell(a) ? "missing" : "wrong",
          path: addr,
          expected: e,
          actual: a,
          hint: `${addr} shows ${fmt(a)}; expected ${fmt(e)}.`,
        }));
      }
    }
  }
  const pass = ok === total;
  return {
    pass,
    score: total ? ok / total : 0,
    message: pass
      ? `${d.range} matches.`
      : `${total - ok} of ${total} cells in ${d.range} are off — e.g. ${diff[0].hint}`,
    expected: d.expected,
    actual,
    diff,
  };
}

// ---------------------------------------------------------------------------
// Pivot graders
// ---------------------------------------------------------------------------

function normPivotSpec(spec) {
  return {
    rows: (spec.rows ?? []).map(String),
    cols: (spec.cols ?? []).map(String),
    values: (spec.values ?? []).map((v) => ({
      field: v.field,
      agg: v.agg ?? "count",
      showAs: v.showAs ?? null,
    })),
    filters: Object.fromEntries(
      Object.entries(spec.filters ?? {}).map(([field, vals]) => [
        field,
        (Array.isArray(vals) ? vals : [vals]).map((x) => String(x).toLowerCase()).sort(),
      ])
    ),
  };
}

function sameMembers(a, b) {
  return a.length === b.length && [...a].sort().join("") === [...b].sort().join("");
}

const AXIS_LABELS = { rows: "Rows", cols: "Columns" };

function checkPivotAxis(checks, axis, expected, actual, handled) {
  const other = axis === "rows" ? "cols" : "rows";
  for (const field of expected[axis]) {
    if (actual[axis].includes(field)) {
      checks.add(true, null);
    } else if (actual[other].includes(field)) {
      handled.add(`${other}:${field}`);
      checks.add(false, {
        kind: "misplaced",
        path: axis,
        expected: `${field} on ${AXIS_LABELS[axis]}`,
        actual: `${field} on ${AXIS_LABELS[other]}`,
        hint: `You put ${field} on ${AXIS_LABELS[other]}; the task asked for it on ${AXIS_LABELS[axis]}.`,
      });
    } else {
      checks.add(false, {
        kind: "missing",
        path: axis,
        expected: field,
        actual: null,
        hint: `Drag ${field} to ${AXIS_LABELS[axis]}.`,
      });
    }
  }
  for (const field of actual[axis]) {
    if (expected[axis].includes(field) || handled.has(`${axis}:${field}`)) continue;
    if (expected[other].includes(field)) continue; // reported from the other side
    checks.add(false, {
      kind: "extra",
      path: axis,
      expected: null,
      actual: field,
      hint: `Remove ${field} from ${AXIS_LABELS[axis]} — the task doesn't ask for it.`,
    });
  }
  if (
    expected[axis].length > 1 &&
    sameMembers(expected[axis], actual[axis]) &&
    expected[axis].join("") !== actual[axis].join("")
  ) {
    checks.add(false, {
      kind: "wrong",
      path: `${axis}.order`,
      expected: expected[axis].join(" then "),
      actual: actual[axis].join(" then "),
      hint: `${AXIS_LABELS[axis]} are nested in the wrong order — the task wants ${expected[axis].join(" then ")}.`,
    });
  }
}

function aggCaption(v) {
  const name = v.agg.charAt(0).toUpperCase() + v.agg.slice(1);
  return `${name} of ${v.field === "*" ? "any field" : v.field}`;
}

function checkPivotValues(checks, expected, actual) {
  const used = new Set();
  const fieldOk = (ev, av) => ev.field === "*" || ev.field === av.field;

  for (const ev of expected.values) {
    let idx = actual.values.findIndex((av, i) => !used.has(i) && fieldOk(ev, av) && av.agg === ev.agg && av.showAs === ev.showAs);
    if (idx >= 0) {
      used.add(idx);
      checks.add(true, null);
      continue;
    }
    idx = actual.values.findIndex((av, i) => !used.has(i) && fieldOk(ev, av) && av.agg === ev.agg);
    if (idx >= 0) {
      used.add(idx);
      const av = actual.values[idx];
      const hint = ev.showAs
        ? `Your pivot shows raw ${av.agg} values, not ${SHOWAS_LABELS[ev.showAs]} — right-click the value field → Show Values As → ${SHOWAS_LABELS[ev.showAs]}.`
        : `${aggCaption(av)} is shown as ${SHOWAS_LABELS[av.showAs]}; the task wants the raw ${av.agg}. Set Show Values As back to No Calculation.`;
      checks.add(false, {
        kind: "wrong",
        path: `values.${av.field}.showAs`,
        expected: ev.showAs,
        actual: av.showAs,
        hint,
      });
      continue;
    }
    idx = actual.values.findIndex((av, i) => !used.has(i) && fieldOk(ev, av));
    if (idx >= 0) {
      used.add(idx);
      const av = actual.values[idx];
      checks.add(false, {
        kind: "wrong",
        path: `values.${av.field}.agg`,
        expected: ev.agg,
        actual: av.agg,
        hint: `${av.field} is aggregated with ${av.agg}; the task asks for ${ev.agg}. Change the value field's aggregation.`,
      });
      continue;
    }
    checks.add(false, {
      kind: "missing",
      path: "values",
      expected: aggCaption(ev),
      actual: null,
      hint: `Add ${aggCaption(ev)} to Values.`,
    });
  }
  actual.values.forEach((av, i) => {
    if (used.has(i)) return;
    checks.add(false, {
      kind: "extra",
      path: "values",
      expected: null,
      actual: aggCaption(av),
      hint: `Remove ${aggCaption(av)} from Values — the task doesn't ask for it.`,
    });
  });
}

function checkPivotFilters(checks, expected, actual) {
  for (const [field, vals] of Object.entries(expected.filters)) {
    const got = actual.filters[field];
    if (!got) {
      checks.add(false, {
        kind: "missing",
        path: `filters.${field}`,
        expected: vals,
        actual: null,
        hint: `Add a filter on ${field} (keep: ${vals.join(", ")}).`,
      });
    } else if (got.join("") !== vals.join("")) {
      checks.add(false, {
        kind: "wrong",
        path: `filters.${field}`,
        expected: vals,
        actual: got,
        hint: `The ${field} filter keeps ${got.join(", ")}; the task wants ${vals.join(", ")}.`,
      });
    } else {
      checks.add(true, null);
    }
  }
  for (const field of Object.keys(actual.filters)) {
    if (field in expected.filters) continue;
    checks.add(false, {
      kind: "extra",
      path: `filters.${field}`,
      expected: null,
      actual: actual.filters[field],
      hint: `Remove the filter on ${field} — it changes the table the task asks for.`,
    });
  }
}

function gradePivotSpec(toolState, d) {
  const pivot = toolState?.pivot;
  if (!pivot?.spec) {
    return failNow({ message: "No pivot table yet — insert one over the data first.", path: "pivot" });
  }
  const expected = normPivotSpec(d.expected);
  const actual = normPivotSpec(pivot.spec);
  const checks = makeChecks();
  const handled = new Set();

  checkPivotAxis(checks, "rows", expected, actual, handled);
  checkPivotAxis(checks, "cols", expected, actual, handled);
  checkPivotValues(checks, expected, actual);
  checkPivotFilters(checks, expected, actual);

  const res = checks.result({ expected, actual });
  res.message = res.pass ? "The pivot is set up exactly as asked." : res.diff[0]?.hint ?? "Not quite — try again.";
  return res;
}

function keyLabel(tuple) {
  return tuple.length ? tuple.map(String).join(" / ") : "(all)";
}

function gradePivotResult(toolState, d) {
  const sheet = resolveSheet(toolState, d.sheet);
  const pivot = toolState?.pivot;
  if (!pivot?.spec) {
    return failNow({ message: "No pivot table yet — insert one over the data first.", path: "pivot" });
  }
  const source = d.source ?? pivot.sourceRange;
  if (!source) {
    return failNow({ message: "The pivot has no source range — point it at the data.", path: "pivot.sourceRange" });
  }
  const grid = getRangeValues(sheet, source);
  let userRes;
  try {
    userRes = pivotFromGrid(grid, pivot.spec);
  } catch (err) {
    return failNow({ message: `Your pivot can't be computed yet: ${err.message}`, path: "pivot.spec" });
  }
  const refRes = pivotFromGrid(grid, d.expected);

  const uRows = userRes.rowKeys.map(keyLabel);
  const eRows = refRes.rowKeys.map(keyLabel);
  const uCols = userRes.colKeys.map(keyLabel);
  const eCols = refRes.colKeys.map(keyLabel);

  // Transposed table: same information, flipped layout — one clear message.
  if (!sameMembers(uRows, eRows) && sameMembers(uRows, eCols) && sameMembers(uCols, eRows)) {
    const hint = "Your table is transposed — swap the fields on Rows and Columns.";
    return {
      pass: false,
      score: 0.5,
      message: hint,
      expected: { rowKeys: eRows, colKeys: eCols },
      actual: { rowKeys: uRows, colKeys: uCols },
      diff: [diffEntry({ kind: "misplaced", path: "layout", expected: `rows: ${eRows.join(", ")}`, actual: `rows: ${uRows.join(", ")}`, hint })],
    };
  }

  const checks = makeChecks();
  for (const k of eRows) {
    checks.add(uRows.includes(k), {
      kind: "missing",
      path: `row ${k}`,
      expected: k,
      actual: null,
      hint: `Your table has no "${k}" row — check the field on Rows (and any filters).`,
    });
  }
  for (const k of uRows) {
    if (!eRows.includes(k)) {
      checks.add(false, { kind: "extra", path: `row ${k}`, expected: null, actual: k, hint: `Unexpected row "${k}" — check the field on Rows.` });
    }
  }
  for (const k of eCols) {
    checks.add(uCols.includes(k), {
      kind: "missing",
      path: `column ${k}`,
      expected: k,
      actual: null,
      hint: `Your table has no "${k}" column — check the field on Columns.`,
    });
  }
  for (const k of uCols) {
    if (!eCols.includes(k)) {
      checks.add(false, { kind: "extra", path: `column ${k}`, expected: null, actual: k, hint: `Unexpected column "${k}".` });
    }
  }

  const shapeOk = sameMembers(uRows, eRows) && sameMembers(uCols, eCols);
  if (shapeOk) {
    const nExpected = refRes.spec.values.length;
    const nActual = userRes.spec.values.length;
    if (nActual !== nExpected) {
      checks.add(false, {
        kind: "wrong",
        path: "values",
        expected: `${nExpected} value column(s)`,
        actual: `${nActual} value column(s)`,
        hint: `Your pivot computes ${nActual} value column(s); the task needs ${nExpected}.`,
      });
    } else {
      const maxDiffs = d.maxDiffs ?? 6;
      let reported = 0;
      // Pivot key order is deterministic (sorted), so indices line up.
      for (let r = 0; r < refRes.rowKeys.length; r++) {
        for (let c = 0; c < refRes.colKeys.length; c++) {
          for (let vi = 0; vi < nExpected; vi++) {
            const e = refRes.cells[r][c][vi];
            const a = userRes.cells[r][c][vi];
            const ok = e === null || a === null ? e === a : valuesMatch(a, e, d);
            let entry = null;
            if (!ok && reported < maxDiffs) {
              reported++;
              const addr = `${eRows[r]} × ${eCols[c] || "value"}`;
              let hint = `The cell (${addr}) shows ${fmt(a)}; expected ${fmt(e)}.`;
              if (typeof e === "number" && e > 0 && e < 1 && typeof a === "number" && Number.isInteger(a) && a > 1) {
                hint += " That looks like a raw count — did you set Show Values As?";
              }
              entry = { kind: "wrong", path: addr, expected: e, actual: a, hint };
            }
            checks.add(ok, entry); // over the diff cap, the failure still counts against the score

          }
        }
      }
    }
  }

  const res = checks.result({
    expected: { rowKeys: eRows, colKeys: eCols },
    actual: { rowKeys: uRows, colKeys: uCols },
  });
  res.message = res.pass ? "Your pivot table produces exactly the expected numbers." : res.diff[0]?.hint ?? "Not quite — try again.";
  return res;
}

// ---------------------------------------------------------------------------
// Viz graders
// ---------------------------------------------------------------------------

function encodingCaption(enc) {
  return enc.aggregation ? `${enc.aggregation} of ${enc.field}` : enc.field;
}

function normShelfWant(w) {
  return typeof w === "string" ? { field: w } : w;
}

function gradeVizSpec(toolState, d) {
  const spec = toolState?.spec;
  if (!spec) {
    return failNow({ message: "No view yet — drop a field on a shelf to start.", path: "spec" });
  }
  const expected = d.expected;

  // Fail LOUDLY on expected-spec keys the grader does not understand. The
  // loop below iterates SHELF_LABELS, so an unknown key used to be silently
  // skipped — which let a lesson assert { dual: true, synchronized: true }
  // (keys that exist nowhere in the viz engine) and auto-pass the step.
  // An unknown key means the lesson asserts nothing; that is an authoring
  // bug and must blow up at grade time, not quietly return pass.
  const recognizedKeys = new Set([...Object.keys(SHELF_LABELS), "mark", "filters"]);
  const unknownKeys = Object.keys(expected).filter((k) => !recognizedKeys.has(k));
  if (unknownKeys.length > 0) {
    throw new Error(
      `vizSpec grader: unrecognized key(s) in expected spec: ${unknownKeys.join(", ")}. ` +
        `Recognized keys: ${[...recognizedKeys].join(", ")}.`
    );
  }

  const encs = allEncodings(spec);
  const checks = makeChecks();

  for (const shelf of Object.keys(SHELF_LABELS)) {
    if (!(shelf in expected)) continue;
    const wantRaw = expected[shelf];
    const wants = (Array.isArray(wantRaw) ? wantRaw : wantRaw ? [wantRaw] : []).map(normShelfWant);
    const onShelf = encs.filter((e) => e.shelf === shelf).map((e) => e.encoding);

    for (const w of wants) {
      const enc = onShelf.find((e) => e.field === w.field);
      if (!enc) {
        const elsewhere = encs.find((e) => e.encoding.field === w.field);
        if (elsewhere) {
          checks.add(false, {
            kind: "misplaced",
            path: shelf,
            expected: `${w.field} on ${SHELF_LABELS[shelf]}`,
            actual: `${w.field} on ${SHELF_LABELS[elsewhere.shelf]}`,
            hint: `You put ${encodingCaption(elsewhere.encoding)} on ${SHELF_LABELS[elsewhere.shelf]}; the task asked for it on ${SHELF_LABELS[shelf]}.`,
          });
        } else {
          checks.add(false, {
            kind: "missing",
            path: shelf,
            expected: w.field,
            actual: null,
            hint: `Drag ${w.field} to ${SHELF_LABELS[shelf]}.`,
          });
        }
        continue;
      }
      checks.add(true, null); // the pill is where it belongs
      if ("aggregation" in w) {
        const wantAgg = w.aggregation ? String(w.aggregation).toUpperCase() : null;
        const gotAgg = enc.aggregation ? String(enc.aggregation).toUpperCase() : null;
        let hint;
        if (wantAgg === null) {
          hint = `${w.field} on ${SHELF_LABELS[shelf]} shouldn't be aggregated — remove the ${gotAgg} aggregation.`;
        } else if (gotAgg === null) {
          hint = `${w.field} on ${SHELF_LABELS[shelf]} needs to be aggregated as ${wantAgg}.`;
        } else {
          hint = `${w.field} is on ${SHELF_LABELS[shelf]}, but aggregated with ${gotAgg} — the task asks for ${wantAgg}. Change the pill's aggregation.`;
        }
        checks.add(wantAgg === gotAgg, {
          kind: "wrong",
          path: `${shelf}.${w.field}.aggregation`,
          expected: wantAgg,
          actual: gotAgg,
          hint,
        });
      }
      if ("discrete" in w) {
        checks.add(enc.discrete === w.discrete, {
          kind: "wrong",
          path: `${shelf}.${w.field}.discrete`,
          expected: w.discrete,
          actual: enc.discrete,
          hint: `${w.field} should be ${w.discrete ? "discrete (a blue pill)" : "continuous (a green pill)"} on ${SHELF_LABELS[shelf]}.`,
        });
      }
    }

    if (d.strict) {
      for (const enc of onShelf) {
        if (wants.some((w) => w.field === enc.field)) continue;
        checks.add(false, {
          kind: "extra",
          path: shelf,
          expected: null,
          actual: encodingCaption(enc),
          hint: `Remove ${encodingCaption(enc)} from ${SHELF_LABELS[shelf]} — the task doesn't ask for it.`,
        });
      }
    }
  }

  if (expected.mark) {
    const actualMark = resolveMark(spec);
    checks.add(actualMark === expected.mark, {
      kind: "wrong",
      path: "mark",
      expected: expected.mark,
      actual: actualMark,
      hint: `The view uses the ${actualMark} mark; the task asks for ${expected.mark}. Pick ${expected.mark} on the Marks card (or use Show Me).`,
    });
  }

  for (const w of expected.filters ?? []) {
    const hit = (spec.filters ?? []).find((f) => f.field === w.field && (!w.type || f.type === w.type));
    checks.add(Boolean(hit), {
      kind: "missing",
      path: "filters",
      expected: w.field,
      actual: null,
      hint: `Add a filter on ${w.field}.`,
    });
  }

  const res = checks.result({ expected, actual: { shelves: encs.map((e) => ({ shelf: e.shelf, pill: encodingCaption(e.encoding) })), mark: resolveMark(spec) } });
  res.message = res.pass ? "The shelves are set up exactly as asked." : res.diff[0]?.hint ?? "Not quite — try again.";
  return res;
}

function splitCaption(caption) {
  const m = /^([A-Z]+)\((.+)\)$/.exec(caption);
  return m ? { agg: m[1], field: m[2] } : null;
}

function gradeVizData(toolState, d) {
  const spec = toolState?.spec;
  const rows = toolState?.rows;
  if (!spec || !rows) {
    return failNow({ message: "No view yet — the viz needs both a spec and data.", path: "spec" });
  }
  let plan;
  try {
    plan = buildRenderPlan(spec, rows);
  } catch (err) {
    return failNow({ message: `The view can't be built yet: ${err.message}`, path: "spec" });
  }
  const data = plan.data ?? [];
  const keyFields = d.keyFields ?? Object.keys(d.expected[0] ?? {}).filter((k) => !k.includes("("));
  const checks = makeChecks();
  const used = new Set();

  for (const er of d.expected) {
    const groupLabel = keyFields.map((k) => `${k} = ${er[k]}`).join(", ");
    const idx = data.findIndex((ur, i) => !used.has(i) && keyFields.every((k) => String(ur[k]) === String(er[k])));
    if (idx < 0) {
      checks.add(false, {
        kind: "missing",
        path: groupLabel,
        expected: er,
        actual: null,
        hint: `No mark for ${groupLabel} — check the fields on your shelves and any filters.`,
      });
      continue;
    }
    used.add(idx);
    const ur = data[idx];
    checks.add(true, null); // the group exists

    for (const [col, ev] of Object.entries(er)) {
      if (keyFields.includes(col)) continue;
      let actualValue = ur[col];
      let usedCol = col;
      if (actualValue === undefined) {
        const aggCols = Object.keys(ur).filter((k) => k.includes("(") && !k.startsWith("__"));
        if (aggCols.length === 1) {
          usedCol = aggCols[0];
          actualValue = ur[usedCol];
        }
      }
      if (actualValue === undefined) {
        const parsed = splitCaption(col);
        checks.add(false, {
          kind: "missing",
          path: `${groupLabel} → ${col}`,
          expected: ev,
          actual: null,
          hint: parsed
            ? `The view doesn't compute ${col} — put ${parsed.field} on a shelf aggregated as ${parsed.agg}.`
            : `The view doesn't compute ${col}.`,
        });
        continue;
      }
      const ok = valuesMatch(actualValue, ev, d);
      const note = usedCol !== col ? ` (the view computes ${usedCol}, not ${col})` : "";
      checks.add(ok, {
        kind: "wrong",
        path: `${groupLabel} → ${col}`,
        expected: ev,
        actual: actualValue,
        hint: `${groupLabel}: expected ${col} to be ${fmt(ev)}, got ${fmt(actualValue)}${note}.`,
      });
    }
  }

  if (d.allowExtra !== true) {
    data.forEach((ur, i) => {
      if (used.has(i)) return;
      const label = keyFields.map((k) => `${k} = ${ur[k]}`).join(", ") || "(all)";
      checks.add(false, {
        kind: "extra",
        path: label,
        expected: null,
        actual: label,
        hint: `Unexpected group ${label} — check your filters.`,
      });
    });
  }

  const res = checks.result({ expected: d.expected, actual: data.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith("__")))) });
  res.message = res.pass ? "The view computes exactly the expected numbers." : res.diff[0]?.hint ?? "Not quite — try again.";
  return res;
}

// ---------------------------------------------------------------------------
// Predicate + combinators
// ---------------------------------------------------------------------------

function gradePredicate(toolState, d) {
  const raw = d.fn(toolState);
  if (typeof raw === "boolean") {
    const label = d.label ?? "The check";
    return raw
      ? { pass: true, message: `${label} passed.`, diff: [] }
      : failNow({ message: `${label} failed.`, kind: "wrong", path: d.label ?? "predicate" });
  }
  if (!raw || typeof raw !== "object") {
    throw new Error("predicate: fn must return a boolean or a partial GradeResult");
  }
  return raw;
}

function gradeAllOf(toolState, d) {
  const children = d.of.map((child) => grade(toolState, child));
  const pass = children.every((c) => c.pass);
  const score = children.reduce((a, c) => a + c.score, 0) / children.length;
  const firstFail = children.find((c) => !c.pass);
  return {
    pass,
    score,
    message: pass ? "All checks pass." : firstFail.message,
    expected: children.map((c) => c.expected),
    actual: children.map((c) => c.actual),
    diff: children.flatMap((c) => c.diff),
  };
}

function gradeAnyOf(toolState, d) {
  const children = d.of.map((child) => grade(toolState, child));
  const best = children.reduce((a, c) => (c.score > a.score ? c : a), children[0]);
  const pass = children.some((c) => c.pass);
  return {
    pass,
    score: best.score,
    message: pass ? "One accepted route checks out." : best.message,
    expected: children.map((c) => c.expected),
    actual: best.actual,
    diff: pass ? [] : best.diff,
  };
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/** The grader registry: type -> (toolState, descriptor) -> raw result. */
export const GRADERS = {
  cellValue: gradeCellValue,
  cellFormula: gradeCellFormula,
  rangeValues: gradeRangeValues,
  pivotSpec: gradePivotSpec,
  pivotResult: gradePivotResult,
  vizSpec: gradeVizSpec,
  vizData: gradeVizData,
  predicate: gradePredicate,
  allOf: gradeAllOf,
  anyOf: gradeAnyOf,
};

/**
 * Grade a tool state against a grader descriptor.
 * @param {object} toolState see the tool-state contracts in the module header
 * @param {object} descriptor a GraderDescriptor (see module header)
 * @returns {{pass: boolean, score: number, message: string, expected: *, actual: *, diff: Array<object>}}
 */
export function grade(toolState, descriptor) {
  const fn = GRADERS[descriptor?.type];
  if (!fn) throw new Error(`grade: unknown grader type "${descriptor?.type}"`);
  return finalize(fn(toolState, descriptor));
}
