/**
 * A physics drawing may print givens (20 m/s, 30°), so a label-only guard is not
 * enough to stop it showing an answer. This one is: every number the drawing
 * prints must also be in the question, so the drawing can only repeat what the
 * student is already told. The figure cannot see its question; the caller runs this.
 */
import type { PhysicsFigure } from './sceneTypes.ts';

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
 * A `vectors` figure returns [] (so `figureNumbersInText` always passes it), yet it is
 * drawn on a numbered grid and its alt text prints end points: this guard does not
 * judge vectors, and a caller that draws one must judge it some other way.
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
      return [];
  }
}

/**
 * True when each number the drawing prints appears, as a whole number token, in `text`.
 * A digit inside a symbol (F2, m1, v0) is not a stated number. Always true for a
 * `vectors` figure (see `figureNumbers`): the caller must judge vectors otherwise.
 */
export function figureNumbersInText(f: PhysicsFigure, text: string): boolean {
  const found = (foldDigits(text).match(STATED_NUMBER) ?? []).map(Number);
  return figureNumbers(f).every(n => found.some(m => Math.abs(m - Math.abs(n)) < 1e-9));
}
