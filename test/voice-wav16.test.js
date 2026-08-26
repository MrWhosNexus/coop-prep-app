// test/voice-wav16.test.js
//
// Coverage for lib/voice/wav16.js#encodeWav16, the 16 kHz PCM encoder the LIVE
// voice path uses: lib/voice/companion/EndpointVoiceProvider.js calls
// window.coop.voice.transcribe(encodeWav16(frames)).
//
// Split out of the former test/voice-ui.test.js, which also covered
// NexusVoiceWidget and lib/voice/engine.js. Both were deleted as dead code
// (see docs/AUDIT_REPORT_2026-07-20.md #3); this half covers something still
// reachable and is kept.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { encodeWav16, CAPTURE_SAMPLE_RATE } from "../lib/voice/wav16.js";

describe("lib/voice/wav16.js: encodeWav16", () => {
  test("produces a valid RIFF/WAVE header for a known frame array", () => {
    const frames = [new Float32Array([0, 0.5, -0.5, 1, -1])];
    const buf = encodeWav16(frames);
    const view = new DataView(buf);
    const readStr = (off, len) =>
      String.fromCharCode(...Array.from({ length: len }, (_, i) => view.getUint8(off + i)));

    assert.equal(readStr(0, 4), "RIFF");
    assert.equal(readStr(8, 4), "WAVE");
    assert.equal(readStr(12, 4), "fmt ");
    assert.equal(view.getUint16(20, true), 1); // PCM
    assert.equal(view.getUint16(22, true), 1); // mono
    assert.equal(view.getUint32(24, true), CAPTURE_SAMPLE_RATE);
    assert.equal(view.getUint16(34, true), 16); // bits per sample
    assert.equal(readStr(36, 4), "data");

    const dataSize = view.getUint32(40, true);
    assert.equal(dataSize, frames[0].length * 2);
    assert.equal(buf.byteLength, 44 + dataSize);

    // Spot-check the PCM samples: 0 -> 0, 0.5 -> 0x3fff*, 1 -> 0x7fff, -1 -> -0x8000
    assert.equal(view.getInt16(44, true), 0);
    assert.equal(view.getInt16(44 + 2 * 3, true), 0x7fff);
    assert.equal(view.getInt16(44 + 2 * 4, true), -0x8000);
  });

  test("handles an empty frame list without throwing", () => {
    const buf = encodeWav16([]);
    const view = new DataView(buf);
    assert.equal(view.getUint32(40, true), 0);
    assert.equal(buf.byteLength, 44);
  });
});
