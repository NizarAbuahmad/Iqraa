import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrast, readableOn, textOn } from '../readableColor.ts';

const STOCK = ['#3B82F6', '#E67E22', '#10B981', '#A855F7', '#F43F5E', '#0EA5E9', '#F59E0B'];

test('every stock category colour becomes AA text on the light and dark cards', () => {
  for (const surface of ['#FFFFFF', '#111F36']) {
    for (const c of STOCK) assert.ok(contrast(readableOn(c, surface), surface) >= 4.5, `${c} on ${surface}`);
  }
});

test('a colour that already passes is left alone', () => {
  assert.equal(readableOn('#006D65', '#FFFFFF'), '#006D65');
});

test('textOn picks the label that reads on a fill', () => {
  assert.equal(textOn('#006D65'), '#FFFFFF');
  assert.equal(textOn('#2DD4BF'), '#0B1B33');
});
