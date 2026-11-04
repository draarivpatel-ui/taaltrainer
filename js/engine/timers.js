// Cancellable, bounded ownership of timeout callbacks. A fired timeout is
// removed immediately; callbacks from a cancelled generation cannot run.
export class TimerGroup {
  constructor(schedule = (fn, ms) => setTimeout(fn, ms), cancel = (id) => clearTimeout(id)) {
    this.scheduleTimeout = schedule;
    this.cancelTimeout = cancel;
    this.pending = new Set();
  }

  schedule(delayMs, callback) {
    if (!Number.isFinite(delayMs)) throw new RangeError("Timer delay must be finite");
    const token = { active: true, handle: null };
    this.pending.add(token);
    try {
      token.handle = Reflect.apply(this.scheduleTimeout, globalThis, [() => {
        if (!token.active) return;
        token.active = false;
        this.pending.delete(token);
        callback();
      }, Math.max(0, delayMs)]);
    } catch (error) {
      token.active = false;
      this.pending.delete(token);
      throw error;
    }
    return token.handle;
  }

  cancelAll() {
    for (const token of this.pending) {
      token.active = false;
      Reflect.apply(this.cancelTimeout, globalThis, [token.handle]);
    }
    this.pending.clear();
  }

  get size() { return this.pending.size; }
}
