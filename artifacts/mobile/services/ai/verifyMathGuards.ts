/**
 * Pure gates deciding whether a question may CLAIM symbolic verification.
 *
 * Kept free of Expo/network imports so they are unit-testable: a false
 * positive here projects "تم التحقق رياضيًا" on a classroom wall for
 * something no verifier proved, so both gates fail closed.
 */

/** True when the text looks like a derivative question the verifier supports. */
export function isDerivativeQuestion(text: string): boolean {
  return /مشتق|اشتقاق|derivative|d\/dx|f\s*'\s*\(/i.test(text);
}

/**
 * Extract the Latin expression to differentiate, e.g. "أوجد مشتقة f(x)=3x^2"
 * → "3x^2". Returns null when nothing safely parseable is present.
 * The verifier rejects Arabic notation, so only Latin math survives here.
 */
export function latinExpressionFrom(text: string): string | null {
  const normalised = text
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/[−–—]/g, '-')
    .replace(/×/g, '*');
  const m = normalised.match(/(?:f\s*\(\s*x\s*\)|y)\s*=\s*([0-9a-zA-Z+\-*/^(). ]+)/);
  const body = (m?.[1] ?? '').trim();
  if (!body) return null;
  // Must involve x and contain only math-safe characters.
  if (!/x/i.test(body)) return null;
  if (!/^[0-9a-zA-Z+\-*/^(). ]+$/.test(body)) return null;
  return body.replace(/\s+/g, '');
}
