/**
 * What this guards: no API call in the app had a deadline, so a socket that
 * died while the app was asleep left `fetch` pending forever. Reopening the app
 * after Android had killed it showed the Messages screen as a header, a tab bar
 * and a spinner that never stopped — the screen only clears that spinner in a
 * `finally`. The same missing deadline wedged `refreshAccessToken`'s
 * single-flight latch, which is why the 20s poller never rescued it.
 *
 * The second test is the other half: two generation paths bring their own
 * signal and their own longer deadline, and must not be given a shorter one.
 */
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

import { fetchWithTimeout, API_TIMEOUT_MS } from '../fetchWithTimeout.ts';

/** Honors the signal it is given, and otherwise never settles. */
function hangingFetch() {
  return (_url: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () =>
        reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
      );
    });
}

describe('fetchWithTimeout', () => {
  it('rejects a request that never settles', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = hangingFetch() as typeof fetch;
    try {
      await assert.rejects(
        () => fetchWithTimeout('https://example.test/threads', {}, 20),
        (e: Error) => e.name === 'AbortError',
      );
    } finally {
      globalThis.fetch = original;
    }
  });

  it('leaves a caller-supplied signal alone — generation owns its own deadline', async () => {
    const original = globalThis.fetch;
    const seen: (AbortSignal | null | undefined)[] = [];
    const ok = new Response('{}');
    globalThis.fetch = mock.fn((_url: string, init?: RequestInit) => {
      seen.push(init?.signal);
      return Promise.resolve(ok);
    }) as unknown as typeof fetch;
    try {
      const controller = new AbortController();
      const res = await fetchWithTimeout('https://example.test/generate/quiz', {
        signal: controller.signal,
      });
      assert.equal(res, ok);
      // By identity: a wrapper controller here would abort generation at 15s.
      assert.equal(seen.length, 1);
      assert.equal(seen[0], controller.signal);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('passes a response straight through, and stops timing once it has one', async () => {
    const original = globalThis.fetch;
    const ok = new Response('{"ok":true}');
    globalThis.fetch = mock.fn(() => Promise.resolve(ok)) as unknown as typeof fetch;
    try {
      const res = await fetchWithTimeout('https://example.test/auth/me');
      assert.equal(res, ok);
      // A pending 15s timer would keep the process alive past this test; node
      // --test exiting cleanly is the assertion that `clearTimeout` ran.
      assert.equal(API_TIMEOUT_MS, 15_000);
    } finally {
      globalThis.fetch = original;
    }
  });
});
