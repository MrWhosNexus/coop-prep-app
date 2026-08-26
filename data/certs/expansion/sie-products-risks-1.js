// SIE (Securities Industry Essentials) exam — practice question bank
// Expansion batch (part 1 of 3) for Section 2 — Understanding Products and Their Risks
// (products-risks). This batch is biased toward the FIRST slice of the topic scope:
// equity-security mechanics (authorized/issued/outstanding shares, treasury stock, par
// value, book value, splits, odd/round lots, when-issued trading), debt mechanics
// (accrued interest, price quoting conventions, Treasury STRIPS, agency-bond taxation),
// municipal fund securities (529 plans, ABLE accounts, local government investment
// pools), and several risk-type items (reinvestment, credit, systematic/unsystematic,
// political/legislative) written at a harder, scenario-based angle than the softball
// definitional items already in sie-bank.js / sie-bank-products-risks.js.
//
// No contribution/coverage limits or other unconfirmable dated dollar figures appear in
// this batch — every item tests a mechanism instead. The one dated figure that does appear
// (the $250 round-lot price band in sieb-pr-x107) is confirmed current against Rule
// 600(b)(93) of Regulation NMS: the SEC accelerated the tiered round-lot definition on
// 9/18/2024 and it was implemented 11/3/2025, so "100 shares" is no longer universal and
// the item is scoped to the price band where it still holds.
//
// No item in this batch turns on the settlement cycle, so no settlement-cycle claim — stale
// or current — appears here at all.
//
// Ids: sieb-pr-x101 through sieb-pr-x122 (22 items), reserved range, no collisions.

export const SIE_PRODUCTS_RISKS_X1 = [
  // ---------------------------------------------------------------------
  // EQUITY SECURITY MECHANICS
  // ---------------------------------------------------------------------
  {
    id: "sieb-pr-x101",
    section: "products-risks",
    q: "A corporation's charter authorizes 10 million shares of common stock. It has issued 6 million shares, and has since repurchased 1 million of those as treasury stock. How many shares are currently outstanding?",
    a: "5 million",
    explanation: "Outstanding shares = issued shares minus treasury shares (6 million issued − 1 million treasury = 5 million outstanding). Authorized shares (10 million) is simply the ceiling the charter permits the company to issue; it does not change when shares are repurchased.",
    options: [
      { text: "5 million", explanation: "Correct - outstanding shares equal issued shares minus treasury shares held by the company itself." },
      { text: "6 million", explanation: "This is the issued share count, but it does not subtract out the 1 million shares the company reacquired as treasury stock." },
      { text: "9 million", explanation: "This confuses authorized shares with issued shares (10 million authorized minus 1 million treasury is not a meaningful figure)." },
      { text: "10 million", explanation: "This is the authorized share ceiling in the charter, not the number of shares actually outstanding in investors' hands." },
    ],
  },
  {
    id: "sieb-pr-x102",
    section: "products-risks",
    q: "Shares of common stock that a corporation has repurchased and is holding in its own treasury, rather than retiring, are best described as carrying:",
    a: "No voting rights and no dividend rights while held as treasury stock",
    explanation: "Treasury stock is issued but no longer outstanding. Because it is held by the issuing corporation itself, it carries no voting rights and receives no dividends — the corporation does not vote for or pay itself. It can later be reissued or used for purposes like employee stock plans.",
    options: [
      { text: "No voting rights and no dividend rights while held as treasury stock", explanation: "Correct - treasury shares are issued but not outstanding, so they carry none of the rights attached to outstanding shares until reissued." },
      { text: "Full voting rights but no dividend rights", explanation: "Treasury stock carries no voting rights at all while held by the corporation, not partial rights." },
      { text: "Full voting rights and full dividend rights, same as any other shareholder", explanation: "This describes outstanding shares held by the public, not treasury shares held by the issuer." },
      { text: "Dividend rights only, with voting rights suspended", explanation: "Treasury stock receives no dividends either — a corporation does not pay dividends to itself." },
    ],
  },
  {
    id: "sieb-pr-x103",
    section: "products-risks",
    q: "The par value stated on a share of common stock is best understood as:",
    a: "An arbitrary accounting figure with no necessary relationship to the stock's market value",
    explanation: "For common stock, par value is a nominal figure assigned for balance-sheet and legal-capital accounting purposes. It has no necessary connection to what the stock actually trades for in the market — many companies assign a par value of a fraction of a cent while the stock trades for far more.",
    options: [
      { text: "An arbitrary accounting figure with no necessary relationship to the stock's market value", explanation: "Correct - par value on common stock is a bookkeeping convention, unlike the more economically meaningful par value on a bond." },
      { text: "The price at which the stock was first sold in its IPO", explanation: "That describes the public offering price, which is a separate figure and typically much higher than par value." },
      { text: "The minimum price at which the stock may legally trade in the secondary market", explanation: "There is no such floor tied to par value; common stock can and does trade below its stated par value." },
      { text: "The amount the company must pay a shareholder upon redemption", explanation: "Common stock has no redemption or maturity feature at all; that concept applies to bonds and some preferred stock, not to par value on common shares." },
    ],
  },
  {
    id: "sieb-pr-x104",
    section: "products-risks",
    q: "A company's book value per common share is calculated by:",
    a: "Subtracting total liabilities and the liquidation value of preferred stock from total assets, then dividing by the number of common shares outstanding",
    explanation: "Book value per share reflects the accounting net worth attributable to each common share. Preferred stockholders have a prior claim on assets, so their liquidation value is subtracted along with liabilities before dividing the remainder by common shares outstanding.",
    options: [
      { text: "Subtracting total liabilities and the liquidation value of preferred stock from total assets, then dividing by the number of common shares outstanding", explanation: "Correct - this isolates the net assets that belong to common shareholders after all prior claims are satisfied." },
      { text: "Dividing total assets by the number of common shares outstanding", explanation: "This ignores liabilities and preferred claims entirely, overstating what actually belongs to common shareholders." },
      { text: "Dividing the current market capitalization by the number of common shares outstanding", explanation: "That calculation simply returns the current market price per share, not an accounting-based book value." },
      { text: "Dividing annual net income by the number of common shares outstanding", explanation: "That describes earnings per share (EPS), a completely different metric from book value." },
    ],
  },
  {
    id: "sieb-pr-x105",
    section: "products-risks",
    q: "A corporation executes a 2-for-1 forward stock split. Immediately after the split, and before any market trading reaction, what happens to an existing shareholder's total position?",
    a: "The number of shares held doubles, the price per share is halved, and the total dollar value of the position is unchanged",
    explanation: "A stock split changes the number of shares and the per-share price proportionally but does not, by itself, change the company's market capitalization or an existing shareholder's total position value. A 2-for-1 split doubles share count while halving price, leaving total value the same.",
    options: [
      { text: "The number of shares held doubles, the price per share is halved, and the total dollar value of the position is unchanged", explanation: "Correct - a forward split is a purely cosmetic repricing; it does not change the underlying value of the company or the shareholder's stake." },
      { text: "The number of shares held doubles and the total dollar value of the position doubles", explanation: "A split creates no new value; it merely divides the existing value into more, lower-priced shares." },
      { text: "The number of shares held stays the same, but the price per share doubles", explanation: "This describes the opposite of what happens, and is more consistent with a reverse split's price effect than a forward split." },
      { text: "The par value assigned to the stock increases proportionally", explanation: "A forward split typically results in a lower, not higher, stated par value per share, since more shares now represent the same aggregate legal capital." },
    ],
  },
  {
    id: "sieb-pr-x106",
    section: "products-risks",
    q: "A company executes a 1-for-10 reverse stock split. This action is most commonly taken in order to:",
    a: "Raise the per-share trading price, often to meet an exchange listing requirement or improve the stock's image",
    explanation: "A reverse split reduces the number of outstanding shares while proportionally raising the price per share. Companies often use this to lift a depressed stock price above an exchange's minimum listing threshold or to shed a 'penny stock' perception, without changing the company's actual market value.",
    options: [
      { text: "Raise the per-share trading price, often to meet an exchange listing requirement or improve the stock's image", explanation: "Correct - this is the typical motivation, and it does not by itself change the company's total market capitalization." },
      { text: "Increase the total number of shares available for the company to sell to new investors", explanation: "A reverse split reduces the share count outstanding; it does not directly authorize or create new shares for sale." },
      { text: "Raise additional capital for the company", explanation: "A reverse split is a purely structural repricing of existing shares and raises no new capital for the issuer." },
      { text: "Increase the dividend paid per share without changing total dividend cost", explanation: "While the per-share dividend often rises proportionally after a reverse split, that is a byproduct, not the reason companies pursue one." },
    ],
  },
  {
    id: "sieb-pr-x107",
    section: "products-risks",
    q: "For an NMS stock trading at or below $250 per share, the standard trading unit of 100 shares against which an order's size is measured is known as a:",
    a: "Round lot",
    explanation: "A round lot is the standard trading unit for a security. Under Rule 600(b)(93) of Regulation NMS, the round lot is now tiered by the stock's average closing price: 100 shares at $250.00 or less, 40 shares from $250.01-$1,000.00, 10 shares from $1,000.01-$10,000.00, and 1 share above that. An order smaller than a round lot is an odd lot; an order larger than a round lot but not an even multiple of one is a mixed lot.",
    options: [
      { text: "Round lot", explanation: "Correct - the round lot is the defined standard trading unit for a given security, and it remains 100 shares for the great majority of actively traded stocks." },
      { text: "Odd lot", explanation: "An odd lot is any quantity smaller than the standard round-lot unit, the opposite of what's described here." },
      { text: "Block trade", explanation: "A block trade refers to a large institutional-sized transaction (commonly thought of as 10,000 shares or more), not the standard trading unit." },
      { text: "Mixed lot", explanation: "A mixed lot is a real term, but it means an order larger than a round lot that is not an even multiple of one - for example, 250 shares where the round lot is 100 - rather than the standard unit itself." },
    ],
  },
  {
    id: "sieb-pr-x108",
    section: "products-risks",
    q: "'When-issued' (WI) trading of a security refers to trading that occurs:",
    a: "After a new issue has been authorized or announced but before the actual securities have been distributed and settlement can occur",
    explanation: "When-issued trading lets investors trade a security on a 'due bill' basis after it has been authorized (for example, after a stock split or a new Treasury auction) but before the physical/electronic issuance and settlement process is complete. Confirmed trades then settle once the securities are actually available.",
    options: [
      { text: "After a new issue has been authorized or announced but before the actual securities have been distributed and settlement can occur", explanation: "Correct - WI trading bridges the gap between authorization of a new issue and its actual delivery and settlement." },
      { text: "After a security has been delisted from its primary exchange", explanation: "That describes trading in the over-the-counter markets for a delisted issue, which is unrelated to the when-issued concept." },
      { text: "Only during the cooling-off period of an SEC registration before a prospectus is final", explanation: "That period restricts sales activity to indications of interest; it is a different concept from when-issued trading." },
      { text: "Exclusively by the underwriting syndicate before the public offering begins", explanation: "When-issued trading is available to the investing public, not restricted solely to underwriters." },
    ],
  },
  // ---------------------------------------------------------------------
  // DEBT SECURITY MECHANICS
  // ---------------------------------------------------------------------
  {
    id: "sieb-pr-x109",
    section: "products-risks",
    q: "In a regular-way secondary market trade of an interest-bearing corporate bond between coupon payment dates, who is typically responsible for paying accrued interest?",
    a: "The buyer pays the seller the interest that has accrued since the last coupon payment, in addition to the bond's price",
    explanation: "Between coupon dates, the seller has earned but not yet been paid interest for the days they held the bond. The buyer compensates the seller for that accrued interest at settlement, then the buyer recoups it (and more) when the next full coupon payment is received.",
    options: [
      { text: "The buyer pays the seller the interest that has accrued since the last coupon payment, in addition to the bond's price", explanation: "Correct - accrued interest is added to the contract price so the seller is fairly compensated for the days they held the bond since the last coupon." },
      { text: "The seller pays the buyer accrued interest as compensation for taking on the position", explanation: "This reverses the actual direction of payment; the buyer, not the seller, pays accrued interest." },
      { text: "No accrued interest changes hands; the buyer simply waits for the next full coupon", explanation: "This would let the buyer keep interest they didn't earn; standard practice requires the buyer to pay the seller for interest accrued during the seller's holding period." },
      { text: "The issuer pays accrued interest directly to whichever party held the bond longer during the period", explanation: "The issuer is not involved in accrued-interest settlement between two secondary-market counterparties; that is handled directly between buyer and seller at trade settlement." },
    ],
  },
  {
    id: "sieb-pr-x110",
    section: "products-risks",
    q: "A corporate bond is quoted at '98.5.' This quote means the bond is priced at:",
    a: "98.5% of its par value",
    explanation: "Corporate bond prices are quoted as a percentage of par (face value), where each whole point equals one percent of par. A quote of 98.5 on a $1,000 par bond equals $985, reflecting a slight discount to par.",
    options: [
      { text: "98.5% of its par value", explanation: "Correct - bond quotes are expressed as a percentage of the bond's par value, with each point equal to 1% of par." },
      { text: "$98.50 regardless of the bond's par value", explanation: "The quote is always a percentage of par, not a fixed dollar figure independent of the bond's face amount." },
      { text: "98.5 basis points above the bond's coupon rate", explanation: "Basis points describe yield spreads, not a bond price quotation like this one." },
      { text: "98 and 5/32 percent of par, using Treasury-style fractional quoting", explanation: "Corporate bonds are quoted in decimal points and eighths/tenths of a point, not in 32nds — that fractional convention is used for Treasury notes and bonds instead." },
    ],
  },
  {
    id: "sieb-pr-x111",
    section: "products-risks",
    q: "Treasury notes and Treasury bonds are conventionally quoted in:",
    a: "32nds of a point",
    explanation: "Unlike corporate bonds (quoted in decimal points/eighths) or stocks (quoted in decimals), Treasury notes and bonds are traditionally quoted in 32nds of a point, where a quote like '99-16' means 99 and 16/32 percent of par.",
    options: [
      { text: "32nds of a point", explanation: "Correct - this is the long-standing Treasury market quoting convention, distinct from how corporate bonds are quoted." },
      { text: "8ths of a point, the same as corporate bonds", explanation: "Corporate bonds historically used eighths (now mostly decimals); Treasuries use the finer 32nds convention instead." },
      { text: "Whole dollar amounts only, with no fractional pricing", explanation: "Treasury quotes routinely include fractional components (32nds), so whole-dollar-only pricing is inaccurate." },
      { text: "Basis points relative to the prior day's closing yield", explanation: "That describes a yield-change convention, not how the bond's price itself is quoted." },
    ],
  },
  {
    id: "sieb-pr-x112",
    section: "products-risks",
    q: "Treasury STRIPS are created by separating a Treasury note or bond's components into:",
    a: "Individual zero-coupon instruments — one for each future coupon payment and one for the final principal repayment",
    explanation: "STRIPS stands for Separate Trading of Registered Interest and Principal of Securities. A dealer strips each coupon payment and the final principal payment off an underlying Treasury note or bond, and each piece then trades separately as its own zero-coupon instrument, each sold at a discount to its face value at maturity.",
    options: [
      { text: "Individual zero-coupon instruments — one for each future coupon payment and one for the final principal repayment", explanation: "Correct - this is exactly what stripping accomplishes, turning one coupon-paying security into a series of separately tradable zero-coupon pieces." },
      { text: "Two new coupon-paying bonds, each with half the original coupon rate", explanation: "Stripping does not create new coupon-paying bonds; it isolates cash flows into zero-coupon instruments." },
      { text: "A single new bond with a floating interest rate tied to Treasury bill auctions", explanation: "This describes a floating-rate note structure, unrelated to how STRIPS are created." },
      { text: "Shares of a bond mutual fund holding the original security", explanation: "STRIPS are individual direct-obligation instruments created by a broker-dealer, not fund shares." },
    ],
  },
  {
    id: "sieb-pr-x113",
    section: "products-risks",
    q: "Even though a Treasury STRIP pays no periodic interest, the IRS generally requires the holder to:",
    a: "Report the annually accreted discount (imputed 'phantom' interest) as taxable income each year, even though no cash is received",
    explanation: "Like other zero-coupon instruments, STRIPS accrete in value toward par as they approach maturity. That annual accretion is treated as imputed interest income and is generally taxable each year it accrues, even though the holder receives no actual cash until the STRIP matures — this is why STRIPS are often held in tax-deferred accounts.",
    options: [
      { text: "Report the annually accreted discount (imputed 'phantom' interest) as taxable income each year, even though no cash is received", explanation: "Correct - this 'phantom income' feature is the key tax planning consideration for holding zero-coupon Treasury STRIPS in a taxable account." },
      { text: "Pay no tax on the instrument until the year it is sold or matures", explanation: "Tax on the accreted discount is generally due annually as it accrues, not deferred entirely until sale or maturity." },
      { text: "Pay capital gains tax annually on any market price appreciation", explanation: "The relevant annual tax treatment is on imputed ordinary interest income from accretion, not on market-price fluctuations, which are a separate capital gain/loss consideration only realized at sale." },
      { text: "File a gift tax return since STRIPS are treated as an original issue discount gift", explanation: "This is not a real tax requirement associated with holding STRIPS." },
    ],
  },
  {
    id: "sieb-pr-x114",
    section: "products-risks",
    q: "Interest paid on debt issued by government-sponsored enterprises like Fannie Mae and Freddie Mac, compared to interest on direct US Treasury obligations, is generally:",
    a: "Taxable at the federal level and, unlike Treasury interest, also generally subject to state and local income tax",
    explanation: "Treasury securities' interest is exempt from state and local (but not federal) income tax. GSE debt such as Fannie Mae and Freddie Mac obligations, by contrast, is generally fully taxable — federal, state, and local — since these agencies are not themselves branches of the US government despite their government sponsorship.",
    options: [
      { text: "Taxable at the federal level and, unlike Treasury interest, also generally subject to state and local income tax", explanation: "Correct - GSE debt lacks the state/local tax exemption that direct Treasury obligations enjoy, a key distinction tested on the exam." },
      { text: "Completely exempt from federal, state, and local income tax, exactly like municipal bond interest", explanation: "GSE debt does not carry the tax-exempt status of municipal bonds; its interest is fully taxable at the federal level." },
      { text: "Exempt from federal tax but taxable at the state and local level", explanation: "This reverses the actual treatment — GSE interest is federally taxable, and it is state/local taxation that is not exempted, unlike Treasuries." },
      { text: "Taxed identically to Treasury interest in every respect", explanation: "The two are not identical; the state/local tax exemption enjoyed by Treasuries does not extend to GSE debt." },
    ],
  },
  // ---------------------------------------------------------------------
  // MUNICIPAL FUND SECURITIES
  // ---------------------------------------------------------------------
  {
    id: "sieb-pr-x115",
    section: "products-risks",
    q: "A 529 college savings plan is classified, for regulatory purposes, as a:",
    a: "Municipal fund security, regulated by the MSRB",
    explanation: "Although a 529 plan functions much like a mutual fund investing in a portfolio of underlying securities, it is issued by a state (or state agency) and is classified as a municipal fund security. As such, it falls under MSRB rulemaking rather than being registered as an investment company under the Investment Company Act.",
    options: [
      { text: "Municipal fund security, regulated by the MSRB", explanation: "Correct - 529 plans are state-sponsored and classified as municipal fund securities subject to MSRB rules, despite their mutual-fund-like structure." },
      { text: "Open-end mutual fund, registered under the Investment Company Act of 1940", explanation: "529 plans are not registered as investment companies under the '40 Act; they are treated as municipal fund securities instead." },
      { text: "Direct participation program", explanation: "A DPP is a pass-through business entity like a limited partnership; a 529 plan is a savings/investment vehicle for education expenses, not a DPP." },
      { text: "Variable annuity contract", explanation: "A 529 plan has no insurance component or annuitization feature; it is a distinct municipal fund security, not an annuity." },
    ],
  },
  {
    id: "sieb-pr-x116",
    section: "products-risks",
    q: "Which statement best describes the general tax treatment of a 529 plan?",
    a: "Contributions are generally made with after-tax dollars, earnings grow tax-deferred, and qualified withdrawals for education expenses are free of federal income tax",
    explanation: "529 plans do not provide a federal tax deduction for contributions, but the account grows tax-deferred, and withdrawals used for qualified education expenses avoid federal income tax on the earnings portion entirely — a key selling point of the vehicle. Some states offer their own deduction or credit for in-state plan contributions.",
    options: [
      { text: "Contributions are generally made with after-tax dollars, earnings grow tax-deferred, and qualified withdrawals for education expenses are free of federal income tax", explanation: "Correct - this is the standard federal tax treatment of a 529 plan, regardless of which state's plan is used." },
      { text: "Contributions are always fully deductible on the contributor's federal income tax return", explanation: "There is no federal deduction for 529 contributions; any deduction or credit that exists is at the state level and varies by state." },
      { text: "All withdrawals, whether used for education or not, are entirely free of federal tax", explanation: "Only qualified education withdrawals get favorable tax treatment; non-qualified withdrawals of earnings are generally subject to federal income tax plus a penalty." },
      { text: "Earnings are taxed annually as they accrue, similar to a zero-coupon bond", explanation: "529 plan earnings grow tax-deferred, not taxed annually as they accrue; taxation is generally avoided altogether if withdrawals are used for qualified expenses." },
    ],
  },
  {
    id: "sieb-pr-x117",
    section: "products-risks",
    q: "An ABLE account is best described as a municipal fund security designed to:",
    a: "Allow individuals with qualifying disabilities to save and invest for disability-related expenses without jeopardizing eligibility for certain public benefits",
    explanation: "ABLE (Achieving a Better Life Experience) accounts are state-sponsored, MSRB-regulated municipal fund securities, structurally similar to 529 plans but designed specifically for people with qualifying disabilities, letting them build savings for disability-related expenses without losing eligibility for means-tested government benefit programs.",
    options: [
      { text: "Allow individuals with qualifying disabilities to save and invest for disability-related expenses without jeopardizing eligibility for certain public benefits", explanation: "Correct - this is the specific purpose of an ABLE account, distinguishing it from a general-purpose 529 education savings plan." },
      { text: "Fund a municipality's short-term operating cash needs between tax collection periods", explanation: "That describes a tax anticipation note, a completely different municipal financing tool, not an individual savings account." },
      { text: "Provide retirement income exclusively to retired municipal government employees", explanation: "ABLE accounts are individual disability-related savings accounts, not a public-employee pension vehicle." },
      { text: "Let a state government pool short-term idle cash for investment purposes", explanation: "That describes a local government investment pool, not an ABLE account, which is an individual account for a person with disabilities." },
    ],
  },
  {
    id: "sieb-pr-x118",
    section: "products-risks",
    q: "A local government investment pool (LGIP) is a municipal fund security that allows:",
    a: "Municipalities and other public entities to pool their short-term idle cash together for professionally managed, typically money-market-like investment",
    explanation: "An LGIP lets cities, counties, school districts, and other public entities combine their otherwise idle short-term cash into a professionally managed pool — functioning much like a money market fund but organized as a municipal fund security under MSRB jurisdiction rather than as a registered investment company.",
    options: [
      { text: "Municipalities and other public entities to pool their short-term idle cash together for professionally managed, typically money-market-like investment", explanation: "Correct - an LGIP exists to give public entities a vehicle for managing short-term cash collectively and efficiently." },
      { text: "Individual retail investors to buy diversified municipal bond exposure in a single mutual fund share", explanation: "That describes a municipal bond mutual fund, not an LGIP, which is used by government entities rather than individual retail investors as its primary participants." },
      { text: "A state to formally guarantee the timely payment of interest and principal on another municipality's revenue bonds", explanation: "That describes bond insurance or a moral obligation pledge, not an LGIP's cash-pooling function." },
      { text: "Individual investors to save specifically for qualified higher-education expenses", explanation: "That describes a 529 plan, not a local government investment pool, which serves government entities rather than individual education savers." },
    ],
  },
  // ---------------------------------------------------------------------
  // RISK TYPES
  // ---------------------------------------------------------------------
  {
    id: "sieb-pr-x119",
    section: "products-risks",
    q: "An investor holds a 7% callable corporate bond purchased several years ago. Interest rates have since fallen substantially, and the issuer calls the bond at par. The investor now faces the practical problem that:",
    a: "They must reinvest the proceeds in the current, lower-rate environment, likely earning a reduced yield going forward — reinvestment risk",
    explanation: "This scenario is the classic illustration of reinvestment risk: falling rates are exactly when issuers are most likely to call high-coupon debt, forcing the investor to redeploy the returned principal into new investments at the now-lower prevailing rates, reducing their future income stream.",
    options: [
      { text: "They must reinvest the proceeds in the current, lower-rate environment, likely earning a reduced yield going forward — reinvestment risk", explanation: "Correct - being called precisely when rates have fallen is the defining scenario of reinvestment risk." },
      { text: "They will receive less than par value for the called bond, resulting in a capital loss — credit risk", explanation: "A bond called at par returns full face value; this scenario describes no credit event or under-par redemption at all." },
      { text: "The bond's price will now rise further because rates keep falling — interest rate risk", explanation: "Once called, the bond no longer exists to appreciate; the investor's problem is what to do with the returned cash, not further price appreciation on a retired bond." },
      { text: "They cannot sell the bond because there is no secondary market buyer — liquidity risk", explanation: "The bond has already been redeemed via the call, so there is no continuing marketability concern for a security that no longer exists." },
    ],
  },
  {
    id: "sieb-pr-x120",
    section: "products-risks",
    q: "A rating agency downgrades a corporation's outstanding bonds from investment grade to below investment grade after the company reports weakening cash flow. The bond's market price subsequently falls. This price decline is best attributed to:",
    a: "Credit (default) risk — the market's reassessment of the issuer's ability to make timely interest and principal payments",
    explanation: "A downgrade reflects deteriorating perceived creditworthiness — the market now demands a higher yield (and therefore a lower price) to compensate for the increased chance of missed payments or default. This is credit risk playing out, distinct from a broad, economy-wide interest rate move.",
    options: [
      { text: "Credit (default) risk — the market's reassessment of the issuer's ability to make timely interest and principal payments", explanation: "Correct - a company-specific downgrade tied to weakening financial health is the textbook definition of credit risk materializing." },
      { text: "Interest rate risk — a broad rise in market interest rates unrelated to this specific issuer", explanation: "The price move here is tied to an issuer-specific credit event (the downgrade), not a general shift in market interest rates affecting all bonds." },
      { text: "Purchasing power (inflation) risk — a rise in the general price level eroding the bond's real return", explanation: "Nothing in this scenario involves inflation; the price decline is driven entirely by the issuer's own weakening credit profile." },
      { text: "Call risk — the issuer redeeming the bond earlier than expected", explanation: "There is no mention of the bond being called in this scenario; the price decline follows directly from the credit downgrade." },
    ],
  },
  {
    id: "sieb-pr-x121",
    section: "products-risks",
    q: "Two investors each hold a single corporate bond issue. Investor A's bond is downgraded because that specific company's earnings deteriorate. Investor B's bond, from a completely different and financially healthy issuer, falls in price the same week purely because the Federal Reserve raises interest rates broadly. Which statement correctly distinguishes the two situations?",
    a: "Investor A is experiencing unsystematic (credit) risk specific to one issuer, while Investor B is experiencing systematic (interest rate) risk affecting the whole market",
    explanation: "Unsystematic risk is company- or issuer-specific and can be reduced through diversification across issuers (Investor A's situation). Systematic risk is market-wide, driven by broad economic forces like interest rate policy, and affects virtually all securities to some degree regardless of diversification (Investor B's situation).",
    options: [
      { text: "Investor A is experiencing unsystematic (credit) risk specific to one issuer, while Investor B is experiencing systematic (interest rate) risk affecting the whole market", explanation: "Correct - one loss is diversifiable and issuer-specific, the other is a market-wide, non-diversifiable factor, which is exactly the systematic/unsystematic distinction." },
      { text: "Both investors are experiencing the same type of risk, since both bonds fell in price for reasons beyond their control", explanation: "The two situations arise from fundamentally different sources — one issuer-specific, one market-wide — and diversification only protects against one of them." },
      { text: "Investor A is experiencing systematic risk, while Investor B is experiencing unsystematic risk", explanation: "This reverses the correct classification; a single-issuer earnings problem is unsystematic, while a broad Fed rate move is systematic." },
      { text: "Neither investor is exposed to any diversifiable risk, since both are holding fixed income securities", explanation: "Investor A's loss is precisely the kind of issuer-specific, diversifiable risk that holding many different bond issuers would have reduced." },
    ],
  },
  {
    id: "sieb-pr-x122",
    section: "products-risks",
    q: "A US investor holds bonds issued by a foreign government. That government unexpectedly enacts new legislation restricting foreign investors' ability to repatriate interest payments back to their home country. This exposure is best classified as:",
    a: "Political (legislative) risk",
    explanation: "Political risk encompasses the danger that a government's legislative, regulatory, or policy actions — including capital controls, expropriation, or changes to investor rights — will adversely affect the value or usability of an investment. Restricting the flow of interest payments out of the country is a clear example of this government-action-driven risk.",
    options: [
      { text: "Political (legislative) risk", explanation: "Correct - an adverse government action targeting investors, such as restricting repatriation of payments, is the defining example of political risk." },
      { text: "Reinvestment risk", explanation: "Reinvestment risk concerns having to redeploy proceeds at a different rate, not a government restriction on moving funds across borders." },
      { text: "Call risk", explanation: "Call risk is specific to an issuer's contractual right to redeem a bond early; a government capital-control law is a separate legislative action unrelated to a call provision." },
      { text: "Liquidity risk", explanation: "Liquidity risk concerns the difficulty of selling a position quickly at a fair price, not a government restriction on repatriating payments already due." },
    ],
  },
];
