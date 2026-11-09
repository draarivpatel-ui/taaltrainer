# Contributing to TaalTrainer

Thanks for your interest in TaalTrainer. This project is a self-contained
Hindustani classical tabla practice room and microtiming analyzer that
synthesizes thirteen bol strokes across three AudioWorklet processor families,
drives four cyclic taal loops, and transcribes phrases into Devanagari bol
notation.

## Ground rules

- Be respectful and constructive. This project follows the Contributor
  Covenant, found in `CODE_OF_CONDUCT.md`.
- Keep the project dependency free. No `node_modules`, build steps, or runtime
  libraries. Node builtins and the `node:test` runner are fine.
- Keep it offline. No audio samples, no network requests, no CDN assets, no
  analytics. All sound is synthesized.
- Respect the tradition. Taal structures, theka, and bol naming follow Hindustani
  classical convention. If you add or change a taal, cite the standard theka and
  its source.

## Development setup

Requirements:

- Node.js 22 or newer, required for the test suite
- A modern browser with AudioWorklet support for manual verification
- Serve over HTTP, since ES modules and AudioWorklet processors load under a
  standard origin

```sh
git clone https://github.com/draarivpatel-ui/taaltrainer.git
cd taaltrainer
node --test
```

To open the practice room locally:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

## How the code is organised

| Path | Role |
| --- | --- |
| `js/audio/engine.js` | The TablaEngine: voice construction and stroke sample synthesis |
| `js/audio/scheduler.js` | The TaalScheduler: cyclic loop timing and matra advance |
| `js/audio/worklets/` | The three AudioWorklet processor families |
| `js/engine/` | Taal definitions, bol tables, lesson content, scoring, and timeline maths |
| `js/app.js` | UI wiring: bol keyboard, taal player, lessons, and recorder |
| `index.html`, `css/` | The practice room shell and its styling |
| `tests/` | The test suite |

The project is an ES module package, so use `import` and `export` in `js/`.
The test suite fakes only the browser objects (`document`, `AudioContext`, and
the worklet node interfaces) and exercises the real engines, scheduler, and taal
definitions. Preserve that split so tests stay meaningful.

## Coding standards

- Use 2-space indentation and double quotes, matching the surrounding file.
- Prefer `const`, and use `let` only when reassignment is required.
- Keep functions small and single purpose. Name them after what they do.
- No comments that restate the code. Comment the reason, the musical or
  musical-notation reference, or the non-obvious trade-off.
- Treat em-dashes and en-dashes as a defect in prose and identifiers. Use
  commas, parentheses, or a plain hyphen instead.
- Never swallow errors silently. Fail loudly with an actionable message.
- Keep timing maths free of wall-clock reads. Pass the time in so scheduling
  stays testable and reproducible.

## Adding a taal, a bol, or a lesson

Add a test that pins the taal's matra count, vibhag boundaries, and theka
string against the convention you are following. For a bol, add a test that the
synthesizer resolves it and that the scheduler places it on the expected matra.

## Opening a pull request

1. Fork the repository and create a branch from `main`.
2. Make your change with tests. Every bug fix should include a regression test
  that fails before your fix.
3. Run the full suite locally: `node --test`.
4. Update documentation where a taal, bol, lesson, or default changed.
5. Open the PR against `main` with:
   - a short summary of what changed and why,
   - the commands you ran and their result,
   - screenshots for UI changes,
   - the musical source you followed.
6. Keep the PR small enough to review in one sitting, and respond to review
   promptly.

Commit messages: use a short imperative subject line under 72 characters. Put
the reasoning in the body, not the subject.

## Reporting bugs

Open an issue with the smallest reproduction you can manage: the taal, bol, or
lesson, the steps you ran, what you expected, and what happened instead. Include
your browser and version when the problem is audio related. Security issues
follow `SECURITY.md` instead.
