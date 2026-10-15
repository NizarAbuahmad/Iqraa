import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { blankMarkCount, gridFromScan, totalMismatch } from '../paperScan.ts';
import type { PaperScanRow } from '../evaluations.ts';

const row = (over: Partial<PaperScanRow> = {}): PaperScanRow => ({
  number: 1, marks: 5, objectiveId: 'o1', competencyKey: 'knowledge', readAs: '5', ...over,
});

describe('gridFromScan', () => {
  it('carries what was read and marks every row for review', () => {
    const grid = gridFromScan([row({ marks: 2.5, objectiveId: 'o2', competencyKey: 'application' })], ['o1', 'o2'], 'understanding');
    assert.deepEqual(grid, [{ marks: '2.5', objectiveId: 'o2', competencyKey: 'application', review: true }]);
  });

  it('leaves an unread mark blank instead of defaulting it', () => {
    assert.equal(gridFromScan([row({ marks: null })], ['o1'], 'understanding')[0]!.marks, '');
  });

  it('falls back to the first ticked objective and the default competency, as the grid does', () => {
    const [g] = gridFromScan([row({ objectiveId: null, competencyKey: null })], ['o9', 'o1'], 'understanding');
    assert.equal(g!.objectiveId, 'o9');
    assert.equal(g!.competencyKey, 'understanding');
  });

  it('does not keep an objective the teacher has not ticked', () => {
    assert.equal(gridFromScan([row({ objectiveId: 'o-unticked' })], ['o1'], 'understanding')[0]!.objectiveId, 'o1');
  });

  it('is empty for an empty scan', () => {
    assert.deepEqual(gridFromScan([], ['o1'], 'understanding'), []);
  });
});

describe('blankMarkCount', () => {
  it('counts blanks, zeros and junk — everything the grid would refuse', () => {
    assert.equal(blankMarkCount([{ marks: '' }, { marks: '0' }, { marks: 'x' }, { marks: '٣' }, { marks: '2.5' }]), 3);
  });
});

describe('totalMismatch', () => {
  it('is null when the marks add up to the printed total, in either digit set', () => {
    assert.equal(totalMismatch([{ marks: '5' }, { marks: '٥' }, { marks: '2.5' }], 12.5), null);
  });

  it('reports both numbers when they disagree', () => {
    assert.deepEqual(totalMismatch([{ marks: '5' }, { marks: '5' }], 15), { sum: 10, printed: 15 });
  });

  it('is null when the paper printed no total', () => {
    assert.equal(totalMismatch([{ marks: '5' }], null), null);
  });

  it('ignores blank rows rather than counting them as zero-and-agreeing', () => {
    assert.deepEqual(totalMismatch([{ marks: '5' }, { marks: '' }], 10), { sum: 5, printed: 10 });
  });
});
