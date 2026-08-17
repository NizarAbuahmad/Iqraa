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
