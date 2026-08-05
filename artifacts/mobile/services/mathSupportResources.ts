/**
 * Grade 10 support packs (Math + Chemistry) — worksheets, quizzes, summaries,
 * remedial / official books. Catalog only; binaries under knowledge-base/.
 */

import mathCatalog from '../data/g10_math_support_resources.json' with { type: 'json' };
import chemCatalog from '../data/g10_chem_support_resources.json' with { type: 'json' };
import type { KBLesson } from './knowledgeBase.ts';
import { getBookForLesson, getUnitForLesson } from './knowledgeBase.ts';

export type SupportResourceType =
  | 'worksheet'
  | 'quiz'
  | 'answer_key'
  | 'summary'
  | 'remedial'
  | 'official_book'
  | 'support';

export type SupportResource = {
  id: string;
  titleAr: string;
  filename: string;
  type: SupportResourceType | string;
  unitTags: string[];
  authorAr?: string | null;
  sizeBytes?: number;
  keywords?: string[];
  subjectId?: string;
};

const MATH_RESOURCES = (mathCatalog as { resources: SupportResource[] }).resources.map(r => ({
  ...r,
  subjectId: r.subjectId ?? 'mathematics',
}));

const CHEM_RESOURCES = (chemCatalog as { resources: SupportResource[] }).resources.map(r => ({
  ...r,
  subjectId: r.subjectId ?? 'chemistry',
}));

const RESOURCES: SupportResource[] = [...MATH_RESOURCES, ...CHEM_RESOURCES];

const TYPE_LABEL_AR: Record<string, string> = {
  worksheet: 'ورقة عمل',
  quiz: 'اختبار / أسئلة',
  answer_key: 'إجابات',
  summary: 'ملخص',
  remedial: 'مادة علاجية / تأسيس',
  official_book: 'كتاب رسمي',
  support: 'مادة مساندة',
};

const TYPE_LABEL_EN: Record<string, string> = {
  worksheet: 'Worksheet',
  quiz: 'Quiz / items',
  answer_key: 'Answer key',
  summary: 'Summary',
  remedial: 'Remedial / foundations',
  official_book: 'Official book',
  support: 'Support material',
};

function detectSubjectFromQuery(query: string): 'mathematics' | 'chemistry' | null {
  const q = query.trim();
  if (/كيمياء|chemistry|بور|بلانك|ذرة|روابط|تفاعلات كيمي/i.test(q)) return 'chemistry';
  if (/رياضيات|math|دائرة|اقتران|مشتق|أسس والمعادلات|مثلث/i.test(q)) return 'mathematics';
  return null;
}

/** Map a KB unit id → catalog unitTags. */
export function unitTagsForLesson(lesson: KBLesson | null | undefined): string[] {
  if (!lesson) return [];
  const unit = getUnitForLesson(lesson);
  const book = getBookForLesson(lesson);
  const tags: string[] = [];
  if (!unit) return tags;

  const m = unit.id.match(/nccd-(u\d+)/i);
  if (m?.[1]) {
    const u = m[1].toLowerCase();
    if (book?.semester === 2 || /s2/i.test(unit.id)) tags.push(`s2-${u}`);
    else tags.push(`s1-${u}`);
  }

  // Chemistry KB units
  if (unit.id === 'kbu-chem-1') tags.push('chem-s1-u1');
  if (unit.id === 'kbu-chem-2') tags.push('chem-s1-u2');
  if (unit.id === 'kbu-chem-3') tags.push('chem-s1-u3');
  if (unit.id === 'kbu-chem-s2-4') tags.push('chem-s2-u4');
  if (unit.id === 'kbu-chem-s2-5') tags.push('chem-s2-u5');

  const title = `${unit.titleAr} ${lesson.titleAr}`;
  if (/مصفوف/.test(title)) tags.push('s1-matrices');
  if (/دائر/.test(title)) tags.push('s1-u2');
  if (/اشتقاق|مشتق/.test(title)) tags.push('s2-u6');
  if (/اقتران/.test(title)) tags.push('s2-u5');
  if (/أسس|معادل/.test(title)) tags.push('s1-u1');
  if (/بنية الذرة|بور|بلانك/.test(title)) tags.push('chem-s1-u1');
  if (/جدول دوري/.test(title)) tags.push('chem-s1-u2');
  if (/روابط|تساهمية|أيونية|فلزية/.test(title)) tags.push('chem-s1-u3');
  if (/تفاعلات كيمي/.test(title)) tags.push('chem-s2-u5');

  if (book?.subjectId === 'chemistry') {
    tags.push(book.semester === 2 ? 'chem-s2' : 'chem-s1');
  } else {
    if (book?.semester === 1) tags.push('s1');
    if (book?.semester === 2) tags.push('s2');
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

  if (subjectHint && r.subjectId && r.subjectId !== subjectHint) {
    // Soft penalty — still allow cross-hits if title matches strongly
    score -= 6;
  }

  for (const tag of lessonTags) {
    if (r.unitTags.includes(tag)) score += tag.includes('-u') ? 8 : 3;
  }

  if (!q) return score;

  const tokens = q
    .split(/[\s,،/]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 3);

  for (const t of tokens) {
    if (title.includes(t)) score += 4;
    if (r.keywords?.some(k => k.toLowerCase().includes(t))) score += 2;
  }

  if (/ورقة|worksheet/i.test(q) && r.type === 'worksheet') score += 5;
  if (/اختبار|quiz|أسئلة|بنك/i.test(q) && r.type === 'quiz') score += 5;
  if (/ملخص|summary|ملزمة/i.test(q) && r.type === 'summary') score += 5;
  if (/إجابات|answer/i.test(q) && r.type === 'answer_key') score += 5;
  if (/علاجي|تأسيس|فاقد|دوسية|remedial/i.test(q) && r.type === 'remedial') score += 5;
  if (/كتاب الطالب|دليل المعلم|official|كتاب الأنشطة/i.test(q) && r.type === 'official_book') {
    score += 6;
  }

  return score;
}

/** Find support PDFs relevant to a query and/or active lesson. */
export function searchSupportResources(opts: {
  query?: string;
  lesson?: KBLesson | null;
  limit?: number;
  types?: string[];
  subjectId?: string | null;
}): SupportResource[] {
  const query = opts.query ?? '';
  const lessonTags = unitTagsForLesson(opts.lesson);
  const limit = opts.limit ?? 5;
  const typeFilter = opts.types;
  const subjectHint =
    opts.subjectId
    ?? (opts.lesson ? getBookForLesson(opts.lesson)?.subjectId : null)
    ?? detectSubjectFromQuery(query);

  const ranked = RESOURCES
    .filter(r => !typeFilter?.length || typeFilter.includes(r.type))
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
    const type = isAr
      ? (TYPE_LABEL_AR[r.type] ?? r.type)
      : (TYPE_LABEL_EN[r.type] ?? r.type);
    const author = r.authorAr
      ? (isAr ? ` — أ. ${r.authorAr}` : ` — ${r.authorAr}`)
      : '';
    return `• [${type}] ${r.titleAr}${author}`;
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
  const resources = hits.length
    ? hits
    : searchSupportResources({ query, limit });
  return formatSupportResourcesBlock(resources, lang);
}

export function listAllSupportResources(): SupportResource[] {
  return [...RESOURCES];
}

export function supportResourcesStats(): {
  total: number;
  byType: Record<string, number>;
  bySubject: Record<string, number>;
} {
  const byType: Record<string, number> = {};
  const bySubject: Record<string, number> = {};
  for (const r of RESOURCES) {
    byType[r.type] = (byType[r.type] ?? 0) + 1;
    const s = r.subjectId ?? 'unknown';
    bySubject[s] = (bySubject[s] ?? 0) + 1;
  }
  return { total: RESOURCES.length, byType, bySubject };
}
