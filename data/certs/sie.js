// SIE (Securities Industry Essentials) exam prep track
// Gateway exam for Series 7 / financial services roles. 75 scored questions,
// 105 minutes, ~70% to pass. Blueprint weights below drive module sizing —
// see SIE_BLUEPRINT for the four scored sections and their approximate share.

/**
 * The four scored sections of the real SIE exam and their approximate
 * weight (fraction of the 75 scored questions). Section 2 is split across
 * three of this track's modules (equity-debt, packaged-options, muni-risk)
 * because it alone is ~44% of the exam.
 * @type {Array<{id: number, title: string, weight: number, approxQuestions: number}>}
 */
export const SIE_BLUEPRINT = [
  { id: 1, title: "Knowledge of Capital Markets", weight: 0.16, approxQuestions: 12 },
  { id: 2, title: "Understanding Products and Their Risks", weight: 0.44, approxQuestions: 33 },
  { id: 3, title: "Understanding Trading, Customer Accounts and Prohibited Activities", weight: 0.31, approxQuestions: 23 },
  { id: 4, title: "Overview of Regulatory Framework", weight: 0.09, approxQuestions: 7 },
];

export const SIE_MODULES = [
  {
    id: "sie-capital-markets",
    title: "SIE: Capital Markets",
    icon: "🏛️",
    color: "#334155",
    light: "#f1f5f9",
    description: "Regulators, market structure, and the economic factors that move markets — Section 1 of the exam (~16%).",
    coopModule: "SIE Exam — Knowledge of Capital Markets (Section 1, ~16%)",
    blueprintSection: 1,
    lessons: [
      {
        id: "sie-capital-markets-1",
        title: "Regulators: SEC, FINRA, MSRB, and the Fed",
        minutes: 7,
        body: [
          "The SEC (Securities and Exchange Commission) is the federal regulator created by the Securities Exchange Act of 1934. It oversees the securities markets, enforces federal securities law, and sits above FINRA and the exchanges in the regulatory chain.",
          "FINRA (Financial Industry Regulatory Authority) is a self-regulatory organization (SRO) — not a government agency — that writes and enforces conduct rules for broker-dealers and their registered representatives. It administers the SIE and other qualification exams and runs FINRA arbitration.",
          "The MSRB (Municipal Securities Rulemaking Board) writes the rules for municipal securities dealers but has no examination or enforcement power of its own: FINRA enforces MSRB rules against broker-dealers, and bank regulators enforce them against bank dealers. The Federal Reserve sets monetary policy and margin requirements (Regulation T) — it doesn't police day-to-day broker-dealer conduct.",
        ],
        challenge: "From memory, write one sentence each for what SEC, FINRA, MSRB, and the Federal Reserve actually do — no looking back at the lesson until you've tried.",
        exampleOutput: "SEC: enforces federal securities law, oversees FINRA and the exchanges. FINRA: writes/enforces broker-dealer conduct rules and administers the SIE. MSRB: writes municipal securities rules, which FINRA and bank regulators then enforce. Federal Reserve: sets margin requirements (Reg T) and monetary policy.",
        quiz: [
          {
            q: "Which organization writes rules for municipal securities dealers but has no power to enforce them directly?",
            a: "The MSRB",
            explanation: "The MSRB is a rule-writing body only — FINRA enforces its rules against broker-dealers, and bank regulators enforce them against bank municipal dealers.",
            options: [
              { text: "The MSRB", explanation: "Correct — the MSRB writes municipal securities rules but relies on FINRA and bank regulators to enforce them." },
              { text: "FINRA", explanation: "FINRA enforces MSRB rules against broker-dealers, but it doesn't write the municipal-specific rules itself." },
              { text: "The SEC", explanation: "The SEC oversees the whole regulatory system but delegates municipal rule-writing specifically to the MSRB." },
              { text: "The Federal Reserve", explanation: "The Fed sets margin requirements and monetary policy — it has no role writing municipal securities rules." },
            ],
          },
          {
            q: "Which self-regulatory organization administers the SIE exam?",
            a: "FINRA",
            explanation: "FINRA, as the broker-dealer SRO, develops and administers the SIE along with the representative-level 'top-off' exams.",
            options: [
              { text: "FINRA", explanation: "Correct — FINRA administers the SIE and the other securities qualification exams." },
              { text: "The SEC", explanation: "The SEC is a government agency that oversees FINRA; it doesn't itself administer the SIE." },
              { text: "The MSRB", explanation: "The MSRB writes municipal rules — it doesn't administer any qualification exams." },
              { text: "The CFTC", explanation: "The CFTC regulates futures and commodities markets, an entirely separate area from the SIE." },
            ],
          },
        ],
      },
      {
        id: "sie-capital-markets-2",
        title: "Market structure: primary vs. secondary, auction vs. dealer markets",
        minutes: 7,
        body: [
          "The primary market is where new securities are sold to investors for the first time — an IPO is the classic example, and the proceeds go to the issuer. The secondary market is where already-issued securities trade between investors; the issuer isn't a party to these trades.",
          "Exchanges like the NYSE are auction markets: buyers and sellers meet and the highest bid / lowest offer wins. The Nasdaq is a dealer (OTC) market: competing market makers each post their own bid and ask and trade out of their own inventory.",
          "Two more markets show up on the exam: the third market is OTC trading of exchange-listed securities away from the exchange floor, and the fourth market is direct trading between large institutions — often via ECNs — that bypasses broker-dealers entirely.",
        ],
        challenge: "Sort these into primary vs. secondary market activity: an IPO, buying shares of an already-public company on Nasdaq, a company issuing new bonds directly to institutional buyers, a retail trade on the NYSE.",
        exampleOutput: "Primary: the IPO, the new bond issuance to institutions. Secondary: buying already-public shares on Nasdaq, the retail NYSE trade.",
        quiz: [
          {
            q: "An IPO takes place in which market?",
            a: "The primary market",
            explanation: "An IPO is the first sale of a company's shares to investors, with proceeds going to the issuer — the definition of a primary market transaction.",
            options: [
              { text: "The primary market", explanation: "Correct — new issuance to investors, with proceeds going to the issuer, is primary market activity." },
              { text: "The secondary market", explanation: "The secondary market is trading between investors after issuance — the issuer isn't a party to those trades." },
              { text: "The third market", explanation: "The third market is OTC trading of already-listed shares, not the initial sale of new shares." },
              { text: "The fourth market", explanation: "The fourth market is direct institutional trading of existing securities, not a new issuance." },
            ],
          },
          {
            q: "Nasdaq is best described as a:",
            a: "Dealer market made up of competing market makers",
            explanation: "Nasdaq has no trading floor auction; instead, multiple market makers each quote their own bid/ask and trade from their own inventory.",
            options: [
              { text: "Dealer market made up of competing market makers", explanation: "Correct — this is the defining structure of an OTC dealer market like Nasdaq." },
              { text: "Auction market with a single specialist", explanation: "That describes the traditional NYSE model, not Nasdaq's dealer structure." },
              { text: "A market exclusively for government bonds", explanation: "Nasdaq lists equities and other securities — it isn't limited to government bonds." },
              { text: "A market only for institutional investors", explanation: "Retail investors trade on Nasdaq too; it isn't institutions-only." },
            ],
          },
        ],
      },
      {
        id: "sie-capital-markets-3",
        title: "Economic indicators and monetary vs. fiscal policy",
        minutes: 6,
        body: [
          "Monetary policy is set by the Federal Reserve through the FOMC — tools like the fed funds rate target and reserve requirements control the money supply and interest rates. Fiscal policy is set by Congress and the Treasury through taxing and government spending decisions.",
          "GDP measures total economic output; the business cycle moves through expansion, peak, contraction, and trough. The CPI (Consumer Price Index) is the standard inflation gauge referenced across the exam.",
          "The yield curve plots interest rates across maturities. A normal curve slopes upward (longer maturities pay more). An inverted curve — short-term rates higher than long-term — has historically been watched as a recession signal.",
        ],
        challenge: "Explain in one sentence why an inverted yield curve worries economists, and name which body (Fed or Congress) is responsible for monetary vs. fiscal policy.",
        exampleOutput: "An inverted curve signals investors expect rates (and growth) to fall, which has historically preceded recessions. Monetary policy: the Federal Reserve. Fiscal policy: Congress/Treasury.",
        quiz: [
          {
            q: "Monetary policy is set by:",
            a: "The Federal Reserve",
            explanation: "The Fed, via the FOMC, controls the money supply and interest rate targets — the tools of monetary policy.",
            options: [
              { text: "The Federal Reserve", explanation: "Correct — the Fed's FOMC sets interest-rate targets and controls the money supply." },
              { text: "Congress", explanation: "Congress controls taxing and spending — that's fiscal policy, not monetary policy." },
              { text: "The SEC", explanation: "The SEC regulates securities markets; it has no role in setting monetary policy." },
              { text: "The President alone", explanation: "The Fed operates independently of the President in setting monetary policy." },
            ],
          },
          {
            q: "An inverted yield curve means:",
            a: "Short-term rates are higher than long-term rates",
            explanation: "Inversion is defined by short maturities yielding more than long maturities — the reverse of the normal upward-sloping curve.",
            options: [
              { text: "Short-term rates are higher than long-term rates", explanation: "Correct — this reversal from the normal curve is exactly what 'inverted' describes." },
              { text: "Long-term rates are higher than short-term rates", explanation: "That describes a normal, upward-sloping curve, not an inverted one." },
              { text: "All maturities pay the same rate", explanation: "That describes a flat yield curve, a distinct shape from an inversion." },
              { text: "Bond prices are rising across all maturities", explanation: "Yield curve shape describes the relationship between rates at different maturities, not a price trend." },
            ],
          },
        ],
      },
    ],
  },

  {
    id: "sie-equity-debt",
    title: "SIE: Equity & Debt Securities",
    icon: "💹",
    color: "#0369a1",
    light: "#f0f9ff",
    description: "Common and preferred stock, corporate and government debt, and how bonds are priced — part of Section 2 (~44% of the exam).",
    coopModule: "SIE Exam — Products and Their Risks: Equity & Debt (Section 2, ~44%)",
    blueprintSection: 2,
    lessons: [
      {
        id: "sie-equity-debt-1",
        title: "Common and preferred stock",
        minutes: 7,
        body: [
          "Common stockholders own a residual claim on the company: they're paid last in a liquidation, after every creditor and preferred shareholder, but they get voting rights and unlimited upside. Dividends on common stock are never guaranteed — the board declares them at its discretion.",
          "Preferred stock trades more like a bond: a fixed dividend rate and priority over common stock for dividends and liquidation proceeds, but usually no voting rights. Cumulative preferred means any missed dividend accumulates and must be paid before common stockholders receive anything; a missed non-cumulative preferred dividend is simply gone.",
          "Convertible preferred stock can be exchanged for a set number of common shares, trading some yield for upside if the common stock rallies. ADRs let US investors buy foreign shares (held by a custodian bank) that trade in dollars on US exchanges — but the underlying company's earnings, and the ADR's value, still move with the foreign currency.",
        ],
        challenge: "Explain the difference between cumulative and non-cumulative preferred stock, and state one risk an ADR holder still carries despite the ADR trading in US dollars.",
        exampleOutput: "Cumulative preferred: missed dividends accumulate and must be paid before common gets anything. Non-cumulative: a missed dividend is simply forfeited. ADR holders still carry currency/exchange rate risk since the underlying company earns in a foreign currency.",
        quiz: [
          {
            q: "A company skips a dividend on its cumulative preferred stock. What happens to that missed dividend?",
            a: "It accumulates and must be paid before common stockholders receive any dividend",
            explanation: "That's the defining feature of 'cumulative' — unpaid dividends stack up in arrears and must be cleared before common stockholders get paid.",
            options: [
              { text: "It accumulates and must be paid before common stockholders receive any dividend", explanation: "Correct — this arrears feature is exactly what 'cumulative' means." },
              { text: "It is forfeited permanently", explanation: "That describes non-cumulative preferred, not cumulative preferred." },
              { text: "It converts automatically into common shares", explanation: "Automatic conversion is a feature of convertible preferred stock, unrelated to a missed dividend." },
              { text: "The company must pay it immediately within 30 days", explanation: "There's no such fixed payment deadline — the dividend simply accrues until the board declares a payment." },
            ],
          },
          {
            q: "An ADR holder still bears which type of risk despite the ADR trading in US dollars?",
            a: "Currency/exchange rate risk",
            explanation: "The underlying company earns and reports in its home currency, so the ADR's value still moves with the exchange rate even though the ADR itself trades in dollars.",
            options: [
              { text: "No additional risk beyond a US stock", explanation: "This is incorrect — currency risk remains embedded in the ADR's value." },
              { text: "Currency/exchange rate risk", explanation: "Correct — the foreign company's earnings and the exchange rate both affect the ADR's dollar value." },
              { text: "Only interest rate risk", explanation: "Interest rate risk is a bond concept, not the specific risk unique to holding foreign equity via an ADR." },
              { text: "Only inflation risk", explanation: "Inflation risk isn't specific to ADRs — the risk unique to this structure is currency risk." },
            ],
          },
        ],
      },
      {
        id: "sie-equity-debt-2",
        title: "Corporate bonds: secured vs. unsecured, and the priority of claims",
        minutes: 7,
        body: [
          "A bond is a loan: the issuer promises periodic interest (the coupon) and return of face value (typically $1,000 per bond) at maturity. Secured bonds are backed by specific collateral — a mortgage bond by real property, an equipment trust certificate by equipment. Unsecured bonds, called debentures, are backed only by the issuer's general creditworthiness.",
          "Subordinated debentures explicitly rank behind other debt: in a liquidation, secured creditors are paid first, then general (unsecured) creditors/debenture holders, then subordinated debenture holders, then preferred stockholders, and common stockholders last.",
          "Corporate bonds with a call feature can be redeemed early by the issuer, typically after a call-protection period. Issuers call bonds when rates fall so they can refinance more cheaply — a direct cost to the bondholder known as call risk.",
        ],
        challenge: "Write out the full liquidation priority order from first-paid to last-paid: secured creditors, general creditors, subordinated debenture holders, preferred stock, common stock.",
        exampleOutput: "Secured creditors, then general (unsecured) creditors/debenture holders, then subordinated debenture holders, then preferred stock, then common stock last.",
        quiz: [
          {
            q: "Which of these correctly orders creditors and stockholders from first-paid to last-paid in a corporate liquidation?",
            a: "Secured creditors, general creditors, subordinated debenture holders, common stock",
            explanation: "Collateral claims are satisfied first, then general unsecured debt, then debt explicitly subordinated to it, with equity holders (common stock, the residual owners) paid last.",
            options: [
              { text: "Secured creditors, general creditors, subordinated debenture holders, common stock", explanation: "Correct — this is the standard priority of claims in a corporate liquidation." },
              { text: "General creditors, secured creditors, common stock, subordinated debenture holders", explanation: "Secured creditors are paid before general creditors, and common stock is paid last, not ahead of subordinated debt." },
              { text: "Common stock, subordinated debenture holders, general creditors, secured creditors", explanation: "This is the priority order in reverse — common stock is actually paid last, not first." },
              { text: "Subordinated debenture holders, secured creditors, general creditors, common stock", explanation: "Subordinated debt is, by definition, ranked behind general creditors — it can't be paid ahead of secured creditors." },
            ],
          },
          {
            q: "A callable bond is most likely to be called by the issuer when:",
            a: "Interest rates have fallen since issuance",
            explanation: "Falling rates let the issuer refinance the debt at a cheaper coupon, which is the financial motive behind calling a bond.",
            options: [
              { text: "Interest rates have fallen since issuance", explanation: "Correct — the issuer can refinance at a lower rate, which is why call risk rises when rates fall." },
              { text: "Interest rates have risen since issuance", explanation: "An issuer would not want to refinance at a higher rate, so calls are unlikely in this scenario." },
              { text: "The bond is about to default", explanation: "Calling a bond requires cash to redeem it early — an issuer near default is unlikely to have that cash available." },
              { text: "The stock market is volatile", explanation: "Equity market volatility isn't what drives an issuer's decision to call a bond; interest rates are." },
            ],
          },
        ],
      },
      {
        id: "sie-equity-debt-3",
        title: "Treasury and money market securities",
        minutes: 6,
        body: [
          "Treasury securities are backed by the full faith and credit of the US government and come in three main types by maturity: T-bills (one year or less, sold at a discount with no stated coupon), T-notes (2–10 years, semiannual coupon), and T-bonds (20–30 years, semiannual coupon).",
          "TIPS (Treasury Inflation-Protected Securities) adjust their principal with the CPI, so payments rise and fall with inflation — a direct hedge against purchasing-power risk.",
          "Money market instruments are short-term, high-quality debt: commercial paper (unsecured corporate IOUs, exempt from SEC registration if maturity is 270 days or less), negotiable CDs, banker's acceptances, and repurchase agreements. They're valued for safety and liquidity, not yield.",
        ],
        challenge: "Explain how a T-bill investor earns a return without receiving any coupon payments, and state the maturity threshold for commercial paper's SEC registration exemption.",
        exampleOutput: "T-bill return comes from buying at a discount to face value and receiving the full face value at maturity — the discount itself is the return. Commercial paper is exempt from SEC registration if its maturity is 270 days or less.",
        quiz: [
          {
            q: "A T-bill returns to the investor through:",
            a: "The difference between the discounted purchase price and the face value at maturity",
            explanation: "T-bills carry no stated coupon; the entire return is built into buying below face value and receiving full face value at maturity.",
            options: [
              { text: "The difference between the discounted purchase price and the face value at maturity", explanation: "Correct — this discount-to-par gap is the T-bill's entire return." },
              { text: "A semiannual coupon payment", explanation: "T-notes and T-bonds pay semiannual coupons; T-bills do not." },
              { text: "Quarterly dividends", explanation: "Dividends are an equity concept — Treasury securities don't pay dividends." },
              { text: "Capital gains only if sold on an exchange before maturity", explanation: "The T-bill's return is realized at maturity through the discount; a sale isn't required to earn it." },
            ],
          },
          {
            q: "Commercial paper is exempt from SEC registration when its maturity is:",
            a: "270 days or less",
            explanation: "This 270-day threshold is the specific cutoff that qualifies commercial paper for the registration exemption.",
            options: [
              { text: "270 days or less", explanation: "Correct — this is the maturity threshold for the exemption." },
              { text: "30 days or less", explanation: "This is far shorter than the actual 270-day threshold." },
              { text: "One year or less", explanation: "This overstates the actual cutoff, which is 270 days, not a full year." },
              { text: "There is no maturity-based exemption", explanation: "There is a specific maturity-based exemption, tied to the 270-day threshold." },
            ],
          },
        ],
      },
      {
        id: "sie-equity-debt-4",
        title: "Bond pricing, yields, and interest rate risk basics",
        minutes: 7,
        body: [
          "Bond prices and interest rates move inversely: when market rates rise, existing bonds with lower fixed coupons become less attractive, so their price falls (and vice versa). This is one of the most tested relationships on the exam.",
          "Current yield = annual coupon ÷ current market price. Yield to maturity (YTM) accounts for the coupon, the price paid, and the gain or loss if held to maturity, making it the more complete number. When a bond trades at a discount, YTM > current yield > coupon rate; at a premium, that order flips.",
          "Longer maturity (and higher duration) means more price sensitivity to rate changes — a 30-year bond's price swings much more for the same rate move than a 2-year bond's does. That sensitivity is interest rate risk.",
        ],
        challenge: "For a bond trading at a discount to par, rank coupon rate, current yield, and YTM from lowest to highest, and explain why rising market rates push existing bond prices down.",
        exampleOutput: "At a discount: coupon rate < current yield < YTM. Rising rates make new bonds more attractive at the same price, so existing lower-coupon bonds must fall in price to offer a competitive yield.",
        quiz: [
          {
            q: "A bond with a 5% coupon is trading at a discount (below par). Which ranks these correctly, low to high?",
            a: "Coupon rate < current yield < YTM",
            explanation: "A discount bond's price is below par, which pushes current yield above the coupon rate, and YTM higher still since it also captures the built-in gain to par at maturity.",
            options: [
              { text: "Coupon rate < current yield < YTM", explanation: "Correct — this is the standard ordering for a bond trading at a discount." },
              { text: "YTM < current yield < coupon rate", explanation: "This is the ordering for a PREMIUM bond, reversed — it doesn't apply to a discount bond." },
              { text: "Current yield < coupon rate < YTM", explanation: "This misorders the first two values; current yield is above the coupon rate on a discount bond, not below it." },
              { text: "All three are always equal", explanation: "The three measures are only equal when a bond trades exactly at par." },
            ],
          },
          {
            q: "If market interest rates rise, previously issued fixed-rate bond prices will:",
            a: "Fall",
            explanation: "Rising rates make newly issued bonds more attractive at the same price, so existing lower-coupon bonds must drop in price to remain competitive.",
            options: [
              { text: "Fall", explanation: "Correct — this is the inverse relationship between rates and existing bond prices." },
              { text: "Rise", explanation: "This is the wrong direction — bond prices fall, not rise, when rates rise." },
              { text: "Stay exactly the same", explanation: "Existing bond prices do move in the secondary market as rates change." },
              { text: "Only change at maturity", explanation: "Price changes happen immediately in the secondary market, not only at the maturity date." },
            ],
          },
        ],
      },
    ],
  },

  {
    id: "sie-packaged-options",
    title: "SIE: Packaged Products & Options",
    icon: "📦",
    color: "#b45309",
    light: "#fffbeb",
    description: "Mutual funds, ETFs, UITs, variable annuities, and options basics — part of Section 2 (~44% of the exam).",
    coopModule: "SIE Exam — Products and Their Risks: Packaged Products & Options (Section 2, ~44%)",
    blueprintSection: 2,
    lessons: [
      {
        id: "sie-packaged-options-1",
        title: "Mutual funds: open-end pricing and share classes",
        minutes: 7,
        body: [
          "Open-end mutual funds use forward pricing: NAV (net asset value per share) is calculated once, after the market closes, and every order that day — buy or sell — executes at that same next-computed NAV. You never know the exact execution price when you place the order.",
          "Funds continuously issue and redeem shares directly with investors at NAV — unlike a stock, there's no fixed share count and no secondary-market trading.",
          "Share classes trade off how you pay the sales charge: Class A shares charge a front-end load (reduced by breakpoint discounts for larger investments), Class B shares charge a back-end load (a contingent deferred sales charge, or CDSC, that shrinks over time and usually converts to Class A after several years), and Class C shares charge a level annual load with no front- or back-end charge and typically no conversion.",
        ],
        challenge: "Explain forward pricing in one sentence, and describe the sales-charge structure for each of Class A, B, and C mutual fund shares.",
        exampleOutput: "Forward pricing: every order executes at the next NAV computed after market close, not the price at the moment of the order. Class A: front-end load with breakpoints. Class B: back-end CDSC that declines over time, later converts to A. Class C: level annual load, no conversion.",
        quiz: [
          {
            q: "An investor places a mutual fund buy order at 2pm. At what price does it execute?",
            a: "The next NAV calculated after market close that day",
            explanation: "Forward pricing means every order takes the next NAV computed after the close — never a price known in advance.",
            options: [
              { text: "The next NAV calculated after market close that day", explanation: "Correct — this is exactly what forward pricing means." },
              { text: "The NAV from the previous day's close", explanation: "Forward pricing uses the NEXT computed NAV, not a stale prior-day figure." },
              { text: "The price at the moment the order was placed", explanation: "Mutual funds aren't priced continuously intraday like stocks, so there's no such live execution price." },
              { text: "Whatever price the fund manager sets manually", explanation: "NAV is calculated by a set formula (assets minus liabilities, divided by shares outstanding), not chosen manually by the manager." },
            ],
          },
          {
            q: "A large purchase into Class A shares typically qualifies for:",
            a: "A breakpoint discount reducing the front-end sales charge",
            explanation: "Breakpoints are volume discounts built into Class A's front-end load schedule — larger investments pay a lower percentage charge.",
            options: [
              { text: "A breakpoint discount reducing the front-end sales charge", explanation: "Correct — breakpoints reduce the Class A front-end load at higher investment amounts." },
              { text: "A CDSC that declines over time", explanation: "A declining CDSC is a Class B feature, not something Class A purchases trigger." },
              { text: "A conversion to Class C shares", explanation: "There is no conversion path from Class A into Class C." },
              { text: "No sales charge at all regardless of size", explanation: "Breakpoints reduce the front-end load; they don't eliminate it for every large purchase." },
            ],
          },
        ],
      },
      {
        id: "sie-packaged-options-2",
        title: "Closed-end funds, UITs, and ETFs",
        minutes: 7,
        body: [
          "A closed-end fund raises money once through an IPO, issues a fixed number of shares, and then those shares trade on an exchange like a stock — meaning the market price can sit at a premium or discount to the fund's actual NAV, driven by supply and demand.",
          "A UIT (unit investment trust) holds a fixed, unmanaged portfolio, has a set termination date, and issues redeemable units — closer to a mutual fund in structure but without a manager actively trading the holdings.",
          "ETFs trade continuously on an exchange throughout the day like a stock, with prices moving in real time — unlike a mutual fund's once-daily NAV pricing. Large institutional authorized participants create and redeem ETF shares in kind, which keeps the market price closely tied to NAV and generally makes ETFs more tax-efficient than mutual funds.",
        ],
        challenge: "Explain why a closed-end fund's market price can diverge from its NAV, while an ETF's price generally stays close to its NAV.",
        exampleOutput: "A closed-end fund has a fixed share count trading purely on exchange supply and demand, so price can drift to a premium or discount versus NAV. An ETF's in-kind creation/redemption by authorized participants arbitrages away most gaps between price and NAV.",
        quiz: [
          {
            q: "Which of these can trade at a premium or discount to its NAV?",
            a: "A closed-end fund",
            explanation: "Because a closed-end fund's shares trade on an exchange with a fixed share count, market price is set by supply and demand and can diverge from NAV.",
            options: [
              { text: "A closed-end fund", explanation: "Correct — its fixed share count and exchange trading allow price to drift from NAV." },
              { text: "An open-end mutual fund", explanation: "Open-end funds always transact directly at NAV, with no premium or discount." },
              { text: "A UIT at initial offering", explanation: "A UIT's units are priced at the initial offering rather than trading at a market-driven premium or discount the way a closed-end fund does." },
              { text: "A bank CD", explanation: "A CD isn't a fund and has no NAV concept at all." },
            ],
          },
          {
            q: "What allows an ETF's market price to stay closely aligned with its NAV throughout the day?",
            a: "In-kind creation and redemption by authorized participants",
            explanation: "Authorized participants can create or redeem large blocks of ETF shares for the underlying securities, arbitraging away any meaningful gap between market price and NAV.",
            options: [
              { text: "In-kind creation and redemption by authorized participants", explanation: "Correct — this arbitrage mechanism keeps ETF price and NAV closely aligned intraday." },
              { text: "Once-daily forward pricing", explanation: "That's the mutual fund pricing mechanism — it's the opposite of what gives ETFs intraday price alignment." },
              { text: "A fixed share count set at IPO", explanation: "A fixed share count describes closed-end funds and, alone, would not keep price tied to NAV." },
              { text: "A government guarantee on ETF pricing", explanation: "No such government guarantee exists for ETF pricing." },
            ],
          },
        ],
      },
      {
        id: "sie-packaged-options-3",
        title: "Options basics: calls, puts, and the four positions",
        minutes: 8,
        body: [
          "An option is a contract for 100 shares (standard) giving the buyer a right — not an obligation — to either buy (call) or sell (put) the underlying at a fixed strike price before expiration. The seller (writer) takes on the obligation if the buyer exercises.",
          "Four basic positions: long call (bullish, max loss = premium paid, unlimited upside), short call (bearish/neutral, max gain = premium received, theoretically unlimited loss), long put (bearish, max loss = premium paid, large but capped gain), short put (bullish/neutral, max gain = premium received, large but capped loss down to the strike).",
          "Breakeven for a long call = strike + premium paid. Breakeven for a long put = strike − premium paid. The Options Clearing Corporation (OCC) is the actual issuer and guarantor behind every listed option contract, so a buyer's counterparty risk runs to the OCC, not the individual seller.",
        ],
        challenge: "For a long call with strike $50 and premium $3, state the breakeven price and the maximum possible loss. Then do the same for a long put with strike $40 and premium $2.",
        exampleOutput: "Long call: breakeven $53 (strike + premium), max loss $3/share (the premium). Long put: breakeven $38 (strike − premium), max loss $2/share (the premium).",
        quiz: [
          {
            q: "An investor buys one call option, strike $50, premium $3. What is the maximum possible loss?",
            a: "$300 (the premium paid)",
            explanation: "A long option's risk is capped at the premium paid — $3 per share on a 100-share contract is $300 total.",
            options: [
              { text: "$300 (the premium paid)", explanation: "Correct — the buyer's maximum loss on a long option is always the premium paid." },
              { text: "$5,000 (the full contract value)", explanation: "The buyer's risk is capped at the premium; it is not exposed to the full value of the 100 underlying shares." },
              { text: "Unlimited", explanation: "Unlimited loss potential describes the SELLER of an uncovered (naked) call, not the buyer of a call." },
              { text: "$0 — options can't lose money", explanation: "The premium paid is fully at risk if the option expires worthless, so a total loss of the premium is possible." },
            ],
          },
          {
            q: "Who guarantees performance on a listed options contract?",
            a: "The Options Clearing Corporation (OCC)",
            explanation: "The OCC interposes itself as the issuer and counterparty on every listed option, so the buyer isn't relying on any one specific seller.",
            options: [
              { text: "The Options Clearing Corporation (OCC)", explanation: "Correct — the OCC is the actual issuer and guarantor of every listed option contract." },
              { text: "The buyer's brokerage firm alone", explanation: "The brokerage firm facilitates the trade, but the OCC is the entity that actually guarantees the contract." },
              { text: "The SEC", explanation: "The SEC regulates the options markets broadly but is not the counterparty guaranteeing individual contracts." },
              { text: "The original option seller directly", explanation: "The OCC interposes itself between buyer and seller specifically so the buyer isn't exposed to one individual seller's default." },
            ],
          },
        ],
      },
      {
        id: "sie-packaged-options-4",
        title: "Variable annuities and hedging with options",
        minutes: 7,
        body: [
          "A variable annuity is an insurance/securities hybrid: premiums go into a separate account invested in subaccounts (similar to mutual funds), so the payout depends on investment performance rather than a fixed rate. Because performance is at risk, variable annuities are securities and require both a securities registration and an insurance license to sell.",
          "There are two phases: the accumulation phase (contributions grow tax-deferred) and the annuitization/payout phase (the contract converts to a stream of payments). Surrender charges typically apply on early withdrawal, declining over a set number of years.",
          "Options are commonly used defensively, not just speculatively: buying a protective put on a stock you own caps your downside at the strike (minus the premium) while keeping unlimited upside — a classic hedge for a concentrated stock position.",
        ],
        challenge: "Explain why a variable annuity needs a securities registration in addition to an insurance license, and describe what a protective put does for an investor who already owns 100 shares.",
        exampleOutput: "A variable annuity's payout depends on subaccount investment performance, making it a security in addition to an insurance product — hence the dual licensing requirement. A protective put caps the downside on the owned shares at the strike price (minus premium) while leaving upside uncapped.",
        quiz: [
          {
            q: "Why does selling a variable annuity require a securities registration in addition to an insurance license?",
            a: "Because the payout depends on the performance of subaccount investments, making it a security",
            explanation: "The variable feature — payout tied to investment performance rather than a guaranteed fixed rate — is exactly what makes the product a security requiring dual licensing.",
            options: [
              { text: "Because the payout depends on the performance of subaccount investments, making it a security", explanation: "Correct — the investment-performance-linked payout is what triggers the securities registration requirement." },
              { text: "Because all annuities are securities", explanation: "Fixed annuities are NOT securities — it's specifically the variable feature that creates the securities registration requirement." },
              { text: "Because it is sold by broker-dealers only", explanation: "Insurance company agents can sell variable annuities too, provided they also hold the required securities registration." },
              { text: "It doesn't — only an insurance license is needed", explanation: "This is incorrect; the variable, investment-linked payout specifically requires a securities registration as well." },
            ],
          },
          {
            q: "An investor owns 100 shares and buys a protective put to hedge. This strategy:",
            a: "Caps the downside at the strike price (minus premium) while preserving upside",
            explanation: "The long put gives the investor the right to sell at the strike no matter how far the stock falls, while the owned shares still capture any gains above that.",
            options: [
              { text: "Caps the downside at the strike price (minus premium) while preserving upside", explanation: "Correct — this is exactly what a protective put accomplishes for a stock owner." },
              { text: "Caps both the upside and the downside", explanation: "A protective put doesn't limit gains on the owned shares — only the downside is capped." },
              { text: "Eliminates the premium cost", explanation: "The premium is the cost the investor pays for the protection; it isn't eliminated by the strategy." },
              { text: "Obligates the investor to sell the shares immediately", explanation: "A long put is a right, not an obligation, and buying it creates no forced or immediate sale." },
            ],
          },
        ],
      },
    ],
  },

  {
    id: "sie-muni-risk",
    title: "SIE: Municipal Securities & Investment Risk",
    icon: "🏙️",
    color: "#166534",
    light: "#f0fdf4",
    description: "GO vs. revenue bonds, tax treatment, and the risk types the exam tests most — the remainder of Section 2 (~44% of the exam).",
    coopModule: "SIE Exam — Products and Their Risks: Municipal Securities & Risk (Section 2, ~44%)",
    blueprintSection: 2,
    lessons: [
      {
        id: "sie-muni-risk-1",
        title: "Municipal bonds: GO vs. revenue, and tax treatment",
        minutes: 7,
        body: [
          "General obligation (GO) bonds are backed by the issuer's full faith, credit, and taxing power, typically requiring voter approval since they pledge tax revenue. Revenue bonds are backed only by the revenue from a specific project — a toll road, a water utility — so no taxing power stands behind them, making them generally riskier than GOs from the same issuer.",
          "Municipal bond interest is exempt from federal income tax, and often from state (and sometimes local) tax if the investor lives in the issuing state — the classic 'triple exempt' bond. Capital gains on munis, however, are fully taxable — the exemption applies only to interest income.",
          "Because of the tax exemption, munis are compared to taxable bonds using the taxable-equivalent yield formula: muni yield ÷ (1 − investor's tax rate). A higher tax bracket makes a given muni yield equivalent to a larger taxable yield.",
        ],
        challenge: "An investor in the 24% tax bracket is offered a 3% municipal bond. Compute the taxable-equivalent yield, and explain in one sentence why capital gains on munis don't get the same tax treatment as the interest.",
        exampleOutput: "Taxable-equivalent yield = 3 / (1 − 0.24) = 3 / 0.76 ≈ 3.95%. Capital gains are fully taxable because the federal exemption applies only to the interest income, not to any gain from selling the bond above its cost basis.",
        quiz: [
          {
            q: "A revenue bond is backed by:",
            a: "Revenue generated by a specific project",
            explanation: "Revenue bonds rely on the cash flow from the specific project they fund — not on any taxing power.",
            options: [
              { text: "Revenue generated by a specific project", explanation: "Correct — this project-specific revenue stream is the definition of a revenue bond." },
              { text: "The issuer's general taxing power", explanation: "That describes a general obligation (GO) bond, not a revenue bond." },
              { text: "A federal government guarantee", explanation: "Municipal bonds, including revenue bonds, are not federally guaranteed." },
              { text: "The MSRB", explanation: "The MSRB is a rule-writing regulator, not a source of repayment for any bond." },
            ],
          },
          {
            q: "An investor in the 32% tax bracket is comparing a 4% municipal bond to a taxable bond. The muni's taxable-equivalent yield is closest to:",
            a: "About 5.9%",
            explanation: "Taxable-equivalent yield = 4 ÷ (1 − 0.32) = 4 ÷ 0.68 ≈ 5.88%, which rounds to about 5.9%.",
            options: [
              { text: "About 5.9%", explanation: "Correct — 4 divided by 0.68 is approximately 5.88%." },
              { text: "4%", explanation: "This ignores the tax benefit of the muni entirely — it's just the stated coupon rate." },
              { text: "About 2.7%", explanation: "This wrongly multiplies by (1 − tax rate) instead of dividing by it, inverting the formula." },
              { text: "About 12.5%", explanation: "This is far too high and doesn't result from correctly applying the taxable-equivalent yield formula." },
            ],
          },
        ],
      },
      {
        id: "sie-muni-risk-2",
        title: "Systematic vs. unsystematic risk",
        minutes: 6,
        body: [
          "Systematic (market) risk affects the entire market or asset class and cannot be diversified away — interest rate risk, inflation/purchasing power risk, reinvestment risk, currency risk, and political/regulatory risk all fall here.",
          "Unsystematic (issuer-specific) risk CAN be reduced through diversification — business risk, credit/default risk, liquidity risk of a specific security, and call risk of a specific bond are all tied to an individual issuer or security rather than the whole market.",
          "The fast rule the exam rewards: if diversifying across many issuers reduces the risk, it's unsystematic; if it doesn't (because it hits everything at once), it's systematic.",
        ],
        challenge: "For each of these, label systematic or unsystematic: interest rate risk, a single bond issuer defaulting, inflation eroding fixed payments, one bond being called early.",
        exampleOutput: "Interest rate risk: systematic. A single issuer defaulting: unsystematic (credit risk). Inflation eroding fixed payments: systematic (purchasing power risk). One bond being called early: unsystematic (call risk).",
        quiz: [
          {
            q: "Which risk CANNOT be reduced by diversifying across many different bond issuers?",
            a: "Interest rate risk",
            explanation: "Rising rates push down prices on virtually all fixed-rate bonds at once, so spreading holdings across issuers doesn't blunt this systematic risk.",
            options: [
              { text: "Interest rate risk", explanation: "Correct — this is a systematic risk that hits the whole bond market together, regardless of issuer diversification." },
              { text: "Credit/default risk", explanation: "Diversifying across many issuers directly reduces the impact of any single issuer defaulting." },
              { text: "Business risk", explanation: "Business risk is issuer-specific and is reduced by holding a diversified mix of issuers." },
              { text: "Liquidity risk of one specific bond", explanation: "This risk is tied to that one issue; holding a diversified mix reduces its overall portfolio impact." },
            ],
          },
          {
            q: "Call risk is best classified as:",
            a: "Unsystematic — specific to bonds with a call feature",
            explanation: "Only callable bonds carry this risk, and it can be diversified down by holding a mix of callable and non-callable issues — the hallmark of an unsystematic risk.",
            options: [
              { text: "Unsystematic — specific to bonds with a call feature", explanation: "Correct — only callable issues carry this risk, and diversification reduces its portfolio impact." },
              { text: "Systematic — affects the entire market equally", explanation: "Call risk doesn't hit the whole market; it's confined to bonds with a call feature." },
              { text: "Unrelated to fixed income", explanation: "Call risk is specifically a fixed-income concept tied to callable bonds." },
              { text: "The same thing as interest rate risk", explanation: "The two are related (issuers call when rates fall) but they are distinct risk types — one is issuer/security-specific, the other is market-wide." },
            ],
          },
        ],
      },
      {
        id: "sie-muni-risk-3",
        title: "The seven risk types the SIE tests",
        minutes: 7,
        body: [
          "Interest rate risk: bond prices fall when rates rise; longer maturity/duration means more exposure. Reinvestment risk: cash flows must be reinvested at a lower rate than the original investment — zero-coupon bonds have no reinvestment risk since there are no periodic payments to reinvest, while high-coupon and callable bonds carry more.",
          "Credit/default risk: the issuer may not pay interest or principal, rated by agencies like Moody's and S&P, with 'investment grade' (BBB-/Baa3 and above) versus 'high yield/junk' (BB+/Ba1 and below) as the key dividing line. Liquidity risk: you can't sell a position quickly without a meaningful price concession.",
          "Purchasing power (inflation) risk: fixed payments buy less over time as prices rise, hitting long-term fixed-rate bonds hardest. Political/regulatory risk: government action changes a security's value, most relevant for foreign holdings. Currency/exchange rate risk: returns on foreign-currency-denominated investments swing with the exchange rate, independent of local performance.",
        ],
        challenge: "Name the risk type in each scenario: a zero-coupon bond's investor never has to reinvest a coupon; a bond rated BB+ carries meaningfully more default exposure than one rated A; a thinly-traded muni can't be sold quickly at a fair price.",
        exampleOutput: "Zero-coupon / no reinvestment: this illustrates reinvestment risk (or its absence). BB+ vs. A rating: credit/default risk. Thinly-traded muni: liquidity risk.",
        quiz: [
          {
            q: "A zero-coupon bond has no exposure to which risk?",
            a: "Reinvestment risk",
            explanation: "With no periodic coupon payments to reinvest, there's nothing to reinvest at a lower rate — eliminating reinvestment risk specifically.",
            options: [
              { text: "Reinvestment risk", explanation: "Correct — no periodic payments means nothing needs to be reinvested." },
              { text: "Interest rate risk", explanation: "Zero-coupon bonds are actually MORE sensitive to rate changes (due to their long duration), not less." },
              { text: "Credit risk", explanation: "The issuer can still default on a zero-coupon bond, so credit risk remains." },
              { text: "Inflation risk", explanation: "The bond's fixed payoff still loses real purchasing power to inflation, so this risk remains." },
            ],
          },
          {
            q: "A bond rated BB+ by S&P is considered:",
            a: "High yield / junk (below investment grade)",
            explanation: "Investment grade starts at BBB-; BB+ sits one full notch below that cutoff, placing it in the high-yield/junk category.",
            options: [
              { text: "High yield / junk (below investment grade)", explanation: "Correct — BB+ is just below the BBB- investment-grade cutoff." },
              { text: "Investment grade", explanation: "Investment grade begins at BBB-, one notch above BB+." },
              { text: "In default", explanation: "A low credit rating reflects elevated default risk, but it is not the same as an issuer actually being in default." },
              { text: "Risk-free", explanation: "Junk-rated bonds carry meaningfully more default risk than investment-grade bonds — the opposite of risk-free." },
            ],
          },
        ],
      },
    ],
  },

  {
    id: "sie-trading-accounts",
    title: "SIE: Trading, Customer Accounts & Prohibited Activities",
    icon: "🔁",
    color: "#7c2d12",
    light: "#fff7ed",
    description: "Order types, T+1 settlement, margin accounts, and the activities that get reps barred — Section 3 (~31% of the exam).",
    coopModule: "SIE Exam — Trading, Customer Accounts and Prohibited Activities (Section 3, ~31%)",
    blueprintSection: 3,
    lessons: [
      {
        id: "sie-trading-accounts-1",
        title: "Order types: market, limit, stop, stop-limit",
        minutes: 7,
        body: [
          "A market order executes immediately at the best available price — guaranteed execution, not price. A limit order guarantees a price (or better) but not execution; it may never fill if the market doesn't reach the limit.",
          "A stop order (stop-loss) sits dormant until the stock trades at or through the stop price, at which point it becomes a market order — guaranteed to execute once triggered, but not at any specific price. A stop-limit order becomes a limit order once triggered, adding a price guarantee back at the cost of possibly not executing at all if the price moves past the limit too quickly.",
          "Day orders expire automatically at the end of the trading day if unfilled. GTC (good-til-canceled) orders remain working until filled or canceled, subject to the firm's own periodic clean-up policies.",
        ],
        challenge: "Explain the difference between a stop order and a stop-limit order once each is triggered, and state which order type guarantees execution but not price.",
        exampleOutput: "A triggered stop order becomes a market order (guaranteed execution, no price guarantee). A triggered stop-limit order becomes a limit order (price guarantee, execution not guaranteed). Market orders guarantee execution but not price.",
        quiz: [
          {
            q: "Which order type guarantees execution but not price?",
            a: "A market order",
            explanation: "A market order fills immediately at whatever the best available price is — guaranteed to execute, with no price protection.",
            options: [
              { text: "A market order", explanation: "Correct — market orders guarantee execution, not a specific price." },
              { text: "A limit order", explanation: "A limit order guarantees a price (or better) but does not guarantee that it will execute at all." },
              { text: "A stop-limit order", explanation: "Once triggered, a stop-limit order becomes a limit order, so execution is not guaranteed." },
              { text: "A GTC order", explanation: "GTC describes how long an order remains working, not whether it's guaranteed to execute." },
            ],
          },
          {
            q: "A stop order, once triggered, becomes a:",
            a: "Market order",
            explanation: "Reaching the stop price converts the order into an ordinary market order, executing at the next available price.",
            options: [
              { text: "Market order", explanation: "Correct — a triggered stop order becomes a market order." },
              { text: "Limit order", explanation: "That's what a stop-LIMIT order becomes when triggered, not a plain stop order." },
              { text: "Day order", explanation: "Day/GTC describes order duration, not what a triggered stop order converts into." },
              { text: "Cancelled order", explanation: "Triggering activates the order for execution; it does not cancel it." },
            ],
          },
        ],
      },
      {
        id: "sie-trading-accounts-2",
        title: "Settlement: T+1 and how trades clear",
        minutes: 6,
        body: [
          "Since May 28, 2024, regular-way settlement for most securities — stocks, corporate bonds, and municipal bonds — is T+1: one business day after the trade date. This replaced the prior T+2 standard and brought equities, munis, and corporates in line with options, which already settled T+1.",
          "Settlement is when the buyer must have paid and the seller must have delivered the security — distinct from the trade date, when price and terms are locked in.",
          "Failure to settle on time creates real consequences: a customer who doesn't pay for a purchase in a cash account can have the position liquidated, and a firm that fails to deliver securities it sold can face a buy-in.",
        ],
        challenge: "A customer buys stock on a Monday with no holidays that week. State the exact settlement date under current rules, and name what changed about US settlement in May 2024.",
        exampleOutput: "Settlement is Tuesday (T+1). In May 2024, regular-way settlement for stocks, corporate bonds, and munis moved from T+2 to T+1, aligning with options which were already T+1.",
        quiz: [
          {
            q: "A customer buys 100 shares of stock on Monday. Under regular-way settlement, when must payment/delivery occur (assuming no holidays)?",
            a: "Tuesday (T+1)",
            explanation: "Regular-way settlement for equities is one business day after the trade date under the current T+1 standard.",
            options: [
              { text: "Tuesday (T+1)", explanation: "Correct — this is the current regular-way settlement standard." },
              { text: "Wednesday (T+2)", explanation: "T+2 was the prior standard, replaced by T+1 in May 2024." },
              { text: "Monday, same day", explanation: "Settlement is one business day after the trade date, not same-day, under regular-way T+1." },
              { text: "Friday (T+5)", explanation: "This is far longer than the current T+1 standard." },
            ],
          },
          {
            q: "What changed about US securities settlement in May 2024?",
            a: "Regular-way settlement for stocks, corporate bonds, and munis moved from T+2 to T+1",
            explanation: "This was a broad industry-wide shift shortening the standard settlement cycle for these securities, matching what options already used.",
            options: [
              { text: "Regular-way settlement for stocks, corporate bonds, and munis moved from T+2 to T+1", explanation: "Correct — this is exactly what changed in May 2024." },
              { text: "Options moved from T+1 to T+2", explanation: "This has it backwards — options were already T+1 and stayed there while other products shortened to match." },
              { text: "All settlement became instant (T+0)", explanation: "The change adopted T+1, not instant same-day settlement." },
              { text: "Nothing changed — settlement has always been T+1", explanation: "T+2 was the prior standard for equities, corporates, and munis before this specific 2024 change." },
            ],
          },
        ],
      },
      {
        id: "sie-trading-accounts-3",
        title: "Account types: cash vs. margin, Reg T, and maintenance requirements",
        minutes: 7,
        body: [
          "A cash account requires full payment for purchases — no borrowing. A margin account lets the customer borrow part of the purchase price from the broker-dealer, using securities as collateral, and pay interest on the loan.",
          "Regulation T, set by the Federal Reserve, sets the initial margin requirement at 50% — a customer must deposit at least half the purchase price when buying on margin. After that, FINRA sets the ongoing maintenance requirement: 25% of current market value for a long margin position (firms can and often do set higher 'house' requirements).",
          "If account equity falls below the maintenance requirement, the firm issues a maintenance call demanding more cash or securities; failure to meet it can result in the firm liquidating positions without further notice. Short margin accounts carry their own, generally higher, maintenance requirements since short positions carry theoretically unlimited risk.",
        ],
        challenge: "State the Reg T initial margin percentage and the FINRA maintenance margin percentage for a long position, and explain what happens if an account's equity falls below the maintenance level.",
        exampleOutput: "Reg T initial margin: 50%. FINRA maintenance margin (long): 25% of current market value. If equity falls below that, the firm issues a maintenance call, and if it isn't met, the firm can liquidate positions without further notice.",
        quiz: [
          {
            q: "Regulation T sets which margin requirement, and at what level?",
            a: "The initial margin requirement, at 50%",
            explanation: "Reg T is the Federal Reserve rule governing how much of a purchase must be paid for upfront when buying on margin.",
            options: [
              { text: "The initial margin requirement, at 50%", explanation: "Correct — Reg T sets the initial margin requirement at 50%." },
              { text: "The maintenance requirement, at 25%", explanation: "The 25% maintenance requirement is a FINRA rule, not something Reg T establishes." },
              { text: "The initial requirement, at 25%", explanation: "The percentage is wrong — Reg T's initial requirement is 50%, not 25%." },
              { text: "There is no set percentage — it's decided case by case", explanation: "Reg T sets a fixed, uniform 50% initial requirement, not a case-by-case figure." },
            ],
          },
          {
            q: "FINRA's minimum maintenance margin requirement for a long margin position is:",
            a: "25% of current market value",
            explanation: "This is the ongoing minimum equity level FINRA requires for a long margin position, distinct from Reg T's initial 50% requirement.",
            options: [
              { text: "25% of current market value", explanation: "Correct — this is the FINRA maintenance minimum for a long position." },
              { text: "50% of current market value", explanation: "That's the Reg T INITIAL requirement, not the ongoing FINRA maintenance level." },
              { text: "10% of current market value", explanation: "This is lower than the actual FINRA standard of 25%." },
              { text: "100% of current market value", explanation: "That would mean no leverage at all, defeating the purpose of a margin account." },
            ],
          },
        ],
      },
      {
        id: "sie-trading-accounts-4",
        title: "Prohibited activities: insider trading, manipulation, churning",
        minutes: 7,
        body: [
          "Insider trading means trading (or tipping someone else to trade) on material, non-public information — information significant enough to affect an investment decision that hasn't been made public. It's illegal regardless of whether the trader works at the company.",
          "Market manipulation covers a family of prohibited practices designed to create a false picture of trading activity: wash trades (buying and selling the same security with no real change in ownership to fake volume), matched orders (coordinating buy and sell orders between parties to move the price), and painting the tape (a pattern of trades meant to make a security look more active than it is).",
          "Churning is excessive trading in a customer's account by a registered rep who controls it, done primarily to generate commissions rather than serve the customer's objectives — a suitability violation. Related prohibited acts: front-running (trading ahead of a customer's known pending order), unauthorized trading, and guaranteeing a customer against loss.",
        ],
        challenge: "Distinguish churning from front-running in one sentence each, and name one market-manipulation tactic that creates fake trading volume.",
        exampleOutput: "Churning: excessive trading in a controlled customer account mainly to generate commissions. Front-running: trading ahead of a customer's known pending order using that advance knowledge. Wash trading creates fake volume with no real change in ownership.",
        quiz: [
          {
            q: "A registered rep trades excessively in a customer's discretionary account mainly to generate commissions. This is:",
            a: "Churning",
            explanation: "Excessive, commission-driven trading in an account the rep controls, without regard to the customer's objectives, is the textbook definition of churning.",
            options: [
              { text: "Churning", explanation: "Correct — this is exactly the churning definition: excessive trading for commissions in a controlled account." },
              { text: "Front-running", explanation: "Front-running is trading ahead of a specific known pending order, a different violation from repeated excessive trading for commissions." },
              { text: "Insider trading", explanation: "No non-public information is involved here — the violation is about excessive trading volume, not information misuse." },
              { text: "A normal exercise of discretion", explanation: "Trading excessively and primarily to generate commissions crosses into a clear churning violation, not ordinary discretionary management." },
            ],
          },
          {
            q: "A trader coordinates with another party to place matching buy and sell orders, creating the appearance of active trading with no real change in ownership. This is:",
            a: "Market manipulation (matched orders / wash trading)",
            explanation: "Coordinating trades purely to fabricate the appearance of volume or price movement is a classic market manipulation tactic.",
            options: [
              { text: "Market manipulation (matched orders / wash trading)", explanation: "Correct — coordinated trades designed to fake volume or move price are a manipulation tactic." },
              { text: "Legitimate market making", explanation: "Real market makers don't coordinate fake trades between parties to fabricate volume." },
              { text: "Churning", explanation: "Churning involves excessive trading in a customer's account for commissions, not coordinated fake trades between two parties." },
              { text: "Insider trading", explanation: "No non-public information is described here — the violation is the artificial trading activity itself." },
            ],
          },
        ],
      },
    ],
  },

  {
    id: "sie-regulatory",
    title: "SIE: Regulatory Framework",
    icon: "📋",
    color: "#4c1d95",
    light: "#f5f3ff",
    description: "SROs, registration (Form U4/U5), reportable events, and continuing education — Section 4 (~9% of the exam).",
    coopModule: "SIE Exam — Overview of Regulatory Framework (Section 4, ~9%)",
    blueprintSection: 4,
    lessons: [
      {
        id: "sie-regulatory-1",
        title: "SROs and the registration process (Form U4/U5)",
        minutes: 6,
        body: [
          "To act as a registered representative, an individual must pass the SIE plus at least one representative-level 'top-off' exam (like the Series 7), and be sponsored by a FINRA member firm — you can't register on your own without a sponsoring broker-dealer.",
          "Form U4 (Uniform Application for Securities Industry Registration) is the application filed to register a rep with FINRA and the states — it discloses employment history, disciplinary history, and other background information, and must be amended as circumstances change.",
          "Form U5 is the termination notice a firm files within 30 days of a rep leaving, stating the reason for termination — this becomes part of the rep's public record on FINRA BrokerCheck.",
        ],
        challenge: "State which form registers a rep, which form reports a termination, and the filing deadline for the termination form.",
        exampleOutput: "Form U4 registers a rep. Form U5 reports a termination and must be filed within 30 days of the rep leaving.",
        quiz: [
          {
            q: "Which form is filed to register an individual as a representative with FINRA?",
            a: "Form U4",
            explanation: "Form U4 is the individual registration application disclosing employment and disciplinary history.",
            options: [
              { text: "Form U4", explanation: "Correct — this is the individual representative registration form." },
              { text: "Form U5", explanation: "Form U5 is the termination notice, filed when someone LEAVES, not when they register." },
              { text: "Form BD", explanation: "Form BD registers the broker-dealer FIRM itself, not an individual representative." },
              { text: "Form ADV", explanation: "Form ADV registers investment advisers, a separate regulatory track from broker-dealer reps." },
            ],
          },
          {
            q: "Within how many days must a firm file Form U5 after a rep's termination?",
            a: "30 days",
            explanation: "This 30-day window is the specific deadline for filing the termination notice.",
            options: [
              { text: "30 days", explanation: "Correct — this is the filing deadline for Form U5." },
              { text: "5 days", explanation: "This is shorter than the actual 30-day requirement." },
              { text: "90 days", explanation: "This is longer than the actual 30-day requirement." },
              { text: "There is no deadline", explanation: "A specific 30-day deadline applies to this filing." },
            ],
          },
        ],
      },
      {
        id: "sie-regulatory-2",
        title: "Reportable events and statutory disqualification",
        minutes: 6,
        body: [
          "A reportable event is anything that must be disclosed on (or update) a rep's Form U4 — including customer complaints alleging sales-practice violations, regulatory actions, certain criminal charges or convictions, and financial matters like bankruptcies or liens. These disclosures feed into BrokerCheck, the public record investors can search.",
          "Statutory disqualification is a legal status that can bar someone from associating with a FINRA member firm — triggers include certain felony convictions (especially those involving securities, fraud, or money), specific securities-related misdemeanors, and being barred or suspended by a regulator.",
          "The point of this reporting infrastructure is investor protection through transparency: a firm — and the public — should be able to see a rep's regulatory history before trusting them with money.",
        ],
        challenge: "Name two examples of a reportable Form U4 event, and describe what statutory disqualification does to a person's ability to work at a FINRA member firm.",
        exampleOutput: "Examples: a customer complaint alleging a sales-practice violation, or a felony conviction. Statutory disqualification generally bars the individual from associating with a FINRA member firm.",
        quiz: [
          {
            q: "A statutorily disqualified individual is generally:",
            a: "Barred from associating with a FINRA member firm",
            explanation: "Statutory disqualification is a status that prevents association with a FINRA member firm, not merely a fine or temporary restriction.",
            options: [
              { text: "Barred from associating with a FINRA member firm", explanation: "Correct — this is what statutory disqualification does." },
              { text: "Required only to pay a fine", explanation: "Statutory disqualification is a bar on association, not simply a monetary penalty." },
              { text: "Automatically re-registered after one year", explanation: "There is no automatic one-year reinstatement built into statutory disqualification." },
              { text: "Only restricted from selling municipal securities", explanation: "The disqualification is broader than one product line — it bars association with a member firm generally." },
            ],
          },
          {
            q: "Which of these is a reportable event that must be disclosed on Form U4?",
            a: "A customer complaint alleging a sales-practice violation",
            explanation: "Sales-practice complaints are a core category of disclosures Form U4 requires to keep a rep's public record accurate.",
            options: [
              { text: "A customer complaint alleging a sales-practice violation", explanation: "Correct — this is a standard reportable event on Form U4." },
              { text: "A rep's personal vacation schedule", explanation: "This has no regulatory disclosure relevance." },
              { text: "A firm's quarterly earnings", explanation: "That's a corporate financial matter, not an individual rep's disclosure item." },
              { text: "The rep's preferred trading hours", explanation: "This isn't a disclosure category at all." },
            ],
          },
        ],
      },
      {
        id: "sie-regulatory-3",
        title: "Continuing education: Regulatory and Firm Elements",
        minutes: 6,
        body: [
          "FINRA's continuing education program has two parts. Under FINRA Rule 1240 (as amended effective January 1, 2023), the Regulatory Element is standardized, computer-based training on compliance, regulatory, and ethical topics — required annually, by December 31, for EACH registration category the rep holds. (The pre-2023 rule ran on a different, now-retired anniversary-based cycle — that older schedule no longer applies.)",
          "The Firm Element is training the firm itself designs and delivers, tailored to its own products and the rep's specific activities — the firm sets an annual training plan based on a needs analysis, rather than following a fixed national curriculum.",
          "Failing to complete the Regulatory Element on time results in the rep's registration becoming inactive (CE inactive status) until it's completed — a real, practical consequence.",
        ],
        challenge: "State how often the Regulatory Element must be completed and by what deadline under the current rule, and explain who designs the Firm Element's content.",
        exampleOutput: "The Regulatory Element must be completed annually, by December 31, for each registration category the rep holds. The Firm Element's content is designed and delivered by each firm, based on its own needs analysis.",
        quiz: [
          {
            q: "Under the current FINRA Rule 1240 (effective January 1, 2023), the Regulatory Element must be completed:",
            a: "Annually, by December 31, for each registration category the rep holds",
            explanation: "The pre-2023 'second anniversary, then every three years' schedule was replaced — the current rule requires annual completion by December 31 for every registration category held.",
            options: [
              { text: "Annually, by December 31, for each registration category the rep holds", explanation: "Correct — this is the current schedule under FINRA Rule 1240." },
              { text: "On the second registration anniversary, then every three years", explanation: "This was the rule before January 1, 2023 — it was replaced by the current annual, by-December-31 requirement." },
              { text: "Only once, at initial registration", explanation: "The Regulatory Element is an ongoing annual requirement — it isn't a one-time requirement." },
              { text: "Whenever the rep chooses", explanation: "The schedule is fixed and mandated, not left to the rep's discretion." },
            ],
          },
          {
            q: "The Firm Element of continuing education is:",
            a: "Designed and delivered by the firm itself, based on its own needs analysis",
            explanation: "Unlike the standardized Regulatory Element, the Firm Element is customized training each firm builds around its own products and its reps' activities.",
            options: [
              { text: "Designed and delivered by the firm itself, based on its own needs analysis", explanation: "Correct — this is what distinguishes the Firm Element from the standardized Regulatory Element." },
              { text: "A standardized national exam identical at every firm", explanation: "That describes the Regulatory Element, not the Firm Element." },
              { text: "Optional for most firms", explanation: "The Firm Element is a required component of continuing education, not optional." },
              { text: "Only for newly registered reps", explanation: "It applies on an ongoing basis to reps based on their activities, not just to new hires." },
            ],
          },
        ],
      },
    ],
  },
];
