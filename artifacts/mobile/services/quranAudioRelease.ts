/**
 * The Quran Corner's audio gate.
 *
 * Flipped to true on 2026-10-16 at the owner's request, BEFORE the checklist in
 * `lib/curriculum/sources/quran-audio/VERIFY.md` was done: when this was
 * written `sources/quran-audio/MANIFEST.json` was not in the repo, i.e. nobody
 * had committed a run of `pnpm --filter @workspace/curriculum run quran-audio`,
 * and nobody had listened to a sample or run the device checks. If the files are
 * not in the bucket, every listen button ends in the quiet «تعذّر تشغيل التلاوة»
 * line. The owner released it knowing that.
 *
 * Set it back to `false` to hide every listen control in production builds
 * again (a merge to main deploys the web app and an over-the-air update).
 * Development builds always show the controls.
 *
 * Deliberately a source constant, not an EXPO_PUBLIC_* variable: those must be
 * declared in three places (deploy.yml, eas.json, mobile-update.yml) and a miss
 * silently changes nothing.
 */
export const QURAN_AUDIO_UPLOADED = true;

/** `dev` is React Native's `__DEV__`, passed in so this stays testable under bare node. */
export function quranAudioVisible(uploaded: boolean, dev: boolean): boolean {
  return uploaded || dev;
}
