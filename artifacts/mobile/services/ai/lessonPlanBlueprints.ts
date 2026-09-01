/**
 * Per-teaching-style lesson phases.
 *
 * `teachingStyle` used to reach exactly ONE of the plan's eleven fields:
 * `mainActivity`. Everything around it stayed the direct-instruction
 * I-Do / We-Do / You-Do shape, so a `collaborative` plan opened with group
 * task cards and presentations and then, two sections later, told students
 * «المناقشة بين الطلاب مؤجّلة» / "peer discussion is not [permitted]". The plan
 * contradicted itself inside one document.
 *
 * Measured before this module existed, generating all three styles for one
 * lesson: `mainActivity` was the only field that varied. `introduction`,
 * `closure`, `assessment` and `homework` looked like they varied too, but they
 * vary identically WITHIN a single style — that is the `pick()` helper, not the
 * style.
 *
 * What each style is actually for:
 *
 * | Style | The shape it commits to |
 * | --- | --- |
 * | `direct` | I do → we do → you do. Worked examples, faded to solo practice. |
 * | `inquiry` | Students meet the phenomenon BEFORE the rule is stated, and test their conclusion on a new case. |
 * | `collaborative` | Interdependent group work, then individual accountability — so assessment does not contradict the grouping. |
 *
 * `homework`, `objectives`, `title` and `introduction` stay style-blind on
 * purpose: the curriculum outcomes and the hook do not change because the
 * delivery does, and pretending otherwise would be the same defect in reverse.
 */
import type { KBLesson } from '../knowledgeBase.ts';
import type { Lang } from './mathPractice.ts';

export const LESSON_STYLE_IDS = ['direct', 'inquiry', 'collaborative'] as const;
export type LessonStyleId = typeof LESSON_STYLE_IDS[number];

export function isLessonStyleId(v: unknown): v is LessonStyleId {
  return typeof v === 'string' && (LESSON_STYLE_IDS as readonly string[]).includes(v);
}

/** Content pulled from an uploaded document, when the plan is built from one. */
export interface LessonDocContext {
  /** How to name the file in prose — «الملف «bonding.pdf»» / file "bonding.pdf". */
  label: string;
  concepts: string[];
  example: string | null;
}

export interface LessonStyleContext {
  topic: string;
  kb: KBLesson | null;
  lang: Lang;
  subject: string;
  duration: number;
  /** Present when the teacher attached materials; phases draw on these
   *  instead of the KB, but the STYLE still decides their shape. */
  doc?: LessonDocContext | null;
}

export interface LessonStyleBlueprint {
  materials: string[];
  mainActivity: string;
  guidedPractice: string;
  independentPractice: string;
  assessment: string;
  differentiation: string;
}

// ─── Content helpers ─────────────────────────────────────────────────────────

/** The lesson's own concepts — from the uploaded file when there is one. */
function concepts(ctx: LessonStyleContext, n: number): string[] {
  if (ctx.doc?.concepts.length) return ctx.doc.concepts.slice(0, n);
  const list = ctx.lang === 'ar' ? ctx.kb?.keyConceptsAr : ctx.kb?.keyConceptsEn;
  return (list ?? []).slice(0, n);
}

function firstConcept(ctx: LessonStyleContext): string {
  return concepts(ctx, 1)[0] ?? ctx.topic;
}

function term(ctx: LessonStyleContext): string {
  const t = ctx.kb?.keyTerms?.[0];
  if (!t) return ctx.topic;
  return ctx.lang === 'ar' ? t.ar : t.en;
}

/** «مستمدًا من الملف «x.pdf»» — appended so a doc-grounded phase says so. */
function fromDoc(ctx: LessonStyleContext): string {
  if (!ctx.doc) return '';
  return ctx.lang === 'ar' ? ` (مستمدًا من ${ctx.doc.label})` : ` (drawn from ${ctx.doc.label})`;
}

const mins = (ctx: LessonStyleContext, share: number) => Math.round(ctx.duration * share);

// ─── Arabic ──────────────────────────────────────────────────────────────────

function directAr(ctx: LessonStyleContext): LessonStyleBlueprint {
  const cs = concepts(ctx, 3);
  const body = cs.length
    ? cs.map((c, i) => `${i + 1}. اشرح «${c}» مع مثال محلول واضح.`).join('\n')
    : `1. اشرح المفهوم الرئيسي لـ${ctx.topic}.\n2. قدّم 2-3 أمثلة متدرجة الصعوبة.\n3. اكتب الخطوات على السبورة مع التفكير الصوتي.`;
  return {
    materials: ['الكتاب المدرسي', 'السبورة وأقلام ملوّنة', 'بطاقة المثال المحلول لكل طالب', 'أوراق تدريب فردية'],
    mainActivity: `(${mins(ctx, 0.3)} دقيقة) – شرح مباشر – نموذج «أنا أفعل»${fromDoc(ctx)}:\n\n${body}`,
    guidedPractice: `(${mins(ctx, 0.22)} دقيقة) – «نحن نفعل»:\n\n• حلّ مثالًا مشتركًا على ${term(ctx)} والطلاب يوجّهون كل خطوة.\n• أسئلة استرشادية: «ماذا نفعل أولًا؟ لماذا هذه الخطوة صحيحة؟»\n• صحّح المفاهيم الخاطئة فور ظهورها.`,
    independentPractice: `(${mins(ctx, 0.18)} دقيقة) – «أنت تفعل»:\n\n• يعمل كل طالب بمفرده على التمارين المحددة.\n• يُسمح بمراجعة الملاحظات؛ هذه المرحلة فردية بحكم النموذج.\n• تجوّل وقدّم تلميحات مكتوبة دون إعطاء الحل.\n• من ينهي مبكرًا ينتقل إلى تمرين التحدي.`,
    assessment: `تكويني: راقب مرحلة «نحن نفعل» — من يقود الخطوة ومن ينتظر.\nختامي: صحّح ورقة العمل الفردية؛ نسبة من أنهى بلا مساعدة هي المؤشر.\nبطاقة خروج: خطوة واحدة من حل اليوم مع سبب صحتها.`,
    differentiation: `دعم: مثال محلول إضافي وتلاشٍ أبطأ (نصف الحل مكتوب في السؤال الثاني أيضًا).\nتحدٍّ: احذف المثال المحلول واطلب منهم كتابة واحد لزميل.\nالمبدأ: قلّل الحمل المعرفي بالأمثلة المحلولة أولًا، ثم أزلها تدريجيًا — لا تعطِ الجميع الدرجة نفسها من السقالة.`,
  };
}

function inquiryAr(ctx: LessonStyleContext): LessonStyleBlueprint {
  const c0 = firstConcept(ctx);
  return {
    materials: ['بطاقات بيانات أو أمثلة للاستكشاف', 'ورق كبير وأقلام لتسجيل الملاحظات', 'الكتاب المدرسي (يُفتح بعد الاستكشاف لا قبله)', 'مسطرة/آلة حاسبة حسب الحاجة'],
    mainActivity: `(${mins(ctx, 0.3)} دقيقة) – تعلّم استقصائي${fromDoc(ctx)}:\n\n1. اطرح سؤال التحقيق دون أن تعطي القاعدة: «ما الذي يحكم ${ctx.topic}؟»\n2. مجموعات ثلاثية تفحص الأمثلة/البيانات المتاحة حول «${c0}» وتبحث عن نمط.\n3. تكتب كل مجموعة **تخمينها** (القاعدة كما تظن أنها تعمل) على ورقة كبيرة.\n4. تُعرض التخمينات جنبًا إلى جنب — دون حكم بعد.`,
    guidedPractice: `(${mins(ctx, 0.22)} دقيقة) – اختبار التخمينات:\n\n• لا تشرح القاعدة. اضغط على التخمينات بالأسئلة: «ما دليلك؟» «هل ينطبق هذا على هذه الحالة أيضًا؟»\n• قدّم حالة واحدة مصممة لتكسر تخمينًا شائعًا، ودع المجموعة تعدّله بنفسها.\n• بعد أن يستقر الصف على صياغة، اكتبها على السبورة وسمّها بالمصطلح العلمي (${term(ctx)}) — التسمية تأتي في النهاية لا في البداية.`,
    independentPractice: `(${mins(ctx, 0.18)} دقيقة) – اختبر استنتاجك على حالة جديدة:\n\n• يعمل كل طالب بمفرده على حالة لم تُناقَش.\n• يكتب: هل صمدت القاعدة التي توصّلنا إليها؟ وإن لم تصمد، ما الشرط الناقص؟\n• الإجابة «لم تصمد» مقبولة تمامًا إن كان التبرير سليمًا.`,
    assessment: `المقياس هو جودة الاستدلال لا سرعة الوصول للقاعدة.\nتكويني: صنّف تخمينات المجموعات — مبنية على نمط في البيانات، أم على تذكّر سابق، أم على تخمين بلا سند.\nختامي: ورقة «الحالة الجديدة» — هل طبّق الطالب القاعدة أم فحصها؟\nبطاقة خروج: «ما الدليل الذي غيّر رأيي اليوم؟»`,
    differentiation: `دعم: ضيّق سؤال التحقيق وأعطهم مجموعة بيانات أصغر ومرتبة، مع بادئة جملة للتخمين.\nتحدٍّ: أعطهم حالة مصممة لتكسر القاعدة، واطلب صياغة الشرط الذي يجعلها تصمد.\nالمبدأ: الجميع يستقصي — التمايز في ضيق السؤال ومقدار البيانات، لا في من يُسمح له بالتفكير.`,
  };
}

function collaborativeAr(ctx: LessonStyleContext): LessonStyleBlueprint {
  const cs = concepts(ctx, 4);
  const cards = cs.length >= 2
    ? cs.map((c, i) => `   بطاقة ${i + 1}: «${c}»`).join('\n')
    : `   بطاقة 1: تعريف ${ctx.topic} بمثال\n   بطاقة 2: خطوات التطبيق\n   بطاقة 3: خطأ شائع وكيف نتجنّبه\n   بطاقة 4: ربط الموضوع بموقف حياتي`;
  return {
    materials: ['بطاقات مهمة مختلفة لكل مجموعة (مرقّمة 1–4)', 'لوح إجابة واحد لكل مجموعة', 'أقلام ملوّنة وشريط لاصق', 'كيس أرقام للمساءلة العشوائية', 'ورقة تقييم فردية قصيرة'],
    mainActivity: `(${mins(ctx, 0.3)} دقيقة) – تعلّم تعاوني (مجموعات 3-4)${fromDoc(ctx)}:\n\n1. تتلقى كل مجموعة أربع بطاقات مهمة **مختلفة**، بطاقة لكل فرد:\n${cards}\n2. يتقن كل فرد بطاقته ثم يشرحها لمجموعته (90 ثانية لكل فرد).\n3. تكتب المجموعة إجابة واحدة كاملة على اللوح — لا تُقبل إجابة ينقصها جزء.\n4. تعرض مجموعتان أو ثلاث، ويلخّص المعلم ويصحّح.`,
    guidedPractice: `(${mins(ctx, 0.22)} دقيقة) – نقد متبادل بين المجموعات:\n\n• تتبادل كل مجموعتين لوحيهما ويكتبان على ورقة منفصلة: نقطة قوية واحدة، وسؤال واحد حقيقي.\n• تردّ كل مجموعة على سؤال الأخرى أمام الصف في 60 ثانية.\n• دورك هنا إدارة الحوار لا تقديم الإجابة: «هل أقنعك ردّهم؟ لماذا؟»`,
    independentPractice: `(${mins(ctx, 0.18)} دقيقة) – مساءلة فردية:\n\n• الآن فقط يعمل كل طالب بمفرده وبصمت، على ورقة قصيرة تغطي **كل** البطاقات الأربع لا بطاقته وحدها.\n• هذه هي الخطوة التي تكشف من تعلّم فعلًا ومن اتّكل على مجموعته — وهي جزء من التعلّم التعاوني، لا خروج عنه.\n• اسحب رقمًا: صاحبه يعرض إجابة مجموعته كاملة شفويًا.`,
    assessment: `تُقيَّم المجموعة بورقة الفرد الذي سُحب رقمه، لا بأفضل أفرادها.\nتكويني: راجع ألواح المجموعات بحثًا عن بطاقة ضعيفة باستمرار — تلك هي التي تحتاج إعادة شرح للصف كله.\nملاحظة مشاركة: سجّل من شرح ومن استمع فقط، وعالجها في توزيع البطاقات القادم.`,
    differentiation: `وزّع البطاقات بقصد لا عشوائيًا: البطاقة الأقصر لمن يحتاج دعمًا — يظل مسؤولًا عن جزء حقيقي تعتمد عليه مجموعته.\nتحدٍّ: البطاقة التي تتطلب الربط بين مفهومين، أو صياغة سؤال امتحان يغطي البطاقات الأربع معًا.\nالمبدأ: الاعتماد المتبادل يعني أن لكل فرد جزءًا لا غنى عنه — لا أن يعمل واحد ويشاهد ثلاثة.`,
  };
}

// ─── English ─────────────────────────────────────────────────────────────────

function directEn(ctx: LessonStyleContext): LessonStyleBlueprint {
  const cs = concepts(ctx, 3);
  const body = cs.length
    ? cs.map((c, i) => `${i + 1}. Explain "${c}" with a clear worked example.`).join('\n')
    : `1. Introduce the key concept of ${ctx.topic}.\n2. Present 3 worked examples of increasing difficulty.\n3. Think aloud as you solve each on the board.`;
  return {
    materials: ['Textbook', 'Board and coloured markers', 'Worked-example card per student', 'Individual practice sheets'],
    mainActivity: `(${mins(ctx, 0.3)} min) – Direct instruction, I-Do model${fromDoc(ctx)}:\n\n${body}`,
    guidedPractice: `(${mins(ctx, 0.22)} min) – We Do:\n\n• Work a shared example on ${term(ctx)} with students directing each step.\n• Guiding questions: "What do we do first? Why is that step legal?"\n• Correct misconceptions the moment they surface.`,
    independentPractice: `(${mins(ctx, 0.18)} min) – You Do:\n\n• Each student works the assigned exercises alone.\n• Notes are permitted; this stage is individual by the model's design.\n• Circulate with written hints rather than answers.\n• Early finishers move to the extension problem.`,
    assessment: `Formative: watch the We-Do stage — who is directing a step and who is waiting.\nSummative: mark the individual sheet; the share who finished unaided is the signal.\nExit ticket: one step from today's solution and why it was legal.`,
    differentiation: `Support: one extra worked example and slower fading (second item also half-solved).\nStretch: remove the worked example and have them author one for a classmate.\nThe principle: cut cognitive load with worked examples first, then withdraw them — not the same scaffold for everyone.`,
  };
}

function inquiryEn(ctx: LessonStyleContext): LessonStyleBlueprint {
  const c0 = firstConcept(ctx);
  return {
    materials: ['Data or example cards to explore', 'Chart paper and markers for recording', 'Textbook (opened after the exploration, not before)', 'Ruler / calculator as needed'],
    mainActivity: `(${mins(ctx, 0.3)} min) – Inquiry${fromDoc(ctx)}:\n\n1. Pose the investigation question without giving the rule: "What governs ${ctx.topic}?"\n2. Groups of three examine the available examples/data on "${c0}" and hunt for a pattern.\n3. Each group writes its **conjecture** — the rule as they think it works — on chart paper.\n4. Post the conjectures side by side. No verdict yet.`,
    guidedPractice: `(${mins(ctx, 0.22)} min) – Testing the conjectures:\n\n• Do not explain the rule. Press on the conjectures: "What is your evidence?" "Does it hold for this case too?"\n• Offer one case built to break a common conjecture, and let the group revise it themselves.\n• Once the class settles on a wording, write it up and attach the formal term (${term(ctx)}) — naming comes last, not first.`,
    independentPractice: `(${mins(ctx, 0.18)} min) – Test your conclusion on a new case:\n\n• Each student works alone on a case that was not discussed.\n• They write: did our rule hold? If not, what condition was missing?\n• "It did not hold" is a fully acceptable answer when the reasoning is sound.`,
    assessment: `The measure is the quality of the reasoning, not the speed of reaching the rule.\nFormative: sort the groups' conjectures — grounded in a pattern in the data, in prior recall, or in unsupported guessing.\nSummative: the new-case sheet — did the student apply the rule, or interrogate it?\nExit ticket: "What evidence changed my mind today?"`,
    differentiation: `Support: narrow the investigation question, give a smaller ordered data set and a sentence stem for the conjecture.\nStretch: hand them a case designed to break the rule and ask them to state the condition that rescues it.\nThe principle: everyone investigates — differentiate the narrowness of the question and the amount of data, never who is allowed to think.`,
  };
}

function collaborativeEn(ctx: LessonStyleContext): LessonStyleBlueprint {
  const cs = concepts(ctx, 4);
  const cards = cs.length >= 2
    ? cs.map((c, i) => `   Card ${i + 1}: "${c}"`).join('\n')
    : `   Card 1: define ${ctx.topic} with an example\n   Card 2: the steps to apply it\n   Card 3: a common error and how to avoid it\n   Card 4: link it to a real situation`;
  return {
    materials: ['Four different task cards per group (numbered 1–4)', 'One answer board per group', 'Coloured markers and tape', 'Number draw for random accountability', 'Short individual assessment sheet'],
    mainActivity: `(${mins(ctx, 0.3)} min) – Collaborative learning, groups of 3-4${fromDoc(ctx)}:\n\n1. Each group takes four **different** task cards, one per member:\n${cards}\n2. Each member masters their card, then teaches it to the group (90 seconds each).\n3. The group writes one complete answer on its board — an answer missing a part is not accepted.\n4. Two or three groups present; the teacher summarises and corrects.`,
    guidedPractice: `(${mins(ctx, 0.22)} min) – Group-to-group critique:\n\n• Groups swap boards in pairs and write on a separate sheet: one genuine strength, one genuine question.\n• Each group answers the other's question in front of the class, in 60 seconds.\n• Your job here is to run the exchange, not to supply the answer: "Did their reply convince you? Why?"`,
    independentPractice: `(${mins(ctx, 0.18)} min) – Individual accountability:\n\n• Only now does each student work alone and in silence, on a short sheet covering **all four** cards — not just their own.\n• This is the step that separates who learned from who leaned on the group, and it is part of collaborative learning rather than a departure from it.\n• Draw a number: that student reports the group's whole answer aloud.`,
    assessment: `Grade the group on the sheet of the student whose number was drawn, not on its strongest member.\nFormative: scan the boards for a card that is consistently weak — that is the one to re-teach to the whole class.\nParticipation note: record who taught and who only listened, and act on it in the next card allocation.`,
    differentiation: `Hand out the cards deliberately, not at random: the shortest card to a student who needs support — they still own a real part their group depends on.\nStretch: the card requiring two concepts to be linked, or writing an exam question covering all four cards at once.\nThe principle: interdependence means every member holds an indispensable part — not one working while three watch.`,
  };
}

// ─── Registry ────────────────────────────────────────────────────────────────

const BUILDERS: Record<LessonStyleId, Record<Lang, (ctx: LessonStyleContext) => LessonStyleBlueprint>> = {
  direct: { ar: directAr, en: directEn },
  inquiry: { ar: inquiryAr, en: inquiryEn },
  collaborative: { ar: collaborativeAr, en: collaborativeEn },
};

/**
 * Phases for one teaching style.
 *
 * Unknown styles fall back to `direct` rather than throwing — with live AI a
 * request can name a style the picker never offered, and direct instruction is
 * the safe default.
 */
export function buildLessonStyleBlueprint(
  style: string,
  ctx: LessonStyleContext,
): LessonStyleBlueprint {
  const key: LessonStyleId = isLessonStyleId(style) ? style : 'direct';
  return BUILDERS[key][ctx.lang](ctx);
}
