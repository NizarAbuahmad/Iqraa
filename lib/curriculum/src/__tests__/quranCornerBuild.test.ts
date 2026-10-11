/**
 * The corner builder, on a placeholder source. The "ayahs" here are
 * `x<surah>.<ayah>` and the surah names are built from the surah table's own
 * keys, so this file contains no Quranic text and runs without the real package.
 * What it guards: scope comes from the lesson titles, ranges merge when they
 * touch, every kept ayah is copied unchanged, and the build REFUSES (rather than
 * guesses) when a name, a count or a range does not fit the source.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SURAHS,
  assertFullHafs,
  buildCorner,
  creditLine,
  mergeRanges,
  reviewSheet,
  surahKey,
  type BuildInput,
  type BuildSource,
  type CatalogInput,
} from '../../scripts/quranCornerBuild.ts';
import type { QuranSource } from '../quranTypes.ts';

const INFO: QuranSource = {
  name: 'test dataset',
  version: '@test/pkg 1.0.0',
  url: 'https://example.test/data',
  publisher: 'Test Publisher',
  licenseName: 'TEST-LICENSE',
  licenseUrl: 'https://example.test/license',
  sha256: '0'.repeat(64),
  font: { family: 'Test Font', file: 'test.ttf', sha256: '1'.repeat(64) },
};

/** A source for the 40 surahs in the table, from the table's own numbers and counts. Overrides break one fact. */
function fakeSource(opts: { counts?: Record<number, number>; names?: Record<number, string>; drop?: number } = {}): BuildSource {
  const surahs: BuildSource['surahs'] = [];
  const ayahs: BuildSource['ayahs'] = [];
  for (const [key, s] of Object.entries(SURAHS).sort((a, b) => a[1].number - b[1].number)) {
    if (s.number === opts.drop) continue;
    const count = opts.counts?.[s.number] ?? s.ayahCount;
    surahs.push({ number: s.number, nameAr: opts.names?.[s.number] ?? `سورة ${key}`, ayahCount: count });
    for (let a = 1; a <= count; a++) ayahs.push({ surah: s.number, ayah: a, text: `x${s.number}.${a}` });
  }
  return { ayahs, surahs, info: INFO };
}

/** A complete-looking source: 114 surahs of 55 ayahs, the last of 21, which is 6,236 in all. */
function fullShapeSource(): BuildSource {
  const surahs: BuildSource['surahs'] = [];
  const ayahs: BuildSource['ayahs'] = [];
  for (let n = 1; n <= 114; n++) {
    const count = n === 114 ? 21 : 55;
    surahs.push({ number: n, nameAr: `سورة ${n}`, ayahCount: count });
    for (let a = 1; a <= count; a++) ayahs.push({ surah: n, ayah: a, text: `x${n}.${a}` });
  }
  return { ayahs, surahs, info: INFO };
}

const lessons = (...titles: string[]): CatalogInput['units'] => [
  { lessons: titles.map((title_ar, i) => ({ id: `u1_l${i + 1}`, title_ar })) },
];

function input(catalogs: CatalogInput[], source = fakeSource()): BuildInput {
  return { source, catalogs };
}

describe('SURAHS', () => {
  it('has 40 surahs with distinct numbers between 1 and 114', () => {
    const numbers = Object.values(SURAHS).map(s => s.number);
    assert.equal(numbers.length, 40);
    assert.equal(new Set(numbers).size, 40);
    assert.ok(numbers.every(n => n >= 1 && n <= 114));
  });
});

describe('surahKey', () => {
  it('folds the source\'s name and drops «سورة», so it equals the key a lesson title folds to', () => {
    assert.equal(surahKey('سورَةُ الإِخْلاصِ'), 'الاخلاص');
    assert.equal(surahKey('سورة آل عمران'), 'ال عمران');
    assert.equal(surahKey('الفاتحة'), 'الفاتحه');
  });
});

describe('assertFullHafs', () => {
  it('accepts 114 surahs and 6,236 ayahs', () => {
    assert.doesNotThrow(() => assertFullHafs(fullShapeSource()));
  });

  it('refuses a source that is not the complete Hafs text', () => {
    assert.throws(() => assertFullHafs(fakeSource()), /expected 114/);
    const short = fullShapeSource();
    short.ayahs.pop();
    assert.throws(() => assertFullHafs(short), /6235 ayahs, expected 6236/);
    const odd = fullShapeSource();
    odd.surahs[0]!.ayahCount += 1;
    assert.throws(() => assertFullHafs(odd), /adds up to 6237/);
  });
});

describe('mergeRanges', () => {
  it('merges overlapping and touching ranges, and keeps gaps', () => {
    assert.deepEqual(mergeRanges([[5, 7], [1, 4]]), [{ from: 1, to: 7 }]);
    assert.deepEqual(mergeRanges([[1, 4], [6, 7]]), [{ from: 1, to: 4 }, { from: 6, to: 7 }]);
    assert.deepEqual(mergeRanges([[1, 10], [3, 4]]), [{ from: 1, to: 10 }]);
    assert.deepEqual(mergeRanges([[20, 20]]), [{ from: 20, to: 20 }]);
    assert.deepEqual(mergeRanges([]), []);
  });
});

describe('buildCorner', () => {
  const g3: CatalogInput = {
    gradeId: 'grade-3',
    semester: 1,
    units: lessons(
      'سورَةُ الْعَلَقِ، الآياتُ الْكَريمَةُ (1-8)',
      'سورَةُ الْعَلَقِ، الآياتُ الْكَريمَةُ (9-19)',
      'سورَةُ الْقَدْرِ',
      'القُرْآنُ الكَريمُ',
    ),
  };
  const g10: CatalogInput = {
    gradeId: 'grade-10',
    semester: 1,
    units: lessons('سورة البقرة: الآيتان الكريمتان (143-144)', 'سورة البقرة: الآيات الكريمة (183-186)'),
  };

  it('takes scope from titles: whole surahs, merged ranges, and nothing else', () => {
    const corner = buildCorner(input([g3, g10]));
    assert.deepEqual(corner.surahs.map(s => s.number), [96, 97, 2]);
    const alaq = corner.surahs[0]!;
    assert.deepEqual(alaq.segments, [{ from: 1, to: 19 }]);
    assert.equal(alaq.ayahs.length, 19);
    assert.equal(corner.surahs[1]!.ayahs.length, 5);
    const baqarah = corner.surahs[2]!;
    assert.deepEqual(baqarah.segments, [{ from: 143, to: 144 }, { from: 183, to: 186 }]);
    assert.deepEqual(baqarah.ayahs.map(a => a.n), [143, 144, 183, 184, 185, 186]);
  });

  it('copies every kept ayah unchanged', () => {
    const baqarah = buildCorner(input([g10])).surahs[0]!;
    assert.deepEqual(baqarah.ayahs[0], { n: 143, text: 'x2.143' });
  });

  it('records each lesson by kbl id, grade and semester', () => {
    const alaq = buildCorner(input([g3])).surahs[0]!;
    assert.deepEqual(alaq.lessons, [
      { lessonId: 'kbl-g3-islamic-s1-nccd-u1_l1', gradeId: 'grade-3', semester: 1, from: 1, to: 8 },
      { lessonId: 'kbl-g3-islamic-s1-nccd-u1_l2', gradeId: 'grade-3', semester: 1, from: 9, to: 19 },
    ]);
    const baqarah = buildCorner(input([g10])).surahs[0]!;
    assert.equal(baqarah.lessons[0]!.lessonId, 'kbl-islamic-s1-nccd-u1_l1', 'grade 10 keeps the historical id form');
  });

  it('carries the source facts and a credit line written from them', () => {
    const corner = buildCorner(input([g3]));
    assert.deepEqual(corner.source, INFO);
    assert.equal(corner.notice, creditLine(INFO));
  });

  it('refuses a surah it has no number for, instead of guessing', () => {
    const odd: CatalogInput = { gradeId: 'grade-3', semester: 1, units: lessons('سورة النمل') };
    assert.throws(() => buildCorner(input([odd])), /no surah number/);
  });

  it('refuses when the source has no such surah', () => {
    assert.throws(() => buildCorner(input([g3], fakeSource({ drop: 96 }))), /the source has no surah 96/);
  });

  it('refuses when the source names the surah differently: two surahs swapped in the table', () => {
    const swapped = fakeSource({ names: { 96: 'سورة القدر' } });
    assert.throws(() => buildCorner(input([g3], swapped)), /the table calls it "العلق" but the source calls it "القدر"/);
  });

  it('refuses when the table\'s ayah count differs from the source', () => {
    assert.throws(
      () => buildCorner(input([g3], fakeSource({ counts: { 96: 20 } }))),
      /the table says 19 ayahs, the source says 20/,
    );
  });

  it('refuses a range that runs past the end of the surah', () => {
    const bad: CatalogInput = { gradeId: 'grade-3', semester: 1, units: lessons('سورة العلق: الآيات (9-25)') };
    assert.throws(() => buildCorner(input([bad])), /names ayah 25/);
  });

  it('refuses when an ayah inside a range is missing from the source', () => {
    const src = fakeSource();
    src.ayahs = src.ayahs.filter(a => !(a.surah === 96 && a.ayah === 5));
    assert.throws(() => buildCorner(input([g3], src)), /the source has no 96:5/);
  });

  it('orders surahs by the first grade that assigns them, then surah number', () => {
    const g1: CatalogInput = { gradeId: 'grade-1', semester: 1, units: lessons('سورة الناس', 'سورة العصر') };
    assert.deepEqual(buildCorner(input([g10, g1, g3])).surahs.map(s => s.number), [103, 114, 96, 97, 2]);
  });
});

describe('creditLine', () => {
  it('names the publisher, the dataset, its version and licence, and says the text was modified', () => {
    const line = creditLine(INFO);
    assert.match(line, /Test Publisher/);
    assert.match(line, /test dataset, @test\/pkg 1\.0\.0 — https:\/\/example\.test\/data — TEST-LICENSE/);
    assert.match(line, /Modified: yes/);
  });
});

describe('reviewSheet', () => {
  it('lists EVERY shipped ayah for checking against a printed mushaf', () => {
    const corner = buildCorner(input([{ gradeId: 'grade-3', semester: 1, units: lessons('سورة العلق') }]));
    const sheet = reviewSheet(corner);
    for (let a = 1; a <= 19; a++) assert.match(sheet, new RegExp(`^96:${a} {2}x96\\.${a}$`, 'm'));
    assert.match(sheet, /authorised printed Mus'haf al-Madinah/);
    assert.match(sheet, /Test Publisher/);
  });
});
