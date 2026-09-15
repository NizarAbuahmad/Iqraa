/**
 * One list out of four unrelated libraries.
 *
 * The resources tab offers a teacher everything supplementary in one place:
 * frozen practice sheets, the classroom activity formats, the licensed
 * third-party media, and the QR codes printed in the NCCD books. Those arrive
 * in four different shapes from four different places, and the screen should
 * not know that. This module is the adapter, and it is the only thing that
 * does know.
 *
 * Pure on purpose — no `react-native`, no `expo-*`, and every import below is
 * `import type`, so nothing is pulled in at runtime. The mobile test runner is
 * bare `node --test` with no React Native transform, so a value import from a
 * module that touches `react-native` at module scope would make this file
 * untestable, the way `routeGating.ts` and `fetchWithTimeout.ts` had to be
 * split out of their callers for the same reason.
 *
 * Data comes in through `ResourceCatalogInput` rather than being fetched here.
 * That keeps the module testable, and it lets the screen resolve activity
 * titles through `t()` — the activity cards carry i18n keys, not titles.
 *
 * Not included yet: the teacher's own media library. `saveLibraryLink` and
 * `GET /media/library` live on an unmerged branch, so there is no teacher-owned
 * row for a curated item to become and nothing to attach a class to. Curated
 * media and book-QR rows therefore offer `open` only. When that branch lands,
 * a fifth source slots in here and the screen does not change.
 */
import type { PremadeWorksheet } from '@workspace/curriculum/premade';
import type { ExternalResource } from '@workspace/curriculum/external';
import type { QrResourceBook } from './bookQrLinks.ts';

/** Which library a row came out of. Also the section it renders under. */
export type ResourceSource = 'premade-sheet' | 'activity' | 'curriculum-media' | 'book-qr';

export type ResourceKind =
  | 'worksheet'
  | 'game'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'page'
  | 'text';

/**
 * What a row lets a teacher do.
 *
 * `print` renders the frozen sheet through the same `buildWorksheetHTML` →
 * `exportAsPDF` path the generator screen uses. `run` hands an activity to the
 * classroom presenter. `open` leaves the app. `add-to-class` files a copy —
 * see `addToClassPlan` for what that actually costs per source.
 */
export type ResourceAction = 'add-to-class' | 'print' | 'open' | 'run';

export interface ResourceItem {
  /** `<source>:<nativeId>`. Unique across every source by construction. */
  key: string;
  source: ResourceSource;
  /** The id within its own library — the sheet id, the card id, and so on. */
  nativeId: string;
  kind: ResourceKind;
  titleAr: string;
  titleEn: string;
  /** KB lesson id when the row is lesson-scoped. An id, never a title. */
  lessonId?: string;
  gradeId?: string;
  subjectId?: string;
  /** Rendered verbatim wherever the row appears. A licence term, not a label. */
  attribution?: string;
  /** Where `open` goes. Absent on rows that never leave the app. */
  url?: string;
  /** The printed page a book-QR code sits on — the locator a student can act on. */
  page?: number;
  /**
   * The row opens over plain http.
   *
   * Carried per row rather than warned about once per screen: on a list where
   * one link is insecure and the rest are not, a header note tells a student
   * nothing about the one they are about to tap.
   */
  insecure?: boolean;
  actions: ResourceAction[];
}

export interface ResourceCatalogInput {
  premade: PremadeWorksheet[];
  /**
   * The activity cards, titles already resolved. `ACTIVITY_CARDS` carries
   * `titleKey`/`descKey`, so the screen resolves them; this module stays free
   * of i18n.
   */
  activities: Array<{ id: string; titleAr: string; titleEn: string }>;
  external: ExternalResource[];
  qr: QrResourceBook[];
}

export interface ResourceFilter {
  kinds?: ResourceKind[];
  sources?: ResourceSource[];
  lessonId?: string;
  query?: string;
}

/**
 * Section order: what a teacher preparing a lesson can use soonest, first.
 *
 * A ready sheet is one tap from a printer; an activity needs building; curated
 * media is a link to judge; the book codes are a reference shelf.
 */
const SOURCE_ORDER: ResourceSource[] = [
  'premade-sheet',
  'activity',
  'curriculum-media',
  'book-qr',
];

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

function fromActivity(card: { id: string; titleAr: string; titleEn: string }): ResourceItem {
  return {
    key: `activity:${card.id}`,
    source: 'activity',
    nativeId: card.id,
    kind: 'game',
    titleAr: card.titleAr,
    titleEn: card.titleEn,
    actions: ['add-to-class', 'run'],
  };
}

/**
 * A curated third-party resource.
 *
 * Returns null for `simulation`. PhET relicensed to CC BY-NC in March 2026 and
 * GeoGebra needs a commercial agreement, so there is no simulation this product
 * may lawfully embed — a row for one would be a control with no destination.
 * The manifest holds none today; this drops any that appear later rather than
 * rendering a dead row.
 */
function fromExternal(resource: ExternalResource): ResourceItem | null {
  if (resource.kind === 'simulation') return null;
  const url = resource.sourceUrl;
  if (!url) return null;
  return {
    key: `curriculum-media:${resource.id}`,
    source: 'curriculum-media',
    nativeId: resource.id,
    kind: resource.kind,
    titleAr: resource.titleAr,
    titleEn: resource.titleEn,
    lessonId: resource.lessonIds[0],
    attribution: resource.attribution,
    url,
    actions: ['open'],
  };
}

/**
 * The QR codes printed in one book.
 *
 * `open` only, and that is a property of the source rather than a limitation
 * here: the ministry host serves these over plain http, so an inline player
 * would be blocked as mixed content and render dead. See `bookQrLinks.ts`.
 *
 * These rows carry no id and no title of their own, so the key is built from
 * the two things that identify one — the page it is printed on and where it
 * points — and the title names the book it came out of.
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

/** Adapt every library into one list, in section order. */
export function buildResourceCatalog(input: ResourceCatalogInput): ResourceItem[] {
  const items: ResourceItem[] = [
    ...input.premade.map(fromPremade),
    ...input.activities.map(fromActivity),
    ...input.external.map(fromExternal).filter((item): item is ResourceItem => item !== null),
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
    if (query) {
      const haystack = `${item.titleAr} ${item.titleEn}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

/** Group into sections, in `SOURCE_ORDER`, omitting any source with no rows. */
export function groupBySource(
  items: ResourceItem[],
): Array<{ source: ResourceSource; items: ResourceItem[] }> {
  return SOURCE_ORDER.map(source => ({
    source,
    items: items.filter(item => item.source === source),
  })).filter(group => group.items.length > 0);
}

/**
 * The writes "add to class" needs, in order, for a given source.
 *
 * Kept here rather than in the component so the mapping is testable — the
 * component imports `react-native` and the bare test runner cannot load it.
 *
 * An empty array means this source cannot be attached at all, which is the
 * honest answer for curated media and book-QR rows today: attaching one needs
 * a teacher-owned `lesson_media` row, and the call that creates one from a link
 * (`saveLibraryLink`) is on the unmerged media-library branch.
 */
export type AddToClassStep = 'save-material' | 'attach-material';

export function addToClassPlan(item: Pick<ResourceItem, 'source'>): AddToClassStep[] {
  switch (item.source) {
    case 'premade-sheet':
    case 'activity':
      // Materialise a teacher-owned copy first: attaching the shared manifest
      // entry itself would let one teacher's edit change every teacher's sheet.
      return ['save-material', 'attach-material'];
    case 'curriculum-media':
    case 'book-qr':
      return [];
  }
}
