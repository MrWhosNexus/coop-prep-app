// Series 65 (Uniform Investment Adviser Law Examination) — practice question bank
// Additional items for the ECONOMIC FACTORS AND BUSINESS INFORMATION section.
// Same quiz-item shape as data/certs/series65-bank.js: {id, section, q, a, explanation, options:[{text, explanation}]}.
// section: "economic" — folded into SERIES65_BANK by a merge step.
//
// Batch 2 of 2 for this section. Biased toward the second slice of the topic scope —
// financial reporting/analysis ratios and quantitative methods not already covered by
// series65-bank.js or series65-bank-economic.js: ROE, diluted vs. basic EPS, net profit
// margin, operating margin, times interest earned, book value per share, free cash flow,
// inventory turnover, days sales outstanding, FIFO vs. LIFO under inflation, the accrual
// matching principle, audit opinion meaning, EBITDA, dividend coverage ratio, geometric
// vs. arithmetic mean returns, goodwill recognition, unearned/deferred revenue, the
// two-standard-deviation (~95%) empirical rule, the Sortino ratio, and the U.S. GAAP
// cash-flow classification of dividends paid.
//
// NOTE for future batches: the leverage->ROE/ROA effect (s65b-eco-74), the coefficient
// of variation (s65b-cli-72), time- vs. dollar-weighted return (s65b-cli-38/39), and
// "diversification kills unsystematic, not systematic, risk" (s65b-cli-08, s65-cl-x110)
// are ALREADY in the bank. Drafts of those four items were cut from this file for that
// reason. They pass the 0.8 Jaccard near-duplicate test purely because the wording
// differs — the test is lexical and cannot see a reworded repeat. Check the concept,
// not just the score.

export const S65_ECONOMIC_X2 = [
  {
    id: "s65-ec-x201",
    section: "economic",
    q: "Return on equity (ROE) is calculated as:",
    a: "Net income ÷ average shareholders' equity",
    explanation: "ROE measures how efficiently a company generates profit from the capital its owners have invested, and — unlike ROA — is directly affected by the company's use of debt financing.",
    options: [
      { text: "Net income ÷ average shareholders' equity", explanation: "Correct - ROE isolates profitability relative to the equity base, making it sensitive to financial leverage." },
      { text: "Net income ÷ total assets", explanation: "This is return on assets (ROA), which measures profitability relative to the full asset base regardless of how it was financed." },
      { text: "Net income ÷ total revenue", explanation: "This is net profit margin, a measure of profitability per dollar of sales, not per dollar of equity capital." },
      { text: "Operating income ÷ total assets", explanation: "This is closer to operating return on assets; it does not isolate the shareholders' equity base." },
    ],
  },
  {
    id: "s65-ec-x202",
    section: "economic",
    q: "Compared with a company's basic earnings per share, its diluted earnings per share:",
    a: "Is never higher, because it assumes dilutive convertible securities, options, and warrants are converted, increasing the share count in the denominator",
    explanation: "Diluted EPS answers 'what would EPS look like if everything that could become common stock did?' Because securities that would raise EPS are anti-dilutive and excluded from the calculation, diluted EPS is always less than or equal to basic EPS — never greater.",
    options: [
      { text: "Is never higher, because it assumes dilutive convertible securities, options, and warrants are converted, increasing the share count in the denominator", explanation: "Correct - the larger assumed share count spreads earnings across more shares, so diluted EPS is at most equal to basic EPS." },
      { text: "Is never lower, because assumed conversion eliminates the related interest and preferred dividend obligations, raising the numerator", explanation: "Assumed conversion can add back interest to the numerator, but the accompanying increase in the share count dominates — any security whose conversion would raise EPS is anti-dilutive and is excluded entirely." },
      { text: "Is identical to basic EPS for every company whose common stock is publicly traded", explanation: "The two figures differ whenever a company has dilutive securities outstanding; being publicly traded has nothing to do with whether such securities exist." },
      { text: "Replaces net income in the numerator with cash flow from operations", explanation: "Both basic and diluted EPS use earnings available to common shareholders in the numerator; neither substitutes a cash-flow figure." },
    ],
  },
  {
    id: "s65-ec-x203",
    section: "economic",
    q: "A company's net profit margin is calculated as:",
    a: "Net income ÷ total revenue",
    explanation: "Net profit margin shows what share of each sales dollar ultimately becomes bottom-line profit after all expenses, interest, and taxes.",
    options: [
      { text: "Net income ÷ total revenue", explanation: "Correct - net profit margin expresses net income as a percentage of sales." },
      { text: "Gross profit ÷ total revenue", explanation: "This is gross profit margin, calculated before operating expenses, interest, and taxes are deducted." },
      { text: "Net income ÷ total assets", explanation: "This is return on assets (ROA), not a margin-on-sales measure." },
      { text: "Operating income ÷ total revenue", explanation: "This is operating margin, calculated before interest and taxes are deducted." },
    ],
  },
  {
    id: "s65-ec-x204",
    section: "economic",
    q: "Operating margin differs from gross profit margin in that operating margin:",
    a: "Also deducts operating expenses, such as SG&A, beyond just the cost of goods sold",
    explanation: "Gross margin only removes cost of goods sold; operating margin goes a step further by also deducting selling, general, and administrative expenses, giving a fuller picture of core operating profitability.",
    options: [
      { text: "Also deducts operating expenses, such as SG&A, beyond just the cost of goods sold", explanation: "Correct - operating margin reflects earnings after both cost of goods sold and operating expenses, before interest and taxes." },
      { text: "Excludes the cost of goods sold entirely", explanation: "Operating margin still reflects cost of goods sold; it deducts additional expenses on top of it, not instead of it." },
      { text: "Is calculated after interest expense and income taxes are deducted", explanation: "A margin calculated after interest and taxes is net profit margin, not operating margin." },
      { text: "Ignores revenue in the denominator", explanation: "Operating margin is still expressed as a percentage of revenue, like gross and net margin." },
    ],
  },
  {
    id: "s65-ec-x205",
    section: "economic",
    q: "The times interest earned (interest coverage) ratio is calculated as:",
    a: "Earnings before interest and taxes (EBIT) ÷ interest expense",
    explanation: "This ratio shows how many times over a company's operating earnings could cover its interest obligations; a low or declining ratio is a warning sign of rising default risk.",
    options: [
      { text: "Earnings before interest and taxes (EBIT) ÷ interest expense", explanation: "Correct - EBIT is used because it represents earnings available to pay interest before the tax effect is applied." },
      { text: "Net income ÷ interest expense", explanation: "Using net income understates coverage capacity because it has already been reduced by interest and taxes." },
      { text: "EBIT ÷ total long-term debt", explanation: "This would measure earnings relative to the debt principal outstanding, not the ability to cover periodic interest payments." },
      { text: "Interest expense ÷ EBIT", explanation: "This is the inverse of the ratio and would fall, not rise, as a company's ability to cover interest improves." },
    ],
  },
  {
    id: "s65-ec-x206",
    section: "economic",
    q: "Book value per share is calculated as:",
    a: "(Total shareholders' equity minus preferred equity) ÷ number of common shares outstanding",
    explanation: "Book value per share reflects the accounting net worth attributable to each common share, based on the balance sheet, and often differs substantially from a stock's market price.",
    options: [
      { text: "(Total shareholders' equity minus preferred equity) ÷ number of common shares outstanding", explanation: "Correct - preferred equity is subtracted first because preferred shareholders have a prior claim on equity." },
      { text: "Market capitalization ÷ number of common shares outstanding", explanation: "This simply reproduces the current market price per share, not accounting book value." },
      { text: "Total assets ÷ number of common shares outstanding", explanation: "This ignores liabilities and preferred claims entirely, overstating the amount attributable to common shareholders." },
      { text: "Net income ÷ number of common shares outstanding", explanation: "This is earnings per share (EPS), a profitability measure, not a balance-sheet net worth measure." },
    ],
  },
  {
    id: "s65-ec-x207",
    section: "economic",
    q: "Free cash flow (FCF) is most commonly calculated as:",
    a: "Cash flow from operations minus capital expenditures",
    explanation: "Free cash flow represents the cash a company generates after funding the maintenance and growth of its asset base — cash that is genuinely available for debt repayment, dividends, or buybacks.",
    options: [
      { text: "Cash flow from operations minus capital expenditures", explanation: "Correct - subtracting capex from operating cash flow shows what is left over and truly discretionary." },
      { text: "Net income minus dividends paid", explanation: "This calculates retained earnings, an accounting concept unrelated to cash generated or capital spending." },
      { text: "Cash flow from operations minus dividends paid", explanation: "This ignores capital expenditures, which are a necessary use of cash for maintaining the business." },
      { text: "Cash flow from financing minus capital expenditures", explanation: "Financing cash flow reflects debt and equity issuance/repayment, not the operating cash a company generates from its core business." },
    ],
  },
  {
    id: "s65-ec-x208",
    section: "economic",
    q: "A company's inventory turnover ratio is calculated as:",
    a: "Cost of goods sold ÷ average inventory",
    explanation: "Inventory turnover measures how efficiently a company sells and replaces its inventory over a period; comparing it to industry norms flags overstocking (low turnover) or possible stockouts (unusually high turnover).",
    options: [
      { text: "Cost of goods sold ÷ average inventory", explanation: "Correct - dividing COGS (a cost-basis figure) by average inventory shows how many times inventory cycled through during the period." },
      { text: "Net sales ÷ average inventory", explanation: "Using sales rather than COGS mixes in profit margin and distorts the turnover measure." },
      { text: "Average inventory ÷ cost of goods sold", explanation: "This inverted ratio approximates the fraction of a year inventory is held, not the number of turns." },
      { text: "Ending inventory ÷ total assets", explanation: "This would measure inventory as a proportion of total assets, not how quickly it turns over." },
    ],
  },
  {
    id: "s65-ec-x209",
    section: "economic",
    q: "Days sales outstanding (DSO) measures:",
    a: "The average number of days it takes a company to collect payment after a credit sale",
    explanation: "DSO is derived from accounts receivable turnover and signals collection efficiency; a rising DSO can indicate looser credit terms or emerging collection problems.",
    options: [
      { text: "The average number of days it takes a company to collect payment after a credit sale", explanation: "Correct - DSO tracks how long cash remains tied up in accounts receivable." },
      { text: "The average number of days inventory is held before being sold", explanation: "This describes days inventory outstanding, a related but distinct efficiency measure." },
      { text: "The average number of days a company takes to pay its own suppliers", explanation: "This describes days payable outstanding, which relates to accounts payable, not receivables." },
      { text: "The average remaining maturity of a company's outstanding debt", explanation: "This describes a debt-maturity measure, unrelated to the collection of customer receivables." },
    ],
  },
  {
    id: "s65-ec-x210",
    section: "economic",
    q: "During a period of rising prices, a company using FIFO (first-in, first-out) inventory accounting, compared to an identical company using LIFO, will generally report:",
    a: "Higher net income and a higher ending inventory value",
    explanation: "Under FIFO, the oldest (cheaper) costs are expensed as COGS first, which lowers COGS and raises reported net income, while the newer, more expensive costs remain in ending inventory, raising its reported value.",
    options: [
      { text: "Higher net income and a higher ending inventory value", explanation: "Correct - FIFO matches older, lower costs against current sales, inflating both income and the inventory balance during inflation." },
      { text: "Lower net income and a lower ending inventory value", explanation: "This describes the LIFO outcome during inflation, the opposite of what FIFO produces." },
      { text: "The same net income, since inventory costing method has no effect on earnings", explanation: "Inventory costing method directly changes reported COGS and therefore reported net income; it is not neutral during inflation." },
      { text: "Higher net income but a lower ending inventory value", explanation: "FIFO raises both figures together; it does not raise income while lowering the inventory balance." },
    ],
  },
  {
    id: "s65-ec-x211",
    section: "economic",
    q: "Under accrual-basis accounting, the matching principle requires that:",
    a: "Expenses be recognized in the same period as the revenue they helped generate, regardless of when cash actually changes hands",
    explanation: "The matching principle is the core reason net income and cash flow from operations can diverge in a given period — earnings reflect economic activity, not the timing of cash receipts and payments.",
    options: [
      { text: "Expenses be recognized in the same period as the revenue they helped generate, regardless of when cash actually changes hands", explanation: "Correct - matching ties expense recognition to the revenue it supports, independent of cash timing." },
      { text: "Revenue be recognized only when cash is actually received from the customer", explanation: "This describes cash-basis accounting, which accrual accounting and the matching principle specifically depart from." },
      { text: "Expenses be recognized only in the period the cash is paid out", explanation: "This again describes cash-basis timing, not the accrual matching principle." },
      { text: "All revenue and expenses be recognized only at fiscal year-end", explanation: "Matching applies within each reporting period, not just at year-end, and has nothing to do with a single annual recognition date." },
    ],
  },
  {
    id: "s65-ec-x212",
    section: "economic",
    q: "An 'unqualified' (clean) audit opinion on a company's financial statements indicates that:",
    a: "In the auditor's judgment, the statements fairly present the company's financial position in accordance with applicable accounting standards",
    explanation: "An unqualified opinion addresses fair presentation under the applicable accounting framework; it is not a guarantee about the company's future solvency, earnings, or the complete absence of fraud.",
    options: [
      { text: "In the auditor's judgment, the statements fairly present the company's financial position in accordance with applicable accounting standards", explanation: "Correct - this is the scope and purpose of an unqualified audit opinion." },
      { text: "The auditor guarantees the company will not become insolvent", explanation: "An audit opinion says nothing about future solvency; solvent companies can fail afterward and the opinion remains accurate as of its date." },
      { text: "The auditor certifies that management's future earnings projections are accurate", explanation: "Audits address historical financial statements, not forward-looking projections or forecasts." },
      { text: "The auditor guarantees that no fraud has occurred anywhere in the company", explanation: "An audit provides reasonable, not absolute, assurance and is not designed to detect every instance of fraud." },
    ],
  },
  {
    id: "s65-ec-x213",
    section: "economic",
    q: "Analysts often use EBITDA (earnings before interest, taxes, depreciation, and amortization) because it:",
    a: "Approximates a company's core operating cash-generating ability by removing the effects of financing structure, tax situation, and non-cash charges",
    explanation: "EBITDA is a widely used non-GAAP measure for comparing operating performance across companies with different capital structures and tax situations, but it is not itself a cash-flow figure since it ignores capital expenditures and working capital changes.",
    options: [
      { text: "Approximates a company's core operating cash-generating ability by removing the effects of financing structure, tax situation, and non-cash charges", explanation: "Correct - stripping out interest, taxes, depreciation, and amortization isolates operating performance for comparison purposes." },
      { text: "Is a measure required under GAAP for all public company filings", explanation: "EBITDA is a non-GAAP measure; companies may present it voluntarily, but it is not a required GAAP line item." },
      { text: "Always equals a company's cash flow from operations", explanation: "EBITDA excludes changes in working capital and other adjustments captured in operating cash flow, so the two figures commonly differ." },
      { text: "Already factors in capital expenditures needed to maintain the business", explanation: "EBITDA is calculated before capital expenditures are considered, which is a key limitation analysts must adjust for separately." },
    ],
  },
  {
    id: "s65-ec-x214",
    section: "economic",
    q: "The dividend coverage ratio (net income ÷ dividends paid) is best used to assess:",
    a: "Whether a company's current earnings are sufficient to sustain its dividend payments",
    explanation: "A coverage ratio well above 1 suggests ample earnings cushion to maintain the dividend, while a ratio near or below 1 signals the dividend may not be sustainable from current earnings alone.",
    options: [
      { text: "Whether a company's current earnings are sufficient to sustain its dividend payments", explanation: "Correct - the ratio directly compares earnings available against the dividend obligation." },
      { text: "How much of a stock's market price is attributable to its dividend", explanation: "That relationship is captured by dividend yield, which uses share price, not net income, in the calculation." },
      { text: "The company's total income tax liability for the year", explanation: "The ratio has no direct relationship to a company's tax liability." },
      { text: "The company's short-term ability to pay its current liabilities", explanation: "That is the role of liquidity measures like the current or quick ratio, not the dividend coverage ratio." },
    ],
  },
  {
    id: "s65-ec-x215",
    section: "economic",
    q: "When measuring an investment's actual compound growth rate over multiple periods with varying annual returns, which average is the more accurate measure?",
    a: "The geometric mean",
    explanation: "The arithmetic mean overstates true compound growth whenever returns vary from period to period; the geometric mean correctly accounts for the compounding (and volatility drag) effect on ending wealth.",
    options: [
      { text: "The geometric mean", explanation: "Correct - the geometric mean reflects the actual compound rate that reconciles the beginning and ending values." },
      { text: "The arithmetic mean", explanation: "The arithmetic mean simply averages the periodic returns and will overstate the true compound growth rate whenever returns are volatile." },
      { text: "The median return", explanation: "The median identifies a middle observation in the data set; it does not reflect compounding over time." },
      { text: "The modal return", explanation: "The mode identifies the most frequently occurring return; it says nothing about compound growth." },
    ],
  },
  {
    id: "s65-ec-x216",
    section: "economic",
    q: "Goodwill appears as an asset on a company's balance sheet only when the company:",
    a: "Has acquired another business and paid more than the fair value of that business's identifiable net assets",
    explanation: "Goodwill is strictly an acquisition artifact — it is the premium a buyer paid over the fair value of the identifiable net assets it received. A company cannot put a value on its own internally built brand or reputation and record it as goodwill.",
    options: [
      { text: "Has acquired another business and paid more than the fair value of that business's identifiable net assets", explanation: "Correct - the excess of purchase price over the fair value of identifiable net assets acquired is recorded as goodwill." },
      { text: "Has built a valuable brand and customer reputation internally over many years", explanation: "Internally generated goodwill is never recognized on the balance sheet, no matter how valuable the brand actually is — only purchased goodwill is recorded." },
      { text: "Has accumulated retained earnings in excess of its paid-in capital", explanation: "Retained earnings are an equity account reflecting undistributed profits; they have no relationship to goodwill." },
      { text: "Has purchased identifiable intangible assets such as patents or copyrights", explanation: "Patents and copyrights are identifiable intangibles recorded at their own cost on their own line; goodwill is specifically the residual that cannot be identified with any particular asset." },
    ],
  },
  {
    id: "s65-ec-x217",
    section: "economic",
    q: "A company collects $1,200,000 in cash up front for a service contract it will perform evenly over the following twelve months. Under accrual accounting, what does the company record at the moment the cash is received?",
    a: "A liability for unearned (deferred) revenue, with revenue recognized only as the service is actually performed",
    explanation: "Cash received before the work is done creates an obligation, not a sale. The company books a liability and releases it into revenue as it performs — which is why a business can be flush with cash yet report little revenue in the same period.",
    options: [
      { text: "A liability for unearned (deferred) revenue, with revenue recognized only as the service is actually performed", explanation: "Correct - until the service is delivered the company owes either performance or a refund, which is the definition of a liability." },
      { text: "The full $1,200,000 as revenue immediately, because the cash has already been collected", explanation: "This is cash-basis treatment; under accrual accounting the collection of cash does not by itself earn revenue." },
      { text: "An asset called unearned revenue, offset by an equal amount of revenue", explanation: "Unearned revenue is a liability, not an asset — the cash received is the asset, and the offsetting entry is the obligation to perform." },
      { text: "No entry at all until the twelve-month contract has been completed in full", explanation: "The cash receipt must be recorded when it occurs, and revenue is recognized progressively as the service is performed rather than all at once at the end." },
    ],
  },
  {
    id: "s65-ec-x218",
    section: "economic",
    q: "A fund's annual returns are approximately normally distributed with a mean of 8% and a standard deviation of 5%. Under the empirical rule, an adviser should expect the fund's return to fall between -2% and 18% in roughly what proportion of years?",
    a: "About 95% of years (within two standard deviations of the mean)",
    explanation: "-2% to 18% spans the mean of 8% plus or minus two standard deviations (2 x 5% = 10%), and under the empirical rule for a normal distribution, approximately 95% of outcomes fall within two standard deviations of the mean.",
    options: [
      { text: "About 95% of years (within two standard deviations of the mean)", explanation: "Correct - the -2% to 18% range is exactly ±2 standard deviations from the 8% mean, which the empirical rule places at roughly 95% of outcomes." },
      { text: "About 68% of years (within one standard deviation of the mean)", explanation: "One standard deviation from the mean would only span 3% to 13%, a narrower range than the one described." },
      { text: "About 99.7% of years (within three standard deviations of the mean)", explanation: "Three standard deviations from the mean would span -7% to 23%, a wider range than the one described." },
      { text: "It cannot be estimated without knowing the fund's beta", explanation: "The empirical rule relies only on the mean and standard deviation of a normal distribution; beta is not needed to estimate this proportion." },
    ],
  },
  {
    id: "s65-ec-x219",
    section: "economic",
    q: "Unlike the Sharpe ratio, which uses total standard deviation in its denominator, the Sortino ratio uses:",
    a: "Downside deviation, which measures volatility of only the negative (below-target) returns",
    explanation: "The Sortino ratio was developed to address the criticism that the Sharpe ratio penalizes upside volatility just as heavily as downside volatility, which is not how most investors perceive risk.",
    options: [
      { text: "Downside deviation, which measures volatility of only the negative (below-target) returns", explanation: "Correct - by isolating downside volatility, the Sortino ratio does not penalize favorable (upside) swings in return." },
      { text: "Beta, which captures only systematic (market-related) risk", explanation: "A ratio using beta in the denominator instead describes the Treynor ratio, not the Sortino ratio." },
      { text: "Tracking error relative to a benchmark index", explanation: "A ratio built on tracking error describes the information ratio, not the Sortino ratio." },
      { text: "The risk-free rate squared", explanation: "The risk-free rate appears in the numerator of these ratios as part of excess return; it is not squared or used as the denominator." },
    ],
  },
  {
    id: "s65-ec-x220",
    section: "economic",
    q: "Under U.S. GAAP, cash dividends a corporation pays to its shareholders are reported on the statement of cash flows as:",
    a: "A financing activity",
    explanation: "Dividends paid are a return of cash to the providers of capital, so U.S. GAAP classifies them as financing. Note the asymmetry that trips candidates up: interest paid on debt is classified as an OPERATING outflow, even though it too is a payment to a capital provider.",
    options: [
      { text: "A financing activity", explanation: "Correct - U.S. GAAP classifies dividends paid as a financing outflow, alongside stock buybacks and repayments of debt principal." },
      { text: "An operating activity", explanation: "This is the classification U.S. GAAP assigns to interest paid, not to dividends paid — the distinction between the two is the point of the question." },
      { text: "An investing activity", explanation: "Investing activities cover the purchase and sale of long-term assets and securities, not distributions made to the company's own shareholders." },
      { text: "A non-cash transaction disclosed only in the footnotes", explanation: "A cash dividend is an actual cash outflow and appears on the face of the statement; only non-cash items such as stock dividends are relegated to supplemental disclosure." },
    ],
  },
];
