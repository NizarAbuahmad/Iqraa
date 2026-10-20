import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { QURAN_SURAHS } from '../quran.ts';
import {
  QURAN_AUDIO_ORIGIN,
  QURAN_AUDIO_PREFIX,
  quranAudioAyahs,
  quranAudioFile,
  quranAudioKey,
  quranAyahAudioUrl,
} from '../quranAudio.ts';

describe('quranAudioKey', () => {
  it('pads surah and ayah to three digits', () => {
    assert.equal(quranAudioFile(1, 1), '001001.mp3');
    assert.equal(quranAudioFile(2, 255), '002255.mp3');
    assert.equal(quranAudioFile(114, 6), '114006.mp3');
    assert.equal(quranAudioKey(1, 1), 'quran-audio/husary/001001.mp3');
    assert.equal(quranAudioKey(2, 255), 'quran-audio/husary/002255.mp3');
    assert.equal(quranAudioKey(114, 6), 'quran-audio/husary/114006.mp3');
  });

  it('builds the public URL from the origin and the key', () => {
    assert.equal(quranAyahAudioUrl(112, 1), `${QURAN_AUDIO_ORIGIN}/${QURAN_AUDIO_PREFIX}/112001.mp3`);
    assert.ok(QURAN_AUDIO_ORIGIN.startsWith('https://'));
    assert.ok(!QURAN_AUDIO_ORIGIN.endsWith('/'));
  });

  it('throws on a reference that cannot exist, so a bad call is a test failure and not a 404', () => {
    for (const [s, a] of [
      [0, 1], [115, 1], [-1, 1], [1.5, 1], [1, 0], [1, -1], [1, 287], [1, 2.5], [NaN, 1], [1, NaN],
    ] as const) {
      assert.throws(() => quranAudioKey(s, a), RangeError, `${s}:${a}`);
    }
  });
});

describe('quranAudioAyahs', () => {
  const list = quranAudioAyahs();

  it('is exactly the 585 ayahs the corner holds, in the corner’s order', () => {
    assert.equal(list.length, 585);
    const expected = QURAN_SURAHS.flatMap(s => s.ayahs.map(a => ({ surah: s.number, ayah: a.n })));
    assert.deepEqual(list, expected);
  });

  it('gives every ayah a well-formed, unique key', () => {
    const keys = list.map(a => quranAudioKey(a.surah, a.ayah));
    for (const k of keys) assert.match(k, /^quran-audio\/husary\/\d{6}\.mp3$/);
    assert.equal(new Set(keys).size, keys.length);
  });
});
