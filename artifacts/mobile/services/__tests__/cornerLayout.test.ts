import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cornerColumns } from '../cornerLayout.ts';

test('a phone gets one column, a tablet two, a desktop three', () => {
  assert.equal(cornerColumns(390), 1);
  assert.equal(cornerColumns(599), 1);
  assert.equal(cornerColumns(600), 2);
  assert.equal(cornerColumns(959), 2);
  assert.equal(cornerColumns(960), 3);
  assert.equal(cornerColumns(1120), 3);
});
