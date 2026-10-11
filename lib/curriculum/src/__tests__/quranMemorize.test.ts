/**
 * What this guards: a hidden word is a word the learner has to recall, so
 * hiding must never change, drop or reorder the text underneath, and a waqf or
 * ayah-end sign must never become a "word" of its own. The words below are
 * placeholders on purpose: this file contains no Quranic text.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { HIDE_LEVELS, hiddenFlags, tokenizeAyah } from '../quranMemorize.ts';

const SAMPLE = 'ألف باء ۖ جيم دال ۝ هاء';

describe('tokenizeAyah', () => {
  it('splits on spaces', () => {
    assert.deepEqual(tokenizeAyah('ألف باء جيم'), ['ألف', 'باء', 'جيم']);
  });

  it('glues a mark-only token to the word before it', () => {
    assert.deepEqual(tokenizeAyah(SAMPLE), ['ألف', 'باء ۖ', 'جيم', 'دال ۝', 'هاء']);
  });

  it('round-trips: joining the words gives the text back', () => {
    assert.equal(tokenizeAyah(SAMPLE).join(' '), SAMPLE);
  });

  it('keeps a leading mark rather than dropping it', () => {
    assert.deepEqual(tokenizeAyah('ۖ ألف'), ['ۖ', 'ألف']);
  });

  it('returns no words for an empty string', () => {
    assert.deepEqual(tokenizeAyah(''), []);
  });
});

describe('hiddenFlags', () => {
  const bits = (n: number, level: Parameters<typeof hiddenFlags>[1]) =>
    hiddenFlags(n, level).map(Number).join('');

  it('hides nothing at "none" and everything at "all"', () => {
    assert.equal(bits(5, 'none'), '00000');
    assert.equal(bits(5, 'all'), '11111');
  });

  it('hides every third word, then every second word', () => {
    assert.equal(bits(7, 'every3'), '0010010');
    assert.equal(bits(5, 'every2'), '01010');
  });

  it('hides the second half, rounding the shown half down', () => {
    assert.equal(bits(4, 'secondHalf'), '0011');
    assert.equal(bits(5, 'secondHalf'), '00111');
    assert.equal(bits(1, 'secondHalf'), '1');
  });

  it('shows only the first word as a hint', () => {
    assert.equal(bits(4, 'firstWordHint'), '0111');
  });

  it('is deterministic and sized to the word count at every level', () => {
    for (const level of HIDE_LEVELS) {
      assert.deepEqual(hiddenFlags(6, level), hiddenFlags(6, level));
      assert.equal(hiddenFlags(6, level).length, 6);
      assert.deepEqual(hiddenFlags(0, level), []);
    }
  });
});
