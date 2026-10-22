/**
 * Grade 4 reading (spec: docs/superpowers/specs/2026-10-22-english-corner-reading-g4-design.md):
 * the unit rows, the new first-sound exception, the sentence pool, the partner picture, and the gates.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hubLessonsForGrade } from '../englishHub.ts';
import {
  READING_NOT_COVERED_G4, READING_UNITS, distinctPictureWords, firstSound, firstSoundSkip,
  offeredReading, offeredReadingSentences, readSentencePool, readingUnitsForGrade, sentencePartner,
} from '../englishReading.ts';

const G4 = hubLessonsForGrade(4);
const L = (sem: number, unit: number) => `kbl-g4-eng-s${sem}-nccd-u${unit}_l1`;
const ELIGIBLE = [L(1, 1), L(1, 3), L(1, 5), L(2, 8)];

test('every Grade 4 hub lesson has one reading row, all unsigned, none offered', () => {
  assert.deepEqual(readingUnitsForGrade(4).map(u => u.lessonId).sort(), G4.map(l => l.id).sort());
  assert.equal(readingUnitsForGrade(4).length, 9);
  assert.equal(new Set(READING_UNITS.map(u => u.lessonId)).size, READING_UNITS.length);
  for (const u of readingUnitsForGrade(4)) {
    assert.equal(u.reviewedBy, null, u.lessonId);
    assert.equal(offeredReading(u.lessonId), null, u.lessonId);
    assert.equal(offeredReadingSentences(u.lessonId), null, u.lessonId);
  }
});

test('«Qatar» and «Qatari» are skipped (Q is read /k/); «quickly», «quiet» and «quietly» are /kw/ and stay', () => {
  assert.equal(firstSoundSkip('Qatar'), 'hard-q');
  assert.equal(firstSoundSkip('Qatari'), 'hard-q');
  assert.equal(firstSound('Qatar'), null);
  for (const w of ['quickly', 'quiet', 'quietly', 'queue']) assert.equal(firstSound(w), 'q', w);
});

test('the rule leaves out exactly these 45 Grade 4 words, each with a reason', () => {
  const out = G4.flatMap(l => l.words.filter(w => firstSound(w.en) === null).map(w => w.en));
  assert.equal(out.length, 45);
  assert.deepEqual([...out].sort(), [
    'Egypt', 'Qatar', 'the United Kingdom', 'the United Arab Emirates', 'Egyptian', 'Emirati', 'Qatari',
    'Arabic', 'Art', 'English', 'Islamic Studies', 'always', 'often', 'at the weekend', 'every day', 'once a week', 'three times a week',
    'cereal', 'olives', 'a bag of', 'a bottle of', 'a bowl of', 'a box of', 'a can of', 'a cup of', 'a glass of', 'a plate of',
    'city', 'island', 'exciting', 'interesting',
    'chef', 'arrive on time', 'shout in class',
    'knit', 'easily',
    'shopping centre', 'ancient', 'cheap', 'expensive',
    'iron', 'shield', 'arrive', 'use',
    'invitation',
  ].sort());
  for (const w of out) assert.ok(firstSoundSkip(w), w);
});

test('the sentence pool exists for exactly S1 U1, U3, U5 and S2 U8, and Grades 1–3 are unchanged', () => {
  const withPool = G4.filter(l => readSentencePool(l.id).length > 0).map(l => l.id).sort();
  assert.deepEqual(withPool, [...ELIGIBLE].sort());
  assert.deepEqual(ELIGIBLE.map(id => readSentencePool(id).length), [30, 24, 21, 32]);
  assert.deepEqual(ELIGIBLE.map(id => distinctPictureWords(readSentencePool(id))), [6, 8, 13, 9]);
  for (const l of hubLessonsForGrade(1)) assert.deepEqual(readSentencePool(l.id), [], l.id);
  assert.equal(hubLessonsForGrade(2).filter(l => readSentencePool(l.id).length > 0).length, 7);
  assert.equal(hubLessonsForGrade(3).filter(l => readSentencePool(l.id).length > 0).length, 3);
  for (const id of ELIGIBLE) for (const s of readSentencePool(id)) {
    assert.ok(s.picture, s.key);
    assert.equal(s.yesNo, null, s.key);
  }
});

test('partners: S1 U1, U3 and S2 U8 have one for every sentence; S1 U5 for the 16 job sentences, none for the clothes', () => {
  const partnered = (id: string) => {
    const pool = readSentencePool(id);
    return pool.filter(s => sentencePartner(s, pool));
  };
  assert.equal(partnered(L(1, 1)).length, 30);
  assert.equal(partnered(L(1, 3)).length, 24);
  assert.equal(partnered(L(2, 8)).length, 32);
  const jobs = partnered(L(1, 5));
  assert.equal(jobs.length, 16);
  assert.ok(jobs.every(s => /^(He|She)'s a /.test(s.text)));
  for (const id of ELIGIBLE) {
    const pool = readSentencePool(id);
    for (const s of pool) {
      const p = sentencePartner(s, pool);
      if (!p) continue;
      assert.equal(p.picture!.word, s.picture!.word, s.key);
      assert.ok(p.picture!.count !== s.picture!.count || p.marker !== s.marker, s.key);
    }
  }
  const flags = readSentencePool(L(1, 1));
  assert.equal(sentencePartner(flags.find(s => s.text === "I'm from Spain.")!, flags)!.text, "He's from Spain.");
  assert.equal(sentencePartner(flags.find(s => s.text === "I'm Spanish.")!, flags)!.text, "He's from Spain.");
});

test('the sentence activity needs reading, grammar and a Grade 2, 3 or 4 lesson', () => {
  const id = L(1, 3);
  assert.equal(offeredReadingSentences(id, { reading: true, grammar: false }), null);
  assert.equal(offeredReadingSentences(id, { reading: false, grammar: true }), null);
  assert.deepEqual(offeredReadingSentences(id, { reading: true, grammar: true }), readSentencePool(id));
  assert.equal(offeredReadingSentences(L(1, 4), { reading: true, grammar: true }), null);
  assert.equal(offeredReadingSentences('kbl-g1-eng-s1-nccd-u1_l1', { reading: true, grammar: true }), null);
});

test('the not-covered table names the five lessons with no sentence activity and S1 U1 (no Starts with), in form-safe text', () => {
  assert.deepEqual(Object.keys(READING_NOT_COVERED_G4).sort(), [L(1, 1), L(1, 2), L(1, 4), L(2, 7), L(2, 9), L(2, 10)].sort());
  for (const [id, items] of Object.entries(READING_NOT_COVERED_G4)) {
    assert.ok(items.length > 0, id);
    for (const text of items) assert.ok(!/["&<>]/.test(text), `${id}: ${text}`);
  }
});

const docs = new URL('../../../../docs/', import.meta.url);

test('the Grade 4 reading form lists every word and pool sentence once, the 45 left-out words, and a note per gap', async () => {
  const { renderReadingReviewHtml } = await import('../englishReadingReview.ts');
  const html = renderReadingReviewHtml(4);
  const words = G4.flatMap(l => l.words);
  assert.equal(words.length, 172);
  assert.equal((html.match(/<td class="word" dir="ltr">/g) ?? []).length, 172);
  assert.equal((html.match(/<td class="letter" dir="ltr">[a-z]<\/td>/g) ?? []).length, 127);
  assert.equal((html.match(/<td class="skip">/g) ?? []).length, 45);
  assert.equal((html.match(/<section class="unit"/g) ?? []).length, 9);
  assert.equal((html.match(/<td class="sentence" dir="ltr">/g) ?? []).length, 107);
  assert.equal((html.match(/class="not-covered"/g) ?? []).length, 6);
  assert.ok(html.includes('مراجعة قراءة الصف الرابع'));
  assert.ok(html.includes('اقرَأ الجملة'));
  assert.ok(html.includes('<td class="sentence" dir="ltr">He\'s from Spain.</td>'));
  assert.ok(html.includes('<td class="skip">لا تُستعمل: <span dir="ltr">Q</span> تُلفظ <span dir="ltr">k</span> هنا</td>'));
});

test('the committed Grade 4 reading form is exactly what the generator produces; Grades 1–3 are untouched', async () => {
  const { renderReadingReviewHtml } = await import('../englishReadingReview.ts');
  const read = (f: string) => readFileSync(new URL(f, docs), 'utf8');
  assert.equal(read('english-reading-g4-review.html'), renderReadingReviewHtml(4), 'run: pnpm --filter @workspace/curriculum run grammar-sheet');
  for (const g of [1, 2, 3]) assert.equal(read(`english-reading-g${g}-review.html`), renderReadingReviewHtml(g), `Grade ${g} reading form changed`);
});
