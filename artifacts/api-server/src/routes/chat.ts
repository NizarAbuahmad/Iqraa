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

const chatRouter = Router();

/**
 * POST /chat
 * IQRA conversational assistant — grounded by knowledge-base context
 * from the mobile client. Returns a plain JSON response (not SSE)
 * so React Native can consume it easily.
 */
chatRouter.post("/chat", async (req: AuthenticatedRequest, res) => {
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
    assertBudgetAvailable();
    // Per-user allowance on top of the shared monthly cap. /chat is reachable by
    // any signed-in account — student and parent included — and was the largest
    // spender with no per-caller ceiling of its own.
    await assertUserQuotaAvailable(req.user?.id);

    const completion = await openai.chat.completions.create({
      model: getChatModel(),
      max_completion_tokens: CHAT_MAX_TOKENS,
      messages: chatMessages,
    });
    // No cache keys on purpose. A chat turn never repeats, so any key computed
    // here would be the same for every turn and would show up in the repeat-rate
    // analysis as a workload with a perfect hit rate — the opposite of the truth.
    // The `kind` is what earns its place: it separates chat's share of spend
    // from generation's, which is what decides whether AI_MODEL_CHAT is worth
    // pointing at something cheaper (STATUS.md, 2026-08-22, still open).
    recordUsage(completion.usage, getChatModel(), {
      kind: isTeacher ? "chat-teacher" : "chat-student",
      promptVersion: PROMPT_VERSION,
      userId: req.user?.id,
    });

    const answer = completion.choices[0]?.message?.content ?? "";
    res.json({ content: answer });
  } catch (err) {
    if (err instanceof AiLiveModeOffError) {
      res.status(503).json({ error: err.message });
      return;
    }
    if (err instanceof AiUserQuotaExceededError) {
      res.status(429).json({ error: err.message, code: "user_quota_exceeded" });
      return;
    }
    if (err instanceof AiBudgetExceededError) {
      res.status(429).json({ error: err.message });
      return;
    }
    logger.error({ err }, "chat error");
    res.status(500).json({ error: "AI service error. Please try again." });
  }
});

export default chatRouter;
