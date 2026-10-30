import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

test('the map shows only through the reveal, with the accent passed in, in the governorates game', () => {
  const route = read('app', 'play', 'governorates.tsx');
  assert.match(route, /accent="#1E3A8A"/);
  assert.match(route, /reveal=\{/);
  assert.match(route, /<JordanMap correctId=\{q\.correctId\} pickedId=\{picked\} accent=\{accent\}/);
  const quiz = read('components', 'publicGames', 'TextQuizGame.tsx');
  assert.match(quiz, /reveal\?:/);
  assert.match(quiz, /reveal\(q, pickedId, accent\)/);
});

test('the map is decorative for screen readers, takes colours from the theme and credits its source', () => {
  const map = read('components', 'publicGames', 'JordanMap.tsx');
  assert.match(map, /accessible=\{false\}/);
  assert.match(map, /useColors\(\)/);
  assert.doesNotMatch(map, /palette/);
  assert.doesNotMatch(map, /fontSize:\s*\d/);
  assert.match(map, /playMapCredit/);
});
