/**
 * The five photo pickers must not put a full-resolution photo in memory.
 *
 * They import `expo-image-picker`, which `node --test` cannot load, so this
 * reads the source (the pattern `scanRoutes.test.ts` uses where a harness is
 * impossible). What it proves is textual: none asks the picker for base64
 * unconditionally, none shrinks by calling the web-only `downscaleImage`
 * directly, and every pick that wants base64 also asks for the native-safe
 * quality. How a photo is actually handled is in `photoEncode.test.ts`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(here, rel), 'utf8');

const FILES: Record<string, string> = {
  'documents/pick.ts (pickMarkSheetPhoto, pickMarkSheetPhotos)': read('../documents/pick.ts'),
  'messaging.ts (pickChatImage)': read('../messaging.ts'),
  'avatarPick.ts (pickAvatarPhoto)': read('../avatarPick.ts'),
  'lessonMediaPick.ts (pickLessonPhotos)': read('../lessonMediaPick.ts'),
};

const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;

for (const [name, source] of Object.entries(FILES)) {
  describe(name, () => {
    it('never asks the picker for base64 unconditionally', () => {
      assert.doesNotMatch(source, /base64:\s*true/);
    });

    it('asks for base64 only through PICK_BASE64', () => {
      assert.match(source, /base64:\s*PICK_BASE64/);
      assert.equal(count(source, /base64:/g), count(source, /base64:\s*PICK_BASE64/g));
    });

    it('does not call the web-only downscaleImage itself', () => {
      assert.doesNotMatch(source, /\bdownscaleImage\(/);
    });

    it('shrinks through pickedPhotoToDataUrl / pickedPhotosToDataUrls', () => {
      assert.match(source, /pickedPhotos?ToDataUrls?\(/);
    });

    it('gives every base64 pick the native-safe quality', () => {
      assert.ok(
        count(source, /photoPickQuality\(/g) >= count(source, /base64:\s*PICK_BASE64/g),
        'each pick that sets base64 must also set quality through photoPickQuality()',
      );
    });
  });
}
