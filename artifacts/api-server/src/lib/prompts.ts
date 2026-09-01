/**
 * The prompts the generators actually ship.
 *
 * Split out of `routes/generate.ts` so they can be imported without pulling in
 * the OpenAI client, which that file constructs at module scope and which
 * throws without a key (see CLAUDE.md). The provider-eval script needs the
 * real shipped prompts — comparing models on a prompt written for the
 * comparison would measure the wrong thing.
 *
 * The classroom-activity prompts live in `lib/classroomPrompts.ts` instead of
 * here — they outgrew this file's per-artifact-type shape once the Arabic
 * side needed the same 7 activity-type branches as the English side.
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

/**
 * Generic across every subject and grade on purpose: the book-fidelity gap
 * CLAUDE.md records for math ("قانون الجيوب" resolving to a different lesson
 * than "قانون جيب التمام") is a terminology problem, not a math-specific one —
 * chemistry and finlit fail the same way with their own vocabulary. The one
 * thing every subject's `additionalContext` shares is that it IS the book, so
 * "quote its wording" is the one rule that covers all of them; a hardcoded
 * glossary here would only ever cover the subjects someone thought to list.
 */
const STYLE_RULE_AR = `الالتزام بلغة الكتاب: إن ورد أدناه "سياق الكتاب المدرسي"، استعمل مصطلحاته وتراكيبه وأسلوبه بالحرف — لا تستبدلها بمرادفات عامة أو ترجمة حرة، ولا تُدخل مفاهيم أو مصطلحات غير واردة فيه ولو كانت صحيحة علميًا. الرموز والمتغيرات في النص العادي (كـ س، ص، ع) تتبع ما ورد في السياق؛ الاستثناء الوحيد معادلات الرسوم البيانية التي تبقى بالحرفين اللاتينيين x وy وفق قاعدة الرسوم أدناه.`;

const STYLE_RULE_EN = `Match the textbook's own language: if an "additional context" / textbook passage is supplied below, reuse its exact terms, phrasing and style rather than generic paraphrasing or free translation, and do not introduce concepts or terms it does not contain, even if scientifically valid. This does not override the figures rule below — graph equations still stay in latin x/y.`;

export const SYSTEM_AR = `أنت مولّد محتوى تعليمي متخصص للمنهج الأردني.
قم بإنشاء محتوى احترافي ودقيق مناسب للمعلمين.
أجب دائمًا بـJSON صحيح فقط، بدون أي نص إضافي قبله أو بعده.
استخدم اللغة العربية الفصيحة في جميع النصوص.

${STYLE_RULE_AR}

${FIGURE_RULE_AR}`;

export const SYSTEM_EN = `You are an educational content generator specialized in the Jordanian curriculum.
Produce professional, accurate content suitable for teachers.
Always respond with valid JSON only, no text before or after.
Use clear academic English throughout.

${STYLE_RULE_EN}

${FIGURE_RULE_EN}`;

// ─── Teaching style ──────────────────────────────────────────────────────────
/**
 * What each teaching style commits the WHOLE lesson to.
 *
 * Both builders used to interpolate the style's name into one line and stop —
 * the English one passed the raw enum token. Nothing told the model that
 * inquiry means students meet the phenomenon before the rule is named, or that
 * collaborative practice cannot end in "no peer discussion". The offline
 * generator had the same defect and now carries per-style phases in
 * `artifacts/mobile/services/ai/lessonPlanBlueprints.ts`; keep the two in step.
 */
const LESSON_STYLE_RULES_AR: Record<string, string> = {
  direct: `أسلوب مباشر (أنا أفعل / نحن نفعل / أنت تفعل). التزم بالتسلسل: شرح بأمثلة محلولة كاملة، ثم حل مشترك يوجّهه الطلاب خطوة بخطوة، ثم عمل فردي صامت.
هنا فقط يكون التدريب المستقل فرديًا بلا نقاش — لأن النموذج نفسه يقتضي ذلك.`,
  inquiry: `أسلوب استقصائي. القاعدة تأتي في النهاية لا في البداية:
- "mainActivity": اطرح سؤال التحقيق دون إعطاء القاعدة، ويستكشف الطلاب أمثلة أو بيانات ويكتبون **تخمينهم** للقاعدة.
- "guidedPractice": لا تشرح القاعدة. اضغط على التخمينات («ما دليلك؟»، «هل تنطبق على هذه الحالة؟») وقدّم حالة تكسر تخمينًا شائعًا. سمِّ المصطلح العلمي بعد أن يستقر الصف على صياغة.
- "independentPractice": يختبر كل طالب الاستنتاج على حالة جديدة لم تُناقَش، ويكتب إن صمد أم لا وما الشرط الناقص.
- "assessment": قيّم جودة الاستدلال والدليل، لا سرعة الوصول إلى القاعدة.
ممنوع: أن تبدأ الحصة بتعريف القاعدة أو باسم المصطلح.`,
  collaborative: `أسلوب تعاوني باعتماد متبادل حقيقي:
- "mainActivity": أربع بطاقات مهمة **مختلفة** لكل مجموعة، بطاقة لكل فرد، ثم يشرح كل فرد بطاقته لمجموعته، ولا تكتمل إجابة المجموعة بغياب أي جزء.
- "guidedPractice": نقد متبادل بين المجموعات (تبادل الألواح، نقطة قوة وسؤال حقيقي، ثم ردّ أمام الصف) — لا حل نموذجي من المعلم.
- "independentPractice": مساءلة فردية **بعد** العمل الجماعي: ورقة قصيرة يجيب عنها كل طالب وحده وتغطي البطاقات الأربع كلها.
ممنوع تمامًا: أي عبارة تمنع النقاش بين الطلاب («المناقشة بين الطلاب مؤجّلة») — فهي تناقض الأسلوب الذي بُنيت عليه الحصة.`,
};

const LESSON_STYLE_RULES_EN: Record<string, string> = {
  direct: `Direct instruction (I do / we do / you do). Keep the sequence: teach with fully worked examples, then a shared solve that students direct step by step, then silent individual work.
Only here is independent practice individual and discussion-free — the model itself requires it.`,
  inquiry: `Inquiry. The rule comes last, not first:
- "mainActivity": pose the investigation question WITHOUT giving the rule; students explore examples or data and write their **conjecture** of the rule.
- "guidedPractice": do not explain the rule. Press on the conjectures ("What is your evidence?", "Does it hold for this case?") and offer a case built to break a common one. Attach the formal term only after the class settles on a wording.
- "independentPractice": each student tests the conclusion on a new, undiscussed case and writes whether it held and what condition was missing.
- "assessment": judge the quality of the reasoning and evidence, not the speed of reaching the rule.
Forbidden: opening the lesson by stating the rule or naming the term.`,
  collaborative: `Collaborative, with real interdependence:
- "mainActivity": four **different** task cards per group, one per member; each teaches their card to the group; the group answer cannot be completed if a part is missing.
- "guidedPractice": group-to-group critique (swap boards, one genuine strength and one genuine question, then answer in front of the class) — not a teacher-modelled solution.
- "independentPractice": individual accountability AFTER the group work: a short sheet each student answers alone covering all four cards.
Strictly forbidden: any clause banning peer discussion ("peer discussion is not permitted") — it contradicts the style the lesson was built on.`,
};

function lessonStyleKey(b: any): string {
  const st = b.teachingStyle;
  return st === "inquiry" || st === "collaborative" ? st : "direct";
}

export function lessonStyleClauseAr(b: any): string {
  const key = lessonStyleKey(b);
  const label: Record<string, string> = { direct: "مباشر", inquiry: "استقصائي", collaborative: "تعاوني" };
  return `أسلوب التدريس: ${label[key]}
بنية هذا الأسلوب — التزم بها في كل حقول الخطة، لا في "mainActivity" وحده:
${LESSON_STYLE_RULES_AR[key]}`;
}

export function lessonStyleClauseEn(b: any): string {
  const key = lessonStyleKey(b);
  return `Teaching style: ${key}
The structure this style requires — follow it across EVERY field of the plan, not just "mainActivity":
${LESSON_STYLE_RULES_EN[key]}`;
}

// ─── Prompt builders ─────────────────────────────────────────────────────────
export function lessonPlanPromptAr(b: any): string {
  const priorConcepts = b.includePriorReview && Array.isArray(b.priorKnowledge) && b.priorKnowledge.length
    ? b.priorKnowledge
    : null;
  const priorNotes = typeof b.priorTopicsNotes === "string" ? b.priorTopicsNotes.trim() : "";
  const hasPriorReview = Boolean(priorConcepts || priorNotes);
  return `أنشئ خطة درس كاملة لمادة ${b.subject} للصف ${b.grade} حول موضوع "${b.topic}"، مدتها ${b.duration ?? 45} دقيقة.
${b.objectives ? `الأهداف المحددة:\n${b.objectives}` : ""}
${b.additionalContext ? `سياق إضافي: ${b.additionalContext}` : ""}
${lessonStyleClauseAr(b)}
${hasPriorReview ? `
خصّص 5-10 دقائق في بداية الحصة لمراجعة معارف سابقة قد لا يتقنها بعض الطلبة، واكتب خطة هذه المراجعة في حقل "priorReview". هذه مراجعة تمهيدية وليست من أهداف هذا الدرس، فلا تُدرجها ضمن "objectives".
${priorConcepts ? `مفاهيم من المنهج يجب مراجعتها حرفيًا (لا تختلق غيرها):\n- ${priorConcepts.join("\n- ")}` : ""}
${priorNotes ? `ملاحظات المعلم عن موضوعات سابقة (قد تكون من دروس أو صفوف سابقة كالصف التاسع) يريد إعادة شرحها لأن بعض الطلبة لم يستوعبوها جيدًا؛ التزم بها كما هي:\n${priorNotes}` : ""}` : ""}

أعد JSON بالشكل الآتي (بالعربية):
{
  "title": "عنوان الدرس",
  "grade": "${b.grade}",
  "subject": "${b.subject}",
  "duration": ${b.duration ?? 45},
  "objectives": ["هدف 1", "هدف 2", "هدف 3"],
  "materials": ["مادة 1", "مادة 2"],${hasPriorReview ? `
  "priorReview": "خطة مراجعة المعارف السابقة (فقرة)",` : ""}
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
  const priorConcepts = b.includePriorReview && Array.isArray(b.priorKnowledge) && b.priorKnowledge.length
    ? b.priorKnowledge
    : null;
  const priorNotes = typeof b.priorTopicsNotes === "string" ? b.priorTopicsNotes.trim() : "";
  const hasPriorReview = Boolean(priorConcepts || priorNotes);
  return `Create a complete lesson plan for ${b.subject}, ${b.grade}, on the topic "${b.topic}", duration ${b.duration ?? 45} minutes.
${b.objectives ? `Specified objectives:\n${b.objectives}` : ""}
${b.additionalContext ? `Additional context: ${b.additionalContext}` : ""}
${lessonStyleClauseEn(b)}
${hasPriorReview ? `
Set aside 5-10 minutes at the start of the lesson to review prior material some students may not have fully grasped, and put that review plan in a "priorReview" field. This is a warm-up review, not one of this lesson's own objectives — do not list it under "objectives".
${priorConcepts ? `Curriculum concepts to review verbatim (do not invent others):\n- ${priorConcepts.join("\n- ")}` : ""}
${priorNotes ? `Teacher's notes on prior topics (may be from earlier lessons or earlier grades, e.g. grade 9) they want re-explained because some students did not understand them well; follow these as given:\n${priorNotes}` : ""}` : ""}

Return JSON in this exact shape:
{
  "title": "Lesson title",
  "grade": "${b.grade}",
  "subject": "${b.subject}",
  "duration": ${b.duration ?? 45},
  "objectives": ["objective 1", "objective 2", "objective 3"],
  "materials": ["item 1", "item 2"],${hasPriorReview ? `
  "priorReview": "Prior-knowledge review plan (paragraph)",` : ""}
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
عدد الأسئلة: ${n}
أنواع الأسئلة المطلوبة: ${types.join(", ")}
${difficultyClauseAr(b)}
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
Number of questions: ${n}
${difficultyClauseEn(b)}
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
${quizDifficultyClauseAr(b)}
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
${quizDifficultyClauseEn(b)}
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

// ─── Difficulty ──────────────────────────────────────────────────────────────
/**
 * What a difficulty tier actually means, and how it lands on each artifact.
 *
 * The worksheet prompt used to interpolate the level name and stop; the quiz
 * prompt never mentioned `difficulty` at all. So the live path ignored the
 * picker exactly as the offline generator did — see the matching tiering in
 * `artifacts/mobile/services/ai/generators.ts` (`pickTiered`, and the
 * worksheet's `BANDS`). Keep the two in step: a teacher must not get a
 * different paper depending on whether live generation was on.
 *
 * A worksheet SHIFTS its band rather than flattening it — the easy → hard
 * progression is the scaffolding, and a "hard" worksheet that opens at hard
 * has thrown it away. A quiz is a flat assessment and takes the tier straight.
 */
const DIFFICULTY_MEANING_AR: Record<string, string> = {
  easy: "استرجاع وتعريف مباشر، خطوة واحدة، أرقام بسيطة.",
  medium: "تطبيق القاعدة على موقف مألوف، خطوتان أو ثلاث.",
  hard: "مقارنة أو تحليل أو موقف غير مألوف يتطلب اختيار الأسلوب المناسب أولًا.",
  mixed: "وزّع الأسئلة على المستويات الثلاثة (سهل / متوسط / صعب) بدل أن تجعلها كلها متوسطة.",
};

const DIFFICULTY_MEANING_EN: Record<string, string> = {
  easy: "Direct recall or definition; one step; simple numbers.",
  medium: "Apply the rule to a familiar situation; two or three steps.",
  hard: "Comparison, analysis, or an unfamiliar situation where the method must be chosen first.",
  mixed: "Spread the questions across all three levels rather than making them all medium.",
};

/** The three worksheet sections' tiers for a requested level — shifted, not flattened. */
const WORKSHEET_BAND: Record<string, [string, string, string]> = {
  easy: ["easy", "easy", "medium"],
  medium: ["easy", "medium", "hard"],
  hard: ["medium", "hard", "hard"],
};

function difficultyKey(b: any): string {
  const d = b.difficulty;
  return d === "easy" || d === "hard" || d === "mixed" ? d : "medium";
}

export function difficultyClauseAr(b: any): string {
  const key = difficultyKey(b);
  if (key === "mixed") return `\nالمستوى: متنوّع. ${DIFFICULTY_MEANING_AR.mixed}`;
  const band = WORKSHEET_BAND[key];
  const label: Record<string, string> = { easy: "سهل", medium: "متوسط", hard: "صعب" };
  return `\nالمستوى المطلوب: ${label[key]} — ${DIFFICULTY_MEANING_AR[key]}
تدرّج الورقة (التزم به): القسم الأول ${label[band[0]]}، الثاني ${label[band[1]]}، الثالث ${label[band[2]]}.
لا تجعل الأقسام الثلاثة بالمستوى نفسه — التدرّج هو الهدف، والمستوى المطلوب ينقل النطاق لا يلغيه.`;
}

export function difficultyClauseEn(b: any): string {
  const key = difficultyKey(b);
  if (key === "mixed") return `\nDifficulty: mixed. ${DIFFICULTY_MEANING_EN.mixed}`;
  const band = WORKSHEET_BAND[key];
  return `\nRequested difficulty: ${key} — ${DIFFICULTY_MEANING_EN[key]}
Worksheet progression (follow it): section 1 ${band[0]}, section 2 ${band[1]}, section 3 ${band[2]}.
Do not make all three sections the same level — the progression is the point; the requested level shifts the band rather than removing it.`;
}

export function quizDifficultyClauseAr(b: any): string {
  const key = difficultyKey(b);
  const label: Record<string, string> = { easy: "سهل", medium: "متوسط", hard: "صعب", mixed: "متنوّع" };
  return `\nمستوى الأسئلة: ${label[key]} — ${DIFFICULTY_MEANING_AR[key]}`;
}

export function quizDifficultyClauseEn(b: any): string {
  const key = difficultyKey(b);
  return `\nQuestion difficulty: ${key} — ${DIFFICULTY_MEANING_EN[key]}`;
}

// ─── Activity prompt builders ────────────────────────────────────────────────
/**
 * Per-format structure rules for the single-activity generator.
 *
 * The prompt used to inject the type name into one opening sentence and then
 * ask for the same fixed JSON shape for all five formats, so the model had
 * nothing to differentiate on — a "game" came back as the same four
 * cooperative steps with the word game in the title. These clauses say what
 * each format has to STRUCTURALLY contain, mirroring the blueprints the
 * offline generator builds in `artifacts/mobile/services/ai/activityBlueprints.ts`.
 * Keep the two in step: a teacher must not get a different kind of activity
 * depending on whether live generation was on.
 */
const ACTIVITY_FORMAT_RULES_AR: Record<string, string> = {
  individual: `هذا نشاط فردي. يجب أن يتضمن بالترتيب: استرجاع صامت من الذاكرة والدفاتر مغلقة، ثم مثال محلول بالكامل يدرسه الطالب ولا يحله، ثم تدرّب متدرّج (سؤال نصفه محلول ثم سؤال بلا مساعدة)، ثم سؤال يشرح فيه الطالب لنفسه سبب صحة خطوته الأولى.
ممنوع تمامًا: المجموعات، توزيع الأدوار، العروض التقديمية، أي عبارة فيها «قسّم الطلاب» أو «كل مجموعة». حجم المجموعة هو «فردي».
مواد النشاط أدوات فردية (دفتر، بطاقة مثال محلول، ورقة عمل) لا مواد جماعية.`,
  group: `هذا نشاط تعلّم تعاوني بنية جيقسو حقيقية. يجب أن يتضمن: مجموعات أساسية من 4 يأخذ كل فرد فيها مهمة **مختلفة** عن زملائه (اذكر المهام الأربع صراحة)، ثم مجموعات خبراء يجتمع فيها أصحاب المهمة نفسها، ثم عودة كل خبير ليعلّم جزءه، ثم مساءلة فردية عشوائية يُسحب فيها رقم فيعرض صاحبه إجابة مجموعته كاملة.
اشترط أن إجابة المجموعة لا تكتمل بغياب أي جزء — هذا هو الاعتماد المتبادل، وبدونه يعمل طالب واحد ويشاهد ثلاثة.`,
  discussion: `هذا نقاش صفّي، وليس عملًا في مجموعات. يجب أن يتضمن: ادعاءً واحدًا قابلًا للجدل مصاغًا كجملة تقريرية (خطأ شائع معقول، لا عبارة صحيحة يتفق عليها الجميع)، تصويتًا أوليًا، دقيقتَي تفكير فردي صامت يكتب فيهما الطالب موقفه وسببًا واحدًا، مرحلة ثنائية يعيد فيها كل طالب صياغة سبب زميله قبل الرد، نقاشًا صفّيًا تديره بعبارات إدارة الحوار (من يعيد صياغة ما قاله زميله؟ ما دليلك؟ متى يفشل هذا الادعاء؟)، ثم تصويتًا ثانيًا يُقارن بالأول.
ممنوع: أوراق العمل، الأدوار داخل المجموعة، العروض. لا تكشف الحكم على الادعاء قبل الخطوة الأخيرة.`,
  "hands-on": `هذا نشاط تطبيقي عملي بمواد ملموسة. يجب أن يُنتج الطلاب شيئًا ماديًا: بناء أو قص أو قياس أو تركيب نموذج. يجب أن يتضمن خطوة يقارن فيها الطالب **القيمة التي قاسها** بالقيمة التي تعطيها القاعدة ويفسّر الفرق بينهما.
قائمة المواد يجب أن تكون أدوات حقيقية (ورق مقوّى، مقص، مسطرة، منقلة، خيط، آلة حاسبة) لا «أوراق عمل مطبوعة» فقط. نشاط يُحلّ كله على الورق ليس نشاطًا تطبيقيًا.`,
  game: `هذه لعبة تعليمية تنافسية، ولا تكفي تسميتها لعبة. يجب أن تتضمن صراحةً: قواعد مكتوبة تُعلن قبل البدء، فرقًا مسمّاة، جولتين على الأقل بنظام نقاط مختلف بينهما (الثانية بمخاطرة/رهان يعلنه الفريق قبل رؤية السؤال)، لوحة نتائج محدَّثة أمام الجميع، مؤقتًا لكل سؤال، وشرط فوز واضح.
واختم بخطوة مراجعة للسؤال الذي أخطأت فيه أكثر الفرق — بلا هذه الخطوة تبقى المتعة وتضيع الفائدة.`,
  warmup: `هذه تهيئة قصيرة في بداية الحصة، لا نسخة مصغّرة من نشاط الحصة. ثلاث خطوات فقط: استرجاع من الذاكرة للمعرفة **السابقة** والدفاتر مغلقة، سؤال تحقّق واحد، ثم جملة تربط ما استُرجع بهدف حصة اليوم.
ممنوع: شرح المحتوى الجديد، المجموعات، العروض، بطاقات الخروج.`,
};

const ACTIVITY_FORMAT_RULES_EN: Record<string, string> = {
  individual: `This is an INDIVIDUAL activity. It must contain, in order: silent retrieval from memory with notebooks closed; a fully worked example the student studies rather than solves; faded practice (one half-solved item, then one unaided); and a self-explanation prompt asking why their first step was legal.
Strictly forbidden: groups, role assignment, presentations, any phrase like "divide students into" or "each group". Group size is "Individual".
Materials must be individual tools (notebook, worked-example card, worksheet), not group supplies.`,
  group: `This is a cooperative activity with a real JIGSAW structure. It must contain: home groups of 4 where each member takes a **different** task from their teammates (state all four tasks explicitly); expert groups where students holding the same task meet; a return where each expert teaches their part; and random individual accountability where a drawn number decides who reports the group's whole answer.
Require that the group answer cannot be completed if any part is missing — that interdependence is the point; without it one student works and three watch.`,
  discussion: `This is a whole-class DISCUSSION, not group work. It must contain: one contestable claim written as an assertion (a plausible misconception, not a true statement everyone agrees with); an initial vote; two minutes of silent individual thinking where each student writes a position plus one reason; a paired stage where each student restates their partner's reason before responding; a whole-class discussion run with talk moves (who can restate that? what is your evidence? when does this claim fail?); and a second vote compared with the first.
Forbidden: worksheets, in-group roles, presentations. Do not settle the claim before the final step.`,
  "hands-on": `This is a HANDS-ON activity with physical materials. Students must produce something physical: build, cut, measure, or assemble a model. It must contain a step where students compare **the value they measured** with the value the rule predicts and account for the gap.
The materials list must be real equipment (card stock, scissors, ruler, protractor, string, calculator), not just "printed worksheets". An activity done entirely on paper is not hands-on.`,
  game: `This is a competitive learning GAME — calling it a game is not enough. It must explicitly contain: written rules announced before play; named teams; at least two rounds scored differently (the second with a wager the team declares before seeing the question); a scoreboard updated in full view; a timer per question; and a clear win condition.
Close with a review of the question most teams got wrong — without it the fun stays and the learning does not.`,
  warmup: `This is a short lesson-opening WARM-UP, not a miniature version of the lesson activity. Exactly three steps: retrieval of **prior** knowledge from memory with notebooks closed; one quick check question; and a sentence bridging what was retrieved to today's objective.
Forbidden: teaching the new content, groups, presentations, exit tickets.`,
};

/** The format the activity should be built as — `activityVariant` wins. */
function activityFormatKey(b: any): string {
  return b.activityVariant === "warmup" ? "warmup" : (b.activityType ?? "group");
}

export function activityPromptAr(b: any): string {
  const key = activityFormatKey(b);
  const dur = b.duration ?? (key === "warmup" ? 8 : 30);
  const typeLabel: Record<string, string> = {
    individual: "فردي", group: "جماعي تعاوني", discussion: "نقاش صفي",
    "hands-on": "تطبيقي عملي", game: "لعبة تعليمية", warmup: "تهيئة واسترجاع",
  };
  const rule = ACTIVITY_FORMAT_RULES_AR[key] ?? ACTIVITY_FORMAT_RULES_AR.group;
  return `صمّم نشاطًا تعليميًا ${typeLabel[key] ?? key} لمادة ${b.subject} للصف ${b.grade} حول موضوع "${b.topic}".
مدة النشاط: ${dur} دقيقة.
${b.objectives ? `هدف النشاط: ${b.objectives}` : ""}
${b.additionalContext ? `\nسياق الكتاب المدرسي:\n${b.additionalContext}` : ""}

بنية هذا النوع من الأنشطة — التزم بها ولا تستبدلها ببنية عامة:
${rule}

قواعد عامة:
- مجموع durationMin لكل الخطوات يجب أن يساوي ${dur} بالضبط.
- اكتب خطوات يستطيع المعلم تنفيذها كما هي: ماذا يقول، ماذا يوزّع، كم دقيقة، وماذا يفعل الطلاب.
- يجب أن تعكس المواد والنصائح والتقييم هذا النوع تحديدًا؛ لا تكتب نصائح عن المجموعات في نشاط فردي.

أعد JSON بالشكل الآتي (بالعربية):
{
  "title": "عنوان النشاط",
  "activityType": "${key}",
  "totalDuration": ${dur},
  "objective": "هدف النشاط بجملة واحدة",
  "groupSize": "حجم المجموعة المناسب لهذا النوع",
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
  const key = activityFormatKey(b);
  const dur = b.duration ?? (key === "warmup" ? 8 : 30);
  const rule = ACTIVITY_FORMAT_RULES_EN[key] ?? ACTIVITY_FORMAT_RULES_EN.group;
  return `Design a ${key} classroom activity for ${b.subject}, ${b.grade}, on the topic "${b.topic}".
Duration: ${dur} minutes.
${b.objectives ? `Lesson objective: ${b.objectives}` : ""}
${b.additionalContext ? `\nTextbook context:\n${b.additionalContext}` : ""}

Structure required for this format — follow it, do not substitute a generic one:
${rule}

General rules:
- The durationMin values must sum to exactly ${dur}.
- Write steps a teacher can run as written: what they say, what they hand out, how long, what students do.
- Materials, tips and assessment must reflect THIS format; never give group advice in an individual activity.

Return JSON in this exact shape:
{
  "title": "Activity title",
  "activityType": "${key}",
  "totalDuration": ${dur},
  "objective": "One-sentence activity objective",
  "groupSize": "The grouping this format requires",
  "materials": ["item 1", "item 2"],
  "steps": [
    { "stepNumber": 1, "title": "Step title", "description": "Detailed step description for the teacher", "durationMin": 5 }
  ],
  "teacherTips": ["tip 1", "tip 2"],
  "differentiation": "How to adapt for different learner levels",
  "assessment": "How to assess activity success"
}`;
}
