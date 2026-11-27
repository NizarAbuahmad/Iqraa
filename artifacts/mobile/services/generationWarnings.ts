/**
 * Which of a generated exam's warning lists to show: `warningsAr` to an Arabic
 * teacher when the API sent one that lines up with `warnings`, otherwise the
 * English `warnings` (an older API sends only those).
 */
export function generationWarnings(
  result: { warnings?: readonly string[]; warningsAr?: readonly string[] },
  lang: string,
): string[] {
  const en = result.warnings ?? [];
  const ar = result.warningsAr;
  if (lang === 'ar' && ar && ar.length === en.length) return [...ar];
  return [...en];
}
