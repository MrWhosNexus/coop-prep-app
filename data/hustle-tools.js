// COOP Careers Financial Services Track — Hustle pillar tool specs.
// These are DEFINITIONS/CONFIG ONLY. No UI, no reducers, no store wiring —
// a later phase builds the components (see lib/tools/coverLetter.js +
// components/tools/CoverLetterTool.js for the pattern each of these should
// follow: a defaultXState namespaced at state.tools.<id>, pure immutable
// reducers, and — where AI is involved — the renderer only ever calls
// ai:call over IPC and only ever sees a key-free EndpointView).

/**
 * HUSTLE_TOOLS — specs for the Hustle-pillar tools beyond the existing
 * Cover Letter Builder. Each entry describes: what the tool is for, the
 * data shape it owns (namespaced under state.tools.<id>, matching the
 * defaultCoverLetterState convention), what it needs from lib/store, and
 * the reducer functions a future implementation phase should add (named
 * to match lib/tools/coverLetter.js's setX/clearX/assembleX conventions).
 * None of these are implemented here — this is the spec a build-out phase
 * works from.
 * @type {Array<object>}
 */
export const HUSTLE_TOOLS = [
  {
    id: "resumeBuilder",
    label: "Resume Builder",
    pillarId: "hustle",
    purpose: "Turns raw work history plus a pasted target job description into ATS-aligned bullets, applying the Hustle 'resume architecture' formula (action verb + what you did + quantified result) and a live keyword-match checklist against the posting.",
    defaultState: {
      targetRole: "",
      targetCompany: "",
      pastedJobDescription: "",
      keywords: [],
      bullets: [
        // { id, raw, actionVerb, quantifiedResult, matchedKeywords: [] }
      ],
      aiResponse: null,
      lastSaved: null,
      tokenWarning: false,
    },
    storeNeeds: "Persist at state.tools.resumeBuilder inside the existing progress-state `tools` namespace (same slot coverLetter already uses) — no store schema version bump required. Should migrate cleanly like coverLetter: an old save lacking `tools.resumeBuilder` merges in this defaultState.",
    suggestedReducers: [
      "setResumeBuilderField(state, key, value)",
      "addResumeBullet(state, rawText)",
      "updateResumeBullet(state, bulletId, patch)",
      "removeResumeBullet(state, bulletId)",
      "setResumeBuilderAIResponse(state, text, hasWarning = false)",
      "clearResumeBuilderAIResponse(state)",
      "extractKeywordsFromJobDescription(text) -- pure fn, no AI needed (simple tokenizer/phrase matcher against pastedJobDescription); belongs in lib/tools/resumeBuilder.js alongside the reducers, same file layout as coverLetter.js.",
    ],
    aiIntegration: "Optional: an AI call (via lib/endpoints call.js's ai:call IPC channel) can suggest a rewritten bullet from raw text + matched keywords, storing the result in aiResponse exactly like setCoverLetterAIResponse does. The renderer must never touch an apiKey directly — only ai:call / endpoints:* over IPC, receiving key-free EndpointView responses.",
  },
  {
    id: "starStoryBank",
    label: "STAR Story Bank",
    pillarId: "hustle",
    purpose: "The reusable interview asset taught in lesson hustle-materials-3: lets a user log 6-8 real experiences pre-tagged to behavioral question categories (conflict, failure, leadership, pressure, analyticalWin) with a full STAR breakdown, maintained as a living document across interviews rather than rebuilt from scratch each time.",
    defaultState: {
      stories: [
        // { id, name, situation, task, action, result, tags: [], lastUsedFor: [] }
      ],
      activeStoryId: null,
      lastSaved: null,
    },
    storeNeeds: "Persist at state.tools.starStoryBank. `tags` should be constrained to a fixed enum matching the lesson's category list (conflict | failure | leadership | pressure | analyticalWin | other) so search/filter by category stays meaningful. No AI dependency, no schema version bump needed.",
    suggestedReducers: [
      "addStory(state, story)",
      "updateStory(state, storyId, patch)",
      "removeStory(state, storyId)",
      "tagStory(state, storyId, tag)",
      "logStoryUsage(state, storyId, questionText) -- appends { question, date } to lastUsedFor, matching the lesson's 'maintain it like a living document' instruction.",
    ],
    aiIntegration: "None required for v1. A later phase could add an optional 'AI polish' of a story's Action section via ai:call, following the same key-never-in-renderer rule as every other AI-touching tool.",
  },
  {
    id: "applicationTracker",
    label: "Application Tracker",
    pillarId: "hustle",
    purpose: "The pipeline tracker taught in lesson hustle-network-2: company/role/date/source/status/next action/next action date, the single highest-leverage low-effort tool named in the lesson, meant to be sorted by next action date weekly so it functions as a to-do list rather than a passive log.",
    defaultState: {
      applications: [
        // { id, company, role, dateApplied, source, status, nextAction, nextActionDate }
      ],
      lastSaved: null,
    },
    storeNeeds: "Persist at state.tools.applicationTracker. `status` enum: applied | screen | interview | offer | rejected | withdrawn. `source` enum: referral | cold | recruiter | other. UI should default-sort by nextActionDate ascending per the lesson's explicit weekly-sort instruction. No AI dependency.",
    suggestedReducers: [
      "addApplication(state, application)",
      "updateApplication(state, applicationId, patch)",
      "removeApplication(state, applicationId)",
      "setApplicationStatus(state, applicationId, status)",
    ],
    aiIntegration: "None.",
  },
  {
    id: "mockInterview",
    label: "Mock Interview (AI-driven)",
    pillarId: "hustle",
    purpose: "AI-driven mock-interview practice: surfaces a behavioral or technical/case question (drawn from INTERVIEW_QUESTIONS / HUSTLE_INTERVIEW_QUESTIONS or a user-entered custom prompt), takes the user's typed answer, and returns AI feedback structured around STAR completeness, specificity (numbers, 'I' vs 'we'), and one concrete improvement — matching the voice of the hustle-interview-1/2 lessons.",
    defaultState: {
      sessions: [
        // { id, question, questionSource, userAnswer, aiFeedback, timestamp }
      ],
      activeQuestion: null,
      lastSaved: null,
    },
    storeNeeds: "Persist at state.tools.mockInterview. This is the one Hustle tool that genuinely needs the AI layer. THE SECURITY INVARIANT applies in full: every call MUST go through lib/endpoints/call.js's ai:call IPC channel; the apiKey lives only in the Electron main process and the renderer only ever receives {ok:true,text} or {ok:false,error:{type}}. If no endpoint is configured, the tool must fail honestly with a clear 'no endpoint configured' state — never fall back to an ambient env var or any other key path.",
    suggestedReducers: [
      "startMockInterviewSession(state, question, questionSource)",
      "recordMockInterviewAnswer(state, sessionId, answerText)",
      "setMockInterviewFeedback(state, sessionId, feedbackText)",
      "clearMockInterviewSession(state, sessionId)",
    ],
    aiIntegration: "Required for the core feature. Prompt should instruct the model to assess STAR completeness (is there a clear Situation/Task/Action/Result), specificity (concrete numbers, first-person 'I' vs diffuse 'we'), and give exactly one concrete improvement — reusing lib/ai/prompts.js's PROMPTS registry conventions and lib/ai/fill-prompt.js's token guard if a later phase extends those.",
  },
  {
    id: "networkTracker",
    label: "Network Tracker",
    pillarId: "hustle",
    purpose: "Tracks contacts from informational interviews and networking outreach, including the outreach send date, reply status, and the follow-up cadence taught in hustle-network-1/3 (24-hour thank-you, 6-8 week genuine-update reminder).",
    defaultState: {
      contacts: [
        // { id, name, firm, role, source, outreachDate, replyStatus, lastContactDate, nextFollowUpDate, notes }
      ],
      lastSaved: null,
    },
    storeNeeds: "Persist at state.tools.networkTracker. `replyStatus` enum: notSent | sent | replied | scheduled | completed | noReply. When a contact reaches `completed` status, nextFollowUpDate should default-compute to lastContactDate + ~49 days (7 weeks — the middle of the lesson's 6-8 week window) via a pure helper, no AI needed.",
    suggestedReducers: [
      "addContact(state, contact)",
      "updateContact(state, contactId, patch)",
      "removeContact(state, contactId)",
      "markContactFollowedUp(state, contactId, date)",
    ],
    aiIntegration: "None required. A later phase could optionally draft the 4-sentence outreach message from lesson hustle-network-1's template via ai:call, but the template itself is static text and is useful without AI.",
  },
  {
    id: "salaryNegotiationPrep",
    label: "Salary Negotiation Prep",
    pillarId: "hustle",
    purpose: "Structures the negotiation script from lesson hustle-interview-3: captures a market-range data point plus source, the offer details, and assembles the filled-in negotiation script text via a pure template fill (same pattern as assembleCoverLetter — no AI required).",
    defaultState: {
      fields: {
        role: "",
        company: "",
        offerBase: "",
        marketRangeLow: "",
        marketRangeHigh: "",
        marketSource: "",
        targetAsk: "",
      },
      generatedScript: null,
      lastSaved: null,
    },
    storeNeeds: "Persist at state.tools.salaryNegotiationPrep. No AI dependency, no schema version bump.",
    suggestedReducers: [
      "setSalaryNegotiationField(state, key, value)",
      "generateNegotiationScript(fields) -- pure string assembler, same pattern as assembleCoverLetter in lib/tools/coverLetter.js.",
      "clearSalaryNegotiationScript(state)",
    ],
    aiIntegration: "None required for v1.",
  },
];

/**
 * getHustleTool(id) -> tool spec or undefined.
 * @param {string} id
 * @returns {object|undefined}
 */
export function getHustleTool(id) {
  return HUSTLE_TOOLS.find((t) => t.id === id);
}
