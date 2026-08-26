// EXEMPLAR guided lesson: XLOOKUP across a two-tab workbook.
//
// The curriculum challenge: Tab 1 (Applicants) has applicant IDs and ZIP
// codes from the real HMDA extract; Tab 2 (Regions) maps ZIP code → census
// region. XLOOKUP pulls the region into Tab 1.
//
// Engine note: lib/sheet formulas cannot reference across tabs yet, so the
// workbook keeps the Regions table linked into J1:K23 of the Applicants tab
// (the checkpoints seed it there) and the lesson text presents it that way.
// The two-tab structure is real — step 1 is graded ON the Regions tab.
//
// Grading doctrine on display here:
//   - cellFormula (METHOD): the lesson teaches XLOOKUP, so XLOOKUP must
//     appear in the cell — a hand-typed "Midwest" or a VLOOKUP fails even
//     when the value is right;
//   - predicate (OUTCOME, the escape hatch): the fill-down step derives the
//     expected 100 regions from the sheet itself, so the check needs no
//     hard-coded copy of the data — and it diagnoses the classic unpinned-
//     range mistake (#N/A part-way down) by name.

import { createLesson } from "../spec.js";
import { resolveSheet } from "../graders.js";
import { getRangeValues, isError } from "../../sheet/model.js";

const HMDA = "hmda-sample.csv";

/**
 * ZIP → census region for the 22 distinct ZIP codes in the HMDA extract.
 * Kept as ordered pairs (ascending by ZIP) — this IS the Regions tab.
 */
export const REGIONS = [
  ["02138", "Northeast"], // Cambridge, MA
  ["08854", "Northeast"], // Piscataway, NJ
  ["10001", "Northeast"], // New York, NY
  ["30310", "South"],     // Atlanta, GA
  ["33125", "South"],     // Miami, FL
  ["48104", "Midwest"],   // Ann Arbor, MI
  ["48217", "Midwest"],   // Detroit, MI
  ["57350", "Midwest"],   // Huron, SD
  ["59022", "West"],      // Crow Agency, MT
  ["60614", "Midwest"],   // Chicago, IL
  ["60619", "Midwest"],   // Chicago, IL
  ["63115", "Midwest"],   // St. Louis, MO
  ["77002", "South"],     // Houston, TX
  ["78207", "South"],     // San Antonio, TX
  ["79901", "South"],     // El Paso, TX
  ["80302", "West"],      // Boulder, CO
  ["85009", "West"],      // Phoenix, AZ
  ["90011", "West"],      // Los Angeles, CA
  ["92841", "West"],      // Garden Grove, CA
  ["94027", "West"],      // Atherton, CA
  ["94538", "West"],      // Fremont, CA
  ["95129", "West"],      // San Jose, CA
];

const TABLE_LAST_ROW = REGIONS.length + 1; // header row + 22 zips = rows 2..23

// The step-1 gap: ZIP 10001 (row 4 of the Regions tab) has no region yet.
const GAP_ROW = 4;

/** Cells for the Regions tab (columns A:B). */
function regionsTabCells({ omitRow } = {}) {
  const cells = { A1: "zip_code", B1: "region" };
  REGIONS.forEach(([zip, region], i) => {
    const r = i + 2;
    cells[`A${r}`] = zip;
    if (r !== omitRow) cells[`B${r}`] = region;
  });
  return cells;
}

/** The Regions table linked into J:K of the Applicants tab. */
function linkedTableCells({ omitRow } = {}) {
  const cells = { J1: "zip_code", K1: "region" };
  REGIONS.forEach(([zip, region], i) => {
    const r = i + 2;
    cells[`J${r}`] = zip;
    if (r !== omitRow) cells[`K${r}`] = region;
  });
  return cells;
}

const XLOOKUP_FORMULA = (row) => `=XLOOKUP(D${row}, $J$2:$J$${TABLE_LAST_ROW}, $K$2:$K$${TABLE_LAST_ROW})`;

/** H2:H101 filled with the pinned XLOOKUP (the state entering step 4). */
function filledRegionCells() {
  const cells = {};
  for (let r = 2; r <= 101; r++) cells[`H${r}`] = XLOOKUP_FORMULA(r);
  return cells;
}

function workbookCheckpoint({ active, regionsOmitRow, applicantCells }) {
  return {
    tool: "sheet",
    active,
    sheets: [
      {
        name: "Applicants",
        load: [{ resource: HMDA, origin: "A1" }],
        cells: {
          H1: "region",
          ...linkedTableCells({ omitRow: regionsOmitRow }),
          ...applicantCells,
        },
      },
      { name: "Regions", cells: regionsTabCells({ omitRow: regionsOmitRow }) },
    ],
  };
}

/**
 * OUTCOME grader for the fill-down step: derive each row's expected region
 * from the sheet's own ZIP column and Regions table, then diff H2:H101.
 * Pure over toolState — no copy of the data lives in the lesson.
 */
function regionFillCheck(toolState) {
  const sheet = resolveSheet(toolState, "Applicants");
  const table = getRangeValues(sheet, `J2:K${TABLE_LAST_ROW}`);
  const regionOf = new Map(table.map(([zip, region]) => [String(zip), region]));
  const zips = getRangeValues(sheet, "D2:D101");
  const got = getRangeValues(sheet, "H2:H101");

  let ok = 0;
  let sawError = false;
  const diff = [];
  for (let i = 0; i < 100; i++) {
    const zip = zips[i][0];
    const expected = regionOf.get(String(zip)) ?? null;
    const actual = got[i][0];
    if (typeof actual === "string" && actual === expected) {
      ok++;
      continue;
    }
    if (isError(actual)) sawError = true;
    if (diff.length < 5) {
      const shown = actual === undefined || actual === "" ? "(blank)" : isError(actual) ? actual.code : JSON.stringify(actual);
      diff.push({
        kind: actual === undefined || actual === "" ? "missing" : "wrong",
        path: `H${i + 2}`,
        expected,
        actual,
        hint: `H${i + 2} looks up ZIP ${zip} — the Regions table says ${expected}, but the cell shows ${shown}.`,
      });
    }
  }

  const pass = ok === 100;
  let message = pass
    ? "All 100 regions match the Regions table."
    : `${100 - ok} of 100 rows in column H don't match the Regions table yet.`;
  if (!pass && sawError) {
    message +=
      " #N/A part-way down usually means the lookup ranges shifted as you filled — pin them with $" +
      ` ($J$2:$J$${TABLE_LAST_ROW} and $K$2:$K$${TABLE_LAST_ROW}) and fill down again.`;
  }
  return {
    pass,
    score: ok / 100,
    message,
    diff,
    expected: "H2:H101 pulled from the Regions table",
    actual: `${ok}/100 rows correct`,
  };
}

export const lesson = createLesson({
  id: "excel-xlookup",
  tool: "sheet",
  moduleId: "excel",
  mode: "guided",
  voice: true,
  title: "XLOOKUP across two tabs: enrich applicants with their region",
  description:
    "A two-tab workbook: Applicants holds the real HMDA extract, Regions maps each ZIP code to a US " +
    "census region. You'll pull the region into the Applicants tab with XLOOKUP — the modern, " +
    "direction-agnostic lookup — and use its if_not_found argument to handle a ZIP the table doesn't know.",
  resources: [HMDA],
  steps: [
    {
      id: "complete-regions",
      title: "Complete the Regions tab",
      instruction:
        "Open the Regions tab. One ZIP code is missing its region: 10001 is New York, NY. " +
        "Type its US census region into B4.",
      hints: [
        "The four US census regions are Northeast, Midwest, South and West.",
        "New York State is in the same region as Massachusetts (02138) and New Jersey (08854) — look at rows 2 and 3.",
        "Every ZIP starting with 0 or 1 in this table is in the Northeast.",
        "Type Northeast into B4.",
      ],
      target: { kind: "sheet-cell", ref: "B4", sheet: "Regions" },
      spotlightLabel: "Type Northeast into B4 on the Regions tab",
      checkpoint: workbookCheckpoint({ active: "Regions", regionsOmitRow: GAP_ROW }),
      grader: { type: "cellValue", sheet: "Regions", ref: "B4", expected: "Northeast" },
    },
    {
      id: "first-xlookup",
      title: "Write the first XLOOKUP",
      instruction:
        "Back on the Applicants tab, column H should hold each applicant's region. The Regions table is " +
        "linked into J2:K23 of this tab. In H2, write an XLOOKUP that finds the ZIP in D2 within " +
        "J2:J23 and returns the matching region from K2:K23. Pin the table rows with $ so the formula " +
        "survives a fill-down. Syntax: =XLOOKUP(lookup_value, lookup_array, return_array).",
      hints: [
        "XLOOKUP takes three required arguments: what to find, where to look, and what to return.",
        "The lookup value is D2; the lookup array is the ZIP column J2:J23; the return array is the region column K2:K23.",
        "Pin the arrays with $: $J$2:$J$23 and $K$2:$K$23 — D2 must stay relative so it shifts on fill-down.",
        "=XLOOKUP(D2, $J$2:$J$23, $K$2:$K$23) — D2 is 48217 (Detroit), so H2 should show Midwest.",
      ],
      target: { kind: "sheet-cell", ref: "H2", sheet: "Applicants" },
      spotlightLabel: "Write an XLOOKUP formula in H2",
      checkpoint: workbookCheckpoint({ active: "Applicants" }),
      grader: {
        type: "cellFormula",
        sheet: "Applicants",
        ref: "H2",
        mustUse: ["XLOOKUP"],
        mustNotUse: ["VLOOKUP"],
        expectedValue: "Midwest",
      },
    },
    {
      id: "fill-down",
      title: "Fill the column",
      instruction:
        "Fill H2 down through H101 so every applicant gets a region. If you pinned the table with $, " +
        "all 100 rows resolve with no #N/A errors — spot-check H101 (ZIP 90011, Los Angeles) against " +
        "the Regions table: it should say West.",
      hints: [
        "Copy H2, then paste it over H3:H101 — relative references shift, $-pinned ones don't.",
        "If regions go blank or #N/A part-way down, the lookup ranges are sliding with the fill.",
        "Pin both arrays: =XLOOKUP(D2, $J$2:$J$23, $K$2:$K$23), then fill down again.",
        "Every cell in H should contain an XLOOKUP; H101 shows West for ZIP 90011.",
      ],
      target: { kind: "sheet-cell", ref: "H2", sheet: "Applicants" },
      spotlightLabel: "Fill H2's formula down through H101",
      checkpoint: workbookCheckpoint({ active: "Applicants", applicantCells: { H2: XLOOKUP_FORMULA(2) } }),
      grader: {
        type: "allOf",
        of: [
          { type: "predicate", fn: regionFillCheck, label: "Column H matches the Regions table" },
          { type: "cellFormula", sheet: "Applicants", ref: "H101", mustUse: ["XLOOKUP"] },
        ],
      },
    },
    {
      id: "if-not-found",
      title: "Handle a ZIP the table doesn't know",
      instruction:
        "A new applicant A0101 landed in row 102 with ZIP 99999 — it's not in the Regions table, so a " +
        "plain XLOOKUP shows #N/A. In H102, use XLOOKUP's optional 4th argument (if_not_found) to show " +
        "Unknown instead.",
      hints: [
        "This is the reason XLOOKUP replaced VLOOKUP: missing values are handled in the function itself.",
        "The 4th argument is returned whenever the lookup finds no match.",
        "Pass the fallback as text: \"Unknown\".",
        "=XLOOKUP(D102, $J$2:$J$23, $K$2:$K$23, \"Unknown\")",
      ],
      target: { kind: "sheet-cell", ref: "H102", sheet: "Applicants" },
      spotlightLabel: "Add Unknown as XLOOKUP's fallback in H102",
      checkpoint: workbookCheckpoint({
        active: "Applicants",
        applicantCells: { ...filledRegionCells(), A102: "A0101", D102: "99999" },
      }),
      grader: {
        type: "allOf",
        of: [
          { type: "cellFormula", sheet: "Applicants", ref: "H102", mustUse: ["XLOOKUP"] },
          { type: "cellValue", sheet: "Applicants", ref: "H102", expected: "Unknown" },
        ],
      },
    },
  ],
});

export default lesson;
