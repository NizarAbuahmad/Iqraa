/**
 * The lab item manifest (`lab.ts`).
 *
 * What this guards: every item names a lesson by id, and that lesson has to
 * exist and belong to the item's own subject. A lesson title does not identify
 * a lesson, and the generators branch on subject — a chemistry card filed on a
 * physics lesson would look fine and teach the wrong class. Law cards show the
 * lesson's own vocabulary terms, so each term is checked against the lesson.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  LAB_INTERACTIVE_IDS,
  LAB_ITEMS,
  filterLabItems,
  getLabItem,
  labItemsForLesson,
  validateLabItems,
  type LabItem,
} from '../lab.ts';
import { lessonKbId } from '../curriculumIds.ts';
import { GRADES, SUBJECTS } from '../catalog.ts';
import { getExternalResource } from '../external.ts';

interface CatalogLesson {
  id: string;
  vocabulary?: Array<{ ar: string; en: string }>;
}
interface CatalogFile {
  units: Array<{ lessons: CatalogLesson[] }>;
}

const FILES = [
  { file: 'iqra_curriculum_g10_chem_sem1.json', subject: 'chem', semester: 1 },
  { file: 'iqra_curriculum_g10_chem_sem2.json', subject: 'chem', semester: 2 },
  { file: 'iqra_curriculum_g10_phys_sem1.json', subject: 'phys', semester: 1 },
  { file: 'iqra_curriculum_g10_phys_sem2.json', subject: 'phys', semester: 2 },
  { file: 'iqra_curriculum_g10_bio_sem1.json', subject: 'biology', semester: 1 },
  { file: 'iqra_curriculum_g10_bio_sem2.json', subject: 'biology', semester: 2 },
] as const;

/** kbl id → { subject slug, Arabic vocabulary terms }, for every grade 10 chem/phys lesson. */
function lessonIndex(): Map<string, { slug: string; terms: string[] }> {
  const out = new Map<string, { slug: string; terms: string[] }>();
  for (const f of FILES) {
    const cat = JSON.parse(readFileSync(new URL(`../data/${f.file}`, import.meta.url), 'utf8')) as CatalogFile;
    for (const unit of cat.units) {
      for (const lesson of unit.lessons) {
        const id = lessonKbId({ gradeId: 'grade-10', subject: f.subject, semester: f.semester }, lesson.id);
        out.set(id, { slug: f.subject, terms: (lesson.vocabulary ?? []).map(v => v.ar) });
      }
    }
  }
  return out;
}

const SLUG_BY_SUBJECT: Record<string, string> = { chemistry: 'chem', physics: 'phys', biology: 'biology' };

describe('the shipped lab manifest', () => {
  it('is structurally valid', () => {
    assert.deepEqual(validateLabItems(), []);
  });

  it('files every item under a real grade and subject', () => {
    const grades = new Set(GRADES.map(g => g.id));
    const subjects = new Set(SUBJECTS.map(s => s.id));
    for (const item of LAB_ITEMS) {
      assert.ok(grades.has(item.gradeId), `${item.id}: unknown grade ${item.gradeId}`);
      assert.ok(subjects.has(item.subjectId), `${item.id}: unknown subject ${item.subjectId}`);
    }
  });

  it('files every item under grade 10, the only grade the lesson index covers', () => {
    for (const item of LAB_ITEMS) assert.equal(item.gradeId, 'grade-10', `${item.id}: gradeId`);
  });

  it('agrees with the external resource it points at', () => {
    for (const item of LAB_ITEMS) {
      if (item.kind !== 'external') continue;
      const res = getExternalResource(item.externalId);
      assert.ok(res, `${item.id}: ${item.externalId} is not an external resource`);
      assert.ok(res.lessonIds.includes(item.lessonId), `${item.id}: ${item.lessonId} is not one of the resource's lessons`);
      assert.equal(item.subjectId, res.subjectId, `${item.id}: subject disagrees with the resource`);
      assert.equal(item.titleAr, res.titleAr, `${item.id}: titleAr differs from the resource`);
      assert.equal(item.titleEn, res.titleEn, `${item.id}: titleEn differs from the resource`);
    }
  });

  it('names a lesson that exists, in the item\'s own subject', () => {
    const lessons = lessonIndex();
    for (const item of LAB_ITEMS) {
      const lesson = lessons.get(item.lessonId);
      assert.ok(lesson, `${item.id}: ${item.lessonId} is not a grade 10 chemistry/physics/biology lesson`);
      assert.equal(lesson.slug, SLUG_BY_SUBJECT[item.subjectId], `${item.id}: subject disagrees with its lesson`);
    }
  });

  it('only shows a law term the lesson itself lists', () => {
    const lessons = lessonIndex();
    for (const item of LAB_ITEMS) {
      if (item.kind !== 'law') continue;
      const terms = lessons.get(item.lessonId)?.terms ?? [];
      for (const term of item.termsAr) {
        assert.ok(terms.includes(term), `${item.id}: "${term}" is not in the lesson's vocabulary`);
      }
    }
  });

  it('credits every Servier Medical Art image the way their licence asks, and names it by a term of its lesson', () => {
    const lessons = lessonIndex();
    const servier = LAB_ITEMS.filter(i => i.kind === 'external' && getExternalResource(i.externalId)?.provider === 'servier');
    assert.ok(servier.length >= 4, 'expected the Grade 10 biology Servier images');
    for (const item of servier) {
      if (item.kind !== 'external') continue;
      const res = getExternalResource(item.externalId)!;
      assert.equal(res.license, 'CC-BY-4.0', `${item.id}: licence`);
      assert.ok(
        res.attribution.includes('Servier Medical Art (https://smart.servier.com/), licensed under CC BY 4.0'),
        `${item.id}: credit line`,
      );
      assert.ok(res.sourceUrl.startsWith('https://smart.servier.com/smart_image/'), `${item.id}: sourceUrl`);
      // The Arabic title is a term the lesson itself lists — nobody wrote curriculum Arabic from memory.
      assert.ok(lessons.get(item.lessonId)?.terms.includes(item.titleAr), `${item.id}: "${item.titleAr}" is not in the lesson's vocabulary`);
    }
  });

  it('ships the three flagship interactives, once each', () => {
    const ids = LAB_ITEMS.flatMap(i => (i.kind === 'interactive' ? [i.interactiveId] : []));
    assert.deepEqual([...ids].sort(), [...LAB_INTERACTIVE_IDS].sort());
  });
});

describe('lookups', () => {
  it('finds an item by id and returns undefined otherwise', () => {
    assert.equal(getLabItem('lab-periodic-table')?.kind, 'interactive');
    assert.equal(getLabItem('nope'), undefined);
  });

  it('filters by lesson, treating an empty id as no lesson', () => {
    assert.ok(labItemsForLesson('kbl-chem-s2-nccd-u4_l2').length >= 2);
    assert.deepEqual(labItemsForLesson(''), []);
  });

  it('filters by subject and kind', () => {
    const laws = filterLabItems({ kind: 'law' });
    assert.ok(laws.length > 0 && laws.every(i => i.kind === 'law'));
    const phys = filterLabItems({ subjectId: 'physics' });
    assert.ok(phys.length > 0 && phys.every(i => i.subjectId === 'physics'));
  });
});

describe('validateLabItems', () => {
  const law: LabItem = {
    id: 'x',
    kind: 'law',
    origin: 'original',
    gradeId: 'grade-10',
    subjectId: 'physics',
    lessonId: 'kbl-phys-s1-nccd-u2_l3',
    titleAr: 'عنوان',
    titleEn: 'Title',
    formula: 'F = m × a',
    quantities: [{ symbol: 'F', nameEn: 'Force', unit: 'N' }],
    termsAr: ['عنوان'],
  };

  it('flags a duplicate id', () => {
    assert.ok(validateLabItems([law, law]).some(e => e.includes('duplicate id')));
  });

  it('flags a law with no formula or no terms', () => {
    const errors = validateLabItems([{ ...law, formula: ' ', termsAr: [] }]);
    assert.ok(errors.some(e => e.includes('formula')));
    assert.ok(errors.some(e => e.includes('termsAr')));
  });

  it('flags an item whose kind is not one of the three', () => {
    const errors = validateLabItems([{ ...law, kind: 'laws' } as unknown as LabItem]);
    assert.ok(errors.some(e => e.includes('unknown kind "laws"')), errors.join('; '));
  });

  it('flags an external item pointing at nothing', () => {
    const errors = validateLabItems([
      { ...law, kind: 'external', externalId: 'does-not-exist' } as unknown as LabItem,
    ]);
    assert.ok(errors.some(e => e.includes('does-not-exist')));
  });
});
