// electron/companion/hub-store.js
//
// Companion Hub persistence. Ported from
// nexus/electron/main/companion-tools/hub-store.ts, translated to plain-JS ESM
// and turned into a `createHubStore({ userDataDir })` factory so this module
// stays Electron-free and testable under plain `node --test` (the caller in
// electron/main.js#buildIpcDeps passes app.getPath('userData')).
//
// The Hub doc lives at <userDataDir>/companion-hub/hub.json — a SEPARATE file
// from store.json (notes/progress), never mixed in. Generated images are
// written out as real files under <hubDir>/images/ and the doc keeps a file://
// ref, re-inlined to a data: URI on load so it displays under the renderer's
// `img-src 'self' data:` CSP (a file:// URL does not satisfy 'self' for a
// file:// document).

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_URI_RE = /^data:([^;,]+);base64,(.*)$/s;

const IMG_MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * The inverse allowlist: only these MIME types are ever written out as real
 * files. Deriving the extension from arbitrary renderer-supplied MIME text
 * (`mime.split("/")[1]`) let a crafted `data:a/bat;base64,…` choose the
 * extension of the file landing on disk.
 */
const MIME_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Hub item ids come from the renderer, which `electron/ipc/validators.js`
 * treats as untrusted. Using one directly as a filename let `..` segments
 * escape the images dir and write attacker-controlled bytes anywhere the main
 * process could reach. Hashing yields a fixed-charset basename that cannot
 * traverse, while staying deterministic so re-saving an item overwrites its
 * own file instead of accumulating orphans.
 */
function safeImageBasename(id) {
  return crypto.createHash("sha256").update(String(id)).digest("hex").slice(0, 32);
}

/** True when `candidate` resolves to a path strictly inside `parentDir`. */
function isInside(parentDir, candidate) {
  const rel = path.relative(parentDir, candidate);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * A persisted Hub item, structurally mirroring the renderer's HubItem/
 * NexusArtifact (types.ts). Kept compatible rather than imported so this
 * main-process module never reaches into the renderer.
 *
 * @typedef {{ id: string, at: string, artifact: { kind: string, title: string, content: string, fullscreen?: boolean } }} PersistedHubItem
 */

/** Structural guard mirroring the renderer's HubItem shape. */
export function isHubItem(v) {
  if (!v || typeof v !== "object") return false;
  const item = v;
  return (
    typeof item.id === "string" &&
    typeof item.at === "string" &&
    !!item.artifact &&
    typeof item.artifact === "object" &&
    typeof item.artifact.kind === "string" &&
    typeof item.artifact.title === "string" &&
    typeof item.artifact.content === "string"
  );
}

/**
 * Create a Hub store rooted at `userDataDir`.
 *
 * @param {object} opts
 * @param {string} opts.userDataDir - app.getPath('userData') in production.
 */
export function createHubStore({ userDataDir }) {
  if (!userDataDir || typeof userDataDir !== "string") {
    throw new Error("createHubStore requires a userDataDir string");
  }
  const hubDir = path.join(userDataDir, "companion-hub");
  const hubFilePath = path.join(hubDir, "hub.json");
  const hubImagesDir = path.join(hubDir, "images");

  /**
   * A generated image arrives as an inline `data:` URI. Storing that base64
   * blob inside hub.json on every save would grow the doc without bound, so it
   * is written out as a real file under <hubDir>/images/ and the doc keeps a
   * `file://` path instead. Anything that is not a decodable image `data:` URI
   * passes through unchanged.
   */
  async function inlineImageToFile(id, content) {
    const match = DATA_URI_RE.exec(content);
    if (!match) return content;
    const ext = MIME_EXT[match[1].trim().toLowerCase()];
    // Not an image type we persist as a file — keep it inline rather than
    // letting the renderer pick the on-disk extension.
    if (!ext) return content;
    let buf;
    try {
      buf = Buffer.from(match[2], "base64");
    } catch {
      return content;
    }
    if (buf.length === 0) return content;
    await fs.mkdir(hubImagesDir, { recursive: true });
    const filePath = path.join(hubImagesDir, `${safeImageBasename(id)}.${ext}`);
    await fs.writeFile(filePath, buf);
    return `file://${filePath}`;
  }

  /**
   * Turn a persisted `file://` image path back into a `data:` URI for display.
   * A missing file leaves the ref untouched so the panel shows a broken image
   * honestly rather than silently swallowing it.
   */
  async function fileToDataUri(content) {
    if (!content.startsWith("file://")) return content;
    const filePath = path.resolve(content.slice("file://".length));
    // hub.json is written by an untrusted renderer, so a persisted `file://`
    // ref is an attacker-chosen path until proven otherwise. Without these two
    // guards, save()->load() round-tripped any absolute path into a base64
    // blob handed back to the renderer — including the endpoint key store.
    if (!isInside(hubImagesDir, filePath)) return content;
    const mime = IMG_MIME[path.extname(filePath).toLowerCase()];
    if (!mime) return content;
    try {
      const buf = await fs.readFile(filePath);
      return `data:${mime};base64,${buf.toString("base64")}`;
    } catch {
      return content;
    }
  }

  /**
   * Load the persisted Hub, oldest-first (the render order the list expects).
   * Persisted images are re-inlined to `data:` URIs so they display under the
   * renderer CSP. Any read/parse failure — missing file, corrupt JSON — returns
   * an empty Hub rather than throwing, so a broken doc never blocks the
   * companion from opening.
   *
   * @returns {Promise<{ ok: true, items: PersistedHubItem[] }>}
   */
  async function load() {
    try {
      const raw = await fs.readFile(hubFilePath, "utf8");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return { ok: true, items: [] };
      const items = parsed.filter(isHubItem);
      const inlined = await Promise.all(
        items.map(async (it) =>
          it.artifact.kind === "image" && it.artifact.content.startsWith("file://")
            ? { ...it, artifact: { ...it.artifact, content: await fileToDataUri(it.artifact.content) } }
            : it
        )
      );
      return { ok: true, items: inlined };
    } catch {
      return { ok: true, items: [] };
    }
  }

  /**
   * Persist the Hub. `imageLoading` placeholders are dropped: a "Generating
   * image…" card that never got its result is stale on the next boot, not
   * useful state to restore. Every other item is kept, with generated images
   * inlined to disk per inlineImageToFile.
   *
   * @param {PersistedHubItem[]} items
   * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
   */
  async function writeHub(items) {
    try {
      await fs.mkdir(hubDir, { recursive: true });
      const out = [];
      for (const item of items) {
        if (item.artifact.kind === "imageLoading") continue;
        if (item.artifact.kind === "image") {
          const content = await inlineImageToFile(item.id, item.artifact.content);
          out.push({ ...item, artifact: { ...item.artifact, content } });
        } else {
          out.push(item);
        }
      }
      const dir = path.dirname(hubFilePath);
      // Unique per call: `Date.now()` alone collides when two saves land in the
      // same millisecond, so concurrent writers could target the same temp path
      // (one clobbering the other, or a rename ENOENT'ing because the sibling
      // already moved it). randomUUID makes the temp name collision-proof.
      const tmpPath = path.join(dir, `.hub.json.${process.pid}.${crypto.randomUUID()}.tmp`);
      await fs.writeFile(tmpPath, JSON.stringify(out), "utf8");
      await fs.rename(tmpPath, hubFilePath);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) };
    }
  }

  // Serialize saves. CompanionWidget fires hub:save on every state change with no
  // debounce, so rapid edits (add then delete a card) overlap. Concurrent saves
  // could reorder their renames — republishing an OLDER Hub snapshot so a deleted
  // card resurrects — and could interleave writes to the same deterministic image
  // file (safeImageBasename is per-id), corrupting it. Chaining each save behind
  // the previous makes writes strictly ordered and non-overlapping.
  let saveChain = Promise.resolve();
  function save(items) {
    const run = saveChain.then(() => writeHub(items));
    // Keep the chain flowing even if one save rejects; the caller still gets the
    // real result (writeHub itself never rejects — it returns { ok: false }).
    saveChain = run.then(undefined, () => {});
    return run;
  }

  return { load, save, hubFilePath, hubImagesDir };
}
