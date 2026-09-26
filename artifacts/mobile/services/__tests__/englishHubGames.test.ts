import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ENGLISH_HUB_LESSONS } from '@workspace/curriculum/englishHub';
import { makeRng } from '../publicGames/rng.ts';
import {
  BADGE_IDS,
  EMPTY_PROGRESS,
  LISTEN_OPTIONS,
  MATCH_PAIRS,
  badgesEarned,
  buildListenRound,
  buildMatchDeck,
  buildPictureDeck,
  buildScrambleRound,
  buildSpeakingRound,
  buildSpellRound,
  currentStreak,
  isMatchPair,
  isPictureMatch,
  isPicturable,
  isScrambleSolved,
  isSpeltCorrectly,
  lessonHasPictureMatch,
  lessonStars,
  newlyEarnedBadges,
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

describe('picture matching', () => {
  it('pairs every emoji with the exact word it stands for, using only picturable words', () => {
    let sawAny = false;
    for (const lesson of ENGLISH_HUB_LESSONS) {
      if (!lessonHasPictureMatch(lesson.words)) continue;
      sawAny = true;
      const deck = buildPictureDeck(lesson.words, makeRng(3));
      assert.ok(deck.length >= 8 && deck.length % 2 === 0, lesson.id);
      for (const emoji of deck.filter(c => c.kind === 'emoji')) {
        const word = deck.find(c => c.kind === 'word' && c.pairId === emoji.pairId)!;
        assert.ok(lesson.words.some(w => w.en === word.text), `${word.text} not in ${lesson.id}`);
        assert.ok(isPictureMatch(emoji, word));
        assert.ok(!isPictureMatch(emoji, emoji));
      }
    }
    assert.ok(sawAny, 'no lesson in G1-4 had enough picturable words to test against');
  });

  it('never offers a lesson with fewer than 4 picturable words', () => {
    for (const lesson of ENGLISH_HUB_LESSONS) {
      const picturable = lesson.words.filter(w => isPicturable(w.en));
      assert.equal(lessonHasPictureMatch(lesson.words), picturable.length >= 4, lesson.id);
    }
  });
});

describe('speaking', () => {
  it('draws from the same single-word pool as spelling', () => {
    for (const lesson of ENGLISH_HUB_LESSONS) {
      const singles = lesson.words.filter(w => !w.en.includes(' '));
      if (singles.length < 4) continue;
      for (const w of buildSpeakingRound(lesson.words, makeRng(5))) assert.ok(!w.en.includes(' '), w.en);
    }
  });

  it('is reproducible for a seed', () => {
    const words = ENGLISH_HUB_LESSONS[0].words;
    assert.deepEqual(buildSpeakingRound(words, makeRng(1)), buildSpeakingRound(words, makeRng(1)));
  });
});

describe('badges', () => {
  it('earns nothing from an empty slate', () => {
    assert.deepEqual(badgesEarned(EMPTY_PROGRESS), []);
  });

  it('earns badges in order as stars and streak grow, and never loses one', () => {
    let p = EMPTY_PROGRESS;
    p = recordResult(p, 'L1', 'listen', 1, '2026-09-25');
    assert.deepEqual(badgesEarned(p), ['first_star']);

    p = recordResult(p, 'L1', 'match', 3, '2026-09-25');
    assert.deepEqual(badgesEarned(p), ['first_star', 'perfect_round']);

    // 5 lessons touched, still under 10 total stars.
    for (const lesson of ['L2', 'L3', 'L4', 'L5']) p = recordResult(p, lesson, 'listen', 1, '2026-09-25');
    assert.ok(badgesEarned(p).includes('five_lessons'));
    assert.ok(!badgesEarned(p).includes('ten_stars'), `total is ${JSON.stringify(p.stars)}`);

    // A day off, then back — streak is 1 again, but nothing already earned is lost.
    p = recordResult(p, 'L1', 'spell', 2, '2026-09-28');
    assert.equal(p.streak, 1);
    assert.deepEqual(badgesEarned(p), BADGE_IDS.filter(b => badgesEarned(p).includes(b)));
    assert.ok(badgesEarned(p).includes('first_star') && badgesEarned(p).includes('five_lessons'));
  });

  it('reports only what a finish newly unlocked', () => {
    const before = recordResult(EMPTY_PROGRESS, 'L', 'listen', 1, '2026-09-25');
    const after = recordResult(before, 'L', 'spell', 3, '2026-09-25');
    assert.deepEqual(newlyEarnedBadges(before, after), ['perfect_round']);
    assert.deepEqual(newlyEarnedBadges(after, after), []);
  });

  it('a 3-day and 7-day streak unlock in order, and stay unlocked after the streak resets', () => {
    let p = recordResult(EMPTY_PROGRESS, 'L', 'listen', 1, '2026-09-20');
    for (const day of ['2026-09-21', '2026-09-22']) p = recordResult(p, 'L', 'listen', 1, day);
    assert.equal(p.streak, 3);
    assert.ok(badgesEarned(p).includes('three_day_streak'));
    assert.ok(!badgesEarned(p).includes('week_streak'));

    for (const day of ['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26']) p = recordResult(p, 'L', 'listen', 1, day);
    assert.equal(p.streak, 7);
    assert.ok(badgesEarned(p).includes('week_streak'));

    // Break the streak entirely; the badge (an achievement, not a live status) survives.
    p = recordResult(p, 'L', 'listen', 1, '2026-10-05');
    assert.equal(p.streak, 1);
    assert.ok(badgesEarned(p).includes('week_streak') && badgesEarned(p).includes('three_day_streak'));
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
    const p = recordResult({ stars: {}, streak: 4, bestStreak: 4, lastDay: '2026-09-30' }, 'L', 'match', 1, '2026-10-01');
    assert.equal(p.streak, 5);
  });

  it('survives corrupt storage', () => {
    assert.deepEqual(parseProgress('not json'), EMPTY_PROGRESS);
    assert.deepEqual(parseProgress(null), EMPTY_PROGRESS);
    assert.equal(parseProgress('{"streak":-3,"stars":{}}').streak, 0);
  });
});
