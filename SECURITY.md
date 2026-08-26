# Security

This app is a study tool that holds your API key and listens to your microphone,
so it is worth being precise about where things go.

## Reporting a problem

Open a [security advisory](https://github.com/MrWhosNexus/coop-prep-app/security/advisories/new),
or a normal issue if it isn't sensitive. It's a study app maintained by a fellow
in a cohort — expect a human, not a security team.

## What leaves your computer

Only three things, and each one is something you started:

| What | When | Where to |
|---|---|---|
| Speech-model weights (~165 MB, once) | The first time you use voice, or `npm run voice:fetch` | huggingface.co |
| Your AI prompts | Only when you use an AI feature, with an endpoint you configured | The endpoint **you** chose |
| An update check | Settings → Updates, at most hourly | github.com |

There is **no** account, analytics, crash reporting, or telemetry. There is no
server component. Your notes, progress, exam history and settings are files on
your own disk.

## Where your API key lives

Your key is stored by the desktop app's main process at
`<app data>/endpoints.json`, written atomically with `0600` permissions in a
`0700` directory — owner-only, on every platform that has POSIX permissions.

The part of the app you look at (the renderer — a web page) **never receives it**:

- The page can list endpoints, but the list it gets back is key-free by
  construction. Only one function resolves a key-bearing record, and its result
  is passed straight into the code that makes the request; nothing that returns a
  key crosses back over the bridge.
- The AI request is made by the main process, not the page. The page asks
  "call this endpoint with these messages" and receives text.
- Error messages are redacted before they cross back, so a provider echoing your
  key into an error does not put it on your screen or in a log.

This is enforced by tests, not just by convention: the suite scans every source
file in the repo for any code path that reads a credential from the environment,
puts an `Authorization` header on a request from the page, reads a key back out of
browser storage, or logs one. New files fail that scan until a human writes down
why they are allowed.

**The key is never in a `.env` file or in this repository.** `.gitignore` covers
`.env*` and `*.pem` regardless, and this repo's entire history has been checked
for committed credentials.

## How the desktop app is locked down

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`,
  `webSecurity: true` on every window.
- A strict Content-Security-Policy on every response. In packaged builds
  `script-src` is `'self'` plus a SHA-256 hash for each inline script that
  shipped, so **no remote script origin is ever admitted** and nothing that isn't
  byte-identical to what was built will run. `connect-src` is `'self'` — the page
  cannot reach the network at all.
- The preload script exposes a small hand-written allowlist of functions. Never
  `ipcRenderer`, never `require`, never `process`.
- In-window navigation is restricted to the app's own files; external links open
  in your real browser instead.
- Microphone is the only permission granted; every other permission request is
  denied.
- The app listens on no ports and runs no server.
- The one place it starts another program passes arguments as a list (never
  through a shell) and strips secrets from that program's environment.

## The updater

An auto-updater downloads code and runs it, so this one is deliberately narrow:

- **The feed is pinned in source** to this one GitHub repository. It cannot be
  changed by config, an environment variable, or the update metadata itself.
- **Nothing downloads or installs on its own.** Automatic download and
  install-on-quit are both switched off; every step needs a click.
- **Downloads are integrity-checked** against the SHA-512 in the release metadata,
  fetched over HTTPS from GitHub — the same trust root you used to install the app.
- **Nothing from the feed reaches the app's UI.** Release notes are
  attacker-influenceable HTML, so they are never rendered; the app links to
  GitHub. Every URL it opens is rebuilt from the pinned repository name plus a
  version string validated as a semver — never a URL the feed supplied.
- **macOS and `.deb` installs are check-only.** macOS refuses to apply updates to
  unsigned apps, and it fails *after* the download and restart. The app decides
  this up front and shows a download link instead of a button that would lie.

## Known, accepted issues

**Builds are unsigned.** No Apple Developer ID and no Windows code-signing
certificate, so macOS and Windows warn on first launch. The mitigation is that
every release is built by a public GitHub Actions workflow from the source in this
repo, and publishes verifiable checksums.

**Three `npm audit` advisories, all one chain.** `sharp` (an image library) has
libvips CVEs with no fixed version available; it is pulled in by
`@huggingface/transformers`, which the voice stack uses for **audio only**. The
vulnerabilities are in image decoders, and this app never hands `sharp` an image —
no code path calls it. Tracked, and it goes away when the upstream dependency
updates. Every other advisory reported at the 0.2.0 release was fixed.

**`react-hooks` lint findings.** The React Compiler lint rules report 28 findings
in existing UI components. They are code-quality signals, not vulnerabilities, and
predate this release; CI reports them without blocking.
