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
 * **Web only, deliberately.** The app is served as an Expo web build and that
 * is where teachers use it; `canvas` is already there and needs no dependency.
 * On a native build this returns the photo untouched rather than pretending —
 * `expo-image-manipulator` is the answer there, and adding a dependency for a
 * platform nobody is running yet is a cost with no reader.
 */
import { Platform } from 'react-native';
import { fitWithin, MAX_SCAN_EDGE } from './imageFit.ts';

export { fitWithin, MAX_SCAN_EDGE };

/**
 * Return the same photo, smaller. Falls back to the original on any failure —
 * a scan refused for size is a better outcome than one that never happens
 * because the resize threw.
 */
export async function downscaleImage(
  dataUrl: string,
  maxEdge: number = MAX_SCAN_EDGE,
): Promise<string> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return dataUrl;

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('could not decode the photo'));
      el.src = dataUrl;
    });

    const size = fitWithin(image.naturalWidth, image.naturalHeight, maxEdge);
    if (size.width === 0) return dataUrl;
    // Already small enough — re-encoding would only lose detail.
    if (size.width === image.naturalWidth && size.height === image.naturalHeight) {
      return dataUrl;
    }

    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(image, 0, 0, size.width, size.height);

    // JPEG, not PNG: this is a photograph, and PNG would be several times
    // larger for no gain on a page of handwriting.
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch {
    return dataUrl;
  }
}
