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

/** Every number the drawing prints, in the order the renderer prints them. */
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

/** True when each number the drawing prints appears, as a whole number token, in `text`. */
export function figureNumbersInText(f: PhysicsFigure, text: string): boolean {
  const found = (foldDigits(text).match(/\d+(?:\.\d+)?/gu) ?? []).map(Number);
  return figureNumbers(f).every(n => found.some(m => Math.abs(m - Math.abs(n)) < 1e-9));
}
