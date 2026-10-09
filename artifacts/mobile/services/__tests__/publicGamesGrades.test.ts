import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAY_GAME_GRADES, PLAY_GAME_IDS, gradeBandLabel as label } from '../publicGames/gradeBands.ts';
import { ELEMENTS, buildElementQuestion, buildElementRound } from '../publicGames/elements.ts';
import { makeRng } from '../publicGames/rng.ts';

test('every hub game declares at least one sane grade range', () => {
  for (const id of PLAY_GAME_IDS) {
    const ranges = PLAY_GAME_GRADES[id];
    assert.ok(ranges.length > 0, `${id} has no grades`);
    for (const [from, to] of ranges) {
      assert.ok(from >= 1 && to <= 12 && from <= to, `${id}: bad range ${from}–${to}`);
    }
  }
});

test('grade labels: single grade, one range, two ranges, both languages', () => {
  const gradeBandLabel = (...a: Parameters<typeof label>) => label(...a).replace(/\u2060/g, '');
  assert.equal(gradeBandLabel([[7, 7]], 'ar'), 'الصف 7');
  assert.equal(gradeBandLabel([[7, 10]], 'ar'), 'الصفوف 7–10');
  assert.equal(gradeBandLabel([[1, 4], [9, 10]], 'ar'), 'الصفوف 1–4 و9–10');
  assert.equal(gradeBandLabel([[7, 7]], 'en'), 'Grade 7');
  assert.equal(gradeBandLabel([[7, 10]], 'en'), 'Grades 7–10');
  assert.equal(gradeBandLabel([[1, 4], [9, 10]], 'en'), 'Grades 1–4, 9–10');
});

test('a grade range never wraps at its dash', () => {
  assert.match(label([[9, 10]], 'ar'), /9\u2060–\u206010/);
});

test('element data has unique symbols and names', () => {
  assert.equal(new Set(ELEMENTS.map(e => e.symbol)).size, ELEMENTS.length);
  assert.equal(new Set(ELEMENTS.map(e => e.nameAr)).size, ELEMENTS.length);
  assert.equal(new Set(ELEMENTS.map(e => e.nameEn)).size, ELEMENTS.length);
});

test('element question: correct answer exactly once among 4 distinct options', () => {
  const rng = makeRng(4);
  for (const shows of ['symbol', 'name'] as const) {
    const el = ELEMENTS.find(e => e.symbol === 'Na')!;
    const q = buildElementQuestion(el, ELEMENTS, shows, 'ar', rng);
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options.map(o => o.id)).size, 4);
    assert.equal(new Set(q.options.map(o => o.label)).size, 4);
    assert.equal(q.options.filter(o => o.id === q.correctId).length, 1);
    assert.equal(q.correctId, 'Na');
    const answer = q.options.find(o => o.id === q.correctId)!;
    assert.equal(answer.label, shows === 'symbol' ? 'الصوديوم' : 'Na');
  }
});

test('element distractors prefer symbols that start with the same letter', () => {
  // C, Ca, Cl, Cu — the set students actually confuse.
  const carbon = ELEMENTS.find(e => e.symbol === 'C')!;
  const q = buildElementQuestion(carbon, ELEMENTS, 'name', 'ar', makeRng(1));
  for (const o of q.options) assert.ok(o.id.startsWith('C'), `${o.id} is not a C-element`);
});

test('element round asks about distinct elements and mixes both directions', () => {
  const round = buildElementRound('ar', 10, makeRng(9));
  assert.equal(round.length, 10);
  assert.equal(new Set(round.map(q => q.element.symbol)).size, 10);
  const directions = new Set(round.map(q => q.shows));
  assert.deepEqual([...directions].sort(), ['name', 'symbol']);
});
