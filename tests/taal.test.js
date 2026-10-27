import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TAALS, TAAL_IDS, getTaal, beatDuration, cycleDuration,
  isSam, isTaali, isKhali, vibhagOf, thekaBolAt, validateTaal
} from "../js/engine/taal.js";
import { getBol } from "../js/engine/bol.js";

test("four taals ship and each has a unique id", () => {
  assert.equal(TAALS.length, 4);
  assert.deepEqual(TAAL_IDS, ["teentaal", "keherwa", "dadra", "ektaal"]);
  assert.equal(new Set(TAAL_IDS).size, 4);
});

test("beat duration math at the tempo slider extremes", () => {
  assert.equal(beatDuration(60), 1);
  assert.equal(beatDuration(120), 0.5);
  assert.equal(beatDuration(240), 0.25);
  assert.equal(beatDuration(40), 1.5);
});

test("cycle duration spans the full beat count", () => {
  assert.equal(cycleDuration(getTaal("teentaal"), 60), 16);
  assert.equal(cycleDuration(getTaal("teentaal"), 120), 8);
  assert.equal(cycleDuration(getTaal("keherwa"), 120), 4);
  assert.equal(cycleDuration(getTaal("dadra"), 60), 6);
  assert.equal(cycleDuration(getTaal("ektaal"), 60), 12);
});

test("sam is beat zero of every cycle", () => {
  for (const taal of TAALS) {
    assert.ok(isSam(taal, 0), `${taal.id} sam at 0`);
    assert.ok(isSam(taal, taal.beats), `${taal.id} sam wraps at ${taal.beats}`);
    assert.ok(!isSam(taal, 1));
  }
});

test("teentaal clap and khali positions", () => {
  const t = getTaal("teentaal");
  assert.ok(isTaali(t, 0));
  assert.ok(isTaali(t, 4));
  assert.ok(isTaali(t, 12));
  assert.ok(isKhali(t, 8));
  assert.ok(!isKhali(t, 4));
  assert.ok(!isTaali(t, 8));
});

test("keherwa and dadra have one clap and one khali", () => {
  const k = getTaal("keherwa");
  assert.deepEqual(k.taali, [0]);
  assert.deepEqual(k.khali, [4]);
  const d = getTaal("dadra");
  assert.deepEqual(d.taali, [0]);
  assert.deepEqual(d.khali, [3]);
});

test("ektaal claps on 1, 5, 7 and 11", () => {
  const e = getTaal("ektaal");
  assert.deepEqual(e.taali, [0, 4, 6, 10]);
  assert.equal(e.vibhags.length, 6);
});

test("every taal passes structural validation", () => {
  for (const taal of TAALS) {
    const v = validateTaal(taal);
    assert.deepEqual(v.errors, [], `${taal.id} errors`);
    assert.ok(v.ok, `${taal.id} ok`);
  }
});

test("every theka step names a real bol", () => {
  for (const taal of TAALS) {
    for (const bolId of taal.theka) {
      assert.ok(getBol(bolId), `${taal.id} step ${bolId} exists in the bol set`);
    }
  }
});

test("vibhag boundaries land where the structure says", () => {
  const t = getTaal("teentaal");
  assert.equal(vibhagOf(t, 0), 0);
  assert.equal(vibhagOf(t, 3), 0);
  assert.equal(vibhagOf(t, 4), 1);
  assert.equal(vibhagOf(t, 15), 3);
  const e = getTaal("ektaal");
  assert.equal(vibhagOf(e, 0), 0);
  assert.equal(vibhagOf(e, 2), 1);
  assert.equal(vibhagOf(e, 11), 5);
});

test("vibhagOf wraps beats beyond one cycle", () => {
  const t = getTaal("teentaal");
  assert.equal(vibhagOf(t, 16), 0);
  assert.equal(vibhagOf(t, 20), 1);
});

test("theka bol at wraps across cycles", () => {
  const t = getTaal("teentaal");
  assert.equal(thekaBolAt(t, 0), "dha");
  assert.equal(thekaBolAt(t, 15), "dha");
  assert.equal(thekaBolAt(t, 16), "dha");
  assert.equal(thekaBolAt(t, 9), "tin");
});

test("negative bpm is rejected", () => {
  assert.throws(() => beatDuration(0), RangeError);
  assert.throws(() => beatDuration(-10), RangeError);
});

test("validateTaal catches broken structures", () => {
  const broken = { ...getTaal("teentaal"), theka: getTaal("teentaal").theka.slice(0, 15) };
  const v = validateTaal(broken);
  assert.ok(!v.ok);
  assert.ok(v.errors[0].includes("theka has 15"));
});

test("a taali and khali cannot share one beat", () => {
  const broken = { ...getTaal("keherwa"), khali: [0] };
  const v = validateTaal(broken);
  assert.ok(!v.ok);
});

test("first taali must be the sam", () => {
  const broken = { ...getTaal("keherwa"), taali: [1] };
  const v = validateTaal(broken);
  assert.ok(!v.ok);
});
