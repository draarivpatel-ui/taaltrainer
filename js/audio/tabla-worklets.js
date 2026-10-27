// Synthesis worklets for TaalTrainer.
// Three AudioWorklet processors, one per stroke family.
//   taal-tonic     ringing dayan strokes (na, ta, tin, tun and the dayan half
//                  of dha and dhin), modeled as five coupled membrane modes
//                  near a harmonic series with a short attack pitch drop
//   taal-bass      bayan strokes (ge, ke and the bass half of dha, dhin), low
//                  modes with a hand pressure pitch glide and a slap transient
//   taal-transient dry finger articulations (te, ti, ra, kat and the roll),
//                  noise dominant with two very short damped modes
//
// Everything is synthesized from oscillators and noise. No samples, no
// network, no dependencies. All synthesis parameters arrive as plain messages
// so the interface can show every value.
//
// The file also runs under Node for testing: outside the worklet scope the
// processors attach to globalThis.TaalTrainerWorklets and the base class is a
// clock stub, so the DSP kernels can be exercised by node:test directly.

const IN_WORKLET = typeof AudioWorkletProcessor === "function";
const SR = typeof sampleRate === "number" ? sampleRate : 48000;
const TWO_PI = Math.PI * 2;

// Deterministic noise generator, xorshift32. Seeded per voice from the
// fundamental so tests are repeatable and strokes do not all hiss alike.
function makeNoise(seed) {
  let s = seed >>> 0;
  if (s === 0) s = 22222;
  return function next() {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 2147483648 - 1;
  };
}

// One struck voice: a bank of exponentially decaying sine modes plus a noise
// transient. Config comes from the family, params from the bol and the
// on screen sliders at hit time.
class StrikeVoice {
  constructor(cfg, params, start) {
    this.start = start;
    this.done = false;
    this.bendAmt = params.glide != null ? params.glide : cfg.bend || 0;
    this.bendTau = params.glide != null ? 0.05 : cfg.bendTau || 0.006;
    this.openness = Math.min(1, Math.max(0.02, params.openness != null ? params.openness : 0.5));
    this.gain = params.gain != null ? params.gain : 1;
    this.modes = cfg.modes.map((ratio, k) => {
      const f = Math.max(30, params.fundamental * ratio);
      const tau = Math.max(0.008, params.decay * cfg.decayRatios[k] * (0.55 + 0.45 * this.openness));
      return {
        w: TWO_PI * f / SR,
        amp: cfg.amps[k] * (k === 0 ? 1 : Math.pow(this.openness, 0.8)),
        d: Math.exp(-1 / (SR * tau)),
        phase: 0
      };
    });
    this.noiseAmp = (params.noise != null ? params.noise : 0.5) * cfg.noiseScale;
    this.noiseD = Math.exp(-1 / (SR * (cfg.noiseTau || 0.008)));
    this.noise = makeNoise((params.fundamental * 7919 + cfg.seedOffset) >>> 0);
    this.maxTau = params.decay;
  }

  // Mix this voice into channel data for one render quantum.
  renderInto(ch, n, blockStart) {
    const offset = (this.start - blockStart) * SR;
    const begin = Math.max(0, Math.ceil(offset));
    if (begin >= n) return; // still in the future, keep the voice queued
    let energy = 0;
    const modes = this.modes;
    const bendAmt = this.bendAmt;
    const bendTau = this.bendTau;
    const noise = this.noise;
    let noiseAmp = this.noiseAmp;
    const noiseD = this.noiseD;
    for (let i = begin; i < n; i += 1) {
      const r = (i - offset) / SR;
      const bend = bendAmt > 0 ? 1 + bendAmt * Math.exp(-r / bendTau) : 1;
      let s = 0;
      for (let k = 0; k < modes.length; k += 1) {
        const m = modes[k];
        s += m.amp * Math.sin(m.phase);
        m.phase += m.w * bend;
        m.amp *= m.d;
        if (m.amp > energy) energy = m.amp;
      }
      const nz = noise() * noiseAmp;
      noiseAmp *= noiseD;
      ch[i] += (s + nz) * this.gain;
      if (r > this.maxTau * 6 + 0.5) break; // hard lifetime cap
    }
    // The noise level must persist across quanta or every block restarts the
    // transient at full volume.
    this.noiseAmp = noiseAmp;
    if (energy < 0.0001 && noiseAmp < 0.0004) this.done = true;
  }
}

// Family configs. Mode ratios stay near harmonic because the tabla syahi load
// pulls the membrane modes toward the tuning note; higher modes decay faster.
const FAMILIES = {
  tonic: {
    name: "taal-tonic",
    modes: [1, 2.0, 3.01, 4.16, 5.43],
    amps: [1, 0.55, 0.32, 0.18, 0.1],
    decayRatios: [1, 0.72, 0.55, 0.42, 0.3],
    bend: 0.025,
    bendTau: 0.006,
    noiseScale: 0.8,
    noiseTau: 0.008,
    seedOffset: 11
  },
  bass: {
    name: "taal-bass",
    modes: [1, 1.98, 2.94],
    amps: [1, 0.42, 0.16],
    decayRatios: [1, 0.6, 0.45],
    bend: 0,
    bendTau: 0.05,
    noiseScale: 0.7,
    noiseTau: 0.02,
    seedOffset: 23
  },
  transient: {
    name: "taal-transient",
    modes: [1, 1.62],
    amps: [0.5, 0.25],
    decayRatios: [1, 0.7],
    bend: 0,
    bendTau: 0.004,
    noiseScale: 1.6,
    noiseTau: 0.018,
    seedOffset: 37
  }
};

const MAX_VOICES = 12;

function createProcessorClass(cfg) {
  const Base = IN_WORKLET
    ? AudioWorkletProcessor
    : class WorkletProcessorStub {
        constructor() {
          this._nodeTime = 0;
          this.port = { postMessage() {}, onmessage: null };
        }
        get currentTime() {
          return typeof currentTime === "number" ? currentTime : this._nodeTime;
        }
      };

  return class FamilyProcessor extends Base {
    static get familyName() {
      return cfg.name;
    }
    static get parameterDescriptors() {
      return [];
    }

    constructor(options) {
      super();
      const po = (options && options.processorOptions) || {};
      this.voices = [];
      this.params = {
        tune: typeof po.tune === "number" ? po.tune : 0,
        ring: typeof po.ring === "number" ? po.ring : 1,
        slap: typeof po.slap === "number" ? po.slap : 1,
        gain: typeof po.gain === "number" ? po.gain : 0.9
      };
      this.port.onmessage = (e) => this.onMessage(e && e.data);
    }

    onMessage(msg) {
      if (!msg || typeof msg.type !== "string") return;
      if (msg.type === "param" && Object.prototype.hasOwnProperty.call(this.params, msg.name)) {
        this.params[msg.name] = msg.value;
      } else if (msg.type === "hit") {
        this.addVoice(msg);
      } else if (msg.type === "panic") {
        this.voices.length = 0;
      }
    }

    addVoice(msg) {
      const when = typeof msg.when === "number" ? msg.when : this.currentTime;
      const p = msg.params || {};
      const tuneMul = Math.pow(2, this.params.tune / 12);
      const voice = new StrikeVoice(cfg, {
        fundamental: Math.max(30, (p.fundamental || 300) * tuneMul),
        decay: Math.max(0.02, (p.decay || 0.4) * this.params.ring),
        openness: p.openness,
        noise: (p.noise != null ? p.noise : 0.5) * this.params.slap,
        gain: (p.gain != null ? p.gain : 1) * this.params.gain,
        glide: p.glide
      }, when);
      this.voices.push(voice);
      if (this.voices.length > MAX_VOICES) this.voices.shift();
    }

    process(inputs, outputs) {
      const out = outputs[0];
      if (!out || out.length === 0) return true;
      const ch0 = out[0];
      const n = ch0.length;
      const blockStart = this.currentTime;
      for (let i = 0; i < n; i += 1) ch0[i] = 0;
      for (const v of this.voices) v.renderInto(ch0, n, blockStart);
      // gentle soft clip keeps stacked voices from fouling the output
      for (let i = 0; i < n; i += 1) {
        const x = ch0[i];
        ch0[i] = x / (1 + Math.abs(x) * 0.7);
      }
      for (let c = 1; c < out.length; c += 1) out[c].set(ch0);
      if (this.voices.some((v) => v.done)) {
        this.voices = this.voices.filter((v) => !v.done);
      }
      if (!IN_WORKLET) this._nodeTime += n / SR;
      return true;
    }
  };
}

const TonicProcessor = createProcessorClass(FAMILIES.tonic);
const BassProcessor = createProcessorClass(FAMILIES.bass);
const TransientProcessor = createProcessorClass(FAMILIES.transient);

if (IN_WORKLET) {
  registerProcessor("taal-tonic", TonicProcessor);
  registerProcessor("taal-bass", BassProcessor);
  registerProcessor("taal-transient", TransientProcessor);
} else if (typeof globalThis !== "undefined") {
  globalThis.TaalTrainerWorklets = { TonicProcessor, BassProcessor, TransientProcessor, FAMILIES };
}
