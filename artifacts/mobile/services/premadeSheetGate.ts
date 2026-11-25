/**
 * The build-time gate on ready-made sheets: refuse a question a child cannot
 * answer from the page. Used by `scripts/build-premade-sheets.ts`, which draws
 * the sheet again instead of writing it to the manifest.
 *
 * The case it exists for: a «which one» question with nothing to pick from —
 * «أيّ وحدة أنسب لقياس طول الكتاب؟» keyed «مشبك الورق». A teacher marking with
 * that key marks a right answer wrong. The maths bank now keeps a pick's
 * options in every slot (`formatItem`, lib/math-practice), so this should find
 * nothing; it stays as the last check before a frozen sheet ships, since a
 * frozen sheet is served to every teacher of its grade.
 *
 * The rule is the bank's own (`isUnlistedPick` in lib/math-practice/src/picks.ts),
 * so the two cannot drift: a question passes if its options include the key,
 * or if it is not a pick, or if the key is in its own text. Pure, so it can be
 * tested under bare `node --test`.
 */
import { isUnlistedPick } from '@workspace/math-practice';
import type { WorksheetOutput } from './ai/AIService.ts';

/** The first line of each question that cannot be answered from the page. */
export function unanswerableQuestions(content: WorksheetOutput): string[] {
  const answers = new Map(content.answerKey.map(entry => [entry.num, entry.answer]));
  const found: string[] = [];
  let num = 0;
  for (const section of content.sections) {
    for (const question of section.questions ?? []) {
      num += 1;
      const answer = answers.get(num) ?? '';
      if (question.options?.includes(answer)) continue;
      if (isUnlistedPick(question.text, answer)) found.push(question.text.split('\n')[0] ?? '');
    }
  }
  return found;
}
