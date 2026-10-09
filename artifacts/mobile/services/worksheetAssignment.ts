/**
 * Sending a worksheet to a class as a digital assignment — the app's half.
 *
 * The server converts and decides what is marked automatically
 * (`modules/assessment/fromWorksheet.ts`); the rules live there only, so this
 * file never guesses what a question will become. What it does decide is what
 * the send sheet offers and exactly what leaves the phone.
 *
 * Pure: loaded by `node --test`.
 */
import { getObjectivesForLesson, type CurriculumObjective } from '@workspace/curriculum';

import type { WorksheetOutput } from './ai/AIService.ts';

/**
 * The objectives the sheet can be filed under: its own lesson's. The KB lesson
 * id a worksheet carries is the curriculum lesson id, so this is a lookup, not
 * a search — a title would drift to another lesson.
 */
export function lessonObjectivesForSend(lessonId: string | undefined): CurriculumObjective[] {
  return lessonId ? getObjectivesForLesson(lessonId) : [];
}

/**
 * The teacher's classes, those of the sheet's grade and subject first. Nothing
 * is hidden: a teacher may well send a review sheet to another class, and an
 * older class with no grade or subject set counts as a match rather than being
 * pushed to the bottom for a field it never had.
 */
export function classesForSend<T extends { gradeId: string; subjectId: string; subjectIds?: string[] }>(
  classes: readonly T[],
  gradeId: string,
  subjectId: string,
): T[] {
  const matches = (c: T) =>
    (!c.gradeId || c.gradeId === gradeId)
    && (!c.subjectId || c.subjectId === subjectId || (c.subjectIds ?? []).includes(subjectId));
  return [...classes.filter(matches), ...classes.filter(c => !matches(c))];
}

export interface WorksheetSendBody {
  title: string;
  sections: { questions: { text: string; options?: string[]; points: number; figure?: { uri: string; caption: string } }[] }[];
  answerKey: { num: number; answer: string; solution?: string[] }[];
}

/**
 * Only what the server converts. The worked example is study material and is
 * not sent (the sheet says so); provenance and pooling ids mean nothing to an
 * exam.
 */
export function worksheetSendPayload(ws: WorksheetOutput): WorksheetSendBody {
  return {
    title: ws.title,
    sections: ws.sections.map(sec => ({
      questions: sec.questions.map(q => ({
        text: q.text,
        ...(q.options?.length ? { options: q.options } : {}),
        points: q.points,
        ...(q.figure ? { figure: { uri: q.figure.uri, caption: q.figure.caption } } : {}),
      })),
    })),
    answerKey: ws.answerKey.map(k => ({
      num: k.num,
      answer: k.answer,
      ...(k.solution?.length ? { solution: k.solution } : {}),
    })),
  };
}
