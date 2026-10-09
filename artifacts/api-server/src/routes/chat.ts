import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";
import {
  AiBudgetExceededError,
  AiLiveModeOffError,
  AiUserQuotaExceededError,
  assertBudgetAvailable,
  assertLiveModeEnabled,
  assertUserQuotaAvailable,
  getChatModel,
  recordUsage,
} from "../lib/aiBudget.ts";
import { PROMPT_VERSION } from "../lib/generationKey.ts";
import type { AuthenticatedRequest } from "../middlewares/auth.ts";
import {
  buildSystemPromptAr,
  buildSystemPromptEn,
  CHAT_CONTEXT_MAX_CHARS,
  CHAT_HISTORY_TURNS,
  CHAT_MAX_TOKENS,
  CHAT_MESSAGE_MAX_CHARS,
  clampPromptText,
} from "../lib/chatPrompts.ts";
import { estimateTokens, pumpChatStream, sseFrame, wantsEventStream } from "../lib/chatStream.ts";

const chatRouter = Router();

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
  // Set only once the upstream call is about to start, so the catch below
  // knows there is spend to account for. Clears itself after one use.
  let recordEstimate: ((reason: "abandoned" | "failed" | "client_gone", streamedChars: number) => void) | null = null;
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

    const promptChars = chatMessages.reduce((n, m) => n + m.content.length, 0);

    // The teacher pressed Stop, or the app went away: cancel the upstream
    // call so the model stops generating tokens we pay for and nobody reads.
    // Registered before the quota reads so a Stop during them is seen too.
    // `close` also fires after a normal end, hence the `writableFinished` check.
    const upstream = new AbortController();
    if (streaming) {
      res.on("close", () => {
        if (res.writableFinished) return;
        clientGone = true;
        upstream.abort();
      });
    }

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
      // from generation's, which is what decides whether AI_MODEL_CHAT is worth
      // pointing at something cheaper (STATUS.md, 2026-08-22, still open).
      recordUsage(completion.usage, model, { ...detail, durationMs: Date.now() - startedAt });
      res.json({ content: completion.choices[0]?.message?.content ?? "" });
      return;
    }

    // Gone during the quota reads: nothing was started, so nothing is owed.
    if (clientGone) {
      logger.info({ userId: req.user?.id }, "chat stream abandoned before upstream call");
      return;
    }

    // An estimate for a turn whose usage chunk never arrived. The prompt is
    // counted at 3 chars/token; the completion is charged at CHAT_MAX_TOKENS,
    // because `max_completion_tokens` caps reasoning and visible output
    // together, so it is the only true ceiling — counting the visible text
    // alone would undercount a reasoning model, whose hidden tokens bill too.
    recordEstimate = (reason, streamedChars) => {
      recordEstimate = null;
      recordUsage(
        { prompt_tokens: estimateTokens(promptChars), completion_tokens: CHAT_MAX_TOKENS },
        model,
        { ...detail, durationMs: Date.now() - startedAt },
      );
      logger.info({ userId: req.user?.id, estimated: true, reason, streamedChars }, "chat spend estimated");
    };

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
    res.setHeader("Cache-Control", "no-store, no-transform");
    res.setHeader("Connection", "keep-alive");
    // Tells nginx-style proxies not to buffer; harmless on Cloud Run.
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    headersSent = true;

    const result = await pumpChatStream(stream, res, upstream.signal);
    const durationMs = Date.now() - startedAt;

    if (result.usage) {
      // Real figures, including when the usage chunk beat the client's Stop.
      recordEstimate = null;
      recordUsage(result.usage, model, { ...detail, durationMs });
    } else {
      // No usage chunk: the client hung up, the upstream failed, or (rarely)
      // the stream ended without one. The provider still bills what was
      // generated, so the ledger must move: an estimate that errs high.
      recordEstimate?.(result.aborted ? "abandoned" : "failed", result.content.length);
    }
    if (result.aborted) {
      logger.info({ userId: req.user?.id, streamedChars: result.content.length }, "chat stream abandoned by client");
    }
    if (result.error) {
      // The upstream failed mid-stream. The spend is already recorded above;
      // the error travels as a frame and the client keeps what it has.
      logger.error({ err: result.error }, "chat stream error");
      res.write(sseFrame({ type: "error", code: "stream_failed", message: "AI service error. Please try again." }));
    }
    res.end();
  } catch (err) {
    // The client left while the upstream call was still connecting: there
    // is nobody to answer, and the abort is the expected outcome, not an
    // error. (Only the streaming branch sets this.)
    if (clientGone) {
      logger.info({ userId: req.user?.id }, "chat stream abandoned before first byte");
      // The upstream call had started, so tokens may have been billed.
      recordEstimate?.("client_gone", 0);
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

export default chatRouter;
