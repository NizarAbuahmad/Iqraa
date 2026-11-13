/**
 * What TYPE of lesson this is, inside its subject.
 *
 * `lessonPlanKinds.ts` decides a plan's body from the subject alone, and inside
 * three subjects that is not enough. Measured on 2026-11-13 over all 236 Grade 2
 * lessons (offline, live AI off):
 *
 *  - Islamic education: every lesson got the Quran-recitation body («سأتلو
 *    الآيات… تسميع فردي لما قُرّر حفظه») — the pillars of faith, the sira, a Name
 *    of Allah, the wudu and «نظافة منزلي» included.
 *  - Creative arts: one book holds an art, a music and a drama unit, and the
 *    drama lesson «خشبة المسرح» was told «سأعرض نموذجًا منجزًا للعمل المطلوب».
 *  - Arabic: the «لغتي» readers give each unit five fixed lessons (listening,
 *    speaking, reading, spelling/writing, language building); all 50 Grade 2
 *    plans were identical, and the listening lesson was told to read a text aloud.
 *
 * The type is read from the lesson the request names (its catalog title, and
 * for the arts book its unit), never by searching for a title: a Grade 2 Arabic
 * title repeats in every unit, and a title search can land on another book. A
 * lesson we cannot place, a typed topic, or any other subject has no type, and
 * keeps the plan its kind always had.
 *
 * The live route gets the same answer: `RemoteAIService` sends it as
 * `lessonType`, and `artifacts/api-server/src/lib/lessonKinds.ts` holds the
 * matching clauses (`LESSON_TYPES` there must equal the list here — a test
 * reads both).
 */
import { getBookForLesson, getLessonById, getUnitForLesson, type KBLesson } from '../knowledgeBase.ts';
import type { LessonKind } from './lessonPlanKinds.ts';

export const LESSON_TYPES = [
  // Islamic education
  'quran', 'hadith', 'creed', 'worship', 'sira', 'conduct',
  // Creative arts — one book, three units
  'visual-art', 'music', 'drama',
  // Arabic — the «لغتي» lesson types
  'listening', 'speaking', 'reading', 'writing', 'language', 'letters',
] as const;
export type LessonType = typeof LESSON_TYPES[number];

/** Which kind each type refines — a type is only honoured on a lesson of that kind. */
export const KIND_OF_TYPE: Record<LessonType, LessonKind> = {
  quran: 'recitation', hadith: 'recitation', creed: 'recitation',
  worship: 'recitation', sira: 'recitation', conduct: 'recitation',
  'visual-art': 'making', music: 'making', drama: 'making',
  listening: 'arabic', speaking: 'arabic', reading: 'arabic',
  writing: 'arabic', language: 'arabic', letters: 'arabic',
};

export function isLessonType(v: unknown): v is LessonType {
  return typeof v === 'string' && (LESSON_TYPES as readonly string[]).includes(v);
}

/** Diacritics, tatweel and the alef/yaa spellings folded, so a pattern matches either spelling. */
export function foldArabic(s: string): string {
  return s
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

/** `bare` keeps the hamza: «الإيمان» (faith) and «الأيمان» (oaths) fold to the same letters. */
function islamicType(title: string, bare: string): LessonType {
  if (/^سورة|^اية |^التلاوة والتجويد|وقف التلاوة|احكام التلاوة|تفخيم|ترقيق/.test(title)) return 'quran';
  if (/^الحديث الشريف/.test(title)) return 'hadith';
  // «الصلاة على النبي» is a remembrance, not a prayer and not a story.
  if (/^الصلاة علي النبي/.test(title)) return 'conduct';
  if (/الإيمان/.test(bare)) return 'creed';
  if (/^(من )?اسماء الله|^الله |الشهادتان|اركان الاسلام|التوحيد|الملائكة|اليوم الاخر|القضاء والقدر|معجزات/.test(title)) return 'creed';
  if (/الوضوء|الصلاة|الصلوات|صلاة|الصلاتين|الفطر|الافطار|رمضان|الخفين|الصيام|صيام|الزكاة|الحج|العمرة|الطهارة|النجاسة|الاغتسال|التيمم|سجود|الاذان|السنن الرواتب/.test(title)) return 'worship';
  if (/سيدنا |النبي ﷺ|صلح |الصحابة|رسول الله|رسولي|الصادق الامين|نسب |ولادة|رضاعة|الهجرة|غزوة|^يوم (بدر|احد|الخندق)|الصحابي|الصحابية|السيدة|ام المؤمنين|نبي الله|نزول الوحي|السابقون|الخلفاء الراشدين|عام الحزن|شعب ابي طالب|الطائف|الاسراء والمعراج|بناء الكعبة|^قصة /.test(title)) return 'sira';
  return 'conduct';
}

function artsType(unitTitle: string): LessonType {
  if (/موسيق/.test(unitTitle)) return 'music';
  if (/مسرح/.test(unitTitle)) return 'drama';
  return 'visual-art';
}

function arabicType(title: string): LessonType | null {
  if (/^(استمع|الاستماع)/.test(title)) return 'listening';
  if (/^(اتحدث|التحدث)/.test(title)) return 'speaking';
  if (/^(اقرا|القراءة)/.test(title)) return 'reading';
  if (/^(اكتب|الكتابة)/.test(title)) return 'writing';
  if (/^(ابني لغتي|البناء اللغوي)/.test(title)) return 'language';
  if (/^(حرف|تنوين|الشدة)/.test(title)) return 'letters';
  return null;
}

/** The type a catalog lesson teaches, from its own title (and unit, for the arts book). */
export function lessonTypeOf(lesson: { subjectId: string; titleAr: string; unitTitleAr?: string }): LessonType | null {
  const title = foldArabic(lesson.titleAr);
  switch (lesson.subjectId) {
    case 'islamic': return islamicType(title, lesson.titleAr.replace(/[\u064B-\u0652\u0670\u0640]/g, ''));
    case 'creative-arts': return artsType(foldArabic(lesson.unitTitleAr ?? ''));
    case 'arabic': return arabicType(title);
    default: return null;
  }
}

/**
 * Islamic and Arabic types are honoured in Grades 1–6 only. Those bodies are
 * written for young children (a pretend microphone, answers given by drawing, no
 * written paragraph in a listening lesson), the classification was checked on
 * Grade 2, and the upper-grade Islamic books are mostly fiqh, sources and rulings
 * the title patterns do not place — «موقف الشريعة الإسلامية من الربا» landed on
 * the ethics routine for children. From Grade 7 they keep their kind's plan. The
 * arts types (art, music, drama, from the unit) hold in every grade.
 * `lessonKinds.ts` on the API applies the same limit.
 */
export const TYPED_UP_TO_GRADE = 6;
const EVERY_GRADE: ReadonlySet<LessonType> = new Set(['visual-art', 'music', 'drama']);

/** Whether a type is honoured at a grade (1–12, or null when unknown). */
export function typeHoldsAt(type: LessonType, level: number | null): boolean {
  return EVERY_GRADE.has(type) || (level !== null && level <= TYPED_UP_TO_GRADE);
}

/** The type of a KB lesson the caller already holds (grounded by its id), or null. */
export function lessonTypeForKb(kb: KBLesson | null | undefined): LessonType | null {
  if (!kb) return null;
  const book = getBookForLesson(kb);
  if (!book) return null;
  const type = lessonTypeOf({ subjectId: book.subjectId, titleAr: kb.titleAr, unitTitleAr: getUnitForLesson(kb)?.titleAr });
  return type && typeHoldsAt(type, gradeLevelOf(book.gradeId)) ? type : null;
}

/** The type of the lesson a request names by id — what the live route is told. */
export function lessonTypeForId(lessonId: string | undefined): LessonType | null {
  if (!lessonId) return null;
  return lessonTypeForKb(getLessonById(lessonId) ?? null);
}

// ─── Grade bands ─────────────────────────────────────────────────────────────

/**
 * How much a child can be asked to do at home, and how a lesson can close.
 *
 * Plans used to give a Grade 2 child «اكتب ملخصًا شخصيًا من 10 جمل» and close
 * every lesson with a written "3-2-1" card. `early` is Grades 1–3 (short, oral or
 * hands-on, with a family member), `middle` Grades 4–6, `upper` Grade 7 and up
 * and anything we cannot place — the plan as it always was.
 */
export type GradeBand = 'early' | 'middle' | 'upper';

const AR_GRADE_ORDINALS = [
  'الاول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس',
  'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر',
];

/** 1–12 from «grade-2», «Grade 2», «الصف الثاني», «2»; null when it is none of those. */
export function gradeLevelOf(grade: string | undefined | null): number | null {
  if (!grade) return null;
  const g = foldArabic(String(grade)).toLowerCase();
  const digits = g.match(/^(?:grade[-\s]?)?(\d{1,2})$/);
  if (digits) {
    const n = Number(digits[1]);
    return n >= 1 && n <= 12 ? n : null;
  }
  const ar = g.replace(/^الصف\s*/, '');
  // Longest first, so «الثاني عشر» is not read as «الثاني».
  const order = AR_GRADE_ORDINALS.map((name, i) => [name, i + 1] as const).sort((a, b) => b[0].length - a[0].length);
  for (const [name, n] of order) if (ar === name) return n;
  return null;
}

export function gradeBandOf(level: number | null): GradeBand {
  if (level === null) return 'upper';
  if (level <= 3) return 'early';
  if (level <= 6) return 'middle';
  return 'upper';
}

/** The band of a plan: the lesson's own book when known, else the request's grade. */
export function gradeBandFor(kb: KBLesson | null | undefined, grade: string | undefined): GradeBand {
  const bookGrade = kb ? getBookForLesson(kb)?.gradeId : undefined;
  return gradeBandOf(gradeLevelOf(bookGrade) ?? gradeLevelOf(grade));
}
