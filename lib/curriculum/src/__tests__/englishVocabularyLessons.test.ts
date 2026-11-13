import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENGLISH_VOCABULARY } from '../vocabulary.ts';

/**
 * Grade 10 semester 1 prints its Word List as `WL<unit>.<n>`, where n is a running count per unit and NOT the lesson
 * number: page 65 reads «LESSON 1A WL2.1 · 2A WL2.2 · 3A WL2.3 · 5A WL2.4». Reading n as the lesson filed 85 words
 * on the wrong lesson. The lesson is the one in the «LESSON nA» heading above the marker.
 */
const S1 = (u: number, l: number) => `kbl-eng-s1-nccd-u${u}_l${l}`;
const lessonOf = (word: string, prefix = 'kbl-eng-s1-nccd-') =>
  ENGLISH_VOCABULARY.filter(w => w.word === word && w.lessonId.startsWith(prefix)).map(w => w.lessonId);

test('a WL2.4 word belongs to lesson 5A, not 4A', () => {
  assert.deepEqual(lessonOf('aerial filming'), [S1(2, 5)]);
  assert.deepEqual(lessonOf('search and rescue'), [S1(2, 5)]);
});

test('later markers of a unit land on their heading lessons', () => {
  assert.deepEqual(lessonOf('organism'), [S1(2, 3)]);
  assert.deepEqual(lessonOf('organic'), [S1(3, 5)]); // WL3.4 under LESSON 5A
  assert.deepEqual(lessonOf('immune system'), [S1(3, 6)]); // WL3.5 under LESSON 6A
  assert.deepEqual(lessonOf('carpooling'), [S1(4, 5)]); // WL4.4 under LESSON 5A
  assert.deepEqual(lessonOf('deadline'), [S1(5, 5)]); // WL5.3 under LESSON 5A
  assert.deepEqual(lessonOf('automation'), [S1(5, 6)]); // WL5.4 under LESSON 6A
});

test('the grammar lessons (4A) of units 2-4 print no Word List', () => {
  for (const u of [2, 3, 4]) {
    assert.equal(ENGLISH_VOCABULARY.filter(w => w.lessonId === S1(u, 4)).length, 0, `unit ${u} lesson 4`);
  }
});
