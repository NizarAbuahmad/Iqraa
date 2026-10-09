/**
 * Single-flight token refresh, and a way to hold refreshes off while the
 * active token slot is being swapped to another account.
 *
 * Split from apiClient.ts so `node --test` can load it (that file pulls in
 * expo-secure-store).
 *
 * Why the swap matters: a refresh reads the open account's refresh token,
 * posts it, and writes the answer back to the active slot. If an account
 * switch commits in between, that write lands on top of the new account's
 * tokens — the open user is B and the slot holds A's session. B's refresh token
 * is gone, and A's saved copy is the retired one, which the server revokes on
 * reuse (routes/auth.ts). See accountList.ts: a refresh token lives in ONE
 * place, and this is what keeps it that way.
 *
 * So `swap` waits for a refresh already under way (its result belongs to the
 * account still open, and must land before that account's token is set
 * aside), and a refresh asked for during a swap waits for the swap and then
 * hands back whatever is in the slot instead of refreshing a token that is no
 * longer the open account's.
 */
export class RefreshGate<T> {
  private inFlight: Promise<T> | null = null;
  private swapping: Promise<unknown> | null = null;

  /**
   * Run `run`, or join the run already under way. During a swap, wait for it
   * and return `afterSwap()` — the new slot's value — without refreshing.
   */
  async refresh(run: () => Promise<T>, afterSwap: () => Promise<T>): Promise<T> {
    if (this.swapping) {
      await this.swapping.catch(() => {});
      return afterSwap();
    }
    if (this.inFlight) return this.inFlight;
    // `.then`, not a direct call: the cleanup must run after the assignment
    // below, even when `run` throws synchronously.
    const started: Promise<T> = Promise.resolve()
      .then(run)
      .finally(() => {
        if (this.inFlight === started) this.inFlight = null;
      });
    this.inFlight = started;
    return started;
  }

  /** Run `fn` with no refresh in flight and none allowed to start until it settles. */
  async swap<R>(fn: () => Promise<R>): Promise<R> {
    const pending = this.inFlight;
    const run = (pending ? pending.catch(() => {}) : Promise.resolve()).then(fn);
    this.swapping = run;
    try {
      return await run;
    } finally {
      if (this.swapping === run) this.swapping = null;
    }
  }
}
