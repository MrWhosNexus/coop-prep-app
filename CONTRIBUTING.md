# Contributing

We're all preparing for the same fellowship, so a fix one person makes is a fix
everyone gets. This assumes you have never contributed to a project before. If
any step here doesn't work, that's a bug in this file — open an issue about it.

## The smallest useful contribution

**A wrong answer in a question bank.** These are hand-written, and some of them
are wrong. Open an issue with the question text and what the right answer is.
That takes two minutes and is genuinely the most valuable thing you can do.

You don't have to write any code to help.

## Getting set up

You need [Node.js 20 or newer](https://nodejs.org).

```bash
git clone https://github.com/MrWhosNexus/coop-prep-app.git
cd coop-prep-app
npm install
npm run electron:dev
```

Before you change anything, check the tests pass on your machine:

```bash
npm test
```

You should see roughly 2,400 passing and 0 failing. If something fails before
you've touched anything, that's worth an issue on its own.

## Making a change

```bash
git checkout -b fix-series65-question-42
# edit things
npm test
npm run build
```

Then open a pull request. CI runs the same checks on Windows, macOS and Linux —
useful, because a change that works on your machine can break on the other two.

### Where things live

| You want to change | Look in |
|---|---|
| A question, answer or explanation | `data/certs/` |
| A lesson's text | `data/` |
| What a screen looks like | `components/` |
| Spreadsheet formulas, scoring, business logic | `lib/` |
| The desktop shell, IPC, voice, updates | `electron/` |
| Tests | `test/` |

### Two conventions worth knowing

**Tests assert call sites, not just units.** This codebase has been bitten four
separate times by code that was written, tested, and never actually invoked — a
component nothing rendered, a route missing from its component map. So when you
add something, add a test that proves *something calls it*, not only that it works
in isolation. `test/updates-ui.test.js` has examples.

**Comments explain why, not what.** The existing code is unusually heavily
commented, and it's mostly load-bearing: it records the failure that motivated the
current shape. Match that. If you fix something subtle, write down what broke.

## Reporting a bug

Include:

- What you did, what you expected, what happened
- Your OS, and the version from Settings (or the title bar)
- If it's a voice problem, the output of `npm run voice:check`
- If it's a crash, whatever the app printed

## Security

Don't open a public issue for a security problem — see [SECURITY.md](SECURITY.md).

## What changes are likely to be accepted

Anything that makes the study material more correct, the app work on a machine
where it currently doesn't, or a confusing screen less confusing. New question
banks and new guided labs are very welcome — several tools are still
placeholders.

Large architectural rewrites are less likely to land without discussion first.
Open an issue and say what you're thinking before you spend a weekend on it.
