/**
 * Deck video lookup — a real, existing explainer video for Slides Maker,
 * found by search rather than generated. Goes through the API server rather
 * than YouTube directly, so the API key never ships in the mobile bundle.
 */
import { apiJson } from './apiClient';

export interface DeckVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  url: string;
}

/**
 * Never throws — no video (unset server key, no results, offline) is a
 * normal outcome the deck must not stall or error on.
 */
export async function searchDeckVideo(query: string, lang: 'ar' | 'en'): Promise<DeckVideo | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const { video } = await apiJson<{ video: DeckVideo | null }>(
      `/media/youtube-video?query=${encodeURIComponent(q)}&lang=${lang}`,
    );
    return video;
  } catch {
    return null;
  }
}
