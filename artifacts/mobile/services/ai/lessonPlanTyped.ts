/**
 * The direct-instruction plan for a lesson TYPE inside a subject — see
 * `lessonTypes.ts` for what a type is and how it is read.
 *
 * `lessonPlanNative.ts` gives each KIND its routine; inside Islamic education,
 * the arts and Arabic that routine fitted one type of lesson and was handed to
 * all of them. Here each type gets the routine it is taught with: a creed lesson
 * builds the pillars or the Name from the book, a worship lesson demonstrates
 * the steps, a sira lesson tells the story in order, a drama lesson acts on a
 * marked-out stage, a listening lesson is heard with the books closed.
 *
 * Three types keep their kind's routine, which was written for them: `quran`
 * (the recitation body), `visual-art` (demonstrate, make, review) and `reading`
 * (the reading model). They gain what every typed plan gains — the lesson's own
 * main idea, as its book states it.
 *
 * Nothing here states subject content: the pillars, the steps of the wudu and
 * the events of a story are read from the book in class. The plan names what the
 * catalog holds — the lesson's summary, its unit, the text or rule in its title —
 * and nothing more.
 *
 * Every typed plan has ONE wording: a regenerate draws the same body (variant 1
 * changes only what the kind's own variant changes, for the three types above),
 * and the plan's `repeated` notice says so.
 */
import { getUnitForLesson } from '../knowledgeBase.ts';
import { arPrefixed } from './lessonPlanKinds.ts';
import { nativeDirectBlueprint } from './lessonPlanNative.ts';
import { nativeDirectVariant1 } from './lessonPlanVariantsAr.ts';
import { nativeDirectVariant1En } from './lessonPlanVariantsEn.ts';
import { phaseMinutes, type LessonStyleBlueprint, type LessonStyleContext } from './lessonPlanTypes.ts';
import { foldArabic, KIND_OF_TYPE, type LessonType } from './lessonTypes.ts';

const m = phaseMinutes;
const ARABIC = /[؀-ۿ]/;

// ─── What the catalog says about the lesson ──────────────────────────────────

/**
 * The lesson's main idea: the first sentence of its summary, when that is a real
 * summary. The Arabic readers' summaries are a placeholder («درس «أبني لغتي» من
 * وحدة «كوكبنا»»), and the Grade 2 English-side summaries are the Arabic text, so
 * neither is quoted as an idea.
 */
export function mainIdea(ctx: LessonStyleContext): string | null {
  const raw = (ctx.lang === 'ar' ? ctx.kb?.summaryAr : ctx.kb?.summaryEn)?.trim();
  if (!raw) return null;
  if (/^درس «/.test(raw) || /^The lesson “/.test(raw)) return null;
  if (ctx.lang === 'en' && ARABIC.test(raw)) return null;
  const first = raw.split(/(?<=[.!؟?])/)[0]!.trim();
  return first.length >= 12 && first.length <= 260 ? first.replace(/[«»“”]/g, '') : null;
}

/** The unit's title — the theme an Arabic reader's lessons share («كوكبنا»). */
function unitTitle(ctx: LessonStyleContext): string | null {
  const u = ctx.kb ? getUnitForLesson(ctx.kb) : undefined;
  const t = (ctx.lang === 'ar' ? u?.titleAr : u?.titleEn)?.trim();
  if (!t || (ctx.lang === 'en' && ARABIC.test(t))) return null;
  // «الوحدة الأولى» names a position, not a theme.
  return /^الوحدة|^Unit\s*\d/i.test(foldArabic(t)) ? null : t;
}

/** The text or rule a title names in brackets: «أقرأ بطلاقة وفهم (رحلة قطورة)» → «رحلة قطورة». */
function bracketed(ctx: LessonStyleContext): string | null {
  const title = ctx.lang === 'ar' ? ctx.kb?.titleAr : ctx.kb?.titleEn;
  const inner = title?.match(/\(([^)]+)\)/)?.[1]?.trim();
  if (!inner || (ctx.lang === 'en' && ARABIC.test(inner))) return null;
  return inner;
}

const ideaAr = (ctx: LessonStyleContext) => {
  const i = mainIdea(ctx);
  return i ? ` الفكرة الرئيسة كما يعرضها الكتاب: «${i}»` : '';
};
const ideaEn = (ctx: LessonStyleContext) => {
  const i = mainIdea(ctx);
  return i ? ` The main idea as the book puts it: “${i}”` : '';
};

/** A kind's own body with the lesson's main idea added — for the three types it was written for. */
function withIdea(bp: LessonStyleBlueprint | null, ctx: LessonStyleContext): LessonStyleBlueprint | null {
  if (!bp) return null;
  const lines: string[] = [];
  const idea = mainIdea(ctx);
  const inner = bracketed(ctx);
  const unit = unitTitle(ctx);
  if (ctx.lang === 'ar') {
    if (inner && ctx.lessonType === 'reading') lines.push(`نص الدرس: «${inner}»${unit ? ` من وحدة «${unit}»` : ''}.`);
    if (idea) lines.push(`وسأكتب الفكرة الرئيسة كما يعرضها الكتاب على السبورة: «${idea}»`);
  } else {
    if (inner && ctx.lessonType === 'reading') lines.push(`The lesson’s text: “${inner}”${unit ? ` from the unit “${unit}”` : ''}.`);
    if (idea) lines.push(`Write the main idea on the board as the book puts it: “${idea}”`);
  }
  return lines.length ? { ...bp, mainActivity: `${bp.mainActivity}\n\n${lines.join('\n')}` } : bp;
}

// ─── Islamic education ───────────────────────────────────────────────────────

const ISLAMIC_DIFF_AR = 'دعم: سأقدّم بطاقات فيها صورة إلى جانب الكلمة، وسؤالًا بخيارين بدل السؤال المفتوح، وزميلًا يساعد في الترتيب.\nتحدٍّ: يشرح الطالب لزملائه مثالًا من حياته، أو يربط الدرس بدرس سابق من الكتاب.\nالمبدأ: الفهم والعمل بما نتعلّم قبل الحفظ — يتغيّر مقدار الدعم، لا فرصة المشاركة.';
const ISLAMIC_DIFF_EN = 'Support: cards with a picture beside the word, a two-choice question instead of an open one, and a classmate to help with the ordering.\nStretch: the student explains an example from their own life to the class, or links the lesson to an earlier one in the book.\nThe principle: understanding and acting on what we learn come before memorising — change the support, not the chance to take part.';

/** «الله الرزّاق», «من أسماء الله الحسنى: القادر» — one Name, not a list to put in order. */
const isNameLesson = (ctx: LessonStyleContext) => /^(من )?اسماء الله|^الله /.test(foldArabic(ctx.kb?.titleAr ?? ''));

const creedAr = (ctx: LessonStyleContext): LessonStyleBlueprint => {
  const name = isNameLesson(ctx);
  return {
  materials: ['الكتاب المدرسي (صفحة الدرس)', name ? 'بطاقة كبيرة بالاسم ومعناه كما في الكتاب' : 'بطاقات كبيرة أكتب عليها ما يذكره الكتاب', 'صور من الطبيعة أو من حياة الطلبة تدلّ على فكرة الدرس', 'ورقة «أثرها في حياتي»'],
  mainActivity: `(${m(ctx, 0.3)}) – نتعرّف ونتأمّل:\n\n1. سأكتب «${ctx.topic}» في وسط السبورة، وأسأل: «ماذا نعرف عن هذا؟» وأستمع إلى إجابتين أو ثلاث دون تصحيح.\n2. ${name ? 'سأقرأ ما ورد في الكتاب، وأكتب الاسم ومعناه على بطاقة كبيرة كما يذكرهما الكتاب، دون أن أضيف شيئًا من عندي.' : 'سأقرأ ما ورد في الكتاب، وأكتب على البطاقات ما يذكره بندًا بندًا وبترتيبه، دون أن أضيف شيئًا من عندي.'}${ideaAr(ctx)}\n3. سأربط ${name ? 'الاسم' : 'كل بطاقة'} بمثال قريب من الطلبة: نعمة يرونها كل يوم، أو موقف من يومهم يدلّ ${name ? 'عليه' : 'عليها'}.\n4. وسأختم بسؤال: «ماذا يتغيّر في سلوكي حين أؤمن بهذا؟» وأكتب إجابة الصف بجملة واحدة.`,
  guidedPractice: `(${m(ctx, 0.22)}) – ${name ? 'نتأمّل ونربط معًا' : 'نرتّب ونربط معًا'}:\n\n• ${name ? 'سأعرض صورًا من حياة الطلبة ومن الطبيعة، ويقول الطلبة كيف تدلّ كل صورة على معنى الاسم كما ورد في الكتاب.' : 'سأوزّع البطاقات على الطلبة بغير ترتيب، فيقف أصحابها أمام الصف ويرتّبون أنفسهم كما في الكتاب، والصف يتحقّق.'}\n• سأعرض صورًا أو مواقف، ويختار الطلبة البطاقة التي تدلّ عليها كل صورة ويذكرون السبب.\n• وسأصحّح أي معنى غير دقيق بالرجوع إلى نص الكتاب.`,
  independentPractice: `(${m(ctx, 0.18)}) – أتأمّل بمفردي:\n\n• يكمل كل طالب ورقة «أثرها في حياتي»: يرسم أو يكتب موقفًا واحدًا يظهر فيه ما تعلّمه.\n• يذكر الطالب لزميله ما على البطاقات دون النظر إليها، ثم يتبادلان.\n• من ينهي مبكرًا يكتب جملة شكر لله مرتبطة بالدرس.`,
  assessment: 'تكويني: سأطرح أسئلة شفوية سريعة عمّا تعلّمناه («ما الأول؟ ما معنى هذا الاسم؟») وأسجّل من يحتاج مراجعة.\nختامي: سأقرأ أوراق «أثرها في حياتي»: هل ربط الطالب ما تعلّمه بسلوك حقيقي؟\nغلق الدرس: يقول كل طالب جملة يبدأها بـ«تعلّمت اليوم أن…».',
  differentiation: ISLAMIC_DIFF_AR,
  };
};

const worshipAr = (ctx: LessonStyleContext): LessonStyleBlueprint => ({
  materials: ['الكتاب المدرسي (صور الخطوات)', 'بطاقات مصوّرة للخطوات بترتيب الكتاب', 'ما يلزم للعرض العملي بحسب الدرس (إبريق ماء وطست، أو سجادة صلاة)', 'قائمة رصد الخطوات'],
  mainActivity: `(${m(ctx, 0.3)}) – أعرض الخطوات وأؤدّيها:\n\n1. سأسأل: «من رأى أحدًا من أسرته يؤدّي هذه العبادة؟ ماذا يفعل أولًا؟» وأستمع إلى إجابات قصيرة، ثم سأعلن موضوع الدرس: «${ctx.topic}».\n2. سأعرض صور الخطوات من الكتاب بترتيبها، وأسمّي كل خطوة كما وردت فيه، وأثبّت بطاقتها على السبورة.${ideaAr(ctx)}\n3. ثم سأؤدّي الخطوات أمام الطلبة أداءً عمليًا هادئًا، وأتوقف عند كل خطوة ليقول الطلبة اسمها.\n4. وسأبيّن ما يذكره الكتاب من آداب أو أخطاء تُتجنّب، دون أن أضيف أحكامًا من عندي.`,
  guidedPractice: `(${m(ctx, 0.22)}) – نؤدّي معًا:\n\n• يؤدّي الطلبة الخطوات معي محاكاةً في أماكنهم، خطوةً بعد خطوة، وأنا أقول اسم كل خطوة.\n• سأخلط البطاقات المصوّرة، ويرتّبها الطلبة في ثنائيات ثم يقارنون بترتيب الكتاب.\n• وسأصحّح الترتيب أو الأداء بلطف حين يظهر خطأ.`,
  independentPractice: `(${m(ctx, 0.18)}) – أؤدّي بمفردي:\n\n• يؤدّي كل طالب الخطوات أمامي أو أمام زميل متقن، واحدًا في كل مرة، والزميل يضع إشارة على قائمة الرصد.\n• يرتّب الباقون صور الخطوات على ورقة ويقولون اسم كل خطوة.\n• من ينهي مبكرًا يشرح لزميله لماذا يحرص المسلم على هذه العبادة كما ذكر الكتاب.`,
  assessment: 'تكويني: سأراقب الأداء العملي بقائمة الرصد: الترتيب، واكتمال الخطوات، والهدوء في الأداء.\nختامي: أداء فردي للخطوات وترتيب صورها؛ وسأسجّل الخطوة التي يتعثّر فيها الطالب لأعيدها معه.\nغلق الدرس: سنقول الخطوات بترتيبها جماعيًا.',
  differentiation: ISLAMIC_DIFF_AR,
});

const siraAr = (ctx: LessonStyleContext): LessonStyleBlueprint => ({
  materials: ['الكتاب المدرسي (قصة الدرس)', 'صور أو بطاقات لأحداث القصة', 'خط زمني بسيط على السبورة', 'ورقة «ماذا أتعلّم من القصة؟»'],
  mainActivity: `(${m(ctx, 0.3)}) – أروي القصة ونرتّبها:\n\n1. سأروي قصة «${ctx.topic}» كما وردت في الكتاب بأسلوب قصصي مشوّق، مستعينًا بالصور، والطلبة يستمعون دون مقاطعة.\n2. سأتوقف عند لحظتين مهمتين وأسأل: «ماذا تتوقعون أن يحدث؟» ثم أكمل الرواية.\n3. سأرتّب مع الطلبة أحداث القصة على خط زمني بسيط على السبورة: ماذا حدث أولًا، ثم، وفي النهاية.${ideaAr(ctx)}\n4. وسأسأل: «ما الصفة أو العمل الذي نتعلّمه من هذه القصة؟» وأكتب الصفة بخط واضح.`,
  guidedPractice: `(${m(ctx, 0.22)}) – نعيد الرواية معًا:\n\n• سأوزّع بطاقات الأحداث على مجموعات صغيرة، فترتّبها كل مجموعة وتعيد رواية القصة بكلماتها.\n• سأطرح أسئلة: «من؟ أين؟ ماذا حدث؟ لماذا؟» وأصحّح أي تفصيل لم يرد في الكتاب.\n• وسنتحدث عن موقف من حياة الطلبة يشبه ما في القصة.`,
  independentPractice: `(${m(ctx, 0.18)}) – أعبّر بمفردي:\n\n• يرسم كل طالب مكانًا أو شيئًا من القصة (دون رسم الأنبياء أو الصحابة) ويكتب تحته جملة واحدة أو يقولها لي.\n• يكمل ورقة «ماذا أتعلّم من القصة؟» بصفة واحدة وكيف سيطبّقها.\n• من ينهي مبكرًا يروي القصة لزميله في ثلاث جمل.`,
  assessment: 'تكويني: سأتابع إعادة الرواية في المجموعات: هل الأحداث بترتيبها؟ وهل التفاصيل من الكتاب؟\nختامي: سأقرأ الرسوم والجمل: هل ذكر الطالب حدثًا صحيحًا وصفة مستفادة؟\nغلق الدرس: يكمل كل طالب شفويًا: «أحببت في هذه القصة…».',
  differentiation: ISLAMIC_DIFF_AR,
});

const hadithAr = (ctx: LessonStyleContext): LessonStyleBlueprint => ({
  materials: ['الكتاب المدرسي (نص الحديث كما ورد)', 'بطاقة بنص الحديث مشكولًا بخط كبير', 'بطاقة معاني المفردات', 'بطاقات مواقف قصيرة'],
  mainActivity: `(${m(ctx, 0.3)}) – نقرأ الحديث ونفهم توجيهه:\n\n1. سأقرأ نص الحديث من الكتاب قراءة واضحة متأنية مرتين، والطلبة يتابعون بأعينهم على البطاقة.\n2. سأذكر راوي الحديث كما ورد في الكتاب، وأشرح الكلمات الجديدة بمعانيها منه.\n3. سأسأل: «إلامَ يدعونا سيدنا محمد صلى الله عليه وسلم في هذا الحديث؟» وأكتب التوجيه بجملة واحدة على السبورة.${ideaAr(ctx)}\n4. ثم يردّد الطلبة الحديث بعدي جماعيًا على مقاطع قصيرة، ثم فرديًا.`,
  guidedPractice: `(${m(ctx, 0.22)}) – نطبّق التوجيه معًا:\n\n• سأقرأ بطاقات مواقف قصيرة، ويقرّر الطلبة: هل يوافق هذا السلوك ما يدعو إليه الحديث؟ ولماذا؟\n• يمثّل ثنائيان موقفًا يطبّقان فيه التوجيه، والصف يعلّق.\n• ونكرّر الحديث في ثنائيات: يقرأ الأول والثاني يتابع، ثم يتبادلان.`,
  independentPractice: `(${m(ctx, 0.18)}) – أحفظ وأعمل:\n\n• يسمّع كل طالب الحديث لي أو لزميل متقن، واحدًا في كل مرة.\n• يرسم أو يكتب موقفًا من يومه سيعمل فيه بما يدعو إليه الحديث.\n• من ينهي مبكرًا يشرح كلمة من الحديث لزميله.`,
  assessment: 'تكويني: سأنصت إلى الترديد وأسجّل من يحتاج تكرارًا، وأتابع قرارات الطلبة في بطاقات المواقف.\nختامي: تسميع الحديث، وسؤالان: «إلامَ يدعونا الحديث؟ ومتى ستعمل به؟»\nغلق الدرس: يكمل كل طالب: «سأعمل بالحديث حين…».',
  differentiation: ISLAMIC_DIFF_AR,
});

const conductAr = (ctx: LessonStyleContext): LessonStyleBlueprint => ({
  materials: ['الكتاب المدرسي (صور الدرس)', 'بطاقات مواقف من حياة الطلبة', 'لافتتان: «سلوك أحبّه» و«سلوك أتجنّبه»', 'لوحة «وعدي»'],
  mainActivity: `(${m(ctx, 0.3)}) – موقف وتوجيه:\n\n1. سأعرض صورة من الكتاب أو أروي موقفًا قصيرًا عن «${ctx.topic}» من حياة طفل في عمر الطلبة، وأسأل: «ماذا فعل؟ هل أحسن التصرّف؟»\n2. سأقرأ ما يرشدنا إليه الكتاب في هذا الدرس، وأكتب التوجيه على السبورة بجملة واحدة.${ideaAr(ctx)}\n3. سأسأل: «بماذا يرشدنا الكتاب في هذا السلوك؟ وكيف يشعر من حولنا حين نفعله؟»\n4. وسأعدّد مع الطلبة ثلاثة أعمال صغيرة يقدرون عليها اليوم في البيت أو في المدرسة.`,
  guidedPractice: `(${m(ctx, 0.22)}) – نميّز ونمثّل معًا:\n\n• سأقرأ بطاقات المواقف، ويضع الطلبة كل بطاقة تحت «سلوك أحبّه» أو «سلوك أتجنّبه» مع ذكر السبب.\n• يمثّل ثنائيان الموقف نفسه مرتين: مرة بتصرّف خاطئ ومرة بتصرّف حسن، ويقارن الصف بينهما.\n• وسأربط كل تصرّف حسن بما ذكره الكتاب.`,
  independentPractice: `(${m(ctx, 0.18)}) – وعدي:\n\n• يكتب كل طالب أو يرسم «وعدي»: عملًا واحدًا سيفعله هذا الأسبوع، ويعلّقه على اللوحة.\n• يختار الطالب بطاقة موقف ويقول لزميله كيف سيتصرّف فيه.\n• من ينهي مبكرًا يقترح موقفًا جديدًا للصف.`,
  assessment: 'تكويني: سأتابع تصنيف المواقف وتعليل الطلبة: هل يذكرون السبب أم يكرّرون الجواب؟\nختامي: سأقرأ بطاقات «وعدي»: هل العمل محدّد وممكن؟ وسأسأل عنه في الحصة القادمة.\nغلق الدرس: يقول كل طالب عملًا واحدًا سيفعله اليوم.',
  differentiation: ISLAMIC_DIFF_AR,
});

const creedEn = (ctx: LessonStyleContext): LessonStyleBlueprint => {
  const name = isNameLesson(ctx);
  return {
  materials: ['Textbook (the lesson page)', name ? 'A large card with the Name and its meaning as the book gives them' : 'Large cards to write what the book states', 'Pictures from nature or from students’ lives that show the lesson’s idea', 'A “What it means in my life” sheet'],
  mainActivity: `(${m(ctx, 0.3)}) – Learn and reflect:\n\n1. Write “${ctx.topic}” in the middle of the board and ask: “What do we know about this?” Take two or three answers without correcting.\n2. ${name ? 'Read what the book says and write the Name and its meaning on a large card as the book gives them, adding nothing of your own.' : 'Read what the book says and write what it states on the cards, item by item and in its order, adding nothing of your own.'}${ideaEn(ctx)}\n3. Link ${name ? 'the Name' : 'each card'} to an example close to the students: a blessing they see every day, or a moment from their day that shows it.\n4. Close with: “What changes in how I behave when I believe this?” and write the class’s answer in one sentence.`,
  guidedPractice: `(${m(ctx, 0.22)}) – ${name ? 'Reflect and connect together' : 'Order and connect together'}:\n\n• ${name ? 'Show pictures from students’ lives and from nature; students say how each one shows the meaning of the Name as the book gives it.' : 'Hand the cards out in no order; their holders stand at the front and arrange themselves as in the book while the class checks.'}\n• Show pictures or situations; students pick the card each one points to and say why.\n• Correct any inexact meaning by going back to the book’s text.`,
  independentPractice: `(${m(ctx, 0.18)}) – Reflect on my own:\n\n• Each student completes the “What it means in my life” sheet: draw or write one moment where what they learned shows.\n• Students tell a partner what is on the cards without looking, then swap.\n• Early finishers write one sentence of thanks to Allah linked to the lesson.`,
  assessment: 'Formative: quick oral questions on what we learned (“Which comes first? What does this Name mean?”); note who needs review.\nSummative: read the “What it means in my life” sheets: did the student link the lesson to real behaviour?\nExit ticket: each student says a sentence starting “Today I learned that…”.',
  differentiation: ISLAMIC_DIFF_EN,
  };
};

const worshipEn = (ctx: LessonStyleContext): LessonStyleBlueprint => ({
  materials: ['Textbook (pictures of the steps)', 'Picture cards of the steps in the book’s order', 'What the demonstration needs for this lesson (a water jug and basin, or a prayer mat)', 'A checklist of the steps'],
  mainActivity: `(${m(ctx, 0.3)}) – Show the steps and perform them:\n\n1. Ask: “Who has seen someone in their family do this? What do they do first?” Take short answers.\n2. Show the book’s pictures of the steps in order, name each step as the book does, and fix its card on the board.${ideaEn(ctx)}\n3. Then perform the steps calmly in front of the class, pausing at each one for students to name it.\n4. Point out the manners or common mistakes the book mentions, adding no rulings of your own.`,
  guidedPractice: `(${m(ctx, 0.22)}) – Perform together:\n\n• Students mime the steps with you at their places, one step at a time, as you name each step.\n• Shuffle the picture cards; pairs put them in order and compare with the book.\n• Gently correct the order or the performance when a mistake appears.`,
  independentPractice: `(${m(ctx, 0.18)}) – Perform on my own:\n\n• Each student performs the steps for you or a confident classmate, one at a time, while the classmate ticks the checklist.\n• The others put the step pictures in order on a sheet and say each step’s name.\n• Early finishers explain to a partner why a Muslim keeps this act of worship, as the book says.`,
  assessment: 'Formative: watch the performance against the checklist — order, every step present, calm manner.\nSummative: each student performs the steps and orders their pictures; note the step a student stumbles on to repeat it with them.\nExit ticket: the class says the steps in order together.',
  differentiation: ISLAMIC_DIFF_EN,
});

const siraEn = (ctx: LessonStyleContext): LessonStyleBlueprint => ({
  materials: ['Textbook (the lesson’s story)', 'Pictures or cards of the story’s events', 'A simple timeline on the board', 'A “What I learn from the story” sheet'],
  mainActivity: `(${m(ctx, 0.3)}) – Tell the story and order it:\n\n1. Tell the story of “${ctx.topic}” as the book gives it, in an engaging storytelling voice with the pictures, while students listen without interrupting.\n2. Stop at two key moments and ask: “What do you think happens next?” Then carry on.\n3. Put the story’s events on a simple timeline on the board with the class: first, then, in the end.${ideaEn(ctx)}\n4. Ask: “What quality or deed do we learn from this story?” and write it clearly.`,
  guidedPractice: `(${m(ctx, 0.22)}) – Retell together:\n\n• Give the event cards to small groups; each group orders them and retells the story in its own words.\n• Ask: “Who? Where? What happened? Why?” and correct any detail the book does not give.\n• Talk about a situation in students’ lives that is like the one in the story.`,
  independentPractice: `(${m(ctx, 0.18)}) – Express it on my own:\n\n• Each student draws a place or an object from the story (never the prophets or the companions) and writes one sentence under it, or says it to you.\n• They complete the “What I learn from the story” sheet with one quality and how they will practise it.\n• Early finishers retell the story to a partner in three sentences.`,
  assessment: 'Formative: listen to the group retellings — are the events in order, and are the details from the book?\nSummative: read the drawings and sentences: did the student give a correct event and a lesson learned?\nExit ticket: each student finishes aloud: “What I liked in this story was…”.',
  differentiation: ISLAMIC_DIFF_EN,
});

const hadithEn = (ctx: LessonStyleContext): LessonStyleBlueprint => ({
  materials: ['Textbook (the hadith as given)', 'A card with the hadith in large, vowelled script', 'A word-meanings card', 'Short situation cards'],
  mainActivity: `(${m(ctx, 0.3)}) – Read the hadith and understand its guidance:\n\n1. Read the hadith from the book clearly and slowly, twice, while students follow on the card.\n2. Name its narrator as the book does, and explain the new words with the book’s meanings.\n3. Ask: “What does the Prophet (peace be upon him) call us to in this hadith?” and write the guidance in one sentence on the board.${ideaEn(ctx)}\n4. Then students repeat the hadith after you, in short parts, together and then one by one.`,
  guidedPractice: `(${m(ctx, 0.22)}) – Apply the guidance together:\n\n• Read out short situation cards; students decide whether each behaviour matches what the hadith asks, and why.\n• Two pairs act out a situation that follows the guidance, and the class comments.\n• Repeat the hadith in pairs: one reads, the other follows, then they swap.`,
  independentPractice: `(${m(ctx, 0.18)}) – Learn it and live it:\n\n• Each student recites the hadith to you or a confident classmate, one at a time.\n• They draw or write a moment in their day when they will act on it.\n• Early finishers explain one word of the hadith to a partner.`,
  assessment: 'Formative: listen to the repetition and note who needs more; follow students’ decisions on the situation cards.\nSummative: recitation of the hadith, and two questions: “What does it ask of us? When will you do it?”\nExit ticket: each student finishes: “I will follow the hadith when…”.',
  differentiation: ISLAMIC_DIFF_EN,
});

const conductEn = (ctx: LessonStyleContext): LessonStyleBlueprint => ({
  materials: ['Textbook (the lesson’s pictures)', 'Situation cards from students’ lives', 'Two signs: “Behaviour I love” and “Behaviour I avoid”', 'A “My promise” board'],
  mainActivity: `(${m(ctx, 0.3)}) – A situation and its guidance:\n\n1. Show a picture from the book or tell a short situation about “${ctx.topic}” from the life of a child the students’ age, and ask: “What did they do? Was it right?”\n2. Read what the book guides us to in this lesson and write it on the board in one sentence.${ideaEn(ctx)}\n3. Ask: “What does the book guide us to in this behaviour? How do the people around us feel when we do it?”\n4. List with students three small things they can do today at home or at school.`,
  guidedPractice: `(${m(ctx, 0.22)}) – Sort and act together:\n\n• Read out the situation cards; students place each under “Behaviour I love” or “Behaviour I avoid” and give the reason.\n• Two pairs act the same situation twice — once badly, once well — and the class compares.\n• Link each good choice back to what the book says.`,
  independentPractice: `(${m(ctx, 0.18)}) – My promise:\n\n• Each student writes or draws “My promise”: one thing they will do this week, and pins it on the board.\n• Students pick a situation card and tell a partner how they would act.\n• Early finishers suggest a new situation for the class.`,
  assessment: 'Formative: follow the sorting and the reasons — do students give a reason, or repeat the answer?\nSummative: read the “My promise” cards: is the deed specific and doable? Ask about it next lesson.\nExit ticket: each student names one thing they will do today.',
  differentiation: ISLAMIC_DIFF_EN,
});

// ─── Creative arts: music and drama ──────────────────────────────────────────

const musicAr = (ctx: LessonStyleContext): LessonStyleBlueprint => ({
  materials: ['آلة إيقاعية بسيطة أو تصفيق اليدين', 'تسجيل صوتي أو عزف مباشر للمقطع', 'بطاقات رموز (قوي / ضعيف، سريع / بطيء)', 'مساحة يقف فيها الطلبة في دائرة'],
  mainActivity: `(${m(ctx, 0.3)}) – نسمع ثم نقلّد:\n\n1. سأُسمع الطلبة المقطع أو الإيقاع المرتبط ${arPrefixed('ب', ctx.topic)} مرتين، وهم يصغون دون أدوات أولًا.\n2. سأسأل: «ماذا سمعتم؟ هل الصوت قوي أم ضعيف، سريع أم بطيء؟» وأكتب كلماتهم على السبورة.${ideaAr(ctx)}\n3. سأؤدّي النموذج بالتصفيق أو بالآلة أو بالغناء جزءًا جزءًا، ويقلّد الطلبة كل جزء بعدي (الصدى).\n4. وسأثبّت المصطلح الموسيقي كما ورد في الكتاب إلى جانب ما سمعه الطلبة.`,
  guidedPractice: `(${m(ctx, 0.22)}) – نؤدّي معًا:\n\n• نؤدّي النموذج كاملًا معًا، ثم سأقسم الصف إلى مجموعتين: مجموعة تؤدّي والأخرى تصغي وتقول ما لاحظته.\n• سأغيّر شرطًا واحدًا (السرعة أو القوة) ويحاول الطلبة اللحاق به.\n• وسأصحّح الأداء بإعادة النموذج، لا بالشرح الطويل.`,
  independentPractice: `(${m(ctx, 0.18)}) – نؤدّي ونبتكر:\n\n• تؤدّي كل مجموعة صغيرة النموذج أمام الصف، وتضيف تغييرًا صغيرًا من ابتكارها.\n• يشير الطلبة إلى بطاقة الرمز المناسبة حين أعزف مقطعًا جديدًا.\n• من ينهي مبكرًا يقود الصف في جولة «صدى».`,
  assessment: 'تكويني: سأراقب دقة التقليد والالتزام بالإيقاع، وأسجّل من يحتاج أداءً أبطأ.\nختامي: أداء جماعي قصير لكل مجموعة، وسؤال استماع يجيب عنه الطلبة برفع بطاقة الرمز.\nغلق الدرس: سنؤدّي النموذج معًا مرة أخيرة.',
  differentiation: 'دعم: سأبطئ النموذج وأقصّره، وأقف إلى جانب من يحتاج، وأستعمل التصفيق قبل الآلة.\nتحدٍّ: يبتكر الطالب تنويعًا على النموذج أو يقود المجموعة.\nالمبدأ: الأذن قبل الرمز — يشارك الجميع في الأداء، ويتغيّر طول المقطع وسرعته.',
});

const dramaAr = (ctx: LessonStyleContext): LessonStyleBlueprint => ({
  materials: ['مساحة فارغة في الصف أو المسرح المدرسي', 'شريط لاصق لتحديد «الخشبة»', 'بطاقات أدوار أو مواقف قصيرة', 'صور الدرس من الكتاب'],
  mainActivity: `(${m(ctx, 0.3)}) – نجرّب على الخشبة:\n\n1. سأحدّد «خشبة» في جزء من الصف بشريط لاصق، وأعرض صورة الدرس من الكتاب وأسأل: «ماذا ترون؟ أين يقف الممثل؟ وأين يجلس الجمهور؟»\n2. سأشرح فكرة درس «${ctx.topic}» كما ورد في الكتاب، وأسمّي المصطلحات وأنا أشير إلى المكان أو أؤدّي الحركة.${ideaAr(ctx)}\n3. سأؤدّي أمام الطلبة مشهدًا قصيرًا (دقيقة واحدة) يُظهر الفكرة، ثم أسأل: «ماذا لاحظتم في صوتي أو حركتي أو مكاني؟»\n4. وسأتفق مع الطلبة على قواعد الأداء الآمن: مساحة لكل ممثل، ولا تدافع، والجمهور يصغي ويصفّق في النهاية.`,
  guidedPractice: `(${m(ctx, 0.22)}) – نؤدّي ونتوقف معًا:\n\n• يجرّب الطلبة الفكرة في مجموعات صغيرة، وحين أقول «تجميد!» يتوقفون، وأسأل الجمهور عمّا يراه.\n• سأوزّع دوري «ممثل» و«جمهور» وأبدّلهما بعد كل جولة.\n• وسأوجّه الأداء بأسئلة قصيرة: «أين ستقف ليراك الجمهور؟»`,
  independentPractice: `(${m(ctx, 0.18)}) – مشهدنا:\n\n• تجهّز كل مجموعة مشهدًا قصيرًا (نصف دقيقة) يطبّق فكرة الدرس، وتعرضه على الخشبة.\n• يعلّق الجمهور بعد كل عرض: شيء أعجبني، وفكرة للتحسين.\n• من ينهي مبكرًا يضيف دورًا جديدًا إلى مشهد مجموعته.`,
  assessment: 'تكويني: سأراقب المشاركة والالتزام بقواعد الخشبة وظهور فكرة الدرس في الأداء.\nختامي: عرض المشهد القصير بقائمة ملاحظة: الصوت مسموع، والحركة في مكانها، والتعاون مع الفريق.\nغلق الدرس: يقول كل طالب ما أحبّه في عرض مجموعة أخرى.',
  differentiation: 'دعم: سأعطي دورًا بجملة واحدة أو بلا كلام، وأقف إلى جانب الطالب الخجول في الجولة الأولى.\nتحدٍّ: دور أطول، أو إخراج المشهد وتوزيع الأماكن على الفريق.\nالمبدأ: لكل طالب مكان على الخشبة أو في الجمهور، ويتبادلان — يتغيّر حجم الدور، لا فرصة الأداء.',
});

const musicEn = (ctx: LessonStyleContext): LessonStyleBlueprint => ({
  materials: ['A simple percussion instrument, or clapping', 'A recording or live playing of the piece', 'Symbol cards (loud / soft, fast / slow)', 'Room for students to stand in a circle'],
  mainActivity: `(${m(ctx, 0.3)}) – Hear it, then copy it:\n\n1. Play the piece or rhythm for “${ctx.topic}” twice while students listen, with no instruments yet.\n2. Ask: “What did you hear? Loud or soft, fast or slow?” and write their words on the board.${ideaEn(ctx)}\n3. Perform the model by clapping, on the instrument or by singing, a part at a time, and students echo each part after you.\n4. Fix the musical term the book uses beside what students heard.`,
  guidedPractice: `(${m(ctx, 0.22)}) – Perform together:\n\n• Perform the whole model together, then split the class in two: one half performs, the other listens and says what it noticed.\n• Change one thing (speed or loudness) and students try to follow.\n• Correct by performing the model again, not by long explanation.`,
  independentPractice: `(${m(ctx, 0.18)}) – Perform and invent:\n\n• Each small group performs the model for the class and adds one small change of its own.\n• Students point to the matching symbol card when you play a new passage.\n• Early finishers lead the class in a round of echoes.`,
  assessment: 'Formative: watch for accurate copying and steady rhythm; note who needs it slower.\nSummative: a short performance by each group, and a listening question students answer by holding up a symbol card.\nExit ticket: perform the model together one last time.',
  differentiation: 'Support: slow the model down and shorten it, stand beside students who need it, and clap before using the instrument.\nStretch: the student invents a variation or leads the group.\nThe principle: the ear before the symbol — everyone performs; the length and speed of the passage change.',
});

const dramaEn = (ctx: LessonStyleContext): LessonStyleBlueprint => ({
  materials: ['Clear floor space in the classroom or the school stage', 'Tape to mark out a “stage”', 'Role or short-situation cards', 'The lesson’s pictures from the book'],
  mainActivity: `(${m(ctx, 0.3)}) – Try it on the stage:\n\n1. Tape out a “stage” in part of the room, show the lesson’s picture from the book and ask: “What do you see? Where does the actor stand? Where does the audience sit?”\n2. Explain “${ctx.topic}” as the book gives it, naming the terms as you point to the place or perform the movement.${ideaEn(ctx)}\n3. Act a short scene (one minute) that shows the idea, then ask: “What did you notice about my voice, my movement or where I stood?”\n4. Agree the rules for performing safely: room for every actor, no pushing, and the audience listens and claps at the end.`,
  guidedPractice: `(${m(ctx, 0.22)}) – Perform and freeze together:\n\n• Students try the idea in small groups; when you call “Freeze!” they stop and you ask the audience what it sees.\n• Give out the roles of “actor” and “audience” and swap them after every round.\n• Steer the performance with short questions: “Where will you stand so the audience can see you?”`,
  independentPractice: `(${m(ctx, 0.18)}) – Our scene:\n\n• Each group prepares a short scene (half a minute) that uses the lesson’s idea and performs it on the stage.\n• After each one the audience says one thing they liked and one idea to improve it.\n• Early finishers add a new role to their group’s scene.`,
  assessment: 'Formative: watch participation, the stage rules, and whether the lesson’s idea shows in the performance.\nSummative: the short scene against an observation list: voice can be heard, movement in the right place, working with the team.\nExit ticket: each student says what they liked in another group’s scene.',
  differentiation: 'Support: a one-line or silent role, and stand beside a shy student in the first round.\nStretch: a longer role, or directing the scene and placing the team.\nThe principle: everyone has a place on the stage or in the audience, and they swap — the size of the role changes, not the chance to perform.',
});

// ─── Arabic: the «لغتي» lesson types ─────────────────────────────────────────

/** ` «كوكبنا»` after «الوحدة», or nothing when the unit has no theme to name. */
const unitAr = (ctx: LessonStyleContext) => {
  const u = unitTitle(ctx);
  return u ? ` «${u}»` : '';
};
const unitEn = (ctx: LessonStyleContext) => {
  const u = unitTitle(ctx);
  return u ? ` “${u}”` : '';
};

const listeningAr = (ctx: LessonStyleContext): LessonStyleBlueprint => ({
  materials: ['نص الاستماع من دليل المعلم أو تسجيله الصوتي', 'صورة تمهيدية عن موضوع الوحدة', 'بطاقات أسئلة الاستماع', 'ورقة «ماذا سمعت؟»'],
  mainActivity: `(${m(ctx, 0.3)}) – نصغي والكتب مغلقة:\n\n1. سأعرض صورة تمهّد لموضوع الوحدة${unitAr(ctx)} وأسأل: «ماذا تتوقعون أن نسمع اليوم؟»\n2. سأتفق مع الطلبة على آداب الاستماع: النظر إلى المتحدّث، وعدم المقاطعة، ورفع اليد قبل الكلام.\n3. سأقرأ نص الاستماع من دليل المعلم (أو أشغّل تسجيله) مرة كاملة دون توقف، والكتب مغلقة: الطلبة يصغون ولا يقرؤون.\n4. ثم سأطرح سؤالًا عامًا: «عمّ يتحدّث النص؟ ومن شخصياته؟» وأقبل الإجابات الشفوية.`,
  guidedPractice: `(${m(ctx, 0.22)}) – نصغي مرة ثانية ونجيب:\n\n• سأقرأ النص مرة ثانية، وأتوقف عند مواضع محدّدة لأسأل: «ماذا حدث بعد ذلك؟ ولماذا؟»\n• سأطرح أسئلة التذكّر ثم الترتيب ثم الرأي، والإجابات كلها شفوية.\n• ويرفع الطلبة بطاقة حين يسمعون كلمة أو تفصيلًا اتفقنا عليه.`,
  independentPractice: `(${m(ctx, 0.18)}) – ماذا سمعت؟\n\n• يجيب كل طالب عن ورقة «ماذا سمعت؟» بالرسم أو بالاختيار أو بكلمة واحدة، دون أن يرى النص.\n• يعيد الطالب لزميله حدثين مما سمع بترتيبهما.\n• من ينهي مبكرًا يقترح عنوانًا آخر للنص المسموع.`,
  assessment: 'تكويني: سأتابع إجابات أسئلة التذكّر والترتيب، وأسجّل من فاته جزء من النص.\nختامي: ورقة «ماذا سمعت؟»؛ والمقياس ما فهمه الطالب بالسمع وحده.\nغلق الدرس: يقول كل طالب أجمل ما سمعه اليوم.',
  differentiation: 'دعم: سأقرأ النص على مقاطع أقصر، وأعرض صورة لكل مقطع، وأجعل السؤال باختيار من متعدد.\nتحدٍّ: يتنبأ الطالب بنهاية أخرى، أو يطرح سؤالًا على زملائه عن النص.\nالمبدأ: الاستماع مهارة تُدرَّب — يتغيّر طول المقطع ومقدار الدعم، لا فرصة الإجابة.',
});

const speakingAr = (ctx: LessonStyleContext): LessonStyleBlueprint => ({
  materials: ['صورة التحدّث من الكتاب', 'بطاقات أسئلة ومفردات مساعدة', '«ميكروفون» رمزي يتناقله الطلبة', 'قائمة ملاحظة التحدّث'],
  mainActivity: `(${m(ctx, 0.3)}) – نتحدّث عن الصورة:\n\n1. سأعرض صورة التحدّث من الكتاب في الوحدة${unitAr(ctx)} وأسأل: «ماذا ترون؟ وماذا يحدث؟»\n2. سأكتب على السبورة كلمات وعبارات مساعدة يحتاجها الطلبة للحديث عن الصورة.\n3. سأقدّم أمامهم نموذج حديث قصير (ثلاث جمل) عن الصورة بصوت واضح وجمل تامة.\n4. وسأتفق معهم على آداب الحديث: صوت واضح، وجملة تامة، وانتظار الدور.`,
  guidedPractice: `(${m(ctx, 0.22)}) – نتحدّث بالتناوب:\n\n• يتناقل الطلبة «الميكروفون» ويقول كل منهم جملة واحدة عن الصورة، وأساعد في إكمال الجملة.\n• سأطرح أسئلة مفتوحة: «ماذا تفعل لو كنت مكانه؟»\n• حوار ثنائي: يسأل الطالب زميله سؤالًا من البطاقات ويجيبه، ثم يتبادلان.`,
  independentPractice: `(${m(ctx, 0.18)}) – دقيقتي:\n\n• يتحدّث كل طالب أمام مجموعته دقيقة واحدة عن الصورة أو عن تجربة تشبهها، مستعملًا كلمتين من السبورة.\n• تعلّق المجموعة بشيء أعجبها في حديثه.\n• من ينهي مبكرًا يروي نهاية مختلفة للموقف.`,
  assessment: 'تكويني: سأدوّن على قائمة الملاحظة: وضوح الصوت، والجملة التامة، واستعمال المفردات الجديدة.\nختامي: حديث فردي قصير، أقيّم فيه الطلاقة والفكرة لا الحفظ.\nغلق الدرس: يقول كل طالب جملة واحدة بدأها بكلمة من السبورة.',
  differentiation: 'دعم: سأقدّم بدايات جمل جاهزة («أرى في الصورة…»)، وأسمح بالحديث مع زميل قبل الحديث أمام المجموعة.\nتحدٍّ: يصل الطالب جملتين بأداة ربط، أو يحاور زميله دون بطاقات.\nالمبدأ: يتحدّث كل طالب — يتغيّر طول الحديث ومقدار الدعم، لا فرصة الكلام.',
});

const spellingAr = (ctx: LessonStyleContext): LessonStyleBlueprint => {
  const rule = bracketed(ctx) ?? ctx.topic;
  return {
    materials: ['الكتاب المدرسي (أمثلة الدرس)', 'بطاقات كلمات للتصنيف', 'السبورة وأقلام ملوّنة', 'ألواح صغيرة أو دفتر الكتابة'],
    mainActivity: `(${m(ctx, 0.3)}) – نلاحظ ثم نكتب:\n\n1. سأكتب على السبورة أمثلة من نص الوحدة${unitAr(ctx)} تتعلّق بـ«${rule}»، وألوّن موضع الملاحظة في كل كلمة.\n2. سأقرأ الأمثلة مع الطلبة وأسأل: «ماذا تلاحظون في الكلمات الملوّنة؟ وما الذي يتكرّر؟»\n3. سأصوغ مع الطلبة ما لاحظوه في جملة قصيرة كما يعرضها الكتاب، وأكتبها في إطار على السبورة.\n4. ثم سأكتب كلمة جديدة أمامهم ببطء، وأفكّر بصوت عالٍ: «ماذا أكتب هنا؟ ولماذا؟»`,
    guidedPractice: `(${m(ctx, 0.22)}) – نكتب معًا:\n\n• سأعرض بطاقات كلمات، ويصنّفها الطلبة في عمودين على السبورة بحسب ما تعلّموه.\n• سأملي كلمتين، ويكتبهما الطلبة على ألواحهم ويرفعونها، فأصحّح فورًا.\n• ونصحّح معًا كلمة كُتبت خطأً عن قصد.`,
    independentPractice: `(${m(ctx, 0.18)}) – أكتب بمفردي:\n\n• ينسخ كل طالب ثلاث كلمات من الكتاب تطبّق ما تعلّمه، ويضع خطًّا تحت موضع الملاحظة.\n• يكتب جملة قصيرة واحدة فيها كلمة من الدرس.\n• من ينهي مبكرًا يبحث في نص الوحدة عن كلمة أخرى ويضيفها.`,
    assessment: 'تكويني: سأقرأ الألواح المرفوعة وأسجّل الخطأ الذي يتكرّر لأعيده مع الصف.\nختامي: إملاء قصير من ثلاث كلمات وجملة، أصحّحه بالقاعدة التي تعلّمها الطلبة.\nغلق الدرس: يكتب كل طالب كلمة واحدة على لوحه ويرفعه.',
    differentiation: 'دعم: سأقدّم الكلمة مقطّعة، ونموذجًا ملوّنًا ينسخ عنه الطالب، وعددًا أقل من الكلمات.\nتحدٍّ: يجد الطالب كلمات أخرى من كتبه تنطبق عليها القاعدة ويشرح السبب.\nالمبدأ: الكتابة الصحيحة تُبنى بالملاحظة والتكرار — يتغيّر مقدار الدعم، لا فرصة الكتابة.',
  };
};

const compositionAr = (ctx: LessonStyleContext): LessonStyleBlueprint => ({
  materials: ['الكتاب المدرسي (النموذج المكتوب)', 'خريطة أفكار فارغة', 'قائمة معايير الكتابة', 'دفتر الكتابة'],
  mainActivity: `(${m(ctx, 0.3)}) – من النموذج إلى الخطة:\n\n1. سأعرض النموذج المكتوب في الكتاب لدرس «${ctx.topic}» وأقرؤه مع الطلبة.\n2. سأحلّل معهم بنيته: البداية، والعرض، والخاتمة، وما يميّز هذا النوع من الكتابة.\n3. سأخطّط أمامهم فقرة قصيرة بخريطة أفكار، وأكتب جملتها الأولى وأنا أفكّر بصوت عالٍ.\n4. وسأثبّت معايير الكتابة الجيدة على السبورة.`,
  guidedPractice: `(${m(ctx, 0.22)}) – نخطّط ونكتب معًا:\n\n• يخطّط الطلبة في ثنائيات لموضوعهم بخريطة الأفكار نفسها.\n• نكتب معًا بداية مشتركة على السبورة ونحسّنها.\n• وسأعرض جملة ضعيفة ونقوّيها معًا.`,
  independentPractice: `(${m(ctx, 0.18)}) – مسودتي:\n\n• يكتب كل طالب مسودته الأولى مستعينًا بالخطة والمعايير.\n• يراجع مسودة زميله بقائمة المعايير ويكتب ملاحظة واحدة.\n• من ينهي مبكرًا يعيد كتابة جملة البداية بطريقتين.`,
  assessment: 'تكويني: سأقرأ الخطط قبل الكتابة: هل للفقرة فكرة واضحة وترتيب؟\nختامي: سأقيّم المسودة المنقّحة بقائمة المعايير المعلنة.\nغلق الدرس: يقرأ ثلاثة طلبة جملة البداية التي كتبوها.',
  differentiation: 'دعم: سأقدّم خريطة أفكار نصف مكتملة وبدايات جمل.\nتحدٍّ: الكتابة لقارئ محدّد، أو بأسلوب آخر (رسالة، حوار، وصف).\nالمبدأ: الكتابة مراحل — يتغيّر مقدار الدعم في كل مرحلة، لا فرصة الكتابة.',
});

const languageAr = (ctx: LessonStyleContext): LessonStyleBlueprint => ({
  materials: ['جمل من نص الوحدة على بطاقات', 'السبورة وأقلام ملوّنة', 'بطاقات كلمات للتركيب', 'ورقة تطبيق قصيرة'],
  mainActivity: `(${m(ctx, 0.3)}) – نكتشف الظاهرة اللغوية:\n\n1. سأكتب على السبورة ثلاث جمل من نص الوحدة${unitAr(ctx)} تحمل الظاهرة اللغوية للدرس، وألوّن الكلمة المقصودة في كل جملة.\n2. سأقرأ الجمل وأسأل: «ما الذي يتشابه في الكلمات الملوّنة؟» وأترك الطلبة يكتشفون.\n3. سأسمّي الظاهرة كما يسمّيها الكتاب، وأعطي مثالًا جديدًا من حياة الطلبة.\n4. وسأكتب مع الطلبة جملة من تأليفهم تستعمل الظاهرة.`,
  guidedPractice: `(${m(ctx, 0.22)}) – نركّب معًا:\n\n• لعبة تركيب: يرتّب الطلبة بطاقات الكلمات ليكوّنوا جملًا صحيحة، والصف يتحقّق.\n• سأقول جملة فيها خطأ، ويصحّحها الطلبة شفويًا.\n• وسأقول كلمة، ويستعملها الطلبة في جملة على النمط نفسه.`,
  independentPractice: `(${m(ctx, 0.18)}) – أطبّق بمفردي:\n\n• يكمل كل طالب ورقة تطبيق قصيرة: ثلاث جمل يملأ فراغها أو يختار الكلمة المناسبة لها.\n• يؤلّف جملة واحدة خاصة به على النمط نفسه.\n• من ينهي مبكرًا يستخرج مثالًا آخر من نص الوحدة.`,
  assessment: 'تكويني: سأتابع لعبة التركيب والتصحيح الشفوي، وأسجّل من يحتاج أمثلة أكثر.\nختامي: ورقة التطبيق والجملة المؤلّفة: هل استعمل الطالب الظاهرة استعمالًا صحيحًا؟\nغلق الدرس: يقول كل طالب جملة على النمط الجديد.',
  differentiation: 'دعم: سأقدّم بطاقات بخيارين، وجملًا ناقصة كلمة واحدة، وأمثلة ملوّنة.\nتحدٍّ: يحوّل الطالب الجملة إلى صيغة أخرى، أو يجد الظاهرة في نص جديد.\nالمبدأ: القاعدة تُكتشف من الأمثلة ثم تُستعمل — يتغيّر عدد الأمثلة ومقدار الدعم.',
});

const lettersAr = (ctx: LessonStyleContext): LessonStyleBlueprint => ({
  materials: ['بطاقة الحرف بأشكاله', 'صور كلمات فيها صوت الحرف', 'بطاقات مقاطع بالحركات', 'لوح صغير وقلم لكل طالب'],
  mainActivity: `(${m(ctx, 0.3)}) – نسمع الصوت ونرى الشكل:\n\n1. سأعرض صورًا لكلمات فيها صوت درس «${ctx.topic}»، وأنطق الكلمات ببطء، وأسأل: «ما الصوت الذي يتكرّر؟»\n2. سأعرض شكل الحرف في أول الكلمة ووسطها وآخرها، وأرسمه في الهواء والطلبة يقلّدونني.\n3. سأقرأ مع الطلبة مقاطع الحرف بالحركات على البطاقات.\n4. وسأكتب الحرف ببطء على السبورة، وأصف حركة القلم: من أين أبدأ وإلى أين أنتهي.`,
  guidedPractice: `(${m(ctx, 0.22)}) – نقرأ ونكتب معًا:\n\n• يقرأ الطلبة المقاطع معي جماعيًا ثم في ثنائيات.\n• سأنطق كلمة، ويرفع الطالب البطاقة إن سمع الصوت فيها.\n• يكتب الطلبة الحرف على ألواحهم ويرفعونها لأصحّح.`,
  independentPractice: `(${m(ctx, 0.18)}) – أكتب الحرف:\n\n• يكتب كل طالب الحرف بأشكاله في دفتره سطرًا واحدًا.\n• يلوّن الحرف في كلمات مطبوعة على ورقة.\n• من ينهي مبكرًا يقرأ لزميله كلمة جديدة فيها الحرف.`,
  assessment: 'تكويني: سأتابع رفع البطاقات والألواح: من يسمع الصوت؟ ومن يكتب الشكل صحيحًا؟\nختامي: قراءة فردية لثلاثة مقاطع، وكتابة الحرف في موضعين.\nغلق الدرس: يقول كل طالب كلمة فيها صوت الحرف.',
  differentiation: 'دعم: سأقدّم حرفًا منقّطًا يمرّ الطالب عليه بالقلم، وكلمات أقل.\nتحدٍّ: يقرأ الطالب كلمة كاملة جديدة، أو يكتب كلمة من مقطعين.\nالمبدأ: الصوت ثم الشكل ثم الكتابة — يتغيّر مقدار الدعم، لا فرصة القراءة.',
});

const listeningEn = (ctx: LessonStyleContext): LessonStyleBlueprint => ({
  materials: ['The listening text from the teacher’s guide, or its recording', 'A lead-in picture about the unit’s theme', 'Listening question cards', 'A “What did I hear?” sheet'],
  mainActivity: `(${m(ctx, 0.3)}) – Listen with books closed:\n\n1. Show a picture that leads into the theme of the unit${unitEn(ctx)} and ask: “What do you think we will hear today?”\n2. Agree the listening manners: look at the speaker, do not interrupt, raise a hand before speaking.\n3. Read the listening text from the teacher’s guide (or play the recording) once through without stopping, books closed: students listen and do not read.\n4. Then ask a general question: “What is it about? Who is in it?” and take oral answers.`,
  guidedPractice: `(${m(ctx, 0.22)}) – Listen again and answer:\n\n• Read the text a second time, stopping at set points to ask: “What happened next? Why?”\n• Ask recall questions, then ordering, then opinion — all answered aloud.\n• Students raise a card when they hear a word or detail agreed in advance.`,
  independentPractice: `(${m(ctx, 0.18)}) – What did I hear?\n\n• Each student answers the “What did I hear?” sheet by drawing, choosing or writing one word, without seeing the text.\n• Students retell two events they heard to a partner, in order.\n• Early finishers suggest another title for the text.`,
  assessment: 'Formative: follow the recall and ordering answers; note who missed part of the text.\nSummative: the “What did I hear?” sheet — the measure is what the student understood by ear alone.\nExit ticket: each student says the best thing they heard today.',
  differentiation: 'Support: read the text in shorter parts with a picture for each, and make the questions multiple choice.\nStretch: the student predicts another ending, or asks the class a question about the text.\nThe principle: listening is a skill to be practised — the length of the passage and the support change, not the chance to answer.',
});

const speakingEn = (ctx: LessonStyleContext): LessonStyleBlueprint => ({
  materials: ['The book’s speaking picture', 'Question and helpful-vocabulary cards', 'A pretend “microphone” students pass round', 'A speaking observation list'],
  mainActivity: `(${m(ctx, 0.3)}) – Talk about the picture:\n\n1. Show the book’s speaking picture in the unit${unitEn(ctx)} and ask: “What do you see? What is happening?”\n2. Write helpful words and phrases on the board that students need to talk about it.\n3. Model a short talk (three sentences) about the picture in a clear voice and full sentences.\n4. Agree the speaking manners: a clear voice, a full sentence, waiting your turn.`,
  guidedPractice: `(${m(ctx, 0.22)}) – Take turns to speak:\n\n• Students pass the “microphone” and each says one sentence about the picture; help them finish it.\n• Ask open questions: “What would you do in their place?”\n• Pair talk: a student asks a partner a question from the cards and answers theirs, then they swap.`,
  independentPractice: `(${m(ctx, 0.18)}) – My minute:\n\n• Each student speaks for one minute to their group about the picture or a similar experience, using two words from the board.\n• The group says one thing it liked.\n• Early finishers tell a different ending to the situation.`,
  assessment: 'Formative: note on the observation list: a clear voice, full sentences, use of the new words.\nSummative: a short individual talk, judged on fluency and the idea, not on memorising.\nExit ticket: each student says one sentence that starts with a word from the board.',
  differentiation: 'Support: ready sentence starters (“In the picture I see…”), and talking to a partner before the group.\nStretch: join two sentences with a linking word, or hold a conversation without the cards.\nThe principle: every student speaks — the length of the talk and the support change, not the chance to speak.',
});

const spellingEn = (ctx: LessonStyleContext): LessonStyleBlueprint => {
  const rule = bracketed(ctx) ?? ctx.topic;
  return {
    materials: ['Textbook (the lesson’s examples)', 'Word cards for sorting', 'Board and coloured pens', 'Mini whiteboards or writing books'],
    mainActivity: `(${m(ctx, 0.3)}) – Notice, then write:\n\n1. Write examples from the text of the unit${unitEn(ctx)} about “${rule}” on the board, colouring the part to notice in each word.\n2. Read the examples with students and ask: “What do you notice in the coloured words? What repeats?”\n3. Put what they noticed into a short sentence as the book gives it, and frame it on the board.\n4. Then write a new word slowly in front of them, thinking aloud: “What do I write here, and why?”`,
    guidedPractice: `(${m(ctx, 0.22)}) – Write together:\n\n• Show word cards; students sort them into two columns on the board by what they learned.\n• Dictate two words; students write them on mini whiteboards and hold them up for instant correction.\n• Correct together a word written wrongly on purpose.`,
    independentPractice: `(${m(ctx, 0.18)}) – Write on my own:\n\n• Each student copies three words from the book that follow the rule and underlines the part to notice.\n• They write one short sentence with a word from the lesson.\n• Early finishers find another word in the unit’s text and add it.`,
    assessment: 'Formative: read the raised whiteboards and note the repeated mistake to go over with the class.\nSummative: a short dictation of three words and a sentence, marked against the rule learned.\nExit ticket: each student writes one word on their whiteboard and holds it up.',
    differentiation: 'Support: the word split into syllables, a coloured model to copy, and fewer words.\nStretch: find other words in their books that follow the rule and say why.\nThe principle: correct spelling is built by noticing and repetition — change the support, not the chance to write.',
  };
};

const compositionEn = (ctx: LessonStyleContext): LessonStyleBlueprint => ({
  materials: ['Textbook (the model text)', 'A blank idea map', 'A writing criteria list', 'Writing books'],
  mainActivity: `(${m(ctx, 0.3)}) – From the model to a plan:\n\n1. Show the book’s model text for “${ctx.topic}” and read it with students.\n2. Analyse its structure with them: opening, body, ending, and what marks this kind of writing.\n3. Plan a short paragraph in front of them on an idea map, writing its first sentence while thinking aloud.\n4. Fix the criteria for good writing on the board.`,
  guidedPractice: `(${m(ctx, 0.22)}) – Plan and write together:\n\n• Pairs plan their own topic on the same idea map.\n• Write a shared opening on the board together and improve it.\n• Show a weak sentence and strengthen it together.`,
  independentPractice: `(${m(ctx, 0.18)}) – My draft:\n\n• Each student writes a first draft from their plan and the criteria.\n• They review a partner’s draft against the criteria and write one comment.\n• Early finishers rewrite their opening sentence two ways.`,
  assessment: 'Formative: read the plans before writing — does the paragraph have a clear idea and order?\nSummative: assess the revised draft against the criteria announced.\nExit ticket: three students read their opening sentence.',
  differentiation: 'Support: a half-filled idea map and sentence starters.\nStretch: write for a named reader, or in another form (a letter, a dialogue, a description).\nThe principle: writing comes in stages — change the support at each stage, not the chance to write.',
});

const languageEn = (ctx: LessonStyleContext): LessonStyleBlueprint => ({
  materials: ['Sentences from the unit’s text on cards', 'Board and coloured pens', 'Word cards for building sentences', 'A short practice sheet'],
  mainActivity: `(${m(ctx, 0.3)}) – Discover the language feature:\n\n1. Write three sentences from the text of the unit${unitEn(ctx)} on the board that carry the lesson’s language feature, colouring the target word in each.\n2. Read them and ask: “What do the coloured words have in common?” Let students find it.\n3. Name the feature as the book names it, and give a new example from students’ lives.\n4. Write a sentence of the students’ own with them that uses it.`,
  guidedPractice: `(${m(ctx, 0.22)}) – Build it together:\n\n• A building game: students arrange word cards into correct sentences while the class checks.\n• Say a sentence with a mistake; students correct it aloud.\n• Say a word; students use it in a sentence on the same pattern.`,
  independentPractice: `(${m(ctx, 0.18)}) – Use it on my own:\n\n• Each student completes a short practice sheet: three sentences to fill in or to choose the right word for.\n• They write one sentence of their own on the same pattern.\n• Early finishers find another example in the unit’s text.`,
  assessment: 'Formative: follow the building game and the oral corrections; note who needs more examples.\nSummative: the practice sheet and the student’s own sentence — is the feature used correctly?\nExit ticket: each student says a sentence on the new pattern.',
  differentiation: 'Support: two-choice cards, sentences missing one word, and coloured examples.\nStretch: change the sentence into another form, or find the feature in a new text.\nThe principle: the rule is discovered from examples and then used — the number of examples and the support change.',
});

const lettersEn = (ctx: LessonStyleContext): LessonStyleBlueprint => ({
  materials: ['A card showing the letter’s forms', 'Pictures of words with the letter’s sound', 'Syllable cards with the short vowels', 'A mini whiteboard and pen for each student'],
  mainActivity: `(${m(ctx, 0.3)}) – Hear the sound, see the shape:\n\n1. Show pictures of words with the sound of “${ctx.topic}”, say them slowly, and ask: “Which sound repeats?”\n2. Show the letter’s shape at the start, middle and end of a word, and trace it in the air while students copy.\n3. Read the letter’s syllables with the vowel marks from the cards with the class.\n4. Write the letter slowly on the board, describing the pen’s movement: where to start and where to finish.`,
  guidedPractice: `(${m(ctx, 0.22)}) – Read and write together:\n\n• Students read the syllables with you, together and then in pairs.\n• Say a word; students raise a card if they hear the sound in it.\n• Students write the letter on their whiteboards and hold them up for correction.`,
  independentPractice: `(${m(ctx, 0.18)}) – Write the letter:\n\n• Each student writes one line of the letter’s forms in their book.\n• They colour the letter in printed words on a sheet.\n• Early finishers read a new word with the letter to a partner.`,
  assessment: 'Formative: follow the raised cards and whiteboards — who hears the sound, and who writes the shape correctly?\nSummative: each student reads three syllables and writes the letter in two positions.\nExit ticket: each student says a word with the letter’s sound.',
  differentiation: 'Support: a dotted letter to trace, and fewer words.\nStretch: read a whole new word, or write a two-syllable word.\nThe principle: sound, then shape, then writing — the support changes, not the chance to read.',
});

// ─── Registry ────────────────────────────────────────────────────────────────

type Builder = (ctx: LessonStyleContext) => LessonStyleBlueprint;

/** «أكتب (هذا، هذه)» is a spelling rule; «الكتابة: كتابة تقرير» is composition. */
const isSpellingLesson = (ctx: LessonStyleContext) => /^اكتب \(/.test(foldArabic(ctx.kb?.titleAr ?? ''));

const OWN: Partial<Record<LessonType, { ar: Builder; en: Builder }>> = {
  creed: { ar: creedAr, en: creedEn },
  worship: { ar: worshipAr, en: worshipEn },
  sira: { ar: siraAr, en: siraEn },
  hadith: { ar: hadithAr, en: hadithEn },
  conduct: { ar: conductAr, en: conductEn },
  music: { ar: musicAr, en: musicEn },
  drama: { ar: dramaAr, en: dramaEn },
  listening: { ar: listeningAr, en: listeningEn },
  speaking: { ar: speakingAr, en: speakingEn },
  writing: {
    ar: ctx => (isSpellingLesson(ctx) ? spellingAr(ctx) : compositionAr(ctx)),
    en: ctx => (isSpellingLesson(ctx) ? spellingEn(ctx) : compositionEn(ctx)),
  },
  language: { ar: languageAr, en: languageEn },
  letters: { ar: lettersAr, en: lettersEn },
};

/**
 * The direct plan for a typed lesson, or null when the lesson has no type (or a
 * type that does not belong to its kind — a request can carry anything).
 */
export function typedDirectBlueprint(ctx: LessonStyleContext): LessonStyleBlueprint | null {
  const type = ctx.lessonType;
  if (!type || ctx.doc || KIND_OF_TYPE[type] !== (ctx.kind ?? 'calc')) return null;
  const own = OWN[type];
  if (own) return own[ctx.lang](ctx);
  // quran, visual-art, reading: the kind's routine was written for them.
  const native = ctx.variant === 1
    ? (ctx.lang === 'ar' ? nativeDirectVariant1(ctx) : nativeDirectVariant1En(ctx))
    : nativeDirectBlueprint(ctx);
  return withIdea(native, ctx);
}

// ─── Objectives, openings and homework ───────────────────────────────────────

/**
 * Objectives for a type whose kind's do not fit it, when the lesson carries no
 * official outcomes (no Grade 2 lesson does). The recitation objectives promise
 * «أن يقرأ الطالب ما تقرّر من آيات أو حديث» to a lesson on the pillars of faith.
 * Null keeps the kind's.
 */
export function typedObjectives(type: LessonType | null | undefined, topic: string, lang: 'ar' | 'en'): string[] | null {
  if (!type) return null;
  const ar: Partial<Record<LessonType, string[]>> = {
    hadith: ['أن يردّد الطالب الحديث الشريف ترديدًا سليمًا', 'أن يبيّن الطالب معاني مفردات الحديث والتوجيه الذي يدعو إليه', 'أن يحدّد الطالب موقفًا من حياته يعمل فيه بالحديث'],
    creed: [`أن يذكر الطالب ما ورد في الكتاب عن «${topic}»`, 'أن يربط الطالب ما تعلّمه بأمثلة من حياته', 'أن يبيّن الطالب أثر ما تعلّمه في سلوكه'],
    worship: [`أن يرتّب الطالب خطوات «${topic}» كما وردت في الكتاب`, 'أن يؤدّي الطالب الخطوات أداءً عمليًا صحيحًا', 'أن يحرص الطالب على أداء العبادة كما تعلّمها'],
    sira: [`أن يروي الطالب أحداث «${topic}» بترتيبها`, 'أن يستخرج الطالب صفة أو عبرة من القصة', 'أن يقتدي الطالب بما تعلّمه في سلوكه'],
    conduct: [`أن يبيّن الطالب ما يرشد إليه الإسلام في «${topic}»`, 'أن يميّز الطالب السلوك الحسن من غيره في مواقف من حياته', 'أن يلتزم الطالب بعمل محدّد يطبّق فيه ما تعلّمه'],
    music: [`أن يميّز الطالب بالاستماع ما يتعلّمه في «${topic}»`, 'أن يؤدّي الطالب النموذج الموسيقي بالتصفيق أو بالآلة أو بالغناء', 'أن يبتكر الطالب تنويعًا بسيطًا على النموذج'],
    drama: [`أن يتعرّف الطالب إلى «${topic}» كما وردت في الكتاب`, 'أن يطبّق الطالب فكرة الدرس في مشهد قصير مع زملائه', 'أن يلتزم الطالب بقواعد الخشبة ويحترم دور الجمهور'],
    listening: ['أن يصغي الطالب إلى النص المسموع بانتباه', 'أن يتذكّر الطالب أحداث النص المسموع ويرتّبها', 'أن يبدي الطالب رأيه فيما سمع'],
    speaking: ['أن يتحدّث الطالب عن صورة أو موقف بجمل تامة', 'أن يوظّف الطالب مفردات جديدة في حديثه', 'أن يلتزم الطالب بآداب الحديث وانتظار الدور'],
    writing: [`أن يلاحظ الطالب ما يتعلّمه في «${topic}» في أمثلة من النص`, 'أن يكتب الطالب كلمات وجملًا كتابة صحيحة', 'أن يصحّح الطالب كتابته بنفسه'],
    language: ['أن يكتشف الطالب الظاهرة اللغوية من أمثلة النص', 'أن يركّب الطالب جملًا صحيحة على النمط نفسه', 'أن يوظّف الطالب الظاهرة في جمل من تأليفه'],
    letters: ['أن يميّز الطالب صوت الحرف في كلمات يسمعها', 'أن يقرأ الطالب الحرف مع الحركات', 'أن يكتب الطالب الحرف في مواضعه كتابة صحيحة'],
  };
  const en: Partial<Record<LessonType, string[]>> = {
    hadith: ['Students will repeat the hadith correctly', 'Students will explain its words and the guidance it calls to', 'Students will name a moment in their lives when they will act on it'],
    creed: [`Students will state what the book says about “${topic}”`, 'Students will link what they learned to examples from their lives', 'Students will explain how it affects their behaviour'],
    worship: [`Students will put the steps of “${topic}” in the book’s order`, 'Students will perform the steps correctly', 'Students will keep to the act of worship as they learned it'],
    sira: [`Students will retell the events of “${topic}” in order`, 'Students will draw a quality or lesson from the story', 'Students will follow that example in their own behaviour'],
    conduct: [`Students will explain what Islam guides us to in “${topic}”`, 'Students will tell good behaviour from bad in situations from their lives', 'Students will commit to one specific deed that applies it'],
    music: [`Students will recognise by ear what “${topic}” teaches`, 'Students will perform the musical model by clapping, instrument or singing', 'Students will invent a simple variation on it'],
    drama: [`Students will recognise “${topic}” as the book presents it`, 'Students will apply the idea in a short scene with classmates', 'Students will keep the stage rules and respect the audience’s role'],
    listening: ['Students will listen attentively to the spoken text', 'Students will recall the events they heard and put them in order', 'Students will give an opinion on what they heard'],
    speaking: ['Students will talk about a picture or situation in full sentences', 'Students will use new vocabulary when speaking', 'Students will keep the speaking manners and wait their turn'],
    writing: [`Students will notice what “${topic}” teaches in examples from the text`, 'Students will write words and sentences correctly', 'Students will check and correct their own writing'],
    language: ['Students will discover the language feature from examples in the text', 'Students will build correct sentences on the same pattern', 'Students will use the feature in sentences of their own'],
    letters: ['Students will hear the letter’s sound in spoken words', 'Students will read the letter with the vowel marks', 'Students will write the letter correctly in its positions'],
  };
  return (lang === 'ar' ? ar : en)[type] ?? null;
}


/**
 * Openings for a type whose kind's openings do not fit it. The recitation
 * openers promise «ما تقرّر من آيات أو حديث» to a lesson on the wudu; the arts
 * openers end «ثم أعلن ما سيصنعه الطلبة اليوم» on a drama lesson; the Arabic
 * openers ask what «أستمع بانتباه وتركيز» will "talk about". Null keeps the kind's.
 */
export function typedIntro(type: LessonType | null | undefined, topic: string, lang: 'ar' | 'en'): string[] | null {
  if (!type) return null;
  const ar: Partial<Record<LessonType, string[]>> = {
    hadith: [
      `سأبدأ بسؤال: «من يحبّ أن يكون مثل سيدنا محمد صلى الله عليه وسلم؟» ثم سأخبر الطلبة أنهم سيتعلّمون اليوم حديثًا يرشدنا إلى عمل جميل في درس «${topic}».`,
      `سأروي موقفًا قصيرًا من حياة طفل يحتاج إلى نصيحة، ثم أسأل: «بماذا ننصحه؟» وسأعلن أن حديث اليوم يحمل النصيحة.`,
    ],
    creed: [
      `سأسأل الطلبة: «ماذا نرى حولنا من نِعم الله؟» وأدوّن إجاباتهم، ثم أربطها بدرس «${topic}».`,
      `سأعرض صورة من الطبيعة وأسأل: «من خلق هذا؟ وماذا نشعر حين نتأمّله؟» ثم سأعلن موضوع درس «${topic}».`,
    ],
    worship: [
      `سأسأل: «ماذا نفعل قبل أن نصلّي؟ ومن علّمنا ذلك؟» وأستمع إلى إجابات قصيرة، ثم سأعلن أننا سنتعلّم «${topic}» خطوةً بخطوة.`,
      `سأعرض صورة من الكتاب لطفل يؤدّي العبادة وأسأل: «ماذا يفعل؟ وماذا تتوقعون أن يفعل بعد ذلك؟»`,
    ],
    sira: [
      `سأبدأ بسؤال: «من يحبّ القصص؟ اليوم سأروي لكم قصة حقيقية»، ثم أعرض صورة من الكتاب وأسأل: «ماذا تتوقعون أن تحكي؟»`,
      `سأكتب «${topic}» على السبورة وأسأل: «ماذا نعرف عن هذا؟» ثم سأعلن أننا سنعرف القصة كما يرويها الكتاب.`,
    ],
    conduct: [
      `سأعرض صورة من الكتاب لموقف من حياة الأطفال وأسأل: «ماذا ترون؟ وماذا كنتم ستفعلون؟» ثم أربط الإجابات بدرس «${topic}».`,
      `سأسأل: «ما الذي يفرح أسرتنا وأصدقاءنا منّا؟» وأدوّن ثلاث إجابات، ثم سأعلن موضوع درس «${topic}».`,
    ],
    music: [
      `سأبدأ بلعبة «الصدى»: أصفّق نمطًا قصيرًا ويقلّده الطلبة، ثم سأعلن أننا سنتعرّف اليوم إلى «${topic}».`,
      `سأُسمع الطلبة صوتين مختلفين وأسأل: «ما الفرق بينهما؟» ثم أربط إجاباتهم بدرس «${topic}».`,
    ],
    drama: [
      `سأدخل الصف كأنني شخصية من قصة، وأقول جملة واحدة بصوت مختلف، ثم أسأل: «من أكون؟ وكيف عرفتم؟» وأربط ذلك بدرس «${topic}».`,
      `سأسأل: «من شاهد مسرحية؟ ماذا رأيتم على الخشبة؟» وأدوّن الإجابات، ثم سأعلن أننا سنجرّب اليوم «${topic}».`,
    ],
    listening: [
      `سأبدأ بدقيقة صمت يصغي فيها الطلبة إلى أصوات المكان، ثم أسأل: «ماذا سمعتم؟» وسأعلن أننا سنتدرّب اليوم على الإصغاء.`,
      `سأعرض صورة من الوحدة وأسأل: «ماذا تتوقعون أن نسمع عنها؟» وأدوّن التوقعات لنعود إليها بعد الاستماع.`,
    ],
    speaking: [
      `سأسأل سؤالًا قريبًا من الطلبة عن موضوع الوحدة، وأستمع إلى إجابتين أو ثلاث، ثم سأعلن أن كل واحد سيتحدّث اليوم.`,
      `سأعرض صورة التحدّث من الكتاب وأطلب من الطلبة أن يذكروا كلمة واحدة تخطر لهم، وأكتب الكلمات لتساعدنا في الحديث.`,
    ],
    writing: [
      `سأكتب على السبورة كلمتين متشابهتين فيهما خطأ في إحداهما، وأسأل: «أيّهما الصحيحة؟ ولماذا؟» ثم سأعلن موضوع الكتابة اليوم.`,
      `سأعرض جملة من نص الوحدة وأسأل: «ماذا تلاحظون في طريقة كتابة هذه الكلمة؟» ثم أربط ذلك بدرس «${topic}».`,
    ],
    language: [
      `سأقول جملتين من نص الوحدة بينهما فرق صغير، وأسأل: «ما الذي تغيّر؟» ثم سأعلن أننا سنكتشف اليوم ظاهرة لغوية جديدة.`,
      `سأعرض بطاقات كلمات مبعثرة وأسأل: «هل نستطيع أن نصنع منها جملة؟» ثم أربط ذلك بدرس «${topic}».`,
    ],
    letters: [
      `سأنطق ثلاث كلمات فيها الصوت نفسه وأسأل: «ما الصوت الذي يتكرّر؟» ثم سأعلن حرف اليوم.`,
      `سأعرض صورة شيء يبدأ اسمه بصوت الحرف وأسأل: «ما اسمه؟ وبأيّ صوت يبدأ؟»`,
    ],
  };
  const en: Partial<Record<LessonType, string[]>> = {
    hadith: [
      `Open with: “Who would like to be like the Prophet (peace be upon him)?” Then tell students they will learn a hadith today that guides us to a good deed, in “${topic}”.`,
      `Tell a short story about a child who needs advice and ask: “What would you advise them?” Then say today’s hadith carries the advice.`,
    ],
    creed: [
      `Ask: “What blessings of Allah do we see around us?” Note their answers and link them to “${topic}”.`,
      `Show a picture from nature and ask: “Who created this? How do we feel when we look at it?” Then announce the lesson “${topic}”.`,
    ],
    worship: [
      `Ask: “What do we do before we pray? Who taught us?” Take short answers, then say we will learn “${topic}” step by step.`,
      `Show the book’s picture of a child performing the act of worship and ask: “What are they doing? What will they do next?”`,
    ],
    sira: [
      `Ask: “Who likes stories? Today I will tell you a true one.” Then show a picture from the book and ask: “What do you think it is about?”`,
      `Write “${topic}” on the board and ask: “What do we know about this?” Then say we will learn the story as the book tells it.`,
    ],
    conduct: [
      `Show a picture from the book of a moment in children’s lives and ask: “What do you see? What would you have done?” Then link the answers to “${topic}”.`,
      `Ask: “What do we do that makes our family and friends happy?” Note three answers, then announce “${topic}”.`,
    ],
    music: [
      `Start with an echo game: clap a short pattern for students to copy, then say we will meet “${topic}” today.`,
      `Play two different sounds and ask: “What is the difference?” Then link their answers to “${topic}”.`,
    ],
    drama: [
      `Come in as a character from a story and say one line in a different voice, then ask: “Who am I, and how did you know?” Link it to “${topic}”.`,
      `Ask: “Who has seen a play? What did you see on the stage?” Note the answers, then say we will try “${topic}” today.`,
    ],
    listening: [
      `Start with a minute of silence while students listen to the sounds around them, then ask: “What did you hear?” Say we will practise listening today.`,
      `Show a picture from the unit and ask: “What do you think we will hear about it?” Note the predictions to come back to after listening.`,
    ],
    speaking: [
      `Ask a question close to students’ lives about the unit’s theme, take two or three answers, then say everyone will speak today.`,
      `Show the book’s speaking picture and have students say one word it brings to mind; write the words up to help us talk.`,
    ],
    writing: [
      `Write two similar words on the board, one with a mistake, and ask: “Which is right, and why?” Then announce today’s writing focus.`,
      `Show a sentence from the unit’s text and ask: “What do you notice about how this word is written?” Then link it to “${topic}”.`,
    ],
    language: [
      `Say two sentences from the unit’s text with a small difference and ask: “What changed?” Then say we will discover a new language feature today.`,
      `Show scattered word cards and ask: “Can we make a sentence from these?” Then link it to “${topic}”.`,
    ],
    letters: [
      `Say three words with the same sound and ask: “Which sound repeats?” Then announce today’s letter.`,
      `Show a picture of something whose name starts with the letter’s sound and ask: “What is it called? Which sound does it start with?”`,
    ],
  };
  return (lang === 'ar' ? ar : en)[type] ?? null;
}

/**
 * Homework a child in Grades 1–3 can do in ten minutes with someone at home:
 * one short task, oral or hands-on, and at most a sentence or two of writing.
 * (Grade 2 maths plans used to ask for «ملخصًا شخصيًا من 10 جمل».)
 */
export function typedEarlyHomework(type: LessonType, topic: string, lang: 'ar' | 'en'): string[] {
  const ar: Record<LessonType, string[]> = {
    quran: ['اقرأ ما تعلّمناه من السورة لأحد أفراد أسرتك ثلاث مرات، واطلب منه أن يستمع إليك.', 'استمع إلى السورة مرتين مع أحد أفراد أسرتك، ثم ردّدها معه.'],
    hadith: ['ردّد الحديث لأحد أفراد أسرتك، وأخبره بعمل واحد ستفعله بسببه.', 'ارسم نفسك وأنت تعمل بما يدعو إليه الحديث، واكتب تحت الرسم كلمة واحدة.'],
    creed: [`أخبر أحد أفراد أسرتك بما تعلّمته في درس «${topic}».`, 'ارسم نعمة واحدة من نِعم الله تراها في بيتك، واكتب اسمها تحت الرسم.'],
    worship: ['أدِّ الخطوات التي تعلّمناها أمام أحد أفراد أسرتك، واطلب منه أن يتابعك.', 'رتّب صور الخطوات في كتابك، وقلها بترتيبها لأحد أفراد أسرتك.'],
    sira: [`احكِ قصة «${topic}» لأحد أفراد أسرتك في ثلاث جمل.`, 'أخبر أسرتك بالحدث الذي أحببته من القصة، ولماذا أحببته.'],
    conduct: [`افعل في بيتك عملًا واحدًا تعلّمته في درس «${topic}»، وأخبر معلّمك به في الحصة القادمة.`, 'ارسم نفسك وأنت تقوم بالسلوك الجميل الذي تعلّمته اليوم.'],
    'visual-art': ['أكمل رسمتك في البيت، وأحضرها إلى الصف.', `ابحث في بيتك عن شيء يذكّرك بدرس «${topic}»، وأخبر صفّك عنه.`],
    music: ['صفّق الإيقاع الذي تعلّمناه لأحد أفراد أسرتك، واطلب منه أن يقلّدك.', 'ابحث في بيتك عن شيئين يصدران صوتين مختلفين، وأحضر واحدًا منهما إن استطعت.'],
    drama: ['مثّل لأسرتك مشهدًا قصيرًا يطبّق ما تعلّمناه اليوم.', 'اختر شخصية تحبّها، وقل جملة واحدة بصوتها أمام أسرتك.'],
    listening: ['استمع إلى قصة قصيرة يرويها لك أحد أفراد أسرتك، ثم أخبره بحدثين منها.', 'أخبر أحد أفراد أسرتك بما سمعته اليوم في الصف.'],
    speaking: ['تحدّث مع أحد أفراد أسرتك دقيقة واحدة عن صورة الدرس.', 'اسأل أحد أفراد أسرتك سؤالًا عن موضوع الوحدة، واستمع إلى إجابته.'],
    reading: ['اقرأ نص الدرس بصوت واضح لأحد أفراد أسرتك.', 'اقرأ النص مرة، ثم أخبر أسرتك بما أعجبك فيه.'],
    writing: ['اكتب ثلاث كلمات من كتابك تطبّق ما تعلّمناه اليوم.', 'اكتب كلمتين تعلّمتهما اليوم، وارسم شيئًا يدلّ على إحداهما.'],
    language: ['قل لأحد أفراد أسرتك جملتين على النمط الذي تعلّمناه اليوم.', 'اكتب جملة واحدة على النمط الذي تعلّمناه اليوم.'],
    letters: ['اكتب الحرف سطرًا واحدًا في دفترك.', 'ابحث في بيتك عن شيئين في اسميهما صوت الحرف، وقلهما لأسرتك.'],
  };
  const en: Record<LessonType, string[]> = {
    quran: ['Read what we learned of the surah to a family member three times, and ask them to listen.', 'Listen to the surah twice with a family member, then repeat it with them.'],
    hadith: ['Repeat the hadith to a family member and tell them one thing you will do because of it.', 'Draw yourself doing what the hadith asks, and write one word under the drawing.'],
    creed: [`Tell a family member what you learned in “${topic}”.`, 'Draw one blessing of Allah you see at home, and write its name under it.'],
    worship: ['Perform the steps we learned for a family member and ask them to watch.', 'Put the step pictures in your book in order, and say them in order to a family member.'],
    sira: [`Tell the story of “${topic}” to a family member in three sentences.`, 'Tell your family about the event you liked best in the story, and why.'],
    conduct: [`At home, do one thing you learned in “${topic}”, and tell your teacher about it next lesson.`, 'Draw yourself doing the good behaviour you learned today.'],
    'visual-art': ['Finish your drawing at home and bring it to class.', `Find something at home that reminds you of “${topic}” and tell the class about it.`],
    music: ['Clap the rhythm we learned for a family member and ask them to copy it.', 'Find two things at home that make different sounds, and bring one if you can.'],
    drama: ['Act a short scene for your family that uses what we learned today.', 'Choose a character you like and say one line in their voice for your family.'],
    listening: ['Listen to a short story from a family member, then tell them two things that happened in it.', 'Tell a family member what you heard in class today.'],
    speaking: ['Talk with a family member for one minute about the lesson’s picture.', 'Ask a family member a question about the unit’s theme and listen to the answer.'],
    reading: ['Read the lesson’s text aloud to a family member.', 'Read the text once, then tell your family what you liked about it.'],
    writing: ['Write three words from your book that follow today’s rule.', 'Write two words you learned today and draw something for one of them.'],
    language: ['Say two sentences on today’s pattern to a family member.', 'Write one sentence on the pattern we learned today.'],
    letters: ['Write one line of the letter in your book.', 'Find two things at home whose names have the letter’s sound, and say them to your family.'],
  };
  return (lang === 'ar' ? ar : en)[type];
}
