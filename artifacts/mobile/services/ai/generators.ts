import {
  AIRequest, AIService, LessonPlanOutput,
  QuizOutput, QuizQuestion, WorksheetAnswerKeyItem,
  WorksheetOutput, WorksheetSection,
} from './AIService';
import { KBLesson, getUnitForLesson, searchKB } from '../knowledgeBase';

type Lang = 'ar' | 'en';
type QType = 'multiple_choice' | 'short_answer' | 'fill_blank' | 'true_false';
interface WQ { text: string; options?: string[]; answer: string; points: number }

// ─── Core helpers ─────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Place `correct` at a random position among the wrongs for MC questions */
function placeCorrect(correct: string, wrongs: string[]): string[] {
  const pos = Math.floor(Math.random() * (wrongs.length + 1));
  return [...wrongs.slice(0, pos), correct, ...wrongs.slice(pos)];
}

// ─── Lesson Plan helpers (Arabic) ────────────────────────────────────────────

function lpObjectivesAr(topic: string, kb: KBLesson | null, custom?: string): string[] {
  if (custom?.trim()) return custom.trim().split('\n').filter(Boolean);
  if (kb?.keyConceptsAr.length) {
    const c = kb.keyConceptsAr;
    return [
      `أن يُعرِّف الطالب ${c[0]}`,
      c[1] ? `أن يشرح الطالب ${c[1]} بأمثلة توضيحية` : `أن يطبق مفهوم ${topic} في حل مسائل متنوعة`,
      `أن يميّز الطالب بين المفاهيم الأساسية المرتبطة بـ${topic} ويقارن بينها`,
    ];
  }
  return [
    `أن يُعرِّف الطالب المفاهيم الأساسية لـ${topic}`,
    `أن يشرح الطالب تطبيقات ${topic} في الحياة اليومية`,
    `أن يحل الطالب مسائل متنوعة حول ${topic} بخطوات منهجية`,
  ];
}
function lpMaterialsAr(subject: string): string[] {
  const base = ['الكتاب المدرسي', 'السبورة والأقلام المتعددة الألوان', 'أوراق عمل مطبوعة'];
  if (/كيمياء|chem/i.test(subject)) return [...base, 'نماذج جزيئية ثلاثية الأبعاد', 'جهاز العرض والشاشة'];
  if (/رياضيات|math/i.test(subject)) return [...base, 'الآلة الحاسبة العلمية', 'ورق الرسم البياني'];
  return [...base, 'جهاز العرض والشاشة', 'بطاقات مفاهيم'];
}
function lpIntroAr(topic: string, kb: KBLesson | null): string {
  if (kb) return pick([
    `ابدأ بطرح السؤال: "أين نلتقي بـ${topic} في حياتنا اليومية؟" سجّل إجابات الطلاب على السبورة. اعرض صورة ذات صلة بـ${kb.titleAr} وناقش ما يرونه ثم ربط إجاباتهم بأهداف الدرس.`,
    `لعبة "ما أعرفه / ما أريد تعلّمه": يكتب الطلاب على ورقة ما يعرفونه عن ${kb.titleAr} (دقيقتان). تُشارك بعض الإجابات ثم يُحدد المعلم ما سنكتشفه معًا.`,
    `"التنبؤ والاستكشاف": اعرض موقفًا حياتيًا مرتبطًا بـ${topic} واطلب من الطلاب التنبؤ بالتفسير. استخدم تنبؤاتهم كنقطة انطلاق لأهداف الدرس.`,
  ]);
  return pick([
    `ابدأ بسؤال تحفيزي: "كيف يرتبط ${topic} بحياتنا اليومية؟" استمع لمشاركات 3-4 طلاب وسجّلها على السبورة، ثم ابنِ عليها مدخلًا للدرس.`,
    `"فكّر – زاوج – شارك": يفكر كل طالب 30 ثانية فيما يعرفه عن ${topic}، يشارك زميله، ثم تُطرح بعض الإجابات على الصف.`,
  ]);
}
function lpMainActivityAr(topic: string, kb: KBLesson | null, style: string, dur: number): string {
  const t = Math.round(dur * 0.3);
  const conceptLines = kb?.keyConceptsAr.slice(0, 3).map((c, i) => `${i + 1}. اشرح ${c} مع مثال مرئي واضح.`).join('\n')
    ?? `1. اشرح المفهوم الرئيسي لـ${topic}.\n2. قدّم 2-3 أمثلة متدرجة الصعوبة.\n3. اكتب الخطوات على السبورة مع التفكير الصوتي.`;
  if (style === 'inquiry') return `(${t} دقيقة) – تعلّم استقصائي:\n\n1. اطرح سؤال التحقيق: "كيف يعمل ${topic}؟"\n2. مجموعات ثلاثية تستكشف ${kb?.keyConceptsAr?.[0] ?? topic} باستخدام المصادر المتاحة.\n3. كل مجموعة تسجّل ملاحظاتها واستنتاجاتها.\n4. مناقشة صفية تبني فهمًا مشتركًا.`;
  if (style === 'collaborative') return `(${t} دقيقة) – تعلّم تعاوني (مجموعات 3-4):\n\n1. كل مجموعة تتلقى بطاقة مهمة تتناول جانبًا مختلفًا من ${topic}.\n2. يتعاون أفراد المجموعة لدراسة المهمة وإعداد عرض قصير.\n3. كل مجموعة تعرض إجابتها للصف (2 دقائق).\n4. المعلم يلخّص ويصحح المفاهيم الخاطئة.`;
  return `(${t} دقيقة) – شرح مباشر – نموذج "أنا أفعل":\n\n${conceptLines}`;
}
function lpGuidedAr(topic: string, kb: KBLesson | null, dur: number): string {
  const t = Math.round(dur * 0.22);
  const termExample = kb?.keyTerms?.[0]?.ar ? `مفهوم ${kb.keyTerms[0].ar}` : topic;
  return `(${t} دقيقة) – "نحن نفعل":\n\n• حل مثال مشترك على ${termExample} مع مشاركة الطلاب في كل خطوة.\n• طرح أسئلة استرشادية: "ماذا نفعل أولًا؟ لماذا اخترنا هذه الطريقة؟"\n• تصحيح الأخطاء الشائعة فور ظهورها بأسلوب إيجابي.`;
}
function lpIndependentAr(dur: number): string {
  const t = Math.round(dur * 0.18);
  return `(${t} دقيقة) – "أنت تفعل":\n\n• يعمل كل طالب بشكل فردي على التمارين المحددة.\n• يُسمح بمراجعة الملاحظات؛ المناقشة بين الطلاب مؤجّلة.\n• يطُوف المعلم ويقدّم دعمًا صامتًا (تلميحات مكتوبة).\n• من يُنهي مبكرًا يحل تمرين التحدي الإضافي.`;
}
function lpClosureAr(topic: string, dur: number): string {
  const t = Math.round(dur * 0.1);
  return pick([
    `(${t} دقيقة) بطاقة الخروج:\n• أهم شيء تعلمته اليوم عن ${topic}.\n• سؤال لا يزال يراوده.\nاجمع البطاقات عند الخروج.`,
    `(${t} دقيقة) "3-2-1":\n• 3 أشياء تعلمتها\n• 2 مفاهيم أريد فهمها أكثر\n• 1 سؤال لديّ عن ${topic}`,
  ]);
}

// ─── Lesson Plan helpers (English) ───────────────────────────────────────────

function lpObjectivesEn(topic: string, kb: KBLesson | null, custom?: string): string[] {
  if (custom?.trim()) return custom.trim().split('\n').filter(Boolean);
  if (kb?.keyConceptsEn.length) {
    const c = kb.keyConceptsEn;
    return [
      `Students will define and explain ${c[0]}`,
      c[1] ? `Students will describe ${c[1]} with real-world examples` : `Students will apply ${topic} to solve varied problems`,
      `Students will compare and contrast the key concepts related to ${topic}`,
    ];
  }
  return [
    `Students will define key concepts related to ${topic}`,
    `Students will explain real-world applications of ${topic}`,
    `Students will solve problems involving ${topic} using systematic methods`,
  ];
}
function lpMaterialsEn(subject: string): string[] {
  const base = ['Textbook', 'Whiteboard and colored markers', 'Printed worksheets'];
  if (/chem/i.test(subject)) return [...base, '3D molecular models', 'Projector and screen'];
  if (/math/i.test(subject)) return [...base, 'Scientific calculator', 'Graph paper'];
  return [...base, 'Projector and screen', 'Concept cards'];
}
function lpIntroEn(topic: string, kb: KBLesson | null): string {
  if (kb) return pick([
    `Open with: "Where do we encounter ${topic} in everyday life?" Record 3-4 student responses on the board. Show a visual related to ${kb.titleEn} and bridge to today's objectives.`,
    `"Know / Want to Know" activity: Students write what they already know about ${kb.titleEn} (2 min). Share responses, then identify what we'll discover together.`,
    `"Predict & Explore": Present a real-world scenario related to ${topic}. Ask students to predict the explanation. Use their predictions to motivate the lesson.`,
  ]);
  return pick([
    `Open with: "How does ${topic} connect to our daily lives?" Listen to 3-4 student responses and record them on the board as a bridge to the lesson.`,
    `"Think – Pair – Share": Students think for 30 seconds about what they know about ${topic}, share with a partner, then selected pairs share with the class.`,
  ]);
}
function lpMainActivityEn(topic: string, kb: KBLesson | null, style: string, dur: number): string {
  const t = Math.round(dur * 0.3);
  const conceptLines = kb?.keyConceptsEn.slice(0, 3).map((c, i) => `${i + 1}. Explain ${c} with a clear worked example.`).join('\n')
    ?? `1. Introduce the key concept of ${topic}.\n2. Present 3 worked examples with increasing difficulty.\n3. Think aloud as you solve each example on the board.`;
  if (style === 'inquiry') return `(${t} min) – Inquiry-based learning:\n\n1. Pose: "How does ${topic} work? What factors affect it?"\n2. Groups of 3 explore ${kb?.keyConceptsEn?.[0] ?? topic} using available resources.\n3. Each group records observations and conclusions.\n4. Class discussion synthesises findings.`;
  if (style === 'collaborative') return `(${t} min) – Collaborative learning (groups of 3-4):\n\n1. Each group gets a task card covering a different aspect of ${topic}.\n2. Group members study their aspect and prepare a 2-minute explanation.\n3. Groups present to the class.\n4. Teacher summarises and corrects misconceptions.`;
  return `(${t} min) – Direct instruction (I-Do model):\n\n${conceptLines}`;
}
function lpGuidedEn(topic: string, kb: KBLesson | null, dur: number): string {
  const t = Math.round(dur * 0.22);
  const termExample = kb?.keyTerms?.[0]?.en ? `the concept of ${kb.keyTerms[0].en}` : topic;
  return `(${t} min) – We Do:\n\n• Work through a problem on ${termExample} together, asking students to guide each step.\n• Use guiding questions: "What do we do first? Why did we choose this approach?"\n• Correct misconceptions immediately and positively.`;
}
function lpIndependentEn(dur: number): string {
  const t = Math.round(dur * 0.18);
  return `(${t} min) – You Do:\n\n• Students work individually on the assigned exercises.\n• Notes are permitted; peer discussion is not.\n• Teacher circulates and provides silent, targeted support (written hints).\n• Early finishers attempt the extension challenge.`;
}
function lpClosureEn(topic: string, dur: number): string {
  const t = Math.round(dur * 0.1);
  return pick([
    `(${t} min) Exit ticket:\n• Most important thing learned about ${topic}.\n• One remaining question.\nCollect at the door.`,
    `(${t} min) "3-2-1" reflection:\n• 3 things learned\n• 2 concepts to explore further\n• 1 question about ${topic}`,
  ]);
}
function lpAssessment(topic: string, lang: Lang): string {
  return pick(lang === 'ar' ? [
    `تكويني: ملاحظة الأداء أثناء التدريب الموجّه وبطاقات الخروج.\nختامي: اختبار نهاية الوحدة يغطي ${topic}.\nبديل: مشروع تطبيقي يربط ${topic} بظاهرة حياتية.`,
    `تكويني: أسئلة شفهية خلال الحصة ومراجعة التمارين الصفية.\nختامي: اختبار قصير (5 دقائق) في بداية الحصة القادمة.`,
  ] : [
    `Formative: Observation during guided practice; exit ticket review.\nSummative: End-of-unit quiz covering ${topic}.\nAlternative: Project linking ${topic} to a real-world phenomenon.`,
    `Formative: Oral questioning throughout the lesson; classwork review.\nSummative: 5-minute quiz at the start of the next lesson.`,
  ]);
}
function lpDifferentiation(topic: string, lang: Lang): string {
  return lang === 'ar'
    ? `دعم: بطاقات مفاهيم جاهزة ومنظمات بيانية وأمثلة إضافية مبسّطة.\nتحدٍّ: مسائل مفتوحة وبحث إضافي حول تطبيقات ${topic}.\nتنويع: تقديم المحتوى بصريًا وسمعيًا وكتابيًا.`
    : `Support: Graphic organizers, sentence starters, and additional worked examples.\nChallenge: Open-ended problems and independent research on real-world applications of ${topic}.\nMultiple modalities: Visual, auditory, and written presentation.`;
}
function lpHomework(topic: string, lang: Lang): string {
  return pick(lang === 'ar' ? [
    `أجب عن التمارين المحددة من الكتاب المدرسي حول ${topic}. بيّن خطوات الحل كاملة.`,
    `اكتب ملخصًا شخصيًا من 10 جمل عن ${topic}. أضف مثالًا حياتيًا وجدته بنفسك.`,
  ] : [
    `Complete the assigned textbook exercises on ${topic}. Show all working for full credit.`,
    `Write a 10-sentence personal summary of ${topic} including a real-world example you found.`,
  ]);
}

// ─── Points helpers ───────────────────────────────────────────────────────────

function mcPts(diff: string) { return diff === 'easy' ? 2 : diff === 'hard' ? 6 : 4; }
function saPts(diff: string) { return diff === 'easy' ? 4 : diff === 'hard' ? 10 : 6; }
function fbPts(diff: string) { return diff === 'easy' ? 2 : diff === 'hard' ? 4 : 3; }
function tfPts(_diff: string) { return 2; }

// ─── Arabic question factories — one question per call, random phrasing ───────

function makeMCQ_ar(topic: string, kb: KBLesson | null, diff: string): WQ {
  const pts = mcPts(diff);
  const t0 = kb?.keyTerms?.[0];
  const t1 = kb?.keyTerms?.[1];
  const c0 = kb?.keyConceptsAr?.[0] ?? topic;
  const c1 = kb?.keyConceptsAr?.[1] ?? `تطبيق ${topic}`;

  const correct0 = t0?.definitionAr?.substring(0, 55) ?? `الوصف الصحيح لـ${topic}`;
  const templates: Array<() => WQ> = [
    () => ({ text: `أيّ مما يلي يُعرِّف ${t0?.ar ?? topic} بشكل صحيح؟`, options: placeCorrect(correct0, [`مفهوم يختلف عن ${topic}`, 'وصف لظاهرة أخرى', 'لا شيء مما ذُكر']), answer: correct0, points: pts }),
    () => ({ text: `عند تطبيق ${topic} في مسألة حياتية، ما الخطوة الأولى الصحيحة؟`, options: placeCorrect('تحديد المعطيات والمطلوب بدقة', ['كتابة الإجابة النهائية مباشرة', 'تخمين النتيجة دون تحليل', 'تجاهل البيانات الناقصة']), answer: 'تحديد المعطيات والمطلوب بدقة', points: pts }),
    () => ({ text: `أيّ مما يلي ليس من خصائص ${c0}؟`, options: placeCorrect('لا يحتاج إلى تدريب سابق', ['له قواعد منهجية ثابتة', 'يرتبط بالمعرفة السابقة', 'يُطبَّق في مواقف متعددة']), answer: 'لا يحتاج إلى تدريب سابق', points: pts }),
    () => ({ text: `ما الأداة الأنسب لتحليل مسألة تتعلق بـ${topic}؟`, options: placeCorrect('التحليل المنهجي خطوة بخطوة', ['التخمين والتجربة العشوائية', 'الاعتماد الكلي على الذاكرة', 'تجنّب القواعد الأساسية']), answer: 'التحليل المنهجي خطوة بخطوة', points: pts }),
    () => ({ text: `ما الفرق الرئيسي بين ${c0} و${c1}؟`, options: placeCorrect('يختلفان في الآلية والتطبيق', ['لا فرق بينهما', 'أحدهما أكثر أهمية دائمًا', 'غير مترابطَين بالموضوع']), answer: 'يختلفان في الآلية والتطبيق', points: pts }),
    () => ({ text: `أيّ العبارات التالية تصف بشكل أدق تطبيق ${topic}؟`, options: placeCorrect('يُستخدم لحل مشكلات حقيقية ومتنوعة', ['مقتصر على النظريات فقط', 'لا يرتبط بمادة أخرى', 'لا يُطبَّق خارج الكتاب']), answer: 'يُستخدم لحل مشكلات حقيقية ومتنوعة', points: pts }),
    () => ({ text: `إذا أردت إثبات إتقانك لـ${topic}، ما الأسلوب الأفضل؟`, options: placeCorrect('حل مسائل جديدة وشرح خطوات التفكير', ['حفظ التعريفات دون فهم', 'نسخ الأمثلة من الكتاب', 'مشاهدة فيديو حول الموضوع فقط']), answer: 'حل مسائل جديدة وشرح خطوات التفكير', points: pts }),
    () => ({ text: `أيّ مما يلي يُعدّ مثالًا صحيحًا على تطبيق ${topic}؟`, options: placeCorrect(t1 ? `استخدام ${t1.ar} في تفسير ظاهرة` : `تطبيقه في حل مسألة عملية`, ['مثال غير مرتبط بالموضوع', 'مثال من موضوع مختلف', 'لا يوجد تطبيق حقيقي']), answer: t1 ? `استخدام ${t1.ar} في تفسير ظاهرة` : `تطبيقه في حل مسألة عملية`, points: pts }),
  ];
  return pick(templates)();
}

function makeSAQ_ar(topic: string, kb: KBLesson | null, diff: string): WQ {
  const pts = saPts(diff);
  const t0 = kb?.keyTerms?.[0];
  const t1 = kb?.keyTerms?.[1];
  const c0 = kb?.keyConceptsAr?.[0] ?? topic;
  const c1 = kb?.keyConceptsAr?.[1] ?? `تطبيق ${topic}`;
  const templates: Array<() => WQ> = [
    () => ({ text: `اشرح بأسلوبك الخاص مفهوم ${t0?.ar ?? topic} مع إعطاء مثال تطبيقي.`, answer: t0 ? `التعريف: ${t0.definitionAr.substring(0, 60)}... + مثال حياتي.` : `التعريف الدقيق + مثال واضح.`, points: pts }),
    () => ({ text: `صِف الخطوات المنهجية التي تتبعها لحل مسألة تتعلق بـ${topic}. استخدم قائمة مرقّمة.`, answer: 'الخطوات: 1. تحديد المعطيات 2. اختيار الأسلوب 3. التنفيذ 4. التحقق.', points: pts }),
    () => ({ text: `كيف يرتبط ${topic} بما درسناه سابقًا؟ اذكر ارتباطًا واحدًا على الأقل وفسّره.`, answer: 'ارتباط منطقي موثّق مع وحدة أو مادة سابقة.', points: pts }),
    () => ({ text: `ما أهمية دراسة ${topic}؟ اذكر فائدتين على الأقل وأعطِ مثالًا لكل منهما.`, answer: 'فائدتان: 1. بناء مهارة… 2. تطبيق على… مع مثالين.', points: pts }),
    () => ({ text: `قارن بين ${c0} و${c1} من حيث التعريف والتطبيق.`, answer: `${c0} يختلف عن ${c1} في: الآلية / التطبيق / النتيجة.`, points: pts }),
    () => ({ text: `أعطِ مثالًا حياتيًا على تطبيق ${topic} وفسّر كيف يرتبط بالمفهوم العلمي.`, answer: 'مثال واضح + ربط بالمفهوم: المبدأ العلمي الذي يفسّره.', points: pts }),
    () => ({ text: t1 ? `ما العلاقة بين ${t0?.ar ?? c0} و${t1.ar}؟ اشرح بمثال.` : `اشرح كيف يساعدك فهم ${topic} في حل مسائل من الحياة اليومية.`, answer: t1 ? `العلاقة: ${t0?.ar ?? c0} يؤدي إلى / يُسبب / يرتبط بـ${t1.ar}.` : 'وصف تطبيق حياتي ملموس مع تفسير.', points: pts }),
  ];
  return pick(templates)();
}

function makeFBQ_ar(topic: string, kb: KBLesson | null, diff: string): WQ {
  const pts = fbPts(diff);
  const t0 = kb?.keyTerms?.[0];
  const t1 = kb?.keyTerms?.[1];
  const c0 = kb?.keyConceptsAr?.[0] ?? topic;
  const templates: Array<() => WQ> = [
    () => ({ text: `${t0?.ar ?? topic} هو __________ يُعرَّف بأنه __________.`, answer: `${t0?.ar ?? topic} / ${t0?.definitionAr?.split(' ').slice(0, 4).join(' ') ?? 'الإجابة في الكتاب'}`, points: pts }),
    () => ({ text: `عند تطبيق ${topic}، فإن __________ يتغير نتيجة __________.`, answer: 'المتغير / السبب (راجع الكتاب المدرسي)', points: pts }),
    () => ({ text: `الخطوات الثلاث الرئيسية لتطبيق ${topic} هي: __________، __________، __________.`, answer: '1. تحديد المعطيات 2. التطبيق 3. التحقق', points: pts }),
    () => ({ text: `${c0} يرتبط بـ__________ ويؤدي إلى __________.`, answer: `${c0} / الظاهرة أو النتيجة المرتبطة به`, points: pts }),
    () => ({ text: t1 ? `الفرق الرئيسي بين ${t0?.ar ?? c0} و${t1.ar} هو أن __________ بينما __________.` : `القاعدة الأساسية في ${topic} تنص على أن __________ يؤدي إلى __________.`, answer: t1 ? `${t0?.ar ?? c0}: … / ${t1.ar}: …` : 'القاعدة / النتيجة (راجع الكتاب)', points: pts }),
    () => ({ text: `عندما يزداد __________ في سياق ${topic}، يتغير __________ وفقًا لذلك.`, answer: 'المتغير المستقل / المتغير التابع', points: pts }),
  ];
  return pick(templates)();
}

function makeTFQ_ar(topic: string, kb: KBLesson | null, _diff: string): WQ {
  const pts = tfPts(_diff);
  const c0 = kb?.keyConceptsAr?.[0] ?? topic;
  const c1 = kb?.keyConceptsAr?.[1] ?? `تطبيق ${topic}`;
  const templates: Array<() => WQ> = [
    () => ({ text: `${c0} يُعدّ من الأسس الجوهرية في ${topic}.`, options: ['صح', 'خطأ'], answer: 'صح', points: pts }),
    () => ({ text: `يمكن إتقان ${topic} دون فهم ${c1}.`, options: ['صح', 'خطأ'], answer: 'خطأ', points: pts }),
    () => ({ text: `${topic} له تطبيقات واسعة في الحياة اليومية خارج الفصل الدراسي.`, options: ['صح', 'خطأ'], answer: 'صح', points: pts }),
    () => ({ text: `المعرفة السابقة غير ضرورية لفهم ${topic}.`, options: ['صح', 'خطأ'], answer: 'خطأ', points: pts }),
    () => ({ text: `إتقان ${topic} يتطلب الفهم العميق قبل الحفظ.`, options: ['صح', 'خطأ'], answer: 'صح', points: pts }),
    () => ({ text: `${topic} مستقل تمامًا ولا يرتبط بمواضيع الوحدات الأخرى.`, options: ['صح', 'خطأ'], answer: 'خطأ', points: pts }),
    () => ({ text: `تطبيق ${topic} في مسائل جديدة يُعدّ دليلًا على الإتقان الحقيقي.`, options: ['صح', 'خطأ'], answer: 'صح', points: pts }),
    () => ({ text: `جميع مسائل ${topic} لها أسلوب حل واحد فقط.`, options: ['صح', 'خطأ'], answer: 'خطأ', points: pts }),
  ];
  return pick(templates)();
}

// ─── English question factories ───────────────────────────────────────────────

function makeMCQ_en(topic: string, kb: KBLesson | null, diff: string): WQ {
  const pts = mcPts(diff);
  const t0 = kb?.keyTerms?.[0];
  const t1 = kb?.keyTerms?.[1];
  const c0 = kb?.keyConceptsEn?.[0] ?? topic;
  const c1 = kb?.keyConceptsEn?.[1] ?? `application of ${topic}`;
  const correct0 = t0?.definitionEn?.substring(0, 60) ?? `The correct description of ${topic}`;
  const templates: Array<() => WQ> = [
    () => ({ text: `Which of the following correctly defines ${t0?.en ?? topic}?`, options: placeCorrect(correct0, [`An unrelated concept`, 'A description of a different phenomenon', 'None of the above']), answer: correct0, points: pts }),
    () => ({ text: `When applying ${topic} to a real-world problem, what is the first step?`, options: placeCorrect('Identify what is given and what is asked', ['Write the final answer immediately', 'Guess the answer without analysis', 'Ignore any missing data']), answer: 'Identify what is given and what is asked', points: pts }),
    () => ({ text: `Which of the following is NOT a characteristic of ${c0}?`, options: placeCorrect('It requires no prior practice', ['It has consistent rules', 'It builds on prior knowledge', 'It applies across multiple contexts']), answer: 'It requires no prior practice', points: pts }),
    () => ({ text: `What is the most effective approach when analysing a problem involving ${topic}?`, options: placeCorrect('Systematic step-by-step analysis', ['Random guessing', 'Relying solely on memory', 'Avoiding fundamental rules']), answer: 'Systematic step-by-step analysis', points: pts }),
    () => ({ text: `What is the main difference between ${c0} and ${c1}?`, options: placeCorrect('They differ in mechanism and application', ['There is no difference', 'One is always more important', 'They are unrelated to this topic']), answer: 'They differ in mechanism and application', points: pts }),
    () => ({ text: `Which statement best captures the application of ${topic}?`, options: placeCorrect('Used to solve real, diverse problems', ['Limited to theory only', 'Unrelated to other subjects', 'Cannot be applied outside the textbook']), answer: 'Used to solve real, diverse problems', points: pts }),
    () => ({ text: `What is the best way to demonstrate mastery of ${topic}?`, options: placeCorrect('Solve new problems and explain your reasoning', ['Memorise definitions without understanding', 'Copy examples from the textbook', 'Watch a video about the topic only']), answer: 'Solve new problems and explain your reasoning', points: pts }),
    () => ({ text: `Which of the following is a valid real-world example of ${topic}?`, options: placeCorrect(t1 ? `Using ${t1.en} to explain a phenomenon` : `Applying it to solve a practical problem`, ['An unrelated example', 'An example from a different topic', 'There are no real applications']), answer: t1 ? `Using ${t1.en} to explain a phenomenon` : `Applying it to solve a practical problem`, points: pts }),
  ];
  return pick(templates)();
}

function makeSAQ_en(topic: string, kb: KBLesson | null, diff: string): WQ {
  const pts = saPts(diff);
  const t0 = kb?.keyTerms?.[0];
  const t1 = kb?.keyTerms?.[1];
  const c0 = kb?.keyConceptsEn?.[0] ?? topic;
  const c1 = kb?.keyConceptsEn?.[1] ?? `application of ${topic}`;
  const templates: Array<() => WQ> = [
    () => ({ text: `Explain in your own words what ${t0?.en ?? topic} means and give one real-world example.`, answer: t0 ? `Definition: ${t0.definitionEn.substring(0, 60)}... + real example.` : 'Accurate definition + concrete example.', points: pts }),
    () => ({ text: `Describe the systematic steps you would follow to solve a problem involving ${topic}. Use a numbered list.`, answer: 'Steps: 1. Identify given/asked 2. Choose method 3. Execute 4. Verify.', points: pts }),
    () => ({ text: `How is ${topic} connected to what we have studied previously? Give at least one documented connection.`, answer: 'Logical, documented connection to a prior unit or subject.', points: pts }),
    () => ({ text: `State two benefits of studying ${topic} and give a real-world example for each.`, answer: 'Benefit 1: … example. Benefit 2: … example.', points: pts }),
    () => ({ text: `Compare ${c0} and ${c1} in terms of definition and application.`, answer: `${c0} differs from ${c1} in: mechanism / application / outcome.`, points: pts }),
    () => ({ text: `Give a real-world example of ${topic} and explain how it relates to the scientific concept.`, answer: 'Clear example + explanation of the scientific principle it illustrates.', points: pts }),
    () => ({ text: t1 ? `Explain the relationship between ${t0?.en ?? c0} and ${t1.en}. Illustrate with an example.` : `Explain how understanding ${topic} helps solve everyday problems.`, answer: t1 ? `${t0?.en ?? c0} leads to / causes / relates to ${t1.en}.` : 'Concrete real-world application with explanation.', points: pts }),
  ];
  return pick(templates)();
}

function makeFBQ_en(topic: string, kb: KBLesson | null, diff: string): WQ {
  const pts = fbPts(diff);
  const t0 = kb?.keyTerms?.[0];
  const t1 = kb?.keyTerms?.[1];
  const c0 = kb?.keyConceptsEn?.[0] ?? topic;
  const templates: Array<() => WQ> = [
    () => ({ text: `${t0?.en ?? topic} is __________ characterised by __________.`, answer: `${t0?.en ?? topic} / ${t0?.definitionEn?.split(' ').slice(0, 4).join(' ') ?? 'see textbook'}`, points: pts }),
    () => ({ text: `When applying ${topic}, __________ changes as a result of __________.`, answer: 'The dependent variable / the cause (see textbook)', points: pts }),
    () => ({ text: `The three main steps for applying ${topic} are: __________, __________, and __________.`, answer: '1. Identify given 2. Apply method 3. Verify', points: pts }),
    () => ({ text: `${c0} is related to __________ and leads to __________.`, answer: `${c0} / related phenomenon or outcome`, points: pts }),
    () => ({ text: t1 ? `The main difference between ${t0?.en ?? c0} and ${t1.en} is that __________ while __________.` : `The fundamental rule of ${topic} states that __________ results in __________.`, answer: t1 ? `${t0?.en ?? c0}: … / ${t1.en}: …` : 'The rule / the outcome (see textbook)', points: pts }),
    () => ({ text: `When __________ increases in the context of ${topic}, __________ changes proportionally.`, answer: 'The independent variable / the dependent variable', points: pts }),
  ];
  return pick(templates)();
}

function makeTFQ_en(topic: string, kb: KBLesson | null, _diff: string): WQ {
  const pts = tfPts(_diff);
  const c0 = kb?.keyConceptsEn?.[0] ?? topic;
  const c1 = kb?.keyConceptsEn?.[1] ?? `application of ${topic}`;
  const templates: Array<() => WQ> = [
    () => ({ text: `${c0} is one of the core foundations of ${topic}.`, options: ['True', 'False'], answer: 'True', points: pts }),
    () => ({ text: `${topic} can be mastered without understanding ${c1}.`, options: ['True', 'False'], answer: 'False', points: pts }),
    () => ({ text: `${topic} has broad applications in daily life beyond the classroom.`, options: ['True', 'False'], answer: 'True', points: pts }),
    () => ({ text: `Prior knowledge is unnecessary for understanding ${topic}.`, options: ['True', 'False'], answer: 'False', points: pts }),
    () => ({ text: `Mastering ${topic} requires deep understanding before memorisation.`, options: ['True', 'False'], answer: 'True', points: pts }),
    () => ({ text: `${topic} is completely independent and unrelated to other topics in this unit.`, options: ['True', 'False'], answer: 'False', points: pts }),
    () => ({ text: `Successfully applying ${topic} to unfamiliar problems demonstrates genuine mastery.`, options: ['True', 'False'], answer: 'True', points: pts }),
    () => ({ text: `All problems involving ${topic} can be solved using only one fixed method.`, options: ['True', 'False'], answer: 'False', points: pts }),
  ];
  return pick(templates)();
}

// ─── Section title builders ───────────────────────────────────────────────────

function sectionTitleAr(type: QType, pts: number): string {
  return { multiple_choice: `أولًا – اختيار متعدد [${pts} نقطة]`, short_answer: `ثانيًا – إجابة قصيرة [${pts} نقطة]`, fill_blank: `ثالثًا – إكمال الفراغات [${pts} نقطة]`, true_false: `رابعًا – صح أو خطأ [${pts} نقطة]` }[type];
}
function sectionTitleEn(type: QType, pts: number): string {
  return { multiple_choice: `Section A – Multiple Choice [${pts} pts]`, short_answer: `Section B – Short Answer [${pts} pts]`, fill_blank: `Section C – Fill in the Blanks [${pts} pts]`, true_false: `Section D – True or False [${pts} pts]` }[type];
}

// ─── Quiz question factories ──────────────────────────────────────────────────

function makeQuizMCQ_ar(topic: string, kb: KBLesson | null, pts: number, id: string): QuizQuestion {
  const q = makeMCQ_ar(topic, kb, 'medium');
  return { id, type: 'multiple_choice', text: q.text, options: q.options, correctAnswer: q.answer, points: pts, explanation: `${q.answer} — راجع ${kb?.titleAr ?? topic} في الكتاب المدرسي.` };
}
function makeQuizMCQ_en(topic: string, kb: KBLesson | null, pts: number, id: string): QuizQuestion {
  const q = makeMCQ_en(topic, kb, 'medium');
  return { id, type: 'multiple_choice', text: q.text, options: q.options, correctAnswer: q.answer, points: pts, explanation: `${q.answer} — See ${kb?.titleEn ?? topic} in the textbook.` };
}

function makeQuizTF_ar(topic: string, kb: KBLesson | null, pts: number, id: string): QuizQuestion {
  const q = makeTFQ_ar(topic, kb, 'medium');
  return { id, type: 'true_false', text: q.text, options: ['صح', 'خطأ'], correctAnswer: q.answer, points: pts, explanation: `الإجابة "${q.answer}" — ${q.text}` };
}
function makeQuizTF_en(topic: string, kb: KBLesson | null, pts: number, id: string): QuizQuestion {
  const q = makeTFQ_en(topic, kb, 'medium');
  return { id, type: 'true_false', text: q.text, options: ['True', 'False'], correctAnswer: q.answer, points: pts, explanation: `The answer is "${q.answer}" — ${q.text}` };
}

function makeQuizSA_ar(topic: string, kb: KBLesson | null, pts: number, id: string): QuizQuestion {
  const q = makeSAQ_ar(topic, kb, 'medium');
  return { id, type: 'short_answer', text: q.text, correctAnswer: q.answer, points: pts, explanation: `إجابة كاملة: ${q.answer}` };
}
function makeQuizSA_en(topic: string, kb: KBLesson | null, pts: number, id: string): QuizQuestion {
  const q = makeSAQ_en(topic, kb, 'medium');
  return { id, type: 'short_answer', text: q.text, correctAnswer: q.answer, points: pts, explanation: `Full answer: ${q.answer}` };
}

// ─── Main service class ───────────────────────────────────────────────────────

export class MockAIService extends AIService {
  private async delay() {
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
  }

  async generateLessonPlan(req: AIRequest): Promise<LessonPlanOutput> {
    await this.delay();
    const lang: Lang = req.language === 'arabic' ? 'ar' : 'en';
    const kb = searchKB(req.topic, lang)[0] ?? null;
    const topic = req.topic;
    const dur = req.duration ?? 45;
    const style = req.teachingStyle ?? 'direct';

    if (lang === 'ar') {
      return {
        title: `${topic} – خطة درس`,
        grade: req.grade, subject: req.subject, duration: dur,
        objectives: lpObjectivesAr(topic, kb, req.objectives),
        materials: lpMaterialsAr(req.subject),
        introduction: lpIntroAr(topic, kb),
        mainActivity: lpMainActivityAr(topic, kb, style, dur),
        guidedPractice: lpGuidedAr(topic, kb, dur),
        independentPractice: lpIndependentAr(dur),
        closure: lpClosureAr(topic, dur),
        assessment: lpAssessment(topic, 'ar'),
        differentiation: lpDifferentiation(topic, 'ar'),
        homework: lpHomework(topic, 'ar'),
      };
    }
    return {
      title: `${topic} – Lesson Plan`,
      grade: req.grade, subject: req.subject, duration: dur,
      objectives: lpObjectivesEn(topic, kb, req.objectives),
      materials: lpMaterialsEn(req.subject),
      introduction: lpIntroEn(topic, kb),
      mainActivity: lpMainActivityEn(topic, kb, style, dur),
      guidedPractice: lpGuidedEn(topic, kb, dur),
      independentPractice: lpIndependentEn(dur),
      closure: lpClosureEn(topic, dur),
      assessment: lpAssessment(topic, 'en'),
      differentiation: lpDifferentiation(topic, 'en'),
      homework: lpHomework(topic, 'en'),
    };
  }

  async generateWorksheet(req: AIRequest): Promise<WorksheetOutput> {
    await this.delay();
    const lang: Lang = req.language === 'arabic' ? 'ar' : 'en';
    const kb = searchKB(req.topic, lang)[0] ?? null;
    const topic = req.topic;
    const diff = req.difficulty ?? 'medium';
    const totalQ = req.numQuestions ?? 10;
    const types: QType[] = (req.questionTypes as QType[]) ?? ['multiple_choice', 'short_answer'];

    // Distribute questions evenly across selected types, remainder goes to first type
    const perType = Math.max(1, Math.floor(totalQ / types.length));
    const sections: WorksheetSection[] = [];
    const answerKey: WorksheetAnswerKeyItem[] = [];
    let qNum = 1;
    let remaining = totalQ;

    for (let ti = 0; ti < types.length; ti++) {
      const type = types[ti];
      // Last type gets whatever is left to guarantee exact total
      const count = ti === types.length - 1 ? remaining : Math.min(perType, remaining);
      remaining -= count;

      const questions: WQ[] = [];
      for (let i = 0; i < count; i++) {
        // Factory called once per question — each call uses pick() for random variation
        let q: WQ;
        if (lang === 'ar') {
          if (type === 'multiple_choice') q = makeMCQ_ar(topic, kb, diff);
          else if (type === 'short_answer') q = makeSAQ_ar(topic, kb, diff);
          else if (type === 'fill_blank') q = makeFBQ_ar(topic, kb, diff);
          else q = makeTFQ_ar(topic, kb, diff);
        } else {
          if (type === 'multiple_choice') q = makeMCQ_en(topic, kb, diff);
          else if (type === 'short_answer') q = makeSAQ_en(topic, kb, diff);
          else if (type === 'fill_blank') q = makeFBQ_en(topic, kb, diff);
          else q = makeTFQ_en(topic, kb, diff);
        }
        questions.push(q);
        answerKey.push({ num: qNum++, answer: q.answer });
      }

      const sectionPts = questions.reduce((s, q) => s + q.points, 0);
      sections.push({
        type,
        title: lang === 'ar' ? sectionTitleAr(type, sectionPts) : sectionTitleEn(type, sectionPts),
        questions,
      });
    }

    return {
      title: lang === 'ar' ? `${req.subject} – ${topic} – ورقة عمل` : `${req.subject} – ${topic} – Worksheet`,
      instructions: lang === 'ar'
        ? `الاسم: ________________  الصف: ${req.grade}  التاريخ: ________________\n\nاقرأ كل سؤال بعناية. بيّن خطوات حلّك حيثما أمكن.`
        : `Name: ________________  Grade: ${req.grade}  Date: ________________\n\nRead each question carefully. Show all working where applicable.`,
      sections,
      answerKey,
    };
  }

  async generateQuiz(req: AIRequest): Promise<QuizOutput> {
    await this.delay();
    const lang: Lang = req.language === 'arabic' ? 'ar' : 'en';
    const kb = searchKB(req.topic, lang)[0] ?? null;
    const topic = req.topic;
    const totalMarks = req.totalMarks ?? 20;
    const duration = req.duration ?? 20;
    const types: QType[] = (req.questionTypes as QType[]) ?? ['multiple_choice', 'true_false', 'short_answer'];

    // 2 questions per selected type, marks distributed evenly
    const numQuestions = types.length * 2;
    const basePts = Math.max(1, Math.floor(totalMarks / numQuestions));

    const questions: QuizQuestion[] = [];
    let qIdx = 1;
    let usedPts = 0;

    for (const type of types) {
      for (let rep = 0; rep < 2; rep++) {
        const id = `q${qIdx++}`;
        // Last question absorbs any rounding difference
        const isLast = qIdx > numQuestions;
        const pts = isLast ? Math.max(1, totalMarks - usedPts) : basePts;
        usedPts += pts;

        if (lang === 'ar') {
          if (type === 'multiple_choice') questions.push(makeQuizMCQ_ar(topic, kb, pts, id));
          else if (type === 'true_false') questions.push(makeQuizTF_ar(topic, kb, pts, id));
          else questions.push(makeQuizSA_ar(topic, kb, pts, id));
        } else {
          if (type === 'multiple_choice') questions.push(makeQuizMCQ_en(topic, kb, pts, id));
          else if (type === 'true_false') questions.push(makeQuizTF_en(topic, kb, pts, id));
          else questions.push(makeQuizSA_en(topic, kb, pts, id));
        }
      }
    }

    // Ensure totalPoints sums exactly to totalMarks
    const actualTotal = questions.reduce((s, q) => s + q.points, 0);
    if (actualTotal !== totalMarks && questions.length > 0) {
      questions[questions.length - 1].points += totalMarks - actualTotal;
    }

    return {
      title: lang === 'ar' ? `اختبار ${req.subject} – ${topic}` : `${req.subject} Quiz – ${topic}`,
      duration,
      totalPoints: questions.reduce((s, q) => s + q.points, 0),
      questions,
    };
  }

  async generateHomework(req: AIRequest): Promise<WorksheetOutput> {
    await this.delay();
    const lang: Lang = req.language === 'arabic' ? 'ar' : 'en';
    const topic = req.topic;
    return {
      title: lang === 'ar' ? `واجب منزلي – ${topic}` : `Homework – ${topic}`,
      instructions: lang === 'ar'
        ? 'أجب عن جميع الأسئلة بشكل مستقل. الموعد النهائي: الحصة القادمة.'
        : 'Complete all questions independently. Due: next class session.',
      sections: [{
        type: 'short_answer',
        title: lang === 'ar' ? 'تمارين تدريبية' : 'Practice Problems',
        questions: [
          { text: lang === 'ar' ? `حلّ مسألة مرتبطة بـ${topic} واشرح كل خطوة.` : `Solve a problem related to ${topic} and explain each step.`, points: 10 },
          { text: lang === 'ar' ? `ابحث عن مثال حياتي لـ${topic} وصفه بـ3-5 جمل.` : `Find a real-world example of ${topic} and describe it in 3-5 sentences.`, points: 10 },
          { text: lang === 'ar' ? `ضع مسألة خاصة بك تتعلق بـ${topic} وقدّم حلّها.` : `Create your own problem involving ${topic} and provide the solution.`, points: 10 },
        ],
      }],
      answerKey: [
        { num: 1, answer: lang === 'ar' ? 'حل تدريجي مع شرح كل خطوة' : 'Step-by-step solution with explanation' },
        { num: 2, answer: lang === 'ar' ? 'مثال واضح ووصف دقيق' : 'Clear example with accurate description' },
        { num: 3, answer: lang === 'ar' ? 'مسألة منطقية مع حل صحيح' : 'Logical problem with correct solution' },
      ],
    };
  }
}

export const aiService = new MockAIService();
