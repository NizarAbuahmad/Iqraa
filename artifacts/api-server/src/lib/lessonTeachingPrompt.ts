/**
 * Prompts for `/generate/lesson-teaching` — the explanation section of a
 * Slides Maker deck.
 *
 * Slides Maker (`buildLessonDeck` in the mobile app) assembles its deck from
 * the curriculum book: outcomes, vocabulary, rules, figures and worked
 * examples, projected verbatim. What the book data does not carry is the
 * teaching itself — for 14 of 17 Grade 10 chemistry lessons and 12 of 36
 * maths lessons the deck had no explanation, rule or example slide at all,
 * only orientation slides and checks. The lesson plan could not fill that:
 * it is written AT the teacher («ابدأ بسؤال…»), so the deck deliberately keeps
 * its prose off the projector.
 *
 * So this asks for exactly the missing part, written FOR the projector: a
 * hook question, the explanation one idea per slide, one worked example and
 * one practice problem. Nothing the book already supplies is asked for, so
 * the book's own wording is never replaced by a paraphrase of itself.
 *
 * The rules below each answer a failure seen in a real deck:
 *  - "stay inside this lesson" — the generated checks for «المول والكتلة
 *    المولية» were limiting-reagent problems from the NEXT lesson.
 *  - "the problem never contains its answer" — a book example projected
 *    «…: (x−2)²+(y+3)²=25», solution included, before the reveal timer.
 *  - "no stage directions on screen" — the plan's «ابدأ بسؤال…» is why the
 *    old warm-up slide had nothing to project.
 */

/** Concept slides asked for. More is a lecture; fewer is not an explanation. */
export const TEACHING_CONCEPTS_MIN = 3;
export const TEACHING_CONCEPTS_MAX = 5;

export function lessonTeachingPromptAr(b: any): string {
  return `اكتب قسم الشرح في عرض شرائح يُعرض على شاشة الصف لدرس "${b.topic}" — مادة ${b.subject}، ${b.grade}.
${b.additionalContext ? `\nمحتوى الكتاب المدرسي لهذا الدرس (مرجعك الوحيد):\n${b.additionalContext}\n` : ''}
يأخذ العرض من الكتاب مباشرةً: النتاجات، والمفردات، والقواعد، والأشكال، والأمثلة المحلولة. لا تكتب شيئًا من ذلك. اكتب فقط ما ينقص: سؤال التمهيد، والشرح، ومثالًا محلولًا، ومسألة تدريب.

كل ما في "question" و"title" و"points" و"problem" و"steps" يُعرض على الطلبة كما هو:
- اكتبه للطلبة مباشرةً، لا للمعلّم. لا تعليمات إخراج مثل «ابدأ بسؤال…» أو «اطلب من الطلبة…» — هذه مكانها "teacherNote".
- بالعربية الفصحى، جملًا قصيرة تُقرأ من آخر الصف.

قواعد إلزامية:
1. التزم بهذا الدرس وحده. لا تشرح محتوى الدرس التالي أو السابق، ولا تضع في المثال أو التدريب مهارةً لم يشرحها قسم الشرح.
2. لا تخترع حقائق أو أرقامًا أو تواريخ أو إحصاءات غير واردة في محتوى الكتاب أعلاه أو من صميم المادة المعروفة لهذا الصف.
3. "concepts" من ${TEACHING_CONCEPTS_MIN} إلى ${TEACHING_CONCEPTS_MAX} شرائح، بترتيب الشرح، وكل شريحة فكرة واحدة فقط.
   - "title" هو الفكرة نفسها كجملة خبرية قصيرة («المول يربط عدد الجسيمات بكتلة المادة»)، لا تسمية («المول»)، ولا «الفكرة 1».
   - "points" من سطرين إلى أربعة: تفسير، ثم مثال قصير أو حالة خاصة. بلا رمز نقطة في أول السطر.
   - "misconception" الخطأ الشائع في هذه الفكرة تحديدًا.
4. "hook.question" سؤال واحد يستطيع الطالب التفكير فيه قبل الشرح، من موقف واقعي أو مفاجئ. لا تضع إجابته في نصّه.
5. "workedExample.problem" نص المسألة كاملًا بمعطياتها، ولا يتضمّن الإجابة أبدًا. "steps" خطوات الحل بالترتيب (٢-٦ خطوات)، و"answer" الإجابة النهائية وحدها.
6. "practice.problem" مسألة جديدة من نوع المثال نفسه، بأرقام مختلفة، لا تتضمّن إجابتها. "hint" يوجّه دون أن يحلّ.
7. اكتب المعادلات والرموز الرياضية بالحروف اللاتينية x و y وبالأرقام اللاتينية حتى داخل الجمل العربية، والصيغ الكيميائية بصيغتها المعتادة (H₂O).
8. إن لم يكن في الدرس ما يُحسب (درس وصفي بالكامل) فاجعل "workedExample" تحليلًا لحالة أو مقارنة محلولة، و"practice" سؤالًا تطبيقيًا بإجابة نموذجية.
9. لا تُضِف حقل "verified" أو "verifiedBy" إطلاقًا.

أعد JSON بهذا الشكل فقط:
{
  "hook": { "question": "سؤال التمهيد", "teacherNote": "كيف يدير المعلّم النقاش حوله" },
  "concepts": [
    { "title": "الفكرة كجملة خبرية", "points": ["سطر الشرح", "مثال قصير"], "teacherNote": "ما يؤكّد عليه المعلّم", "misconception": "الخطأ الشائع" }
  ],
  "workedExample": { "problem": "نص المسألة بمعطياتها", "steps": ["الخطوة الأولى", "الخطوة الثانية"], "answer": "الإجابة النهائية" },
  "practice": { "problem": "مسألة التدريب", "hint": "تلميح", "answer": "الإجابة" }
}`;
}

export function lessonTeachingPromptEn(b: any): string {
  return `Write the explanation section of a slide deck projected in class for the lesson "${b.topic}" — ${b.subject}, ${b.grade}.
${b.additionalContext ? `\nThe textbook content for this lesson (your only source):\n${b.additionalContext}\n` : ''}
The deck takes these straight from the book: learning outcomes, vocabulary, rules, figures and worked examples. Do not write any of them. Write only what is missing: the hook question, the explanation, one worked example and one practice problem.

Everything in "question", "title", "points", "problem" and "steps" is projected to the students as written:
- Address the students directly, not the teacher. No stage directions such as "Start by asking…" or "Have students…" — those belong in "teacherNote".
- Short sentences, readable from the back row.

Mandatory rules:
1. Stay inside this lesson. Do not teach the next or the previous lesson's content, and do not put a skill in the example or the practice that the explanation did not teach.
2. Never invent facts, figures, dates or statistics that are not in the textbook content above or core to this subject at this grade.
3. "concepts" is ${TEACHING_CONCEPTS_MIN} to ${TEACHING_CONCEPTS_MAX} slides, in teaching order, exactly one idea per slide.
   - "title" is the idea itself as a short claim ("A mole links a particle count to a mass"), never a label ("The mole") and never "Idea 1".
   - "points" is two to four lines: an explanation, then a short example or special case. No bullet character at the start.
   - "misconception" is the common error on this specific idea.
4. "hook.question" is one question a student can think about before the explanation, from a real or surprising situation. Its text never contains its answer.
5. "workedExample.problem" states the full problem with its givens and never contains the answer. "steps" is the solution in order (2-6 steps), and "answer" is the final answer alone.
6. "practice.problem" is a new problem of the same kind as the example, with different numbers, not containing its answer. "hint" guides without solving.
7. Write equations with latin x and y, and chemical formulas in their usual form (H₂O).
8. If the lesson has nothing to calculate (a purely descriptive lesson), make "workedExample" a solved case analysis or comparison and "practice" an applied question with a model answer.
9. Never add a "verified" or "verifiedBy" field.

Return only JSON in this shape:
{
  "hook": { "question": "The hook question", "teacherNote": "How the teacher runs the discussion" },
  "concepts": [
    { "title": "The idea as a claim", "points": ["An explanation line", "A short example"], "teacherNote": "What the teacher stresses", "misconception": "The common error" }
  ],
  "workedExample": { "problem": "The problem with its givens", "steps": ["Step one", "Step two"], "answer": "The final answer" },
  "practice": { "problem": "The practice problem", "hint": "A hint", "answer": "The answer" }
}`;
}
