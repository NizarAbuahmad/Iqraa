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
  // Native reads the first two, react-native-web only maps aria-hidden, and they sit on the View
  // around the Svg (CalendarPicker's pattern). `accessible={false}` is not it, and neither are
  // these on the Svg itself: react-native-svg passes them to the DOM on web, where React logs
  // «Received `false` for a non-boolean attribute `accessible`» on every answer.
  assert.match(map, /accessibilityElementsHidden/);
  assert.match(map, /importantForAccessibility="no-hide-descendants"/);
  assert.match(map, /aria-hidden/);
  assert.doesNotMatch(map, /accessible=/);
  // Placement: all three on a <View>, none on the <Svg>.
  assert.match(map, /<View[^>]*accessibilityElementsHidden/s);
  assert.match(map, /<View[^>]*importantForAccessibility="no-hide-descendants"/s);
  assert.match(map, /<View[^>]*aria-hidden/s);
  assert.doesNotMatch(map, /<Svg[^>]*(aria-hidden|accessibilityElementsHidden|importantForAccessibility|accessible)/s);
  assert.match(map, /useColors\(\)/);
  assert.doesNotMatch(map, /palette/);
  assert.doesNotMatch(map, /fontSize:\s*\d/);
  assert.match(map, /playMapCredit/);
});

test('unlit governorates are visible, the map is sized from its viewBox, and the wrong pick is outlined on top', () => {
  const map = read('components', 'publicGames', 'JordanMap.tsx');
  assert.match(map, /fill=\{id === correctId \? lit : colors\.muted\}/);
  assert.match(map, /stroke=\{colors\.mutedForeground\}/);
  assert.match(map, /aspectRatio: VW \/ VH/);
  assert.doesNotMatch(map, /MAP_HEIGHT/);
  // The red outline is its own Path after every fill, with no fill of its own.
  const redPass = map.indexOf('fill="none" stroke={WRONG}');
  assert.ok(redPass > map.indexOf('order.map('), 'the red outline is drawn after the fills');
  assert.doesNotMatch(map.slice(0, redPass), /stroke=\{id === wrong/);
});

test('the credit names both the data set and Wikimedia Commons', () => {
  const i18n = read('services', 'i18n.ts');
  assert.match(i18n, /playMapCredit: 'الخريطة: geoBoundaries \/ ويكيميديا كومنز \(CC BY 2\.5\)'/);
  assert.match(i18n, /playMapCredit: 'Map: geoBoundaries \/ Wikimedia Commons \(CC BY 2\.5\)'/);
});
