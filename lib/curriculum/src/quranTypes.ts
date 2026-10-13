/** The shape of `data/quran_corner.json`. Types only, so the build script and the loader can share them. */

export interface QuranAyah {
  /** The ayah number within its surah (Hafs numbering, from the source). */
  n: number;
  /** The source's text for this ayah, unmodified. */
  text: string;
}

/** An inclusive run of consecutive ayahs the books assign. */
export interface QuranSegment {
  from: number;
  to: number;
}

/** One lesson that assigns part of a surah. */
export interface QuranLessonRef {
  /** `kbl-*` lesson id — carried by id, never by title. */
  lessonId: string;
  gradeId: string;
  semester: 1 | 2;
  /** The ayahs this lesson assigns (a whole-surah lesson is 1..ayahCount). */
  from: number;
  to: number;
}

export interface QuranSurah {
  /** The surah number, 1–114. */
  number: number;
  /** The name as the first lesson that names it prints it. */
  nameAr: string;
  /** Ayahs in the whole surah, from the source. */
  ayahCount: number;
  /** The assigned ayahs, merged: sorted, and never touching. */
  segments: QuranSegment[];
  lessons: QuranLessonRef[];
  /** Exactly the ayahs in `segments`, in order. */
  ayahs: QuranAyah[];
}

export interface QuranSource {
  /** The dataset the ayahs were read from. */
  name: string;
  /** The package and version pinned, e.g. `@quran.ws/text 0.1.0`. */
  version: string;
  url: string;
  /** Who publishes the text itself. */
  publisher: string;
  licenseName: string;
  licenseUrl: string;
  /** SHA-256 of the dataset file (`data/hafs.json`) the ayahs were read from. */
  sha256: string;
  /** The font this text must be drawn in: the publisher's own, which the dataset ships. */
  font: { family: string; file: string; sha256: string };
}

export interface QuranCornerFile {
  source: QuranSource;
  /** The credit and licence line the corner shows, written by the build from `source`. */
  notice: string;
  surahs: QuranSurah[];
}
