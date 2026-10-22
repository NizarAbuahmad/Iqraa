/**
 * Grade 2 reading (spec: docs/superpowers/specs/2026-10-20-english-corner-reading-g2-design.md):
 * the unit rows, the sentence pool, the partner picture, and the gates.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { grammarUnitsForGrade, unitSentences } from '../englishGrammar.ts';
import { hubLessonsForGrade } from '../englishHub.ts';
import {
  MIN_SENTENCE_WORDS, READING_NOT_COVERED_G2, READING_UNITS, distinctPictureWords, firstSound,
  offeredReading, offeredReadingSentences, readSentencePool, readingUnitsForGrade, sentencePartner,
} from '../englishReading.ts';

const G2 = hubLessonsForGrade(2);
const L = (sem: number, unit: number) => `kbl-g2-eng-s${sem}-nccd-u${unit}_l1`;
const ELIGIBLE = [L(1, 0), L(1, 1), L(1, 2), L(1, 4), L(2, 5), L(2, 6), L(2, 7)];

test('every Grade 2 hub lesson has one reading row, all unsigned, none offered', () => {
  assert.deepEqual(readingUnitsForGrade(2).map(u => u.lessonId).sort(), G2.map(l => l.id).sort());
  assert.equal(readingUnitsForGrade(2).length, 9);
  assert.equal(new Set(READING_UNITS.map(u => u.lessonId)).size, READING_UNITS.length);
  for (const u of readingUnitsForGrade(2)) {
    assert.equal(u.reviewedBy, null, u.lessonId);
    assert.equal(offeredReading(u.lessonId), null, u.lessonId);
    assert.equal(offeredReadingSentences(u.lessonId), null, u.lessonId);
  }
});

test('the Grade 1 first-sound rule needs no new exception on Grade 2 words', () => {
  const out = new Set(G2.flatMap(l => l.words.filter(w => firstSound(w.en) === null).map(w => w.en)));
  assert.equal(out.size, 22);
  assert.deepEqual([...out].sort(), [
    'action figure', 'apple', 'arms', 'aunt', 'chair', 'cheese', 'chicken', 'eggs', 'ears', 'eight', 'eraser',
    'eyes', 'knees', 'one', 'orange', 'shell', 'shelf', 'shoes', 'short', 'shorts', 'three', 'uncle',
  ].sort());
});

test('the sentence pool exists for exactly seven lessons: S1 U3 and S2 U8 have none', () => {
  const withPool = G2.filter(l => readSentencePool(l.id).length > 0).map(l => l.id).sort();
  assert.deepEqual(withPool, [...ELIGIBLE].sort());
  assert.equal(readSentencePool(L(1, 3)).length, 0);
  assert.equal(readSentencePool(L(2, 8)).length, 0);
  assert.equal(MIN_SENTENCE_WORDS, 6);
  for (const l of hubLessonsForGrade(1)) assert.deepEqual(readSentencePool(l.id), [], l.id);
  assert.deepEqual(readSentencePool('nope'), []);
});

test('the pool holds only pictured sentences that are not Yes or No, and measures as the spec says', () => {
  const counts = new Map(ELIGIBLE.map(id => [id, readSentencePool(id).length]));
  assert.deepEqual([...counts], [
    [L(1, 0), 16], [L(1, 1), 12], [L(1, 2), 15], [L(1, 4), 10], [L(2, 5), 20], [L(2, 6), 28], [L(2, 7), 11],
  ]);
  for (const id of ELIGIBLE) {
    const pool = readSentencePool(id);
    for (const s of pool) {
      assert.ok(s.picture, s.key);
      assert.equal(s.yesNo, null, s.key);
    }
    assert.ok(distinctPictureWords(pool) >= MIN_SENTENCE_WORDS, id);
  }
  assert.equal(distinctPictureWords(readSentencePool(L(1, 2))), 8);
  assert.equal(distinctPictureWords(readSentencePool(L(1, 4))), 7);
});

test('a partner is the same picture word with another count or marker; the counts match the spec', () => {
  const withPartner = (id: string) => {
    const pool = readSentencePool(id);
    return pool.filter(s => sentencePartner(s, pool)).length;
  };
  assert.equal(withPartner(L(1, 2)), 14);
  assert.equal(withPartner(L(1, 4)), 6);
  assert.equal(withPartner(L(2, 5)), 20);
  assert.equal(withPartner(L(2, 6)), 28);
  for (const id of [L(1, 0), L(1, 1), L(2, 7)]) assert.equal(withPartner(id), 0, id);
  for (const id of ELIGIBLE) {
    const pool = readSentencePool(id);
    for (const s of pool) {
      const p = sentencePartner(s, pool);
      if (!p) continue;
      assert.equal(p.picture!.word, s.picture!.word, s.key);
      assert.ok(p.picture!.count !== s.picture!.count || p.marker !== s.marker, s.key);
      assert.equal(sentencePartner(p, pool)?.key, s.key, `${s.key}: a partner's partner is the sentence`);
    }
  }
  // «I like cheese.» (✅) against «I don't like cheese.» (❌); «scissors» has no singular.
  const food = readSentencePool(L(2, 6));
  const like = food.find(s => s.text === 'I like cheese.')!;
  assert.equal(sentencePartner(like, food)!.text, "I don't like cheese.");
  const school = readSentencePool(L(1, 2));
  assert.equal(sentencePartner(school.find(s => s.text === 'These are my scissors.')!, school), null);
});

test('the sentence activity needs reading, grammar and a Grade 2 lesson, all three', () => {
  const id = L(2, 5);
  assert.equal(offeredReadingSentences(id, { reading: true, grammar: false }), null);
  assert.equal(offeredReadingSentences(id, { reading: false, grammar: true }), null);
  assert.deepEqual(offeredReadingSentences(id, { reading: true, grammar: true }), readSentencePool(id));
  // Both signed, but no pool: S1 U3 and S2 U8, and every Grade 1 lesson.
  assert.equal(offeredReadingSentences(L(2, 8), { reading: true, grammar: true }), null);
  assert.equal(offeredReadingSentences(L(1, 3), { reading: true, grammar: true }), null);
  assert.equal(offeredReadingSentences('kbl-g1-eng-s1-nccd-u1_l1', { reading: true, grammar: true }), null);
});

test('the not-covered table names the lessons with no sentence activity, in form-safe text', () => {
  assert.deepEqual(Object.keys(READING_NOT_COVERED_G2).sort(), [L(1, 1), L(1, 3), L(2, 6), L(2, 8)].sort());
  for (const [id, items] of Object.entries(READING_NOT_COVERED_G2)) {
    assert.ok(items.length > 0, id);
    for (const text of items) assert.ok(!/["&<>]/.test(text), `${id}: ${text}`);
  }
});

const docs = new URL('../../../../docs/', import.meta.url);

test("the Grade 2 reading form lists every word and every pool sentence once, with a not-covered block per gap", async () => {
  const { renderReadingReviewHtml } = await import('../englishReadingReview.ts');
  const html = renderReadingReviewHtml(2);
  const words = G2.flatMap(l => l.words);
  assert.equal(words.length, 154);
  assert.equal((html.match(/<td class="word" dir="ltr">/g) ?? []).length, 154);
  assert.equal((html.match(/<td class="letter" dir="ltr">[a-z]<\/td>/g) ?? []).length, words.filter(w => firstSound(w.en)).length);
  assert.equal((html.match(/<td class="skip">/g) ?? []).length, words.filter(w => !firstSound(w.en)).length);
  assert.equal((html.match(/<section class="unit"/g) ?? []).length, 9);
  // One row per sentence of the seven pools: 16 + 12 + 15 + 10 + 20 + 28 + 11.
  assert.equal((html.match(/<td class="sentence" dir="ltr">/g) ?? []).length, 112);
  assert.equal((html.match(/class="not-covered"/g) ?? []).length, 4);
  assert.ok(html.includes('مراجعة قراءة الصف الثاني'));
  assert.ok(html.includes('اقرَأ الجملة'));
  // Partner rows name the picture the app will show against the sentence.
  assert.ok(html.includes('<td class="sentence" dir="ltr">I like cheese.</td>'));
  assert.ok(html.includes('كلمتان أخريان من القائمة'), 'a sentence with no partner says its wrong pictures come from the list');
  for (const u of grammarUnitsForGrade(2)) assert.ok(unitSentences(u).length > 0);
});

test('the committed Grade 2 reading form is exactly what the generator produces; Grade 1 is untouched', async () => {
  const { renderReadingReviewHtml } = await import('../englishReadingReview.ts');
  assert.equal(readFileSync(new URL('english-reading-g2-review.html', docs), 'utf8'), renderReadingReviewHtml(2), 'run: pnpm --filter @workspace/curriculum run grammar-sheet');
  assert.equal(readFileSync(new URL('english-reading-g1-review.html', docs), 'utf8'), renderReadingReviewHtml(1), 'Grade 1 form changed');
  assert.equal(renderReadingReviewHtml(), renderReadingReviewHtml(1));
});
