// Taal definitions and cycle math for TaalTrainer.
// Pure data and pure functions. No DOM, no audio, fully testable with node:test.
//
// Beats are indexed from zero inside the module. Beat zero is sam. The public
// helpers accept the zero indexed beat and say so in their names.

export const TAALS = [
  {
    id: "teentaal",
    name: "Teentaal",
    devanagari: "तीनताल",
    beats: 16,
    vibhags: [4, 4, 4, 4],
    taali: [0, 4, 12],
    khali: [8],
    theka: [
      "dha", "dhin", "dhin", "dha",
      "dha", "dhin", "dhin", "dha",
      "dha", "tin", "tin", "ta",
      "ta", "dhin", "dhin", "dha"
    ],
    note: "The sixteen beat cycle every tabla student meets first."
  },
  {
    id: "keherwa",
    name: "Keherwa",
    devanagari: "कहरवा",
    beats: 8,
    vibhags: [4, 4],
    taali: [0],
    khali: [4],
    theka: ["dha", "ge", "na", "ti", "na", "ke", "dhin", "na"],
    note: "The eight beat groove behind most light classical and film song."
  },
  {
    id: "dadra",
    name: "Dadra",
    devanagari: "दादरा",
    beats: 6,
    vibhags: [3, 3],
    taali: [0],
    khali: [3],
    theka: ["dha", "dhin", "na", "dha", "tun", "na"],
    note: "A lilting six beat cycle, three and three."
  },
  {
    id: "ektaal",
    name: "Ektaal",
    devanagari: "एकताल",
    beats: 12,
    vibhags: [2, 2, 2, 2, 2, 2],
    taali: [0, 4, 6, 10],
    khali: [],
    theka: [
      "dhin", "dhin", "dha", "ge",
      "tirakita", "tun", "na", "kat",
      "dha", "ge", "tirakita", "dhin"
    ],
    note: "Twelve beats in six vibhags of two, claps on 1, 5, 7 and 11."
  }
];

export const TAAL_IDS = TAALS.map((t) => t.id);

const BY_ID = new Map(TAALS.map((t) => [t.id, t]));

export function getTaal(id) {
  return BY_ID.get(id) || null;
}

export function beatDuration(bpm) {
  if (!(bpm > 0)) throw new RangeError("bpm must be positive");
  return 60 / bpm;
}

export function cycleDuration(taal, bpm) {
  return taal.beats * beatDuration(bpm);
}

export function isSam(taal, beat) {
  return beat % taal.beats === 0;
}

export function isTaali(taal, beat) {
  return taal.taali.includes(beat % taal.beats);
}

export function isKhali(taal, beat) {
  return taal.khali.includes(beat % taal.beats);
}

// Which vibhag a beat falls in, zero indexed. Vibhag lengths must sum to the
// beat count; validateTaal enforces that at load time.
export function vibhagOf(taal, beat) {
  const b = ((beat % taal.beats) + taal.beats) % taal.beats;
  let acc = 0;
  for (let i = 0; i < taal.vibhags.length; i += 1) {
    acc += taal.vibhags[i];
    if (b < acc) return i;
  }
  return taal.vibhags.length - 1;
}

export function thekaBolAt(taal, beat) {
  return taal.theka[beat % taal.beats];
}

export function validateTaal(taal) {
  const errors = [];
  const vibhagSum = taal.vibhags.reduce((a, b) => a + b, 0);
  if (vibhagSum !== taal.beats) {
    errors.push(`vibhags sum to ${vibhagSum}, expected ${taal.beats}`);
  }
  if (taal.theka.length !== taal.beats) {
    errors.push(`theka has ${taal.theka.length} steps, expected ${taal.beats}`);
  }
  for (const b of taal.taali) {
    if (b < 0 || b >= taal.beats) errors.push(`taali beat ${b} out of range`);
  }
  for (const b of taal.khali) {
    if (b < 0 || b >= taal.beats) errors.push(`khali beat ${b} out of range`);
  }
  for (const [i, b] of taal.taali.entries()) {
    if (taal.khali.includes(b)) errors.push(`beat ${b} is both taali and khali`);
    if (i === 0 && b !== 0) errors.push("first taali must be beat 0, the sam");
  }
  return { ok: errors.length === 0, errors };
}
