/**
 * Date labels for the Today screen. Free of react-native so `node --test`
 * can load it.
 */

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
    return now.toLocaleDateString(lang === 'ar' ? 'ar-JO-u-nu-latn' : 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  } catch {
    return '';
  }
}
