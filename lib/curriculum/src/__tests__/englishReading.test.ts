/**
 * Grade 1 reading: which words have a first sound the app may ask about, and
 * the per-unit sign-off that keeps the activities hidden until a teacher has
 * read the list (docs/english-reading-g1-review.html).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hubLessonsForGrade } from '../englishHub.ts';
import { READING_UNITS, firstSound, firstSoundSkip, offeredReading, readingUnit } from '../englishReading.ts';

test('a first sound is the first letter, except where the letter is not the sound', () => {
  const cases: [string, string | null][] = [
    ['girl', 'g'], ['green', 'g'], ['giraffe', null], ['chair', null], ['three', null],
    ['apples', null], ['eraser', null], ['one', null], ['orange', null],
    ['T-shirt', 't'], ['pencil case', 'p'], ['yoyo', 'y'], ['cat', 'c'], ['whiteboard', 'w'],
  ];
  for (const [word, letter] of cases) assert.equal(firstSound(word), letter, word);
  assert.equal(firstSoundSkip('giraffe'), 'soft-g');
  assert.equal(firstSoundSkip('chair'), 'digraph');
  assert.equal(firstSoundSkip('apples'), 'vowel');
  assert.equal(firstSoundSkip('cereal'), 'soft-c');
  assert.equal(firstSoundSkip('girl'), null);
});

test('over the 10 lessons, exactly the words the spec names are left out', () => {
  const out = new Set(hubLessonsForGrade(1).flatMap(l => l.words.filter(w => firstSound(w.en) === null).map(w => w.en)));
  assert.deepEqual([...out].sort(), ['apples', 'arms', 'chair', 'eight', 'eraser', 'giraffe', 'one', 'orange', 'three']);
});

test('every Grade 1 hub lesson has one reading record, and nothing else does', () => {
  const ids = hubLessonsForGrade(1).map(l => l.id).sort();
  assert.deepEqual(READING_UNITS.map(u => u.lessonId).sort(), ids);
  assert.equal(new Set(READING_UNITS.map(u => u.lessonId)).size, READING_UNITS.length);
});

test('every unit ships unreviewed, so nothing is offered', () => {
  for (const u of READING_UNITS) {
    assert.equal(u.reviewedBy, null, u.lessonId);
    assert.equal(offeredReading(u.lessonId), null, u.lessonId);
  }
  assert.equal(offeredReading('kbl-g2-eng-s1-nccd-u1_l1'), null);
  assert.equal(readingUnit('nope'), undefined);
});

test('a signed-off unit offers its lesson words', () => {
  const u = READING_UNITS[1];
  const saved = u.reviewedBy;
  u.reviewedBy = { name: 'test', date: '2026-10-17' };
  try {
    assert.deepEqual(
      offeredReading(u.lessonId)?.map(w => w.en),
      hubLessonsForGrade(1).find(l => l.id === u.lessonId)!.words.map(w => w.en),
    );
  } finally {
    u.reviewedBy = saved;
  }
});

test("the teacher's reading form lists every word once per unit, and the committed copy is current", async () => {
  const { readFileSync } = await import('node:fs');
  const { renderReadingReviewHtml } = await import('../englishReadingReview.ts');
  const html = renderReadingReviewHtml();
  const words = hubLessonsForGrade(1).flatMap(l => l.words);
  assert.equal((html.match(/<td class="word" dir="ltr">/g) ?? []).length, words.length);
  // Every word the app may ask about shows its letter; every left-out word shows why.
  assert.equal((html.match(/<td class="letter" dir="ltr">[a-z]<\/td>/g) ?? []).length, words.filter(w => firstSound(w.en)).length);
  assert.equal((html.match(/<td class="skip">/g) ?? []).length, words.filter(w => !firstSound(w.en)).length);
  assert.equal((html.match(/<section class="unit"/g) ?? []).length, READING_UNITS.length);
  const committed = readFileSync(new URL('../../../../docs/english-reading-g1-review.html', import.meta.url), 'utf8');
  assert.equal(committed, html, 'stale: run pnpm --filter @workspace/curriculum run grammar-sheet');
});

test('the Welcome unit is named, not numbered: «الوحدة ٠» reads as a dot beside «·»', async () => {
  const { unitLabelAr } = await import('../englishGrammarReview.ts');
  assert.equal(unitLabelAr(0), 'وحدة الترحيب');
  assert.equal(unitLabelAr(7), 'الوحدة ٧');
});
