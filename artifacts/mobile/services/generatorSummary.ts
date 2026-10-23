/**
 * What a generator screen tells the teacher before they press the button: the
 * docked bar's one-line summary and the desktop paper preview's rows.
 *
 * Pure (no react-native import, `.ts` import extensions) so `node --test` can
 * load it. Numbers arrive as computed Latin digits and stay that way: the app
 * converts to Arabic-Indic digits at display time, never in a helper.
 */
import { arCountPhrase, arQuestionsPhrase } from './arCount.ts';

export type SummaryLang = 'ar' | 'en';

/** The counts a summary can name. A part left out is left out of the line. */
export interface SummaryCounts {
  questions?: number;
  minutes?: number;
  marks?: number;
  /** How many question types are ticked. */
  kinds?: number;
  /** How many sections a lesson plan has. */
  sections?: number;
}

export interface SummaryParts extends SummaryCounts {
  /**
   * A word and not a count, already in the display language. It closes the line:
   * the worksheet's difficulty level («20 سؤالًا · 3 أنواع · متوسط»), the lesson
   * plan's teaching style («45 دقيقة · 10 أقسام · التعليم المباشر»).
   */
  level?: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** «نوع واحد» / «نوعان» / «4 أنواع» / «12 نوعًا». */
function arKinds(n: number): string {
  if (n === 1) return 'نوع واحد';
  if (n >= 11) return `${n} نوعًا`;
  return arCountPhrase(n, 'نوع', 'نوعان', 'أنواع');
}

/** «قسم واحد» / «قسمان» / «10 أقسام» / «11 قسمًا». */
function arSections(n: number): string {
  if (n === 1) return 'قسم واحد';
  if (n >= 11) return `${n} قسمًا`;
  return arCountPhrase(n, 'قسم', 'قسمان', 'أقسام');
}

const AR: Record<keyof SummaryCounts, (n: number) => string> = {
  questions: arQuestionsPhrase,
  minutes: n => arCountPhrase(n, 'دقيقة', 'دقيقتان', 'دقائق'),
  marks: n => arCountPhrase(n, 'درجة', 'درجتان', 'درجات'),
  kinds: arKinds,
  sections: arSections,
};

const EN: Record<keyof SummaryCounts, (n: number) => string> = {
  questions: n => plural(n, 'question', 'questions'),
  minutes: n => `${n} min`,
  marks: n => plural(n, 'mark', 'marks'),
  kinds: n => plural(n, 'type', 'types'),
  sections: n => plural(n, 'section', 'sections'),
};

const ORDER: (keyof SummaryCounts)[] = ['questions', 'minutes', 'marks', 'kinds', 'sections'];

/** «10 أسئلة · 20 دقيقة · 20 درجة · 4 أنواع», in a fixed order whatever order the caller named them (a `level` word last). */
export function summaryLine(parts: SummaryParts, lang: SummaryLang): string {
  const say = lang === 'ar' ? AR : EN;
  const line = ORDER
    .filter(k => typeof parts[k] === 'number' && Number.isFinite(parts[k]))
    .map(k => say[k](parts[k] as number));
  const level = parts.level?.trim();
  if (level) line.push(level);
  return line.join(' · ');
}

export interface PreviewRow<T> {
  /** 1-based question number. */
  n: number;
  /** The type this row stands for; null when nothing is ticked. */
  type: T | null;
}

/**
 * The skeleton rows of the paper preview: `count` questions numbered from 1,
 * the ticked `types` dealt out in turn, cut off at `maxRows`, with how many
 * were not drawn. The preview shows the shape of the paper, never questions.
 */
export function previewRows<T>(types: readonly T[], count: number, maxRows: number): { rows: PreviewRow<T>[]; remainder: number } {
  const total = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const shown = Math.min(total, Math.max(0, Math.floor(maxRows)));
  const rows: PreviewRow<T>[] = [];
  for (let i = 0; i < shown; i++) rows.push({ n: i + 1, type: types.length ? types[i % types.length]! : null });
  return { rows, remainder: total - shown };
}

/** The line under the rows: «+ 4 أسئلة أخرى». Empty when nothing was cut. */
export function moreRowsLabel(remainder: number, lang: SummaryLang): string {
  if (!(remainder > 0)) return '';
  if (lang === 'en') return `+ ${remainder} more`;
  if (remainder === 1) return '+ سؤال آخر';
  if (remainder === 2) return '+ سؤالان آخران';
  if (remainder <= 10) return `+ ${remainder} أسئلة أخرى`;
  return `+ ${remainder} سؤالًا آخر`;
}

/**
 * The sections a lesson plan is made of, in the order the screen prints them
 * (`LessonPlanView`'s order: the order a teacher teaches in). The prior-review
 * section exists only when the teacher asked for one. The preview draws one
 * skeleton row per section; it never shows content.
 */
export const LESSON_PLAN_SECTIONS = [
  'objectives', 'materials', 'priorReview', 'introduction', 'mainActivity',
  'guidedPractice', 'independentPractice', 'closure', 'assessment', 'differentiation', 'homework',
] as const;

export type LessonPlanSection = (typeof LESSON_PLAN_SECTIONS)[number];

export function lessonPlanSections(withPriorReview: boolean): LessonPlanSection[] {
  return LESSON_PLAN_SECTIONS.filter(s => s !== 'priorReview' || withPriorReview);
}
