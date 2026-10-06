import { plainActivity } from './activityText.ts';
import { AIService } from './AIService.ts';
import type {
  ActivityOutput, ActivityStep, AIRequest,
  ClassroomActivity, ClassroomActivityRequest,
  LessonPlanOutput,
  QuizOutput, QuizQuestion, WorksheetAnswerKeyItem,
  WorksheetOutput, WorksheetSection,
} from './AIService.ts';
import type { KBLesson } from '../knowledgeBase.ts';
import { buildInfographicFromLesson, type InfographicOutput } from './infographic.ts';
import { getBookForLesson, getLessonById, getUnitForLesson, resolveGroundedKbLesson } from '../knowledgeBase.ts';
import { figuresForLesson } from '../bookFigures.ts';
import {
  parseDocumentGrounding,
  type DocumentGrounding,
} from '../documents/grounding.ts';
import {
  beginMathPracticeSession,
  hasMathBank,
  isMathContext,
  subjectIdFromName,
  takeConcreteMath,
  takeConcreteMathBatch,
  takeSolvedMath,
  completionSplit,
  type DiffTier,
} from './mathPractice.ts';
import { isChemContext, takeConcreteChem, takeConcreteChemBatch, takeSolvedChem, type SolvedItem } from './chemPractice.ts';
import { buildActivityBlueprint } from './activityBlueprints.ts';
import {
  buildErrorDetective, buildEscape, buildExitTicket, buildGalleryWalk, buildRelay, buildTermBingo,
  type Challenge, type ErrorCase, type FormatCtx,
} from './classroomFormats.ts';
import { lessonTasks, nextVariantFor, termNames, windowOf, type LessonTask } from './classroomTasks.ts';
import { buildLessonStyleBlueprint, type LessonDocContext } from './lessonPlanBlueprints.ts';
import { arPrefixed, lessonKindFor, type LessonKind } from './lessonPlanKinds.ts';
import { arMinutes } from './lessonPlanTypes.ts';
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
interface WQ {
  text: string; options?: string[]; answer: string; points: number;
  /** Checked working from the bank; becomes the key's `solution`, never part of the question. */
  steps?: string[];
  /** See `WorksheetQuestion.fromBank`. Set by `tryMathPractice` and nowhere it isn't true. */
  fromBank?: true;
}
/** Carries a bank item's mark onto a quiz question, which copies fields one by one. */
const bankMark = (q: WQ): { fromBank?: true } => (q.fromBank ? { fromBank: true } : {});
/** A question as stored on the paper: the working belongs to the key, not the student's copy. */
const withoutSteps = ({ steps: _steps, ...rest }: WQ): WQ => rest;

/**
 * The KB lesson to ground on: the id when the caller supplied one, otherwise
 * the topic if it clears the grounding confidence bar.
 *
 * **An id identifies a lesson; a title does not.** Four of the 33 Grade 10
 * maths lesson titles exist verbatim elsewhere in the curriculum, so resolving
 * by title alone grounded «النسب المثلثية» and «تبسيط المقادير الأسية» on Grade
 * 9 lessons, «المتتاليات» on a Grade 7 one, and «جمع المتجهات وطرحها» on Grade
 * 10 **physics** — a maths worksheet built from physics key terms. Every
 * `/ai-tools` screen already sends `AIRequest.lessonId`; this path simply threw
 * it away and asked the semantic search to guess what the caller already knew.
 *
 * The title path stays for callers that genuinely only hold a topic string —
 * chat, and a screen opened with a bare `topic` param.
 */
function groundedKb(topic: string, lang: Lang, lessonId?: string): KBLesson | null {
  if (lessonId) {
    const byId = getLessonById(lessonId);
    if (byId) return byId;
  }
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

/**
 * A question template plus the difficulty tier it actually is.
 *
 * The tier lives ON each template rather than in a separate index list: a
 * parallel list of indices silently mismatches the moment someone reorders or
 * inserts a template, and the failure would look like "difficulty does nothing"
 * — which is the bug this was written to fix.
 */
type TieredTemplate = { tier: DiffTier; make: () => WQ };

/**
 * Pick a template from the requested tier.
 *
 * Falls back to the adjacent tier when a slice is empty, mirroring the shape
 * `takeConcreteMath` already uses for the math bank (`mathPractice.ts`): a
 * question from the neighbouring tier beats no question at all, and beats
 * silently serving every tier from one pool — which is what these factories
 * did before, with `diff` reaching only the points value.
 */
function pickTiered(templates: TieredTemplate[], diff: string): () => WQ {
  const tier: DiffTier = diff === 'easy' || diff === 'hard' ? diff : 'medium';
  const fallback: Record<DiffTier, DiffTier[]> = {
    easy: ['easy', 'medium', 'hard'],
    medium: ['medium', 'easy', 'hard'],
    hard: ['hard', 'medium', 'easy'],
  };
  for (const t of fallback[tier]) {
    const slice = templates.filter(x => x.tier === t);
    if (slice.length > 0) return pick(slice).make;
  }
  return templates[0].make;
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

/**
 * Shared entry: a concrete bank item, else null (caller falls back to the
 * subject-blind templates below).
 *
 * Chemistry was added 2026-09-16. Before that this returned null for every
 * chemistry lesson — correctly, since `isMathContext` is subject-authoritative
 * — and every chemistry question came from the generic templates, which name
 * the topic but ask nothing about it («أيّ مما يلي يُعرِّف {الموضوع} بشكل
 * صحيح؟», distractor «لا شيء مما ذُكر»). That is the whole of "the exams feel
 * generic" for chemistry.
 *
 * Chemistry is asked first, and the order is load-bearing for exactly one
 * case: a free-text topic with no lesson picked and no subject passed, where
 * both fall back to matching words. `MATH_TEXT_RE` contains «معادل» and
 * «أسس», so «المعادلة الكيميائية» matches it; the chemistry pattern is the
 * narrower of the two and does not match maths topics. Asking it first means
 * the specific signal wins. Whenever a subject or a resolved lesson IS present
 * — which is every path through the app's own forms — the two are exclusive by
 * construction and the order changes nothing.
 *
 * The name is unchanged so the ten call sites below read as they did.
 */
function tryMathPractice(
  type: QType,
  topic: string,
  kb: KBLesson | null,
  diff: string,
  lang: Lang,
  points: number,
  subject?: string,
  /**
   * Passed straight through to `takeConcreteMath`/`takeConcreteChem` — false
   * for the worksheet path, so an exhausted family falls through to a
   * generic topic-templated question instead of repeating a bank item
   * verbatim on the same printed page. See `takeFromBank`.
   */
  allowRepeat: boolean = true,
): WQ | null {
  const tier: DiffTier = diff === 'easy' || diff === 'hard' ? diff : 'medium';
  const item = isChemContext(topic, kb, subject)
    ? takeConcreteChem(type, topic, kb, tier, lang, points, undefined, allowRepeat)
    : isMathContext(topic, kb, subject)
      ? takeConcreteMath(type, topic, kb, tier, lang, points, undefined, allowRepeat)
      : null;
  return item ? { ...item, fromBank: true } : null;
}

/**
 * Thrown while a quiz or worksheet is being built, when a lesson the bank
 * covers has no unused item left. The caller stops and returns the questions
 * it has: a shorter paper, not a paper padded with topic-templated sentences
 * that read like questions and test nothing.
 */
class BankSpentError extends Error {}
let bankOnly = false;

/** `tryMathPractice`, except that a spent bank is an error while `bankOnly` is set. */
function takeFromBankOrStop(...args: Parameters<typeof tryMathPractice>): WQ | null {
  const item = tryMathPractice(...args);
  if (item === null && bankOnly && (isChemContext(args[1], args[2], args[6]) || isMathContext(args[1], args[2], args[6]))) {
    throw new BankSpentError();
  }
  return item;
}

// ─── Lesson Plan helpers (Arabic) ────────────────────────────────────────────

/**
 * Objectives a lesson of this kind can honestly be given when the curriculum
 * states none. «أن يحل الطالب مسائل متنوعة» was every subject's fallback, which
 * is a maths objective on a Quran, art or PE lesson. `null` for mathematics,
 * which keeps its own.
 */
function kindObjectives(kind: LessonKind, topic: string, lang: Lang): string[] | null {
  const ar: Partial<Record<LessonKind, string[]>> = {
    science: [`أن يلاحظ الطالب ويصف ما يتصل ${arPrefixed('ب', topic)}`, `أن يفسّر الطالب ظاهرة مرتبطة ${arPrefixed('ب', topic)} مستندًا إلى دليل`, 'أن يوظّف الطالب ما تعلّمه في تفسير موقف جديد'],
    recitation: ['أن يقرأ الطالب ما تقرّر من آيات أو حديث قراءة سليمة', 'أن يبيّن الطالب معاني المفردات والفكرة الرئيسة', 'أن يربط الطالب القيمة المستفادة بسلوك من حياته'],
    arabic: ['أن يقرأ الطالب النص قراءة سليمة معبّرة', 'أن يوظّف الطالب المفردات الجديدة في جمل مفيدة', 'أن يكتب الطالب فقرة قصيرة سليمة موظّفًا ما تعلّمه'],
    english: ['أن يفهم الطالب اللغة المستهدفة في الدرس وينطقها نطقًا سليمًا', 'أن يستعمل الطالب اللغة المستهدفة في حوار قصير مع زميله', 'أن ينتج الطالب جملًا صحيحة عن نفسه أو عن محيطه'],
    social: [`أن يحدّد الطالب الأحداث أو المعالم الأساسية في «${topic}»`, 'أن يفسّر الطالب الأسباب والنتائج بالاستناد إلى مصدر', 'أن يبدي الطالب رأيًا مدعومًا بدليل من الدرس'],
    movement: ['أن يؤدي الطالب المهارة بنقاط أدائها الأساسية', 'أن يطبّق الطالب المهارة في لعبة أو موقف أداء مع الالتزام بقواعد السلامة', 'أن يقيّم الطالب أداءه ويحدّد نقطة للتحسين'],
    making: [`أن يتعرّف الطالب إلى المصطلحات والأدوات الأساسية في «${topic}»`, 'أن ينفّذ الطالب العمل المطلوب بخطواته الأساسية وبما يحقق معايير الجودة', 'أن يقيّم الطالب عمله ويقترح تحسينًا'],
  };
  const en: Partial<Record<LessonKind, string[]>> = {
    science: [`Students will observe and describe what relates to ${topic}`, `Students will explain a phenomenon linked to ${topic} using evidence`, 'Students will use what they learned to explain a new situation'],
    recitation: ['Students will read the set text correctly', 'Students will explain the meanings of the words and the main idea', 'Students will connect the value learned to their own behaviour'],
    arabic: ['Students will read the text correctly and expressively', 'Students will use the new vocabulary in meaningful sentences', 'Students will write a short, correct paragraph using what they learned'],
    english: ['Students will understand and say the target language correctly', 'Students will use the target language in a short pair dialogue', 'Students will produce correct sentences about themselves or their surroundings'],
    social: [`Students will identify the key events or features in “${topic}”`, 'Students will explain causes and consequences using a source', 'Students will give an opinion supported by evidence from the lesson'],
    movement: ['Students will perform the skill with its key performance points', 'Students will apply the skill in a game or performance task while following the safety rules', 'Students will assess their own performance and name one point to improve'],
    making: [`Students will recognise the key terms and tools in “${topic}”`, 'Students will carry out the required work through its main steps to the quality criteria', 'Students will evaluate their own work and suggest an improvement'],
  };
  return (lang === 'ar' ? ar : en)[kind] ?? null;
}

function lpObjectivesAr(topic: string, kb: KBLesson | null, custom?: string, kind: LessonKind = 'calc'): string[] {
  if (custom?.trim()) return custom.trim().split('\n').filter(Boolean);
  // Prefer official curriculum outcomes when present on the KB lesson
  if (kb?.objectives?.length) return [...kb.objectives];
  const own = kindObjectives(kind, topic, 'ar');
  if (own && (kind === 'movement' || kind === 'making' || kind === 'recitation')) return own;
  if (kb?.keyConceptsAr.length) {
    const c = kb.keyConceptsAr;
    return [
      `أن يُعرِّف الطالب ${c[0]}`,
      c[1] ? `أن يشرح الطالب ${c[1]} بأمثلة توضيحية` : (own?.[1] ?? `أن يطبق مفهوم ${topic} في حل مسائل متنوعة`),
      `أن يميّز الطالب بين المفاهيم الأساسية المرتبطة ${arPrefixed('ب', topic)} ويقارن بينها`,
    ];
  }
  return own ?? [
    `أن يُعرِّف الطالب المفاهيم الأساسية ${arPrefixed('ل', topic)}`,
    `أن يشرح الطالب تطبيقات ${topic} في الحياة اليومية`,
    `أن يحل الطالب مسائل متنوعة حول ${topic} بخطوات منهجية`,
  ];
}
/**
 * What the plan may tell a teacher to put on the screen.
 *
 * These generators used to say «اعرض صورة ذات صلة» / "Show a visual related
 * to X" unconditionally — an instruction to go and find a picture the app
 * never supplied, in the one section a teacher reads while the class is
 * already sitting down. It is the demo path's version of the same defect the
 * figure rule fixes on the live path: promising a visual that does not exist.
 *
 * It exists now, for the lessons that have one. The deck puts the book's own
 * figures on their own slides and the export prints them in the «من الكتاب
 * المدرسي» appendix, so the instruction can name that instead of sending the
 * teacher looking. Where there are no figures — most subjects; only both
 * maths, both chemistry and financial literacy have any — it returns '' and
 * the sentence is simply left out rather than asking for something nobody has.
 */
function bookFigureCue(kb: KBLesson | null, lang: Lang): string {
  if (!kb?.id || figuresForLesson(kb.id).length === 0) return '';
  return lang === 'ar'
    ? ' اعرض شكل الكتاب المدرسي في شريحة «من كتاب الطالب» وناقش ما يراه الطلبة فيه.'
    : " Show the student-book figure on the “From the Student Book” slide and discuss what students notice in it.";
}

/**
 * Openings that suit the lesson. The generic ones — «التنبؤ والاستكشاف: اعرض
 * موقفًا حياتيًا واطلب التنبؤ بالتفسير» — are a science hook; on a surah or a
 * relay race they read as the wrong lesson. Science and social studies had been
 * left on the generic set; their own openers start from an observation or a
 * source instead of asking where the topic turns up in daily life.
 */
function kindIntro(kind: LessonKind, topic: string, lang: Lang): string[] | null {
  const ar: Partial<Record<LessonKind, string[]>> = {
    science: [
      `ابدأ بظاهرة قصيرة أو صورة مثيرة مرتبطة بـ«${topic}» دون أن تفسّرها، واسأل: «ماذا ترون؟ وماذا تتوقعون أن يحدث بعد ذلك؟» وسجّل التوقعات على السبورة لنعود إليها في نهاية الحصة.`,
      `اسأل الطلبة: «أين صادفتم “${topic}” في بيتكم أو في الطبيعة؟» ثم اختر مثالًا واحدًا وحوّله إلى سؤال يبحث عنه الدرس: «لماذا يحدث هذا؟»`,
      `اعرض شيئًا أو صورة مرتبطة بـ«${topic}» واطلب من كل طالب أن يكتب سؤالًا واحدًا يريد أن يعرف جوابه، ثم اجمع الأسئلة وأعلن أن الحصة ستجيب عن بعضها.`,
    ],
    social: [
      `اعرض صورة أو خريطة أو سطرًا قصيرًا من مصدر الدرس عن «${topic}»، واسأل: «ماذا نلاحظ؟ وما الذي يثير تساؤلكم؟» ودوّن أسئلة الطلبة لنحاول الإجابة عنها خلال الحصة.`,
      `اطرح موقفًا قريبًا من حياة الطلبة له علاقة بـ«${topic}» واسأل: «ماذا كنتم ستفعلون؟ ولماذا؟» ثم اربط إجاباتهم بما سندرسه اليوم.`,
      `اسأل: «ماذا نعرف عن “${topic}”؟ ومن أين عرفنا ذلك؟» ثم ميّز مع الطلبة بين ما نعرفه بدليل وما سمعناه فقط، وأعلن أننا سنتحقّق منه بالمصدر.`,
    ],
    recitation: [
      `ابدأ بتهيئة هادئة: استمع دقيقتين إلى ما يعرفه الطلبة عن «${topic}»، ثم أعلن هدف الحصة: أن نقرأ قراءة سليمة، ونفهم المعنى، ونعمل بما نتعلّم.`,
      `اسأل: «لماذا نتعلّم “${topic}”؟ وماذا نتوقع أن يتغيّر في سلوكنا؟» ثم أخبر الطلبة أنهم سيقرؤون ما تقرّر من آيات أو حديث ثم يتأمّلون معناه معًا.`,
    ],
    movement: [
      `ابدأ بسؤال: «أين نستعمل مهارة “${topic}” في الألعاب أو في حياتنا؟» ثم نبّه الطلبة إلى قواعد السلامة قبل الإحماء.`,
      `اعرض أداءً سريعًا للمهارة (بنفسك أو بطالب متقن) واسأل: «ما أهم ما لاحظتموه في الحركة؟» ثم اربط ملاحظاتهم بأهداف الدرس.`,
    ],
    arabic: [
      `ابدأ بسؤال يهيّئ النص: «ماذا تتوقعون أن يتحدث عنه درس “${topic}”؟» ودوّن توقعات الطلبة ثم اربطها بعنوان الدرس.`,
      `اقرأ جملة أو عنوانًا من الدرس بصوت معبّر واسأل: «ما الذي لفت انتباهكم؟» ثم اربط إجاباتهم بهدف الحصة.`,
    ],
    english: [
      `ابدأ بإحماء قصير: أسئلة سريعة أو صورة تستثير مفردات «${topic}» قبل تقديم اللغة الجديدة، وشجّع الإجابة بأي لغة يتقنونها.`,
      `اسأل بالإنجليزية الميسّرة أو بالإشارة: ماذا نعرف عن «${topic}»؟ واكتب ما يعرفونه من كلمات على السبورة ليبني عليه الدرس.`,
    ],
    making: [
      `اعرض عملًا منجزًا يتصل بـ«${topic}» واسأل: «ما الذي يعجبكم فيه؟ وكيف ترون أنه صُنع؟» ثم اربط ملاحظاتهم بأهداف الدرس.`,
      `اسأل: «أين نرى “${topic}” في حياتنا أو حولنا؟» ودوّن الأمثلة، ثم أعلن ما سيصنعه الطلبة اليوم.`,
    ],
  };
  const en: Partial<Record<LessonKind, string[]>> = {
    science: [
      `Start with a short phenomenon or a striking picture linked to “${topic}”, without explaining it, and ask: “What do you see? What do you expect to happen next?” Record the predictions on the board so we can return to them at the end of the lesson.`,
      `Ask: “Where have you come across “${topic}” at home or in nature?” Then pick one example and turn it into the question the lesson will look into: “Why does this happen?”`,
      `Show an object or picture linked to “${topic}” and have each student write one question they want answered, then collect them and say the lesson will answer some of them.`,
    ],
    social: [
      `Show a picture, a map or a short line from the lesson’s source about “${topic}” and ask: “What do we notice? What makes you wonder?” Record the students’ questions to try to answer during the lesson.`,
      `Pose a situation close to students’ lives that relates to “${topic}” and ask: “What would you do, and why?” Then link their answers to what we will study today.`,
      `Ask: “What do we know about “${topic}”, and how do we know it?” Then separate with students what we know from evidence and what we have only heard, and say we will check it against the source.`,
    ],
    recitation: [
      `Begin with a calm preparation: listen for two minutes to what students already know about “${topic}”, then state the lesson’s aim: to read well, to understand, and to act on what we learn.`,
      `Ask: “Why do we learn “${topic}”? What do we expect to change in our behaviour?” Then tell students they will read the set text and then understand it together.`,
    ],
    movement: [
      `Open with: “Where do we use the skill “${topic}” in games or in our lives?” Then remind students of the safety rules before the warm-up.`,
      `Show a quick performance of the skill (yourself or a skilled student) and ask: “What did you notice most about the movement?” Then tie their observations to the lesson aims.`,
    ],
    arabic: [
      `Prepare the text with a question: “What do you expect the lesson “${topic}” to talk about?” Record students’ predictions and tie them to the lesson title.`,
      `Read a sentence or a heading from the lesson expressively and ask: “What caught your attention?” Then link their answers to the aim of the lesson.`,
    ],
    english: [
      `Start with a short warm-up: quick questions or a picture that brings out the vocabulary of “${topic}” before the new language is introduced, and welcome answers in any language students have.`,
      `Ask in simple English or by gesture: what do we know about “${topic}”? Write the words they already have on the board for the lesson to build on.`,
    ],
    making: [
      `Show a finished piece of work linked to “${topic}” and ask: “What do you like about it? How do you think it was made?” Then tie their observations to the lesson aims.`,
      `Ask: “Where do we see “${topic}” in our lives or around us?” Record the examples, then announce what students will make today.`,
    ],
  };
  return (lang === 'ar' ? ar : en)[kind] ?? null;
}

function lpIntroAr(topic: string, kb: KBLesson | null, kind: LessonKind = 'calc'): string {
  const own = kindIntro(kind, topic, 'ar');
  if (own) return pick(own) + bookFigureCue(kb, 'ar');
  if (kb) return pick([
    `ابدأ بطرح السؤال: "أين نلتقي ${arPrefixed('ب', topic)} في حياتنا اليومية؟" سجّل إجابات الطلبة على السبورة.${bookFigureCue(kb, 'ar')} ثم اربط إجاباتهم بأهداف الدرس.`,
    `لعبة "ما أعرفه / ما أريد تعلّمه": يكتب الطلبة على ورقة ما يعرفونه عن ${kb.titleAr} (دقيقتان). تُشارك بعض الإجابات ثم يُحدد المعلم ما سنكتشفه معًا.`,
    `"التنبؤ والاستكشاف": اعرض موقفًا حياتيًا مرتبطًا ${arPrefixed('ب', topic)} واطلب من الطلبة التنبؤ بالتفسير. استخدم تنبؤاتهم كنقطة انطلاق لأهداف الدرس.`,
  ]);
  return pick([
    `ابدأ بسؤال تحفيزي: "كيف يرتبط ${topic} بحياتنا اليومية؟" استمع لمشاركات 3-4 طلبة وسجّلها على السبورة، ثم ابنِ عليها مدخلًا للدرس.`,
    `"فكّر – زاوج – شارك": يفكر كل طالب 30 ثانية فيما يعرفه عن ${topic}، يشارك زميله، ثم تُطرح بعض الإجابات على الصف.`,
  ]);
}
function lpClosureAr(topic: string, dur: number): string {
  const t = Math.round(dur * 0.1);
  return pick([
    `(${arMinutes(t)}) بطاقة الخروج:\n• أهم شيء تعلمته اليوم عن ${topic}.\n• سؤال لا يزال يراوده.\nاجمع البطاقات عند الخروج.`,
    `(${arMinutes(t)}) "3-2-1":\n• 3 أشياء تعلمتها\n• 2 مفاهيم أريد فهمها أكثر\n• 1 سؤال لديّ عن ${topic}`,
  ]);
}

// ─── Lesson Plan helpers (English) ───────────────────────────────────────────

function lpObjectivesEn(topic: string, kb: KBLesson | null, custom?: string, kind: LessonKind = 'calc'): string[] {
  if (custom?.trim()) return custom.trim().split('\n').filter(Boolean);
  if (kb?.objectives?.length) return [...kb.objectives];
  const own = kindObjectives(kind, topic, 'en');
  if (own && (kind === 'movement' || kind === 'making' || kind === 'recitation')) return own;
  if (kb?.keyConceptsEn.length) {
    const c = kb.keyConceptsEn;
    return [
      `Students will define and explain ${c[0]}`,
      c[1] ? `Students will describe ${c[1]} with real-world examples` : (own?.[1] ?? `Students will apply ${topic} to solve varied problems`),
      `Students will compare and contrast the key concepts related to ${topic}`,
    ];
  }
  return own ?? [
    `Students will define key concepts related to ${topic}`,
    `Students will explain real-world applications of ${topic}`,
    `Students will solve problems involving ${topic} using systematic methods`,
  ];
}
function lpIntroEn(topic: string, kb: KBLesson | null, kind: LessonKind = 'calc'): string {
  const own = kindIntro(kind, topic, 'en');
  if (own) return pick(own) + bookFigureCue(kb, 'en');
  if (kb) return pick([
    `Open with: "Where do we encounter ${topic} in everyday life?" Record 3-4 student responses on the board.${bookFigureCue(kb, 'en')} Then bridge to today's objectives.`,
    `"Know / Want to Know" activity: Students write what they already know about ${kb.titleEn} (2 min). Share responses, then identify what we'll discover together.`,
    `"Predict & Explore": Present a real-world scenario related to ${topic}. Ask students to predict the explanation. Use their predictions to motivate the lesson.`,
  ]);
  return pick([
    `Open with: "How does ${topic} connect to our daily lives?" Listen to 3-4 student responses and record them on the board as a bridge to the lesson.`,
    `"Think – Pair – Share": Students think for 30 seconds about what they know about ${topic}, share with a partner, then selected pairs share with the class.`,
  ]);
}
function lpClosureEn(topic: string, dur: number): string {
  const t = Math.round(dur * 0.1);
  return pick([
    `(${t} min) Exit ticket:\n• Most important thing learned about ${topic}.\n• One remaining question.\nCollect at the door.`,
    `(${t} min) "3-2-1" reflection:\n• 3 things learned\n• 2 concepts to explore further\n• 1 question about ${topic}`,
  ]);
}
/** Homework a lesson of this kind can honestly be given — «بيّن خطوات الحل» is for maths. */
function kindHomework(kind: LessonKind, topic: string, lang: Lang): string[] | null {
  const ar: Partial<Record<LessonKind, string[]>> = {
    science: [`لاحظ في بيتك أو في الطريق ظاهرة مرتبطة ${arPrefixed('ب', topic)}، وسجّل ملاحظتين وتفسيرًا واحدًا مدعومًا بدليل.`, `ارسم مخططًا مبسّطًا يوضّح الفكرة الرئيسة في ${topic}، وسمِّ أجزاءه واكتب تحته جملتين تشرحانه.`],
    recitation: [`راجع ما قرأناه في الحصة ثلاث مرات مع أحد أفراد أسرتك، وسجّل موقفًا طبّقت فيه القيمة المستفادة من «${topic}».`, `اكتب جملة مفيدة تستعمل فيها كلمتين جديدتين من درس «${topic}»، ثم اقرأها لأحد أفراد أسرتك.`],
    arabic: [`اكتب فقرة من خمس جمل عن «${topic}»، مستعملًا ثلاث كلمات جديدة من الدرس.`, 'اقرأ نص الدرس بصوت معبّر لأحد أفراد أسرتك، ثم أخبره بالفكرة الرئيسة بكلماتك.'],
    english: ['اكتب خمس جمل تستعمل فيها اللغة التي تعلّمتها اليوم عن نفسك أو أسرتك، واقرأها بصوت عالٍ لأحد في البيت.', 'اصنع بطاقات للمفردات الجديدة: كلمة وصورة وجملة لكل بطاقة.'],
    social: [`اختر حدثًا أو مكانًا من درس «${topic}» واكتب فقرة قصيرة تشرح سببه ونتيجته مستعينًا بالكتاب.`, `اسأل أحد كبار أسرتك سؤالًا يتصل ${arPrefixed('ب', topic)} وسجّل إجابته في ثلاث جمل، ثم قارنها بما في الكتاب.`],
    movement: ['مارس تمرينين من تمارين اليوم عشر دقائق في البيت أو الحديقة، وسجّل ما شعرت به وما تحسّن.', `علِّم أحد أفراد أسرتك الحركة الأساسية في «${topic}» بأسلوب آمن، ولاحظ نقاط الأداء.`],
    making: ['أكمل عملك أو حسّنه في البيت مستعينًا ببطاقة المعايير، وأحضره أو صوّره للصف.', `ابحث عن مثال واحد من حياتك أو بيئتك يتصل ${arPrefixed('ب', topic)} وصِفه بجملتين.`],
  };
  const en: Partial<Record<LessonKind, string[]>> = {
    science: [`Observe a phenomenon linked to ${topic} at home or on the way, and record two observations and one explanation backed by evidence.`, `Draw a simple diagram of the main idea in ${topic}, label its parts and write two sentences under it explaining it.`],
    recitation: [`Review what we read in class three times with a family member, and note a situation where you applied the value learned from “${topic}”.`, `Write a meaningful sentence using two new words from “${topic}”, then read it to a family member.`],
    arabic: [`Write a five-sentence paragraph about ${topic} using three new words from the lesson.`, 'Read the lesson text expressively to a family member, then tell them the main idea in your own words.'],
    english: ['Write five sentences in the language you learned today about yourself or your family, and read them aloud to someone at home.', 'Make flashcards for the new vocabulary: a word, a picture and a sentence on each card.'],
    social: [`Choose an event or place from “${topic}” and write a short paragraph explaining its cause and consequence, using the textbook.`, `Ask an older family member a question about ${topic}, write their answer in three sentences, then compare it with the textbook.`],
    movement: ['Practise two exercises from the lesson for ten minutes at home or in the park, and note how you felt and what improved.', `Teach a family member the basic movement in “${topic}” safely, and watch the performance points.`],
    making: ['Finish or improve your work at home using the criteria card, and bring it or a photo of it to class.', `Find one example from your life or surroundings linked to ${topic} and describe it in two sentences.`],
  };
  return (lang === 'ar' ? ar : en)[kind] ?? null;
}
function lpHomework(topic: string, lang: Lang, kind: LessonKind = 'calc'): string {
  const own = kindHomework(kind, topic, lang);
  if (own) return pick(own);
  return pick(lang === 'ar' ? [
    `أجب عن التمارين المحددة من الكتاب المدرسي حول ${topic}. بيّن خطوات الحل كاملة.`,
    `اكتب ملخصًا شخصيًا من 10 جمل عن ${topic}. أضف مثالًا حياتيًا وجدته بنفسك.`,
  ] : [
    `Complete the assigned textbook exercises on ${topic}. Show all working for full credit.`,
    `Write a 10-sentence personal summary of ${topic} including a real-world example you found.`,
  ]);
}
/**
 * Plan for a short warm-up reviewing prior material — grounded curriculum
 * concepts (only when `includePriorReview` + a non-empty `priorKnowledge`)
 * and/or the teacher's own free-text notes on topics to re-explain.
 * `undefined` when neither input is present, so callers can omit the field.
 */
function lpPriorReview(priorConcepts: string[], notes: string, lang: Lang): string | undefined {
  const hasConcepts = priorConcepts.length > 0;
  const hasNotes = notes.trim().length > 0;
  if (!hasConcepts && !hasNotes) return undefined;
  if (lang === 'ar') {
    const parts = ['خصّص 5-10 دقائق في بداية الحصة لمراجعة سريعة قبل الانتقال إلى الدرس الجديد.'];
    if (hasConcepts) parts.push(`راجع هذه المفاهيم من المنهاج: ${priorConcepts.join('، ')}.`);
    if (hasNotes) parts.push(`بحسب ملاحظات المعلم: ${notes.trim()}`);
    return parts.join(' ');
  }
  const parts = ['Set aside 5-10 minutes at the start of the lesson for a quick review before moving to new material.'];
  if (hasConcepts) parts.push(`Review these curriculum concepts: ${priorConcepts.join(', ')}.`);
  if (hasNotes) parts.push(`Per the teacher's notes: ${notes.trim()}`);
  return parts.join(' ');
}

// ─── Key-term definitions ─────────────────────────────────────────────────────

/**
 * A key term's definition, or null when there is not one to use.
 *
 * `definitionAr` is frequently an **empty string** rather than absent — 8 of
 * the 36 Grade 10 maths lessons have one, «المعادلة الأسية» and «قانون جيب
 * التمام» among them. That matters because `??` does not fire on `''`, so
 * `t0?.definitionAr?.split(' ').slice(0, 9).join(' ') ?? fallback` evaluated to
 * `''` and flowed straight through as the answer. The multiple-choice factory
 * then shipped an item whose *correct option* was the empty string, and the
 * worksheet's answer key had a blank entry for it — roughly half the
 * generations on those lessons, because the affected template is one of two in
 * the easy tier.
 *
 * Every site that reads a definition goes through here, so a blank one can only
 * ever become a stated fallback and never a blank answer.
 */
function definitionOf(definition: string | undefined): string | null {
  const trimmed = definition?.trim();
  return trimmed ? trimmed : null;
}

/** First `words` words of a definition, or null when there is no definition. */
function defWords(definition: string | undefined, words: number): string | null {
  const full = definitionOf(definition);
  return full ? full.split(/\s+/).slice(0, words).join(' ') : null;
}

/** First `chars` characters of a definition, or null when there is none. */
function defChars(definition: string | undefined, chars: number): string | null {
  return definitionOf(definition)?.substring(0, chars) ?? null;
}

// ─── Points helpers ───────────────────────────────────────────────────────────

function mcPts(diff: string) { return diff === 'easy' ? 2 : diff === 'hard' ? 6 : 4; }
function saPts(diff: string) { return diff === 'easy' ? 4 : diff === 'hard' ? 10 : 6; }
function fbPts(diff: string) { return diff === 'easy' ? 2 : diff === 'hard' ? 4 : 3; }
function tfPts(_diff: string) { return 2; }

// ─── Arabic question factories — one question per call, random phrasing ───────

function makeMCQ_ar(topic: string, kb: KBLesson | null, diff: string, subject?: string, allowRepeat: boolean = true): WQ {
  const pts = mcPts(diff);
  const math = takeFromBankOrStop('multiple_choice', topic, kb, diff, 'ar', pts, subject, allowRepeat);
  if (math) return math;
  const t0 = kb?.keyTerms?.filter(t => t.ar?.trim())[0];
  const t1 = kb?.keyTerms?.filter(t => t.ar?.trim())[1];
  const c0 = kb?.keyConceptsAr?.[0]?.trim() || topic;
  const c1 = kb?.keyConceptsAr?.[1]?.trim() || `تطبيق ${topic}`;

  const correct0 = defWords(t0?.definitionAr, 9) ?? `الوصف الصحيح لـ${topic}`;
  const templates: TieredTemplate[] = [
    { tier: 'easy', make: () => ({ text: `أيّ مما يلي يُعرِّف ${t0?.ar ?? topic} بشكل صحيح؟`, options: placeCorrect(correct0, [`مفهوم يختلف عن ${topic}`, 'وصف لظاهرة أخرى', 'لا شيء مما ذُكر']), answer: correct0, points: pts }) },
    { tier: 'medium', make: () => ({ text: `عند تطبيق ${topic} في مسألة حياتية، ما الخطوة الأولى الصحيحة؟`, options: placeCorrect('تحديد المعطيات والمطلوب بدقة', ['كتابة الإجابة النهائية مباشرة', 'تخمين النتيجة دون تحليل', 'تجاهل البيانات الناقصة']), answer: 'تحديد المعطيات والمطلوب بدقة', points: pts }) },
    { tier: 'medium', make: () => ({ text: `أيّ مما يلي ليس من خصائص ${c0}؟`, options: placeCorrect('لا يحتاج إلى تدريب سابق', ['له قواعد منهجية ثابتة', 'يرتبط بالمعرفة السابقة', 'يُطبَّق في مواقف متعددة']), answer: 'لا يحتاج إلى تدريب سابق', points: pts }) },
    { tier: 'medium', make: () => ({ text: `ما الأداة الأنسب لتحليل مسألة تتعلق بـ${topic}؟`, options: placeCorrect('التحليل المنهجي خطوة بخطوة', ['التخمين والتجربة العشوائية', 'الاعتماد الكلي على الذاكرة', 'تجنّب القواعد الأساسية']), answer: 'التحليل المنهجي خطوة بخطوة', points: pts }) },
    { tier: 'hard', make: () => ({ text: `ما الفرق الرئيسي بين ${c0} و${c1}؟`, options: placeCorrect('يختلفان في الآلية والتطبيق', ['لا فرق بينهما', 'أحدهما أكثر أهمية دائمًا', 'غير مترابطَين بالموضوع']), answer: 'يختلفان في الآلية والتطبيق', points: pts }) },
    { tier: 'hard', make: () => ({ text: `أيّ العبارات التالية تصف بشكل أدق تطبيق ${topic}؟`, options: placeCorrect('يُستخدم لحل مشكلات حقيقية ومتنوعة', ['مقتصر على النظريات فقط', 'لا يرتبط بمادة أخرى', 'لا يُطبَّق خارج الكتاب']), answer: 'يُستخدم لحل مشكلات حقيقية ومتنوعة', points: pts }) },
    { tier: 'hard', make: () => ({ text: `إذا أردت إثبات إتقانك لـ${topic}، ما الأسلوب الأفضل؟`, options: placeCorrect('حل مسائل جديدة وشرح خطوات التفكير', ['حفظ التعريفات دون فهم', 'نسخ الأمثلة من الكتاب', 'مشاهدة فيديو حول الموضوع فقط']), answer: 'حل مسائل جديدة وشرح خطوات التفكير', points: pts }) },
    { tier: 'easy', make: () => ({ text: `أيّ مما يلي يُعدّ مثالًا صحيحًا على تطبيق ${topic}؟`, options: placeCorrect(t1 ? `استخدام ${t1.ar} في تفسير ظاهرة` : `تطبيقه في حل مسألة عملية`, ['مثال غير مرتبط بالموضوع', 'مثال من موضوع مختلف', 'لا يوجد تطبيق حقيقي']), answer: t1 ? `استخدام ${t1.ar} في تفسير ظاهرة` : `تطبيقه في حل مسألة عملية`, points: pts }) },
  ];
  return pickTiered(templates, diff)();
}

function makeSAQ_ar(topic: string, kb: KBLesson | null, diff: string, subject?: string, allowRepeat: boolean = true): WQ {
  const pts = saPts(diff);
  const math = takeFromBankOrStop('short_answer', topic, kb, diff, 'ar', pts, subject, allowRepeat);
  if (math) return math;
  const t0 = kb?.keyTerms?.filter(t => t.ar?.trim())[0];
  const t1 = kb?.keyTerms?.filter(t => t.ar?.trim())[1];
  const c0 = kb?.keyConceptsAr?.[0]?.trim() || topic;
  const c1 = kb?.keyConceptsAr?.[1]?.trim() || `تطبيق ${topic}`;
  const templates: TieredTemplate[] = [
    { tier: 'easy', make: () => ({ text: `اشرح بأسلوبك الخاص مفهوم ${t0?.ar ?? topic} مع إعطاء مثال تطبيقي.`, answer: defWords(t0?.definitionAr, 10) ? `التعريف: ${defWords(t0?.definitionAr, 10)}... + مثال حياتي.` : `التعريف الدقيق + مثال واضح.`, points: pts }) },
    { tier: 'easy', make: () => ({ text: `صِف الخطوات المنهجية التي تتبعها لحل مسألة تتعلق بـ${topic}. استخدم قائمة مرقّمة.`, answer: 'الخطوات: 1. تحديد المعطيات 2. اختيار الأسلوب 3. التنفيذ 4. التحقق.', points: pts }) },
    { tier: 'medium', make: () => ({ text: `كيف يرتبط ${topic} بما درسناه سابقًا؟ اذكر ارتباطًا واحدًا على الأقل وفسّره.`, answer: 'ارتباط منطقي موثّق مع وحدة أو مادة سابقة.', points: pts }) },
    { tier: 'medium', make: () => ({ text: `ما أهمية دراسة ${topic}؟ اذكر فائدتين على الأقل وأعطِ مثالًا لكل منهما.`, answer: 'فائدتان: 1. بناء مهارة… 2. تطبيق على… مع مثالين.', points: pts }) },
    { tier: 'hard', make: () => ({ text: `قارن بين ${c0} و${c1} من حيث التعريف والتطبيق.`, answer: `${c0} يختلف عن ${c1} في: الآلية / التطبيق / النتيجة.`, points: pts }) },
    { tier: 'medium', make: () => ({ text: `أعطِ مثالًا حياتيًا على تطبيق ${topic} وفسّر كيف يرتبط بالمفهوم العلمي.`, answer: 'مثال واضح + ربط بالمفهوم: المبدأ العلمي الذي يفسّره.', points: pts }) },
    { tier: 'hard', make: () => ({ text: t1 ? `ما العلاقة بين ${t0?.ar ?? c0} و${t1.ar}؟ اشرح بمثال.` : `اشرح كيف يساعدك فهم ${topic} في حل مسائل من الحياة اليومية.`, answer: t1 ? `العلاقة: ${t0?.ar ?? c0} يؤدي إلى / يُسبب / يرتبط بـ${t1.ar}.` : 'وصف تطبيق حياتي ملموس مع تفسير.', points: pts }) },
  ];
  return pickTiered(templates, diff)();
}

function makeFBQ_ar(topic: string, kb: KBLesson | null, diff: string, subject?: string, allowRepeat: boolean = true): WQ {
  const pts = fbPts(diff);
  const math = takeFromBankOrStop('fill_blank', topic, kb, diff, 'ar', pts, subject, allowRepeat);
  if (math) return math;
  const t0 = kb?.keyTerms?.filter(t => t.ar?.trim())[0];
  const t1 = kb?.keyTerms?.filter(t => t.ar?.trim())[1];
  const c0 = kb?.keyConceptsAr?.[0]?.trim() || topic;
  const templates: TieredTemplate[] = [
    { tier: 'easy', make: () => ({ text: `أكمل: ${t0?.ar ?? topic} يُعرَّف بأنه __________.`, answer: defWords(t0?.definitionAr, 6) ?? 'راجع تعريف الكتاب المدرسي', points: pts }) },
    { tier: 'medium', make: () => ({ text: `عند تطبيق ${topic}، فإن __________ يتغير نتيجة __________.`, answer: 'المتغير / السبب (راجع الكتاب المدرسي)', points: pts }) },
    { tier: 'easy', make: () => ({ text: `الخطوات الثلاث الرئيسية لتطبيق ${topic} هي: __________، __________، __________.`, answer: '1. تحديد المعطيات 2. التطبيق 3. التحقق', points: pts }) },
    { tier: 'medium', make: () => ({ text: `${c0} يرتبط بمفهوم أساسي ويؤدي إلى نتيجة محددة — اذكرهما.`, answer: 'يذكر الطالب المفهوم المرتبط والنتيجة المترتبة عليه (راجع الكتاب المدرسي)', points: pts }) },
    { tier: 'hard', make: () => ({ text: t1 ? `الفرق الرئيسي بين ${t0?.ar ?? c0} و${t1.ar} هو أن __________ بينما __________.` : `القاعدة الأساسية في ${topic} تنص على أن __________ يؤدي إلى __________.`, answer: t1 ? `يختلف ${t0?.ar ?? c0} عن ${t1.ar} في التعريف والتطبيق (راجع تعريف كل منهما في الكتاب المدرسي)` : 'القاعدة / النتيجة (راجع الكتاب)', points: pts }) },
    { tier: 'hard', make: () => ({ text: `عندما يزداد __________ في سياق ${topic}، يتغير __________ وفقًا لذلك.`, answer: 'المتغير المستقل / المتغير التابع', points: pts }) },
  ];
  return pickTiered(templates, diff)();
}

function makeTFQ_ar(topic: string, kb: KBLesson | null, diff: string, subject?: string, allowRepeat: boolean = true): WQ {
  const pts = tfPts(diff);
  const math = takeFromBankOrStop('true_false', topic, kb, diff, 'ar', pts, subject, allowRepeat);
  if (math) return math;
  const c0 = kb?.keyConceptsAr?.[0]?.trim() || topic;
  const c1 = kb?.keyConceptsAr?.[1]?.trim() || `تطبيق ${topic}`;
  const templates: TieredTemplate[] = [
    { tier: 'easy', make: () => ({ text: `${c0} يُعدّ من الأسس الجوهرية في ${topic}.`, options: ['صح', 'خطأ'], answer: 'صح', points: pts }) },
    { tier: 'medium', make: () => ({ text: `يمكن إتقان ${topic} دون فهم ${c1}.`, options: ['صح', 'خطأ'], answer: 'خطأ', points: pts }) },
    { tier: 'easy', make: () => ({ text: `${topic} له تطبيقات واسعة في الحياة اليومية خارج الفصل الدراسي.`, options: ['صح', 'خطأ'], answer: 'صح', points: pts }) },
    { tier: 'easy', make: () => ({ text: `المعرفة السابقة غير ضرورية لفهم ${topic}.`, options: ['صح', 'خطأ'], answer: 'خطأ', points: pts }) },
    { tier: 'medium', make: () => ({ text: `${topic} مستقل تمامًا ولا يرتبط بمواضيع الوحدات الأخرى.`, options: ['صح', 'خطأ'], answer: 'خطأ', points: pts }) },
    { tier: 'hard', make: () => ({ text: `تطبيق ${topic} في مسائل جديدة يُعدّ دليلًا على الإتقان الحقيقي.`, options: ['صح', 'خطأ'], answer: 'صح', points: pts }) },
    { tier: 'hard', make: () => ({ text: `جميع مسائل ${topic} لها أسلوب حل واحد فقط.`, options: ['صح', 'خطأ'], answer: 'خطأ', points: pts }) },
  ];
  return pickTiered(templates, diff)();
}

/** Real-life word problem aligned with "حل مسائل حياتية" curriculum phrasing. */
function makeWPQ_ar(topic: string, kb: KBLesson | null, diff: string, subject?: string, allowRepeat: boolean = true): WQ {
  const pts = saPts(diff);
  const math = takeFromBankOrStop('word_problem', topic, kb, diff, 'ar', pts, subject, allowRepeat);
  if (math) return math;
  const c0 = kb?.keyConceptsAr?.[0]?.trim() || topic;
  const obj = kb?.objectives?.find(o => /حياتي|مسألة|نمذج/.test(o));
  const templates: TieredTemplate[] = [
    { tier: 'easy', make: () => ({
      text: `مسألة حياتية: يحتاج محلّ تجاري إلى تطبيق «${topic}» لحساب تكلفة عرض ترويجي. اكتب المعطيات اللازمة، ثم حل المسألة مبيّنًا خطواتك.`,
      answer: `نمذجة الموقف بمفاهيم ${topic}، ثم الحل خطوة بخطوة والتحقق من المعقولية.`,
      points: pts,
    }) },
    { tier: 'medium', make: () => ({
      text: `مسألة حياتية: تريد عائلة تخطيط ميزانية أسبوعية باستخدام ${c0}. صِغ مسألة من واقع الحياة تتطلب ${topic}، ثم حلّها.`,
      answer: `صياغة موقف حقيقي + تطبيق ${topic} + إجابة عددية مع وحدات إن لزم.`,
      points: pts,
    }) },
    { tier: 'hard', make: () => ({
      text: obj
        ? `مسألة حياتية مرتبطة بنتاج الدرس («${obj}»): صف موقفًا يوميًا، ثم حلّه باستعمال ${topic}.`
        : `مسألة حياتية: مهندس يحتاج ${topic} لتقدير كمية مواد لمشروع صغير. اكتب المعطيات وحل المسألة.`,
      answer: `تحديد المعطيات والمطلوب، اختيار الأسلوب المناسب لـ${topic}، الحل والتحقق.`,
      points: pts,
    }) },
  ];
  return pickTiered(templates, diff)();
}

function makePriorReviewQ_ar(concept: string): WQ {
  return {
    text: `مراجعة: اشرح مفهوم «${concept}» بإيجاز، واذكر مثالًا واحدًا يوضح فهمك.`,
    answer: `تعريف موجز لـ«${concept}» + مثال صحيح.`,
    points: 3,
  };
}

// ─── English question factories ───────────────────────────────────────────────

function makeMCQ_en(topic: string, kb: KBLesson | null, diff: string, subject?: string, allowRepeat: boolean = true): WQ {
  const pts = mcPts(diff);
  const math = takeFromBankOrStop('multiple_choice', topic, kb, diff, 'en', pts, subject, allowRepeat);
  if (math) return math;
  const t0 = kb?.keyTerms?.filter(t => t.en?.trim())[0];
  const t1 = kb?.keyTerms?.filter(t => t.en?.trim())[1];
  const c0 = kb?.keyConceptsEn?.[0]?.trim() || topic;
  const c1 = kb?.keyConceptsEn?.[1]?.trim() || `application of ${topic}`;
  const correct0 = defChars(t0?.definitionEn, 60) ?? `The correct description of ${topic}`;
  const templates: TieredTemplate[] = [
    { tier: 'easy', make: () => ({ text: `Which of the following correctly defines ${t0?.en ?? topic}?`, options: placeCorrect(correct0, [`An unrelated concept`, 'A description of a different phenomenon', 'None of the above']), answer: correct0, points: pts }) },
    { tier: 'medium', make: () => ({ text: `When applying ${topic} to a real-world problem, what is the first step?`, options: placeCorrect('Identify what is given and what is asked', ['Write the final answer immediately', 'Guess the answer without analysis', 'Ignore any missing data']), answer: 'Identify what is given and what is asked', points: pts }) },
    { tier: 'medium', make: () => ({ text: `Which of the following is NOT a characteristic of ${c0}?`, options: placeCorrect('It requires no prior practice', ['It has consistent rules', 'It builds on prior knowledge', 'It applies across multiple contexts']), answer: 'It requires no prior practice', points: pts }) },
    { tier: 'medium', make: () => ({ text: `What is the most effective approach when analysing a problem involving ${topic}?`, options: placeCorrect('Systematic step-by-step analysis', ['Random guessing', 'Relying solely on memory', 'Avoiding fundamental rules']), answer: 'Systematic step-by-step analysis', points: pts }) },
    { tier: 'hard', make: () => ({ text: `What is the main difference between ${c0} and ${c1}?`, options: placeCorrect('They differ in mechanism and application', ['There is no difference', 'One is always more important', 'They are unrelated to this topic']), answer: 'They differ in mechanism and application', points: pts }) },
    { tier: 'hard', make: () => ({ text: `Which statement best captures the application of ${topic}?`, options: placeCorrect('Used to solve real, diverse problems', ['Limited to theory only', 'Unrelated to other subjects', 'Cannot be applied outside the textbook']), answer: 'Used to solve real, diverse problems', points: pts }) },
    { tier: 'hard', make: () => ({ text: `What is the best way to demonstrate mastery of ${topic}?`, options: placeCorrect('Solve new problems and explain your reasoning', ['Memorise definitions without understanding', 'Copy examples from the textbook', 'Watch a video about the topic only']), answer: 'Solve new problems and explain your reasoning', points: pts }) },
    { tier: 'easy', make: () => ({ text: `Which of the following is a valid real-world example of ${topic}?`, options: placeCorrect(t1 ? `Using ${t1.en} to explain a phenomenon` : `Applying it to solve a practical problem`, ['An unrelated example', 'An example from a different topic', 'There are no real applications']), answer: t1 ? `Using ${t1.en} to explain a phenomenon` : `Applying it to solve a practical problem`, points: pts }) },
  ];
  return pickTiered(templates, diff)();
}

function makeSAQ_en(topic: string, kb: KBLesson | null, diff: string, subject?: string, allowRepeat: boolean = true): WQ {
  const pts = saPts(diff);
  const math = takeFromBankOrStop('short_answer', topic, kb, diff, 'en', pts, subject, allowRepeat);
  if (math) return math;
  const t0 = kb?.keyTerms?.filter(t => t.en?.trim())[0];
  const t1 = kb?.keyTerms?.filter(t => t.en?.trim())[1];
  const c0 = kb?.keyConceptsEn?.[0]?.trim() || topic;
  const c1 = kb?.keyConceptsEn?.[1]?.trim() || `application of ${topic}`;
  const templates: TieredTemplate[] = [
    { tier: 'easy', make: () => ({ text: `Explain in your own words what ${t0?.en ?? topic} means and give one real-world example.`, answer: defChars(t0?.definitionEn, 60) ? `Definition: ${defChars(t0?.definitionEn, 60)}... + real example.` : 'Accurate definition + concrete example.', points: pts }) },
    { tier: 'easy', make: () => ({ text: `Describe the systematic steps you would follow to solve a problem involving ${topic}. Use a numbered list.`, answer: 'Steps: 1. Identify given/asked 2. Choose method 3. Execute 4. Verify.', points: pts }) },
    { tier: 'medium', make: () => ({ text: `How is ${topic} connected to what we have studied previously? Give at least one documented connection.`, answer: 'Logical, documented connection to a prior unit or subject.', points: pts }) },
    { tier: 'medium', make: () => ({ text: `State two benefits of studying ${topic} and give a real-world example for each.`, answer: 'Benefit 1: … example. Benefit 2: … example.', points: pts }) },
    { tier: 'hard', make: () => ({ text: `Compare ${c0} and ${c1} in terms of definition and application.`, answer: `${c0} differs from ${c1} in: mechanism / application / outcome.`, points: pts }) },
    { tier: 'medium', make: () => ({ text: `Give a real-world example of ${topic} and explain how it relates to the scientific concept.`, answer: 'Clear example + explanation of the scientific principle it illustrates.', points: pts }) },
    { tier: 'hard', make: () => ({ text: t1 ? `Explain the relationship between ${t0?.en ?? c0} and ${t1.en}. Illustrate with an example.` : `Explain how understanding ${topic} helps solve everyday problems.`, answer: t1 ? `${t0?.en ?? c0} leads to / causes / relates to ${t1.en}.` : 'Concrete real-world application with explanation.', points: pts }) },
  ];
  return pickTiered(templates, diff)();
}

function makeFBQ_en(topic: string, kb: KBLesson | null, diff: string, subject?: string, allowRepeat: boolean = true): WQ {
  const pts = fbPts(diff);
  const math = takeFromBankOrStop('fill_blank', topic, kb, diff, 'en', pts, subject, allowRepeat);
  if (math) return math;
  const t0 = kb?.keyTerms?.filter(t => t.en?.trim())[0];
  const t1 = kb?.keyTerms?.filter(t => t.en?.trim())[1];
  const c0 = kb?.keyConceptsEn?.[0]?.trim() || topic;
  const templates: TieredTemplate[] = [
    { tier: 'easy', make: () => ({ text: `${t0?.en ?? topic} is __________ characterised by __________.`, answer: `${t0?.en ?? topic} / ${defWords(t0?.definitionEn, 4) ?? 'see textbook'}`, points: pts }) },
    { tier: 'medium', make: () => ({ text: `When applying ${topic}, __________ changes as a result of __________.`, answer: 'The dependent variable / the cause (see textbook)', points: pts }) },
    { tier: 'easy', make: () => ({ text: `The three main steps for applying ${topic} are: __________, __________, and __________.`, answer: '1. Identify given 2. Apply method 3. Verify', points: pts }) },
    { tier: 'medium', make: () => ({ text: `${c0} is related to __________ and leads to __________.`, answer: `${c0} / related phenomenon or outcome`, points: pts }) },
    { tier: 'hard', make: () => ({ text: t1 ? `The main difference between ${t0?.en ?? c0} and ${t1.en} is that __________ while __________.` : `The fundamental rule of ${topic} states that __________ results in __________.`, answer: t1 ? `${t0?.en ?? c0}: … / ${t1.en}: …` : 'The rule / the outcome (see textbook)', points: pts }) },
    { tier: 'hard', make: () => ({ text: `When __________ increases in the context of ${topic}, __________ changes proportionally.`, answer: 'The independent variable / the dependent variable', points: pts }) },
  ];
  return pickTiered(templates, diff)();
}

function makeTFQ_en(topic: string, kb: KBLesson | null, diff: string, subject?: string, allowRepeat: boolean = true): WQ {
  const pts = tfPts(diff);
  const math = takeFromBankOrStop('true_false', topic, kb, diff, 'en', pts, subject, allowRepeat);
  if (math) return math;
  const c0 = kb?.keyConceptsEn?.[0]?.trim() || topic;
  const c1 = kb?.keyConceptsEn?.[1]?.trim() || `application of ${topic}`;
  const templates: TieredTemplate[] = [
    { tier: 'easy', make: () => ({ text: `${c0} is one of the core foundations of ${topic}.`, options: ['True', 'False'], answer: 'True', points: pts }) },
    { tier: 'medium', make: () => ({ text: `${topic} can be mastered without understanding ${c1}.`, options: ['True', 'False'], answer: 'False', points: pts }) },
    { tier: 'easy', make: () => ({ text: `${topic} has broad applications in daily life beyond the classroom.`, options: ['True', 'False'], answer: 'True', points: pts }) },
    { tier: 'easy', make: () => ({ text: `Prior knowledge is unnecessary for understanding ${topic}.`, options: ['True', 'False'], answer: 'False', points: pts }) },
    { tier: 'medium', make: () => ({ text: `${topic} is completely independent and unrelated to other topics in this unit.`, options: ['True', 'False'], answer: 'False', points: pts }) },
    { tier: 'hard', make: () => ({ text: `Successfully applying ${topic} to unfamiliar problems demonstrates genuine mastery.`, options: ['True', 'False'], answer: 'True', points: pts }) },
    { tier: 'hard', make: () => ({ text: `All problems involving ${topic} can be solved using only one fixed method.`, options: ['True', 'False'], answer: 'False', points: pts }) },
  ];
  return pickTiered(templates, diff)();
}

/** Real-life word problem aligned with curriculum "solve real-life problems" outcomes. */
function makeWPQ_en(topic: string, kb: KBLesson | null, diff: string, subject?: string, allowRepeat: boolean = true): WQ {
  const pts = saPts(diff);
  const math = takeFromBankOrStop('word_problem', topic, kb, diff, 'en', pts, subject, allowRepeat);
  if (math) return math;
  const c0 = kb?.keyConceptsEn?.[0]?.trim() || topic;
  const templates: TieredTemplate[] = [
    { tier: 'easy', make: () => ({
      text: `Real-life problem: A shop needs to apply “${topic}” to price a promotion. List the given information, then solve step by step.`,
      answer: `Model the situation with ${topic}, solve step by step, and check reasonableness.`,
      points: pts,
    }) },
    { tier: 'medium', make: () => ({
      text: `Real-life problem: A family is planning a weekly budget using ${c0}. Write a everyday scenario that requires ${topic}, then solve it.`,
      answer: `Clear real-world setup + application of ${topic} + numerical answer with units if needed.`,
      points: pts,
    }) },
    { tier: 'hard', make: () => ({
      text: `Real-life problem: An engineer needs ${topic} to estimate materials for a small project. State the givens and solve.`,
      answer: `Identify givens and goal, choose a ${topic} method, solve and verify.`,
      points: pts,
    }) },
  ];
  return pickTiered(templates, diff)();
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
// Each takes the tier the teacher asked for. These used to pass the literal
// 'medium' at all six call sites, so the quiz difficulty picker changed
// nothing at all: on the math path `tryMathPractice` forwards the tier to
// `takeConcreteMath`, which filters the bank by `item.diff`, so an "easy" quiz
// and a "difficult" quiz drew from the identical medium slice.

// Every quiz factory below passes `allowRepeat: false`, for the reason the
// worksheet generator does: a quiz is one paper read top to bottom, so an item
// served twice is the same question printed twice, not a fresh draw. Once a
// lesson's concrete-bank family is spent, `takeFromBank` returns null and the
// factory falls through to its own topic-templated question instead. Left at
// the default `true`, 84% of chemistry quizzes and 10% of maths quizzes carried
// a repeated stem (measured across every maths/chemistry lesson, 3 runs each) —
// 100% for the small families (trig_apps, functions, vectors), worst case three
// distinct questions out of six. The same measurement gave worksheets 0 in 1,530.
function makeQuizMCQ_ar(topic: string, kb: KBLesson | null, pts: number, id: string, subject?: string, diff: DiffTier = 'medium'): QuizQuestion {
  const q = makeMCQ_ar(topic, kb, diff, subject, false);
  return { id, type: 'multiple_choice', text: q.text, options: q.options, correctAnswer: q.answer, points: pts, explanation: `${q.answer} — راجع ${kb?.titleAr ?? topic} في الكتاب المدرسي.`, ...bankMark(q) };
}
function makeQuizMCQ_en(topic: string, kb: KBLesson | null, pts: number, id: string, subject?: string, diff: DiffTier = 'medium'): QuizQuestion {
  const q = makeMCQ_en(topic, kb, diff, subject, false);
  return { id, type: 'multiple_choice', text: q.text, options: q.options, correctAnswer: q.answer, points: pts, explanation: `${q.answer} — See ${kb?.titleEn ?? topic} in the textbook.`, ...bankMark(q) };
}

function makeQuizTF_ar(topic: string, kb: KBLesson | null, pts: number, id: string, subject?: string, diff: DiffTier = 'medium'): QuizQuestion {
  const q = makeTFQ_ar(topic, kb, diff, subject, false);
  return { id, type: 'true_false', text: q.text, options: ['صح', 'خطأ'], correctAnswer: q.answer, points: pts, explanation: `الإجابة "${q.answer}" — ${q.text}`, ...bankMark(q) };
}
function makeQuizTF_en(topic: string, kb: KBLesson | null, pts: number, id: string, subject?: string, diff: DiffTier = 'medium'): QuizQuestion {
  const q = makeTFQ_en(topic, kb, diff, subject, false);
  return { id, type: 'true_false', text: q.text, options: ['True', 'False'], correctAnswer: q.answer, points: pts, explanation: `The answer is "${q.answer}" — ${q.text}`, ...bankMark(q) };
}

function makeQuizSA_ar(topic: string, kb: KBLesson | null, pts: number, id: string, subject?: string, diff: DiffTier = 'medium'): QuizQuestion {
  const q = makeSAQ_ar(topic, kb, diff, subject, false);
  return { id, type: 'short_answer', text: q.text, correctAnswer: q.answer, points: pts, explanation: `إجابة كاملة: ${q.answer}`, ...bankMark(q) };
}
function makeQuizSA_en(topic: string, kb: KBLesson | null, pts: number, id: string, subject?: string, diff: DiffTier = 'medium'): QuizQuestion {
  const q = makeSAQ_en(topic, kb, diff, subject, false);
  return { id, type: 'short_answer', text: q.text, correctAnswer: q.answer, points: pts, explanation: `Full answer: ${q.answer}`, ...bankMark(q) };
}

// ─── No question bank ─────────────────────────────────────────────────────────

/**
 * The offline generator has real, lesson-specific questions for two subjects:
 * mathematics and chemistry. Everything else used to fall through to topic-
 * templated sentences — «أيّ مما يلي يُعرِّف X؟» with «الوصف الصحيح لـX» as the
 * key — that read like a worksheet and test nothing. Showing that to a teacher
 * as a finished paper is worse than saying there is no bank yet, so the
 * question-based generators refuse instead. `code` is what `aiErrorMessageKey`
 * maps to the on-screen sentence.
 */
export class NoQuestionBankError extends Error {
  readonly code = 'no_question_bank';
  constructor(topic: string) {
    super(`No offline question bank for "${topic}"`);
    this.name = 'NoQuestionBankError';
  }
}

/** Tests that exercise the template machinery directly turn this off; nothing else should. */
export const questionBankPolicy = { required: true };

/** A banked item as an escape/relay challenge — its answer was computed or reviewed. */
const bankChallenge = (isAr: boolean) => (item: { text: string; answer: string; steps?: string[] }): Challenge => ({
  prompt: item.text,
  answer: item.answer,
  hint: item.steps?.[0] ?? (isAr ? 'ابدأ بما هو معطى ثم طبّق الخطوة الأولى' : 'Start from what is given, then apply the first step'),
  tip: item.steps?.length ? item.steps.join('\n') : undefined,
  banked: true,
});

/** A lesson task as a challenge — the teacher checks the answer against the textbook. */
const taskChallenge = (t: LessonTask): Challenge => ({
  prompt: t.prompt, answer: t.check, hint: t.hint, banked: false,
});

function requireQuestionBank(topic: string, kb: KBLesson | null, subject?: string): void {
  if (!questionBankPolicy.required || isChemContext(topic, kb, subject)) return;
  // A maths lesson is covered only when the bank has items ABOUT it — Grade 7–9
  // lessons and lessons the generators cannot ask (geometry, data, money…) are
  // refused like any other subject, not served the grade's default arithmetic.
  if (isMathContext(topic, kb, subject) && hasMathBank(topic, kb)) return;
  throw new NoQuestionBankError(topic);
}

/**
 * Which version of an activity a request gets.
 *
 * A first generation is version 0 — the activity as it always was. Each
 * Regenerate for the same lesson and format moves one on, so the teacher is
 * never handed back what is already on screen; a plain request starts over.
 * Kept in memory, per session: the offline path has no server to remember it,
 * and a reload merely restarts the count (the next Regenerate is version 1).
 */
const activityVariants = new Map<string, number>();
const MAX_TRACKED_ACTIVITIES = 200;

export function nextActivityVariant(req: AIRequest): number {
  const kind = req.activityVariant === 'warmup' ? 'warmup' : (req.activityType ?? 'group');
  const key = [req.language, kind, req.lessonId ?? '', req.topic].join('|');
  const next = req.regenerate === true ? (activityVariants.get(key) ?? 0) + 1 : 0;
  activityVariants.delete(key); // re-insert last, so the oldest entry is the stalest
  activityVariants.set(key, next);
  if (activityVariants.size > MAX_TRACKED_ACTIVITIES) {
    activityVariants.delete(activityVariants.keys().next().value as string);
  }
  return next;
}

/**
 * The offline activity for a request, at version `variant` (0 = the first).
 * `MockAIService.generateActivity` adds the simulated latency and picks the
 * version; this is the part with no delay, so it can be exercised directly.
 */
export function buildOfflineActivity(req: AIRequest, variant = 0): ActivityOutput {
  // The lesson flow generates a warm-up and then the main activity. Both
  // used to reset the session, so both drew the SAME three problems and the
  // teacher posed each of them twice in one lesson. `continueMathPractice`
  // lets the second call carry on from where the first stopped.
  if (!req.continueMathPractice) beginMathPracticeSession();

  const lang: Lang = req.language === 'arabic' ? 'ar' : 'en';
  const kb = groundedKb(req.topic, lang, req.lessonId);
  const topic = req.topic;
  const isWarmup = req.activityVariant === 'warmup';
  const actType = isWarmup ? 'warmup' : (req.activityType ?? 'group');
  const duration = req.duration ?? (isWarmup ? 8 : 30);
  const math = isMathContext(topic, kb, req.subject);
  // A warm-up poses one item; the main activity needs three (worked
  // example, faded item, unaided item / game rounds) and the jigsaw four,
  // one per member of a home group.
  const wantItems = isWarmup ? 1 : actType === 'group' ? 4 : 3;
  const practice = math
    ? takeConcreteMathBatch(wantItems, topic, kb, lang, 'medium')
    : isChemContext(topic, kb, req.subject)
      ? takeConcreteChemBatch(wantItems, topic, kb, lang, 'medium')
      : [];

  const blueprint = buildActivityBlueprint(actType, {
    topic, lang, math, practice, kb, duration, variant,
    // The lesson's own subject id, else the caller's name — see `handsOnKind`.
    subject: (kb ? getBookForLesson(kb)?.subjectId : undefined) ?? req.subject,
  });

  return plainActivity({
    title: `${topic} – ${blueprint.titleSuffix}`,
    // Report the type the caller asked for, verbatim. `activityTypeLabel`
    // already falls back to the raw value for anything the form never
    // offered, so an unrecognised type stays honest instead of being
    // relabelled as the `group` fallback the blueprint used.
    activityType: actType,
    // Taken from the steps, not from `duration`: the two disagreed before
    // (a "10 minute" warm-up whose steps summed to 20), and a request for
    // fewer minutes than the format has steps cannot be honoured exactly.
    totalDuration: blueprint.steps.reduce((sum, s) => sum + s.durationMin, 0),
    objective: req.objectives?.trim() || blueprint.objective,
    groupSize: blueprint.groupSize,
    materials: blueprint.materials,
    steps: blueprint.steps,
    teacherTips: blueprint.teacherTips,
    differentiation: blueprint.differentiation,
    assessment: blueprint.assessment,
  });
}

/**
 * What this service last handed out for a request, so a Regenerate can be
 * told apart from "the same thing again". Keyed by the request's identity —
 * everything except the regeneration fields.
 */
const lastServed = new Map<string, string>();
const MAX_TRACKED_REQUESTS = 200;
/** A draw that cannot vary (a tiny bank, fixed templates) gives up after this. */
const MAX_FRESH_ATTEMPTS = 20;

/** A short fingerprint (length + FNV-1a), so the table holds hashes, not whole outputs. */
function fingerprint(out: unknown): string {
  const text = JSON.stringify(out);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${text.length}:${h.toString(16)}`;
}

function requestIdentity(kind: string, req: object): string {
  const { regenerate: _r, avoid: _a, excludeVariantIds: _e, ...rest } = req as Record<string, unknown>;
  return `${kind}|${JSON.stringify(rest)}`;
}

/**
 * Run `produce`, and on a Regenerate keep drawing until the result differs from
 * what this request was last served.
 *
 * The offline generators vary by drawing at random — items from a bank, or one
 * of a few phrasings — and nothing stopped a draw from landing on exactly what
 * the teacher was already looking at: over twelve regenerations the lesson plan
 * repeated its predecessor up to 4 times in 11 and worksheet and homework up
 * to 5 in 11 (a small bank, like one law-of-sines lesson, makes the odds high),
 * so «إعادة التوليد» often did nothing visible.
 *
 * Bounded: a generator with nothing to vary (fixed templates, a bank with one
 * possible draw) returns after `MAX_FRESH_ATTEMPTS` rather than looping. A
 * plain request is never compared — it is free to repeat.
 */
async function freshOnRegenerate<T>(kind: string, req: object, produce: () => Promise<T>): Promise<T> {
  const key = requestIdentity(kind, req);
  const previous = lastServed.get(key);
  let out = await produce();
  let signature = fingerprint(out);
  if ((req as { regenerate?: boolean }).regenerate === true && previous !== undefined) {
    for (let attempt = 1; attempt < MAX_FRESH_ATTEMPTS && signature === previous; attempt++) {
      out = await produce();
      signature = fingerprint(out);
    }
  }
  lastServed.delete(key); // re-insert last, so the oldest entry is the stalest
  lastServed.set(key, signature);
  if (lastServed.size > MAX_TRACKED_REQUESTS) {
    lastServed.delete(lastServed.keys().next().value as string);
  }
  return out;
}

// ─── Main service class ───────────────────────────────────────────────────────

export class MockAIService extends AIService {
  private async delay() {
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
  }

  async generateLessonPlan(req: AIRequest): Promise<LessonPlanOutput> {
    await this.delay();
    return freshOnRegenerate('lessonPlan', req, () => this.lessonPlanOnce(req));
  }

  private async lessonPlanOnce(req: AIRequest): Promise<LessonPlanOutput> {
    const lang: Lang = req.language === 'arabic' ? 'ar' : 'en';
    const docs = docsFromReq(req);
    const rawTopic = req.topic;
    const topic = (docs.present && docs.title ? docs.title : rawTopic.trim()) || rawTopic;
    const kb = docs.present ? null : groundedKb(topic, lang, req.lessonId);
    const dur = req.duration ?? 45;
    const style = req.teachingStyle ?? 'direct';
    const fileLabel = docs.fileNames[0]
      ? (lang === 'ar' ? `الملف «${docs.fileNames[0]}»` : `file “${docs.fileNames[0]}”`)
      : (lang === 'ar' ? 'المواد المرفوعة' : 'the uploaded materials');
    const conceptLine = docs.concepts.slice(0, 3).join(lang === 'ar' ? ' · ' : ' · ');
    const exampleLine = docs.examples[0] || docs.plainSnippets[0] || '';
    const docObjectives = lpObjectivesFromDocs(topic, docs, lang);

    const priorConcepts = req.includePriorReview && req.priorKnowledge?.length ? req.priorKnowledge : [];
    const priorReview = lpPriorReview(priorConcepts, req.priorTopicsNotes ?? '', lang);

    // The teaching style shapes the whole lesson, not just `mainActivity`, and
    // it does so on BOTH paths. The document-grounded branch below used to
    // hardcode direct instruction, so attaching a file silently made the style
    // picker inert — «تعلّم تعاوني» and «شرح مباشر» returned the same plan.
    const docCtx: LessonDocContext | null = docs.present
      ? { label: fileLabel, concepts: docs.concepts, example: exampleLine || null }
      : null;
    // What the lesson is MADE of — a recitation, an observation, a source, a
    // drill — as opposed to how it is taught. The lesson's own book decides;
    // the caller's subject name is only the fallback for a typed topic.
    const subjectId = (kb ? getBookForLesson(kb)?.subjectId : subjectIdFromName(req.subject)) ?? undefined;
    const kind = lessonKindFor(subjectId);
    const styleBlueprint = buildLessonStyleBlueprint(style, {
      topic, kb, lang, subject: req.subject, duration: dur, doc: docCtx, kind, subjectId,
    });

    // Document-grounded lesson plan (Demo Mode) — prefer uploaded materials over KB soft pin
    if (docs.present) {
      if (lang === 'ar') {
        return {
          title: `${topic} – خطة درس`,
          grade: req.grade, subject: req.subject, duration: dur,
          objectives: docObjectives ?? lpObjectivesAr(topic, null, req.objectives, kind),
          materials: [
            fileLabel.replace(/^الملف /, 'الملف المرفوع: ').replace(/^الملف$/, 'المواد المرفوعة'),
            ...styleBlueprint.materials.slice(0, 3),
          ],
          ...(priorReview ? { priorReview } : {}),
          introduction:
            `اعتمادًا على ${fileLabel}: ابدأ بعرض فكرة من الملف واسأل: «ماذا نعرف عن ${topic}؟»`
            + (conceptLine ? ` سجّل المفاهيم الظاهرة: ${conceptLine}.` : '')
            + (docs.summary ? ` ملخص الملف: ${docs.summary}` : ''),
          mainActivity: styleBlueprint.mainActivity
            + (exampleLine ? `\n\nمثال جاهز من الملف:\n• ${exampleLine}` : ''),
          guidedPractice: styleBlueprint.guidedPractice,
          independentPractice: styleBlueprint.independentPractice,
          closure: lpClosureAr(topic, dur),
          assessment: `مرتبط ${arPrefixed('ب', fileLabel)}`
            + (conceptLine ? ` (${docs.concepts.slice(0, 2).join(' / ')})` : '')
            + `.\n${styleBlueprint.assessment}`,
          differentiation: styleBlueprint.differentiation,
          homework: `واجب قصير من نفس محور ${fileLabel}: تمرينان + جملة تلخيص عن «${topic}».`,
        };
      }
      return {
        title: `${topic} – Lesson Plan`,
        grade: req.grade, subject: req.subject, duration: dur,
        objectives: docObjectives ?? lpObjectivesEn(topic, null, req.objectives, kind),
        materials: [
          `Uploaded: ${docs.fileNames[0] ?? 'teacher materials'}`,
          ...styleBlueprint.materials.slice(0, 3),
        ],
        ...(priorReview ? { priorReview } : {}),
        introduction:
          `Using ${fileLabel}: open with one idea from the file and ask “What do we already know about ${topic}?”`
          + (conceptLine ? ` Capture visible concepts: ${conceptLine}.` : '')
          + (docs.summary ? ` File summary: ${docs.summary}` : ''),
        mainActivity: styleBlueprint.mainActivity
          + (exampleLine ? `\n\nFile-ready example:\n• ${exampleLine}` : ''),
        guidedPractice: styleBlueprint.guidedPractice,
        independentPractice: styleBlueprint.independentPractice,
        closure: lpClosureEn(topic, dur),
        assessment: `Tied to ${fileLabel}`
          + (conceptLine ? ` (${docs.concepts.slice(0, 2).join(' / ')})` : '')
          + `.\n${styleBlueprint.assessment}`,
        differentiation: styleBlueprint.differentiation,
        homework: `Short homework from the same ${fileLabel} thread: two practice items + one summary sentence on “${topic}”.`,
      };
    }

    if (lang === 'ar') {
      return {
        title: `${topic} – خطة درس`,
        grade: req.grade, subject: req.subject, duration: dur,
        objectives: lpObjectivesAr(topic, kb, req.objectives, kind),
        materials: styleBlueprint.materials,
        ...(priorReview ? { priorReview } : {}),
        introduction: lpIntroAr(topic, kb, kind),
        mainActivity: styleBlueprint.mainActivity,
        guidedPractice: styleBlueprint.guidedPractice,
        independentPractice: styleBlueprint.independentPractice,
        closure: lpClosureAr(topic, dur),
        assessment: styleBlueprint.assessment,
        differentiation: styleBlueprint.differentiation,
        homework: lpHomework(topic, 'ar', kind),
      };
    }
    return {
      title: `${topic} – Lesson Plan`,
      grade: req.grade, subject: req.subject, duration: dur,
      objectives: lpObjectivesEn(topic, kb, req.objectives, kind),
      materials: styleBlueprint.materials,
      ...(priorReview ? { priorReview } : {}),
      introduction: lpIntroEn(topic, kb, kind),
      mainActivity: styleBlueprint.mainActivity,
      guidedPractice: styleBlueprint.guidedPractice,
      independentPractice: styleBlueprint.independentPractice,
      closure: lpClosureEn(topic, dur),
      assessment: styleBlueprint.assessment,
      differentiation: styleBlueprint.differentiation,
      homework: lpHomework(topic, 'en', kind),
    };
  }

  async generateWorksheet(req: AIRequest): Promise<WorksheetOutput> {
    await this.delay();
    return freshOnRegenerate('worksheet', req, () => this.worksheetOnce(req));
  }

  private async worksheetOnce(req: AIRequest): Promise<WorksheetOutput> {
    beginMathPracticeSession();
    const lang: Lang = req.language === 'arabic' ? 'ar' : 'en';
    const docs = docsFromReq(req);
    const topic = (docs.present && docs.title) ? docs.title : req.topic;
    // Prefer uploaded materials over a weakly matching KB lesson
    const kb = docs.present ? null : groundedKb(topic, lang, req.lessonId);
    // A paper built from the teacher's own file is grounded in that file.
    if (!docs.present) requireQuestionBank(topic, kb, req.subject);
    const selectedTypes: QType[] = (req.questionTypes as QType[])?.length
      ? (req.questionTypes as QType[])
      : ['multiple_choice', 'short_answer'];
    const wantsWordProblem = selectedTypes.includes('word_problem');
    const mainTypes = selectedTypes.filter(t => t !== 'word_problem');
    if (mainTypes.length === 0) mainTypes.push('short_answer');

    // In-class practice: progressive difficulty (easy → medium → hard)
    //
    // The count is the picker's own range (5–20, `NUM_Q_OPTIONS` in
    // `app/ai-tools/worksheet.tsx`), not a private one. This used to be 6–12, so
    // asking for 5 gave 6 and asking for 15 or 20 gave 12 while the live prompt
    // honoured the number — the same teacher got a different paper by whether
    // live AI was on. 5 is also the smallest the bucket split below can fill
    // exactly (one easy, one hard, the rest middle, plus the word problem).
    // A lesson whose bank holds fewer items than this still returns fewer: that
    // limit is `BankSpentError`, not this line.
    const totalQ = Math.min(20, Math.max(5, req.numQuestions ?? 8));
    const priorConcepts = req.includePriorReview && req.priorKnowledge?.length
      ? req.priorKnowledge
      : [];
    const priorCount = priorConcepts.length > 0
      ? Math.min(3, Math.max(2, Math.min(priorConcepts.length, 3)))
      : 0;
    // `req.difficulty` SHIFTS the band; it does not flatten it.
    //
    // The easy → medium → hard progression is deliberate (worked example →
    // fading → independent), so honouring "hard" by making all three sections
    // hard would throw away the scaffolding. It shifts instead — and before
    // this, `req.difficulty` was not read at all, so the picker on
    // `app/ai-tools/worksheet.tsx` moved nothing.
    const BANDS: Record<'easy' | 'medium' | 'hard', [DiffTier, DiffTier, DiffTier]> = {
      easy: ['easy', 'easy', 'medium'],
      medium: ['easy', 'medium', 'hard'],
      hard: ['medium', 'hard', 'hard'],
    };
    const requested = req.difficulty === 'easy' || req.difficulty === 'hard' ? req.difficulty : 'medium';
    const band = BANDS[requested];

    // The worked example, and the half-solved item that follows it.
    //
    // Taken before any practice question so the pass's session set spends them:
    // what the class studies cannot come back as a question two sections later.
    // Only where a person wrote and checked the working (`steps.ts`) — a lesson
    // without any, or a teacher's own document, gets the paper it always did.
    // They count INSIDE `totalQ`, the number the teacher picked, so the page
    // does not outgrow the period. Homework is a separate generator.
    const takeSolved = (tier: DiffTier): SolvedItem | null => {
      if (docs.present) return null;
      if (isChemContext(topic, kb, req.subject)) return takeSolvedChem(topic, kb, tier, lang);
      if (isMathContext(topic, kb, req.subject)) return takeSolvedMath(topic, kb, tier, lang);
      return null;
    };
    const exampleItem = takeSolved(band[0]);
    const completionItem = exampleItem ? takeSolved(band[1]) : null;
    const reserved = (exampleItem ? 1 : 0) + (completionItem ? 1 : 0);
    const mainTotal = Math.max(0, totalQ - reserved - (wantsWordProblem ? 1 : 0));

    const answerSpace = lang === 'ar'
      ? '\n\nالإجابة:\n_________________________________\n_________________________________'
      : '\n\nAnswer:\n_________________________________\n_________________________________';

    const sections: WorksheetSection[] = [];
    const answerKey: WorksheetAnswerKeyItem[] = [];
    let qNum = 1;

    const usedStems = new Set<string>();
    if (exampleItem) usedStems.add(questionStemKey(exampleItem.problem));
    if (completionItem) usedStems.add(questionStemKey(completionItem.problem));

    // `allowRepeat: false` — a worksheet is one printed page, not a fresh
    // draw each time like a quiz retake. Once a lesson's concrete-math bank
    // runs out of unused items at a family, the math factories fall through
    // to their own topic-templated question instead of repeating a bank item
    // verbatim under a different question type. See `takeFromBank`.
    const makeGenericQ = (type: QType, diff: DiffTier): WQ => {
      if (lang === 'ar') {
        if (type === 'multiple_choice') return makeMCQ_ar(topic, kb, diff, req.subject, false);
        if (type === 'short_answer') return makeSAQ_ar(topic, kb, diff, req.subject, false);
        if (type === 'fill_blank') return makeFBQ_ar(topic, kb, diff, req.subject, false);
        if (type === 'word_problem') return makeWPQ_ar(topic, kb, diff, req.subject, false);
        return makeTFQ_ar(topic, kb, diff, req.subject, false);
      }
      if (type === 'multiple_choice') return makeMCQ_en(topic, kb, diff, req.subject, false);
      if (type === 'short_answer') return makeSAQ_en(topic, kb, diff, req.subject, false);
      if (type === 'fill_blank') return makeFBQ_en(topic, kb, diff, req.subject, false);
      if (type === 'word_problem') return makeWPQ_en(topic, kb, diff, req.subject, false);
      return makeTFQ_en(topic, kb, diff, req.subject, false);
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
    //
    // Below three there is no room for a question in each band, and the old
    // `Math.max(1, …)` per band overshot the total by up to two. Reserving the
    // worked example and the half-solved item makes totals that small reachable.
    const splitCounts = (m: number): [number, number, number] => {
      if (m >= 3) {
        const easy = Math.max(1, Math.floor(m * 0.35));
        const hard = Math.max(1, Math.floor(m * 0.25));
        return [easy, Math.max(1, m - easy - hard), hard];
      }
      return m === 2 ? [1, 0, 1] : m === 1 ? [0, 1, 0] : [0, 0, 0];
    };
    const [easyN, midN, hardN] = splitCounts(mainTotal);

    // The half-solved item: its first steps written, blanks for the rest.
    if (completionItem) {
      const { given, remaining } = completionSplit(completionItem.steps);
      const blanks = Array.from({ length: remaining }, (_, i) => `${given.length + i + 1}) __________`);
      const text = [
        completionItem.problem,
        '',
        lang === 'ar' ? 'أكمل الحل:' : 'Complete the solution:',
        ...given.map((line, i) => `${i + 1}) ${line}`),
        ...blanks,
      ].join('\n');
      sections.push({
        type: 'short_answer',
        title: lang === 'ar' ? 'مثال نكمله' : 'Finish the solution',
        questions: [{ text, answer: completionItem.answer, points: saPts(band[1]), fromBank: true }],
      });
      answerKey.push({ num: qNum++, answer: completionItem.answer, solution: completionItem.steps });
    }


    // Titles name the tier the section actually contains, so a "hard"
    // worksheet does not head its first section «تمارين تمهيدية (سهل)».
    const TIER_LABEL_AR: Record<DiffTier, string> = { easy: 'سهل', medium: 'متوسط', hard: 'أصعب' };
    const TIER_LABEL_EN: Record<DiffTier, string> = { easy: 'Easy', medium: 'Medium', hard: 'Harder' };
    const counts = [easyN, midN, hardN];
    const buckets: Array<{ count: number; diff: DiffTier; title: string }> = lang === 'ar'
      ? [
          { count: counts[0], diff: band[0], title: `أ) تمارين تمهيدية (${TIER_LABEL_AR[band[0]]})` },
          { count: counts[1], diff: band[1], title: `ب) تمارين صفية (${TIER_LABEL_AR[band[1]]})` },
          { count: counts[2], diff: band[2], title: `ج) تحدٍّ سريع (${TIER_LABEL_AR[band[2]]})` },
        ]
      : [
          { count: counts[0], diff: band[0], title: `A) Warm-up practice (${TIER_LABEL_EN[band[0]]})` },
          { count: counts[1], diff: band[1], title: `B) Class practice (${TIER_LABEL_EN[band[1]]})` },
          { count: counts[2], diff: band[2], title: `C) Quick stretch (${TIER_LABEL_EN[band[2]]})` },
        ];

    let typeIdx = 0;
    let spent = false;
    bankOnly = questionBankPolicy.required;
    try {
    for (const bucket of buckets) {
      if (spent) break;
      const questions: WQ[] = [];
      // Types rotate WITHIN a bucket, so a section can hold more than one.
      // `sectionType` used to be reassigned on every iteration and ended up
      // naming whichever question came last.
      const typesUsed = new Set<QType>();
      for (let i = 0; i < bucket.count; i++) {
        const type = mainTypes[typeIdx % mainTypes.length];
        typeIdx += 1;
        let q: WQ;
        try {
          q = pushQuestion(type, makeQ(type, bucket.diff), true);
        } catch (e) {
          // The lesson's bank ran out: this section and the rest stay short.
          if (!(e instanceof BankSpentError)) throw e;
          spent = true;
          break;
        }
        typesUsed.add(type);
        questions.push(withoutSteps(q));
        answerKey.push({ num: qNum++, answer: q.answer ?? '—', ...(q.steps ? { solution: q.steps } : {}) });
      }
      if (questions.length > 0) {
        const sectionType = typesUsed.size === 1 ? [...typesUsed][0] : 'mixed';
        sections.push({ type: sectionType, title: bucket.title, questions });
      }
    }

    // At least one life-application word problem when selected
    if (wantsWordProblem && !spent) {
      const q = pushQuestion('word_problem', makeQ('word_problem', 'medium'), true);
      sections.push({
        type: 'word_problem',
        title: lang === 'ar' ? 'مسألة حياتية' : 'Real-life word problem',
        questions: [withoutSteps(q)],
      });
      answerKey.push({ num: qNum++, answer: q.answer ?? '—', ...(q.steps ? { solution: q.steps } : {}) });
    }
    } catch (e) {
      if (!(e instanceof BankSpentError)) throw e;
    } finally {
      bankOnly = false;
    }
    if (sections.every(sec => sec.questions.length === 0)) throw new NoQuestionBankError(topic);

    return {
      title: lang === 'ar'
        ? `ورقة عمل صفية – ${topic}`
        : `In-class Worksheet – ${topic}`,
      instructions: lang === 'ar'
        ? `الاسم: ________________    الصف: ${req.grade}    التاريخ: ________________\n\nمقدمة قصيرة: هذه ورقة تدريب صفية حول «${topic}». اعمل بهدوء، وابدأ بالأسهل ثم انتقل للأصعب.\n\n${exampleItem ? '• ادرس المثال المحلول أولًا، ثم أكمل الحل في السؤال الأول، ثم تابع بقية الأسئلة.\n' : ''}• أجب في المساحات المخصصة.\n• بيّن خطوات الحل عند الحاجة.\n• لا حاجة لملاحظات المعلم — هذه ورقة للطالب.`
        : `Name: ________________    Grade: ${req.grade}    Date: ________________\n\nShort intro: This is an in-class practice sheet on “${topic}”. Work quietly and move from easier to harder items.\n\n${exampleItem ? '• Study the worked example first, then finish the solution in question 1, then carry on.\n' : ''}• Write in the answer spaces provided.\n• Show working where needed.\n• Student sheet only — no teacher notes.`,
      ...(exampleItem
        ? {
            workedExample: {
              problem: exampleItem.problem,
              steps: exampleItem.steps,
              answer: exampleItem.answer,
              selfExplain: lang === 'ar'
                ? 'اشرح بجملة واحدة: لماذا كانت الخطوة الأولى صحيحة؟'
                : 'In one sentence, explain why the first step was valid.',
            },
          }
        : {}),
      sections,
      answerKey,
      // The worked example is one of the `totalQ` items the picker promised, so it
      // is one of the items produced — without it a three-item paper asked of
      // twelve would be reported as two.
      ...(spent ? { shortfall: { requested: totalQ, produced: qNum - 1 - priorCount + (exampleItem ? 1 : 0) } } : {}),
    };
  }

  async generateQuiz(req: AIRequest): Promise<QuizOutput> {
    await this.delay();
    return freshOnRegenerate('quiz', req, () => this.quizOnce(req));
  }

  private async quizOnce(req: AIRequest): Promise<QuizOutput> {
    beginMathPracticeSession();
    const lang: Lang = req.language === 'arabic' ? 'ar' : 'en';
    const kb = groundedKb(req.topic, lang, req.lessonId);
    const topic = req.topic;
    requireQuestionBank(topic, kb, req.subject);
    const totalMarks = req.totalMarks ?? 20;
    const duration = req.duration ?? 20;
    const types: QType[] = (req.questionTypes as QType[]) ?? ['multiple_choice', 'true_false', 'short_answer'];
    // A quiz is a flat assessment, so the requested tier applies to every
    // question — unlike the worksheet, which keeps an easy→hard progression.
    // `mixed` spreads the tiers across the paper instead of collapsing to
    // medium, which is what an unrecognised value used to do silently.
    const quizTier = (t: number): DiffTier => {
      if (req.difficulty === 'mixed') return (['easy', 'medium', 'hard'] as const)[t % 3];
      return req.difficulty === 'easy' || req.difficulty === 'hard' ? req.difficulty : 'medium';
    };

    // Teacher-picked count, cycled evenly across the selected types; marks
    // distributed evenly. Falls back to 2-per-type for callers (e.g. the
    // classroom mini-quiz) that don't send numQuestions.
    const numQuestions = Math.max(types.length, req.numQuestions ?? types.length * 2);
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

    bankOnly = questionBankPolicy.required;
    try {
    for (let i = 0; i < numQuestions; i++) {
      const type = types[i % types.length];
      const id = `q${qIdx++}`;
      // Last question absorbs any rounding difference
      const isLast = qIdx > numQuestions;
      const pts = isLast ? Math.max(1, totalMarks - usedPts) : basePts;
      usedPts += pts;

      const tier = quizTier(qIdx - 2);
      // NOTE: `fill_blank` and `word_problem` fall into the short-answer
      // branch. The quiz picker (`app/ai-tools/quiz.tsx`) offers only the
      // three types handled here, so no teacher can reach it today; a caller
      // that sent one would get an honest short-answer question, correctly
      // labelled as such. Add real branches here before offering them.
      if (lang === 'ar') {
        if (type === 'multiple_choice') questions.push(pushUnique(() => makeQuizMCQ_ar(topic, kb, pts, id, req.subject, tier)));
        else if (type === 'true_false') questions.push(pushUnique(() => makeQuizTF_ar(topic, kb, pts, id, req.subject, tier)));
        else questions.push(pushUnique(() => makeQuizSA_ar(topic, kb, pts, id, req.subject, tier)));
      } else {
        if (type === 'multiple_choice') questions.push(pushUnique(() => makeQuizMCQ_en(topic, kb, pts, id, req.subject, tier)));
        else if (type === 'true_false') questions.push(pushUnique(() => makeQuizTF_en(topic, kb, pts, id, req.subject, tier)));
        else questions.push(pushUnique(() => makeQuizSA_en(topic, kb, pts, id, req.subject, tier)));
      }
    }
    } catch (e) {
      // The lesson's bank ran out: keep what was asked so far.
      if (!(e instanceof BankSpentError)) throw e;
    } finally {
      bankOnly = false;
    }
    if (questions.length === 0) throw new NoQuestionBankError(topic);
    const shortfall = questions.length < numQuestions
      ? { requested: numQuestions, produced: questions.length }
      : undefined;
    if (shortfall) {
      // Spread the marks over the questions that exist.
      const each = Math.max(1, Math.floor(totalMarks / questions.length));
      questions.forEach(q => { q.points = each; });
    }

    // Ensure totalPoints sums exactly to totalMarks
    const actualTotal = questions.reduce((s, q) => s + q.points, 0);
    if (actualTotal !== totalMarks && questions.length > 0) {
      questions[questions.length - 1].points += totalMarks - actualTotal;
    }

    return {
      title: lang === 'ar' ? `اختبار ${topic}` : `${req.subject} Quiz – ${topic}`,
      duration,
      totalPoints: questions.reduce((s, q) => s + q.points, 0),
      questions,
      ...(shortfall ? { shortfall } : {}),
    };
  }

  /**
   * A single-format classroom activity.
   *
   * Each activity type gets its OWN structure from `activityBlueprints.ts` —
   * this used to be one template with the group-size noun swapped into it, so
   * all five types came back byte-identical apart from the title. See that
   * module's header for what each format is built to do.
   *
   * `activityVariant: 'warmup'` produces the short prior-knowledge retrieval
   * the lesson flow opens with, not a compressed copy of the main activity.
   */
  async generateActivity(req: AIRequest): Promise<ActivityOutput> {
    await this.delay();
    return buildOfflineActivity(req, nextActivityVariant(req));
  }

  async generateInfographic(req: AIRequest): Promise<InfographicOutput> {
    await this.delay();
    const lang: Lang = req.language === 'arabic' ? 'ar' : 'en';
    return buildInfographicFromLesson(req.topic, groundedKb(req.topic, lang, req.lessonId), lang);
  }

  async generateClassroomActivity(req: ClassroomActivityRequest): Promise<ClassroomActivity> {
    await this.delay();
    return freshOnRegenerate('classroomActivity', req, () => this.classroomActivityOnce(req));
  }

  private async classroomActivityOnce(req: ClassroomActivityRequest): Promise<ClassroomActivity> {
    beginMathPracticeSession();
    const isAr = req.language === 'arabic';
    const topic = req.topic;
    const kb = groundedKb(topic, isAr ? 'ar' : 'en', req.lessonId);
    const dur = req.duration ?? 20;
    const slideDuration = Math.round((dur * 60) / 5);
    const actType = req.activityType ?? 'escape-challenge';
    const math = isMathContext(topic, kb, req.subject);
    const chem = !math && isChemContext(topic, kb, req.subject);
    const batch = (n: number) =>
      math
        ? takeConcreteMathBatch(n, topic, kb, isAr ? 'ar' : 'en', 'medium')
        : chem
          ? takeConcreteChemBatch(n, topic, kb, isAr ? 'ar' : 'en', 'medium')
          : [];
    const bingoItems = actType === 'bingo' ? batch(8) : [];
    const relayItems = actType === 'relay' ? batch(4) : [];
    // Version 0 on a first generation, +1 per Regenerate of the same request —
    // the lesson-derived formats have nothing random to draw, so this is what
    // makes them show different material the next time.
    const variant = nextVariantFor(
      [req.language, actType, req.lessonId ?? '', topic].join('|'),
      req.regenerate === true,
    );
    const ctx: FormatCtx = { req, topic, isAr, dur, slideDuration, variant };
    const tasks = lessonTasks(topic, kb, isAr ? 'ar' : 'en');

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
      if (math || chem) {
        for (let i = 0; i < wanted; i++) {
          const q = math
            ? takeConcreteMath('multiple_choice', topic, kb, tier, isAr ? 'ar' : 'en', 0)
            : takeConcreteChem('multiple_choice', topic, kb, tier, isAr ? 'ar' : 'en', 0);
          if (q?.options?.length) mcqs.push({ text: q.text, options: q.options, answer: q.answer });
        }
      }

      if (mcqs.length >= 2) {
        // Ask the SymPy verifier to actually prove what it can (derivative
        // slice today). Runs in parallel with a per-item timeout; anything
        // it cannot prove stays labelled as a reviewed bank item.
        // Only maths goes to the symbolic verifier. A chemistry stem can
        // carry an `=` — «q = m·c·ΔT», «Z = 11» — which is enough for
        // `classifyVerifiableTopic` to hand it to SymPy as an equation, and a
        // verdict there renders «تم التحقق من الإجابة رياضيًا»: a claim this
        // product makes carefully and would be making falsely. A bank item is
        // labelled as a bank item, which is what it is.
        const outcomes = math
          ? await Promise.all(
              mcqs.map(q =>
                verifyIfPossible(q.text, q.answer, q.options.filter(o => o !== q.answer)),
              ),
            )
          : mcqs.map(() => BANK_OUTCOME);

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
      const objectives = windowOf(kb?.objectives ?? [], wanted, variant);
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
    // A banked lesson calls real problems. Any other lesson has term NAMES but
    // almost never definitions, so the card carries the names and the teacher
    // reads the clue from the textbook (see `classroomTasks.ts`). A lesson with
    // fewer than four names has nothing to put on a card, so it is refused
    // rather than padded with «Term 1 … Term 8».
    if (actType === 'bingo') {
      if (bingoItems.length >= 4) {
        if (isAr) {
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
      const names = termNames(kb, isAr ? 'ar' : 'en');
      if (names.length < 4) throw new NoQuestionBankError(topic);
      return buildTermBingo(ctx, windowOf(names, 8, variant));
    }

    // ── Relay Race ─────────────────────────────────────────────────────────────
    if (actType === 'relay') {
      if (relayItems.length >= 4) return buildRelay(ctx, relayItems.map(bankChallenge(isAr)));
      return buildRelay(ctx, windowOf(tasks, 4, variant).map(taskChallenge));
    }

    // ── Error Detective ────────────────────────────────────────────────────────
    // Needs a wrong answer to look at. Only the banked subjects have one — a
    // real distractor from the item — so any other lesson is refused instead of
    // being shown another subject's mistakes.
    if (actType === 'error-detective') {
      const cases: ErrorCase[] = [];
      const tiers = ['easy', 'medium', 'hard'] as const;
      for (let i = 0; i < 3 && (math || chem); i++) {
        const q = math
          ? takeConcreteMath('multiple_choice', topic, kb, tiers[i]!, isAr ? 'ar' : 'en', 0)
          : takeConcreteChem('multiple_choice', topic, kb, tiers[i]!, isAr ? 'ar' : 'en', 0);
        const wrong = q?.options?.find(o => o !== q.answer);
        if (q && wrong) cases.push({ question: q.text, wrong, right: q.answer });
      }
      if (cases.length < 2) throw new NoQuestionBankError(topic);
      return buildErrorDetective(ctx, cases);
    }

    // ── Gallery Walk / Exit Ticket ─────────────────────────────────────────────
    // Open formats: students write, the teacher judges. Built from the lesson's
    // own terms and outcomes whatever the subject, so they never refuse.
    if (actType === 'gallery-walk') return buildGalleryWalk(ctx, windowOf(tasks, 4, variant));
    if (actType === 'exit-ticket') return buildExitTicket(ctx, windowOf(tasks, 4, variant));

    // ── Escape Challenge (default) ─────────────────────────────────────────────
    const banked = batch(5);
    if (banked.length >= 3) return buildEscape(ctx, banked.map(bankChallenge(isAr)));
    return buildEscape(ctx, windowOf(tasks, 5, variant).map(taskChallenge));
  }

  async generateHomework(req: AIRequest): Promise<WorksheetOutput> {
    await this.delay();
    return freshOnRegenerate('homework', req, () => this.homeworkOnce(req));
  }

  private async homeworkOnce(req: AIRequest): Promise<WorksheetOutput> {
    beginMathPracticeSession();
    const lang: Lang = req.language === 'arabic' ? 'ar' : 'en';
    const kb = groundedKb(req.topic, lang, req.lessonId);
    const topic = req.topic;
    requireQuestionBank(topic, kb, req.subject);
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
      : isChemContext(topic, kb, req.subject)
        ? takeConcreteChem('short_answer', topic, kb, 'hard', lang, 12)
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
        ? `واجب بيتي – ${topic}`
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
