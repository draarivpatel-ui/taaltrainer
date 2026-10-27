// Main thread audio engine for TaalTrainer.
// Owns the AudioContext, loads the worklet module, creates one worklet node
// per stroke family, and routes bol triggers to the right families. The
// context and node factories are injectable so a DOM stub test can verify the
// whole wiring without a real browser.

import { resolveHits, getBol } from "../engine/bol.js";

export const FAMILY_NODES = ["tonic", "bass", "transient"];

function defaultContextFactory() {
  const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
  return new Ctx({ latencyHint: "interactive" });
}

function defaultWorkletNodeFactory(ctx, name, options) {
  return new globalThis.AudioWorkletNode(ctx, name, options);
}

export class TablaEngine {
  constructor(options = {}) {
    this.contextFactory = options.contextFactory || defaultContextFactory;
    this.workletNodeFactory = options.workletNodeFactory || defaultWorkletNodeFactory;
    this.workletUrl = options.workletUrl || new URL("./tabla-worklets.js", import.meta.url).href;
    this.ctx = null;
    this.nodes = {};
    this.gains = {};
    this.master = null;
    this.ready = false;
    this._initPromise = null;
  }

  // Must be called from a user gesture the first time, per browser autoplay
  // policy. Memoized so overlapping first presses build one context.
  init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._build();
    return this._initPromise;
  }

  async _build() {
    if (this.ready) return this;
    const ctx = this.contextFactory();
    this.ctx = ctx;
    await ctx.audioWorklet.addModule(this.workletUrl);
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
    for (const family of FAMILY_NODES) {
      const node = this.workletNodeFactory(ctx, `taal-${family}`, {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      });
      const gain = ctx.createGain();
      gain.gain.value = 1;
      node.connect(gain);
      gain.connect(this.master);
      this.nodes[family] = node;
      this.gains[family] = gain;
    }
    this.ready = true;
    return this;
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // Fire a bol by id. Compound strokes and rolls expand through resolveHits.
  // whenSec defaults to now. velocity scales the hit gain.
  trigger(bolId, whenSec, velocity = 1) {
    if (!this.ready) return [];
    const bol = getBol(bolId);
    if (!bol) return [];
    const when = typeof whenSec === "number" ? whenSec : this.now();
    const hits = resolveHits(bolId, when, velocity);
    const routed = [];
    for (const hit of hits) {
      const node = this.nodes[hit.family];
      if (!node) continue;
      node.port.postMessage({ type: "hit", when: hit.when, params: hit.params });
      routed.push(hit);
    }
    return routed;
  }

  // Plain sight synthesis controls. The interface binds sliders to these.
  // family: tonic | bass | transient, or "all".
  // name: tune (semitones) | ring (decay multiplier) | slap (noise multiplier) | gain (level).
  setVoiceParam(family, name, value) {
    if (!this.ready) return;
    const targets = family === "all" ? FAMILY_NODES : [family];
    for (const f of targets) {
      const node = this.nodes[f];
      if (node) node.port.postMessage({ type: "param", name, value });
    }
  }

  setMasterGain(value) {
    if (this.master) this.master.gain.value = value;
  }

  // Stop all sounding voices, used when playback halts.
  panic() {
    for (const family of FAMILY_NODES) {
      const node = this.nodes[family];
      if (node) node.port.postMessage({ type: "panic" });
    }
  }

  async resume() {
    if (this.ctx && this.ctx.state === "suspended") await this.ctx.resume();
  }
}
