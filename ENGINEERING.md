# Engineering evidence

Verification checkpoint 2026-11-04 in America/Chicago. Commands were executed locally; CI configuration is not evidence that remote CI ran.

```sh
npm test
npm run test:coverage
```

The offline suite passes 154 tests on Node 24.16.0. Its native-worklet-shaped VM intentionally provides a global clock without an instance clock, reproducing the browser API that the old stub missed. Tests also cover non-finite DSP messages, hard voice lifetime, queued lesson notes, timer ownership, skipped backlogs, looping past 64 cycles, phase math and allocation limits.

From the sibling ysws_and_rewards_pipeline directory:

```sh
npm ci --ignore-scripts
npm run test:browser
```

The browser suite uses installed Chromium/Chrome headlessly, with an empty context, muted output and blocked external network. It observes actual analyser samples from the loaded AudioWorklets and executes the interface. Long lesson tests advance a simulated browser clock; they are timing/control-flow tests, not a real-time musician study.

Browser support beyond this tested Chromium build, subjective timbre, touch hardware latency and canonical musical instruction are not verified. A passing suite is bounded evidence, not proof of defect-free software. Honesty/privacy release checks and independent review are recorded in the campaign pipeline, not claimed from CI alone.
