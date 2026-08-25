/**
 * What the knowledge bank holds for one lesson.
 *
 * The lesson page already shows what the curriculum *says* — objectives, key
 * terms, outcomes. This is what the library *has*: the worksheets, past papers,
 * answer keys and دوسيات on file for the unit this lesson sits in, correctly
 * typed and attributed.
 *
 * Two decisions carry the whole thing.
 *
 * **Scope, not relevance.** `searchSupportResources` ranks and takes a top-N —
 * right for a chat reply, wrong for a shelf, where a teacher wants to see
 * everything there is and count it. This filters by tag instead and returns all
 * of it.
 *
 * **Unit-scoped and semester-scoped are shown apart.** `math-s1-student-book`
 * is tagged `s1` and so belongs to all eighteen Semester 1 lessons; a worksheet
 * on أوتار الدائرة is tagged `s1-u2` and belongs to four. Mixed together, every
 * lesson's shelf looks the same — around twenty items, mostly the textbook and
 * the ministry remedial packs — and the four that are actually about this
 * lesson are lost in it. Split by `isUnitScopedTag`, the shelf leads with what
 * is specific and keeps the semester-wide material as a second, quieter list.
 *
 * Pure TypeScript, no React: the screen renders it, this decides it, and the
 * tests can run it. Same split as `lessonPrep.ts`.
 */
import { isUnitScopedTag, type SourceKind } from '@workspace/curriculum';
import { getBookForLesson, getLessonById as getKbLesson } from './knowledgeBase.ts';
import {
  listAllSupportResources,
  unitTagsForLesson,
  type SupportResource,
} from './mathSupportResources.ts';

/**
 * How closely a document belongs to this lesson.
 *  unit     — scoped to the lesson's own unit. The shelf leads with these.
 *  semester — scoped to the whole semester or subject. Real, but not specific.
 */
export type ShelfScope = 'unit' | 'semester';

export type ShelfGroup = {
  kind: SourceKind;
  items: SupportResource[];
};

export type LessonShelf = {
  lessonId: string;
  /** Localised lesson title, for the header and for an "ask about this" hand-off. */
  topic: string;
  /** The bank tags this lesson resolved to. Empty means nothing can match. */
  unitTags: string[];
  unit: ShelfGroup[];
  semester: ShelfGroup[];
  /** Every document on the shelf, both scopes. */
  total: number;
  /**
   * How many may not be reproduced. Surfaced as a count so the teacher is told
   * once, at the top, rather than per row — most of the bank is a named
   * teacher's own work and saying so eleven times reads as a warning about
   * something being wrong.
   */
  referenceOnly: number;
};

/**
 * Kinds in the order a teacher reaches for them when preparing a lesson.
 *
 * Worksheets first because that is what a lesson needs tomorrow morning; past
 * papers and question banks next because they are what the app could not
 * distinguish until the two catalogs were merged; the official books last
 * because a teacher already owns those and does not need the app to find them.
 */
const KIND_ORDER: readonly SourceKind[] = [
  'worksheet',
  'question-bank',
  'exam',
  'answer-key',
  'summary',
  'study-pack',
  'ministry-support',
  'activity-book',
  'student-book',
  'teacher-guide',
];

function group(items: SupportResource[]): ShelfGroup[] {
  const byKind = new Map<SourceKind, SupportResource[]>();
  for (const item of items) {
    const list = byKind.get(item.kind);
    if (list) list.push(item);
    else byKind.set(item.kind, [item]);
  }
  const out: ShelfGroup[] = [];
  for (const kind of KIND_ORDER) {
    const list = byKind.get(kind);
    if (!list?.length) continue;
    // Newest-looking first would need a date nobody recorded; alphabetical by
    // Arabic title at least makes the order stable between renders.
    list.sort((a, b) => a.titleAr.localeCompare(b.titleAr, 'ar'));
    out.push({ kind, items: list });
  }
  // A kind missing from KIND_ORDER would silently vanish. Nothing should be
  // missing — the list covers every SourceKind — but a new kind added to the
  // manifest later must not disappear from the shelf without anyone noticing.
  for (const [kind, list] of byKind) {
    if (!KIND_ORDER.includes(kind)) out.push({ kind, items: list });
  }
  return out;
}

/**
 * Build the shelf for a lesson, or `null` when the id names no lesson.
 *
 * An empty shelf (`total: 0`) is a real answer, not a failure: a chemistry
 * lesson whose unit has no teacher material, or any financial-literacy lesson,
 * legitimately has nothing on file. The caller renders the difference.
 */
export function buildLessonShelf(lessonId: string, lang: 'ar' | 'en' = 'ar'): LessonShelf | null {
  const lesson = getKbLesson(lessonId);
  if (!lesson) return null;

  const unitTags = unitTagsForLesson(lesson);
  const topic = lang === 'ar' ? lesson.titleAr : (lesson.titleEn || lesson.titleAr);

  const unitTagSet = new Set(unitTags.filter(isUnitScopedTag));
  const broadTagSet = new Set(unitTags.filter(t => !isUnitScopedTag(t)));

  // Subject is checked here as well as being baked into the tag namespace.
  // Matching on tags alone would be correct only for as long as two separate
  // invariants hold — that a lesson emits no other subject's tag, and that no
  // document carries one. Both are tested, and both have been broken before.
  const subjectId = getBookForLesson(lesson)?.subjectId ?? null;

  const unitItems: SupportResource[] = [];
  const semesterItems: SupportResource[] = [];

  for (const r of listAllSupportResources()) {
    if (subjectId && r.subjectId !== subjectId) continue;
    // Unit scope wins: a document tagged both `s1-u2` and `s1` is about the
    // circle unit and belongs at the top, not in the semester-wide list.
    if (r.unitTags.some(t => unitTagSet.has(t))) unitItems.push(r);
    else if (r.unitTags.some(t => broadTagSet.has(t))) semesterItems.push(r);
  }

  const all = [...unitItems, ...semesterItems];
  return {
    lessonId,
    topic,
    unitTags,
    unit: group(unitItems),
    semester: group(semesterItems),
    total: all.length,
    referenceOnly: all.filter(r => r.usePolicy === 'reference-only').length,
  };
}

/**
 * The message that hands a document to chat.
 *
 * Chat is the only thing that can currently *do* anything with a bank
 * document: `buildSupportResourcesContext` already grounds a reply on these
 * titles. The shelf names the file, and this is the way through to using it —
 * which matters because the app cannot hand over the PDF itself — the binaries
 * are gitignored, as the README in each `knowledge-base` subject folder says.
 */
export function askAboutResourceMessage(
  resource: SupportResource,
  topic: string,
  lang: 'ar' | 'en',
): string {
  return lang === 'ar'
    ? `بالاستفادة من «${resource.titleAr}»، ساعدني في التحضير لدرس: ${topic}`
    : `Using "${resource.titleAr}", help me prepare the lesson: ${topic}`;
}
