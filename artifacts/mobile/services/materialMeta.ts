/**
 * A saved material's grade and subject, named in the reader's language.
 *
 * `saved_materials.grade` / `.subject` hold a NAME, not an id, and which name
 * depends on the screen that saved it: the worksheet and quiz screens store the
 * English one (`grades[i].name`, «Grade 10»; `subjects[i].name`, «Mathematics»,
 * which other code reads as the subject's identity), others the Arabic one when
 * the material is Arabic. Printed as stored, an Arabic teacher's «ملفاتي» and
 * the public `/m/CODE` page showed «Grade 10 · Mathematics» (seen 2026-11-27).
 *
 * So the stored string is matched back to its catalog entry — by id, English
 * name or Arabic name, which are each unique in `GRADES` / `SUBJECTS`
 * (`materialMeta.test.ts` checks) — and named at display time. This covers
 * every row already saved without a migration. A string that matches nothing
 * (typed by hand, or a subject since renamed) is shown as it is.
 *
 * Grades and subjects only. A lesson's title (`topic`) is not an id and is not
 * mapped here (CLAUDE.md, «A lesson title does not identify a lesson»).
 */
import { GRADES, SUBJECTS } from '@workspace/curriculum';

type Named = { id: string; name: string; nameAr: string };

function find<T extends Named>(list: readonly T[], stored: string): T | undefined {
  const s = stored.trim();
  if (!s) return undefined;
  const lower = s.toLowerCase();
  return list.find(x => x.id === s || x.name.toLowerCase() === lower || x.nameAr === s);
}

function named(list: readonly Named[], stored: string | null | undefined, lang: string): string {
  const raw = stored ?? '';
  const hit = find(list, raw);
  if (!hit) return raw;
  return lang === 'ar' ? hit.nameAr : hit.name;
}

/** «الصف العاشر» / «Grade 10», from whatever the material stored. */
export function materialGradeName(stored: string | null | undefined, lang: string): string {
  return named(GRADES, stored, lang);
}

/** «الرياضيات» / «Mathematics», from whatever the material stored. */
export function materialSubjectName(stored: string | null | undefined, lang: string): string {
  return named(SUBJECTS, stored, lang);
}
