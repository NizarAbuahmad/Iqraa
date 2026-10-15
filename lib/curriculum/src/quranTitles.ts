/**
 * Reading a surah out of a lesson title.
 *
 * The Islamic Education books name what students recite in the lesson title:
 * «سورة العلق: الآيات الكريمة (1-8)», «سورة الغاشية», «سورة المزمل: الآية
 * الكريمة (20)». This is the one place that turns such a title into a surah and
 * an ayah range, so the Quran Corner's scope is exactly what the books assign.
 *
 * Matching is on the folded form (`normalizeArabic`: no harakat, one alif,
 * ة→ه, ى→ي), because the books print the same name with different marks in
 * different grades. The Quran text itself is never folded; this file only reads
 * curriculum titles.
 */
import { normalizeArabic } from './arabic.ts';

export interface SurahTitle {
  /** The name as the book prints it, without «سورة» and without a trailing case mark. */
  nameAr: string;
  /** The name folded for matching — the key into the surah table. */
  key: string;
  /** First and last ayah the title names; both null when it names the whole surah. */
  from: number | null;
  to: number | null;
}

/** «سورة» (folded), at the start of a word. */
const SURAH_WORD = /(^|[\s:،,])سوره(?:\s+|$)/;

/**
 * What follows «سورة» once folded: the name, then an optional «الآيات الكريمة»
 * label (with or without a comma or colon before it), then an optional `(a-b)`
 * or `(n)`.
 */
const TAIL =
  /^(.+?)\s*[،,:]?\s*(?:(?:الايات|الايتان|الايه)(?:\s+(?:الكريمه|الكريمتان))?\s*)?(?:\(\s*(\d+)\s*(?:[-–—]\s*(\d+)\s*)?\))?\s*$/;

/**
 * The surah a lesson title names, or null when it names none («السّورُ
 * المكيّةُ والسّورُ المدنيّةُ» is about surahs in general, not one of them).
 *
 * Throws when a title says «سورة» but cannot be read. The callers are a build
 * script and its test: a silent skip would drop a lesson's text from the corner
 * without anyone being told.
 */
export function parseSurahTitle(title: string): SurahTitle | null {
  const folded = normalizeArabic(title);
  const word = SURAH_WORD.exec(folded);
  if (!word) return null;
  const tail = TAIL.exec(folded.slice(word.index + word[0].length));
  if (!tail) throw new Error(`cannot read the surah title: ${title}`);

  const key = tail[1]!.trim();
  const from = tail[2] ? Number(tail[2]) : null;
  const to = tail[3] ? Number(tail[3]) : from;
  if (from !== null && (from < 1 || (to !== null && to < from))) {
    throw new Error(`bad ayah range in: ${title}`);
  }
  return { nameAr: printedName(title, key), key, from, to };
}

/**
 * The name as the book prints it. The folded key is shorter than the original
 * (harakat are dropped), so find the original text just after «سورة» and take
 * the longest prefix whose fold equals the key. The book prints the name in the
 * genitive («نوحٍ», «لقمانَ»), which reads wrongly as a heading, so the trailing
 * case mark is dropped; every other mark is left as printed.
 */
function printedName(title: string, key: string): string {
  let after = 0;
  for (let i = 1; i <= title.length; i++) {
    if (/(^|[\s:،,])سوره$/.test(normalizeArabic(title.slice(0, i)))) {
      after = i;
      break;
    }
  }
  // «سورَةُ»: the case mark after the taa marbuta belongs to «سورة», not the name.
  while (after < title.length && /[ً-ْٰـ\s]/.test(title[after]!)) after++;
  const rest = title.slice(after);
  for (let end = rest.length; end > 0; end--) {
    const candidate = rest.slice(0, end).trim();
    if (normalizeArabic(candidate) === key) return candidate.replace(/[ً-ْ]+$/, '');
  }
  throw new Error(`cannot recover the printed name "${key}" from: ${title}`);
}
