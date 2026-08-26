// test/integration.test.js
// Proves the Phase 2 + Phase 3 integration wiring holds:
//   - the registry/pillar composition every nav surface renders from
//   - the bundled HMDA CSV that VizTool receives instead of fetch()
//   - the guide adapter driving the REAL lib/guide runner over real lessons
//   - the legacy AI-config -> lib/endpoints migration (and its key scrub)
//   - the endpoints seam's security invariant (views never carry apiKey)
//   - the games -> SRS deck seam honoring the fellowship horizon
//   - Phase 3: the SIE bank registration (data/registry.js -> lib/exam), the
//     hustle tool suite, the CFI drill surface's grading technique, and the
//     guided-lesson registry all being reachable from Dashboard.js

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PILLARS } from "../data/pillars.js";
import {
  REGISTRY, getByPillar, ALL_MODULES, findModule,
  SIE_SECTION_IDS, lessonsForCurriculumLesson, GUIDED_LESSONS, GUIDED_CURRICULUM_MAP,
} from "../data/registry.js";
import { MODULES, FLASHCARDS, FELLOWSHIP_END } from "../data/curriculum.js";
import { HEART_FLASHCARDS } from "../data/heart.js";
import { HUSTLE_FLASHCARDS } from "../data/hustle.js";
import { HUSTLE_TOOLS } from "../data/hustle-tools.js";
import { CFI_DISCLAIMER } from "../data/certs/cfi.js";
import { CFI_DRILLS } from "../data/certs/cfi-drills.js";
import { SIE_BANK } from "../data/certs/sie-bank.js";
import { HMDA_CSV } from "../data/hmda-csv.js";

// data/registry.js registers the SIE bank into lib/exam at import time — the
// import above already ran it, so lib/exam here sees what the app sees.
import { examOffering, buildSession, skillsAssessment } from "../lib/exam/banks.js";
import { scoreSession } from "../lib/exam/scoring.js";
import { createSheet, setCells, getCell, getValue } from "../lib/sheet/model.js";

import * as guideRunner from "../lib/guide/runner.js";
import { lesson as excelPivot } from "../lib/guide/lessons/excel-pivot.js";
import { lesson as excelXlookup } from "../lib/guide/lessons/excel-xlookup.js";
import { lesson as tableauBars } from "../lib/guide/lessons/tableau-bars.js";
import { checkpointForStep, materializeCheckpoint, startingState } from "../lib/guide/checkpoints.js";
import { attachGuide, normalizeResult, normalizeStep, normalizeDiffEntry } from "../components/guide/adapter.js";

import { createRegistry } from "../lib/endpoints/registry.js";
import { getAIConfig, setAIConfig, migrateLegacyAIConfig, hasAIKey } from "../lib/ai/config.js";

import { extractConcepts, extractFormulas } from "../lib/games/generators.js";
import { reviewInDeck, horizonTo, GRADE } from "../lib/games/srs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const HMDA_PATH = path.join(REPO, "public", "data", "hmda-sample.csv");
const RESOURCES = { "hmda-sample.csv": fs.readFileSync(HMDA_PATH, "utf-8") };

/** Dashboard.js is JSX — readable as source here, never importable. */
function readDashboard() {
  return fs.readFileSync(path.join(REPO, "components", "Dashboard.js"), "utf-8");
}

/** The tool ids the registry is expected to carry. @type {string[]} */
const EXPECTED_TOOL_IDS = [
  "coverLetter", "sheet", "viz", "notes", "lessonBuilder", "games",
  // Phase 3: the hustle suite + licensing surfaces
  "resumeBuilder", "starStoryBank", "applicationTracker", "mockInterview",
  "networkTracker", "salaryNegotiationPrep", "examSim", "cfiDrills",
];

/**
 * Parse Dashboard.js's real TOOL_COMPONENTS map: { toolId -> componentName }.
 * The map is a flat object literal of `id: Component,` lines, so a brace scan
 * plus a per-line match reads it exactly; anything else in there fails loudly
 * rather than being skipped, because a silently skipped entry is how a
 * tripwire goes blind.
 * @param {string} source Dashboard.js source text
 * @returns {Object<string, string>}
 */
function toolComponentsFromSource(source) {
  const decl = source.indexOf("const TOOL_COMPONENTS = {");
  assert.notEqual(decl, -1, "Dashboard.js declares a TOOL_COMPONENTS map");
  const open = source.indexOf("{", decl);
  let depth = 0;
  let close = -1;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) { close = i; break; }
  }
  assert.notEqual(close, -1, "the TOOL_COMPONENTS literal is balanced");
  const map = {};
  for (const raw of source.slice(open + 1, close).split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) continue;
    const entry = /^([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)\s*,?$/.exec(line);
    assert.ok(entry, `TOOL_COMPONENTS entry is a plain "id: Component," pair, got: ${line}`);
    assert.ok(!(entry[1] in map), `TOOL_COMPONENTS maps "${entry[1]}" once`);
    map[entry[1]] = entry[2];
  }
  return map;
}

/* ── the security invariant, expressed as rules over source text ──────────────
   The key lives in the Electron MAIN process. The renderer reaches AI only via
   the ai:call / endpoints:* IPC channels on window.coop, and there is no
   process.env key path anywhere: a keyless endpoint must fail honestly rather
   than be silently authenticated by ambient environment state.

   These rules are matched against CODE (comments stripped) and are written
   against the invariant rather than against today's file tree — the point is
   to fail on a REINTRODUCTION, in whatever spelling it arrives, which is why
   each rule is itself exercised against fixtures below. */

/**
 * Every tree that ships code — renderer or main. Scanned WHOLE and walked from
 * disk, deliberately: this was `["components", "app", "lib/ai"]` (+ lib/endpoints
 * and lib/store for the env rule), which left lib/tools, lib/exam, lib/guide
 * and lib/games in no scan set at all. A maximal leak planted in
 * lib/tools/coverLetter.js — a localStorage key read, a process.env read, a
 * console.log of the key, and a fetch carrying both `Authorization: Bearer` and
 * `x-api-key` — kept the entire suite green. The rules were never the problem;
 * they fired on the byte-identical leak in lib/tools/resume.js. They simply
 * could not see the file.
 *
 * A root list names DIRECTORIES, so a new file under one is guarded the day it
 * lands. Naming files is what rots.
 *
 * ...except a hand-written ROOT list rots the same way, one level up, and it
 * did: `data/` was renderer code all along (Dashboard.js imports it six times
 * over the @/data alias) and was in no scan set, so the same maximal leak
 * planted in data/registry.js left the suite green. Naming roots is naming.
 *
 * So the roots are DERIVED FROM DISK — every top-level directory is scanned
 * unless it is explicitly exempted below. The exemption list is an ALLOWLIST
 * and therefore fails CLOSED: a new top-level directory is scanned the day it
 * lands, and someone must consciously add it here to make it invisible.
 * @type {string[]}
 */
const NON_SOURCE_ROOTS = new Set([
  "node_modules",
  ".next",
  ".git",
  "out",
  "dist-electron",
  "public", // static assets, not modules
  "docs", // markdown plans/specs
  "test", // the guards themselves; a fixture is a key-shaped string by design
  "build",
  "scratchpad",
]);

const SCAN_ROOTS = fs
  .readdirSync(REPO, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !NON_SOURCE_ROOTS.has(e.name))
  .map((e) => e.name)
  .sort();

/**
 * Paths under SCAN_ROOTS that are NOT renderer code, and so are exempt from the
 * renderer-only rules (they remain subject to `ambient-env-key`, which every
 * scanned file answers to). Each exemption is a claim that has to stay true:
 *
 *   lib/endpoints — the MAIN-process key handler. It is the one place that may
 *     legitimately build `Authorization: Bearer`/`x-api-key` (headers.js) and
 *     read a non-credential env override (store.js#resolveStoreDir's
 *     COOP_ENDPOINTS_DIR). Renderer rules would fire on it by design.
 *   electron — the main process itself: the key's home, plus legitimate
 *     non-credential env reads (ELECTRON_DEV, COOP_ENDPOINTS_DIR).
 *   scripts — developer/CLI tooling that runs under plain `node`, never in a
 *     page. voice-doctor.mjs resolves the model cache directory the way
 *     Electron would (APPDATA / XDG_CONFIG_HOME / COOP_*_CACHE_DIR), which the
 *     name-blind renderer-ambient-env rule fires on by design. The exemption is
 *     narrow: scripts/ stays fully subject to `ambient-env-key`, so a script
 *     reading an actual CREDENTIAL env var still fails. The claim that scripts/
 *     is unreachable from the renderer is not taken on trust — it is re-derived
 *     from the real tree by "the scripts/ exemption is still true" below.
 *
 * Nothing else is exempt. lib/store is renderer-reachable (components/exam and
 * components/notes import it) and is now scanned as such. @type {string[]}
 */
const NON_RENDERER_PATHS = ["lib/endpoints", "electron", "scripts"];

/** Is `file` (repo-relative) exempt from the renderer-only rules? */
function isNonRenderer(file) {
  return NON_RENDERER_PATHS.some((p) => file === p || file.startsWith(`${p}/`));
}

/** Every scanned source: renderer AND main. Subject to `ambient-env-key`. */
function allSources() {
  return sourcesUnder(SCAN_ROOTS);
}

/** Code the renderer ships. Nothing here may hold, read, or send a key. */
function rendererSources() {
  return allSources().filter((s) => !isNonRenderer(s.file));
}

/**
 * The ONLY renderer files allowed to touch a plaintext key, each because a key
 * is passing THROUGH on its way to the main process — typed in and handed
 * over, never read back out to be used:
 *   settings/EndpointsPanel.js — the key input.
 *   settings/endpoints-ui.js   — validateDraft, which builds the draft that
 *     input goes into; the draft is submitted straight to the endpoints port.
 *   lib/ai/config.js — reads the legacy localStorage key for exactly one
 *     purpose: migrateLegacyAIConfig hands it to the port and scrubs it.
 *   lib/store/schema.js  — defaultSettings()'s `const { apiKey, ...aiDefaults }
 *     = DEFAULT_CONFIG`, which exists to DROP the key before it can reach the
 *     persisted document.
 *   lib/store/migrate.js — the same drop on the legacy import path:
 *     `const { apiKey, ...rest } = legacyAI`, so key material never enters the
 *     store. Both surfaced only when the scan was widened past lib/ai; they are
 *     key-SCRUBBERS, the invariant working, not a breach of it.
 * lib/ai/client.js is pointedly NOT here: it used to read the key out of
 * localStorage and attach `Authorization: Bearer …` to a fetch from the page.
 *
 * Unlike a coverage list, THIS list is meant to be hand-written: it is an
 * allowlist, so it fails CLOSED — a new file touching a key fails here until a
 * human writes down why it may. That is the opposite of the root cause above,
 * where a hand-written list decided what got LOOKED at and so failed open.
 * @type {string[]}
 */
const KEY_ENTRY_SURFACES = [
  "components/settings/EndpointsPanel.js",
  "components/settings/endpoints-ui.js",
  "lib/ai/config.js",
  "lib/store/migrate.js",
  "lib/store/schema.js",
];

const KEY_WORD = "KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL";

/** Any env read indexed by a runtime value: `env[X]`, `process.env?.[X]`. */
const DYNAMIC_ENV_INDEX = /(?:process\s*\.\s*env|(?<![\w$.])env)\s*(?:\?\.)?\s*\[/;
/** An env-var NAME that names a credential: "ANTHROPIC_API_KEY", not "COOP_ENDPOINTS_DIR". */
const KEY_ENV_NAME = new RegExp(`["'\`][A-Z0-9_]*(?:${KEY_WORD})[A-Z0-9_]*["'\`]`);

/**
 * @type {Object<string, Array<RegExp|((code: string) => boolean)>>}
 * rule id -> patterns; any hit is a violation of that rule.
 */
const KEY_PATH_RULES = {
  // An ambient env credential, in ANY spelling: dot, bracket, optional chain,
  // dynamic index, or destructure. Keyed off the NAME being read, so
  // resolveStoreDir's env?.[ENDPOINTS_DIR_ENV] — a directory, not a secret —
  // stays legal.
  "ambient-env-key": [
    new RegExp(
      `(?:process\\s*\\.\\s*env|(?<![\\w$.])env)\\s*(?:\\?\\.)?\\s*` +
      `(?:\\.\\s*\\w*(?:${KEY_WORD})\\w*|\\[[^\\]]*(?:${KEY_WORD})[^\\]]*\\])`,
      "i",
    ),
    new RegExp(`\\{[^{}]*(?:${KEY_WORD})[^{}]*\\}\\s*=\\s*(?:process\\s*\\.\\s*)?env\\b`, "i"),
    // The indirection the dot-notation-only version of this rule was blind to:
    // `const NAME = "ANTHROPIC_API_KEY"; env?.[NAME]` names no key at the read
    // site. A file that indexes env dynamically AND names a credential env var
    // anywhere in it is doing exactly one thing.
    (code) => DYNAMIC_ENV_INDEX.test(code) && KEY_ENV_NAME.test(code),
  ],
  // The renderer has no env to read: it runs in a page, and every value it
  // needs arrives over IPC or from the store. Any env read here is either dead
  // or a key path wearing a different name, so the rule needs no name filter.
  "renderer-ambient-env": [/(?:process\s*\.\s*env|import\s*\.\s*meta\s*\.\s*env)\b/],
  // The renderer must never authenticate an outbound request itself. A key on
  // a request is a header or a query param — so guard those shapes, not the
  // variable that fills them.
  // Read against withoutProse(code): data/ stores 500KB of exam prose in string
  // literals, and that prose says things like "the primary risk-bearer during
  // normal plan operation". Prose is data, not an authenticated request. Only
  // whitespace-bearing literals are blanked, so a quoted header name
  // (`{ "x-api-key": k }`) — itself a string literal — survives to be matched,
  // while the sentence about risk-bearers does not.
  "renderer-authenticates": [
    (code) =>
      /[{,(]\s*["'`]?\b(?:authorization|proxy-authorization|x-api-key|x-goog-api-key|api-key)\b["'`]?\s*:/i.test(
        withoutProse(code),
      ),
    // headers.set("Authorization", …) / headers["x-api-key"] = …
    // Read against RAW code: the header name here is an argument or an index,
    // not a key, so blanking string contents would erase the very thing to match.
    // Safe against prose because both shapes require the name to be the ENTIRE
    // literal, immediately after `.set(` / `.append(` / `[`.
    (code) => /(?:\.\s*(?:set|append)\s*\(|\[)\s*["'`](?:authorization|x-api-key)["'`]/i.test(code),
    // A Bearer token being BUILT — interpolated or concatenated. Bare `bearer `
    // is prose ("bearer bonds" is a real Series 65 topic); `Bearer ${k}` is not.
    (code) => /bearer\s*\$\{|["'`]\s*bearer\s*["'`]\s*\+|bearer\s*["'`]\s*\+/i.test(code),
    (code) => /[?&](?:api_?key|access_?token|auth_?token)=/i.test(withoutProse(code)),
  ],
  // A key READ BACK OUT of web storage — the exposure lib/ai/client.js used to
  // be. Keyed off the NAME in the getItem literal, not off getItem itself:
  // lib/progress.js reads getItem(KEY) for a progress blob and Dashboard.js
  // reads "coop_theme", and a rule that fired on those would be noise that gets
  // switched off. Only READS are a breach — EndpointsPanel.js holds the key the
  // user is typing in order to hand it to the port, which is write-only and
  // correct.
  "renderer-reads-stored-key": [
    new RegExp(`\\.\\s*getItem\\s*\\(\\s*["'\`][^"'\`]*(?:${KEY_WORD})[^"'\`]*["'\`]`, "i"),
  ],
  // A key on its way to a log is a key on its way to disk: under Electron the
  // renderer console is captured, and a logged key outlives the session that
  // typed it. String literals are stripped from the call first, so
  // console.error("no api key set") — prose — is not a breach, while
  // console.log(apiKey) is.
  "logs-a-key": [
    (code) => {
      const calls = code.match(/console\s*\.\s*\w+\s*\([\s\S]{0,200}?\)/g) ?? [];
      return calls.some((call) =>
        new RegExp(`(?:^|[^\\w$])[\\w$.]*(?:${KEY_WORD})[\\w$]*\\s*(?:[,)\\]}]|$)`, "i").test(
          call.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""'),
        ),
      );
    },
  ],
};

/** Strip comments: prose about the invariant is not a breach of it. */
function codeOf(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join("\n");
}

/**
 * Blank out the CONTENTS of every string literal, keeping the quotes.
 *
 * Why this is needed at all: data/ is 500KB of exam prose stored as string
 * literals, and that prose talks about the very things these rules hunt for.
 * `data/certs/series65-bank.js` contains "it isn't the primary risk-bearer
 * during normal plan operation" (trips /\bbearer\s/), and `data/hustle-tools.js`
 * discusses `api_key` (trips the key-surface pin). Neither is a breach — a
 * string is data, not an authenticated request.
 *
 * So a rule that hunts CODE shapes must not read string contents. `logs-a-key`
 * already does this inline; the rules below reuse this helper. Interpolation is
 * preserved (`${...}` survives) because a template hole is the one thing inside
 * a string that IS code — `Bearer ${apiKey}` must stay visible.
 *
 * @param {string} code
 * @returns {string} the same code with string contents blanked
 */
function withoutStringContents(code) {
  const keepHoles = (body) => (body.match(/\$\{[^}]*\}/g) ?? []).join("");
  return code
    .replace(/`(?:[^`\\]|\\.)*`/g, (m) => "`" + keepHoles(m) + "`")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
}

/**
 * Blank only string literals that are PROSE, keeping token-shaped ones.
 *
 * withoutStringContents is too blunt for the header rules: a quoted object key
 * (`{ "x-api-key": k }`) IS a string literal, so blanking everything erases the
 * exact thing to match and the rule silently stops catching a real leak.
 *
 * The discriminator is whitespace. A header name, a storage key, an env var
 * name — every token this suite hunts — is whitespace-free. Exam prose ("the
 * primary risk-bearer during normal plan operation") always has spaces. So:
 * blank a literal iff its content contains whitespace. Template holes survive,
 * so `Bearer ${apiKey}` stays visible either way.
 *
 * @param {string} code
 * @returns {string}
 */
function withoutProse(code) {
  const blankIfProse = (open, body, close) =>
    /\s/.test(body.replace(/\$\{[^}]*\}/g, "")) ? open + (body.match(/\$\{[^}]*\}/g) ?? []).join("") + close : open + body + close;
  return code
    .replace(/`((?:[^`\\]|\\.)*)`/g, (_, b) => blankIfProse("`", b, "`"))
    .replace(/"((?:[^"\\]|\\.)*)"/g, (_, b) => blankIfProse('"', b, '"'))
    .replace(/'((?:[^'\\]|\\.)*)'/g, (_, b) => blankIfProse("'", b, "'"));
}

/**
 * Every source file under `roots`, as { file (repo-relative), code }.
 *
 * The extension set includes .jsx defensively. Nothing in the tree is .jsx
 * today (the mobile build was removed 2026-07-21, pending a native iOS port),
 * but a walker that matched .js only would report "scanned" over a tree whose
 * every file it skipped — the exact blindness this suite exists to prevent.
 * @param {string[]} roots
 * @returns {{file: string, code: string}[]}
 */
function sourcesUnder(roots) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(js|mjs|cjs|jsx)$/.test(entry.name)) {
        out.push({
          file: path.relative(REPO, p).split(path.sep).join("/"),
          code: codeOf(fs.readFileSync(p, "utf-8")),
        });
      }
    }
  };
  for (const r of roots) walk(path.join(REPO, r));
  return out;
}

/**
 * Files violating one rule of the invariant.
 * @param {{file: string, code: string}[]} sources
 * @param {string} ruleId a key of KEY_PATH_RULES
 * @returns {string[]} offending file paths
 */
function scanForKeyPaths(sources, ruleId) {
  const patterns = KEY_PATH_RULES[ruleId];
  assert.ok(patterns, `unknown rule "${ruleId}"`);
  const hit = (p, code) => (typeof p === "function" ? p(code) : p.test(code));
  return sources.filter((s) => patterns.some((p) => hit(p, s.code))).map((s) => s.file).sort();
}

/* ══════════════ registry composition (what the sidebar renders) ══════════════ */

describe("registry composition", () => {
  test("licensing pillar exists and is navigable exactly like head modules", () => {
    assert.ok(PILLARS.some((p) => p.id === "licensing"));
    const lic = getByPillar("licensing");
    const licModules = lic.filter((e) => e.kind === "module");
    assert.ok(licModules.length >= 18, "SIE + Series 65 + CFI modules registered");
    // Phase 3: the pillar also offers the exam simulator and the CFI drills,
    // sorted AFTER the lesson modules (orders >= 100).
    const licTools = lic.filter((e) => e.kind === "tool").map((e) => e.id);
    assert.deepEqual(licTools, ["examSim", "cfiDrills"]);
    for (const entry of licModules) {
      const mod = findModule(entry.id);
      assert.ok(mod, `${entry.id} resolves through the shared module lookup`);
      // The exact shape the existing ModuleView/LessonView render:
      assert.equal(typeof mod.title, "string");
      assert.equal(typeof mod.color, "string");
      assert.ok(Array.isArray(mod.lessons) && mod.lessons.length > 0);
      for (const l of mod.lessons) {
        assert.equal(typeof l.id, "string");
        assert.ok(Array.isArray(l.body) && l.body.length > 0);
        for (const q of l.quiz ?? []) {
          assert.equal(q.options.length, 4);
          assert.equal(q.options.filter((o) => o.text === q.a).length, 1);
        }
      }
    }
  });

  test("every registered tool id has a Dashboard component mapping", () => {
    // Dashboard.js is JSX and cannot be imported under node --test, so its
    // TOOL_COMPONENTS map is PARSED out of the source. It is deliberately not
    // restated here: a restated list is checked against itself and can never
    // notice a tool being dropped from the real map. What a dropped entry costs
    // is silent — TOOL_COMPONENTS[id] is undefined and the tool renders
    // "Coming soon." in the packaged app, with the suite still green.
    const source = readDashboard();
    const mounted = Object.keys(toolComponentsFromSource(source));
    const registered = REGISTRY.filter((x) => x.kind === "tool").map((x) => x.id);
    assert.deepEqual(
      [...mounted].sort(), [...registered].sort(),
      "Dashboard's TOOL_COMPONENTS keys ARE the registered tool ids — no orphans, no dead tools",
    );
    // Kept from the original tripwire: the two sides above agree even if a tool
    // is deleted from BOTH, so the registry's own contents are still pinned.
    assert.deepEqual([...registered].sort(), [...EXPECTED_TOOL_IDS].sort());

    // The map's values must resolve to something Dashboard actually has: an
    // import, or a component declared in the file. A key pointing at a name
    // that does not exist is a build error, not a tripwire's business — but a
    // key pointing at the WRONG existing component is exactly what this catches.
    const components = toolComponentsFromSource(source);
    for (const [id, component] of Object.entries(components)) {
      const declared = new RegExp(
        `(^import\\s+(\\{[^}]*\\b${component}\\b[^}]*\\}|${component})\\s|^(const|function)\\s+${component}\\b)`,
        "m",
      );
      assert.match(source, declared, `TOOL_COMPONENTS.${id} -> ${component}, which Dashboard.js defines or imports`);
    }
    assert.equal(components.notes, "NoteTakerTool", "the Notes tool mounts the note taker");
    assert.equal(components.examSim, "ExamSimTool");
  });

  test("the tool-mapping tripwire can actually SEE a tool being dropped", () => {
    // A tripwire that cannot fail is decoration. This pins THIS one's
    // sensitivity, using the exact regression it exists to catch: deleting
    // `notes: NoteTakerTool` from TOOL_COMPONENTS.
    //
    // The check it replaced — assert.match(source, /notes:/) — survived this
    // mutation happily, because withAiNotesSlice's own `{ notes: aiNotes }`
    // destructuring satisfies an unanchored substring match. Hence the parse.
    const source = readDashboard();
    // `\r?\n`, not `\n`: on a CRLF checkout the `\n`-anchored mutation matched
    // nothing, `dropped === source`, and this sensitivity test silently stopped
    // testing anything. .gitattributes now pins LF; this stays tolerant anyway.
    const dropped = source.replace(/^[^\S\n]*notes: NoteTakerTool,\r?\n/m, "");
    assert.notEqual(dropped, source, "the mutation still applies to today's Dashboard.js");

    const mounted = Object.keys(toolComponentsFromSource(dropped));
    assert.ok(!mounted.includes("notes"), "the parse reads the real map, not the whole file");
    const registered = REGISTRY.filter((x) => x.kind === "tool").map((x) => x.id);
    assert.throws(
      () => assert.deepEqual([...mounted].sort(), [...registered].sort()),
      "a tool missing from TOOL_COMPONENTS MUST fail this suite",
    );
  });

  test("the six hustle tools are registered under the hustle pillar with their spec ids", () => {
    const hustleTools = getByPillar("hustle").filter((e) => e.kind === "tool").map((e) => e.id);
    assert.equal(hustleTools[0], "coverLetter", "cover letter stays first — it predates the suite");
    assert.deepEqual(hustleTools.slice(1), HUSTLE_TOOLS.map((t) => t.id),
      "registry ids match data/hustle-tools.js spec ids (they are the store slice keys)");
  });

  test("no lesson id collides across all tracks", () => {
    const ids = ALL_MODULES.flatMap((m) => m.lessons.map((l) => l.id));
    assert.equal(new Set(ids).size, ids.length);
  });

  test("heart/hustle flashcards are deck-compatible and appended AFTER core cards", () => {
    for (const card of [...HEART_FLASHCARDS, ...HUSTLE_FLASHCARDS]) {
      assert.equal(typeof card.term, "string");
      assert.equal(typeof card.def, "string");
    }
    // progress.flashDone is keyed by index — the merged deck must keep core
    // curriculum cards first so existing indices stay valid.
    const source = fs.readFileSync(path.join(__dirname, "..", "components", "Dashboard.js"), "utf-8");
    assert.match(source, /DECK = \[\.\.\.lib\.FLASHCARDS, \.\.\.HEART_FLASHCARDS, \.\.\.HUSTLE_FLASHCARDS\]/);
  });

  test("the CFI disclaimer exists and is rendered by the module view", () => {
    assert.ok(CFI_DISCLAIMER.length > 40);
    const source = fs.readFileSync(path.join(__dirname, "..", "components", "Dashboard.js"), "utf-8");
    assert.match(source, /CFI_DISCLAIMER/);
    assert.match(source, /startsWith\("cfi-"\)/);
  });
});

/* ══════════════ bundled HMDA CSV (the file:// fetch workaround) ══════════════ */

test("data/hmda-csv.js is byte-identical to public/data/hmda-sample.csv", () => {
  assert.equal(HMDA_CSV, RESOURCES["hmda-sample.csv"]);
});

/* ══════════════ guide adapter ↔ REAL lib/guide runner ══════════════ */

describe("guide adapter drives the real lib/guide runner", () => {
  test("attachGuide recognises the pure-session module shape", () => {
    const g = attachGuide(guideRunner);
    assert.equal(g.available, true);
    const r = g.createRunner(excelPivot);
    assert.equal(typeof r.submit, "function");
    assert.equal(r.currentStep().id, excelPivot.steps[0].id);
  });

  test("normalizeStep never uses a checkpoint OBJECT as the panel's map key", () => {
    for (const lesson of [excelPivot, excelXlookup, tableauBars]) {
      lesson.steps.forEach((step, i) => {
        const norm = normalizeStep(step, i);
        assert.equal(typeof norm.checkpoint, "string", `${lesson.id}/${step.id}`);
      });
    }
  });

  test("a real grader failure carries the grader's own teaching hints", () => {
    const g = attachGuide(guideRunner);
    const r = g.createRunner(excelPivot);
    const { toolState } = startingState(excelPivot, 0, RESOURCES); // empty sheet
    const norm = normalizeResult(r.submit(toolState));
    assert.equal(norm.pass, false);
    assert.ok(norm.message.length > 0, "top-level teaching message");
    assert.ok(norm.diff.length > 0, "diff entries survive normalization");
    for (const d of norm.diff) {
      assert.ok(d.detail && d.detail.length > 0, "every entry keeps its teaching sentence");
    }
  });

  test("lib/guide grader diff kinds map to renderable adapter kinds", () => {
    const e = normalizeDiffEntry({
      kind: "misplaced",
      path: "columns",
      expected: "race",
      actual: null,
      hint: "You put COUNT of applicant_id on Rows; the task asked for it on Columns.",
    });
    assert.equal(e.kind, "generic");
    assert.equal(e.detail, "You put COUNT of applicant_id on Rows; the task asked for it on Columns.");
    assert.equal(e.title, "Right thing, wrong place");

    const cell = normalizeDiffEntry({ kind: "wrong", path: "H2", expected: "Midwest", actual: "#N/A", hint: "Check the pin." });
    assert.equal(cell.kind, "cell");
    assert.equal(cell.ref, "H2");
    assert.equal(cell.detail, "Check the pin.");
  });

  test("END TO END: the excel-pivot lesson can be walked to completion through the adapter", () => {
    const g = attachGuide(guideRunner);
    const r = g.createRunner(excelPivot);
    const n = excelPivot.steps.length;

    for (let i = 0; i < n; i++) {
      let toolState;
      if (i + 1 < n) {
        // The checkpoint entering step i+1 is, by construction, a state that
        // satisfies step i.
        const cp = checkpointForStep(excelPivot, i + 1);
        toolState = materializeCheckpoint(cp.checkpoint, RESOURCES);
      } else {
        // Final step: same state, with Show Values As -> % of Row Total.
        const cp = checkpointForStep(excelPivot, n - 1);
        toolState = materializeCheckpoint(cp.checkpoint, RESOURCES);
        toolState.pivot.spec = {
          rows: ["race"],
          cols: ["approved"],
          values: [{ field: "applicant_id", agg: "count", showAs: "percentOfRowTotal" }],
          filters: {},
        };
      }
      const result = r.submit(toolState);
      assert.equal(result.pass, true, `step ${i} (${excelPivot.steps[i].id}): ${result?.message}`);
    }

    assert.equal(r.isComplete(), true);
    assert.equal(r.score().score, 1, "clean run, no hints: full credit");
    // Sessions persist as plain JSON.
    const json = r.serialize();
    assert.equal(typeof JSON.parse(JSON.stringify(json)).lessonId, "string");
  });

  test("hint ladder escalates through the runner facade and exhausts to null", () => {
    const g = attachGuide(guideRunner);
    const r = g.createRunner(excelPivot);
    const labels = [];
    for (let i = 0; i < 10; i++) {
      const h = r.hint();
      if (!h) break;
      labels.push(h.label);
    }
    assert.deepEqual(labels, ["nudge", "specific", "near-answer", "show-me"]);
    assert.equal(r.hint(), null);
  });
});

/* ══════════════ AI config migration (renderer key scrub) ══════════════ */

describe("legacy AI config migrates onto the endpoints registry", () => {
  function makeLocalStorage() {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    };
  }

  beforeEach(() => {
    globalThis.localStorage = makeLocalStorage();
  });

  test("moves the key behind the endpoints port and scrubs localStorage", async () => {
    setAIConfig({ apiKey: "sk-legacy-123", endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-4o" });
    assert.equal(hasAIKey(), true);

    const added = [];
    const port = {
      add: async (draft) => {
        added.push(draft);
        return { ok: true, endpoint: { id: "ep-1", label: draft.label, baseUrl: draft.baseUrl, hasKey: true } };
      },
    };

    const res = await migrateLegacyAIConfig(port);
    assert.equal(res.migrated, true);
    assert.equal(added.length, 1);
    assert.equal(added[0].apiKey, "sk-legacy-123");
    assert.equal(added[0].baseUrl, "https://api.openai.com/v1", "chat/completions suffix stripped to a base URL");

    // The renderer-side copy is GONE, and the returned view never carried it.
    assert.equal(hasAIKey(), false);
    assert.equal(getAIConfig().apiKey, "");
    assert.equal("apiKey" in res.endpoint, false);

    // Idempotent: nothing left to migrate.
    const again = await migrateLegacyAIConfig(port);
    assert.equal(again.migrated, false);
    assert.equal(added.length, 1);
  });

  test("no key -> no-op; no port -> no-op; failed add keeps the local key", async () => {
    assert.deepEqual(await migrateLegacyAIConfig({ add: async () => ({ ok: true }) }), { migrated: false });
    setAIConfig({ apiKey: "sk-x", endpoint: "https://api.openai.com/v1/chat/completions" });
    assert.equal((await migrateLegacyAIConfig(undefined)).migrated, false);
    const res = await migrateLegacyAIConfig({ add: async () => ({ ok: false, error: { type: "VALIDATION_ERROR" } }) });
    assert.equal(res.migrated, false);
    assert.equal(hasAIKey(), true, "a failed migration must NOT scrub the only copy of the key");
  });
});

/* ══════════════ endpoints seam: the invariant ══════════════ */

describe("security invariant at the endpoints seam", () => {
  test("registry views (what IPC returns to the renderer) never contain the key", () => {
    let data = null;
    const registry = createRegistry({
      storage: { read: () => data, write: (arr) => { data = arr; } },
    });
    const res = registry.add({ label: "Test", baseUrl: "https://api.openai.com/v1", apiKey: "sk-secret-999" });
    assert.equal(res.ok, true);
    const listed = registry.list();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].hasKey, true);
    const serialized = JSON.stringify([res.endpoint, ...listed]);
    assert.ok(!serialized.includes("sk-secret-999"), "no view ever serializes the key");
  });

  test("THE TRIPWIRE'S OWN COVERAGE: every renderer-reachable source is actually scanned", () => {
    // The rules below are only worth the files they are pointed AT. They were
    // pointed at a hand-written list of roots, so lib/tools, lib/exam,
    // lib/guide and lib/games were in no scan set at all: a maximal
    // leak in lib/tools/coverLetter.js left the whole suite green.
    // Enumerated independently of sourcesUnder (glob vs walk) so this cannot go
    // tautological with the thing it is checking.
    //
    // The glob's brace list USED to be hand-written — the same five roots as
    // SCAN_ROOTS — so both sides of the deepEqual shared one blind spot and the
    // check passed while `data/` (13 renderer-reachable modules) went unscanned.
    // Two enumerations that agree because they make the same mistake prove
    // nothing. It now globs EVERY top-level directory and subtracts the
    // exemptions, so an unexempted root missing from the scan fails here.
    const onDisk = fs
      .globSync("*/**/*.{js,mjs,cjs,jsx}", { cwd: REPO })
      .map((f) => f.split(path.sep).join("/"))
      .filter((f) => !NON_SOURCE_ROOTS.has(f.split("/")[0]) && !f.startsWith("."))
      .sort();
    assert.ok(onDisk.length > 50, "the enumeration resolves against a real tree");

    const scanned = allSources().map((s) => s.file).sort();
    assert.deepEqual(scanned, onDisk, "no renderer-reachable source may go unscanned");

    // The previously-blind files, pinned by name so a regression is legible.
    for (const f of [
      "lib/tools/coverLetter.js",
      "lib/exam/scoring.js",
      "lib/guide/runner.js",
      "lib/games/srs.js",
    ]) {
      assert.ok(scanned.includes(f), `${f} is scanned`);
    }

    // An exclusion that names nothing is a typo that silently widens nothing;
    // one that names everything is a guard that scans nothing. Both are the
    // failure this test exists to catch, so the exclusions must actually bite.
    const renderer = rendererSources().map((s) => s.file);
    for (const ex of NON_RENDERER_PATHS) {
      assert.ok(onDisk.some((f) => f === ex || f.startsWith(`${ex}/`)), `exclusion "${ex}" names real files`);
      assert.ok(!renderer.some((f) => f === ex || f.startsWith(`${ex}/`)), `exclusion "${ex}" is applied`);
    }
    assert.ok(renderer.length > 0, "the renderer scan set is non-empty");
  });

  test("no ambient env-var key path exists anywhere near the renderer or the AI layer", () => {
    // "A keyless endpoint fails honestly rather than being silently
    // authenticated by ambient environment state." This scans MAIN-adjacent
    // code too (lib/endpoints, lib/store), where a legitimate non-credential
    // env read lives (COOP_ENDPOINTS_DIR) — hence the rule keys off the NAME
    // being read, not off the existence of an env read.
    assert.deepEqual(scanForKeyPaths(allSources(), "ambient-env-key"), []);
  });

  test("no renderer code path reads ambient env or authenticates its own request", () => {
    // The exposure the old version of this test could not see: the renderer
    // reading a plaintext key and putting it on its own fetch. Under Electron
    // the renderer has no env to read and no key to send — it calls ai:call /
    // endpoints:* on window.coop and the MAIN process authenticates.
    const sources = rendererSources();
    assert.deepEqual(scanForKeyPaths(sources, "renderer-ambient-env"), []);
    assert.deepEqual(scanForKeyPaths(sources, "renderer-authenticates"), []);
    // A rule that exists and is proven sensitive, but is never pointed at the
    // tree, is the same green-and-blind failure as a root list that omits a
    // directory. These two are asserted here, not merely fixture-tested below.
    assert.deepEqual(scanForKeyPaths(sources, "renderer-reads-stored-key"), []);
    assert.deepEqual(scanForKeyPaths(sources, "logs-a-key"), []);
  });

  test("the scripts/ exemption is still true: nothing renderer-side imports it", () => {
    // The proof obligation for exempting scripts/ above. An exemption that
    // silently stopped being true would hide exactly the exposure the rule
    // exists to catch, so re-derive it rather than restating it.
    //
    // Two independent claims, both checked against the real tree:
    //   1. No renderer source imports anything from scripts/.
    //   2. electron-builder never packages scripts/ into the app.
    const importsScripts = rendererSources().filter((s) =>
      /(?:from|import|require)\s*\(?\s*["'`][^"'`]*(?:^|[/.])scripts\//m.test(s.code),
    );
    assert.deepEqual(importsScripts.map((s) => s.file), [], "no renderer file imports from scripts/");

    const builder = fs.readFileSync(path.join(REPO, "electron-builder.yml"), "utf8");
    const filesBlock = builder.slice(builder.indexOf("\nfiles:"), builder.indexOf("\nextraResources:"));
    assert.ok(!/\bscripts\b/.test(filesBlock), "scripts/ is not in the packaged files list");
  });

  test("EVERY rule is pointed at the tree, not merely fixture-tested", () => {
    // The guard's second coverage dimension: the first meta-test proves every
    // FILE is scanned, this one proves every RULE is used. A rule that only
    // ever runs against its own fixtures passes forever and protects nothing.
    const asserted = new Set([
      "ambient-env-key", "renderer-ambient-env", "renderer-authenticates",
      "renderer-reads-stored-key", "logs-a-key",
    ]);
    assert.deepEqual(
      Object.keys(KEY_PATH_RULES).sort(),
      [...asserted].sort(),
      "a rule was added to KEY_PATH_RULES without being asserted over the tree above",
    );
  });

  test("the plaintext-key surface in the renderer is exactly the reviewed key-ENTRY set", () => {
    // A key may cross the renderer in ONE direction: the user types it and it
    // is handed straight to the port (or, on the legacy web-only path, to the
    // localStorage config that lib/ai/config.js#migrateLegacyAIConfig then
    // moves behind the port and scrubs). Nothing may read a key back out to
    // use it. Pinning the FILE SET is what makes that reviewable: a key read
    // reintroduced anywhere else fails here under any spelling of "api key",
    // whether or not it also trips a rule above.
    // String contents are blanked first: data/hustle-tools.js discusses `api_key`
    // as exam/tool prose, and data/certs/* is 500KB of such prose. Text about a
    // key is not a key.
    const touching = rendererSources()
      .filter((s) => /api[_-]?key/i.test(withoutStringContents(s.code)))
      .map((s) => s.file);
    assert.deepEqual([...touching].sort(), [...KEY_ENTRY_SURFACES].sort());
  });

  test("THE TRIPWIRE'S OWN SENSITIVITY: every spelling of a key path is caught", () => {
    // This test exists because the rules above are only worth what they can
    // detect, and the version they replaced could detect nothing: it matched
    // `process.env.X_KEY` in DOT notation only, so every fixture below walked
    // straight past it — including the dynamic `env?.[NAME]` form that
    // lib/endpoints/store.js:51 already uses, and the real localStorage ->
    // fetch-header exposure, which contains no `process.env` at all.
    const reintroductions = [
      ["dot env", "ambient-env-key", "const key = process.env.ANTHROPIC_API_KEY;"],
      ["bracket env", "ambient-env-key", `const key = process.env["ANTHROPIC_API_KEY"];`],
      ["optional-chained bracket env", "ambient-env-key", `const key = process.env?.["OPENAI_API_KEY"];`],
      ["dynamic env by identifier", "ambient-env-key", `const NAME = "X_API_KEY";\nconst key = env?.[NAME];`],
      ["dynamic env by KEY-ish const", "ambient-env-key", "const key = env[MINIMAX_API_KEY_ENV];"],
      ["destructured env", "ambient-env-key", "const { OPENAI_API_KEY } = process.env;"],
      ["lowercase env secret", "ambient-env-key", "const s = process.env.my_secret;"],
      ["env token", "ambient-env-key", "const t = process.env.GITHUB_TOKEN;"],
      ["renderer touches env at all", "renderer-ambient-env", "const base = process.env.NEXT_PUBLIC_BASE;"],
      ["renderer bundler env", "renderer-ambient-env", "const base = import.meta.env.VITE_BASE;"],
      ["THE REAL ONE: localStorage key -> renderer fetch header", "renderer-authenticates",
        "const { apiKey } = getAIConfig();\n" +
        "await fetch(endpoint, { headers: { Authorization: `Bearer ${apiKey}` } });"],
      ["quoted header", "renderer-authenticates", `headers: { "Authorization": "Bearer " + k }`],
      ["anthropic header", "renderer-authenticates", `headers: { "x-api-key": k }`],
      ["key smuggled in the query string", "renderer-authenticates", "fetch(`${base}/v1/chat?api_key=${k}`);"],
      ["key read back out of localStorage", "renderer-reads-stored-key",
        `const k = localStorage.getItem("anthropic_api_key");`],
      ["key read back out of sessionStorage", "renderer-reads-stored-key",
        `const k = sessionStorage.getItem("OPENAI_API_KEY");`],
      ["key read via a storage handle", "renderer-reads-stored-key",
        `const k = storage.getItem("coop_secret_token");`],
      ["key logged", "logs-a-key", "console.log(apiKey);"],
      ["key logged among other args", "logs-a-key", `console.warn("calling with", api_key, url);`],
      ["key logged off a property", "logs-a-key", "console.debug(config.apiKey);"],
      ["key logged across lines", "logs-a-key", "console.error(\n  'call failed',\n  endpoint.accessToken,\n);"],
    ];
    for (const [name, rule, snippet] of reintroductions) {
      const found = scanForKeyPaths([{ file: "components/Reintroduced.js", code: codeOf(snippet) }], rule);
      assert.deepEqual(found, ["components/Reintroduced.js"], `rule "${rule}" catches: ${name}`);
    }

    // ...and the negative that keeps the rules honest rather than merely loud:
    // resolveStoreDir's documented, non-credential env override must NOT trip.
    const legit = [
      { file: "lib/endpoints/store.js", code: codeOf("const override = env?.[ENDPOINTS_DIR_ENV];") },
      { file: "lib/endpoints/store.js", code: codeOf("export function resolveStoreDir({ env = process.env } = {}) {}") },
    ];
    assert.deepEqual(scanForKeyPaths(legit, "ambient-env-key"), []);

    // ...and the negatives for the two rules above, which matter more than the
    // positives: EndpointsPanel.js legitimately HOLDS a key the user is typing
    // in order to hand it to the port. Write-only is the correct shape. The
    // rule must distinguish "a key goes out" from "a key comes back".
    const writeOnly = [
      { file: "components/settings/EndpointsPanel.js",
        code: codeOf(`const [apiKey, setApiKey] = useState("");\nawait api.add({ baseUrl, apiKey });`) },
      { file: "components/settings/EndpointsPanel.js",
        code: codeOf(`localStorage.setItem("coop_api_key", apiKey);`) },
    ];
    assert.deepEqual(scanForKeyPaths(writeOnly, "renderer-reads-stored-key"), [],
      "a key being typed in and handed over is not a key being read back");
    assert.deepEqual(scanForKeyPaths(writeOnly, "logs-a-key"), []);

    // Non-credential storage reads and key-free logging stay legal, or the
    // rules are merely loud: lib/progress.js and Dashboard.js do both today.
    const legitReads = [
      { file: "lib/progress.js", code: codeOf(`const raw = localStorage.getItem(KEY);`) },
      { file: "components/Dashboard.js", code: codeOf(`localStorage.getItem("coop_theme")`) },
      { file: "components/ToolErrorBoundary.js", code: codeOf(`console.error("[ToolErrorBoundary] caught error:", error, info);`) },
      { file: "lib/store/store.js", code: codeOf(`console.error("coop-prep store: autosave failed", err);`) },
    ];
    assert.deepEqual(scanForKeyPaths(legitReads, "renderer-reads-stored-key"), []);
    assert.deepEqual(scanForKeyPaths(legitReads, "logs-a-key"), []);

    // Prose about the invariant is not a violation of it.
    const prose = [{
      file: "components/settings/EndpointsPanel.js",
      code: codeOf("// a real bug where one surface read process.env.MINIMAX_API_KEY while\n// every other used Authorization: Bearer ${apiKey}\nconst x = 1;"),
    }];
    assert.deepEqual(scanForKeyPaths(prose, "ambient-env-key"), []);
    assert.deepEqual(scanForKeyPaths(prose, "renderer-authenticates"), []);
  });
});

/* ══════════════ games -> SRS seam ══════════════ */

describe("games seam", () => {
  test("curriculum-derived concepts and formulas exist for the games views", () => {
    const concepts = extractConcepts({ modules: MODULES, flashcards: FLASHCARDS });
    const formulas = extractFormulas({ modules: MODULES, flashcards: FLASHCARDS });
    assert.ok(concepts.length >= 50);
    assert.ok(formulas.length >= 1);
  });

  test("reviews scheduled with the fellowship horizon never land past program end", () => {
    const now = Date.now();
    const horizon = horizonTo(FELLOWSHIP_END, now);
    assert.ok(horizon >= 1);
    let deck = {};
    // Even repeated EASY grades (the longest intervals) stay inside the horizon.
    for (let i = 0; i < 6; i++) {
      deck = reviewInDeck(deck, "card:test", GRADE.EASY, { now, maxIntervalDays: horizon });
    }
    const due = new Date(deck["card:test"].due).getTime();
    const deadline = new Date(FELLOWSHIP_END).getTime() + 24 * 3600 * 1000; // day-granular schedule slack
    assert.ok(due <= deadline, `due ${deck["card:test"].due} is on or before program end`);
  });
});

/* ══════════════ Phase 3: SIE bank -> exam engine (via data/registry.js) ══════════════ */

describe("SIE bank registration (the orphaned-bank gap this phase closes)", () => {
  test("importing data/registry.js is enough to make the full SIE bank available", () => {
    const offering = examOffering("sie");
    assert.equal(offering.available, SIE_BANK.length, "every SIE item resolved to a section — none dropped");
    assert.equal(offering.canOfferFullForm, true, "a faithful 75-question SIE mock is on offer");
    assert.equal(offering.scoredQuestions, 75);
    for (const s of offering.sections) {
      assert.ok(s.available >= s.quota, `section ${s.id} (${s.label}) fills its quota`);
    }
    const mock = offering.modes.find((m) => m.id === "mock");
    assert.equal(mock.available, true);
    assert.equal(mock.faithful, true);
  });

  test("the section-key map covers every section key SIE_BANK actually uses", () => {
    const keys = new Set(SIE_BANK.map((i) => i.section));
    for (const k of keys) {
      assert.ok(k in SIE_SECTION_IDS, `SIE_SECTION_IDS maps bank section "${k}"`);
    }
    assert.deepEqual(new Set(Object.keys(SIE_SECTION_IDS)), keys, "no stale map entries either");
  });

  test("a real SIE mock draws, answers, and scores end to end", () => {
    const T0 = Date.UTC(2026, 6, 15, 9, 0, 0);
    const s = buildSession({ certId: "sie", mode: "mock", seed: "integration", now: T0 });
    assert.equal(s.form.items.length, 75);
    assert.equal(s.form.faithful, true);
    assert.equal(s.limitMs, 105 * 60 * 1000, "the real 105-minute clock");
    const score = scoreSession(s);
    assert.equal(score.total, 75);
    assert.equal(score.passMark.pct, 70);
  });

  test("series65 and cfi are reachable through the same seam Dashboard uses", () => {
    const s65 = examOffering("series65");
    assert.ok(s65.available >= 150, "the Series 65 bank is loaded");
    const cfi = skillsAssessment("cfi");
    assert.equal(cfi.kind, "skills");
    assert.equal(cfi.drills.length, CFI_DRILLS.length, "every CFI drill is offered");
    assert.equal(cfi.gradedBy, "lib/guide");
  });
});

/* ══════════════ Phase 3: CFI drill surface grading technique ══════════════ */

describe("CFI drill grading (the technique CfiDrillsTool in Dashboard.js runs)", () => {
  // Mirrors gradeCfiDrill in components/Dashboard.js (JSX — not importable
  // here): expected-value comparison within tolerance, plus the drill file's
  // prescribed mustReference perturbation check.
  function gradeLikeDashboard(sheet, drill) {
    const tolerance = drill.tolerance ?? 0.01;
    const refs = Object.keys(drill.expected);
    const misses = [];
    for (const ref of refs) {
      const v = getValue(sheet, ref);
      const exp = drill.expected[ref];
      const ok = typeof v === "number" && Number.isFinite(v) && Math.abs(v - exp) <= tolerance;
      if (!ok) misses.push(ref);
    }
    const hardcoded = [];
    if (misses.length === 0 && drill.mustReference) {
      for (const [cell, deps] of Object.entries(drill.mustReference)) {
        for (const dep of deps) {
          const before = getValue(sheet, cell);
          const rec = getCell(sheet, dep);
          const originalInput = rec === null ? null : rec.input;
          const base = Number(getValue(sheet, dep));
          const perturbed = Number.isFinite(base) ? (base === 0 ? 1 : base * 1.1 + 0.123) : 1;
          setCells(sheet, [[dep, String(perturbed)]]);
          const after = getValue(sheet, cell);
          setCells(sheet, [[dep, originalInput]]);
          const changed = !(typeof after === "number" && typeof before === "number" && Math.abs(after - before) <= 1e-9);
          if (!changed) hardcoded.push({ cell, dep });
        }
      }
    }
    return { misses, hardcoded, pass: misses.length === 0 && hardcoded.length === 0 };
  }

  test("every drill's reference solution passes, and an empty model fails", () => {
    for (const drill of CFI_DRILLS) {
      const solved = createSheet(drill.id);
      setCells(solved, drill.starting);
      setCells(solved, drill.solution);
      const good = gradeLikeDashboard(solved, drill);
      assert.equal(good.pass, true,
        `${drill.id}: solution passes (misses: ${good.misses.join(",")}; hardcoded: ${JSON.stringify(good.hardcoded)})`);

      const empty = createSheet(drill.id);
      setCells(empty, drill.starting);
      assert.equal(gradeLikeDashboard(empty, drill).pass, false, `${drill.id}: inputs alone must not pass`);
    }
  });

  test("perturbation restores the sheet exactly (grading twice is idempotent)", () => {
    const drill = CFI_DRILLS.find((d) => d.mustReference && Object.keys(d.mustReference).length > 0);
    const sheet = createSheet(drill.id);
    setCells(sheet, drill.starting);
    setCells(sheet, drill.solution);
    assert.equal(gradeLikeDashboard(sheet, drill).pass, true);
    assert.equal(gradeLikeDashboard(sheet, drill).pass, true, "second grade sees an unchanged sheet");
  });

  test("a hardcoded answer cell is caught even when its value is numerically right", () => {
    const drill = CFI_DRILLS.find((d) => d.mustReference && Object.keys(d.mustReference).length > 0);
    const [cell] = Object.keys(drill.mustReference);
    const sheet = createSheet(drill.id);
    setCells(sheet, drill.starting);
    setCells(sheet, drill.solution);
    // Replace the formula with its own (correct) literal value.
    setCells(sheet, [[cell, String(drill.expected[cell])]]);
    const r = gradeLikeDashboard(sheet, drill);
    assert.equal(r.pass, false);
    assert.ok(r.hardcoded.some((h) => h.cell === cell), `${cell} flagged as not responding to its inputs`);
  });
});

/* ══════════════ Phase 3: guided-lesson registry -> Dashboard ══════════════ */

describe("guided lessons are reachable from their curriculum lessons", () => {
  test("the registry re-export resolves real curriculum lesson ids to real lessons", () => {
    const curriculumIds = new Set(MODULES.flatMap((m) => m.lessons.map((l) => l.id)));
    for (const [currId, guidedIds] of Object.entries(GUIDED_CURRICULUM_MAP)) {
      assert.ok(curriculumIds.has(currId), `${currId} is a real curriculum lesson`);
      const lessons = lessonsForCurriculumLesson(currId);
      assert.equal(lessons.length, guidedIds.length);
      for (const l of lessons) {
        assert.ok(Array.isArray(l.steps) && l.steps.length > 0);
      }
    }
    assert.ok(GUIDED_LESSONS.length >= 19, "all authored lessons are in the registry");
  });

  test("every guided lesson's starting state materializes from the bundled CSV", async () => {
    const { startingState } = await import("../lib/guide/checkpoints.js");
    const resources = { "hmda-sample.csv": HMDA_CSV };
    for (const lesson of GUIDED_LESSONS) {
      const { toolState } = startingState(lesson, 0, resources);
      assert.ok(toolState.tool === "sheet" || toolState.tool === "viz", `${lesson.id} starts in a known tool`);
    }
  });

  test("Dashboard mounts the guided host, the exam host, and the drills view", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "components", "Dashboard.js"), "utf-8");
    // Guided lessons: the lesson view offers them; the guided view mounts GuidePanel.
    assert.match(source, /lessonsForCurriculumLesson/);
    assert.match(source, /<GuidePanel/);
    assert.match(source, /view === "guided"/);
    // Exam simulator: mounted with the store-backed persistence seam.
    assert.match(source, /<ExamHost/);
    assert.match(source, /savedSession=/);
    assert.match(source, /onPersist=/);
    assert.match(source, /tools\?\.exam\?\.session/);
    // CFI drills: rendered from the real drill data, graded in the tool.
    assert.match(source, /CFI_DRILLS/);
    assert.match(source, /gradeCfiDrill/);
    assert.match(source, /skillsAssessment/);
  });
});
