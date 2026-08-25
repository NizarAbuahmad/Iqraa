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
