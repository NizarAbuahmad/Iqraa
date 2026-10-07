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
 * Arabic-Indic and Persian digits become latin, and one «٫» or "," becomes ".".
 *
 * Two things are refused rather than guessed. A lone ASCII comma or «٬» between
 * digits and exactly three more digits ("1,000", "12,345", "0,500") is either a
 * thousands mark or a decimal one, and reading it as a decimal silently turns
 * "1,000" into 1; it is NaN. «٫» is always a decimal mark, so «١٫٠٠٠» is 1.
 *
 * Scientific input is accepted in one strict shape so the book's values can be
 * typed: a mantissa, then `e`/`E` or `×10^` / `x10^` / `*10^`, then an optional
 * sign and 1–3 digits ("6.022e23", "6.022×10^23", "5e-3").
 *
 * Everything else is NaN, which callers report as "enter a number" instead of
 * guessing. `Number()` would also accept "Infinity", "0x10" and "" (as 0). The
 * result is finite or NaN, never Infinity.
 */
export function parseLabNumber(input: string): number {
  const latin = input
    .trim()
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06f0));
  const m = /^([\d.,٫٬]+)(?:[eE]([+\-−]?\d{1,3})|\s*[×x*]\s*10\s*\^\s*([+\-−]?\d{1,3}))?$/.exec(latin);
  if (!m) return Number.NaN;
  const [, rawMantissa, e1, e2] = m;
  if (/^\d+[,٬]\d{3}$/.test(rawMantissa)) return Number.NaN;
  const mantissa = rawMantissa.replace(/[٫,]/, '.');
  if (!/^(\d+\.?\d*|\.\d+)$/.test(mantissa)) return Number.NaN;
  const exponent = (e1 ?? e2 ?? '0').replace('−', '-');
  const n = Number(`${mantissa}e${exponent}`);
  return Number.isFinite(n) ? n : Number.NaN;
}

function localise(s: string, lang: 'ar' | 'en'): string {
  return lang === 'ar' ? toArabicDigits(s) : s;
}

const TIMES_TEN = { ar: ' × ١٠', en: ' × 10' } as const;

export function formatLabNumber(n: number, lang: 'ar' | 'en', maxFractionDigits = 2): string {
  if (!Number.isFinite(n)) return '—';
  // Past 1e21 `toFixed` and `String` both fall back to JS e-notation, which
  // nobody should read; so does a tiny value with many fraction digits.
  const scientific = () => {
    const { mantissa, exponent } = formatScientific(n, lang);
    return `${mantissa} × ${localise('10', lang)}^${exponent ?? ''}`;
  };
  if (Math.abs(n) >= 1e21) return scientific();
  const rounded = Number(n.toFixed(maxFractionDigits));
  const text = String(Object.is(rounded, -0) ? 0 : rounded);
  if (text.includes('e')) return scientific();
  return localise(text, lang);
}

/**
 * A result row's value. Ordinary magnitudes print as `formatLabNumber`; a
 * non-zero value below 1e-3 or from 1e6 up prints as scientific, because
 * `formatLabNumber` shows 1000 particles (1.66e-21 mol) as "0". The screen
 * raises `exponent` in its own `Text`, so `text` ends at «× 10».
 */
export function formatLabQuantity(
  n: number,
  lang: 'ar' | 'en',
  fractionDigits: number,
): { text: string; exponent: string | null } {
  if (Number.isFinite(n) && n !== 0 && (Math.abs(n) < 1e-3 || Math.abs(n) >= 1e6)) {
    const { mantissa, exponent } = formatScientific(n, lang);
    return { text: exponent === null ? mantissa : `${mantissa}${TIMES_TEN[lang]}`, exponent };
  }
  return { text: formatLabNumber(n, lang, fractionDigits), exponent: null };
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
