/**
 * «Read the sentence» (Grade 2). The builder does not gate on review — the lesson screen's
 * `offeredReadingSentences` does — so it is tested over every lesson that has a pool.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { allGrammarSpoken } from '@workspace/curriculum/englishGrammar';
import { hubLessonsForGrade } from '@workspace/curriculum/englishHub';
import { MIN_SENTENCE_WORDS, distinctPictureWords, readSentencePool, sentencePartner } from '@workspace/curriculum/englishReading';
import { makeRng } from '../publicGames/rng.ts';
import {
  EMPTY_PROGRESS,
  READING_ACTIVITIES,
  READING_OPTIONS,
  ROUND_LENGTH,
  buildReadSentenceRound,
  lessonStars,
  readSentenceAvailable,
  recordResult,
  type SentencePictureOption,
} from '../englishHub/games.ts';

const POOLS = hubLessonsForGrade(2).map(l => ({ id: l.id, pool: readSentencePool(l.id) })).filter(p => p.pool.length > 0);
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const spoken = new Set(allGrammarSpoken());
const key = (o: SentencePictureOption) => `${o.word}|${o.count}|${o.marker ?? ''}`;
const own = (q: { sentence: { picture: { word: string; count: 1 | 2 } | null; marker: SentencePictureOption['marker'] } }): string =>
  key({ word: q.sentence.picture!.word, count: q.sentence.picture!.count, marker: q.sentence.marker });

describe('Read the sentence', () => {
  it('seven lessons have a pool, and it is offered on exactly those', () => {
    assert.equal(POOLS.length, 7);
    for (const l of hubLessonsForGrade(2)) {
      assert.equal(readSentenceAvailable(readSentencePool(l.id)), POOLS.some(p => p.id === l.id), l.id);
    }
    assert.equal(readSentenceAvailable([]), false);
  });

  it('is not one of the word activities, so it never shows on a lesson by words alone', () => {
    assert.ok(!READING_ACTIVITIES.includes('read-sentence'));
  });

  it('a round is at most eight questions, three distinct pictures, the sentence\'s own at answerIndex', () => {
    for (const { id, pool } of POOLS) for (const seed of SEEDS) {
      const round = buildReadSentenceRound(pool, makeRng(seed));
      assert.equal(round.length, Math.min(ROUND_LENGTH, distinctPictureWords(pool)), id);
      for (const q of round) {
        assert.equal(q.options.length, READING_OPTIONS, `${id} ${q.sentence.text}`);
        assert.equal(new Set(q.options.map(key)).size, READING_OPTIONS, `${id} ${q.sentence.text}`);
        assert.equal(key(q.options[q.answerIndex]), own(q), q.sentence.text);
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
        const wrong = q.options.filter((_, k) => k !== q.answerIndex);
        if (partner) {
          withPartner += 1;
          const want = key({ word: partner.picture!.word, count: partner.picture!.count, marker: partner.marker });
          assert.ok(wrong.some(o => key(o) === want), `${id}: ${q.sentence.text} lacks its partner`);
          // The other wrong picture is some other word.
          assert.equal(wrong.filter(o => o.word === q.sentence.picture!.word).length, 1, q.sentence.text);
        } else {
          assert.ok(wrong.every(o => o.word !== q.sentence.picture!.word), `${id}: ${q.sentence.text}`);
        }
      }
    }
    assert.ok(withPartner > 0);
  });

  it('is unavailable one picture word short of the floor', () => {
    const pool = readSentencePool('kbl-g2-eng-s2-nccd-u6_l1');
    const words = [...new Set(pool.map(s => s.picture!.word))].slice(0, MIN_SENTENCE_WORDS - 1);
    assert.equal(readSentenceAvailable(pool.filter(s => words.includes(s.picture!.word))), false);
    assert.equal(readSentenceAvailable(pool.filter(s => [...new Set(pool.map(t => t.picture!.word))].slice(0, MIN_SENTENCE_WORDS).includes(s.picture!.word))), true);
  });

  it('stars for it count toward the lesson', () => {
    const id = 'kbl-g2-eng-s2-nccd-u5_l1';
    const p = recordResult(EMPTY_PROGRESS, id, 'read-sentence', 3, '2026-10-20');
    assert.equal(lessonStars(p, id), 3);
  });
});
