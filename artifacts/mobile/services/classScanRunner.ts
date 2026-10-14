/**
 * Sending a class's photographs to the scan route, a few at a time.
 *
 * One request per photo, so one bad photo costs one row and not the batch. The
 * runner owns three decisions, each of which is a bug if made inline in a
 * screen:
 *
 * - **Bounded concurrency.** Three in flight keeps a class of 30–40 under the
 *   route's per-minute ceiling and gives the model a steady stream.
 * - **A rate limit is "wait", a spent allowance is "stop".** Both are 429. A busy
 *   minute is retried with a pause; a spent allowance (or live mode off) would
 *   fail every remaining photo identically, so the batch stops and keeps
 *   everything already read.
 * - **Nothing is lost.** Every photo ends in exactly one outcome — read, failed,
 *   or `not_run` because the batch stopped before it started. A caller's
 *   callback that throws cannot break this: the first such error is held until
 *   every photo has its outcome, and only then rethrown.
 */
import { isBatchStopError, isRetryable } from './scanErrors.ts';

export type PhotoOutcome<R> =
  | { state: 'read'; result: R }
  | { state: 'failed'; error: unknown }
  | { state: 'not_run' };

export interface RunnerOptions {
  /** Photos in flight at once. */
  concurrency?: number;
  /** Extra tries after a rate-limited answer. */
  maxRetries?: number;
  /** Pause before retry number `attempt` (1-based), in ms. */
  backoffMs?: (attempt: number) => number;
  sleep?: (ms: number) => Promise<void>;
  /** Called as each photo starts, so the table can show «يقرأ…». */
  onStart?: (index: number) => void;
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function scanAll<R>(
  count: number,
  scanOne: (index: number) => Promise<R>,
  onOutcome: (index: number, outcome: PhotoOutcome<R>) => void,
  opts: RunnerOptions = {},
): Promise<{ stopped: boolean }> {
  const concurrency = Math.max(1, opts.concurrency ?? 3);
  const maxRetries = opts.maxRetries ?? 2;
  const backoff = opts.backoffMs ?? (attempt => 10_000 * attempt);
  const sleep = opts.sleep ?? wait;

  let next = 0;
  let stopped = false;
  // Errors thrown by the caller's callbacks. Held rather than thrown so no
  // photo is stranded or reported twice; the first one is rethrown at the end.
  const callbackErrors: unknown[] = [];

  const deliver = (index: number, outcome: PhotoOutcome<R>) => {
    try {
      onOutcome(index, outcome);
    } catch (error) {
      callbackErrors.push(error);
    }
  };

  // Only the scan itself is inside the try: its failures are the photo's
  // outcome, while a throw from the caller is not.
  async function scanWithRetries(index: number): Promise<PhotoOutcome<R>> {
    for (let attempt = 0; ; attempt++) {
      try {
        return { state: 'read', result: await scanOne(index) };
      } catch (error) {
        if (isRetryable(error) && attempt < maxRetries) {
          await sleep(backoff(attempt + 1));
          continue;
        }
        if (isBatchStopError(error)) stopped = true;
        return { state: 'failed', error };
      }
    }
  }

  async function worker(): Promise<void> {
    while (!stopped) {
      const index = next++;
      if (index >= count) return;
      try {
        opts.onStart?.(index);
      } catch (error) {
        callbackErrors.push(error);
      }
      deliver(index, await scanWithRetries(index));
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, count) }, worker));

  // Whatever was never picked up because the batch stopped.
  for (let i = next; i < count; i++) deliver(i, { state: 'not_run' });

  // Every photo has its one outcome; now surface a caller's bug.
  if (callbackErrors.length > 0) throw callbackErrors[0];
  return { stopped };
}
