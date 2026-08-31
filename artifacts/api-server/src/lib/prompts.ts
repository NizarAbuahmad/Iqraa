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
  const priorConcepts = b.includePriorReview && Array.isArray(b.priorKnowledge) && b.priorKnowledge.length
    ? b.priorKnowledge
    : null;
  const priorNotes = typeof b.priorTopicsNotes === "string" ? b.priorTopicsNotes.trim() : "";
  const hasPriorReview = Boolean(priorConcepts || priorNotes);
  return `أنشئ خطة درس كاملة لمادة ${b.subject} للصف ${b.grade} حول موضوع "${b.topic}"، مدتها ${b.duration ?? 45} دقيقة.
${b.objectives ? `الأهداف المحددة:\n${b.objectives}` : ""}
${b.additionalContext ? `سياق إضافي: ${b.additionalContext}` : ""}
أسلوب التدريس: ${b.teachingStyle === "inquiry" ? "استقصائي" : b.teachingStyle === "collaborative" ? "تعاوني" : "مباشر"}
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
Teaching style: ${b.teachingStyle ?? "direct"}
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
