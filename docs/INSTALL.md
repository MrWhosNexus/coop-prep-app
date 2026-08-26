# Installing Coop Prep

Written for people who have never installed an app from GitHub. If you get stuck
at any step, that's a bug in these instructions — say so and they'll get fixed.

**The short version:** download the file for your computer, open it, and when your
computer warns you that it doesn't recognise the app, tell it to open anyway. That
warning is expected. Here's why, and exactly what to click.

---

## Why your computer will warn you

Windows and macOS want app makers to buy a certificate — about $100 a year each —
that vouches for who built the app. Coop Prep doesn't have one. This is a study
tool built by someone in the cohort, not a company.

So your computer says, accurately, **"I don't know who made this."** It is *not*
saying it found anything harmful. It has no idea what the app does either way; it
only knows nobody paid to put their name on it.

If you'd rather not take that on faith, you don't have to — every release is built
in public by [GitHub Actions](../.github/workflows/release.yml) from the source
code in this repo, and each one publishes checksums you can verify. See
[Verifying your download](#verifying-your-download-optional) at the bottom.

---

## Windows

1. Go to the [latest release](https://github.com/MrWhosNexus/coop-prep-app/releases/latest).
2. Under **Assets**, click **`Coop-Prep-Setup-0.2.0.exe`** (about 253 MB).
3. Open the downloaded file.
4. A blue box appears: **"Windows protected your PC."**
   - Click the small **More info** link in that box.
   - A **Run anyway** button appears. Click it.
   - *If you don't see "More info", the box is a different one — click **Keep** or
     **Keep anyway** on the download first, then reopen the file.*
5. The installer runs. You can choose where to install it.
6. Coop Prep is now in your Start menu.

You'll only see the blue box the first time.

---

## Mac

**First, which Mac do you have?** Click the  in the top-left → **About This Mac**.

- Says **Apple M1 / M2 / M3 / M4** → you want the **arm64** file.
- Says **Intel** → you want the **x64** file.

Then:

1. Go to the [latest release](https://github.com/MrWhosNexus/coop-prep-app/releases/latest).
2. Under **Assets**, click **`Coop-Prep-0.2.0-arm64.dmg`** *or*
   **`Coop-Prep-0.2.0-x64.dmg`** (about 306 MB).
3. Open the downloaded `.dmg`. A window opens showing the Coop Prep icon.
4. Drag the icon onto the **Applications** folder shown beside it.
5. **This next part matters.** Open your Applications folder and find Coop Prep.
   **Right-click** it (or Control-click) → choose **Open**.
   - A box says *"macOS cannot verify the developer."* Click **Open**.
   - **Do not double-click the app the first time.** Double-clicking gives you a
     box with only a **Cancel** button and no way through. Right-click → Open is
     what adds the **Open** button. If you already double-clicked, just close that
     box and right-click → Open instead.
6. It opens. From now on you can open it normally.

### If macOS says the app "is damaged and can't be opened"

Nothing is damaged. macOS tags files downloaded from the internet, and on newer
versions that tag sometimes produces this message instead of the normal one.

Open **Terminal** (press ⌘ + Space, type `Terminal`, press Return) and paste this,
then press Return:

```bash
xattr -dr com.apple.quarantine "/Applications/Coop Prep.app"
```

It prints nothing. That's success. Open the app normally now.

---

## Linux

### AppImage (works on most distributions)

1. Download **`Coop-Prep-0.2.0-x86_64.AppImage`** (about 567 MB) from the
   [latest release](https://github.com/MrWhosNexus/coop-prep-app/releases/latest).
2. Make it runnable, then run it:

```bash
chmod +x Coop-Prep-0.2.0-x86_64.AppImage
./Coop-Prep-0.2.0-x86_64.AppImage
```

The AppImage is the version that can update itself, so it's the one to prefer.

### Debian / Ubuntu / Mint

```bash
sudo apt install ./Coop-Prep-0.2.0-amd64.deb
```

Then launch Coop Prep from your applications menu.

---

## First run: what to expect

**It works straight away.** Every exam bank, the spreadsheet lab, the
visualization lab, the tutorials, games and notes all work offline with no setup
and no account.

Two things are opt-in:

**Voice** (asking questions out loud) downloads about 165 MB of speech models the
first time you use it. That's a one-time download; afterwards voice works with no
internet at all, and nothing you say ever leaves your computer. Wait for it to
finish before judging whether it works.

**The AI tutor** needs an API key from an AI provider, which you add in
**Settings → AI endpoints**. You don't need one — everything else works without
it. If you do add one, it's stored by the app on your own computer and is never
sent anywhere except to the provider you chose.

---

## Updates

Open **Settings → Updates**. The app checks for new versions and tells you when
one is out.

- **Windows** and the **Linux AppImage** can install the update themselves.
- **Mac** and **`.deb`** installs will send you to the download page to grab the
  new version. Install it the same way you did the first time — on Mac you won't
  need the right-click step again.

Nothing ever downloads or installs without you clicking it.

---

## Verifying your download (optional)

For anyone who'd rather check than trust. Download `SHA512SUMS-macos-latest.txt`
(or `-windows-latest` / `-ubuntu-latest`) from the same release, put it next to
your download, and run:

**Mac / Linux**

```bash
shasum -a 512 -c SHA512SUMS-macos-latest.txt
```

You want to see `OK` next to the file you downloaded.

**Windows (PowerShell)**

```powershell
Get-FileHash -Algorithm SHA512 .\Coop-Prep-Setup-0.2.0.exe
```

Compare the result against the matching line in `SHA512SUMS-windows-latest.txt`.

If they match, the file you have is exactly the one GitHub's servers built from
the public source code.

---

## Something went wrong

Open an [issue](https://github.com/MrWhosNexus/coop-prep-app/issues) and include
your operating system and what you saw. If it's a voice problem and you're
comfortable in a terminal, `npm run voice:check` from a source checkout prints a
diagnosis.
