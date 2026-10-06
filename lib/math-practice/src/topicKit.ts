/**
 * Shared kit for the topic generators in `topics.ts` and `algebra.ts`: the
 * item draft shape, signed/superscript/fraction formatting, and the
 * wrong-option builders (which never offer a second right answer).
 */
import type { DiffTier } from './index.ts';
import { gcd, int, type Rng } from './elementary.ts';
export { gcd, int, type Rng };

export interface Ctx { rng: Rng; diff: DiffTier; grade: number }
export interface Draft { eq: string; answer: string; wrongs: string[]; ar: string; en: string }
export interface Topic {
  id: string;
  /** Tested against the folded title (see `fold`). */
  match: RegExp;
  /** Grades the generator's numbers are sized for, inclusive. */
  grades: [number, number];
  make(c: Ctx): Draft;
}

export const tier = (d: DiffTier) => (d === 'easy' ? 0 : d === 'medium' ? 1 : 2);
export const pick = <T,>(rng: Rng, xs: readonly T[]): T => xs[int(rng, 0, xs.length - 1)]!;
export const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

/** «−5» with the real minus sign the rest of the bank uses. */
export const signed = (n: number) => (n < 0 ? `−${-n}` : String(n));
export const paren = (n: number) => (n < 0 ? `(${signed(n)})` : String(n));

export const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
export const sup = (n: number) => String(n).split('').map(c => SUP[c] ?? c).join('');

/** A signed fraction in lowest terms: «−3/4», «2», «0». Denominator is never negative. */
export function sfrac(n: number, d: number): string {
  if (n === 0) return '0';
  const g = gcd(Math.abs(n), Math.abs(d));
  let nn = n / g, dd = d / g;
  if (dd < 0) { nn = -nn; dd = -dd; }
  return dd === 1 ? signed(nn) : `${signed(nn)}/${dd}`;
}

/** «3 2/5» — a mixed number in lowest terms, from a non-negative n/d. */
export function mixed(n: number, d: number): string {
  const g = gcd(n, d);
  const nn = n / g, dd = d / g;
  const w = Math.floor(nn / dd), r = nn % dd;
  if (r === 0) return String(w);
  return w === 0 ? `${r}/${dd}` : `${w} ${r}/${dd}`;
}

/** The number a plain answer string stands for — «−3/4», «3 2/5», «35%», «0.75», «12» — or null. */
export function valueOf(s: string): number | null {
  const t = s.trim().replace('−', '-');
  let m = t.match(/^(-?\d+) (\d+)\/(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = t.match(/^(-?\d+)\/(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  m = t.match(/^(-?\d+(?:\.\d+)?)%$/);
  if (m) return Number(m[1]) / 100;
  return /^-?\d+(?:\.\d+)?$/.test(t) ? Number(t) : null;
}

/** Three distinct wrong options: the candidates first, then `near` (default answer ± k). */
export function wrongsFrom(answer: string, cands: Array<string | number>, near?: (k: number) => string): string[] {
  const out: string[] = [];
  const av = valueOf(answer);
  const take = (s: string) => {
    if (!s || s === answer || out.includes(s) || /NaN|Infinity|undefined/.test(s)) return;
    // a wrong option worth the same as the answer would be a second right one
    if (av !== null && valueOf(s) !== null && Math.abs(valueOf(s)! - av) < 1e-9) return;
    out.push(s);
  };
  cands.forEach(c => take(String(c)));
  const base = Number(answer.replace('−', '-'));
  for (let k = 1; out.length < 3 && k < 50; k++) {
    if (near) { take(near(k)); take(near(-k)); } else { take(signed(base + k)); take(signed(base - k)); }
  }
  return out.slice(0, 3);
}

/**
 * Integer answers. Plain counts never get a negative option; the signed-number
 * topics (`fmt = signed`) do, because the sign slip is the point of them.
 */
export const numWrongs = (answer: number, cands: number[], fmt: (n: number) => string = String) => {
  const ok = (n: number) => Number.isFinite(n) && (fmt !== String || n >= 0 || answer < 0);
  return wrongsFrom(fmt(answer), cands.filter(ok).map(fmt), k => (ok(answer + k) ? fmt(answer + k) : ''));
};


export const nz = (rng: Rng, m: number) => { const v = int(rng, 1, m); return rng() < 0.5 ? -v : v; };
/** A non-zero numerator in lowest terms over `d`, so the fraction is shown as it would be written. */
export function numerator(rng: Rng, d: number, m: number): number {
  for (;;) { const n = nz(rng, m); if (gcd(Math.abs(n), d) === 1) return n; }
}
