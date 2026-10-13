/**
 * An exam paper's blocks: one per run of the same question type, each under a
 * ministry-style «السؤال الأول: …» direction.
 *
 * Shared by the quiz (`quizPaper.ts` → PDF, Word, text) and the evaluation
 * screen, which have different question shapes (`points` vs `marks`, three
 * types vs ten) but one paper convention. Pure, so `node --test` can load it.
 */

const ORDINAL_AR = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
const ORDINAL_EN = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

/**
 * The order a ministry exam puts its question types in: choice, then
 * صح/خطأ, matching, complete, then the written answers, then the practical.
 * Keep in step with `EXAM_TYPE_ORDER` in
 * `artifacts/api-server/src/modules/assessment/paperOrder.ts`, which is what
 * stores a generated evaluation in this order.
 */
export const EXAM_TYPE_ORDER: readonly string[] = [
  'multiple_choice', 'true_false', 'matching', 'fill_blank',
  'short_answer', 'open_ended', 'problem_solving', 'practical_task',
  'read_aloud', 'dictation',
];

/** What the student does in a block — the ministry paper's «ضع دائرة…» line. */
export function examBlockDirection(type: string, isAr: boolean): string {
  switch (type) {
    case 'multiple_choice':
      return isAr ? 'اختر رمز الإجابة الصحيحة فيما يأتي بوضع دائرة حوله' : 'Circle the letter of the correct answer';
    case 'true_false':
      return isAr ? 'ضع إشارة (✓) أمام العبارة الصحيحة وإشارة (✗) أمام العبارة الخاطئة' : 'Mark (✓) beside each true statement and (✗) beside each false one';
    case 'matching':
      return isAr ? 'صِل كل عنصر في العمود الأول بما يناسبه من العمود الثاني' : 'Match each item in the first column with its partner in the second';
    case 'fill_blank':
      return isAr ? 'أكمل الفراغ في كل مما يأتي بما يناسبه' : 'Complete each blank with the right word or value';
    case 'open_ended':
      return isAr ? 'أجب عن الأسئلة الآتية بالتفصيل' : 'Answer the following questions in detail';
    case 'problem_solving':
      return isAr ? 'حُلَّ المسائل الآتية موضِّحًا خطوات الحل' : 'Solve the following problems, showing your working';
    case 'practical_task':
      return isAr ? 'نفِّذ المهمة العملية الآتية' : 'Carry out the following practical task';
    case 'read_aloud':
      return isAr ? 'اقرأ النص الآتي بصوت عالٍ' : 'Read the following passage aloud';
    case 'dictation':
      return isAr ? 'اكتب ما تسمعه' : 'Write what you hear';
    default:
      return isAr ? 'أجب عن الأسئلة الآتية' : 'Answer the following questions';
  }
}

/** «السؤال الأول: …» for the nth block (0-based). */
export function examBlockHeading(type: string, n: number, isAr: boolean): string {
  const ordinal = (isAr ? ORDINAL_AR : ORDINAL_EN)[n] ?? String(n + 1);
  return isAr
    ? `السؤال ${ordinal}: ${examBlockDirection(type, true)}`
    : `Question ${ordinal}: ${examBlockDirection(type, false)}`;
}

export interface ExamBlock<Q extends { type: string }> {
  type: Q['type'];
  heading: string;
  /** Index into the paper's flat numbering of the block's first question. */
  start: number;
  questions: Q[];
}

/**
 * One block per run of the same type — never merging runs that are not
 * adjacent, so a teacher who added a question at the end sees what will print.
 * A paper of one type still gets its one heading.
 */
export function examBlocks<Q extends { type: string }>(questions: readonly Q[], isAr: boolean): ExamBlock<Q>[] {
  const blocks: ExamBlock<Q>[] = [];
  questions.forEach((q, i) => {
    const last = blocks[blocks.length - 1];
    if (last && last.type === q.type) { last.questions.push(q); return; }
    blocks.push({ type: q.type, heading: examBlockHeading(q.type, blocks.length, isAr), start: i, questions: [q] });
  });
  return blocks;
}

/** A block's marks, whatever the question calls them (`points` or `marks`). */
export function examBlockMarks<Q extends { type: string }>(block: ExamBlock<Q>, marksOf: (q: Q) => number | string): number {
  return block.questions.reduce((sum, q) => sum + (Number(marksOf(q)) || 0), 0);
}
