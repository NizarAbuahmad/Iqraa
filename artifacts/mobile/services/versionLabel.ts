/**
 * Formats the build identity shown in Settings → About.
 *
 * Why this is its own module rather than inline JSX: `pnpm test` here is bare
 * `node --test` with no React Native transform, so a module importing `expo-*`
 * at module scope cannot be loaded by the runner at all. Keeping the branching
 * in a module that imports nothing is the only way any of it gets a test — the
 * `Updates.*` reads stay inline in the component.
 *
 * The distinction that matters is `embedded` vs an update id. Three surfaces
 * (web, API, app) carry the same curriculum package and move at three
 * different speeds; "which build am I looking at" was previously unanswerable
 * without grepping a bundle hash. Showing `embedded` for a device that has in
 * fact taken an over-the-air update would defeat the entire point, so that
 * branch is what the test pins.
 */

/** How much of an update id is enough to tell two builds apart by eye. */
const SHORT_ID_LENGTH = 8;

export type BuildIdentity = {
  /** `expo.version` from app.json — the marketing version, e.g. "1.0.0". */
  appVersion: string | null | undefined;
  /** `Updates.updateId` — null when running the bundle shipped inside the binary. */
  updateId?: string | null;
  /** `Updates.channel` — e.g. "preview" or "production"; absent in dev builds. */
  channel?: string | null;
};

/**
 * Renders e.g. `1.0.0 · preview · a1b2c3d4`, or `1.0.0 · embedded` on a binary
 * that has not taken an update yet.
 *
 * Every field is optional at runtime even though the types say otherwise —
 * `Updates.channel` is undefined in Expo Go and in development builds, and
 * `expoConfig` can be null — so each part is dropped rather than rendered as
 * "undefined".
 */
export function versionLabel({ appVersion, updateId, channel }: BuildIdentity): string {
  const parts: string[] = [];

  if (appVersion) parts.push(appVersion);
  if (channel) parts.push(channel);
  parts.push(updateId ? updateId.slice(0, SHORT_ID_LENGTH) : 'embedded');

  return parts.join(' · ');
}
