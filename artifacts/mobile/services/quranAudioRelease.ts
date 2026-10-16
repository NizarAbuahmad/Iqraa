/**
 * The Quran Corner's audio gate.
 *
 * `false` until the owner has (1) run `pnpm --filter @workspace/curriculum run
 * quran-audio` somewhere that can reach the source, (2) committed the
 * MANIFEST it writes, and (3) listened to the sample in
 * `lib/curriculum/sources/quran-audio/VERIFY.md` — right ayah, no basmalah
 * spliced in or out, no clipped ending. With it `false`, no listen control
 * renders in a production build, so a student never sees a button that plays
 * nothing. Development builds always show them, so the controls can be tried
 * before the flip. Flipping is a reviewed one-line change that ships over the
 * air; setting it back hides the controls again.
 *
 * Deliberately a source constant, not an EXPO_PUBLIC_* variable: those must be
 * declared in three places (deploy.yml, eas.json, mobile-update.yml) and a miss
 * silently changes nothing.
 */
export const QURAN_AUDIO_UPLOADED = false;

/** `dev` is React Native's `__DEV__`, passed in so this stays testable under bare node. */
export function quranAudioVisible(uploaded: boolean, dev: boolean): boolean {
  return uploaded || dev;
}
