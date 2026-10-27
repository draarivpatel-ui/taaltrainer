# TaalTrainer

TaalTrainer is a classical Indian rhythm percussion trainer for tabla that runs entirely in a single static web page. Thirteen bol strokes are synthesized live in the browser using Web Audio and three AudioWorklet processors, four taal practice loops keep time with a beat lamp stage, twelve progressive lessons teach through call and response, and a tap recorder writes your playing down as Devanagari bol notation on a beat grid.

## Features

1. **Bol Keyboard and Open Synthesis Rack:** Thirteen strokes (`na`, `ta`, `tin`, `tun`, `dha`, `dhin`, `ge`, `ke`, `te`, `ti`, `ra`, `kat`, and the `tirakita` roll), each with its Devanagari glyph, mapped across the home row (`A S D F G H J K L ; ' \` plus `Enter`). Ringing strokes sum five damped sine modes near a harmonic series, the bass hand adds a downward pitch glide and slap transient, and dry finger taps use shaped noise bursts through two short damped modes. All seven synthesis parameters (`Tune`, `Ring`, `Slap`, `Right hand level`, `Bass hand level`, `Taps level`, and `Room level`) sit in plain sight on sliders.
2. **Taal Player:** Four cyclic rhythm frameworks (`Teentaal` 16 beats, `Keherwa` 8 beats, `Dadra` 6 beats, and `Ektaal` 12 beats) with a beat lamp strip, sam highlighting on beat one, taali and khali indicators, Devanagari theka display, and a 40 to 240 BPM tempo slider with tabular numerals and live phase-preserving tempo adjustments.
3. **Learner Path with Call and Response:** Twelve sequential lessons progressing from single stroke isolation to a kaidah style variation on teentaal. From lesson three onward, the app plays a four-beat count-in followed by the target phrase, listens to your keyboard response, and grades every stroke with a tempo-scaled tolerance window (30 percent of a beat, clamped between 55 and 140 ms) that separates `perfect`, `good`, `wrong stroke`, and `missed` verdicts.
4. **Notation Recorder:** Captures live keyboard strokes, deduplicates mechanical double-tap jitter, quantizes hits onto a beat grid at the current tempo, renders Devanagari bol notation with middle-dot rests, and replays the captured take with synchronized column highlights.

## Architecture

- `index.html`, `css/tokens.css`, `css/style.css`: Semantic, accessible workbench layout with OKLCH stage tokens, tabular numeric readouts, and `prefers-reduced-motion` support.
- `js/engine/`: Pure, deterministic modules (`bol.js`, `taal.js`, `clock.js`, `lessons.js`, `scoring.js`, `timeline.js`).
- `js/audio/`: Web Audio graph (`engine.js`), lookahead rhythm scheduler (`scheduler.js`), and three sample-level modal synthesis processors (`tabla-worklets.js`).
- `js/app.js`: User interface bindings for keyboard, synthesis rack, taal loop transport, call-and-response grader, and notation recorder.
- `tests/`: Automated test suite running on Node's built-in test runner (`node --test`).

## Running Locally

Serve the directory with any static HTTP server (required for ES modules and AudioWorklet loading) or open `index.html`:

```bash
python3 -m http.server 8080
```

Run the offline test suite:

```bash
npm test
```

## Honest Scope and Limits

TaalTrainer is a self-contained browser practice tool, not a lineage or formal method. The thekas are practice lines adapted to the thirteen synthesized strokes for keeping time. Every sound is synthesized mathematically in the browser with zero audio samples, zero external dependencies, and zero network requests.

## License

MIT License. Copyright (c) 2026 Aariv Patel.
