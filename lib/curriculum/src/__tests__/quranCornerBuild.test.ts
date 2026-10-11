/**
 * The corner builder, on a synthetic source. The "ayahs" here are placeholders
 * (`x<surah>.<ayah>`) built from the surah table's own counts, so this file
 * contains no Quranic text and can run before the real snapshot is in the repo.
 * What it guards: scope comes from the lesson titles, ranges merge when they
 * touch, every kept ayah is copied unchanged, and the build refuses (rather than
 * guesses) when a name, a count or a range does not fit the source.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SURAHS,
  assertFullHafs,
  buildCorner,
  mergeRanges,
  parseTanzilTxt,
  reviewSheet,
  type BuildInput,
  type CatalogInput,
} from '../../scripts/quranCornerBuild.ts';

const NOTICE = '# Tanzil Quran Text (placeholder notice)\n# Licence: placeholder';

/** A Tanzil-shaped file for the 40 surahs in the table, with placeholder text. */
function fakeSource(overrides: Record<string, number> = {}): string {
  const lines: string[] = [];
  const surahs = Object.values(SURAHS).sort((a, b) => a.number - b.number);
  for (const s of surahs) {
    const count = overrides[String(s.number)] ?? s.ayahCount;
    for (let a = 1; a <= count; a++) lines.push(`${s.number}|${a}|x${s.number}.${a}`);
  }
  return `${lines.join('\n')}\n${NOTICE}\n`;
}

const lessons = (...titles: string[]): CatalogInput['units'] => [
  { lessons: titles.map((title_ar, i) => ({ id: `u1_l${i + 1}`, title_ar })) },
];

function input(catalogs: CatalogInput[], source = fakeSource()): BuildInput {
  return { source, sourceMeta: { retrievedOn: '2026-10-11', notes: 'test' }, catalogs };
}

describe('SURAHS', () => {
  it('has 40 surahs with distinct, ascending-valid numbers', () => {
    const numbers = Object.values(SURAHS).map(s => s.number);
    assert.equal(numbers.length, 40);
    assert.equal(new Set(numbers).size, 40);
    assert.ok(numbers.every(n => n >= 1 && n <= 114));
  });
});

describe('parseTanzilTxt', () => {
  it('reads sura|aya|text lines and collects # lines as the notice', () => {
    const r = parseTanzilTxt('1|1|a b\n1|2|c\n2|1|d\n# note one\n# note two\n');
    assert.deepEqual(r.ayahs, [
      { surah: 1, ayah: 1, text: 'a b' },
      { surah: 1, ayah: 2, text: 'c' },
      { surah: 2, ayah: 1, text: 'd' },
    ]);
    assert.equal(r.notice, 'note one\nnote two');
  });

  it('does not touch the text: spaces inside it are kept', () => {
    assert.equal(parseTanzilTxt('1|1|a  b \n').ayahs[0]!.text, 'a  b ');
  });

  it('refuses a line it cannot read and numbering that is out of order', () => {
    assert.throws(() => parseTanzilTxt('1|1|a\nnot a line\n'), /unreadable/);
    assert.throws(() => parseTanzilTxt('1|1|a\n1|3|b\n'), /out of order/);
    assert.throws(() => parseTanzilTxt('1|1|a\n3|1|b\n2|1|c\n'), /out of order/);
    assert.throws(() => parseTanzilTxt('2|2|a\n'), /out of order/);
  });
});

describe('assertFullHafs', () => {
  it('refuses a source that is not the full 6,236-ayah text', () => {
    assert.throws(() => assertFullHafs(parseTanzilTxt(fakeSource()).ayahs), /expected 6236/);
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

  it('carries the notice and a hash of the source', () => {
    const corner = buildCorner(input([g3]));
    assert.match(corner.notice, /Tanzil Quran Text/);
    assert.match(corner.source.sha256, /^[0-9a-f]{64}$/);
    assert.equal(corner.source.licenseName, 'CC BY 3.0');
  });

  it('refuses when the source carries no licence notice', () => {
    const bare = fakeSource().split('\n').filter(l => !l.startsWith('#')).join('\n');
    assert.throws(() => buildCorner(input([g3], bare)), /no licence notice/);
  });

  it('refuses a surah it has no number for, instead of guessing', () => {
    const odd: CatalogInput = { gradeId: 'grade-3', semester: 1, units: lessons('سورة النمل') };
    assert.throws(() => buildCorner(input([odd])), /no surah number/);
  });

  it('refuses when the table\'s ayah count differs from the source', () => {
    assert.throws(() => buildCorner(input([g3], fakeSource({ '96': 20 }))), /table says 19 ayahs, the source has 20/);
  });

  it('refuses a range that runs past the end of the surah', () => {
    const bad: CatalogInput = { gradeId: 'grade-3', semester: 1, units: lessons('سورة العلق: الآيات (9-25)') };
    assert.throws(() => buildCorner(input([bad])), /names ayah 25/);
  });

  it('orders surahs by the first grade that assigns them, then surah number', () => {
    const g1: CatalogInput = { gradeId: 'grade-1', semester: 1, units: lessons('سورة الناس', 'سورة العصر') };
    assert.deepEqual(buildCorner(input([g10, g1, g3])).surahs.map(s => s.number), [103, 114, 96, 97, 2]);
  });
});

describe('reviewSheet', () => {
  it('prints each surah with its first assigned ayah', () => {
    const sheet = reviewSheet(
      buildCorner(input([{ gradeId: 'grade-1', semester: 1, units: lessons('سورة العصر') }])),
    );
    assert.match(sheet, /\| 103 \| العصر \| 3 \| 1–3 \| 1 \| 1: x103\.1 \|/);
  });
});
