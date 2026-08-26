// test/asar-unpack-voice-deps.test.js
//
// Ported from nexus/test/main/asar-unpack-voice-deps.test.ts.
//
// electron/voice/tts-worker.js and stt-worker.js run as FORKED plain-node
// children (ELECTRON_RUN_AS_NODE, no asar support) and import their engines
// at runtime: the STT worker `import('@huggingface/transformers')` (Whisper),
// the TTS worker `import('kokoro-js')` (which pulls in transformers +
// phonemizer). A bare specifier is resolved from node_modules ON DISK — so
// BOTH roots AND every package they can reach must be asarUnpack'd in
// electron-builder.yml, or the child dies with "Cannot find package" and
// voice is dead in the packaged app. This shipped broken in Nexus (the exact
// pattern this is ported from) TWICE, each caught only by driving the
// packaged app, never by a green test suite — nothing else here loads the
// real packaged asar. Root the walk at what the workers actually import, so
// a future dep bump can't silently regress this.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

const WORKER_IMPORT_ROOTS = ["kokoro-js", "@huggingface/transformers"];

describe("electron-builder asarUnpack covers the voice workers' full runtime JS closure", () => {
  const yml = readFileSync(join(repoRoot, "electron-builder.yml"), "utf8");

  // A package is "covered" if a `**/node_modules/<pkg>/**` (or a parent scope
  // like @huggingface/**) unpack glob is present in the config.
  const covered = (pkg) => {
    if (yml.includes(`node_modules/${pkg}/`)) return true;
    if (pkg.startsWith("@")) {
      const scope = pkg.split("/")[0];
      return yml.includes(`node_modules/${scope}/**`);
    }
    return false;
  };

  // A package only needs unpacking if it actually loads JS at runtime.
  // Type-only packages (no main/module/exports/bin/index.*) are never
  // `require`d by the worker, so they can stay packed. Mirror that here or
  // the test demands unpacking dead weight.
  const hasJsEntry = (pkg) => {
    const dir = join(repoRoot, "node_modules", pkg);
    const pj = join(dir, "package.json");
    if (!existsSync(pj)) return false;
    const p = JSON.parse(readFileSync(pj, "utf8"));
    if (p.main || p.module || p.exports || p.bin) return true;
    return ["index.js", "index.cjs", "index.mjs"].some((f) => existsSync(join(dir, f)));
  };

  /**
   * Resolve the entry file Node would load for `pkg`, honouring the "node" and
   * "import" export conditions. This matters: @huggingface/transformers ships
   * SEPARATE web and node builds, and the workers are plain Node.
   *
   * @param {string} pkg
   * @returns {string|null} absolute path, or null when it cannot be determined
   */
  const nodeEntryFor = (pkg) => {
    const dir = join(repoRoot, "node_modules", pkg);
    const pjPath = join(dir, "package.json");
    if (!existsSync(pjPath)) return null;
    const pj = JSON.parse(readFileSync(pjPath, "utf8"));
    const pick = (node) => {
      if (typeof node === "string") return node;
      if (!node || typeof node !== "object") return null;
      for (const key of ["node", "import", "require", "default"]) {
        if (key in node) {
          const hit = pick(node[key]);
          if (hit) return hit;
        }
      }
      return null;
    };
    const rel = pick(pj.exports?.["."] ?? pj.exports) ?? pj.module ?? pj.main;
    if (!rel) return null;
    const abs = join(dir, rel);
    return existsSync(abs) ? abs : null;
  };

  /** Bare specifiers statically imported/required by a file. */
  const importsOf = (file) => {
    const src = readFileSync(file, "utf8");
    const out = new Set();
    const patterns = [
      /(?:^|[^\w$])(?:import|export)[^;'"\n]*?from\s*["']([^"'.][^"']*)["']/g,
      /(?:^|[^\w$])import\s*\(\s*["']([^"'.][^"']*)["']\s*\)/g,
      /(?:^|[^\w$])require\s*\(\s*["']([^"'.][^"']*)["']\s*\)/g,
    ];
    for (const re of patterns) {
      for (const m of src.matchAll(re)) {
        const spec = m[1];
        if (spec.startsWith("node:")) continue;
        // "@scope/name" or "name" — drop any subpath.
        const parts = spec.split("/");
        out.add(spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]);
      }
    }
    return out;
  };

  /**
   * Packages in the DECLARED dependency closure that the Node entry graph can
   * never actually load, and so do not need unpacking.
   *
   *   onnxruntime-web — @huggingface/transformers declares it, but its "node"
   *     export condition resolves to dist/transformers.node.mjs, which imports
   *     only onnxruntime-common and onnxruntime-node. Verified empirically as
   *     well: with node_modules/onnxruntime-web moved off disk entirely, both
   *     local STT and local TTS still transcribe and synthesize. Unpacking it
   *     would add ~91 MB of WASM to every build that nothing ever loads.
   *     Its own deps (flatbuffers, protobufjs, long, platform, …) leave the
   *     closure with it, being reachable only through it.
   *
   * This is NOT a convenience list. The test below re-derives the claim from
   * the resolved Node module graph on every run, so the day a dep bump makes
   * the node build import onnxruntime-web, this stops being exempt and the
   * suite fails again.
   */
  const NODE_UNREACHABLE = ["onnxruntime-web"];

  // Walk the runtime deps transitively from the real installed tree.
  const closure = new Set();
  const seen = new Set();
  const visit = (pkg) => {
    if (seen.has(pkg)) return;
    seen.add(pkg);
    if (NODE_UNREACHABLE.includes(pkg)) return; // see above; re-verified below
    const pj = join(repoRoot, "node_modules", pkg, "package.json");
    if (!existsSync(pj)) return; // not installed at top level -> hoisting differs; skip
    if (hasJsEntry(pkg)) closure.add(pkg);
    const deps = JSON.parse(readFileSync(pj, "utf8")).dependencies || {};
    for (const d of Object.keys(deps)) visit(d);
  };
  WORKER_IMPORT_ROOTS.forEach(visit);

  test("the NODE_UNREACHABLE exemptions are still unreachable on the node condition", () => {
    // The proof obligation for the list above. Walks what Node would ACTUALLY
    // load from the worker roots and asserts no exempted package appears. An
    // exemption that stopped being true would otherwise sit here forever,
    // silently hiding a package the packaged worker really needs.
    const reached = new Set();
    const walk = (pkg) => {
      if (reached.has(pkg)) return;
      reached.add(pkg);
      const entry = nodeEntryFor(pkg);
      if (!entry) return;
      for (const spec of importsOf(entry)) walk(spec);
    };
    WORKER_IMPORT_ROOTS.forEach(walk);

    for (const pkg of NODE_UNREACHABLE) {
      assert.ok(
        !reached.has(pkg),
        `${pkg} IS reachable from the worker roots on the node condition — it must be ` +
          `removed from NODE_UNREACHABLE and added to electron-builder.yml's asarUnpack`,
      );
    }
    // The walk must actually be walking, or the assertion above is vacuous.
    assert.ok(reached.has("onnxruntime-node"), "the node graph resolves onnxruntime-node");
  });

  test("both worker import roots are unpacked", () => {
    for (const root of WORKER_IMPORT_ROOTS) {
      assert.ok(covered(root), `${root} must be asarUnpack'd (a forked worker imports it)`);
    }
  });

  test("every reachable runtime dependency is unpacked too", () => {
    const missing = [...closure].filter((p) => !covered(p));
    assert.deepEqual(
      missing,
      [],
      `these voice-stack deps are packed inside app.asar and the forked worker cannot load them: ${missing.join(", ")}`,
    );
  });

  // A file under electron/voice/ is unpacked if the yml lists it exactly OR
  // unpacks the whole dir (electron/voice/** or electron/voice/*).
  const voiceFileCovered = (relPath) =>
    yml.includes(relPath) ||
    yml.includes("electron/voice/**") ||
    yml.includes("electron/voice/*");

  test("both worker scripts themselves are unpacked", () => {
    for (const file of ["electron/voice/tts-worker.js", "electron/voice/stt-worker.js"]) {
      assert.ok(
        voiceFileCovered(file),
        `${file} must be asarUnpack'd — it runs as a forked plain-node child with no asar support`,
      );
    }
  });

  // The workers import shared constants/helpers from their siblings
  // (`import ... from "./stt-local.js"`). A forked plain-node child cannot read
  // those out of app.asar either, so every relative sibling a worker imports
  // must ALSO be unpacked. The packaged worker died with "Cannot find module
  // '.../electron/voice/stt-local.js'" until this was covered — found by
  // forking the PACKAGED worker, not by any earlier assertion.
  test("every sibling module the workers import is unpacked too", () => {
    for (const workerRel of ["electron/voice/tts-worker.js", "electron/voice/stt-worker.js"]) {
      const src = readFileSync(join(repoRoot, workerRel), "utf8");
      const dir = dirname(workerRel);
      const siblingImports = [...src.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g)].map((m) => m[1]);
      for (const spec of siblingImports) {
        const rel = join(dir, spec).replaceAll("\\", "/");
        assert.ok(
          voiceFileCovered(rel),
          `${workerRel} imports "${spec}" (→ ${rel}), which must be asarUnpack'd or the forked worker cannot load it`,
        );
      }
    }
  });
});
