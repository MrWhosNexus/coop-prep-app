// sanitize.js — Pure function. No imports. No side effects. No DOM APIs.
// ES module. Runs safely under `node --test`.

// sanitizeResponse('<script>alert(1)</script>hello') === 'hello'
// sanitizeResponse(null) === ''
// sanitizeResponse(undefined) === ''
// sanitizeResponse('') === ''
// sanitizeResponse('keep ```json\n{"x":1}\n```') contains '```json'
// sanitizeResponse('x ```js\nevil()\n``` y') === 'x [code block removed] y'
// sanitizeResponse('click <a onclick="bad()">here</a>') strips the onclick attribute
// sanitizeResponse('img src="data:image/png;base64,abc123"') strips the data URI

/**
 * Sanitize a raw LLM response string before rendering.
 *
 * @param {string|null|undefined} raw
 * @returns {string}
 */
export function sanitizeResponse(raw) {
  // Handle null / undefined / empty input
  if (raw == null || raw === '') return '';
  if (typeof raw !== 'string') raw = String(raw);

  // ── 1. Strip <script>…</script> blocks (multi-line, case-insensitive).
  //       Also neutralize an unterminated <script> tag to end-of-string.
  // sanitizeResponse('<SCRIPT>alert(1)</SCRIPT>hi') === 'hi'
  raw = raw.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
  // Unterminated <script …> — remove from the tag to end of string
  raw = raw.replace(/<script\b[^>]*>[\s\S]*/gi, '');

  // ── 2. Strip executable markdown code fences.
  //       Language tags that are executable: js, javascript, python, bash, sh,
  //       node, ts, tsx, jsx (case-insensitive).
  //       Kept intact: plain ```, ```text, ```json (display-safe).
  //       Replacement: literal "[code block removed]".
  // sanitizeResponse('```js\nconsole.log(1)\n```') === '[code block removed]'
  const EXEC_LANGS = /^(javascript|js|python|bash|sh|node|ts|tsx|jsx)$/i;

  raw = raw.replace(
    // Match opening fence (``` + language tag) anywhere, then fence body,
    // then a closing fence on its own line. Match ends after the closing backticks
    // so any trailing text on that line (e.g. " y") is NOT consumed.
    /(`{3,})[ \t]*(\S+)[^\n]*\n[\s\S]*?\n[ \t]*\1/g,
    (match, fence, lang) => {
      return EXEC_LANGS.test(lang.trim()) ? '[code block removed]' : match;
    }
  );

  // ── 3. Strip HTML event attributes: on\w+="..." or on\w+='...'
  // sanitizeResponse('<div onclick="bad()">x</div>') strips onclick="bad()"
  raw = raw.replace(/\bon\w+\s*=\s*"[^"]*"/gi, '');
  raw = raw.replace(/\bon\w+\s*=\s*'[^']*'/gi, '');

  // ── 4. Strip control characters: code < 32 EXCEPT \t (9), \n (10), \r (13)
  // sanitizeResponse('a\x01b') === 'ab'
  raw = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // ── 5. Strip data: URIs — data:[^;]+;base64,[^\s]+
  // sanitizeResponse('src="data:image/png;base64,abc=="') strips the URI value
  raw = raw.replace(/data:[^;]+;base64,[^\s"'>]*/gi, '');

  return raw;
}
