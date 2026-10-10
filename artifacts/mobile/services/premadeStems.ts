/**
 * Which questions on a worksheet are the same question.
 *
 * One definition, used twice: by `scripts/build-premade-sheets.ts` to refuse a
 * sheet it just generated, and by `__tests__/premadeSheets.test.ts` to check
 * the frozen manifest. Two copies of "what counts as a repeat" would drift, and
 * a guard that disagrees with its test guards nothing.
 *
 * The stem is the text up to the first blank line, whitespace collapsed. That is
 * stricter than `generators.ts`'s own `questionStemKey`, which keeps a word
 * problem's instruction line: two word problems that open with the same problem
 * are one problem. The multiple-choice options are a separate field, so the same
 * question as short-answer and as multiple-choice has the same stem — which is
 * exactly the repeat this exists to catch.
 */
export interface StemSource {
  sections: Array<{ questions: Array<{ text: string }> }>;
  workedExample?: { problem: string };
}

export function stemOf(text: string): string {
  return text.split(/\n\s*\n/u)[0]!.replace(/\s+/g, ' ').trim();
}

/** One line per repeated question, e.g. `#6 repeats #3: «f(x)=x² و g(x)=x+1. …»`. Empty when none. */
export function repeatedStems(content: StemSource): string[] {
  const stems = content.sections.flatMap(section => section.questions.map(q => stemOf(q.text)));
  // The worked example is studied before the practice starts: asking it again is a repeat too.
  if (content.workedExample?.problem) stems.push(stemOf(content.workedExample.problem));
  const seen = new Map<string, number>();
  const repeats: string[] = [];
  stems.forEach((stem, index) => {
    const first = seen.get(stem);
    if (first === undefined) seen.set(stem, index + 1);
    else repeats.push(`#${index + 1} repeats #${first}: «${stem.slice(0, 60)}»`);
  });
  return repeats;
}
