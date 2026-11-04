// Recorder math for TaalTrainer.
// Turns captured tap events into a bol notation timeline that can be
// displayed and replayed. Pure functions, fully testable.
//
// Captured events are { bolId, timeMs } with timeMs measured from the moment
// recording started.

import { getBol } from "./bol.js";
import { beatDuration } from "./taal.js";

function validateEvents(events) {
  if (!Array.isArray(events) || events.length > 10000 || events.some((event) => !Number.isFinite(event.timeMs))) throw new RangeError("Invalid recording events");
}

// How many milliseconds the recorder keeps listening after the last hit
// before it decides the phrase is over.
export const TAIL_MS = 900;

export function spanMs(events) {
  validateEvents(events);
  if (events.length === 0) return 0;
  return Math.max(0, ...events.map((event) => event.timeMs)) + TAIL_MS;
}

// Group captured events into columns of one beat each. originMs anchors the
// grid; columns are zero indexed. Events before the origin land in column
// zero so nothing is silently dropped.
export function buildColumns(events, bpm, originMs = 0) {
  validateEvents(events);
  if (!Number.isFinite(originMs)) throw new RangeError("Recording origin must be finite");
  const beat = beatDuration(bpm) * 1000;
  if (events.some((event) => (event.timeMs - originMs) / beat >= 4096)) throw new RangeError("Recording exceeds 4096 columns");
  const columns = [];
  for (const ev of events) {
    const raw = (ev.timeMs - originMs) / beat;
    const index = Math.max(0, Math.floor(raw));
    if (!columns[index]) columns[index] = [];
    columns[index].push({ bolId: ev.bolId, offsetMs: Math.round(ev.timeMs - originMs - index * beat) });
  }
  const out = [];
  const last = events.reduce((m, e) => Math.max(m, e.timeMs - originMs), 0);
  const count = events.length === 0 ? 0 : Math.floor(last / beat) + 1;
  for (let i = 0; i < count; i += 1) {
    out.push({ column: i, hits: columns[i] || [] });
  }
  return out;
}

// The notation line a player reads: bol names per column, a middle dot for a
// rest. Compound strokes print as their own name. Returns an array of strings
// aligned with buildColumns output.
export function notationLine(columns) {
  return columns.map((col) => {
    if (col.hits.length === 0) return "\u00B7"; // middle dot for a rest
    return col.hits.map((h) => getBol(h.bolId)?.name ?? "?").join(" ");
  });
}

// Devanagari line for display, same alignment as notationLine.
export function notationDevanagari(columns) {
  return columns.map((col) => {
    if (col.hits.length === 0) return "\u00B7";
    return col.hits.map((h) => getBol(h.bolId)?.devanagari ?? "?").join(" ");
  });
}

// Replay schedule: events sorted by time with absolute and relative times,
// ready for the audio engine to consume one by one.
export function replaySchedule(events) {
  validateEvents(events);
  const sorted = [...events].sort((a, b) => a.timeMs - b.timeMs);
  return sorted.map((ev, i) => ({
    order: i,
    bolId: ev.bolId,
    timeMs: Math.round(ev.timeMs),
    gapMs: i === 0 ? Math.round(ev.timeMs) : Math.round(ev.timeMs - sorted[i - 1].timeMs)
  }));
}

// Drop events that arrive inside the same 30ms window as the previous one,
// which is what a jittery double tap looks like on touch screens.
export function dedupeEvents(events, windowMs = 30) {
  validateEvents(events);
  if (!Number.isFinite(windowMs) || windowMs < 0) throw new RangeError("Invalid dedupe window");
  const out = [];
  for (const ev of [...events].sort((a, b) => a.timeMs - b.timeMs)) {
    const prev = out[out.length - 1];
    if (prev && ev.timeMs - prev.timeMs < windowMs && prev.bolId === ev.bolId) continue;
    out.push(ev);
  }
  return out;
}

// Quantize events to the nearest beat grid position, used when the player
// wants a cleaned up notation line. Returns new events, input untouched.
export function quantize(events, bpm, originMs = 0) {
  validateEvents(events);
  if (!Number.isFinite(originMs)) throw new RangeError("Recording origin must be finite");
  const beat = beatDuration(bpm) * 1000;
  return [...events]
    .sort((a, b) => a.timeMs - b.timeMs)
    .map((ev) => ({ bolId: ev.bolId, timeMs: Math.max(0, Math.round((ev.timeMs - originMs) / beat) * beat + originMs) }));
}
