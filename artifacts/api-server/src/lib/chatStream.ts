/**
 * The pure half of /chat's streaming reply.
 *
 * Kept free of Express and the OpenAI client so `node --test` can load it:
 * the route hands this module an async iterable of chunks and a writer, and
 * gets back the full text and the usage, or the fact that the client went
 * away. Everything that needs a socket or a model stays in routes/chat.ts.
 *
 * Protocol (one JSON object per `data:` line, blank line between events):
 *   {"type":"delta","text":"…"}            — each chunk with content
 *   {"type":"done","content":"<full>"}     — the model finished
 *   {"type":"error","code":"…","message":"…"} — a failure after headers went out
 * Refusals decided before the first byte (quota, live mode, bad body) are
 * still plain JSON with their status codes — see routes/chat.ts.
 */

export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; content: string }
  | { type: "error"; code: string; message: string };

export type StreamChunk = {
  choices?: { delta?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
};

export type StreamUsage = { prompt_tokens?: number; completion_tokens?: number };

/** One SSE frame. JSON never contains a raw newline, so one `data:` line is enough. */
export function sseFrame(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Whether the caller asked for a stream. Only a client that names
 * `text/event-stream` gets one; every older bundle and binary sends
 * `application/json` (or nothing) and keeps today's JSON reply.
 */
export function wantsEventStream(accept: string | undefined): boolean {
  return typeof accept === "string" && /text\/event-stream/i.test(accept);
}

/**
 * A spend estimate for a turn whose usage chunk never arrived — the client
 * hung up first. Three characters per token overstates Arabic and English
 * alike, which is the right direction for a guard on a shared budget.
 */
export function estimateTokens(textOrChars: string | number): number {
  const chars = typeof textOrChars === "number" ? textOrChars : textOrChars.length;
  return Math.ceil(chars / 3);
}

/**
 * Forward model chunks as frames until the stream ends or the client goes.
 *
 * `signal` is the request's: the route aborts it when the response closes.
 * An `AbortError` from the iterator after that is the upstream call being
 * cancelled, which is expected. Any error thrown once the signal is aborted
 * is folded into "aborted" too: the client is gone, so there is nobody to
 * tell and nothing to distinguish.
 *
 * Any other error is NOT thrown: it comes back as `error`, alongside the text
 * generated so far, so the route can still record the spend for tokens that
 * were billed before the failure and then turn the error into a frame.
 * `error` is absent on success and on abort.
 */
export async function pumpChatStream(
  chunks: AsyncIterable<StreamChunk>,
  sink: { write(frame: string): void },
  signal: AbortSignal,
): Promise<{ content: string; usage: StreamUsage | null; aborted: boolean; error?: unknown }> {
  let content = "";
  let usage: StreamUsage | null = null;
  try {
    for await (const chunk of chunks) {
      if (signal.aborted) return { content, usage: null, aborted: true };
      const text = chunk.choices?.[0]?.delta?.content;
      if (text) {
        content += text;
        sink.write(sseFrame({ type: "delta", text }));
      }
      if (chunk.usage) usage = chunk.usage;
    }
  } catch (err) {
    if (signal.aborted || (err instanceof Error && err.name === "AbortError")) {
      return { content, usage: null, aborted: true };
    }
    return { content, usage: null, aborted: false, error: err };
  }
  if (signal.aborted) return { content, usage: null, aborted: true };
  sink.write(sseFrame({ type: "done", content }));
  return { content, usage, aborted: false };
}
