/**
 * Fetch our own copy of a curated external resource.
 *
 * Mirrors `unsplashImage.ts`: goes through the API server rather than at the
 * asset directly, because the object lives in a private R2 bucket and the URL
 * that reaches it is signed and short-lived.
 *
 * The attribution comes back with the URL rather than being read from the
 * manifest separately. Every licence represented here requires the credit
 * wherever the asset appears, and a renderer that has to look it up elsewhere
 * is one that will eventually render the image and forget the line.
 */
import { apiJson } from './apiClient';

export interface ExternalAsset {
  url: string;
  kind: 'text' | 'audio' | 'image' | 'simulation' | 'video';
  /** Render verbatim, next to the asset. Not optional in practice. */
  attribution: string;
  sourceUrl: string;
  licenseUrl: string;
}

/**
 * Never throws. A resource with no stored copy — one we may point at but not
 * host — is a normal outcome answered with `null`, not an error: the lesson
 * shelf still links to it, and a panel that crashed on the distinction would
 * take the whole lesson page with it.
 */
export async function loadExternalAsset(id: string): Promise<ExternalAsset | null> {
  if (!id) return null;
  try {
    return await apiJson<ExternalAsset>(`/media/external/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}
