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

قبل أي شيء: حدّد نوع العرض من الوصف نفسه. السؤال الفاصل واحد — هل هناك جمهور يتعلّم مادة سيُقاس إتقانه لها؟

أ) عرض تعليمي: درس أو مراجعة أو شرح مفهوم. الإجابة نعم.
ب) عرض عام: خطة، إحاطة، فعالية، طابور صباحي، لقاء أولياء أمور، احتفال، تعريف بمبادرة. الإجابة لا.

لا تفترض (أ). عرض عن «يوم الأم» أو «خطة رحلة مدرسية» ليس حصة، وكتابة «أهداف الحصة» و«مثال محلول» و«تحقّق سريع» فوقه تجعل العرض يبدو قالبًا مفروضًا على موضوعه. وبالمثل لا تُفرغ درسًا حقيقيًا من مثاله وسؤاله بحجّة أنه «عام».

لا تستخدم كلمة «الحصة» أو «الطالب» إلا في (أ) فعلًا.

بنية (أ) — عرض تعليمي:
1. شريحة غلاف (intro): العنوان + سطر واحد يقول ما الذي سيصبح الطالب قادرًا عليه في نهاية الحصة.
2. شريحة تشويق (intro): سؤال أو موقف واقعي يجعل الموضوع يستحقّ الانتباه.
3. شريحة أهداف (intro): ثلاثة أسطر تبدأ بـ "• "، كل هدف سلوكي قابل للملاحظة (يحسب، يفسّر، يقارن) — لا تكتب "يفهم" أو "يعرف".
4. شريحة فاصلة (divider) واحدة على الأقل بين الأقسام.
5. شرائح الشرح (intro): معظم العرض. كل شريحة فكرة واحدة فقط.
6. شريحة مثال محلول (challenge) قرب النهاية، مع الحل الكامل في teacher.expectedAnswer.
7. شريحة تحقّق (question) بأربعة خيارات.
8. شريحة خلاصة (summary) في النهاية: ثلاثة أسطر "• " + جملة تقول ما الذي يأتي بعد هذه الحصة.

بنية (ب) — عرض عام:
1. شريحة غلاف (intro): العنوان + سطر واحد يقول ما الذي سيخرج به الحضور من هذا العرض.
2. شريحة تشويق (intro): لماذا هذا الموضوع الآن — مناسبة أو موقف أو سؤال حقيقي.
3. شريحة «ما الذي سنغطّيه» (intro): ثلاثة أسطر "• " تصف محتوى العرض نفسه، لا أهدافًا سلوكية. عنوانها من الموضوع («ماذا سنحضّر؟»، «محاور اللقاء»)، لا «أهداف الحصة».
4. شريحة فاصلة (divider) واحدة على الأقل بين الأقسام.
5. شرائح المحتوى (intro): معظم العرض. كل شريحة فكرة واحدة فقط، وعنوانها يقول الفكرة لا يسمّيها.
6. شريحة عملية (challenge) قرب النهاية: خطوات تُنفَّذ أو قائمة تحقّق أو توزيع أدوار — شيء يفعله الحضور، لا مسألة تُحلّ. ضع التفاصيل في teacher.expectedAnswer.
7. شريحة question اختيارية هنا: أضفها فقط إن كان في الموضوع قرار يستحق تصويت الحضور أو رأيًا يُستطلع. إن لم يكن، فلا تضعها — سؤال اختيار من متعدد على خطة احتفال يبدو امتحانًا في غير موضعه.
8. شريحة خلاصة (summary) في النهاية: ثلاثة أسطر "• " + جملة تقول الخطوة التالية العملية.

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
  "learningObjective": "الهدف من هذا العرض بجملة واحدة",
  "materials": ["شاشة عرض"],
  "deckPhotoQueries": ["english photo query for the cover", "english photo query for the section break"],
  "teacherPreparation": "ما يحتاجه المعلّم قبل العرض",
  "slides": [
    {
      "slideNumber": 1, "type": "intro",
      "title": "عنوان العرض",
      "content": "بنهاية هذا العرض ستكون قادرًا على ...",
      "durationSeconds": 0,
      "teacher": { "teachingTips": "كيف تفتتح بهذه الشريحة" }
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
      "teacher": { "teachingTips": "ما الذي يُبنى على هذا لاحقًا" }
    }
  ],
  "teacherNotes": ["ملاحظة للمعلّم"],
  "answerKey": ["المثال المحلول: الإجابة", "تحقّق سريع: الإجابة"],
  "printables": [],
  "assessment": "كيف يعرف المعلّم أن الهدف تحقّق",
  "extensionChallenge": "امتداد للطلبة المتقدّمين"
}

أشكال الشرائح — استخدمها لتكسر رتابة العرض:
أضف الحقل "layout" إلى شريحة الشرح حين ينطبق شكلها، وإلا اتركه.
- "statement": فكرة واحدة تستحقّ أن تملأ الشاشة. "content" جملة واحدة قصيرة فقط (لا قوائم، لا أسطر متعدّدة).
- "stat": رقم يستحقّ العرض. أضف "stat": {"value":"الرقم","label":"ماذا يعني","source":"المصدر إن وُجد"}. الرقم قصير (٣ خانات أو نحوها).
  لا تخترع إحصاءات. استخدم فقط أرقامًا من صميم الموضوع (عدد القوانين، قيمة ثابت، سنة، نسبة واردة في الوصف). إن لم يكن لديك رقم حقيقي فلا تستخدم هذا الشكل.
- "compare": مقارنة حقيقية بين طرفين (قبل/بعد، صواب/خطأ، طريقتان). أضف "compare": {"leftTitle":"","left":["",""],"rightTitle":"","right":["",""]}. الطرفان ممتلئان دائمًا.
- "steps": خطوات مرتّبة لعملية. "content" أسطر تبدأ بـ "• " بالترتيب، سطران على الأقل.
لا تُلبس أكثر من نصف شرائح الشرح شكلًا خاصًا — التنويع هو المقصود، لا الفوضى.

قواعد إلزامية:
- كل شريحة بلا استثناء تحمل كائن "teacher" غير فارغ. الشريحة بلا teacher تظهر للمعلّم بزرّ ملاحظات لا يفتح شيئًا.
- "content" متعدّد الأسطر: افصل بـ \\n وابدأ أسطر القوائم بـ "• ". لا تكتب فقرة واحدة متّصلة، ولا تقلّ أي شريحة عن سطرين.
  الشريحة ذات السطر الواحد مرفوضة. إن لم تجد ما تقوله في سطرين فادمج الشريحة مع التي تليها واجعل العرض أقصر — ست شرائح ممتلئة أفضل من عشر أنصاف فارغة.
- لا تضع "mediaPrompt" على شريحة تحمل "layout": تلك الشريحة تملأ الشاشة بشكلها الخاص ولا مكان فيها للصورة.
- شريحة الشرح فكرة واحدة فقط. إن كان لديك فكرتان فاجعلهما شريحتين.
- الخيارات الثلاثة الخاطئة في شريحة question أخطاء شائعة حقيقية، لا حشوًا ولا أرقامًا عشوائية. "correctIndex" فهرس مُصفَّر (0 يعني الخيار الأول)، لا ترتيب الخيار كما يعدّه الإنسان.
- "deckPhotoQueries" مصفوفة من عبارتَي بحث بالإنجليزية (٢-٥ كلمات لكل واحدة) تصفان موضوع العرض نفسه: الأولى لخلفية الغلاف والثانية للشريحة الفاصلة، ومختلفتان عن بعضهما. بالإنجليزية دائمًا مهما كانت لغة العرض — فهرس الصور إنجليزي، والبحث بالعربية يعود فارغًا. صِفْ الموضوع لا المادة الدراسية: عرض عن يوم الأم عبارته "mother and child hands" لا "mathematics classroom".
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

First, decide which kind of deck the description is asking for. One question settles it: is there an audience learning material they will be assessed on?

A) A teaching deck: a lesson, a revision session, an explanation of a concept. The answer is yes.
B) A general deck: a plan, a briefing, an event, a morning assembly, a parents' evening, a celebration, an introduction to an initiative. The answer is no.

Do not assume (A). A deck about Mother's Day or a school trip plan is not a lesson, and putting "lesson objectives", a "worked example" and a "quick check" on top of it makes the deck look like a template forced onto its subject. Equally, do not strip a real lesson of its example and its check by calling it "general".

Use the words "lesson", "class" and "student" only when (A) is actually true.

Structure for (A) — a teaching deck:
1. Cover slide (intro): the title + one line naming what a student will be able to do by the end.
2. Hook slide (intro): a question or real situation that makes the topic worth attention.
3. Objectives slide (intro): three lines starting "• ", each an observable outcome (calculates, explains, compares) — never "understands" or "knows".
4. At least one divider slide between sections.
5. Concept slides (intro): the bulk of the deck. Exactly one idea per slide.
6. A worked example (challenge) near the end, with the full solution in teacher.expectedAnswer.
7. A check slide (question) with four options.
8. A summary slide at the end: three "• " lines + a sentence naming what comes next.

Structure for (B) — a general deck:
1. Cover slide (intro): the title + one line naming what the audience leaves with.
2. Hook slide (intro): why this topic now — an occasion, a situation, or a real question.
3. A "what we'll cover" slide (intro): three "• " lines describing the deck's own content, not behavioural objectives. Title it from the subject ("What we're preparing", "What we'll go through") — never "lesson objectives".
4. At least one divider slide between sections.
5. Content slides (intro): the bulk of the deck. One idea per slide, and the title states the idea rather than labelling it.
6. A practical slide (challenge) near the end: steps to carry out, a checklist, or who does what — something the audience does, not a problem to solve. Put the detail in teacher.expectedAnswer.
7. A question slide is OPTIONAL here: add one only if the topic holds a decision worth putting to the room or an opinion worth polling. Otherwise leave it out — a multiple-choice question about a celebration plan reads as an exam in the wrong place.
8. A summary slide at the end: three "• " lines + a sentence naming the practical next step.

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
  "learningObjective": "What this deck is for, in one sentence",
  "materials": ["Projector"],
  "deckPhotoQueries": ["english photo query for the cover", "english photo query for the section break"],
  "teacherPreparation": "What the teacher needs before presenting",
  "slides": [
    {
      "slideNumber": 1, "type": "intro",
      "title": "Deck title",
      "content": "By the end of this deck you will be able to ...",
      "durationSeconds": 0,
      "teacher": { "teachingTips": "How to open on this slide" }
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
      "teacher": { "teachingTips": "What gets built on this afterwards" }
    }
  ],
  "teacherNotes": ["A note for the teacher"],
  "answerKey": ["Worked example: the answer", "Quick check: the answer"],
  "printables": [],
  "assessment": "How the teacher knows the objective was met",
  "extensionChallenge": "An extension for advanced students"
}

Slide shapes — use them so the deck does not read as one card repeated:
Add a "layout" field to a concept slide when its shape fits; otherwise leave it out.
- "statement": one idea worth filling the screen. "content" is a single short sentence — no lists, no multiple lines.
- "stat": a figure worth projecting. Add "stat": {"value":"the figure","label":"what it means","source":"where it is from, if any"}. Keep the figure short (about three characters).
  Never invent statistics. Use only numbers intrinsic to the subject (how many laws, the value of a constant, a year, a percentage the teacher's description supplied). With no real number, do not use this shape.
- "compare": a genuine two-sided contrast (before/after, right/wrong, two methods). Add "compare": {"leftTitle":"","left":["",""],"rightTitle":"","right":["",""]}. Both sides always filled.
- "steps": the ordered stages of a process. "content" is "• " lines in order, at least two.
Give a special shape to no more than half the concept slides — the point is variety, not chaos.

Mandatory rules:
- Every slide without exception carries a non-empty "teacher" object. A slide without one shows the teacher a notes button that opens nothing.
- "content" is multi-line: separate with \\n and start list lines with "• ". Never one unbroken paragraph, and never fewer than two lines on any slide.
  A one-line slide is rejected. If you cannot find two lines worth saying, merge that slide into the next one and make the deck shorter — six full slides beat ten half-empty ones.
- Never put "mediaPrompt" on a slide that carries a "layout": that slide fills the screen with its own shape and has nowhere to put a picture.
- A concept slide carries exactly one idea. If you have two ideas, make two slides.
- The three wrong options on a question slide are real, plausible misconceptions — not filler, not random numbers. "correctIndex" is 0-based (0 means the first option), never the option's position as a person would count it.
- "deckPhotoQueries" is two English search phrases (2-5 words each) describing the deck's own subject: the first backs the cover, the second the section break, and they must differ from each other. Always English whatever language the deck is in — the photo index is English and an Arabic query comes back empty. Describe the TOPIC, not the school subject: a Mother's Day deck wants "mother and child hands", never "mathematics classroom".
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
