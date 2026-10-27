// TaalTrainer user interface wiring.
// Builds the bol keyboard, the taal player, the lesson path with call and
// response, and the recorder, all on top of the pure engine modules and the
// audio layer. Everything runs locally; there is no network code in this file.

import { BOLS, getBol } from "./engine/bol.js";
import { TAALS, getTaal } from "./engine/taal.js";
import { LESSONS, getLesson } from "./engine/lessons.js";
import { scoreResponse } from "./engine/scoring.js";
import { countIn } from "./engine/clock.js";
import { buildColumns, notationDevanagari, replaySchedule, dedupeEvents } from "./engine/timeline.js";
import { TablaEngine } from "./audio/engine.js";
import { TaalScheduler } from "./audio/scheduler.js";

const $ = (id) => document.getElementById(id);

const engine = new TablaEngine();
const scheduler = new TaalScheduler(engine);

const state = {
  audioReady: false,
  taal: getTaal("teentaal"),
  bpm: 80,
  playing: false,
  lesson: getLesson("l01"),
  lessonPhase: "idle", // idle | listening | responding | graded
  attempt: [],
  attemptTimer: null,
  visualTimers: [],
  recording: false,
  recStart: 0,
  events: []
};

const settings = { tune: 0, ring: 1, slap: 1, tonic: 1, bass: 1, transient: 1, master: 0.9 };

function srStatus(text) {
  const el = $("sr-status");
  if (el) el.textContent = text;
}

function audioStatus(text, ready = null) {
  const el = document.querySelector("[data-audio-status]");
  if (!el) return;
  el.textContent = text;
  if (ready !== null) el.dataset.ready = String(ready);
}

async function ensureAudio() {
  if (state.audioReady) return true;
  audioStatus("Waking the drums.");
  try {
    await engine.init();
    await engine.resume();
    state.audioReady = true;
    applySettings();
    audioStatus("The drums are awake. Press any bol key.", true);
    return true;
  } catch (err) {
    audioStatus("Sound could not start in this browser. The lessons and notation still work.");
    return false;
  }
}

function applySettings() {
  engine.setVoiceParam("tonic", "tune", settings.tune);
  engine.setVoiceParam("all", "ring", settings.ring);
  engine.setVoiceParam("all", "slap", settings.slap);
  engine.setVoiceParam("tonic", "gain", settings.tonic);
  engine.setVoiceParam("bass", "gain", settings.bass);
  engine.setVoiceParam("transient", "gain", settings.transient);
  engine.setMasterGain(settings.master);
}

/* The bol keyboard */

const keyButtons = new Map();

function buildKeyboard() {
  const host = $("bol-keys");
  for (const bol of BOLS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "key";
    btn.dataset.bol = bol.id;
    btn.setAttribute("aria-label", `${bol.name}, key ${bol.keyLabel}, ${bol.gloss}`);
    const glyph = document.createElement("span");
    glyph.className = "key-glyph";
    glyph.setAttribute("lang", "hi");
    glyph.textContent = bol.devanagari;
    const name = document.createElement("span");
    name.className = "key-name";
    name.textContent = bol.name;
    const cap = document.createElement("span");
    cap.className = "key-cap";
    cap.textContent = bol.keyLabel;
    btn.append(glyph, name, cap);
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      strike(bol.id, 1);
    });
    host.append(btn);
    keyButtons.set(bol.id, btn);
  }
}

function flashKey(bolId) {
  const btn = keyButtons.get(bolId);
  if (!btn) return;
  btn.classList.add("is-hit");
  window.setTimeout(() => {
    btn.classList.remove("is-hit");
    btn.classList.add("is-decaying");
    window.setTimeout(() => btn.classList.remove("is-decaying"), 480);
  }, 80);
}

async function strike(bolId, velocity = 1) {
  await ensureAudio();
  if (state.audioReady) engine.trigger(bolId, undefined, velocity);
  flashKey(bolId);
  capture(bolId);
}

const CODE_TO_BOL = new Map(BOLS.map((b) => [b.code, b.id]));

document.addEventListener("keydown", (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  const target = e.target;
  if (target instanceof Element) {
    const tag = target.tagName;
    if (tag === "TEXTAREA" || tag === "SELECT") return;
    if (tag === "INPUT" && target.type !== "range") return;
    if ((e.code === "Enter" || e.code === "Space") && target.closest("button, a, summary")) return;
  }
  const bolId = CODE_TO_BOL.get(e.code);
  if (!bolId) return;
  e.preventDefault();
  strike(bolId, 1);
});

/* The plain sight rack */

function bindControl(id, outId, format, apply) {
  const input = $(id);
  const out = $(outId);
  if (!input || !out) return;
  const update = () => {
    const value = parseFloat(input.value);
    out.textContent = format(value);
    apply(value);
  };
  input.addEventListener("input", update);
  update();
}

function bindRack() {
  bindControl("ctl-tune", "out-tune", (v) => `${v > 0 ? "+" : ""}${v} st`, (v) => { settings.tune = v; engine.setVoiceParam("tonic", "tune", v); });
  bindControl("ctl-ring", "out-ring", (v) => `${v.toFixed(2)} x`, (v) => { settings.ring = v; engine.setVoiceParam("all", "ring", v); });
  bindControl("ctl-slap", "out-slap", (v) => `${v.toFixed(2)} x`, (v) => { settings.slap = v; engine.setVoiceParam("all", "slap", v); });
  bindControl("ctl-tonic", "out-tonic", (v) => `${v.toFixed(2)} x`, (v) => { settings.tonic = v; engine.setVoiceParam("tonic", "gain", v); });
  bindControl("ctl-bass", "out-bass", (v) => `${v.toFixed(2)} x`, (v) => { settings.bass = v; engine.setVoiceParam("bass", "gain", v); });
  bindControl("ctl-transient", "out-transient", (v) => `${v.toFixed(2)} x`, (v) => { settings.transient = v; engine.setVoiceParam("transient", "gain", v); });
  bindControl("ctl-master", "out-master", (v) => `${v.toFixed(2)} x`, (v) => { settings.master = v; engine.setMasterGain(v); });
}

/* The taal player */

const lampEls = [];
const thekaEls = [];

function buildTaalChoices() {
  const host = $("taal-choices");
  for (const taal of TAALS) {
    const label = document.createElement("label");
    label.className = "taal-choice";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "taal";
    input.value = taal.id;
    input.checked = taal.id === state.taal.id;
    input.addEventListener("change", () => selectTaal(taal.id));
    const box = document.createElement("span");
    const deva = document.createElement("span");
    deva.className = "taal-deva";
    deva.setAttribute("lang", "hi");
    deva.textContent = taal.devanagari;
    const name = document.createElement("span");
    name.className = "taal-name";
    name.textContent = taal.name;
    box.append(deva, name);
    label.append(input, box);
    host.append(label);
  }
}

function selectTaal(id) {
  state.taal = getTaal(id);
  buildLamps();
  updateTaalMeta();
  if (state.playing) {
    scheduler.stop();
    scheduler.start(state.taal, state.bpm, onBeatVisual);
  }
}

function buildLamps() {
  const host = $("beat-lamps");
  host.replaceChildren();
  lampEls.length = 0;
  for (let beat = 0; beat < state.taal.beats; beat += 1) {
    const lamp = document.createElement("li");
    lamp.className = "lamp";
    if (state.taal.taali.includes(beat)) lamp.dataset.mark = "taali";
    if (state.taal.khali.includes(beat)) lamp.dataset.mark = "khali";
    if (beat === 0) lamp.dataset.sam = "true";
    host.append(lamp);
    lampEls.push(lamp);
  }
  const theka = $("theka-line");
  theka.replaceChildren();
  thekaEls.length = 0;
  for (let beat = 0; beat < state.taal.beats; beat += 1) {
    const bol = getBol(state.taal.theka[beat]);
    const span = document.createElement("span");
    span.className = "beat";
    if (state.taal.khali.includes(beat)) span.dataset.khali = "true";
    span.textContent = bol ? bol.devanagari : "?";
    theka.append(span);
    thekaEls.push(span);
  }
  $("out-beats").value = String(state.taal.beats);
  $("out-beat").value = "1";
}

function updateTaalMeta() {
  const taal = state.taal;
  const claps = taal.taali.map((b) => b + 1).join(", ");
  const khali = taal.khali.map((b) => b + 1).join(", ");
  const khaliText = khali ? ` Khali falls on ${khali}.` : "";
  $("taal-meta").textContent = `${taal.name} ${taal.devanagari}, ${taal.beats} beats. Claps land on ${claps}.${khaliText} ${taal.note}`;
}

function onBeatVisual(visual) {
  window.requestAnimationFrame(() => {
    for (const [i, lamp] of lampEls.entries()) lamp.classList.toggle("is-now", i === visual.beat);
    for (const [i, span] of thekaEls.entries()) span.classList.toggle("is-now", i === visual.beat);
    $("out-beat").value = String(visual.beat + 1);
  });
}

function startLoop() {
  state.playing = true;
  scheduler.start(state.taal, state.bpm, onBeatVisual);
  $("btn-play").setAttribute("aria-pressed", "true");
  $("btn-play").textContent = "Stop the loop";
  $("beat-lamps").classList.remove("is-idle");
  srStatus(`Playing ${state.taal.name} at ${state.bpm} beats per minute.`);
}

function stopLoop() {
  state.playing = false;
  scheduler.stop();
  engine.panic();
  $("btn-play").setAttribute("aria-pressed", "false");
  $("btn-play").textContent = "Play the loop";
  $("beat-lamps").classList.add("is-idle");
  for (const lamp of lampEls) lamp.classList.remove("is-now");
  for (const span of thekaEls) span.classList.remove("is-now");
  $("out-beat").value = "1";
  srStatus("The loop is stopped.");
}

async function toggleLoop() {
  if (state.playing) {
    stopLoop();
    return;
  }
  const ok = await ensureAudio();
  if (ok) startLoop();
}

function bindTaalPlayer() {
  $("btn-play").addEventListener("click", toggleLoop);
  $("ctl-bpm").addEventListener("input", () => {
    state.bpm = parseFloat($("ctl-bpm").value);
    $("out-bpm").value = `${state.bpm} bpm`;
    if (state.playing) scheduler.setTempo(state.bpm);
  });
  $("out-bpm").value = `${state.bpm} bpm`;
}

/* The learner path */

const chips = [];
const lessonDone = new Set();

function buildLessonList() {
  const host = $("lesson-list");
  for (const lesson of LESSONS) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lesson-item";
    btn.dataset.lesson = lesson.id;
    btn.addEventListener("click", () => selectLesson(lesson.id));
    const no = document.createElement("span");
    no.className = "lesson-no num";
    no.textContent = String(lesson.number).padStart(2, "0");
    const title = document.createElement("span");
    title.className = "lesson-item-title";
    title.textContent = lesson.title;
    const mark = document.createElement("span");
    mark.className = "lesson-state";
    btn.append(no, title, mark);
    li.append(btn);
    host.append(li);
  }
}

function selectLesson(id) {
  const lesson = getLesson(id);
  if (!lesson) return;
  cancelResponse();
  state.lesson = lesson;
  state.lessonPhase = "idle";
  state.attempt = [];
  for (const btn of document.querySelectorAll(".lesson-item")) {
    btn.setAttribute("aria-current", String(btn.dataset.lesson === id));
  }
  $("lesson-title").textContent = `${lesson.number}. ${lesson.title}`;
  $("lesson-blurb").textContent = lesson.blurb;
  const host = $("phrase-line");
  host.replaceChildren();
  chips.length = 0;
  lesson.phrase.forEach((bolId, i) => {
    const bol = getBol(bolId);
    const chip = document.createElement("span");
    chip.className = "chip";
    const deva = document.createElement("span");
    deva.className = "chip-deva";
    deva.setAttribute("lang", "hi");
    deva.textContent = bol ? bol.devanagari : "?";
    const name = document.createElement("span");
    name.className = "chip-name";
    name.textContent = bol ? bol.name : bolId;
    chip.append(deva, name);
    host.append(chip);
    chips.push(chip);
  });
  $("lesson-status").textContent = "Press \u201CPlay the call\u201D, listen, then answer on the keyboard.";
  $("verdict-row").replaceChildren();
  $("score-readout").hidden = true;
  $("btn-grade").disabled = true;
}

function scheduleVisual(delayMs, fn) {
  state.visualTimers.push(window.setTimeout(fn, Math.max(0, delayMs)));
}

function cancelResponse() {
  for (const t of state.visualTimers) window.clearTimeout(t);
  state.visualTimers = [];
  if (state.attemptTimer) window.clearTimeout(state.attemptTimer);
  state.attemptTimer = null;
}

async function playCall() {
  const ok = await ensureAudio();
  if (!ok || !state.audioReady) return;
  cancelResponse();
  const lesson = state.lesson;
  state.lessonPhase = "listening";
  state.attempt = [];
  $("btn-grade").disabled = true;
  $("lesson-status").textContent = "Listen.";
  srStatus(`${lesson.title}. Listen to the call.`);
  for (const chip of chips) {
    chip.removeAttribute("data-verdict");
    const old = chip.querySelector(".chip-verdict");
    if (old) old.remove();
  }
  const beat = 60000 / lesson.bpm;
  const ci = countIn(lesson.bpm, 4, 0);
  const base = engine.now() + 0.25;
  for (const click of ci.clicks) {
    engine.trigger(click.sam ? "kat" : "te", base + click.time, 0.55);
  }
  scheduleVisual(250, () => $("lesson-status").textContent = "Listen. The count in starts now.");
  lesson.phrase.forEach((bolId, i) => {
    const when = base + ci.phraseStart + (i * beat) / 1000;
    engine.trigger(bolId, when, 0.9);
    scheduleVisual(ci.phraseStart * 1000 + i * beat, () => {
      $("lesson-status").textContent = `The call plays ${getBol(bolId)?.name ?? bolId}.`;
    });
  });
  const phraseEndMs = ci.phraseStart * 1000 + lesson.phrase.length * beat;
  scheduleVisual(phraseEndMs, () => {
    state.lessonPhase = "responding";
    state.lessonRecStart = performance.now();
    $("lesson-status").textContent = `Your turn. Tap the phrase back on the keyboard.`;
    $("btn-grade").disabled = false;
    srStatus("Your turn. Tap the phrase back.");
    state.attemptTimer = window.setTimeout(() => {
      if (state.lessonPhase === "responding") gradeNow();
    }, 2500);
  });
}

function capture(bolId) {
  if (state.lessonPhase === "responding") {
    state.attempt.push({ bolId, timeMs: Math.round(performance.now() - state.lessonRecStart) });
    $("lesson-status").textContent = `${state.attempt.length} of ${state.lesson.phrase.length} tapped.`;
    if (state.attempt.length >= state.lesson.phrase.length) {
      if (state.attemptTimer) window.clearTimeout(state.attemptTimer);
      state.attemptTimer = window.setTimeout(() => {
        if (state.lessonPhase === "responding") gradeNow();
      }, 400);
    }
  }
  if (state.recording) {
    state.events.push({ bolId, timeMs: Math.round(performance.now() - state.recStart) });
  }
}

function gradeNow() {
  if (state.lessonPhase !== "responding") return;
  cancelResponse();
  state.lessonPhase = "graded";
  $("btn-grade").disabled = true;
  const lesson = state.lesson;
  const result = scoreResponse(lesson, state.attempt);
  result.results.forEach((r) => {
    const chip = chips[r.index];
    if (!chip) return;
    chip.dataset.verdict = r.verdict;
    const tag = document.createElement("span");
    tag.className = "chip-verdict";
    const words = { perfect: "perfect", good: "good", wrongStroke: "wrong stroke", miss: "missed" };
    tag.textContent = words[r.verdict] ?? r.verdict;
    chip.append(tag);
  });
  $("out-score").value = String(result.score);
  $("score-readout").hidden = false;
  const parts = [];
  if (result.perfect) parts.push(`${result.perfect} perfect`);
  if (result.good) parts.push(`${result.good} close`);
  if (result.wrong) parts.push(`${result.wrong} wrong stroke`);
  if (result.missed) parts.push(`${result.missed} missed`);
  $("lesson-status").textContent = `${parts.join(", ") || "Nothing tapped"}. Tolerance was ${result.toleranceMs} ms.`;
  srStatus(`Score ${result.score} of 100. ${parts.join(", ")}.`);
  if (result.score >= 80) {
    lessonDone.add(lesson.id);
    const btn = document.querySelector(`.lesson-item[data-lesson="${lesson.id}"] .lesson-state`);
    if (btn) btn.textContent = "done";
  }
}

function bindLessons() {
  $("btn-call").addEventListener("click", playCall);
  $("btn-again").addEventListener("click", playCall);
  $("btn-grade").addEventListener("click", gradeNow);
}

/* The recorder */

function recorderBpm() {
  return state.bpm;
}

function toggleRecording() {
  if (!state.recording) {
    state.recording = true;
    state.recStart = performance.now();
    state.events = [];
    $("btn-record").setAttribute("aria-pressed", "true");
    $("btn-record").textContent = "Stop";
    $("btn-recplay").disabled = true;
    $("btn-recclear").disabled = true;
    $("notation-empty").hidden = false;
    $("notation-empty").textContent = "Recording. Play strokes on the keyboard, then press Stop.";
    $("notation-cells").hidden = true;
    srStatus("Recording.");
  } else {
    state.recording = false;
    $("btn-record").setAttribute("aria-pressed", "false");
    $("btn-record").textContent = "Record";
    state.events = dedupeEvents(state.events);
    if (state.events.length === 0) {
      $("notation-empty").hidden = false;
      $("notation-empty").textContent = "Nothing was captured. Record and play a few strokes.";
    } else {
      $("notation-empty").hidden = true;
      renderNotation();
      $("btn-recplay").disabled = false;
      $("btn-recclear").disabled = false;
      srStatus(`Stopped. ${state.events.length} strokes captured.`);
    }
  }
}

function renderNotation() {
  const bpm = recorderBpm();
  const cols = buildColumns(state.events, bpm, 0);
  const lines = notationDevanagari(cols);
  const host = $("notation-cells");
  host.replaceChildren();
  cols.forEach((col, i) => {
    const cell = document.createElement("li");
    cell.className = "notation-cell";
    cell.dataset.column = String(i);
    const label = document.createElement("span");
    label.className = "cell-beats";
    label.textContent = String(i + 1);
    const body = document.createElement("span");
    if (col.hits.length === 0) {
      body.className = "cell-rest";
      body.textContent = "\u00B7";
      body.setAttribute("aria-label", "rest");
    } else {
      body.className = "cell-deva";
      body.setAttribute("lang", "hi");
      body.textContent = lines[i];
    }
    cell.append(label, body);
    host.append(cell);
  });
  host.hidden = false;
}

async function replayTake() {
  const ok = await ensureAudio();
  if (!ok || state.events.length === 0) return;
  const plan = replaySchedule(state.events);
  const base = engine.now() + 0.15;
  const beat = 60000 / recorderBpm();
  const cells = $("notation-cells").children;
  for (const ev of plan) {
    engine.trigger(ev.bolId, base + ev.timeMs / 1000, 0.9);
    // Light the notation cell the hit landed in, not its order in the take.
    const column = Math.max(0, Math.floor(ev.timeMs / beat));
    const cell = cells[Math.min(column, cells.length - 1)];
    if (cell) {
      scheduleVisual(150 + ev.timeMs, () => {
        cell.classList.add("is-playing");
        window.setTimeout(() => cell.classList.remove("is-playing"), 220);
      });
    }
  }
  srStatus("Replaying your take.");
}

function clearTake() {
  cancelResponse();
  state.events = [];
  $("notation-cells").hidden = true;
  $("notation-cells").replaceChildren();
  $("notation-empty").hidden = false;
  $("notation-empty").textContent = "Nothing captured yet. Record, play a few strokes, then stop.";
  $("btn-recplay").disabled = true;
  $("btn-recclear").disabled = true;
}

function bindRecorder() {
  $("btn-record").addEventListener("click", toggleRecording);
  $("btn-recplay").addEventListener("click", replayTake);
  $("btn-recclear").addEventListener("click", clearTake);
}

/* Boot */

buildKeyboard();
bindRack();
buildTaalChoices();
buildLamps();
updateTaalMeta();
bindTaalPlayer();
buildLessonList();
bindLessons();
bindRecorder();
selectLesson("l01");
selectTaal("teentaal");
$("beat-lamps").classList.add("is-idle");
audioStatus("Sound is off until your first key press.");
