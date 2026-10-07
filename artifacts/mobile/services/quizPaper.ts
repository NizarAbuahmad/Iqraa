/**
 * The parts that turn a generated quiz into an exam paper: the lines a student
 * writes their name, class and date on, the instructions, and the marks table
 * the teacher totals the paper in. Shared by the printed page (`exportHtml.ts`)
 * and the Word file (`quizDocx.ts`), so the two cannot drift apart.
 *
 * Everything here is derived from the questions themselves — no instruction
 * is printed for a question type the paper does not have.
 */
import type { QuizQuestion } from './ai/AIService.ts';

export function quizTypeLabel(type: QuizQuestion['type'], isAr: boolean): string {
  if (type === 'multiple_choice') return isAr ? 'اختيار متعدد' : 'MCQ';
  if (type === 'true_false') return isAr ? 'صح/خطأ' : 'True/False';
  return isAr ? 'إجابة قصيرة' : 'Short Answer';
}

export function quizStudentFields(isAr: boolean): string[] {
  return isAr ? ['الاسم', 'الصف والشعبة', 'التاريخ'] : ['Name', 'Class', 'Date'];
}

export function quizInstructions(questions: readonly QuizQuestion[], isAr: boolean): string[] {
  const lines = [isAr ? 'أجب عن جميع الأسئلة.' : 'Answer all questions.'];
  if (questions.some(q => q.options?.length)) {
    lines.push(isAr
      ? 'في أسئلة الاختيار: ضع دائرة حول رمز الإجابة الصحيحة.'
      : 'For choice questions, circle the letter of the correct answer.');
  }
  if (questions.some(q => !q.options?.length)) {
    lines.push(isAr
      ? 'في الأسئلة الأخرى: اكتب إجابتك في المكان المخصص تحت السؤال.'
      : 'For the other questions, write your answer in the space provided.');
  }
  return lines;
}

export interface QuizMarkRow {
  label: string;
  count: number;
  points: number;
}

/** One row per question type, in the order the types first appear. */
export function quizMarkRows(questions: readonly QuizQuestion[], isAr: boolean): QuizMarkRow[] {
  const rows = new Map<QuizQuestion['type'], QuizMarkRow>();
  for (const q of questions) {
    const row = rows.get(q.type) ?? { label: quizTypeLabel(q.type, isAr), count: 0, points: 0 };
    row.count += 1;
    row.points += Number(q.points) || 0;
    rows.set(q.type, row);
  }
  return [...rows.values()];
}

/** The total the paper is marked out of — the sum of what it prints. */
export function quizMarksTotal(rows: readonly QuizMarkRow[]): number {
  return rows.reduce((sum, r) => sum + r.points, 0);
}
