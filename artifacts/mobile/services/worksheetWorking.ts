/**
 * Which of a worksheet's step-by-step working did a person review?
 *
 * The offline question bank's working was written and checked by hand, and the
 * generator that draws from it marks what it takes with `fromBank`. Live AI
 * writes its own worked example and key working, and nobody reviews those: a
 * neat numbered solution looks the same either way, so the screen says which
 * it is. `fromBank` is the only mark that can claim "reviewed" — absence means
 * AI-written, and the server strips the mark from anything a model returns
 * (`sanitizeWorksheetExtras`), so a model cannot award it to itself.
 *
 * Pure, so `node --test` covers it; the screens only draw the result.
 */
import type { WorksheetOutput } from './ai/AIService.ts';

export interface WorkingProvenance {
  /** The worked example: reviewed ('bank'), written by a model ('ai'), or absent. */
  example: 'bank' | 'ai' | null;
  /** Answer-key rows that carry step-by-step working. */
  keyWithWorking: number;
  /** Of those, the rows whose question is not marked as drawn from the bank. */
  unreviewedKeyLines: number;
  /** True when anything a teacher might take for reviewed working was not. */
  needsAiNote: boolean;
}

export function workingProvenance(out: Pick<WorksheetOutput, 'workedExample' | 'sections' | 'answerKey'>): WorkingProvenance {
  const example = out.workedExample ? (out.workedExample.fromBank ? 'bank' : 'ai') : null;
  // `answerKey[].num` is the 1-based flat position of the question, in on-paper order.
  const flat = out.sections.flatMap(sec => sec.questions);
  const withWorking = out.answerKey.filter(item => (item.solution?.length ?? 0) > 0);
  // A row whose question cannot be found counts as unreviewed: never promote
  // working to "reviewed" on a guess.
  const unreviewedKeyLines = withWorking.filter(item => flat[item.num - 1]?.fromBank !== true).length;
  return {
    example,
    keyWithWorking: withWorking.length,
    unreviewedKeyLines,
    needsAiNote: example === 'ai' || unreviewedKeyLines > 0,
  };
}
