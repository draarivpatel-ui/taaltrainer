# TaalTrainer engineering notes

The earlier baseline called this an IceHacks pre-build. That label does not prove eligibility, an opening date or organizer permission to reuse pre-existing work. No contest or account was changed in this upgrade.

The current implementation fixes the browser worklet clock, indefinite-loop scheduling, owned timer cancellation, stale animation callbacks, async lesson/loop/replay races, long response windows, invalid numerical inputs, and the CSS hidden-state override. Recorder tempo is captured per take; recordings and scoring events are bounded.

The offline suite was run on Node 24.16.0 and passes 154 tests. The shared headless browser suite exercises actual Chromium and Web Audio with an empty profile and muted output. No human listened or tested the instrument. No lineage or standard repertoire claim is made; the Ektaal-inspired adaptation is explicitly labelled.

Earlier numeric test totals and runtime versions were baseline notes, not evidence for this release. Git history preserves that baseline. [ENGINEERING.md](ENGINEERING.md) records reproducible commands and evidence boundaries.
