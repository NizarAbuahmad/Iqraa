/**
 * What a revision session over a unit, a semester or the whole book covers.
 *
 * A teaching tool given a wide scope makes ONE revision session (spec
 * `2026-10-14-wide-scope-teaching-tools-design.md`, decision 1): it spends the
 * time on the key ideas of each unit in scope and says plainly what it leaves
 * out. This module is the one place that decides, per unit, which lessons a
 * session shows and which outcomes, concepts and terms it reviews — so the
 * offline plan, its introduction and its "left out" sentence cannot disagree.
 *
 * Units are rebuilt from lesson ids (`revisionUnitsFromLessons`), never from a
 * title: the request carries `coverage.lessons`, and a scope label («الفصل
 * الأول كاملًا», a unit title) grounds to another grade's lesson when looked up.
 *
 * Free of react-native so `node --test` can load it.
 */
import { curriculumObjectivesFor } from './kbContext.ts';
import { getLessonById, getUnitForLesson, KB_BOOKS, KB_UNITS } from './knowledgeBase.ts';
import { lessonsInScope, parseScope, unitsInScope, type ScopeSelection } from './scopeSelection.ts';

export type RevisionLesson = {
  id: string;
  title: string;
  /**
   * The KB lists no key concepts and no key terms for it (the GeoGebra labs
   * are the case in Grade 10 maths). A revision round has nothing of its own to
   * review there, so it is shown only after every lesson that has some.
   */
  thin: boolean;
};

export type RevisionUnit = {
  /** KB unit id. */
  unitId: string;
  /** Unit title in `lang`. */
  title: string;
  /** The unit's lessons in scope, book order. */
  lessons: RevisionLesson[];
  /** Official outcomes, ≤3: the first outcome of each lesson first (non-thin lessons before thin ones). */
  outcomes: string[];
  /** Key concepts, ≤3, same interleaving. */
  concepts: string[];
  /** Key terms, ≤3, same interleaving. */
  terms: string[];
};

/** Per unit, the most a one-session revision names. Also the cap on outcomes / concepts / terms. */
export const REVISION_SHOWN_PER_UNIT = 3;
const CAP = 3;

/** `thin` lessons last, book order kept inside each group. */
function prioritized(lessons: RevisionLesson[]): RevisionLesson[] {
  return [...lessons.filter(l => !l.thin), ...lessons.filter(l => l.thin)];
}

/** One item from each list in turn, then the second of each, … — deduped, at most `cap`. */
function interleave(lists: string[][], cap: number): string[] {
  const out: string[] = [];
  const longest = Math.max(0, ...lists.map(l => l.length));
  for (let i = 0; i < longest && out.length < cap; i++) {
    for (const list of lists) {
      const item = list[i]?.trim();
      if (item && !out.includes(item)) out.push(item);
      if (out.length >= cap) break;
    }
  }
  return out;
}

/**
 * The units the given lessons belong to, in the order the lessons come (pass
 * them in book order), each with its own lessons from the list.
 *
 * An id the KB does not hold (or no longer shows) is skipped: the request is
 * client data, and a stale id must not invent a unit.
 */
export function revisionUnitsFromLessons(lessonIds: readonly string[], lang: 'ar' | 'en'): RevisionUnit[] {
  const isAr = lang === 'ar';
  const order: string[] = [];
  const byUnit = new Map<string, NonNullable<ReturnType<typeof getLessonById>>[]>();
  const seen = new Set<string>();
  for (const id of lessonIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const lesson = getLessonById(id);
    if (!lesson) continue;
    let list = byUnit.get(lesson.unitId);
    if (!list) {
      list = [];
      byUnit.set(lesson.unitId, list);
      order.push(lesson.unitId);
    }
    list.push(lesson);
  }
  const units: RevisionUnit[] = [];
  for (const unitId of order) {
    const kbLessons = byUnit.get(unitId)!;
    const unit = getUnitForLesson(kbLessons[0]!);
    const lessons: RevisionLesson[] = kbLessons.map(l => ({
      id: l.id,
      title: isAr ? l.titleAr : l.titleEn,
      thin: (isAr ? l.keyConceptsAr : l.keyConceptsEn).length === 0 && l.keyTerms.length === 0,
    }));
    const kbById = new Map(kbLessons.map(l => [l.id, l]));
    const ranked = prioritized(lessons).map(l => kbById.get(l.id)!);
    units.push({
      unitId,
      title: unit ? (isAr ? unit.titleAr : unit.titleEn) : '',
      lessons,
      outcomes: interleave(ranked.map(l => curriculumObjectivesFor(l)), CAP),
      concepts: interleave(ranked.map(l => isAr ? l.keyConceptsAr : l.keyConceptsEn), CAP),
      terms: interleave(ranked.map(l => l.keyTerms.map(t => isAr ? t.ar : t.en)), CAP),
    });
  }
  return units;
}

/** The units a scope covers, book order; [] when nothing is in scope. */
export function revisionUnits(sel: ScopeSelection, lang: 'ar' | 'en'): RevisionUnit[] {
  return revisionUnitsFromLessons(lessonsInScope(sel).map(l => l.id), lang);
}

/**
 * Which lessons of a unit a one-session revision names, and which it leaves out.
 *
 * Lessons with something to review come first; both lists are in book order.
 */
export function splitShown(unit: RevisionUnit, shownPerUnit: number): { shown: RevisionLesson[]; left: RevisionLesson[] } {
  const keep = new Set(prioritized(unit.lessons).slice(0, Math.max(0, shownPerUnit)).map(l => l.id));
  return {
    shown: unit.lessons.filter(l => keep.has(l.id)),
    left: unit.lessons.filter(l => !keep.has(l.id)),
  };
}

/**
 * The selection a request's id-only `scope.scopeKey` names (`book:g:s`,
 * `sem:g:s:n`, `unit:<id>`, `lesson:<id>`), rebuilt from the KB. Null for a key
 * it cannot read, or one that no longer covers any lesson.
 */
export function scopeFromKey(scopeKey: string): ScopeSelection | null {
  const [kind, ...rest] = scopeKey.split(':');
  if (kind === 'book' && rest.length === 2) {
    return parseScope({ kind: 'book', gradeId: rest[0], subjectId: rest[1] });
  }
  if (kind === 'sem' && rest.length === 3) {
    return parseScope({ kind: 'semester', gradeId: rest[0], subjectId: rest[1], semester: Number(rest[2]) });
  }
  if ((kind === 'unit' || kind === 'lesson') && rest.length === 1) {
    const unitId = kind === 'unit' ? rest[0] : getLessonById(rest[0]!)?.unitId;
    const unit = KB_UNITS.find(u => u.id === unitId);
    const book = unit ? KB_BOOKS.find(b => b.id === unit.bookId) : undefined;
    if (!book) return null;
    return parseScope(kind === 'unit'
      ? { kind: 'unit', gradeId: book.gradeId, subjectId: book.subjectId, unitId }
      : { kind: 'lesson', gradeId: book.gradeId, subjectId: book.subjectId, lessonId: rest[0] });
  }
  return null;
}

/** «موضوعات الفصل الأول» / "Semester 1 topics" — a noun phrase for use INSIDE sentences. */
export function revisionPhrase(sel: ScopeSelection, lang: 'ar' | 'en'): string {
  const isAr = lang === 'ar';
  switch (sel.kind) {
    case 'book':
      return isAr ? 'موضوعات الكتاب كله' : 'whole-book topics';
    case 'semester':
      if (isAr) return sel.semester === 2 ? 'موضوعات الفصل الثاني' : 'موضوعات الفصل الأول';
      return `Semester ${sel.semester === 2 ? 2 : 1} topics`;
    case 'unit': {
      const u = unitsInScope(sel)[0];
      const title = u ? (isAr ? u.titleAr : u.titleEn) : '';
      return isAr ? `موضوعات وحدة «${title}»` : `“${title}” unit topics`;
    }
    case 'lesson': {
      const l = lessonsInScope(sel)[0];
      const title = l ? (isAr ? l.titleAr : l.titleEn) : '';
      return isAr ? `موضوعات درس «${title}»` : `“${title}” lesson topics`;
    }
  }
}

/** «درس واحد» / «درسان» / «3 دروس» / «11 درسًا» — the same rule as `arLessonsPhrase` (arCount.ts). */
function arLessons(n: number): string {
  if (n === 1) return 'درس واحد';
  if (n === 2) return 'درسان';
  if (n >= 3 && n <= 10) return `${n} دروس`;
  return `${n} درسًا`;
}

/** «ودرس آخر» … — the same words as i18n's `coveredLessonsMore` (i18n.ts loads React Native). */
function arMore(k: number): string {
  if (k === 1) return 'ودرس آخر';
  if (k === 2) return 'ودرسان آخران';
  return k <= 10 ? `و${k} دروس أخرى` : `و${k} درسًا آخر`;
}

/** Titles named in the sentence; the rest are counted. */
export const LEFT_OUT_NAMES = 6;

/**
 * One honest sentence naming what a one-session revision leaves out; '' when
 * nothing is left out. Names at most `LEFT_OUT_NAMES` titles and counts the
 * rest; the total is always stated.
 */
export function leftOutSentence(units: readonly RevisionUnit[], shownPerUnit: number, lang: 'ar' | 'en'): string {
  const left = units.flatMap(u => splitShown(u, shownPerUnit).left);
  if (left.length === 0) return '';
  const named = left.slice(0, LEFT_OUT_NAMES).map(l => l.title);
  const hidden = left.length - named.length;
  if (lang === 'ar') {
    const names = named.map(t => `«${t}»`).join('، ');
    return `لن تتّسع حصة واحدة لكل دروس هذا النطاق، فيبقى خارج هذه المراجعة ${arLessons(left.length)}: ${names}${hidden > 0 ? ` ${arMore(hidden)}` : ''}.`;
  }
  const names = named.map(t => `“${t}”`).join(', ');
  return `One session cannot cover every lesson in this scope, so this review leaves out ${left.length} lesson${left.length === 1 ? '' : 's'}: ${names}${hidden > 0 ? ` and ${hidden} more` : ''}.`;
}
