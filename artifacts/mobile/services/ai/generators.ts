import { AIService } from './AIService.ts';
import type {
  ActivityOutput, ActivityStep, AIRequest,
  ClassroomActivity, ClassroomActivityRequest,
  LessonPlanOutput,
  QuizOutput, QuizQuestion, WorksheetAnswerKeyItem,
  WorksheetOutput, WorksheetSection,
} from './AIService.ts';
import type { KBLesson } from '../knowledgeBase.ts';
import { getUnitForLesson, resolveGroundedKbLesson } from '../knowledgeBase.ts';
import {
  parseDocumentGrounding,
  type DocumentGrounding,
} from '../documents/grounding.ts';
import {
  beginMathPracticeSession,
  isMathContext,
  takeConcreteMath,
  takeConcreteMathBatch,
  type DiffTier,
} from './mathPractice.ts';
import { classifyVerifiableTopic } from './verifyMathGuards.ts';

/**
 * Symbolic verification, loaded lazily.
 *
 * verifyMath pulls in apiClient → expo-secure-store, which cannot be
 * type-stripped by the Node test runner. Importing it at module scope would
 * make generators.ts unloadable in tests, so it is resolved on demand and
 * degrades to the honest 'bank' label whenever it is unavailable.
 */
type VerifyOutcome = { verifiedBy: 'symbolic' | 'bank'; computedAnswer?: string };
const BANK_OUTCOME: VerifyOutcome = { verifiedBy: 'bank' };

async function verifyIfPossible(
  question: string,
  answer: string,
  distractors: string[],
): Promise<VerifyOutcome> {
  // Skip the round trip entirely when nothing could be proven anyway.
  if (!classifyVerifiableTopic(question)) return BANK_OUTCOME;
  try {
    const mod = await import('./verifyMath.ts');
    return await mod.verifyMathItem(question, answer, distractors);
  } catch {
    return BANK_OUTCOME;
  }
}

type Lang = 'ar' | 'en';
type QType = 'multiple_choice' | 'short_answer' | 'fill_blank' | 'true_false' | 'word_problem';
interface WQ { text: string; options?: string[]; answer: string; points: number }

/** KB lesson only when the topic clears the grounding confidence bar. */
function groundedKb(topic: string, lang: Lang): KBLesson | null {
  return resolveGroundedKbLesson(topic, lang);
}

function docsFromReq(req: AIRequest): DocumentGrounding {
  return parseDocumentGrounding(req.additionalContext);
}

function lpObjectivesFromDocs(
  topic: string,
  docs: DocumentGrounding,
  lang: Lang,
): string[] | null {
  if (!docs.present) return null;
  if (docs.objectives.length >= 2) return docs.objectives.slice(0, 4);
  if (docs.concepts.length) {
    const c = docs.concepts;
    if (lang === 'ar') {
      return [
        `أن يُعرِّف الطالب ${c[0]} (من المواد المرفوعة)`,
        c[1] ? `أن يشرح الطالب ${c[1]} بأمثلة من الملف` : `أن يطبق مفهوم ${topic} مستندًا إلى الملف`,
        `أن يحل تمارين مرتبطة بـ«${topic}» بمستويات متدرجة`,
      ];
    }
    return [
      `Students define ${c[0]} (from uploaded materials)`,
      c[1] ? `Students explain ${c[1]} with examples from the file` : `Students apply ${topic} using the uploaded file`,
      `Students solve progressive practice on “${topic}”`,
    ];
  }
  return null;
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Place `correct` at a random position among the wrongs for MC questions */
function placeCorrect(correct: string, wrongs: string[]): string[] {
  const pos = Math.floor(Math.random() * (wrongs.length + 1));
  return [...wrongs.slice(0, pos), correct, ...wrongs.slice(pos)];
}

/** Normalize question stem for duplicate detection (ignore answer-space padding). */
function questionStemKey(text: string): string {
  return text
    .replace(/\n\n(?:الإجابة|Answer|مساحة العمل|Work space):[\s\S]*$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Shared entry: concrete math practice, else null (caller may use non-math templates). */
function tryMathPractice(
  type: QType,
  topic: string,
  kb: KBLesson | null,
  diff: string,
  lang: Lang,
  points: number,
  subject?: string,
): WQ | null {
  if (!isMathContext(topic, kb, subject)) return null;
  const tier: DiffTier = diff === 'easy' || diff === 'hard' ? diff : 'medium';
  return takeConcreteMath(type, topic, kb, tier, lang, points);
}

// ─── Lesson Plan helpers (Arabic) ────────────────────────────────────────────

function lpObjectivesAr(topic: string, kb: KBLesson | null, custom?: string): string[] {
  if (custom?.trim()) return custom.trim().split('\n').filter(Boolean);
  // Prefer official curriculum outcomes when present on the KB lesson
  if (kb?.objectives?.length) return [...kb.objectives];
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
  if (kb?.objectives?.length) return [...kb.objectives];
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

function makeMCQ_ar(topic: string, kb: KBLesson | null, diff: string, subject?: string): WQ {
  const pts = mcPts(diff);
  const math = tryMathPractice('multiple_choice', topic, kb, diff, 'ar', pts, subject);
  if (math) return math;
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

function makeSAQ_ar(topic: string, kb: KBLesson | null, diff: string, subject?: string): WQ {
  const pts = saPts(diff);
  const math = tryMathPractice('short_answer', topic, kb, diff, 'ar', pts, subject);
  if (math) return math;
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

function makeFBQ_ar(topic: string, kb: KBLesson | null, diff: string, subject?: string): WQ {
  const pts = fbPts(diff);
  const math = tryMathPractice('fill_blank', topic, kb, diff, 'ar', pts, subject);
  if (math) return math;
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

function makeTFQ_ar(topic: string, kb: KBLesson | null, _diff: string, subject?: string): WQ {
  const pts = tfPts(_diff);
  const math = tryMathPractice('true_false', topic, kb, _diff, 'ar', pts, subject);
  if (math) return math;
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

/** Real-life word problem aligned with "حل مسائل حياتية" curriculum phrasing. */
function makeWPQ_ar(topic: string, kb: KBLesson | null, diff: string, subject?: string): WQ {
  const pts = saPts(diff);
  const math = tryMathPractice('word_problem', topic, kb, diff, 'ar', pts, subject);
  if (math) return math;
  const c0 = kb?.keyConceptsAr?.[0] ?? topic;
  const obj = kb?.objectives?.find(o => /حياتي|مسألة|نمذج/.test(o));
  const templates: Array<() => WQ> = [
    () => ({
      text: `مسألة حياتية: يحتاج محلّ تجاري إلى تطبيق «${topic}» لحساب تكلفة عرض ترويجي. اكتب المعطيات اللازمة، ثم حل المسألة مبيّنًا خطواتك.`,
      answer: `نمذجة الموقف بمفاهيم ${topic}، ثم الحل خطوة بخطوة والتحقق من المعقولية.`,
      points: pts,
    }),
    () => ({
      text: `مسألة حياتية: تريد عائلة تخطيط ميزانية أسبوعية باستخدام ${c0}. صِغ مسألة من واقع الحياة تتطلب ${topic}، ثم حلّها.`,
      answer: `صياغة موقف حقيقي + تطبيق ${topic} + إجابة عددية مع وحدات إن لزم.`,
      points: pts,
    }),
    () => ({
      text: obj
        ? `مسألة حياتية مرتبطة بنتاج الدرس («${obj}»): صف موقفًا يوميًا، ثم حلّه باستعمال ${topic}.`
        : `مسألة حياتية: مهندس يحتاج ${topic} لتقدير كمية مواد لمشروع صغير. اكتب المعطيات وحل المسألة.`,
      answer: `تحديد المعطيات والمطلوب، اختيار الأسلوب المناسب لـ${topic}، الحل والتحقق.`,
      points: pts,
    }),
  ];
  return pick(templates)();
}

function makePriorReviewQ_ar(concept: string): WQ {
  return {
    text: `مراجعة: اشرح مفهوم «${concept}» بإيجاز، واذكر مثالًا واحدًا يوضح فهمك.`,
    answer: `تعريف موجز لـ«${concept}» + مثال صحيح.`,
    points: 3,
  };
}

// ─── English question factories ───────────────────────────────────────────────

function makeMCQ_en(topic: string, kb: KBLesson | null, diff: string, subject?: string): WQ {
  const pts = mcPts(diff);
  const math = tryMathPractice('multiple_choice', topic, kb, diff, 'en', pts, subject);
  if (math) return math;
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

function makeSAQ_en(topic: string, kb: KBLesson | null, diff: string, subject?: string): WQ {
  const pts = saPts(diff);
  const math = tryMathPractice('short_answer', topic, kb, diff, 'en', pts, subject);
  if (math) return math;
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

function makeFBQ_en(topic: string, kb: KBLesson | null, diff: string, subject?: string): WQ {
  const pts = fbPts(diff);
  const math = tryMathPractice('fill_blank', topic, kb, diff, 'en', pts, subject);
  if (math) return math;
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

function makeTFQ_en(topic: string, kb: KBLesson | null, _diff: string, subject?: string): WQ {
  const pts = tfPts(_diff);
  const math = tryMathPractice('true_false', topic, kb, _diff, 'en', pts, subject);
  if (math) return math;
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

/** Real-life word problem aligned with curriculum "solve real-life problems" outcomes. */
function makeWPQ_en(topic: string, kb: KBLesson | null, diff: string, subject?: string): WQ {
  const pts = saPts(diff);
  const math = tryMathPractice('word_problem', topic, kb, diff, 'en', pts, subject);
  if (math) return math;
  const c0 = kb?.keyConceptsEn?.[0] ?? topic;
  const templates: Array<() => WQ> = [
    () => ({
      text: `Real-life problem: A shop needs to apply “${topic}” to price a promotion. List the given information, then solve step by step.`,
      answer: `Model the situation with ${topic}, solve step by step, and check reasonableness.`,
      points: pts,
    }),
    () => ({
      text: `Real-life problem: A family is planning a weekly budget using ${c0}. Write a everyday scenario that requires ${topic}, then solve it.`,
      answer: `Clear real-world setup + application of ${topic} + numerical answer with units if needed.`,
      points: pts,
    }),
    () => ({
      text: `Real-life problem: An engineer needs ${topic} to estimate materials for a small project. State the givens and solve.`,
      answer: `Identify givens and goal, choose a ${topic} method, solve and verify.`,
      points: pts,
    }),
  ];
  return pick(templates)();
}

function makePriorReviewQ_en(concept: string): WQ {
  return {
    text: `Review: Briefly explain “${concept}” and give one example that shows your understanding.`,
    answer: `Short definition of “${concept}” + one correct example.`,
    points: 3,
  };
}

// ─── Section title builders ───────────────────────────────────────────────────

function sectionTitleAr(type: QType, pts: number): string {
  return {
    multiple_choice: `أولًا – اختيار متعدد [${pts} نقطة]`,
    short_answer: `ثانيًا – إجابة قصيرة [${pts} نقطة]`,
    fill_blank: `ثالثًا – إكمال الفراغات [${pts} نقطة]`,
    true_false: `رابعًا – صح أو خطأ [${pts} نقطة]`,
    word_problem: `خامسًا – مسألة حياتية [${pts} نقطة]`,
  }[type];
}
function sectionTitleEn(type: QType, pts: number): string {
  return {
    multiple_choice: `Section A – Multiple Choice [${pts} pts]`,
    short_answer: `Section B – Short Answer [${pts} pts]`,
    fill_blank: `Section C – Fill in the Blanks [${pts} pts]`,
    true_false: `Section D – True or False [${pts} pts]`,
    word_problem: `Section E – Real-life word problem [${pts} pts]`,
  }[type];
}

// ─── Quiz question factories ──────────────────────────────────────────────────

function makeQuizMCQ_ar(topic: string, kb: KBLesson | null, pts: number, id: string, subject?: string): QuizQuestion {
  const q = makeMCQ_ar(topic, kb, 'medium', subject);
  return { id, type: 'multiple_choice', text: q.text, options: q.options, correctAnswer: q.answer, points: pts, explanation: `${q.answer} — راجع ${kb?.titleAr ?? topic} في الكتاب المدرسي.` };
}
function makeQuizMCQ_en(topic: string, kb: KBLesson | null, pts: number, id: string, subject?: string): QuizQuestion {
  const q = makeMCQ_en(topic, kb, 'medium', subject);
  return { id, type: 'multiple_choice', text: q.text, options: q.options, correctAnswer: q.answer, points: pts, explanation: `${q.answer} — See ${kb?.titleEn ?? topic} in the textbook.` };
}

function makeQuizTF_ar(topic: string, kb: KBLesson | null, pts: number, id: string, subject?: string): QuizQuestion {
  const q = makeTFQ_ar(topic, kb, 'medium', subject);
  return { id, type: 'true_false', text: q.text, options: ['صح', 'خطأ'], correctAnswer: q.answer, points: pts, explanation: `الإجابة "${q.answer}" — ${q.text}` };
}
function makeQuizTF_en(topic: string, kb: KBLesson | null, pts: number, id: string, subject?: string): QuizQuestion {
  const q = makeTFQ_en(topic, kb, 'medium', subject);
  return { id, type: 'true_false', text: q.text, options: ['True', 'False'], correctAnswer: q.answer, points: pts, explanation: `The answer is "${q.answer}" — ${q.text}` };
}

function makeQuizSA_ar(topic: string, kb: KBLesson | null, pts: number, id: string, subject?: string): QuizQuestion {
  const q = makeSAQ_ar(topic, kb, 'medium', subject);
  return { id, type: 'short_answer', text: q.text, correctAnswer: q.answer, points: pts, explanation: `إجابة كاملة: ${q.answer}` };
}
function makeQuizSA_en(topic: string, kb: KBLesson | null, pts: number, id: string, subject?: string): QuizQuestion {
  const q = makeSAQ_en(topic, kb, 'medium', subject);
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
    const docs = docsFromReq(req);
    const rawTopic = req.topic;
    const isSimplify =
      /تبسيط|بسّط|بسط|simplify/i.test(rawTopic)
      || /تبسيط|simplify/i.test(req.objectives ?? '')
      || (/simplify/i.test(req.additionalContext ?? '') && !docs.present);
    const topic = (
      docs.present && docs.title
        ? docs.title
        : rawTopic
            .replace(/^(تبسيط\s*الشرح|بسّط\s*الشرح|بسط\s*الشرح|simplify(\s+explanation)?)\s*[:：\-]?\s*/i, '')
            .trim()
    ) || rawTopic;
    const kb = docs.present ? null : groundedKb(topic, lang);
    const dur = req.duration ?? 45;
    const style = req.teachingStyle ?? 'direct';
    const fileLabel = docs.fileNames[0]
      ? (lang === 'ar' ? `الملف «${docs.fileNames[0]}»` : `file “${docs.fileNames[0]}”`)
      : (lang === 'ar' ? 'المواد المرفوعة' : 'the uploaded materials');
    const conceptLine = docs.concepts.slice(0, 3).join(lang === 'ar' ? ' · ' : ' · ');
    const exampleLine = docs.examples[0] || docs.plainSnippets[0] || '';
    const docObjectives = lpObjectivesFromDocs(topic, docs, lang);

    if (isSimplify) {
      if (lang === 'ar') {
        return {
          title: `تبسيط الشرح – ${topic}`,
          grade: req.grade, subject: req.subject, duration: Math.min(dur, 20),
          objectives: [
            `يفهم الطالب فكرة «${topic}» بلغة بسيطة`,
            'يربط المفهوم بمثال من الحياة اليومية',
            'يعيد شرح الفكرة بجملة أو جملتين',
          ],
          materials: ['سبورة', 'مثال بصري بسيط', 'بطاقة جملة مفتاحية'],
          introduction: `اليوم سنبسّط «${topic}» دون مصطلحات معقّدة. ابدأ بسؤال: ماذا تعرف أصلاً عن هذا الموضوع؟`,
          mainActivity:
            `الشرح المبسط لـ«${topic}»:\n`
            + `1) الفكرة بجملة واحدة: ${kb?.summaryAr ?? docs.summary ?? `«${topic}» تعني فهم العلاقة الأساسية خطوة بخطوة.`}\n`
            + '2) مثال من الحياة: اختر موقفاً مألوفاً للطلاب واربطه بالفكرة.\n'
            + '3) قاعدة ذهبية قصيرة يحفظها الطالب.\n'
            + '4) خطأ شائع واحد وكيف نتجنّبه.',
          guidedPractice: `معاً: حلّ مثالاً واحداً سهِّلاً على «${topic}» مع تفكير بصوت عالٍ وبكلمات بسيطة فقط.`,
          independentPractice: 'اطلب من كل طالب إعادة الشرح لزميله بجملتين فقط، ثم صحّح أي تعقيد لغوي.',
          closure: `اطلب جملة ختامية: «${topic} يعني …» واكتب أفضل صياغة مبسطة على السبورة.`,
          assessment: 'تحقق سريع شفهي: اسأل 3 طلاب أن يشرحوا الفكرة دون النظر للدفتر.',
          differentiation: 'للمتعثرين: مثال واحد إضافي بصري. للمتقدمين: اطلب مثالاً حياتياً جديداً من عندهم.',
          homework: 'اكتب في المنزل شرحاً مبسطاً لـ«' + topic + '» في 4–5 أسطر لمبتدئ.',
        };
      }
      return {
        title: `Simplified Explanation – ${topic}`,
        grade: req.grade, subject: req.subject, duration: Math.min(dur, 20),
        objectives: [
          `Students understand “${topic}” in plain language`,
          'Students connect the idea to a real-life example',
          'Students restate the idea in one or two sentences',
        ],
        materials: ['Board', 'Simple visual example', 'Key-sentence card'],
        introduction: `Today we simplify “${topic}” without heavy jargon. Start with: What do you already know?`,
        mainActivity:
          `Plain-language breakdown of “${topic}”:\n`
          + `1) One-sentence idea: ${kb?.summaryEn ?? docs.summary ?? `“${topic}” means understanding the core relationship step by step.`}\n`
          + '2) Real-life example students already know.\n'
          + '3) One golden rule to remember.\n'
          + '4) One common mistake and how to avoid it.',
        guidedPractice: `Together: solve one easy example on “${topic}” while thinking aloud in simple words only.`,
        independentPractice: 'Pair share: each student explains the idea in two sentences; coach away jargon.',
        closure: `Exit line: “${topic} means …” — capture the clearest student wording on the board.`,
        assessment: 'Quick oral check: three students explain the idea without notes.',
        differentiation: 'Support: one extra visual. Stretch: invent a new real-life example.',
        homework: `At home, write a 4–5 sentence plain explanation of “${topic}” for a beginner.`,
      };
    }

    // Document-grounded lesson plan (Demo Mode) — prefer uploaded materials over KB soft pin
    if (docs.present) {
      if (lang === 'ar') {
        return {
          title: `${topic} – خطة درس`,
          grade: req.grade, subject: req.subject, duration: dur,
          objectives: docObjectives ?? lpObjectivesAr(topic, null, req.objectives),
          materials: [
            fileLabel.replace(/^الملف /, 'الملف المرفوع: ').replace(/^الملف$/, 'المواد المرفوعة'),
            ...lpMaterialsAr(req.subject).slice(0, 3),
          ],
          introduction:
            `اعتمادًا على ${fileLabel}: ابدأ بعرض فكرة من الملف واسأل: «ماذا نعرف عن ${topic}؟»`
            + (conceptLine ? ` سجّل المفاهيم الظاهرة: ${conceptLine}.` : '')
            + (docs.summary ? ` ملخص الملف: ${docs.summary}` : ''),
          mainActivity:
            `(${Math.round(dur * 0.3)} دقيقة) – شرح مباشر من المواد المرفوعة:\n\n`
            + (conceptLine
              ? conceptLine.split(' · ').map((c, i) => `${i + 1}. اشرح «${c}» مع مثال من الملف.`).join('\n')
              : `1. اشرح المفهوم الرئيسي لـ«${topic}» كما يظهر في الملف.\n2. قدّم مثالين متدرجين.\n3. اكتب الخطوات على السبورة.`)
            + (exampleLine ? `\n\nمثال جاهز من الملف:\n• ${exampleLine}` : ''),
          guidedPractice:
            `(${Math.round(dur * 0.22)} دقيقة) – "نحن نفعل":\n\n`
            + `• حل مثال مشترك مستمد من ${fileLabel} مع مشاركة الطلاب في كل خطوة.\n`
            + '• أسئلة استرشادية: ماذا نفعل أولًا؟ كيف يرتبط هذا بهدف الدرس؟\n'
            + '• صحّح المفاهيم الخاطئة فور ظهورها.',
          independentPractice: lpIndependentAr(dur),
          closure: lpClosureAr(topic, dur),
          assessment:
            `تقويم تكويني مرتبط بـ${fileLabel}: سؤالان قصيران على المفاهيم`
            + (conceptLine ? ` (${docs.concepts.slice(0, 2).join(' / ')})` : '')
            + ' + بطاقة خروج بجملة واحدة.',
          differentiation: lpDifferentiation(topic, 'ar'),
          homework: `واجب قصير من نفس محور ${fileLabel}: تمرينان + جملة تلخيص عن «${topic}».`,
        };
      }
      return {
        title: `${topic} – Lesson Plan`,
        grade: req.grade, subject: req.subject, duration: dur,
        objectives: docObjectives ?? lpObjectivesEn(topic, null, req.objectives),
        materials: [
          `Uploaded: ${docs.fileNames[0] ?? 'teacher materials'}`,
          ...lpMaterialsEn(req.subject).slice(0, 3),
        ],
        introduction:
          `Using ${fileLabel}: open with one idea from the file and ask “What do we already know about ${topic}?”`
          + (conceptLine ? ` Capture visible concepts: ${conceptLine}.` : '')
          + (docs.summary ? ` File summary: ${docs.summary}` : ''),
        mainActivity:
          `(${Math.round(dur * 0.3)} min) – Direct teach from uploaded materials:\n\n`
          + (conceptLine
            ? conceptLine.split(' · ').map((c, i) => `${i + 1}. Explain “${c}” with an example from the file.`).join('\n')
            : `1. Teach the core idea of “${topic}” as it appears in the file.\n2. Give two progressive examples.\n3. Model steps on the board.`)
          + (exampleLine ? `\n\nFile-ready example:\n• ${exampleLine}` : ''),
        guidedPractice:
          `(${Math.round(dur * 0.22)} min) – We do:\n\n`
          + `• Work one shared example drawn from ${fileLabel} with student voices at each step.\n`
          + '• Prompt: What first? How does this link to today’s objective?\n'
          + '• Correct misconceptions immediately.',
        independentPractice: lpIndependentEn(dur),
        closure: lpClosureEn(topic, dur),
        assessment:
          `Formative check tied to ${fileLabel}: two short items on`
          + (conceptLine ? ` ${docs.concepts.slice(0, 2).join(' / ')}` : ' key ideas')
          + ' + one-sentence exit ticket.',
        differentiation: lpDifferentiation(topic, 'en'),
        homework: `Short homework from the same ${fileLabel} thread: two practice items + one summary sentence on “${topic}”.`,
      };
    }

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
    beginMathPracticeSession();
    const lang: Lang = req.language === 'arabic' ? 'ar' : 'en';
    const docs = docsFromReq(req);
    const topic = (docs.present && docs.title) ? docs.title : req.topic;
    // Prefer uploaded materials over a weakly matching KB lesson
    const kb = docs.present ? null : groundedKb(topic, lang);
    const selectedTypes: QType[] = (req.questionTypes as QType[])?.length
      ? (req.questionTypes as QType[])
      : ['multiple_choice', 'short_answer'];
    const wantsWordProblem = selectedTypes.includes('word_problem');
    const mainTypes = selectedTypes.filter(t => t !== 'word_problem');
    if (mainTypes.length === 0) mainTypes.push('short_answer');

    // In-class practice: progressive difficulty (easy → medium → hard)
    const totalQ = Math.min(12, Math.max(6, req.numQuestions ?? 8));
    const priorConcepts = req.includePriorReview && req.priorKnowledge?.length
      ? req.priorKnowledge
      : [];
    const priorCount = priorConcepts.length > 0
      ? Math.min(3, Math.max(2, Math.min(priorConcepts.length, 3)))
      : 0;
    const mainTotal = Math.max(1, totalQ - (wantsWordProblem ? 1 : 0));

    const answerSpace = lang === 'ar'
      ? '\n\nالإجابة:\n_________________________________\n_________________________________'
      : '\n\nAnswer:\n_________________________________\n_________________________________';

    const sections: WorksheetSection[] = [];
    const answerKey: WorksheetAnswerKeyItem[] = [];
    let qNum = 1;

    const usedStems = new Set<string>();

    const makeGenericQ = (type: QType, diff: DiffTier): WQ => {
      if (lang === 'ar') {
        if (type === 'multiple_choice') return makeMCQ_ar(topic, kb, diff, req.subject);
        if (type === 'short_answer') return makeSAQ_ar(topic, kb, diff, req.subject);
        if (type === 'fill_blank') return makeFBQ_ar(topic, kb, diff, req.subject);
        if (type === 'word_problem') return makeWPQ_ar(topic, kb, diff, req.subject);
        return makeTFQ_ar(topic, kb, diff, req.subject);
      }
      if (type === 'multiple_choice') return makeMCQ_en(topic, kb, diff, req.subject);
      if (type === 'short_answer') return makeSAQ_en(topic, kb, diff, req.subject);
      if (type === 'fill_blank') return makeFBQ_en(topic, kb, diff, req.subject);
      if (type === 'word_problem') return makeWPQ_en(topic, kb, diff, req.subject);
      return makeTFQ_en(topic, kb, diff, req.subject);
    };

    /** Main-body question via shared factories (math → concrete practice). Dedup stems. */
    const makeQ = (type: QType, diff: DiffTier): WQ => {
      for (let attempt = 0; attempt < 12; attempt++) {
        const q = makeGenericQ(type, diff);
        const key = questionStemKey(q.text);
        if (!usedStems.has(key)) {
          usedStems.add(key);
          return q;
        }
      }
      const fallback = makeGenericQ(type, diff);
      usedStems.add(questionStemKey(fallback.text));
      return fallback;
    };

    const pushQuestion = (type: QType, q: WQ, withSpace: boolean) => {
      let out = q;
      if (withSpace && type !== 'multiple_choice' && type !== 'true_false') {
        out = { ...q, text: `${q.text}${answerSpace}` };
      }
      return out;
    };

    // Optional prior-knowledge warm-up (only when grounded unit data exists)
    if (priorCount > 0) {
      const questions: WQ[] = [];
      for (let i = 0; i < priorCount; i++) {
        const concept = priorConcepts[i % priorConcepts.length];
        const q = lang === 'ar' ? makePriorReviewQ_ar(concept) : makePriorReviewQ_en(concept);
        const withSpace = pushQuestion('short_answer', q, true);
        questions.push(withSpace);
        answerKey.push({ num: qNum++, answer: withSpace.answer ?? '—' });
      }
      sections.push({
        type: 'short_answer',
        title: lang === 'ar' ? 'مراجعة سابقة' : 'Prior knowledge review',
        questions,
      });
    }

    // Distribute main questions across selected types with progressive difficulty
    const easyN = Math.max(1, Math.floor(mainTotal * 0.35));
    const hardN = Math.max(1, Math.floor(mainTotal * 0.25));
    const midN = Math.max(1, mainTotal - easyN - hardN);
    const buckets: Array<{ count: number; diff: DiffTier; title: string }> = lang === 'ar'
      ? [
          { count: easyN, diff: 'easy', title: 'أ) تمارين تمهيدية (سهل)' },
          { count: midN, diff: 'medium', title: 'ب) تمارين صفية (متوسط)' },
          { count: hardN, diff: 'hard', title: 'ج) تحدٍّ سريع (أصعب)' },
        ]
      : [
          { count: easyN, diff: 'easy', title: 'A) Warm-up practice (Easy)' },
          { count: midN, diff: 'medium', title: 'B) Class practice (Medium)' },
          { count: hardN, diff: 'hard', title: 'C) Quick stretch (Harder)' },
        ];

    let typeIdx = 0;
    for (const bucket of buckets) {
      const questions: WQ[] = [];
      let sectionType: QType = mainTypes[0];
      for (let i = 0; i < bucket.count; i++) {
        const type = mainTypes[typeIdx % mainTypes.length];
        typeIdx += 1;
        sectionType = type;
        const q = pushQuestion(type, makeQ(type, bucket.diff), true);
        questions.push(q);
        answerKey.push({ num: qNum++, answer: q.answer ?? '—' });
      }
      if (questions.length > 0) {
        sections.push({ type: sectionType, title: bucket.title, questions });
      }
    }

    // At least one life-application word problem when selected
    if (wantsWordProblem) {
      const q = pushQuestion('word_problem', makeQ('word_problem', 'medium'), true);
      sections.push({
        type: 'word_problem',
        title: lang === 'ar' ? 'مسألة حياتية' : 'Real-life word problem',
        questions: [q],
      });
      answerKey.push({ num: qNum++, answer: q.answer ?? '—' });
    }

    return {
      title: lang === 'ar'
        ? `ورقة عمل صفية – ${topic}`
        : `In-class Worksheet – ${topic}`,
      instructions: lang === 'ar'
        ? `الاسم: ________________    الصف: ${req.grade}    التاريخ: ________________\n\nمقدمة قصيرة: هذه ورقة تدريب صفية حول «${topic}». اعمل بهدوء، وابدأ بالأسهل ثم انتقل للأصعب.\n\n• أجب في المساحات المخصصة.\n• بيّن خطوات الحل عند الحاجة.\n• لا حاجة لملاحظات المعلم — هذه ورقة للطالب.`
        : `Name: ________________    Grade: ${req.grade}    Date: ________________\n\nShort intro: This is an in-class practice sheet on “${topic}”. Work quietly and move from easier to harder items.\n\n• Write in the answer spaces provided.\n• Show working where needed.\n• Student sheet only — no teacher notes.`,
      sections,
      answerKey,
    };
  }

  async generateQuiz(req: AIRequest): Promise<QuizOutput> {
    await this.delay();
    beginMathPracticeSession();
    const lang: Lang = req.language === 'arabic' ? 'ar' : 'en';
    const kb = groundedKb(req.topic, lang);
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
    const usedStems = new Set<string>();

    const pushUnique = (factory: () => QuizQuestion): QuizQuestion => {
      for (let attempt = 0; attempt < 12; attempt++) {
        const q = factory();
        const key = questionStemKey(q.text);
        if (!usedStems.has(key)) {
          usedStems.add(key);
          return q;
        }
      }
      const q = factory();
      usedStems.add(questionStemKey(q.text));
      return q;
    };

    for (const type of types) {
      for (let rep = 0; rep < 2; rep++) {
        const id = `q${qIdx++}`;
        // Last question absorbs any rounding difference
        const isLast = qIdx > numQuestions;
        const pts = isLast ? Math.max(1, totalMarks - usedPts) : basePts;
        usedPts += pts;

        if (lang === 'ar') {
          if (type === 'multiple_choice') questions.push(pushUnique(() => makeQuizMCQ_ar(topic, kb, pts, id, req.subject)));
          else if (type === 'true_false') questions.push(pushUnique(() => makeQuizTF_ar(topic, kb, pts, id, req.subject)));
          else questions.push(pushUnique(() => makeQuizSA_ar(topic, kb, pts, id, req.subject)));
        } else {
          if (type === 'multiple_choice') questions.push(pushUnique(() => makeQuizMCQ_en(topic, kb, pts, id, req.subject)));
          else if (type === 'true_false') questions.push(pushUnique(() => makeQuizTF_en(topic, kb, pts, id, req.subject)));
          else questions.push(pushUnique(() => makeQuizSA_en(topic, kb, pts, id, req.subject)));
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
    beginMathPracticeSession();
    const lang: Lang = req.language === 'arabic' ? 'ar' : 'en';
    const kb = groundedKb(req.topic, lang);
    const topic = req.topic;
    const actType = req.activityType ?? 'group';
    const duration = req.duration ?? 30;
    const stepDur = Math.max(5, Math.round((duration - 10) / 2));
    const math = isMathContext(topic, kb, req.subject);
    const practice = math ? takeConcreteMathBatch(3, topic, kb, lang, 'medium') : [];

    if (lang === 'ar') {
      const groupLabel: Record<string, string> = {
        individual: 'فردي', group: `3-4 طلاب`, discussion: 'الصف كامل',
        'hands-on': 'ثنائي أو رباعي', game: 'فرق من 4 طلاب',
      };
      const steps: ActivityStep[] = math && practice.length >= 2
        ? [
            { stepNumber: 1, title: 'التمهيد', description: `اعرض المسألة التالية على السبورة واطلب من الطلاب محاولة سريعة فردية (دقيقتان):\n${practice[0].text}\n(الإجابة المتوقعة للمعلم: ${practice[0].answer})`, durationMin: 5 },
            { stepNumber: 2, title: 'النشاط الرئيسي', description: `قسّم الطلاب حسب ${groupLabel[actType] ?? 'مجموعات'}. تحل كل مجموعة المسألتين:\n1) ${practice[1]?.text ?? practice[0].text}\n2) ${practice[2]?.text ?? practice[0].text}\nيكتب المقرر خطوات الحل كاملة.`, durationMin: stepDur },
            { stepNumber: 3, title: 'العرض والمناقشة', description: `تعرض مجموعتان حلولهما. قارن الطرق (جبري / بياني إن لزم) وصحّح الأخطاء الشائعة دون إعطاء الإجابة مباشرة أولًا.`, durationMin: stepDur },
            { stepNumber: 4, title: 'التلخيص والتقييم', description: `بطاقة خروج: اكتب حلًا مختصرًا لمسألة شبيهة أو أعد صياغة خطوة واحدة من حل اليوم. الإجابات المرجعية: ${practice.map(p => p.answer).join(' ؛ ')}`, durationMin: 5 },
          ]
        : [
            { stepNumber: 1, title: 'التمهيد', description: `اطرح على الطلاب سؤالاً تحفيزياً: "أين نصادف ${topic} في حياتنا؟" استمع لإجابات 3-4 طلاب وسجّلها على السبورة لبناء الفضول.`, durationMin: 5 },
            { stepNumber: 2, title: 'النشاط الرئيسي', description: `قسّم الطلاب حسب ${groupLabel[actType] ?? 'مجموعات'}. يتعاون أفراد كل مجموعة على استكشاف ${topic} من خلال المهمة المطروحة، مع تدوين ملاحظاتهم وتوزيع الأدوار بينهم (قائد، كاتب، مقرر).`, durationMin: stepDur },
            { stepNumber: 3, title: 'العرض والمناقشة', description: `تعرض كل مجموعة نتائجها في 90 ثانية. يسجّل المعلم النقاط الرئيسية على السبورة ويفتح نقاشاً مختصراً حول الاختلافات بين المجموعات.`, durationMin: stepDur },
            { stepNumber: 4, title: 'التلخيص والتقييم', description: `يكتب كل طالب جملةً واحدة تلخّص أهم ما تعلّمه. تُجمع الأوراق كبطاقة خروج للتقييم البنائي.`, durationMin: 5 },
          ];
      return {
        title: `نشاط "${topic}" – ${actType === 'game' ? 'لعبة تعليمية' : actType === 'discussion' ? 'نقاش' : 'تعلم تعاوني'}`,
        activityType: actType,
        totalDuration: duration,
        objective: req.objectives?.trim() || (math
          ? `أن يحل الطلاب مسائل محددة حول ${topic} ويشرحوا خطوات الحل`
          : `أن يطبق الطلاب مفاهيم ${topic} ويناقشوها مع زملائهم لتعزيز الفهم`),
        groupSize: groupLabel[actType] ?? '3-4 طلاب',
        materials: ['الكتاب المدرسي', 'أوراق عمل مطبوعة', 'أقلام ملونة', 'لاصق ورقي للبطاقات'],
        steps,
        teacherTips: [
          'وزّع الأدوار داخل كل مجموعة قبل البدء لضمان مشاركة الجميع.',
          'تجوّل بين المجموعات كل 3 دقائق وقدّم توجيهاً خفيفاً دون إعطاء الإجابات.',
          'استخدم مؤقتاً مرئياً على السبورة لإدارة الوقت.',
        ],
        differentiation: 'للطلاب المتقدمين: قدّم تحدياً إضافياً أو اطلب منهم ربط الموضوع بدرس سابق. للطلاب المحتاجين لدعم: قدّم بطاقة مرجعية تحتوي المصطلحات والصيغ الأساسية.',
        assessment: math
          ? `تحقق من صحة حلول المسائل المعروضة. الإجابات: ${practice.map(p => p.answer).join(' ؛ ')}`
          : 'راقب جودة النقاش داخل المجموعات، وقيّم بطاقات الخروج للتحقق من الفهم، وسجّل ملاحظات عن الطلاب الذين يحتاجون دعماً إضافياً.',
      };
    }

    const groupLabel: Record<string, string> = {
      individual: 'Individual', group: '3-4 students', discussion: 'Whole class',
      'hands-on': 'Pairs or groups of 4', game: 'Teams of 4',
    };
    const steps: ActivityStep[] = math && practice.length >= 2
      ? [
          { stepNumber: 1, title: 'Warm-up', description: `Put this problem on the board for a 2-minute individual try:\n${practice[0].text}\n(Teacher key: ${practice[0].answer})`, durationMin: 5 },
          { stepNumber: 2, title: 'Main Activity', description: `Divide into ${groupLabel[actType] ?? 'groups'}. Each group solves:\n1) ${practice[1]?.text ?? practice[0].text}\n2) ${practice[2]?.text ?? practice[0].text}\nRecorder writes full working.`, durationMin: stepDur },
          { stepNumber: 3, title: 'Share & Discuss', description: `Two groups present. Compare methods and surface common errors before revealing answers.`, durationMin: stepDur },
          { stepNumber: 4, title: 'Wrap-up', description: `Exit ticket: briefly solve a similar item or rewrite one solution step. Keys: ${practice.map(p => p.answer).join(' ; ')}`, durationMin: 5 },
        ]
      : [
          { stepNumber: 1, title: 'Warm-up', description: `Ask a thought-provoking question: "Where do we encounter ${topic} in daily life?" Take responses from 3-4 students and note them on the board to build curiosity.`, durationMin: 5 },
          { stepNumber: 2, title: 'Main Activity', description: `Divide students into ${groupLabel[actType] ?? 'groups'}. Groups collaborate to explore ${topic} through the assigned task, noting findings and distributing roles (leader, recorder, presenter).`, durationMin: stepDur },
          { stepNumber: 3, title: 'Share & Discuss', description: `Each group presents findings in 90 seconds. Record key points on the board and facilitate a brief discussion around differences between groups.`, durationMin: stepDur },
          { stepNumber: 4, title: 'Wrap-up', description: `Each student writes one sentence summarising their main learning. Collect as an exit ticket for formative assessment.`, durationMin: 5 },
        ];
    return {
      title: `${topic} – ${actType === 'game' ? 'Learning Game' : actType === 'discussion' ? 'Discussion' : 'Collaborative Activity'}`,
      activityType: actType,
      totalDuration: duration,
      objective: req.objectives?.trim() || (math
        ? `Students will solve concrete ${topic} problems and explain their steps`
        : `Students will apply and discuss concepts of ${topic} with peers to deepen understanding`),
      groupSize: groupLabel[actType] ?? '3-4 students',
      materials: ['Textbook', 'Printed worksheets', 'Coloured markers', 'Sticky notes'],
      steps,
      teacherTips: [
        'Assign roles inside each group before starting to ensure full participation.',
        'Circulate every 3 minutes and give light guidance without giving answers.',
        'Display a visible timer on the board to help manage pacing.',
      ],
      differentiation: 'Advanced students: offer an extension challenge or ask them to connect the topic to a previous lesson. Students needing support: provide a reference card with key terms and formulas.',
      assessment: math
        ? `Check accuracy of the assigned problems. Keys: ${practice.map(p => p.answer).join(' ; ')}`
        : 'Monitor quality of group discussion, review exit tickets for comprehension, and note students who need follow-up support.',
    };
  }

  async generateClassroomActivity(req: ClassroomActivityRequest): Promise<ClassroomActivity> {
    await this.delay();
    beginMathPracticeSession();
    const isAr = req.language === 'arabic';
    const topic = req.topic;
    const kb = groundedKb(topic, isAr ? 'ar' : 'en');
    const dur = req.duration ?? 20;
    const slideDuration = Math.round((dur * 60) / 5);
    const actType = req.activityType ?? 'escape-challenge';
    const math = isMathContext(topic, kb, req.subject);
    const bingoItems = math && actType === 'bingo'
      ? takeConcreteMathBatch(8, topic, kb, isAr ? 'ar' : 'en', 'medium')
      : [];
    const relayItems = math && actType === 'relay'
      ? takeConcreteMathBatch(4, topic, kb, isAr ? 'ar' : 'en', 'medium')
      : [];

    // ── Quick Check (whole-class ABCD response) ────────────────────────────────
    // Every student answers every question (hands raised / mini-whiteboards) —
    // formative assessment, not a quiz show. Wrong options are misconception
    // distractors from the concrete bank, so the show of hands tells the
    // teacher WHICH mistake the class is making.
    if (actType === 'quick-check') {
      const tier = req.difficulty === 'easy' ? 'easy' as const
        : req.difficulty === 'advanced' ? 'hard' as const
        : 'medium' as const;
      // Default 4 — a standalone Quick Check's own size. Slides Maker asks
      // for more because it splits them across a whole lesson. Clamped so a
      // bad caller cannot drain the concrete bank in one call.
      const wanted = Math.max(1, Math.min(8, Math.floor(req.numQuestions ?? 4) || 4));
      const mcqs: { text: string; options: string[]; answer: string }[] = [];
      if (math) {
        for (let i = 0; i < wanted; i++) {
          const q = takeConcreteMath('multiple_choice', topic, kb, tier, isAr ? 'ar' : 'en', 0);
          if (q?.options?.length) mcqs.push({ text: q.text, options: q.options, answer: q.answer });
        }
      }

      if (mcqs.length >= 2) {
        // Ask the SymPy verifier to actually prove what it can (derivative
        // slice today). Runs in parallel with a per-item timeout; anything
        // it cannot prove stays labelled as a reviewed bank item.
        const outcomes = await Promise.all(
          mcqs.map(q =>
            verifyIfPossible(q.text, q.answer, q.options.filter(o => o !== q.answer)),
          ),
        );

        const qSlides = mcqs.map((q, i) => {
          const correctIndex = Math.max(0, q.options.indexOf(q.answer));
          const outcome = outcomes[i]!;
          return {
            slideNumber: i + 2,
            type: 'question' as const,
            title: isAr ? `سؤال ${i + 1}` : `Question ${i + 1}`,
            content: q.text,
            options: q.options,
            correctIndex,
            verified: true,
            verifiedBy: outcome.verifiedBy,
            computedAnswer: outcome.computedAnswer,
            durationSeconds: 45,
            teacher: {
              expectedAnswer: q.answer,
              commonMisconceptions: q.options
                .filter(o => o !== q.answer)
                .map(o => (isAr ? `«${o}» — خطأ شائع مقصود` : `“${o}” — a deliberate common error`))
                .join('\n'),
              teachingTips: isAr
                ? 'الكل يجيب معًا: ارفعوا أيديكم للإجابة عند انتهاء المؤقت. اقرأ توزيع الأيدي قبل الكشف — كل خيار خاطئ يكشف خطأً شائعًا محددًا.'
                : 'All students answer together: raise your hand to answer when the timer ends. Read the spread of hands before revealing — each wrong option maps to a specific misconception.',
            },
          };
        });
        return {
          activityName: isAr ? `تحقق سريع – ${topic}` : `Quick Check – ${topic}`,
          activityType: 'quick-check',
          grade: req.grade,
          subject: req.subject,
          lesson: topic,
          duration: dur,
          difficulty: req.difficulty,
          groupType: 'whole-class',
          learningObjective: isAr
            ? `تشخيص فهم الصف كاملًا في ${topic} عبر أسئلة يجيب عنها كل طالب`
            : `Diagnose whole-class understanding of ${topic} — every student answers every question`,
          materials: isAr
            ? ['شاشة عرض', 'ألواح صغيرة (اختياري)']
            : ['Projector', 'Mini whiteboards (optional)'],
          teacherPreparation: isAr
            ? 'لا تحتاج تحضيرًا مسبقًا. اعرض السؤال، شغّل المؤقت، والجميع يرفع يده للإجابة عند انتهاء الوقت.'
            : 'No prep needed. Show the question, run the timer, everyone raises a hand to answer at once.',
          teacherNotes: isAr
            ? ['لا تكشف الإجابة قبل أن يجيب الجميع', 'إن انقسم الصف بين خيارين، اطلب من الطرفين التبرير ثم أعد التصويت']
            : ['Never reveal before everyone has answered', 'If the class splits between two options, have each side argue, then re-vote'],
          answerKey: mcqs.map((q, i) => (isAr ? `سؤال ${i + 1}: ${q.answer}` : `Q${i + 1}: ${q.answer}`)),
          printables: [],
          assessment: isAr
            ? 'توزيع الإجابات نفسه هو التقييم: أي خيار خاطئ يرتفع كثيرًا يحدد الخطأ الشائع الذي يجب إعادة شرحه.'
            : 'The spread of answers IS the assessment: a frequently raised wrong option pinpoints the misconception to re-teach.',
          extensionChallenge: isAr
            ? 'اطلب ممن أجاب صحيحًا أن يقنع زميلًا اختار إجابة خاطئة — دون إخباره بالحل'
            : 'Ask a correct answerer to convince a classmate who chose wrong — without stating the answer',
          slides: [
            {
              slideNumber: 1,
              type: 'intro',
              title: isAr ? '🙋 تحقق سريع' : '🙋 Quick Check',
              content: isAr
                ? `${topic}\n\nالقواعد:\n• يظهر السؤال ويبدأ المؤقت\n• الجميع يفكر بصمت\n• عند انتهاء الوقت: ارفع يدك للإجابة\n• ثم نكشف الإجابة الصحيحة ونناقش`
                : `${topic}\n\nRules:\n• The question appears and the timer starts\n• Everyone thinks silently\n• When time ends: raise your hand to answer\n• Then we reveal and discuss`,
              durationSeconds: 0,
            },
            ...qSlides,
            {
              slideNumber: qSlides.length + 2,
              type: 'summary',
              title: isAr ? '🎉 أحسنتم!' : '🎉 Well done!',
              content: isAr
                ? `راجعنا ${topic} بإجابات الصف كامل.\n\nناقش مع زميلك:\n• أي سؤال كان الأصعب؟\n• أي خطأ شائع وقعت فيه وفهمته الآن؟`
                : `We checked ${topic} with the whole class answering.\n\nDiscuss with a partner:\n• Which question was hardest?\n• Which common error did you make and now understand?`,
              durationSeconds: 0,
            },
          ],
        };
      }

      // Non-math (or exhausted bank): open questions from the lesson's
      // objectives — honest discussion prompts, no fabricated options.
      const objectives = (kb?.objectives ?? []).slice(0, wanted);
      const stems = objectives.length > 0 ? objectives : [topic];
      const openSlides = stems.map((obj, i) => ({
        slideNumber: i + 2,
        type: 'challenge' as const,
        title: isAr ? `سؤال ${i + 1}` : `Question ${i + 1}`,
        content: isAr
          ? `اشرح بكلماتك:\n${obj}\n\nاكتب إجابتك على لوحك الصغير.`
          : `Explain in your own words:\n${obj}\n\nWrite your answer on your mini whiteboard.`,
        hint: isAr ? 'ابدأ بمثال ثم اشرح القاعدة' : 'Start with an example, then state the rule',
        durationSeconds: 60,
        teacher: {
          expectedAnswer: obj,
          teachingTips: isAr
            ? 'اطلب من الجميع الكتابة، ثم اختر 2–3 ألواح مختلفة واعرضها للنقاش.'
            : 'Everyone writes; pick 2–3 different boards and discuss them.',
        },
      }));
      return {
        activityName: isAr ? `تحقق سريع – ${topic}` : `Quick Check – ${topic}`,
        activityType: 'quick-check',
        grade: req.grade,
        subject: req.subject,
        lesson: topic,
        duration: dur,
        difficulty: req.difficulty,
        groupType: 'whole-class',
        learningObjective: isAr
          ? `تشخيص فهم الصف في ${topic} عبر أسئلة قصيرة يجيب عنها الجميع كتابةً`
          : `Diagnose class understanding of ${topic} through short all-write questions`,
        materials: isAr ? ['ألواح صغيرة وأقلام', 'شاشة عرض'] : ['Mini whiteboards and markers', 'Projector'],
        teacherPreparation: isAr
          ? 'وزّع الألواح الصغيرة. يظهر السؤال، الجميع يكتب، ثم يرفع الجميع ألواحهم معًا.'
          : 'Hand out mini whiteboards. Question appears, everyone writes, all boards go up together.',
        teacherNotes: isAr
          ? ['امسح الغرفة بعينيك عند رفع الألواح — هذا هو التقييم']
          : ['Scan the room when boards go up — that scan is the assessment'],
        answerKey: stems.map((obj, i) => (isAr ? `سؤال ${i + 1}: ${obj}` : `Q${i + 1}: ${obj}`)),
        printables: [],
        assessment: isAr
          ? 'قارن الألواح المرفوعة بالإجابة المتوقعة وحدد من يحتاج دعمًا.'
          : 'Compare raised boards with the expected answer; note who needs support.',
        extensionChallenge: isAr
          ? 'اطلب من طالب متمكن إعادة صياغة أفضل إجابة بمثال جديد'
          : 'Ask a strong student to restate the best answer with a new example',
        slides: [
          {
            slideNumber: 1,
            type: 'intro',
            title: isAr ? '🙋 تحقق سريع' : '🙋 Quick Check',
            content: isAr
              ? `${topic}\n\nالقواعد:\n• يظهر السؤال ويبدأ المؤقت\n• الجميع يكتب إجابته على لوحه\n• عند انتهاء الوقت: الكل يرفع لوحه معًا`
              : `${topic}\n\nRules:\n• The question appears and the timer starts\n• Everyone writes on their board\n• When time ends: all boards up together`,
            durationSeconds: 0,
          },
          ...openSlides,
          {
            slideNumber: openSlides.length + 2,
            type: 'summary',
            title: isAr ? '🎉 أحسنتم!' : '🎉 Well done!',
            content: isAr
              ? `راجعنا ${topic} بمشاركة الجميع.\nناقش: أي سؤال كان الأصعب؟`
              : `We reviewed ${topic} with everyone participating.\nDiscuss: which question was hardest?`,
            durationSeconds: 0,
          },
        ],
      };
    }

    // ── Bingo ──────────────────────────────────────────────────────────────────
    if (actType === 'bingo') {
      if (isAr) {
        if (math && bingoItems.length >= 4) {
          const calls = bingoItems.slice(0, 8).map((item, i) => ({
            slideNumber: i + 2,
            type: 'bingo-call' as const,
            title: `الاستدعاء ${i + 1}`,
            content: item.text,
            hint: 'حل المسألة ثم غطّ الإجابة على بطاقتك إن وُجدت',
            answer: item.answer,
            durationSeconds: 30,
            teacher: {
              expectedAnswer: item.answer,
              teachingTips: 'امنح 20–30 ثانية للحل قبل الكشف',
              suggestedQuestions: ['ما الخطوة الأولى؟'],
            },
          }));
          return {
            activityName: `بينجو مسائل – ${topic}`,
            activityType: 'bingo',
            grade: req.grade,
            subject: req.subject,
            lesson: topic,
            duration: dur,
            difficulty: req.difficulty,
            groupType: req.groupType,
            learningObjective: `حل مسائل محددة في ${topic} بأسلوب تنافسي`,
            materials: ['بطاقات بينجو مطبوعة', 'قصاصات تغطية', 'مؤقت'],
            teacherPreparation: 'اطبع بطاقات تتضمن الإجابات العددية/الناتج. استدعِ المسائل بالترتيب.',
            teacherNotes: ['ناقش الحل بعد كل استدعاء', 'يمكن اللعب لجولتين'],
            answerKey: bingoItems.map((item, i) => `المسألة ${i + 1}: ${item.answer}`),
            printables: ['بطاقات بينجو', 'قائمة المسائل للمعلم'],
            assessment: 'راقب صحة الحلول وسرعة التعرف على الناتج.',
            extensionChallenge: 'اطلب من الفائز شرح حل مسألتين من بطاقته',
            slides: [
              { slideNumber: 1, type: 'intro', title: '🎱 بينجو المسائل', content: `بينجو ${topic}!\nلكل طالب بطاقة بإجابات.\nأحل المسألة المستدعاة، ثم غطّ الناتج المطابق.\nأول من يكمل صفًا يصرخ بينجو!`, durationSeconds: 0 },
              ...calls,
              { slideNumber: calls.length + 2, type: 'summary', title: '🎉 انتهت الجولة!', content: `أحسنتم!\nراجعنا مسائل ${topic}.\nناقش: أي مسألة كانت الأصعب؟`, durationSeconds: 0 },
            ],
          };
        }
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
      if (math && bingoItems.length >= 4) {
        const calls = bingoItems.slice(0, 8).map((item, i) => ({
          slideNumber: i + 2,
          type: 'bingo-call' as const,
          title: `Call ${i + 1}`,
          content: item.text,
          hint: 'Solve, then cover the matching answer on your card',
          answer: item.answer,
          durationSeconds: 30,
          teacher: {
            expectedAnswer: item.answer,
            teachingTips: 'Allow 20–30 seconds before revealing',
            suggestedQuestions: ['What is your first step?'],
          },
        }));
        return {
          activityName: `Problem Bingo – ${topic}`,
          activityType: 'bingo',
          grade: req.grade,
          subject: req.subject,
          lesson: topic,
          duration: dur,
          difficulty: req.difficulty,
          groupType: req.groupType,
          learningObjective: `Solve concrete ${topic} problems in a competitive format`,
          materials: ['Printed bingo cards', 'Cover chips', 'Timer'],
          teacherPreparation: 'Print cards with numeric answers. Call problems in order.',
          teacherNotes: ['Discuss each solution after calling', 'Play two rounds if time allows'],
          answerKey: bingoItems.map((item, i) => `Problem ${i + 1}: ${item.answer}`),
          printables: ['Bingo cards', 'Teacher problem list'],
          assessment: 'Watch solution accuracy and speed.',
          extensionChallenge: 'Ask the winner to explain two solutions from their card',
          slides: [
            { slideNumber: 1, type: 'intro', title: '🎱 Problem Bingo', content: `${topic} Bingo!\nEach card has answers.\nSolve the called problem, cover the matching result.\nFirst complete row wins!`, durationSeconds: 0 },
            ...calls,
            { slideNumber: calls.length + 2, type: 'summary', title: '🎉 Round Complete!', content: `Well done!\nWe practiced real ${topic} problems.`, durationSeconds: 0 },
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
        if (math && relayItems.length >= 4) {
          return {
            activityName: `سباق التتابع – ${topic}`,
            activityType: 'relay',
            grade: req.grade,
            subject: req.subject,
            lesson: topic,
            duration: dur,
            difficulty: req.difficulty,
            groupType: req.groupType,
            learningObjective: `حل أربع مسائل محددة في ${topic} ضمن فرق تنافسية`,
            materials: ['السبورة', 'أوراق التتابع المطبوعة', 'مؤقت', 'أقلام ملونة'],
            teacherPreparation: 'قسّم الطلاب إلى فرق. كل فرد يحل مسألة واحدة ثم يمرّر للالتالي.',
            teacherNotes: ['تحقق من توازن الفرق', 'شجّع التحقق قبل التمرير'],
            answerKey: relayItems.map((item, i) => `المسألة ${i + 1}: ${item.answer}`),
            printables: ['أوراق التتابع', 'لوحة النتائج'],
            assessment: 'قيّم صحة إجابات المسائل الأربع وسرعة الإنجاز.',
            extensionChallenge: 'اطلب من الفريق الفائز صياغة مسألة خامسة للفريق الآخر',
            slides: [
              { slideNumber: 1, type: 'intro', title: '🏃 سباق التتابع', content: `سباق مسائل ${topic}!\nكل فريق يحل 4 مسائل متتالية.\nالفريق الأسرع بإجابات صحيحة يفوز.`, durationSeconds: 0 },
              ...relayItems.map((item, i) => ({
                slideNumber: i + 2,
                type: 'relay-problem' as const,
                title: `المسألة ${i + 1} من 4`,
                content: item.text,
                hint: 'بيّن خطواتك قبل التمرير',
                answer: item.answer,
                durationSeconds: slideDuration,
                teacher: {
                  expectedAnswer: item.answer,
                  teachingTips: 'تأكد أن الفريق يكتب الناتج بوضوح',
                  suggestedQuestions: ['ما خطوتك الأولى؟'],
                },
              })),
              { slideNumber: 6, type: 'summary', title: '🎉 اكتملت السلسلة!', content: `أحسنتم!\nحللتم اليوم مسائل ${topic} الحقيقية.\nتحقق دائمًا قبل التمرير.`, durationSeconds: 0 },
            ],
          };
        }
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

    // ── Error Detective ────────────────────────────────────────────────────────
    if (actType === 'error-detective') {
      if (isAr) {
        return {
          activityName: `المحقق الرياضي – ${topic}`,
          activityType: 'error-detective',
          grade: req.grade, subject: req.subject, lesson: topic, duration: dur,
          difficulty: req.difficulty, groupType: req.groupType,
          learningObjective: `تحديد الأخطاء الشائعة في حل مسائل ${topic} وتصحيحها بمنهجية`,
          materials: ['السبورة', 'بطاقات الحلول الخاطئة المطبوعة', 'أقلام تصحيح حمراء'],
          teacherPreparation: 'اطبع 3 حلول خاطئة مسبقًا. اطلب من الطلاب العمل في ثنائيات.',
          teacherNotes: ['ناقش سبب الخطأ وليس فقط الإجابة الصحيحة', 'استخدم أخطاء حقيقية من اختبارات سابقة'],
          answerKey: ['الخطأ 1: إشارة سالبة مفقودة', 'الخطأ 2: قسمة على المتغير بدلاً من إخراجه', 'الخطأ 3: نسيان الجذر السالب'],
          printables: ['بطاقات الحلول الخاطئة', 'نموذج التقرير التحقيقي'],
          assessment: 'قيّم قدرة الطلاب على تحديد الخطأ وشرح سببه وتقديم الحل الصحيح.',
          extensionChallenge: `اطلب من الطلاب تصميم خطأ متعمد في حل ${topic} وتبادله مع مجموعة أخرى.`,
          slides: [
            { slideNumber: 1, type: 'intro', title: '🔍 المحقق الرياضي', content: `مهمتك: اكشف الخطأ في الحلول التالية!\nكل حل يحتوي على خطأ واحد على الأقل.\nحدّد الخطأ، اشرح سببه، وقدّم الحل الصحيح.\n\nعمل ثنائي – دقيقتان لكل بطاقة`, durationSeconds: 0 },
            {
              slideNumber: 2, type: 'challenge',
              title: '🕵️ الجريمة 1 – أوجد الخطأ',
              content: `الطالب كتب هذا الحل:\n\nحل معادلة: س² - 9 = 0\nس² = 9\nس = 3\n\n❓ أين الخطأ؟`,
              hint: 'هل هناك حالتان لـ√9 ؟',
              answer: 'الخطأ: نسيان الجذر السالب\nالصحيح: س = 3 أو س = -3',
              durationSeconds: slideDuration,
              teacher: { expectedAnswer: 'نسيان الجذر السالب ± 3', commonMisconceptions: 'الطلاب يعتقدون أن الجذر التربيعي له قيمة موجبة فقط', teachingTips: 'ذكّر: √9 = ±3 دائمًا عند حل المعادلات', suggestedQuestions: ['ما عدد حلول المعادلة التربيعية؟', 'متى تكون الحلول كلاهما موجبة؟'] },
            },
            { slideNumber: 3, type: 'reveal', title: '✅ الحل الصحيح', content: 'الخطأ: أخذ الجذر الموجب فقط\n\nالحل الكامل:\nس² = 9\nس = ±3\n\nإذن: س = 3 أو س = -3\n\n🏅 نقطة لمن اكتشف الخطأ!', durationSeconds: 0 },
            {
              slideNumber: 4, type: 'challenge',
              title: '🕵️ الجريمة 2 – أوجد الخطأ',
              content: `الطالب كتب هذا الحل:\n\nحل معادلة: 3س² - 6س = 0\n3س² = 6س\nس = 2\n\n❓ أين الخطأ؟`,
              hint: 'ماذا يحدث عند القسمة على المتغير؟',
              answer: 'الخطأ: القسمة على (س) تُفقد الحل س = 0\nالصحيح: س(3س - 6) = 0، إذن س = 0 أو س = 2',
              durationSeconds: slideDuration,
              teacher: { expectedAnswer: 'قسمة طرفي المعادلة على (س) تُضيّع الحل س = 0', commonMisconceptions: 'الطلاب يقسمون على المتغير ظنًا أنه مبسّط', teachingTips: 'القاعدة الذهبية: لا تقسم على متغير، بل أخرجه عاملاً', suggestedQuestions: ['لماذا لا يجوز القسمة على س؟', 'كيف تتحقق أن س = 0 حل صحيح؟'] },
            },
            { slideNumber: 5, type: 'reveal', title: '✅ الحل الصحيح', content: 'الخطأ: القسمة على (س) تُفقد الحل الثاني\n\nالطريقة الصحيحة:\n3س² - 6س = 0\nس(3س - 6) = 0\nس = 0  أو  3س - 6 = 0\nس = 0  أو  س = 2\n\n⚠️ لا تقسم أبدًا على متغير!', durationSeconds: 0 },
            {
              slideNumber: 6, type: 'challenge',
              title: '🕵️ الجريمة 3 – أوجد الخطأ',
              content: `الطالب كتب هذا الحل:\n\nحل معادلة: س² + 4س + 4 = 0\n(س + 4)(س + 1) = 0\nس = -4 أو س = -1\n\n❓ أين الخطأ؟`,
              hint: 'ما الأعداد التي حاصل ضربها 4 ومجموعها 4؟',
              answer: 'الخطأ: التحليل خاطئ\nالصحيح: (س + 2)² = 0، إذن س = -2 (جذر مزدوج)',
              durationSeconds: slideDuration,
              teacher: { expectedAnswer: '(س + 2)(س + 2) = 0 وليس (س + 4)(س + 1)', commonMisconceptions: 'اختيار عاملين عشوائيين بدون التحقق', teachingTips: 'تحقق دائمًا: 2 × 2 = 4 و 2 + 2 = 4 ✓', suggestedQuestions: ['ما الفرق بين هذه المعادلة والسابقة؟', 'ما معنى الجذر المزدوج هندسيًا؟'] },
            },
            { slideNumber: 7, type: 'reveal', title: '✅ الحل الصحيح', content: 'الخطأ: التحليل غير صحيح\n\nالحل الصحيح:\nس² + 4س + 4 = 0\n(س + 2)² = 0\nس + 2 = 0\nس = -2  (جذر مزدوج)\n\n🔑 تذكّر: المربع التام = جذر مزدوج', durationSeconds: 0 },
            { slideNumber: 8, type: 'summary', title: '🏆 التحقيق اكتمل!', content: `أحسنتم يا محققون!\n\nالأخطاء الشائعة التي اكتشفناها اليوم في ${topic}:\n\n1️⃣ نسيان الجذر السالب\n2️⃣ القسمة على المتغير\n3️⃣ التحليل الخاطئ\n\n💡 هذه الأخطاء تظهر كثيرًا في الامتحانات — تجنّبها!`, durationSeconds: 0 },
          ],
        };
      }
      return {
        activityName: `Error Detective – ${topic}`,
        activityType: 'error-detective',
        grade: req.grade, subject: req.subject, lesson: topic, duration: dur,
        difficulty: req.difficulty, groupType: req.groupType,
        learningObjective: `Identify and correct common mistakes in ${topic} problems through analytical thinking`,
        materials: ['Whiteboard', 'Printed error cards', 'Red correction pens'],
        teacherPreparation: 'Print 3 worked solutions with deliberate errors. Students work in pairs.',
        teacherNotes: ['Discuss WHY the error occurred, not just what the correct answer is', 'Use real errors from previous tests when possible'],
        answerKey: ['Error 1: Missing negative root', 'Error 2: Dividing by variable loses a solution', 'Error 3: Incorrect factoring'],
        printables: ['Error cards (one set per pair)', 'Investigation report template'],
        assessment: 'Assess whether students can identify the error, explain its cause, and provide the correct solution.',
        extensionChallenge: `Ask students to deliberately introduce an error into a ${topic} solution and swap with another pair to solve.`,
        slides: [
          { slideNumber: 1, type: 'intro', title: '🔍 Error Detective', content: `Your mission: spot the mistake in each worked solution!\nEvery solution contains at least one error.\nIdentify the error, explain why it is wrong, and write the correct solution.\n\nWork in pairs — 2 minutes per card`, durationSeconds: 0 },
          {
            slideNumber: 2, type: 'challenge',
            title: '🕵️ Case 1 – Find the Error',
            content: `A student wrote this solution:\n\nSolve: x² − 9 = 0\nx² = 9\nx = 3\n\n❓ Where is the error?`,
            hint: 'Are there two possible values for √9?',
            answer: 'Error: forgot the negative root\nCorrect: x = 3 or x = −3',
            durationSeconds: slideDuration,
            teacher: { expectedAnswer: 'Missing the negative root ±3', commonMisconceptions: 'Students assume the square root only yields a positive value', teachingTips: 'Reinforce: √9 = ±3 when solving equations', suggestedQuestions: ['How many solutions does a quadratic equation have?', 'When are both roots positive?'] },
          },
          { slideNumber: 3, type: 'reveal', title: '✅ Correct Solution', content: 'Error: taking only the positive root\n\nFull solution:\nx² = 9\nx = ±3\n\nSo: x = 3 or x = −3\n\n🏅 Point to whoever caught the error!', durationSeconds: 0 },
          {
            slideNumber: 4, type: 'challenge',
            title: '🕵️ Case 2 – Find the Error',
            content: `A student wrote this solution:\n\nSolve: 3x² − 6x = 0\n3x² = 6x\nx = 2\n\n❓ Where is the error?`,
            hint: 'What happens when you divide both sides by the variable?',
            answer: 'Error: dividing by x loses the solution x = 0\nCorrect: x(3x − 6) = 0, so x = 0 or x = 2',
            durationSeconds: slideDuration,
            teacher: { expectedAnswer: 'Dividing both sides by x eliminates x = 0', commonMisconceptions: 'Students divide by the variable as if it were a constant', teachingTips: 'Golden rule: never divide by a variable — factor it out instead', suggestedQuestions: ['Why can\'t we divide both sides by x?', 'How do you verify x = 0 is a valid solution?'] },
          },
          { slideNumber: 5, type: 'reveal', title: '✅ Correct Solution', content: 'Error: dividing by x loses one solution\n\nCorrect method:\n3x² − 6x = 0\nx(3x − 6) = 0\nx = 0  or  3x − 6 = 0\nx = 0  or  x = 2\n\n⚠️ Never divide both sides by a variable!', durationSeconds: 0 },
          {
            slideNumber: 6, type: 'challenge',
            title: '🕵️ Case 3 – Find the Error',
            content: `A student wrote this solution:\n\nSolve: x² + 4x + 4 = 0\n(x + 4)(x + 1) = 0\nx = −4 or x = −1\n\n❓ Where is the error?`,
            hint: 'What two numbers multiply to 4 and add to 4?',
            answer: 'Error: incorrect factoring\nCorrect: (x + 2)² = 0, so x = −2 (double root)',
            durationSeconds: slideDuration,
            teacher: { expectedAnswer: '(x + 2)(x + 2) not (x + 4)(x + 1)', commonMisconceptions: 'Guessing factor pairs without checking', teachingTips: 'Always verify: 2 × 2 = 4 ✓ and 2 + 2 = 4 ✓', suggestedQuestions: ['How is this different from the previous equations?', 'What does a double root mean graphically?'] },
          },
          { slideNumber: 7, type: 'reveal', title: '✅ Correct Solution', content: 'Error: wrong factor pair\n\nCorrect solution:\nx² + 4x + 4 = 0\n(x + 2)² = 0\nx + 2 = 0\nx = −2  (double root)\n\n🔑 Perfect square → double root!', durationSeconds: 0 },
          { slideNumber: 8, type: 'summary', title: '🏆 Investigation Complete!', content: `Outstanding detectives!\n\nCommon ${topic} errors we uncovered today:\n\n1️⃣ Forgetting the negative root\n2️⃣ Dividing by a variable\n3️⃣ Incorrect factoring\n\n💡 These errors appear frequently in exams — now you know how to avoid them!`, durationSeconds: 0 },
        ],
      };
    }

    // ── Gallery Walk ────────────────────────────────────────────────────────────
    if (actType === 'gallery-walk') {
      if (isAr) {
        return {
          activityName: `جولة المعارض – ${topic}`,
          activityType: 'gallery-walk',
          grade: req.grade, subject: req.subject, lesson: topic, duration: dur,
          difficulty: req.difficulty, groupType: req.groupType,
          learningObjective: `استكشاف جوانب متعددة من ${topic} من خلال مناقشة جماعية في محطات دوّارة`,
          materials: ['5 أوراق كبيرة مثبّتة على الجدران', 'أقلام ملونة', 'ملصقات لاصقة'],
          teacherPreparation: 'اكتب مسألة مختلفة على كل ورقة كبيرة. رتّب المجموعات (4-5 أفراد). كل محطة: 3-4 دقائق.',
          teacherNotes: ['ابدأ المجموعات في محطات مختلفة لتجنب الازدحام', 'شجّع إضافة ملاحظات على ما كتبته المجموعات السابقة'],
          answerKey: ['محطة 1: حل المسألة الأولى', 'محطة 2: حل المسألة الثانية', 'محطة 3: تطبيق عملي', 'محطة 4: تحليل الخطأ', 'محطة 5: مسألة إبداعية'],
          printables: ['بطاقات المحطات (A3)', 'ورقة تتبع المجموعات'],
          assessment: 'راجع ما كتبته المجموعات على الأوراق. ناقش الإجابات المثيرة في الختام.',
          extensionChallenge: `اطلب من كل مجموعة إضافة محطة جديدة ومسألة خاصة بها.`,
          slides: [
            { slideNumber: 1, type: 'intro', title: '🖼️ جولة المعارض', content: `مرحبًا بكم في معرض ${topic}!\n\n5 محطات تعليمية حول الفصل.\nكل مجموعة تتنقل بين المحطات وتناقش المسألة.\nوقت كل محطة: 3-4 دقائق.\n\nاستعدوا — الجولة تبدأ الآن!`, durationSeconds: 0 },
            { slideNumber: 2, type: 'challenge', title: '📌 المحطة 1 – الأساس', content: `المسألة الأساسية:\nطبّق التعريف الأساسي لـ${topic} لحل هذه المسألة.\n\nاكتبوا حلّكم الجماعي على الورقة.\nأضيفوا: هل تتفقون مع المجموعة السابقة؟`, hint: 'ابدأ بتحديد ما يُطلب', answer: 'انظر إلى الورقة الكبيرة في المحطة', durationSeconds: slideDuration, teacher: { expectedAnswer: `تطبيق مباشر للتعريف الأساسي لـ${topic}`, teachingTips: 'تأكد أن المجموعات تكتب على الورقة وليس فقط تناقش شفهيًا' } },
            { slideNumber: 3, type: 'challenge', title: '📌 المحطة 2 – التطبيق', content: `مسألة تطبيقية:\nكيف يُستخدم ${topic} لحل هذا الموقف الحياتي؟\n\nناقش مع مجموعتك وسجّل خطوات الحل.\nما الفرق بين هذه المسألة والمحطة 1؟`, hint: 'ابحث عن الرابط بين ${topic} والموقف الحياتي', answer: 'انظر إلى الورقة الكبيرة في المحطة', durationSeconds: slideDuration, teacher: { expectedAnswer: `ربط ${topic} بسياق حياتي حقيقي`, teachingTips: 'شجّع المجموعات على ذكر أمثلة خاصة بهم' } },
            { slideNumber: 4, type: 'challenge', title: '📌 المحطة 3 – التحليل', content: `مسألة تحليلية:\nما أوجه التشابه والاختلاف بين مفهومين رئيسيين في ${topic}؟\n\narسم مخطط فِن (Venn) على الورقة.\nأضف على الأقل 2 تشابه و2 اختلاف.`, hint: 'فكّر في التعريفات والخصائص', answer: 'انظر إلى الورقة الكبيرة في المحطة', durationSeconds: slideDuration, teacher: { expectedAnswer: `مقارنة المفاهيم الرئيسية في ${topic}`, teachingTips: 'ساعد المجموعات على بدء مخطط فِن إذا احتاجوا' } },
            { slideNumber: 5, type: 'challenge', title: '📌 المحطة 4 – التقييم', content: `مسألة تقييمية:\nهل الحل التالي صحيح أم خاطئ؟ اشرح لماذا.\n\nحل مقترح لمسألة في ${topic}:\n[انظر الورقة الكبيرة]\n\nقيّم الحل وصحّح أي خطأ.`, hint: 'تحقق خطوة بخطوة', answer: 'انظر إلى الورقة الكبيرة في المحطة', durationSeconds: slideDuration, teacher: { expectedAnswer: `تقييم نقدي لحل خاطئ في ${topic}`, teachingTips: 'تعمّد وضع خطأ شائع في الحل المقترح' } },
            { slideNumber: 6, type: 'challenge', title: '📌 المحطة 5 – الإبداع', content: `تحدي إبداعي:\nصمّم مسألتك الخاصة في ${topic}!\n\nاكتب مسألة جديدة وقدّم حلّها.\nستقرأ المجموعات الأخرى مسألتك!`, hint: 'اختر موقفًا حياتيًا مثيرًا للاهتمام', answer: 'المسائل الإبداعية تختلف لكل مجموعة', durationSeconds: slideDuration, teacher: { expectedAnswer: `مسألة إبداعية ذات صلة بـ${topic}`, teachingTips: 'اطلب من المجموعات قراءة مسائل بعضها في الختام' } },
            { slideNumber: 7, type: 'summary', title: '🎨 الجولة اكتملت!', content: `أحسنتم! زرتم جميع محطات معرض ${topic}.\n\nلنستعرض أبرز ما كتبتموه:\n• أجمل إجابة في المحطة 1؟\n• أكثر مسألة حياتية في المحطة 2؟\n• أفضل مسألة إبداعية في المحطة 5؟\n\nناقشوا معًا: ما أكثر ما تعلمتم؟`, durationSeconds: 0 },
          ],
        };
      }
      return {
        activityName: `Gallery Walk – ${topic}`,
        activityType: 'gallery-walk',
        grade: req.grade, subject: req.subject, lesson: topic, duration: dur,
        difficulty: req.difficulty, groupType: req.groupType,
        learningObjective: `Explore multiple dimensions of ${topic} through collaborative discussion at rotating stations`,
        materials: ['5 large sheets of paper posted on walls', 'Coloured markers', 'Sticky notes'],
        teacherPreparation: 'Write a different problem on each large sheet. Arrange groups of 4-5. Allow 3-4 minutes per station.',
        teacherNotes: ['Start groups at different stations to avoid crowding', 'Encourage adding comments to previous groups\' answers'],
        answerKey: ['Station 1: foundational problem solution', 'Station 2: applied problem solution', 'Station 3: analysis', 'Station 4: error evaluation', 'Station 5: creative design'],
        printables: ['Station cards (A3 format)', 'Group tracking sheet'],
        assessment: 'Review what groups wrote on the posters. Highlight interesting answers in the debrief.',
        extensionChallenge: `Ask each group to add a new station with their own original problem.`,
        slides: [
          { slideNumber: 1, type: 'intro', title: '🖼️ Gallery Walk', content: `Welcome to the ${topic} Gallery!\n\n5 learning stations around the room.\nEach group rotates and discusses the problem at each stop.\nTime per station: 3–4 minutes.\n\nGet ready — the gallery opens now!`, durationSeconds: 0 },
          { slideNumber: 2, type: 'challenge', title: '📌 Station 1 – Foundations', content: `Foundational problem:\nApply the core definition of ${topic} to solve this problem.\n\nWrite your group's solution on the poster.\nDo you agree with the previous group?`, hint: 'Start by identifying what is being asked', answer: 'See the large poster at this station', durationSeconds: slideDuration, teacher: { expectedAnswer: `Direct application of the core ${topic} definition`, teachingTips: 'Make sure groups write on the poster, not just discuss verbally' } },
          { slideNumber: 3, type: 'challenge', title: '📌 Station 2 – Application', content: `Applied problem:\nHow does ${topic} apply to this real-world scenario?\n\nDiscuss and record the solution steps.\nHow does this differ from Station 1?`, hint: `Find the link between ${topic} and the real-world context`, answer: 'See the large poster at this station', durationSeconds: slideDuration, teacher: { expectedAnswer: `Connecting ${topic} to a real-world context`, teachingTips: 'Encourage groups to cite their own examples' } },
          { slideNumber: 4, type: 'challenge', title: '📌 Station 3 – Analysis', content: `Analytical challenge:\nWhat are the similarities and differences between the two key concepts in ${topic}?\n\nDraw a Venn diagram on the poster.\nAdd at least 2 similarities and 2 differences.`, hint: 'Think about definitions and properties', answer: 'See the large poster at this station', durationSeconds: slideDuration, teacher: { expectedAnswer: `Comparing the main concepts within ${topic}`, teachingTips: 'Help groups start the Venn diagram if needed' } },
          { slideNumber: 5, type: 'challenge', title: '📌 Station 4 – Evaluate', content: `Evaluation challenge:\nIs the following solution correct or incorrect? Explain why.\n\nProposed solution for a ${topic} problem:\n[See the large poster]\n\nEvaluate the solution and correct any errors.`, hint: 'Check each step one by one', answer: 'See the large poster at this station', durationSeconds: slideDuration, teacher: { expectedAnswer: `Critical evaluation of a flawed ${topic} solution`, teachingTips: 'Deliberately include a common student error in the proposed solution' } },
          { slideNumber: 6, type: 'challenge', title: '📌 Station 5 – Create', content: `Creative challenge:\nDesign your own ${topic} problem!\n\nWrite a new problem and provide its solution.\nOther groups will read and solve your creation!`, hint: 'Choose an interesting real-world scenario', answer: 'Creative problems will vary per group', durationSeconds: slideDuration, teacher: { expectedAnswer: `A creative, contextually relevant ${topic} problem`, teachingTips: 'Ask groups to read each other\'s problems during the debrief' } },
          { slideNumber: 7, type: 'summary', title: '🎨 Gallery Walk Complete!', content: `Excellent! You visited all ${topic} stations.\n\nLet's review the highlights:\n• Best answer at Station 1?\n• Most creative real-world example at Station 2?\n• Best original problem at Station 5?\n\nDiscuss: What was your most important takeaway?`, durationSeconds: 0 },
        ],
      };
    }

    // ── Exit Ticket ─────────────────────────────────────────────────────────────
    if (actType === 'exit-ticket') {
      if (isAr) {
        return {
          activityName: `بطاقة الخروج – ${topic}`,
          activityType: 'exit-ticket',
          grade: req.grade, subject: req.subject, lesson: topic, duration: dur,
          difficulty: req.difficulty, groupType: req.groupType,
          learningObjective: `التحقق من مستوى فهم الطلاب لـ${topic} في نهاية الحصة`,
          materials: ['ورقة بطاقة الخروج المطبوعة (1 لكل طالب)', 'قلم'],
          teacherPreparation: 'اطبع بطاقة الخروج (3-4 أسئلة). خصّص 5-7 دقائق في نهاية الحصة.',
          teacherNotes: ['اجمع البطاقات عند الباب', 'راجعها قبل الحصة القادمة لتعديل خطة التدريس'],
          answerKey: ['السؤال 1: التعريف الأساسي', 'السؤال 2: التطبيق', 'السؤال 3: التفكير الناقد', 'السؤال 4: التقييم الذاتي'],
          printables: ['بطاقة الخروج (نسخة لكل طالب)'],
          assessment: 'افرز البطاقات إلى 3 مجموعات: فهم كامل / فهم جزئي / يحتاج دعمًا.',
          extensionChallenge: `استخدم نتائج البطاقة لتصميم نشاط علاجي في بداية الحصة القادمة.`,
          slides: [
            { slideNumber: 1, type: 'intro', title: '🎫 بطاقة الخروج', content: `الوقت المتبقي: ${dur} دقائق\n\nقبل أن تغادر الفصل اليوم،\nأثبت ما تعلمته عن ${topic}.\n\n3 أسئلة سريعة — عمل فردي\nاجمع ورقتك عند الباب عند انتهاء الوقت.`, durationSeconds: 0 },
            {
              slideNumber: 2, type: 'challenge',
              title: '❓ السؤال 1 – تذكّر',
              content: `في كلماتك الخاصة:\nعرّف المفهوم الرئيسي لـ${topic}.\n\n(جملة أو جملتان تكفيان)`,
              hint: 'فكّر في ما شرحه المعلم في بداية الحصة',
              answer: 'إجابة مرنة – يُقيَّم الفهم وليس الحفظ الحرفي',
              durationSeconds: Math.round(dur * 20),
              teacher: { expectedAnswer: `تعريف دقيق بكلمات الطالب لـ${topic}`, teachingTips: 'ابحث عن الفهم المفاهيمي وليس الحفظ', suggestedQuestions: ['هل يعكس التعريف الفكرة الأساسية؟'] },
            },
            {
              slideNumber: 3, type: 'challenge',
              title: '❓ السؤال 2 – تطبيق',
              content: `حل هذه المسألة القصيرة:\nطبّق ${topic} على مثال من الكتاب المدرسي.\n\n(خطوتان أو ثلاث خطوات)`,
              hint: 'استخدم الخطوات التي درسناها اليوم',
              answer: 'حل كامل مع خطوات واضحة',
              durationSeconds: Math.round(dur * 25),
              teacher: { expectedAnswer: `حل نموذجي لمسألة ${topic} بخطوات منهجية`, teachingTips: 'قيّم الطريقة وليس الإجابة النهائية فقط', suggestedQuestions: ['هل كانت الخطوات منطقية ومرتبة؟'] },
            },
            {
              slideNumber: 4, type: 'challenge',
              title: '❓ السؤال 3 – تفكير',
              content: `سؤال التفكير الناقد:\nمتى لا ينجح أسلوب ${topic} الذي درسناه اليوم؟\nأو: اذكر موقفًا حياتيًا يستخدم ${topic}.\n\n(جملتان أو أكثر)`,
              hint: 'فكّر في الحدود والاستثناءات',
              answer: 'إجابة مرنة – إجابات متعددة مقبولة',
              durationSeconds: Math.round(dur * 20),
              teacher: { expectedAnswer: `تفكير نقدي حول حدود وتطبيقات ${topic}`, teachingTips: 'هذا أصعب الأسئلة الثلاثة — توقع إجابات متنوعة' },
            },
            { slideNumber: 5, type: 'summary', title: '🎫 الوقت انتهى!', content: `ضع قلمك وسلّم ورقتك.\n\nشكرًا على عملك الجاد اليوم في ${topic}!\n\nسأراجع إجاباتكم قبل الحصة القادمة.\n\nإذا كان لديك سؤال، أنا هنا بعد الحصة.`, durationSeconds: 0 },
          ],
        };
      }
      return {
        activityName: `Exit Ticket – ${topic}`,
        activityType: 'exit-ticket',
        grade: req.grade, subject: req.subject, lesson: topic, duration: dur,
        difficulty: req.difficulty, groupType: req.groupType,
        learningObjective: `Check student understanding of ${topic} at the end of the lesson`,
        materials: ['Printed exit ticket (1 per student)', 'Pen'],
        teacherPreparation: 'Print the exit ticket (3-4 questions). Reserve 5-7 minutes at the end of the lesson.',
        teacherNotes: ['Collect tickets at the door', 'Review before the next lesson to adjust your teaching plan'],
        answerKey: ['Q1: Core definition', 'Q2: Application', 'Q3: Critical thinking', 'Q4: Self-assessment'],
        printables: ['Exit ticket (one per student)'],
        assessment: 'Sort tickets into 3 piles: full understanding / partial understanding / needs support.',
        extensionChallenge: `Use the ticket results to design a targeted warm-up for the next lesson.`,
        slides: [
          { slideNumber: 1, type: 'intro', title: '🎫 Exit Ticket', content: `Time remaining: ${dur} minutes\n\nBefore you leave today,\nshow me what you learned about ${topic}.\n\n3 quick questions — individual work\nPlace your paper face-down on my desk when done.`, durationSeconds: 0 },
          {
            slideNumber: 2, type: 'challenge',
            title: '❓ Question 1 – Recall',
            content: `In your own words:\nDefine the main concept of ${topic}.\n\n(One or two sentences is enough)`,
            hint: 'Think about what we covered at the start of the lesson',
            answer: 'Flexible answer — assess understanding, not word-for-word recall',
            durationSeconds: Math.round(dur * 20),
            teacher: { expectedAnswer: `An accurate student-worded definition of ${topic}`, teachingTips: 'Look for conceptual understanding, not memorised text', suggestedQuestions: ['Does the definition capture the core idea?'] },
          },
          {
            slideNumber: 3, type: 'challenge',
            title: '❓ Question 2 – Apply',
            content: `Solve this short problem:\nApply ${topic} to an example from the textbook.\n\n(Two or three steps)`,
            hint: 'Use the steps we practised today',
            answer: 'Full solution with clear steps',
            durationSeconds: Math.round(dur * 25),
            teacher: { expectedAnswer: `A model solution for a ${topic} problem with logical steps`, teachingTips: 'Assess the method, not only the final answer', suggestedQuestions: ['Were the steps logical and well-ordered?'] },
          },
          {
            slideNumber: 4, type: 'challenge',
            title: '❓ Question 3 – Think',
            content: `Critical thinking question:\nWhen does the ${topic} method we learned today NOT work?\nOR: Name a real-world situation that uses ${topic}.\n\n(Two or more sentences)`,
            hint: 'Think about limitations and exceptions',
            answer: 'Flexible answer — multiple acceptable responses',
            durationSeconds: Math.round(dur * 20),
            teacher: { expectedAnswer: `Critical thinking about the scope and applications of ${topic}`, teachingTips: 'This is the hardest of the three — expect diverse answers' },
          },
          { slideNumber: 5, type: 'summary', title: '🎫 Pens down!', content: `Please place your paper on the desk.\n\nThank you for your hard work on ${topic} today!\n\nI will review your tickets before our next lesson.\n\nIf you have a question, I am available after class.`, durationSeconds: 0 },
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
            slideNumber: 2, type: 'intro',
            title: '🧭 كيف نلعب؟',
            content: '• تعملون في مجموعات، ولكل مجموعة ورقة واحدة تسجّلون فيها الأرقام.\n• أمامكم 5 تحديات، لكل تحدٍّ وقت محدّد يظهر على الشاشة.\n• كل تحدٍّ تحلّونه حلًّا صحيحًا يكشف رقمًا سريًا واحدًا — اكتبوه فورًا بالترتيب.\n• لا تُدخلون الأرقام في أي مكان: الكود يُجمع على ورقتكم أنتم.\n• في النهاية تقرؤون الأرقام الخمسة بالترتيب نفسه، فيكتمل كود الهروب.',
            durationSeconds: 0,
          },
          {
            slideNumber: 3, type: 'challenge',
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
            slideNumber: 4, type: 'reveal',
            title: '🔓 الكود 8 مفتوح!',
            content: 'أحسنتم! حصلتم على الكود الأول: 8\nسجّلوه في ورقتكم.',
            unlockCode: '8',
            durationSeconds: 0,
          },
          {
            slideNumber: 5, type: 'challenge',
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
            slideNumber: 6, type: 'reveal',
            title: '🔓 الكود 4 مفتوح!',
            content: 'رائع! الكود الثاني: 4',
            unlockCode: '4',
            durationSeconds: 0,
          },
          {
            slideNumber: 7, type: 'challenge',
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
            slideNumber: 8, type: 'reveal',
            title: '🔓 الكود 7 مفتوح!',
            content: 'ممتاز! الكود الثالث: 7',
            unlockCode: '7',
            durationSeconds: 0,
          },
          {
            slideNumber: 9, type: 'challenge',
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
            slideNumber: 10, type: 'reveal',
            title: '🔓 الكود 3 مفتوح!',
            content: 'عظيم! الكود الرابع: 3',
            unlockCode: '3',
            durationSeconds: 0,
          },
          {
            slideNumber: 11, type: 'challenge',
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
            slideNumber: 12, type: 'reveal',
            title: '🔓 الكود 6 مفتوح!',
            content: 'التحدي الأخير انتهى! الكود الخامس: 6',
            unlockCode: '6',
            durationSeconds: 0,
          },
          {
            slideNumber: 13, type: 'summary',
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
          slideNumber: 2, type: 'intro',
          title: '🧭 How to Play',
          content: '• Work in groups. One sheet per group — that is where the digits go.\n• There are 5 challenges, each with its own timer on screen.\n• Solve a challenge correctly and one secret digit is revealed — write it down straight away, in order.\n• There is nothing to type the digits into: the code is collected on your own sheet.\n• At the end, read your five digits back in the same order to complete the escape code.',
          durationSeconds: 0,
        },
        {
          slideNumber: 3, type: 'challenge',
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
          slideNumber: 4, type: 'reveal',
          title: '🔓 Code 8 Unlocked!',
          content: 'Great work! You got the first code: 8\nWrite it down on your sheet.',
          unlockCode: '8',
          durationSeconds: 0,
        },
        {
          slideNumber: 5, type: 'challenge',
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
          slideNumber: 6, type: 'reveal',
          title: '🔓 Code 4 Unlocked!',
          content: 'Excellent! Second code: 4',
          unlockCode: '4',
          durationSeconds: 0,
        },
        {
          slideNumber: 7, type: 'challenge',
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
          slideNumber: 8, type: 'reveal',
          title: '🔓 Code 7 Unlocked!',
          content: 'Brilliant! Third code: 7',
          unlockCode: '7',
          durationSeconds: 0,
        },
        {
          slideNumber: 9, type: 'challenge',
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
          slideNumber: 10, type: 'reveal',
          title: '🔓 Code 3 Unlocked!',
          content: 'Amazing! Fourth code: 3',
          unlockCode: '3',
          durationSeconds: 0,
        },
        {
          slideNumber: 11, type: 'challenge',
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
          slideNumber: 12, type: 'reveal',
          title: '🔓 Code 6 Unlocked!',
          content: 'Last challenge solved! Fifth code: 6',
          unlockCode: '6',
          durationSeconds: 0,
        },
        {
          slideNumber: 13, type: 'summary',
          title: '🎉 You Escaped!',
          content: 'Outstanding! Your team escaped the Math Lab!\nFull code: 8 – 4 – 7 – 3 – 6\n\nToday you practised:\n• Factoring quadratics\n• Difference of squares\n• Common factor extraction\n• Perfect square trinomials',
          durationSeconds: 0,
        },
      ],
    };
  }

  async generateHomework(req: AIRequest): Promise<WorksheetOutput> {
    await this.delay();
    beginMathPracticeSession();
    const lang: Lang = req.language === 'arabic' ? 'ar' : 'en';
    const kb = groundedKb(req.topic, lang);
    const topic = req.topic;
    const estMinutes = 25;
    const math = isMathContext(topic, kb, req.subject);

    const workSpace = lang === 'ar'
      ? '\n\nمساحة العمل:\n_________________________________\n_________________________________\n_________________________________'
      : '\n\nWork space:\n_________________________________\n_________________________________\n_________________________________';

    const usedStems = new Set<string>();
    const core: WQ[] = [];
    for (let i = 0; i < 3; i++) {
      let q: WQ | null = null;
      for (let attempt = 0; attempt < 12; attempt++) {
        const candidate = lang === 'ar' ? makeSAQ_ar(topic, kb, 'medium', req.subject) : makeSAQ_en(topic, kb, 'medium', req.subject);
        const key = questionStemKey(candidate.text);
        if (!usedStems.has(key)) {
          usedStems.add(key);
          q = candidate;
          break;
        }
      }
      if (!q) q = lang === 'ar' ? makeSAQ_ar(topic, kb, 'hard', req.subject) : makeSAQ_en(topic, kb, 'hard', req.subject);
      core.push({
        ...q,
        text: `${q.text}${workSpace}`,
        points: 8,
      });
    }

    const challengePractice = math
      ? takeConcreteMath('short_answer', topic, kb, 'hard', lang, 12)
      : null;
    const challenge: WQ = challengePractice
      ? {
          text: lang === 'ar'
            ? `سؤال التحدي (اختياري لكن يُحتسب):\n${challengePractice.text}${workSpace}`
            : `Challenge question (optional but graded):\n${challengePractice.text}${workSpace}`,
          points: 12,
          answer: challengePractice.answer,
        }
      : lang === 'ar'
        ? {
            text: `سؤال التحدي (اختياري لكن يُحتسب):\nابتكر مسألة من حياتك اليومية ترتبط بـ«${topic}»، ثم حلّها موضّحًا كل خطوة. اشرح لماذا يصلح حلّك في المنزل دون مساعدة المعلم.${workSpace}`,
            points: 12,
            answer: 'مسألة أصلية منطقية + حل متدرج صحيح',
          }
        : {
            text: `Challenge question (optional but graded):\nInvent a real-life problem connected to “${topic}”, then solve it step by step. Explain how a student can finish it independently at home.${workSpace}`,
            points: 12,
            answer: 'Original sensible problem + correct stepped solution',
          };

    const reflection: WQ = lang === 'ar'
      ? {
          text: `تأمل قصير (٣–٤ جمل):\nما أصعب جزء في «${topic}» اليوم؟ وما الاستراتيجية التي ستستخدمها للمراجعة قبل الحصة القادمة؟`,
          points: 4,
          answer: 'تأمل صادق يذكر صعوبة محددة واستراتيجية مراجعة',
        }
      : {
          text: `Short reflection (3–4 sentences):\nWhat was the hardest part of “${topic}” today, and what strategy will you use to revise before next class?`,
          points: 4,
          answer: 'Honest reflection naming a specific difficulty and a revision strategy',
        };

    return {
      title: lang === 'ar'
        ? `واجب منزلي – ${topic}`
        : `Homework Assignment – ${topic}`,
      instructions: lang === 'ar'
        ? `تعليمات للطالب\n• أنجز هذا الواجب بمفردك في المنزل (بدون ورقة عمل صفية).\n• الوقت التقديري: حوالي ${estMinutes} دقيقة.\n• الموعد: الحصة القادمة.\n• ابدأ بالتمارين المستقلة، ثم حاول سؤال التحدي.\n• أظهر خطواتك — الجودة أهم من السرعة.`
        : `Student instructions\n• Complete this assignment independently at home (not an in-class worksheet).\n• Estimated time: about ${estMinutes} minutes.\n• Due: next class.\n• Start with the independent practice, then try the challenge.\n• Show your steps — clarity matters more than speed.`,
      sections: [
        {
          type: 'short_answer',
          title: lang === 'ar' ? '١) تدريب مستقل' : '1) Independent practice',
          questions: core,
        },
        {
          type: 'short_answer',
          title: lang === 'ar' ? '٢) سؤال التحدي' : '2) Challenge question',
          questions: [challenge],
        },
        {
          type: 'short_answer',
          title: lang === 'ar' ? '٣) تأمل سريع' : '3) Quick reflection',
          questions: [reflection],
        },
      ],
      answerKey: [
        ...core.map((q, i) => ({ num: i + 1, answer: q.answer ?? '—' })),
        { num: core.length + 1, answer: challenge.answer ?? '—' },
        { num: core.length + 2, answer: reflection.answer ?? '—' },
      ],
    };
  }
}

export const aiService = new MockAIService();
// Legacy mock export kept for fallback use inside RemoteAIService
