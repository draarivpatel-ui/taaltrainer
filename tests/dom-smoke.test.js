import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOLS, getBol } from '../js/engine/bol.js';
import { TAALS, getTaal } from '../js/engine/taal.js';
import { LESSONS, getLesson } from '../js/engine/lessons.js';
import { scoreResponse } from '../js/engine/scoring.js';
import { buildColumns, notationDevanagari, replaySchedule, dedupeEvents } from '../js/engine/timeline.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const TOKENS_CSS = fs.readFileSync(path.join(ROOT, 'css', 'tokens.css'), 'utf8');
const STYLE_CSS = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
const APP_JS = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
const README_MD = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const NOTES_MD = fs.readFileSync(path.join(ROOT, 'NOTES.md'), 'utf8');

test('DOM shell: doctype, html lang, charset, viewport, and title', () => {
  assert.match(HTML, /^<!doctype html>/i);
  assert.match(HTML, /<html lang="en">/);
  assert.match(HTML, /<meta charset="utf-8">/i);
  assert.match(HTML, /<meta name="viewport"/);
  assert.match(HTML, /<title>TaalTrainer, a tabla practice room in your browser<\/title>/);
});

test('DOM shell: OpenGraph and Twitter card metadata are complete', () => {
  assert.match(HTML, /property="og:title"/);
  assert.match(HTML, /property="og:description"/);
  assert.match(HTML, /property="og:type" content="website"/);
  assert.match(HTML, /name="twitter:card" content="summary"/);
});

test('DOM shell: skip link, live status region, and noscript fallback exist', () => {
  assert.match(HTML, /<a class="skip-link" href="#main">/);
  assert.ok(HTML.includes('id="sr-status"'));
  assert.match(HTML, /<noscript>/);
});

test('DOM shell: Bol keyboard and all seven synthesis rack sliders exist', () => {
  assert.ok(HTML.includes('id="keyboard"'));
  assert.ok(HTML.includes('id="bol-keys"'));
  ['ctl-tune', 'ctl-ring', 'ctl-slap', 'ctl-tonic', 'ctl-bass', 'ctl-transient', 'ctl-master'].forEach((id) => {
    assert.ok(HTML.includes('id="' + id + '"'), 'Missing slider ' + id);
  });
});

test('DOM shell: Taal player loop controls, lamps, and beat readouts exist', () => {
  assert.ok(HTML.includes('id="taal"'));
  assert.ok(HTML.includes('id="taal-choices"'));
  assert.ok(HTML.includes('id="btn-play"'));
  assert.ok(HTML.includes('id="ctl-bpm"'));
  assert.ok(HTML.includes('id="out-bpm"'));
  assert.ok(HTML.includes('id="beat-lamps"'));
  assert.ok(HTML.includes('id="theka-line"'));
  assert.ok(HTML.includes('id="out-beat"'));
  assert.ok(HTML.includes('id="out-beats"'));
});

test('DOM shell: Learner path call-and-response controls and score readout exist', () => {
  assert.ok(HTML.includes('id="lessons"'));
  assert.ok(HTML.includes('id="lesson-list"'));
  assert.ok(HTML.includes('id="lesson-stage"'));
  assert.ok(HTML.includes('id="phrase-line"'));
  assert.ok(HTML.includes('id="btn-call"'));
  assert.ok(HTML.includes('id="btn-grade"'));
  assert.ok(HTML.includes('id="btn-again"'));
  assert.ok(HTML.includes('id="lesson-status"'));
  assert.ok(HTML.includes('id="verdict-row"'));
  assert.ok(HTML.includes('id="out-score"'));
});

test('DOM shell: Recorder controls and notation strip exist', () => {
  assert.ok(HTML.includes('id="recorder"'));
  assert.ok(HTML.includes('id="btn-record"'));
  assert.ok(HTML.includes('id="btn-recplay"'));
  assert.ok(HTML.includes('id="btn-recclear"'));
  assert.ok(HTML.includes('id="notation-strip"'));
  assert.ok(HTML.includes('id="notation-cells"'));
});

test('DOM shell: all DOM IDs and aria/for references in index.html and js/app.js resolve cleanly', () => {
  const htmlIds = new Set([...HTML.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const lookedUpIds = [...APP_JS.matchAll(/\$\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1]);
  assert.ok(lookedUpIds.length >= 25);
  for (const id of lookedUpIds) {
    assert.ok(htmlIds.has(id), `ID #${id} looked up in js/app.js is missing from index.html`);
  }
  for (const attr of ['aria-labelledby', 'aria-describedby', 'for']) {
    const refs = [...HTML.matchAll(new RegExp(`\\b${attr}="([^"]+)"`, 'g'))].map((m) => m[1]);
    for (const ref of refs) {
      assert.ok(htmlIds.has(ref), `${attr}="${ref}" does not match any element id in index.html`);
    }
  }
});

test('Interactive state flow: Bol keyboard, Taal selection, Learner grading, and Recorder pipeline', () => {
  // 1. Bol keyboard rendering data
  assert.equal(BOLS.length, 13);
  for (const bol of BOLS) {
    assert.ok(bol.id && bol.name && bol.devanagari && bol.keyLabel && bol.gloss);
  }

  // 2. Taal selection and lamp/theka state updates across all 4 taals
  for (const taal of TAALS) {
    const t = getTaal(taal.id);
    assert.equal(t.theka.length, t.beats);
    for (const bolId of t.theka) {
      assert.ok(getBol(bolId), `Taal ${t.id} references unknown bol ${bolId}`);
    }
  }

  // 3. Learner path selection and call-and-response scoring state update
  const lesson3 = getLesson('l03');
  assert.ok(lesson3);
  const beatMs = 60000 / lesson3.bpm;
  const perfectAttempt = lesson3.phrase.map((bolId, idx) => ({
    bolId,
    timeMs: Math.round(idx * beatMs)
  }));
  const graded = scoreResponse(lesson3, perfectAttempt);
  assert.equal(graded.score, 100);
  assert.equal(graded.perfect, lesson3.phrase.length);

  // 4. Recorder capture, jitter deduplication, Devanagari grid rendering, and replay schedule
  const rawTake = [
    { bolId: 'dha', timeMs: 0 },
    { bolId: 'dha', timeMs: 12 }, // mechanical jitter bounce
    { bolId: 'dhin', timeMs: 500 },
    { bolId: 'dhin', timeMs: 1000 },
    { bolId: 'dha', timeMs: 1500 }
  ];
  const cleanTake = dedupeEvents(rawTake);
  assert.equal(cleanTake.length, 4);
  const cols = buildColumns(cleanTake, 120, 0);
  const devaLines = notationDevanagari(cols);
  assert.equal(devaLines.length, 4);
  assert.equal(devaLines[0], getBol('dha').devanagari);
  const schedule = replaySchedule(cleanTake);
  assert.equal(schedule.length, 4);
});

test('CSS and copy hygiene: tokens, focus-visible, tabular-nums, reduced-motion, and no banned dashes', () => {
  assert.match(TOKENS_CSS, /--color-stage/);
  assert.match(STYLE_CSS, /:focus-visible/);
  assert.match(STYLE_CSS, /tabular-nums/);
  assert.match(STYLE_CSS, /prefers-reduced-motion:\s*reduce/);
  assert.equal(/[\u2013\u2014]/.test(HTML), false);
  assert.equal(/[\u2013\u2014]/.test(TOKENS_CSS), false);
  assert.equal(/[\u2013\u2014]/.test(STYLE_CSS), false);
  assert.equal(/[\u2013\u2014]/.test(APP_JS), false);
  assert.equal(/[\u2013\u2014]/.test(README_MD), false);
  assert.equal(/[\u2013\u2014]/.test(NOTES_MD), false);
});
