/**
 * What this guards: the Quran Corner's scope is whatever the lesson titles say,
 * so reading a title wrongly shows a student the wrong ayahs, and skipping one
 * silently leaves a lesson's text out. Run against the real titles, not only
 * hand-picked ones.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

import { parseSurahTitle } from '../quranTitles.ts';
import { normalizeArabic } from '../arabic.ts';

describe('parseSurahTitle', () => {
  it('reads a ranged title', () => {
    assert.deepEqual(parseSurahTitle('سورة البقرة: الآيتان الكريمتان (143-144)'), {
      nameAr: 'البقرة',
      key: 'البقره',
      from: 143,
      to: 144,
    });
  });

  it('reads the book\'s own marks and drops only the trailing case mark', () => {
    const r = parseSurahTitle('سورَةُ الْعَلَقِ، الآياتُ الْكَريمَةُ (1-8)');
    assert.equal(r?.nameAr, 'الْعَلَق');
    assert.equal(r?.key, 'العلق');
    assert.deepEqual([r?.from, r?.to], [1, 8]);
  });

  it('reads a title with no range as the whole surah', () => {
    const r = parseSurahTitle('سورة الغاشية');
    assert.equal(r?.nameAr, 'الغاشية');
    assert.deepEqual([r?.from, r?.to], [null, null]);
  });

  it('reads a single ayah', () => {
    const r = parseSurahTitle('سورَةُ المُزَّمِّلِ: الآيَةُ الكَريمَةُ (20)');
    assert.deepEqual([r?.key, r?.from, r?.to], ['المزمل', 20, 20]);
  });

  it('reads a surah named inside a longer lesson title', () => {
    const r = parseSurahTitle('التِّلاوَةُ وَالتَّجْويدُ: سورَةُ الواقِعَةِ، الآياتُ الكَريمَةُ (1-26)');
    assert.deepEqual([r?.key, r?.from, r?.to], ['الواقعه', 1, 26]);
  });

  it('reads a title with no comma or colon before «الآيات»', () => {
    const r = parseSurahTitle('سورةُ الإسراءِ الآياتُ (1-8)');
    assert.deepEqual([r?.nameAr, r?.from, r?.to], ['الإسراء', 1, 8]);
  });

  it('keeps a two-word name together', () => {
    assert.equal(parseSurahTitle('سورة آل عمران: الآيات الكريمة (189-195)')?.key, 'ال عمران');
  });

  it('returns null for a lesson about surahs in general', () => {
    assert.equal(parseSurahTitle('السّورُ المكيّةُ والسّورُ المدنيّةُ'), null);
    assert.equal(parseSurahTitle('القُرْآنُ الكَريمُ'), null);
  });

  it('throws on a title that says «سورة» and cannot be read', () => {
    assert.throws(() => parseSurahTitle('سورة'), /cannot read/);
    assert.throws(() => parseSurahTitle('سورة النمل (9-3)'), /bad ayah range/);
  });
});

describe('every Islamic Education lesson title', () => {
  const dir = new URL('../data/', import.meta.url);
  const files = readdirSync(dir).filter(f => /^iqra_curriculum_g\d+_islamic_sem\d\.json$/.test(f)).sort();
  const titles: string[] = [];
  for (const f of files) {
    const cat = JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as {
      units: Array<{ lessons: Array<{ title_ar: string }> }>;
    };
    for (const u of cat.units) for (const l of u.lessons) titles.push(l.title_ar);
  }

  it('covers all 20 books, grades 1–10 in two semesters', () => {
    assert.equal(files.length, 20);
  });

  it('reads every title that says «سورة», and only those', () => {
    for (const title of titles) {
      const says = /(^|[\s:،,])سوره(\s|$)/.test(normalizeArabic(title));
      assert.equal(parseSurahTitle(title) !== null, says, title);
    }
  });

  // Pinned on purpose: a new book or a retitled lesson changes these numbers, and
  // the corner's scope should be re-read by a person when it does.
  it('names 77 surah lessons across 40 surahs', () => {
    const parsed = titles.map(parseSurahTitle).filter((r): r is NonNullable<typeof r> => r !== null);
    assert.equal(parsed.length, 77);
    assert.equal(new Set(parsed.map(r => r.key)).size, 40);
  });

  it('never returns a name with a leading mark or stray space', () => {
    for (const title of titles) {
      const r = parseSurahTitle(title);
      if (r) assert.match(r.nameAr, /^[^ً-ْٰـ\s]/, title);
      if (r) assert.equal(r.nameAr, r.nameAr.trim(), title);
    }
  });
});
