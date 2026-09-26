import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ENGLISH_HUB_LESSONS } from '@workspace/curriculum/englishHub';
import { makeRng } from '../publicGames/rng.ts';
import {
  EMPTY_PROGRESS,
  LISTEN_OPTIONS,
  MATCH_PAIRS,
  buildListenRound,
  buildMatchDeck,
  buildScrambleRound,
  buildSpellRound,
  currentStreak,
  isMatchPair,
  isScrambleSolved,
  isSpeltCorrectly,
  lessonStars,
  normaliseSpelling,
  parseProgress,
  recordResult,
  starsFor,
} from '../englishHub/games.ts';

describe('listen and choose', () => {
  it('always offers the answer once, among distinct same-lesson options', () => {
    for (const lesson of ENGLISH_HUB_LESSONS) {
      const pool = new Set(lesson.words.map(w => w.en));
      for (const q of buildListenRound(lesson.words, makeRng(7))) {
        assert.equal(q.options[q.answerIndex], q.word.en, lesson.id);
        assert.equal(q.options.filter(o => o === q.word.en).length, 1, lesson.id);
        assert.equal(new Set(q.options).size, q.options.length, lesson.id);
        assert.ok(q.options.length <= LISTEN_OPTIONS && q.options.length >= 4, lesson.id);
        for (const o of q.options) assert.ok(pool.has(o), `${o} is not from ${lesson.id}`);
      }
    }
  });

  it('is reproducible for a seed', () => {
    const words = ENGLISH_HUB_LESSONS[0].words;
    assert.deepEqual(buildListenRound(words, makeRng(1)), buildListenRound(words, makeRng(1)));
  });
});

describe('match', () => {
  it('pairs every English card with its own Arabic meaning', () => {
    const lesson = ENGLISH_HUB_LESSONS[0];
    const deck = buildMatchDeck(lesson.words, makeRng(3));
    assert.equal(deck.length, 2 * Math.min(MATCH_PAIRS, lesson.words.length));
    for (const en of deck.filter(c => c.lang === 'en')) {
      const ar = deck.find(c => c.lang === 'ar' && c.pairId === en.pairId)!;
      assert.equal(lesson.words.find(w => w.en === en.text)!.ar, ar.text);
      assert.ok(isMatchPair(en, ar));
      assert.ok(!isMatchPair(en, en));
    }
  });
});

describe('spelling', () => {
  it('ignores case, spaces and hyphens, nothing else', () => {
    assert.ok(isSpeltCorrectly('T-Shirt', 'T-shirt'));
    assert.ok(isSpeltCorrectly(' tshirt ', 'T-shirt'));
    assert.ok(!isSpeltCorrectly('tshrit', 'T-shirt'));
    assert.ok(!isSpeltCorrectly('', 'cat'));
  });

  it('prefers single words when a lesson has enough', () => {
    for (const lesson of ENGLISH_HUB_LESSONS) {
      const singles = lesson.words.filter(w => !w.en.includes(' '));
      if (singles.length < 4) continue;
      for (const w of buildSpellRound(lesson.words, makeRng(5))) assert.ok(!w.en.includes(' '), w.en);
    }
  });
});

describe('scramble', () => {
  it('shuffles into the right letters, never already solved, for every G1-4 lesson', () => {
    for (const lesson of ENGLISH_HUB_LESSONS) {
      for (const q of buildScrambleRound(lesson.words, makeRng(11))) {
        const original = normaliseSpelling(q.word.en).split('');
        // .sort() mutates in place, so each side gets its own copy.
        assert.deepEqual(
          [...q.tiles.map(t => t.letter)].sort(),
          [...original].sort(),
          `${lesson.id}: ${q.word.en}`,
        );
        assert.ok(!isScrambleSolved(q.tiles, `not-${q.word.en}`), `${q.word.en} matched the wrong word`);
        if (original.length >= 2) {
          assert.notDeepEqual(q.tiles.map(t => t.letter).join(''), original.join(''), `${q.word.en} was left unshuffled`);
        }
      }
    }
  });

  it('checks the tiles in their current order, not as a bag of letters', () => {
    const solved = [{ id: 0, letter: 'c' }, { id: 1, letter: 'a' }, { id: 2, letter: 't' }];
    const unsolved = [{ id: 0, letter: 'a' }, { id: 1, letter: 'c' }, { id: 2, letter: 't' }];
    assert.ok(isScrambleSolved(solved, 'cat'));
    assert.ok(!isScrambleSolved(unsolved, 'cat'));
  });

  it('is reproducible for a seed', () => {
    const words = ENGLISH_HUB_LESSONS[0].words;
    assert.deepEqual(buildScrambleRound(words, makeRng(1)), buildScrambleRound(words, makeRng(1)));
  });

  it('prefers single words when a lesson has enough', () => {
    for (const lesson of ENGLISH_HUB_LESSONS) {
      const singles = lesson.words.filter(w => !w.en.includes(' '));
      if (singles.length < 4) continue;
      for (const q of buildScrambleRound(lesson.words, makeRng(5))) assert.ok(!q.word.en.includes(' '), q.word.en);
    }
  });
});

describe('stars and streak', () => {
  it('grades a round', () => {
    assert.equal(starsFor(8, 8), 3);
    assert.equal(starsFor(5, 8), 2);
    assert.equal(starsFor(1, 8), 1);
    assert.equal(starsFor(0, 0), 0);
  });

  it('keeps the best stars and counts consecutive days', () => {
    let p = recordResult(EMPTY_PROGRESS, 'L', 'listen', 2, '2026-09-25');
    p = recordResult(p, 'L', 'listen', 1, '2026-09-25');
    assert.equal(p.stars['L|listen'], 2);
    assert.equal(p.streak, 1);
    p = recordResult(p, 'L', 'spell', 3, '2026-09-26');
    assert.equal(p.streak, 2);
    assert.equal(lessonStars(p, 'L'), 5);
    assert.equal(currentStreak(p, '2026-09-27'), 2);
    assert.equal(currentStreak(p, '2026-09-28'), 0);
    p = recordResult(p, 'L', 'match', 1, '2026-09-30');
    assert.equal(p.streak, 1);
  });

  it('crosses a month boundary', () => {
    const p = recordResult({ stars: {}, streak: 4, lastDay: '2026-09-30' }, 'L', 'match', 1, '2026-10-01');
    assert.equal(p.streak, 5);
  });

  it('survives corrupt storage', () => {
    assert.deepEqual(parseProgress('not json'), EMPTY_PROGRESS);
    assert.deepEqual(parseProgress(null), EMPTY_PROGRESS);
    assert.equal(parseProgress('{"streak":-3,"stars":{}}').streak, 0);
  });
});
