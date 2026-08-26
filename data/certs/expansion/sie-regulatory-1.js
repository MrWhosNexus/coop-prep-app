// SIE (Securities Industry Essentials) exam — practice question bank
// Expansion batch for Section 4, Overview of the Regulatory Framework.
// Same quiz-item shape as data/certs/sie-bank.js: {id, section, q, a, explanation, options:[{text, explanation}]}
// All items here are tagged section: "regulatory" and are meant to be folded in alongside
// the existing regulatory-framework items (sieb-rf-01..14 in sie-bank.js, sieb-rf-15..28 in
// sie-bank-regulatory.js). This batch (ids sieb-rf-x101..x114) deliberately targets ground
// NOT already covered by those 29 items: the "customer" definition under the Code of
// Arbitration Procedure for Customer Disputes, FINRA's post-termination jurisdiction, the
// finer distinctions among the three Rule 2210 communication categories (correspondence,
// retail and institutional) and their approval/filing treatment, the separate treatment of
// public appearances under Rule 2210(f) — which are expressly NOT one of the three
// communication categories, see Rule 2210(a)(1) and (f)(1) — the practical
// consequences of statutory disqualification for both the individual and the sponsoring firm,
// who actually files and amends Forms U4/U5 and what BrokerCheck does and doesn't disclose,
// the breadth of "associated person," and two often-missed arbitration/mediation mechanics
// (the class-action carve-out from mandatory arbitration, and how mediation interacts with an
// already-filed arbitration case). No item keys a date-sensitive dollar figure, day count, or
// year count; every item tests a mechanism instead.

export const SIE_REGULATORY_X1 = [
  {
    id: "sieb-rf-x101",
    section: "regulatory",
    q: "Under FINRA's Code of Arbitration Procedure for Customer Disputes, the term 'customer' expressly excludes:",
    a: "Another broker-dealer",
    explanation: "FINRA Rule 12100(k) defines the term in the negative and in a single sentence: 'A customer shall not include a broker or dealer.' The customer arbitration forum is built around clients of a firm, whether retail or institutional; a broker-dealer counterparty is an industry participant instead, and disputes with one are handled under the separate Code of Arbitration Procedure for Industry Disputes (the Rule 13000 Series).",
    options: [
      { text: "Another broker-dealer", explanation: "Correct — Rule 12100(k) states that a customer shall not include a broker or dealer; industry disputes fall under the separate Rule 13000 Series." },
      { text: "A retail investor with a brokerage account at the firm", explanation: "A retail investor with an account is precisely the kind of person the 'customer' definition is meant to cover." },
      { text: "An institutional investor with a brokerage account at the firm", explanation: "Institutional investors with accounts at the firm are still customers of that firm, even though they receive different communication treatment under Rule 2210." },
      { text: "A trust that holds a brokerage account at the firm", explanation: "An account holder such as a trust is treated as a customer of the firm for these purposes." },
    ],
  },
  {
    id: "sieb-rf-x102",
    section: "regulatory",
    q: "A registered representative voluntarily resigns from a member firm. Regarding conduct that occurred while the person was still registered, FINRA's jurisdiction:",
    a: "Continues for a limited period after termination, allowing FINRA to investigate and take action on that prior conduct",
    explanation: "Resigning or being terminated does not erase FINRA's ability to pursue misconduct that happened while the person was registered — FINRA retains jurisdiction for a defined window after the person leaves the industry specifically so that conduct occurring under its watch can still be investigated and disciplined.",
    options: [
      { text: "Continues for a limited period after termination, allowing FINRA to investigate and take action on that prior conduct", explanation: "Correct — FINRA's jurisdiction over a former registered person extends for a period after termination for conduct that occurred while registered." },
      { text: "Ends immediately and completely the moment the Form U5 is filed", explanation: "FINRA's jurisdiction does not vanish the instant a U5 is filed; it persists for a period specifically to cover conduct during registration." },
      { text: "Never applied in the first place, since resignation is voluntary", explanation: "Whether a departure is voluntary or not has no bearing on whether FINRA can examine conduct that occurred during the person's registration." },
      { text: "Transfers automatically to the SEC, which alone can act on the matter", explanation: "FINRA itself retains authority to pursue the former registered person; the matter isn't automatically handed off exclusively to the SEC." },
    ],
  },
  {
    id: "sieb-rf-x103",
    section: "regulatory",
    q: "Under FINRA Rule 2210, an institutional communication distributed only to institutional investors, as compared to a retail communication:",
    a: "Does not require prior approval by a registered principal before use, though the firm must have written supervisory procedures for reviewing it",
    explanation: "Rule 2210(b)(1)(A) requires an appropriately qualified registered principal to approve each retail communication before the earlier of its use or filing. Rule 2210(b)(3) imposes no such blanket pre-approval on institutional communications: the firm must instead establish written procedures for principal review that are appropriate to its business, size, structure and customers — and where those procedures do not call for review before first use, they must provide for education and training of associated persons, documentation of that training, and surveillance and follow-up.",
    options: [
      { text: "Does not require prior approval by a registered principal before use, though the firm must have written supervisory procedures for reviewing it", explanation: "Correct — institutional communications skip the prior-approval requirement but are still subject to a supervisory procedures obligation." },
      { text: "Requires prior approval by a registered principal before use, identical to a retail communication", explanation: "This is exactly what Rule 2210 does not require for institutional communications, which is the point of distinguishing the category." },
      { text: "Is entirely unregulated and outside FINRA's communications rules", explanation: "Institutional communications remain squarely within Rule 2210's scope; the firm still owes supervisory obligations over them." },
      { text: "Must be filed with FINRA's Advertising Regulation Department before every use", explanation: "Rule 2210(c)(7)(K) expressly excludes institutional communications from the filing requirements altogether — not merely from pre-use filing." },
    ],
  },
  {
    id: "sieb-rf-x104",
    section: "regulatory",
    q: "Under FINRA Rule 2210, correspondence (written communication to 25 or fewer retail investors within a 30-calendar-day period) is generally supervised through:",
    a: "Risk-based principal review conducted under the firm's written supervisory procedures, rather than mandatory prior approval of each piece",
    explanation: "Correspondence doesn't need individual sign-off by a principal before it goes out the way retail communications generally do; instead, firms establish risk-based supervisory procedures — which can include sampling and post-use review — tailored to the risk the correspondence presents.",
    options: [
      { text: "Risk-based principal review conducted under the firm's written supervisory procedures, rather than mandatory prior approval of each piece", explanation: "Correct — correspondence supervision is generally risk-based rather than requiring prior approval of every item." },
      { text: "Mandatory prior written approval of every piece of correspondence before it is sent", explanation: "This prior-approval standard describes retail communications generally, not the lighter-touch treatment correspondence receives." },
      { text: "No supervision at all, since correspondence falls outside Rule 2210", explanation: "Correspondence is one of Rule 2210's defined communication categories and remains subject to supervisory obligations." },
      { text: "Direct, item-by-item review by the SEC before distribution", explanation: "Supervision of correspondence is handled internally by the firm under its own procedures, not by case-by-case SEC review." },
    ],
  },
  {
    id: "sieb-rf-x105",
    section: "regulatory",
    q: "A registered representative gives an unscripted interview on a financial news broadcast, discussing general market conditions. Under FINRA Rule 2210, this 'public appearance':",
    a: "Is not a retail communication at all, so no prior principal approval is required, though the representative must still follow Rule 2210's content standards",
    explanation: "Rule 2210(a)(1) says communications consist of exactly three things: correspondence, retail communications and institutional communications. Rule 2210(f)(1) then defines a 'public appearance' as a seminar, forum, radio or television interview or similar speaking activity that is unscripted and does NOT constitute any of those three — so the prior-approval requirement in (b)(1)(A), which reaches only retail communications, never attaches. What does attach is (f)(1)'s command that the associated person follow the content standards of paragraph (d)(1): no false, exaggerated or misleading statements, and a sound basis for evaluating the facts.",
    options: [
      { text: "Is not a retail communication at all, so no prior principal approval is required, though the representative must still follow Rule 2210's content standards", explanation: "Correct — Rule 2210(f)(1) defines a public appearance as unscripted activity that does not constitute a retail communication, institutional communication or correspondence, and it must meet the (d)(1) content standards." },
      { text: "Is treated identically to a retail communication and requires prior principal approval before the interview airs", explanation: "Prior principal approval under Rule 2210(b)(1)(A) applies to retail communications; a public appearance is by definition not one." },
      { text: "Falls completely outside FINRA's communications rules and is subject to no content standards", explanation: "Rule 2210(f)(1) expressly applies the paragraph (d)(1) content standards to public appearances, and (f)(3) requires the firm to have written procedures supervising them." },
      { text: "Must be filed with FINRA before the broadcast airs", explanation: "The filing requirements in Rule 2210(c) reach only specified retail communications; a public appearance is not among them." },
    ],
  },
  {
    id: "sieb-rf-x106",
    section: "regulatory",
    q: "Which of the following communications is most likely to trigger a requirement that the firm file it with FINRA's Advertising Regulation Department, apart from obtaining internal principal approval?",
    a: "A retail communication that promotes or recommends a specific registered investment company, such as a particular mutual fund",
    explanation: "Rule 2210(c)(3)(A) requires a member to file with the Department, within 10 business days of first use, any retail communication that promotes or recommends a specific registered investment company or family of registered investment companies (mutual funds, ETFs, variable insurance products, closed-end funds and unit investment trusts). The filing obligation is separate from, and additional to, the internal principal approval that Rule 2210(b)(1)(A) already requires. Correspondence and institutional communications are excluded from filing entirely by Rule 2210(c)(7)(J) and (K).",
    options: [
      { text: "A retail communication that promotes or recommends a specific registered investment company, such as a particular mutual fund", explanation: "Correct — Rule 2210(c)(3)(A) singles this category out for filing with the Department within 10 business days of first use." },
      { text: "Correspondence sent to 20 retail investors about their existing account statements", explanation: "At 25 or fewer retail investors in a 30-day period this is correspondence, which Rule 2210(c)(7)(J) expressly excludes from the filing requirements." },
      { text: "An institutional communication sent only to institutional investors", explanation: "Rule 2210(c)(7)(K) expressly excludes institutional communications from the filing requirements." },
      { text: "An internal firm memo never shown to the public", explanation: "A purely internal document that is never distributed to customers isn't a communication category subject to Rule 2210's filing requirements at all." },
    ],
  },
  {
    id: "sieb-rf-x107",
    section: "regulatory",
    q: "Which of the following would be a recognized basis for statutory disqualification, separate from a criminal conviction?",
    a: "The person was previously expelled or barred from membership or association by a self-regulatory organization",
    explanation: "Exchange Act Section 3(a)(39)(A) makes a person subject to statutory disqualification if the person 'has been and is expelled or suspended from membership or participation in, or barred or suspended from being associated with a member of, any self-regulatory organization.' Criminal convictions appear elsewhere in the same definition — disqualification is not limited to them; prior SRO and regulatory action is its own independent ground.",
    options: [
      { text: "The person was previously expelled or barred from membership or association by a self-regulatory organization", explanation: "Correct — a prior SRO expulsion or bar is itself a recognized ground for statutory disqualification." },
      { text: "The person once received a routine, informal coaching memo from their branch manager", explanation: "Routine internal coaching is not remotely the kind of formal regulatory or criminal history that triggers statutory disqualification." },
      { text: "The person changed employers three times in five years", explanation: "Ordinary job changes carry no disqualifying weight on their own." },
      { text: "The person failed the Series 7 exam on their first attempt", explanation: "Failing an exam attempt is not a disqualifying event; it simply means the candidate must wait and retake it." },
    ],
  },
  {
    id: "sieb-rf-x108",
    section: "regulatory",
    q: "A member firm associates with an individual it knows is subject to statutory disqualification, without seeking or receiving FINRA's approval through the required application process. Which of the following is true?",
    a: "The firm itself, not just the individual, can face FINRA disciplinary action for the improper association",
    explanation: "The statutory disqualification framework places an affirmative obligation on the sponsoring firm as well as the individual — a firm that knowingly associates with a disqualified person without going through the approval process exposes itself to its own regulatory liability, not just the individual.",
    options: [
      { text: "The firm itself, not just the individual, can face FINRA disciplinary action for the improper association", explanation: "Correct — the firm bears its own responsibility to seek approval, and skipping that process exposes the firm to liability." },
      { text: "Only the individual can be sanctioned; the firm bears no responsibility", explanation: "The firm's own obligation to seek approval means it can be held responsible too, not just the individual." },
      { text: "Nothing happens, since statutory disqualification only restricts individuals, not firms", explanation: "The framework imposes real obligations on sponsoring firms, and disregarding them carries consequences for the firm." },
      { text: "The association becomes automatically valid after 90 days if no one objects", explanation: "There is no mechanism by which an unapproved association involving a statutorily disqualified person becomes valid simply through the passage of time." },
    ],
  },
  {
    id: "sieb-rf-x109",
    section: "regulatory",
    q: "Form U4 is filed and subsequently amended in the Central Registration Depository (CRD) system by:",
    a: "The member firm, on behalf of the individual, based on information the individual provides",
    explanation: "The individual doesn't submit Form U4 directly to CRD — the firm files and amends it on the individual's behalf, drawing on information the individual is obligated to supply and keep current; both the individual and the firm share responsibility for the form's accuracy.",
    options: [
      { text: "The member firm, on behalf of the individual, based on information the individual provides", explanation: "Correct — the firm is the one that files and amends Form U4 in CRD, using the individual's disclosed information." },
      { text: "The individual, directly, without any firm involvement", explanation: "Individuals don't file Form U4 directly into CRD themselves; their firm handles the filing." },
      { text: "The SEC, after conducting its own independent investigation of the individual", explanation: "The SEC doesn't file or amend Form U4 for individuals; that responsibility sits with the sponsoring firm." },
      { text: "FINRA staff, who draft the form using publicly available records", explanation: "FINRA operates the CRD system but does not draft or submit an individual's Form U4 on the firm's behalf." },
    ],
  },
  {
    id: "sieb-rf-x110",
    section: "regulatory",
    q: "After a firm files a Form U5 terminating a representative, if the firm later learns that information on that U5 was inaccurate or incomplete, the firm must:",
    a: "File an amendment to the Form U5 to correct the record",
    explanation: "Form U5 isn't a one-and-done filing — if the firm discovers that what it reported was inaccurate or incomplete, it has an ongoing obligation to amend the U5 so the individual's regulatory record, including what shows up through BrokerCheck, stays accurate.",
    options: [
      { text: "File an amendment to the Form U5 to correct the record", explanation: "Correct — firms must amend a previously filed U5 when they learn the information was inaccurate or incomplete." },
      { text: "Leave the original filing as-is, since U5 filings can never be amended", explanation: "U5 filings can and must be amended when new or corrected information comes to light." },
      { text: "Wait for the individual to request the correction before making any changes", explanation: "The obligation to amend rests with the firm once it learns of the inaccuracy — it isn't contingent on the individual first requesting a fix." },
      { text: "Notify only the individual privately, without updating the official filing", explanation: "A private notice to the individual doesn't satisfy the firm's obligation to correct the official CRD record itself." },
    ],
  },
  {
    id: "sieb-rf-x111",
    section: "regulatory",
    q: "Which of the following is available to the general public through FINRA's BrokerCheck?",
    a: "A summary of a broker's employment history and reportable disclosure events, such as regulatory actions or certain civil judicial matters",
    explanation: "BrokerCheck is designed to let the investing public look up a broker or firm's background — employment history and reportable disclosures are exactly the kind of information it surfaces — while sensitive personal identifiers like a Social Security number are never made public.",
    options: [
      { text: "A summary of a broker's employment history and reportable disclosure events, such as regulatory actions or certain civil judicial matters", explanation: "Correct — this is the core content BrokerCheck makes available to the public." },
      { text: "The broker's Social Security number, for identity verification purposes", explanation: "Sensitive personal identifiers like a Social Security number are never disclosed through the public BrokerCheck report." },
      { text: "The broker's personal brokerage account holdings and trade history", explanation: "BrokerCheck does not disclose an individual's personal trading activity or account holdings." },
      { text: "Nothing — BrokerCheck access is restricted to other FINRA member firms only", explanation: "BrokerCheck is specifically a public-facing tool, freely accessible to any member of the investing public, not restricted to member firms." },
    ],
  },
  {
    id: "sieb-rf-x112",
    section: "regulatory",
    q: "The term 'associated person' of a FINRA member firm is best described as covering:",
    a: "Partners, officers, directors, branch managers, and employees, plus any person controlling, controlled by, or under common control with the firm, whether or not registered",
    explanation: "Exchange Act Section 3(a)(18) defines an associated person of a broker or dealer as any partner, officer, director or branch manager (or anyone occupying a similar status or performing similar functions), any person directly or indirectly controlling, controlled by, or under common control with the firm, and any employee of the firm. Nothing in that definition turns on holding a registration — registration is a narrower, function-based requirement layered on top of the broader status, which is why every registered person is an associated person but not every associated person must register.",
    options: [
      { text: "Partners, officers, directors, branch managers, and employees, plus any person controlling, controlled by, or under common control with the firm, whether or not registered", explanation: "Correct — this tracks Exchange Act Section 3(a)(18); associated person is the broad umbrella term, larger than the population of registered persons." },
      { text: "Only individuals who currently hold an active securities registration", explanation: "This describes registered persons specifically, a narrower subset — associated person is a broader category that isn't limited to the registered." },
      { text: "Only customers who maintain a brokerage account with the firm", explanation: "Customers are not associated persons of the firm; associated person refers to those inside the firm's organizational structure, not its clients." },
      { text: "Only individuals who have passed the SIE exam", explanation: "Passing the SIE has no bearing on whether someone is an associated person; that status depends on the person's relationship to the firm's structure, not on any exam." },
    ],
  },
  {
    id: "sieb-rf-x113",
    section: "regulatory",
    q: "A customer's account agreement contains a standard pre-dispute arbitration clause. If the customer instead brings the claim as part of a certified or putative class action, FINRA's rules generally provide that:",
    a: "The arbitration clause cannot be enforced to compel arbitration of the class-action claim",
    explanation: "FINRA specifically carves class actions out of mandatory arbitration — a firm cannot use a customer agreement's pre-dispute arbitration clause to force a putative or certified class-action claim into arbitration, preserving the customer's ability to proceed as part of that class action in court.",
    options: [
      { text: "The arbitration clause cannot be enforced to compel arbitration of the class-action claim", explanation: "Correct — FINRA rules prevent firms from enforcing a pre-dispute arbitration clause against a putative or certified class action." },
      { text: "The claim must still proceed through mandatory FINRA arbitration regardless of its class-action status", explanation: "This is the opposite of the class-action carve-out FINRA's rules actually provide." },
      { text: "The clause converts the class action automatically into non-binding mediation", explanation: "There's no automatic conversion to mediation; the effect of the carve-out is that the class claim can proceed outside of arbitration entirely." },
      { text: "The customer forfeits the right to participate in the class action by having signed the agreement", explanation: "The customer's participation in a class action isn't forfeited by having a pre-dispute arbitration clause in the account agreement." },
    ],
  },
  {
    id: "sieb-rf-x114",
    section: "regulatory",
    q: "A customer and a firm are already in the middle of a filed FINRA arbitration case when they agree to also try mediation. If the mediation does not produce a settlement, what happens to the arbitration case?",
    a: "It continues, since mediation is a voluntary, non-binding process that doesn't replace or forfeit the parties' pending arbitration",
    explanation: "Mediation and arbitration aren't mutually exclusive — parties can attempt mediation alongside an already-filed arbitration case, and because mediation is non-binding, either side can walk away from it without losing anything; the arbitration simply proceeds as before if no settlement is reached.",
    options: [
      { text: "It continues, since mediation is a voluntary, non-binding process that doesn't replace or forfeit the parties' pending arbitration", explanation: "Correct — an unsuccessful mediation attempt doesn't terminate or forfeit the underlying arbitration case." },
      { text: "It is automatically dismissed, since attempting mediation forfeits the right to arbitrate", explanation: "Attempting mediation does not forfeit a party's right to continue with a pending arbitration case." },
      { text: "It converts into ordinary civil court litigation instead", explanation: "An unsuccessful mediation doesn't convert the matter into court litigation; the case remains in the arbitration forum where it was filed." },
      { text: "The mediator issues a binding ruling in place of the arbitrators", explanation: "A mediator has no authority to issue a binding ruling; only the arbitrators in the arbitration proceeding can render a binding decision." },
    ],
  },
];
