// test/companion-main.test.js
//
// Main-process half of the Nexus-companion port: the hermes:* / hub:* IPC
// validators, the userData-backed Hub store, and the Hermes runtime's argv +
// scrubEnv construction. Everything here is Electron-free and runs under plain
// `node --test` — the Hermes runtime is exercised with an INJECTED fake spawn,
// never a live child, so no shell is ever started by this suite.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";

import {
  ValidationError,
  validateHermesRun,
  validateHermesCancel,
  validateHubSave,
} from "../electron/ipc/validators.js";

import { createHubStore, isHubItem } from "../electron/companion/hub-store.js";
import {
  createHermesRuntime,
  scrubEnv,
  resolveHermesBin,
  buildHermesArgs,
} from "../electron/companion/hermes-runtime.js";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "coop-companion-test-"));
}

// ---------- validators: hermes:run ----------

test("validateHermesRun: accepts a well-formed prompt + requestId", () => {
  const r = validateHermesRun({ prompt: "list my files", requestId: "req-1" });
  assert.deepEqual(r, { prompt: "list my files", requestId: "req-1" });
});

test("validateHermesRun: rejects empty prompt", () => {
  assert.throws(() => validateHermesRun({ prompt: "  ", requestId: "r" }), ValidationError);
  assert.throws(() => validateHermesRun({ prompt: "", requestId: "r" }), ValidationError);
  assert.throws(() => validateHermesRun({ requestId: "r" }), ValidationError);
});

test("validateHermesRun: rejects a prompt over the cap", () => {
  const huge = "a".repeat(8001);
  assert.throws(() => validateHermesRun({ prompt: huge, requestId: "r" }), /prompt must be under/);
});

test("validateHermesRun: rejects missing requestId", () => {
  assert.throws(() => validateHermesRun({ prompt: "hi" }), ValidationError);
  assert.throws(() => validateHermesRun({ prompt: "hi", requestId: "" }), ValidationError);
});

test("validateHermesRun: rejects a non-object", () => {
  assert.throws(() => validateHermesRun(null), ValidationError);
  assert.throws(() => validateHermesRun("nope"), ValidationError);
});

// ---------- validators: hermes:cancel ----------

test("validateHermesCancel: requires a requestId (no abort-all)", () => {
  assert.deepEqual(validateHermesCancel({ requestId: "x" }), { requestId: "x" });
  assert.throws(() => validateHermesCancel({}), ValidationError);
  assert.throws(() => validateHermesCancel({ requestId: "" }), ValidationError);
});

// ---------- validators: hub:save ----------

test("validateHubSave: accepts a well-formed item list and strips extras", () => {
  const r = validateHubSave({
    items: [
      {
        id: "a",
        at: "2026-07-16T00:00:00Z",
        artifact: { kind: "note", title: "T", content: "C", fullscreen: true, sneaky: "x" },
        rogue: 1,
      },
    ],
  });
  assert.deepEqual(r.items, [
    { id: "a", at: "2026-07-16T00:00:00Z", artifact: { kind: "note", title: "T", content: "C", fullscreen: true } },
  ]);
});

test("validateHubSave: accepts an empty list", () => {
  assert.deepEqual(validateHubSave({ items: [] }), { items: [] });
});

test("validateHubSave: rejects a non-array items", () => {
  assert.throws(() => validateHubSave({ items: {} }), ValidationError);
  assert.throws(() => validateHubSave({}), ValidationError);
});

test("validateHubSave: rejects a malformed artifact", () => {
  assert.throws(
    () => validateHubSave({ items: [{ id: "a", at: "t", artifact: { kind: "note", title: "T" } }] }),
    /items\[0\]\.artifact\.content must be a string/
  );
  assert.throws(
    () => validateHubSave({ items: [{ id: "a", at: "t", artifact: "no" }] }),
    /items\[0\]\.artifact must be an object/
  );
  assert.throws(
    () => validateHubSave({ items: [{ id: 1, at: "t", artifact: { kind: "n", title: "t", content: "c" } }] }),
    /items\[0\]\.id must be a string/
  );
});

test("validateHubSave: rejects a non-boolean fullscreen", () => {
  assert.throws(
    () =>
      validateHubSave({
        items: [{ id: "a", at: "t", artifact: { kind: "n", title: "t", content: "c", fullscreen: "yes" } }],
      }),
    /fullscreen must be a boolean/
  );
});

// ---------- hub-store: shape + round-trip ----------

test("isHubItem: guards the persisted shape", () => {
  assert.equal(isHubItem({ id: "a", at: "t", artifact: { kind: "k", title: "t", content: "c" } }), true);
  assert.equal(isHubItem({ id: "a", at: "t", artifact: { kind: "k", title: "t" } }), false);
  assert.equal(isHubItem(null), false);
  assert.equal(isHubItem({ id: 1, at: "t", artifact: { kind: "k", title: "t", content: "c" } }), false);
});

test("createHubStore: load on a fresh dir returns an empty Hub, no throw", async () => {
  const store = createHubStore({ userDataDir: tmpDir() });
  assert.deepEqual(await store.load(), { ok: true, items: [] });
});

test("createHubStore: save then load round-trips text items oldest-first", async () => {
  const store = createHubStore({ userDataDir: tmpDir() });
  const items = [
    { id: "1", at: "2026-01-01", artifact: { kind: "note", title: "First", content: "one" } },
    { id: "2", at: "2026-01-02", artifact: { kind: "code", title: "Second", content: "two" } },
  ];
  assert.deepEqual(await store.save(items), { ok: true });
  const loaded = await store.load();
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.items, items);
});

test("createHubStore: save drops imageLoading placeholders", async () => {
  const store = createHubStore({ userDataDir: tmpDir() });
  const items = [
    { id: "1", at: "t", artifact: { kind: "imageLoading", title: "Generating…", content: "" } },
    { id: "2", at: "t", artifact: { kind: "note", title: "Kept", content: "yes" } },
  ];
  await store.save(items);
  const loaded = await store.load();
  assert.deepEqual(
    loaded.items.map((i) => i.id),
    ["2"]
  );
});

test("createHubStore: image data: URI is written to disk and re-inlined on load", async () => {
  const dir = tmpDir();
  const store = createHubStore({ userDataDir: dir });
  // 1x1 transparent PNG
  const b64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  const items = [
    { id: "img1", at: "t", artifact: { kind: "image", title: "Pic", content: `data:image/png;base64,${b64}` } },
  ];
  assert.deepEqual(await store.save(items), { ok: true });

  // On disk, hub.json must NOT carry the base64 blob — it holds a file:// ref.
  const raw = fs.readFileSync(store.hubFilePath, "utf8");
  assert.ok(!raw.includes(b64), "base64 blob must not be inlined in hub.json");
  assert.ok(raw.includes("file://"), "hub.json must keep a file:// ref");
  // The basename is derived by hashing the item id, not taken from it: an id is
  // renderer-supplied and a `..` in one used to escape this directory. So assert
  // the bytes landed here, not the specific name. See test/hub-store-path-safety.test.js.
  const written = fs.readdirSync(store.hubImagesDir);
  assert.equal(written.length, 1, "image bytes written to disk");
  assert.match(written[0], /^[a-f0-9]{32}\.png$/, "basename is derived, not the raw id");
  assert.equal(fs.readFileSync(path.join(store.hubImagesDir, written[0])).toString("base64"), b64);

  // On load it is re-inlined to a data: URI so it renders under CSP.
  const loaded = await store.load();
  assert.equal(loaded.items[0].artifact.content, `data:image/png;base64,${b64}`);
});

test("createHubStore: corrupt hub.json loads as empty, never throws", async () => {
  const dir = tmpDir();
  const store = createHubStore({ userDataDir: dir });
  fs.mkdirSync(path.dirname(store.hubFilePath), { recursive: true });
  fs.writeFileSync(store.hubFilePath, "{ not json");
  assert.deepEqual(await store.load(), { ok: true, items: [] });
});

test("createHubStore: requires a userDataDir", () => {
  assert.throws(() => createHubStore({}), /userDataDir/);
});

// ---------- hermes runtime: scrubEnv (the security invariant) ----------

test("scrubEnv: strips everything key-shaped, keeps benign vars", () => {
  const out = scrubEnv({
    PATH: "/usr/bin",
    HOME: "/home/merk",
    MINIMAX_API_KEY: "secret",
    NEXUS_TOKEN: "tok",
    ANTHROPIC_API_KEY: "sk-xxx",
    GITHUB_TOKEN: "ghp_xxx",
    MY_SECRET: "s",
    "x-nexus-token": "t",
    SYSTEMROOT: "C:/Windows",
  });
  assert.equal(out.PATH, "/usr/bin");
  assert.equal(out.HOME, "/home/merk");
  assert.equal(out.SYSTEMROOT, "C:/Windows");
  assert.equal("MINIMAX_API_KEY" in out, false);
  assert.equal("NEXUS_TOKEN" in out, false);
  assert.equal("ANTHROPIC_API_KEY" in out, false);
  assert.equal("GITHUB_TOKEN" in out, false);
  assert.equal("MY_SECRET" in out, false);
  assert.equal("x-nexus-token" in out, false);
});

test("scrubEnv: returns a copy, never mutates the caller's env", () => {
  const src = { PATH: "/bin", MY_KEY: "k" };
  const out = scrubEnv(src);
  assert.equal(src.MY_KEY, "k", "source is untouched");
  assert.equal("MY_KEY" in out, false);
});

test("buildHermesArgs: is exactly -z <prompt>", () => {
  assert.deepEqual(buildHermesArgs("do a thing"), ["-z", "do a thing"]);
});

test("resolveHermesBin: honours COOP_HERMES_BIN override", () => {
  const prev = process.env.COOP_HERMES_BIN;
  process.env.COOP_HERMES_BIN = "/custom/hermes";
  try {
    assert.equal(resolveHermesBin(), "/custom/hermes");
  } finally {
    if (prev === undefined) delete process.env.COOP_HERMES_BIN;
    else process.env.COOP_HERMES_BIN = prev;
  }
});

// ---------- hermes runtime: run() over an injected fake spawn ----------

/** A fake child + spawn that records how it was invoked and lets a test drive
 *  stdout/stderr/close/exit without starting a real process. */
function makeFakeSpawn() {
  const calls = [];
  function spawn(bin, args, opts) {
    const child = new EventEmitter();
    child.pid = 4242;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => true;
    const call = { bin, args, opts, child };
    calls.push(call);
    return child;
  }
  return { spawn, calls };
}

test("hermes run: spawns `-z <prompt>` with a scrubbed env and streams stdout", async () => {
  const prevKey = process.env.MINIMAX_API_KEY;
  process.env.MINIMAX_API_KEY = "leak-me";
  const prevBin = process.env.COOP_HERMES_BIN;
  process.env.COOP_HERMES_BIN = "hermes";
  try {
    const { spawn, calls } = makeFakeSpawn();
    const rt = createHermesRuntime({ spawn });
    const chunks = [];
    const p = rt.run("hello there", { onChunk: (d) => chunks.push(d) });

    assert.equal(calls.length, 1);
    const call = calls[0];
    assert.equal(call.bin, "hermes");
    assert.deepEqual(call.args, ["-z", "hello there"]);
    // The security invariant: the child env must not carry the key.
    assert.equal("MINIMAX_API_KEY" in call.opts.env, false);
    assert.equal(call.opts.stdio[0], "ignore");

    call.child.stdout.emit("data", Buffer.from("part-1 "));
    call.child.stdout.emit("data", Buffer.from("part-2"));
    call.child.emit("close", 0);
    await p;
    assert.equal(chunks.join(""), "part-1 part-2");
  } finally {
    if (prevKey === undefined) delete process.env.MINIMAX_API_KEY;
    else process.env.MINIMAX_API_KEY = prevKey;
    if (prevBin === undefined) delete process.env.COOP_HERMES_BIN;
    else process.env.COOP_HERMES_BIN = prevBin;
  }
});

test("hermes run: a spawn failure rejects (CLI cannot start)", async () => {
  function spawn() {
    throw new Error("ENOENT");
  }
  const rt = createHermesRuntime({ spawn });
  await assert.rejects(() => rt.run("x", { onChunk() {} }), /ENOENT/);
});

test("hermes run: abort kills the tree and resolves early on exit", async () => {
  const { spawn, calls } = makeFakeSpawn();
  const rt = createHermesRuntime({ spawn });
  const ac = new AbortController();
  const p = rt.run("long task", { onChunk() {}, signal: ac.signal });
  const child = calls[0].child;
  // Abort: run() attaches a one-shot 'exit' listener and resolves on it.
  ac.abort();
  child.emit("exit", 1);
  await p; // resolves, does not hang or reject
});

// status() is existence-based, NOT a `--version` spawn: the agent CLI has no
// clean `--version` exit, so a spawn-probe hung 5s and false-reported
// "setup-required" for a Hermes that runs fine. It must never spawn.
test("hermes status: reports ready when the CLI is found on PATH", async () => {
  const { spawn, calls } = makeFakeSpawn();
  const rt = createHermesRuntime({ spawn, exists: () => true });
  const r = await rt.status();
  assert.equal(r.state, "ready");
  assert.equal(calls.length, 0, "status() must not spawn the agent");
});

test("hermes status: reports not-installed when the CLI is not found", async () => {
  const { spawn, calls } = makeFakeSpawn();
  const rt = createHermesRuntime({ spawn, exists: () => false });
  const r = await rt.status();
  assert.equal(r.state, "not-installed");
  assert.equal(calls.length, 0, "status() must not spawn the agent");
});
