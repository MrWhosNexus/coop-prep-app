"use client";

// components/voice/companion/ArtifactPanel.js
//
// The companion Hub — a managed workspace that collects the artifacts the
// companion has made or pulled (images, files, tables, notes, code, charts).
// Ported from nexus/renderer/src/panels/companion/ArtifactPanel.tsx.
//
// TWO deliberate departures from the Nexus original, both forced by coop-prep
// being a static export under a strict CSP:
//   * MERMAID: no bundled mermaid dependency and no remote scripts allowed, so
//     the 'mermaid' kind renders its (normalized) source in a <pre> fallback
//     rather than pulling in a heavy dep that would throw under CSP.
//   * FILE save: routed through window.coop.dialog.saveFile (a real native save
//     dialog + main-process write) instead of a companion HTTP route. The
//     renderer still never writes to disk itself.

import { useEffect, useMemo, useState } from "react";
import { getBridge } from "@/lib/ai/client";

/** Rail badge text per kind. */
const KIND_BADGE = {
  text: "text",
  markdown: "markdown",
  code: "code",
  table: "records",
  notes: "notes",
  mermaid: "chart",
  image: "image",
  imageLoading: "generating…",
  progress: "working",
  file: "file",
};

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A short label for the rail — title first, kind as the fallback. */
function railLabel(artifact) {
  const title = artifact.title.trim();
  return title ? title : artifact.kind;
}

/**
 * @param {{
 *   items: import('@/lib/voice/companion/types.js').HubItem[],
 *   selectedId: string | null,
 *   onSelect: (id: string) => void,
 *   onRemove: (id: string) => void,
 *   onClearAll: () => void,
 * }} props
 */
export function CompanionArtifactPanel({ items, selectedId, onSelect, onRemove, onClearAll }) {
  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? items[items.length - 1] ?? null,
    [items, selectedId],
  );
  const artifact = selected?.artifact ?? null;

  return (
    <aside className="cmp-artifact-panel" aria-label="Nexus artifacts">
      <header className="cmp-artifact-header">
        <div>
          <span className="cmp-eyebrow">Hub</span>
          <h2>{artifact?.title || "Ready"}</h2>
        </div>
        {items.length > 0 ? (
          <button className="cmp-btn" onClick={onClearAll}>
            clear all
          </button>
        ) : null}
      </header>
      {items.length > 0 ? (
        <div className="cmp-hub-rail" role="listbox" aria-label="Hub items">
          {items.map((item) => (
            <HubRailItem
              key={item.id}
              item={item}
              active={item.id === selected?.id}
              onSelect={() => onSelect(item.id)}
              onRemove={() => onRemove(item.id)}
            />
          ))}
        </div>
      ) : null}
      <div className="cmp-artifact-body">
        {artifact ? renderArtifact(artifact) : <EmptyArtifact />}
      </div>
    </aside>
  );
}

function HubRailItem({ item, active, onSelect, onRemove }) {
  const { artifact } = item;
  const isThumb = artifact.kind === "image" || artifact.kind === "imageLoading";
  return (
    <div
      className={active ? "cmp-hub-item cmp-hub-item-active" : "cmp-hub-item"}
      role="option"
      aria-selected={active}
    >
      <button className="cmp-hub-item-main" onClick={onSelect} title={`${artifact.title} · ${item.at}`}>
        {artifact.kind === "image" ? (
          <img className="cmp-hub-thumb" src={resolveImageSrc(artifact.content)} alt="" />
        ) : artifact.kind === "imageLoading" ? (
          <span className="cmp-hub-thumb cmp-hub-thumb-loading" aria-hidden />
        ) : (
          <span className="cmp-hub-label">{railLabel(artifact)}</span>
        )}
        {!isThumb ? <span className="cmp-hub-kind">{KIND_BADGE[artifact.kind]}</span> : null}
      </button>
      <button
        className="cmp-hub-item-remove"
        onClick={(ev) => {
          ev.stopPropagation();
          onRemove();
        }}
        aria-label={`Remove ${artifact.title || artifact.kind}`}
        title="Remove"
      >
        ×
      </button>
    </div>
  );
}

function resolveImageSrc(content) {
  return content.startsWith("http") || content.startsWith("file://") || content.startsWith("data:")
    ? content
    : `file://${content}`;
}

function EmptyArtifact() {
  return (
    <div className="cmp-empty-artifact">
      <p>Ask Nexus to show markdown, charts, notes, records, code, images, or progress here.</p>
    </div>
  );
}

function renderArtifact(artifact) {
  if (artifact.kind === "table") {
    return <JsonTable content={artifact.content} />;
  }

  if (artifact.kind === "notes") {
    return <NotesGrid content={artifact.content} />;
  }

  if (artifact.kind === "mermaid") {
    // Strict CSP + no bundled mermaid: show the (normalized) diagram source as
    // code rather than pull in a heavy renderer that would throw under CSP.
    return (
      <div className="cmp-mermaid-stack">
        <pre className="cmp-code-artifact">
          <code>{normalizeMermaidSource(artifact.content, artifact.title)}</code>
        </pre>
      </div>
    );
  }

  if (artifact.kind === "image") {
    return <img className="cmp-artifact-image" src={resolveImageSrc(artifact.content)} alt={artifact.title} />;
  }

  if (artifact.kind === "file") {
    return <FileArtifact artifact={artifact} />;
  }

  if (artifact.kind === "imageLoading") {
    return (
      <div className="cmp-image-loading">
        <div className="cmp-image-loading-frame">
          <div className="cmp-image-loading-grid" />
          <div className="cmp-image-loading-orb" />
          <div className="cmp-image-loading-scan" />
        </div>
        <div className="cmp-image-loading-copy">
          <span>Generating image</span>
          <p>{artifact.content}</p>
        </div>
      </div>
    );
  }

  if (artifact.kind === "code") {
    return (
      <pre className="cmp-code-artifact">
        <code>{artifact.content}</code>
      </pre>
    );
  }

  if (artifact.kind === "markdown") {
    return <MarkdownArtifact content={artifact.content} />;
  }

  if (artifact.kind === "progress") {
    return (
      <div className="cmp-progress-card">
        <div className="cmp-progress-pulse" />
        <p>{artifact.content}</p>
      </div>
    );
  }

  return <pre className="cmp-text-artifact">{artifact.content}</pre>;
}

/**
 * The `file` artifact kind — a card with a save-to-disk action routed through
 * window.coop.dialog.saveFile (a native save dialog + main-process write). The
 * renderer never writes to disk itself.
 */
function FileArtifact({ artifact }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setStatus(null);
    const dialog = getBridge()?.dialog;
    if (!dialog || typeof dialog.saveFile !== "function") {
      setStatus("Saving files needs the desktop app.");
      setBusy(false);
      return;
    }
    try {
      const res = await dialog.saveFile({
        content: artifact.content,
        defaultPath: artifact.title || "file.txt",
      });
      setStatus(res?.canceled ? null : res?.filePath ? `Saved to ${res.filePath}` : "Saved.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cmp-file-card">
      <div className="cmp-file-icon" aria-hidden />
      <p className="cmp-file-name">{artifact.title || "file"}</p>
      <div className="cmp-controls" role="group" aria-label="File actions">
        <button className="cmp-btn" disabled={busy} onClick={save}>
          {busy ? "saving…" : "save to disk"}
        </button>
      </div>
      {status ? <p className="cmp-file-status">{status}</p> : null}
    </div>
  );
}

function MarkdownArtifact({ content }) {
  const [visibleContent, setVisibleContent] = useState("");

  useEffect(() => {
    // Reduced motion: no typewriter stream, show the whole document at once.
    if (reducedMotion()) {
      setVisibleContent(content);
      return;
    }
    setVisibleContent("");
    let index = 0;
    const step = Math.max(8, Math.ceil(content.length / 180));
    const timer = window.setInterval(() => {
      index = Math.min(content.length, index + step);
      setVisibleContent(content.slice(0, index));
      if (index >= content.length) window.clearInterval(timer);
    }, 14);

    return () => window.clearInterval(timer);
  }, [content]);

  return <div className="cmp-markdown-artifact">{renderMarkdown(visibleContent)}</div>;
}

function renderMarkdown(content) {
  return content.split("\n").map((line, index) => {
    if (line.startsWith("# ")) return <h1 key={index}>{renderInline(line.slice(2))}</h1>;
    if (line.startsWith("## ")) return <h2 key={index}>{renderInline(line.slice(3))}</h2>;
    if (line.startsWith("### ")) return <h3 key={index}>{renderInline(line.slice(4))}</h3>;
    if (line.startsWith("- ")) return <li key={index}>{renderInline(line.slice(2))}</li>;
    if (!line.trim()) return <div className="cmp-markdown-gap" key={index} />;
    return <p key={index}>{renderInline(line)}</p>;
  });
}

function renderInline(text) {
  const parts = [];
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <a href={match[2]} key={`${match[2]}-${match.index}`} target="_blank" rel="noreferrer">
        {match[1]}
      </a>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : text;
}

function NotesGrid({ content }) {
  const notes = parseNotes(content);
  if (notes.length === 0) return <pre className="cmp-text-artifact">{content}</pre>;

  return (
    <div className="cmp-notes-grid">
      {notes.map((note, index) => (
        <article className="cmp-note-card" key={note.id || index}>
          <p>{note.text || "Untitled note"}</p>
          <footer>
            <span>{formatDate(note.createdAt)}</span>
            {note.tags && note.tags.length > 0 ? (
              <small>{note.tags.map((tag) => `#${tag}`).join(" ")}</small>
            ) : null}
          </footer>
        </article>
      ))}
    </div>
  );
}

function parseNotes(content) {
  try {
    const value = JSON.parse(content);
    if (!Array.isArray(value)) return [];
    return value.filter((note) => note !== null && typeof note === "object");
  } catch {
    return [];
  }
}

function formatDate(value) {
  if (!value) return "just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function normalizeMermaidSource(content, title) {
  const stripped = content
    .replace(/```mermaid/gi, "")
    .replace(/```/g, "")
    .replace(/\r/g, "")
    .trim();

  if (!stripped) return `flowchart TD\n  A["${(title || "Chart").replace(/["<>]/g, "")}"]`;

  const lines = stripped
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-"));

  const first = lines[0] || "";
  const hasHeader =
    /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline)\b/i.test(
      first,
    );
  return hasHeader ? lines.join("\n") : `flowchart TD\n${lines.join("\n")}`;
}

function JsonTable({ content }) {
  const parsed = parseRows(content);
  if (!parsed) return <pre className="cmp-text-artifact">{content}</pre>;

  const rows = Array.isArray(parsed) ? parsed : [parsed];
  const keys = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set()),
  );

  if (rows.length === 0 || keys.length === 0) {
    return <pre className="cmp-text-artifact">{content}</pre>;
  }

  return (
    <div className="cmp-table-wrap">
      <table>
        <thead>
          <tr>
            {keys.map((key) => (
              <th key={key}>{key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.id || index}`}>
              {keys.map((key) => (
                <td key={key}>{formatCell(row[key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function parseRows(content) {
  try {
    const value = JSON.parse(content);
    if (Array.isArray(value) && value.every((row) => row && typeof row === "object" && !Array.isArray(row))) {
      return value;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value;
    }
    return null;
  } catch {
    return null;
  }
}

function formatCell(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
