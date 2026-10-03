import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { formatMarks } from '../studentAnswers.ts';

describe('formatMarks', () => {
  it('drops the decimals the numeric column adds', () => {
    assert.equal(formatMarks('10.00'), '10');
    assert.equal(formatMarks('7.50'), '7.5');
    assert.equal(formatMarks(12), '12');
  });
  it('passes through anything that is not a number', () => {
    assert.equal(formatMarks(''), '');
    assert.equal(formatMarks(null), '');
    assert.equal(formatMarks('n/a'), 'n/a');
  });
});
