# TaalTrainer

A self-contained Hindustani classical tabla practice room and microtiming analyzer in the browser. It synthesizes thirteen bol strokes in real time across three AudioWorklet processor families, drives four cyclic taal loops with a live SVG avartan wheel, guides learners through twelve call-and-response lessons with millisecond timing feedback, and transcribes free-hand phrases into Devanagari bol notation. Zero audio samples, zero external runtime dependencies, and zero network requests.

## Run

Use Node 22 or newer for the automated test suite. Serve the repository over HTTP so ES modules and AudioWorklet processors load under a standard origin:

```sh
python3 -m http.server 8080
npm test
npm run test:coverage
```

Open `http://localhost:8080`. Sound begins only after an explicit user gesture.

## What ships

- **Thirteen synthesized bol strokes** across three AudioWorklet families (`tonic` dayan five-mode harmonic resonator, `bass` bayan membrane with pitch-glide envelope, and `transient` shaped-noise finger taps), including compound two-hand strokes (`dha`, `dhin`) and the four-hit `tirakita` roll (`55 ms` sub-hit spacing).
- **Four cyclic taal practice loops**: Teentaal (`16` matras, `4+4+4+4`), Keherwa (`8` matras, `4+4`), Dadra (`6` matras, `3+3`), and an explicitly labeled `12`-matra Ektaal-inspired practice adaptation (`2+2+2+2+2+2`), with continuous laya control from `40` to `240` BPM.
- **Concentric SVG avartan wheel and dual Devanagari/Roman theka strip**: marks every matra, vibhag boundary, taali clap, khali wave, and the vermilion beat-one `sam` anchor.
- **Twelve graded call-and-response lessons**: four-beat count-in, full call playback, and a phrase-scaled response window scored against a tempo-derived `55` to `140` ms tolerance window (`perfect`, `good`, `wrongStroke`, and `miss` verdicts).
- **Bandish notation recorder**: captures free-hand strokes with `18 ms` mechanical bounce deduplication, quantizes hits onto a matra ledger in Devanagari notation, and replays takes at the captured BPM.

## Architecture and verification

- `js/engine/` contains pure data and pure functions: bol definitions and compound hit resolution (`bol.js`), taal cycle math and structural validators (`taal.js`), sample-accurate clock helpers (`clock.js`), nearest-window response grading (`scoring.js`), practice timelines (`practice.js`), notation column quantization (`timeline.js`), twelve graded lessons (`lessons.js`), and owned timer groups (`timers.js`).
- `js/audio/` contains the three AudioWorklet modal synthesis processors (`worklet.js`), the main-thread Web Audio graph (`engine.js`), the lookahead taal scheduler (`scheduler.js`), and the take replay scheduler (`replay.js`).
- `js/app.js`, `css/tokens.css`, `css/style.css`, and `index.html` implement the Hindustani classical studio interface.

`npm test` runs `162` automated `node:test` cases across `11` test files, verifying native-worklet-shaped global clock behavior, modal DSP output, voice lifetime caps, 64+ cycle scheduling, phase-preserving tempo changes, timer ownership and cancellation, all twelve practice timelines, scoring tolerances, and DOM/CSS hygiene.

MIT license. Copyright (c) 2026 Aariv Patel.
