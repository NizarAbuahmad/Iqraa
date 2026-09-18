/**
 * Folds the teacher's clarifying answers back into their own description.
 *
 * The answers could have travelled as their own request field, but keeping
 * them inside the one `prompt` string means the server contract, the
 * generation cache key and the pooling exclusion all stay exactly as they
 * were — the prompt is still the single thing that defines the deck, which is
 * the property `routes/generate.ts` relies on when it copies it into
 * `additionalContext` and marks the request unshareable.
 *
 * Pure and dependency-free so it can be tested by the bare `node --test`
 * runner, which cannot load anything importing react-native.
 */

/** A question the teacher was asked, paired with what they tapped. */
export type AnsweredQuestion = { question: string; answer: string };

/**
 * Appends an "extra detail" block, or returns the prompt untouched when the
 * teacher skipped every question. Never appends an empty heading — a trailing
 * «تفاصيل إضافية:» with nothing under it reads as a bug to the model as much
 * as to a person.
 */
export function foldAnswersIntoPrompt(
  prompt: string,
  answered: readonly AnsweredQuestion[],
  isAr: boolean,
): string {
  const lines = answered
    .filter(a => a.question.trim() && a.answer.trim())
    .map(a => `- ${a.question.trim()} ${a.answer.trim()}`);
  if (lines.length === 0) return prompt;

  const heading = isAr ? 'تفاصيل إضافية من المعلّم:' : "Extra detail from the teacher:";
  return `${prompt.trim()}\n\n${heading}\n${lines.join('\n')}`;
}
