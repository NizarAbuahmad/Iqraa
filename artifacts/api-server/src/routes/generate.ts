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

// ─── Activity ─────────────────────────────────────────────────────────────────
generateRouter.post("/generate/activity", async (req, res) => {
  try {
    const body = req.body;
    const isAr = body.language !== "english";
    const prompt = isAr ? activityPromptAr(body) : activityPromptEn(body);

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
    logger.error({ err }, "generate activity error");
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

// ─── Activity prompt builders ────────────────────────────────────────────────
function activityPromptAr(b: any): string {
  const dur = b.duration ?? 30;
  const type = b.activityType ?? "group";
  const typeLabel: Record<string, string> = {
    individual: "فردي", group: "جماعي تعاوني", discussion: "نقاش صفي",
    "hands-on": "تطبيقي عملي", game: "لعبة تعليمية",
  };
  return `صمّم نشاطًا تعليميًا ${typeLabel[type] ?? type} لمادة ${b.subject} للصف ${b.grade} حول موضوع "${b.topic}".
مدة النشاط: ${dur} دقيقة.
${b.objectives ? `هدف النشاط: ${b.objectives}` : ""}
${b.additionalContext ? `\nسياق الكتاب المدرسي:\n${b.additionalContext}` : ""}

أعد JSON بالشكل الآتي (بالعربية):
{
  "title": "عنوان النشاط",
  "activityType": "${type}",
  "totalDuration": ${dur},
  "objective": "هدف النشاط بجملة واحدة",
  "groupSize": "حجم المجموعة (مثل: 3-4 طلاب)",
  "materials": ["مادة 1", "مادة 2"],
  "steps": [
    { "stepNumber": 1, "title": "عنوان الخطوة", "description": "وصف تفصيلي للخطوة", "durationMin": 5 }
  ],
  "teacherTips": ["نصيحة 1", "نصيحة 2"],
  "differentiation": "كيف تتعامل مع الطلاب ذوي المستويات المختلفة",
  "assessment": "كيف تقيّم نجاح النشاط"
}`;
}

function activityPromptEn(b: any): string {
  const dur = b.duration ?? 30;
  const type = b.activityType ?? "group";
  return `Design a ${type} classroom activity for ${b.subject}, ${b.grade}, on the topic "${b.topic}".
Duration: ${dur} minutes.
${b.objectives ? `Lesson objective: ${b.objectives}` : ""}
${b.additionalContext ? `\nTextbook context:\n${b.additionalContext}` : ""}

Return JSON in this exact shape:
{
  "title": "Activity title",
  "activityType": "${type}",
  "totalDuration": ${dur},
  "objective": "One-sentence activity objective",
  "groupSize": "e.g. 3-4 students",
  "materials": ["item 1", "item 2"],
  "steps": [
    { "stepNumber": 1, "title": "Step title", "description": "Detailed step description for the teacher", "durationMin": 5 }
  ],
  "teacherTips": ["tip 1", "tip 2"],
  "differentiation": "How to adapt for different learner levels",
  "assessment": "How to assess activity success"
}`;
}

// ─── Classroom Activity route ─────────────────────────────────────────────────
generateRouter.post('/classroom-activity', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const isAr = body.language === 'arabic';
  try {
    const prompt = isAr ? classroomPromptAr(body) : classroomPromptEn(body);
    const raw = await callAI(prompt);
    const data = extractJSON(raw);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

function classroomPromptAr(b: any): string {
  const goals: Record<string, string> = {
    'warm-up': 'تمهيد', practice: 'تدريب', revision: 'مراجعة',
    assessment: 'تقييم', 'critical-thinking': 'تفكير ناقد',
  };
  const groups: Record<string, string> = {
    individual: 'فردي', pairs: 'ثنائي', groups: 'مجموعات', 'whole-class': 'الصف بأكمله',
  };
  const diffs: Record<string, string> = { easy: 'سهل', standard: 'متوسط', advanced: 'متقدم' };
  return `أنت مصمم أنشطة صفية تفاعلية. أنشئ نشاط "تحدي الهروب" لمادة ${b.subject}، الصف ${b.grade}، موضوع "${b.topic}".
المدة: ${b.duration} دقيقة | الصعوبة: ${diffs[b.difficulty] ?? b.difficulty} | التجميع: ${groups[b.groupType] ?? b.groupType} | الهدف: ${goals[b.teachingGoal] ?? b.teachingGoal}
${b.additionalContext ? `\nمحتوى الكتاب المدرسي:\n${b.additionalContext}` : ''}

أعد JSON بالشكل الآتي (بالعربية الكاملة، لا تستخدم أي حروف إنجليزية في النصوص):
{
  "activityName": "اسم النشاط",
  "activityType": "escape-challenge",
  "grade": "${b.grade}",
  "subject": "${b.subject}",
  "lesson": "${b.topic}",
  "duration": ${b.duration},
  "difficulty": "${b.difficulty}",
  "groupType": "${b.groupType}",
  "learningObjective": "الهدف التعليمي بجملة واحدة",
  "materials": ["مادة 1","مادة 2"],
  "teacherPreparation": "خطوات إعداد المعلم",
  "slides": [
    {
      "slideNumber": 1,
      "type": "intro",
      "title": "مهمتكم",
      "content": "وصف المهمة",
      "durationSeconds": 0
    },
    {
      "slideNumber": 2,
      "type": "challenge",
      "title": "التحدي 1",
      "content": "نص التحدي",
      "hint": "تلميح مساعد",
      "answer": "الإجابة الصحيحة",
      "unlockCode": "5",
      "durationSeconds": 180,
      "teacher": {
        "expectedAnswer": "الإجابة المفصّلة",
        "commonMisconceptions": "أخطاء شائعة",
        "teachingTips": "نصائح للمعلم",
        "suggestedQuestions": ["سؤال 1"],
        "differentiationTips": "كيف تتعامل مع مستويات مختلفة"
      }
    },
    {
      "slideNumber": 3,
      "type": "reveal",
      "title": "تم فتح الكود!",
      "content": "وصف الكود المفتوح",
      "unlockCode": "5",
      "durationSeconds": 0
    }
  ],
  "teacherNotes": ["ملاحظة 1"],
  "answerKey": ["إجابة التحدي 1"],
  "printables": ["بطاقات التحديات","مفتاح الإجابات"],
  "assessment": "كيف تقيّم النشاط",
  "extensionChallenge": "تحدٍّ إضافي للمتقدمين"
}
أنشئ ${Math.floor(b.duration / 4)} تحديًا على الأقل. كل تحدٍّ يتبعه شريحة كشف.`;
}

function classroomPromptEn(b: any): string {
  return `You are an interactive classroom activity designer. Create a Math Escape Challenge for ${b.subject}, Grade ${b.grade}, topic "${b.topic}".
Duration: ${b.duration} min | Difficulty: ${b.difficulty} | Groups: ${b.groupType} | Goal: ${b.teachingGoal}
${b.additionalContext ? `\nTextbook context:\n${b.additionalContext}` : ''}

Return JSON in this exact shape (all text in English):
{
  "activityName": "Activity name",
  "activityType": "escape-challenge",
  "grade": "${b.grade}",
  "subject": "${b.subject}",
  "lesson": "${b.topic}",
  "duration": ${b.duration},
  "difficulty": "${b.difficulty}",
  "groupType": "${b.groupType}",
  "learningObjective": "One-sentence learning objective",
  "materials": ["item 1","item 2"],
  "teacherPreparation": "Teacher setup steps",
  "slides": [
    { "slideNumber": 1, "type": "intro", "title": "Your Mission", "content": "Mission description", "durationSeconds": 0 },
    {
      "slideNumber": 2,
      "type": "challenge",
      "title": "Challenge 1",
      "content": "Challenge question text",
      "hint": "A helpful hint",
      "answer": "The correct answer",
      "unlockCode": "5",
      "durationSeconds": 180,
      "teacher": {
        "expectedAnswer": "Detailed expected answer",
        "commonMisconceptions": "Common student errors",
        "teachingTips": "Teaching advice",
        "suggestedQuestions": ["Follow-up question"],
        "differentiationTips": "How to support different levels"
      }
    },
    { "slideNumber": 3, "type": "reveal", "title": "Code Unlocked!", "content": "Code reveal message", "unlockCode": "5", "durationSeconds": 0 }
  ],
  "teacherNotes": ["note 1"],
  "answerKey": ["Challenge 1 answer"],
  "printables": ["Challenge cards","Answer key"],
  "assessment": "How to assess the activity",
  "extensionChallenge": "Extension challenge for advanced students"
}
Generate at least ${Math.floor(b.duration / 4)} challenges. Each challenge slide is followed by a reveal slide.`;
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
