# Coop-Prep — Discovery Audit, 2026-07-20

Read-only audit of a worktree of this repo (branch `sandbox/fix-2026-07-20`, base `6fc2c1e`).
Findings raised by Fable auditors, then each independently attacked by an Opus verifier told to
refute it. Only survivors appear below.

## Build health

| Command | Exit | Verdict |
|---|---|---|
| `npm run build` | 0 | **pass** |
| `npm run lint` | 1 | **fail** — real React Hooks violations, see #2 |
| `npm test` | 1 | **fail** — 18 failures, 11 of them the Windows mode-bit issue (#5) |
| `typecheck` | — | **missing** — no such script exists |

## Ranked issues

### 1. Mobile quiz reintroduces the positional answer tell the desktop deliberately fixed
**severity: high** · `mobile/src/MobileApp.jsx:642`

The mobile build duplicates the lesson-quiz UI but never adopted `lib/quiz-order.js`. Desktop
renders options through `orderedOptions(q, lesson.id)` (`components/Dashboard.js:1194`) precisely
because the authored option order carries a **measured** positional tell: across all 212 questions
the correct answer is never in slot D, and core-curriculum answers are ~59% slot B.

**Failure:** a learner on the mobile build (`npm run build:mobile` is a shipped target) scores
highly by pattern — "never pick D, usually B" — without knowing the material. They feel exam-ready,
then sit a real exam with randomized options. `lib/quiz-order.js` documents this exact failure mode.

This is the most consequential issue in the app: it silently defeats the product's purpose for
mobile users while showing them a passing score.

**Fix:** export `orderedOptions` through the `lib/coop-lib.js` barrel that mobile already imports,
and render `lib.orderedOptions(q, lesson.id).map(...)`. Answers compare by option **text**, so
reordering is safe.

---

### 2. Lint fails on real React Hooks violations
**severity: high** · `components/Dashboard.js`, `components/games/GameHost.js`, others

Not stylistic. Confirmed errors include:

- `Dashboard.js:260` and `:307` — `setState` called synchronously inside an effect
  (`react-hooks/set-state-in-effect`), which can trigger cascading renders.
- `Dashboard.js:2271` — `toolStateRef.current = toolState` **during render**
  (`react-hooks/refs`, "Cannot update ref during render").
- `NexusVoiceWidget.js:386` — a ref passed to a function that may read it during render.
- `SheetTool.js:170` — memoization could not be preserved.

**Fix:** move the `setState` calls into event handlers or `useLayoutEffect` with proper guards;
move ref writes out of the render path.

---

### 3. Superseded voice subsystem is dead code that still looks live
**severity: medium** · `components/voice/NexusVoiceWidget.js:123`

`CompanionWidget.js:6` states it "replaces NexusVoiceWidget", and `Dashboard.js:44` imports only
`CompanionWidget`. Nothing anywhere imports `NexusVoiceWidget`. `lib/voice/engine.js` and
`lib/voice/wakeLoop.js` are imported **only** by that dead widget.

**Failure:** a developer fixing a wake-word bug greps, lands in `NexusVoiceWidget.js` or
`lib/voice/engine.js`, edits them, watches their tests pass — and the shipped app is unchanged,
because the live path is `CompanionWidget → EndpointVoiceProvider`, which *duplicated* rather than
reused the VAD/wake/drag logic.

**Fix:** delete the dead widget, `lib/voice/{engine,wakeLoop,playback}.js`, and their tests — or,
if kept as a fallback, put it behind a flag and comment it as superseded.

---

### 4. `createWakeLoop` start/stop race leaks a live microphone capture
**severity: medium** · `lib/voice/wakeLoop.js:147`

`start()` sets `running=true` then awaits `capture()` (getUserMedia + AudioContext — seconds, while
the OS permission prompt is up). `stop()` only closes `handle`, which is still `null` until that
await resolves, and `start()` never re-checks `running` afterwards. A `stop()` issued mid-`start()`
is a silent no-op and the mic stays hot.

**Failure:** user enables wake word (permission prompt pending), then expands the widget — which
calls `stop()`. The capture completes afterwards and **the microphone remains open** with no UI
indicating it.

Reachable today only through the dead widget in #3, so severity depends on whether #3 is deleted or
revived — if revived, this becomes a live privacy bug.

**Fix:** re-check `running` after the await and close if it flipped; serialize start/stop by storing
the pending start promise.

---

### 5. `packaging.test.js` tripwire is completely inoperative on Windows
**severity: medium** · `test/packaging.test.js:46`

Two independent bugs kill the packaging guard on the platform this repo is developed on:

1. `packagedGlobs()` matches `/^files:\n((?:\s+-\s+.*\n)+)/m`, but `electron-builder.yml` is checked
   out with **CRLF**, so `files:\r\n` never matches.
2. Path comparison uses backslash paths against forward-slash prefixes.

**Failure:** both packaging tests fail spuriously on any Windows checkout. Worse — if someone later
*removes* `lib/endpoints/**/*` from `files:`, the output is **identical to today's**, so the tripwire
cannot signal the regression it exists to catch.

**Fix:** make the regex EOL-tolerant (`\r?\n`, trim `\r`) and normalize walker output to forward
slashes. Pairs with #6.

---

### 6. No `.gitattributes` — CRLF breaks a tripwire mutation and a dataset byte-identity invariant
**severity: medium** · `test/integration.test.js:482`

No `.gitattributes` exists, so Windows clones materialize CRLF. Two consequences:

1. The tripwire-sensitivity test mutates `Dashboard.js` with a regex ending `,\n` — a **no-op** against
   CRLF, so the test silently stops testing anything.
2. The HMDA dataset byte-identity assertion fails (expected `\r\n`, actual `\n`). Any user downloading
   `/data/hmda-sample.csv` from a Windows-built artifact gets a CRLF file.

**Fix:** add `.gitattributes` with `* text=auto eol=lf` (at minimum for `*.js`, `*.yml`, and the CSV)
and renormalize; harden the mutation regex to `\r?\n`.

> **#5 and #6 share one root cause:** the repo has no line-ending policy, and tests encode POSIX
> assumptions. Fix the policy once and both classes of failure go away.

---

### 7. `0600`/`0700` hardening is a silent no-op on Windows — 11 tests permanently red
**severity: low** · `lib/endpoints/store.js:150`

`createFileStorage.write()` enforces mode `0o600` via `writeFileSync({mode})` + `chmodSync`, and the
suite asserts `statSync(...).mode & 0o777 === 0o600`. On win32, chmod only toggles the read-only bit
and stat reports `0666` for any writable file. **11 of the 18 total test failures are this.**

The real cost is desensitization: a developer conditioned to a permanently red suite has no signal
when a genuine regression lands.

**Fix:** gate the POSIX-mode assertions on `process.platform !== 'win32'`, and document in `store.js`
that `0600` is best-effort on Windows (optionally apply an owner-only ACL there).

---

## Explicitly checked and cleared (verifier-refuted)

These were raised and then **killed** on evidence — do not re-raise:

- **`asarUnpack` omits `onnxruntime-web`** — refuted. Unlike nexus, this repo's layout does not
  strand the dependency. (The structurally identical nexus finding *did* survive; the two apps differ.)
- **Companion Artifact Hub wired UI→IPC→disk but non-functional** — refuted; the `onToolCall` no-op
  is a deliberate documented seam, not a break.
- **Unreachable demo-provider branch** in `CompanionWidget.js:273` — refuted; facts correct, not a defect.
- **Next.js workspace-root inference** in `next.config.mjs:7` — refuted.

## Coverage gaps

- **No `typecheck` script exists.** Whole classes of type error are structurally invisible here.
  Adding one is itself a candidate work item.
- **2 of 4 finder dimensions did not complete** (agents wedged and were killed). Missing dimensions
  are absent, not clean.
- Uncommitted edits to `electron-builder.yml` and `package.json` in the source checkout were **not**
  carried into this sandbox. If they are load-bearing, #5 in particular may read differently.
- The built NSIS installer was not launched; no runtime verification of the packaged app.
