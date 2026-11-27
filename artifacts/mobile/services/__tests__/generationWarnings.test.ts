/**
 * The review screen shows a generated exam's warnings in the teacher's language.
 *
 * The API sends `warnings` (English) and, since 2026-11-27, `warningsAr` beside
 * it, one for one. An older API sends only `warnings`, and a list whose length
 * does not match cannot be trusted to line up, so either falls back to English
 * rather than showing a mix or dropping a warning.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generationWarnings } from '../generationWarnings.ts';

describe('generationWarnings', () => {
  const both = { warnings: ['A', 'B'], warningsAr: ['أ', 'ب'] };

  it('shows the Arabic list to an Arabic teacher', () => {
    assert.deepEqual(generationWarnings(both, 'ar'), ['أ', 'ب']);
  });

  it('shows the English list in English', () => {
    assert.deepEqual(generationWarnings(both, 'en'), ['A', 'B']);
  });

  it('falls back to English when the API sent no Arabic, or a list that does not line up', () => {
    assert.deepEqual(generationWarnings({ warnings: ['A'] }, 'ar'), ['A']);
    assert.deepEqual(generationWarnings({ warnings: ['A', 'B'], warningsAr: ['أ'] }, 'ar'), ['A', 'B']);
  });

  it('is empty when there is nothing to say', () => {
    assert.deepEqual(generationWarnings({}, 'ar'), []);
  });
});
