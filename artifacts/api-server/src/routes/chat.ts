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
chatRouter.post("/chat", async (req, res) => {
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
    recordUsage(completion.usage, getChatModel());

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
