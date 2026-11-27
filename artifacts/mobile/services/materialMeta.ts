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
 * (`materialMeta.test.ts` checks), or a subject's grade-specific label
 * (`subjectForGrade`) — and named at display time, as the material's grade
 * shows that subject. This covers every row already saved without a migration.
 * A string that matches nothing (typed by hand, or a subject since renamed) is
 * shown as it is.
 *
 * Grades and subjects only. A lesson's title (`topic`) is not an id and is not
 * mapped here (CLAUDE.md, «A lesson title does not identify a lesson»).
 */
import { GRADES, SUBJECTS, subjectForGrade } from '@workspace/curriculum';

type Named = { id: string; name: string; nameAr: string };

const matches = (x: Named, s: string) => x.id === s || x.name.toLowerCase() === s.toLowerCase() || x.nameAr === s;

const findGrade = (stored: string | null | undefined) => {
  const s = (stored ?? '').trim();
  return s ? GRADES.find(g => matches(g, s)) : undefined;
};

/** «الصف العاشر» / «Grade 10», from whatever the material stored. */
export function materialGradeName(stored: string | null | undefined, lang: string): string {
  const hit = findGrade(stored);
  if (!hit) return stored ?? '';
  return lang === 'ar' ? hit.nameAr : hit.name;
}

/**
 * «الرياضيات» / «Mathematics», from whatever the material stored. Pass the
 * material's stored grade too, so a subject with a grade-specific label
 * (`subjectForGrade`) is named as that grade's picker named it.
 */
export function materialSubjectName(
  stored: string | null | undefined,
  lang: string,
  storedGrade?: string | null,
): string {
  const s = (stored ?? '').trim();
  if (!s) return stored ?? '';
  const gradeId = findGrade(storedGrade)?.id;
  const hit = SUBJECTS.find(x => matches(x, s))
    // Saved under a grade's own label («Art Education» for grade 6).
    ?? SUBJECTS.find(x => x.grades.some(g => matches(subjectForGrade(x, g), s)));
  if (!hit) return stored ?? '';
  const shown = subjectForGrade(hit, gradeId);
  return lang === 'ar' ? shown.nameAr : shown.name;
}
