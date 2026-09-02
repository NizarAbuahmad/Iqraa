import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { arCountPhrase } from '../arCount.ts';

describe('arCountPhrase', () => {
  it('covers all four Arabic number classes', () => {
    assert.equal(arCountPhrase(1, 'نقطة', 'نقطتان', 'نقاط'), 'نقطة');
    assert.equal(arCountPhrase(2, 'نقطة', 'نقطتان', 'نقاط'), 'نقطتان');
    assert.equal(arCountPhrase(5, 'نقطة', 'نقطتان', 'نقاط'), '5 نقاط');
    assert.equal(arCountPhrase(10, 'نقطة', 'نقطتان', 'نقاط'), '10 نقاط');
    assert.equal(arCountPhrase(12, 'نقطة', 'نقطتان', 'نقاط'), '12 نقطة');
  });
});
