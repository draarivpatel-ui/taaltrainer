// Rhythm clock math for TaalTrainer.
// Pure functions mapping wall clock seconds onto taal cycles. The audio
// scheduler and the beat lamps both consume this module, so it stays free of
// any DOM or AudioContext reference and is fully testable.

import { beatDuration, cycleDuration, isSam, isTaali, isKhali, thekaBolAt, vibhagOf } from "./taal.js";

// Time in seconds of a beat index (absolute, may exceed one cycle) relative to
// a cycle start time.
export function beatTime(beatIndex, bpm, startTime) {
  return startTime + beatIndex * beatDuration(bpm);
}

// Which beat of the taal cycle is sounding at time t. Returns the absolute
// beat count since the start and the beat position inside one cycle.
export function beatAt(t, bpm, startTime, beats) {
  const bd = beatDuration(bpm);
  const absolute = Math.floor((t - startTime) / bd);
  const beatInCycle = ((absolute % beats) + beats) % beats;
  return { absolute, beatInCycle };
}

// Phase through the current cycle, 0 inclusive to 1 exclusive.
export function cyclePhase(t, bpm, startTime, beats) {
  const cd = cycleDuration({ beats }, bpm);
  const elapsed = t - startTime;
  if (cd <= 0) return 0;
  let p = (elapsed % cd) / cd;
  if (p < 0) p += 1;
  return p;
}

// Every theka hit with a start time inside [fromSec, toSec). Used by the
// lookahead scheduler: ask once per tick for the window ahead and schedule
// exactly what comes back. Returns absolute beat index, in cycle beat, the bol
// to fire, the exact AudioContext time, and the lamp flags for that beat.
export function hitsInWindow(taal, bpm, startTime, fromSec, toSec, cycleLimit = Infinity) {
  const bd = beatDuration(bpm);
  if (![startTime, fromSec, toSec].every(Number.isFinite)) throw new RangeError("Window times must be finite");
  if (toSec <= fromSec) return [];
  if (!Number.isInteger(taal.beats) || taal.beats <= 0) throw new RangeError("beat count must be positive");
  if (!(cycleLimit === Infinity || (Number.isInteger(cycleLimit) && cycleLimit > 0))) throw new RangeError("Invalid cycle limit");
  if ((toSec - fromSec) / bd > 100000) throw new RangeError("Scheduling window is too large");
  const first = Math.ceil((fromSec - startTime) / bd - 1e-9);
  const last = Math.floor((toSec - startTime - 1e-9) / bd);
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) throw new RangeError("Scheduling indices must be safe integers");
  const out = [];
  if (!Number.isFinite(first) || !Number.isFinite(last)) return out;
  for (let n = Math.max(first, 0); n <= last && n < cycleLimit * taal.beats; n += 1) {
    const beatInCycle = n % taal.beats;
    out.push({
      absoluteBeat: n,
      beat: beatInCycle,
      bol: thekaBolAt(taal, beatInCycle),
      time: beatTime(n, bpm, startTime),
      sam: isSam(taal, beatInCycle),
      taali: isTaali(taal, beatInCycle),
      khali: isKhali(taal, beatInCycle),
      vibhag: vibhagOf(taal, beatInCycle)
    });
  }
  return out;
}

// A short count in for call and response: four clicks ending one beat before
// the phrase begins. Returns the click times in seconds after fromSec.
export function countIn(bpm, beats = 4, fromSec = 0) {
  const bd = beatDuration(bpm);
  if (!Number.isInteger(beats) || beats < 0 || beats > 1024 || !Number.isFinite(fromSec)) throw new RangeError("Invalid count in");
  const clicks = [];
  for (let i = 0; i < beats; i += 1) {
    clicks.push({ index: i, time: fromSec + i * bd, sam: i === 0 });
  }
  return { clicks, phraseStart: fromSec + beats * bd };
}

// Place a phrase of bols on consecutive beats starting at phraseStart.
// Returns expected events in milliseconds relative to phraseStart, which is
// the format the scorer consumes.
export function phraseTimeline(phrase, bpm, phraseStart = 0) {
  const bd = beatDuration(bpm) * 1000;
  return phrase.map((bolId, i) => ({
    index: i,
    bolId,
    timeMs: Math.round(phraseStart * 1000 + i * bd)
  }));
}
