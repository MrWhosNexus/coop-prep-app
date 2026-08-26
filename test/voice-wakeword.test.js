// test/voice-wakeword.test.js
//
// Pure-function coverage for the wake-word text matching in
// lib/voice/wakeWord.js, which is live: lib/voice/companion/EndpointVoiceProvider.js
// imports matchesWakePhrase + WakeCheckLimiter. No AudioContext, no mic — every function here
// takes plain data and returns plain data, so this runs under plain
// node --test with no DOM at all.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  WAKE_PHRASES,
  WAKE_CHECK_MIN_INTERVAL_MS,
  normalizeTranscript,
  matchesWakePhrase,
  WakeCheckLimiter,
} from "../lib/voice/wakeWord.js";

describe("normalizeTranscript", () => {
  test("lowercases, strips punctuation, collapses whitespace", () => {
    assert.equal(normalizeTranscript("Hey, Nexus!!"), "hey nexus");
    assert.equal(normalizeTranscript("  Yo   Nexus  "), "yo nexus");
  });

  test("handles empty/undefined input without throwing", () => {
    assert.equal(normalizeTranscript(""), "");
    assert.equal(normalizeTranscript(undefined), "");
  });
});

describe("matchesWakePhrase", () => {
  test("accepts both wake phrases verbatim", () => {
    assert.ok(matchesWakePhrase("hey nexus"));
    assert.ok(matchesWakePhrase("yo nexus"));
  });

  test("accepts a wake phrase embedded in a longer utterance", () => {
    assert.ok(matchesWakePhrase("Okay hey nexus what's the weather"));
  });

  test("tolerates a one-character STT mishear", () => {
    assert.ok(matchesWakePhrase("hey nexis"));
    assert.ok(matchesWakePhrase("hay nexus"));
  });

  test("rejects unrelated speech", () => {
    assert.equal(matchesWakePhrase("what time is my next lesson"), false);
    assert.equal(matchesWakePhrase("hello there"), false);
    assert.equal(matchesWakePhrase(""), false);
  });

  test("rejects speech that is merely nexus-adjacent but not close enough", () => {
    // Two edits away from either phrase: must not match, or the tolerance
    // would swallow unrelated speech.
    assert.equal(matchesWakePhrase("hexadecimal next"), false);
  });

  test("WAKE_PHRASES is the exact expected pair", () => {
    assert.deepEqual(WAKE_PHRASES, ["hey nexus", "yo nexus"]);
  });
});

describe("WakeCheckLimiter", () => {
  test("allows the first acquisition at any time", () => {
    const limiter = new WakeCheckLimiter(1000);
    assert.equal(limiter.tryAcquire(0), true);
  });

  test("denies a second acquisition inside the interval", () => {
    const limiter = new WakeCheckLimiter(1000);
    assert.equal(limiter.tryAcquire(0), true);
    assert.equal(limiter.tryAcquire(500), false);
    assert.equal(limiter.tryAcquire(999), false);
  });

  test("allows again once the interval has elapsed", () => {
    const limiter = new WakeCheckLimiter(1000);
    assert.equal(limiter.tryAcquire(0), true);
    assert.equal(limiter.tryAcquire(1000), true);
  });

  test("defaults to WAKE_CHECK_MIN_INTERVAL_MS", () => {
    const limiter = new WakeCheckLimiter();
    assert.equal(limiter.tryAcquire(0), true);
    assert.equal(limiter.tryAcquire(WAKE_CHECK_MIN_INTERVAL_MS - 1), false);
    assert.equal(limiter.tryAcquire(WAKE_CHECK_MIN_INTERVAL_MS), true);
  });
});
