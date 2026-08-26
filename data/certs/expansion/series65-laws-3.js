// Series 65 - Laws expansion batch 3 of 4.
// Slice: mechanics of the three foundational federal statutes that the base
// bank and prior "laws" expansion only name-check at a definitional level —
// Securities Act of 1933 (registration/prospectus/exemption mechanics, the
// intrastate exemption, and Section 11/12 liability), Securities Exchange Act
// of 1934 (reporting, insiders, tender offers, SRO oversight), and Investment
// Company Act of 1940 (statutory categories, board composition,
// diversification, advisory contract terms, redemption, name-test rules).
// Deliberately avoids ground held by series65-laws-4.js (red herring vs. final
// prospectus, the underwriter due diligence defense, Rule 144, fundamental
// policy changes, annual advisory contract continuation) and by
// series65-vehicles-2.js (open-end vs. closed-end senior securities).
// No dated or inflation-adjusted figures are used: every threshold here is
// fixed by statute (Securities Act s3(a)(11)/11/12, ICA s5(b)(1)/10(a)/15/22(e))
// or by a rule whose number is stable (Rule 35d-1's 80% test).
// Ids reserved: s65-lw-x301 through s65-lw-x319.

export const S65_LAWS_X3 = [
  {
    id: "s65-lw-x301",
    section: "laws",
    q: "Under the Securities Act of 1933, the period between the filing of a registration statement and its effectiveness (absent acceleration) is generally known as the:",
    a: "Cooling-off period",
    explanation: "The Securities Act imposes a waiting period after filing — typically 20 days absent SEC acceleration — during which the registration statement is reviewed and a preliminary prospectus may be used, but no sales may be completed.",
    options: [
      { text: "Cooling-off period", explanation: "Correct — this is the standard term for the waiting period between filing and effectiveness of a registration statement." },
      { text: "Blackout period", explanation: "A blackout period is a different concept, typically restricting insider trading around events like retirement-plan blackouts, not the 1933 Act registration timeline." },
      { text: "Grace period", explanation: "A grace period generally refers to extra time to cure a default or make a payment, not the statutory review window before a registration statement goes effective." },
      { text: "Free-look period", explanation: "A free-look period is an insurance concept letting a purchaser cancel a policy, unrelated to Securities Act registration." },
    ],
  },
  {
    id: "s65-lw-x302",
    section: "laws",
    q: "An issuer relies on the intrastate offering exemption under Section 3(a)(11) of the Securities Act of 1933, using the Rule 147 safe harbor. Which of the following best describes the issuer's resulting position?",
    a: "Sales must be limited to residents of the issuer's state, and the issuer must still comply with that state's own securities registration requirements",
    explanation: "Section 3(a)(11) exempts a genuinely local offering from FEDERAL registration only. The issuer must be organized in, and doing a significant amount of business in, the state, and sales must go only to residents of that state — but the exemption does nothing to displace state (blue-sky) registration, which continues to apply.",
    options: [
      { text: "Sales must be limited to residents of the issuer's state, and the issuer must still comply with that state's own securities registration requirements", explanation: "Correct — the intrastate exemption relieves the issuer of federal registration only; state law still governs the offering, and purchasers must be in-state residents." },
      { text: "The offering is exempt from both federal and state registration requirements", explanation: "This is the classic trap — an exemption under the federal Securities Act says nothing about state law. Rule 147 issuers must still satisfy the securities laws of the state in which they offer and sell." },
      { text: "The issuer may sell to residents of any state, so long as it is organized in one of them", explanation: "Selling to even one out-of-state resident can destroy the exemption. Being organized in a state is necessary but nowhere near sufficient." },
      { text: "The issuer must file a registration statement with the SEC before any sales, just as in a public offering", explanation: "The entire point of the exemption is that no Securities Act registration statement is required; Rule 147 issuers file nothing with, and pay no fees to, the SEC." },
    ],
  },
  {
    id: "s65-lw-x303",
    section: "laws",
    q: "A key structural difference between Rule 506(b) and Rule 506(c) private placement offerings under Regulation D is that Rule 506(c):",
    a: "Permits general solicitation and advertising but requires the issuer to take reasonable steps to verify that all purchasers are accredited investors",
    explanation: "Rule 506(c) trades the ability to publicly advertise a private offering for a stricter, affirmative verification duty and the exclusion of non-accredited investors, unlike 506(b), which allows self-certification but bars general solicitation.",
    options: [
      { text: "Permits general solicitation and advertising but requires the issuer to take reasonable steps to verify that all purchasers are accredited investors", explanation: "Correct — 506(c) allows advertising in exchange for mandatory, documented verification of accredited status, and accredited investors only." },
      { text: "Allows up to 35 non-accredited investors, unlike Rule 506(b)", explanation: "This describes 506(b), which allows a limited number of sophisticated non-accredited investors; 506(c) allows accredited investors only." },
      { text: "Prohibits any form of advertising, unlike Rule 506(b)", explanation: "This reverses the actual distinction — it's 506(b) that bars general solicitation, while 506(c) permits it." },
      { text: "Eliminates the need for the issuer to file a Form D notice", explanation: "Both 506(b) and 506(c) offerings generally require the issuer to file a Form D notice with the SEC." },
    ],
  },
  {
    id: "s65-lw-x304",
    section: "laws",
    q: "A 'free writing prospectus' under the Securities Act of 1933 is best described as:",
    a: "A written communication that offers or promotes securities in a registered offering, used outside the formal statutory prospectus",
    explanation: "A free writing prospectus lets an issuer or underwriter communicate about a registered offering (subject to filing and prospectus-delivery conditions) without every word needing to fit inside the formal Section 10 prospectus format.",
    options: [
      { text: "A written communication that offers or promotes securities in a registered offering, used outside the formal statutory prospectus", explanation: "Correct — this is the core function of a free writing prospectus in a registered offering." },
      { text: "A prospectus used exclusively in exempt private placements", explanation: "The concept applies to registered offerings under the Securities Act, not to exempt private placements." },
      { text: "The final prospectus delivered at the closing of a securities sale", explanation: "The final statutory prospectus is a distinct, formally required document; a free writing prospectus is a supplemental communication." },
      { text: "A prospectus that never has to be filed with the SEC under any circumstances", explanation: "Free writing prospectuses are generally subject to SEC filing requirements, depending on the issuer's status and the communication's content." },
    ],
  },
  {
    id: "s65-lw-x305",
    section: "laws",
    q: "Compared with a fully registered public offering, a Regulation A offering is generally structured to:",
    a: "Provide a scaled-down 'mini-registration' path with lighter ongoing disclosure obligations, subject to SEC qualification of an offering statement",
    explanation: "Regulation A is a distinct exemption tier from full Securities Act registration, offering smaller issuers reduced disclosure burdens while still requiring SEC review and qualification before sales can be made.",
    options: [
      { text: "Provide a scaled-down 'mini-registration' path with lighter ongoing disclosure obligations, subject to SEC qualification of an offering statement", explanation: "Correct — Regulation A is often called a 'mini-IPO' exemption precisely because it scales back, rather than eliminates, registration-style requirements." },
      { text: "Require no SEC review or qualification whatsoever before any sales are made", explanation: "Regulation A offerings must still be qualified by the SEC before sales can proceed — it isn't a self-executing exemption." },
      { text: "Apply only to offerings by registered investment companies", explanation: "Regulation A is a general small-issuer exemption path and isn't limited to registered investment companies, which have their own separate regulatory framework." },
      { text: "Restrict sales exclusively to accredited investors", explanation: "Unlike Rule 506(c), Regulation A generally permits sales to non-accredited investors, subject to its own investment limits." },
    ],
  },
  {
    id: "s65-lw-x306",
    section: "laws",
    q: "Under Section 11 of the Securities Act of 1933, if a registration statement contains a material misstatement or omission, the issuer's liability to purchasers is best described as:",
    a: "Essentially strict, without an available due diligence defense",
    explanation: "Section 11 treats the issuer differently from other defendants like underwriters and directors: the issuer cannot escape liability by showing it exercised due diligence, reflecting its primary responsibility for the registration statement's accuracy.",
    options: [
      { text: "Essentially strict, without an available due diligence defense", explanation: "Correct — the issuer's Section 11 liability doesn't turn on whether it exercised reasonable care." },
      { text: "Conditioned entirely on proof of the issuer's fraudulent intent", explanation: "Section 11 doesn't require proving scienter or fraud for the issuer; that heightened standard is more associated with Section 10(b)/Rule 10b-5 claims." },
      { text: "Identical to the due diligence defense available to underwriters and directors", explanation: "The due diligence defense is available to underwriters, directors, and certain experts, but not to the issuer itself." },
      { text: "Limited to cases where the purchaser bought directly from the issuer in a private resale", explanation: "Section 11 liability runs to purchasers of securities issued under the registration statement generally, not just direct issuer sales in a private resale context." },
    ],
  },
  {
    id: "s65-lw-x307",
    section: "laws",
    q: "Under Section 12(a)(1) of the Securities Act of 1933, a person who offers or sells a security in violation of the Act's registration requirements is generally liable to the purchaser for:",
    a: "Rescission — the purchaser may recover the consideration paid, plus interest, less any income received, upon tender of the security",
    explanation: "Section 12(a)(1) gives the buyer of an improperly unregistered security a rescission remedy: tender the security back and recover what was paid, with interest, reduced by any income already received (or sue for damages if the security has since been sold). Liability attaches to the Section 5 violation itself.",
    options: [
      { text: "Rescission — the purchaser may recover the consideration paid, plus interest, less any income received, upon tender of the security", explanation: "Correct — this is the statutory remedy under Section 12(a)(1), with damages available instead if the purchaser no longer owns the security." },
      { text: "Nothing, provided the seller reasonably believed that an exemption from registration applied", explanation: "Section 12(a)(1) liability is essentially strict — a good-faith but mistaken belief that an exemption applied is not a defense. (A reasonable-care defense exists under Section 12(a)(2), a different provision.)" },
      { text: "Treble damages, but only if the purchaser proves the seller acted with fraudulent intent", explanation: "Section 12(a)(1) requires no proof of scienter or fraud, and it provides a rescission/damages remedy rather than treble damages." },
      { text: "Only the amount of any commission or markup the seller earned on the transaction", explanation: "The remedy restores the purchaser's entire consideration with interest, not merely the seller's compensation on the trade." },
    ],
  },
  {
    id: "s65-lw-x308",
    section: "laws",
    q: "The core distinction between the Securities Act of 1933 and the Securities Exchange Act of 1934 is best described as:",
    a: "The 1933 Act governs the initial offer and sale of securities, while the 1934 Act governs subsequent secondary market trading and ongoing issuer reporting",
    explanation: "The 1933 Act is the 'truth in issuance' statute focused on registration and disclosure at the time of a new offering, while the 1934 Act is the 'truth in trading' statute regulating exchanges, broker-dealers, and periodic reporting once securities are already outstanding.",
    options: [
      { text: "The 1933 Act governs the initial offer and sale of securities, while the 1934 Act governs subsequent secondary market trading and ongoing issuer reporting", explanation: "Correct — this primary-market-versus-secondary-market split is the fundamental distinction between the two statutes." },
      { text: "The 1933 Act applies only to broker-dealers, while the 1934 Act applies only to investment advisers", explanation: "Broker-dealer and investment adviser regulation are addressed elsewhere (the 1934 Act and the Investment Advisers Act, respectively) — this mischaracterizes both statutes' scope." },
      { text: "The 1934 Act created the exemption from registration for private placements, while the 1933 Act created the reporting requirements for public companies", explanation: "This reverses the statutes: private placement exemptions arise under the 1933 Act, and periodic reporting requirements arise under the 1934 Act." },
      { text: "The two acts cover identical subject matter and exist purely for historical redundancy", explanation: "The two acts serve distinct regulatory purposes — primary issuance versus secondary trading and reporting — and are not redundant." },
    ],
  },
  {
    id: "s65-lw-x309",
    section: "laws",
    q: "Under Section 16 of the Securities Exchange Act of 1934, officers, directors, and beneficial owners of more than 10% of a registered class of equity securities are generally required to:",
    a: "Report their transactions in the issuer's equity securities and disgorge any 'short-swing' profits realized on purchases and sales within a defined short period",
    explanation: "Section 16 targets the risk that corporate insiders trade on nonpublic information by requiring ownership reporting and forcing disgorgement of any profit from matched purchase-and-sale (or sale-and-purchase) transactions occurring within the statutorily defined short-swing window, regardless of actual intent.",
    options: [
      { text: "Report their transactions in the issuer's equity securities and disgorge any 'short-swing' profits realized on purchases and sales within a defined short period", explanation: "Correct — Section 16(b)'s short-swing profit rule requires disgorgement without needing to prove the insider actually misused inside information." },
      { text: "Be barred permanently from ever trading the issuer's securities", explanation: "Section 16 doesn't impose a permanent trading ban — it imposes reporting duties and disgorgement of short-swing profits." },
      { text: "File a registration statement each time they trade the issuer's stock", explanation: "Insider transactions are addressed through ownership reports (such as Forms 3, 4, and 5), not through Securities Act registration statements." },
      { text: "Obtain prior SEC approval before executing any trade", explanation: "Section 16 requires reporting after the fact and disgorgement of short-swing profits, not advance SEC approval of each trade." },
    ],
  },
  {
    id: "s65-lw-x310",
    section: "laws",
    q: "An investor who acquires beneficial ownership of more than 5% of a registered class of an issuer's equity securities, with an intent to influence or change control of the issuer, is generally required to:",
    a: "File a Schedule 13D disclosing the purpose of the acquisition, the source of funds, and any plans regarding the issuer",
    explanation: "Schedule 13D is the disclosure vehicle for investors crossing the 5% threshold with an activist or control-oriented purpose; passive investors who qualify for an exemption may instead use the abbreviated Schedule 13G.",
    options: [
      { text: "File a Schedule 13D disclosing the purpose of the acquisition, the source of funds, and any plans regarding the issuer", explanation: "Correct — Schedule 13D is specifically required for non-passive, control-oriented crossings of the 5% ownership threshold." },
      { text: "File a Form ADV with the SEC", explanation: "Form ADV is the investment adviser registration form, unrelated to beneficial ownership reporting under the 1934 Act." },
      { text: "Register as a broker-dealer before completing the acquisition", explanation: "Acquiring a large equity stake for control purposes doesn't itself require broker-dealer registration; that turns on whether the person is engaged in the business of effecting securities transactions for others." },
      { text: "File only Schedule 13G, regardless of intent", explanation: "Schedule 13G is reserved for passive or exempt investors; an investor with control intent must instead file the more detailed Schedule 13D." },
    ],
  },
  {
    id: "s65-lw-x311",
    section: "laws",
    q: "The Williams Act amendments to the Securities Exchange Act of 1934, which govern tender offers, generally require that an offer:",
    a: "Remain open for a minimum period, disclose the offeror's identity, funding, and plans, and afford shareholders withdrawal rights during that period",
    explanation: "The Williams Act was enacted to protect target-company shareholders from being rushed or coerced during a takeover attempt, so it mandates minimum offer periods, disclosure filings, and the ability to withdraw tendered shares while the offer remains open.",
    options: [
      { text: "Remain open for a minimum period, disclose the offeror's identity, funding, and plans, and afford shareholders withdrawal rights during that period", explanation: "Correct — these protections are the core substance of the Williams Act's tender offer rules." },
      { text: "Be completed within 24 hours of its announcement to prevent market manipulation", explanation: "The Williams Act requires a minimum offer period to give shareholders time to consider the offer, not a 24-hour rush to completion." },
      { text: "Exempt the offeror from any disclosure obligations to target shareholders", explanation: "Disclosure of the offeror's identity, financing, and plans is a central Williams Act requirement, not something exempted." },
      { text: "Prohibit shareholders from withdrawing tendered shares once submitted", explanation: "Withdrawal rights during the offer period are a specific investor protection built into the Williams Act framework." },
    ],
  },
  {
    id: "s65-lw-x312",
    section: "laws",
    q: "Under the Securities Exchange Act of 1934, national securities exchanges and national securities associations such as FINRA are best described as:",
    a: "Self-regulatory organizations that must register with, and remain subject to oversight by, the SEC",
    explanation: "The 1934 Act built a hybrid regulatory structure in which SROs like exchanges and FINRA write and enforce rules for their members, but the SEC retains ultimate oversight authority, including approval of SRO rule changes.",
    options: [
      { text: "Self-regulatory organizations that must register with, and remain subject to oversight by, the SEC", explanation: "Correct — SROs operate under a delegated authority model, registering with and answering to the SEC." },
      { text: "Independent bodies entirely outside SEC jurisdiction", explanation: "SROs are not outside SEC jurisdiction — the SEC approves their rules and can direct changes to their operations." },
      { text: "Federal government agencies staffed by SEC employees", explanation: "SROs like exchanges and FINRA are private/quasi-private membership organizations, not federal agencies staffed by the SEC." },
      { text: "Entities that only regulate investment advisers, not broker-dealers", explanation: "SROs under the 1934 Act framework, such as FINRA, primarily regulate broker-dealers and exchange members, not investment advisers." },
    ],
  },
  {
    id: "s65-lw-x313",
    section: "laws",
    q: "A company with securities registered under the Securities Exchange Act of 1934 is generally required to file which of the following with the SEC on a recurring basis?",
    a: "Annual reports (Form 10-K), quarterly reports (Form 10-Q), and current reports of material events (Form 8-K)",
    explanation: "These periodic and current reports are the backbone of the 1934 Act's ongoing disclosure regime, keeping the secondary market informed about a reporting company's financial condition and material developments.",
    options: [
      { text: "Annual reports (Form 10-K), quarterly reports (Form 10-Q), and current reports of material events (Form 8-K)", explanation: "Correct — these three forms make up the core periodic and current reporting obligations of a 1934 Act reporting company." },
      { text: "A new registration statement under the Securities Act each time its stock price changes", explanation: "Ordinary secondary market price movements don't trigger new Securities Act registration statements; those relate to new offerings of securities." },
      { text: "Form ADV, updated annually", explanation: "Form ADV is filed by investment advisers under the Investment Advisers Act, not by reporting companies under the 1934 Act." },
      { text: "Nothing, once its initial registration statement is declared effective", explanation: "Reporting obligations continue on an ongoing basis after registration; they aren't satisfied by the initial effectiveness alone." },
    ],
  },
  {
    id: "s65-lw-x314",
    section: "laws",
    q: "Under the Investment Company Act of 1940, the statutory categories of investment company include the management company (open-end and closed-end), the unit investment trust, and the:",
    a: "Face-amount certificate company",
    explanation: "The 1940 Act recognizes three basic structural types of investment company: management companies (further split into open-end funds and closed-end funds), unit investment trusts, and face-amount certificate companies, which issue certificates obligating the issuer to pay a stated sum at maturity.",
    options: [
      { text: "Face-amount certificate company", explanation: "Correct — this is the third statutory category alongside management companies and unit investment trusts." },
      { text: "Real estate investment trust", explanation: "A REIT is generally not registered as an investment company under the 1940 Act; it's a separate structure typically taxed under different rules." },
      { text: "Broker-dealer holding company", explanation: "This isn't one of the 1940 Act's statutory investment company categories." },
      { text: "Federal covered adviser", explanation: "A federal covered adviser is a status under the Investment Advisers Act and NSMIA, not a category of investment company under the 1940 Act." },
    ],
  },
  {
    id: "s65-lw-x315",
    section: "laws",
    q: "A registered investment company that qualifies as 'diversified' under the Investment Company Act of 1940 must generally satisfy which asset test as to at least 75% of its total assets?",
    a: "No more than 5% invested in any single issuer, and no more than 10% ownership of that issuer's outstanding voting securities",
    explanation: "This is the classic '75-5-10' diversification test: within the 75% portion of assets subject to the test, the fund must spread holdings so no single issuer represents too concentrated a position or too large a voting stake, though the remaining 25% is not subject to these limits.",
    options: [
      { text: "No more than 5% invested in any single issuer, and no more than 10% ownership of that issuer's outstanding voting securities", explanation: "Correct — this is the substance of the diversification test applied to 75% of a diversified fund's total assets." },
      { text: "At least 75% invested in a single issuer to ensure concentrated exposure", explanation: "This describes concentration, which is the opposite goal of the diversification test." },
      { text: "No investments in equity securities of any kind", explanation: "The diversification test governs concentration limits, not a blanket prohibition on equity holdings." },
      { text: "All assets held exclusively in U.S. government securities", explanation: "The diversification test doesn't require exclusive government-securities holdings; it limits concentration across issuers generally." },
    ],
  },
  {
    id: "s65-lw-x316",
    section: "laws",
    q: "Under Section 10 of the Investment Company Act of 1940, a fund's board of directors is generally required to be structured so that:",
    a: "No more than 60% of the board consists of 'interested persons,' meaning at least 40% must be independent directors",
    explanation: "This board-composition requirement is designed to give a meaningful bloc of directors without ties to the fund's adviser or underwriter, so they can independently oversee matters like advisory contracts and potential conflicts of interest.",
    options: [
      { text: "No more than 60% of the board consists of 'interested persons,' meaning at least 40% must be independent directors", explanation: "Correct — Section 10 caps the proportion of interested persons on the board, requiring a meaningful independent presence." },
      { text: "All directors must be employees of the fund's investment adviser", explanation: "This is essentially the opposite of the requirement, which limits (rather than mandates) adviser-affiliated directors." },
      { text: "The board must consist entirely of independent directors with no interested persons at all", explanation: "The statute permits interested persons on the board, just capped at no more than 60%, rather than requiring a zero-interested-person board." },
      { text: "The board's composition is left entirely to state corporate law with no federal requirement", explanation: "Section 10 of the 1940 Act imposes a specific federal requirement on board composition, not something left purely to state law." },
    ],
  },
  {
    id: "s65-lw-x317",
    section: "laws",
    q: "Under Section 15 of the Investment Company Act of 1940, a registered fund's investment advisory contract must, among other things:",
    a: "Be in writing, provide for automatic termination in the event of its assignment, and be terminable by the fund on not more than 60 days' notice without penalty",
    explanation: "Section 15(a) requires the advisory contract to be written, to precisely describe all compensation, to allow the fund to walk away on at most 60 days' notice without penalty, and to terminate automatically if assigned — so that shareholders are never handed a new adviser they did not approve.",
    options: [
      { text: "Be in writing, provide for automatic termination in the event of its assignment, and be terminable by the fund on not more than 60 days' notice without penalty", explanation: "Correct — these are express requirements of Section 15(a) of the Investment Company Act." },
      { text: "Automatically transfer to any successor adviser upon assignment, without the need for a new approval", explanation: "This is the reverse of the statute: assignment causes the contract to terminate automatically, precisely so a successor adviser cannot inherit the relationship unapproved." },
      { text: "Continue in effect indefinitely once signed, with no requirement of periodic reapproval", explanation: "Continuance beyond an initial period must be approved at least annually — by the board (including a majority of the non-interested directors) or by shareholder vote — not left to run indefinitely." },
      { text: "Be approved solely by the fund's investment adviser, without board or shareholder involvement", explanation: "This inverts the Act's governance scheme: the contract requires shareholder approval and the approval of a majority of directors who are not parties to it or interested persons." },
    ],
  },
  {
    id: "s65-lw-x318",
    section: "laws",
    q: "Under the SEC's 'Names Rule' (Rule 35d-1) for registered investment companies, a fund whose name suggests a focus on a particular type of investment, industry, or geographic region must generally:",
    a: "Adopt a policy to invest at least 80% of its assets in the type of investment, industry, or region suggested by its name",
    explanation: "The Names Rule exists so that a fund's name isn't misleading — if the name implies a specific investment focus, the fund must actually commit a supermajority of its assets to that focus under normal circumstances.",
    options: [
      { text: "Adopt a policy to invest at least 80% of its assets in the type of investment, industry, or region suggested by its name", explanation: "Correct — this 80% asset test is the core requirement of the Names Rule." },
      { text: "Change its name every year regardless of its holdings", explanation: "The rule doesn't require periodic renaming; it requires the fund's holdings to actually match a name it keeps using." },
      { text: "Invest no more than 20% of its assets in the type of investment suggested by its name", explanation: "This inverts the actual requirement, which sets an 80% minimum commitment, not a 20% cap." },
      { text: "Obtain shareholder approval before ever changing its investment adviser", explanation: "Adviser-change approval is a separate matter under the 1940 Act's advisory contract provisions, not the subject of the Names Rule." },
    ],
  },
  {
    id: "s65-lw-x319",
    section: "laws",
    q: "Under Section 22(e) of the Investment Company Act of 1940, when an investor tenders redeemable fund shares for redemption, the fund generally may not postpone payment for more than:",
    a: "Seven days after the tender, absent a specifically enumerated exception such as an NYSE closure or an SEC order",
    explanation: "Section 22(e) is what makes an open-end fund's redeemability real rather than nominal: payment may not be postponed beyond seven days after tender. The right may be suspended only in narrow circumstances the statute lists — the NYSE being closed other than for weekends and holidays, trading on the NYSE being restricted, an emergency in which the fund cannot reasonably dispose of holdings or fairly value its assets, or a period the SEC permits by order for the protection of shareholders.",
    options: [
      { text: "Seven days after the tender, absent a specifically enumerated exception such as an NYSE closure or an SEC order", explanation: "Correct — the seven-day limit, and the narrow list of exceptions, come straight from Section 22(e)." },
      { text: "Thirty days after the tender, at the adviser's discretion", explanation: "Neither the period nor the premise is right: the statutory limit is seven days, and postponement is not a matter of adviser discretion." },
      { text: "As long as necessary, provided the delay is disclosed in the prospectus", explanation: "Prospectus disclosure cannot buy a fund out of Section 22(e) — the seven-day limit is statutory, and suspension requires one of the enumerated conditions." },
      { text: "One business day, matching the standard T+1 settlement cycle for securities trades", explanation: "Fund redemption timing under Section 22(e) is set by the Act, not by the settlement cycle for secondary market trades; the outer limit is seven days." },
    ],
  },
];
