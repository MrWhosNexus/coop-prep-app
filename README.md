# Coop Prep

A desktop study app for the **COOP Careers Financial Services Fellowship** — FINRA
exam banks (SIE, Series 65, CFI), an interactive spreadsheet lab, a visualization
lab, guided tutorials, learning games, note-taking, job-hunt tools, and a voice
tutor that runs on your own machine.

It runs on **Windows, macOS and Linux**. Everything you do stays on your computer:
there is no account, no server, and no telemetry.

---

## Install

### Download an installer (easiest)

Grab the file for your machine from the [latest release](https://github.com/MrWhosNexus/coop-prep-app/releases/latest):

| You have | Download | First launch |
|---|---|---|
| Windows | `Coop-Prep-Setup-0.3.0.exe` | SmartScreen shows a blue box → **More info** → **Run anyway** |
| Mac (M1/M2/M3/M4) | `Coop-Prep-0.3.0-arm64.dmg` | See "Opening it on a Mac" below |
| Mac (Intel) | `Coop-Prep-0.3.0-x64.dmg` | See "Opening it on a Mac" below |
| Linux | `Coop-Prep-0.3.0-x86_64.AppImage` | `chmod +x` it, then run it |
| Debian/Ubuntu | `Coop-Prep-0.3.0-amd64.deb` | `sudo apt install ./Coop-Prep-*.deb` |

They are large (250–570 MB) because the voice engine ships its own ONNX runtime.

**Never installed something from GitHub before?** [docs/INSTALL.md](docs/INSTALL.md)
walks through it click by click, including the warning screens below.

These builds are **not code-signed** — signing certificates cost money we haven't
spent. That is why your OS warns you. The warning means "nobody paid Apple or
Microsoft to vouch for this", not "this is malware". Every release is built by
[GitHub Actions](.github/workflows/release.yml) straight from the source in this
repo, and each one publishes SHA-512 checksums.

#### Verifying a download

Since nothing is signed, the checksums are the integrity story. Download
`SHA512SUMS-<os>.txt` from the same release and check the file you got:

```bash
shasum -a 512 -c SHA512SUMS-macos-latest.txt
```

On Windows PowerShell:

```powershell
Get-FileHash -Algorithm SHA512 .\Coop-Prep-Setup-0.3.0.exe
```

and compare it against the line in `SHA512SUMS-windows-latest.txt`.

#### Opening it on a Mac

macOS quarantines unsigned downloads. Open the `.dmg`, drag **Coop Prep** to
Applications, then **right-click the app → Open → Open**. Do that once; it opens
normally afterwards. If macOS says the app "is damaged and can't be opened", the
quarantine flag is the cause and this clears it:

```bash
xattr -dr com.apple.quarantine "/Applications/Coop Prep.app"
```

### Or run it from source

You need [Node.js 22.15 or newer](https://nodejs.org). Same three commands on every OS:

```bash
git clone https://github.com/MrWhosNexus/coop-prep-app.git
cd coop-prep-app
npm install
```

Then either:

```bash
npm run electron:dev
```

for the desktop app with live reload, or:

```bash
npm run dev
```

for the browser version at http://localhost:3000 (everything works except the AI
and voice features, which need the desktop shell).

To build your own installer for the machine you're on:

```bash
npm run dist
```

The result lands in `dist-electron/`.

---

## Updates

Open **Settings → Updates**. The app checks this repo's releases at most once an
hour and tells you when there is a newer version.

- **Windows** and the **Linux AppImage** download and install updates in place.
- **macOS** and **`.deb`** installs get told about the update and sent to the
  download page. Neither can safely rewrite itself — macOS only applies updates
  to code-signed apps, and a `.deb` belongs to your package manager.

Nothing downloads or installs without you clicking. See [CHANGELOG.md](CHANGELOG.md)
for what changed in each version.

---

## Voice: the local speech models

The voice tutor uses two models that run **entirely on your machine**:

| | Model | Size |
|---|---|---|
| Speech in | `onnx-community/whisper-base.en` | ~76 MB |
| Speech out | `onnx-community/Kokoro-82M-v1.0-ONNX` | ~88 MB |

They are **not** bundled with the app — they download once, on first use, from
Hugging Face, and are cached in the app's data folder. After that voice works
offline forever. Nothing you say and nothing the app speaks ever leaves your
computer.

Rather than discovering that mid-study-session, pre-download them:

```bash
npm run voice:fetch
```

And if voice ever seems broken, this tells you whether the problem is real. It
speaks a sentence, transcribes it back, and reports what it heard:

```bash
npm run voice:check
```

A healthy machine prints `PASS  local voice works on this machine, offline, end to end.`

The caches live in your app data folder (`voice:check` prints the exact path).
Deleting them is safe — they re-download.

---

## The AI tutor and your API key

The AI features are **bring-your-own-key**. Any OpenAI-compatible or Anthropic
endpoint works — MiniMax, OpenRouter, a local Ollama, whatever you already use.
Add one in **Settings → AI endpoints**.

**Your key is never in this repository, never in a `.env` file, and never in the
page.** It is stored by the desktop app in its own data directory with
owner-only file permissions (`0600`), and only the main process ever reads it. The
part of the app you can see cannot access it — it asks the main process to make
the call. Full detail in [SECURITY.md](SECURITY.md).

The app is fully usable with no key at all. Every exam bank, lab, tutorial, game
and tool works offline; only the AI tutor and the AI-assisted cover-letter draft
need one.

---

## Contributing

This is a cohort project — we're all studying the same material, so a fix one
person makes helps everyone. Found a wrong answer in a question bank? A typo? A
crash? Open an issue, or send a pull request. [CONTRIBUTING.md](CONTRIBUTING.md)
has the details, and none of it assumes you've contributed to anything before.

```bash
npm test          # 2400+ tests, all three platforms
npm run build     # production build
npm run lint      # style and React-hook checks
```

---

## What's in it

| Area | What it does |
|---|---|
| **Licensing** | SIE, Series 65 and CFI question banks with explanations, plus an exam simulator and spaced-repetition drills |
| **Spreadsheet lab** | A real formula engine — `XLOOKUP`, `SUMIFS`, `TEXTJOIN`, date maths — with guided exercises |
| **Visualization lab** | Build charts from sample HMDA and lending data |
| **Guided tutorials** | Step-by-step labs that check your work as you go |
| **Games** | Timed drills over the same material |
| **Notes** | Note-taking with highlights and bookmarks across everything |
| **Hustle tools** | Cover letter builder, application tracker and other job-hunt tools |
| **Voice** | Ask questions out loud and hear answers back, locally |

---

## License

[MIT](LICENSE) — use it, fork it, share it with your cohort.

Question-bank content is written for study purposes and is not affiliated with,
endorsed by, or sourced from FINRA, COOP Careers, or any exam provider. Verify
anything you plan to rely on against official materials.
