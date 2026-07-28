import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";

const generateRouter = Router();

// ─── Lesson Plan ─────────────────────────────────────────────────────────────
generateRouter.post("/generate/lesson-plan", async (req, res) => {
  try {
    const body = req.body;
    const isAr = body.language !== "english";
    const prompt = isAr ? lessonPlanPromptAr(body) : lessonPlanPromptEn(body);

    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 2000,
      messages: [
        { role: "system", content: isAr ? SYSTEM_AR : SYSTEM_EN },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = extractJSON(raw);
    res.json(parsed);
  } catch (err) {
    logger.error({ err }, "generate lesson-plan error");
    res.status(500).json({ error: "AI generation failed. Please try again." });
  }
});

// ─── Worksheet ────────────────────────────────────────────────────────────────
generateRouter.post("/generate/worksheet", async (req, res) => {
  try {
    const body = req.body;
    const isAr = body.language !== "english";
    const prompt = isAr ? worksheetPromptAr(body) : worksheetPromptEn(body);

    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 2000,
      messages: [
        { role: "system", content: isAr ? SYSTEM_AR : SYSTEM_EN },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = extractJSON(raw);
    res.json(parsed);
  } catch (err) {
    logger.error({ err }, "generate worksheet error");
    res.status(500).json({ error: "AI generation failed. Please try again." });
  }
});

// ─── Quiz ─────────────────────────────────────────────────────────────────────
generateRouter.post("/generate/quiz", async (req, res) => {
  try {
    const body = req.body;
    const isAr = body.language !== "english";
    const prompt = isAr ? quizPromptAr(body) : quizPromptEn(body);

    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 2000,
      messages: [
        { role: "system", content: isAr ? SYSTEM_AR : SYSTEM_EN },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = extractJSON(raw);
    res.json(parsed);
  } catch (err) {
    logger.error({ err }, "generate quiz error");
    res.status(500).json({ error: "AI generation failed. Please try again." });
  }
});

// ─── Homework ─────────────────────────────────────────────────────────────────
generateRouter.post("/generate/homework", async (req, res) => {
  try {
    const body = req.body;
    const isAr = body.language !== "english";
    const prompt = isAr ? worksheetPromptAr({ ...body, homework: true }) : worksheetPromptEn({ ...body, homework: true });

    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 1500,
      messages: [
        { role: "system", content: isAr ? SYSTEM_AR : SYSTEM_EN },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = extractJSON(raw);
    res.json(parsed);
  } catch (err) {
    logger.error({ err }, "generate homework error");
    res.status(500).json({ error: "AI generation failed. Please try again." });
  }
});

// ─── System prompts ──────────────────────────────────────────────────────────
const SYSTEM_AR = `أنت مولّد محتوى تعليمي متخصص للمنهج الأردني.
قم بإنشاء محتوى احترافي ودقيق مناسب للمعلمين.
أجب دائمًا بـJSON صحيح فقط، بدون أي نص إضافي قبله أو بعده.
استخدم اللغة العربية الفصيحة في جميع النصوص.`;

const SYSTEM_EN = `You are an educational content generator specialized in the Jordanian curriculum.
Produce professional, accurate content suitable for teachers.
Always respond with valid JSON only, no text before or after.
Use clear academic English throughout.`;

// ─── Prompt builders ─────────────────────────────────────────────────────────
function lessonPlanPromptAr(b: any): string {
  return `أنشئ خطة درس كاملة لمادة ${b.subject} للصف ${b.grade} حول موضوع "${b.topic}"، مدتها ${b.duration ?? 45} دقيقة.
${b.objectives ? `الأهداف المحددة:\n${b.objectives}` : ""}
${b.additionalContext ? `سياق إضافي: ${b.additionalContext}` : ""}
أسلوب التدريس: ${b.teachingStyle === "inquiry" ? "استقصائي" : b.teachingStyle === "collaborative" ? "تعاوني" : "مباشر"}

أعد JSON بالشكل الآتي (بالعربية):
{
  "title": "عنوان الدرس",
  "grade": "${b.grade}",
  "subject": "${b.subject}",
  "duration": ${b.duration ?? 45},
  "objectives": ["هدف 1", "هدف 2", "هدف 3"],
  "materials": ["مادة 1", "مادة 2"],
  "introduction": "نص التمهيد (3-4 جمل)",
  "mainActivity": "وصف النشاط الرئيسي (فقرة)",
  "guidedPractice": "وصف التدريب الموجّه (فقرة)",
  "independentPractice": "وصف التدريب المستقل (فقرة)",
  "closure": "نص الإغلاق (2-3 جمل)",
  "assessment": "وصف التقييم",
  "differentiation": "استراتيجيات التمييز",
  "homework": "الواجب المنزلي المقترح"
}`;
}

function lessonPlanPromptEn(b: any): string {
  return `Create a complete lesson plan for ${b.subject}, ${b.grade}, on the topic "${b.topic}", duration ${b.duration ?? 45} minutes.
${b.objectives ? `Specified objectives:\n${b.objectives}` : ""}
${b.additionalContext ? `Additional context: ${b.additionalContext}` : ""}
Teaching style: ${b.teachingStyle ?? "direct"}

Return JSON in this exact shape:
{
  "title": "Lesson title",
  "grade": "${b.grade}",
  "subject": "${b.subject}",
  "duration": ${b.duration ?? 45},
  "objectives": ["objective 1", "objective 2", "objective 3"],
  "materials": ["item 1", "item 2"],
  "introduction": "Hook/intro text (3-4 sentences)",
  "mainActivity": "Main activity description (paragraph)",
  "guidedPractice": "Guided practice description (paragraph)",
  "independentPractice": "Independent practice description (paragraph)",
  "closure": "Closure text (2-3 sentences)",
  "assessment": "Assessment description",
  "differentiation": "Differentiation strategies",
  "homework": "Suggested homework"
}`;
}

function worksheetPromptAr(b: any): string {
  const n = b.numQuestions ?? 8;
  const isHW = b.homework;
  return `أنشئ ${isHW ? "واجبًا منزليًا" : "ورقة عمل"} لمادة ${b.subject} للصف ${b.grade} حول "${b.topic}".
عدد الأسئلة: ${n}، المستوى: ${b.difficulty ?? "متوسط"}
أنواع الأسئلة المطلوبة: ${(b.questionTypes ?? ["short_answer"]).join(", ")}
${b.additionalContext ? `\nسياق الكتاب المدرسي (استخدمه لصياغة أسئلة دقيقة ومرتبطة بالمنهج):\n${b.additionalContext}` : ""}
أعد JSON بالشكل الآتي (بالعربية):
{
  "title": "عنوان الورقة",
  "instructions": "تعليمات عامة",
  "sections": [
    {
      "type": "short_answer",
      "title": "عنوان القسم",
      "questions": [
        { "text": "نص السؤال", "points": 5 }
      ]
    }
  ],
  "answerKey": [
    { "num": 1, "answer": "الإجابة" }
  ]
}`;
}

function worksheetPromptEn(b: any): string {
  const n = b.numQuestions ?? 8;
  const isHW = b.homework;
  return `Create a ${isHW ? "homework assignment" : "worksheet"} for ${b.subject}, ${b.grade}, on "${b.topic}".
Number of questions: ${n}, difficulty: ${b.difficulty ?? "medium"}
Question types: ${(b.questionTypes ?? ["short_answer"]).join(", ")}
${b.additionalContext ? `\nTextbook context (use this to craft accurate, curriculum-aligned questions):\n${b.additionalContext}` : ""}
Return JSON in this exact shape:
{
  "title": "Worksheet title",
  "instructions": "General instructions",
  "sections": [
    {
      "type": "short_answer",
      "title": "Section title",
      "questions": [
        { "text": "Question text", "points": 5 }
      ]
    }
  ],
  "answerKey": [
    { "num": 1, "answer": "Answer" }
  ]
}`;
}

function quizPromptAr(b: any): string {
  const n = b.numQuestions ?? 10;
  const marks = b.totalMarks ?? 20;
  return `أنشئ اختبارًا لمادة ${b.subject} للصف ${b.grade} حول "${b.topic}".
عدد الأسئلة: ${n}، العلامة الكاملة: ${marks}
أنواع الأسئلة: ${(b.questionTypes ?? ["multiple_choice", "true_false"]).join(", ")}
${b.additionalContext ? `\nسياق الكتاب المدرسي (استخدمه لصياغة أسئلة دقيقة ومرتبطة بالمنهج):\n${b.additionalContext}` : ""}
أعد JSON بالشكل الآتي (بالعربية):
{
  "title": "عنوان الاختبار",
  "duration": 45,
  "totalPoints": ${marks},
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "text": "نص السؤال",
      "options": ["أ) خيار", "ب) خيار", "ج) خيار", "د) خيار"],
      "correctAnswer": "أ) الخيار الصحيح",
      "points": 2,
      "explanation": "تفسير الإجابة"
    }
  ]
}`;
}

function quizPromptEn(b: any): string {
  const n = b.numQuestions ?? 10;
  const marks = b.totalMarks ?? 20;
  return `Create a quiz for ${b.subject}, ${b.grade}, on "${b.topic}".
Number of questions: ${n}, total marks: ${marks}
Question types: ${(b.questionTypes ?? ["multiple_choice", "true_false"]).join(", ")}
${b.additionalContext ? `\nTextbook context (use this to craft accurate, curriculum-aligned questions):\n${b.additionalContext}` : ""}
Return JSON in this exact shape:
{
  "title": "Quiz title",
  "duration": 45,
  "totalPoints": ${marks},
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "text": "Question text",
      "options": ["A) option", "B) option", "C) option", "D) option"],
      "correctAnswer": "A) correct option",
      "points": 2,
      "explanation": "Explanation of answer"
    }
  ]
}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function extractJSON(raw: string): unknown {
  // Strip markdown code fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to find the first { ... } block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Could not parse JSON from AI response");
  }
}

export default generateRouter;
