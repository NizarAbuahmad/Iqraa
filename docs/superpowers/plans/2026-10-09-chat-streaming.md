# Chat Streaming with Cancel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The chat reply appears word by word as the model writes it, and a Stop button in the composer ends it early while keeping what arrived.

**Architecture:** `POST /chat` keeps its JSON reply by default and streams Server-Sent Events when the request carries `Accept: text/event-stream`; a pure `pumpChatStream` in `lib/chatStream.ts` turns the OpenAI chunk iterator into frames and collects the full text and usage. On the client a pure SSE parser (`services/ai/sseParser.ts`) feeds a thin transport (`services/ai/chatStreamClient.ts`) built on `expo/fetch`, and `RemoteAIService.chat` grows an `onDelta` callback and an `AbortSignal`. The screen writes deltas into a placeholder assistant bubble and swaps Send for Stop while a remote reply is in flight.

**Tech Stack:** Express 5 + `openai` SDK v6 streaming (`stream: true`, `stream_options.include_usage`), Expo SDK 54 `expo/fetch`, React Native, `node --test` with `--experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-10-09-chat-streaming-design.md`

## Global Constraints

- **Backwards compatible.** A request without `Accept: text/event-stream` gets exactly today's `{ content }` JSON. The API deploys before the web bundle and days before any native binary (`docs/deploying.md`), so an old client must keep working against the new API, and a new client must keep working against the old API (a JSON body where a stream was asked for).
- **Pre-flight refusals stay JSON.** `live_mode_off` (503), `user_quota_exceeded` (429), `budget_exceeded` (429) and a bad body (400) are decided before any header is written, with the same `code` values as today, so `isCapError` / `aiErrorMessageKey` in `services/ai/aiProvenance.ts` need no change.
- **Spend is never under-recorded.** When the client disconnects before the usage chunk arrives, record an estimate that errs high: `estimateTokens(text) = Math.ceil(text.length / 3)` for both the prompt text and the streamed text.
- **Mobile tests live only in `artifacts/mobile/services/__tests__/`** and anything they import must not import `react-native`, `expo`, `expo-*` or `services/apiClient.ts` at module scope. Relative imports in files loaded by `node --test` need an explicit `.ts` extension (CLAUDE.md).
- **api-server tests live under `src/**/__tests__/**/*.test.ts`**, use `node:test`, and import with `.ts` extensions. Pure modules only; there is no supertest.
- **Demo mode is untouched.** `DEMO_MODE` branches in `iqra.tsx` and `RemoteAIService` keep their behaviour; streaming is reachable only when `EXPO_PUBLIC_DEMO_MODE=false` and the API has `AI_LIVE_MODE=true`.
- **Language.** New UI strings go in both the `ar` block (around line 740) and the `en` block (around line 2962) of `artifacts/mobile/services/i18n.ts`; `TranslationKey` is derived from `en`, so a key missing there is a type error.
- **Accessibility.** New pressables carry `accessibilityRole="button"` and an `accessibilityLabel` from `t()`.
- **Commit messages end with:**
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01FxD1GYFAX41tjnt9BCybcL`
- **No model identifiers** in commit messages, PR text, or code comments.

## File Structure

| Path | Responsibility |
| --- | --- |
| `artifacts/api-server/src/lib/chatStream.ts` (create) | Pure: event types, `sseFrame`, `wantsEventStream`, `estimateTokens`, `pumpChatStream`. No Express, no OpenAI import. |
| `artifacts/api-server/src/lib/__tests__/chatStream.test.ts` (create) | Tests for everything above with fake chunk iterators. |
| `artifacts/api-server/src/routes/chat.ts` (modify) | Content negotiation; the SSE branch; abort on client close; usage recording (real or estimated). |
| `artifacts/mobile/services/ai/sseParser.ts` (create) | Pure: `ChatStreamEvent`, `createSseParser` (handles chunks split mid-line), `createDeltaThrottle`. |
| `artifacts/mobile/services/__tests__/sseParser.test.ts` (create) | Tests for the parser and the throttle. |
| `artifacts/mobile/services/apiClient.ts` (modify) | `fetchImpl` option on `apiFetch`, so the streaming call keeps auth headers and the one 401 refresh-and-retry. |
| `artifacts/mobile/services/ai/chatStreamClient.ts` (create) | Thin transport: `expo/fetch`, body reader, idle timeout, JSON fallback. Not unit-tested (imports expo). |
| `artifacts/mobile/services/ai/RemoteAIService.ts` (modify) | `chat()` takes `{ signal, onDelta }` and returns `{ content, cancelled }`. |
| `artifacts/mobile/services/i18n.ts` (modify) | `iqraStop`, `iqraStopped`. |
| `artifacts/mobile/app/(tabs)/iqra.tsx` (modify) | Placeholder bubble, delta writes, Stop button, footer gating. |
| `STATUS.md` (modify) | One section recording what shipped and the deploy-window note. |

Task order: 1 → 2 (server, independently shippable) → 3 → 4 → 5 → 6 → 7 (client) → 8 (end-to-end check and docs).

---

### Task 1: Pure streaming helpers on the server

**Files:**
- Create: `artifacts/api-server/src/lib/chatStream.ts`
- Test: `artifacts/api-server/src/lib/__tests__/chatStream.test.ts`

**Interfaces:**
- Produces:
  - `type ChatStreamEvent = { type: "delta"; text: string } | { type: "done"; content: string } | { type: "error"; code: string; message: string }`
  - `sseFrame(event: ChatStreamEvent): string` → `data: <json>\n\n`
  - `wantsEventStream(accept: string | undefined): boolean`
  - `estimateTokens(textOrChars: string | number): number` — a number is a character count
  - `type StreamChunk = { choices?: { delta?: { content?: string | null } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } | null }`
  - `pumpChatStream(chunks: AsyncIterable<StreamChunk>, sink: { write(frame: string): void }, signal: AbortSignal): Promise<{ content: string; usage: { prompt_tokens?: number; completion_tokens?: number } | null; aborted: boolean }>`

- [ ] **Step 1: Write the failing tests**

```ts
// artifacts/api-server/src/lib/__tests__/chatStream.test.ts
/**
 * The pure half of /chat's streaming path: frame encoding, content
 * negotiation, the spend estimate used when a client disconnects before the
 * usage chunk, and the pump that turns OpenAI chunks into frames.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/chatStream.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  estimateTokens,
  pumpChatStream,
  sseFrame,
  wantsEventStream,
  type StreamChunk,
} from "../chatStream.ts";

async function* chunks(items: StreamChunk[]): AsyncIterable<StreamChunk> {
  for (const item of items) yield item;
}

function sink() {
  const frames: string[] = [];
  return { frames, write: (f: string) => { frames.push(f); } };
}

describe("sseFrame", () => {
  it("encodes one event as a data line followed by a blank line", () => {
    assert.equal(sseFrame({ type: "delta", text: "مرحبًا" }), 'data: {"type":"delta","text":"مرحبًا"}\n\n');
  });
  it("keeps newlines inside the JSON string, never as raw line breaks", () => {
    const frame = sseFrame({ type: "delta", text: "a\nb" });
    assert.equal(frame.split("\n").length, 3, "one data line + two terminators");
    assert.ok(frame.includes("\\n"));
  });
});

describe("wantsEventStream", () => {
  it("is true for text/event-stream, whatever else Accept lists", () => {
    assert.equal(wantsEventStream("text/event-stream"), true);
    assert.equal(wantsEventStream("application/json, text/event-stream;q=0.9"), true);
    assert.equal(wantsEventStream("TEXT/EVENT-STREAM"), true);
  });
  it("is false for a missing or JSON-only Accept header", () => {
    assert.equal(wantsEventStream(undefined), false);
    assert.equal(wantsEventStream("application/json"), false);
    assert.equal(wantsEventStream("*/*"), false);
  });
});

describe("estimateTokens", () => {
  it("errs high: three characters per token, rounded up", () => {
    assert.equal(estimateTokens(""), 0);
    assert.equal(estimateTokens("ab"), 1);
    assert.equal(estimateTokens("abcd"), 2);
    assert.equal(estimateTokens("الاقتران العكسي"), 5);
  });
  it("takes a character count for a prompt made of several strings", () => {
    assert.equal(estimateTokens(0), 0);
    assert.equal(estimateTokens(7), 3);
  });
});

describe("pumpChatStream", () => {
  it("writes one delta frame per content chunk, then a done frame with the whole text", async () => {
    const s = sink();
    const result = await pumpChatStream(
      chunks([
        { choices: [{ delta: { content: "الاقتران " } }] },
        { choices: [{ delta: { content: "العكسي" } }] },
        { choices: [], usage: { prompt_tokens: 40, completion_tokens: 6 } },
      ]),
      s,
      new AbortController().signal,
    );
    assert.deepEqual(result, {
      content: "الاقتران العكسي",
      usage: { prompt_tokens: 40, completion_tokens: 6 },
      aborted: false,
    });
    assert.deepEqual(s.frames, [
      sseFrame({ type: "delta", text: "الاقتران " }),
      sseFrame({ type: "delta", text: "العكسي" }),
      sseFrame({ type: "done", content: "الاقتران العكسي" }),
    ]);
  });

  it("skips chunks with empty or null content and chunks with no choices", async () => {
    const s = sink();
    const result = await pumpChatStream(
      chunks([
        { choices: [{ delta: { content: null } }] },
        { choices: [{ delta: { content: "" } }] },
        { choices: [{ delta: {} }] },
        { choices: [{ delta: { content: "x" } }] },
      ]),
      s,
      new AbortController().signal,
    );
    assert.equal(result.content, "x");
    assert.equal(result.usage, null);
    assert.equal(s.frames.length, 2, "one delta + done");
  });

  it("stops writing once the signal is aborted and reports what arrived", async () => {
    const s = sink();
    const controller = new AbortController();
    async function* aborting(): AsyncIterable<StreamChunk> {
      yield { choices: [{ delta: { content: "أ" } }] };
      controller.abort();
      yield { choices: [{ delta: { content: "ب" } }] };
      yield { choices: [], usage: { prompt_tokens: 1, completion_tokens: 2 } };
    }
    const result = await pumpChatStream(aborting(), s, controller.signal);
    assert.deepEqual(result, { content: "أ", usage: null, aborted: true });
    assert.deepEqual(s.frames, [sseFrame({ type: "delta", text: "أ" })], "no done frame after abort");
  });

  it("treats an AbortError thrown by the iterator as an abort, not a failure", async () => {
    const s = sink();
    const controller = new AbortController();
    async function* throwing(): AsyncIterable<StreamChunk> {
      yield { choices: [{ delta: { content: "أ" } }] };
      controller.abort();
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }
    const result = await pumpChatStream(throwing(), s, controller.signal);
    assert.deepEqual(result, { content: "أ", usage: null, aborted: true });
  });

  it("rethrows any other iterator error", async () => {
    async function* failing(): AsyncIterable<StreamChunk> {
      yield { choices: [{ delta: { content: "أ" } }] };
      throw new Error("upstream 500");
    }
    await assert.rejects(
      () => pumpChatStream(failing(), sink(), new AbortController().signal),
      /upstream 500/,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test artifacts/api-server/src/lib/__tests__/chatStream.test.ts`
Expected: FAIL with `Cannot find module '../chatStream.ts'`

- [ ] **Step 3: Write the implementation**

```ts
// artifacts/api-server/src/lib/chatStream.ts
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
 * cancelled, which is expected; any other error is rethrown for the route
 * to turn into an error frame.
 */
export async function pumpChatStream(
  chunks: AsyncIterable<StreamChunk>,
  sink: { write(frame: string): void },
  signal: AbortSignal,
): Promise<{ content: string; usage: StreamUsage | null; aborted: boolean }> {
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
    throw err;
  }
  if (signal.aborted) return { content, usage: null, aborted: true };
  sink.write(sseFrame({ type: "done", content }));
  return { content, usage, aborted: false };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types --test artifacts/api-server/src/lib/__tests__/chatStream.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Typecheck and commit**

Run: `cd artifacts/api-server && pnpm typecheck`
Expected: no errors.

```bash
git add artifacts/api-server/src/lib/chatStream.ts artifacts/api-server/src/lib/__tests__/chatStream.test.ts
git commit -m "api: pure helpers for a streamed /chat reply

Frame encoding, Accept negotiation, a spend estimate for a turn the client
abandoned, and the pump that turns model chunks into frames. No route change
yet.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxD1GYFAX41tjnt9BCybcL"
```

---

### Task 2: `/chat` streams when asked, keeps JSON otherwise

**Files:**
- Modify: `artifacts/api-server/src/routes/chat.ts` (whole handler; today lines 32–124)

**Interfaces:**
- Consumes: `sseFrame`, `wantsEventStream`, `estimateTokens`, `pumpChatStream` from Task 1.
- Produces: `POST /chat` with `Accept: text/event-stream` → `200 text/event-stream` body of frames; otherwise unchanged `{ content }`.

- [ ] **Step 1: Replace the handler body**

Replace everything from `chatRouter.post("/chat", …` to the end of that handler with the version below. The imports at the top of the file gain one line:

```ts
import { estimateTokens, pumpChatStream, sseFrame, wantsEventStream } from "../lib/chatStream.ts";
```

Handler:

```ts
/**
 * POST /chat
 * IQRA conversational assistant — grounded by knowledge-base context
 * from the mobile client.
 *
 * Two reply shapes, chosen by the request's Accept header:
 *   - `text/event-stream` → frames as the model writes (lib/chatStream.ts).
 *   - anything else       → `{ content }` once the model is done, as before.
 * The JSON shape stays because the API deploys before the web bundle and
 * days before any native binary; a client that does not ask for a stream
 * must keep getting what it got.
 *
 * Every refusal (bad body, live mode off, a cap) is decided before the first
 * byte, so it is plain JSON with a status code in both shapes.
 */
chatRouter.post("/chat", async (req: AuthenticatedRequest, res) => {
  const streaming = wantsEventStream(req.get("accept"));
  let headersSent = false;
  let clientGone = false;
  try {
    const { messages, context, mode, language } = req.body as {
      messages: { role: string; content: string }[];
      context?: string;
      mode?: "teacher" | "student";
      language?: "ar" | "en";
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }

    const isArabic = language === "ar";
    const isTeacher = mode !== "student";

    // Clamped here, at the boundary, rather than inside the prompt builders:
    // this is where caller-supplied text enters, and both builders and every
    // future one are covered by capping it once on the way in.
    const groundedContext = clampPromptText(context, CHAT_CONTEXT_MAX_CHARS);
    const systemPrompt = isArabic
      ? buildSystemPromptAr(isTeacher, groundedContext)
      : buildSystemPromptEn(isTeacher, groundedContext);

    const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-CHAT_HISTORY_TURNS).map((m) => ({
        role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: clampPromptText(String(m.content ?? ""), CHAT_MESSAGE_MAX_CHARS),
      })),
    ];

    assertLiveModeEnabled();
    // Keyed on the signed-in account, and on its role: students draw on
    // AI_STUDENT_BUDGET_USD, everyone else on AI_USER_BUDGET_USD. There is no
    // pooled fallback here as there is for generation — a chat turn is unique
    // to its conversation and can never be served from the shared pool, so
    // every turn is a live call and a refusal is the only option a cap has.
    //
    // `mode` from the body is NOT the identity used here. It selects the prompt
    // and a student's client could send either value; the role on the verified
    // session is the one that decides whose allowance pays.
    await assertUserQuotaAvailable(req.user?.id, req.user?.role);
    assertBudgetAvailable();

    const model = getChatModel();
    const detail = {
      kind: isTeacher ? ("chat-teacher" as const) : ("chat-student" as const),
      promptVersion: PROMPT_VERSION,
      userId: req.user?.id,
    };
    const startedAt = Date.now();

    if (!streaming) {
      const completion = await openai.chat.completions.create({
        model,
        max_completion_tokens: CHAT_MAX_TOKENS,
        messages: chatMessages,
      });
      // No cache keys on purpose. A chat turn never repeats, so any key computed
      // here would be the same for every turn and would show up in the repeat-rate
      // analysis as a workload with a perfect hit rate — the opposite of the truth.
      // The `kind` is what earns its place: it separates chat's share of spend
      // from generation's.
      recordUsage(completion.usage, model, { ...detail, durationMs: Date.now() - startedAt });
      res.json({ content: completion.choices[0]?.message?.content ?? "" });
      return;
    }

    // The teacher pressed Stop, or the app went away: cancel the upstream
    // call so the model stops generating tokens we pay for and nobody reads.
    // `close` also fires after a normal end, hence the `writableFinished` check.
    const upstream = new AbortController();
    res.on("close", () => {
      if (res.writableFinished) return;
      clientGone = true;
      upstream.abort();
    });

    const stream = await openai.chat.completions.create(
      {
        model,
        max_completion_tokens: CHAT_MAX_TOKENS,
        messages: chatMessages,
        stream: true,
        stream_options: { include_usage: true },
      },
      { signal: upstream.signal },
    );

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    // Tells nginx-style proxies not to buffer; harmless on Cloud Run.
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    headersSent = true;

    const result = await pumpChatStream(stream, res, upstream.signal);
    const durationMs = Date.now() - startedAt;

    if (result.usage) {
      recordUsage(result.usage, model, { ...detail, durationMs });
    } else {
      // The client hung up before the usage chunk. OpenAI still bills the
      // tokens generated up to the abort, so the ledger must move: an estimate
      // that errs high (lib/chatStream.ts) rather than nothing at all.
      const promptChars = chatMessages.reduce((n, m) => n + m.content.length, 0);
      recordUsage(
        { prompt_tokens: estimateTokens(promptChars), completion_tokens: estimateTokens(result.content) },
        model,
        { ...detail, durationMs },
      );
      logger.info({ userId: req.user?.id, streamedChars: result.content.length }, "chat stream abandoned by client");
    }
    res.end();
  } catch (err) {
    // The client left while the upstream call was still connecting: there
    // is nobody to answer, and the abort is the expected outcome, not an
    // error. (Only the streaming branch sets this.)
    if (clientGone) {
      logger.info({ userId: req.user?.id }, "chat stream abandoned before first byte");
      return;
    }
    // After the first frame there is no status code left to send; the error
    // travels as a frame and the client shows what it already has.
    if (headersSent) {
      logger.error({ err }, "chat stream error");
      if (!res.writableEnded) {
        res.write(sseFrame({ type: "error", code: "stream_failed", message: "AI service error. Please try again." }));
        res.end();
      }
      return;
    }
    // Each carries a `code`, as evaluations.ts and generate.ts do: the API
    // answers in English, the app is Arabic, and the code is the only thing the
    // client can translate from without matching on message text.
    if (err instanceof AiLiveModeOffError) {
      res.status(503).json({ error: err.message, code: "live_mode_off" });
      return;
    }
    if (err instanceof AiUserQuotaExceededError) {
      res.status(429).json({ error: err.message, code: "user_quota_exceeded" });
      return;
    }
    if (err instanceof AiBudgetExceededError) {
      res.status(429).json({ error: err.message, code: "budget_exceeded" });
      return;
    }
    logger.error({ err }, "chat error");
    res.status(500).json({ error: "AI service error. Please try again." });
  }
});
```

- [ ] **Step 2: Typecheck, build, and run the api-server suite**

Run: `cd artifacts/api-server && pnpm typecheck && pnpm build && pnpm test`
Expected: typecheck clean; all tests pass, including `src/routes/__tests__/mountOrder.test.ts` (the route is still mounted under `/chat` behind `authMiddleware` and `chatLimiter` in `routes/index.ts`; nothing there changes).

If `stream_options` is rejected by the type of `create`, the `openai` package is older than 4.47: check `pnpm ls openai` from `lib/integrations-openai-ai-server`; the workspace pins `^6.27.0`, which has it.

- [ ] **Step 3: Verify both shapes against a local API**

Start the API with live mode on (see `LOCAL_SETUP.md` for `OPENAI_API_KEY`, `AI_LIVE_MODE=true`, and how to obtain a bearer token for a local account; `pnpm run dev:api` serves on :8080).

JSON shape, unchanged:

```bash
curl -s http://localhost:8080/api/chat \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"ما هو الاقتران العكسي؟"}],"language":"ar","mode":"teacher"}'
```
Expected: one JSON object `{"content":"…"}` after the full wait.

Streamed shape:

```bash
curl -N -s http://localhost:8080/api/chat \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"messages":[{"role":"user","content":"ما هو الاقتران العكسي؟"}],"language":"ar","mode":"teacher"}'
```
Expected: `data: {"type":"delta",…}` lines arriving over several seconds, then one `data: {"type":"done","content":"…"}` and the connection closes. The API log shows `ai spend updated` once with real usage.

Abandon test: run the streamed command again and press Ctrl-C after the first lines. Expected in the API log: `chat stream abandoned by client` followed by `ai spend updated`.

Refusal shape with `Accept: text/event-stream` and `AI_LIVE_MODE` unset: expected `503 {"error":…,"code":"live_mode_off"}` as JSON, not a frame.

- [ ] **Step 4: Commit**

```bash
git add artifacts/api-server/src/routes/chat.ts
git commit -m "api: /chat streams its reply when the client asks for text/event-stream

Clients that do not send the Accept header keep the JSON body, so bundles
and binaries built before this keep working through the deploy window.
A client that disconnects cancels the upstream call, and the spend is
recorded from an estimate that errs high when the usage chunk never came.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxD1GYFAX41tjnt9BCybcL"
```

---

### Task 3: Pure SSE parser and delta throttle on the client

**Files:**
- Create: `artifacts/mobile/services/ai/sseParser.ts`
- Test: `artifacts/mobile/services/__tests__/sseParser.test.ts`

**Interfaces:**
- Produces:
  - `type ChatStreamEvent` (same three shapes as the server's)
  - `createSseParser(): { push(text: string): ChatStreamEvent[]; flush(): ChatStreamEvent[] }`
  - `createDeltaThrottle(emit: (full: string) => void, intervalMs: number, now?: () => number): { push(full: string): void; flush(): void }`

- [ ] **Step 1: Write the failing tests**

```ts
// artifacts/mobile/services/__tests__/sseParser.test.ts
/**
 * The chat's stream reader, minus the network: frames arrive as text chunks
 * cut anywhere — mid-line, mid-JSON, several events in one chunk — and the
 * parser must hand back whole events and nothing else. The throttle keeps a
 * 1200-token reply from re-rendering the bubble on every token.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createDeltaThrottle, createSseParser } from '../ai/sseParser.ts';

describe('createSseParser', () => {
  it('parses one complete event', () => {
    const p = createSseParser();
    assert.deepEqual(p.push('data: {"type":"delta","text":"مرحبًا"}\n\n'), [
      { type: 'delta', text: 'مرحبًا' },
    ]);
  });

  it('holds a partial line until the rest arrives', () => {
    const p = createSseParser();
    assert.deepEqual(p.push('data: {"type":"delta","te'), []);
    assert.deepEqual(p.push('xt":"أ"}\n'), []);
    assert.deepEqual(p.push('\n'), [{ type: 'delta', text: 'أ' }]);
  });

  it('returns several events from one chunk, in order', () => {
    const p = createSseParser();
    const events = p.push(
      'data: {"type":"delta","text":"a"}\n\ndata: {"type":"delta","text":"b"}\n\ndata: {"type":"done","content":"ab"}\n\n',
    );
    assert.deepEqual(events, [
      { type: 'delta', text: 'a' },
      { type: 'delta', text: 'b' },
      { type: 'done', content: 'ab' },
    ]);
  });

  it('accepts CRLF line endings', () => {
    const p = createSseParser();
    assert.deepEqual(p.push('data: {"type":"delta","text":"x"}\r\n\r\n'), [{ type: 'delta', text: 'x' }]);
  });

  it('ignores comments, unknown fields, blank events and malformed JSON', () => {
    const p = createSseParser();
    const events = p.push(': keep-alive\n\nevent: ping\n\ndata: not json\n\ndata: {"type":"delta","text":"ok"}\n\n');
    assert.deepEqual(events, [{ type: 'delta', text: 'ok' }]);
  });

  it('drops an event whose type is not one of the three', () => {
    const p = createSseParser();
    assert.deepEqual(p.push('data: {"type":"usage","tokens":3}\n\n'), []);
  });

  it('flush() yields an event that ended without the trailing blank line', () => {
    const p = createSseParser();
    assert.deepEqual(p.push('data: {"type":"done","content":"end"}'), []);
    assert.deepEqual(p.flush(), [{ type: 'done', content: 'end' }]);
    assert.deepEqual(p.flush(), []);
  });
});

describe('createDeltaThrottle', () => {
  it('emits the first value at once, coalesces within the interval, flushes the last', () => {
    let clock = 1000;
    const seen: string[] = [];
    const th = createDeltaThrottle(full => seen.push(full), 80, () => clock);
    th.push('a');
    th.push('ab');            // 0ms later: held
    clock += 50; th.push('abc'); // still inside the window: held, replaces 'ab'
    clock += 40; th.push('abcd'); // 90ms since first emit: emitted
    th.push('abcde');          // held
    th.flush();                // emitted
    th.flush();                // nothing pending: silent
    assert.deepEqual(seen, ['a', 'abcd', 'abcde']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/sseParser.test.ts`
Expected: FAIL with `Cannot find module '../ai/sseParser.ts'`

- [ ] **Step 3: Write the implementation**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/sseParser.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/ai/sseParser.ts artifacts/mobile/services/__tests__/sseParser.test.ts
git commit -m "mobile: SSE parser and delta throttle for the chat stream

Pure, so node --test covers chunks cut mid-line and several events per
chunk. No caller yet.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxD1GYFAX41tjnt9BCybcL"
```

---

### Task 4: `apiFetch` can run on a caller-supplied fetch

**Files:**
- Modify: `artifacts/mobile/services/apiClient.ts:178-211`

**Interfaces:**
- Produces: `ApiOptions = RequestInit & { timeoutMs?: number; fetchImpl?: typeof fetch }`; `apiFetch(path, options)` uses `fetchImpl` when given and otherwise behaves exactly as today.

Why: `apiFetch` is where the bearer token, the origin headers and the single 401 refresh-and-retry live. The stream needs all three, but React Native's global `fetch` has no readable body, so the stream must run on `expo/fetch`. Rather than duplicate the auth logic, let the caller supply the fetch.

- [ ] **Step 1: Make the change**

Replace the `ApiOptions` type and the first lines of `apiFetch`:

```ts
/**
 * `timeoutMs` overrides the 15s default for the handful of routes that call a
 * model and legitimately run longer. Everything else is a database read.
 *
 * `fetchImpl` swaps the transport. The only caller today is the chat stream
 * (`services/ai/chatStreamClient.ts`), which needs `expo/fetch` for a
 * readable body on native; it brings its own `signal`, so no timer is armed
 * here — the same rule `fetchWithTimeout` already applies to a signal.
 */
export type ApiOptions = RequestInit & { timeoutMs?: number; fetchImpl?: typeof fetch };

export async function apiFetch(
  path: string,
  options: ApiOptions = {},
  retry = true,
): Promise<Response> {
  const { timeoutMs, fetchImpl, ...init } = options;
  const accessToken = await getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...originHeaders(),
    ...(init.headers as Record<string, string> ?? {}),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const url = `${getApiBaseUrl()}${path}`;
  const res = fetchImpl
    ? await fetchImpl(url, { ...init, headers })
    : await fetchWithTimeout(url, { ...init, headers }, timeoutMs);
```

The rest of the function is unchanged; the recursive `apiFetch(path, options, false)` already passes `options` through, so the retry after a refresh keeps `fetchImpl`.

- [ ] **Step 2: Typecheck**

Run: `cd artifacts/mobile && pnpm typecheck`
Expected: clean. (`apiClient.ts` is not loadable by `node --test`, so there is no unit test for this; Task 8 exercises it end to end.)

- [ ] **Step 3: Commit**

```bash
git add artifacts/mobile/services/apiClient.ts
git commit -m "mobile: apiFetch accepts a caller-supplied fetch

So the chat stream can run on expo/fetch and still get the bearer token
and the 401 refresh-and-retry.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxD1GYFAX41tjnt9BCybcL"
```

---

### Task 5: The streaming transport and `RemoteAIService.chat`

**Files:**
- Create: `artifacts/mobile/services/ai/chatStreamClient.ts`
- Modify: `artifacts/mobile/services/ai/RemoteAIService.ts:275-305` (the `chat` method)

**Interfaces:**
- Consumes: `createSseParser`, `createDeltaThrottle` (Task 3); `apiFetch`, `ApiError` from `services/apiClient.ts` (Task 4).
- Produces:
  - `streamChat(params: ChatParams, opts: { signal: AbortSignal; onDelta: (full: string) => void }): Promise<{ content: string; cancelled: boolean }>`
  - `RemoteAIService.chat(params: ChatParams, opts?: { signal?: AbortSignal; onDelta?: (full: string) => void }): Promise<{ content: string; cancelled: boolean }>`
  - `type ChatParams = { messages: { role: string; content: string }[]; context?: string; mode: 'teacher' | 'student'; language: 'ar' | 'en' }`

- [ ] **Step 1: Confirm `expo/fetch` resolves**

Run: `cd artifacts/mobile && node -e "console.log(require.resolve('expo/fetch'))"`
Expected: a path under `node_modules/expo/`. If it does not resolve, run `pnpm install` at the repo root first; Expo SDK 52+ ships this entry point and the app is on SDK 54.

Also confirm the runtime polyfills `TextDecoder` on native, which the reader below needs:

Run: `grep -rl "TextDecoder" artifacts/mobile/node_modules/expo/src/winter | head -3`
Expected: at least one file. If none, add `import 'text-encoding';` is **not** the fix — report it, because the reader would then need a hand-rolled UTF-8 decoder and the plan should be revisited.

- [ ] **Step 2: Write the transport**

```ts
// artifacts/mobile/services/ai/chatStreamClient.ts
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
    let doneContent: string | null = null;
    let streamError: { code: string; message: string } | null = null;

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
```

- [ ] **Step 3: Rewire `RemoteAIService.chat`**

Replace the `chat` method (the doc comment and body, today lines 275–305) with:

```ts
  /**
   * Chat with iQra. In Demo Mode this throws so callers use local KB text.
   *
   * Streams: `onDelta` receives the reply so far, at most every 80 ms, and
   * `signal` ends the turn early — the result then says `cancelled` and
   * carries the text that had arrived. No mock fallback here — the chat
   * screen has its own local answer path and catches. It still records the
   * failure, so the badge reports it: a knowledge-base answer and a model
   * answer read alike to a teacher.
   */
  async chat(
    params: ChatParams,
    opts: { signal?: AbortSignal; onDelta?: (full: string) => void } = {},
  ): Promise<{ content: string; cancelled: boolean }> {
    if (DEMO_MODE) {
      recordGeneration({ kind: 'chat', source: 'mock', reason: 'demo-mode', at: Date.now() });
      // Prefer grounding text already built by the chat screen.
      if (params.context?.trim()) return { content: params.context.trim(), cancelled: false };
      throw new Error('Demo Mode: local KB only');
    }
    try {
      const out = await streamChat(params, {
        signal: opts.signal ?? new AbortController().signal,
        onDelta: opts.onDelta ?? (() => {}),
      });
      recordGeneration({ kind: 'chat', source: 'live', reason: 'live', at: Date.now() });
      return out;
    } catch (e) {
      recordGeneration({
        kind: 'chat', source: 'none', reason: 'failed',
        error: describeAiError(e), at: Date.now(),
      });
      throw e;
    }
  }
```

Add the import near the other `./` imports at the top of the file:

```ts
import { streamChat, type ChatParams } from './chatStreamClient';
```

`postJSON` stays for the generators.

- [ ] **Step 4: Find every caller of `chat(` and confirm the screen is the only one**

Run: `grep -rn "remoteAIService.chat(\|\.chat({" artifacts/mobile --include=*.ts --include=*.tsx | grep -v node_modules`
Expected: exactly one hit, `app/(tabs)/iqra.tsx` around line 2725. It is updated in Task 7; until then `pnpm typecheck` reports that one site (`string` vs `{ content, cancelled }`), which is expected at this step.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/ai/chatStreamClient.ts artifacts/mobile/services/ai/RemoteAIService.ts
git commit -m "mobile: stream the chat reply over expo/fetch, with cancel

RemoteAIService.chat now reports the reply as it arrives and returns the
text plus whether the caller stopped it. A JSON body from an API that does
not stream yet is still accepted whole.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxD1GYFAX41tjnt9BCybcL"
```

---

### Task 6: The two new strings

**Files:**
- Modify: `artifacts/mobile/services/i18n.ts` (ar block near line 740, en block near line 2962)

- [ ] **Step 1: Add the keys**

In the `ar` block, directly after `iqraChatBusy`:

```ts
    iqraStop: 'أوقف',
    iqraStopped: 'توقّف الرد عند هذا الحد.',
```

In the `en` block, directly after `iqraChatBusy`:

```ts
    iqraStop: 'Stop',
    iqraStopped: 'Stopped here.',
```

- [ ] **Step 2: Typecheck**

Run: `cd artifacts/mobile && pnpm typecheck`
Expected: the only remaining error is the `chat(` call site in `iqra.tsx` from Task 5 (fixed next).

- [ ] **Step 3: Commit**

```bash
git add artifacts/mobile/services/i18n.ts
git commit -m "mobile: strings for stopping a chat reply

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxD1GYFAX41tjnt9BCybcL"
```

---

### Task 7: The screen renders the stream and offers Stop

**Files:**
- Modify: `artifacts/mobile/app/(tabs)/iqra.tsx` — state near line 1413, the remote branch at 2723–2790, the assistant append at 2811–2830, the outer `catch`/`finally` at 2882–2900, the footer at 3778–3790, the send button at 3996–4015.

**Interfaces:**
- Consumes: `remoteAIService.chat(params, { signal, onDelta })` → `{ content, cancelled }` (Task 5); `t('iqraStop')`, `t('iqraStopped')` (Task 6).

- [ ] **Step 1: Add state and the stop handler**

Next to `const [isThinking, setIsThinking] = useState(false);` (line 1413) add:

```tsx
  /**
   * The assistant bubble being filled by a streamed reply, if any. While set
   * the thinking footer is hidden — the bubble is the progress indicator.
   */
  const [streamingId, setStreamingId] = useState<string | null>(null);
  /** Stop is offered only while a remote reply can be stopped. */
  const [canStop, setCanStop] = useState(false);
```

Next to `const thinkingRef = useRef(false);` (line 1517) add:

```tsx
  const abortRef = useRef<AbortController | null>(null);
```

After the `useEffect` that keeps `teachingCtxRef` current (line ~1849) add:

```tsx
  const stopReply = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {});
    abortRef.current?.abort();
  }, []);

  // A reply still streaming when the screen goes should not keep a socket
  // open — nor keep the API generating tokens nobody will read.
  useEffect(() => () => abortRef.current?.abort(), []);
```

- [ ] **Step 2: Declare the placeholder id in `sendMessage`'s outer scope**

Immediately after `let quickTopic: string | undefined;` (line ~2460, in the block of `let` declarations before `runTeachingAssistant`) add:

```tsx
      // Set when the remote path has put an empty assistant bubble on screen
      // to stream into; the final message replaces it instead of appending.
      let streamedId: string | null = null;
```

- [ ] **Step 3: Replace the remote branch**

Replace the block that begins `} else {` at line 2723 and ends with the closing `}` of `catch (remoteErr) { … }` (line ~2790) with:

```tsx
      } else {
        // Stream into an empty bubble so the first words show as they come.
        // The id scheme matches the rest of the file; the message is replaced
        // by the final one below, never left as a second copy.
        streamedId = (Date.now() + 1).toString();
        const placeholderId = streamedId;
        const controller = new AbortController();
        abortRef.current = controller;
        setCanStop(true);
        setStreamingId(placeholderId);
        setMessages(prev => [...prev, { id: placeholderId, role: 'assistant', text: '', timestamp: new Date() }]);
        let streamed = '';
        try {
          const out = await remoteAIService.chat(
            { messages: history, context: kbContext, mode, language: lang as 'ar' | 'en' },
            {
              signal: controller.signal,
              onDelta: full => {
                streamed = full;
                setMessages(prev => prev.map(m => (m.id === placeholderId ? { ...m, text: full } : m)));
              },
            },
          );
          responseText = out.content;
          if (out.cancelled) {
            if (!responseText.trim()) {
              // Stopped before a word arrived: nothing to keep. Drop the
              // bubble and put the question back so retrying is one tap.
              setMessages(prev => prev.filter(m => m.id !== placeholderId));
              streamedId = null;
              setInput(prev => prev || shown);
              return;
            }
            showToast(t('iqraStopped'));
          } else if (!responseText.trim()) {
            const ta = runTeachingAssistant();
            responseText = ta.text || t('iqraNoResults');
            teachingActions = ta.actions;
            if (ta.activeLesson) {
              lessonTopic = lang === 'ar' ? ta.activeLesson.titleAr : ta.activeLesson.titleEn;
              quickTopic = lessonTopic;
            } else if (hasDocs) {
              quickTopic = primaryTopicFromDocuments(docBundle.documents, docNames[0] || q);
              lessonTopic = quickTopic;
            }
            setSessionMemory(prev => {
              let next = { ...prev, ...ta.memoryPatch };
              if (pendingHardPin) next = pinLesson(next, pendingHardPin, 'hard');
              return next;
            });
          } else if (results[0]) {
            lessonTopic = lang === 'ar' ? results[0].titleAr : results[0].titleEn;
            quickTopic = lessonTopic;
            if (pendingHardPin) {
              setSessionMemory(prev => pinLesson(prev, pendingHardPin, 'hard'));
            }
          } else if (hasDocs) {
            quickTopic = primaryTopicFromDocuments(docBundle.documents, docNames[0] || q);
            lessonTopic = quickTopic;
          }
        } catch (remoteErr) {
          console.error('[iqra chat] remote AI failed', remoteErr);
          if (streamed.trim()) {
            // The connection died mid-reply. What arrived is real model text;
            // keep it and say the turn did not finish, rather than replace it
            // with a local answer that reads as if the model wrote it.
            responseText = streamed;
            showToast(t('iqraChatError'));
          } else if (isCapError(remoteErr)) {
            // Quota spent or live mode off: say so. This used to fall through
            // to the local knowledge-base reply below under «تحقق من
            // الإنترنت», so a teacher whose allowance was gone got an answer
            // that read like the AI's, with a message blaming their network.
            responseText = t(aiErrorMessageKey(remoteErr));
          } else {
            const ta = runTeachingAssistant();
            responseText = ta.text || t('iqraOfflineFallback');
            teachingActions = ta.actions;
            if (ta.activeLesson) {
              lessonTopic = lang === 'ar' ? ta.activeLesson.titleAr : ta.activeLesson.titleEn;
              quickTopic = lessonTopic;
            } else if (hasDocs) {
              quickTopic = primaryTopicFromDocuments(docBundle.documents, docNames[0] || q);
              lessonTopic = quickTopic;
            }
            setSessionMemory(prev => {
              let next = { ...prev, ...ta.memoryPatch };
              if (pendingHardPin) next = pinLesson(next, pendingHardPin, 'hard');
              return next;
            });
          }
        } finally {
          abortRef.current = null;
          setCanStop(false);
        }
      }
```

The `history`, `kbContext`, `mode`, `results`, `hasDocs`, `docBundle`, `docNames`, `pendingHardPin` and `runTeachingAssistant` names already exist in this scope; the three `else if` branches and the `catch` fallbacks are the existing code, kept verbatim apart from the new `streamed` guard and the `cancelled` branch.

- [ ] **Step 4: Make the final message replace the placeholder**

Change the assistant message construction (line ~2811) so its id is the placeholder's when there is one:

```tsx
      const assistantMsg: Message = {
        id: streamedId ?? (Date.now() + 1).toString(),
```

and replace `setMessages(prev => [...prev, assistantMsg]);` (line ~2830) with:

```tsx
      setMessages(prev =>
        streamedId && prev.some(m => m.id === streamedId)
          ? prev.map(m => (m.id === streamedId ? assistantMsg : m))
          : [...prev, assistantMsg],
      );
```

- [ ] **Step 5: Clear the placeholder on the outer failure path, and reset state in `finally`**

In the outer `catch (err)` (line ~2882), change the append so a half-filled bubble is not left above the error:

```tsx
        setMessages(prev => [...prev.filter(m => !streamedId || m.id !== streamedId), errMsg]);
```

In the outer `finally` (line ~2895), after `setThinkingLabel('');` add:

```tsx
        setStreamingId(null);
```

- [ ] **Step 6: Hide the thinking footer once text is streaming**

Change the footer condition (line ~3779) from `isThinking ? (` to:

```tsx
          isThinking && !streamingId ? (
```

- [ ] **Step 7: Swap Send for Stop while a reply can be stopped**

Replace the send `Pressable` (lines ~3996–4015) with:

```tsx
          {canStop ? (
            <Pressable
              onPress={stopReply}
              accessibilityRole="button"
              accessibilityLabel={t('iqraStop')}
              hitSlop={3}
              style={({ pressed }) => [
                styles.sendBtn,
                { backgroundColor: colors.foreground, borderRadius: 20, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="stop" size={16} color={colors.background} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => sendMessage(input)}
              disabled={!input.trim() || isThinking}
              accessibilityRole="button"
              accessibilityLabel={t('iqraSend')}
              hitSlop={3}
              style={({ pressed }) => [
                styles.sendBtn,
                {
                  backgroundColor: input.trim() ? colors.primary : colors.muted,
                  borderRadius: 20,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons
                name={isRTL ? 'arrow-back' : 'arrow-forward'}
                size={18}
                color={input.trim() ? colors.primaryForeground : colors.mutedForeground}
              />
            </Pressable>
          )}
```

`colors.foreground` and `colors.background` both exist in light and dark themes (`artifacts/mobile/constants/colors.ts`), so the stop button reads as the inverse of the page in either.

- [ ] **Step 8: Typecheck and run the mobile suite**

Run: `cd artifacts/mobile && pnpm typecheck && pnpm test`
Expected: typecheck clean (the Task 5 call-site error is gone); every test passes, including the new `sseParser.test.ts`.

- [ ] **Step 9: Drive it in the web build against the local API**

With the API from Task 2 Step 3 still running, in `artifacts/mobile`: set `EXPO_PUBLIC_DEMO_MODE=false` and `EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api` in `.env`, then `pnpm run dev:mobile:web` from the repo root and sign in.

Check each, in the chat tab with a lesson on the card:

1. Send «اشرح الاقتران العكسي بالتفصيل». Expected: the spinner is replaced by text within about two seconds; the bubble grows; the header badge reads live.
2. While it is still writing, press Stop. Expected: the bubble keeps its text, the toast «توقّف الرد عند هذا الحد.» shows, the Send button returns, the follow-up chips still appear.
3. Send a question and press Stop before any text appears. Expected: no empty bubble; the question is back in the composer.
4. Stop the API process mid-reply. Expected: the text that arrived stays, with «تعذّر إتمام العملية…» as a toast, not replaced by a local answer.
5. Restart the API with `AI_LIVE_MODE` unset and send again. Expected: the «الذكاء الاصطناعي غير متاح» style message from `aiErrorMessageKey`, no empty bubble.
6. Switch the UI language to English and repeat 1 and 2. Expected: the same, with "Stopped here."
7. Confirm the local path is untouched: with `EXPO_PUBLIC_DEMO_MODE` removed from `.env` and the dev server restarted, «علمني» answers from the teaching assistant as before, with no Stop button ever shown.

- [ ] **Step 10: Commit**

```bash
git add "artifacts/mobile/app/(tabs)/iqra.tsx"
git commit -m "mobile: the chat reply streams into its bubble, with a Stop button

The thinking footer gives way to the bubble as soon as text arrives. Stop
keeps what was written; a stop before the first word drops the bubble and
puts the question back. A connection lost mid-reply keeps the real text
rather than swapping in a local answer.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxD1GYFAX41tjnt9BCybcL"
```

---

### Task 8: Android check, STATUS.md, and the PR

**Files:**
- Modify: `STATUS.md` (new dated section near the top of the changelog, under *What works today* or beside the other 2026-10 chat entries)

- [ ] **Step 1: Verify on a native build**

Streaming is the one part the web build cannot prove: React Native's fetch differs from the browser's. Use the Android preview path in `docs/deploying.md` (or a dev client with `EXPO_PUBLIC_DEMO_MODE=false` pointed at a reachable API) and repeat checks 1–3 from Task 7 Step 9 on a device. Expected: text appears incrementally on Android, not all at once; Stop works. If text arrives in one block, `res.body` was undefined — confirm the import is `expo/fetch`, not the global, and that the device bundle is the new one (the build-commit meta tag on web; the OTA update id on Android).

- [ ] **Step 2: Record it in STATUS.md**

Add, in the style of the neighbouring entries:

```markdown
## The chat streams its reply and can be stopped, 2026-10-09

`POST /chat` answers in Server-Sent Events when the request carries
`Accept: text/event-stream`, and in the old `{ content }` JSON otherwise —
the API deploys ahead of the web bundle and days ahead of any binary, so
both shapes stay. The pure half (`lib/chatStream.ts`) is tested; the route
aborts the OpenAI call when the client disconnects and records the spend
from an estimate that errs high (3 chars/token) when the usage chunk never
came.

In the app, `RemoteAIService.chat` streams over `expo/fetch` (React
Native's own fetch has no readable body) through `apiFetch`'s new
`fetchImpl` option, so auth and the 401 retry are unchanged. The screen
streams into an empty bubble, hides the thinking footer once text shows,
and swaps Send for **Stop** while a remote reply is in flight. Stop keeps
the text that arrived; before the first word it drops the bubble and
restores the question. A connection lost mid-reply keeps the real text
and shows the error as a toast — never a local answer in the model's place.

**Reaches native builds and OTA updates only.** Production web still ships
`DEMO_MODE` on (deploy.yml), so web chat is the local teaching assistant
and never streams; nothing about that decision changed here.

Not done: the generators still return whole JSON; the list still scrolls
to the end on every content change (it follows the growing bubble, which
is wanted while streaming, and still yanks a teacher who scrolled up).
```

- [ ] **Step 3: Full verification before the PR**

Run, from the repo root:

```bash
pnpm run typecheck
cd artifacts/api-server && pnpm build && pnpm test && cd ../..
cd artifacts/mobile && pnpm test && cd ../..
```
Expected: all clean.

- [ ] **Step 4: Commit and open the PR**

```bash
git add STATUS.md
git commit -m "docs: record the streamed chat reply in STATUS.md

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FxD1GYFAX41tjnt9BCybcL"
git push -u origin ccr-2362dfd4-t0hw8w
```

Open a draft PR titled "Chat: stream the reply, with Stop" whose body lists the two reply shapes, the deploy-window reasoning, the spend estimate rule, and the seven manual checks from Task 7 Step 9 with the Android check from Step 1. No schema change, so no `destructive-migration` line is needed.
