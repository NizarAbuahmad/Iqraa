/**
 * Prompts for `/generate/prompt-slides`.
 *
 * Unlike `classroomPrompts.ts`'s 7 activity types — each a rigid, hand-written
 * game/activity template — this is one open-ended builder: the teacher's own
 * free text (carried in `b.additionalContext`, see `routes/generate.ts`) IS the
 * spec, not a topic fed into a fixed template.
 *
 * Open-ended is not the same as unstructured, and the first version of this
 * file confused the two. It named six slide types and defined none of them,
 * set the count rule to "pick a sensible number between 6 and 10", listed only
 * prohibitions under "mandatory rules", modelled `content` as one short string,
 * and told the model not to add anything that was not asked for. The decks that
 * came back were six near-blank cards with a dead teacher-notes button, because
 * every one of those choices removes something the presenter needs:
 *
 *  - `presentation.tsx` gates its whole teacher panel on `!!slide.teacher`, and
 *    a skeleton without that key never gets one back.
 *  - It splits `content` on `\n` and renders `• ` lines as accent cards, so a
 *    single flat sentence is a ~90% empty slide.
 *  - "Do not add content that was not asked for" caps deck richness at the
 *    teacher's own terseness — a two-line description bought a two-line deck.
 *
 * So the arc below is prescribed the way `classroomPrompts.ts` prescribes its
 * formats: fixed positions, per-type substance bars, a literal multi-line
 * bulleted example, and rules that say what a slide must CONTAIN rather than
 * only what it must not be.
 */

/** Hard ceiling on slide count — also enforced server-side after parsing. */
export const MAX_PROMPT_SLIDES = 20;

/** Floor, so "make me a deck" cannot come back as two slides. */
export const MIN_PROMPT_SLIDES = 6;

/** Slides the deck defaults to when the teacher does not say. */
const DEFAULT_PROMPT_SLIDES = 10;

/**
 * At most this many slides may ask for a picture.
 *
 * `mediaPrompt` is a photo-search query now, not an illustration brief: the
 * client feeds it to the Unsplash lookup the older Slides Maker already uses.
 * `gpt-image-1` is not enabled on this OpenAI project (403), and a deck of
 * stock photos stops being a deck anyway.
 */
export const MAX_PROMPT_SLIDE_IMAGES = 3;

function slideCountLine(b: any, isAr: boolean): string {
  const n = Number(b.slideCount);
  if (!Number.isFinite(n) || n <= 0) {
    return isAr
      ? `لم يحدّد المعلّم عدد الشرائح — اجعلها ${DEFAULT_PROMPT_SLIDES} شرائح.`
      : `The teacher did not state a slide count — make it ${DEFAULT_PROMPT_SLIDES} slides.`;
  }
  const capped = Math.max(MIN_PROMPT_SLIDES, Math.min(MAX_PROMPT_SLIDES, Math.floor(n)));
  return isAr
    ? `أنشئ ${capped} شريحة بالضبط.`
    : `Generate exactly ${capped} slides.`;
}

/** The teacher's grade/subject, offered as a hint the description can override. */
function scopeLine(b: any, isAr: boolean): string {
  const grade = typeof b.grade === 'string' ? b.grade.trim() : '';
  const subject = typeof b.subject === 'string' ? b.subject.trim() : '';
  if (!grade && !subject) return '';
  const both = [subject, grade].filter(Boolean).join(' — ');
  return isAr
    ? `\nهذا المعلّم يدرّس عادةً: ${both}. استرشد بذلك في مستوى اللغة والأمثلة، لكن إن نصّ الوصف على صفٍّ أو مادةٍ أخرى فالوصف هو المرجع.`
    : `\nThis teacher usually teaches: ${both}. Use that to pitch the language and examples, but if the description names a different grade or subject, the description wins.`;
}

export function promptSlidesPromptAr(b: any): string {
  return `أنت مصمّم عروض تعليمية خبير. معلّم طلب عرضًا شرائحيًا ووصفه بكلماته:

"${b.additionalContext ?? ''}"
${scopeLine(b, true)}

الوصف يحدّد الموضوع والأسلوب وأي متطلّب ذكره المعلّم صراحةً. أكمل أنت كل ما يحتاجه عرض تعليمي متكامل حتى لو لم ينصّ عليه الوصف — لا تكتفِ بحرفية الوصف، ولا تترك شريحة شبه فارغة.
${slideCountLine(b, true)}

بنية العرض — التزم بهذا الترتيب:
1. شريحة غلاف (intro): العنوان + سطر واحد يقول ما الذي سيصبح الطالب قادرًا عليه في نهاية الحصة.
2. شريحة تشويق (intro): سؤال أو موقف واقعي يجعل الموضوع يستحقّ الانتباه.
3. شريحة أهداف (intro): ثلاثة أسطر تبدأ بـ "• "، كل هدف سلوكي قابل للملاحظة (يحسب، يفسّر، يقارن) — لا تكتب "يفهم" أو "يعرف".
4. شريحة فاصلة (divider) واحدة على الأقل بين الأقسام.
5. شرائح الشرح (intro): معظم العرض. كل شريحة فكرة واحدة فقط.
6. شريحة مثال محلول (challenge) قرب النهاية، مع الحل الكامل في teacher.expectedAnswer.
7. شريحة تحقّق (question) بأربعة خيارات.
8. شريحة خلاصة (summary) في النهاية: ثلاثة أسطر "• " + جملة تقول ما الذي يأتي بعد هذه الحصة.

أعد JSON بالشكل الآتي (كل النصوص بالعربية عدا mediaPrompt):
{
  "activityName": "عنوان العرض",
  "activityType": "prompt-slides",
  "grade": "${b.grade ?? ''}",
  "subject": "${b.subject ?? ''}",
  "lesson": "عنوان مختصر للموضوع",
  "duration": 30,
  "difficulty": "standard",
  "groupType": "whole-class",
  "learningObjective": "هدف الحصة بجملة واحدة",
  "materials": ["شاشة عرض"],
  "teacherPreparation": "ما يحتاجه المعلّم قبل الحصة",
  "slides": [
    {
      "slideNumber": 1, "type": "intro",
      "title": "عنوان العرض",
      "content": "في نهاية الحصة ستكون قادرًا على ...",
      "durationSeconds": 0,
      "teacher": { "teachingTips": "كيف تفتتح الحصة بهذه الشريحة" }
    },
    {
      "slideNumber": 2, "type": "intro",
      "title": "لماذا يهمّنا هذا؟",
      "content": "• الموقف الواقعي في سطر واحد\\n• السؤال الذي سنجيب عنه اليوم",
      "durationSeconds": 0,
      "teacher": { "teachingTips": "اترك 30 ثانية لتخمينات الطلبة قبل الانتقال", "commonMisconceptions": "ما يظنّه الطلبة عادةً قبل الشرح" }
    },
    {
      "slideNumber": 5, "type": "intro",
      "title": "الفكرة معبَّرًا عنها كجملة خبرية لا كعنوان",
      "content": "• السطر الأول من الشرح\\n• السطر الثاني\\n• مثال قصير أو حالة خاصة",
      "mediaPrompt": "short english photo search query",
      "durationSeconds": 0,
      "teacher": { "teachingTips": "ما الذي تؤكّد عليه هنا", "commonMisconceptions": "الخطأ الشائع في هذه الفكرة تحديدًا", "expectedAnswer": "الصياغة الدقيقة للفكرة" }
    },
    {
      "slideNumber": 8, "type": "challenge",
      "title": "مثال محلول",
      "content": "نص المسألة كاملًا بمعطياتها",
      "hint": "تلميح يوجّه دون أن يحلّ",
      "answer": "الإجابة النهائية",
      "durationSeconds": 60,
      "teacher": { "expectedAnswer": "الحل خطوة بخطوة", "commonMisconceptions": "أين يقع الطلبة عادةً", "teachingTips": "اطلب الخطوة الأولى من الصف قبل أن تحلّ" }
    },
    {
      "slideNumber": 9, "type": "question",
      "title": "تحقّق سريع",
      "content": "نص السؤال",
      "options": ["الخيار الأول", "الخيار الثاني", "الخيار الثالث", "الخيار الرابع"],
      "correctIndex": 0,
      "durationSeconds": 45,
      "teacher": { "expectedAnswer": "لماذا هذا الخيار صحيح", "commonMisconceptions": "ما الذي يدفع الطالب لكل خيار خاطئ", "teachingTips": "اقرأ توزيع الأيدي قبل الكشف" }
    },
    {
      "slideNumber": 10, "type": "summary",
      "title": "الخلاصة",
      "content": "• الفكرة الأولى\\n• الفكرة الثانية\\n• الفكرة الثالثة",
      "durationSeconds": 0,
      "teacher": { "teachingTips": "ما الذي تبني عليه الحصة القادمة" }
    }
  ],
  "teacherNotes": ["ملاحظة للمعلّم"],
  "answerKey": ["المثال المحلول: الإجابة", "تحقّق سريع: الإجابة"],
  "printables": [],
  "assessment": "كيف يعرف المعلّم أن الهدف تحقّق",
  "extensionChallenge": "امتداد للطلبة المتقدّمين"
}

قواعد إلزامية:
- كل شريحة بلا استثناء تحمل كائن "teacher" غير فارغ. الشريحة بلا teacher تظهر للمعلّم بزرّ ملاحظات لا يفتح شيئًا.
- "content" متعدّد الأسطر: افصل بـ \\n وابدأ أسطر القوائم بـ "• ". لا تكتب فقرة واحدة متّصلة، ولا تقلّ أي شريحة عن سطرين.
- شريحة الشرح فكرة واحدة فقط. إن كان لديك فكرتان فاجعلهما شريحتين.
- الخيارات الثلاثة الخاطئة في شريحة question أخطاء شائعة حقيقية، لا حشوًا ولا أرقامًا عشوائية. "correctIndex" فهرس مُصفَّر (0 يعني الخيار الأول)، لا ترتيب الخيار كما يعدّه الإنسان.
- "type" واحد من: intro, divider, challenge, question, summary. لا تستخدم أي نوع آخر.
- "mediaPrompt": ضعه فقط حين تضيف الصورة معنًى، في 3 شرائح كحدّ أقصى، واكتبه **بالإنجليزية** كعبارة بحث عن صورة (2-5 كلمات) لأنه يُمرَّر إلى محرّك بحث صور. لا تكتب "mediaUrl" إطلاقًا.
- اكتب المعادلات بالحرفين اللاتينيين x و y حتى داخل النص العربي، فالتطبيق يرسم المنحنى من المعادلة الواردة في النص.
- "durationSeconds": صفر لشرائح الشرح، و45-60 لشرائح السؤال.
- لا تُضِف حقل "verified" أو "verifiedBy" إطلاقًا.`;
}

export function promptSlidesPromptEn(b: any): string {
  return `You are an expert instructional slide designer. A teacher asked for a deck and described it in their own words:

"${b.additionalContext ?? ''}"
${scopeLine(b, false)}

The description sets the topic, the tone and any requirement the teacher stated outright. You fill in everything a complete teaching deck needs even where the description did not spell it out — do not stop at the literal words, and never leave a slide near-empty.
${slideCountLine(b, false)}

Deck structure — follow this order:
1. Cover slide (intro): the title + one line naming what a student will be able to do by the end.
2. Hook slide (intro): a question or real situation that makes the topic worth attention.
3. Objectives slide (intro): three lines starting "• ", each an observable outcome (calculates, explains, compares) — never "understands" or "knows".
4. At least one divider slide between sections.
5. Concept slides (intro): the bulk of the deck. Exactly one idea per slide.
6. A worked example (challenge) near the end, with the full solution in teacher.expectedAnswer.
7. A check slide (question) with four options.
8. A summary slide at the end: three "• " lines + a sentence naming what comes next.

Return JSON in this exact shape (all text in English; mediaPrompt is English too):
{
  "activityName": "Deck title",
  "activityType": "prompt-slides",
  "grade": "${b.grade ?? ''}",
  "subject": "${b.subject ?? ''}",
  "lesson": "Short topic label",
  "duration": 30,
  "difficulty": "standard",
  "groupType": "whole-class",
  "learningObjective": "The lesson goal in one sentence",
  "materials": ["Projector"],
  "teacherPreparation": "What the teacher needs before class",
  "slides": [
    {
      "slideNumber": 1, "type": "intro",
      "title": "Deck title",
      "content": "By the end of this lesson you will be able to ...",
      "durationSeconds": 0,
      "teacher": { "teachingTips": "How to open the lesson on this slide" }
    },
    {
      "slideNumber": 2, "type": "intro",
      "title": "Why this matters",
      "content": "• The real situation in one line\\n• The question we answer today",
      "durationSeconds": 0,
      "teacher": { "teachingTips": "Leave 30 seconds for guesses before moving on", "commonMisconceptions": "What students usually assume beforehand" }
    },
    {
      "slideNumber": 5, "type": "intro",
      "title": "The idea stated as a claim, not a label",
      "content": "• First line of the explanation\\n• Second line\\n• A short example or special case",
      "mediaPrompt": "short english photo search query",
      "durationSeconds": 0,
      "teacher": { "teachingTips": "What to stress here", "commonMisconceptions": "The specific error on this idea", "expectedAnswer": "The precise statement of the idea" }
    },
    {
      "slideNumber": 8, "type": "challenge",
      "title": "Worked example",
      "content": "The full problem with its given values",
      "hint": "A hint that guides without solving",
      "answer": "The final answer",
      "durationSeconds": 60,
      "teacher": { "expectedAnswer": "The step-by-step solution", "commonMisconceptions": "Where students usually slip", "teachingTips": "Ask the class for step one before you solve" }
    },
    {
      "slideNumber": 9, "type": "question",
      "title": "Quick check",
      "content": "The question text",
      "options": ["First option", "Second option", "Third option", "Fourth option"],
      "correctIndex": 0,
      "durationSeconds": 45,
      "teacher": { "expectedAnswer": "Why that option is right", "commonMisconceptions": "What pulls a student to each wrong option", "teachingTips": "Read the spread of hands before revealing" }
    },
    {
      "slideNumber": 10, "type": "summary",
      "title": "Summary",
      "content": "• First takeaway\\n• Second takeaway\\n• Third takeaway",
      "durationSeconds": 0,
      "teacher": { "teachingTips": "What the next lesson builds on" }
    }
  ],
  "teacherNotes": ["A note for the teacher"],
  "answerKey": ["Worked example: the answer", "Quick check: the answer"],
  "printables": [],
  "assessment": "How the teacher knows the objective was met",
  "extensionChallenge": "An extension for advanced students"
}

Mandatory rules:
- Every slide without exception carries a non-empty "teacher" object. A slide without one shows the teacher a notes button that opens nothing.
- "content" is multi-line: separate with \\n and start list lines with "• ". Never one unbroken paragraph, and never fewer than two lines on any slide.
- A concept slide carries exactly one idea. If you have two ideas, make two slides.
- The three wrong options on a question slide are real, plausible misconceptions — not filler, not random numbers. "correctIndex" is 0-based (0 means the first option), never the option's position as a person would count it.
- "type" is one of: intro, divider, challenge, question, summary. Never any other type.
- "mediaPrompt": include it only where a picture adds meaning, on at most 3 slides, and write it in **English** as a photo search phrase (2-5 words) because it is passed to an image search engine. Never write "mediaUrl".
- Write equations with latin x and y even inside other prose — the app plots the curve from the equation stated in the text.
- "durationSeconds": zero for teaching slides, 45-60 for question slides.
- Never add a "verified" or "verifiedBy" field.`;
}

/** Fields that only mean something when a verifier actually ran. */
const UNEARNED_VERIFICATION_FIELDS = ['verified', 'verifiedBy', 'computedAnswer'] as const;

/**
 * Strips any `verified` / `verifiedBy` / `computedAnswer` a live model invented
 * on its own output. Same reasoning as the identically named helper in
 * `classroomPrompts.ts`: nothing ran a verifier over this deck, so the badge
 * would vouch for text nobody checked.
 */
export function stripUnearnedPromptSlideVerification(activity: unknown): unknown {
  if (activity === null || typeof activity !== 'object' || Array.isArray(activity)) {
    return activity;
  }
  const deck = activity as Record<string, unknown>;
  if (!Array.isArray(deck.slides)) return activity;
  const slides = deck.slides.map(raw => {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return raw;
    const slide = { ...(raw as Record<string, unknown>) };
    for (const field of UNEARNED_VERIFICATION_FIELDS) delete slide[field];
    return slide;
  });
  return { ...deck, slides };
}
