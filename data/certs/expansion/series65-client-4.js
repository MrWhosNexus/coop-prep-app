// Series 65 (Uniform Investment Adviser Law Examination) — practice question bank
// Expansion batch 4 of 4 for section "client" (Client Investment Recommendations and Strategies).
//
// This batch deliberately favors the back third of the topic scope on ground the base bank
// and the three prior "client" expansion files do NOT already test. Coverage was checked
// item-by-item against data/certs/series65-bank.js, series65-bank-client.js, and
// expansion/series65-client-{1,2,3}.js before writing: bond ladders/barbells/bullets,
// covered calls, protective puts, collars, NUA, ABLE accounts, TOD registration, durable
// and springing powers of attorney, spendthrift clauses, credit-shelter/bypass trusts, QTIP,
// IDGT, GSTT, portability, and ERISA 404(c) are all ALREADY COVERED there and are therefore
// deliberately absent here.
//
// What this file adds instead: split-interest and charitable vehicles (CRT, donor-advised
// fund), fiduciary investment standards not yet tested (UPIA's portfolio-as-a-whole rule,
// ERISA's prudent expert rule), trust income taxation (DNI, simple vs. complex), gift-tax
// mechanics (Crummey withdrawal powers), estate-transfer vehicles absent from the bank
// (GRAT, ILIT, QPRT, SLAT, special needs trust), ownership forms (tenancy by the entirety),
// estate vs. inheritance tax, nonqualified deferred comp funding (rabbi trust), retirement
// income sequencing (bucket strategy), and taxation items (HSA, 1031, wash sale into an IRA).
//
// No dated dollar figures, ages, or contribution limits are used — every item tests the
// underlying mechanism instead, so nothing here expires with a tax-year table.
//
// Same quiz-item shape as data/certs/series65-bank.js:
//   {id, section, q, a, explanation, options:[{text, explanation}]}
// Merged into SERIES65_BANK by a separate merge step — this file is NOT imported directly
// by the app yet.

export const S65_CLIENT_X4 = [
  // ---------------------------------------------------------------------
  // TAXATION CONCEPTS — HSA, 1031, WASH SALE INTO AN IRA
  // ---------------------------------------------------------------------
  {
    id: "s65-cl-x401",
    section: "client",
    q: "A Health Savings Account (HSA) is often described as offering a 'triple tax advantage' because:",
    a: "Contributions may be tax-deductible (or pre-tax), earnings inside the account are tax-free, and qualified withdrawals for medical expenses are tax-free",
    explanation: "No other widely available account combines all three benefits at once: a deduction (or pre-tax payroll contribution) going in, tax-free earnings inside the account, and tax-free withdrawals coming out, as long as the funds are used for qualified medical expenses. IRS Publication 969 states each leg plainly: contributions are deductible, 'the interest or other earnings on the assets in the account are tax free,' and 'distributions may be tax free if you pay qualified medical expenses.'",
    options: [
      { text: "Contributions may be tax-deductible (or pre-tax), earnings inside the account are tax-free, and qualified withdrawals for medical expenses are tax-free", explanation: "Correct — this three-part benefit is why the HSA is called triple-tax-advantaged." },
      { text: "Contributions, growth, and withdrawals are all taxed once at the account owner's ordinary income rate", explanation: "This describes fully taxable treatment, the opposite of the tax-advantaged structure that makes an HSA distinctive." },
      { text: "The account offers tax-free growth only, with contributions and withdrawals both fully taxable", explanation: "This captures only one of the three advantages and misstates that contributions and qualified withdrawals are also tax-favored." },
      { text: "Only withdrawals used for non-medical purposes receive favorable tax treatment", explanation: "It is qualified medical withdrawals that receive favorable treatment; non-medical withdrawals before a certain age are generally taxable and penalized." },
    ],
  },
  {
    id: "s65-cl-x402",
    section: "client",
    q: "A client wants to sell an investment real estate property and use the proceeds to buy another investment property, while deferring recognition of the capital gain. This describes the purpose of a:",
    a: "Section 1031 like-kind exchange",
    explanation: "A properly structured 1031 exchange of like-kind investment or business real property allows the seller to defer recognizing the capital gain that would otherwise be triggered by an outright sale. Since the 2017 tax law, Section 1031 applies only to real property — not to personal property such as equipment, artwork, or securities.",
    options: [
      { text: "Section 1031 like-kind exchange", explanation: "Correct — this is precisely the deferral mechanism a 1031 exchange provides for qualifying real property." },
      { text: "A wash sale", explanation: "A wash sale disallows a loss deduction when a substantially identical security is repurchased shortly after a sale — it does not defer gain on real estate." },
      { text: "A Roth conversion", explanation: "A Roth conversion involves moving retirement account funds and triggering current taxation, not deferring gain on a real estate sale." },
      { text: "Tax-loss harvesting", explanation: "Tax-loss harvesting realizes losses to offset gains elsewhere; it doesn't describe deferring gain on a like-kind property exchange." },
    ],
  },
  {
    id: "s65-cl-x403",
    section: "client",
    q: "An investor sells stock at a loss in a taxable brokerage account and, within 30 days, causes their own IRA to purchase substantially identical stock. Under IRS guidance, the consequence is that:",
    a: "The loss is disallowed under the wash sale rule, and because the investor's basis in the IRA is not increased by the disallowed loss, the loss is lost permanently rather than merely deferred",
    explanation: "Revenue Ruling 2008-5 addresses exactly this fact pattern: the wash sale rule of Section 1091 disallows the loss, and the individual's basis in the IRA or Roth IRA is NOT increased under Section 1091(d). That combination is what makes this trap so costly — in an ordinary wash sale the disallowed loss is preserved by being added to the basis of the replacement shares, but when the replacement is bought inside an IRA there is no taxable basis to absorb it, so the deduction disappears for good.",
    options: [
      { text: "The loss is disallowed under the wash sale rule, and because the investor's basis in the IRA is not increased by the disallowed loss, the loss is lost permanently rather than merely deferred", explanation: "Correct — this is the holding of Revenue Ruling 2008-5, and the permanent forfeiture is what distinguishes it from an ordinary wash sale." },
      { text: "The loss is disallowed but is added to the basis of the shares held inside the IRA, preserving the benefit for a later sale", explanation: "This is the ordinary wash sale outcome and the most tempting answer, but Revenue Ruling 2008-5 specifically holds that Section 1091(d) does NOT increase the investor's basis in the IRA — so nothing is preserved." },
      { text: "The loss is allowed in full, because an IRA is a separate taxpayer from the individual who owns it", explanation: "The IRS rejected this reasoning; the wash sale rule reaches a purchase the individual causes their own IRA to make." },
      { text: "The wash sale rule never applies across accounts of different types, so only same-account repurchases matter", explanation: "The wash sale rule is not confined to a single account — it can be triggered by a replacement purchase in a different account, including a retirement account." },
    ],
  },
  // ---------------------------------------------------------------------
  // CHARITABLE & SPLIT-INTEREST VEHICLES
  // ---------------------------------------------------------------------
  {
    id: "s65-cl-x404",
    section: "client",
    q: "A client transfers a highly appreciated, low-basis stock position into a charitable remainder trust (CRT) that will pay the client an income stream for a term of years, after which the remainder passes to a qualified charity. A principal attraction of this structure is that:",
    a: "The trust itself is generally tax-exempt, so it can sell the appreciated position without an immediate capital gains tax at the time of sale, leaving more capital working to produce the client's income stream",
    explanation: "Because a CRT is generally exempt from income tax, the appreciated asset can be sold inside the trust without the immediate capital gains hit an outright sale would trigger, so the full pre-tax proceeds stay invested. The gain is not erased — it is carried out to the income beneficiary over time under the CRT's tiered distribution rules — but the deferral leaves a larger asset base generating the payout.",
    options: [
      { text: "The trust itself is generally tax-exempt, so it can sell the appreciated position without an immediate capital gains tax at the time of sale, leaving more capital working to produce the client's income stream", explanation: "Correct — avoiding the immediate capital gains drag on the sale is the classic reason to fund a CRT with a low-basis position." },
      { text: "The client may deduct the full fair market value of the property transferred to the trust", explanation: "The charitable deduction is only partial — it is limited to the present value of the charity's remainder interest, not the full value of the property contributed." },
      { text: "The client may revoke the trust and reclaim the assets if the income stream proves insufficient", explanation: "A CRT is irrevocable; the client cannot unwind it and take the assets back if circumstances change." },
      { text: "The income payments the client receives from the trust are entirely free of federal income tax", explanation: "The payments are taxable to the recipient under the CRT's tiered rules, which carry out the trust's ordinary income and capital gain first — the benefit is deferral, not permanent exemption." },
    ],
  },
  {
    id: "s65-cl-x405",
    section: "client",
    q: "A client contributes appreciated securities to a donor-advised fund (DAF) maintained by a sponsoring public charity. Which statement best describes the client's position once the contribution is complete?",
    a: "The contribution is irrevocable and the sponsoring organization holds exclusive legal control over the assets; the client retains only advisory privileges regarding grants and investments",
    explanation: "A DAF is a separately identified account maintained by a 501(c)(3) sponsoring organization. To deduct the gift, the donor must obtain written acknowledgment that the sponsoring organization has exclusive legal control over the contributed property. The donor keeps advisory privileges over how the money is granted out and invested — but they are advisory, not binding.",
    options: [
      { text: "The contribution is irrevocable and the sponsoring organization holds exclusive legal control over the assets; the client retains only advisory privileges regarding grants and investments", explanation: "Correct — irrevocability plus exclusive legal control in the sponsor, with the donor retaining advisory privileges only, is the defining structure of a DAF." },
      { text: "The client retains legal ownership of the contributed assets and may withdraw them for personal use at any time", explanation: "A completed contribution to a DAF is irrevocable — the donor cannot take the assets back for personal use, which is precisely why a current deduction is available." },
      { text: "The client's grant recommendations are legally binding on the sponsoring organization", explanation: "The donor's role is advisory; the sponsoring organization retains ultimate legal control and is not bound to follow a recommendation." },
      { text: "The client may not claim a charitable deduction until the sponsoring organization actually grants the funds out to an operating charity", explanation: "The deduction is generally available for the year the contribution is made to the fund, not deferred until the sponsor makes grants to end charities." },
    ],
  },
  // ---------------------------------------------------------------------
  // FIDUCIARY INVESTMENT STANDARDS — UPIA AND ERISA
  // ---------------------------------------------------------------------
  {
    id: "s65-cl-x406",
    section: "client",
    q: "Under the Uniform Prudent Investor Act (UPIA), a trustee's individual investment decisions are evaluated:",
    a: "In the context of the trust portfolio as a whole and as part of an overall investment strategy having risk and return objectives reasonably suited to the trust",
    explanation: "UPIA replaced the older approach of judging each holding on its own with a modern portfolio theory framing: no investment is imprudent per se, and a holding that looks risky standing alone may be entirely prudent as one component of a properly diversified strategy. The trustee is judged on the process and the portfolio, not on any single security's outcome.",
    options: [
      { text: "In the context of the trust portfolio as a whole and as part of an overall investment strategy having risk and return objectives reasonably suited to the trust", explanation: "Correct — the portfolio-as-a-whole standard is UPIA's central reform." },
      { text: "Investment by investment in isolation, so that any single holding that declines in value is itself evidence of imprudence", explanation: "This is exactly the older, discredited approach UPIA displaced — a holding is not judged alone, and a loss is not by itself proof of imprudence." },
      { text: "Solely by the actual investment returns achieved, without regard to the process the trustee followed", explanation: "Prudence under UPIA is measured by the quality of the trustee's process and strategy, not judged in hindsight purely on realized returns." },
      { text: "Against a fixed statutory 'legal list' of approved investments, outside of which no trust asset may be held", explanation: "The legal-list regime is a pre-UPIA approach; UPIA holds that no category of investment is inherently off-limits, provided it fits the overall strategy." },
    ],
  },
  {
    id: "s65-cl-x407",
    section: "client",
    q: "ERISA's 'prudent expert' standard requires a plan fiduciary to act with the care, skill, and diligence that:",
    a: "A prudent person familiar with such matters, acting in a like capacity, would use — which may obligate a fiduciary lacking sufficient expertise to obtain qualified assistance",
    explanation: "ERISA Section 404(a)(1)(B) requires the care, skill, prudence, and diligence 'that a prudent man acting in a like capacity and familiar with such matters would use.' The italicized phrase is what makes it a heightened, expert-oriented standard rather than an ordinary prudent-person rule: the fiduciary is judged against someone knowledgeable in plan and investment matters, so a fiduciary lacking that expertise is expected to engage a qualified expert rather than proceed alone.",
    options: [
      { text: "A prudent person familiar with such matters, acting in a like capacity, would use — which may obligate a fiduciary lacking sufficient expertise to obtain qualified assistance", explanation: "Correct — this heightened, expertise-oriented standard is what 'prudent expert' adds beyond ordinary prudence." },
      { text: "Any reasonable, uninformed person would use, regardless of specialized knowledge", explanation: "The standard specifically calls for the care a knowledgeable person familiar with such matters would use, not simply an ordinary uninformed person's judgment." },
      { text: "A fiduciary's own personal, subjective comfort level with risk", explanation: "The standard is objective, measured against what a prudent expert would do, not the individual fiduciary's personal risk tolerance." },
      { text: "The plan sponsor's board would use when making ordinary business decisions for the company itself", explanation: "A fiduciary acts for the exclusive benefit of participants under a distinct ERISA standard — ordinary corporate business judgment on the sponsor's own behalf is not the measure." },
    ],
  },
  // ---------------------------------------------------------------------
  // TRUST INCOME TAXATION
  // ---------------------------------------------------------------------
  {
    id: "s65-cl-x408",
    section: "client",
    q: "A complex trust earns taxable income during the year and distributes part of it to its beneficiaries. For federal income tax purposes, the distributed portion is generally:",
    a: "Carried out to the beneficiaries and taxed on their own returns, with the trust claiming an income distribution deduction limited to its distributable net income (DNI)",
    explanation: "Trusts and estates operate largely as pass-through entities for distributed income: the trust takes an income distribution deduction for amounts paid or required to be distributed, capped at distributable net income, and the beneficiary reports that income on a Schedule K-1. Income the trust retains, by contrast, is taxed to the trust itself at its own steeply compressed rate schedule.",
    options: [
      { text: "Carried out to the beneficiaries and taxed on their own returns, with the trust claiming an income distribution deduction limited to its distributable net income (DNI)", explanation: "Correct — DNI both caps the trust's distribution deduction and determines how much of the distribution the beneficiary must include in income." },
      { text: "Taxed to the trust at its own rates, with the beneficiaries receiving the distribution entirely tax-free", explanation: "This reverses the rule — distributed income is deducted by the trust and taxed to the beneficiary; it is RETAINED income that is taxed to the trust." },
      { text: "Taxed to the grantor personally, regardless of who actually receives the distribution", explanation: "That describes grantor trust treatment, a separate regime; in a non-grantor complex trust the income follows the distribution to the beneficiary." },
      { text: "Exempt from federal income tax at every level, because a trust is a pass-through entity", explanation: "Pass-through treatment moves the tax to the beneficiary — it does not eliminate it. Someone pays: the beneficiary on distributed income, the trust on what it retains." },
    ],
  },
  {
    id: "s65-cl-x409",
    section: "client",
    q: "For federal income tax purposes, a trust is classified as a 'simple' trust for a given tax year only if, among other conditions, it:",
    a: "Is required to distribute all of its income currently, makes no distributions of principal, and makes no charitable contributions during the year",
    explanation: "These three conditions define a simple trust for the year. Failing any one of them — accumulating income, distributing corpus, or making a charitable gift — makes the trust a complex trust for that year. Because the test is applied year by year, the same trust can be simple in one year and complex in the next.",
    options: [
      { text: "Is required to distribute all of its income currently, makes no distributions of principal, and makes no charitable contributions during the year", explanation: "Correct — all three conditions must hold for the year, and failing any one makes the trust complex for that year." },
      { text: "Accumulates all of its income and distributes nothing to its beneficiaries during the year", explanation: "An accumulating trust is a complex trust — a simple trust is defined by its obligation to distribute all income currently." },
      { text: "Distributes income and principal at the trustee's full discretion", explanation: "Discretionary distributions, particularly of principal, make a trust complex rather than simple." },
      { text: "Is revocable by the grantor at any time during the year", explanation: "Revocability concerns grantor trust treatment, a separate question — it is not what distinguishes a simple trust from a complex one." },
    ],
  },
  // ---------------------------------------------------------------------
  // GIFT-TAX MECHANICS & ESTATE-TRANSFER VEHICLES
  // ---------------------------------------------------------------------
  {
    id: "s65-cl-x410",
    section: "client",
    q: "An irrevocable trust is drafted so that each time the grantor contributes to the trust, the beneficiaries have the right to withdraw the contribution during a limited window. The purpose of this 'Crummey' withdrawal right is to:",
    a: "Convert what would otherwise be a gift of a future interest into a gift of a present interest, so the contribution can qualify for the federal gift tax annual exclusion",
    explanation: "The gift tax annual exclusion is available only for gifts of a present interest. A contribution to a trust that a beneficiary cannot touch until some later date is a future interest and would not qualify. Granting a temporary, immediate right of withdrawal gives the beneficiary a present interest, so the contribution fits within the annual exclusion — a technique used heavily to fund irrevocable life insurance trusts with premium gifts.",
    options: [
      { text: "Convert what would otherwise be a gift of a future interest into a gift of a present interest, so the contribution can qualify for the federal gift tax annual exclusion", explanation: "Correct — the present-interest requirement is exactly the obstacle a Crummey power is drafted to clear." },
      { text: "Make the trust revocable, so the grantor may reclaim contributions if circumstances change", explanation: "A Crummey power gives a withdrawal right to the BENEFICIARY for a brief window; it has no effect on the trust's irrevocability or on the grantor's ability to reclaim anything." },
      { text: "Allow the grantor to deduct contributions to the trust as charitable donations", explanation: "Contributions to a trust for family beneficiaries are gifts, not charitable donations — a Crummey power does not create an income tax deduction." },
      { text: "Ensure the trust's taxable income is reported by the beneficiaries rather than by the trust", explanation: "Who reports trust income turns on the distribution and grantor trust rules, not on the presence of a Crummey withdrawal power." },
    ],
  },
  {
    id: "s65-cl-x411",
    section: "client",
    q: "A Grantor Retained Annuity Trust (GRAT) is a strategy in which the grantor transfers assets to an irrevocable trust, retains a fixed annuity payment for a term of years, and:",
    a: "Passes any remaining trust assets to beneficiaries at the end of the term, potentially at a reduced gift-tax cost if the assets outperform the IRS's assumed rate",
    explanation: "A GRAT is most effective when the transferred assets appreciate or produce income faster than the IRS's Section 7520 assumed rate, allowing the excess growth to pass to beneficiaries with little or no additional gift tax.",
    options: [
      { text: "Passes any remaining trust assets to beneficiaries at the end of the term, potentially at a reduced gift-tax cost if the assets outperform the IRS's assumed rate", explanation: "Correct — this is the core mechanics and tax rationale of a GRAT." },
      { text: "Retains full, unrestricted access to the trust's principal at any time during the annuity term", explanation: "A GRAT is irrevocable and the grantor's retained interest is limited to the fixed annuity payments, not open access to principal." },
      { text: "Guarantees the beneficiaries will receive assets regardless of how the trust's investments perform", explanation: "If the trust underperforms the assumed rate, little or nothing may remain for the beneficiaries — the strategy's benefit is not guaranteed." },
      { text: "Is fully revocable by the grantor at any point before the term ends", explanation: "A GRAT must be structured as an irrevocable trust to achieve its intended estate and gift tax treatment." },
    ],
  },
  {
    id: "s65-cl-x412",
    section: "client",
    q: "An Irrevocable Life Insurance Trust (ILIT) is commonly used to:",
    a: "Own a life insurance policy so that the death benefit proceeds are kept out of the insured's taxable estate",
    explanation: "By having the ILIT, rather than the insured personally, own and be the beneficiary of the policy, the death benefit can avoid inclusion in the insured's gross estate, provided the insured retains no incidents of ownership over the policy.",
    options: [
      { text: "Own a life insurance policy so that the death benefit proceeds are kept out of the insured's taxable estate", explanation: "Correct — this estate-tax-exclusion purpose is the primary reason an ILIT is used." },
      { text: "Allow the insured to retain full ownership and control of the policy after the trust is created", explanation: "Retaining incidents of ownership would generally cause the death benefit to be pulled back into the insured's taxable estate, defeating the trust's purpose." },
      { text: "Make the trust revocable so the insured can reclaim the policy at any time", explanation: "The trust must be irrevocable — a revocable arrangement would not remove the policy from the insured's taxable estate." },
      { text: "Convert term life insurance into a taxable annuity", explanation: "An ILIT holds a life insurance policy for estate planning purposes; it does not convert the policy into an annuity product." },
    ],
  },
  {
    id: "s65-cl-x413",
    section: "client",
    q: "A Qualified Personal Residence Trust (QPRT) allows a grantor to transfer a personal residence to an irrevocable trust while:",
    a: "Retaining the right to live in the residence for a specified term of years, potentially reducing the taxable gift value of the future transfer",
    explanation: "Because the grantor's retained right to occupy the home reduces the present value of the gift to the remainder beneficiaries, a QPRT can transfer a residence at a discounted gift-tax value, though the strategy carries risk if the grantor dies during the retained term.",
    options: [
      { text: "Retaining the right to live in the residence for a specified term of years, potentially reducing the taxable gift value of the future transfer", explanation: "Correct — this retained-interest structure is what makes a QPRT gift-tax efficient." },
      { text: "Immediately losing all rights to occupy the residence once the trust is funded", explanation: "The grantor specifically retains occupancy rights for the trust's term — that retained interest is central to the strategy's tax benefit." },
      { text: "Guaranteeing the residence will never be included in the grantor's estate under any circumstance", explanation: "If the grantor dies during the retained term, the residence can be pulled back into the grantor's taxable estate — the benefit is not unconditional." },
      { text: "Requiring the residence to be sold to a third party before the trust can be created", explanation: "A QPRT is funded with the grantor's own residence transferred directly into the trust, not a residence purchased from an unrelated third party." },
    ],
  },
  {
    id: "s65-cl-x414",
    section: "client",
    q: "A Spousal Lifetime Access Trust (SLAT) is an irrevocable trust one spouse creates for the benefit of the other spouse primarily to:",
    a: "Remove assets from the donor spouse's taxable estate while allowing the beneficiary spouse continued, indirect access to the trust's assets",
    explanation: "A SLAT lets a married couple use an exclusion amount and shift future appreciation outside the donor spouse's estate, while the couple retains indirect access to the funds through distributions available to the beneficiary spouse.",
    options: [
      { text: "Remove assets from the donor spouse's taxable estate while allowing the beneficiary spouse continued, indirect access to the trust's assets", explanation: "Correct — this balance of estate removal with continued indirect access is the defining appeal of a SLAT." },
      { text: "Give the donor spouse continued direct control over the transferred assets", explanation: "The trust must be irrevocable and the donor spouse generally cannot retain direct control, or the estate-tax benefit is undermined." },
      { text: "Require that both spouses create nearly identical trusts for one another", explanation: "Mirror-image trusts risk the reciprocal trust doctrine, under which the IRS may unwind the arrangement and pull the assets back into each donor's estate — this is a hazard to avoid, not the purpose of a SLAT." },
      { text: "Be fully revocable so either spouse can unwind the arrangement at will", explanation: "A SLAT must be irrevocable to achieve its intended removal of assets from the donor spouse's taxable estate." },
    ],
  },
  {
    id: "s65-cl-x415",
    section: "client",
    q: "A special needs (supplemental needs) trust is structured to hold assets for a disabled beneficiary primarily to:",
    a: "Supplement, rather than replace, the beneficiary's care without disqualifying them from means-tested government benefits such as SSI or Medicaid",
    explanation: "Because outright ownership of significant assets can disqualify an individual from means-tested benefits, a special needs trust holds and distributes funds for supplemental needs — items and services benefits don't cover — while the beneficiary remains eligible for those programs.",
    options: [
      { text: "Supplement, rather than replace, the beneficiary's care without disqualifying them from means-tested government benefits such as SSI or Medicaid", explanation: "Correct — preserving means-tested benefit eligibility while supplementing care is the trust's central purpose." },
      { text: "Give the beneficiary direct, unrestricted ownership of the trust assets", explanation: "Direct, unrestricted ownership is exactly what would jeopardize the beneficiary's eligibility for means-tested benefits — the trust structure exists to avoid that outcome." },
      { text: "Replace all means-tested government benefits the beneficiary would otherwise receive", explanation: "The trust is designed to supplement, not replace, those benefits, preserving the beneficiary's eligibility rather than substituting for it." },
      { text: "Require that the trust terminate upon the beneficiary reaching adulthood", explanation: "A special needs trust is typically structured to continue providing supplemental support throughout the beneficiary's life, not to terminate at adulthood." },
    ],
  },
  // ---------------------------------------------------------------------
  // OWNERSHIP FORMS & TRANSFER TAXES
  // ---------------------------------------------------------------------
  {
    id: "s65-cl-x416",
    section: "client",
    q: "Tenancy by the entirety, a form of ownership available only to married couples in states that recognize it, differs from ordinary joint tenancy with right of survivorship chiefly in that:",
    a: "Neither spouse may unilaterally sever the tenancy or transfer their interest without the other's consent, and in many states the property is shielded from creditors of only one spouse",
    explanation: "Both forms carry survivorship, so on the first death the survivor takes the whole. What sets tenancy by the entirety apart is the marital unity it presumes: neither spouse acting alone can sever it, convey their share, or encumber the property, and in many recognizing states that indivisibility also puts the asset beyond the reach of a creditor of just one spouse.",
    options: [
      { text: "Neither spouse may unilaterally sever the tenancy or transfer their interest without the other's consent, and in many states the property is shielded from creditors of only one spouse", explanation: "Correct — indivisibility without mutual consent, and the creditor protection that follows from it, is the distinguishing feature." },
      { text: "The deceased spouse's interest passes through probate to their estate rather than to the surviving spouse", explanation: "Tenancy by the entirety carries a right of survivorship — the survivor takes the property outside probate, just as in joint tenancy." },
      { text: "Either spouse may unilaterally convey their entire interest to an unrelated third party at any time", explanation: "This is the opposite of the rule — unilateral conveyance is precisely what tenancy by the entirety forbids, and it is closer to how a joint tenancy can be severed." },
      { text: "It is available to any two individuals who choose it, regardless of marital status", explanation: "Tenancy by the entirety is restricted to married couples, and only in the states that recognize the form at all." },
    ],
  },
  {
    id: "s65-cl-x417",
    section: "client",
    q: "A federal estate tax and a state inheritance tax are levied on fundamentally different parties. Which statement describes that difference correctly?",
    a: "An estate tax is imposed on the decedent's estate before assets are distributed, while an inheritance tax is imposed on the beneficiary who receives the assets",
    explanation: "The distinction is who bears the tax. An estate tax is computed on and paid out of the estate itself, so it is settled before beneficiaries receive anything. An inheritance tax is imposed on the recipient, and the rate typically depends on that recipient's relationship to the decedent — closer relatives are commonly taxed at lower rates or exempted entirely. The federal government levies an estate tax but no inheritance tax; a handful of states impose one, the other, or both.",
    options: [
      { text: "An estate tax is imposed on the decedent's estate before assets are distributed, while an inheritance tax is imposed on the beneficiary who receives the assets", explanation: "Correct — the estate pays one, the recipient pays the other." },
      { text: "An inheritance tax is imposed on the decedent's estate, while an estate tax is imposed on each beneficiary who receives assets", explanation: "This reverses the two — it is the classic trap on this topic, and reading the names literally is what defeats it." },
      { text: "Both taxes are imposed on the beneficiary who receives the assets, differing only in the rate schedule applied", explanation: "Only the inheritance tax reaches the beneficiary; the estate tax is levied on the estate itself before distribution." },
      { text: "Both taxes are imposed only at the federal level; no state imposes either one", explanation: "The reverse is closer to true — the federal government imposes an estate tax only, while inheritance taxes exist solely at the state level in the few states that levy them." },
    ],
  },
  // ---------------------------------------------------------------------
  // DEFERRED COMP FUNDING & RETIREMENT INCOME SEQUENCING
  // ---------------------------------------------------------------------
  {
    id: "s65-cl-x418",
    section: "client",
    q: "An employer informally funds a nonqualified deferred compensation arrangement for a key executive by placing assets into a 'rabbi trust.' A defining feature of this arrangement is that:",
    a: "The trust assets remain subject to the claims of the employer's general creditors, which is what allows the executive to continue deferring taxation on the deferred amounts",
    explanation: "The rabbi trust is a deliberate trade-off. It protects the executive against a change of heart by the employer — the assets are set aside and cannot simply be spent — but it cannot protect against the employer's insolvency, because the moment the assets are placed beyond the reach of the employer's general creditors for the executive's exclusive benefit, the executive would be taxed currently. Remaining exposed as an unsecured general creditor is the price of continued deferral.",
    options: [
      { text: "The trust assets remain subject to the claims of the employer's general creditors, which is what allows the executive to continue deferring taxation on the deferred amounts", explanation: "Correct — creditor exposure is not an incidental flaw of the rabbi trust; it is the very condition that preserves the tax deferral." },
      { text: "The trust assets are protected from the employer's creditors, giving the executive security equivalent to a qualified plan participant", explanation: "Assets shielded from the employer's creditors for the executive's exclusive benefit would trigger current taxation — that arrangement is a secular trust, and it forfeits the deferral." },
      { text: "The executive is taxed on the entire deferred balance in the year the trust is funded", explanation: "The point of the rabbi trust is precisely to avoid this — properly structured, funding it does not trigger constructive receipt." },
      { text: "The arrangement must satisfy ERISA's coverage, vesting, and nondiscrimination rules just as a qualified plan does", explanation: "These arrangements are generally structured as 'top hat' plans for a select group of management or highly compensated employees, exempt from those ERISA requirements." },
    ],
  },
  {
    id: "s65-cl-x419",
    section: "client",
    q: "A retiree's portfolio is divided into segments: a cash reserve covering several years of spending, a bond segment for intermediate-term needs, and an equity segment for needs further out. This 'bucket' (time-segmentation) approach is chiefly intended to:",
    a: "Reduce the likelihood the retiree must liquidate equities into a declining market to fund near-term spending, giving those holdings time to recover",
    explanation: "The near-term bucket is what does the work: by funding immediate spending from cash and short bonds, the retiree is not forced to sell equities at depressed prices during a downturn, so the equity segment has time to recover. The approach organizes the same underlying allocation around the timing of withdrawals rather than changing the fundamental risk of the assets held.",
    options: [
      { text: "Reduce the likelihood the retiree must liquidate equities into a declining market to fund near-term spending, giving those holdings time to recover", explanation: "Correct — avoiding forced sales at depressed prices is the core rationale for time-segmenting a retirement portfolio." },
      { text: "Guarantee the retiree will never exhaust the portfolio, regardless of spending rate or market returns", explanation: "No allocation structure can guarantee this; an unsustainable withdrawal rate will deplete a bucketed portfolio just as it would any other." },
      { text: "Eliminate the need to hold any equities during retirement", explanation: "The strategy deliberately RETAINS a long-horizon equity segment — the buckets exist to protect it from forced liquidation, not to replace it." },
      { text: "Increase the portfolio's expected return by concentrating the assets into a single asset class", explanation: "Time segmentation spreads assets across cash, bonds, and equities by time horizon; it is a withdrawal-sequencing structure, not a return-maximizing concentration bet." },
    ],
  },
];
