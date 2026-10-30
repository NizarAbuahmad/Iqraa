/**
 * Compare fractions (/play/fractions) — which of two fractions is larger (or
 * smaller)? Grades 4–7. Computed, not authored.
 *
 * Only reduced proper fractions are used, so two different ones never have the
 * same value and "which is larger" always has one answer. The answer is
 * decided by cross-multiplication, so no floating point is compared.
 * Labels are wrapped in a left-to-right override (`forceLtr`): Arabic-Indic
 * digits around a slash otherwise print in the wrong order on the web.
 */
import { shuffle } from './rng.ts';
import { pickOne, type TextQuestion } from './textQuiz.ts';
import { toArabicDigits } from '../labFormat.ts';
import { forceLtr } from '../mathCalc.ts';

export interface Fraction {
  n: number;
  d: number;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

export const FRACTIONS: Fraction[] = Array.from({ length: 11 }, (_, i) => i + 2).flatMap(d =>
  Array.from({ length: d - 1 }, (_, j) => j + 1)
    .filter(n => gcd(n, d) === 1)
    .map(n => ({ n, d })),
);

export type FractionKind = 'larger' | 'smaller';

const id = (f: Fraction) => `${f.n}/${f.d}`;
const label = (f: Fraction, lang: 'ar' | 'en') => forceLtr(lang === 'ar' ? toArabicDigits(id(f)) : id(f));
/** a > b without division. */
const greater = (a: Fraction, b: Fraction) => a.n * b.d > b.n * a.d;

function pickPair(rng: () => number): [Fraction, Fraction] {
  const a = pickOne(FRACTIONS, rng);
  const b = pickOne(FRACTIONS.filter(f => id(f) !== id(a)), rng);
  return [a, b];
}

/** "1/3 ≈ 0.33": `=` only when two decimals are exact. Digits follow the language; the caller wraps the joined line in `forceLtr`. */
const decimal = (f: Fraction, lang: 'ar' | 'en') => {
  const value = f.n / f.d;
  const exact = Number(value.toFixed(2)) === value;
  const raw = id(f);
  const dec = value.toFixed(2);
  const shown = (s: string) => (lang === 'ar' ? toArabicDigits(s) : s);
  return `${shown(raw)} ${exact ? '=' : '≈'} ${shown(dec)}`;
};

function questionFor(kind: FractionKind, lang: 'ar' | 'en', a: Fraction, b: Fraction, rng: () => number): TextQuestion {
  const winner = (kind === 'larger') === greater(a, b) ? a : b;
  const ordered = shuffle([a, b], rng);
  return {
    promptKey: kind === 'larger' ? 'playFractionLargerPrompt' : 'playFractionSmallerPrompt',
    options: ordered.map(f => ({ id: id(f), label: label(f, lang) })),
    correctId: id(winner),
    explanation: lang === 'ar' ? 'حوّل كل كسر إلى عدد عشري لتقارن بينهما:' : 'Turn each fraction into a decimal to compare:',
    explanationLtr: forceLtr(ordered.map(f => decimal(f, lang)).join('    ')),
  };
}

export function buildFractionQuestion(kind: FractionKind, lang: 'ar' | 'en', rng: () => number = Math.random): TextQuestion {
  const [a, b] = pickPair(rng);
  return questionFor(kind, lang, a, b, rng);
}

/** `count` questions, alternating larger/smaller in random order, never the same pair twice. */
export function buildFractionRound(lang: 'ar' | 'en', count: number, rng: () => number = Math.random): TextQuestion[] {
  const kinds = shuffle(Array.from({ length: count }, (_, i): FractionKind => (i % 2 === 0 ? 'larger' : 'smaller')), rng);
  const seen = new Set<string>();
  return kinds.map(kind => {
    let a: Fraction, b: Fraction, key: string;
    do {
      [a, b] = pickPair(rng);
      key = [id(a), id(b)].sort().join('|');
    } while (seen.has(key));
    seen.add(key);
    return questionFor(kind, lang, a, b, rng);
  });
}
