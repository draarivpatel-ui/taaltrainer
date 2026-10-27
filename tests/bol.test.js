import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOLS, BOL_IDS, FAMILIES, getBol, bolForKey, bolsByFamily,
  resolveHits, KEY_CODES
} from "../js/engine/bol.js";

test("exactly thirteen bols ship", () => {
  assert.equal(BOLS.length, 13);
  assert.equal(BOL_IDS.length, 13);
  assert.equal(new Set(BOL_IDS).size, 13);
});

test("the named strokes are all present", () => {
  for (const id of ["na", "ta", "tin", "tun", "dha", "dhin", "ge", "ke", "te", "ti", "ra", "kat", "tirakita"]) {
    assert.ok(BOL_IDS.includes(id), id);
  }
});

test("every bol carries a Devanagari glyph", () => {
  for (const bol of BOLS) {
    assert.equal(typeof bol.devanagari, "string");
    assert.ok(bol.devanagari.length >= 1, `${bol.id} glyph`);
    assert.notEqual(bol.devanagari, bol.name, `${bol.id} glyph is not the latin name`);
  }
  assert.equal(new Set(BOLS.map((b) => b.devanagari)).size, 13);
});

test("every bol belongs to a real synthesis family", () => {
  for (const bol of BOLS) {
    assert.ok(FAMILIES.includes(bol.family), `${bol.id} family ${bol.family}`);
  }
  assert.deepEqual(FAMILIES, ["tonic", "bass", "transient"]);
});

test("each family actually has strokes", () => {
  for (const family of FAMILIES) {
    assert.ok(bolsByFamily(family).length >= 1, family);
  }
  assert.equal(bolsByFamily("bass").map((b) => b.id).sort().join(","), "ge,ke");
});

test("compound strokes resolve to two hands or a roll", () => {
  assert.deepEqual(resolveHits("dha", 2).map((h) => h.family).sort(), ["bass", "tonic"]);
  assert.deepEqual(resolveHits("dhin", 2).map((h) => h.family).sort(), ["bass", "tonic"]);
  const roll = resolveHits("tirakita", 0);
  assert.equal(roll.length, 4);
  // ti and ra are finger taps, the closing ta is the closed dayan stroke.
  assert.deepEqual(roll.map((h) => h.family), ["transient", "transient", "transient", "tonic"]);
  const spacing = roll.map((h) => h.when);
  assert.deepEqual(spacing, [0, 0.055, 0.11, 0.165]);
});

test("simple strokes resolve to exactly one hit carrying the bol params", () => {
  const hits = resolveHits("tin", 1.5, 0.8);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].family, "tonic");
  assert.equal(hits[0].when, 1.5);
  assert.equal(hits[0].params.gain, 0.8);
  assert.equal(hits[0].params.fundamental, 300);
  assert.ok(hits[0].params.openness > 0.5, "tin is open");
  assert.ok(hits[0].params.decay > 1, "tin rings past a second");
});

test("na is closed where tin is open, same pitch family", () => {
  const na = getBol("na");
  const tin = getBol("tin");
  assert.equal(na.params.fundamental, tin.params.fundamental);
  assert.ok(na.params.openness < 0.4);
  assert.ok(na.params.decay < 0.6);
});

test("ge rings long and ke stays dry", () => {
  const ge = getBol("ge");
  const ke = getBol("ke");
  assert.ok(ge.params.fundamental < 120, "ge is a bass tone");
  assert.ok(ge.params.decay > 0.5);
  assert.ok(ke.params.decay < 0.3);
  assert.ok(ke.params.noise > ge.params.noise);
});

test("key map is one to one and home row anchored", () => {
  const codes = BOLS.map((b) => b.code);
  assert.equal(new Set(codes).size, 13);
  const homeRow = new Set(codes.slice(0, 11));
  for (const code of ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote"]) {
    assert.ok(homeRow.has(code), `${code} on the home row`);
  }
  assert.deepEqual(KEY_CODES.slice(11), ["Backslash", "Enter"]);
});

test("key lookup round trips", () => {
  for (const bol of BOLS) {
    const found = bolForKey(bol.code);
    assert.ok(found, `${bol.code} resolves`);
    assert.equal(found.id, bol.id);
  }
  assert.equal(bolForKey("KeyZ"), null);
});

test("unknown ids resolve to null without throwing", () => {
  assert.equal(getBol("zzz"), null);
  assert.deepEqual(resolveHits("zzz", 0), []);
});

test("every bol has a one line gloss for the keyboard legend", () => {
  for (const bol of BOLS) {
    assert.equal(typeof bol.gloss, "string");
    assert.ok(bol.gloss.length > 10);
  }
});

test("synthesis params stay in sane ranges", () => {
  for (const bol of BOLS) {
    const p = bol.params;
    assert.ok(p.fundamental >= 80 && p.fundamental <= 1000, `${bol.id} fundamental ${p.fundamental}`);
    assert.ok(p.decay > 0 && p.decay <= 1.5, `${bol.id} decay`);
    assert.ok(p.openness >= 0 && p.openness <= 1, `${bol.id} openness`);
    assert.ok(p.noise >= 0 && p.noise <= 1, `${bol.id} noise`);
  }
});
