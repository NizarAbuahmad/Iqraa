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
  name: string;
  variant: string;
  url: string;
  licenseName: string;
  licenseUrl: string;
  /** `YYYY-MM-DD` the snapshot was downloaded. */
  retrievedOn: string;
  /** SHA-256 of the snapshot file the ayahs were copied from. */
  sha256: string;
  /** How the file was downloaded (the options chosen on the source's page). */
  notes: string;
}

export interface QuranCornerFile {
  source: QuranSource;
  /** The source's own licence notice, verbatim apart from the comment marker. */
  notice: string;
  surahs: QuranSurah[];
}
