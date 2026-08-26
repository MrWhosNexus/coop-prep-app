// lib/ai/client.js
// The renderer's LLM caller.
//
// THE SECURITY INVARIANT: this module holds no credential and opens no socket.
// It hands the request to the Electron main process over the ai:call IPC
// channel and listens for ai:stream events; the main process resolves the
// endpoint out of the registry (where the key lives, at rest in a 0600
// endpoints.json) and makes the network call itself. There is nothing here for
// a compromised renderer to read.
//
// It used to do the opposite: read a key out of localStorage and attach it as
// `Authorization: Bearer …` on a fetch from the page. That is why the key path
// is gone rather than merely unused — see test/ai.test.js, "no plaintext API
// key is reachable from renderer code".
//
// The wire protocol here is the one components/notes/LessonBuilder.js
// established (requestId-scoped call + stream); this module is that adapter
// hoisted out of the component so it is testable under `node --test`, which
// has no JSX loader.

import { applyTokenGuard } from './fill-prompt.js';
import { sanitizeResponse } from './sanitize.js';

/** The bridge is absent in plain-browser dev; every AI action guards on it. */
export function getBridge() {
  return typeof window !== 'undefined' && window.coop ? window.coop : null;
}

/**
 * Choose the endpoint an AI tool should default to.
 *
 * Prefers a keyed endpoint, because that is exactly what lights the Dashboard's
 * AI badge (`endpoints.some(e => e.hasKey)`). Keeping the two rules in step is
 * what stops "badge says AI is on -> Enhance bounces you to Settings -> Settings
 * shows a working endpoint" from becoming a loop. Keyless endpoints are still
 * offered as a fallback: a local runtime (Ollama) needs no key.
 *
 * @param {{ id: string, hasKey?: boolean }[]} endpoints - key-free EndpointViews
 * @returns {string} the endpoint id, or "" when there is nothing to call
 */
export function pickDefaultEndpointId(endpoints) {
  const list = Array.isArray(endpoints) ? endpoints : [];
  const keyed = list.find((ep) => ep?.hasKey);
  return (keyed ?? list[0])?.id ?? '';
}

/**
 * Normalize a stream error.
 *
 * electron/ipc/handlers.js forwards lib/endpoints/call.js's TYPED error object
 * ({ type, message, hint?, status? }) so the branches above can tell "your key
 * was rejected" from "the endpoint is unreachable". A bare string still arrives
 * for cancellation and for any untyped internal failure; it becomes API_ERROR.
 */
function toError(raw) {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw === 'string' && raw) return { type: 'API_ERROR', message: raw };
  return { type: 'API_ERROR', message: 'The AI call failed.' };
}

/**
 * callLLM({ system, user, endpointId, model, options }, bridge?) -> Promise<Result>
 *
 * Result shapes:
 *   Success:        { ok: true,  text: string }
 *   Success + warn: { ok: true,  text: string, warning: { type: 'TOKEN_LIMIT' } }
 *   No desktop app: { ok: false, error: { type: 'NO_BRIDGE',   message: string } }
 *   Nothing to call:{ ok: false, error: { type: 'NO_ENDPOINT', message: string } }
 *   Channel failure:{ ok: false, error: { type: 'IPC_ERROR',   message: string } }
 *   Call failure:   { ok: false, error: { type, message, hint? } } from lib/endpoints/call.js
 *
 * @param {{ system: string, user: string, endpointId: string, model: string, options?: object }} request
 * @param {object} [bridge] - injectable for tests; defaults to window.coop
 * @returns {Promise<object>}
 */
export function callLLM({ system, user, endpointId, model, options }, bridge = getBridge()) {
  const ai = bridge?.ai;
  if (!ai || typeof ai.call !== 'function' || typeof ai.onStream !== 'function') {
    return Promise.resolve({
      ok: false,
      error: { type: 'NO_BRIDGE', message: 'AI needs the desktop app.' },
    });
  }
  // electron/ipc/validators.js requires both; fail here rather than on the wire.
  if (!endpointId || !model) {
    return Promise.resolve({
      ok: false,
      error: {
        type: 'NO_ENDPOINT',
        message: 'No AI endpoint is configured. Add one in Settings.',
      },
    });
  }

  const { prompt: guardedUser, truncated } = applyTokenGuard(user);
  const requestId = `llm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: guardedUser });

  return new Promise((resolve) => {
    let text = '';
    let settled = false;
    // Assigned below; a stream event can only arrive after onStream returns,
    // but the indirection keeps a synchronous emit from leaking the listener.
    let unsubscribe = () => {};
    const finish = (result) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      resolve(
        result.ok && truncated ? { ...result, warning: { type: 'TOKEN_LIMIT' } } : result
      );
    };
    unsubscribe = ai.onStream((evt) => {
      if (evt?.requestId !== requestId) return;
      if (evt.type === 'chunk') {
        text += evt.delta ?? '';
      } else if (evt.type === 'done') {
        const full = typeof evt.text === 'string' ? evt.text : text;
        finish({ ok: true, text: sanitizeResponse(full) });
      } else if (evt.type === 'error') {
        finish({ ok: false, error: toError(evt.error) });
      }
    });

    ai.call({ endpointId, model, requestId, messages, options }).catch((err) => {
      finish({ ok: false, error: { type: 'IPC_ERROR', message: String(err?.message ?? err) } });
    });
  });
}
