// Series 65 (Uniform Investment Adviser Law Examination) — practice question bank expansion.
// Batch: SERIES65 "economic" section (Economic Factors and Business Information), part 1 of 2.
// Same quiz-item shape as data/certs/series65-bank.js: {id, section, q, a, explanation, options:[{text, explanation}]}.
// Ids reserved: s65-ec-x101 through s65-ec-x120.
//
// This batch deliberately biases toward the FIRST slice of the topic scope — economic
// indicators, the business cycle, and monetary/fiscal policy mechanics — going after the
// mechanism-level distinctions candidates actually miss rather than the softball
// definitions already covered in series65-bank.js and series65-bank-economic.js:
//   - fed funds rate vs. discount rate vs. prime rate (who charges whom)
//   - who sets fiscal policy vs. monetary policy
//   - quantitative easing as distinct from ordinary open market operations
//   - automatic stabilizers vs. discretionary fiscal policy
//   - the NBER's role in officially dating recessions
//   - the CURRENT (post-May-2020) Fed redefinition of M1 to include savings deposits,
//     and how M2 differs from the new M1 — a fact many older study materials get wrong
//   - frictional vs. structural vs. cyclical unemployment
//   - the "recovery" sub-phase of the business cycle vs. peak/trough/contraction
//   - specific leading/coincident/lagging indicator examples not previously used
//   - the crowding-out effect, the Phillips curve tradeoff, contractionary fiscal policy,
//     GDP deflator vs. CPI, the net-exports drag on GDP, and the Fed's dual mandate
//
// No dated/year-sensitive dollar figures, percentages, or thresholds are used. Settlement
// cycle and Reg Element rules are out of scope for this section and are not referenced.

export const S65_ECONOMIC_X1 = [
  {
    id: "s65-ec-x101",
    section: "economic",
    q: "The 'federal funds rate' is best described as the interest rate at which:",
    a: "Banks lend excess reserve balances to other banks overnight",
    explanation: "The fed funds rate is set in the interbank market for overnight reserve loans. The Fed influences it but it is not a rate the Fed charges directly to banks (that is the discount rate) or to the public.",
    options: [
      { text: "Banks lend excess reserve balances to other banks overnight", explanation: "Correct — the fed funds rate is the overnight rate banks charge each other for reserve loans, which the FOMC targets through its policy actions." },
      { text: "The Federal Reserve lends directly to member banks through the discount window", explanation: "That is the discount rate, a separate rate the Fed sets and charges directly to depository institutions." },
      { text: "Banks lend to their most creditworthy commercial customers", explanation: "That is the prime rate, which is set by individual banks and typically moves in tandem with, but is distinct from, the fed funds rate." },
      { text: "The U.S. Treasury borrows short-term from money market investors", explanation: "That describes the yield on Treasury bills, a market-determined rate on short-term government debt rather than an interbank lending rate." },
    ],
  },
  {
    id: "s65-ec-x102",
    section: "economic",
    q: "Decisions about federal taxation and government spending levels — the tools of fiscal policy — are primarily made by:",
    a: "Congress and the President",
    explanation: "Fiscal policy is enacted through the legislative and budget process, requiring Congress to pass and the President to sign tax and spending legislation. Monetary policy, by contrast, is set independently by the Federal Reserve.",
    options: [
      { text: "Congress and the President", explanation: "Correct — fiscal policy (taxing and spending) is a function of the legislative and executive branches, not the central bank." },
      { text: "The Federal Reserve Board of Governors", explanation: "The Board of Governors sets monetary policy tools such as reserve requirements and the discount rate, not tax and spending law." },
      { text: "The Federal Open Market Committee (FOMC)", explanation: "The FOMC directs open market operations and the fed funds rate target — monetary policy, not fiscal policy." },
      { text: "The U.S. Treasury Department acting independently", explanation: "Treasury implements and finances policy already enacted by Congress; it does not independently set tax rates or spending levels." },
    ],
  },
  {
    id: "s65-ec-x103",
    section: "economic",
    q: "Quantitative easing (QE) is best distinguished from routine open market operations in that QE involves:",
    a: "Large-scale, sustained purchases of securities intended to inject reserves and lower longer-term rates once short-term rates are already near zero",
    explanation: "QE is an unconventional expansion of ordinary open market operations, used when the fed funds rate is already at or near its lower bound and the Fed wants further monetary accommodation by directly influencing longer-term yields.",
    options: [
      { text: "Large-scale, sustained purchases of securities intended to inject reserves and lower longer-term rates once short-term rates are already near zero", explanation: "Correct — QE is an extraordinary, large-scale version of open market purchases aimed at longer-term rates when conventional short-rate policy is exhausted." },
      { text: "Raising the reserve requirement to tighten bank lending capacity", explanation: "That is a contractionary reserve-requirement action, the opposite direction and tool from QE." },
      { text: "Raising the discount rate to discourage bank borrowing from the Fed", explanation: "That is a separate, tightening tool and does not describe QE, which is expansionary." },
      { text: "Congress issuing new Treasury debt to fund a budget deficit", explanation: "That is fiscal financing activity by Treasury, not a monetary policy action by the Federal Reserve." },
    ],
  },
  {
    id: "s65-ec-x104",
    section: "economic",
    q: "Which of the following is an example of an automatic fiscal stabilizer, as opposed to discretionary fiscal policy?",
    a: "Unemployment insurance payments that automatically rise as job losses increase during a downturn",
    explanation: "Automatic stabilizers are built into law and adjust government spending or tax revenue without new legislative action as economic conditions change. Discretionary fiscal policy requires a new act of Congress each time.",
    options: [
      { text: "Unemployment insurance payments that automatically rise as job losses increase during a downturn", explanation: "Correct — unemployment insurance and the progressive tax system are classic automatic stabilizers that respond to the economy without new legislation." },
      { text: "A newly enacted infrastructure spending bill passed specifically to combat a recession", explanation: "This requires a new act of Congress each time and is therefore discretionary fiscal policy, not automatic." },
      { text: "The Federal Reserve lowering the fed funds rate target", explanation: "This is a monetary policy action by the Fed, not a fiscal stabilizer." },
      { text: "A one-time tax rebate check authorized by a special act of Congress", explanation: "A one-time rebate requiring specific new legislation is discretionary fiscal policy, not an automatic stabilizer." },
    ],
  },
  {
    id: "s65-ec-x105",
    section: "economic",
    q: "The official arbiter of when a U.S. recession begins and ends is generally recognized to be:",
    a: "The National Bureau of Economic Research's (NBER) Business Cycle Dating Committee",
    explanation: "There is no single statutory definition of a U.S. recession; the NBER's Business Cycle Dating Committee is the widely recognized nonpartisan body that reviews a range of economic data to date business cycle peaks and troughs after the fact.",
    options: [
      { text: "The National Bureau of Economic Research's (NBER) Business Cycle Dating Committee", explanation: "Correct — the NBER is the generally accepted authority for officially dating U.S. business cycle turning points." },
      { text: "The Federal Reserve Board of Governors", explanation: "The Fed sets monetary policy but does not officially declare recession start and end dates." },
      { text: "The Bureau of Labor Statistics (BLS)", explanation: "The BLS compiles employment and price data used as inputs, but it does not itself declare recessions." },
      { text: "The Congressional Budget Office (CBO)", explanation: "The CBO produces economic and budget forecasts and analysis for Congress but is not the recognized recession-dating authority." },
    ],
  },
  {
    id: "s65-ec-x106",
    section: "economic",
    q: "Under the Federal Reserve's current definition, the M1 money supply measure includes:",
    a: "Currency in circulation, demand deposits, other checkable deposits, and savings deposits",
    explanation: "In 2020 the Fed reclassified savings deposits (including money market deposit accounts) into M1 after eliminating the regulatory distinction between transaction and savings accounts, substantially broadening M1 beyond its older, narrower definition.",
    options: [
      { text: "Currency in circulation, demand deposits, other checkable deposits, and savings deposits", explanation: "Correct — since the 2020 redefinition, savings deposits are now counted within M1 alongside currency and checking-type deposits." },
      { text: "Only physical currency and coin held by the public", explanation: "This describes only the currency component; M1 is broader and also includes deposit balances." },
      { text: "Currency plus demand deposits only, excluding all savings-type accounts", explanation: "This describes the OLD, pre-2020 definition of M1; savings deposits are now included." },
      { text: "Currency plus small time deposits and retail money market funds", explanation: "This mixes an M1 component (currency) with the small time deposits and retail money market fund balances that are only counted at the M2 level, and it omits the demand and savings deposits M1 actually includes." },
    ],
  },
  {
    id: "s65-ec-x107",
    section: "economic",
    q: "Under the Federal Reserve's current definitions, M2 differs from M1 in that M2 additionally includes:",
    a: "Small-denomination time deposits and retail money market fund balances",
    explanation: "Since the 2020 redefinition folded savings deposits into M1, the layer that distinguishes M2 from M1 is now small time deposits and retail money market mutual fund balances, not savings accounts.",
    options: [
      { text: "Small-denomination time deposits and retail money market fund balances", explanation: "Correct — under the current definitions, these are the components added on top of M1 to arrive at M2." },
      { text: "Savings deposits and money market deposit accounts", explanation: "These are now part of M1 itself since the 2020 redefinition, not an addition unique to M2." },
      { text: "Physical currency held by the public", explanation: "Currency is already a component of M1; it is not something added uniquely at the M2 level." },
      { text: "Corporate equity and bond holdings of households", explanation: "Corporate securities are not part of any standard money supply measure." },
    ],
  },
  {
    id: "s65-ec-x108",
    section: "economic",
    q: "Frictional unemployment refers to unemployment that results from:",
    a: "Short-term job searches by workers transitioning between jobs or entering the labor force",
    explanation: "Frictional unemployment is considered a normal, largely unavoidable feature of a healthy labor market, reflecting the time it takes for workers and employers to find a good match.",
    options: [
      { text: "Short-term job searches by workers transitioning between jobs or entering the labor force", explanation: "Correct — frictional unemployment is the temporary unemployment that occurs during normal job transitions and labor-market entry." },
      { text: "A structural mismatch between workers' skills and the skills employers demand", explanation: "That describes structural unemployment, a different and typically longer-lasting category." },
      { text: "Job losses tied directly to a broad economic downturn", explanation: "That describes cyclical unemployment, which rises and falls with the business cycle." },
      { text: "Predictable seasonal fluctuations in demand for certain jobs", explanation: "That describes seasonal unemployment, a distinct recurring pattern rather than a job-search transition." },
    ],
  },
  {
    id: "s65-ec-x109",
    section: "economic",
    q: "Structural unemployment is most accurately described as unemployment caused by:",
    a: "A persistent mismatch between the skills or location of available workers and the requirements of available jobs",
    explanation: "Structural unemployment tends to persist even in a strong economy because it reflects a deeper mismatch (for example, due to technological change or industry decline) rather than a temporary job search or the business cycle.",
    options: [
      { text: "A persistent mismatch between the skills or location of available workers and the requirements of available jobs", explanation: "Correct — structural unemployment reflects a durable mismatch, often driven by technological or industry shifts, distinct from short-term frictional unemployment." },
      { text: "Workers voluntarily taking time to search for a better-matched job", explanation: "That describes frictional unemployment, which is shorter-term and considered a normal labor-market feature." },
      { text: "A broad decline in aggregate demand during a recession", explanation: "That describes cyclical unemployment, which tracks the business cycle rather than a skills/location mismatch." },
      { text: "Predictable, recurring seasonal hiring patterns", explanation: "That describes seasonal unemployment, an unrelated recurring pattern." },
    ],
  },
  {
    id: "s65-ec-x110",
    section: "economic",
    q: "The business cycle phase immediately following the trough — marked by renewed growth in output and employment before the economy has regained its prior peak level of activity — is best termed the:",
    a: "Recovery",
    explanation: "Recovery is the early rebuilding phase right after the trough; the term 'expansion' is more broadly used for the entire growth phase (recovery through peak), while 'peak' and 'contraction' describe the top and downturn of the cycle respectively.",
    options: [
      { text: "Recovery", explanation: "Correct — recovery describes the initial upturn immediately following the trough, before output has returned to its prior peak." },
      { text: "Peak", explanation: "The peak is the high point of the cycle, reached at the end of growth, not the phase immediately after the trough." },
      { text: "Contraction", explanation: "Contraction describes declining output following a peak, the opposite direction from the phase described." },
      { text: "Stagflation", explanation: "Stagflation describes a specific combination of stagnant growth and high inflation, not a standard business-cycle phase label." },
    ],
  },
  {
    id: "s65-ec-x111",
    section: "economic",
    q: "Which of the following is classified as a LAGGING economic indicator?",
    a: "The average duration of unemployment",
    explanation: "The average duration of unemployment tends to keep rising for a while even after a recession has ended, since employers are typically slow to resume hiring — a hallmark of a lagging indicator, which confirms a trend only after it has already occurred.",
    options: [
      { text: "The average duration of unemployment", explanation: "Correct — this indicator continues moving in the old direction for some time after a turning point, the defining trait of a lagging indicator." },
      { text: "Building permits for new private housing", explanation: "Building permits are a classic leading indicator, signaling future construction activity." },
      { text: "The stock market (a broad equity index)", explanation: "Equity markets are generally treated as a leading indicator, since prices tend to anticipate future economic conditions." },
      { text: "New orders for durable goods", explanation: "New orders are a leading indicator, since production and shipments typically follow with a lag." },
    ],
  },
  {
    id: "s65-ec-x112",
    section: "economic",
    q: "Coincident indicators are used to gauge where the economy stands right now. Which measure below is treated as one?",
    a: "Personal income less transfer payments",
    explanation: "Coincident indicators move together with the overall economy in real time, helping confirm the current state of the cycle rather than predict or lag it. Personal income (excluding transfer payments like unemployment benefits) tracks current economic activity closely.",
    options: [
      { text: "Personal income less transfer payments", explanation: "Correct — this measure moves together with current economic activity and is used to gauge the present state of the cycle." },
      { text: "The yield curve spread between long- and short-term Treasuries", explanation: "The yield curve is treated as a leading indicator, since it has historically moved ahead of changes in the business cycle." },
      { text: "The average duration of unemployment", explanation: "This is a lagging indicator, confirming a trend only after it has already played out." },
      { text: "Corporate profits", explanation: "Corporate profits are not a coincident measure — they are reported with a lag and confirm activity only after the fact. (They are not among the four components of the Conference Board's coincident index: payroll employment, personal income less transfer payments, industrial production, and manufacturing and trade sales.)" },
    ],
  },
  {
    id: "s65-ec-x113",
    section: "economic",
    q: "An inverted yield curve is closely watched by economists primarily because it has historically:",
    a: "Preceded many past U.S. recessions, making it a widely followed leading indicator",
    explanation: "While not a guarantee, an inverted yield curve — where short-term rates exceed long-term rates — has preceded most U.S. recessions in recent decades, which is why it is included among the components tracked as a leading economic indicator.",
    options: [
      { text: "Preceded many past U.S. recessions, making it a widely followed leading indicator", explanation: "Correct — its historical track record of appearing before downturns is why it is treated as a leading signal, though not a certainty." },
      { text: "Guaranteed that a recession will occur within the following year", explanation: "An inverted curve is a strong historical signal but not a guarantee; some inversions have not been followed by recession." },
      { text: "Indicated that the Federal Reserve is actively easing monetary policy", explanation: "An inversion more commonly reflects tight short-term policy relative to growth expectations, not an easing stance." },
      { text: "Shown that short- and long-term interest rates are exactly equal", explanation: "That describes a flat, not inverted, yield curve; inversion means short-term rates exceed long-term rates." },
    ],
  },
  {
    id: "s65-ec-x114",
    section: "economic",
    q: "The 'crowding out' effect describes a risk most associated with:",
    a: "Large government deficit spending financed by borrowing, which can push up interest rates and reduce private investment",
    explanation: "When the government borrows heavily to finance deficits, increased demand for loanable funds can raise interest rates, making it more costly for private businesses to borrow and invest — effectively 'crowding out' private-sector activity.",
    options: [
      { text: "Large government deficit spending financed by borrowing, which can push up interest rates and reduce private investment", explanation: "Correct — heavy government borrowing competing for loanable funds is the classic mechanism behind crowding out." },
      { text: "Expansionary monetary policy that lowers interest rates", explanation: "Lower rates from expansionary monetary policy would tend to encourage, not crowd out, private investment." },
      { text: "A shrinking trade deficit as exports rise", explanation: "Trade balance changes are a separate concept from the government-borrowing mechanism behind crowding out." },
      { text: "Contractionary fiscal policy that reduces government spending", explanation: "Reduced government spending would tend to ease pressure on interest rates, the opposite of the crowding-out scenario." },
    ],
  },
  {
    id: "s65-ec-x115",
    section: "economic",
    q: "The Phillips curve is traditionally used to illustrate a historical tradeoff between:",
    a: "Inflation and unemployment",
    explanation: "The classic Phillips curve depicts an inverse relationship in which lower unemployment has historically been associated with higher inflation, and vice versa, though the relationship has weakened and shifted over time.",
    options: [
      { text: "Inflation and unemployment", explanation: "Correct — the Phillips curve traditionally illustrates the inverse relationship between these two variables." },
      { text: "GDP growth and long-term interest rates", explanation: "This is not the relationship the Phillips curve depicts; it specifically concerns inflation and unemployment." },
      { text: "National savings and investment", explanation: "The savings-investment relationship is a separate macroeconomic concept, unrelated to the Phillips curve." },
      { text: "Imports and exports", explanation: "Trade flows are captured in the balance of trade, not the Phillips curve." },
    ],
  },
  {
    id: "s65-ec-x116",
    section: "economic",
    q: "To cool an overheating, high-inflation economy, contractionary FISCAL policy would most likely involve:",
    a: "Raising taxes and/or reducing government spending",
    explanation: "Contractionary fiscal policy withdraws demand from the economy by increasing taxes and/or cutting government outlays, reducing disposable income and spending to help rein in inflation.",
    options: [
      { text: "Raising taxes and/or reducing government spending", explanation: "Correct — these are the fiscal-policy levers used to withdraw demand from an overheating economy." },
      { text: "Cutting taxes to stimulate additional consumer spending", explanation: "A tax cut is expansionary fiscal policy, which would add rather than withdraw demand." },
      { text: "The Federal Reserve raising the fed funds rate target", explanation: "That is a monetary policy action taken by the Fed, not a fiscal policy tool exercised by Congress and the President." },
      { text: "Increasing the money supply through open market purchases", explanation: "Expanding the money supply is an expansionary monetary policy action, not a fiscal policy tool." },
    ],
  },
  {
    id: "s65-ec-x117",
    section: "economic",
    q: "The GDP deflator differs from the Consumer Price Index (CPI) primarily in that the GDP deflator:",
    a: "Reflects price changes across all goods and services produced domestically, rather than a fixed basket of consumer purchases",
    explanation: "The CPI tracks a fixed 'market basket' of goods and services purchased by urban consumers, while the GDP deflator is a broader, changing-weight measure covering all domestically produced output, including investment and government purchases.",
    options: [
      { text: "Reflects price changes across all goods and services produced domestically, rather than a fixed basket of consumer purchases", explanation: "Correct — the GDP deflator covers the full range of domestic output, unlike the CPI's fixed consumer basket." },
      { text: "Measures only the prices of imported goods", explanation: "Import prices are not the focus of the GDP deflator, which covers domestic production broadly." },
      { text: "Is compiled and published by the Bureau of Labor Statistics using the same methodology as the CPI", explanation: "The GDP deflator is derived from national income accounts (BEA data), a different methodology and source than the CPI." },
      { text: "Tracks only the prices producers receive, excluding consumer-level prices entirely", explanation: "That describes the Producer Price Index (PPI), a different and narrower measure than the GDP deflator." },
    ],
  },
  {
    id: "s65-ec-x118",
    section: "economic",
    q: "All else equal, a widening U.S. trade deficit (imports growing faster than exports) has what direct effect on GDP as calculated under the expenditure approach?",
    a: "It reduces GDP, since net exports (exports minus imports) is a negative component when imports exceed exports",
    explanation: "GDP = Consumption + Investment + Government spending + Net exports. Because net exports is exports minus imports, a growing trade deficit makes that term more negative and directly subtracts from measured GDP, all else equal.",
    options: [
      { text: "It reduces GDP, since net exports (exports minus imports) is a negative component when imports exceed exports", explanation: "Correct — a larger trade deficit means a more negative net exports term, which directly lowers GDP in the expenditure formula." },
      { text: "It increases GDP, since imports represent additional spending activity", explanation: "Imports are subtracted out precisely because they represent foreign, not domestic, production; more imports lower net exports and GDP." },
      { text: "It has no effect on GDP, since GDP only measures domestic consumption", explanation: "GDP explicitly includes a net exports term, so trade flows do directly affect the calculation." },
      { text: "It affects GNP but is excluded from the GDP calculation entirely", explanation: "Net exports is one of the four standard components of GDP itself, not solely a GNP concept." },
    ],
  },
  {
    id: "s65-ec-x119",
    section: "economic",
    q: "The Federal Reserve's statutory 'dual mandate' refers to its objectives of:",
    a: "Maximum employment and stable prices",
    explanation: "Congress has directed the Federal Reserve to pursue maximum employment and price stability (commonly summarized as the 'dual mandate'), alongside a statutory reference to moderate long-term interest rates.",
    options: [
      { text: "Maximum employment and stable prices", explanation: "Correct — these are the two goals commonly summarized as the Fed's dual mandate under its statutory objectives." },
      { text: "A balanced federal budget and low tax rates", explanation: "Budget and tax policy are fiscal matters controlled by Congress, not objectives assigned to the Federal Reserve." },
      { text: "Maximizing GDP growth and minimizing the trade deficit", explanation: "These are not the Fed's statutory mandate; the Fed's objectives are framed around employment and price stability." },
      { text: "High interest rates and low bank reserve levels", explanation: "These describe potential policy settings, not the Fed's statutory goals, which are employment and price stability." },
    ],
  },
  {
    id: "s65-ec-x120",
    section: "economic",
    q: "When the Federal Reserve lowers the discount rate, it is most directly:",
    a: "Making it less costly for depository institutions to borrow reserves directly from the Fed's discount window",
    explanation: "The discount rate is the rate the Fed itself charges on direct loans to depository institutions, distinct from the fed funds rate (which banks charge each other) and the prime rate (which banks charge top customers).",
    options: [
      { text: "Making it less costly for depository institutions to borrow reserves directly from the Fed's discount window", explanation: "Correct — the discount rate specifically governs the cost of direct borrowing from the Federal Reserve itself." },
      { text: "Lowering the rate banks charge one another for overnight reserve loans", explanation: "That is the fed funds rate, a related but distinct rate set in the interbank market rather than charged by the Fed directly." },
      { text: "Directly setting the interest rate on newly originated 30-year mortgages", explanation: "Mortgage rates are set by lenders based on broader market conditions and are not directly set by the discount rate." },
      { text: "Raising the reserve requirement ratio for member banks", explanation: "The reserve requirement is a separate monetary policy tool from the discount rate, and this describes a tightening, not easing, action." },
    ],
  },
];
