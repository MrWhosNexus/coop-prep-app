"use client";

// components/notes/NoteTaker.js
// Quick-capture note taker: per-lesson notes, markdown-ish rendering, tags,
// and full-text search. All persistence goes through the same
// (state, dispatch) contract the other tools use — the notes live in the
// store document's `notes` slice (lib/store/schema.js).

import { useMemo, useState } from "react";
import {
  allTags,
  createNote,
  deleteNote,
  listNotes,
  searchNotes,
  updateNote,
} from "@/lib/ai/notes";
import { MODULES } from "@/data/curriculum";
import "./notes.css";

/** Flattened lesson list for the picker: [{ id, label }]. */
function lessonOptions() {
  const out = [];
  for (const mod of MODULES) {
    for (const lesson of mod.lessons) {
      out.push({ id: lesson.id, label: `${mod.title} — ${lesson.title}` });
    }
  }
  return out;
}

/**
 * Render a markdown-ish body safely as React nodes (no innerHTML).
 * Supports: "- " bullet lines, **bold**, *italic*, `code`.
 */
function renderMarkdownish(body) {
  const lines = String(body ?? "").split("\n");
  const blocks = [];
  let bullets = [];

  const flushBullets = (key) => {
    if (!bullets.length) return;
    blocks.push(<ul key={`ul-${key}`}>{bullets}</ul>);
    bullets = [];
  };

  lines.forEach((line, i) => {
    if (line.startsWith("- ")) {
      bullets.push(<li key={`li-${i}`}>{renderInline(line.slice(2))}</li>);
      return;
    }
    flushBullets(i);
    if (line.trim()) blocks.push(<div key={`p-${i}`}>{renderInline(line)}</div>);
  });
  flushBullets("end");
  return blocks;
}

function renderInline(text) {
  // Split on **bold**, *italic*, `code` — everything else is plain text.
  const parts = String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function parseTagInput(raw) {
  return String(raw ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function NoteTaker({ state, dispatch, lessonId = null }) {
  const [body, setBody] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [noteLessonId, setNoteLessonId] = useState(lessonId ?? "");
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState("");

  const notes = useMemo(() => state?.notes ?? {}, [state?.notes]);
  const lessons = useMemo(() => lessonOptions(), []);
  const tags = useMemo(() => allTags(notes), [notes]);

  const visible = useMemo(() => {
    if (query.trim()) return searchNotes(notes, query).map((r) => r.note);
    return listNotes(notes, tagFilter ? { tag: tagFilter } : {});
  }, [notes, query, tagFilter]);

  function handleCapture() {
    const trimmed = body.trim();
    if (!trimmed) return;
    dispatch((doc) => {
      const { notes: next } = createNote(doc.notes ?? {}, {
        lessonId: noteLessonId || null,
        body: trimmed,
        tags: parseTagInput(tagInput),
      });
      return { ...doc, notes: next };
    });
    setBody("");
    setTagInput("");
  }

  function handleDelete(id) {
    dispatch((doc) => ({ ...doc, notes: deleteNote(doc.notes ?? {}, id) }));
    if (editingId === id) setEditingId(null);
  }

  function startEdit(note) {
    setEditingId(note.id);
    setEditBody(note.body);
  }

  function handleSaveEdit(id) {
    const trimmed = editBody.trim();
    if (!trimmed) return;
    dispatch((doc) => ({ ...doc, notes: updateNote(doc.notes ?? {}, id, { body: trimmed }) }));
    setEditingId(null);
  }

  function lessonLabel(id) {
    return lessons.find((l) => l.id === id)?.label ?? id;
  }

  return (
    <div className="coopNotes-panel">
      {/* ── quick capture ── */}
      <div className="coopNotes-capture">
        <label className="coopNotes-label" htmlFor="coopNotes-body">
          Quick capture
        </label>
        <textarea
          id="coopNotes-body"
          className="coopNotes-input coopNotes-textarea"
          placeholder={"What did you just learn? Markdown-ish: **bold**, *italic*, `code`, - bullets"}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleCapture();
          }}
        />
        <div className="coopNotes-captureRow">
          <select
            className="coopNotes-input"
            aria-label="Link to lesson"
            value={noteLessonId}
            onChange={(e) => setNoteLessonId(e.target.value)}
          >
            <option value="">No lesson (general note)</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <input
            className="coopNotes-input"
            aria-label="Tags"
            placeholder="tags, comma, separated"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
          />
          <button
            type="button"
            className="coopNotes-btn coopNotes-btnPrimary"
            onClick={handleCapture}
            disabled={!body.trim()}
          >
            Save note
          </button>
        </div>
      </div>

      {/* ── search + filter ── */}
      <div className="coopNotes-captureRow">
        <input
          className="coopNotes-input"
          aria-label="Search notes"
          placeholder="Search notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="coopNotes-input"
          aria-label="Filter by tag"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
        >
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* ── notes list ── */}
      <div className="coopNotes-list">
        {visible.length === 0 && (
          <div className="coopNotes-empty">
            {query.trim() ? "No notes match that search." : "No notes yet — capture your first one above."}
          </div>
        )}
        {visible.map((note) => (
          <div key={note.id} className="coopNotes-card">
            <div className="coopNotes-cardMeta">
              {note.lessonId ? <span>{lessonLabel(note.lessonId)}</span> : <span>General</span>}
              <span>·</span>
              <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
              {(note.tags ?? []).map((t) => (
                <span key={t} className="coopNotes-tag">
                  {t}
                </span>
              ))}
            </div>
            {editingId === note.id ? (
              <>
                <textarea
                  className="coopNotes-input coopNotes-textarea"
                  aria-label="Edit note"
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                />
                <div className="coopNotes-cardActions">
                  <button
                    type="button"
                    className="coopNotes-btn coopNotes-btnPrimary"
                    onClick={() => handleSaveEdit(note.id)}
                  >
                    Save
                  </button>
                  <button type="button" className="coopNotes-btn" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="coopNotes-cardBody">{renderMarkdownish(note.body)}</div>
                <div className="coopNotes-cardActions">
                  <button type="button" className="coopNotes-btn" onClick={() => startEdit(note)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="coopNotes-btn coopNotes-btnDanger"
                    onClick={() => handleDelete(note.id)}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
