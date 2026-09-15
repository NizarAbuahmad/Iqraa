/**
 * Deck photo lookup — a free, licensed image for Slides Maker so a
 * generated deck isn't all text. Goes through the API server rather than
 * Unsplash directly, so the access key never ships in the mobile bundle.
 */
import { apiJson } from './apiClient';

export interface DeckPhoto {
  url: string;
  thumbUrl: string;
  photographer: string;
  photographerUrl: string;
  unsplashLink: string;
  /**
   * Unsplash's own "this photo is being used" endpoint. Present only on
   * `searchDeckPhotos` results, which deliberately do not ping it — see
   * `markPhotoUsed`.
   */
  downloadLocation?: string;
}

/**
 * Never throws — no photo (unset server key, no results, offline) is a
 * normal outcome the deck must not stall or error on.
 */
export async function searchDeckPhoto(query: string): Promise<DeckPhoto | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const { photo } = await apiJson<{ photo: DeckPhoto | null }>(
      `/media/unsplash-photo?query=${encodeURIComponent(q)}`,
    );
    return photo;
  } catch {
    return null;
  }
}

/**
 * A page of candidates for the media-library picker, best first.
 *
 * Unlike `searchDeckPhoto`, this does NOT report the photos as used — listing
 * ten pictures a teacher is browsing is not ten uses. Call `markPhotoUsed`
 * with the one they actually pick; Unsplash's API terms require that ping, and
 * it is the same obligation the photographer credit in the caption satisfies
 * on the visible side.
 *
 * Never throws, same as `searchDeckPhoto` — an empty list is a normal outcome.
 */
export async function searchDeckPhotos(query: string, count = 9): Promise<DeckPhoto[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const { photos } = await apiJson<{ photos?: DeckPhoto[] }>(
      `/media/unsplash-photo?query=${encodeURIComponent(q)}&count=${count}`,
    );
    return photos ?? [];
  } catch {
    return [];
  }
}

/** Fire-and-forget: a failed attribution ping must never block adding the picture. */
export function markPhotoUsed(photo: DeckPhoto): void {
  if (!photo.downloadLocation) return;
  void apiJson('/media/unsplash-used', {
    method: 'POST',
    body: JSON.stringify({ downloadLocation: photo.downloadLocation }),
  }).catch(() => {});
}
