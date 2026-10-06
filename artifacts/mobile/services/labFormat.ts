/**
 * Display formatting for lab numbers.
 *
 * Everything upstream is latin; this is the only place digits become
 * Arabic-Indic. Scientific notation returns mantissa and exponent separately
 * because the screen raises the exponent in its own `Text` — Arabic-Indic
 * digits have no superscript forms.
 */
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const MINUS = '−';

export function toArabicDigits(s: string): string {
  return s.replace(/[0-9]/g, d => AR_DIGITS[Number(d)]).replace(/\./g, '٫');
}

/**
 * The inverse of `toArabicDigits`, for input: a teacher on an Arabic or
 * European keyboard types «٣٦», «١٫٥» or "1,5", and all three mean a number.
 * Arabic-Indic and Persian digits become latin, and one «٫» or «,» becomes ".".
 *
 * It is strict on purpose. `Number()` would also accept "1e5", "Infinity",
 * "0x10" and "" (as 0), and a calculator that quietly reads those prints an
 * answer for something nobody meant. Anything that is not a plain non-negative
 * decimal is NaN, which callers report as "enter a number" instead of guessing.
 */
export function parseLabNumber(input: string): number {
  const latin = input
    .trim()
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٫,]/, '.');
  return /^(\d+\.?\d*|\.\d+)$/.test(latin) ? Number(latin) : Number.NaN;
}

function localise(s: string, lang: 'ar' | 'en'): string {
  return lang === 'ar' ? toArabicDigits(s) : s;
}

export function formatLabNumber(n: number, lang: 'ar' | 'en', maxFractionDigits = 2): string {
  if (!Number.isFinite(n)) return '—';
  const rounded = Number(n.toFixed(maxFractionDigits));
  const text = String(Object.is(rounded, -0) ? 0 : rounded);
  return localise(text, lang);
}

export function formatScientific(
  n: number,
  lang: 'ar' | 'en',
  sig = 4,
): { mantissa: string; exponent: string | null } {
  if (!Number.isFinite(n)) return { mantissa: '—', exponent: null };
  if (n === 0) return { mantissa: localise('0', lang), exponent: null };
  const [m, e] = n.toExponential(Math.max(0, sig - 1)).split('e');
  const mantissa = m.includes('.') ? m.replace(/0+$/, '').replace(/\.$/, '') : m;
  const exp = Number(e);
  const expText = `${exp < 0 ? MINUS : ''}${Math.abs(exp)}`;
  return { mantissa: localise(mantissa, lang), exponent: localise(expText, lang) };
}
