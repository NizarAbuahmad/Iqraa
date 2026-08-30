/**
 * Prompts for `/generate/classroom-activity`.
 *
 * Split out of `routes/generate.ts` so they can be imported without pulling in
 * the OpenAI client, which that file constructs at module scope and which
 * throws without a key (see CLAUDE.md) — the same reason the other prompt
 * builders live in `lib/prompts.ts` rather than the route. These stayed in
 * the route while there were only 8, untestable, activity-type branches; that
 * stopped being true once the Arabic side needed 4 more of them.
 */

/**
 * The 7 activity-type ids the classroom hub can send. Kept in sync with the
 * mobile side's `ACTIVITY_CARDS` (services/classroomRouting.ts) by a test on
 * each side asserting the same id set — see classroomPrompts.test.ts and
 * classroomRouting.test.ts.
 */
export const CLASSROOM_ACTIVITY_TYPES = [
  'escape-challenge',
  'quick-check',
  'error-detective',
  'exit-ticket',
  'bingo',
  'relay',
  'gallery-walk',
] as const;

export type ClassroomActivityType = (typeof CLASSROOM_ACTIVITY_TYPES)[number];

/**
 * One line telling the model what the room actually has.
 *
 * Appended at the single dispatch point rather than threaded through the
 * per-activity prompt builders below — every one of them ends with the same
 * JSON shape, and every one of them would need the same sentence.
 *
 * The client applies its own materials override on top (see
 * applyClassroomSetup), so a model that ignores this still cannot tell a
 * teacher with a projector to print the slides.
 */
export function classroomSetupClause(b: any, isAr: boolean): string {
  const board = b.classroomSetup === 'board';
  if (isAr) {
    return board
      ? '\n\nمهم: لا يوجد جهاز عرض في هذه الحصة. صمّم النشاط ليُدار على السبورة وبأوراق مطبوعة، واذكر في materials أدوات السبورة والمطبوعات التي يحتاجها المعلّم فعلًا.'
      : '\n\nمهم: الشرائح ستُعرض على شاشة/جهاز عرض. لا تطلب طباعة ما تعرضه الشرائح نفسها؛ اذكر في materials جهاز العرض وما يحتاجه الطلاب فقط (دفتر، قلم، ورقة عمل إن لزمت).';
  }
  return board
    ? '\n\nImportant: there is no projector in this room. Design the activity to run on the board with printed handouts, and list in materials only the board tools and printouts the teacher genuinely needs.'
    : '\n\nImportant: the slides are shown on a projector. Do not ask the teacher to print what the slides themselves display; list in materials the projector plus only what students need (notebook, pen, worksheet if truly required).';
}

/**
 * How many quick-check questions to generate.
 *
 * Clamped 1–8, default 4 — matches the offline MockAIService's own default so
 * a standalone Quick Check is the same size live or offline. Slides Maker
 * asks for more because it spreads the questions across a whole lesson.
 */
function quickCheckCount(b: any): number {
  const n = Math.floor(Number(b.numQuestions ?? 4));
  return Math.max(1, Math.min(8, Number.isFinite(n) && n > 0 ? n : 4));
}

function quickCheckPromptAr(b: any): string {
  const n = quickCheckCount(b);
  return `أنت مصمم أنشطة صفية تفاعلية. أنشئ نشاط "تحقق سريع" لمادة ${b.subject}، الصف ${b.grade}، موضوع "${b.topic}".
المدة: ${b.duration} دقيقة | الصعوبة: ${b.difficulty} | الهدف: ${b.teachingGoal}
${b.additionalContext ? `\nمحتوى الكتاب المدرسي:\n${b.additionalContext}` : ''}

هذا نشاط تشخيصي جماعي: يظهر السؤال على الشاشة، يفكر كل الطلاب بصمت، ثم يرفع الجميع أيديهم للإجابة معًا (لا فردي، ولا تنافس بين فرق).

أعد JSON بالشكل الآتي (بالعربية الكاملة):
{
  "activityName": "تحقق سريع – ${b.topic}",
  "activityType": "quick-check",
  "grade": "${b.grade}",
  "subject": "${b.subject}",
  "lesson": "${b.topic}",
  "duration": ${b.duration},
  "difficulty": "${b.difficulty}",
  "groupType": "whole-class",
  "learningObjective": "تشخيص فهم الصف كاملًا لموضوع ${b.topic}",
  "materials": ["شاشة عرض"],
  "teacherPreparation": "لا تحتاج تحضيرًا مسبقًا. اعرض السؤال، شغّل المؤقت، والجميع يرفع يده للإجابة عند انتهاء الوقت.",
  "slides": [
    { "slideNumber": 1, "type": "intro", "title": "🙋 تحقق سريع", "content": "شرح القواعد: يظهر السؤال، يفكر الجميع بصمت، ثم يرفع الجميع أيديهم للإجابة معًا.", "durationSeconds": 0 },
    {
      "slideNumber": 2,
      "type": "question",
      "title": "سؤال 1",
      "content": "نص السؤال",
      "options": ["الخيار الأول", "الخيار الثاني", "الخيار الثالث", "الخيار الرابع"],
      "correctIndex": 0,
      "durationSeconds": 45,
      "teacher": {
        "expectedAnswer": "الإجابة الصحيحة بالتفصيل",
        "commonMisconceptions": "لماذا يختار الطلاب كل خيار خاطئ",
        "teachingTips": "الكل يجيب معًا: اقرأ توزيع الأيدي قبل الكشف."
      }
    }
  ],
  "teacherNotes": ["لا تكشف الإجابة قبل أن يجيب الجميع"],
  "answerKey": ["سؤال 1: الإجابة الصحيحة"],
  "printables": [],
  "assessment": "توزيع الإجابات نفسه هو التقييم: أي خيار خاطئ يرتفع كثيرًا يحدد الخطأ الشائع الذي يجب إعادة شرحه.",
  "extensionChallenge": "اطلب ممن أجاب صحيحًا أن يقنع زميلًا اختار إجابة خاطئة — دون إخباره بالحل"
}

قواعد إلزامية:
- أنشئ ${n} شريحة من نوع "question" بالضبط (بعد شريحة intro)، ثم اختم بشريحة "summary".
- "options" مصفوفة من 4 نصوص عادية بلا أي رمز أو حرف قبلها (لا "أ)"، ولا "A)"). الخيارات الثلاثة الخاطئة يجب أن تعكس أخطاء شائعة حقيقية، لا مجرد أرقام عشوائية.
- "correctIndex" رقم صحيح — فهرس الخيار الصحيح داخل "options"، ويبدأ العدّ من الصفر (0 يعني الخيار الأول). لا تكتب أبدًا رقم الخيار نفسه (1، 2، 3، 4)، بل فهرسه المُصفَّر: إن كانت الإجابة الصحيحة هي الخيار الثالث فـ correctIndex يساوي 2.
- لا تُضِف حقل "verified" أو "verifiedBy" إلى أي شريحة إطلاقًا — لم يتحقق أحد رياضيًا من هذه الأسئلة.`;
}

function quickCheckPromptEn(b: any): string {
  const n = quickCheckCount(b);
  return `You are an interactive classroom activity designer. Create a "Quick Check" activity for ${b.subject}, Grade ${b.grade}, topic "${b.topic}".
Duration: ${b.duration} min | Difficulty: ${b.difficulty} | Goal: ${b.teachingGoal}
${b.additionalContext ? `\nTextbook context:\n${b.additionalContext}` : ''}

This is a whole-class diagnostic: the question appears on screen, every student thinks silently, then everyone raises a hand to answer together (not individual, not a team contest).

Return JSON in this exact shape (all text in English):
{
  "activityName": "Quick Check – ${b.topic}",
  "activityType": "quick-check",
  "grade": "${b.grade}",
  "subject": "${b.subject}",
  "lesson": "${b.topic}",
  "duration": ${b.duration},
  "difficulty": "${b.difficulty}",
  "groupType": "whole-class",
  "learningObjective": "Diagnose whole-class understanding of ${b.topic}",
  "materials": ["Projector"],
  "teacherPreparation": "No prep needed. Show the question, run the timer, everyone raises a hand to answer at once.",
  "slides": [
    { "slideNumber": 1, "type": "intro", "title": "🙋 Quick Check", "content": "Rules: the question appears, everyone thinks silently, then everyone raises a hand to answer together.", "durationSeconds": 0 },
    {
      "slideNumber": 2,
      "type": "question",
      "title": "Question 1",
      "content": "Question text",
      "options": ["First option", "Second option", "Third option", "Fourth option"],
      "correctIndex": 0,
      "durationSeconds": 45,
      "teacher": {
        "expectedAnswer": "The correct answer in detail",
        "commonMisconceptions": "Why students pick each wrong option",
        "teachingTips": "Everyone answers together: read the spread of hands before revealing."
      }
    }
  ],
  "teacherNotes": ["Never reveal the answer before everyone has answered"],
  "answerKey": ["Q1: the correct answer"],
  "printables": [],
  "assessment": "The spread of answers IS the assessment: a frequently raised wrong option pinpoints the misconception to re-teach.",
  "extensionChallenge": "Ask a correct answerer to convince a classmate who chose wrong — without stating the answer"
}

Mandatory rules:
- Generate exactly ${n} slides of type "question" (after the intro slide), then close with a "summary" slide.
- "options" is an array of 4 plain strings with no letter or symbol prefix (no "A)", no "أ)"). The three wrong options must be real, plausible misconceptions, not arbitrary filler.
- "correctIndex" is an integer — the index of the correct option inside "options", 0-based (0 means the first option). Never write the option's position as a person would count it (1, 2, 3, 4); write its 0-based index instead: if the correct answer is the third option, correctIndex is 2.
- Do not add a "verified" or "verifiedBy" field to any slide — nobody has mathematically checked these questions.`;
}

export function classroomPromptAr(b: any): string {
  const goals: Record<string, string> = {
    'warm-up': 'تمهيد', practice: 'تدريب', revision: 'مراجعة',
    assessment: 'تقييم', 'critical-thinking': 'تفكير ناقد',
  };
  const groups: Record<string, string> = {
    individual: 'فردي', pairs: 'ثنائي', groups: 'مجموعات', 'whole-class': 'الصف بأكمله',
  };
  const diffs: Record<string, string> = { easy: 'سهل', standard: 'متوسط', advanced: 'متقدم' };

  const actType = b.activityType ?? 'escape-challenge';

  if (actType === 'quick-check') {
    return quickCheckPromptAr(b);
  }

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

  if (actType === 'error-detective') {
    return `أنت مصمم أنشطة صفية تفاعلية. أنشئ نشاط "المحقق الرياضي" لمادة ${b.subject}، الصف ${b.grade}، موضوع "${b.topic}".
المدة: ${b.duration} دقيقة | الصعوبة: ${diffs[b.difficulty] ?? b.difficulty} | التجميع: ${groups[b.groupType] ?? b.groupType} | الهدف: ${goals[b.teachingGoal] ?? b.teachingGoal}
${b.additionalContext ? `\nمحتوى الكتاب المدرسي:\n${b.additionalContext}` : ''}

أعد JSON بالشكل الآتي (بالعربية الكاملة):
{
  "activityName": "المحقق الرياضي – ${b.topic}",
  "activityType": "error-detective",
  "grade": "${b.grade}", "subject": "${b.subject}", "lesson": "${b.topic}",
  "duration": ${b.duration}, "difficulty": "${b.difficulty}", "groupType": "${b.groupType}",
  "learningObjective": "هدف بجملة واحدة عن اكتشاف الخطأ وتصحيحه",
  "materials": ["بطاقات الحلول الخاطئة المطبوعة","أقلام تصحيح حمراء"],
  "teacherPreparation": "خطوات الإعداد",
  "slides": [
    { "slideNumber": 1, "type": "intro", "title": "🔍 المحقق الرياضي", "content": "شرح آلية النشاط", "durationSeconds": 0 },
    {
      "slideNumber": 2, "type": "challenge", "title": "🕵️ القضية 1 – اعثر على الخطأ",
      "content": "اعرض حلًّا مكتوبًا يحتوي على خطأ واحد متعمّد ليكتشفه الطلاب",
      "hint": "تلميح يوجّه نحو نوع الخطأ",
      "answer": "الخطأ المحدد والحل الصحيح",
      "durationSeconds": ${Math.round((b.duration * 60) / 4)},
      "teacher": { "expectedAnswer": "الحل الصحيح كاملًا", "commonMisconceptions": "لماذا يقع الطلاب في هذا الخطأ", "teachingTips": "كيف تناقش الخطأ بشكل بنّاء" }
    },
    { "slideNumber": 3, "type": "reveal", "title": "✅ الحل الصحيح", "content": "الحل الصحيح كاملًا مع الشرح", "durationSeconds": 0 }
  ],
  "teacherNotes": ["ملاحظة 1"],
  "answerKey": ["وصف الخطأ 1", "وصف الخطأ 2"],
  "printables": ["بطاقات الأخطاء","نموذج تقرير التحقيق"],
  "assessment": "كيف تقيّم الفهم",
  "extensionChallenge": "تحدٍّ إضافي للمتقدمين"
}
أنشئ 3 قضايا، كل واحدة بشريحة تحدٍّ تتبعها شريحة كشف. اختم بشريحة ملخص تسرد كل الأخطاء التي اكتُشفت.`;
  }

  if (actType === 'gallery-walk') {
    return `أنت مصمم أنشطة صفية تفاعلية. أنشئ نشاط "جولة المعارض" لمادة ${b.subject}، الصف ${b.grade}، موضوع "${b.topic}".
المدة: ${b.duration} دقيقة | الصعوبة: ${diffs[b.difficulty] ?? b.difficulty} | التجميع: ${groups[b.groupType] ?? b.groupType} | الهدف: ${goals[b.teachingGoal] ?? b.teachingGoal}
${b.additionalContext ? `\nمحتوى الكتاب المدرسي:\n${b.additionalContext}` : ''}

أعد JSON بالشكل الآتي (بالعربية الكاملة):
{
  "activityName": "جولة المعارض – ${b.topic}",
  "activityType": "gallery-walk",
  "grade": "${b.grade}", "subject": "${b.subject}", "lesson": "${b.topic}",
  "duration": ${b.duration}, "difficulty": "${b.difficulty}", "groupType": "${b.groupType}",
  "learningObjective": "هدف بجملة واحدة عن الاستكشاف الجماعي عبر محطات",
  "materials": ["5 أوراق كبيرة معلّقة على الجدران","أقلام ملونة","ملاحظات لاصقة"],
  "teacherPreparation": "كيفية إعداد المحطات الخمس وإدارة تنقّل المجموعات",
  "slides": [
    { "slideNumber": 1, "type": "intro", "title": "🖼️ جولة المعارض", "content": "شرح قواعد التنقّل والوقت المخصص لكل محطة", "durationSeconds": 0 },
    {
      "slideNumber": 2, "type": "challenge", "title": "📌 المحطة 1 – الأساسيات",
      "content": "مسألة أساسية يحلّها الطلاب ويكتبونها على الملصق",
      "hint": "تلميح موجّه",
      "answer": "انظر الملصق عند هذه المحطة",
      "durationSeconds": ${Math.round((b.duration * 60) / 6)},
      "teacher": { "expectedAnswer": "الإجابة المتوقعة لهذه المحطة", "teachingTips": "ما الذي تبحث عنه عند مراجعة ملصق هذه المحطة" }
    }
  ],
  "teacherNotes": ["تجوّل بين المحطات لتوجيه النقاش"],
  "answerKey": ["إجابة المحطة 1", "إجابة المحطة 2"],
  "printables": ["بطاقات المحطات (A3)","ورقة تتبّع المجموعات"],
  "assessment": "كيف تراجع وتناقش النتائج",
  "extensionChallenge": "تحدٍّ إضافي"
}
أنشئ 5 شرائح محطات (أساسيات، تطبيق، تحليل، تقييم، إبداعي) بالإضافة إلى شريحة ملخص. لكل محطة نوع مسألة مختلف.`;
  }

  if (actType === 'exit-ticket') {
    return `أنت مصمم أنشطة صفية تفاعلية. أنشئ نشاط "بطاقة الخروج" لمادة ${b.subject}، الصف ${b.grade}، موضوع "${b.topic}".
المدة: ${b.duration} دقيقة | الصعوبة: ${diffs[b.difficulty] ?? b.difficulty} | التجميع: ${groups[b.groupType] ?? b.groupType} | الهدف: ${goals[b.teachingGoal] ?? b.teachingGoal}
${b.additionalContext ? `\nمحتوى الكتاب المدرسي:\n${b.additionalContext}` : ''}

أعد JSON بالشكل الآتي (بالعربية الكاملة):
{
  "activityName": "بطاقة الخروج – ${b.topic}",
  "activityType": "exit-ticket",
  "grade": "${b.grade}", "subject": "${b.subject}", "lesson": "${b.topic}",
  "duration": ${b.duration}, "difficulty": "${b.difficulty}", "groupType": "${b.groupType}",
  "learningObjective": "التحقق من فهم ${b.topic} في نهاية الحصة",
  "materials": ["بطاقة خروج مطبوعة (لكل طالب)","قلم"],
  "teacherPreparation": "اطبع البطاقات؛ خصّص آخر ${b.duration} دقائق من الحصة",
  "slides": [
    { "slideNumber": 1, "type": "intro", "title": "🎫 بطاقة الخروج", "content": "التعليمات: عمل فردي، تُسلَّم عند الباب", "durationSeconds": 0 },
    {
      "slideNumber": 2, "type": "challenge", "title": "❓ السؤال 1 – استرجاع",
      "content": "عرّف المفهوم الأساسي لموضوع ${b.topic} بأسلوبك",
      "hint": "فكّر فيما تناولناه في بداية حصة اليوم",
      "answer": "مرن — يُقيَّم الفهم لا الحفظ",
      "durationSeconds": ${Math.round((b.duration * 60) / 4)},
      "teacher": { "expectedAnswer": "تعريف بأسلوب الطالب", "teachingTips": "ابحث عن الفهم المفاهيمي" }
    }
  ],
  "teacherNotes": ["اجمع البطاقات عند الباب","صنّفها إلى: فهم كامل / جزئي / يحتاج دعمًا"],
  "answerKey": ["س1: التعريف","س2: التطبيق","س3: تفكير ناقد"],
  "printables": ["بطاقة الخروج (لكل طالب)"],
  "assessment": "صنّف البطاقات إلى ثلاث فئات حسب مستوى الفهم",
  "extensionChallenge": "استخدم النتائج لتصميم تمهيد مركّز للحصة القادمة"
}
أنشئ 3 أسئلة: استرجاع، تطبيق، تفكير ناقد. كل سؤال شريحة تحدٍّ. اختم بشريحة ملخص "ضعوا الأقلام".`;
  }

  // Named because the how-to-play slide now tells students how many challenges
  // stand between them and the exit, so the count has to be the same number the
  // deck is actually built from.
  const challengeCount = Math.floor((b.duration ?? 20) / 4);

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
      "content": "القصة التي تؤطّر التحديات بجملتين",
      "durationSeconds": 0
    },
    {
      "slideNumber": 2,
      "type": "intro",
      "title": "كيف نلعب؟",
      "content": "• تعملون في مجموعات، ولكل مجموعة ورقة واحدة تسجّلون فيها الأرقام.\\n• عدد التحديات: ${challengeCount}، ولكل تحدٍّ وقت محدّد يظهر على الشاشة.\\n• كل تحدٍّ تحلّونه حلًّا صحيحًا يكشف رقمًا سريًا واحدًا — اكتبوه فورًا بالترتيب.\\n• لا تُدخلون الأرقام في أي مكان: الكود يُجمع على ورقتكم أنتم.\\n• في النهاية تقرؤون الأرقام بالترتيب نفسه، فيكتمل كود الهروب.",
      "durationSeconds": 0
    },
    {
      "slideNumber": 3,
      "type": "challenge",
      "title": "التحدي 1",
      "content": "نص التحدي",
      "hint": "تلميح مساعد",
      "answer": "الإجابة الصحيحة",
      "unlockCode": "٧",
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
      "slideNumber": 4,
      "type": "reveal",
      "title": "🔓 الكود ٧ مفتوح!",
      "content": "أحسنتم! سجّلوا الرقم ٧ في ورقتكم وانتقلوا إلى التحدي التالي.",
      "unlockCode": "٧",
      "durationSeconds": 0
    }
  ],
  "teacherNotes": ["ملاحظة 1"],
  "answerKey": ["إجابة التحدي 1"],
  "printables": ["بطاقات التحديات","مفتاح الإجابات"],
  "assessment": "كيف تقيّم النشاط",
  "extensionChallenge": "تحدٍّ إضافي للمتقدمين"
}
أنشئ ${challengeCount} تحديًا على الأقل. كل تحدٍّ يتبعه شريحة كشف، ثم اختم بشريحة "summary".

قواعد كود الهروب — التزم بها حرفيًا:
- "unlockCode" رقم عربي واحد فقط من ١ إلى ٩. لا تستخدم ٠ أبدًا (يظهر على الشاشة كنقطة لا تكاد تُرى)، ولا رقمًا من خانتين، ولا حرفًا.
- لكل تحدٍّ رقم مختلف عن كل الأرقام الأخرى في النشاط. لا تكرّر رقمًا ولا تنسخ الرقم الوارد في المثال أعلاه.
- شريحة الكشف تحمل "unlockCode" نفسه المكتوب في التحدي الذي تسبقها مباشرةً.
- عنوان شريحة الكشف يذكر الرقم صراحةً بالصيغة: "🔓 الكود ٧ مفتوح!" — استبدل ٧ بالرقم الفعلي. لا تكتب عنوانًا عامًّا مثل "تم فتح الكود!".
- شريحة "summary" الأخيرة تسرد الأرقام كاملةً بالترتيب، مثال: "كود الهروب الكامل: ٧ – ٣ – ٩ – ٢ – ٥".`;
}

export function classroomPromptEn(b: any): string {
  const actType = b.activityType ?? 'escape-challenge';

  if (actType === 'quick-check') {
    return quickCheckPromptEn(b);
  }

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

  if (actType === 'error-detective') {
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

  if (actType === 'gallery-walk') {
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

  if (actType === 'exit-ticket') {
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

  // Same reason as the Arabic builder: the how-to-play slide states the count.
  const challengeCount = Math.floor((b.duration ?? 20) / 4);

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
    { "slideNumber": 1, "type": "intro", "title": "Your Mission", "content": "The two-sentence story that frames the challenges", "durationSeconds": 0 },
    {
      "slideNumber": 2,
      "type": "intro",
      "title": "How to Play",
      "content": "• Work in groups. One sheet per group — that is where the digits go.\\n• There are ${challengeCount} challenges, each with its own timer on screen.\\n• Solve a challenge correctly and one secret digit is revealed — write it down straight away, in order.\\n• There is nothing to type the digits into: the code is collected on your own sheet.\\n• At the end, read your digits back in the same order to complete the escape code.",
      "durationSeconds": 0
    },
    {
      "slideNumber": 3,
      "type": "challenge",
      "title": "Challenge 1",
      "content": "Challenge question text",
      "hint": "A helpful hint",
      "answer": "The correct answer",
      "unlockCode": "7",
      "durationSeconds": 180,
      "teacher": {
        "expectedAnswer": "Detailed expected answer",
        "commonMisconceptions": "Common student errors",
        "teachingTips": "Teaching advice",
        "suggestedQuestions": ["Follow-up question"],
        "differentiationTips": "How to support different levels"
      }
    },
    { "slideNumber": 4, "type": "reveal", "title": "🔓 Code 7 unlocked!", "content": "Well done — write 7 on your sheet and move on to the next challenge.", "unlockCode": "7", "durationSeconds": 0 }
  ],
  "teacherNotes": ["note 1"],
  "answerKey": ["Challenge 1 answer"],
  "printables": ["Challenge cards","Answer key"],
  "assessment": "How to assess the activity",
  "extensionChallenge": "Extension challenge for advanced students"
}
Generate at least ${challengeCount} challenges. Each challenge slide is followed by a reveal slide, then close with a "summary" slide.

Escape-code rules — follow these exactly:
- "unlockCode" is a single digit from 1 to 9. Never 0 (it renders on screen as a dot nobody can read), never two digits, never a letter.
- Every challenge gets a digit that differs from every other digit in the activity. Do not repeat one, and do not copy the digit used in the example above.
- A reveal slide carries the same "unlockCode" as the challenge slide immediately before it.
- The reveal slide's title names the digit outright, in the form "🔓 Code 7 unlocked!" — with 7 replaced by the real digit. Never a generic title like "Code Unlocked!".
- The closing "summary" slide lists the whole code in order, e.g. "Full escape code: 7 - 3 - 9 - 2 - 5".`;
}

/** Fields that only mean something when a verifier actually ran. */
const UNEARNED_VERIFICATION_FIELDS = ['verified', 'verifiedBy', 'computedAnswer'] as const;

/**
 * Strips any `verified` / `verifiedBy` / `computedAnswer` a live model
 * invented on its own classroom-activity output.
 *
 * Those fields mean "a verifier — SymPy, or the concrete math bank — checked
 * this," which is true only in `MockAIService`'s offline quick-check path
 * (see services/ai/generators.ts). Nothing runs that check on a live model
 * call, but a model asked for JSON shaped like `ActivitySlide` will sometimes
 * write `"verified": true` anyway because the shape invites it. Left in
 * place, `presentation.tsx` renders that as a green "verified" badge over a
 * question nobody actually checked — the exact failure the `verified` field
 * exists to prevent (see CLAUDE.md: "never set it from a fallback").
 *
 * Same immutable-copy shape as `normalizeEscapeCodes` in `escapeCodes.ts`.
 */
export function stripUnearnedVerification(activity: unknown): unknown {
  if (activity === null || typeof activity !== 'object' || Array.isArray(activity)) {
    return activity;
  }
  const deck = activity as Record<string, unknown>;
  const slides = deck.slides;
  if (!Array.isArray(slides)) return activity;

  const out = slides.map(raw => {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return raw;
    const slide = { ...(raw as Record<string, unknown>) };
    for (const field of UNEARNED_VERIFICATION_FIELDS) delete slide[field];
    return slide;
  });

  return { ...deck, slides: out };
}
