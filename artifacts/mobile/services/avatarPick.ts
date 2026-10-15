/**
 * Cross-platform pick-and-encode for a profile picture, mirroring
 * `lessonMediaPick.ts`'s `pickLessonPhotos` — single image, downscaled
 * before it becomes a data: URL. An avatar is rendered small and often, so
 * it needs a much smaller long edge than a lesson scan does.
 */
import * as ImagePicker from 'expo-image-picker';
import { PICK_BASE64, photoPickQuality, pickedPhotoToDataUrl } from './imageDownscale';

const MAX_AVATAR_EDGE = 512;

/** One photo from the library, downscaled. Null on cancel/no permission. */
export async function pickAvatarPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: photoPickQuality(0.85),
    base64: PICK_BASE64,
  });
  if (result.canceled || !result.assets?.length) return null;

  return pickedPhotoToDataUrl(result.assets[0]!, MAX_AVATAR_EDGE);
}
