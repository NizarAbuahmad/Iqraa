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
  if (type === 'fill_blank') return isAr ? 'أكمل الفراغ' : 'Fill in the blank';
  return isAr ? 'إجابة قصيرة' : 'Short Answer';
}

/**
 * The order a ministry exam puts its question types in: choice, then
 * صح/خطأ, then complete, then written answers. The live prompt asks for it
 * and `normalizeQuiz` (api-server `generationShape.ts`) enforces it; the
 * offline generator builds it, so a paper reads the same whichever path made it.
 */
export const QUIZ_TYPE_ORDER: readonly QuizQuestion['type'][] =
  ['multiple_choice', 'true_false', 'fill_blank', 'short_answer'];

const ORDINAL_AR = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'];
const ORDINAL_EN = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];

/** What the student does in a block — the ministry paper's «ضع دائرة…» line. */
function blockDirection(type: QuizQuestion['type'], isAr: boolean): string {
  switch (type) {
    case 'multiple_choice':
      return isAr ? 'اختر رمز الإجابة الصحيحة فيما يأتي بوضع دائرة حوله' : 'Circle the letter of the correct answer';
    case 'true_false':
      return isAr ? 'ضع إشارة (✓) أمام العبارة الصحيحة وإشارة (✗) أمام العبارة الخاطئة' : 'Mark (✓) beside each true statement and (✗) beside each false one';
    case 'fill_blank':
      return isAr ? 'أكمل الفراغ في كل مما يأتي بما يناسبه' : 'Complete each blank with the right word or value';
    default:
      return isAr ? 'أجب عن الأسئلة الآتية' : 'Answer the following questions';
  }
}

export interface QuizBlock {
  type: QuizQuestion['type'];
  /** «السؤال الأول: اختر رمز الإجابة…» */
  heading: string;
  /** Index into the paper's flat numbering of the block's first question. */
  start: number;
  questions: QuizQuestion[];
}

/**
 * The paper's blocks, one per run of the same type — never merging runs that
 * are not adjacent, so a teacher who dragged a question elsewhere sees what
 * will print. A paper with a single type still gets its one heading.
 */
export function quizBlocks(questions: readonly QuizQuestion[], isAr: boolean): QuizBlock[] {
  const blocks: QuizBlock[] = [];
  questions.forEach((q, i) => {
    const last = blocks[blocks.length - 1];
    if (last && last.type === q.type) { last.questions.push(q); return; }
    const n = blocks.length;
    const ordinal = (isAr ? ORDINAL_AR : ORDINAL_EN)[n] ?? String(n + 1);
    blocks.push({
      type: q.type,
      heading: isAr ? `السؤال ${ordinal}: ${blockDirection(q.type, true)}` : `Question ${ordinal}: ${blockDirection(q.type, false)}`,
      start: i,
      questions: [q],
    });
  });
  return blocks;
}

/** A block's marks, for the heading's «(6 علامات)». */
export function quizBlockPoints(block: QuizBlock): number {
  return block.questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);
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
