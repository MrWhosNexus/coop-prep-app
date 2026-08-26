// SIE (Securities Industry Essentials) exam — practice question bank
// Additional items for Section 4, Overview of the Regulatory Framework.
// Same quiz-item shape as data/certs/sie-bank.js: {id, section, q, a, explanation, options:[{text, explanation}]}
// All items here are tagged section: "regulatory" and are meant to be folded into SIE_BANK
// alongside the existing 14 regulatory-framework items (sieb-rf-01 .. sieb-rf-14).
// These 14 cover different ground: SRO/SEC scope, registered vs. associated persons,
// statutory disqualification process, SIE eligibility/validity, private securities transactions,
// outside business activities, complaint recordkeeping, arbitration/mediation, books and records
// authority, and FINRA Rule 2210 communications categories.

export const SIE_BANK_REGULATORY = [
  {
    id: "sieb-rf-15",
    section: "regulatory",
    q: "Which of the following is NOT a self-regulatory organization (SRO)?",
    a: "The SEC",
    explanation: "The SEC is a federal government agency that oversees the SROs; FINRA, the MSRB, and the national securities exchanges are all industry SROs, not government agencies.",
    options: [
      { text: "The SEC", explanation: "Correct — the SEC is a federal government agency, not an SRO; it sits above the SROs and oversees them." },
      { text: "FINRA", explanation: "FINRA is an SRO — it regulates broker-dealers under SEC oversight, but it is not itself the SEC." },
      { text: "The MSRB", explanation: "The MSRB is an SRO that writes municipal securities rules, even though it relies on FINRA and bank regulators for enforcement." },
      { text: "The New York Stock Exchange", explanation: "A national securities exchange like the NYSE also functions as an SRO, regulating its own listed companies and members." },
    ],
  },
  {
    id: "sieb-rf-16",
    section: "regulatory",
    q: "Besides FINRA and the MSRB, which of the following also functions as a self-regulatory organization (SRO)?",
    a: "A national securities exchange, such as the NYSE or Nasdaq",
    explanation: "National securities exchanges are registered with the SEC as SROs and write and enforce rules governing their own listed issuers and member firms.",
    options: [
      { text: "A national securities exchange, such as the NYSE or Nasdaq", explanation: "Correct — exchanges are SROs in their own right, alongside FINRA and the MSRB." },
      { text: "The Federal Reserve", explanation: "The Federal Reserve is a federal banking regulator focused on monetary policy and bank supervision, not a securities SRO." },
      { text: "The U.S. Department of the Treasury", explanation: "Treasury is a federal executive department, not an industry self-regulatory organization." },
      { text: "The Internal Revenue Service", explanation: "The IRS administers federal tax law and has no role as a securities self-regulatory organization." },
    ],
  },
  {
    id: "sieb-rf-17",
    section: "regulatory",
    q: "Every registered representative is an associated person of their firm, but not every associated person must be registered. Which of these is an example of an associated person who typically does NOT need to register?",
    a: "A purely clerical employee with no customer contact, sales role, or supervisory function",
    explanation: "'Associated person' is the broader category — it includes anyone employed by or under the control of a member firm — while registration is required only for those engaged in the securities business, such as sales, supervision, or trading.",
    options: [
      { text: "A purely clerical employee with no customer contact, sales role, or supervisory function", explanation: "Correct — purely ministerial or clerical staff are associated persons but generally fall outside the registration requirement." },
      { text: "A representative who solicits securities business from customers", explanation: "Soliciting securities business is exactly the kind of activity that triggers a registration requirement." },
      { text: "A principal who supervises registered representatives", explanation: "Supervisory principals must themselves be registered in an appropriate principal category." },
      { text: "An employee who effects securities transactions for customers", explanation: "Effecting transactions is a securities-business function that requires registration." },
    ],
  },
  {
    id: "sieb-rf-18",
    section: "regulatory",
    q: "A firm has grounds to believe an applicant is subject to statutory disqualification but still wants to associate that person with the firm. What must happen?",
    a: "The firm must sponsor a formal application (Form MC-400) that FINRA must approve before the person may associate",
    explanation: "Statutory disqualification does not automatically mean a lifetime bar, but it does mean the individual cannot simply be hired — the firm must seek and receive FINRA approval through the formal application process, with SEC oversight of that process.",
    options: [
      { text: "The firm must sponsor a formal application (Form MC-400) that FINRA must approve before the person may associate", explanation: "Correct — this formal approval process is required before a statutorily disqualified person may associate with a member firm." },
      { text: "The firm may hire the person immediately as long as it discloses this on the person's Form U4", explanation: "Disclosure alone is not sufficient — FINRA approval of a formal application is required first." },
      { text: "Nothing — statutory disqualification only affects the firm's insurance coverage, not hiring", explanation: "Statutory disqualification directly restricts whether the person may associate with a member firm at all; it is not merely an insurance issue." },
      { text: "The person is permanently and unconditionally barred from any association with any member firm", explanation: "Statutory disqualification is not automatically a permanent bar — approval through the formal process can permit association." },
    ],
  },
  {
    id: "sieb-rf-19",
    section: "regulatory",
    q: "Which of the following is true about eligibility to sit for the SIE exam?",
    a: "Any individual age 18 or older may take it, even if not yet associated with or sponsored by a FINRA member firm",
    explanation: "Unlike representative-level 'top-off' exams, the SIE can be taken by the general public without firm sponsorship, which is why it's often taken by students or career-changers before they've found a sponsoring firm.",
    options: [
      { text: "Any individual age 18 or older may take it, even if not yet associated with or sponsored by a FINRA member firm", explanation: "Correct — no firm sponsorship is required to sit for the SIE, unlike the top-off exams." },
      { text: "A candidate must first be sponsored by and associated with a FINRA member firm", explanation: "This sponsorship requirement applies to representative-level top-off exams, not to the SIE itself." },
      { text: "A candidate must already hold a college degree in finance or a related field", explanation: "There is no educational degree requirement to sit for the SIE." },
      { text: "A candidate must first pass a representative-level exam such as the Series 7", explanation: "This gets the sequence backwards — the SIE is the foundational exam typically taken before, not after, a top-off exam." },
    ],
  },
  {
    id: "sieb-rf-20",
    section: "regulatory",
    q: "A candidate passes the SIE exam but is not associated with any FINRA member firm. What happens to that passing result?",
    a: "It remains valid for four years, during which the candidate can associate with a firm and pass a top-off exam to register",
    explanation: "The SIE's passing status has a four-year window; if the candidate hasn't become registered with a member firm by passing a top-off exam within that window, the passing result expires and the SIE must be retaken.",
    options: [
      { text: "It remains valid for four years, during which the candidate can associate with a firm and pass a top-off exam to register", explanation: "Correct — this is the SIE's validity window." },
      { text: "It remains valid indefinitely, with no expiration", explanation: "The passing result does expire — it is not permanent if the candidate never associates with a firm." },
      { text: "It expires after 30 days if the candidate isn't hired immediately", explanation: "30 days is far shorter than the actual multi-year validity window." },
      { text: "It converts automatically into full registration after one year", explanation: "Passing the SIE never automatically converts into registration — a top-off exam and firm association are still required." },
    ],
  },
  {
    id: "sieb-rf-21",
    section: "regulatory",
    q: "A registered representative wants to sell interests in a private real estate fund to some of their customers, entirely outside their firm's approved product menu, and will receive no compensation for it. Under FINRA's private securities transaction rule, the rep must:",
    a: "Provide the firm with prior written notice describing the proposed transaction, even though no compensation is involved",
    explanation: "FINRA's private securities transactions rule (the 'selling away' rule) requires prior written notice to the firm regardless of whether the rep is compensated; compensation affects what supervisory obligations the firm then takes on, not whether notice is required at all.",
    options: [
      { text: "Provide the firm with prior written notice describing the proposed transaction, even though no compensation is involved", explanation: "Correct — written notice is required whether or not the rep is compensated." },
      { text: "Do nothing, since notice is only required when the rep is compensated", explanation: "Notice is required even for uncompensated private securities transactions, not only compensated ones." },
      { text: "Only mention it verbally to a colleague, since it's outside the firm's business", explanation: "A verbal, informal mention to a colleague doesn't satisfy the requirement for prior written notice to the firm." },
      { text: "Proceed freely, since privately placed securities fall outside FINRA's jurisdiction entirely", explanation: "FINRA's private securities transaction rule specifically governs this kind of outside sales activity by a registered person." },
    ],
  },
  {
    id: "sieb-rf-22",
    section: "regulatory",
    q: "Before taking a part-time job at a business unrelated to the securities industry (for example, a fitness studio) that is not affiliated with their firm, a registered representative must generally:",
    a: "Provide prior written notice of the outside business activity to their firm",
    explanation: "FINRA's outside business activities rule requires reps to give their firm prior written notice of outside employment or business activities so the firm can assess conflicts, even when the activity has nothing to do with securities.",
    options: [
      { text: "Provide prior written notice of the outside business activity to their firm", explanation: "Correct — prior written notice to the firm is required, regardless of how unrelated the activity seems." },
      { text: "Do nothing, since the activity has no connection to securities", explanation: "The notice requirement applies to outside business activities generally, not only ones connected to securities." },
      { text: "Seek approval directly from FINRA rather than from their own firm", explanation: "The notice and any resulting approval process runs through the rep's own firm, not directly through FINRA." },
      { text: "Recognize that all outside employment is automatically prohibited for registered persons", explanation: "Outside business activity isn't automatically prohibited — it's permitted subject to prior notice to, and any conditions imposed by, the firm." },
    ],
  },
  {
    id: "sieb-rf-23",
    section: "regulatory",
    q: "For recordkeeping purposes, a 'customer complaint' that a firm must capture in its complaint records is best described as:",
    a: "Any written statement from a customer alleging a grievance involving the firm or its associated persons in handling the customer's account",
    explanation: "The recordkeeping obligation is triggered by a written grievance about account handling — it isn't limited to complaints that result in a settlement, and a merely verbal remark to a principal doesn't by itself create the same documented record.",
    options: [
      { text: "Any written statement from a customer alleging a grievance involving the firm or its associated persons in handling the customer's account", explanation: "Correct — this is the standard that triggers the recordkeeping requirement." },
      { text: "Only a complaint that results in a monetary settlement paid to the customer", explanation: "The recordkeeping duty attaches to the written complaint itself, not only to complaints that end in a payout." },
      { text: "Only a complaint made verbally, in person, to a branch principal", explanation: "A written complaint is what specifically triggers this recordkeeping requirement; a purely verbal remark is treated differently." },
      { text: "Only complaints from institutional clients, not retail customers", explanation: "The complaint recordkeeping requirement isn't limited to institutional clients — it applies to customer complaints broadly." },
    ],
  },
  {
    id: "sieb-rf-24",
    section: "regulatory",
    q: "A customer's brokerage account agreement includes a pre-dispute arbitration clause. If a dispute later arises between the customer and the firm, this clause means the dispute will generally be resolved through:",
    a: "Mandatory arbitration under FINRA's Code of Arbitration Procedure, rather than through civil court litigation",
    explanation: "Pre-dispute arbitration clauses in customer agreements commit both sides to FINRA arbitration for covered disputes, forgoing a jury trial in civil court.",
    options: [
      { text: "Mandatory arbitration under FINRA's Code of Arbitration Procedure, rather than through civil court litigation", explanation: "Correct — a pre-dispute arbitration clause channels the dispute into FINRA arbitration instead of court." },
      { text: "Civil court litigation, since arbitration clauses are not enforceable against customers", explanation: "These clauses are generally enforceable and are exactly what routes the dispute to arbitration instead of court." },
      { text: "Non-binding mediation only, with no possibility of a binding outcome", explanation: "Arbitration under this clause produces a binding decision — that's a key difference from mediation." },
      { text: "A direct administrative hearing before the SEC", explanation: "This kind of customer dispute is handled through FINRA's arbitration forum, not an SEC administrative hearing." },
    ],
  },
  {
    id: "sieb-rf-25",
    section: "regulatory",
    q: "Which of the following best distinguishes mediation from arbitration in FINRA's dispute resolution process?",
    a: "Mediation is a voluntary, non-binding process aimed at a mutually agreed settlement, while arbitration produces a binding decision imposed by the arbitrator(s)",
    explanation: "Mediation relies on a neutral facilitator helping the parties reach their own settlement and either side can walk away, whereas arbitration ends with a decision the parties are bound to accept.",
    options: [
      { text: "Mediation is a voluntary, non-binding process aimed at a mutually agreed settlement, while arbitration produces a binding decision imposed by the arbitrator(s)", explanation: "Correct — this is the core distinction between the two processes." },
      { text: "Mediation produces a binding decision, while arbitration is voluntary and non-binding", explanation: "This reverses the actual roles of the two processes." },
      { text: "They are simply two names for the identical process", explanation: "They are structurally different: one is a facilitated negotiation, the other a binding adjudication." },
      { text: "Mediation is only available to institutional customers, never retail customers", explanation: "Mediation is not restricted to institutional customers — retail customers can also use it to resolve disputes." },
    ],
  },
  {
    id: "sieb-rf-26",
    section: "regulatory",
    q: "Minimum requirements for how long a broker-dealer must retain customer account records and business communications are primarily set by:",
    a: "The SEC, through its books-and-records rules, supplemented by FINRA's own recordkeeping rules",
    explanation: "The SEC's recordkeeping rules establish the baseline retention framework for broker-dealers, and FINRA layers on its own complementary rules; the MSRB's rulemaking is limited to municipal securities activity, and the IRS has no role in setting these retention requirements.",
    options: [
      { text: "The SEC, through its books-and-records rules, supplemented by FINRA's own recordkeeping rules", explanation: "Correct — the SEC and FINRA together set these requirements for broker-dealers." },
      { text: "The MSRB, for all broker-dealer records regardless of product type", explanation: "The MSRB's rulemaking is limited to municipal securities activity, not all broker-dealer records generally." },
      { text: "The Internal Revenue Service", explanation: "The IRS administers tax law and does not set broker-dealer books-and-records requirements." },
      { text: "Each firm decides its own retention periods with no external minimum", explanation: "There are binding external minimum retention requirements — firms don't set these purely on their own." },
    ],
  },
  {
    id: "sieb-rf-27",
    section: "regulatory",
    q: "Under FINRA Rule 2210, a firm's routine written communication sent to 40 retail investors within a 30-calendar-day period is classified as:",
    a: "A retail communication",
    explanation: "Rule 2210 classifies written communication to more than 25 retail investors within 30 calendar days as a 'retail communication'; communication to 25 or fewer retail investors within that window is 'correspondence' instead.",
    options: [
      { text: "A retail communication", explanation: "Correct — sending to more than 25 retail investors within 30 days makes this a retail communication." },
      { text: "Correspondence", explanation: "Correspondence is limited to communications sent to 25 or fewer retail investors within 30 calendar days; 40 recipients exceeds that threshold." },
      { text: "An institutional communication", explanation: "Institutional communications are those distributed only to institutional investors, not to retail investors." },
      { text: "None of these categories apply to written communications", explanation: "FINRA Rule 2210 does classify all written communications into one of these categories." },
    ],
  },
  {
    id: "sieb-rf-28",
    section: "regulatory",
    q: "Under FINRA Rule 2210, before a firm's retail communication about a registered investment company is first used with the public, it must generally be:",
    a: "Approved in writing by a registered principal of the firm prior to use",
    explanation: "Retail communications generally require prior written approval by a qualified registered principal before first use, and certain categories must also be filed with FINRA within required timeframes.",
    options: [
      { text: "Approved in writing by a registered principal of the firm prior to use", explanation: "Correct — prior principal approval is the general requirement for retail communications." },
      { text: "Exempt from any internal review, since it concerns a routine product", explanation: "Retail communications aren't exempt from review just because the product is routine — principal approval is still generally required." },
      { text: "Approved directly by the SEC before every use", explanation: "Approval runs through the firm's own registered principal and, in some cases, filing with FINRA — not direct case-by-case SEC approval." },
      { text: "Subject to exactly the same approval process as correspondence", explanation: "Correspondence is generally subject to a different, lighter supervisory review process than the prior-approval requirement for retail communications." },
    ],
  },
];
