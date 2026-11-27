/**
 * Shrinking a photo before it is sent to be read.
 *
 * A teacher photographs a marked paper with whatever their phone does by
 * default — twelve megapixels, several megabytes, and a third larger again
 * once it is base64 for the data URL. The first real scan in production was
 * refused for exactly that reason.
 *
 * The fix is to send less, not to accept more. A page of handwritten marks is
 * legible at about 1600px on the long edge; beyond that every extra pixel is
 * bytes uploaded over a phone connection and tokens paid for, and buys nothing
 * a reader can use.
 *
 * **Two paths, one result.** On web the picker returns base64 and a canvas
 * shrinks it (`downscaleImage`). On a phone the picker is asked for a file `uri`
 * only — no base64, no picker-side compression — and `expo-image-manipulator`
 * shrinks one photo at a time, so the full-resolution photo is never a string in
 * JavaScript. A photo that needed shrinking ends as a JPEG at quality
 * `SHRUNK_JPEG_QUALITY`. So does any JPEG or HEIC even when it is within the
 * limit, because the re-encode is what drops its EXIF/GPS (`photoMetadata.ts`);
 * only a PNG, GIF or WebP within the limit is passed through in its own format.
 * The decisions
 * (which path, the fallback, one at a time) are in `photoEncode.ts`, which
 * tests can load; this file only supplies the platform calls.
 *
 * Adding `expo-image-manipulator` changed the native surface, which is why
 * `app.json`'s `version` moved to 1.4.0 with it (CLAUDE.md, «`app.json`'s
 * `version` is the OTA compatibility key»).
 */
import { Platform } from 'react-native';
import { fitWithin, MAX_SCAN_EDGE } from './imageFit.ts';
import {
  encodePickedPhoto,
  encodePickedPhotos,
  type PhotoDeps,
  type PickedPhoto,
} from './photoEncode.ts';

export { fitWithin, MAX_SCAN_EDGE };
export type { PickedPhoto };

/** JPEG quality of a shrunk photo, the same on web and on a phone. */
const SHRUNK_JPEG_QUALITY = 0.72;

/**
 * Pickers ask for base64 only on web. On a phone they ask for a `uri` and let
 * `pickedPhotoToDataUrl` read it, shrunk — asking the picker for base64 would
 * put every full-resolution photo in memory before anything could shrink it.
 */
export const PICK_BASE64 = Platform.OS === 'web';

/**
 * The picker's own `quality`: whatever the caller wanted on web, and 1 on a
 * phone, so the photo is not JPEG-compressed twice (once by the picker, once by
 * the resize) — generation loss is what smears handwriting.
 */
export function photoPickQuality(webQuality: number): number {
  return Platform.OS === 'web' ? webQuality : 1;
}

/**
 * Return the same photo, smaller (web, from a data URL). With
 * `forceReencode` it is redrawn on the canvas even when it is already small,
 * which drops its EXIF/GPS (the canvas holds pixels only, and current browsers
 * draw an image with its EXIF orientation applied).
 *
 * Without `forceReencode`, falls back to the original on any failure — a scan
 * refused for size is a better outcome than one that never happens because the
 * resize threw. With it, a failure THROWS: handing back the original would
 * hand back the metadata, and `photoEncode.ts` decides what to do then.
 */
export async function downscaleImage(
  dataUrl: string,
  maxEdge: number = MAX_SCAN_EDGE,
  forceReencode: boolean = false,
): Promise<string> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    if (forceReencode) throw new Error('no canvas to re-encode on');
    return dataUrl;
  }

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('could not decode the photo'));
      el.src = dataUrl;
    });

    const size = fitWithin(image.naturalWidth, image.naturalHeight, maxEdge);
    if (size.width === 0) {
      if (forceReencode) throw new Error('the photo has no size');
      return dataUrl;
    }
    // Already small enough — re-encoding would only lose detail, unless it
    // carries metadata that must go.
    if (!forceReencode && size.width === image.naturalWidth && size.height === image.naturalHeight) {
      return dataUrl;
    }

    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      if (forceReencode) throw new Error('no 2d canvas');
      return dataUrl;
    }
    ctx.drawImage(image, 0, 0, size.width, size.height);

    // JPEG, not PNG: this is a photograph, and PNG would be several times
    // larger for no gain on a page of handwriting.
    return canvas.toDataURL('image/jpeg', SHRUNK_JPEG_QUALITY);
  } catch (error) {
    if (forceReencode) throw error;
    return dataUrl;
  }
}

const photoDeps: PhotoDeps = {
  platform: Platform.OS === 'web' ? 'web' : 'native',
  webDownscale: downscaleImage,

  async nativeResize(uri, arg) {
    // `arg` is null when the photo is small enough and is only being
    // re-encoded to drop its metadata.
    try {
      // Lazy: the web bundle and the node tests must never load a native module.
      const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
      // Two native objects, and BOTH must be released. The context holds the
      // rendered bitmap as its last task and `renderAsync()` returns a ref to
      // that same bitmap, so releasing only the ref frees nothing while the
      // context lives. Hold nothing between photos. A release that throws is
      // swallowed: a failed release must never turn a good shrunk photo into
      // the full-size fallback.
      const context = ImageManipulator.manipulate(uri);
      try {
        const ref = await (arg ? context.resize(arg) : context).renderAsync();
        try {
          const out = await ref.saveAsync({
            format: SaveFormat.JPEG,
            compress: SHRUNK_JPEG_QUALITY,
            base64: true,
          });
          if (!out.base64) throw new Error('the resize produced no data');
          return out.base64;
        } finally {
          try {
            ref.release();
          } catch {
            /* nothing to free */
          }
        }
      } finally {
        try {
          context.release();
        } catch {
          /* nothing to free */
        }
      }
    } catch (error) {
      // `photoEncode` falls back to the original photo for a type with no
      // metadata, and drops the photo for a JPEG/HEIC. Either would hide a
      // re-encode that fails on every phone, so leave a trace first.
      console.warn('[photoEncode] native re-encode failed:', error);
      throw error;
    }
  },

  async readAsBase64(uri) {
    const { readAsStringAsync } = await import('expo-file-system/legacy');
    return readAsStringAsync(uri, { encoding: 'base64' });
  },
};

/**
 * One picked photo as a data URL, shrunk to `maxEdge` on its long edge.
 * `null` when it cannot be read — callers already treat that as «cancelled».
 */
export function pickedPhotoToDataUrl(
  asset: PickedPhoto,
  maxEdge: number = MAX_SCAN_EDGE,
): Promise<string | null> {
  return encodePickedPhoto(asset, photoDeps, maxEdge);
}

/** Several picked photos, one at a time and in order; unreadable ones are left out. */
export function pickedPhotosToDataUrls(
  assets: PickedPhoto[],
  maxEdge: number = MAX_SCAN_EDGE,
): Promise<string[]> {
  return encodePickedPhotos(assets, photoDeps, maxEdge);
}
