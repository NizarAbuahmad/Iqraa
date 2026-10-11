/**
 * Builds `src/data/quran_corner.json` from a pinned Tanzil snapshot and the 20
 * Islamic Education catalogs. Pure functions plus one loader, shared by the CLI
 * (`build-quran-corner.ts`) and the test that proves the committed file is what
 * these inputs produce.
 *
 * No Quranic text is written here. Every ayah is copied from the snapshot
 * unchanged; the only hand-typed data is `SURAHS`, which holds surah numbers
 * and ayah COUNTS — metadata, checked against the snapshot below.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { lessonKbId } from '../src/curriculumIds.ts';
import { parseSurahTitle } from '../src/quranTitles.ts';
import type {
  QuranAyah,
  QuranCornerFile,
  QuranLessonRef,
  QuranSegment,
  QuranSurah,
} from '../src/quranTypes.ts';

/**
 * The 40 surahs the books name: folded name (as `parseSurahTitle` returns it)
 * → surah number and ayah count.
 *
 * Typed by hand. It is NOT Quranic text, but a wrong number would show a
 * student the wrong surah under a right name, so two checks guard it: the
 * build fails if a count differs from the snapshot's, and the generated
 * `REVIEW.md` prints each surah's first assigned ayah beside its name for a
 * person who reads Arabic to confirm. The count check cannot catch two surahs
 * of equal length swapped (several have 5 or 8 ayahs); the review sheet does.
 */
export const SURAHS: Record<string, { number: number; ayahCount: number }> = {
  'الفاتحه': { number: 1, ayahCount: 7 },
  'البقره': { number: 2, ayahCount: 286 },
  'ال عمران': { number: 3, ayahCount: 200 },
  'النساء': { number: 4, ayahCount: 176 },
  'الانفال': { number: 8, ayahCount: 75 },
  'الاسراء': { number: 17, ayahCount: 111 },
  'الكهف': { number: 18, ayahCount: 110 },
  'لقمان': { number: 31, ayahCount: 34 },
  'الحجرات': { number: 49, ayahCount: 18 },
  'الواقعه': { number: 56, ayahCount: 96 },
  'الجمعه': { number: 62, ayahCount: 11 },
  'الملك': { number: 67, ayahCount: 30 },
  'القلم': { number: 68, ayahCount: 52 },
  'المعارج': { number: 70, ayahCount: 44 },
  'نوح': { number: 71, ayahCount: 28 },
  'المزمل': { number: 73, ayahCount: 20 },
  'النبا': { number: 78, ayahCount: 40 },
  'الطارق': { number: 86, ayahCount: 17 },
  'الاعلي': { number: 87, ayahCount: 19 },
  'الغاشيه': { number: 88, ayahCount: 26 },
  'البلد': { number: 90, ayahCount: 20 },
  'الشمس': { number: 91, ayahCount: 15 },
  'الليل': { number: 92, ayahCount: 21 },
  'الضحي': { number: 93, ayahCount: 11 },
  'الشرح': { number: 94, ayahCount: 8 },
  'التين': { number: 95, ayahCount: 8 },
  'العلق': { number: 96, ayahCount: 19 },
  'القدر': { number: 97, ayahCount: 5 },
  'الزلزله': { number: 99, ayahCount: 8 },
  'العصر': { number: 103, ayahCount: 3 },
  'الهمزه': { number: 104, ayahCount: 9 },
  'الفيل': { number: 105, ayahCount: 5 },
  'قريش': { number: 106, ayahCount: 4 },
  'الماعون': { number: 107, ayahCount: 7 },
  'الكوثر': { number: 108, ayahCount: 3 },
  'النصر': { number: 110, ayahCount: 3 },
  'المسد': { number: 111, ayahCount: 5 },
  'الاخلاص': { number: 112, ayahCount: 4 },
  'الفلق': { number: 113, ayahCount: 5 },
  'الناس': { number: 114, ayahCount: 6 },
};

export interface SourceAyah {
  surah: number;
  ayah: number;
  text: string;
}

/**
 * Reads Tanzil's `sura|aya|text` file. Structure only: lines must be numbered
 * in order, and `#` lines are collected as the licence notice. Nothing is
 * trimmed or rewritten in the text.
 */
export function parseTanzilTxt(txt: string): { ayahs: SourceAyah[]; notice: string } {
  const ayahs: SourceAyah[] = [];
  const notice: string[] = [];
  let lastSurah = 0;
  let lastAyah = 0;
  for (const raw of txt.replace(/^﻿/, '').split(/\r?\n/)) {
    if (raw.startsWith('#')) {
      notice.push(raw.replace(/^#\s?/, ''));
      continue;
    }
    if (raw.trim() === '') continue;
    const m = /^(\d+)\|(\d+)\|(.+)$/.exec(raw);
    if (!m) throw new Error(`unreadable line in the source: ${raw.slice(0, 40)}`);
    const surah = Number(m[1]);
    const ayah = Number(m[2]);
    const inOrder = surah === lastSurah ? ayah === lastAyah + 1 : surah > lastSurah && ayah === 1;
    if (!inOrder) throw new Error(`source out of order at ${surah}:${ayah}`);
    ayahs.push({ surah, ayah, text: m[3]! });
    lastSurah = surah;
    lastAyah = ayah;
  }
  return { ayahs, notice: notice.join('\n').trim() };
}

/** Hafs numbering has 114 surahs and 6,236 ayahs. Any other total is a different text. */
export function assertFullHafs(ayahs: readonly SourceAyah[]): void {
  if (ayahs.length !== 6236) throw new Error(`the source has ${ayahs.length} ayahs, expected 6236 (Hafs)`);
  if (ayahs[ayahs.length - 1]!.surah !== 114) throw new Error('the source does not end at surah 114');
}

/** Merges overlapping and touching ranges: 1–4 and 5–7 are one run, 1–4 and 6–7 are two. */
export function mergeRanges(ranges: ReadonlyArray<readonly [number, number]>): QuranSegment[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: QuranSegment[] = [];
  for (const [from, to] of sorted) {
    const last = out[out.length - 1];
    if (last && from <= last.to + 1) last.to = Math.max(last.to, to);
    else out.push({ from, to });
  }
  return out;
}

export interface CatalogInput {
  gradeId: string;
  semester: 1 | 2;
  units: Array<{ lessons: Array<{ id: string; title_ar: string }> }>;
}

export interface BuildInput {
  /** The snapshot file, as read (UTF-8). */
  source: string;
  sourceMeta: { retrievedOn: string; notes: string };
  catalogs: CatalogInput[];
}

const gradeNumber = (gradeId: string): number => Number(gradeId.replace('grade-', ''));

export function buildCorner(input: BuildInput): QuranCornerFile {
  const { ayahs, notice } = parseTanzilTxt(input.source);
  if (!notice) throw new Error('the source carries no licence notice; refusing to build without one');

  const textOf = new Map(ayahs.map(a => [`${a.surah}:${a.ayah}`, a.text]));
  const countOf = new Map<number, number>();
  for (const a of ayahs) countOf.set(a.surah, Math.max(countOf.get(a.surah) ?? 0, a.ayah));

  const found = new Map<
    string,
    { number: number; ayahCount: number; nameAr: string; ranges: Array<[number, number]>; lessons: QuranLessonRef[] }
  >();

  for (const cat of input.catalogs) {
    for (const unit of cat.units) {
      for (const lesson of unit.lessons) {
        const title = parseSurahTitle(lesson.title_ar);
        if (!title) continue;
        const meta = SURAHS[title.key];
        if (!meta) {
          throw new Error(`no surah number for "${title.nameAr}" (${title.key}), in ${cat.gradeId} s${cat.semester} ${lesson.id}`);
        }
        const count = countOf.get(meta.number);
        if (count !== meta.ayahCount) {
          throw new Error(`surah ${meta.number} ("${title.nameAr}"): the table says ${meta.ayahCount} ayahs, the source has ${count}`);
        }
        const from = title.from ?? 1;
        const to = title.to ?? count;
        if (to > count) {
          throw new Error(`"${lesson.title_ar}" names ayah ${to}, but surah ${meta.number} has ${count}`);
        }
        let entry = found.get(title.key);
        if (!entry) {
          entry = { number: meta.number, ayahCount: count, nameAr: title.nameAr, ranges: [], lessons: [] };
          found.set(title.key, entry);
        }
        entry.ranges.push([from, to]);
        entry.lessons.push({
          lessonId: lessonKbId({ gradeId: cat.gradeId, subject: 'islamic', semester: cat.semester }, lesson.id),
          gradeId: cat.gradeId,
          semester: cat.semester,
          from,
          to,
        });
      }
    }
  }

  const surahs: QuranSurah[] = [...found.values()].map(e => {
    const segments = mergeRanges(e.ranges);
    const list: QuranAyah[] = [];
    for (const seg of segments) {
      for (let n = seg.from; n <= seg.to; n++) {
        const text = textOf.get(`${e.number}:${n}`);
        if (text === undefined) throw new Error(`the source has no ${e.number}:${n}`);
        list.push({ n, text });
      }
    }
    const lessons = [...e.lessons].sort(
      (a, b) => gradeNumber(a.gradeId) - gradeNumber(b.gradeId) || a.semester - b.semester,
    );
    return { number: e.number, nameAr: e.nameAr, ayahCount: e.ayahCount, segments, lessons, ayahs: list };
  });
  surahs.sort(
    (a, b) =>
      gradeNumber(a.lessons[0]!.gradeId) - gradeNumber(b.lessons[0]!.gradeId) || a.number - b.number,
  );

  return {
    source: {
      name: 'Tanzil',
      variant: 'quran-uthmani',
      url: 'https://tanzil.net',
      licenseName: 'CC BY 3.0',
      licenseUrl: 'https://tanzil.net/docs/text_license',
      retrievedOn: input.sourceMeta.retrievedOn,
      sha256: createHash('sha256').update(input.source).digest('hex'),
      notes: input.sourceMeta.notes,
    },
    notice,
    surahs,
  };
}

/** A sheet for a person who reads Arabic to confirm each surah's name against its first assigned ayah. */
export function reviewSheet(corner: QuranCornerFile): string {
  const rows = corner.surahs.map(s => {
    const segs = s.segments.map(g => (g.from === g.to ? `${g.from}` : `${g.from}–${g.to}`)).join('، ');
    const grades = [...new Set(s.lessons.map(l => gradeNumber(l.gradeId)))].join(', ');
    return `| ${s.number} | ${s.nameAr} | ${s.ayahCount} | ${segs} | ${grades} | ${s.ayahs[0]!.n}: ${s.ayahs[0]!.text} |`;
  });
  return [
    '# Quran Corner — review sheet',
    '',
    'Generated by `pnpm --filter @workspace/curriculum run build-quran-corner`. Do not edit by hand.',
    '',
    'For each row: does the **name** (as the book prints it) match the **first assigned ayah**,',
    'and do the **ayahs** match what the lesson assigns? Surah numbers and counts were typed by',
    'hand in `scripts/quranCornerBuild.ts`; this sheet is the check that catches two surahs of',
    'equal length being swapped.',
    '',
    '| # | Name (book) | Ayahs in surah | Assigned | Grades | First assigned ayah (source) |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

export interface LoadedPaths {
  snapshot: URL;
  meta: URL;
  catalogDir: URL;
}

const PATHS: LoadedPaths = {
  snapshot: new URL('../sources/tanzil/quran-uthmani.txt', import.meta.url),
  meta: new URL('../sources/tanzil/SOURCE.json', import.meta.url),
  catalogDir: new URL('../src/data/', import.meta.url),
};

/** Reads the snapshot, its `SOURCE.json` and the 20 Islamic catalogs, in grade order. */
export function loadBuildInput(paths: LoadedPaths = PATHS): BuildInput {
  const meta = JSON.parse(readFileSync(paths.meta, 'utf8')) as { retrievedOn: string; notes: string };
  const catalogs: CatalogInput[] = [];
  for (let grade = 1; grade <= 10; grade++) {
    for (const semester of [1, 2] as const) {
      const file = new URL(`iqra_curriculum_g${grade}_islamic_sem${semester}.json`, paths.catalogDir);
      const cat = JSON.parse(readFileSync(file, 'utf8')) as { units: CatalogInput['units'] };
      catalogs.push({ gradeId: `grade-${grade}`, semester, units: cat.units });
    }
  }
  return {
    source: readFileSync(paths.snapshot, 'utf8'),
    sourceMeta: { retrievedOn: meta.retrievedOn, notes: meta.notes },
    catalogs,
  };
}
