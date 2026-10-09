// artifacts/mobile/services/ai/sseParser.ts
/**
 * Server-Sent Events, the subset /chat sends, parsed from text chunks that
 * can be cut anywhere. Pure TypeScript with no React Native import so
 * `node --test` can load it; the network half lives in chatStreamClient.ts.
 *
 * The event shapes mirror `artifacts/api-server/src/lib/chatStream.ts`.
 */

export type ChatStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; content: string }
  | { type: 'error'; code: string; message: string };

function parseEvent(dataLines: string[]): ChatStreamEvent | null {
  if (!dataLines.length) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(dataLines.join('\n'));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const ev = parsed as Record<string, unknown>;
  if (ev.type === 'delta' && typeof ev.text === 'string') return { type: 'delta', text: ev.text };
  if (ev.type === 'done' && typeof ev.content === 'string') return { type: 'done', content: ev.content };
  if (ev.type === 'error') {
    return {
      type: 'error',
      code: typeof ev.code === 'string' ? ev.code : 'stream_failed',
      message: typeof ev.message === 'string' ? ev.message : '',
    };
  }
  return null;
}

export function createSseParser(): {
  push(text: string): ChatStreamEvent[];
  flush(): ChatStreamEvent[];
} {
  let buffer = '';
  let dataLines: string[] = [];

  const endEvent = (out: ChatStreamEvent[]) => {
    const ev = parseEvent(dataLines);
    dataLines = [];
    if (ev) out.push(ev);
  };

  const consumeLine = (line: string, out: ChatStreamEvent[]) => {
    if (line === '') { endEvent(out); return; }
    if (line.startsWith(':')) return; // comment / keep-alive
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'data') dataLines.push(value);
    // `event`, `id`, `retry` and anything else: not used by this protocol.
  };

  return {
    push(text) {
      const out: ChatStreamEvent[] = [];
      buffer += text;
      let nl: number;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        consumeLine(line, out);
      }
      return out;
    },
    flush() {
      const out: ChatStreamEvent[] = [];
      if (buffer) {
        consumeLine(buffer.endsWith('\r') ? buffer.slice(0, -1) : buffer, out);
        buffer = '';
      }
      endEvent(out);
      return out;
    },
  };
}

/**
 * Hand the growing reply to the screen at most once per `intervalMs`.
 *
 * The bubble re-lays out maths on every change, and a model emits a token
 * every 20–40 ms; one render per 80 ms reads as live and costs a quarter of
 * the work. The first value goes out at once so the spinner is replaced by
 * text immediately; `flush` sends whatever is held when the stream ends.
 */
export function createDeltaThrottle(
  emit: (full: string) => void,
  intervalMs: number,
  now: () => number = Date.now,
): { push(full: string): void; flush(): void } {
  let lastEmit = -Infinity;
  let pending: string | null = null;
  return {
    push(full) {
      const t = now();
      if (t - lastEmit >= intervalMs) {
        lastEmit = t;
        pending = null;
        emit(full);
      } else {
        pending = full;
      }
    },
    flush() {
      if (pending === null) return;
      const full = pending;
      pending = null;
      lastEmit = now();
      emit(full);
    },
  };
}
