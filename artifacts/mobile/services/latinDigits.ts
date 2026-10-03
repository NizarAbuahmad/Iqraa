/**
 * Arabic-Indic (٠-٩) and Eastern Arabic-Indic (۰-۹) digits → ASCII.
 *
 * An Arabic keyboard's number pad emits ٠-٩ on many Android devices.
 * `Number('٢')` is NaN and `\d` does not match it, so a teacher typing marks,
 * a schedule time or a six-digit verification code with that keyboard was
 * told the value was invalid — or watched the digits vanish from the box.
 * Fold before validating, everywhere a number is typed. Free of react-native
 * so `node --test` can load it.
 */
const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹';

export function toLatinDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, d => {
    const i = ARABIC_INDIC.indexOf(d);
    return String(i >= 0 ? i : EASTERN_ARABIC_INDIC.indexOf(d));
  });
}
