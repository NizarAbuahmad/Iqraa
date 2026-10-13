/**
 * Builds `src/data/quran_corner.json` from a Quran source and the 20 Islamic
 * Education catalogs. Pure functions only: reading the source (the pinned npm
 * package) is `quranCornerSource.ts`, so everything here runs on a placeholder
 * source in tests. Shared by the CLI (`build-quran-corner.ts`) and the test that
 * proves the committed file is what these inputs produce.
 *
 * No Quranic text is written here. Every ayah is copied from the source
 * unchanged; the only hand-typed data is `SURAHS`, which holds surah names (as
 * folded keys), numbers and ayah COUNTS — metadata, and the build refuses to run
 * unless the source's own surah table agrees with it, name and count.
 */
import { normalizeArabic } from '../src/arabic.ts';
import { lessonKbId } from '../src/curriculumIds.ts';
import { parseSurahTitle } from '../src/quranTitles.ts';
import type {
  QuranAyah,
  QuranCornerFile,
  QuranLessonRef,
  QuranSegment,
  QuranSource,
  QuranSurah,
} from '../src/quranTypes.ts';

/**
 * The 40 surahs the books name: folded name (as `parseSurahTitle` returns it)
 * → surah number and ayah count.
 *
 * Typed by hand. It is NOT Quranic text, but a wrong number would show a
 * student the wrong surah under a right name, so the build checks every row
 * against the source's OWN surah table: the number must name the surah the key
 * names (`surahKey` of the source's Arabic name) and the ayah count must be the
 * same. That catches an equal-length swap, which a count check alone cannot.
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

/** The source's own table of surahs, used to check `SURAHS`. */
export interface SourceSurah {
  number: number;
  /** The name as the source writes it («سورة …»). */
  nameAr: string;
  ayahCount: number;
}

/** What the build reads: the ayahs, the source's surah table, and where they came from. */
export interface BuildSource {
  ayahs: SourceAyah[];
  surahs: SourceSurah[];
  info: QuranSource;
}

/**
 * The key `SURAHS` uses for a surah, from the source's Arabic name: folded by
 * `normalizeArabic`, without the leading «سورة». Titles in the books fold to the
 * same key, so one rule serves both sides.
 */
export function surahKey(nameAr: string): string {
  return normalizeArabic(nameAr).replace(/^سوره\s+/, '');
}

/** Hafs numbering has 114 surahs and 6,236 ayahs. Any other total is a different text. */
export function assertFullHafs(source: Pick<BuildSource, 'ayahs' | 'surahs'>): void {
  if (source.surahs.length !== 114) throw new Error(`the source has ${source.surahs.length} surahs, expected 114`);
  if (source.ayahs.length !== 6236) throw new Error(`the source has ${source.ayahs.length} ayahs, expected 6236 (Hafs)`);
  const counted = source.surahs.reduce((n, s) => n + s.ayahCount, 0);
  if (counted !== 6236) throw new Error(`the source's surah table adds up to ${counted} ayahs, expected 6236`);
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
  source: BuildSource;
  catalogs: CatalogInput[];
}

const gradeNumber = (gradeId: string): number => Number(gradeId.replace('grade-', ''));

/** The credit and licence line the corner shows. Written here, from the source's own facts, so it cannot drift from them. */
export function creditLine(info: QuranSource): string {
  return [
    `Text: ${info.publisher}.`,
    `Dataset: ${info.name}, ${info.version} — ${info.url} — ${info.licenseName}.`,
    'Modified: yes (a subset of the ayahs, each assembled from the dataset\'s words and signs).',
  ].join(' ');
}

export function buildCorner(input: BuildInput): QuranCornerFile {
  const { source } = input;
  const textOf = new Map(source.ayahs.map(a => [`${a.surah}:${a.ayah}`, a.text]));
  const sourceSurah = new Map(source.surahs.map(s => [s.number, s]));

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
        const theirs = sourceSurah.get(meta.number);
        if (!theirs) throw new Error(`the source has no surah ${meta.number} ("${title.nameAr}")`);
        if (surahKey(theirs.nameAr) !== title.key) {
          throw new Error(`surah ${meta.number}: the table calls it "${title.key}" but the source calls it "${surahKey(theirs.nameAr)}"`);
        }
        if (theirs.ayahCount !== meta.ayahCount) {
          throw new Error(`surah ${meta.number} ("${title.nameAr}"): the table says ${meta.ayahCount} ayahs, the source says ${theirs.ayahCount}`);
        }
        const from = title.from ?? 1;
        const to = title.to ?? theirs.ayahCount;
        if (to > theirs.ayahCount) {
          throw new Error(`"${lesson.title_ar}" names ayah ${to}, but surah ${meta.number} has ${theirs.ayahCount}`);
        }
        let entry = found.get(title.key);
        if (!entry) {
          entry = { number: meta.number, ayahCount: theirs.ayahCount, nameAr: title.nameAr, ranges: [], lessons: [] };
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

  return { source: source.info, notice: creditLine(source.info), surahs };
}

/**
 * The sheet a person checks the shipped text against an authorised printed
 * Mus'haf al-Madinah with. EVERY shipped ayah is listed, by surah and number,
 * because the publisher's terms put the duty to verify on whoever publishes the
 * text to end users, and the build cannot do that for diacritics.
 */
export function reviewSheet(corner: QuranCornerFile): string {
  const out: string[] = [
    '# Quran Corner — verification sheet',
    '',
    'Generated by `pnpm --filter @workspace/curriculum run build-quran-corner`. Do not edit by hand.',
    '',
    `Source: ${corner.source.name}, ${corner.source.version} (text: ${corner.source.publisher}).`,
    '',
    'Check every ayah below against an **authorised printed Mus\'haf al-Madinah**: the letters,',
    'every vowel and every sign. The build already checked, by machine, that each surah\'s number,',
    'name and ayah count agree with the source\'s own table; it cannot check the diacritics.',
    'Record who checked and when in the commit message.',
    '',
  ];
  for (const s of corner.surahs) {
    const segs = s.segments.map(g => (g.from === g.to ? `${g.from}` : `${g.from}–${g.to}`)).join('، ');
    out.push(`## ${s.number} — ${s.nameAr} (${s.ayahCount} ayahs in the surah; shipped: ${segs})`, '');
    for (const a of s.ayahs) out.push(`${s.number}:${a.n}  ${a.text}`);
    out.push('');
  }
  return out.join('\n');
}
