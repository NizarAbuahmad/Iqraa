/**
 * One list out of three libraries.
 *
 * The library screen offers ready-made material only, in one place: what Iqraa
 * staff upload per grade/subject/lesson (`libraryApi.ts`), the frozen practice
 * sheets, and the QR codes printed in the NCCD books. Those arrive in three
 * shapes from three places, and the screen should not know that. This module
 * is the adapter, and it is the only thing that does know.
 *
 * Templates that opened a generator, the classroom activity cards and the
 * curated Wikimedia media left this screen on 2026-09-25: the library is for
 * ready-made resources, not a door into the tools.
 *
 * Pure on purpose — no `react-native`, no `expo-*`, and every import below is
 * `import type`, so nothing is pulled in at runtime. The mobile test runner is
 * bare `node --test` with no React Native transform.
 */
import type { PremadeWorksheet } from '@workspace/curriculum/premade';
import type { QrResourceBook } from './bookQrLinks.ts';
import type { LibraryCategory, LibraryItem } from './libraryApi.ts';

/** Which library a row came out of. */
export type ResourceSource = 'uploaded' | 'premade-sheet' | 'book-qr';

export type ResourceKind =
  | LibraryCategory
  | 'image'
  | 'page';

/**
 * What a row lets a teacher do. `print` renders a frozen sheet; `open` opens
 * the file or link; `add-to-class` files a copy — see `addToClassPlan`.
 */
export type ResourceAction = 'add-to-class' | 'print' | 'open';

export interface ResourceItem {
  /** `<source>:<nativeId>`. Unique across every source by construction. */
  key: string;
  source: ResourceSource;
  nativeId: string;
  kind: ResourceKind;
  titleAr: string;
  titleEn: string;
  /** KB lesson id when the row is lesson-scoped. An id, never a title. */
  lessonId?: string;
  gradeId?: string;
  subjectId?: string;
  /** A short note shown under the title. */
  description?: string;
  /** Where `open` goes. Absent on rows that never leave the app. */
  url?: string;
  /** Cover image URL: set by admin, or auto-derived from a YouTube URL. */
  thumbnailUrl?: string;
  /** 1 or 2 when the resource covers one semester only. */
  semester?: 1 | 2;
  /** The printed page a book-QR code sits on. */
  page?: number;
  /** The row opens over plain http — warned per row, not once per screen. */
  insecure?: boolean;
  actions: ResourceAction[];
}

export interface ResourceCatalogInput {
  uploaded: LibraryItem[];
  premade: PremadeWorksheet[];
  qr: QrResourceBook[];
}

export interface ResourceFilter {
  kinds?: ResourceKind[];
  sources?: ResourceSource[];
  lessonId?: string;
  /** Keeps rows filed under this grade, plus rows filed under none. */
  gradeId?: string;
  /** Keeps rows for this subject, plus rows with no subject. */
  subjectId?: string;
  query?: string;
}

function fromUploaded(item: LibraryItem): ResourceItem | null {
  // A file the server can't give a URL for right now is a dead row; skip it.
  if (!item.url) return null;
  return {
    key: `uploaded:${item.id}`,
    source: 'uploaded',
    nativeId: item.id,
    kind: item.category,
    titleAr: item.titleAr,
    titleEn: item.titleAr,
    lessonId: item.lessonId ?? undefined,
    gradeId: item.gradeId,
    subjectId: item.subjectId,
    description: item.description || undefined,
    url: item.url,
    thumbnailUrl: item.thumbnailUrl ?? undefined,
    semester: item.semester ?? undefined,
    actions: ['open'],
  };
}

function fromPremade(sheet: PremadeWorksheet): ResourceItem {
  return {
    key: `premade-sheet:${sheet.id}`,
    source: 'premade-sheet',
    nativeId: sheet.id,
    kind: 'worksheet',
    titleAr: sheet.titleAr,
    titleEn: sheet.titleEn,
    lessonId: sheet.lessonId,
    gradeId: sheet.gradeId,
    subjectId: sheet.subjectId,
    actions: ['add-to-class', 'print'],
  };
}

/**
 * The QR codes printed in one book. `open` only: the ministry host serves
 * these over plain http, so an inline player would be blocked as mixed
 * content. See `bookQrLinks.ts`.
 */
function fromQrBook(book: QrResourceBook): ResourceItem[] {
  return book.resources.map(resource => ({
    key: `book-qr:${resource.pdfPage}:${resource.url}`,
    source: 'book-qr' as const,
    nativeId: `${resource.pdfPage}:${resource.url}`,
    kind: resource.kind,
    titleAr: book.title,
    titleEn: book.title,
    subjectId: book.subjectId,
    url: resource.url,
    page: resource.pdfPage,
    insecure: resource.isHttp,
    actions: ['open' as const],
  }));
}

/** Adapt every library into one list: uploads first, then sheets, then book codes. */
export function buildResourceCatalog(input: ResourceCatalogInput): ResourceItem[] {
  const items: ResourceItem[] = [
    ...input.uploaded.map(fromUploaded).filter((item): item is ResourceItem => item !== null),
    ...input.premade.map(fromPremade),
    ...input.qr.flatMap(fromQrBook),
  ];

  // Two books can print the same code on the same page. Keeping the first is
  // enough — a duplicate key would silently drop a row from a keyed list.
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

/** Every filter narrows; passing several combines them. */
export function filterResources(items: ResourceItem[], filter: ResourceFilter): ResourceItem[] {
  const query = filter.query?.trim().toLowerCase();
  return items.filter(item => {
    if (filter.kinds?.length && !filter.kinds.includes(item.kind)) return false;
    if (filter.sources?.length && !filter.sources.includes(item.source)) return false;
    if (filter.lessonId && item.lessonId !== filter.lessonId) return false;
    if (filter.gradeId && item.gradeId && item.gradeId !== filter.gradeId) return false;
    if (filter.subjectId && item.subjectId && item.subjectId !== filter.subjectId) return false;
    if (query) {
      const haystack = `${item.titleAr} ${item.titleEn}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

/**
 * A shelf is one tile on the library screen: every item of one kind, whatever
 * library it came from. Uploaded worksheets and the ready-made sheets share
 * the worksheet shelf; the book QR codes get one of their own, since they are
 * a mix of kinds grouped by book.
 */
export type Shelf = LibraryCategory | 'book-qr';

export const SHELF_ORDER: Shelf[] = [
  'infographic',
  'image',
  'video',
  'audio',
  'game',
  'worksheet',
  'template',
  'presentation',
  'document',
  'book-qr',
];

export function shelfOf(item: Pick<ResourceItem, 'source' | 'kind'>): Shelf | null {
  if (item.source === 'book-qr') return 'book-qr';
  return (SHELF_ORDER as string[]).includes(item.kind) ? (item.kind as Shelf) : null;
}

/** Shelves in display order, omitting any with no items. */
export function groupIntoShelves(items: ResourceItem[]): Array<{ shelf: Shelf; items: ResourceItem[] }> {
  return SHELF_ORDER.map(shelf => ({ shelf, items: items.filter(i => shelfOf(i) === shelf) }))
    .filter(group => group.items.length > 0);
}

/**
 * The writes "add to class" needs, in order, for a given source. Kept here so
 * the mapping is testable. Empty means the source can't be attached: uploads
 * and book codes are shared links, not teacher-owned material.
 */
export type AddToClassStep = 'save-material' | 'attach-material';

export function addToClassPlan(item: Pick<ResourceItem, 'source'>): AddToClassStep[] {
  switch (item.source) {
    case 'premade-sheet':
      // Materialise a teacher-owned copy first: attaching the shared manifest
      // entry itself would let one teacher's edit change every teacher's sheet.
      return ['save-material', 'attach-material'];
    case 'uploaded':
    case 'book-qr':
      return [];
  }
}
