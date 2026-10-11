/**
 * The Grade 10 formula sheet — formulas as the student books print them.
 *
 * Nothing here is written from memory. Each entry names its lesson by `kbl-*`
 * id (never by title), the printed page it was taken from, and the fragments
 * that page prints; `mathFormulas.test.ts` reads the extracted books to check
 * all three, and the page has to lie inside that lesson's printed range.
 *
 * Notation is the book's, not a textbook's: the circle has centre (a, b), the
 * triangle's area is `K`, the vector product is `v · w`. The title a student
 * sees comes from the lesson itself; an Arabic `captionAr` is allowed only
 * where the book prints that phrase intact (extraction mangles some), and is
 * checked against the lesson's pages. `captionEn` is our own chrome text.
 *
 * `formula` is display text. `check` is the optional numeric identity, run by
 * the mobile suite through its expression engine, using the book's own worked
 * examples where it prints one. Unit 1 is left out: the book's first unit has
 * three lessons and the catalog four, so a lesson id there cannot be placed.
 */
import raw from './data/math_formulas.json' with { type: 'json' };

export interface MathFormulaSource {
  /** Which student book: semester 1 (units 1–4) or semester 2 (units 5–8). */
  book: 's1' | 's2';
  /** The book's own page number, as in the extracted text. */
  page: number;
  /** Fragments that page prints. Compared with whitespace ignored. */
  contains: string[];
}

export interface MathFormulaCheck {
  /** Expression-engine strings that must all evaluate to the same number. */
  equal: string[];
  /** Named values, evaluated in order; a later one may use an earlier one. */
  vars?: Record<string, number | string>;
  /** Relative tolerance. Default 1e-9; a numeric derivative needs looser. */
  tol?: number;
  /** Default `deg`, the way the books work. */
  angle?: 'deg' | 'rad';
}

export interface MathFormula {
  id: string;
  /** `kbl-math-s{1,2}-nccd-u{n}_l{m}`. */
  lessonId: string;
  /** A phrase the book prints in this lesson, verbatim. Optional. */
  captionAr?: string;
  captionEn: string;
  /** Display text with Unicode symbols; not an expression to evaluate. */
  formula: string;
  source: MathFormulaSource;
  check?: MathFormulaCheck;
}

export const MATH_FORMULAS: MathFormula[] = raw.items as unknown as MathFormula[];

const BY_ID: ReadonlyMap<string, MathFormula> = new Map(MATH_FORMULAS.map(f => [f.id, f]));

export function getMathFormula(id: string): MathFormula | undefined {
  return BY_ID.get(id);
}

/** Every formula filed on one lesson, in manifest order. */
export function mathFormulasForLesson(lessonId: string): MathFormula[] {
  if (!lessonId) return [];
  return MATH_FORMULAS.filter(f => f.lessonId === lessonId);
}
