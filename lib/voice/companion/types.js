// lib/voice/companion/types.js
//
// Companion shared types + pure helpers, ported from
// nexus/renderer/src/panels/companion/types.ts (TypeScript stripped to JSDoc).
//
// The face and the Hub drive purely off these shapes; the voice provider plugs
// in behind VoiceProvider.js without touching them. addHubItem is carried
// VERBATIM — the imageLoading-collapse logic keeps a generating placeholder's
// id when the finished image lands, so the user's selection survives.

/**
 * Mood state machine the face animates.
 * @typedef {'idle'|'listening'|'thinking'|'speaking'|'working'|'error'} CompanionMood
 */

/** @type {CompanionMood[]} */
export const COMPANION_MOODS = ["idle", "listening", "thinking", "speaking", "working", "error"];

/**
 * Lip-sync frame — normalized 0..1 channels derived from output audio energy
 * (WebAudio analyser). Inert until voice lands.
 * @typedef {{ open: number, width: number, round: number, teeth: number }} MouthShape
 */

/** @type {MouthShape} */
export const MOUTH_REST = { open: 0, width: 0.18, round: 0, teeth: 0 };

/**
 * @typedef {'text'|'markdown'|'code'|'table'|'notes'|'mermaid'|'image'|'imageLoading'|'progress'|'file'} NexusArtifactKind
 */

/**
 * @typedef {Object} NexusArtifact
 * @property {NexusArtifactKind} kind
 * @property {string} title
 * @property {string} content Payload — plain text, markdown, code, a JSON
 *   string (table/notes), mermaid source, an image src (data:/file:/http), or
 *   — for `file` — a path/file:// URI or a data: URI. `title` is the display
 *   filename for the `file` kind.
 * @property {boolean} [fullscreen]
 */

/**
 * One entry in the companion Hub — a managed collection of the artifacts the
 * companion has made or pulled. `id` keys selection/removal; `at` is a display
 * timestamp.
 * @typedef {Object} HubItem
 * @property {string} id
 * @property {NexusArtifact} artifact
 * @property {string} at
 */

/**
 * @param {NexusArtifact} artifact
 * @returns {HubItem}
 */
export function newHubItem(artifact) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    artifact,
    at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

/**
 * Accumulate an artifact into the Hub collection (pure — returns a new array).
 *
 * An arriving `image` collapses a trailing `imageLoading` placeholder in place,
 * keeping its id: that placeholder and the finished image are the SAME
 * generation, so replacing it leaves the user's selection intact and avoids a
 * dead spinner sitting beside the result. Every other artifact appends.
 *
 * @param {HubItem[]} items
 * @param {NexusArtifact} artifact
 * @returns {HubItem[]}
 */
export function addHubItem(items, artifact) {
  const last = items[items.length - 1];
  if (artifact.kind === "image" && last && last.artifact.kind === "imageLoading") {
    return [...items.slice(0, -1), { ...last, artifact }];
  }
  return [...items, newHubItem(artifact)];
}

/**
 * One line in the conversation transcript. 'hermes' is NOT decoration: a spoken
 * turn answered by the local CLI must not be credited to the endpoint voice.
 * The panel renders this role string directly.
 * @typedef {{ id: string, role: 'user'|'nexus'|'system'|'tool'|'hermes', text: string, at: string }} TranscriptEntry
 */

/**
 * @param {TranscriptEntry['role']} role
 * @param {string} text
 * @returns {TranscriptEntry}
 */
export function newEntry(role, text) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

/**
 * Result shape a companion tool would return — mirrors the `{ ok, artifact }`
 * contract the Hub understands. The ported companion has NO tool loop
 * (onToolCall is a no-op), so this only survives as a shape for the seam.
 * @typedef {{ ok: boolean, artifact?: NexusArtifact, output?: string, error?: string }} ToolResult
 */
