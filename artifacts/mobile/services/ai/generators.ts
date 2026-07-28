import {
  ActivityOutput, ActivityStep, AIRequest, AIService,
  ClassroomActivity, ClassroomActivityRequest,
  LessonPlanOutput,
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

  async generateActivity(req: AIRequest): Promise<ActivityOutput> {
    await this.delay();
    const lang: Lang = req.language === 'arabic' ? 'ar' : 'en';
    const topic = req.topic;
    const actType = req.activityType ?? 'group';
    const duration = req.duration ?? 30;
    const stepDur = Math.max(5, Math.round((duration - 10) / 2));

    if (lang === 'ar') {
      const groupLabel: Record<string, string> = {
        individual: 'فردي', group: `3-4 طلاب`, discussion: 'الصف كامل',
        'hands-on': 'ثنائي أو رباعي', game: 'فرق من 4 طلاب',
      };
      const steps: ActivityStep[] = [
        { stepNumber: 1, title: 'التمهيد', description: `اطرح على الطلاب سؤالاً تحفيزياً: "أين نصادف ${topic} في حياتنا؟" استمع لإجابات 3-4 طلاب وسجّلها على السبورة لبناء الفضول.`, durationMin: 5 },
        { stepNumber: 2, title: 'النشاط الرئيسي', description: `قسّم الطلاب حسب ${groupLabel[actType] ?? 'مجموعات'}. يتعاون أفراد كل مجموعة على استكشاف ${topic} من خلال المهمة المطروحة، مع تدوين ملاحظاتهم وتوزيع الأدوار بينهم (قائد، كاتب، مقرر).`, durationMin: stepDur },
        { stepNumber: 3, title: 'العرض والمناقشة', description: `تعرض كل مجموعة نتائجها في 90 ثانية. يسجّل المعلم النقاط الرئيسية على السبورة ويفتح نقاشاً مختصراً حول الاختلافات بين المجموعات.`, durationMin: stepDur },
        { stepNumber: 4, title: 'التلخيص والتقييم', description: `يكتب كل طالب جملةً واحدة تلخّص أهم ما تعلّمه. تُجمع الأوراق كبطاقة خروج للتقييم البنائي.`, durationMin: 5 },
      ];
      return {
        title: `نشاط "${topic}" – ${actType === 'game' ? 'لعبة تعليمية' : actType === 'discussion' ? 'نقاش' : 'تعلم تعاوني'}`,
        activityType: actType,
        totalDuration: duration,
        objective: req.objectives?.trim() || `أن يطبق الطلاب مفاهيم ${topic} ويناقشوها مع زملائهم لتعزيز الفهم`,
        groupSize: groupLabel[actType] ?? '3-4 طلاب',
        materials: ['الكتاب المدرسي', 'أوراق عمل مطبوعة', 'أقلام ملونة', 'لاصق ورقي للبطاقات'],
        steps,
        teacherTips: [
          'وزّع الأدوار داخل كل مجموعة قبل البدء لضمان مشاركة الجميع.',
          'تجوّل بين المجموعات كل 3 دقائق وقدّم توجيهاً خفيفاً دون إعطاء الإجابات.',
          'استخدم مؤقتاً مرئياً على السبورة لإدارة الوقت.',
        ],
        differentiation: 'للطلاب المتقدمين: قدّم تحدياً إضافياً أو اطلب منهم ربط الموضوع بدرس سابق. للطلاب المحتاجين لدعم: قدّم بطاقة مرجعية تحتوي المصطلحات والصيغ الأساسية.',
        assessment: 'راقب جودة النقاش داخل المجموعات، وقيّم بطاقات الخروج للتحقق من الفهم، وسجّل ملاحظات عن الطلاب الذين يحتاجون دعماً إضافياً.',
      };
    }

    const groupLabel: Record<string, string> = {
      individual: 'Individual', group: '3-4 students', discussion: 'Whole class',
      'hands-on': 'Pairs or groups of 4', game: 'Teams of 4',
    };
    const steps: ActivityStep[] = [
      { stepNumber: 1, title: 'Warm-up', description: `Ask a thought-provoking question: "Where do we encounter ${topic} in daily life?" Take responses from 3-4 students and note them on the board to build curiosity.`, durationMin: 5 },
      { stepNumber: 2, title: 'Main Activity', description: `Divide students into ${groupLabel[actType] ?? 'groups'}. Groups collaborate to explore ${topic} through the assigned task, noting findings and distributing roles (leader, recorder, presenter).`, durationMin: stepDur },
      { stepNumber: 3, title: 'Share & Discuss', description: `Each group presents findings in 90 seconds. Record key points on the board and facilitate a brief discussion around differences between groups.`, durationMin: stepDur },
      { stepNumber: 4, title: 'Wrap-up', description: `Each student writes one sentence summarising their main learning. Collect as an exit ticket for formative assessment.`, durationMin: 5 },
    ];
    return {
      title: `${topic} – ${actType === 'game' ? 'Learning Game' : actType === 'discussion' ? 'Discussion' : 'Collaborative Activity'}`,
      activityType: actType,
      totalDuration: duration,
      objective: req.objectives?.trim() || `Students will apply and discuss concepts of ${topic} with peers to deepen understanding`,
      groupSize: groupLabel[actType] ?? '3-4 students',
      materials: ['Textbook', 'Printed worksheets', 'Coloured markers', 'Sticky notes'],
      steps,
      teacherTips: [
        'Assign roles inside each group before starting to ensure full participation.',
        'Circulate every 3 minutes and give light guidance without giving answers.',
        'Display a visible timer on the board to help manage pacing.',
      ],
      differentiation: 'Advanced students: offer an extension challenge or ask them to connect the topic to a previous lesson. Students needing support: provide a reference card with key terms and formulas.',
      assessment: 'Monitor quality of group discussion, review exit tickets for comprehension, and note students who need follow-up support.',
    };
  }

  async generateClassroomActivity(req: ClassroomActivityRequest): Promise<ClassroomActivity> {
    await this.delay();
    const isAr = req.language === 'arabic';
    const topic = req.topic;
    const dur = req.duration ?? 20;
    const slideDuration = Math.round((dur * 60) / 5);
    const actType = req.activityType ?? 'escape-challenge';

    // ── Bingo ──────────────────────────────────────────────────────────────────
    if (actType === 'bingo') {
      if (isAr) {
        return {
          activityName: `بينجو – ${topic}`,
          activityType: 'bingo',
          grade: req.grade,
          subject: req.subject,
          lesson: topic,
          duration: dur,
          difficulty: req.difficulty,
          groupType: req.groupType,
          learningObjective: `مراجعة مفردات وتعريفات ${topic} بأسلوب تنافسي ممتع`,
          materials: ['بطاقات بينجو مطبوعة (بطاقة لكل طالب)', 'قصاصات ورقية أو حصص صغيرة للتغطية', 'مؤقت'],
          teacherPreparation: 'اطبع بطاقات بينجو مختلفة لكل طالب (5×5 مربع). جهّز قائمة الاستدعاء بالمصطلحات والتعريفات.',
          teacherNotes: ['ناقش الإجابات بعد الانتهاء لتعزيز الفهم', 'يمكن اللعب لجولتين مع تبديل البطاقات'],
          answerKey: [`المصطلح 1: تعريف ${topic}`, `المصطلح 2: خاصية ${topic}`, `المصطلح 3: تطبيق ${topic}`],
          printables: ['بطاقات بينجو 5×5 (نسخة مختلفة لكل طالب)', 'قائمة الاستدعاء للمعلم'],
          assessment: 'قيّم سرعة التعرف على المصطلحات ودقتها. راقب من يحتاج مراجعة إضافية.',
          extensionChallenge: `اطلب من الفائز شرح 3 مصطلحات من بطاقته بكلماته الخاصة`,
          slides: [
            { slideNumber: 1, type: 'intro', title: '🎱 بينجو المصطلحات', content: `مرحبًا بكم في بينجو ${topic}!\nلكل طالب بطاقة 5×5 مليئة بالمصطلحات.\nعندما أستدعي مصطلحًا، غطّ المربع المناسب.\nأول من يكمل صفًا أو عمودًا أو قطرًا يصرخ بينجو!`, durationSeconds: 0 },
            { slideNumber: 2, type: 'bingo-call', title: 'الاستدعاء 1', content: `تعريف: المفهوم الأساسي الأول في ${topic}`, hint: `فكّر في تعريف ${topic}`, answer: `المصطلح 1`, durationSeconds: 30, teacher: { expectedAnswer: `المصطلح المحدد من وحدة ${topic}`, teachingTips: 'امنح الطلاب 20-30 ثانية للبحث في بطاقاتهم', suggestedQuestions: ['هل تتذكر هذا المصطلح من الدرس؟'] } },
            { slideNumber: 3, type: 'bingo-call', title: 'الاستدعاء 2', content: `خاصية: ${topic} يُستخدم عندما…`, hint: 'فكّر في حالات التطبيق', answer: 'المصطلح 2', durationSeconds: 30, teacher: { expectedAnswer: `تطبيق مباشر من وحدة ${topic}`, teachingTips: 'ذكّر الطلاب بمثال من الكتاب', suggestedQuestions: ['أين طبّقنا هذا في الدرس؟'] } },
            { slideNumber: 4, type: 'bingo-call', title: 'الاستدعاء 3', content: `قاعدة: إذا كان … في ${topic}، فإن النتيجة هي…`, hint: 'راجع القواعد الأساسية', answer: 'المصطلح 3', durationSeconds: 30, teacher: { expectedAnswer: `القاعدة المرتبطة بـ${topic}`, teachingTips: 'اربط السؤال بخطوة الحل التي درسناها' } },
            { slideNumber: 5, type: 'bingo-call', title: 'الاستدعاء 4', content: `مثال: أوجد نتيجة تطبيق مفهوم من ${topic} في موقف حياتي`, hint: 'تذكّر التطبيقات الحياتية', answer: 'المصطلح 4', durationSeconds: 30, teacher: { expectedAnswer: `مثال حياتي على ${topic}`, teachingTips: 'يمكن قبول أكثر من مصطلح إذا كانت الإجابة منطقية' } },
            { slideNumber: 6, type: 'bingo-call', title: 'الاستدعاء 5', content: `المعادلة: الصيغة الرياضية المرتبطة بـ${topic} هي…`, hint: 'تذكّر صيغ وحدتنا', answer: 'المصطلح 5', durationSeconds: 30, teacher: { expectedAnswer: `الصيغة المرتبطة بـ${topic}`, teachingTips: 'اعرض الصيغة بعد الاستدعاء للتأكيد' } },
            { slideNumber: 7, type: 'bingo-call', title: 'الاستدعاء 6', content: `ما الفرق بين المفهومين الرئيسيين في ${topic}؟`, hint: 'قارن المفهومين', answer: 'المصطلح 6', durationSeconds: 30, teacher: { expectedAnswer: `الفرق بين مفهومَي ${topic}`, teachingTips: 'ادفع الطلاب للتفكير النقدي هنا' } },
            { slideNumber: 8, type: 'bingo-call', title: 'الاستدعاء 7', content: `أي خاصية من خصائص ${topic} تنطبق على هذا الموقف: …؟`, hint: 'راجع قائمة الخصائص', answer: 'المصطلح 7', durationSeconds: 30, teacher: { expectedAnswer: `الخاصية المناسبة من ${topic}`, teachingTips: 'أعطِ مثالًا إضافيًا إذا بدا الطلاب متوقفين' } },
            { slideNumber: 9, type: 'bingo-call', title: 'الاستدعاء 8', content: `الوحدة المستخدمة لقياس كمية مرتبطة بـ${topic} هي…`, hint: 'فكّر في وحدات القياس', answer: 'المصطلح 8', durationSeconds: 30, teacher: { expectedAnswer: `وحدة القياس المرتبطة بـ${topic}`, teachingTips: 'ذكّر الطلاب بجدول الوحدات' } },
            { slideNumber: 10, type: 'summary', title: '🎉 انتهت الجولة!', content: `أحسنتم جميعًا!\nراجعنا اليوم مفردات ${topic} الأساسية.\n\nناقش مع زميلك:\n• أي مصطلح كان الأصعب؟\n• أي مصطلح تريد مراجعته مجددًا؟`, durationSeconds: 0 },
          ],
        };
      }
      return {
        activityName: `Math Bingo – ${topic}`,
        activityType: 'bingo',
        grade: req.grade,
        subject: req.subject,
        lesson: topic,
        duration: dur,
        difficulty: req.difficulty,
        groupType: req.groupType,
        learningObjective: `Review key vocabulary and definitions of ${topic} in a competitive, fun format`,
        materials: ['Printed bingo cards (one per student, each unique)', 'Small chips or paper scraps for covering squares', 'Timer'],
        teacherPreparation: 'Print unique 5×5 bingo cards for each student. Prepare a caller list of terms and definitions.',
        teacherNotes: ['Discuss answers after the game to reinforce learning', 'Play two rounds with swapped cards for deeper review'],
        answerKey: [`Term 1: definition of ${topic}`, `Term 2: property of ${topic}`, `Term 3: application of ${topic}`],
        printables: ['5×5 Bingo cards (unique per student)', "Teacher's caller list"],
        assessment: 'Observe recognition speed and accuracy. Note students who struggle to find terms.',
        extensionChallenge: `Ask the winner to explain 3 terms from their card in their own words`,
        slides: [
          { slideNumber: 1, type: 'intro', title: '🎱 Vocabulary Bingo', content: `Welcome to ${topic} Bingo!\nEach card has a 5×5 grid of terms.\nWhen I call a clue, cover the matching term.\nFirst to complete a row, column, or diagonal shouts BINGO!`, durationSeconds: 0 },
          { slideNumber: 2, type: 'bingo-call', title: 'Call 1', content: `Definition: The core concept at the heart of ${topic}`, hint: `Think about the definition of ${topic}`, answer: 'Term 1', durationSeconds: 30, teacher: { expectedAnswer: `The key term from the ${topic} unit`, teachingTips: 'Give students 20-30 seconds to scan their cards', suggestedQuestions: ['Do you remember this term from the lesson?'] } },
          { slideNumber: 3, type: 'bingo-call', title: 'Call 2', content: `Property: ${topic} is used when…`, hint: 'Think about when we apply this concept', answer: 'Term 2', durationSeconds: 30, teacher: { expectedAnswer: `A direct application from the ${topic} unit`, teachingTips: 'Remind students of the textbook example' } },
          { slideNumber: 4, type: 'bingo-call', title: 'Call 3', content: `Rule: In ${topic}, when … the result is…`, hint: 'Recall the main rules', answer: 'Term 3', durationSeconds: 30, teacher: { expectedAnswer: `The rule linked to ${topic}`, teachingTips: 'Connect the clue to the solution steps we studied' } },
          { slideNumber: 5, type: 'bingo-call', title: 'Call 4', content: `Example: Name a real-world application of a concept from ${topic}`, hint: 'Think of everyday applications', answer: 'Term 4', durationSeconds: 30, teacher: { expectedAnswer: `A real-world example of ${topic}`, teachingTips: 'Accept multiple terms if the reasoning is sound' } },
          { slideNumber: 6, type: 'bingo-call', title: 'Call 5', content: `Formula: The mathematical expression associated with ${topic} is…`, hint: 'Recall the formulas from our unit', answer: 'Term 5', durationSeconds: 30, teacher: { expectedAnswer: `The formula linked to ${topic}`, teachingTips: 'Display the formula after calling to confirm' } },
          { slideNumber: 7, type: 'bingo-call', title: 'Call 6', content: `What is the main difference between the two key concepts in ${topic}?`, hint: 'Compare the two concepts', answer: 'Term 6', durationSeconds: 30, teacher: { expectedAnswer: `The distinction between the two concepts in ${topic}`, teachingTips: 'Push students toward critical thinking here' } },
          { slideNumber: 8, type: 'bingo-call', title: 'Call 7', content: `Which property of ${topic} applies to this situation: …?`, hint: 'Review your list of properties', answer: 'Term 7', durationSeconds: 30, teacher: { expectedAnswer: `The appropriate property from ${topic}`, teachingTips: 'Give an extra example if students seem stuck' } },
          { slideNumber: 9, type: 'bingo-call', title: 'Call 8', content: `The unit used to measure a quantity related to ${topic} is…`, hint: 'Think about units of measurement', answer: 'Term 8', durationSeconds: 30, teacher: { expectedAnswer: `The measurement unit related to ${topic}`, teachingTips: 'Remind students of the units table' } },
          { slideNumber: 10, type: 'summary', title: '🎉 Round Complete!', content: `Well done everyone!\nWe reviewed key vocabulary from ${topic}.\n\nDiscuss with a partner:\n• Which term was hardest to remember?\n• Which term would you like to revisit?`, durationSeconds: 0 },
        ],
      };
    }

    // ── Relay Race ─────────────────────────────────────────────────────────────
    if (actType === 'relay') {
      if (isAr) {
        return {
          activityName: `سباق التتابع – ${topic}`,
          activityType: 'relay',
          grade: req.grade,
          subject: req.subject,
          lesson: topic,
          duration: dur,
          difficulty: req.difficulty,
          groupType: req.groupType,
          learningObjective: `تطبيق مهارات ${topic} في سلسلة من المسائل المتصلة ضمن فرق تنافسية`,
          materials: ['السبورة', 'أوراق التتابع المطبوعة', 'مؤقت', 'أقلام ملونة (لون لكل فريق)'],
          teacherPreparation: 'قسّم الطلاب إلى فرق من 4-5 أفراد. اطبع ورقة تتابع لكل فريق. اشرح آلية التمرير: كل طالب يحل مسألة ويمرر الإجابة للتالي.',
          teacherNotes: ['تحقق أن الفرق متوازنة المستوى', 'شجّع التحقق من الإجابة قبل التمرير'],
          answerKey: [
            'المسألة 1: الإجابة الأولى (تُمرَّر للمسألة 2)',
            'المسألة 2: استخدم إجابة 1 + خطوة جديدة',
            'المسألة 3: استخدم إجابة 2 + خطوة جديدة',
            'المسألة 4: الإجابة النهائية للتتابع',
          ],
          printables: ['أوراق التتابع (نسخة لكل فريق)', 'لوحة النتائج'],
          assessment: 'قيّم صحة الإجابة النهائية وسرعة إنجاز التتابع. ناقش أين حدثت الأخطاء في السلسلة.',
          extensionChallenge: `اطلب من الفريق الفائز تصميم سلسلة تتابع جديدة لفريق آخر`,
          slides: [
            { slideNumber: 1, type: 'intro', title: '🏃 سباق التتابع', content: `سباق ${topic} التتابعي!\nكل فريق يحل سلسلة من 4 مسائل متصلة.\nإجابة كل مسألة هي المدخل للمسألة التالية.\nالفريق الذي ينتهي أولاً بإجابة صحيحة يفوز!`, durationSeconds: 0 },
            {
              slideNumber: 2, type: 'relay-problem', title: 'المسألة 1 من 4',
              content: `احسب القيمة الأولى:\nطبّق ${topic} على المعطيات التالية وأوجد (أ).\n\nمعطيات: حدّدها من الكتاب المدرسي`,
              hint: 'ابدأ بتحديد المعطيات وطبّق الخطوة الأولى',
              answer: 'أ = القيمة الأولى',
              durationSeconds: slideDuration,
              teacher: { expectedAnswer: `القيمة الأولى (أ) من تطبيق ${topic}`, commonMisconceptions: 'قد يخطئ الطلاب في تحديد المعطيات', teachingTips: 'تأكد أن كل فريق يكتب إجابته بوضوح قبل التمرير', suggestedQuestions: ['ما المعطى الذي تستخدمه في الخطوة الأولى؟'] },
            },
            {
              slideNumber: 3, type: 'relay-problem', title: 'المسألة 2 من 4',
              content: `استخدم (أ) من المسألة 1:\nالآن طبّق ${topic} مرة أخرى مع (أ) لإيجاد (ب).`,
              hint: 'استبدل (أ) في المعادلة الجديدة',
              answer: 'ب = القيمة الثانية',
              durationSeconds: slideDuration,
              teacher: { expectedAnswer: `القيمة الثانية (ب) باستخدام نتيجة (أ)`, commonMisconceptions: 'استخدام قيمة خاطئة من المسألة السابقة', teachingTips: 'اطلب من الفرق التحقق من (أ) قبل الانتقال' },
            },
            {
              slideNumber: 4, type: 'relay-problem', title: 'المسألة 3 من 4',
              content: `استخدم (ب) من المسألة 2:\nطبّق خاصية ${topic} الثانية مع (ب) لإيجاد (ج).`,
              hint: 'تذكّر الخاصية الثانية التي درسناها',
              answer: 'ج = القيمة الثالثة',
              durationSeconds: slideDuration,
              teacher: { expectedAnswer: `القيمة الثالثة (ج) باستخدام نتيجة (ب)`, commonMisconceptions: 'الخلط بين الخصائص المختلفة', teachingTips: 'ذكّر بالفرق بين الخاصيتين إذا لزم' },
            },
            {
              slideNumber: 5, type: 'relay-problem', title: 'المسألة الأخيرة 4 من 4',
              content: `المسألة النهائية!\nاستخدم (ج) من المسألة 3:\nطبّق ${topic} بالكامل لإيجاد الإجابة النهائية (د).`,
              hint: 'وحّد كل نتائجك لإيجاد الحل الكامل',
              answer: 'د = الإجابة النهائية',
              durationSeconds: slideDuration,
              teacher: { expectedAnswer: `الإجابة النهائية (د) لسلسلة التتابع`, commonMisconceptions: 'أخطاء التراكم من المسائل السابقة', teachingTips: 'ناقش مع الصف كيف تراكمت الأخطاء في السلسلة', suggestedQuestions: ['كيف أثّرت الخطأ في المسألة 1 على النتيجة النهائية؟'] },
            },
            { slideNumber: 6, type: 'summary', title: '🎉 اكتملت السلسلة!', content: `أحسنتم!\nاليوم طبّقتم ${topic} في سلسلة متكاملة.\n\nالدرس المهم:\n• كل خطوة تبني على السابقة\n• الدقة في البداية تضمن صحة النهاية\n• تحقق دائمًا قبل التمرير`, durationSeconds: 0 },
          ],
        };
      }
      return {
        activityName: `Relay Race – ${topic}`,
        activityType: 'relay',
        grade: req.grade,
        subject: req.subject,
        lesson: topic,
        duration: dur,
        difficulty: req.difficulty,
        groupType: req.groupType,
        learningObjective: `Apply ${topic} skills in a chain of connected problems within competing teams`,
        materials: ['Whiteboard', 'Printed relay sheets (one per team)', 'Timer', 'Coloured markers (one per team)'],
        teacherPreparation: 'Divide students into teams of 4-5. Print a relay sheet for each team. Explain the relay rule: each student solves a problem and passes their answer to the next.',
        teacherNotes: ['Balance teams by ability level', 'Encourage students to verify their answer before passing'],
        answerKey: [
          'Problem 1: First answer (passed to problem 2)',
          'Problem 2: Use answer 1 + a new step',
          'Problem 3: Use answer 2 + a new step',
          'Problem 4: Final answer for the relay chain',
        ],
        printables: ['Relay worksheets (one per team)', 'Scoreboard'],
        assessment: 'Evaluate the correctness of the final answer and completion speed. Discuss where errors entered the chain.',
        extensionChallenge: `Challenge the winning team to design their own relay chain for another team to solve`,
        slides: [
          { slideNumber: 1, type: 'intro', title: '🏃 Relay Race', content: `${topic} Relay Race!\nEach team solves a chain of 4 connected problems.\nYour answer to each problem feeds the next one.\nThe first team to finish with the correct final answer wins!`, durationSeconds: 0 },
          {
            slideNumber: 2, type: 'relay-problem', title: 'Problem 1 of 4',
            content: `Find the first value:\nApply ${topic} to the given data and find (a).\n\nData: see your printed relay sheet`,
            hint: 'Start by identifying the given data and apply the first step',
            answer: 'a = first value',
            durationSeconds: slideDuration,
            teacher: { expectedAnswer: `First value (a) from applying ${topic}`, commonMisconceptions: 'Students may misread the given data', teachingTips: 'Make sure each team writes their answer clearly before passing', suggestedQuestions: ['Which piece of data do you use in the first step?'] },
          },
          {
            slideNumber: 3, type: 'relay-problem', title: 'Problem 2 of 4',
            content: `Use (a) from Problem 1:\nNow apply ${topic} again with (a) to find (b).`,
            hint: 'Substitute (a) into the new expression',
            answer: 'b = second value',
            durationSeconds: slideDuration,
            teacher: { expectedAnswer: `Second value (b) using the result of (a)`, commonMisconceptions: 'Using a wrong value carried from the previous problem', teachingTips: 'Ask teams to double-check (a) before moving on' },
          },
          {
            slideNumber: 4, type: 'relay-problem', title: 'Problem 3 of 4',
            content: `Use (b) from Problem 2:\nApply the second property of ${topic} with (b) to find (c).`,
            hint: 'Recall the second property we studied',
            answer: 'c = third value',
            durationSeconds: slideDuration,
            teacher: { expectedAnswer: `Third value (c) using the result of (b)`, commonMisconceptions: 'Confusing the two main properties', teachingTips: 'Remind students of the distinction if needed' },
          },
          {
            slideNumber: 5, type: 'relay-problem', title: 'Final Problem 4 of 4',
            content: `FINAL PROBLEM!\nUse (c) from Problem 3:\nApply the full ${topic} process to find the final answer (d).`,
            hint: 'Combine all your results to reach the complete solution',
            answer: 'd = final answer',
            durationSeconds: slideDuration,
            teacher: { expectedAnswer: `Final answer (d) for the relay chain`, commonMisconceptions: 'Accumulated errors from earlier problems', teachingTips: 'Discuss with the class how early errors propagated through the chain', suggestedQuestions: ['How did an error in Problem 1 affect the final answer?'] },
          },
          { slideNumber: 6, type: 'summary', title: '🎉 Chain Complete!', content: `Outstanding!\nToday you applied ${topic} across a full connected chain.\n\nKey takeaways:\n• Each step builds on the previous one\n• Accuracy early guarantees a correct final answer\n• Always verify before passing`, durationSeconds: 0 },
        ],
      };
    }

    // ── Escape Challenge (default) ─────────────────────────────────────────────
    if (isAr) {
      return {
        activityName: `تحدي الهروب – ${topic}`,
        activityType: 'escape-challenge',
        grade: req.grade,
        subject: req.subject,
        lesson: topic,
        duration: dur,
        difficulty: req.difficulty,
        groupType: req.groupType,
        learningObjective: `حل معادلات ${topic} بأساليب متنوعة ضمن فريق`,
        materials: ['السبورة', 'أوراق التحديات المطبوعة', 'مؤقت', 'أقلام ملونة'],
        teacherPreparation: 'اطبع بطاقات التحديات الخمسة مسبقًا. رتّب الطلاب في مجموعات من 3-4 أفراد. اكتب الأكواد على السبورة عند الانتهاء من كل تحدٍّ.',
        teacherNotes: ['راقب المجموعات وقدّم تلميحات إضافية عند الحاجة', 'شجّع الطلاب على مناقشة أساليب الحل المختلفة'],
        answerKey: [
          'التحدي 1: س = -3، س = -4',
          'التحدي 2: س = 2، س = 3',
          'التحدي 3: س = ±3',
          'التحدي 4: س = 0، س = 4',
          'التحدي 5: س = 2 (جذر مزدوج)',
        ],
        printables: ['بطاقات التحديات', 'مفتاح الإجابات', 'شهادات الإنجاز'],
        assessment: 'راقب دقة الحلول وسرعة الإنجاز. ناقش الأخطاء الشائعة مع الصف في الختام.',
        extensionChallenge: 'صمّم معادلة تربيعية خاصة بك بحيث يكون مجموع الجذرين 5 وحاصل ضربهما 6.',
        slides: [
          {
            slideNumber: 1, type: 'intro',
            title: '🔐 مهمتكم',
            content: 'فريقك محاصر في مختبر الرياضيات!\nعليكم حل 5 تحديات للهروب في غضون ' + dur + ' دقيقة.\nكل تحدٍّ صحيح يمنحكم كودًا سريًا.',
            durationSeconds: 0,
          },
          {
            slideNumber: 2, type: 'challenge',
            title: 'التحدي 1 من 5',
            content: 'حلّ المعادلة:\nس² + 7س + 12 = 0',
            hint: 'حاول تحليل المعادلة: (س + ؟)(س + ؟) = 0',
            answer: 'س = -3، س = -4',
            unlockCode: '8',
            durationSeconds: slideDuration,
            teacher: {
              expectedAnswer: 'س² + 7س + 12 = (س + 3)(س + 4) = 0، إذن س = -3 أو س = -4',
              commonMisconceptions: 'قد ينسى الطلاب الإشارة السالبة عند كتابة الجذور',
              teachingTips: 'ذكّر الطلاب بأن حاصل ضرب العاملين = 12 ومجموعهما = 7',
              suggestedQuestions: ['ما العاملان اللذان حاصل ضربهما 12 ومجموعهما 7؟', 'كيف نتحقق من الإجابة؟'],
              differentiationTips: 'للطلاب المتقدمين: استخدم القانون العام للتحقق',
            },
          },
          {
            slideNumber: 3, type: 'reveal',
            title: '🔓 الكود 8 مفتوح!',
            content: 'أحسنتم! حصلتم على الكود الأول: 8\nسجّلوه في ورقتكم.',
            unlockCode: '8',
            durationSeconds: 0,
          },
          {
            slideNumber: 4, type: 'challenge',
            title: 'التحدي 2 من 5',
            content: 'حلّ المعادلة:\nس² - 5س + 6 = 0',
            hint: 'أوجد عددين حاصل ضربهما 6 ومجموعهما -5',
            answer: 'س = 2، س = 3',
            unlockCode: '4',
            durationSeconds: slideDuration,
            teacher: {
              expectedAnswer: '(س - 2)(س - 3) = 0، إذن س = 2 أو س = 3',
              commonMisconceptions: 'خلط الإشارات عند التحليل',
              teachingTips: 'اطلب من الطلاب رسم جدول بسيط للعاملين المحتملة',
              suggestedQuestions: ['ما علامة الجذرين هنا ولماذا؟'],
              differentiationTips: 'للطلاب الأقل تقدمًا: ارسم الدالة التربيعية وحدد نقاط التقاطع مع المحور السيني',
            },
          },
          {
            slideNumber: 5, type: 'reveal',
            title: '🔓 الكود 4 مفتوح!',
            content: 'رائع! الكود الثاني: 4',
            unlockCode: '4',
            durationSeconds: 0,
          },
          {
            slideNumber: 6, type: 'challenge',
            title: 'التحدي 3 من 5',
            content: 'حلّ المعادلة:\nس² - 9 = 0',
            hint: 'تذكّر قانون الفرق بين مربعين: أ² - ب² = (أ+ب)(أ-ب)',
            answer: 'س = 3، س = -3',
            unlockCode: '7',
            durationSeconds: slideDuration,
            teacher: {
              expectedAnswer: '(س-3)(س+3) = 0، إذن س = ±3',
              commonMisconceptions: 'نسيان الجذر السالب',
              teachingTips: 'وضّح أن ±3 تعني جذرين مختلفين',
              suggestedQuestions: ['لماذا توجد إجابتان؟', 'كيف نوثق الإجابة بشكل صحيح؟'],
              differentiationTips: 'يمكن حلّها أيضًا بإضافة 9 للطرفين ثم أخذ الجذر',
            },
          },
          {
            slideNumber: 7, type: 'reveal',
            title: '🔓 الكود 7 مفتوح!',
            content: 'ممتاز! الكود الثالث: 7',
            unlockCode: '7',
            durationSeconds: 0,
          },
          {
            slideNumber: 8, type: 'challenge',
            title: 'التحدي 4 من 5',
            content: 'حلّ المعادلة:\n2س² - 8س = 0',
            hint: 'أخرج العامل المشترك أولًا',
            answer: 'س = 0، س = 4',
            unlockCode: '3',
            durationSeconds: slideDuration,
            teacher: {
              expectedAnswer: '2س(س - 4) = 0، إذن س = 0 أو س = 4',
              commonMisconceptions: 'قسمة طرفي المعادلة على س وإهمال الحل س = 0',
              teachingTips: 'نبّه الطلاب إلى خطأ القسمة على المجهول',
              suggestedQuestions: ['لماذا لا يمكن القسمة على س مباشرةً؟'],
              differentiationTips: 'للمتقدمين: طبّق القانون العام وقارن النتائج',
            },
          },
          {
            slideNumber: 9, type: 'reveal',
            title: '🔓 الكود 3 مفتوح!',
            content: 'عظيم! الكود الرابع: 3',
            unlockCode: '3',
            durationSeconds: 0,
          },
          {
            slideNumber: 10, type: 'challenge',
            title: 'التحدي الأخير 5 من 5',
            content: 'التحدي النهائي!\nحلّ المعادلة:\nس² - 4س + 4 = 0',
            hint: 'هل هذا مربع كامل؟ (س - ؟)² = 0',
            answer: 'س = 2 (جذر مزدوج)',
            unlockCode: '6',
            durationSeconds: slideDuration,
            teacher: {
              expectedAnswer: '(س - 2)² = 0، إذن س = 2 (جذر مزدوج)',
              commonMisconceptions: 'توقع جذرين مختلفين دائمًا',
              teachingTips: 'اشرح مفهوم الجذر المزدوج وعلاقته بالمميّز = صفر',
              suggestedQuestions: ['ما قيمة المميّز في هذه المعادلة؟', 'ماذا يعني الجذر المزدوج هندسيًا؟'],
              differentiationTips: 'للمتقدمين: ارسم الدالة وتحقق من أن القطع المكافئ يلمس المحور السيني في نقطة واحدة',
            },
          },
          {
            slideNumber: 11, type: 'reveal',
            title: '🔓 الكود 6 مفتوح!',
            content: 'التحدي الأخير انتهى! الكود الخامس: 6',
            unlockCode: '6',
            durationSeconds: 0,
          },
          {
            slideNumber: 12, type: 'summary',
            title: '🎉 لقد هربتم!',
            content: 'أحسنتم! فريقكم نجح في الهروب!\nالكود الكامل: 8 – 4 – 7 – 3 – 6\n\nحللتم اليوم:\n• التحليل إلى عوامل\n• الفرق بين مربعين\n• إخراج العامل المشترك\n• المربع الكامل',
            durationSeconds: 0,
          },
        ],
      };
    }

    // English mock
    return {
      activityName: `Escape Challenge – ${topic}`,
      activityType: 'escape-challenge',
      grade: req.grade,
      subject: req.subject,
      lesson: topic,
      duration: dur,
      difficulty: req.difficulty,
      groupType: req.groupType,
      learningObjective: `Solve ${topic} equations using multiple techniques as a team`,
      materials: ['Whiteboard', 'Printed challenge cards', 'Timer', 'Coloured markers'],
      teacherPreparation: 'Print the five challenge cards in advance. Arrange students into groups of 3-4. Reveal each code on the board as groups complete each challenge.',
      teacherNotes: ['Monitor groups and provide extra hints if needed', 'Encourage discussion of different solution methods'],
      answerKey: [
        'Challenge 1: x = -3, x = -4',
        'Challenge 2: x = 2, x = 3',
        'Challenge 3: x = ±3',
        'Challenge 4: x = 0, x = 4',
        'Challenge 5: x = 2 (double root)',
      ],
      printables: ['Challenge cards', 'Answer key', 'Completion certificates'],
      assessment: 'Monitor solution accuracy and speed. Discuss common mistakes with the class at the end.',
      extensionChallenge: 'Design your own quadratic equation where the sum of roots is 5 and the product is 6.',
      slides: [
        {
          slideNumber: 1, type: 'intro',
          title: '🔐 Your Mission',
          content: 'Your team is trapped in the Math Lab!\nSolve 5 challenges to escape within ' + dur + ' minutes.\nEach correct answer unlocks a secret code.',
          durationSeconds: 0,
        },
        {
          slideNumber: 2, type: 'challenge',
          title: 'Challenge 1 of 5',
          content: 'Solve the equation:\nx² + 7x + 12 = 0',
          hint: 'Try factoring: (x + ?)(x + ?) = 0',
          answer: 'x = -3 and x = -4',
          unlockCode: '8',
          durationSeconds: slideDuration,
          teacher: {
            expectedAnswer: 'x² + 7x + 12 = (x + 3)(x + 4) = 0, so x = -3 or x = -4',
            commonMisconceptions: 'Students may forget the negative signs when writing the roots',
            teachingTips: 'Remind students: two numbers that multiply to 12 and add to 7',
            suggestedQuestions: ['What two numbers multiply to 12 and add to 7?', 'How do we verify the answer?'],
            differentiationTips: 'Advanced: use the quadratic formula to verify',
          },
        },
        {
          slideNumber: 3, type: 'reveal',
          title: '🔓 Code 8 Unlocked!',
          content: 'Great work! You got the first code: 8\nWrite it down on your sheet.',
          unlockCode: '8',
          durationSeconds: 0,
        },
        {
          slideNumber: 4, type: 'challenge',
          title: 'Challenge 2 of 5',
          content: 'Solve the equation:\nx² − 5x + 6 = 0',
          hint: 'Find two numbers with product 6 and sum −5',
          answer: 'x = 2 and x = 3',
          unlockCode: '4',
          durationSeconds: slideDuration,
          teacher: {
            expectedAnswer: '(x − 2)(x − 3) = 0, so x = 2 or x = 3',
            commonMisconceptions: 'Mixing up signs during factoring',
            teachingTips: 'Ask students to draw a quick factor table',
            suggestedQuestions: ['What is the sign of the roots and why?'],
            differentiationTips: 'For lower ability: graph the parabola and identify x-intercepts',
          },
        },
        {
          slideNumber: 5, type: 'reveal',
          title: '🔓 Code 4 Unlocked!',
          content: 'Excellent! Second code: 4',
          unlockCode: '4',
          durationSeconds: 0,
        },
        {
          slideNumber: 6, type: 'challenge',
          title: 'Challenge 3 of 5',
          content: 'Solve the equation:\nx² − 9 = 0',
          hint: 'Recall the difference of squares: a² − b² = (a+b)(a−b)',
          answer: 'x = 3 and x = −3',
          unlockCode: '7',
          durationSeconds: slideDuration,
          teacher: {
            expectedAnswer: '(x − 3)(x + 3) = 0, so x = ±3',
            commonMisconceptions: 'Forgetting the negative root',
            teachingTips: 'Emphasise that ±3 means two distinct solutions',
            suggestedQuestions: ['Why are there two answers?'],
            differentiationTips: 'Can also be solved by adding 9 to both sides, then taking the square root',
          },
        },
        {
          slideNumber: 7, type: 'reveal',
          title: '🔓 Code 7 Unlocked!',
          content: 'Brilliant! Third code: 7',
          unlockCode: '7',
          durationSeconds: 0,
        },
        {
          slideNumber: 8, type: 'challenge',
          title: 'Challenge 4 of 5',
          content: 'Solve the equation:\n2x² − 8x = 0',
          hint: 'Factor out the common term first',
          answer: 'x = 0 and x = 4',
          unlockCode: '3',
          durationSeconds: slideDuration,
          teacher: {
            expectedAnswer: '2x(x − 4) = 0, so x = 0 or x = 4',
            commonMisconceptions: 'Dividing both sides by x and losing x = 0',
            teachingTips: 'Warn students: never divide both sides by the variable',
            suggestedQuestions: ['Why can\'t we divide both sides by x?'],
            differentiationTips: 'Advanced: apply the quadratic formula and compare',
          },
        },
        {
          slideNumber: 9, type: 'reveal',
          title: '🔓 Code 3 Unlocked!',
          content: 'Amazing! Fourth code: 3',
          unlockCode: '3',
          durationSeconds: 0,
        },
        {
          slideNumber: 10, type: 'challenge',
          title: 'Final Challenge 5 of 5',
          content: 'FINAL CHALLENGE!\nSolve the equation:\nx² − 4x + 4 = 0',
          hint: 'Is this a perfect square? (x − ?)² = 0',
          answer: 'x = 2 (double root)',
          unlockCode: '6',
          durationSeconds: slideDuration,
          teacher: {
            expectedAnswer: '(x − 2)² = 0, so x = 2 (double root)',
            commonMisconceptions: 'Expecting two different roots every time',
            teachingTips: 'Explain the double root concept and its relation to discriminant = 0',
            suggestedQuestions: ['What is the discriminant here?', 'What does a double root mean graphically?'],
            differentiationTips: 'Advanced: sketch the parabola and verify it touches the x-axis at one point',
          },
        },
        {
          slideNumber: 11, type: 'reveal',
          title: '🔓 Code 6 Unlocked!',
          content: 'Last challenge solved! Fifth code: 6',
          unlockCode: '6',
          durationSeconds: 0,
        },
        {
          slideNumber: 12, type: 'summary',
          title: '🎉 You Escaped!',
          content: 'Outstanding! Your team escaped the Math Lab!\nFull code: 8 – 4 – 7 – 3 – 6\n\nToday you practised:\n• Factoring quadratics\n• Difference of squares\n• Common factor extraction\n• Perfect square trinomials',
          durationSeconds: 0,
        },
      ],
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
// Legacy mock export kept for fallback use inside RemoteAIService
