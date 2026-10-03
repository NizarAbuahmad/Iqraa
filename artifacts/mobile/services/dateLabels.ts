/**
 * Date labels. Free of react-native so `node --test` can load it.
 */

/**
 * Arabic with Latin digits. Plain `ar-JO` defaults to Arabic-Indic digits, so
 * one screen read «٣ تشرين الأول» while the next read «3 تشرين الأول». The
 * `-u-nu-latn` extension keeps the Arabic weekday and month names and swaps
 * only the numbering system. Interface text is Latin throughout — the board's
 * «1 من 5», clock times, typed input (`toLatinDigits`). Arabic-Indic digits
 * stay where they carry content: book citations, maths, game scores.
 */
export const AR_LATIN = 'ar-JO-u-nu-latn';

/** The locale every date and time on an interface screen is formatted with. */
export function dateLocale(lang: 'ar' | 'en'): string {
  return lang === 'ar' ? AR_LATIN : 'en-GB';
}

/**
 * «السبت، 3 تشرين الأول» — the header line, today's date.
 *
 * Latin digits, like everything else on that screen: the readiness count
 * («1 من 5»), the saved-ago date on a board row (`savedAgo`) and the clock
 * times. Plain `ar-JO` defaults to Arabic-Indic digits, which put «٣» above a
 * board that read «26 آب». The `-u-nu-latn` extension keeps the Arabic weekday
 * and month names and swaps only the numbering system.
 */
export function todayLabel(lang: 'ar' | 'en', now: Date = new Date()): string {
  try {
    return now.toLocaleDateString(dateLocale(lang), {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  } catch {
    return '';
  }
}
