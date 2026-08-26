// CFI / FMVA-style financial modeling track.
//
// Shape matches data/curriculum.js's MODULES exactly: an array of
// { id, title, icon, color, light, description, coopModule, lessons }
// where each lesson is { id, title, minutes, body, challenge, exampleOutput, quiz }.
//
// This is a SKILLS track, not a proctored exam: the real assessment is the
// hands-on drills in data/certs/cfi-drills.js, graded against the app's real
// spreadsheet engine (lib/sheet/). These lessons teach the judgment and
// mechanics behind each drill; the quiz below is a comprehension check, not
// the credential itself.
//
// IMPORTANT — see CFI_DISCLAIMER below. This track is not affiliated with,
// endorsed by, or a substitute for the Corporate Finance Institute's own
// FMVA(R) certification program. It teaches the underlying modeling and
// valuation skills that program also covers.

/** Non-affiliation disclaimer — render this wherever the track is introduced. */
export const CFI_DISCLAIMER =
  "This track teaches FMVA-style financial modeling and valuation skills for interview and " +
  "workplace readiness. It is an independent, free study track — it is not affiliated with, " +
  "endorsed by, sponsored by, or a substitute for the Corporate Finance Institute's own FMVA(R) " +
  "certification program. \"FMVA\" refers to the general skill set (financial modeling & " +
  "valuation analyst work), not CFI's trademarked credential.";

export const CFI_MODULES = [
  {
    id: "cfi-accounting",
    title: "CFI: Accounting Foundations & the 3-Statement Link",
    icon: "📒",
    color: "#065f46",
    light: "#ecfdf5",
    description: "The income statement, balance sheet, and cash flow statement — and how net income, D&A, and cash actually flow between all three.",
    coopModule: "Financial modeling & valuation track (independent — not affiliated with CFI)",
    lessons: [
      {
        id: "acct-1",
        title: "The three statements, one story",
        minutes: 7,
        body: [
          "The income statement (IS) shows profitability over a period. The balance sheet (BS) shows what a company owns and owes at a point in time. The cash flow statement (CF) shows how cash actually moved — because profit and cash are not the same thing.",
          "A company can be profitable and still run out of cash (growing receivables, building inventory, paying down debt). A company can also burn accounting losses while cash is fine (heavy non-cash depreciation). The CF statement exists specifically to reconcile net income back to the actual cash balance.",
          "In modeling terms: the IS answers 'did we make money?', the BS answers 'what do we own and owe right now?', and the CF answers 'where did the cash actually go?'. A model where these three don't tie together isn't a financial model — it's three disconnected worksheets. Analysts get caught on this constantly: if your balance sheet doesn't balance, nothing else you built matters.",
        ],
        challenge: "In one paragraph, explain to a non-finance friend why a company can report a $10M profit and still run out of cash the same quarter. Use the phrase 'non-cash' at least once and name one balance-sheet item (other than cash) that could be the culprit.",
        exampleOutput: "A short paragraph naming a real mechanism — e.g. 'the company let receivables balloon: it booked the revenue and the profit, but the customers hadn't paid yet, so the cash never showed up' — and using 'non-cash' correctly (e.g. depreciation flattering net income without using any cash).",
        quiz: [
          { q: "Which statement reconciles net income to the actual change in cash?", a: "The cash flow statement", explanation: "The CF statement starts from net income and adjusts for non-cash items and working-capital timing to arrive at the real change in cash — that reconciliation is its entire purpose.", options: [
            { text: "The income statement", explanation: "The income statement measures profitability on an accrual basis — it doesn't track cash timing at all." },
            { text: "The balance sheet", explanation: "The balance sheet is a snapshot at a point in time; it shows the resulting cash balance but doesn't explain how it got there." },
            { text: "The cash flow statement", explanation: "Correct — it explicitly bridges net income to the cash balance." },
            { text: "The statement of retained earnings", explanation: "This tracks the equity roll-forward (net income less dividends), not the cash bridge." },
          ] },
          { q: "A company can report positive net income and still have negative cash flow in the same period because:", a: "Revenue and expenses are recorded on an accrual basis, not when cash actually changes hands", explanation: "Accrual accounting books revenue when earned and expenses when incurred, independent of the cash timing — that gap is exactly what working-capital changes and non-cash items on the CF statement capture.", options: [
            { text: "The accountants made an error", explanation: "This is normal, expected accounting behavior under accrual rules — not a mistake." },
            { text: "Revenue and expenses are recorded on an accrual basis, not when cash actually changes hands", explanation: "Correct — accrual accounting is the root cause of the profit/cash gap." },
            { text: "Net income always equals cash flow by definition", explanation: "This is false — that's precisely why a separate cash flow statement is required." },
            { text: "The company is committing fraud", explanation: "A profit/cash gap is completely normal and expected; it does not imply fraud." },
          ] },
        ],
      },
      {
        id: "acct-2",
        title: "Net income to retained earnings: the reflex link",
        minutes: 6,
        body: [
          "This is the single most tested linkage in FMVA-style interviews: Retained Earnings (ending) = Retained Earnings (beginning) + Net Income − Dividends. It is a roll-forward, not a fresh number each period.",
          "If you ever hardcode next year's retained earnings instead of rolling it forward from this year's net income, your balance sheet will stop balancing the moment net income changes — which is exactly how interviewers catch a model that isn't really linked. It should be reflexive: change a revenue assumption anywhere upstream, and retained earnings should move automatically, with the balance sheet still balancing.",
          "Dividends are the only thing that breaks the identity — some of net income leaves the company instead of building equity. A dividend payout ratio (dividends ÷ net income) is the standard way to model this as a percentage assumption rather than a hardcoded dollar amount.",
        ],
        challenge: "Beginning retained earnings is $88M. Net income this year is $147.5M. The company pays out a 30% dividend payout ratio. What is ending retained earnings? Show the roll-forward math.",
        exampleOutput: "Dividends = 30% x $147.5M = $44.25M. Ending RE = $88M + $147.5M − $44.25M = $191.25M. (These are the exact figures used in this track's 3-statement linkage drill.)",
        quiz: [
          { q: "The retained earnings roll-forward formula is:", a: "Beginning RE + Net Income − Dividends", explanation: "Retained earnings is a stock (balance) that accumulates each period's retained profit — this is the exact roll-forward identity that keeps a balance sheet linked correctly.", options: [
            { text: "Net Income − Dividends (reset each year)", explanation: "This drops the beginning balance entirely — retained earnings accumulates across years, it doesn't reset." },
            { text: "Beginning RE + Net Income − Dividends", explanation: "Correct — this is the standard roll-forward identity." },
            { text: "Beginning RE + Revenue − Expenses", explanation: "Revenue minus expenses (roughly) IS net income, but skipping straight to revenue/expenses instead of using net income risks double-counting or missing tax and interest." },
            { text: "Ending Cash − Beginning Cash", explanation: "That's a cash-balance change, an entirely different line item from the equity roll-forward." },
          ] },
          { q: "If a model hardcodes next year's retained earnings as a flat number instead of rolling it forward, what breaks first when an upstream assumption changes?", a: "The balance sheet stops balancing (assets no longer equal liabilities plus equity)", explanation: "A hardcoded RE number no longer reflects the new net income, so the equity side of the balance sheet drifts out of sync with assets — this is the classic tell that a model isn't truly linked.", options: [
            { text: "The income statement produces a #REF! error", explanation: "The income statement itself doesn't depend on retained earnings, so it keeps calculating fine — the break shows up on the balance sheet." },
            { text: "The balance sheet stops balancing (assets no longer equal liabilities plus equity)", explanation: "Correct — this is exactly the tell-tale symptom of a broken linkage." },
            { text: "Nothing breaks — retained earnings is a cosmetic line", explanation: "Retained earnings is a real equity component; hardcoding it silently breaks the balance sheet identity." },
            { text: "The cash flow statement can no longer be built", explanation: "The CF statement doesn't directly require retained earnings as an input in most simple models — the balance sheet is what visibly fails." },
          ] },
        ],
      },
      {
        id: "acct-3",
        title: "D&A and the cash flow bridge",
        minutes: 7,
        body: [
          "Depreciation & amortization (D&A) is the textbook example of why the three statements must interlock. It shows up in three different places, doing three different jobs: (1) an expense on the income statement that reduces EBIT and net income, (2) an add-back on the cash flow statement (it's non-cash — you never actually wrote a check for it this period), and (3) a reduction of net PP&E (via accumulated depreciation) on the balance sheet.",
          "Get any one of these wrong and the model stops tying: if D&A hits the income statement but never gets added back on the CF statement, you'll understate cash. If it hits the CF statement but never reduces the balance sheet's accumulated depreciation, your PP&E roll-forward stops balancing.",
          "CapEx is D&A's mirror image on the investing side: it's a cash outflow on the CF statement and it increases gross PP&E on the balance sheet, but it never touches the income statement directly (it's capitalized, not expensed — that's the entire point of capitalizing an asset instead of expensing it).",
        ],
        challenge: "A company's beginning gross PP&E is $800M with a 15-year useful life (straight-line). This year's CapEx is $54M. Compute this year's D&A expense, ending gross PP&E, and explain in one sentence why CapEx doesn't appear on the income statement.",
        exampleOutput: "D&A = $800M / 15 = $53.33M. Ending gross PP&E = $800M + $54M = $854M. CapEx doesn't hit the income statement because it's a balance-sheet purchase of a long-lived asset — its cost is expensed gradually over time AS depreciation, not all at once as CapEx.",
        quiz: [
          { q: "D&A appears on the cash flow statement as:", a: "A positive add-back to net income (it's a non-cash expense)", explanation: "D&A reduced net income on the income statement without any cash actually leaving the company, so the CF statement adds it back to reconstruct the real cash impact.", options: [
            { text: "A negative cash outflow, same as CapEx", explanation: "That's CapEx's treatment — D&A is the opposite: a positive add-back, not an outflow." },
            { text: "A positive add-back to net income (it's a non-cash expense)", explanation: "Correct — this is exactly why the CF statement starts with net income and adds D&A back." },
            { text: "It doesn't appear on the cash flow statement at all", explanation: "D&A is one of the most standard line items on the CF statement's operating section." },
            { text: "A financing activity", explanation: "D&A is an operating-section adjustment, not a financing activity — it has nothing to do with debt or equity issuance." },
          ] },
          { q: "Why doesn't CapEx reduce net income on the income statement the way an operating expense does?", a: "CapEx buys a long-lived asset that gets expensed gradually over its useful life through depreciation, instead of all at once", explanation: "Capitalizing an asset spreads its cost over the years it provides value (matching principle) rather than hitting one year's income statement with the full purchase price.", options: [
            { text: "CapEx is illegal to expense", explanation: "There's no legal prohibition — it's an accounting treatment choice (capitalize vs. expense) governed by whether the item has a useful life beyond one period." },
            { text: "CapEx buys a long-lived asset that gets expensed gradually over its useful life through depreciation, instead of all at once", explanation: "Correct — this is the matching principle behind capitalization." },
            { text: "CapEx is always paid for with debt, not cash from operations", explanation: "CapEx can be funded from cash, debt, or equity — its funding source is unrelated to why it isn't expensed immediately." },
            { text: "CapEx only affects the cash flow statement, never the balance sheet", explanation: "CapEx does hit the balance sheet too — it increases gross PP&E, which is central to the D&A schedule." },
          ] },
        ],
      },
    ],
  },
  {
    id: "cfi-modeling",
    title: "CFI: Modeling Best Practice",
    icon: "🧮",
    color: "#1e3a8a",
    light: "#eff6ff",
    description: "Structure, formatting conventions, circularity, error checks, and scenario design — the discipline that separates a professional model from a spreadsheet.",
    coopModule: "Financial modeling & valuation track (independent — not affiliated with CFI)",
    lessons: [
      {
        id: "model-1",
        title: "Structure and formatting conventions",
        minutes: 6,
        body: [
          "Professional models follow a color convention so anyone can tell, at a glance, what's safe to edit and what isn't: blue font = a hardcoded input (an assumption you typed in — safe to change). Black font = a formula (computed from other cells — never type a number directly into a black cell). Green font is often used for links pulling from another worksheet or file.",
          "The reason this matters isn't cosmetics — it's damage control. A reviewer, an interviewer, or you in six months should be able to open the model and instantly see which cells are levers and which are machinery, without tracing every formula. A model where inputs and formulas are visually identical is a model where someone eventually overwrites a formula with a hardcoded number and never notices.",
          "Structural convention matters too: assumptions live together (usually top of sheet or a dedicated tab), the calculation flows top-to-bottom or left-to-right consistently, and historical actuals are visually distinct from projected periods (often a vertical divider or shading). Consistency is what lets someone else — or you, under interview pressure — navigate the model without a guided tour.",
        ],
        challenge: "Open any spreadsheet you've built before (or imagine one). Identify three cells that should be blue (inputs) and three that should be black (formulas). If any input is currently buried inside a formula instead of its own cell, describe how you'd pull it out.",
        exampleOutput: "Six named cells split cleanly into inputs (e.g. 'growth rate assumption,' 'tax rate') vs. formulas (e.g. 'EBITDA = Gross Profit − SG&A'), plus one sentence on isolating a buried assumption — e.g. 'instead of typing =B2*1.08 directly, put 8% in its own cell and reference it, so it's a visible, changeable input.'",
        quiz: [
          { q: "In standard modeling convention, a blue-font cell means:", a: "A hardcoded input — a number typed directly into the cell", explanation: "Blue signals 'this is an assumption someone chose,' distinguishing it from cells the model computes itself.", options: [
            { text: "A formula referencing another sheet", explanation: "That's typically green, signaling an external link — not a hardcoded input." },
            { text: "A hardcoded input — a number typed directly into the cell", explanation: "Correct — blue is the universal convention for a manually entered assumption." },
            { text: "An error that needs fixing", explanation: "Errors show up as Excel error codes (#REF!, #DIV/0!, etc.), not as a font-color convention." },
            { text: "A cell that should never be changed", explanation: "It's the opposite — blue cells are exactly the ones meant to be changed, since they're the model's adjustable assumptions." },
          ] },
          { q: "Why should an assumption like a growth rate always live in its own cell rather than being typed directly inside a formula (e.g. =B2*1.08)?", a: "So it's a visible, single, changeable input instead of being buried and duplicated across formulas", explanation: "If 1.08 is typed into ten different formulas, updating the growth assumption means finding and editing all ten — and missing even one creates an inconsistent model with no visible error.", options: [
            { text: "Excel calculates faster that way", explanation: "This isn't primarily a performance consideration — it's about auditability and single-source-of-truth assumptions." },
            { text: "So it's a visible, single, changeable input instead of being buried and duplicated across formulas", explanation: "Correct — this is the entire rationale for isolating assumptions." },
            { text: "Formulas can't contain decimal numbers", explanation: "Formulas can absolutely contain decimals — the issue is discoverability and maintainability, not a technical restriction." },
            { text: "It has no real benefit, it's just convention", explanation: "The convention exists specifically to prevent silent, hard-to-find errors when assumptions change — it's a functional benefit, not cosmetic." },
          ] },
        ],
      },
      {
        id: "model-2",
        title: "Circularity and the iterative-calc problem",
        minutes: 7,
        body: [
          "A circular reference happens when a formula depends, directly or indirectly, on its own output. The classic modeling example: interest expense depends on the average of beginning and ending debt balance — but the ending debt balance depends on the cash flow available to pay down debt, which depends on net income, which depends on interest expense. Round and round.",
          "This isn't a mistake to be 'fixed' by breaking the link — it's an intentional feature of debt schedules that use average balances (more accurate than beginning-balance-only interest). The standard tools to handle it: (1) enable iterative calculation so the spreadsheet just resolves the loop numerically, or (2) add a 'circularity breaker' — a switch cell that, when flipped to 0, forces interest expense to reference only the beginning balance (no circularity), letting you troubleshoot a broken model without fighting an active circular reference.",
          "Interviewers ask about circularity specifically because it separates someone who has actually built a debt schedule from someone who has only read about one. The honest answer includes both why it happens (average-balance interest) and how you'd handle it (iterative calc or a breaker switch) — not just 'I'd avoid it.'",
        ],
        challenge: "Explain in 3 sentences: (1) why using average debt balance for interest expense creates circularity, (2) one method to resolve it, (3) why a beginning-balance-only interest formula avoids circularity but is less precise.",
        exampleOutput: "Three sentences hitting: average balance = (beginning+ending)/2, and ending balance depends on cash flow, which depends on net income, which depends on interest — a loop. A circularity breaker switch or iterative calculation resolves it. Beginning-balance-only interest has no circularity because it only looks backward at a known number, but it slightly mismatches interest to the actual average debt outstanding during the year.",
        quiz: [
          { q: "Why does using the average of beginning and ending debt balance for interest expense create a circular reference?", a: "Because ending debt balance depends on cash available to pay down debt, which depends on net income, which depends on interest expense", explanation: "The dependency chain loops back on itself: interest -> net income -> cash available -> ending debt -> average debt -> interest again.", options: [
            { text: "Because Excel can't handle division", explanation: "Division has nothing to do with it — the issue is the logical dependency chain, not an arithmetic operation." },
            { text: "Because ending debt balance depends on cash available to pay down debt, which depends on net income, which depends on interest expense", explanation: "Correct — this is exactly the circular dependency chain." },
            { text: "Because beginning balance is always unknown", explanation: "Beginning balance is a known, prior-period figure — it's the ending balance calculation that creates the loop." },
            { text: "It doesn't — average balances never cause circularity", explanation: "Average-balance interest is the textbook cause of circularity in a debt schedule." },
          ] },
          { q: "What is a 'circularity breaker' switch used for?", a: "Temporarily forcing the model to use only the beginning balance for interest, removing the circular reference for troubleshooting", explanation: "Flipping the switch to 0 cuts the loop by making interest depend only on a known prior-period number, letting you isolate whether other parts of the model are broken.", options: [
            { text: "Permanently deleting the debt schedule", explanation: "The switch is a temporary troubleshooting toggle, not a way to remove the debt schedule entirely." },
            { text: "Temporarily forcing the model to use only the beginning balance for interest, removing the circular reference for troubleshooting", explanation: "Correct — this is exactly what a circularity breaker does." },
            { text: "Automatically finding the exact debt paydown amount", explanation: "That's what the circular calculation itself (or iterative calc) solves for — the breaker switch does the opposite, temporarily disabling it." },
            { text: "Converting all formulas in the model to hardcoded values", explanation: "That would destroy the model's linkage entirely — unrelated to what a circularity breaker does." },
          ] },
        ],
      },
      {
        id: "model-3",
        title: "Error checks and building a model that can't lie to you",
        minutes: 6,
        body: [
          "Every serious model has a visible check row: 'Balance sheet check' (assets − liabilities − equity, must equal exactly 0), 'cash tie-out check' (cash flow statement's ending cash vs. balance sheet's cash line, must match), and often a sum-of-parts check (do the segments add up to the consolidated total?). These checks should be impossible to miss — bold, colored, flagged with an IF formula that returns 'OK' or 'ERROR' rather than a raw number nobody will notice drifting.",
          "The discipline is: build the check BEFORE you think you need it, not after something looks wrong. If you wire the balance-sheet check in from the start, it screams the instant a linkage breaks — often before you've even finished the section that broke it. Retrofitting checks after a model is 200 rows deep means hunting for a needle you didn't mark.",
          "Scenario and sensitivity design (this track covers both, in later modules) also depends on error checks: if you're going to flip growth rates, discount rates, and margins to stress-test a model, you need to know instantly if any combination breaks the balance sheet — not discover it after presenting a beautiful chart built on broken numbers.",
        ],
        challenge: "Design a 'balance sheet check' formula in plain English (not code) and describe what value it should always equal. Then describe one scenario where, if you didn't have this check, you could present a wrong number to a room with total confidence.",
        exampleOutput: "The check: Total Assets minus (Total Liabilities plus Total Equity), which must equal exactly zero every period. The scenario: without it, a broken depreciation link could quietly overstate net PP&E for several projected years — the DCF built on top of that model would use a wrong asset base and nobody would catch it until due diligence.",
        quiz: [
          { q: "What should a balance-sheet check formula always evaluate to, in a correctly linked model?", a: "Exactly zero", explanation: "Total Assets must always equal Total Liabilities plus Total Equity — any nonzero result on the check row is proof of a broken linkage somewhere upstream.", options: [
            { text: "Total assets", explanation: "The check isn't a copy of total assets — it's the DIFFERENCE between assets and liabilities-plus-equity." },
            { text: "Exactly zero", explanation: "Correct — a balanced model always nets to zero on this check." },
            { text: "100%", explanation: "A percentage doesn't apply here; the check is a dollar-difference, and a correct model nets that difference to zero." },
            { text: "Whatever net income is", explanation: "Net income and the balance-sheet check are unrelated figures — conflating them would hide real errors." },
          ] },
          { q: "Why should error checks be built into a model from the start rather than added at the end?", a: "So a broken linkage is caught immediately, near where it happened, instead of after the model has grown too large to easily debug", explanation: "Early checks turn a silent error into an immediate, visible one — the longer a broken link goes undetected, the harder it is to trace back to its source.", options: [
            { text: "Excel requires checks to be added before other formulas", explanation: "There's no technical requirement here — this is a workflow best-practice, not a software constraint." },
            { text: "So a broken linkage is caught immediately, near where it happened, instead of after the model has grown too large to easily debug", explanation: "Correct — this is the practical reason checks are built in early." },
            { text: "It makes the model calculate faster", explanation: "Check cells have a negligible effect on calculation speed — the value is in catching errors early, not performance." },
            { text: "It's purely a stylistic preference with no functional benefit", explanation: "Early checks have a very concrete functional benefit: catching breaks before they compound or get presented as real numbers." },
          ] },
        ],
      },
    ],
  },
  {
    id: "cfi-3statement",
    title: "CFI: Building the 3-Statement Model",
    icon: "🔗",
    color: "#7c2d12",
    light: "#fff7ed",
    description: "Driving revenue and margins, scheduling working capital, and building the debt schedule that closes the loop.",
    coopModule: "Financial modeling & valuation track (independent — not affiliated with CFI)",
    lessons: [
      {
        id: "build-1",
        title: "Driving revenue, COGS, and opex",
        minutes: 6,
        body: [
          "Every projected income statement starts with a driver, not a guess. Revenue is usually driven by a growth rate assumption (revenue_t = revenue_(t-1) x (1 + growth%)) or, in more granular models, by volume x price. COGS and SG&A are usually driven as a percentage of revenue, held flat or trending toward an industry benchmark over the projection period.",
          "The discipline here is the same as best-practice formatting: growth rate, COGS %, and SG&A % all live in their own blue input cells, referenced by black formula cells for each projected year — never re-typed as a new hardcoded percentage in each year's column. If year 3's COGS % needs to differ from year 1's, that's a new assumption cell, not a silently different hardcoded number sitting in a formula.",
          "A model where Year 1 revenue grows off a real prior-year actual, and every subsequent year grows off the year before it (not off the original base every time), is what makes the projection compound correctly — an easy mistake is anchoring every year to the same base cell instead of chaining year-over-year.",
        ],
        challenge: "Year 1 (actual) revenue is $1,000M. Using an 8% annual growth assumption, project revenue for Years 2 and 3. Then compute COGS for each year at a flat 60% of that year's revenue.",
        exampleOutput: "Year 2 revenue = $1,000M x 1.08 = $1,080M. Year 3 revenue = $1,080M x 1.08 = $1,166.4M (chained off Year 2, not off Year 1 again). COGS: Year 1 $600M, Year 2 $648M, Year 3 $699.84M.",
        quiz: [
          { q: "In a correctly chained revenue projection, Year 3 revenue should be computed as:", a: "Year 2 revenue x (1 + growth rate)", explanation: "Chaining off the immediately prior year is what makes growth compound correctly across the projection.", options: [
            { text: "Year 1 revenue x (1 + growth rate), every year", explanation: "Anchoring every year to Year 1 means growth doesn't compound — Year 3 would be wrong unless you also multiply by the rate twice, which is exactly what chaining off the prior year already does correctly." },
            { text: "Year 2 revenue x (1 + growth rate)", explanation: "Correct — each year should reference the immediately preceding year." },
            { text: "The average of Year 1 and Year 2 revenue", explanation: "Averaging prior years isn't how compounding growth is modeled — it would understate growth entirely." },
            { text: "A fixed dollar amount typed in for each year", explanation: "Hardcoding removes the entire point of a driver-based projection — it can't respond to a change in the growth assumption." },
          ] },
          { q: "Why should COGS be modeled as a percentage of revenue rather than a flat dollar growth rate?", a: "Because COGS scales with the volume of business activity revenue represents, keeping the margin structure consistent as revenue changes", explanation: "Tying COGS to revenue as a percentage preserves gross margin logic — if revenue assumptions change, COGS moves proportionally instead of becoming disconnected from the business's actual scale.", options: [
            { text: "Because COGS never changes in reality", explanation: "COGS absolutely changes — that's exactly why it's tied to revenue as a driver rather than hardcoded flat." },
            { text: "Because COGS scales with the volume of business activity revenue represents, keeping the margin structure consistent as revenue changes", explanation: "Correct — this is the standard rationale for percentage-of-revenue drivers." },
            { text: "Because dollar amounts can't be used in formulas", explanation: "Dollar amounts work fine in formulas — this isn't a technical limitation, it's about keeping the cost structure realistically linked to revenue." },
            { text: "Because it removes the need for a gross profit line", explanation: "Gross profit (revenue minus COGS) is still calculated and shown — modeling COGS as a percentage doesn't eliminate that line, it just drives it more realistically." },
          ] },
        ],
      },
      {
        id: "build-2",
        title: "Working capital scheduling",
        minutes: 7,
        body: [
          "Working capital (AR + Inventory − AP, at minimum) is driven using 'days' metrics, not percentages of revenue — this is the FMVA-standard convention because it maps to something operationally real: Days Sales Outstanding (DSO) is how long, on average, customers take to pay; Days Inventory Outstanding (DIO) is how long inventory sits before it's sold; Days Payable Outstanding (DPO) is how long the company takes to pay its own suppliers.",
          "The formulas: AR = (DSO / 365) x Revenue. Inventory = (DIO / 365) x COGS. AP = (DPO / 365) x COGS. Net working capital (NWC) = AR + Inventory − AP. An INCREASE in NWC year-over-year is a USE of cash (you've tied up more cash in receivables and inventory than you've deferred in payables) — it appears as a negative adjustment on the cash flow statement.",
          "This is a common interview trap: a growing, profitable company can still be a cash drain if working capital grows faster than earnings — very common in high-growth retail and manufacturing. Modeling DSO/DIO/DPO explicitly (instead of just plugging a working-capital percentage) is what lets you actually diagnose that, and what lets an interviewer see you understand operations, not just formulas.",
        ],
        challenge: "Revenue is $2,200M, COGS is $1,430M. DSO is 45 days, DIO is 60 days, DPO is 40 days. Compute AR, Inventory, AP, and net working capital.",
        exampleOutput: "AR = 45/365 x 2,200 = $271.2M. Inventory = 60/365 x 1,430 = $235.1M. AP = 40/365 x 1,430 = $156.7M. NWC = 271.2 + 235.1 − 156.7 = $349.6M.",
        quiz: [
          { q: "An INCREASE in net working capital year-over-year represents:", a: "A use of cash", explanation: "More cash gets tied up in receivables and inventory than the company defers by delaying its own payables — that's cash leaving, even though it never shows up on the income statement.", options: [
            { text: "A source of cash", explanation: "That's what a DECREASE in NWC represents — releasing previously tied-up working capital back into cash." },
            { text: "A use of cash", explanation: "Correct — growing NWC ties up more cash than it frees, which is a use, not a source." },
            { text: "No cash impact at all", explanation: "Working capital changes are one of the most direct cash-flow-statement adjustments precisely because they DO have a real cash impact, separate from net income." },
            { text: "An increase in net income", explanation: "NWC changes live on the cash flow statement, not the income statement — they don't directly move net income." },
          ] },
          { q: "Days Payable Outstanding (DPO) measures:", a: "How long, on average, the company takes to pay its own suppliers", explanation: "DPO is the mirror image of DSO — instead of measuring how fast customers pay the company, it measures how slowly (or quickly) the company pays its own vendors.", options: [
            { text: "How long inventory sits before being sold", explanation: "That's Days Inventory Outstanding (DIO), a different metric entirely." },
            { text: "How long customers take to pay the company", explanation: "That's Days Sales Outstanding (DSO) — the receivables-side metric, not payables." },
            { text: "How long, on average, the company takes to pay its own suppliers", explanation: "Correct — DPO is specifically about the company's own payment timing to vendors." },
            { text: "The company's average debt maturity", explanation: "Debt maturity is a completely separate financing concept, unrelated to trade payables timing." },
          ] },
        ],
      },
      {
        id: "build-3",
        title: "The debt schedule and the interest circularity",
        minutes: 7,
        body: [
          "A debt schedule rolls forward each tranche of debt: beginning balance, plus any drawdowns, minus any mandatory or optional repayments, equals ending balance. Interest expense is typically computed on the AVERAGE of beginning and ending balance for the period — which, as covered in the modeling-best-practice module, is exactly what creates the interest circularity.",
          "The 'cash available for debt repayment' concept is what closes the loop with the rest of the model: cash flow from operations, less mandatory CapEx, less mandatory debt amortization, equals discretionary cash flow — often swept entirely toward paying down a revolver or term loan (a 'cash flow sweep'), which is what makes ending debt balance dependent on the very net income figure that interest expense feeds into.",
          "In an interview, being able to say 'the debt schedule and income statement are circularly linked through average-balance interest, and I'd handle that with a circularity breaker or iterative calculation' signals you've actually built one — not just read the definition.",
        ],
        challenge: "A term loan has a beginning balance of $400M this year, no drawdowns, and a mandatory $0 scheduled amortization (bullet structure). At a 5% interest rate, what is this year's interest expense if computed on the average balance? Would the answer differ if computed on the beginning balance only?",
        exampleOutput: "With no repayment, beginning and ending balance are both $400M, so average balance = $400M either way, and interest = 5% x $400M = $20M regardless of method in this specific no-amortization case. (The average-vs-beginning distinction only produces a different number once the balance actually changes during the year — e.g. when a cash flow sweep pays some of it down.)",
        quiz: [
          { q: "What is a 'cash flow sweep'?", a: "Using discretionary free cash flow to pay down outstanding debt (often a revolver) beyond any mandatory amortization", explanation: "A sweep automatically directs leftover cash toward debt paydown, which is exactly the mechanism that ties ending debt balance to the company's actual cash generation each period.", options: [
            { text: "A one-time bulk repayment of ALL outstanding debt", explanation: "A sweep is an ongoing mechanism applied each period based on available cash, not necessarily a single full payoff event." },
            { text: "Using discretionary free cash flow to pay down outstanding debt (often a revolver) beyond any mandatory amortization", explanation: "Correct — this is the standard definition of a cash flow sweep." },
            { text: "Refinancing debt at a lower interest rate", explanation: "Refinancing changes the terms of debt; a sweep is about using cash to reduce the balance, a different mechanism entirely." },
            { text: "Converting debt into equity", explanation: "That's a debt-to-equity conversion or restructuring event, unrelated to a cash flow sweep." },
          ] },
          { q: "In a debt schedule with a cash flow sweep, why does ending debt balance depend on net income?", a: "Because discretionary cash available to sweep toward debt paydown is derived from cash flow from operations, which starts from net income", explanation: "The sweep amount comes out of the cash flow bridge, which begins with net income — so a change in profitability changes how much debt gets paid down, which changes the ending balance.", options: [
            { text: "It doesn't — debt balances are always fixed inputs", explanation: "In a model with a cash flow sweep, the ending balance is explicitly a function of cash generated, not a fixed input." },
            { text: "Because discretionary cash available to sweep toward debt paydown is derived from cash flow from operations, which starts from net income", explanation: "Correct — this is the actual dependency chain." },
            { text: "Because banks require net income as collateral", explanation: "This isn't how collateral or lending mechanics work — it's a modeling dependency, not a legal requirement." },
            { text: "Because interest rates are set based on net income", explanation: "Interest rates are typically set by credit terms/spreads at loan origination, not recalculated from net income each period." },
          ] },
        ],
      },
    ],
  },
  {
    id: "cfi-corpfin",
    title: "CFI: Corporate Finance Core",
    icon: "📐",
    color: "#4c1d95",
    light: "#f5f3ff",
    description: "CAPM, WACC, capital structure, and the ROIC-vs-WACC test that tells you whether a company is actually creating value.",
    coopModule: "Financial modeling & valuation track (independent — not affiliated with CFI)",
    lessons: [
      {
        id: "corp-1",
        title: "CAPM and the cost of equity",
        minutes: 6,
        body: [
          "The Capital Asset Pricing Model (CAPM) estimates the return equity investors require to hold a company's stock: Cost of Equity = Risk-Free Rate + Beta x Market Risk Premium. The risk-free rate is usually a long-term government bond yield. Beta measures the stock's volatility relative to the overall market (beta of 1.0 moves with the market; above 1.0 is more volatile; below 1.0 is less). The market risk premium is the extra return investors demand for holding stocks over risk-free bonds.",
          "CAPM is a required input to WACC (next lesson) and therefore to almost every valuation. It's also one of the most commonly hand-waved numbers in finance — an interviewer who asks you to actually compute it, instead of quoting '8% cost of equity' from memory, is testing whether you understand the model or just memorized an output.",
          "A key judgment point: beta itself is an estimate, usually a regression of a stock's historical returns against the market, or an average of comparable companies' betas (often 'unlevered' to strip out capital structure differences, then 're-levered' to the target company's own debt/equity mix). A model that hardcodes a cost of equity without showing this derivation invites exactly the question you don't want in an interview: 'where did that number come from?'",
        ],
        challenge: "Risk-free rate is 4.2%, beta is 1.15, and the market risk premium is 5.5%. Compute the cost of equity using CAPM. Then explain in one sentence what it would mean for beta to be 1.15 rather than 1.0.",
        exampleOutput: "Cost of equity = 4.2% + 1.15 x 5.5% = 4.2% + 6.325% = 10.525%. A beta of 1.15 means the stock is roughly 15% more volatile than the overall market — when the market moves 10%, this stock tends to move about 11.5%.",
        quiz: [
          { q: "The CAPM formula for cost of equity is:", a: "Risk-Free Rate + Beta x Market Risk Premium", explanation: "This is the exact CAPM identity — it decomposes required equity return into a risk-free baseline plus a risk-adjusted premium.", options: [
            { text: "Risk-Free Rate + Market Risk Premium (beta ignored)", explanation: "Dropping beta would treat every stock as equally risky as the overall market, which defeats the purpose of CAPM." },
            { text: "Risk-Free Rate + Beta x Market Risk Premium", explanation: "Correct — this is the CAPM formula." },
            { text: "Beta x Risk-Free Rate", explanation: "This formula doesn't use the market risk premium at all and isn't how CAPM works." },
            { text: "(Risk-Free Rate + Market Risk Premium) / Beta", explanation: "Beta multiplies the risk premium in CAPM; it doesn't divide the sum." },
          ] },
          { q: "A stock has a beta of 0.7. What does that imply about its volatility relative to the market?", a: "It tends to be less volatile than the market — moving about 70% as much as the market does", explanation: "A beta below 1.0 means the stock's returns historically move less dramatically than the overall market's — it's the mathematically defined interpretation of beta.", options: [
            { text: "It moves in the opposite direction of the market", explanation: "That would require a NEGATIVE beta — 0.7 is positive, just less volatile, not inversely correlated." },
            { text: "It tends to be less volatile than the market — moving about 70% as much as the market does", explanation: "Correct — this is exactly what a sub-1.0 beta means." },
            { text: "It has no relationship to the market at all", explanation: "A beta of 0 (not 0.7) would indicate no relationship — 0.7 indicates a real, just muted, positive relationship." },
            { text: "It's a riskier stock than one with a beta of 1.2", explanation: "The opposite is true — a lower beta (0.7 vs 1.2) indicates lower relative volatility/risk, not higher." },
          ] },
        ],
      },
      {
        id: "corp-2",
        title: "Building WACC",
        minutes: 7,
        body: [
          "The Weighted Average Cost of Capital (WACC) is the blended return a company must generate on its assets to satisfy both its equity investors and its debt holders: WACC = (E / (D+E)) x Cost of Equity + (D / (D+E)) x Cost of Debt x (1 − Tax Rate).",
          "Three things trip people up: (1) the weights (E/(D+E) and D/(D+E)) should use MARKET values, not book values — market cap for equity, and typically the book value of debt as a reasonable proxy since debt trades closer to par than equity trades to book. (2) Cost of debt should be pre-tax, THEN tax-effected in the formula — interest expense is tax-deductible, which is why debt is structurally cheaper than equity on an after-tax basis. (3) Cost of equity comes from CAPM (previous lesson) — it should never be a number pulled from thin air.",
          "This is exactly the drill in this track that grades whether you actually built the formula: a WACC cell that just says '9.3%' with no visible CAPM derivation or capital-structure weighting hasn't demonstrated the skill — it's memorized an answer.",
        ],
        challenge: "Cost of equity (from CAPM) is 10.525%. Pre-tax cost of debt is 6.0%. Tax rate is 25%. Market value of equity is $2,400M and market value of debt is $600M. Compute WACC.",
        exampleOutput: "After-tax cost of debt = 6.0% x (1 − 25%) = 4.5%. Total capital = $3,000M. Weight of equity = 80%, weight of debt = 20%. WACC = 80% x 10.525% + 20% x 4.5% = 8.42% + 0.9% = 9.32%.",
        quiz: [
          { q: "In the WACC formula, why is cost of debt multiplied by (1 − tax rate) but cost of equity is not?", a: "Interest expense is tax-deductible, so debt's true cost to the company is lower than its stated rate; dividends (equity's 'cost') are not tax-deductible", explanation: "The tax shield on interest expense reduces debt's effective cost to the company — there's no equivalent tax benefit for returns paid to equity holders, so no tax adjustment applies there.", options: [
            { text: "Because debt is always riskier than equity", explanation: "Debt is generally considered LESS risky than equity (it has priority in bankruptcy), which is the opposite of this reasoning, and it's not why the tax adjustment exists anyway." },
            { text: "Interest expense is tax-deductible, so debt's true cost to the company is lower than its stated rate; dividends (equity's 'cost') are not tax-deductible", explanation: "Correct — this is exactly the tax-shield rationale." },
            { text: "It's an arbitrary convention with no underlying logic", explanation: "The (1-tax rate) adjustment has a specific, well-defined rationale: the interest tax shield." },
            { text: "Because cost of equity is always higher than cost of debt", explanation: "While cost of equity is usually higher, that fact alone doesn't explain WHY only debt gets the tax adjustment — the reason is the deductibility of interest specifically." },
          ] },
          { q: "WACC capital-structure weights (E/(D+E) and D/(D+E)) should generally be based on:", a: "Market values — market capitalization for equity, and typically book value of debt as a close proxy", explanation: "Market value reflects what the capital actually costs to raise TODAY; book value of equity can be wildly stale relative to market cap, which is why the convention uses market weights.", options: [
            { text: "Book values for both debt and equity", explanation: "Book value of equity often diverges significantly from market value, which would misstate the true capital-structure weights." },
            { text: "Market values — market capitalization for equity, and typically book value of debt as a close proxy", explanation: "Correct — this is the standard convention." },
            { text: "Whatever values make WACC come out lowest", explanation: "Weights should reflect the company's actual capital structure, not be reverse-engineered to hit a target output — that would be a fabricated, misleading result." },
            { text: "Historical average weights over the past 10 years", explanation: "WACC should reflect the CURRENT capital structure and market pricing, not a long historical average that may no longer be relevant." },
          ] },
        ],
      },
      {
        id: "corp-3",
        title: "ROIC vs. WACC: the value-creation test",
        minutes: 6,
        body: [
          "Return on Invested Capital (ROIC) measures how much after-tax operating profit a company generates per dollar of capital invested in the business: ROIC = NOPAT / Invested Capital. WACC (previous lesson) measures how much return that capital actually costs to raise. The comparison between the two is arguably the single most important sentence in corporate finance: if ROIC > WACC, the company creates value with every dollar it invests; if ROIC < WACC, it destroys value even while reporting positive accounting profit.",
          "This is why a growing, profitable company can still be a bad investment: growth is only valuable if it's growth funded at a return above the cost of capital. A company reinvesting aggressively at ROIC below WACC is compounding value destruction, not building a moat — profitable on the income statement, value-destructive on a capital basis.",
          "In an interview or a real valuation, citing ROIC vs. WACC (rather than just revenue growth or margin trends) signals you're evaluating capital allocation, not just operating performance — exactly the lens a wealth-management or CFA-track interviewer is listening for.",
        ],
        challenge: "Company A has ROIC of 14% and WACC of 9%, and is reinvesting heavily to grow. Company B has ROIC of 6% and WACC of 9%, and is also reinvesting heavily to grow. Both report rising revenue and profits. Which company's growth is actually creating shareholder value, and why?",
        exampleOutput: "Company A: ROIC (14%) exceeds WACC (9%), so every reinvested dollar earns more than its cost of capital — growth is value-creating. Company B: ROIC (6%) is below WACC (9%) — despite rising revenue and profit, each reinvested dollar earns less than it costs to raise, so the growth is actually destroying shareholder value even though the income statement looks healthy.",
        quiz: [
          { q: "If a company's ROIC is below its WACC, what does that imply about its growth investments?", a: "The growth is destroying value — the company earns less on invested capital than that capital costs to raise", explanation: "ROIC below WACC means every incremental dollar invested returns less than investors require for the risk taken — reinvesting more just compounds the value destruction, regardless of top-line growth.", options: [
            { text: "The growth is automatically value-creating because revenue is rising", explanation: "Rising revenue alone says nothing about whether the return on that growth exceeds its cost — that's exactly the trap ROIC vs. WACC is designed to expose." },
            { text: "The growth is destroying value — the company earns less on invested capital than that capital costs to raise", explanation: "Correct — this is the core ROIC-vs-WACC insight." },
            { text: "The company should raise more debt to fix it", explanation: "Raising more debt doesn't fix a fundamentally low-return business — it may even increase risk without addressing the underlying ROIC problem." },
            { text: "It has no implication — ROIC and WACC are unrelated metrics", explanation: "They are directly comparable by design — ROIC vs. WACC is precisely how you judge whether invested capital creates or destroys value." },
          ] },
          { q: "What does ROIC measure?", a: "After-tax operating profit generated per dollar of capital invested in the business", explanation: "ROIC = NOPAT / Invested Capital — it isolates how efficiently the core operating business turns invested capital into after-tax operating profit, independent of financing structure.", options: [
            { text: "The company's stock price growth", explanation: "Stock price movement is a market outcome influenced by many factors beyond operating capital efficiency — ROIC is a fundamentals-based operating metric." },
            { text: "After-tax operating profit generated per dollar of capital invested in the business", explanation: "Correct — this is the precise definition of ROIC." },
            { text: "The interest rate a company pays on its debt", explanation: "That's cost of debt, one input into WACC — a completely different metric from ROIC." },
            { text: "Total revenue divided by total assets", explanation: "That's closer to asset turnover — ROIC specifically uses NOPAT (after-tax operating profit) over invested capital, not revenue over total assets." },
          ] },
        ],
      },
    ],
  },
  {
    id: "cfi-valuation",
    title: "CFI: Valuation: DCF, Comps & Precedents",
    icon: "💹",
    color: "#991b1b",
    light: "#fef2f2",
    description: "Unlevered free cash flow, terminal value two ways, comparable companies, precedent transactions, and the football field that ties them together.",
    coopModule: "Financial modeling & valuation track (independent — not affiliated with CFI)",
    lessons: [
      {
        id: "val-1",
        title: "Unlevered free cash flow and the DCF skeleton",
        minutes: 7,
        body: [
          "A discounted cash flow (DCF) values a company by projecting its unlevered free cash flow (UFCF) — cash available to ALL capital providers, before any financing decisions — and discounting it back to today at WACC. UFCF = EBIT x (1 − Tax Rate) [= NOPAT] + D&A − CapEx − Increase in Net Working Capital.",
          "'Unlevered' is the key word: UFCF deliberately excludes interest expense, because the DCF is valuing the whole enterprise (debt and equity together), not just the equity slice. Discount unlevered cash flows at WACC (the blended cost of capital) to get Enterprise Value; only later, if you need equity value, do you subtract net debt.",
          "A common mistake: discounting LEVERED free cash flow (which includes interest and debt paydowns) at WACC. That mismatches the cash flow definition to the discount rate and double-counts the cost of debt. Levered FCF, if used at all, should be discounted at cost of equity to get equity value directly — a different (and less common in FMVA-style models) approach entirely.",
        ],
        challenge: "EBIT is $300M, tax rate is 25%, D&A is $80M, CapEx is $100M, and the increase in net working capital is $20M. Compute unlevered free cash flow.",
        exampleOutput: "NOPAT = $300M x (1 − 25%) = $225M. UFCF = $225M + $80M − $100M − $20M = $185M.",
        quiz: [
          { q: "Why does unlevered free cash flow exclude interest expense?", a: "Because the DCF values the entire enterprise (debt and equity capital together), and interest is a cost specific to the debt-financing decision, not the operating business", explanation: "Including interest would mix a financing decision into an operating-cash-flow measure meant to represent value available to ALL capital providers before any financing choice.", options: [
            { text: "Because interest expense doesn't really exist", explanation: "Interest expense is a real cash cost — it's excluded from UFCF specifically because of what the DCF is trying to measure, not because it's fictional." },
            { text: "Because the DCF values the entire enterprise (debt and equity capital together), and interest is a cost specific to the debt-financing decision, not the operating business", explanation: "Correct — this is exactly why UFCF is 'unlevered.'" },
            { text: "Because interest is already included in D&A", explanation: "Interest and D&A are entirely separate line items with no overlap — this isn't the reason for the exclusion." },
            { text: "Because taxes make interest expense irrelevant", explanation: "Interest expense actually reduces taxable income (creating a tax shield) — it's not irrelevant, it's deliberately excluded from an unlevered measure by design." },
          ] },
          { q: "What is the correct discount rate to use for unlevered free cash flow?", a: "WACC", explanation: "Because UFCF represents cash flow available to both debt and equity holders, it must be discounted at the blended cost of both — WACC — not just the cost of equity or cost of debt alone.", options: [
            { text: "Cost of equity alone", explanation: "Cost of equity alone would understate the enterprise-level discount rate since it ignores the debt holders' claim on the same cash flows." },
            { text: "WACC", explanation: "Correct — WACC blends both capital providers' required returns, matching UFCF's enterprise-wide scope." },
            { text: "The risk-free rate", explanation: "The risk-free rate ignores all business and financial risk — it would badly overstate the value of risky operating cash flows." },
            { text: "Cost of debt alone", explanation: "Cost of debt alone ignores the (typically higher) return equity holders require, understating the true blended cost of capital." },
          ] },
        ],
      },
      {
        id: "val-2",
        title: "Terminal value: perpetuity growth vs. exit multiple",
        minutes: 8,
        body: [
          "A DCF can't project cash flows forever, so terminal value (TV) captures everything beyond the explicit forecast period (typically 5 years) in one lump-sum number. There are two standard methods, and they should broadly agree — if they don't, that's a signal to revisit your assumptions, not to just average them and move on.",
          "Perpetuity Growth Method: TV = Final Year UFCF x (1 + g) / (WACC − g), where g is a long-run growth rate (usually close to long-run GDP or inflation — a company can't grow faster than the economy forever without eventually becoming the entire economy). Exit Multiple Method: TV = Final Year EBITDA x an exit multiple, typically drawn from comparable company trading multiples.",
          "Here's the uncomfortable truth an interviewer wants you to say out loud without flinching: terminal value routinely accounts for 70-80% of total enterprise value in a DCF. That's not a red flag by itself — it's simply what happens when you discount a growing perpetuity — but it does mean the DCF's precision is largely an illusion if you haven't stress-tested WACC and g (this track's sensitivity-table drill exists specifically to make that visible). The two TV methods disagreeing by a wide margin is a real red flag: it usually means your growth rate assumption implies a valuation multiple wildly out of line with how the market actually prices comparable companies — worth reconciling explicitly (the DCF drill in this track has you compute exactly that cross-check) rather than picking whichever number you like better.",
        ],
        challenge: "Final year UFCF is $260.75M, WACC is 9.32%, and long-run growth (g) is 2.5%. Compute terminal value using the perpetuity growth method (undiscounted, i.e. as of the end of the final forecast year).",
        exampleOutput: "TV = $260.75M x 1.025 / (0.0932 − 0.025) = $267.27M / 0.0682 ≈ $3,918.9M. (This is the exact terminal value used in this track's DCF drill — it must then be discounted back 5 years at WACC to get its present value.)",
        quiz: [
          { q: "Why can't the perpetuity growth rate (g) realistically be set higher than long-run GDP or inflation growth?", a: "Because a company growing faster than the overall economy forever would eventually become larger than the economy itself — a mathematical impossibility over an infinite horizon", explanation: "Over a genuinely infinite horizon, any growth rate persistently above the economy's own growth rate implies the company eventually consumes an ever-larger, and eventually impossible, share of total economic output.", options: [
            { text: "Because g must always be lower than the tax rate", explanation: "There's no mathematical relationship between the terminal growth rate and the tax rate — this isn't the constraint." },
            { text: "Because a company growing faster than the overall economy forever would eventually become larger than the economy itself — a mathematical impossibility over an infinite horizon", explanation: "Correct — this is the standard justification for capping terminal growth near GDP/inflation." },
            { text: "Because WACC always equals GDP growth", explanation: "WACC and GDP growth are unrelated figures — WACC is a company-specific cost of capital, not tied to the macroeconomy's growth rate." },
            { text: "It's an arbitrary rule with no real justification", explanation: "It has a specific, well-reasoned justification about long-run economic feasibility, not arbitrary convention." },
          ] },
          { q: "If a DCF's terminal value accounts for 75% of total enterprise value, what is the correct interpretation?", a: "This is normal for a DCF — but it means the valuation is highly sensitive to WACC and terminal growth assumptions, which should be explicitly stress-tested", explanation: "A large terminal-value share is a mathematical consequence of discounting a growing perpetuity, not inherently a flaw — but it does mean small changes in WACC or g swing the valuation dramatically, which is exactly why sensitivity analysis matters here.", options: [
            { text: "The model is definitely broken and should be discarded", explanation: "A large TV share is typical and expected in DCF models — it doesn't by itself indicate an error." },
            { text: "This is normal for a DCF — but it means the valuation is highly sensitive to WACC and terminal growth assumptions, which should be explicitly stress-tested", explanation: "Correct — this is the honest, judgment-driven interpretation an interviewer wants to hear." },
            { text: "It means the explicit forecast period should be deleted entirely", explanation: "The explicit forecast period is still essential — it's the near-term cash flows you have the most visibility into; TV supplements it, it doesn't replace the need for it." },
            { text: "It has no effect on how reliable the valuation is", explanation: "A high TV share directly increases sensitivity to just two assumptions (WACC and g) — that materially affects how much confidence to place in a single-point valuation." },
          ] },
        ],
      },
      {
        id: "val-3",
        title: "Comparable companies, precedent transactions, and the football field",
        minutes: 7,
        body: [
          "Comparable Company Analysis ('comps') values a target by applying the trading multiples of similar public companies to the target's own financial metrics: EV/Revenue, EV/EBITDA, and P/E are the standard three. EV-based multiples (EV/Revenue, EV/EBITDA) are capital-structure-neutral — they value the whole enterprise regardless of how it's financed — which is why they're generally preferred over P/E, which is distorted by differences in leverage and share count across companies that otherwise look similar operationally.",
          "Precedent Transactions Analysis is the same mechanical idea, but the multiples come from prior M&A deals for similar companies rather than public trading prices — and they typically run HIGHER than trading comps, because acquirers pay a control premium (the extra amount a buyer pays for the right to control the company, not just own a minority stake in its cash flows).",
          "A football field chart takes the valuation RANGE (low-mid-high) from every method — DCF (both terminal value approaches), trading comps, and precedent transactions — and lays them side by side as horizontal bars. The point isn't to average them into one number; it's to show where the methods agree (a tight cluster = high confidence) and where they diverge (a wide spread = a judgment call the analyst needs to defend, usually driven by different assumptions about growth, control premiums, or which comps are truly comparable).",
        ],
        challenge: "A set of comps trades at a median EV/EBITDA of 9.4x and a median P/E of 17.2x. The target's EBITDA is $320M and net income is $150M. Using EV/EBITDA, the implied EV is $3,008M; after subtracting $250M of net debt, implied equity value is $2,758M. Using P/E, implied equity value is 17.2 x $150M = $2,580M directly. Why might the P/E-implied value differ more across comps than the EV/EBITDA-implied value?",
        exampleOutput: "P/E is sensitive to each comp's own capital structure (leverage) and share count — two operationally similar companies can have very different P/E ratios purely because one carries more debt (which increases financial risk and EPS volatility) or has bought back more shares. EV/EBITDA sits above the capital structure entirely, so it isolates operating performance and tends to cluster more tightly across truly comparable companies.",
        quiz: [
          { q: "Why are EV-based multiples (like EV/EBITDA) generally considered more reliable for comps than P/E?", a: "EV-based multiples are capital-structure-neutral, isolating operating performance, while P/E is distorted by differences in leverage and share count across companies", explanation: "Two operationally identical companies can post very different P/E ratios purely due to financing choices — EV/EBITDA strips that out by valuing the whole enterprise before any debt/equity split.", options: [
            { text: "P/E multiples are always lower than EV/EBITDA multiples", explanation: "There's no fixed relationship between the numeric size of P/E and EV/EBITDA multiples — the reliability difference is about what each multiple isolates, not which number is bigger." },
            { text: "EV-based multiples are capital-structure-neutral, isolating operating performance, while P/E is distorted by differences in leverage and share count across companies", explanation: "Correct — this is exactly why EV multiples are preferred in comps work." },
            { text: "P/E cannot be calculated for public companies", explanation: "P/E is a completely standard, widely available metric for public companies — the issue is comparability, not calculability." },
            { text: "EV/EBITDA ignores taxes entirely, making it more accurate", explanation: "Ignoring taxes isn't what makes EV/EBITDA preferable — its advantage is capital-structure neutrality, and EBITDA itself is a pre-tax, pre-interest measure by definition regardless of reliability arguments." },
          ] },
          { q: "Why do precedent transaction multiples typically run higher than public trading comps?", a: "Acquirers pay a control premium — extra value for the right to control the company's decisions and cash flows, not just hold a minority stake", explanation: "Buying a controlling stake lets an acquirer make decisions (cut costs, redirect strategy, extract synergies) that a passive minority shareholder can't — that control right is worth paying up for.", options: [
            { text: "Precedent deals always happen in bull markets", explanation: "Precedent transaction premiums are structural (control rights), not simply a function of overall market conditions at the time of any given deal." },
            { text: "Acquirers pay a control premium — extra value for the right to control the company's decisions and cash flows, not just hold a minority stake", explanation: "Correct — this is the standard explanation for the premium." },
            { text: "Public trading comps always undervalue companies due to market inefficiency", explanation: "The premium in precedent deals isn't evidence that public markets are broadly mispricing stocks — it specifically reflects the value of acquiring control, a distinct economic right." },
            { text: "Precedent transactions use a different currency convention", explanation: "Currency conventions aren't the source of the premium — the control-premium rationale is." },
          ] },
        ],
      },
    ],
  },
  {
    id: "cfi-sensitivity",
    title: "CFI: Sensitivity & Scenario Analysis",
    icon: "🎚️",
    color: "#0e7490",
    light: "#ecfeff",
    description: "Two-variable sensitivity tables and structured scenario design — how you defend a single-point valuation under questioning.",
    coopModule: "Financial modeling & valuation track (independent — not affiliated with CFI)",
    lessons: [
      {
        id: "sens-1",
        title: "One- and two-variable sensitivity tables",
        minutes: 6,
        body: [
          "A sensitivity table shows how an output (like Enterprise Value) changes as one or two inputs vary, holding everything else constant. A one-variable table flexes a single assumption (e.g. WACC from 7% to 11%) against the output. A two-variable table — the standard for a DCF — puts one variable down the rows (typically WACC) and another across the columns (typically terminal growth rate g), producing a grid of outcomes.",
          "The value of the table isn't the center cell (your base case) — it's the SPREAD. A DCF that swings from $2.5B to $6.4B across a plausible WACC/g range (this track's sensitivity drill produces almost exactly that range) tells you the single 'point estimate' you'd put in a pitch deck is really a wide probability distribution wearing a precise-looking number.",
          "This is also why 'what's your valuation?' should almost never get a single-number answer in an interview or a real deal discussion. The strong answer states a range, names the two assumptions the range is most sensitive to, and states why — that's the difference between reciting a DCF output and understanding what a DCF actually is.",
        ],
        challenge: "A two-variable sensitivity table shows Enterprise Value ranging from $2,470.8M (WACC 11%, g 1.5%) to $6,410.3M (WACC 7%, g 3.5%), with a base case near $3,535.4M (WACC 9%, g 2.5%). In two sentences, explain what this spread tells a reviewer about how much confidence to place in the $3,535.4M base case alone.",
        exampleOutput: "The nearly 2.6x spread between the low and high corners shows the valuation is extremely sensitive to just two assumptions, so the $3,535.4M base case shouldn't be treated as a precise number — it's the midpoint of a wide, legitimate range. A reviewer should ask which end of the WACC/g range is most defensible for this specific company rather than anchoring on the single base-case output.",
        quiz: [
          { q: "In a two-variable DCF sensitivity table, what typically goes on the rows and columns?", a: "WACC on one axis, terminal growth rate (g) on the other", explanation: "These are the two assumptions terminal value (and therefore total enterprise value) is most sensitive to, which is exactly why they're the standard pairing for a DCF sensitivity table.", options: [
            { text: "Revenue and COGS", explanation: "While relevant to the model, these aren't the standard pairing for a DCF-specific sensitivity table — WACC and g are, because of their outsized effect on terminal value." },
            { text: "WACC on one axis, terminal growth rate (g) on the other", explanation: "Correct — this is the standard DCF sensitivity table pairing." },
            { text: "Tax rate and share count", explanation: "These have much smaller effects on enterprise value than WACC and g — they're not the standard sensitivity pairing." },
            { text: "Historical revenue for the last two years", explanation: "Historical actuals aren't sensitivity variables at all — sensitivity tables flex forward-looking or discount-rate assumptions." },
          ] },
          { q: "What is the main point of building a sensitivity table, rather than just presenting the single base-case valuation?", a: "It shows how much the valuation depends on a small number of uncertain assumptions, revealing the real range around a single point estimate", explanation: "A single number hides how fragile it is to assumption changes; the table makes that fragility (or robustness) visible and defensible.", options: [
            { text: "To make the model look more sophisticated for a presentation", explanation: "The value is analytical, not decorative — it genuinely changes how much confidence should be placed in any single output." },
            { text: "It shows how much the valuation depends on a small number of uncertain assumptions, revealing the real range around a single point estimate", explanation: "Correct — this is the actual analytical purpose of a sensitivity table." },
            { text: "To replace the base case with a random number from the grid", explanation: "The base case remains the primary reference point; the table contextualizes it, it doesn't replace it with an arbitrary alternative." },
            { text: "Because a single-point valuation is mathematically impossible to compute", explanation: "A single-point valuation IS computable — the issue isn't impossibility, it's that presenting only that number hides its sensitivity to assumptions." },
          ] },
        ],
      },
      {
        id: "sens-2",
        title: "Scenario design: base, upside, downside",
        minutes: 6,
        body: [
          "Where a sensitivity table flexes one or two variables in isolation, a scenario flexes an entire CONSISTENT set of assumptions together — a 'downside case' isn't just lower revenue growth, it's lower growth AND compressed margins AND slower working-capital collection, because a real recession or competitive shock hits multiple line items at once, not one in isolation.",
          "Standard structure: Base case (your best single estimate — not optimistic, not pessimistic), Upside case (a coherent story where several assumptions move favorably together — e.g. faster growth AND margin expansion from operating leverage), Downside case (the mirror image — a coherent bad-outcome story, not just 'growth is 2% lower'). The discipline is INTERNAL CONSISTENCY: every assumption in a given scenario should be justifiable by the same underlying story.",
          "In modeling terms, this is usually built with a scenario 'switch' cell (e.g. 1 = base, 2 = upside, 3 = downside) that drives a lookup (CHOOSE-style or IF-based) across every input in the model simultaneously, so flipping one switch changes the entire model consistently — rather than the analyst manually flexing ten different assumptions and inevitably forgetting one or leaving an inconsistency.",
        ],
        challenge: "Describe a downside scenario for a retailer facing a slowing economy: name three assumptions that should move together (not just one), and explain in one sentence why moving only one of them would be an internally inconsistent scenario.",
        exampleOutput: "Three linked assumptions: slower revenue growth (fewer consumers spending), compressed gross margin (heavier discounting to move inventory), and slower AR/inventory turnover (customers and retailers alike delaying payment and destocking more cautiously). Moving only revenue growth down while leaving margins and working capital untouched would imply a recession that somehow doesn't affect pricing power or customer payment behavior — an inconsistent, cherry-picked story.",
        quiz: [
          { q: "What is the key discipline that separates a real 'scenario' from just changing one assumption in a sensitivity table?", a: "Internal consistency — every assumption that moves in the scenario should be justifiable by the same underlying story", explanation: "A scenario is a coherent narrative (e.g. a recession) that plausibly moves several related assumptions together, not an isolated flex of a single number.", options: [
            { text: "A scenario must always use round numbers", explanation: "The precision of numbers used has nothing to do with what defines a scenario versus a sensitivity flex." },
            { text: "Internal consistency — every assumption that moves in the scenario should be justifiable by the same underlying story", explanation: "Correct — this is exactly what distinguishes a real scenario from an isolated sensitivity flex." },
            { text: "A scenario can only ever change revenue, never costs", explanation: "Scenarios typically move MULTIPLE related line items together (revenue, margins, working capital) — restricting to revenue alone is the opposite of good scenario design." },
            { text: "There is no real difference between the two", explanation: "There is a meaningful difference: a sensitivity table isolates one or two variables mechanically, while a scenario tells a coherent, multi-assumption story." },
          ] },
          { q: "In a model with a scenario switch cell (e.g. 1=base, 2=upside, 3=downside), what is the main benefit of that structure?", a: "Flipping one switch consistently updates every relevant assumption at once, preventing the analyst from forgetting to change one input and creating an inconsistent scenario", explanation: "Centralizing the scenario logic in a single switch eliminates the risk of manually updating ten assumptions and missing one, which would silently blend two different scenario stories together.", options: [
            { text: "It makes the spreadsheet file smaller", explanation: "File size isn't the purpose here — the benefit is consistency and reducing the risk of a manual, error-prone update process." },
            { text: "Flipping one switch consistently updates every relevant assumption at once, preventing the analyst from forgetting to change one input and creating an inconsistent scenario", explanation: "Correct — this is the practical benefit of a centralized scenario switch." },
            { text: "It removes the need for a base case entirely", explanation: "The base case is still one of the scenario options selectable via the switch — it isn't eliminated, it's one of the choices." },
            { text: "It automatically determines which scenario is most likely to occur", explanation: "The switch mechanically applies whichever scenario is selected — it doesn't forecast probability or tell you which scenario is most likely." },
          ] },
        ],
      },
    ],
  },
];
