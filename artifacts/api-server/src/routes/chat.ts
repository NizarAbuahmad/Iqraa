import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";

const chatRouter = Router();

/**
 * POST /chat
 * iQra conversational assistant — grounded by knowledge-base context
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
      ...messages.slice(-12).map((m) => ({
        role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      })),
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 600,   // keep chat replies concise; faster response time
      messages: chatMessages,
    });

    const answer = completion.choices[0]?.message?.content ?? "";
    res.json({ content: answer });
  } catch (err) {
    logger.error({ err }, "chat error");
    res.status(500).json({ error: "AI service error. Please try again." });
  }
});

function buildSystemPromptAr(isTeacher: boolean, context?: string): string {
  const role = isTeacher
    ? "أنت إقرأ (iQra)، مساعد تعليمي ذكي للمعلمين في الأردن."
    : "أنت إقرأ (iQra)، مساعد تعليمي ذكي للطلاب في الأردن.";

  const base = `${role}
تخصصك: منهج الرياضيات للصف العاشر وفق المنهج الوطني الأردني (الفصل الأول والثاني).

توجيهات عامة:
- أجب دائمًا باللغة العربية الفصيحة.
- اجعل إجاباتك دقيقة وموثوقة ومرتبطة بالمنهج الأردني.
- استخدم الصيغ والمصطلحات الرياضية الواردة في الكتاب المدرسي.
- ${isTeacher ? "ركّز على الجانب التعليمي: الشرح والأمثلة وأساليب التدريس وملاحظات المعلم." : "اشرح بأسلوب بسيط مناسب للطالب مع أمثلة توضيحية."}
- إذا كان السؤال خارج نطاق الرياضيات للصف العاشر، وضّح ذلك بأدب وأعد توجيه الطالب أو المعلم.
- إذا طلب المعلم إنشاء خطة درس أو ورقة عمل أو اختبار، أجب بشكل مختصر واذكر اسم الموضوع بوضوح، واقترح عليه استخدام تبويب «أدوات الذكاء الاصطناعي» في التطبيق للحصول على خطة منظمة وقابلة للتصدير.`;

  return context
    ? `${base}\n\nمعلومات من الكتاب المدرسي (استخدمها كمرجع أساسي لإجابتك):\n${context}`
    : base;
}

function buildSystemPromptEn(isTeacher: boolean, context?: string): string {
  const role = isTeacher
    ? "You are iQra, an intelligent teaching assistant for teachers in Jordan."
    : "You are iQra, an intelligent learning assistant for students in Jordan.";

  const base = `${role}
Your specialty: Grade 10 Mathematics under the Jordanian national curriculum (Semesters 1 & 2).

Guidelines:
- Respond in clear, accurate English.
- Ground your answers in the Jordanian curriculum content and terminology.
- Use formulas and notation as they appear in the textbook.
- ${isTeacher ? "Focus on the teaching perspective: explanations, examples, teaching strategies, and teacher notes." : "Explain in a clear, student-friendly way with worked examples."}
- If the question is outside Grade 10 Math scope, politely clarify and redirect.`;

  return context
    ? `${base}\n\nTextbook reference (use as your primary source):\n${context}`
    : base;
}

export default chatRouter;
