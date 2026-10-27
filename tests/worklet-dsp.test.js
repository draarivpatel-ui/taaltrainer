import { test } from "node:test";
import assert from "node:assert/strict";

// Side effect import: outside a worklet scope the module attaches its
// processor classes to globalThis.TaalTrainerWorklets so the DSP kernels can
// run here. The AudioContext graph itself is exercised in audio-wiring.test.js
// through a stub; the browser only path is reviewed statically.
import "../js/audio/tabla-worklets.js";

const { TonicProcessor, BassProcessor, TransientProcessor, FAMILIES } = globalThis.TaalTrainerWorklets;

const BLOCK = 128;
// 128 samples at 48kHz is one render quantum, 2.667ms.
const BLOCK_MS = (BLOCK / 48000) * 1000;

function makeProcessor(ClassRef, params = {}) {
  return new ClassRef({ processorOptions: params });
}

function render(p, blocks) {
  const out = [];
  for (let b = 0; b < blocks; b += 1) {
    const ch0 = new Float32Array(BLOCK);
    const ch1 = new Float32Array(BLOCK);
    p.process(null, [[ch0, ch1]]);
    out.push(ch0);
  }
  return out;
}

function peak(blocks) {
  let m = 0;
  for (const ch of blocks) for (const v of ch) { const a = Math.abs(v); if (a > m) m = a; }
  return m;
}

function rms(blocks) {
  let sum = 0;
  let count = 0;
  for (const ch of blocks) for (const v of ch) { sum += v * v; count += 1; }
  return Math.sqrt(sum / Math.max(1, count));
}

function hasNaN(blocks) {
  for (const ch of blocks) for (const v of ch) if (Number.isNaN(v)) return true;
  return false;
}

function fire(p, msg) {
  p.onMessage({ type: "hit", when: p.currentTime, params: msg });
}

function blockEquals(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

test("all three family processors are registered for the worklet scope", () => {
  assert.equal(FAMILIES.tonic.name, "taal-tonic");
  assert.equal(FAMILIES.bass.name, "taal-bass");
  assert.equal(FAMILIES.transient.name, "taal-transient");
});

test("a tonic stroke produces sound and never NaN", () => {
  const p = makeProcessor(TonicProcessor);
  fire(p, { fundamental: 300, decay: 0.45, openness: 0.3, noise: 0.45, gain: 1 });
  const blocks = render(p, 8);
  assert.ok(peak(blocks) > 0.05, "audible peak in the first blocks");
  assert.equal(hasNaN(blocks), false);
});

test("silence without hits, and both channels carry the signal", () => {
  const p = makeProcessor(TonicProcessor);
  const ch0 = new Float32Array(BLOCK);
  const ch1 = new Float32Array(BLOCK);
  p.process(null, [[ch0, ch1]]);
  assert.equal(peak([ch0]), 0);
  fire(p, { fundamental: 300, decay: 0.5, openness: 0.5, noise: 0.4, gain: 1 });
  const ch2 = new Float32Array(BLOCK);
  const ch3 = new Float32Array(BLOCK);
  p.process(null, [[ch2, ch3]]);
  assert.ok(peak([ch2]) > 0.02);
  assert.equal(blockEquals(ch2, ch3), true, "channels match");
});

test("open tin rings far longer than closed na", () => {
  const na = makeProcessor(TonicProcessor);
  fire(na, { fundamental: 300, decay: 0.45, openness: 0.3, noise: 0.45, gain: 1 });
  render(na, 60); // burn the first 160ms
  const naTail = rms(render(na, 40)); // measure 160ms to 267ms
  const tin = makeProcessor(TonicProcessor);
  fire(tin, { fundamental: 300, decay: 1.15, openness: 0.9, noise: 0.25, gain: 1 });
  render(tin, 60);
  const tinTail = rms(render(tin, 40));
  assert.ok(tinTail > naTail * 1.4, `open tail ${tinTail.toFixed(4)} must out ring closed tail ${naTail.toFixed(4)}`);
});

test("bass ge sits low and out rings tonic na", () => {
  const ge = makeProcessor(BassProcessor);
  fire(ge, { fundamental: 92, decay: 0.9, openness: 1, noise: 0.35, glide: 0.14, gain: 1 });
  render(ge, 60);
  const geTail = rms(render(ge, 40));
  const na = makeProcessor(TonicProcessor);
  fire(na, { fundamental: 300, decay: 0.45, openness: 0.3, noise: 0.45, gain: 1 });
  render(na, 60);
  const naTail = rms(render(na, 40));
  assert.ok(geTail > naTail, "ge still sounds where na has died");
});

test("transient strokes are loud and brief", () => {
  const p = makeProcessor(TransientProcessor);
  fire(p, { fundamental: 700, decay: 0.12, openness: 0.1, noise: 0.9, gain: 1 });
  const early = render(p, 4);
  assert.ok(peak(early) > 0.1, "a loud attack");
  render(p, 120); // advance about 320ms
  const late = rms(render(p, 30)); // window 320ms to 400ms
  assert.ok(late < 0.005, `transient dies fast (late rms ${late.toFixed(5)})`);
});

test("a future scheduled hit stays silent until its moment", () => {
  const p = makeProcessor(TonicProcessor);
  const start = p.currentTime;
  p.onMessage({ type: "hit", when: start + 0.2, params: { fundamental: 300, decay: 0.5, openness: 0.5, noise: 0.4, gain: 1 } });
  const quiet = render(p, 8);
  assert.equal(peak(quiet), 0, "no early leak");
  render(p, 80); // about 213ms, past the scheduled moment
  const audible = render(p, 2);
  assert.ok(peak(audible) > 0.02, "voice fires when its time arrives");
});

test("panic silences everything immediately", () => {
  const p = makeProcessor(TonicProcessor);
  fire(p, { fundamental: 300, decay: 1.2, openness: 0.9, noise: 0.3, gain: 1 });
  render(p, 2);
  p.onMessage({ type: "panic" });
  const after = render(p, 4);
  assert.equal(peak(after), 0);
});

test("the gain param silences the family without clearing voices", () => {
  const p = makeProcessor(TonicProcessor, { gain: 0 });
  fire(p, { fundamental: 300, decay: 0.5, openness: 0.5, noise: 0.4, gain: 1 });
  const blocks = render(p, 4);
  assert.equal(peak(blocks), 0);
});

test("the slap param removes the noise transient but not the ring", () => {
  const withSlap = makeProcessor(TransientProcessor);
  fire(withSlap, { fundamental: 700, decay: 0.4, openness: 0.5, noise: 0.9, gain: 1 });
  const loud = rms(render(withSlap, 3));
  const noSlap = makeProcessor(TransientProcessor);
  noSlap.onMessage({ type: "param", name: "slap", value: 0 });
  fire(noSlap, { fundamental: 700, decay: 0.4, openness: 0.5, noise: 0.9, gain: 1 });
  const quiet = rms(render(noSlap, 3));
  assert.ok(quiet > 0.01, "the short modes still sound");
  assert.ok(quiet < loud * 0.6, `without slap ${quiet.toFixed(4)} sits well under with slap ${loud.toFixed(4)}`);
});

test("the tune param shifts the pitch down by the requested semitones", () => {
  // Count rising zero crossings across the render; an octave down should
  // cross roughly half as often.
  const countRising = (blocks) => {
    let c = 0;
    let prev = 0;
    for (const ch of blocks) {
      for (const v of ch) {
        if (prev <= 0 && v > 0) c += 1;
        prev = v;
      }
    }
    return c;
  };
  const normal = makeProcessor(TonicProcessor);
  fire(normal, { fundamental: 300, decay: 0.9, openness: 0.8, noise: 0.2, gain: 1 });
  const c1 = countRising(render(normal, 70));
  const low = makeProcessor(TonicProcessor);
  low.onMessage({ type: "param", name: "tune", value: -12 });
  fire(low, { fundamental: 300, decay: 0.9, openness: 0.8, noise: 0.2, gain: 1 });
  const c2 = countRising(render(low, 70));
  assert.ok(c1 > 10 && c2 > 3, `both signals measurable (${c1} vs ${c2})`);
  assert.ok(c2 < c1 * 0.8, `octave down crosses less often (${c1} vs ${c2})`);
});

test("voices are stolen past the polyphony cap", () => {
  const p = makeProcessor(TransientProcessor);
  for (let i = 0; i < 20; i += 1) {
    fire(p, { fundamental: 700, decay: 0.3, openness: 0.4, noise: 0.6, gain: 1 });
  }
  const blocks = render(p, 4);
  assert.equal(hasNaN(blocks), false);
  assert.ok(peak(blocks) > 0.02, "recent voices still sound");
});

test("the bass glide bends the attack pitch", () => {
  const glide = makeProcessor(BassProcessor);
  fire(glide, { fundamental: 92, decay: 0.9, openness: 1, noise: 0.3, glide: 0.14, gain: 1 });
  const withGlide = render(glide, 4);
  const still = makeProcessor(BassProcessor);
  fire(still, { fundamental: 92, decay: 0.9, openness: 1, noise: 0.3, glide: 0, gain: 1 });
  const withoutGlide = render(still, 4);
  assert.equal(blockEquals(withGlide[0], withoutGlide[0]), false, "glide changes the attack");
  assert.equal(hasNaN(withGlide), false);
});

test("three processors coexist without cross talk", () => {
  const t = makeProcessor(TonicProcessor);
  const b = makeProcessor(BassProcessor);
  const x = makeProcessor(TransientProcessor);
  fire(t, { fundamental: 300, decay: 1, openness: 0.9, noise: 0.2, gain: 1 });
  fire(b, { fundamental: 92, decay: 0.9, openness: 1, noise: 0.3, gain: 1 });
  fire(x, { fundamental: 700, decay: 0.1, openness: 0.1, noise: 0.9, gain: 1 });
  const a = render(t, 2);
  const c = render(b, 2);
  const d = render(x, 2);
  for (const set of [a, c, d]) assert.equal(hasNaN(set), false);
  assert.ok(peak(a) > 0.02 && peak(c) > 0.02 && peak(d) > 0.02);
});
