/**
 * One photo of a student's homework project, picked from the library.
 *
 * Library only, on purpose: app.json has `cameraPermission: false`, and a camera
 * is a native change (a version bump and a new build) that this feature does not
 * make. Same shape as `pickChatImage` in messaging.ts; the shrinking and the
 * native-safe quality come from imageDownscale.ts (see photoPickers.test.ts).
 *
 * Imports `expo-image-picker`, so `node --test` can only read this file as text.
 */
import * as ImagePicker from 'expo-image-picker';
import { PICK_BASE64, photoPickQuality, pickedPhotoToDataUrl } from './imageDownscale.ts';
import { photoDataUrlOk } from './homeworkSubmission.ts';

export type HomeworkPhotoPick =
  | { kind: 'ok'; dataUrl: string }
  | { kind: 'cancelled' }
  | { kind: 'denied' }
  /**
   * Picked, but the encoded result is not a jpeg/png/webp data URL the server
   * accepts (or is over its size cap). A photo already within the long-edge limit
   * is passed through without re-encoding, so a small HEIC stays `data:image/heic`.
   * The screen shows its own message for this instead of letting the server answer 400.
   */
  | { kind: 'unsupported' };

export async function pickHomeworkPhoto(): Promise<HomeworkPhotoPick> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { kind: 'denied' };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: photoPickQuality(0.85),
    base64: PICK_BASE64,
  });
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return { kind: 'cancelled' };

  const dataUrl = await pickedPhotoToDataUrl(asset);
  if (!dataUrl || !photoDataUrlOk(dataUrl)) return { kind: 'unsupported' };
  return { kind: 'ok', dataUrl };
}
