// Refill a take through a bounded lookahead. Long rolls must not enqueue the
// entire recording into a worklet's finite future-hit budget at once.
import { replaySchedule } from "../engine/timeline.js";
import { getBol } from "../engine/bol.js";
import { TimerGroup } from "../engine/timers.js";

export class ReplayScheduler {
  constructor(engine, options = {}) {
    this.engine = engine;
    this.lookahead = options.lookahead ?? 0.15;
    this.interval = options.interval ?? 25;
    if (!Number.isFinite(this.lookahead) || this.lookahead <= 0 || this.lookahead > 5 || !Number.isFinite(this.interval) || this.interval <= 0) throw new RangeError("Invalid replay timing");
    this.setInterval = options.setInterval || ((fn, ms) => setInterval(fn, ms));
    this.clearInterval = options.clearInterval || ((id) => clearInterval(id));
    this.visuals = new TimerGroup(options.scheduleVisual, options.cancelVisual);
    this.timer = null;
    this.state = null;
  }

  start(events, onHit = null) {
    const plan = replaySchedule(events);
    if (plan.length > 2048 || plan.some((event) => event.timeMs < 0 || event.timeMs > 300000 || !getBol(event.bolId))) throw new RangeError("Take exceeds supported recording limits");
    this.stop();
    if (!plan.length) return null;
    const base = this.engine.now() + 0.15;
    if (!Number.isFinite(base)) throw new RangeError("Audio clock must be finite");
    this.state = { plan, onHit, base, cursor: 0, end: base + plan.at(-1).timeMs / 1000 + 0.25 };
    this.tick();
    this.timer = this.setInterval(() => this.tick(), this.interval);
    return this.state;
  }

  tick() {
    const state = this.state;
    if (!state || !this.engine.ready) return;
    const now = this.engine.now();
    if (!Number.isFinite(now)) { this.stop(); return; }
    const horizon = now + this.lookahead;
    while (state.cursor < state.plan.length) {
      const event = state.plan[state.cursor];
      const when = state.base + event.timeMs / 1000;
      if (when > horizon) break;
      state.cursor += 1;
      if (when < now - 1e-9) continue; // don't burst through a suspended tab's backlog
      this.engine.trigger(event.bolId, when, 0.9);
      if (state.onHit) this.visuals.schedule((when - now) * 1000, () => {
        if (this.state === state) state.onHit(event);
      });
    }
    if (now >= state.end) this.stop();
  }

  stop() {
    this.state = null;
    if (this.timer !== null) this.clearInterval(this.timer);
    this.timer = null;
    this.visuals.cancelAll();
  }

  get playing() { return this.state !== null; }
}
