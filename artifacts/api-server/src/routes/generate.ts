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
  const types = b.questionTypes ?? ["short_answer"];
  const wantsWP = types.includes("word_problem");
  const prior = b.includePriorReview && Array.isArray(b.priorKnowledge) && b.priorKnowledge.length
    ? b.priorKnowledge
    : null;
  return `أنشئ ${isHW ? "واجبًا منزليًا" : "ورقة عمل"} لمادة ${b.subject} للصف ${b.grade} حول "${b.topic}".
عدد الأسئلة: ${n}، المستوى: ${b.difficulty ?? "متوسط"}
أنواع الأسئلة المطلوبة: ${types.join(", ")}
${wantsWP ? "\nيجب تضمين مسألة حياتية واحدة على الأقل (سيناريو واقعي يتطلب تطبيق مفاهيم الدرس، بأسلوب «حل مسائل حياتية»)." : ""}
${prior ? `\nابدأ بقسم «مراجعة سابقة» فيه سؤالان أو ثلاثة فقط مبنية حرفيًا على هذه المفاهيم السابقة (لا تختلق غيرها):\n- ${prior.join("\n- ")}` : ""}
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
}
مهم: كل سؤال يجب أن يقابله عنصر في answerKey (قسم الإجابات).`;
}

function worksheetPromptEn(b: any): string {
  const n = b.numQuestions ?? 8;
  const isHW = b.homework;
  const types = b.questionTypes ?? ["short_answer"];
  const wantsWP = types.includes("word_problem");
  const prior = b.includePriorReview && Array.isArray(b.priorKnowledge) && b.priorKnowledge.length
    ? b.priorKnowledge
    : null;
  return `Create a ${isHW ? "homework assignment" : "worksheet"} for ${b.subject}, ${b.grade}, on "${b.topic}".
Number of questions: ${n}, difficulty: ${b.difficulty ?? "medium"}
Question types: ${types.join(", ")}
${wantsWP ? "\nInclude at least one real-life word problem (a realistic scenario that requires applying the lesson concepts)." : ""}
${prior ? `\nStart with a "Prior knowledge review" section of 2–3 questions drawn only from these concepts (do not invent others):\n- ${prior.join("\n- ")}` : ""}
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
}
Important: every question must have a matching answerKey entry.`;
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
    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 2000,
      messages: [
        { role: "system", content: isAr ? SYSTEM_AR : SYSTEM_EN },
        { role: "user", content: prompt },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
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

  const actType = b.activityType ?? 'escape-challenge';

  if (actType === 'bingo') {
    return `أنت مصمم أنشطة صفية تفاعلية. أنشئ نشاط "بينجو المصطلحات" لمادة ${b.subject}، الصف ${b.grade}، موضوع "${b.topic}".
المدة: ${b.duration} دقيقة | الصعوبة: ${diffs[b.difficulty] ?? b.difficulty} | التجميع: ${groups[b.groupType] ?? b.groupType} | الهدف: ${goals[b.teachingGoal] ?? b.teachingGoal}
${b.additionalContext ? `\nمحتوى الكتاب المدرسي:\n${b.additionalContext}` : ''}

أعد JSON بالشكل الآتي (بالعربية الكاملة):
{
  "activityName": "بينجو – ${b.topic}",
  "activityType": "bingo",
  "grade": "${b.grade}",
  "subject": "${b.subject}",
  "lesson": "${b.topic}",
  "duration": ${b.duration},
  "difficulty": "${b.difficulty}",
  "groupType": "${b.groupType}",
  "learningObjective": "الهدف التعليمي بجملة واحدة",
  "materials": ["بطاقات بينجو مطبوعة","قصاصات ورقية للتغطية","مؤقت"],
  "teacherPreparation": "خطوات إعداد المعلم",
  "slides": [
    { "slideNumber": 1, "type": "intro", "title": "🎱 بينجو المصطلحات", "content": "شرح آلية اللعبة", "durationSeconds": 0 },
    {
      "slideNumber": 2,
      "type": "bingo-call",
      "title": "الاستدعاء 1",
      "content": "تلميح أو تعريف المصطلح الأول",
      "answer": "المصطلح الصحيح",
      "durationSeconds": 30,
      "teacher": {
        "expectedAnswer": "المصطلح المستدعى",
        "teachingTips": "نصيحة للمعلم"
      }
    }
  ],
  "teacherNotes": ["ملاحظة 1"],
  "answerKey": ["المصطلح 1: تعريفه"],
  "printables": ["بطاقات بينجو 5×5 (نسخة مختلفة لكل طالب)","قائمة الاستدعاء للمعلم"],
  "assessment": "كيف تقيّم النشاط",
  "extensionChallenge": "تحدٍّ إضافي للمتقدمين"
}
أنشئ قائمة استدعاء من ${Math.floor(b.duration / 2)} مصطلحًا على الأقل (شريحة bingo-call لكل مصطلح).`;
  }

  if (actType === 'relay') {
    return `أنت مصمم أنشطة صفية تفاعلية. أنشئ نشاط "سباق التتابع" لمادة ${b.subject}، الصف ${b.grade}، موضوع "${b.topic}".
المدة: ${b.duration} دقيقة | الصعوبة: ${diffs[b.difficulty] ?? b.difficulty} | التجميع: ${groups[b.groupType] ?? b.groupType} | الهدف: ${goals[b.teachingGoal] ?? b.teachingGoal}
${b.additionalContext ? `\nمحتوى الكتاب المدرسي:\n${b.additionalContext}` : ''}

أعد JSON بالشكل الآتي (بالعربية الكاملة):
{
  "activityName": "سباق التتابع – ${b.topic}",
  "activityType": "relay",
  "grade": "${b.grade}",
  "subject": "${b.subject}",
  "lesson": "${b.topic}",
  "duration": ${b.duration},
  "difficulty": "${b.difficulty}",
  "groupType": "${b.groupType}",
  "learningObjective": "الهدف التعليمي بجملة واحدة",
  "materials": ["أوراق التتابع المطبوعة","مؤقت","أقلام ملونة"],
  "teacherPreparation": "خطوات إعداد المعلم وتقسيم الفرق",
  "slides": [
    { "slideNumber": 1, "type": "intro", "title": "🏃 سباق التتابع", "content": "شرح آلية السباق", "durationSeconds": 0 },
    {
      "slideNumber": 2,
      "type": "relay-problem",
      "title": "المسألة 1 من 4",
      "content": "نص المسألة الأولى مع المعطيات",
      "hint": "تلميح مساعد",
      "answer": "الإجابة الأولى (تُمرَّر للمسألة التالية)",
      "durationSeconds": ${Math.round((b.duration * 60) / 5)},
      "teacher": {
        "expectedAnswer": "الإجابة التفصيلية",
        "commonMisconceptions": "أخطاء شائعة",
        "teachingTips": "نصيحة للمعلم",
        "suggestedQuestions": ["سؤال متابعة"]
      }
    }
  ],
  "teacherNotes": ["ملاحظة 1"],
  "answerKey": ["المسألة 1: الإجابة الأولى","المسألة 2: …"],
  "printables": ["أوراق التتابع (نسخة لكل فريق)","لوحة النتائج"],
  "assessment": "كيف تقيّم النشاط",
  "extensionChallenge": "تحدٍّ إضافي للمتقدمين"
}
أنشئ سلسلة من 4-6 مسائل متصلة (إجابة كل مسألة تُمرَّر للتالية). أضف شريحة ملخص في النهاية.`;
  }

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
  const actType = b.activityType ?? 'escape-challenge';

  if (actType === 'bingo') {
    return `You are an interactive classroom activity designer. Create a "Vocabulary Bingo" activity for ${b.subject}, Grade ${b.grade}, topic "${b.topic}".
Duration: ${b.duration} min | Difficulty: ${b.difficulty} | Groups: ${b.groupType} | Goal: ${b.teachingGoal}
${b.additionalContext ? `\nTextbook context:\n${b.additionalContext}` : ''}

Return JSON in this exact shape (all text in English):
{
  "activityName": "Math Bingo – ${b.topic}",
  "activityType": "bingo",
  "grade": "${b.grade}",
  "subject": "${b.subject}",
  "lesson": "${b.topic}",
  "duration": ${b.duration},
  "difficulty": "${b.difficulty}",
  "groupType": "${b.groupType}",
  "learningObjective": "One-sentence learning objective",
  "materials": ["Printed bingo cards","Chips or paper scraps","Timer"],
  "teacherPreparation": "Teacher setup steps",
  "slides": [
    { "slideNumber": 1, "type": "intro", "title": "🎱 Vocabulary Bingo", "content": "How to play explanation", "durationSeconds": 0 },
    {
      "slideNumber": 2,
      "type": "bingo-call",
      "title": "Call 1",
      "content": "Clue or definition for the first term",
      "answer": "The correct term",
      "durationSeconds": 30,
      "teacher": {
        "expectedAnswer": "The called term",
        "teachingTips": "Teaching advice"
      }
    }
  ],
  "teacherNotes": ["note 1"],
  "answerKey": ["Term 1: its definition"],
  "printables": ["5×5 Bingo cards (unique per student)","Teacher caller list"],
  "assessment": "How to assess the activity",
  "extensionChallenge": "Extension challenge for advanced students"
}
Generate a caller list of at least ${Math.floor(b.duration / 2)} terms (one bingo-call slide per term). End with a summary slide.`;
  }

  if (actType === 'relay') {
    return `You are an interactive classroom activity designer. Create a "Relay Race" activity for ${b.subject}, Grade ${b.grade}, topic "${b.topic}".
Duration: ${b.duration} min | Difficulty: ${b.difficulty} | Groups: ${b.groupType} | Goal: ${b.teachingGoal}
${b.additionalContext ? `\nTextbook context:\n${b.additionalContext}` : ''}

Return JSON in this exact shape (all text in English):
{
  "activityName": "Relay Race – ${b.topic}",
  "activityType": "relay",
  "grade": "${b.grade}",
  "subject": "${b.subject}",
  "lesson": "${b.topic}",
  "duration": ${b.duration},
  "difficulty": "${b.difficulty}",
  "groupType": "${b.groupType}",
  "learningObjective": "One-sentence learning objective",
  "materials": ["Printed relay sheets","Timer","Coloured markers"],
  "teacherPreparation": "Teacher setup steps and team arrangement",
  "slides": [
    { "slideNumber": 1, "type": "intro", "title": "🏃 Relay Race", "content": "How the relay works", "durationSeconds": 0 },
    {
      "slideNumber": 2,
      "type": "relay-problem",
      "title": "Problem 1 of 4",
      "content": "Problem text with given data",
      "hint": "A helpful hint",
      "answer": "First answer (passed to the next problem)",
      "durationSeconds": ${Math.round((b.duration * 60) / 5)},
      "teacher": {
        "expectedAnswer": "Detailed expected answer",
        "commonMisconceptions": "Common student errors",
        "teachingTips": "Teaching advice",
        "suggestedQuestions": ["Follow-up question"]
      }
    }
  ],
  "teacherNotes": ["note 1"],
  "answerKey": ["Problem 1: first answer","Problem 2: …"],
  "printables": ["Relay worksheets (one per team)","Scoreboard"],
  "assessment": "How to assess the activity",
  "extensionChallenge": "Extension challenge for advanced students"
}
Generate a chain of 4–6 linked problems (each answer feeds the next). Add a summary slide at the end.`;
  }

  if (b.activityType === 'error-detective') {
    return `You are an interactive classroom activity designer. Create an "Error Detective" activity for ${b.subject}, Grade ${b.grade}, topic "${b.topic}".
Duration: ${b.duration} min | Difficulty: ${b.difficulty} | Groups: ${b.groupType} | Goal: ${b.teachingGoal}
${b.additionalContext ? `\nTextbook context:\n${b.additionalContext}` : ''}

Return JSON in this exact shape (all text in English):
{
  "activityName": "Error Detective – ${b.topic}",
  "activityType": "error-detective",
  "grade": "${b.grade}", "subject": "${b.subject}", "lesson": "${b.topic}",
  "duration": ${b.duration}, "difficulty": "${b.difficulty}", "groupType": "${b.groupType}",
  "learningObjective": "One-sentence objective about identifying and correcting errors",
  "materials": ["Printed error cards","Red correction pens"],
  "teacherPreparation": "Setup instructions",
  "slides": [
    { "slideNumber": 1, "type": "intro", "title": "🔍 Error Detective", "content": "How the activity works", "durationSeconds": 0 },
    {
      "slideNumber": 2, "type": "challenge", "title": "🕵️ Case 1 – Find the Error",
      "content": "Show a worked solution with ONE deliberate error for students to find",
      "hint": "A hint pointing toward the error type",
      "answer": "The error identified and the correct solution",
      "durationSeconds": ${Math.round((b.duration * 60) / 4)},
      "teacher": { "expectedAnswer": "Full correct solution", "commonMisconceptions": "Why students make this error", "teachingTips": "How to discuss the error constructively" }
    },
    { "slideNumber": 3, "type": "reveal", "title": "✅ Correct Solution", "content": "The full correct solution with explanation", "durationSeconds": 0 }
  ],
  "teacherNotes": ["note 1"],
  "answerKey": ["Error 1 description", "Error 2 description"],
  "printables": ["Error cards","Investigation report template"],
  "assessment": "How to assess understanding",
  "extensionChallenge": "Extension for advanced students"
}
Generate 3 error cases, each with a challenge slide followed by a reveal slide. End with a summary slide listing all errors found.`;
  }

  if (b.activityType === 'gallery-walk') {
    return `You are an interactive classroom activity designer. Create a "Gallery Walk" activity for ${b.subject}, Grade ${b.grade}, topic "${b.topic}".
Duration: ${b.duration} min | Difficulty: ${b.difficulty} | Groups: ${b.groupType} | Goal: ${b.teachingGoal}
${b.additionalContext ? `\nTextbook context:\n${b.additionalContext}` : ''}

Return JSON in this exact shape (all text in English):
{
  "activityName": "Gallery Walk – ${b.topic}",
  "activityType": "gallery-walk",
  "grade": "${b.grade}", "subject": "${b.subject}", "lesson": "${b.topic}",
  "duration": ${b.duration}, "difficulty": "${b.difficulty}", "groupType": "${b.groupType}",
  "learningObjective": "One-sentence objective about collaborative station-based exploration",
  "materials": ["5 large paper sheets posted on walls","Coloured markers","Sticky notes"],
  "teacherPreparation": "How to set up the 5 stations and manage group rotation",
  "slides": [
    { "slideNumber": 1, "type": "intro", "title": "🖼️ Gallery Walk", "content": "Explain the rotation rules and time per station", "durationSeconds": 0 },
    {
      "slideNumber": 2, "type": "challenge", "title": "📌 Station 1 – Foundations",
      "content": "A foundational problem for students to solve and write on the poster",
      "hint": "A guiding hint",
      "answer": "See the poster at this station",
      "durationSeconds": ${Math.round((b.duration * 60) / 6)},
      "teacher": { "expectedAnswer": "Expected answer for this station", "teachingTips": "What to look for when reviewing this station's poster" }
    }
  ],
  "teacherNotes": ["Circulate to guide discussion"],
  "answerKey": ["Station 1 answer", "Station 2 answer"],
  "printables": ["Station cards (A3)","Group tracking sheet"],
  "assessment": "How to review and debrief",
  "extensionChallenge": "Extension challenge"
}
Generate 5 station slides (foundations, application, analysis, evaluation, creative) plus a summary. Each station has a unique problem type.`;
  }

  if (b.activityType === 'exit-ticket') {
    return `You are an interactive classroom activity designer. Create an "Exit Ticket" activity for ${b.subject}, Grade ${b.grade}, topic "${b.topic}".
Duration: ${b.duration} min | Difficulty: ${b.difficulty} | Groups: ${b.groupType} | Goal: ${b.teachingGoal}
${b.additionalContext ? `\nTextbook context:\n${b.additionalContext}` : ''}

Return JSON in this exact shape (all text in English):
{
  "activityName": "Exit Ticket – ${b.topic}",
  "activityType": "exit-ticket",
  "grade": "${b.grade}", "subject": "${b.subject}", "lesson": "${b.topic}",
  "duration": ${b.duration}, "difficulty": "${b.difficulty}", "groupType": "${b.groupType}",
  "learningObjective": "Check understanding of ${b.topic} at the end of the lesson",
  "materials": ["Printed exit ticket (1 per student)","Pen"],
  "teacherPreparation": "Print tickets; reserve last ${b.duration} minutes of the lesson",
  "slides": [
    { "slideNumber": 1, "type": "intro", "title": "🎫 Exit Ticket", "content": "Instructions: individual work, hand in at the door", "durationSeconds": 0 },
    {
      "slideNumber": 2, "type": "challenge", "title": "❓ Question 1 – Recall",
      "content": "Define the main concept of ${b.topic} in your own words",
      "hint": "Think about what we covered at the start of today's lesson",
      "answer": "Flexible — assess understanding not memorisation",
      "durationSeconds": ${Math.round((b.duration * 60) / 4)},
      "teacher": { "expectedAnswer": "Student-worded definition", "teachingTips": "Look for conceptual understanding" }
    }
  ],
  "teacherNotes": ["Collect at door","Sort into: full / partial / needs support"],
  "answerKey": ["Q1: definition","Q2: application","Q3: critical thinking"],
  "printables": ["Exit ticket (one per student)"],
  "assessment": "Sort tickets into three piles by level of understanding",
  "extensionChallenge": "Use results to design a targeted warm-up next lesson"
}
Generate 3 questions: recall, application, critical thinking. Each is a challenge slide. End with a 'pens down' summary slide.`;
  }

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
