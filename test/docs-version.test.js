// test/docs-version.test.js
//
// README.md and docs/INSTALL.md name download files by their EXACT filename —
// "Coop-Prep-0.3.0-arm64.dmg", not "Coop-Prep-<version>-arm64.dmg". That is a
// deliberate choice: these docs are written for people who have never installed
// anything from GitHub, and a placeholder they have to mentally substitute is
// one more thing to get wrong while staring at an unfamiliar Releases page.
//
// The cost of that choice is rot. Every release makes both files wrong, and a
// wrong filename is worse than a placeholder — it sends the reader hunting for
// an asset that is not there and looks like a broken release.
//
// So the version in the docs is pinned to package.json. Bumping the version now
// fails the build until the docs are updated with it, which is the only way a
// hand-maintained filename stays true.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const VERSION = JSON.parse(read("package.json")).version;

const DOCS = ["README.md", "docs/INSTALL.md"];

describe("the install docs name the version that is actually shipping", () => {
  for (const doc of DOCS) {
    test(`${doc} names no version other than ${VERSION}`, () => {
      const text = read(doc);
      // Any x.y.z inside a Coop-Prep artifact filename.
      const named = [...text.matchAll(/Coop-Prep[-\w.]*?(\d+\.\d+\.\d+)/g)].map((m) => m[1]);
      const stale = [...new Set(named)].filter((v) => v !== VERSION);
      assert.deepEqual(
        stale,
        [],
        `${doc} tells the reader to download ${stale.join(", ")} while package.json ships ${VERSION} — ` +
          `they will look for an asset that is not on the release`,
      );
    });
  }

  test("the check has teeth: the docs really do name artifact filenames", () => {
    // Guards against the sweep passing because a doc was restructured and no
    // longer contains filenames at all — at which point it is silently no
    // longer being checked.
    for (const doc of DOCS) {
      const hits = [...read(doc).matchAll(/Coop-Prep[-\w.]*?\d+\.\d+\.\d+/g)];
      assert.ok(hits.length >= 3, `${doc} names only ${hits.length} artifact filenames — is this test still looking at the right thing?`);
    }
  });
});
