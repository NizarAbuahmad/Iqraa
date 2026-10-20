/**
 * The order a generated evaluation is stored in.
 *
 * A ministry exam puts its question types in blocks — choice, then صح/خطأ,
 * then matching, complete, then the written answers — each under its own
 * «السؤال الأول: …» direction. A model asked for a mixed paper returns it in
 * whatever order it likes, and the mock generator rotates types, so a stored
 * paper read MCQ, written, true/false, MCQ… and the teacher screen had no
 * block to put a heading over.
 *
 * `orderIndex` is assigned from this order at insert, so every reader — the
 * teacher's list, the student's walk through the exam, a future print — sees
 * the same paper. The list itself now lives in `lib/exam-paper`, which the app
 * imports too, so there is no second copy to keep in step.
 */
export { EXAM_TYPE_ORDER, inPaperOrder } from "@workspace/exam-paper";
