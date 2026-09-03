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
 * what is missing.
 *
 * **This is now load-bearing.** It used to be a note to ourselves that nothing
 * read at runtime. On 2026-08-25 it absorbed
 * `artifacts/mobile/data/g10_{math,chem}_support_resources.json` — a second
 * catalog of the same 66 PDFs, with its own id space and its own type
 * vocabulary — and `bank.ts` now serves the app's support-resource search from
 * here. The two had already drifted in ways that reached teachers: all ten
 * past exam papers were typed `quiz`, five of them tagged `remedial`, and
 * three entries pointed at copies this file marks `duplicate` (including both
 * chemistry student books, in their downsampled re-compressed form). One
 * registry, so there is nothing left to drift against.
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
  /**
   * Something has been taken out of it. Deliberately coarse — `extraction`
   * says precisely what. A document can have its text extracted and no
   * objectives mined, or (as with every book here before 2026-08-25) the
   * reverse: objectives transcribed by eye with no machine-readable text.
   */
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
  /**
   * Google Drive file id — the durable handle for anything that came through
   * Drive, since titles get renamed. Absent on sources handed over as local
   * files instead (the 2026-09-03 physics / biology / earth-science / Arabic
   * intake): they have no Drive handle, and inventing one would make
   * `driveUrl` hand out a link that 404s.
   */
  driveId?: string;
  /** Filename exactly as it appears in Drive, so it can be found by search. */
  title: string;
  bytes: number;
  /**
   * Name of the file on disk under `localRoot`. Usually identical to `title`,
   * but not always: a few files were downloaded twice and carry the Windows
   * « (1)» suffix on disk while Drive holds the clean name.
   */
  filename: string;
  /**
   * The teacher who wrote it, or `null` for NCCD — it publishes as an
   * institution, and every personal author previously recorded against one of
   * its documents turned out to be a filename-parsing artefact.
   */
  authorAr: string | null;
  /**
   * Curriculum scope, in the bank's own tag namespace (`s1-u2`, `chem-s2-u4`,
   * `s1`, …) rather than catalog unit ids — unit ids are book-local, so every
   * book has a `u1` and matching on them would attach a maths worksheet to a
   * chemistry unit 1. `BANK_UNIT_TAGS` lists the vocabulary.
   */
  unitTags: string[];
  /**
   * Objective-level anchoring — the granularity exam generation and coverage
   * actually speak (`evaluations.objectiveIds`). **Empty on every entry
   * today**, because nothing has been mined this finely yet, and an empty list
   * is the honest way to say so. Never populate it by expanding a unit tag: a
   * unit is not an objective, and a wrong anchor here becomes a wrong claim
   * about what an exam covers.
   */
  objectiveIds: string[];
  /**
   * Free-text search terms that are not already carried by `kind`, `subject`
   * or `unitTags`. Kept deliberately thin: the absorbed catalog's keyword
   * lists were mostly copies of its own tags, which is how the string
   * `remedial` came to sit on all eight past exam papers and score against
   * remedial queries.
   */
  keywords: string[];
  /**
   * The machine text extraction, when one has been run.
   *
   * Absent means no page text exists for this document — most of the bank.
   * Present means `data/extracted/<id>.json` holds its pages.
   *
   * `sha256` and `localPath` record the file that was *actually read*, which
   * is not always the file this entry describes: `math-s1-student-book` on
   * disk is a 12.1 MB Adobe original against the manifest's 18.6 MB, same 150
   * pages and same publisher. `bytesDifferFromManifest` marks those rather
   * than letting two exports of one book quietly become interchangeable —
   * that assumption is what put a downsampled copy of each chemistry textbook
   * in front of teachers.
   */
  extraction?: {
    tool: string;
    extractedAt: string;
    pages: number;
    chars: number;
    localPath: string;
    sha256: string;
    bytesDifferFromManifest?: { manifest: number; local: number };
  };
  subject: 'math' | 'chemistry' | 'financial-literacy' | 'physics' | 'biology' | 'earth-science' | 'arabic' | 'islamic' | 'history' | 'english' | 'geography' | 'digital-literacy' | 'civic' | 'art' | 'vocational';
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

/** Null for a source with no Drive id — see `driveId`. */
export function driveUrl(source: CurriculumSource): string | null {
  return source.driveId ? `https://drive.google.com/file/d/${source.driveId}/view` : null;
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
