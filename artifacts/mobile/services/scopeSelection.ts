/**
 * What a teacher picked in the topic picker — as ids, never as a title.
 *
 * The picker used to hand every generator a topic *string*: a lesson title,
 * a unit title, or «الكتاب كاملًا». Generators then re-grounded that string to
 * ONE lesson (or none), so a whole-book paper was silently ungrounded or built
 * from whichever lesson the text happened to resemble — the "a lesson title
 * does not identify a lesson" trap in CLAUDE.md. A `ScopeSelection` carries
 * the ids instead, and this module is the one place that knows which lessons
 * "semester 2" means.
 *
 * Free of react-native so `node --test` can load it.
 */
import {
  getLessonsForUnit,
  getUnitsForSubjectGrade,
  hasKBContent,
  KB_BOOKS,
  type KBLesson,
  type KBUnit,
} from './knowledgeBase.ts';

export type ScopeKind = 'lesson' | 'unit' | 'semester' | 'book';
export type Semester = 1 | 2;

export type ScopeSelection = {
  kind: ScopeKind;
  gradeId: string;
  subjectId: string;
  /** kind 'unit': the KB unit id. */
  unitId?: string;
  /** kind 'semester'. */
  semester?: Semester;
  /** kind 'lesson': the KB lesson id — never a title. */
  lessonId?: string;
};

/** What the picker offers today. A screen that names no kinds gets exactly this. */
export const LEGACY_SCOPE_KINDS: readonly ScopeKind[] = ['lesson', 'unit', 'book'];

function semesterOf(unit: KBUnit): Semester {
  return (KB_BOOKS.find(b => b.id === unit.bookId)?.semester ?? 1) as Semester;
}

/** The units a selection covers, in book order (semester 1 first). */
export function unitsInScope(sel: ScopeSelection): KBUnit[] {
  const units = getUnitsForSubjectGrade(sel.subjectId, sel.gradeId);
  switch (sel.kind) {
    case 'book':
      return units;
    case 'semester':
      return units.filter(u => semesterOf(u) === sel.semester);
    case 'unit':
      return units.filter(u => u.id === sel.unitId);
    case 'lesson':
      return units.filter(u => getLessonsForUnit(u.id).some(l => l.id === sel.lessonId));
  }
}

/** The lessons a selection covers, in book order. Empty for an id this grade+subject does not hold. */
export function lessonsInScope(sel: ScopeSelection): KBLesson[] {
  const lessons = unitsInScope(sel).flatMap(u => getLessonsForUnit(u.id));
  return sel.kind === 'lesson' ? lessons.filter(l => l.id === sel.lessonId) : lessons;
}

/** The semesters this grade+subject has a book for. */
export function semestersAvailable(gradeId: string, subjectId: string): Semester[] {
  const seen = new Set<Semester>();
  for (const u of getUnitsForSubjectGrade(subjectId, gradeId)) seen.add(semesterOf(u));
  return ([1, 2] as const).filter(s => seen.has(s));
}

/**
 * The kinds the picker may offer for this grade+subject.
 *
 * `semester` is dropped when there is only one semester (it would equal «الكتاب
 * كاملًا») and under DEMO_MODE (the offline generators cannot yet honour it).
 * The other kinds are left exactly as the screen asked: they already exist
 * today, and piece 2 is what makes them work.
 */
export function availableKinds(
  gradeId: string,
  subjectId: string,
  allowed: readonly ScopeKind[] = LEGACY_SCOPE_KINDS,
  demoMode = false,
): ScopeKind[] {
  if (!hasKBContent(subjectId, gradeId)) return [];
  const offerSemester = !demoMode && semestersAvailable(gradeId, subjectId).length >= 2;
  return allowed.filter(k => k !== 'semester' || offerSemester);
}

/** A stable id-only key — for the cache key, saved state and equality. */
export function scopeKey(sel: ScopeSelection): string {
  switch (sel.kind) {
    case 'book':
      return `book:${sel.gradeId}:${sel.subjectId}`;
    case 'semester':
      if (sel.semester !== 1 && sel.semester !== 2) throw new Error('scopeKey: semester scope without a semester');
      return `sem:${sel.gradeId}:${sel.subjectId}:${sel.semester}`;
    case 'unit':
      if (!sel.unitId) throw new Error('scopeKey: unit scope without a unitId');
      return `unit:${sel.unitId}`;
    case 'lesson':
      if (!sel.lessonId) throw new Error('scopeKey: lesson scope without a lessonId');
      return `lesson:${sel.lessonId}`;
  }
}

/**
 * The display / topic text for a selection. The literals match i18n's
 * `entireBook` and the semester names; this module stays free of the i18n
 * table (which pulls in React Native) so it can be tested.
 */
export function scopeLabel(sel: ScopeSelection, lang: 'ar' | 'en'): string {
  const isAr = lang === 'ar';
  switch (sel.kind) {
    case 'book':
      return isAr ? 'الكتاب كاملًا' : 'Entire book';
    case 'semester':
      if (isAr) return sel.semester === 2 ? 'الفصل الثاني كاملًا' : 'الفصل الأول كاملًا';
      return `Entire semester ${sel.semester === 2 ? 2 : 1}`;
    case 'unit': {
      const u = unitsInScope(sel)[0];
      return u ? (isAr ? u.titleAr : u.titleEn) : '';
    }
    case 'lesson': {
      const l = lessonsInScope(sel)[0];
      return l ? (isAr ? l.titleAr : l.titleEn) : '';
    }
  }
}

/** Rebuild a selection from saved / untrusted state. Null unless it still covers lessons. */
export function parseScope(raw: unknown): ScopeSelection | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const kinds: readonly string[] = ['lesson', 'unit', 'semester', 'book'];
  if (typeof r.kind !== 'string' || !kinds.includes(r.kind)) return null;
  if (typeof r.gradeId !== 'string' || typeof r.subjectId !== 'string') return null;
  const sel: ScopeSelection = { kind: r.kind as ScopeKind, gradeId: r.gradeId, subjectId: r.subjectId };
  if (typeof r.unitId === 'string') sel.unitId = r.unitId;
  if (r.semester === 1 || r.semester === 2) sel.semester = r.semester;
  if (typeof r.lessonId === 'string') sel.lessonId = r.lessonId;
  try {
    scopeKey(sel);
  } catch {
    return null;
  }
  return lessonsInScope(sel).length > 0 ? sel : null;
}
