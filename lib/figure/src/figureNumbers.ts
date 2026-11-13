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
 * A `vectors` figure is drawn on a numbered grid, so a student reads each vector's
 * components off it: every non-zero |dx| and |dy| counts as a printed number.
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
    case 'vectors':
      // Drawn on a numbered grid: a student reads each component off it, so each counts as printed.
      return f.vectors.flatMap(v => [Math.abs(v.to[0] - v.from[0]), Math.abs(v.to[1] - v.from[1])]).filter(n => n > 1e-9);
  }
}

/**
 * True when one drawn vector is the sum or the difference of two others (tip to tail or
 * from one origin): the drawing then shows the resultant a question asks for. Coordinates
 * are multiples of 0.5, so the arithmetic is exact.
 */
export function vectorsShowResult(f: VectorsFigure): boolean {
  const d = f.vectors.map(v => [v.to[0] - v.from[0], v.to[1] - v.from[1]] as const);
  const same = (a: readonly number[], x: number, y: number) => Math.abs(a[0]! - x) < 1e-9 && Math.abs(a[1]! - y) < 1e-9;
  for (let k = 0; k < d.length; k++) {
    for (let i = 0; i < d.length; i++) {
      for (let j = i + 1; j < d.length; j++) {
        if (i === k || j === k) continue;
        const a = d[i]!, b = d[j]!;
        if (same(d[k]!, a[0] + b[0], a[1] + b[1]) || same(d[k]!, a[0] - b[0], a[1] - b[1]) || same(d[k]!, b[0] - a[0], b[1] - a[1])) return true;
      }
    }
  }
  return false;
}

/**
 * True when each number the drawing prints appears, as a whole number token, in `text`.
 * A digit inside a symbol (F2, m1, v0) is not a stated number. A `vectors` figure's
 * components count as printed, and a figure that draws a sum or difference of two of its
 * own vectors (`vectorsShowResult`) always fails: it shows the answer.
 */
export function figureNumbersInText(f: PhysicsFigure, text: string): boolean {
  if (f.kind === 'vectors' && vectorsShowResult(f)) return false;
  const found = (foldDigits(text).match(STATED_NUMBER) ?? []).map(Number);
  return figureNumbers(f).every(n => found.some(m => Math.abs(m - Math.abs(n)) < 1e-9));
}
