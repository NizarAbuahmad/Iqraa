/**
 * The formula sheet as the screen draws it: formulas grouped under their unit
 * and lesson, in book order. Pure and free of react-native.
 *
 * Every Arabic (and English) title here is read from the knowledge base through
 * the lesson id; the only Arabic that is not is a formula's `captionAr`, which
 * the curriculum package tests against the printed lesson. Where the book has
 * no intact phrase for a formula the Arabic UI shows none, never an invented one.
 */
import { MATH_FORMULAS, type MathFormula } from '@workspace/curriculum/math-formulas';
import { getLessonById, getUnitForLesson } from './knowledgeBase.ts';

type Lang = 'ar' | 'en';

export type FormulaRow = {
  id: string;
  captionAr: string | null;
  captionEn: string;
  /** Display text, Unicode symbols; draw it with `displayLtr`. */
  formula: string;
  book: 's1' | 's2';
  page: number;
};

export type FormulaLesson = {
  lessonId: string;
  title: string;
  order: number;
  formulas: FormulaRow[];
};

export type FormulaUnit = {
  unitId: string;
  title: string;
  order: number;
  lessons: FormulaLesson[];
};

function toRow(f: MathFormula): FormulaRow {
  return {
    id: f.id,
    captionAr: f.captionAr ?? null,
    captionEn: f.captionEn,
    formula: f.formula,
    book: f.source.book,
    page: f.source.page,
  };
}

export function buildFormulaSheet(lang: Lang, formulas: MathFormula[] = MATH_FORMULAS): FormulaUnit[] {
  const units = new Map<string, FormulaUnit>();
  for (const f of formulas) {
    const lesson = getLessonById(f.lessonId);
    const unit = lesson ? getUnitForLesson(lesson) : undefined;
    // A formula whose lesson the app cannot resolve is a data error that
    // `mathFormulaView.test.ts` fails on; here it is skipped, not shown untitled.
    if (!lesson || !unit) continue;

    let u = units.get(unit.id);
    if (!u) {
      u = { unitId: unit.id, title: lang === 'ar' ? unit.titleAr : unit.titleEn, order: unit.order, lessons: [] };
      units.set(unit.id, u);
    }
    let l = u.lessons.find(x => x.lessonId === lesson.id);
    if (!l) {
      l = { lessonId: lesson.id, title: lang === 'ar' ? lesson.titleAr : lesson.titleEn, order: lesson.order, formulas: [] };
      u.lessons.push(l);
    }
    l.formulas.push(toRow(f));
  }
  const out = [...units.values()].sort((a, b) => a.order - b.order);
  for (const u of out) u.lessons.sort((a, b) => a.order - b.order);
  return out;
}

/** The line above a formula: the book's own phrase in Arabic, our English caption in English. */
export function formulaCaption(row: FormulaRow, lang: Lang): string | null {
  return lang === 'ar' ? row.captionAr : row.captionEn;
}

export function filterFormulaSheet(sheet: FormulaUnit[], unitId: string | null): FormulaUnit[] {
  return unitId === null ? sheet : sheet.filter(u => u.unitId === unitId);
}
