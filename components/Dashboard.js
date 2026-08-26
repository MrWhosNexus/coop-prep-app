"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as lib from "@/lib/coop-lib";
import ToolErrorBoundary from "@/components/ToolErrorBoundary";
import Settings from "@/components/Settings";
import CoverLetterTool from "@/components/tools/CoverLetterTool";
import SheetTool from "@/components/tools/SheetTool";
import VizTool from "@/components/tools/VizTool";
import NoteTaker from "@/components/notes/NoteTaker";
import LessonBuilder from "@/components/notes/LessonBuilder";
import RecallDrill from "@/components/games/RecallDrill";
import MatchGame from "@/components/games/MatchGame";
import RapidFire from "@/components/games/RapidFire";
import FormulaBuilder from "@/components/games/FormulaBuilder";
import ErrorHunt from "@/components/games/ErrorHunt";
import { ALL_MODULES, lessonsForCurriculumLesson } from "@/data/registry";
import {
  overallProgress, nextLesson, coreModuleSummary,
  openProgressStore, encodeProgressDocument,
  examBankConcepts, buildPracticeSession,
} from "@/components/dashboard-scope";
import { HEART_FLASHCARDS } from "@/data/heart";
import { HUSTLE_FLASHCARDS } from "@/data/hustle";
import { CFI_DISCLAIMER } from "@/data/certs/cfi";
import { CFI_DRILLS } from "@/data/certs/cfi-drills";
import { HMDA_CSV } from "@/data/hmda-csv";
import { extractConcepts, extractFormulas } from "@/lib/games/generators";
import { reviewInDeck, horizonTo, dueCardIds } from "@/lib/games/srs";
import { applyReviewToDeck, toSrsGrades } from "@/lib/exam/review";
import { listAcceptedLessons } from "@/lib/ai/lesson-builder";
/* ── Phase 3 imports: hustle tools, exam simulator, CFI drills, guided lessons ── */
import ResumeBuilder from "@/components/tools/ResumeBuilder";
import StarStoryBank from "@/components/tools/StarStoryBank";
import ApplicationTracker from "@/components/tools/ApplicationTracker";
import MockInterview from "@/components/tools/MockInterview";
import NetworkTracker from "@/components/tools/NetworkTracker";
import NegotiationPrep from "@/components/tools/NegotiationPrep";
import ExamHost from "@/components/exam/ExamHost";
import GuidePanel from "@/components/guide/GuidePanel";
import SpotlightOverlay from "@/components/guide/SpotlightOverlay";
import StepCelebration from "@/components/guide/StepCelebration";
import IntroTour from "@/components/guide/IntroTour";
import CompanionWidget from "@/components/voice/companion/CompanionWidget";
import { speakStep } from "@/lib/guide/narration";
import { GAME_LESSONS } from "@/lib/guide/game-lessons";
import Canvas from "@/components/viz/Canvas";
import { attachGuide, normalizeStep } from "@/components/guide/adapter";
import { rangeRect } from "@/components/sheet/Grid";
import { HEADER_HEIGHT } from "@/components/sheet/sheet-logic";
import { parseRef } from "@/lib/sheet/cells";
import * as guideRunner from "@/lib/guide/runner";
import { LESSONS_BY_ID } from "@/lib/guide/lessons/index";
import { checkpointForStep, materializeCheckpoint, startingState } from "@/lib/guide/checkpoints";
import { skillsAssessment } from "@/lib/exam/banks";
import { createSheet, setCells, getCell, getValue, getRangeValues, formatValue } from "@/lib/sheet/model";
import { pivotFromGrid, pivotToGrid } from "@/lib/sheet/pivot";
import { inferFields, createCalculatedField } from "@/lib/viz/fields";
import {
  createEncoding, putOnShelf, removeFromShelf, setAggregation, setDiscrete,
  addFilter, removeFilter, encodingLabel, isDiscrete,
} from "@/lib/viz/spec";
import { Aggregation, categoricalFilter, rangeFilter, topNFilter } from "@/lib/viz/aggregate";
import { MarkType, MARK_LABELS } from "@/lib/viz/marks";
import { buildRenderPlan } from "@/lib/viz/render-plan";
import { orderedOptions } from "@/lib/quiz-order";
import { ensureLegacyAIConfigMigrated } from "@/lib/ai/config";
import "@/components/guide/guide.css";
import "@/components/viz/viz.css";

/* ── Phase 2 wiring: module-level constants (pure + deterministic) ── */

// Every flashcard the app can drill. Core-curriculum cards come FIRST so the
// index-keyed progress.flashDone map stays valid for existing users.
const DECK = [...lib.FLASHCARDS, ...HEART_FLASHCARDS, ...HUSTLE_FLASHCARDS];

// Game inputs are derived once, at module load (extractFormulas regex-scans
// every lesson body — never rebuild per render). Scope is EVERYTHING
// navigable — all tracks plus every flashcard — matching dashboard-scope.js's
// NAV answer: practice describes the whole app, it is not a readiness claim.
// Core-only here was Finding 3b: 84 heart/hustle/licensing lessons fed no
// practice at all. (Accepted AI-generated lessons stay out on purpose: they
// are per-user state, and this pool is deliberately built once.)
const GAME_CONCEPTS = extractConcepts({ modules: ALL_MODULES, flashcards: DECK });
const GAME_FORMULAS = extractFormulas({ modules: ALL_MODULES, flashcards: DECK });
// Every registered exam-bank question, keyed by bank item id — the same ids
// ExamSimTool's onSrsReview writes into progress.srs. Review-only: served by
// buildPracticeSession when due, never introduced as new material. This is
// what makes "the ones you missed come back tomorrow" true (Finding 3a).
// data/registry.js (imported above) has registered the question banks by now —
// lib/exam/ ships them empty, so that import is what makes this non-empty.
const EXAM_CONCEPTS = examBankConcepts();

// VizTool must not fetch(): Chromium refuses fetch() on file:// URLs, which is
// how the packaged Electron build loads the app. The CSV ships as a JS string.
function VizToolWired() {
  return <VizTool csvText={HMDA_CSV} />;
}

/**
 * NoteTaker/LessonBuilder read and write a `notes` slice of note RECORDS
 * ({id, body, tags, ...}). The legacy progress document already uses `notes`
 * for lessonId -> free-text lesson notes, so the AI note records live under
 * `aiNotes` instead and this shim swaps the key both ways.
 */
function withAiNotesSlice(Component) {
  function AiNotesSliceTool({ state, dispatch, ...rest }) {
    const doc = { ...state, notes: state?.aiNotes ?? {} };
    const wrappedDispatch = (updater) =>
      dispatch((prev) => {
        const inner = updater({ ...prev, notes: prev?.aiNotes ?? {} });
        const { notes: aiNotes, ...others } = inner;
        return { ...others, notes: prev?.notes ?? {}, aiNotes };
      });
    return <Component state={doc} dispatch={wrappedDispatch} {...rest} />;
  }
  AiNotesSliceTool.displayName = `withAiNotesSlice(${Component.displayName || Component.name || "Tool"})`;
  return AiNotesSliceTool;
}
const NoteTakerTool = withAiNotesSlice(NoteTaker);
const LessonBuilderTool = withAiNotesSlice(LessonBuilder);

/**
 * Append accepted AI-generated lessons (lib/ai/lesson-builder tools slice) to
 * the module named in their provenance, at render time — data/curriculum.js
 * itself is never mutated.
 */
function mergeGeneratedLessons(baseModules, doc) {
  let generated = [];
  try { generated = listAcceptedLessons(doc) ?? []; } catch { generated = []; }
  if (!generated.length) return baseModules;
  return baseModules.map((mod) => {
    const extra = generated.filter(
      (l) => l?.provenance?.moduleId === mod.id && !mod.lessons.some((x) => x.id === l.id)
    );
    return extra.length ? { ...mod, lessons: [...mod.lessons, ...extra] } : mod;
  });
}

const TOOL_COMPONENTS = {
  coverLetter: CoverLetterTool,
  sheet: SheetTool,
  viz: VizToolWired,
  notes: NoteTakerTool,
  lessonBuilder: LessonBuilderTool,
  games: GamesTool,
  // Hustle job-search suite — same {state, dispatch, onOpenSettings} contract
  // as CoverLetterTool; ids match data/hustle-tools.js spec/slice ids.
  resumeBuilder: ResumeBuilder,
  starStoryBank: StarStoryBank,
  applicationTracker: ApplicationTracker,
  mockInterview: MockInterview,
  networkTracker: NetworkTracker,
  salaryNegotiationPrep: NegotiationPrep,
  // Licensing
  examSim: ExamSimTool,
  cfiDrills: CfiDrillsTool,
};

/* ── Phase 3 wiring: guided lessons + exam + CFI drills (module-level) ── */

// The guide facade over the REAL lib/guide runner, created once.
const GUIDE = attachGuide(guideRunner);
// Guided lessons and CFI drills reference datasets by resource key; the CSV
// ships as a JS string (fetch() is unavailable under file:// in Electron).
const GUIDE_RESOURCES = { "hmda-sample.csv": HMDA_CSV };

/* ──────────────────────────────────────────────────────────────────────
   Ported from the "COOP Prep" Claude Design component (COOP Prep.dc.html).
   Single client component holding all state, mirroring the design's DCLogic
   class. Pure logic + data come from lib/* (unchanged).
   ────────────────────────────────────────────────────────────────────── */

const ICONS = {
  dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  cards: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  arrowL: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  arrowR: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  lightbulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  circleCheck: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  rotate: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  square: '<rect width="18" height="18" x="3" y="3" rx="2"/>',
  trending: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  highlighter: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
  note: '<path d="M15 3v4a2 2 0 0 0 2 2h4"/><path d="M5 3h10l6 6v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>',
  brain: '<path d="M12 5a3 3 0 1 0-5.997.142 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.142 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  briefcase: '<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
};

// Split `text` into nodes, wrapping any saved highlight snippet in <mark>.
function HighlightedText({ text, snippets, color }) {
  if (!snippets || !snippets.length) return text;
  const present = snippets.filter((s) => s && text.includes(s)).sort((a, b) => b.length - a.length);
  if (!present.length) return text;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${present.map(esc).join("|")})`, "g");
  const parts = text.split(re);
  return parts.map((part, i) =>
    present.includes(part) ? (
      <mark key={i} style={{ background: hexA(color, 0.28), color: "var(--text-1)", borderRadius: 3, padding: "0 2px", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>{part}</mark>
    ) : (
      part
    )
  );
}

function Icon({ name, size = 16, color = "currentColor", fill = "none", style }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill={fill}
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: ICONS[name] || "" }}
    />
  );
}

function hexA(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export default function Dashboard() {
  const [progress, setProgress] = useState(null);
  const [days, setDays] = useState(0);
  // Phase-aware countdown state. `days` alone froze at 0 the day the target
  // passed, so every surface that renders it must also know WHICH phase the
  // program is in (lib.fellowshipPhase) and, during the program, how far in
  // we are (lib.daysIntoFellowship) — "Day 15" is true; "0 days" was not.
  const [phase, setPhase] = useState("before");
  const [dayOf, setDayOf] = useState(0);
  const [theme, setTheme] = useState("daylight");

  const [view, setView] = useState("home");
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [activeLessonId, setActiveLessonId] = useState(null);

  // First-run animated intro tour. Off until an effect confirms it has never
  // run (localStorage), so it never flashes on hydration or on repeat visits.
  const [introActive, setIntroActive] = useState(false);
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (!window.localStorage.getItem("coop-intro-tour-done")) setIntroActive(true);
    } catch { /* localStorage blocked: skip the tour rather than crash */ }
  }, []);
  const finishIntro = useCallback(() => {
    setIntroActive(false);
    try { window.localStorage?.setItem("coop-intro-tour-done", "1"); } catch { /* ignore */ }
  }, []);

  const [rewards, setRewards] = useState([]);

  const [lessonTab, setLessonTab] = useState("read");
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  const [query, setQuery] = useState("");
  const [selText, setSelText] = useState("");

  const [flashIdx, setFlashIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [flashMode, setFlashMode] = useState("all");

  const [focusRunning, setFocusRunning] = useState(false);
  const [focusSeconds, setFocusSeconds] = useState(0);

  const [activeToolId, setActiveToolId] = useState(null);
  const [activeGuidedId, setActiveGuidedId] = useState(null);
  const [aiOn, setAiOn] = useState(false);
  // The current guided step (label + index), lifted so the voice widget can
  // name what the learner is doing. Null whenever no guided lesson is open.
  const [guidedStepInfo, setGuidedStepInfo] = useState(null);
  // Per-lesson voice switch (only meaningful inside a voice:true guided lesson).
  const [guidedVoiceEnabled, setGuidedVoiceEnabled] = useState(true);

  const focusInt = useRef(null);
  const timers = useRef([]);
  // The lib/store store when the desktop bridge exists; null on the web build
  // or when the saved document refuses to load (then localStorage carries on
  // and the unreadable file is never written over). See dashboard-scope.js's
  // PERSISTENCE WIRING section for the whole decision.
  const storeRef = useRef(null);

  /* ── mount ── */
  useEffect(() => {
    let t = "daylight";
    try { t = localStorage.getItem("coop_theme") || "daylight"; } catch {}
    document.documentElement.setAttribute("data-theme", t);
    setTheme(t);

    /* Progress load order: the desktop store is async (an IPC read), the
       legacy path is sync. Open the store FIRST and only fall back to
       localStorage when there is no bridge or the store cannot load — setting
       the localStorage blob eagerly and swapping later would let a dispatch
       race the swap and clobber the store's newer document. On first desktop
       launch openProgressStore migrates the legacy localStorage keys into
       userData/store.json (and flushes) so nobody loses pre-store progress. */
    let cancelled = false;
    (async () => {
      let fromStore = null;
      try {
        const snapshot = {};
        try {
          for (const key of ["coop_prep_v1", "coop_ai_v1", "coop_theme"]) snapshot[key] = localStorage.getItem(key);
        } catch {}
        const opened = await openProgressStore({ bridge: window.coop?.store, snapshot });
        if (opened) {
          storeRef.current = opened.store;
          fromStore = opened.progress;
        }
      } catch (err) {
        console.error("coop-prep: desktop store unavailable — continuing on localStorage without touching the saved file", err);
      }
      if (!cancelled) setProgress(fromStore ?? lib.loadProgress());
    })();

    /* Flush-on-quit: the store autosave is debounced, so the last ~second of
       work would ride only in memory when the window closes. pagehide is the
       reliable close/refresh signal; visibilitychange covers minimize/switch. */
    const flushStore = () => { storeRef.current?.flush().catch(() => {}); };
    const onVisibility = () => { if (document.visibilityState === "hidden") flushStore(); };
    window.addEventListener("pagehide", flushStore);
    document.addEventListener("visibilitychange", onVisibility);

    /* Close the last legacy-key gap: a user who opens neither Settings nor an AI
       tool would otherwise keep a plaintext key at rest in Chromium's
       localStorage. The Dashboard always mounts, so migrating here catches
       everyone. Idempotent, de-duplicated against the AI surfaces that also call
       it, and never rejects — so refresh the badge either way, and only after it
       settles, or a just-migrated key would read as "no AI". */
    ensureLegacyAIConfigMigrated(window.coop?.endpoints).finally(refreshAiOn);
    setDays(lib.daysUntilFellowship());
    setPhase(lib.fellowshipPhase());
    setDayOf(lib.daysIntoFellowship());
    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", flushStore);
      document.removeEventListener("visibilitychange", onVisibility);
      flushStore();
      if (focusInt.current) clearInterval(focusInt.current);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  /* ── persistence choke point ──
     EVERY progress write funnels through here. lib.saveProgress keeps the
     web (no-bridge) path working and doubles as a same-machine mirror; the
     store is the real desktop persistence — userData/store.json via the
     preload bridge, debounced+atomic, with schema/migrate/export behind it.
     Before this existed (Finding 4) the store had no caller and all data
     lived solely in Chromium's per-profile localStorage. */
  function persistProgress(next) {
    lib.saveProgress(next);
    const store = storeRef.current;
    if (!store) return;
    try {
      store.setDocument(encodeProgressDocument(next, store.get()));
    } catch (err) {
      // Never let a persistence failure eat the in-memory state or the
      // localStorage mirror; the store retries on the next dispatch/flush.
      console.error("coop-prep: failed to stage progress into the desktop store", err);
    }
  }

  /* ── AI availability badge.

        Reads the desktop registry and NOTHING else. It deliberately does not
        consult the legacy localStorage key: no AI surface can authenticate with
        that key any more (lib/ai/client.js goes through the ai:call bridge, and
        the main process holds the credential), so lighting the badge from it
        promised AI the tool could not deliver — the user clicked Enhance and got
        bounced to Settings forever.

        The registry only ever hands back key-free views, so `hasKey` is a
        boolean about main-process state, never key material. ── */
  function refreshAiOn() {
    try {
      window.coop?.endpoints?.list?.()
        .then((eps) => setAiOn(Array.isArray(eps) && eps.some((e) => e?.hasKey)))
        .catch(() => setAiOn(false));
    } catch {
      setAiOn(false);
    }
  }

  /* ── actions ── */
  function applyResult(res) {
    if (!res.final) return;
    persistProgress(res.final);
    setProgress(res.final);
    if (res.queued.length) enqueue(res.queued);
  }
  function enqueue(queued) {
    setRewards((prev) => [...prev, ...queued]);
    queued.forEach((r) => {
      const ttl = r.type === "xp" ? 1400 : 3200;
      const t = setTimeout(
        () => setRewards((prev) => prev.filter((x) => x.id !== r.id)),
        ttl
      );
      timers.current.push(t);
    });
  }
  const completeLesson = (id) => applyResult(lib.doCompleteLesson(progress, id));
  const recordQuiz = (id, c, t) => applyResult(lib.doRecordQuiz(progress, id, c, t));
  const masterCard = (idx) => applyResult(lib.doMasterCard(progress, idx));
  const addFocus = (min) => applyResult(lib.doAddFocusMinutes(progress, min));

  /* ── study tools (persist immediately; no rewards) ── */
  function persist(next) { persistProgress(next); setProgress(next); }
  const toggleBookmark = (id) => persist(lib.toggleBookmark(progress, id));
  function saveHighlight() {
    const t = selText.trim();
    if (!t || !activeLessonId) return;
    persist(lib.addHighlight(progress, activeLessonId, t));
    setSelText("");
    try { window.getSelection()?.removeAllRanges(); } catch {}
  }
  const removeHighlight = (id, text) => persist(lib.removeHighlight(progress, id, text));

  /* ── navigation ── */
  function go(v, moduleId) {
    setView(v);
    if (moduleId !== undefined) setActiveModuleId(moduleId);
  }
  function openModule(id) { setView("module"); setActiveModuleId(id); }
  function openTool(id) { setView("tool"); setActiveToolId(id); }
  function openGuided(id) { setActiveGuidedId(id); setGuidedStepInfo(null); setView("guided"); }
  /* Finishing a guided lab records the score AND credits streak/XP through
     doCompleteLab — labs are the app's hardest work, and before this they
     counted as inactivity (only completeLesson advanced the streak). The
     score record always updates (best-effort UI history); the XP credit is
     idempotent per lab inside markLabComplete, so re-runs re-record the score
     but never re-mint XP. */
  const recordGuidedComplete = (guidedId, score) => {
    const withRecord = {
      ...progress,
      tools: {
        ...(progress.tools ?? {}),
        guided: { ...(progress.tools?.guided ?? {}), [guidedId]: { score, completedAt: new Date().toISOString() } },
      },
    };
    const res = lib.doCompleteLab(withRecord, guidedId, score);
    const final = res.final ?? withRecord;
    persistProgress(final);
    setProgress(final);
    if (res.queued.length) enqueue(res.queued);
  };
  function dispatchTool(updater) {
    setProgress((prev) => { const next = updater(prev); persistProgress(next); return next; });
  }
  function openLesson(modId, lessonId) {
    setView("lesson");
    setActiveModuleId(modId);
    setActiveLessonId(lessonId);
    setLessonTab("read");
    setAnswers({});
    setSubmitted(false);
    setSelText("");
    setNoteDraft(progress?.notes?.[lessonId] || "");
  }
  function openCard(index) {
    setFlashMode("all");
    setFlashIdx(index);
    setFlipped(false);
    setView("flash");
  }
  function toggleTheme() {
    const next = theme === "daylight" ? "midnight" : "daylight";
    try { localStorage.setItem("coop_theme", next); } catch {}
    try { storeRef.current?.set("settings", (s) => ({ ...(s ?? {}), theme: next })); } catch {}
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
  }

  /* ── focus timer ── */
  function toggleFocus() {
    if (focusRunning) {
      clearInterval(focusInt.current);
      const mins = Math.floor(focusSeconds / 60);
      if (mins > 0) addFocus(mins);
      setFocusRunning(false);
      setFocusSeconds(0);
    } else {
      setFocusRunning(true);
      focusInt.current = setInterval(() => setFocusSeconds((s) => s + 1), 1000);
    }
  }

  /* ── lesson handlers ── */
  const pickAnswer = (qi, opt) => { if (!submitted) setAnswers((a) => ({ ...a, [qi]: opt })); };
  function submitQuiz(lesson) {
    const c = lesson.quiz.filter((q, i) => answers[i] === q.a).length;
    setSubmitted(true);
    recordQuiz(lesson.id, c, lesson.quiz.length);
  }
  function retryQuiz() { setAnswers({}); setSubmitted(false); }
  function onNote(e) {
    const v = e.target.value;
    const next = { ...progress, notes: { ...progress.notes, [activeLessonId]: v } };
    persistProgress(next);
    setNoteDraft(v);
    setProgress(next);
  }

  /* ── flashcards ── */
  function flashDeck() {
    const cards = DECK;
    const known = progress?.flashDone || {};
    return flashMode === "unseen" ? cards.filter((_, i) => !known[i]) : cards;
  }
  const flip = () => setFlipped((f) => !f);
  function navCard(dir) {
    const len = Math.max(flashDeck().length, 1);
    setFlipped(false);
    const t = setTimeout(() => setFlashIdx((i) => (i + dir + len) % len), 60);
    timers.current.push(t);
  }
  function chooseFlashMode(m) { setFlashMode(m); setFlashIdx(0); setFlipped(false); }
  function markKnown() {
    const deck = flashDeck();
    const len = deck.length;
    const pos = flashIdx % Math.max(len, 1);
    const card = deck[pos];
    const gi = DECK.indexOf(card);
    masterCard(gi);
    setFlipped(false);
    setFlashIdx(pos >= len - 1 ? 0 : pos + 1);
  }

  /* ── loading ── */
  if (!progress) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--canvas)", color: "var(--text-1)", position: "relative", overflowX: "hidden" }}>
        <div style={{ position: "fixed", inset: 0, background: "var(--bg-gradient)", pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5 }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  /* ════════ derived ════════ */
  // Two module sets, two different questions. See components/dashboard-scope.js
  // for the decision behind every use below — the names are deliberate, an
  // unqualified `MODULES` here is what let 84 lessons count toward nothing.
  const { MODULES: CORE_MODULES } = lib;
  const FLASHCARDS = DECK;
  // Everything navigable: core curriculum + heart/hustle + licensing tracks,
  // with accepted AI-generated lessons merged into their home modules.
  const NAV_MODULES = mergeGeneratedLessons(ALL_MODULES, progress);
  // "How much of this app have I done?" — all 105 lessons.
  const { done: doneLessons, total: totalLessons, pct: overallPct } = overallProgress(progress, NAV_MODULES);
  // "Am I ready for the fellowship?" — core curriculum ONLY, on purpose: the
  // optional licensing tracks are not evidence of fellowship readiness, and
  // letting them dilute the ring would read a prepared candidate as ~20% ready.
  const readiness = lib.readinessScore(progress, CORE_MODULES);

  const bookmarkCount = Object.keys(progress.bookmarks || {}).length;
  const highlightCount = Object.values(progress.highlights || {}).reduce((n, arr) => n + arr.length, 0);
  const savedCount = bookmarkCount + highlightCount;

  // sidebar countdown urgency — deadline pressure only exists while there IS
  // a deadline ahead; after the program the chip is informational, and
  // letting days=0 fall through would paint it permanently red.
  let cdBg, cdBorder, cdColor;
  if (phase === "after") { cdBg = "var(--primary-dim)"; cdBorder = "var(--primary-ring)"; cdColor = "var(--primary-2)"; }
  else if (days < 20) { cdBg = "var(--red-dim)"; cdBorder = "var(--red-ring)"; cdColor = "var(--red-2)"; }
  else if (days < 45) { cdBg = "var(--gold-dim)"; cdBorder = "var(--gold-ring)"; cdColor = "var(--gold-2)"; }
  else { cdBg = "var(--primary-dim)"; cdBorder = "var(--primary-ring)"; cdColor = "var(--primary-2)"; }

  const xpFloats = rewards.filter((r) => r.type === "xp");
  const toasts = rewards.filter((r) => r.type !== "xp");

  return (
    <div style={{ minHeight: "100vh", background: "var(--canvas)", color: "var(--text-1)", fontFamily: "var(--font-body)", position: "relative", overflowX: "hidden" }}>
      {/* backdrop blooms */}
      <div style={{ position: "fixed", inset: 0, background: "var(--bg-gradient)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", minHeight: "100vh" }}>

        {/* ══════════ SIDEBAR ══════════ */}
        <aside style={{ width: "var(--sidebar-w)", flexShrink: 0, position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 30, padding: 14 }}>
          <div className="glass-strong" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 18px 16px" }}>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)" }}>COOP Prep</div>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 3, fontWeight: 500 }}>Financial Services Track</div>
              </div>
              <button onClick={toggleTheme} title="Switch theme" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 999, border: "1px solid var(--glass-border)", background: "var(--glass-fill)", color: "var(--text-2)", cursor: "pointer" }}>
                <Icon name={theme === "daylight" ? "moon" : "sun"} size={15} />
              </button>
            </div>

            <div style={{ height: 1, background: "var(--glass-border)", margin: "0 16px 12px" }} />

            <nav style={{ padding: "0 10px", flex: 1, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
              <button className={view === "home" ? "nav-item active" : "nav-item"} onClick={() => go("home")}>
                <Icon name="dashboard" size={15} /><span>Dashboard</span>
              </button>

              {lib.PILLARS.map((p) => {
                const items = lib.getByPillar(p.id);
                return (
                  <div key={p.id}>
                    <div style={{ margin: "16px 0 6px", padding: "0 10px", display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon name={p.icon} size={13} color="var(--text-3)" />
                      <span className="section-label">{p.label}</span>
                    </div>
                    {items.length === 0 && (
                      <div style={{ padding: "4px 11px", fontSize: 12, color: "var(--text-3)" }}>Coming soon</div>
                    )}
                    {items.map((it) => {
                      if (it.kind === "module") {
                        const mod = NAV_MODULES.find((m) => m.id === it.id);
                        const active = (view === "module" || view === "lesson") && activeModuleId === it.id;
                        return (
                          <button key={it.id} className={active ? "nav-item active" : "nav-item"} onClick={() => openModule(it.id)} style={{ paddingLeft: 11 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 4, background: mod ? mod.color : "var(--text-3)", flexShrink: 0 }} />
                            <span>{it.label}</span>
                          </button>
                        );
                      }
                      const active = view === "tool" && activeToolId === it.id;
                      return (
                        <button key={it.id} className={active ? "nav-item active" : "nav-item"} onClick={() => openTool(it.id)} style={{ paddingLeft: 11 }}>
                          <Icon name="note" size={15} />
                          <span>{it.label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              <div style={{ margin: "16px 0 6px", padding: "0 10px" }}><span className="section-label">Practice</span></div>
              <button className={view === "flash" ? "nav-item active" : "nav-item"} onClick={() => go("flash")}>
                <Icon name="cards" size={15} /><span style={{ flex: 1 }}>Flashcards</span>
                <span className="badge badge-muted" style={{ fontSize: 10 }}>{FLASHCARDS.length}</span>
              </button>

              <div style={{ margin: "16px 0 6px", padding: "0 10px" }}><span className="section-label">Study</span></div>
              <button className={view === "search" ? "nav-item active" : "nav-item"} onClick={() => go("search")}>
                <Icon name="search" size={15} /><span>Search</span>
              </button>
              <button className={view === "saved" ? "nav-item active" : "nav-item"} onClick={() => go("saved")}>
                <Icon name="bookmark" size={15} /><span style={{ flex: 1 }}>Saved</span>
                {savedCount > 0 && <span className="badge badge-muted" style={{ fontSize: 10 }}>{savedCount}</span>}
              </button>
            </nav>

            {/* footer */}
            <div style={{ padding: "14px 16px 16px", borderTop: "1px solid var(--glass-border)", display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 500 }}>Overall progress</span>
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--text-2)", fontWeight: 600 }}>{doneLessons}/{totalLessons}</span>
                </div>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${overallPct}%`, background: "var(--cta-gradient)" }} /></div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: "var(--r-sm)", background: cdBg, border: `1px solid ${cdBorder}` }}>
                <Icon name="calendar" size={13} color={cdColor} />
                {/* Phase-aware copy: a plain countdown read "0 days" forever
                    once the date passed. During the program, "Day N" is the
                    number that is actually true and useful. */}
                <span style={{ fontSize: 12, fontWeight: 600, color: cdColor }}>
                  {phase === "before" ? `${days} days to fellowship start`
                    : phase === "during" ? `Day ${dayOf} of the fellowship · ${days} days to ${lib.FELLOWSHIP_TARGET_LABEL}`
                    : "Fellowship complete"}
                </span>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 5, padding: "7px 9px", borderRadius: "var(--r-sm)", background: "var(--gold-dim)", border: "1px solid var(--gold-ring)" }}>
                  <Icon name="zap" size={12} color="var(--gold-2)" fill="var(--gold)" /><span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--gold-2)" }}>{progress.xp}</span><span style={{ fontSize: 10.5, color: "var(--text-3)" }}>XP</span>
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 5, padding: "7px 9px", borderRadius: "var(--r-sm)", background: "var(--orange-dim)", border: "1px solid var(--orange-ring)" }}>
                  <Icon name="flame" size={12} color="var(--orange-2)" fill="var(--orange)" /><span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--orange-2)" }}>{progress.streak}</span><span style={{ fontSize: 10.5, color: "var(--text-3)" }}>day</span>
                </div>
              </div>

              <button className="nav-item" onClick={toggleFocus} style={{ justifyContent: "space-between", background: "var(--glass-fill)", border: "1px solid var(--glass-border)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name={focusRunning ? "square" : "play"} size={13} color={focusRunning ? "var(--red)" : "var(--green-2)"} />Focus
                </span>
                <span className="mono" style={{ fontSize: 12, color: focusRunning ? "var(--text-1)" : "var(--text-3)" }}>{lib.formatDuration(focusSeconds)}</span>
              </button>
              <button className="nav-item" onClick={() => setView("settings")} style={{ marginTop: 8 }}>
                <Icon name="settings" size={15} />
                <span>AI Settings</span>
                {aiOn && <span className="badge badge-green" style={{ marginLeft: "auto" }}>AI</span>}
              </button>
            </div>
          </div>
        </aside>

        {/* ══════════ MAIN ══════════ */}
        <main style={{ marginLeft: "var(--sidebar-w)", flex: 1, minHeight: "100vh" }}>
          {view === "home" && <HomeView {...{ CORE_MODULES, NAV_MODULES, FLASHCARDS, progress, days, phase, dayOf, readiness, doneLessons, totalLessons, openModule, openLesson, go }} />}
          {view === "module" && <ModuleView {...{ MODULES: NAV_MODULES, progress, activeModuleId, openLesson, go }} />}
          {view === "lesson" && (
            <LessonView
              {...{ MODULES: NAV_MODULES, progress, activeModuleId, activeLessonId, lessonTab, setLessonTab,
                answers, submitted, noteDraft, pickAnswer, submitQuiz, retryQuiz, onNote, completeLesson, go,
                toggleBookmark, removeHighlight, setSelText, openGuided }}
            />
          )}
          {view === "guided" && activeGuidedId && (
            <ToolErrorBoundary toolId={`guided:${activeGuidedId}`}>
              <GuidedLessonView
                key={activeGuidedId}
                guidedId={activeGuidedId}
                onExit={() => setView(activeLessonId ? "lesson" : "home")}
                onRecordComplete={recordGuidedComplete}
                onStepInfo={setGuidedStepInfo}
                voiceEnabled={guidedVoiceEnabled}
                onVoiceToggle={setGuidedVoiceEnabled}
              />
            </ToolErrorBoundary>
          )}
          {view === "flash" && (
            <FlashView
              {...{ FLASHCARDS, progress, flashMode, flipped, flashIdx, flashDeck,
                chooseFlashMode, flip, navCard, markKnown, go }}
            />
          )}
          {view === "search" && (
            <SearchView {...{ MODULES: NAV_MODULES, FLASHCARDS, progress, query, setQuery, openLesson, openCard }} />
          )}
          {view === "saved" && (
            <SavedView {...{ MODULES: NAV_MODULES, progress, openLesson, toggleBookmark, removeHighlight }} />
          )}
          {view === "tool" && (
            <ToolErrorBoundary toolId={activeToolId}>
              {TOOL_COMPONENTS[activeToolId]
                ? (() => { const T = TOOL_COMPONENTS[activeToolId]; return <T state={progress} dispatch={dispatchTool} onOpenSettings={() => setView("settings")} />; })()
                : <div className="glass" style={{ padding: 24, maxWidth: 720, margin: "40px auto" }}>Coming soon.</div>}
            </ToolErrorBoundary>
          )}
          {view === "settings" && (
            <Settings onClose={() => setView("home")} onSaved={refreshAiOn} />
          )}
        </main>
      </div>

      {/* ══════════ HIGHLIGHT SELECTION PILL ══════════ */}
      {view === "lesson" && lessonTab === "read" && selText && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 70 }}>
          <button className="glass-strong" onClick={saveHighlight} style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 20px", borderRadius: 999, cursor: "pointer", color: "var(--text-1)", fontSize: 13.5, fontWeight: 600, fontFamily: "var(--font-body)", boxShadow: "0 10px 30px rgba(0,0,0,0.22)" }}>
            <Icon name="highlighter" size={15} color="var(--gold-2)" /> Highlight selection
          </button>
        </div>
      )}

      {/* ══════════ REWARD LAYER ══════════ */}
      <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", zIndex: 60, pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {xpFloats.map((x) => (
          <div key={x.id} className="float-xp mono" style={{ fontSize: 22, fontWeight: 800, color: "var(--gold-2)", textShadow: "0 2px 12px rgba(0,0,0,0.18)" }}>+{x.amount} XP</div>
        ))}
      </div>
      <div style={{ position: "fixed", top: 20, right: 20, zIndex: 60, display: "flex", flexDirection: "column", gap: 10, maxWidth: 320 }}>
        {toasts.map((t) => {
          const isLevel = t.type === "level";
          const ach = !isLevel ? lib.ACHIEVEMENTS.find((a) => a.id === t.achId) : null;
          return (
            <div key={t.id} className="glass-strong toast-in" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
              <span className="celebrate" style={{ display: "flex" }}>
                <Icon name={isLevel ? "trending" : "award"} size={20} color={isLevel ? "var(--primary-2)" : "var(--gold-2)"} />
              </span>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text-1)" }}>{isLevel ? `Level ${t.level}!` : (ach?.label || "Achievement")}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>{isLevel ? "Keep the momentum going." : (ach?.desc || "")}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ══════════ FIRST-RUN INTRO TOUR ══════════ */}
      <IntroTour active={introActive} onFinish={finishIntro} />

      {/* ══════════ NEXUS VOICE (visible across every view) ══════════ */}
      <CompanionWidget
        context={{
          view,
          activeModuleId,
          activeLessonId,
          activeToolId,
          activeGuidedId: view === "guided" ? activeGuidedId : null,
          currentStep: view === "guided" ? guidedStepInfo?.label ?? undefined : undefined,
        }}
        aiOn={aiOn}
        voiceEnabled={
          view === "guided" && LESSONS_BY_ID[activeGuidedId]?.voice === true
            ? guidedVoiceEnabled
            : true
        }
      />
    </div>
  );
}

/* ─────────────────────────────────────────── HOME ─────────────────────────────────────────── */
function HomeView({ CORE_MODULES, NAV_MODULES, FLASHCARDS, progress, days, phase, dayOf, readiness, doneLessons, totalLessons, openModule, openLesson, go }) {
  const quizPasses = Object.values(progress.quizScores).filter((s) => s.correct === s.total).length;

  const lvl = lib.levelFromXp(progress.xp);
  const daily = lib.dailyProgress(progress, lib.todayISO());
  const mult = lib.streakMultiplier(progress.streak);
  const dC = 176;

  const rC = 264;
  const ringStop1 = readiness < 40 ? "var(--red)" : readiness < 70 ? "var(--gold)" : "var(--green)";
  const ringStop2 = readiness > 60 ? "var(--primary)" : ringStop1;
  const ringCopy = readiness < 33 ? "Just starting — every lesson counts."
    : readiness < 66 ? "Good momentum. Keep pushing."
    : readiness < 90 ? "Strong. Finish the quizzes."
    : "You're ready. Practice your pitch.";

  const hour = new Date().getHours();
  const greeting = (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening") + " 👋";

  // Core curriculum first (it has a deadline), then the rest of the app — so
  // finishing core suggests the licensing/heart/hustle work instead of
  // announcing that the app is done while 84 lessons wait.
  const next = nextLesson(progress, CORE_MODULES, NAV_MODULES);

  const stats = [
    { icon: <Icon name="book" size={16} color="var(--primary-2)" />, value: doneLessons, sub: `/ ${totalLessons}`, label: "Lessons done" },
    { icon: <Icon name="target" size={16} color="var(--green-2)" />, value: quizPasses, sub: "passed", label: "Quiz passes" },
    { icon: <Icon name="zap" size={16} color="var(--gold-2)" fill="var(--gold)" />, value: progress.xp, sub: "XP", label: "Total earned" },
    { icon: <Icon name="flame" size={16} color="var(--orange-2)" fill="var(--orange)" />, value: progress.streak, sub: "days", label: "Study streak" },
  ];

  // The grid below renders the core track, so its header counts the core track.
  // Every other track is reachable from the sidebar's pillar nav.
  const { complete: modulesComplete, total: coreModuleCount } = coreModuleSummary(progress, CORE_MODULES);

  return (
    <div style={{ padding: "40px 48px", maxWidth: 940, margin: "0 auto" }}>

      {/* momentum strip */}
      <div className="glass fadein" style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 24, alignItems: "center", padding: "20px 24px", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 9 }}>
            <span className="badge badge-primary">LVL {lvl.level}</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>{lvl.tierName}</span>
            <span className="mono" style={{ fontSize: 12, color: "var(--text-3)", marginLeft: "auto" }}>{lvl.xpInLevel}/{lvl.xpForNext} XP</span>
          </div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${lvl.pct}%`, background: "linear-gradient(90deg, var(--primary), var(--secondary))" }} /></div>
        </div>
        <div style={{ position: "relative", width: 64, height: 64 }} title="Daily goal">
          <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="32" cy="32" r="28" fill="none" stroke="var(--glass-border-2)" strokeWidth="5" />
            <circle cx="32" cy="32" r="28" fill="none" stroke={daily.met ? "var(--green)" : "var(--primary)"} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(daily.pct / 100) * dC} ${dC}`} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>{daily.pct}%</span>
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "center" }}>
            <Icon name="flame" size={14} color="var(--orange-2)" fill="var(--orange)" /><span className="mono" style={{ fontSize: 18, fontWeight: 800, color: "var(--text-1)" }}>{progress.streak}</span>
          </div>
          <div className="badge badge-gold" style={{ marginTop: 6 }}>{mult.toFixed(1)}× XP</div>
        </div>
      </div>

      {/* greeting */}
      <div className="fadein" style={{ marginBottom: 30 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15, color: "var(--text-1)" }}>{greeting}</h1>
        <p style={{ marginTop: 8, fontSize: 15, color: "var(--text-2)", lineHeight: 1.5 }}>{phase === "before" ? `COOP Financial Services Fellowship starts in ${days} days.`
          : phase === "during" ? `COOP Financial Services Fellowship in progress — Day ${dayOf}, ${days} days to program end (${lib.FELLOWSHIP_TARGET_LABEL}).`
          : "COOP Financial Services Fellowship complete — keep the skills warm."}</p>
      </div>

      {/* hero */}
      <div className="fadein" style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20, marginBottom: 24 }}>
        {/* readiness ring */}
        <div className="glass" style={{ padding: "30px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div style={{ position: "relative", width: 120, height: 120, marginBottom: 18 }}>
            <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
              <defs>
                <linearGradient id="rgrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={ringStop1} />
                  <stop offset="100%" stopColor={ringStop2} />
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r="42" fill="none" stroke="var(--glass-border-2)" strokeWidth="8" />
              <circle cx="60" cy="60" r="42" fill="none" stroke="url(#rgrad)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(readiness / 100) * rC} ${rC}`} style={{ animation: "ringfill .9s cubic-bezier(.16,1,.3,1) both" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span className="mono" style={{ fontSize: 30, fontWeight: 800, color: "var(--text-1)", lineHeight: 1 }}>{readiness}%</span>
              <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", marginTop: 4 }}>Ready</span>
            </div>
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-1)", marginBottom: 6 }}>Fellowship Readiness</div>
          <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5 }}>{ringCopy}</div>
        </div>

        {/* continue / all complete */}
        {next ? (
          <button className="glass glass-btn" onClick={() => openLesson(next.mod.id, next.l.id)} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: 28, textAlign: "left", borderColor: hexA(next.mod.color, 0.32), background: `linear-gradient(135deg, var(--glass-fill) 0%, ${hexA(next.mod.color, 0.10)} 100%)` }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span className="badge" style={{ background: hexA(next.mod.color, 0.16), color: next.mod.color, border: `1px solid ${hexA(next.mod.color, 0.34)}` }}>Continue</span>
                <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>{next.mod.title}</span>
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.01em", color: "var(--text-1)", marginBottom: 12 }}>{next.l.title}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13, color: "var(--text-3)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Icon name="clock" size={12} color="var(--text-3)" />{next.l.minutes} min</span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Icon name="help" size={12} color="var(--text-3)" />{(next.l.quiz || []).length} questions</span>
                <span style={{ color: "var(--gold-2)", fontWeight: 600 }}>+50 XP</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 24, fontSize: 13.5, fontWeight: 600, color: "var(--primary-2)" }}>Start lesson <Icon name="arrowR" size={15} color="var(--primary-2)" /></div>
          </button>
        ) : (
          <div className="glass" style={{ height: "100%", padding: 32, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--text-1)", marginBottom: 8 }}>All {totalLessons} lessons complete</div>
            <div style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.5 }}>Review flashcards and practice your pitch. {phase === "before" ? `Fellowship is ${days} days away.` : phase === "during" ? `You are on Day ${dayOf} of the fellowship.` : "The fellowship is complete."}</div>
          </div>
        )}
      </div>

      {/* stats */}
      <div className="fadein" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 40 }}>
        {stats.map((s) => (
          <div key={s.label} className="glass" style={{ padding: 20, textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4, marginBottom: 5 }}>
              <span style={{ display: "flex", alignItems: "center", marginRight: 2 }}>{s.icon}</span>
              <span className="mono" style={{ fontSize: 26, fontWeight: 800, color: "var(--text-1)" }}>{s.value}</span>
              <span style={{ fontSize: 13, color: "var(--text-3)", fontWeight: 500 }}>{s.sub}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* modules */}
      <div className="fadein">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-1)" }}>Modules</h2>
          <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>{modulesComplete}/{coreModuleCount} complete</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {CORE_MODULES.map((mod) => {
            const total = mod.lessons.length;
            const done = mod.lessons.filter((l) => progress.completed[l.id]).length;
            const allDone = done === total;
            return (
              <button key={mod.id} className="glass glass-btn" onClick={() => openModule(mod.id)} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", textAlign: "left", width: "100%" }}>
                <div style={{ width: 40, height: 40, borderRadius: "var(--r-md)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, background: hexA(mod.color, 0.14), border: `1px solid ${hexA(mod.color, 0.28)}` }}>{mod.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-1)" }}>{mod.title}</span>
                    {allDone && <span className="badge badge-green">Done</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-3)", marginBottom: 8 }}>{mod.description}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="progress-track" style={{ flex: 1 }}><div className="progress-fill" style={{ width: `${(done / total) * 100}%`, background: allDone ? "var(--green)" : mod.color }} /></div>
                    <span className="mono" style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 600 }}>{done}/{total}</span>
                  </div>
                </div>
                <Icon name="chevR" size={16} color="var(--text-3)" />
              </button>
            );
          })}
        </div>
      </div>

      {/* flashcard CTA */}
      <div className="fadein" style={{ marginTop: 24 }}>
        <button className="glass glass-btn" onClick={() => go("flash")} style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 24px", width: "100%", textAlign: "left" }}>
          <div style={{ width: 44, height: 44, borderRadius: "var(--r-md)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--gold-dim)", border: "1px solid var(--gold-ring)" }}><Icon name="cards" size={19} color="var(--gold-2)" /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-1)", marginBottom: 3 }}>Flashcard Review</div>
            <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>{FLASHCARDS.length} terms · regulations, formulas, frameworks · spaced repetition</div>
          </div>
          <Icon name="chevR" size={16} color="var(--text-3)" />
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── MODULE ─────────────────────────────────────────── */
function ModuleView({ MODULES, progress, activeModuleId, openLesson, go }) {
  const mod = MODULES.find((m) => m.id === activeModuleId);
  if (!mod) return null;
  const total = mod.lessons.length;
  const done = mod.lessons.filter((l) => progress.completed[l.id]).length;

  return (
    <div style={{ padding: "40px 48px", maxWidth: 740, margin: "0 auto" }}>
      <button className="btn-ghost fadein" onClick={() => go("home")} style={{ marginBottom: 24 }}><Icon name="arrowL" size={14} /> Back to dashboard</button>

      <div className="glass fadein" style={{ padding: 28, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: "var(--r-md)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, background: hexA(mod.color, 0.14), border: `1px solid ${hexA(mod.color, 0.28)}` }}>{mod.icon}</div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.2, color: "var(--text-1)" }}>{mod.title}</div>
            <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 5, textTransform: "uppercase", letterSpacing: ".06em", color: mod.color }}>{mod.coopModule}</div>
          </div>
        </div>
        <div style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.65, marginBottom: 18 }}>{mod.description}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="progress-track" style={{ flex: 1 }}><div className="progress-fill" style={{ width: `${(done / total) * 100}%`, background: mod.color }} /></div>
          <span className="mono" style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>{done}/{total} lessons</span>
        </div>
      </div>

      {mod.id.startsWith("cfi-") && (
        <div className="glass fadein" style={{ padding: "12px 16px", marginBottom: 16, fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.6, borderLeft: "3px solid var(--gold-ring)" }}>
          {CFI_DISCLAIMER}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {mod.lessons.map((lesson, idx) => {
          const isDone = !!progress.completed[lesson.id];
          const quiz = progress.quizScores[lesson.id];
          const locked = idx > 0 && !progress.completed[mod.lessons[idx - 1].id];
          let iconBg, iconBorder, iconColor, iconNode;
          if (isDone) { iconBg = "var(--green-dim)"; iconBorder = "var(--green-ring)"; iconColor = "var(--green-2)"; iconNode = <Icon name="circleCheck" size={16} color="var(--green-2)" />; }
          else if (locked) { iconBg = "var(--glass-fill)"; iconBorder = "var(--glass-border)"; iconColor = "var(--text-3)"; iconNode = <Icon name="lock" size={13} color="var(--text-3)" />; }
          else { iconBg = hexA(mod.color, 0.14); iconBorder = hexA(mod.color, 0.3); iconColor = mod.color; iconNode = idx + 1; }
          return (
            <button key={lesson.id} className="glass" onClick={() => { if (!locked) openLesson(mod.id, lesson.id); }} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", textAlign: "left", width: "100%", opacity: locked ? 0.45 : 1, cursor: locked ? "not-allowed" : "pointer", borderColor: isDone ? "var(--green-ring)" : "var(--glass-border)", background: isDone ? "var(--green-dim)" : "var(--glass-fill)", transition: "transform .15s ease, box-shadow .15s ease" }}>
              <div style={{ width: 36, height: 36, borderRadius: "var(--r-sm)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, background: iconBg, border: `1px solid ${iconBorder}`, color: iconColor }}>{iconNode}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)", marginBottom: 3 }}>{lesson.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", display: "flex", gap: 12 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Icon name="clock" size={11} color="var(--text-3)" />{lesson.minutes} min</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Icon name="help" size={11} color="var(--text-3)" />{(lesson.quiz || []).length} questions</span>
                </div>
              </div>
              {quiz && <span className={`badge ${quiz.correct === quiz.total ? "badge-green" : "badge-gold"}`}>{quiz.correct}/{quiz.total}</span>}
              {!locked && !isDone && <Icon name="chevR" size={15} color="var(--text-3)" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── LESSON ─────────────────────────────────────────── */
function LessonView({ MODULES, progress, activeModuleId, activeLessonId, lessonTab, setLessonTab, answers, submitted, noteDraft, pickAnswer, submitQuiz, retryQuiz, onNote, completeLesson, go, toggleBookmark, removeHighlight, setSelText, openGuided }) {
  const mod = MODULES.find((m) => m.id === activeModuleId);
  const lesson = mod && mod.lessons.find((l) => l.id === activeLessonId);
  if (!lesson) return null;
  // Hands-on counterparts from the guided-lesson registry (empty for most lessons).
  const guidedLessons = lessonsForCurriculumLesson(lesson.id);
  const done = !!progress.completed[lesson.id];
  const quizScore = progress.quizScores[lesson.id];
  const bookmarked = !!progress.bookmarks?.[lesson.id];
  const highlights = progress.highlights?.[lesson.id] || [];
  const captureSelection = () => {
    try { setSelText((window.getSelection()?.toString() || "").trim()); } catch {}
  };

  const tabDefs = [
    { id: "read", label: "Lesson", ic: "clock" },
    { id: "quiz", label: `Quiz (${(lesson.quiz || []).length})`, ic: "help" },
    { id: "challenge", label: "Challenge", ic: "lightbulb" },
  ];

  const correct = submitted ? lesson.quiz.filter((q, i) => answers[i] === q.a).length : 0;
  const allAnswered = (lesson.quiz || []).every((_, i) => answers[i] !== undefined);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--glass-fill-strong)", WebkitBackdropFilter: "blur(20px) saturate(180%)", backdropFilter: "blur(20px) saturate(180%)", borderBottom: "1px solid var(--glass-border)", padding: "0 32px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0 12px" }}>
            <button className="btn-ghost" onClick={() => go("module")} style={{ flexShrink: 0 }}><Icon name="arrowL" size={14} /> Back</button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: mod.color, marginBottom: 2 }}>{mod.title}</div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-1)", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lesson.title}</div>
            </div>
            {done && <span className="badge badge-green" style={{ flexShrink: 0 }}><Icon name="check" size={10} color="var(--green-2)" />Done</span>}
            <button onClick={() => toggleBookmark(lesson.id)} title={bookmarked ? "Remove bookmark" : "Bookmark this lesson"} aria-label="Toggle bookmark" style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 999, cursor: "pointer", border: `1px solid ${bookmarked ? "var(--gold-ring)" : "var(--glass-border)"}`, background: bookmarked ? "var(--gold-dim)" : "var(--glass-fill)" }}>
              <Icon name="bookmark" size={15} color={bookmarked ? "var(--gold-2)" : "var(--text-3)"} fill={bookmarked ? "var(--gold-2)" : "none"} />
            </button>
          </div>
          <div style={{ display: "flex", borderTop: "1px solid var(--glass-border)" }}>
            {tabDefs.map((t) => {
              const active = lessonTab === t.id;
              return (
                <button key={t.id} onClick={() => setLessonTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "11px 16px", fontSize: 13, fontWeight: 500, color: active ? "var(--text-1)" : "var(--text-3)", background: "none", border: "none", cursor: "pointer", borderBottom: active ? `2px solid ${mod.color}` : "2px solid transparent", marginBottom: -1, fontFamily: "var(--font-body)" }}>
                  <span style={{ display: "flex" }}><Icon name={t.ic} size={13} color={active ? mod.color : "var(--text-3)"} /></span>{t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: "36px 32px", maxWidth: 720, margin: "0 auto", width: "100%" }}>

        {lessonTab === "read" && (
          <div className="fadein">
            <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
              <span className="badge badge-muted"><Icon name="clock" size={11} color="var(--text-3)" /> {lesson.minutes} min read</span>
              {done && <span className="badge badge-green"><Icon name="check" size={10} color="var(--green-2)" /> Completed</span>}
            </div>
            <div onMouseUp={captureSelection} onTouchEnd={captureSelection} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {lesson.body.map((text, i) => (
                <p key={i} style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-2)" }}>
                  <HighlightedText text={text} snippets={highlights} color={mod.color} />
                </p>
              ))}
            </div>

            {highlights.length > 0 && (
              <div style={{ marginTop: 32, paddingTop: 22, borderTop: "1px solid var(--glass-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Icon name="highlighter" size={14} color="var(--gold-2)" />
                  <span className="section-label">Highlights ({highlights.length})</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {highlights.map((h) => (
                    <div key={h} className="glass" style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px", borderLeft: `3px solid ${mod.color}` }}>
                      <span style={{ flex: 1, fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.5 }}>{h}</span>
                      <button onClick={() => removeHighlight(lesson.id, h)} title="Remove highlight" aria-label="Remove highlight" style={{ flexShrink: 0, display: "flex", padding: 4, borderRadius: 6, border: "none", background: "none", cursor: "pointer", color: "var(--text-3)" }}>
                        <Icon name="x" size={14} color="var(--text-3)" />
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-3)" }}>Select any text above and tap “Highlight selection” to save it here.</div>
              </div>
            )}
            {guidedLessons.length > 0 && (
              <div style={{ marginTop: 32, paddingTop: 22, borderTop: "1px solid var(--glass-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Icon name="target" size={14} color="var(--primary-2)" />
                  <span className="section-label">Hands-on practice ({guidedLessons.length})</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {guidedLessons.map((gl) => {
                    const done = progress.tools?.guided?.[gl.id];
                    return (
                      <button key={gl.id} className="glass glass-btn" onClick={() => openGuided(gl.id)} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", padding: "14px 18px", borderLeft: `3px solid ${done ? "var(--green-ring)" : "var(--primary-ring)"}` }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>{gl.title}</span>
                            {done && <span className="badge badge-green">Done · {done.score}</span>}
                          </div>
                          <div style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.5 }}>{gl.description}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 5 }}>{gl.steps.length} guided steps · graded against the real {gl.tool === "viz" ? "viz" : "spreadsheet"} engine</div>
                        </div>
                        <Icon name="chevR" size={15} color="var(--text-3)" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ marginTop: 40, paddingTop: 26, borderTop: "1px solid var(--glass-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 3, height: 16, borderRadius: 2, background: mod.color }} />
                <span className="section-label">Your Notes</span>
              </div>
              <textarea rows={4} value={noteDraft} onChange={onNote} placeholder="Write anything here — only you can see this." style={{ width: "100%", padding: "14px 16px", borderRadius: "var(--r-md)", background: "var(--glass-fill)", border: "1px solid var(--glass-border-2)", color: "var(--text-1)", fontSize: 14, lineHeight: 1.6, resize: "vertical", outline: "none", fontFamily: "var(--font-body)" }} />
            </div>
            <div style={{ marginTop: 20 }}>
              {!done ? (
                <button onClick={() => completeLesson(lesson.id)} style={{ width: "100%", padding: 14, borderRadius: "var(--r-md)", fontSize: 14.5, fontWeight: 600, fontFamily: "var(--font-body)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", cursor: "pointer", color: "#fff", background: `linear-gradient(135deg, ${mod.color}, ${hexA(mod.color, 0.78)})`, boxShadow: `0 6px 18px ${hexA(mod.color, 0.4)}` }}>
                  <Icon name="circleCheck" size={16} color="#fff" /> Mark Lesson Complete · +50 XP
                </button>
              ) : (
                <div style={{ padding: 14, textAlign: "center", borderRadius: "var(--r-md)", background: "var(--green-dim)", color: "var(--green-2)", border: "1px solid var(--green-ring)", fontSize: 14, fontWeight: 600 }}>✓ Lesson complete — try the Quiz and Challenge next</div>
              )}
            </div>
          </div>
        )}

        {lessonTab === "quiz" && (
          <div className="fadein" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {quizScore && (() => {
              const perfect = quizScore.correct === quizScore.total;
              return (
                <div style={{ padding: "14px 18px", borderRadius: "var(--r-md)", background: perfect ? "var(--green-dim)" : "var(--gold-dim)", border: `1px solid ${perfect ? "var(--green-ring)" : "var(--gold-ring)"}`, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13.5, fontWeight: 600, color: perfect ? "var(--green-2)" : "var(--gold-2)" }}>
                  <span>Last score: {quizScore.correct}/{quizScore.total}</span>
                  <span>{perfect ? "Perfect! +25 XP" : "Retry to improve"}</span>
                </div>
              );
            })()}
            {(lesson.quiz || []).map((q, qi) => (
              <div key={qi} className="glass" style={{ padding: 22, borderLeft: `3px solid ${hexA(mod.color, 0.5)}` }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-1)", marginBottom: 16, lineHeight: 1.5 }}><span style={{ color: "var(--text-3)", fontWeight: 400, marginRight: 6 }}>{qi + 1}.</span>{q.q}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {/* Options are permuted deterministically from the question's own
                      identity: authored order carries a severe positional tell (the
                      correct answer sits in slot A on 97.6% of SIE questions, and was
                      never D across all 212). Answers are compared by text, so this is
                      safe. See lib/quiz-order.js. */}
                  {orderedOptions(q, lesson.id).map((opt, oi) => {
                    const selected = answers[qi] === opt.text;
                    const isCorrect = opt.text === q.a;
                    let bg = "var(--glass-fill)", border = "var(--glass-border)", color = "var(--text-2)";
                    if (submitted) {
                      if (isCorrect) { bg = "var(--green-dim)"; border = "var(--green-ring)"; color = "var(--green-2)"; }
                      else if (selected) { bg = "var(--red-dim)"; border = "var(--red-ring)"; color = "var(--red-2)"; }
                      else { color = "var(--text-3)"; }
                    } else if (selected) { bg = "var(--primary-dim)"; border = "var(--primary-ring)"; color = "var(--primary-2)"; }
                    return (
                      <button key={oi} onClick={() => pickAnswer(qi, opt.text)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: "var(--r-md)", background: bg, border: `1px solid ${border}`, color, fontSize: 13.5, fontWeight: 500, textAlign: "left", cursor: submitted ? "default" : "pointer", transition: "background .12s, border-color .12s, color .12s", fontFamily: "var(--font-body)" }}>
                        <span className="mono" style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, flexShrink: 0 }}>{String.fromCharCode(65 + oi)}.</span>
                        {submitted && isCorrect && <Icon name="circleCheck" size={13} color="var(--green-2)" />}
                        <span>{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
                {submitted && (
                  <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: "var(--r-md)", background: "var(--glass-fill)", border: "1px solid var(--glass-border)", fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
                    <strong style={{ color: "var(--text-1)" }}>Why: </strong>{q.explanation}
                  </div>
                )}
              </div>
            ))}
            {submitted ? (
              <div>
                <div className="glass" style={{ padding: 20, textAlign: "center", marginBottom: 12, borderColor: correct === lesson.quiz.length ? "var(--green-ring)" : "var(--gold-ring)", background: correct === lesson.quiz.length ? "var(--green-dim)" : "var(--gold-dim)" }}>
                  <div className="mono" style={{ fontSize: 28, fontWeight: 800, color: correct === lesson.quiz.length ? "var(--green-2)" : "var(--gold-2)", marginBottom: 4 }}>{correct}/{lesson.quiz.length}</div>
                  <div style={{ fontSize: 13.5, color: "var(--text-2)" }}>{correct === lesson.quiz.length ? "Perfect score! +25 XP earned." : `${lesson.quiz.length - correct} incorrect — review highlighted answers above.`}</div>
                </div>
                <button className="btn-ghost" style={{ width: "100%" }} onClick={retryQuiz}>Retry Quiz</button>
              </div>
            ) : (
              <button disabled={!allAnswered} onClick={() => submitQuiz(lesson)} style={{ width: "100%", padding: 14, borderRadius: "var(--r-md)", fontSize: 14.5, fontWeight: 600, fontFamily: "var(--font-body)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", background: allAnswered ? "var(--cta-gradient)" : "var(--glass-fill)", color: allAnswered ? "#fff" : "var(--text-3)", boxShadow: allAnswered ? "0 6px 18px var(--primary-ring)" : "none", cursor: allAnswered ? "pointer" : "not-allowed" }}>
                {allAnswered ? "Submit Quiz" : `Answer all ${lesson.quiz.length} questions to submit`}
              </button>
            )}
          </div>
        )}

        {lessonTab === "challenge" && (
          <div className="fadein">
            <div className="glass-strong" style={{ padding: 24, marginBottom: 16, borderLeft: `3px solid ${mod.color}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Icon name="lightbulb" size={14} color={mod.color} /><span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: mod.color }}>Apply Your Knowledge</span>
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.75, color: "var(--text-2)" }}>{lesson.challenge}</p>
            </div>
            {lesson.exampleOutput && (
              <div className="glass" style={{ padding: 20, marginBottom: 16, borderLeft: `3px solid var(--green-ring)` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Icon name="circleCheck" size={14} color="var(--green-2)" /><span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--green-2)" }}>What a Correct Solution Looks Like</span>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-2)" }}>{lesson.exampleOutput}</p>
              </div>
            )}
            <div style={{ padding: "14px 18px", borderRadius: "var(--r-md)", background: "var(--glass-fill)", border: "1px solid var(--glass-border)", fontSize: 13.5, color: "var(--text-3)", lineHeight: 1.6 }}><strong style={{ color: "var(--text-2)" }}>Tip:</strong> Write your answer in Notes on the Lesson tab. Challenges are for reflection — no submission needed.</div>
          </div>
        )}

      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── FLASHCARDS ─────────────────────────────────────────── */
function FlashView({ FLASHCARDS, progress, flashMode, flipped, flashIdx, flashDeck, chooseFlashMode, flip, navCard, markKnown, go }) {
  const cards = FLASHCARDS;
  const known = progress.flashDone || {};
  const mastered = Object.keys(known).filter((k) => known[k]).length;
  const deck = flashDeck();

  if (!deck.length) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div className="scalein" style={{ textAlign: "center", maxWidth: 380 }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>🎉</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, letterSpacing: "-0.01em", color: "var(--text-1)", marginBottom: 8 }}>All {cards.length} cards mastered!</div>
          <div style={{ fontSize: 14.5, color: "var(--text-2)", marginBottom: 28, lineHeight: 1.6 }}>Switch to All Cards to review again, or head back to continue your lessons.</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={() => chooseFlashMode("all")}><Icon name="rotate" size={14} color="#fff" /> Review All Cards</button>
            <button className="btn-ghost" onClick={() => go("home")}><Icon name="arrowL" size={14} /> Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  const len = deck.length;
  const pos = flashIdx % Math.max(len, 1);
  const card = deck[pos];
  const dotCount = Math.min(len, 20);

  return (
    <div style={{ minHeight: "100vh", padding: "40px 48px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div className="fadein" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <button className="btn-ghost" onClick={() => go("home")}><Icon name="arrowL" size={14} /> Dashboard</button>
          <div className="glass" style={{ display: "flex", gap: 4, padding: 4, borderRadius: "var(--r-md)" }}>
            {[["all", `All (${cards.length})`], ["unseen", `Unseen (${cards.length - mastered})`]].map(([m, label]) => (
              <button key={m} onClick={() => chooseFlashMode(m)} style={{ padding: "6px 14px", borderRadius: "var(--r-sm)", fontSize: 12.5, fontWeight: 600, background: flashMode === m ? "var(--glass-fill-strong)" : "transparent", color: flashMode === m ? "var(--text-1)" : "var(--text-3)", border: flashMode === m ? "1px solid var(--glass-border-2)" : "1px solid transparent", cursor: "pointer", fontFamily: "var(--font-body)" }}>{label}</button>
            ))}
          </div>
        </div>

        <div className="fadein" style={{ textAlign: "center", marginBottom: 22 }}>
          <div className="mono" style={{ fontSize: 12.5, color: "var(--text-3)", fontWeight: 500 }}>{pos + 1} of {len} · {mastered} mastered</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 10, flexWrap: "wrap" }}>
            {Array.from({ length: dotCount }, (_, i) => (
              <div key={i} style={{ height: 3, width: i === pos ? 20 : 6, borderRadius: 2, background: i < pos ? "var(--glass-border-2)" : i === pos ? "var(--primary)" : "var(--glass-border)", transition: "all .2s ease" }} />
            ))}
          </div>
        </div>

        <div className="fadein" onClick={flip} style={{ perspective: 1200, cursor: "pointer", userSelect: "none", marginBottom: 24 }}>
          <div style={{ position: "relative", transformStyle: "preserve-3d", transition: "transform .55s cubic-bezier(.16,1,.3,1)", height: 300, transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
            <div className="glass-strong" style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", borderRadius: "var(--r-xl)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 48px", textAlign: "center" }}>
              <span className="badge badge-primary" style={{ marginBottom: 20 }}>TERM</span>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--text-1)", lineHeight: 1.3, letterSpacing: "-0.01em" }}>{card.term}</div>
              <div style={{ marginTop: 24, fontSize: 12.5, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 5 }}><Icon name="rotate" size={11} color="var(--text-3)" /> Click to flip</div>
            </div>
            <div className="glass-strong" style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)", borderRadius: "var(--r-xl)", borderColor: "var(--gold-ring)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 48px", textAlign: "center" }}>
              <span className="badge badge-gold" style={{ marginBottom: 20 }}>DEFINITION</span>
              <div style={{ fontSize: 16, color: "var(--text-2)", lineHeight: 1.75 }}>{card.def}</div>
            </div>
          </div>
        </div>

        <div className="fadein" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <button className="btn-ghost" onClick={() => navCard(-1)}><Icon name="chevL" size={15} /> Prev</button>
          {flipped ? (
            <button onClick={markKnown} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 28px", borderRadius: "var(--r-md)", background: "var(--green-dim)", color: "var(--green-2)", border: "1px solid var(--green-ring)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)" }}><Icon name="check" size={14} color="var(--green-2)" /> Got it</button>
          ) : (
            <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>Flip to mark known</div>
          )}
          <button className="btn-ghost" onClick={() => navCard(1)}>Next <Icon name="chevR" size={15} /></button>
        </div>

        <div style={{ marginTop: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500 }}>Mastery</span>
            <span className="mono" style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>{mastered}/{cards.length}</span>
          </div>
          <div className="progress-track" style={{ height: 6 }}><div className="progress-fill" style={{ width: `${(mastered / cards.length) * 100}%`, background: "linear-gradient(90deg, var(--green) 0%, var(--primary) 100%)" }} /></div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── SEARCH ─────────────────────────────────────────── */
function SearchView({ MODULES, FLASHCARDS, progress, query, setQuery, openLesson, openCard }) {
  const results = lib.searchCurriculum(MODULES, FLASHCARDS, query);
  const lessons = results.filter((r) => r.type === "lesson");
  const cards = results.filter((r) => r.type === "flashcard");
  const trimmed = query.trim();

  return (
    <div style={{ padding: "40px 48px", maxWidth: 740, margin: "0 auto" }}>
      <h1 className="fadein" style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)", marginBottom: 18 }}>Search</h1>

      <div className="glass fadein" style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 16px", marginBottom: 24 }}>
        <Icon name="search" size={18} color="var(--text-3)" />
        <input
          autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search lessons, challenges, and flashcards…"
          style={{ flex: 1, padding: "14px 0", background: "none", border: "none", outline: "none", color: "var(--text-1)", fontSize: 15, fontFamily: "var(--font-body)" }}
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Clear search" style={{ display: "flex", padding: 6, border: "none", background: "none", cursor: "pointer", color: "var(--text-3)" }}>
            <Icon name="x" size={16} color="var(--text-3)" />
          </button>
        )}
      </div>

      {trimmed.length < 2 ? (
        <div className="fadein" style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-3)", fontSize: 14 }}>Type at least two characters to search across every module.</div>
      ) : results.length === 0 ? (
        <div className="fadein" style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-3)", fontSize: 14 }}>No matches for “{trimmed}”. Try a regulation, formula, or keyword.</div>
      ) : (
        <div className="fadein" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>{results.length} result{results.length === 1 ? "" : "s"} for “{trimmed}”</div>

          {lessons.length > 0 && (
            <div>
              <div style={{ marginBottom: 10 }}><span className="section-label">Lessons ({lessons.length})</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {lessons.map((r) => (
                  <button key={r.lessonId} className="glass glass-btn" onClick={() => openLesson(r.moduleId, r.lessonId)} style={{ display: "block", width: "100%", textAlign: "left", padding: "14px 18px", borderLeft: `3px solid ${r.color}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: r.color }}>{r.moduleTitle}</span>
                    </div>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-1)", marginBottom: 4 }}>{r.title}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.5 }}>{r.snippet}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {cards.length > 0 && (
            <div>
              <div style={{ marginBottom: 10 }}><span className="section-label">Flashcards ({cards.length})</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cards.map((r) => (
                  <button key={r.index} className="glass glass-btn" onClick={() => openCard(r.index)} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", padding: "14px 18px" }}>
                    <Icon name="cards" size={17} color="var(--gold-2)" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)", marginBottom: 3 }}>{r.term}</div>
                      <div style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.5 }}>{r.snippet}</div>
                    </div>
                    <Icon name="chevR" size={15} color="var(--text-3)" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────── SAVED ─────────────────────────────────────────── */
function SavedView({ MODULES, progress, openLesson, toggleBookmark, removeHighlight }) {
  const lessonOf = (id) => {
    for (const mod of MODULES) {
      const l = mod.lessons.find((x) => x.id === id);
      if (l) return { mod, lesson: l };
    }
    return null;
  };

  const bookmarks = Object.keys(progress.bookmarks || {}).map(lessonOf).filter(Boolean);
  const highlightEntries = Object.entries(progress.highlights || {})
    .map(([id, snippets]) => ({ ref: lessonOf(id), snippets }))
    .filter((e) => e.ref && e.snippets.length);
  const noteEntries = Object.entries(progress.notes || {})
    .filter(([, v]) => v && v.trim())
    .map(([id, text]) => ({ ref: lessonOf(id), text }))
    .filter((e) => e.ref);

  const empty = !bookmarks.length && !highlightEntries.length && !noteEntries.length;

  return (
    <div style={{ padding: "40px 48px", maxWidth: 740, margin: "0 auto" }}>
      <h1 className="fadein" style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)", marginBottom: 6 }}>Saved</h1>
      <p className="fadein" style={{ fontSize: 13.5, color: "var(--text-2)", marginBottom: 26 }}>Your bookmarks, highlights, and notes — all in one place.</p>

      {empty ? (
        <div className="glass fadein" style={{ textAlign: "center", padding: "44px 24px" }}>
          <Icon name="bookmark" size={26} color="var(--text-3)" style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-1)", marginBottom: 6 }}>Nothing saved yet</div>
          <div style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.6 }}>Bookmark a lesson, highlight a sentence, or jot a note — they’ll collect here for quick review.</div>
        </div>
      ) : (
        <div className="fadein" style={{ display: "flex", flexDirection: "column", gap: 28 }}>

          {bookmarks.length > 0 && (
            <div>
              <div style={{ marginBottom: 12 }}><span className="section-label">Bookmarked lessons ({bookmarks.length})</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {bookmarks.map(({ mod, lesson }) => (
                  <div key={lesson.id} className="glass" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderLeft: `3px solid ${mod.color}` }}>
                    <button onClick={() => openLesson(mod.id, lesson.id)} className="glass-btn" style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: mod.color, marginBottom: 4 }}>{mod.title}</div>
                      <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-1)" }}>{lesson.title}</div>
                    </button>
                    <button onClick={() => toggleBookmark(lesson.id)} title="Remove bookmark" aria-label="Remove bookmark" style={{ flexShrink: 0, display: "flex", padding: 7, borderRadius: 999, border: "1px solid var(--gold-ring)", background: "var(--gold-dim)", cursor: "pointer" }}>
                      <Icon name="bookmark" size={14} color="var(--gold-2)" fill="var(--gold-2)" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {highlightEntries.length > 0 && (
            <div>
              <div style={{ marginBottom: 12 }}><span className="section-label">Highlights</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {highlightEntries.map(({ ref, snippets }) => (
                  <div key={ref.lesson.id}>
                    <button onClick={() => openLesson(ref.mod.id, ref.lesson.id)} className="glass-btn" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, background: "none", border: "none", cursor: "pointer", padding: 0, color: ref.mod.color, fontSize: 12.5, fontWeight: 600 }}>
                      {ref.lesson.title} <Icon name="chevR" size={13} color={ref.mod.color} />
                    </button>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {snippets.map((h) => (
                        <div key={h} className="glass" style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderLeft: `3px solid ${ref.mod.color}` }}>
                          <span style={{ flex: 1, fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>{h}</span>
                          <button onClick={() => removeHighlight(ref.lesson.id, h)} title="Remove highlight" aria-label="Remove highlight" style={{ flexShrink: 0, display: "flex", padding: 4, border: "none", background: "none", cursor: "pointer", color: "var(--text-3)" }}>
                            <Icon name="x" size={13} color="var(--text-3)" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {noteEntries.length > 0 && (
            <div>
              <div style={{ marginBottom: 12 }}><span className="section-label">Notes</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {noteEntries.map(({ ref, text }) => (
                  <button key={ref.lesson.id} className="glass glass-btn" onClick={() => openLesson(ref.mod.id, ref.lesson.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "14px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                      <Icon name="note" size={13} color="var(--text-3)" />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: ref.mod.color }}>{ref.lesson.title}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, whiteSpace: "pre-wrap", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{text}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────── PRACTICE GAMES ───────────────────────────────────────────
   Tool id "games" (data/registry.js). Wraps the five lib/games experiences.
   onGrade feeds the SRS deck stored at progress.srs; the horizon is recomputed
   at every review so nothing schedules past the fellowship start date. */
const GAME_DEFS = [
  { id: "recall", label: "Recall Drill", desc: "Type the term from its definition. Graded into your spaced-repetition deck." },
  { id: "match", label: "Match Game", desc: "Pair terms with definitions against the clock." },
  { id: "rapid", label: "Rapid Fire", desc: "Curriculum quiz questions on a timer — every option's explanation shown after." },
  { id: "formula", label: "Formula Builder", desc: "Reassemble real Excel formulas token by token." },
  { id: "errorHunt", label: "Error Hunt", desc: "Find and fix the planted bug in a four-fifths analysis workbook." },
];

/**
 * A one-line objective for a game round, active voice, no em-dash. Shown as the
 * GameHost banner in guided mode.
 * @param {string} gameId
 * @returns {string}
 */
export function gameObjective(gameId) {
  switch (gameId) {
    case "recall": return "Type each answer from memory to clear the round.";
    case "match": return "Pair every term with its definition to finish.";
    case "rapid": return "Answer each question before the clock runs out.";
    case "formula": return "Rebuild each formula token by token.";
    case "errorHunt": return "Find the planted bug and fix it.";
    default: return "Clear the round.";
  }
}

// A game lesson names one of the five games by kind; map it to this tool's
// internal activeGame id so a curated lesson launches the real game.
const GAME_KIND_TO_ID = {
  "recall-drill": "recall",
  match: "match",
  "rapid-fire": "rapid",
  "formula-builder": "formula",
  "error-hunt": "errorHunt",
};

function GamesTool({ state, dispatch, guided = false, onAdvance }) {
  const [activeGame, setActiveGame] = useState(null);
  // When a curated game lesson is launched, its objective banners the round.
  // The round itself plays normally (no auto-advance-out on first correct),
  // so this stays a light layer over the real game.
  const [lessonObjective, setLessonObjective] = useState(null);
  // The session pools, planned from the SRS deck when a game is LAUNCHED and
  // frozen for the round: grading during play updates the deck, and replanning
  // mid-round would rebuild the round under the player. Exiting to this menu
  // and starting again plans a fresh session against the updated deck.
  const [session, setSession] = useState(null);

  // CRITICAL: recompute the horizon at each review — before program end it is
  // the distance left to FELLOWSHIP_END; after it, horizonTo switches to its
  // rolling window (ROLLING_WINDOW_DAYS). It used to floor at 1 past the
  // deadline, which silently made every card due every day.
  const handleGrade = (conceptId, grade) => {
    dispatch((prev) => ({
      ...prev,
      srs: reviewInDeck(prev.srs ?? {}, conceptId, grade, {
        now: Date.now(),
        maxIntervalDays: horizonTo(lib.FELLOWSHIP_END, Date.now()),
      }),
    }));
  };
  // Only ever called from event handlers (launch / play-again), never during
  // render — buildPracticeSession supplies its own Date.now() default.
  const planNow = () =>
    buildPracticeSession({
      concepts: GAME_CONCEPTS,
      examConcepts: EXAM_CONCEPTS,
      deck: state?.srs ?? {},
    });
  const openGame = (id) => {
    setSession(planNow());
    setLessonObjective(null);
    setActiveGame(id);
  };
  // Launch a curated game lesson: run its mapped game with the lesson's own
  // objective shown above the round.
  const openGameLesson = (entry) => {
    const id = GAME_KIND_TO_ID[entry.game];
    if (!id) return;
    setSession(planNow());
    setLessonObjective(entry.objective || gameObjective(id));
    setActiveGame(id);
  };
  // After a round's summary screen, "play again" reuses the same pools; give
  // it the post-grading queue instead so cleared items don't repeat.
  const refreshSession = () => setSession(planNow());
  const exit = () => { setActiveGame(null); setLessonObjective(null); };
  const deckSize = Object.keys(state?.srs ?? {}).length;
  const dueNow = dueCardIds(state?.srs ?? {}).length;

  // Each game receives the planned session as its ENTIRE pool and a matching
  // round size — the games sample uniformly from what they are given, so this
  // is what guarantees every due item (exam misses included) a seat.
  const pools = session?.pools;
  // Guided round chrome (auto-advance + objective banner). GameHost already
  // owns the behavior; each game forwards these straight through. Empty when
  // not guided, so the standalone tool usage is byte-for-byte unchanged.
  const gp = (id) =>
    guided
      ? { objective: gameObjective(id), guided: true, onAdvance }
      : lessonObjective
      ? { objective: lessonObjective }
      : {};
  if (activeGame === "recall" && pools) return <RecallDrill concepts={pools.recall} count={pools.recall.length} onGrade={handleGrade} onComplete={refreshSession} onExit={exit} {...gp("recall")} />;
  if (activeGame === "match" && pools) return <MatchGame concepts={pools.match} pairs={pools.match.length} onGrade={handleGrade} onComplete={refreshSession} onExit={exit} {...gp("match")} />;
  if (activeGame === "rapid" && pools) return <RapidFire concepts={pools.rapid} count={pools.rapid.length} onGrade={handleGrade} onComplete={refreshSession} onExit={exit} {...gp("rapid")} />;
  if (activeGame === "formula") return <FormulaBuilder formulas={GAME_FORMULAS} onExit={exit} {...gp("formula")} />;
  if (activeGame === "errorHunt") return <ErrorHunt onExit={exit} {...gp("errorHunt")} />;

  return (
    <div style={{ padding: "40px 48px", maxWidth: 740, margin: "0 auto" }}>
      <h1 className="fadein" style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)", marginBottom: 6 }}>Practice Games</h1>
      <p className="fadein" style={{ fontSize: 13.5, color: "var(--text-2)", marginBottom: 26 }}>
        Five ways to drill every track — including questions you missed in mock exams.
        Recall, Match, and Rapid Fire draw from your spaced-repetition deck first
        {dueNow > 0 ? ` (${dueNow} of ${deckSize} tracked concepts due today)` : deckSize > 0 ? ` (${deckSize} concepts tracked, none due today)` : ""}.
      </p>
      <div className="fadein" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {GAME_DEFS.map((g) => (
          <button key={g.id} className="glass glass-btn" onClick={() => openGame(g.id)} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", textAlign: "left", width: "100%" }}>
            <div style={{ width: 40, height: 40, borderRadius: "var(--r-md)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--primary-dim)", border: "1px solid var(--primary-ring)" }}>
              <Icon name="zap" size={17} color="var(--primary-2)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-1)", marginBottom: 3 }}>{g.label}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>{g.desc}</div>
            </div>
            <Icon name="chevR" size={16} color="var(--text-3)" />
          </button>
        ))}
      </div>

      {GAME_LESSONS.length > 0 && (
        <div className="fadein" style={{ marginTop: 28 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "var(--text-1)", marginBottom: 4 }}>Guided game lessons</h2>
          <p style={{ fontSize: 12.5, color: "var(--text-3)", marginBottom: 12 }}>Curated drills that open the matching game with a clear objective.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {GAME_LESSONS.map((L) => (
              <button key={L.id} className="glass glass-btn" onClick={() => openGameLesson(L)} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", textAlign: "left", width: "100%" }}>
                <div style={{ width: 36, height: 36, borderRadius: "var(--r-md)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--gold-dim)", border: "1px solid var(--gold-ring)" }}>
                  <Icon name="target" size={16} color="var(--gold-2)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)", marginBottom: 3 }}>{L.title}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>{L.objective}</div>
                </div>
                <Icon name="chevR" size={16} color="var(--text-3)" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────── EXAM SIMULATOR ───────────────────────────────────────────
   Tool id "examSim" (data/registry.js). Thin persistence shim over
   components/exam/ExamHost: the sitting is checkpointed into the progress
   document's tools slice (state.tools.exam.session) on every transition plus
   ExamHost's 15s heartbeat, so a crashed renderer never eats a 3-hour mock.
   The session JSON carries its own form + answer key, so a resumed attempt
   needs no bank lookup. The banks themselves are registered in data/registry.js. */
function ExamSimTool({ state, dispatch }) {
  const savedSession = state?.tools?.exam?.session ?? null;
  const onPersist = (sessionJson) =>
    dispatch((prev) => ({
      ...prev,
      tools: { ...(prev.tools ?? {}), exam: { ...(prev.tools?.exam ?? {}), session: sessionJson } },
    }));
  const onClear = () =>
    dispatch((prev) => {
      const exam = { ...(prev.tools?.exam ?? {}) };
      delete exam.session;
      return { ...prev, tools: { ...(prev.tools ?? {}), exam } };
    });
  /* Closes the exam→SRS loop. lib/exam/review.js is explicit that the loop only
     closes if a HOST closes it — applyReviewToDeck is pure and imports no store,
     so without this the missed questions from a 3-hour mock went nowhere while
     ExamResults stood ready to tell the learner they had been scheduled.
     ExamHost makes no SRS claim unless this returns a real count, so a wiring
     mistake here shows up as a missing promise rather than a false one.

     Same horizon rule as GamesTool: recompute the cap at every review so nothing
     schedules past program end while it is still ahead, and so the cap becomes
     the rolling window (never 1) once it has passed. Exam card ids are bank item ids, which
     are already unique across the certs, so they share the games' deck safely. */
  const onSrsReview = (review) => {
    dispatch((prev) => ({
      ...prev,
      srs: applyReviewToDeck(prev.srs ?? {}, review, {
        now: Date.now(),
        maxIntervalDays: horizonTo(lib.FELLOWSHIP_END, Date.now()),
      }),
    }));
    return toSrsGrades(review).length;
  };

  return (
    <ExamHost
      savedSession={savedSession}
      onPersist={onPersist}
      onClear={onClear}
      onSrsReview={onSrsReview}
    />
  );
}

/* ─────────────────────────────────────────── MINI SHEET GRID ───────────────────────────────────────────
   A small editable surface over ONE lib/sheet engine sheet, shared by the
   CFI drill runner and the guided sheet workspace. The engine sheet is the
   designed-mutable model (SheetTool's own convention); `version` is the
   render signal. Not a SheetTool replacement — just enough grid to do the
   work the graders check. */

function colName(c) {
  let s = "";
  let n = c + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
const cellRefOf = (r, c) => `${colName(c)}${r + 1}`;

function rawInputOf(sheet, ref) {
  const rec = getCell(sheet, ref);
  if (rec === null || rec.input === null || rec.input === undefined) return "";
  return String(rec.input);
}

function MiniSheetGrid({ sheet, version, onEdit, minRows = 12, minCols = 8, maxHeight = 420 }) {
  const [sel, setSel] = useState("A1");
  const [draft, setDraft] = useState(() => rawInputOf(sheet, "A1"));
  // When the host swaps the sheet object (checkpoint reseed, drill reset),
  // snap the selection and formula bar back — adjust-during-render pattern.
  const [prevSheet, setPrevSheet] = useState(sheet);
  if (prevSheet !== sheet) {
    setPrevSheet(sheet);
    setSel("A1");
    setDraft(rawInputOf(sheet, "A1"));
  }
  const select = (ref) => {
    setSel(ref);
    setDraft(rawInputOf(sheet, ref));
  };

  const rows = Math.min(Math.max(minRows, sheet.maxRow + 3), 500);
  const cols = Math.min(Math.max(minCols, sheet.maxCol + 2), 40);

  const commit = () => onEdit(sel, draft);

  const cellStyle = (ref, isHeader) => ({
    border: "1px solid var(--glass-border)",
    padding: "3px 8px",
    minWidth: isHeader ? 34 : 74,
    maxWidth: 160,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 12,
    textAlign: isHeader ? "center" : "left",
    color: isHeader ? "var(--text-3)" : "var(--text-2)",
    background: isHeader
      ? "var(--glass-fill-strong)"
      : ref === sel
        ? "var(--primary-dim)"
        : "var(--glass-fill)",
    outline: ref === sel ? "2px solid var(--primary)" : "none",
    outlineOffset: -2,
    cursor: isHeader ? "default" : "pointer",
    fontFamily: "var(--font-mono, monospace)",
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span className="mono badge badge-muted" style={{ minWidth: 44, justifyContent: "center" }}>{sel}</span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") setDraft(rawInputOf(sheet, sel));
          }}
          placeholder="Type a value or =FORMULA, then press Enter"
          aria-label={`Formula bar for cell ${sel}`}
          className="mono"
          style={{ flex: 1, padding: "8px 12px", borderRadius: "var(--r-sm)", background: "var(--glass-fill)", border: "1px solid var(--glass-border-2)", color: "var(--text-1)", fontSize: 13, outline: "none" }}
        />
        <button className="btn-ghost" onClick={commit}>Set</button>
      </div>
      <div style={{ overflow: "auto", maxHeight, borderRadius: "var(--r-sm)", border: "1px solid var(--glass-border)" }}>
        <table style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={cellStyle(null, true)} />
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} style={cellStyle(null, true)}>{colName(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                <th style={cellStyle(null, true)}>{r + 1}</th>
                {Array.from({ length: cols }, (_, c) => {
                  const ref = cellRefOf(r, c);
                  const rec = getCell(sheet, ref);
                  return (
                    <td key={c} style={cellStyle(ref, false)} onClick={() => select(ref)} title={rec?.isFormula ? String(rec.input) : undefined}>
                      {rec ? formatValue(rec.value) : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── CFI MODELING DRILLS ───────────────────────────────────────────
   Tool id "cfiDrills" (data/registry.js). FMVA is a skills credential, not a
   multiple-choice exam (lib/exam refuses to draw a form for it) — so the
   drills get a build-the-model surface: seeded inputs, an editable grid, and
   grading against each drill's engine-verified expected values, including the
   mustReference perturbation check the drill file prescribes (a WACC cell
   that hardcodes 8% fails even if 8% is numerically right). */

function gradeCfiDrill(sheet, drill) {
  const tolerance = drill.tolerance ?? 0.01;
  const refs = Object.keys(drill.expected);
  const misses = [];
  for (const ref of refs) {
    const v = getValue(sheet, ref);
    const exp = drill.expected[ref];
    const ok = typeof v === "number" && Number.isFinite(v) && Math.abs(v - exp) <= tolerance;
    if (!ok) misses.push({ ref, actual: v });
  }
  // Only run the hardcode check once the values land — a wrong value already
  // has clearer feedback than "doesn't respond to its inputs".
  const hardcoded = [];
  if (misses.length === 0 && drill.mustReference) {
    for (const [cell, deps] of Object.entries(drill.mustReference)) {
      for (const dep of deps) {
        const before = getValue(sheet, cell);
        const rec = getCell(sheet, dep);
        const originalInput = rec === null ? null : rec.input;
        const base = Number(getValue(sheet, dep));
        const perturbed = Number.isFinite(base) ? (base === 0 ? 1 : base * 1.1 + 0.123) : 1;
        setCells(sheet, [[dep, String(perturbed)]]);
        const after = getValue(sheet, cell);
        setCells(sheet, [[dep, originalInput]]);
        const changed = !(
          typeof after === "number" && typeof before === "number" && Math.abs(after - before) <= 1e-9
        );
        if (!changed) hardcoded.push({ cell, dep });
      }
    }
  }
  return {
    total: refs.length,
    correct: refs.length - misses.length,
    misses,
    hardcoded,
    pass: misses.length === 0 && hardcoded.length === 0,
  };
}

function seededDrillSheet(drill) {
  const s = createSheet(drill.id);
  setCells(s, drill.starting);
  return s;
}

function CfiDrillRunner({ drill, done, onExit, onPassed }) {
  // The engine sheet is the designed-mutable model; `version` is the render
  // signal (SheetTool's own convention). The object is only REPLACED on reset.
  const [sheet, setSheet] = useState(() => seededDrillSheet(drill));
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState(null);
  const [hintsShown, setHintsShown] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const hints = drill.hints ?? [];

  const edit = (ref, input) => {
    setCells(sheet, [[ref, input === "" ? null : input]]);
    setResult(null);
    setVersion((v) => v + 1);
  };
  const reset = () => {
    setSheet(seededDrillSheet(drill));
    setResult(null);
    setVersion((v) => v + 1);
  };
  const check = () => {
    const r = gradeCfiDrill(sheet, drill);
    setResult(r);
    setVersion((v) => v + 1); // perturbation ran through the sheet
    if (r.pass) onPassed({ completedAt: new Date().toISOString(), cells: r.total, usedModelAnswer: showAnswer, hintsUsed: hintsShown });
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto" }}>
      <button className="btn-ghost fadein" onClick={onExit} style={{ marginBottom: 18 }}><Icon name="arrowL" size={14} /> All drills</button>

      <div className="glass fadein" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span className="badge badge-primary">CFI drill</span>
          <span className="badge badge-muted"><Icon name="clock" size={11} color="var(--text-3)" /> ~{drill.minutes} min</span>
          {done && <span className="badge badge-green">Completed</span>}
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--text-1)", marginBottom: 10 }}>{drill.title}</div>
        <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.7 }}>{drill.scenario}</p>
      </div>

      <div className="glass fadein" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ marginBottom: 10 }}><span className="section-label">Your task</span></div>
        <ol style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          {drill.task.map((t, i) => (
            <li key={i} style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.6 }}>{t}</li>
          ))}
        </ol>
      </div>

      <div className="glass fadein" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span className="section-label">Model workspace</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-ghost" onClick={reset}><Icon name="rotate" size={13} /> Reset to inputs</button>
            <button className="btn-primary" onClick={check}><Icon name="circleCheck" size={14} color="#fff" /> Check my model</button>
          </div>
        </div>
        <MiniSheetGrid sheet={sheet} version={version} onEdit={edit} />
        {result && (
          <div style={{ marginTop: 14, padding: "14px 16px", borderRadius: "var(--r-md)", background: result.pass ? "var(--green-dim)" : "var(--gold-dim)", border: `1px solid ${result.pass ? "var(--green-ring)" : "var(--gold-ring)"}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: result.pass ? "var(--green-2)" : "var(--gold-2)", marginBottom: result.pass ? 0 : 8 }}>
              {result.pass
                ? `Model verified — all ${result.total} output cells within tolerance, and every checked formula responds to its inputs.`
                : `${result.correct}/${result.total} output cells match.`}
            </div>
            {result.misses.length > 0 && (
              <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.7 }}>
                Off-target: {result.misses.map((m) => `${m.ref} (now ${formatValue(m.actual) || "empty"})`).join(", ")}. Expected values stay hidden — that is the model.
              </div>
            )}
            {result.hardcoded.length > 0 && (
              <div style={{ fontSize: 12.5, color: "var(--red-2)", lineHeight: 1.7 }}>
                {result.hardcoded.map((h) => `${h.cell} does not respond when ${h.dep} changes — it must reference it, not hardcode the number.`).join(" ")}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="glass fadein" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: hintsShown > 0 ? 10 : 0 }}>
          <span className="section-label">Hints ({hintsShown}/{hints.length} revealed)</span>
          {hintsShown < hints.length && (
            <button className="btn-ghost" onClick={() => setHintsShown((n) => n + 1)}><Icon name="lightbulb" size={13} /> Reveal a hint</button>
          )}
        </div>
        {hints.slice(0, hintsShown).map((h, i) => (
          <div key={i} style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, padding: "8px 12px", borderLeft: "3px solid var(--gold-ring)", marginTop: 8 }}>{h}</div>
        ))}
      </div>

      {(result?.pass || done) && (
        <div className="glass fadein" style={{ padding: 20, marginBottom: 16, borderLeft: "3px solid var(--green-ring)" }}>
          <div style={{ marginBottom: 8 }}><span className="section-label">Interview angle</span></div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)", lineHeight: 1.6, marginBottom: 10 }}>{drill.interviewAngle}</p>
          <p style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.7 }}>{drill.modelAnswer}</p>
        </div>
      )}

      <div className="glass fadein" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="section-label">Reference solution</span>
          <button className="btn-ghost" onClick={() => setShowAnswer((s) => !s)}>{showAnswer ? "Hide" : "Show"} the answer key</button>
        </div>
        {showAnswer && (
          <div style={{ marginTop: 12, maxHeight: 260, overflow: "auto" }}>
            {Object.entries(drill.solution).map(([ref, formula]) => (
              <div key={ref} className="mono" style={{ fontSize: 12.5, color: "var(--text-2)", padding: "3px 0" }}>
                <span style={{ color: "var(--primary-2)", fontWeight: 700 }}>{ref}</span> {formula}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CfiDrillsTool({ state, dispatch }) {
  const [activeDrillId, setActiveDrillId] = useState(null);
  const assessment = useMemo(() => {
    try { return skillsAssessment("cfi"); } catch { return null; }
  }, []);
  const doneMap = state?.tools?.cfiDrills ?? {};

  const drill = activeDrillId ? CFI_DRILLS.find((d) => d.id === activeDrillId) : null;
  if (drill) {
    return (
      <CfiDrillRunner
        key={drill.id}
        drill={drill}
        done={doneMap[drill.id]}
        onExit={() => setActiveDrillId(null)}
        onPassed={(summary) =>
          dispatch((prev) => ({
            ...prev,
            tools: { ...(prev.tools ?? {}), cfiDrills: { ...(prev.tools?.cfiDrills ?? {}), [drill.id]: summary } },
          }))}
      />
    );
  }

  const totalMinutes = assessment?.totalMinutes ?? CFI_DRILLS.reduce((a, d) => a + (d.minutes ?? 0), 0);
  const doneCount = CFI_DRILLS.filter((d) => doneMap[d.id]).length;

  return (
    <div style={{ padding: "40px 48px", maxWidth: 760, margin: "0 auto" }}>
      <h1 className="fadein" style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)", marginBottom: 6 }}>CFI Modeling Drills</h1>
      <p className="fadein" style={{ fontSize: 13.5, color: "var(--text-2)", marginBottom: 14, lineHeight: 1.6 }}>
        {assessment?.note ?? "FMVA is a skills credential: you are assessed on whether the model you build is right."} {CFI_DRILLS.length} drills · ~{totalMinutes} minutes total · {doneCount} completed.
      </p>
      <div className="glass fadein" style={{ padding: "12px 16px", marginBottom: 18, fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.6, borderLeft: "3px solid var(--gold-ring)" }}>
        {CFI_DISCLAIMER}
      </div>
      <div className="fadein" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {CFI_DRILLS.map((d) => {
          const done = doneMap[d.id];
          return (
            <button key={d.id} className="glass glass-btn" onClick={() => setActiveDrillId(d.id)} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", textAlign: "left", width: "100%", borderLeft: `3px solid ${done ? "var(--green-ring)" : "var(--primary-ring)"}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-1)" }}>{d.title}</span>
                  {done && <span className="badge badge-green">Done</span>}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{d.scenario}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 6, display: "flex", gap: 12 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Icon name="clock" size={11} color="var(--text-3)" />~{d.minutes} min</span>
                  <span>{Object.keys(d.expected).length} graded cells</span>
                </div>
              </div>
              <Icon name="chevR" size={16} color="var(--text-3)" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── GUIDED LESSONS ───────────────────────────────────────────
   View "guided". Mounts the components/guide panel next to a workspace bound
   to the SAME toolState object the lib/guide runner grades, so "Check my
   work" judges exactly what is on screen. Each step that carries its own
   checkpoint re-seeds the workspace on entry (the lesson authors' stated
   convention — e.g. excel-xlookup step 4 seeds row 102); steps without one
   keep the learner's running state. */

const PIVOT_AGGS = ["count", "sum", "average", "min", "max", "countUnique"];
const PIVOT_SHOW_AS = [
  ["", "No calculation (raw values)"],
  ["percentOfRowTotal", "% of Row Total"],
  ["percentOfColumnTotal", "% of Column Total"],
  ["percentOfGrandTotal", "% of Grand Total"],
];

const guideSelect = {
  padding: "6px 8px", borderRadius: "var(--r-sm)", background: "var(--glass-fill)",
  border: "1px solid var(--glass-border-2)", color: "var(--text-1)", fontSize: 12.5,
  fontFamily: "var(--font-body)",
};
const guideInput = { ...guideSelect, outline: "none" };

/** Header fields of the pivot source range (best effort — [] on any error). */
function pivotSourceFields(sheet, sourceRange) {
  try {
    const grid = getRangeValues(sheet, sourceRange);
    return (grid?.[0] ?? []).map((v) => String(v ?? "")).filter(Boolean);
  } catch {
    return [];
  }
}

function GuidePivotEditor({ toolState, setToolState }) {
  const sheet = toolState.sheets[toolState.active ?? Object.keys(toolState.sheets)[0]];
  const defaultRange = usedRangeOf(sheet);
  const pivot = toolState.pivot;
  const sourceRange = pivot?.sourceRange ?? defaultRange;
  const spec = pivot?.spec ?? { rows: [], cols: [], values: [], filters: {} };
  const value = spec.values?.[0] ?? null;
  const fields = pivotSourceFields(sheet, sourceRange);

  const apply = (nextPatch, topPatch = {}) => {
    setToolState({
      ...toolState,
      pivot: {
        sourceRange,
        ...(pivot ?? {}),
        ...topPatch,
        spec: { rows: [], cols: [], values: [], filters: {}, ...spec, ...nextPatch },
      },
    });
  };

  let preview = null;
  if (pivot && (spec.rows?.length || spec.cols?.length) && spec.values?.length) {
    try {
      preview = pivotToGrid(pivotFromGrid(getRangeValues(sheet, sourceRange), spec));
    } catch {
      preview = null;
    }
  }

  return (
    <div className="glass" style={{ padding: 16, marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span className="section-label">Pivot builder</span>
        {pivot && <button className="btn-ghost" onClick={() => setToolState({ ...toolState, pivot: null })}>Remove pivot</button>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <label style={{ fontSize: 11.5, color: "var(--text-3)", display: "flex", flexDirection: "column", gap: 4 }}>
          Source range
          <input className="mono" style={{ ...guideInput, width: 110 }} value={sourceRange}
            onChange={(e) => apply({}, { sourceRange: e.target.value })} />
        </label>
        <label style={{ fontSize: 11.5, color: "var(--text-3)", display: "flex", flexDirection: "column", gap: 4 }}>
          Rows
          <select style={guideSelect} value={spec.rows?.[0] ?? ""} onChange={(e) => apply({ rows: e.target.value ? [e.target.value] : [] })}>
            <option value="">(none)</option>
            {fields.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 11.5, color: "var(--text-3)", display: "flex", flexDirection: "column", gap: 4 }}>
          Columns
          <select style={guideSelect} value={spec.cols?.[0] ?? ""} onChange={(e) => apply({ cols: e.target.value ? [e.target.value] : [] })}>
            <option value="">(none)</option>
            {fields.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 11.5, color: "var(--text-3)", display: "flex", flexDirection: "column", gap: 4 }}>
          Value field
          <select style={guideSelect} value={value?.field ?? ""}
            onChange={(e) => apply({ values: e.target.value ? [{ field: e.target.value, agg: value?.agg ?? "count", ...(value?.showAs ? { showAs: value.showAs } : {}) }] : [] })}>
            <option value="">(none)</option>
            {fields.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 11.5, color: "var(--text-3)", display: "flex", flexDirection: "column", gap: 4 }}>
          Aggregation
          <select style={guideSelect} value={value?.agg ?? "count"} disabled={!value}
            onChange={(e) => apply({ values: [{ ...value, agg: e.target.value }] })}>
            {PIVOT_AGGS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 11.5, color: "var(--text-3)", display: "flex", flexDirection: "column", gap: 4 }}>
          Show values as
          <select style={guideSelect} value={value?.showAs ?? ""} disabled={!value}
            onChange={(e) => {
              const { showAs: _drop, ...rest } = value ?? {};
              apply({ values: [e.target.value ? { ...rest, showAs: e.target.value } : rest] });
            }}>
            {PIVOT_SHOW_AS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </label>
      </div>
      {preview && (
        <div style={{ marginTop: 12, overflow: "auto", maxHeight: 240, border: "1px solid var(--glass-border)", borderRadius: "var(--r-sm)" }}>
          <table style={{ borderCollapse: "collapse" }}>
            <tbody>
              {preview.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className="mono" style={{ border: "1px solid var(--glass-border)", padding: "3px 8px", fontSize: 12, color: r === 0 || c === 0 ? "var(--text-1)" : "var(--text-2)", fontWeight: r === 0 || c === 0 ? 600 : 400, whiteSpace: "nowrap" }}>
                      {typeof cell === "number" ? formatValue(Math.round(cell * 10000) / 10000) : String(cell ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {value?.showAs && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--text-3)" }}>
          showAs percentages come back as fractions (0.5625 = 56.25%) — that is the engine contract, not a bug.
        </div>
      )}
    </div>
  );
}

function usedRangeOf(sheet) {
  return sheet.maxRow >= 0 ? `A1:${cellRefOf(sheet.maxRow, sheet.maxCol)}` : "A1:A1";
}

/**
 * The guided-lesson surface: it drives the REAL tools (SheetTool / VizTool),
 * grades the learner's actual work through the lib/guide runner, and in guided
 * mode spotlights the current step and advances itself. Instructions-mode
 * lessons keep the manual Check button and no spotlight.
 *
 * @param {Object} props
 * @param {string} props.guidedId
 * @param {Function} props.onExit
 * @param {Function} [props.onRecordComplete] (lessonId, score) => void
 * @param {Function} [props.onStepInfo] ({index, id, label}) => void — lifts the
 *   current step so the voice widget can name it.
 * @param {boolean} [props.voiceEnabled] per-lesson voice switch value.
 * @param {Function} [props.onVoiceToggle] (bool) => void
 * @param {Object} [props.lesson] test-only override for LESSONS_BY_ID[guidedId].
 */
export function GuidedLessonView({
  guidedId, onExit, onRecordComplete, onStepInfo, voiceEnabled = true, onVoiceToggle, lesson: lessonProp,
}) {
  const lesson = lessonProp ?? LESSONS_BY_ID[guidedId] ?? null;
  const guided = lesson?.mode !== "instructions"; // default "guided"
  // One runner per mount (the host keys this component by guidedId).
  const [runner] = useState(() => (lesson && GUIDE.available ? GUIDE.createRunner(lesson) : null));
  const [seedError, setSeedError] = useState("");
  const [toolState, setToolState] = useState(() => {
    if (!lesson) return null;
    try {
      return startingState(lesson, 0, GUIDE_RESOURCES).toolState;
    } catch {
      return null;
    }
  });
  // Bumped on every tool-state change; GuidePanel re-grades the current step
  // each time it moves.
  const [toolVersion, setToolVersion] = useState(0);
  // Remount key for the real SheetTool: only bumps when a step RE-SEEDS the
  // workbook, so ordinary edits never blow away the learner's grid.
  const [seedKey, setSeedKey] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [summary, setSummary] = useState(null);
  const [cleared, setCleared] = useState(false);
  const workspaceRef = useRef(null);
  const clearTimerRef = useRef(null);

  // A render-time mirror so the (stable) grader and rect resolver always read
  // the latest tool state without re-subscribing effects.
  const toolStateRef = useRef(toolState);
  toolStateRef.current = toolState;

  const normSteps = useMemo(
    () => (lesson?.steps ?? []).map((s, i) => normalizeStep(s, i)),
    [lesson]
  );
  const curStep = normSteps[stepIndex] ?? null;

  useEffect(() => {
    onStepInfo?.({
      index: stepIndex,
      id: normSteps[stepIndex]?.id ?? null,
      label: normSteps[stepIndex]?.spotlightLabel ?? normSteps[stepIndex]?.title ?? null,
    });
  }, [stepIndex, normSteps, onStepInfo]);

  // Speak the current step when voice is on for this guided lesson. The bridge
  // (window.coop.voice) is resolved here and passed in; narration.js stays pure
  // and goes quiet when no bridge or no voice is available.
  useEffect(() => {
    if (!guided || !voiceEnabled) return;
    const bridge = typeof window !== "undefined" ? window.coop?.voice ?? null : null;
    speakStep(curStep, { bridge, enabled: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, guided, voiceEnabled]);

  useEffect(() => () => { if (clearTimerRef.current) clearTimeout(clearTimerRef.current); }, []);

  // Stable: the grader always reads the current tool state via the ref.
  const handleCheck = useCallback(() => {
    if (!runner || !toolStateRef.current) throw new Error("The lesson runner isn't ready.");
    return runner.submit(toolStateRef.current);
  }, [runner]);

  // Live tool-state observers. Memoized so the tools' onStateChange effects do
  // not re-fire every render (which would loop).
  const handleSheetState = useCallback((s) => {
    setToolState((prev) => (prev && prev.tool === "sheet" ? { ...prev, active: s.active, sheets: s.sheets } : prev));
    setToolVersion((v) => v + 1);
  }, []);
  const handleVizSpec = useCallback((nextSpec) => {
    setToolState((prev) => (prev && prev.tool === "viz" ? { ...prev, spec: nextSpec } : prev));
    setToolVersion((v) => v + 1);
  }, []);
  const handlePivotState = useCallback((next) => {
    setToolState(next);
    setToolVersion((v) => v + 1);
  }, []);

  // Resolve a sheet cell to a viewport rectangle for the spotlight. Returns
  // null under the test harness (no layout) rather than throwing.
  const resolveSheetCellRect = useCallback((ref, sheetName) => {
    try {
      if (typeof document === "undefined") return null;
      const cur = toolStateRef.current;
      if (sheetName && cur?.active && sheetName !== cur.active) return null;
      const p = parseRef(ref);
      if (!p) return null;
      const scope = workspaceRef.current || document;
      const viewport = scope.querySelector('[data-guide-target="sheet-grid"]');
      if (!viewport || typeof viewport.getBoundingClientRect !== "function") return null;
      const vp = viewport.getBoundingClientRect();
      if (!vp.width && !vp.height) return null; // no layout (happy-dom)
      const cell = rangeRect({ top: p.row, left: p.col, bottom: p.row, right: p.col }, undefined);
      // Bring an off-screen cell into view, then read the settled scroll.
      const relTop = cell.top - viewport.scrollTop;
      if (relTop < HEADER_HEIGHT) viewport.scrollTop = cell.top - HEADER_HEIGHT;
      else if (relTop + cell.height > vp.height) viewport.scrollTop = cell.top + cell.height - vp.height;
      const relLeft = cell.left - viewport.scrollLeft;
      if (relLeft < 0) viewport.scrollLeft = cell.left;
      else if (relLeft + cell.width > vp.width) viewport.scrollLeft = cell.left + cell.width - vp.width;
      return {
        top: vp.top + cell.top - viewport.scrollTop,
        left: vp.left + cell.left - viewport.scrollLeft,
        width: cell.width,
        height: cell.height,
      };
    } catch {
      return null;
    }
  }, []);

  const handleStepChange = (step, index) => {
    if (index > stepIndex) {
      // Brief success beat as the step clears and the next one seeds.
      setCleared(true);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => setCleared(false), 900);
    }
    setStepIndex(index);
    try { runner?.goTo?.(index); } catch { /* stay on the session's own step */ }
    // Only re-seed when this step carries its OWN checkpoint (a clean entry
    // point). A step without one continues from the learner's running state.
    const found = checkpointForStep(lesson, index);
    if (found && found.stepIndex === index && index > 0) {
      try {
        setToolState(materializeCheckpoint(found.checkpoint, GUIDE_RESOURCES));
        setToolVersion((v) => v + 1);
        setSeedKey((k) => k + 1);
        setSeedError("");
      } catch (e) {
        setSeedError(e?.message ?? "Couldn't seed this step's starting state.");
      }
    }
  };

  const handleComplete = ({ lessonId, score }) => {
    setSummary({ score });
    onRecordComplete?.(lessonId ?? lesson.id, score);
  };

  if (!lesson) {
    return (
      <div style={{ padding: 40 }}>
        <div className="glass" style={{ padding: 24, maxWidth: 640, margin: "0 auto" }}>
          That guided lesson doesn&apos;t exist.
          <button className="btn-ghost" onClick={onExit} style={{ marginTop: 12 }}><Icon name="arrowL" size={14} /> Back</button>
        </div>
      </div>
    );
  }

  const sheetTarget = curStep?.target?.kind === "sheet-cell"
    ? { ref: curStep.target.ref, sheet: curStep.target.sheet }
    : null;

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 20, padding: "28px 32px", minHeight: "100vh" }}>
      <div ref={workspaceRef} style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <button className="btn-ghost" onClick={onExit}><Icon name="arrowL" size={14} /> Back to lesson</button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lesson.title}</div>
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>{lesson.tool === "viz" ? "Viz workspace" : "Spreadsheet workspace"} · graded by the real engine</div>
          </div>
          {guided && lesson.voice === true && (
            <button
              className="btn-ghost"
              onClick={() => onVoiceToggle?.(!voiceEnabled)}
              aria-pressed={voiceEnabled}
              title="Nexus Voice for this lesson"
            >
              {voiceEnabled ? "Voice on" : "Voice off"}
            </button>
          )}
        </div>

        {cleared && (
          <div className="badge badge-primary scalein" style={{ marginBottom: 10 }} aria-live="polite">
            Step cleared
          </div>
        )}

        {summary && (
          <div className="glass fadein" style={{ padding: 16, marginBottom: 14, borderColor: "var(--green-ring)", background: "var(--green-dim)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--green-2)" }}>Lesson complete — score {summary.score}/100.</div>
            <button className="btn-primary" onClick={onExit}>Back to the lesson</button>
          </div>
        )}
        {seedError && (
          <div className="glass" style={{ padding: "10px 14px", marginBottom: 12, fontSize: 12.5, color: "var(--red-2)", border: "1px solid var(--red-ring)" }} role="alert">{seedError}</div>
        )}

        {!toolState && (
          <div className="glass" style={{ padding: 20, fontSize: 13.5, color: "var(--text-2)" }}>
            This lesson&apos;s starting state couldn&apos;t be built, so there is nothing to work in. (The guide panel still shows the steps.)
          </div>
        )}
        {toolState?.tool === "sheet" && (
          <div>
            <SheetTool
              key={`sheet-${seedKey}`}
              seed={toolState}
              onStateChange={handleSheetState}
              targetRef={sheetTarget}
            />
            <GuidePivotEditor toolState={toolState} setToolState={handlePivotState} />
          </div>
        )}
        {toolState?.tool === "viz" && (
          <VizTool
            csvText={HMDA_CSV}
            spec={toolState.spec}
            onSpecChange={handleVizSpec}
          />
        )}

        {guided && curStep && (
          <SpotlightOverlay
            target={curStep.target}
            label={curStep.spotlightLabel}
            instruction={curStep.instruction}
            active={!summary}
            animate
            containerRef={workspaceRef}
            resolveRect={resolveSheetCellRect}
          />
        )}

        <StepCelebration show={cleared} intensity={1} />
      </div>

      <div style={{ width: 350, flexShrink: 0, position: "sticky", top: 20 }}>
        <GuidePanel
          lesson={lesson}
          onCheck={handleCheck}
          onComplete={handleComplete}
          onStepChange={handleStepChange}
          autoAdvance={guided}
          autoGradeSignal={toolVersion}
        />
      </div>
    </div>
  );
}
