import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchKBRanked } from '../knowledgeBase.ts';

// The generator screens call the grounding helpers 4–8 times per tap for the
// same topic, and once per render. One scan is 100–200 ms on desktop V8; the
// cache is what makes the second and later calls free.
test('searchKBRanked returns the same ranked list for a repeated query', () => {
  const first = searchKBRanked('قانون الجيوب', 'ar');
  assert.ok(first.length > 0);
  assert.equal(searchKBRanked('قانون الجيوب', 'ar'), first);
  assert.equal(searchKBRanked('  قانون الجيوب ', 'ar'), first, 'trimmed queries share an entry');
  assert.notEqual(searchKBRanked('قانون الجيوب', 'en'), first, 'language is part of the key');
  assert.notEqual(searchKBRanked('قانون الجيوب', 'ar', { gradeId: 'grade-10' }), first, 'grade is part of the key');
});
