/**
 * Autosave for a student's paper: debounced per question, one request in
 * flight per question, last value wins.
 *
 * Its own module, importing nothing, for the reason `studentAnswers.ts`
 * gives: `node --test` cannot load anything that touches React Native, so
 * the logic worth testing has to sit clear of the screen that uses it.
 *
 * Why it exists: the exam screen used to issue one PUT per keystroke. The
 * `/take` limiter counts a whole classroom against one ceiling, so a class
 * typing short answers tripped it inside a minute and every save on every
 * phone read «لم تُحفظ». And nothing ordered the requests, so a slow early
 * one could land after a later one and leave a truncated answer on the
 * server. Both are closed here: a keystroke waits `delayMs`, a tap goes at
 * once, and a question never has two requests racing.
 */
export type SaveFn = (questionId: string, response: Record<string, unknown>) => Promise<unknown>;

export interface SaveQueueState {
  /** Questions whose latest value the server has not confirmed yet. */
  pending: string[];
  /** The subset whose last attempt failed — what the screen should show. */
  failed: string[];
}

interface Timers {
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (id: ReturnType<typeof setTimeout>) => void;
}

export interface SaveQueue {
  set(questionId: string, response: Record<string, unknown>, opts?: { immediate?: boolean }): void;
  /** Send everything now and wait; true when nothing is left unsaved. */
  flush(): Promise<boolean>;
  state(): SaveQueueState;
  dispose(): void;
}

export function createSaveQueue(opts: {
  save: SaveFn;
  delayMs: number;
  onChange?: (state: SaveQueueState) => void;
  timers?: Timers;
}): SaveQueue {
  const timers: Timers = opts.timers ?? {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: id => clearTimeout(id),
  };
  const latest = new Map<string, Record<string, unknown>>();
  const timer = new Map<string, ReturnType<typeof setTimeout>>();
  const inFlight = new Map<string, Promise<void>>();
  /** The value each in-flight request carries, to tell a newer one apart. */
  const sent = new Map<string, Record<string, unknown>>();
  /** Set while a request is in flight and a newer value arrived behind it. */
  const dirty = new Set<string>();
  const failed = new Set<string>();
  let disposed = false;

  const state = (): SaveQueueState => ({ pending: [...latest.keys()], failed: [...failed] });
  const notify = () => opts.onChange?.(state());

  function send(id: string): Promise<void> {
    const running = inFlight.get(id);
    const value = latest.get(id);
    if (running) {
      // Only a *newer* value needs a second trip; a flush that finds the
      // same value already on the wire just waits for it.
      if (value !== sent.get(id)) dirty.add(id);
      return running;
    }
    if (!value) return Promise.resolve();
    dirty.delete(id);
    sent.set(id, value);
    // Called synchronously, so an immediate save is on the wire before this
    // returns — and so a throwing save is a failure, not an unhandled one.
    let request: Promise<unknown>;
    try {
      request = Promise.resolve(opts.save(id, value));
    } catch (err) {
      request = Promise.reject(err);
    }
    const p = request
      .then(
        () => {
          failed.delete(id);
          // Confirmed, unless something newer arrived while we waited.
          if (!dirty.has(id)) latest.delete(id);
        },
        () => {
          failed.add(id);
        },
      )
      .then(() => {
        inFlight.delete(id);
        sent.delete(id);
        if (dirty.has(id) && !disposed) return send(id);
        return undefined;
      })
      .then(notify);
    inFlight.set(id, p);
    return p;
  }

  return {
    set(id, response, o) {
      if (disposed) return;
      latest.set(id, response);
      const t = timer.get(id);
      if (t) timers.clearTimeout(t);
      timer.delete(id);
      if (o?.immediate) {
        void send(id);
      } else {
        timer.set(id, timers.setTimeout(() => { timer.delete(id); void send(id); }, opts.delayMs));
      }
      notify();
    },
    async flush() {
      for (const [id, t] of timer) {
        timers.clearTimeout(t);
        timer.delete(id);
      }
      const ids = [...latest.keys()];
      await Promise.all(ids.map(id => send(id)));
      // A value that arrived mid-flight was re-sent by `send`; wait for that too.
      await Promise.all([...inFlight.values()]);
      return latest.size === 0;
    },
    state,
    dispose() {
      disposed = true;
      for (const t of timer.values()) timers.clearTimeout(t);
      timer.clear();
    },
  };
}

/**
 * Answers this device kept because the server had not confirmed them, laid
 * back over what the server returned when the paper is re-entered.
 *
 * The queue lives in memory, so a reload (a cold boot on web) or a killed
 * app used to drop every answer whose save had failed. The screen now keeps
 * the unconfirmed ones in storage; this decides which of them still need
 * sending — only those that differ from the server's copy.
 */
export function mergeUnsavedAnswers<R>(
  server: Record<string, R>,
  local: Record<string, R>,
): { answers: Record<string, R>; resend: string[] } {
  const answers = { ...server };
  const resend: string[] = [];
  for (const [id, response] of Object.entries(local)) {
    if (JSON.stringify(server[id]) === JSON.stringify(response)) continue;
    answers[id] = response;
    resend.push(id);
  }
  return { answers, resend };
}
