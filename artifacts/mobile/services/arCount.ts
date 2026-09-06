/**
 * Generic Arabic counted-noun agreement, same four-case rule as
 * arCountStudents in i18n.ts: one takes the noun alone, two takes the dual,
 * three to ten take the plural, eleven upward return to the accusative
 * singular. Use this wherever a raw `${n} نقطة`-style template would
 * misdecline for the 2–10 range.
 */
export function arCountPhrase(n: number, sing: string, dual: string, plural: string): string {
  if (n === 1) return sing;
  if (n === 2) return dual;
  if (n >= 3 && n <= 10) return `${n} ${plural}`;
  return `${n} ${sing}`;
}
