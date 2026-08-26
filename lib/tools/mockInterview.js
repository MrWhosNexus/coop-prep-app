// lib/tools/mockInterview.js
// Mock Interview — lessons hustle-interview-1/2.
//
// Offline-first: a fixed question set drawn from the Hustle curriculum plus a
// deterministic rubric grader means a user with NO API key gets a complete,
// useful mock interview. AI makes it adaptive and specific; it is never the
// price of entry.
//
// THE SECURITY INVARIANT: the LLM is INJECTED —
//   llm({ system, user, model, options }) => { ok: true, text } | { ok: false, error }
// matching lib/endpoints/call.js's contract. Production wires it to the
// ai:call IPC channel in the renderer. This module never fetches, never sees
// an apiKey, and runs under `node --test` with a fake.

import { HUSTLE_INTERVIEW_QUESTIONS } from "../../data/hustle.js";
import {
  STAR_PARTS,
  analyzeStarText,
  findStoriesForQuestion,
  listStories,
  storyToStarText,
  tagsForQuestion,
} from "./starStories.js";

// ---------------------------------------------------------------------------
// Default slice
// ---------------------------------------------------------------------------

export const defaultMockInterviewState = {
  sessions: [], // [{ id, question, questionSource, questionType, userAnswer, aiFeedback, offlineFeedback, score, timestamp }]
  activeQuestion: null,
  lastSaved: null,
};

/** @type {readonly string[]} */
export const QUESTION_TYPES = Object.freeze(["behavioral", "technical", "case"]);

// ---------------------------------------------------------------------------
// The offline question bank — the no-key path's substance.
//
// Targeted at JP Morgan Wealth Management / CFA-track analyst roles, which is
// what this fellowship's cohort is actually interviewing for.
// ---------------------------------------------------------------------------

/**
 * FIXED_QUESTIONS — the always-available set. Every entry carries what a good
 * answer contains, so the offline grader has something real to grade against
 * and the user gets a model answer with no key configured.
 *
 * @type {ReadonlyArray<{id: string, question: string, type: string, source: string, tags: string[], looksFor: string[], modelNote: string}>}
 */
export const FIXED_QUESTIONS = Object.freeze([
  {
    id: "mi-fit-1",
    question: "Why wealth management, and why JP Morgan specifically?",
    type: "behavioral",
    source: "fixed",
    tags: [],
    looksFor: ["a specific reason tied to the business", "something only true of this firm", "a personal throughline"],
    modelNote:
      "Name the actual work — the advisory relationship, the planning, the fiduciary duty — not the brand. Then one fact that is true of THIS firm and not its three competitors. Then your own throughline: what in your history makes this coherent rather than convenient.",
  },
  {
    id: "mi-beh-conflict",
    question: "Tell me about a time you disagreed with someone on your team. How did you handle it?",
    type: "behavioral",
    source: "fixed",
    tags: ["conflict"],
    looksFor: ["a real disagreement", "what YOU did", "a resolution and what it cost"],
    modelNote:
      "Pick a disagreement with real stakes where you were at least partly wrong or had to concede something. The interviewer is testing whether you can be disagreed with, not whether you win.",
  },
  {
    id: "mi-beh-failure",
    question: "Tell me about a time you failed. What did you learn?",
    type: "behavioral",
    source: "fixed",
    tags: ["failure"],
    looksFor: ["a real failure with a real cost", "ownership without excuses", "a specific behavior change since"],
    modelNote:
      "A real failure — not 'I'm a perfectionist' and not a success wearing a disguise. Own it in the first person, then name the specific thing you do differently now and the evidence it stuck.",
  },
  {
    id: "mi-beh-pressure",
    question: "Describe a time you had to deliver under a tight deadline with competing priorities.",
    type: "behavioral",
    source: "fixed",
    tags: ["pressure"],
    looksFor: ["the actual constraint", "how you triaged", "what you deliberately dropped"],
    modelNote:
      "The answer is in the triage. Name what you chose NOT to do and why — anyone can say they worked hard.",
  },
  {
    id: "mi-beh-leadership",
    question: "Tell me about a time you led without formal authority.",
    type: "behavioral",
    source: "fixed",
    tags: ["leadership"],
    looksFor: ["no positional power", "how you got buy-in", "a measurable outcome"],
    modelNote:
      "Influence without a title: you persuaded, you did the unglamorous work first, you made someone else's job easier. Land on what the group actually achieved.",
  },
  {
    id: "mi-beh-analytical",
    question: "Walk me through an analysis you're proud of. What did you find, and what did it change?",
    type: "behavioral",
    source: "fixed",
    tags: ["analyticalWin"],
    looksFor: ["the method", "a number", "what the finding changed"],
    modelNote:
      "This is your quantifiable win. State the question, the data, the method, and the number — then the decision it drove. An analysis nobody acted on is a hobby.",
  },
  {
    id: "mi-beh-client",
    question: "Tell me about a time you handled a difficult client or customer.",
    type: "behavioral",
    source: "fixed",
    tags: ["conflict", "pressure"],
    looksFor: ["the client's real concern", "what you did", "the outcome for the relationship"],
    modelNote:
      "Wealth management is a relationship business. Show you can hear an angry person's actual concern under the anger, and that you fixed the thing rather than managing the feeling.",
  },
  {
    id: "mi-tech-excel",
    question: "You have a 5,000-row transaction export. Walk me through building a pivot table that shows revenue by advisor by quarter.",
    type: "technical",
    source: "fixed",
    tags: [],
    looksFor: ["rows/columns/values structure", "named steps, out loud", "a check on the output"],
    modelNote:
      "Narrate it as if sharing your screen: clean the data, confirm headers, Insert > PivotTable, Advisor to Rows, Quarter to Columns, Revenue to Values as Sum, then sanity-check the grand total against the raw sum. The out-loud narration IS the skill being tested.",
  },
  {
    id: "mi-tech-xlookup",
    question: "What's the difference between XLOOKUP and VLOOKUP, and when does it matter?",
    type: "technical",
    source: "fixed",
    tags: [],
    looksFor: ["left-lookup", "no column-index fragility", "default exact match"],
    modelNote:
      "XLOOKUP looks left, does not break when a column is inserted (no hardcoded index), defaults to exact match, and has a built-in if-not-found. It matters the moment someone else edits your workbook.",
  },
  {
    id: "mi-tech-cfa",
    question: "A client asks why their bond fund lost value when rates went up. Explain it to them.",
    type: "technical",
    source: "fixed",
    tags: [],
    looksFor: ["inverse price/yield relationship", "duration", "plain language, no jargon dump"],
    modelNote:
      "Existing bonds paying less than new ones are worth less — price and yield move opposite. Duration says how much. Then the part that matters to a client: if they hold to maturity and the issuer pays, the coupon and principal are unchanged.",
  },
  {
    id: "mi-case-allocation",
    question: "A 28-year-old client with $50k to invest and no debt asks how to allocate it. How do you think about it?",
    type: "case",
    source: "fixed",
    tags: [],
    looksFor: ["framework stated FIRST", "questions before answers", "risk capacity vs tolerance"],
    modelNote:
      "State the framework out loud before any number: goals and time horizon, risk capacity versus risk tolerance, liquidity needs, tax situation, existing accounts. Ask what the money is FOR. A specific allocation without those answers is malpractice, and saying so is the right answer.",
  },
  {
    id: "mi-case-fees",
    question: "A prospective client says your fees are too high compared to a robo-advisor. Respond.",
    type: "case",
    source: "fixed",
    tags: [],
    looksFor: ["takes the objection seriously", "names what the fee buys", "no disparagement"],
    modelNote:
      "Don't attack the alternative — it's a legitimate product. Name what the fee actually buys: planning, tax coordination, and the behavioral work of stopping someone selling at the bottom. Then be honest that if they only want an allocation, they may not need you.",
  },
]);

/**
 * getQuestionBank(opts) -> the full offline bank: FIXED_QUESTIONS plus every
 * HUSTLE_INTERVIEW_QUESTIONS entry, normalized to one shape.
 *
 * @param {{type?: string}} [opts] filter by QUESTION_TYPES
 * @returns {Array<{id: string, question: string, type: string, source: string, tags: string[], looksFor: string[], modelNote: string}>}
 */
export function getQuestionBank(opts = {}) {
  const fromCurriculum = HUSTLE_INTERVIEW_QUESTIONS.map((q, i) => ({
    id: `mi-hustle-${i}`,
    question: q.question,
    type: QUESTION_TYPES.includes(q.type) ? q.type : "behavioral",
    source: "curriculum",
    tags: tagsForQuestion(q.question),
    looksFor: [],
    modelNote: q.sampleAnswer || "",
  }));
  const all = [...FIXED_QUESTIONS, ...fromCurriculum];
  if (opts.type && QUESTION_TYPES.includes(opts.type)) return all.filter((q) => q.type === opts.type);
  return all;
}

/**
 * pickQuestion(bank, opts) -> the next question, avoiding recent repeats.
 *
 * Deterministic when `random` is injected; the UI passes Math.random.
 *
 * @param {Array<object>} bank
 * @param {{askedIds?: string[], random?: () => number}} [opts]
 * @returns {object|null}
 */
export function pickQuestion(bank, opts = {}) {
  const list = Array.isArray(bank) ? bank : [];
  if (list.length === 0) return null;
  const asked = new Set(opts.askedIds || []);
  const fresh = list.filter((q) => !asked.has(q.id));
  const pool = fresh.length > 0 ? fresh : list; // exhausted the bank: start over
  const rnd = typeof opts.random === "function" ? opts.random : Math.random;
  const i = Math.min(pool.length - 1, Math.floor(rnd() * pool.length));
  return pool[i];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getSlice(state) {
  return state && state.tools && state.tools.mockInterview
    ? state.tools.mockInterview
    : defaultMockInterviewState;
}

function withSlice(state, slice) {
  return {
    ...state,
    tools: {
      ...(state && state.tools),
      mockInterview: { ...slice, lastSaved: Date.now() },
    },
  };
}

let idCounter = 0;
function makeId() {
  idCounter += 1;
  return `mi-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

// ---------------------------------------------------------------------------
// The rubric — deterministic, offline, free.
// ---------------------------------------------------------------------------

/** Cue words that mark each STAR part in a spoken answer. */
const STAR_CUES = Object.freeze({
  situation: ["when i", "at the time", "i was working", "we were", "the situation", "last year", "during my", "in my role", "the context"],
  task: ["i needed to", "my job was", "i was asked", "the goal was", "i had to", "my task", "responsible for", "the challenge was"],
  action: ["so i", "i built", "i started", "i decided", "i reached out", "i analyzed", "i proposed", "what i did", "i set up", "i ran"],
  result: ["as a result", "in the end", "which meant", "ultimately", "the outcome", "that led to", "we ended up", "by the end", "since then"],
});

/**
 * detectStarParts(answer) -> which STAR parts a free-text answer contains.
 *
 * A cue phrase OR a sufficiently developed answer counts. This is a heuristic
 * and is honest about it: it is a smoke detector, not a judge. The AI path
 * grades properly; this one catches the answer with no Result at all.
 *
 * @param {string} answer
 * @returns {{situation: boolean, task: boolean, action: boolean, result: boolean}}
 */
export function detectStarParts(answer) {
  const text = String(answer || "").toLowerCase();
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const out = {};
  for (const part of STAR_PARTS) {
    const cued = STAR_CUES[part].some((cue) => text.includes(cue));
    out[part] = cued;
  }
  // A long answer that opens with context almost certainly has a Situation
  // even without a cue phrase; don't punish a fluent speaker for phrasing.
  if (!out.situation && words >= 40) out.situation = true;
  return out;
}

/** Rubric weights — must sum to 100. */
export const RUBRIC = Object.freeze([
  { key: "situation", label: "Situation", weight: 10, why: "The interviewer needs the context in one or two sentences." },
  { key: "task", label: "Task", weight: 10, why: "What was actually being asked of you." },
  { key: "action", label: "Action", weight: 25, why: "The bulk of the answer. This is what they are grading." },
  { key: "result", label: "Result", weight: 25, why: "An answer with no result is a story with no ending." },
  { key: "specificity", label: "Specificity", weight: 20, why: "Concrete numbers, not adjectives." },
  { key: "ownership", label: "Ownership ('I' not 'we')", weight: 10, why: "They are hiring you, not your old team." },
]);

/** Answers shorter than this are not answers. */
const MIN_ANSWER_WORDS = 30;
/** Past this, an answer is rambling — a behavioral answer is ~90 seconds. */
const MAX_ANSWER_WORDS = 320;

/**
 * gradeAnswerOffline(question, answer) -> a full rubric verdict with no AI.
 *
 * This is what a user with no API key gets, and it is a real product: it
 * catches the missing Result, the missing number, and the diffuse "we" —
 * which is most of what goes wrong in an entry-level behavioral answer.
 *
 * @param {object|string} question a bank entry or raw question text
 * @param {string} answer
 * @returns {{score: number, breakdown: Array<{key: string, label: string, earned: number, weight: number, pass: boolean, note: string}>, strengths: string[], improvement: string, wordCount: number, source: "offline"}}
 */
export function gradeAnswerOffline(question, answer) {
  const q = typeof question === "string" ? { question, type: "behavioral", looksFor: [], modelNote: "" } : question || {};
  const text = String(answer || "");
  const analysis = analyzeStarText(text);
  const parts = detectStarParts(text);
  const isBehavioral = (q.type || "behavioral") === "behavioral";

  const breakdown = [];
  const strengths = [];
  const problems = [];

  for (const row of RUBRIC) {
    let pass = false;
    let note = "";

    if (STAR_PARTS.includes(row.key)) {
      // STAR structure is graded on behavioral answers; on technical/case the
      // structure points ride on the answer being developed at all, because
      // "Situation" is not a thing in "what is duration".
      if (isBehavioral) {
        pass = parts[row.key];
        note = pass ? "Present." : `No clear ${row.label.toLowerCase()}. ${row.why}`;
      } else {
        pass = analysis.words >= MIN_ANSWER_WORDS;
        note = pass ? "Developed." : "Too thin to assess.";
      }
    } else if (row.key === "specificity") {
      pass = analysis.hasNumbers;
      note = pass
        ? `Concrete: ${analysis.numbers.slice(0, 3).join(", ")}.`
        : "No numbers anywhere. 'Significantly improved' is an adjective; '18% faster' is evidence.";
    } else if (row.key === "ownership") {
      pass = analysis.firstPerson;
      note = pass
        ? "You said what YOU did."
        : analysis.weCount > 0
        ? `Leans on "we" (${analysis.weCount} times vs "I" ${analysis.iCount}). They cannot hire your team.`
        : "No first-person ownership at all — say what you did.";
    }

    breakdown.push({ key: row.key, label: row.label, earned: pass ? row.weight : 0, weight: row.weight, pass, note });
    if (pass) strengths.push(row.label);
    else problems.push(row);
  }

  let score = breakdown.reduce((a, r) => a + r.earned, 0);

  // Length gates, applied after the rubric so they can't produce a negative.
  if (analysis.words < MIN_ANSWER_WORDS) {
    score = Math.min(score, 35);
  }
  if (analysis.words > MAX_ANSWER_WORDS) {
    score = Math.max(0, score - 10);
  }

  // Exactly one improvement — the lessons' voice. Ordered by what costs most.
  let improvement;
  if (analysis.words === 0) {
    improvement = "Write an actual answer — even a rough one. You cannot edit a blank page under interview pressure.";
  } else if (analysis.words < MIN_ANSWER_WORDS) {
    improvement = `${analysis.words} words is too thin for a real answer. Aim for 90 seconds spoken — roughly 150-200 words.`;
  } else if (analysis.words > MAX_ANSWER_WORDS) {
    improvement = `${analysis.words} words is a monologue. Cut the setup — an interviewer needs two sentences of context, not a paragraph.`;
  } else if (isBehavioral && !parts.result) {
    improvement = "Add the Result. You told them what you did and then stopped — what changed because of it, and by how much?";
  } else if (!analysis.hasNumbers) {
    improvement = "Put one number in it. A number is the difference between a claim and evidence.";
  } else if (!analysis.firstPerson) {
    improvement = 'Replace the "we" with "I" wherever it was actually you. The interviewer is grading one person.';
  } else if (isBehavioral && !parts.action) {
    improvement = "The Action is thin — that is the part they are grading. Spend most of the answer on what you specifically did.";
  } else if (problems.length > 0) {
    improvement = problems[0].why;
  } else {
    improvement = "This is a strong answer. Say it out loud twice — fluency under pressure is a separate skill from having the words.";
  }

  return {
    score,
    breakdown,
    strengths,
    improvement,
    wordCount: analysis.words,
    source: "offline",
  };
}

// ---------------------------------------------------------------------------
// Reducers
// ---------------------------------------------------------------------------

/**
 * setActiveQuestion(state, question) -> newState.
 * @param {object} state
 * @param {object|null} question
 * @returns {object}
 */
export function setActiveQuestion(state, question) {
  const slice = getSlice(state);
  return withSlice(state, { ...slice, activeQuestion: question });
}

/**
 * startMockInterviewSession(state, question, questionSource) -> newState.
 * Appends an open session and makes it the active question.
 *
 * @param {object} state
 * @param {object|string} question
 * @param {string} [questionSource] "fixed" | "curriculum" | "custom"
 * @returns {object}
 */
export function startMockInterviewSession(state, question, questionSource) {
  const slice = getSlice(state);
  const q = typeof question === "string" ? { question, type: "behavioral" } : question || {};
  const session = {
    id: makeId(),
    questionId: q.id || null,
    question: String(q.question || ""),
    questionSource: questionSource || q.source || "custom",
    questionType: QUESTION_TYPES.includes(q.type) ? q.type : "behavioral",
    userAnswer: "",
    aiFeedback: null,
    offlineFeedback: null,
    score: null,
    timestamp: Date.now(),
  };
  return withSlice(state, {
    ...slice,
    sessions: [...slice.sessions, session],
    activeQuestion: q,
  });
}

/**
 * recordMockInterviewAnswer(state, sessionId, answerText) -> newState.
 * Grades offline immediately — the user gets a verdict with no key and no
 * network, and the AI path (if any) enriches it afterwards.
 *
 * @param {object} state
 * @param {string} sessionId
 * @param {string} answerText
 * @returns {object}
 */
export function recordMockInterviewAnswer(state, sessionId, answerText) {
  const slice = getSlice(state);
  return withSlice(state, {
    ...slice,
    sessions: slice.sessions.map((s) => {
      if (s.id !== sessionId) return s;
      const graded = gradeAnswerOffline({ question: s.question, type: s.questionType }, answerText);
      return { ...s, userAnswer: String(answerText || ""), offlineFeedback: graded, score: graded.score };
    }),
  });
}

/**
 * setMockInterviewFeedback(state, sessionId, feedbackText) -> newState.
 * @param {object} state
 * @param {string} sessionId
 * @param {string} feedbackText
 * @returns {object}
 */
export function setMockInterviewFeedback(state, sessionId, feedbackText) {
  const slice = getSlice(state);
  return withSlice(state, {
    ...slice,
    sessions: slice.sessions.map((s) => (s.id === sessionId ? { ...s, aiFeedback: feedbackText } : s)),
  });
}

/**
 * clearMockInterviewSession(state, sessionId) -> newState.
 * @param {object} state
 * @param {string} sessionId
 * @returns {object}
 */
export function clearMockInterviewSession(state, sessionId) {
  const slice = getSlice(state);
  return withSlice(state, { ...slice, sessions: slice.sessions.filter((s) => s.id !== sessionId) });
}

/**
 * listSessions(state) -> the sessions array (never undefined).
 * @param {object} state
 * @returns {object[]}
 */
export function listSessions(state) {
  return getSlice(state).sessions;
}

/**
 * sessionStats(state) -> practice history at a glance.
 * @param {object} state
 * @returns {{count: number, answered: number, averageScore: number, best: number, askedIds: string[], byType: Record<string, number>}}
 */
export function sessionStats(state) {
  const sessions = listSessions(state);
  const scored = sessions.filter((s) => typeof s.score === "number");
  const byType = {};
  for (const t of QUESTION_TYPES) byType[t] = 0;
  for (const s of sessions) if (byType[s.questionType] != null) byType[s.questionType] += 1;
  return {
    count: sessions.length,
    answered: scored.length,
    averageScore: scored.length ? Math.round(scored.reduce((a, s) => a + s.score, 0) / scored.length) : 0,
    best: scored.length ? Math.max(...scored.map((s) => s.score)) : 0,
    askedIds: sessions.map((s) => s.questionId).filter(Boolean),
    byType,
  };
}

// ---------------------------------------------------------------------------
// The AI path — optional enhancement over a complete offline product.
// ---------------------------------------------------------------------------

/** @type {{system: string, user: string}} */
export const MOCK_INTERVIEW_PROMPT = Object.freeze({
  system:
    "You are an interview coach for early-career candidates targeting financial-services analyst roles " +
    "(JP Morgan Wealth Management, CFA-track). Your voice is direct, specific, and warm — you are on the " +
    "candidate's side, which is exactly why you do not flatter them. " +
    "Assess exactly three things, in this order: " +
    "(1) STAR completeness — is there a clear Situation, Task, Action, and Result? Name any part that is missing. " +
    "(2) Specificity — are there concrete numbers? Is it 'I' or a diffuse 'we'? Quote their actual words when you " +
    "flag something. " +
    "(3) Exactly ONE concrete improvement — the single highest-value change, phrased as an instruction they can " +
    "act on in the next thirty seconds. Not three. One. " +
    "Rules: never invent details about the candidate's experience; never rewrite their answer for them; " +
    "under 200 words; plain text, no markdown headers.",
  user:
    "Interview question ({{type}}): {{question}}\n\n" +
    "What a strong answer contains: {{looksFor}}\n\n" +
    "The candidate's answer:\n{{answer}}\n\n" +
    "Deterministic pre-analysis (trust these, they are measured, not guessed):\n" +
    "- Word count: {{wordCount}}\n" +
    "- Numbers found in the answer: {{numbers}}\n" +
    "- First-person 'I' count: {{iCount}}, 'we' count: {{weCount}}\n\n" +
    "Give your assessment.",
});

/**
 * buildFeedbackSlots(question, answer) -> slots for fillPrompt().
 * @param {object|string} question
 * @param {string} answer
 * @returns {object}
 */
export function buildFeedbackSlots(question, answer) {
  const q = typeof question === "string" ? { question, type: "behavioral", looksFor: [] } : question || {};
  const analysis = analyzeStarText(answer);
  return {
    type: q.type || "behavioral",
    question: String(q.question || ""),
    looksFor: Array.isArray(q.looksFor) && q.looksFor.length ? q.looksFor.join("; ") : "a complete, specific, first-person answer",
    answer: String(answer || ""),
    wordCount: String(analysis.words),
    numbers: analysis.numbers.length ? analysis.numbers.join(", ") : "none",
    iCount: String(analysis.iCount),
    weCount: String(analysis.weCount),
  };
}

/**
 * Map an lib/endpoints/call.js error onto something a user can act on.
 * Every branch points at Settings rather than leaving a dead end.
 *
 * @param {object} error
 * @returns {string}
 */
export function describeAiError(error) {
  const type = error && error.type;
  switch (type) {
    case "NO_ENDPOINT":
    case "NO_KEY":
      return "No AI endpoint configured — showing the offline rubric instead. Add an endpoint in Settings → AI Endpoints for adaptive follow-ups.";
    case "NO_BRIDGE":
      return "AI feedback needs the desktop app — showing the offline rubric instead.";
    case "AUTH_ERROR":
      return "The endpoint rejected its API key — showing the offline rubric instead. Update the key in Settings → AI Endpoints.";
    case "NETWORK_ERROR":
      return "Couldn't reach the AI endpoint — showing the offline rubric instead.";
    case "BAD_REQUEST":
      return `${(error && error.message) || "The request was rejected."} Showing the offline rubric instead.`;
    case "API_ERROR":
      return `Provider error${error && error.status ? ` ${error.status}` : ""} — showing the offline rubric instead. Check Settings → AI Endpoints.`;
    default:
      return "The AI call failed — showing the offline rubric instead.";
  }
}

/**
 * gradeAnswer(args, llm?) -> the graded verdict, AI-enriched where possible.
 *
 * ALWAYS returns a usable rubric: the offline grade is computed first and is
 * the result whenever there is no llm, no endpoint, or a failed call. The AI
 * text is additive. `notice` explains any degradation and names Settings —
 * the user never hits a dead end and is never silently downgraded.
 *
 * There is no env-var key path and no ambient fallback: with no injected llm
 * this returns the honest offline result rather than authenticating itself.
 *
 * @param {{question: object|string, answer: string, model?: string, options?: object}} args
 * @param {(req: {system: string, user: string, model?: string, options?: object}) => Promise<{ok: boolean, text?: string, error?: object}>} [llm]
 * @returns {Promise<{ok: true, feedback: object, aiText: string|null, source: "ai"|"offline", notice: string}>}
 */
export async function gradeAnswer(args, llm) {
  const { question, answer, model, options } = args || {};
  const feedback = gradeAnswerOffline(question, answer);

  if (typeof llm !== "function") {
    return {
      ok: true,
      feedback,
      aiText: null,
      source: "offline",
      notice: "",
    };
  }

  const slots = buildFeedbackSlots(question, answer);
  const user = fillSlots(MOCK_INTERVIEW_PROMPT.user, slots);

  let result;
  try {
    result = await llm({ system: MOCK_INTERVIEW_PROMPT.system, user, model, options });
  } catch (err) {
    return {
      ok: true,
      feedback,
      aiText: null,
      source: "offline",
      notice: describeAiError({ type: "IPC_ERROR", message: String((err && err.message) || err) }),
    };
  }

  if (!result || result.ok !== true || typeof result.text !== "string" || !result.text.trim()) {
    return {
      ok: true,
      feedback,
      aiText: null,
      source: "offline",
      notice: describeAiError(result && result.error),
    };
  }

  return {
    ok: true,
    feedback: { ...feedback, source: "ai" },
    aiText: result.text.trim(),
    source: "ai",
    notice: "",
  };
}

/**
 * Local {{slot}} filler. lib/ai/fill-prompt.js's fillPrompt is equivalent, but
 * inlining keeps this module importable with no cross-tool coupling.
 * @param {string} template
 * @param {Record<string, string>} slots
 * @returns {string}
 */
function fillSlots(template, slots) {
  return String(template || "").replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_m, key) => {
    const v = slots[key];
    if (v === undefined || v === null || String(v).trim() === "") return "[not provided]";
    return String(v);
  });
}

// ---------------------------------------------------------------------------
// STAR bank integration — the keystone paying off.
// ---------------------------------------------------------------------------

/**
 * suggestStoriesFor(state, questionText) -> the bank's best answers to this
 * question, ranked. A user staring at "tell me about a failure" should not
 * have to remember they already wrote that story — this hands it to them.
 *
 * @param {object} state full progress state
 * @param {string} questionText
 * @returns {Array<{story: object, fit: number, matchedTags: string[]}>}
 */
export function suggestStoriesFor(state, questionText) {
  return findStoriesForQuestion(listStories(state), questionText).filter((r) => r.fit > 0);
}

/**
 * prefillFromStory(story) -> a first-draft answer built from a STAR story.
 * The user edits it into speech; they do not retype the experience.
 *
 * @param {object} story
 * @returns {string}
 */
export function prefillFromStory(story) {
  const s = story || {};
  const parts = STAR_PARTS.map((p) => String(s[p] || "").trim()).filter(Boolean);
  if (parts.length === 0) return "";
  return parts.join(" ");
}

/**
 * storyReference(story) -> the labelled STAR text, for showing alongside the
 * answer box while the user practises.
 * @param {object} story
 * @returns {string}
 */
export function storyReference(story) {
  return storyToStarText(story);
}
