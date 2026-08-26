/**
 * fill-prompt.js
 * Pure prompt-filling and token-budget utilities for the COOP Prep AI engine.
 * No imports, no side effects, ES module exports only.
 */

/**
 * fillPrompt(template, slots) -> string
 *
 * Replaces every {{KEY}} (with optional inner whitespace) in `template`
 * with the corresponding value from `slots`.
 *
 * - KEY pattern: alphanumeric characters and underscores.
 * - If slots[KEY] is undefined, null, or empty/whitespace-only, emits "[not provided]".
 * - If KEY is entirely absent from slots, emits "[not provided]".
 * - template must be a string; returns "" for empty/falsy template.
 */
export function fillPrompt(template, slots) {
  if (!template) return "";

  const safeSlots = slots && typeof slots === "object" ? slots : {};

  // Match {{ optional-whitespace KEY optional-whitespace }}
  return template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_match, key) => {
    if (!(key in safeSlots)) return "[not provided]";
    const val = safeSlots[key];
    if (val === undefined || val === null) return "[not provided]";
    const str = String(val);
    if (str.trim() === "") return "[not provided]";
    return str;
  });
}

/**
 * estimateTokens(str) -> number
 *
 * Rough 1-token-per-4-chars heuristic used for budget checks.
 */
export function estimateTokens(str) {
  return Math.ceil((str || "").length / 4);
}

/**
 * applyTokenGuard(filledPrompt, maxInputTokens = 600)
 *   -> { prompt: string, truncated: boolean }
 *
 * If the estimated token count is within budget, returns the prompt unchanged
 * with truncated: false.
 *
 * If over budget, iteratively truncates:
 *   - On each pass, find the longest line > 80 chars and remove characters
 *     from the end of that line (or the whole string if no such line exists).
 *   - Append " [truncated for length]" marker.
 *   - Repeat until estimateTokens(result) <= maxInputTokens or nothing is left.
 */
export function applyTokenGuard(filledPrompt, maxInputTokens = 600) {
  const input = filledPrompt || "";

  if (estimateTokens(input) <= maxInputTokens) {
    return { prompt: input, truncated: false };
  }

  const MARKER = " [truncated for length]";
  // Budget we must stay within (marker chars count toward the token estimate)
  const budgetChars = maxInputTokens * 4;

  let current = input;

  while (estimateTokens(current) > maxInputTokens) {
    // Remove the marker for working purposes, then re-add at the end.
    const withoutMarker = current.endsWith(MARKER)
      ? current.slice(0, current.length - MARKER.length)
      : current;

    // How many chars of actual content we can keep (reserving space for marker)
    const allowedContentChars = budgetChars - MARKER.length;

    if (allowedContentChars <= 0) {
      // Extreme edge case: even the marker alone is over budget
      current = MARKER.slice(0, budgetChars);
      break;
    }

    const lines = withoutMarker.split("\n");

    // Find the index of the longest line > 80 chars
    let longestIdx = -1;
    let longestLen = 80; // only consider lines strictly longer than 80
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > longestLen) {
        longestLen = lines[i].length;
        longestIdx = i;
      }
    }

    if (longestIdx !== -1) {
      // Remove enough characters from the longest line in a single pass to meet
      // the budget, rather than one char per iteration — this avoids an O(n^2)
      // worst case when the whole prompt is a single very long line. Clamp so
      // the line never shrinks below zero, and always drop at least one char.
      const excess = (withoutMarker.length + MARKER.length) - budgetChars;
      const dropCount = Math.min(lines[longestIdx].length, Math.max(1, excess));
      lines[longestIdx] = lines[longestIdx].slice(0, lines[longestIdx].length - dropCount);
      const candidate = lines.join("\n") + MARKER;
      current = candidate;
    } else {
      // No line > 80 chars — truncate the whole string to fit
      current = withoutMarker.slice(0, allowedContentChars) + MARKER;
      break; // one-shot — this will fit by construction
    }
  }

  return { prompt: current, truncated: true };
}
