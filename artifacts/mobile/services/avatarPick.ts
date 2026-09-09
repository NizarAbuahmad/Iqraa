/**
 * Cross-platform pick-and-encode for a profile picture, mirroring
 * `lessonMediaPick.ts`'s `pickLessonPhotos` — single image, downscaled
 * before it becomes a data: URL. An avatar is rendered small and often, so
 * it needs a much smaller long edge than a lesson scan does.
 */
import * as ImagePicker from 'expo-image-picker';
import { downscaleImage } from './imageDownscale';

const MAX_AVATAR_EDGE = 512;

/** One photo from the library, downscaled. Null on cancel/no permission. */
export async function pickAvatarPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    base64: true,
  });
  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0]!;
  if (!asset.base64) return null;
  const mime = asset.mimeType || 'image/jpeg';
  return await downscaleImage(`data:${mime};base64,${asset.base64}`, MAX_AVATAR_EDGE);
}
