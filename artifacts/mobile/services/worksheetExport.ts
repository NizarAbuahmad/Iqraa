/**
 * A worksheet's three export formats for one copy — mirror of `quizExports`.
 * موادي and the chat have no answers toggle, so they ask in the export menu;
 * a virtual-lab sheet's key must not reach students by default.
 */
import type * as Docx from 'docx';

import type { WorksheetOutput } from './ai/AIService.ts';
import { buildWordDocument } from './docxBuild.ts';
import { buildWorksheetHTML, type BookFigureRef } from './exportHtml.ts';
import { formatWorksheetText } from './exportText.ts';
import type { QuizCopy } from './quizExport.ts';

export function worksheetExports(
  ws: WorksheetOutput,
  title: string,
  meta: { subject: string; grade: string },
  isAr: boolean,
  copy: QuizCopy,
  figures: readonly BookFigureRef[] = [],
) {
  const withKey = copy === 'teacher';
  const text = formatWorksheetText(ws, title, meta, isAr, withKey);
  return {
    text,
    html: buildWorksheetHTML(ws, title, meta, isAr, figures, withKey),
    word: (docx: typeof Docx) => buildWordDocument(text, isAr, docx),
  };
}
