/**
 * Cross-platform file / image picking for Teaching Assistant uploads.
 */

import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
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
 * `base64: true` rather than reading the file afterwards, because the two
 * platforms disagree about what a `uri` is — on web it is a blob URL, on
 * device a file path — and the caller only ever wants the bytes inline. There
 * is no object storage in this app, so a data URL is the whole transport.
 *
 * Quality is deliberately lower than the teaching-image picker: this is
 * handwriting on paper, not a diagram to display, and every extra pixel is
 * base64 inflated by a third and then paid for by the token.
 */
export async function pickMarkSheetPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 0.6,
    base64: true,
  });
  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0]!;
  if (!asset.base64) return null;
  const mime = asset.mimeType || 'image/jpeg';
  return `data:${mime};base64,${asset.base64}`;
}
