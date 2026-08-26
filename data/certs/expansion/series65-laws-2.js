// Series 65 — expansion batch 2 of 4 for section "laws"
// (Laws, Regulations and Guidelines, including Prohibition on Unethical Business Practices)
//
// This batch is part 2 of 4 and deliberately leans into the SECOND slice of the topic
// scope: state registration mechanics for investment advisers and IARs (withdrawal,
// renewal, effective dates, examination alternatives, notice filings for federal covered
// advisers), and custody-rule / Form ADV mechanics not already exercised by
// data/certs/series65-bank.js or data/certs/series65-bank-laws.js — e.g., the
// unannounced-timing requirement of a surprise exam, the 120/180-day audited-financials
// distribution deadlines for pooled vehicles (including the fund-of-funds carve-out),
// trustee/general-partner custody triggers, and the IARD's operator.
//
// Every dated/numeric figure used below is a longstanding, non-inflation-indexed rule
// mechanic — not a moving dollar threshold or CPI-indexed figure. Provenance, verified
// against primary sources:
//   - 30-day withdrawal effectiveness + the Administrator's 1-year residual jurisdiction:
//     USA (1956) Sec. 204(f), verbatim.
//   - Noon of the 30th day: USA Sec. 202(b), and it governs registration of PERSONS
//     (broker-dealers, agents, investment advisers) ONLY. Securities registration
//     statements do NOT use it — see Sec. 302(c) (3 p.m. ET, 2nd full business day),
//     Sec. 303(c) (simultaneous with federal effectiveness), Sec. 304 (when the
//     Administrator so orders). Do not reintroduce that conflation into these items.
//   - Dec 31 renewal: this is STATE PRACTICE (the IARD annual renewal program), not USA
//     text. USA Sec. 202(d) itself reads "Every registration expires one year from its
//     effective date unless renewed," with bracketed language accommodating states whose
//     registrations expire on a fixed annual date. Items here are framed as "in most
//     states" for that reason.
//   - Quarterly custodian statements, the surprise exam's "without prior notice ... and
//     irregular from year to year" timing, the 120-day Form ADV-E deadline, the fee-
//     deduction exception, and the trustee/general-partner custody triggers: Rule
//     206(4)-2 (a)(3), (a)(4), (a)(4)(i), (b)(3), (d)(2)(iii) respectively, verbatim.
//   - 120-day audited-financials deadline: Rule 206(4)-2(b)(4)(i) text. The 180-day
//     fund-of-funds window is SEC STAFF guidance, not rule text ("180" and "fund of
//     funds" appear nowhere in the rule).

export const S65_LAWS_X2 = [
  {
    id: "s65-lw-x201",
    section: "laws",
    q: "Under the Uniform Securities Act, once an investment adviser or agent files a request to withdraw its registration and no revocation or suspension proceeding is pending, the withdrawal generally becomes effective:",
    a: "30 days after the Administrator receives the withdrawal request",
    explanation: "The USA builds in a delay (commonly 30 days) before a withdrawal takes effect specifically so the Administrator retains a window to commence a proceeding based on conduct that occurred while the registrant was still registered.",
    options: [
      { text: "30 days after the Administrator receives the withdrawal request", explanation: "Correct — absent a pending proceeding, withdrawal becomes effective 30 days after the Administrator receives it." },
      { text: "Immediately upon the Administrator's receipt of the request", explanation: "Withdrawal is not immediate; the USA imposes a delay so the Administrator can still act on pre-withdrawal conduct." },
      { text: "Only after a formal hearing is held on the request", explanation: "A hearing isn't required to process a routine withdrawal request when no proceeding is pending." },
      { text: "At the start of the next calendar year", explanation: "Withdrawal effectiveness is tied to a fixed number of days after filing, not to the calendar year." },
    ],
  },
  {
    id: "s65-lw-x202",
    section: "laws",
    q: "A state Administrator's jurisdiction to bring an action against a formerly registered investment adviser for conduct that occurred while the adviser was registered:",
    a: "Generally survives withdrawal of registration for a limited period (commonly one year)",
    explanation: "Withdrawing a registration doesn't erase the Administrator's authority to pursue misconduct that happened during registration; that authority persists for a defined window after withdrawal.",
    options: [
      { text: "Generally survives withdrawal of registration for a limited period (commonly one year)", explanation: "Correct — the Administrator retains authority over pre-withdrawal conduct for a limited period after withdrawal takes effect." },
      { text: "Ends the instant withdrawal becomes effective", explanation: "Jurisdiction over prior conduct doesn't vanish the moment withdrawal is effective; it persists for a defined period." },
      { text: "Requires the adviser's consent to be reinstated", explanation: "The Administrator doesn't need the former registrant's consent to exercise this residual authority." },
      { text: "Applies only if the adviser re-registers in the same state later", explanation: "The Administrator's residual jurisdiction over past conduct doesn't depend on whether the adviser ever re-registers." },
    ],
  },
  {
    id: "s65-lw-x203",
    section: "laws",
    q: "In most states, an investment adviser's and an IAR's state registration must generally be renewed:",
    a: "Annually, with registrations expiring on December 31 absent renewal",
    explanation: "State IA/IAR registrations typically run on a calendar-year cycle and lapse at year-end unless timely renewed — distinct from the ongoing annual updating amendment to Form ADV itself.",
    options: [
      { text: "Annually, with registrations expiring on December 31 absent renewal", explanation: "Correct — the common state renewal cycle runs the calendar year and expires December 31 without renewal." },
      { text: "Only once, at initial registration, with no further renewal needed", explanation: "State registration is not a one-time event; it requires periodic renewal to remain active." },
      { text: "Every five years, coinciding with a re-examination requirement", explanation: "There's no five-year re-examination cycle tied to renewal; renewal is annual." },
      { text: "Whenever the adviser's AUM changes materially", explanation: "AUM changes can trigger other filing obligations, but renewal timing is calendar-based, not AUM-triggered." },
    ],
  },
  {
    id: "s65-lw-x204",
    section: "laws",
    q: "Under the Uniform Securities Act, absent a denial order or a pending proceeding, an application for registration as a broker-dealer, agent, or investment adviser generally becomes effective:",
    a: "At noon of the 30th day after the application is filed",
    explanation: "USA Section 202(a) sets a default effective date of noon on the 30th day after filing; the Administrator may specify an earlier date by rule or order, or defer effectiveness until noon of the 30th day after any amendment is filed. Mind the subsection if you go to the source: the effective-date rule is 202(a) — 202(b) is the federal covered adviser notice filing provision, which is a different topic entirely. Note this is the effective-date rule for registering PERSONS — securities registration statements run on entirely different timetables (notification, coordination, and qualification each have their own).",
    options: [
      { text: "At noon of the 30th day after the application is filed", explanation: "Correct — this is the USA's default effective-date mechanic for registering broker-dealers, agents, and investment advisers absent Administrator action." },
      { text: "Immediately upon filing a complete application", explanation: "There is a built-in review window; effectiveness isn't instantaneous upon filing." },
      { text: "Only after the Administrator affirmatively approves it in writing", explanation: "Affirmative written approval isn't required — effectiveness occurs automatically at the specified time absent a denial or pending proceeding." },
      { text: "At the moment the registrant's federal registration becomes effective", explanation: "Effectiveness tied to the federal registration is the securities registration-by-coordination mechanic, not the rule for registering a broker-dealer, agent, or investment adviser." },
    ],
  },
  {
    id: "s65-lw-x205",
    section: "laws",
    q: "An individual seeking to register as an investment adviser representative may generally satisfy the examination requirement by passing:",
    a: "Either the Series 65 alone, or the Series 66 combined with the Series 7",
    explanation: "States generally accept either the standalone Series 65 or, since the Series 66 covers Series 63/65 content, the Series 66 paired with the Series 7 (which supplies the product/sales-practice content the 66 doesn't).",
    options: [
      { text: "Either the Series 65 alone, or the Series 66 combined with the Series 7", explanation: "Correct — these are the two recognized examination paths to IAR qualification." },
      { text: "The Series 7 alone, since it covers investment adviser law", explanation: "The Series 7 alone does not cover investment adviser law and doesn't qualify someone as an IAR by itself." },
      { text: "The Series 63 alone, since it covers investment adviser topics", explanation: "The Series 63 covers state agent registration and blue-sky law, not the investment adviser law content required for IAR qualification." },
      { text: "Any FINRA-administered exam, at the candidate's choice", explanation: "Not any FINRA exam qualifies; only the specific paths recognized by state Administrators satisfy the IAR examination requirement." },
    ],
  },
  {
    id: "s65-lw-x206",
    section: "laws",
    q: "A state generally may NOT require a professional holding a currently valid CFP, CFA, or similar recognized designation to satisfy which IAR qualification requirement?",
    a: "The examination requirement, which is generally waived based on the designation",
    explanation: "A number of professional designations carry a state examination waiver for IAR purposes, but that waiver doesn't excuse the individual from registration itself or from other applicable requirements.",
    options: [
      { text: "The examination requirement, which is generally waived based on the designation", explanation: "Correct — recognized designations commonly waive the examination requirement specifically." },
      { text: "The requirement to register as an IAR at all", explanation: "Holding the designation doesn't exempt the individual from registering as an IAR; it only addresses the exam." },
      { text: "Any recordkeeping obligations applicable to the firm", explanation: "The designation-based waiver doesn't touch the firm's recordkeeping obligations." },
      { text: "Any applicable state notice filing fees", explanation: "Fees are unaffected by an individual's designation-based exam waiver." },
    ],
  },
  {
    id: "s65-lw-x207",
    section: "laws",
    q: "A state's registration requirements for investment adviser representatives apply to individuals employed by a state-registered adviser. For an IAR employed by a federal covered adviser, a state generally may:",
    a: "Still require registration of the IAR if the IAR has a place of business in that state",
    explanation: "NSMIA preempts state substantive registration of the federal covered adviser itself, but it does not preempt state registration of that adviser's individual representatives who have a place of business in the state.",
    options: [
      { text: "Still require registration of the IAR if the IAR has a place of business in that state", explanation: "Correct — IAR registration at the individual level survives NSMIA preemption even when the firm is federal covered." },
      { text: "Never require any filing related to that IAR", explanation: "States retain authority to register individual representatives with a place of business in the state, regardless of the firm's federal covered status." },
      { text: "Require the IAR to register only if the firm's AUM exceeds a state-set threshold", explanation: "IAR registration doesn't hinge on the firm's AUM; it turns on whether the IAR has a place of business in the state." },
      { text: "Require the federal covered adviser itself to fully re-register in that state because of the IAR", explanation: "NSMIA preempts full state registration of the federal covered adviser itself; only the notice filing and fee apply to the firm." },
    ],
  },
  {
    id: "s65-lw-x208",
    section: "laws",
    q: "As a condition of a federal covered adviser doing business in a state, the state may generally require the adviser to:",
    a: "Make a notice filing (a copy of its SEC-filed Form ADV) and pay a notice filing fee",
    explanation: "NSMIA leaves states with only notice filing and fee authority over federal covered advisers — no substantive merit review, no separate state registration, and no additional qualification exam for the firm itself.",
    options: [
      { text: "Make a notice filing (a copy of its SEC-filed Form ADV) and pay a notice filing fee", explanation: "Correct — this is the extent of what a state may require of the federal covered adviser itself." },
      { text: "Pass a state-administered merit review of its advisory fee structure", explanation: "States cannot conduct a substantive merit review of a federal covered adviser; that authority was preempted by NSMIA." },
      { text: "Undergo full state registration in addition to SEC registration", explanation: "A federal covered adviser is not subject to full state registration; only notice filing and a fee apply." },
      { text: "Pass a separate state examination distinct from any SEC requirements", explanation: "There's no separate state exam imposed on the federal covered adviser firm itself under NSMIA's notice-filing regime." },
    ],
  },
  {
    id: "s65-lw-x209",
    section: "laws",
    q: "An investment adviser undergoes a change in legal form — for example, converting from an LLC to a corporation — with no meaningful change in ownership, management, or advisory business. This is generally treated as:",
    a: "A technical succession, requiring an amendment rather than an entirely new registration",
    explanation: "Where the change is a change in form only and the business otherwise continues unchanged, the successor entity generally amends the existing registration rather than filing a brand-new application from scratch.",
    options: [
      { text: "A technical succession, requiring an amendment rather than an entirely new registration", explanation: "Correct — a mere change in legal form, without a substantive change in the business, is handled as a technical succession." },
      { text: "A complete termination of the adviser's registration with no path to continue", explanation: "The registration doesn't simply terminate; it's carried forward through a succession filing." },
      { text: "Irrelevant for registration purposes and requiring no filing at all", explanation: "A filing is still required to reflect the successor entity, even though it's a technical succession rather than a new application." },
      { text: "Grounds for automatic revocation pending a new application", explanation: "A technical succession doesn't trigger revocation; it's accommodated through an amendment process." },
    ],
  },
  {
    id: "s65-lw-x210",
    section: "laws",
    q: "The Investment Adviser Registration Depository (IARD), through which Form ADV filings and fees are submitted, is:",
    a: "Operated by FINRA on behalf of the SEC and state securities Administrators",
    explanation: "IARD is a FINRA-operated electronic filing system used by both the SEC and the states, centralizing IA/IAR registration data even though FINRA itself does not regulate investment advisers.",
    options: [
      { text: "Operated by FINRA on behalf of the SEC and state securities Administrators", explanation: "Correct — FINRA operates IARD as the electronic filing depository used by both the SEC and the states." },
      { text: "Operated directly by each state Administrator, with no central system", explanation: "IARD is a single, centralized system, not a patchwork of separate state-run systems." },
      { text: "Operated by the SEC alone, with no state involvement", explanation: "States rely on IARD too, for notice filings and state IA/IAR registration data, not just the SEC." },
      { text: "Operated by NASAA, which also regulates broker-dealers", explanation: "NASAA doesn't operate IARD, and NASAA is an association of state regulators, not a broker-dealer regulator." },
    ],
  },
  {
    id: "s65-lw-x211",
    section: "laws",
    q: "Under the SEC's custody rule, the annual 'surprise examination' by an independent public accountant is distinguished from a routine audit primarily by the requirement that it be:",
    a: "Conducted at a time chosen by the accountant that is not disclosed to the adviser in advance and varies from year to year",
    explanation: "The exam's value depends on the adviser not being able to prepare for it; the accountant picks an undisclosed, irregular date each year rather than a pre-scheduled one, which is what makes it a 'surprise.'",
    options: [
      { text: "Conducted at a time chosen by the accountant that is not disclosed to the adviser in advance and varies from year to year", explanation: "Correct — unpredictability of timing is what distinguishes a surprise exam from a scheduled audit." },
      { text: "Conducted on the same calendar date every year for consistency", explanation: "A fixed, predictable annual date would defeat the purpose of a surprise examination." },
      { text: "Announced to the adviser at least 30 days in advance", explanation: "Advance notice to the adviser is exactly what a surprise exam is designed to avoid." },
      { text: "Performed only once, at the adviser's initial registration", explanation: "The surprise exam is an ongoing annual obligation for an adviser with custody, not a one-time initial event." },
    ],
  },
  {
    id: "s65-lw-x212",
    section: "laws",
    q: "An adviser to a pooled investment vehicle relying on the audited-financial-statements alternative to a surprise examination must generally distribute the GAAP-audited statements to investors within:",
    a: "120 days of the fund's fiscal year end (180 days for a fund of funds)",
    explanation: "Rule 206(4)-2(b)(4)(i) sets the 120-day deadline in its text; the 180-day window for a fund of funds is a longstanding SEC staff accommodation recognizing the extra time needed to consolidate underlying fund audits (staff guidance likewise recognizes 260 days for a top-tier fund investing in funds of funds).",
    options: [
      { text: "120 days of the fund's fiscal year end (180 days for a fund of funds)", explanation: "Correct — 120 days is the deadline in the rule text, and 180 days is the recognized fund-of-funds window under SEC staff guidance." },
      { text: "30 days of the fund's fiscal year end, with no exception for funds of funds", explanation: "30 days is far shorter than the actual deadline and ignores the fund-of-funds extension." },
      { text: "60 days of the fund's fiscal year end, doubled to 120 days for a fund of funds", explanation: "This misstates both the base deadline and the fund-of-funds figure." },
      { text: "One year of the fund's fiscal year end, regardless of fund type", explanation: "A one-year window is far longer than what the rule actually allows." },
    ],
  },
  {
    id: "s65-lw-x213",
    section: "laws",
    q: "An accountant who completes a surprise examination under the custody rule must file the resulting certificate with the SEC on Form ADV-E:",
    a: "Within 120 days of the time chosen for the examination",
    explanation: "The accountant, not the adviser, files Form ADV-E, and the filing deadline runs from the date the accountant conducted the surprise exam.",
    options: [
      { text: "Within 120 days of the time chosen for the examination", explanation: "Correct — this is the filing deadline that runs from the date of the surprise exam itself." },
      { text: "Within 15 days of the adviser's fiscal year end", explanation: "The Form ADV-E deadline runs from the exam date, not from the adviser's fiscal year end." },
      { text: "At the same time as the adviser's annual updating amendment", explanation: "Form ADV-E filing is tied to the exam date and is a separate, accountant-driven filing, not synchronized with the adviser's own annual amendment." },
      { text: "Only if requested by the SEC's examination staff", explanation: "The filing is a standing requirement following every surprise exam, not something triggered only upon SEC request." },
    ],
  },
  {
    id: "s65-lw-x214",
    section: "laws",
    q: "An investment adviser also serves as trustee of a trust for an advisory client, with authority over the trust's assets. With respect to the custody rule, the adviser is generally treated as:",
    a: "Having custody of the trust's assets, subject to the custody rule's safeguards",
    explanation: "Serving as trustee gives the adviser the kind of access to and control over client assets that the custody rule targets, so it's treated as custody even though no funds physically sit with the adviser.",
    options: [
      { text: "Having custody of the trust's assets, subject to the custody rule's safeguards", explanation: "Correct — a trustee role over a client's assets is a recognized form of custody under the rule." },
      { text: "Exempt from custody rule coverage because a trust is not a client account", explanation: "A trust for which the adviser serves as trustee is not exempt; the custody rule applies to trust assets under the adviser's control." },
      { text: "Subject only to disclosure obligations, with no other safeguards required", explanation: "Custody triggers the full set of safeguards (qualified custodian, notice, exam or audit alternative), not disclosure alone." },
      { text: "Free of custody rule implications as long as the trustee role is unpaid", explanation: "Whether the trustee role is compensated doesn't change the custody analysis; control over the assets is what matters." },
    ],
  },
  {
    id: "s65-lw-x215",
    section: "laws",
    q: "An adviser serves as general partner of a limited partnership that is itself an advisory client (a pooled investment vehicle). With respect to the custody rule, the adviser's role as general partner is generally treated as:",
    a: "Custody of the partnership's assets, because a general partner has access to and control over them",
    explanation: "A general partner's authority to withdraw or direct partnership assets is functionally the same access the custody rule is designed to safeguard against, so this role is treated as custody.",
    options: [
      { text: "Custody of the partnership's assets, because a general partner has access to and control over them", explanation: "Correct — the general partner role gives the adviser the kind of control that constitutes custody." },
      { text: "Not custody, because the partnership itself holds the assets, not the adviser directly", explanation: "Indirect control through a general partnership interest still counts; the adviser needn't hold assets directly to have custody." },
      { text: "Not custody, since limited partners retain ultimate ownership", explanation: "Limited partners' ownership doesn't negate the general partner's control-based custody status." },
      { text: "Custody only if the adviser also personally guarantees the fund's obligations", explanation: "A personal guarantee is not the trigger; the general partner's access to and control over fund assets is what creates custody." },
    ],
  },
  {
    id: "s65-lw-x216",
    section: "laws",
    q: "Under the Uniform Securities Act, every applicant for registration as a broker-dealer, agent, investment adviser, or investment adviser representative must file a consent to service of process with the Administrator. The legal effect of that consent is that:",
    a: "It irrevocably appoints the Administrator as the applicant's attorney to receive service of process in noncriminal proceedings arising under the Act, and such service has the same force and validity as personal service on the applicant",
    explanation: "The consent to service of process is how a state obtains a dependable way to reach a registrant — including an out-of-state one — without having to chase them across state lines. The applicant irrevocably names the Administrator as its attorney for receiving process in noncriminal suits arising under the Act, and process delivered to the Administrator is treated exactly as if it had been handed to the applicant personally.",
    options: [
      { text: "It irrevocably appoints the Administrator as the applicant's attorney to receive service of process in noncriminal proceedings arising under the Act, and such service has the same force and validity as personal service on the applicant", explanation: "Correct — the consent is irrevocable, is limited to noncriminal matters arising under the Act, and gives service on the Administrator the same effect as personal service on the filer." },
      { text: "It authorizes the Administrator to accept service on the applicant's behalf in criminal prosecutions under the Act as well as in civil suits", explanation: "The consent is expressly confined to noncriminal suits, actions, and proceedings; criminal process must still be served on the defendant directly." },
      { text: "It may be revoked by the applicant by written notice to the Administrator once the registration becomes effective", explanation: "The consent is irrevocable by its terms — a registrant cannot switch it off after registration, which is precisely what makes it a reliable channel for service." },
      { text: "It obligates the Administrator to appear and defend the applicant in any proceeding arising under the Act", explanation: "The Administrator merely receives process; it never becomes the registrant's defense counsel, and in enforcement matters it is the adverse party." },
    ],
  },
  {
    id: "s65-lw-x217",
    section: "laws",
    q: "An adviser has custody of client assets solely because it deducts its advisory fee directly from client accounts (with proper client authorization and custodian notice), and has no other form of access to client funds. As a result:",
    a: "The adviser is generally relieved of the surprise examination requirement for this reason alone",
    explanation: "Fee-deduction-only custody is treated more leniently than broader forms of custody; an adviser whose only custody-triggering activity is authorized fee deduction is not required to undergo the annual surprise exam on that basis alone.",
    options: [
      { text: "The adviser is generally relieved of the surprise examination requirement for this reason alone", explanation: "Correct — fee-deduction-only custody, standing alone, doesn't trigger the surprise exam requirement." },
      { text: "The adviser must still undergo the full annual surprise examination", explanation: "Fee-deduction-only custody is specifically excused from the surprise exam requirement; it isn't treated the same as broader custody." },
      { text: "The adviser is entirely outside the custody rule's scope", explanation: "The adviser still has custody and remains subject to other applicable custody safeguards; it's only the surprise exam that's relieved for this narrow basis." },
      { text: "The client must appoint an independent representative before any fee may be deducted", explanation: "An independent representative isn't a standing requirement for ordinary fee-deduction custody with proper authorization and custodian notice." },
    ],
  },
  {
    id: "s65-lw-x218",
    section: "laws",
    q: "A qualified custodian, as used in the custody rule, is generally best described as:",
    a: "A bank, savings association, broker-dealer, or futures commission merchant that maintains client funds and securities in a manner segregated from the adviser's own assets",
    explanation: "The custody rule requires client assets to sit with an independent third party of this kind, precisely so the adviser itself never has unchecked physical or practical control over them.",
    options: [
      { text: "A bank, savings association, broker-dealer, or futures commission merchant that maintains client funds and securities in a manner segregated from the adviser's own assets", explanation: "Correct — this describes the categories of institutions that qualify as custodians under the rule." },
      { text: "The investment adviser itself, provided it maintains a separate internal ledger for client assets", explanation: "An adviser cannot be its own qualified custodian merely by internal recordkeeping; independence from the adviser is the point." },
      { text: "Any unaffiliated individual designated in writing by the client to hold assets informally", explanation: "An informally designated individual doesn't meet the definition; a qualified custodian must be one of the specified regulated institution types." },
      { text: "A state securities Administrator's office, which holds client assets in escrow", explanation: "State Administrators don't act as custodians of client assets; that's not their regulatory role." },
    ],
  },
  {
    id: "s65-lw-x219",
    section: "laws",
    q: "A private fund adviser satisfies the custody rule's audited-financial-statements alternative for its fund clients. This alternative is generally understood to relieve the adviser of:",
    a: "The obligation to undergo the annual surprise examination for that fund",
    explanation: "The audit alternative is a substitute path, not an additional layer — an adviser that properly delivers timely audited financials to fund investors doesn't also need to arrange a separate surprise exam for that same fund.",
    options: [
      { text: "The obligation to undergo the annual surprise examination for that fund", explanation: "Correct — the audit alternative substitutes for, rather than supplements, the surprise examination requirement." },
      { text: "The obligation to use a qualified custodian for the fund's assets at all", explanation: "The audit alternative doesn't eliminate the need for a qualified custodian; that safeguard still applies." },
      { text: "Any requirement to have the auditor be independent and PCAOB-registered", explanation: "The alternative specifically requires an independent, PCAOB-registered and inspected accountant; that requirement isn't relieved, it's central to qualifying for the alternative." },
      { text: "The requirement to distribute the audited statements to fund investors at all", explanation: "Distributing the audited statements to investors is the core condition of the alternative, not something it excuses." },
    ],
  },
  {
    id: "s65-lw-x220",
    section: "laws",
    q: "An adviser holds the login credentials to a client's online custodial account, and those credentials would permit the adviser to withdraw or transfer the client's funds. The adviser never actually uses them. Under SEC staff guidance, the adviser:",
    a: "Has custody, because the analysis turns on the ability to withdraw client assets rather than on whether that ability is exercised",
    explanation: "SEC staff guidance treats custody as turning on whether the adviser is permitted to withdraw or transfer client funds upon its instruction — regardless of whether the adviser desires, is aware of, or ever exercises that authority. Credentials that permit only viewing an account would not create custody; it is the withdrawal/transfer capability that matters.",
    options: [
      { text: "Has custody, because the analysis turns on the ability to withdraw client assets rather than on whether that ability is exercised", explanation: "Correct — the capability to withdraw or transfer, not its actual use, is what the custody analysis focuses on." },
      { text: "Does not have custody unless and until it actually withdraws or transfers funds", explanation: "Custody doesn't require an actual withdrawal; the capacity to withdraw is itself enough." },
      { text: "Does not have custody, because the credentials belong to the client rather than to the adviser", explanation: "Whose credentials they are is not the test; what matters is what the adviser is able to do with them." },
      { text: "Automatically becomes subject to statutory disqualification", explanation: "Holding client credentials isn't a disqualifying event; it's a custody-rule compliance issue to be remedied, not a disqualification trigger." },
    ],
  },
];
