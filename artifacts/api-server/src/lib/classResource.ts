/**
 * Rules for a class's Library resources (routes/roster.ts,
 * /classes/:id/resources): what the app may send, and what the app is sent
 * back. Pure, so the decisions are testable without a database. Sibling of
 * libraryResource.ts, which governs the Library itself.
 *
 * Spec: docs/superpowers/specs/2026-10-04-class-resources-design.md
 */
import { LIBRARY_CATEGORIES, type LibraryCategory } from "./libraryResource.ts";

export const LIBRARY_SOURCES = ["uploaded", "premade-sheet", "book-qr"] as const;
export type LibrarySource = (typeof LIBRARY_SOURCES)[number];

/** The Library categories plus `page`, which a book-QR code can point at. */
export const MEDIA_KINDS = [...LIBRARY_CATEGORIES, "page"] as const;
export type MediaKind = LibraryCategory | "page";

function isLibrarySource(value: unknown): value is LibrarySource {
  return typeof value === "string" && (LIBRARY_SOURCES as readonly string[]).includes(value);
}

function isMediaKind(value: unknown): value is MediaKind {
  return typeof value === "string" && (MEDIA_KINDS as readonly string[]).includes(value);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

const MAX_TITLE = 200;
const MAX_URL = 2048;
const MAX_THUMBNAIL = 2000;
/** A book-QR id is `<page>:<url>`, so it is as long as a url. */
const MAX_NATIVE_ID = 2200;

export type ClassResourceInput =
  | { source: "uploaded"; nativeId: string }
  | {
      source: "premade-sheet" | "book-qr";
      nativeId: string;
      title: string;
      mediaKind: MediaKind;
      url: string | null;
      thumbnailUrl: string | null;
    };

/** A well-formed link within `max` characters, or null. Never truncates: a clipped url saves a link that 404s. */
function parseUrl(value: unknown, allowHttp: boolean, max: number): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.length > max) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" || (allowHttp && url.protocol === "http:")) return url.toString();
    return null;
  } catch {
    return null;
  }
}

/**
 * Validates the body of `POST /classes/:id/resources`.
 *
 * A staff upload is identified by its id alone: the route copies title, kind
 * and link from its own `library_resources` row, so nothing else the app sent
 * is read. A premade sheet or a book-QR code lives in the app's own bundle
 * where the server cannot see it, so the snapshot the app sends is validated.
 */
export function parseClassResourceInput(body: unknown): ClassResourceInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "A JSON body is required" };
  const b = body as Record<string, unknown>;

  if (b["kind"] !== "library") return { error: "kind must be library" };
  const source = b["source"];
  if (!isLibrarySource(source)) return { error: `source must be one of ${LIBRARY_SOURCES.join(", ")}` };

  const nativeId = typeof b["nativeId"] === "string" ? b["nativeId"].trim() : "";
  if (!nativeId || nativeId.length > MAX_NATIVE_ID) return { error: "nativeId is required" };

  if (source === "uploaded") {
    if (!isUuid(nativeId)) return { error: "nativeId must be a library item id" };
    return { source, nativeId: nativeId.toLowerCase() };
  }

  const title = typeof b["title"] === "string" ? b["title"].trim() : "";
  if (!title) return { error: "title is required" };
  if (title.length > MAX_TITLE) return { error: `title must be at most ${MAX_TITLE} characters` };

  const mediaKind = b["mediaKind"];
  if (!isMediaKind(mediaKind)) return { error: `mediaKind must be one of ${MEDIA_KINDS.join(", ")}` };

  // A premade sheet never leaves the app, so any url sent with it is dropped.
  let url: string | null = null;
  if (source === "book-qr") {
    url = parseUrl(b["url"], true, MAX_URL);
    if (!url) return { error: `url must be an http(s) link of at most ${MAX_URL} characters` };
  }

  let thumbnailUrl: string | null = null;
  if (b["thumbnailUrl"] != null && b["thumbnailUrl"] !== "") {
    thumbnailUrl = parseUrl(b["thumbnailUrl"], false, MAX_THUMBNAIL);
    if (!thumbnailUrl) return { error: `thumbnailUrl must be an https link of at most ${MAX_THUMBNAIL} characters` };
  }

  return { source, nativeId, title, mediaKind, url, thumbnailUrl };
}

/** The ids of staff uploads among `rows`, i.e. the ones the Library can later delete. */
export function uploadedLibraryIds(
  rows: ReadonlyArray<{ librarySource: string | null; libraryNativeId: string | null }>,
): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    if (row.librarySource === "uploaded" && isUuid(row.libraryNativeId)) ids.push(row.libraryNativeId);
  }
  return ids;
}

export interface ClassResourceRowLike {
  id: string;
  kind: string;
  librarySource: string | null;
  libraryNativeId: string | null;
  title: string;
  mediaKind: string;
  url: string | null;
  thumbnailUrl: string | null;
  createdAt: Date;
}

export interface ClientClassResource {
  id: string;
  kind: string;
  source: string | null;
  nativeId: string | null;
  title: string;
  mediaKind: string;
  url: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  /** A staff upload the Library has since deleted. Premade sheets and book codes ship with the app and cannot vanish. */
  unavailable: boolean;
}

/**
 * One row as the app reads it. `presentLibraryIds` are the staff uploads that
 * still exist.
 *
 * `liveUrls` is the current link of each of those uploads, keyed by Library id,
 * computed by the route (this module stays free of r2.js and env access). A
 * staff upload's link is the one column built at read time rather than kept as
 * the snapshot taken when the teacher added it: it is composed from
 * `R2_PUBLIC_BASE_URL`, which may move, and the stored copy would strand the
 * row on the old host. It applies only to a staff upload whose Library row still
 * exists and whose current link is known; every other case, and every other
 * column, is the stored value.
 */
export function presentClassResource(
  row: ClassResourceRowLike,
  presentLibraryIds: ReadonlySet<string>,
  liveUrls?: ReadonlyMap<string, string | null>,
): ClientClassResource {
  const isUpload = row.librarySource === "uploaded" && !!row.libraryNativeId;
  const gone = isUpload && !presentLibraryIds.has(row.libraryNativeId!);
  const live = isUpload && !gone ? liveUrls?.get(row.libraryNativeId!) : undefined;
  return {
    id: row.id,
    kind: row.kind,
    source: row.librarySource,
    nativeId: row.libraryNativeId,
    title: row.title,
    mediaKind: row.mediaKind,
    url: typeof live === "string" ? live : row.url,
    thumbnailUrl: row.thumbnailUrl,
    createdAt: row.createdAt.toISOString(),
    unavailable: gone,
  };
}
