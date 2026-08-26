# Guided Tutorial + Nexus Voice

How the guided-lesson system works, how to author a lesson, and what stays unfinished.

## The seam

`GuidedLessonView` in `components/Dashboard.js` owns everything: it drives the real
`SheetTool`/`VizTool`, mounts `SpotlightOverlay`, runs the auto-advance watcher, seeds and
re-seeds checkpoints, and mounts `NexusVoiceWidget`. The grader/runner/checkpoint engine
under `lib/guide/*` needs no changes to add or edit a lesson.

Guided lessons run the same spreadsheet and viz tools a learner uses standalone. A lesson
step highlights one region, states one objective, and advances the moment the grader passes.
No "check my work" button in guided mode.

## Lesson fields (see `lib/guide/spec.js`)

Every field below is optional and defaults so older lessons stay valid.

- `mode`: `"guided"` (default) or `"instructions"`. Guided turns on the spotlight and
  auto-advance. Instructions keeps the manual Check button and mounts no overlay.
- `voice`: `true` shows a per-lesson toggle that enables the voice widget for that lesson.
- Per step, `target` points the spotlight:
  - `{ kind: "sheet-cell", ref: "H2", sheet?: "Applicants" }`
  - `{ kind: "selector", selector: "[data-guide-target='sheet-grid']" }`
  - `{ kind: "region", anchor: "viz-columns" }` (anchor equals a `data-guide-target` value)
- Per step, `spotlightLabel` is the objective heading. It defaults to the step title.

### Target the cell the learner ACTS on, not the grader's cell

The grader often verifies a downstream cell. A "fill down" step grades the last row
(`H101`) and a "load the data" step grades the last loaded row (`A101`). The spotlight must
point at the cell the learner touches first (`H2`, `A1`), so name that cell in the
`spotlightLabel` and set `target.ref` to it. `test/lessons-guided-sheet.test.js` enforces
that every sheet-cell target is named in the step's label or instruction.

### DOM anchors

The spotlight resolves `region`/`selector` targets against `data-guide-target` attributes:
`viz-columns`, `viz-rows`, `viz-marks-color`, `viz-marks-size`, `viz-filters`, `viz-showme`,
`viz-fieldlist` (in `components/viz/*`), and `sheet-grid` (in `components/sheet/Grid.js`).
Sheet-cell targets resolve through `resolveSheetCellRect` in `Dashboard.js`, which scrolls
the cell into view and reads its rectangle.

## Nexus Voice

`components/voice/NexusVoiceWidget.js` is a bottom-right widget. It answers questions about
the current work or anything else. The brain reuses `callLLM` over the key-safe `ai:call`
IPC channel, so the API key never reaches the renderer.

The voice layer is local Kokoro TTS + Whisper STT, ported from Nexus into Electron main
(`electron/voice/*`) behind `voice:transcribe` / `voice:speak` / `voice:cancel` IPC. Models
download from HuggingFace on first use (~165 MB, cached under `userData/{tts,stt}-models`).
Without an AI endpoint or the models, the widget degrades to a plain notice instead of
crashing. `lib/voice/engine.js` hides the transport behind a swappable interface.

## Games

`components/games/GameHost.js` accepts optional `objective`, `guided`, and `onAdvance`. In
guided mode a correct answer auto-advances the round. The five game components forward those
props to their host.

## Finalization (2026-07-17)

- **Animated guided spotlight.** The guided-lesson spotlight glides between step targets on the
  GPU (`transform`/`opacity` only, never layout) and the callout slides in per step. The state
  machine is pure (`lib/guide/choreography.js`), the CSS is compositor-first
  (`components/guide/animation.css`), and both honor `prefers-reduced-motion`. `SpotlightOverlay`
  animates only when passed `animate`; the plain geometry path is unchanged.
- **Step celebration.** `components/guide/StepCelebration.js` paints a brief checkmark and
  particle burst when a step clears (transform/opacity only).
- **First-run intro tour.** `components/guide/IntroTour.js` walks the tools, games, and voice
  widget on first launch, gated by a `coop-intro-tour-done` localStorage flag.
- **Per-step narration.** `lib/guide/narration.js` speaks the current step when lesson voice is
  on. It stays pure and resolves the bridge (`window.coop.voice`) in `Dashboard`, so it degrades
  to silence without a bridge and never touches an API key.
- **Game-based guided lessons ship.** `lib/guide/game-lessons.js` + `game-lessons-content.js`
  define curated drills, surfaced in the Practice Games tool under "Guided game lessons" and
  launched with their objective banner over the real game.

## Known limitations

- Voice needs the ~165 MB first-run model download and the native deps (`onnxruntime-node`,
  `sharp`). It runs only in the packaged or `electron:dev` app, never under `node --test`.
  `electron-builder.yml` unpacks the native libs from the asar; skipping that breaks voice in
  the packaged build while dev still works.
- The sheet engine's `=` collapses a range to a scalar (`lib/sheet/evaluate.js` has no
  array/broadcast support), so a boolean-array `SUMPRODUCT(($range=x)*…)` returns `#VALUE!`.
  A SUMPRODUCT lesson built on that pattern was cut for this reason. Direct element-wise
  `SUMPRODUCT(rangeA, rangeB)` is unaffected.
- `components/sheet/PivotBuilder.js` does not expose its spec, so guided pivot steps read
  `pivot` through a `GuidePivotEditor` beside the real grid. Give PivotBuilder
  `initialSpec`/`onSpecChange` for a fuller integration.
- A game-lesson launch currently draws the standard SRS pool with the curated objective;
  filtering the pool by each entry's `config` is a future refinement.

## Fixed since the first release

- `LOG10` (and any function whose name matches the cell-reference pattern) now types correctly:
  the tokenizer treats an identifier immediately followed by `(` as a function name, never a
  cell reference (`lib/sheet/parser.js`, verified by `test/sheet-log10.test.js`).
- `GuideSheetWorkspace` and `GuideVizWorkspace` were removed as dead code. `MiniSheetGrid` still
  backs `CfiDrillsTool`.
