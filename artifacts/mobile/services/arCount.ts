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

/**
 * A numeric marks column arrives as «2.00»; read it as the number a teacher
 * would write. Null when it is not a number at all.
 */
function marksNumber(value: string | number): number | null {
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * «علامة واحدة» / «علامتان» / «5 علامات» / «20 علامة». The student exam used
 * to print «2.00 ع» on every question and «5 علامة» in its intro.
 *
 * `asObject` is for the phrase as a verb's object — «خسر علامتين», not
 * «خسر علامتان»; only the dual changes.
 */
export function arMarksPhrase(value: string | number, asObject = false): string {
  const n = marksNumber(value);
  if (n === null) return String(value);
  if (n === 1) return 'علامة واحدة';
  return arCountPhrase(n, 'علامة', asObject ? 'علامتين' : 'علامتان', 'علامات');
}

export function enMarksPhrase(value: string | number): string {
  const n = marksNumber(value);
  if (n === null) return String(value);
  return `${n} ${n === 1 ? 'mark' : 'marks'}`;
}

/** «سؤال واحد» / «سؤالان» / «7 أسئلة» / «15 سؤالًا». */
export function arQuestionsPhrase(n: number): string {
  if (n === 1) return 'سؤال واحد';
  if (n >= 11) return `${n} سؤالًا`;
  return arCountPhrase(n, 'سؤال', 'سؤالان', 'أسئلة');
}
