/**
 * What this guards: an Arabic title keeps its letters in the saved file's name
 * (it used to collapse to its digits, or to nothing), characters a file system
 * rejects are dropped, and a title with nothing usable still gets a name.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { exportFilename } from '../exportFilename.ts';

describe('exportFilename', () => {
  it('keeps Arabic letters and digits', () => {
    assert.equal(exportFilename('خطة درس: الأعداد (10)'), 'خطة درس الأعداد 10');
  });

  it('keeps English titles as before', () => {
    assert.equal(exportFilename('Lesson plan: Fractions'), 'Lesson plan Fractions');
  });

  it('drops path and reserved characters', () => {
    assert.equal(exportFilename('a/b\\c:d*e?f"g<h>i|j'), 'abcdefghij');
  });

  it('appends the suffix before sanitising, keeping its hyphen', () => {
    assert.equal(exportFilename('اختبار', '-slides'), 'اختبار-slides');
  });

  it('falls back when nothing usable is left', () => {
    assert.equal(exportFilename('???'), 'iqra');
    assert.equal(exportFilename('', '', 'worksheet'), 'worksheet');
  });

  it('caps the length', () => {
    assert.ok(exportFilename('ا'.repeat(300)).length <= 80);
  });
});
