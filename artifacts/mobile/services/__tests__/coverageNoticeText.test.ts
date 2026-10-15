import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { capCoveredNames, coveredNamesText } from '../coverageNoticeText.ts';
import { arLessonsPhrase } from '../arCount.ts';
import { getT } from '../i18n.ts';

const names = (n: number) => Array.from({ length: n }, (_, i) => `L${i + 1}`);

describe('capCoveredNames', () => {
  it('leaves 6 or fewer names unchanged', () => {
    assert.deepEqual(capCoveredNames(names(0)), { shown: [], hidden: 0 });
    assert.deepEqual(capCoveredNames(names(6)), { shown: names(6), hidden: 0 });
  });
  it('shows 6 and counts the rest', () => {
    assert.deepEqual(capCoveredNames(names(7)), { shown: names(6), hidden: 1 });
    assert.deepEqual(capCoveredNames(names(60)), { shown: names(6), hidden: 54 });
  });
  it('does not dedupe repeated titles, it only caps', () => {
    const r = capCoveredNames(['x', 'x', 'x', 'x', 'x', 'x', 'x']);
    assert.deepEqual(r, { shown: ['x', 'x', 'x', 'x', 'x', 'x'], hidden: 1 });
  });
});

describe('coveredNamesText', () => {
  const ar = getT('ar');
  const en = getT('en');
  it('appends the localized suffix only when names were cut', () => {
    assert.equal(coveredNamesText(names(3), ', ', k => en('coveredLessonsMore', k)), 'L1, L2, L3');
    assert.equal(coveredNamesText(names(60), ', ', k => en('coveredLessonsMore', k)), 'L1, L2, L3, L4, L5, L6 and 54 more');
    assert.equal(coveredNamesText(names(7), '، ', k => ar('coveredLessonsMore', k)), 'L1، L2، L3، L4، L5، L6 ودرس آخر');
  });
  it('the Arabic suffix agrees with the number of hidden lessons', () => {
    assert.equal(ar('coveredLessonsMore', 1), 'ودرس آخر');
    assert.equal(ar('coveredLessonsMore', 2), 'ودرسان آخران');
    assert.equal(ar('coveredLessonsMore', 3), 'و3 دروس أخرى');
    assert.equal(ar('coveredLessonsMore', 10), 'و10 دروس أخرى');
    assert.equal(ar('coveredLessonsMore', 11), 'و11 درسًا آخر');
    assert.equal(ar('coveredLessonsMore', 54), 'و54 درسًا آخر');
  });
});

describe('arLessonsPhrase and uncoveredLessons', () => {
  const ar = getT('ar');
  it('agrees with the number', () => {
    assert.equal(arLessonsPhrase(1), 'درس واحد');
    assert.equal(arLessonsPhrase(2), 'درسان');
    assert.equal(arLessonsPhrase(3), '3 دروس');
    assert.equal(arLessonsPhrase(10), '10 دروس');
    assert.equal(arLessonsPhrase(11), '11 درسًا');
    assert.equal(arLessonsPhrase(15), '15 درسًا');
  });
  it('uncoveredLessons reads correctly for 1, 2, 3, 10, 11, 15', () => {
    assert.equal(ar('uncoveredLessons', 1), 'لم يُغطَّ درس واحد.');
    assert.equal(ar('uncoveredLessons', 2), 'لم يُغطَّ درسان.');
    assert.equal(ar('uncoveredLessons', 3), 'لم تُغطَّ 3 دروس.');
    assert.equal(ar('uncoveredLessons', 10), 'لم تُغطَّ 10 دروس.');
    assert.equal(ar('uncoveredLessons', 11), 'لم يُغطَّ 11 درسًا.');
    assert.equal(ar('uncoveredLessons', 15), 'لم يُغطَّ 15 درسًا.');
  });
});
