/**
 * The two decisions the media library makes that are worth getting right on
 * their own, pulled out of the routes so they can be tested without a database.
 *
 * Both concern the same split: a library row is either an UPLOAD, whose bytes
 * are in R2, or a LINK to something already on the web. Everything downstream
 * branches on which, and getting it wrong is quiet — a message with an
 * attachment pointing at nothing, or a slide whose picture never loads.
 */

/** Every kind a library row may claim. Only `video` has no upload path. */
export const MEDIA_KINDS = ["image", "video", "audio", "document"] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];

export function isMediaKind(value: unknown): value is MediaKind {
  return typeof value === "string" && (MEDIA_KINDS as readonly string[]).includes(value);
}

/**
 * Whether a saved link is one this app can actually show.
 *
 * https only — `http://` loads as mixed content on Expo web, which projects a
 * blank frame in front of a class rather than failing loudly. Upgrading it
 * silently would be worse: the teacher would think they saved the thing they
 * pasted.
 */
export function isValidLibraryLink(sourceUrl: string): boolean {
  return /^https:\/\/[^\s]+$/i.test(sourceUrl.trim());
}

/** The subset of a library row that decides how it is shared. */
export type ShareableItem = {
  kind: string;
  r2Key: string | null;
  sourceUrl: string | null;
  caption: string;
  mimeType: string | null;
  sizeBytes: number | null;
};

export type SharePayload = {
  /** Reuses the item's own R2 object — nothing is copied. Null for a link. */
  attachment: { key: string; kind: "image" | "audio" | "document"; mime: string; sizeBytes: number } | null;
  /** Appended to the message body. Empty for an upload, which speaks for itself. */
  bodyLine: string;
};

/**
 * How a library item travels inside a chat message.
 *
 * An upload is attached by **reusing its R2 key**, not by copying the bytes:
 * one object, two rows pointing at it. That is only safe because the library's
 * DELETE refuses to erase an object a chat message still references — without
 * that guard, tidying up your library would blank photos out of conversations
 * other people can still see.
 *
 * A link has no object at all, so it goes as text. Not a downgrade: a link in
 * a message is exactly what a student taps, and it is what they would have
 * received anyway.
 *
 * Returns null for a row that can be neither — a link with no URL. Those
 * should not exist, and sending an empty message is a worse answer than
 * refusing.
 */
export function librarySharePayload(item: ShareableItem): SharePayload | null {
  if (item.r2Key) {
    return {
      attachment: {
        key: item.r2Key,
        // `video` never has an r2Key (there is no upload path for one), so
        // anything stored here is one of the three kinds a chat attachment can
        // be. The fallbacks cover rows written before those columns existed.
        kind: item.kind as "image" | "audio" | "document",
        mime: item.mimeType ?? "application/octet-stream",
        sizeBytes: item.sizeBytes ?? 0,
      },
      bodyLine: "",
    };
  }

  const url = (item.sourceUrl ?? "").trim();
  if (!url) return null;
  const caption = item.caption.trim();
  return { attachment: null, bodyLine: caption ? `${caption}\n${url}` : url };
}
