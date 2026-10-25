/**
 * Grade 4 reading on the app side (spec: docs/superpowers/specs/2026-10-22-english-corner-reading-g4-design.md).
 * The round builder and the availability floors are grade-agnostic; this pins that they do the right thing on the
 * Grade 4 data: four lessons with a «Read the sentence» pool, and the word activities by lesson.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { allGrammarSpoken } from '@workspace/curriculum/englishGrammar';
import { hubLessonsForGrade } from '@workspace/curriculum/englishHub';
import { distinctPictureWords, readSentencePool, sentencePartner } from '@workspace/curriculum/englishReading';
import { makeRng } from '../publicGames/rng.ts';
import {
  READING_OPTIONS,
  ROUND_LENGTH,
  buildReadSentenceRound,
  readSentenceAvailable,
  readingActivityAvailable,
  type SentencePictureOption,
} from '../englishHub/games.ts';

const L = (sem: number, unit: number) => `kbl-g4-eng-s${sem}-nccd-u${unit}_l1`;
const G4 = hubLessonsForGrade(4);
const POOLS = G4.map(l => ({ id: l.id, pool: readSentencePool(l.id) })).filter(p => p.pool.length > 0);
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const spoken = new Set(allGrammarSpoken());
const key = (o: SentencePictureOption) => `${o.word}|${o.count}|${o.marker ?? ''}`;

describe('Grade 4 reading: Read the sentence', () => {
  it('is offered on exactly S1 U1, S1 U3, S1 U5 and S2 U8', () => {
    assert.deepEqual(POOLS.map(p => p.id).sort(), [L(1, 1), L(1, 3), L(1, 5), L(2, 8)].sort());
    for (const l of G4) assert.equal(readSentenceAvailable(readSentencePool(l.id)), POOLS.some(p => p.id === l.id), l.id);
  });

  it('a round is min(8, picture words) questions: exactly 6 for S1 U1 (six flags), 8 for the other three', () => {
    const size = (id: string) => buildReadSentenceRound(readSentencePool(id), makeRng(1)).length;
    assert.equal(size(L(1, 1)), 6);
    for (const id of [L(1, 3), L(1, 5), L(2, 8)]) assert.equal(size(id), 8, id);
    for (const { id, pool } of POOLS) for (const seed of SEEDS) {
      assert.equal(buildReadSentenceRound(pool, makeRng(seed)).length, Math.min(ROUND_LENGTH, distinctPictureWords(pool)), id);
    }
  });

  it("every question has three distinct pictures, the sentence's own at answerIndex, a recording, and no Yes or No", () => {
    for (const { id, pool } of POOLS) for (const seed of SEEDS) {
      for (const q of buildReadSentenceRound(pool, makeRng(seed))) {
        assert.equal(q.options.length, READING_OPTIONS, `${id} ${q.sentence.text}`);
        assert.equal(new Set(q.options.map(key)).size, READING_OPTIONS, `${id} ${q.sentence.text}`);
        const own = key({ word: q.sentence.picture!.word, count: q.sentence.picture!.count, marker: q.sentence.marker });
        assert.equal(key(q.options[q.answerIndex]), own, q.sentence.text);
        assert.equal(q.sentence.yesNo, null, q.sentence.text);
        assert.ok(spoken.has(q.sentence.text), `${q.sentence.text} has no recording`);
      }
    }
  });

  it('never asks one picture word twice in a round', () => {
    for (const { id, pool } of POOLS) for (const seed of SEEDS) {
      const words = buildReadSentenceRound(pool, makeRng(seed)).map(q => q.sentence.picture!.word);
      assert.equal(new Set(words).size, words.length, id);
    }
  });

  it('shows the partner among the wrong pictures whenever one exists, and no other picture of the answer\'s word', () => {
    let withPartner = 0;
    for (const { id, pool } of POOLS) for (const seed of SEEDS) {
      for (const q of buildReadSentenceRound(pool, makeRng(seed))) {
        const partner = sentencePartner(q.sentence, pool);
        if (!partner) continue;
        withPartner += 1;
        const wrong = q.options.filter((_, k) => k !== q.answerIndex);
        const want = key({ word: partner.picture!.word, count: partner.picture!.count, marker: partner.marker });
        assert.ok(wrong.some(o => key(o) === want), `${id}: ${q.sentence.text} lacks its partner`);
        assert.equal(wrong.filter(o => o.word === q.sentence.picture!.word).length, 1, q.sentence.text);
      }
    }
    assert.ok(withPartner > 0);
    // S1 U1, S1 U3 and S2 U8 have a partner for every question; S1 U5's clothes questions have none.
    for (const id of [L(1, 1), L(1, 3), L(2, 8)]) {
      const pool = readSentencePool(id);
      for (const seed of SEEDS) for (const q of buildReadSentenceRound(pool, makeRng(seed))) assert.ok(sentencePartner(q.sentence, pool), `${id}: ${q.sentence.text}`);
    }
  });
});

describe('Grade 4 reading: the word activities by lesson', () => {
  it('First letter on all nine; Read and find where the words have pictures; Starts with on the same lessons bar S1 U1', () => {
    const withPictures = new Set([L(1, 1), L(1, 3), L(1, 4), L(1, 5), L(2, 8), L(2, 10)]);
    // S1 U1's pictured words are six flags; once Qatar, Egypt and the two multi-word countries are skipped only Jordan (j)
    // and Spain (s) are left, under the floor of three distinct letters.
    const startsWith = new Set([...withPictures].filter(id => id !== L(1, 1)));
    assert.equal(G4.length, 9);
    for (const l of G4) {
      assert.equal(readingActivityAvailable('first-letter', l.words), true, l.id);
      assert.equal(readingActivityAvailable('read-find', l.words), withPictures.has(l.id), l.id);
      assert.equal(readingActivityAvailable('starts-with', l.words), startsWith.has(l.id), l.id);
    }
  });
});
