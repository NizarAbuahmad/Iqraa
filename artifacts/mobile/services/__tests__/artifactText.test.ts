import { test } from 'node:test';
import assert from 'node:assert/strict';
import { artifactText } from '../artifactText.ts';

test('artifactText keeps content text in order and drops ids and flags', () => {
  const lines = artifactText({
    id: 'abc',
    title: 'الصدق',
    concepts: [{ type: 'definition', heading: 'تعريف', body: ' قول الحق ' }, { heading: '', marks: 2 }],
    language: 'arabic',
    verified: true,
  });
  assert.deepEqual(lines, ['الصدق', 'تعريف', 'قول الحق', '2']);
});

test('artifactText tolerates null and plain strings', () => {
  assert.deepEqual(artifactText(null), []);
  assert.deepEqual(artifactText('نص'), ['نص']);
});
