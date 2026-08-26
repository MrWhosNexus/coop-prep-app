// Additional SIE item bank content for section 3 — Trading, Customer Accounts
// and Prohibited Activities. This is batch 2 of 3 for the "trading-accounts"
// section expansion. It deliberately avoids ground already covered in
// data/certs/sie-bank.js (ids sieb-ta-01 through sieb-ta-44) and
// data/certs/sie-bank-trading-accounts.js (ids sieb-ta-45 through sieb-ta-92),
// which together already cover: basic order types (market/limit/stop/stop-
// limit), time-in-force (day/GTC/AON/FOK/IOC), short selling basics, regular-
// way settlement (T+1), cash vs. margin account basics, Reg T initial margin,
// FINRA maintenance margin, restricted accounts, SMA, hypothecation, account
// registrations (individual, joint, TOD, trust, custodial, corporate,
// partnership, numbered), discretionary vs. non-discretionary authorization,
// Form CRS, Reg BI, CIP, AML/SAR/structuring, and most of the headline
// prohibited-activities list (insider trading, churning, reverse churning,
// wash trading, matched orders, painting the tape, marking the close,
// spoofing, front-running, unauthorized trading, guarantees against loss,
// selling away, sharing accounts, commingling, pump-and-dump, IPO spinning,
// free-riding, interpositioning, best execution, the 5% markup policy,
// principal/agent capacity, and gifts & gratuities).
//
// This batch (part 2 of 3) instead favors the SECOND slice of the section's
// scope: less-drilled order-handling mechanics (held vs. not-held default,
// reserve/iceberg, odd lots, DVP/RVP), the customer-protection and
// account-administration rules that rarely get drilled (Rule 5320 Manning,
// Rule 2231 statements, Rule 2360 ODD delivery, Rule 3150 mail holds,
// Rule 15g-2 penny stock disclosure, Reg T payment period), rules covering
// vulnerable or dual-registered customers (Rules 2165, 4512, 3210), and
// capping as a manipulation a candidate is likely to miss.
//
// Deliberately NOT used here, because sibling files in this directory already
// cover them: market-on-close, when-issued trading, good delivery
// (sie-trading-accounts-1.js); backing away, information barriers, not-held
// orders, Reg SHO locate/naked shorting/order marking
// (sie-trading-accounts-3.js). ACATS in-kind transfer is sieb-ta-78, trade
// confirmation contents sieb-ta-77, and free-riding/frozen accounts
// sieb-ta-91 in the main bank.
//
// NOTE ON DATED FIGURES: no dollar thresholds, contribution limits, or AML
// reporting amounts appear here. The classic "pattern day trader" / $25,000
// minimum-equity rule was deliberately NOT used — FINRA's amendments to Rule
// 4210 eliminated the pattern day trader designation and that equity
// requirement effective June 4, 2026, so testing the old mechanism would now
// be affirmatively wrong. Settlement is treated as T+1 throughout.
//
// id scheme: sieb-ta-x201 through sieb-ta-x215 (reserved range, no collision
// with any other batch).

export const SIE_TRADING_ACCOUNTS_X2 = [
  {
    id: "sieb-ta-x201",
    section: "trading-accounts",
    q: "A member firm accepts and holds a customer's limit order to buy an equity security without immediately executing it, then buys that same security for the firm's own proprietary account at a price that would have satisfied the customer's order. Under FINRA Rule 5320, the firm must:",
    a: "Immediately thereafter execute the customer's order up to the size and at the same or better price at which it traded for its own account",
    explanation: "Rule 5320 (the 'Manning' rule) does not flatly ban proprietary trading alongside a held customer order — it requires that if the firm trades for itself at a price that would have satisfied the customer, it must then fill the customer up to that size at the same or better price, so the customer is not disadvantaged.",
    options: [
      { text: "Immediately thereafter execute the customer's order up to the size and at the same or better price at which it traded for its own account", explanation: "Correct — this is the remedy Rule 5320 requires when a firm trades ahead of a held customer order." },
      { text: "Cancel the customer's order and require the customer to re-enter it", explanation: "Rule 5320 protects the customer's order; cancelling it would penalize the customer for the firm's own proprietary trade." },
      { text: "Do nothing, because a firm's proprietary account always has priority over customer orders", explanation: "This reverses the rule — customer orders are the ones protected, and the firm's proprietary trading is what is constrained." },
      { text: "Report the trade to the SEC within one business day and retain the proprietary shares", explanation: "The rule's remedy is executing the customer's order at the same or better price, not a filing that leaves the customer unfilled." },
    ],
  },
  {
    id: "sieb-ta-x202",
    section: "trading-accounts",
    q: "Absent any special instruction from the customer, a standard order given to a broker-dealer is presumed to be:",
    a: "A 'held' order, meaning the firm must use diligence to execute it promptly at the best price obtainable, without exercising price/time discretion",
    explanation: "'Held' is the default status of an order — the firm is expected to work it right away rather than sit on it, unless the customer specifically grants discretion (making it a 'not held' order).",
    options: [
      { text: "A 'held' order, meaning the firm must use diligence to execute it promptly at the best price obtainable, without exercising price/time discretion", explanation: "Correct — 'held' is the default and requires prompt handling, not discretion." },
      { text: "A 'not held' order, giving the broker discretion over timing by default", explanation: "Discretion is only granted when the customer specifically instructs it — it is not the default assumption." },
      { text: "A discretionary account order requiring a power of attorney by default", explanation: "Ordinary orders don't default into discretionary-account status; that requires separate written authorization." },
      { text: "An order that can be executed at any time within the following week", explanation: "A held order without further instruction is a day order to be worked promptly, not one with an extended, open-ended window." },
    ],
  },
  {
    id: "sieb-ta-x203",
    section: "trading-accounts",
    q: "Under FINRA Rule 2231, how often must a general securities member send an account statement to a customer whose account has had activity since the last statement was sent?",
    a: "At least once every calendar quarter",
    explanation: "Quarterly is the regulatory floor, not the norm — many firms send statements monthly when there is activity, but Rule 2231 sets the minimum at once every calendar quarter for accounts with positions or activity.",
    options: [
      { text: "At least once every calendar quarter", explanation: "Correct — Rule 2231 sets a quarterly minimum for customer account statements." },
      { text: "At least once every three years", explanation: "This confuses a record-retention period with the frequency of statements sent to the customer." },
      { text: "Only when the customer submits a written request", explanation: "Statements must be sent on an ongoing periodic basis; they are not request-only for an active account." },
      { text: "Within one business day of every executed trade", explanation: "That approximates the trade confirmation requirement, which is a separate document from the periodic account statement." },
    ],
  },
  {
    id: "sieb-ta-x204",
    section: "trading-accounts",
    q: "A customer enters a large limit order but instructs the firm to display only a small portion of the total size on the order book at any one time, refreshing it as each displayed portion fills. This is known as a:",
    a: "Reserve (iceberg) order",
    explanation: "A reserve order hides most of the size from public view to reduce the market impact of a large order, revealing only a small visible tranche at a time.",
    options: [
      { text: "Reserve (iceberg) order", explanation: "Correct — this is the definition of a reserve/iceberg order." },
      { text: "All-or-none order", explanation: "AON requires the entire order to fill in a single execution or not at all — it doesn't involve hiding size." },
      { text: "Stop-limit order", explanation: "This involves a trigger price converting the order into a limit order, unrelated to display size." },
      { text: "Odd lot order", explanation: "An odd lot order simply involves a quantity below a standard trading unit, not a partially-hidden display strategy." },
    ],
  },
  {
    id: "sieb-ta-x205",
    section: "trading-accounts",
    q: "An order for a quantity of shares that is less than a normal trading unit (for most stocks, fewer than 100 shares) is known as:",
    a: "An odd lot order",
    explanation: "Odd lot orders fall below the standard round-lot trading unit and have historically been handled somewhat differently in execution and pricing than round lots.",
    options: [
      { text: "An odd lot order", explanation: "Correct — this is the definition of an odd lot." },
      { text: "A round lot order", explanation: "A round lot is the standard trading unit; an order below that unit is precisely what makes it 'odd,' not 'round.'" },
      { text: "A block trade", explanation: "A block trade refers to a very large transaction, the opposite end of the size spectrum from an odd lot." },
      { text: "A when-issued order", explanation: "When-issued relates to trading before a security is actually issued, unrelated to order quantity." },
    ],
  },
  {
    id: "sieb-ta-x206",
    section: "trading-accounts",
    q: "Under FINRA Rule 2360, when must a member deliver the current Options Disclosure Document ('Characteristics and Risks of Standardized Options') to a customer?",
    a: "At or prior to the time the customer's account is approved for options trading",
    explanation: "The ODD must be in the customer's hands by the time the account is approved — the point is that the customer understands the risks before they are permitted to trade, not after they have already placed an order.",
    options: [
      { text: "At or prior to the time the customer's account is approved for options trading", explanation: "Correct — Rule 2360 requires ODD delivery at or before options account approval." },
      { text: "Only after the customer's first options trade settles", explanation: "Delivering risk disclosure after trading has already occurred would defeat its purpose; it must come at or before approval." },
      { text: "Only if the customer requests it in writing", explanation: "ODD delivery is affirmatively required for options account approval, not contingent on a customer request." },
      { text: "Within one year of the customer's first options transaction", explanation: "This is far too late — the disclosure is a precondition of approval, not an annual follow-up." },
    ],
  },
  {
    id: "sieb-ta-x207",
    section: "trading-accounts",
    q: "A customer will be travelling and asks their firm to hold their mail. Under FINRA Rule 3150, the firm may do so only if:",
    a: "The customer provides written instructions that include the time period during which the mail is to be held",
    explanation: "The rule is built around a documented, time-bounded customer instruction — an open-ended verbal request is not enough, and if the requested period runs beyond three consecutive months the instructions must also state an acceptable reason (convenience does not qualify).",
    options: [
      { text: "The customer provides written instructions that include the time period during which the mail is to be held", explanation: "Correct — written instructions specifying the hold period are the core requirement of Rule 3150." },
      { text: "The customer makes the request verbally to their registered representative", explanation: "A verbal request is insufficient; Rule 3150 requires written instructions from the customer." },
      { text: "The firm decides on its own that holding the mail is in the customer's interest", explanation: "The firm cannot originate a mail hold on its own judgment — the instruction must come from the customer in writing." },
      { text: "The mail is held indefinitely, with no stated end date", explanation: "The instructions must specify a time period; an indefinite hold is exactly what the rule is designed to prevent." },
    ],
  },
  {
    id: "sieb-ta-x208",
    section: "trading-accounts",
    q: "In a delivery-versus-payment (DVP) / receive-versus-payment (RVP) settlement arrangement, commonly used by institutional accounts:",
    a: "Payment and delivery of securities occur simultaneously through the customer's custodian bank rather than directly through the broker-dealer",
    explanation: "DVP/RVP lets an institution settle trades through its own custodian, with cash and securities exchanged at the same time, reducing counterparty risk compared to paying or delivering first and hoping the other side follows through.",
    options: [
      { text: "Payment and delivery of securities occur simultaneously through the customer's custodian bank rather than directly through the broker-dealer", explanation: "Correct — this is how DVP/RVP settlement functions." },
      { text: "The customer pays for securities weeks before delivery is made", explanation: "That would defeat the simultaneous-exchange purpose of DVP/RVP, which exists to avoid exactly this kind of exposure." },
      { text: "It is only available to individual retail cash accounts", explanation: "DVP/RVP is primarily used by institutional accounts settling through a custodian, not a retail-only arrangement." },
      { text: "It eliminates the need for any settlement date", explanation: "A settlement date still applies; DVP/RVP changes how the exchange is coordinated, not whether one occurs." },
    ],
  },
  {
    id: "sieb-ta-x209",
    section: "trading-accounts",
    q: "Under FINRA Rule 3210, an associated person who wants to open a brokerage account at a firm other than their employer must:",
    a: "Notify the executing firm in writing of their association with the employer member and obtain the employer member's prior written consent",
    explanation: "Rule 3210 lets an employing firm monitor employees' outside trading for conflicts and rule violations, which requires both the executing firm knowing about the employment relationship and the employer's advance sign-off.",
    options: [
      { text: "Notify the executing firm in writing of their association with the employer member and obtain the employer member's prior written consent", explanation: "Correct — both the notification and the prior written consent are required under Rule 3210." },
      { text: "Do nothing — associated persons are exempt from any disclosure requirement for outside accounts", explanation: "The opposite is true; disclosure and prior consent are specifically required of associated persons." },
      { text: "Simply inform their spouse of the new account", explanation: "The required disclosure runs to the employer member and executing firm, not merely to a family member." },
      { text: "Wait until the account has been open for one year before disclosing it", explanation: "Disclosure and consent must occur before the account is opened, not after a delay." },
    ],
  },
  {
    id: "sieb-ta-x210",
    section: "trading-accounts",
    q: "Under FINRA Rule 3210, once an associated person's outside account has been properly disclosed and approved, the employer member firm may:",
    a: "Request that the executing firm send it duplicate copies of confirmations and statements for that account",
    explanation: "The point of the rule is ongoing visibility, not just a one-time approval — the employer can request duplicate records so it can supervise the associated person's outside trading activity.",
    options: [
      { text: "Request that the executing firm send it duplicate copies of confirmations and statements for that account", explanation: "Correct — this ongoing duplicate-records request is what the rule enables." },
      { text: "Take legal ownership of the assets in the account", explanation: "Approval and disclosure don't transfer ownership of the assets to the employer firm." },
      { text: "Trade in the account on the associated person's behalf without consent", explanation: "The employer firm gains supervisory visibility, not trading authority over the account." },
      { text: "Nothing further — once approved, no ongoing monitoring is permitted", explanation: "Ongoing monitoring via duplicate confirmations/statements is exactly what the rule is designed to permit." },
    ],
  },
  {
    id: "sieb-ta-x211",
    section: "trading-accounts",
    q: "FINRA rules on financial exploitation of specified adults permit a firm to place a temporary hold on a disbursement of funds or securities from an account when:",
    a: "The firm reasonably believes that financial exploitation of the customer has occurred, is occurring, or has been or will be attempted",
    explanation: "The hold is triggered by a reasonable-belief standard, giving the firm time to investigate before money or securities leave the account. Since the 2022 amendments, Rule 2165 permits a temporary hold on a securities transaction as well as on a disbursement.",
    options: [
      { text: "The firm reasonably believes that financial exploitation of the customer has occurred, is occurring, or has been or will be attempted", explanation: "Correct — this reasonable-belief standard is what permits the temporary hold." },
      { text: "The customer has simply missed a scheduled phone call with their rep", explanation: "A missed call alone doesn't meet the reasonable-belief standard tied to suspected exploitation." },
      { text: "The account has fallen below a minimum balance", explanation: "This mechanism is about suspected exploitation, not account minimums." },
      { text: "A court order is first obtained authorizing the hold", explanation: "The firm itself may place the temporary hold based on reasonable belief; it doesn't need a court order first to initiate it." },
    ],
  },
  {
    id: "sieb-ta-x212",
    section: "trading-accounts",
    q: "A 'trusted contact person' that a firm asks a customer to designate on their account is best described as someone who:",
    a: "The firm may contact about the account, such as to address possible financial exploitation or confirm the customer's well-being — without being given any authority to transact on the account",
    explanation: "The trusted contact is strictly an information/communication resource for the firm; unlike someone with trading authorization or power of attorney, they cannot place orders or direct disbursements.",
    options: [
      { text: "The firm may contact about the account, such as to address possible financial exploitation or confirm the customer's well-being — without being given any authority to transact on the account", explanation: "Correct — the trusted contact has no trading or account authority, only a contact role." },
      { text: "Someone automatically granted full trading authority over the account", explanation: "A trusted contact has no trading authority at all — that requires a separate, distinct authorization." },
      { text: "A required co-owner on every individual account", explanation: "Designating a trusted contact doesn't create joint ownership of the account." },
      { text: "The person who inherits the account automatically upon the customer's death", explanation: "That describes a TOD beneficiary, a different designation from a trusted contact." },
    ],
  },
  {
    id: "sieb-ta-x213",
    section: "trading-accounts",
    q: "A trader who writes call options and, as expiration nears, sells shares of the underlying stock specifically to hold its price below the strike price (so the calls expire worthless) is engaged in a manipulative practice known as:",
    a: "Capping",
    explanation: "Capping uses trading in the underlying security to artificially suppress its price near expiration so the trader's written options expire worthless, avoiding assignment.",
    options: [
      { text: "Capping", explanation: "Correct — this is the definition of capping." },
      { text: "Pegging", explanation: "Pegging is the mirror-image practice of buying the underlying to hold its price above the strike, not selling to hold it down." },
      { text: "Hypothecation", explanation: "Hypothecation is the pledging of margin securities as loan collateral, unrelated to options-expiration manipulation." },
      { text: "Best execution", explanation: "Best execution is a duty to seek favorable execution terms for customers, the opposite of manipulating a price artificially." },
    ],
  },
  {
    id: "sieb-ta-x214",
    section: "trading-accounts",
    q: "Regulation T defines the 'payment period' for a customer purchase as the number of business days in the standard settlement cycle plus two business days. Under the current T+1 settlement cycle, a customer's payment is therefore due no later than:",
    a: "The third business day after the trade date (T+3)",
    explanation: "Regulation T pegs the payment period to the settlement cycle rather than to a fixed number, so it moved automatically when the cycle shortened: T+1 settlement plus two business days makes payment due by T+3. If the customer does not pay, the firm must promptly liquidate the position or request an extension.",
    options: [
      { text: "The third business day after the trade date (T+3)", explanation: "Correct — the T+1 settlement cycle plus two business days makes the Regulation T payment date T+3." },
      { text: "The first business day after the trade date (T+1)", explanation: "T+1 is the settlement date itself; Regulation T allows two additional business days beyond the settlement cycle for payment." },
      { text: "The fifth business day after the trade date (T+5)", explanation: "T+5 was the payment date under the old T+3 settlement cycle; it did not survive the move to T+1." },
      { text: "The same day the trade is executed", explanation: "Regulation T does not require same-day payment for an ordinary cash account purchase; it grants a defined payment period." },
    ],
  },
  {
    id: "sieb-ta-x215",
    section: "trading-accounts",
    q: "Before effecting a customer's first transaction in a penny stock, SEC Rule 15g-2 requires the broker-dealer to:",
    a: "Provide the customer with the standardized penny stock risk disclosure document and obtain the customer's signed and dated written acknowledgement of receipt",
    explanation: "Disclosure alone isn't enough under Rule 15g-2 — the firm must also capture a signed, dated acknowledgement that the customer received it, creating evidence the customer was warned before any penny stock trade occurs.",
    options: [
      { text: "Provide the customer with the standardized penny stock risk disclosure document and obtain the customer's signed and dated written acknowledgement of receipt", explanation: "Correct — Rule 15g-2 requires both delivery of the document and a signed, dated acknowledgement before the first transaction." },
      { text: "Obtain written approval from FINRA for the specific transaction", explanation: "No transaction-by-transaction regulatory pre-approval is required; the obligation runs to the customer via disclosure and acknowledgement." },
      { text: "Mail the disclosure document within 30 days after the transaction settles", explanation: "The disclosure must precede the first penny stock transaction — sending it after settlement would defeat the rule's purpose." },
      { text: "Verify that the customer has at least five years of trading experience", explanation: "Rule 15g-2 imposes a disclosure and acknowledgement requirement, not a fixed experience threshold." },
    ],
  },
];
