// SIE Section 1 - Knowledge of Capital Markets: expansion batch 2 of 2.
//
// This batch deliberately steers away from the ground already covered in
// data/certs/sie-bank.js and data/certs/sie-bank-capital-markets.js (SEC/FINRA/
// MSRB/CFTC/SIPC/NASAA basics, exchange vs OTC vs dark pool/ECN structure,
// firm-commitment/best-efforts syndicate mechanics, GDP/CPI/business-cycle/
// Fed-policy/yield-curve economic factors). It instead focuses on:
//   - market participants and broker-dealer roles (introducing vs clearing,
//     principal vs agency capacity)
//   - market-structure plumbing that trips candidates up (TRACE fixed income
//     transparency, market-wide circuit breakers, CAT, Reg T initial margin)
//   - offering mechanics not yet tested (rights offerings, all-or-none
//     best-efforts, due diligence meetings, Reg M stabilizing bids)
//
// NOTE: the DMM's fair-and-orderly-market obligation and the Reg NMS Rule 611
// order protection rule are deliberately NOT covered here - sie-capital-markets-1.js
// already tests both (x107, and x105/x106 respectively).
//   - the current (post-1/1/2023) FINRA Rule 1240 annual Regulatory Element
//     cycle, since the retired "2nd anniversary then every 3 years" schedule
//     is explicitly swept as wrong by the test suite.
//
// All settlement references, where applicable elsewhere in the bank, use T+1.
// No date-sensitive dollar thresholds, contribution limits, or SIPC coverage
// figures appear in this batch.

export const SIE_CAPITAL_MARKETS_X2 = [
  {
    id: "sieb-cm-x201",
    section: "capital-markets",
    q: "Under the current FINRA Rule 1240 schedule (in effect since January 1, 2023), when must a registered person complete the Regulatory Element of continuing education?",
    a: "Annually, by December 31 of each year the person remains registered",
    explanation: "FINRA amended Rule 1240 effective January 1, 2023, replacing the old cycle (within 120 days of the second registration anniversary, then every three years) with an annual requirement: the Regulatory Element must be completed by December 31 of each year the individual remains registered. (A person newly registering starts this annual cycle in the calendar year following the year of registration.) Miss the deadline and the registration becomes CE Inactive - the person must cease all activities requiring registration until the requirement is satisfied.",
    options: [
      { text: "Annually, by December 31 of each year the person remains registered", explanation: "Correct - since the January 1, 2023 rule change, Rule 1240 requires the Regulatory Element to be completed every calendar year by December 31, not on a multi-year anniversary cycle." },
      { text: "Within 120 days of the second registration anniversary, then every three years after that", explanation: "This was the prior schedule under old Rule 1240 and was retired effective January 1, 2023; it is no longer the operative rule." },
      { text: "Only once, at initial registration, with no further requirement", explanation: "Continuing education is an ongoing annual obligation for as long as the registration stays active, not a one-time requirement." },
      { text: "Only in years following a customer complaint or disciplinary action", explanation: "The Regulatory Element applies to all registered persons on the annual schedule regardless of complaint or disciplinary history." },
    ],
  },
  {
    id: "sieb-cm-x202",
    section: "capital-markets",
    q: "Under Federal Reserve Regulation T, what is the standard initial margin requirement for a customer purchasing marginable stock in a margin account?",
    a: "50% of the purchase price",
    explanation: "Regulation T, issued by the Federal Reserve Board under the Securities Exchange Act of 1934, has set the initial margin requirement for stock purchases at 50% since 1974. The customer must deposit at least half the purchase price, financing the remainder with a margin loan from the broker-dealer.",
    options: [
      { text: "50% of the purchase price", explanation: "Correct - Regulation T's initial margin requirement for equity purchases has stood at 50% since 1974, giving the Fed authority to adjust it though it has not done so." },
      { text: "25% of the purchase price", explanation: "25% is the long-standing FINRA minimum maintenance margin requirement for a long margin position, not the Reg T initial requirement." },
      { text: "100% of the purchase price, with no borrowing permitted", explanation: "This describes a cash account, not a margin account; margin accounts under Reg T permit financing half the purchase with credit." },
      { text: "10% of the purchase price", explanation: "10% is not a Reg T threshold; it understates the initial margin the Fed requires for a standard equity purchase." },
    ],
  },
  {
    id: "sieb-cm-x203",
    section: "capital-markets",
    q: "An introducing broker-dealer is best distinguished from a clearing (carrying) firm in that the introducing firm:",
    a: "Handles the customer relationship and order entry but forwards trades to a clearing firm to settle and hold customer assets",
    explanation: "Introducing firms deal directly with retail or institutional customers - opening accounts, taking orders, giving advice - but do not themselves clear trades or hold customer cash and securities. They contract with a clearing (carrying) firm, which handles trade settlement, custody, and back-office functions on the introducing firm's behalf.",
    options: [
      { text: "Handles the customer relationship and order entry but forwards trades to a clearing firm to settle and hold customer assets", explanation: "Correct - this front-office/back-office split is exactly what distinguishes an introducing broker-dealer from the clearing firm it uses." },
      { text: "Holds customer funds and securities directly and settles its own trades", explanation: "This describes a clearing (self-clearing) firm, not an introducing firm, which by definition relies on another firm for clearing and custody." },
      { text: "Acts as a self-regulatory organization overseeing its correspondent firms", explanation: "Introducing firms are regulated by FINRA and the SEC like any broker-dealer; they have no SRO authority over other firms." },
      { text: "Guarantees the performance of every counterparty on an alternative trading system", explanation: "Guaranteeing counterparty performance describes clearing corporation functions, not the role of an introducing broker-dealer." },
    ],
  },
  {
    id: "sieb-cm-x204",
    section: "capital-markets",
    q: "FINRA's Trade Reporting and Compliance Engine (TRACE) exists to bring post-trade price transparency to which market?",
    a: "The over-the-counter market in eligible fixed income securities, such as corporate and agency bonds",
    explanation: "TRACE is the FINRA facility to which member firms report their transactions in TRACE-eligible fixed income securities - corporate bonds, agency debt, and certain securitized products. FINRA then disseminates the execution time, price, yield, and volume publicly, giving a historically opaque over-the-counter bond market the kind of post-trade transparency that the consolidated tape already provided for exchange-listed equities.",
    options: [
      { text: "The over-the-counter market in eligible fixed income securities, such as corporate and agency bonds", explanation: "Correct - TRACE collects and publicly disseminates transaction data for TRACE-eligible fixed income securities traded over the counter." },
      { text: "The market for exchange-listed equity securities", explanation: "Post-trade transparency for listed equities comes from the consolidated tape (the Securities Information Processor), not from TRACE, which is a fixed income facility." },
      { text: "The secondary market in municipal securities", explanation: "Municipal secondary market trades are reported to the MSRB's Real-Time Transaction Reporting System and shown on EMMA, not to TRACE." },
      { text: "The market for listed equity options", explanation: "Listed options quote and trade data are disseminated by the Options Price Reporting Authority; TRACE does not cover options." },
    ],
  },
  {
    id: "sieb-cm-x205",
    section: "capital-markets",
    q: "When a broker-dealer fills a customer's buy order out of its own inventory, at a price the firm itself sets, it is acting in which capacity?",
    a: "Principal (dealer) capacity",
    explanation: "A firm acting as principal (dealer) trades for its own account, buying from or selling to the customer out of its own inventory and marking up or down the price accordingly. This contrasts with agency (broker) capacity, in which the firm merely arranges a trade between two other parties and charges a commission.",
    options: [
      { text: "Principal (dealer) capacity", explanation: "Correct - trading out of the firm's own inventory, at a price the firm sets, is the defining feature of acting as principal." },
      { text: "Agency (broker) capacity", explanation: "In agency capacity the firm acts on behalf of a customer to execute against another party's order and earns a commission, rather than trading from its own book." },
      { text: "Custodial capacity", explanation: "Custodial capacity refers to holding assets on a client's behalf, not to executing a trade from firm inventory." },
      { text: "Fiduciary capacity", explanation: "Fiduciary duty is a legal standard of care, not a trading capacity describing whether the firm traded from its own book or as agent." },
    ],
  },
  {
    id: "sieb-cm-x206",
    section: "capital-markets",
    q: "The Consolidated Audit Trail (CAT) was established primarily to:",
    a: "Give regulators a comprehensive, cross-market record of orders and trades from origination through execution for surveillance purposes",
    explanation: "CAT requires exchanges and broker-dealers to report detailed, time-stamped order and trade data to a single repository, letting the SEC and SROs reconstruct trading activity across markets to detect manipulation, investigate unusual events, and conduct surveillance. It is a reporting and surveillance system, not a settlement, insurance, or execution-price mechanism.",
    options: [
      { text: "Give regulators a comprehensive, cross-market record of orders and trades from origination through execution for surveillance purposes", explanation: "Correct - CAT exists to let regulators track the full lifecycle of an order across markets for surveillance and investigation." },
      { text: "Guarantee customers a specific execution price on every order", explanation: "CAT is a data-reporting and surveillance system; it does not guarantee execution prices to customers." },
      { text: "Set the thresholds at which market-wide circuit breakers halt trading", explanation: "Circuit breaker thresholds are set under separate exchange rules, not by the CAT reporting system." },
      { text: "Replace SIPC as the source of customer asset protection if a brokerage fails", explanation: "CAT has no role in customer asset protection; that function belongs to SIPC, an entirely separate program." },
    ],
  },
  {
    id: "sieb-cm-x207",
    section: "capital-markets",
    q: "Market-wide circuit breakers are triggered by:",
    a: "A sharp intraday decline in a broad market index, such as the S&P 500, from its prior day's closing level",
    explanation: "Market-wide circuit breakers halt trading across all exchanges when a broad benchmark index falls a specified percentage from its previous close, giving markets a pause to absorb information during a rapid, broad-based decline. They are distinct from single-stock limit-up/limit-down mechanisms, which respond to moves in one security rather than the overall market.",
    options: [
      { text: "A sharp intraday decline in a broad market index, such as the S&P 500, from its prior day's closing level", explanation: "Correct - market-wide circuit breakers key off percentage declines in a broad benchmark index relative to the prior close." },
      { text: "A single stock's price moving sharply away from its recent trading range", explanation: "This describes the single-stock limit-up/limit-down mechanism, not the market-wide circuit breaker, which responds to broad-index moves." },
      { text: "A single day's trading volume falling below a minimum threshold", explanation: "Low volume alone does not trigger a market-wide circuit breaker; the trigger is a sharp decline in a broad index level." },
      { text: "An individual broker-dealer's net capital falling below required minimums", explanation: "Net capital deficiencies concern a single firm's financial condition and are addressed through separate net capital rules, not circuit breakers." },
    ],
  },
  {
    id: "sieb-cm-x208",
    section: "capital-markets",
    q: "During the distribution of a new issue, SEC Regulation M permits the managing underwriter to enter a stabilizing bid. Such a bid may be entered:",
    a: "At a price no higher than the public offering price, and only for the purpose of preventing or retarding a decline in the security's market price",
    explanation: "Stabilization is a narrow, expressly permitted exception to the anti-manipulation rules. Under Regulation M Rule 104, a stabilizing bid may not exceed the public offering price, and it may be entered only to prevent or retard a decline in the open market price of the security being distributed - never to raise the price or induce buying. Any bid that goes beyond that limited defensive purpose is manipulation.",
    options: [
      { text: "At a price no higher than the public offering price, and only for the purpose of preventing or retarding a decline in the security's market price", explanation: "Correct - Rule 104 caps the stabilizing bid at the public offering price and confines its purpose to preventing or retarding a price decline." },
      { text: "At whatever price the syndicate chooses, in order to drive the market price above the public offering price", explanation: "Bidding up the price is exactly what Regulation M forbids; stabilization is defensive only and is capped at the public offering price." },
      { text: "Only after the distribution has been completed and the syndicate has broken", explanation: "Stabilization supports the security during the distribution; once the syndicate breaks and the distribution ends, the stabilizing bid comes down rather than starting." },
      { text: "Only by an independent broker-dealer with no role in the underwriting", explanation: "Stabilizing is done by the managing underwriter (or its designated agent) on the syndicate's behalf, not by an unaffiliated firm." },
    ],
  },
  {
    id: "sieb-cm-x209",
    section: "capital-markets",
    q: "In a rights offering, existing shareholders are given the ability to:",
    a: "Purchase additional shares, typically at a discount to the current market price, in proportion to their existing holdings",
    explanation: "A rights offering grants current shareholders subscription rights allowing them to buy new shares pro rata to their existing ownership, usually at a price below the current market price, so they can maintain their percentage ownership and avoid dilution from the new issuance.",
    options: [
      { text: "Purchase additional shares, typically at a discount to the current market price, in proportion to their existing holdings", explanation: "Correct - preemptive rights let existing holders buy proportionally more shares at a discount, protecting them from dilution." },
      { text: "Sell their existing shares back to the issuer at par value", explanation: "A rights offering does not involve the issuer buying back shares at par; that would resemble a different corporate action entirely." },
      { text: "Receive additional shares automatically at no cost, in proportion to their holdings", explanation: "This describes a stock dividend or stock split, not a rights offering, which requires shareholders to pay a subscription price to exercise the rights." },
      { text: "Convert their common shares into preferred shares at any time", explanation: "Conversion privileges between common and preferred shares are a feature of convertible securities, unrelated to a rights offering." },
    ],
  },
  {
    id: "sieb-cm-x210",
    section: "capital-markets",
    q: "In an all-or-none (AON) best-efforts underwriting, if the entire offering has not been sold by the offering's expiration date:",
    a: "All funds collected from investors are returned and the offering is canceled",
    explanation: "An all-or-none commitment requires that the entire offering sell out; if it does not, the deal is called off and investor funds, which are held in escrow during the offering period, are returned in full. This differs from a plain best-efforts deal, where the issuer simply keeps whatever portion does sell.",
    options: [
      { text: "All funds collected from investors are returned and the offering is canceled", explanation: "Correct - under an AON commitment, failing to sell the full offering voids the deal and escrowed investor funds are refunded." },
      { text: "The issuer keeps the proceeds from whatever shares were sold", explanation: "Keeping partial proceeds describes a plain best-efforts offering without an all-or-none condition, not an AON deal, which requires full sale or cancellation." },
      { text: "The underwriters are obligated to purchase the unsold shares themselves", explanation: "Underwriters purchasing unsold shares describes a firm commitment underwriting; in a best-efforts AON deal the underwriters take no such obligation." },
      { text: "The offering period automatically extends until all shares are sold", explanation: "An AON offering has a defined expiration; it is canceled and funds returned if not fully sold by that date, rather than extending indefinitely." },
    ],
  },
  {
    id: "sieb-cm-x211",
    section: "capital-markets",
    q: "The due diligence meeting held near the end of the cooling-off period brings together issuer management, underwriters, and their counsel primarily to:",
    a: "Review the registration statement and preliminary prospectus for accuracy and completeness before the offering becomes effective",
    explanation: "The due diligence meeting is where the underwriting group and issuer scrutinize the disclosures in the registration statement and preliminary prospectus, verifying material facts and addressing any deficiencies before the SEC declares the registration effective, helping the underwriters meet their obligation to have a reasonable basis for believing the disclosures are accurate.",
    options: [
      { text: "Review the registration statement and preliminary prospectus for accuracy and completeness before the offering becomes effective", explanation: "Correct - the due diligence meeting exists to verify and finalize the accuracy of the offering's disclosure documents before effectiveness." },
      { text: "Negotiate the size of the underwriting spread among syndicate members", explanation: "Compensation splits among syndicate members are addressed in the agreement among underwriters, not the purpose of the due diligence meeting." },
      { text: "Set the final public offering price immediately upon the meeting's conclusion", explanation: "The final offering price is typically set closer to effectiveness based on market conditions, not fixed as the outcome of the due diligence meeting itself." },
      { text: "Solicit indications of interest from retail investors for the first time", explanation: "Indications of interest are gathered throughout the cooling-off period via the preliminary prospectus, not first solicited at the due diligence meeting." },
    ],
  },
  {
    id: "sieb-cm-x212",
    section: "capital-markets",
    q: "A secondary offering in which a large existing shareholder (rather than the issuer) sells a block of shares to the public differs from a primary offering because:",
    a: "The sale proceeds go to the selling shareholder, not to the issuing company",
    explanation: "In a primary offering, the issuer sells new shares and receives the proceeds, increasing the total shares outstanding. In a secondary (non-issuer) offering, an existing large holder sells already-outstanding shares, and the proceeds go to that shareholder rather than the company, so total shares outstanding do not increase.",
    options: [
      { text: "The sale proceeds go to the selling shareholder, not to the issuing company", explanation: "Correct - a secondary offering redirects an existing stake to new holders, so the selling shareholder, not the issuer, receives the proceeds." },
      { text: "The shares sold are newly created, increasing total shares outstanding", explanation: "New share creation increasing shares outstanding describes a primary offering; a secondary offering involves already-outstanding shares changing hands." },
      { text: "The offering is exempt from SEC registration requirements", explanation: "A secondary offering of this kind is generally still subject to registration requirements unless a specific exemption applies; the funds' destination, not exemption status, is the key distinction here." },
      { text: "The issuing company must approve the identity of every purchaser", explanation: "Purchasers in a public secondary offering are not individually approved by the issuer; shares are sold to the public through the offering process." },
    ],
  },
];
