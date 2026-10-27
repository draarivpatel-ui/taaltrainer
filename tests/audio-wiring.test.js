import { test } from "node:test";
import assert from "node:assert/strict";

// A small DOM and AudioContext stub that verifies the audio wiring without a
// browser. The engine under test is the real js/audio/engine.js and the real
// scheduler; only the browser objects are faked.
import { TablaEngine } from "../js/audio/engine.js";
import { TaalScheduler } from "../js/audio/scheduler.js";
import { getTaal } from "../js/engine/taal.js";

class FakeParam {
  constructor(v) { this.value = v; }
}

class FakeGainNode {
  constructor() {
    this.gain = new FakeParam(1);
    this.connections = [];
  }
  connect(dest) {
    this.connections.push(dest);
    return dest;
  }
  disconnect() { this.connections.length = 0; }
}

class FakeWorkletNode {
  constructor(name, options) {
    this.name = name;
    this.options = options;
    this.connections = [];
    this.port = {
      messages: [],
      postMessage(m) { this.messages.push(m); }
    };
  }
  connect(dest) {
    this.connections.push(dest);
    return dest;
  }
  messagesOf(type) {
    return this.port.messages.filter((m) => m.type === type);
  }
}

class FakeAudioContext {
  constructor() {
    this._time = 0;
    this.destination = {};
    this.modules = [];
    this.gains = [];
    this.workletNodes = [];
    this.state = "running";
    const ctx = this;
    ctx.audioWorklet = {
      async addModule(url) { ctx.modules.push(url); }
    };
  }
  get currentTime() { return this._time; }
  createGain() {
    const g = new FakeGainNode();
    this.gains.push(g);
    return g;
  }
  async resume() { this.state = "running"; }
}

function makeWired() {
  const ctx = new FakeAudioContext();
  const engine = new TablaEngine({
    contextFactory: () => ctx,
    workletNodeFactory: (c, name, options) => {
      const node = new FakeWorkletNode(name, options);
      ctx.workletNodes.push(node);
      return node;
    }
  });
  return { ctx, engine };
}

test("init loads the worklet module once and builds the family graph", async () => {
  const { ctx, engine } = makeWired();
  await engine.init();
  assert.equal(engine.ready, true);
  assert.equal(ctx.modules.length, 1);
  assert.ok(ctx.modules[0].endsWith("tabla-worklets.js"), "module url points at the worklet file");
  const names = ctx.workletNodes.map((n) => n.name);
  assert.deepEqual(names, ["taal-tonic", "taal-bass", "taal-transient"]);
});

test("each family node routes through its own gain into one master", async () => {
  const { ctx, engine } = makeWired();
  await engine.init();
  assert.equal(ctx.gains.length, 4, "master first, then three family gains");
  const master = ctx.gains[0];
  for (let i = 0; i < 3; i += 1) {
    const node = ctx.workletNodes[i];
    const gain = ctx.gains[i + 1];
    assert.deepEqual(node.connections, [gain], `${node.name} into gain ${i + 1}`);
    assert.deepEqual(gain.connections, [master]);
  }
  assert.deepEqual(master.connections, [ctx.destination]);
  assert.equal(master.gain.value, 0.9);
});

test("init is idempotent", async () => {
  const { ctx, engine } = makeWired();
  await engine.init();
  await engine.init();
  assert.equal(ctx.modules.length, 1);
  assert.equal(ctx.workletNodes.length, 3);
});

test("trigger routes each bol to its family with the bol params", async () => {
  const { engine } = makeWired();
  await engine.init();
  const hits = engine.trigger("na", 5);
  assert.equal(hits.length, 1);
  const msg = engine.nodes.tonic.port.messages[0];
  assert.equal(msg.type, "hit");
  assert.equal(msg.when, 5);
  assert.equal(msg.params.fundamental, 300);
  assert.equal(msg.params.gain, 1);
  assert.equal(engine.nodes.bass.port.messages.length, 0);
});

test("dha fires both hands, bass and tonic", async () => {
  const { engine } = makeWired();
  await engine.init();
  engine.trigger("dha", 2);
  assert.equal(engine.nodes.bass.port.messages.length, 1);
  assert.equal(engine.nodes.tonic.port.messages.length, 1);
  assert.equal(engine.nodes.bass.port.messages[0].params.fundamental, 92);
});

test("dhin pairs ge with the open tin decay", async () => {
  const { engine } = makeWired();
  await engine.init();
  engine.trigger("dhin", 0);
  const tonic = engine.nodes.tonic.port.messages[0];
  assert.equal(tonic.params.openness, 0.85);
  assert.equal(engine.nodes.bass.port.messages.length, 1);
});

test("tirakita fires a four hit roll spaced 55ms", async () => {
  const { engine } = makeWired();
  await engine.init();
  engine.trigger("tirakita", 10);
  // ti ra ti are transient finger hits, the closing ta rides the tonic family.
  const msgs = engine.nodes.transient.port.messages;
  assert.equal(msgs.length, 3);
  assert.deepEqual(msgs.map((m) => m.when), [10, 10.055, 10.11]);
  const tonicMsgs = engine.nodes.tonic.port.messages;
  assert.equal(tonicMsgs.length, 1);
  assert.equal(tonicMsgs[0].when, 10.165);
});

test("ke lands on the bass family alone", async () => {
  const { engine } = makeWired();
  await engine.init();
  engine.trigger("ke", 1);
  assert.equal(engine.nodes.bass.port.messages.length, 1);
  assert.equal(engine.nodes.tonic.port.messages.length, 0);
  assert.equal(engine.nodes.transient.port.messages.length, 0);
});

test("trigger before init is a silent no op", () => {
  const { engine } = makeWired();
  assert.deepEqual(engine.trigger("na", 0), []);
});

test("unknown bol ids are ignored", async () => {
  const { engine } = makeWired();
  await engine.init();
  assert.deepEqual(engine.trigger("zzz", 0), []);
  for (const node of Object.values(engine.nodes)) assert.equal(node.port.messages.length, 0);
});

test("voice params route to one family, or to all", async () => {
  const { engine } = makeWired();
  await engine.init();
  engine.setVoiceParam("bass", "tune", -3);
  assert.deepEqual(engine.nodes.bass.port.messages[0], { type: "param", name: "tune", value: -3 });
  assert.equal(engine.nodes.tonic.port.messages.length, 0);
  engine.setVoiceParam("all", "ring", 1.4);
  for (const family of ["tonic", "bass", "transient"]) {
    const msgs = engine.nodes[family].port.messages.filter((m) => m.type === "param" && m.name === "ring");
    assert.equal(msgs.length, 1, `${family} got ring`);
    assert.equal(msgs[0].value, 1.4);
  }
});

test("panic reaches every family", async () => {
  const { engine } = makeWired();
  await engine.init();
  engine.panic();
  for (const family of ["tonic", "bass", "transient"]) {
    assert.deepEqual(engine.nodes[family].port.messages[0], { type: "panic" });
  }
});

test("velocity scales the hit gain", async () => {
  const { engine } = makeWired();
  await engine.init();
  engine.trigger("te", 0, 0.5);
  assert.equal(engine.nodes.transient.port.messages[0].params.gain, 0.5);
});

test("the scheduler books theka hits ahead with exact times", async () => {
  const { ctx, engine } = makeWired();
  const visuals = [];
  const scheduler = new TaalScheduler(engine, {
    lookahead: 0.15,
    interval: 25,
    scheduleVisual: (fn, delayMs) => { visuals.push({ delayMs }); return null; }
  });
  await engine.init();
  try {
    ctx._time = 0;
    const state = scheduler.start(getTaal("teentaal"), 60, () => {});
    assert.ok(state.startTime > 0, "start time sits just ahead of now");
    scheduler.tick();
    // The opening dha is compound, so one booking reaches both hands.
    assert.equal(engine.nodes.bass.port.messages.length, 1, "dha books the bass hand");
    assert.equal(engine.nodes.tonic.port.messages.length, 1, "dha books the dayan hand");
    const firstHit = engine.nodes.bass.port.messages[0];
    assert.equal(firstHit.when, state.startTime);
    assert.equal(visuals.length, 1, "one visual queued for the scheduled beat");
  } finally {
    scheduler.stop();
  }
});

test("a full teentaal cycle schedules each beat exactly once", async () => {
  const { ctx, engine } = makeWired();
  const scheduler = new TaalScheduler(engine, { lookahead: 0.15, interval: 25, scheduleVisual: () => null });
  await engine.init();
  try {
    ctx._time = 0;
    const state = scheduler.start(getTaal("teentaal"), 60);
    // Pump just under one cycle so the lookahead never books beat sixteen.
    for (let t = 0; t <= 15.75; t += 0.25) {
      ctx._time = t;
      scheduler.tick();
    }
    // One cycle of the theka books sixteen dayan hits. The bass sounds under
    // the six dhas and six dhins, twelve in all.
    const tonic = engine.nodes.tonic.port.messages.filter((m) => m.type === "hit");
    const bass = engine.nodes.bass.port.messages.filter((m) => m.type === "hit");
    assert.equal(tonic.length, 16);
    assert.equal(bass.length, 12);
    const firstBass = bass.reduce((a, b) => (a.when <= b.when ? a : b));
    assert.ok(Math.abs(firstBass.when - state.startTime) < 1e-6, "the sam dha books first");
    const keys = new Set(tonic.map((m) => `${m.when}:${m.params.fundamental}`));
    assert.equal(keys.size, 16, "no double booked beat");
  } finally {
    scheduler.stop();
    assert.equal(scheduler.playing, false);
  }
});

test("stop halts booking and future timers are tracked", async () => {
  const { ctx, engine } = makeWired();
  const scheduler = new TaalScheduler(engine, { lookahead: 0.15, scheduleVisual: (fn, d) => d });
  await engine.init();
  ctx._time = 0;
  scheduler.start(getTaal("keherwa"), 240);
  scheduler.tick();
  const before = engine.nodes.bass.port.messages.length;
  scheduler.stop();
  ctx._time = 5;
  scheduler.tick();
  const after = engine.nodes.bass.port.messages.length;
  assert.equal(after, before, "no booking after stop");
});

test("keherwa at speed books four bass hits per cycle", async () => {
  const { ctx, engine } = makeWired();
  const scheduler = new TaalScheduler(engine, { lookahead: 0.15, scheduleVisual: () => null });
  await engine.init();
  try {
    ctx._time = 0;
    const state = scheduler.start(getTaal("keherwa"), 240);
    // One keherwa cycle at 240bpm lasts two seconds. Pump to 1.85 so the
    // lookahead cannot book into the next cycle.
    for (let t = 0; t <= 1.85; t += 0.02) {
      ctx._time = t;
      scheduler.tick();
    }
    const bass = engine.nodes.bass.port.messages.filter((m) => m.type === "hit");
    // keherwa theka dha ge na ti na ke dhin na: the bass sounds on dha, ge, ke and dhin
    assert.equal(bass.length, 4);
    const sorted = bass.map((m) => m.when - state.startTime).sort((a, b) => a - b);
    assert.ok(Math.abs(sorted[1] - 0.25) < 1e-6, "ge lands on beat two");
  } finally {
    scheduler.stop();
  }
});
