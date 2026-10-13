/**
 * The shipped Quran data. What this guards: every ayah in the app is the pinned
 * package's, unchanged; the data records the package version and file hash it
 * came from (so bumping the dependency forces a regeneration); the file is what
 * the build produces from the current catalogs (so retitling a lesson cannot
 * leave the corner stale); and the scope is the one a person reviewed.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { QURAN_CORNER, QURAN_SURAHS } from '../quran.ts';
import { SURAHS, assertFullHafs, buildCorner, surahKey } from '../../scripts/quranCornerBuild.ts';
import { loadBuildInput, quranWsDir } from '../../scripts/quranCornerSource.ts';
import { tokenizeAyah } from '../quranMemorize.ts';

const DATA = new URL('../data/quran_corner.json', import.meta.url);
const input = await loadBuildInput();
const textOf = new Map(input.source.ayahs.map(a => [`${a.surah}:${a.ayah}`, a.text]));
const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

describe('the pinned source', () => {
  it('is the complete Hafs text', () => {
    assertFullHafs(input.source);
  });

  it('is the package version and file the shipped data says it came from', () => {
    assert.equal(QURAN_CORNER.source.sha256, sha256(join(quranWsDir(), 'data', 'hafs.json')));
    assert.deepEqual(QURAN_CORNER.source, input.source.info);
  });

  it('carries a credit line that names the publisher and the dataset licence', () => {
    assert.match(QURAN_CORNER.notice, /King Fahd Glorious Qur'an Printing Complex/);
    assert.match(QURAN_CORNER.notice, /CC BY 4\.0/);
    assert.match(QURAN_CORNER.notice, /Modified: yes/);
  });

  it('agrees with the hand-typed surah table on all 40 surahs, by name and by count', () => {
    for (const [key, s] of Object.entries(SURAHS)) {
      const theirs = input.source.surahs.find(x => x.number === s.number)!;
      assert.equal(surahKey(theirs.nameAr), key, `surah ${s.number}`);
      assert.equal(theirs.ayahCount, s.ayahCount, `surah ${s.number}`);
    }
  });
});

describe('quran_corner.json', () => {
  it('is exactly what the build produces from the pinned package and the catalogs', () => {
    assert.equal(readFileSync(DATA, 'utf8'), JSON.stringify(buildCorner(input), null, 1) + '\n');
  });

  it('holds every ayah exactly as the source renders it', () => {
    let checked = 0;
    for (const s of QURAN_SURAHS) {
      for (const a of s.ayahs) {
        assert.equal(a.text, textOf.get(`${s.number}:${a.n}`), `${s.number}:${a.n}`);
        checked++;
      }
    }
    assert.equal(checked, 585);
  });

  // Pinned on purpose: a new book or a retitled lesson changes these numbers, and
  // the corner's scope (and VERIFY.md) should be re-read by a person when it does.
  it('names 40 surahs from 77 lesson assignments', () => {
    assert.equal(QURAN_SURAHS.length, 40);
    assert.equal(QURAN_SURAHS.reduce((n, s) => n + s.lessons.length, 0), 77);
  });

  it('keeps segments sorted and never touching, and the ayahs exactly cover them', () => {
    for (const s of QURAN_SURAHS) {
      s.segments.forEach((g, i) => {
        assert.ok(g.from >= 1 && g.to >= g.from && g.to <= s.ayahCount, `${s.number} segment ${i}`);
        if (i > 0) assert.ok(g.from > s.segments[i - 1]!.to + 1, `${s.number}: segments ${i - 1} and ${i} touch`);
      });
      const expected = s.segments.flatMap(g => Array.from({ length: g.to - g.from + 1 }, (_, k) => g.from + k));
      assert.deepEqual(s.ayahs.map(a => a.n), expected, `surah ${s.number}`);
      for (const l of s.lessons) {
        assert.ok(s.segments.some(g => l.from >= g.from && l.to <= g.to), `${l.lessonId} is outside the segments`);
      }
    }
  });

  it('has a printed name for every surah, with no stray space or leading mark', () => {
    for (const s of QURAN_SURAHS) {
      assert.ok(s.nameAr.length > 0 && s.nameAr === s.nameAr.trim(), String(s.number));
      assert.match(s.nameAr, /^[^ً-ْٰـ]/, String(s.number));
    }
  });

  it('records lesson ids that the real catalog builders emit, for all 20 books', async () => {
    let checked = 0;
    for (let grade = 1; grade <= 10; grade++) {
      for (const semester of [1, 2] as const) {
        const mod = (await import(`../catalogs/g${grade}IslamicSem${semester}.ts`)) as Record<
          string,
          () => { lessons: Array<{ id: string }> }
        >;
        // Grades 1–9 export buildG<N>IslamicSem<S>Catalog; grade 10 keeps the historical buildIslamicSem<S>Catalog.
        const build = mod[grade === 10 ? `buildIslamicSem${semester}Catalog` : `buildG${grade}IslamicSem${semester}Catalog`];
        assert.equal(typeof build, 'function', `no catalog builder for grade ${grade} semester ${semester}`);
        const ids = new Set(build!().lessons.map(l => l.id));
        const refs = QURAN_SURAHS.flatMap(s => s.lessons).filter(
          l => l.gradeId === `grade-${grade}` && l.semester === semester,
        );
        for (const r of refs) {
          assert.ok(ids.has(r.lessonId), `${r.lessonId} is not a lesson id the grade ${grade} semester ${semester} catalog builds`);
          checked++;
        }
      }
    }
    assert.equal(checked, 77);
  });

  it('splits every ayah into words that join back to it', () => {
    for (const s of QURAN_SURAHS) {
      for (const a of s.ayahs) assert.equal(tokenizeAyah(a.text).join(' '), a.text, `${s.number}:${a.n}`);
    }
  });
});
