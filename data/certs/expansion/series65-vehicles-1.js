// Series 65 (Uniform Investment Adviser Law Examination) — supplemental practice question bank
// Section: Investment Vehicle Characteristics ("vehicles").
// This batch (part 1 of 3 for this section) is biased toward the FIRST slice of the topic
// scope — cash & equivalents, fixed income, and equities — favoring mechanism-level distinctions
// (yield-quoting conventions, tax treatment of premium/discount, corporate-action mechanics,
// exercise-style conventions) over definitional softballs already covered by
// data/certs/series65-bank.js and data/certs/series65-bank-vehicles.js.
//
// 22 items, ids s65-vh-x101 through s65-vh-x122.
// Same item shape: {id, section, q, a, explanation, options:[{text, explanation}]}.

export const S65_VEHICLES_X1 = [
  // ---------------------------------------------------------------------
  // CASH AND EQUIVALENTS
  // ---------------------------------------------------------------------
  {
    id: "s65-vh-x101",
    section: "vehicles",
    q: "A Eurodollar deposit is best described as:",
    a: "A U.S. dollar-denominated deposit held at a bank located outside the United States (or in an international banking facility)",
    explanation: "Eurodollars are simply dollar-denominated deposits held offshore, outside the direct regulatory reach of U.S. banking regulators. They are used heavily in international short-term financing and historically underpinned benchmarks such as LIBOR.",
    options: [
      { text: "A deposit denominated in euros held at a European bank", explanation: "Despite the name, 'Eurodollar' refers to U.S. dollars held abroad, not to the euro currency." },
      { text: "A U.S. dollar-denominated deposit held at a bank located outside the United States (or in an international banking facility)", explanation: "Correct — the defining feature is the currency (dollars) combined with the deposit's location outside direct U.S. jurisdiction." },
      { text: "A euro-denominated U.S. Treasury security", explanation: "The U.S. Treasury does not issue securities denominated in euros; this term applies to bank deposits, not Treasury issuance." },
      { text: "A deposit that is FDIC-insured regardless of location", explanation: "Eurodollar deposits, held outside the U.S. banking system, are not FDIC-insured." },
    ],
  },
  {
    id: "s65-vh-x102",
    section: "vehicles",
    q: "Treasury bills are quoted on a discount-yield basis. Compared to the bond-equivalent yield (BEY) an investor actually earns, the quoted discount yield generally:",
    a: "Understates the investor's actual yield, because the discount yield uses face value (rather than purchase price) as its base and assumes a 360-day year",
    explanation: "Discount yield divides the dollar discount by the face value and annualizes over a 360-day year, both of which produce a smaller figure than dividing by the actual (lower) purchase price over a 365-day year, so the discount yield systematically understates the investor's true return.",
    options: [
      { text: "Understates the investor's actual yield, because the discount yield uses face value (rather than purchase price) as its base and assumes a 360-day year", explanation: "Correct — using face value as the denominator and a 360-day year both push the discount yield below the bond-equivalent yield." },
      { text: "Overstates the investor's actual yield, because the discount yield uses purchase price as its base", explanation: "The discount yield uses face value, not purchase price, as its base — this reverses the actual mechanism." },
      { text: "Exactly equals the bond-equivalent yield in all cases", explanation: "The two conventions use different bases and day-count assumptions, so they are not equal except in a coincidental edge case." },
      { text: "Is irrelevant because T-bills do not trade at a discount", explanation: "T-bills are, by design, issued and traded at a discount from face value rather than paying stated coupons." },
    ],
  },
  {
    id: "s65-vh-x103",
    section: "vehicles",
    q: "An investor holding a large-denomination negotiable CD needs cash before the CD's maturity date. Because early redemption directly with the issuing bank is generally not available, the investor's most appropriate course of action is to:",
    a: "Sell the CD to another investor in the secondary market",
    explanation: "Negotiable CDs are designed to be traded, which is precisely why banks do not need to offer early redemption — liquidity is provided by the secondary market rather than by the issuer.",
    options: [
      { text: "Sell the CD to another investor in the secondary market", explanation: "Correct — negotiability means the CD can be sold to another buyer prior to maturity, providing liquidity without the issuing bank's involvement." },
      { text: "Demand redemption from the FDIC directly", explanation: "The FDIC insures deposits in the event of bank failure; it does not process early redemption requests for a solvent bank's outstanding CDs." },
      { text: "Convert the CD into a Treasury bill", explanation: "There is no mechanism to convert one instrument into another; the investor would need to sell the CD and separately purchase a T-bill." },
      { text: "Wait, because negotiable CDs cannot be transferred under any circumstances", explanation: "This is the opposite of the truth — negotiability is exactly what allows the CD to be transferred to another holder." },
    ],
  },
  {
    id: "s65-vh-x104",
    section: "vehicles",
    q: "The federal funds rate and the discount rate are both short-term interest rate benchmarks. The key distinction between them is that the federal funds rate is:",
    a: "The rate depository institutions charge one another for overnight loans of reserve balances, while the discount rate is what the Federal Reserve charges banks that borrow directly from it",
    explanation: "Fed funds transactions are interbank loans of excess reserves negotiated in the market (though heavily influenced by Fed policy targets), whereas the discount rate is set directly by the Federal Reserve for its own direct lending to depository institutions at the discount window.",
    options: [
      { text: "The rate depository institutions charge one another for overnight loans of reserve balances, while the discount rate is what the Federal Reserve charges banks that borrow directly from it", explanation: "Correct — fed funds are interbank loans; the discount rate applies specifically to direct borrowing from the Fed." },
      { text: "Set directly by Congress, while the discount rate is set by the Treasury", explanation: "Neither rate is set by Congress or the Treasury; both relate to Federal Reserve policy and banking operations." },
      { text: "Identical in every respect to the discount rate", explanation: "These are distinct rates that typically differ from one another, not identical benchmarks." },
      { text: "The rate charged on residential mortgages, while the discount rate applies to corporate loans", explanation: "Neither rate directly describes mortgage or general corporate lending; both are interbank/Federal Reserve overnight benchmarks." },
    ],
  },
  {
    id: "s65-vh-x105",
    section: "vehicles",
    q: "Many money market mutual funds have historically maintained a stable $1.00 per share NAV. This stability is achieved through:",
    a: "The amortized cost method of valuing portfolio securities, permitted for qualifying funds under SEC rules",
    explanation: "Rather than marking each security to its fluctuating market price, qualifying money market funds may value holdings using amortized cost (straight-line accretion/amortization to par), which smooths minor day-to-day price movements and supports a stable per-share price for funds that meet the applicable conditions.",
    options: [
      { text: "The amortized cost method of valuing portfolio securities, permitted for qualifying funds under SEC rules", explanation: "Correct — amortized cost accounting is the mechanism that allows a stable NAV for funds meeting the eligibility conditions." },
      { text: "A guarantee from the U.S. Treasury backing every money market fund's share price", explanation: "Money market funds are not backed by a blanket government guarantee of share price; they are not FDIC-insured or guaranteed by the Treasury." },
      { text: "A prohibition on the fund holding any security with market risk", explanation: "Money market funds still hold securities with some price sensitivity; the amortized cost method addresses valuation, not the elimination of all risk." },
      { text: "Daily capital injections from the fund's sponsor to offset any losses", explanation: "Sponsors are not required to inject capital to prop up share price; the stability comes from the accounting/valuation method and portfolio quality standards." },
    ],
  },
  {
    id: "s65-vh-x106",
    section: "vehicles",
    q: "Commercial paper is best described as:",
    a: "A short-term, unsecured promissory note issued by a corporation, backed only by the issuer's general creditworthiness",
    explanation: "Unlike a mortgage bond or equipment trust certificate, commercial paper carries no specific collateral — investors rely entirely on the issuing corporation's credit quality, which is why ratings from nationally recognized statistical rating organizations matter so much to buyers.",
    options: [
      { text: "A short-term, unsecured promissory note issued by a corporation, backed only by the issuer's general creditworthiness", explanation: "Correct — commercial paper is an unsecured obligation of the issuing corporation." },
      { text: "A secured note collateralized by a pool of the issuer's specific physical assets", explanation: "Commercial paper is unsecured; asset-backed short-term instruments are a different (asset-backed commercial paper) structure, not the standard definition." },
      { text: "A long-term bond issued to fund corporate capital expenditures", explanation: "Commercial paper is a short-term instrument typically used to fund near-term working capital needs, not long-term capital projects." },
      { text: "A deposit instrument issued by and insured through a commercial bank", explanation: "Commercial paper is issued by corporations (often outside the banking sector) and carries no deposit insurance." },
    ],
  },
  // ---------------------------------------------------------------------
  // FIXED INCOME
  // ---------------------------------------------------------------------
  {
    id: "s65-vh-x107",
    section: "vehicles",
    q: "When a bond trades between coupon payment dates in the secondary market, the buyer generally must pay the seller:",
    a: "The agreed trade price plus accrued interest earned by the seller since the last coupon payment date",
    explanation: "Accrued interest compensates the seller for interest that has accumulated during their holding period but has not yet been paid out by the issuer; the buyer pays it upfront and recoups it when the next full coupon payment arrives.",
    options: [
      { text: "The agreed trade price plus accrued interest earned by the seller since the last coupon payment date", explanation: "Correct — the buyer reimburses the seller for interest accrued but not yet paid by the issuer." },
      { text: "The agreed trade price only, with no adjustment for interest", explanation: "Ignoring accrued interest would let the buyer capture interest they did not earn, which is why it is added to the settlement amount." },
      { text: "The bond's full face value, regardless of the agreed trade price", explanation: "The buyer pays the negotiated trade price (which may be above or below face value) plus accrued interest, not automatically the face value." },
      { text: "Only the next full coupon payment, paid immediately at settlement", explanation: "Coupon payments are made by the issuer on its own schedule; the buyer instead reimburses the seller for interest accrued to date at settlement." },
    ],
  },
  {
    id: "s65-vh-x108",
    section: "vehicles",
    q: "A bond currently trades at a discount to its par value. Ranking its nominal yield (coupon rate), current yield, and yield to maturity from LOWEST to HIGHEST, the correct order is generally:",
    a: "Nominal yield, then current yield, then yield to maturity",
    explanation: "For a discount bond, current yield (coupon ÷ price) exceeds the nominal yield because the price is below par, and yield to maturity exceeds current yield because it also captures the built-in capital gain as the bond accretes to par at maturity.",
    options: [
      { text: "Nominal yield, then current yield, then yield to maturity", explanation: "Correct — each measure captures progressively more of the discount bond's total return, from stated coupon alone up through price appreciation to maturity." },
      { text: "Yield to maturity, then current yield, then nominal yield", explanation: "This reverses the actual relationship for a discount bond; yield to maturity is the highest of the three, not the lowest." },
      { text: "All three yields are always identical for any bond trading below par", explanation: "These three yield measures are equal only when a bond trades exactly at par; a discount bond produces three distinct values." },
      { text: "Current yield, then nominal yield, then yield to maturity", explanation: "Current yield is higher than nominal yield for a discount bond, not lower, since it is measured against a below-par price." },
    ],
  },
  {
    id: "s65-vh-x109",
    section: "vehicles",
    q: "Bearer bonds, once common in the U.S. corporate and municipal markets, are distinguished from registered bonds in that bearer bonds:",
    a: "Are not registered in any owner's name, and are no longer issued domestically because unregistered ownership raised significant tax-compliance concerns",
    explanation: "Ownership of a bearer bond was evidenced simply by physical possession of the certificate (with detachable coupons the holder would clip and redeem), which made ownership essentially untraceable. Federal tax law has required registration of new domestic bond issues for decades specifically to curb the tax-evasion potential of anonymous bearer ownership.",
    options: [
      { text: "Are not registered in any owner's name, and are no longer issued domestically because unregistered ownership raised significant tax-compliance concerns", explanation: "Correct — bearer bonds' anonymity is exactly why registration requirements ended their new domestic issuance." },
      { text: "Pay a higher coupon rate than an equivalent registered bond as compensation for illiquidity", explanation: "The distinguishing feature of a bearer bond is the absence of ownership registration, not a structurally mandated higher coupon." },
      { text: "Are exclusively issued by the U.S. Treasury", explanation: "Historically, bearer bonds were used across corporate and municipal markets, not solely by the Treasury." },
      { text: "Automatically convert to book-entry registered form after one year", explanation: "There is no automatic conversion mechanism; the shift away from bearer bonds occurred through a change in what could newly be issued, not automatic conversion of existing certificates." },
    ],
  },
  {
    id: "s65-vh-x110",
    section: "vehicles",
    q: "A 'double-barreled' municipal bond is best described as one that is:",
    a: "Backed both by a specific pledged revenue source and by the general taxing power (full faith and credit) of the issuing municipality",
    explanation: "This dual backing gives a double-barreled bond an added layer of security beyond a pure revenue bond: if the pledged revenue stream falls short, the issuer's general taxing authority stands behind the debt as a secondary source of repayment.",
    options: [
      { text: "Backed both by a specific pledged revenue source and by the general taxing power (full faith and credit) of the issuing municipality", explanation: "Correct — the 'double barrel' refers to two independent sources of repayment backing the same bond." },
      { text: "Issued in two separate currencies to appeal to international investors", explanation: "The term refers to the security backing the bond, not to currency denomination." },
      { text: "Backed solely by a single dedicated revenue stream with no general taxing power involved", explanation: "That describes a pure revenue bond, which is the opposite of the additional general-obligation backing a double-barreled bond provides." },
      { text: "Callable at two different dates chosen by the issuer", explanation: "The term describes the credit backing of the bond, not a call feature or redemption schedule." },
    ],
  },
  {
    id: "s65-vh-x111",
    section: "vehicles",
    q: "A municipality issues an industrial development bond (IDB) to build a facility that will be leased to a private manufacturing company. An investor evaluating this bond's default risk should focus primarily on:",
    a: "The creditworthiness of the corporate lessee, whose lease payments are the source of debt service",
    explanation: "Although an IDB is issued through a municipal conduit and carries a municipal label, the issuing municipality does not stand behind it. Debt service comes solely from the private user's lease payments, so the bond's credit quality tracks the corporation's rating rather than the municipality's. IDBs are private activity bonds, and interest on them is generally a tax-preference item for the federal alternative minimum tax.",
    options: [
      { text: "The creditworthiness of the corporate lessee, whose lease payments are the source of debt service", explanation: "Correct — the municipality acts only as a conduit issuer; repayment depends entirely on the private company's ability to make its lease payments." },
      { text: "The general taxing power and full faith and credit of the issuing municipality", explanation: "That describes a general obligation bond. A conduit issuer of an IDB pledges no taxing power and bears no repayment obligation." },
      { text: "The issuing municipality's credit rating, since the bond is a municipal security", explanation: "The municipal label reflects who issued the bond, not who repays it — an IDB's rating generally follows the corporate lessee, not the conduit municipality." },
      { text: "Nothing, because interest on an IDB is exempt from federal income tax and from the alternative minimum tax for every holder", explanation: "Tax treatment is not a substitute for credit analysis, and the premise is wrong: interest on private activity bonds such as IDBs is generally a tax-preference item for AMT purposes." },
    ],
  },
  {
    id: "s65-vh-x112",
    section: "vehicles",
    q: "Treasury STRIPS (Separate Trading of Registered Interest and Principal of Securities) are created by:",
    a: "Separating a Treasury security's individual coupon payments and principal repayment into distinct zero-coupon components that trade independently",
    explanation: "Each stripped coupon payment and the final principal repayment becomes its own zero-coupon instrument, sold at a discount and redeemed at its individual face value — while investors owe tax annually on the imputed ('phantom') income that accrues even though no cash is received until each component matures.",
    options: [
      { text: "Separating a Treasury security's individual coupon payments and principal repayment into distinct zero-coupon components that trade independently", explanation: "Correct — this stripping process produces multiple zero-coupon instruments from a single underlying Treasury security." },
      { text: "Combining several small Treasury bills into a single larger note", explanation: "STRIPS involve dividing a single security's cash flows apart, not combining multiple separate securities together." },
      { text: "Adding a floating interest rate feature to a fixed-rate Treasury bond", explanation: "STRIPS remove coupon payments entirely, creating zero-coupon instruments; they do not add a floating-rate feature." },
      { text: "Issuing a Treasury security that is exempt from all income tax", explanation: "STRIPS remain taxable; holders must report imputed annual income even though the components pay no cash until maturity." },
    ],
  },
  {
    id: "s65-vh-x113",
    section: "vehicles",
    q: "An investor purchases a municipal bond at a premium above par and holds it to maturity. Under IRS rules, the investor:",
    a: "Must amortize the premium over the bond's life, but the amortization is not deductible because the underlying municipal interest is already tax-exempt",
    explanation: "Unlike a taxable bond (where amortizing a premium reduces taxable interest income each year), premium amortization on a municipal bond is mandatory but produces no tax deduction, since the interest it would otherwise offset is not taxable in the first place — the premium simply reduces the bond's cost basis over time.",
    options: [
      { text: "Must amortize the premium over the bond's life, but the amortization is not deductible because the underlying municipal interest is already tax-exempt", explanation: "Correct — the amortization requirement still applies for basis purposes, but it yields no tax deduction on an already tax-exempt bond." },
      { text: "May deduct the full premium immediately in the year of purchase", explanation: "Premium amortization on a municipal bond is spread over the holding period, not deducted all at once, and in any case produces no deduction against exempt interest." },
      { text: "Is not required to amortize the premium at all", explanation: "Amortization of municipal bond premium is mandatory under IRS rules, even though it produces no deductible benefit." },
      { text: "Receives an additional tax credit equal to the premium paid", explanation: "There is no tax credit associated with paying a premium for a municipal bond; the premium simply reduces cost basis over time." },
    ],
  },
  {
    id: "s65-vh-x114",
    section: "vehicles",
    q: "The 'credit spread' on a corporate bond refers to:",
    a: "The additional yield investors demand over a comparable-maturity Treasury security to compensate for the corporate bond's credit risk",
    explanation: "Because Treasury securities are considered free of default risk, any additional yield a corporate (or municipal) bond offers over a matched-maturity Treasury reflects the market's assessment of that issuer's credit risk — spreads widen when perceived risk increases and narrow when confidence improves.",
    options: [
      { text: "The additional yield investors demand over a comparable-maturity Treasury security to compensate for the corporate bond's credit risk", explanation: "Correct — the credit spread isolates the compensation for default/credit risk beyond the risk-free Treasury benchmark." },
      { text: "The difference between a bond's bid and ask price quoted by a single dealer", explanation: "That describes a bid-ask spread, a measure of trading liquidity/dealer markup, not a credit-risk measure." },
      { text: "The gap between a bond's coupon rate and its call price", explanation: "That relationship concerns a bond's call feature, not the credit-risk premium embedded in its yield." },
      { text: "The difference in maturity dates between two bonds from the same issuer", explanation: "Credit spread is a yield comparison across issuers of similar risk, not a maturity-date comparison." },
    ],
  },
  // ---------------------------------------------------------------------
  // EQUITIES
  // ---------------------------------------------------------------------
  {
    id: "s65-vh-x115",
    section: "vehicles",
    q: "A corporation uses cumulative voting to elect its board of directors. This voting method, compared to statutory voting, tends to:",
    a: "Benefit minority shareholders, by allowing them to cast all of their votes for a single director candidate rather than spreading votes evenly across every open seat",
    explanation: "Under cumulative voting, a shareholder's total votes equal shares owned multiplied by the number of board seats up for election, and those votes may all be concentrated on one nominee — improving a minority bloc's odds of securing at least one board seat, unlike statutory voting where votes must be spread evenly and majority holders control every seat.",
    options: [
      { text: "Benefit minority shareholders, by allowing them to cast all of their votes for a single director candidate rather than spreading votes evenly across every open seat", explanation: "Correct — concentrating votes on one candidate gives a minority bloc a realistic path to board representation." },
      { text: "Give majority shareholders even greater control than under statutory voting", explanation: "Cumulative voting is specifically designed to counterbalance majority control, not reinforce it further." },
      { text: "Eliminate the shareholder's right to vote for individual directors entirely", explanation: "Cumulative voting still involves voting for individual director candidates — it changes how votes may be allocated, not whether shareholders vote at all." },
      { text: "Apply only to preferred shareholders, never to common shareholders", explanation: "Cumulative voting is a mechanism generally available to common shareholders electing the board, not a preferred-shareholder-only feature." },
    ],
  },
  {
    id: "s65-vh-x116",
    section: "vehicles",
    q: "The purpose of a preemptive right, when granted by a corporation's charter, is to:",
    a: "Allow existing shareholders to purchase enough of a new stock issuance to maintain their proportional ownership percentage, protecting them from dilution",
    explanation: "Without a preemptive right, a new stock offering could shrink an existing shareholder's percentage ownership and voting power; the preemptive right lets them buy their proportional share of the new issue before it is offered to outside investors.",
    options: [
      { text: "Allow existing shareholders to purchase enough of a new stock issuance to maintain their proportional ownership percentage, protecting them from dilution", explanation: "Correct — the core purpose is anti-dilution protection for existing owners." },
      { text: "Guarantee that the company will pay a dividend every year", explanation: "Preemptive rights concern participation in new share offerings, not a guarantee of dividend payments." },
      { text: "Grant shareholders a seat on the board of directors", explanation: "Board representation is determined through director elections, not through the preemptive right mechanism." },
      { text: "Require the company to buy back shares from any shareholder who requests it", explanation: "Preemptive rights relate to subscribing to new issuances, not to a mandatory company buyback obligation." },
    ],
  },
  {
    id: "s65-vh-x117",
    section: "vehicles",
    q: "When a corporation repurchases its own outstanding common shares and holds them as treasury stock, those shares:",
    a: "Carry no voting rights and receive no dividends, and are excluded from the shares-outstanding count used in per-share calculations",
    explanation: "Treasury stock is issued but no longer considered outstanding; it sits on the balance sheet as a contra-equity item, carries none of the rights of shares actually held by outside investors, and reduces the denominator used in earnings-per-share and similar per-share metrics.",
    options: [
      { text: "Carry no voting rights and receive no dividends, and are excluded from the shares-outstanding count used in per-share calculations", explanation: "Correct — treasury shares lose the rights attached to outstanding shares while they remain held by the issuer." },
      { text: "Continue to vote at shareholder meetings just as they did before repurchase", explanation: "Treasury shares specifically lose voting rights while held by the corporation itself." },
      { text: "Must be retired and canceled immediately upon repurchase", explanation: "A corporation may hold repurchased shares in treasury indefinitely, or reissue them later; immediate cancellation is not required." },
      { text: "Increase the company's total shares outstanding", explanation: "Treasury stock reduces the shares counted as outstanding — it does not add to that count." },
    ],
  },
  {
    id: "s65-vh-x118",
    section: "vehicles",
    q: "A corporation announces a tender offer to repurchase a portion of its own outstanding shares directly from shareholders, typically at a premium to the current market price. A primary reason a company undertakes such a buyback is to:",
    a: "Return capital to shareholders and reduce the number of shares outstanding, which can increase per-share metrics such as earnings per share",
    explanation: "By reducing shares outstanding, a buyback can boost per-share figures like EPS even without any change in total earnings, while also giving shareholders who tender their shares an immediate, often premium-priced, exit.",
    options: [
      { text: "Return capital to shareholders and reduce the number of shares outstanding, which can increase per-share metrics such as earnings per share", explanation: "Correct — fewer outstanding shares spread the same total earnings (or capital) over a smaller share count." },
      { text: "Increase the total number of shares outstanding to raise additional capital", explanation: "A buyback reduces shares outstanding; issuing new shares (a secondary offering) is the mechanism that raises additional capital." },
      { text: "Guarantee a permanent increase in the company's stock price", explanation: "A buyback can support the share price through reduced supply, but it is not a guarantee of any particular price outcome." },
      { text: "Convert common shareholders into bondholders", explanation: "A tender offer to repurchase shares is a cash (or securities) transaction with tendering shareholders; it does not convert remaining or tendering shareholders into bondholders." },
    ],
  },
  {
    id: "s65-vh-x119",
    section: "vehicles",
    q: "The 'par value' assigned to a share of common stock on a corporate balance sheet is best understood as:",
    a: "A nominal accounting/legal value set in the corporate charter, generally unrelated to the stock's actual market trading price",
    explanation: "Par value for common stock is largely a legal formality (often a very small or nominal figure) used in accounting for legal capital purposes; it has no bearing on what investors actually pay or receive when trading the stock in the market.",
    options: [
      { text: "A nominal accounting/legal value set in the corporate charter, generally unrelated to the stock's actual market trading price", explanation: "Correct — for common stock, par value is a bookkeeping/legal figure, not a reflection of market value." },
      { text: "The price at which the stock will always be redeemed by the issuer at maturity", explanation: "Common stock has no maturity date and is not redeemed by the issuer at a fixed value the way certain fixed-income instruments are." },
      { text: "The minimum price at which the stock may legally trade in the secondary market", explanation: "Market prices are set by supply and demand and can trade well above or below a stock's assigned par value." },
      { text: "A value that rises and falls daily along with the market price of the stock", explanation: "Par value is fixed at issuance and does not fluctuate with the stock's trading price." },
    ],
  },
  {
    id: "s65-vh-x120",
    section: "vehicles",
    q: "An order for 100 shares of stock is generally referred to as a 'round lot,' while an order for 40 shares is generally referred to as:",
    a: "An odd lot",
    explanation: "A round lot is the standard trading unit (traditionally 100 shares for most common stocks); any order in a quantity smaller than a round lot is termed an odd lot, which can sometimes involve different execution handling than round-lot orders.",
    options: [
      { text: "An odd lot", explanation: "Correct — any quantity below the standard round-lot size is classified as an odd lot." },
      { text: "A block trade", explanation: "A block trade refers to a large-quantity transaction (typically thousands of shares), the opposite end of the spectrum from a small odd-lot order." },
      { text: "A round lot", explanation: "A round lot is specifically the standard full trading unit (traditionally 100 shares); 40 shares falls short of that standard." },
      { text: "A when-issued order", explanation: "'When-issued' describes trading in a security before it has been formally issued, an unrelated concept to lot size." },
    ],
  },
  {
    id: "s65-vh-x121",
    section: "vehicles",
    q: "Securities acquired in a private placement that have not been registered with the SEC are generally considered 'restricted securities.' Before such shares may be resold into the public market under Rule 144, the holder must generally satisfy:",
    a: "A minimum holding period, along with volume and manner-of-sale limitations that apply particularly to affiliates of the issuer",
    explanation: "Rule 144 provides a path to resell otherwise-unregistered restricted securities, but only after the holder satisfies a required holding period and, especially for affiliates of the issuer, complies with limits on the volume that may be sold and how the sale is conducted.",
    options: [
      { text: "A minimum holding period, along with volume and manner-of-sale limitations that apply particularly to affiliates of the issuer", explanation: "Correct — Rule 144 conditions resale on satisfying a holding period plus, for affiliates, additional volume and sale-method restrictions." },
      { text: "Immediate SEC approval of a full registration statement before any resale", explanation: "Rule 144 exists precisely to allow resale without a full registration statement, provided its specific conditions are met." },
      { text: "No conditions at all once the securities have been held for even a single day", explanation: "Rule 144 imposes a defined minimum holding period and other conditions; a single day of holding does not satisfy them." },
      { text: "Approval by a state securities Administrator in every state where the holder resides", explanation: "Rule 144 is a federal safe harbor governing the resale of restricted securities; it does not require Administrator approval in every state of residence." },
    ],
  },
  {
    id: "s65-vh-x122",
    section: "vehicles",
    q: "Most listed U.S. equity options can be exercised by the holder at any time up to expiration, a feature known as 'American style.' This is distinguished from 'European style' options, which:",
    a: "May only be exercised at expiration, not at any point before it",
    explanation: "The 'American' versus 'European' labels refer purely to exercise timing rules, not to geography — American-style options give the holder exercise flexibility throughout the option's life, while European-style options (common for many broad-based index options) restrict exercise to the expiration date itself.",
    options: [
      { text: "May only be exercised at expiration, not at any point before it", explanation: "Correct — European-style options restrict the holder's exercise right to the expiration date." },
      { text: "Can only be traded on European exchanges", explanation: "The terms describe an exercise-timing convention, not the geographic location of the exchange on which the option trades." },
      { text: "Can be exercised at any time, exactly like American-style options", explanation: "This eliminates the actual distinction between the two styles; European-style options are specifically more restrictive on exercise timing." },
      { text: "Have no expiration date at all", explanation: "European-style options do have a defined expiration date — it is simply the only point at which exercise is permitted." },
    ],
  },
];
