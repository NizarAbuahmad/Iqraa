/**
 * Which photos must be re-encoded before upload so their metadata is dropped.
 *
 * A phone's JPEG or HEIC carries EXIF: camera model, timestamp and, unless the
 * camera's location setting is off, GPS coordinates. A student's homework
 * photo or a chat image would carry the home address to whoever opens it. Both
 * re-encoders we use (iOS `UIImage.jpegData`, Android `Bitmap.compress`, and
 * the web canvas) write pixels only, so passing a photo through them removes
 * the metadata. Until now that happened only when the photo needed shrinking.
 *
 * PNG, GIF and WebP are left alone when no resize is needed. They are not what
 * a camera writes, GPS is not part of their usual output, and a JPEG re-encode
 * would flatten transparency (PNG, WebP) or animation (GIF). A resize already
 * turns any of them into a JPEG, as before.
 *
 * No imports, so `node --test` can load it.
 */

/** Types that carry EXIF/GPS from a camera. */
const EXIF_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);

function mimeFromName(name: string): string | null {
  const m = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(name);
  switch (m?.[1]?.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return null;
  }
}

/**
 * Does this photo carry camera metadata? The picker's `mimeType` first, the
 * file name second; with neither we assume a JPEG, as the encoder always has,
 * because the cost of a wrong «yes» is one needless re-encode and of a wrong
 * «no» is a leaked location.
 */
export function carriesCameraMetadata(mimeType?: string | null, uri?: string | null): boolean {
  const mime = (mimeType || (uri ? mimeFromName(uri) : null) || 'image/jpeg').toLowerCase().split(';')[0]!.trim();
  return EXIF_TYPES.has(mime);
}
