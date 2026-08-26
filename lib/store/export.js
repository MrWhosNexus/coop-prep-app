// lib/store/export.js
// Export/import the whole document as a single JSON file -- a manual
// backup, and the way a user moves their data between machines/installs.

import { CURRENT_SCHEMA_VERSION } from "./schema.js";
import { migrateDocument } from "./migrate.js";

/**
 * exportDocument(doc) -> pretty-printed JSON string
 * Wraps the document with light provenance metadata (when it was
 * exported, what schema version it's at) so a backup file is
 * self-describing on its own, without needing the app to interpret it.
 */
export function exportDocument(doc) {
  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    document: doc,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * importDocument(json) -> document at CURRENT_SCHEMA_VERSION
 *
 * Accepts either the wrapped { exportedAt, schemaVersion, document }
 * envelope produced by exportDocument(), or a bare document (for
 * hand-edited files, or documents written before export wrapping
 * existed). Always runs the result through migrateDocument(), so an
 * import either lands at CURRENT_SCHEMA_VERSION or throws loudly --
 * it never silently loads a future or malformed shape.
 */
export function importDocument(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(`Import failed: not valid JSON (${err.message})`);
  }
  const isEnvelope = parsed && typeof parsed === "object" && parsed.document && typeof parsed.document === "object";
  const candidate = isEnvelope ? parsed.document : parsed;
  return migrateDocument(candidate);
}
