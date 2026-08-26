// CSV parse/serialize (RFC 4180 semantics: quoted fields, "" escapes,
// embedded commas and newlines, CRLF line endings). Pure, no dependencies.

/**
 * Parse CSV text into a 2D array of strings.
 * @param {string} text
 * @returns {Array<Array<string>>}
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let sawAny = false;
  const src = String(text);
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === "\"") {
        if (src[i + 1] === "\"") { field += "\""; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === "\"" && field === "") { inQuotes = true; sawAny = true; continue; }
    if (ch === ",") { row.push(field); field = ""; sawAny = true; continue; }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      if (sawAny || field !== "" || row.length > 0) {
        row.push(field);
        rows.push(row);
      }
      row = [];
      field = "";
      sawAny = false;
      continue;
    }
    field += ch;
    sawAny = true;
  }
  if (sawAny || field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Serialize a 2D array to CSV text. Values are stringified; fields containing
 * commas, quotes, or newlines are quoted with "" escapes. Newline is "\n".
 * @param {Array<Array<*>>} rows
 * @returns {string}
 */
export function serializeCsv(rows) {
  return rows
    .map((row) => row.map(serializeField).join(","))
    .join("\n");
}

function serializeField(v) {
  if (v === undefined || v === null) return "";
  const s = typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v);
  if (/[",\n\r]/.test(s)) {
    return "\"" + s.replace(/"/g, "\"\"") + "\"";
  }
  return s;
}

/**
 * Infer a typed value from a raw CSV field: numbers become numbers,
 * TRUE/FALSE become booleans, everything else stays text. Codes with leading
 * zeros ("02138") are kept as text so zip codes survive import — the classic
 * Excel gotcha, handled correctly here.
 * @param {string} raw
 * @returns {number|boolean|string|undefined} undefined for empty fields
 */
export function inferValue(raw) {
  if (raw === "" || raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  if (s === "") return raw;
  if (s === "TRUE") return true;
  if (s === "FALSE") return false;
  if (/^0\d/.test(s) || /^[+-]?0\d/.test(s)) return raw; // leading-zero code
  const n = Number(s);
  if (Number.isFinite(n) && /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) {
    return n;
  }
  return raw;
}
