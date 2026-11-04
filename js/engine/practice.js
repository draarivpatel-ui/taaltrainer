import { beatDuration } from "./taal.js";
import { toleranceMs } from "./scoring.js";

// One shared audio/visual timeline, including the actual audio lead-in.
export function practicePlan(lesson, leadMs = 250) {
  const beatMs = beatDuration(lesson.bpm) * 1000;
  if (!Array.isArray(lesson.phrase) || !lesson.phrase.length || lesson.phrase.length > 1024) throw new RangeError("Invalid practice phrase");
  if (!Number.isFinite(leadMs) || leadMs < 0) throw new RangeError("Invalid lead in");
  const callStartMs = leadMs + 4 * beatMs;
  const responseStartMs = callStartMs + lesson.phrase.length * beatMs;
  return {
    countIn: Array.from({ length: 4 }, (_, index) => ({ index, timeMs: leadMs + index * beatMs })),
    call: lesson.phrase.map((bolId, index) => ({ bolId, timeMs: callStartMs + index * beatMs })),
    responseStartMs,
    responseDurationMs: lesson.phrase.length * beatMs + toleranceMs(lesson.bpm)
  };
}
