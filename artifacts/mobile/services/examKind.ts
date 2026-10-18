/**
 * The two ways to make an exam, named once.
 *
 * «ورقة للطباعة» is the quiz tool: a paper to print or export, stored nowhere.
 * «تقييم يُرصد ويُصحَّح» is the Evaluations subsystem: students, a share link,
 * attempts and marks. They are different systems (STATUS.md, 2026-08-20) and
 * stay different screens. The Tools tab shows one card for both, and each
 * screen carries `ExamKindSwitch` so a teacher can change their mind without
 * going back to the tab. Routes live here so the switch and the test agree.
 */
import type { TranslationKey } from './i18n.ts';

export type ExamKind = 'paper' | 'evaluation';

export interface ExamKindDef {
  id: ExamKind;
  route: '/ai-tools/quiz' | '/evaluations';
  labelKey: TranslationKey;
  /** One line saying what this side gives you — what keeps the two from being confused. */
  hintKey: TranslationKey;
}

/** Paper first: it is the quick path, and the card on the Tools tab opens it. */
export const EXAM_KINDS: readonly ExamKindDef[] = [
  { id: 'paper', route: '/ai-tools/quiz', labelKey: 'examKindPaper', hintKey: 'examKindPaperHint' },
  { id: 'evaluation', route: '/evaluations', labelKey: 'examKindEvaluation', hintKey: 'examKindEvaluationHint' },
];

export function examKindDef(kind: ExamKind): ExamKindDef {
  return EXAM_KINDS.find(k => k.id === kind)!;
}
