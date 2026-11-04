import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { ReplayScheduler } from "../js/audio/replay.js";
import { resolveHits } from "../js/engine/bol.js";

function fixture(options = {}) {
  let now = 0;
  const hits = [], cancelled = [];
  const engine = { ready: true, now: () => now, trigger: (bolId, when, velocity) => hits.push({ bolId, when, velocity }) };
  const player = new ReplayScheduler(engine, { setInterval: () => 0, clearInterval: (id) => cancelled.push(id), ...options });
  return { engine, player, hits, cancelled, time: (value) => { now = value; } };
}

test("replay refills a take only through its lookahead", () => {
  const f = fixture();
  const events = Array.from({ length: 100 }, (_, index) => ({ bolId: "na", timeMs: index * 1000 }));
  f.player.start(events);
  assert.equal(f.hits.length, 1);
  f.time(1); f.player.tick();
  assert.equal(f.hits.length, 2);
  f.player.stop();
  assert.deepEqual(f.cancelled, [0], "even timer ID zero is cancelled");
});

test("1025 valid long rolls preserve every transient without saturating the queue", () => {
  const classes = {};
  const scope = { AudioWorkletProcessor: class { constructor() { this.port = {}; } }, sampleRate: 48000, currentTime: 0, registerProcessor: (name, Processor) => { classes[name] = Processor; } };
  vm.runInNewContext(readFileSync(new URL("../js/audio/tabla-worklets.js", import.meta.url), "utf8"), scope);
  const processor = new classes["taal-transient"]();
  let triggered = 0, maximumQueued = 0;
  const engine = {
    ready: true, now: () => scope.currentTime,
    trigger: (bolId, when, velocity) => {
      triggered += 1;
      for (const hit of resolveHits(bolId, when, velocity)) if (hit.family === "transient") processor.onMessage({ type: "hit", when: hit.when, params: hit.params });
    }
  };
  const player = new ReplayScheduler(engine, { setInterval: () => 0, clearInterval() {} });
  player.start(Array.from({ length: 1025 }, (_, index) => ({ bolId: "tirakita", timeMs: index * 250 })));
  let peak = 0;
  for (let index = 0; index <= 10246; index += 1) {
    scope.currentTime = index * 0.025;
    player.tick();
    maximumQueued = Math.max(maximumQueued, processor.voices.length);
    const channel = new Float32Array(128);
    processor.process([], [[channel]]);
    if (index === 10246) peak = Math.max(...channel.map(Math.abs));
  }
  assert.equal(triggered, 1025);
  assert.ok(maximumQueued < 64, String(maximumQueued));
  assert.ok(peak > 0.001, "the final transient roll still produces actual DSP output");
  player.stop();
});

test("replay cancellation makes already queued visual callbacks inert", () => {
  const callbacks = [], cancelled = [];
  const f = fixture({ scheduleVisual: (callback) => { callbacks.push(callback); return callbacks.length; }, cancelVisual: (id) => cancelled.push(id) });
  let visuals = 0;
  f.player.start([{ bolId: "na", timeMs: 0 }], () => { visuals += 1; });
  f.player.stop();
  callbacks[0]();
  assert.equal(visuals, 0);
  assert.deepEqual(cancelled, [1]);
  assert.equal(f.player.visuals.size, 0);
});

test("replay skips missed beats instead of bursting through a backlog", () => {
  const f = fixture();
  f.player.start(Array.from({ length: 200 }, (_, index) => ({ bolId: "na", timeMs: index * 1000 })));
  f.time(100); f.player.tick();
  assert.equal(f.hits.length, 2);
  assert.ok(f.hits[1].when >= 100);
  f.player.stop();
});

test("replay completes and releases its timer and state", () => {
  const f = fixture();
  f.player.start([{ bolId: "na", timeMs: 0 }]);
  f.time(1); f.player.tick();
  assert.equal(f.player.playing, false);
  assert.deepEqual(f.cancelled, [0]);
});

test("empty takes and invalid replay bounds do not create intervals", () => {
  const f = fixture();
  assert.equal(f.player.start([]), null);
  for (const events of [[{ bolId: "fake", timeMs: 0 }], [{ bolId: "na", timeMs: -1 }], [{ bolId: "na", timeMs: 300001 }], Array(2049).fill({ bolId: "na", timeMs: 0 })]) assert.throws(() => f.player.start(events), RangeError);
  assert.equal(f.player.playing, false);
});

test("non-finite replay clocks and invalid configuration fail safely", () => {
  assert.throws(() => new ReplayScheduler({ ready: true, now: () => NaN }, { lookahead: 0 }), RangeError);
  const f = fixture(); f.time(NaN);
  assert.throws(() => f.player.start([{ bolId: "na", timeMs: 0 }]), RangeError);
});
