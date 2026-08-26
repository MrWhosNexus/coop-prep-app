// electron/ipc/validators.js
// Pure argument validation + view-shaping for every IPC channel. No Electron
// import — the renderer is untrusted, so every argument that crosses the
// contextBridge is checked here *before* handlers.js touches fs, the network,
// or the endpoint registry. Testable under plain `node --test`.

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function fail(field, expected) {
  throw new ValidationError(`${field} must be ${expected}`);
}

/**
 * store:write — the renderer's lib/store/ talks in whole serialized-document
 * strings (see lib/store/backends.js: `write(text: string): Promise<void>`),
 * not key/value pairs. This channel is a pass-through to that contract, kept
 * here so main never trusts an unvalidated type off the wire.
 */
export function validateStoreWrite(text) {
  if (typeof text !== "string") fail("value", "a string (the serialized store document)");
  return text;
}

/**
 * Shared shape for endpoints:add input and the `patch` half of
 * endpoints:update. Field names mirror lib/endpoints/registry.js's
 * StoredEndpoint input: label, baseUrl, apiKey, optionally providerId. There
 * is no `model` or `headers` on a stored endpoint — model is chosen per-call
 * (discovered via endpoints:models) and headers are derived from the
 * provider, not user-supplied.
 */
function validateEndpointFields(input, { requireCore }) {
  if (!isPlainObject(input)) fail("input", "an object");
  const out = {};

  if (requireCore || "label" in input) {
    if (!isNonEmptyString(input.label)) fail("label", "a non-empty string");
    out.label = input.label.trim();
  }
  if (requireCore || "baseUrl" in input) {
    if (!isNonEmptyString(input.baseUrl)) fail("baseUrl", "a non-empty string");
    try {
      new URL(input.baseUrl);
    } catch {
      fail("baseUrl", "a valid URL");
    }
    out.baseUrl = input.baseUrl.trim();
  }
  if ("apiKey" in input) {
    if (typeof input.apiKey !== "string") fail("apiKey", "a string");
    out.apiKey = input.apiKey;
  } else if (requireCore) {
    out.apiKey = "";
  }
  if ("providerId" in input) {
    if (typeof input.providerId !== "string") fail("providerId", "a string");
    out.providerId = input.providerId;
  }
  return out;
}

/** endpoints:add — { label, baseUrl, apiKey? } */
export function validateEndpointInput(args) {
  return validateEndpointFields(args, { requireCore: true });
}

/** endpoints:update — { id, patch: <partial endpoint fields> } */
export function validateEndpointUpdate(args) {
  if (!isPlainObject(args)) fail("args", "an object");
  if (!isNonEmptyString(args.id)) fail("id", "a non-empty string");
  if (!isPlainObject(args.patch)) fail("patch", "an object");
  return { id: args.id, patch: validateEndpointFields(args.patch, { requireCore: false }) };
}

/** endpoints:delete / endpoints:test / endpoints:models — { id: string } */
export function validateEndpointId(args) {
  if (!isPlainObject(args)) fail("args", "an object");
  if (!isNonEmptyString(args.id)) fail("id", "a non-empty string");
  return { id: args.id };
}

/**
 * Strip everything secret off an endpoint record before it ever reaches the
 * renderer. Mirrors lib/endpoints/registry.js's `toView` exactly (same field
 * names: hasKey, not hasApiKey) so that swapping the default in-memory
 * endpoints stub for the real registry is a drop-in replacement with no
 * reshaping at the IPC boundary. Defense in depth: this is a *second* place
 * the key gets stripped, in case a handler is ever wired to something that
 * returns a raw StoredEndpoint instead of an already-viewed one.
 */
export function toEndpointView(endpoint) {
  if (!isPlainObject(endpoint)) return null;
  return {
    id: endpoint.id,
    label: endpoint.label,
    providerId: endpoint.providerId,
    baseUrl: endpoint.baseUrl,
    hasKey: isNonEmptyString(endpoint.apiKey),
    createdAt: endpoint.createdAt,
    updatedAt: endpoint.updatedAt,
  };
}

const ROLES = new Set(["system", "user", "assistant"]);

/**
 * ai:call — { endpointId, model, messages, requestId, options? }
 * `model` is required: lib/endpoints/call.js#callEndpoint never falls back to
 * a preset default — the renderer must have discovered it via
 * endpoints:models first and passed it explicitly.
 */
export function validateAiCallInput(args) {
  if (!isPlainObject(args)) fail("args", "an object");
  if (!isNonEmptyString(args.endpointId)) fail("endpointId", "a non-empty string");
  if (!isNonEmptyString(args.model)) fail("model", "a non-empty string");
  if (!isNonEmptyString(args.requestId)) fail("requestId", "a non-empty string");
  if (!Array.isArray(args.messages) || args.messages.length === 0) {
    fail("messages", "a non-empty array");
  }
  const messages = args.messages.map((m, i) => {
    if (!isPlainObject(m)) fail(`messages[${i}]`, "an object");
    if (!ROLES.has(m.role)) fail(`messages[${i}].role`, "system|user|assistant");
    if (typeof m.content !== "string") fail(`messages[${i}].content`, "a string");
    return { role: m.role, content: m.content };
  });
  const options = isPlainObject(args.options) ? { ...args.options } : {};
  return { endpointId: args.endpointId, model: args.model, requestId: args.requestId, messages, options };
}

/** ai:cancel — { requestId } */
export function validateAiCancel(args) {
  if (!isPlainObject(args)) fail("args", "an object");
  if (!isNonEmptyString(args.requestId)) fail("requestId", "a non-empty string");
  return { requestId: args.requestId };
}

const MAX_TRANSCRIBE_BYTES = 16 * 1024 * 1024; // 16MB guard on a WAV upload
const MAX_SPEAK_CHARS = 4000; // matches the Nexus utterance cap

/**
 * voice:transcribe — the WHOLE argument is the WAV upload (window.coop.voice
 * .transcribe(arrayBuffer) → invoke("voice:transcribe", arrayBuffer)), not an
 * options object. Accept an ArrayBuffer or a TypedArray view of one and hand
 * back a Buffer for stt-local's decodeWav16kMono. The strict RIFF checks
 * (16 kHz / mono / 16-bit) live in the decoder, not here.
 */
export function validateVoiceTranscribe(args) {
  let buf;
  if (args instanceof ArrayBuffer) {
    buf = Buffer.from(args);
  } else if (ArrayBuffer.isView(args)) {
    buf = Buffer.from(args.buffer, args.byteOffset, args.byteLength);
  } else {
    fail("audio", "an ArrayBuffer (a WAV upload)");
  }
  if (buf.length === 0) fail("audio", "a non-empty ArrayBuffer");
  if (buf.length > MAX_TRANSCRIBE_BYTES) fail("audio", `under ${MAX_TRANSCRIBE_BYTES} bytes`);
  return { audio: buf };
}

/**
 * voice:speak — { text }. main generates the requestId (unlike ai:call, where
 * the renderer supplies it), so this only validates and trims the utterance.
 */
export function validateVoiceSpeak(args) {
  if (!isPlainObject(args)) fail("args", "an object");
  if (!isNonEmptyString(args.text)) fail("text", "a non-empty string");
  return { text: args.text.trim().slice(0, MAX_SPEAK_CHARS) };
}

/**
 * voice:cancel — { requestId? }. requestId is OPTIONAL: window.coop.voice
 * .cancel() with no id aborts every in-flight utterance (the engine calls it
 * with `activeRequestId ?? undefined`).
 */
export function validateVoiceCancel(args) {
  if (!isPlainObject(args)) fail("args", "an object");
  if (args.requestId !== undefined && !isNonEmptyString(args.requestId)) {
    fail("requestId", "a non-empty string or omitted");
  }
  return { requestId: args.requestId };
}

const MAX_HERMES_PROMPT_CHARS = 8000; // a generous single-turn cap; the child is a shell surface, keep it bounded

/**
 * hermes:run — { prompt, requestId }. The prompt is the PTT-transcribed
 * utterance destined for `hermes -z <prompt>` (a real shell / RCE surface), so
 * it is bounded and required to be a non-empty string. requestId keys the
 * in-flight AbortController and the "hermes:stream" push events.
 */
export function validateHermesRun(args) {
  if (!isPlainObject(args)) fail("args", "an object");
  if (!isNonEmptyString(args.prompt)) fail("prompt", "a non-empty string");
  if (args.prompt.length > MAX_HERMES_PROMPT_CHARS) {
    fail("prompt", `under ${MAX_HERMES_PROMPT_CHARS} characters`);
  }
  if (!isNonEmptyString(args.requestId)) fail("requestId", "a non-empty string");
  return { prompt: args.prompt, requestId: args.requestId };
}

/** hermes:cancel — { requestId }. Always required (unlike voice:cancel, there
 *  is no abort-all: a hermes run is a spawned shell, aborted by its own id). */
export function validateHermesCancel(args) {
  if (!isPlainObject(args)) fail("args", "an object");
  if (!isNonEmptyString(args.requestId)) fail("requestId", "a non-empty string");
  return { requestId: args.requestId };
}

const MAX_HUB_ITEMS = 1000; // a companion Hub past this is a bug, not a session

/**
 * hub:save — { items: HubItem[] }. Mirrors electron/companion/hub-store.js's
 * isHubItem shape: each item needs string id/at and an artifact with string
 * kind/title/content (fullscreen is optional/ignored here). Returns the
 * validated array; anything malformed rejects before touching disk.
 */
export function validateHubSave(args) {
  if (!isPlainObject(args)) fail("args", "an object");
  if (!Array.isArray(args.items)) fail("items", "an array");
  if (args.items.length > MAX_HUB_ITEMS) fail("items", `at most ${MAX_HUB_ITEMS} entries`);
  const items = args.items.map((it, i) => {
    if (!isPlainObject(it)) fail(`items[${i}]`, "an object");
    if (typeof it.id !== "string") fail(`items[${i}].id`, "a string");
    if (typeof it.at !== "string") fail(`items[${i}].at`, "a string");
    if (!isPlainObject(it.artifact)) fail(`items[${i}].artifact`, "an object");
    const a = it.artifact;
    if (typeof a.kind !== "string") fail(`items[${i}].artifact.kind`, "a string");
    if (typeof a.title !== "string") fail(`items[${i}].artifact.title`, "a string");
    if (typeof a.content !== "string") fail(`items[${i}].artifact.content`, "a string");
    const artifact = { kind: a.kind, title: a.title, content: a.content };
    if (a.fullscreen !== undefined) {
      if (typeof a.fullscreen !== "boolean") fail(`items[${i}].artifact.fullscreen`, "a boolean");
      artifact.fullscreen = a.fullscreen;
    }
    return { id: it.id, at: it.at, artifact };
  });
  return { items };
}

const ALLOWED_FILTER_EXT = /^[a-zA-Z0-9*.]+$/;

function validateFilters(filters) {
  if (filters === undefined) return undefined;
  if (!Array.isArray(filters)) fail("filters", "an array");
  return filters.map((f, i) => {
    if (!isPlainObject(f) || !isNonEmptyString(f.name) || !Array.isArray(f.extensions)) {
      fail(`filters[${i}]`, "{ name: string, extensions: string[] }");
    }
    const extensions = f.extensions.map((e, j) => {
      if (typeof e !== "string" || !ALLOWED_FILTER_EXT.test(e)) {
        fail(`filters[${i}].extensions[${j}]`, "a bare extension like \"csv\" or \"*\"");
      }
      return e;
    });
    return { name: f.name, extensions };
  });
}

/** dialog:openFile — { filters?, multiple? } */
export function validateOpenDialogOptions(args = {}) {
  if (args !== undefined && !isPlainObject(args)) fail("args", "an object");
  const filters = validateFilters(args?.filters);
  const multiple = args?.multiple === true;
  return { filters, multiple };
}

const MAX_SAVE_CONTENT_BYTES = 50 * 1024 * 1024; // 50MB guard against renderer mistakes

/** dialog:saveFile — { content: string, defaultPath?, filters? } */
export function validateSaveDialogOptions(args) {
  if (!isPlainObject(args)) fail("args", "an object");
  if (typeof args.content !== "string") fail("content", "a string");
  if (Buffer.byteLength(args.content, "utf-8") > MAX_SAVE_CONTENT_BYTES) {
    fail("content", `under ${MAX_SAVE_CONTENT_BYTES} bytes`);
  }
  if (args.defaultPath !== undefined && typeof args.defaultPath !== "string") {
    fail("defaultPath", "a string");
  }
  const filters = validateFilters(args.filters);
  return { content: args.content, defaultPath: args.defaultPath, filters };
}
