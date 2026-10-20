/**
 * Round builders for the Grade 1 reading activities. Like grammar, the builders
 * do not gate on review — the lesson screen's `offeredReading` does — so they
 * are tested over every Grade 1 lesson.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { hubLessonsForGrade, type HubWord } from '@workspace/curriculum/englishHub';
import { firstSound } from '@workspace/curriculum/englishReading';
import { makeRng } from '../publicGames/rng.ts';
import {
  EMPTY_PROGRESS,
  READING_ACTIVITIES,
  READING_OPTIONS,
  ROUND_LENGTH,
  buildFirstLetterRound,
  buildReadFindRound,
  buildStartsWithRound,
  isPicturable,
  lessonStars,
  readingActivityAvailable,
  recordResult,
  wordPicture,
} from '../englishHub/games.ts';

const LESSONS = hubLessonsForGrade(1);
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

describe('Read and find', () => {
  it('asks a pictured word, offers three distinct pictures, the right one at answerIndex', () => {
    for (const l of LESSONS) for (const seed of SEEDS) {
      const round = buildReadFindRound(l.words, makeRng(seed));
      assert.equal(round.length, Math.min(ROUND_LENGTH, l.words.filter(w => isPicturable(w.en)).length), l.id);
      for (const q of round) {
        assert.equal(q.options.length, READING_OPTIONS);
        assert.equal(q.options[q.answerIndex], q.word.en);
        assert.ok(q.options.every(isPicturable), `${l.id} ${q.options}`);
        assert.equal(new Set(q.options.map(wordPicture)).size, READING_OPTIONS);
      }
    }
  });
});

describe('First letter', () => {
  it('asks only words with a first sound; the answer is that sound; three distinct letters, no b/d or p/q pair', () => {
    for (const l of LESSONS) for (const seed of SEEDS) {
      for (const q of buildFirstLetterRound(l.words, makeRng(seed))) {
        const letter = firstSound(q.word.en);
        assert.ok(letter, q.word.en);
        assert.equal(q.options[q.answerIndex], letter);
        assert.equal(q.options.length, READING_OPTIONS);
        assert.equal(new Set(q.options).size, READING_OPTIONS);
        assert.ok(q.options.every(o => /^[a-z]$/.test(o)));
        const has = (c: string) => q.options.includes(c);
        assert.ok(!(has('b') && has('d')), `${q.word.en} ${q.options}`);
        assert.ok(!(has('p') && has('q')), `${q.word.en} ${q.options}`);
      }
    }
  });
});

describe('Starts with', () => {
  it('exactly one option starts with the shown letter; no two share a first letter; all pictured', () => {
    for (const l of LESSONS) for (const seed of SEEDS) {
      const round = buildStartsWithRound(l.words, makeRng(seed));
      assert.ok(round.length > 0, l.id);
      for (const q of round) {
        assert.equal(q.options.length, READING_OPTIONS);
        assert.equal(q.options[q.answerIndex], q.word.en);
        assert.equal(firstSound(q.word.en), q.letter);
        const letters = q.options.map(firstSound);
        assert.ok(letters.every(Boolean), `${q.options}`);
        assert.equal(new Set(letters).size, READING_OPTIONS, `${q.options}`);
        assert.ok(q.options.every(isPicturable));
      }
    }
  });
});

describe('availability', () => {
  it('all three are available on all 10 lessons today', () => {
    for (const l of LESSONS) for (const a of READING_ACTIVITIES) assert.ok(readingActivityAvailable(a, l.words), `${l.id} ${a}`);
  });

  it('each is unavailable one short of its floor', () => {
    const w = (en: string): HubWord => ({ en, ar: '' });
    // Read and find: four pictured words.
    assert.equal(readingActivityAvailable('read-find', ['cat', 'dad', 'mum'].map(w)), false);
    assert.equal(readingActivityAvailable('read-find', ['cat', 'dad', 'mum', 'boy'].map(w)), true);
    // First letter: four words with a first sound (apples has none).
    assert.equal(readingActivityAvailable('first-letter', ['cat', 'dad', 'mum', 'apples'].map(w)), false);
    assert.equal(readingActivityAvailable('first-letter', ['cat', 'dad', 'mum', 'boy'].map(w)), true);
    // Starts with: three distinct first letters among pictured words (dad and doll share d).
    assert.equal(readingActivityAvailable('starts-with', ['dad', 'doll', 'mum', 'apples'].map(w)), false);
    assert.equal(readingActivityAvailable('starts-with', ['dad', 'doll', 'mum', 'cat'].map(w)), true);
    assert.equal(readingActivityAvailable('listen', ['cat', 'dad', 'mum', 'boy'].map(w)), false);
  });
});

it('reading stars count toward the lesson', () => {
  let p = EMPTY_PROGRESS;
  for (const a of READING_ACTIVITIES) p = recordResult(p, LESSONS[0].id, a, 2, '2026-10-17');
  assert.equal(lessonStars(p, LESSONS[0].id), 6);
});
