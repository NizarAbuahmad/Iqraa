/**
 * What makes a worksheet a paper a student writes on — mirror of
 * `quizPaper.ts`, shared by the printed page and the shared text.
 *
 * Pure: imported by `exportHtml.ts` and `exportText.ts`, which run under bare
 * `node --test`.
 */
import type { WorksheetOutput } from './ai/AIService.ts';
import { stripOptionPrefix } from './optionLabels.ts';

/**
 * The name/class/date line is the paper's job, not the instructions'. The
 * offline generator used to write it into `instructions` as underscores, which
 * printed glued into the instructions paragraph — and saved sheets (and the
 * premade ones) still carry it, so it is dropped here rather than only at the
 * source. Same for the bullet that was a note to the generator itself and
 * printed on the student's copy: «لا حاجة لملاحظات المعلم — هذه ورقة للطالب».
 */
const NAME_LINE = /^\s*(?:الاسم|Name)\s*:\s*_{3,}.*$/u;
const NOTE_TO_SELF = /لا حاجة لملاحظات المعلم|no teacher notes/iu;
const BULLET = /^\s*[•\-–]\s+/u;

export interface WorksheetInstructions {
  /** Prose paragraphs, in order. */
  intro: string[];
  /** The `•` lines, without their marker. */
  bullets: string[];
}

export function worksheetInstructions(text: string | undefined): WorksheetInstructions {
  const intro: string[] = [];
  const bullets: string[] = [];
  for (const line of (text ?? '').split('\n')) {
    if (!line.trim() || NAME_LINE.test(line) || NOTE_TO_SELF.test(line)) continue;
    if (BULLET.test(line)) bullets.push(line.replace(BULLET, '').trim());
    else intro.push(line.trim());
  }
  return { intro, bullets };
}

/** The total the score box is out of. */
export function worksheetPointsTotal(ws: WorksheetOutput): number {
  return ws.sections.reduce((sum, sec) => sum + sec.questions.reduce((s, q) => s + (q.points || 0), 0), 0);
}

/**
 * A line that is only a blank to write on, optionally numbered — the
 * half-solved question's «3) __________». Returns the number («3)», or '' when
 * there is none), or null for any other line. A blank INSIDE a sentence
 * («2^___ = 8») is not one: that answer goes in the sentence.
 */
const BLANK_LINE = /^\s*(\(?[0-9٠-٩]+[).]?)?\s*_{5,}\s*$/u;
export function blankLine(line: string): string | null {
  const m = BLANK_LINE.exec(line);
  return m ? (m[1] ?? '') : null;
}

/**
 * A question that already holds its own blank lines. Ruled lines under it as
 * well doubled the writing room on the one question that needs none. Call on
 * the printable text: the «الإجابة:» underscore suffix is removed before this
 * is asked.
 */
export function hasOwnBlanks(questionText: string): boolean {
  return questionText.split('\n').some(line => blankLine(line) !== null);
}

/**
 * How many options sit side by side. One per line, «صح» and «خطأ» included,
 * was most of a 10-question sheet's four pages. Measured on the option's own
 * text, marker removed, so a model-written «أ) » does not count.
 */
export function optionColumns(options: readonly string[]): 1 | 2 | 4 {
  const longest = Math.max(...options.map(o => [...stripOptionPrefix(o).trim()].length));
  if (longest <= 12) return 4;
  if (longest <= 28) return 2;
  return 1;
}
