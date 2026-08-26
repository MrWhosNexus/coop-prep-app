// Guided lesson: INDEX/MATCH — the classic alternative to XLOOKUP.
//
// Same enrichment task as the excel-xlookup exemplar (pull each applicant's
// census region from the ZIP → region table linked into J2:K23), solved the
// pre-XLOOKUP way, because interviews and older workbooks still expect it:
//   =INDEX(return_range, MATCH(lookup_value, lookup_array, 0))
// The two-step build teaches WHY it works: MATCH finds a position, INDEX
// turns a position back into a value.
//
// Ground truth (verified against the engine over the seeded table):
//   D2 = 48217 (Detroit) → MATCH position 7 → region "Midwest"
//   D3 = 79901 (El Paso) → "South";  D101 = 90011 (Los Angeles) → "West"
//
// Grading doctrine: cellFormula (METHOD) throughout — the lesson exists to
// see INDEX and MATCH in the cell, so an XLOOKUP or a hand-typed region
// fails even when the value is right. The fill-down step grades ALL 100 rows
// with a predicate (method + outcome per row, derived from the sheet's own
// table, like excel-xlookup's) — two one-off formulas in the spot-check
// cells must not count as a fill.

import { createLesson } from "../spec.js";
import { resolveSheet } from "../graders.js";
import { getCell, getRangeValues, isError } from "../../sheet/model.js";
import { REGIONS } from "./excel-xlookup.js";

const HMDA = "hmda-sample.csv";
const TABLE_LAST_ROW = REGIONS.length + 1; // header + 22 zips = rows 2..23

/** The ZIP → region table linked into J:K of the Applicants tab. */
function linkedTableCells() {
  const cells = { J1: "zip_code", K1: "region" };
  REGIONS.forEach(([zip, region], i) => {
    cells[`J${i + 2}`] = zip;
    cells[`K${i + 2}`] = region;
  });
  return cells;
}

function checkpoint(extraCells = {}) {
  return {
    tool: "sheet",
    active: "Applicants",
    sheets: [
      {
        name: "Applicants",
        load: [{ resource: HMDA, origin: "A1" }],
        cells: { H1: "region", ...linkedTableCells(), ...extraCells },
      },
    ],
  };
}

const MATCH_ONLY = `=MATCH(D2, $J$2:$J$${TABLE_LAST_ROW}, 0)`;
const INDEX_MATCH = `=INDEX($K$2:$K$${TABLE_LAST_ROW}, MATCH(D2, $J$2:$J$${TABLE_LAST_ROW}, 0))`;

const uses = (input, name) => new RegExp(`(^|[^A-Z0-9_.])${name}\\s*\\(`, "i").test(input);

/**
 * METHOD + OUTCOME grader for the fill-down step, over EVERY row it claims to
 * cover (spec.js doctrine): each cell in H2:H101 must be an INDEX/MATCH
 * formula whose value matches the region the sheet's own J:K table gives for
 * that row's ZIP — so two one-off formulas in the spot-check cells, typed
 * regions, or an unpinned fill (which breaks with #N/A part-way down) all
 * fail with feedback naming the first offending cells.
 * @param {object} toolState the sheet workbook being graded
 * @returns {object} a partial GradeResult
 */
function indexMatchFillCheck(toolState) {
  const sheet = resolveSheet(toolState, "Applicants");
  const table = getRangeValues(sheet, `J2:K${TABLE_LAST_ROW}`);
  const regionOf = new Map(table.map(([zip, region]) => [String(zip), region]));
  const zips = getRangeValues(sheet, "D2:D101");

  let ok = 0;
  let sawError = false;
  const diff = [];
  const report = (entry) => {
    if (diff.length < 5) diff.push(entry);
  };

  for (let i = 0; i < 100; i++) {
    const ref = `H${i + 2}`;
    const zip = String(zips[i][0]);
    const expected = regionOf.get(zip) ?? null;
    const cell = getCell(sheet, ref);

    if (!cell) {
      report({ kind: "missing", path: ref, expected, actual: null, hint: `${ref} is empty — fill H2's formula down through H101.` });
      continue;
    }
    const input = String(cell.input);
    if (!cell.isFormula) {
      report({ kind: "method", path: ref, expected: "an INDEX/MATCH formula", actual: input, hint: `${ref} holds a typed value — every row must compute its region with INDEX and MATCH.` });
      continue;
    }
    if (!uses(input, "INDEX") || !uses(input, "MATCH")) {
      report({ kind: "method", path: ref, expected: "an INDEX/MATCH formula", actual: input, hint: `${ref} must use INDEX and MATCH — that's the method this lesson teaches.` });
      continue;
    }
    const value = cell.value;
    if (typeof value === "string" && value === expected) {
      ok++;
      continue;
    }
    if (isError(value)) sawError = true;
    const shown = isError(value) ? value.code : JSON.stringify(value ?? null);
    report({ kind: "wrong", path: ref, expected, actual: value, hint: `${ref} looks up ZIP ${zip} — the table says ${expected}, but the cell shows ${shown}.` });
  }

  const pass = ok === 100;
  let message = pass
    ? "All 100 rows compute their region with INDEX/MATCH."
    : `${100 - ok} of 100 rows in column H aren't right yet — ${diff[0].hint}`;
  if (!pass && sawError) {
    message +=
      " #N/A part-way down means the table ranges slid with the fill — pin them with $" +
      ` ($J$2:$J$${TABLE_LAST_ROW} and $K$2:$K$${TABLE_LAST_ROW}) and fill down again.`;
  }
  return {
    pass,
    score: ok / 100,
    message,
    diff,
    expected: "H2:H101 computed with INDEX/MATCH from the linked table",
    actual: `${ok}/100 rows correct`,
  };
}

export const lesson = createLesson({
  id: "excel-index-match",
  tool: "sheet",
  moduleId: "excel",
  mode: "guided",
  voice: true,
  title: "INDEX/MATCH: the classic lookup, built from its two halves",
  description:
    "Before XLOOKUP there was INDEX/MATCH — and it still runs every older workbook you'll inherit. " +
    "You'll rebuild the region lookup with it: MATCH finds WHERE a ZIP sits in the table, INDEX " +
    "returns WHAT sits at that position in the region column. Two functions, one idea each.",
  resources: [HMDA],
  steps: [
    {
      id: "match-position",
      title: "MATCH: from value to position",
      instruction:
        `The ZIP → region table sits in J2:K${TABLE_LAST_ROW}. In H2, write ` +
        `=MATCH(D2, $J$2:$J$${TABLE_LAST_ROW}, 0). It returns 7 — not a region, a POSITION: D2's ZIP ` +
        "(48217, Detroit) is the 7th entry in the ZIP column. The 0 demands an exact match; always " +
        "pass it.",
      hints: [
        "MATCH answers one question only: \"which slot holds this value?\"",
        `Three arguments: the value (D2), the column to scan ($J$2:$J$${TABLE_LAST_ROW}), and 0 for exact match.`,
        "Pin the scan range with $ now — you'll fill this formula down later.",
        `=MATCH(D2, $J$2:$J$${TABLE_LAST_ROW}, 0) — H2 shows 7, because 48217 is 7th in the table.`,
      ],
      target: { kind: "sheet-cell", ref: "H2" },
      spotlightLabel: "Write a MATCH formula in H2",
      checkpoint: checkpoint(),
      grader: {
        type: "cellFormula",
        ref: "H2",
        mustUse: ["MATCH"],
        mustNotUse: ["XLOOKUP", "VLOOKUP"],
        expectedValue: 7,
      },
    },
    {
      id: "index-wrap",
      title: "INDEX: from position to value",
      instruction:
        `A position is only useful if you cash it in. Rewrite H2 as ` +
        `=INDEX($K$2:$K$${TABLE_LAST_ROW}, MATCH(D2, $J$2:$J$${TABLE_LAST_ROW}, 0)) — INDEX takes the ` +
        "region column and the position MATCH found, and returns the 7th region: Midwest.",
      hints: [
        "INDEX(range, n) returns the n-th cell of the range — and n is exactly what MATCH gives you.",
        `The return range is the REGION column $K$2:$K$${TABLE_LAST_ROW}; the MATCH stays as it was.`,
        "Wrap, don't replace: your MATCH becomes INDEX's second argument.",
        `=INDEX($K$2:$K$${TABLE_LAST_ROW}, MATCH(D2, $J$2:$J$${TABLE_LAST_ROW}, 0)) — H2 shows Midwest.`,
      ],
      target: { kind: "sheet-cell", ref: "H2" },
      spotlightLabel: "Wrap H2's MATCH inside INDEX",
      checkpoint: checkpoint({ H2: MATCH_ONLY }),
      grader: {
        type: "cellFormula",
        ref: "H2",
        mustUse: ["INDEX", "MATCH"],
        mustNotUse: ["XLOOKUP", "VLOOKUP"],
        expectedValue: "Midwest",
      },
    },
    {
      id: "fill-down",
      title: "Fill it down the file",
      instruction:
        "Fill H2 down through H101. The $-pinned table ranges hold still while D2 slides to D3, D4, … " +
        "Spot-check the ends: H3 (ZIP 79901, El Paso) should say South, H101 (ZIP 90011, Los Angeles) " +
        "should say West.",
      hints: [
        "Copy H2 and paste over H3:H101 — relative refs shift, $-pinned ones don't.",
        "If a region comes back #N/A part-way down, a table range slid with the fill — re-check the $s.",
        `Both table ranges need pinning: $J$2:$J$${TABLE_LAST_ROW} and $K$2:$K$${TABLE_LAST_ROW}.`,
        "After the fill, H3 reads South and H101 reads West, and every H cell still contains INDEX and MATCH.",
      ],
      target: { kind: "sheet-cell", ref: "H2" },
      spotlightLabel: "Fill H2's INDEX/MATCH down through H101",
      checkpoint: checkpoint({ H2: INDEX_MATCH }),
      grader: {
        type: "allOf",
        of: [
          { type: "predicate", fn: indexMatchFillCheck, label: "Column H computed with INDEX/MATCH for all 100 rows" },
          { type: "cellFormula", ref: "H101", mustUse: ["INDEX", "MATCH"], mustNotUse: ["XLOOKUP", "VLOOKUP"], expectedValue: "West" },
        ],
      },
    },
  ],
});

export default lesson;
