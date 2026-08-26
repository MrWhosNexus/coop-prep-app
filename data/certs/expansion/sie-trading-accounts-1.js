// SIE Section 3 expansion batch — trading-accounts (part 1 of 3)
//
// Scope bias for this batch: account-opening disclosure and documentation
// rules that the base bank does not reach (FINRA 2360 ODD delivery and the
// options agreement, 2264 margin disclosure statement, 2270 day-trading risk
// disclosure, 2090 know-your-customer, 4512 account information timing, 4514
// negotiable-instrument authorization, 3150 holding of customer mail),
// settlement/scope mechanics (which securities fall outside mandatory T+1
// under SEA Rule 15c6-1, prime brokerage), one uncovered order-type angle
// (buy stop as protection for a short seller), and margin mechanics beyond
// the initial/maintenance basics already banked (SMA behavior on a decline,
// Reg T call vs. house/maintenance call, who grants a margin call extension).
//
// Deliberately avoided as already banked elsewhere: GTC, MOC, when-issued,
// good delivery, TOD, corporate resolution, numbered accounts (FINRA 3250),
// free-riding, CIP, ACATS, JTWROS/TIC, confirmations (10b-10), account
// statements (2231), discretionary authority (3260), and the T+1 ex-dividend
// convention (already at sieb-pr2-07 in sie-bank-products-risks.js).
//
// All settlement references use T+1 (effective May 28, 2024). No dated
// dollar thresholds, contribution limits, or other year-sensitive figures
// are used anywhere in this batch.

export const SIE_TRADING_ACCOUNTS_X1 = [
  {
    id: "sieb-ta-x101",
    section: "trading-accounts",
    q: "A trade was booked to the wrong account and the firm wants to move it to the correct customer's account. Under FINRA Rule 4515, that change in account designation requires:",
    a: "Authorization by a qualified, designated registered principal who is personally informed of the essential facts and indicates approval in writing",
    explanation:
      "Rule 4515 exists because reassigning a trade after the fact is exactly how losing trades get shifted onto unwitting customers. No change in an account name or designation may be made unless a qualified registered principal designated by the member has authorized it, and that principal must be personally informed of the essential facts before approving and must record approval in writing. The essential facts relied upon must be documented and preserved under SEA Rule 17a-4(b).",
    options: [
      {
        text: "Authorization by a qualified, designated registered principal who is personally informed of the essential facts and indicates approval in writing",
        explanation:
          "Correct - Rule 4515 requires informed, written principal authorization, plus documentation of the essential facts relied upon.",
      },
      {
        text: "Nothing more than the registered representative's own correction of the order record",
        explanation:
          "The rep who booked the trade cannot self-approve the reassignment; the rule deliberately places the decision with a designated principal.",
      },
      {
        text: "Prior written permission from FINRA before the designation may be changed",
        explanation:
          "FINRA does not pre-approve individual account designation changes; the authorization is an internal supervisory function of the member.",
      },
      {
        text: "Written consent from both customers whose accounts are affected by the change",
        explanation:
          "Rule 4515 conditions the change on informed principal authorization and documentation, not on collecting consent from the customers involved.",
      },
    ],
  },
  {
    id: "sieb-ta-x102",
    section: "trading-accounts",
    q: "A customer's account has just been approved for options trading. Under FINRA Rule 2360, within what period must the member obtain the customer's signed options agreement?",
    a: "Within 15 days after the account is approved for options trading",
    explanation:
      "Rule 2360(b)(16)(D) — the subparagraph headed \"Account Agreement\" — gives the member 15 days from account approval to obtain a written agreement in which the customer acknowledges awareness of and agreement to be bound by the FINRA rules governing options trading and confirms receipt of the current disclosure document. Approval — and trading — can therefore precede the signed agreement, but only inside that window. Mind the letter if you go to the source: (b)(16)(B) is \"Diligence in Opening Accounts\", a real but different requirement.",
    options: [
      {
        text: "Within 15 days after the account is approved for options trading",
        explanation:
          "Correct - the 15-day window under Rule 2360(b)(16)(D) (\"Account Agreement\") runs from the date the account is approved for options trading.",
      },
      {
        text: "Before the account may be approved for options trading",
        explanation:
          "The signed agreement is not a precondition of approval; the rule expressly allows the member 15 days after approval to obtain it. The ODD, by contrast, must be delivered at or prior to approval.",
      },
      {
        text: "Within 15 days after the customer's first options transaction settles",
        explanation:
          "The clock runs from account approval, not from the settlement of any particular trade, so tying it to a transaction misstates when the period begins.",
      },
      {
        text: "There is no deadline; the signed agreement is optional for retail customers",
        explanation:
          "The written agreement is required, not optional, and Rule 2360 sets a definite period in which the member must obtain it.",
      },
    ],
  },
  {
    id: "sieb-ta-x103",
    section: "trading-accounts",
    q: "A customer's cash account has been frozen under Regulation T for 90 calendar days. During that period, the customer may buy securities only if:",
    a: "Sufficient funds are already in the account before the purchase order is entered",
    explanation:
      "The freeze under Reg T withdraws the privilege of delaying payment beyond the trade date for 90 calendar days. The customer is not barred from trading; they simply lose the ability to buy first and pay later, so the cash must be in the account up front. A creditor may apply to its examining authority for a waiver of the freeze.",
    options: [
      {
        text: "Sufficient funds are already in the account before the purchase order is entered",
        explanation:
          "Correct - what the freeze removes is the ability to delay payment past the trade date, so purchases must be funded in advance.",
      },
      {
        text: "The account is first converted into a margin account",
        explanation:
          "Converting the registration is not a cure for the freeze, and buying on credit is precisely the privilege the freeze is meant to withdraw.",
      },
      {
        text: "Each purchase is individually approved in advance by the SEC",
        explanation:
          "The SEC does not approve individual customer purchases; the freeze operates automatically as a condition on the account.",
      },
      {
        text: "No purchases are permitted at all during the 90 days, under any conditions",
        explanation:
          "The account is not shut down. It can still buy — the requirement is that the funds be in the account first, rather than paid after the trade.",
      },
    ],
  },
  {
    id: "sieb-ta-x104",
    section: "trading-accounts",
    q: "Under SEA Rule 17a-3(a)(17), after furnishing a customer a copy of their account record within 30 days of opening the account, how often must the firm furnish it again for verification?",
    a: "At intervals no greater than 36 months",
    explanation:
      "The books-and-records rule builds in a periodic accuracy check: the customer gets a copy of the account record (or an alternate document with the required information) within 30 days of account opening, and thereafter at intervals no greater than every 36 months, so stale suitability information gets surfaced and corrected. Separately, when a firm receives notice of a change in the account's investment objectives, it must furnish an updated record on or before the 30th day after that notice.",
    options: [
      {
        text: "At intervals no greater than 36 months",
        explanation:
          "Correct - the rule sets a recurring outer limit of 36 months between furnishings of the account record.",
      },
      {
        text: "At intervals no greater than 12 months",
        explanation:
          "An annual cycle is the frequency other rules impose for certain disclosures (such as the margin disclosure statement under FINRA Rule 2264), not the account-record verification interval in Rule 17a-3(a)(17).",
      },
      {
        text: "Only when the customer submits a written request for a copy",
        explanation:
          "The furnishing obligation is periodic and firm-initiated; it does not wait on a customer request.",
      },
      {
        text: "Never again after the initial 30-day furnishing",
        explanation:
          "The rule expressly continues past the initial furnishing, which is the point of the recurring interval.",
      },
    ],
  },
  {
    id: "sieb-ta-x105",
    section: "trading-accounts",
    q: "FINRA Rule 2090 requires a member to use reasonable diligence to know the essential facts concerning every customer. This obligation applies:",
    a: "In regard to the opening and maintenance of every account, whether or not the member ever makes a recommendation",
    explanation:
      "Rule 2090 is the know-your-customer rule, and its trigger is the account relationship itself: reasonable diligence in the opening and maintenance of every account. That distinguishes it from the suitability rule (Rule 2111), which is triggered by a recommendation. 'Essential facts' are those needed to effectively service the account, act on any special handling instructions, understand the authority of each person acting for the customer, and comply with applicable laws and rules.",
    options: [
      {
        text: "In regard to the opening and maintenance of every account, whether or not the member ever makes a recommendation",
        explanation:
          "Correct - the KYC obligation attaches to opening and maintaining the account and does not depend on a recommendation being made.",
      },
      {
        text: "Only when the member makes a recommendation to the customer",
        explanation:
          "A recommendation is the trigger for the suitability obligation under Rule 2111, not for the know-your-customer obligation under Rule 2090.",
      },
      {
        text: "Only at the moment the account is opened, with no ongoing obligation afterward",
        explanation:
          "The rule expressly covers the maintenance of the account as well as its opening, so the diligence obligation continues through the relationship.",
      },
      {
        text: "Only to institutional accounts, as defined in Rule 4512(c)",
        explanation:
          "Rule 2090 refers to every customer and every account; it is not confined to institutional accounts.",
      },
    ],
  },
  {
    id: "sieb-ta-x106",
    section: "trading-accounts",
    q: "An institutional customer places orders with several different executing brokers but designates one firm as its prime broker. The prime broker's role is to:",
    a: "Clear and settle the trades executed away and hold the customer's cash and securities in one consolidated account",
    explanation:
      "Under the SEC staff's prime brokerage framework, the customer may execute with any number of executing brokers and have those trades 'given up' to the designated prime broker, which clears and settles them, custodies the assets, provides financing, and produces a single consolidated account record. If the prime broker declines ('disaffirms') a trade, the executing broker must look to the customer for settlement.",
    options: [
      {
        text: "Clear and settle the trades executed away and hold the customer's cash and securities in one consolidated account",
        explanation:
          "Correct - consolidation of clearance, settlement, and custody across trades executed at other firms is the defining function of the prime broker.",
      },
      {
        text: "Execute all of the customer's orders itself, so that no other broker-dealer is involved",
        explanation:
          "This reverses the arrangement: the whole point is that the customer executes with other firms and the prime broker clears and settles those trades.",
      },
      {
        text: "Choose which securities the customer buys and sells, exercising discretion over the account",
        explanation:
          "Prime brokerage is a clearing, settlement, and custody arrangement; it confers no investment discretion, which would require separate written authorization.",
      },
      {
        text: "Guarantee the customer against loss on any trade that it clears",
        explanation:
          "No such guarantee is part of prime brokerage; market risk on every position stays with the customer.",
      },
    ],
  },
  {
    id: "sieb-ta-x107",
    section: "trading-accounts",
    q: "Which of the following is exempt from the SEC's mandatory T+1 standard settlement cycle under Rule 15c6-1?",
    a: "Municipal securities, government securities, and commercial paper",
    explanation:
      "Rule 15c6-1's mandatory settlement timeline applies broadly to equities, corporate bonds, unit investment trusts, mutual funds, ETFs, ADRs, and options. It expressly carves out exempted securities, government securities, municipal securities, and commercial paper/bankers' acceptances/commercial bills, which are not subject to the rule's mandatory cycle.",
    options: [
      {
        text: "Municipal securities, government securities, and commercial paper",
        explanation:
          "Correct - Rule 15c6-1(a) does not apply to these instruments; they fall outside the mandatory settlement-cycle requirement.",
      },
      {
        text: "Common stock and exchange-traded funds",
        explanation:
          "Common stock and ETFs are squarely within the scope of the mandatory T+1 settlement cycle, not exempt from it.",
      },
      {
        text: "Corporate bonds and unit investment trusts",
        explanation:
          "Corporate bonds and UITs are covered securities under Rule 15c6-1 and settle on the standard cycle, not exempt from it.",
      },
      {
        text: "Listed equity options",
        explanation:
          "Listed options are covered by the standard settlement cycle requirement; they are not among the rule's carve-outs.",
      },
    ],
  },
  {
    id: "sieb-ta-x108",
    section: "trading-accounts",
    q: "Under FINRA Rule 2270, which member must furnish the day-trading risk disclosure statement to a non-institutional customer before opening the account?",
    a: "A member that promotes a day-trading strategy, directly or indirectly",
    explanation:
      "Rule 2270's trigger is the member's own promotion of a day-trading strategy, not the customer's trading history. A member promoting such a strategy may not open an account for a non-institutional customer unless it has furnished the disclosure statement beforehand, and it must also post the statement conspicuously on its website. Firms that do not promote day trading are outside the rule.",
    options: [
      {
        text: "A member that promotes a day-trading strategy, directly or indirectly",
        explanation:
          "Correct - the obligation attaches to members promoting a day-trading strategy, whether that promotion is direct or indirect.",
      },
      {
        text: "Every member, for every account it opens, regardless of the strategies it promotes",
        explanation:
          "The rule is not universal; it reaches only members that promote a day-trading strategy, which is why a firm that does no such promotion is not covered.",
      },
      {
        text: "Only a member opening an account for a customer who already qualifies as a pattern day trader",
        explanation:
          "This confuses Rule 2270's promotion-based trigger with the separate margin classification of a pattern day trader; the customer's existing status is not what invokes the disclosure duty.",
      },
      {
        text: "Only a member whose non-institutional customers trade exclusively in margin accounts",
        explanation:
          "Nothing in Rule 2270 turns on whether the firm's customers use margin exclusively; the trigger is promotion of a day-trading strategy.",
      },
    ],
  },
  {
    id: "sieb-ta-x109",
    section: "trading-accounts",
    q: "Before a broker-dealer may accept trading instructions from a trustee on a trust account, the firm must generally review:",
    a: "The trust document (or a certification of trust) to confirm the trustee's authority and any limitations on that authority",
    explanation:
      "Because a trustee acts on behalf of the trust's beneficiaries rather than for themselves, the firm needs to verify — through the trust agreement or a certification of trust — who is authorized to act as trustee and what powers the trust document grants or restricts before allowing trading in the account.",
    options: [
      {
        text: "The trust document (or a certification of trust) to confirm the trustee's authority and any limitations on that authority",
        explanation:
          "Correct - the firm must establish that the person giving instructions is in fact an authorized trustee and understand the scope of their authority under the trust.",
      },
      {
        text: "Only the trustee's personal credit report",
        explanation:
          "A personal credit report says nothing about whether someone has legal authority to act as trustee for the trust; the trust document itself establishes that authority.",
      },
      {
        text: "Nothing beyond the trustee's verbal assertion that they are authorized",
        explanation:
          "Firms cannot rely solely on a verbal claim of authority; documentary evidence of trustee status and powers is required before trading begins.",
      },
      {
        text: "Written consent from every beneficiary of the trust before each individual trade",
        explanation:
          "Beneficiaries typically do not need to approve each trade; the trustee's authority to trade comes from the trust document itself, not case-by-case beneficiary consent.",
      },
    ],
  },
  {
    id: "sieb-ta-x110",
    section: "trading-accounts",
    q: "Under FINRA Rule 4514, before a member may submit for payment a check or other negotiable instrument drawn on a customer's bank account, the member must have:",
    a: "The customer's express written authorization, which may take the form of the customer's signature on the negotiable instrument itself",
    explanation:
      "Rule 4514 bars a member or associated person from obtaining or submitting for payment any check, draft, or other negotiable paper drawn on a customer's checking, savings, share, or similar account without that person's express written authorization. Where the authorization is a document separate from the instrument, the member must preserve it for three years after the authorization expires.",
    options: [
      {
        text: "The customer's express written authorization, which may take the form of the customer's signature on the negotiable instrument itself",
        explanation:
          "Correct - express written authorization is required, and the customer's signature on the instrument can supply it.",
      },
      {
        text: "The customer's verbal approval, documented in the representative's own notes",
        explanation:
          "A note memorializing a verbal approval is not express written authorization from the customer, which is what the rule demands.",
      },
      {
        text: "Written approval from FINRA staff for each individual payment",
        explanation:
          "FINRA does not approve individual customer payments; the required authorization comes from the customer, not the regulator.",
      },
      {
        text: "A registered principal's approval, with no authorization needed from the customer",
        explanation:
          "Internal supervisory approval cannot substitute for the customer's own written authorization to draw on their bank account.",
      },
    ],
  },
  {
    id: "sieb-ta-x111",
    section: "trading-accounts",
    q: "A customer signs a limited power of attorney (POA) authorizing another person to trade their brokerage account. This POA generally:",
    a: "Grants trading authority over the account without transferring beneficial ownership of the assets to the person named",
    explanation:
      "A limited (or 'special') power of attorney over a brokerage account authorizes the named agent to enter orders and otherwise act in the account, but the underlying assets remain the property of the account owner. It does not make the agent an owner and typically does not extend to non-trading actions like withdrawing funds to the agent's own account.",
    options: [
      {
        text: "Grants trading authority over the account without transferring beneficial ownership of the assets to the person named",
        explanation:
          "Correct - a trading POA delegates authority to act in the account; it does not convey ownership of the account's assets.",
      },
      {
        text: "Automatically makes the person named a joint owner of the account",
        explanation:
          "A POA is an authorization to act, not a change in account ownership or titling; joint ownership would require a separate account registration.",
      },
      {
        text: "Permits the agent to withdraw account funds for their own personal use",
        explanation:
          "Trading authority under a POA does not include a license to divert account assets to the agent's own benefit; doing so would be a serious violation regardless of the POA.",
      },
      {
        text: "Remains valid and enforceable even after the account owner formally revokes it",
        explanation:
          "A power of attorney can be revoked by the account owner at any time; once revoked, the agent no longer has authority to act in the account.",
      },
    ],
  },
  {
    id: "sieb-ta-x112",
    section: "trading-accounts",
    q: "A retail investor opens their first margin account. Under FINRA Rule 2264, the firm's margin disclosure statement obligation is satisfied by delivering it:",
    a: "Prior to or at the time of opening the account, and at least once each calendar year thereafter",
    explanation:
      "Rule 2264 requires the margin disclosure statement to be delivered individually, in a separate document (or by itself on a separate page of another document), prior to or at the time the margin account is opened for a non-institutional customer. It also imposes an ongoing duty: the statement or the specified bolded disclosures must be delivered to such customers with a frequency of not less than once per calendar year, and that annual delivery may ride along with other documentation such as an account statement.",
    options: [
      {
        text: "Prior to or at the time of opening the account, and at least once each calendar year thereafter",
        explanation:
          "Correct - Rule 2264 imposes both the delivery at account opening and a recurring annual delivery obligation.",
      },
      {
        text: "Prior to opening the account only, with no further delivery required afterward",
        explanation:
          "This captures the opening requirement but misses the rule's annual delivery obligation to non-institutional customers with margin accounts.",
      },
      {
        text: "Only at the time the customer first receives a margin call",
        explanation:
          "The disclosure is meant to inform the customer of margin's risks before they take them on, so it cannot wait until a call has already been issued.",
      },
      {
        text: "Only if the customer requests it in writing",
        explanation:
          "Delivery is mandatory for non-institutional margin customers under Rule 2264; it does not depend on a customer request.",
      },
    ],
  },
  {
    id: "sieb-ta-x113",
    section: "trading-accounts",
    q: "For a new non-institutional account, FINRA Rule 4512 requires the member to make reasonable efforts to obtain the customer's tax identification number, occupation and employer, and whether the customer is an associated person of another member. By when?",
    a: "Prior to the settlement of the initial transaction in the account",
    explanation:
      "Rule 4512(a)(2) sets the deadline at settlement of the account's first transaction, and the standard is 'reasonable efforts' rather than an absolute bar on trading. Separately, Rule 4512(a)(1)(D) requires the account record to carry the signature of a partner, officer, or manager denoting that the account has been accepted in accordance with the member's own acceptance policies.",
    options: [
      {
        text: "Prior to the settlement of the initial transaction in the account",
        explanation:
          "Correct - Rule 4512(a)(2) ties the reasonable-efforts deadline to settlement of the account's first transaction.",
      },
      {
        text: "Prior to the entry of any order, without exception",
        explanation:
          "The rule's deadline is settlement of the initial transaction, not order entry, and it is framed as reasonable efforts rather than an absolute precondition to trading.",
      },
      {
        text: "Within 30 calendar days after the account's first transaction settles",
        explanation:
          "There is no 30-day grace period after settlement; the reasonable-efforts obligation runs up to settlement of that first transaction, not past it.",
      },
      {
        text: "Never - this information is optional for every type of account",
        explanation:
          "The information is required for non-institutional accounts. Certain accounts (institutional accounts, and accounts limited to non-recommended open-end fund transactions) are carved out, but that is a scope limit, not a blanket option.",
      },
    ],
  },
  {
    id: "sieb-ta-x114",
    section: "trading-accounts",
    q: "A margin account has built up a balance in its Special Memorandum Account (SMA). The market value of the securities held in the account then falls sharply. The SMA balance:",
    a: "Is unchanged, because SMA is not reduced by a decline in the market value of positions",
    explanation:
      "SMA behaves like a line of credit rather than a balance that floats with the market. Once created — by appreciation in marginable securities, a cash or dividend credit, or a sale — it stays on the books until the customer actually uses it by withdrawing cash or making a new purchase. A later drop in market value does not erase it, even though that same drop may push the account's equity down toward a maintenance call.",
    options: [
      {
        text: "Is unchanged, because SMA is not reduced by a decline in the market value of positions",
        explanation:
          "Correct - SMA is decreased by the customer using it (withdrawal or purchase), not by market depreciation.",
      },
      {
        text: "Falls by the same dollar amount as the decline in market value",
        explanation:
          "That describes the account's equity, which does move dollar for dollar with market value; SMA does not track market value that way.",
      },
      {
        text: "Is automatically reset to zero as soon as any decline occurs",
        explanation:
          "No such reset happens; SMA persists through market declines and remains available to the customer.",
      },
      {
        text: "Becomes immediately repayable to the firm in cash",
        explanation:
          "SMA is not a debt owed to the firm - it is a record of the customer's own usable excess equity, so a decline creates no repayment obligation tied to it.",
      },
    ],
  },
  {
    id: "sieb-ta-x115",
    section: "trading-accounts",
    q: "How does a Regulation T margin call differ from a maintenance (house) margin call?",
    a: "A Reg T call is triggered by a new purchase and is federally mandated, while a maintenance call is triggered by equity falling below an SRO or house minimum",
    explanation:
      "A Reg T call is triggered at the time of a new margin purchase, requiring the customer to deposit the federally required initial margin. A maintenance call, by contrast, can arise at any time equity in an existing position drops below the required minimum — a minimum that firms are free to set higher than the regulatory floor through their own house maintenance requirements.",
    options: [
      {
        text: "A Reg T call is triggered by a new purchase and is federally mandated, while a maintenance call is triggered by equity falling below an SRO or house minimum",
        explanation:
          "Correct - the two calls are triggered by different events and are governed by different sources of authority (federal Reg T versus SRO/house minimums).",
      },
      {
        text: "They are two names for exactly the same requirement, triggered under identical circumstances",
        explanation:
          "They are distinct requirements with different triggers and different governing rules; treating them as identical overlooks how each arises.",
      },
      {
        text: "A maintenance call can only be issued by the Federal Reserve Board, never by the broker-dealer",
        explanation:
          "Maintenance requirements are enforced directly by the broker-dealer (subject to FINRA minimums and often stricter house rules); the Federal Reserve Board does not issue individual maintenance calls.",
      },
      {
        text: "A Reg T call is only issued when a customer's account is closed, while a maintenance call is only issued when an account is opened",
        explanation:
          "Neither call is tied to account opening or closing; a Reg T call follows a new purchase and a maintenance call follows a decline in equity on existing positions.",
      },
    ],
  },
  {
    id: "sieb-ta-x116",
    section: "trading-accounts",
    q: "A broker-dealer needs additional time for a customer to meet a Regulation T margin call. From whom must the firm request an extension?",
    a: "A self-regulatory organization (such as an exchange or FINRA), under the applicable extension procedures",
    explanation:
      "Broker-dealers cannot unilaterally waive or extend a Reg T deposit deadline. Extensions of time must be requested from and granted by a designated examining authority or self-regulatory organization under its extension rules; if no extension is obtained and the customer does not meet the call in time, the firm generally must liquidate enough of the position to cover the deficiency and may restrict the account going forward.",
    options: [
      {
        text: "A self-regulatory organization (such as an exchange or FINRA), under the applicable extension procedures",
        explanation:
          "Correct - extension requests go through the firm's designated examining authority or another SRO, not through an informal internal decision.",
      },
      {
        text: "The customer's employer",
        explanation:
          "The customer's employer has no role whatsoever in granting margin call extensions; this is a securities-industry regulatory process.",
      },
      {
        text: "The customer themselves, who may simply grant themselves more time",
        explanation:
          "A customer cannot excuse their own margin call deadline; only a self-regulatory organization can approve an extension under its rules.",
      },
      {
        text: "No extension is ever available under any circumstances; the call must always be met by the original deadline or the position is liquidated",
        explanation:
          "Extensions are in fact available through the proper SRO channels; the call deadline is not absolutely rigid, though liquidation can follow if no extension is obtained and the call goes unmet.",
      },
    ],
  },
];
