/**
 * test/dashboard-scope.test.js
 *
 * Two defects, one file:
 *
 *  - Finding 10: Dashboard routed NAV_MODULES (all 105 lessons) to the
 *    Module/Lesson/Search/Saved views but core lib.MODULES (21 lessons) to
 *    every progress computation, so the 84 heart/hustle/licensing lessons
 *    counted toward nothing. The scoping decision now lives in
 *    components/dashboard-scope.js — a pure view-model module (same pattern as
 *    components/settings/endpoints-ui.js), because Dashboard.js is JSX and node
 *    has no JSX loader. The wiring itself is asserted against the real source.
 *
 *  - Finding 11: app/layout.js pulled Inter off fonts.googleapis.com, which
 *    electron/main.js's CSP blocks — the app shipped the wrong typeface AND
 *    phoned Google twice per launch. Asserted against source and, when the
 *    export exists, against the built output in out/.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  overallProgress,
  nextLesson,
  coreModuleSummary,
} from "../components/dashboard-scope.js";

import { ALL_MODULES } from "../data/registry.js";
import { MODULES as CORE_MODULES } from "../data/curriculum.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DASHBOARD_SRC = fs.readFileSync(path.join(ROOT, "components", "Dashboard.js"), "utf-8");
const LAYOUT_SRC = fs.readFileSync(path.join(ROOT, "app", "layout.js"), "utf-8");

/** A progress doc with `ids` marked complete. */
const progressWith = (ids) => ({
  completed: Object.fromEntries(ids.map((id) => [id, true])),
  quizScores: {},
});

const lessonIds = (modules) => modules.flatMap((m) => m.lessons.map((l) => l.id));
const SIE_MODULE_IDS = ALL_MODULES.filter((m) => m.id.startsWith("sie-")).map((m) => m.id);

/* ═══════════════ Finding 10: which lessons count ═══════════════ */

describe("Finding 10 — the fixture that exposed the split", () => {
  test("the two module sets really are 21 vs 105 lessons", () => {
    // If this ever changes the numbers below are stale, not the logic.
    assert.equal(lessonIds(CORE_MODULES).length, 21);
    assert.equal(lessonIds(ALL_MODULES).length, 105);
    assert.ok(SIE_MODULE_IDS.length >= 6, "the SIE track exists to be completed");
  });
});

describe("overallProgress — counts everything navigable", () => {
  test("a user who completes all six SIE modules moves the overall bar", () => {
    const sieLessons = lessonIds(ALL_MODULES.filter((m) => SIE_MODULE_IDS.includes(m.id)));
    const progress = progressWith(sieLessons);

    const { done, total } = overallProgress(progress, ALL_MODULES);

    // THE defect, stated as an assertion: this used to be 0/21.
    assert.equal(total, 105, "denominator is every navigable lesson");
    assert.equal(done, sieLessons.length, "finishing the SIE track counts");
    assert.ok(done > 0, "the bar must move");
  });

  test("pct is a finite 0-100 number even for an empty module set", () => {
    assert.deepEqual(overallProgress(progressWith([]), []), { done: 0, total: 0, pct: 0 });
    const all = overallProgress(progressWith(lessonIds(ALL_MODULES)), ALL_MODULES);
    assert.equal(all.pct, 100);
  });

  test("generated lessons merged into NAV_MODULES are counted, not ignored", () => {
    const withGenerated = ALL_MODULES.map((m) =>
      m.id === "capstone" ? { ...m, lessons: [...m.lessons, { id: "gen-1" }] } : m
    );
    const before = overallProgress(progressWith([]), ALL_MODULES).total;
    assert.equal(overallProgress(progressWith([]), withGenerated).total, before + 1);
    assert.equal(overallProgress(progressWith(["gen-1"]), withGenerated).done, 1);
  });
});

describe("nextLesson — core curriculum first, then the rest of the app", () => {
  test("suggests the first incomplete CORE lesson while core is unfinished", () => {
    const next = nextLesson(progressWith([]), CORE_MODULES, ALL_MODULES);
    assert.equal(next.mod.id, CORE_MODULES[0].id);
    assert.equal(next.l.id, CORE_MODULES[0].lessons[0].id);
  });

  test("core stays first even when an earlier-listed licensing lesson is incomplete", () => {
    // ALL_MODULES starts with the core modules, so prove the preference is real
    // by completing core's first lesson and checking we stay inside core.
    const next = nextLesson(
      progressWith([CORE_MODULES[0].lessons[0].id]),
      CORE_MODULES,
      ALL_MODULES
    );
    assert.ok(
      lessonIds(CORE_MODULES).includes(next.l.id),
      "while the fellowship curriculum is unfinished, that is what we suggest"
    );
  });

  test("falls through to the other 84 lessons once core is complete", () => {
    const progress = progressWith(lessonIds(CORE_MODULES));
    const next = nextLesson(progress, CORE_MODULES, ALL_MODULES);

    // Previously: null -> HomeView claimed "All 21 lessons complete" while 84
    // navigable lessons sat untouched.
    assert.ok(next, "84 lessons remain — do not claim the app is finished");
    assert.ok(!lessonIds(CORE_MODULES).includes(next.l.id));
    assert.ok(lessonIds(ALL_MODULES).includes(next.l.id));
  });

  test("null only when every navigable lesson is done", () => {
    const progress = progressWith(lessonIds(ALL_MODULES));
    assert.equal(nextLesson(progress, CORE_MODULES, ALL_MODULES), null);
  });

  test("skips modules that have no lessons", () => {
    const next = nextLesson(progressWith([]), [{ id: "empty", lessons: [] }], ALL_MODULES);
    assert.ok(next, "an empty core module must not strand the suggestion");
  });
});

describe("coreModuleSummary — deliberately scoped to the fellowship curriculum", () => {
  test("counts core modules only, so the Home grid header matches the Home grid", () => {
    const summary = coreModuleSummary(progressWith(lessonIds(CORE_MODULES)), CORE_MODULES);
    assert.equal(summary.total, CORE_MODULES.length);
    assert.equal(summary.complete, CORE_MODULES.length);
  });

  test("a module with zero lessons is not silently 'complete'", () => {
    const summary = coreModuleSummary(progressWith([]), [{ id: "empty", lessons: [] }]);
    assert.equal(summary.complete, 0);
  });
});

describe("Dashboard.js wiring — the real source, not a mirror", () => {
  test("overall progress is computed from NAV_MODULES, not core MODULES", () => {
    assert.doesNotMatch(
      DASHBOARD_SRC,
      /const allLessons = MODULES\.flatMap/,
      "the sidebar bar must not be denominated in core lessons"
    );
    assert.match(DASHBOARD_SRC, /overallProgress\(progress, NAV_MODULES\)/);
  });

  test("readiness stays explicitly scoped to the core curriculum", () => {
    // Not an oversight: the ring is labelled "Fellowship Readiness", and the
    // fellowship is the core track. The binding must SAY core.
    assert.match(DASHBOARD_SRC, /lib\.readinessScore\(progress, CORE_MODULES\)/);
    assert.doesNotMatch(
      DASHBOARD_SRC,
      /lib\.readinessScore\(progress, MODULES\)/,
      "an unqualified `MODULES` is exactly how this scoping went unnoticed"
    );
  });

  test("the ambiguous `MODULES` binding is gone from the derived block", () => {
    assert.doesNotMatch(DASHBOARD_SRC, /const \{ MODULES \} = lib;/);
    assert.match(DASHBOARD_SRC, /const \{ MODULES: CORE_MODULES \} = lib;/);
  });

  test("HomeView receives both sets under names that say which is which", () => {
    assert.match(DASHBOARD_SRC, /function HomeView\(\{ CORE_MODULES, NAV_MODULES,/);
    assert.doesNotMatch(
      DASHBOARD_SRC,
      /function HomeView\(\{ MODULES,/,
      "HomeView must not take an unqualified MODULES prop"
    );
  });

  test("the scoping decision is imported from one documented place", () => {
    assert.match(
      DASHBOARD_SRC,
      /import \{[^}]*overallProgress[^}]*\} from "@\/components\/dashboard-scope"/s
    );
  });
});

/* ═══════════════ Finding 11: the typeface ═══════════════ */

describe("Finding 11 — app/layout.js must not phone Google", () => {
  test("no fonts.googleapis.com / fonts.gstatic.com references survive", () => {
    assert.doesNotMatch(LAYOUT_SRC, /fonts\.googleapis\.com/);
    assert.doesNotMatch(LAYOUT_SRC, /fonts\.gstatic\.com/);
  });

  test("no remote stylesheet or preconnect at all", () => {
    assert.doesNotMatch(LAYOUT_SRC, /rel="preconnect"/);
    assert.doesNotMatch(LAYOUT_SRC, /rel="stylesheet"/);
    assert.doesNotMatch(LAYOUT_SRC, /href="https?:\/\//);
  });

  test("the typeface is self-hosted via next/font", () => {
    assert.match(LAYOUT_SRC, /from "next\/font\//);
  });
});

describe("Finding 11 — the built export self-hosts the font", () => {
  const OUT = path.join(ROOT, "out");
  const indexHtml = path.join(OUT, "index.html");
  // `npx next build` is not a test dependency; skip rather than fail a fresh
  // clone. CI builds before it tests, so this does run where it matters.
  const built = fs.existsSync(indexHtml);

  test("out/index.html references no Google host", { skip: !built && "run `npx next build` first" }, () => {
    const html = fs.readFileSync(indexHtml, "utf-8");
    assert.doesNotMatch(html, /fonts\.googleapis\.com/);
    assert.doesNotMatch(html, /fonts\.gstatic\.com/);
  });

  test("out/index.html loads no cross-origin stylesheet", { skip: !built && "run `npx next build` first" }, () => {
    const html = fs.readFileSync(indexHtml, "utf-8");
    const sheets = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map((m) => m[0]);
    assert.ok(sheets.length > 0, "the export must ship a stylesheet");
    for (const tag of sheets) {
      assert.doesNotMatch(tag, /href="https?:\/\//, `CSP default-src 'self' blocks: ${tag}`);
    }
  });

  test("the woff2 is emitted into the export and reachable over file://", { skip: !built && "run `npx next build` first" }, () => {
    const media = path.join(OUT, "_next", "static", "media");
    assert.ok(fs.existsSync(media), "next/font must emit self-hosted font files");
    const fonts = fs.readdirSync(media).filter((f) => f.endsWith(".woff2"));
    assert.ok(fonts.length > 0, "at least one self-hosted woff2");

    // Every url() in the emitted CSS must resolve from the CSS file's own
    // location. assetPrefix "./" makes Next emit root-absolute "/_next/..."
    // inside CSS, which 404s under file:// — the exact trap next.config.mjs
    // documents for scripts. Prove the font URLs dodge it.
    const staticDir = path.join(OUT, "_next", "static");
    const cssFiles = fs
      .readdirSync(staticDir, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".css"))
      .map((e) => path.join(e.parentPath ?? e.path, e.name));
    assert.ok(cssFiles.length > 0, "the export must emit CSS");

    let fontUrls = 0;
    for (const file of cssFiles) {
      const css = fs.readFileSync(file, "utf-8");
      for (const m of css.matchAll(/url\(([^)]+)\)/g)) {
        const url = m[1].replace(/^["']|["']$/g, "");
        if (url.startsWith("data:")) continue;
        assert.doesNotMatch(url, /^https?:/, `${file}: remote asset ${url}`);
        assert.doesNotMatch(url, /^\//, `${file}: file:// cannot resolve root-absolute ${url}`);
        const resolved = path.resolve(path.dirname(file), url.split("?")[0]);
        assert.ok(fs.existsSync(resolved), `${path.basename(file)}: url(${url}) missing on disk`);
        if (url.endsWith(".woff2")) fontUrls++;
      }
    }
    assert.ok(fontUrls > 0, "the CSS must actually reference the self-hosted woff2");
  });

  test("@font-face carries the weight range the design asked for", { skip: !built && "run `npx next build` first" }, () => {
    const staticDir = path.join(OUT, "_next", "static");
    const css = fs
      .readdirSync(staticDir, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".css"))
      .map((e) => fs.readFileSync(path.join(e.parentPath ?? e.path, e.name), "utf-8"))
      .join("\n");

    const faces = [...css.matchAll(/@font-face\{[^}]*\}/g)].map((m) => m[0]);
    assert.ok(faces.length > 0, "a self-hosted @font-face must be emitted");
    // The old Google URL asked for wght 400;500;600;700;800. The variable font
    // must cover them, or the fix ships a lighter-looking app.
    assert.ok(
      faces.some((f) => /font-weight:\s*100 900/.test(f)),
      `variable axis must span 100-900; got: ${faces[0]}`
    );
  });

  test("the token override reaches the export and points at next/font", { skip: !built && "run `npx next build` first" }, () => {
    const html = fs.readFileSync(indexHtml, "utf-8");
    // The whole app renders through these two tokens; if the override is not in
    // the shipped HTML the typeface silently reverts to system-ui.
    assert.match(html, /--font-body:[^;]*var\(--font-inter/);
    assert.match(html, /--font-display:[^;]*var\(--font-inter/);
    // ...and something must actually define --font-inter on <html>.
    const htmlTag = html.match(/<html[^>]*>/)[0];
    assert.match(htmlTag, /class="[^"]*variable[^"]*"/, "next/font's variable class must be applied");
  });
});
