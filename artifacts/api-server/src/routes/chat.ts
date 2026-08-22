import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";
import {
  AiBudgetExceededError,
  AiLiveModeOffError,
  assertBudgetAvailable,
  assertLiveModeEnabled,
  getChatModel,
  recordUsage,
} from "../lib/aiBudget.ts";
import { PROMPT_VERSION } from "../lib/generationKey.ts";
import type { AuthenticatedRequest } from "../middlewares/auth.ts";
import {
  buildSystemPromptAr,
  buildSystemPromptEn,
  CHAT_HISTORY_TURNS,
  CHAT_MAX_TOKENS,
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

    const systemPrompt = isArabic
      ? buildSystemPromptAr(isTeacher, context)
      : buildSystemPromptEn(isTeacher, context);

    const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-CHAT_HISTORY_TURNS).map((m) => ({
        role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      })),
    ];

    assertLiveModeEnabled();
    assertBudgetAvailable();

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
    if (err instanceof AiBudgetExceededError) {
      res.status(429).json({ error: err.message });
      return;
    }
    logger.error({ err }, "chat error");
    res.status(500).json({ error: "AI service error. Please try again." });
  }
});

export default chatRouter;
