// lib/tools/coverLetter.js
// Pure ES-module reducers for the cover-letter tool.
// Operates on the FULL progress state; returns a new full state (immutable).

// ---------------------------------------------------------------------------
// Default slice
// ---------------------------------------------------------------------------

export const defaultCoverLetterState = {
  fields: {
    name: '',
    role: '',
    company: '',
    connection: '',
    skill1: '',
    skill2: '',
    cta: 'request interview',
  },
  aiResponse: null,
  lastSaved: null,
  tokenWarning: false,
};

// ---------------------------------------------------------------------------
// Internal helper — resolve the current cover-letter slice, falling back to
// the default when the namespace (or sub-key) is absent.
// ---------------------------------------------------------------------------

function getSlice(state) {
  return (state.tools && state.tools.coverLetter)
    ? state.tools.coverLetter
    : defaultCoverLetterState;
}

// ---------------------------------------------------------------------------
// Reducers
// ---------------------------------------------------------------------------

/**
 * setCoverLetterField(state, key, value) -> newState
 * Sets state.tools.coverLetter.fields[key] = value.  Fully immutable.
 */
export function setCoverLetterField(state, key, value) {
  const slice = getSlice(state);
  return {
    ...state,
    tools: {
      ...state.tools,
      coverLetter: {
        ...slice,
        fields: {
          ...slice.fields,
          [key]: value,
        },
      },
    },
  };
}

/**
 * setCoverLetterAIResponse(state, text, hasWarning = false) -> newState
 * Stores the AI-generated text plus metadata.
 */
export function setCoverLetterAIResponse(state, text, hasWarning = false) {
  const slice = getSlice(state);
  return {
    ...state,
    tools: {
      ...state.tools,
      coverLetter: {
        ...slice,
        aiResponse: text,
        tokenWarning: hasWarning,
        lastSaved: Date.now(),
      },
    },
  };
}

/**
 * clearCoverLetterAIResponse(state) -> newState
 * Clears aiResponse and tokenWarning; lastSaved is untouched.
 */
export function clearCoverLetterAIResponse(state) {
  const slice = getSlice(state);
  return {
    ...state,
    tools: {
      ...state.tools,
      coverLetter: {
        ...slice,
        aiResponse: null,
        tokenWarning: false,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Offline assembler
// ---------------------------------------------------------------------------

/**
 * assembleCoverLetter(fields) -> string
 *
 * Produces a finished, usable cover letter.
 * Partial-field hardening: no "undefined", no dangling fragments.
 */
export function assembleCoverLetter(fields) {
  // --- safe reads with fallbacks ---
  const name    = (fields.name    || '').trim() || '[Your Name]';
  const role    = (fields.role    || '').trim() || 'the role';
  const company = (fields.company || '').trim() || 'your organization';
  const conn    = (fields.connection || '').trim();
  const s1      = (fields.skill1  || '').trim();
  const s2      = (fields.skill2  || '').trim();
  const ctaKey  = (fields.cta     || '').trim();

  // --- paragraph 1: opening hook ---
  const opening =
    `I am writing to express my strong interest in ${role} at ${company}.` +
    ` With a background rooted in analytical thinking and a commitment to` +
    ` delivering results, I am confident in my ability to make a meaningful` +
    ` contribution to your team.`;

  // --- paragraph 2: finance / connection ---
  let connectionPara;
  if (conn) {
    connectionPara =
      `${conn} This passion drives my pursuit of opportunities where I can` +
      ` apply rigorous analysis and a client-focused mindset to real-world` +
      ` financial challenges.`;
  } else {
    connectionPara =
      `I have developed a strong interest in financial services and am drawn` +
      ` to organizations that value disciplined analysis, integrity, and` +
      ` long-term value creation. ${company} exemplifies these qualities, which` +
      ` is why I am particularly excited about this opportunity.`;
  }

  // --- paragraph 3: skill evidence ---
  let skillPara;
  if (s1 && s2) {
    skillPara =
      `My experience with ${s1} and ${s2} has equipped me to tackle complex` +
      ` problems efficiently and communicate findings clearly to stakeholders` +
      ` at every level.`;
  } else if (s1) {
    skillPara =
      `My proficiency in ${s1} has allowed me to deliver data-driven insights` +
      ` and drive measurable outcomes in high-stakes environments.`;
  } else if (s2) {
    skillPara =
      `My proficiency in ${s2} has allowed me to deliver data-driven insights` +
      ` and drive measurable outcomes in high-stakes environments.`;
  } else {
    skillPara =
      `I am eager to contribute and build my skill set in this role.`;
  }

  // --- paragraph 4: CTA ---
  let ctaPara;
  if (ctaKey === 'express interest') {
    ctaPara =
      `I would welcome the opportunity to learn more about ${company} and` +
      ` discuss how my background aligns with your goals. Thank you for` +
      ` considering my application.`;
  } else if (ctaKey === 'follow up') {
    ctaPara =
      `I plan to follow up in the coming week and would be delighted to` +
      ` connect at your earliest convenience. Thank you sincerely for your` +
      ` time and consideration.`;
  } else {
    // 'request interview' or any unknown value
    ctaPara =
      `I would be grateful for the opportunity to interview and further` +
      ` demonstrate how I can add value to ${company}. Please feel free to` +
      ` reach out at your convenience — I look forward to the conversation.`;
  }

  // --- assemble ---
  const greeting  = `Dear Hiring Team at ${company},`;
  const signOff   = `Sincerely,\n${name}`;

  return [greeting, opening, connectionPara, skillPara, ctaPara, signOff].join('\n\n');
}
