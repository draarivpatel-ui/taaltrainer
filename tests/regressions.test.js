import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { TimerGroup } from "../js/engine/timers.js";
import { practicePlan } from "../js/engine/practice.js";
import { LESSONS } from "../js/engine/lessons.js";
import { beatDuration, getTaal, thekaBolAt, isTaali } from "../js/engine/taal.js";
import { hitsInWindow } from "../js/engine/clock.js";
import { toleranceMs, gradeAttempt } from "../js/engine/scoring.js";
import { buildColumns, spanMs, quantize } from "../js/engine/timeline.js";
import { TaalScheduler } from "../js/audio/scheduler.js";
import { TablaEngine } from "../js/audio/engine.js";

function nativeWorklets() {
  const classes = {};
  const scope = {
    AudioWorkletProcessor: class { constructor() { this.port = {}; } },
    sampleRate: 48000,
    currentTime: 0,
    registerProcessor: (name, Processor) => { classes[name] = Processor; }
  };
  vm.runInNewContext(readFileSync(new URL("../js/audio/tabla-worklets.js", import.meta.url), "utf8"), scope);
  return { classes, scope };
}

for (const family of ["tonic", "bass", "transient"]) {
  test(`native ${family} worklet uses the global clock and produces finite sound`, () => {
    const { classes } = nativeWorklets();
    const processor = new classes[`taal-${family}`]();
    assert.equal("currentTime" in processor, false, "native base has no instance clock");
    processor.onMessage({ type: "hit", when: 0, params: { fundamental: 300, decay: 0.4, gain: 1 } });
    const channel = new Float32Array(128);
    processor.process([], [[channel]]);
    assert.ok(channel.every(Number.isFinite));
    assert.ok(channel.some((sample) => Math.abs(sample) > 0.001));
  });
}

test("native worklet scheduling respects future times across quanta", () => {
  const { classes, scope } = nativeWorklets();
  const processor = new classes["taal-tonic"]();
  processor.onMessage({ type: "hit", when: 0.1 });
  const channel = new Float32Array(128);
  processor.process([], [[channel]]);
  assert.ok(channel.every((sample) => sample === 0));
  scope.currentTime = 0.1;
  processor.process([], [[channel]]);
  assert.ok(channel.some((sample) => sample !== 0));
});

test("invalid worklet messages never poison the audio output", () => {
  const { classes } = nativeWorklets();
  const processor = new classes["taal-tonic"]({ processorOptions: { tune: NaN, gain: Infinity } });
  for (const name of ["tune", "ring", "slap", "gain"]) processor.onMessage({ type: "param", name, value: NaN });
  processor.onMessage({ type: "hit", when: Infinity });
  assert.equal(processor.voices.length, 0);
  processor.onMessage({ type: "hit", when: 0, params: { fundamental: NaN, decay: Infinity, gain: NaN, noise: NaN } });
  const channel = new Float32Array(128);
  processor.process([], [[channel]]);
  assert.ok(channel.every(Number.isFinite));
});

test("worklet voices expire at the hard lifetime cap", () => {
  const { classes, scope } = nativeWorklets();
  const processor = new classes["taal-tonic"]();
  processor.onMessage({ type: "hit", when: 0, params: { decay: 0.1 } });
  scope.currentTime = 2;
  processor.process([], [[new Float32Array(128)]]);
  assert.equal(processor.voices.length, 0);
});

test("queued future lesson strokes do not steal the beginning of the call", () => {
  const { classes, scope } = nativeWorklets();
  const processor = new classes["taal-tonic"]();
  for (let index = 1; index <= 20; index += 1) processor.onMessage({ type: "hit", when: index });
  assert.equal(processor.voices.length, 20);
  scope.currentTime = 1;
  const channel = new Float32Array(128);
  processor.process([], [[channel]]);
  assert.ok(channel.some((sample) => Math.abs(sample) > 0.001), "the first scheduled note must still exist");
});

test("timer ownership is released on fire and cancelled callbacks are inert", () => {
  const callbacks = [], cancelled = [];
  const timers = new TimerGroup((callback) => { callbacks.push(callback); return callbacks.length; }, (id) => cancelled.push(id));
  let calls = 0;
  timers.schedule(10, () => { calls += 1; });
  callbacks[0]();
  assert.equal(timers.size, 0);
  timers.schedule(20, () => { calls += 1; });
  timers.cancelAll();
  callbacks[1]();
  assert.equal(calls, 1);
  assert.deepEqual(cancelled, [2]);
});

test("timer group supports synchronous injectable callbacks without leaks", () => {
  const timers = new TimerGroup((callback) => { callback(); return 1; });
  let calls = 0;
  timers.schedule(0, () => { calls += 1; });
  assert.equal(calls, 1);
  assert.equal(timers.size, 0);
  assert.throws(() => timers.schedule(NaN, () => {}), RangeError);
});

for (const lesson of LESSONS) {
  test(`lesson ${lesson.id} shares the audio lead in and allows the entire response`, () => {
    const plan = practicePlan(lesson);
    const beat = 60000 / lesson.bpm;
    assert.ok(Math.abs(plan.call[0].timeMs - (250 + 4 * beat)) < 1e-9);
    assert.ok(plan.responseStartMs > plan.call.at(-1).timeMs);
    assert.ok(plan.responseDurationMs > (lesson.phrase.length - 1) * beat + toleranceMs(lesson.bpm));
  });
}

test("taal loops remain schedulable after 64 cycles", () => {
  const taal = getTaal("teentaal");
  const hits = hitsInWindow(taal, 60, 0, 1040, 1042);
  assert.deepEqual(hits.map((hit) => hit.absoluteBeat), [1040, 1041]);
  assert.equal(hitsInWindow(taal, 60, 0, 1040, 1042, 64).length, 0);
});

test("empty, reversed and unsafe integer scheduling windows terminate safely", () => {
  const taal = getTaal("teentaal");
  assert.deepEqual(hitsInWindow(taal, 60, 0, 1e16, 1e16), []);
  assert.deepEqual(hitsInWindow(taal, 60, 0, 2, 1), []);
  assert.throws(() => hitsInWindow(taal, 60, 0, 1e16, 1e16 + 10), RangeError);
  assert.throws(() => beatDuration(Number.MIN_VALUE), RangeError);
});

test("scheduler skips a missed backlog and cancels stale visuals", () => {
  let now = 0;
  const hits = [], callbacks = [], cancellations = [];
  const engine = { ready: true, now: () => now, trigger: (bol, time) => hits.push({ bol, time }) };
  const scheduler = new TaalScheduler(engine, {
    scheduleVisual: (callback) => { callbacks.push(callback); return callbacks.length; },
    cancelVisual: (id) => cancellations.push(id)
  });
  let visuals = 0;
  scheduler.start(getTaal("teentaal"), 60, () => { visuals += 1; });
  now = 100;
  scheduler.tick();
  assert.ok(hits.length <= 2, "no burst of a hundred missed beats");
  scheduler.stop();
  for (const callback of callbacks) callback();
  assert.equal(visuals, 0);
  assert.equal(scheduler.visuals.size, 0);
  assert.equal(cancellations.length, callbacks.length);
});

test("scheduler tempo changes preserve the mathematical cycle phase", () => {
  let now = 0;
  const scheduler = new TaalScheduler({ ready: true, now: () => now, trigger() {} });
  scheduler.start(getTaal("teentaal"), 60);
  now = 4.12;
  scheduler.setTempo(120);
  assert.ok(Math.abs((now - scheduler.state.startTime) / 0.5 - 4) < 1e-9);
  scheduler.stop();
  assert.throws(() => scheduler.setTempo(Infinity), RangeError);
});

for (const bpm of [0, -1, NaN, Infinity, "60"]) {
  test(`invalid BPM ${String(bpm)} is rejected by all allocation boundaries`, () => {
    assert.throws(() => beatDuration(bpm), RangeError);
    assert.throws(() => toleranceMs(bpm), RangeError);
    assert.throws(() => buildColumns([], bpm), RangeError);
    assert.throws(() => quantize([], bpm), RangeError);
  });
}

test("recording allocation is bounded and spans unsorted events correctly", () => {
  assert.equal(spanMs([{ timeMs: 500 }, { timeMs: 100 }]), 1400);
  assert.throws(() => buildColumns([{ timeMs: 1e12 }], 240), RangeError);
  assert.throws(() => buildColumns([{ timeMs: NaN }], 60), RangeError);
  assert.throws(() => gradeAttempt([], [], { toleranceMs: NaN }), RangeError);
  assert.throws(() => gradeAttempt([], [], { bpm: 0 }), RangeError);
});

test("negative beat indices wrap the same way as vibhag indices", () => {
  const taal = getTaal("teentaal");
  assert.equal(thekaBolAt(taal, -1), taal.theka.at(-1));
  assert.equal(isTaali(taal, -4), true);
});

test("audio initialization failures clean up and allow a real retry", async () => {
  let attempt = 0, closes = 0;
  const engine = new TablaEngine({
    contextFactory: () => ({
      currentTime: 0, destination: {}, state: "running",
      audioWorklet: { addModule: async () => { if (++attempt === 1) throw new Error("temporary failure"); } },
      createGain: () => ({ gain: { value: 0 }, connect() {} }),
      close: async () => { closes += 1; }
    }),
    workletNodeFactory: () => ({ port: { postMessage() {} }, connect() {} })
  });
  await assert.rejects(engine.init(), /temporary failure/);
  assert.equal(engine.ready, false);
  assert.equal(engine.ctx, null);
  await engine.init();
  assert.equal(engine.ready, true);
  assert.equal(closes, 1);
  assert.deepEqual(engine.trigger("na", NaN), []);
});
