/**
 * What kind of lesson a subject teaches, for the LIVE lesson-plan prompt.
 *
 * The teaching style (direct / inquiry / collaborative, `prompts.ts`) says how
 * a lesson is run. This says what the work in it is made of — a recitation, an
 * observation, a source, a drill, a piece being made. Without it the live
 * prompt is subject-blind: its "direct" clause asks every subject for fully
 * worked examples and silent individual solving, which is a maths lesson, and a
 * Quran, PE or art plan inherits it.
 *
 * The offline generator fixed the same defect on 2026-10-01 (all 103 sampled
 * plans were one skeleton with the title swapped) in
 * `artifacts/mobile/services/ai/lessonPlanKinds.ts`. The subject → kind table
 * below mirrors that file; a test reads both and fails if they drift.
 *
 * Mathematics, an unrecognised subject and a free-typed one get NO clause: the
 * prompt they always had is the right one for maths, and an unknown subject
 * must not change behaviour by accident.
 */
import { subjectIdFromName } from "@workspace/math-practice";

export type LessonKind =
  | "calc" | "science" | "recitation" | "arabic" | "english" | "social" | "movement" | "making";

export const KIND_BY_SUBJECT: Record<string, LessonKind> = {
  mathematics: "calc",
  science: "science",
  biology: "science",
  "earth-science": "science",
  physics: "science",
  chemistry: "science",
  islamic: "recitation",
  arabic: "arabic",
  english: "english",
  social: "social",
  history: "social",
  geography: "social",
  "civic-education": "social",
  "financial-literacy": "social",
  "physical-education": "movement",
  "creative-arts": "making",
  "vocational-education": "making",
  "digital-literacy": "making",
};

/** The subject id a request is about: an explicit one, else the subject's name. */
export function subjectIdOf(b: { subject?: string; subjectId?: string }): string | null {
  return b.subjectId || subjectIdFromName(b.subject);
}

/** The kind a request's subject teaches, or null when no clause should be added. */
export function lessonKindOf(b: { subject?: string; subjectId?: string }): Exclude<LessonKind, "calc"> | null {
  const id = subjectIdOf(b);
  const kind = id ? KIND_BY_SUBJECT[id] : undefined;
  return kind && kind !== "calc" ? kind : null;
}

const OVERRIDE_AR = "هذا البند يحدّد مادة الدرس، وهو يحلّ محلّ أي مطلب في أسلوب التدريس أعلاه يفترض أمثلة محلولة أو حلّ مسائل خطوة بخطوة حيث لا ينطبق على هذه المادة؛ يبقى من الأسلوب ترتيب الحصة فقط (من يتكلم ومتى).";
const OVERRIDE_EN = "This section fixes what the lesson is made of. It replaces any requirement in the teaching style above that assumes worked examples or step-by-step problem solving where that does not fit this subject; only the style's ordering of the lesson (who talks, and when) still applies.";

const KIND_AR: Record<Exclude<LessonKind, "calc">, string> = {
  recitation: `طبيعة المادة: تربية إسلامية — قراءة وفهم وعمل، لا حلّ مسائل.
- يقوم الدرس على قراءة سليمة لما تقرّر في الكتاب (آيات أو حديث أو نص)، ثم معاني المفردات، ثم الفكرة الرئيسة، ثم القيمة المستفادة وكيف تظهر في سلوك الطالب.
- "guidedPractice": قراءة جماعية ثم ثنائية مع تصحيح النطق والأحكام المقرّرة في الكتاب فقط. "independentPractice": قراءة فردية ومراجعة، وربط القيمة بموقف من حياة الطالب. "assessment": قراءة مسموعة، وشرح المعنى بكلمات الطالب، وموقف تطبيقي.
- لا تكتب نصّ آية أو حديث من ذاكرتك ولا تستشهد بما لم يرد في سياق الكتاب؛ إن لم يرد النص في السياق فاذكر أن المعلّم يقرؤه من الكتاب في الموضع المقرّر.
- ممنوع: «مثال محلول»، «مسألة»، «خطوات الحل».`,
  science: `طبيعة المادة: علوم — ملاحظة وسؤال وتفسير بدليل، لا حفظ تعريفات.
- يبدأ الدرس بظاهرة أو مشاهدة أو تجربة قصيرة، ثم يتنبّأ الطلبة، ثم يختبرون أو يلاحظون، ثم يفسّرون مستندين إلى ما رأوه.
- "materials": أدوات حقيقية وآمنة يمكن توفيرها في مدرسة، مع تنبيه سلامة إن لزم. "assessment": تفسير ظاهرة جديدة بدليل لا استرجاع تعريف.
- أبقِ التفسير ضمن مصطلحات الكتاب ولا تُدخل مفاهيم خارجه.`,
  arabic: `طبيعة المادة: لغة عربية — نص ومفردات ومهارات، لا حلّ مسائل.
- ينطلق الدرس من نص (أو أمثلة من النص) ثم يمرّ بالمهارات الأربع: استماع وتحدّث وقراءة وكتابة، ويوظّف الطلبة المفردات والتراكيب الجديدة في جمل وفقرة من إنتاجهم.
- القاعدة النحوية أو الإملائية (إن وُجدت) تُستنتج من أمثلة النص ثم تُطبَّق، لا تُلقَّن مجرّدة.
- "assessment": قراءة معبّرة، وإنتاج كتابي قصير، لا حل مسألة.`,
  english: `طبيعة المادة: لغة إنجليزية — عرض فتدريب فإنتاج.
- اجعل لغة الحصة الأساسية هي الإنجليزية: يُقدَّم المفرد أو التركيب المستهدف في سياق، ثم يتدرّب عليه الطلبة بتمارين محكومة (ترديد، ملء فراغ، ثنائيات)، ثم ينتجون لغتهم بحوار أو جملة أو فقرة قصيرة.
- يشمل الدرس نطقًا واستماعًا وكلامًا وكتابة بحسب الموضوع؛ وتكون أنشطة الطلبة بالإنجليزية.
- لا «مثال محلول» ولا مسائل.`,
  social: `طبيعة المادة: اجتماعيات — مصدر وحالة وتفسير، لا حفظ بلا دليل.
- يقوم الدرس على مصدر (نص أو خريطة أو جدول زمني أو صورة أو وثيقة أو حالة من الحياة) يلاحظه الطلبة ويستخرجون منه ما يدلّ، ثم يفسّرون الأسباب والنتائج، ثم يبدون رأيًا مدعومًا بدليل.
- استعمل ما ورد في سياق الكتاب من أسماء وتواريخ وأرقام ولا تختلق غيرها.
- "assessment": سؤال تفسير أو مقارنة أو موقف يتطلب دليلًا من الدرس.`,
  movement: `طبيعة المادة: تربية رياضية — مهارة وتدريب ولعب وسلامة، لا عمل مكتبي.
- رتّب الحصة: إحماء، ثم نقاط أداء المهارة (٣–٤ نقاط قصيرة)، ثم تدريبات متدرّجة من السهل إلى الصعب، ثم لعبة أو موقف أداء، ثم تهدئة.
- اذكر الأدوات والمساحة وعدد الطلبة في كل محطة، وقواعد السلامة صراحةً.
- "assessment": ملاحظة أداء بقائمة نقاط أداء، لا ورقة أسئلة.`,
  making: `طبيعة المادة: عملية (فنون أو مهنية أو رقمية) — عرض فتنفيذ فمراجعة.
- يعرض المعلّم الأداة أو الخطوات القصيرة، ثم ينفّذ الطلبة عملًا منتجًا، ثم يراجعون ناتجهم بمعايير جودة معلنة من البداية.
- "materials": أدوات ومواد حقيقية مع تنبيه سلامة عند الحاجة. "assessment": تقييم المنتج بمعايير واضحة، لا اختبار كتابي.`,
};

const KIND_EN: Record<Exclude<LessonKind, "calc">, string> = {
  recitation: `Nature of the subject: Islamic education — reading, understanding and acting, not problem solving.
- The lesson rests on correct reading of what the book sets (verses, hadith or text), then the meanings of the words, then the main idea, then the value learned and how it shows in the student's behaviour.
- "guidedPractice": choral then paired reading with correction of pronunciation and only the rules the book sets. "independentPractice": individual reading and review, and linking the value to a situation from the student's life. "assessment": a read-aloud, the meaning explained in the student's own words, and an applied situation.
- Do not write out a verse or hadith from memory or cite anything the book context does not contain; if the text is not in the context, say the teacher reads it from the book at the set place.
- Forbidden: "worked example", "problem", "solution steps".`,
  science: `Nature of the subject: science — observe, question and explain with evidence, not memorise definitions.
- Open with a phenomenon, observation or short experiment; students predict, then test or observe, then explain from what they saw.
- "materials": real, safe equipment a school can supply, with a safety note where needed. "assessment": explain a new phenomenon with evidence rather than recall a definition.
- Keep the explanation inside the book's terms and add no concepts from outside it.`,
  arabic: `Nature of the subject: Arabic language — text, vocabulary and skills, not problem solving.
- The lesson starts from a text (or examples from it) and moves through the four skills — listening, speaking, reading, writing — with students using the new vocabulary and structures in sentences and a paragraph of their own.
- A grammar or spelling rule (if any) is drawn out of examples from the text and then applied, not announced in the abstract.
- "assessment": expressive reading and a short piece of writing, not a solved problem.`,
  english: `Nature of the subject: English language — present, practise, produce.
- Make English the main language of the lesson: the target word or structure is presented in context, students practise it with controlled tasks (repetition, gap fill, pairs), then produce their own language in a dialogue, sentences or a short paragraph.
- Include pronunciation, listening, speaking and writing as the topic allows; students' activities are in English.
- No "worked example" and no problems.`,
  social: `Nature of the subject: social studies — source, case and interpretation, not facts without evidence.
- The lesson rests on a source (a text, map, timeline, picture, document or real-life case) that students observe and draw evidence from, then explain causes and effects, then give an opinion backed by evidence.
- Use the names, dates and figures in the book context and invent no others.
- "assessment": an interpretation, comparison or situation question that needs evidence from the lesson.`,
  movement: `Nature of the subject: physical education — skill, practice, play and safety, not desk work.
- Order the session: warm-up, then the skill's performance cues (3–4 short ones), then drills that progress from easy to hard, then a game or performance situation, then cool-down.
- State the equipment, the space and the number of students at each station, and the safety rules, explicitly.
- "assessment": observation of performance against a checklist of cues, not a question sheet.`,
  making: `Nature of the subject: practical (arts, vocational or digital) — demonstrate, make, review.
- The teacher shows the tool or the short steps, students make a product, then review their own result against quality criteria announced at the start.
- "materials": real tools and materials, with a safety note where needed. "assessment": judge the product against clear criteria, not a written test.`,
};

/**
 * Does a worksheet for this subject carry a worked example, a half-solved
 * question and a `solution` on every answer-key row?
 *
 * Only where there is a calculation to model: maths, physics and chemistry —
 * and a subject we cannot place, so a free-typed topic gets the paper it
 * always did. The offline worksheet is stricter (maths and chemistry only,
 * where a person wrote and checked the working); every other subject there
 * gets a plain paper, and the live prompt used to ask them all for the
 * structure anyway.
 */
export function usesWorkedExample(b: { subject?: string; subjectId?: string }): boolean {
  const id = subjectIdOf(b);
  if (id === null) return true;
  return (KIND_BY_SUBJECT[id] ?? "calc") === "calc" || id === "physics" || id === "chemistry";
}

const WS_END_AR = (n: number) => `\nلا تُدرج "workedExample" ولا سؤالًا نصف محلول، ولا حقل "solution" في answerKey: في كل عنصر منه "answer" إجابة نموذجية مختصرة أو معايير الإجابة. أعطِ ${n} سؤالًا في الأقسام.`;
const WS_END_EN = (n: number) => `\nDo not include "workedExample" or a half-solved question, and no "solution" field in answerKey: each entry has an "answer" that is a short model answer or the answer criteria. Give ${n} questions in the sections.`;

const WORKSHEET_AR: Record<Exclude<LessonKind, "calc">, string> = {
  recitation: `طبيعة المادة: تربية إسلامية — اجعل الأسئلة قراءةً وفهمًا وتطبيقًا: معاني المفردات، والفكرة الرئيسة، والقيمة المستفادة، وموقفًا من حياة الطالب يطبّق فيه ما تعلّم، وبندًا أو اثنين للقراءة أو التسميع يقيّمها المعلّم مباشرة. لا تكتب نصّ آية أو حديث من ذاكرتك ولا تستشهد بما لم يرد في سياق الكتاب.`,
  science: `طبيعة المادة: علوم — اجعل الأسئلة ملاحظةً وتفسيرًا وتنبؤًا: موقف أو تجربة قصيرة يصفها السؤال نفسه ثم يُطلب التفسير بدليل، وقراءة بيانات أو نتائج مكتوبة في نص السؤال، وتصنيفًا أو مقارنة. أبقِ المصطلحات ضمن الكتاب.`,
  arabic: `طبيعة المادة: لغة عربية — اجعل الأسئلة قائمة على نص قصير يرد داخل السؤال نفسه: فهم وتحليل، ومفردات في جمل، وتطبيق القاعدة على أمثلة، وبندًا للتعبير الكتابي القصير تُقيَّم إجابته بمعايير يذكرها المفتاح.`,
  english: `طبيعة المادة: لغة إنجليزية — اكتب الأسئلة والتعليمات بالإنجليزية: ملء فراغ، وترتيب كلمات في جملة، وفهم نص قصير يرد في السؤال، وإنتاج جملة أو فقرة قصيرة يُقيَّم بمعايير في المفتاح.`,
  social: `طبيعة المادة: اجتماعيات — اجعل الأسئلة قائمة على مصدر قصير يرد داخل السؤال (نص أو جدول أو سطر زمني): استخراج معلومة، وسبب ونتيجة، ومقارنة، ورأي مدعوم بدليل من الدرس. استعمل الأسماء والتواريخ والأرقام الواردة في سياق الكتاب فقط.`,
  movement: `طبيعة المادة: تربية رياضية — الورقة مكمّلة للأداء: أسئلة عن خطوات المهارة وقواعد السلامة وقواعد اللعبة، ومهمة أداء تُسجَّل ملاحظتها على قائمة نقاط، لا حلّ مسائل.`,
  making: `طبيعة المادة: عملية (فنون أو مهنية أو رقمية) — أسئلة عن الأدوات والمواد والخطوات والسلامة، ومهمة إنتاج أو تخطيط يُقيَّم ناتجها بمعايير جودة يذكرها المفتاح.`,
};

const WORKSHEET_EN: Record<Exclude<LessonKind, "calc">, string> = {
  recitation: `Nature of the subject: Islamic education — make the questions about reading, understanding and applying: word meanings, the main idea, the value learned, a situation from the student's life where they apply it, and one or two read-aloud items the teacher assesses directly. Do not write out a verse or hadith from memory or cite anything the book context does not contain.`,
  science: `Nature of the subject: science — make the questions about observing, explaining and predicting: a situation or short experiment described in the question itself, then an explanation with evidence; reading data or results written into the question; classifying or comparing. Keep to the book's terms.`,
  arabic: `Nature of the subject: Arabic language — base the questions on a short text that appears inside the question: comprehension and analysis, vocabulary in sentences, applying the rule to examples, and one short writing task assessed against criteria the key states.`,
  english: `Nature of the subject: English language — write the questions and instructions in English: gap fill, reordering words into a sentence, comprehension of a short text given in the question, and producing a sentence or short paragraph assessed against criteria in the key.`,
  social: `Nature of the subject: social studies — base the questions on a short source given inside the question (a text, table or timeline): pulling out a fact, cause and effect, comparison, and an opinion backed by evidence from the lesson. Use only the names, dates and figures in the book context.`,
  movement: `Nature of the subject: physical education — the sheet supports the performance: questions on the skill's steps, the safety rules and the rules of the game, and a performance task whose observation is recorded against a checklist; no problem solving.`,
  making: `Nature of the subject: practical (arts, vocational or digital) — questions on tools, materials, steps and safety, and a making or planning task whose product is assessed against quality criteria the key states.`,
};

/** The worksheet's subject rule, or "" when the subject uses the worked-example structure. */
export function worksheetKindRuleAr(b: { subject?: string; subjectId?: string }, n: number): string {
  if (usesWorkedExample(b)) return "";
  const kind = lessonKindOf(b);
  return kind ? `\n${WORKSHEET_AR[kind]}${WS_END_AR(n)}` : "";
}

export function worksheetKindRuleEn(b: { subject?: string; subjectId?: string }, n: number): string {
  if (usesWorkedExample(b)) return "";
  const kind = lessonKindOf(b);
  return kind ? `\n${WORKSHEET_EN[kind]}${WS_END_EN(n)}` : "";
}

/** Physics and chemistry lessons carry calculations, which a science plan should still work through. */
const CALC_SCIENCES = new Set(["physics", "chemistry"]);
const CALC_AR = "\n- هذه المادة فيها حسابات: اعرض داخل التفسير مثالًا حسابيًا محلولًا بخطواته الكاملة مرّة واحدة على الأقل، ثم اجعل الطلبة يحلّون مثله.";
const CALC_EN = "\n- This subject has calculations: inside the explanation work one calculation example in full steps at least once, then have students solve a similar one.";
const hasCalcs = (b: { subject?: string; subjectId?: string }) => CALC_SCIENCES.has(subjectIdOf(b) ?? "");

/** The clause to put after the teaching-style clause, or "" for maths and unknown subjects. */
export function lessonKindClauseAr(b: { subject?: string; subjectId?: string }): string {
  const kind = lessonKindOf(b);
  if (!kind) return "";
  return `${KIND_AR[kind]}${kind === "science" && hasCalcs(b) ? CALC_AR : ""}\n${OVERRIDE_AR}`;
}

export function lessonKindClauseEn(b: { subject?: string; subjectId?: string }): string {
  const kind = lessonKindOf(b);
  if (!kind) return "";
  return `${KIND_EN[kind]}${kind === "science" && hasCalcs(b) ? CALC_EN : ""}\n${OVERRIDE_EN}`;
}
