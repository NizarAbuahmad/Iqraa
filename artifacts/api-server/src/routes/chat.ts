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
      max_completion_tokens: 1000,  // enough room for multi-step math / chemistry explanations
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
تخصصك: منهج الرياضيات والكيمياء للصف العاشر وفق المنهج الوطني الأردني (الفصل الأول والثاني).

محتوى الرياضيات — الفصل الأول: الاقترانات، المشتقات، المتجهات، الإحصاء والاحتمالات.
محتوى الرياضيات — الفصل الثاني: المعادلات، الدائرة، حساب المثلثات، تطبيقات المثلثات.
محتوى الكيمياء — الفصل الأول: التركيب الذري، الجدول الدوري وخصائص العناصر، الروابط الكيميائية.

توجيهات عامة:
- أجب دائمًا باللغة العربية الفصيحة.
- اجعل إجاباتك دقيقة وموثوقة ومرتبطة بالمنهج الأردني.
- استخدم الصيغ والمصطلحات الواردة في الكتاب المدرسي.
- للمسائل الرياضية والكيميائية، استخدم خطوات مرقمة واضحة: 1. 2. 3. مع ذكر الصيغة أو القانون في كل خطوة.
- ${isTeacher ? "ركّز على الجانب التعليمي: الشرح والأمثلة وأساليب التدريس وملاحظات المعلم." : "اشرح بأسلوب بسيط مناسب للطالب مع أمثلة توضيحية."}
- إذا كان السؤال خارج نطاق منهج الصف العاشر، وضّح ذلك بأدب وأعد توجيه المستخدم.
- إذا كان الطلب غامضًا أو مبهمًا، اطرح سؤالاً أو سؤالين توضيحيين مركّزين لتحديد الوحدة أو الموضوع المطلوب — لا تترك الرد فارغًا.
- إذا طلب المعلم إنشاء خطة درس أو ورقة عمل أو اختبار لموضوع محدد، اذكر اسم الموضوع واقترح استخدام تبويب «أدوات الذكاء الاصطناعي» للحصول على خطة منظمة وقابلة للتصدير.
- إذا وُجدت مراجع متعددة في السياق أدناه، قارن بينها وأجب بشكل متكامل يشمل جميع المفاهيم ذات الصلة.`;

  return context
    ? `${base}\n\nمعلومات من الكتاب المدرسي (استخدمها كمرجع أساسي — قد تحتوي على مراجع متعددة):\n${context}`
    : base;
}

function buildSystemPromptEn(isTeacher: boolean, context?: string): string {
  const role = isTeacher
    ? "You are iQra, an intelligent teaching assistant for teachers in Jordan."
    : "You are iQra, an intelligent learning assistant for students in Jordan.";

  const base = `${role}
Your specialty: Grade 10 Mathematics and Chemistry under the Jordanian national curriculum (Semesters 1 & 2).

Mathematics — Semester 1: Functions, Derivatives, Vectors, Statistics & Probability.
Mathematics — Semester 2: Equations, The Circle, Trigonometry, Applications of Trigonometry.
Chemistry — Semester 1: Atomic Structure, Periodic Table & Element Properties, Chemical Bonding.

Guidelines:
- Respond in clear, accurate English.
- Ground your answers in the Jordanian curriculum content and terminology.
- Use formulas and notation as they appear in the textbook.
- For math and chemistry problems, use clearly numbered steps (1. 2. 3.) and state the formula or rule applied at each step.
- ${isTeacher ? "Focus on the teaching perspective: explanations, examples, teaching strategies, and teacher notes." : "Explain in a clear, student-friendly way with worked examples."}
- If the question is outside Grade 10 Math/Chemistry scope, politely clarify and redirect.
- If the question is vague or ambiguous, ask 1–2 focused clarifying questions rather than guessing — never leave an empty reply.
- If multiple textbook references are provided in the context below, synthesise them into a complete answer covering all relevant concepts.`;

  return context
    ? `${base}\n\nTextbook reference (use as your primary source — may contain multiple references):\n${context}`
    : base;
}

export default chatRouter;
