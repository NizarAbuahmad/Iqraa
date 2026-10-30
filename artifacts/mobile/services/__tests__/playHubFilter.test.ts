import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAY_GAME_GRADES, PLAY_GAME_IDS } from '../publicGames/gradeBands.ts';
import {
  NO_FILTER, PLAY_FILTER_GRADES, PLAY_GAME_SUBJECT, PLAY_SUBJECTS,
  filterGames, gameSuitsGrade, hubFilterParams, parseHubFilter,
} from '../publicGames/hubFilter.ts';

const games = PLAY_GAME_IDS.map(id => ({ id }));
const ids = (f: Parameters<typeof filterGames>[1]) => filterGames(games, f).map(g => g.id);

test('every game has a known subject and every subject chip shows a game', () => {
  for (const id of PLAY_GAME_IDS) assert.ok((PLAY_SUBJECTS as readonly string[]).includes(PLAY_GAME_SUBJECT[id]), id);
  for (const s of PLAY_SUBJECTS) assert.ok(ids({ subject: s, grade: null }).length > 0, `${s} chip would be empty`);
});

test('every grade chip shows a game', () => {
  for (const g of PLAY_FILTER_GRADES) assert.ok(ids({ subject: null, grade: g }).length > 0, `grade ${g} chip would be empty`);
});

test('no filter keeps every game in the hub order', () => {
  assert.deepEqual(ids(NO_FILTER), [...PLAY_GAME_IDS]);
});

test('subject filter keeps only that subject', () => {
  assert.deepEqual(ids({ subject: 'arabic', grade: null }), ['antonyms', 'plurals']);
  assert.deepEqual(ids({ subject: 'english', grade: null }), ['english']);
});

test('grade filter uses the game ranges, inclusive at both ends and across split ranges', () => {
  assert.equal(gameSuitsGrade('english', 4), true);
  assert.equal(gameSuitsGrade('english', 5), false); // gap between [1,4] and [9,10]
  assert.equal(gameSuitsGrade('english', 9), true);
  assert.equal(gameSuitsGrade('fractions', 4), true);
  assert.equal(gameSuitsGrade('fractions', 7), true);
  assert.equal(gameSuitsGrade('fractions', 8), false);
  for (const id of PLAY_GAME_IDS) {
    for (const g of PLAY_FILTER_GRADES) {
      assert.equal(ids({ subject: null, grade: g }).includes(id), PLAY_GAME_GRADES[id].some(([a, b]) => g >= a && g <= b));
    }
  }
});

test('subject and grade combine with AND', () => {
  assert.deepEqual(ids({ subject: 'math', grade: 1 }), ['add', 'subtract']);
  assert.deepEqual(ids({ subject: 'math', grade: 6 }), ['numberType', 'fractions']);
  assert.deepEqual(ids({ subject: 'arabic', grade: 10 }), []);
});

test('parseHubFilter keeps a good link and drops a bad one', () => {
  assert.deepEqual(parseHubFilter({ subject: 'math', grade: '5' }), { subject: 'math', grade: 5 });
  assert.deepEqual(parseHubFilter({}), NO_FILTER);
  assert.deepEqual(parseHubFilter({ subject: ['science', 'math'], grade: ['7'] }), { subject: 'science', grade: 7 });
  for (const bad of ['', 'Math', 'history', '__proto__', 'constructor']) {
    assert.equal(parseHubFilter({ subject: bad }).subject, null, bad);
  }
  for (const bad of ['0', '11', '5.5', '-3', '05x', '١', 'abc', ' 5', '100']) {
    assert.equal(parseHubFilter({ grade: bad }).grade, null, bad);
  }
});

test('hubFilterParams round-trips through parseHubFilter and clears with undefined', () => {
  for (const f of [NO_FILTER, { subject: 'geography', grade: null }, { subject: null, grade: 10 }, { subject: 'skills', grade: 2 }] as const) {
    assert.deepEqual(parseHubFilter(hubFilterParams(f)), f);
  }
  assert.deepEqual(hubFilterParams(NO_FILTER), { subject: undefined, grade: undefined });
});
