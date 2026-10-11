/**
 * Memorisation helpers for one ayah, kept pure so they can be tested without
 * React. Nothing here edits the text: an ayah is split into words, and a word is
 * hidden or shown. Showing every word gives back the source string exactly.
 */

/** Arabic letters. A token with none of these is a mark (waqf sign, ayah-end sign …). */
const LETTER = /[ء-يٱ-ۓۺ-ۿ]/;

export type HideLevel = 'none' | 'every3' | 'every2' | 'secondHalf' | 'firstWordHint' | 'all';

export const HIDE_LEVELS: readonly HideLevel[] = ['none', 'every3', 'every2', 'secondHalf', 'firstWordHint', 'all'];

/**
 * Split an ayah into words. A token made only of marks is glued, with its
 * space, to the word before it, so it can never be hidden on its own.
 * `words.join(' ')` equals the input whenever the input has single spaces,
 * which every line of the source does (a test checks all of them).
 */
export function tokenizeAyah(text: string): string[] {
  const words: string[] = [];
  for (const raw of text.split(' ')) {
    if (raw === '') continue;
    if (!LETTER.test(raw) && words.length > 0) {
      words[words.length - 1] += ' ' + raw;
    } else {
      words.push(raw);
    }
  }
  return words;
}

/**
 * Which words are hidden at a level. Deterministic: the same ayah looks the
 * same every time, so a learner can compare their own attempts.
 */
export function hiddenFlags(wordCount: number, level: HideLevel): boolean[] {
  return Array.from({ length: wordCount }, (_, i) => {
    switch (level) {
      case 'none':
        return false;
      case 'every3':
        return (i + 1) % 3 === 0;
      case 'every2':
        return (i + 1) % 2 === 0;
      case 'secondHalf':
        return i >= Math.floor(wordCount / 2);
      case 'firstWordHint':
        return i > 0;
      case 'all':
        return true;
    }
  });
}
