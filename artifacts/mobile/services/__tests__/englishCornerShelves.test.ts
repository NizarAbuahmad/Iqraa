import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import translations from '../i18n.ts';
import { ENGLISH_CORNER_GRADES, FREE_SITES } from '@workspace/curriculum/englishLinks';

/*
  The English corner screen imports react-native, so it cannot be loaded here. These pin
  its source for the three ways it went wrong before: a grade with no word lists vanished
  from the tab row (Grades 6–8 had no tab at all), a half-finished grade looked finished,
  and a link shelf was added to a screen no student could reach.
*/
const root = join(import.meta.dirname, '..', '..');
const screen = readFileSync(join(root, 'app/curriculum/english/index.tsx'), 'utf8');
const shelves = readFileSync(join(root, 'components/englishHub/ResourceShelves.tsx'), 'utf8');

test('the grade tabs come from the corner grades, not the word-game grades', () => {
  assert.match(screen, /ENGLISH_CORNER_GRADES\.map\(/);
  assert.doesNotMatch(screen, /ENGLISH_HUB_GRADES/);
});

test('the corner shows all ten grades', () => {
  assert.equal(ENGLISH_CORNER_GRADES.length, 10);
});

test('the screen says so when a grade has no word games or no second semester', () => {
  assert.match(screen, /hubNoWordsTitle/);
  assert.match(screen, /hubSem2Soon/);
});

test('both shelves are rendered for the picked grade', () => {
  assert.match(screen, /<BooksShelf grade=\{grade\} \/>/);
  assert.match(screen, /<FreeSitesShelf grade=\{grade\} \/>/);
});

test('links open through openExternal, never Linking.openURL (which replaces the app tab on web)', () => {
  assert.match(shelves, /openExternal\(/);
  assert.doesNotMatch(shelves, /Linking\.openURL/);
});

test('the shelves take colours from useColors, not the global palette', () => {
  assert.doesNotMatch(shelves, /palette/);
});

test('every string the shelves and the notices use exists in both languages', () => {
  const keys = [...new Set([...screen.matchAll(/\bt\('(hub\w+)'/g), ...shelves.matchAll(/'(hub[A-Z]\w+)'/g)].map(m => m[1]!))];
  assert.ok(keys.length >= 10, `expected to find the hub keys, found ${keys.length}`);
  for (const lang of ['ar', 'en'] as const) {
    for (const k of keys) assert.ok(k in translations[lang], `${lang} is missing ${k}`);
  }
});

test('a free site never claims a skill the shelf has no label for', () => {
  for (const s of FREE_SITES) for (const k of s.skills) assert.match(shelves, new RegExp(`${k}: 'hubSkill`), `${s.id}: ${k}`);
});
