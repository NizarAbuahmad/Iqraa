/**
 * A quiz's three export formats for one copy — the student's (no key) or the
 * teacher's (key on its own page).
 *
 * The quiz screen decides the copy from its answers toggle. موادي and the
 * chat have no such toggle and used to export the teacher's copy every time,
 * with the key, and as plain-text Word; they now ask in the export menu and
 * build from here, so all three surfaces print the same exam paper.
 */
import type * as Docx from 'docx';

import type { QuizOutput } from './ai/AIService.ts';
import { buildQuizHTML, type BookFigureRef } from './exportHtml.ts';
import { formatQuizText } from './exportText.ts';
import { buildQuizDocx } from './quizDocx.ts';

export type QuizCopy = 'student' | 'teacher';

export function quizExports(
  quiz: QuizOutput,
  title: string,
  meta: { subject: string; grade: string },
  isAr: boolean,
  copy: QuizCopy,
  figures: readonly BookFigureRef[] = [],
) {
  const withKey = copy === 'teacher';
  return {
    text: formatQuizText(quiz, title, meta, isAr, withKey),
    html: buildQuizHTML(quiz, title, meta, isAr, figures, withKey),
    word: (docx: typeof Docx) => buildQuizDocx(quiz, title, meta, isAr, withKey, docx),
  };
}
