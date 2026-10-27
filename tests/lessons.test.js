import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LESSONS, LESSON_IDS, getLesson, validateLessons, lessonWeight
} from "../js/engine/lessons.js";
import { BOL_IDS } from "../js/engine/bol.js";
import { getTaal, TAAL_IDS } from "../js/engine/taal.js";
import { toleranceMs } from "../js/engine/scoring.js";

test("twelve lessons ship in a numbered path", () => {
  assert.equal(LESSONS.length, 12);
  assert.equal(LESSON_IDS.length, 12);
  LESSONS.forEach((lesson, i) => {
    assert.equal(lesson.number, i + 1, `${lesson.id} is lesson ${i + 1}`);
  });
});

test("lesson ids are unique and sequential", () => {
  assert.equal(new Set(LESSON_IDS).size, 12);
  assert.deepEqual(LESSON_IDS, [
    "l01", "l02", "l03", "l04", "l05", "l06",
    "l07", "l08", "l09", "l10", "l11", "l12"
  ]);
});

test("every lesson phrase uses only real bols", () => {
  for (const lesson of LESSONS) {
    for (const bolId of lesson.phrase) {
      assert.ok(BOL_IDS.includes(bolId), `${lesson.id} uses ${bolId}`);
    }
  }
});

test("lesson phrases never shrink to nothing", () => {
  for (const lesson of LESSONS) {
    assert.ok(lesson.phrase.length >= 1, lesson.id);
  }
  assert.equal(LESSONS[0].phrase.length, 1, "lesson one is one stroke");
  assert.equal(LESSONS[9].phrase.length, 16, "the full teentaal lesson is sixteen strokes");
});

test("tempos stay inside the slider range", () => {
  for (const lesson of LESSONS) {
    assert.ok(lesson.bpm >= 40 && lesson.bpm <= 240, `${lesson.id} bpm ${lesson.bpm}`);
  }
});

test("tolerance windows are playable at every lesson tempo", () => {
  for (const lesson of LESSONS) {
    const tol = toleranceMs(lesson.bpm);
    assert.ok(tol >= 55 && tol <= 140, `${lesson.id} tolerance ${tol}`);
    const beat = 60000 / lesson.bpm;
    assert.ok(tol < beat * 0.6, `${lesson.id} tolerance must stay well under a beat`);
  }
});

test("theka lessons reference real taals", () => {
  const thekaLessons = LESSONS.filter((l) => l.kind === "theka");
  assert.equal(thekaLessons.length, 4);
  for (const lesson of thekaLessons) {
    const taal = getTaal(lesson.taalId);
    assert.ok(taal, lesson.taalId);
    assert.deepEqual(lesson.phrase, taal.theka, `${lesson.id} echoes the full theka`);
  }
  for (const lesson of LESSONS) {
    if (lesson.taalId) assert.ok(TAAL_IDS.includes(lesson.taalId));
  }
});

test("the path opens with isolation and ends with composition", () => {
  assert.equal(LESSONS[0].kind, "isolate");
  assert.equal(LESSONS[0].phrase[0], "na");
  assert.equal(LESSONS[1].phrase[0], "ge");
  assert.equal(LESSONS[11].title.includes("Kaidah"), true);
  assert.ok(LESSONS[11].phrase.length === 16);
});

test("echo lessons exist for call and response", () => {
  const echo = LESSONS.filter((l) => l.kind === "echo");
  assert.ok(echo.length >= 4, "most of the path is call and response");
  for (const lesson of echo) {
    assert.ok(lesson.blurb.length > 40, lesson.id);
  }
});

test("every lesson has learner facing copy without dashes", () => {
  for (const lesson of LESSONS) {
    assert.equal(typeof lesson.title, "string");
    assert.ok(lesson.title.length > 3);
    assert.ok(lesson.blurb.length > 40, `${lesson.id} blurb has substance`);
    assert.ok(!lesson.blurb.includes("\u2014"), `${lesson.id} blurb has no em dash`);
    assert.ok(!lesson.blurb.includes("\u2013"), `${lesson.id} blurb has no en dash`);
    assert.ok(!lesson.title.includes("\u2014"));
  }
});

test("lesson weight is positive everywhere", () => {
  for (const lesson of LESSONS) {
    const w = lessonWeight(lesson);
    assert.ok(Number.isFinite(w) && w > 0, `${lesson.id} weight ${w}`);
  }
});

test("getLesson returns null for unknown ids", () => {
  assert.equal(getLesson("nope"), null);
  assert.equal(getLesson("l01").number, 1);
});

test("the whole path validates clean", () => {
  const v = validateLessons();
  assert.deepEqual(v.errors, []);
  assert.ok(v.ok);
});

test("validateLessons catches a phrase with a fake bol", () => {
  const broken = [{ ...LESSONS[0], id: "x1", number: 1, phrase: ["zzz"] }];
  const v = validateLessons(broken);
  assert.ok(!v.ok);
  assert.ok(v.errors[0].includes("zzz"));
});
