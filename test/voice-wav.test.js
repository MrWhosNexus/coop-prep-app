// test/voice-wav.test.js
//
// Unit tests for the PURE audio helpers in electron/voice/stt-local.js —
// decodeWav16kMono / encodeWav16kMono / floatToPcm16 / pcm16ToFloat. These are
// the only voice pieces that run with no native deps, so this file imports
// stt-local.js (dynamic import()s keep kokoro-js / @huggingface/transformers
// out of the module graph) and NEVER those packages. It passes on a clean
// checkout where the voice models and native runtime are absent.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  decodeWav16kMono,
  encodeWav16kMono,
  floatToPcm16,
  pcm16ToFloat,
  WavFormatError,
  LOCAL_STT_SAMPLE_RATE,
} from "../electron/voice/stt-local.js";

/** Hand-build a WAV so the test can vary rate/channels/bits to make bad ones. */
function buildWav({ sampleRate = 16000, channels = 1, bits = 16, format = 1, dataBytes = 8 } = {}) {
  const data = Buffer.alloc(dataBytes);
  const header = Buffer.alloc(44);
  const blockAlign = channels * (bits / 8);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(format, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bits, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

describe("pcm16 <-> float conversion", () => {
  test("floatToPcm16 clamps overshoot to full scale instead of wrapping", () => {
    const pcm = floatToPcm16(new Float32Array([1.5, -1.5]));
    assert.equal(pcm.readInt16LE(0), 32767);
    assert.equal(pcm.readInt16LE(2), -32767);
  });

  test("round-trips a known set of samples within a quantization step", () => {
    // Encode scales by 32767, decode divides by 32768, so the error is bounded
    // by one step plus that scale asymmetry — a hair over 1/32767, never 1e-4.
    const input = new Float32Array([0, 0.5, -0.5, 0.999, -1, 0.25]);
    const back = pcm16ToFloat(floatToPcm16(input));
    assert.equal(back.length, input.length);
    for (let i = 0; i < input.length; i++) {
      assert.ok(Math.abs(back[i] - input[i]) < 1e-4, `sample ${i}: ${back[i]} vs ${input[i]}`);
    }
  });

  test("pcm16ToFloat maps int16 extremes to the [-1, 1] range", () => {
    const buf = Buffer.alloc(4);
    buf.writeInt16LE(-32768, 0);
    buf.writeInt16LE(32767, 2);
    const f = pcm16ToFloat(buf);
    assert.equal(f[0], -1); // -32768 / 32768 === -1 exactly
    assert.ok(Math.abs(f[1] - 1) < 1e-4);
  });
});

describe("decodeWav16kMono — accepts the exact contract", () => {
  test("round-trips a 16 kHz mono 16-bit WAV built by encodeWav16kMono", () => {
    const input = new Float32Array([0, 0.5, -0.5, 0.125, -0.75, 1, -1]);
    const wav = encodeWav16kMono(input);
    // Header sanity — the encoder must produce exactly what the decoder demands.
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    assert.equal(wav.toString("ascii", 8, 12), "WAVE");
    assert.equal(wav.readUInt32LE(24), LOCAL_STT_SAMPLE_RATE);

    const decoded = decodeWav16kMono(wav);
    assert.equal(decoded.length, input.length);
    for (let i = 0; i < input.length; i++) {
      assert.ok(Math.abs(decoded[i] - input[i]) < 1 / 32767, `sample ${i}`);
    }
  });

  test("reads data chunk size from the header, skipping a LIST chunk before data", () => {
    // A well-formed WAV may carry metadata chunks before `data`; a fixed
    // offset-44 seek would read them as samples. Splice a LIST chunk in.
    const base = encodeWav16kMono(new Float32Array([0.5, -0.5]));
    const fmt = base.subarray(12, 36); // "fmt " chunk (24 bytes)
    const dataChunk = base.subarray(36); // "data" + size + payload
    const list = Buffer.alloc(8 + 4);
    list.write("LIST", 0, "ascii");
    list.writeUInt32LE(4, 4);
    list.write("INFO", 8, "ascii");
    const body = Buffer.concat([fmt, list, dataChunk]);
    const header = Buffer.alloc(12);
    header.write("RIFF", 0, "ascii");
    header.writeUInt32LE(4 + body.length, 4);
    header.write("WAVE", 8, "ascii");
    const wav = Buffer.concat([header, body]);

    const decoded = decodeWav16kMono(wav);
    assert.equal(decoded.length, 2);
    assert.ok(Math.abs(decoded[0] - 0.5) < 1 / 32767);
    assert.ok(Math.abs(decoded[1] + 0.5) < 1 / 32767);
  });
});

describe("decodeWav16kMono — rejects everything off-contract", () => {
  test("rejects the wrong sample rate (44.1 kHz)", () => {
    assert.throws(() => decodeWav16kMono(buildWav({ sampleRate: 44100 })), (e) => {
      assert.ok(e instanceof WavFormatError);
      assert.match(e.message, /16000 Hz/);
      return true;
    });
  });

  test("rejects stereo audio", () => {
    assert.throws(() => decodeWav16kMono(buildWav({ channels: 2 })), (e) => {
      assert.ok(e instanceof WavFormatError);
      assert.match(e.message, /mono/);
      return true;
    });
  });

  test("rejects 8-bit PCM", () => {
    assert.throws(() => decodeWav16kMono(buildWav({ bits: 8 })), (e) => {
      assert.ok(e instanceof WavFormatError);
      assert.match(e.message, /16-bit/);
      return true;
    });
  });

  test("rejects non-PCM formats (e.g. float/ADPCM format code 3)", () => {
    assert.throws(() => decodeWav16kMono(buildWav({ format: 3 })), WavFormatError);
  });

  test("rejects a buffer that is not RIFF/WAVE", () => {
    assert.throws(() => decodeWav16kMono(Buffer.from("not a wav file at all")), (e) => {
      assert.ok(e instanceof WavFormatError);
      assert.match(e.message, /RIFF\/WAVE/);
      return true;
    });
  });

  test("rejects a buffer too short to be a WAV", () => {
    assert.throws(() => decodeWav16kMono(Buffer.alloc(4)), WavFormatError);
  });
});
