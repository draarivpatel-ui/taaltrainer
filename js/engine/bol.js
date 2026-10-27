// Bol definitions for TaalTrainer.
// Pure data and pure lookups only. No DOM, no audio objects, fully testable.
//
// A bol is one spoken stroke syllable. Each entry carries its Devanagari
// display glyph, the synthesis family that renders it, the physical key on the
// home row that plays it, and the synthesis parameters passed to the worklet
// node when the stroke fires.

export const FAMILIES = ["tonic", "bass", "transient"];

// The dayan (right drum) rings with near harmonic membrane modes, so tonic
// strokes carry a fundamental plus a small inharmonic spread. The bayan (left
// drum) is the bass family. Finger taps and slaps that barely ring are the
// transient family. Compound strokes (dha, dhin, tirakita) fire more than one
// family, which the engine resolves at trigger time.
export const BOLS = [
  {
    id: "na",
    name: "na",
    devanagari: "ना",
    family: "tonic",
    code: "KeyA",
    keyLabel: "A",
    gloss: "ringing stroke on the rim of the dayan",
    voices: [{ family: "tonic" }],
    params: { fundamental: 300, decay: 0.45, openness: 0.3, noise: 0.45 }
  },
  {
    id: "ta",
    name: "ta",
    devanagari: "टा",
    family: "tonic",
    code: "KeyS",
    keyLabel: "S",
    gloss: "closed snap on the dayan, drier than na",
    voices: [{ family: "tonic" }],
    params: { fundamental: 300, decay: 0.38, openness: 0.22, noise: 0.6 }
  },
  {
    id: "tin",
    devanagari: "तिन",
    name: "tin",
    family: "tonic",
    code: "KeyD",
    keyLabel: "D",
    gloss: "open ringing stroke, the dayan sings",
    voices: [{ family: "tonic" }],
    params: { fundamental: 300, decay: 1.15, openness: 0.9, noise: 0.25 }
  },
  {
    id: "tun",
    name: "tun",
    devanagari: "तून",
    family: "tonic",
    code: "KeyF",
    keyLabel: "F",
    gloss: "deep open tone on the center of the dayan",
    voices: [{ family: "tonic" }],
    params: { fundamental: 225, decay: 1.35, openness: 1.0, noise: 0.2 }
  },
  {
    id: "dha",
    name: "dha",
    devanagari: "धा",
    family: "tonic",
    code: "KeyG",
    keyLabel: "G",
    gloss: "bass ge under a ringing na, both hands together",
    // Compound strokes carry a param set per hand so the bass half speaks
    // like ge and the dayan half like na.
    voices: [
      { family: "bass", params: { fundamental: 92, decay: 0.8, openness: 1, noise: 0.35, glide: 0.12 } },
      { family: "tonic", params: { fundamental: 300, decay: 0.5, openness: 0.45, noise: 0.45 } }
    ],
    params: { fundamental: 300, decay: 0.5, openness: 0.45, noise: 0.45 }
  },
  {
    id: "dhin",
    name: "dhin",
    devanagari: "धिन",
    family: "tonic",
    code: "KeyH",
    keyLabel: "H",
    gloss: "bass ge under an open tin",
    voices: [
      { family: "bass", params: { fundamental: 92, decay: 0.8, openness: 1, noise: 0.35, glide: 0.12 } },
      { family: "tonic", params: { fundamental: 300, decay: 1.0, openness: 0.85, noise: 0.28 } }
    ],
    params: { fundamental: 300, decay: 1.0, openness: 0.85, noise: 0.28 }
  },
  {
    id: "ge",
    name: "ge",
    devanagari: "गे",
    family: "bass",
    code: "KeyJ",
    keyLabel: "J",
    gloss: "open bass tone pressed out of the bayan",
    voices: [{ family: "bass" }],
    params: { fundamental: 92, decay: 0.9, openness: 1.0, noise: 0.35, glide: 0.14 }
  },
  {
    id: "ke",
    name: "ke",
    devanagari: "के",
    family: "bass",
    code: "KeyK",
    keyLabel: "K",
    gloss: "dry bass slap, almost no ring",
    voices: [{ family: "bass" }],
    params: { fundamental: 105, decay: 0.22, openness: 0.2, noise: 0.65, glide: 0 }
  },
  {
    id: "te",
    name: "te",
    devanagari: "ते",
    family: "transient",
    code: "KeyL",
    keyLabel: "L",
    gloss: "finger tip tap on the edge, mostly noise",
    voices: [{ family: "transient" }],
    params: { fundamental: 700, decay: 0.12, openness: 0.1, noise: 0.9 }
  },
  {
    id: "ti",
    name: "ti",
    devanagari: "ति",
    family: "transient",
    code: "Semicolon",
    keyLabel: ";",
    gloss: "quicker finger tap, sits under tirakita",
    voices: [{ family: "transient" }],
    params: { fundamental: 820, decay: 0.1, openness: 0.1, noise: 0.85 }
  },
  {
    id: "ra",
    name: "ra",
    devanagari: "रा",
    family: "transient",
    code: "Quote",
    keyLabel: "'",
    gloss: "light slap that opens the tirakita roll",
    voices: [{ family: "transient" }],
    params: { fundamental: 950, decay: 0.09, openness: 0.08, noise: 0.8 }
  },
  {
    id: "kat",
    name: "kat",
    devanagari: "कत्",
    family: "transient",
    code: "Backslash",
    keyLabel: "\\",
    gloss: "flat slap of several fingers, low and dry",
    voices: [{ family: "transient" }],
    params: { fundamental: 520, decay: 0.14, openness: 0.12, noise: 0.75 }
  },
  {
    id: "tirakita",
    name: "tirakita",
    devanagari: "तिरकिट",
    family: "transient",
    code: "Enter",
    keyLabel: "Enter",
    gloss: "the four finger roll, ti ra ki ta in one key",
    voices: [
      { family: "transient" },
      { family: "transient" },
      { family: "transient" },
      { family: "transient" }
    ],
    // The roll fires four sub hits spaced by rollSpacingMs at trigger time.
    roll: ["ti", "ra", "ti", "ta"],
    rollSpacingMs: 55,
    params: { fundamental: 780, decay: 0.1, openness: 0.1, noise: 0.85 }
  }
];

export const BOL_IDS = BOLS.map((b) => b.id);

const BY_ID = new Map(BOLS.map((b) => [b.id, b]));
const BY_CODE = new Map(BOLS.map((b) => [b.code, b]));

export function getBol(id) {
  return BY_ID.get(id) || null;
}

export function bolForKey(code) {
  return BY_CODE.get(code) || null;
}

export function bolsByFamily(family) {
  return BOLS.filter((b) => b.family === family);
}

// Resolve one bol into concrete family hits. Compound strokes expand here so
// the audio layer never has to know about rolls or double handed strokes.
// whenSec is the AudioContext time of the first voice; the caller spreads the
// rest using each voice's own spacing.
export function resolveHits(bolId, whenSec, velocity = 1) {
  const bol = getBol(bolId);
  if (!bol) return [];
  if (bol.roll) {
    const spacing = bol.rollSpacingMs / 1000;
    return bol.roll.map((subId, i) => {
      const sub = getBol(subId) || bol;
      return {
        family: sub.family,
        when: whenSec + i * spacing,
        params: { ...sub.params, gain: velocity }
      };
    });
  }
  return bol.voices.map((v) => ({
    family: v.family,
    when: whenSec,
    params: { ...(v.params || bol.params), gain: velocity }
  }));
}

export const KEY_CODES = BOLS.map((b) => b.code);
