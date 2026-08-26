// lib/endpoints/call.js
// The single place a chat request is made. Two wire shapes: OpenAI-compatible
// and Anthropic Messages.
//
// Result contract mirrors lib/ai/client.js:
//   { ok: true,  text: string, model: string }
//   { ok: false, error: { type, ... } }
//
// Error types:
//   NO_ENDPOINT   - no endpoint resolved (registry empty / bad id)
//   INVALID_URL   - endpoint has no usable base URL
//   BAD_REQUEST   - request rejected locally before any fetch (e.g. prefill)
//   NETWORK_ERROR - DNS/TLS/timeout; no response
//   AUTH_ERROR    - 401/403, carries an actionable `hint` naming Settings
//   API_ERROR     - any other non-2xx, carries status + provider message
//   BAD_RESPONSE  - 2xx whose body could not be understood
//
// The key NEVER appears in a returned object, a thrown error, or a log line.
// Provider error text is scrubbed through redactKey() before it is surfaced.
//
// Fetch is injectable. No DOM. Importable under `node --test`.

import { buildAuthHeaders, redactKey } from "./headers.js";
import { isAnthropicShaped, normalizeBaseUrl } from "./providers.js";
import { candidateChatUrls, candidateUrls, tryCandidates } from "./probe.js";
import { sanitizeResponse } from "../ai/sanitize.js";

/** Default output cap. Matches the existing lib/ai/client.js budget. */
export const DEFAULT_MAX_TOKENS = 500;

/**
 * Per-model request rules for the Anthropic Messages API.
 *
 * Across ALL current Anthropic models: `temperature`, `top_p`, `top_k` and
 * `budget_tokens` are REMOVED and return 400 if sent. Depth is controlled by
 * output_config.effort. This module therefore never sends any of them.
 *
 * `thinking` is the one axis that differs:
 *   - claude-fable-5:  thinking is ALWAYS on. The param must be OMITTED
 *                      entirely — an explicit {type:"disabled"} is a 400.
 *   - claude-opus-4-8: adaptive is the only on-mode; omitting it runs WITHOUT
 *                      thinking, so it is sent explicitly.
 *   - claude-sonnet-5: adaptive.
 *
 * Unknown model ids (a BYO gateway's own naming) fall back to omitting
 * `thinking`, which is accepted everywhere. Being quietly non-thinking beats a
 * hard 400 on a model whose rules we cannot know.
 *
 * @type {Record<string, { thinking: object|null }>}
 */
export const ANTHROPIC_MODEL_RULES = Object.freeze({
  "claude-fable-5": { thinking: null },
  "claude-opus-4-8": { thinking: { type: "adaptive" } },
  "claude-sonnet-5": { thinking: { type: "adaptive" } },
});

/** Effort levels accepted by output_config.effort. */
export const EFFORT_LEVELS = Object.freeze(["low", "medium", "high", "xhigh", "max"]);

/**
 * Build the message array from either a {system, user} pair or explicit messages.
 *
 * @param {{ system?: string, user?: string, messages?: {role: string, content: string}[] }} input
 * @returns {{ system: string, messages: {role: string, content: string}[] }}
 */
function normalizeMessages(input) {
  if (Array.isArray(input?.messages) && input.messages.length) {
    const system = input.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    return {
      system: input.system ?? system,
      messages: input.messages.filter((m) => m.role !== "system"),
    };
  }
  return {
    system: input?.system ?? "",
    messages: [{ role: "user", content: input?.user ?? "" }],
  };
}

/**
 * Build the Anthropic Messages request body.
 *
 * @param {{ model: string, system: string, messages: object[], maxTokens: number, effort?: string }} args
 * @returns {object}
 */
export function buildAnthropicBody({ model, system, messages, maxTokens, effort }) {
  /** @type {Record<string, unknown>} */
  const body = { model, max_tokens: maxTokens, messages };
  if (system) body.system = system;

  const rules = ANTHROPIC_MODEL_RULES[model];
  // Omit `thinking` for fable-5 and for unknown models; send it where known.
  if (rules?.thinking) body.thinking = rules.thinking;

  if (effort && EFFORT_LEVELS.includes(effort)) {
    body.output_config = { effort };
  }

  // NOTE: no temperature / top_p / top_k / budget_tokens. All four are 400s.
  return body;
}

/**
 * Build the OpenAI chat-completions request body.
 *
 * @param {{ model: string, system: string, messages: object[], maxTokens: number, stream: boolean }} args
 * @returns {object}
 */
export function buildOpenAIBody({ model, system, messages, maxTokens, stream }) {
  const full = system ? [{ role: "system", content: system }, ...messages] : messages;
  return { model, messages: full, max_tokens: maxTokens, stream };
}

/**
 * Extract assistant text from a non-streamed response body of either shape.
 *
 * @param {any} data
 * @returns {string}
 */
export function extractText(data) {
  // Anthropic: { content: [{ type: "text", text }] }
  if (Array.isArray(data?.content)) {
    return data.content
      .filter((b) => b?.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("");
  }
  // OpenAI: { choices: [{ message: { content } }] }
  const openai = data?.choices?.[0]?.message?.content;
  if (typeof openai === "string") return openai;
  return "";
}

/**
 * Pull the incremental text out of one parsed SSE data payload.
 *
 * @param {any} payload
 * @returns {string}
 */
export function extractDelta(payload) {
  // Anthropic: { type: "content_block_delta", delta: { type: "text_delta", text } }
  const anthropic = payload?.delta?.text;
  if (typeof anthropic === "string") return anthropic;
  // OpenAI: { choices: [{ delta: { content } }] }
  const openai = payload?.choices?.[0]?.delta?.content;
  if (typeof openai === "string") return openai;
  return "";
}

/**
 * Consume an SSE body, accumulating assistant text.
 *
 * @param {Response} response
 * @param {(delta: string) => void} [onDelta]
 * @returns {Promise<string>}
 */
async function readSse(response, onDelta) {
  const body = response.body;
  if (!body || typeof body.getReader !== "function") {
    // Provider advertised SSE but gave us no stream. Fall back to text.
    const raw = await response.text();
    return raw;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by a blank line.
    let split;
    while ((split = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);

      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payloadText = line.slice(5).trim();
        if (!payloadText || payloadText === "[DONE]") continue;
        let payload;
        try {
          payload = JSON.parse(payloadText);
        } catch {
          continue; // keepalive or partial frame
        }
        const delta = extractDelta(payload);
        if (delta) {
          text += delta;
          if (onDelta) onDelta(delta);
        }
      }
    }
  }

  return text;
}

/**
 * Call an endpoint.
 *
 * @param {object} args
 * @param {{ baseUrl: string, apiKey?: string }} args.endpoint - a StoredEndpoint from registry.resolve()
 * @param {string} args.model    - discovered via probe.js; never a preset default
 * @param {string} [args.system]
 * @param {string} [args.user]
 * @param {{role: string, content: string}[]} [args.messages]
 * @param {number} [args.maxTokens]
 * @param {string} [args.effort]  - low|medium|high|xhigh|max (Anthropic-shaped only)
 * @param {boolean} [args.stream]
 * @param {(delta: string) => void} [args.onDelta]
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<{ok: true, text: string, model: string} | {ok: false, error: object}>}
 */
export async function callEndpoint(args, fetchFn = fetch) {
  const { endpoint, model, maxTokens = DEFAULT_MAX_TOKENS, effort, stream = false, onDelta } = args ?? {};

  if (!endpoint) {
    return {
      ok: false,
      error: {
        type: "NO_ENDPOINT",
        message: "No AI endpoint is configured. Add one in Settings → AI Endpoints.",
      },
    };
  }

  const root = normalizeBaseUrl(endpoint.baseUrl ?? "");
  if (!root) {
    return { ok: false, error: { type: "INVALID_URL", message: "This endpoint has no base URL." } };
  }
  if (!model) {
    return {
      ok: false,
      error: {
        type: "BAD_REQUEST",
        message: "No model selected. Test the endpoint in Settings to discover its models.",
      },
    };
  }

  const { system, messages } = normalizeMessages(args);
  const anthropic = isAnthropicShaped(root);

  // Assistant prefill is a 400 on every current Anthropic model. Catch it here
  // so the user gets a clear reason instead of an opaque provider error.
  if (anthropic && messages[messages.length - 1]?.role === "assistant") {
    return {
      ok: false,
      error: {
        type: "BAD_REQUEST",
        message: "Anthropic models do not support assistant prefill; the last message must be from the user.",
      },
    };
  }

  const headers = buildAuthHeaders(endpoint);
  const body = anthropic
    ? { ...buildAnthropicBody({ model, system, messages, maxTokens, effort }), ...(stream ? { stream: true } : {}) }
    : buildOpenAIBody({ model, system, messages, maxTokens, stream });

  // Both shapes go through probe.js's candidate builder — the ONE place the
  // /v1/v1 fix lives. Hardcoding `${root}/v1/messages` here reintroduced the
  // very bug that module exists to prevent: a root the user pasted with its
  // version segment already on it (https://api.anthropic.com/v1 — the URL
  // Anthropic's own docs show) became /v1/v1/messages. Worse, a single-element
  // candidate list has nothing to fall through TO, so the 404-only fallthrough
  // could not mask it: the endpoint tested green in Settings and 404'd on first
  // real use.
  const urls = anthropic ? candidateUrls(root, "messages") : candidateChatUrls(root);

  const attempted = await tryCandidates(urls, (url) =>
    fetchFn(url, { method: "POST", headers, body: JSON.stringify(body) })
  );
  if (!attempted.ok) return attempted;

  const { response } = attempted;

  if (!response.ok) {
    let message = "";
    try {
      const data = await response.json();
      const candidate = data?.error?.message ?? data?.error ?? data?.message;
      if (typeof candidate === "string") message = redactKey(candidate, endpoint.apiKey);
    } catch {
      // Unparseable error body.
    }
    if (response.status === 401 || response.status === 403) {
      const hasKey = typeof endpoint.apiKey === "string" && endpoint.apiKey.trim().length > 0;
      return {
        ok: false,
        error: {
          type: "AUTH_ERROR",
          status: response.status,
          message,
          hint: hasKey
            ? "This endpoint's API key was rejected. Update it in Settings → AI Endpoints."
            : "This endpoint has no API key. Add one in Settings → AI Endpoints.",
        },
      };
    }
    return { ok: false, error: { type: "API_ERROR", status: response.status, message } };
  }

  // Some providers ignore `stream: true` and answer with a whole JSON body, so
  // branch on what actually came back rather than on what we asked for.
  const contentType = response.headers?.get?.("content-type") ?? "";
  const isSse = contentType.toLowerCase().includes("text/event-stream");

  let raw = "";
  if (isSse) {
    try {
      raw = await readSse(response, onDelta);
    } catch {
      return { ok: false, error: { type: "BAD_RESPONSE", message: "The response stream ended unexpectedly." } };
    }
  } else {
    try {
      raw = extractText(await response.json());
    } catch {
      return { ok: false, error: { type: "BAD_RESPONSE", message: "The response was not valid JSON." } };
    }
  }

  return { ok: true, text: sanitizeResponse(raw), model };
}
