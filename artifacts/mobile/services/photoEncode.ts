/**
 * Turning a picked photo into a data URL, smaller — the decisions only.
 *
 * Split from `imageDownscale.ts` for the reason `routeGating.ts` gives: that
 * file reaches for `react-native` and the DOM, and `node --test` can load
 * neither. The platform calls are passed in as `deps`, so what is worth
 * pinning — which path a photo takes, what happens when shrinking fails, that
 * several photos are handled one at a time — lives where tests can reach it.
 *
 * On web the picker hands over base64 and a canvas shrinks it. On a phone the
 * picker hands over only a file `uri`, one photo is shrunk natively, and only
 * the *shrunk* JPEG is ever turned into a string — on the happy path the
 * full-resolution photo is never held in JavaScript, which is what 40
 * class-scan photos need.
 */
import { MAX_SCAN_EDGE, resizeArg, type ResizeArg } from './imageFit.ts';

/** What the picker gives us about one photo (a subset of `ImagePickerAsset`). */
export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
  mimeType?: string | null;
  /** Present only when the picker was asked for it, i.e. on web. */
  base64?: string | null;
}

export interface PhotoDeps {
  platform: 'web' | 'native';
  /** Web: shrink a data URL on a canvas. Never needs to throw. */
  webDownscale(dataUrl: string, maxEdge: number): Promise<string>;
  /** Native: shrink the file at `uri`; resolves with the base64 body of a JPEG. */
  nativeResize(uri: string, arg: ResizeArg): Promise<string>;
  /** Native: the file at `uri` as it is, as a base64 body. */
  readAsBase64(uri: string): Promise<string>;
}

const dataUrl = (mime: string, base64: string) => `data:${mime};base64,${base64}`;

/**
 * One photo as a data URL, or `null` when it cannot be read at all (every
 * caller already treats that like a cancelled pick).
 *
 * A failed resize falls back to the original rather than losing the photo: the
 * original, full size, at the camera's quality (the picker now runs at quality
 * 1, so that is larger than the old re-encoded pick). The server's size refusal
 * then names the problem.
 */
export async function encodePickedPhoto(
  asset: PickedPhoto,
  deps: PhotoDeps,
  maxEdge: number = MAX_SCAN_EDGE,
): Promise<string | null> {
  const mime = asset.mimeType || 'image/jpeg';

  if (deps.platform === 'web') {
    if (!asset.base64) return null;
    const original = dataUrl(mime, asset.base64);
    try {
      return await deps.webDownscale(original, maxEdge);
    } catch {
      return original;
    }
  }

  const arg = resizeArg(asset.width, asset.height, maxEdge);
  if (arg) {
    try {
      const shrunk = await deps.nativeResize(asset.uri, arg);
      // The manipulator writes a JPEG whatever the input was.
      if (shrunk) return dataUrl('image/jpeg', shrunk);
    } catch {
      // fall through to the original
    }
  }

  try {
    const original = await deps.readAsBase64(asset.uri);
    return original ? dataUrl(mime, original) : null;
  } catch {
    return null;
  }
}

/**
 * Several photos, **one at a time**, in order. Strictly sequential on purpose:
 * running them together would hold several decoded photos at once, which is the
 * thing this module exists to avoid. A photo that cannot be read is left out.
 */
export async function encodePickedPhotos(
  assets: PickedPhoto[],
  deps: PhotoDeps,
  maxEdge: number = MAX_SCAN_EDGE,
): Promise<string[]> {
  const out: string[] = [];
  for (const asset of assets) {
    const url = await encodePickedPhoto(asset, deps, maxEdge);
    if (url) out.push(url);
  }
  return out;
}
