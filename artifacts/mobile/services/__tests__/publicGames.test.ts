import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, shuffle, sample } from '../publicGames/rng.ts';
import { COUNTRIES, buildTriviaQuestion, buildTriviaRound } from '../publicGames/countries.ts';
import { buildMemoryDeck, isMatch, MEMORY_ICONS } from '../publicGames/memory.ts';
import { buildColorGrid, deltaForRound, GRID_SIZE } from '../publicGames/colorSpot.ts';

test('makeRng is deterministic for a given seed', () => {
  const a = makeRng(42);
  const b = makeRng(42);
  const seqA = Array.from({ length: 5 }, () => a());
  const seqB = Array.from({ length: 5 }, () => b());
  assert.deepEqual(seqA, seqB);
});

test('shuffle is a permutation — same elements, same length', () => {
  const rng = makeRng(1);
  const input = [1, 2, 3, 4, 5];
  const out = shuffle(input, rng);
  assert.equal(out.length, input.length);
  assert.deepEqual([...out].sort(), [...input].sort());
});

test('sample never exceeds the pool and never repeats an item', () => {
  const rng = makeRng(7);
  const out = sample([1, 2, 3], 10, rng);
  assert.equal(out.length, 3);
  assert.deepEqual([...out].sort(), [1, 2, 3]);
});

test('trivia question includes the correct answer exactly once, plus 3 distractors', () => {
  const rng = makeRng(3);
  const country = COUNTRIES[0];
  const q = buildTriviaQuestion(country, COUNTRIES, 'name', 'ar', rng);
  assert.equal(q.options.length, 4);
  const ids = q.options.map(o => o.id);
  assert.equal(new Set(ids).size, 4, 'options must be distinct countries');
  assert.ok(ids.includes(q.correctId));
  assert.equal(q.correctId, country.code);
});

test('trivia round covers distinct countries and respects the requested count', () => {
  const rng = makeRng(9);
  const round = buildTriviaRound('capital', 'en', 6, rng);
  assert.equal(round.length, 6);
  const subjects = round.map(q => q.country.code);
  assert.equal(new Set(subjects).size, 6, 'a round must not ask about the same country twice');
});

test('memory deck has exactly two of each icon and is a valid pairing', () => {
  const rng = makeRng(11);
  const deck = buildMemoryDeck(6, rng);
  assert.equal(deck.length, 12);
  const counts = new Map<number, number>();
  for (const c of deck) counts.set(c.pairId, (counts.get(c.pairId) ?? 0) + 1);
  for (const n of counts.values()) assert.equal(n, 2);
});

test('memory deck caps pairCount at the number of available icons', () => {
  const deck = buildMemoryDeck(MEMORY_ICONS.length + 50, makeRng(1));
  assert.equal(deck.length, MEMORY_ICONS.length * 2);
});

test('isMatch requires same pairId and different card id', () => {
  const deck = buildMemoryDeck(4, makeRng(2));
  const [a] = deck;
  const partner = deck.find(c => c.pairId === a.pairId && c.id !== a.id)!;
  assert.ok(isMatch(a, partner));
  assert.ok(!isMatch(a, a));
  const other = deck.find(c => c.pairId !== a.pairId)!;
  assert.ok(!isMatch(a, other));
});

test('color grid difficulty shrinks with round but never below the visible floor', () => {
  assert.ok(deltaForRound(0) > deltaForRound(5));
  assert.ok(deltaForRound(100) >= 4);
});

test('color grid has exactly one odd square out of GRID_SIZE', () => {
  const rng = makeRng(5);
  const grid = buildColorGrid(0, rng);
  assert.equal(grid.colors.length, GRID_SIZE);
  assert.ok(grid.oddIndex >= 0 && grid.oddIndex < GRID_SIZE);
  const distinct = new Set(grid.colors);
  // Every square shares the base colour except the odd one.
  assert.equal(distinct.size, 2);
});
