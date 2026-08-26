// Series 65 - "laws" section expansion batch (1 of 4).
// Bias: first third of scope -- Investment Advisers Act of 1940 mechanics not yet
// covered by the base bank or series65-bank-laws.js: the foreign private adviser
// exemption, regulatory AUM calculation, the IARD filing system, qualified
// custodian mechanics beyond the fee-deduction question, the Section 215(a)
// non-waiver rule voiding hedge clauses, assignment of advisory contracts
// through a change of control, the qualified-client performance-fee mechanism, brochure supplement
// timing, custody triggered through a related person, power-of-attorney/custody
// interaction, NASAA's exam-waiver rule for professional designations, and a
// handful of Securities Act 1933 / Exchange Act 1934 / Investment Company Act
// 1940 mechanism items (40% test, Reg D general solicitation, jurisdictional
// means for broker-dealer registration, 3(c)(1)/3(c)(7) private fund exclusion)
// to round out coverage of those three statutes within this batch.
// No dated/inflation-sensitive dollar figures are asserted as facts. Where a
// dollar threshold defines a legal test (e.g., the foreign private adviser
// prongs, the qualified client standard) the question tests the MECHANISM
// (which prongs must all be met, and why the carve-out exists) rather than
// asking the candidate to recall or apply the dollar amount itself, since those
// amounts are adjusted for inflation over time. Fixed STATUTORY percentages that
// do not drift year to year -- notably the Investment Company Act 40% test in
// s65-lw-x113 -- are stated outright, because hiding them behind "a specified
// percentage" would make the item vaguer without making it any more durable.

export const S65_LAWS_X1 = [
  {
    id: "s65-lw-x101",
    section: "laws",
    q: "An adviser has no place of business in the United States, does not hold itself out to the U.S. public as an investment adviser, and does not advise a registered investment company. To qualify as an exempt 'foreign private adviser,' it must ALSO satisfy which additional requirement?",
    a: "It has few U.S. clients and investors in private funds, and limited assets under management attributable to U.S. clients and investors, both measured against thresholds fixed by the Advisers Act itself",
    explanation: "The foreign private adviser exemption under the Advisers Act requires ALL of: no U.S. place of business, no holding out to the U.S. public, no advising a registered fund or BDC, AND fewer than a specified small number of U.S. clients and private fund investors combined, together with less than a specified small amount of U.S.-attributable AUM. Both of those numeric prongs are written into the statutory definition (the SEC is authorized to raise only the asset ceiling). Missing any one prong defeats the exemption.",
    options: [
      { text: "It has few U.S. clients and investors in private funds, and limited assets under management attributable to U.S. clients and investors, both measured against thresholds fixed by the Advisers Act itself", explanation: "Correct - the exemption is conjunctive: no U.S. place of business, no holding out to the U.S. public, no advising a registered fund or BDC, and both a low combined U.S. client/investor count and low U.S.-attributable AUM must all be true simultaneously." },
      { text: "It must register as a federal covered adviser and rely on NSMIA preemption instead", explanation: "Wrong - foreign private advisers are exempt from SEC registration; NSMIA preemption of state law is a separate concept for federal covered advisers who ARE registered." },
      { text: "It must appoint a U.S.-resident agent for service of process but otherwise faces no client-count or asset limits", explanation: "Wrong - the exemption does impose client-count and AUM limits; there is no unlimited-size version of this exemption." },
      { text: "It must limit its advice solely to non-securities assets while in the United States", explanation: "Wrong - the exemption is about the adviser's client base and U.S. footprint, not about the asset classes it advises on." },
    ],
  },
  {
    id: "s65-lw-x102",
    section: "laws",
    q: "When calculating 'regulatory assets under management' (RAUM) for purposes of determining SEC registration eligibility, an adviser must generally include the gross value of private fund assets:",
    a: "Without deducting outstanding fund-level debt or other liabilities used to acquire those assets",
    explanation: "RAUM is calculated on a gross basis. Unlike a fund's net asset value, an adviser cannot subtract borrowings, margin, or other liabilities when computing the securities portfolios it manages -- this generally makes RAUM larger than net equity value, which matters for advisers near a registration threshold.",
    options: [
      { text: "Without deducting outstanding fund-level debt or other liabilities used to acquire those assets", explanation: "Correct - RAUM uses the gross value of assets under management; liabilities and leverage are not netted out, even though this can push an adviser's reported RAUM well above the fund's net asset value." },
      { text: "Net of all fund-level debt, since only equity value reflects the adviser's true management responsibility", explanation: "Wrong - this describes a net-asset-value approach, which is not how RAUM is computed; RAUM is intentionally gross." },
      { text: "Only to the extent the adviser has discretionary authority over that specific asset class", explanation: "Wrong - RAUM generally includes all securities portfolios for which the adviser provides continuous and regular supervisory or management services, not a subset carved out by asset class." },
      { text: "Excluded entirely, since private fund assets are never counted toward an adviser's AUM", explanation: "Wrong - private fund assets are very much included in RAUM; this is precisely why the private fund adviser exemption and its size thresholds matter." },
    ],
  },
  {
    id: "s65-lw-x103",
    section: "laws",
    q: "The Investment Adviser Registration Depository (IARD) is best described as:",
    a: "The electronic system through which advisers file Form ADV and pay registration and renewal fees to the SEC and/or state securities Administrators",
    explanation: "IARD, operated by FINRA on behalf of the SEC and state regulators, is the electronic filing system used for Form ADV submission, amendments, ADV-W withdrawal filings, and fee payment. It does not itself decide registration eligibility -- it is the filing mechanism.",
    options: [
      { text: "The electronic system through which advisers file Form ADV and pay registration and renewal fees to the SEC and/or state securities Administrators", explanation: "Correct - IARD is the electronic filing depository for adviser (and IAR) registration, amendments, and fees, used by both the SEC and the states." },
      { text: "A self-regulatory organization with authority to examine and discipline investment advisers", explanation: "Wrong - IARD is a filing system, not a regulator or SRO; examination and disciplinary authority rests with the SEC or state Administrators." },
      { text: "A federal insurance fund that protects advisory clients against adviser insolvency", explanation: "Wrong - IARD has nothing to do with insurance or client asset protection; that concept is unrelated to this filing system." },
      { text: "A private credit-reporting bureau used only to screen prospective advisory clients", explanation: "Wrong - IARD is used by advisory firms to file registration paperwork, not to screen or vet clients." },
    ],
  },
  {
    id: "s65-lw-x104",
    section: "laws",
    q: "Under the Advisers Act custody rule, a 'qualified custodian' includes each of the following EXCEPT:",
    a: "An unaffiliated investment adviser that agrees contractually to hold the assets",
    explanation: "Qualified custodians are limited to banks and savings associations, registered broker-dealers, registered futures commission merchants, and certain foreign financial institutions. An investment adviser -- even an unaffiliated one -- is not itself a category of qualified custodian; advisers are the parties the custody rule is designed to check.",
    options: [
      { text: "An unaffiliated investment adviser that agrees contractually to hold the assets", explanation: "Correct - being an investment adviser is not one of the recognized qualified custodian categories; a contractual agreement between advisers does not convert one into a qualified custodian." },
      { text: "A federal or state-chartered bank or savings association", explanation: "Wrong as a distractor - banks and savings associations are a core qualified custodian category." },
      { text: "A broker-dealer registered with the SEC", explanation: "Wrong as a distractor - registered broker-dealers are a recognized qualified custodian category." },
      { text: "A registered futures commission merchant, with respect to customer funds and assets related to futures transactions", explanation: "Wrong as a distractor - futures commission merchants are a recognized qualified custodian category for futures-related assets." },
    ],
  },
  {
    id: "s65-lw-x105",
    section: "laws",
    q: "Under the custody rule's account statement safeguard, an adviser with custody of client funds or securities must generally ensure that:",
    a: "The qualified custodian sends account statements directly to the client at least quarterly, independent of any statements the adviser itself might send",
    explanation: "A core custody safeguard is that clients receive account statements directly from the qualified custodian -- not solely through the adviser -- so the client has an independent check on the adviser's reporting. The adviser sending its own statements does not substitute for this custodian-sourced statement.",
    options: [
      { text: "The qualified custodian sends account statements directly to the client at least quarterly, independent of any statements the adviser itself might send", explanation: "Correct - direct delivery of custodian account statements to the client (at least quarterly) is a central custody safeguard, providing an independent check on the adviser." },
      { text: "The adviser alone sends quarterly statements to the client, since duplicative statements from the custodian would confuse clients", explanation: "Wrong - the rule specifically wants the custodian's independent statement to reach the client; relying solely on the adviser's own reporting defeats the safeguard's purpose." },
      { text: "The client waives any right to receive statements in exchange for a reduced advisory fee", explanation: "Wrong - the account statement safeguard is not a waivable fee-negotiation item; it is a baseline investor protection." },
      { text: "The custodian statements are sent to the adviser, who then forwards them to the client whenever convenient", explanation: "Wrong - routing statements through the adviser reintroduces the risk the safeguard is meant to eliminate; direct custodian-to-client delivery is required." },
    ],
  },
  {
    id: "s65-lw-x106",
    section: "laws",
    q: "Compared with the 'LATE' exclusion for lawyers, accountants, teachers, and engineers (which applies only when their investment advice is solely incidental to their profession), the exclusion for banks and bank holding companies from the definition of investment adviser is:",
    a: "A categorical exclusion that does not depend on whether the bank's advice is merely incidental to other banking services",
    explanation: "Banks and bank holding companies (not performing investment adviser services to a registered investment company) are excluded from the IA definition outright, without the 'solely incidental' limitation that applies to the LATE professions. The exclusions rest on different legal tests even though both remove the entity from IA status.",
    options: [
      { text: "A categorical exclusion that does not depend on whether the bank's advice is merely incidental to other banking services", explanation: "Correct - the bank exclusion is not conditioned on an incidental-advice test the way the LATE exclusion is; banks are excluded as an entity category." },
      { text: "Identical in structure, since both exclusions require that advice be solely incidental to the entity's primary business", explanation: "Wrong - the bank exclusion does not carry the same 'solely incidental' condition that limits the LATE exclusion." },
      { text: "Unavailable, since banks are never excluded and must always register as investment advisers", explanation: "Wrong - banks and bank holding companies are, in fact, excluded from the IA definition; the question is about how that exclusion works, not whether it exists." },
      { text: "Available only if the bank charges no separate fee for any advisory-like service", explanation: "Wrong - the bank exclusion is not conditioned on fee structure; it is a categorical exclusion for the entity type." },
    ],
  },
  {
    id: "s65-lw-x107",
    section: "laws",
    q: "An advisory contract contains a clause providing that the client, by signing, gives up any claim against the adviser arising from conduct the Investment Advisers Act governs. Under Section 215(a) of the Act, that clause is:",
    a: "Void, regardless of how clearly it was disclosed or how knowingly the client agreed to it",
    explanation: "Section 215(a) provides that any condition, stipulation, or provision binding any person to waive compliance with the Act, or with any rule, regulation, or order under it, shall be void. The Act's protections -- including the adviser's federal fiduciary duty -- are simply not waivable: the adviser cannot contract out of them and the client cannot sign them away, so the quality of the client's consent never enters the analysis. This is what makes so-called 'hedge clauses' hazardous. The clause is void by operation of law, and a clause that leads a client to believe it has surrendered rights it actually still holds can independently raise a fraud problem under Section 206.",
    options: [
      { text: "Void, regardless of how clearly it was disclosed or how knowingly the client agreed to it", explanation: "Correct - Section 215(a) voids any provision binding a person to waive compliance with the Act by operation of law, so neither disclosure nor client consent can give the clause effect." },
      { text: "Enforceable, provided the adviser fully disclosed the clause's effect and the client signed it voluntarily", explanation: "Wrong - this treats the Act's protections as waivable with informed consent, which is exactly what Section 215(a) forecloses; disclosure cannot rescue a provision the statute declares void." },
      { text: "Enforceable as to institutional clients, though void as to retail clients", explanation: "Wrong - Section 215(a) reaches provisions binding 'any person' and draws no line based on the client's sophistication or institutional status." },
      { text: "Effective to void the entire advisory contract from inception, leaving the adviser unable to collect any fee already earned", explanation: "Wrong - Section 215(a) voids the offending provision itself, not the surrounding contract; the separate rule in Section 215(b), voiding contracts whose making or performance violates the Act as against the violator, addresses a different situation." },
    ],
  },
  {
    id: "s65-lw-x108",
    section: "laws",
    q: "An advisory firm undergoes a transaction in which a new investor acquires a controlling ownership interest, replacing the firm's prior controlling owners. Under the Advisers Act, this change in control:",
    a: "Is generally treated as an assignment of the firm's advisory contracts, requiring client consent",
    explanation: "A change in a majority or controlling ownership interest in an adviser is generally treated as an 'assignment' of its advisory contracts under the Act, even without a formal contract transfer, because control over the firm providing the advice has effectively changed hands -- triggering the same consent requirement as a direct assignment.",
    options: [
      { text: "Is generally treated as an assignment of the firm's advisory contracts, requiring client consent", explanation: "Correct - a change of control is treated as an assignment under the Advisers Act, so existing advisory contracts generally require client consent to continue." },
      { text: "Has no effect on existing advisory contracts, since the legal entity providing advice has not changed", explanation: "Wrong - it is precisely because the underlying legal entity survives unchanged that the assignment concept had to be extended to changes in control, not the other way around." },
      { text: "Automatically terminates every advisory contract by operation of law, with no path to continue them", explanation: "Wrong - obtaining client consent allows the contracts to continue; termination is not automatic and irreversible. The statutory definition of 'assignment' expressly reaches the transfer of a controlling block of the adviser's voting securities by a security holder, which is exactly what happened here." },
      { text: "Is relevant only for broker-dealer contracts, not investment advisory contracts", explanation: "Wrong - the assignment/change-of-control concept is a core Advisers Act principle applicable specifically to advisory contracts." },
    ],
  },
  {
    id: "s65-lw-x109",
    section: "laws",
    q: "The Advisers Act's general prohibition on performance-based compensation (fees tied to capital gains or appreciation) does not apply when the client is a 'qualified client' as defined by SEC rule. This exception exists because:",
    a: "Qualified clients are presumed, based on their wealth or sophistication, to be able to evaluate and bear the risks that performance fees can create for an adviser's incentives",
    explanation: "The performance fee restriction is meant to protect clients who may not appreciate how such fees can skew an adviser's incentives toward excessive risk-taking. The qualified client exception recognizes that sufficiently wealthy or sophisticated clients are better positioned to understand and negotiate around that risk, so the protection is relaxed for them.",
    options: [
      { text: "Qualified clients are presumed, based on their wealth or sophistication, to be able to evaluate and bear the risks that performance fees can create for an adviser's incentives", explanation: "Correct - the qualified client standard is a wealth/sophistication-based carve-out from the general performance fee prohibition." },
      { text: "Qualified clients have signed away all fiduciary protections in their advisory contract", explanation: "Wrong - being a qualified client affects only the performance-fee restriction; it does not waive the adviser's overall fiduciary duty." },
      { text: "Qualified clients are, by definition, institutions rather than natural persons", explanation: "Wrong - the qualified client definition can include sufficiently wealthy natural persons, not only institutions." },
      { text: "Performance fees are prohibited for all clients without exception, so no such carve-out exists", explanation: "Wrong - the qualified client exception is a well-established carve-out from the general performance fee restriction." },
    ],
  },
  {
    id: "s65-lw-x110",
    section: "laws",
    q: "A brochure supplement (Form ADV Part 2B) describing a specific supervised person who provides advice to a client must generally be delivered:",
    a: "No later than the time that supervised person begins providing advisory services to that client",
    explanation: "The firm brochure (Part 2A) must be delivered before or at the time the adviser enters into the advisory contract -- a firm-level, contract-based trigger. The brochure supplement runs on a different, person-specific trigger: it must reach the client before or at the time that particular supervised person begins to provide advisory services to that client, so the client has that individual's background from the outset of that specific relationship.",
    options: [
      { text: "No later than the time that supervised person begins providing advisory services to that client", explanation: "Correct - the brochure supplement must be delivered by the time the covered supervised person starts advising that particular client." },
      { text: "Only upon the client's specific written request, at any point during the relationship", explanation: "Wrong - delivery is not merely request-based; it is required proactively by the time advice begins from that supervised person." },
      { text: "Within a reasonable period after the end of the adviser's fiscal year", explanation: "Wrong - this loosely echoes the fiscal-year-based cadence for annual firm brochure delivery to existing clients, not the supplement's client-specific delivery trigger, which is tied to when the supervised person starts advising that client." },
      { text: "Only if the supervised person has discretionary authority; otherwise no supplement is ever required", explanation: "Wrong - discretionary authority is one trigger for who needs a supplement, but delivery timing itself is tied to when advice begins, and substantial client contact (not just discretion) can also require a supplement." },
    ],
  },
  {
    id: "s65-lw-x111",
    section: "laws",
    q: "An adviser itself never physically holds client funds or securities, but a company under common control with the adviser does hold client assets in connection with the advisory relationship. Under the custody rule, the adviser is generally treated as:",
    a: "Having custody, because custody extends to assets held by a 'related person' of the adviser in connection with advisory services provided to clients",
    explanation: "Custody is not limited to assets the adviser directly possesses. If a related person -- an entity under common control with the adviser -- holds client assets in connection with the advisory relationship, the adviser is deemed to have custody and must comply with the associated safeguards.",
    options: [
      { text: "Having custody, because custody extends to assets held by a 'related person' of the adviser in connection with advisory services provided to clients", explanation: "Correct - the custody rule reaches assets held by related persons, not just the adviser directly, closing an obvious loophole where an affiliate could hold assets instead." },
      { text: "Free of any custody obligations, since the adviser itself never touches client assets", explanation: "Wrong - this is exactly the loophole the related-person concept is designed to close; indirect holding through an affiliate still triggers custody obligations." },
      { text: "Subject to custody rules only if the related person charges a separate custody fee", explanation: "Wrong - custody status depends on who holds the assets and the relationship involved, not on whether a separate fee is charged for holding them." },
      { text: "Required to register the related person as a broker-dealer before any custody analysis applies", explanation: "Wrong - broker-dealer registration status of the related person is a separate question from whether the adviser has custody under this rule." },
    ],
  },
  {
    id: "s65-lw-x112",
    section: "laws",
    q: "A client grants an adviser a limited power of attorney authorizing trading decisions only, with no authority to withdraw or transfer funds to anyone other than the client. Compared with a full (general) power of attorney over the account, this arrangement:",
    a: "Grants discretionary trading authority but does not, by itself, give the adviser custody of client assets",
    explanation: "Discretionary trading authority (deciding what and when to buy or sell) is a distinct concept from custody (the ability to obtain possession of, or withdraw/direct disbursement of, client funds). A limited power of attorney restricted to trading decisions does not create custody, whereas a full power of attorney that permits withdrawals or disbursements to third parties generally does.",
    options: [
      { text: "Grants discretionary trading authority but does not, by itself, give the adviser custody of client assets", explanation: "Correct - trading discretion and custody are separate legal concepts; a trading-only limited power of attorney does not, alone, create custody." },
      { text: "Automatically gives the adviser custody, since any power of attorney is treated identically for custody purposes", explanation: "Wrong - the scope of the power of attorney matters a great deal; a full power of attorney permitting withdrawals is treated differently from one limited to trading decisions." },
      { text: "Is legally identical to a full power of attorney, since both require the same state registration disclosures", explanation: "Wrong - registration disclosure obligations may differ, but more fundamentally the custody consequence differs based on the scope of authority granted." },
      { text: "Eliminates the need for any written discretionary trading authorization on file", explanation: "Wrong - the limited power of attorney is itself a form of written discretionary authorization; it does not eliminate the need for one." },
    ],
  },
  {
    id: "s65-lw-x113",
    section: "laws",
    q: "Under the Investment Company Act of 1940, a company is generally presumed to be an 'investment company' subject to the Act if it is engaged primarily in the business of investing in securities, OR if:",
    a: "It owns 'investment securities' with a value exceeding 40% of its total assets (exclusive of government securities and cash items), regardless of its stated primary business",
    explanation: "This is the Act's asset-composition test, often called the 40% test: even a company that describes itself as an operating business can be swept into 'investment company' status if its investment securities exceed 40% of total assets, exclusive of government securities and cash items, absent an available exclusion (such as those relied on by many private funds). The 40% figure is written into the statute and does not change year to year.",
    options: [
      { text: "It owns 'investment securities' with a value exceeding 40% of its total assets (exclusive of government securities and cash items), regardless of its stated primary business", explanation: "Correct - this asset-composition test (the 40% test) can classify a company as an inadvertent investment company based on its balance sheet, independent of how the company describes its primary business." },
      { text: "It has more than 100 employees engaged in securities-related activities", explanation: "Wrong - employee headcount is not the test used to define investment company status under the Act." },
      { text: "It is organized as a corporation rather than as a trust or partnership", explanation: "Wrong - entity form (corporation, trust, partnership) does not determine investment company status; the nature of the business and asset composition do." },
      { text: "It has registered a class of securities under the Securities Exchange Act of 1934", explanation: "Wrong - Exchange Act registration is a separate reporting-company concept and does not itself trigger investment company status under the Investment Company Act." },
    ],
  },
  {
    id: "s65-lw-x114",
    section: "laws",
    q: "Under Regulation D's Rule 506 private placement safe harbor for exempting a securities offering from Securities Act of 1933 registration, an issuer that engages in general solicitation or general advertising to market the offering will generally:",
    a: "Lose the ability to rely on that exemption (absent using the specific 506(c) provision designed for solicited offerings, which requires verifying purchasers are accredited)",
    explanation: "The traditional private placement concept rests on offers being made only to a limited, non-public group. Broadly advertising or soliciting the offering defeats the standard Rule 506(b) exemption. Rule 506(c) permits general solicitation, but only if the issuer takes reasonable steps to verify that all purchasers are accredited investors -- a materially different and stricter standard.",
    options: [
      { text: "Lose the ability to rely on that exemption (absent using the specific 506(c) provision designed for solicited offerings, which requires verifying purchasers are accredited)", explanation: "Correct - general solicitation defeats the standard private placement safe harbor unless the issuer instead relies on Rule 506(c) and satisfies its accredited-investor verification requirement." },
      { text: "Remain fully exempt with no additional conditions, since Regulation D permits unrestricted advertising in all cases", explanation: "Wrong - unrestricted advertising is not permitted under the standard safe harbor; a solicited offering has additional, stricter conditions attached." },
      { text: "Automatically become subject to state 'merit review,' even in states that do not otherwise conduct merit review", explanation: "Wrong - general solicitation affects the federal exemption analysis, not whether a particular state chooses to conduct merit review." },
      { text: "Convert the offering into a mandatory public offering requiring SEC registration within a fixed number of days", explanation: "Wrong - losing the private placement exemption doesn't create an automatic conversion timeline; it simply means the offering isn't validly exempted the way the issuer intended, which the issuer must address going forward." },
    ],
  },
  {
    id: "s65-lw-x115",
    section: "laws",
    q: "Under the Securities Exchange Act of 1934, a broker-dealer that effects securities transactions using the U.S. mails or any means or instrumentality of interstate commerce is generally required to:",
    a: "Register with the SEC before conducting a securities business, subject to available exemptions",
    explanation: "Section 15 of the Exchange Act generally requires broker-dealers using jurisdictional means (mail, telephone, wires, or other interstate commerce instrumentalities) to register with the SEC. This registration requirement for broker-dealers is distinct from -- and parallel to -- the investment adviser registration scheme under the Advisers Act.",
    options: [
      { text: "Register with the SEC before conducting a securities business, subject to available exemptions", explanation: "Correct - the Exchange Act's broker-dealer registration requirement is triggered by using jurisdictional means to effect securities transactions." },
      { text: "File only a state-level registration, since broker-dealer registration is exclusively a state function", explanation: "Wrong - broker-dealer registration is a federal (SEC) requirement under the Exchange Act, in addition to any applicable state registration." },
      { text: "Register only if it also acts as an investment adviser to at least one client", explanation: "Wrong - broker-dealer registration is required based on effecting securities transactions, not on also acting as an investment adviser." },
      { text: "Obtain FINRA membership only, with no independent SEC registration obligation", explanation: "Wrong - SEC registration under the Exchange Act is a distinct requirement; FINRA membership is generally an additional requirement layered on top of it, not a substitute for it." },
    ],
  },
  {
    id: "s65-lw-x116",
    section: "laws",
    q: "Under the Advisers Act's code of ethics requirement (Rule 204A-1), an adviser's 'access persons' are generally required to:",
    a: "Periodically report their personal securities holdings and transactions to the adviser's chief compliance officer, or to another person designated in the code of ethics, for review",
    explanation: "Access persons -- supervised persons with access to nonpublic information about client trading or about a reportable fund's holdings, or who are involved in making securities recommendations -- must periodically submit personal securities holdings and transaction reports to the chief compliance officer or another person designated in the code of ethics, so that personal trading can be monitored for conflicts, front-running, or other misuse of that access.",
    options: [
      { text: "Periodically report their personal securities holdings and transactions to the adviser's chief compliance officer, or to another person designated in the code of ethics, for review", explanation: "Correct - the code of ethics rule requires periodic personal holdings and transaction reporting by access persons, enabling compliance oversight for conflicts such as front-running." },
      { text: "Be barred entirely from ever owning any individual securities while employed by the adviser", explanation: "Wrong - the rule requires reporting and monitoring of personal trading, not a blanket prohibition on access persons owning securities." },
      { text: "File a personal Form ADV with the SEC each year, separate from the firm's filing", explanation: "Wrong - Form ADV is a firm-level (and IAR-level, via other means) registration filing; there is no separate personal Form ADV filing required of access persons under the code of ethics rule." },
      { text: "Obtain a state securities license identical to that required of investment adviser representatives", explanation: "Wrong - access person status and personal trading reporting are distinct from the licensing requirements applicable to IARs." },
    ],
  },
  {
    id: "s65-lw-x117",
    section: "laws",
    q: "A privately offered fund limits its investors to a small number of beneficial owners and does not make (or propose to make) a public offering of its securities. Relying on this structure, the fund is generally able to avoid classification as an 'investment company' under the Investment Company Act of 1940 through:",
    a: "An exclusion tied to the limited number and non-public nature of its investor base, rather than any exemption available to the fund's adviser",
    explanation: "Certain private funds exclude themselves from Investment Company Act coverage entirely by limiting their beneficial owners to a small number of persons (with no public offering), or alternatively by limiting ownership to qualified purchasers. This is a fund-level exclusion from the definition of 'investment company' itself, distinct from adviser-level exemptions like the private fund adviser exemption from Advisers Act registration.",
    options: [
      { text: "An exclusion tied to the limited number and non-public nature of its investor base, rather than any exemption available to the fund's adviser", explanation: "Correct - this describes a fund-level exclusion from investment company status based on investor count and the absence of a public offering, separate from any adviser-registration exemption." },
      { text: "Automatic exemption because its adviser is exempt from Advisers Act registration", explanation: "Wrong - the fund's own exclusion from Investment Company Act coverage and the adviser's exemption from Advisers Act registration are separate legal analyses, even though private funds commonly rely on both." },
      { text: "Registration as a closed-end fund with reduced ongoing reporting obligations", explanation: "Wrong - relying on this exclusion means the fund does NOT register as an investment company at all, rather than registering as a closed-end fund with lighter obligations." },
      { text: "A blanket exemption available to any fund organized outside the United States", explanation: "Wrong - the exclusion turns on the size and nature of the fund's U.S. investor base, not simply on where the fund is organized." },
    ],
  },
  {
    id: "s65-lw-x118",
    section: "laws",
    q: "During the 'waiting period' after a registration statement is filed with the SEC under the Securities Act of 1933 but before it becomes effective, an issuer and its underwriters generally:",
    a: "May not sell the security, though limited offers may be made and a preliminary ('red herring') prospectus may generally be circulated",
    explanation: "The waiting period sits between filing and effectiveness. Sales are prohibited until the registration statement is effective, but offers (not sales) can be made, often accompanied by a preliminary prospectus that omits the final price and includes a legend noting the registration statement has not yet become effective -- commonly called a 'red herring.'",
    options: [
      { text: "May not sell the security, though limited offers may be made and a preliminary ('red herring') prospectus may generally be circulated", explanation: "Correct - sales are prohibited during the waiting period, but offers and a preliminary prospectus are permitted, subject to the Act's conditions." },
      { text: "May freely sell the security to any investor so long as a final prospectus is delivered within a reasonable time afterward", explanation: "Wrong - sales, not just prospectus delivery, are restricted during the waiting period; effectiveness must occur before a sale can be completed." },
      { text: "Must cease all communications about the offering entirely until the registration statement is effective", explanation: "Wrong - this overstates the restriction; limited offers and a preliminary prospectus are permitted, it is sales (and unconditional promises to sell) that are barred." },
      { text: "May sell the security only to institutional accredited investors during this period", explanation: "Wrong - the waiting period restriction on sales applies broadly, not merely to non-institutional investors; there is no institutional carve-out from the sales prohibition during this period." },
    ],
  },
  {
    id: "s65-lw-x119",
    section: "laws",
    q: "NASAA's model rule permitting a waiver of the state investment adviser representative competency examination requirement for holders of certain recognized professional designations (such as CFP, CFA, or ChFC) reflects the principle that:",
    a: "The exam requirement is meant to demonstrate baseline competency, which certain rigorous, recognized designations are deemed to already establish",
    explanation: "States commonly waive the Series 65 (or equivalent) exam requirement for IARs holding certain professional designations, on the theory that earning and maintaining those designations already demonstrates the relevant competency the exam is designed to test -- not that fiduciary duty or other regulatory obligations are reduced for designation holders.",
    options: [
      { text: "The exam requirement is meant to demonstrate baseline competency, which certain rigorous, recognized designations are deemed to already establish", explanation: "Correct - the waiver reflects that the underlying purpose (demonstrating competency) is already satisfied by the rigor of certain designations, not that competency requirements are being abandoned." },
      { text: "Holders of such designations are exempt from all state registration requirements entirely", explanation: "Wrong - the waiver applies specifically to the competency examination requirement; registration itself is still generally required." },
      { text: "Such designations legally substitute for the fiduciary duty owed to clients", explanation: "Wrong - fiduciary duty is owed regardless of professional designation; the waiver concerns the exam requirement, not the standard of care." },
      { text: "States are required by federal law to accept any professional designation in lieu of the exam", explanation: "Wrong - this is a state-level NASAA model rule concept adopted at state Administrators' discretion, not a federal mandate." },
    ],
  },
  {
    id: "s65-lw-x120",
    section: "laws",
    q: "A state-registered adviser renews its registration through the IARD system at the end of each calendar year. This renewal process illustrates that state investment adviser registration is generally:",
    a: "Not perpetual, and requires an affirmative renewal filing and fee payment to remain effective for the following year",
    explanation: "State (and federal) investment adviser registration is not a one-time, permanent grant. It must be renewed, typically annually through the IARD system with an associated renewal fee, or the registration lapses. This is distinct from the separate annual updating amendment to Form ADV, which reports current firm information rather than simply paying to keep the registration alive.",
    options: [
      { text: "Not perpetual, and requires an affirmative renewal filing and fee payment to remain effective for the following year", explanation: "Correct - registration must be affirmatively renewed (with a fee) on a recurring basis; it does not remain effective indefinitely without action." },
      { text: "Permanent once granted, requiring no further action unless the adviser changes its business model", explanation: "Wrong - registration is not permanent; it lapses without timely renewal regardless of whether the adviser's business model has changed." },
      { text: "Automatically renewed by IARD without any fee or filing, unless the adviser affirmatively withdraws", explanation: "Wrong - renewal is not automatic or free; it requires an affirmative filing and fee payment." },
      { text: "Tied to the adviser's fiscal year end rather than the calendar year", explanation: "Wrong - the renewal cycle runs on the calendar year, independent of whatever fiscal year end the adviser itself uses for accounting purposes." },
    ],
  },
];
