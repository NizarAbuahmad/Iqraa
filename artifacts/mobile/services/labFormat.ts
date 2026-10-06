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
