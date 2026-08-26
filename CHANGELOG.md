# Changelog

Every released version, newest first. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [Semantic Versioning](https://semver.org/).

The app checks this repo's Releases page for new versions — see **Settings → Updates**.
If you hit a bug or want something added, open an issue; fixes ship here.

## [Unreleased]

Nothing yet. Open an issue and it can go here.

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
