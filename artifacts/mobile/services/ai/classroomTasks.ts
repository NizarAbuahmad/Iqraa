/**
 * What a classroom activity can be built from when a subject has no question
 * bank.
 *
 * Measured over the real catalog (grade 10): maths and chemistry have banked
 * items with computed answers; every other subject has key-term NAMES and
 * official objectives, but almost never a definition (0 of 72 biology terms
 * carry one). So an answerable item — «what does X mean?» with a key — cannot
 * be derived from the lesson data, and inventing one is the failure the
 * question-bank policy exists to prevent.
 *
 * What CAN be built honestly is a TASK about the lesson's own terms and
 * outcomes whose answer the TEACHER checks against the textbook. Each task
 * therefore carries `check`, the sentence that goes in the answer key and says
 * so — never a fabricated solution.
 *
 * RN-free on purpose (explicit `.ts` imports): `node --test` loads it.
 */
import type { KBLesson } from '../knowledgeBase.ts';

export type Lang = 'ar' | 'en';

/** One thing for students to do, and what the teacher is told to check it against. */
export interface LessonTask {
  prompt: string;
  /** A short hint, shown under the prompt. */
  hint: string;
  /** What the teacher checks the answer against — goes in the answer key. */
  check: string;
  /** The key term the task is about; empty for an outcome or generic task. */
  about: string;
}

/**
 * The lesson's key terms, in the requested language, then its key concepts —
 * names only, deduplicated. These are what a bingo card can carry.
 */
export function termNames(kb: KBLesson | null, lang: Lang): string[] {
  if (!kb) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (s: string | undefined) => {
    const v = (s ?? '').trim();
    if (v && !seen.has(v)) { seen.add(v); out.push(v); }
  };
  for (const t of kb.keyTerms) add(lang === 'ar' ? t.ar : t.en || t.ar);
  for (const c of lang === 'ar' ? kb.keyConceptsAr : kb.keyConceptsEn.length ? kb.keyConceptsEn : kb.keyConceptsAr) add(c);
  return out;
}

const textbookAr = 'يتحقق المعلم من الإجابة بمقارنتها بما ورد في كتاب الطالب.';
const textbookEn = "The teacher checks the answer against the student's textbook.";

/**
 * Tasks drawn from the lesson: one per key term, one per official outcome,
 * interleaved so the first few cover both, then a handful of generic prompts
 * about the lesson's title so a lesson with almost no data still has enough to
 * rotate through on Regenerate.
 */
export function lessonTasks(topic: string, kb: KBLesson | null, lang: Lang): LessonTask[] {
  const ar = lang === 'ar';
  const terms = (kb?.keyTerms ?? []).filter(t => (ar ? t.ar : t.en || t.ar));
  // Official outcomes are written in Arabic only; an English activity that
  // quoted them would be a sentence of English around a sentence of Arabic.
  const objectives = ar ? (kb?.objectives ?? []).filter(o => o.trim()) : [];

  const termTasks: LessonTask[] = terms.map(t => {
    const name = ar ? t.ar : t.en || t.ar;
    const def = (ar ? t.definitionAr : t.definitionEn || t.definitionAr)?.trim();
    return {
      about: name,
      prompt: ar
        ? `اشرح «${name}» بكلماتك، وأعطِ مثالًا من الدرس.`
        : `Explain “${name}” in your own words and give an example from the lesson.`,
      hint: ar ? `تذكّر ما درسناه عن «${name}»` : `Think back to what we covered on “${name}”`,
      check: def
        ? (ar ? `الإجابة المتوقعة: ${def}` : `Expected: ${def}`)
        : (ar ? textbookAr : textbookEn),
    };
  });

  const objectiveTasks: LessonTask[] = objectives.map(o => ({
    about: '',
    prompt: ar
      ? `أظهِر أنك حققت هذا النتاج بإجابة قصيرة: «${o}»`
      : `Show you have met this outcome in a short answer: “${o}”`,
    hint: ar ? 'ابدأ بجملة واحدة تلخّص الفكرة' : 'Start with one sentence that sums up the idea',
    check: ar ? 'يتحقق المعلم من الإجابة بمقارنتها بنتاج الدرس وبكتاب الطالب.' : 'The teacher checks the answer against the lesson outcome and the textbook.',
  }));

  const own: LessonTask[] = [];
  for (let i = 0; i < Math.max(termTasks.length, objectiveTasks.length); i++) {
    if (termTasks[i]) own.push(termTasks[i]!);
    if (objectiveTasks[i]) own.push(objectiveTasks[i]!);
  }

  const generic = (prompt: string, hint: string): LessonTask => ({
    about: '', prompt, hint, check: ar ? textbookAr : textbookEn,
  });
  const filler: LessonTask[] = ar
    ? [
        generic(`ما الفكرة الرئيسية في «${topic}»؟ اشرحها بجملتين.`, 'فكّر فيما أراد الدرس أن تتذكره'),
        generic(`اذكر مثالًا من الدرس أو من حياتك يوضّح «${topic}».`, 'ابحث عن مثال تعرفه'),
        generic(`ما أصعب نقطة في «${topic}» برأيك؟ ولماذا؟`, 'كن صريحًا — هذا يفيد المعلم'),
        generic(`لخّص «${topic}» في ثلاث كلمات مفتاحية وبرّر اختيارك.`, 'اختر الكلمات التي لا يُفهم الدرس بدونها'),
        generic(`اشرح «${topic}» لزميل لم يحضر الحصة.`, 'ابدأ بما يعرفه زميلك'),
        generic(`ما السؤال الذي ما زال عندك حول «${topic}»؟`, 'اكتب سؤالًا يمكن للصف أن يجيب عنه'),
      ]
    : [
        generic(`What is the main idea of “${topic}”? Explain it in two sentences.`, 'Think about what the lesson wanted you to remember'),
        generic(`Give an example from the lesson or your own life that shows “${topic}”.`, 'Look for an example you already know'),
        generic(`Which part of “${topic}” is hardest, and why?`, 'Be honest — it helps the teacher'),
        generic(`Sum up “${topic}” in three key words and justify your choice.`, 'Pick the words the lesson cannot be understood without'),
        generic(`Explain “${topic}” to a classmate who missed the lesson.`, 'Start from what your classmate already knows'),
        generic(`What question do you still have about “${topic}”?`, 'Write a question the class could answer'),
      ];

  return [...own, ...filler];
}

/**
 * `n` items from `pool`, starting `variant` windows in and wrapping — so each
 * Regenerate shows different material until the pool is exhausted, and a pool
 * no bigger than the window still changes by rotating its order. Never returns
 * more than `pool.length` items.
 */
export function windowOf<T>(pool: readonly T[], n: number, variant: number): T[] {
  if (pool.length === 0 || n <= 0) return [];
  const take = Math.min(n, pool.length);
  const start = pool.length <= n ? variant % pool.length : (variant * n) % pool.length;
  return Array.from({ length: take }, (_, i) => pool[(start + i) % pool.length]!);
}

/**
 * Which version of an activity a request gets — 0 on a first generation, one
 * more on each Regenerate of the same request. Kept in memory, per session,
 * like `nextActivityVariant`; a reload restarts the count.
 */
const classroomVariants = new Map<string, number>();
const MAX_TRACKED = 200;

export function nextVariantFor(key: string, regenerate: boolean): number {
  const next = regenerate ? (classroomVariants.get(key) ?? 0) + 1 : 0;
  classroomVariants.delete(key); // re-insert last, so the oldest entry is the stalest
  classroomVariants.set(key, next);
  if (classroomVariants.size > MAX_TRACKED) {
    classroomVariants.delete(classroomVariants.keys().next().value as string);
  }
  return next;
}
