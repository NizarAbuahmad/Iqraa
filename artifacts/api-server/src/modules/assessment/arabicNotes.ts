/**
 * Small pieces for writing a generated exam's warnings in Arabic, beside the
 * English, where each warning is made (see `warningsArabic.test.ts`).
 *
 * Digits are Arabic-Indic, as the rest of the Arabic app prints them, and a
 * multiple-choice option is named by its abjad letter, as the exports and the
 * printed paper letter them (`artifacts/mobile/services/optionLabels.ts`).
 */

/** «١٢» for 12. */
export function arDigits(n: number | string): string {
  return String(n).replace(/[0-9]/g, d => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);
}

/** أ ب ج د … — abjad order, never the alphabetical أ ب ت ث. */
const ABJAD = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح", "ط", "ي"];

/** The letter of the option at 0-based position `i`, or its number past ي. */
export function optionLetterAr(i: number): string {
  return ABJAD[i] ?? arDigits(i + 1);
}

/** «١، ٢ و٣» — a list of numbers the Arabic way. */
export function arList(items: readonly (number | string)[]): string {
  const parts = items.map(arDigits);
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join("، ")} و${parts[parts.length - 1]}`;
}
