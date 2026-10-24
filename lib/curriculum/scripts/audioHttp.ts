/**
 * The HTTP helpers the English-audio commands share: a `fetch` that waits out the
 * public r2.dev link's rate limit (and a transcription API's), and a small worker
 * pool. Moved out of `audit-english-audio.ts` so `check-english-audio.ts` uses the
 * same code; the audit's behaviour is unchanged.
 *
 * Node's `fetch` may ignore `HTTPS_PROXY`; behind a proxy run the commands with
 * `NODE_USE_ENV_PROXY=1`.
 */

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** The longest `Retry-After` honoured: a server asking for an hour should not hang a run for one. */
const MAX_RETRY_AFTER_MS = 60_000;

/** `Retry-After` as milliseconds (delta-seconds or an HTTP date), capped at `MAX_RETRY_AFTER_MS`. */
export function retryAfterMs(header: string | null): number {
  if (!header) return 0;
  const s = Number(header);
  const t = Date.parse(header);
  const ms = Number.isFinite(s) ? s * 1000 : Number.isFinite(t) ? t - Date.now() : 0;
  return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, ms));
}

/** 0.5 s, 1 s, 2 s … capped at 30 s, plus a little jitter so six workers do not retry in step. */
export function backoffMs(attempt: number): number {
  return Math.min(30_000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);
}

export interface RequestOptions {
  /** Tries in all, the first included. Default 8. */
  maxAttempts?: number;
  headers?: Record<string, string>;
  /** Sent on every attempt, so it must be re-sendable (a string, `FormData`, a `Blob`). */
  body?: NonNullable<Parameters<typeof fetch>[1]>['body'];
  /**
   * Opt-in, per attempt (headers and body both): an attempt that takes longer is aborted
   * and retried like any other transport failure. Off by default, so the audit is unchanged.
   */
  timeoutMs?: number;
}

/**
 * `fetch`, retrying a network failure, a 429 and a 5xx with exponential backoff and
 * honouring `Retry-After`. Any other status is returned for the caller to judge, and so
 * is the last 429/5xx once the attempts are used up.
 */
export async function requestWithBackoff(
  url: string,
  method: 'HEAD' | 'GET' | 'POST',
  opts: RequestOptions = {},
): Promise<Response> {
  const maxAttempts = opts.maxAttempts ?? 8;
  for (let attempt = 0; ; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: opts.headers,
        body: opts.body,
        signal: opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
      });
    } catch (err) {
      if (attempt >= maxAttempts - 1) throw err;
      await sleep(backoffMs(attempt));
      continue;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts - 1) {
      await res.body?.cancel();
      await sleep(Math.max(retryAfterMs(res.headers.get('retry-after')), backoffMs(attempt)));
      continue;
    }
    return res;
  }
}

/** Runs `fn` over `items` with `concurrency` in flight; results keep the order of `items`. */
export async function pool<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i] as T);
        onProgress?.(++done, items.length);
      }
    }),
  );
  return out;
}
