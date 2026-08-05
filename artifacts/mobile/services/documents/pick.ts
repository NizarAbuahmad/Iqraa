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
