/**
 * Fill-blank templates store their gaps as machine tokens — «{{1}}», «{{2}}» —
 * and inside RTL text the mirrored braces read as arrows, not as blanks.
 * Nobody but the grader should ever see that syntax: replace each token with a
 * plain blank line before the text reaches a teacher or a student. With one
 * gap a bare line is enough; with several, each line keeps its number so the
 * reader can tell which answer goes where.
 *
 * Pure on purpose — `evaluations.ts` pulls in the API client, which cannot be
 * imported under `node --test`, so the helpers live here and are re-exported.
 */
const BLANK_TOKEN = /\{\{(\d+)\}\}/g;

export function countBlanks(template: string): number {
  return (template.match(BLANK_TOKEN) ?? []).length;
}

export function showBlanks(text: string): string {
  const many = countBlanks(text) > 1;
  return text.replace(BLANK_TOKEN, (_, n: string) => (many ? `______ (${n})` : '______'));
}
