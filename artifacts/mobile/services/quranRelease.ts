/**
 * The Quran Corner's release gate.
 *
 * Flipped to true on 2026-10-15 at the owner's request. The text is STILL NOT
 * verified against an authorised printed mushaf (see STATUS.md and
 * lib/curriculum/sources/quran-ws/VERIFY.md): the owner released it knowing that.
 * Set it back to false to hide the card and the three screens in production
 * builds again (a merge to main deploys the web app and an over-the-air update). Development builds always show it, so
 * it can be opened and checked before then.
 *
 * Deliberately a source constant, not an EXPO_PUBLIC_* variable: those must be
 * declared in three places (deploy.yml, eas.json, mobile-update.yml) and a miss
 * silently changes nothing — here the flip is a reviewed one-line diff.
 */
export const QURAN_CORNER_RELEASED = true;

/** `dev` is React Native's `__DEV__`, passed in so this stays testable under bare node. */
export function quranCornerVisible(released: boolean, dev: boolean): boolean {
  return released || dev;
}
