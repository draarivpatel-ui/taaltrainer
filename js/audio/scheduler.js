// Lookahead scheduler for the taal player.
// Wires the pure rhythm clock to the audio engine: every tick schedules the
// theka hits inside a short lookahead window with sample accurate times, and
// queues the beat lamp updates so the visual lands on the same instant.
// Visual callbacks and timers are injectable for the DOM stub test.

import { hitsInWindow } from "../engine/clock.js";
import { beatDuration } from "../engine/taal.js";
import { TimerGroup } from "../engine/timers.js";

export class TaalScheduler {
  constructor(engine, options = {}) {
    this.engine = engine;
    this.lookahead = options.lookahead ?? 0.15; // seconds scheduled ahead
    this.interval = options.interval ?? 25; // tick period in ms
    if (!Number.isFinite(this.lookahead) || this.lookahead <= 0 || this.lookahead > 5) throw new RangeError("Invalid lookahead");
    if (!Number.isFinite(this.interval) || this.interval <= 0) throw new RangeError("Invalid scheduler interval");
    this.scheduleVisual = options.scheduleVisual || ((fn, delayMs) => setTimeout(fn, Math.max(0, delayMs)));
    this.timer = null;
    this.state = null;
    this.visuals = new TimerGroup(this.scheduleVisual, options.cancelVisual || ((id) => clearTimeout(id)));
  }

  // Begin looping a taal. onVisual receives {beat, sam, taali, khali, vibhag,
  // absoluteBeat} shortly before each beat sounds.
  start(taal, bpm, onVisual = null) {
    beatDuration(bpm);
    this.stop();
    const startTime = this.engine.now() + 0.12;
    this.state = { taal, bpm, startTime, onVisual, scheduledThrough: startTime };
    this.tick();
    this.timer = setInterval(() => this.tick(), this.interval);
    return this.state;
  }

  tick() {
    const s = this.state;
    if (!s || !this.engine.ready) return;
    const now = this.engine.now();
    const horizon = now + this.lookahead;
    // A suspended/background tab must not burst through its missed backlog.
    const hits = hitsInWindow(s.taal, s.bpm, s.startTime, Math.max(s.scheduledThrough, now), horizon);
    for (const hit of hits) {
      this.engine.trigger(hit.bol, hit.time);
      if (s.onVisual) {
        const visual = {
          absoluteBeat: hit.absoluteBeat,
          beat: hit.beat,
          sam: hit.sam,
          taali: hit.taali,
          khali: hit.khali,
          vibhag: hit.vibhag
        };
        const delayMs = (hit.time - now) * 1000;
        this.visuals.schedule(delayMs, () => {
          if (this.state === s) s.onVisual(visual);
        });
      }
    }
    s.scheduledThrough = Math.max(s.scheduledThrough, horizon);
  }

  // Change tempo mid loop while keeping the position in the cycle. Beats
  // already booked inside the current lookahead keep their old grid, so one
  // or two hits may land a hair off across the seam.
  setTempo(bpm) {
    beatDuration(bpm);
    const s = this.state;
    if (!s || s.bpm === bpm) return;
    const now = this.engine.now();
    const beatsElapsed = (now - s.startTime) / (60 / s.bpm);
    s.bpm = bpm;
    s.startTime = now - beatsElapsed * (60 / bpm);
    s.scheduledThrough = now + this.lookahead;
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state = null;
    this.visuals.cancelAll();
  }

  get playing() {
    return this.state !== null;
  }
}
