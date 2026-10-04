/**
 * Whether a question on the teacher's marking screen came from a paper exam
 * the app never saw — no text to show, no answer to type, only a mark.
 *
 * A paper question is what `PUT /evaluations/:id/questions/paper` stores: an
 * open-answer type with an empty body. The screen used to test "no `prompt`"
 * on every question, but only the open-answer types keep their text in
 * `prompt` — multiple choice uses `stem`, true/false `statement`, matching
 * `left`/`right`, fill-in `template` — so it labelled every one of those
 * «سؤال من الورقة» directly under the answer it had just rendered.
 *
 * Its own module so the bare `node --test` runner can load it.
 */
const OPEN_ANSWER_TYPES = new Set(['open_ended', 'short_answer', 'problem_solving', 'practical_task']);

export function isPaperQuestion(question: { type: string; body?: Record<string, unknown> | null }): boolean {
  if (!OPEN_ANSWER_TYPES.has(question.type)) return false;
  const prompt = question.body?.['prompt'];
  return !(typeof prompt === 'string' && prompt.trim());
}
