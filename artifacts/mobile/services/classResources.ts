/**
 * The pure half of a class's Resources tab — what sits beside a teacher's own
 * materials once Library items can be put in front of a class.
 *
 * Pure on purpose: no `react-native`, no `expo-*`, and every import is a type
 * import, so the bare `node --test` runner can load it.
 *
 * Spec: docs/superpowers/specs/2026-10-04-class-resources-design.md
 */
import { getT } from './i18n.ts';
import type { ResourceItem, ResourceKind, ResourceSource } from './resourceCatalog.ts';
import type { SavedMaterial } from './workspace.ts';

/**
 * One Library item on a class's shelf, as the server returns it. `kind` is
 * `library` today; pasted links and device files are later pieces.
 */
export interface ClassResource {
  id: string;
  kind: 'library';
  source: ResourceSource;
  nativeId: string;
  /** The title the item had when it was added. */
  title: string;
  mediaKind: ResourceKind;
  url: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  /** A staff upload the Library has since deleted. */
  unavailable: boolean;
}

/** The body of `POST /classes/:id/resources`. */
export interface AddResourceBody {
  kind: 'library';
  source: ResourceSource;
  nativeId: string;
  title?: string;
  mediaKind?: ResourceKind;
  url?: string;
  thumbnailUrl?: string;
}

export type ClassShelfEntry =
  | { type: 'material'; key: string; at: string; material: SavedMaterial }
  | { type: 'resource'; key: string; at: string; resource: ClassResource };

function timeOf(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Materials and resources as one list, newest first.
 *
 * `Array.prototype.sort` is stable, so two entries with the same timestamp keep
 * their input order: materials ahead of resources. An unreadable timestamp
 * counts as the oldest instead of making the comparator return NaN, which would
 * leave the order undefined.
 */
export function mergeClassShelf(
  materials: SavedMaterial[],
  resources: ClassResource[],
): ClassShelfEntry[] {
  const entries: ClassShelfEntry[] = [
    ...materials.map(material => ({
      type: 'material' as const,
      key: `material:${material.id}`,
      at: material.savedAt,
      material,
    })),
    ...resources.map(resource => ({
      type: 'resource' as const,
      key: `resource:${resource.id}`,
      at: resource.createdAt,
      resource,
    })),
  ];
  return entries.sort((a, b) => timeOf(b.at) - timeOf(a.at));
}

/**
 * `<source>:<nativeId>` for every resource already on the shelf — the same key
 * `ResourceItem.key` carries, so "already added" is one Set lookup in the picker.
 */
export function addedKeys(resources: ClassResource[]): Set<string> {
  return new Set(resources.map(resource => `${resource.source}:${resource.nativeId}`));
}

/**
 * What to POST for a catalogue item. A staff upload goes by id alone: the
 * server copies title, kind and link from its own row and ignores anything
 * else. A premade sheet or a book-QR code lives in this bundle where the server
 * cannot see it, so the snapshot travels with the request.
 */
export function addBodyFor(item: ResourceItem, lang: 'ar' | 'en'): AddResourceBody {
  const base = { kind: 'library' as const, source: item.source, nativeId: item.nativeId };
  if (item.source === 'uploaded') return base;

  let title = lang === 'en' && item.titleEn ? item.titleEn : item.titleAr;

  // For book-QR items with a page, append the page label so rows from the same book differ
  if (item.source === 'book-qr' && item.page !== undefined) {
    const pageText = lang === 'ar' ? item.page.toLocaleString('ar-EG') : String(item.page);
    title = `${title} — ${getT(lang)('qrOnPage', pageText)}`;
  }

  return {
    ...base,
    title,
    mediaKind: item.kind,
    ...(item.source === 'book-qr' && item.url ? { url: item.url } : {}),
    ...(item.thumbnailUrl ? { thumbnailUrl: item.thumbnailUrl } : {}),
  };
}

export type OpenTarget =
  | { kind: 'url'; url: string }
  | { kind: 'premade'; id: string }
  | { kind: 'none' };

/** Where a tap on a resource row goes. */
export function openTargetFor(resource: ClassResource): OpenTarget {
  if (resource.unavailable) return { kind: 'none' };
  if (resource.source === 'premade-sheet') return { kind: 'premade', id: resource.nativeId };
  return resource.url ? { kind: 'url', url: resource.url } : { kind: 'none' };
}

/**
 * Whether a shelf row should carry the Library's "insecure link (http)" line.
 * Only book-QR codes can be stored over plain http (the server refuses http for
 * everything else), so this mirrors the picker's per-row `insecure` flag from
 * the url the row kept.
 */
export function isInsecureResource(resource: ClassResource): boolean {
  return resource.source === 'book-qr' && /^http:/i.test(resource.url ?? '');
}
