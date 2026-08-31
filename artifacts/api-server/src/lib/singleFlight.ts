/**
 * Collapse concurrent identical work into one execution.
 *
 * The scenario this exists for is the one the whole caching plan is about:
 * thirty teachers in a training session request the same lesson within a few
 * seconds. Every one of them misses the cache, because none has written back
 * yet, and the account pays thirty times for one artifact. A cache without
 * this is a cache that works everywhere except the moment it matters most.
 *
 * Scope is one process. Render can run more than one, so this is not the whole
 * answer — the unique index on `(strict_key, variant_index)` is what makes the
 * cross-process race safe, by letting the loser's insert fail and serve the
 * winner's row. This handles the common case cheaply; the constraint handles
 * the rest correctly.
 *
 * The entry is removed when the promise settles, failure included: a rejected
 * generation must not be handed to the next thirty callers.
 */
export class SingleFlight<T> {
  private inFlight = new Map<string, Promise<T>>();

  /**
   * Run `fn` for `key`, or join the run already under way for it.
   *
   * Callers that join share one result object. Every current caller either
   * returns it straight to `res.json()` or spreads it, so nothing mutates
   * it — worth knowing before something starts to.
   */
  async run(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    // Started before the map write so a synchronous throw inside `fn` cannot
    // leave a key pointing at nothing.
    const started = (async () => fn())();
    this.inFlight.set(key, started);
    try {
      return await started;
    } finally {
      // Only if it is still ours: a slow rejection could otherwise delete the
      // entry belonging to the next call that already replaced it.
      if (this.inFlight.get(key) === started) this.inFlight.delete(key);
    }
  }

  /** In-flight count. For tests and for /healthz, not for control flow. */
  get size(): number {
    return this.inFlight.size;
  }
}
