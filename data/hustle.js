// COOP Careers Financial Services Track — Hustle pillar curriculum
// The job search itself. Same shape as data/curriculum.js's MODULES/
// FLASHCARDS/INTERVIEW_QUESTIONS — read that file before editing this one.
// Target roles: JP Morgan Wealth Management, CFA-track analyst roles,
// financial-services analytics.

/**
 * HUSTLE_MODULES — the Hustle pillar's module list, in data/curriculum.js's
 * exact MODULES shape: { id, title, icon, color, light, description,
 * coopModule, lessons: [{ id, title, minutes, body, challenge,
 * exampleOutput, quiz: [{ q, a, explanation, options: [{ text, explanation }] }] }] }.
 * @type {Array<object>}
 */
export const HUSTLE_MODULES = [
  {
    id: "hustle-materials",
    title: "Building Your Materials",
    icon: "📄",
    color: "#15803d",
    light: "#f0fdf4",
    description: "Resume, LinkedIn, and a reusable STAR story bank built for financial-services roles and the ATS filters that read them first.",
    coopModule: "Resume, LinkedIn & personal brand module",
    lessons: [
      {
        id: "hustle-materials-1",
        title: "Resume architecture for finance roles (and ATS reality)",
        minutes: 8,
        body: [
          "Before a human ever sees your resume, an Applicant Tracking System (ATS) parses it for keywords matched against the job description and often ranks or filters candidates before a recruiter opens the file. A resume that's beautifully designed but poorly parsed — columns, text boxes, graphics — can get silently dropped.",
          "Finance-specific architecture: reverse-chronological, one page for entry-level, standard section order (Summary / Education / Experience / Skills), and bullets that follow the formula Action verb + what you did + quantified result. 'Analyzed a 100-record loan dataset to compute approval-rate disparities across 6 demographic groups, flagging a 0.60 four-fifths ratio' beats 'Responsible for data analysis.'",
          "ATS keyword matching: pull 8-10 exact phrases from the job posting itself, not synonyms — 'financial modeling,' 'Excel,' 'XLOOKUP,' 'client relationship management' — and make sure those exact strings appear somewhere on your resume, ideally in a bullet with context, not just a keyword-stuffed list.",
        ],
        challenge: "Take one real job posting for a role you want (JPM Wealth Management Analyst or similar). Pull 8 exact keyword phrases from it. Rewrite 3 of your resume bullets to include those exact phrases in context, each ending in a quantified result.",
        exampleOutput: "8 exact phrases lifted verbatim from a real posting, and 3 rewritten bullets each containing at least one exact phrase plus a number or quantified outcome — not vague 'responsible for' language.",
        quiz: [
          { q: "A resume bullet reads 'Responsible for financial analysis and reporting.' What's the single biggest problem with it, per this lesson?", a: "No quantified result and no specific action verb — it describes a duty, not an accomplishment", explanation: "The lesson's formula is action verb + what you did + quantified result — this bullet has none of the last two.", options: [
            { text: "No quantified result and no specific action verb — it describes a duty, not an accomplishment", explanation: "Correct — this bullet is a job-duty description, not an achievement with evidence." },
            { text: "It's too short", explanation: "Length isn't the issue — a short bullet with a strong verb and a number would be fine." },
            { text: "It uses too much jargon", explanation: "The bullet actually uses too little specificity, not too much jargon." },
            { text: "It's not bolded", explanation: "Formatting emphasis isn't what makes a bullet weak — content specificity is." },
          ] },
          { q: "Why might a well-designed resume with columns and graphics score worse with an ATS than a plain one?", a: "Many ATS parsers can't reliably read multi-column layouts or text embedded in graphics, so content can be dropped", explanation: "This is the concrete mechanical reason design-heavy resumes can silently underperform with ATS software.", options: [
            { text: "Many ATS parsers can't reliably read multi-column layouts or text embedded in graphics, so content can be dropped", explanation: "Correct — this is exactly the parsing failure mode the lesson describes." },
            { text: "ATS systems penalize any visual design regardless of format", explanation: "The issue is specifically layouts that break parsing (columns, graphics), not visual design in general." },
            { text: "It's a myth — ATS has no effect on formatting", explanation: "ATS parsing failures on complex layouts are a well-documented, real phenomenon, not a myth." },
            { text: "Only PDF resumes are affected; Word documents are always safe", explanation: "Parsing problems depend on layout complexity, not file format alone — a complex Word layout can fail too." },
          ] },
        ],
      },
      {
        id: "hustle-materials-2",
        title: "LinkedIn optimization for recruiters and ATS",
        minutes: 6,
        body: [
          "LinkedIn is a second, parallel ATS: recruiters at target firms search it directly using keyword filters (title, skills, school, location), and your profile needs to surface in those searches whether or not you've applied yet.",
          "Highest-leverage fields, in order: headline (not just 'Student at X' — use 'Aspiring Financial Analyst | Excel, Tableau, XLOOKUP | COOP Careers Fellow'), the About section's first two lines (visible before 'see more' — put your target role and top skill there), and the Skills section (add and get endorsed for the exact skills recruiters filter by: Excel, Financial Modeling, Data Analysis, Tableau).",
          "The 'Open to Work' setting has two modes: visible to everyone, or visible only to recruiters. For an active search, the recruiter-only setting signals availability to the people who matter without broadcasting a job search to your current employer or wider network.",
        ],
        challenge: "Rewrite your LinkedIn headline and the first two lines of your About section using the target-role + top-3-skills formula. Add or reorder your Skills section so the 3 skills most relevant to your target role are in the first 3 slots.",
        exampleOutput: "A headline naming a specific target role plus 2-3 concrete skills (not generic like 'motivated professional'), and an About section opening that states the target role in the first sentence before the 'see more' cutoff.",
        quiz: [
          { q: "Why does the first two lines of the About section matter disproportionately?", a: "LinkedIn truncates the About section behind a 'see more' click, so only the first couple lines are seen by default", explanation: "This is the mechanical reason those first lines are the only guaranteed real estate you have there.", options: [
            { text: "LinkedIn truncates the About section behind a 'see more' click, so only the first couple lines are seen by default", explanation: "Correct — this is the exact reason those opening lines carry disproportionate weight." },
            { text: "LinkedIn ranks profiles by About-section length", explanation: "Length itself isn't the ranking factor — visibility of the first lines is." },
            { text: "Recruiters never read past the headline anyway, so About barely matters", explanation: "The lesson treats the About opening as high-leverage precisely because it IS read, just only the visible portion." },
            { text: "The first lines are the only part indexed by search", explanation: "Search indexing isn't the mechanism here — visible-before-click truncation is." },
          ] },
          { q: "You're actively job searching but don't want your current employer to see it. What's the right 'Open to Work' setting?", a: "Recruiter-only visibility, not the public badge", explanation: "This is exactly the setting the lesson describes as signaling availability without broadcasting it broadly.", options: [
            { text: "Fully public visibility, since it signals ambition", explanation: "Public visibility risks your current employer or network seeing the signal, which the scenario wants to avoid." },
            { text: "Recruiter-only visibility, not the public badge", explanation: "Correct — this targets the people who matter without broad visibility." },
            { text: "Turn 'Open to Work' off entirely, since any visibility carries equal risk", explanation: "This forgoes the recruiter-only option, which specifically exists to avoid that tradeoff." },
            { text: "It doesn't matter — current employers can't see either setting", explanation: "The two settings differ precisely in who can see them, which is the whole point of the feature." },
          ] },
        ],
      },
      {
        id: "hustle-materials-3",
        title: "The STAR story bank — your reusable interview asset",
        minutes: 7,
        body: [
          "Rebuilding a STAR answer from scratch mid-interview is the single most common cause of a rambling response. The fix is a story BANK built ahead of time: 6-8 real experiences, each pre-written in STAR format, each tagged with which common behavioral question(s) it answers.",
          "Build coverage, not repetition: aim for stories that cover conflict/disagreement, failure/mistake, leadership without authority, working under pressure/deadline, and a quantifiable analytical win — your governance project or an Excel/Tableau deliverable is ideal for this last one. One strong story can often answer 2-3 different questions with a different emphasis.",
          "Maintain it like a living document: after every interview, add the exact question asked and which bank story you used, or wish you'd had. This turns each interview into data that improves the next one, rather than a one-off event you just try to survive.",
        ],
        challenge: "Build your story bank: list 6 real experiences in a table with columns [Story name, STAR summary in 1 line each, Which behavioral questions it answers]. At least one story must be your COOP/analytical project.",
        exampleOutput: "A 6-row table, each row naming a distinct real experience with a one-line STAR summary and at least one tagged behavioral question category (conflict, failure, leadership, pressure, analytical win), with the analytical-win row referencing a specific project.",
        quiz: [
          { q: "Why is a pre-built story bank better than improvising STAR answers live?", a: "It prevents rambling under interview pressure and ensures you've already found the strongest example for each question category", explanation: "This is the core reason the lesson recommends building the bank ahead of time rather than improvising.", options: [
            { text: "It prevents rambling under interview pressure and ensures you've already found the strongest example for each question category", explanation: "Correct — this is exactly the value of preparing the bank in advance." },
            { text: "Interviewers can tell when answers are prepared and penalize it", explanation: "Preparation isn't penalized when the delivery is natural — the lesson recommends preparing precisely because it helps." },
            { text: "It's only useful for technical questions, not behavioral ones", explanation: "The story bank is specifically built for behavioral questions, not technical ones." },
            { text: "Memorized answers are always more persuasive than spontaneous ones regardless of content", explanation: "The value isn't memorization for its own sake — it's having already found the strongest real example, reducing improvisation risk." },
          ] },
          { q: "One of your bank stories can answer both 'tell me about a conflict' and 'tell me about a time you influenced someone without authority.' Should you worry about reusing it?", a: "No — a story naturally covering multiple angles is a feature of a good bank, as long as you adjust emphasis per question", explanation: "The lesson explicitly says one strong story can answer multiple questions with different emphasis — that's a strength, not a flaw.", options: [
            { text: "Yes, each question needs a completely separate story or it looks rehearsed", explanation: "The lesson explicitly treats one story covering multiple angles as a strength, not something to avoid." },
            { text: "No — a story naturally covering multiple angles is a feature of a good bank, as long as you adjust emphasis per question", explanation: "Correct — this matches the lesson's guidance directly." },
            { text: "Only use it for whichever question is asked first", explanation: "There's no need to retire a versatile story after one use — adjusting emphasis lets it serve multiple questions." },
            { text: "Rewrite a new story instead, since reuse always seems evasive", explanation: "Reuse with adjusted emphasis is exactly what the lesson recommends, not something to avoid." },
          ] },
        ],
      },
    ],
  },
  {
    id: "hustle-network",
    title: "The Network Engine",
    icon: "🔗",
    color: "#a16207",
    light: "#fefce8",
    description: "Informational interviews, pipeline discipline, and the follow-up habits that turn one conversation into a real network — COOP's actual networking engine.",
    coopModule: "Networking & pipeline management module",
    lessons: [
      {
        id: "hustle-network-1",
        title: "Informational interviews: the exact ask",
        minutes: 8,
        body: [
          "An informational interview is a 15-20 minute conversation with someone in a role or firm you're targeting — not a job ask, not a favor request. Framing it as anything other than 'I want to learn from your experience' makes people defensive; framing it correctly makes most professionals genuinely glad to help, especially COOP and fellowship alumni networks.",
          "Here is the exact 4-sentence ask, adaptable to a LinkedIn message or email: 'Hi [Name], I'm a fellow in COOP Careers' Financial Services program and I'm exploring analyst-track roles like the one you're in at [Firm]. I'd love to hear about your path into [role/team] and what a typical week actually looks like — would you have 15 minutes for a quick call in the next couple of weeks? Happy to work around your schedule. Thanks so much for considering it.' Sentence 1 establishes who you are and why you're credible. Sentence 2 states a specific, narrow ask — their path and day-to-day, not 'advice' broadly. Sentence 3 makes the logistics low-friction. Sentence 4 is a genuine thank-you regardless of their answer.",
          "What to do with the reply: if yes, send 2-3 calendar options within the hour — momentum matters — and prepare 4-5 specific questions in advance, never 'so, any advice for me?' Ask about a specific decision point in their career, a specific skill their role uses daily, or how their team actually spends a typical Tuesday. If no reply after 7-10 days, one polite follow-up is appropriate; after that, move on without taking it personally.",
        ],
        challenge: "Identify 3 real people (a LinkedIn search for alumni from your school or COOP at your 3 target firms works well) and send the 4-sentence ask, personalized with their actual name, firm, and role. Prepare your 4-5 questions in advance for whichever replies first.",
        exampleOutput: "3 sent messages, each personalized (real name/firm/role substituted into the template, not left generic), plus a written list of 4-5 specific, non-generic questions ready for the first person who says yes.",
        quiz: [
          { q: "Which version of an outreach message is most likely to get a 'yes'?", a: "The 4-sentence version naming a specific credible connection, a narrow specific ask, low-friction logistics, and genuine thanks", explanation: "This is exactly the structure the lesson lays out sentence by sentence, and it's designed to minimize the recipient's friction and discomfort.", options: [
            { text: "The 4-sentence version naming a specific credible connection, a narrow specific ask, low-friction logistics, and genuine thanks", explanation: "Correct — this matches the lesson's exact 4-sentence template." },
            { text: "A message asking generally 'can you help me get a job at your firm'", explanation: "This is the job-ask framing the lesson specifically warns makes people defensive." },
            { text: "A message asking for 'any advice you have' with no specific ask", explanation: "A vague, broad ask is harder to say yes to than a narrow, specific one." },
            { text: "A long message detailing your full resume and background before asking anything", explanation: "This buries the ask and adds friction instead of making it quick and easy to respond to." },
          ] },
          { q: "Someone agrees to a 15-minute call. What should you do in the first hour after they say yes?", a: "Send 2-3 specific calendar time options right away", explanation: "Acting quickly with concrete options keeps the momentum from the reply and avoids logistics stalling the whole conversation.", options: [
            { text: "Send 2-3 specific calendar time options right away", explanation: "Correct — this preserves momentum right after a yes." },
            { text: "Wait a few days to seem less eager", explanation: "Delaying risks losing the momentum of their yes for no real benefit." },
            { text: "Ask them to just pick any time whenever, with no options offered", explanation: "This puts more logistical work on them, adding friction instead of removing it." },
            { text: "Send your resume immediately, before the call happens", explanation: "This reframes the conversation toward a job ask, which contradicts the informational-interview framing." },
          ] },
        ],
      },
      {
        id: "hustle-network-2",
        title: "Application tracking and pipeline discipline",
        minutes: 6,
        body: [
          "A finance job search run from memory — 'did I already apply there? did I hear back?' — loses opportunities to simple disorganization, not to being unqualified. A tracker is the single highest-leverage, lowest-effort tool in the whole search.",
          "Minimum viable tracker columns: Company, Role, Date applied, Source (referral / cold / recruiter), Status (applied / screen / interview / offer / rejected), Next action, Next action date. Sort by 'next action date' weekly — this turns the tracker from a record into a to-do list.",
          "Pipeline discipline means treating volume AND quality as both mattering: a target of a small number of high-fit applications per week, sustained consistently over the weeks before and during the fellowship, beats either a single frantic week of mass-applying or a handful of 'someday' applications with no cadence.",
        ],
        challenge: "Build your tracker with the 7 columns above. Populate it with every role you've already applied to (even informally), plus 3 new target roles with a 'next action' and date for each.",
        exampleOutput: "A tracker with all 7 specified columns, at least 3 populated rows with realistic 'next action' entries and dates (not blank or vague like 'follow up sometime').",
        quiz: [
          { q: "Why is 'next action date' the most important column to sort by weekly?", a: "It converts the tracker from a passive log into an actionable to-do list", explanation: "This is the exact function the lesson assigns to that column — it's what makes the tracker useful week to week.", options: [
            { text: "It converts the tracker from a passive log into an actionable to-do list", explanation: "Correct — this is precisely why sorting by it weekly matters." },
            { text: "It's mainly useful for calculating total time spent searching", explanation: "Time tracking isn't the purpose the lesson describes — actionability is." },
            { text: "It isn't important; status is the only column that matters", explanation: "Status alone doesn't tell you what to do next this week — next action date does." },
            { text: "It's only useful after you've received an offer", explanation: "It's most useful throughout the active search, not only after an offer arrives." },
          ] },
          { q: "You've applied to 40 roles in one weekend with no research on fit, and heard back from none. What does pipeline discipline suggest went wrong?", a: "Volume without quality/fit filtering rarely converts — a smaller, well-matched, sustained cadence performs better", explanation: "This is exactly the tradeoff the lesson names between a single high-volume burst and a sustained, filtered cadence.", options: [
            { text: "Volume without quality/fit filtering rarely converts — a smaller, well-matched, sustained cadence performs better", explanation: "Correct — this matches the lesson's framing of pipeline discipline directly." },
            { text: "40 is too few; apply to 100 more immediately", explanation: "This doubles down on volume without addressing the fit-filtering problem the scenario describes." },
            { text: "Nothing went wrong; response rates are always this low regardless of fit", explanation: "The lesson specifically attributes poor conversion to lack of fit filtering, not an immutable baseline rate." },
            { text: "Switch to only applying through recruiters from now on", explanation: "This changes the source channel but doesn't address the core issue of unfiltered, unsustained volume." },
          ] },
        ],
      },
      {
        id: "hustle-network-3",
        title: "Follow-up and relationship maintenance",
        minutes: 6,
        body: [
          "Most people treat networking as a series of one-off transactions — one informational interview, done — instead of relationships that compound. A contact from month one who hears from you again in month four with a genuine update is far more likely to advocate for you than a stranger you're cold-messaging for the first time when you finally need something.",
          "The follow-up cadence: within 24 hours of any informational interview or interview round, send a specific thank-you referencing one actual thing they said, not a generic 'thanks for your time.' Then, roughly every 6-8 weeks, send a brief, low-pressure update to contacts who were generous with their time — a genuine milestone (completed the fellowship, landed an interview, a relevant article) works better than 'just checking in.'",
          "The rule for asking a contact for something a second time: lead with what's changed or what you've done with their advice since the first conversation, THEN make the next ask. 'Following your advice about X, I did Y — I'm now looking at Z, any thoughts?' earns far more goodwill than a repeat cold ask with no update.",
        ],
        challenge: "Write a 24-hour thank-you note template referencing something specific a contact could plausibly say in an informational interview. Then write a 6-8-week 'genuine update' message template you could send to that same contact later.",
        exampleOutput: "Two distinct templates: a thank-you referencing one specific, plausible detail from the conversation (not generic), and a later update message that leads with a real update before any ask, if there is one.",
        quiz: [
          { q: "Which thank-you note is most effective after an informational interview?", a: "One that references a specific detail they shared", explanation: "A specific reference shows you were genuinely listening and makes the thank-you memorable rather than generic.", options: [
            { text: "One that references a specific detail they shared", explanation: "Correct — specificity is what the lesson identifies as most effective." },
            { text: "A generic 'thanks for your time, much appreciated'", explanation: "This is exactly the generic version the lesson says to avoid." },
            { text: "No thank-you at all, since the conversation itself was the value", explanation: "Skipping the thank-you forgoes an easy, low-cost relationship-building step." },
            { text: "A thank-you that immediately asks for a second favor", explanation: "Stacking a new ask onto the thank-you undercuts the genuine, low-pressure gratitude the lesson recommends." },
          ] },
          { q: "You want to reconnect with a contact 3 months after your first conversation, and you now need a new favor. What should come first in your message?", a: "A genuine update on what you've done since, ideally referencing their advice, before making the new ask", explanation: "Leading with an update honors the relationship and earns goodwill before introducing a new request, exactly as the lesson describes.", options: [
            { text: "A genuine update on what you've done since, ideally referencing their advice, before making the new ask", explanation: "Correct — this is the exact sequencing the lesson recommends." },
            { text: "The new ask stated directly and immediately", explanation: "Leading with the ask, with no update, is the repeat-cold-ask pattern the lesson says earns less goodwill." },
            { text: "An apology for not staying in touch sooner", explanation: "An apology doesn't add the value an update does, and isn't the recommended opener." },
            { text: "Nothing — wait for them to reach out first", explanation: "Passive waiting doesn't reconnect the relationship or make the needed ask." },
          ] },
        ],
      },
    ],
  },
  {
    id: "hustle-interview",
    title: "Interview & Offer",
    icon: "🎯",
    color: "#4338ca",
    light: "#eef2ff",
    description: "Behavioral prep, financial-services technical/case rounds, negotiating the offer, and the plan you present once you're in the seat.",
    coopModule: "Interview preparation & negotiation module",
    lessons: [
      {
        id: "hustle-interview-1",
        title: "Behavioral interview prep",
        minutes: 6,
        body: [
          "Behavioral interviews assume past behavior predicts future behavior — every question is really asking 'show me a specific instance,' and your STAR story bank is the raw material. The prep work here is matching bank stories to the specific question categories finance interviewers actually ask.",
          "The finance-specific categories to have ready: a time you handled ambiguous or incomplete data, a time you caught an error — yours or someone else's — before it caused a problem, a time you had to explain something technical to a non-technical audience, and a time you managed competing deadlines. Each maps directly to a real day in an analyst role.",
          "Practice out loud, not just on paper — timing and delivery are part of what's being assessed. A story that reads well at 200 words on a page can ramble to 4 minutes spoken; time yourself and cut to under 90 seconds.",
        ],
        challenge: "From your story bank, select and rehearse (out loud, timed) one story for each of the 4 finance-specific categories above. Cut any that run over 90 seconds.",
        exampleOutput: "4 distinct stories, one per named category, each timed under 90 seconds when spoken aloud — not just read silently.",
        quiz: [
          { q: "Why do finance interviewers specifically ask about handling ambiguous or incomplete data?", a: "Real analyst work regularly involves messy, incomplete datasets, so the question tests whether you can still produce a defensible answer", explanation: "This question maps directly to a genuine, common day-to-day condition in analyst roles, which is why it's asked so often.", options: [
            { text: "Real analyst work regularly involves messy, incomplete datasets, so the question tests whether you can still produce a defensible answer", explanation: "Correct — this matches the lesson's framing of why this category matters." },
            { text: "It's a trick question with no real relevance to the job", explanation: "The lesson explicitly ties this category to a real, common condition of analyst work." },
            { text: "It's only asked at senior levels, not entry-level", explanation: "The lesson lists this as one of the core entry-level finance-specific categories to prepare." },
            { text: "It's testing whether you'll admit you've never encountered messy data", explanation: "The point is assessing how you handle the situation, not extracting an admission of inexperience." },
          ] },
          { q: "You rehearse a story and it runs 4 minutes when spoken aloud, even though it read fine on paper. What should you do?", a: "Cut it down — spoken delivery reveals pacing problems that reading silently hides", explanation: "This is exactly the gap the lesson warns about between written length and spoken pacing.", options: [
            { text: "Cut it down — spoken delivery reveals pacing problems that reading silently hides", explanation: "Correct — this matches the lesson's guidance to rehearse out loud and cut to under 90 seconds." },
            { text: "Keep it as is, since detail is always valued", explanation: "Excess length in a spoken answer isn't the same as valuable detail — it reads as rambling." },
            { text: "Switch to reading directly from notes during the interview", explanation: "Reading from notes during a live interview undermines natural delivery rather than fixing pacing." },
            { text: "Only rehearse mentally from now on to save time", explanation: "Mental-only rehearsal is exactly what hid the pacing problem in the first place — out-loud rehearsal is what surfaces it." },
          ] },
        ],
      },
      {
        id: "hustle-interview-2",
        title: "Technical and case interview prep for financial services",
        minutes: 8,
        body: [
          "Financial-services technical rounds test a mix of Excel/analytical fluency — can you actually build the pivot table or four-fifths calculator you claim to know — and market/business judgment. Entry-level and fellowship-adjacent roles weight the former much more heavily than the latter.",
          "The single highest-leverage prep move: be able to walk through the four-fifths bias calculation and a basic Excel pivot LIVE, out loud, from memory — not describe it, actually do it. Interviewers in analytics-adjacent finance roles routinely ask candidates to share their screen and build something in real time.",
          "Case interview structure (if asked a business case, e.g., 'how would you assess whether this lending model is fair'): state your framework out loud before diving in — 'I'd look at this in three parts: the data, the statistical test, and the regulatory framing' — then work each part methodically, narrating your reasoning rather than going silent while you think.",
        ],
        challenge: "Do a live, timed, out-loud walkthrough (record yourself or practice with a peer) of building a four-fifths calculator in Excel from a blank sheet, narrating every step as if an interviewer is watching. Time how long it takes.",
        exampleOutput: "A timed self-recorded or peer-observed walkthrough where every step (COUNTIFS, rate, ratio, flag) is both performed and narrated out loud, not done silently.",
        quiz: [
          { q: "Why might an entry-level finance interview ask you to build a pivot table live on screen-share, rather than just asking you to describe how you'd do it?", a: "It verifies actual hands-on fluency rather than the ability to describe a process you may not have really practiced", explanation: "Live building is a direct test of fluency that description alone can't verify.", options: [
            { text: "It verifies actual hands-on fluency rather than the ability to describe a process you may not have really practiced", explanation: "Correct — this is exactly why live building is used to test fluency." },
            { text: "It's testing typing speed specifically", explanation: "Typing speed isn't the point — demonstrated familiarity with the actual steps is." },
            { text: "Live building is only used for senior technical roles", explanation: "The lesson describes this as a routine practice for entry-level and analytics-adjacent roles specifically." },
            { text: "It's meant to be intentionally impossible to complete", explanation: "The exercise is meant to be genuinely achievable by someone who actually knows the material, not a trap." },
          ] },
          { q: "What should you do before diving into a business case question?", a: "State your framework or structure out loud first, then work through it methodically", explanation: "This is the exact case-structure move the lesson recommends — announcing the approach before executing it.", options: [
            { text: "State your framework or structure out loud first, then work through it methodically", explanation: "Correct — this matches the lesson's guidance directly." },
            { text: "Start calculating immediately without stating any structure", explanation: "Skipping the framework statement makes your reasoning harder to follow and assess." },
            { text: "Ask the interviewer to just give you the answer's shape first", explanation: "Structuring the case is your job to demonstrate, not something to outsource to the interviewer." },
            { text: "Stay silent while thinking through the whole case, then give one final answer", explanation: "The lesson specifically recommends narrating your reasoning rather than going silent." },
          ] },
        ],
      },
      {
        id: "hustle-interview-3",
        title: "Salary negotiation",
        minutes: 7,
        body: [
          "Most entry-level candidates don't negotiate at all, leaving money on the table by default — but the fix isn't aggressive demands, it's a specific, low-risk script used at the right moment: after an offer, before acceptance, never before an offer exists.",
          "The script: 'Thank you so much for the offer — I'm genuinely excited about this role. Before I accept, is there any flexibility on [base salary / signing bonus]? I want to make sure I'm saying yes at a number that reflects the market for this role.' This is polite, specific, and gives them room to say no without either side losing face.",
          "What you need before using it: one data point on market range — levels.fyi, Glassdoor, or a specific number a cohort peer or mentor shared — so your ask isn't a guess. Even if they say no, a polite, well-timed ask almost never costs you the offer; silence costs you the raise with certainty.",
        ],
        challenge: "Find one real market-range data point for a role you're targeting (a specific number or range from a real source). Write your negotiation script using that number as your anchor, adapted to your actual situation.",
        exampleOutput: "One cited market-range data point (source named) plugged into the negotiation script template, personalized to a specific real or targeted offer scenario.",
        quiz: [
          { q: "When is the right time to raise salary negotiation, per this lesson?", a: "After receiving a written offer, before formally accepting", explanation: "This is the exact window the lesson specifies for negotiation — after the offer exists, before you've committed.", options: [
            { text: "During the first interview, to set expectations early", explanation: "Negotiating before an offer even exists is premature and not what the lesson recommends." },
            { text: "After receiving a written offer, before formally accepting", explanation: "Correct — this is precisely the window the lesson names." },
            { text: "Only after starting the job, once your value is proven", explanation: "Waiting until after starting misses the window where negotiation leverage is highest — before acceptance." },
            { text: "Never, as an entry-level candidate should always accept the first number", explanation: "The lesson explicitly argues most entry-level candidates under-negotiate by default and encourages a specific low-risk ask." },
          ] },
          { q: "You're nervous that asking about flexibility on the offer might cause them to rescind it. What does the lesson say about this risk?", a: "A polite, well-timed, specific ask almost never costs the offer", explanation: "This directly addresses the fear named in the scenario with the lesson's actual claim about the low downside of asking.", options: [
            { text: "A polite, well-timed, specific ask almost never costs the offer", explanation: "Correct — this matches the lesson's explicit reassurance about the low risk of asking." },
            { text: "The risk is high and negotiation should be avoided at entry level", explanation: "This contradicts the lesson's specific point that the risk of a polite ask is low." },
            { text: "Only negotiate if you have a competing offer in hand, otherwise don't ask at all", explanation: "The lesson's script doesn't require a competing offer as a precondition for asking." },
            { text: "Rescinding offers over a polite ask is common practice, so avoid it", explanation: "The lesson specifically frames this outcome as rare, not common, for a polite and well-timed ask." },
          ] },
        ],
      },
      {
        id: "hustle-interview-4",
        title: "The 30-60-90 day plan",
        minutes: 6,
        body: [
          "A 30-60-90 day plan is both an interview asset — some interviewers explicitly ask 'what would your first 90 days look like?' — and a real onboarding tool once you start, because it signals you think in terms of concrete deliverables, not just showing up and hoping direction arrives.",
          "Structure: Days 1-30 = learning and listening (shadow, learn the specific tools/systems your team uses, meet stakeholders, understand how success is currently measured) — do NOT propose changes yet. Days 31-60 = first small contributions (own a defined piece of existing work, ask for feedback explicitly and often). Days 61-90 = a specific proposal or improvement you can point to, grounded in what you learned in the first 60 days, not a generic 'add value' statement.",
          "The trap to avoid: proposing changes in the first 30 days, before you understand why things are the way they are. Confident-sounding early opinions read as inexperience to anyone who's seen a 'new person reinvents a wheel that already failed' cycle before.",
        ],
        challenge: "Write your 30-60-90 day plan for a specific target role, with at least 2 concrete bullet points per phase (not vague ones like 'learn the ropes'). The 61-90 bullet must name a specific type of deliverable.",
        exampleOutput: "3 phases (30/60/90) with at least 2 specific bullets each, and the final phase naming a concrete deliverable type (e.g., 'a proposed improvement to the weekly reporting template based on gaps observed in month 1') rather than a vague ambition.",
        quiz: [
          { q: "Why shouldn't a 30-60-90 plan include proposed changes in the first 30 days?", a: "You haven't yet learned why current processes exist, so early proposed changes often repeat ideas that already failed", explanation: "This is the specific reasoning the lesson gives for holding off on proposals until later phases.", options: [
            { text: "You haven't yet learned why current processes exist, so early proposed changes often repeat ideas that already failed", explanation: "Correct — this matches the lesson's explicit caution about premature proposals." },
            { text: "Proposing changes early is always fine and shows ambition", explanation: "The lesson specifically frames early proposals as reading as inexperience, not ambition." },
            { text: "The first 30 days should be entirely unstructured with no plan", explanation: "The lesson calls for a structured learning-and-listening phase, not an absence of plan." },
            { text: "The first 30 days are typically a formal probation period with no real work", explanation: "The reasoning given is about understanding context first, not about a formal probation policy." },
          ] },
          { q: "Which use of a 30-60-90 plan does this lesson describe?", a: "Both an answer to a common interview question and a genuine onboarding tool once hired", explanation: "The lesson explicitly frames the plan as serving both purposes.", options: [
            { text: "Both an answer to a common interview question and a genuine onboarding tool once hired", explanation: "Correct — this matches exactly how the lesson introduces the plan's dual use." },
            { text: "It's purely a formality with no real use after the interview", explanation: "The lesson explicitly describes real onboarding value beyond the interview." },
            { text: "It's only relevant for management-track roles", explanation: "The lesson frames this as broadly useful for any role, not management-specific." },
            { text: "It replaces the need for a resume in later interview rounds", explanation: "The 30-60-90 plan is a separate asset that complements, not replaces, a resume." },
          ] },
        ],
      },
    ],
  },
];

/**
 * HUSTLE_FLASHCARDS — same shape as curriculum.js's FLASHCARDS: { term, def }.
 * @type {Array<{term: string, def: string}>}
 */
export const HUSTLE_FLASHCARDS = [
  { term: "ATS (Applicant Tracking System)", def: "Software that parses resumes for keywords and rank/filter candidates before a human recruiter sees them. Multi-column or graphic-heavy layouts can fail to parse correctly." },
  { term: "Resume bullet formula", def: "Action verb + what you did + quantified result. 'Responsible for X' describes a duty; a number and an outcome describe an accomplishment." },
  { term: "LinkedIn 'Open to Work' — recruiter-only mode", def: "Signals active job search only to recruiters using LinkedIn's search tools, without a public badge visible to your current employer or wider network." },
  { term: "STAR story bank", def: "6-8 pre-written real experiences in STAR format, tagged by behavioral question category (conflict, failure, leadership, pressure, analytical win), maintained as a living document across interviews." },
  { term: "Informational interview 4-sentence ask", def: "Credible intro + narrow specific ask (path/day-to-day, not 'advice') + low-friction logistics (15 min, flexible) + genuine thanks. Framed as learning, never a job ask." },
  { term: "Application tracker (7 columns)", def: "Company, Role, Date applied, Source, Status, Next action, Next action date. Sort weekly by next action date to keep it a to-do list, not just a log." },
  { term: "Pipeline discipline", def: "Sustained, filtered, high-fit application volume over time beats either a single frantic mass-apply burst or a handful of unscheduled 'someday' applications." },
  { term: "24-hour thank-you rule", def: "Send a specific thank-you (referencing one real detail from the conversation) within 24 hours of any informational interview or interview round." },
  { term: "6-8 week relationship-maintenance cadence", def: "A brief, low-pressure genuine update to a networking contact roughly every 6-8 weeks — better received than a repeat cold ask with no update." },
  { term: "Update-then-ask sequencing", def: "When re-approaching a contact for a second favor, lead with what you did with their prior advice before making the new ask." },
  { term: "Live technical walkthrough", def: "The highest-leverage finance technical-interview prep: build a pivot table or four-fifths calculator live, out loud, from memory — not just describe the process." },
  { term: "Case-interview framework-first move", def: "State your structural approach out loud before diving into a business case, then narrate reasoning through each part rather than going silent." },
  { term: "Salary-flexibility script", def: "A polite, specific ask for flexibility on base/signing bonus, made after a written offer and before acceptance, anchored to one real market-range data point." },
  { term: "30-60-90 day plan", def: "Days 1-30: learn and listen, no proposed changes. Days 31-60: own a defined piece of existing work. Days 61-90: a specific proposal grounded in what was learned." },
];

/**
 * HUSTLE_INTERVIEW_QUESTIONS — same shape as curriculum.js's
 * INTERVIEW_QUESTIONS: { moduleId, question, type, sampleAnswer }.
 * @type {Array<{moduleId: string, question: string, type: string, sampleAnswer: string}>}
 */
export const HUSTLE_INTERVIEW_QUESTIONS = [
  { moduleId: "hustle-materials", question: "Walk me through how you tailor a resume to a specific job posting.", type: "technical", sampleAnswer: "I pull 8-10 exact keyword phrases directly from the posting itself — not synonyms — like 'financial modeling' or 'XLOOKUP,' and make sure those exact strings show up in context inside real bullets, not a stuffed keyword list. Each bullet still has to follow action verb, what I did, quantified result, because a keyword match alone doesn't help if the bullet reads as a duty instead of an accomplishment. I also keep the layout to a single, simple column, since complex layouts and graphics can fail to parse correctly in an ATS before a recruiter ever opens the file." },
  { moduleId: "hustle-materials", question: "Tell me about how you built your interview story bank.", type: "behavioral", sampleAnswer: "I listed 6-8 real experiences and mapped each to the behavioral categories finance interviewers actually ask about — conflict, failure, leadership without authority, pressure, and one quantifiable analytical win, which for me is my HMDA bias-audit project. I wrote each in STAR format ahead of time so I'm not improvising the structure live, and I keep the bank as a living document, adding the exact question asked after every interview so the next one benefits from the last." },
  { moduleId: "hustle-network", question: "How do you approach cold outreach for an informational interview?", type: "behavioral", sampleAnswer: "I use a specific 4-sentence template: who I am and why I'm credible, a narrow ask about their specific path and day-to-day rather than generic advice, low-friction logistics (15 minutes, flexible scheduling), and a genuine thank-you regardless of their answer. When someone says yes, I send 2-3 concrete time options within the hour so momentum doesn't stall, and I always come with 4-5 specific questions prepared rather than an open-ended 'any advice?'" },
  { moduleId: "hustle-network", question: "Tell me about how you manage your job search pipeline.", type: "behavioral", sampleAnswer: "I keep a tracker with company, role, date applied, source, status, next action, and next action date, and I sort it by next action date every week so it functions as a to-do list rather than a passive record. I learned early that a single frantic weekend of unfiltered mass-applying converts far worse than a smaller, consistent, well-matched weekly volume, so I cap my applications at a sustainable number and prioritize fit." },
  { moduleId: "hustle-interview", question: "Walk me through how you'd prep for a technical round at a financial-services firm.", type: "technical", sampleAnswer: "I'd rehearse live, out loud, building the core deliverables from memory — a pivot table and a four-fifths bias calculator — because interviewers often ask candidates to share their screen and build something in real time, not just describe the process. For a case-style question, I'd state my framework out loud before calculating anything, then narrate my reasoning through each part, since going silent while thinking makes it hard for the interviewer to assess how I actually think." },
  { moduleId: "hustle-interview", question: "How would you approach negotiating a job offer as an entry-level candidate?", type: "case", sampleAnswer: "I'd wait until I have a written offer, then use a specific, polite script: thank them, state genuine interest, and ask whether there's flexibility on base salary or signing bonus, anchored to one real market-range data point I found beforehand. Most entry-level candidates don't negotiate at all and leave money on the table by default, and a well-timed, specific, polite ask almost never costs the offer — the real risk is staying silent and losing the negotiation with certainty." },
];
