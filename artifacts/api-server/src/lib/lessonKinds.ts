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

// ─── Lesson types inside a subject ───────────────────────────────────────────

/**
 * The lesson's TYPE inside its subject — a hadith, a drama, a listening lesson.
 *
 * The subject clause above is one routine per subject, and inside Islamic
 * education, the arts and Arabic it fitted one type of lesson: the recitation
 * clause asked a lesson on the wudu for choral reading and pronunciation, the
 * arts clause asked a drama lesson for "a product". The app reads the type from
 * the lesson's id (`artifacts/mobile/services/ai/lessonTypes.ts`) and sends it
 * as `lessonType`; the list below must equal that file's `LESSON_TYPES` (a test
 * reads both). A type that is not on the list, or does not belong to the
 * request's subject, adds nothing — the request is client-controlled.
 */
export const LESSON_TYPES = [
  "quran", "hadith", "creed", "worship", "sira", "conduct",
  "visual-art", "music", "drama",
  "listening", "speaking", "reading", "writing", "language", "letters",
] as const;
export type LessonType = typeof LESSON_TYPES[number];

export const KIND_OF_TYPE: Record<LessonType, LessonKind> = {
  quran: "recitation", hadith: "recitation", creed: "recitation",
  worship: "recitation", sira: "recitation", conduct: "recitation",
  "visual-art": "making", music: "making", drama: "making",
  listening: "arabic", speaking: "arabic", reading: "arabic",
  writing: "arabic", language: "arabic", letters: "arabic",
};

/**
 * Islamic and Arabic types hold in Grades 1–6; art, music and drama in every
 * grade — `TYPED_UP_TO_GRADE` / `typeHoldsAt` in the app's `lessonTypes.ts`,
 * which does not send a type outside them. Checked here too, since the request
 * is the client's.
 */
const TYPED_UP_TO_GRADE = 6;
const EVERY_GRADE: ReadonlySet<LessonType> = new Set(["visual-art", "music", "drama"]);

/**
 * The request's lesson type: a known one, belonging to its subject, at a grade
 * it holds at, on a direct-style plan. Offline, only the direct style is typed
 * (`lessonPlanBlueprints.ts`); inquiry and collaborative keep their own phases,
 * so the live prompt must not reshape them either.
 */
export function lessonTypeOf(b: { subject?: string; subjectId?: string; lessonType?: unknown; grade?: unknown; teachingStyle?: unknown }): LessonType | null {
  const t = b.lessonType;
  if (typeof t !== "string" || !(LESSON_TYPES as readonly string[]).includes(t)) return null;
  const type = t as LessonType;
  if (lessonKindOf(b) !== KIND_OF_TYPE[type]) return null;
  if (b.teachingStyle === "inquiry" || b.teachingStyle === "collaborative") return null;
  const level = gradeLevelOf(b.grade);
  if (!EVERY_GRADE.has(type) && level !== null && level > TYPED_UP_TO_GRADE) return null;
  return type;
}

const TYPE_AR: Record<LessonType, string> = {
  quran: "نوع الدرس: تلاوة قرآن (سورة أو أحكام تلاوة) — تلاوة المعلّم ثم ترديد جماعي ففردي، ومعاني المفردات من الكتاب، والمعنى الإجمالي، وتسميع ما قُرّر حفظه.",
  hadith: "نوع الدرس: حديث شريف — قراءة نص الحديث كما ورد في سياق الكتاب وذكر راويه، ومعاني مفرداته، والتوجيه الذي يدعو إليه؛ ثم مواقف قصيرة يقرّر فيها الطلبة ما يوافق التوجيه، وتسميع الحديث.",
  creed: "نوع الدرس: عقيدة (أركان، أو اسم من أسماء الله الحسنى، أو ركن من أركان الإيمان) — يعرض المعلّم ما يذكره الكتاب بندًا بندًا (الأركان بترتيبها، أو الاسم ومعناه) ويسمّيه صراحةً كما ورد في سياق الكتاب، ثم يربطه بأمثلة من حياة الطالب وأثره في سلوكه. ليس الدرس تلاوة سورة.",
  worship: "نوع الدرس: عبادة عملية (وضوء أو صلاة أو صيام…) — خطوات العبادة بترتيبها كما في الكتاب، ثم أداء المعلّم العملي، ثم محاكاة الطلبة خطوة بخطوة، ثم أداء فردي بقائمة رصد. لا تُضف حكمًا لم يرد في سياق الكتاب.",
  sira: "نوع الدرس: سيرة وقصة — رواية القصة كما في الكتاب، وترتيب أحداثها على خط زمني، وإعادة الطلبة روايتها، والصفة أو العبرة المستفادة. ليس الدرس تلاوة سورة، ولا تفصيل فيه لم يرد في سياق الكتاب.",
  conduct: "نوع الدرس: خُلق وآداب وقيم — موقف من حياة الطلبة، والتوجيه الذي يذكره الكتاب، وتمييز السلوك الحسن من غيره بأمثلة وتمثيل أدوار، وعمل محدّد يلتزم به الطالب. ليس الدرس تلاوة سورة.",
  "visual-art": "نوع الدرس: تربية فنية (رسم أو تلوين أو تشكيل) — عرض نموذج وتقنية، ثم يُنتج الطالب عمله، ثم يراجعه بمعايير. سمِّ ما يذكره سياق الكتاب من ألوان أو أشكال أو خطوط بأسمائها.",
  music: "نوع الدرس: تربية موسيقية — استماع أولًا، ثم تقليد بالتصفيق أو الآلة أو الغناء (صدى)، ثم أداء جماعي وتنويع من ابتكار الطلبة. \"materials\": آلة إيقاعية أو تصفيق وتسجيل. لا «نموذج منجز» ولا منتج يُصنع.",
  drama: "نوع الدرس: تربية مسرحية — تحديد مساحة تمثيل، ومشهد قصير يؤدّيه المعلّم، ثم تجريب الطلبة في مجموعات (تجميد، وتبادل دوري الممثل والجمهور)، ثم عرض مشهد قصير وتعليق الجمهور. لا «نموذج منجز» ولا منتج يُصنع.",
  listening: "نوع الدرس: استماع — يقرأ المعلّم نص الاستماع من دليل المعلّم أو يشغّل تسجيله والكتب مغلقة؛ الطلبة يستمعون ولا يقرؤون النص. أسئلة تذكّر ثم ترتيب ثم رأي، وإجابات شفوية أو بالرسم. لا قراءة جهرية من الطلبة ولا فقرة مكتوبة.",
  speaking: "نوع الدرس: تحدّث — صورة أو موقف من الكتاب، ومفردات مساعدة، ونموذج حديث قصير من المعلّم، ثم حديث الطلبة بالتناوب وفي ثنائيات، وتقييم الطلاقة ووضوح الجملة. لا قراءة نص ولا كتابة فقرة.",
  reading: "نوع الدرس: قراءة وفهم — قراءة المعلّم النموذجية لنص الدرس، ثم قراءة الطلبة، ومعاني المفردات من السياق، وأسئلة الفهم من السهل إلى العميق.",
  writing: "نوع الدرس: كتابة — إن كان الدرس قاعدة إملائية أو كتابية فأمثلة من نص الوحدة يلاحظ الطلبة فيها القاعدة، ثم تصنيف كلمات وإملاء قصير ونسخ؛ وإن كان كتابة موضوع فنموذج ثم تخطيط ثم مسودة ثم مراجعة بمعايير.",
  language: "نوع الدرس: بناء لغوي — جمل من نص الوحدة تحمل الظاهرة اللغوية، يكتشفها الطلبة منها، ثم تركيب وتصحيح وتطبيق في جمل من تأليفهم.",
  letters: "نوع الدرس: حرف وصوت — سماع الصوت في كلمات، ورؤية شكل الحرف في مواضعه، وقراءة المقاطع بالحركات، وكتابة الحرف. \"assessment\": قراءة مقاطع وكتابة الحرف.",
};

const TYPE_EN: Record<LessonType, string> = {
  quran: "Lesson type: Quran recitation (a surah or a recitation rule) — the teacher recites, students repeat together then one by one, the word meanings from the book, the overall meaning, and recitation of what is set for memorising.",
  hadith: "Lesson type: hadith — read the hadith as the book context gives it and name its narrator, the meanings of its words and the guidance it calls to; then short situations where students decide what follows the guidance, and recitation of the hadith.",
  creed: "Lesson type: creed (pillars, one of the Names of Allah, or an article of faith) — the teacher sets out what the book states item by item (the pillars in order, or the Name and its meaning), naming each as the book context does, then links it to examples from the student's life and its effect on behaviour. It is not a surah-recitation lesson.",
  worship: "Lesson type: an act of worship (wudu, prayer, fasting…) — the steps in the book's order, the teacher's demonstration, students miming step by step, then individual performance against a checklist. Add no ruling the book context does not contain.",
  sira: "Lesson type: sira and story — tell the story as the book gives it, put its events on a timeline, students retell it, and the quality or lesson learned. It is not a surah-recitation lesson, and it adds no detail the book context does not contain.",
  conduct: "Lesson type: manners, character and values — a situation from students' lives, the guidance the book gives, telling good behaviour from bad through examples and role play, and one specific deed the student commits to. It is not a surah-recitation lesson.",
  "visual-art": "Lesson type: visual art (drawing, colouring or making) — show a model and a technique, the student makes their own work, then reviews it against criteria. Name the colours, shapes or lines the book context gives.",
  music: "Lesson type: music — listen first, then copy by clapping, instrument or singing (echo), then perform together and vary it with the students' own ideas. \"materials\": a percussion instrument or clapping, and a recording. No \"finished model\" and no product to make.",
  drama: "Lesson type: drama — mark out an acting space, the teacher performs a short scene, students try it in groups (freeze, swapping actor and audience), then perform a short scene and the audience responds. No \"finished model\" and no product to make.",
  listening: "Lesson type: listening — the teacher reads the listening text from the teacher's guide, or plays its recording, with books closed; students listen and do not read the text. Recall, then ordering, then opinion questions, answered aloud or by drawing. No reading aloud by students and no written paragraph.",
  speaking: "Lesson type: speaking — a picture or situation from the book, helpful vocabulary, a short spoken model from the teacher, then students speak in turns and in pairs; assess fluency and clear sentences. No reading of a text and no written paragraph.",
  reading: "Lesson type: reading and comprehension — the teacher's model reading of the lesson's text, then students read, word meanings from context, and comprehension questions from easy to deep.",
  writing: "Lesson type: writing — if the lesson is a spelling or writing rule, examples from the unit's text where students notice the rule, then sorting words, a short dictation and copying; if it is a composition, a model, then a plan, a draft and a review against criteria.",
  language: "Lesson type: language building — sentences from the unit's text that carry the language feature, students discover it from them, then build, correct and use it in sentences of their own.",
  letters: "Lesson type: a letter and its sound — hear the sound in words, see the letter's shape in its positions, read its syllables with the vowel marks, and write it. \"assessment\": reading syllables and writing the letter.",
};

const TYPE_OVERRIDE_AR = "نوع الدرس يحدّد ما يجري في \"mainActivity\" و\"guidedPractice\" و\"independentPractice\"، ويحلّ محلّ ما يخالفه في بند طبيعة المادة أعلاه.";
const TYPE_OVERRIDE_EN = "The lesson type decides what happens in \"mainActivity\", \"guidedPractice\" and \"independentPractice\", and replaces anything in the subject section above that contradicts it.";

/** The lesson-type clause to put after the subject clause, or "". */
export function lessonTypeClauseAr(b: Parameters<typeof lessonTypeOf>[0]): string {
  const type = lessonTypeOf(b);
  return type ? `${TYPE_AR[type]}\n${TYPE_OVERRIDE_AR}` : "";
}

export function lessonTypeClauseEn(b: Parameters<typeof lessonTypeOf>[0]): string {
  const type = lessonTypeOf(b);
  return type ? `${TYPE_EN[type]}\n${TYPE_OVERRIDE_EN}` : "";
}

// ─── Grade bands ─────────────────────────────────────────────────────────────

/**
 * Homework and closure sized to the grade — mirrors `gradeLevelOf` /
 * `gradeBandOf` in `artifacts/mobile/services/ai/lessonTypes.ts`. Grades 1–3
 * close aloud and take home one short task; Grades 4–6 write at most five
 * sentences; Grade 7 and up, and a grade we cannot read, get no clause.
 */
export type GradeBand = "early" | "middle" | "upper";

const AR_GRADE_ORDINALS = [
  "الاول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس",
  "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر",
];

export function gradeLevelOf(grade: unknown): number | null {
  if (typeof grade !== "string" && typeof grade !== "number") return null;
  const g = String(grade)
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const digits = g.match(/^(?:grade[-\s]?)?(\d{1,2})$/);
  if (digits) {
    const n = Number(digits[1]);
    return n >= 1 && n <= 12 ? n : null;
  }
  const ar = g.replace(/^الصف\s*/, "");
  const order = AR_GRADE_ORDINALS.map((name, i) => [name, i + 1] as const).sort((a, b) => b[0].length - a[0].length);
  for (const [name, n] of order) if (ar === name) return n;
  return null;
}

export function gradeBandOf(level: number | null): GradeBand {
  if (level === null) return "upper";
  if (level <= 3) return "early";
  if (level <= 6) return "middle";
  return "upper";
}

/** The homework/closure clause for the request's grade, or "". */
export function gradeBandClauseAr(b: { grade?: unknown }): string {
  const band = gradeBandOf(gradeLevelOf(b.grade));
  if (band === "early") return "الصفوف الأولى (الأول إلى الثالث): اجعل \"homework\" مهمة واحدة قصيرة يؤدّيها الطفل في البيت في نحو عشر دقائق مع أحد أفراد أسرته — شفوية أو عملية، أو كتابة جملة أو جملتين على الأكثر؛ لا فقرة ولا ملخص ولا عدد كبير من الجمل. واجعل \"closure\" شفويًا (سؤال يجيب عنه الطلبة بالكلام أو بالإشارة)، لا بطاقة مكتوبة.";
  if (band === "middle") return "الصفوف من الرابع إلى السادس: اجعل \"homework\" قصيرًا، لا يتجاوز ما يكتبه الطالب فيه خمس جمل.";
  return "";
}

export function gradeBandClauseEn(b: { grade?: unknown }): string {
  const band = gradeBandOf(gradeLevelOf(b.grade));
  if (band === "early") return "Early grades (1 to 3): make \"homework\" one short task the child can do at home in about ten minutes with a family member — oral or hands-on, or at most one or two written sentences; no paragraph, no summary, no long sentence count. Make \"closure\" oral (a question students answer aloud or by gesture), not a written card.";
  if (band === "middle") return "Grades 4 to 6: keep \"homework\" short — no more than five sentences of writing.";
  return "";
}
