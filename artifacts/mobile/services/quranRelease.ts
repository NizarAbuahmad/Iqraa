/**
 * The Quran Corner's release gate.
 *
 * The text is NOT yet verified against an authorised printed mushaf (see
 * STATUS.md and lib/curriculum/sources/quran-ws/VERIFY.md), and a merge to main
 * deploys the web app and an over-the-air update to every signed-in user. So the
 * corner is hidden in production builds until a named person has signed off
 * VERIFY.md and this is flipped to true. Development builds always show it, so
 * it can be opened and checked before then.
 *
 * Deliberately a source constant, not an EXPO_PUBLIC_* variable: those must be
 * declared in three places (deploy.yml, eas.json, mobile-update.yml) and a miss
 * silently changes nothing — here the flip is a reviewed one-line diff.
 */
export const QURAN_CORNER_RELEASED = false;

/** `dev` is React Native's `__DEV__`, passed in so this stays testable under bare node. */
export function quranCornerVisible(released: boolean, dev: boolean): boolean {
  return released || dev;
}
