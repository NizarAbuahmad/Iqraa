/**
 * Where the Quran Corner's recitation audio lives, and the one place that
 * names a recording. The upload script (`scripts/upload-quran-audio-r2.ts`)
 * and the app (`artifacts/mobile/services/quranAudio.ts`) both build keys
 * here, so the file a script stores and the file a phone asks for cannot
 * drift apart.
 *
 * One MP3 per ayah, for exactly the ayahs in `quran_corner.json` — the ones
 * the grade 1–10 lesson titles name — never for whole surahs. The reciter is
 * Sheikh Mahmoud Khalil Al-Husary, murattal. NOTHING here says the recordings
 * exist yet: `QURAN_AUDIO_UPLOADED` in the app hides every control until
 * someone has run the upload and listened (see
 * `sources/quran-audio/VERIFY.md`).
 */
import { QURAN_SURAHS } from './quran.ts';

/** `iqraa-public`'s anonymous-read origin on R2 (same host as `BOOK_FIGURE_BASE_URL`). */
export const QURAN_AUDIO_ORIGIN = 'https://pub-d9ddd8f74e734a21824518b812652124.r2.dev';

/** The key prefix inside the bucket. A second reciter would be a sibling prefix. */
export const QURAN_AUDIO_PREFIX = 'quran-audio/husary';

export const QURAN_AUDIO_RECITER = {
  nameAr: 'محمود خليل الحصري',
  nameEn: 'Mahmoud Khalil Al-Husary',
  style: 'murattal',
} as const;

export interface QuranAudioAyah {
  surah: number;
  ayah: number;
}

/** Al-Baqarah, the longest surah — the highest ayah number that can exist. */
const MAX_AYAH = 286;

function assertRef(surah: number, ayah: number): void {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    throw new RangeError(`surah must be an integer 1–114, got ${surah}`);
  }
  if (!Number.isInteger(ayah) || ayah < 1 || ayah > MAX_AYAH) {
    throw new RangeError(`ayah must be an integer 1–${MAX_AYAH}, got ${ayah}`);
  }
}

const pad3 = (n: number): string => String(n).padStart(3, '0');

/** `SSSAAA.mp3` — also the file name the source publishes it under. */
export function quranAudioFile(surah: number, ayah: number): string {
  assertRef(surah, ayah);
  return `${pad3(surah)}${pad3(ayah)}.mp3`;
}

export function quranAudioKey(surah: number, ayah: number): string {
  return `${QURAN_AUDIO_PREFIX}/${quranAudioFile(surah, ayah)}`;
}

export function quranAyahAudioUrl(surah: number, ayah: number): string {
  return `${QURAN_AUDIO_ORIGIN}/${quranAudioKey(surah, ayah)}`;
}

/** Every ayah the corner holds — derived from the data, never hand-listed. */
export function quranAudioAyahs(): QuranAudioAyah[] {
  return QURAN_SURAHS.flatMap(s => s.ayahs.map(a => ({ surah: s.number, ayah: a.n })));
}
