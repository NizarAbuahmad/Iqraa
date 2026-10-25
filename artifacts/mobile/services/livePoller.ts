/**
 * A polling loop with three promises, pure so `node --test` can check them:
 *
 * - **Never overlaps.** The next request is scheduled when the last one
 *   settles, so a slow network cannot stack requests behind each other (a
 *   class of 30 tablets would otherwise hammer the server exactly when it is
 *   slowest).
 * - **Pauses while hidden.** `setPaused(true)` cancels the timer; unpausing
 *   polls at once, so a tab brought back to the front is current immediately.
 * - **Stops when it can never succeed.** `isFatal` (the game is gone, the
 *   token is refused) ends the loop instead of retrying a 404 forever.
 *
 * A response that lands after `stop()` is dropped, not delivered.
 */
export interface PollerOptions<T> {
  fetch: () => Promise<T>;
  onData: (data: T) => void;
  /** Called for every failure, fatal or not. */
  onError?: (error: unknown, fatal: boolean) => void;
  isFatal?: (error: unknown) => boolean;
  /**
   * After a failed poll: ms to wait before the next one (instead of
   * `intervalMs`), or null for the normal interval. `consecutiveFailures`
   * counts failures since the last success. A 429 backs off through this.
   */
  retryDelay?: (error: unknown, consecutiveFailures: number) => number | null;
  intervalMs?: number;
}

export interface Poller {
  start(): void;
  stop(): void;
  setPaused(paused: boolean): void;
  /** Poll now (after an action the screen just took); coalesces with a request in flight. */
  pollNow(): void;
}

export function createPoller<T>(o: PollerOptions<T>): Poller {
  const interval = o.intervalMs ?? 1500;
  let running = false;
  let paused = false;
  let inFlight = false;
  let again = false;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;
  let nextDelay: number | null = null;

  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const schedule = () => {
    clear();
    const wait = nextDelay ?? interval;
    nextDelay = null;
    if (running && !paused) timer = setTimeout(tick, wait);
  };

  async function tick() {
    timer = null;
    if (!running || paused || inFlight) {
      // A poll asked for while one is out goes as soon as that one settles.
      if (running && !paused && inFlight) again = true;
      return;
    }
    inFlight = true;
    const mine = generation;
    try {
      const data = await o.fetch();
      if (mine === generation && running) { failures = 0; o.onData(data); }
    } catch (e) {
      if (mine === generation && running) {
        const fatal = o.isFatal?.(e) ?? false;
        failures++;
        nextDelay = o.retryDelay?.(e, failures) ?? null;
        if (fatal) { running = false; clear(); }
        o.onError?.(e, fatal);
      }
    } finally {
      inFlight = false;
      // A backoff is not cut short by a queued extra poll.
      if (again && running && !paused && nextDelay === null) { again = false; void tick(); }
      else { again = false; schedule(); }
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      generation++;
      void tick();
    },
    stop() {
      running = false;
      generation++;
      again = false;
      clear();
    },
    setPaused(p) {
      if (p === paused) return;
      paused = p;
      if (p) clear();
      else if (running) { clear(); void tick(); }
    },
    pollNow() {
      if (!running || paused) return;
      clear();
      void tick();
    },
  };
}
