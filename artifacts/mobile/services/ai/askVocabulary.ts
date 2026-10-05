/**
 * Which material a teacher is asking for, from the words they use for it.
 *
 * One vocabulary for the whole chat. The intent router (`isArtifact`) and the
 * teaching assistant (`detectIntent`) each kept their own list, they disagreed,
 * and both missed most real phrasings: measured 2026-09-28, 41 of 63 everyday
 * asks («امتحان», «أسئلة», «أوراق عمل», «تحضير درس», "study plan", "test",
 * "exam"…) were not recognised as the material they name.
 *
 * Matching is on normalised Arabic (no harakat, ا for أإآ, ه for ة, ي for ى),
 * so every pattern below is written in that form.
 */
import type { SessionArtifact } from './teachingAssistant.ts';

export function normaliseAsk(s: string): string {
  return s
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase();
}

// Arabic word edges: JS `\b` never matches beside Arabic letters. A word may
// carry one clitic in front («والاختبار», «للواجب», «بخطه»).
const B = '(?<![\\u0621-\\u064A])(?:[وفبلك]|لل|ال|وال|بال|فال)?';
const E = '(?![\\u0621-\\u064A])';
const ar = (words: string) => new RegExp(`${B}(?:${words})${E}`);

const VOCAB: Array<[SessionArtifact, RegExp[]]> = [
  ['homework', [
    ar('واجب|واجبات'),
    ar('(?:وظيفه|وظائف)\\s*(?:بيتيه|منزليه)'),
    /\b(?:homework|assignments?)\b/i,
  ]],
  ['worksheet', [
    ar('ورقه\\s*عمل|ورقات\\s*عمل|اوراق\\s*عمل|ورقه\\s*تمارين|ورقه\\s*تدريب'),
    // «تمارين محلولة» are worked examples, not a sheet to hand out.
    new RegExp(`${B}(?:تمارين|تدريبات)${E}(?!\\s*محلوله)`),
    /\b(?:worksheets?|exercises?|practice(?:\s*(?:sheet|questions|problems))?)\b/i,
  ]],
  ['quiz', [
    ar('اختبار|اختبارات|امتحان|امتحانات|كويز|تقويم|اسئله|بنك\\s*اسئله'),
    /\b(?:quiz(?:zes)?|exams?|assessments?|questions)\b/i,
    /\btests?\b(?!\s*tubes?)/i,
  ]],
  ['activity', [
    ar('نشاط|نشاطات|انشطه|لعبه|العاب'),
    /\b(?:activit(?:y|ies)|games?|icebreakers?)\b/i,
  ]],
  ['lesson-plan', [
    ar('خطه|خطط|تحضير'),
    // «حضّر الدرس» / «جهز الحصة» — preparing the lesson itself is the plan.
    new RegExp(`${B}(?:حضر|جهز|اعد)(?:\\s*لي)?\\s*(?:ال)?(?:درس|حصه)${E}`),
    /\b(?:lesson|study|teaching|daily|weekly|unit|semester|term|class)\s*plans?\b/i,
    /\blesson\s*prep\b|\bprepare\s+(?:a|the|my|this|tomorrow'?s)?\s*(?:lesson|class)\b/i,
    // A bare "plan" — but "business plan" and its kin are lesson topics.
    /(?<!\b(?:business|project|marketing|financial|action|feasibility|savings?)\s)\bplans?\b/i,
  ]],
];

/**
 * A question about content — «ما هي خطة التنمية؟», "what is a test?" — names a
 * material word without asking for one. It counts only with a request verb.
 */
const CONTENT_QUESTION = /^(?:ما|ماذا|كيف|لماذا|متي|هل|اين|من)\s|^(?:what|how|why|when|where|who|is|are|does|do)\b/i;
const REQUEST = new RegExp(
  `${B}(?:حضر|جهز|اعمل|انشئ|اعد|ولد|اريد|بدي|بدنا|ابغي|ابغى|اعطني|اعطيني|عطني|هات|اكتب|اقترح|ممكن|يمكنك|تقدر)${E}`
  + '|\\b(?:make|create|give|prepare|generate|need|want|build|write|suggest|can\\s+you|could\\s+you)\\b',
  'i',
);

/**
 * The material the message asks for, or null. When a message names two
 * («خطة درس مع اختبار»), the first in this order wins: homework, worksheet,
 * quiz, activity, then a plan — the plan words are the loosest.
 */
/**
 * «قبل الاختبار» / "before the test" says *when*, not *what*. «مراجعة قبل
 * الاختبار» — the review framing the chat offers under an explanation — was
 * read as a quiz ask: the reply asked about question types, the lesson card
 * counted a quiz, and none had been made. A quiz asked for *for* the test
 * («اختبار قبل الاختبار النهائي») keeps its own word and still matches.
 */
const BEFORE_THE_TEST = new RegExp(
  `قبل\\s*(?:ال)?(?:اختبار|امتحان)(?:ات)?(?:\\s*(?:النهائي|القادم|الشهري|الفصلي))?${E}`
  + '|\\bbefore\\s+(?:the\\s+|an?\\s+|my\\s+|our\\s+|their\\s+)?(?:final\\s+)?(?:tests?|exams?|quiz(?:zes)?)\\b',
  'gi',
);

export function artifactFromAsk(query: string): SessionArtifact | null {
  const q = normaliseAsk(query.trim()).replace(BEFORE_THE_TEST, ' ');
  if (!q) return null;
  if (CONTENT_QUESTION.test(q) && !REQUEST.test(q)) return null;
  for (const [artifact, patterns] of VOCAB) {
    if (patterns.some(p => p.test(q))) return artifact;
  }
  // «وظيفة» alone (or with filler) is Levantine for homework; «ما وظيفة الكبد»
  // is a biology question, so only a short message counts.
  if (!CONTENT_QUESTION.test(q) && ar('وظيفه|وظائف').test(q) && q.split(/\s+/).length <= 3) {
    return 'homework';
  }
  return null;
}

/**
 * "Teach me" — «علّمني», «فهّمني», «درّسني», "teach me", "help me understand".
 *
 * The router knew شرح / وضّح / ما هو and nothing else, so «علمني» (one word)
 * fell to the short-token clarify and «علمني الاقترانات» (two) did too. Only
 * the pronoun-suffixed verb counts: «المعلم», «العلوم», «علم الكيمياء» are
 * words about teaching, not an ask for it. «درسنا» is left out — it is "we
 * studied" as often as "teach us".
 */
const TEACH_ME_AR = new RegExp(`${B}[تي]?(?:(?:علم|فهم)(?:ني|نا)|درسني)${E}`);
const TEACH_ME_EN = /\bteach\s+(?:me|us)\b|\bhelp\s+(?:me|us)\s+(?:to\s+)?understand\b/i;

export function isTeachMeAsk(query: string): boolean {
  const q = normaliseAsk(query.trim());
  return TEACH_ME_AR.test(q) || TEACH_ME_EN.test(q);
}

/**
 * A teach / explain / carry-on verb that names no topic of its own: «علمني»,
 * «اشرحه», «ابدأ», «كمّل», "teach me", "continue". The topic is whatever lesson
 * is already open — so it must never be searched for as a topic itself, which
 * is what a soft-pinned lesson would otherwise let happen.
 *
 * Anchored at both ends: «اشرح المشتقات» names its topic and is not bare.
 */
const BARE_TEACH_AR = new RegExp(
  '^(?:(?:يلا|خلينا|هيا)\\s*)?'
  + '(?:علمني|علمنا|فهمني|فهمنا|درسني|اشرح(?:ه|ها|لي)?|شرح|الشرح|ابدا|نبدا|كمل|تابع|استمر)'
  + '(?:\\s*(?:لي|لنا))?'
  + '(?:\\s*(?:هذا\\s*)?(?:الدرس|الحصه))?'
  + '(?:\\s*من\\s*(?:البدايه|الاول))?'
  + '(?:\\s*(?:لو\\s*سمحت|من\\s*فضلك|رجاء))?$',
);
const BARE_TEACH_EN = new RegExp(
  '^(?:please\\s+)?(?:let\'?s\\s+)?'
  + '(?:teach\\s+(?:me|us)|explain(?:\\s+(?:it|this|that))?|start|begin|continue|go\\s+on|keep\\s+going)'
  + '(?:\\s+(?:the|this)\\s+lesson)?'
  + '(?:\\s+from\\s+the\\s+(?:start|beginning))?'
  + '(?:\\s+please)?$',
  'i',
);

export function isBareTeachAsk(query: string): boolean {
  const q = normaliseAsk(query.trim())
    .replace(/[!?؟.،,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return BARE_TEACH_AR.test(q) || BARE_TEACH_EN.test(q);
}
