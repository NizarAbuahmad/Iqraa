import { Router, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";
import {
  SYSTEM_AR,
  SYSTEM_EN,
  activityPromptAr,
  activityPromptEn,
  lessonPlanPromptAr,
  lessonPlanPromptEn,
  quizPromptAr,
  quizPromptEn,
  worksheetPromptAr,
  worksheetPromptEn,
} from "../lib/prompts.ts";

import {
  AiBudgetExceededError,
  AiLiveModeOffError,
  assertBudgetAvailable,
  assertLiveModeEnabled,
  getGenerationModel,
  recordUsage,
} from "../lib/aiBudget.ts";
import {
  assertUsableGeneration,
  UnusableGenerationError,
  type GenerationKind,
} from "../lib/generationShape.ts";

const generateRouter = Router();

/**
 * Output ceiling for a generated artifact.
 *
 * Generous on purpose: the cost of a ceiling that is too high is a few unused
 * tokens; the cost of one that is too low is a truncated artifact that looks
 * like a successful generation. The budget guard, not this number, is what
 * limits spend.
 */
const GENERATION_TOKENS = 8000;

/**
 * Shared by every route below: gate on AI_LIVE_MODE + budget, call the model,
 * parse JSON out.
 *
 * On the ceiling: these were 1500–2000, which is tight for a full Arabic
 * lesson plan and outright breaks a reasoning model — reasoning tokens are
 * billed as output and count against the same ceiling, so the model can spend
 * the whole budget thinking and return a truncated object. The failure is
 * silent: `extractJSON` on a truncated response yields a partial object or
 * `{}`, the route answers 200, and the client renders an empty lesson plan.
 * The ceiling is now set per task below with room for that.
 */
async function generateContent(
  kind: GenerationKind,
  systemPrompt: string,
  userPrompt: string,
  maxCompletionTokens: number,
): Promise<unknown> {
  assertLiveModeEnabled();
  assertBudgetAvailable();
  const completion = await openai.chat.completions.create({
    model: getGenerationModel(),
    max_completion_tokens: maxCompletionTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
  recordUsage(completion.usage, getGenerationModel());
  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = extractJSON(raw);
  // Valid JSON is not the same as a usable artifact. Without this the route
  // answered 200 with `{}` and the screen rendered a blank lesson plan.
  assertUsableGeneration(kind, parsed);
  return parsed;
}

/** AI live-mode-off and budget-exceeded are expected, user-facing states — not server errors. */
function respondAiError(err: unknown, res: Response, label: string): void {
  if (err instanceof AiLiveModeOffError) {
    res.status(503).json({ error: err.message });
    return;
  }
  if (err instanceof AiBudgetExceededError) {
    res.status(429).json({ error: err.message });
    return;
  }
  if (err instanceof UnusableGenerationError) {
    // 502, not 500: the request was fine, the upstream reply was not. Naming
    // the missing fields is the point — a bare "generation failed" is how this
    // stayed invisible for as long as it did.
    logger.error({ kind: err.kind, missing: err.missing }, `${label} returned an unusable shape`);
    res.status(502).json({ error: err.message, missing: err.missing });
    return;
  }
  logger.error({ err }, `${label} error`);
  res.status(500).json({ error: "AI generation failed. Please try again." });
}

// ─── Lesson Plan ─────────────────────────────────────────────────────────────
generateRouter.post("/generate/lesson-plan", async (req, res) => {
  try {
    const body = req.body;
    const isAr = body.language !== "english";
    const prompt = isAr ? lessonPlanPromptAr(body) : lessonPlanPromptEn(body);
    const parsed = await generateContent("lesson-plan", isAr ? SYSTEM_AR : SYSTEM_EN, prompt, GENERATION_TOKENS);
    res.json(parsed);
  } catch (err) {
    respondAiError(err, res, "generate lesson-plan");
  }
});

// ─── Worksheet ────────────────────────────────────────────────────────────────
generateRouter.post("/generate/worksheet", async (req, res) => {
  try {
    const body = req.body;
    const isAr = body.language !== "english";
    const prompt = isAr ? worksheetPromptAr(body) : worksheetPromptEn(body);
    const parsed = await generateContent("worksheet", isAr ? SYSTEM_AR : SYSTEM_EN, prompt, GENERATION_TOKENS);
    res.json(parsed);
  } catch (err) {
    respondAiError(err, res, "generate worksheet");
  }
});

// ─── Quiz ─────────────────────────────────────────────────────────────────────
generateRouter.post("/generate/quiz", async (req, res) => {
  try {
    const body = req.body;
    const isAr = body.language !== "english";
    const prompt = isAr ? quizPromptAr(body) : quizPromptEn(body);
    const parsed = await generateContent("quiz", isAr ? SYSTEM_AR : SYSTEM_EN, prompt, GENERATION_TOKENS);
    res.json(parsed);
  } catch (err) {
    respondAiError(err, res, "generate quiz");
  }
});

// ─── Homework ─────────────────────────────────────────────────────────────────
generateRouter.post("/generate/homework", async (req, res) => {
  try {
    const body = req.body;
    const isAr = body.language !== "english";
    const prompt = isAr ? worksheetPromptAr({ ...body, homework: true }) : worksheetPromptEn({ ...body, homework: true });
    const parsed = await generateContent("homework", isAr ? SYSTEM_AR : SYSTEM_EN, prompt, GENERATION_TOKENS);
    res.json(parsed);
  } catch (err) {
    respondAiError(err, res, "generate homework");
  }
});

// ─── Activity ─────────────────────────────────────────────────────────────────
generateRouter.post("/generate/activity", async (req, res) => {
  try {
    const body = req.body;
    const isAr = body.language !== "english";
    const prompt = isAr ? activityPromptAr(body) : activityPromptEn(body);
    const parsed = await generateContent("activity", isAr ? SYSTEM_AR : SYSTEM_EN, prompt, GENERATION_TOKENS);
    res.json(parsed);
  } catch (err) {
    respondAiError(err, res, "generate activity");
  }
});


// ─── Classroom Activity route ─────────────────────────────────────────────────
// Every other route in this file is under /generate/*, which is exactly the
// prefix routes/index.ts scopes authMiddleware to. This one was registered
// bare, at /classroom-activity, so it never went through the guard — an
// unauthenticated, unlimited proxy onto the OpenAI account. Same failure
// shape as the roster/evaluations mount-order incident; see routes/index.ts.
generateRouter.post('/generate/classroom-activity', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const isAr = body.language === 'arabic';
  try {
    const prompt = isAr ? classroomPromptAr(body) : classroomPromptEn(body);
    const data = await generateContent("classroom-activity", isAr ? SYSTEM_AR : SYSTEM_EN, prompt, GENERATION_TOKENS);
    res.json(data);
  } catch (err) {
    respondAiError(err, res, "generate classroom-activity");
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
