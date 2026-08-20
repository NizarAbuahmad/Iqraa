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
 * Every candidate the one search returned, best first.
 *
 * The API asks YouTube for five because a search costs the same quota whether
 * it returns one or five — so the alternatives a teacher cycles through in the
 * editor are already paid for, and rejecting a suggestion costs nothing.
 *
 * Never throws — no video (unset server key, no results, offline) is a normal
 * outcome the deck must not stall or error on.
 */
export async function searchDeckVideos(query: string, lang: 'ar' | 'en'): Promise<DeckVideo[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const { video, videos } = await apiJson<{ video: DeckVideo | null; videos?: DeckVideo[] }>(
      `/media/youtube-video?query=${encodeURIComponent(q)}&lang=${lang}`,
    );
    // `videos` is the newer field; fall back to `video` so a mobile build
    // newer than the deployed API still gets its one result rather than none.
    if (videos?.length) return videos;
    return video ? [video] : [];
  } catch {
    return [];
  }
}

/** The single best match — what the deck builder attaches. */
export async function searchDeckVideo(query: string, lang: 'ar' | 'en'): Promise<DeckVideo | null> {
  return (await searchDeckVideos(query, lang))[0] ?? null;
}
