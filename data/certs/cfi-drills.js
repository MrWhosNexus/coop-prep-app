// CFI / FMVA-style modeling drills.
//
// Each drill is a hands-on spreadsheet task graded against the app's REAL
// spreadsheet engine (lib/sheet/model.js) — not a multiple-choice question.
// This file owns drill CONTENT ONLY (starting data, task instructions,
// reference-correct formulas, and verified expected values). The grading
// harness that presents these to a learner, diffs their submitted sheet
// against `solution`/`expected`, and scores partial credit lives in
// lib/guide/ (owned by another agent) — see the JSDoc typedef below for the
// exact shape it can rely on.
//
// GROUND TRUTH: every `expected` value below was produced by actually
// running the paired `solution` formulas through lib/sheet/model.js (not
// hand-computed) — see test/cert-cfi.test.js, which re-runs every drill's
// solution through the real engine on every `npm test` and asserts the
// values below still match. If engine behavior ever changes, that test
// fails loudly instead of this file silently drifting from correct.
//
// Cell-reference convention:
//   `starting`  — literal inputs (numbers) the learner is GIVEN, pre-loaded
//                 via setCells(sheet, drill.starting). These are the "blue"
//                 cells — never expected to change formulas here.
//   `solution`  — the reference-correct formula for every cell the learner
//                 must fill in themselves ("=..." strings, loaded the same
//                 way via setCells). This is both the answer key AND the
//                 fixture test/cert-cfi.test.js runs to verify `expected`.
//   `expected`  — the computed value of every cell in `solution`, i.e. what
//                 getValue(sheet, cell) should return once the learner's
//                 sheet is correctly built. A grading harness compares the
//                 learner's own computed values against these with the
//                 drill's `tolerance` (absolute, in the same units as the
//                 cell — usually $ millions or a plain ratio/rate).
//   `mustReference` — a lightweight, harness-facing rubric: for a handful of
//                 pedagogically load-bearing cells, the OTHER cells whose
//                 values that formula must actually incorporate. This is
//                 how a harness enforces "the WACC cell must actually use
//                 CAPM, not hardcode 8%" without needing a full formula
//                 parser: it can perturb `starting[refCell]` and confirm the
//                 learner's computed output for `cell` changes accordingly.

/**
 * @typedef {object} CfiDrill
 * @property {string} id
 * @property {string} title
 * @property {string} moduleId - links back to a CFI_MODULES id in cfi.js
 * @property {number} minutes - estimated completion time
 * @property {string} scenario - the business context/story
 * @property {string[]} task - ordered, cell-referenced instructions
 * @property {string} interviewAngle - the judgment question this drill maps to
 * @property {string} modelAnswer - a strong answer to interviewAngle
 * @property {Object<string, number>} starting - seed cells: A1 -> literal input
 * @property {Object<string, string>} solution - answer-key cells: A1 -> "=formula"
 * @property {Object<string, number>} expected - solution cell -> verified computed value
 * @property {Object<string, string[]>} [mustReference] - cell -> cells its formula must depend on
 * @property {number} tolerance - absolute comparison tolerance for `expected`
 * @property {string[]} [hints]
 */

/** @type {CfiDrill[]} */
export const CFI_DRILLS = [
  // -------------------------------------------------------------------------
  {
    id: "cfi-drill-tvm-npv-irr",
    title: "TVM / NPV / IRR: is this project worth doing?",
    moduleId: "cfi-corpfin",
    minutes: 18,
    scenario:
      "A capital project requires a $500K outlay today (Year 0) and is expected to return $120K, $150K, $180K, $200K, and $220K in Years 1 through 5 (all figures in $000s). Leadership wants to know the project's NPV at a 10% discount rate, and — because 'what discount rate would make this a bad deal?' always comes up — its approximate IRR.",
    task: [
      "Row 1 (given): B1 holds the discount rate, 10%.",
      "Row 2 (given): B2:G2 hold the year numbers 0 through 5.",
      "Row 3 (given): B3:G3 hold the cash flows: -500, 120, 150, 180, 200, 220.",
      "Row 4 (you build): in B4:G4, compute the present value of each year's cash flow: PV = cash flow / (1 + discount rate) ^ year. Reference $B$1 for the rate (absolute) and each column's own year cell (relative).",
      "H4 (you build): =SUM(B4:G4) — this is the project's NPV at 10%.",
      "Rows 7-22 (given in column A, you build column B): column A holds 16 candidate discount rates from 0% to 30% in 2% steps. In column B, build a full NPV formula for EACH row using that row's own rate in column A (this is manual IRR bracketing — the engine has no built-in IRR function, so you find the rate where NPV crosses zero by testing rates directly, the same technique Excel's own IRR function uses internally).",
      "Read off the two adjacent rows where NPV flips from positive to negative — the true IRR sits between those two discount rates.",
    ],
    interviewAngle:
      "Why does IRR matter alongside NPV, and what's a limitation of IRR that NPV doesn't have?",
    modelAnswer:
      "NPV tells you the dollar value created at a given discount rate; IRR tells you the break-even discount rate itself, which is useful for comparing projects of different sizes or explaining a deal to someone who thinks in percentages, not dollars. IRR's real limitation is that with unconventional cash flows (multiple sign changes) it can produce multiple mathematically valid IRRs or none at all, and it implicitly assumes interim cash flows get reinvested at the IRR itself — often unrealistic for a high IRR project. NPV has neither problem, which is why NPV is the theoretically preferred decision rule when the two disagree.",
    starting: {
      B1: 0.10,
      B2: 0, C2: 1, D2: 2, E2: 3, F2: 4, G2: 5,
      B3: -500, C3: 120, D3: 150, E3: 180, F3: 200, G3: 220,
      A7: 0, A8: 0.02, A9: 0.04, A10: 0.06, A11: 0.08, A12: 0.10,
      A13: 0.12, A14: 0.14, A15: 0.16, A16: 0.18, A17: 0.20,
      A18: 0.22, A19: 0.24, A20: 0.26, A21: 0.28, A22: 0.30,
    },
    solution: {
      B4: "=B3/(1+$B$1)^B2", C4: "=C3/(1+$B$1)^C2", D4: "=D3/(1+$B$1)^D2",
      E4: "=E3/(1+$B$1)^E2", F4: "=F3/(1+$B$1)^F2", G4: "=G3/(1+$B$1)^G2",
      H4: "=SUM(B4:G4)",
      B7: "=$B$3+C3/(1+A7)^C2+D3/(1+A7)^D2+E3/(1+A7)^E2+F3/(1+A7)^F2+G3/(1+A7)^G2",
      B8: "=$B$3+C3/(1+A8)^C2+D3/(1+A8)^D2+E3/(1+A8)^E2+F3/(1+A8)^F2+G3/(1+A8)^G2",
      B9: "=$B$3+C3/(1+A9)^C2+D3/(1+A9)^D2+E3/(1+A9)^E2+F3/(1+A9)^F2+G3/(1+A9)^G2",
      B10: "=$B$3+C3/(1+A10)^C2+D3/(1+A10)^D2+E3/(1+A10)^E2+F3/(1+A10)^F2+G3/(1+A10)^G2",
      B11: "=$B$3+C3/(1+A11)^C2+D3/(1+A11)^D2+E3/(1+A11)^E2+F3/(1+A11)^F2+G3/(1+A11)^G2",
      B12: "=$B$3+C3/(1+A12)^C2+D3/(1+A12)^D2+E3/(1+A12)^E2+F3/(1+A12)^F2+G3/(1+A12)^G2",
      B13: "=$B$3+C3/(1+A13)^C2+D3/(1+A13)^D2+E3/(1+A13)^E2+F3/(1+A13)^F2+G3/(1+A13)^G2",
      B14: "=$B$3+C3/(1+A14)^C2+D3/(1+A14)^D2+E3/(1+A14)^E2+F3/(1+A14)^F2+G3/(1+A14)^G2",
      B15: "=$B$3+C3/(1+A15)^C2+D3/(1+A15)^D2+E3/(1+A15)^E2+F3/(1+A15)^F2+G3/(1+A15)^G2",
      B16: "=$B$3+C3/(1+A16)^C2+D3/(1+A16)^D2+E3/(1+A16)^E2+F3/(1+A16)^F2+G3/(1+A16)^G2",
      B17: "=$B$3+C3/(1+A17)^C2+D3/(1+A17)^D2+E3/(1+A17)^E2+F3/(1+A17)^F2+G3/(1+A17)^G2",
      B18: "=$B$3+C3/(1+A18)^C2+D3/(1+A18)^D2+E3/(1+A18)^E2+F3/(1+A18)^F2+G3/(1+A18)^G2",
      B19: "=$B$3+C3/(1+A19)^C2+D3/(1+A19)^D2+E3/(1+A19)^E2+F3/(1+A19)^F2+G3/(1+A19)^G2",
      B20: "=$B$3+C3/(1+A20)^C2+D3/(1+A20)^D2+E3/(1+A20)^E2+F3/(1+A20)^F2+G3/(1+A20)^G2",
      B21: "=$B$3+C3/(1+A21)^C2+D3/(1+A21)^D2+E3/(1+A21)^E2+F3/(1+A21)^F2+G3/(1+A21)^G2",
      B22: "=$B$3+C3/(1+A22)^C2+D3/(1+A22)^D2+E3/(1+A22)^E2+F3/(1+A22)^F2+G3/(1+A22)^G2",
    },
    expected: {
      B4: -500, C4: 109.09090909090908, D4: 123.96694214876031,
      E4: 135.23666416228394, F4: 136.6026910730141, G4: 136.60269107301409,
      H4: 141.49989754798153,
      B7: 370, B8: 315.47025959557953, B9: 265.8721935910453,
      B10: 220.65401479589826, B11: 179.3360114467254, B12: 141.49989754798153,
      B13: 106.77990732098212, B14: 74.85532171484172, B15: 45.444175262926635,
      B16: 18.297939401833105, B17: -6.802983539094583, B18: -30.053091009215706,
      B19: -51.62504644304677, B20: -71.6724721612755, B21: -90.33234417438509,
      B22: -107.72705114289796,
    },
    mustReference: {
      H4: ["B1", "B3", "C3", "D3", "E3", "F3", "G3"],
    },
    tolerance: 0.01,
    hints: [
      "NPV at 10% should come out positive (roughly $141.5K) — the project clears the hurdle rate.",
      "The true IRR sits between the 18% row and the 20% row, where the sign of NPV flips (roughly 19.4%).",
      "Don't retype the rate in each PV formula — reference $B$1 (absolute) so changing the discount rate once updates every PV.",
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: "cfi-drill-3statement-linkage",
    title: "3-statement linkage: make the model actually agree with itself",
    moduleId: "cfi-accounting",
    minutes: 30,
    scenario:
      "Year 1 is this company's actual, reported financials (already balanced). Your job is to build Year 2 as a fully linked projection: net income must roll into retained earnings, D&A must flow through the income statement, cash flow statement, AND the balance sheet's accumulated depreciation, and Year 2's ending cash must come from an actual cash flow bridge — not be typed in. When you're done, the balance-sheet check and the cash tie-out check must both read exactly 0.",
    task: [
      "INCOME STATEMENT — Year 2 (column C), using Year 1 (column B) as the base and the driver cells in column E: Revenue C2 = B2 x (1+E2). COGS C3 = -C2 x E3. Gross profit C4 = C2+C3. SG&A C5 = -C2 x E5. EBITDA C6 = C4+C5.",
      "D&A C7 = -B20/E7 (straight-line: beginning gross PP&E divided by useful life in years — note this deliberately depends on the BALANCE SHEET section below). EBIT C8 = C6+C7.",
      "Interest C9 = -E9 x B26 (rate x beginning-of-year debt balance, from the balance sheet). EBT C10 = C8+C9. Tax C11 = -C10 x E11. Net income C12 = C10+C11.",
      "BALANCE SHEET — Year 2: Cash C16 = B16 + C48 (this MUST reference the cash flow statement's net change in cash, row 48 — not be typed in). AR C17 = C2 x E17. Inventory C18 = -C3 x E18. Total current assets C19 = C16+C17+C18.",
      "Capex C21 = E21 x C2. Gross PP&E C20 = B20+C21. Accumulated depreciation C22 = B22+C7 (this is the OTHER end of the D&A link — same C7 used on the income statement). Net PP&E C23 = C20+C22. Total assets C24 = C19+C23.",
      "Debt C26 = B26 (flat, no schedule change this period). AP C27 = -C3 x E27. Total liabilities C28 = C26+C27.",
      "Common stock C29 = B29. Dividends C31 = -E31 x C12 (30% payout ratio). Retained earnings C30 = B30 + C12 + C31 — THIS is the net-income-to-retained-earnings reflex link. Total equity C32 = C29+C30. Total liab+equity C33 = C28+C32.",
      "CHECKS: balance sheet check C34 = C24-C33 must equal 0. (Also compute B34 = B24-B33 for Year 1 as a sanity check — it should already be 0.)",
      "CASH FLOW STATEMENT — Year 2: C37 = C12 (net income). C38 = -C7 (D&A add-back — non-cash). C39 = -(C17-B17) (increase in AR is a use of cash). C40 = -(C18-B18) (increase in inventory is a use of cash). C41 = C27-B27 (increase in AP is a source of cash). CFO C42 = SUM(C37:C41).",
      "C43 = -C21 (capex, investing outflow). CFI C44 = C43. C45 = C31 (dividends paid). C46 = C26-B26 (change in debt). CFF C47 = C45+C46. Net change in cash C48 = C42+C44+C47.",
      "TIE-OUT: C49 = B16+C48 (ending cash per the CF bridge). C50 = C49-C16 must equal 0 — proof that the balance sheet's cash line really is being driven by the cash flow statement, not typed in separately.",
    ],
    interviewAngle:
      "If your balance-sheet check cell isn't exactly zero, where's the first place you'd look?",
    modelAnswer:
      "I'd check the two most common breaks first: whether retained earnings is actually rolling forward (beginning RE + net income − dividends) rather than being hardcoded, and whether D&A is hitting all three places it needs to — expensed on the income statement, added back on the cash flow statement, AND reducing accumulated depreciation on the balance sheet. A one-sided D&A link (e.g. it reduces net income but never reduces accumulated depreciation) is the single most common way a 3-statement model silently stops balancing.",
    starting: {
      B2: 1000, E2: 0.08,
      B3: -600, E3: 0.60,
      B5: -150, E5: 0.15,
      B7: -50, E7: 15,
      B9: -20, E9: 0.05,
      E11: 0.25,
      B16: 100,
      B17: 100, E17: 0.10,
      B18: 48, E18: 0.08,
      B20: 800, E21: 0.05,
      B22: -300,
      B26: 400,
      B27: 60, E27: 0.10,
      B29: 200,
      B30: 88, E31: 0.30,
    },
    solution: {
      C2: "=B2*(1+E2)", C3: "=-C2*E3", B4: "=B2+B3", C4: "=C2+C3",
      C5: "=-C2*E5", B6: "=B4+B5", C6: "=C4+C5",
      C7: "=-B20/E7", B8: "=B6+B7", C8: "=C6+C7",
      C9: "=-E9*B26", B10: "=B8+B9", C10: "=C8+C9",
      B11: "=-B10*E11", C11: "=-C10*E11", B12: "=B10+B11", C12: "=C10+C11",
      C16: "=B16+C48", C17: "=C2*E17", C18: "=-C3*E18",
      B19: "=B16+B17+B18", C19: "=C16+C17+C18",
      C20: "=B20+C21", C21: "=E21*C2", C22: "=B22+C7",
      B23: "=B20+B22", C23: "=C20+C22", B24: "=B19+B23", C24: "=C19+C23",
      C26: "=B26", C27: "=-C3*E27", B28: "=B26+B27", C28: "=C26+C27",
      C29: "=B29", C30: "=B30+C12+C31", C31: "=-E31*C12",
      B32: "=B29+B30", C32: "=C29+C30", B33: "=B28+B32", C33: "=C28+C32",
      B34: "=B24-B33", C34: "=C24-C33",
      C37: "=C12", C38: "=-C7", C39: "=-(C17-B17)", C40: "=-(C18-B18)", C41: "=C27-B27",
      C42: "=SUM(C37:C41)", C43: "=-C21", C44: "=C43", C45: "=C31", C46: "=C26-B26",
      C47: "=C45+C46", C48: "=C42+C44+C47", C49: "=B16+C48", C50: "=C49-C16",
    },
    expected: {
      C2: 1080, C3: -648, B4: 400, C4: 432, C5: -162, B6: 250, C6: 270,
      C7: -53.333333333333336, B8: 200, C8: 216.66666666666666,
      C9: -20, B10: 180, C10: 196.66666666666666,
      B11: -45, C11: -49.166666666666664, B12: 135, C12: 147.5,
      C16: 195.54333333333335, C17: 108, C18: 51.84,
      B19: 248, C19: 355.3833333333333,
      C20: 854, C21: 54, C22: -353.3333333333333,
      B23: 500, C23: 500.6666666666667, B24: 748, C24: 856.05,
      C26: 400, C27: 64.8, B28: 460, C28: 464.8,
      C29: 200, C30: 191.25, C31: -44.25,
      B32: 288, C32: 391.25, B33: 748, C33: 856.05,
      B34: 0, C34: 0,
      C37: 147.5, C38: 53.333333333333336, C39: -8, C40: -3.8400000000000034,
      C41: 4.799999999999997, C42: 193.79333333333335,
      C43: -54, C44: -54, C45: -44.25, C46: 0, C47: -44.25,
      C48: 95.54333333333335, C49: 195.54333333333335, C50: 0,
    },
    mustReference: {
      C30: ["B30", "C12", "C31"],
      C16: ["B16", "C48"],
      C22: ["B22", "C7"],
    },
    tolerance: 0.01,
    hints: [
      "Build the income statement first (it doesn't depend on anything you haven't built yet), then the balance sheet, then the cash flow statement last (it depends on both).",
      "C34 and C50 are your two 'did I actually link this correctly' checks — don't consider the drill done until both read 0.",
      "Net income (C12) is used in THREE places: it flows to retained earnings (C30), it's the starting line of the cash flow statement (C37), and dividends (C31) are a percentage of it.",
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: "cfi-drill-working-capital",
    title: "Working capital schedule: DSO, DIO, DPO",
    moduleId: "cfi-3statement",
    minutes: 15,
    scenario:
      "A retailer's Year 1 revenue is $2,000M, growing 10% per year. COGS runs at 65% of revenue. The company collects receivables in 45 days (DSO), holds inventory for 60 days (DIO), and pays its own suppliers in 40 days (DPO). Build a 3-year working capital schedule and quantify the annual cash drag from a growing business.",
    task: [
      "Row 2: project revenue for Years 2 and 3 off the prior year using the growth assumption in E2 (10%): C2 = B2 x (1+E2), D2 = C2 x (1+E2).",
      "Row 3: COGS at 65% of revenue (assumption in E3) for all three years: B3 = -B2 x E3, and similarly for C3, D3.",
      "Row 5 (AR): use DSO in E5 (45 days): AR = (DSO/365) x Revenue, for all three years.",
      "Row 6 (Inventory): use DIO in E6 (60 days): Inventory = (DIO/365) x COGS (use -B3 etc. since COGS is stored as a negative number).",
      "Row 7 (AP): use DPO in E7 (40 days): AP = (DPO/365) x COGS.",
      "Row 8 (Net working capital): NWC = AR + Inventory - AP, for all three years.",
      "Row 9: change in NWC vs. the prior year, for Years 2 and 3 only (C9 = C8-B8, D9 = D8-C8).",
      "Row 10: the cash flow impact of that change (an INCREASE in NWC is a USE of cash, so this should be the negative of row 9).",
    ],
    interviewAngle:
      "A retailer's revenue and profit are both growing nicely. Why might its free cash flow still be disappointing?",
    modelAnswer:
      "If receivables and inventory are growing faster than payables — which happens automatically when a business scales without renegotiating supplier terms — net working capital consumes an increasing share of operating cash flow every year, even while the income statement looks great. Growth that requires proportionally more cash tied up in AR and inventory than it releases in AP is genuinely cash-expensive, and a model (or an analyst) that only looks at the income statement will miss it entirely.",
    starting: {
      B2: 2000, E2: 0.10,
      E3: 0.65,
      E5: 45,
      E6: 60,
      E7: 40,
    },
    solution: {
      C2: "=B2*(1+E2)", D2: "=C2*(1+E2)",
      B3: "=-B2*E3", C3: "=-C2*E3", D3: "=-D2*E3",
      B5: "=E5/365*B2", C5: "=E5/365*C2", D5: "=E5/365*D2",
      B6: "=E6/365*(-B3)", C6: "=E6/365*(-C3)", D6: "=E6/365*(-D3)",
      B7: "=E7/365*(-B3)", C7: "=E7/365*(-C3)", D7: "=E7/365*(-D3)",
      B8: "=B5+B6-B7", C8: "=C5+C6-C7", D8: "=D5+D6-D7",
      C9: "=C8-B8", D9: "=D8-C8",
      C10: "=-C9", D10: "=-D9",
    },
    expected: {
      C2: 2200, D2: 2420,
      B3: -1300, C3: -1430, D3: -1573,
      B5: 246.5753424657534, C5: 271.23287671232873, D5: 298.35616438356163,
      B6: 213.69863013698628, C6: 235.06849315068493, D6: 258.5753424657534,
      B7: 142.46575342465752, C7: 156.71232876712327, D7: 172.3835616438356,
      B8: 317.8082191780822, C8: 349.58904109589037, D8: 384.54794520547944,
      C9: 31.78082191780817, D9: 34.95890410958907,
      C10: -31.78082191780817, D10: -34.95890410958907,
    },
    tolerance: 0.01,
    hints: [
      "AR uses REVENUE as its base; Inventory and AP both use COGS as their base — don't mix these up.",
      "COGS is stored as a negative number here (an expense), so Inventory/AP formulas negate it back to positive before applying the days fraction.",
      "NWC should grow each year (roughly $317.8M -> $349.6M -> $384.5M) — that growth IS the cash drag you're meant to quantify in row 10.",
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: "cfi-drill-wacc-build",
    title: "Build WACC from CAPM — don't just quote a number",
    moduleId: "cfi-corpfin",
    minutes: 15,
    scenario:
      "You need a discount rate for a DCF. Rather than pulling '9%' out of thin air, build it properly: cost of equity from CAPM, after-tax cost of debt, and market-value capital-structure weights.",
    task: [
      "B1, B2, B3 (given): risk-free rate (4.2%), equity beta (1.15), and market risk premium (5.5%).",
      "B4 (you build): cost of equity via CAPM — =B1+B2*B3. This cell must actually reference B1, B2, and B3; a hardcoded percentage does not satisfy this drill.",
      "B5, B6 (given): share price ($60.00) and shares outstanding (40M).",
      "B7 (you build): market value of equity = B5*B6.",
      "B8 (given): market value of debt ($600M, book value used as a standard proxy).",
      "B9, B10 (given): pre-tax cost of debt (6.0%) and the tax rate (25%).",
      "B11 (you build): after-tax cost of debt = B9*(1-B10).",
      "B12 (you build): total capital = B7+B8.",
      "B13, B14 (you build): weight of equity = B7/B12, weight of debt = B8/B12.",
      "B15 (you build): WACC = B13*B4 + B14*B11.",
    ],
    interviewAngle:
      "Walk me through why debt is structurally cheaper than equity in a WACC calculation.",
    modelAnswer:
      "Two separate reasons stack together: debt holders have a priority claim (they get paid before equity in bankruptcy and receive a contractually fixed return), so they demand a lower return for lower risk than equity holders do. On top of that, interest expense is tax-deductible, so the (1 − tax rate) adjustment in the WACC formula further lowers debt's effective cost to the company — there's no equivalent tax shield for the return paid to equity holders. Both effects point the same direction, which is why increasing leverage (up to a point) can lower a company's blended cost of capital.",
    starting: {
      B1: 0.042, B2: 1.15, B3: 0.055,
      B5: 60, B6: 40,
      B8: 600,
      B9: 0.06, B10: 0.25,
    },
    solution: {
      B4: "=B1+B2*B3",
      B7: "=B5*B6",
      B11: "=B9*(1-B10)",
      B12: "=B7+B8",
      B13: "=B7/B12",
      B14: "=B8/B12",
      B15: "=B13*B4+B14*B11",
    },
    expected: {
      B4: 0.10525000000000001,
      B7: 2400,
      B11: 0.045,
      B12: 3000,
      B13: 0.8,
      B14: 0.2,
      B15: 0.0932,
    },
    mustReference: {
      B4: ["B1", "B2", "B3"],
      B15: ["B4", "B11", "B13", "B14"],
    },
    tolerance: 0.0005,
    hints: [
      "Cost of equity (CAPM) should land at 10.525%.",
      "The final WACC should land at 9.32% — close to (but never coincidentally equal to) a round '9%' or '10%' someone might have guessed without building it.",
      "The weights (B13, B14) must use MARKET value of equity (price x shares), not any book value.",
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: "cfi-drill-dcf-terminal-value",
    title: "DCF: terminal value two ways, and why they should (almost) agree",
    moduleId: "cfi-valuation",
    minutes: 30,
    scenario:
      "You're valuing a company via a 5-year unlevered DCF. EBIT, D&A, CapEx, and the change in net working capital are projected for each year. WACC is 9.32% (built in the WACC drill), and you need to compute terminal value BOTH ways — perpetuity growth (2.5% long-run growth) and exit multiple (8.0x EV/EBITDA) — and reconcile them.",
    task: [
      "Row 3 (given): EBIT for Years 1-5. H3 (given): tax rate, 25%.",
      "Row 7 (you build): NOPAT = EBIT x (1 - tax rate), for each year — e.g. B7 = B3*(1-$H$3).",
      "Rows 4, 5, 6 (given): D&A, CapEx, and increase in NWC for each year.",
      "Row 8 (you build): unlevered FCF = NOPAT + D&A - CapEx - increase in NWC, for each year.",
      "H10, H11, H12 (given): WACC (9.32%), long-run growth rate g (2.5%), and exit multiple (8.0x EV/EBITDA).",
      "Row 9 (you build): present value of each year's FCF = FCF / (1+WACC)^year.",
      "H9 (you build): =SUM(B9:F9) — the sum of all 5 years' discounted FCF.",
      "H14 (you build): terminal value, perpetuity growth method (undiscounted, as of end of Year 5) = Final year FCF x (1+g) / (WACC-g).",
      "H15 (you build): present value of that terminal value = H14 / (1+WACC)^5.",
      "H16 (you build): Enterprise Value (perpetuity method) = H9+H15. H17 (you build): what fraction of that EV comes from the terminal value = H15/H16.",
      "H20 (you build): Year 5 EBITDA = EBIT + D&A for Year 5 (=F3+F4).",
      "H21 (you build): terminal value, exit multiple method (undiscounted) = Year 5 EBITDA x exit multiple.",
      "H22 (you build): present value of that terminal value. H23 (you build): Enterprise Value (exit multiple method) = H9+H22. H24 (you build): fraction of EV from terminal value under this method.",
      "H27 (you build, the cross-check): ratio of the two undiscounted terminal values (H21/H14) — should be close to 1.0 if your assumptions are internally consistent.",
      "H28 (you build): the growth rate the exit-multiple terminal value IMPLIES under the perpetuity formula — solve (WACC x TV - FCF5) / (TV + FCF5) using H21 as TV. H29 (you build): the exit multiple the perpetuity terminal value IMPLIES — H14 / Year 5 EBITDA.",
    ],
    interviewAngle:
      "Your terminal value is roughly 75% of total enterprise value. Is that a problem?",
    modelAnswer:
      "Not by itself — a large terminal-value share is a normal, almost unavoidable mathematical feature of discounting a growing perpetuity, not a modeling error. What it DOES mean is that the valuation's precision is largely illusory unless WACC and the terminal growth rate have been explicitly stress-tested, because the entire value hinges on just those two numbers. The more useful diagnostic than the percentage itself is the CROSS-CHECK between methods: if my perpetuity-growth terminal value implies an exit multiple wildly different from where comparable companies actually trade, or my exit-multiple terminal value implies an economically impossible long-run growth rate, that's the real signal something in my assumptions needs revisiting — not the raw terminal-value percentage.",
    starting: {
      B2: 1, C2: 2, D2: 3, E2: 4, F2: 5,
      B3: 300, C3: 330, D3: 360, E3: 385, F3: 405,
      H3: 0.25,
      B4: 80, C4: 85, D4: 90, E4: 93, F4: 95,
      B5: 100, C5: 105, D5: 108, E5: 110, F5: 112,
      B6: 20, C6: 22, D6: 24, E6: 25, F6: 26,
      H10: 0.0932, H11: 0.025, H12: 8.0,
    },
    solution: {
      B7: "=B3*(1-$H$3)", C7: "=C3*(1-$H$3)", D7: "=D3*(1-$H$3)",
      E7: "=E3*(1-$H$3)", F7: "=F3*(1-$H$3)",
      B8: "=B7+B4-B5-B6", C8: "=C7+C4-C5-C6", D8: "=D7+D4-D5-D6",
      E8: "=E7+E4-E5-E6", F8: "=F7+F4-F5-F6",
      B9: "=B8/(1+$H$10)^B2", C9: "=C8/(1+$H$10)^C2", D9: "=D8/(1+$H$10)^D2",
      E9: "=E8/(1+$H$10)^E2", F9: "=F8/(1+$H$10)^F2",
      H9: "=SUM(B9:F9)",
      H14: "=F8*(1+$H$11)/($H$10-$H$11)",
      H15: "=H14/(1+$H$10)^F2",
      H16: "=H9+H15",
      H17: "=H15/H16",
      H20: "=F3+F4",
      H21: "=H20*$H$12",
      H22: "=H21/(1+$H$10)^F2",
      H23: "=H9+H22",
      H24: "=H22/H23",
      H27: "=H21/H14",
      H28: "=($H$10*H21-F8)/(H21+F8)",
      H29: "=H14/H20",
    },
    expected: {
      B7: 225, C7: 247.5, D7: 270, E7: 288.75, F7: 303.75,
      B8: 185, C8: 205.5, D8: 228, E8: 246.75, F8: 260.75,
      B9: 169.22795462861325, C9: 171.95411772124496, D9: 174.5162924463988,
      E9: 172.76615553705568, F9: 167.00374186149645,
      H9: 855.4682621948092,
      H14: 3918.896627565981, H15: 2509.953598358267, H16: 3365.421860553076,
      H17: 0.745806529570049,
      H20: 500, H21: 4000, H22: 2561.89824523868, H23: 3417.366507433489,
      H24: 0.7496703206009697,
      H27: 1.020695461029395, H28: 0.026298186938919207, H29: 7.837793255131962,
    },
    mustReference: {
      H16: ["H9", "H15"],
      H23: ["H9", "H22"],
    },
    tolerance: 0.05,
    hints: [
      "Enterprise value should come out close under both methods: about $3,365M (perpetuity) vs. about $3,417M (exit multiple) — a ~1.5% gap, which is a healthy, well-reconciled DCF.",
      "Terminal value is roughly 75% of enterprise value under EITHER method here — that's normal, not a red flag by itself (see the interview angle).",
      "H28 and H29 are the cross-check: the exit multiple implies a growth rate (~2.6%) close to your assumed 2.5%, and the perpetuity method implies a multiple (~7.8x) close to your assumed 8.0x — that closeness is what makes this DCF defensible.",
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: "cfi-drill-sensitivity-table",
    title: "Two-variable sensitivity table: how fragile is your DCF?",
    moduleId: "cfi-sensitivity",
    minutes: 20,
    scenario:
      "Using the same 5-year unlevered FCF stream from the DCF drill, build a two-variable sensitivity grid: WACC down the rows (7% to 11%), terminal growth rate g across the columns (1.5% to 3.5%), with Enterprise Value (perpetuity method) in every cell. The engine has no built-in what-if Data Table feature, so each grid cell is its OWN full DCF formula — which is exactly how you'd have to explain this to someone if Excel's Data Table tool weren't available either.",
    task: [
      "Row 9 (given): year numbers 1-5 in B9:F9. Row 10 (given): the FCF stream in B10:F10 (185, 205.5, 228, 246.75, 260.75 — same as the DCF drill).",
      "Column B, rows 3-7 (given): five WACC values, 7% to 11% in 1% steps.",
      "Row 2, columns C-G (given): five terminal growth rates, 1.5% to 3.5% in 0.5% steps.",
      "C3:G7 (you build): for EVERY cell in this 5x5 grid, build the FULL enterprise value formula using THAT ROW's WACC (column B) and THAT COLUMN's g (row 2): sum of all 5 years' FCF discounted at the row's WACC, plus the terminal value (FCF5 x (1+g)/(WACC-g), discounted back 5 years) using the row's WACC and the column's g.",
      "Use absolute references for the row anchor ($B3, $B4, etc.) and the column anchor (C$2, D$2, etc.) so the formula can conceptually be understood as one pattern applied across the whole grid, even though this engine has no fill-and-drag — you're building each cell explicitly.",
    ],
    interviewAngle:
      "Your base case DCF says $3.5B. Your sensitivity table ranges from $2.5B to $6.4B. Which number do you actually put in the pitch deck?",
    modelAnswer:
      "None of them alone — you present the base case as the headline number but the range as the honest caveat, and you name the two assumptions driving it: WACC and terminal growth. A single point estimate from a DCF is really the midpoint of a wide, legitimate range, and presenting only the point number without the sensitivity context is how analysts get blindsided in diligence when someone reruns the model with slightly different assumptions and gets a very different answer. The strong move is leading with the range and explaining why the base case sits where it does within it.",
    starting: {
      B9: 1, C9: 2, D9: 3, E9: 4, F9: 5,
      B10: 185, C10: 205.5, D10: 228, E10: 246.75, F10: 260.75,
      B3: 0.07, B4: 0.08, B5: 0.09, B6: 0.10, B7: 0.11,
      C2: 0.015, D2: 0.02, E2: 0.025, F2: 0.03, G2: 0.035,
    },
    solution: {
      C3: "=B10/(1+$B3)^B9+C10/(1+$B3)^C9+D10/(1+$B3)^D9+E10/(1+$B3)^E9+F10/(1+$B3)^F9+(F10*(1+C$2)/($B3-C$2))/(1+$B3)^F9",
      D3: "=B10/(1+$B3)^B9+C10/(1+$B3)^C9+D10/(1+$B3)^D9+E10/(1+$B3)^E9+F10/(1+$B3)^F9+(F10*(1+D$2)/($B3-D$2))/(1+$B3)^F9",
      E3: "=B10/(1+$B3)^B9+C10/(1+$B3)^C9+D10/(1+$B3)^D9+E10/(1+$B3)^E9+F10/(1+$B3)^F9+(F10*(1+E$2)/($B3-E$2))/(1+$B3)^F9",
      F3: "=B10/(1+$B3)^B9+C10/(1+$B3)^C9+D10/(1+$B3)^D9+E10/(1+$B3)^E9+F10/(1+$B3)^F9+(F10*(1+F$2)/($B3-F$2))/(1+$B3)^F9",
      G3: "=B10/(1+$B3)^B9+C10/(1+$B3)^C9+D10/(1+$B3)^D9+E10/(1+$B3)^E9+F10/(1+$B3)^F9+(F10*(1+G$2)/($B3-G$2))/(1+$B3)^F9",
      C4: "=B10/(1+$B4)^B9+C10/(1+$B4)^C9+D10/(1+$B4)^D9+E10/(1+$B4)^E9+F10/(1+$B4)^F9+(F10*(1+C$2)/($B4-C$2))/(1+$B4)^F9",
      D4: "=B10/(1+$B4)^B9+C10/(1+$B4)^C9+D10/(1+$B4)^D9+E10/(1+$B4)^E9+F10/(1+$B4)^F9+(F10*(1+D$2)/($B4-D$2))/(1+$B4)^F9",
      E4: "=B10/(1+$B4)^B9+C10/(1+$B4)^C9+D10/(1+$B4)^D9+E10/(1+$B4)^E9+F10/(1+$B4)^F9+(F10*(1+E$2)/($B4-E$2))/(1+$B4)^F9",
      F4: "=B10/(1+$B4)^B9+C10/(1+$B4)^C9+D10/(1+$B4)^D9+E10/(1+$B4)^E9+F10/(1+$B4)^F9+(F10*(1+F$2)/($B4-F$2))/(1+$B4)^F9",
      G4: "=B10/(1+$B4)^B9+C10/(1+$B4)^C9+D10/(1+$B4)^D9+E10/(1+$B4)^E9+F10/(1+$B4)^F9+(F10*(1+G$2)/($B4-G$2))/(1+$B4)^F9",
      C5: "=B10/(1+$B5)^B9+C10/(1+$B5)^C9+D10/(1+$B5)^D9+E10/(1+$B5)^E9+F10/(1+$B5)^F9+(F10*(1+C$2)/($B5-C$2))/(1+$B5)^F9",
      D5: "=B10/(1+$B5)^B9+C10/(1+$B5)^C9+D10/(1+$B5)^D9+E10/(1+$B5)^E9+F10/(1+$B5)^F9+(F10*(1+D$2)/($B5-D$2))/(1+$B5)^F9",
      E5: "=B10/(1+$B5)^B9+C10/(1+$B5)^C9+D10/(1+$B5)^D9+E10/(1+$B5)^E9+F10/(1+$B5)^F9+(F10*(1+E$2)/($B5-E$2))/(1+$B5)^F9",
      F5: "=B10/(1+$B5)^B9+C10/(1+$B5)^C9+D10/(1+$B5)^D9+E10/(1+$B5)^E9+F10/(1+$B5)^F9+(F10*(1+F$2)/($B5-F$2))/(1+$B5)^F9",
      G5: "=B10/(1+$B5)^B9+C10/(1+$B5)^C9+D10/(1+$B5)^D9+E10/(1+$B5)^E9+F10/(1+$B5)^F9+(F10*(1+G$2)/($B5-G$2))/(1+$B5)^F9",
      C6: "=B10/(1+$B6)^B9+C10/(1+$B6)^C9+D10/(1+$B6)^D9+E10/(1+$B6)^E9+F10/(1+$B6)^F9+(F10*(1+C$2)/($B6-C$2))/(1+$B6)^F9",
      D6: "=B10/(1+$B6)^B9+C10/(1+$B6)^C9+D10/(1+$B6)^D9+E10/(1+$B6)^E9+F10/(1+$B6)^F9+(F10*(1+D$2)/($B6-D$2))/(1+$B6)^F9",
      E6: "=B10/(1+$B6)^B9+C10/(1+$B6)^C9+D10/(1+$B6)^D9+E10/(1+$B6)^E9+F10/(1+$B6)^F9+(F10*(1+E$2)/($B6-E$2))/(1+$B6)^F9",
      F6: "=B10/(1+$B6)^B9+C10/(1+$B6)^C9+D10/(1+$B6)^D9+E10/(1+$B6)^E9+F10/(1+$B6)^F9+(F10*(1+F$2)/($B6-F$2))/(1+$B6)^F9",
      G6: "=B10/(1+$B6)^B9+C10/(1+$B6)^C9+D10/(1+$B6)^D9+E10/(1+$B6)^E9+F10/(1+$B6)^F9+(F10*(1+G$2)/($B6-G$2))/(1+$B6)^F9",
      C7: "=B10/(1+$B7)^B9+C10/(1+$B7)^C9+D10/(1+$B7)^D9+E10/(1+$B7)^E9+F10/(1+$B7)^F9+(F10*(1+C$2)/($B7-C$2))/(1+$B7)^F9",
      D7: "=B10/(1+$B7)^B9+C10/(1+$B7)^C9+D10/(1+$B7)^D9+E10/(1+$B7)^E9+F10/(1+$B7)^F9+(F10*(1+D$2)/($B7-D$2))/(1+$B7)^F9",
      E7: "=B10/(1+$B7)^B9+C10/(1+$B7)^C9+D10/(1+$B7)^D9+E10/(1+$B7)^E9+F10/(1+$B7)^F9+(F10*(1+E$2)/($B7-E$2))/(1+$B7)^F9",
      F7: "=B10/(1+$B7)^B9+C10/(1+$B7)^C9+D10/(1+$B7)^D9+E10/(1+$B7)^E9+F10/(1+$B7)^F9+(F10*(1+F$2)/($B7-F$2))/(1+$B7)^F9",
      G7: "=B10/(1+$B7)^B9+C10/(1+$B7)^C9+D10/(1+$B7)^D9+E10/(1+$B7)^E9+F10/(1+$B7)^F9+(F10*(1+G$2)/($B7-G$2))/(1+$B7)^F9",
    },
    expected: {
      C3: 4343.566010632798, D3: 4705.247695253511, E3: 5147.303087567714,
      F3: 5699.872327960471, G3: 6410.318494179728,
      C4: 3658.442315870361, D4: 3904.159026276356, E4: 4194.551502210711,
      F4: 4543.022473331939, G4: 4968.931438035662,
      C5: 3156.5100806794057, D5: 3332.4356747605966, E5: 3535.426744854277,
      F5: 3772.249659963572, G5: 4052.1312869109206,
      C6: 2773.094091130065, D6: 2904.0468547230375, E6: 3052.459986795072,
      F6: 3222.0749948773982, G6: 3417.7846195877737,
      C7: 2470.751753276886, D7: 2571.1985962642016, E7: 2683.462714897083,
      F7: 2809.7598483590746, G7: 2952.8965996159986,
    },
    tolerance: 0.1,
    hints: [
      "The base case (9% WACC, 2.5% g) sits at E5 and should read approximately $3,535.4M — close to (not identical to, since these are round-number inputs) the DCF drill's more precise $3,365-3,417M figures.",
      "The full range runs from about $2,470.8M (bottom-right... actually bottom-LEFT: highest WACC, lowest g) to about $6,410.3M (lowest WACC, highest g) — more than a 2.5x spread.",
      "Every cell's formula is the SAME pattern, just anchored to a different row (WACC) and column (g) — build one cell correctly, then treat the rest as that same pattern repeated.",
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: "cfi-drill-comps-table",
    title: "Comps table: trading multiples and their limits",
    moduleId: "cfi-valuation",
    minutes: 25,
    scenario:
      "Five public comparable companies are given (Enterprise Value, Revenue, EBITDA, Net Income, share price, and shares outstanding). Build EV/Revenue, EV/EBITDA, and P/E for each, derive median/low/high multiples, and apply them to a private target company (Revenue $1,000M, EBITDA $320M, Net Income $150M, 45M shares outstanding, $250M net debt) to get an implied valuation range.",
    task: [
      "Rows 2-6 (given): five comps, columns B-G = Enterprise Value, Revenue, EBITDA, Net Income, share price, shares outstanding.",
      "Columns H, I, J (you build): for each comp row, compute EV/Revenue (H), EV/EBITDA (I), and P/E (J = (price x shares) / net income).",
      "Row 8, 9, 10 (you build): for each of the three multiples, compute the MEDIAN (row 8), MIN (row 9), and MAX (row 10) across the five comps using MEDIAN(), MIN(), MAX().",
      "B13-B17 (given): the target company's Revenue, EBITDA, Net Income, shares outstanding, and net debt.",
      "Row 13 (you build): implied Enterprise Value from EV/Revenue — low (C13, using the MIN multiple), mid (D13, using the MEDIAN), high (E13, using the MAX) — each = multiple x target Revenue.",
      "Row 14 (you build): same idea using EV/EBITDA (multiple x target EBITDA).",
      "Row 15 (you build): implied EQUITY value directly from P/E (multiple x target Net Income — P/E already produces an equity value, not an enterprise value).",
      "Rows 19-21 (you build): convert the EV-based implied values (rows 13, 14) to implied EQUITY value by subtracting net debt (B17); row 21 just carries row 15's equity value through unchanged.",
      "Rows 24-26 (you build): divide each row's low/mid/high equity value by target shares outstanding (B16) to get an implied price per share for each method.",
    ],
    interviewAngle:
      "Your EV/EBITDA-implied share price range is $59.43-$62.25, tightly clustered. Your P/E-implied range is $48.73-$61.22, much wider. Why would P/E be so much less consistent across comps that otherwise look similar?",
    modelAnswer:
      "P/E is not capital-structure-neutral — two operationally identical companies can post very different P/E ratios purely because one carries more leverage (which increases both financial risk and EPS volatility) or has a different share count from buybacks. EV/EBITDA sits above the capital structure entirely, valuing the whole enterprise before any debt/equity split, so it isolates operating performance and clusters more tightly across truly comparable companies. That's exactly why EV-based multiples are generally weighted more heavily than P/E in a real comps analysis — the wider P/E spread here isn't a sign these companies are less comparable operationally, it's a sign their financing choices differ.",
    starting: {
      B2: 3200, C2: 1050, D2: 340, E2: 175, F2: 58.00, G2: 52,
      B3: 2650, C3: 890, D3: 290, E3: 140, F3: 51.50, G3: 44,
      B4: 4100, C4: 1320, D4: 430, E4: 225, F4: 71.25, G4: 58,
      B5: 1980, C5: 680, D5: 210, E5: 98, F5: 39.80, G5: 36,
      B6: 3550, C6: 1150, D6: 375, E6: 195, F6: 63.40, G6: 55,
      B13: 1000, B14: 320, B15: 150, B16: 45, B17: 250,
    },
    solution: {
      H2: "=B2/C2", I2: "=B2/D2", J2: "=(F2*G2)/E2",
      H3: "=B3/C3", I3: "=B3/D3", J3: "=(F3*G3)/E3",
      H4: "=B4/C4", I4: "=B4/D4", J4: "=(F4*G4)/E4",
      H5: "=B5/C5", I5: "=B5/D5", J5: "=(F5*G5)/E5",
      H6: "=B6/C6", I6: "=B6/D6", J6: "=(F6*G6)/E6",
      H8: "=MEDIAN(H2:H6)", H9: "=MIN(H2:H6)", H10: "=MAX(H2:H6)",
      I8: "=MEDIAN(I2:I6)", I9: "=MIN(I2:I6)", I10: "=MAX(I2:I6)",
      J8: "=MEDIAN(J2:J6)", J9: "=MIN(J2:J6)", J10: "=MAX(J2:J6)",
      C13: "=H9*B13", D13: "=H8*B13", E13: "=H10*B13",
      C14: "=I9*B14", D14: "=I8*B14", E14: "=I10*B14",
      C15: "=J9*B15", D15: "=J8*B15", E15: "=J10*B15",
      C19: "=C13-B17", D19: "=D13-B17", E19: "=E13-B17",
      C20: "=C14-B17", D20: "=D14-B17", E20: "=E14-B17",
      C21: "=C15", D21: "=D15", E21: "=E15",
      C24: "=C19/B16", D24: "=D19/B16", E24: "=E19/B16",
      C25: "=C20/B16", D25: "=D20/B16", E25: "=E20/B16",
      C26: "=C21/B16", D26: "=D21/B16", E26: "=E21/B16",
    },
    expected: {
      H2: 3.0476190476190474, I2: 9.411764705882353, J2: 17.234285714285715,
      H3: 2.9775280898876404, I3: 9.137931034482758, J3: 16.185714285714287,
      H4: 3.106060606060606, I4: 9.534883720930232, J4: 18.366666666666667,
      H5: 2.911764705882353, I5: 9.428571428571429, J5: 14.620408163265306,
      H6: 3.0869565217391304, I6: 9.466666666666667, J6: 17.882051282051282,
      H8: 3.0476190476190474, H9: 2.911764705882353, H10: 3.106060606060606,
      I8: 9.428571428571429, I9: 9.137931034482758, I10: 9.534883720930232,
      J8: 17.234285714285715, J9: 14.620408163265306, J10: 18.366666666666667,
      C13: 2911.7647058823527, D13: 3047.6190476190473, E13: 3106.060606060606,
      C14: 2924.137931034483, D14: 3017.1428571428573, E14: 3051.162790697674,
      C15: 2193.061224489796, D15: 2585.1428571428573, E15: 2755,
      C19: 2661.7647058823527, D19: 2797.6190476190473, E19: 2856.060606060606,
      C20: 2674.137931034483, D20: 2767.1428571428573, E20: 2801.162790697674,
      C21: 2193.061224489796, D21: 2585.1428571428573, E21: 2755,
      C24: 59.15032679738562, D24: 62.169312169312164, E24: 63.46801346801347,
      C25: 59.42528735632184, D25: 61.492063492063494, E25: 62.24806201550387,
      C26: 48.734693877551024, D26: 57.44761904761905, E26: 61.22222222222222,
    },
    tolerance: 0.02,
    hints: [
      "P/E = (price x shares) / net income gives you equity value per comp divided by net income — algebraically the same as price / EPS, just built from the raw inputs given.",
      "EV-based multiples (rows 13, 14) produce an ENTERPRISE value — you must subtract net debt (B17) before dividing by shares to get a price per share. P/E (row 15) already produces an equity value directly — don't subtract net debt again.",
      "Expect the EV/EBITDA-implied share prices to cluster tightly (~$59-63) and the P/E-implied prices to spread much wider (~$49-61) — that's the point of the interview-angle question above, not a mistake in your formulas.",
    ],
  },
];
