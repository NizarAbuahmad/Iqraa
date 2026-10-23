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
export interface SummaryParts {
  questions?: number;
  minutes?: number;
  marks?: number;
  /** How many question types are ticked. */
  kinds?: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** «نوع واحد» / «نوعان» / «4 أنواع» / «12 نوعًا». */
function arKinds(n: number): string {
  if (n === 1) return 'نوع واحد';
  if (n >= 11) return `${n} نوعًا`;
  return arCountPhrase(n, 'نوع', 'نوعان', 'أنواع');
}

const AR: Record<keyof SummaryParts, (n: number) => string> = {
  questions: arQuestionsPhrase,
  minutes: n => arCountPhrase(n, 'دقيقة', 'دقيقتان', 'دقائق'),
  marks: n => arCountPhrase(n, 'درجة', 'درجتان', 'درجات'),
  kinds: arKinds,
};

const EN: Record<keyof SummaryParts, (n: number) => string> = {
  questions: n => plural(n, 'question', 'questions'),
  minutes: n => `${n} min`,
  marks: n => plural(n, 'mark', 'marks'),
  kinds: n => plural(n, 'type', 'types'),
};

const ORDER: (keyof SummaryParts)[] = ['questions', 'minutes', 'marks', 'kinds'];

/** «10 أسئلة · 20 دقيقة · 20 درجة · 4 أنواع», in a fixed order whatever order the caller named them. */
export function summaryLine(parts: SummaryParts, lang: SummaryLang): string {
  const say = lang === 'ar' ? AR : EN;
  return ORDER
    .filter(k => typeof parts[k] === 'number' && Number.isFinite(parts[k]))
    .map(k => say[k](parts[k] as number))
    .join(' · ');
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
