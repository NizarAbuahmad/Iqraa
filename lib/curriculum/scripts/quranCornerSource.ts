/**
 * Reads the Quran source the corner is built from: the pinned `@quran.ws/text`
 * package (the King Fahd Complex's Mus'haf al-Madinah, Hafs). Node only, and
 * never imported by the app — the app reads the generated `quran_corner.json`.
 *
 * Ayahs are rendered with the package's own renderer (`Ayah.render`), which
 * re-attaches the waqf and other signs the dataset stores separately, so no
 * assembly logic is reimplemented here.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { Mushaf } from '@quran.ws/text';

import type { BuildInput, BuildSource, CatalogInput, SourceAyah, SourceSurah } from './quranCornerBuild.ts';

const sha256 = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex');

/** Where the installed package lives. Its `exports` allow only the entry point, so the data files are found beside it. */
export function quranWsDir(): string {
  return dirname(createRequire(import.meta.url).resolve('@quran.ws/text'));
}

export async function loadQuranWsSource(): Promise<BuildSource> {
  const dir = quranWsDir();
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { name: string; version: string };
  const mushaf = await Mushaf.hafs();

  const surahs: SourceSurah[] = [];
  const ayahs: SourceAyah[] = [];
  for (const s of mushaf.surahs) {
    surahs.push({ number: s.number, nameAr: s.nameAr, ayahCount: s.ayahCount });
    for (const a of s.ayahs) ayahs.push({ surah: s.number, ayah: a.number, text: a.render({ marks: true }) });
  }

  return {
    ayahs,
    surahs,
    info: {
      name: 'quran-text by quran-ws',
      version: `${pkg.name} ${pkg.version}`,
      url: 'https://github.com/quran-ws/quran-text',
      publisher: "King Fahd Glorious Qur'an Printing Complex — Mus'haf al-Madinah, Hafs from 'Asim (UthmanicHafs v3.0)",
      licenseName: "CC BY 4.0 (the dataset); the text and font stay under the Complex's published usage rights",
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sha256: sha256(join(dir, 'data', 'hafs.json')),
      font: { family: mushaf.font.family, file: mushaf.font.file, sha256: sha256(join(dir, 'data', mushaf.font.file)) },
    },
  };
}

/** The 20 Islamic catalogs, grade 1 to 10, two semesters each, in a fixed order. */
export function loadCatalogs(dir: URL = new URL('../src/data/', import.meta.url)): CatalogInput[] {
  const catalogs: CatalogInput[] = [];
  for (let grade = 1; grade <= 10; grade++) {
    for (const semester of [1, 2] as const) {
      const file = new URL(`iqra_curriculum_g${grade}_islamic_sem${semester}.json`, dir);
      const cat = JSON.parse(readFileSync(file, 'utf8')) as { units: CatalogInput['units'] };
      catalogs.push({ gradeId: `grade-${grade}`, semester, units: cat.units });
    }
  }
  return catalogs;
}

export async function loadBuildInput(): Promise<BuildInput> {
  return { source: await loadQuranWsSource(), catalogs: loadCatalogs() };
}
