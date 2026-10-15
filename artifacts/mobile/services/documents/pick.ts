/**
 * Cross-platform file / image picking for Teaching Assistant uploads.
 */

import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  PICK_BASE64,
  photoPickQuality,
  pickedPhotoToDataUrl,
  pickedPhotosToDataUrls,
} from '../imageDownscale';
import type { PickedFile } from './session';

export async function pickTeachingDocuments(): Promise<PickedFile[]> {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    type: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'image/*',
    ],
  });

  if (result.canceled || !result.assets?.length) return [];

  return result.assets.map(a => ({
    uri: a.uri,
    name: a.name || 'document',
    mimeType: a.mimeType,
    size: a.size,
  }));
}

export async function pickTeachingImages(): Promise<PickedFile[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    quality: 0.85,
  });

  if (result.canceled || !result.assets?.length) return [];

  return result.assets.map((a, i) => {
    const ext = a.uri.split('.').pop()?.toLowerCase() || 'jpg';
    const name = a.fileName || `image-${Date.now()}-${i}.${ext}`;
    return {
      uri: a.uri,
      name,
      mimeType: a.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      size: a.fileSize ?? undefined,
    };
  });
}

/**
 * One photo of a marked paper, as a data URL.
 *
 * There is no object storage in this app, so a data URL is the whole transport.
 * On web the picker is asked for base64 (a blob URL is not readable later); on
 * a phone it is asked for the file only, and the photo is shrunk to 1600px
 * before it ever becomes a string — a default phone photo is megabytes, and
 * the first real scan in production was refused for size. `quality` alone does
 * not help: it re-compresses twelve megapixels rather than sending fewer.
 *
 * Quality is deliberately lower than the teaching-image picker on web: this is
 * handwriting on paper, not a diagram to display.
 */
export async function pickMarkSheetPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: photoPickQuality(0.6),
    base64: PICK_BASE64,
  });
  if (result.canceled || !result.assets?.length) return null;

  return pickedPhotoToDataUrl(result.assets[0]!);
}

/**
 * Several photos of marked papers (or of the pages of one exam), each shrunk the
 * same way `pickMarkSheetPhoto` does, one at a time. Empty on cancel or no
 * permission.
 *
 * `limit` is a ceiling on the picker, and applied again to the result because
 * `selectionLimit` is advisory on some platforms.
 */
export async function pickMarkSheetPhotos(limit: number): Promise<string[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: limit,
    quality: photoPickQuality(0.6),
    base64: PICK_BASE64,
  });
  if (result.canceled || !result.assets?.length) return [];

  return pickedPhotosToDataUrls(result.assets.slice(0, limit));
}
