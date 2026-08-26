// Series 65 (Uniform Investment Adviser Law Examination) — practice question bank
// Expansion batch: section "client" (Client Investment Recommendations and Strategies).
// Part 1 of 4 — biased toward client profiling/account authority mechanics, capital
// market theory (MPT/CAPM foundations, diversification mechanics), and portfolio
// construction/investment strategy approaches (dynamic strategies, fixed-income
// maturity structuring). Same quiz-item shape as data/certs/series65-bank.js:
// {id, section, q, a, explanation, options:[{text, explanation}]}.
// Merged into SERIES65_BANK by a separate merge step — this file is NOT imported
// directly by the app yet.

export const S65_CLIENT_X1 = [
  // ---------------------------------------------------------------------
  // CLIENT PROFILING — ACCOUNT AUTHORITY & FIDUCIARY MECHANICS
  // ---------------------------------------------------------------------
  {
    id: "s65-cl-x101",
    section: "client",
    q: "A client grants an adviser 'limited' trading authorization over an account. Compared to a full power of attorney, this limited authorization generally permits the adviser to:",
    a: "Enter buy and sell orders in the account, but not withdraw or transfer cash or securities out of the account",
    explanation: "Limited trading authorization is scoped narrowly to placing trades — it does not extend to moving assets out of the account, which requires broader authority such as a full power of attorney.",
    options: [
      { text: "Enter buy and sell orders in the account, but not withdraw or transfer cash or securities out of the account", explanation: "Correct — this is the defining scope of limited (trading-only) authorization." },
      { text: "Withdraw cash and securities from the account for the adviser's own personal use", explanation: "No form of legitimate trading authorization permits the adviser to take account assets for personal use — that would be conversion, not authorized activity." },
      { text: "Do everything a full power of attorney would allow, including disbursing funds to third parties", explanation: "That broader scope describes a full power of attorney, not limited trading authorization, which is specifically confined to trading." },
      { text: "Change the account's registered owner of record", explanation: "Changing legal ownership of the account isn't within the scope of trading authorization of any kind." },
    ],
  },
  {
    id: "s65-cl-x102",
    section: "client",
    q: "An adviser has been trading a client's account on the instructions of the client's daughter, who holds a valid durable power of attorney over it. The adviser learns that the client has died. The adviser should:",
    a: "Stop acting on the daughter's instructions, because the power of attorney terminated at the client's death, and await documented authority from the executor or personal representative of the estate",
    explanation: "A power of attorney — durable or not — is effective only during the principal's LIFETIME. Durability governs what happens at incapacity, not at death: every POA terminates when the principal dies. Authority over the assets then passes to the executor or personal representative, who must evidence that authority before the adviser accepts further instructions.",
    options: [
      { text: "Stop acting on the daughter's instructions, because the power of attorney terminated at the client's death, and await documented authority from the executor or personal representative of the estate", explanation: "Correct — the agent's authority ends at death, and the estate's representative takes over on proper documentation." },
      { text: "Keep accepting the daughter's instructions indefinitely, because a durable power of attorney survives the principal's death", explanation: "This is the classic misreading of 'durable': durability carries the POA through the principal's INCAPACITY, not past the principal's death, at which point every POA terminates." },
      { text: "Keep accepting the daughter's instructions, but honor only sell orders and not purchases", explanation: "No authority survives at all once the principal dies, so the distinction between buy and sell instructions is irrelevant — neither may be accepted from the former agent." },
      { text: "Retitle the account into the daughter's own name, since she was the one holding the power of attorney", explanation: "Holding a power of attorney conveys authority to act on the principal's behalf, never beneficial ownership; the assets pass under the will or by beneficiary designation, not to the agent." },
    ],
  },
  {
    id: "s65-cl-x103",
    section: "client",
    q: "A 'springing' power of attorney differs from an immediately effective power of attorney in that a springing POA:",
    a: "Only becomes effective upon the occurrence of a specified future event, such as the principal's determined incapacity",
    explanation: "Until the triggering event (commonly a physician's certification of incapacity) occurs, a springing POA's agent has no authority to act — this contrasts with a POA that is effective the moment it's signed.",
    options: [
      { text: "Only becomes effective upon the occurrence of a specified future event, such as the principal's determined incapacity", explanation: "Correct — this delayed, condition-triggered effectiveness is what 'springing' refers to." },
      { text: "Is effective immediately upon signing, exactly like any other power of attorney", explanation: "Immediate effectiveness describes a non-springing POA; the springing feature specifically delays effectiveness until a triggering event." },
      { text: "Can never become effective under any circumstances", explanation: "A springing POA is designed to become effective once its condition is met — it isn't permanently inactive." },
      { text: "Automatically expires after a fixed number of days regardless of the principal's condition", explanation: "The springing feature concerns WHEN the POA starts, not an automatic expiration unrelated to the principal's condition." },
    ],
  },
  {
    id: "s65-cl-x104",
    section: "client",
    q: "An investment adviser recommends that a client roll over assets from an employer-sponsored retirement plan into an IRA the adviser will manage for a fee. Under the adviser's fiduciary duty, this recommendation requires the adviser to:",
    a: "Have a reasonable basis for concluding the rollover is in the client's best interest, considering factors such as the plan's fees and services versus the IRA's",
    explanation: "Because the adviser has a financial incentive to recommend the rollover, the fiduciary duty of care requires a genuine, documented comparison of costs, services, and investment options — not simply defaulting to the option that generates the adviser's fee.",
    options: [
      { text: "Have a reasonable basis for concluding the rollover is in the client's best interest, considering factors such as the plan's fees and services versus the IRA's", explanation: "Correct — this reflects the heightened scrutiny fiduciary duty applies to a recommendation from which the adviser stands to benefit." },
      { text: "Recommend the rollover automatically, since moving assets under the adviser's own management is always preferable", explanation: "An automatic recommendation without a genuine best-interest analysis ignores the adviser's fiduciary duty and the conflict of interest inherent in gaining a new fee-paying account." },
      { text: "Recommend the rollover only if the client's employer specifically requests it", explanation: "The employer's request is irrelevant to the fiduciary analysis, which centers on what serves the individual client's own best interest." },
      { text: "Skip any comparison of fees or services, since IRAs are always cheaper than employer plans", explanation: "This is not reliably true, and skipping the comparison would itself be a breach of the duty to have a reasonable basis for the recommendation." },
    ],
  },
  {
    id: "s65-cl-x105",
    section: "client",
    q: "A client holds a large concentrated position in their employer's stock, representing a significant majority of their investable net worth. An adviser's most appropriate response is to:",
    a: "Explain the diversification risk this concentration creates and recommend a plan to reduce it over time, even if the client is initially reluctant",
    explanation: "A concentrated single-stock position exposes the client to outsized unsystematic risk tied to one company; a fiduciary adviser has a duty to raise this risk clearly rather than simply deferring to the client's attachment to the stock.",
    options: [
      { text: "Explain the diversification risk this concentration creates and recommend a plan to reduce it over time, even if the client is initially reluctant", explanation: "Correct — addressing concentration risk directly is part of the adviser's duty of care." },
      { text: "Say nothing, since the client's continued employment there implies the position is already appropriate", explanation: "Employment at the company doesn't offset the investment concentration risk; the adviser should still raise the concern." },
      { text: "Immediately liquidate the entire position without discussing it with the client first", explanation: "Unilaterally liquidating a large position without client discussion (and absent proper trading authorization for such action) bypasses the client's own decision-making role." },
      { text: "Encourage the client to add even more of the same stock to maximize the concentration", explanation: "This would increase, not mitigate, the unsystematic risk the adviser should be addressing." },
    ],
  },
  {
    id: "s65-cl-x106",
    section: "client",
    q: "A client tells an adviser they want 'maximum current income' and, in the same conversation, 'aggressive long-term capital growth' from the same pool of investable assets. The most appropriate adviser response is to:",
    a: "Help the client recognize the tension between these objectives and prioritize or reconcile them before constructing a recommendation",
    explanation: "These objectives can pull in different directions (income-generating assets often sacrifice growth potential, and vice versa); a fiduciary adviser must surface and resolve the conflict with the client rather than silently pick one or blend both without discussion.",
    options: [
      { text: "Help the client recognize the tension between these objectives and prioritize or reconcile them before constructing a recommendation", explanation: "Correct — resolving conflicting objectives with the client is a necessary step before a suitable recommendation can be made." },
      { text: "Assume the client meant only capital growth, since that objective was mentioned second", explanation: "Silently substituting one stated objective for the other, based on order mentioned, ignores the client's actual expressed wishes." },
      { text: "Design a recommendation around whichever objective is easiest for the adviser to implement", explanation: "The recommendation must reflect the client's own priorities, not the adviser's convenience." },
      { text: "Refuse to provide any recommendation at all until the client's objectives are perfectly aligned with no tension whatsoever", explanation: "Outright refusal skips the appropriate step of engaging with the client to prioritize or reconcile the stated goals." },
    ],
  },

  // ---------------------------------------------------------------------
  // CAPITAL MARKET THEORY
  // ---------------------------------------------------------------------
  {
    id: "s65-cl-x107",
    section: "client",
    q: "Modern Portfolio Theory (MPT) represents a shift from evaluating securities individually toward evaluating them:",
    a: "By their contribution to the risk and return of the overall portfolio, including how they interact with other holdings",
    explanation: "MPT's central insight is that a security's own standalone risk matters less than how it affects total portfolio risk and return once combined with other holdings, particularly through correlation effects.",
    options: [
      { text: "By their contribution to the risk and return of the overall portfolio, including how they interact with other holdings", explanation: "Correct — this portfolio-level, interaction-based view is MPT's core contribution." },
      { text: "Purely in isolation, based solely on each security's own standalone historical return", explanation: "This describes the older, security-by-security approach MPT specifically moved away from." },
      { text: "Solely by each security's dividend yield, without regard to risk", explanation: "MPT centers on the risk/return relationship generally, not a single metric like dividend yield in isolation." },
      { text: "Exclusively by each security's credit rating", explanation: "Credit rating is one input for certain securities, but it isn't the organizing principle of MPT's portfolio-level risk/return framework." },
    ],
  },
  {
    id: "s65-cl-x108",
    section: "client",
    q: "In the Capital Asset Pricing Model, the theoretical 'market portfolio' refers to:",
    a: "A portfolio containing every available risky asset, weighted according to its relative market value",
    explanation: "The market portfolio is a theoretical construct representing total market risk; in practice, advisers commonly use a broad index as an imperfect proxy for it.",
    options: [
      { text: "A portfolio containing every available risky asset, weighted according to its relative market value", explanation: "Correct — this is the theoretical definition of the market portfolio in CAPM." },
      { text: "A single, actual mutual fund that every investor is required to hold", explanation: "The market portfolio is a theoretical construct, not a specific real-world fund that investors are required to hold." },
      { text: "A portfolio consisting entirely of risk-free assets", explanation: "An all-risk-free-asset portfolio is a distinct CAPM concept (the risk-free asset itself), not the market portfolio, which is composed of risky assets." },
      { text: "A portfolio holding only the single largest company in the market by value", explanation: "The market portfolio spans all risky assets market-value-weighted, not a single concentrated holding in one company." },
    ],
  },
  {
    id: "s65-cl-x109",
    section: "client",
    q: "Covariance and the correlation coefficient both describe how two assets' returns move together, but the correlation coefficient specifically:",
    a: "Standardizes covariance into a bounded value between −1 and +1, making the strength of the relationship comparable across different asset pairs",
    explanation: "Raw covariance can take on any magnitude depending on the assets' units and volatility, making it hard to compare across pairs; dividing covariance by the product of the two assets' standard deviations produces the standardized, comparable correlation coefficient.",
    options: [
      { text: "Standardizes covariance into a bounded value between −1 and +1, making the strength of the relationship comparable across different asset pairs", explanation: "Correct — this is the relationship between covariance and correlation." },
      { text: "Measures an entirely different concept with no mathematical relationship to covariance", explanation: "Correlation is mathematically derived directly from covariance (divided by the product of the standard deviations) — they are closely related, not unrelated." },
      { text: "Can take on any value with no fixed range, unlike covariance", explanation: "This reverses the actual relationship — it's correlation that is bounded (−1 to +1), while raw covariance has no such fixed range." },
      { text: "Only applies to bonds, while covariance only applies to stocks", explanation: "Both covariance and correlation are general statistical measures applicable to any pair of assets, not asset-class-specific." },
    ],
  },
  {
    id: "s65-cl-x110",
    section: "client",
    q: "Adding more securities to a well-diversified portfolio does little to reduce systematic risk primarily because systematic risk:",
    a: "Stems from broad market-wide factors that affect virtually all securities simultaneously, regardless of how many different holdings are combined",
    explanation: "Because systematic risk (such as broad interest rate or economic-cycle risk) affects the whole market at once, no amount of adding more individual securities can diversify it away — only unsystematic, company-specific risk shrinks as holdings are added.",
    options: [
      { text: "Stems from broad market-wide factors that affect virtually all securities simultaneously, regardless of how many different holdings are combined", explanation: "Correct — this is why diversification cannot eliminate systematic risk." },
      { text: "Is actually company-specific and therefore diversifiable, the same as unsystematic risk", explanation: "This mischaracterizes systematic risk, which is precisely the market-wide risk that is NOT diversifiable, unlike unsystematic risk." },
      { text: "Disappears entirely once a portfolio holds more than a small number of securities", explanation: "It's unsystematic risk, not systematic risk, that shrinks toward a minimal level as more securities are added." },
      { text: "Only affects securities within a single industry", explanation: "Systematic risk is market-wide, cutting across industries, not confined to a single industry." },
    ],
  },

  // ---------------------------------------------------------------------
  // PORTFOLIO CONSTRUCTION & INVESTMENT STRATEGIES
  // ---------------------------------------------------------------------
  {
    id: "s65-cl-x111",
    section: "client",
    q: "A 'risk parity' approach to asset allocation differs from a traditional equal-dollar-weighted allocation in that risk parity:",
    a: "Allocates capital so that each asset class contributes a roughly equal share of the portfolio's total risk, rather than an equal share of dollars invested",
    explanation: "Because asset classes have very different volatilities, an equal-dollar allocation can end up dominated by the riskiest asset's contribution to overall volatility; risk parity instead sizes positions (often using leverage on lower-risk assets) so each contributes similarly to total portfolio risk.",
    options: [
      { text: "Allocates capital so that each asset class contributes a roughly equal share of the portfolio's total risk, rather than an equal share of dollars invested", explanation: "Correct — this is the defining principle of risk parity." },
      { text: "Allocates an equal number of dollars to each asset class, with no regard to each asset class's volatility", explanation: "That describes a simple equal-dollar-weighted allocation, the traditional approach risk parity is specifically designed to improve upon." },
      { text: "Invests exclusively in the single lowest-risk asset class available", explanation: "Risk parity still diversifies across multiple asset classes — it just balances their risk contribution, rather than concentrating in one." },
      { text: "Ignores volatility entirely and allocates based only on each asset class's historical average return", explanation: "Risk parity is centered on volatility/risk contribution, not simply chasing historical average return." },
    ],
  },
  {
    id: "s65-cl-x112",
    section: "client",
    q: "A 'factor-based' (or 'smart beta') investing strategy is best described as one that:",
    a: "Systematically tilts portfolio weightings toward specific characteristics, such as value, size, quality, or momentum, rather than weighting holdings purely by market capitalization",
    explanation: "Factor investing sits between purely passive cap-weighted indexing and fully discretionary active management, using rules-based criteria tied to characteristics historically associated with return premia.",
    options: [
      { text: "Systematically tilts portfolio weightings toward specific characteristics, such as value, size, quality, or momentum, rather than weighting holdings purely by market capitalization", explanation: "Correct — this is the defining feature of factor-based investing." },
      { text: "Weights every holding strictly according to its market capitalization, with no other criteria considered", explanation: "That describes traditional cap-weighted indexing, the baseline approach factor investing deliberately departs from." },
      { text: "Relies entirely on a single portfolio manager's unstructured personal discretion, with no systematic rules", explanation: "Factor investing is rules-based and systematic, not driven by unstructured individual discretion." },
      { text: "Excludes equities entirely and invests only in cash instruments", explanation: "Factor investing is applied within equity (and other) asset classes based on characteristics, not a strategy of avoiding equities altogether." },
    ],
  },
  {
    id: "s65-cl-x113",
    section: "client",
    q: "A 'constant proportion portfolio insurance' (CPPI) strategy dynamically adjusts a portfolio's equity/cash mix in order to:",
    a: "Protect a specified minimum ('floor') portfolio value while still allowing participation in market gains above that floor",
    explanation: "CPPI increases exposure to risky assets as the portfolio's value rises further above the floor, and shifts toward safer assets as the value approaches the floor, aiming to combine downside protection with upside participation.",
    options: [
      { text: "Protect a specified minimum ('floor') portfolio value while still allowing participation in market gains above that floor", explanation: "Correct — this is the objective of a CPPI strategy." },
      { text: "Guarantee a fixed, unchanging asset mix regardless of market movements", explanation: "CPPI is specifically a dynamic strategy that CHANGES the mix as market value moves, unlike a static, unchanging allocation." },
      { text: "Maximize short-term trading profits with no concern for downside protection", explanation: "Downside protection (the 'floor') is the central purpose of CPPI, not an afterthought to short-term profit-seeking." },
      { text: "Eliminate all equity exposure permanently once implemented", explanation: "CPPI allows continued equity participation above the floor — it doesn't permanently eliminate equity exposure." },
    ],
  },
  {
    id: "s65-cl-x114",
    section: "client",
    q: "A 'buy-and-hold' strategy, in its purest form, differs from a 'constant-mix' (regularly rebalanced) strategy in that buy-and-hold:",
    a: "Allows the portfolio's asset-class weightings to drift with market performance over time, with no rebalancing trades back to a target mix",
    explanation: "Because buy-and-hold makes no rebalancing trades, strong equity performance, for example, will let equities become a progressively larger share of the portfolio than originally intended — a drift a constant-mix strategy is specifically designed to correct.",
    options: [
      { text: "Allows the portfolio's asset-class weightings to drift with market performance over time, with no rebalancing trades back to a target mix", explanation: "Correct — this passive drift is the hallmark of a pure buy-and-hold approach." },
      { text: "Requires frequent trading to maintain fixed target weightings, exactly like a constant-mix strategy", explanation: "Frequent rebalancing trades describe the constant-mix approach, not buy-and-hold, which specifically avoids such trades." },
      { text: "Guarantees the portfolio will never experience any asset-class weighting drift", explanation: "The opposite is true — the absence of rebalancing is exactly what allows drift to occur under buy-and-hold." },
      { text: "Is only ever used for fixed-income portfolios, never for equities", explanation: "Buy-and-hold is a general strategic approach that can be applied to equities, bonds, or a mixed portfolio, not one limited to fixed income." },
    ],
  },
  {
    id: "s65-cl-x115",
    section: "client",
    q: "A fixed-income 'barbell' strategy structures a bond portfolio's maturities by:",
    a: "Concentrating holdings at both the short and long ends of the maturity spectrum, while largely avoiding intermediate-term maturities",
    explanation: "The short-maturity holdings provide liquidity and reinvestment flexibility, while the long-maturity holdings capture higher yields, with the strategy deliberately skipping the middle of the curve.",
    options: [
      { text: "Concentrating holdings at both the short and long ends of the maturity spectrum, while largely avoiding intermediate-term maturities", explanation: "Correct — this two-ended concentration is what gives the barbell strategy its name." },
      { text: "Concentrating all holdings around a single intermediate maturity date, and only that date", explanation: "That describes a BULLET strategy, not a barbell, which specifically avoids concentrating at a single intermediate point." },
      { text: "Spreading holdings evenly across every maturity from shortest to longest", explanation: "That describes a LADDER strategy, which spreads maturities evenly rather than concentrating at the two ends." },
      { text: "Holding only floating-rate instruments with no fixed maturity structure at all", explanation: "The barbell strategy is specifically about the DISTRIBUTION of fixed maturities, not a strategy built around floating-rate instruments." },
    ],
  },
  {
    id: "s65-cl-x116",
    section: "client",
    q: "A fixed-income 'bullet' strategy is most appropriate for a client who:",
    a: "Has a single, specific future date on which a lump sum of cash will be needed, such as funding a known future liability",
    explanation: "By concentrating bond maturities around one target date, a bullet strategy aligns the portfolio's cash availability with a single known future funding need, rather than spreading liquidity needs across many dates.",
    options: [
      { text: "Has a single, specific future date on which a lump sum of cash will be needed, such as funding a known future liability", explanation: "Correct — this single-date funding need is the classic use case for a bullet strategy." },
      { text: "Needs steady, evenly spaced liquidity at many different points over an extended period", explanation: "That need is better matched by a LADDER strategy, which spreads maturities evenly, rather than a bullet strategy concentrated at one date." },
      { text: "Wants to avoid ever holding a bond that matures", explanation: "A bullet strategy still involves bonds maturing — the point is concentrating those maturities around one date, not avoiding maturity altogether." },
      { text: "Has no future date in mind for any cash need", explanation: "A bullet strategy specifically presumes a KNOWN target date; without one, there's no basis for concentrating maturities that way." },
    ],
  },
  {
    id: "s65-cl-x117",
    section: "client",
    q: "'Sequence of returns' risk is a distinctive concern for a retiree taking systematic withdrawals, but much less so for an accumulator making no withdrawals, because:",
    a: "When withdrawals are being taken, poor returns early in the period do outsized damage, since each withdrawal is drawn from an already-depressed balance that then has less capital left to recover",
    explanation: "Two portfolios can earn the identical average annual return over the same span yet produce very different outcomes depending on the ORDER of those returns once cash is being withdrawn: selling into an early downturn permanently removes shares that would otherwise have participated in the later recovery.",
    options: [
      { text: "When withdrawals are being taken, poor returns early in the period do outsized damage, since each withdrawal is drawn from an already-depressed balance that then has less capital left to recover", explanation: "Correct — the interaction of withdrawals with early losses is precisely what makes the order of returns matter." },
      { text: "The average annual return earned across the whole retirement period is the only thing that determines whether the portfolio lasts", explanation: "This is exactly the assumption sequence-of-returns risk disproves — with withdrawals in the picture, two paths with the same average return can end very differently depending on when losses occur." },
      { text: "It applies only during the accumulation phase, while contributions are being made and no withdrawals are taken", explanation: "This reverses the concept: an accumulator taking no withdrawals is comparatively insulated, while it is the withdrawing retiree who is most exposed." },
      { text: "It arises only in portfolios that hold no equities whatsoever", explanation: "The risk stems from return variability interacting with withdrawals; a portfolio with no volatile assets at all would have little sequence risk, not more." },
    ],
  },
  {
    id: "s65-cl-x118",
    section: "client",
    q: "A retiree adopting an 'income-oriented' investment approach, as opposed to a 'total-return' approach, generally focuses primarily on:",
    a: "Generating sufficient dividend and interest income to meet spending needs, largely without deliberately selling principal",
    explanation: "An income approach tries to live off the portfolio's yield alone; a total-return approach, by contrast, draws from a combination of income and capital appreciation, including periodic sales of appreciated principal, to fund spending.",
    options: [
      { text: "Generating sufficient dividend and interest income to meet spending needs, largely without deliberately selling principal", explanation: "Correct — this defines the income-oriented approach in contrast to total return." },
      { text: "Deliberately selling portions of appreciated principal each year as the primary funding source, regardless of the portfolio's yield", explanation: "That systematic reliance on selling principal alongside income is the hallmark of a TOTAL-RETURN approach, not an income-oriented one." },
      { text: "Avoiding all income-producing securities entirely", explanation: "This is the opposite of an income-oriented approach, which specifically seeks out income-producing securities." },
      { text: "Ignoring the client's spending needs altogether in favor of maximizing long-term growth", explanation: "An income-oriented approach is explicitly built around meeting the client's spending needs through current income, not disregarding those needs." },
    ],
  },
  {
    id: "s65-cl-x119",
    section: "client",
    q: "An adviser runs a Monte Carlo simulation as part of a client's retirement plan. The simulation's characteristic output is:",
    a: "A distribution of many possible outcomes generated from randomized return paths, expressed as a probability — for example, that the plan succeeds in 85% of trials",
    explanation: "A Monte Carlo engine runs a plan through thousands of randomized return sequences rather than a single assumed average return, so its result is inherently probabilistic: it describes the range of outcomes and how often the plan survives, not what will actually happen.",
    options: [
      { text: "A distribution of many possible outcomes generated from randomized return paths, expressed as a probability — for example, that the plan succeeds in 85% of trials", explanation: "Correct — a probabilistic range across many simulated trials is exactly what distinguishes Monte Carlo from a single straight-line projection." },
      { text: "A single guaranteed projection of the client's exact portfolio value at retirement", explanation: "No simulation guarantees an outcome; producing a range of possibilities rather than one certain figure is the entire point of the technique." },
      { text: "An accurate forecast of the specific order in which market returns will actually occur", explanation: "Monte Carlo randomizes hypothetical return sequences to explore possibilities — it makes no claim to predict the real sequence of future returns." },
      { text: "A measurement of the client's psychological risk tolerance derived from a questionnaire", explanation: "Assessing risk tolerance is a separate profiling exercise; Monte Carlo models portfolio outcomes and takes client inputs as given." },
    ],
  },
  {
    id: "s65-cl-x120",
    section: "client",
    q: "An adviser constructing a portfolio using a 'liability-driven' investing approach for a client primarily seeks to:",
    a: "Match the portfolio's assets (such as their cash flows and interest rate sensitivity) to a specific stream of the client's future obligations",
    explanation: "Liability-driven investing starts from the client's known or projected future liabilities and works backward to structure assets (often bonds selected for duration matching) that are designed to fund those obligations reliably.",
    options: [
      { text: "Match the portfolio's assets (such as their cash flows and interest rate sensitivity) to a specific stream of the client's future obligations", explanation: "Correct — this asset/liability matching is the defining principle of liability-driven investing." },
      { text: "Maximize total portfolio return with no reference to any of the client's future obligations", explanation: "Ignoring the client's liabilities entirely is the opposite of a liability-driven approach, which is specifically built around them." },
      { text: "Invest exclusively in equities regardless of the nature or timing of the client's liabilities", explanation: "An all-equity approach, without regard to matching characteristics like duration to the liabilities, doesn't reflect the liability-driven methodology." },
      { text: "Ignore interest rate risk entirely when selecting fixed-income holdings", explanation: "Managing interest rate sensitivity (often via duration matching) relative to the liabilities is a central, not ignored, component of this approach." },
    ],
  },
];
