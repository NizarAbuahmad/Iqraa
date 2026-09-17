/**
 * Prompts for `/generate/prompt-slides`.
 *
 * Unlike `classroomPrompts.ts`'s 7 activity types — each a rigid, hand-written
 * game/activity template — this is one open-ended builder: the teacher's own
 * free text (carried in `b.additionalContext`, see `routes/generate.ts`) IS the
 * spec, not a topic fed into a fixed template. So there is exactly one prompt
 * per language here, not a branch per activity type.
 *
 * `activityName`/`slides`/etc. reuse the same JSON contract as
 * `classroomPrompts.ts` on purpose — it is what `presentation.tsx`,
 * `exportPptx.ts` and `services/share.ts` already render, unchanged.
 */

/** Hard ceiling on slide count — also enforced server-side after parsing, see
 *  `routes/generate.ts`. Stated to the model so it does not have to be
 *  truncated after the fact in the common case. */
export const MAX_PROMPT_SLIDES = 20;

/** At most this many slides may carry an AI-generated image — each one is a
 *  separate image-generation call after the text comes back, see
 *  `routes/generate.ts`. */
export const MAX_PROMPT_SLIDE_IMAGES = 3;

function slideCountLine(b: any, isAr: boolean): string {
  const n = Number(b.slideCount);
  if (!Number.isFinite(n) || n <= 0) {
    return isAr
      ? `لم يحدد المعلم عدد شرائح — اختر عددًا مناسبًا بين 6 و10.`
      : `The teacher did not state a slide count — pick a sensible number between 6 and 10.`;
  }
  const capped = Math.min(MAX_PROMPT_SLIDES, Math.floor(n));
  return isAr
    ? `أنشئ ${capped} شريحة بالضبط (بحد أقصى ${MAX_PROMPT_SLIDES} على الإطلاق).`
    : `Generate exactly ${capped} slides (never more than ${MAX_PROMPT_SLIDES}).`;
}

export function promptSlidesPromptAr(b: any): string {
  return `أنت مصمم عروض تعليمية. معلّم مادة ${b.subject ?? "غير محددة"} للصف ${b.grade ?? "غير محدد"} طلب عرضًا شرائحيًا بوصف حر:

"${b.additionalContext ?? ""}"

اتبع هذا الوصف حرفيًا — هو المواصفة الوحيدة لهذا العرض: عدد الشرائح إن ذُكر، الأسلوب أو النبرة المطلوبة (مرح، رسمي، مبسّط...)، أي أسئلة أو أنشطة طلبها المعلّم صراحة. لا تُقحم محتوى لم يُطلب.
${slideCountLine(b, true)}

أعد JSON بالشكل الآتي (بالعربية الكاملة إلا حقل "type" و"mediaPrompt"):
{
  "activityName": "عنوان العرض المشتق من الوصف",
  "activityType": "prompt-slides",
  "grade": "${b.grade ?? ""}",
  "subject": "${b.subject ?? ""}",
  "lesson": "عنوان مختصر للموضوع",
  "duration": 20,
  "difficulty": "standard",
  "groupType": "whole-class",
  "learningObjective": "هدف تعليمي بجملة واحدة مشتق من الوصف",
  "materials": ["شاشة عرض"],
  "teacherPreparation": "لا تحضير خاص مطلوب",
  "slides": [
    { "slideNumber": 1, "type": "intro", "title": "عنوان الشريحة الأولى", "content": "محتوى الشريحة", "durationSeconds": 0 },
    { "slideNumber": 2, "type": "divider", "title": "عنوان قسم", "content": "جملة انتقالية قصيرة", "durationSeconds": 0 },
    {
      "slideNumber": 3, "type": "media", "title": "عنوان الشريحة", "content": "الشرح المرافق للصورة",
      "mediaPrompt": "وصف قصير بالإنجليزية للصورة المطلوب توليدها بالذكاء الاصطناعي",
      "durationSeconds": 0
    },
    {
      "slideNumber": 4, "type": "question", "title": "سؤال 1", "content": "نص السؤال",
      "options": ["الخيار الأول", "الخيار الثاني", "الخيار الثالث", "الخيار الرابع"],
      "correctIndex": 0, "durationSeconds": 45
    },
    { "slideNumber": 5, "type": "summary", "title": "الخلاصة", "content": "ملخص العرض", "durationSeconds": 0 }
  ],
  "teacherNotes": ["ملاحظة 1"],
  "answerKey": ["سؤال 1: الإجابة الصحيحة"],
  "printables": [],
  "assessment": "كيف يقيّم المعلم الفهم بعد هذا العرض",
  "extensionChallenge": "فكرة إثراء اختيارية"
}

قواعد إلزامية:
- "type" لكل شريحة واحد فقط من: intro, divider, challenge, question, summary, media. لا تستخدم أي نوع آخر (لا graph، ولا bingo-call، ولا relay-problem، ولا podium، ولا scoreboard) — لا توجد بيانات لدعمها.
- شرائح "media": بحد أقصى ${MAX_PROMPT_SLIDE_IMAGES} شرائح من هذا النوع في العرض كله. اكتب "mediaPrompt" بالإنجليزية فقط، وصفًا قصيرًا وواضحًا لصورة تعليمية — لا تكتب "mediaUrl" أبدًا، فالتطبيق يولّد الصورة لاحقًا من وصفك.
- شرائح "question": "options" مصفوفة من 4 نصوص عادية بلا رمز قبلها. "correctIndex" رقم صحيح — فهرس الخيار الصحيح داخل "options"، ويبدأ العدّ من الصفر (0 يعني الخيار الأول). لا تكتب أبدًا رقم الخيار كما يعُدّه إنسان (1، 2، 3، 4)، بل فهرسه المُصفَّر: إن كانت الإجابة الصحيحة هي الخيار الثالث فـ correctIndex يساوي 2.
- لا تُضِف حقل "verified" أو "verifiedBy" إلى أي شريحة إطلاقًا — لم يتحقق أحد رياضيًا من هذه الأسئلة.`;
}

export function promptSlidesPromptEn(b: any): string {
  return `You are an instructional slide-deck designer. A ${b.subject ?? "unspecified subject"} teacher for grade ${b.grade ?? "unspecified"} asked for a slide deck described in their own words:

"${b.additionalContext ?? ""}"

Follow this description literally — it is the ONLY spec for this deck: slide count if stated, the requested tone or style (fun, formal, simplified...), any specific questions or activities the teacher named. Do not add content that was not asked for.
${slideCountLine(b, false)}

Return JSON in this exact shape (all text in English except "type" and "mediaPrompt", which are already English):
{
  "activityName": "Deck title derived from the description",
  "activityType": "prompt-slides",
  "grade": "${b.grade ?? ""}",
  "subject": "${b.subject ?? ""}",
  "lesson": "A short topic label",
  "duration": 20,
  "difficulty": "standard",
  "groupType": "whole-class",
  "learningObjective": "One-sentence objective derived from the description",
  "materials": ["Projector"],
  "teacherPreparation": "No special prep needed",
  "slides": [
    { "slideNumber": 1, "type": "intro", "title": "Title slide", "content": "Slide content", "durationSeconds": 0 },
    { "slideNumber": 2, "type": "divider", "title": "Section title", "content": "A short transition line", "durationSeconds": 0 },
    {
      "slideNumber": 3, "type": "media", "title": "Slide title", "content": "The text that goes with the image",
      "mediaPrompt": "A short English description of the image to generate",
      "durationSeconds": 0
    },
    {
      "slideNumber": 4, "type": "question", "title": "Question 1", "content": "Question text",
      "options": ["First option", "Second option", "Third option", "Fourth option"],
      "correctIndex": 0, "durationSeconds": 45
    },
    { "slideNumber": 5, "type": "summary", "title": "Summary", "content": "Deck summary", "durationSeconds": 0 }
  ],
  "teacherNotes": ["note 1"],
  "answerKey": ["Q1: the correct answer"],
  "printables": [],
  "assessment": "How the teacher checks understanding after this deck",
  "extensionChallenge": "Optional extension idea"
}

Mandatory rules:
- Every slide's "type" is exactly one of: intro, divider, challenge, question, summary, media. Never any other type (no graph, bingo-call, relay-problem, podium, scoreboard — there is no data to support them).
- "media" slides: at most ${MAX_PROMPT_SLIDE_IMAGES} such slides in the whole deck. Write "mediaPrompt" as a short, clear description of an educational image — never write "mediaUrl"; the app generates the image from your description afterward.
- "question" slides: "options" is an array of 4 plain strings with no letter/symbol prefix. "correctIndex" is an integer — the index of the correct option inside "options", 0-based (0 means the first option). Never write the option's position as a person would count it (1, 2, 3, 4); write its 0-based index instead: if the correct answer is the third option, correctIndex is 2.
- Do not add a "verified" or "verifiedBy" field to any slide — nobody has mathematically checked these questions.`;
}
