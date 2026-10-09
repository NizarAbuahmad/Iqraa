/**
 * The network half of a streamed chat turn.
 *
 * `expo/fetch`, not the global: React Native's fetch is XHR-backed and
 * `response.body` is undefined there, so a streamed reply would arrive only
 * when it had finished — the behaviour this exists to replace. On web
 * `expo/fetch` is the browser's fetch.
 *
 * Goes through `apiFetch` (with this fetch as `fetchImpl`) for the bearer
 * token and the one 401 refresh-and-retry, the same as every other call.
 *
 * Falls back to the JSON shape when the API answers with one — the API
 * deploys before the bundle, but a bundle can also meet an API that has not
 * redeployed yet (a preview, a local server on an older checkout).
 *
 * Imports expo, so it is deliberately not loaded by `node --test`; the
 * parsing it leans on is tested in sseParser.test.ts.
 */
import { fetch as expoFetch } from 'expo/fetch';

import { ApiError, apiFetch } from '../apiClient';
import { createDeltaThrottle, createSseParser } from './sseParser';

export type ChatParams = {
  messages: { role: string; content: string }[];
  context?: string;
  mode: 'teacher' | 'student';
  language: 'ar' | 'en';
};

/** No byte for this long, before or between chunks, and the turn is given up. */
const IDLE_TIMEOUT_MS = 45_000;
const EMIT_EVERY_MS = 80;

export class ChatStreamTimeoutError extends Error {
  constructor() {
    super(`Chat stream idle for ${IDLE_TIMEOUT_MS}ms`);
    this.name = 'TimeoutError';
  }
}

async function throwApiError(res: Response): Promise<never> {
  let body: { error?: unknown; code?: unknown } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    // Not JSON: the status is all we have.
  }
  throw new ApiError(
    typeof body.error === 'string' ? body.error : `Request failed (${res.status})`,
    typeof body.code === 'string' ? body.code : undefined,
    res.status,
  );
}

export async function streamChat(
  params: ChatParams,
  opts: { signal: AbortSignal; onDelta: (full: string) => void },
): Promise<{ content: string; cancelled: boolean }> {
  // One controller feeds fetch: the caller's Stop and the idle timer both
  // abort it, and `timedOut` says which — a timeout is a failure the screen
  // may fall back from, a Stop is a choice it must respect.
  const controller = new AbortController();
  let timedOut = false;
  const onCallerAbort = () => controller.abort();
  if (opts.signal.aborted) controller.abort();
  else opts.signal.addEventListener('abort', onCallerAbort);

  let idle: ReturnType<typeof setTimeout> | null = null;
  const armIdle = () => {
    if (idle) clearTimeout(idle);
    idle = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, IDLE_TIMEOUT_MS);
  };

  let full = '';
  const throttle = createDeltaThrottle(opts.onDelta, EMIT_EVERY_MS);

  try {
    armIdle();
    const res = await apiFetch('/chat', {
      method: 'POST',
      headers: { Accept: 'text/event-stream' },
      body: JSON.stringify(params),
      signal: controller.signal,
      fetchImpl: expoFetch as unknown as typeof fetch,
    });
    if (!res.ok) await throwApiError(res);

    const contentType = res.headers.get('content-type') ?? '';
    if (!/text\/event-stream/i.test(contentType) || !res.body) {
      // An API that does not stream yet, or a proxy that collapsed the
      // stream: the body is the old `{ content }` and arrives whole.
      const json = (await res.json()) as { content?: unknown };
      const content = typeof json.content === 'string' ? json.content : '';
      if (content) opts.onDelta(content);
      return { content, cancelled: false };
    }

    const parser = createSseParser();
    const decoder = new TextDecoder();
    const reader = res.body.getReader();
    // Assigned inside `handle`, so TypeScript would otherwise narrow both to
    // `null` here and see the reads below as unreachable.
    let doneContent = null as string | null;
    let streamError = null as { code: string; message: string } | null;

    const handle = (events: ReturnType<typeof parser.push>) => {
      for (const ev of events) {
        if (ev.type === 'delta') {
          full += ev.text;
          throttle.push(full);
        } else if (ev.type === 'done') {
          doneContent = ev.content;
        } else if (ev.type === 'error') {
          streamError = { code: ev.code, message: ev.message };
        }
      }
    };

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      armIdle();
      handle(parser.push(decoder.decode(value, { stream: true })));
    }
    handle(parser.push(decoder.decode()));
    handle(parser.flush());
    throttle.flush();

    if (streamError && !full) {
      throw new ApiError(streamError.message || 'stream failed', streamError.code, 200);
    }
    // `done` carries the authoritative text; deltas can lose a frame to a
    // proxy, the final string cannot.
    const content = doneContent ?? full;
    if (content !== full) opts.onDelta(content);
    return { content, cancelled: false };
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    if (aborted && !timedOut) {
      // The teacher's Stop: not an error. Hand back what arrived.
      throttle.flush();
      return { content: full, cancelled: true };
    }
    if (aborted && timedOut) throw new ChatStreamTimeoutError();
    throw e;
  } finally {
    if (idle) clearTimeout(idle);
    opts.signal.removeEventListener('abort', onCallerAbort);
  }
}
