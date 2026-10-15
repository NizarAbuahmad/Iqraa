/**
 * The Grade 10 maths Semester 1 catalog has no English lesson titles: `buildNccdSem1Catalog`
 * copies `title_ar` into `titleEn` for every lesson, so an English-language plan for such a
 * lesson carries Arabic in its title. This pins the one lesson that now has a real English
 * title — the GeoGebra lab — and that the fallback for the rest is unchanged.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildNccdSem1Catalog } from '../catalogs/g10MathSem1.ts';

const ARABIC = /[؀-ۿ]/;
const { lessons } = buildNccdSem1Catalog();
const byId = (id: string) => {
  const l = lessons.find(x => x.id === id);
  assert.ok(l, `${id} is in the catalog`);
  return l;
};

describe('G10 maths S1 lab lesson', () => {
  it('has an English title with no Arabic in it', () => {
    const lab = byId('kbl-math-s1-nccd-u1_lab');
    assert.doesNotMatch(lab.titleEn, ARABIC, `titleEn is still Arabic: ${lab.titleEn}`);
    assert.match(lab.titleEn, /GeoGebra/);
  });

  it('keeps its Arabic title exactly as the JSON has it', () => {
    assert.equal(byId('kbl-math-s1-nccd-u1_lab').titleAr, 'معمل برمجية جيوجبرا: حل أنظمة المعادلات بيانياً');
  });

  it('leaves lessons without an English title on the Arabic fallback, as before', () => {
    const plain = byId('kbl-math-s1-nccd-u1_l1');
    assert.equal(plain.titleEn, plain.titleAr);
  });
});
