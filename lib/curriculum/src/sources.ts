/**
 * Where the curriculum data came from — the Grade 10 source documents held in
 * the project Google Drive, and what has been done with each one.
 *
 * Why this exists: the catalog says a lesson has objectives, but nothing said
 * *which* PDF they were read out of, which edition that PDF was, or which of
 * the books on hand nobody has touched yet. That gap is how the financial
 * literacy edition split survived — the S1 data in the catalog and the S2 book
 * on file are different editions of the course, and only a prose note in
 * STATUS.md said so. Here it is a field, and a test can fail on it.
 *
 * Deliberately hand-authored rather than derived from filenames. Half these
 * titles are honest human filenames ("mather exccersie book, semster 2.pdf");
 * a parser clever enough to classify those would be a parser nobody could
 * trust. Data is data.
 *
 * Refreshing it after the Drive changes: list each folder in `FOLDERS` and add
 * what is missing. Nothing here is load-bearing at runtime — no screen reads
 * it — so a stale entry costs a wrong answer to "what do we have", never a
 * broken app.
 */
import raw from './data/g10_sources.json' with { type: 'json' };

/** What kind of document this is — decides how much it can be trusted and how it gets mined. */
export type SourceKind =
  /** NCCD student textbook. The spine of a book's units and lessons. */
  | 'student-book'
  /** NCCD teacher guide. Carries the مخطَّط الوحدة objective tables and the teaching notes. */
  | 'teacher-guide'
  /** NCCD activities/experiments workbook. */
  | 'activity-book'
  /** Ministry remedial, support or learning-loss material. */
  | 'ministry-support'
  /** A teacher's own worksheet. */
  | 'worksheet'
  /** Worked solutions to a unit or worksheet — the richest misconception source. */
  | 'answer-key'
  /** A unit summary or formula sheet. */
  | 'summary'
  /** A دوسية / ملزمة — a teacher's full course pack. */
  | 'study-pack'
  /** A bank of practice questions. */
  | 'question-bank'
  /** A real test paper, ministry or teacher. */
  | 'exam';

/**
 * Who stands behind the document. This is the field that decides whether
 * something may be quoted as curriculum or only used to inform generation:
 * an objective from an NCCD guide and one inferred off a teacher's worksheet
 * are not the same evidence, and in six months nobody will remember which was
 * which unless it is written down. Same discipline as `verificationSource` on
 * a generated answer.
 */
export type SourceAuthority =
  /** Published by the National Center for Curriculum Development. */
  | 'nccd'
  /** Written by a named Jordanian teacher. Informs generation; not reproduced verbatim. */
  | 'teacher'
  /** An education site or network. Weakest provenance — verify before use. */
  | 'third-party';

export type SourceStatus =
  /** Already read into `data/iqra_curriculum_*.json`. */
  | 'ingested'
  /** On file, nothing extracted from it yet. */
  | 'pending'
  /** Byte-identical or near-identical copy of another entry. Ignore it. */
  | 'duplicate'
  /** Two files claim to be the same book and are not. Resolve before mining either. */
  | 'conflict';

export interface CurriculumSource {
  /** Stable slug used to cite this document from curriculum data. */
  id: string;
  /** Google Drive file id — the only durable handle; titles get renamed. */
  driveId: string;
  /** Filename exactly as it appears in Drive, so it can be found by search. */
  title: string;
  bytes: number;
  subject: 'math' | 'chemistry' | 'financial-literacy';
  /** null when the document spans both semesters or names none. */
  semester: 1 | 2 | null;
  kind: SourceKind;
  authority: SourceAuthority;
  status: SourceStatus;
  /** Set on a 'duplicate': the entry it copies. */
  duplicateOf?: string;
  /** Set on a 'conflict': the entry it disagrees with. */
  conflictWith?: string;
  notes?: string;
}

/** Every Grade 10 source on file, in Drive order. */
export const G10_SOURCES: CurriculumSource[] = raw.sources as CurriculumSource[];

/** Drive folder id → human name, for anyone going to look at the originals. */
export const FOLDERS: Record<string, string> = raw.folders;

/** The date the Drive listing this was written from was taken. */
export const CAPTURED_AT: string = raw.capturedAt;

export function driveUrl(source: CurriculumSource): string {
  return `https://drive.google.com/file/d/${source.driveId}/view`;
}

export function getSource(id: string): CurriculumSource | undefined {
  return G10_SOURCES.find(s => s.id === id);
}

/**
 * Sources worth reading — duplicates and unresolved conflicts excluded.
 * Extraction should iterate this, never `G10_SOURCES`, so that mining the
 * wrong edition takes a deliberate act rather than a forgotten filter.
 */
export function usableSources(
  filter: { subject?: CurriculumSource['subject']; semester?: 1 | 2; authority?: SourceAuthority } = {},
): CurriculumSource[] {
  return G10_SOURCES.filter(s =>
    s.status !== 'duplicate'
    && s.status !== 'conflict'
    && (filter.subject === undefined || s.subject === filter.subject)
    && (filter.semester === undefined || s.semester === filter.semester)
    && (filter.authority === undefined || s.authority === filter.authority));
}

/** Books on file that nothing has been extracted from — the coverage backlog. */
export function pendingSources(): CurriculumSource[] {
  return G10_SOURCES.filter(s => s.status === 'pending');
}

/** Files that disagree about what book they are. Each one is a decision owed. */
export function conflicts(): CurriculumSource[] {
  return G10_SOURCES.filter(s => s.status === 'conflict');
}
