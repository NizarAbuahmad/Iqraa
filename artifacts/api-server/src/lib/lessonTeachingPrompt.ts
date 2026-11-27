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
 * hook question, the explanation one idea per slide, one worked example, one
 * wrong solution built from a misconception for the class to correct («اكتشف
 * الخطأ» — the misconceptions were written for every concept and only ever
 * reached the teacher panel) and one practice problem. Nothing the book already supplies is asked for, so
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

import { DECK_ICON_NAMES, diagramLimitsAr, diagramLimitsEn } from "./promptSlidesPrompt.ts";
import { PROMPT_EXAMPLE_CHECKS } from "./lessonTeachingChecks.ts";
import { figureFormatAr, figureFormatEn } from "./figurePrompt.ts";
import { isMathContext } from "@workspace/math-practice";
import { firstGradeClauseAr, firstGradeClauseEn } from "./firstGrade.ts";

/** Concept slides asked for. More is a lecture; fewer is not an explanation. */
export const TEACHING_CONCEPTS_MIN = 3;
export const TEACHING_CONCEPTS_MAX = 5;

/** Drawings (a graph or vectors) a maths lesson may carry in all: on its concepts and its worked example. */
export const LESSON_VISUALS_MAX = 2;

/** What the model attached to its concepts — logged per section, see routes/generate.ts. */
export function teachingVisualCounts(content: unknown): { concepts: number; shape: number; icon: number; chart: number; photo: number; visual: number } {
  const list = content !== null && typeof content === "object" && Array.isArray((content as { concepts?: unknown }).concepts)
    ? (content as { concepts: unknown[] }).concepts.filter((c): c is Record<string, unknown> => c !== null && typeof c === "object")
    : [];
  const has = (k: string) => list.filter(c => c[k] !== undefined && c[k] !== null && c[k] !== "").length;
  const example = content !== null && typeof content === "object" ? (content as { workedExample?: unknown }).workedExample : undefined;
  const exampleVisual = example !== null && typeof example === "object" && (example as Record<string, unknown>)["visual"] ? 1 : 0;
  return { concepts: list.length, shape: has("shape"), icon: has("icon"), chart: has("chart"), photo: has("photo"), visual: has("visual") + exampleVisual };
}

export function lessonTeachingPromptAr(b: any): string {
  const limits = diagramLimitsAr();
  return `اكتب قسم الشرح في عرض شرائح يُعرض على شاشة الصف لدرس "${b.topic}" — مادة ${b.subject}، ${b.grade}.
${b.additionalContext ? `\nمحتوى الكتاب المدرسي لهذا الدرس (مرجعك الوحيد):\n${b.additionalContext}\n` : ''}
يأخذ العرض من الكتاب مباشرةً: النتاجات، والمفردات، والقواعد، والأشكال، والأمثلة المحلولة. لا تكتب شيئًا من ذلك. اكتب فقط ما ينقص: سؤال التمهيد، والشرح، ومثالًا محلولًا، وحلًّا خاطئًا يكتشف الطلبة خطأه، ومسألة تدريب.

كل ما في "question" و"title" و"points" و"problem" و"steps" و"claim" يُعرض على الطلبة كما هو:
- اكتبه للطلبة مباشرةً، لا للمعلّم. لا تعليمات إخراج مثل «ابدأ بسؤال…» أو «اطلب من الطلبة…» — هذه مكانها "teacherNote".
- بالعربية الفصحى، جملًا قصيرة تُقرأ من آخر الصف.

قواعد إلزامية:
1. التزم بهذا الدرس وحده. لا تشرح محتوى الدرس التالي أو السابق، ولا تضع في المثال أو التدريب مهارةً لم يشرحها قسم الشرح.
2. لا تخترع حقائق أو أرقامًا أو تواريخ أو إحصاءات غير واردة في محتوى الكتاب أعلاه أو من صميم المادة المعروفة لهذا الصف. الثوابت والقيم المعيارية التي يستعملها كل كتاب (عدد أفوجادرو 6.022×10²³، الكتل الذرية للعناصر الشائعة، π) مسموحة، واستعملها حيث يحتاجها الشرح.
3. "concepts" من ${TEACHING_CONCEPTS_MIN} إلى ${TEACHING_CONCEPTS_MAX} شرائح، مرتّبة من الأساس إلى ما يُبنى عليه (المفهوم الذي يحتاجه غيره يأتي أولًا)، وكل شريحة فكرة واحدة فقط.
   - "title" هو الفكرة نفسها كجملة خبرية قصيرة («المول يربط عدد الجسيمات بكتلة المادة»)، لا تسمية («المول»)، ولا «الفكرة 1».
   - "points" من سطرين إلى أربعة: تفسير، ثم مثال قصير أو حالة خاصة. بلا رمز نقطة في أول السطر.
   - المثال في "points" مثال حقيقي بقيم أو بحالة محدّدة («مول واحد من الكربون كتلته 12 g»)، لا جملة عامة مثل «إذا عُرفت الكمية أمكن حسابها».
   - "misconception" الخطأ الشائع في هذه الفكرة تحديدًا.
4. "hook.question" سؤال واحد يستطيع الطالب التفكير فيه قبل الشرح، من موقف واقعي أو مفاجئ. لا تضع إجابته في نصّه.
5. "workedExample.problem" نص المسألة كاملًا بمعطياتها، ولا يتضمّن الإجابة أبدًا. "steps" خطوات الحل بالترتيب (٢-٦ خطوات)، و"answer" الإجابة النهائية وحدها.
   كل خطوة تنجز شيئًا (كتابة العلاقة، التعويض، الحساب، تحويل الوحدة)، والخطوة الأخيرة تصل إلى القيمة. لا خطوة تكتفي بإعلان ما سيأتي مثل «نستنتج الكتلة النهائية».
6. "practice.problem" مسألة جديدة من نوع المثال نفسه، بأرقام مختلفة، لا تتضمّن إجابتها. "hint" يوجّه دون أن يحلّ.
7. اكتب المعادلات والرموز الرياضية بالحروف اللاتينية x و y وبالأرقام اللاتينية حتى داخل الجمل العربية، والصيغ الكيميائية بصيغتها المعتادة (H₂O). للضرب استعمل الرمز × دائمًا، لا الحرف x ولا *: الحرف x في هذا التطبيق متغيّر. لا تستعمل LaTeX ولا شرطة مائلة عكسية (\frac، \theta، \times)؛ اكتب x^2 و3/4 و×.
8. إن لم يكن في الدرس ما يُحسب (درس وصفي بالكامل) فاجعل "workedExample" تحليلًا لحالة أو مقارنة محلولة، و"practice" سؤالًا تطبيقيًا بإجابة نموذجية.
9. لا تُضِف حقل "verified" أو "verifiedBy" إطلاقًا.
10. راجع إملاء المصطلحات قبل الإرجاع (المولات لا «الموغات»).
11. "mistake" نشاط «اكتشف الخطأ»: "claim" حلّ قصير أو قول لطالب متخيَّل (سلمى، عمر…) من نوع المثال المحلول، فيه خطأ واحد فقط، وهذا الخطأ هو أحد الأخطاء التي كتبتها في "misconception" — لا خطأ حسابي عابر. لا تُشِر إلى الخطأ في "claim" — اكتشافه هو النشاط. "hint" يوجّه إلى مكان البحث دون أن يسمّي الخطأ، و"answer" يسمّي الخطوة الخاطئة ويصحّحها بالقيمة الصحيحة.
12. حين يحتاج سؤال التمهيد أو المسألة إلى سياق، فليكن من حياة الطلبة في الأردن: الدينار الأردني، وأماكن أردنية (عمّان، العقبة، البحر الميت، إربد)، والحياة اليومية في البيت والمدرسة. لا تفرض سياقًا على فكرة لا تحتاجه. والأرقام التي تخترعها لمسألة تبقى قيم مسألة — لا تقدّمها حقائق عن مكان حقيقي.
13. لكل فكرة في "concepts" إضافات اختيارية، فقط حين تفيد فعلًا:
   - "shape": شكل يرسم الفكرة بدل القائمة، واحد من: "compare" {"leftTitle","left","rightTitle","right"}، "table" {"headers","rows"}، "flow" {"steps"}، "timeline" [{"label","text"}]، "stat" {"value","label"}، "cycle" {"stages":[{"label","note"}]}، "tree" {"root","branches":[{"label","leaves"}]}، "venn" {"sets":[{"label","only"}],"shared"}، "mindmap" {"center","nodes":[{"text","role"}]}. اكتبه هكذا: "shape": {"layout":"cycle","cycle":{...}}. عندها اجعل "points" سطرين يلخّصان الشكل.
     حدود كل شكل — ما يزيد عليها يُسقط الشكل كله، فالتزم بها:
     - "compare": عنوان لكل طرف وسطر واحد على الأقل في كل طرف.
     - "table": من ٢ إلى ٤ أعمدة ومن ٢ إلى ٦ صفوف، والعنوان حتى ٣٠ حرفًا والخلية حتى ٨٠، وفي كل صف خلية واحدة بالضبط تحت كل عنوان.
     - "flow": من ٣ إلى ٦ مراحل، وكل مرحلة حتى ٦٠ حرفًا.
     - "timeline": من ٣ إلى ٦ أحداث، والتسمية حتى ٢٤ حرفًا والنص حتى ١٢٠.
     - "stat": "value" حتى ١٢ حرفًا، و"label" مكتوب.
     - "cycle": ${limits.cycle}.
     - "tree": ${limits.tree}.
     - "venn": ${limits.venn}.
     - "mindmap": ${limits.mindmap}؛ و"role" اختياري: "cause" للسبب و"effect" للنتيجة.
   - "icon": اسم أيقونة واحد من: ${DECK_ICON_NAMES.join(", ")}.
   - "chart": {"kind":"chart","chartType":"bar","categories":[..],"values":[..]} فقط من أرقام واردة في محتوى الكتاب أعلاه. لا تخترع أرقامًا أبدًا، ولا تجمع "chart" مع "shape".
   - "photo": عبارة بحث إنجليزية من ٢-٥ كلمات لمشهد حقيقي (مكان، تجربة، ظاهرة)، لا لقاعدة رياضية؛ في فكرتين على الأكثر.
14. الدقة قبل الإرجاع — يقرأ هذا الشرحَ طالبٌ وحده، فلا أحد يصحّح خطأه:
   - "answer" في المثال والتدريب هو الناتج النهائي محسوبًا ومبسّطًا: عدد بوحدته، أو الأزواج المرتبة نفسها، أو العبارة بعد التبسيط. لا شرطة «—»، ولا وصف للطريقة («الحل هو نقطتا التقاطع»)، ولا عبارة لم تُحسب («63 × sin 30°» بل «31.5 cm²»).
   - تحقّق من كل إجابة: عوّضها في المسألة (في كل معادلة من النظام) وأعد كل عملية حسابية. إن لم تتحقق فغيّر أرقام المسألة لا الإجابة، واختر أرقامًا تعطي ناتجًا نظيفًا (عددًا صحيحًا أو كسرًا بسيطًا).
   - كل قاعدة عامة في "points" تصحّ في كل الحالات، ومنها القيم السالبة؛ وإن كانت تصحّ بشرط فاذكر الشرط.
   - استعمل رموز الكتاب: في المثلث ABC الضلع a يقابل الزاوية A، فقانون جيب التمام c^2 = a^2 + b^2 - 2ab cos C.
   - «معمل» أو «تجربة استهلالية» يسبق الدروس التي يمهّد لها: مثاله وتدريبه مما يفعله النشاط نفسه، لا مهارة من درس لاحق.
   - إن طلبت نتاجات الدرس حسابًا فالمثال والتدريب حساب من هذا النوع، لا سؤال وصفي.
15. فحص آلي للحساب: يجوز أن يحمل "workedExample" و"practice" حقل "check" بالأحرف اللاتينية فقط، يحسبه برنامج جبر رمزي ويقارنه بإجابتك، فيُعاد الرد إن اختلفا:
   - "check": {"topic","question","answer"}. اكتب في "question" ما حسبتَه فعلًا، وفي "answer" الناتج نفسه الذي كتبتَه في "answer" أعلاه.
   - "topic" واحد من: "evaluate" (تعبير عددي مغلق: "question" مثل "${PROMPT_EXAMPLE_CHECKS.evaluate.question}" أو "(1*1 + 4*4 + 5*7)/10"، والزاوية بالدرجات تُكتب 30°؛ و"answer" عدد بأرقام لاتينية بالتقريب الذي كتبتَه، لا وحدة ولا رمز ≈، أو صيغة دقيقة مثل "10*sqrt(3)/3")، و"system_solutions" (نظام معادلتين في x وy تفصل بينهما فاصلة منقوطة: "${PROMPT_EXAMPLE_CHECKS.system.question}"، و"answer" النقاط: "${PROMPT_EXAMPLE_CHECKS.system.answer}")، و"equation_linear" أو "equation_quadratic" (معادلة واحدة "x^2 - 5x + 6 = 0" والإجابة "x = 2 or x = 3")، و"derivative_polynomial" (الاقتران "x^3 - 4x" والإجابة "3x^2 - 4").
   - لا تضع check إن لم يناسب أحد هذه المواضيع، ولا تكتب check لا يطابق ما حسبتَه فعلًا؛ غيابه أفضل من فحص لسؤال آخر.
   - لا تضع check إلا حين تكون الإجابة عددًا أو تعبيرًا أو أزواجًا مرتبة؛ والإجابة الوصفية (تفسير، تعريف، تركيب إلكتروني، مقارنة) لا check لها لأنها ليست عددًا. ولا تنسخ المثال أعلاه: "question" هو ما حسبتَه أنت في هذه المسألة.
${isMathContext(b.topic, null, b.subject) ? `16. رسم بياني أو متجهات (لدروس الرياضيات فقط): يجوز أن يحمل "concept" أو "workedExample" حقلًا اختياريًّا واحدًا اسمه "visual"، وبحدٍّ أقصى ${LESSON_VISUALS_MAX} في القسم كله. اكتب في "points" أو "problem" كل ما يحتاجه الطالب (الاقتران مكتوبًا أو مركّبات المتجه): الرسم يوضّح ولا يحمل المعلومة وحده.
${figureFormatAr()}
` : ''}
أعد JSON بهذا الشكل فقط:
{
  "hook": { "question": "سؤال التمهيد", "teacherNote": "كيف يدير المعلّم النقاش حوله" },
  "concepts": [
    { "title": "الفكرة كجملة خبرية", "points": ["سطر الشرح", "مثال قصير"], "teacherNote": "ما يؤكّد عليه المعلّم", "misconception": "الخطأ الشائع" }
  ],
  "workedExample": { "problem": "نص المسألة بمعطياتها", "steps": ["الخطوة الأولى", "الخطوة الثانية"], "answer": "الإجابة النهائية", "check": {"topic":"<evaluate | system_solutions | equation_linear | equation_quadratic | derivative_polynomial>","question":"<ما حسبتَه فعلًا>","answer":"<ناتجه>"} },
  "mistake": { "claim": "قالت سلمى: … (حلّ فيه خطأ واحد)", "hint": "أين تبحث", "answer": "الخطوة الخاطئة وتصحيحها" },
  "practice": { "problem": "مسألة التدريب", "hint": "تلميح", "answer": "الإجابة", "check": {"topic":"<…>","question":"<ما حسبتَه فعلًا>","answer":"<ناتجه>"} }
}${firstGradeClauseAr(b, "explain")}`;
}

export function lessonTeachingPromptEn(b: any): string {
  const limits = diagramLimitsEn();
  return `Write the explanation section of a slide deck projected in class for the lesson "${b.topic}" — ${b.subject}, ${b.grade}.
${b.additionalContext ? `\nThe textbook content for this lesson (your only source):\n${b.additionalContext}\n` : ''}
The deck takes these straight from the book: learning outcomes, vocabulary, rules, figures and worked examples. Do not write any of them. Write only what is missing: the hook question, the explanation, one worked example, one wrong solution for the students to correct, and one practice problem.

Everything in "question", "title", "points", "problem", "steps" and "claim" is projected to the students as written:
- Address the students directly, not the teacher. No stage directions such as "Start by asking…" or "Have students…" — those belong in "teacherNote".
- Short sentences, readable from the back row.

Mandatory rules:
1. Stay inside this lesson. Do not teach the next or the previous lesson's content, and do not put a skill in the example or the practice that the explanation did not teach.
2. Never invent facts, figures, dates or statistics that are not in the textbook content above or core to this subject at this grade. Standard constants and values every textbook uses (Avogadro's number 6.022×10²³, atomic masses of common elements, π) are allowed — use them wherever the explanation needs them.
3. "concepts" is ${TEACHING_CONCEPTS_MIN} to ${TEACHING_CONCEPTS_MAX} slides, ordered from the foundation to what builds on it (a concept others depend on comes first), exactly one idea per slide.
   - "title" is the idea itself as a short claim ("A mole links a particle count to a mass"), never a label ("The mole") and never "Idea 1".
   - "points" is two to four lines: an explanation, then a short example or special case. No bullet character at the start.
   - The example in "points" is a real one, with values or a specific case ("one mole of carbon has a mass of 12 g"), never a general sentence like "if the amount is known it can be calculated".
   - "misconception" is the common error on this specific idea.
4. "hook.question" is one question a student can think about before the explanation, from a real or surprising situation. Its text never contains its answer.
5. "workedExample.problem" states the full problem with its givens and never contains the answer. "steps" is the solution in order (2-6 steps), and "answer" is the final answer alone.
   Every step does work (write the relation, substitute, calculate, convert a unit), and the last step reaches the value. No step that only announces the next one, such as "we conclude the final mass".
6. "practice.problem" is a new problem of the same kind as the example, with different numbers, not containing its answer. "hint" guides without solving.
7. Write equations with latin x and y, and chemical formulas in their usual form (H₂O). For multiplication always use ×, never the letter x or *: x is a variable in this app. Never write LaTeX or a backslash (\frac, \theta, \times): write x^2, 3/4 and ×.
8. If the lesson has nothing to calculate (a purely descriptive lesson), make "workedExample" a solved case analysis or comparison and "practice" an applied question with a model answer.
9. Never add a "verified" or "verifiedBy" field.
10. Check the spelling of subject terms before returning.
11. "mistake" is a "Spot the mistake" activity: "claim" is a short solution or statement by an imaginary student (Salma, Omar…) of the same kind as the worked example, with exactly one error, and that error is one of the errors you wrote in "misconception" — not a passing arithmetic slip. Never mark the error in "claim" — finding it is the activity. "hint" says where to look without naming the error; "answer" names the wrong step and corrects it with the right value.
12. When the hook or a problem needs a setting, set it in the students' own Jordan: Jordanian dinars (JD), Jordanian places (Amman, Aqaba, the Dead Sea, Irbid), everyday life at home and at school. Do not force a setting onto an idea that needs none. Numbers you make up for a problem stay problem values — never as facts about a real place.
13. Each item in "concepts" may carry optional extras, only where they genuinely help:
   - "shape": a drawing of the idea instead of a list, one of: "compare" {"leftTitle","left","rightTitle","right"}, "table" {"headers","rows"}, "flow" {"steps"}, "timeline" [{"label","text"}], "stat" {"value","label"}, "cycle" {"stages":[{"label","note"}]}, "tree" {"root","branches":[{"label","leaves"}]}, "venn" {"sets":[{"label","only"}],"shared"}, "mindmap" {"center","nodes":[{"text","role"}]}. Write it as "shape": {"layout":"cycle","cycle":{...}}. Then make "points" two lines that sum the drawing up.
     Limits for each shape — going over one drops the whole shape, so stay inside them:
     - "compare": a title for each side and at least one line on each side.
     - "table": 2 to 4 columns and 2 to 6 rows, a header up to 30 characters and a cell up to 80, and exactly one cell under every header in every row.
     - "flow": 3 to 6 stages, each up to 60 characters.
     - "timeline": 3 to 6 events, a label up to 24 characters and the text up to 120.
     - "stat": "value" up to 12 characters, and a "label" written.
     - "cycle": ${limits.cycle}.
     - "tree": ${limits.tree}.
     - "venn": ${limits.venn}.
     - "mindmap": ${limits.mindmap}; "role" is optional: "cause" or "effect".
   - "icon": one icon name from: ${DECK_ICON_NAMES.join(", ")}.
   - "chart": {"kind":"chart","chartType":"bar","categories":[..],"values":[..]} only from figures in the textbook content above; never invent figures, and never put "chart" with "shape".
   - "photo": a 2-5 word English search phrase for a real scene (a place, an experiment, a phenomenon), never for a maths rule; on two concepts at most.
14. Accuracy before you return — a student reads this explanation alone, with nobody to catch a mistake:
   - "answer" in the worked example and the practice is the final result, worked out and simplified: a number with its unit, the ordered pairs themselves, or the simplified expression. Never a dash "—", never a description of the method ("the solution is the intersection points"), never an unevaluated expression (not "63 × sin 30°" but "31.5 cm²").
   - Check every answer: substitute it back into the problem (into every equation of a system) and redo every calculation. If it does not check, change the problem's numbers, not the answer, and pick numbers that give a clean result (a whole number or a simple fraction).
   - Every general rule in "points" holds in every case, including negative values; if it holds only under a condition, state the condition.
   - Use the book's notation: in triangle ABC side a is opposite angle A, so the law of cosines is c^2 = a^2 + b^2 - 2ab cos C.
   - A lab or an opening experiment comes before the lessons it leads into: its example and practice use what the activity itself does, never a skill from a later lesson.
   - If the lesson's outcomes ask for a calculation, the example and the practice are calculations of that kind, not a descriptive question.
15. An automatic check of the arithmetic: "workedExample" and "practice" may each carry a "check", in Latin characters only, that a symbolic-algebra program computes and compares with your answer; if they differ the reply is asked for again:
   - "check": {"topic","question","answer"}. Put in "question" what you actually computed, and in "answer" the very result you wrote in "answer" above.
   - "topic" is one of: "evaluate" (a closed numeric expression: "question" like "${PROMPT_EXAMPLE_CHECKS.evaluate.question}" or "(1*1 + 4*4 + 5*7)/10", angles in degrees written 30°; "answer" a number in Latin digits rounded the way you wrote it, no unit and no ≈ sign, or an exact form like "10*sqrt(3)/3"), "system_solutions" (two equations in x and y separated by a semicolon: "${PROMPT_EXAMPLE_CHECKS.system.question}", and "answer" the points: "${PROMPT_EXAMPLE_CHECKS.system.answer}"), "equation_linear" or "equation_quadratic" (one equation "x^2 - 5x + 6 = 0", answer "x = 2 or x = 3"), "derivative_polynomial" (the function "x^3 - 4x", answer "3x^2 - 4").
   - Omit "check" when none of these fits, and never write a check that is not what you actually computed; no check is better than a check of a different question.
   - Write a "check" only when the answer is a number, an expression or ordered pairs; a descriptive answer (an explanation, a definition, an electron configuration, a comparison) has no check, because it is no number. Do not copy the example above: "question" is what you computed in this problem.
${isMathContext(b.topic, null, b.subject) ? `16. A graph or vectors (maths lessons only): a "concept" or the "workedExample" may carry one optional "visual", at most ${LESSON_VISUALS_MAX} in the whole section. Write everything the student needs in "points" or "problem" (the function written out, the vector's components): the drawing illustrates and never carries the information alone.
${figureFormatEn()}
` : ''}
Return only JSON in this shape:
{
  "hook": { "question": "The hook question", "teacherNote": "How the teacher runs the discussion" },
  "concepts": [
    { "title": "The idea as a claim", "points": ["An explanation line", "A short example"], "teacherNote": "What the teacher stresses", "misconception": "The common error" }
  ],
  "workedExample": { "problem": "The problem with its givens", "steps": ["Step one", "Step two"], "answer": "The final answer", "check": {"topic":"<evaluate | system_solutions | equation_linear | equation_quadratic | derivative_polynomial>","question":"<what you actually computed>","answer":"<its result>"} },
  "mistake": { "claim": "Salma says: … (a solution with one error)", "hint": "Where to look", "answer": "The wrong step and its correction" },
  "practice": { "problem": "The practice problem", "hint": "A hint", "answer": "The answer", "check": {"topic":"<…>","question":"<what you actually computed>","answer":"<its result>"} }
}${firstGradeClauseEn(b, "explain")}`;
}
