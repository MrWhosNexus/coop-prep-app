// SIE expansion batch — capital-markets, part 1 of 2.
// Bias: regulatory entities/agencies/market participants and market structure,
// with a few offerings items rounding out the slice (economic-factor mechanics
// are already well covered by sie-bank-capital-markets.js, so this batch mostly
// avoids re-treading GDP/CPI/Fed-tools ground and instead covers clearing and
// depository infrastructure, order-handling/market-structure rules, and
// market-participant roles that candidates commonly get wrong on the real exam).
//
// Blue sky registration methods appear once, at x103 (registration by
// coordination). A second item on the same triad (x104, registration by
// qualification) was REPLACED IN PLACE as redundant - not deleted; counts are
// load-bearing, so the slot and the id were reused and this file still exports
// 12 items. The two gave each other away, and the method triad is closer to
// Series 63/65 ground than to the SIE. x104 now tests the municipal advisor's
// registration and fiduciary duty under Exchange Act 15B - Section 1
// market-participant ground not covered anywhere else in the SIE bank.
// ids: sieb-cm-x101 through sieb-cm-x112

export const SIE_CAPITAL_MARKETS_X1 = [
  {
    id: "sieb-cm-x101",
    section: "capital-markets",
    q: "The Depository Trust Company (DTC) and the National Securities Clearing Corporation (NSCC) are both subsidiaries of the same parent. What is the key functional difference between them?",
    a: "DTC provides depository and book-entry safekeeping of securities, while NSCC provides trade comparison, netting, and clearance of equity and corporate/municipal debt transactions.",
    explanation: "DTC and NSCC are both subsidiaries of the Depository Trust & Clearing Corporation (DTCC), but they perform different functions in the post-trade process. DTC acts as a central securities depository, holding securities in book-entry (electronic) form on behalf of its participants. NSCC is the clearing agency that compares, nets, and clears equity, corporate bond, and municipal bond trades before they settle at DTC. A separate DTCC subsidiary, the Fixed Income Clearing Corporation (FICC), handles clearing for U.S. government and mortgage-backed securities.",
    options: [
      { text: "DTC provides depository and book-entry safekeeping of securities, while NSCC provides trade comparison, netting, and clearance of equity and corporate/municipal debt transactions.", explanation: "Correct - DTC is the securities depository; NSCC is the clearing corporation that nets and clears trades before they settle at DTC." },
      { text: "DTC clears government securities trades while NSCC clears equity trades exclusively.", explanation: "Wrong - clearing government and mortgage-backed securities is the role of FICC, not DTC. DTC is a depository, not a clearing agency." },
      { text: "NSCC holds customer securities in custody while DTC only processes dividend payments.", explanation: "Wrong - this reverses the roles. DTC is the custodian/depository; NSCC's role is clearance and netting, not custody." },
      { text: "There is no meaningful difference; the two names refer to the same clearing function under different branding.", explanation: "Wrong - they are distinct entities performing distinct functions (depository vs. clearing corporation), even though both are DTCC subsidiaries." },
    ],
  },
  {
    id: "sieb-cm-x102",
    section: "capital-markets",
    q: "The Fixed Income Clearing Corporation (FICC) is best described as the entity that:",
    a: "Provides trade comparison, netting, and settlement services for the U.S. government securities and mortgage-backed securities markets.",
    explanation: "FICC, a DTCC subsidiary, has two divisions: the Government Securities Division (GSD), which handles Treasury and agency securities, and the Mortgage-Backed Securities Division (MBSD), which handles MBS trades. It performs the same netting/clearing role for these fixed-income markets that NSCC performs for equities and corporate/municipal debt.",
    options: [
      { text: "Provides trade comparison, netting, and settlement services for the U.S. government securities and mortgage-backed securities markets.", explanation: "Correct - FICC's Government Securities Division and Mortgage-Backed Securities Division clear those specific fixed-income markets." },
      { text: "Sets the coupon rates on newly auctioned Treasury securities.", explanation: "Wrong - coupon rates and yields on Treasury auctions are determined by the auction process itself (through the Treasury Department), not by FICC." },
      { text: "Acts as the sole broker-dealer permitted to underwrite municipal bond offerings.", explanation: "Wrong - FICC is a clearing agency, not a broker-dealer, and municipal underwriting is open to any qualified broker-dealer." },
      { text: "Holds equity securities in book-entry form on behalf of brokerage firms.", explanation: "Wrong - book-entry custody of equities is DTC's function, not FICC's." },
    ],
  },
  {
    id: "sieb-cm-x103",
    section: "capital-markets",
    q: "An issuer registering a securities offering simultaneously at the federal level with the SEC and at the state level using the same disclosure documents is using which method of state (blue sky) registration?",
    a: "Registration by coordination",
    explanation: "Registration by coordination lets an issuer file the same registration statement with state securities administrators that it files with the SEC, so the state registration becomes effective at (or close to) the same time as the federal registration. It is the most commonly used method for offerings that are also being registered federally.",
    options: [
      { text: "Registration by coordination", explanation: "Correct - coordination ties the state registration's effectiveness to the federal registration filed with the SEC using the same documents." },
      { text: "Registration by qualification", explanation: "Wrong - qualification is the most demanding, stand-alone state review method, typically used when there is no simultaneous federal registration (e.g., intrastate offerings)." },
      { text: "Registration by notification", explanation: "Wrong - notification is a streamlined method reserved for established issuers meeting specific state criteria, not tied to a simultaneous federal filing." },
      { text: "Registration by exemption", explanation: "Wrong - an exemption means the offering is not required to register at all; it is not a registration method." },
    ],
  },
  {
    id: "sieb-cm-x104",
    section: "capital-markets",
    q: "A consulting firm advises a city on the structure, timing, and terms of a planned municipal bond issue. The firm is not serving as an underwriter on the deal. Under the Securities Exchange Act of 1934, this firm is:",
    a: "A municipal advisor, which must register with the SEC and owes the city a fiduciary duty",
    explanation: "Exchange Act Section 15B(e)(4), added by the Dodd-Frank Act, defines a municipal advisor as a person who provides advice to a municipal entity regarding municipal financial products or the issuance of municipal securities. Section 15B(a)(1)(B) makes it unlawful to provide such advice unless registered, and SEC Rule 15Ba1-2 requires that registration to be made with the Commission on Form MA. Section 15B(c)(1) states that a municipal advisor 'shall be deemed to have a fiduciary duty to any municipal entity for whom such municipal advisor acts' - a materially higher standard than the obligations a broker-dealer owes a customer. The definition excludes a broker-dealer serving in the capacity of underwriter on the same issue, which is precisely why this firm's non-underwriter role puts it inside the definition.",
    options: [
      { text: "A municipal advisor, which must register with the SEC and owes the city a fiduciary duty", explanation: "Correct - advising a municipal entity on an issuance, outside the underwriter role, makes the firm a municipal advisor: registration with the SEC on Form MA is required, and Section 15B(c)(1) imposes a fiduciary duty to the municipal entity client." },
      { text: "A municipal advisor, but it owes the city only a suitability obligation rather than a fiduciary duty", explanation: "Wrong - the firm is a municipal advisor, but Congress expressly deemed municipal advisors to owe their municipal entity clients a fiduciary duty; suitability is a lesser standard that does not describe the municipal advisor relationship." },
      { text: "An underwriter, because any firm advising on a bond issue is deemed to be underwriting it", explanation: "Wrong - the underwriter exclusion applies only to a broker-dealer actually serving in the capacity of underwriter on that issue. Advising a municipal entity without underwriting the deal is exactly what the municipal advisor definition captures." },
      { text: "Exempt from any registration requirement, because advising a municipal entity is not a regulated activity", explanation: "Wrong - advising municipal entities is regulated: it is unlawful to provide such advice without registering as a municipal advisor, and municipal advisors are also subject to MSRB rules." },
    ],
  },
  {
    id: "sieb-cm-x105",
    section: "capital-markets",
    q: "Under Regulation NMS Rule 611 (the Order Protection Rule), during regular trading hours a trading center executes a sell order in an NMS stock at a price lower than a protected bid displayed on another market. This execution is:",
    a: "A trade-through",
    explanation: "Reg NMS defines a trade-through as the purchase or sale of an NMS stock during regular trading hours, as principal or agent, at a price lower than a protected bid or higher than a protected offer. Rule 611 requires trading centers to maintain policies and procedures reasonably designed to prevent trade-throughs. A protected quotation is an automated best bid or offer displayed by an automated trading center and disseminated under an effective NMS plan. The prohibition is subject to enumerated exceptions, such as intermarket sweep orders.",
    options: [
      { text: "A trade-through", explanation: "Correct - executing at a worse price than a protected quotation on another market is the definition of a trade-through that Rule 611 is designed to prevent." },
      { text: "A locked market", explanation: "Wrong - a locked market occurs when one market's bid equals another market's offer for the same security; it is a different, separately regulated condition." },
      { text: "A short sale violation", explanation: "Wrong - nothing in the scenario indicates a short sale; the issue described is purely one of execution price versus displayed quotations." },
      { text: "A free-riding violation", explanation: "Wrong - free-riding involves buying and selling securities without paying for them; it is unrelated to trade-through price protection." },
    ],
  },
  {
    id: "sieb-cm-x106",
    section: "capital-markets",
    q: "Which of the following is a permitted exception under Reg NMS Rule 611 that allows a trade to occur at a price inferior to a protected quotation without violating the Order Protection Rule?",
    a: "The trade is executed pursuant to an intermarket sweep order (ISO).",
    explanation: "Rule 611(b) contains nine enumerated exceptions to the general trade-through prohibition. The exception the SEC expected to be used most frequently is for intermarket sweep orders (Rules 611(b)(5) and (b)(6)): an ISO is routed to simultaneously execute against the full displayed size of any better-priced protected quotations, which satisfies the order protection requirement and lets the trading center execute the balance at an inferior price. Other exceptions cover, for example, single-priced opening, reopening, or closing transactions and quotations displayed by a market experiencing a systems failure or material delay.",
    options: [
      { text: "The trade is executed pursuant to an intermarket sweep order (ISO).", explanation: "Correct - ISOs are the most commonly used Rule 611 exception, letting a trading center execute at an inferior price when the order was routed to simultaneously access better-priced protected quotes elsewhere." },
      { text: "The trade involves a customer who is a control person of the issuer.", explanation: "Wrong - control-person status relates to Rule 144 resale restrictions, not to Rule 611's trade-through exceptions." },
      { text: "The trade is executed by a market maker acting as principal.", explanation: "Wrong - acting as principal alone does not exempt a trading center from the order protection rule." },
      { text: "The customer gave written instructions to disregard better prices displayed on other markets.", explanation: "Wrong - Rule 611's obligation attaches to the trading center, not to the customer, and there is no customer-waiver exception. A customer cannot consent away order protection." },
    ],
  },
  {
    id: "sieb-cm-x107",
    section: "capital-markets",
    q: "On the floor of the NYSE, the Designated Market Maker (DMM) assigned to a listed stock has a core obligation to:",
    a: "Maintain a fair and orderly market in the assigned stock, including providing liquidity when there is a temporary imbalance of buy and sell orders.",
    explanation: "The DMM (the modern successor to the specialist) is obligated to maintain a fair and orderly market in its assigned securities. This includes stepping in to buy or sell for its own account when necessary to dampen excessive volatility or fill temporary gaps between supply and demand, while also managing the opening and closing auctions for the stock.",
    options: [
      { text: "Maintain a fair and orderly market in the assigned stock, including providing liquidity when there is a temporary imbalance of buy and sell orders.", explanation: "Correct - fair and orderly market-making, including stepping in during order imbalances, is the DMM's central regulatory obligation." },
      { text: "Guarantee that the stock's price will never decline during a trading session.", explanation: "Wrong - no market participant can guarantee price direction; the DMM's duty is orderly markets, not price guarantees." },
      { text: "Set the company's quarterly earnings guidance in coordination with the issuer.", explanation: "Wrong - earnings guidance is a corporate disclosure matter for the issuer, unrelated to the DMM's trading floor role." },
      { text: "Approve or reject the company's board of directors nominees.", explanation: "Wrong - corporate governance matters like board nominees are decided by shareholders, not the exchange's market maker." },
    ],
  },
  {
    id: "sieb-cm-x108",
    section: "capital-markets",
    q: "The consolidated tape (Securities Information Processor, or SIP) in the U.S. equity markets exists primarily to:",
    a: "Collect and disseminate real-time trade and quote data from all exchanges and trading venues into a single, unified public data feed.",
    explanation: "For any given NMS stock, the SIP aggregates last-sale and quotation data from every exchange trading that stock, plus off-exchange trades reported through FINRA's Trade Reporting Facilities, and distributes it as one consolidated feed. This gives the public a unified view of prices and volumes across a fragmented market structure. (In practice the consolidated tape is run by more than one processor - the CTA/CQ plan covers NYSE- and other exchange-listed issues while the UTP plan covers Nasdaq-listed issues - but each NMS stock has a single consolidated feed.)",
    options: [
      { text: "Collect and disseminate real-time trade and quote data from all exchanges and trading venues into a single, unified public data feed.", explanation: "Correct - the consolidated tape's purpose is aggregating cross-market trade and quote data into one public feed." },
      { text: "Clear and settle every equity trade executed in the United States.", explanation: "Wrong - clearing and settlement of equity trades is performed by NSCC and DTC, not the consolidated tape." },
      { text: "Set the official closing price used for index rebalancing.", explanation: "Wrong - closing prices are determined by each listing exchange's closing auction process, not directly by the SIP, whose role is data dissemination." },
      { text: "Approve new securities for listing on a national exchange.", explanation: "Wrong - listing approval is handled by each exchange's own listing standards and staff, unrelated to the tape's data function." },
    ],
  },
  {
    id: "sieb-cm-x109",
    section: "capital-markets",
    q: "When the Federal Reserve conducts open market operations, it transacts directly with a designated group of banks and broker-dealers known as:",
    a: "Primary dealers",
    explanation: "Primary dealers are the banks and broker-dealers that the Federal Reserve Bank of New York transacts with directly when buying and selling U.S. government securities to implement open market operations. They also serve as counterparties in Treasury auctions, but their defining role for SIE purposes is as the Fed's direct trading counterparties.",
    options: [
      { text: "Primary dealers", explanation: "Correct - primary dealers are the designated counterparties the New York Fed trades with to execute open market operations." },
      { text: "Introducing brokers", explanation: "Wrong - an introducing broker handles customer accounts but passes clearing/custody to a clearing firm; it has no special relationship with the Fed." },
      { text: "Designated Market Makers", explanation: "Wrong - DMMs make markets in listed equities on an exchange floor; they are not the Fed's trading counterparties for government securities." },
      { text: "Transfer agents", explanation: "Wrong - a transfer agent maintains records of registered securities owners; it plays no role in Fed open market operations." },
    ],
  },
  {
    id: "sieb-cm-x110",
    section: "capital-markets",
    q: "The Federal Reserve System's structure consists of a Board of Governors in Washington, D.C. overseeing:",
    a: "Twelve regional Federal Reserve Banks, each serving a designated district.",
    explanation: "The Federal Reserve System is composed of the Board of Governors and twelve regional Federal Reserve Banks, each covering a specific geographic district. The regional banks carry out System functions within their districts (such as bank supervision and check processing) while the Board of Governors sets overall System policy, and the Federal Reserve Bank of New York executes open market operations on behalf of the System.",
    options: [
      { text: "Twelve regional Federal Reserve Banks, each serving a designated district.", explanation: "Correct - the System is structured around twelve regional Reserve Banks under the Board of Governors' oversight." },
      { text: "Fifty state-level Federal Reserve Banks, one per state.", explanation: "Wrong - Reserve Banks are organized by twelve multi-state districts, not one per state." },
      { text: "A single national Federal Reserve Bank located in New York.", explanation: "Wrong - while the New York Fed executes open market operations, the System has twelve regional Reserve Banks, not just one." },
      { text: "Regional banks that are chartered and controlled by state securities regulators.", explanation: "Wrong - Federal Reserve Banks are part of the federal central banking system; they have no relationship to state securities regulators." },
    ],
  },
  {
    id: "sieb-cm-x111",
    section: "capital-markets",
    q: "Municipal bonds and U.S. government securities are considered exempt securities under the Securities Act of 1933. What does this exemption actually excuse the issuer from?",
    a: "Filing a registration statement and prospectus with the SEC before the offering; the antifraud provisions of the securities laws still apply.",
    explanation: "An 'exempt security' is exempt from the Securities Act of 1933's registration and prospectus delivery requirements, not from the law's antifraud protections. Issuers and sellers of exempt securities, such as municipal and U.S. government bonds, remain fully subject to antifraud rules; the exemption is purely a registration/disclosure-filing exemption.",
    options: [
      { text: "Filing a registration statement and prospectus with the SEC before the offering; the antifraud provisions of the securities laws still apply.", explanation: "Correct - exempt securities skip SEC registration/prospectus filing, but antifraud protections continue to apply to their sale." },
      { text: "All federal and state antifraud liability for misrepresentations made in connection with the offering.", explanation: "Wrong - antifraud liability is never waived; exempt status only relieves the registration/filing burden, not fraud accountability." },
      { text: "Any requirement that a firm effecting transactions in the security be a registered broker-dealer.", explanation: "Wrong - the Securities Act exemption addresses registration of the offering, not registration of the firms that trade it. Broker-dealer registration is governed separately by the Securities Exchange Act of 1934, and a firm in the business of effecting transactions in exempt securities still has its own registration obligations." },
      { text: "The requirement that trades in the security settle through a registered clearing agency.", explanation: "Wrong - settlement/clearing mechanics are unrelated to the Securities Act registration exemption; exempt securities still clear and settle normally." },
    ],
  },
  {
    id: "sieb-cm-x112",
    section: "capital-markets",
    q: "A transfer agent's core function in the capital markets is to:",
    a: "Maintain the official record of registered securities owners, and process the issuance, cancellation, and transfer of certificates or book-entry positions.",
    explanation: "A transfer agent keeps the issuer's official ownership records, handling the registration of new owners, cancellation of old certificates or positions upon transfer, and related recordkeeping such as processing name changes and lost-certificate replacements. This is distinct from a depository like DTC, which holds securities in book-entry form for broker-dealer participants, and from a clearing corporation, which nets and clears trades.",
    options: [
      { text: "Maintain the official record of registered securities owners, and process the issuance, cancellation, and transfer of certificates or book-entry positions.", explanation: "Correct - recordkeeping of registered ownership and processing transfers is the transfer agent's defining function." },
      { text: "Net and clear broker-dealer trades before they settle.", explanation: "Wrong - netting and clearing trades is the role of a clearing corporation such as NSCC, not a transfer agent." },
      { text: "Hold securities in book-entry form on behalf of broker-dealer participants.", explanation: "Wrong - that custodial/depository function belongs to DTC, not a transfer agent." },
      { text: "Set the federal funds rate target used in monetary policy.", explanation: "Wrong - the fed funds rate target is set by the FOMC; a transfer agent has no role in monetary policy." },
    ],
  },
];
