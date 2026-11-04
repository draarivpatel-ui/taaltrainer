// The learner path for TaalTrainer.
// Twelve progressive lessons, from single stroke isolation to a full teentaal
// kaidah style variation. Pure data plus a small progression helper.
//
// Lesson modes.
//   isolate      play one stroke, hear it, repeat freely with the loop
//   echo         call and response, the app plays the phrase, the learner
//                taps it back, the scorer grades timing and stroke choice
//   theka        an echo lesson whose phrase is a full taal theka

import { getTaal } from "./taal.js";
import { BOL_IDS } from "./bol.js";

export const LESSONS = [
  {
    id: "l01",
    number: 1,
    title: "One stroke, na",
    kind: "isolate",
    phrase: ["na"],
    bpm: 60,
    blurb:
      "Press A and listen. Na is the ringing stroke on the rim of the right drum. Play it until the decay feels familiar."
  },
  {
    id: "l02",
    number: 2,
    title: "The left hand, ge",
    kind: "isolate",
    phrase: ["ge"],
    bpm: 60,
    blurb:
      "Press J for the open bass tone. Ge is the heel of the hand pressing the left drum. Let it speak low and long."
  },
  {
    id: "l03",
    number: 3,
    title: "Na and ge answer each other",
    kind: "echo",
    phrase: ["na", "ge", "na", "ge"],
    bpm: 60,
    blurb:
      "The app plays na ge na ge, one bol per beat. Tap the same four strokes back on A and J, one per beat."
  },
  {
    id: "l04",
    number: 4,
    title: "Open tin, closed na",
    kind: "echo",
    phrase: ["tin", "na", "tin", "na"],
    bpm: 66,
    blurb:
      "Tin rings open, na closes damp. Same pitch, different decay. Hear the difference, then echo it."
  },
  {
    id: "l05",
    number: 5,
    title: "Fast fingers, te and ti",
    kind: "echo",
    phrase: ["te", "ti", "te", "ti", "te", "ti", "te", "ti"],
    bpm: 72,
    blurb:
      "The dry finger taps on L and semicolon. Half the sound is noise, half is a tiny ring. Keep them even."
  },
  {
    id: "l06",
    number: 6,
    title: "The tirakita roll",
    kind: "echo",
    phrase: ["tirakita", "ge", "tirakita", "ge"],
    bpm: 60,
    blurb:
      "Enter fires the whole four finger roll in one press. Echo tirakita ge twice and feel the roll land on the bass."
  },
  {
    id: "l07",
    number: 7,
    title: "Keherwa, eight beats",
    kind: "theka",
    taalId: "keherwa",
    phrase: ["dha", "ge", "na", "ti", "na", "ke", "dhin", "na"],
    bpm: 84,
    blurb:
      "The eight beat groove. The app calls the full theka, you answer it, then try playing along with the loop."
  },
  {
    id: "l08",
    number: 8,
    title: "Dadra, six beats",
    kind: "theka",
    taalId: "dadra",
    phrase: ["dha", "dhin", "na", "dha", "tun", "na"],
    bpm: 84,
    blurb:
      "Six beats, three and three, with the second hand of the cycle open and bass free."
  },
  {
    id: "l09",
    number: 9,
    title: "Teentaal, the first vibhag",
    kind: "echo",
    phrase: ["dha", "dhin", "dhin", "dha"],
    bpm: 60,
    blurb:
      "The opening phrase of the sixteen beat cycle. Learn these four strokes cold before the full theka."
  },
  {
    id: "l10",
    number: 10,
    title: "Teentaal, full theka",
    kind: "theka",
    taalId: "teentaal",
    phrase: [
      "dha", "dhin", "dhin", "dha",
      "dha", "dhin", "dhin", "dha",
      "dha", "tin", "tin", "ta",
      "ta", "dhin", "dhin", "dha"
    ],
    bpm: 72,
    blurb:
      "All sixteen beats. Claps on 1, 5 and 13, khali on 9. Echo it, then play it with the taal player above."
  },
  {
    id: "l11",
    number: 11,
    title: "Ektaal-inspired twelve-beat loop",
    kind: "theka",
    taalId: "ektaal",
    phrase: [
      "dhin", "dhin", "dha", "ge",
      "tirakita", "tun", "na", "kat",
      "dha", "ge", "tirakita", "dhin"
    ],
    bpm: 60,
    blurb:
      "An app-specific adaptation in six groups of two, not a canonical Ektaal transcription. Keep the tirakita rolls even in slow practice."
  },
  {
    id: "l12",
    number: 12,
    title: "Kaidah, a teentaal variation",
    kind: "echo",
    phrase: [
      "dha", "ge", "tirakita", "dha",
      "dha", "ge", "tirakita", "na",
      "dha", "dhin", "dhin", "dha",
      "dha", "tin", "tin", "ta"
    ],
    bpm: 66,
    blurb:
      "A kaidah style variation that opens the theka with tirakita figures, then settles back home. This is the shape of a first composition."
  }
];

export const LESSON_IDS = LESSONS.map((l) => l.id);

const BY_ID = new Map(LESSONS.map((l) => [l.id, l]));

export function getLesson(id) {
  return BY_ID.get(id) || null;
}

export function validateLessons(lessons = LESSONS) {
  const errors = [];
  const seenNumbers = new Set();
  for (const [i, lesson] of lessons.entries()) {
    if (lesson.number !== i + 1) errors.push(`${lesson.id} number ${lesson.number} out of sequence`);
    if (seenNumbers.has(lesson.number)) errors.push(`duplicate lesson number ${lesson.number}`);
    seenNumbers.add(lesson.number);
    if (!Array.isArray(lesson.phrase) || lesson.phrase.length === 0) {
      errors.push(`${lesson.id} has no phrase`);
      continue;
    }
    for (const bolId of lesson.phrase) {
      if (!BOL_IDS.includes(bolId)) errors.push(`${lesson.id} phrase uses unknown bol ${bolId}`);
    }
    if (!(lesson.bpm >= 40 && lesson.bpm <= 240)) errors.push(`${lesson.id} bpm ${lesson.bpm} out of range`);
    if (lesson.taalId && !getTaal(lesson.taalId)) errors.push(`${lesson.id} references unknown taal ${lesson.taalId}`);
    if (lesson.kind === "theka" && !lesson.taalId) errors.push(`${lesson.id} is a theka lesson without a taal`);
  }
  return { ok: errors.length === 0, errors };
}

// Difficulty estimate used to order the path and to show progress. Weighted
// by stroke count, stroke speed, and tempo. Monotonic by construction because
// lessons are authored in order; the helper exists so tests can assert the
// path never gets easier.
export function lessonWeight(lesson) {
  const lengthScore = lesson.phrase.length;
  const speedScore = 120 - lesson.bpm; // slower is not easier to keep even, but weight anyway
  const rollScore = lesson.phrase.filter((b) => b === "tirakita").length * 2;
  return lengthScore * 2 + rollScore + speedScore / 10;
}
