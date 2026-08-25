/**
 * Which class a material belongs to, as a teacher reads it.
 *
 * The `nameAr ?? name` fallback was repeated at every site that shows a class —
 * the picker sheet, the class screen, the workspace list — and each one is a
 * chance to print an English class name into an Arabic screen, or to render
 * `undefined`. One resolver, so a class is called the same thing everywhere.
 */
import type { ClassGroup } from './roster.ts';

/**
 * A class's display name in the active language.
 *
 * Arabic falls back to the latin name rather than showing nothing: a class the
 * teacher named "10B" and never gave an Arabic name for is still called 10B,
 * which is better than an empty row that looks like a loading bug.
 */
export function className(group: ClassGroup, lang: 'ar' | 'en'): string {
  const ar = group.nameAr?.trim();
  const en = group.name?.trim();
  if (lang === 'ar') return ar || en || '';
  return en || ar || '';
}

/**
 * The name of the class a material is filed under, or null for none.
 *
 * Null covers four cases that look identical on screen and must all read as
 * "no class": the material is unattached, the roster has not loaded, the
 * material points at a class that no longer exists, and the roster call
 * answered with a body that had no class list in it. The third is why this
 * takes the list rather than trusting the stored id — a deleted class would
 * otherwise leave a material claiming to belong somewhere it does not. The
 * fourth is why the list itself may be nullish: `listClasses()` returns
 * `data.classes` straight from the response, so a malformed body reaches
 * callers as `undefined` and every `.find` on it would throw.
 */
export function classNameFor(
  classes: readonly ClassGroup[] | null | undefined,
  classGroupId: string | null | undefined,
  lang: 'ar' | 'en',
): string | null {
  if (!classGroupId || !classes?.length) return null;
  const found = classes.find(c => c.id === classGroupId);
  return found ? className(found, lang) || null : null;
}
