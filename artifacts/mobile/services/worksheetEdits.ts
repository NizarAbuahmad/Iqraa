/**
 * Pure transforms behind worksheet editing.
 *
 * Same motivation as `quizEdits.ts`, harder shape: a worksheet's answer does
 * not live on the question. `WorksheetQuestion` has no `id` and no reliable
 * `answer` field — the generator only ever fills the top-level `answerKey`,
 * keyed by 1-based flat position across `sections[].questions[]` in on-paper
 * order (see the same note in `quizVerification.ts`). Every edit here has to
 * go through that flat view so a question and its answer never drift apart,
 * and a delete has to renumber everything after it rather than leave a hole.
 *
 * Kept free of React so it can be tested directly.
 */
import type { QuestionFigure, WorksheetOutput, WorksheetQuestion } from './ai/AIService.ts';

export { parsePoints } from './quizEdits.ts';

type FlatItem = {
  sectionIndex: number;
  questionIndex: number;
  question: WorksheetQuestion;
  /** This question's own answer-key text, looked up by its current flat position. */
  answer: string;
  /**
   * The working behind `answer`, when the key has it. It belongs to the
   * question as it was generated: any edit to the question's wording, its
   * options or its answer drops it, because working that led to a different
   * question or answer is worse on a teacher's key than no working.
   */
  solution?: string[];
};

/** Every question paired with its own answer, in on-paper order. */
function flatten(ws: WorksheetOutput): FlatItem[] {
  const answerByPos = new Map(ws.answerKey.map(a => [a.num, a.answer]));
  const solutionByPos = new Map(ws.answerKey.map(a => [a.num, a.solution]));
  const out: FlatItem[] = [];
  let pos = 0;
  ws.sections.forEach((sec, sectionIndex) => {
    sec.questions.forEach((question, questionIndex) => {
      pos += 1;
      const solution = solutionByPos.get(pos);
      out.push({ sectionIndex, questionIndex, question, answer: answerByPos.get(pos) ?? '', ...(solution ? { solution } : {}) });
    });
  });
  return out;
}

/**
 * Rebuild sections and a freshly renumbered answer key from a flat list.
 *
 * Section grouping, titles and type are kept from the original — only the
 * questions inside change — and a section left with none is dropped, the
 * same rule `generateWorksheet` applies when it builds a paper.
 */
function rebuild(ws: WorksheetOutput, flat: FlatItem[]): WorksheetOutput {
  const sections = ws.sections
    .map((sec, sectionIndex) => ({
      ...sec,
      questions: flat.filter(f => f.sectionIndex === sectionIndex).map(f => f.question),
    }))
    .filter(sec => sec.questions.length > 0);
  const answerKey = flat.map((f, i) => ({ num: i + 1, answer: f.answer, ...(f.solution ? { solution: f.solution } : {}) }));
  return { ...ws, sections, answerKey };
}

/** The flat, 0-based position of a question — how `outcomes` and edited-tracking index it. */
export function flatIndexOf(ws: WorksheetOutput, sectionIndex: number, questionIndex: number): number {
  return flatten(ws).findIndex(f => f.sectionIndex === sectionIndex && f.questionIndex === questionIndex);
}

/** This question's current answer-key text, wherever it currently sits. */
export function answerFor(ws: WorksheetOutput, sectionIndex: number, questionIndex: number): string {
  return flatten(ws).find(f => f.sectionIndex === sectionIndex && f.questionIndex === questionIndex)?.answer ?? '';
}

/** The same item without its working — see `FlatItem.solution`. */
const withoutSolution = ({ solution: _solution, ...rest }: FlatItem): FlatItem => rest;

/**
 * Patch a question's own fields (text, points) — the answer is untouched. A new
 * `text` drops this row's working; a points-only edit keeps it.
 */
export function applyWorksheetQuestionEdit(
  ws: WorksheetOutput,
  sectionIndex: number,
  questionIndex: number,
  patch: Partial<WorksheetQuestion>,
): WorksheetOutput {
  const flat = flatten(ws).map(f =>
    f.sectionIndex === sectionIndex && f.questionIndex === questionIndex
      ? { ...('text' in patch ? withoutSolution(f) : f), question: { ...f.question, ...patch } }
      : f,
  );
  return rebuild(ws, flat);
}

/**
 * Rewrite one option, carrying the answer key if that option was the answer —
 * same rule as `applyOptionEdit` in `quizEdits.ts`, just against the flat
 * answer instead of a field on the question itself.
 */
export function applyWorksheetOptionEdit(
  ws: WorksheetOutput,
  sectionIndex: number,
  questionIndex: number,
  optionIndex: number,
  next: string,
): WorksheetOutput {
  const flat = flatten(ws).map(f => {
    if (f.sectionIndex !== sectionIndex || f.questionIndex !== questionIndex) return f;
    const options = (f.question.options ?? []).map((o, i) => (i === optionIndex ? next : o));
    const wasCorrect = (f.question.options ?? [])[optionIndex] === f.answer;
    return { ...withoutSolution(f), question: { ...f.question, options }, answer: wasCorrect ? next : f.answer };
  });
  return rebuild(ws, flat);
}

/**
 * Set this question's answer directly — free-text edit, or a tap marking a
 * different option correct (the caller passes that option's own text).
 */
export function applyWorksheetAnswerEdit(
  ws: WorksheetOutput,
  sectionIndex: number,
  questionIndex: number,
  next: string,
): WorksheetOutput {
  const flat = flatten(ws).map(f =>
    f.sectionIndex === sectionIndex && f.questionIndex === questionIndex ? { ...withoutSolution(f), answer: next } : f,
  );
  return rebuild(ws, flat);
}

/**
 * Attach a book figure to one question, replace it, or remove it with `null`.
 * The question's working and the answer key are untouched: the figure is
 * something to look at, not a change to what is asked.
 */
export function applyWorksheetFigure(
  ws: WorksheetOutput,
  sectionIndex: number,
  questionIndex: number,
  figure: QuestionFigure | null,
): WorksheetOutput {
  const flat = flatten(ws).map(f => {
    if (f.sectionIndex !== sectionIndex || f.questionIndex !== questionIndex) return f;
    const { figure: _old, ...question } = f.question;
    return { ...f, question: figure ? { ...question, figure } : question };
  });
  return rebuild(ws, flat);
}

/** Remove a question and renumber the answer key so nothing points at a gap. */
export function removeWorksheetQuestionAt(
  ws: WorksheetOutput,
  sectionIndex: number,
  questionIndex: number,
): WorksheetOutput {
  const flat = flatten(ws).filter(f => !(f.sectionIndex === sectionIndex && f.questionIndex === questionIndex));
  return rebuild(ws, flat);
}
