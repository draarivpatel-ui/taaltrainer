# TaalTrainer | IceHacks

## Project name
TaalTrainer

## Elevator pitch
Learn to keep taal on a physical-modeling tabla in your browser: 13 bol strokes synthesized live with Web Audio worklets, 4 cyclic taal loops, 12 call-and-response lessons, and a Devanagari notation recorder.

## Track
General / Education & Music Tools

## Story / Description

### Inspiration
Practicing Indian classical rhythm (taal) between sessions requires keeping steady cyclic time (theka) while speaking and playing distinct drum syllables (bols). Most browser rhythm tools rely on large sample libraries or basic metronome clicks that cannot distinguish an open ringing *tin* from a closed *na* or a pitch-gliding bass *ge*. TaalTrainer brings a self-contained tabla practice room into a single static web page with zero audio samples and zero network requests.

### What it does
1. **Bol Keyboard and Open Synthesis Rack:** Maps thirteen bol strokes (`na`, `ta`, `tin`, `tun`, `dha`, `dhin`, `ge`, `ke`, `te`, `ti`, `ra`, `kat`, and the four-hit `tirakita` roll) to the home row with Devanagari glyphs. Seven sliders expose every synthesis parameter in plain sight: `Tune` (-6 to +6 semitones), `Ring` decay multiplier, `Slap` transient balance, and individual gain levels for the right hand, bass hand, dry taps, and room output.
2. **Taal Player:** Loops four rhythmic cycles (`Teentaal` 16 beats, `Keherwa` 8 beats, `Dadra` 6 beats, and `Ektaal` 12 beats) from 40 to 240 BPM. A lookahead scheduler books strokes with sample-accurate Web Audio timing while a footlight lamp row highlights the *sam* (beat 1), *taali* (clap beats), and *khali* (wave beats) alongside live Devanagari theka tracking.
3. **Learner Path with Call and Response:** Twelve sequential lessons progress from single-stroke isolation to a kaidah style variation on Teentaal. After a four-beat count-in, the app plays the call phrase, opens a response window, and grades each stroke you tap using a tempo-scaled tolerance window (30 percent of a beat, clamped between 55 and 140 ms) that distinguishes `perfect`, `good`, `wrong stroke`, and `missed` hits.
4. **Notation Recorder:** Captures live keyboard takes, filters mechanical double-tap bounce, quantizes hits onto a beat grid at the active tempo, renders Devanagari bol notation with middle-dot rests, and replays the captured phrase with synchronized column highlights.

### How it was built
- **Modal Synthesis in AudioWorklets (`js/audio/tabla-worklets.js`):** Three dedicated `AudioWorkletProcessor` classes (`taal-tonic`, `taal-bass`, and `taal-transient`) synthesize every stroke from math. Ringing dayan strokes sum five damped sine modes near harmonic ratios pulled by the syahi load, with an openness parameter controlling upper-mode survival. Bass bayan strokes add a downward pitch-glide envelope and slap noise burst. Dry finger strokes filter shaped noise through two short damped modes.
- **Deterministic Rhythm Engine (`js/engine/`):** Pure ES modules handle bol resolution, taal cycle structure validation, windowed lookahead scheduling, call-and-response tolerance math, and timeline quantization.
- **Zero-Dependency Workbench UI (`index.html`, `css/`, `js/app.js`):** Styled with OKLCH stage tokens, tabular numerals on all readouts, full keyboard operability, screen-reader live regions, and `prefers-reduced-motion` support. Verified by 122 automated tests running on `node:test`.

### Honest scope and limits
TaalTrainer is a self-contained practice tool, not a lineage or formal conservatory method. The thekas in the taal player are practice lines adapted to the thirteen synthesized strokes for keeping time. All sounds are synthesized locally in the browser; no audio files are loaded and no user data leaves the page.

## Built with
- HTML5
- CSS3 (OKLCH design tokens, CSS Grid, tabular-nums)
- Vanilla JavaScript (ES Modules)
- Web Audio API & AudioWorklet (real-time modal drum synthesis)
- Node.js built-in test runner (`node:test`)

## Try it out
- Live Demo: https://aariv.me/taaltrainer/
- GitHub Repository: https://github.com/draarivpatel-ui/taaltrainer
