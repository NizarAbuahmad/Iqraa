/**
 * Whether a student's response counts as answered.
 *
 * Its own module, importing nothing, for the reason `routeGating.ts` gives:
 * `node --test` cannot resolve the extensionless relative imports the rest of
 * this app relies on esbuild for, so anything worth unit-testing has to sit
 * clear of them.
 *
 */
export type StudentResponse = Record<string, unknown>;

export function isAnswered(response: StudentResponse | undefined): boolean {
  if (!response) return false;
  if (Array.isArray(response['optionIds'])) return (response['optionIds'] as unknown[]).length > 0;
  if (typeof response['value'] === 'boolean') return true;
  if (typeof response['text'] === 'string') return response['text'].trim().length > 0;
  if (Array.isArray(response['pairs'])) return (response['pairs'] as unknown[]).length > 0;
  if (Array.isArray(response['blanks'])) {
    return (response['blanks'] as unknown[]).some(b => typeof b === 'string' && b.trim());
  }
  return false;
}

/** One link in a matching answer. `left` and `right` are item ids, not text. */
export interface MatchPair {
  left: string;
  right: string;
}

/**
 * Sets one link, replacing any earlier link from the same left item.
 *
 * Replace, not append: `matching.grade` reads every entry in `pairs`, so a
 * student who changes their mind would otherwise hand in both the link they
 * meant and the one they abandoned.
 */
export function setMatchPair(
  pairs: readonly MatchPair[],
  leftId: string,
  rightId: string,
): MatchPair[] {
  return [...pairs.filter(p => p.left !== leftId), { left: leftId, right: rightId }];
}

/**
 * Sets one blank, padding the array out to the number of blanks in the
 * template.
 *
 * The padding is the point: `fill_blank.grade` reads `blanks[i]` against the
 * i-th `{{n}}`, so a sparse array answers the wrong questions — filling in
 * only the second blank must send `['', '…']`, never `['…']`.
 */
export function setBlankAt(
  blanks: readonly string[],
  index: number,
  value: string,
  count: number,
): string[] {
  const next = Array.from({ length: Math.max(count, blanks.length) }, (_, i) => blanks[i] ?? '');
  next[index] = value;
  return next;
}
