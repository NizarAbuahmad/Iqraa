/**
 * A physics drawing may print givens (20 m/s, 30°), so a label-only guard is not
 * enough to stop it showing an answer. This one is: every number the drawing
 * prints must also be in the question, so the drawing can only repeat what the
 * student is already told. The figure cannot see its question; the caller runs this.
 */
import type { PhysicsFigure } from './sceneTypes.ts';
import type { VectorsFigure } from './types.ts';

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

/** Arabic-Indic and Persian digits to Latin; «٫» or «،» between two digits to a decimal point. */
export function foldDigits(text: string): string {
  return text
    .replace(/[٠-٩]/gu, d => String(ARABIC_INDIC.indexOf(d)))
    .replace(/[۰-۹]/gu, d => String(PERSIAN.indexOf(d)))
    .replace(/(\d)[٫،](?=\d)/gu, '$1.');
}

/**
 * A number as the question states it: not the digit of a symbol (F2, m1, v0, x2, H2O),
 * so the digit may not follow a Latin, Greek or Arabic letter, an underscore, another
 * digit or a point. Tatweel (U+0640) may precede it, so «بـ20» states 20.
 * Written with \u escapes so no tool can mangle the ranges; `-` is never a range by accident.
 */
const STATED_NUMBER = /(?<![A-Za-z\u0370-\u03FF\u0621-\u063A\u0641-\u064A_0-9.])\d+(?:\.\d+)?/gu;

/**
 * Every number the drawing prints, in the order the renderer prints them.
 *
 * A `vectors` figure is drawn on a numbered grid and its alt text prints every end point,
 * so a student reads both off it: for each vector in turn, its non-zero |dx| and |dy|,
 * then the non-zero coordinates of its tail and its tip, each distinct value once.
 * The end points matter: in a tip-to-tail chain the last tip IS the resultant.
 */
export function figureNumbers(f: PhysicsFigure): number[] {
  switch (f.kind) {
    case 'forces':
      return [...(f.incline !== undefined ? [f.incline] : []), ...f.arrows.flatMap(a => (a.value ? [a.value.n] : []))];
    case 'attraction':
      return f.distance?.value ? [f.distance.value.n] : [];
    case 'projectile':
      return [...(f.angle !== undefined ? [f.angle] : []), ...(f.speed ? [f.speed.n] : []), ...(f.height ? [f.height.n] : [])];
    case 'circular':
      return f.radius?.value ? [f.radius.value.n] : [];
    case 'wave':
      return [...(f.amplitude ? [f.amplitude.n] : []), ...(f.wavelength ? [f.wavelength.n] : [])];
    case 'vectors': {
      // Drawn on a numbered grid with every end point in the alt text: components and end points both count.
      const seen: number[] = [];
      for (const v of f.vectors) {
        const values = [v.to[0] - v.from[0], v.to[1] - v.from[1], v.from[0], v.from[1], v.to[0], v.to[1]];
        for (const n of values.map(Math.abs)) {
          if (n > 1e-9 && !seen.some(m => Math.abs(m - n) < 1e-9)) seen.push(n);
        }
      }
      return seen;
    }
  }
}

/**
 * True when some drawn vector d[k] equals Σ c_i·d[i] over the OTHER drawn vectors, with
 * every c_i ∈ {−1, 0, 1} and at least two c_i non-zero: the drawing then shows the sum,
 * the difference, the equilibrant (the negative of a sum) or the resultant of any number
 * of drawn vectors — the answer a question asks for. A vector and its opposite alone are
 * not a sum (one non-zero coefficient). Coordinates are multiples of 0.5, so the
 * arithmetic is exact; at most 5 vectors means at most 81 combinations for each.
 */
export function vectorsShowResult(f: VectorsFigure): boolean {
  const d = f.vectors.map(v => [v.to[0] - v.from[0], v.to[1] - v.from[1]] as const);
  for (let k = 0; k < d.length; k++) {
    const others = d.filter((_, i) => i !== k);
    const combos = 3 ** others.length;
    for (let code = 0; code < combos; code++) {
      let x = 0, y = 0, nonZero = 0, rest = code;
      for (const o of others) {
        const c = (rest % 3) - 1;
        rest = Math.floor(rest / 3);
        if (c === 0) continue;
        nonZero++;
        x += c * o[0];
        y += c * o[1];
      }
      if (nonZero >= 2 && Math.abs(d[k]![0] - x) < 1e-9 && Math.abs(d[k]![1] - y) < 1e-9) return true;
    }
  }
  return false;
}

/**
 * True when each number the drawing prints appears, as a whole number token, in `text`.
 * A digit inside a symbol (F2, m1, v0) is not a stated number. A `vectors` figure's
 * components and end points count as printed. Two drawings always fail, whatever the
 * question states, because they show the answer: a `vectors` figure with a drawn signed
 * sum of its own vectors (`vectorsShowResult`), and a `wave` that draws the sum of its
 * two waves (`second.sum`).
 */
export function figureNumbersInText(f: PhysicsFigure, text: string): boolean {
  if (f.kind === 'vectors' && vectorsShowResult(f)) return false;
  if (f.kind === 'wave' && f.second?.sum === true) return false;
  const found = (foldDigits(text).match(STATED_NUMBER) ?? []).map(Number);
  return figureNumbers(f).every(n => found.some(m => Math.abs(m - Math.abs(n)) < 1e-9));
}
