# TaalTrainer

A local tabla-inspired rhythm practice tool with thirteen synthesized strokes, four practice loops, twelve call-and-response lessons and a notation recorder. It uses no audio samples, accounts, analytics or external runtime libraries.

## Run

Use Node 22 or newer for tests. Serve the project over HTTP; opening the HTML through a file URL is not supported because ES modules and AudioWorklets require an appropriate origin.

```sh
python3 -m http.server 8080
npm test
npm run test:coverage
```

Open http://localhost:8080. Sound starts after a user gesture. A supported browser must provide Web Audio and AudioWorklet, normally on localhost or HTTPS.

## What ships

- Thirteen keyboard strokes, including compound two-hand sounds and the tirakita roll, synthesized by three AudioWorklet families.
- Teentaal, Keherwa, Dadra and an explicitly labelled Ektaal-inspired adaptation; loop tempo ranges from 40 to 240 BPM.
- Twelve lessons with a four-beat count-in, a complete call, and a response window scaled to the entire phrase. Scoring uses a tempo-derived 55 to 140 ms tolerance.
- Recorder notation and replay at the tempo captured when recording started. Takes are bounded to five minutes or 2,048 strokes.
- Cancellable lesson/replay timers, stale-callback guards, retryable audio initialization and bounded numerical/allocation inputs.

## Architecture and verification

The js/engine modules hold pure data, clocks, scoring, notation, practice timelines and owned timers. The js/audio modules hold the audio graph, lookahead scheduler and sample-level synthesis. The js/app.js module owns the interface and transport state.

The offline suite has 154 tests, including native-worklet-shaped clock regressions, DSP, queued-voice preservation, long-loop scheduling, cancellation and all twelve practice timelines. Shared headless Chromium checks in the sibling reward pipeline execute the actual application, observe finite nonzero Web Audio signal, exercise a long response and recorder cancellation, and check phone/desktop overflow. See [ENGINEERING.md](ENGINEERING.md) for commands and limitations.

These are automated tests, not human listening or playtesting. The waveform observation is browser software evidence, not a measurement of speaker output or musical authenticity. The included thekas are practice adaptations; the twelve-beat Ektaal-inspired loop is not a canonical transcription. No teacher, partner, school or human testing network is claimed.

Tempo changes preserve mathematical phase but already queued audio inside the lookahead retains its old timing. Background delays skip missed beats instead of playing a backlog. Scores describe this deterministic matching algorithm, not musical proficiency.

## Authorship and release

This is AI-assisted software. No human work hours, contest eligibility, submission, deployment or reward are established by these files. A new contest can require entirely new work within its build window; this pre-existing project must not be represented as newly authored there.

MIT license. Copyright (c) 2026 Aariv Patel.
