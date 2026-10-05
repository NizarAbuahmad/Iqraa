/**
 * The direct-instruction plan for each kind of lesson that is not mathematics.
 *
 * `direct` is the style a plan gets by default, and it used to be the same
 * worked-example routine for every subject. Here each kind gets the routine its
 * subject is actually taught with — observe-then-explain, read-recite-
 * understand, present-practise-produce, analyse-a-source, demonstrate-drill-
 * play, demonstrate-make-review. Mathematics keeps `directAr/En` in
 * `lessonPlanBlueprints.ts`.
 *
 * Nothing here states subject content (no ruling, date, formula or rule): it
 * is teaching method, built from the lesson's own concepts and title.
 */
import {
  conceptList, firstConcept, fromDoc, phaseMinutes,
  type LessonStyleBlueprint, type LessonStyleContext,
} from './lessonPlanTypes.ts';
import { sciencePlanHasCalculations, type LessonKind } from './lessonPlanKinds.ts';

type Builder = (ctx: LessonStyleContext) => LessonStyleBlueprint;
const m = phaseMinutes;

// ─── Arabic ──────────────────────────────────────────────────────────────────

const scienceAr: Builder = ctx => {
  const c0 = firstConcept(ctx);
  const list = conceptList(ctx, 3);
  const calc = sciencePlanHasCalculations(ctx.subjectId)
    ? '\n• إن تضمّن الدرس حسابًا فحلّ مثالًا واحدًا على السبورة ووضّح الوحدات في كل خطوة.'
    : '';
  return {
    materials: ['الكتاب المدرسي (صور الدرس ورسوماته)', 'عيّنة أو أداة أو صورة لعرض الظاهرة', 'ورقة ملاحظات من عمودين: «ما لاحظت» و«ما استنتجت»', 'السبورة وأقلام ملوّنة'],
    mainActivity: `(${m(ctx, 0.3)}) – ملاحظة ثم تفسير${fromDoc(ctx)}:\n\n1. اعرض الظاهرة أو العيّنة أو الصورة المرتبطة بـ«${c0}» دون أن تشرحها، واطلب من الطلبة تسجيل ما يلاحظونه فقط.\n2. اسأل: «ماذا لاحظتم؟ ماذا تتوقعون أن يحدث إذا تغيّر الشرط؟» وسجّل التوقعات على السبورة.\n3. فسّر المفاهيم بالترتيب${list ? `: ${list}` : ''}، واربط كل مفهوم بما شاهده الطلبة.\n4. إن احتاج العرض إلى مواد أو أدوات فراجع قواعد السلامة قبل البدء.`,
    guidedPractice: `(${m(ctx, 0.22)}) – نلاحظ ونفسّر معًا:\n\n• يملأ الطلبة عمود «ما لاحظت» ثم يقارنون ملاحظاتهم بملاحظات الصف.\n• ميّز مع الصف بين الملاحظة (ما نراه) والاستنتاج (ما نفسّر به ما نراه).\n• اسأل عن كل تفسير: «ما الدليل الذي يدعمه؟»\n• صحّح المفاهيم الخاطئة الشائعة فور ظهورها، واطلب من الطالب إعادة صياغة التفسير بكلماته.${calc}`,
    independentPractice: `(${m(ctx, 0.18)}) – أنت تفسّر:\n\n• اعرض ظاهرة أو صورة جديدة تشبه ما سبق دون مناقشتها.\n• يكتب كل طالب بمفرده: ماذا يلاحظ، وما تفسيره، وما دليله (جملة تبدأ بـ«لأن…»).\n• يجوز الرجوع إلى ورقة الملاحظات.\n• من ينهي مبكرًا يتنبأ بما سيحدث لو تغيّر متغير واحد ويبرّر توقعه.`,
    assessment: `تكويني: راجع عمود «ما استنتجت» — هل هو مبنيّ على ما لوحظ أم على ما حفظه الطالب فقط؟\nختامي: صحّح ورقة التفسير الفردية؛ الاستنتاج المدعوم بدليل يُحتسب أكثر من إجابة صحيحة بلا تبرير.\nبطاقة خروج: ظاهرة من حياتك تفسّرها فكرة اليوم.`,
    differentiation: `دعم: جدول ملاحظة جاهز، وبدايات جمل جاهزة («لاحظت أن…»، «لأن…»)، وصورة واحدة أوضح بدل عدة صور.\nتحدٍّ: تصميم تجربة مضبوطة تغيّر متغيرًا واحدًا فقط وتحدّد ما سيُقاس.\nالمبدأ: الجميع يلاحظ ويفسّر — التمايز في مقدار السقالة وتعقيد الظاهرة، لا في من يُسمح له بالتفكير.`,
  };
};

const recitationAr: Builder = ctx => {
  const list = conceptList(ctx, 4);
  return {
    materials: ['الكتاب المدرسي (النص المقرر)', 'بطاقة بالنص مكتوبة بخط واضح ومشكولة لكل طالب أو لوحة عرض', 'بطاقة معاني المفردات', 'ورقة «كيف أطبّق ما تعلّمت؟»'],
    mainActivity: `(${m(ctx, 0.3)}) – العرض والتلاوة والفهم${fromDoc(ctx)}:\n\n1. اتلُ الآيات (أو اقرأ الحديث أو القصة) قراءة واضحة، مرتّلًا الآيات إن كان الدرس قرآنًا، والطلبة يتابعون بأعينهم دون أن يقرؤوا معك.\n2. يردّد الطلبة بعدك جماعيًا ثم فرديًا، وتُصحَّح الأخطاء بهدوء ودون إحراج.\n3. اشرح الكلمات الجديدة بمعانيها من الكتاب${list ? `: ${list}` : ''}، ثم اسأل: «ما الذي يرشدنا إليه هذا الدرس؟»\n4. اكتب الفكرة الرئيسة والقيمة المستفادة بجملة واحدة على السبورة.`,
    guidedPractice: `(${m(ctx, 0.22)}) – نُتقن ونفهم معًا:\n\n• يقرأ الطلبة في ثنائيات: يقرأ الأول والثاني يتابع ويصحّح بلطف، ثم يتبادلان.\n• أسئلة فهم متدرجة: ما معنى الكلمة؟ ما الفكرة الرئيسة؟ ما العمل الذي يطلبه منّا الدرس؟\n• ربط بالحياة: «في أي موقف من يومك يمكنك أن تطبّق ذلك؟»\n• إن كان النص مما يُحفظ فقسّمه إلى مقاطع قصيرة، وكرّر كل مقطع قبل الانتقال إلى الذي يليه.`,
    independentPractice: `(${m(ctx, 0.18)}) – أُتقن وأطبّق بمفردي:\n\n• يراجع كل طالب المقطع المقرر بصوت منخفض، ثم يسمّعه للمعلم أو لزميل متقن (واحدًا في كل مرة بينما يعمل الباقون).\n• يكتب أو يرسم موقفًا من حياته يطبّق فيه القيمة المستفادة.\n• من ينهي مبكرًا يشرح معنى المقطع لزميله بكلماته.`,
    assessment: `تكويني: أنصت إلى سلامة النطق والأداء لا إلى السرعة، وسجّل من يحتاج مقطعًا أقصر في الحصة القادمة.\nختامي: تسميع فردي هادئ لما قُرّر حفظه، وسؤالان عن المعنى والقيمة.\nيُراعى حال كل طالب: تقدّمه عن نقطة بدايته أهم من مقارنته بزملائه.\nبطاقة خروج: القيمة التي سأطبّقها اليوم هي…`,
    differentiation: `دعم: مقاطع أقصر، وتكرار مع زميل متقن، وبطاقة بالنص بحجم أكبر.\nتحدٍّ: شرح المعنى بكلماته، أو ربط ما تعلّمه بآية أو حديث آخر مناسب من المقرر، أو قيادة مجموعة التسميع.\nالمبدأ: يتقدّم كل طالب من حيث هو — لا يُحرَج من يتعثر ولا يُهمَل من يتقن.`,
  };
};

const arabicAr: Builder = ctx => {
  const list = conceptList(ctx, 3);
  return {
    materials: ['الكتاب المدرسي (نص الدرس)', 'بطاقات المفردات الجديدة', 'السبورة وأقلام ملوّنة', 'ورقة كتابة قصيرة'],
    mainActivity: `(${m(ctx, 0.3)}) – نموذج القراءة والفهم${fromDoc(ctx)}:\n\n1. اقرأ النص أو الجمل قراءة معبّرة بصوت واضح، ثم يقرأ الطلبة بعدك مقطعًا بعد مقطع.\n2. استخرج الكلمات الجديدة واشرحها من السياق أولًا: «ماذا تظنون أنها تعني، ولماذا؟»\n3. اطرح أسئلة فهم من السهل إلى العميق: الفكرة الرئيسة، ثم التفاصيل، ثم «ما رأيكم؟»\n4. ${list ? `ناقش ما ورد من مفاهيم: ${list}، واكتب مثالًا من النص على السبورة` : 'حدّد مهارة اللغة المقصودة في الدرس (استماع، تحدّث، قراءة، كتابة) واكتب مثالًا من النص على السبورة'}. وإن كان الدرس لغويًا فاعرض أمثلة من النص واطلب من الطلبة استخراج القاعدة بأنفسهم ثم صغها معهم.`,
    guidedPractice: `(${m(ctx, 0.22)}) – نقرأ ونوظّف معًا:\n\n• قراءة ثنائية: يقرأ كل طالب لزميله ويصحّح له نطقه بلطف.\n• يصوغ الطلبة جملًا شفوية تستعمل كل كلمة جديدة في سياقها، ويصحّح الصف الجمل معًا.\n• اكتب جملة فيها خطأ شائع (دون ذكر صاحبه) واطلب من الطلبة إصلاحها.`,
    independentPractice: `(${m(ctx, 0.18)}) – أكتب بمفردي:\n\n• يكتب كل طالب فقرة قصيرة (٤–٥ جمل) أو تمرينًا لغويًا يوظّف فيه ما تعلّمه.\n• يقرأ فقرته بصوت منخفض قبل التسليم ليكتشف أخطاءه بنفسه.\n• من ينهي مبكرًا يضيف جملة تستعمل كلمة جديدة بمعنى آخر.`,
    assessment: `تكويني: راقب القراءة (الطلاقة والنطق) وتوظيف الكلمات الجديدة في الجمل.\nختامي: صحّح الفقرة أو التمرين الفردي بمعايير واضحة: سلامة اللغة، وضوح الفكرة، توظيف المفردات.\nبطاقة خروج: جملة تستعمل فيها أهم كلمة تعلّمتها اليوم.`,
    differentiation: `دعم: نص أقصر، وبدايات جمل جاهزة، وقراءة مع زميل قبل القراءة المنفردة.\nتحدٍّ: كتابة فقرة بأسلوب مختلف (وصف، حوار، رسالة) أو استبدال كلمة بمرادفها وشرح الفرق.\nالمبدأ: القراءة والكتابة مهارتان تُبنيان بالممارسة — يتغيّر طول النص ومقدار الدعم، لا الفرصة.`,
  };
};

const englishAr: Builder = ctx => {
  const list = conceptList(ctx, 3);
  return {
    materials: ['الكتاب المدرسي', 'صور أو بطاقات مفردات', 'بطاقات أدوار للحوار الثنائي', 'ورقة قصيرة لمهمة الإنتاج'],
    mainActivity: `(${m(ctx, 0.3)}) – العرض (Present)${fromDoc(ctx)}:\n\n1. قدّم اللغة الجديدة في سياق (صورة أو إيماءة أو حوار قصير) قبل أن تكتبها على السبورة.\n2. انطق كل عنصر مرتين أو ثلاثًا؛ يردّد الطلبة جماعيًا، ثم في مجموعات صغيرة، ثم فرديًا.\n3. تحقّق من الفهم لا من النطق فقط: أسئلة قصيرة، تمثيل بالإيماء، ولا تلجأ إلى الترجمة إلا في آخر المطاف.\n4. اكتب الصيغة المستهدفة ومثالًا واحدًا على السبورة${list ? ` (${list})` : ''}.`,
    guidedPractice: `(${m(ctx, 0.22)}) – التدريب الموجّه (Practise):\n\n• تدريب ثنائي: الأول يسأل والثاني يجيب ثم يتبادلان الدور.\n• نشاط فجوة معلومات أو مطابقة بطاقات.\n• أنصت وسجّل الأخطاء الشائعة لتصحيحها بعد النشاط لا أثناءه، ثم عالجها أمام الصف دون ذكر الأسماء.`,
    independentPractice: `(${m(ctx, 0.18)}) – الإنتاج (Produce):\n\n• مهمة قصيرة يتحدث فيها الطالب أو يكتب عن نفسه أو عن أسرته مستعملًا اللغة الجديدة.\n• يستعد كل طالب دقيقتين ثم يعرض ما أعدّه على زميله، وتتجوّل لتسمع.\n• من ينهي مبكرًا يضيف سؤالًا أو سببًا لإطالة إجابته.`,
    assessment: `تكويني: راقب الدقة أثناء التدريب الثنائي، والطلاقة والتواصل أثناء الإنتاج.\nختامي: مهمة الإنتاج الفردية بمعايير: الدقة، الوضوح، استعمال اللغة المستهدفة.\nبطاقة خروج: جملة واحدة تستعمل فيها اللغة التي تعلمتها اليوم.`,
    differentiation: `دعم: قوالب جمل وصور مساعدة، ومفردات مكتوبة أمام الطالب.\nتحدٍّ: إضافة سؤال متابعة أو سبب أو مقارنة، أو تأليف حوار قصير.\nالمبدأ: الجميع يتكلم ويكتب — يتغيّر مقدار الدعم لا عدد فرص الكلام.`,
  };
};

const socialAr: Builder = ctx => {
  const list = conceptList(ctx, 3);
  return {
    materials: ['الكتاب المدرسي (نصوص ومصادر الدرس)', 'خريطة أو صورة أو خط زمني من الدرس', 'بطاقات أسئلة: ماذا؟ متى؟ أين؟ لماذا؟ وما النتيجة؟', 'السبورة وأقلام ملوّنة'],
    mainActivity: `(${m(ctx, 0.3)}) – تحليل مصدر وبناء الفهم${fromDoc(ctx)}:\n\n1. اعرض مصدر الدرس (نصًّا قصيرًا أو خريطة أو صورة أو خطًّا زمنيًّا) واطلب من الطلبة وصف ما يرونه دون تفسير.\n2. وجّه الأسئلة: ماذا حدث؟ أين ومتى؟ مَن المعنيّون؟ لماذا حدث؟ وما نتائجه؟\n3. ${list ? `ناقش المفاهيم الواردة: ${list}` : 'ناقش المفاهيم الأساسية في الدرس'}، ودوّن الأسباب والنتائج في مخطط على السبورة.\n4. ثبّت الفكرة بخريطة أو خط زمني يبنيه الصف معًا.`,
    guidedPractice: `(${m(ctx, 0.22)}) – نحلّل ونستدلّ معًا:\n\n• في ثنائيات: يستخرج كل ثنائي سببًا ونتيجة من المصدر ويسندهما بعبارة منه.\n• نقاش موجّه: اعرض رأيين محتملين واطلب من كل طالب أن يختار أحدهما ويدعمه بدليل من الدرس.\n• ذكّر بآداب الحوار: نستمع أولًا، ثم نعترض بالدليل لا برفع الصوت.`,
    independentPractice: `(${m(ctx, 0.18)}) – أحلّل بمفردي:\n\n• يكمل كل طالب مخططًا فرديًا (سبب ← حدث ← نتيجة)، أو يرتّب الأحداث على خط زمني، أو يوقّع المعالم على خريطة صمّاء.\n• يكتب فقرة قصيرة تجيب عن «لماذا؟» مستندًا إلى دليل واحد على الأقل من الدرس.\n• من ينهي مبكرًا يقارن بين حدثين أو منطقتين في جدول.`,
    assessment: `تكويني: ميّز بين من يذكر المعلومة ومن يفسّر السبب ويدعمه بدليل.\nختامي: صحّح المخطط والفقرة الفردية بمعايير: دقة المعلومة، سلامة السبب والنتيجة، الاستدلال بدليل.\nبطاقة خروج: سبب واحد ونتيجة واحدة من درس اليوم.`,
    differentiation: `دعم: مخطط جاهز نصفه مكتوب، وأسئلة موجّهة، ومصدر أقصر.\nتحدٍّ: مقارنة مصدرين، أو تقييم أي السببين كان أقوى ولماذا.\nالمبدأ: الجميع يستدلّ بالدليل — يتغيّر طول المصدر ومقدار الدعم، لا الحق في إبداء الرأي.`,
  };
};

const movementAr: Builder = ctx => ({
  materials: ['الملعب أو القاعة بعد التحقق من خلوها من العوائق', 'أدوات الدرس (كرات، أقماع، حبال… حسب المهارة)', 'بطاقة نقاط الأداء لكل ثنائي', 'صفّارة وساعة توقيت'],
  mainActivity: `(${m(ctx, 0.3)}) – إحماء ثم عرض المهارة${fromDoc(ctx)}:\n\n1. إحماء عام ثم خاص بالمهارة: جري خفيف وإطالة ديناميكية للعضلات التي ستعمل.\n2. اشرح مهارة «${ctx.topic}» وأهميتها، وراجع قواعد السلامة والمسافات بين المجموعات قبل أي حركة.\n3. اعرض المهارة كاملة بسرعتها الطبيعية، ثم أعدها ببطء مقسّمة إلى أجزاء مع تسمية أهم ثلاث نقاط أداء.\n4. يجرّب الطلبة الحركة بلا أدوات أو بأدوات خفيفة وأنت تتجوّل وتصحّح.`,
  guidedPractice: `(${m(ctx, 0.22)}) – تدريب موجّه في محطات:\n\n• وزّع الطلبة على محطات صغيرة، في كل محطة تدريب على جزء من المهارة.\n• في كل محطة ثنائي: منفّذ ومراقب يملأ بطاقة نقاط الأداء، ثم يتبادلان.\n• تغذية راجعة قصيرة ومحددة: «ما أتقنته…، ولكي تتحسّن افعل…»\n• أوقف النشاط فورًا عند أي خطر.`,
  independentPractice: `(${m(ctx, 0.18)}) – تطبيق في لعبة أو موقف أداء:\n\n• لعبة صغيرة أو مسار أداء يوظّف المهارة، بمجموعات متقاربة المستوى.\n• يقيّم كل طالب نفسه بنقاط الأداء ويضع هدفًا واحدًا للحصة القادمة.\n• من يتقن مبكرًا يرفع التحدي (مسافة أبعد، سرعة أعلى، أو دور المراقب).\n• اختم بتهدئة وإطالة.`,
  assessment: `تكويني: راقب نقاط الأداء الثلاث أثناء المحطات وسجّل من يحتاج عرضًا فرديًا.\nختامي: قائمة رصد للأداء (التنفيذ، الدقة، السلامة، التعاون) لا النتيجة وحدها.\nبطاقة خروج: نقطة أداء أتقنتها وأخرى سأحسّنها.`,
  differentiation: `دعم: أدوات أخف أو أكبر، ومسافة أقصر، وزمن أطول لكل محاولة، وزميل مراقب يشجّع.\nتحدٍّ: مسافة أبعد أو سرعة أعلى أو قرار يُتَّخذ أثناء الأداء.\nالمبدأ: الجميع يتحرك ويتقدم — يُقاس تحسّن كل طالب عن نفسه.\nمراعاة صحية: من لديه إعفاء طبي يؤدي دور المراقب أو الحَكَم.`,
});

const makingAr: Builder = ctx => {
  const list = conceptList(ctx, 3);
  return {
    materials: ['أدوات الدرس ومواده (حسب النشاط)', 'نموذج منجز يعرضه المعلم', 'بطاقة معايير جودة العمل', 'مساحة عمل لكل طالب أو مجموعة'],
    mainActivity: `(${m(ctx, 0.3)}) – عرض النموذج والتقنية${fromDoc(ctx)}:\n\n1. اعرض نموذجًا منجزًا للعمل المطلوب في «${ctx.topic}» واسأل: «ماذا تلاحظون؟ كيف صُنع برأيكم؟»\n2. اعرض الخطوات الأساسية أمام الطلبة وفكّر بصوت عالٍ عند كل قرار تتخذه.\n3. ثبّت ${list ? `المفاهيم والمصطلحات: ${list}` : 'المصطلحات والأدوات الأساسية'} على السبورة.\n4. راجع قواعد السلامة وتنظيم الأدوات قبل أن يبدأ أحد العمل.`,
    guidedPractice: `(${m(ctx, 0.22)}) – نصنع معًا خطوة بخطوة:\n\n• ينفّذ الطلبة الخطوتين الأولى والثانية بالتزامن مع عرضك وأنت تتجوّل وتصحّح.\n• نقطة توقّف بعد كل خطوة: يقارن الطالب عمله ببطاقة المعايير.\n• شجّع التجريب والخطأ البنّاء: «ماذا لو جرّبنا…؟»`,
    independentPractice: `(${m(ctx, 0.18)}) – أُنتج عملي الخاص:\n\n• يكمل كل طالب عمله بأسلوبه وفق المعايير، مع هامش واضح للاختيار والإبداع.\n• تتجوّل وتسأل أسئلة مفتوحة تحفّز التفكير ولا تعطي الحل: «كيف تخطّط للخطوة التالية؟»\n• في آخر الوقت «معرض مصغّر»: يعرض كل طالب عمله ويذكر قرارًا اتّخذه وسببه.`,
    assessment: `تكويني: راجع الأعمال أثناء الإنتاج مقابل بطاقة المعايير وسجّل الأخطاء المتكررة لتعالجها مع الصف.\nختامي: قيّم العمل بمعايير معلنة مسبقًا: إتقان التقنية، التنظيم، الإبداع، الالتزام بالسلامة.\nبطاقة خروج: ما الذي أفتخر به في عملي، وما الذي سأغيّره؟`,
    differentiation: `دعم: خطوات مصوّرة، وبطاقة معايير مبسّطة، وجزء جاهز يبدأ منه الطالب.\nتحدٍّ: عنصر إضافي أو شرط جديد، أو مساعدة زميل في خطوة.\nالمبدأ: لكل طالب عمله ومستواه — يتغيّر مقدار الدعم والتعقيد، لا فرصة الإنتاج.`,
  };
};

// ─── English ─────────────────────────────────────────────────────────────────

const scienceEn: Builder = ctx => {
  const c0 = firstConcept(ctx);
  const list = conceptList(ctx, 3);
  const calc = sciencePlanHasCalculations(ctx.subjectId)
    ? '\n• If the lesson includes a calculation, work one example on the board and show the units at every step.'
    : '';
  return {
    materials: ['Textbook (the lesson’s photographs and diagrams)', 'A sample, tool or picture to show the phenomenon', 'Notes sheet with two columns: “What I observed” and “What I concluded”', 'Board and coloured markers'],
    mainActivity: `(${m(ctx, 0.3)}) – Observe, then explain${fromDoc(ctx)}:\n\n1. Show the phenomenon, sample or picture linked to “${c0}” without explaining it, and ask students to record only what they observe.\n2. Ask: “What did you notice? What do you predict if the condition changes?” Write the predictions on the board.\n3. Explain the concepts in order${list ? `: ${list}` : ''}, tying each to what students saw.\n4. If the demonstration needs materials or equipment, review the safety rules before starting.`,
    guidedPractice: `(${m(ctx, 0.22)}) – Observe and explain together:\n\n• Students fill in “What I observed”, then compare with the class.\n• Separate observation (what we see) from conclusion (what we explain it with).\n• For every explanation ask: “What evidence supports it?”\n• Correct common misconceptions the moment they appear, and have the student restate the explanation in their own words.${calc}`,
    independentPractice: `(${m(ctx, 0.18)}) – You explain:\n\n• Show a new phenomenon or picture like the last one, without discussing it first.\n• Each student writes alone: what they observe, their explanation, and their evidence (a sentence starting “because…”).\n• Students may use their notes sheet.\n• Early finishers predict what would happen if one factor changed, and justify it.`,
    assessment: `Formative: check the “What I concluded” column — is it built on what was observed, or only on what the student memorised?\nSummative: mark the individual explanation sheet; a conclusion backed by evidence counts for more than a correct answer with no reasoning.\nExit ticket: a phenomenon from your life that today’s idea explains.`,
    differentiation: `Support: a ready-made observation table, sentence starters (“I noticed that…”, “because…”), and one clearer picture instead of several.\nStretch: design a fair test that changes only one factor and says what will be measured.\nThe principle: everyone observes and explains — differentiate the scaffold and the complexity of the phenomenon, never who is allowed to think.`,
  };
};

const recitationEn: Builder = ctx => {
  const list = conceptList(ctx, 4);
  return {
    materials: ['Textbook (the set text)', 'A card with the text in a clear, vowelled script for each student, or a display board', 'Vocabulary-meaning card', 'A “How do I apply what I learned?” sheet'],
    mainActivity: `(${m(ctx, 0.3)}) – Presenting, reciting and understanding${fromDoc(ctx)}:\n\n1. Read the set text (the verses, hadith or story) clearly and in measured recitation while students follow with their eyes, without reading along.\n2. Students repeat after you, first together and then one at a time; correct mistakes calmly and without embarrassment.\n3. Explain the new words using the textbook’s meanings${list ? `: ${list}` : ''}, then ask: “What is this text calling us to do?”\n4. Write the main idea and the value to take from it in one sentence on the board.`,
    guidedPractice: `(${m(ctx, 0.22)}) – Perfecting and understanding together:\n\n• Students read in pairs: one reads, the other follows and corrects kindly, then they swap.\n• Graduated comprehension questions: what does the word mean? what is the main idea? what does the lesson ask of us?\n• Link to life: “In what situation today could you apply this?”\n• If the text is to be memorised, split it into short sections and repeat each before moving to the next.`,
    independentPractice: `(${m(ctx, 0.18)}) – Mastering and applying alone:\n\n• Each student reviews the set section quietly, then recites it to you or to a classmate who knows it (one at a time while the rest work).\n• Each writes or draws a situation from their own life where they apply the value learned.\n• Early finishers explain the meaning of the section to a classmate in their own words.`,
    assessment: `Formative: listen for accuracy and soundness of delivery, not speed, and note who needs a shorter section next lesson.\nSummative: quiet individual recitation of what was set for memorising, plus two questions on meaning and value.\nConsider each student’s starting point: progress matters more than comparison with classmates.\nExit ticket: The value I will apply today is…`,
    differentiation: `Support: shorter sections, repetition with a classmate who knows it, and a larger card of the text.\nStretch: explain the meaning in their own words, link the text to another suitable text in the syllabus, or lead a recitation group.\nThe principle: every student progresses from where they are — no one who struggles is embarrassed and no one who excels is overlooked.`,
  };
};

const arabicEn: Builder = ctx => {
  const list = conceptList(ctx, 3);
  return {
    materials: ['Textbook (the lesson text)', 'New-vocabulary cards', 'Board and coloured markers', 'A short writing sheet'],
    mainActivity: `(${m(ctx, 0.3)}) – Model reading and comprehension${fromDoc(ctx)}:\n\n1. Read the text or sentences expressively and clearly, then students read after you, section by section.\n2. Pull out the new words and explain them from context first: “What do you think it means, and why?”\n3. Ask comprehension questions from easy to deep: main idea, then details, then “What do you think?”\n4. ${list ? `Discuss the concepts that come up: ${list}, and write an example from the text on the board` : 'Name the language skill the lesson targets (listening, speaking, reading, writing) and write an example from the text on the board'}. If it is a language lesson, show examples from the text and have students find the rule themselves before you word it with them.`,
    guidedPractice: `(${m(ctx, 0.22)}) – Read and use together:\n\n• Paired reading: each student reads to a partner and corrects their pronunciation kindly.\n• Students compose spoken sentences using each new word in context, and the class corrects them together.\n• Write a sentence with a common error (no names) and have students fix it.`,
    independentPractice: `(${m(ctx, 0.18)}) – Write alone:\n\n• Each student writes a short paragraph (4–5 sentences) or a language exercise that uses what they learned.\n• They read their paragraph quietly before handing it in, to catch their own errors.\n• Early finishers add a sentence using a new word in a different sense.`,
    assessment: `Formative: watch reading (fluency and pronunciation) and use of the new words in sentences.\nSummative: mark the individual paragraph or exercise against clear criteria: language accuracy, clarity of idea, use of vocabulary.\nExit ticket: a sentence using the most important word you learned today.`,
    differentiation: `Support: a shorter text, sentence starters, and reading with a partner before reading alone.\nStretch: write in a different style (description, dialogue, letter), or replace a word with a synonym and explain the difference.\nThe principle: reading and writing are built by practice — change the length of the text and the amount of support, not the opportunity.`,
  };
};

const englishEn: Builder = ctx => {
  const list = conceptList(ctx, 3);
  return {
    materials: ['Textbook', 'Pictures or vocabulary cards', 'Role cards for pair dialogues', 'A short sheet for the production task'],
    mainActivity: `(${m(ctx, 0.3)}) – Present${fromDoc(ctx)}:\n\n1. Introduce the new language in context (a picture, a gesture or a short dialogue) before writing it on the board.\n2. Model each item two or three times; students repeat chorally, then in small groups, then individually.\n3. Check meaning, not just sound: short questions, miming, with translation as a last resort.\n4. Write the target form and one example on the board${list ? ` (${list})` : ''}.`,
    guidedPractice: `(${m(ctx, 0.22)}) – Practise:\n\n• Pair drills: A asks, B answers, then they swap.\n• An information-gap or card-matching activity.\n• Listen and note common errors to correct after the activity rather than during it, then deal with them in front of the class without names.`,
    independentPractice: `(${m(ctx, 0.18)}) – Produce:\n\n• A short task in which each student speaks or writes about themselves or their family using the new language.\n• Each prepares for two minutes, then performs for a partner while you circulate and listen.\n• Early finishers add a follow-up question or a reason to lengthen their answer.`,
    assessment: `Formative: monitor accuracy during pair practice, and fluency and communication during production.\nSummative: the individual production task against criteria: accuracy, clarity, use of the target language.\nExit ticket: one sentence using the language you learned today.`,
    differentiation: `Support: sentence frames, picture prompts, and the key words written in front of the student.\nStretch: add a follow-up question, a reason or a comparison, or write a short dialogue.\nThe principle: everyone speaks and writes — change the amount of support, not the number of chances to talk.`,
  };
};

const socialEn: Builder = ctx => {
  const list = conceptList(ctx, 3);
  return {
    materials: ['Textbook (the lesson’s texts and sources)', 'A map, picture or timeline from the lesson', 'Question cards: what? when? where? why? and what followed?', 'Board and coloured markers'],
    mainActivity: `(${m(ctx, 0.3)}) – Analyse a source and build understanding${fromDoc(ctx)}:\n\n1. Show the lesson’s source (a short text, map, picture or timeline) and ask students to describe what they see without interpreting.\n2. Guide with questions: what happened? where and when? who was involved? why did it happen? what followed?\n3. ${list ? `Discuss the concepts that come up: ${list}` : 'Discuss the lesson’s key concepts'}, and record causes and consequences in a diagram on the board.\n4. Fix the idea with a map or timeline the class builds together.`,
    guidedPractice: `(${m(ctx, 0.22)}) – Analyse and argue from evidence together:\n\n• In pairs: each pair pulls a cause and a consequence from the source and backs both with a phrase from it.\n• Guided discussion: put two possible views and have each student pick one and support it with evidence from the lesson.\n• Remind them of the manners of discussion: we listen first, then disagree with evidence, not volume.`,
    independentPractice: `(${m(ctx, 0.18)}) – Analyse alone:\n\n• Each student completes an individual diagram (cause → event → consequence), orders events on a timeline, or marks places on a blank map.\n• They write a short paragraph answering “why?” using at least one piece of evidence from the lesson.\n• Early finishers compare two events or two regions in a table.`,
    assessment: `Formative: tell apart who states a fact from who explains the cause and supports it with evidence.\nSummative: mark the diagram and paragraph against criteria: accuracy of information, soundness of cause and consequence, use of evidence.\nExit ticket: one cause and one consequence from today’s lesson.`,
    differentiation: `Support: a diagram that is half filled in, guiding questions, and a shorter source.\nStretch: compare two sources, or judge which of two causes was stronger and why.\nThe principle: everyone argues from evidence — change the length of the source and the amount of support, not the right to give an opinion.`,
  };
};

const movementEn: Builder = ctx => ({
  materials: ['The field or hall, checked clear of obstacles', 'Equipment for the lesson (balls, cones, ropes… as the skill needs)', 'A performance-points card for each pair', 'A whistle and a stopwatch'],
  mainActivity: `(${m(ctx, 0.3)}) – Warm-up, then demonstrate the skill${fromDoc(ctx)}:\n\n1. A general warm-up, then one specific to the skill: light jogging and dynamic stretches for the muscles that will work.\n2. Explain the skill “${ctx.topic}” and why it matters, and review the safety rules and the spacing between groups before anyone moves.\n3. Demonstrate the whole skill at normal speed, then again slowly in parts, naming the three most important performance points.\n4. Students try the movement without equipment or with light equipment while you circulate and correct.`,
  guidedPractice: `(${m(ctx, 0.22)}) – Guided practice in stations:\n\n• Split students into small stations, each practising one part of the skill.\n• In each station a pair: a performer and an observer who fills in the performance-points card, then they swap.\n• Short, specific feedback: “What you did well…, to improve, do…”\n• Stop the activity immediately at any sign of danger.`,
  independentPractice: `(${m(ctx, 0.18)}) – Apply in a game or performance task:\n\n• A small game or performance course that uses the skill, in groups of similar level.\n• Each student rates themselves on the performance points and sets one target for next lesson.\n• Those who master it early raise the challenge (greater distance, more speed, or the observer role).\n• Finish with a cool-down and stretching.`,
  assessment: `Formative: watch the three performance points during the stations and note who needs an individual demonstration.\nSummative: a performance checklist (execution, accuracy, safety, teamwork), not the result alone.\nExit ticket: one performance point I have mastered and one I will improve.`,
  differentiation: `Support: lighter or larger equipment, a shorter distance, more time per attempt, and a partner observer who encourages.\nStretch: greater distance or speed, or a decision to make during the performance.\nThe principle: everyone moves and improves — each student’s progress is measured against themselves.\nHealth note: a student with a medical exemption takes the observer or referee role.`,
});

const makingEn: Builder = ctx => {
  const list = conceptList(ctx, 3);
  return {
    materials: ['The lesson’s tools and materials (as the activity needs)', 'A finished model the teacher shows', 'A work-quality criteria card', 'A workspace for each student or group'],
    mainActivity: `(${m(ctx, 0.3)}) – Show the model and the technique${fromDoc(ctx)}:\n\n1. Show a finished example of the work required in “${ctx.topic}” and ask: “What do you notice? How do you think it was made?”\n2. Demonstrate the main steps in front of the class, talking aloud about each decision you make.\n3. Fix ${list ? `the concepts and terms: ${list}` : 'the key terms and tools'} on the board.\n4. Review the safety rules and how to organise the tools before anyone starts work.`,
    guidedPractice: `(${m(ctx, 0.22)}) – Make it together, step by step:\n\n• Students carry out the first and second steps as you demonstrate, while you circulate and correct.\n• A checkpoint after each step: the student compares their work with the criteria card.\n• Encourage trying things and productive mistakes: “What if we tried…?”`,
    independentPractice: `(${m(ctx, 0.18)}) – Make my own work:\n\n• Each student finishes their work in their own way against the criteria, with clear room for choice and creativity.\n• Circulate with questions that open thinking rather than give the answer: “How will you plan the next step?”\n• At the end, a mini-exhibition: each student shows their work and names one decision they made and why.`,
    assessment: `Formative: review work in progress against the criteria card and note repeated errors to address with the class.\nSummative: assess the work against criteria announced in advance: mastery of the technique, organisation, creativity, safety.\nExit ticket: what I am proud of in my work, and what I would change.`,
    differentiation: `Support: pictured steps, a simplified criteria card, and a ready-made part to start from.\nStretch: an extra element or a new constraint, or helping a classmate with a step.\nThe principle: every student has their own work and level — change the amount of support and complexity, not the chance to make something.`,
  };
};

// ─── Registry ────────────────────────────────────────────────────────────────

const NATIVE: Partial<Record<LessonKind, { ar: Builder; en: Builder }>> = {
  science: { ar: scienceAr, en: scienceEn },
  recitation: { ar: recitationAr, en: recitationEn },
  arabic: { ar: arabicAr, en: arabicEn },
  english: { ar: englishAr, en: englishEn },
  social: { ar: socialAr, en: socialEn },
  movement: { ar: movementAr, en: movementEn },
  making: { ar: makingAr, en: makingEn },
};

/** The kind's own direct plan, or null for `calc` (mathematics keeps the worked-example plan). */
export function nativeDirectBlueprint(ctx: LessonStyleContext): LessonStyleBlueprint | null {
  const entry = NATIVE[ctx.kind ?? 'calc'];
  return entry ? entry[ctx.lang](ctx) : null;
}
