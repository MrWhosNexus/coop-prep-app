// COOP Careers Financial Services Track — Heart pillar curriculum
// Professional identity. This is COOP's actual emphasis: a community-driven
// fellowship built on peer networks, cohort accountability, and overcoming
// underemployment. Same shape as data/curriculum.js's MODULES/FLASHCARDS/
// INTERVIEW_QUESTIONS — read that file before editing this one.

/**
 * HEART_MODULES — the Heart pillar's module list, in data/curriculum.js's
 * exact MODULES shape: { id, title, icon, color, light, description,
 * coopModule, lessons: [{ id, title, minutes, body, challenge,
 * exampleOutput, quiz: [{ q, a, explanation, options: [{ text, explanation }] }] }] }.
 * Quizzes here favor scenario judgment over trivia recall — imposter
 * syndrome and belonging are not multiple-choice-recall material.
 * @type {Array<object>}
 */
export const HEART_MODULES = [
  {
    id: "heart-story",
    title: "Your Professional Story",
    icon: "🪞",
    color: "#be123c",
    light: "#fff1f2",
    description: "Your narrative, the STAR method, and the values that keep your search aimed at the right target.",
    coopModule: "Professional identity & storytelling module",
    lessons: [
      {
        id: "heart-story-1",
        title: "Tell me about yourself: the structured narrative",
        minutes: 7,
        body: [
          "\"Tell me about yourself\" is not an invitation to summarize your resume out loud. It's a request for a 60-90 second narrative arc: where you've been, what you're building toward, and why this room is the next logical stop. Ramble through your whole life story and you lose the interviewer in the first 20 seconds.",
          "Use the Present-Past-Future structure. Present: one sentence on who you are right now (role, program, focus). Past: 2-3 sentences on the thread that got you here — pick ONE thread, not every job you've held. Future: one sentence on why this specific opportunity is the next step on that thread, not a random pivot.",
          "For COOP fellows: your 'present' is 'I'm in COOP Careers' Financial Services fellowship, building the analytical and Excel/Tableau skill set for a wealth-management or analyst track.' Your 'past' picks the ONE thread — a customer-facing job where you first noticed you liked numbers, a class, a personal-finance moment — that explains why finance, specifically. Your 'future' names the actual role you're targeting.",
        ],
        challenge: "Write your Present-Past-Future answer. Present: 1 sentence. Past: 2-3 sentences, ONE thread only. Future: 1 sentence naming a real target role (e.g., 'a wealth management analyst role like the ones at JP Morgan'). Read it aloud and time it — it should land between 60 and 90 seconds.",
        exampleOutput: "A written answer with three clearly labeled beats (present/past/future) totaling 4-5 sentences, naming one concrete thread (not a laundry list of jobs) and one specific target role, timed at 60-90 seconds when read aloud.",
        quiz: [
          { q: "You're 45 seconds into 'tell me about yourself' and you notice you're listing every job chronologically with no throughline. What should you do?", a: "Stop, name the one thread that actually matters, and skip straight to why it leads here", explanation: "A narrative with no throughline reads as a resume recital. The fix is naming the thread explicitly, not adding more detail or apologizing.", options: [
            { text: "Keep going and hope it ties together by the end", explanation: "Hoping it resolves itself burns more of the interviewer's attention without fixing the actual problem — the lack of a throughline." },
            { text: "Stop, name the one thread that actually matters, and skip straight to why it leads here", explanation: "Correct — naming the thread directly recovers the narrative faster than any amount of additional detail." },
            { text: "Apologize for rambling and ask the interviewer to move to the next question", explanation: "This draws attention to the ramble and ends the answer on a self-deprecating note instead of actually fixing it." },
            { text: "Restart from the beginning with more detail", explanation: "More detail without a throughline just doubles the rambling — the problem isn't length, it's structure." },
          ] },
          { q: "An interviewer asks 'tell me about yourself' at a networking coffee chat, not a formal interview. How should your answer change?", a: "Trim it further and end with a specific question back to them", explanation: "A coffee chat is a two-way relationship-building conversation, not a performance — a shorter answer that hands the conversation back respects that.", options: [
            { text: "Give the exact same formal script verbatim", explanation: "A formal interview script performed at a coffee chat misses that the goal here is dialogue, not a monologue." },
            { text: "Trim it further and end with a specific question back to them", explanation: "Correct — shortening it and turning the conversation back to them makes it a real exchange, which is the point of a coffee chat." },
            { text: "Give a much longer answer covering your personal life too", explanation: "Over-sharing personal details loses the professional throughline without adding relevant value to a networking conversation." },
            { text: "Skip answering and just ask them questions instead", explanation: "Refusing to answer at all isn't reciprocity either — a good coffee chat is a genuine two-way exchange, not one-sided in either direction." },
          ] },
        ],
      },
      {
        id: "heart-story-2",
        title: "The STAR method for professional stories",
        minutes: 7,
        body: [
          "STAR = Situation, Task, Action, Result. It's the industry-standard skeleton for both formal behavioral interview answers and the everyday 'walk me through a time...' moment, because it forces you to show a specific decision instead of a vague virtue.",
          "Concretely: Situation is 1-2 sentences of context, no throat-clearing. Task is what you were specifically responsible for. Action is 80% of the answer — describe what YOU did, using 'I,' not 'we.' Result quantifies the outcome where possible, plus one sentence of reflection.",
          "The common trap: most people give 70% Situation, 10% Action, 20% Result, and it reads as passive narration. Flip the ratio — Situation+Task in two sentences total, Action in four to five sentences, Result in one to two sentences.",
        ],
        challenge: "Take one real moment from work, school, or COOP where you solved a problem. Write it as STAR with a strict word budget: Situation+Task = 30 words max, Action = 100 words, Result = 40 words. The ratio is the point of the exercise.",
        exampleOutput: "A STAR answer where Action is visibly the longest section (roughly 100 words), uses 'I' throughout, and Result includes at least one number or concrete outcome plus one sentence of reflection.",
        quiz: [
          { q: "You draft a STAR answer and the Action section says 'we decided to change our approach' three times. What's the fix?", a: "Rewrite Action in first person singular, naming your specific decisions and reasoning", explanation: "Interviewers use STAR to assess your individual contribution — 'we' language makes it impossible to tell what you actually did.", options: [
            { text: "Leave it as 'we' since it was a team effort", explanation: "Even on a team project, the interviewer needs to know what YOU specifically decided and did." },
            { text: "Rewrite Action in first person singular, naming your specific decisions and reasoning", explanation: "Correct — this is exactly the fix; it makes your individual contribution visible." },
            { text: "Cut the Action section shorter to avoid the 'we' problem", explanation: "Shortening Action doesn't fix the pronoun problem and also shrinks the section that should be 80% of the answer." },
            { text: "Move the 'we' language into the Result section instead", explanation: "Relocating the vague language doesn't solve it — Result should be about outcomes, not about diffusing who acted." },
          ] },
          { q: "Which STAR story is stronger for a behavioral interview?", a: "One with a quantified result and a sentence of reflection", explanation: "A concrete number plus honest reflection is what makes a STAR answer credible and memorable rather than generic.", options: [
            { text: "One that ends with 'and it went well'", explanation: "'It went well' gives the interviewer nothing concrete to evaluate or remember." },
            { text: "One with a quantified result and a sentence of reflection", explanation: "Correct — a number plus reflection is exactly what separates a strong STAR answer from a vague one." },
            { text: "One with the longest Situation section", explanation: "A long Situation section takes time away from Action, which should be the bulk of the answer." },
            { text: "One that avoids naming any specific numbers to keep it modest", explanation: "Avoiding numbers makes the result unverifiable and less persuasive, not more modest in a useful way." },
          ] },
        ],
      },
      {
        id: "heart-story-3",
        title: "Personal values and career alignment",
        minutes: 6,
        body: [
          "A career choice made purely on prestige or salary without checking alignment against your actual values is a leading cause of burnout and early attrition. The fellowship wants you to enter with eyes open, not just impressed.",
          "Method: identify 3-5 concrete values — not abstractions like 'integrity' alone, but specific ones like 'direct feedback culture,' 'measurable impact,' 'predictable hours,' or 'client-facing work' — rank them, then honestly test each target role or firm against them.",
          "In financial services specifically: wealth management tends to reward relationship-building and long client relationships; a trading or analyst desk rewards speed and quantitative precision; compliance and governance rewards precision and risk-aversion. None is 'better' — alignment is what prevents you from quitting in month four.",
        ],
        challenge: "List your top 4 values in ranked order, using specific language (not just 'growth' — growth doing what, measured how?). Then take one role you're targeting and score it 1-5 against each value, honestly, including where it might NOT align.",
        exampleOutput: "4 ranked, specific values (not generic) and an honest scored comparison against one real target role, including at least one point of friction or misalignment named directly rather than glossed over.",
        quiz: [
          { q: "You get an offer at a firm with strong prestige but a culture that rewards long hours and discourages direct feedback — both of which you ranked low. What should you do before accepting?", a: "Have a direct conversation with your would-be manager or team to test whether your read of the culture is accurate", explanation: "Getting more direct information before deciding is the honest middle path — neither accepting blindly nor declining on assumption alone.", options: [
            { text: "Take it anyway, since prestige rarely comes with perfect alignment", explanation: "This resigns you to a known misalignment on values you specifically ranked as important, without even checking if your read is accurate." },
            { text: "Decline immediately without further information", explanation: "Declining before verifying your assumptions is too reactive — you might be working from an inaccurate outside impression of the culture." },
            { text: "Have a direct conversation with your would-be manager or team to test whether your read of the culture is accurate", explanation: "Correct — gathering direct information lets you make the alignment decision on real evidence, not assumption." },
            { text: "Ignore the mismatch, since early career is about proving yourself regardless of fit", explanation: "This treats known misalignment as irrelevant, which contradicts the whole point of checking alignment before accepting." },
          ] },
          { q: "Why does values alignment matter more than it might seem in an entry-level role?", a: "Misalignment compounds daily and is a common reason people leave within the first year, regardless of pay", explanation: "Day-to-day friction from misaligned values accumulates quickly, even when the paycheck itself is competitive.", options: [
            { text: "It only matters for senior roles, not entry-level ones", explanation: "Entry-level roles are exactly where misalignment tends to surface first, since there's less autonomy to work around it." },
            { text: "Pay always outweighs culture regardless of alignment", explanation: "The lesson's point is precisely that pay alone doesn't prevent early attrition driven by misalignment." },
            { text: "Misalignment compounds daily and is a common reason people leave within the first year, regardless of pay", explanation: "Correct — this is exactly why alignment is worth checking honestly before accepting." },
            { text: "Alignment can't really be assessed until you've worked somewhere for years", explanation: "You can test alignment meaningfully before accepting, by asking direct questions about how the role/team actually operates day to day." },
          ] },
        ],
      },
    ],
  },
  {
    id: "heart-belonging",
    title: "Belonging & Resilience",
    icon: "🤝",
    color: "#6d28d9",
    light: "#f3e8ff",
    description: "Imposter syndrome with real evidence, rejection as a structural feature of the search — not a verdict on you — and the cohort that gets you through both.",
    coopModule: "Community & resilience module",
    lessons: [
      {
        id: "heart-belonging-1",
        title: "Imposter syndrome: what the evidence actually says",
        minutes: 7,
        body: [
          "Imposter syndrome (Clance & Imes, 1978) is not a personality flaw — it's a well-documented pattern where competent people attribute their success to luck or timing rather than skill, most acutely at transition points like a first professional job, a new industry, or a new cohort. Feeling it is evidence you're paying attention to the stakes, not evidence you don't belong.",
          "The finding that matters: imposter feelings correlate with being in a genuinely new, high-stakes environment — not with actual competence. Research on high-performing professionals shows the feeling is nearly universal at career transitions and does NOT predict future performance. Feeling it now, entering a fellowship and a new industry, is statistically the norm, not a red flag about you specifically.",
          "Actionable response: keep a running 'evidence log.' Every time you complete something — a lesson, a formula that worked, positive interview feedback — write one line. The feeling runs on incomplete self-evidence; the log corrects the record with the same rigor you'd apply to any other analysis.",
        ],
        challenge: "Start your evidence log today: write 3 entries of things you've already done that a role in financial services actually requires (a skill, a completed task, a piece of feedback you received). Add one entry per week through the fellowship.",
        exampleOutput: "3 specific, dated entries — each a concrete completed action or received feedback, not a vague self-affirmation like 'I'm smart.'",
        quiz: [
          { q: "A cohort peer says 'everyone else here seems to already get this and I don't.' What is the most evidence-based response?", a: "That feeling is nearly universal at this stage and doesn't track actual ability — ask them what specific thing felt hard, and compare notes", explanation: "This response is grounded in the actual research finding — the feeling is common and not diagnostic — and turns it into a concrete, comparable data point.", options: [
            { text: "Reassure them everyone feels that way and move on", explanation: "True but incomplete — it's dismissive and doesn't help them build actual counter-evidence." },
            { text: "That feeling is nearly universal at this stage and doesn't track actual ability — ask them what specific thing felt hard, and compare notes", explanation: "Correct — this validates the feeling with evidence and turns it into something concrete and comparable." },
            { text: "Agree that it usually means a different, easier field might be a better fit", explanation: "This reinforces the false belief that the feeling is diagnostic of fit, which the research directly contradicts." },
            { text: "Tell them competence differences are real and they should work harder", explanation: "This misreads the research and adds pressure instead of correcting the underlying misattribution." },
          ] },
          { q: "You get one piece of harsh feedback in week 2 of the fellowship. Which response is best supported by the evidence-log method?", a: "Treat it as one data point, log it alongside completed-work evidence, and extract the specific actionable change", explanation: "The evidence log method is about weighing feedback proportionally against the full record, not letting a single data point override everything else.", options: [
            { text: "Conclude it confirms you don't belong", explanation: "One data point overriding an entire record is exactly the distortion the evidence-log method is designed to correct." },
            { text: "Treat it as one data point, log it alongside completed-work evidence, and extract the specific actionable change", explanation: "Correct — this weighs the feedback proportionally and turns it into something useful rather than a verdict." },
            { text: "Dismiss it entirely without extracting anything actionable", explanation: "Dismissing feedback entirely wastes real information; the goal is proportional weighting, not ignoring it." },
            { text: "Stop attending sessions until you feel more confident", explanation: "Withdrawing removes the chance to gather more evidence, which is the opposite of what the method calls for." },
          ] },
        ],
      },
      {
        id: "heart-belonging-2",
        title: "Resilience through rejection — the job search IS rejection",
        minutes: 7,
        body: [
          "A realistic finance job search involves rejection at a much higher rate than acceptance — dozens of applications per offer is normal, not a sign something is wrong with you. Treating each 'no' as data about you personally, rather than as the statistically expected outcome of a numbers-driven process, is what turns a normal search into a demoralizing one.",
          "Separate rejection into two buckets: process rejections — no reply, generic auto-decline, wrong-fit-on-paper — are almost never about you and require zero self-examination. Informative rejections — a final-round loss, or specific interview feedback — ARE worth 10 minutes of honest review, once, then filed away.",
          "Build a recovery ritual with a hard time limit: 24 hours to feel the sting, then one specific action — send one new application, book one informational interview — before the next business day. The ritual isn't about suppressing the feeling; it's about not letting one rejection stall the whole pipeline.",
        ],
        challenge: "Write your personal 24-hour rejection ritual: what you'll do to acknowledge it, and the one specific next action you commit to taking within 24 hours of any 'no.' Be concrete — 'apply to one more role' is better than 'stay positive.'",
        exampleOutput: "A short, concrete two-part ritual (an acknowledgment step plus one specific pipeline action with a deadline), not a vague 'stay positive' statement.",
        quiz: [
          { q: "You've sent 30 applications and gotten 2 first-round interviews, both of which passed you over. Is this a signal to change your entire approach?", a: "No — this ratio is within normal range for a finance job search, and the 2 interviews are a positive signal", explanation: "This ratio is consistent with a healthy funnel; overreacting to a normal result risks abandoning materials that are actually working.", options: [
            { text: "Yes, rewrite your resume from scratch immediately", explanation: "This overreacts to a ratio that's actually within the normal range described in the lesson." },
            { text: "Yes, it means you're not qualified for this field", explanation: "This personalizes a statistically normal outcome of a numbers-driven process." },
            { text: "No — this ratio is within normal range for a finance job search, and the 2 interviews are a positive signal", explanation: "Correct — this is exactly the framing the lesson supports, treating volume rejection as expected, not diagnostic." },
            { text: "No signal either way, so ignore all data from this batch", explanation: "The ratio IS informative (2 interviews from 30 applications is a workable signal) — it just isn't alarming." },
          ] },
          { q: "You get to a final round and lose, with specific feedback that your technical answers were thin. What's the appropriate next step?", a: "Spend one focused session addressing that specific gap, then move on", explanation: "This is exactly the 'informative rejection' case the lesson describes — worth a bounded, specific response, not a full strategy overhaul.", options: [
            { text: "Spend one focused session addressing that specific gap, then move on", explanation: "Correct — this treats the informative feedback as one data point to act on, once, before moving forward." },
            { text: "Assume the whole search strategy is broken", explanation: "One specific piece of feedback doesn't justify overhauling an entire strategy that's otherwise working." },
            { text: "Ignore the feedback since you didn't get the job anyway", explanation: "This wastes genuinely useful, specific information that the process-rejection bucket wouldn't have given you." },
            { text: "Apply to fewer roles going forward 'to be safer'", explanation: "Reducing volume doesn't address the specific gap identified — it just slows the whole pipeline." },
          ] },
        ],
      },
      {
        id: "heart-belonging-3",
        title: "Peer networks and cohort accountability",
        minutes: 6,
        body: [
          "COOP's model is built on the premise that a peer cohort outperforms solo prep — not as a slogan, but structurally: peers catch blind spots you can't see in your own materials, normalize the parts of the search that feel uniquely hard, and create social cost for skipping the work, in a good way.",
          "Concretely: pair up for resume and LinkedIn review (a peer catches typos and vague bullets you're now blind to), form a weekly accountability check-in (three questions: what did you apply to, what did you learn, what's blocking you), and use the cohort as a live source of informational-interview leads — someone's connection is a warmer intro than a cold one.",
          "Accountability structures fail when they're vague ('let's keep each other posted'). Make it specific: a recurring 15-minute weekly call, a shared tracker, a named person you report to. Specificity is what turns 'I should' into 'I did.'",
        ],
        challenge: "Identify one specific cohort peer and propose a concrete weekly accountability structure: day/time, the 3 questions you'll each answer, and what happens if one of you misses a week. Send the proposal today.",
        exampleOutput: "A specific day/time, the 3 recurring questions, and a stated (even light) consequence or backup plan for a missed week — not a vague 'let's check in sometime.'",
        quiz: [
          { q: "A cohort-mate offers to review your resume. What makes this more valuable than reviewing it yourself one more time?", a: "Fresh eyes catch things you've become blind to through repetition, and a peer targeting similar roles knows what recruiters look for", explanation: "This is exactly why peer review compounds — it isn't just a second look, it's a differently informed look.", options: [
            { text: "It isn't more valuable — self-review is always sufficient", explanation: "The whole reason peer review works is that self-review has blind spots repetition creates, which this option denies." },
            { text: "Fresh eyes catch things you've become blind to through repetition, and a peer targeting similar roles knows what recruiters look for", explanation: "Correct — both the blind-spot correction and the shared-context knowledge make peer review distinctly valuable." },
            { text: "It's only valuable if the peer already has a job offer", explanation: "Peer review value doesn't depend on the reviewer's own outcome — it depends on fresh perspective and shared context." },
            { text: "Peer review just adds a second opinion with no real advantage", explanation: "This undersells the specific mechanism — fresh eyes plus shared context — that makes it genuinely useful." },
          ] },
          { q: "Which weekly accountability structure is most likely to actually happen?", a: "A recurring 15-minute call, same day/time, with 3 fixed questions", explanation: "Specificity in time and structure is what the lesson identifies as the difference between an accountability system and a vague intention.", options: [
            { text: "A recurring 15-minute call, same day/time, with 3 fixed questions", explanation: "Correct — fixed timing and fixed questions are exactly the specificity the lesson calls for." },
            { text: "An open-ended 'text me if you want to talk about the search'", explanation: "No fixed time or structure makes this easy to let slide indefinitely." },
            { text: "A monthly, unscheduled check-in 'when we both have time'", explanation: "Unscheduled and infrequent removes the regular cadence that makes accountability structures work." },
            { text: "Relying on running into each other in COOP sessions", explanation: "This isn't a structure at all — it depends entirely on chance rather than a committed cadence." },
          ] },
        ],
      },
    ],
  },
  {
    id: "heart-presence",
    title: "Presence & Communication",
    icon: "🎤",
    color: "#0e7490",
    light: "#ecfeff",
    description: "How you show up: to executives, in feedback conversations, across cultural differences, and in person or on a screen.",
    coopModule: "Executive communication & workplace-presence module",
    lessons: [
      {
        id: "heart-presence-1",
        title: "Communicating with executives",
        minutes: 7,
        body: [
          "Executives operate on inverted-pyramid communication: conclusion first, supporting detail only if asked. A junior analyst who narrates their process chronologically ('first I pulled the data, then I checked for errors, then I ran the pivot...') loses an executive's attention in the first 10 seconds.",
          "The formula: lead with the answer or recommendation in one sentence, follow with the 2-3 numbers that support it, then stop and let them ask for more. 'Approval rates show a real gap — Black applicants at 56%, White applicants at 86%, a ratio well below the legal threshold. I'd recommend flagging this model for review before the next cycle.' That's it. Wait.",
          "When an executive asks a question you don't fully know the answer to: say what you DO know, name the specific gap, and give a timeline to close it. 'I don't have the ZIP-code breakdown in front of me — I can have that by end of day.' Never bluff a number to an executive; it is the single fastest way to lose credibility permanently.",
        ],
        challenge: "Take a finding from any lesson (or your own project) and write it as a 3-sentence executive update: conclusion, supporting numbers, recommendation. Then write one likely follow-up question and a one-sentence honest answer, including an 'I don't know yet, but I'll have it by [time]' if applicable.",
        exampleOutput: "A 3-sentence update in conclusion-first order with real or plausible numbers, plus a follow-up Q&A pair that includes at least one honest 'I don't know yet' with a concrete timeline, not a bluffed answer.",
        quiz: [
          { q: "You're updating a VP and you don't know the answer to their follow-up question. What's the best response?", a: "'I don't have that number in front of me — I'll confirm and send it by end of day'", explanation: "This preserves credibility by being honest about the gap while still giving a concrete commitment to close it.", options: [
            { text: "Guess a plausible-sounding number to keep the conversation moving", explanation: "Bluffing a number to an executive is the fastest, most permanent way to lose credibility, per the lesson." },
            { text: "'I don't have that number in front of me — I'll confirm and send it by end of day'", explanation: "Correct — honest about the gap, with a specific timeline to close it." },
            { text: "Say 'I'm not sure' and stop there with no next step", explanation: "This is honest but incomplete — it leaves the executive without any sense of when they'll get an answer." },
            { text: "Redirect to a different topic to avoid the gap", explanation: "Avoiding the question entirely reads as evasive and damages trust more than admitting the gap directly." },
          ] },
          { q: "Which opening line is best suited to a 2-minute update with an executive?", a: "A conclusion-first statement of the finding and recommendation", explanation: "Inverted-pyramid structure — conclusion first — is exactly what the lesson prescribes for executive communication.", options: [
            { text: "A conclusion-first statement of the finding and recommendation", explanation: "Correct — this matches the inverted-pyramid structure the lesson teaches." },
            { text: "A chronological walk-through of every step taken", explanation: "This is the exact pattern the lesson warns loses an executive's attention within the first 10 seconds." },
            { text: "An apology for how long the analysis took", explanation: "An apology adds nothing useful and delays getting to the actual finding." },
            { text: "A question asking what they'd like to hear about first", explanation: "This puts the structuring burden back on the executive instead of leading with the conclusion yourself." },
          ] },
        ],
      },
      {
        id: "heart-presence-2",
        title: "Giving and receiving feedback",
        minutes: 6,
        body: [
          "Receiving feedback well is a skill that's actively assessed in fellowship and early-career settings, often more than the underlying work itself, because it signals coachability — one of the best predictors of how fast someone improves on the job.",
          "The receiving move: separate 'understand' from 'agree.' First, restate the feedback in your own words to confirm you understood it correctly ('So you're saying the Action section reads passive because I keep saying 'we' — is that right?'). Only after confirming understanding do you decide what to do with it. Defending before confirming understanding reads as not listening.",
          "The giving move, which you'll use in peer review: lead with something specific and true (not generic praise), name one specific, actionable change, and frame it around the work, not the person — 'the Result section doesn't have a number in it yet,' not 'you didn't try hard enough.'",
        ],
        challenge: "Recall the last piece of feedback you received that stung a little. Write the 'confirm understanding' restatement you should have used, and one sentence on what you'd actually do with it now.",
        exampleOutput: "A restatement sentence that paraphrases the original feedback accurately (not defensively), followed by one concrete action taken in response — not a justification for why the feedback was wrong.",
        quiz: [
          { q: "A mentor tells you your STAR answer's Action section is too vague. Your gut response is to explain why you kept it high-level. What should you do first, before explaining?", a: "Restate their feedback back to confirm you understood it correctly", explanation: "Confirming understanding first is the move the lesson prescribes — explaining before that risks defending against feedback you haven't fully absorbed.", options: [
            { text: "Explain your reasoning immediately to prevent misunderstanding", explanation: "Explaining before confirming understanding reads as defending rather than listening, which the lesson specifically warns against." },
            { text: "Restate their feedback back to confirm you understood it correctly", explanation: "Correct — this is the 'confirm understanding before deciding what to do with it' move." },
            { text: "Agree without processing it just to move on", explanation: "Agreeing without genuinely processing the feedback skips the understanding step just as much as defending does." },
            { text: "Ask a different mentor whether they agree, before responding to this one", explanation: "This delays engaging with the actual feedback given, rather than confirming understanding with the person who gave it." },
          ] },
          { q: "Which piece of feedback is constructed correctly, per this lesson?", a: "'The Result section doesn't have a number yet — adding one would make the impact concrete'", explanation: "This is specific, actionable, and framed around the work rather than the person — exactly the giving-feedback formula.", options: [
            { text: "'This just isn't very strong'", explanation: "Vague and unactionable — it doesn't name what specifically to change." },
            { text: "'You clearly didn't put much effort in'", explanation: "This is framed around the person, not the work, which the lesson specifically says to avoid." },
            { text: "'The Result section doesn't have a number yet — adding one would make the impact concrete'", explanation: "Correct — specific, actionable, and focused on the work itself." },
            { text: "'It's fine, don't worry about it'", explanation: "This avoids giving real feedback at all, which isn't useful to the person trying to improve." },
          ] },
        ],
      },
      {
        id: "heart-presence-3",
        title: "Cross-cultural competence",
        minutes: 6,
        body: [
          "Financial services teams are frequently cross-cultural — clients, colleagues, and managers from different communication norms around directness, hierarchy, and small talk. Reading a difference in style as a difference in competence or trustworthiness is the single most common cross-cultural misread.",
          "Two dimensions to notice deliberately: directness (some cultures state disagreement plainly, others signal it indirectly through questions or silence) and relationship-first vs. task-first norms (some contexts expect rapport-building before business, others get straight to the agenda). Neither is more 'professional' — mismatched expectations cause friction, not the styles themselves.",
          "Practical move: in a new cross-cultural working relationship, spend the first interaction observing more than performing — notice how directly disagreement gets voiced and whether meetings open with small talk or straight business, and mirror that rather than assuming your default style is the neutral one.",
        ],
        challenge: "Describe one real or anticipated cross-cultural working situation (a manager, client, or cohort peer with a different communication style than yours). Write one sentence on what you'd watch for in your first interaction, and one adjustment you'd make to your own default style.",
        exampleOutput: "A concrete, specific observation to watch for (not 'be respectful') and one specific adjustment to your own communication default, not a vague commitment to 'be more culturally aware.'",
        quiz: [
          { q: "A colleague from a more indirect-communication background hasn't explicitly disagreed with your proposal, but has asked several probing questions about it. What's the likely read?", a: "The questions may be a culturally indirect way of signaling disagreement or concern — worth asking directly what their honest view is", explanation: "This treats the indirect signal seriously without over-assuming, and resolves the ambiguity by asking directly.", options: [
            { text: "No news is good news, they must agree", explanation: "This assumes silence-as-agreement, which misses that indirect probing questions can themselves be a disagreement signal." },
            { text: "The questions may be a culturally indirect way of signaling disagreement or concern — worth asking directly what their honest view is", explanation: "Correct — this takes the cultural signal seriously and resolves ambiguity with a direct follow-up." },
            { text: "They're just naturally curious and it means nothing", explanation: "This dismisses a plausible cultural signal without checking, rather than following up to find out." },
            { text: "Assume they don't understand the proposal and re-explain it more simply", explanation: "This misreads probing questions as confusion rather than considering they may be a style of voicing disagreement." },
          ] },
          { q: "What is the most useful first move in a new cross-cultural working relationship?", a: "Observe their communication norms before assuming your own default is neutral", explanation: "The lesson's core practical move is deliberate observation first, rather than assuming any one style is the universal baseline.", options: [
            { text: "Observe their communication norms before assuming your own default is neutral", explanation: "Correct — this is exactly the practical move the lesson recommends." },
            { text: "Explicitly ask them to adapt to your communication style", explanation: "This assumes your own style is the neutral standard, which the lesson explicitly says isn't the case." },
            { text: "Avoid the topic of style entirely and hope it works out", explanation: "Avoiding it entirely misses the chance to deliberately observe and adjust, which is what actually reduces friction." },
            { text: "Assume professional norms are universal and proceed as usual", explanation: "This is the exact misread the lesson warns against — treating a style difference as a universal standard." },
          ] },
        ],
      },
      {
        id: "heart-presence-4",
        title: "Professional presence: in-person and remote",
        minutes: 6,
        body: [
          "Presence is judged in the first few seconds and re-confirmed continuously through small, consistent signals — not through one big impressive moment. In person: posture, eye contact, a firm handshake, arriving with 5-10 minutes of buffer. Remote: camera at eye level, good lighting, muted-until-speaking discipline, and a background free of distraction.",
          "The most common remote-presence failure isn't technical — it's engagement signaling. On video, nodding, brief verbal acknowledgments ('got it,' 'makes sense'), and looking at the camera (not the thumbnail of yourself) read as active listening; staring at notes or multitasking reads as checked-out even if you're actually following along.",
          "For COOP fellows specifically: many first touchpoints with employers (info sessions, first-round interviews) are remote. Treat your camera setup as part of your professional wardrobe — test lighting and audio before every important call, the same way you'd check an outfit before an in-person interview.",
        ],
        challenge: "Do a 2-minute camera test today: check your lighting (is your face lit, not backlit by a window), your background, and your eye-line (camera roughly at eye height). Write down one specific fix you made.",
        exampleOutput: "One specific, concrete fix (e.g., 'moved my laptop onto two books so the camera hits eye level' or 'closed the blinds so I'm not backlit') — not a vague 'I checked my setup and it looked fine.'",
        quiz: [
          { q: "You're in a first-round video interview and you catch yourself looking at your own thumbnail instead of the camera. What's the fix, and why does it matter?", a: "Shift your gaze to the camera lens — it's what reads as eye contact to the interviewer", explanation: "Looking at the lens, not the screen, is what translates to perceived eye contact on the other end of the call.", options: [
            { text: "Shift your gaze to the camera lens — it's what reads as eye contact to the interviewer", explanation: "Correct — this is the fix, and it matters because it's what actually reads as eye contact to the person watching." },
            { text: "It doesn't matter — interviewers don't notice eye-line on video", explanation: "Eye-line is one of the most noticeable engagement signals on video, contrary to this option." },
            { text: "Turn off your camera to avoid the issue", explanation: "Removing video removes a presence signal entirely rather than fixing the specific eye-line issue." },
            { text: "Apologize on-call for not making eye contact", explanation: "Drawing attention to it verbally is unnecessary — simply adjusting your gaze solves the problem directly." },
          ] },
          { q: "Which remote-interview signal most strongly reads as 'engaged and listening' to the person on the other end?", a: "Brief verbal acknowledgments and camera-directed eye contact while they're speaking", explanation: "These are the concrete engagement signals the lesson names as reading as active listening on video.", options: [
            { text: "Brief verbal acknowledgments and camera-directed eye contact while they're speaking", explanation: "Correct — these are exactly the engagement signals the lesson identifies." },
            { text: "Staying completely silent and still throughout so as not to interrupt", explanation: "Total stillness and silence reads as checked-out on video, not as respectful listening." },
            { text: "Taking constant visible notes without ever looking up", explanation: "Looking down continuously reads as disengagement even if you're actually following closely." },
            { text: "Keeping your camera off so nerves don't show", explanation: "No camera removes the ability to signal engagement visually at all." },
          ] },
        ],
      },
    ],
  },
];

/**
 * HEART_FLASHCARDS — same shape as curriculum.js's FLASHCARDS: { term, def }.
 * @type {Array<{term: string, def: string}>}
 */
export const HEART_FLASHCARDS = [
  { term: "Present-Past-Future narrative", def: "Structure for 'tell me about yourself': one sentence on who you are now, 2-3 sentences on the ONE thread that got you here, one sentence on why this role is the next step." },
  { term: "STAR method", def: "Situation, Task, Action, Result. Action should be ~80% of the answer, in first person ('I' not 'we'). Result should include a number plus a reflection." },
  { term: "Imposter syndrome (Clance & Imes, 1978)", def: "A documented pattern of attributing success to luck rather than skill, most acute at career transitions. Correlates with novelty of the situation, not with actual competence." },
  { term: "Evidence log", def: "A running log of completed tasks and received positive feedback, used to counter imposter-syndrome's incomplete self-evidence with a concrete record." },
  { term: "Process rejection vs. informative rejection", def: "Process rejections (no reply, auto-decline) are not about you and need no reflection. Informative rejections (final-round loss, specific feedback) are worth one honest review, once." },
  { term: "24-hour rejection ritual", def: "A recovery structure: 24 hours to feel a rejection, then one specific pipeline action (one new application, one informational interview) before the next business day." },
  { term: "Cohort accountability structure", def: "A specific, recurring peer check-in (fixed day/time, fixed questions) — vague plans like 'let's keep each other posted' rarely survive contact with a busy week." },
  { term: "Inverted-pyramid communication", def: "Executive communication style: conclusion first, then 2-3 supporting numbers, then stop. The opposite of narrating your process chronologically." },
  { term: "Confirm-understanding feedback move", def: "Before agreeing or defending, restate feedback in your own words to confirm you understood it correctly. Separates 'understand' from 'agree.'" },
  { term: "Directness (cross-cultural)", def: "How plainly disagreement or concern gets voiced across cultures — ranges from explicit statement to indirect questions or silence. Neither is more 'professional.'" },
  { term: "Relationship-first vs. task-first norms", def: "Some cultural/professional contexts expect rapport-building before business; others go straight to the agenda. Mismatched expectations cause friction, not the styles themselves." },
  { term: "Camera eye-line", def: "Looking at the camera lens (not your own video thumbnail) is what reads as eye contact to the person on the other end of a video call." },
  { term: "Values alignment", def: "Ranking specific, concrete personal values (not abstractions) and honestly scoring a target role/firm against them — a leading preventer of early attrition and burnout." },
  { term: "Coachability", def: "How well someone receives and acts on feedback. Often assessed more heavily early-career than the quality of the underlying work itself." },
];

/**
 * HEART_INTERVIEW_QUESTIONS — same shape as curriculum.js's
 * INTERVIEW_QUESTIONS: { moduleId, question, type, sampleAnswer }.
 * @type {Array<{moduleId: string, question: string, type: string, sampleAnswer: string}>}
 */
export const HEART_INTERVIEW_QUESTIONS = [
  { moduleId: "heart-story", question: "Tell me about yourself.", type: "behavioral", sampleAnswer: "I'm a fellow in COOP Careers' Financial Services program, building the Excel, Tableau, and analytical skill set for an analyst-track role. That focus traces back to a customer-facing job where I first noticed I was the one people came to when the numbers didn't add up — I liked untangling that more than almost anything else in the role. That's what's pulling me toward analyst positions like the ones on JP Morgan's Wealth Management team, where that same instinct gets to be the actual job." },
  { moduleId: "heart-story", question: "Walk me through a time you solved a real problem, using a clear structure.", type: "behavioral", sampleAnswer: "Situation and Task in one breath: our HMDA-style sample data had inconsistent race labels that would have silently undercounted a group in any pivot. Action: I audited the categorical values first, standardized them, and then built the four-fifths calculator on top of clean data — deliberately keeping missing income rows flagged rather than deleted so I wouldn't bias the analysis. Result: the calculator correctly flagged a 0.60 ratio for one group, well below the legal threshold, and I now audit categorical values first on any new dataset by default." },
  { moduleId: "heart-belonging", question: "Tell me about a time you doubted whether you belonged in a role or environment.", type: "behavioral", sampleAnswer: "Starting the fellowship, I felt behind cohort-mates who seemed to already have the Excel fluency I was still building. Instead of treating that feeling as proof I didn't belong, I started an evidence log — noting each formula I got working, each piece of positive feedback — and reviewed it whenever the doubt spiked. The feeling didn't disappear overnight, but the log gave me something concrete to weigh against it, and it turned out to be exactly what the research on career transitions predicts: near-universal, not diagnostic." },
  { moduleId: "heart-belonging", question: "How do you handle rejection in a job search?", type: "behavioral", sampleAnswer: "I split rejections into two buckets: process rejections, which are almost never about me and get no further thought, and informative rejections — a final-round loss with specific feedback — which get one honest 10-minute review before I file them away. I also give myself a hard 24-hour limit to feel a rejection before taking one concrete next action, like sending a new application, so no single 'no' is allowed to stall the whole pipeline." },
  { moduleId: "heart-presence", question: "How would you explain a sensitive finding to a senior executive who has two minutes?", type: "case", sampleAnswer: "I'd lead with the conclusion, not the process: 'Approval rates show a real gap — 56% versus 86% across two groups, well below the legal threshold — I'd recommend flagging this model for review before the next cycle.' Then I'd stop and let them ask for the supporting detail rather than walking them through my whole analytical process first. If they ask something I don't know, I'd say exactly that and give a specific time I'll have the answer, rather than guessing." },
  { moduleId: "heart-presence", question: "Tell me about a time you received difficult feedback. How did you handle it?", type: "behavioral", sampleAnswer: "A mentor told me my STAR Action sections read as vague. My instinct was to explain why I'd kept things high-level, but I stopped and restated the feedback back first — 'so you're saying it doesn't show what I specifically decided, not just what happened?' — to make sure I understood before responding. Once I confirmed that, I rewrote the sections in first person with specific decisions named, which made the stories noticeably stronger." },
];
