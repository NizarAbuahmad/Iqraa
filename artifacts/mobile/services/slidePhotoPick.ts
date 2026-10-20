/**
 * A teacher's own photo for a slide — `avatarPick.ts`'s pattern, sized for a
 * projector: shrunk to 1280px on the long edge (a few hundred KB as a JPEG)
 * and kept in the deck as a `data:` URL.
 *
 * In the deck rather than uploaded: the photo may well be of the teacher's own
 * class, and the deck is the teacher's draft — it should not become a public
 * URL, and a signed one (`lessonMedia.ts`) expires while a saved deck lives on.
 */
import * as ImagePicker from 'expo-image-picker';
import { PICK_BASE64, photoPickQuality, pickedPhotoToDataUrl } from './imageDownscale';

const MAX_SLIDE_PHOTO_EDGE = 1280;

/** One photo from the library, downscaled. Null on cancel/no permission. */
export async function pickSlidePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: photoPickQuality(0.85),
    base64: PICK_BASE64,
  });
  if (result.canceled || !result.assets?.length) return null;

  return pickedPhotoToDataUrl(result.assets[0]!, MAX_SLIDE_PHOTO_EDGE);
}
