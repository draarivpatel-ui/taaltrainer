import { test } from "node:test";
import assert from "node:assert/strict";
import { getTaal } from "../js/engine/taal.js";
import {
  beatTime, beatAt, cyclePhase, hitsInWindow, countIn, phraseTimeline
} from "../js/engine/clock.js";

test("beatTime places beats on exact multiples", () => {
  assert.equal(beatTime(0, 120, 10), 10);
  assert.equal(beatTime(4, 120, 10), 12);
  assert.equal(beatTime(8, 60, 0), 8);
  assert.equal(beatTime(3, 90, 5), 7);
});

test("beatAt reports absolute and in cycle position", () => {
  const at = beatAt(12.25, 120, 10, 16);
  assert.equal(at.absolute, 4);
  assert.equal(at.beatInCycle, 4);
  const wrapped = beatAt(12.25, 120, 10, 2);
  assert.equal(wrapped.beatInCycle, 0);
  // A query before the start reports the tail of the previous cycle.
  const before = beatAt(9.99, 120, 10, 16);
  assert.equal(before.absolute, -1);
  assert.equal(before.beatInCycle, 15);
  assert.equal(beatAt(10.01, 120, 10, 16).absolute, 0);
});

test("cyclePhase runs zero to one and wraps", () => {
  assert.equal(cyclePhase(10, 60, 10, 8), 0);
  assert.equal(cyclePhase(14, 60, 10, 8), 0.5);
  assert.equal(cyclePhase(18, 60, 10, 8), 0);
  const p = cyclePhase(17.5, 60, 10, 8);
  assert.ok(p > 0.9 && p < 1, "phase near the end of the cycle");
});

test("hitsInWindow returns the full teentaal cycle over one cycle span", () => {
  const teentaal = getTaal("teentaal");
  const hits = hitsInWindow(teentaal, 60, 0, 0, 16);
  assert.equal(hits.length, 16);
  assert.equal(hits[0].bol, "dha");
  assert.equal(hits[0].sam, true);
  // Matra 9 opens the khali vibhag, the theka there opens with dha then tin.
  assert.equal(hits[8].bol, "dha");
  assert.equal(hits[8].khali, true);
  assert.equal(hits[9].bol, "tin");
  assert.equal(hits[15].time, 15);
});

test("hitsInWindow honors half open window edges", () => {
  const teentaal = getTaal("teentaal");
  assert.equal(hitsInWindow(teentaal, 60, 0, 0, 1).length, 1);
  assert.equal(hitsInWindow(teentaal, 60, 0, 0.5, 1.5).length, 1);
  assert.equal(hitsInWindow(teentaal, 60, 0, 1, 2)[0].beat, 1);
  assert.equal(hitsInWindow(teentaal, 60, 0, 5, 5).length, 0);
});

test("hitsInWindow crosses cycle boundaries with wrapped flags", () => {
  const teentaal = getTaal("teentaal");
  const hits = hitsInWindow(teentaal, 60, 0, 15, 18);
  assert.equal(hits.length, 3);
  assert.equal(hits[1].absoluteBeat, 16);
  assert.equal(hits[1].beat, 0);
  assert.equal(hits[1].sam, true);
  assert.equal(hits[1].time, 16);
});

test("the scheduler window never double books a beat", () => {
  const teentaal = getTaal("teentaal");
  const a = hitsInWindow(teentaal, 120, 0, 0, 4);
  const b = hitsInWindow(teentaal, 120, 0, 4, 8);
  const beats = [...a, ...b].map((h) => h.absoluteBeat);
  assert.equal(new Set(beats).size, beats.length);
  assert.equal(beats.length, 16);
});

test("keherwa theka schedules in order at 84 bpm", () => {
  const k = getTaal("keherwa");
  const step = 60 / 84;
  const hits = hitsInWindow(k, 84, 2, 2, 2 + 8 * step);
  assert.equal(hits.length, 8);
  assert.deepEqual(hits.map((h) => h.bol), k.theka);
  assert.ok(Math.abs(hits[3].time - (2 + 3 * step)) < 1e-9);
  assert.equal(hits[4].khali, true);
});

test("count in clicks land before the phrase start", () => {
  const { clicks, phraseStart } = countIn(120, 4, 3);
  assert.equal(clicks.length, 4);
  assert.deepEqual(clicks.map((c) => c.time), [3, 3.5, 4, 4.5]);
  assert.equal(phraseStart, 5);
  assert.equal(clicks[0].sam, true);
  assert.equal(clicks[1].sam, false);
});

test("phraseTimeline lays phrase bols one per beat in milliseconds", () => {
  const tl = phraseTimeline(["na", "ge", "na", "ge"], 120, 0);
  assert.deepEqual(tl.map((e) => e.timeMs), [0, 500, 1000, 1500]);
  assert.deepEqual(tl.map((e) => e.bolId), ["na", "ge", "na", "ge"]);
  const tl2 = phraseTimeline(["tin"], 60, 2);
  assert.deepEqual(tl2[0].timeMs, 2000);
});

test("phraseTimeline at slow tempo spaces a full second apart", () => {
  const tl = phraseTimeline(["dha", "dhin"], 60, 0);
  assert.deepEqual(tl.map((e) => e.timeMs), [0, 1000]);
});
