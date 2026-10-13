/**
 * The prompt context for a scope of many lessons.
 *
 * `resolveGeneratorGrounding` is exact for ONE lesson and stays that way. For a
 * unit / semester / book the lessons are known (ids, from `ScopeSelection`), so
 * nothing is searched: this builds a digest of them. A full semester of G10
 * maths is 18 lessons and G10 English is 100, so the digest is tiered — it
 * drops detail (concepts, then outcomes) before it ever drops a lesson, and
 * only past that does it cut the list, saying so.
 *
 * Free of react-native so `node --test` can load it.
 */
import { curriculumObjectivesFor, nccdUnitId, resolveGeneratorGrounding } from './kbContext.ts';
import { getLessonsForUnit, type KBLesson } from './knowledgeBase.ts';
import { lessonsInScope, scopeKey, scopeLabel, unitsInScope, type ScopeKind, type ScopeSelection } from './scopeSelection.ts';

/** Mirrors the server's PASSAGE_CHAR_BUDGET: an unbounded prompt is a budget problem first. */
export const DIGEST_CHAR_BUDGET = 6000;

export type ScopeGrounding = {
  kind: ScopeKind;
  scopeKey: string;
  grounded: boolean;
  lessons: KBLesson[];
  /** The prompt block; '' when ungrounded. */
  context: string;
  /** NCCD unit ids only (the ones the server can fetch book pages for), in book order. */
  unitIds: string[];
  /** True when even the titles-only digest had to drop lessons. */
  truncated: boolean;
  /** Set only when ungrounded — never claim curriculum grounding then. */
  ungroundedNote: string;
};

type Tier = 'full' | 'short' | 'titles';
const TIERS: readonly Tier[] = ['full', 'short', 'titles'];

function lessonLines(l: KBLesson, isAr: boolean, tier: Tier): string[] {
  const sep = isAr ? '؛ ' : '; ';
  const out = [`- ${isAr ? l.titleAr : l.titleEn}`];
  if (tier === 'titles') return out;
  const outcomes = curriculumObjectivesFor(l).slice(0, tier === 'full' ? 3 : 1);
  if (outcomes.length) out.push(`  ${isAr ? 'النتاجات' : 'Outcomes'}: ${outcomes.join(sep)}`);
  if (tier === 'full') {
    const concepts = (isAr ? l.keyConceptsAr : l.keyConceptsEn).slice(0, 3);
    if (concepts.length) out.push(`  ${isAr ? 'المفاهيم' : 'Concepts'}: ${concepts.join(sep)}`);
  }
  return out;
}

function render(sel: ScopeSelection, lang: 'ar' | 'en', total: number, tier: Tier): string[] {
  const isAr = lang === 'ar';
  const lines = [
    `${isAr ? '📚 النطاق' : '📚 Scope'}: ${scopeLabel(sel, lang)} (${total} ${isAr ? 'درسًا' : 'lessons'})`,
  ];
  for (const unit of unitsInScope(sel)) {
    lines.push('', `${isAr ? 'الوحدة' : 'Unit'}: ${isAr ? unit.titleAr : unit.titleEn}`);
    for (const l of getLessonsForUnit(unit.id)) lines.push(...lessonLines(l, isAr, tier));
  }
  return lines;
}

export function resolveScopeGrounding(sel: ScopeSelection, lang: 'ar' | 'en'): ScopeGrounding {
  const lessons = lessonsInScope(sel);
  const key = (() => {
    try { return scopeKey(sel); } catch { return ''; }
  })();

  if (lessons.length === 0) {
    return {
      kind: sel.kind, scopeKey: key, grounded: false, lessons: [], context: '', unitIds: [], truncated: false,
      // The same sentence an ungrounded single lesson gets — one wording to keep.
      ungroundedNote: resolveGeneratorGrounding('', lang).ungroundedNote,
    };
  }

  const unitIds = [...new Set(
    unitsInScope(sel).map(u => nccdUnitId(u.id)).filter((id): id is string => !!id),
  )];

  if (sel.kind === 'lesson') {
    const lesson = lessons[0]!;
    const g = resolveGeneratorGrounding(lang === 'ar' ? lesson.titleAr : lesson.titleEn, lang, { lessonId: lesson.id });
    return {
      kind: 'lesson', scopeKey: key, grounded: g.grounded, lessons: [lesson], context: g.context, unitIds,
      truncated: false, ungroundedNote: g.ungroundedNote,
    };
  }

  let lines: string[] = [];
  for (const tier of TIERS) {
    lines = render(sel, lang, lessons.length, tier);
    if (lines.join('\n').length <= DIGEST_CHAR_BUDGET) {
      return { kind: sel.kind, scopeKey: key, grounded: true, lessons, context: lines.join('\n'), unitIds, truncated: false, ungroundedNote: '' };
    }
  }

  // Even titles do not fit: keep as many whole lines as the budget allows, and say what was cut.
  const note = lang === 'ar' ? '[…بقية الدروس غير مُدرجة]' : '[…remaining lessons not listed]';
  const kept: string[] = [];
  let spent = note.length;
  for (const line of lines) {
    if (spent + line.length + 1 > DIGEST_CHAR_BUDGET) break;
    kept.push(line);
    spent += line.length + 1;
  }
  kept.push(note);
  return { kind: sel.kind, scopeKey: key, grounded: true, lessons, context: kept.join('\n'), unitIds, truncated: true, ungroundedNote: '' };
}
