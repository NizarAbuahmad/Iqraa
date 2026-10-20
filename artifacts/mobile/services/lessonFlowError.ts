/**
 * What the lesson-flow screen shows when a step fails.
 *
 * A coded failure (`aiErrorMessageKey`: quota, live mode off, no question bank)
 * is shown as its translated sentence, as every other generator screen does,
 * not as the raw English the throwing code wrote. Anything uncoded keeps its own
 * message, as it always did here.
 *
 * `retryable` is false for the one failure that cannot change on a second try:
 * a subject with no offline question bank, when no live call failed first (a
 * failed live call is worth retrying). Free of react-native so `node --test`
 * can load it.
 */
import { aiErrorMessageKey, aiErrorText, liveFailureOf } from './ai/aiProvenance.ts';

export function lessonFlowFailure(
  err: unknown,
  t: (key: ReturnType<typeof aiErrorMessageKey> | 'aiErrorReason') => string,
): { message: string; retryable: boolean } {
  const coded = aiErrorMessageKey(err) !== 'generationFailed';
  const code = (err as { code?: unknown } | null)?.code;
  return {
    message: coded ? aiErrorText(err, t) : (err instanceof Error ? err.message : 'Generation failed'),
    retryable: !(code === 'no_question_bank' && !liveFailureOf(err)),
  };
}

/**
 * The line under a failed step's name. «Retry» is only an instruction while the
 * banner below really offers one: a failure that cannot change on a second try
 * (`retryable` false) must not send the teacher to a button that is not there.
 */
export function failedStepHint(lang: string, retryable: boolean): string {
  const ar = lang === 'ar';
  if (retryable) return ar ? 'تعذّر إكمال الخطوة — أعد المحاولة' : 'Failed — tap Retry below';
  return ar ? 'تعذّر إكمال هذه الخطوة' : 'This step could not be completed';
}
