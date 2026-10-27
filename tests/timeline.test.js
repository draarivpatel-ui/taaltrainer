import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TAIL_MS, spanMs, buildColumns, notationLine, notationDevanagari,
  replaySchedule, dedupeEvents, quantize
} from "../js/engine/timeline.js";
import { getBol } from "../js/engine/bol.js";

test("an empty capture renders no columns", () => {
  assert.deepEqual(buildColumns([], 120), []);
  assert.deepEqual(notationLine([]), []);
  assert.equal(spanMs([]), 0);
});

test("events group into one beat columns", () => {
  const cols = buildColumns(
    [
      { bolId: "dha", timeMs: 10 },
      { bolId: "ge", timeMs: 520 },
      { bolId: "na", timeMs: 1010 },
      { bolId: "ti", timeMs: 1490 }
    ],
    120
  );
  assert.equal(cols.length, 3);
  assert.deepEqual(cols[0].hits.map((h) => h.bolId), ["dha"]);
  assert.deepEqual(cols[1].hits.map((h) => h.bolId), ["ge"]);
  assert.deepEqual(cols[2].hits.map((h) => h.bolId), ["na", "ti"]);
});

test("flams inside one column keep their offsets", () => {
  const cols = buildColumns([{ bolId: "na", timeMs: 30 }, { bolId: "tin", timeMs: 70 }], 60);
  assert.equal(cols[0].hits.length, 2);
  assert.deepEqual(cols[0].hits.map((h) => h.offsetMs), [30, 70]);
});

test("events before the origin land in column zero", () => {
  const cols = buildColumns([{ bolId: "na", timeMs: -40 }], 120, 0);
  assert.equal(cols.length, 1);
  assert.deepEqual(cols[0].hits.map((h) => h.bolId), ["na"]);
});

test("notation line prints bols and middle dot rests", () => {
  const cols = buildColumns(
    [
      { bolId: "dha", timeMs: 0 },
      { bolId: "dhin", timeMs: 500 },
      { bolId: "na", timeMs: 1500 }
    ],
    120
  );
  assert.deepEqual(notationLine(cols), ["dha", "dhin", "\u00B7", "na"]);
  const deva = notationDevanagari(cols);
  assert.equal(deva[0], getBol("dha").devanagari);
  assert.equal(deva[2], "\u00B7");
});

test("replay schedule is sorted with gaps", () => {
  const plan = replaySchedule([
    { bolId: "ge", timeMs: 800 },
    { bolId: "na", timeMs: 0 },
    { bolId: "tin", timeMs: 500 }
  ]);
  assert.deepEqual(plan.map((e) => e.bolId), ["na", "tin", "ge"]);
  assert.deepEqual(plan.map((e) => e.gapMs), [0, 500, 300]);
  assert.deepEqual(plan.map((e) => e.order), [0, 1, 2]);
});

test("jittery double taps collapse under dedupe", () => {
  const clean = dedupeEvents([
    { bolId: "na", timeMs: 100 },
    { bolId: "na", timeMs: 112 },
    { bolId: "na", timeMs: 400 },
    { bolId: "ge", timeMs: 410 },
    { bolId: "ge", timeMs: 800 }
  ]);
  assert.deepEqual(clean.map((e) => e.timeMs), [100, 400, 410, 800]);
});

test("dedupe keeps different strokes even when nearly simultaneous", () => {
  const clean = dedupeEvents([
    { bolId: "na", timeMs: 100 },
    { bolId: "ge", timeMs: 105 }
  ]);
  assert.equal(clean.length, 2);
});

test("quantize snaps to the beat grid without mutating input", () => {
  const events = [
    { bolId: "na", timeMs: 80 },
    { bolId: "ge", timeMs: 540 }
  ];
  const q = quantize(events, 120, 0);
  assert.deepEqual(q.map((e) => e.timeMs), [0, 500]);
  assert.equal(events[0].timeMs, 80, "input untouched");
});

test("quantize respects an origin offset", () => {
  const q = quantize([{ bolId: "tin", timeMs: 1230 }], 120, 1000);
  assert.deepEqual(q.map((e) => e.timeMs), [1000]);
});

test("span includes the listening tail", () => {
  assert.equal(spanMs([{ bolId: "na", timeMs: 1200 }]), 1200 + TAIL_MS);
  assert.ok(TAIL_MS >= 500 && TAIL_MS <= 2000);
});
