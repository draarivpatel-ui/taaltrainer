import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toleranceMs, verdictFor, gradeAttempt, scoreResponse, edges
} from "../js/engine/scoring.js";
import { getLesson } from "../js/engine/lessons.js";

test("tolerance clamps between 55 and 140 ms", () => {
  assert.equal(toleranceMs(40), 140, "slow tempo clamps at the max");
  assert.equal(toleranceMs(60), 140, "one second beats clamp at 140");
  assert.equal(toleranceMs(240), 75, "fast tempo gives 75ms");
  assert.equal(toleranceMs(180), 100);
  assert.equal(toleranceMs(120), 140);
  assert.equal(toleranceMs(150), 120);
});

test("verdict windows at a 100ms tolerance", () => {
  assert.equal(verdictFor(0, 100), "perfect");
  assert.equal(verdictFor(34, 100), "perfect");
  assert.equal(verdictFor(-36, 100), "good");
  assert.equal(verdictFor(99, 100), "good");
  assert.equal(verdictFor(-100, 100), "good");
  assert.equal(verdictFor(101, 100), "miss");
  assert.equal(verdictFor(-250, 100), "miss");
});

test("edges expose the exact boundaries the verdicts use", () => {
  const e = edges(100);
  assert.equal(e.inner, 35);
  assert.equal(verdictFor(e.inner, 100), "perfect");
  assert.equal(verdictFor(e.outer, 100), "good");
  assert.equal(verdictFor(e.outer + 1, 100), "miss");
});

test("a perfectly timed attempt scores 100", () => {
  const expected = [
    { index: 0, bolId: "na", timeMs: 0 },
    { index: 1, bolId: "ge", timeMs: 500 },
    { index: 2, bolId: "na", timeMs: 1000 }
  ];
  const attempt = [
    { bolId: "na", timeMs: 4 },
    { bolId: "ge", timeMs: 505 },
    { bolId: "na", timeMs: 995 }
  ];
  const s = gradeAttempt(expected, attempt, { toleranceMs: 140 });
  assert.equal(s.score, 100);
  assert.equal(s.perfect, 3);
  assert.equal(s.good, 0);
  assert.equal(s.wrong, 0);
  assert.equal(s.missed, 0);
});

test("an empty attempt scores zero with every expected missed", () => {
  const expected = [
    { index: 0, bolId: "na", timeMs: 0 },
    { index: 1, bolId: "ge", timeMs: 500 }
  ];
  const s = gradeAttempt(expected, [], { toleranceMs: 140 });
  assert.equal(s.score, 0);
  assert.equal(s.missed, 2);
});

test("wrong strokes are detected and scored, not silently ignored", () => {
  const expected = [{ index: 0, bolId: "na", timeMs: 0 }];
  const s = gradeAttempt(expected, [{ bolId: "ge", timeMs: 10 }], { toleranceMs: 140 });
  assert.equal(s.results[0].verdict, "wrongStroke");
  assert.equal(s.results[0].played, "ge");
  assert.equal(s.wrong, 1);
  assert.equal(s.score, 25);
});

test("good timing inside the outer window earns partial credit", () => {
  const expected = [{ index: 0, bolId: "na", timeMs: 0 }];
  const s = gradeAttempt(expected, [{ bolId: "na", timeMs: 100 }], { toleranceMs: 100 });
  assert.equal(s.results[0].verdict, "good");
  assert.equal(s.score, 60);
});

test("hits outside every window are extras", () => {
  const expected = [{ index: 0, bolId: "na", timeMs: 0 }];
  const s = gradeAttempt(
    expected,
    [
      { bolId: "na", timeMs: 5 },
      { bolId: "ke", timeMs: 900 },
      { bolId: "te", timeMs: 1400 }
    ],
    { toleranceMs: 140 }
  );
  assert.equal(s.perfect, 1);
  assert.equal(s.extras, 2);
  assert.equal(s.score, 100, "extras are reported but not punished");
});

test("each expected event consumes at most one attempt", () => {
  const expected = [
    { index: 0, bolId: "na", timeMs: 0 },
    { index: 1, bolId: "na", timeMs: 1000 }
  ];
  const s = gradeAttempt(expected, [{ bolId: "na", timeMs: 10 }], { toleranceMs: 140 });
  assert.equal(s.perfect, 1);
  assert.equal(s.missed, 1);
  assert.equal(s.extras, 0);
});

test("the nearest attempt wins the match", () => {
  const expected = [{ index: 0, bolId: "na", timeMs: 500 }];
  const s = gradeAttempt(
    expected,
    [
      { bolId: "na", timeMs: 400 },
      { bolId: "na", timeMs: 512 }
    ],
    { toleranceMs: 140 }
  );
  assert.equal(s.results[0].offsetMs, 12);
  assert.equal(s.perfect, 1);
  assert.equal(s.extras, 1);
});

test("early and late both count, sign is preserved", () => {
  const expected = [{ index: 0, bolId: "tin", timeMs: 0 }];
  const early = gradeAttempt(expected, [{ bolId: "tin", timeMs: -60 }], { toleranceMs: 140 });
  const late = gradeAttempt(expected, [{ bolId: "tin", timeMs: 60 }], { toleranceMs: 140 });
  assert.equal(early.results[0].offsetMs, -60);
  assert.equal(late.results[0].offsetMs, 60);
  assert.equal(early.results[0].verdict, "good");
  assert.equal(late.results[0].verdict, "good");
});

test("scoreResponse derives everything from a lesson", () => {
  const lesson = getLesson("l03");
  const attempt = lesson.phrase.map((bolId, i) => ({
    bolId,
    timeMs: Math.round(i * (60000 / lesson.bpm)) + 8
  }));
  const s = scoreResponse(lesson, attempt);
  assert.equal(s.score, 100);
  assert.equal(s.results.length, lesson.phrase.length);
});

test("scoreResponse catches a learner who plays the phrase shifted by a stroke", () => {
  const lesson = getLesson("l03");
  const beat = 60000 / lesson.bpm;
  const attempt = lesson.phrase.map((bolId, i) => ({ bolId, timeMs: Math.round(i * beat + beat) }));
  const s = scoreResponse(lesson, attempt);
  assert.ok(s.score < 100, "playing one beat late cannot be a perfect score");
  assert.ok(s.extras >= 1, "the trailing hit is an extra");
});

test("a full miss and a full wrong run both round to honest numbers", () => {
  const expected = [
    { index: 0, bolId: "na", timeMs: 0 },
    { index: 1, bolId: "ge", timeMs: 500 }
  ];
  const missed = gradeAttempt(expected, [{ bolId: "ke", timeMs: 5000 }], { toleranceMs: 140 });
  assert.equal(missed.score, 0);
  const wrongBoth = gradeAttempt(
    expected,
    [
      { bolId: "ge", timeMs: 0 },
      { bolId: "na", timeMs: 500 }
    ],
    { toleranceMs: 140 }
  );
  assert.equal(wrongBoth.wrong, 2);
  assert.equal(wrongBoth.score, 25);
});

test("tirakita rolls grade against a single expected event", () => {
  const lesson = getLesson("l06");
  const beat = 60000 / lesson.bpm;
  const attempt = lesson.phrase.map((bolId, i) => ({ bolId, timeMs: Math.round(i * beat) }));
  const s = scoreResponse(lesson, attempt);
  assert.equal(s.score, 100);
});
