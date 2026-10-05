/**
 * A cover image derivable from a video's link alone, with no extraction.
 * Pure on purpose: the mobile test runner cannot load anything that imports
 * `react-native`, and `videoThumbnail.ts` (frame extraction for self-hosted
 * files) does.
 */

/** YouTube video ID → thumbnail URL, or null for non-YouTube URLs. */
export function youtubeThumbnail(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}

/**
 * Google Drive file → its preview image. Only a file shared as "anyone with
 * the link" has one; for a private file the image request fails and the card
 * falls back to the neutral tile, same as having no cover at all.
 */
export function driveThumbnail(url: string): string | null {
  const m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]{10,})/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w640` : null;
}

export function videoCoverFromUrl(url: string): string | null {
  return youtubeThumbnail(url) ?? driveThumbnail(url);
}
