import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classSubjectIds,
  classSubjectsLabel,
  filterBySubject,
  inOptionOrder,
  resolveSelectedIds,
  subjectIdFromName,
  toggleId,
} from '../classSubjects.ts';

describe('classSubjectIds', () => {
  it('reads the list when present', () => {
    assert.deepEqual(classSubjectIds({ subjectId: 'arabic', subjectIds: ['arabic', 'mathematics'] }), ['arabic', 'mathematics']);
  });
  it('falls back to the single subject for a class made before the list existed', () => {
    assert.deepEqual(classSubjectIds({ subjectId: 'mathematics' }), ['mathematics']);
    assert.deepEqual(classSubjectIds({ subjectId: 'mathematics', subjectIds: [] }), ['mathematics']);
  });
  it('is empty when neither is set', () => {
    assert.deepEqual(classSubjectIds({ subjectId: '' }), []);
    assert.deepEqual(classSubjectIds(null), []);
  });
  it('drops blanks and duplicates', () => {
    assert.deepEqual(classSubjectIds({ subjectIds: ['arabic', '', 'arabic', 'science'] }), ['arabic', 'science']);
  });
});

describe('resolveSelectedIds', () => {
  const options = [{ id: 'arabic' }, { id: 'mathematics' }, { id: 'science' }];
  it('ticks every option until the teacher chooses', () => {
    assert.deepEqual(resolveSelectedIds(options, null), ['arabic', 'mathematics', 'science']);
  });
  it('drops a chosen subject that is no longer offered', () => {
    assert.deepEqual(resolveSelectedIds(options, ['science', 'physics']), ['science']);
  });
  it('allows choosing none', () => {
    assert.deepEqual(resolveSelectedIds(options, []), []);
  });
});

describe('toggleId / inOptionOrder', () => {
  it('toggles', () => {
    assert.deepEqual(toggleId(['a'], 'b'), ['a', 'b']);
    assert.deepEqual(toggleId(['a', 'b'], 'a'), ['b']);
  });
  it('orders by the picker so the primary subject is predictable', () => {
    const options = [{ id: 'arabic' }, { id: 'mathematics' }];
    assert.deepEqual(inOptionOrder(options, ['mathematics', 'arabic']), ['arabic', 'mathematics']);
    // A subject outside the options (kept from an older class) is not lost.
    assert.deepEqual(inOptionOrder(options, ['physics', 'mathematics']), ['mathematics', 'physics']);
  });
});

describe('classSubjectsLabel', () => {
  const count = (n: number) => `#${n}`;
  it('names one or two subjects', () => {
    assert.equal(classSubjectsLabel(['mathematics'], 'ar', count), 'الرياضيات');
    assert.equal(classSubjectsLabel(['arabic', 'mathematics'], 'en', count), 'Arabic · Mathematics');
  });
  it('counts three or more through the caller', () => {
    assert.equal(classSubjectsLabel(['arabic', 'mathematics', 'science', 'english'], 'ar', count), '#4');
  });
  it('ignores unknown ids and is empty for none', () => {
    assert.equal(classSubjectsLabel(['nope'], 'ar', count), '');
    assert.equal(classSubjectsLabel([], 'ar', count), '');
  });
});

describe('subjectIdFromName', () => {
  it('resolves Arabic, English and id forms', () => {
    assert.equal(subjectIdFromName('الرياضيات'), 'mathematics');
    assert.equal(subjectIdFromName('Mathematics'), 'mathematics');
    assert.equal(subjectIdFromName('arabic'), 'arabic');
  });
  it('is empty for unknown or missing', () => {
    assert.equal(subjectIdFromName('كيمياء عضوية'), '');
    assert.equal(subjectIdFromName(undefined), '');
  });
});

describe('filterBySubject', () => {
  const items = [{ s: 'arabic' }, { s: 'mathematics' }, { s: '' }];
  it('returns everything for «الكل»', () => {
    assert.equal(filterBySubject(items, '', i => i.s).length, 3);
  });
  it('keeps the focused subject and anything unattributable', () => {
    assert.deepEqual(filterBySubject(items, 'arabic', i => i.s), [{ s: 'arabic' }, { s: '' }]);
  });
});
