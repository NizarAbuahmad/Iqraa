/**
 * The prompts the generators actually ship.
 *
 * Split out of `routes/generate.ts` so they can be imported without pulling in
 * the OpenAI client, which that file constructs at module scope and which
 * throws without a key (see CLAUDE.md). The provider-eval script needs the
 * real shipped prompts — comparing models on a prompt written for the
 * comparison would measure the wrong thing.
 *
 * The classroom-activity prompts stay in the route: they are ~400 lines and
 * nothing outside that route uses them.
 */

// ─── System prompts ──────────────────────────────────────────────────────────
/**
 * Why the figure rule is in the SYSTEM prompt and not one builder
 * ───────────────────────────────────────────────────────────────
 * Decks shipped with checks reading «يمثل الرسم البياني خطين مستقيمين…» beside
 * an empty slide. Nothing in this repo writes that sentence — the model does,
 * unprompted, and it did it across activity types. So the rule belongs where
 * every generator sees it rather than in the one builder that got caught.
 *
 * The latin-variable clause is load-bearing, not a style note.
 * `extractGraphCommands` matches `[a-z]` terms, so «y = 2س + 1» yields NOTHING
 * and the question is dropped exactly as if it had named no equations at all.
 * A rule that said only "state the equations" would have produced compliant
 * questions that still showed no graph. Verified before writing this: latin
 * «y = 2x + 1 و y = -x + 4» extracts both curves; the س form extracts zero.
 *
 * Display-time conversion to س is unaffected — that happens in the app, well
 * after extraction, per the repo's compute-in-latin convention.
 */
const FIGURE_RULE_AR = `قاعدة الرسوم والأشكال: لا تكتب سؤالًا يشير إلى رسم بياني أو شكل («يمثل الرسم البياني…»، «في الشكل المجاور…»، «الرسم الظاهر») إلا إذا ذكرتَ في نص السؤال نفسه معادلات ذلك الرسم.
يرسم التطبيق المنحنيات من المعادلات الواردة في النص فقط، فإن أشرتَ إلى رسم بلا معادلات لن يرى الطلبة شيئًا ويُحذف السؤال.
اكتب المعادلات بالحرفين اللاتينيين x و y حتى لو كان باقي النص عربيًا — مثال صحيح: «يمثل الرسم البياني المستقيمين y = 2x + 1 و y = -x + 4، جد نقطة تقاطعهما».
وإن أردتَ سؤالًا بلا معادلات فاكتبه بلا أي إشارة إلى رسم.`;

const FIGURE_RULE_EN = `Figures and graphs: never write a question that refers to a graph or figure ("the graph shows…", "in the diagram…", "the graph above") unless the question text itself states that figure's equations.
The app draws curves only from equations found in the text, so a question pointing at a figure without them shows students nothing and is dropped.
Write equations with latin x and y — correct example: "The graph shows the lines y = 2x + 1 and y = -x + 4; find their intersection."
If you want a question with no equations, write it with no reference to a figure.`;

export const SYSTEM_AR = `أنت مولّد محتوى تعليمي متخصص للمنهج الأردني.
قم بإنشاء محتوى احترافي ودقيق مناسب للمعلمين.
أجب دائمًا بـJSON صحيح فقط، بدون أي نص إضافي قبله أو بعده.
استخدم اللغة العربية الفصيحة في جميع النصوص.

${FIGURE_RULE_AR}`;

export const SYSTEM_EN = `You are an educational content generator specialized in the Jordanian curriculum.
Produce professional, accurate content suitable for teachers.
Always respond with valid JSON only, no text before or after.
Use clear academic English throughout.

${FIGURE_RULE_EN}`;

// ─── Prompt builders ─────────────────────────────────────────────────────────
export function lessonPlanPromptAr(b: any): string {
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

export function lessonPlanPromptEn(b: any): string {
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

export function worksheetPromptAr(b: any): string {
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

export function worksheetPromptEn(b: any): string {
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

export function quizPromptAr(b: any): string {
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

export function quizPromptEn(b: any): string {
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
export function activityPromptAr(b: any): string {
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

export function activityPromptEn(b: any): string {
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
