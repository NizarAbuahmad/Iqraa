/**
 * What this guards: progress is stored per person on a shared device, so the key
 * must carry the user id; a corrupt or hand-edited blob must degrade to "no
 * progress" instead of crashing the screen; and rating an ayah must not mutate
 * state that React is holding.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  QURAN_PROGRESS_KEY,
  countMemorised,
  parseProgress,
  quranProgressKey,
  rateAyah,
  stateOf,
  todayKey,
  type QuranProgress,
} from '../quranProgress.ts';

describe('quranProgressKey', () => {
  it('scopes the key to the user, and falls back to the bare key when signed out', () => {
    assert.equal(quranProgressKey('u-1'), `${QURAN_PROGRESS_KEY}:u-1`);
    assert.equal(quranProgressKey(null), QURAN_PROGRESS_KEY);
    assert.equal(quranProgressKey(undefined), QURAN_PROGRESS_KEY);
    assert.notEqual(quranProgressKey('u-1'), quranProgressKey('u-2'));
  });
});

describe('todayKey', () => {
  it('is the local date, zero-padded', () => {
    assert.equal(todayKey(new Date(2026, 0, 5, 1, 30)), '2026-01-05');
    assert.equal(todayKey(new Date(2026, 9, 11, 23, 59)), '2026-10-11');
  });
});

describe('rateAyah', () => {
  it('records a rating with the date, and leaves the input alone', () => {
    const before: QuranProgress = {};
    const after = rateAyah(before, 112, 1, 'memorised', '2026-10-11');
    assert.deepEqual(after, { '112': { '1': { status: 'memorised', at: '2026-10-11' } } });
    assert.deepEqual(before, {});
  });

  it('changes a rating and keeps the other ayahs', () => {
    const p = rateAyah(rateAyah({}, 112, 1, 'learning', '2026-10-01'), 112, 2, 'memorised', '2026-10-02');
    const q = rateAyah(p, 112, 1, 'memorised', '2026-10-03');
    assert.equal(stateOf(q, 112, 1), 'memorised');
    assert.equal(stateOf(q, 112, 2), 'memorised');
    assert.equal(stateOf(p, 112, 1), 'learning', 'the earlier state is not mutated');
  });

  it('clears a rating, and removes a surah once it has none', () => {
    const p = rateAyah({}, 112, 1, 'learning', '2026-10-01');
    assert.deepEqual(rateAyah(p, 112, 1, null, '2026-10-02'), {});
    assert.deepEqual(rateAyah({}, 112, 1, null, '2026-10-02'), {});
  });
});

describe('stateOf and countMemorised', () => {
  const p = rateAyah(rateAyah(rateAyah({}, 96, 1, 'memorised', 'd'), 96, 2, 'learning', 'd'), 96, 3, 'memorised', 'd');

  it('reads "new" for an ayah with no mark', () => {
    assert.equal(stateOf(p, 96, 9), 'new');
    assert.equal(stateOf(p, 1, 1), 'new');
  });

  it('counts only «memorised» among the ayahs asked about', () => {
    assert.equal(countMemorised(p, 96, [1, 2, 3, 4]), 2);
    assert.equal(countMemorised(p, 96, [2, 4]), 0);
    assert.equal(countMemorised(p, 97, [1]), 0);
  });
});

describe('parseProgress', () => {
  it('round-trips what rateAyah wrote', () => {
    const p = rateAyah({}, 96, 1, 'memorised', '2026-10-11');
    assert.deepEqual(parseProgress(JSON.stringify(p)), p);
  });

  it('returns no progress for a missing, unparseable or non-object blob', () => {
    for (const raw of [null, undefined, '', '{not json', '[]', '"x"', '5', 'null']) {
      assert.deepEqual(parseProgress(raw), {}, String(raw));
    }
  });

  it('keeps the good marks and drops the malformed ones', () => {
    const raw = JSON.stringify({
      '96': {
        '1': { status: 'memorised', at: '2026-10-11' },
        '2': { status: 'perfect', at: '2026-10-11' },
        '3': { status: 'learning' },
        x: { status: 'learning', at: 'd' },
      },
      abc: { '1': { status: 'learning', at: 'd' } },
      '97': 'nope',
    });
    assert.deepEqual(parseProgress(raw), { '96': { '1': { status: 'memorised', at: '2026-10-11' } } });
  });
});
