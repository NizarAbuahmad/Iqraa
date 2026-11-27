/**
 * A saved material's grade and subject are named in the reader's language.
 *
 * Seen 2026-11-27: a Grade 10 maths worksheet, shared by link, showed the
 * header chips «Grade 10 · Mathematics» on its public `/m/CODE` page and in the
 * teacher's «ملفاتي» with the app in Arabic. The worksheet and quiz screens save
 * the English names (`grades[i].name`, `subjects[i].name`) and the page printed
 * them as stored. Existing rows hold those English names, so the fix maps on
 * read rather than on save.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GRADES, SUBJECTS } from '@workspace/curriculum';
import { materialGradeName, materialSubjectName } from '../materialMeta.ts';

describe('materialGradeName / materialSubjectName', () => {
  it('name the English names a saved worksheet holds in Arabic, and keep them in English', () => {
    assert.equal(materialGradeName('Grade 10', 'ar'), 'الصف العاشر');
    assert.equal(materialSubjectName('Mathematics', 'ar'), 'الرياضيات');
    assert.equal(materialGradeName('Grade 10', 'en'), 'Grade 10');
    assert.equal(materialSubjectName('Mathematics', 'en'), 'Mathematics');
  });

  it('read a material saved with Arabic names, or with ids, either way', () => {
    assert.equal(materialGradeName('الصف العاشر', 'en'), 'Grade 10');
    assert.equal(materialSubjectName('الكيمياء', 'en'), 'Chemistry');
    assert.equal(materialGradeName('grade-10', 'ar'), 'الصف العاشر');
    assert.equal(materialSubjectName('chemistry', 'ar'), 'الكيمياء');
  });

  it('tolerate case and stray spaces in a stored English name', () => {
    assert.equal(materialSubjectName(' mathematics ', 'ar'), 'الرياضيات');
    assert.equal(materialGradeName('grade 1', 'ar'), GRADES[0]!.nameAr);
  });

  it('name a subject the way its grade shows it, and read that grade-specific label back', () => {
    // creative-arts is «Art Education» / «التربية الفنية» in grade 6 only (SUBJECT_LABEL_BY_GRADE).
    const generic = SUBJECTS.find(s => s.id === 'creative-arts')!;
    assert.equal(materialSubjectName(generic.name, 'ar', 'Grade 6'), 'التربية الفنية');
    assert.equal(materialSubjectName('Art Education', 'ar', 'Grade 6'), 'التربية الفنية');
    assert.equal(materialSubjectName('Art Education', 'en', 'الصف السادس'), 'Art Education');
    // In another grade, or with no grade, the shared label.
    assert.equal(materialSubjectName('Art Education', 'ar', 'Grade 5'), generic.nameAr);
    assert.equal(materialSubjectName('Art Education', 'ar'), generic.nameAr);
  });

  it('show a name that matches nothing as it was stored, and nothing as nothing', () => {
    assert.equal(materialSubjectName('Robotics club', 'ar'), 'Robotics club');
    assert.equal(materialGradeName('', 'ar'), '');
    assert.equal(materialGradeName(null, 'ar'), '');
    assert.equal(materialSubjectName(undefined, 'en'), '');
  });

  it('map every catalog grade and subject back to itself — ids and names are unique, so a name cannot land on another entry', () => {
    for (const [list, name] of [[GRADES, materialGradeName], [SUBJECTS, materialSubjectName]] as const) {
      // An id may equal its own lowercased name («english» / «English»); two entries may not share one.
      const owner = new Map<string, string>();
      for (const x of list) {
        for (const key of new Set([x.id, x.name.toLowerCase(), x.nameAr])) {
          assert.ok(!owner.has(key), `«${key}» names both ${owner.get(key)} and ${x.id}`);
          owner.set(key, x.id);
        }
      }
      for (const x of list) {
        for (const stored of [x.id, x.name, x.nameAr]) {
          assert.equal(name(stored, 'ar'), x.nameAr, stored);
          assert.equal(name(stored, 'en'), x.name, stored);
        }
      }
    }
  });
});
