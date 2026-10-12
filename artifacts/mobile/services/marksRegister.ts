/**
 * The class marks register (سجل العلامات الجانبي): one row per student, one
 * column per exam attached to the شعبة, built from marks the app already holds.
 *
 * Pure — no fetching, no `docx` — so `node --test` can load it. The Word
 * layout is `marksRegisterDocx.ts`; the fetching is `exportClassRegister`.
 *
 * A blank cell means "no mark on record", never zero: a paper not sat, not yet
 * marked, or still provisional (a low-confidence AI mark awaiting the teacher)
 * is not a score, and writing 0 into an official register is how a child's
 * year gets mis-reported.
 */

export interface RegisterStudent {
  id: string;
  displayName: string;
}

export interface RegisterExam {
  id: string;
  title: string;
  /** Marks the paper is out of (`Evaluation.totalMarks`). */
  totalMarks: string | number;
}

/** The subset of `AttemptListRow` the register reads. */
export interface RegisterAttempt {
  studentId: string;
  result: { earnedMarks: string | number; isProvisional: boolean } | null;
}

export interface RegisterColumn {
  examId: string;
  title: string;
  outOf: number;
}

export interface RegisterRow {
  studentId: string;
  name: string;
  /** One entry per column, `null` where there is no final mark. */
  marks: (number | null)[];
  /** Sum of `marks`, only once the student has a mark for every column. */
  total: number | null;
}

export interface MarksRegister {
  columns: RegisterColumn[];
  rows: RegisterRow[];
  /** Sum of the columns' `outOf`. */
  outOf: number;
}

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Marks are stored as numeric(5,2); the register shows 7.5, not "7.50". */
export function formatMark(n: number | null): string {
  if (n === null) return '';
  return String(Math.round(n * 100) / 100);
}

export function buildMarksRegister(
  students: readonly RegisterStudent[],
  exams: readonly RegisterExam[],
  attemptsByExam: Readonly<Record<string, readonly RegisterAttempt[]>>,
): MarksRegister {
  const columns = exams.map(e => ({ examId: e.id, title: e.title, outOf: num(e.totalMarks) ?? 0 }));

  // examId → studentId → final mark
  const marksByExam = new Map<string, Map<string, number>>();
  for (const e of exams) {
    const byStudent = new Map<string, number>();
    for (const a of attemptsByExam[e.id] ?? []) {
      const earned = a.result && !a.result.isProvisional ? num(a.result.earnedMarks) : null;
      if (earned !== null) byStudent.set(a.studentId, earned);
    }
    marksByExam.set(e.id, byStudent);
  }

  const rows = students.map(s => {
    const marks = columns.map(c => marksByExam.get(c.examId)?.get(s.id) ?? null);
    const complete = marks.length > 0 && marks.every(m => m !== null);
    return {
      studentId: s.id,
      name: s.displayName,
      marks,
      total: complete ? Math.round(marks.reduce<number>((sum, m) => sum + (m ?? 0), 0) * 100) / 100 : null,
    };
  });

  return { columns, rows, outOf: columns.reduce((sum, c) => sum + c.outOf, 0) };
}
