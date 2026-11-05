/**
 * Grade 10 physics: the units and lessons the app offers follow the student
 * books — their numbers, their order and their opening experiments.
 *
 * A teacher compared the app with the two books and reported: no unit 3 exists
 * in either; semester 2's units are numbered 4, 5, 6 and not 1, 2, 3; «الحركة
 * الموجية» is a unit of its own with two lessons; and semester 2 had no
 * «تجربة استهلالية» although its student book prints one at the head of each unit
 * (pp. 9, 57, 93 — `data/extracted/phys-s2-student-book.json`). Semester 1's
 * units each have theirs, so a semester 2 unit without one is a gap, not a
 * choice.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { nccdG10PhysSem1, buildPhysSem1Catalog } from '../catalogs/g10PhysSem1.ts';
import { nccdG10PhysSem2, buildPhysSem2Catalog } from '../catalogs/g10PhysSem2.ts';

const s1 = nccdG10PhysSem1.units;
const s2 = nccdG10PhysSem2.units;

describe('grade 10 physics unit numbering follows the books', () => {
  it('semester 1 is units 1 and 2, semester 2 is units 4, 5 and 6, and there is no unit 3', () => {
    assert.deepEqual(s1.map(u => u.number), [1, 2]);
    assert.deepEqual(s2.map(u => u.number), [4, 5, 6]);
    assert.ok(![...s1, ...s2].some(u => u.number === 3), 'no unit 3 exists in either book');
  });

  it('semester 2 lists its units in book order', () => {
    assert.deepEqual(
      s2.map(u => u.title_ar),
      ['تطبيقات على قوانين نيوتن', 'الموائع', 'الحركة الموجية'],
    );
  });

  it('wave motion is its own unit with its own two lessons, not part of fluids', () => {
    const waves = s2.find(u => u.title_ar === 'الحركة الموجية');
    assert.ok(waves, 'unit «الحركة الموجية» exists');
    assert.equal(waves.number, 6);
    assert.deepEqual(
      waves.lessons.filter(l => l.type !== 'lab').map(l => l.title_ar),
      ['الموجات وصفاتها', 'خصائص الحركة الموجية'],
    );
    const fluids = s2.find(u => u.title_ar === 'الموائع');
    assert.ok(fluids);
    assert.ok(!fluids.lessons.some(l => /موج/.test(l.title_ar)), 'no wave lesson under fluids');
  });

  it('the built catalogs keep the book numbers as their unit order', () => {
    assert.deepEqual(buildPhysSem1Catalog().units.map(u => u.order), [1, 2]);
    assert.deepEqual(buildPhysSem2Catalog().units.map(u => u.order), [4, 5, 6]);
  });
});

describe('every grade 10 physics unit opens with its introductory experiment', () => {
  for (const [label, units] of [['semester 1', s1], ['semester 2', s2]] as const) {
    it(`${label}: lab first, then lessons numbered 1..n`, () => {
      for (const u of units) {
        const [first, ...rest] = u.lessons;
        assert.equal(first.id, `${u.id}_lab`, `${u.id}: first entry`);
        assert.equal(first.type, 'lab', `${u.id}: type`);
        assert.equal(first.order, 0, `${u.id}: lab order`);
        assert.ok(first.title_ar.startsWith('تجربة استهلالية: '), `${u.id}: title prefix`);
        assert.ok(first.title_en.startsWith('Introductory Experiment: '), `${u.id}: English prefix`);
        assert.deepEqual(first.objectives, [], `${u.id}: the book prints no objectives for a lab`);
        assert.deepEqual(rest.map(l => l.order), rest.map((_, i) => i + 1), `${u.id}: lesson order`);
        assert.ok(rest.every(l => l.type !== 'lab'), `${u.id}: only one lab`);
      }
    });
  }

  it('semester 2 experiments carry the titles printed on book pages 9, 57 and 93', () => {
    assert.deepEqual(
      s2.map(u => u.lessons[0].title_ar),
      [
        'تجربة استهلالية: الكتلة والوزن',
        'تجربة استهلالية: خصائص الموائع',
        'تجربة استهلالية: الموجات تنقل الطاقة ولا تنقل المادة',
      ],
    );
  });

  it('the built semester 2 catalog offers each experiment as the first lesson of its unit', () => {
    const { units, lessons } = buildPhysSem2Catalog();
    for (const unit of units) {
      const mine = lessons.filter(l => l.unitId === unit.id).sort((a, b) => a.order - b.order);
      assert.ok(mine[0].titleAr.startsWith('تجربة استهلالية: '), `${unit.titleAr}: first lesson is the experiment`);
    }
  });
});
