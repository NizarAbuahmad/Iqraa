/**
 * The curriculum catalog — grades, subjects, books, units, lessons.
 *
 * Lives in `@workspace/curriculum` rather than the mobile app because the API
 * server must resolve learning objectives server-side: evaluation questions are
 * generated and graded against objectives, and neither may depend on what a
 * client claims the curriculum says.
 *
 * `artifacts/mobile/services/curriculumData.ts` re-exports this file, so mobile
 * call sites import it at the same path they always have.
 */
import {
  buildNccdSem1BrowserCatalog,
  isNccdSem1TitleOnlyLesson,
  isNccdSem1TitleOnlyUnit,
} from './catalogs/g10MathSem1.ts';
import {
  CHEM_S1_CURRICULUM_BOOK_ID,
  buildChemSem1BrowserCatalog,
} from './catalogs/g10ChemSem1.ts';
import {
  buildPhysSem1BrowserCatalog,
  PHYS_S1_CURRICULUM_BOOK_ID,
} from './catalogs/g10PhysSem1.ts';
import {
  buildPhysSem2BrowserCatalog,
  PHYS_S2_CURRICULUM_BOOK_ID,
} from './catalogs/g10PhysSem2.ts';
import {
  buildEarthSem1BrowserCatalog,
  EARTH_S1_CURRICULUM_BOOK_ID,
} from './catalogs/g10EarthSem1.ts';
import {
  buildEarthSem2BrowserCatalog,
  EARTH_S2_CURRICULUM_BOOK_ID,
} from './catalogs/g10EarthSem2.ts';
import {
  buildBioSem1BrowserCatalog,
  BIO_S1_CURRICULUM_BOOK_ID,
} from './catalogs/g10BioSem1.ts';
import {
  buildBioSem2BrowserCatalog,
  BIO_S2_CURRICULUM_BOOK_ID,
} from './catalogs/g10BioSem2.ts';
import {
  CHEM_S2_CURRICULUM_BOOK_ID,
  buildChemSem2BrowserCatalog,
} from './catalogs/g10ChemSem2.ts';
import { buildNccdSem2BrowserCatalog } from './catalogs/g10MathSem2.ts';
import {
  FINLIT_S1_CURRICULUM_BOOK_ID,
  buildFinlitSem1BrowserCatalog,
} from './catalogs/g10FinlitSem1.ts';
import {
  ARABIC_S1_CURRICULUM_BOOK_ID,
  buildArabicSem1BrowserCatalog,
} from './catalogs/g10ArabicSem1.ts';
import {
  ARABIC_S2_CURRICULUM_BOOK_ID,
  buildArabicSem2BrowserCatalog,
} from './catalogs/g10ArabicSem2.ts';
import {
  ISLAMIC_S1_CURRICULUM_BOOK_ID,
  buildIslamicSem1BrowserCatalog,
} from './catalogs/g10IslamicSem1.ts';
import {
  ISLAMIC_S2_CURRICULUM_BOOK_ID,
  buildIslamicSem2BrowserCatalog,
} from './catalogs/g10IslamicSem2.ts';
import {
  G9_MATH_S1_CURRICULUM_BOOK_ID,
  buildG9MathSem1BrowserCatalog,
  isG9MathSem1TitleOnlyUnit,
  isG9MathSem1TitleOnlyLesson,
} from './catalogs/g9MathSem1.ts';
import {
  G9_MATH_S2_CURRICULUM_BOOK_ID,
  buildG9MathSem2BrowserCatalog,
  isG9MathSem2TitleOnlyUnit,
  isG9MathSem2TitleOnlyLesson,
} from './catalogs/g9MathSem2.ts';
import {
  ENGLISH_COMMERCE_S1_CURRICULUM_BOOK_ID,
  ENGLISH_AGRICULTURE_S1_CURRICULUM_BOOK_ID,
  ENGLISH_HOSPITALITY_S1_CURRICULUM_BOOK_ID,
  ENGLISH_INDUSTRY_S1_CURRICULUM_BOOK_ID,
  buildEnglishCommerceBrowserCatalog,
  buildEnglishAgricultureBrowserCatalog,
  buildEnglishHospitalityBrowserCatalog,
  buildEnglishIndustryBrowserCatalog,
} from './catalogs/g10EnglishVocational.ts';

export interface Grade {
  id: string;
  name: string;
  nameAr: string;
  level: number;
}

export interface Subject {
  id: string;
  name: string;
  nameAr: string;
  icon: string;
  color: string;
  grades: string[];
}

export interface Book {
  id: string;
  title: string;
  titleAr: string;
  subjectId: string;
  gradeId: string;
  academicYear: string;
  language: string;
  edition: string;
  hasKnowledgeBase?: boolean; // true = sourced from uploaded PDF
  /** Who can see this book. Defaults to 'all' if omitted. */
  audience?: 'teacher' | 'student' | 'all';
  /** Semester number when this book represents a semester (investor demo path). */
  semester?: 1 | 2;
  /** Official NCCD student-book PDF. Links verified 2026-08-23. */
  pdfUrl?: string;
  /** Teacher-guide / teacher's-book PDF. Hidden from students. NCCD-hosted
   *  unless `downloadNote` says otherwise. */
  guidePdfUrl?: string;
  /** Companion activity/workbook PDF, shown as its own chip (distinct from
   *  the teacher guide — this one is visible to everyone). */
  activityPdfUrl?: string;
  /**
   * Source note shown under the download chips instead of the default
   * "من موقع المركز الوطني لتطوير المناهج" line. Set it whenever the linked
   * PDFs are NOT hosted on nccd.gov.jo, so the UI never claims NCCD
   * provenance for a file that isn't theirs (the English vocational books
   * are York Press titles NCCD doesn't publish).
   */
  downloadNote?: string;
  downloadNoteAr?: string;
}

export interface Unit {
  id: string;
  bookId: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  order: number;
}

export interface Lesson {
  id: string;
  unitId: string;
  title: string;
  titleAr: string;
  estimatedDuration: number;
  objectives: string[];
  objectivesAr: string[];
  keywords: string[];
  keywordsAr: string[];
  teacherNotes: string;
  teacherNotesAr: string;
  outcomes: LearningOutcome[];
}

export interface LearningOutcome {
  id: string;
  lessonId: string;
  description: string;
  descriptionAr: string;
  bloomsLevel: 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';
  skills: string[];
}

// ─── Grades ───────────────────────────────────────────────────────────────────
export const GRADES: Grade[] = Array.from({ length: 12 }, (_, i) => ({
  id: `grade-${i + 1}`,
  name: `Grade ${i + 1}`,
  nameAr: [
    'الصف الأول', 'الصف الثاني', 'الصف الثالث', 'الصف الرابع',
    'الصف الخامس', 'الصف السادس', 'الصف السابع', 'الصف الثامن',
    'الصف التاسع', 'الصف العاشر', 'الصف الحادي عشر', 'الصف الثاني عشر',
  ][i],
  level: i + 1,
}));

// ─── Subjects ─────────────────────────────────────────────────────────────────
export const SUBJECTS: Subject[] = [
  { id: 'arabic',      name: 'Arabic',          nameAr: 'اللغة العربية',     icon: 'text',            color: '#1B6B62', grades: GRADES.map(g => g.id) },
  { id: 'english',     name: 'English',          nameAr: 'اللغة الإنجليزية', icon: 'language',        color: '#3B82F6', grades: GRADES.map(g => g.id) },
  { id: 'mathematics', name: 'Mathematics',      nameAr: 'الرياضيات',        icon: 'calculator',      color: '#8B5CF6', grades: GRADES.map(g => g.id) },
  { id: 'science',     name: 'Science',          nameAr: 'العلوم',           icon: 'flask',           color: '#10B981', grades: GRADES.slice(0, 9).map(g => g.id) },
  { id: 'physics',     name: 'Physics',          nameAr: 'الفيزياء',         icon: 'nuclear',         color: '#0EA5E9', grades: GRADES.slice(9).map(g => g.id) },
  { id: 'chemistry',   name: 'Chemistry',        nameAr: 'الكيمياء',         icon: 'beaker',          color: '#F97316', grades: GRADES.slice(9).map(g => g.id) },
  { id: 'biology',     name: 'Biology',          nameAr: 'الأحياء',          icon: 'leaf',            color: '#22C55E', grades: GRADES.slice(9).map(g => g.id) },
  { id: 'islamic',     name: 'Islamic Studies',  nameAr: 'التربية الإسلامية',icon: 'moon',            color: '#F59E0B', grades: GRADES.map(g => g.id) },
  { id: 'social',      name: 'Social Studies',   nameAr: 'الدراسات الاجتماعية', icon: 'globe',        color: '#EC4899', grades: GRADES.slice(0, 9).map(g => g.id) },
  { id: 'computer',    name: 'Computer',         nameAr: 'الحاسوب',          icon: 'laptop-outline',  color: '#06B6D4', grades: GRADES.map(g => g.id) },
  { id: 'financial-literacy', name: 'Financial Literacy', nameAr: 'الثقافة المالية', icon: 'wallet-outline', color: '#B45309', grades: GRADES.slice(9).map(g => g.id) },
  { id: 'earth-science', name: 'Earth and Environmental Science', nameAr: 'علوم الأرض والبيئة', icon: 'earth', color: '#65A30D', grades: GRADES.slice(9).map(g => g.id) },
];

/**
 * Investor MVP curriculum lock.
 * When true, curriculum UI exposes Jordan → {validated grades} → Mathematics +
 * Chemistry → S1/S2. Full catalog data below is retained for later expansion —
 * do not delete it.
 */
export const INVESTOR_MVP_CURRICULUM = true;

/**
 * Grades allowed in the investor demo curriculum path — a set, not a single
 * grade, so a second (third, ...) grade joins the picker once it is actually
 * complete rather than replacing Grade 10. Grade 9 Math joined 2026-08-27:
 * Semester 1 Units 1, 3, 4 are lesson-level and Unit 2 has prior_knowledge;
 * Semester 2 exists but every unit is still title-only (no teacher guide for
 * it yet) — shown anyway, honestly thin rather than hidden, per known_gaps in
 * iqra_curriculum_g9_math_sem2.json.
 */
export const MVP_GRADE_IDS: readonly string[] = ['grade-10', 'grade-9'];
// Appended, never inserted: these positions are persisted as bare indices in
// formState and route URLs, so inserting shifts what a saved URL resolves to.
// 'physics' joined on 2026-09-03 with the Grade 10 S1 curriculum. Without it,
// isPickerCurriculumVisible gates every physics lesson invisible and
// getLessonById returns undefined for all of them — the book would be listed
// in MVP_BOOK_IDS while its lessons resolved to nothing.
// 'arabic', 'islamic' and 'computer' were appended on 2026-09-05 as tiles with
// no book behind any of them; the "no books" empty state they fell through to
// reads as a broken subject, not an honest one. All three came back off, and
// each returns only once it has something to open: 'arabic' the same day (both
// semesters of the student book), 'islamic' likewise (both semesters, from the
// teacher guides — the student books are still unextracted). 'computer' stays
// out: no computer-science PDF has been sourced at all. Note this is an APPEND
// — 'islamic' is back at the tail, where it was, so no existing index moves.
// `finlitCurriculum.test.ts` fails the moment a subject is offered here with
// nothing to open, and now also the reverse.
export const MVP_SUBJECT_IDS: readonly string[] = ['mathematics', 'chemistry', 'financial-literacy', 'english', 'physics', 'earth-science', 'biology', 'arabic', 'islamic'];
/** Main semester books only (guides/exercises stay in data, hidden from UI). */
export const MVP_BOOK_IDS: readonly string[] = [
  'book-math-10',
  'book-math-10-s2',
  'book-chem-10',
  'book-chem-10-s2',
  // Financial literacy is Semester 1 only — no S2 book exists in the NCCD data.
  FINLIT_S1_CURRICULUM_BOOK_ID,
  'book-math-9-s1',
  'book-math-9-s2',
  // English vocational tracks (Commerce/Agriculture/Hospitality/Industrial) —
  // Semester 1 only, no Semester 2 source on file yet.
  ENGLISH_COMMERCE_S1_CURRICULUM_BOOK_ID,
  ENGLISH_AGRICULTURE_S1_CURRICULUM_BOOK_ID,
  ENGLISH_HOSPITALITY_S1_CURRICULUM_BOOK_ID,
  ENGLISH_INDUSTRY_S1_CURRICULUM_BOOK_ID,
  // General (non-vocational) Grade 10 English — Student + Activity Book
  // download links only; unit/lesson content is still a placeholder (one
  // stub unit on S1, none on S2), shown anyway per the same
  // honestly-thin-rather-than-hidden precedent as Grade 9 Math S2 above.
  'book-english-10-s1',
  'book-english-10-s2',
  // Physics S1 — the first subject from the 2026-09-03 intake to have a
  // curriculum behind it. Appended, never inserted: these positions are
  // persisted in formState and route URLs (see CLAUDE.md on picker order).
  PHYS_S1_CURRICULUM_BOOK_ID,
  PHYS_S2_CURRICULUM_BOOK_ID,
  // Earth and Environmental Science — built 2026-09-03, same treatment as
  // physics: appended, never inserted.
  EARTH_S1_CURRICULUM_BOOK_ID,
  EARTH_S2_CURRICULUM_BOOK_ID,
  BIO_S1_CURRICULUM_BOOK_ID,
  BIO_S2_CURRICULUM_BOOK_ID,
  // Arabic — both semesters. S2 carries units 6-10, continuing S1's numbering.
  ARABIC_S1_CURRICULUM_BOOK_ID,
  ARABIC_S2_CURRICULUM_BOOK_ID,
  // Islamic Education — both semesters, sourced from the teacher guides
  // (the student books are registered but unextracted). Units restart at 1
  // each semester here, because these books do.
  ISLAMIC_S1_CURRICULUM_BOOK_ID,
  ISLAMIC_S2_CURRICULUM_BOOK_ID,
];

/**
 * MVP pickers follow the MVP arrays' order, not declaration order in
 * GRADES/SUBJECTS. Picker positions are persisted — every generator screen's
 * saved formState and route URLs carry `gradeIdx`/`subjectIdx` as bare
 * indices, and a screen opened without them falls back to index 0. Filtering
 * by declaration order meant enabling Grade 9 / English *inserted* entries at
 * the front: index 0 silently became grade-9/English, and every stored index
 * pointed one entry off (a bare-topic math URL opened as «اختبار في اللغة
 * الإنجليزية» over math questions). New grades/subjects must be APPENDED to
 * MVP_GRADE_IDS / MVP_SUBJECT_IDS so existing indices keep their meaning.
 */
function inMvpOrder<T extends { id: string }>(all: T[], mvpIds: readonly string[]): T[] {
  return mvpIds
    .map(id => all.find(item => item.id === id))
    .filter((item): item is T => item !== undefined);
}

export function getVisibleGrades(): Grade[] {
  if (!INVESTOR_MVP_CURRICULUM) return GRADES;
  return inMvpOrder(GRADES, MVP_GRADE_IDS);
}

export function getSubjectsForGrade(gradeId: string): Subject[] {
  const subjects = SUBJECTS.filter(s => s.grades.includes(gradeId));
  if (!INVESTOR_MVP_CURRICULUM) return subjects;
  if (!MVP_GRADE_IDS.includes(gradeId)) return [];
  return inMvpOrder(subjects, MVP_SUBJECT_IDS);
}

/** Grades shown in AI tools, chat, and other curriculum pickers. */
export function getPickerGrades(): Grade[] {
  return getVisibleGrades();
}

/** Subjects shown in AI tools, chat, and other curriculum pickers. */
export function getPickerSubjects(gradeId?: string): Subject[] {
  if (!INVESTOR_MVP_CURRICULUM) {
    return gradeId ? getSubjectsForGrade(gradeId) : [...SUBJECTS];
  }
  return inMvpOrder(SUBJECTS, MVP_SUBJECT_IDS);
}

/** Clamp a saved/route picker index into the current picker list. */
export function resolvePickerIndex(
  raw: string | number | undefined,
  length: number,
  fallback = 0,
): number {
  if (length <= 0) return 0;
  const n = typeof raw === 'string' ? parseInt(raw, 10) : raw;
  if (n == null || !Number.isFinite(n) || n < 0 || n >= length) return fallback;
  return n;
}

/** True when a subject/grade pair is allowed in investor-facing pickers. */
export function isPickerCurriculumVisible(subjectId: string, gradeId: string): boolean {
  if (!INVESTOR_MVP_CURRICULUM) return true;
  return MVP_GRADE_IDS.includes(gradeId)
    && (MVP_SUBJECT_IDS as readonly string[]).includes(subjectId);
}

// ─── Books ────────────────────────────────────────────────────────────────────
export const BOOKS: Book[] = [
  // ── Grade 10 — sourced from uploaded PDFs ──────────────────────────────────
  {
    id: 'book-chem-10',
    title: 'Chemistry – Grade 10, Semester 1',
    titleAr: 'الكيمياء – الصف العاشر – الفصل الأول',
    subjectId: 'chemistry',
    gradeId: 'grade-10',
    academicYear: '2024-2025',
    language: 'Arabic',
    edition: '2nd',
    hasKnowledgeBase: true,
    audience: 'all',
    semester: 1,
    pdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/2026-2027%20book/sciences/G10/1/%D9%83%D9%8A%D9%85%D9%8A%D8%A7%D8%A1%2010%20%D8%B7%D8%A7%D9%84%D8%A8%20%D9%811.pdf',
    guidePdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/Science/Science%20date%2010.9.2023/%D8%A7%D9%84%D8%B9%D8%A7%D8%B4%D8%B1/%D9%83%D9%8A%D9%85%D9%8A%D8%A7%D8%A1/%D8%AF%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D9%85%D8%B9%D9%84%D9%85%20%D8%A7%D9%84%D9%83%D9%8A%D9%85%D9%8A%D8%A7%D8%A1%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D9%811%20.pdf',
  },
  {
    id: 'book-chem-10-s2',
    title: 'Chemistry – Grade 10, Semester 2',
    titleAr: 'الكيمياء – الصف العاشر – الفصل الثاني',
    subjectId: 'chemistry',
    gradeId: 'grade-10',
    academicYear: '2024-2025',
    language: 'Arabic',
    edition: '2nd',
    hasKnowledgeBase: true,
    audience: 'all',
    semester: 2,
    pdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/Science/2025/New%20folder/%D8%B9%D9%84%D9%88%D9%85%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D9%812%20Pdf/%D9%83%D9%8A%D9%85%D9%8A%D8%A7%D8%A1%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D9%812%20Pdf/%D9%83%D9%8A%D9%85%D9%8A%D8%A7%D8%A1%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D8%A7%D9%84%D8%AC%D8%B2%D8%A1%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%20.pdf',
    guidePdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/Science/2025/%D8%A7%D8%AF%D9%84%D8%A9%20%D8%A7%D9%84%D8%B9%D9%84%D9%88%D9%85%20%D9%85%D9%86%201-10/%D8%A7%D8%AF%D9%84%D8%A9%20%D8%A7%D9%84%D9%85%D8%B9%D9%84%D9%85%20%D8%B9%D9%84%D9%88%D9%85%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D8%AC%D8%B2%D8%A1%20%D8%AB%D8%A7%D9%86%D9%8A/%282025%29%20%D8%AF%D9%84%D9%8A%D9%84%20%D9%83%D9%8A%D9%85%D9%8A%D8%A7%D8%A1%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D8%AC%D9%802%20.pdf',
  },
  // ── Math Grade 10 – Semester 1 ─────────────────────────────────────────────
  {
    id: 'book-math-10',
    title: 'Mathematics – Grade 10, Semester 1',
    titleAr: 'الرياضيات – الصف العاشر – الفصل الأول',
    subjectId: 'mathematics',
    gradeId: 'grade-10',
    academicYear: '2024-2025',
    language: 'Arabic',
    edition: '3rd',
    hasKnowledgeBase: true,
    audience: 'all',
    semester: 1,
    pdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/2026-2027%20book/Math/G10/1/ST/2026_MT10_SE1.pdf',
    guidePdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/Math/7.12.2023/action%20pack/TE010_Book.pdf',
  },
  {
    id: 'book-math-10-guide',
    title: 'Mathematics – Grade 10, Semester 1 (Teacher Guide)',
    titleAr: 'دليل المعلم – الرياضيات – الصف العاشر – الفصل الأول',
    subjectId: 'mathematics',
    gradeId: 'grade-10',
    academicYear: '2024-2025',
    language: 'Arabic',
    edition: '3rd',
    hasKnowledgeBase: true,
    audience: 'teacher',
  },
  {
    id: 'book-math-10-exercises',
    title: 'Mathematics – Grade 10, Semester 1 (Exercise Book)',
    titleAr: 'كتاب التمارين – الرياضيات – الصف العاشر – الفصل الأول',
    subjectId: 'mathematics',
    gradeId: 'grade-10',
    academicYear: '2024-2025',
    language: 'Arabic',
    edition: '3rd',
    hasKnowledgeBase: true,
    audience: 'student',
  },
  // ── Math Grade 10 – Semester 2 ─────────────────────────────────────────────
  {
    id: 'book-math-10-s2',
    title: 'Mathematics – Grade 10, Semester 2',
    titleAr: 'الرياضيات – الصف العاشر – الفصل الثاني',
    subjectId: 'mathematics',
    gradeId: 'grade-10',
    academicYear: '2024-2025',
    language: 'Arabic',
    edition: '3rd',
    hasKnowledgeBase: true,
    audience: 'all',
    semester: 2,
    pdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/Math/2025/G10/2/MT10/SE/MT_10_SE2_web.pdf',
    guidePdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/Math/2024/%D8%A7%D9%84%D8%A7%D8%AF%D9%84%D8%A9/Grade%2010/Book10_2_Proof3_WEB.pdf',
  },
  {
    id: 'book-math-10-s2-guide',
    title: 'Mathematics – Grade 10, Semester 2 (Teacher Guide)',
    titleAr: 'دليل المعلم – الرياضيات – الصف العاشر – الفصل الثاني',
    subjectId: 'mathematics',
    gradeId: 'grade-10',
    academicYear: '2024-2025',
    language: 'Arabic',
    edition: '3rd',
    hasKnowledgeBase: true,
    audience: 'teacher',
  },
  {
    id: 'book-math-10-s2-exercises',
    title: 'Mathematics – Grade 10, Semester 2 (Exercise Book)',
    titleAr: 'كتاب التمارين – الرياضيات – الصف العاشر – الفصل الثاني',
    subjectId: 'mathematics',
    gradeId: 'grade-10',
    academicYear: '2024-2025',
    language: 'Arabic',
    edition: '3rd',
    hasKnowledgeBase: true,
    audience: 'student',
  },
  // ── Physics Grade 10 – Semester 1 ──────────────────────────────────────────
  // First subject added from the 2026-09-03 local intake, when NCCD published
  // no direct PDF link for this edition. It does now — verified 2026-09-05 by
  // downloading all six science links below and reading each title page
  // (rendered with pdftoppm for the two over the fetch tool's 100MB cap),
  // confirming subject, grade and semester all match. Every URL returned 200
  // application/pdf at that check.
  {
    id: PHYS_S1_CURRICULUM_BOOK_ID,
    title: 'Physics – Grade 10, Semester 1',
    titleAr: 'الفيزياء – الصف العاشر – الفصل الأول',
    subjectId: 'physics',
    gradeId: 'grade-10',
    academicYear: '2025-2026',
    language: 'Arabic',
    edition: '1st',
    hasKnowledgeBase: true,
    audience: 'all',
    semester: 1,
    pdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/2026-2027%20book/sciences/G10/1/%D9%81%D9%8A%D8%B2%D9%8A%D8%A7%D8%A1%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D9%81%D8%B5%D9%84%20%D8%A3%D9%88%D9%84.pdf',
    guidePdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/Science/Science%20date%2010.9.2023/%D8%A7%D9%84%D8%B9%D8%A7%D8%B4%D8%B1/%D9%81%D9%8A%D8%B2%D9%8A%D8%A7%D8%A1/%D8%AF%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D9%85%D8%B9%D9%84%D9%85%20%D9%81%D9%8A%D8%B2%D9%8A%D8%A7%D8%A1%20%D8%B9%D8%A7%D8%B4%D8%B1%20%20%D9%811%20.pdf',
    activityPdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/2026-2027%20book/sciences/G10/1/%D9%81%D9%8A%D8%B2%D9%8A%D8%A7%D8%A1%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D9%86%D8%B4%D8%A7%D8%B7%20%D9%811.pdf',
  },
  {
    id: PHYS_S2_CURRICULUM_BOOK_ID,
    title: 'Physics – Grade 10, Semester 2',
    titleAr: 'الفيزياء – الصف العاشر – الفصل الثاني',
    subjectId: 'physics',
    gradeId: 'grade-10',
    academicYear: '2025-2026',
    language: 'Arabic',
    edition: '1st',
    hasKnowledgeBase: true,
    audience: 'all',
    semester: 2,
    pdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/Science/2025/New%20folder/%D8%B9%D9%84%D9%88%D9%85%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D9%812%20Pdf/%D9%81%D9%8A%D8%B2%D9%8A%D8%A7%D8%A1%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D9%812%20Pdf/%D9%81%D9%8A%D8%B2%D9%8A%D8%A7%D8%A1%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D8%A7%D9%84%D8%AC%D8%B2%D8%A1%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A.pdf',
    guidePdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/Science/2025/%D8%A7%D8%AF%D9%84%D8%A9%20%D8%A7%D9%84%D8%B9%D9%84%D9%88%D9%85%20%D9%85%D9%86%201-10/%D8%A7%D8%AF%D9%84%D8%A9%20%D8%A7%D9%84%D9%85%D8%B9%D9%84%D9%85%20%D8%B9%D9%84%D9%88%D9%85%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D8%AC%D8%B2%D8%A1%20%D8%AB%D8%A7%D9%86%D9%8A/(2025)%20%D8%AF%D9%84%D9%8A%D9%84%20%D9%81%D9%8A%D8%B2%D9%8A%D8%A7%D8%A1%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D8%AC%D9%802.pdf',
    activityPdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/Science/2025/New%20folder/%D8%B9%D9%84%D9%88%D9%85%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D9%812%20Pdf/%D9%81%D9%8A%D8%B2%D9%8A%D8%A7%D8%A1%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D9%812%20Pdf/%D9%81%D9%8A%D8%B2%D9%8A%D8%A7%D8%A1%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D8%A7%D9%84%D8%AC%D8%B2%D8%A1%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%20%D9%86%D8%B4%D8%A7%D8%B7.pdf',
  },
  // ── Earth and Environmental Science Grade 10 ───────────────────────────────
  {
    id: EARTH_S1_CURRICULUM_BOOK_ID,
    title: 'Earth and Environmental Science – Grade 10, Semester 1',
    titleAr: 'علوم الأرض والبيئة – الصف العاشر – الفصل الأول',
    subjectId: 'earth-science',
    gradeId: 'grade-10',
    academicYear: '2025-2026',
    language: 'Arabic',
    edition: '1st',
    hasKnowledgeBase: true,
    audience: 'all',
    semester: 1,
    pdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/2026-2027%20book/sciences/G10/1/%D8%B9%D9%84%D9%88%D9%85%20%D8%A3%D8%B1%D8%B6%2010%20%D8%AC1%20%D8%B7%D8%A7%D9%84%D8%A8.pdf',
    guidePdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/Science/Science%20date%2010.9.2023/%D8%A7%D9%84%D8%B9%D8%A7%D8%B4%D8%B1/%D8%B9%D9%84%D9%88%D9%85%20%D8%A7%D9%84%D8%A3%D8%B1%D8%B6/%D8%AF%D9%84%D9%8A%D9%84%20%D8%B9%D9%84%D9%88%D9%85%20%D8%A7%D9%84%D8%A7%D8%B1%D8%B6%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D8%AC%D8%B2%D8%A1%20%D8%A3%D9%88%D9%84.pdf',
    activityPdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/2026-2027%20book/sciences/G10/1/%D8%B9%D9%84%D9%88%D9%85%20%D8%A3%D8%B1%D8%B6%2010%20%D9%86%D8%B4%D8%A7%D8%B7%20%D9%811%20.pdf',
  },
  {
    id: EARTH_S2_CURRICULUM_BOOK_ID,
    title: 'Earth and Environmental Science – Grade 10, Semester 2',
    titleAr: 'علوم الأرض والبيئة – الصف العاشر – الفصل الثاني',
    subjectId: 'earth-science',
    gradeId: 'grade-10',
    academicYear: '2025-2026',
    language: 'Arabic',
    edition: '1st',
    hasKnowledgeBase: true,
    audience: 'all',
    semester: 2,
    pdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/Science/2025/New%20folder/%D8%B9%D9%84%D9%88%D9%85%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D9%812%20Pdf/%D8%B9%D9%84%D9%88%D9%85%20%D8%A3%D8%B1%D8%B6%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D9%812%20Pdf/%D8%B9%D9%84%D9%88%D9%85%20%D8%A7%D8%B1%D8%B6%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D8%A7%D9%84%D8%AC%D8%B2%D8%A1%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%20.pdf',
    guidePdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/Science/2025/%D8%A7%D8%AF%D9%84%D8%A9%20%D8%A7%D9%84%D8%B9%D9%84%D9%88%D9%85%20%D9%85%D9%86%201-10/%D8%A7%D8%AF%D9%84%D8%A9%20%D8%A7%D9%84%D9%85%D8%B9%D9%84%D9%85%20%D8%B9%D9%84%D9%88%D9%85%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D8%AC%D8%B2%D8%A1%20%D8%AB%D8%A7%D9%86%D9%8A/(2025)%20%D8%AF%D9%84%D9%8A%D9%84%20%D8%B9%D9%84%D9%88%D9%85%20%D8%A7%D9%84%D8%A7%D8%B1%D8%B6%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D8%AC%D9%802%20.pdf',
    activityPdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/Science/2025/New%20folder/%D8%B9%D9%84%D9%88%D9%85%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D9%812%20Pdf/%D8%B9%D9%84%D9%88%D9%85%20%D8%A3%D8%B1%D8%B6%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D9%812%20Pdf/%D8%B9%D9%84%D9%88%D9%85%20%D8%A7%D8%B1%D8%B6%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D9%86%D8%B4%D8%A7%D8%B7%20%D8%AC%D9%A2%20.pdf',
  },
  // ── Biology Grade 10 ───────────────────────────────────────────────────────
  {
    id: BIO_S1_CURRICULUM_BOOK_ID,
    title: 'Biology – Grade 10, Semester 1',
    titleAr: 'العلوم الحياتية – الصف العاشر – الفصل الأول',
    subjectId: 'biology',
    gradeId: 'grade-10',
    academicYear: '2025-2026',
    language: 'Arabic',
    edition: '1st',
    hasKnowledgeBase: true,
    audience: 'all',
    semester: 1,
    pdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/2026-2027%20book/sciences/G10/1/%D8%B9%D9%84%D9%88%D9%85%20%D8%AD%D9%8A%D8%A7%D8%AA%D9%8A%D8%A9%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D9%811.pdf',
    guidePdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/Science/Science%20date%2010.9.2023/%D8%A7%D9%84%D8%B9%D8%A7%D8%B4%D8%B1/%D8%B9%D9%84%D9%88%D9%85%20%D8%AD%D9%8A%D8%A7%D8%AA%D9%8A%D8%A9/%D8%AF%D9%84%D9%8A%D9%84%20%D8%A7%D9%84%D9%85%D8%B9%D9%84%D9%85%20%D8%A7%D8%AD%D9%8A%D8%A7%D8%A1%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D9%811.pdf',
    activityPdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/2026-2027%20book/sciences/G10/1/%D9%86%D8%B4%D8%A7%D8%B7%20%D8%B9%D9%84%D9%88%D9%85%20%D8%AD%D9%8A%D8%A7%D8%AA%D9%8A%D8%A9%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D9%811.pdf',
  },
  {
    id: BIO_S2_CURRICULUM_BOOK_ID,
    title: 'Biology – Grade 10, Semester 2',
    titleAr: 'العلوم الحياتية – الصف العاشر – الفصل الثاني',
    subjectId: 'biology',
    gradeId: 'grade-10',
    academicYear: '2025-2026',
    language: 'Arabic',
    edition: '1st',
    hasKnowledgeBase: true,
    audience: 'all',
    semester: 2,
    pdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/Science/2025/New%20folder/%D8%B9%D9%84%D9%88%D9%85%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D9%812%20Pdf/%D8%B9%D9%84%D9%88%D9%85%20%D8%AD%D9%8A%D8%A7%D8%AA%D9%8A%D8%A9%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D9%812%20Pdf/%D8%B9%D9%84%D9%88%D9%85%20%D8%AD%D9%8A%D8%A7%D8%AA%D9%8A%D8%A9%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D8%A7%D9%84%D8%AC%D8%B2%D8%A1%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A.pdf',
    guidePdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/Science/2025/%D8%A7%D8%AF%D9%84%D8%A9%20%D8%A7%D9%84%D8%B9%D9%84%D9%88%D9%85%20%D9%85%D9%86%201-10/%D8%A7%D8%AF%D9%84%D8%A9%20%D8%A7%D9%84%D9%85%D8%B9%D9%84%D9%85%20%D8%B9%D9%84%D9%88%D9%85%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D8%AC%D8%B2%D8%A1%20%D8%AB%D8%A7%D9%86%D9%8A/(2025)%20%D8%AF%D9%84%D9%8A%D9%84%20%D8%A3%D8%AD%D9%8A%D8%A7%D8%A1%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D8%AC%D9%802%20.pdf',
    activityPdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/Science/2025/New%20folder/%D8%B9%D9%84%D9%88%D9%85%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D9%812%20Pdf/%D8%B9%D9%84%D9%88%D9%85%20%D8%AD%D9%8A%D8%A7%D8%AA%D9%8A%D8%A9%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D9%812%20Pdf/%D8%B9%D9%84%D9%88%D9%85%20%D8%AD%D9%8A%D8%A7%D8%AA%D9%8A%D8%A9%20%D8%B9%D8%A7%D8%B4%D8%B1%20%D8%A7%D9%84%D8%AC%D8%B2%D8%A1%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A%20%20%D9%86%D8%B4%D8%A7%D8%B7.pdf',
  },
  // ── Financial Literacy Grade 10 – Semester 1 ───────────────────────────────
  {
    id: FINLIT_S1_CURRICULUM_BOOK_ID,
    title: 'Financial Literacy – Grade 10, Semester 1',
    titleAr: 'الثقافة المالية – الصف العاشر – الفصل الأول',
    subjectId: 'financial-literacy',
    gradeId: 'grade-10',
    academicYear: '2025-2026',
    language: 'Arabic',
    edition: '1st',
    hasKnowledgeBase: true,
    audience: 'all',
    semester: 1,
    pdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/2026-2027%20book/Financial%20culture/G10/1/%D8%A7%D9%84%D8%AB%D9%82%D8%A7%D9%81%D8%A9%20%D8%A7%D9%84%D9%85%D8%A7%D9%84%D9%8A%D8%A9%2010%20%D9%811%20small%20.pdf',
  },
  // ── Arabic Grade 10 – Semester 1 ───────────────────────────────────────────
  // No pdfUrl/guidePdfUrl: the three S1 PDFs (student book, teacher guide,
  // exercise book) are on file locally and registered in g10_sources.json, but
  // no NCCD hosted URL for them has been verified. A download chip is left off
  // rather than pointed at a guessed link.
  {
    id: ARABIC_S1_CURRICULUM_BOOK_ID,
    title: 'Arabic – Grade 10, Semester 1',
    titleAr: 'اللغة العربية (العربية لغتي) – الصف العاشر – الفصل الأول',
    subjectId: 'arabic',
    gradeId: 'grade-10',
    academicYear: '2025-2026',
    language: 'Arabic',
    edition: '1st',
    hasKnowledgeBase: true,
    audience: 'all',
    semester: 1,
  },
  // ── Arabic Grade 10 – Semester 2 ───────────────────────────────────────────
  // Units 6-10, continuing S1's numbering. Same missing download link as S1.
  {
    id: ARABIC_S2_CURRICULUM_BOOK_ID,
    title: 'Arabic – Grade 10, Semester 2',
    titleAr: 'اللغة العربية (العربية لغتي) – الصف العاشر – الفصل الثاني',
    subjectId: 'arabic',
    gradeId: 'grade-10',
    academicYear: '2025-2026',
    language: 'Arabic',
    edition: '1st',
    hasKnowledgeBase: true,
    audience: 'all',
    semester: 2,
  },
  // ── Islamic Education Grade 10 – Semesters 1 & 2 ───────────────────────────
  // hasKnowledgeBase is true and honest, but note what it is built from: the
  // teacher guides. The student books are registered in g10_sources.json with
  // status `pending` and have never been extracted, so there is no student-book
  // text behind these two rows — and no verified NCCD URL either, hence no
  // download chip.
  {
    id: ISLAMIC_S1_CURRICULUM_BOOK_ID,
    title: 'Islamic Education – Grade 10, Semester 1',
    titleAr: 'التربية الإسلامية – الصف العاشر – الفصل الأول',
    subjectId: 'islamic',
    gradeId: 'grade-10',
    academicYear: '2025-2026',
    language: 'Arabic',
    edition: '1st',
    hasKnowledgeBase: true,
    audience: 'all',
    semester: 1,
  },
  {
    id: ISLAMIC_S2_CURRICULUM_BOOK_ID,
    title: 'Islamic Education – Grade 10, Semester 2',
    titleAr: 'التربية الإسلامية – الصف العاشر – الفصل الثاني',
    subjectId: 'islamic',
    gradeId: 'grade-10',
    academicYear: '2025-2026',
    language: 'Arabic',
    edition: '1st',
    hasKnowledgeBase: true,
    audience: 'all',
    semester: 2,
  },
  // ── Math Grade 9 – Semester 1 ───────────────────────────────────────────────
  // Distinct id from the pre-existing inert `book-math-9` stub below (no real
  // content, never referenced) — kept separate rather than reused so this
  // NCCD-sourced book's provenance isn't attached to that stub's history.
  {
    id: 'book-math-9-s1',
    title: 'Mathematics – Grade 9, Semester 1',
    titleAr: 'الرياضيات – الصف التاسع – الفصل الأول',
    subjectId: 'mathematics',
    gradeId: 'grade-9',
    academicYear: '2023-2024',
    language: 'Arabic',
    edition: '1st',
    hasKnowledgeBase: true,
    audience: 'all',
    semester: 1,
    // Was the "PublicationDetails" flipbook link (no raw .pdf existed as of
    // 2026-08-28); NCCD has since published one at the raw path other Grade
    // 10 subjects use. Verified 2026-09-05: downloaded the full PDF (19.3MB)
    // and read page 1 — "الرياضيات – الصف التاسع – كتاب الطالب – الفصل
    // الدراسي الأول", ISBN 978-9923-41-408-8, matching the locally-ingested
    // copy this book's units/lessons were built from.
    pdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/2026-2027%20book/Math/G9/1/ST/2026_MT09_SE1.pdf',
    guidePdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/Math/2025/MT_TE09_Book_2_3_2025.pdf',
  },
  // ── Math Grade 9 – Semester 2 ───────────────────────────────────────────────
  {
    id: 'book-math-9-s2',
    title: 'Mathematics – Grade 9, Semester 2',
    titleAr: 'الرياضيات – الصف التاسع – الفصل الثاني',
    subjectId: 'mathematics',
    gradeId: 'grade-9',
    academicYear: '2023-2024',
    language: 'Arabic',
    edition: '1st',
    hasKnowledgeBase: true,
    audience: 'all',
    semester: 2,
    // Unpublished on NCCD as of 2026-08-28 (see S1 above); published since.
    // Verified 2026-09-05: downloaded the full PDF (38.1MB) and read page 1 —
    // "الرياضيات – الصف التاسع – كتاب الطالب – الفصل الدراسي الثاني", ISBN
    // 978-9923-41-407-1, matching this book's 174-page local source exactly
    // (see iqra_curriculum_g9_math_sem2.json's source_books note).
    pdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/Math/2025/G09/2/MT09/SE/MT09_SE2_WEB.pdf',
    guidePdfUrl: 'https://www.nccd.gov.jo/EBV4.0/Root_Storage/AR/Math/2025/MT09_TE2_PRINT.pdf',
  },
  // ── Other grades ───────────────────────────────────────────────────────────
  // General (non-vocational) Grade 10 English track — Student Book + Activity
  // Book, both semesters. Split into one book per semester (matching every
  // other subject's convention) rather than one book carrying four links.
  // Provenance of the source PDFs is not confirmed NCCD — hosted on the
  // project's own storage, hence downloadNote overriding the NCCD line.
  {
    id: 'book-english-10-s1',
    title: 'English for Jordan 10',
    titleAr: 'اللغة الإنجليزية للصف العاشر',
    subjectId: 'english',
    gradeId: 'grade-10',
    academicYear: '2024-2025',
    language: 'English',
    edition: '2nd',
    audience: 'all',
    semester: 1,
    pdfUrl: 'https://pub-d9ddd8f74e734a21824518b812652124.r2.dev/%D9%83%D8%AA%D8%A7%D8%A8%20%D8%A7%D9%84%D8%B7%D8%A7%D9%84%D8%A8%20%D9%84%D9%85%D8%A7%D8%AF%D8%A9%20%D8%A7%D9%84%D9%84%D8%BA%D8%A9%20%D8%A7%D9%84%D8%A5%D9%86%D8%AC%D9%84%D9%8A%D8%B2%D9%8A%D8%A9%20%D8%A7%D9%84%D8%B5%D9%81%20%D8%A7%D9%84%D8%B9%D8%A7%D8%B4%D8%B1%20%D8%A7%D9%84%D9%81%D8%B5%D9%84%20%D8%A7%D9%84%D8%A3%D9%88%D9%84.pdf',
    activityPdfUrl: 'https://pub-d9ddd8f74e734a21824518b812652124.r2.dev/%D9%83%D8%AA%D8%A7%D8%A8%20%D8%A7%D9%84%D8%A3%D9%86%D8%B4%D8%B7%D8%A9%20%D9%84%D9%85%D8%A7%D8%AF%D8%A9%20%D8%A7%D9%84%D9%84%D8%BA%D8%A9%20%D8%A7%D9%84%D8%A5%D9%86%D8%AC%D9%84%D9%8A%D8%B2%D9%8A%D8%A9%20%D9%84%D9%84%D8%B5%D9%81%20%D8%A7%D9%84%D8%B9%D8%A7%D8%B4%D8%B1%20%D8%A7%D9%84%D9%81%D8%B5%D9%84%20%D8%A7%D9%84%D8%A3%D9%88%D9%84.pdf',
    downloadNote: 'Student Book & Activity Book · project storage copy',
    downloadNoteAr: 'كتاب الطالب وكتاب الأنشطة · نسخة على مساحة تخزين المشروع',
  },
  {
    id: 'book-english-10-s2',
    title: 'English for Jordan 10 (Semester 2)',
    titleAr: 'اللغة الإنجليزية للصف العاشر – الفصل الثاني',
    subjectId: 'english',
    gradeId: 'grade-10',
    academicYear: '2024-2025',
    language: 'English',
    edition: '2nd',
    audience: 'all',
    semester: 2,
    pdfUrl: 'https://pub-d9ddd8f74e734a21824518b812652124.r2.dev/%D9%83%D8%AA%D8%A7%D8%A8%20%D8%A7%D9%84%D8%B7%D8%A7%D9%84%D8%A8%20%D9%84%D9%85%D8%A7%D8%AF%D8%A9%20%D8%A7%D9%84%D9%84%D8%BA%D8%A9%20%D8%A7%D9%84%D8%A5%D9%86%D8%AC%D9%84%D9%8A%D8%B2%D9%8A%D8%A9%20%D8%A7%D9%84%D8%B5%D9%81%20%D8%A7%D9%84%D8%B9%D8%A7%D8%B4%D8%B1%20%D8%A7%D9%84%D9%81%D8%B5%D9%84%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A.pdf',
    activityPdfUrl: 'https://pub-d9ddd8f74e734a21824518b812652124.r2.dev/%D9%83%D8%AA%D8%A7%D8%A8%20%D8%A7%D9%84%D8%A3%D9%86%D8%B4%D8%B7%D8%A9%20%D9%84%D9%85%D8%A7%D8%AF%D8%A9%20%D8%A7%D9%84%D9%84%D8%BA%D8%A9%20%D8%A7%D9%84%D8%A5%D9%86%D8%AC%D9%84%D9%8A%D8%B2%D9%8A%D8%A9%20%D9%84%D9%84%D8%B5%D9%81%20%D8%A7%D9%84%D8%B9%D8%A7%D8%B4%D8%B1%20%D8%A7%D9%84%D9%81%D8%B5%D9%84%20%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A.pdf',
    downloadNote: 'Student Book & Activity Book · project storage copy',
    downloadNoteAr: 'كتاب الطالب وكتاب الأنشطة · نسخة على مساحة تخزين المشروع',
  },
  // ── English Grade 10 — vocational tracks (Semester 1) ──────────────────────
  // Source: Vocational English Level 2 Volume 1 (York Press/ERC, 2023),
  // one Teacher's Book per track. See g10EnglishVocational.ts and each data
  // file's meta for provenance and known gaps.
  //
  // These are York Press titles NCCD does not publish, so there is no
  // nccd.gov.jo pdfUrl to link. The guidePdfUrl links below are the team's
  // own Drive copies of each track's Teacher's Book (the exact files this
  // catalog was mined from — same driveIds as each data file's meta;
  // already shared "anyone with link" before they were linked here), and
  // downloadNote replaces the NCCD source line so the UI doesn't claim
  // NCCD provenance for them.
  {
    id: ENGLISH_COMMERCE_S1_CURRICULUM_BOOK_ID,
    title: 'English – Commerce Track, Grade 10 (Semester 1)',
    titleAr: 'اللغة الإنجليزية – القطاع التجاري – الصف العاشر – الفصل الأول',
    subjectId: 'english',
    gradeId: 'grade-10',
    academicYear: '2025-2026',
    language: 'English',
    edition: '2023',
    hasKnowledgeBase: false,
    audience: 'all',
    semester: 1,
    guidePdfUrl: 'https://drive.google.com/file/d/1IRHz4F1T5V8lsD6hrZSg5RqW_OJx9TUX/view',
    downloadNote: "Teacher's Book — Vocational English series (York Press, 2023) · copy on Google Drive",
    downloadNoteAr: 'كتاب المعلم — سلسلة Vocational English (York Press، طبعة 2023) · نسخة على Google Drive',
  },
  {
    id: ENGLISH_AGRICULTURE_S1_CURRICULUM_BOOK_ID,
    title: 'English – Agriculture Track, Grade 10 (Semester 1)',
    titleAr: 'اللغة الإنجليزية – القطاع الزراعي – الصف العاشر – الفصل الأول',
    subjectId: 'english',
    gradeId: 'grade-10',
    academicYear: '2025-2026',
    language: 'English',
    edition: '2023',
    hasKnowledgeBase: false,
    audience: 'all',
    semester: 1,
    guidePdfUrl: 'https://drive.google.com/file/d/1EJyghKdN7oi_xYyeHJWXZz1lQreAdXuc/view',
    downloadNote: "Teacher's Book — Vocational English series (York Press, 2023) · copy on Google Drive",
    downloadNoteAr: 'كتاب المعلم — سلسلة Vocational English (York Press، طبعة 2023) · نسخة على Google Drive',
  },
  {
    id: ENGLISH_HOSPITALITY_S1_CURRICULUM_BOOK_ID,
    title: 'English – Hospitality and Tourism Track, Grade 10 (Semester 1)',
    titleAr: 'اللغة الإنجليزية – قطاع الضيافة والسياحة – الصف العاشر – الفصل الأول',
    subjectId: 'english',
    gradeId: 'grade-10',
    academicYear: '2025-2026',
    language: 'English',
    edition: '2023',
    hasKnowledgeBase: false,
    audience: 'all',
    semester: 1,
    guidePdfUrl: 'https://drive.google.com/file/d/1pZbTwHj2y_lyv9MBbBTiFk7PF4mHVSbn/view',
    downloadNote: "Teacher's Book — Vocational English series (York Press, 2023) · copy on Google Drive",
    downloadNoteAr: 'كتاب المعلم — سلسلة Vocational English (York Press، طبعة 2023) · نسخة على Google Drive',
  },
  {
    id: ENGLISH_INDUSTRY_S1_CURRICULUM_BOOK_ID,
    title: 'English – Industrial/Technical Track, Grade 10 (Semester 1)',
    titleAr: 'اللغة الإنجليزية – القطاع الصناعي والتقني – الصف العاشر – الفصل الأول',
    subjectId: 'english',
    gradeId: 'grade-10',
    academicYear: '2025-2026',
    language: 'English',
    edition: '2nd',
    hasKnowledgeBase: false,
    audience: 'all',
    semester: 1,
    // The track's own Level-2 Teacher's Book ("industry english 2.pdf").
    // The lesson content above was mined from Technical English Level 1
    // instead (this file's text wouldn't extract — see the industry data
    // file's meta), so the linked book and the catalog rows differ; the
    // link is still the printed book this track's teachers hold.
    guidePdfUrl: 'https://drive.google.com/file/d/1a6j5izZzLqmHdNFNMj7Je93Uk5Fkt9ml/view',
    downloadNote: "Teacher's Book — Vocational English series (York Press, 2023) · copy on Google Drive",
    downloadNoteAr: 'كتاب المعلم — سلسلة Vocational English (York Press، طبعة 2023) · نسخة على Google Drive',
  },
  {
    id: 'book-science-8',
    title: 'Science – Grade 8',
    titleAr: 'العلوم – الصف الثامن',
    subjectId: 'science',
    gradeId: 'grade-8',
    academicYear: '2024-2025',
    language: 'Arabic',
    edition: '1st',
  },
  {
    id: 'book-arabic-9',
    title: 'Arabic Language – Grade 9',
    titleAr: 'اللغة العربية – الصف التاسع',
    subjectId: 'arabic',
    gradeId: 'grade-9',
    academicYear: '2024-2025',
    language: 'Arabic',
    edition: '4th',
  },
  {
    id: 'book-math-9',
    title: 'Mathematics – Grade 9',
    titleAr: 'الرياضيات – الصف التاسع',
    subjectId: 'mathematics',
    gradeId: 'grade-9',
    academicYear: '2024-2025',
    language: 'Arabic',
    edition: '2nd',
  },
  {
    id: 'book-phys-11',
    title: 'Physics – Grade 11',
    titleAr: 'الفيزياء – الصف الحادي عشر',
    subjectId: 'physics',
    gradeId: 'grade-11',
    academicYear: '2024-2025',
    language: 'Arabic',
    edition: '1st',
  },
];

// ─── Units ────────────────────────────────────────────────────────────────────
/** Hardcoded units; Math G10 S2 rows below are superseded by NCCD at export. */
const _HARDCODED_UNITS: Unit[] = [
  // Chemistry Grade 10 — from uploaded PDF
  {
    id: 'unit-chem-10-1',
    bookId: 'book-chem-10',
    name: 'Atomic Structure',
    nameAr: 'بنية الذرة وتركيبها',
    description: "Bohr's model, wave-mechanical model, quantum numbers, electron configuration",
    descriptionAr: 'نموذج بور، النموذج الميكانيكي الموجي، الأعداد الكمية، التوزيع الإلكتروني',
    order: 1,
  },
  {
    id: 'unit-chem-10-2',
    bookId: 'book-chem-10',
    name: 'Periodic Table and Element Properties',
    nameAr: 'الجدول الدوري وخواص العناصر',
    description: 'Periodic trends: atomic radius, ionization energy, electronegativity',
    descriptionAr: 'الخواص الدورية: نصف القطر الذري، طاقة التأين، الكهروسالبية',
    order: 2,
  },
  {
    id: 'unit-chem-10-3',
    bookId: 'book-chem-10',
    name: 'Chemical Bonding',
    nameAr: 'الروابط الكيميائية',
    description: 'Ionic, covalent (single/double/triple), sigma and pi bonds, metallic bonding',
    descriptionAr: 'الرابطة الأيونية، التساهمية (أحادية/ثنائية/ثلاثية)، رابطتا سيجما وباي، الرابطة الفلزية',
    order: 3,
  },
  {
    id: 'unit-chem-10-s2-4',
    bookId: 'book-chem-10-s2',
    name: 'Unit 4 (Semester 2)',
    nameAr: 'الوحدة الرابعة',
    description: 'Grade 10 Chemistry semester 2 — unit 4 (enrich from teacher guide / summaries)',
    descriptionAr: 'كيمياء الصف العاشر – الفصل الثاني – الوحدة الرابعة',
    order: 1,
  },
  {
    id: 'unit-chem-10-s2-5',
    bookId: 'book-chem-10-s2',
    name: 'Chemical Reactions / Unit 5',
    nameAr: 'الوحدة الخامسة – التفاعلات الكيميائية',
    description: 'Chemical reactions and related semester-2 topics',
    descriptionAr: 'التفاعلات الكيميائية وموضوعات الفصل الثاني ذات الصلة',
    order: 2,
  },

  // Math Grade 10 — Semester 1 LEGACY (superseded by NCCD JSON; not exported)
  {
    id: 'unit-math-10-1',
    bookId: 'book-math-10',
    name: 'Functions',
    nameAr: 'الاقترانات',
    description: 'Polynomial, rational, composition, inverse, and radical functions',
    descriptionAr: 'كثيرات الحدود، الاقترانات النسبية، تركيب الاقترانات، الاقتران العكسي والجذري',
    order: 1,
  },
  {
    id: 'unit-math-10-2',
    bookId: 'book-math-10',
    name: 'Analytic Geometry',
    nameAr: 'الهندسة التحليلية',
    description: 'Circles, parabolas, ellipses, and hyperbolas in the coordinate plane',
    descriptionAr: 'الدائرة، القطع المكافئ، القطع الناقص، القطع الزائد في المستوى الإحداثي',
    order: 2,
  },
  {
    id: 'unit-math-10-3',
    bookId: 'book-math-10',
    name: 'Trigonometry',
    nameAr: 'المثلثات',
    description: 'Trigonometric functions, identities, equations, and applications',
    descriptionAr: 'الدوال المثلثية، المتطابقات، المعادلات، والتطبيقات',
    order: 3,
  },
  {
    id: 'unit-math-10-8',
    bookId: 'book-math-10',
    name: 'Probability',
    nameAr: 'الاحتمال',
    description: 'Sample space, events, mutually exclusive, conditional probability',
    descriptionAr: 'فضاء العينة، الحوادث، المتنافية، الاحتمال الشرطي',
    order: 8,
  },

  // Math Grade 10 — Semester 2 LEGACY (superseded by NCCD JSON; not exported)
  {
    id: 'unit-math-10-s2-1',
    bookId: 'book-math-10-s2',
    name: 'Equations',
    nameAr: 'المعادلات',
    description: 'Special equations and systems of linear/quadratic equations',
    descriptionAr: 'معادلات خاصة وأنظمة معادلات خطية وتربيعية',
    order: 1,
  },
  {
    id: 'unit-math-10-s2-2',
    bookId: 'book-math-10-s2',
    name: 'The Circle',
    nameAr: 'الدائرة',
    description: 'Chords, arcs, angles, and the equation of a circle',
    descriptionAr: 'الأوتار والأقواس والزوايا ومعادلة الدائرة',
    order: 2,
  },
  {
    id: 'unit-math-10-s2-3',
    bookId: 'book-math-10-s2',
    name: 'Trigonometry',
    nameAr: 'حساب المثلثات',
    description: 'Trigonometric ratios, graphs, and equations',
    descriptionAr: 'النسب المثلثية وتمثيلها وحل المعادلات المثلثية',
    order: 3,
  },
  {
    id: 'unit-math-10-s2-4',
    bookId: 'book-math-10-s2',
    name: 'Applications of Trigonometry',
    nameAr: 'تطبيقات المثلثات',
    description: 'Bearings, law of sines, law of cosines, and triangle area',
    descriptionAr: 'الاتجاه من الشمال وقانونا الجيوب وجيوب التمام ومساحة المثلث',
    order: 4,
  },

  // Other books
  {
    id: 'unit-eng-10-1',
    bookId: 'book-english-10-s1',
    name: 'Communication Skills',
    nameAr: 'مهارات التواصل',
    description: 'Reading, writing, and speaking skills',
    descriptionAr: 'مهارات القراءة والكتابة والتحدث',
    order: 1,
  },
  {
    id: 'unit-sci-8-1',
    bookId: 'book-science-8',
    name: 'Matter and Its Properties',
    nameAr: 'المادة وخواصها',
    description: 'Physical and chemical properties of matter',
    descriptionAr: 'الخواص الفيزيائية والكيميائية للمادة',
    order: 1,
  },
];

// ─── Lessons ──────────────────────────────────────────────────────────────────
/** Hardcoded lessons; Math G10 S2 rows below are superseded by NCCD at export. */
const _HARDCODED_LESSONS: Lesson[] = [
  // ── Chemistry Grade 10: Atomic Structure ──────────────────────────────────
  {
    id: 'lesson-chem-1',
    unitId: 'unit-chem-10-1',
    title: "Bohr's Model of the Hydrogen Atom",
    titleAr: 'نظرية بور لذرة الهيدروجين',
    estimatedDuration: 45,
    objectives: [
      "State the postulates of Bohr's model",
      'Calculate energy levels using E = −13.6/n² eV',
      'Explain the line emission spectrum of hydrogen',
      'Distinguish between absorption and emission spectra',
    ],
    objectivesAr: [
      'يذكر مسلّمات نموذج بور',
      'يحسب مستويات الطاقة باستخدام E = −13.6/n²',
      'يفسر الطيف الخطي لانبعاث الهيدروجين',
      'يميز بين طيفَي الامتصاص والانبعاث',
    ],
    keywords: ['energy level', 'orbit', 'quantum', 'photon', 'emission spectrum', 'Bohr'],
    keywordsAr: ['مستوى الطاقة', 'مدار', 'كم', 'فوتون', 'طيف الانبعاث', 'بور'],
    teacherNotes: 'Use colored light demonstrations and spectroscopy tubes. Show hydrogen emission spectrum. Connect to everyday LED lighting.',
    teacherNotesAr: 'استخدم أنابيب الطيف لإظهار الطيف الذري. اربط الدرس بتطبيقات الليزر ومصابيح LED في الحياة اليومية.',
    outcomes: [
      { id: 'o-chem-1-1', lessonId: 'lesson-chem-1', description: 'Students explain electron transitions using energy levels', descriptionAr: 'يشرح الطلاب انتقالات الإلكترون باستخدام مستويات الطاقة', bloomsLevel: 'Understand', skills: ['Scientific reasoning'] },
      { id: 'o-chem-1-2', lessonId: 'lesson-chem-1', description: 'Students calculate the energy emitted during electron transitions', descriptionAr: 'يحسب الطلاب الطاقة المنبعثة خلال انتقالات الإلكترون', bloomsLevel: 'Apply', skills: ['Mathematical reasoning'] },
    ],
  },
  {
    id: 'lesson-chem-2',
    unitId: 'unit-chem-10-1',
    title: 'Wave-Mechanical Model of the Atom',
    titleAr: 'النموذج الميكانيكي الموجي للذرة',
    estimatedDuration: 50,
    objectives: [
      "State Heisenberg's uncertainty principle",
      'Describe the shapes of s, p, d, f orbitals',
      'Write electron configurations using Aufbau, Hund, and Pauli rules',
    ],
    objectivesAr: [
      'يذكر مبدأ هايزنبرغ للشك',
      'يصف أشكال الأفلاك s, p, d, f',
      'يكتب التوزيع الإلكتروني باستخدام مبدأ أوفباو وقاعدة هوند ومبدأ باولي',
    ],
    keywords: ['orbital', 'quantum number', 'Aufbau', "Hund's rule", 'Pauli', 'electron configuration'],
    keywordsAr: ['فلك', 'عدد كمي', 'أوفباو', 'قاعدة هوند', 'باولي', 'توزيع إلكتروني'],
    teacherNotes: 'Use 3D orbital models or interactive software. Have students practice writing configurations for the first 20 elements.',
    teacherNotesAr: 'استخدم النماذج ثلاثية الأبعاد للأفلاك. دع الطلاب يتدربون على كتابة التوزيع الإلكتروني لأول 20 عنصرًا.',
    outcomes: [
      { id: 'o-chem-2-1', lessonId: 'lesson-chem-2', description: 'Students write correct electron configurations for elements 1-36', descriptionAr: 'يكتب الطلاب التوزيعات الإلكترونية الصحيحة للعناصر 1-36', bloomsLevel: 'Apply', skills: ['Pattern recognition'] },
    ],
  },
  {
    id: 'lesson-chem-3',
    unitId: 'unit-chem-10-3',
    title: 'Ionic and Covalent Bonding',
    titleAr: 'الرابطة الأيونية والتساهمية',
    estimatedDuration: 50,
    objectives: [
      'Explain formation of ionic and covalent bonds',
      'Distinguish single, double, and triple covalent bonds',
      'Differentiate sigma (σ) and pi (π) bonds',
    ],
    objectivesAr: [
      'يفسر تكوّن الرابطتين الأيونية والتساهمية',
      'يميز بين الروابط التساهمية الأحادية والثنائية والثلاثية',
      'يفرق بين رابطة سيجما وباي',
    ],
    keywords: ['ionic bond', 'covalent bond', 'sigma bond', 'pi bond', 'single', 'double', 'triple'],
    keywordsAr: ['رابطة أيونية', 'رابطة تساهمية', 'سيجما', 'باي', 'أحادية', 'ثنائية', 'ثلاثية'],
    teacherNotes: "Use ball-and-stick models to show bond geometries. Compare H₂, O₂, N₂ as examples of single, double, triple bonds.",
    teacherNotesAr: 'استخدم نماذج الكرة والعصا لإظهار هندسة الروابط. قارن H₂ وO₂ وN₂ كأمثلة على الروابط الأحادية والثنائية والثلاثية.',
    outcomes: [
      { id: 'o-chem-3-1', lessonId: 'lesson-chem-3', description: 'Students draw Lewis structures for simple molecules', descriptionAr: 'يرسم الطلاب تراكيب لويس للجزيئات البسيطة', bloomsLevel: 'Apply', skills: ['Spatial reasoning'] },
    ],
  },
  {
    id: 'lesson-chem-s2-4',
    unitId: 'unit-chem-10-s2-4',
    title: 'Unit 4 – Semester 2',
    titleAr: 'الوحدة الرابعة – الفصل الثاني',
    estimatedDuration: 45,
    objectives: [
      'Review core ideas of Chemistry Unit 4 (Semester 2)',
      'Use official student book and Unit 4 summary for practice',
    ],
    objectivesAr: [
      'يراجع المفاهيم الأساسية للوحدة الرابعة (الفصل الثاني)',
      'يستخدم كتاب الطالب وملخص الوحدة الرابعة للتدريب',
    ],
    keywords: ['chemistry', 'unit 4', 'semester 2'],
    keywordsAr: ['كيمياء', 'الوحدة الرابعة', 'الفصل الثاني'],
    teacherNotes: 'Enrich from دليل المعلم فصل ثاني and ملخص الوحدة الرابعة.',
    teacherNotesAr: 'أثْرِ من دليل المعلم للفصل الثاني وملخص الوحدة الرابعة.',
    outcomes: [],
  },
  {
    id: 'lesson-chem-s2-5',
    unitId: 'unit-chem-10-s2-5',
    title: 'Chemical Reactions',
    titleAr: 'التفاعلات الكيميائية',
    estimatedDuration: 50,
    objectives: [
      'Classify types of chemical reactions',
      'Write and balance simple chemical equations',
    ],
    objectivesAr: [
      'يصنّف أنواع التفاعلات الكيميائية',
      'يكتب معادلات كيميائية بسيطة ويوازنها',
    ],
    keywords: ['chemical reactions', 'equations', 'reactants', 'products'],
    keywordsAr: ['تفاعلات كيميائية', 'معادلات', 'متفاعلات', 'نواتج'],
    teacherNotes: 'Use ورقة عمل التفاعلات الكيميائية and Unit 5 summary.',
    teacherNotesAr: 'استخدم ورقة عمل التفاعلات الكيميائية وملخص الوحدة الخامسة.',
    outcomes: [
      { id: 'o-chem-s2-5-1', lessonId: 'lesson-chem-s2-5', description: 'Students classify a reaction from a classroom example', descriptionAr: 'يصنّف الطلاب تفاعلاً من مثال صفي', bloomsLevel: 'Apply', skills: ['Classification'] },
    ],
  },

  // ── Math Grade 10: Functions ───────────────────────────────────────────────
  {
    id: 'lesson-math-1',
    unitId: 'unit-math-10-1',
    title: 'Polynomial Functions',
    titleAr: 'كثيرات الحدود وخصائصها',
    estimatedDuration: 45,
    objectives: [
      'Define polynomial functions and identify degree, leading coefficient',
      'Add, subtract, and multiply polynomials',
      'Divide polynomials using long division',
      'Graph polynomial functions and identify zeros',
    ],
    objectivesAr: [
      'يعرّف كثيرات الحدود ويحدد الدرجة والمعامل الرئيسي',
      'يجمع كثيرات الحدود ويطرحها ويضربها',
      'يقسم كثيرات الحدود باستخدام الطريقة الطويلة',
      'يمثل كثيرات الحدود بيانيًا ويحدد أصفارها',
    ],
    keywords: ['polynomial', 'degree', 'leading coefficient', 'zeros', 'roots', 'division'],
    keywordsAr: ['كثير الحدود', 'الدرجة', 'المعامل الرئيسي', 'الأصفار', 'الجذور', 'القسمة'],
    teacherNotes: 'Use graphing calculators or Desmos to visualize polynomial behavior. Emphasize the connection between zeros and x-intercepts.',
    teacherNotesAr: 'استخدم Desmos أو الآلة الحاسبة لتصور سلوك كثيرات الحدود. أبرز العلاقة بين الأصفار ونقاط التقاطع مع محور x.',
    outcomes: [
      { id: 'o-math-1-1', lessonId: 'lesson-math-1', description: 'Students perform operations on polynomial expressions', descriptionAr: 'يجري الطلاب العمليات الحسابية على كثيرات الحدود', bloomsLevel: 'Apply', skills: ['Algebraic manipulation'] },
      { id: 'o-math-1-2', lessonId: 'lesson-math-1', description: 'Students find zeros of polynomial functions', descriptionAr: 'يجد الطلاب أصفار كثيرات الحدود', bloomsLevel: 'Analyze', skills: ['Problem solving'] },
    ],
  },
  {
    id: 'lesson-math-2',
    unitId: 'unit-math-10-1',
    title: 'Rational Functions',
    titleAr: 'الاقترانات النسبية',
    estimatedDuration: 45,
    objectives: [
      'Define rational functions and find their domains',
      'Identify vertical and horizontal asymptotes',
      'Graph rational functions',
    ],
    objectivesAr: [
      'يعرّف الاقترانات النسبية ويجد مجالها',
      'يحدد المقاربات الرأسية والأفقية',
      'يمثل الاقترانات النسبية بيانيًا',
    ],
    keywords: ['rational function', 'domain', 'vertical asymptote', 'horizontal asymptote'],
    keywordsAr: ['اقتران نسبي', 'مجال', 'مقاربة رأسية', 'مقاربة أفقية'],
    teacherNotes: 'Stress that the denominator cannot equal zero. Use a table of values near the asymptotes to show behavior.',
    teacherNotesAr: 'ركز على أن المقام لا يمكن أن يساوي صفرًا. استخدم جدول قيم بالقرب من المقاربات لإظهار سلوك الاقتران.',
    outcomes: [
      { id: 'o-math-2-1', lessonId: 'lesson-math-2', description: 'Students determine domain and asymptotes of rational functions', descriptionAr: 'يحدد الطلاب مجال الاقترانات النسبية ومقارباتها', bloomsLevel: 'Analyze', skills: ['Analytical thinking'] },
    ],
  },
  {
    id: 'lesson-math-3',
    unitId: 'unit-math-10-1',
    title: 'Function Composition and Inverse Functions',
    titleAr: 'تركيب الاقترانات والاقتران العكسي',
    estimatedDuration: 50,
    objectives: [
      'Compute (f∘g)(x) and (g∘f)(x)',
      'Find the inverse function f⁻¹ algebraically',
      'Verify inverses using composition',
      'Graph radical functions and their inverses',
    ],
    objectivesAr: [
      'يحسب (f∘g)(x) و (g∘f)(x)',
      'يجد الاقتران العكسي جبريًا',
      'يتحقق من العكوس باستخدام التركيب',
      'يمثل الاقترانات الجذرية وعكوسها بيانيًا',
    ],
    keywords: ['composition', 'inverse function', 'radical', 'domain', 'reflection', 'y=x'],
    keywordsAr: ['تركيب', 'اقتران عكسي', 'جذري', 'مجال', 'انعكاس', 'y=x'],
    teacherNotes: 'Emphasize that f(f⁻¹(x)) = x. Show graphically that f⁻¹ is a reflection of f across the line y = x.',
    teacherNotesAr: 'أكد أن f(f⁻¹(x)) = x. أظهر بيانيًا أن f⁻¹ انعكاس لـ f حول المستقيم y = x.',
    outcomes: [
      { id: 'o-math-3-1', lessonId: 'lesson-math-3', description: 'Students find inverse functions and verify using composition', descriptionAr: 'يجد الطلاب الاقتران العكسي ويتحقق منه باستخدام التركيب', bloomsLevel: 'Evaluate', skills: ['Algebraic reasoning'] },
    ],
  },
  {
    id: 'lesson-math-8-1',
    unitId: 'unit-math-10-8',
    title: 'Basic Probability Concepts',
    titleAr: 'مفاهيم الاحتمال الأساسية',
    estimatedDuration: 45,
    objectives: [
      'Define sample space, events, and probability',
      'Calculate P(E) = n(E)/n(Ω)',
      'Apply complementary probability P(Ā) = 1 − P(A)',
    ],
    objectivesAr: [
      'يعرّف فضاء العينة والحوادث والاحتمال',
      'يحسب P(E) = n(E)/n(Ω)',
      'يطبق احتمال المتممة P(Ā) = 1 − P(A)',
    ],
    keywords: ['probability', 'sample space', 'event', 'complement', 'random experiment'],
    keywordsAr: ['احتمال', 'فضاء العينة', 'حادث', 'متممة', 'تجربة عشوائية'],
    teacherNotes: 'Use dice, coins, and cards as concrete probability experiments. Have students collect real data and compare experimental vs. theoretical probability.',
    teacherNotesAr: 'استخدم النرد والعملات المعدنية والبطاقات كتجارب ملموسة. اطلب من الطلاب مقارنة الاحتمال التجريبي بالنظري.',
    outcomes: [
      { id: 'o-math-8-1', lessonId: 'lesson-math-8-1', description: 'Students calculate probabilities for simple events', descriptionAr: 'يحسب الطلاب احتمالات الحوادث البسيطة', bloomsLevel: 'Apply', skills: ['Numerical reasoning'] },
    ],
  },
  {
    id: 'lesson-math-8-2',
    unitId: 'unit-math-10-8',
    title: 'Mutually Exclusive and Non-Exclusive Events',
    titleAr: 'الحوادث المتنافية وغير المتنافية',
    estimatedDuration: 45,
    objectives: [
      'Identify mutually exclusive events (A ∩ B = ∅)',
      'Apply P(A∪B) = P(A) + P(B) for mutually exclusive events',
      'Apply P(A∪B) = P(A) + P(B) − P(A∩B) for non-exclusive events',
    ],
    objectivesAr: [
      'يحدد الحوادث المتنافية (A ∩ B = ∅)',
      'يطبق P(A∪B) = P(A) + P(B) للحوادث المتنافية',
      'يطبق P(A∪B) = P(A) + P(B) − P(A∩B) للحوادث غير المتنافية',
    ],
    keywords: ['mutually exclusive', 'union', 'intersection', 'addition rule', 'Venn diagram'],
    keywordsAr: ['متنافية', 'اتحاد', 'تقاطع', 'قاعدة الجمع', 'مخطط ڤن'],
    teacherNotes: 'Use Venn diagrams extensively. Show with dice: rolling a 1 and rolling an even number are mutually exclusive; rolling even and rolling <3 are not.',
    teacherNotesAr: 'استخدم مخططات ڤن بشكل مكثف. بيّن بالنرد: ظهور 1 وظهور عدد زوجي متنافيان، بينما زوجي وأقل من 3 غير متنافيَين.',
    outcomes: [
      { id: 'o-math-8-2', lessonId: 'lesson-math-8-2', description: 'Students apply the addition rule to find P(A∪B)', descriptionAr: 'يطبق الطلاب قاعدة الجمع لإيجاد P(A∪B)', bloomsLevel: 'Apply', skills: ['Logical reasoning'] },
    ],
  },

  // ── Math Grade 10 Semester 2 LEGACY (superseded by NCCD JSON; not exported) ──
  {
    id: 'lesson-math-s2-1-1',
    unitId: 'unit-math-10-s2-1',
    title: 'Solving Special Equations',
    titleAr: 'حل معادلات خاصة',
    estimatedDuration: 45,
    objectives: [
      'Solve equations with integer exponents greater than 2 using factoring',
      'Reduce higher-degree equations to quadratic form by substitution',
      'Apply the zero-product property to find all real solutions',
    ],
    objectivesAr: [
      'يحل معادلات بأس صحيح أكبر من 2 باستخدام التحليل',
      'يحوّل معادلات أعلى درجة إلى صورة تربيعية بالتعويض',
      'يطبق خاصية الضرب الصفري لإيجاد جميع الحلول الحقيقية',
    ],
    keywords: ['factoring', 'zero-product', 'quadratic form', 'substitution'],
    keywordsAr: ['تحليل', 'ضرب صفري', 'صورة تربيعية', 'تعويض'],
    teacherNotes: 'Start with factoring out GCF, then introduce u-substitution for equations like x⁶ − 3x³ − 40 = 0.',
    teacherNotesAr: 'ابدأ بإخراج العامل المشترك، ثم قدّم التعويض u لمعادلات مثل x⁶ − 3x³ − 40 = 0.',
    outcomes: [
      { id: 'o-math-s2-1-1', lessonId: 'lesson-math-s2-1-1', description: 'Students solve special higher-degree equations', descriptionAr: 'يحل الطلاب معادلات خاصة من درجات أعلى', bloomsLevel: 'Apply', skills: ['Algebraic manipulation'] },
    ],
  },
  {
    id: 'lesson-math-s2-1-2',
    unitId: 'unit-math-10-s2-1',
    title: 'Solving a System: Linear and Quadratic Equations',
    titleAr: 'حل نظام مكون من معادلة خطية ومعادلة تربيعية',
    estimatedDuration: 45,
    objectives: [
      'Solve a linear-quadratic system by substitution',
      'Interpret 0, 1, or 2 solutions geometrically',
      'Verify solutions in both original equations',
    ],
    objectivesAr: [
      'يحل نظامًا خطيًا-تربيعيًا بطريقة التعويض',
      'يفسّر هندسيًا وجود 0 أو 1 أو 2 من الحلول',
      'يتحقق من الحلول في المعادلتين الأصليتين',
    ],
    keywords: ['system of equations', 'substitution', 'intersection'],
    keywordsAr: ['نظام معادلات', 'تعويض', 'تقاطع'],
    teacherNotes: 'Graph both curves when possible so students see tangent vs. two intersection points.',
    teacherNotesAr: 'ارسم المنحنيين متى أمكن ليرى الطلاب التماس مقابل نقطتي تقاطع.',
    outcomes: [
      { id: 'o-math-s2-1-2', lessonId: 'lesson-math-s2-1-2', description: 'Students solve linear-quadratic systems', descriptionAr: 'يحل الطلاب أنظمة خطية-تربيعية', bloomsLevel: 'Apply', skills: ['Problem solving'] },
    ],
  },
  {
    id: 'lesson-math-s2-1-3',
    unitId: 'unit-math-10-s2-1',
    title: 'Solving a System of Two Quadratic Equations',
    titleAr: 'حل نظام مكون من معادلتين تربيعيتين',
    estimatedDuration: 45,
    objectives: [
      'Solve quadratic-quadratic systems by elimination or substitution',
      'Determine the possible number of solutions (0–4)',
      'Check candidate solutions in both equations',
    ],
    objectivesAr: [
      'يحل نظامًا تربيعيًا-تربيعيًا بالطرح أو التعويض',
      'يحدد عدد الحلول الممكنة (0–4)',
      'يتحقق من الحلول المرشحة في المعادلتين',
    ],
    keywords: ['elimination', 'quadratic system', 'solutions'],
    keywordsAr: ['طرح', 'نظام تربيعي', 'حلول'],
    teacherNotes: 'When x² coefficients match, subtract first to get a linear relation, then substitute back.',
    teacherNotesAr: 'إذا تساوى معاملا x²، اطرح أولًا للحصول على علاقة خطية ثم عوّض.',
    outcomes: [
      { id: 'o-math-s2-1-3', lessonId: 'lesson-math-s2-1-3', description: 'Students solve systems of two quadratic equations', descriptionAr: 'يحل الطلاب أنظمة من معادلتين تربيعيتين', bloomsLevel: 'Analyze', skills: ['Algebraic reasoning'] },
    ],
  },
  {
    id: 'lesson-math-s2-2-1',
    unitId: 'unit-math-10-s2-2',
    title: 'Chords, Diameters, and Tangents of a Circle',
    titleAr: 'أوتار الدائرة وأقطارها ومماساتها',
    estimatedDuration: 45,
    objectives: [
      'Distinguish chord, diameter, and tangent',
      'Apply tangent ⊥ radius at the point of tangency',
      'Use equal-chord distance properties from the center',
    ],
    objectivesAr: [
      'يميّز بين الوتر والقطر والمماس',
      'يطبق عمودية المماس على نصف القطر عند نقطة التماس',
      'يستخدم خواص الأوتار المتساوية وبعدها عن المركز',
    ],
    keywords: ['chord', 'diameter', 'tangent', 'radius'],
    keywordsAr: ['وتر', 'قطر', 'مماس', 'نصف قطر'],
    teacherNotes: 'Use compass constructions so students see equal chords are equidistant from the center.',
    teacherNotesAr: 'استخدم الرسم بالفرجار ليرى الطلاب أن الأوتار المتساوية متساوية البعد عن المركز.',
    outcomes: [
      { id: 'o-math-s2-2-1', lessonId: 'lesson-math-s2-2-1', description: 'Students apply chord and tangent properties', descriptionAr: 'يطبق الطلاب خواص الأوتار والمماسات', bloomsLevel: 'Apply', skills: ['Geometric reasoning'] },
    ],
  },
  {
    id: 'lesson-math-s2-2-2',
    unitId: 'unit-math-10-s2-2',
    title: 'Arcs and Sectors of a Circle',
    titleAr: 'الأقواس والقطاعات الدائرية',
    estimatedDuration: 45,
    objectives: [
      'Compute arc length using degrees or radians',
      'Compute sector area using degrees or radians',
      'Convert between degrees and radians when needed',
    ],
    objectivesAr: [
      'يحسب طول القوس بالدرجات أو الراديان',
      'يحسب مساحة القطاع بالدرجات أو الراديان',
      'يحوّل بين الدرجات والراديان عند الحاجة',
    ],
    keywords: ['arc', 'sector', 'radian', 'arc length'],
    keywordsAr: ['قوس', 'قطاع', 'راديان', 'طول القوس'],
    teacherNotes: 'Contrast fraction-of-circumference formulas with radian forms l = rθ and A = ½r²θ.',
    teacherNotesAr: 'قارن صيغ الكسر من المحيط مع صيغ الراديان l = rθ و A = ½r²θ.',
    outcomes: [
      { id: 'o-math-s2-2-2', lessonId: 'lesson-math-s2-2-2', description: 'Students calculate arc length and sector area', descriptionAr: 'يحسب الطلاب طول القوس ومساحة القطاع', bloomsLevel: 'Apply', skills: ['Numerical reasoning'] },
    ],
  },
  {
    id: 'lesson-math-s2-2-3',
    unitId: 'unit-math-10-s2-2',
    title: 'Angles in a Circle',
    titleAr: 'الزوايا في الدائرة',
    estimatedDuration: 45,
    objectives: [
      'Relate central and inscribed angles on the same arc',
      'Apply the angle in a semicircle theorem (90°)',
      'Use equal inscribed angles on the same arc',
    ],
    objectivesAr: [
      'يربط الزاوية المركزية بالمحيطية على نفس القوس',
      'يطبق نظرية الزاوية في نصف دائرة (= 90°)',
      'يستخدم تساوي الزوايا المحيطية على نفس القوس',
    ],
    keywords: ['central angle', 'inscribed angle', 'semicircle'],
    keywordsAr: ['زاوية مركزية', 'زاوية محيطية', 'نصف دائرة'],
    teacherNotes: 'Have students measure inscribed vs. central angles on the same arc to discover the half relationship.',
    teacherNotesAr: 'اجعل الطلاب يقيسون الزاوية المحيطية والمركزية على نفس القوس لاكتشاف علاقة النصف.',
    outcomes: [
      { id: 'o-math-s2-2-3', lessonId: 'lesson-math-s2-2-3', description: 'Students apply circle-angle theorems', descriptionAr: 'يطبق الطلاب نظريات زوايا الدائرة', bloomsLevel: 'Apply', skills: ['Geometric reasoning'] },
    ],
  },
  {
    id: 'lesson-math-s2-2-4',
    unitId: 'unit-math-10-s2-2',
    title: 'Equation of a Circle',
    titleAr: 'معادلة الدائرة',
    estimatedDuration: 45,
    objectives: [
      'Write (x−h)² + (y−k)² = r² from center and radius',
      'Find center and radius by completing the square',
      'Convert between standard and general forms',
    ],
    objectivesAr: [
      'يكتب (x−h)² + (y−k)² = r² من المركز ونصف القطر',
      'يجد المركز ونصف القطر بإكمال المربع',
      'يحوّل بين الصورة القياسية والعامة',
    ],
    keywords: ['circle equation', 'center', 'radius', 'completing the square'],
    keywordsAr: ['معادلة الدائرة', 'مركز', 'نصف قطر', 'إكمال المربع'],
    teacherNotes: 'Drill completing the square on general form before asking for graphing.',
    teacherNotesAr: 'درّب إكمال المربع على الصورة العامة قبل الانتقال إلى الرسم.',
    outcomes: [
      { id: 'o-math-s2-2-4', lessonId: 'lesson-math-s2-2-4', description: 'Students write and interpret circle equations', descriptionAr: 'يكتب الطلاب معادلات الدائرة ويفسّرونها', bloomsLevel: 'Apply', skills: ['Algebraic manipulation'] },
    ],
  },
  {
    id: 'lesson-math-s2-3-1',
    unitId: 'unit-math-10-s2-3',
    title: 'Trigonometric Ratios',
    titleAr: 'النسب المثلثية',
    estimatedDuration: 45,
    objectives: [
      'Define sin, cos, and tan in a right triangle',
      'Use sin²A + cos²A = 1 and tan A = sin A / cos A',
      'Recall special values for 30°, 45°, and 60°',
    ],
    objectivesAr: [
      'يعرّف sin و cos و tan في المثلث القائم',
      'يستخدم sin²A + cos²A = 1 و tan A = sin A / cos A',
      'يستذكر القيم الخاصة لـ 30° و 45° و 60°',
    ],
    keywords: ['sine', 'cosine', 'tangent', 'right triangle'],
    keywordsAr: ['جيب', 'جيب التمام', 'ظل', 'مثلث قائم'],
    teacherNotes: 'Build a reference table for 30°/45°/60° and require students to derive, not memorize only.',
    teacherNotesAr: 'ابنِ جدولًا مرجعيًا لـ 30°/45°/60° واطلب الاشتقاق لا الحفظ فقط.',
    outcomes: [
      { id: 'o-math-s2-3-1', lessonId: 'lesson-math-s2-3-1', description: 'Students apply basic trigonometric ratios', descriptionAr: 'يطبق الطلاب النسب المثلثية الأساسية', bloomsLevel: 'Apply', skills: ['Numerical reasoning'] },
    ],
  },
  {
    id: 'lesson-math-s2-3-2',
    unitId: 'unit-math-10-s2-3',
    title: 'Trigonometric Ratios for Angles in a Full Rotation',
    titleAr: 'النسب المثلثية للزوايا ضمن الدورة الواحدة',
    estimatedDuration: 45,
    objectives: [
      'Determine signs of trig ratios by quadrant (ASTC)',
      'Find reference angles for angles in 0°–360°',
      'Evaluate trig ratios using reference angles',
    ],
    objectivesAr: [
      'يحدد إشارات النسب المثلثية حسب الربع (ASTC)',
      'يجد الزاوية المرجعية للزوايا من 0° إلى 360°',
      'يحسب النسب المثلثية باستخدام الزاوية المرجعية',
    ],
    keywords: ['quadrant', 'ASTC', 'reference angle', 'unit circle'],
    keywordsAr: ['ربع', 'ASTC', 'زاوية مرجعية', 'دائرة الوحدة'],
    teacherNotes: 'Use the unit circle wall chart; practice sin 150° and cos 240° as class openers.',
    teacherNotesAr: 'استخدم مخطط دائرة الوحدة؛ تمرّن على sin 150° و cos 240° كبداية للحصة.',
    outcomes: [
      { id: 'o-math-s2-3-2', lessonId: 'lesson-math-s2-3-2', description: 'Students evaluate trig ratios for any angle in a rotation', descriptionAr: 'يحسب الطلاب النسب المثلثية لأي زاوية في الدورة', bloomsLevel: 'Apply', skills: ['Analytical thinking'] },
    ],
  },
  {
    id: 'lesson-math-s2-3-3',
    unitId: 'unit-math-10-s2-3',
    title: 'Graphing Trigonometric Functions',
    titleAr: 'تمثيل الاقترانات المثلثية',
    estimatedDuration: 45,
    objectives: [
      'Sketch y = sin x and y = cos x over one period',
      'Identify amplitude, period, and phase shift',
      'Compare sine and cosine graphs',
    ],
    objectivesAr: [
      'يرسم y = sin x و y = cos x خلال دورة واحدة',
      'يحدد السعة والدورة وإزاحة الطور',
      'يقارن بين تمثيلي الجيب وجيب التمام',
    ],
    keywords: ['amplitude', 'period', 'phase shift', 'graph'],
    keywordsAr: ['سعة', 'دورة', 'إزاحة طور', 'تمثيل'],
    teacherNotes: 'Start from key points (0, π/2, π, 3π/2, 2π) before introducing transformations.',
    teacherNotesAr: 'ابدأ من النقاط الأساسية قبل إدخال التحويلات.',
    outcomes: [
      { id: 'o-math-s2-3-3', lessonId: 'lesson-math-s2-3-3', description: 'Students graph basic trigonometric functions', descriptionAr: 'يرسم الطلاب الاقترانات المثلثية الأساسية', bloomsLevel: 'Understand', skills: ['Graphical interpretation'] },
    ],
  },
  {
    id: 'lesson-math-s2-3-4',
    unitId: 'unit-math-10-s2-3',
    title: 'Solving Trigonometric Equations',
    titleAr: 'حل المعادلات المثلثية',
    estimatedDuration: 45,
    objectives: [
      'Solve basic trig equations on [0°, 360°]',
      'Use reference angles and quadrant signs',
      'Check extraneous or missing solutions in the interval',
    ],
    objectivesAr: [
      'يحل معادلات مثلثية أساسية على [0°, 360°]',
      'يستخدم الزاوية المرجعية وإشارات الأرباع',
      'يتحقق من الحلول الزائدة أو الناقصة في الفترة',
    ],
    keywords: ['trigonometric equation', 'general solution', 'interval'],
    keywordsAr: ['معادلة مثلثية', 'حل عام', 'فترة'],
    teacherNotes: 'Always list both solutions in a full rotation for equations like sin θ = ½.',
    teacherNotesAr: 'اذكر دائمًا الحلين في الدورة الكاملة لمعادلات مثل sin θ = ½.',
    outcomes: [
      { id: 'o-math-s2-3-4', lessonId: 'lesson-math-s2-3-4', description: 'Students solve trigonometric equations in a given interval', descriptionAr: 'يحل الطلاب معادلات مثلثية في فترة معطاة', bloomsLevel: 'Apply', skills: ['Problem solving'] },
    ],
  },
  {
    id: 'lesson-math-s2-4-1',
    unitId: 'unit-math-10-s2-4',
    title: 'Bearing (Direction from North)',
    titleAr: 'الاتجاه من الشمال',
    estimatedDuration: 45,
    objectives: [
      'Interpret three-digit bearings measured clockwise from north',
      'Draw scale diagrams for bearing word problems',
      'Solve basic navigation problems with trig ratios',
    ],
    objectivesAr: [
      'يفسّر الاتجاهات الثلاثية المقاسة من الشمال مع عقارب الساعة',
      'يرسم مخططات مقياس لمسائل الاتجاه',
      'يحل مسائل ملاحة أساسية بالنسب المثلثية',
    ],
    keywords: ['bearing', 'navigation', 'north', 'diagram'],
    keywordsAr: ['اتجاه', 'ملاحة', 'شمال', 'مخطط'],
    teacherNotes: 'Require a labeled north arrow on every diagram before computing.',
    teacherNotesAr: 'اشترط سهم شمال مسمّى على كل مخطط قبل الحساب.',
    outcomes: [
      { id: 'o-math-s2-4-1', lessonId: 'lesson-math-s2-4-1', description: 'Students solve bearing problems', descriptionAr: 'يحل الطلاب مسائل الاتجاه من الشمال', bloomsLevel: 'Apply', skills: ['Problem solving'] },
    ],
  },
  {
    id: 'lesson-math-s2-4-2',
    unitId: 'unit-math-10-s2-4',
    title: 'The Law of Sines',
    titleAr: 'قانون الجيوب',
    estimatedDuration: 45,
    objectives: [
      'Apply a/sin A = b/sin B = c/sin C',
      'Solve ASA and AAS triangles',
      'Recognize when SSA may be ambiguous',
    ],
    objectivesAr: [
      'يطبق a/sin A = b/sin B = c/sin C',
      'يحل مثلثات ASA و AAS',
      'يتعرّف متى تكون حالة SSA غامضة',
    ],
    keywords: ['law of sines', 'ASA', 'AAS', 'ambiguous case'],
    keywordsAr: ['قانون الجيوب', 'ASA', 'AAS', 'حالة غموض'],
    teacherNotes: 'Introduce the ambiguous case with one carefully chosen SSA example.',
    teacherNotesAr: 'قدّم حالة الغموض بمثال SSA واحد مختار بعناية.',
    outcomes: [
      { id: 'o-math-s2-4-2', lessonId: 'lesson-math-s2-4-2', description: 'Students apply the law of sines', descriptionAr: 'يطبق الطلاب قانون الجيوب', bloomsLevel: 'Apply', skills: ['Problem solving'] },
    ],
  },
  {
    id: 'lesson-math-s2-4-3',
    unitId: 'unit-math-10-s2-4',
    title: 'The Law of Cosines',
    titleAr: 'قانون جيوب التمام',
    estimatedDuration: 45,
    objectives: [
      'Apply a² = b² + c² − 2bc·cos A',
      'Solve SSS and SAS triangles',
      'Relate the formula to Pythagoras when A = 90°',
    ],
    objectivesAr: [
      'يطبق a² = b² + c² − 2bc·cos A',
      'يحل مثلثات SSS و SAS',
      'يربط الصيغة بنظرية فيثاغورس عندما A = 90°',
    ],
    keywords: ['law of cosines', 'SSS', 'SAS', 'Pythagoras'],
    keywordsAr: ['قانون جيوب التمام', 'SSS', 'SAS', 'فيثاغورس'],
    teacherNotes: 'Show that the cosine term vanishes at 90° to connect with prior knowledge.',
    teacherNotesAr: 'بيّن اختفاء حد جيب التمام عند 90° للربط بالمعرفة السابقة.',
    outcomes: [
      { id: 'o-math-s2-4-3', lessonId: 'lesson-math-s2-4-3', description: 'Students apply the law of cosines', descriptionAr: 'يطبق الطلاب قانون جيوب التمام', bloomsLevel: 'Apply', skills: ['Problem solving'] },
    ],
  },
  {
    id: 'lesson-math-s2-4-4',
    unitId: 'unit-math-10-s2-4',
    title: 'Area of a Triangle Using Sine',
    titleAr: 'مساحة المثلث باستعمال جيب الزاوية',
    estimatedDuration: 40,
    objectives: [
      'Apply Area = ½ab·sin C for an included angle',
      'Choose sine-area vs. ½bh appropriately',
      'Solve application problems involving triangular area',
    ],
    objectivesAr: [
      'يطبق المساحة = ½ab·sin C للزاوية المحصورة',
      'يختار صيغة الجيب أو ½bh بحسب المعطيات',
      'يحل مسائل تطبيقية على مساحة المثلث',
    ],
    keywords: ['triangle area', 'included angle', 'sine'],
    keywordsAr: ['مساحة المثلث', 'زاوية محصورة', 'جيب'],
    teacherNotes: 'Give mixed sets so students decide which area formula fits the given data.',
    teacherNotesAr: 'أعطِ مجموعات مختلطة ليقرر الطلاب أي صيغة مساحة تناسب المعطيات.',
    outcomes: [
      { id: 'o-math-s2-4-4', lessonId: 'lesson-math-s2-4-4', description: 'Students compute triangle area using sine', descriptionAr: 'يحسب الطلاب مساحة المثلث باستخدام الجيب', bloomsLevel: 'Apply', skills: ['Numerical reasoning'] },
    ],
  },

  // ── Other books ───────────────────────────────────────────────────────────
  {
    id: 'lesson-sci-1',
    unitId: 'unit-sci-8-1',
    title: 'States of Matter',
    titleAr: 'حالات المادة',
    estimatedDuration: 40,
    objectives: ['Describe solids, liquids, gases', 'Explain state changes using particle theory'],
    objectivesAr: ['يصف الصلب والسائل والغاز', 'يفسر تغيرات الحالة باستخدام نظرية الجسيمات'],
    keywords: ['solid', 'liquid', 'gas', 'particle theory', 'melting', 'boiling'],
    keywordsAr: ['صلب', 'سائل', 'غاز', 'نظرية الجسيمات', 'انصهار', 'غليان'],
    teacherNotes: "Use ice-to-water-to-steam demonstration. Connect to students' daily experiences.",
    teacherNotesAr: 'استخدم تجربة الجليد إلى الماء إلى البخار. اربط بتجارب الطلاب اليومية.',
    outcomes: [
      { id: 'o-sci-1-1', lessonId: 'lesson-sci-1', description: 'Students explain state changes using kinetic theory', descriptionAr: 'يشرح الطلاب تغيرات الحالة باستخدام النظرية الحركية', bloomsLevel: 'Understand', skills: ['Scientific reasoning'] },
    ],
  },
];

// ─── Active catalog: hide legacy Math/Chem G10 rows, inject NCCD catalogs ────
const _MATH_G10_S1_BOOK_ID = 'book-math-10';
const _MATH_G10_S2_BOOK_ID = 'book-math-10-s2';
const _nccdSem1Browser = buildNccdSem1BrowserCatalog();
const _nccdSem2Browser = buildNccdSem2BrowserCatalog();
const _finlitSem1Browser = buildFinlitSem1BrowserCatalog();
const _arabicSem1Browser = buildArabicSem1BrowserCatalog();
const _arabicSem2Browser = buildArabicSem2BrowserCatalog();
const _islamicSem1Browser = buildIslamicSem1BrowserCatalog();
const _islamicSem2Browser = buildIslamicSem2BrowserCatalog();
const _chemSem1Browser = buildChemSem1BrowserCatalog();
const _physSem1Browser = buildPhysSem1BrowserCatalog();
const _physSem2Browser = buildPhysSem2BrowserCatalog();
const _earthSem1Browser = buildEarthSem1BrowserCatalog();
const _earthSem2Browser = buildEarthSem2BrowserCatalog();
const _bioSem1Browser = buildBioSem1BrowserCatalog();
const _bioSem2Browser = buildBioSem2BrowserCatalog();
const _chemSem2Browser = buildChemSem2BrowserCatalog();
const _g9MathSem1Browser = buildG9MathSem1BrowserCatalog();
const _g9MathSem2Browser = buildG9MathSem2BrowserCatalog();
const _engCommerceBrowser = buildEnglishCommerceBrowserCatalog();
const _engAgricultureBrowser = buildEnglishAgricultureBrowserCatalog();
const _engHospitalityBrowser = buildEnglishHospitalityBrowserCatalog();
const _engIndustryBrowser = buildEnglishIndustryBrowserCatalog();

// ─── Authored-Bloom's enrichment for NCCD browser rows ───────────────────────
//
// NCCD is authoritative for identity: ids, order, titles-as-printed, and the
// book's نتاجات التعلم. But its builders hardcode `bloomsLevel: 'Understand'`,
// so swapping a hand-written lesson for its NCCD counterpart would delete a
// real human classification and replace it with a default that merely looks
// like one. objectives.ts stamps `bloomsSource` off the outcome-id prefix, so
// the loss is silent in the data and only visible in Bloom's coverage.
//
// Merge rule: the NCCD lesson keeps its own defaulted outcomes AND inherits the
// authored outcomes of the hand-written lesson with the same title, with
// `lessonId` remapped onto the NCCD lesson. The two sets say different things —
// the book's outcomes are نتاجات, the authored ones are extra teacher-written
// outcomes — so this appends rather than replaces.

/** Diacritics-insensitive Arabic title key — «مكوَّن» and «مكون» must match. */
function _titleKey(s: string): string {
  // U+064B–U+065F harakat/tanween/shadda/sukun, U+0670 dagger alef, U+0640 tatweel.
  return s.replace(/[ً-ٰٟـ]/g, '').replace(/\s+/g, ' ').trim();
}

function _mergeAuthoredOutcomes(
  nccdLessons: Lesson[],
  supersededLessons: Lesson[],
): { lessons: Lesson[]; unmatchedTitles: string[] } {
  const byTitle = new Map<string, Lesson>();
  for (const l of supersededLessons) {
    const key = _titleKey(l.titleAr);
    if (!byTitle.has(key)) byTitle.set(key, l);
  }
  const matched = new Set<string>();
  const lessons = nccdLessons.map(lesson => {
    const key = _titleKey(lesson.titleAr);
    const authored = byTitle.get(key);
    if (!authored || authored.outcomes.length === 0) return lesson;
    matched.add(key);
    return {
      ...lesson,
      outcomes: [
        ...lesson.outcomes,
        ...authored.outcomes.map(o => ({ ...o, lessonId: lesson.id })),
      ],
    };
  });
  const unmatchedTitles = [...byTitle.entries()]
    .filter(([key, l]) => !matched.has(key) && l.outcomes.length > 0)
    .map(([, l]) => l.titleAr);
  return { lessons, unmatchedTitles };
}
// Chemistry hardcoded rows are superseded by the student-book JSON. S1 served
// 3 units / 3 lessons against the book's 3 / 9, mislabelled unit 2 as «الجدول
// الدوري وخواص العناصر» (the book says «التوزيع الإلكتروني والدورية») and left
// unit 2 with zero lessons; S2's unit 4 had no real title and its unit 5 was
// labelled «التفاعلات الكيميائية», which is unit *4*'s subject — the book's
// unit 5 is «الطاقة الكيميائية». Their authored Bloom's levels survive via
// _mergeAuthoredOutcomes above.
const _legacyBookIds = new Set([
  _MATH_G10_S1_BOOK_ID,
  _MATH_G10_S2_BOOK_ID,
  CHEM_S1_CURRICULUM_BOOK_ID,
  CHEM_S2_CURRICULUM_BOOK_ID,
]);
const _legacyUnitIds = new Set(
  _HARDCODED_UNITS.filter(u => _legacyBookIds.has(u.bookId)).map(u => u.id),
);

/**
 * Hand-authored lessons displaced from one book — the source of that book's
 * authored Bloom's levels. Scoped per book so an unmatched title is reported
 * against the book it belongs to, not against every other NCCD swap. The
 * legacy Math rows are deliberately not merged: those browser rows never
 * carried authored outcomes, so there is nothing to carry over.
 */
function _supersededLessonsForBook(bookId: string): Lesson[] {
  const unitIds = new Set(
    _HARDCODED_UNITS.filter(u => u.bookId === bookId).map(u => u.id),
  );
  return _HARDCODED_LESSONS.filter(l => unitIds.has(l.unitId));
}

const _chemSem1Merged = _mergeAuthoredOutcomes(
  _chemSem1Browser.lessons,
  _supersededLessonsForBook(CHEM_S1_CURRICULUM_BOOK_ID),
);
const _chemSem2Merged = _mergeAuthoredOutcomes(
  _chemSem2Browser.lessons,
  _supersededLessonsForBook(CHEM_S2_CURRICULUM_BOOK_ID),
);

/**
 * Hand-authored lesson titles whose Bloom's-classified outcomes found no NCCD
 * lesson to attach to, so their levels are absent from the active catalog.
 *
 * Currently «الرابطة الأيونية والتساهمية» — the book splits and renames that
 * material into «الروابط الكيميائية وأنواعها» and «الصيغ الكيميائية وخصائص
 * المركبات», and its outcome (draw Lewis structures) fits neither cleanly
 * enough to alias by hand. Exported so the loss is countable rather than
 * silent; `curriculumObjectives.test.ts` pins the list.
 */
export const UNMATCHED_AUTHORED_LESSON_TITLES: readonly string[] = [
  ..._chemSem1Merged.unmatchedTitles,
  ..._chemSem2Merged.unmatchedTitles,
];

/** Active units — legacy Math/Chem G10 rows replaced by NCCD-sourced browser rows. */
export const UNITS: Unit[] = [
  ..._HARDCODED_UNITS.filter(u => !_legacyBookIds.has(u.bookId)),
  ..._chemSem1Browser.units,
  ..._physSem1Browser.units,
  ..._physSem2Browser.units,
  ..._earthSem1Browser.units,
  ..._earthSem2Browser.units,
  ..._bioSem1Browser.units,
  ..._bioSem2Browser.units,
  ..._chemSem2Browser.units,
  ..._nccdSem1Browser.units,
  ..._nccdSem2Browser.units,
  ..._finlitSem1Browser.units,
  ..._arabicSem1Browser.units,
  ..._arabicSem2Browser.units,
  ..._islamicSem1Browser.units,
  ..._islamicSem2Browser.units,
  ..._g9MathSem1Browser.units,
  ..._g9MathSem2Browser.units,
  ..._engCommerceBrowser.units,
  ..._engAgricultureBrowser.units,
  ..._engHospitalityBrowser.units,
  ..._engIndustryBrowser.units,
];

/** Active lessons — legacy Math/Chem G10 rows replaced by NCCD-sourced browser rows. */
export const LESSONS: Lesson[] = [
  ..._HARDCODED_LESSONS.filter(l => !_legacyUnitIds.has(l.unitId)),
  ..._chemSem1Merged.lessons,
  ..._physSem1Browser.lessons,
  ..._physSem2Browser.lessons,
  ..._earthSem1Browser.lessons,
  ..._earthSem2Browser.lessons,
  ..._bioSem1Browser.lessons,
  ..._bioSem2Browser.lessons,
  ..._chemSem2Merged.lessons,
  ..._nccdSem1Browser.lessons,
  ..._nccdSem2Browser.lessons,
  ..._finlitSem1Browser.lessons,
  ..._arabicSem1Browser.lessons,
  ..._arabicSem2Browser.lessons,
  ..._islamicSem1Browser.lessons,
  ..._islamicSem2Browser.lessons,
  ..._g9MathSem1Browser.lessons,
  ..._g9MathSem2Browser.lessons,
  ..._engCommerceBrowser.lessons,
  ..._engAgricultureBrowser.lessons,
  ..._engHospitalityBrowser.lessons,
  ..._engIndustryBrowser.lessons,
];

/** Math Grade 10 Semester 1 book id (NCCD-backed). */
export const MATH_G10_S1_BOOK_ID = 'book-math-10';

/**
 * @deprecated Sem1 is now NCCD-backed. Always false — kept for call-site compat.
 * Prefer isBrowserLessonTitleOnly / isBrowserUnitTitleOnly.
 */
export function isBrowserCurriculumPreparing(_bookId: string): boolean {
  return false;
}

/** UI: Sem1 units 2–4 — real titles, unit-level objectives only. */
export function isBrowserUnitTitleOnly(unitId: string): boolean {
  return isNccdSem1TitleOnlyUnit(unitId)
    || isG9MathSem1TitleOnlyUnit(unitId)
    || isG9MathSem2TitleOnlyUnit(unitId);
}

/** UI: Sem1 units 2–4 lessons — title confirmed, no per-lesson objectives yet. */
export function isBrowserLessonTitleOnly(lessonId: string): boolean {
  return isNccdSem1TitleOnlyLesson(lessonId)
    || isG9MathSem1TitleOnlyLesson(lessonId)
    || isG9MathSem2TitleOnlyLesson(lessonId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getLessonsForUnit(unitId: string): Lesson[] {
  return LESSONS.filter(l => l.unitId === unitId);
}

export function getUnitsForBook(bookId: string): Unit[] {
  return UNITS.filter(u => u.bookId === bookId).sort((a, b) => a.order - b.order);
}

export function getLessonById(id: string): Lesson | undefined {
  return LESSONS.find(l => l.id === id);
}

export function getUnitById(id: string): Unit | undefined {
  return UNITS.find(u => u.id === id);
}

export function getBookById(id: string): Book | undefined {
  return BOOKS.find(b => b.id === id);
}

/** Semester label for demo navigation (falls back to book title). */
export function getSemesterLabel(book: Book, lang: 'ar' | 'en'): string {
  if (book.semester === 1) return lang === 'ar' ? 'الفصل الأول' : 'Semester 1';
  if (book.semester === 2) return lang === 'ar' ? 'الفصل الثاني' : 'Semester 2';
  return lang === 'ar' ? (book.titleAr || book.title) : book.title;
}

export function getBooksForSubjectGrade(
  subjectId: string,
  gradeId: string,
  role?: 'teacher' | 'student' | 'parent' | 'school_admin' | 'system_admin',
): Book[] {
  return BOOKS.filter(b => {
    if (b.subjectId !== subjectId || b.gradeId !== gradeId) return false;
    if (INVESTOR_MVP_CURRICULUM && !MVP_BOOK_IDS.includes(b.id)) return false;
    const aud = b.audience ?? 'all';
    if (aud === 'all') return true;
    // teachers and admins see everything; students and parents only see 'student' + 'all'
    if (!role || role === 'teacher' || role === 'school_admin' || role === 'system_admin') return true;
    return aud === 'student';
  });
}

/** True when a book id is allowed in the current curriculum UI surface. */
export function isCurriculumBookVisible(bookId: string): boolean {
  if (!INVESTOR_MVP_CURRICULUM) return BOOKS.some(b => b.id === bookId);
  return MVP_BOOK_IDS.includes(bookId);
}

