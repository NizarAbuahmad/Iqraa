/**
 * Export a class's marks register as Word. Fetches each exam's attempts, then
 * hands the pure builders (`marksRegister.ts`, `marksRegisterDocx.ts`) the rows.
 *
 * Kept apart from them because it imports `share.ts` (React Native), which
 * `node --test` cannot load.
 */
import { listAttempts, type Evaluation } from './evaluations';
import { buildMarksRegister } from './marksRegister';
import { buildMarksRegisterDocx } from './marksRegisterDocx';
import type { RosterStudent } from './roster';
import { exportBuiltWord } from './share';

export async function exportClassRegister(args: {
  className: string;
  subject: string;
  grade: string;
  students: readonly RosterStudent[];
  exams: readonly Evaluation[];
  isAr: boolean;
}): Promise<void> {
  // A draft has no sittings. One failed fetch fails the export: a register
  // with a silently empty column reads as "nobody sat it", which is worse than
  // no file.
  const exams = args.exams.filter(e => e.status !== 'draft');
  const fetched = await Promise.all(exams.map(async e => [e.id, await listAttempts(e.id)] as const));
  const register = buildMarksRegister(
    args.students,
    exams.map(e => ({ id: e.id, title: (args.isAr ? e.titleAr : e.title) || e.title || e.titleAr, totalMarks: e.totalMarks })),
    Object.fromEntries(fetched),
  );
  const filename = `${args.isAr ? 'سجل-العلامات' : 'marks-register'}-${args.className}.docx`.replace(/[\\/:*?"<>|\s]+/g, '-');
  await exportBuiltWord(docx => buildMarksRegisterDocx(register, args, args.isAr, docx), filename);
}
