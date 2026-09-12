/**
 * Pick a profile picture and encode it for `PUT /auth/users/profile/avatar`.
 *
 * A `data:` URL, not a file handle: there is no object storage on the client,
 * and this is the shape every other upload in the app already uses (chat
 * attachments, lesson media, mark-sheet scans).
 *
 * The pure part — the size limit and the format allowlist — lives in
 * `avatarImage.ts` so tests can reach it; this file only exists to talk to
 * `expo-image-picker`, which the test runner cannot load.
 */
import * as ImagePicker from 'expo-image-picker';
import { downscaleImage } from './imageDownscale.ts';
import { AVATAR_MAX_EDGE, isSupportedAvatarDataUrl } from './avatarImage.ts';

export type ProfilePhotoPick =
  | { ok: true; dataUrl: string }
  /**
   * Every refusal is named rather than collapsed into null. A teacher who
   * cancelled should see nothing; one whose library permission is off, or
   * whose photo is a format the app cannot draw, needs to be told which —
   * and a single null cannot tell a screen the difference.
   */
  | { ok: false; reason: 'cancelled' | 'permission' | 'unsupported' };

export async function pickProfilePhoto(): Promise<ProfilePhotoPick> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { ok: false, reason: 'permission' };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    // The picture is drawn in a circle everywhere it appears, so the crop
    // belongs at pick time. Without it the teacher chooses a landscape photo
    // and the app decides which square of it is their face.
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
    base64: true,
  });
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset?.base64) return { ok: false, reason: 'cancelled' };

  const raw = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
  // Downscale before the format check, not after: on web this re-encodes to
  // JPEG, which turns an otherwise unsupported pick into a supported one. Off
  // the web it returns the photo untouched (see imageDownscale.ts), which is
  // exactly when the check below has something left to catch.
  const dataUrl = await downscaleImage(raw, AVATAR_MAX_EDGE);
  if (!isSupportedAvatarDataUrl(dataUrl)) return { ok: false, reason: 'unsupported' };

  return { ok: true, dataUrl };
}
