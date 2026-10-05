/**
 * Does this question point at a figure?
 *
 * The book's figures are attached to a paper by lesson, never to a single
 * question (see `BookFiguresPanel`: the model that wrote the questions never saw
 * them). So the only honest cue for "look at a figure now" is the question's
 * own words — «انظر الشكل المجاور», «في الرسم البياني», "the diagram shows".
 *
 * Deliberately loose: a false positive shows a figure nobody needed, which is
 * what every question used to do; a false negative hides one a student needed.
 * Harakat are stripped first, because «الشَّكْل» does not contain «شكل» until
 * they are gone.
 */
const HARAKAT = /[ً-ْٰـ]/g;
const FIGURE_WORD = /شكل|رسم|مخطط|خريطة|خارطة|صورة|figure|diagram|graph|picture|\bmap\b|chart/i;

/** Every string anywhere in a question body (prompt, options, pairs, blanks…). */
function collectText(value: unknown, out: string[], depth = 0): void {
  if (typeof value === 'string') out.push(value);
  else if (depth < 4 && Array.isArray(value)) value.forEach(v => collectText(v, out, depth + 1));
  else if (depth < 4 && value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach(v => collectText(v, out, depth + 1));
  }
}

export function questionRefersToFigure(body: unknown): boolean {
  const parts: string[] = [];
  collectText(body, parts);
  return FIGURE_WORD.test(parts.join(' ').replace(HARAKAT, ''));
}
