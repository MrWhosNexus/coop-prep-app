// test/helpers/render.mjs
// The DOM harness: mount a real React component, read what it rendered,
// click it, and change its props.
//
// WHY THIS EXISTS
// ---------------
// Every other test in this suite tests a pure module or an adapter seam. That
// is most of the value, but it leaves a hole big enough to ship a bug through:
// a component can be wired to correct modules and still render the wrong
// thing, because the wrongness lives in useMemo/useRef/state -- not in any
// function a unit test can call. MatchGame's results screen did exactly that
// (see test/games-ui.test.js) and the suite stayed green.
//
// This file is deliberately small. It is a seam, not a framework: mount, read,
// click, re-render, unmount. If you need more, add the smallest thing that
// makes your bug visible -- do not grow this into a testing-library clone.
//
// HOW IT WORKS
// ------------
// Two problems stand between `node --test` and a React component:
//
//   1. node cannot parse JSX. Registered below as an ESM loader hook that runs
//      project .js/.jsx through esbuild's jsx transform. The same hook resolves
//      the `@/*` alias from jsconfig.json and stubs `.css` imports (GameHost
//      imports ./games.css, which node would choke on).
//   2. React needs a DOM. happy-dom provides one, installed lazily on the first
//      render() so that the ~1900 non-UI tests never pay for it and never see
//      a `window` they did not ask for.
//
// This module registers its own loader hooks by pointing `register()` at
// itself; in the hooks thread `isMainThread` is false, which is the guard that
// keeps that from recursing. It is wired into `npm test` via
// `node --test --import ./test/helpers/render.mjs`.
//
// Two consequences of that wiring, both load-bearing:
//
//   * Run tests with `npm test`, not bare `node --test`. The --import flag is
//     what registers the transform; without it any test file containing JSX
//     fails to parse. There is no way around this from inside the test file --
//     static imports are hoisted, so a component import is parsed before any
//     line of that file could register a hook.
//   * node treats EVERY file under test/ as a test file (`**/test/**/*.js`),
//     so this helper is itself "run" as a zero-test file and shows up as one
//     passing test in the totals. Harmless, but that is where the spare +1 in
//     the count comes from.
//
// WHAT THIS CANNOT DO
// -------------------
// Known and accepted limits. If one of these bites you, that is a signal to
// reach for a real browser, not to paper over it here:
//
//   * No layout, no real CSS. happy-dom does not lay anything out: offsetWidth
//     is 0, nothing is "visible" or "covered". `.css` imports are stubbed to an
//     empty module, so class names render but style nothing. Never assert on
//     geometry, and never let a test imply a user could SEE something.
//   * click() dispatches a real bubbling MouseEvent, but it does not check that
//     the element is reachable -- a button under an overlay still clicks. It
//     does respect `disabled`, because happy-dom does.
//   * Only click and change are exposed. No keyboard, no focus management, no
//     drag, no pointer events, no hover.
//   * No timer control. Countdown-driven behaviour (GameHost's useCountdown)
//     runs on real time; drive completion through the UI instead of waiting for
//     a clock, or pass `seconds: null` to play untimed.
//   * No network, no fetch stubbing, no next/navigation or next/image support.
//     A component that reaches for those needs its dependency injected.
//   * act() flushes React work synchronously, but nothing here waits on a
//     promise chain you did not await yourself.

import { register, registerHooks } from "node:module";

/*
 * Node floor check, first thing, because the failure it replaces is unreadable.
 *
 * Three test files (ai-bridge, endpoints, electron-shell) use registerHooks()
 * to swap the "electron" specifier for a stub in-process. That API landed in
 * Node 22.15; on anything older the suite dies with
 *
 *     SyntaxError: The requested module 'node:module' does not provide an
 *     export named 'registerHooks'
 *
 * which says nothing about Node versions and sends people looking for a broken
 * import. This file is the shared --import hook for `npm test`, so it is the one
 * place the check runs exactly once for every possible entry point.
 *
 * Found the hard way: the suite was green on the author's Node 22 and dead on
 * all three CI runners pinned to Node 20.
 */
if (typeof registerHooks !== "function") {
  console.error(
    `\nThis test suite needs Node 22.15 or newer. You are on ${process.version}.\n\n` +
      "  node:module's registerHooks() is missing, which the electron-stubbing\n" +
      "  tests depend on. Upgrade Node, then run npm test again.\n\n" +
      "  https://nodejs.org — or `nvm install 22 && nvm use 22`\n"
  );
  process.exit(1);
}
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";
import { isMainThread } from "node:worker_threads";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..");

/* ══════════════════════════════════════════════════════════════════════
   Loader hooks. These run in the hooks thread (isMainThread === false).
   ══════════════════════════════════════════════════════════════════════ */

/** Marker scheme for a stubbed stylesheet import. */
const CSS_STUB = "coop-css-stub:";

const CSS_RE = /\.(css|scss|sass|less)$/;
/** Project source we are willing to run through the JSX transform. */
const TRANSFORMABLE_RE = /\.(js|jsx)$/;

/**
 * Try a specifier, then the extensions Next would have tried for it. Next
 * resolves `./GameHost` and `@/lib/games/scoring` extensionlessly; node does
 * not, so a component that is perfectly valid in the app is unresolvable in a
 * test without this.
 */
async function resolveExtensionless(base, context, nextResolve) {
  let firstError;
  for (const candidate of [base, `${base}.js`, `${base}.jsx`, `${base}/index.js`]) {
    try {
      return await nextResolve(candidate, context);
    } catch (err) {
      firstError ??= err;
    }
  }
  throw firstError;
}

/**
 * Resolve `@/*` to the repo root, add Next's extension guessing, and divert
 * stylesheet imports to a stub. Everything else falls through to node's own
 * resolver untouched.
 */
export async function resolve(specifier, context, nextResolve) {
  if (CSS_RE.test(specifier)) {
    return { url: CSS_STUB + specifier, shortCircuit: true, format: "module" };
  }

  if (specifier.startsWith("@/")) {
    return resolveExtensionless(
      pathToFileURL(resolvePath(ROOT, specifier.slice(2))).href, context, nextResolve,
    );
  }

  // Extensionless relative import from project source (`./GameHost`). Bare
  // specifiers are left alone -- those are node_modules and resolve normally.
  const relative = specifier.startsWith("./") || specifier.startsWith("../");
  if (relative && !/\.[a-z0-9]+$/i.test(specifier) && context.parentURL?.startsWith("file:")) {
    return resolveExtensionless(new URL(specifier, context.parentURL).href, context, nextResolve);
  }

  return nextResolve(specifier, context);
}

/**
 * Serve stubbed stylesheets as empty modules, and run project JS/JSX through
 * esbuild so `node --test` can parse it. node_modules is never transformed.
 */
export async function load(url, context, nextLoad) {
  if (url.startsWith(CSS_STUB)) {
    return { format: "module", source: "export default {};", shortCircuit: true };
  }

  const isProjectSource =
    url.startsWith("file:") &&
    TRANSFORMABLE_RE.test(url.split("?")[0]) &&
    !url.includes("/node_modules/");

  if (!isProjectSource) return nextLoad(url, context);

  const path = fileURLToPath(url);
  const source = await readFile(path, "utf8");

  // Imported lazily: the ~1900 non-UI tests load this hook but never hit a
  // file that needs it, and esbuild is a devDependency we should not make
  // them pay to import.
  const { transform } = await import("esbuild");
  const out = await transform(source, {
    loader: "jsx",
    jsx: "automatic",
    format: "esm",
    // Transform JSX and nothing else. Anything node 24 already understands is
    // passed through verbatim, so a component under test runs as written.
    target: "esnext",
    sourcefile: path,
    sourcemap: "inline",
  });

  return { format: "module", source: out.code, shortCircuit: true };
}

// Self-register. In the hooks thread isMainThread is false, which stops this
// from recursing when node imports this same file to read the hooks above.
if (isMainThread) register(import.meta.url);

/* ══════════════════════════════════════════════════════════════════════
   DOM. Installed on first render(), never at import time.
   ══════════════════════════════════════════════════════════════════════ */

/**
 * The DOM globals we publish onto globalThis, named explicitly.
 *
 * Deliberately a list and not a copy-everything loop. Blanket-copying a
 * happy-dom Window over globalThis crashes node natively (it clobbers
 * internals node assumes it owns), and even where it survives it hands
 * node:test and React a mix of two runtimes' timers and events. An allowlist
 * fails honestly instead: a missing global is a clear ReferenceError naming
 * exactly what to add here.
 *
 * `document`, `window` and `navigator` are set separately below.
 */
const DOM_GLOBALS = [
  // Core node types React constructs and instanceof-checks against.
  "Node", "Element", "HTMLElement", "HTMLInputElement", "HTMLTextAreaElement",
  "HTMLSelectElement", "HTMLButtonElement", "HTMLFormElement", "HTMLAnchorElement",
  "HTMLIFrameElement", "HTMLUnknownElement", "SVGElement", "Text", "Comment",
  "DocumentFragment", "DocumentType", "Document", "ShadowRoot",
  // Events. React synthesizes from these, so they must be happy-dom's own --
  // node's global Event would fail happy-dom's internal instanceof checks.
  "Event", "CustomEvent", "MouseEvent", "KeyboardEvent", "InputEvent",
  "FocusEvent", "PointerEvent", "SubmitEvent", "EventTarget",
  // Things React and components reach for by name.
  "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame",
  "MutationObserver", "ResizeObserver", "IntersectionObserver", "matchMedia",
  "location", "history", "localStorage", "sessionStorage", "screen",
  "CSS", "Range", "NodeFilter", "DOMParser", "XMLSerializer", "Image",
];

let dom = null;

/**
 * Install a happy-dom window onto globalThis. Idempotent.
 *
 * Node's own timers, console, process and Buffer are left alone on purpose:
 * node:test schedules on them, and swapping in happy-dom's makes a failure
 * surreal to debug.
 *
 * @returns {Promise<object>} the happy-dom Window
 */
export async function installDom() {
  if (dom) return dom;

  const { Window } = await import("happy-dom");
  const win = new Window({ url: "http://localhost/" });

  for (const key of DOM_GLOBALS) {
    if (win[key] === undefined) continue;
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: typeof win[key] === "function" && !/^[A-Z]/.test(key)
        ? win[key].bind(win)   // getComputedStyle & friends need their window
        : win[key],
    });
  }

  // defineProperty rather than assignment: node 24 ships `navigator` as a
  // getter-only global, so `globalThis.navigator = ...` throws.
  for (const [key, value] of [["window", win], ["document", win.document], ["navigator", win.navigator]]) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  // React refuses to run act() without this, and warns on every update.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  dom = win;
  return win;
}

/* ══════════════════════════════════════════════════════════════════════
   The render seam.
   ══════════════════════════════════════════════════════════════════════ */

/** Collapse rendered whitespace so assertions read like the screen does. */
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/**
 * Mount a React element into a fresh container.
 *
 * @param {import("react").ReactElement} element
 * @returns {Promise<object>} handle -- see the methods below
 *
 * @example
 * const ui = await render(<MatchGame concepts={pool} />);
 * await ui.click(ui.button("Fair lending"));
 * assert.match(ui.text(), /Round complete/);
 * await ui.rerender(<MatchGame concepts={otherPool} />);
 * await ui.unmount();
 */
export async function render(element) {
  await installDom();

  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => { root.render(element); });

  const handle = {
    container,

    /** Everything the component rendered, as visible text. */
    text: () => norm(container.textContent),

    /** First match, or null. */
    find: (selector) => container.querySelector(selector),

    /** All matches, as a real array. */
    findAll: (selector) => [...container.querySelectorAll(selector)],

    /**
     * Find a <button> by its text. Pass a string for an exact (whitespace-
     * normalized) match, or a RegExp to search. Throws if nothing matches,
     * because a silent null here reads as "the click did nothing".
     */
    button: (match) => {
      const buttons = [...container.querySelectorAll("button")];
      const hit = buttons.find((b) =>
        match instanceof RegExp ? match.test(norm(b.textContent)) : norm(b.textContent) === match);
      if (!hit) {
        const seen = buttons.map((b) => JSON.stringify(norm(b.textContent))).join(", ");
        throw new Error(`No button matching ${match}. Rendered buttons: [${seen}]`);
      }
      return hit;
    },

    /**
     * Click an element (or a CSS selector), flushing the resulting React work.
     * Respects `disabled` exactly as the DOM does.
     */
    click: async (target) => {
      const el = typeof target === "string" ? container.querySelector(target) : target;
      if (!el) throw new Error(`Nothing to click for ${target}`);
      await act(async () => { el.click(); });
    },

    /** Set an input's value and fire `change`, the way React expects. */
    change: async (target, value) => {
      const el = typeof target === "string" ? container.querySelector(target) : target;
      if (!el) throw new Error(`Nothing to change for ${target}`);
      await act(async () => {
        el.value = value;
        el.dispatchEvent(new window.Event("input", { bubbles: true }));
        el.dispatchEvent(new window.Event("change", { bubbles: true }));
      });
    },

    /** Re-render into the SAME root -- this is a prop change, not a remount. */
    rerender: async (next) => { await act(async () => { root.render(next); }); },

    /** Flush pending React work without touching the tree. */
    flush: async () => { await act(async () => {}); },

    unmount: async () => {
      await act(async () => { root.unmount(); });
      container.remove();
    },
  };

  return handle;
}
