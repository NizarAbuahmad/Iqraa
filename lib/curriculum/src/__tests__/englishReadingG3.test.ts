/**
 * Grade 3 reading (spec: docs/superpowers/specs/2026-10-22-english-corner-reading-g3-design.md):
 * the unit rows, the sentence pool, the partner picture, and the gates.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hubLessonsForGrade } from '../englishHub.ts';
import {
  READING_NOT_COVERED_G3, READING_UNITS, distinctPictureWords, firstSound, firstSoundSkip,
  offeredReading, offeredReadingSentences, readSentencePool, readingUnitsForGrade, sentencePartner,
} from '../englishReading.ts';

const G3 = hubLessonsForGrade(3);
const L = (sem: number, unit: number) => `kbl-g3-eng-s${sem}-nccd-u${unit}_l1`;
const ELIGIBLE = [L(1, 3), L(1, 5), L(2, 9)];

test('every Grade 3 hub lesson has one reading row, all unsigned, none offered', () => {
  assert.deepEqual(readingUnitsForGrade(3).map(u => u.lessonId).sort(), G3.map(l => l.id).sort());
  assert.equal(readingUnitsForGrade(3).length, 8);
  assert.equal(new Set(READING_UNITS.map(u => u.lessonId)).size, READING_UNITS.length);
  for (const u of readingUnitsForGrade(3)) {
    assert.equal(u.reviewedBy, null, u.lessonId);
    assert.equal(offeredReading(u.lessonId), null, u.lessonId);
    assert.equal(offeredReadingSentences(u.lessonId), null, u.lessonId);
  }
});

test('the Grade 1 first-sound rule needs no new exception: it leaves out exactly these 20 Grade 3 words', () => {
  const out = G3.flatMap(l => l.words.filter(w => firstSound(w.en) === null).map(w => w.en));
  assert.equal(out.length, 20);
  assert.deepEqual([...out].sort(), [
    'afternoon', 'evening', 'shirt', 'phone', 'Thursday', 'astronaut', 'chef', 'artist', 'underground',
    'chicken', 'sheep', 'old', 'shampoo', 'armchair', 'in front of', 'opposite', 'giraffe', 'elephant', 'eagle',
    'ice lolly',
  ].sort());
  for (const w of out) assert.ok(firstSoundSkip(w), w);
});

test('the sentence pool exists for exactly S1 U3, S1 U5 and S2 U9, and Grade 2 is unchanged', () => {
  const withPool = G3.filter(l => readSentencePool(l.id).length > 0).map(l => l.id).sort();
  assert.deepEqual(withPool, [...ELIGIBLE].sort());
  assert.deepEqual(ELIGIBLE.map(id => readSentencePool(id).length), [26, 22, 18]);
  assert.deepEqual(ELIGIBLE.map(id => distinctPictureWords(readSentencePool(id))), [12, 16, 6]);
  for (const l of hubLessonsForGrade(1)) assert.deepEqual(readSentencePool(l.id), [], l.id);
  assert.equal(hubLessonsForGrade(2).filter(l => readSentencePool(l.id).length > 0).length, 7);
  for (const id of ELIGIBLE) for (const s of readSentencePool(id)) {
    assert.ok(s.picture, s.key);
    assert.equal(s.yesNo, null, s.key);
  }
});

test("partners: S1 U5 pairs the transport sentences he / she, S2 U9 has one for each of its three forms per word, S1 U3 has none", () => {
  const partnered = (id: string) => {
    const pool = readSentencePool(id);
    return pool.filter(s => sentencePartner(s, pool));
  };
  const u5 = partnered(L(1, 5));
  assert.equal(u5.length, 12);
  assert.ok(u5.every(s => /goes to work by/.test(s.text)), 'only the transport sentences have a partner');
  assert.equal(partnered(L(2, 9)).length, 18);
  assert.equal(partnered(L(1, 3)).length, 0);
  for (const id of ELIGIBLE) {
    const pool = readSentencePool(id);
    for (const s of pool) {
      const p = sentencePartner(s, pool);
      if (!p) continue;
      assert.equal(p.picture!.word, s.picture!.word, s.key);
      assert.ok(p.picture!.count !== s.picture!.count || p.marker !== s.marker, s.key);
      assert.notEqual(p.key, s.key);
      // S1 U5 comes in he / she pairs; S2 U9 has three forms per word (There's, There isn't, There are), so only
      // the pairs are symmetric: the first other form is the partner.
      if (id === L(1, 5)) assert.equal(sentencePartner(p, pool)?.key, s.key, `${s.key}: a partner's partner is the sentence`);
    }
  }
  const stars = readSentencePool(L(2, 9));
  assert.equal(distinctPictureWords(stars) * 3, stars.length, 'six words, each as There\'s, There isn\'t and There are');
  assert.equal(sentencePartner(stars.find(s => s.text === "There's a door.")!, stars)!.text, "There isn't a door.");
  assert.equal(sentencePartner(stars.find(s => s.text === "There isn't a door.")!, stars)!.text, "There's a door.");
  assert.equal(sentencePartner(stars.find(s => s.text === 'There are doors.')!, stars)!.text, "There's a door.");
  const work = readSentencePool(L(1, 5));
  assert.equal(sentencePartner(work.find(s => s.text === 'He goes to work by bus.')!, work)!.text, 'She goes to work by bus.');
});

test('the sentence activity needs reading, grammar and a Grade 2 or 3 lesson', () => {
  const id = L(1, 5);
  assert.equal(offeredReadingSentences(id, { reading: true, grammar: false }), null);
  assert.equal(offeredReadingSentences(id, { reading: false, grammar: true }), null);
  assert.deepEqual(offeredReadingSentences(id, { reading: true, grammar: true }), readSentencePool(id));
  assert.equal(offeredReadingSentences(L(1, 2), { reading: true, grammar: true }), null);
  assert.equal(offeredReadingSentences('kbl-g1-eng-s1-nccd-u1_l1', { reading: true, grammar: true }), null);
});

test('the not-covered table names the seven lessons with a gap, in form-safe text', () => {
  assert.deepEqual(Object.keys(READING_NOT_COVERED_G3).sort(),
    [L(1, 2), L(1, 3), L(1, 4), L(2, 7), L(2, 8), L(2, 9), L(2, 10)].sort());
  for (const [id, items] of Object.entries(READING_NOT_COVERED_G3)) {
    assert.ok(items.length > 0, id);
    for (const text of items) assert.ok(!/["&<>]/.test(text), `${id}: ${text}`);
  }
});

const docs = new URL('../../../../docs/', import.meta.url);

test('the Grade 3 reading form lists every word and pool sentence once, with a not-covered block per gap', async () => {
  const { renderReadingReviewHtml } = await import('../englishReadingReview.ts');
  const html = renderReadingReviewHtml(3);
  const words = G3.flatMap(l => l.words);
  assert.equal(words.length, 126);
  assert.equal((html.match(/<td class="word" dir="ltr">/g) ?? []).length, 126);
  assert.equal((html.match(/<td class="letter" dir="ltr">[a-z]<\/td>/g) ?? []).length, 106);
  assert.equal((html.match(/<td class="skip">/g) ?? []).length, 20);
  assert.equal((html.match(/<section class="unit"/g) ?? []).length, 8);
  assert.equal((html.match(/<td class="sentence" dir="ltr">/g) ?? []).length, 66);
  assert.equal((html.match(/class="not-covered"/g) ?? []).length, 7);
  assert.ok(html.includes('مراجعة قراءة الصف الثالث'));
  assert.ok(html.includes('اقرَأ الجملة'));
  assert.ok(html.includes('<td class="sentence" dir="ltr">She goes to work by bus.</td>'));
  assert.ok(html.includes("<td class=\"sentence\" dir=\"ltr\">There isn't a door.</td>"));
});

test('the committed Grade 3 reading form is exactly what the generator produces; Grades 1 and 2 are untouched', async () => {
  const { renderReadingReviewHtml } = await import('../englishReadingReview.ts');
  assert.equal(readFileSync(new URL('english-reading-g3-review.html', docs), 'utf8'), renderReadingReviewHtml(3), 'run: pnpm --filter @workspace/curriculum run grammar-sheet');
  assert.equal(readFileSync(new URL('english-reading-g2-review.html', docs), 'utf8'), renderReadingReviewHtml(2), 'Grade 2 form changed');
  assert.equal(readFileSync(new URL('english-reading-g1-review.html', docs), 'utf8'), renderReadingReviewHtml(1), 'Grade 1 form changed');
});
