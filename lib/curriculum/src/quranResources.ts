/**
 * Outside resources for the Quran Corner: readers, recitation audio, the text
 * source. Link-out only — nothing here is embedded, ingested or copied, so no
 * licence is recorded. `urlCheckedAt` is the date someone last opened the link
 * and saw what it claims to be; null means nobody has, and the screen does not
 * pretend otherwise.
 */
import raw from './data/quran_resources.json' with { type: 'json' };

export type QuranResourceKind = 'reader' | 'audio' | 'tajweed' | 'tafsir' | 'text';

export interface QuranResource {
  id: string;
  /** A brand name, shown as written in both languages. */
  provider: string;
  kind: QuranResourceKind;
  url: string;
  /** `YYYY-MM-DD`, or null when the link has not been checked. */
  urlCheckedAt: string | null;
}

export const QURAN_RESOURCE_KINDS: readonly QuranResourceKind[] = ['reader', 'audio', 'tajweed', 'tafsir', 'text'];

export const QURAN_RESOURCES: QuranResource[] = raw.items as QuranResource[];

/** Structural problems, as messages. This reports; the test decides. */
export function validateQuranResources(items: readonly QuranResource[] = QURAN_RESOURCES): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) errors.push(`${item.id}: duplicate id`);
    seen.add(item.id);
    if (!item.provider.trim()) errors.push(`${item.id}: blank provider`);
    if (!QURAN_RESOURCE_KINDS.includes(item.kind)) errors.push(`${item.id}: unknown kind "${item.kind}"`);
    try {
      if (new URL(item.url).protocol !== 'https:') errors.push(`${item.id}: ${item.url} is not https`);
    } catch {
      errors.push(`${item.id}: "${item.url}" is not a URL`);
    }
    if (item.urlCheckedAt !== null && !/^\d{4}-\d{2}-\d{2}$/.test(item.urlCheckedAt)) {
      errors.push(`${item.id}: urlCheckedAt must be YYYY-MM-DD or null`);
    }
  }
  return errors;
}
