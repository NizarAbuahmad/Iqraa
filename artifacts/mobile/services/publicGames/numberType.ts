/**
 * Which number? (/play/numberType) — find the even, odd or prime number among
 * four. Grades 3–6. Every answer is computed, never typed in.
 *
 * It is "which of these four is X", not "is N even, odd or prime": 7 is both
 * odd and prime, so a three-label question would have two correct answers.
 * Here each kind is unique by construction — one even among three odds, one
 * odd among three evens, one prime among three composites. The range starts at
 * 4 and stops at 60: 1 is not prime, and 2 is both even and prime.
 */
import { sample, shuffle } from './rng.ts';
import { pickOne, type TextQuestion } from './textQuiz.ts';
import { toArabicDigits } from '../labFormat.ts';
import type { TranslationKey } from '../i18n.ts';

export type NumberKind = 'even' | 'odd' | 'prime';

export const NUMBER_MIN = 4;
export const NUMBER_MAX = 60;

export function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

const RANGE = Array.from({ length: NUMBER_MAX - NUMBER_MIN + 1 }, (_, i) => NUMBER_MIN + i);
const EVENS = RANGE.filter(n => n % 2 === 0);
const ODDS = RANGE.filter(n => n % 2 === 1);
const PRIMES = RANGE.filter(isPrime);
const COMPOSITES = RANGE.filter(n => !isPrime(n));

const ANSWERS: Record<NumberKind, number[]> = { even: EVENS, odd: ODDS, prime: PRIMES };
const WRONG: Record<NumberKind, number[]> = { even: ODDS, odd: EVENS, prime: COMPOSITES };
const PROMPT: Record<NumberKind, TranslationKey> = {
  even: 'playNumberEvenPrompt',
  odd: 'playNumberOddPrompt',
  prime: 'playNumberPrimePrompt',
};
const KINDS: NumberKind[] = ['even', 'odd', 'prime'];

const label = (n: number, lang: 'ar' | 'en') => (lang === 'ar' ? toArabicDigits(String(n)) : String(n));

/** `used` holds answers already asked this round, so a number is not the answer twice. */
export function buildNumberQuestion(
  kind: NumberKind,
  lang: 'ar' | 'en',
  rng: () => number = Math.random,
  used: Set<number> = new Set(),
): TextQuestion {
  const fresh = ANSWERS[kind].filter(n => !used.has(n));
  const answer = pickOne(fresh.length > 0 ? fresh : ANSWERS[kind], rng);
  used.add(answer);
  const wrong = sample(WRONG[kind], 3, rng);
  return {
    promptKey: PROMPT[kind],
    options: shuffle([answer, ...wrong].map(n => ({ id: String(n), label: label(n, lang) })), rng),
    correctId: String(answer),
  };
}

/** `count` questions cycling through the three kinds, in random order. */
export function buildNumberRound(lang: 'ar' | 'en', count: number, rng: () => number = Math.random): TextQuestion[] {
  const kinds = shuffle(Array.from({ length: count }, (_, i) => KINDS[i % KINDS.length]!), rng);
  const used = new Set<number>();
  return kinds.map(kind => buildNumberQuestion(kind, lang, rng, used));
}
