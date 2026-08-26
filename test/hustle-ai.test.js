/**
 * test/hustle-ai.test.js
 *
 * The AI in Mock Interview and Resume Builder had NEVER worked, for anyone.
 * Both hand-rolled their own ai:call adapter instead of using lib/ai/client.js,
 * and both read `endpoint.model` — a field that does not exist on a stored
 * endpoint or on an EndpointView (electron/ipc/validators.js says so in its own
 * comment; registry.js's toView returns {...stored-minus-apiKey, hasKey}).
 * Models are DISCOVERED per-call via endpoints:models.
 *
 * So `model` went over the wire as `undefined`, validateAiCallInput threw
 * "model must be a non-empty string", and the user was dropped to the offline
 * path forever (Mock Interview, silently) or shown the raw IPC error string
 * (Resume Builder).
 *
 * HOW THIS TESTS JSX. node has no JSX loader, which is why this repo puts
 * decisions in pure modules (components/settings/endpoints-ui.js) and asserts
 * wiring against source (test/dashboard-scope.test.js). These two components
 * own no such module, so the AI seam is exported from the component files and
 * bundled here with esbuild (already present via vite; dev-time only, and the
 * bundle is written to os.tmpdir, never into the repo). The bundled code is the
 * REAL component code — not a mirror of it.
 *
 * ZERO NETWORK. The bridge is a fake, and its ai.call gates every payload
 * through the REAL electron/ipc/validators.js#validateAiCallInput — the exact
 * gate that rejected these two tools for the whole life of the product. A
 * payload that reaches `bridge.calls` is a payload the production main process
 * would have accepted.
 *
 * Run: `node --test test/hustle-ai.test.js`
 */

import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateAiCallInput } from "../electron/ipc/validators.js";
import { toView } from "../lib/endpoints/registry.js";
import { gradeAnswer } from "../lib/tools/mockInterview.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOCK_SRC = fs.readFileSync(path.join(ROOT, "components", "tools", "MockInterview.js"), "utf-8");
const RESUME_SRC = fs.readFileSync(path.join(ROOT, "components", "tools", "ResumeBuilder.js"), "utf-8");

/**
 * Source with comments removed. Both files now DOCUMENT the `endpoint.model`
 * defect in prose, so the assertion below has to look at code — otherwise the
 * explanation of the bug would read as the bug.
 */
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");
const MOCK_CODE = codeOf(MOCK_SRC);
const RESUME_CODE = codeOf(RESUME_SRC);

/* ───────────────────────── bundling the JSX ───────────────────────── */

let MockInterview;
let ResumeBuilder;

before(async () => {
  const esbuild = await import("esbuild");
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "coop-hustle-ai-"));
  const result = await esbuild.build({
    entryPoints: [
      path.join(ROOT, "components", "tools", "MockInterview.js"),
      path.join(ROOT, "components", "tools", "ResumeBuilder.js"),
    ],
    bundle: true,
    format: "esm",
    platform: "node",
    outdir: outDir,
    write: false,
    jsx: "automatic",
    loader: { ".js": "jsx", ".css": "empty" },
    alias: { "@": ROOT },
    absWorkingDir: ROOT,
  });
  const load = async (name) => {
    const out = result.outputFiles.find((f) => f.path.endsWith(`${name}.js`));
    const file = path.join(outDir, `${name}.mjs`);
    fs.writeFileSync(file, out.text);
    return import(pathToFileUrl(file));
  };
  MockInterview = await load("MockInterview");
  ResumeBuilder = await load("ResumeBuilder");
});

const pathToFileUrl = (p) => new URL(`file://${p}`).href;

/* ───────────────────────── the fake bridge ───────────────────────── */

/**
 * A window.coop stand-in. ai.call is `async` on purpose: contextBridge's
 * ipcRenderer.invoke returns a promise that REJECTS when a main-process
 * validator throws, and that rejection path is the whole defect.
 */
function fakeBridge({ text = "Coach says: quantify the result.", failWith = null, endpoints = [], models = ["claude-sonnet-5"] } = {}) {
  const calls = [];
  const listeners = new Set();
  return {
    calls,
    ai: {
      onStream(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      async call(args) {
        // The real production gate. Throws ValidationError on a bad payload.
        calls.push(validateAiCallInput(args));
        queueMicrotask(() => {
          for (const fn of [...listeners]) {
            if (failWith) fn({ requestId: args.requestId, type: "error", error: failWith });
            else fn({ requestId: args.requestId, type: "done", text });
          }
        });
      },
    },
    endpoints: {
      async list() {
        return endpoints;
      },
      async models() {
        return models;
      },
    },
  };
}

/** An EndpointView exactly as the registry produces it — note: NO `model`. */
const VIEW = toView({
  id: "ep-1",
  label: "Work",
  providerId: "anthropic",
  baseUrl: "https://api.anthropic.com/v1",
  apiKey: "sk-secret-do-not-leak",
  createdAt: 1,
  updatedAt: 1,
});

/* ───────── the field that never existed ───────── */

describe("the root cause: there is no `model` on an EndpointView", () => {
  test("toView returns no model field", () => {
    assert.equal(VIEW.model, undefined);
    assert.equal(Object.hasOwn(VIEW, "model"), false);
    assert.equal(VIEW.hasKey, true);
    assert.equal(VIEW.apiKey, undefined);
  });

  test("so `model: endpoint.model` is exactly what validateAiCallInput rejects", () => {
    assert.throws(
      () =>
        validateAiCallInput({
          endpointId: VIEW.id,
          model: VIEW.model, // what both tools shipped
          requestId: "r-1",
          messages: [{ role: "user", content: "hi" }],
        }),
      /model must be a non-empty string/
    );
  });

  test("neither component reads endpoint.model any more", () => {
    assert.doesNotMatch(MOCK_CODE, /endpoint\s*\??\.\s*model/, "MockInterview.js still reads endpoint.model");
    assert.doesNotMatch(RESUME_CODE, /endpoint\s*\??\.\s*model/, "ResumeBuilder.js still reads endpoint.model");
  });
});

/* ───────── wiring: the tested client, not a third adapter ───────── */

describe("both tools go through lib/ai/client.js", () => {
  for (const [name, src] of [
    ["MockInterview.js", MOCK_CODE],
    ["ResumeBuilder.js", RESUME_CODE],
  ]) {
    test(`${name} imports callLLM from lib/ai/client`, () => {
      assert.match(src, /import\s*\{[^}]*\bcallLLM\b[^}]*\}\s*from\s*["']@\/lib\/ai\/client["']/);
    });

    test(`${name} discovers models via endpoints.models()`, () => {
      assert.match(src, /\.models\(/, `${name} never calls endpoints:models — model can only be undefined`);
    });

    test(`${name} calls ensureLegacyAIConfigMigrated — the documented per-surface contract`, () => {
      assert.match(src, /ensureLegacyAIConfigMigrated\(/);
    });

    test(`${name} hand-rolls no second stream adapter`, () => {
      assert.doesNotMatch(src, /onStream\(/, `${name} still hand-rolls the ai:stream protocol`);
    });
  }
});

/* ───────── MockInterview: the AI path actually reaches the bridge ───────── */

describe("MockInterview — the AI seam", () => {
  const QUESTION = {
    question: "Tell me about a time you found an error in someone else's work.",
    type: "behavioral",
    looksFor: ["a specific number"],
    modelNote: "",
  };
  const ANSWER =
    "At the credit union I reconciled a 100-record loan export and found 6 duplicate entries, " +
    "so I rebuilt the dedupe step and cut manual review by 4 hours a week.";

  test("reaches the bridge with a REAL discovered model id, and the payload passes the production validator", async () => {
    const bridge = fakeBridge({ text: "Strong STAR. Quantify the result next time." });
    const llm = MockInterview.createInterviewLlm({ bridge, endpointId: VIEW.id, model: "claude-sonnet-5" });
    assert.equal(typeof llm, "function", "no llm was built for a configured endpoint");

    const result = await gradeAnswer({ question: QUESTION, answer: ANSWER }, llm);

    assert.equal(bridge.calls.length, 1, "the AI call never reached the bridge");
    assert.equal(bridge.calls[0].model, "claude-sonnet-5");
    assert.equal(bridge.calls[0].endpointId, VIEW.id);
    assert.equal(result.source, "ai");
    assert.equal(result.aiText, "Strong STAR. Quantify the result next time.");
    assert.equal(result.notice, "");
  });

  test("no apiKey is ever put on the wire", async () => {
    const bridge = fakeBridge();
    const llm = MockInterview.createInterviewLlm({ bridge, endpointId: VIEW.id, model: "claude-sonnet-5" });
    await gradeAnswer({ question: QUESTION, answer: ANSWER }, llm);
    assert.doesNotMatch(JSON.stringify(bridge.calls), /sk-secret/);
    assert.equal(bridge.calls[0].apiKey, undefined);
  });

  test("a stream error arrives as a STRING (handlers.js sends String(err)) and still yields an actionable notice", async () => {
    const bridge = fakeBridge({ failWith: "upstream 503 from provider" });
    const llm = MockInterview.createInterviewLlm({ bridge, endpointId: VIEW.id, model: "claude-sonnet-5" });
    const result = await gradeAnswer({ question: QUESTION, answer: ANSWER }, llm);

    assert.equal(result.source, "offline");
    assert.ok(result.feedback.score >= 0, "the offline rubric is still returned");
    assert.match(result.notice, /Settings/, "the failure notice must name Settings, not dead-end");
    assert.doesNotMatch(result.notice, /Error invoking remote method/);
  });

  test("no bridge at all: no llm is built, and the offline rubric is a complete product", async () => {
    const llm = MockInterview.createInterviewLlm({ bridge: null, endpointId: "", model: "" });
    assert.equal(llm, null);

    const result = await gradeAnswer({ question: QUESTION, answer: ANSWER }, llm ?? undefined);
    assert.equal(result.ok, true);
    assert.equal(result.source, "offline");
    assert.ok(result.feedback.breakdown.length > 0);
    assert.ok(result.feedback.improvement);
  });

  test("an endpoint with no discovered model builds no llm — an undefined model must never reach the wire", () => {
    const bridge = fakeBridge();
    assert.equal(MockInterview.createInterviewLlm({ bridge, endpointId: VIEW.id, model: "" }), null);
    assert.equal(MockInterview.createInterviewLlm({ bridge, endpointId: VIEW.id, model: undefined }), null);
  });
});

/* ───────── ResumeBuilder: the AI seam ───────── */

describe("ResumeBuilder — the AI seam", () => {
  const SLOTS = { bullet: "Helped with loan data", targetRole: "Analyst", keywords: "Excel" };

  test("reaches the bridge with a REAL discovered model id and returns the rewritten bullet", async () => {
    const bridge = fakeBridge({ text: "Analyzed a 100-record loan dataset, cutting review time 4 hrs/week." });
    const result = await ResumeBuilder.rewriteBulletWithAi({
      bridge,
      endpointId: VIEW.id,
      model: "claude-sonnet-5",
      slots: SLOTS,
    });

    assert.equal(bridge.calls.length, 1, "the AI call never reached the bridge");
    assert.equal(bridge.calls[0].model, "claude-sonnet-5");
    assert.equal(result.ok, true);
    assert.match(result.text, /100-record loan dataset/);
  });

  test("a failure NEVER surfaces a raw IPC error string", async () => {
    const bridge = fakeBridge({ failWith: "Error invoking remote method 'ai:call': ValidationError: model must be a non-empty string" });
    const result = await ResumeBuilder.rewriteBulletWithAi({
      bridge,
      endpointId: VIEW.id,
      model: "claude-sonnet-5",
      slots: SLOTS,
    });
    assert.equal(result.ok, false);
    assert.doesNotMatch(result.message, /Error invoking remote method/, "the raw IPC string leaked into the UI");
    assert.ok(result.message.length > 0);
  });

  test("no endpoint: the needsSettings branch is REACHABLE (it was dead code) and the bullet is untouched", async () => {
    const bridge = fakeBridge();
    const result = await ResumeBuilder.rewriteBulletWithAi({ bridge, endpointId: "", model: "", slots: SLOTS });
    assert.equal(result.ok, false);
    assert.equal(result.needsSettings, true, "needsSettings never fires — the Settings prompt is dead code");
    assert.equal(bridge.calls.length, 0);
  });

  test("no bridge: an honest message, no throw, no silent success", async () => {
    const result = await ResumeBuilder.rewriteBulletWithAi({ bridge: null, endpointId: "", model: "", slots: SLOTS });
    assert.equal(result.ok, false);
    assert.match(result.message, /desktop app/);
  });

  test("no apiKey is ever put on the wire", async () => {
    const bridge = fakeBridge();
    await ResumeBuilder.rewriteBulletWithAi({ bridge, endpointId: VIEW.id, model: "claude-sonnet-5", slots: SLOTS });
    assert.doesNotMatch(JSON.stringify(bridge.calls), /sk-secret/);
  });
});
