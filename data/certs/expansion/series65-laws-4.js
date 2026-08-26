// Series 65 - "laws" section, expansion batch 4 of 4.
// Part 4/4 slice: the federal Acts — Securities Act of 1933, Securities Exchange
// Act of 1934, Investment Company Act of 1940. NOTE: batches 1-3 of this section
// already cover these Acts heavily, so this batch is deliberately routed around
// ground they occupy. Specifically avoided as already-tested elsewhere: the
// cooling-off period name and what may be done during it (x301, x118), the red
// herring's omitted price/effective date (x302), Rule 506(b) vs 506(c) (x303),
// free writing prospectus (x304), Regulation A (x305), Section 11 issuer strict
// liability (x309) and the underwriter's due diligence showing (x310), Section
// 16(a) insider reporting (x313), Schedule 13D (x314), Williams Act tender offer
// mechanics (x315), ICA board composition 40% (x316), Section 17 self-dealing
// (x317), the Names Rule (x318), and open-end vs. closed-end share pricing (x319).
// Focus areas here: 1933 Act exempt securities, Rule 144 resale, Rule 415 shelf,
// Section 4(a)(2)/Rule 506 statutory basis, Rule 134 tombstones, antifraud
// surviving exemption, who holds the Section 11 due diligence defense; 1934 Act
// origin of the SEC, Form 8-K, Section 16(b) short-swing, proxy statement
// content, Rule 10b-5's source; ICA Section 13 fundamental policy votes, Section
// 15 advisory contract renewal, independent directors' purpose, and UITs.
// No dated/inflation-adjusted dollar figures are used anywhere in this batch.
export const S65_LAWS_X4 = [
  {
    id: "s65-lw-x401",
    section: "laws",
    q: "Which of the following is generally exempt from the registration requirements of the Securities Act of 1933 because of the type of security involved, rather than because of how it is sold?",
    a: "Securities issued or guaranteed by the U.S. government, or by a state or municipality",
    explanation: "The 1933 Act distinguishes exempt securities — which escape registration by their nature, such as government and municipal issues — from exempt transactions, which escape registration because of the manner of the offering (for example, a private placement). Government and municipal paper falls in the first category.",
    options: [
      { text: "Securities issued or guaranteed by the U.S. government, or by a state or municipality", explanation: "Correct — these are classic exempt securities, exempt by virtue of the issuer and instrument itself." },
      { text: "Common stock of a newly formed company being offered to the general public for the first time", explanation: "A first-time public offering of corporate stock is the paradigm case requiring registration, not an exempt security." },
      { text: "Shares of an open-end investment company offered continuously to retail investors", explanation: "Mutual fund shares are registered securities under the 1933 Act; continuous offering does not make them exempt." },
      { text: "Corporate bonds sold to the public in a widely marketed underwritten offering", explanation: "Corporate debt sold publicly must be registered absent a separate exemption — the instrument itself carries no exempt status." },
    ],
  },
  {
    id: "s65-lw-x402",
    section: "laws",
    q: "Rule 144 under the Securities Act of 1933 is best described as:",
    a: "A safe harbor permitting the public resale of restricted or control securities once conditions such as a holding period, volume limits, and manner-of-sale requirements are satisfied",
    explanation: "Rule 144 addresses resales by holders — not new issuance by the issuer. It gives someone holding restricted stock (acquired in an unregistered offering) or control stock (held by an affiliate) an objective path to sell into the public market without the resale itself being treated as an unregistered distribution.",
    options: [
      { text: "A safe harbor permitting the public resale of restricted or control securities once conditions such as a holding period, volume limits, and manner-of-sale requirements are satisfied", explanation: "Correct — Rule 144 is a conditional safe harbor for resales of restricted and control securities." },
      { text: "An absolute prohibition on ever reselling restricted securities into the public market", explanation: "Rule 144 exists precisely to open a path for such resales; it conditions them rather than banning them outright." },
      { text: "An exemption allowing an issuer to sell newly issued shares to the public without registering them", explanation: "This misdirects the rule at the wrong party — Rule 144 governs resales by existing holders, not primary issuance by the issuer." },
      { text: "A requirement that an affiliate obtain SEC approval before each individual sale of stock", explanation: "No SEC approval is required for a Rule 144 sale; the rule works through objective conditions, with only a notice filing in certain larger sales." },
    ],
  },
  {
    id: "s65-lw-x403",
    section: "laws",
    q: "Under Section 11 of the Securities Act of 1933, which party facing liability for a material misstatement in a registration statement generally has access to a 'due diligence' defense?",
    a: "An underwriter or outside director, by showing a reasonable investigation was conducted and a reasonable belief the statements were true",
    explanation: "Section 11 imposes near-strict liability on the issuer itself, but underwriters, directors, officers who signed the registration statement, and named experts can avoid liability by proving they reasonably investigated and reasonably believed the disclosures were accurate.",
    options: [
      { text: "An underwriter or outside director, by showing a reasonable investigation was conducted and a reasonable belief the statements were true", explanation: "Correct — the due diligence defense is available to parties other than the issuer who can show reasonable investigation." },
      { text: "The issuer itself, regardless of what investigation it performed", explanation: "The issuer generally cannot use a due diligence defense — its Section 11 liability is close to strict liability." },
      { text: "Only the SEC staff who reviewed the filing", explanation: "The SEC is a regulator reviewing the filing, not a defendant facing Section 11 liability in the first place." },
      { text: "No one — Section 11 liability can never be defended against", explanation: "This overstates the rule; several non-issuer defendants do have a recognized due diligence defense." },
    ],
  },
  {
    id: "s65-lw-x404",
    section: "laws",
    q: "SEC Rule 415, permitting 'shelf registration,' allows an eligible issuer under the Securities Act of 1933 to:",
    a: "Register securities once and then sell them in one or more offerings over time, without filing a new registration statement for each individual offering",
    explanation: "Shelf registration lets an issuer register a pool of securities in advance and take them 'off the shelf' to sell opportunistically as market conditions allow, rather than restarting the registration process for every offering.",
    options: [
      { text: "Register securities once and then sell them in one or more offerings over time, without filing a new registration statement for each individual offering", explanation: "Correct — this efficiency is the entire purpose of shelf registration." },
      { text: "Avoid SEC registration entirely for future offerings", explanation: "Shelf registration is still a registration under the 1933 Act — it doesn't eliminate the registration requirement." },
      { text: "Sell securities exclusively to the issuer's existing officers and directors", explanation: "Shelf registration has nothing to do with restricting purchasers to insiders." },
      { text: "Bypass the requirement to deliver any prospectus to purchasers", explanation: "Prospectus delivery obligations still apply to shelf offerings; the rule addresses registration timing, not disclosure delivery." },
    ],
  },
  {
    id: "s65-lw-x405",
    section: "laws",
    q: "An issuer conducting a private placement under Rule 506 of Regulation D is relying on a safe harbor built on which underlying provision of the Securities Act of 1933?",
    a: "Section 4(a)(2), the exemption for transactions by an issuer not involving any public offering",
    explanation: "Rule 506 is a safe harbor under Section 4(a)(2): satisfying the rule's objective conditions establishes the statutory 'no public offering' exemption without having to litigate case-by-case whether an offering was truly private. (Not every Regulation D rule rests on 4(a)(2) — Rule 504 is instead grounded in the SEC's separate small-offering authority under Section 3(b).)",
    options: [
      { text: "Section 4(a)(2), the exemption for transactions by an issuer not involving any public offering", explanation: "Correct — Regulation D implements this statutory exemption as a safe harbor." },
      { text: "Section 11, the civil liability provision for registration statement misstatements", explanation: "Section 11 addresses liability for misstatements in a registered offering — it isn't the source of the private placement exemption." },
      { text: "Section 16, the insider reporting and short-swing profit provision", explanation: "Section 16 is an Exchange Act of 1934 insider-trading provision unrelated to the 1933 Act's registration exemptions." },
      { text: "Section 10(b), the general antifraud provision", explanation: "Section 10(b) is an Exchange Act antifraud provision, not the basis for the 1933 Act's private offering exemption." },
    ],
  },
  {
    id: "s65-lw-x406",
    section: "laws",
    q: "A transaction that is exempt from the Securities Act of 1933's registration requirements is nonetheless always subject to:",
    a: "The Act's general antifraud provisions",
    explanation: "Registration exemptions relieve an issuer of the registration and prospectus-delivery burden, but they never excuse fraud — misrepresentations or omissions of material fact remain actionable regardless of exemption.",
    options: [
      { text: "The Act's general antifraud provisions", explanation: "Correct — exemption from registration is never exemption from antifraud liability." },
      { text: "Mandatory SEC pre-approval of the offering's merits", explanation: "The SEC does not pass judgment on the investment merits of any offering, exempt or registered — that isn't how 1933 Act review works." },
      { text: "A requirement to file a full registration statement anyway", explanation: "This contradicts the premise — an exempt transaction is, by definition, relieved of the registration statement requirement." },
      { text: "State law preemption, so no state can ever regulate the transaction", explanation: "A federal exemption doesn't automatically preempt all state authority; states can still retain certain notice or antifraud powers." },
    ],
  },
  {
    id: "s65-lw-x407",
    section: "laws",
    q: "A 'tombstone advertisement' published during the waiting period of a registered securities offering is limited to:",
    a: "Basic identifying information about the security and the offering, and is not itself an offer to sell",
    explanation: "Tombstone ads are named for their plain, notice-like format; they may state facts like the security's name, amount, and the underwriters involved, but they cannot solicit an actual purchase before the registration statement is effective.",
    options: [
      { text: "Basic identifying information about the security and the offering, and is not itself an offer to sell", explanation: "Correct — a tombstone ad is informational notice, not a solicitation to buy." },
      { text: "A full sales pitch encouraging investors to place orders immediately", explanation: "This is exactly what a tombstone ad is not allowed to be during the pre-effective waiting period." },
      { text: "Detailed financial projections and performance guarantees for the issuer", explanation: "Tombstone ads are deliberately bare-bones identifying notices, not vehicles for projections or guarantees." },
      { text: "A complete copy of the final prospectus", explanation: "A tombstone ad is a brief notice, far shorter than and distinct from a prospectus." },
    ],
  },
  {
    id: "s65-lw-x408",
    section: "laws",
    q: "Under the Securities Exchange Act of 1934, which periodic filing is used to disclose significant unscheduled corporate events (such as a major acquisition or executive departure) as they occur?",
    a: "Form 8-K",
    explanation: "Form 8-K is the 'current report' companies must file promptly after specified triggering events, in contrast to the regularly scheduled Form 10-K (annual) and Form 10-Q (quarterly) reports.",
    options: [
      { text: "Form 8-K", explanation: "Correct — Form 8-K is the current report for material unscheduled events." },
      { text: "Form 10-K", explanation: "Form 10-K is the comprehensive annual report, filed on a fixed schedule rather than triggered by a specific event." },
      { text: "Form 10-Q", explanation: "Form 10-Q is the quarterly report, also filed on a fixed periodic schedule rather than triggered by a specific event." },
      { text: "Form ADV", explanation: "Form ADV is an investment adviser registration and disclosure form under the Investment Advisers Act, unrelated to reporting-company disclosure under the Exchange Act." },
    ],
  },
  {
    id: "s65-lw-x409",
    section: "laws",
    q: "Section 16 of the Securities Exchange Act of 1934 imposes beneficial ownership reporting requirements specifically on:",
    a: "Officers, directors, and beneficial owners of more than a specified threshold percentage of the company's equity securities",
    explanation: "Section 16 targets corporate insiders — officers, directors, and large beneficial owners — because they're positioned to have access to material nonpublic information about the company.",
    options: [
      { text: "Officers, directors, and beneficial owners of more than a specified threshold percentage of the company's equity securities", explanation: "Correct — these are the categories of 'insiders' Section 16 covers." },
      { text: "Every shareholder of the company, regardless of position or ownership size", explanation: "Section 16 targets insiders specifically, not the general shareholder base." },
      { text: "Only the company's outside auditors", explanation: "Auditors are not the class of insiders Section 16 was designed to capture; it targets officers, directors, and large owners." },
      { text: "Only registered broker-dealers who trade the company's stock", explanation: "Section 16 is about corporate insiders, not broker-dealers generally trading a company's shares." },
    ],
  },
  {
    id: "s65-lw-x410",
    section: "laws",
    q: "The 'short-swing profit' rule under Section 16(b) of the Securities Exchange Act of 1934 requires an insider to:",
    a: "Disgorge to the company any profit realized from a purchase and sale, or sale and purchase, of the company's stock occurring within a specified short period of each other",
    explanation: "Section 16(b) operates without regard to whether the insider actually used inside information — matching a purchase and sale within the specified short window automatically triggers recovery of the profit, on the theory that the opportunity for abuse alone justifies the rule.",
    options: [
      { text: "Disgorge to the company any profit realized from a purchase and sale, or sale and purchase, of the company's stock occurring within a specified short period of each other", explanation: "Correct — this automatic disgorgement is the mechanism of the short-swing profit rule." },
      { text: "Prove they actually traded on material nonpublic information before any recovery applies", explanation: "Section 16(b) is a strict, mechanical rule — recovery does not depend on proving actual misuse of inside information." },
      { text: "Hold the company's stock for at least ten years before any sale is permitted", explanation: "The short-swing rule addresses a short matching window between transactions, not a long minimum holding period." },
      { text: "Report the profit only to the state securities Administrator", explanation: "Section 16(b) is a federal Exchange Act mechanism resulting in disgorgement to the company, not a state reporting obligation." },
    ],
  },
  {
    id: "s65-lw-x411",
    section: "laws",
    q: "Registration of broker-dealers with the SEC is required under which federal statute?",
    a: "The Securities Exchange Act of 1934",
    explanation: "The Exchange Act of 1934 governs the ongoing regulation of secondary market participants, including broker-dealer registration, in contrast to the Investment Advisers Act of 1940 (which governs adviser registration) and the Securities Act of 1933 (which governs new issue registration).",
    options: [
      { text: "The Securities Exchange Act of 1934", explanation: "Correct — broker-dealer registration is an Exchange Act requirement." },
      { text: "The Investment Advisers Act of 1940", explanation: "The Advisers Act governs investment adviser registration, a distinct regime from broker-dealer registration." },
      { text: "The Securities Act of 1933", explanation: "The 1933 Act governs registration of new securities offerings, not registration of broker-dealer firms." },
      { text: "The Investment Company Act of 1940", explanation: "The Investment Company Act governs pooled investment vehicles, not broker-dealer firm registration." },
    ],
  },
  {
    id: "s65-lw-x412",
    section: "laws",
    q: "The U.S. Securities and Exchange Commission itself was created by:",
    a: "The Securities Exchange Act of 1934",
    explanation: "A common point of confusion: the Securities Act of 1933 governs the registration of new securities offerings, but it was the Exchange Act of 1934 that actually established the SEC as the federal agency to administer both statutes.",
    options: [
      { text: "The Securities Exchange Act of 1934", explanation: "Correct — the 1934 Act created the SEC as an agency." },
      { text: "The Securities Act of 1933", explanation: "The 1933 Act preceded the SEC's creation and addressed new-issue registration; it did not itself establish the agency." },
      { text: "The Investment Advisers Act of 1940", explanation: "This 1940 statute regulates advisers and postdates the SEC's creation — it didn't create the agency." },
      { text: "The Uniform Securities Act", explanation: "The Uniform Securities Act is model state legislation, not a federal statute, and has no role in creating the SEC." },
    ],
  },
  {
    id: "s65-lw-x413",
    section: "laws",
    q: "Under the proxy rules the SEC adopted pursuant to the Securities Exchange Act of 1934, a company soliciting shareholder votes on a matter such as a director election or a proposed merger must generally:",
    a: "Furnish shareholders a proxy statement disclosing specified information about the matters to be voted upon",
    explanation: "The proxy rules are a disclosure regime, not a merits regime: the shareholder must receive the information needed to vote intelligently, but the SEC takes no position on whether the proposal is a good idea and does not decide the outcome.",
    options: [
      { text: "Furnish shareholders a proxy statement disclosing specified information about the matters to be voted upon", explanation: "Correct — mandated disclosure before or at the time of solicitation is the core of the proxy rules." },
      { text: "Obtain the SEC's approval of the merits of the proposal before soliciting any votes", explanation: "The SEC never passes on the merits of a proposal; the proxy rules compel disclosure, not federal endorsement." },
      { text: "Restrict voting to those shareholders who attend the meeting in person", explanation: "This inverts the purpose of a proxy, which exists precisely so shareholders can vote without attending in person." },
      { text: "Guarantee in advance that the proposal being voted on will pass", explanation: "Nothing in the proxy rules guarantees an outcome — the rules govern the information given to shareholders deciding how to vote." },
    ],
  },
  {
    id: "s65-lw-x414",
    section: "laws",
    q: "The Williams Act, which amended the Securities Exchange Act of 1934, was enacted primarily to regulate:",
    a: "Attempts to acquire control of a company through a public tender offer, by requiring disclosure to target shareholders",
    explanation: "Before the Williams Act, a bidder could pursue a rapid, secretive tender offer with little disclosure; the amendment requires bidders crossing certain ownership thresholds to disclose their intentions and gives target shareholders more time and information to respond.",
    options: [
      { text: "Attempts to acquire control of a company through a public tender offer, by requiring disclosure to target shareholders", explanation: "Correct — this is the core purpose of the Williams Act tender offer rules." },
      { text: "The registration of new investment adviser representatives", explanation: "IAR registration is a separate matter under the Advisers Act and state law, unrelated to the Williams Act's tender offer focus." },
      { text: "The initial public offering registration process", explanation: "IPO registration is governed by the Securities Act of 1933, not the Williams Act's tender offer disclosure rules." },
      { text: "Custody requirements for investment advisers", explanation: "Custody rules arise under the Advisers Act, a different regime entirely from tender offer regulation." },
    ],
  },
  {
    id: "s65-lw-x415",
    section: "laws",
    q: "The general antifraud rule prohibiting manipulative or deceptive devices in connection with the purchase or sale of any security, commonly known as Rule 10b-5, was adopted under:",
    a: "Section 10(b) of the Securities Exchange Act of 1934",
    explanation: "Rule 10b-5 is the SEC's implementing rule under Section 10(b) of the Exchange Act, and it is the broad antifraud tool used in insider trading and general securities fraud cases involving purchases or sales of securities.",
    options: [
      { text: "Section 10(b) of the Securities Exchange Act of 1934", explanation: "Correct — Rule 10b-5 implements this Exchange Act antifraud provision." },
      { text: "Section 11 of the Securities Act of 1933", explanation: "Section 11 addresses registration statement misstatement liability, a narrower and distinct provision from the broad 10b-5 antifraud rule." },
      { text: "Section 206 of the Investment Advisers Act of 1940", explanation: "Section 206 is the Advisers Act's own antifraud provision applicable to advisers specifically, not the source of Rule 10b-5." },
      { text: "Section 17 of the Investment Company Act of 1940", explanation: "Section 17 addresses affiliated transactions within investment companies, unrelated to the general 10b-5 antifraud rule." },
    ],
  },
  {
    id: "s65-lw-x416",
    section: "laws",
    q: "A registered fund wants to change a policy it has designated as 'fundamental' — for example, its stated investment objective or its limit on borrowing. Under the Investment Company Act of 1940, the change generally requires:",
    a: "Approval by a vote of a majority of the fund's outstanding voting securities",
    explanation: "This is the practical consequence of labeling a policy 'fundamental': it can only be changed by the shareholders, not by management. Policies the fund designates as non-fundamental, by contrast, can be changed by the board alone — which is why the fundamental/non-fundamental line matters to an investor relying on a stated objective.",
    options: [
      { text: "Approval by a vote of a majority of the fund's outstanding voting securities", explanation: "Correct — a fundamental policy is one that may be changed only by shareholder vote." },
      { text: "A vote of the fund's board of directors alone, with no shareholder involvement", explanation: "This describes how a non-fundamental policy may be changed; the whole point of a fundamental policy is that the board cannot change it unilaterally." },
      { text: "Advance written approval from the SEC before the policy may be changed", explanation: "The Act routes this decision to the fund's shareholders, not to SEC pre-approval of the policy change." },
      { text: "Unanimous written consent of every shareholder of the fund", explanation: "Unanimity is not the standard — the Act requires a specified majority of outstanding voting securities, not consent from every holder." },
    ],
  },
  {
    id: "s65-lw-x417",
    section: "laws",
    q: "The Investment Company Act of 1940's requirement that a fund's board include directors who are not 'interested persons' of the fund or its adviser is intended primarily to:",
    a: "Provide independent oversight that can guard against conflicts of interest between the fund and its adviser or other affiliates",
    explanation: "Because a fund's day-to-day management is typically delegated to an external adviser with its own financial interests, independent directors serve as a check on matters like advisory fee negotiation and affiliated transactions.",
    options: [
      { text: "Provide independent oversight that can guard against conflicts of interest between the fund and its adviser or other affiliates", explanation: "Correct — independent director oversight exists to police these conflicts." },
      { text: "Guarantee a minimum investment return to fund shareholders", explanation: "Independent directors provide governance oversight; they have no role in guaranteeing investment performance." },
      { text: "Eliminate the fund's need to retain any investment adviser", explanation: "The requirement addresses board composition, not whether the fund may retain an adviser at all." },
      { text: "Allow the fund's adviser to control the entire board", explanation: "This is the opposite of the requirement's purpose, which is to limit adviser-affiliated control of the board." },
    ],
  },
  {
    id: "s65-lw-x418",
    section: "laws",
    q: "Under the Investment Company Act of 1940, continuation of a registered fund's investment advisory contract beyond its initial term must generally be approved at least annually by:",
    a: "The fund's board of directors, or a vote of the fund's outstanding voting securities — with a majority of the independent directors approving separately in either case",
    explanation: "The advisory contract is the fund's single largest recurring expense and its sharpest conflict of interest, so the Act refuses to let it renew on autopilot: continuance must be affirmatively approved each year, and the independent directors must sign off by a separate majority vote rather than being outvoted by adviser-affiliated board members.",
    options: [
      { text: "The fund's board of directors, or a vote of the fund's outstanding voting securities — with a majority of the independent directors approving separately in either case", explanation: "Correct — annual approval runs through the board or the shareholders, and the independent directors must separately approve." },
      { text: "The fund's investment adviser, in its sole discretion", explanation: "Letting the adviser renew its own contract would defeat the provision's purpose; the adviser is the conflicted party the approval requirement is aimed at." },
      { text: "The SEC staff, which must affirmatively renew each fund's advisory contract each year", explanation: "The SEC does not renew advisory contracts; the Act assigns that recurring judgment to the fund's board and shareholders." },
      { text: "The fund's independent public accountants, as part of the annual audit", explanation: "Auditors opine on financial statements; they have no role in approving the continuation of the advisory contract." },
    ],
  },
  {
    id: "s65-lw-x419",
    section: "laws",
    q: "A 'unit investment trust' (UIT), one of the three principal categories of investment company defined under the Investment Company Act of 1940, is characterized by:",
    a: "Holding a fixed, unmanaged portfolio of securities for a specified term, with no board of directors or active investment adviser making ongoing buy/sell decisions",
    explanation: "Unlike a management company (open-end or closed-end fund), a UIT is not actively managed after formation — its portfolio is fixed at inception and it has no board of directors, instead operating through a trust structure with redeemable units.",
    options: [
      { text: "Holding a fixed, unmanaged portfolio of securities for a specified term, with no board of directors or active investment adviser making ongoing buy/sell decisions", explanation: "Correct — a static, unmanaged portfolio without a board is the defining feature of a UIT." },
      { text: "Being actively managed on a discretionary, ongoing basis by a portfolio manager who frequently trades the holdings", explanation: "This describes a management company, not a unit investment trust." },
      { text: "Issuing a fixed number of shares once, which then trade at negotiated prices on an exchange", explanation: "This describes a closed-end fund's structure, not a unit investment trust's redeemable units." },
      { text: "Never terminating and existing in perpetuity", explanation: "UITs are typically structured with a specified, finite term rather than existing in perpetuity." },
    ],
  },
];
