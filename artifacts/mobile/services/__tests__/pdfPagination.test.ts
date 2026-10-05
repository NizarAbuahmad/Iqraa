import { test } from 'node:test';
import assert from 'node:assert/strict';

import { planPageSlices } from '../pdfPagination.ts';

test('a document that fits is one page', () => {
  assert.deepEqual(planPageSlices(500, 1000, [200]), [[0, 500]]);
});

test('cuts at the last block edge that fits, never mid-block', () => {
  assert.deepEqual(planPageSlices(1500, 1000, [400, 900, 1100]), [[0, 900], [900, 1500]]);
});

test('a block taller than a page is cut hard at the page height', () => {
  assert.deepEqual(planPageSlices(2500, 1000, [2000]), [[0, 1000], [1000, 2000], [2000, 2500]]);
});

test('a forced break wins over a later block edge', () => {
  assert.deepEqual(planPageSlices(1500, 1000, [900], [600]), [[0, 600], [600, 1500]]);
});

test('slices tile the document with no gaps', () => {
  const slices = planPageSlices(3200, 1000, [300, 950, 1800, 2900], [2400]);
  assert.equal(slices[0][0], 0);
  assert.equal(slices.at(-1)![1], 3200);
  slices.slice(1).forEach(([s], i) => assert.equal(s, slices[i][1]));
});
