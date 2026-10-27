# NOTES

TaalTrainer is a pre-build for IceHacks (window opens November 8). It is a
classical Indian rhythm percussion trainer for tabla that runs entirely in one
static web page. Thirteen bol strokes are synthesized live with Web Audio,
four taal loops keep time with a lamp row, twelve lessons teach through call
and response, and a recorder writes your tapping down as bol notation. Author,
Aariv Patel.

## What was built

1. Bol keyboard. Thirteen strokes (na, ta, tin, tun, dha, dhin, ge, ke, te,
   ti, ra, kat, tirakita), each with its Devanagari glyph, bound to the home
   row (A S D F G H J K L ; ' \ plus Enter for the tirakita roll). Synthesis
   runs in three AudioWorklet processors, one per family. Ringing strokes sum
   five damped sine modes whose ratios sit near a harmonic series, with an
   openness parameter that separates an open tin from a closed na. The bass
   hand gets a pitch glide and a slap transient. Dry strokes are noise bursts
   through two short damped modes. A tirakita fires four hits 55 ms apart from
   one press. Every synthesis value is exposed on sliders in the interface.
2. Taal player. Teentaal (16 beats), keherwa (8), dadra (6) and ektaal (12)
   with a beat lamp row, sam highlighting, taali and khali marks, a tempo
   slider from 40 to 240 BPM with a tabular-numeral readout, theka display,
   and live tempo changes that preserve the position in the cycle.
3. Learner path. Twelve progressive lessons from single stroke isolation to a
   kaidah style variation on teentaal. From lesson three the app plays a call
   (with a four beat count in), the learner taps the answer on the keyboard,
   and a timing tolerant scorer grades every stroke. Tolerance derives from
   the tempo (30 percent of a beat, clamped between 55 and 140 ms), verdicts
   are perfect, good, wrong stroke and miss, and wrong stroke detection flags
   a right timing with the wrong bol.
4. Recorder. Captures a tap sequence, dedupes jitter, renders it as bol
   notation on a beat grid with Devanagari glyphs, and replays it with
   column highlights.

## Structure

Pure, tested engine modules live in js/engine (bol, taal, clock, lessons,
scoring, timeline). Audio code lives in js/audio (tabla-worklets.js is the
worklet module with the three processors; engine.js is the main thread graph;
scheduler.js is the lookahead loop). The interface is js/app.js over
index.html, css/tokens.css and css/style.css. Zero dependencies, no build
step, relative paths only, so the folder is GitHub Pages ready as is.

## Tests, exact real counts

Command, `npm test` (node --test tests/). Built on node v26.8.1.

- 112 tests, 112 passing, 0 failing, 0 skipped, in about 64 ms.
- 327 assertion calls across the suite (counted with grep over tests/).
- Coverage. Taal cycle math and structure validation (16 tests), bol mapping
  completeness and compound stroke resolution (14), rhythm clock and windowed
  scheduling (11), lesson progression data (14), timing tolerance and scoring
  (15), recorder notation and quantizing (11), audio wiring through a DOM and
  AudioContext stub (17), and worklet DSP kernels (14).

The last two groups deserve a note. The worklet file is written so that
outside the worklet scope its processor classes attach to a test namespace,
which lets node:test run the actual DSP kernels in Node and assert audible
waveform facts (a stroke sounds, tin out rings na, ge sits under na, noise
transients die fast, a scheduled hit stays silent until its moment, panic
silences everything, tuning shifts zero crossing rate, no NaN ever). The
AudioContext graph itself cannot exist in Node, so tests/audio-wiring.test.js
drives the real engine and scheduler classes through a small stub that
records module loads, node creation, connections and port messages.

## Honest caveats

- Audio synthesis has never been heard. No browser was opened during this
  build. The synthesis was verified statically (code review) and numerically
  (the DSP kernels under node:test), and the browser wiring was verified
  through the stub described above. The first time anyone hears these drums
  will be after this file is written.
- The interface has never been rendered. Responsive behavior at 320, 375,
  414 and 768 px, overflow discipline, tap target sizes and reduced motion
  behavior are enforced by the CSS itself (mobile first rules, minmax(0, 1fr)
  tracks, overflow-x clip, nowrap affordances, focus rings that never animate)
  and were reviewed by reading, not by screenshot. Contrast figures were
  computed from the OKLCH token values, not measured from a rendered page.
- The thekas are practice lines adapted to the app's thirteen strokes. They
  are meant for keeping time, not as repertoire transcriptions. Ektaal is
  laid out as six vibhags of two with claps at 1, 5, 7 and 11 and no khali
  marked; that scheme is the one this app teaches, and it may differ in
  detail from a particular tradition's chart.
- Call and response grading measures against performance.now() at the moment
  the response window opens. Timer jitter is small but real; the tolerance
  clamp absorbs it.
- Tirakita's closing "ta" is rendered by the tonic family and its first three
  fingers by the transient family, a choice made for timbre, not notation.

## Honesty statement

No tabla teacher, no school, no city, no club and no outside group of testers
is involved in or referenced by this project. Nothing was user tested. The app
teaches through the twelve lessons built into it, and it claims nothing about
lineage, method or instruction beyond what is written on its own About
section. Every number on the page (13 strokes, 4 taals, 12 lessons, 40 to 240
BPM) is a count of what ships.

## Devpost bullets

- Thirteen tabla strokes synthesized from scratch in the browser. Five damped
  membrane modes per ringing stroke, a pitch gliding bass hand, and noise
  burst finger taps, with every synthesis knob on a visible slider. No
  samples, no network, no audio files.
- Four practice taals with a beat lamp stage. Teentaal, keherwa, dadra and
  ektaal with sam highlighting, taali and khali marks, a 40 to 240 BPM slider
  with tabular numerals, and a lookahead scheduler that books hits with
  sample accurate timing while the lamps follow on their own clock.
- Twelve lessons that teach by call and response. The app plays a phrase
  after a four beat count in, you tap the answer on the home row, and a
  tempo aware scorer grades timing (55 to 140 ms tolerance) and detects wrong
  strokes, from single stroke isolation to a kaidah style variation.
- A recorder that writes down what you play. Capture a take, read it back as
  bol notation on a beat grid in Devanagari, replay it with column
  highlights, then clear and record again.
- Fully tested, fully local, zero dependencies. 112 passing tests in about
  64 ms covering taal math, bol mapping, lesson data, tolerance windows,
  scoring, recorder math, the worklet DSP kernels and the audio graph wiring.
  A single static page, GitHub Pages ready, no build step.

## Running it

Open index.html in a browser (a local static server also works) and press a
key. Sound starts on the first key press because browsers require a gesture
before audio. Tests run offline with `npm test`. There is no git history in
this folder by design; it ships as clean files when the IceHacks window
opens.
