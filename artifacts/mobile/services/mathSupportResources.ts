/**
 * Grade 10 support packs — the teacher-facing view of the knowledge bank.
 *
 * This used to own two JSON catalogs of its own (`data/g10_math_support_
 * resources.json` and its chemistry twin). It no longer owns any data: the
 * bank lives in `@workspace/curriculum` and this is a search over it. The two
 * catalogs described the same 66 PDFs as `lib/curriculum`'s source manifest,
 * under a second id space and a second type vocabulary, and had drifted —
 * every past exam paper was typed `quiz`, five of them tagged `remedial`, and
 * three entries pointed at copies the manifest marks `duplicate`.
 *
 * That last one is worth remembering when touching the de-duplication below:
 * it keys on title, and the two copies of each chemistry student book carried
 * *different* titles (one Arabic, one English), so this function could never
 * have caught them. Identity belongs in the manifest, which knows byte counts
 * and page counts; a title comparison here is only a cheap second guard.
 */

import {
  type CurriculumSource,
  type SourceKind,
  type BankUsePolicy,
  appSubjectId,
  bankItems,
  bankTagsForUnit,
  isUnitScopedTag,
  usePolicy,
} from '@workspace/curriculum';
import type { KBLesson } from './knowledgeBase.ts';
import { getBookForLesson, getUnitForLesson } from './knowledgeBase.ts';

/**
 * Subjects whose bank material may be offered to a teacher.
 *
 * Financial literacy is held back deliberately, not for want of files: the
 * manifest records an unresolved edition conflict between its S1 and S2 books
 * (`finlit-s2-student-book`, status `conflict`), and STATUS.md's standing
 * instruction is that nothing be generated across the two until one edition is
 * chosen. Its S1 book is otherwise perfectly usable, so this is a decision to
 * revisit — see STATUS.md — and not a permanent property of the subject.
 */
const APP_SUBJECTS: ReadonlySet<string> = new Set(['mathematics', 'chemistry']);

/**
 * A bank document as the app reads it: the manifest entry, plus the two names
 * the UI already speaks (`titleAr`, `subjectId`) and the use policy resolved
 * once so no caller has to re-derive it from `authority`.
 */
export type SupportResource = CurriculumSource & {
  titleAr: string;
  subjectId: string;
  usePolicy: BankUsePolicy;
};

function toResource(s: CurriculumSource): SupportResource {
  return { ...s, titleAr: s.title, subjectId: appSubjectId(s.subject), usePolicy: usePolicy(s) };
}

const RESOURCES: SupportResource[] = bankItems()
  .filter(s => APP_SUBJECTS.has(appSubjectId(s.subject)))
  .map(toResource);

const KIND_LABEL_AR: Record<SourceKind, string> = {
  'student-book': 'كتاب الطالب',
  'teacher-guide': 'دليل المعلم',
  'activity-book': 'كتاب الأنشطة',
  'ministry-support': 'مادة علاجية / وزارية',
  worksheet: 'ورقة عمل',
  'answer-key': 'إجابات',
  summary: 'ملخص',
  'study-pack': 'دوسية',
  'question-bank': 'بنك أسئلة',
  exam: 'ورقة اختبار',
};

const KIND_LABEL_EN: Record<SourceKind, string> = {
  'student-book': 'Student book',
  'teacher-guide': 'Teacher guide',
  'activity-book': 'Activity book',
  'ministry-support': 'Ministry / remedial',
  worksheet: 'Worksheet',
  'answer-key': 'Answer key',
  summary: 'Summary',
  'study-pack': 'Study pack',
  'question-bank': 'Question bank',
  exam: 'Past paper',
};

/**
 * The title as a teacher should read it, rather than as Drive stores it.
 *
 * `titleAr` is the filename, verbatim and deliberately so — the manifest keeps
 * it that way precisely so a file can be found by searching for its name. That
 * makes it wrong for a list: it ends in `.pdf`, and most of these filenames
 * already carry the author, so a row that also shows `authorAr` prints
 * «... أ. عبد الحميد الهندي.pdf» above «أ. عبد الحميد الهندي».
 *
 * Only ever trims the end, and only a credit that matches the author already
 * recorded for that file — a title with a name embedded mid-sentence, or a
 * different name at the end, is left exactly as it is.
 */
export function displayTitle(r: Pick<SupportResource, 'titleAr' | 'authorAr'>): string {
  let out = r.titleAr.replace(/\.pdf$/i, '').trim();
  out = out.replace(/\s*\(\d+\)$/, '').trim();
  if (r.authorAr) {
    const name = r.authorAr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(
      new RegExp(`\\s*(?:إعداد\\s*)?(?:المعلمة|المعلم|أ|م)\\s*\\.?\\s*${name}\\s*$`),
      '',
    ).trim();
  }
  // Never trim a title away to nothing: a row with no words is worse than a
  // row that repeats the author.
  return out.length >= 8 ? out : r.titleAr.replace(/\.pdf$/i, '').trim();
}

/** The one place a `kind` becomes words a teacher reads. */
export function kindLabel(kind: SourceKind, lang: 'ar' | 'en'): string {
  return lang === 'ar' ? KIND_LABEL_AR[kind] : KIND_LABEL_EN[kind];
}

function detectSubjectFromQuery(query: string): 'mathematics' | 'chemistry' | null {
  const q = query.trim();
  if (/كيمياء|chemistry|بور|بلانك|ذرة|روابط|تفاعلات كيمي/i.test(q)) return 'chemistry';
  if (/رياضيات|math|دائرة|اقتران|مشتق|أسس والمعادلات|مثلث/i.test(q)) return 'mathematics';
  return null;
}

/**
 * Map a KB lesson onto the bank's unit tags.
 *
 * The structural mapping lives in `@workspace/curriculum` so the API server
 * derives the same tags from a `CurriculumObjective` — the unit ids are one
 * namespace and there is no reason for two implementations of this.
 */
export function unitTagsForLesson(lesson: KBLesson | null | undefined): string[] {
  if (!lesson) return [];
  const unit = getUnitForLesson(lesson);
  const book = getBookForLesson(lesson);
  if (!unit) return [];

  // Primary: derived from the unit id.
  //
  // This replaced a hand-written mapping that tested `unit.id === 'kbu-chem-1'`
  // and four siblings — ids from a scheme the catalog no longer uses. Every one
  // of those branches was dead, which left chemistry unit tags to the title
  // keywords below, and ten of the seventeen chemistry lessons — all of units
  // 2, 4 and 5 — resolved to no unit tag at all.
  const tags: string[] = [...bankTagsForUnit(unit.id)];

  // Fallback for a unit the mapping does not recognise (a non-NCCD book).
  // Better a semester tag than nothing; previously this was the only source of
  // the semester tag and it is kept for the ids `bankTagsForUnit` returns [] for.
  if (!tags.length && book?.semester) {
    if (book.subjectId === 'chemistry') tags.push(`chem-s${book.semester}`);
    else if (book.subjectId === 'financial-literacy') tags.push(`finlit-s${book.semester}`);
    else if (book.subjectId === 'mathematics') tags.push(`s${book.semester}`);
  }

  // Secondary: title keywords, each gated to its own subject.
  //
  // These are no longer load-bearing for the unit a lesson sits in — they now
  // only add a *neighbouring* unit's material, where the topic genuinely spans
  // two (a trigonometry lesson that also wants the functions summary).
  //
  // Gating matters: ungated, «تجربة استهلالية: المعادلة الكيميائية» matched
  // /معادل/ and picked up the MATHEMATICS tag `s1-u1`, putting six algebra
  // worksheets on a chemistry lab. Chat survived it only because
  // `scoreResource` rejects a subject mismatch afterwards.
  const title = `${unit.titleAr} ${lesson.titleAr}`;
  if (book?.subjectId === 'mathematics') {
    if (/مصفوف/.test(title)) tags.push('s1-matrices');
    if (/دائر/.test(title)) tags.push('s1-u2');
    if (/اشتقاق|مشتق/.test(title)) tags.push('s2-u6');
    // Known imprecision, left alone: «الاقترانات المثلثية» is a Semester 1
    // trigonometry lesson and this also tags it with the Semester 2 functions
    // unit. Both are genuinely about اقترانات, so the extra material is
    // related rather than wrong — unlike the cross-subject case above.
    if (/اقتران/.test(title)) tags.push('s2-u5');
    if (/أسس|معادل/.test(title)) tags.push('s1-u1');
  }
  if (book?.subjectId === 'chemistry') {
    if (/بنية الذرة|بور|بلانك/.test(title)) tags.push('chem-s1-u1');
    if (/جدول دوري|دوري/.test(title)) tags.push('chem-s1-u2');
    if (/روابط|تساهمية|أيونية|فلزية/.test(title)) tags.push('chem-s1-u3');
    if (/تفاعل/.test(title)) tags.push('chem-s2-u4');
    if (/طاقة/.test(title)) tags.push('chem-s2-u5');
  }

  return [...new Set(tags)];
}

function scoreResource(
  r: SupportResource,
  query: string,
  lessonTags: string[],
  subjectHint: string | null,
): number {
  let score = 0;
  const q = query.trim().toLowerCase();
  const title = r.titleAr.toLowerCase();

  // A declared subject mismatch disqualifies outright.
  //
  // This was a -6 soft penalty, on the theory that a strong title match should
  // still be allowed through. It isn't: a Grade 10 maths worksheet is never the
  // right attachment for a financial-literacy lesson, however the titles score.
  // Worse, the unit-tag bonus below is +8, so a single colliding tag beat the
  // penalty outright — «المشروع وإدارته» (financial literacy) came back with
  // three mathematics files, and since 2026-08-20 those go into a live prompt.
  if (subjectHint && r.subjectId !== subjectHint) return 0;

  for (const tag of lessonTags) {
    if (r.unitTags.includes(tag)) score += isUnitScopedTag(tag) ? 8 : 3;
  }

  if (!q) return score;

  const tokens = q
    .split(/[\s,،/]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 3);

  for (const t of tokens) {
    if (title.includes(t)) score += 4;
    if (r.keywords.some(k => k.toLowerCase().includes(t))) score += 2;
  }

  // Kind bonuses. `exam` and `question-bank` are separate lines because they
  // are separate things: the ten entries under `exam` are real Jordanian test
  // papers, and the old vocabulary called both of them `quiz`.
  if (/ورقة عمل|worksheet/i.test(q) && r.kind === 'worksheet') score += 5;
  if (/اختبار|امتحان|exam|past paper/i.test(q) && r.kind === 'exam') score += 5;
  if (/أسئلة|بنك|quiz|questions/i.test(q) && r.kind === 'question-bank') score += 5;
  if (/ملخص|summary/i.test(q) && r.kind === 'summary') score += 5;
  if (/دوسية|ملزمة|study pack/i.test(q) && r.kind === 'study-pack') score += 5;
  if (/إجابات|حلول|answer/i.test(q) && r.kind === 'answer-key') score += 5;
  if (/علاجي|تأسيس|فاقد|داعمة|remedial/i.test(q) && r.kind === 'ministry-support') score += 5;
  if (/كتاب الطالب|student book/i.test(q) && r.kind === 'student-book') score += 6;
  if (/دليل المعلم|teacher guide/i.test(q) && r.kind === 'teacher-guide') score += 6;
  if (/كتاب الأنشطة|الأنشطة|activity/i.test(q) && r.kind === 'activity-book') score += 6;

  return score;
}

/** Find support PDFs relevant to a query and/or active lesson. */
export function searchSupportResources(opts: {
  query?: string;
  lesson?: KBLesson | null;
  limit?: number;
  kinds?: readonly SourceKind[];
  subjectId?: string | null;
}): SupportResource[] {
  const query = opts.query ?? '';
  const lessonTags = unitTagsForLesson(opts.lesson);
  const limit = opts.limit ?? 5;
  const kindFilter = opts.kinds;
  const subjectHint =
    opts.subjectId
    ?? (opts.lesson ? getBookForLesson(opts.lesson)?.subjectId : null)
    ?? detectSubjectFromQuery(query);

  const ranked = RESOURCES
    .filter(r => !kindFilter?.length || kindFilter.includes(r.kind))
    .map(r => ({ r, score: scoreResource(r, query, lessonTags, subjectHint) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.r.titleAr.localeCompare(b.r.titleAr, 'ar'));

  const seen = new Set<string>();
  const out: SupportResource[] = [];
  for (const { r } of ranked) {
    const key = r.titleAr.replace(/\s+/g, ' ').trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

export function formatSupportResourcesBlock(
  resources: SupportResource[],
  lang: 'ar' | 'en',
): string {
  if (!resources.length) return '';
  const isAr = lang === 'ar';
  const header = isAr
    ? '📎 مواد مساندة متوفرة في مكتبة اقرأ (للمعلم):'
    : '📎 Support materials in the Iqra library:';
  const lines = resources.map(r => {
    const kind = kindLabel(r.kind, isAr ? 'ar' : 'en');
    const author = r.authorAr
      ? (isAr ? ` — أ. ${r.authorAr}` : ` — ${r.authorAr}`)
      : '';
    return `• [${kind}] ${displayTitle(r)}${author}`;
  });
  const tip = isAr
    ? 'يمكنك رفع أحد هذه الملفات في المحادثة لخطة درس / ورقة عمل أدق.'
    : 'Attach one of these PDFs in chat for a tighter lesson plan / worksheet.';
  return [header, ...lines, tip].join('\n');
}

/** Compact block for KB chat / generator grounding. */
export function buildSupportResourcesContext(
  query: string,
  lessons: KBLesson[],
  lang: 'ar' | 'en',
  limit = 4,
): string {
  const lesson = lessons[0] ?? null;
  const hits = searchSupportResources({ query, lesson, limit });
  // The widened retry drops the lesson to match on the query alone — but
  // dropping the lesson also dropped the subject it implied, and
  // `detectSubjectFromQuery` only knows maths and chemistry. A
  // financial-literacy lesson therefore came back through this path with
  // chemistry activity books attached. Widen the match, not the subject.
  const subjectId = lesson ? getBookForLesson(lesson)?.subjectId ?? null : null;
  const resources = hits.length
    ? hits
    : searchSupportResources({ query, limit, subjectId });
  return formatSupportResourcesBlock(resources, lang);
}

export function listAllSupportResources(): SupportResource[] {
  return [...RESOURCES];
}

export function supportResourcesStats(): {
  total: number;
  byKind: Record<string, number>;
  bySubject: Record<string, number>;
} {
  const byKind: Record<string, number> = {};
  const bySubject: Record<string, number> = {};
  for (const r of RESOURCES) {
    byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
    bySubject[r.subjectId] = (bySubject[r.subjectId] ?? 0) + 1;
  }
  return { total: RESOURCES.length, byKind, bySubject };
}
