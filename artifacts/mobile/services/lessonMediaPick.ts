/**
 * Cross-platform pick-and-encode for lesson attachments, feeding
 * `lessonMediaApi.ts`'s `dataUrl` upload — there is no object storage on the
 * client, same reasoning as `documents/pick.ts`'s `pickMarkSheetPhoto`.
 */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
// The root `expo-file-system` export dropped `readAsStringAsync` in favor of
// a class-based File/Directory API; `/legacy` is the still-supported entry
// point that keeps it, and is simpler here than adopting the new API for one
// call site.
import { readAsStringAsync } from 'expo-file-system/legacy';
import { downscaleImage } from './imageDownscale';

/** Reads an arbitrary picked-file `uri` into a `data:` URL — audio/documents have no built-in base64 picker option, unlike images. */
async function uriToDataUrl(uri: string, mimeType: string): Promise<string> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(blob);
    });
  }
  const base64 = await readAsStringAsync(uri, { encoding: 'base64' });
  return `data:${mimeType};base64,${base64}`;
}

/** One or more photos from the library, downscaled the same way `pickMarkSheetPhoto` does. Empty on cancel/no permission. */
export async function pickLessonPhotos(): Promise<string[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    quality: 0.85,
    base64: true,
  });
  if (result.canceled || !result.assets?.length) return [];

  const out: string[] = [];
  for (const asset of result.assets) {
    if (!asset.base64) continue;
    const mime = asset.mimeType || 'image/jpeg';
    out.push(await downscaleImage(`data:${mime};base64,${asset.base64}`));
  }
  return out;
}

/** One or more audio/document files. Empty on cancel. */
export async function pickLessonFiles(): Promise<string[]> {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    type: ['audio/*', 'application/pdf'],
  });
  if (result.canceled || !result.assets?.length) return [];

  const out: string[] = [];
  for (const asset of result.assets) {
    const mime = asset.mimeType || 'application/octet-stream';
    out.push(await uriToDataUrl(asset.uri, mime));
  }
  return out;
}
