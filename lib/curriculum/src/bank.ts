/**
 * The knowledge bank — every Grade 10 source document on file, plus the rules
 * for what may be done with each one.
 *
 * `sources.ts` says what exists. This says what you are allowed to do with it,
 * and answers the questions a feature actually asks: which documents belong to
 * this lesson, which of them are real exam papers, which may be quoted and
 * which may only inform a prompt.
 *
 * Three rules hold everything together, and each is here because the shape it
 * guards has already gone wrong once:
 *
 *  1. **Duplicates and conflicts never leave this module.** They are filtered
 *     in `bankItems`, the one entry point everything else is built on, so
 *     surfacing the downsampled copy of a textbook takes a deliberate reach
 *     for `G10_SOURCES`. The catalog this module replaced offered teachers
 *     both chemistry student books — the Adobe original and an iLovePDF
 *     re-compression of it — under two different titles, so its title-based
 *     de-duplication never saw them as the same book.
 *
 *  2. **Authority decides use, in one place.** `usePolicy` is the only
 *     definition of the line STATUS.md draws in prose: NCCD material may be
 *     quoted as curriculum, a teacher's worksheet may inform generation and
 *     must not be reproduced. A caller that is about to put text in front of a
 *     teacher calls `assertQuotable` and gets an exception rather than a
 *     judgement call.
 *
 *  3. **`kind` is the vocabulary.** There is no second type namespace. The
 *     absorbed mobile catalog had one, and in it every past exam paper was a
 *     `quiz` — indistinguishable from a practice sheet, which is why ten real
 *     Jordanian test papers sat in the product invisible to the one feature
 *     that most wants them.
 */
import { bankTagsForParsedUnit, parseUnitKbId } from './curriculumIds.ts';
import {
  G10_SOURCES,
  type CurriculumSource,
  type SourceAuthority,
  type SourceKind,
} from './sources.ts';

/**
 * What a caller may do with a document's content.
 *
 * Deliberately two values, not a score. "How much do we trust this" invites a
 * threshold nobody can defend; "may this text be reproduced" has an answer.
 */
export type BankUsePolicy =
  /** NCCD-published. May be quoted as curriculum, with attribution. */
  | 'quotable'
  /**
   * Someone else's work. May be read to inform generation — its difficulty,
   * its phrasing conventions, which objectives it emphasises — and must never
   * be emitted verbatim into anything a teacher exports.
   */
  | 'reference-only';

/** The `subject` values the manifest uses, mapped to the app's `subjectId`. */
export const BANK_SUBJECT_IDS: Record<CurriculumSource['subject'], string> = {
  math: 'mathematics',
  chemistry: 'chemistry',
  'financial-literacy': 'financial-literacy',
  physics: 'physics',
  biology: 'biology',
  'earth-science': 'earth-science',
  arabic: 'arabic',
  islamic: 'islamic',
  history: 'history',
};

export function appSubjectId(subject: CurriculumSource['subject']): string {
  return BANK_SUBJECT_IDS[subject];
}

/**
 * Whether a tag names a single unit rather than a whole semester or subject.
 *
 * The distinction is what keeps a lesson's shelf useful. `math-s1-student-book`
 * is scoped `s1` and so matches all eighteen Semester 1 lessons; a worksheet on
 * أوتار الدائرة is scoped `s1-u2` and matches four. Ranking or grouping them
 * together buries the four under the eighteen.
 *
 * `s1-matrices` is the one unit tag that does not carry a number — the
 * matrices material is scoped by name because the catalog does not number that
 * unit. It was previously classed as semester-wide by an inlined
 * `tag.includes('-u')` check, which is the reason this lives in one place now.
 */
export function isUnitScopedTag(tag: string): boolean {
  return /-u\d+$/.test(tag) || tag === 's1-matrices';
}

/** Every unit tag in use, sorted. The vocabulary a lesson must map onto to match. */
export const BANK_UNIT_TAGS: string[] = [
  ...new Set(G10_SOURCES.flatMap(s => s.unitTags)),
].sort();

/**
 * Catalog unit id → the bank tags a document must carry to belong to it.
 *
 * Every NCCD unit id has the shape `kbu-{subject}-s{semester}-nccd-u{n}`, which
 * is all the information the bank tag namespace needs. Deriving the tags from
 * the id rather than listing them means a new unit is scoped the moment it is
 * added to the catalog.
 *
 * This exists because the app was matching chemistry units by hand against ids
 * from an older scheme — `unit.id === 'kbu-chem-1'`, which no unit has had for
 * some time. Those five branches were dead, so chemistry unit tags came only
 * from title keywords, and **ten of the seventeen chemistry lessons resolved to
 * no unit tag at all** (all of units 2, 4 and 5). Their shelves and their chat
 * grounding saw only semester-wide material. «التفاعلات الكيميائية» missing
 * `/تفاعلات كيمي/` — the definite article falls between the two words — is the
 * kind of near-miss that makes title matching the wrong primary mechanism.
 *
 * Returns the unit tag first, then the semester tag. Financial literacy gets
 * only a semester tag: the bank holds no unit-level material for it, so
 * emitting `finlit-s1-u1` would invent a tag nothing can carry.
 */
export function bankTagsForUnit(unitId: string): string[] {
  // The id shape and the tag vocabulary both live in `curriculumIds.ts` now —
  // this function used to carry its own copy of the unit-id regex, and there
  // were two more (the API server's grounding, the app's kbContext). Adding a
  // grade segment to a pattern held in three places is two chances to update
  // only two of them.
  const parsed = parseUnitKbId(unitId);
  return parsed ? bankTagsForParsedUnit(parsed) : [];
}

/** Documents scoped to a catalog unit, by its id. */
export function itemsForUnit(unitId: string, filter: BankFilter = {}): CurriculumSource[] {
  return itemsForUnitTags(bankTagsForUnit(unitId), filter);
}

/**
 * Whether this document's content may be reproduced.
 *
 * `third-party` is grouped with `teacher` rather than given a third value:
 * both are "not ours to reprint", and the provenance difference between them
 * is already recorded in `authority` for anyone who needs it.
 */
export function usePolicy(item: Pick<CurriculumSource, 'authority'>): BankUsePolicy {
  return item.authority === 'nccd' ? 'quotable' : 'reference-only';
}

/**
 * Throw unless this document's content may be reproduced.
 *
 * Call it on the export path — a worksheet PDF, a printed exam, anything a
 * teacher walks out of the building with. The point is that reproducing a
 * named teacher's paper should be impossible to do by forgetting, in the same
 * way that `verified` is not settable from a fallback.
 */
export function assertQuotable(item: CurriculumSource): void {
  if (usePolicy(item) === 'quotable') return;
  throw new Error(
    `Bank item ${item.id} is reference-only (authority: ${item.authority})`
      + (item.authorAr ? ` — written by ${item.authorAr}` : '')
      + '. It may inform generation but must not be reproduced verbatim.',
  );
}

export interface BankFilter {
  subject?: CurriculumSource['subject'];
  /** App-side subject id (`mathematics`), for callers that speak that namespace. */
  subjectId?: string | null;
  semester?: 1 | 2;
  kind?: SourceKind | readonly SourceKind[];
  authority?: SourceAuthority;
  /** Match any of these unit tags. */
  unitTags?: readonly string[];
  /** Include `pending` documents — those nothing has been extracted from yet. */
  includePending?: boolean;
}

function matches(s: CurriculumSource, f: BankFilter): boolean {
  if (f.subject !== undefined && s.subject !== f.subject) return false;
  if (f.subjectId != null && appSubjectId(s.subject) !== f.subjectId) return false;
  if (f.semester !== undefined && s.semester !== f.semester) return false;
  if (f.authority !== undefined && s.authority !== f.authority) return false;
  if (f.kind !== undefined) {
    const kinds = typeof f.kind === 'string' ? [f.kind] : f.kind;
    if (!kinds.includes(s.kind)) return false;
  }
  if (f.unitTags?.length && !f.unitTags.some(t => s.unitTags.includes(t))) return false;
  if (f.includePending === false && s.status === 'pending') return false;
  return true;
}

/**
 * The bank, as anything outside this module should see it: duplicates and
 * unresolved conflicts already gone.
 *
 * Note what is *not* filtered — `pending`. A document nobody has extracted
 * text from is still a document a teacher can be pointed at, and 63 of the 78
 * are pending, so excluding them by default would empty the shelf.
 */
export function bankItems(filter: BankFilter = {}): CurriculumSource[] {
  return G10_SOURCES.filter(
    s => s.status !== 'duplicate' && s.status !== 'conflict' && matches(s, filter),
  );
}

/** Documents scoped to any of these unit tags. */
export function itemsForUnitTags(
  unitTags: readonly string[],
  filter: BankFilter = {},
): CurriculumSource[] {
  if (!unitTags.length) return [];
  return bankItems({ ...filter, unitTags });
}

/**
 * Real test papers — the fuel a blueprint (جدول مواصفات) is mined from.
 *
 * Nine of the ten are a named teacher's own paper and so `reference-only`: a
 * blueprint may report that three finals weighted الدائرة at 25%, and may not
 * reprint their questions. The tenth, `math-diagnostic-test`, is the ministry
 * diagnostic and is quotable — which is why this returns papers of both
 * policies and leaves the check to `usePolicy` rather than assuming.
 */
export function examPapers(filter: BankFilter = {}): CurriculumSource[] {
  return bankItems({ ...filter, kind: 'exam' });
}

/** Collections of practice items — the other retrieval source for question generation. */
export function questionBanks(filter: BankFilter = {}): CurriculumSource[] {
  return bankItems({ ...filter, kind: 'question-bank' });
}

/** Worked solutions — the richest source of misconceptions and distractors. */
export function answerKeys(filter: BankFilter = {}): CurriculumSource[] {
  return bankItems({ ...filter, kind: 'answer-key' });
}

/**
 * How much of the bank has actually been read.
 *
 * `ingested` counts documents something was extracted from. Everything else is
 * a title and a Drive id — real, on file, and not yet usable as content. The
 * distinction is the whole reason to report this rather than a single total.
 */
export function bankStats(): {
  total: number;
  usable: number;
  ingested: number;
  pending: number;
  excluded: number;
  byKind: Record<string, number>;
  bySubject: Record<string, number>;
  byPolicy: Record<BankUsePolicy, number>;
} {
  const usable = bankItems();
  const byKind: Record<string, number> = {};
  const bySubject: Record<string, number> = {};
  const byPolicy: Record<BankUsePolicy, number> = { quotable: 0, 'reference-only': 0 };
  for (const s of usable) {
    byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
    const id = appSubjectId(s.subject);
    bySubject[id] = (bySubject[id] ?? 0) + 1;
    byPolicy[usePolicy(s)] += 1;
  }
  return {
    total: G10_SOURCES.length,
    usable: usable.length,
    ingested: usable.filter(s => s.status === 'ingested').length,
    pending: usable.filter(s => s.status === 'pending').length,
    excluded: G10_SOURCES.length - usable.length,
    byKind,
    bySubject,
    byPolicy,
  };
}

// ─── Naming a document ───────────────────────────────────────────────────────

/**
 * `kind` in words a teacher reads.
 *
 * Lived in `artifacts/mobile/services/mathSupportResources.ts` until the API
 * server needed to cite a source in a prompt. Two copies of a label table is
 * how «ورقة اختبار» and «اختبار» end up meaning the same thing in two screens,
 * so it moved here — the same reason `normalizeArabic` and `bankTagsForUnit`
 * are in this package. The mobile module re-exports it; no caller changed.
 */
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

/** The one place a `kind` becomes words a teacher reads. */
export function kindLabel(kind: SourceKind, lang: 'ar' | 'en'): string {
  return lang === 'ar' ? KIND_LABEL_AR[kind] : KIND_LABEL_EN[kind];
}

const SUBJECT_LABEL_AR: Record<CurriculumSource['subject'], string> = {
  math: 'الرياضيات',
  chemistry: 'الكيمياء',
  'financial-literacy': 'الثقافة المالية',
  physics: 'الفيزياء',
  biology: 'العلوم الحياتية',
  'earth-science': 'علوم الأرض والبيئة',
  arabic: 'اللغة العربية',
  islamic: 'التربية الإسلامية',
  history: 'التاريخ',
};

const SUBJECT_LABEL_EN: Record<CurriculumSource['subject'], string> = {
  math: 'Mathematics',
  chemistry: 'Chemistry',
  'financial-literacy': 'Financial literacy',
  physics: 'Physics',
  biology: 'Biology',
  'earth-science': 'Earth and environmental science',
  arabic: 'Arabic',
  islamic: 'Islamic Studies',
  history: 'History',
};

/**
 * A document named from what it *is*, not from what its file is called.
 *
 * `title` is the filename in Drive, and half of them are unusable as a label:
 * `chem-s1-student-book` is stored as «10th grade, alchamy1st semester.pdf»,
 * English and misspelled, which is not a citation to show an Arabic-reading
 * teacher. The structured fields say the same thing correctly in either
 * language, so the label is built from those and the filename is left to
 * `displayTitle()`, whose job is finding a file rather than naming a source.
 */
export function sourceLabel(
  source: Pick<CurriculumSource, 'kind' | 'subject' | 'semester'>,
  lang: 'ar' | 'en',
): string {
  const kind = kindLabel(source.kind, lang);
  if (lang === 'ar') {
    const subject = SUBJECT_LABEL_AR[source.subject];
    const term = source.semester ? ` — الفصل ${source.semester === 1 ? 'الأول' : 'الثاني'}` : '';
    return `${kind} — ${subject}${term}`;
  }
  const subject = SUBJECT_LABEL_EN[source.subject];
  const term = source.semester ? `, semester ${source.semester}` : '';
  return `${kind} — ${subject}${term}`;
}
