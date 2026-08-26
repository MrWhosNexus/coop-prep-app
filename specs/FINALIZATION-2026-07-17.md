# Coop Prep — Finalization Spec

**Deadline:** 2026-07-17, 09:00 (hard)
**Baseline commit:** 47913e1 (`main`)
**Method:** SAW (Safe Agentic Workflow) departments, superpowers brainstorming (this doc is the design output), stop-slop on all prose, verify/drive-the-app as the real gate.
**Ship target:** feature-complete in dev. No packaging (no icons, no signing, no macOS build). No push — commit stays local for the author's call.

---

## 1. Stop-the-Line gate (satisfied)

Acceptance criteria exist below, so implementation may begin. No department invents requirements; gaps route back to this spec.

## 2. Scope

### In
- **Animation, all three tiers.** (1) Rich per-lesson walkthrough: spotlight animates between targets, callouts slide and pulse in, a step-complete beat, optional per-step voice narration. (2) Subtle polish underneath: smooth spotlight transitions, a gentle target pulse. (3) First-run animated guided intro tour across tools, games, and voice.
- **Content.** Game-based guided lessons that drive the five real games (ErrorHunt, FormulaBuilder, MatchGame, RapidFire, RecallDrill). Instructions-only lesson variants so that mode ships real content. New Excel and Tableau lessons beyond the current 11/8/2.
- **Engine.** Fix the `LOG10` tokenizer in `lib/sheet/parser.js` — but only if the fix proves zero regressions against the full sheet suite first. Otherwise revert and leave deferred, honestly documented.
- **Integration.** Give `components/sheet/PivotBuilder.js` `initialSpec`/`onSpecChange` and retire the parallel `GuidePivotEditor` workaround (`Dashboard.js:2602`).
- **Cleanup.** Prune dead `GuideSheetWorkspace` / `GuideVizWorkspace` (`Dashboard.js:2153,2188`). Remove stale "not wired yet" text (`electron/ipc/handlers.js:87,90,109`) — the real deps are wired in `main.js`.

### Out
- Packaging: app icons, `build/` resources, Windows signing, macOS target/notarization.
- Installing voice deps here (no network in the build env). Voice code is already done and wired; it degrades honestly without the packages.

### Author's action (not a build task)
- Run `npm install` on a networked machine to pull `kokoro-js` + `@huggingface/transformers`, then a first-run ~165 MB model download activates local voice.

## 3. Acceptance criteria (the gate — all must hold every pass)

1. Full test suite green, 0 fail (baseline 52 files plus new tests).
2. `next build` clean.
3. App driven live (QAS, not tests alone): a guided lesson runs end to end with animation; a game-based lesson runs; an instructions-only lesson runs; new lessons load and grade; pivot integration works through the real `PivotBuilder`; the intro tour plays. Evidence captured.
4. `LOG10` fix merges only with proof of zero sheet-suite regression; else it is absent and the limitation stays documented.
5. No API key reaches the renderer. Voice degrades to a notice when deps or models are absent.
6. All authored prose clears the stop-slop bar.
7. Dead code pruned. No stale "not wired" text.
8. Committed to `main` with evidence attached. Not pushed. Not packaged.

## 4. Departments (SAW roles → model · effort)

| Model · effort | Departments | Owns |
|---|---|---|
| **Opus · high** | System Architect + BSA + hardest implementer | This spec, the animation-engine API and lesson-schema extensions, Dashboard integration, PivotBuilder `initialSpec`/`onSpecChange`, intro-tour orchestration, the gated LOG10 parser fix, Stage-1 pattern review |
| **Sonnet · high** | FE-devs (×N), BE-dev, QAS (gate), Security | Animation components (callout, celebration, pulse), narration hookup, game-lesson UI wiring, intro-tour UI, electron/IPC touches, stub-text cleanup; QAS drives the app and holds the gate; Security audits key-safety + honest-degrade |
| **Haiku · high** | Content Engineers (×N), DPE | Author game-based lessons, instructions-only variants, new Excel + Tableau lessons against the schema; fixtures and seed data |
| **Fable · low** | Tech Writer + Weaver, RTE | grep/combine cross-file seams, stop-slop consistency pass, update `docs/GUIDED-TUTORIAL.md`, prune dead code, build + test gate, commit with evidence |

QAS and Security are never collapsed and never self-review — SAW independence gates. QAS has iteration authority: it bounces work back to the owner until green.

## 5. Task graph and gates

```
Phase 0  Architect/BSA (Opus)
         → shared CONTRACTS doc: animation API, lesson-schema deltas,
           file-ownership table, stop-slop rules, AC restated
         GATE: stop-the-line — AC present → proceed
              │
Phase 1  Implementation (parallel, disjoint file ownership)
         Opus:   animation engine, Dashboard/PivotBuilder integration,
                 intro-tour orchestration, LOG10 (own sub-gate)
         Sonnet: animation UI components, narration, game-lesson wiring,
                 intro-tour UI, IPC, stub cleanup
         Haiku:  game lessons, instructions-only variants, new lessons, fixtures
              │
         GATE: LOG10 sub-gate — zero-regression proof or revert
              │
Phase 2  QAS gate (Sonnet, independent)  ── bounce-back loop ──┐
         + Security audit (Sonnet, independent)                │
              │  all AC pass                                    │
              └───────────────────────────────────────────────┘
Phase 3  Weave (Fable): grep/combine, stop-slop pass, docs,
         dead-code prune, build gate, commit with evidence
```

## 6. Coordination rules

- **Disjoint file ownership.** Each agent owns a file set; no two write the same file. The Architect's CONTRACTS doc assigns ownership before Phase 1.
- **Search First, Reuse Always.** Reuse the existing `SpotlightOverlay`, grader/runner engine, and lesson schema. The animation layer wraps them; it does not replace them.
- **Evidence, not "trust me."** Every department returns concrete evidence — test output, a driven-app observation, a screenshot path.

## 7. Risks

- **happy-dom has no layout or RAF.** Tests cannot see animation. Keep animation logic in a pure, testable state machine; render visuals through CSS transitions; verify motion by driving the app (QAS), consistent with the "green tests miss real bugs" record.
- **LOG10 touches the tokenizer.** A change can regress the whole formula engine — hence the proof sub-gate.
- **Wide scope against a 09:00 deadline.** Parallelize hard, keep ownership disjoint, run Fable's weave last. Launch the build with enough runway that QAS iteration and the weave finish before 09:00.
- **Voice deps absent in the build env.** Out of the gate by design; it is an author checklist item, and the widget already degrades honestly.
