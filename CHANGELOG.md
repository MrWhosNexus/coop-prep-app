# Changelog

Every released version, newest first. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [Semantic Versioning](https://semver.org/).

The app checks this repo's Releases page for new versions — see **Settings → Updates**.
If you hit a bug or want something added, open an issue; fixes ship here.

## [Unreleased]

Nothing yet. Open an issue and it can go here.

## [0.3.0] — 2026-08-26

A correctness release. An audit found the app was confidently wrong in several
places — teaching things that were false, and reporting readiness it could not
justify. Everything below was verified by driving the code, not by reading it.

### Fixed — the app was teaching things that are wrong

- **Date arithmetic was wrong by a full year on 17% of spans.** The decimal-years
  lesson taught `DATEDIF(A2,B2,"Y") + MOD(B2-A2,365.25)/365.25`, which adds
  calendar whole years to a remainder measured against 365.25 — two incompatible
  definitions of a year. An exact 12-month span reported 1.999 years. Every
  sample row was under a year, so it was unreachable by the grader. Now
  `(B2-A2)/365.25`, with a >1-year row so a regression is catchable.
- **A correct answer was marked wrong.** The same lesson required `DATEDIF` and
  failed `=B2-A2` — what a competent analyst actually writes.
- **Wrong answers scheduled cards FURTHER out.** Grade 3 meant "pass" to the
  scheduler and "demotion" to every caller. Four "I was unsure" grades walked a
  card to a 23-day interval with lapses stuck at 0. Missing a card now shortens
  its interval and records the lapse.
- **Semantic opposites were graded as near-misses** and counted toward mastery —
  "revocable" for irrevocable, "disparate treatment" for disparate impact,
  "systemic" for systematic risk. These are exactly the distinctions the SIE and
  Series 65 are built on.
- **A visualization lesson shipped six fabricated numbers** that contradicted the
  data, stated a conclusion contradicting its own figures, and could not be
  passed at all. Recomputed from the dataset.
- **Silent auto-passes.** The chart grader dropped unrecognized keys, so two
  dual-axis steps collapsed into the first — finish step 1 and you had "done" a
  dual axis. It now fails loudly.
- **Four-fifths conclusions drawn from groups of three people**, with no caveat
  anywhere in 16 lessons. Small groups are now suppressed and named as such.

### Fixed — the mock exams were passable by guessing

Picking the longest option scored **75.9% on the SIE** (70% passes) and **80.2%
on Series 65** (72% passes). The cause was an authoring habit: correct answers
written as complete justified statements, distractors left terse. Real exams
carry no such signal, so the tell scores 25% on test day and the app was
reporting a confident pass to someone who had learned a formatting artefact.

714 items rewritten. Guessing by length now scores **43%/46%** — 0 of 150 seeded
sittings passable. A test measures this on every run, so the habit cannot return
unnoticed.

Repeated mocks also drew with no memory of prior sittings, so the whole bank was
visible in 6-10 attempts; they now avoid recently-seen items.

### Added — you can ask for the problem without the answer

Every lab now offers two ways in, chosen when you open it:

- **"Walk me through it"** — the original, step by step.
- **"Just give me the problem"** — the business question, no formula, and a
  grader that accepts any route to the right answer.

37 of 60 lab instructions used to contain the finished formula, which made them
typing exercises. Both variants now exist for all 34 lessons across 129 steps.

### Added — six data-governance labs

Profiling, quality rules, completeness, duplicates, standardisation and
reconciliation, on a deliberately dirty extract with the defects a real intake
has: lost leading zeros, four spellings of "missing", numbers stored as text,
near-duplicates, and a second system that disagrees. The standardisation lab is
the one to do: grouping the raw file gives the wrong approval-rate gap, because
"Black", "black" and "BLACK" count as three groups.

### Fixed — doing the hard work no longer costs you

- Guided labs did not advance your streak, so a week on the hardest content in
  the app read as a week of inactivity while clicking "complete" on an 8-minute
  reading did not.
- Hints cost 10% while resubmitting was free and unlimited, so guess-and-check
  strictly dominated asking for help. A blind retry now costs what a hint costs.
- Lessons requiring `$`-pinning arrived six positions before the lesson teaching
  it. The order is now derived from what the graders actually demand.

## [0.2.0] — 2026-08-25

First release built for the cohort rather than for one machine. If you are installing
Coop Prep for the first time, start here.

### Added

- **In-app updates.** Settings now has an Updates panel that checks this repo's
  Releases. Windows and the Linux AppImage install updates in place; macOS and
  `.deb` installs are told a new version exists and sent to the download page,
  because neither can safely rewrite itself (see [SECURITY.md](SECURITY.md)).
- **macOS builds.** `electron-builder.yml` had no `mac:` section at all, so no
  Mac artifact was ever configured. It now produces a `.dmg` and a `.zip` for
  both Apple Silicon and Intel, with the microphone usage string macOS requires
  before it will show a permission prompt.
- **`npm run voice:check`** — downloads the local speech models if they are
  missing, then proves the loop works by speaking a sentence and transcribing it
  back. Use it when the mic button seems dead.
- **`npm run voice:fetch`** — pre-downloads the ~165 MB of speech models so the
  first voice session is instant and works offline.
- **Cross-platform CI.** Tests and the production build now run on Linux, macOS
  and Windows for every push, so a change that only works on one OS is caught
  before anyone installs it.
- **A release workflow.** Tagging `v*` builds installers for all three operating
  systems and publishes them, together with the checksums the updater verifies.
- An app icon. All three platforms derive theirs from one source image.

### Fixed

- **The Windows build could not run at all** from a clean clone: the config
  pointed at `build/icon.ico`, a file that was never committed, and
  electron-builder treats a missing icon as a hard error.
- **Node 22.15 is required, not Node 20.** Three test files use an API that
  only exists from 22.15, so on Node 20 the whole suite died with a message that
  named no version. The new cross-platform CI caught this on its very first run,
  and CI now pins a job to exactly 22.15.0 so the stated minimum stays true.
- **Three tests asserted the wrong thing on Windows** — they compared file paths
  against hardcoded forward-slash strings, which only hold on macOS and Linux.
  Two of those were long-standing: any Windows contributor running the tests
  would have hit them. Nobody had run the suite on Windows until now.
- **A false-failing test** that demanded `onnxruntime-web` be unpacked into every
  build — 91 MB of WebAssembly that the Node build of the voice stack never
  loads. The exemption now re-derives the real module graph on every run, so it
  cannot rot into a blanket excuse.
- Upgraded Next.js to 16.3.3 and patched the dependency tree, clearing 13 of the
  16 advisories `npm audit` reported. The 3 that remain are in an image library
  the audio-only voice stack pulls in but never calls; see
  [SECURITY.md](SECURITY.md).
- Dropped the unused Vite toolchain left behind when the mobile build was
  removed — a smaller install and two fewer advisories.

### Security

- The updater's feed is pinned in source to this one repository, cannot be
  changed at runtime, and never downloads or installs anything without being
  asked. Nothing from the update feed — including release notes — is rendered
  in the app.
- Added [SECURITY.md](SECURITY.md), documenting where your API key is stored,
  what leaves your machine, and what does not.

## [0.1.3] — 2026-08-18

### Changed

- Removed the dead `NexusVoiceWidget` subsystem.

## [0.1.2] — 2026-08-18

### Fixed

- **Path traversal in the companion hub store** — a crafted item could write
  outside the app's own data directory.
- Serialized `save()` and flush writes, closing a race where two rapid saves
  could republish stale content or lose an edit.
- Made the packaging and tripwire guards tolerant of CRLF checkouts, and pinned
  LF line endings via `.gitattributes` so the guards keep working on Windows.

## [0.1.1] — 2026-07-20

### Fixed

- Sandbox and packaging fixes across the Electron suite.

## [0.1.0] — 2026-06-15

Initial build: FINRA exam banks (SIE, Series 65, CFI), the interactive
spreadsheet and visualization labs, guided tutorials, learning games, the
notes and Hustle tools, and the local voice stack.

[Unreleased]: https://github.com/MrWhosNexus/coop-prep-app/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/MrWhosNexus/coop-prep-app/releases/tag/v0.2.0
[0.1.3]: https://github.com/MrWhosNexus/coop-prep-app/releases/tag/v0.1.3
[0.1.2]: https://github.com/MrWhosNexus/coop-prep-app/releases/tag/v0.1.2
[0.1.1]: https://github.com/MrWhosNexus/coop-prep-app/releases/tag/v0.1.1
[0.1.0]: https://github.com/MrWhosNexus/coop-prep-app/releases/tag/v0.1.0
