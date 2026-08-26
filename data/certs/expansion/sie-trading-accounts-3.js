// Additional SIE item bank content for section 3 — Trading, Customer Accounts
// and Prohibited Activities. This is batch 3 of 3 for the "trading-accounts"
// section, written to cover ground NOT already present in:
//   - data/certs/sie-bank.js (ids sieb-ta-01 through sieb-ta-44)
//   - data/certs/sie-bank-trading-accounts.js (ids sieb-ta-45 through sieb-ta-92)
//
// As the third slice of the topic space, this batch leans into material a real
// candidate actually gets wrong: AML/sanctions customer screening mechanics
// (OFAC/SDN, PEPs), Regulation SHO short-sale mechanics (locate, naked shorting,
// Rule 200(g) order marking), insider-trading affirmative defenses (Rule 10b5-1),
// new-issue restrictions (Rule 5130), order-routing transparency (SEC Rule 606),
// less-common prohibited practices (parking securities, commingling,
// front-running a research report), the tax-side wash sale rule vs. manipulative
// wash trading, and order-handling nuances (not-held and bunched orders).
//
// NOTE ON DATED FIGURES: no dollar thresholds, contribution limits, or AML
// reporting amounts appear here. The "pattern day trader" / $25,000 minimum-
// equity rule is deliberately NOT used — FINRA's Rule 4210 amendments (Reg
// Notice 26-10; SEC approval SR-FINRA-2025-017) eliminated the PDT designation
// and its equity requirement effective June 4, 2026, replacing them with
// intraday margin standards, so testing the old mechanism would now be wrong.
// Settlement is treated as T+1 throughout.
//
// Ground deliberately avoided as already covered in batch 2
// (data/certs/expansion/sie-trading-accounts-2.js): backing away / firm quote
// obligation (x214), information barriers (x215), Rule 5320 trading ahead
// (x201), and held-order defaults (x202).
//
// id scheme: sieb-ta-x301 through sieb-ta-x315 (reserved range, batch 3 of 3).

export const SIE_TRADING_ACCOUNTS_X3 = [
  {
    id: "sieb-ta-x301",
    section: "trading-accounts",
    q: "As part of ongoing AML compliance, a firm screens new and existing customers against the OFAC Specially Designated Nationals (SDN) list primarily to:",
    a: "Identify and block transactions or relationships with sanctioned individuals, entities, or countries",
    explanation: "OFAC administers U.S. economic sanctions programs; screening against the SDN list is how firms avoid doing business with parties the U.S. government has specifically prohibited transacting with.",
    options: [
      { text: "Identify and block transactions or relationships with sanctioned individuals, entities, or countries", explanation: "Correct — this is the purpose of OFAC/SDN screening." },
      { text: "Verify the customer's investment objectives and risk tolerance", explanation: "That's the purpose of new-account suitability information, not sanctions screening." },
      { text: "Determine the customer's eligibility for margin privileges", explanation: "Margin eligibility is a separate credit/suitability decision, unrelated to sanctions screening." },
      { text: "Calculate the customer's cost basis for tax reporting", explanation: "Cost basis tracking is a tax-reporting function, unrelated to OFAC screening." },
    ],
  },
  {
    id: "sieb-ta-x302",
    section: "trading-accounts",
    q: "During account opening, a firm identifies a prospective customer as a politically exposed person (PEP) — a senior foreign political figure. This designation generally requires the firm to:",
    a: "Apply enhanced due diligence and closer ongoing monitoring of the account's activity",
    explanation: "PEPs present a heightened risk of bribery or corruption-linked funds, so firms apply extra scrutiny at opening and afterward, rather than treating the account as routine.",
    options: [
      { text: "Apply enhanced due diligence and closer ongoing monitoring of the account's activity", explanation: "Correct — heightened scrutiny is required for PEP accounts." },
      { text: "Automatically refuse to open the account under all circumstances", explanation: "PEP status triggers extra diligence, not an automatic, blanket refusal to open the account." },
      { text: "Waive the standard identity verification requirements", explanation: "This reverses the actual effect — PEP status increases scrutiny rather than waiving it." },
      { text: "Report the account directly to a foreign government", explanation: "AML obligations run to the firm's own regulators and FinCEN, not to a foreign government." },
    ],
  },
  {
    id: "sieb-ta-x303",
    section: "trading-accounts",
    q: "Before executing a short sale under Regulation SHO, a broker-dealer must generally have reasonable grounds to believe the security can be borrowed for delivery. This requirement is known as the:",
    a: "Locate requirement",
    explanation: "The locate requirement forces the firm to have a credible basis for borrowability before the short sale is even placed, which is the core mechanism Reg SHO uses to curb abusive short selling.",
    options: [
      { text: "Locate requirement", explanation: "Correct — this is the name of the Reg SHO pre-trade obligation." },
      { text: "Hypothecation requirement", explanation: "Hypothecation is about pledging margin securities as loan collateral, unrelated to short-sale borrowing." },
      { text: "Best execution requirement", explanation: "Best execution concerns getting favorable terms on an order, not confirming a security can be borrowed to short." },
      { text: "Suitability requirement", explanation: "Suitability concerns whether a recommendation fits the customer, not the mechanics of borrowing for a short sale." },
    ],
  },
  {
    id: "sieb-ta-x304",
    section: "trading-accounts",
    q: "A broker-dealer sells a customer shares short without ever having reasonable grounds to believe the shares could be borrowed and delivered. This practice is known as:",
    a: "Naked short selling, a practice restricted under Regulation SHO",
    explanation: "Naked short selling skips the locate step entirely, increasing the risk of undelivered shares (fails-to-deliver) and is specifically restricted by Reg SHO.",
    options: [
      { text: "Naked short selling, a practice restricted under Regulation SHO", explanation: "Correct — this is the definition of naked short selling." },
      { text: "A routine and fully unrestricted trading technique", explanation: "It's specifically restricted, not an unrestricted, routine technique." },
      { text: "Marking the close", explanation: "Marking the close targets the closing print of a security, an unrelated manipulative practice." },
      { text: "Free-riding", explanation: "Free-riding is a cash-account payment violation involving buying and selling without ever funding the purchase, a different mechanism than short-sale borrowing." },
    ],
  },
  {
    id: "sieb-ta-x305",
    section: "trading-accounts",
    q: "Rule 201 of Regulation SHO (the 'alternative uptick rule') imposes a short-sale price test on a covered security once a circuit breaker is triggered. That circuit breaker is triggered when the security's price declines:",
    a: "10% or more from the prior day's closing price, after which short sales may generally only be displayed or executed above the current national best bid",
    explanation: "Rule 201 does not ban short selling after a sharp decline — it restricts the price at which shorts may occur. A drop of 10% or more from the prior day's close triggers the price test, and short sale orders may then generally only be displayed or executed at a price above the national best bid, for the remainder of that day and the following day.",
    options: [
      { text: "10% or more from the prior day's closing price, after which short sales may generally only be displayed or executed above the current national best bid", explanation: "Correct — a 10% decline from the prior close triggers the price test, which permits short sales only above the national best bid." },
      { text: "10% or more from the prior day's closing price, after which all short selling in that security is prohibited for the remainder of the day", explanation: "The trigger is right but the consequence is wrong — Rule 201 restricts the price at which short sales may occur rather than banning them outright." },
      { text: "2% or more from the prior day's closing price, after which short selling is suspended for five trading days", explanation: "Both the threshold and the consequence are wrong; Rule 201 uses a 10% decline and imposes a price test, not a multi-day suspension." },
      { text: "20% or more from the security's 52-week high, after which the security is automatically halted", explanation: "Rule 201 measures against the prior day's closing price, not a 52-week high, and it imposes a price test rather than a trading halt." },
    ],
  },
  {
    id: "sieb-ta-x306",
    section: "trading-accounts",
    q: "A corporate insider trades company stock under a written plan, adopted in good faith while not in possession of material non-public information, that pre-specifies the amount, price, and timing of future trades. This arrangement can provide an affirmative defense to insider trading liability and is known as a:",
    a: "Rule 10b5-1 trading plan",
    explanation: "A properly adopted 10b5-1 plan lets an insider trade on a predetermined schedule, providing a defense because the trading decisions were locked in before any later material non-public information existed.",
    options: [
      { text: "Rule 10b5-1 trading plan", explanation: "Correct — this is the mechanism providing the affirmative defense." },
      { text: "Discretionary trading authorization", explanation: "That's an unrelated concept letting a rep trade a customer account at their own judgment, not an insider-trading defense." },
      { text: "Loan consent agreement", explanation: "That's a margin-account document permitting the firm to lend out securities, unrelated to insider trading." },
      { text: "Numbered account agreement", explanation: "That concerns coding an account without the owner's name on it, unrelated to insider-trading defenses." },
    ],
  },
  {
    id: "sieb-ta-x307",
    section: "trading-accounts",
    q: "FINRA Rule 5130 generally prohibits a member firm from selling shares of a new issue (an initial public offering of equity securities) to an account in which a 'restricted person' holds a beneficial interest. Restricted persons include:",
    a: "Member firms, their associated persons, and certain immediate family members of those associated persons",
    explanation: "Rule 5130 protects the integrity of the public offering process by keeping industry insiders — and immediate family members they support or who support them — from taking IPO allocations that are supposed to reach public investors.",
    options: [
      { text: "Member firms, their associated persons, and certain immediate family members of those associated persons", explanation: "Correct — Rule 5130 restricts industry insiders and specified immediate family members from buying new issues." },
      { text: "Any investor who has never previously purchased an initial public offering", explanation: "Being new to IPO investing is not a restriction — the rule targets industry insiders, not inexperienced public investors." },
      { text: "All customers who maintain a margin account at the member firm", explanation: "Account type is irrelevant to Rule 5130; the restriction turns on the person's relationship to the securities industry." },
      { text: "Institutional investors such as pension funds and mutual funds", explanation: "These are exactly the kind of public investors IPO shares are meant to reach; they are not restricted persons merely by being institutions." },
    ],
  },
  {
    id: "sieb-ta-x308",
    section: "trading-accounts",
    q: "An individual holds securities in their own account but secretly agrees with the true owner to conceal that owner's actual beneficial ownership or control — often to help evade reporting or disclosure obligations. This arrangement is known as:",
    a: "Parking securities, a prohibited practice",
    explanation: "Parking disguises who really owns or controls a position, which can be used to sidestep ownership-disclosure, position-limit, or other regulatory requirements — a distinct manipulative/fraudulent practice.",
    options: [
      { text: "Parking securities, a prohibited practice", explanation: "Correct — this is the definition of parking securities." },
      { text: "A standard custodial arrangement for a minor", explanation: "A custodial account is transparent about the custodian's role; parking specifically hides true ownership, which a custodial account does not do." },
      { text: "Hypothecation", explanation: "Hypothecation is pledging margin securities as loan collateral, an unrelated and legitimate margin mechanism." },
      { text: "A numbered account with proper disclosure on file", explanation: "A properly disclosed numbered account still identifies the true owner to the firm; parking is designed to conceal that ownership." },
    ],
  },
  {
    id: "sieb-ta-x309",
    section: "trading-accounts",
    q: "A broker-dealer deposits customer cash into its own general operating account instead of keeping it properly segregated as required by the Customer Protection Rule. This is known as:",
    a: "Commingling of customer funds, a serious violation of customer asset segregation requirements",
    explanation: "The Customer Protection Rule requires customer cash and fully paid securities to be kept separate from the firm's own assets; mixing them together exposes customer property to the firm's own business risk.",
    options: [
      { text: "Commingling of customer funds, a serious violation of customer asset segregation requirements", explanation: "Correct — this is the definition of commingling." },
      { text: "A routine bookkeeping convenience with no regulatory significance", explanation: "This mischaracterizes a serious violation as a harmless convenience." },
      { text: "Churning", explanation: "Churning concerns excessive trading in a customer's account for commissions, a different violation from mixing customer and firm funds." },
      { text: "Free-riding", explanation: "Free-riding is a cash-account payment violation, unrelated to how the firm holds and segregates customer funds." },
    ],
  },
  {
    id: "sieb-ta-x310",
    section: "trading-accounts",
    q: "A customer sells a stock at a loss and, within the disallowance window before or after that sale, buys back a substantially identical security. Under the tax code's wash sale rule, this generally results in:",
    a: "Disallowance of the loss for current tax purposes, with the disallowed loss added to the cost basis of the newly purchased shares",
    explanation: "The wash sale rule blocks an immediate tax loss on a sale followed by a purchase of substantially the same security around the same time, but preserves the economic loss by folding it into the new position's cost basis rather than eliminating it forever.",
    options: [
      { text: "Disallowance of the loss for current tax purposes, with the disallowed loss added to the cost basis of the newly purchased shares", explanation: "Correct — this is how the wash sale rule treats the loss." },
      { text: "An automatic FINRA enforcement action for market manipulation", explanation: "This confuses a tax-reporting rule with manipulative wash trading between separate parties — they are different concepts entirely." },
      { text: "No effect at all on the customer's taxes", explanation: "The wash sale rule specifically does affect the customer's ability to currently deduct the loss." },
      { text: "Permanent forfeiture of the loss with no future tax benefit", explanation: "The loss isn't lost forever — it's deferred by being added to the replacement shares' cost basis." },
    ],
  },
  {
    id: "sieb-ta-x311",
    section: "trading-accounts",
    q: "Under SEC Rule 606 of Regulation NMS, a broker-dealer that routes customers' held orders in equity securities must make publicly available, on a quarterly basis, a report disclosing:",
    a: "The venues to which customer orders were routed and the material aspects of any payment for order flow arrangements",
    explanation: "Rule 606(a) requires a free, publicly posted quarterly report of aggregated order-routing data, including the terms of payment for order flow and profit-sharing arrangements, so customers can evaluate order-handling quality and the conflicts of interest behind routing decisions.",
    options: [
      { text: "The venues to which customer orders were routed and the material aspects of any payment for order flow arrangements", explanation: "Correct — Rule 606(a) quarterly reports disclose routing venues and payment for order flow terms." },
      { text: "Each individual customer's name, account number, and complete order history", explanation: "Rule 606(a) reports are aggregated and public — disclosing individual customers' identities and order histories would violate customer confidentiality, not satisfy the rule." },
      { text: "The firm's projected trading revenue for the upcoming quarter", explanation: "Rule 606 is an order-routing transparency rule, not a financial forecasting or earnings-disclosure requirement." },
      { text: "The personal securities trading activity of the firm's registered representatives", explanation: "Employee personal trading is monitored through separate internal and Rule 3210 account-disclosure requirements, not through public Rule 606 routing reports." },
    ],
  },
  {
    id: "sieb-ta-x312",
    section: "trading-accounts",
    q: "A customer gives a rep an order to buy a specific stock and quantity but tells the rep to use their own judgment on the exact timing and price, and specifically instructs the rep not to feel obligated to fill it if conditions look unfavorable. This is best described as a:",
    a: "Not-held order, which grants time-and-price discretion without requiring written discretionary account authorization",
    explanation: "A not-held order lets the rep use judgment on timing and price for that specific instruction, but because the security, side, and quantity were all specified by the customer, it does not require the full written discretionary authorization needed for asset/action/size discretion.",
    options: [
      { text: "Not-held order, which grants time-and-price discretion without requiring written discretionary account authorization", explanation: "Correct — this describes a not-held order and its distinction from full discretion." },
      { text: "Fully discretionary trade requiring prior written authorization on file", explanation: "Full discretionary authorization is required when the rep also chooses the asset, action, or size — none of which is delegated here." },
      { text: "An unauthorized trade", explanation: "The customer specifically authorized this instruction, so it isn't unauthorized trading." },
      { text: "A fill-or-kill order", explanation: "FOK is a time-in-force instruction requiring immediate full execution or cancellation, unrelated to delegating timing/price judgment to the rep." },
    ],
  },
  {
    id: "sieb-ta-x313",
    section: "trading-accounts",
    q: "A firm combines several individual customers' same-side orders in the same security into a single larger order for execution, then allocates the resulting shares to each customer at an average price. This practice is known as:",
    a: "Bunching (aggregating) orders, which is permitted provided the allocation method is fair and disclosed",
    explanation: "Bunching can improve execution and reduce costs across customers, but firms must have a fair, previously disclosed method for allocating the shares and average price among the participating accounts.",
    options: [
      { text: "Bunching (aggregating) orders, which is permitted provided the allocation method is fair and disclosed", explanation: "Correct — this describes bunched orders and the condition for permissibility." },
      { text: "Churning, since multiple customers' orders are combined", explanation: "Churning is about excessive trading in one customer's account for commissions, unrelated to combining separate customers' same-side orders." },
      { text: "Interpositioning", explanation: "Interpositioning involves inserting a needless third-party dealer, not combining customer orders together at the same firm." },
      { text: "A prohibited practice under all circumstances", explanation: "Bunching is permitted when done with a fair, disclosed allocation method — it isn't banned outright." },
    ],
  },
  {
    id: "sieb-ta-x314",
    section: "trading-accounts",
    q: "A rep at a firm's investment banking department, aware that the firm's research analysts are about to publish a report likely to move a stock's price, tips a friend to buy the stock ahead of the report's release. This is best characterized as:",
    a: "Front-running an anticipated research report, a violation of information barrier policies and FINRA rules",
    explanation: "Trading (or tipping) ahead of a firm's own soon-to-be-published research is a distinct front-running violation, separate from front-running a customer's pending block order, and is exactly what information barriers are meant to prevent.",
    options: [
      { text: "Front-running an anticipated research report, a violation of information barrier policies and FINRA rules", explanation: "Correct — this is front-running a research report." },
      { text: "A permitted use of internal firm information", explanation: "Using this internal, non-public information for personal or a friend's trading advantage is specifically prohibited, not permitted." },
      { text: "Selling away", explanation: "Selling away involves a rep selling securities not approved by the firm, unrelated to trading ahead of a research report." },
      { text: "Reverse churning", explanation: "Reverse churning concerns fee-based accounts with too little trading activity, an unrelated conflict of interest." },
    ],
  },
  {
    id: "sieb-ta-x315",
    section: "trading-accounts",
    q: "An exchange temporarily halts trading in a stock pending the release of material news, or after the price moves sharply in a short period. The primary purpose of such a trading halt is to:",
    a: "Allow material information to be disseminated (or volatility to stabilize) so trading can resume on a more informed and orderly basis",
    explanation: "Halts pause trading so that all market participants have a fair opportunity to absorb pending news or let a volatility spike settle, rather than letting trades occur on an uneven informational footing.",
    options: [
      { text: "Allow material information to be disseminated (or volatility to stabilize) so trading can resume on a more informed and orderly basis", explanation: "Correct — this is the purpose of a trading halt." },
      { text: "Permanently delist the security from the exchange", explanation: "A halt is a temporary pause in trading, not a permanent delisting action." },
      { text: "Guarantee that the price will rise once trading resumes", explanation: "A halt has no bearing on which direction the price moves once trading resumes." },
      { text: "Punish the company for poor recent performance", explanation: "Halts are triggered by pending news or volatility mechanics, not used as a punitive measure against a company." },
    ],
  },
];
