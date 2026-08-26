// SERIES65 — section "client" — expansion batch 2 of 4
//
// Scope for this batch (biased toward the SECOND third of the section's topic
// space: capital market theory mechanics, fixed-income portfolio construction
// techniques, asset-class/strategy suitability, and derivatives-based
// portfolio strategies). Avoids ground already covered by
// data/certs/series65-bank.js and data/certs/series65-bank-client.js, which
// between them already cover: KYC/IPS basics, correlation/diversification
// fundamentals, CAPM/SML/CML, Sharpe/Treynor/Jensen's alpha, EMH forms,
// behavioral biases (confirmation, framing, mental accounting,
// representativeness, loss aversion, anchoring, recency, herd, overconfidence),
// tactical vs strategic allocation, rebalancing mechanics, style drift,
// glide paths, muni/Treasury taxation, cost basis methods, wash sales,
// tax-loss harvesting, charitable giving, Roth conversions, employer plans
// (401k/403b/457b/SEP/SIMPLE), ERISA fiduciary duties, inherited IRA rules,
// QDROs, PBGC, 529/Coverdell, information ratio/tracking error/attribution,
// and mutual fund share classes.
//
// This batch instead targets: bond duration/convexity (including zero-coupon
// duration), yield-curve-based fixed-income strategies (ladder/bullet),
// immunization, reinvestment risk, call risk, multi-factor asset pricing
// models, the minimum-variance portfolio concept, the two-asset portfolio standard
// deviation formula, option-based equity strategies (covered calls,
// protective puts, collars), currency risk in international investing,
// alternative investment liquidity/fee structures, REIT taxation, convertible
// bonds, and preferred stock characteristics.
//
// Ids reserved: s65-cl-x201 through s65-cl-x220.

export const S65_CLIENT_X2 = [
  {
    id: "s65-cl-x201",
    section: "client",
    q: "Which measure best estimates the approximate percentage change in a bond's price resulting from a 1% change in interest rates?",
    a: "Modified duration",
    explanation: "Modified duration approximates the sensitivity of a bond's price to a small change in yield: percentage price change is roughly equal to negative modified duration multiplied by the change in yield. It is the standard first-order measure of interest rate risk.",
    options: [
      { text: "Modified duration", explanation: "Correct — modified duration estimates the percentage price change for a given change in yield, making it the standard measure of interest rate sensitivity." },
      { text: "Current yield", explanation: "Current yield is simply annual coupon income divided by current price; it says nothing about how price reacts to a change in rates." },
      { text: "Yield to maturity", explanation: "Yield to maturity is the total return if the bond is held to maturity; it measures return, not price sensitivity to rate changes." },
      { text: "Coupon rate", explanation: "The coupon rate is a fixed contractual payment rate and does not by itself measure how sensitive the bond's price is to rate changes." },
    ],
  },
  {
    id: "s65-cl-x202",
    section: "client",
    q: "Convexity is a useful supplement to duration because duration alone:",
    a: "Assumes a linear relationship between price and yield, which becomes less accurate for larger changes in interest rates",
    explanation: "The actual price-yield relationship for a bond is curved (convex), not a straight line. Duration is a linear approximation that works well for small yield changes but grows less accurate as the yield change gets larger: for a bond with positive convexity, duration alone understates the price gain when rates fall and overstates the price decline when rates rise. Convexity is the second-order correction for that curvature.",
    options: [
      { text: "Assumes a linear relationship between price and yield, which becomes less accurate for larger changes in interest rates", explanation: "Correct — duration is a linear approximation, and convexity captures the curvature that duration misses, especially for larger rate moves." },
      { text: "Cannot be calculated for bonds with a call feature", explanation: "Duration can be calculated for callable bonds (often as effective duration); the issue duration has is linearity, not an inability to apply it to callable bonds." },
      { text: "Only applies to zero-coupon bonds", explanation: "Duration applies to any bond with cash flows, not just zero-coupon bonds; convexity is a general refinement, not a zero-coupon-specific fix." },
      { text: "Ignores the bond's coupon rate entirely", explanation: "Duration calculations directly incorporate the timing and size of coupon payments; the limitation being addressed is linearity, not omission of coupons." },
    ],
  },
  {
    id: "s65-cl-x203",
    section: "client",
    q: "A client builds a bond portfolio with maturities staggered evenly at one-year intervals from 1 to 10 years, reinvesting each maturing bond's proceeds at the long end as it matures. This is best described as a:",
    a: "Bond ladder strategy",
    explanation: "A bond ladder spreads maturities evenly across a range of dates. As each rung matures, proceeds are typically reinvested at the long end, which smooths out reinvestment risk and interest rate risk by avoiding concentration in any single maturity or rate environment.",
    options: [
      { text: "Bond ladder strategy", explanation: "Correct — evenly staggered maturities reinvested at the long end as each rung matures is the defining feature of a bond ladder." },
      { text: "Barbell strategy", explanation: "A barbell concentrates holdings at the short and long ends of the maturity spectrum while avoiding intermediate maturities, unlike the even spacing described here." },
      { text: "Bullet strategy", explanation: "A bullet strategy concentrates bond maturities around a single target date, not staggered evenly across a decade." },
      { text: "Immunization strategy", explanation: "Immunization matches portfolio duration to a specific liability horizon to lock in a return; it is a distinct technique from simply laddering maturities evenly." },
    ],
  },
  {
    id: "s65-cl-x204",
    section: "client",
    q: "Which statement about the duration of a zero-coupon bond is correct?",
    a: "Its Macaulay duration equals its remaining term to maturity, because the bond's only cash flow is the single principal payment at maturity",
    explanation: "Macaulay duration is the weighted average time until a bond's cash flows are received. A zero-coupon bond has exactly one cash flow — principal at maturity — so that weighted average collapses to the maturity date itself. This also means a zero has the longest duration, and therefore the greatest price sensitivity to a rate change, of any bond of a given maturity.",
    options: [
      { text: "Its Macaulay duration equals its remaining term to maturity, because the bond's only cash flow is the single principal payment at maturity", explanation: "Correct — with one cash flow at maturity, the weighted average time to receive cash flows is simply the maturity itself." },
      { text: "Its duration is zero, since the bond makes no periodic coupon payments", explanation: "A common misreading of the name. 'Zero-coupon' describes the absence of coupons, not the absence of duration — the bond still has a cash flow at maturity and is in fact highly rate-sensitive." },
      { text: "Its duration is shorter than that of a coupon-paying bond of the same maturity", explanation: "Reversed. Coupon payments return value earlier and pull the weighted average time forward, so a coupon bond's duration is SHORTER than that of a zero of the same maturity, not longer." },
      { text: "Its duration must be recalculated after each coupon payment date", explanation: "A zero-coupon bond pays no coupons, so there are no coupon dates; its Macaulay duration simply shortens with the passage of time toward maturity." },
    ],
  },
  {
    id: "s65-cl-x205",
    section: "client",
    q: "A pension fund knows it must pay a large lump-sum obligation in exactly 7 years. To fund this liability, the fund purchases bonds that are selected so that most of them mature at or near that 7-year date. This fixed-income approach is known as a:",
    a: "Bullet strategy",
    explanation: "A bullet strategy concentrates bond maturities around a single target date that matches a known future liability or goal, so principal becomes available when it is needed.",
    options: [
      { text: "Bullet strategy", explanation: "Correct — clustering maturities around one target date to fund a specific known future obligation is a bullet strategy." },
      { text: "Barbell strategy", explanation: "A barbell splits holdings between short and long maturities rather than concentrating them at a single target date." },
      { text: "Bond ladder strategy", explanation: "A ladder staggers maturities evenly over many years rather than clustering them at one specific date." },
      { text: "Core-satellite strategy", explanation: "Core-satellite is a broader portfolio construction framework combining a passive core with active satellite positions; it is not a bond-maturity-matching technique." },
    ],
  },
  {
    id: "s65-cl-x206",
    section: "client",
    q: "'Immunizing' a bond portfolio against interest rate risk chiefly involves:",
    a: "Setting the portfolio's duration equal to the investment time horizon so that price risk and reinvestment risk offset each other",
    explanation: "Immunization works because a change in rates has two opposing effects: it changes the bond's price and it changes the rate at which cash flows are reinvested. When portfolio duration equals the horizon, these two effects offset, locking in an expected return regardless of the rate change's direction.",
    options: [
      { text: "Setting the portfolio's duration equal to the investment time horizon so that price risk and reinvestment risk offset each other", explanation: "Correct — matching duration to the horizon is the mechanism by which immunization neutralizes interest rate risk." },
      { text: "Investing exclusively in floating-rate securities", explanation: "Floating-rate securities reduce price sensitivity to rates but are a different technique from duration-matching, and are not what 'immunization' specifically refers to." },
      { text: "Avoiding all bonds with call provisions", explanation: "While call risk is a separate concern, simply avoiding callable bonds does not by itself constitute immunization, which specifically requires duration-matching to a horizon." },
      { text: "Holding only bonds with the highest available credit rating", explanation: "Credit quality addresses default risk, not interest rate risk, and is unrelated to the duration-matching mechanism that defines immunization." },
    ],
  },
  {
    id: "s65-cl-x207",
    section: "client",
    q: "An inverted yield curve, in which short-term interest rates exceed long-term interest rates, is most commonly interpreted by market participants as a signal that:",
    a: "The market anticipates slower economic growth or a possible recession ahead",
    explanation: "An inverted yield curve is widely watched as a leading indicator because it suggests investors expect the central bank to lower short-term rates in the future in response to weakening economic conditions, pulling long-term yields below current short-term yields.",
    options: [
      { text: "The market anticipates slower economic growth or a possible recession ahead", explanation: "Correct — an inversion is generally interpreted as the market pricing in expectations of an economic slowdown." },
      { text: "Inflation expectations are rising sharply for the near term", explanation: "Rising near-term inflation expectations would typically push short-term rates up alongside long-term rates, not invert the curve in this way; inversions are more associated with growth concerns." },
      { text: "Bond issuers are becoming more creditworthy across the board", explanation: "Yield curve shape reflects the relationship between rates at different maturities, not a general shift in issuer credit quality." },
      { text: "Long-term bonds have become less liquid than short-term bonds", explanation: "Liquidity differences are not the standard interpretation of an inverted curve; the conventional reading centers on growth and rate-path expectations." },
    ],
  },
  {
    id: "s65-cl-x208",
    section: "client",
    q: "Two bonds from the same issuer have the same maturity date and the same yield to maturity, but one carries a high coupon and the other a low coupon. Holding all else equal, the high-coupon bond exposes its owner to greater:",
    a: "Reinvestment risk, because a larger share of its total return arrives as interim coupon payments that must be put back to work at whatever rate prevails when each is received",
    explanation: "Reinvestment risk is driven by how much cash flow arrives before maturity. A high-coupon bond returns more of its value through interim coupons, and each coupon must be reinvested at the rate available at that time — so if rates fall, more of the investor's return is reinvested at the lower rate. Holding coupon constant, this is also why a zero-coupon bond held to maturity carries essentially no reinvestment risk.",
    options: [
      { text: "Reinvestment risk, because a larger share of its total return arrives as interim coupon payments that must be put back to work at whatever rate prevails when each is received", explanation: "Correct — the larger the interim coupon stream, the more of the investor's return is exposed to the rate available at each reinvestment date." },
      { text: "Interest rate (price) risk, because a higher coupon lengthens the bond's duration", explanation: "Reversed — for two bonds of the same maturity and yield, a higher coupon produces a SHORTER duration, so the high-coupon bond has less price sensitivity to rate changes, not more." },
      { text: "Credit risk, because the issuer must fund larger periodic interest payments", explanation: "Both bonds are obligations of the same issuer, so they carry the same credit risk; coupon size does not change the issuer's creditworthiness for exam purposes." },
      { text: "Purchasing power risk, because fixed coupons lose real value to inflation", explanation: "Inflation erodes the real value of any fixed coupon stream, but that applies to both bonds here; it is not a risk the higher coupon specifically increases relative to the lower-coupon bond." },
    ],
  },
  {
    id: "s65-cl-x209",
    section: "client",
    q: "'Call risk' on a bond refers to the risk that:",
    a: "The issuer will redeem the bond prior to maturity, typically when interest rates have fallen, forcing the investor to reinvest proceeds at lower prevailing rates",
    explanation: "Issuers call bonds when it is advantageous for them to refinance at lower rates, which is precisely when the investor least wants to give up the higher-yielding bond, leaving the investor to reinvest at the now-lower rates available.",
    options: [
      { text: "The issuer will redeem the bond prior to maturity, typically when interest rates have fallen, forcing the investor to reinvest proceeds at lower prevailing rates", explanation: "Correct — call risk is triggered by falling rates and forces reinvestment at less favorable rates, capping the bond's price appreciation." },
      { text: "The issuer will default on scheduled interest payments", explanation: "That describes credit/default risk, which is a separate risk from a bond being redeemed early under its call provision." },
      { text: "The bond's price will become more volatile as it approaches maturity", explanation: "Increasing price stability (not volatility) as maturity nears is typical of bond price behavior generally, and is unrelated to the specific mechanism of a call feature." },
      { text: "The investor will be unable to sell the bond in the secondary market at any price", explanation: "That describes marketability/liquidity risk, not call risk, which specifically concerns early redemption by the issuer." },
    ],
  },
  {
    id: "s65-cl-x210",
    section: "client",
    q: "Compared to the single-factor CAPM, a multi-factor asset pricing model such as the Fama-French three-factor model:",
    a: "Adds additional explanatory factors, such as company size and value characteristics, beyond the single market risk factor used in CAPM",
    explanation: "CAPM explains expected return using only a security's sensitivity to overall market risk (beta). Multi-factor models like Fama-French add further systematic factors — historically, a size factor (small companies versus large) and a value factor (high book-to-market versus low) — to better explain the cross-section of returns.",
    options: [
      { text: "Adds additional explanatory factors, such as company size and value characteristics, beyond the single market risk factor used in CAPM", explanation: "Correct — multi-factor models expand on CAPM's single market factor by adding factors like size and value." },
      { text: "Eliminates the need to consider market risk (beta) entirely", explanation: "Multi-factor models still include a market risk factor; they add to it rather than replacing or eliminating it." },
      { text: "Applies only to fixed-income securities, not equities", explanation: "Multi-factor models such as Fama-French were developed primarily to explain equity returns, not fixed-income returns exclusively." },
      { text: "Assumes that unsystematic risk, rather than systematic risk, drives expected returns", explanation: "Both CAPM and multi-factor extensions focus on systematic (non-diversifiable) sources of risk in explaining expected returns, not unsystematic risk." },
    ],
  },
  {
    id: "s65-cl-x211",
    section: "client",
    q: "Among all portfolios that lie on the efficient frontier, the 'minimum-variance portfolio' is the one that:",
    a: "Has the lowest possible standard deviation of any achievable portfolio of the available risky assets",
    explanation: "The minimum-variance portfolio sits at the far left end of the efficient frontier — it is the single portfolio combination of risky assets with the least possible risk, though not necessarily the highest expected return.",
    options: [
      { text: "Has the lowest possible standard deviation of any achievable portfolio of the available risky assets", explanation: "Correct — it is defined specifically by minimizing risk (standard deviation), regardless of the return it produces." },
      { text: "Has the highest possible expected return of any achievable portfolio", explanation: "That describes the portfolio at the opposite (upper) end of the efficient frontier, not the minimum-variance portfolio." },
      { text: "Is the portfolio with a beta of exactly 1.0", explanation: "Beta measures sensitivity to the overall market, which is a different concept from where a portfolio sits on the risk/return efficient frontier." },
      { text: "Contains only risk-free assets", explanation: "The minimum-variance portfolio is constructed from the available risky assets on the efficient frontier; a 100% risk-free allocation is a separate point along the Capital Market Line, not the minimum-variance risky portfolio itself." },
    ],
  },
  {
    id: "s65-cl-x212",
    section: "client",
    q: "Unlike a two-asset portfolio's expected return, which is simply a weighted average of the two assets' expected returns, the portfolio's standard deviation:",
    a: "Also depends on the correlation coefficient between the two assets, and generally cannot be found by weight-averaging their individual standard deviations",
    explanation: "Portfolio risk is a function of each asset's weight and standard deviation AND the correlation between them. Because of this correlation term, portfolio standard deviation is generally less than the weighted average of the individual standard deviations (except in the special case of perfect positive correlation), which is the basis for diversification's risk-reduction benefit.",
    options: [
      { text: "Also depends on the correlation coefficient between the two assets, and generally cannot be found by weight-averaging their individual standard deviations", explanation: "Correct — correlation is what makes portfolio risk calculation different from a simple weighted average, and is the mathematical basis for diversification benefits." },
      { text: "Is always exactly equal to the weighted average of the two assets' individual standard deviations", explanation: "This is only true in the special case of perfect positive correlation (+1); in every other case, actual portfolio standard deviation is lower than this weighted average." },
      { text: "Is unrelated to the weights allocated to each asset", explanation: "Portfolio standard deviation is directly a function of the weights assigned to each asset, along with their individual risks and correlation." },
      { text: "Cannot be calculated unless both assets have identical expected returns", explanation: "Portfolio standard deviation can be calculated regardless of whether the two assets' expected returns are equal; it depends on weights, individual standard deviations, and correlation, not on the returns being equal." },
    ],
  },
  {
    id: "s65-cl-x213",
    section: "client",
    q: "An investor who owns 100 shares of a stock sells a call option against that position (a 'covered call'). This strategy is best described as one that:",
    a: "Generates premium income and provides limited downside cushion, in exchange for capping the investor's upside if the stock rises above the strike price",
    explanation: "Selling a call against stock already owned collects premium income up front, which offsets a modest amount of downside loss. In exchange, if the stock rallies above the strike price, the shares are likely to be called away, capping the investor's gain at the strike price plus premium received.",
    options: [
      { text: "Generates premium income and provides limited downside cushion, in exchange for capping the investor's upside if the stock rises above the strike price", explanation: "Correct — this trade-off of income and limited downside protection for capped upside is the defining feature of a covered call." },
      { text: "Eliminates all downside risk on the underlying shares", explanation: "The premium received only partially offsets losses; a covered call does not eliminate downside risk below the reduced breakeven point." },
      { text: "Provides unlimited upside potential in addition to the premium collected", explanation: "Selling the call specifically caps the investor's upside at the strike price, which is the opposite of unlimited upside." },
      { text: "Requires the investor to purchase additional shares of the underlying stock", explanation: "A covered call is written against shares the investor already owns; it does not require purchasing additional shares." },
    ],
  },
  {
    id: "s65-cl-x214",
    section: "client",
    q: "An investor who owns shares of a stock purchases a put option on that same stock as a hedge. This strategy, known as a 'protective put,' functions most like:",
    a: "Insurance against a decline in the stock's price below the put's strike price, at the cost of the premium paid",
    explanation: "A protective put sets a floor on losses: if the stock falls, the investor can exercise the put and sell at the strike price, limiting further loss. This protection is not free — the premium paid for the put reduces the investor's overall return if the stock does not decline.",
    options: [
      { text: "Insurance against a decline in the stock's price below the put's strike price, at the cost of the premium paid", explanation: "Correct — the put limits downside loss at the cost of the premium, functioning like an insurance policy on the position." },
      { text: "A way to generate additional income from the stock position", explanation: "Buying a put is a cost (the investor pays a premium), not an income-generating strategy; the covered call, not the protective put, is the income-oriented strategy." },
      { text: "A guarantee of unlimited gains if the stock price rises", explanation: "The put itself does not affect the stock's upside; the investor's gain potential remains simply that of owning the shares, reduced by the premium already paid." },
      { text: "A method of increasing the stock position's leverage", explanation: "Buying a protective put is a hedge that reduces downside exposure; it does not add leverage to the underlying stock position." },
    ],
  },
  {
    id: "s65-cl-x215",
    section: "client",
    q: "An investor who owns stock, buys a protective put, and simultaneously sells a covered call against the same shares (a 'collar') is primarily seeking to:",
    a: "Limit both the downside and the upside of the stock position, often financing most or all of the put's cost with the premium received from the call",
    explanation: "A collar combines a protective put (downside floor) with a covered call (upside cap). The premium received from selling the call typically helps pay for the put, often making the hedge low-cost or even costless, at the price of also limiting how much the investor can gain.",
    options: [
      { text: "Limit both the downside and the upside of the stock position, often financing most or all of the put's cost with the premium received from the call", explanation: "Correct — a collar caps both potential loss and potential gain, typically at a reduced or near-zero net premium cost." },
      { text: "Maximize potential upside while accepting unlimited downside risk", explanation: "A collar does the opposite — it caps upside via the sold call while limiting (not eliminating) downside via the purchased put." },
      { text: "Eliminate all cost associated with hedging the position", explanation: "While the call premium often offsets much of the put's cost, a collar does not guarantee zero cost, and its purpose is risk-limiting, not cost elimination as its primary goal." },
      { text: "Increase the position's sensitivity to the underlying stock's price movements", explanation: "A collar reduces, rather than increases, the position's sensitivity to large price swings in either direction by capping both gains and losses." },
    ],
  },
  {
    id: "s65-cl-x216",
    section: "client",
    q: "A U.S. investor holds an unhedged position in a foreign stock. Beyond the stock's own price performance, the investor's total return in U.S. dollar terms will also be affected by:",
    a: "Movements in the exchange rate between the foreign currency and the U.S. dollar",
    explanation: "When a foreign investment is not currency-hedged, the investor's home-currency return reflects both the security's local-currency performance and the change in the exchange rate. A depreciating foreign currency can erode dollar returns even if the local stock performs well, and vice versa.",
    options: [
      { text: "Movements in the exchange rate between the foreign currency and the U.S. dollar", explanation: "Correct — currency fluctuations are an additional source of return and risk for unhedged international investments." },
      { text: "The U.S. federal funds rate exclusively, with no effect from any other factor", explanation: "While domestic rates can indirectly influence currency markets, they are not the sole determinant, and the direct exposure described is to exchange rate movement generally." },
      { text: "Only the foreign country's corporate tax rate on dividends", explanation: "Foreign tax treatment can matter for net income received, but it is not the primary additional source of return variability described here — currency movement is." },
      { text: "Nothing beyond the stock's local-currency price performance, since currency effects cancel out over any holding period", explanation: "Currency effects do not automatically cancel out; they can meaningfully add to or subtract from an unhedged investor's total return, which is exactly the risk currency hedging is designed to address." },
    ],
  },
  {
    id: "s65-cl-x217",
    section: "client",
    q: "Compared to traditional mutual funds, alternative investments such as hedge funds and private equity funds most often present a suitability concern because they typically feature:",
    a: "Lock-up periods and limited redemption windows, along with higher fee structures, that reduce liquidity relative to a traditional mutual fund",
    explanation: "Hedge funds and private equity funds commonly restrict when and how often investors can withdraw capital (lock-ups and periodic redemption gates) and typically charge higher management and performance-based fees than traditional mutual funds, both of which must be weighed against a client's liquidity needs.",
    options: [
      { text: "Lock-up periods and limited redemption windows, along with higher fee structures, that reduce liquidity relative to a traditional mutual fund", explanation: "Correct — restricted liquidity and higher fees are hallmark suitability concerns for these vehicles." },
      { text: "Daily liquidity that exceeds even that of an open-end mutual fund", explanation: "This is generally the opposite of reality — alternative funds typically offer less, not more, liquidity than daily-redeemable mutual funds." },
      { text: "Guaranteed returns regardless of market conditions", explanation: "Alternative investments carry their own market and strategy risk and do not offer guaranteed returns; this misstates their risk profile." },
      { text: "Mandatory daily net asset value pricing identical to mutual funds", explanation: "Many alternative funds do not price daily and instead value holdings less frequently, unlike a mutual fund's required daily NAV calculation." },
    ],
  },
  {
    id: "s65-cl-x218",
    section: "client",
    q: "Dividends distributed by most equity Real Estate Investment Trusts (REITs) to shareholders are generally taxed as:",
    a: "Ordinary income for the shareholder, since the REIT itself typically avoids corporate tax by distributing most of its taxable income",
    explanation: "REITs generally do not pay federal corporate income tax as long as they distribute most of their taxable income to shareholders. Because that income has not already been taxed at the corporate level, most REIT distributions do not qualify for the lower qualified-dividend tax rate and are instead taxed to the shareholder as ordinary income.",
    options: [
      { text: "Ordinary income for the shareholder, since the REIT itself typically avoids corporate tax by distributing most of its taxable income", explanation: "Correct — most REIT dividends are taxed as ordinary income precisely because the REIT's income largely escapes corporate-level taxation." },
      { text: "Tax-exempt income, similar to municipal bond interest", explanation: "REIT dividends are generally taxable to the shareholder; they are not treated as tax-exempt like municipal bond interest." },
      { text: "Qualified dividend income taxed at preferential capital gains rates in nearly all cases", explanation: "Because REIT income is generally not taxed at the corporate level before distribution, most of it does not meet the requirements for the lower qualified-dividend rate, unlike dividends from many ordinary corporations." },
      { text: "Return of capital only, with no current tax consequence to the shareholder", explanation: "While a portion of a REIT distribution can sometimes be a return of capital, the bulk of typical REIT distributions represents taxable ordinary income, not return of capital." },
    ],
  },
  {
    id: "s65-cl-x219",
    section: "client",
    q: "A convertible bond typically carries a lower coupon rate than an otherwise comparable non-convertible bond from the same issuer because:",
    a: "The embedded option to convert the bond into a set number of common shares has value to the investor, which offsets the lower coupon",
    explanation: "Investors accept a lower stated coupon on a convertible bond in exchange for the conversion feature, which gives them a way to participate in the issuer's stock price appreciation. That embedded equity option has real value, compensating for the reduced current income.",
    options: [
      { text: "The embedded option to convert the bond into a set number of common shares has value to the investor, which offsets the lower coupon", explanation: "Correct — the conversion feature's value is what allows the issuer to offer a lower coupon while still attracting investors." },
      { text: "Convertible bonds are always secured by specific collateral, unlike non-convertible bonds", explanation: "Convertibility and collateralization are separate features; a convertible bond is not automatically secured, and collateral status is not what explains the lower coupon." },
      { text: "Convertible bonds carry no credit risk from the issuer", explanation: "Convertible bonds remain subject to the issuer's credit risk just like other corporate debt; the lower coupon is explained by the conversion feature's value, not an absence of credit risk." },
      { text: "Convertible bond investors are legally required to accept below-market coupons", explanation: "There is no such legal requirement; the lower coupon reflects a voluntary market trade-off for the value of the conversion option." },
    ],
  },
  {
    id: "s65-cl-x220",
    section: "client",
    q: "Preferred stock is often described as a 'hybrid' security because it:",
    a: "Pays a stated, generally fixed dividend like a bond's coupon, while representing an equity ownership interest that ranks below bondholders but above common stockholders in liquidation",
    explanation: "Preferred stock blends bond-like and equity-like features: like a bond, it typically pays a fixed stated dividend and is sensitive to interest rate changes; like equity, it represents ownership, but with a claim on assets and dividends that is senior to common stock yet subordinate to the company's debt.",
    options: [
      { text: "Pays a stated, generally fixed dividend like a bond's coupon, while representing an equity ownership interest that ranks below bondholders but above common stockholders in liquidation", explanation: "Correct — this combination of a fixed, bond-like payment with an equity claim positioned between bonds and common stock is why preferred stock is called a hybrid." },
      { text: "Guarantees voting control of the company equal to that of common shareholders", explanation: "Preferred shareholders typically have limited or no voting rights, unlike common shareholders, which is one of the trade-offs for preferred's priority in dividends and liquidation." },
      { text: "Ranks senior to all of the company's outstanding bonds in a liquidation", explanation: "Preferred stock ranks below bondholders (and other creditors), not above them, in a liquidation — this is precisely why preferred sits between debt and common equity." },
      { text: "Has price behavior that is essentially unaffected by changes in interest rates", explanation: "Because of its fixed dividend, preferred stock's price tends to behave similarly to a long-duration bond and is generally quite sensitive to interest rate changes, not insulated from them." },
    ],
  },
];
