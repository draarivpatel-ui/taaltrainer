// Timing tolerant scoring for call and response in TaalTrainer.
// Pure functions. Expected events come from clock.phraseTimeline as
// milliseconds relative to the phrase start. Attempt events come from the
// recorder as milliseconds relative to the same origin (the app arms the
// recorder exactly when the phrase would begin, after the count in).

// Tolerance window in milliseconds, derived from the tempo so fast cycles
// stay fair. Clamped so it never feels slack at slow tempo nor impossible at
// fast tempo.
export function toleranceMs(bpm, { fraction = 0.3, min = 55, max = 140 } = {}) {
  const beat = 60000 / bpm;
  return Math.round(Math.min(max, Math.max(min, beat * fraction)));
}

// Verdict for one hit given its signed offset in milliseconds from the
// expected time. Negative is early, positive is late.
//   perfect, inside the tight inner window (35 percent of tolerance)
//   good,    inside the tolerance window
//   miss,    outside it
export function verdictFor(offsetMs, tol) {
  const abs = Math.abs(offsetMs);
  if (abs <= tol * 0.35) return "perfect";
  if (abs <= tol) return "good";
  return "miss";
}

// Grade one attempt against one expected phrase.
//
// expected: [{ index, bolId, timeMs }] in ms relative to phrase start.
// attempt:  [{ bolId, timeMs }] in ms relative to the same origin.
// options:  toleranceMs (required), or bpm to derive it.
//
// Each expected event claims the nearest unused attempt inside its tolerance
// window, expected order first. If that attempt is the right bol it grades on
// timing. If it is the wrong bol it counts as wrongStroke, which is how wrong
// stroke detection works. Attempts outside every window are extras.
export function gradeAttempt(expected, attempt, options = {}) {
  const tol = options.toleranceMs ?? (options.bpm ? toleranceMs(options.bpm) : toleranceMs(60));
  const used = new Set();
  const results = expected.map((exp) => {
    let best = null;
    let bestAbs = Infinity;
    for (const [i, hit] of attempt.entries()) {
      if (used.has(i)) continue;
      const abs = Math.abs(hit.timeMs - exp.timeMs);
      if (abs < bestAbs) {
        bestAbs = abs;
        best = { i, hit };
      }
    }
    if (best && bestAbs <= tol) {
      used.add(best.i);
      if (best.hit.bolId !== exp.bolId) {
        return { index: exp.index, bolId: exp.bolId, verdict: "wrongStroke", offsetMs: Math.round(best.hit.timeMs - exp.timeMs), played: best.hit.bolId };
      }
      return { index: exp.index, bolId: exp.bolId, verdict: verdictFor(best.hit.timeMs - exp.timeMs, tol), offsetMs: Math.round(best.hit.timeMs - exp.timeMs), played: best.hit.bolId };
    }
    return { index: exp.index, bolId: exp.bolId, verdict: "miss", offsetMs: null, played: null };
  });

  const extras = attempt
    .map((hit, i) => ({ ...hit, i }))
    .filter((h) => !used.has(h.i));

  return summarize(results, extras, tol);
}

function summarize(results, extras, tol) {
  const perfect = results.filter((r) => r.verdict === "perfect").length;
  const good = results.filter((r) => r.verdict === "good").length;
  const wrong = results.filter((r) => r.verdict === "wrongStroke").length;
  const missed = results.filter((r) => r.verdict === "miss").length;
  const total = results.length;
  // Perfect full credit, good 0.6, wrong stroke 0.25 for the right timing,
  // miss 0. Extras are reported but not penalized.
  const credit = perfect * 1 + good * 0.6 + wrong * 0.25;
  const score = total === 0 ? 0 : Math.round((credit / total) * 100);
  return { score, perfect, good, wrong, missed, extras: extras.length, toleranceMs: tol, results };
}

// Convenience wrapper used by the app. Attempt times may arrive relative to
// the armed moment rather than the phrase start; pass originShiftMs to align.
export function scoreResponse(lesson, attempt, options = {}) {
  const bpm = lesson.bpm;
  const tol = options.toleranceMs ?? toleranceMs(bpm);
  const expected = options.expected ?? lesson.phrase.map((bolId, index) => ({ index, bolId, timeMs: Math.round(index * (60000 / bpm)) }));
  return gradeAttempt(expected, attempt, { toleranceMs: tol });
}

// A boundary helper the tests exercise: the exact tolerance edges.
export function edges(tol) {
  return {
    inner: Math.round(tol * 0.35),
    outer: tol
  };
}
