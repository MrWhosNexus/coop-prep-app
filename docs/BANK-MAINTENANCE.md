# Question Bank Maintenance

This document exists because the licensing banks (`data/certs/`) encode regulatory facts that
move, and the test suite cannot tell you when one has moved. The suite verifies an item's
**shape** — four options, unique texts, a key that matches exactly one option, a non-empty
explanation. It has never verified whether an item is **true**. Twelve factually wrong items
passed 1947 green tests for months. Read that sentence again before you trust a green build here.

Everything below is either verified against a primary source or explicitly flagged as uncertain.
Where this document states a number, it was measured, not remembered.

State as of 2026-07-16, measured at commit `6e51d54`: 1954/1954 tests pass; `npx next build`
succeeds; SIE bank 450 items, Series 65 bank 780, both at exactly 6.00x per-form quota in every
section.

The **test total is pinned to that commit on purpose** — it moves whenever anyone adds a test, and
work landing alongside this document already carries it past 1954. A different number is not
evidence of a problem here. The **bank sizes and the 6.00x** are the numbers worth re-checking, and
they are re-derivable at any time through the real registration path:

```
node --input-type=module -e "import('./data/registry.js').then(async()=>{const {getExam}=await import('./lib/exam/banks.js');const {countBySection,allocate}=await import('./lib/exam/blueprint.js');for(const c of ['sie','series65']){const e=getExam(c);const q=allocate(e.blueprint,e.blueprint.scoredQuestions);const h=countBySection(e.blueprint,e.bank);console.log(c,e.bank.length,Math.min(...Object.entries(h).map(([s,n])=>n/q[s])));}})"
```

---

## A. Deferred work

These are things that **cannot be actioned now**. Each has a trigger — the specific event that
makes it actionable. Doing them early is worse than not doing them.

### A1. FINRA exam retake day counts — `sieb-rf-11`, `sieb-rf-12` (`data/certs/sie-bank.js`)

Both items concern FINRA's escalating waiting periods for retaking a failed qualification exam.
Neither one keys a number of days, and that is deliberate.

The rule is mid-flight. FINRA filed **SR-FINRA-2026-014** (SEC Release 34-105885) on
**2026-06-29**, shortening the waits from **30 → 15 days** after the first and second failure,
and from **180 → 60 days** after three or more failures in succession within a two-year period.
FINRA designated it non-controversial under **Rule 19b-4(f)(6)**, which makes it effective *on
filing*. But FINRA announces *implementation* dates separately, by Regulatory Notice, and had
published none as of 2026-07-16 (re-verified against the SEC filing and FINRA's effective-dates
page on that date — the page lists exam implementation dates and says nothing about the retake
amendment).

So the rulebook text and the day counts actually governing a candidate sitting an exam **can
diverge right now**. The old numbers may be what a candidate faces; the new numbers are what the
rulebook says. **Both are unsafe to key.** A prep bank that confidently states either one is
teaching a coin flip.

Both items therefore test the **mechanism** and assert no day count — `sieb-rf-12` tests that the
wait *escalates* at the third failure within a two-year lookback, and `sieb-rf-11` tests *who* the
waits bind (the SIE is open to non-associated candidates, who are bound by consent under Rule 1210
Supplementary Material .06 rather than by FINRA's jurisdiction over an employee). Both are correct
whichever way the numbers resolve.

> **TRIGGER:** FINRA publishes the Regulatory Notice, or an implementation date appears at
> <https://www.finra.org/registration-exams-ce/qualification-exams/effective-dates>.
>
> **ACTION (optional even then):** a day-count item **may** be added. Re-verify against the live
> rulebook first — do not trust the numbers in this document, which are recorded as of a filing
> that had not yet been implemented. **Do not replace the mechanism items.** They test something
> the day-count item does not, and they will still be true afterwards.

One further caution, learned the hard way. When these two items were fixed independently, each
was rewritten to "test the mechanism" and **both converged onto the same fact**, down to two
shared distractors. `sieb-rf-11` had to be re-based onto genuinely different ground to stay
distinct. Stripping a number out of an item can delete the only thing that distinguished it from
its neighbour. Check for that whenever you generalise an item away from a specific figure.

### A2. Citation rot

Rule and statute lettering gets renumbered, and a citation that was correct when written silently
becomes a pointer at someone else's rule. Nothing in the suite checks this: it can verify an
item's shape, never whether "202(b)" is really 202(b).

**The precedent worth internalising.** NASAA's **2025-04-07** amendment to the broker-dealer
Dishonest or Unethical Business Practices model rule inserted a new **1.d** (Reg BI duty of care)
and **1.e** (misleading "adviser"/"advisor" titles). Every later letter shifted down by two — the
discretion provision moved from **1.e to 1.g**, and 2.f's cross-reference list was conformed to
match. An auditor checking `s65b-law-130` against the **superseded 2022 PDF** concluded the item's
"sec. 1.g" was wrong. It is **correct under the rule in force**. "Fixing" it would have aimed a
correct pointer at the adviser-title rule — turning a right answer into a wrong one, with an audit
trail that made it look like diligence.

> **TRIGGER:** any rule amendment touching cited material; or **2027-07-16** (one year from the
> audit recorded in §D), whichever comes first.
>
> **ACTION:** re-audit the followable cites. **There is no citation-audit script** — `scripts/`
> holds only `bank-dupe-sweep.mjs`. The audit was run by agents against a generated bank slice, and
> the record of what it covered is the manifest named in §D. Re-generating that slice is the first
> step of re-running the audit; budget for it.
>
> **Always check the CURRENT text, never a cached PDF.** Establish which version is operative
> *before* correcting any cite. A cached or archived PDF is evidence of what a rule *used to say*
> and is not evidence that an item is wrong.

---

## B. Invariants you might innocently break

These look like cleanups. They are not. Each one has a reason, and the reason is the point.

### B1. The 4x test floor must not be raised to 6x

`test/cert-sie-bank.test.js` and `test/cert-series65.test.js` assert that every section holds at
least **4x** its per-form quota. The banks actually hold **6x** (measured: SIE 72/198/138/42
against quotas 12/33/23/7; Series 65 120/192/234/234 against 20/32/39/39 — 6.00x in all eight
sections). The floor and the stock deliberately disagree.

It is tempting to "tighten" the floor to 6x so the test reflects reality. **Do not.** That is
precisely the trap this project already fell into and paid to climb out of.

The banks previously sat at *exactly* 4.00x — built right down to the number the tests asserted.
That had a vicious property: **retracting a single wrong item for accuracy broke the build.** A
correction could only ever be a careful swap, never a deletion. The bank was simultaneously at its
promised depth and unmaintainable. Twelve items then turned out to be factually wrong (see §C).

**4x is the promise** — four distinct full-length mocks, which is what the learner is owed.
**6x is the stock.** The gap between them is what makes fixing a wrong item cheap instead of a
build break. Matching the floor to the current size would recreate this exact trap one bank-size
higher. The tests carry comments saying so; read them before editing them.

### B2. Item counts are load-bearing — replace, never delete

Following directly from B1: when you find a bad item, **write a replacement in its place**. Do not
delete it and move on. The surplus above the floor buys slack for corrections; it is not a budget
to spend on deletions. Deleting items walks the bank back down toward the floor and re-arms the
trap.

### B3. Do not simplify away the answer shuffle

The banks are keyed to slot A almost everywhere **as authored**. Measured on the real registered
banks (2026-07-16):

| Bank | Items | A | B | C | D |
|---|---|---|---|---|---|
| SIE | 450 | **98.9%** (445) | 0.9% (4) | 0.2% (1) | **0.0% (0)** |
| Series 65 | 780 | **92.1%** (718) | 5.3% (41) | 2.4% (19) | 0.3% (2) |

Across all 450 SIE items, **D is never the correct answer — not once.** The 410 items added during
the expansion made this worse, not better: the authoring prompt asked for the correct option first,
so the new material is ~99.8% slot A.

This is harmless **only** because `drawForm()` reshuffles every item against a seeded RNG; through
the real draw path forms come out ~24–26% per slot. The app is fine. But the shuffle is now the
*only* thing standing between the learner and a mock exam where "always answer A" scores ~100%.

`test/exam-answer-position.test.js` guards this, and it is built to resist the obvious mistake. An
existence check (`some(i => i.correctIndex !== 0)` — "the shuffle moved something") is **degenerate**:
a shuffle that rotates every item by one position passes it while parking the answer in slot B on
every single question. That mutation leaves the old check green and the exam trivially gameable.
The current file instead asserts a uniformity ceiling and a starved-slot floor through
`buildSession`/`drawForm`, plus two things that keep it from going vacuous — a canary proving the
authored bank *is* biased, and a proof that switching the shuffle off reproduces that bias. Without
those two, every assertion could pass because the bank had quietly become uniform and the shuffle
had become a no-op nobody noticed.

The 0.8 threshold on the unshuffled-draw proof is **measured, not assumed**. It was written as 0.9
first and failed honestly at 89.2%: a 130-question Series 65 form samples a 92.1% bank and inherits
the bias with variance, not exactly.

Fixing the authored bias at the source would be fine. Removing the shuffle or the guard would not.

### B4. Near-duplicate detection reports; it must not assert

The suite's near-duplicate sweep gates on two items having an **identical** keyed answer string.
That gate is deliberate and correct: the banks run legitimate **contrast pairs** in parallel
phrasing — premium vs discount, call vs put, T-note vs T-bond — which share most of their words
while teaching opposite facts. Keying on answer equality makes those pairs immune by construction.

The gate has a hole: a real duplicate whose keys are **paraphrases**. Three shipped green, written
by concurrent authoring batches that could not see each other's files (LGIP defined twice; custody
quarterly statements twice; contract-not-assignable-without-consent twice). All three were replaced
in place with new ground.

**That hole cannot be closed with a lexical threshold**, and it is worth understanding why before
you try. Measured on the real banks, the legitimate premium/discount contrast pair scores
**0.75/0.75** on key- and question-similarity, while a genuine duplicate scored **0.50/0.64**. The
*good* pair scores **higher** than the defect. Any threshold that catches the duplicates fails the
contrast pairs, and the only route back to green is an id allowlist — the same hand-maintained
coverage antipattern that let these ship in the first place.

So `scripts/bank-dupe-sweep.mjs` **reports for a human** and does not assert. Run it after
authoring any new items, and **read every pair** — it is ranked, not filtered, and judgement is the
whole mechanism:

```
node scripts/bank-dupe-sweep.mjs
```

---

## C. Correction changelog

**Do not "restore" any of these thinking you have found a gap.** Each was verified against primary
source text, then handed to an independent skeptic instructed to *refute* the finding. None were
refuted; several skeptics improved the proposed remedy. Fourteen factual defects, plus three
duplicates replaced.

Commits: `c43c1e0` (12 defects + expansion), `2e4beee`, `6e51d54` (2 miscites), `3487b21`
(answer-position guard).

### The 12 found by auditing the older 820 items (`c43c1e0`)

| id | Wrongly said | Now says | Source |
|---|---|---|---|
| `sieb-cm-22` | Attributed reserve requirements to the **FOMC** | They are the **Board of Governors'** (explanation-only fix; the keyed answer was already right) | Federal Reserve |
| `sieb-rf-11` | Keyed a retake day count | Tests *who* the waits bind — consent for non-associated SIE candidates, Rule 1210 SM .06 | FINRA Rule 1210 (see §A1) |
| `sieb-rf-12` | Keyed a retake day count | Tests that the wait *escalates* at 3 failures within a 2-year lookback; no number keyed | FINRA Rule 1210 (see §A1) |
| `sieb-ta-40` | Employer approval + proportional sharing **sufficient** | Omitted the customer's **prior written consent**, now required | FINRA Rule 2150(c)(1) |
| `sieb-ta-71` | Named the two Rule 3240 categories **exempt** from firm pre-approval, then conditioned them on firm approval | Contradiction removed | FINRA Rule 3240 |
| `sieb-pr-39` | Class C shares **never convert** | Conversion is a **prospectus term, not a rule** — the item keys the level charge + ~1yr 1% CDSC as what *defines* the class, and states that where conversion exists it is set by the individual prospectus, not by SEC or FINRA. **It deliberately keys no year count** (the "8 years / since ~2019" industry practice is why the old text was wrong; it is *not* what the item now asserts — do not "restore" that figure into it) | Fund prospectuses / FINRA |
| `s65b-law-03` | Collapsed the **LATE exclusion** into the broker-dealer two-prong test | Distinction restored — it is what the exam actually tests | Uniform Securities Act |
| `s65b-law-53` | Institutional-only activity as a definitional **exclusion** from "agent" | It is an **exemption** from registration | USA |
| `s65b-law-54` | Same exclusion/exemption error, issuer-officer prong | Corrected | USA |
| `s65b-law-70` | Applied a **FINRA broker-dealer rule to an investment adviser**, and **contradicted `s65b-law-63` in the same bank**, which keys the qualified-client rule correctly | Scoped to the BD agent, keyed to all three Rule 2150(c)(1) conditions (employing member's *and* customer's prior written authorization, plus direct-proportion sharing). Now names the carve-out explicitly: an investment adviser is excepted by **Rule 2150(c)(2)** and routed to **Advisers Act Sec. 205 / Rule 205-3** (qualified client) — which is what `s65b-law-63` tests | FINRA Rule 2150(c); Advisers Act Sec. 205, Rule 205-3 |
| `s65b-law-130` | Applied the IA **10-business-day** discretion grace period to a **BD agent**, who gets none | Written authority required **first**, time/price-only excepted (NASAA BD rule sec. 1.g via 2.f). The 10 days now appears **only as a distractor**, which is where it earns its keep | NASAA model rule (current text — see §A2) |
| `s65b-law-141` | Keyed **rescinded Rule 206(4)-3** (cash solicitation) | The **Marketing Rule** replaced it in 2022 | SEC |

Every one of these passed 1947 green tests.

### The 2 miscites found in the 410 new items

| id | Wrongly said | Now says | Source |
|---|---|---|---|
| `s65-lw-x204` | Cited **USA 202(b)** for the registration effective-date rule | The rule lives at **202(a)**; 202(b) is the federal covered adviser notice-filing provision — an unrelated topic | NASAA USA text (pdftotext'd locally when WebFetch could not parse the PDF) |
| `sieb-ta-x102` | Cited **FINRA 2360(b)(16)(B)** for the 15-day options account agreement | It lives at **2360(b)(16)(D)** ("Account Agreement"); (b)(16)(B) is "Diligence in Opening Accounts" — real, adjacent, and different | FINRA rulebook + SEC filing exhibit 34-69913-ex5.pdf |

In **both** cases the keyed answer was correct and only the pointer was wrong. This class is
uniquely nasty: a wrong cite points at a **real, adjacent, plausible** provision, so a student who
follows it lands on genuine-looking text with no signal they were misrouted. It survives every
check we have — the suite verifies shape, the accuracy passes verify what an item *teaches*, and
nothing verified that its pointers *resolve*.

Two process lessons are recorded in those commit bodies and are worth preserving:

- `sieb-ta-x102`'s miscite appeared **twice** (item explanation *and* the keyed option's
  explanation). The accuser proposed a single substitution; applying it as proposed would have left
  the defect half-fixed. Both sites now also name the subparagraph's heading, so the cite is
  self-checking for a student.
- `s65-lw-x204` was **nearly lost**. The auditor accused the wrong id (`s65-lw-x205`, entirely
  innocent) while quoting its neighbour's text — an off-by-one while reading the file — and then
  invented a corroborating detail about a third item. The skeptic correctly refuted the
  *accusation*, and post-processing filed the whole thing under "refuted" and dropped it. The real
  defect was reported as 0-confirmed. **A refuted accusation is not the same as an absent defect.**
  The audit schema now carries `actualDefectiveId` + `realDefectExistsSomewhere` so a defect cannot
  escape by being pointed at the wrong row.

### Three duplicates (replaced, not deleted)

`sieb-pr-x118`/`sieb-pr-x204` (LGIP), `s65-lw-x105`/`s65-lw-x216` (custody quarterly statements),
`s65b-law-64`/`s65-lw-x107` (contract not assignable without consent). All replaced in place with
new ground. See §B4 for why the suite could not catch them.

> **Note on a discrepancy.** The task brief that produced this document attributed the USA 202(a)
> miscite to **`s65b-law-04`**. That is wrong, and the trap is that *both ids exist*. `s65b-law-04`
> is a broker-dealer-exclusion item that contains no USA 202 citation at all; the miscite was in
> **`s65-lw-x204`** (`data/certs/expansion/series65-laws-2.js:77`). Verified by reading both items.
> The commits are authoritative; the brief was not.

---

## D. Known coverage limits

Stated plainly, because the gaps are not visible from a green build.

**Uneven verification history.** The **410 new items** (the expansion to 6x) had author-time
verification, adversarial review, *and* a full independent audit. The **older 820 items** had
**none of that** until this session's audit — which found the 12 defects in §C. **No further audit
has been run since those fixes landed.** The older material has now been audited exactly once, by
one process, and that process demonstrably mis-filed a real defect once (§C). Treat "audited" as
"audited once", not "clean".

**The citation audit is partial.** It covered **64 followable citations across 39 items**
(15 SIE, 24 Series 65 — 31 SIE cites + 33 Series 65 cites) and found **0 miscites** beyond the 2
already fixed. But its inclusion rule was *followable* cites — those naming a subdivision specific
enough to check. Citations **without** a subdivision (a bare "Rule 144", "the Securities Act of
1933") were **not systematically checked**. They are lower-risk, because a bare rule number has
less to get wrong and no adjacent-provision trap. They are **not zero-risk**: a bare cite can still
name the wrong rule entirely.

**Where that audit's record lives — read this before trying to reproduce the 64/39 numbers.** They
were counted from `_cite-manifest.json`, a root-level *scratch dump* generated from `data/certs/` to
hand bank slices to the audit agents. **It is not in the working tree.** It was deleted and
`.gitignore`d (`/_*.json`) precisely because a derived dump of the banks rots out of sync the moment
the banks change — it had been committed by a careless `git add -A`. The last tree containing it is
commit **`6e51d54`**; recover it with:

```
git show 6e51d54:_cite-manifest.json > /tmp/_cite-manifest.json
```

Treat what you recover as **a record of what was audited on 2026-07-16, not as current state**. It
is a snapshot, and the banks have a changelog above it. Do not re-commit it.

**What the suite does not test.** It does not test truth. It does not test that citations resolve.
It does not catch paraphrase duplicates (§B4). It does not catch a fact that was true when written
and has since changed — which, given §A1, is a live category and not a hypothetical.

---

## Working notes

- Run tests from the repo root: `npm test` (node --test). Build: `npx next build`.
- Plain JS ESM. No TypeScript.
- Verify facts against **primary sources** — finra.org rulebooks, sec.gov, nasaa.org, govinfo.gov,
  law.cornell.edu. Do not trust recall; these rules move and training data has a cutoff. If a PDF
  resists WebFetch, download it and `pdftotext` it locally (this is how both miscites in §C were
  actually confirmed — and SEC PDFs may need a policy-compliant contact User-Agent to avoid a 403
  or the rate-limit interstitial).
- **Settlement is T+1**, never T+2. **FINRA Rule 1240 Regulatory Element** is the current *annual*
  schedule, never the retired "second anniversary" rule. Both are swept by tests.
- A **retired or superseded rule makes a good distractor** — it is what a stale source says, so a
  learner who absorbed it picks it and gets corrected. **Never key one as correct.** (`s65b-law-141`
  keyed rescinded Rule 206(4)-3; `s65b-law-130` now uses the misapplied 10-day window exactly this
  way.)
- Item shape: exactly 4 options, unique option texts, `a` matches **exactly one** `option.text`
  character-for-character, every explanation non-empty.
- No date-sensitive figure unless confirmed current for 2026 from a primary source (contribution
  limits, RMD ages, CTR thresholds, SIPC limits, exam retake day counts). **Test the mechanism.**
